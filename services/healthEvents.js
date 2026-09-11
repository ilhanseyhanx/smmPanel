'use strict';

// SISTEM SAGLIGI - FAZ 2: OLAY VE METRIK KAYDI (YAZMA YOLU)
//
// ALTIN KURAL: bu modul ASLA ana akisi bozmaz. Disa acik her fonksiyon
// senkron doner, hata firlatmaz ve veritabanini beklemez (fire-and-forget).
// Siparis, odeme veya saglayici cagrisi telemetri yuzunden yavaslamaz/dusmez.
//
// NE YAZILIR:
//   health_events         -> kategorize olay (7 gun). detail merkezi redact()
//                            sonrasi en fazla 300 karakter.
//   health_metrics_hourly -> saatlik toplam (30 gun). Bellekte biriktirilir,
//                            30 sn'de bir UPSERT edilir (her cagrida yazma yok).
//
// NE YAZILMAZ: API anahtari, URL, host adi, token, cerez, e-posta, telefon,
// kart numarasi, saglayicinin HAM yanit govdesi, kullanici adi/kimligi, tutar.

const cron = require('node-cron');
const { dbAsync } = require('../config/database');

const DETAY_SINIRI = 300;
const AYNI_OLAY_ARALIGI_MS = 60 * 1000;   // ayni olay dakikada bir satir
const SAATLIK_UST_SINIR = 1200;           // taskin korumasi (kritik haric)
const KRITIK_SAATLIK_UST_SINIR = 600;
const TAMPON_UST_SINIR = 5000;
const OLAY_SAKLAMA_GUN = 7;
const METRIK_SAKLAMA_GUN = 30;

// ---------------------------------------------------------------- kategoriler
// Merkezi liste. Burada olmayan kategori KAYDEDILMEZ. Her kategori gercek bir
// kod yolundan beslenir; yorumda nereden geldigi yazar.
const KATEGORILER = Object.freeze({
  // services/smmProvider.js
  provider_timeout:      { grup: 'provider', seviye: 'warning',  etiket: 'Sağlayıcı zaman aşımı' },
  provider_5xx:          { grup: 'provider', seviye: 'warning',  etiket: 'Sağlayıcı sunucu hatası (5xx / 502)' },
  provider_network:      { grup: 'provider', seviye: 'warning',  etiket: 'Sağlayıcıya bağlanılamadı' },
  provider_balance:      { grup: 'provider', seviye: 'critical', etiket: 'Sağlayıcı bakiyesi yetersiz' },
  provider_order_error:  { grup: 'provider', seviye: 'warning',  etiket: 'Sağlayıcı sipariş hatası' },
  provider_status_error: { grup: 'provider', seviye: 'warning',  etiket: 'Sağlayıcı durum sorgusu hatası' },
  provider_error:        { grup: 'provider', seviye: 'warning',  etiket: 'Sağlayıcı diğer hata' },
  // services/telegramNotifier.js callBotApi (yalnizca altyapi kaynakli)
  telegram_timeout:      { grup: 'telegram', seviye: 'warning',  etiket: 'Telegram zaman aşımı' },
  telegram_429:          { grup: 'telegram', seviye: 'warning',  etiket: 'Telegram hız sınırı (429)' },
  telegram_5xx:          { grup: 'telegram', seviye: 'warning',  etiket: 'Telegram sunucu hatası (5xx / 502)' },
  telegram_network:      { grup: 'telegram', seviye: 'warning',  etiket: 'Telegram bağlantı hatası' },
  // routes/payments.js + server.js mutabakat zamanlayicisi
  payment_error:         { grup: 'payment',  seviye: 'warning',  etiket: 'Ödeme hatası' },
  payment_worker_error:  { grup: 'payment',  seviye: 'warning',  etiket: 'Ödeme mutabakat hatası' },
  webhook_error:         { grup: 'payment',  seviye: 'warning',  etiket: 'Webhook / callback hatası' },
  // orderWorker, marketingWorker (bakiye kontrolu, Telegram eslestirme)
  worker_error:          { grup: 'worker',   seviye: 'warning',  etiket: 'Arka plan işi hatası' },
  // services/indexNow.js — arama motoru bildirimi (Faz 3, SEO grubu)
  indexnow_error:        { grup: 'seo',      seviye: 'warning',  etiket: 'IndexNow bildirimi başarısız' },
  // Mesajinda/kodunda SQLITE_ gecen her hata (errorHandler dahil)
  sqlite_error:          { grup: 'database', seviye: 'critical', etiket: 'Veritabanı hatası' }
});

const SEVIYELER = Object.freeze(['info', 'warning', 'critical']);

// Arka plan isleri: ad -> etiket + beklenen calisma araligi (sn).
const ISCILER = Object.freeze({
  order_worker:      { etiket: 'Sipariş durum senkronu', aralik_sn: 30 },
  shopier_reconcile: { etiket: 'Shopier mutabakatı', aralik_sn: 60 },
  telegram_poller:   { etiket: 'Telegram eşleştirme', aralik_sn: 30 },
  provider_balance:  { etiket: 'Sağlayıcı bakiye kontrolü', aralik_sn: 1800 }
});

// Metrik adlari sabittir (metrik patlamasi yok). 'zaman' turunde deger epoch
// saniyesidir: n = adet, max = son gorulme anı; sum anlamsiz oldugu icin 0.
const METRIKLER = Object.freeze({
  provider_call: 'deger',   // deger = gecikme (ms)
  provider_ok:   'zaman',
  provider_fail: 'zaman',
  event:         'zaman',   // scope = kategori|seviye|kaynak
  worker_run:    'zaman',   // scope = isci adi
  worker_fail:   'zaman',
  indexnow_ok:   'zaman',   // son basarili IndexNow bildirimi (Faz 3)
  indexnow_fail: 'zaman'
});

const SAGLAYICI_ISLEMLERI = new Set(['getServices', 'addOrder', 'requestRefill', 'getOrderStatus', 'getMultiOrderStatus', 'getBalance']);
const AG_KODLARI = new Set(['ECONNRESET', 'EAI_AGAIN', 'ENOTFOUND', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE', 'ERR_SOCKET_CONNECTION_TIMEOUT']);
const BAKIYE_KALIBI = /not enough (funds|balance)|insufficient (funds|balance)|low balance|no balance|yetersiz bakiye|bakiye(niz)? yetersiz/i;

// ------------------------------------------------------------------ redact
/**
 * Merkezi maskeleme. health_events.detail'e yazilan HER metin buradan gecer.
 * Amac: anahtar, token, URL/host, e-posta, telefon, kart ve IP gibi degerlerin
 * saglik kayitlarina ve oradan panele sizmamasi.
 */
function redact(metin) {
  let s = String(metin == null ? '' : metin);
  s = s.replace(/[\u0000-\u001f\u007f]+/g, ' ');
  s = s
    .replace(/https?:\/\/[^\s"'<>]+/gi, '[url]')
    .replace(/\bbot\d{5,20}:[A-Za-z0-9_-]{20,}/g, '[token]')
    .replace(/\b\d{5,20}:[A-Za-z0-9_-]{20,250}/g, '[token]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g, '[jwt]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [gizli]')
    .replace(/\b(api[_-]?key|key|token|secret|password|passwd|pass|pat|signature|hash|authorization|cookie|session)\s*[=:]\s*[^\s&,;]+/gi, '$1=[gizli]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[e-posta]')
    // IP once: kart deseni bitisik bir IP'nin ilk oktetini yutmasin.
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, '[ip]')
    .replace(/\b(?:\d[ -]?){13,19}\b/g, '[numara]')
    // TR cep: +90 5xx..., 05xx..., 5xx... (bosluk/tire serbest)
    .replace(/(?:\+90[\s-]?|\b0|\b)5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b/g, '[telefon]')
    .replace(/\b[0-9a-f]{0,4}(?::[0-9a-f]{0,4}){2,7}\b/gi, (m) => (m.split(':').length > 3 ? '[ip]' : m))
    .replace(/\b(getaddrinfo|connect|read|write)\s+(E[A-Z_]+)\s+\S+/g, '$1 $2 [host]')
    .replace(/\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|co|tr|me|app|xyz|info|biz|pro|dev|shop|store|online|site|top|club|live|cc|us|uk|de|ru)\b/gi, '[host]')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[gizli]');
  s = s.replace(/\s+/g, ' ').trim();
  return s.length > DETAY_SINIRI ? s.slice(0, DETAY_SINIRI - 1) + '…' : s;
}

function kaynakTemizle(kaynak) {
  const s = String(kaynak || '').trim().slice(0, 40);
  return /^[a-z0-9_:.-]+$/i.test(s) ? s : 'unknown';
}

/** SQLite kaynakli hatalar hangi akista olursa olsun ayri kategoriye gider. */
function sqliteHatasiMi(err) {
  if (!err) return false;
  return /SQLITE_/.test(String(err.code || '') + ' ' + String(err.message || ''));
}

// ------------------------------------------------------------- saat kovasi
function saatKovasi(ms = Date.now()) {
  const d = new Date(ms);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

// ----------------------------------------------------------- metrik tamponu
const tampon = new Map();

/** Saatlik metrigi bellekte biriktirir. Senkron; asla firlatmaz. */
function recordMetric(metric, scope, value = 1) {
  try {
    const tur = METRIKLER[metric];
    if (!tur) return false;
    const sc = String(scope == null ? '' : scope);
    if (sc.length > 120 || !/^[a-z0-9_:|.-]*$/i.test(sc)) return false;
    const v = Number(value);
    if (!Number.isFinite(v)) return false;
    const bucket = saatKovasi();
    const anahtar = bucket + '#' + metric + '#' + sc;
    let k = tampon.get(anahtar);
    if (!k) {
      if (tampon.size >= TAMPON_UST_SINIR) return false;
      k = { bucket, metric, scope: sc, n: 0, sum: 0, min: null, max: null };
      tampon.set(anahtar, k);
    }
    k.n += 1;
    if (tur === 'deger') k.sum += v;
    k.min = k.min == null || v < k.min ? v : k.min;
    k.max = k.max == null || v > k.max ? v : k.max;
    return true;
  } catch {
    return false;
  }
}

const UPSERT_SQL = `
  INSERT INTO health_metrics_hourly (bucket, metric, scope, n, "sum", "min", "max")
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(bucket, metric, scope) DO UPDATE SET
    n = n + excluded.n,
    "sum" = "sum" + excluded."sum",
    "min" = CASE WHEN "min" IS NULL OR excluded."min" < "min" THEN excluded."min" ELSE "min" END,
    "max" = CASE WHEN "max" IS NULL OR excluded."max" > "max" THEN excluded."max" ELSE "max" END`;

let bosaltiliyor = null;

/**
 * Tamponu veritabanina yazar. Ust uste binmez (noOverlap): calisan bir
 * bosaltma varsa onun sozu dondurulur. Yazilamayan kayit kaybedilir;
 * telemetri kaybi ana akisi durdurmaktan iyidir.
 */
function flushMetrics() {
  if (bosaltiliyor) return bosaltiliyor;
  if (!tampon.size) return Promise.resolve(0);
  const kayitlar = [...tampon.values()];
  tampon.clear();
  bosaltiliyor = (async () => {
    let yazilan = 0;
    for (const k of kayitlar) {
      try {
        await dbAsync.run(UPSERT_SQL, [k.bucket, k.metric, k.scope, k.n, k.sum, k.min, k.max]);
        yazilan++;
      } catch { /* telemetri kaybi kabul */ }
    }
    return yazilan;
  })().finally(() => { bosaltiliyor = null; });
  return bosaltiliyor;
}

// --------------------------------------------------------------- olay kaydi
const sonYazim = new Map();
const saatlik = { saat: '', n: 0, kritik: 0 };
const bekleyen = new Set();

/**
 * Kategorize saglik olayi. Senkron doner, asla firlatmaz.
 * Sayac (metrik) HER olayda artar; tablo satiri ise ayni olay icin dakikada
 * bir yazilir. Boylece tasma aninda veritabani sismez ama sayim kaybolmaz,
 * farkli (yeni) bir kritik hata hicbir zaman bastirilmaz.
 * @returns {boolean} olay kabul edildiyse true
 */
function recordHealthEvent({ category, severity, source, detail } = {}) {
  try {
    const kat = KATEGORILER[category];
    if (!kat) return false;
    const sev = SEVIYELER.includes(severity) ? severity : kat.seviye;
    const src = kaynakTemizle(source);
    const temiz = redact(detail);
    const simdi = Date.now();

    recordMetric('event', `${category}|${sev}|${src}`, Math.floor(simdi / 1000));

    const anahtar = `${category}|${src}|${temiz.slice(0, 80)}`;
    const onceki = sonYazim.get(anahtar);
    if (onceki && simdi - onceki < AYNI_OLAY_ARALIGI_MS) return true;

    const saat = saatKovasi(simdi);
    if (saatlik.saat !== saat) { saatlik.saat = saat; saatlik.n = 0; saatlik.kritik = 0; }
    if (sev === 'critical') {
      if (saatlik.kritik >= KRITIK_SAATLIK_UST_SINIR) return true;
      saatlik.kritik++;
    } else {
      if (saatlik.n >= SAATLIK_UST_SINIR) return true;
      saatlik.n++;
    }

    sonYazim.set(anahtar, simdi);
    if (sonYazim.size > 5000) sonYazim.clear();

    const p = dbAsync.run(
      'INSERT INTO health_events (category, severity, source, detail) VALUES (?, ?, ?, ?)',
      [category, sev, src, temiz || null]
    ).catch(() => {}).finally(() => bekleyen.delete(p));
    bekleyen.add(p);
    return true;
  } catch {
    return false;
  }
}

/** Hata nesnesinden olay: SQLite hatasi ise kategori sqlite_error olur. */
function recordError({ category, severity, source, error, detail } = {}) {
  try {
    const sqlite = sqliteHatasiMi(error);
    const kat = sqlite ? 'sqlite_error' : category;
    const mesaj = detail || (error && (error.message || String(error))) || '';
    return recordHealthEvent({ category: kat, severity: sqlite ? 'critical' : severity, source, detail: mesaj });
  } catch {
    return false;
  }
}

// --------------------------------------------------- saglayici telemetrisi
/** Govdedeki `error` alani (yalnizca kisa metin). Ham govde ASLA dondurulmez. */
function govdeHatasi(govde) {
  if (!govde || typeof govde !== 'object' || Array.isArray(govde)) return null;
  const e = govde.error;
  if (e == null || e === '' || e === false) return null;
  return String(typeof e === 'object' ? (e.message || 'hata') : e).slice(0, 200);
}

function saglayiciHatasiniSiniflandir(islem, error, mesaj) {
  const kod = String(error?.code || '');
  const httpDurum = Number(error?.response?.status) || null;
  if (kod === 'ECONNABORTED' || kod === 'ETIMEDOUT' || /timeout/i.test(String(error?.message || ''))) return 'provider_timeout';
  if (httpDurum && httpDurum >= 500) return 'provider_5xx';
  if (AG_KODLARI.has(kod)) return 'provider_network';
  if (mesaj && BAKIYE_KALIBI.test(mesaj)) return 'provider_balance';
  if (islem === 'addOrder') return 'provider_order_error';
  if (islem === 'getOrderStatus' || islem === 'getMultiOrderStatus') return 'provider_status_error';
  return 'provider_error';
}

/**
 * Saglayici cagrisinin sonucunu kaydeder. Cagri davranisini DEGISTIRMEZ:
 * yalnizca olcer. Govde HTTP 200 olsa bile `{error: ...}` ise basarisiz sayilir
 * (SMM API'leri hatayi boyle doner); addOrder'da `order` yoksa basarisizdir.
 */
function recordProviderCall({ providerId, operation, latencyMs, error, body } = {}) {
  try {
    const id = Number(providerId);
    if (!Number.isInteger(id) || id <= 0 || !SAGLAYICI_ISLEMLERI.has(operation)) return false;
    const scope = 'p:' + id;
    const an = Math.floor(Date.now() / 1000);
    recordMetric('provider_call', scope, Math.max(0, Math.round(Number(latencyMs) || 0)));

    let neden = null;
    if (!error) {
      if (!body || typeof body !== 'object') neden = 'beklenmeyen yanıt biçimi';
      else neden = govdeHatasi(body);
      if (!neden && operation === 'addOrder' && !body.order) neden = 'sipariş numarası dönmedi';
    }
    if (!error && !neden) {
      recordMetric('provider_ok', scope, an);
      return true;
    }

    recordMetric('provider_fail', scope, an);
    const saglayiciMesaji = error
      ? (govdeHatasi(error.response?.data) || (error.response?.data?.message ? String(error.response.data.message).slice(0, 200) : null))
      : neden;
    const kategori = saglayiciHatasiniSiniflandir(operation, error, saglayiciMesaji);
    const httpDurum = Number(error?.response?.status) || null;
    const aciklama = saglayiciMesaji || String(error?.message || 'bilinmeyen hata');
    recordHealthEvent({
      category: kategori,
      source: 'provider:' + id,
      detail: operation + (httpDurum ? ' · HTTP ' + httpDurum : '') + ': ' + aciklama
    });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------- telegram telemetrisi
/**
 * Yalnizca ALTYAPI kaynakli Telegram hatalari kaydedilir (zaman asimi, ag,
 * 429, 5xx). "Kullanici botu engelledi" gibi 4xx yanitlar kullanici
 * duzeyindedir, saglik sorunu degildir; kaydedilmez.
 * Kaydedilen hataya healthRecorded isareti konur ki ust katman tekrar yazmasin.
 */
function recordTelegramFailure({ method, error, httpStatus } = {}) {
  try {
    const kod = String(error?.code || '');
    const durum = Number(httpStatus || error?.response?.status) || null;
    let kategori = null;
    if (kod === 'ECONNABORTED' || kod === 'ETIMEDOUT' || (!durum && /timeout/i.test(String(error?.message || '')))) kategori = 'telegram_timeout';
    else if (durum === 429) kategori = 'telegram_429';
    else if (durum && durum >= 500) kategori = 'telegram_5xx';
    else if (AG_KODLARI.has(kod)) kategori = 'telegram_network';
    if (!kategori) return false;
    const yontem = ['sendMessage', 'getUpdates', 'getMe'].includes(method) ? method : 'api';
    recordHealthEvent({
      category: kategori,
      source: 'telegram',
      detail: yontem + (durum ? ' · HTTP ' + durum : '') + ': ' + String(error?.message || '')
    });
    if (error && typeof error === 'object') {
      try { error.healthRecorded = true; } catch { /* dondurulmus nesne */ }
    }
    return true;
  } catch {
    return false;
  }
}

// ------------------------------------------------------ arka plan isleri
const isciDurumu = new Map();

/** Arka plan isinin her turunu isler (bellek + saatlik sayac). */
function workerBeat(ad, basarili, error) {
  try {
    if (!ISCILER[ad]) return false;
    const an = Date.now();
    const d = isciDurumu.get(ad) || { last_run_at: null, last_ok_at: null, last_error_at: null, last_error: null, consecutive_failures: 0 };
    d.last_run_at = an;
    recordMetric('worker_run', ad, Math.floor(an / 1000));
    if (basarili) {
      d.last_ok_at = an;
      d.consecutive_failures = 0;
    } else {
      d.last_error_at = an;
      d.last_error = redact(error?.message || error || 'hata');
      d.consecutive_failures += 1;
      recordMetric('worker_fail', ad, Math.floor(an / 1000));
    }
    isciDurumu.set(ad, d);
    return true;
  } catch {
    return false;
  }
}

function workerSnapshot() {
  const cikti = {};
  for (const ad of Object.keys(ISCILER)) {
    const d = isciDurumu.get(ad);
    cikti[ad] = d ? { ...d } : null;
  }
  return cikti;
}

// ------------------------------------------------------------------ bakim
/** 7 gunden eski olaylar, 30 gunden eski metrikler silinir. */
async function prune() {
  let olay = 0, metrik = 0;
  try {
    olay = (await dbAsync.run(`DELETE FROM health_events WHERE created_at < datetime('now', '-${OLAY_SAKLAMA_GUN} days')`)).changes || 0;
  } catch { /* sonraki turda denenir */ }
  try {
    metrik = (await dbAsync.run('DELETE FROM health_metrics_hourly WHERE bucket < ?', [saatKovasi(Date.now() - METRIK_SAKLAMA_GUN * 86400 * 1000)])).changes || 0;
  } catch { /* sonraki turda denenir */ }
  return { olay, metrik };
}

/** Testler ve okuma ucu icin: bekleyen olay yazimlari + metrik tamponu. */
async function drain() {
  await Promise.all([...bekleyen]);
  await flushMetrics();
}

let baslatildi = false;

/** server.js dinlemeye basladiktan sonra bir kez cagrilir. */
function startHealthTelemetry() {
  if (baslatildi) return;
  baslatildi = true;
  const t = setInterval(() => { flushMetrics().catch(() => {}); }, 30 * 1000);
  t.unref?.();
  // Mevcut worker altyapisi: node-cron + noOverlap. Gunde bir temizlik.
  cron.schedule('23 3 * * *', () => prune(), { noOverlap: true });
  setTimeout(() => prune().catch(() => {}), 2 * 60 * 1000).unref?.();
}

/** Yalnizca testler icin: bellek durumunu sifirlar. */
function _reset() {
  tampon.clear();
  sonYazim.clear();
  isciDurumu.clear();
  saatlik.saat = ''; saatlik.n = 0; saatlik.kritik = 0;
}

module.exports = {
  KATEGORILER, SEVIYELER, ISCILER, METRIKLER, DETAY_SINIRI,
  redact, saatKovasi, sqliteHatasiMi,
  recordHealthEvent, recordError, recordMetric, recordProviderCall, recordTelegramFailure,
  workerBeat, workerSnapshot, flushMetrics, prune, drain, startHealthTelemetry, _reset
};
