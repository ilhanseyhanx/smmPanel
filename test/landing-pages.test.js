// Satis sayfalari (platform bazli landing page'ler): SSR, API, dogrulama.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-lp-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.PUBLIC_BASE_URL = 'https://jetsmmpanel.com';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');
const landing = require('../utils/landingPages');

test.before(async () => {
  await initDatabase();
  await dbAsync.run("INSERT INTO categories (name, name_tr, name_en, sort_order) VALUES ('Instagram Takipçi', 'Instagram Takipçi', 'Instagram Followers', 1)");
  const cat = await dbAsync.get("SELECT id FROM categories WHERE name = 'Instagram Takipçi'");
  await dbAsync.run(`INSERT INTO services (category_id, name, name_tr, name_en, rate_per_1000, rate_per_1000_kurus, min_quantity, max_quantity, status, refill)
    VALUES (?, 'IG Takipçi', 'Instagram Takipçi | Gerçek', 'Instagram Followers | Real', 21.84, 2184, 100, 100000, 1, 0)`, [cat.id]);
  const yayinda = landing.normalizePagePayload({
    slug: 'instagram-takipci-satin-al', status: 'published', platform_key: 'instagram', category_ids: [cat.id],
    title_tr: 'Instagram Takipçi Satın Al', title_en: 'Buy Instagram Followers',
    subtitle_tr: 'Şifresiz, anında başlayan Instagram takipçi paketleri.', subtitle_en: 'Instant Instagram follower packages, no password needed.',
    content_tr: '<h2>Neden bizden?</h2><p>Instagram takipçi satın almak için güvenli ve hızlı bir panel. Siparişler saniyeler içinde başlar ve şifre istenmez.</p>',
    content_en: '<h2>Why us?</h2><p>A safe and fast panel to buy Instagram followers. Orders start within seconds and no password is required.</p>',
    steps_tr: 'Hesap oluştur\nBakiye yükle\nSipariş ver', faq_tr: 'Şifre gerekir mi?\nHayır, yalnızca profil bağlantısı yeterlidir.\n\nNe zaman başlar?\nSaniyeler içinde başlar.'
  });
  assert.ok(!yayinda.error, yayinda.error);
  const cols = Object.keys(yayinda.fields);
  await dbAsync.run(`INSERT INTO landing_pages (${cols.join(',')}, published_at) VALUES (${cols.map(() => '?').join(',')}, CURRENT_TIMESTAMP)`, cols.map(c => yayinda.fields[c]));
  const taslak = landing.normalizePagePayload({
    slug: 'tiktok-takipci-satin-al', status: 'draft', platform_key: 'tiktok', category_ids: [cat.id],
    title_tr: 'TikTok Takipçi Satın Al', content_tr: '<p>Taslak sayfa içeriği burada durur ve yayına kadar görünmez.</p>'
  });
  const cols2 = Object.keys(taslak.fields);
  await dbAsync.run(`INSERT INTO landing_pages (${cols2.join(',')}) VALUES (${cols2.map(() => '?').join(',')})`, cols2.map(c => taslak.fields[c]));
});
test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('yayındaki satış sayfası kök adreste sunucu tarafında basılır', async () => {
  const res = await request(app).get('/instagram-takipci-satin-al');
  assert.equal(res.status, 200);
  assert.match(res.text, /<h1 id="lp-title">Instagram Takipçi Satın Al<\/h1>/, 'H1 basılmadı');
  assert.match(res.text, /<title>Instagram Takipçi Satın Al \| /, 'başlık yanlış');
  assert.match(res.text, /<link rel="canonical" href="https:\/\/jetsmmpanel\.com\/instagram-takipci-satin-al">/, 'canonical yanlış');
  assert.match(res.text, /"@type":"FAQPage"/, 'FAQPage şeması yok');
  assert.match(res.text, /"@type":"OfferCatalog"/, 'OfferCatalog şeması yok');
  assert.match(res.text, /Instagram Takipçi \| Gerçek/, 'kategori servisi listelenmedi');
  assert.match(res.text, /data-lp-slug="instagram-takipci-satin-al"/, 'SPA hidrasyon işareti yok');
  assert.ok(!/<meta name="robots" content="noindex/.test(res.text), 'satış sayfası noindex olmamalı');
  // Sayfada tek h1 kalmali (diger gorunumlerinki h2'ye cevrilir).
  assert.equal((res.text.match(/<h1[\s>]/g) || []).length, 1, 'birden fazla h1');
});

test('taslak satış sayfası /services adresine yönlenir, yayınlanınca sitemap ve llms.txt içinde görünür', async () => {
  const taslakRes = await request(app).get('/tiktok-takipci-satin-al');
  assert.equal(taslakRes.status, 302, 'taslak sayfa /services adresine geçici yönlenmeli');
  assert.equal(taslakRes.headers.location, '/services');
  const sitemap = (await request(app).get('/sitemap.xml')).text;
  assert.match(sitemap, /<loc>https:\/\/jetsmmpanel\.com\/instagram-takipci-satin-al<\/loc>/);
  assert.ok(!/tiktok-takipci-satin-al/.test(sitemap), 'taslak sitemap\'e girmemeli');
  const llms = (await request(app).get('/llms.txt')).text;
  assert.match(llms, /## Hizmet Sayfaları/);
  assert.match(llms, /\/instagram-takipci-satin-al\)/);
});

test('satış sayfası bağlantıları alt bilgiye ve hizmet listesine basılır', async () => {
  const anaSayfa = (await request(app).get('/')).text;
  assert.match(anaSayfa, /id="footer-landing-pages"[^>]*>[\s\S]*href="\/instagram-takipci-satin-al"/, 'alt bilgi bağlantısı yok');
  const blog = (await request(app).get('/blog')).text;
  assert.match(blog, /id="blog-landing-aside"[^>]*>[\s\S]*class="blog-aside-btn"[^>]*>[\s\S]*Instagram Takipçi Satın Al/, 'blog sağ sütunu yok');
});

test('herkese açık API: liste ve tekil sayfa (EN dahil), taslak 404', async () => {
  const liste = await request(app).get('/api/landing-pages');
  assert.equal(liste.status, 200);
  assert.deepEqual(liste.body.pages.map(p => p.slug), ['instagram-takipci-satin-al']);
  const en = await request(app).get('/api/landing-pages/instagram-takipci-satin-al?lang=en');
  assert.equal(en.status, 200);
  assert.equal(en.body.page.title, 'Buy Instagram Followers');
  assert.match(en.body.html, /Instagram Followers \| Real/, 'EN servis adı kullanılmadı');
  assert.equal((await request(app).get('/api/landing-pages/tiktok-takipci-satin-al')).status, 404);
});

test('blog içindeki servis ID linkleri satış sayfasına, eşleşme yoksa /services\'e çevrilir', async () => {
  const cat = await dbAsync.get("SELECT id FROM categories WHERE name = 'Instagram Takipçi'");
  const srv = await dbAsync.get('SELECT id FROM services WHERE category_id = ?', [cat.id]);
  const html = `<p><a href="/services?service=${srv.id}">A</a> <a href="#services?service=999999">B</a> <a href="/blog/x">C</a></p>`;
  const out = await landing.rewriteServiceLinks(html, dbAsync);
  assert.match(out, /href="\/instagram-takipci-satin-al">A</, 'kategori sayfasına çevrilmedi');
  assert.match(out, /href="\/services">B</, 'silinmiş servis /services olmalı');
  assert.match(out, /href="\/blog\/x">C</, 'blog linkine dokunulmamalı');
});

test('doğrulama: ayrılmış slug, kategori ve içerik zorunluluğu', () => {
  assert.match(landing.normalizePagePayload({ slug: 'services', title_tr: 'X', category_ids: [1], content_tr: '<p>a</p>' }).error, /geçersiz/);
  assert.match(landing.normalizePagePayload({ slug: 'blog', title_tr: 'X', category_ids: [1], content_tr: '<p>a</p>' }).error, /geçersiz/);
  assert.match(landing.normalizePagePayload({ title_tr: 'Test Sayfası', category_ids: [], content_tr: '<p>a</p>' }).error, /kategori/);
  assert.match(landing.normalizePagePayload({ title_tr: 'Test Sayfası', category_ids: [1], content_tr: '' }).error, /içeriği/);
  const ok = landing.normalizePagePayload({ title_tr: 'Telegram Üye Satın Al', category_ids: '219, 216', content_tr: '<p>x</p><script>alert(1)</script>', faq_tr: 'Soru?\nCevap.' });
  assert.equal(ok.fields.slug, 'telegram-uye-satin-al');
  assert.deepEqual(JSON.parse(ok.fields.category_ids), [219, 216]);
  assert.ok(!/<script/.test(ok.fields.content_tr), 'script temizlenmedi');
  assert.deepEqual(JSON.parse(ok.fields.faq_tr), [{ q: 'Soru?', a: 'Cevap.' }]);
  // EN bos birakilirsa TR'ye duser (sayfa dil degisiminde bos kalmasin).
  assert.deepEqual(JSON.parse(ok.fields.faq_en), [{ q: 'Soru?', a: 'Cevap.' }]);
});
