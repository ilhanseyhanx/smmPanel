// Pro: bayinin kendi SMM saglayicilari (services/tenantOwn.js). Saglayici
// taklit edilir; para musterinin bayi bakiyesinden duser, Jet bakiyesine
// dokunulmaz.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-kendi-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';
process.env.TENANT_BASE_DOMAIN = 'kendi.test';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');
const SmmProviderClient = require('../services/smmProvider');
const tenantOwn = require('../services/tenantOwn');

const SIFRE = 'KendiSaglayici_2026';
let admin;
let pro;
let musteri;
let saglayiciId;
let servisNo;

const saglayici = { kabul: true, gelen: [], durum: {} };
SmmProviderClient.prototype.getBalance = async function () {
  return this.apiKey === 'gecerli-anahtar-123' ? { balance: '42.50', currency: 'USD' } : { error: 'Invalid API key' };
};
SmmProviderClient.prototype.getServices = async () => [
  { service: 101, name: 'Instagram Takipçi (Kendi)', category: 'Instagram', type: 'Default', rate: '1.00', min: '100', max: '5000' },
  { service: 102, name: 'TikTok İzlenme (Kendi)', category: 'TikTok', type: 'Default', rate: '0.10', min: '1000', max: '100000' },
  { service: 103, name: 'Yorum', category: 'Instagram', type: 'Custom Comments', rate: '5', min: '1', max: '100' }
];
SmmProviderClient.prototype.addOrder = async (serviceId, link, quantity) => {
  saglayici.gelen.push({ serviceId, link, quantity });
  return saglayici.kabul ? { order: 7000 + saglayici.gelen.length } : { error: 'Not enough funds' };
};
SmmProviderClient.prototype.getMultiOrderStatus = async ids => Object.fromEntries(ids.map(id => [id, saglayici.durum[id] || { status: 'In progress' }]));

function site(host = 'kendisi.kendi.test', agent = request.agent(app)) {
  const call = method => url => agent[method](url).set('Host', host);
  return { get: call('get'), post: call('post'), put: call('put'), delete: call('delete') };
}
const api = body => request(app).post('/api/v2').set('Host', 'kendisi.kendi.test').send(body);
const bakiye = async id => (await dbAsync.get('SELECT balance_kurus FROM tenant_customers WHERE id = ?', [id])).balance_kurus;

async function bayiAc(username, slug, pkg) {
  await request(app).post('/api/auth/register').send({ username, email: `${username}@site.com`, password: SIFRE });
  const res = await admin.post('/api/admin/resellers').send({ owner: username, name: `${slug} SMM`, slug, package: pkg });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const panel = site(`${slug}.kendi.test`);
  assert.equal((await panel.post('/api/panel/login').send({ username, password: SIFRE })).status, 200);
  return { id: res.body.id, panel };
}

test.before(async () => {
  await initDatabase();
  await dbAsync.run("INSERT INTO site_settings (key, value) VALUES ('usd_try_rate', '40') ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  const ilk = request.agent(app);
  await ilk.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  await ilk.post('/api/admin/change-password').send({ current_password: 'admin12345', new_password: 'KendiAdmin_2026' });
  admin = request.agent(app);
  await admin.post('/api/auth/login').send({ username: 'admin', password: 'KendiAdmin_2026' });
  pro = await bayiAc('kendi_sahip', 'kendisi', 'pro');
  pro.ownerId = (await dbAsync.get("SELECT id FROM users WHERE username = 'kendi_sahip'")).id;
  await dbAsync.run('UPDATE users SET balance_kurus = 50000, balance = 500 WHERE id = ?', [pro.ownerId]);
  musteri = site();
  const kayit = await musteri.post('/api/auth/register').send({ username: 'kendi_musteri', email: 'kendi@musteri.com', password: SIFRE });
  musteri.id = kayit.body.customer.id;
  await dbAsync.run('UPDATE tenant_customers SET balance_kurus = 20000 WHERE id = ?', [musteri.id]);
});

test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Standart pakette kendi sağlayıcı eklenemez', async () => {
  const std = await bayiAc('std_kendi', 'standart1', 'standart');
  const res = await std.panel.post('/api/panel/own/providers').send({ name: 'Başka Panel', api_url: 'https://baska.example.com/api/v2', api_key: 'gecerli-anahtar-123' });
  assert.equal(res.status, 403);
  assert.deepEqual((await std.panel.get('/api/panel/own')).body, { pro: false, providers: [], services: [] });
});

test('Pro: sağlayıcı bağlanır (https ve geçerli anahtar şart), servisler kârla içe aktarılır', async () => {
  assert.equal((await pro.panel.post('/api/panel/own/providers').send({ name: 'Düz', api_url: 'http://baska.example.com/api/v2', api_key: 'gecerli-anahtar-123' })).status, 400);
  const yanlis = await pro.panel.post('/api/panel/own/providers').send({ name: 'Yanlış', api_url: 'https://baska.example.com/api/v2', api_key: 'yanlis-anahtar-999' });
  assert.equal(yanlis.status, 400);
  assert.match(yanlis.body.error, /Invalid API key/);
  const ekle = await pro.panel.post('/api/panel/own/providers').send({ name: 'Başka Panel', api_url: 'https://baska.example.com/api/v2', api_key: 'gecerli-anahtar-123' });
  assert.equal(ekle.status, 201, JSON.stringify(ekle.body));
  saglayiciId = ekle.body.provider.id;
  assert.equal(ekle.body.provider.balance, '42.50');
  assert.equal(JSON.stringify(ekle.body).includes('gecerli-anahtar'), false, 'anahtar geri gönderilmez');

  const liste = await pro.panel.get(`/api/panel/own/providers/${saglayiciId}/services`);
  assert.deepEqual(liste.body.services.map(s => s.service), ['101', '102'], 'yalnızca standart servisler');
  const al = await pro.panel.post(`/api/panel/own/providers/${saglayiciId}/import`).send({ service_ids: ['101', '102'], markup_percent: 50 });
  assert.equal(al.status, 200, JSON.stringify(al.body));
  assert.equal(al.body.added, 2);
  const servisler = (await pro.panel.get('/api/panel/own')).body.services;
  const takipci = servisler.find(s => s.provider_service_id === '101');
  assert.equal(takipci.rate, 60, '1 USD x 40 x 1,5');
  assert.ok(takipci.id >= tenantOwn.OWN_ID_BASE);
  servisNo = takipci.id;
});

test('vitrin ve API kendi servisini satar; para müşteriden düşer, Jet bakiyesine dokunulmaz; red olursa iade', async () => {
  const vitrin = (await site().get('/api/services')).body;
  const servis = vitrin.services.find(s => s.id === servisNo);
  assert.equal(servis.rate, 60);
  assert.ok(vitrin.categories.some(c => c.id === servis.category_id && c.name === 'Instagram'));

  const jetOnce = (await dbAsync.get('SELECT balance_kurus FROM users WHERE id = ?', [pro.ownerId])).balance_kurus;
  const siparis = await musteri.post('/api/orders').send({ service_id: servisNo, link: 'https://instagram.com/kendi', quantity: 1000 });
  assert.equal(siparis.status, 201, JSON.stringify(siparis.body));
  assert.ok(siparis.body.order.id >= tenantOwn.OWN_ID_BASE);
  assert.equal(siparis.body.order.charge, 60);
  assert.equal(await bakiye(musteri.id), 20000 - 6000);
  assert.equal((await dbAsync.get('SELECT balance_kurus FROM users WHERE id = ?', [pro.ownerId])).balance_kurus, jetOnce, 'Jet bakiyesi aynı');
  assert.deepEqual(saglayici.gelen.at(-1), { serviceId: '101', link: 'https://instagram.com/kendi', quantity: 1000 });
  assert.equal((await dbAsync.get('SELECT COUNT(*) AS n FROM orders')).n, 0, 'Jet sipariş tablosuna yazılmaz');

  const liste = (await musteri.get('/api/orders')).body.orders;
  assert.equal(liste[0].id, siparis.body.order.id);
  assert.equal(liste[0].status, 'processing');
  assert.equal((await musteri.post(`/api/orders/${siparis.body.order.id}/refill`)).status, 400);

  saglayici.kabul = false;
  const red = await musteri.post('/api/orders').send({ service_id: servisNo, link: 'https://instagram.com/kendi', quantity: 500 });
  saglayici.kabul = true;
  assert.equal(red.status, 502);
  assert.equal(await bakiye(musteri.id), 20000 - 6000, 'reddedilen tutar iade');
  assert.equal((await musteri.post('/api/orders').send({ service_id: servisNo, link: 'https://instagram.com/kendi', quantity: 50 })).status, 400, 'en az miktarın altı');
});

test('durum takibi: kısmi teslimde kalan kısım müşteriye iade edilir', async () => {
  const siparis = await dbAsync.get('SELECT * FROM tenant_own_orders WHERE status = ? ORDER BY id LIMIT 1', ['processing']);
  saglayici.durum[siparis.provider_order_id] = { status: 'Partial', remains: '500', start_count: '120' };
  const once = await bakiye(musteri.id);
  await tenantOwn.syncOwnOrders();
  const sonra = await dbAsync.get('SELECT * FROM tenant_own_orders WHERE id = ?', [siparis.id]);
  assert.equal(sonra.status, 'partial');
  assert.equal(sonra.refunded_kurus, 3000);
  assert.equal(await bakiye(musteri.id), once + 3000);
  await tenantOwn.syncOwnOrders();
  assert.equal(await bakiye(musteri.id), once + 3000, 'ikinci tur tekrar iade etmez');
});

test('müşteri API\'si kendi servisini listeler, sipariş alır, durum verir; telafi/iptal desteklenmez', async () => {
  const anahtar = (await musteri.post('/api/account/api-key')).body.key;
  const servisler = (await api({ key: anahtar, action: 'services' })).body;
  assert.equal(servisler.find(s => s.service === servisNo).rate, '60.00');
  const ekle = (await api({ key: anahtar, action: 'add', service: servisNo, link: 'https://instagram.com/api', quantity: 200 })).body;
  assert.ok(ekle.order >= tenantOwn.OWN_ID_BASE, JSON.stringify(ekle));
  const durum = (await api({ key: anahtar, action: 'status', order: ekle.order })).body;
  assert.deepEqual([durum.status, durum.charge], ['Processing', '12.00']);
  assert.deepEqual((await api({ key: anahtar, action: 'refill', order: ekle.order })).body, { error: 'Refill is not available for this service' });
  assert.deepEqual((await api({ key: anahtar, action: 'cancel', orders: String(ekle.order) })).body,
    [{ order: ekle.order, cancel: { error: 'Cancel is not available for this service' } }]);
  assert.equal((await api({ key: anahtar, action: 'add', service: servisNo, link: 'https://instagram.com/api', quantity: 200, runs: 3, interval: 10 })).body.error, 'Drip-feed is not available for this service');
});

test('açık siparişi olan sağlayıcı silinmez; Standart\'a inince kendi servisleri gizlenir', async () => {
  const sil = await pro.panel.delete(`/api/panel/own/providers/${saglayiciId}`);
  assert.equal(sil.status, 409);
  const paneldeki = (await pro.panel.get('/api/panel/own/orders')).body;
  assert.ok(paneldeki.total >= 2);
  assert.ok(paneldeki.orders.every(o => o.customer === 'kendi_musteri'));

  await admin.put(`/api/admin/resellers/${pro.id}`).send({ package: 'standart' });
  const vitrin = (await site().get('/api/services')).body;
  assert.equal(vitrin.services.some(s => s.id === servisNo), false);
  assert.equal((await musteri.post('/api/orders').send({ service_id: servisNo, link: 'https://instagram.com/kendi', quantity: 1000 })).status, 400);
  assert.equal(await dbAsync.get('SELECT COUNT(*) AS n FROM tenant_own_services WHERE tenant_id = ?', [pro.id]).then(r => r.n), 2, 'kayıtlar silinmez');
  await admin.put(`/api/admin/resellers/${pro.id}`).send({ package: 'pro' });
});
