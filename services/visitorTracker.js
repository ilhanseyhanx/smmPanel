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

/**
 * Ziyareti kaydeder. Sayfa yanitini asla geciktirmez ve hicbir hata
 * disari sizmaz; istatistik ugruna site yavaslamamali/kirilmamali.
 */
async function recordVisit(req) {
  try {
    const ua = req.headers['user-agent'];
    if (isBot(ua)) return false;
    await dbAsync.run(
      'INSERT OR IGNORE INTO site_visits (visitor_hash, visit_date) VALUES (?, ?)',
      [visitorHash(req), today()]
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

module.exports = { recordVisit, getVisitorStats, isBot, visitorHash };
