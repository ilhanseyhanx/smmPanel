'use strict';

// SISTEM SAGLIGI - FAZ 2: RAPORLAR (OKUMA YOLU)
//
// Yalnizca SQLite okur (ve kendi metrik tamponunu bosaltir ki panel en
// guncel veriyi gorsun). Saglayiciya, odeme sistemine veya herhangi bir dis
// servise ISTEK ATMAZ; axios/smmProvider/shopier/paytr burada yuklenmez.
//
// Yanitlarda: api_url, api_key, kullanici, e-posta, tutar, siparis veya odeme
// kimligi, ham saglayici govdesi YOKTUR. Olay detaylari yazilirken zaten
// merkezi redact() sureclerinden gecmistir.
//
// VERI OLGUNLUGU: az ornekle "Saglikli" denmez. 0 cagri = Veri Yok,
// 1-4 cagri = Yetersiz Ornek; yorum 5+ cagridan sonra yapilir.

const { dbAsync } = require('../config/database');
const healthEvents = require('./healthEvents');

const ESIK = Object.freeze({
  min_ornek: 5,
  saglikli_oran: 95,
  kritik_oran: 80,
  yavas_ms: 5000,
  zaman_asimi_uyari_oran: 5,
  altyapi_kritik_oran: 20
});

// Pencere -> saat. Sayimlar saatlik kovalardan gelir (bkz. PENCERE_NOTU).
const PENCERELER = Object.freeze({ '1h': 1, '24h': 24, '7d': 168 });
const PENCERE_NOTU = Object.freeze({
  '1h': 'Son 1 saat saatlik kovalarla hesaplanır: içinde bulunulan saat ile bir önceki saati kapsar (60–120 dk).',
  '24h': 'Sayılar saatlik kovalardan gelir; pencere başlangıcı en yakın saat başına yuvarlanır.',
  '7d': 'Sayılar saatlik kovalardan gelir; olay örnekleri 7 gün saklanır.'
});

const KAYNAK_ETIKETLERI = Object.freeze({
  paytr_callback: 'PayTR callback',
  paytr_token: 'PayTR ödeme başlatma',
  shopier_webhook: 'Shopier webhook',
  shopier_create: 'Shopier ödeme başlatma',
  shopier_settle: 'Shopier tahsilat eşleştirme',
  shopier_reconcile: 'Shopier mutabakatı',
  shopier_status: 'Shopier durum sorgusu',
  nowpayments_callback: 'NOWPayments callback',
  nowpayments_create: 'NOWPayments ödeme başlatma',
  telegram: 'Telegram Bot API',
  telegram_poller: 'Telegram eşleştirme işi',
  order_worker: 'Sipariş durum senkronu',
  provider_balance: 'Sağlayıcı bakiye kontrolü',
  http: 'HTTP istekleri'
});

const ODEME_SAGLAYICILARI = Object.freeze([
  { key: 'paytr', label: 'PayTR (Kart)', kaynaklar: ['paytr_callback', 'paytr_token'] },
  { key: 'shopier', label: 'Shopier (Kart)', kaynaklar: ['shopier_webhook', 'shopier_create', 'shopier_settle', 'shopier_reconcile', 'shopier_status'] },
  { key: 'nowpayments', label: 'NOWPayments (Kripto)', kaynaklar: ['nowpayments_callback', 'nowpayments_create'] }
]);

const KATEGORI_ALANI = Object.freeze({
  provider_timeout: 'timeouts',
  provider_5xx: 'err_5xx',
  provider_network: 'network',
  provider_balance: 'balance_errors',
  provider_order_error: 'order_errors',
  provider_status_error: 'status_errors',
  provider_error: 'other_errors'
});

const SEVIYE_SIRASI = { critical: 3, warning: 2, info: 1 };

// ---------------------------------------------------------------- yardimci
const kova = (saat) => healthEvents.saatKovasi(Date.now() - saat * 3600 * 1000);
const yuvarla = (x, b = 1) => Math.round(x * 10 ** b) / 10 ** b;

function epochIso(sn) {
  const v = Number(sn);
  return sn == null || !Number.isFinite(v) || v <= 0 ? null : new Date(v * 1000).toISOString();
}

function dbTarihIso(deger) {
  if (!deger) return null;
  const s = String(deger);
  const d = new Date(s.includes('T') || s.endsWith('Z') ? s : s.replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function scopeCoz(scope) {
  const [category, severity, source] = String(scope || '').split('|');
  return { category, severity, source };
}

function kategoriEtiketi(kat) {
  return healthEvents.KATEGORILER[kat]?.etiket || kat;
}

function kaynakEtiketi(kaynak, saglayiciAdlari) {
  const m = /^provider:(\d+)$/.exec(String(kaynak || ''));
  if (m) {
    const ad = saglayiciAdlari?.get(Number(m[1]));
    return ad ? `Sağlayıcı: ${ad}` : `Sağlayıcı #${m[1]}`;
  }
  return KAYNAK_ETIKETLERI[kaynak] || kaynak;
}

async function telemetriBaslangici() {
  const [m, e] = await Promise.all([
    dbAsync.get('SELECT MIN(bucket) b FROM health_metrics_hourly'),
    dbAsync.get('SELECT MIN(created_at) c FROM health_events')
  ]);
  const adaylar = [dbTarihIso(m?.b), dbTarihIso(e?.c)].filter(Boolean).sort();
  return adaylar[0] || null;
}

async function tazele() {
  // Panelin son 30 sn'lik olcumleri de gormesi icin tampon bosaltilir.
  // Bu yalnizca kendi telemetrimizi yazar; dis servise istek yoktur.
  try { await healthEvents.drain(); } catch { /* okuma yine yapilir */ }
}

// ---------------------------------------------------------- saglayici puani
function bosPencere() {
  return {
    requests: 0, ok: 0, fail: 0, success_rate: null, avg_ms: null, max_ms: null,
    timeouts: 0, err_5xx: 0, network: 0, balance_errors: 0, order_errors: 0,
    status_errors: 0, other_errors: 0, _gecikme: 0
  };
}

function pencereyiKapat(o) {
  o.success_rate = o.requests ? yuvarla((o.ok / o.requests) * 100) : null;
  o.avg_ms = o.requests ? Math.round(o._gecikme / o.requests) : null;
  delete o._gecikme;
  return o;
}

/**
 * Pasif durum hesabi. Yonlendirmeyi, saglayici secimini veya fiyati
 * ETKILEMEZ; yalnizca paneldeki rozeti belirler.
 */
function saglayiciDurumu(o) {
  if (!o || !o.requests) return { status: 'no_data', reason: 'Bu pencerede sağlayıcı çağrısı yok.' };
  if (o.requests < ESIK.min_ornek) {
    return { status: 'low_sample', reason: `${o.requests} çağrı var; yorum için en az ${ESIK.min_ornek} çağrı gerekir.` };
  }
  const oran = o.success_rate;
  const zamanAsimi = (o.timeouts / o.requests) * 100;
  const altyapi = ((o.timeouts + o.err_5xx + o.network) / o.requests) * 100;
  if (oran < ESIK.kritik_oran) return { status: 'critical', reason: `Başarı oranı %${oran} (%${ESIK.kritik_oran} altında).` };
  if (altyapi >= ESIK.altyapi_kritik_oran) {
    return { status: 'critical', reason: `Çağrıların %${yuvarla(altyapi)} kadarı zaman aşımı / 5xx / bağlantı hatası.` };
  }
  if (oran < ESIK.saglikli_oran) return { status: 'warning', reason: `Başarı oranı %${oran} (%${ESIK.kritik_oran}–%${ESIK.saglikli_oran} arası).` };
  if (zamanAsimi >= ESIK.zaman_asimi_uyari_oran) return { status: 'warning', reason: `Zaman aşımı oranı %${yuvarla(zamanAsimi)}.` };
  if (o.avg_ms != null && o.avg_ms >= ESIK.yavas_ms) return { status: 'warning', reason: `Ortalama yanıt ${o.avg_ms} ms (yavaş).` };
  return { status: 'healthy', reason: `Başarı oranı %${oran}, zaman aşımı düşük.` };
}

async function providerReport() {
  await tazele();
  const since24 = kova(24);
  const since1 = kova(1);
  const since30g = kova(24 * 30);
  const [saglayicilar, metrikler, olaylar, sonlar, sonHatalar, baslangic] = await Promise.all([
    // api_url / api_key BILEREK secilmez.
    dbAsync.all('SELECT id, name, status FROM providers ORDER BY id'),
    dbAsync.all(
      `SELECT bucket, metric, scope, n, "sum" AS toplam, "max" AS encok FROM health_metrics_hourly
       WHERE bucket >= ? AND metric IN ('provider_call', 'provider_ok', 'provider_fail') AND scope LIKE 'p:%'`,
      [since24]
    ),
    dbAsync.all(
      `SELECT bucket, scope, n FROM health_metrics_hourly
       WHERE bucket >= ? AND metric = 'event' AND scope LIKE 'provider%'`,
      [since24]
    ),
    dbAsync.all(
      `SELECT metric, scope, MAX("max") AS son FROM health_metrics_hourly
       WHERE bucket >= ? AND metric IN ('provider_ok', 'provider_fail') AND scope LIKE 'p:%'
       GROUP BY metric, scope`,
      [since30g]
    ),
    dbAsync.all(
      `SELECT e.source, e.category, e.detail, e.created_at FROM health_events e
       JOIN (SELECT source, MAX(id) AS mid FROM health_events WHERE source LIKE 'provider:%' GROUP BY source) s
         ON s.mid = e.id`
    ),
    telemetriBaslangici()
  ]);

  const kayit = new Map();
  const al = (id) => {
    if (!kayit.has(id)) kayit.set(id, { h1: bosPencere(), h24: bosPencere(), son_ok: null, son_fail: null, son_hata: null });
    return kayit.get(id);
  };

  for (const r of metrikler) {
    const id = Number(String(r.scope).slice(2));
    if (!Number.isInteger(id)) continue;
    const k = al(id);
    const pencereler = r.bucket >= since1 ? [k.h24, k.h1] : [k.h24];
    for (const p of pencereler) {
      if (r.metric === 'provider_call') {
        p.requests += r.n;
        p._gecikme += Number(r.toplam) || 0;
        if (r.encok != null) p.max_ms = Math.max(p.max_ms || 0, Math.round(r.encok));
      } else if (r.metric === 'provider_ok') p.ok += r.n;
      else if (r.metric === 'provider_fail') p.fail += r.n;
    }
  }

  for (const r of olaylar) {
    const { category, source } = scopeCoz(r.scope);
    const alan = KATEGORI_ALANI[category];
    const m = /^provider:(\d+)$/.exec(source || '');
    if (!alan || !m) continue;
    const k = al(Number(m[1]));
    k.h24[alan] += r.n;
    if (r.bucket >= since1) k.h1[alan] += r.n;
  }

  for (const r of sonlar) {
    const k = al(Number(String(r.scope).slice(2)));
    if (r.metric === 'provider_ok') k.son_ok = r.son;
    else k.son_fail = r.son;
  }

  for (const r of sonHatalar) {
    const m = /^provider:(\d+)$/.exec(r.source || '');
    if (!m) continue;
    al(Number(m[1])).son_hata = {
      category: r.category,
      label: kategoriEtiketi(r.category),
      detail: r.detail || '',
      at: dbTarihIso(r.created_at)
    };
  }

  const providers = saglayicilar.map(s => {
    const k = kayit.get(s.id) || { h1: bosPencere(), h24: bosPencere(), son_ok: null, son_fail: null, son_hata: null };
    const h1 = pencereyiKapat({ ...k.h1 });
    const h24 = pencereyiKapat({ ...k.h24 });
    const temel = h1.requests >= ESIK.min_ornek ? '1h' : '24h';
    const durum = saglayiciDurumu(temel === '1h' ? h1 : h24);
    return {
      id: s.id,
      name: String(s.name || `Sağlayıcı #${s.id}`).slice(0, 100),
      active: Number(s.status) === 1,
      status: durum.status,
      status_reason: durum.reason,
      status_basis: temel,
      last_success_at: epochIso(k.son_ok),
      last_failure_at: epochIso(k.son_fail),
      last_error: k.son_hata,
      window_1h: h1,
      window_24h: h24
    };
  });

  return {
    collected_at: new Date().toISOString(),
    telemetry_since: baslangic,
    thresholds: ESIK,
    window_note: PENCERE_NOTU['1h'],
    scoring_note: 'Pasif gözlemdir: sipariş yönlendirmesini, sağlayıcı seçimini veya fiyatları değiştirmez. Veri olgunlaşana kadar SYSTEM HEALTH puanına dahil edilmez.',
    providers
  };
}

async function providerDetail(id) {
  const rapor = await providerReport();
  const saglayici = rapor.providers.find(p => p.id === id);
  if (!saglayici) return null;
  const scope = 'p:' + id;
  const [satirlar, olaylar] = await Promise.all([
    dbAsync.all(
      `SELECT bucket, metric, n, "sum" AS toplam FROM health_metrics_hourly
       WHERE bucket >= ? AND scope = ? AND metric IN ('provider_call', 'provider_fail')
       ORDER BY bucket`,
      [kova(24), scope]
    ),
    dbAsync.all(
      'SELECT category, severity, detail, created_at FROM health_events WHERE source = ? ORDER BY id DESC LIMIT 10',
      ['provider:' + id]
    )
  ]);
  const seri = new Map();
  for (const r of satirlar) {
    const s = seri.get(r.bucket) || { bucket: dbTarihIso(r.bucket), requests: 0, fail: 0, avg_ms: null, _t: 0 };
    if (r.metric === 'provider_call') { s.requests += r.n; s._t += Number(r.toplam) || 0; }
    else s.fail += r.n;
    seri.set(r.bucket, s);
  }
  return {
    collected_at: rapor.collected_at,
    thresholds: rapor.thresholds,
    provider: saglayici,
    hourly: [...seri.values()].map(s => {
      const cikti = { bucket: s.bucket, requests: s.requests, fail: s.fail, avg_ms: s.requests ? Math.round(s._t / s.requests) : null };
      return cikti;
    }),
    recent_events: olaylar.map(e => ({
      category: e.category,
      label: kategoriEtiketi(e.category),
      severity: e.severity,
      detail: e.detail || '',
      at: dbTarihIso(e.created_at)
    }))
  };
}

// ------------------------------------------------------------------ odeme
function isciDurumu(tanim, d, metrik) {
  const sonCalisma = d?.last_run_at || (metrik.son_run ? metrik.son_run * 1000 : null);
  if (!sonCalisma) {
    return {
      status: 'no_data',
      reason: tanim.key === 'provider_balance'
        ? 'Bu süreçte henüz çalışmadı (bakiye eşiği tanımlı değilse bu iş sağlayıcıya çağrı yapmaz).'
        : 'Bu süreçte henüz çalışmadı.'
    };
  }
  if ((d?.consecutive_failures || 0) >= 3) return { status: 'critical', reason: `Art arda ${d.consecutive_failures} tur başarısız.` };
  if (d && d.last_error_at && (!d.last_ok_at || d.last_error_at >= d.last_ok_at)) return { status: 'warning', reason: 'Son tur hatayla bitti.' };
  if (Date.now() - sonCalisma > tanim.aralik_sn * 3 * 1000) return { status: 'warning', reason: 'Beklenen aralıkta çalışmadı.' };
  return { status: 'healthy', reason: 'Beklenen aralıkta çalışıyor.' };
}

async function paymentReport() {
  await tazele();
  const since24 = kova(24);
  const [niyetler, sonBasari, olaylar, sonHatalar, iscilerMetrik, baslangic] = await Promise.all([
    // Yalnizca toplu sayim: kullanici, tutar, merchant_oid SECILMEZ.
    dbAsync.all(
      `SELECT provider, status, COUNT(*) AS n FROM payment_intents
       WHERE created_at >= datetime('now', '-1 day') GROUP BY provider, status`
    ),
    dbAsync.all(`SELECT provider, MAX(completed_at) AS son FROM payment_intents WHERE status = 'completed' GROUP BY provider`),
    dbAsync.all(
      `SELECT scope, SUM(n) AS n FROM health_metrics_hourly WHERE bucket >= ? AND metric = 'event' GROUP BY scope`,
      [since24]
    ),
    dbAsync.all(
      `SELECT e.source, e.category, e.severity, e.detail, e.created_at FROM health_events e
       JOIN (SELECT source, MAX(id) AS mid FROM health_events GROUP BY source) s ON s.mid = e.id`
    ),
    dbAsync.all(
      `SELECT metric, scope, SUM(n) AS n, MAX("max") AS son FROM health_metrics_hourly
       WHERE bucket >= ? AND metric IN ('worker_run', 'worker_fail') GROUP BY metric, scope`,
      [since24]
    ),
    telemetriBaslangici()
  ]);

  const olayOzet = olaylar.map(r => ({ ...scopeCoz(r.scope), n: r.n }));
  const sonHataMap = new Map(sonHatalar.map(r => [r.source, r]));

  const providers = ODEME_SAGLAYICILARI.map(t => {
    const sayim = { created: 0, completed: 0, failed: 0, pending: 0 };
    niyetler.filter(r => r.provider === t.key).forEach(r => {
      sayim.created += r.n;
      if (sayim[r.status] != null) sayim[r.status] += r.n;
    });
    const ilgili = olayOzet.filter(o => t.kaynaklar.includes(o.source));
    const hata24 = ilgili.reduce((a, o) => a + o.n, 0);
    const webhook24 = ilgili.filter(o => o.category === 'webhook_error').reduce((a, o) => a + o.n, 0);
    const kritik24 = ilgili.filter(o => o.severity === 'critical').reduce((a, o) => a + o.n, 0);
    const sonHata = t.kaynaklar
      .map(k => sonHataMap.get(k))
      .filter(Boolean)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];

    let status, reason;
    if (kritik24 > 0) { status = 'critical'; reason = `Son 24 saatte ${kritik24} kritik ödeme/webhook olayı.`; }
    else if (hata24 > 0) { status = 'warning'; reason = `Son 24 saatte ${hata24} ödeme/webhook hatası.`; }
    else if (sayim.completed > 0) { status = 'healthy'; reason = 'Son 24 saatte tamamlanan ödeme var, hata yok.'; }
    else if (sayim.created > 0) { status = 'low_sample'; reason = 'Son 24 saatte tamamlanan ödeme yok; yorum için veri yetersiz.'; }
    else { status = 'no_data'; reason = 'Son 24 saatte bu yöntemle ödeme girişimi yok.'; }

    return {
      key: t.key,
      label: t.label,
      status,
      status_reason: reason,
      last_success_at: dbTarihIso(sonBasari.find(r => r.provider === t.key)?.son),
      last_error_at: sonHata ? dbTarihIso(sonHata.created_at) : null,
      last_error: sonHata ? { category: sonHata.category, label: kategoriEtiketi(sonHata.category), detail: sonHata.detail || '' } : null,
      intents_24h: sayim,
      errors_24h: hata24,
      webhook_errors_24h: webhook24
    };
  });

  const nabiz = healthEvents.workerSnapshot();
  const workers = Object.entries(healthEvents.ISCILER).map(([key, tanim]) => {
    const run = iscilerMetrik.find(r => r.metric === 'worker_run' && r.scope === key);
    const fail = iscilerMetrik.find(r => r.metric === 'worker_fail' && r.scope === key);
    const d = nabiz[key];
    const durum = isciDurumu({ key, ...tanim }, d, { son_run: run?.son });
    return {
      key,
      label: tanim.etiket,
      interval_sec: tanim.aralik_sn,
      status: durum.status,
      status_reason: durum.reason,
      last_run_at: d?.last_run_at ? new Date(d.last_run_at).toISOString() : epochIso(run?.son),
      last_ok_at: d?.last_ok_at ? new Date(d.last_ok_at).toISOString() : null,
      last_error_at: d?.last_error_at ? new Date(d.last_error_at).toISOString() : null,
      last_error: d?.last_error || null,
      consecutive_failures: d?.consecutive_failures || 0,
      runs_24h: run?.n || 0,
      fails_24h: fail?.n || 0
    };
  });

  return {
    collected_at: new Date().toISOString(),
    telemetry_since: baslangic,
    note: 'Başarı zamanı ödeme kayıtlarından okunur; hata sayıları yalnızca sistem kaynaklı olaylardır (müşterinin reddedilen kartı hata sayılmaz). Kullanıcı, tutar ve ödeme kimliği gösterilmez.',
    workers_note: 'İş nabızları bellekte tutulur; uygulama yeniden başladığında ilk tura kadar "Veri Yok" görünür.',
    providers,
    workers
  };
}

// ----------------------------------------------------------------- hatalar
async function errorReport(pencere) {
  const saat = PENCERELER[pencere];
  if (!saat) {
    const err = new Error('Geçersiz pencere. 1h, 24h veya 7d kullanın.');
    err.status = 400;
    throw err;
  }
  await tazele();
  const since = kova(saat);
  const [satirlar, ornekler, saglayicilar, baslangic] = await Promise.all([
    dbAsync.all(
      `SELECT scope, SUM(n) AS n, MAX("max") AS son FROM health_metrics_hourly
       WHERE bucket >= ? AND metric = 'event' GROUP BY scope`,
      [since]
    ),
    dbAsync.all(
      `SELECT category, severity, source, detail, created_at FROM health_events
       WHERE created_at >= ? ORDER BY id DESC LIMIT 1000`,
      [since]
    ),
    dbAsync.all('SELECT id, name FROM providers'),
    telemetriBaslangici()
  ]);
  const adlar = new Map(saglayicilar.map(s => [s.id, String(s.name || '').slice(0, 100)]));

  const gruplar = new Map();
  for (const r of satirlar) {
    const { category, severity, source } = scopeCoz(r.scope);
    if (!category) continue;
    const g = gruplar.get(category) || {
      category,
      label: kategoriEtiketi(category),
      group: healthEvents.KATEGORILER[category]?.grup || 'other',
      severity: 'info',
      count: 0,
      _son: 0,
      _kaynak: new Map(),
      samples: []
    };
    g.count += r.n;
    if ((SEVIYE_SIRASI[severity] || 0) > (SEVIYE_SIRASI[g.severity] || 0)) g.severity = severity;
    g._son = Math.max(g._son, Number(r.son) || 0);
    g._kaynak.set(source, (g._kaynak.get(source) || 0) + r.n);
    gruplar.set(category, g);
  }
  for (const e of ornekler) {
    const g = gruplar.get(e.category);
    if (!g || g.samples.length >= 3) continue;
    g.samples.push({
      at: dbTarihIso(e.created_at),
      severity: e.severity,
      source: kaynakEtiketi(e.source, adlar),
      detail: e.detail || ''
    });
  }

  const categories = [...gruplar.values()]
    .map(g => ({
      category: g.category,
      label: g.label,
      group: g.group,
      severity: g.severity,
      count: g.count,
      last_seen: epochIso(g._son),
      sources: [...g._kaynak.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([source, count]) => ({ source: kaynakEtiketi(source, adlar), count })),
      samples: g.samples
    }))
    .sort((a, b) => (SEVIYE_SIRASI[b.severity] || 0) - (SEVIYE_SIRASI[a.severity] || 0) || b.count - a.count);

  return {
    window: pencere,
    window_note: PENCERE_NOTU[pencere],
    collected_at: new Date().toISOString(),
    telemetry_since: baslangic,
    total: categories.reduce((a, c) => a + c.count, 0),
    critical_total: categories.filter(c => c.severity === 'critical').reduce((a, c) => a + c.count, 0),
    categories
  };
}

module.exports = {
  ESIK, PENCERELER, KAYNAK_ETIKETLERI,
  saglayiciDurumu, providerReport, providerDetail, paymentReport, errorReport
};
