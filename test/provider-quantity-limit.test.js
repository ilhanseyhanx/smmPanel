// Saglayici miktari reddederse ("Quantity less than minimal 100") musteri sunucu
// hatasi degil, net sinir gorur; servisin kayitli siniri saglayiciya uyar.
// Diger saglayici hatalari 424 doner (Cloudflare 502/504 govdesini kendi sayfasiyla
// degistirdigi icin mesaj kayboluyordu).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-miktar-siniri-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.ENABLE_DEMO_PAYMENTS = 'false';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');
const { providerQuantityLimit } = require('../utils/providerErrors');

const SmmProviderClient = require('../services/smmProvider');
let saglayiciYaniti = () => ({ order: 1 });
const giden = [];
SmmProviderClient.prototype.addOrder = async function (serviceId, link, quantity) {
  giden.push(quantity);
  return saglayiciYaniti(quantity);
};

const SIFRE = 'MiktarSiniriSifresi_2026';
let agent;
let kullaniciId;
let saglayiciId;
let kategoriId;

async function servis(extra = {}) {
  const s = { min: 1, max: 50000, overage: 0, ...extra };
  return (await dbAsync.run(
    `INSERT INTO services (category_id, provider_id, provider_service_id, name, name_tr, rate_per_1000, rate_per_1000_kurus,
       min_quantity, max_quantity, status, provider_overage_percent)
     VALUES (?, ?, '9001', 'Instagram Takipçi', 'Instagram Takipçi', 10, 1000, ?, ?, 1, ?)`,
    [kategoriId, saglayiciId, s.min, s.max, s.overage]
  )).id;
}
const siparis = (serviceId, quantity) => agent.post('/api/orders').send({ service_id: serviceId, link: 'https://instagram.com/kullaniciadi', quantity });
const bakiye = async () => (await dbAsync.get('SELECT balance_kurus FROM users WHERE id = ?', [kullaniciId])).balance_kurus;
const sinir = async id => dbAsync.get('SELECT min_quantity, max_quantity FROM services WHERE id = ?', [id]);

test.before(async () => {
  await initDatabase();
  await request(app).post('/api/auth/register').send({ username: 'miktar_musteri', email: 'miktar@site.com', password: SIFRE });
  kullaniciId = (await dbAsync.get('SELECT id FROM users WHERE username = ?', ['miktar_musteri'])).id;
  await dbAsync.run('UPDATE users SET balance_kurus = 1000000, balance = 10000 WHERE id = ?', [kullaniciId]);
  saglayiciId = (await dbAsync.run("INSERT INTO providers (name, api_url, api_key, status) VALUES ('Sinir Saglayici', 'https://saglayici.example.com/api/v2', 'gizli', 1)")).id;
  kategoriId = (await dbAsync.run("INSERT INTO categories (name, name_tr) VALUES ('Instagram Takipçi', 'Instagram Takipçi')")).id;
  agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'miktar_musteri', password: SIFRE });
});

test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('sağlayıcının miktar sınırı yaygın kalıplardan okunur, ilgisiz hatalar sınır sayılmaz', () => {
  assert.deepEqual(providerQuantityLimit('Quantity less than minimal 100'), { kind: 'min', value: 100 });
  assert.deepEqual(providerQuantityLimit('Quantity more than maximal 10 000'), { kind: 'max', value: 10000 });
  assert.deepEqual(providerQuantityLimit('Minimum quantity is 50'), { kind: 'min', value: 50 });
  assert.deepEqual(providerQuantityLimit('min quantity: 1,000'), { kind: 'min', value: 1000 });
  assert.deepEqual(providerQuantityLimit('Maximum quantity for this service is 5000'), { kind: 'max', value: 5000 });
  for (const m of ['Incorrect link', 'Not enough funds on balance', 'Request failed with status code 502', '']) assert.equal(providerQuantityLimit(m), null, m);
});

test('en az miktarın altında: net uyarı (400), iade, servisin en az miktarı sağlayıcıya uyar', async () => {
  const id = await servis({ min: 1 });
  saglayiciYaniti = () => ({ error: 'Quantity less than minimal 100' });
  const once = await bakiye();
  const res = await siparis(id, 10);
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Sipariş alınamadı: Bu serviste en az 100 adet sipariş verilebilir. Tutar bakiyenize iade edildi.');
  assert.match(res.body.error_en, /minimum of 100/);
  assert.equal(await bakiye(), once, 'tutar iade edildi');
  const order = await dbAsync.get('SELECT status, failure_reason FROM orders WHERE service_id = ? ORDER BY id DESC LIMIT 1', [id]);
  assert.equal(order.status, 'failed');
  assert.match(order.failure_reason, /Quantity less than minimal 100/);
  assert.equal((await sinir(id)).min_quantity, 100);

  // Ikinci deneme saglayiciya hic gitmeden sitede durdurulur.
  giden.length = 0;
  const tekrar = await siparis(id, 10);
  assert.equal(tekrar.status, 400);
  assert.match(tekrar.body.error, /Miktar 100 ile 50000 arasında/);
  assert.equal(giden.length, 0);
});

test('fazla gönderimli serviste sınır müşterinin gireceği miktara çevrilir', async () => {
  // %14 fazla gonderim: musteri 87 girince saglayiciya ceil(87 x 1,14) = 100 gider.
  const id = await servis({ min: 1, overage: 14 });
  saglayiciYaniti = quantity => (quantity < 100 ? { error: 'Quantity less than minimal 100' } : { order: 5 });
  const res = await siparis(id, 10);
  assert.equal(res.status, 400);
  assert.match(res.body.error, /en az 87 adet/);
  assert.equal((await sinir(id)).min_quantity, 87);
  saglayiciYaniti = () => ({ order: 6 });
  assert.equal((await siparis(id, 87)).status, 201, 'yeni en az miktar kabul edilir');
});

test('en fazla miktarın üstünde: net uyarı ve servisin en fazla miktarı düşer', async () => {
  const id = await servis({ min: 100, max: 50000 });
  saglayiciYaniti = () => ({ error: 'Quantity more than maximal 5000' });
  const res = await siparis(id, 6000);
  assert.equal(res.status, 400);
  assert.match(res.body.error, /en fazla 5\.000 adet/);
  assert.equal((await sinir(id)).max_quantity, 5000);
});

test('diğer sağlayıcı hataları 424 döner ve iade mesajı JSON olarak okunur', async () => {
  const id = await servis({ min: 10 });
  saglayiciYaniti = () => ({ error: 'Not enough funds on balance' });
  const once = await bakiye();
  const res = await siparis(id, 100);
  assert.equal(res.status, 424, 'Cloudflare 502 gövdesini değiştirir; 424 dokunulmadan geçer');
  assert.match(res.headers['content-type'], /application\/json/);
  assert.match(res.body.error, /^Sipariş alınamadı: .*Tutar bakiyenize iade edildi\.$/);
  assert.equal(await bakiye(), once);
  assert.equal((await sinir(id)).min_quantity, 10, 'miktar dışı hatada sınır değişmez');
});
