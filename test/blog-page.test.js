const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-blogsayfa-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.ENABLE_DEMO_PAYMENTS = 'false';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');

const SLUG = 'blog-sayfasi-testi';

test.before(async () => {
  await initDatabase();
  await dbAsync.run(
    `INSERT INTO blog_posts (title, title_tr, slug, category, category_tr, summary, summary_tr,
      content, content_tr, image_url, reading_minutes, status, published_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?, 'published', CURRENT_TIMESTAMP)`,
    ['Test Yazısı & Başlık', 'Test Yazısı & Başlık', SLUG, 'Rehber', 'Rehber',
      'Kısa özet', 'Kısa özet',
      '<p>Yazının gövde metni burada.</p>', '<p>Yazının gövde metni burada.</p>',
      '/api/blog/cover/instagram/1.svg?v=2', 4]
  );
});

test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

const blogSayfasi = async () => (await request(app).get(`/blog/${SLUG}`)).text;

test('blog sayfası sitenin kendi kabuğunu kullanır (yenileyince tasarım değişmez)', async () => {
  const html = await blogSayfasi();
  const anasayfa = (await request(app).get('/')).text;

  // Ana sayfayla ayni yapisal parcalar bulunmali
  for (const parca of ['class="navbar"', 'id="app-viewport"', '/css/style.css', '/js/app.js',
    'language-selector', 'theme-selector']) {
    assert.ok(html.includes(parca), `blog sayfasında "${parca}" yok — tasarım ana sayfadan farklı`);
    assert.ok(anasayfa.includes(parca), `ana sayfada "${parca}" yok (test varsayımı hatalı)`);
  }
});

test('yazı içeriği JavaScript çalışmadan da HTML içinde gelir (SEO)', async () => {
  const html = await blogSayfasi();
  assert.ok(html.includes('Yazının gövde metni burada.'), 'gövde metni HTML\'de yok');
  assert.ok(html.includes('Test Yazısı &amp; Başlık'), 'başlık HTML\'de yok veya kaçışlanmamış');
  assert.ok(html.includes('4 dk okuma'), 'okuma süresi basılmamış');
});

test('blog görünümü açık, ana sayfa görünümü kapalı gelir', async () => {
  const html = await blogSayfasi();
  assert.match(html, /<section id="view-blog-detail" class="app-view" style="display: block;">/,
    'blog görünümü açık değil');
  assert.match(html, /<section id="view-landing" class="app-view neo-landing" style="display: none;">/,
    'ana sayfa görünümü kapatılmamış');
});

test('SEO etiketleri yazıya göre ayarlanır', async () => {
  const html = await blogSayfasi();
  assert.ok(html.includes('<title>Test Yazısı &amp; Başlık |'), 'sayfa başlığı yazıya göre değil');
  assert.ok(html.includes(`<link rel="canonical" href="http://localhost:3000/blog/${SLUG}">`), 'canonical yanlış');
  assert.ok(html.includes('<meta property="og:type" content="article">'), 'og:type article değil');
  assert.ok(html.includes('"@type":"BlogPosting"'), 'JSON-LD yapısal verisi yok');
  assert.ok(html.includes('summary_large_image'), 'twitter kartı ayarlanmamış');
  // Ana sayfanin varsayilan basligi kalmamali
  assert.ok(!html.includes('<title>SMM Panel - Otomatik Sosyal Medya Büyüme Paneli</title>'),
    'ana sayfa başlığı blog sayfasında kalmış');
});

test('kapak görseli hem sayfada hem paylaşım etiketinde mutlak adresle gelir', async () => {
  const html = await blogSayfasi();
  assert.ok(html.includes('http://localhost:3000/api/blog/cover/instagram/1.svg'), 'kapak mutlak adrese çevrilmemiş');
  assert.match(html, /<img id="blog-detail-img" src="[^"]+"/, 'kapak görseli sayfaya basılmamış');
});

test('blog sayfası açılınca görüntülenme sayacı artar (Google trafiği de sayılır)', async () => {
  const once = (await dbAsync.get('SELECT views FROM blog_posts WHERE slug = ?', [SLUG])).views;
  await request(app).get(`/blog/${SLUG}`);
  await request(app).get(`/blog/${SLUG}`);
  await new Promise(r => setTimeout(r, 200));
  const sonra = (await dbAsync.get('SELECT views FROM blog_posts WHERE slug = ?', [SLUG])).views;
  assert.equal(sonra, once + 2, `sayaç artmadı: ${once} -> ${sonra}`);
});

test('blog sayfası ziyaretçi sayımına dahil olur', async () => {
  await dbAsync.run('DELETE FROM site_visits');
  await request(app).get(`/blog/${SLUG}`)
    .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0)').set('X-Forwarded-For', '9.9.9.9');
  await new Promise(r => setTimeout(r, 200));
  const n = await dbAsync.get('SELECT COUNT(*) c FROM site_visits');
  assert.equal(n.c, 1, 'blog sayfasından gelen ziyaretçi sayılmamış');
});

test('yayında olmayan yazı blog listesine yönlendirilir', async () => {
  await dbAsync.run("UPDATE blog_posts SET status = 'draft' WHERE slug = ?", [SLUG]);
  const res = await request(app).get(`/blog/${SLUG}`);
  assert.equal(res.status, 302);
  assert.equal(res.headers.location, '/blog');
  await dbAsync.run("UPDATE blog_posts SET status = 'published' WHERE slug = ?", [SLUG]);
});

test('olmayan yazı blog listesine yönlendirilir', async () => {
  const res = await request(app).get('/blog/boyle-bir-yazi-yok');
  assert.equal(res.status, 302);
  assert.equal(res.headers.location, '/blog');
});
