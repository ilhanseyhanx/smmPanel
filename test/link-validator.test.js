const test = require('node:test');
const assert = require('node:assert/strict');
const { validateOrderLink, detectPlatform, detectTarget } = require('../utils/linkValidator');

const svc = (name, category = '') => ({ name, name_tr: name, name_en: name, category_name: category });

const kabul = (link, service, not) =>
  assert.equal(validateOrderLink(link, service).ok, true,
    `KABUL EDİLMELİYDİ: ${not || link}\n   -> ${validateOrderLink(link, service).message || ''}`);

const reddet = (link, service, not) =>
  assert.equal(validateOrderLink(link, service).ok, false, `REDDEDİLMELİYDİ: ${not || link}`);

// --- Servis tipini tanima --------------------------------------------------

test('servis adından platform ve hedef tipi doğru çıkarılır', () => {
  assert.equal(detectPlatform('Instagram Turkish Likes [Real]'), 'instagram');
  assert.equal(detectPlatform('TikTok Followers | HQ'), 'tiktok');
  assert.equal(detectPlatform('YouTube Subscribers [Non Drop]'), 'youtube');

  // "Likes" adın başında geçtiği için beğeni sayılmalı, "Real Accounts" takipçiye çekmemeli
  assert.equal(detectTarget('Instagram Likes [ Max 10M ] | 100% Real Accounts with Profile'), 'media');
  assert.equal(detectTarget('Instagram Followers [High Quality]'), 'profile');
  assert.equal(detectTarget('YouTube Views | Social Ads'), 'media');
  assert.equal(detectTarget('Instagram Turkish Story Views'), 'story');
});

// --- İlhan'ın Peakerr'da yaptığı hata --------------------------------------

test('beğeni servisine profil linki girilirse reddedilir (yaşanan hata)', () => {
  const begeni = svc('Instagram Likes [ Turkey ] | Real', 'Instagram Likes');
  const sonuc = validateOrderLink('https://www.instagram.com/kullaniciadi', begeni, 'tr');
  assert.equal(sonuc.ok, false);
  assert.equal(sonuc.code, 'need_media');
  assert.match(sonuc.message, /gönderi/i, 'mesaj gönderi linki istediğini söylemeli');
  assert.match(sonuc.message, /instagram\.com\/p\//, 'mesaj örnek link içermeli');
});

test('hata mesajı İngilizce de dönebilir', () => {
  const begeni = svc('Instagram Likes', 'Instagram Likes');
  const en = validateOrderLink('https://www.instagram.com/kullaniciadi', begeni, 'en');
  assert.equal(en.ok, false);
  assert.match(en.message, /post\/video link/i);
  assert.doesNotMatch(en.message, /gönderi/i);
});

// --- Instagram -------------------------------------------------------------

test('Instagram: beğeni/izlenme servisleri gönderi linki ister', () => {
  const begeni = svc('Instagram Likes', 'Instagram Likes');
  kabul('https://www.instagram.com/p/Cxyz123abc/', begeni);
  kabul('https://www.instagram.com/reel/Cxyz123abc/', begeni);
  kabul('https://instagram.com/tv/Cxyz123abc', begeni);
  reddet('https://www.instagram.com/kullaniciadi', begeni, 'profil linki');
  reddet('instagram.com/kullaniciadi/', begeni, 'protokolsüz profil linki');
  reddet('kullaniciadi', begeni, 'sadece kullanıcı adı');
});

test('Instagram: takipçi servisi profil linki veya kullanıcı adı kabul eder', () => {
  const takipci = svc('Instagram Followers [Real]', 'Instagram Followers');
  kabul('https://www.instagram.com/kullaniciadi', takipci);
  kabul('kullaniciadi', takipci, 'sadece kullanıcı adı');
  kabul('@kullaniciadi', takipci, 'at işaretli kullanıcı adı');
  reddet('https://www.instagram.com/p/Cxyz123abc/', takipci, 'gönderi linki');
  reddet('https://www.instagram.com/reel/Cxyz123abc/', takipci, 'reel linki');
});

// --- TikTok ----------------------------------------------------------------

test('TikTok: video ve profil linkleri ayırt edilir', () => {
  const izlenme = svc('TikTok Video Views', 'Tiktok Views');
  const takipci = svc('TikTok Followers', 'Tiktok Followers');

  kabul('https://www.tiktok.com/@kullanici/video/7300000000000000000', izlenme);
  reddet('https://www.tiktok.com/@kullanici', izlenme, 'profil linki izlenme servisine');

  kabul('https://www.tiktok.com/@kullanici', takipci);
  reddet('https://www.tiktok.com/@kullanici/video/7300000000000000000', takipci, 'video linki takipçi servisine');

  // Kisa link icerigi bilinmiyor -> engellenmemeli
  kabul('https://vm.tiktok.com/ZMabcdefg/', izlenme, 'kısa link');
});

// --- YouTube ---------------------------------------------------------------

test('YouTube: video ve kanal linkleri ayırt edilir', () => {
  const izlenme = svc('YouTube Views | Real', 'YouTube Views');
  const abone = svc('YouTube Subscribers [Non Drop]', 'YouTube Subscribers');

  kabul('https://www.youtube.com/watch?v=dQw4w9WgXcQ', izlenme);
  kabul('https://youtu.be/dQw4w9WgXcQ', izlenme, 'kısa video linki');
  kabul('https://www.youtube.com/shorts/abc123', izlenme);
  reddet('https://www.youtube.com/@kanaladi', izlenme, 'kanal linki izlenme servisine');

  kabul('https://www.youtube.com/@kanaladi', abone);
  kabul('https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxx', abone);
  reddet('https://www.youtube.com/watch?v=dQw4w9WgXcQ', abone, 'video linki abone servisine');
  reddet('https://youtu.be/dQw4w9WgXcQ', abone, 'youtu.be her zaman videodur');
});

// --- Diğer platformlar -----------------------------------------------------

test('Twitter, Telegram ve Facebook için tip kontrolü çalışır', () => {
  const rt = svc('Twitter Retweets', 'Twitter');
  kabul('https://x.com/kullanici/status/1700000000000000000', rt);
  reddet('https://x.com/kullanici', rt, 'profil linki retweet servisine');

  const uye = svc('Telegram Members [Real]', 'Telegram Members');
  const goruntulenme = svc('Telegram Post Views', 'Telegram Views');
  kabul('https://t.me/kanaladi', uye);
  reddet('https://t.me/kanaladi/123', uye, 'gönderi linki üye servisine');
  kabul('https://t.me/kanaladi/123', goruntulenme);
  reddet('https://t.me/kanaladi', goruntulenme, 'kanal linki görüntülenme servisine');

  const fbBegeni = svc('Facebook Post Likes', 'Facebook Likes');
  kabul('https://www.facebook.com/sayfa/posts/123456', fbBegeni);
  reddet('https://www.facebook.com/sayfaadi', fbBegeni, 'sayfa linki gönderi beğenisine');
});

// --- Platform karışıklığı --------------------------------------------------

test('yanlış platformun linki net mesajla reddedilir', () => {
  const igTakipci = svc('Instagram Followers', 'Instagram');
  const sonuc = validateOrderLink('https://www.tiktok.com/@kullanici', igTakipci, 'tr');
  assert.equal(sonuc.ok, false);
  assert.equal(sonuc.code, 'wrong_platform');
  assert.match(sonuc.message, /Instagram/);
  assert.match(sonuc.message, /TikTok/);
});

// --- Emin olunmayan durumlarda engelleme YAPILMAMALI -----------------------

test('şüpheli olmayan durumlarda sipariş engellenmez (yanlış pozitif olmamalı)', () => {
  // Platformu tanimlanamayan servis
  kabul('https://ornek.com/bir-sey', svc('Website Traffic Worldwide', 'Traffic'));
  // Hedef tipi cikarilamayan servis
  kabul('https://www.instagram.com/kullaniciadi', svc('Instagram Special Package', 'Instagram'));
  // Bilinmeyen alan adi (kisaltici/yonlendirme)
  kabul('https://bit.ly/abc123', svc('Instagram Likes', 'Instagram Likes'));
  // Bozuk URL
  kabul('ht!tp:/bozuk link', svc('Instagram Likes', 'Instagram Likes'));
  // Bos deger
  kabul('', svc('Instagram Likes', 'Instagram Likes'));
});

test('hikâye servisi hikâye linki ister', () => {
  const story = svc('Instagram Turkish Story Views', 'Instagram Story Views');
  kabul('https://www.instagram.com/stories/kullanici/3200000000000000000/', story);
  reddet('https://www.instagram.com/p/Cxyz123abc/', story, 'gönderi linki hikâye servisine');
});
