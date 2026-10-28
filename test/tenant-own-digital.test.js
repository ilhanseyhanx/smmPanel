// Pro: bayinin kendi stoklu dijital urunleri (services/tenantOwnDigital.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-kendidijital-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';
process.env.TENANT_BASE_DOMAIN = 'stok.test';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');

const SIFRE = 'StokluUrun_2026';
let admin;
let pro;
let musteri;
let urunNo;

function site(host = 'stoklu.stok.test', agent = request.agent(app)) {
  const call = method => url => agent[method](url).set('Host', host);
  return { get: call('get'), post: call('post'), put: call('put'), delete: call('delete') };
}
const bakiye = async id => (await dbAsync.get('SELECT balance_kurus FROM tenant_customers WHERE id = ?', [id])).balance_kurus;

async function bayiAc(username, slug, pkg) {
  await request(app).post('/api/auth/register').send({ username, email: `${username}@site.com`, password: SIFRE });
  const res = await admin.post('/api/admin/resellers').send({ owner: username, name: `${slug} SMM`, slug, package: pkg });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const panel = site(`${slug}.stok.test`);
  assert.equal((await panel.post('/api/panel/login').send({ username, password: SIFRE })).status, 200);
  return { id: res.body.id, panel };
}

test.before(async () => {
  await initDatabase();
  const ilk = request.agent(app);
  await ilk.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  await ilk.post('/api/admin/change-password').send({ current_password: 'admin12345', new_password: 'StokAdmin_2026' });
  admin = request.agent(app);
  await admin.post('/api/auth/login').send({ username: 'admin', password: 'StokAdmin_2026' });
  pro = await bayiAc('stok_sahip', 'stoklu', 'pro');
  musteri = site();
  const kayit = await musteri.post('/api/auth/register').send({ username: 'stok_musteri', email: 'stok@musteri.com', password: SIFRE });
  musteri.id = kayit.body.customer.id;
  await dbAsync.run('UPDATE tenant_customers SET balance_kurus = 10000 WHERE id = ?', [musteri.id]);
});

test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Standart pakette kendi dijital ürünü eklenemez', async () => {
  const std = await bayiAc('stok_std', 'stoksuz', 'standart');
  assert.equal((await std.panel.post('/api/panel/digital/own').send({ name: 'Hesap', price: 10 })).status, 403);
  assert.deepEqual((await std.panel.get('/api/panel/digital/own')).body, { pro: false, products: [] });
});

test('Pro: ürün eklenir, stok satır satır yüklenir, vitrinde stok sayısıyla görünür', async () => {
  const ekle = await pro.panel.post('/api/panel/digital/own').send({
    name: 'Netflix Hesap', category: 'Abonelik', price: 25, item_format: 'email|şifre', usage_note: 'Profili değiştirme.', min_quantity: 1, max_quantity: 5
  });
  assert.equal(ekle.status, 201, JSON.stringify(ekle.body));
  const urun = (await pro.panel.get('/api/panel/digital/own')).body.products[0];
  const stok = await pro.panel.post(`/api/panel/digital/own/${urun.local_id}/stock`).send({ items: 'a1@mail.com|S1\n\n a2@mail.com|S2 \na3@mail.com|S3' });
  assert.equal(stok.body.added, 3);
  const vitrin = (await site().get('/api/digital/products')).body.products.find(p => p.name === 'Netflix Hesap');
  assert.equal(vitrin.stock, 3);
  assert.equal(vitrin.price, 25);
  assert.ok(vitrin.id >= 50_000_000);
  urunNo = vitrin.id;
  assert.equal((await site().get('/api/site')).body.digital, true);
  const ham = await dbAsync.get('SELECT item_encrypted FROM tenant_own_product_items LIMIT 1');
  assert.doesNotMatch(ham.item_encrypted, /a1@mail\.com/, 'stok şifreli saklanır');
});

test('satın alma: bakiye düşer, kayıtlar alıcıya teslim edilir ve bir daha satılmaz; stok yetmezse düşmez', async () => {
  const al = await musteri.post('/api/digital/orders').send({ product_id: urunNo, quantity: 2, consent: true });
  assert.equal(al.status, 201, JSON.stringify(al.body));
  assert.deepEqual(al.body.items, ['a1@mail.com|S1', 'a2@mail.com|S2']);
  assert.equal(al.body.usage, 'Profili değiştirme.');
  assert.equal(al.body.order.status, 'completed');
  assert.equal(al.body.balance, 50);
  assert.equal(await bakiye(musteri.id), 5000);

  const fazla = await musteri.post('/api/digital/orders').send({ product_id: urunNo, quantity: 2, consent: true });
  assert.equal(fazla.status, 409);
  assert.equal(await bakiye(musteri.id), 5000, 'stok yetmeyince para düşmez');

  const liste = (await musteri.get('/api/digital/orders')).body.orders;
  assert.equal(liste[0].id, al.body.order.id);
  const detay = (await musteri.get(`/api/digital/orders/${al.body.order.id}`)).body;
  assert.deepEqual(detay.items, ['a1@mail.com|S1', 'a2@mail.com|S2']);
  const baska = site();
  await baska.post('/api/auth/register').send({ username: 'stok_baska', email: 'baska@musteri.com', password: SIFRE });
  assert.equal((await baska.get(`/api/digital/orders/${al.body.order.id}`)).status, 404, 'başkası göremez');

  const panelUrun = (await pro.panel.get('/api/panel/digital/own')).body.products[0];
  assert.deepEqual([panelUrun.stock, panelUrun.sold], [1, 2]);
  const satislar = (await pro.panel.get('/api/panel/digital/orders')).body.orders;
  assert.equal(satislar[0].profit, 50);
});

test('Standart\'a inince kendi ürünleri vitrinden kalkar', async () => {
  await admin.put(`/api/admin/resellers/${pro.id}`).send({ package: 'standart' });
  assert.equal((await site().get('/api/digital/products')).body.products.some(p => p.id === urunNo), false);
  assert.equal((await musteri.post('/api/digital/orders').send({ product_id: urunNo, quantity: 1, consent: true })).status, 404);
  await admin.put(`/api/admin/resellers/${pro.id}`).send({ package: 'pro' });
});
