'use strict';

// Mevcut blog yazilarindaki servis ID'li linkleri (/services?service=ID) kalici
// satis sayfasi adresine (yoksa /services) cevirir. Idempotent; tekrar
// calistirilabilir. Kullanim: cd /var/www/smmjet && node scripts/rewrite-blog-service-links.js [--dry]

const path = require('path');
const sqlite3 = require('sqlite3');
const { rewriteServiceLinks } = require('../utils/landingPages');

const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.join(__dirname, '..', 'database.sqlite');
const DRY = process.argv.includes('--dry');

(async () => {
  const db = new sqlite3.Database(dbPath);
  db.configure('busyTimeout', 5000);
  const dbAsync = {
    all: (q, p = []) => new Promise((r, j) => db.all(q, p, (e, rows) => e ? j(e) : r(rows))),
    run: (q, p = []) => new Promise((r, j) => db.run(q, p, function (e) { e ? j(e) : r(this); }))
  };
  const posts = await dbAsync.all('SELECT id, slug, content, content_tr, content_en FROM blog_posts ORDER BY id');
  let degisen = 0;
  for (const p of posts) {
    const yeni = {};
    let fark = false;
    for (const key of ['content', 'content_tr', 'content_en']) {
      yeni[key] = await rewriteServiceLinks(p[key] || '', dbAsync);
      if (yeni[key] !== (p[key] || '')) fark = true;
    }
    if (!fark) continue;
    degisen++;
    const hedefler = [...new Set([...(yeni.content_tr || '').matchAll(/href="(\/[a-z0-9-]*)"/g)].map(m => m[1]).filter(h => h !== '/services' ? /satin-al$/.test(h) : true))];
    console.log(`${DRY ? '[deneme] ' : ''}${p.id} ${p.slug} -> ${hedefler.join(', ')}`);
    if (!DRY) {
      await dbAsync.run('UPDATE blog_posts SET content = ?, content_tr = ?, content_en = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [yeni.content, yeni.content_tr, yeni.content_en, p.id]);
    }
  }
  console.log(`Bitti: ${degisen} yazi ${DRY ? 'degisecek' : 'guncellendi'}.`);
  db.close();
})().catch(err => { console.error(err); process.exit(1); });
