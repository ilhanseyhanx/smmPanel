'use strict';

// SISTEM SAGLIGI - FAZ 3: CRAWLER (BOT) IZLEME
//
// visitorTracker botlari "gercek ziyaretci degil" diye ELER; bu modul ise tam
// o elenen trafigi kaydeder. Googlebot'un hangi sayfa gruplarini ne siklikta
// gezdigi, indekslenmenin en dogrudan sinyalidir.
//
// ALTIN KURALLAR (healthEvents ile ayni sozlesme):
//   - Disa acik record() senkron doner, hata firlatmaz, ana akisi beklemez.
//   - IP ve ham User-Agent SAKLANMAZ. Yalnizca bot adi (beyaz listeden),
//     sayfa grubu, HTTP durumu ve saatlik kova yazilir.
//   - path sutunu YALNIZCA 404'lerde dolar (kirik baglanti tespiti icin),
//     karakter beyaz listesinden gecirilir ve 80 karakterle sinirlanir.
//   - Taskin korumasi: saatte en fazla SAATLIK_SATIR_SINIRI farkli satir;
//     olasi bot firtinasi veya zararli tarama tabloyu sisiremez.
//   - 30 gunden eski kayitlar her gece silinir.

const cron = require('node-cron');
const { dbAsync } = require('../config/database');

const SAKLAMA_GUN = 30;
const SAATLIK_SATIR_SINIRI = 400;   // farkli (bot, grup, durum, path) satiri/saat
const YOL_SINIRI = 80;

// Bilinen botlar: UA deseninden ada. Sira onemli (once ozel olanlar).
// Buradan cikan ad panelde oldugu gibi gorunur; ham UA asla saklanmaz.
const BOTLAR = [
  ['googlebot', /googlebot/i],
  ['google-diger', /google(other|-inspectiontool|-extended|-site-verification)|apis-google|mediapartners/i],
  ['bingbot', /bingbot|bingpreview/i],
  ['yandexbot', /yandex/i],
  ['duckduckbot', /duckduckbot/i],
  ['applebot', /applebot/i],
  ['baiduspider', /baiduspider/i],
  ['gptbot', /gptbot|oai-searchbot|chatgpt-user/i],
  ['claudebot', /claudebot|anthropic/i],
  ['perplexitybot', /perplexity/i],
  ['bytespider', /bytespider/i],
  ['ccbot', /ccbot/i],
  ['facebook', /facebookexternalhit|facebookcatalog/i],
  ['twitterbot', /twitterbot/i],
  ['telegrambot', /telegrambot/i],
  ['whatsapp', /whatsapp/i],
  ['linkedinbot', /linkedinbot/i],
  ['ahrefsbot', /ahrefsbot/i],
  ['semrushbot', /semrush/i],
  ['mj12bot', /mj12bot/i],
  ['dotbot', /dotbot/i],
  ['petalbot', /petalbot/i],
  ['uptime-izleme', /monitor|uptime|pingdom|statuscake/i]
];

/** UA'dan bot adi; bilinen bot degilse null (kaydedilmez). */
function botAdi(userAgent) {
  const ua = String(userAgent || '');
  if (!ua) return null;
  for (const [ad, desen] of BOTLAR) if (desen.test(ua)) return ad;
  // Genel bot imzasi tasiyan ama listede olmayanlar tek grupta toplanir.
  if (/bot|crawl|spider|slurp/i.test(ua)) return 'diger-bot';
  return null;
}

/** Adresi sinirli sayida gruba indirger (satir patlamasi olmaz). */
function yolGrubu(reqPath) {
  const yol = String(reqPath || '/').split('?')[0].replace(/\/+$/, '') || '/';
  if (yol === '/') return 'ana-sayfa';
  if (yol === '/blog') return 'blog-listesi';
  if (yol.startsWith('/blog/')) return 'blog-yazisi';
  if (yol === '/services') return 'hizmet-listesi';
  if (yol === '/hizmet-sayfalari') return 'vitrin';
  if (yol === '/sitemap.xml' || yol === '/robots.txt' || yol.endsWith('.txt')) return 'seo-dosyasi';
  const kok = yol.slice(1);
  // Kok adresli tek parcali yollar: bilinen SPA rotasi ya da satis sayfasi.
  if (!kok.includes('/')) {
    const spa = ['about', 'terms', 'privacy', 'refund', 'smm-panel-api', 'register', 'auth', 'tickets', 'orders', 'new-order', 'add-funds', 'profile', 'admin', 'blog-detail', 'payment-success', 'payment-failed', 'reset-password', 'verify-email', 'not-found', 'landing'];
    if (spa.includes(kok)) return 'sabit-sayfa';
    if (/^[a-z0-9-]{3,120}$/.test(kok)) return 'satis-sayfasi';
  }
  return 'diger';
}

/** 404 yolunu guvenli bicime indirger: beyaz liste + uzunluk siniri. */
function yolTemizle(reqPath) {
  const yol = String(reqPath || '').split('?')[0];
  const temiz = yol.replace(/[^a-zA-Z0-9/_.\-]/g, '');
  return temiz.slice(0, YOL_SINIRI);
}

// Saatlik farkli-satir sayaci (taskin korumasi).
const saatlik = { saat: '', satir: new Set() };

function saatKovasi(ms = Date.now()) {
  const d = new Date(ms);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Bot ziyaretini kaydeder. Senkron doner; bot degilse false.
 * Cagiran yerler: server.js SSR rotalari (blog, satis sayfasi, SPA fallback).
 */
function record(req, status = 200) {
  try {
    const bot = botAdi(req.headers && req.headers['user-agent']);
    if (!bot) return false;
    const durum = Number.isInteger(status) && status >= 100 && status <= 599 ? status : 200;
    const grup = yolGrubu(req.path);
    // path yalnizca 404'te saklanir: kirik baglantiyi gormek icin gerekir;
    // 200'lerde grup yeterlidir ve tablo kucuk kalir.
    const yol = durum === 404 ? yolTemizle(req.path) : '';

    const bucket = saatKovasi();
    if (saatlik.saat !== bucket) { saatlik.saat = bucket; saatlik.satir.clear(); }
    const anahtar = `${bot}|${grup}|${durum}|${yol}`;
    if (!saatlik.satir.has(anahtar)) {
      if (saatlik.satir.size >= SAATLIK_SATIR_SINIRI) return false;
      saatlik.satir.add(anahtar);
    }

    dbAsync.run(`
      INSERT INTO crawler_visits (bucket, bot, path_group, status, path, hits)
      VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT(bucket, bot, path_group, status, path) DO UPDATE SET hits = hits + 1
    `, [bucket, bot, grup, durum, yol]).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------ rapor
/** Pencere (saat) icindeki bot etkinligi. Yalnizca SQLite okur. */
async function report(saat = 24) {
  const s = Number.isInteger(saat) && saat > 0 && saat <= 720 ? saat : 24;
  const sinir = saatKovasi(Date.now() - s * 3600 * 1000);

  const botlar = await dbAsync.all(`
    SELECT bot, SUM(hits) hits, MAX(bucket) last_bucket,
           SUM(CASE WHEN status = 404 THEN hits ELSE 0 END) not_found_hits
    FROM crawler_visits WHERE bucket >= ?
    GROUP BY bot ORDER BY hits DESC LIMIT 30`, [sinir]);

  const gruplar = await dbAsync.all(`
    SELECT path_group, SUM(hits) hits
    FROM crawler_visits WHERE bucket >= ? AND status < 400
    GROUP BY path_group ORDER BY hits DESC LIMIT 15`, [sinir]);

  const kirik = await dbAsync.all(`
    SELECT path, SUM(hits) hits, COUNT(DISTINCT bot) bots
    FROM crawler_visits WHERE bucket >= ? AND status = 404 AND path != ''
    GROUP BY path ORDER BY hits DESC LIMIT 20`, [sinir]);

  // Ana arama motorlarinin son gorulme ani (pencereden bagimsiz, 30 gun icinde).
  const sonGorulme = await dbAsync.all(`
    SELECT bot, MAX(bucket) last_bucket FROM crawler_visits
    WHERE bot IN ('googlebot', 'bingbot', 'yandexbot') GROUP BY bot`);

  return {
    window_hours: s,
    bots: botlar.map(b => ({ bot: b.bot, hits: b.hits, not_found_hits: b.not_found_hits, last_bucket: b.last_bucket })),
    path_groups: gruplar.map(g => ({ group: g.path_group, hits: g.hits })),
    not_found: kirik.map(k => ({ path: k.path, hits: k.hits, bots: k.bots })),
    engines_last_seen: sonGorulme.map(r => ({ bot: r.bot, last_bucket: r.last_bucket })),
    semantics: 'Sayımlar saatlik kovalardan gelir (UTC). IP ve ham User-Agent saklanmaz; 404 dışındaki isteklerde adres de saklanmaz.'
  };
}

/** 30 gunden eski kovalari siler. */
async function prune() {
  const sinir = saatKovasi(Date.now() - SAKLAMA_GUN * 24 * 3600 * 1000);
  await dbAsync.run('DELETE FROM crawler_visits WHERE bucket < ?', [sinir]).catch(() => {});
}

let zamanlayici = null;
function startCrawlerTracking() {
  if (zamanlayici) return;
  // Her gece 04:20 (sunucu saati): eski kovalar temizlenir.
  zamanlayici = cron.schedule('20 4 * * *', () => { prune().catch(() => {}); });
}

/** Testler icin: saatlik taskin sayacini sifirlar. */
function _reset() { saatlik.saat = ''; saatlik.satir.clear(); }

module.exports = { record, report, prune, startCrawlerTracking, botAdi, yolGrubu, _reset };
