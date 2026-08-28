'use strict';

// Site tek sayfalik bir uygulama: /services, /blog, /register... hepsi ayni
// index.html'den servis edilir. Sunucu hicbir sey degistirmezse butun adresler
// AYNI baslik, aciklama ve canonical ile cikar. Denetim bunu uc ayri hata
// olarak gorur:
//   - "Anasayfaya canonical" (8 sayfa)  -> her sayfa kendini degil / adresini
//     isaret ediyordu, Google alt sayfalari indekslemiyordu
//   - "Benzer yinelenen icerik" (8 sayfa)
//   - "Meta aciklama cok kisa" (9 sayfa)
// Bu tablo her adrese kendi basligini, aciklamasini ve canonical'ini verir.
//
// ACIKLAMA UZUNLUGU: Google 120-160 karakter arasini bekler. Alt sinirin
// altinda kalan aciklama yok sayilip sayfadan rastgele metin gosterilir.
// Alttaki test (test/page-meta.test.js) her kaydin bu araliga girdigini
// dogrular; metin degistirilirse test uyarir.

const SAYFALAR = {
  '': {
    view: 'view-landing',
    title: 'Jet SMM Panel - Otomatik Sosyal Medya Büyüme Paneli',
    description: 'Instagram, TikTok, YouTube ve Twitter için takipçi, beğeni ve izlenme hizmetlerini tek panelden yönet. Otomatik teslimat, güvenli ödeme ve 7/24 destek.'
  },
  services: {
    view: 'view-services',
    title: 'Hizmetler ve Güncel Fiyat Listesi | Jet SMM Panel',
    description: 'Tüm sosyal medya hizmetlerinin güncel fiyat listesi. Instagram, TikTok ve YouTube servislerini platform ile ülkeye göre filtrele, birim fiyatları karşılaştır.'
  },
  blog: {
    view: 'view-blog',
    title: 'Sosyal Medya Büyüme Rehberi - Blog | Jet SMM Panel',
    description: 'Sosyal medya büyüme rehberleri, algoritma ipuçları ve kampanya duyuruları. SMM panelini verimli kullanmak için hazırladığımız güncel yazıları buradan okuyun.'
  },
  'api-docs': {
    view: 'view-api-docs',
    title: 'API Dokümantasyonu | Jet SMM Panel',
    description: 'SMM panel API belgeleri: sipariş oluşturma, durum sorgulama ve bakiye uçlarının tüm parametreleri, örnek istekler ve hata kodlarıyla birlikte açıklanır.'
  },
  register: {
    view: 'view-auth',
    title: 'Ücretsiz Hesap Oluştur | Jet SMM Panel',
    description: 'Ücretsiz hesap oluştur, bakiye yükle ve Instagram, TikTok, YouTube siparişlerini saniyeler içinde başlat. Kayıt birkaç adım sürer, kart bilgisi istenmez.'
  },
  tickets: {
    view: 'view-tickets',
    title: 'Destek ve Canlı Yardım | Jet SMM Panel',
    description: 'Sipariş, ödeme ve bakiye konularındaki sorularınız için destek talebi açın. Telegram canlı destek hattımız ve bilet sistemimiz 7/24 yanınızda çalışır.'
  },
  about: {
    view: 'view-about',
    title: 'Hakkımızda ve Editoryal Politikamız | Jet SMM Panel',
    description: 'Jet SMM Panel nasıl çalışır, siparişler nasıl işlenir, hangi kalite taahhütlerini veriyoruz, blog içeriklerini hangi editoryal ilkelerle hazırlıyoruz.'
  },
  terms: {
    view: 'view-terms',
    title: 'Kullanım Şartları | Jet SMM Panel',
    description: 'Jet SMM Panel kullanım şartları: hesap açma kuralları, sipariş ve teslimat koşulları, ödeme esasları ile kullanıcı ve site sorumlulukları yer alır.'
  },
  privacy: {
    view: 'view-privacy',
    title: 'Gizlilik Politikası ve KVKK Aydınlatma Metni | Jet SMM Panel',
    description: 'Hangi kişisel verileri topluyoruz, hangi amaçla işliyoruz, ne kadar süre saklıyoruz ve KVKK kapsamındaki haklarınızı nasıl kullanırsınız: tamamı burada.'
  },
  refund: {
    view: 'view-refund',
    title: 'İade ve İptal Politikası | Jet SMM Panel',
    description: 'İade ve iptal politikamız: hangi durumlarda ücret iadesi yapılır, kısmi teslimatta tutar nasıl hesaplanır, bakiye iadesi ve başvuru süreci nasıl işler.'
  },

  // ---- Panel ici sayfalar --------------------------------------------------
  // Oturum gerektirirler; botun gordugu sey bos bir iskelettir. Indekslenirse
  // "benzer yinelenen icerik" uyarisi uretirler, bu yuzden noindex.
  landing: { alias: '' },
  auth: { view: 'view-auth', title: 'Giriş Yap | Jet SMM Panel', noindex: true },
  orders: { view: 'view-orders', title: 'Siparişlerim | Jet SMM Panel', noindex: true },
  'new-order': { view: 'view-new-order', title: 'Yeni Sipariş | Jet SMM Panel', noindex: true },
  'add-funds': { view: 'view-add-funds', title: 'Bakiye Yükle | Jet SMM Panel', noindex: true },
  profile: { view: 'view-profile', title: 'Profilim | Jet SMM Panel', noindex: true },
  admin: { view: 'view-admin', title: 'Yönetim Paneli | Jet SMM Panel', noindex: true },
  // Odeme saglayicilarindan (Shopier, PayTR) donus adresleri. Sonuc kutusu
  // Bakiye Yukle ekraninda gosterilir.
  'payment-success': { view: 'view-add-funds', title: 'Ödeme Sonucu | Jet SMM Panel', noindex: true },
  'payment-failed': { view: 'view-add-funds', title: 'Ödeme Sonucu | Jet SMM Panel', noindex: true },
  'reset-password': { view: 'view-auth', title: 'Şifre Sıfırlama | Jet SMM Panel', noindex: true },
  'verify-email': { view: 'view-auth', title: 'E-posta Doğrulama | Jet SMM Panel', noindex: true }
};

const NOT_FOUND = {
  view: 'view-not-found',
  title: 'Sayfa Bulunamadı (404) | Jet SMM Panel',
  description: 'Aradığınız sayfa taşınmış, adı değişmiş veya kaldırılmış olabilir. Ana sayfaya, hizmet listesine, bloga ya da destek bölümüne buradan geçebilirsiniz.',
  noindex: true,
  status: 404
};

/** Adresi normalize eder: '/services/' -> 'services' */
function normalizePath(pathname) {
  return String(pathname || '').split('?')[0].replace(/^\/+|\/+$/g, '');
}

/**
 * Adres icin sayfa bilgisini dondurur.
 * Tanimsiz adreslerde 404 kaydi doner (status: 404) — eskiden her adres
 * ana sayfayi 200 ile donduruyordu ("soft 404").
 */
function pageForPath(pathname) {
  const route = normalizePath(pathname);

  // Blog yazilari veritabanindan geldigi icin bu tabloda yer almaz; kendi
  // rotalari (server.js /blog/:slug) basligi ve aciklamasi ile isler.
  if (route.startsWith('blog/')) return { ...SAYFALAR.blog, view: 'view-blog-detail', status: 200 };

  let kayit = SAYFALAR[route];
  if (kayit && kayit.alias !== undefined) kayit = SAYFALAR[kayit.alias];
  if (!kayit) return { ...NOT_FOUND, route };

  return {
    status: 200,
    route,
    canonicalPath: route ? `/${route}` : '/',
    description: SAYFALAR[''].description,
    ...kayit
  };
}

/** Bilinen (404 dondurmemesi gereken) adres mi? */
function isKnownRoute(pathname) {
  return pageForPath(pathname).status === 200;
}

module.exports = { SAYFALAR, NOT_FOUND, pageForPath, isKnownRoute, normalizePath };
