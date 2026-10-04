'use strict';

// EGITIM ICERIKLERINI YUKLE (5 Eki 2026)
//
// scripts/course-content/<slug>/ klasorlerindeki TR + EN egitim ve dersleri,
// gorseller.json'daki kapak/infografik adresleriyle veritabanina yazar.
//   - Egitim slug ile eslesir: varsa GUNCELLENIR (kimlik, satislar, istatistik
//     korunur), yoksa olusturulur.
//   - Dersler slug ile eslesir: var olan guncellenir, yeni eklenir, icerikte
//     artik olmayan ders silinir. Sira icerikteki siradir.
//   - Ders icindeki <!--GORSEL--> isareti infografikle degistirilir.
//   - Fiyat (TL, sabit) asagidaki FIYATLAR tablosundan gelir; dolar karsiligi
//     sitede gunluk kurla hesaplanir.
//
// Kullanim: cd /var/www/smmjet && node scripts/seed-course-content.js            (taslak olarak yaz)
//           node scripts/seed-course-content.js --publish                         (yaz ve yayinla)
//           node scripts/seed-course-content.js --dry                             (yalnizca rapor)
//           node scripts/seed-course-content.js instagram-0dan-10k --publish      (tek egitim)
// Sunucu yeni surumle en az bir kez acilmis olmali (sutunlar).

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const { normalizeCoursePayload, normalizeLessonPayload, esc } = require('../utils/courses');

const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.join(__dirname, '..', 'database.sqlite');
const ICERIK = path.join(__dirname, 'course-content');
const DRY = process.argv.includes('--dry');
const PUBLISH = process.argv.includes('--publish');

// Onem sirasina gore TL fiyat (200-500 araligi) ve katalog sirasi.
const FIYATLAR = {
  'sosyal-medya-ajansi-kur': 499,
  'youtube-para-kazanma-yol-haritasi': 449,
  'instagram-0dan-10k': 449,
  'instagramdan-para-kazanma': 399,
  'tiktok-kesfet-rehberi': 399,
  'yerel-isletmeler-icin-instagram': 349,
  'reels-shorts-icerik-sistemi': 349,
  'tiktok-canli-yayin-rehberi': 299,
  'viral-icerik-formulu': 279,
  'profil-optimizasyonu': 249
};
const SIRA = [
  'instagram-0dan-10k', 'tiktok-kesfet-rehberi', 'youtube-para-kazanma-yol-haritasi', 'instagramdan-para-kazanma',
  'reels-shorts-icerik-sistemi', 'viral-icerik-formulu', 'profil-optimizasyonu', 'yerel-isletmeler-icin-instagram',
  'tiktok-canli-yayin-rehberi', 'sosyal-medya-ajansi-kur'
];

function gorselEkle(html, url, alt) {
  const kaynak = String(html || '');
  if (!url) return kaynak.replace(/<!--\s*GORSEL\s*-->/g, '');
  const figur = `<figure class="crs-figure"><img src="${esc(url)}" alt="${esc(alt)}" width="1200" height="675"></figure>`;
  if (/<!--\s*GORSEL\s*-->/.test(kaynak)) return kaynak.replace(/<!--\s*GORSEL\s*-->/, figur).replace(/<!--\s*GORSEL\s*-->/g, '');
  // Isaret unutulduysa ilk paragrafin arkasina konur.
  const i = kaynak.indexOf('</p>');
  return i === -1 ? figur + kaynak : kaynak.slice(0, i + 4) + figur + kaynak.slice(i + 4);
}

function egitimiOku(slug) {
  const klasor = path.join(ICERIK, slug);
  const course = require(path.join(klasor, 'index.js'));
  if (course.slug !== slug) throw new Error(`${slug}: index.js içindeki slug farklı (${course.slug})`);
  const gorselYolu = path.join(klasor, 'gorseller.json');
  const gorseller = fs.existsSync(gorselYolu) ? JSON.parse(fs.readFileSync(gorselYolu, 'utf8')) : { cover: {}, lessons: {} };
  if (!fs.existsSync(gorselYolu)) console.warn(`UYARI ${slug}: gorseller.json yok — önce node scripts/course-visuals.js ${slug}`);
  return { course, gorseller };
}

function alanlar(course, gorseller, index) {
  const fiyat = FIYATLAR[course.slug];
  if (!fiyat) throw new Error(`${course.slug}: FIYATLAR tablosunda fiyat yok`);
  const sira = SIRA.indexOf(course.slug);
  const sonuc = normalizeCoursePayload({
    slug: course.slug,
    status: PUBLISH ? 'published' : 'draft',
    title: course.title_tr, title_en: course.title_en,
    subtitle: course.subtitle_tr, subtitle_en: course.subtitle_en,
    description: course.description_tr, description_en: course.description_en,
    seo_title: course.seo_title_tr, seo_title_en: course.seo_title_en,
    seo_description: course.seo_description_tr, seo_description_en: course.seo_description_en,
    level: course.level_tr, level_en: course.level_en,
    cover_image_url: gorseller.cover.tr || '', cover_image_url_en: gorseller.cover.en || '',
    price: fiyat, free_lesson_count: 2,
    sort_order: sira === -1 ? 100 + index : sira + 1
  });
  if (sonuc.error) throw new Error(`${course.slug}: ${sonuc.error}`);
  return sonuc.fields;
}

function dersAlanlari(course, lesson, gorseller) {
  const g = gorseller.lessons[lesson.slug] || {};
  const v = lesson.visual || {};
  const sonuc = normalizeLessonPayload({
    slug: lesson.slug,
    title: lesson.title_tr, title_en: lesson.title_en,
    summary: lesson.summary_tr, summary_en: lesson.summary_en,
    content: gorselEkle(lesson.content_tr, g.tr, v.title_tr || lesson.title_tr),
    content_en: gorselEkle(lesson.content_en, g.en, v.title_en || lesson.title_en)
  });
  if (sonuc.error) throw new Error(`${course.slug}/${lesson.slug}: ${sonuc.error}`);
  return sonuc.fields;
}

async function main() {
  const istenen = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const sluglar = istenen.length
    ? istenen
    : fs.readdirSync(ICERIK).filter(d => !d.startsWith('_') && fs.existsSync(path.join(ICERIK, d, 'index.js')));
  const db = new sqlite3.Database(dbPath, DRY ? sqlite3.OPEN_READONLY : undefined);
  const run = (sql, p = []) => new Promise((res, rej) => db.run(sql, p, function (e) { e ? rej(e) : res(this); }));
  const get = (sql, p = []) => new Promise((res, rej) => db.get(sql, p, (e, r) => (e ? rej(e) : res(r))));
  const all = (sql, p = []) => new Promise((res, rej) => db.all(sql, p, (e, r) => (e ? rej(e) : res(r))));

  let toplamDers = 0;
  for (const [index, slug] of sluglar.entries()) {
    const { course, gorseller } = egitimiOku(slug);
    const f = alanlar(course, gorseller, index);
    const dersler = course.lessons.map(l => dersAlanlari(course, l, gorseller));
    const tekil = new Set(dersler.map(d => d.slug));
    if (tekil.size !== dersler.length) throw new Error(`${slug}: ders slug'ları benzersiz değil`);
    if (DRY) {
      console.log(`[dry] ${slug}: ₺${f.price_kurus / 100}, ${dersler.length} ders, kapak ${f.cover_image_url ? 'var' : 'YOK'}`);
      toplamDers += dersler.length;
      continue;
    }
    await run('BEGIN IMMEDIATE');
    try {
      let mevcut = await get('SELECT id, status FROM courses WHERE slug = ?', [slug]);
      const cols = Object.keys(f);
      if (mevcut) {
        await run(`UPDATE courses SET ${cols.map(c => `${c} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP,
          published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, CURRENT_TIMESTAMP) ELSE published_at END WHERE id = ?`,
        [...cols.map(c => f[c]), f.status, mevcut.id]);
      } else {
        const ins = await run(`INSERT INTO courses (${cols.join(', ')}, published_at) VALUES (${cols.map(() => '?').join(', ')}, CASE WHEN ? = 'published' THEN CURRENT_TIMESTAMP ELSE NULL END)`,
          [...cols.map(c => f[c]), f.status]);
        mevcut = { id: ins.lastID };
      }
      const eski = await all('SELECT id, slug FROM course_lessons WHERE course_id = ?', [mevcut.id]);
      const eskiMap = new Map(eski.map(l => [l.slug, l.id]));
      for (const [i, d] of dersler.entries()) {
        const dc = Object.keys(d);
        if (eskiMap.has(d.slug)) {
          await run(`UPDATE course_lessons SET ${dc.map(c => `${c} = ?`).join(', ')}, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [...dc.map(c => d[c]), i + 1, eskiMap.get(d.slug)]);
        } else {
          await run(`INSERT INTO course_lessons (course_id, ${dc.join(', ')}, sort_order) VALUES (?, ${dc.map(() => '?').join(', ')}, ?)`,
            [mevcut.id, ...dc.map(c => d[c]), i + 1]);
        }
      }
      for (const l of eski) if (!tekil.has(l.slug)) await run('DELETE FROM course_lessons WHERE id = ?', [l.id]);
      await run('COMMIT');
    } catch (err) {
      await run('ROLLBACK').catch(() => {});
      throw err;
    }
    toplamDers += dersler.length;
    console.log(`✓ ${slug}: ₺${f.price_kurus / 100}, ${dersler.length} ders, ${f.status === 'published' ? 'YAYINDA' : 'taslak'}`);
  }
  db.close();
  console.log(`Bitti: ${sluglar.length} eğitim, ${toplamDers} ders${DRY ? ' (dry, yazılmadı)' : ''}.`);
}

if (require.main === module) main().catch(err => { console.error(err.message || err); process.exit(1); });

module.exports = { FIYATLAR, SIRA, gorselEkle };
