const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-h1-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.ENABLE_DEMO_PAYMENTS = 'false';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');
const { enforceSingleH1, viewForPath, demoteHeadings } = require('../utils/headings');

const SLUG = 'h1-testi-yazisi';

test.before(async () => {
  await initDatabase();
  await dbAsync.run(
    `INSERT INTO blog_posts (title, title_tr, slug, category, category_tr, summary, summary_tr,
      content, content_tr, reading_minutes, status, published_at)
     VALUES (?,?,?,?,?,?,?,?,?,?, 'published', CURRENT_TIMESTAMP)`,
    ['Tek Başlık Testi', 'Tek Başlık Testi', SLUG, 'Rehber', 'Rehber', 'Özet', 'Özet',
      '<p>Gövde metni.</p>', '<p>Gövde metni.</p>', 3]
  );
});

test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

const h1lerini = html => [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => m[1].trim());
const sayfa = async url => (await request(app).get(url)).text;

// ---------------------------------------------------------------
// Yardimci fonksiyon
// ---------------------------------------------------------------

test('yalnızca hedef görünümün h1 etiketi kalır', () => {
  const html = `
    <section id="view-landing" class="app-view"><h1 class="hero-title">Ana Sayfa</h1></section>
    <section id="view-services" class="app-view"><h1 style="font-size:1.8rem;">Hizmetler</h1></section>
    <section id="view-blog" class="app-view"><h1>Blog</h1></section>`;
  const sonuc = enforceSingleH1(html, 'view-services');
  assert.deepEqual(h1lerini(sonuc), ['Hizmetler']);
  assert.ok(sonuc.includes('<h2 class="was-h1 hero-title">Ana Sayfa</h2>'), 'ana sayfa başlığı doğru çevrilmedi');
  assert.ok(sonuc.includes('<h2 class="was-h1">Blog</h2>'), 'sınıfsız başlık doğru çevrilmedi');
});

test('çevrilen başlık kimlik ve biçim özniteliklerini korur', () => {
  const cevrilen = demoteHeadings('<h1 id="baslik" style="font-size: 1.8rem;" data-i18n="x.y">Metin</h1>');
  assert.ok(cevrilen.includes('id="baslik"'), 'id kaybolmuş');
  assert.ok(cevrilen.includes('style="font-size: 1.8rem;"'), 'stil kaybolmuş');
  assert.ok(cevrilen.includes('data-i18n="x.y"'), 'çeviri özniteliği kaybolmuş');
  assert.ok(cevrilen.includes('class="was-h1"'), 'görünümü koruyan sınıf eklenmemiş');
});

test('görünüm bulunamazsa hiç h1 bırakılmaz (14 tane h1 kalmaz)', () => {
  const html = '<section id="view-landing"><h1>A</h1></section><section id="view-blog"><h1>B</h1></section>';
  assert.equal(h1lerini(enforceSingleH1(html, 'view-yok')).length, 0);
});

test('adres doğru görünüme eşlenir', () => {
  assert.equal(viewForPath('/'), 'view-landing');
  assert.equal(viewForPath('/services'), 'view-services');
  assert.equal(viewForPath('/blog'), 'view-blog');
  assert.equal(viewForPath('/blog/herhangi-bir-yazi'), 'view-blog-detail');
  assert.equal(viewForPath('/terms'), 'view-terms');
  // Tanimsiz adres artik ana sayfaya DUSMEZ: kendi 404 gorunumu vardir
  // (eskiden var olmayan her adres ana sayfayi 200 ile donduruyordu).
  assert.equal(viewForPath('/bilinmeyen-adres'), 'view-not-found');
});

// ---------------------------------------------------------------
// Gercek sayfalar
// ---------------------------------------------------------------

test('blog yazısında tek h1 vardır ve o da yazının başlığıdır', async () => {
  const html = await sayfa(`/blog/${SLUG}`);
  const basliklar = h1lerini(html);
  assert.equal(basliklar.length, 1, `${basliklar.length} adet h1 var: ${basliklar.join(' | ')}`);
  assert.equal(basliklar[0], 'Tek Başlık Testi', 'h1 yazının başlığı değil');
});

test('ana sayfada tek h1 vardır', async () => {
  const basliklar = h1lerini(await sayfa('/'));
  assert.equal(basliklar.length, 1, `${basliklar.length} adet h1 var: ${basliklar.join(' | ')}`);
  assert.match(basliklar[0], /AKIŞTA KAL/i, 'ana sayfanın h1 başlığı değişmiş');
});

test('hizmetler ve blog listesi sayfalarında da tek h1 vardır', async () => {
  for (const [url, beklenen] of [['/services', /Hizmetler|Fiyat/i], ['/blog', /Rehber|Blog/i]]) {
    const basliklar = h1lerini(await sayfa(url));
    assert.equal(basliklar.length, 1, `${url} -> ${basliklar.length} adet h1: ${basliklar.join(' | ')}`);
    assert.match(basliklar[0], beklenen, `${url} sayfasının h1 başlığı beklenenden farklı: ${basliklar[0]}`);
  }
});

test('yasal sayfalarda da tek h1 vardır', async () => {
  for (const url of ['/terms', '/privacy', '/refund']) {
    const basliklar = h1lerini(await sayfa(url));
    assert.equal(basliklar.length, 1, `${url} -> ${basliklar.length} adet h1`);
  }
});

test('başlıklar kaybolmaz, yalnızca seviyeleri düşer', async () => {
  const html = await sayfa('/');
  // Ana sayfa disindaki HERKESE ACIK gorunumlerin basliklari sayfada kalmali.
  // Panel ici gorunumler (siparis, bakiye, destek...) oturumsuz ziyaretciye
  // hic gonderilmez; bkz. utils/gatedMarkup.js.
  for (const metin of ['Tüm Hizmetler', 'Kullanım Şartları', 'Gizlilik']) {
    assert.ok(html.includes(metin), `"${metin}" başlığı sayfadan tamamen silinmiş`);
  }
  assert.ok(html.includes('was-h1'), 'çevrilen başlıklar biçim sınıfını almamış');
});

test('çevrilen başlıkların görünümü CSS ile korunur', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'style.css'), 'utf8');
  // Element secicili kurallar h2'ye de uygulanmali, yoksa baslikler kuculur
  assert.match(css, /\.legal-page \.was-h1/, 'yasal sayfa başlığı için kural yok');
  assert.match(css, /:not\(#view-admin\) \.was-h1/, 'panel içi sayfa başlıkları için kural yok');
});

test('sayfa içeriği bozulmadan gelir', async () => {
  const html = await sayfa(`/blog/${SLUG}`);
  assert.ok(html.includes('Gövde metni.'), 'yazı içeriği kaybolmuş');
  assert.ok(html.includes('class="navbar"'), 'sayfa yapısı bozulmuş');
  assert.ok(html.includes('/js/app.js'), 'uygulama betiği kaybolmuş');
  assert.ok(!html.includes('<h2 class="was-h1" id="blog-detail-title"'), 'yazının kendi başlığı çevrilmiş');
});
