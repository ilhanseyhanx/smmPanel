'use strict';

// Verilen slug'lardaki satis sayfalarini yayina alir ve IndexNow'a bildirir.
// Kullanim: cd /var/www/smmjet && node scripts/publish-landing-pages.js slug1 slug2 ...
//           (slug verilmezse tum taslaklari listeler, hicbir sey degistirmez)

const path = require('path');
const sqlite3 = require('sqlite3');

const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.join(__dirname, '..', 'database.sqlite');
const slugs = process.argv.slice(2).filter(s => /^[a-z0-9-]+$/.test(s));

(async () => {
  const db = new sqlite3.Database(dbPath);
  db.configure('busyTimeout', 5000);
  const all = (q, p = []) => new Promise((r, j) => db.all(q, p, (e, rows) => e ? j(e) : r(rows)));
  const run = (q, p = []) => new Promise((r, j) => db.run(q, p, function (e) { e ? j(e) : r(this); }));
  if (!slugs.length) {
    const taslaklar = await all("SELECT slug, title_tr FROM landing_pages WHERE status != 'published' ORDER BY sort_order");
    console.log('Taslak satis sayfalari:'); taslaklar.forEach(t => console.log(` - ${t.slug}  (${t.title_tr})`));
    db.close(); return;
  }
  let sayac = 0;
  for (const slug of slugs) {
    const r = await run("UPDATE landing_pages SET status = 'published', published_at = COALESCE(published_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE slug = ? AND status != 'published'", [slug]);
    if (r.changes) { sayac++; console.log(`yayinlandi: ${slug}`); } else console.log(`atlandi (yok veya zaten yayinda): ${slug}`);
  }
  db.close();
  if (sayac) {
    // Bing/IndexNow: yeni adresler aninda bildirilir (PUBLIC_BASE_URL .env'den).
    try {
      require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
      const { submitToIndexNow } = require('../services/indexNow');
      const base = String(process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
      if (base) await submitToIndexNow(slugs.map(s => `${base}/${s}`).concat([`${base}/services`, `${base}/blog`]));
    } catch (e) { console.warn('IndexNow bildirimi atlandi:', e.message); }
  }
  console.log(`Bitti: ${sayac} sayfa yayinlandi. Sunucu onbellegi 60 sn icinde tazelenir.`);
})().catch(err => { console.error(err); process.exit(1); });
