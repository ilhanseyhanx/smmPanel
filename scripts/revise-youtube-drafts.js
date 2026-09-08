'use strict';

// Var olan YouTube TASLAK sayfalarini seed-landing-pages-youtube.js icindeki
// guncel metinlerle gunceller. Tek kaynak o dosyadir; burada metin tutulmaz.
//
// GUVENLIK: yalnizca status = 'draft' satirlara dokunur. Sayfa yayindaysa
// islem yapmaz ve uyarir — yayindaki bir sayfanin metnini kazara ezmemek icin.
// status, views, created_at ve published_at alanlarina HIC dokunulmaz.
//
// Kullanim: cd /var/www/smmjet && node scripts/revise-youtube-drafts.js
//           (--dry ile yalnizca ne degisecegini yazar, kaydetmez)

const path = require('path');
const sqlite3 = require('sqlite3');
const { normalizePagePayload } = require('../utils/landingPages');
const { PAGES } = require('./seed-landing-pages-youtube');

const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.join(__dirname, '..', 'database.sqlite');
const kuruProva = process.argv.includes('--dry');

// Yalnizca icerik/metadata alanlari. status ve sayaclar listede YOK.
const GUNCELLENECEK = [
  'platform_key', 'category_ids', 'title_tr', 'title_en', 'subtitle_tr', 'subtitle_en',
  'seo_title_tr', 'seo_title_en', 'seo_description_tr', 'seo_description_en',
  'content_tr', 'content_en', 'steps_tr', 'steps_en', 'faq_tr', 'faq_en',
  'cta_text_tr', 'cta_text_en', 'related_blog_slugs', 'sort_order'
];

(async () => {
  const db = new sqlite3.Database(dbPath);
  db.configure('busyTimeout', 5000);
  const get = (q, p = []) => new Promise((r, j) => db.get(q, p, (e, row) => e ? j(e) : r(row)));
  const run = (q, p = []) => new Promise((r, j) => db.run(q, p, function (e) { e ? j(e) : r(this); }));

  let guncellenen = 0;
  for (const ham of PAGES) {
    const mevcut = await get('SELECT id, slug, status FROM landing_pages WHERE slug = ?', [ham.slug]);
    if (!mevcut) { console.log('ATLANDI (kayit yok): ' + ham.slug); continue; }
    if (mevcut.status !== 'draft') {
      console.log('ATLANDI (yayinda, dokunulmadi): ' + ham.slug + '  [status=' + mevcut.status + ']');
      continue;
    }

    const sonuc = normalizePagePayload(ham);
    if (sonuc.error) { console.error('HATA ' + ham.slug + ': ' + sonuc.error); continue; }

    // Ne degisiyor, once goster.
    const oncesi = await get('SELECT ' + GUNCELLENECEK.join(', ') + ' FROM landing_pages WHERE id = ?', [mevcut.id]);
    const degisen = GUNCELLENECEK.filter(c => String(oncesi[c] == null ? '' : oncesi[c]) !== String(sonuc.fields[c] == null ? '' : sonuc.fields[c]));
    console.log('');
    console.log('=== ' + ham.slug + ' (taslak) ===');
    if (!degisen.length) { console.log('  degisiklik yok'); continue; }
    for (const c of degisen) {
      const a = String(oncesi[c] == null ? '' : oncesi[c]);
      const b = String(sonuc.fields[c] == null ? '' : sonuc.fields[c]);
      console.log('  * ' + c + ': ' + a.length + ' -> ' + b.length + ' karakter');
    }
    if (['seo_description_tr', 'seo_title_tr'].some(c => degisen.includes(c))) {
      console.log('  yeni seo_title_tr      : ' + sonuc.fields.seo_title_tr + '  [' + sonuc.fields.seo_title_tr.length + ']');
      console.log('  yeni seo_description_tr: ' + sonuc.fields.seo_description_tr + '  [' + sonuc.fields.seo_description_tr.length + ']');
    }

    if (kuruProva) { console.log('  (kuru prova: kaydedilmedi)'); continue; }
    await run('UPDATE landing_pages SET ' + GUNCELLENECEK.map(c => c + ' = ?').join(', ')
      + ', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = ' + "'draft'",
      [...GUNCELLENECEK.map(c => sonuc.fields[c]), mevcut.id]);
    console.log('  kaydedildi.');
    guncellenen++;
  }

  db.close();
  console.log('');
  console.log(kuruProva ? 'Kuru prova bitti, hicbir sey yazilmadi.' : ('Bitti: ' + guncellenen + ' taslak guncellendi. Sayfalar HALA taslak.'));
})().catch(err => { console.error(err); process.exit(1); });
