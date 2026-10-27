// Dijital urunler: sahte saglayiciyla (X-API-Key, /products, /buy, /orders,
// /gmail-check) uctan uca — saglayici baglama, katalogdan urun ekleme,
// sunucuda basilan sayfa, satin alma (aninda / hazirlanan / hatali / belirsiz),
// stok ve zarar korumasi, teslimat gizliligi, iade ve Gmail Checker.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-digital-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.ENABLE_DEMO_PAYMENTS = 'false';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';
process.env.ALLOW_PRIVATE_PROVIDER_URLS = 'true';
process.env.DIGITAL_RATE_LIMIT_MAX = '500';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');
const Store = require('../services/digitalStore');

const API_KEY = 'dk_live_GIZLI_ANAHTAR_123456';
const ADMIN_PASSWORD = 'GuvenliAdminSifre_2026';

// --- Sahte dijital urun saglayicisi ------------------------------------------
const sahte = {
  products: [
    { id: 12, slug: 'gmail-7-gun', name: 'Gmail 7 Günlük', category: 'Gmail Hesapları', price: 0.2, stock: 500, format: 'email|şifre', delivery_time: 'Anında', warranty_hours: 24, min: 1, max: 100, description: 'Yeni açılmış hesap', usage: 'Kullanım talimatları' },
    { id: 13, slug: 'outlook-hesap', name: 'Outlook Hesap', category: 'Outlook', price: 0.1, stock: 3, format: 'email|şifre', delivery_time: 'Anında', warranty_hours: 0, min: 1, max: 50 }
  ],
  orders: new Map(),
  nextOrder: 1,
  buyMode: 'completed', // completed | pending | reject | crash
  checks: [],
  checkFailOnce: false
};

function sahteSaglayiciKur() {
  const mock = express();
  mock.use(express.json());
  mock.use((req, res, next) => (req.get('X-API-Key') === API_KEY ? next() : res.status(401).json({ success: false, error: 'Geçersiz API anahtarı' })));
  mock.get('/api/v1/profile', (req, res) => res.json({ success: true, data: { username: 'bayi', email: 'x', balance: 125.4, currency: 'USD' } }));
  mock.get('/api/v1/products', (req, res) => {
    const page = Number(req.query.page || 1);
    // Sayfalamayi denemek icin sayfa basina 1 urun.
    const item = sahte.products[page - 1];
    res.json({ success: true, data: { products: item ? [item] : [], pagination: { page, per_page: 1, total_page: sahte.products.length, total: sahte.products.length } } });
  });
  mock.get('/api/v1/products/:slug', (req, res) => {
    const p = sahte.products.find(item => item.slug === req.params.slug || String(item.id) === req.params.slug);
    if (!p) return res.status(404).json({ success: false, error: 'Ürün bulunamadı' });
    res.json({ success: true, data: p });
  });
  mock.post('/api/v1/buy', (req, res) => {
    const p = sahte.products.find(item => String(item.id) === String(req.body.product_id) || item.slug === req.body.product_id);
    if (sahte.buyMode === 'crash') return res.status(500).send('boom');
    if (sahte.buyMode === 'reject' || !p) return res.status(400).json({ success: false, error: 'Stok yetersiz' });
    const qty = Number(req.body.quantity);
    const id = `AL${sahte.nextOrder++}`;
    const items = Array.from({ length: qty }, (_, i) => `mail${i + 1}@example.com|s<i>fre&${i + 1}`);
    const order = { order_id: id, status: sahte.buyMode === 'pending' ? 'pending' : 'completed', quantity: qty, total: Math.round(p.price * qty * 100) / 100, balance: 100, items: sahte.buyMode === 'pending' ? [] : items, usage: 'Kullanım talimatları' };
    sahte.orders.set(id, { ...order, items });
    res.json({ success: true, data: order });
  });
  mock.get('/api/v1/orders/:id', (req, res) => {
    const o = sahte.orders.get(req.params.id);
    if (!o) return res.status(404).json({ success: false, error: 'Sipariş yok' });
    res.json({ success: true, data: { order_id: o.order_id, status: o.status, items: o.status === 'completed' ? o.items : [] } });
  });
  mock.post('/api/v1/gmail-check', (req, res) => {
    sahte.checks.push(req.body);
    if (sahte.checkFailOnce) { sahte.checkFailOnce = false; return res.status(503).send('busy'); }
    // Son adres icin sonuc donmez (iade edilmeli).
    const emails = req.body.emails.slice(0, -1);
    res.json({ success: true, data: { checked: emails.length, results: emails.map((email, i) => ({ email, status: i % 2 ? 'notexists' : 'live' })), billing: { cost: 0.01 * emails.length } } });
  });
  return new Promise(resolve => {
    const server = mock.listen(0, '127.0.0.1', () => resolve(server));
  });
}

let mockServer;
let baseUrl;
let admin;
let musteri;
let ids = {};

async function giris(username, password) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ username, password });
  assert.equal(res.status, 200, `${username} girisi basarisiz`);
  return agent;
}

async function bakiyeAyarla(kurus, username = 'demo_user') {
  await dbAsync.run('UPDATE users SET balance_kurus = ?, balance = ? / 100.0 WHERE username = ?', [kurus, kurus, username]);
}

async function bakiye(username = 'demo_user') {
  return (await dbAsync.get('SELECT balance_kurus FROM users WHERE username = ?', [username])).balance_kurus;
}

test.before(async () => {
  await initDatabase();
  mockServer = await sahteSaglayiciKur();
  baseUrl = `http://127.0.0.1:${mockServer.address().port}/api/v1`;
  const ilk = request.agent(app);
  await ilk.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  await ilk.post('/api/admin/change-password').send({ current_password: 'admin12345', new_password: ADMIN_PASSWORD });
  admin = await giris('admin', ADMIN_PASSWORD);
  musteri = await giris('demo_user', 'user12345');
});

test.after(async () => {
  await new Promise(resolve => mockServer.close(resolve));
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('sağlayıcı yalnızca bağlantı testi geçerse eklenir ve anahtar şifreli saklanır', async () => {
  const kotu = await admin.post('/api/admin/digital/providers').send({ name: 'Hesapçı', api_url: baseUrl, api_key: 'yanlis-anahtar' });
  assert.equal(kotu.status, 400);
  assert.match(kotu.body.error, /bağlanılamadı/i);

  const res = await admin.post('/api/admin/digital/providers').send({ name: 'Hesapçı', api_url: `${baseUrl}/`, api_key: API_KEY });
  assert.equal(res.status, 201, res.body.error);
  ids.provider = res.body.id;
  const row = await dbAsync.get('SELECT * FROM digital_providers WHERE id = ?', [ids.provider]);
  assert.ok(!row.api_key_encrypted.includes(API_KEY), 'anahtar düz metin saklanmış');
  assert.equal(row.api_url, baseUrl, 'sondaki eğik çizgi temizlenmeli');
  assert.equal(row.balance, 125.4);

  const liste = await admin.get('/api/admin/digital/providers');
  assert.ok(!JSON.stringify(liste.body).includes(API_KEY), 'anahtar admin listesine sızıyor');
  assert.match(liste.body.providers[0].api_key_hint, /3456$/);

  const yetkisiz = await musteri.get('/api/admin/digital/providers');
  assert.equal(yetkisiz.status, 403);
});

test('katalog tüm sayfaları getirir; ürün tek tek eklenir ve ikinci kez eklenemez', async () => {
  const katalog = await admin.get(`/api/admin/digital/providers/${ids.provider}/catalog`);
  assert.equal(katalog.status, 200, katalog.body.error);
  assert.equal(katalog.body.products.length, 2, 'sayfalama birleştirilmedi');
  assert.equal(katalog.body.products[0].added_id, null);

  const ekle = await admin.post('/api/admin/digital/products').send({ provider_id: ids.provider, provider_product_id: '12', name: 'Gmail Hesap (7 gün)', price: 10 });
  assert.equal(ekle.status, 201, ekle.body.error);
  ids.gmail = ekle.body.id;
  const urun = await dbAsync.get('SELECT * FROM digital_products WHERE id = ?', [ids.gmail]);
  assert.equal(urun.price_kurus, 1000);
  assert.equal(urun.cost_rate, 0.2);
  assert.equal(urun.provider_slug, 'gmail-7-gun');
  assert.equal(urun.warranty_hours, 24);
  assert.equal(urun.description, 'Yeni açılmış hesap', 'açıklama sağlayıcıdan alınmalı');

  const tekrar = await admin.post('/api/admin/digital/products').send({ provider_id: ids.provider, provider_product_id: '12', name: 'x', price: 10 });
  assert.equal(tekrar.status, 409);

  const outlook = await admin.post('/api/admin/digital/products').send({ provider_id: ids.provider, provider_product_id: '13', name: 'Outlook Hesap', price: 5 });
  assert.equal(outlook.status, 201);
  ids.outlook = outlook.body.id;

  const yine = await admin.get(`/api/admin/digital/providers/${ids.provider}/catalog`);
  assert.equal(yine.body.products.find(p => p.provider_product_id === '12').added_id, ids.gmail);
});

test('/dijital-urunler sunucuda ürün kartlarıyla basılır ve indekslenebilir', async () => {
  const res = await request(app).get('/dijital-urunler');
  assert.equal(res.status, 200);
  assert.match(res.text, /Gmail Hesap \(7 gün\)/);
  assert.match(res.text, /data-dg-buy="\d+"/);
  assert.match(res.text, /<link rel="canonical" href="http:\/\/localhost:3000\/dijital-urunler">/);
  assert.ok(!/<meta name="robots"[^>]*noindex/.test(res.text), 'sayfa indekslenebilir olmalı');
  assert.equal((res.text.match(/<h1[\s>]/g) || []).length, 1, 'tek h1 olmalı');
  assert.ok(!res.text.includes('0.2'), 'sağlayıcı maliyeti sayfada görünmemeli');

  const anaSayfa = await request(app).get('/');
  assert.ok(!anaSayfa.text.includes('id="view-dijital-urunler"'), 'görünüm başka adreslere gönderilmemeli');

  const api = await request(app).get('/api/digital/products?lang=en');
  assert.equal(api.status, 200);
  const p = api.body.products.find(item => item.id === ids.gmail);
  assert.equal(p.price, 10);
  assert.equal(p.stock, 500);
  assert.equal(p.cost_rate, undefined, 'maliyet herkese açık uçta olmamalı');
  assert.equal(api.body.checker.enabled, false);

  const harita = await request(app).get('/sitemap.xml');
  assert.match(harita.text, /\/dijital-urunler</);

  // Istatistik kutusu: henuz satis yok -> "Satılan ürün" kutusu basilmaz.
  assert.ok(api.body.stats.users > 0, 'kullanıcı sayısı gelmeli');
  assert.equal(api.body.stats.products, 2);
  assert.equal(api.body.stats.stock, 503);
  assert.equal(api.body.stats.sold, 0);
  assert.match(res.text, /class="dg-stats"/);
  assert.match(res.text, /Kayıtlı kullanıcı/);
  assert.ok(!res.text.includes('Satılan ürün'), 'satış yokken 0 yazan kutu basılmamalı');
});

test('tanıtım alanı Hizmetler ve ana sayfada; menüde Dijital Ürünler Ana Sayfa\'nın yanında', async () => {
  for (const url of ['/', '/services']) {
    const html = (await request(app).get(url)).text;
    assert.match(html, /<a class="dg-promo[^"]*" href="\/dijital-urunler"/, `${url} sayfasında tanıtım alanı yok`);
  }
  const html = (await request(app).get('/services')).text;
  const menu = html.slice(html.indexOf('id="main-nav-links"'));
  const linkler = [...menu.matchAll(/class="nav-link[^"]*" href="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(linkler.slice(0, 3), ['/', '/dijital-urunler', '/services']);
});

test('satın alma: giriş, onay ve bakiye kontrolleri', async () => {
  const girissiz = await request(app).post('/api/digital/orders').send({ product_id: ids.gmail, quantity: 1, consent: true });
  assert.equal(girissiz.status, 401);

  const onaysiz = await musteri.post('/api/digital/orders').send({ product_id: ids.gmail, quantity: 1 });
  assert.equal(onaysiz.status, 400);

  await bakiyeAyarla(500);
  const yetersiz = await musteri.post('/api/digital/orders').send({ product_id: ids.gmail, quantity: 1, consent: true });
  assert.equal(yetersiz.status, 402);
  assert.equal(yetersiz.body.code, 'insufficient_balance');
  assert.equal(await bakiye(), 500);
  assert.equal((await dbAsync.get('SELECT COUNT(*) n FROM digital_orders')).n, 0);

  const sinirDisi = await musteri.post('/api/digital/orders').send({ product_id: ids.gmail, quantity: 101, consent: true });
  assert.equal(sinirDisi.status, 400);
});

test('anında teslim: bakiye düşer, hesaplar yalnızca sahibine görünür', async () => {
  await bakiyeAyarla(10000);
  sahte.buyMode = 'completed';
  const res = await musteri.post('/api/digital/orders').send({ product_id: ids.gmail, quantity: 3, consent: true });
  assert.equal(res.status, 201, res.body.error);
  assert.equal(res.body.order.status, 'completed');
  assert.equal(res.body.items.length, 3);
  assert.equal(res.body.items[0], 'mail1@example.com|s<i>fre&1', 'şifre karakterleri bozulmamalı');
  assert.equal(res.body.usage, 'Kullanım talimatları');
  assert.equal(await bakiye(), 7000);
  ids.order = res.body.order.id;

  const row = await dbAsync.get('SELECT * FROM digital_orders WHERE id = ?', [ids.order]);
  assert.ok(!row.items_encrypted.includes('mail1@example.com'), 'teslimat şifresiz saklanmış');
  assert.equal(row.provider_total, 0.6);
  assert.equal(row.provider_order_id, 'AL1');

  const liste = await musteri.get('/api/digital/orders');
  assert.equal(liste.body.orders[0].id, ids.order);
  assert.equal(liste.body.orders[0].items, undefined, 'liste ucu hesapları döndürmemeli');

  const detay = await musteri.get(`/api/digital/orders/${ids.order}`);
  assert.equal(detay.body.items.length, 3);

  const baska = await admin.get(`/api/digital/orders/${ids.order}`);
  assert.equal(baska.status, 404, 'başkasının siparişi açılmamalı');

  const stats = (await request(app).get('/api/digital/products')).body.stats;
  assert.equal(stats.sold, 3, 'teslim edilen adet satılan ürüne yansımalı');
  assert.match((await request(app).get('/dijital-urunler')).text, /Satılan ürün/);
});

test('hazırlanan sipariş işçiyle tamamlanır', async () => {
  sahte.buyMode = 'pending';
  const res = await musteri.post('/api/digital/orders').send({ product_id: ids.gmail, quantity: 2, consent: true });
  assert.equal(res.status, 201, res.body.error);
  assert.equal(res.body.order.status, 'processing');
  assert.deepEqual(res.body.items, []);
  const id = res.body.order.id;

  await Store.syncOpenOrders();
  assert.equal((await dbAsync.get('SELECT status FROM digital_orders WHERE id = ?', [id])).status, 'processing', 'sağlayıcı hâlâ pending');

  const providerId = (await dbAsync.get('SELECT provider_order_id FROM digital_orders WHERE id = ?', [id])).provider_order_id;
  sahte.orders.get(providerId).status = 'completed';
  await Store.syncOpenOrders();
  const detay = await musteri.get(`/api/digital/orders/${id}`);
  assert.equal(detay.body.order.status, 'completed');
  assert.equal(detay.body.items.length, 2);

  // Saglayici sonradan iptal ederse tamamlanmis siparise dokunulmaz.
  sahte.orders.get(providerId).status = 'refunded';
  await Store.syncOpenOrders();
  assert.equal((await dbAsync.get('SELECT status FROM digital_orders WHERE id = ?', [id])).status, 'completed');
});

test('sağlayıcı reddederse ya da yanıt vermezse tutar iade edilir', async () => {
  await bakiyeAyarla(5000);
  sahte.buyMode = 'reject';
  const red = await musteri.post('/api/digital/orders').send({ product_id: ids.gmail, quantity: 1, consent: true });
  assert.equal(red.status, 502);
  assert.equal(await bakiye(), 5000);
  const redRow = await dbAsync.get('SELECT * FROM digital_orders ORDER BY id DESC LIMIT 1');
  assert.equal(redRow.status, 'failed');
  assert.equal(redRow.refunded_kurus, 1000);
  assert.match(redRow.failure_reason, /Stok yetersiz/);

  sahte.buyMode = 'crash';
  const cokme = await musteri.post('/api/digital/orders').send({ product_id: ids.gmail, quantity: 1, consent: true });
  assert.equal(cokme.status, 502);
  assert.equal(await bakiye(), 5000);
  const cokmeRow = await dbAsync.get('SELECT * FROM digital_orders ORDER BY id DESC LIMIT 1');
  assert.match(cokmeRow.failure_reason, /^\[Belirsiz\]/, 'belirsiz hata işaretlenmeli');
  sahte.buyMode = 'completed';
});

test('stok yetmezse ya da maliyet satış fiyatını geçerse satış yapılmaz', async () => {
  await bakiyeAyarla(10000);
  const stok = await musteri.post('/api/digital/orders').send({ product_id: ids.outlook, quantity: 5, consent: true });
  assert.equal(stok.status, 409);
  assert.equal(stok.body.code, 'out_of_stock');

  // Saglayici fiyati 0.2 -> 0.5 USD (35 TL kurla 17,50 TL) > satis 10 TL.
  sahte.products[0].price = 0.5;
  const zarar = await musteri.post('/api/digital/orders').send({ product_id: ids.gmail, quantity: 1, consent: true });
  assert.equal(zarar.status, 409);
  assert.equal(await bakiye(), 10000);
  assert.equal((await dbAsync.get('SELECT cost_rate FROM digital_products WHERE id = ?', [ids.gmail])).cost_rate, 0.5, 'güncel maliyet kaydedilmeli');
  sahte.products[0].price = 0.2;
});

test('admin iadesi: kısmi ve tam', async () => {
  const once = await bakiye();
  const kismi = await admin.post(`/api/admin/digital/orders/${ids.order}/refund`).send({ amount: 10 });
  assert.equal(kismi.status, 200, kismi.body.error);
  assert.equal(await bakiye(), once + 1000);
  assert.equal((await dbAsync.get('SELECT status FROM digital_orders WHERE id = ?', [ids.order])).status, 'completed');

  const tam = await admin.post(`/api/admin/digital/orders/${ids.order}/refund`).send({});
  assert.equal(tam.status, 200);
  assert.equal(await bakiye(), once + 3000);
  assert.equal((await dbAsync.get('SELECT status FROM digital_orders WHERE id = ?', [ids.order])).status, 'refunded');

  const fazla = await admin.post(`/api/admin/digital/orders/${ids.order}/refund`).send({});
  assert.equal(fazla.status, 400);

  const detay = await admin.get(`/api/admin/digital/orders/${ids.order}`);
  assert.equal(detay.body.items.length, 3, 'admin teslimatı görebilmeli');
});

test('Gmail Checker: kapalıyken çalışmaz; açıkken sonuç dönmeyen adres iade edilir', async () => {
  const kapali = await musteri.post('/api/digital/check').send({ emails: 'a@gmail.com' });
  assert.equal(kapali.status, 503);

  const hatali = await admin.put('/api/admin/digital/checker').send({ enabled: true, price: 0, provider_id: ids.provider });
  assert.equal(hatali.status, 400, 'fiyatsız açılmamalı');
  const ayar = await admin.put('/api/admin/digital/checker').send({ enabled: true, price: 0.5, provider_id: ids.provider });
  assert.equal(ayar.status, 200, ayar.body.error);

  const katalog = await request(app).get('/api/digital/products');
  assert.equal(katalog.body.checker.enabled, true);
  assert.equal(katalog.body.checker.price, 0.5);

  await bakiyeAyarla(1000);
  sahte.checkFailOnce = true; // ilk istek 503: ayni request_id ile yinelenmeli
  const res = await musteri.post('/api/digital/check').send({ emails: 'A@gmail.com\nb@gmail.com, c@gmail.com\na@gmail.com\nbozuk-adres' });
  assert.equal(res.status, 201, res.body.error);
  assert.equal(res.body.requested, 3, 'tekrarlar ve bozuk adres ayıklanmalı');
  assert.equal(res.body.checked, 2);
  assert.equal(res.body.summary.live, 1);
  assert.equal(res.body.summary.notexists, 1);
  assert.equal(res.body.refunded, 0.5);
  assert.equal(await bakiye(), 900, '3 adres tahsil, 1 adres iade');

  const son = sahte.checks.slice(-2);
  assert.equal(son.length, 2);
  assert.equal(son[0].request_id, son[1].request_id, 'yeniden denemede aynı request_id kullanılmalı');
  assert.deepEqual(son[1].emails, ['a@gmail.com', 'b@gmail.com', 'c@gmail.com']);

  const gecmis = await musteri.get('/api/digital/checks');
  assert.equal(gecmis.body.checks.length, 1);
  const tekrar = await musteri.get(`/api/digital/checks/${gecmis.body.checks[0].id}`);
  assert.equal(tekrar.body.results.length, 2);
});

test('admin özeti ve ürün listesi kâr marjını hesaplar', async () => {
  const ozet = await admin.get('/api/admin/digital/overview');
  assert.equal(ozet.status, 200);
  assert.ok(ozet.body.orders.count >= 2);
  // Zarar testinde maliyet 0.5'e cikmisti; saglayicidan tazelenince 0.2'ye doner.
  const sync = await admin.post('/api/admin/digital/products/sync');
  assert.equal(sync.status, 200);
  const urunler = await admin.get('/api/admin/digital/products');
  const gmail = urunler.body.products.find(p => p.id === ids.gmail);
  assert.equal(gmail.cost_try, 7, '0.2 USD x 35');
  assert.equal(gmail.margin_percent, 42.9);

  // Siparisi olan urun silinmez, pasife alinir; katalogdan kalkar.
  const sil = await admin.delete(`/api/admin/digital/products/${ids.gmail}`);
  assert.equal(sil.body.disabled, true);
  const katalog = await request(app).get('/api/digital/products');
  assert.ok(!katalog.body.products.some(p => p.id === ids.gmail));
  const saglayiciSil = await admin.delete(`/api/admin/digital/providers/${ids.provider}`);
  assert.equal(saglayiciSil.status, 409, 'ürünü olan sağlayıcı silinmemeli');
});

test('ürün görseli galeriden seçilir, geçersiz görsel reddedilir; & işareti bozulmaz', async () => {
  const galeri = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'dijital-gorseller', 'gorseller.json'), 'utf8'));
  assert.ok(galeri.images.length >= 100, 'galeri boş');
  for (const img of galeri.images) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', img.file)), `${img.file} yok`);
  }

  const kotu = await admin.put(`/api/admin/digital/products/${ids.outlook}`).send({ image_url: '/uploads/baska.png' });
  assert.equal(kotu.status, 400);
  const yok = await admin.put(`/api/admin/digital/products/${ids.outlook}`).send({ image_url: '/dijital-gorseller/olmayan-9.webp' });
  assert.equal(yok.status, 400);

  const iyi = await admin.put(`/api/admin/digital/products/${ids.outlook}`).send({ image_url: '/dijital-gorseller/outlook-1.webp', name: 'Outlook & Hotmail' });
  assert.equal(iyi.status, 200, iyi.body.error);
  const row = await dbAsync.get('SELECT image_url, name FROM digital_products WHERE id = ?', [ids.outlook]);
  assert.equal(row.image_url, '/dijital-gorseller/outlook-1.webp');
  assert.equal(row.name, 'Outlook & Hotmail', '& işareti &amp; olarak saklanmamalı');

  const api = await request(app).get('/api/digital/products');
  assert.equal(api.body.products.find(p => p.id === ids.outlook).image, '/dijital-gorseller/outlook-1.webp');
  const sayfa = (await request(app).get('/dijital-urunler')).text;
  assert.match(sayfa, /src="\/dijital-gorseller\/outlook-1\.webp"/);
  assert.match(sayfa, /Outlook &amp; Hotmail/);
  assert.ok(!sayfa.includes('&amp;amp;'), 'çift kaçış olmamalı');
  assert.match(sayfa, /data-track-pid="\d+"/, 'ayak izi bağlamı kartta olmalı');

  const kaldir = await admin.put(`/api/admin/digital/products/${ids.outlook}`).send({ image_url: null });
  assert.equal(kaldir.status, 200);
  assert.equal((await dbAsync.get('SELECT image_url FROM digital_products WHERE id = ?', [ids.outlook])).image_url, null);
});
