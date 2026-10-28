// Demo bayi: demo-<site> adresleri, musteri gozuyle gezme, salt okunur demo
// panel, ornek veriler, admin kur/onar ve silme korumasi.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-demo-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';
process.env.TENANT_BASE_DOMAIN = 'demo.test';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');

const SIFRE = 'DemoTestSifresi_2026';
let admin;
let demoId;

function site(host, agent = request.agent(app)) {
  const call = method => url => agent[method](url).set('Host', host);
  return { get: call('get'), post: call('post'), put: call('put'), delete: call('delete') };
}

test.before(async () => {
  await initDatabase();
  const ilk = request.agent(app);
  await ilk.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  await ilk.post('/api/admin/change-password').send({ current_password: 'admin12345', new_password: 'DemoAdminSifre_2026' });
  admin = request.agent(app);
  await admin.post('/api/auth/login').send({ username: 'admin', password: 'DemoAdminSifre_2026' });
});

test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('admin demo siteleri kurar; tekrar basınca onarır; listede Demo olarak görünür ve silinemez', async () => {
  assert.equal((await site('demo-gece.demo.test').get('/')).status, 404, 'kurulmadan önce yok');
  const kur = await admin.post('/api/admin/resellers/demo');
  assert.equal(kur.status, 200, JSON.stringify(kur.body));
  assert.equal(kur.body.message, 'Demo siteler kuruldu.');
  demoId = kur.body.tenant_id;
  await dbAsync.run("UPDATE tenants SET status = 'suspended', name = 'Bozuk' WHERE id = ?", [demoId]);
  const onar = await admin.post('/api/admin/resellers/demo');
  assert.equal(onar.body.message, 'Demo siteler onarıldı.');
  assert.equal(onar.body.tenant_id, demoId);
  const row = await dbAsync.get('SELECT status, name, plan_status FROM tenants WHERE id = ?', [demoId]);
  assert.deepEqual(row, { status: 'active', name: 'Jet Demo', plan_status: 'comp' });

  const liste = await admin.get('/api/admin/resellers');
  assert.equal(liste.body.tenants.find(t => t.id === demoId).is_demo, true);
  const sil = await admin.delete(`/api/admin/resellers/${demoId}`).send({ confirm: 'demo' });
  assert.equal(sil.status, 409);
  assert.ok(await dbAsync.get('SELECT id FROM tenants WHERE id = ?', [demoId]));
});

test('her tema kendi demo adresinde kendi markasıyla açılır; şerit diğer demolara bağlanır', async () => {
  const gece = await site('demo-gece.demo.test').get('/');
  assert.equal(gece.status, 200);
  assert.match(gece.text, /data-theme="dark"/);
  assert.match(gece.text, /<title>Gece Medya<\/title>/);
  assert.match(gece.text, /href="\/\/demo-cesur\.demo\.test\/"/);
  assert.match(gece.text, /<a href="\/\/demo-gece\.demo\.test\/" title="Gece Medya" class="active"/);
  assert.match(gece.text, /href="\/admin"/);
  assert.match(gece.text, /href="\/demo\/musteri"/);
  assert.match(gece.text, /name="robots" content="noindex"/);
  // Ana sayfa bolumleri: sayilar ve platformlar (JS doldurur), adimlar, SSS, kapanis bandi, sutunlu alt bilgi.
  for (const parca of ['id="sf-stats"', 'id="sf-platform-grid"', 'class="sf-steps"', 'class="sf-faq"', 'class="sf-cta-band"', 'sf-footer-grid']) {
    assert.ok(gece.text.includes(parca), parca);
  }
  const api = await site('demo-kurumsal.demo.test').get('/api/site');
  assert.equal(api.body.name, 'Atlas Dijital');
  assert.equal((await site('demo-yok.demo.test').get('/')).status, 404, 'tanımsız demo adresi');
  // Demo Pro pakette: örnek blog, satış sayfası ve kendi dijital ürünü görünür.
  const blog = await site('demo-gece.demo.test').get('/blog');
  assert.equal(blog.status, 200);
  assert.match(blog.text, /href="\/blog\/instagram-takipci-nasil-artar"/);
  assert.equal((await site('demo-gece.demo.test').get('/hizmet/instagram-takipci-satin-al')).status, 200);
  const dijital = (await site('demo-gece.demo.test').get('/api/digital/products')).body.products;
  assert.ok(dijital.some(p => p.own && p.stock === 5));
});

test('müşteri gözüyle: şifresiz demo müşteri girişi, örnek siparişler, yazma kapalı', async () => {
  const agent = request.agent(app);
  const vitrin = site('demo-sade.demo.test', agent);
  const giris = await vitrin.get('/demo/musteri');
  assert.equal(giris.status, 302);
  assert.equal(giris.headers.location, '/order');
  const me = await vitrin.get('/api/auth/me');
  assert.equal(me.body.customer.username, 'demo_musteri');
  assert.equal(me.body.customer.balance, 250);
  const siparisler = await vitrin.get('/api/orders');
  assert.ok(siparisler.body.orders.length >= 5);
  const digerleri = /ayse\.k|mert_34|elifyilmaz|can\.medya|zeynep_ig|burak\.tr|selin\.shop|emre_kaya|deniz\.ajans|ozan61|irem\.beauty|kerem_fx|gizem\.art|tolga\.music/;
  assert.ok(siparisler.body.orders.every(o => !digerleri.test(o.link)), 'başka müşterinin bağlantısı görünmez');
  const yontemler = await vitrin.get('/api/payments/methods');
  assert.deepEqual(yontemler.body.methods.map(m => m.method), ['bank', 'paytr', 'nowpayments']);
  const siparis = await vitrin.post('/api/orders').send({ service_id: 1, link: 'https://instagram.com/x', quantity: 100 });
  assert.equal(siparis.status, 403);
  assert.match(siparis.body.error, /demo site/);
  assert.equal((await vitrin.post('/api/payments/bank').send({ amount: 100, bank_name: 'X', sender_name: 'Y' })).status, 403);
  assert.equal((await vitrin.post('/api/auth/logout')).status, 200, 'çıkış açık');
});

test('demo panel: şifresiz açılır, örnek verilerle dolu, hiçbir değişiklik kaydedilmez', async () => {
  const panel = site('demo-neon.demo.test');
  const me = await panel.get('/api/panel/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.tenant.name, 'Neon Boost');
  assert.ok(me.body.demo);
  assert.equal(me.body.subscription.plan_status, 'trial');
  assert.equal(me.body.subscription.days_left, 1);
  assert.equal(me.body.subscription.package, 'pro');

  const ozet = await panel.get('/api/panel/dashboard');
  assert.equal(ozet.body.recent_orders.length, 8);
  assert.ok(ozet.body.last_30d.profit > 0);
  const tekrar = await panel.get('/api/panel/dashboard');
  assert.deepEqual(tekrar.body.recent_orders.map(o => o.id), ozet.body.recent_orders.map(o => o.id), 'veriler kararlı');

  const musteriler = await panel.get('/api/panel/customers');
  assert.ok(musteriler.body.customers.length >= 10);
  const detay = await panel.get(`/api/panel/customers/${musteriler.body.customers[0].id}`);
  assert.equal(detay.body.customer.username, musteriler.body.customers[0].username);
  assert.equal((await panel.get('/api/panel/customers/1')).status, 404);
  const tamam = await panel.get('/api/panel/orders?status=completed');
  assert.ok(tamam.body.orders.length > 0 && tamam.body.orders.every(o => o.status === 'completed'));
  const odemeler = await panel.get('/api/panel/payments?status=pending&method=bank');
  assert.equal(odemeler.body.pending_bank, 2);
  assert.equal((await panel.get('/api/panel/logs')).status, 200);
  assert.equal((await panel.get('/api/panel/subscription')).body.subscription.plan_status, 'trial');
  assert.equal((await panel.get('/api/panel/services')).status, 200, 'gerçek katalog');

  for (const [method, url, body] of [
    ['put', '/api/panel/site', { name: 'Ele geçirildi', primary_color: '#000000' }],
    ['put', '/api/panel/pricing', { default_markup_percent: 1 }],
    ['post', '/api/panel/subscription/continue', {}],
    ['post', '/api/panel/domains', { domain: 'ornek.com' }],
    ['post', '/api/panel/payments/905/approve', {}]
  ]) {
    const res = await panel[method](url).send(body);
    assert.equal(res.status, 403, `${method} ${url}`);
    assert.match(res.body.error, /demo panel/);
  }
  assert.equal((await dbAsync.get('SELECT name FROM tenants WHERE id = ?', [demoId])).name, 'Jet Demo');
  const panelHtml = await panel.get('/admin');
  assert.equal(panelHtml.status, 200);
});

test('demo olmayan bayide panel şifresiz açılmaz ve demo müşteri adresi çalışmaz', async () => {
  await request(app).post('/api/auth/register').send({ username: 'gercek_bayi', email: 'gercek@site.com', password: SIFRE });
  await admin.post('/api/admin/resellers').send({ owner: 'gercek_bayi', name: 'Gerçek SMM', slug: 'gercek' });
  const gercek = site('gercek.demo.test');
  assert.equal((await gercek.get('/api/panel/me')).status, 401);
  assert.equal((await gercek.get('/api/panel/dashboard')).status, 401);
  const musteri = await gercek.get('/demo/musteri');
  assert.equal(musteri.status, 200, 'vitrine düşer, oturum açmaz');
  assert.equal(musteri.headers['set-cookie'], undefined);
  const sayfa = await gercek.get('/');
  assert.doesNotMatch(sayfa.text, /sf-demo-bar/);
});
