// Pro: blog yazilari ve satis sayfalari (services/tenantContent.js);
// sunucuda basim, HTML kacirma, site haritasi.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-icerik-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';
process.env.TENANT_BASE_DOMAIN = 'icerik.test';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');

const SIFRE = 'IcerikTestSifre_2026';
let admin;
let pro;
let std;
let servisId;

function site(host, agent = request.agent(app)) {
  const call = method => url => agent[method](url).set('Host', host);
  return { get: call('get'), post: call('post'), put: call('put'), delete: call('delete') };
}

async function bayiAc(username, slug, pkg) {
  await request(app).post('/api/auth/register').send({ username, email: `${username}@site.com`, password: SIFRE });
  const res = await admin.post('/api/admin/resellers').send({ owner: username, name: `${slug} SMM`, slug, package: pkg });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const panel = site(`${slug}.icerik.test`);
  assert.equal((await panel.post('/api/panel/login').send({ username, password: SIFRE })).status, 200);
  return { id: res.body.id, panel, host: `${slug}.icerik.test` };
}

test.before(async () => {
  await initDatabase();
  const ilk = request.agent(app);
  await ilk.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  await ilk.post('/api/admin/change-password').send({ current_password: 'admin12345', new_password: 'IcerikAdmin_2026' });
  admin = request.agent(app);
  await admin.post('/api/auth/login').send({ username: 'admin', password: 'IcerikAdmin_2026' });
  const kategori = (await dbAsync.run("INSERT INTO categories (name, name_tr) VALUES ('İçerik Test', 'İçerik Test')")).id;
  servisId = (await dbAsync.run(
    `INSERT INTO services (category_id, name, name_tr, rate_per_1000, rate_per_1000_kurus, min_quantity, max_quantity, status)
     VALUES (?, 'Instagram Takipçi', 'Instagram Takipçi', 10, 1000, 100, 10000, 1)`, [kategori])).id;
  pro = await bayiAc('icerik_pro', 'yazar', 'pro');
  std = await bayiAc('icerik_std', 'duz', 'standart');
});

test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Standart pakette blog yok', async () => {
  const res = await std.panel.post('/api/panel/content').send({ type: 'blog', title: 'Deneme yazısı', body: 'x', status: 'published' });
  assert.equal(res.status, 403);
  assert.equal((await site(std.host).get('/blog')).status, 404);
  assert.equal((await site(std.host).get('/api/site')).body.blog, false);
});

test('blog yazısı yayınlanır, sunucuda basılır; HTML kaçırılır; taslak görünmez', async () => {
  const yaz = await pro.panel.post('/api/panel/content').send({
    type: 'blog', title: 'Instagram Takipçi Nasıl Artar?', excerpt: 'Takipçi artırmanın 5 yolu',
    body: '## Giriş\nOrganik büyüme <script>alert(1)</script> zaman alır.\n\n- Düzenli paylaş\n- Hikâye kullan', status: 'published'
  });
  assert.equal(yaz.status, 201, JSON.stringify(yaz.body));
  const taslak = await pro.panel.post('/api/panel/content').send({ type: 'blog', title: 'Gizli taslak', body: 'yok', status: 'draft' });
  assert.equal(taslak.status, 201);

  const liste = await site(pro.host).get('/blog');
  assert.equal(liste.status, 200);
  assert.match(liste.text, /<section class="sf-view" data-view="blog">/, 'blog görünümü açık gelir');
  assert.match(liste.text, /<section class="sf-view" data-view="home" hidden>/);
  assert.match(liste.text, /href="\/blog\/instagram-takipci-nasil-artar"/);
  assert.doesNotMatch(liste.text, /Gizli taslak/);
  assert.match(liste.text, /<title>Blog · yazar SMM<\/title>/);

  const yazi = await site(pro.host).get('/blog/instagram-takipci-nasil-artar');
  assert.equal(yazi.status, 200);
  assert.match(yazi.text, /<h2>Giriş<\/h2>/);
  assert.match(yazi.text, /<li>Düzenli paylaş<\/li>/);
  assert.match(yazi.text, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(yazi.text, /<script>alert/);
  assert.match(yazi.text, /<meta name="description" content="Takipçi artırmanın 5 yolu">/);
  assert.equal((await site(pro.host).get('/blog/gizli-taslak')).status, 404);
  assert.equal((await site(pro.host).get('/api/blog/gizli-taslak')).status, 404);
  assert.equal((await site(pro.host).get('/api/site')).body.blog, true);

  const ayni = await pro.panel.post('/api/panel/content').send({ type: 'blog', title: 'Başka', slug: 'instagram-takipci-nasil-artar', body: 'x', status: 'draft' });
  assert.equal(ayni.status, 409);
  const kapak = await pro.panel.post('/api/panel/content').send({ type: 'blog', title: 'Kapaklı', cover_url: 'javascript:alert(1)', body: 'x', status: 'draft' });
  assert.equal(kapak.status, 400);
});

test('satış sayfası servise bağlanır; alt bilgide ve site haritasında görünür', async () => {
  const sayfa = await pro.panel.post('/api/panel/content').send({
    type: 'page', title: 'Instagram Takipçi Satın Al', slug: 'instagram-takipci', body: 'Gerçek görünümlü takipçi.', service_id: servisId, status: 'published'
  });
  assert.equal(sayfa.status, 201, JSON.stringify(sayfa.body));
  const html = await site(pro.host).get('/hizmet/instagram-takipci');
  assert.equal(html.status, 200);
  assert.match(html.text, /<section class="sf-view" data-view="post">/);
  assert.match(html.text, /<h1>Instagram Takipçi Satın Al<\/h1>/);
  const veri = (await site(pro.host).get('/api/hizmet/instagram-takipci')).body;
  assert.equal(veri.service.id, servisId);
  assert.equal(veri.service.rate, 11.7, 'vitrindeki fiyatla aynı (9,00 alış + %30)');
  const siteBilgi = (await site(pro.host).get('/api/site')).body;
  assert.deepEqual(siteBilgi.landing_pages, [{ slug: 'instagram-takipci', title: 'Instagram Takipçi Satın Al' }]);

  const robots = await site(pro.host).get('/robots.txt');
  assert.match(robots.text, /Sitemap: http:\/\/yazar\.icerik\.test\/sitemap\.xml/);
  const harita = (await site(pro.host).get('/sitemap.xml')).text;
  assert.match(harita, /<loc>http:\/\/yazar\.icerik\.test\/blog\/instagram-takipci-nasil-artar<\/loc>/);
  assert.match(harita, /<loc>http:\/\/yazar\.icerik\.test\/hizmet\/instagram-takipci<\/loc>/);
  assert.doesNotMatch(harita, /gizli-taslak/);

  const panel = (await pro.panel.get('/api/panel/content')).body;
  assert.equal(panel.posts.length, 3, 'panel taslakları da görür');
  const id = panel.posts.find(p => p.slug === 'instagram-takipci').id;
  assert.equal((await pro.panel.delete(`/api/panel/content/${id}`)).status, 200);
  assert.equal((await site(pro.host).get('/hizmet/instagram-takipci')).status, 404);
});
