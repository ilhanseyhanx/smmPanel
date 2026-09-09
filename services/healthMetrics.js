'use strict';

// SISTEM SAGLIGI - FAZ 1: olcum toplama (SALT OKUNUR)
//
// GUVENLIK SOZLESMESI (bozulmamali):
//   - child_process / exec / spawn KULLANILMAZ. Butun veriler Node'un kendi
//     API'lerinden (os, process, fs) gelir. Kod tabaninda kabuk cagrisi yok
//     ve test/health-phase1.test.js bunu her calismada dogrular.
//   - Okunan dosya yollari SABIT sabitlerdir. Istemciden yol alinmaz;
//     kullanici girdisi hicbir sekilde yol uretmez.
//   - Donen nesnede sir/kimlik bilgisi bulunmaz (api_key, token, cerez...).
//     Yalnizca sayisal olcumler ve dosya metadatasi dondurulur.
//
// PERFORMANS SOZLESMESI:
//   - Admin paneli acildiginda agir is YAPILMAZ: log taranmaz, sitemap
//     gezilmez, dis istek atilmaz, integrity_check calistirilmaz.
//   - Anlik goruntu 45 saniye onbelleklenir; art arda acilislar tek olcum
//     maliyetiyle karsilanir.

const os = require('os');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const PROJE_KOKU = path.join(__dirname, '..');

// Yedeklerin aranacagi SABIT dizinler. Bu liste kod icinde tanimlidir;
// istemciden gelen hicbir deger buraya giremez.
//   /root/yedekler        -> gunluk cron yedegi (yedekle-smmjet.sh)
//   /var/backups/smmjet   -> elle/deploy oncesi alinan yedekler
const YEDEK_DIZINLERI = ['/root/yedekler', '/var/backups/smmjet'];
// Yalnizca veritabani yedegi sayilan uzantilar (tar.gz kaynak yedegi degil).
const YEDEK_DESENI = /\.sqlite(\.gz)?$/i;

const ONBELLEK_MS = 45_000;
let onbellek = { at: 0, veri: null };

// --- CPU olcumu ------------------------------------------------------------
// os.cpus() kumulatif sureleri verir; kullanim orani ancak IKI ornek
// arasindaki farktan cikar. Onceki ornek modul seviyesinde tutulur, boylece
// istek sirasinda beklemeye (blocking sleep) gerek kalmaz.
function cpuOrnegi() {
  const cpus = os.cpus() || [];
  let bosta = 0, toplam = 0;
  for (const c of cpus) {
    for (const tur of Object.keys(c.times)) toplam += c.times[tur];
    bosta += c.times.idle;
  }
  return { bosta, toplam, at: Date.now() };
}

let oncekiCpu = cpuOrnegi();
let oncekiSurecCpu = process.cpuUsage();
let oncekiSurecAn = Date.now();

function cpuKullanimYuzdesi() {
  const simdi = cpuOrnegi();
  const dToplam = simdi.toplam - oncekiCpu.toplam;
  const dBosta = simdi.bosta - oncekiCpu.bosta;
  oncekiCpu = simdi;
  // Ilk cagri veya sayac sarmasi: guvenilir deger yok.
  if (dToplam <= 0) return null;
  const oran = (1 - dBosta / dToplam) * 100;
  return Math.min(100, Math.max(0, Number(oran.toFixed(1))));
}

function surecCpuYuzdesi() {
  const simdi = process.cpuUsage();
  const an = Date.now();
  const gecenMs = an - oncekiSurecAn;
  const kullanilanMs = ((simdi.user - oncekiSurecCpu.user) + (simdi.system - oncekiSurecCpu.system)) / 1000;
  oncekiSurecCpu = simdi;
  oncekiSurecAn = an;
  if (gecenMs <= 0) return null;
  const cekirdek = (os.cpus() || []).length || 1;
  const oran = (kullanilanMs / gecenMs) * 100 / cekirdek;
  return Math.min(100, Math.max(0, Number(oran.toFixed(1))));
}

// --- Disk ------------------------------------------------------------------
// fs.statfs Node 18.15+ ile geldi; kabuk (df) cagirmaya gerek yok.
// Desteklenmeyen ortamda (bazi Windows kurulumlari) null doner ve panel
// "olculemedi" gosterir; hata firlatmaz.
async function diskBilgisi() {
  try {
    const s = await fsp.statfs('/');
    const blok = Number(s.bsize) || 0;
    const toplam = blok * Number(s.blocks);
    // bavail: ayricaliksiz kullanicinin gercekten kullanabilecegi alan.
    const bos = blok * Number(s.bavail);
    const kullanilan = toplam - blok * Number(s.bfree);
    if (!(toplam > 0)) return null;
    return {
      total_bytes: toplam,
      used_bytes: kullanilan,
      free_bytes: bos,
      used_percent: Number(((kullanilan / toplam) * 100).toFixed(1))
    };
  } catch {
    return null;
  }
}

// --- Veritabani ------------------------------------------------------------
function dbYolu() {
  return process.env.DATABASE_PATH
    ? path.resolve(process.env.DATABASE_PATH)
    : path.join(PROJE_KOKU, 'database.sqlite');
}

async function dosyaBoyutu(yol) {
  try { return (await fsp.stat(yol)).size; } catch { return null; }
}

/**
 * Veritabani saglik ozeti. PAHALI DEGIL: integrity_check burada
 * CALISTIRILMAZ (Faz 3'e ait, onbellekli calisacak). Yalnizca dosya
 * metadatasi + tek satirlik ucuz sorgular.
 */
async function veritabaniBilgisi(dbAsync) {
  const ana = dbYolu();
  const [boyut, wal, shm] = await Promise.all([
    dosyaBoyutu(ana), dosyaBoyutu(ana + '-wal'), dosyaBoyutu(ana + '-shm')
  ]);

  let erisilebilir = false;
  let journalMode = null;
  try {
    // "Okunabiliyor mu" testi: en ucuz sorgu.
    await dbAsync.get('SELECT 1 AS ok');
    erisilebilir = true;
    const jm = await dbAsync.get('PRAGMA journal_mode');
    journalMode = jm ? (jm.journal_mode || null) : null;
  } catch {
    erisilebilir = false;
  }

  return {
    accessible: erisilebilir,
    journal_mode: journalMode,
    size_bytes: boyut,
    wal_bytes: wal,
    shm_bytes: shm
  };
}

// --- Yedekler --------------------------------------------------------------
/**
 * En son veritabani yedeginin METADATASI. Dosya ACILMAZ, icerigi okunmaz;
 * yalnizca readdir + stat yapilir. Panele dosya adi/yolu gonderilmez.
 */
async function sonYedek() {
  let enYeni = null;
  for (const dizin of YEDEK_DIZINLERI) {
    let girdiler;
    try { girdiler = await fsp.readdir(dizin, { withFileTypes: true }); } catch { continue; }
    for (const g of girdiler) {
      if (!g.isFile() || !YEDEK_DESENI.test(g.name)) continue;
      try {
        const s = await fsp.stat(path.join(dizin, g.name));
        if (!enYeni || s.mtimeMs > enYeni.mtimeMs) {
          enYeni = { mtimeMs: s.mtimeMs, size: s.size };
        }
      } catch { /* okunamayan dosya atlanir */ }
    }
  }
  if (!enYeni) return { found: false, at: null, size_bytes: null, age_hours: null };
  return {
    found: true,
    at: new Date(enYeni.mtimeMs).toISOString(),
    size_bytes: enYeni.size,
    age_hours: Number(((Date.now() - enYeni.mtimeMs) / 3_600_000).toFixed(1))
  };
}

// --- Uygulama surumu -------------------------------------------------------
let paketSurumu = null;
function uygulamaSurumu() {
  if (paketSurumu !== null) return paketSurumu;
  try { paketSurumu = require(path.join(PROJE_KOKU, 'package.json')).version || null; }
  catch { paketSurumu = null; }
  return paketSurumu;
}

/**
 * Git commit kimligi YALNIZCA ortam degiskeninden okunur.
 * Kabuk/git komutu CALISTIRILMAZ. Tanimli degilse null doner.
 */
function gitSha() {
  const ham = process.env.GIT_SHA || process.env.SOURCE_COMMIT || process.env.COMMIT_SHA || '';
  const temiz = String(ham).trim();
  return /^[0-9a-f]{7,40}$/i.test(temiz) ? temiz.slice(0, 40) : null;
}

// --- Anlik goruntu ---------------------------------------------------------
async function anlikGoruntu(dbAsync, { taze = false } = {}) {
  if (!taze && onbellek.veri && Date.now() - onbellek.at < ONBELLEK_MS) {
    return { ...onbellek.veri, cached: true };
  }

  const bellek = process.memoryUsage();
  const toplamRam = os.totalmem();
  const bosRam = os.freemem();
  const [disk, veritabani, yedek] = await Promise.all([
    diskBilgisi(), veritabaniBilgisi(dbAsync), sonYedek()
  ]);

  const veri = {
    collected_at: new Date().toISOString(),
    server: {
      uptime_sec: Math.round(os.uptime()),
      cpu_count: (os.cpus() || []).length,
      cpu_percent: cpuKullanimYuzdesi(),
      load_avg: os.loadavg().map(n => Number(n.toFixed(2))),
      mem_total_bytes: toplamRam,
      mem_free_bytes: bosRam,
      mem_used_bytes: toplamRam - bosRam,
      mem_used_percent: toplamRam ? Number((((toplamRam - bosRam) / toplamRam) * 100).toFixed(1)) : null,
      platform: process.platform
    },
    application: {
      online: true, // istek islendigine gore surec ayakta (bkz. sinirlamalar)
      pid: process.pid,
      node_version: process.version,
      app_version: uygulamaSurumu(),
      git_sha: gitSha(),
      uptime_sec: Math.round(process.uptime()),
      started_at: new Date(Date.now() - process.uptime() * 1000).toISOString(),
      cpu_percent: surecCpuYuzdesi(),
      rss_bytes: bellek.rss,
      heap_total_bytes: bellek.heapTotal,
      heap_used_bytes: bellek.heapUsed
    },
    disk,
    database: veritabani,
    backup: yedek
  };

  onbellek = { at: Date.now(), veri };
  return { ...veri, cached: false };
}

module.exports = {
  anlikGoruntu,
  uygulamaSurumu,
  gitSha,
  YEDEK_DIZINLERI,
  ONBELLEK_MS
};
