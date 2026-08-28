'use strict';

// Blog yazilarindaki GENEL /services linklerini, yazinin platformuna uygun
// satis sayfasina cevirir (or. Telegram yazisi -> /telegram-uye-satin-al).
// Yalnizca asagidaki eslesme tablosundaki yazilara dokunur; genel konulu
// yazilar (sosyal medya, hashtag, SMM panel nedir...) /services'te kalir.
// Idempotent. Kullanim: cd /var/www/smmjet && node scripts/point-generic-service-links.js [--dry]

const path = require('path');
const sqlite3 = require('sqlite3');

const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.join(__dirname, '..', 'database.sqlite');
const DRY = process.argv.includes('--dry');

// Yazi slug'inda gecen anahtar -> satis sayfasi slug'i (ilk eslesen kazanir).
const MAP = [
  ['instagram-hikaye', 'instagram-hikaye-izlenme-satin-al'],
  ['instagram-reels-izlenme', 'instagram-izlenme-satin-al'],
  ['instagram-begeni', 'instagram-begeni-satin-al'],
  ['instagram-takipci', 'instagram-takipci-satin-al'],
  ['instagram-golge', 'instagram-takipci-satin-al'],
  ['instagram-kesfet', 'instagram-izlenme-satin-al'],
  ['tiktok-canli', 'tiktok-canli-yayin-izleyici-satin-al'],
  ['tiktok-hesap', 'tiktok-takipci-satin-al'],
  ['tiktok-algoritmasi', 'tiktok-izlenme-satin-al'],
  ['tiktok-ta-viral', 'tiktok-begeni-satin-al'],
  ['telegram', 'telegram-uye-satin-al'],
  ['x-twitter', 'twitter-takipci-satin-al'],
  ['spotify', 'spotify-dinlenme-satin-al'],
  ['facebook', 'facebook-sayfa-begeni-satin-al'],
  ['twitch', 'twitch-izleyici-satin-al'],
  ['linkedin', 'linkedin-takipci-satin-al']
];

(async () => {
  const db = new sqlite3.Database(dbPath);
  db.configure('busyTimeout', 5000);
  const all = (q, p = []) => new Promise((r, j) => db.all(q, p, (e, rows) => e ? j(e) : r(rows)));
  const run = (q, p = []) => new Promise((r, j) => db.run(q, p, function (e) { e ? j(e) : r(this); }));
  const pages = new Set((await all('SELECT slug FROM landing_pages')).map(r => r.slug));
  const posts = await all('SELECT id, slug, status, content, content_tr, content_en FROM blog_posts ORDER BY id');
  let degisen = 0;
  for (const p of posts) {
    const hit = MAP.find(([anahtar]) => p.slug.includes(anahtar));
    if (!hit || !pages.has(hit[1])) continue;
    const hedef = `/${hit[1]}`;
    const cevir = html => String(html || '').replace(/href="\/services"/g, `href="${hedef}"`);
    const yeni = { content: cevir(p.content), content_tr: cevir(p.content_tr), content_en: cevir(p.content_en) };
    if (yeni.content === (p.content || '') && yeni.content_tr === (p.content_tr || '') && yeni.content_en === (p.content_en || '')) continue;
    degisen++;
    console.log(`${DRY ? '[deneme] ' : ''}${p.id} (${p.status}) ${p.slug} -> ${hedef}`);
    if (!DRY) await run('UPDATE blog_posts SET content = ?, content_tr = ?, content_en = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [yeni.content, yeni.content_tr, yeni.content_en, p.id]);
  }
  console.log(`Bitti: ${degisen} yazi ${DRY ? 'degisecek' : 'guncellendi'}.`);
  db.close();
})().catch(err => { console.error(err); process.exit(1); });
