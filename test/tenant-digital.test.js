// Bayi sitesinde dijital urunler (F5). Saglayici taklit edilir.
// Fiyat: Jet 12,50 TL -> bayi alisi %10 indirimle 11,25 -> musteri %30 karla 14,63.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-bayidijital-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';
process.env.TENANT_BASE_DOMAIN = 'dijital.test';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');
const { encryptSecret } = require('../utils/security');
const { DigitalProviderClient } = require('../services/digitalProvider');
const digitalStore = require('../services/digitalStore');

const SIFRE = 'BayiDijitalSifre_2026';
const HOST = 'hesapci.dijital.test';
let panel;
let musteri;
let sahipId;
let urunId;

let saglayici = { stock: 100, price: 0.1, fail: null };
let alimNo = 0;
DigitalProviderClient.prototype.getProduct = async () => ({ stock: saglayici.stock, price: saglayici.price });
DigitalProviderClient.prototype.buy = async (id, qty) => {
  if (saglayici.fail) { const err = new Error(saglayici.fail); err.definite = true; throw err; }
  alimNo += 1;
  return { order_id: `P${alimNo}`, status: 'completed', items: Array.from({ length: qty }, (_, i) => `hesap${alimNo}-${i}@mail.com|Sifre${i}`), total: 0.1 * qty, usage: 'Girişten sonra şifreyi değiştir.' };
};

function site(agent = request.agent(app)) {
  const call = method => url => agent[method](url).set('Host', HOST);
  return { get: call('get'), post: call('post'), put: call('put') };
}
const bakiye = async id => (await dbAsync.get('SELECT balance_kurus FROM tenant_customers WHERE id = ?', [id])).balance_kurus;
const sahipBakiye = async () => (await dbAsync.get('SELECT balance_kurus FROM users WHERE id = ?', [sahipId])).balance_kurus;
const setSahip = kurus => dbAsync.run('UPDATE users SET balance_kurus = ?, balance = ? WHERE id = ?', [kurus, kurus / 100, sahipId]);

test.before(async () => {
  await initDatabase();
  await dbAsync.run("INSERT INTO site_settings (key, value) VALUES ('usd_try_rate', '40') ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  const ilk = request.agent(app);
  await ilk.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  await ilk.post('/api/admin/change-password').send({ current_password: 'admin12345', new_password: 'BayiDijitalAdmin_2026' });
  const admin = request.agent(app);
  await admin.post('/api/auth/login').send({ username: 'admin', password: 'BayiDijitalAdmin_2026' });
  await request(app).post('/api/auth/register').send({ username: 'hesap_sahibi', email: 'hesap@site.com', password: SIFRE });
  sahipId = (await dbAsync.get("SELECT id FROM users WHERE username = 'hesap_sahibi'")).id;
  await admin.post('/api/admin/resellers').send({ owner: 'hesap_sahibi', name: 'Hesapçı SMM', slug: 'hesapci' });
  const pr = await dbAsync.run("INSERT INTO digital_providers (name, api_url, api_key_encrypted, currency) VALUES ('Test', 'https://saglayici.example.com/api/v1', ?, 'USD')", [encryptSecret('anahtar')]);
  urunId = (await dbAsync.run(
    `INSERT INTO digital_products (provider_id, provider_product_id, provider_slug, name, category, price_kurus, cost_rate, stock, min_quantity, max_quantity, item_format, delivery_time, warranty_hours, image_url)
     VALUES (?, '12', 'gmail', 'Gmail Hesap', 'E-posta', 1250, 0.1, 100, 1, 50, 'email|şifre', 'Anında', 24, '/dijital-gorseller/gmail-1.webp')`, [pr.id])).id;
  panel = site();
  assert.equal((await panel.post('/api/panel/login').send({ username: 'hesap_sahibi', password: SIFRE })).status, 200);
  musteri = site();
  const kayit = await musteri.post('/api/auth/register').send({ username: 'alici', email: 'alici@mail.com', password: SIFRE });
  musteri.id = kayit.body.customer.id;
});

test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('vitrin bayi fiyatını gösterir; Jet fiyatı ve maliyet sızmaz; menü bayrağı açık', async () => {
  const res = await site().get('/api/digital/products');
  assert.equal(res.status, 200);
  assert.equal(res.body.products.length, 1);
  const p = res.body.products[0];
  assert.equal(p.price, 14.63);
  assert.equal(p.image, '/dijital-gorseller/gmail-1.webp');
  assert.doesNotMatch(JSON.stringify(res.body), /12\.5|11\.25|cost|jet_price|provider/);
  assert.equal((await site().get('/api/site')).body.digital, true);
  assert.equal((await site().get('/dijital-gorseller/gmail-1.webp')).status, 200);
});

test('satın alma: müşteriden bayi fiyatı, bayiden alış fiyatı düşer; bilgiler yalnız alıcıya görünür', async () => {
  assert.equal((await site().post('/api/digital/orders').send({ product_id: urunId, quantity: 1, consent: true })).status, 401);
  const yetersiz = await musteri.post('/api/digital/orders').send({ product_id: urunId, quantity: 2, consent: true });
  assert.equal(yetersiz.status, 402);
  assert.equal((await musteri.post('/api/digital/orders').send({ product_id: urunId, quantity: 2 })).status, 400, 'onay şart');

  await dbAsync.run('UPDATE tenant_customers SET balance_kurus = 10000 WHERE id = ?', [musteri.id]);
  await setSahip(10000);
  const al = await musteri.post('/api/digital/orders').send({ product_id: urunId, quantity: 2, consent: true });
  assert.equal(al.status, 201, JSON.stringify(al.body));
  assert.equal(al.body.order.status, 'completed');
  assert.equal(al.body.order.charge, 29.26);
  assert.equal(al.body.items.length, 2);
  assert.equal(al.body.balance, 70.74);
  assert.equal(await bakiye(musteri.id), 10000 - 2926);
  assert.equal(await sahipBakiye(), 10000 - 2250);

  const liste = await musteri.get('/api/digital/orders');
  assert.equal(liste.body.orders[0].charge, 29.26);
  const detay = await musteri.get(`/api/digital/orders/${al.body.order.id}`);
  assert.equal(detay.body.items.length, 2);
  const baska = site();
  await baska.post('/api/auth/register').send({ username: 'baskasi', email: 'baskasi@mail.com', password: SIFRE });
  assert.equal((await baska.get(`/api/digital/orders/${al.body.order.id}`)).status, 404);
  const jetBildirim = await dbAsync.get("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND title LIKE 'Dijital ürün%'", [sahipId]);
  assert.equal(jetBildirim.n, 0, 'bayiye müşterisinin teslimatı için Jet bildirimi gitmez');
});

test('bayinin Jet bakiyesi yetmezse müşteriden de düşmez (tek işlem)', async () => {
  await setSahip(500);
  const once = await bakiye(musteri.id);
  const res = await musteri.post('/api/digital/orders').send({ product_id: urunId, quantity: 1, consent: true });
  assert.equal(res.status, 503);
  assert.doesNotMatch(res.body.error, /₺/, 'müşteri bayinin tutarını görmez');
  assert.equal(await bakiye(musteri.id), once);
  assert.equal(await sahipBakiye(), 500);
  const kayit = await dbAsync.get("SELECT action FROM tenant_activity_logs WHERE action = 'owner_balance_low' ORDER BY id DESC");
  assert.ok(kayit);
});

test('sağlayıcı hatasında iki tarafa iade; kısmi admin iadesi müşteriye oranlı yansır', async () => {
  await setSahip(10000);
  const onceM = await bakiye(musteri.id);
  saglayici.fail = 'Stok yok';
  const hata = await musteri.post('/api/digital/orders').send({ product_id: urunId, quantity: 1, consent: true });
  saglayici.fail = null;
  assert.equal(hata.status, 424);
  assert.equal(await bakiye(musteri.id), onceM);
  assert.equal(await sahipBakiye(), 10000);

  const al = await musteri.post('/api/digital/orders').send({ product_id: urunId, quantity: 2, consent: true });
  assert.equal(al.status, 201);
  const sonra = await bakiye(musteri.id);
  // Bayiye yarim iade (2250 kurusun 1125'i) -> musteriye 2926'nin yarisi.
  await digitalStore.adminRefund(al.body.order.id, 1125);
  assert.equal(await bakiye(musteri.id), sonra + 1463);
  const row = await dbAsync.get('SELECT tenant_refunded_kurus FROM digital_orders WHERE id = ?', [al.body.order.id]);
  assert.equal(row.tenant_refunded_kurus, 1463);
});

test('bayi paneli: alış/satış/kâr görünür; ürün kapatma, sabit fiyat, genel kapatma', async () => {
  const d = await panel.get('/api/panel/digital');
  assert.equal(d.status, 200);
  const p = d.body.products[0];
  assert.deepEqual([p.jet_price, p.cost, p.sell, p.profit], [12.5, 11.25, 14.63, 3.38]);

  assert.equal((await panel.put(`/api/panel/digital/products/${urunId}`).send({ fixed_price: 10 })).status, 400, 'alışın altında sabit fiyat olmaz');
  assert.equal((await panel.put(`/api/panel/digital/products/${urunId}`).send({ fixed_price: 19.9 })).status, 200);
  assert.equal((await site().get('/api/digital/products')).body.products[0].price, 19.9);
  assert.equal((await panel.put(`/api/panel/digital/products/${urunId}`).send({ enabled: false })).status, 200);
  assert.equal((await site().get('/api/digital/products')).body.products.length, 0);
  assert.equal((await site().get('/api/site')).body.digital, false);
  assert.equal((await panel.put(`/api/panel/digital/products/${urunId}`).send({ enabled: true, fixed_price: null })).status, 200);
  assert.equal(await dbAsync.get('SELECT 1 FROM tenant_digital_prices WHERE product_id = ?', [urunId]), undefined, 'varsayılana dönen satır silinir');

  assert.equal((await panel.put('/api/panel/digital/settings').send({ enabled: true, markup_percent: 50 })).status, 200);
  assert.equal((await site().get('/api/digital/products')).body.products[0].price, 16.88);
  assert.equal((await panel.put('/api/panel/digital/settings').send({ enabled: false })).status, 200);
  const kapali = await site().get('/api/digital/products');
  assert.deepEqual(kapali.body, { enabled: false, products: [] });
  assert.equal((await musteri.post('/api/digital/orders').send({ product_id: urunId, quantity: 1, consent: true })).status, 404);
  assert.equal((await panel.put('/api/panel/digital/settings').send({ enabled: true, markup_percent: null })).status, 200);

  const siparisler = await panel.get('/api/panel/digital/orders');
  assert.ok(siparisler.body.total >= 2);
  const ilk = siparisler.body.orders.find(o => o.refunded === 0 && o.status === 'completed');
  assert.equal(ilk.profit, 6.76);
});

test('sağlayıcı maliyeti bayinin alış fiyatına ulaşırsa ürün bayide gizlenir (Jet zarar etmez)', async () => {
  await dbAsync.run('UPDATE digital_products SET cost_rate = 0.3 WHERE id = ?', [urunId]); // 12 TL >= 11,25
  saglayici.price = 0.3;
  assert.equal((await site().get('/api/digital/products')).body.products.length, 0);
  const panelUrun = (await panel.get('/api/panel/digital')).body.products[0];
  assert.equal(panelUrun.below_cost, true);
  assert.equal((await musteri.post('/api/digital/orders').send({ product_id: urunId, quantity: 1, consent: true })).status, 404);
  await dbAsync.run('UPDATE digital_products SET cost_rate = 0.1 WHERE id = ?', [urunId]);
  saglayici.price = 0.1;
});
