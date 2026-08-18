const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-bing-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.ENABLE_DEMO_PAYMENTS = 'false';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';

const { app } = require('../server');
const { initDatabase, db } = require('../config/database');
const { extractVerificationCode, extractAnalyticsId } = require('../utils/seoVerification');

const ADMIN_PASSWORD = 'GuvenliAdminSifre_2026';
const KOD = '4A7B19C3D8E520F6A1B4C7D9E2F30516';

test.before(async () => {
  await initDatabase();
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  await agent.post('/api/admin/change-password').send({
    current_password: 'admin12345', new_password: ADMIN_PASSWORD
  });
});

test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

async function adminAgent() {
  const agent = request.agent(app);
  const login = await agent.post('/api/auth/login').send({ username: 'admin', password: ADMIN_PASSWORD });
  assert.equal(login.status, 200);
  return agent;
}

async function bingKodunuKaydet(deger) {
  const agent = await adminAgent();
  const res = await agent.post('/api/admin/settings').send({ bing_site_verification: deger });
  assert.equal(res.status, 200, res.body.error);
}

const anasayfa = async () => (await request(app).get('/')).text;

// ---------------------------------------------------------------
// Kod ayiklama: Bing dogrulama ekraninda uc yontemi yan yana gosterir,
// admin hangisinin metnini kopyalarsa kopyalasin calismali.
// ---------------------------------------------------------------

test('sade kod olduğu gibi kabul edilir', () => {
  assert.equal(extractVerificationCode(KOD), KOD);
  assert.equal(extractVerificationCode(`  ${KOD}  `), KOD);
});

test('tam meta etiketi yapıştırılırsa kod ayıklanır', () => {
  assert.equal(extractVerificationCode(`<meta name="msvalidate.01" content="${KOD}" />`), KOD);
  assert.equal(extractVerificationCode(`<meta name='msvalidate.01' content='${KOD}'>`), KOD);
});

test('Bing XML dosyasının içeriği yapıştırılırsa kod ayıklanır', () => {
  const xml = `<?xml version="1.0"?>\n<users>\n  <user>${KOD}</user>\n</users>`;
  assert.equal(extractVerificationCode(xml), KOD);
});

test('boş / tanımsız değer boş kod verir', () => {
  for (const bos of ['', '   ', null, undefined]) {
    assert.equal(extractVerificationCode(bos), '', `"${bos}" boş sayılmadı`);
  }
});

test('koddaki HTML karakterleri temizlenir (etiket kaçışı engellenir)', () => {
  const kirli = extractVerificationCode('ABC"><script>alert(1)</script>');
  assert.ok(!kirli.includes('<'), 'açı parantezi temizlenmemiş');
  assert.ok(!kirli.includes('"'), 'tırnak temizlenmemiş');
});

// ---------------------------------------------------------------
// XML dosyasi rotasi
// ---------------------------------------------------------------

test('kod girilmemişken BingSiteAuth.xml 404 döner', async () => {
  await bingKodunuKaydet('');
  const res = await request(app).get('/BingSiteAuth.xml');
  assert.equal(res.status, 404);
});

test('kod girilince BingSiteAuth.xml Bing formatında üretilir', async () => {
  await bingKodunuKaydet(KOD);
  const res = await request(app).get('/BingSiteAuth.xml');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /xml/);
  assert.ok(res.text.startsWith('<?xml version="1.0"?>'), 'XML bildirimi eksik');
  assert.ok(res.text.includes(`<user>${KOD}</user>`), 'kod dosyada yok');
});

test('küçük harfli adres de aynı dosyayı verir', async () => {
  await bingKodunuKaydet(KOD);
  const res = await request(app).get('/bingsiteauth.xml');
  assert.equal(res.status, 200);
  assert.ok(res.text.includes(`<user>${KOD}</user>`));
});

test('meta etiketi yapıştırılsa bile XML dosyası temiz kod içerir', async () => {
  await bingKodunuKaydet(`<meta name="msvalidate.01" content="${KOD}" />`);
  const res = await request(app).get('/BingSiteAuth.xml');
  assert.equal(res.text.includes(`<user>${KOD}</user>`), true, 'kod ayıklanmadan yazılmış');
  assert.ok(!res.text.includes('msvalidate'), 'etiketin tamamı dosyaya yazılmış');
});

// ---------------------------------------------------------------
// Meta etiketi (ana sayfa)
// ---------------------------------------------------------------

test('kod girilince ana sayfaya msvalidate.01 etiketi eklenir', async () => {
  await bingKodunuKaydet(KOD);
  const html = await anasayfa();
  assert.ok(html.includes(`<meta name="msvalidate.01" content="${KOD}">`), 'Bing meta etiketi sayfada yok');
});

test('kod silinince meta etiketi sayfadan kalkar', async () => {
  // Not: admin panelinin kendi placeholder metni de "msvalidate.01" gecirir,
  // bu yuzden duz metin degil gercek etiket araniyor.
  const etiket = /<meta name="msvalidate\.01" content="[^"]+">/;
  await bingKodunuKaydet(KOD);
  assert.match(await anasayfa(), etiket);

  await bingKodunuKaydet('');
  assert.doesNotMatch(await anasayfa(), etiket, 'silinen kod hâlâ sayfada');
});

test('kod kaydedilir kaydedilmez yayına girer (SEO önbelleği tazelenir)', async () => {
  // Admin kaydettikten hemen sonra Bing'de "Doğrula" der; 60 sn onbellek
  // beklenirse dogrulama basarisiz olur.
  await bingKodunuKaydet('AAAA1111');
  assert.ok((await anasayfa()).includes('content="AAAA1111"'), 'ilk kod yayına girmemiş');

  await bingKodunuKaydet('BBBB2222');
  const html = await anasayfa();
  assert.ok(html.includes('content="BBBB2222"'), 'yeni kod yayına girmemiş (önbellek tazelenmiyor)');
  assert.ok(!html.includes('AAAA1111'), 'eski kod hâlâ görünüyor');
});

test('Bing kodu Google doğrulamasını bozmaz, ikisi bir arada durur', async () => {
  const agent = await adminAgent();
  const res = await agent.post('/api/admin/settings').send({
    bing_site_verification: KOD,
    google_site_verification: 'google-dogrulama-kodu-123'
  });
  assert.equal(res.status, 200, res.body.error);

  const html = await anasayfa();
  assert.ok(html.includes(`<meta name="msvalidate.01" content="${KOD}">`), 'Bing etiketi yok');
  assert.ok(html.includes('<meta name="google-site-verification" content="google-dogrulama-kodu-123">'), 'Google etiketi kaybolmuş');
});

test('ayar kaydedilip geri okunabilir (admin panelinde alan dolu gelir)', async () => {
  await bingKodunuKaydet(KOD);
  const agent = await adminAgent();
  const res = await agent.get('/api/admin/settings');
  assert.equal(res.status, 200);
  assert.equal(res.body.settings.bing_site_verification, KOD, 'ayar kaydedilmemiş (izinli anahtar listesinde yok?)');
});

// ---------------------------------------------------------------
// Google Analytics olcum kimligi
// ---------------------------------------------------------------

const GTAG_BLOGU = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-4YNCM92GFH"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-4YNCM92GFH');
</script>`;

test('gtag.js kod bloğunun tamamı yapıştırılırsa ölçüm kimliği ayıklanır', () => {
  assert.equal(extractAnalyticsId(GTAG_BLOGU), 'G-4YNCM92GFH');
});

test('sade ölçüm kimliği ve eski biçimler de tanınır', () => {
  assert.equal(extractAnalyticsId('G-4YNCM92GFH'), 'G-4YNCM92GFH');
  assert.equal(extractAnalyticsId('  g-4yncm92gfh '), 'G-4YNCM92GFH', 'küçük harf büyütülmedi');
  assert.equal(extractAnalyticsId('UA-123456-1'), 'UA-123456-1');
  assert.equal(extractAnalyticsId('AW-987654321'), 'AW-987654321');
});

test('geçersiz metinden kimlik uydurulmaz', () => {
  for (const bos of ['', '   ', 'merhaba dünya', null, undefined]) {
    assert.equal(extractAnalyticsId(bos), '', `"${bos}" için kimlik uydurulmuş`);
  }
});

// Cerez onayi devreye girdikten sonra olcum betigi sayfaya DOGRUDAN
// basilmaz: sunucu yalnizca kimligi <meta name="analytics-id"> icinde
// birakir, app.js ziyaretci "Kabul et" dedikten sonra gtag.js'i yukler.
// Onay verilmeden Google'a hicbir istek gitmemeli.
test('kod bloğu yapıştırılsa bile sayfaya doğru ölçüm kimliği basılır', async () => {
  const agent = await adminAgent();
  const res = await agent.post('/api/admin/settings').send({ google_analytics_id: GTAG_BLOGU });
  assert.equal(res.status, 200, res.body.error);

  const html = await anasayfa();
  assert.match(html, /<meta name="analytics-id" content="G-4YNCM92GFH">/,
    'ölçüm kimliği sayfaya eklenmemiş');
  // Yapistirilan blok oldugu gibi sayfaya dokulmemeli
  assert.ok(!html.includes('<!-- Google tag (gtag.js) -->'), 'kod bloğu ham haliyle basılmış');
});

test('çerez onayı verilmeden gtag betiği sayfaya basılmaz', async () => {
  const agent = await adminAgent();
  await agent.post('/api/admin/settings').send({ google_analytics_id: 'G-4YNCM92GFH' });
  const html = await anasayfa();
  assert.ok(!html.includes('googletagmanager.com/gtag/js'),
    'ölçüm betiği onay alınmadan yükleniyor — çerez onayı işe yaramaz');
  assert.ok(html.includes('id="cookie-consent"'), 'çerez onay bandı sayfada yok');
});

test('Analytics kimliği silinince etiket sayfadan kalkar', async () => {
  const agent = await adminAgent();
  await agent.post('/api/admin/settings').send({ google_analytics_id: '' });
  const html = await anasayfa();
  assert.ok(!html.includes('googletagmanager.com/gtag/js'), 'silinen etiket hâlâ sayfada');
  assert.ok(!html.includes('name="analytics-id"'), 'silinen ölçüm kimliği hâlâ sayfada');
});

// ---------------------------------------------------------------
// Blog sayfasi: Analytics ve dogrulama etiketleri orada da olmali
// ---------------------------------------------------------------

test('blog sayfasında da Analytics ve doğrulama etiketleri bulunur', async () => {
  const slug = 'seo-etiket-testi';
  const { dbAsync } = require('../config/database');
  await dbAsync.run(
    `INSERT INTO blog_posts (title, title_tr, slug, category, category_tr, summary, summary_tr,
      content, content_tr, status, published_at)
     VALUES (?,?,?,?,?,?,?,?,?, 'published', CURRENT_TIMESTAMP)`,
    ['SEO Etiket Testi', 'SEO Etiket Testi', slug, 'Rehber', 'Rehber', 'Özet', 'Özet',
      '<p>İçerik</p>', '<p>İçerik</p>']
  );

  const agent = await adminAgent();
  await agent.post('/api/admin/settings').send({
    google_analytics_id: 'G-4YNCM92GFH',
    bing_site_verification: KOD,
    google_site_verification: 'google-dogrulama-kodu-123'
  });

  const html = (await request(app).get(`/blog/${slug}`)).text;
  assert.match(html, /<meta name="analytics-id" content="G-4YNCM92GFH">/,
    'blog sayfasında ölçüm kimliği yok — blog trafiği ölçülmez');
  assert.match(html, /<meta name="msvalidate\.01" content="[^"]+">/, 'blog sayfasında Bing doğrulaması yok');
  assert.match(html, /<meta name="google-site-verification" content="[^"]+">/, 'blog sayfasında Google doğrulaması yok');
});

test('blog sayfasının og:url adresi yazının kendi adresidir', async () => {
  const html = (await request(app).get('/blog/seo-etiket-testi')).text;
  const ogUrls = [...html.matchAll(/<meta property="og:url" content="([^"]+)">/g)].map(m => m[1]);
  assert.equal(ogUrls.length, 1, `og:url ${ogUrls.length} kez basılmış: ${ogUrls.join(', ')}`);
  assert.equal(ogUrls[0], 'http://localhost:3000/blog/seo-etiket-testi',
    'paylaşım adresi yazıya değil ana sayfaya işaret ediyor');
});

// ---------------------------------------------------------------
// Google Tag Assistant ("Etiketi test et") uyumlulugu
// ---------------------------------------------------------------

test('normal ziyarette pencere koruması (COOP) tam güçte kalır', async () => {
  const res = await request(app).get('/');
  assert.equal(res.headers['cross-origin-opener-policy'], 'same-origin',
    'normal ziyaretçinin koruması gevşetilmiş');
});

test('Tag Assistant isteğinde COOP gevşer (etiket testi geçebilsin)', async () => {
  // Tag Assistant siteyi ?gtm_debug=... ile acar; COOP same-origin kalirsa
  // window.opener kopar ve GA "etiket algılanmadı" der.
  const res = await request(app).get('/?gtm_debug=1735689600000');
  assert.equal(res.headers['cross-origin-opener-policy'], 'unsafe-none',
    'Tag Assistant bağlantısı hâlâ koparılıyor');
  assert.ok(res.text.includes('name="analytics-id"'), 'test sayfasında ölçüm kimliği yok');
});

test('gtm_debug sayfanın geri kalanını veya diğer korumaları bozmaz', async () => {
  const res = await request(app).get('/?gtm_debug=1');
  assert.ok(res.text.includes('class="navbar"'), 'sayfa bozulmuş');
  assert.match(res.headers['content-security-policy'] || '', /frame-ancestors 'none'/,
    'clickjacking koruması kalkmış');
  assert.equal(res.headers['x-frame-options'], 'SAMEORIGIN', 'çerçeve koruması kalkmış');
});

test('ana sayfada og:url yalnızca bir kez basılır', async () => {
  const ogUrls = [...(await anasayfa()).matchAll(/<meta property="og:url" content="([^"]+)">/g)].map(m => m[1]);
  assert.equal(ogUrls.length, 1, `og:url ${ogUrls.length} kez basılmış: ${ogUrls.join(', ')}`);
  assert.equal(ogUrls[0], 'http://localhost:3000/');
});

test('robots.txt Bing botunu engellemez ve sitemap adresini verir', async () => {
  const res = await request(app).get('/robots.txt');
  assert.equal(res.status, 200);
  assert.ok(/Sitemap:\s*http/.test(res.text), 'sitemap satırı yok');
  assert.ok(!/Disallow:\s*\/\s*$/m.test(res.text), 'site tamamen kapatılmış');
});
