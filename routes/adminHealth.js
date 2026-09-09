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

module.exports = router;
