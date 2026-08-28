'use strict';

// SEO odakli blog TASLAKLARI (28 Agu 2026) — "satin almaya yakin bilgi" anahtar
// kelimeleri (kanka listesindeki C grubu). Kullanim (sunucuda):
//   cd /var/www/smmjet && node scripts/seed-blog-drafts.js
// Var olan slug'lara dokunmaz. Yazilar admin panelde taslak olarak durur;
// "Yayinla" ile sirayla yayinlanir. Icerik dosyalari: scripts/blog-drafts/*.js

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const { normalizePlainText, sanitizeRichText } = require('../utils/security');
const { buildMetaDescription } = require('../utils/metaDescription');

const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.join(__dirname, '..', 'database.sqlite');
const dir = path.join(__dirname, 'blog-drafts');
const POSTS = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort().flatMap(f => require(path.join(dir, f)));

function wordCount(html) { return String(html).replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length; }

(async () => {
  const db = new sqlite3.Database(dbPath);
  const run = (q, p = []) => new Promise((r, j) => db.run(q, p, function (e) { e ? j(e) : r(this); }));
  const get = (q, p = []) => new Promise((r, j) => db.get(q, p, (e, row) => e ? j(e) : r(row)));
  const all = (q, p = []) => new Promise((r, j) => db.all(q, p, (e, rows) => e ? j(e) : r(rows)));
  db.configure('busyTimeout', 5000);

  // Kullanilmayan kapak varyanti: ayni kapak iki yazida gorunmesin.
  const used = new Set((await all('SELECT image_url FROM blog_posts')).map(r => String(r.image_url || '')));
  const cover = platform => {
    for (let v = 1; v <= 50; v++) {
      const url = `/api/blog/cover/${platform}/${v}.svg?v=2`;
      if (!used.has(url)) { used.add(url); return url; }
    }
    return `/api/blog/cover/${platform}/1.svg?v=2`;
  };

  // --update: var olan TASLAK yazilarin icerigi dosyadaki surumle degistirilir
  // (yayinlanmis yaziya dokunulmaz; admin panelde elle duzenlenen yayin kaybolmasin).
  const UPDATE = process.argv.includes('--update');
  let eklendi = 0;
  for (const p of POSTS) {
    const mevcut = await get('SELECT id, status FROM blog_posts WHERE slug = ?', [p.slug]);
    if (mevcut && !(UPDATE && mevcut.status === 'draft')) { console.log(`atlandi (${mevcut.status}): ${p.slug}`); continue; }
    const titleTr = normalizePlainText(p.title_tr, 180);
    const titleEn = normalizePlainText(p.title_en, 180);
    const contentTr = sanitizeRichText(p.content_tr);
    const contentEn = sanitizeRichText(p.content_en);
    const summaryTr = normalizePlainText(p.summary_tr, 320);
    const summaryEn = normalizePlainText(p.summary_en, 320);
    const reading = Math.max(3, Math.min(20, Math.round(wordCount(contentTr) / 200)));
    if (mevcut) {
      await run(`UPDATE blog_posts SET title = ?, title_tr = ?, title_en = ?, category = ?, category_tr = ?, category_en = ?,
          summary = ?, summary_tr = ?, summary_en = ?, content = ?, content_tr = ?, content_en = ?,
          seo_title_tr = ?, seo_title_en = ?, seo_description_tr = ?, seo_description_en = ?, reading_minutes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'draft'`,
      [titleTr, titleTr, titleEn, p.category_tr, p.category_tr, p.category_en, summaryTr, summaryTr, summaryEn, contentTr, contentTr, contentEn,
        normalizePlainText(p.seo_title_tr || titleTr, 180), normalizePlainText(p.seo_title_en || titleEn, 180),
        buildMetaDescription([p.seo_description_tr, summaryTr, contentTr], titleTr),
        buildMetaDescription([p.seo_description_en, summaryEn, contentEn], titleEn), reading, mevcut.id]);
      eklendi++;
      console.log(`guncellendi (taslak): ${p.slug} — ${wordCount(contentTr)} kelime TR / ${wordCount(contentEn)} EN, ${reading} dk`);
      continue;
    }
    await run(`INSERT INTO blog_posts (title, slug, category, summary, content, image_url, title_tr, title_en, category_tr, category_en,
        summary_tr, summary_en, content_tr, content_en, seo_title_tr, seo_title_en, seo_description_tr, seo_description_en,
        status, reading_minutes, updated_at, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, CURRENT_TIMESTAMP, NULL)`,
    [titleTr, p.slug, p.category_tr, summaryTr, contentTr, cover(p.cover), titleTr, titleEn, p.category_tr, p.category_en,
      summaryTr, summaryEn, contentTr, contentEn,
      normalizePlainText(p.seo_title_tr || titleTr, 180), normalizePlainText(p.seo_title_en || titleEn, 180),
      buildMetaDescription([p.seo_description_tr, summaryTr, contentTr], titleTr),
      buildMetaDescription([p.seo_description_en, summaryEn, contentEn], titleEn),
      reading]);
    eklendi++;
    console.log(`eklendi (taslak): ${p.slug} — ${wordCount(contentTr)} kelime TR / ${wordCount(contentEn)} EN, ${reading} dk`);
  }
  console.log(`Bitti: ${eklendi} taslak eklendi.`);
  db.close();
})().catch(err => { console.error(err); process.exit(1); });
