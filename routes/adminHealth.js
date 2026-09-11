'use strict';

// SISTEM SAGLIGI UCLARI - FAZ 1 (SALT OKUNUR)
//
// GUVENLIK:
//   - Router server.js'te authenticateToken + requireAdmin ile mount edilir;
//     oturumsuz istek 401, yonetici olmayan 403 alir.
//   - Mevcut apiLimiter (/api icin 180 istek/dk) bu uclara da uygulanir.
//   - Yalnizca GET vardir: yazma, komut calistirma, dosya yolu kabul etme YOK.
//   - Istemciden hicbir parametre dosya yoluna donusmez; okunan yollar
//     services/healthMetrics.js icinde sabittir.
//   - Yanitta sir bulunmaz: api_key, token, cerez, sifre ozeti, kullanici
//     kisisel verisi hicbir alanda gecmez (test/health-phase1.test.js dogrular).

const express = require('express');
const router = express.Router();
const { dbAsync } = require('../config/database');
const healthMetrics = require('../services/healthMetrics');
const healthScore = require('../services/healthScore');
const appStarts = require('../services/appStarts');

/** Anlik goruntu + puan; ikisi de onbellekten gelir (agir is yok). */
async function durumTopla() {
  const snapshot = await healthMetrics.anlikGoruntu(dbAsync);
  let starts24h = null;
  let ozet = null;
  try {
    ozet = await appStarts.getSummary({ historyLimit: 20 });
    starts24h = ozet.starts_24h;
  } catch { /* baslangic tablosu okunamazsa puan 'unknown' ile devam eder */ }
  return { snapshot, ozet, score: healthScore.systemHealth(snapshot, starts24h) };
}

// GENEL BAKIS: skor + kartlar + sistem anlik goruntusu.
// Tek istek; sekmeye girmeden ek cagri yapilmaz.
router.get('/overview', async (req, res) => {
  try {
    const { snapshot, score } = await durumTopla();
    res.json({
      system_health: {
        score: score.score,
        status: score.status,
        critical_count: score.critical_count,
        warning_count: score.warning_count,
        healthy_count: score.healthy_count,
        unknown_count: score.unknown_count,
        // Ilk ekranda yalnizca sorunlu bilesenler listelenir.
        issues: score.components
          .filter(c => c.status === 'critical' || c.status === 'warning')
          .map(c => ({ key: c.key, label: c.label, status: c.status, value: c.value, note: c.note }))
      },
      collected_at: snapshot.collected_at,
      cached: snapshot.cached,
      server: snapshot.server,
      application: snapshot.application,
      disk: snapshot.disk,
      database: snapshot.database,
      backup: snapshot.backup
    });
  } catch (err) {
    res.status(500).json({ error: 'Sistem sağlığı bilgisi alınamadı.' });
  }
});

// UYGULAMA: surec detaylari + baslangic gecmisi.
// "Restart" degil "baslangic" semantigi kullanilir (ilk acilis dahildir).
router.get('/application', async (req, res) => {
  try {
    const snapshot = await healthMetrics.anlikGoruntu(dbAsync);
    let ozet = { starts_24h: null, starts_7d: null, total_recorded: null, tracking_since: null, history: [] };
    try { ozet = await appStarts.getSummary({ historyLimit: 20 }); } catch { /* tablo yoksa bos doner */ }
    res.json({
      collected_at: snapshot.collected_at,
      process: snapshot.application,
      starts: {
        last_24h: ozet.starts_24h,
        last_7d: ozet.starts_7d,
        total_recorded: ozet.total_recorded,
        tracking_since: ozet.tracking_since,
        // UI bu notu kullanicinin gorebilecegi sekilde gosterir.
        semantics: 'Bu sayaç uygulama BAŞLANGIÇLARINI sayar; ilk açılış da dahildir. Yeniden başlatma sayısı bundan bir eksiktir.'
      },
      history: ozet.history
    });
  } catch (err) {
    res.status(500).json({ error: 'Uygulama bilgisi alınamadı.' });
  }
});

// SKOR ACIKLAMASI: her bilesenin agirligi, mevcut degeri, durumu ve
// kaybettirdigi puan. Admin "Nasil hesaplaniyor?" baglantisiyla acar.
router.get('/score-explain', async (req, res) => {
  try {
    const { score } = await durumTopla();
    res.json({
      score: score.score,
      status: score.status,
      components: score.components,
      formula: score.formula,
      scores_note: 'Bu puan yalnızca SYSTEM HEALTH’tir. SEO sağlığı ayrı bir puan olarak ileride eklenecek ve bu puana karıştırılmayacaktır.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Puan açıklaması alınamadı.' });
  }
});

// ------------------------------------------------------------------ FAZ 2
// Servisler / Odemeler / Hatalar. Yalnizca GET; hepsi SQLite'tan okur,
// saglayiciya veya odeme sistemine istek ATMAZ (bkz. services/healthReports.js).
// Istemciden gelen tek girdiler: pencere (beyaz liste) ve saglayici id (tamsayi).
const healthReports = require('../services/healthReports');

router.get('/providers', async (req, res) => {
  try {
    res.json(await healthReports.providerReport());
  } catch (err) {
    res.status(500).json({ error: 'Sağlayıcı sağlığı alınamadı.' });
  }
});

router.get('/provider/:id', async (req, res) => {
  const ham = String(req.params.id || '');
  const id = Number.parseInt(ham, 10);
  if (!/^\d{1,9}$/.test(ham) || !Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Geçersiz sağlayıcı kimliği.' });
  }
  try {
    const detay = await healthReports.providerDetail(id);
    if (!detay) return res.status(404).json({ error: 'Sağlayıcı bulunamadı.' });
    res.json(detay);
  } catch (err) {
    res.status(500).json({ error: 'Sağlayıcı ayrıntısı alınamadı.' });
  }
});

router.get('/payments', async (req, res) => {
  try {
    res.json(await healthReports.paymentReport());
  } catch (err) {
    res.status(500).json({ error: 'Ödeme sağlığı alınamadı.' });
  }
});

// ------------------------------------------------------------------ FAZ 3
// SEO & Crawler: bot ziyaretleri, sitemap tutarliligi, IndexNow takibi.
// Yalnizca SQLite + SABIT yoldaki public/sitemap.xml okunur; dis istek YOK.
const fs = require('fs');
const path = require('path');
const crawlerTracker = require('../services/crawlerTracker');

// Statik sitemap fosili icin SABIT yol (istemciden yol alinmaz).
const STATIK_SITEMAP = path.join(__dirname, '..', 'public', 'sitemap.xml');
// Dinamik sitemap'in sabit cekirdegi (server.js /sitemap.xml ile ayni liste):
// /, /services, /blog, /about, /smm-panel-api, /terms, /privacy, /refund
const SITEMAP_CEKIRDEK = 8;

router.get('/seo', async (req, res) => {
  const pencere = String(req.query.window || '24h');
  const SAAT = { '24h': 24, '7d': 168 };
  if (!Object.prototype.hasOwnProperty.call(SAAT, pencere)) {
    return res.status(400).json({ error: 'Geçersiz pencere. 24h veya 7d kullanın.' });
  }
  try {
    const crawler = await crawlerTracker.report(SAAT[pencere]);

    // Sitemap tutarliligi: beklenen adres sayisi veritabanindan hesaplanir
    // (dinamik rotayla ayni kaynaklar); sayfa gezilmez, dis istek atilmaz.
    const blogSayisi = (await dbAsync.get("SELECT COUNT(*) n FROM blog_posts WHERE status = 'published'"))?.n || 0;
    const satisSayisi = (await dbAsync.get("SELECT COUNT(*) n FROM landing_pages WHERE status = 'published'"))?.n || 0;
    const beklenen = SITEMAP_CEKIRDEK + blogSayisi + satisSayisi + (satisSayisi ? 1 : 0); // +1: /hizmet-sayfalari vitrini

    // Statik fosil dosya: dinamik rota varken zararsizdir ama hosting
    // degisirse dinamigin onune gecebilir. Panel bu riski surekli gosterir.
    let statik = { exists: false, url_count: null };
    try {
      const icerik = fs.readFileSync(STATIK_SITEMAP, 'utf8');
      statik = { exists: true, url_count: (icerik.match(/<loc>/g) || []).length };
    } catch { /* dosya yoksa risk de yok */ }

    // IndexNow: saatlik metriklerden son basari/basarisizlik ve 7 gunluk sayim.
    const sinir7g = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const inOk = await dbAsync.get("SELECT SUM(n) n, MAX(\"max\") son FROM health_metrics_hourly WHERE metric = 'indexnow_ok' AND bucket >= ?", [sinir7g]);
    const inFail = await dbAsync.get("SELECT SUM(n) n, MAX(\"max\") son FROM health_metrics_hourly WHERE metric = 'indexnow_fail' AND bucket >= ?", [sinir7g]);
    const inOlaylar = await dbAsync.all("SELECT severity, source, detail, created_at FROM health_events WHERE category = 'indexnow_error' ORDER BY id DESC LIMIT 5");

    res.json({
      window: pencere,
      crawler,
      sitemap: {
        expected_urls: beklenen,
        breakdown: { core: SITEMAP_CEKIRDEK, blog_published: blogSayisi, landing_published: satisSayisi, hub: satisSayisi ? 1 : 0 },
        static_file: {
          ...statik,
          // Dinamik rota Express'te statik servisten ONCE tanimli oldugu ve
          // Nginx her istegi proxy'ledigi surece fosil dosya sunulmaz.
          risk: statik.exists && statik.url_count !== null && statik.url_count < beklenen
            ? 'public/sitemap.xml BAYAT (' + statik.url_count + ' adres, beklenen ' + beklenen + '). Hosting mimarisi değişirse bu dosya dinamik sitemap\'in önüne geçebilir; silinmesi önerilir.'
            : null
        },
        note: 'Beklenen sayı veritabanından hesaplanır; canlı /sitemap.xml çıktısıyla birebir aynı kaynaklardan gelir.'
      },
      indexnow: {
        ok_7d: inOk?.n || 0,
        fail_7d: inFail?.n || 0,
        last_ok_epoch: inOk?.son || null,
        last_fail_epoch: inFail?.son || null,
        recent_errors: inOlaylar
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'SEO & Crawler raporu alınamadı.' });
  }
});

router.get('/errors', async (req, res) => {
  const pencere = String(req.query.window || '24h');
  if (!Object.prototype.hasOwnProperty.call(healthReports.PENCERELER, pencere)) {
    return res.status(400).json({ error: 'Geçersiz pencere. 1h, 24h veya 7d kullanın.' });
  }
  try {
    res.json(await healthReports.errorReport(pencere));
  } catch (err) {
    res.status(500).json({ error: 'Hata özeti alınamadı.' });
  }
});

module.exports = router;
