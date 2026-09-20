'use strict';

// Tekil ziyaretci sayimi.
//
// Gizlilik: ham IP adresi HICBIR ZAMAN saklanmaz. IP + tarayici imzasi, sunucu
// gizli anahtariyla birlikte tek yonlu hash'lenir; veritabaninda yalnizca bu
// hash durur. Hash'ten IP'ye geri donulemez.
//
// Ayni ziyaretci ayni gun icinde tek satir olusturur (UNIQUE kisiti). Hash'e
// tarih KATILMAZ; boylece ayni kisi farkli gunlerde ayni hash'i alir ve
// haftalik/aylik "tekil ziyaretci" sayimi dogru olur.

const crypto = require('crypto');
const { dbAsync } = require('../config/database');

// Arama motoru botlari ve izleme araclari gercek ziyaretci degildir.
const BOT_PATTERN = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegrambot|preview|monitor|uptime|pingdom|curl|wget|python-requests|axios|headless|lighthouse|gtmetrix|semrush|ahrefs|mj12|dotbot|petalbot/i;

function isBot(userAgent) {
  return !userAgent || BOT_PATTERN.test(userAgent);
}

// Proxy/Cloudflare arkasinda gercek istemci IP'si baslikta gelir.
function clientIp(req) {
  const cf = req.headers['cf-connecting-ip'];
  if (cf) return String(cf).trim();
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || '';
}

function visitorHash(req) {
  const secret = process.env.JWT_SECRET || 'visitor-salt';
  const ua = String(req.headers['user-agent'] || '');
  const lang = String(req.headers['accept-language'] || '');
  return crypto.createHash('sha256')
    .update(`${clientIp(req)}|${ua}|${lang}|${secret}`)
    .digest('hex')
    .slice(0, 32);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// TRAFIK KAYNAGI
// Ziyaretcinin siteye nereden geldigi. Tam adres DEGIL, yalnizca alan adi
// saklanir; arama sorgusu ve izleme parametreleri kaydedilmez.
// ---------------------------------------------------------------------------

const ARAMA = /^(www\.)?(google|bing|yandex|duckduckgo|yahoo|ecosia|search\.brave|baidu|startpage)\./i;
const SOSYAL = /^(www\.|m\.|l\.)?(t\.me|telegram|instagram|facebook|fb\.|twitter|x\.com|tiktok|youtube|youtu\.be|linkedin|pinterest|reddit|whatsapp|wa\.me|discord|twitch|threads)\./i;
// t.me ve x.com gibi nokta iceren tam adlar yukaridaki kalipla eslesmez; ayrica bakilir.
const SOSYAL_TAM = new Set(['t.me', 'x.com', 'fb.com', 'wa.me', 'youtu.be', 'lnkd.in']);

/**
 * Referans basligini kanal tipine ve alan adina cevirir.
 * @returns {{host: string|null, type: 'arama'|'sosyal'|'yonlendiren'|'dogrudan'}}
 */
function parseReferrer(req) {
  const ham = String(req.headers.referer || req.headers.referrer || '').trim();
  if (!ham) return { host: null, type: 'dogrudan' };

  let host;
  try {
    host = new URL(ham).hostname.toLowerCase();
  } catch {
    return { host: null, type: 'dogrudan' };
  }
  if (!host) return { host: null, type: 'dogrudan' };

  // Kendi sitemizden gelen gecisler kaynak sayilmaz (ic gezinme).
  const kendi = (() => {
    try { return new URL(process.env.PUBLIC_BASE_URL || 'https://localhost').hostname.toLowerCase(); }
    catch { return ''; }
  })();
  if (kendi && (host === kendi || host === `www.${kendi}` || `www.${host}` === kendi)) {
    return { host: null, type: 'dogrudan' };
  }

  if (ARAMA.test(host)) return { host, type: 'arama' };
  if (SOSYAL.test(host) || SOSYAL_TAM.has(host)) return { host, type: 'sosyal' };
  return { host, type: 'yonlendiren' };
}

/** Ziyaretcinin girdigi ilk sayfa (sorgu dizesi atilir, uzunluk sinirlanir). */
function landingPath(req) {
  const yol = String(req.originalUrl || req.url || '/').split('?')[0];
  return yol.slice(0, 120) || '/';
}

/**
 * Ziyareti kaydeder. Sayfa yanitini asla geciktirmez ve hicbir hata
 * disari sizmaz; istatistik ugruna site yavaslamamali/kirilmamali.
 */
async function recordVisit(req) {
  try {
    const ua = req.headers['user-agent'];
    if (isBot(ua)) return false;
    const { host, type } = parseReferrer(req);
    // UNIQUE(visitor_hash, visit_date) sayesinde gunun ILK istegi yazilir;
    // kaynak bilgisi de o ilk temasa aittir (dogru olan budur — sonraki ic
    // gezinmeler kaynagi "dogrudan"a cevirmemeli).
    await dbAsync.run(
      'INSERT OR IGNORE INTO site_visits (visitor_hash, visit_date, referrer_host, source_type, landing_path) VALUES (?, ?, ?, ?, ?)',
      [visitorHash(req), today(), host, type, landingPath(req)]
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Gunluk / haftalik / aylik TEKIL ziyaretci sayilari.
 * Haftalik ve aylik degerler, ayni kisiyi bir kez sayar.
 */
async function getVisitorStats() {
  const [gunluk, haftalik, aylik, toplam, seri] = await Promise.all([
    dbAsync.get("SELECT COUNT(DISTINCT visitor_hash) AS n FROM site_visits WHERE visit_date = date('now')"),
    dbAsync.get("SELECT COUNT(DISTINCT visitor_hash) AS n FROM site_visits WHERE visit_date >= date('now', '-6 days')"),
    dbAsync.get("SELECT COUNT(DISTINCT visitor_hash) AS n FROM site_visits WHERE visit_date >= date('now', '-29 days')"),
    dbAsync.get('SELECT COUNT(DISTINCT visitor_hash) AS n FROM site_visits'),
    dbAsync.all(`SELECT visit_date AS day, COUNT(DISTINCT visitor_hash) AS n
                 FROM site_visits WHERE visit_date >= date('now', '-29 days')
                 GROUP BY visit_date ORDER BY visit_date`)
  ]);

  // Ziyaretci olmayan gunler grafikte bosluk birakmasin diye 0 ile doldurulur.
  const byDay = new Map(seri.map(row => [row.day, row.n]));
  const daily = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    daily.push({ day: d, visitors: byDay.get(d) || 0 });
  }

  return {
    daily: gunluk?.n || 0,
    weekly: haftalik?.n || 0,
    monthly: aylik?.n || 0,
    total: toplam?.n || 0,
    series: daily
  };
}

/**
 * Trafik kaynagi dagilimi: hangi kanaldan kac TEKIL ziyaretci geldi,
 * hangi alan adlari getirdi ve ziyaretciler hangi sayfaya dustu.
 * @param {number} gun Kac gunluk pencere (varsayilan 30)
 */
async function getTrafficSources(gun = 30) {
  const pencere = `-${Math.max(1, Math.min(365, Number(gun) || 30)) - 1} days`;

  const [kanallar, alanAdlari, girisSayfalari, gunluk, kapsam] = await Promise.all([
    dbAsync.all(`SELECT COALESCE(source_type, 'bilinmiyor') AS type, COUNT(DISTINCT visitor_hash) AS visitors
      FROM site_visits WHERE visit_date >= date('now', ?) GROUP BY type ORDER BY visitors DESC`, [pencere]),

    dbAsync.all(`SELECT referrer_host AS host, COALESCE(source_type,'bilinmiyor') AS type,
        COUNT(DISTINCT visitor_hash) AS visitors
      FROM site_visits
      WHERE visit_date >= date('now', ?) AND referrer_host IS NOT NULL AND referrer_host != ''
      GROUP BY referrer_host ORDER BY visitors DESC LIMIT 25`, [pencere]),

    dbAsync.all(`SELECT COALESCE(NULLIF(landing_path,''), '/') AS path, COUNT(DISTINCT visitor_hash) AS visitors
      FROM site_visits WHERE visit_date >= date('now', ?) AND landing_path IS NOT NULL
      GROUP BY path ORDER BY visitors DESC LIMIT 25`, [pencere]),

    dbAsync.all(`SELECT visit_date AS day, COALESCE(source_type,'bilinmiyor') AS type,
        COUNT(DISTINCT visitor_hash) AS visitors
      FROM site_visits WHERE visit_date >= date('now', ?) GROUP BY day, type ORDER BY day`, [pencere]),

    // Kolonlar 20 Eyl 2026'da eklendi; oncesindeki ziyaretlerde kaynak yok.
    // Panelde "veri su tarihten beri toplaniyor" diyebilmek icin gerekir.
    dbAsync.get(`SELECT MIN(visit_date) AS ilk_kayitli,
        SUM(CASE WHEN source_type IS NULL THEN 1 ELSE 0 END) AS kaynaksiz,
        COUNT(*) AS toplam
      FROM site_visits WHERE visit_date >= date('now', ?)`, [pencere])
  ]);

  // Gunluk seriyi kanal bazli tabloya cevir (grafik icin).
  const gunSet = new Map();
  for (const satir of gunluk) {
    if (!gunSet.has(satir.day)) gunSet.set(satir.day, { day: satir.day, arama: 0, sosyal: 0, yonlendiren: 0, dogrudan: 0, bilinmiyor: 0 });
    const kayit = gunSet.get(satir.day);
    if (kayit[satir.type] !== undefined) kayit[satir.type] = satir.visitors;
  }

  const toplamZiyaretci = kanallar.reduce((a, k) => a + k.visitors, 0);
  return {
    window_days: Number(gun) || 30,
    total_visitors: toplamZiyaretci,
    channels: kanallar.map(k => ({
      ...k,
      share: toplamZiyaretci ? Math.round(k.visitors / toplamZiyaretci * 100) : 0
    })),
    domains: alanAdlari,
    landing_pages: girisSayfalari,
    series: [...gunSet.values()].sort((a, b) => a.day.localeCompare(b.day)),
    coverage: {
      first_date: kapsam?.ilk_kayitli || null,
      without_source: kapsam?.kaynaksiz || 0,
      total_rows: kapsam?.toplam || 0
    }
  };
}

module.exports = { recordVisit, getVisitorStats, getTrafficSources, parseReferrer, isBot, visitorHash };
