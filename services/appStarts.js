'use strict';

// UYGULAMA BASLANGIC KAYDI - FAZ 1
//
// NEDEN PM2 OKUNMUYOR: `pm2 describe` bir CLI cagrisidir ve child_process
// gerektirir; guvenlik sozlesmemiz kabuk cagrisini yasakliyor. Bunun yerine
// uygulama her acilista kendi baslangicini yazar.
//
// Bu yaklasim PM2'nin sayacindan DAHA iyi bilgi verir: her kaydin zaman
// damgasi oldugu icin "son 24 saat" / "son 7 gun" pencereleri hesaplanabilir.
//
// TERMINOLOJI: bu bir BASLANGIC (start) sayacidir, RESTART sayaci degildir.
// Ilk acilis da bir kayittir; dolayisiyla
//     baslangic sayisi = restart sayisi + 1  (ayni surec omru icinde)
// Panelde "Restart" kelimesi KULLANILMAZ.

const { dbAsync } = require('../config/database');
const { uygulamaSurumu, gitSha } = require('./healthMetrics');

// Bu surecin kendi kayit kimligi; ayni surecte iki kez yazilmasin diye.
let buSurecinKaydi = null;

/**
 * Acilista tek satir yazar. Hata durumunda uygulama ACILMAYA DEVAM EDER:
 * saglik telemetrisi asla sunucuyu dusurmez.
 */
async function recordStart() {
  if (buSurecinKaydi) return buSurecinKaydi;
  try {
    const sonuc = await dbAsync.run(
      `INSERT INTO health_app_starts (node_version, app_version, git_sha, classified)
       VALUES (?, ?, ?, ?)`,
      [
        process.version,
        uygulamaSurumu(),
        // Kabuk/git komutu CALISTIRILMAZ; yalnizca ortam degiskeni okunur.
        gitSha(),
        // Deploy oldugunu kanitlayacak veri yok (git_sha genelde tanimsiz),
        // bu yuzden tahmin yurutulmez.
        'unknown'
      ]
    );
    buSurecinKaydi = sonuc?.lastID || null;
    return buSurecinKaydi;
  } catch (err) {
    console.error('Uygulama başlangıcı kaydedilemedi:', err.message);
    return null;
  }
}

/** Son 24 saat / 7 gun baslangic sayilari + gecmis liste. */
async function getSummary({ historyLimit = 20 } = {}) {
  const [gun, hafta, gecmis, ilk] = await Promise.all([
    dbAsync.get("SELECT COUNT(*) n FROM health_app_starts WHERE started_at >= datetime('now', '-1 day')"),
    dbAsync.get("SELECT COUNT(*) n FROM health_app_starts WHERE started_at >= datetime('now', '-7 days')"),
    dbAsync.all(
      `SELECT id, started_at, node_version, app_version, git_sha, classified
       FROM health_app_starts ORDER BY id DESC LIMIT ?`,
      [Math.min(Math.max(Number(historyLimit) || 20, 1), 100)]
    ),
    dbAsync.get('SELECT MIN(started_at) first_at, COUNT(*) total FROM health_app_starts')
  ]);
  return {
    starts_24h: gun?.n ?? null,
    starts_7d: hafta?.n ?? null,
    total_recorded: ilk?.total ?? null,
    tracking_since: ilk?.first_at ?? null,
    history: gecmis || []
  };
}

/** 90 gunden eski kayitlar temizlenir; tablo sinirsiz buyumesin. */
function prune() {
  return dbAsync
    .run("DELETE FROM health_app_starts WHERE started_at < datetime('now', '-90 days')")
    .catch(() => {});
}

module.exports = { recordStart, getSummary, prune };
