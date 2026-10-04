'use strict';

// EGITIM SERILERI — 10 baslik, TASLAK olarak (4 Eki 2026)
//
// Basliklar ve sira 4 Eki 2026 planindan: once 1 kisa giris urunu (Profil
// Optimizasyonu), sonra en cok aranan uc ana seri (Instagram, TikTok,
// YouTube). Dersler admin panel > Egitimler'den eklenir; dersi olmayan egitim
// yayina alinamaz (sunucu engeller).
//
// ICERIK KURALI: basliklarda ve aciklamalarda takipci / kesfet / para kazanma
// GARANTISI verilmez ("yol haritasi", "strateji", "plan" dili). Egitimlerde
// panel servislerine dogrudan yonlendirme yapilmaz.
//
// FIYATLAR YER TUTUCUDUR: 4 Eki planindaki seviyelere gore (dusuk 49,
// dusuk-orta 99, orta 149, orta-ust 199, ust 249 TL). Yayina almadan once
// admin panelden kesinlestir.
//
// Kullanim: cd /var/www/smmjet && node scripts/seed-courses-taslak.js
//           node scripts/seed-courses-taslak.js --dry   (yalnizca rapor)
// Sunucu yeni surumle en az bir kez acilmis olmali (courses tablosu).
// Var olan slug'lara DOKUNMAZ.

const path = require('path');
const sqlite3 = require('sqlite3');
const { normalizeCoursePayload } = require('../utils/courses');

const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.join(__dirname, '..', 'database.sqlite');
const DRY = process.argv.includes('--dry');

const COURSES = [
  {
    slug: 'profil-optimizasyonu', sort_order: 1, level: 'Her Seviye', price: 49,
    title: 'Profil Optimizasyonu: İlk 3 Saniyede Takip Ettiren Profil',
    subtitle: 'Kullanıcı adı, profil fotoğrafı, bio, öne çıkanlar ve sabitlenmiş gönderilerle ziyaretçiyi takipçiye çeviren profil düzeni.'
  },
  {
    slug: 'instagram-0dan-10k', sort_order: 2, level: 'Başlangıç', price: 149,
    title: "Instagram 0'dan 10K'ya: Adım Adım Büyüme Planı",
    subtitle: 'Yeni açılmış bir hesabı ilk 10.000 takipçi hedefine taşımak için niş seçimi, içerik sütunları ve haftalık yayın planından oluşan yol haritası.'
  },
  {
    slug: 'tiktok-kesfet-rehberi', sort_order: 3, level: 'Başlangıç', price: 149,
    title: 'TikTok Keşfet Rehberi: Algoritmayı Anla, Videolarını Öne Çıkar',
    subtitle: 'İzlenme süresi, ilk saniye kancası, ses ve paylaşım sinyalleri: For You sayfasında görünürlüğünü artıracak üretim ve yayın alışkanlıkları.'
  },
  {
    slug: 'youtube-para-kazanma-yol-haritasi', sort_order: 4, level: 'Orta', price: 199,
    title: 'YouTube Para Kazanma Yol Haritası: 1000 Abone ve 4000 Saat',
    subtitle: 'İş Ortağı Programı şartlarına giden yolda kanal konumlandırma, uzun video ve Shorts dengesi, izlenme süresini artıran içerik yapısı.'
  },
  {
    slug: 'reels-shorts-icerik-sistemi', sort_order: 5, level: 'Orta', price: 149,
    title: 'Reels ve Shorts İçerik Sistemi: Haftada 7 Video Üretmek',
    subtitle: 'Fikir bankası, toplu çekim, şablon kurgu ve takvimle her gün video yayınlamayı sürdürülebilir hale getiren üretim sistemi.'
  },
  {
    slug: 'viral-icerik-formulu', sort_order: 6, level: 'Her Seviye', price: 99,
    title: 'Viral İçerik Formülü: Kanca, Hikâye, Kapanış',
    subtitle: 'Paylaşılan ve kaydedilen içeriklerin ortak iskeleti: ilk cümle kancası, hikâye akışı ve izleyiciyi harekete geçiren kapanış.'
  },
  {
    slug: 'instagramdan-para-kazanma', sort_order: 7, level: 'Orta', price: 199,
    title: "Instagram'dan Para Kazanma: Marka İşbirliği ve Fiyatlandırma",
    subtitle: 'Medya kiti hazırlama, markalara teklif gönderme, gönderi ve hikâye fiyatlandırma ve sözleşmede dikkat edilecek noktalar.'
  },
  {
    slug: 'yerel-isletmeler-icin-instagram', sort_order: 8, level: 'Başlangıç', price: 199,
    title: 'Yerel İşletmeler İçin Instagram: Kafe, Kuaför, Butik Müşteri Çekme',
    subtitle: 'Konum etiketleri, yerel hashtagler, müşteri yorumları ve kampanya gönderileriyle Instagram\'ı mağazana müşteri getiren bir kanala dönüştür.'
  },
  {
    slug: 'tiktok-canli-yayin-rehberi', sort_order: 9, level: 'Orta', price: 149,
    title: 'TikTok Canlı Yayın ve Hediye Geliri Rehberi',
    subtitle: 'Canlı yayın açma şartları, yayın akışı planlama, izleyiciyi tutma teknikleri ve hediye gelirinin nasıl hesaplandığı.'
  },
  {
    slug: 'sosyal-medya-ajansi-kur', sort_order: 10, level: 'İleri', price: 249,
    title: 'Sosyal Medya Ajansı Kur: İlk 10 Müşteriyi Bulma',
    subtitle: 'Hizmet paketlerini belirleme, fiyat listesi, ilk müşterileri bulma, teklif ve raporlama süreciyle küçük ölçekli bir sosyal medya ajansı kurma.'
  }
].map(c => ({ ...c, status: 'draft', free_lesson_count: 2, seo_description: c.subtitle.slice(0, 160) }));

if (require.main === module) {
  (async () => {
    const db = new sqlite3.Database(dbPath, DRY ? sqlite3.OPEN_READONLY : undefined);
    const get = (sql, p = []) => new Promise((res, rej) => db.get(sql, p, (e, r) => (e ? rej(e) : res(r))));
    const run = (sql, p = []) => new Promise((res, rej) => db.run(sql, p, e => (e ? rej(e) : res())));
    let eklenen = 0;
    let atlanan = 0;
    for (const course of COURSES) {
      if (await get('SELECT id FROM courses WHERE slug = ?', [course.slug])) {
        console.log('ATLANDI (zaten var): ' + course.slug);
        atlanan++; continue;
      }
      const sonuc = normalizeCoursePayload(course);
      if (sonuc.error) { console.error('HATA ' + course.slug + ': ' + sonuc.error); atlanan++; continue; }
      if (DRY) { console.log('[dry] olusturulacakti: ' + sonuc.fields.slug + ' (₺' + course.price + ')'); eklenen++; continue; }
      const cols = Object.keys(sonuc.fields);
      await run('INSERT INTO courses (' + cols.join(', ') + ') VALUES (' + cols.map(() => '?').join(', ') + ')', cols.map(c => sonuc.fields[c]));
      console.log('olusturuldu (taslak, ₺' + course.price + '): ' + sonuc.fields.slug);
      eklenen++;
    }
    db.close();
    console.log('Bitti: ' + eklenen + ' eğitim ' + (DRY ? 'oluşturulacaktı' : 'oluşturuldu') + ', ' + atlanan + ' atlandı.');
    if (!DRY && eklenen) console.log('Eğitimler TASLAK. Admin panel > Eğitimler bölümünden ders ekleyip yayına al.');
  })().catch(err => { console.error(err); process.exit(1); });
}

module.exports = { COURSES };
