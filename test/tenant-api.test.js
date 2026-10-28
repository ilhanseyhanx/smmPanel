// F6: bayi musterisi API'si (bayi.com/api/v2) ve bayi e-postalari.
// Saglayici ve e-posta gonderimi taklit edilir.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-bayiapi-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';
process.env.TENANT_BASE_DOMAIN = 'api.test';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');
const mailer = require('../services/mailer');
const tenantMail = require('../services/tenantMail');
const SmmProviderClient = require('../services/smmProvider');

const SIFRE = 'BayiApiSifresi_2026';
const HOST = 'apici.api.test';
let admin;
let panel;
let sahipId;
let servisId;
let musteri;
let anahtar;

let saglayiciNo = 700000;
SmmProviderClient.prototype.addOrder = async () => ({ order: ++saglayiciNo });
SmmProviderClient.prototype.requestRefill = async () => ({ refill: 91 });
SmmProviderClient.prototype.cancelOrders = async ids => ids.map(id => ({ order: id, cancel: 1 }));

const giden = [];
mailer.sendMail = async options => { giden.push(options); return true; };
const bekle = () => new Promise(resolve => setTimeout(resolve, 60));

function site(host = HOST, agent = request.agent(app)) {
  const call = method => url => agent[method](url).set('Host', host);
  return { get: call('get'), post: call('post'), put: call('put') };
}
const api = (body, host = HOST) => request(app).post('/api/v2').set('Host', host).send(body);
const bakiye = async id => (await dbAsync.get('SELECT balance_kurus FROM tenant_customers WHERE id = ?', [id])).balance_kurus;
const sahipBakiye = async () => (await dbAsync.get('SELECT balance_kurus FROM users WHERE id = ?', [sahipId])).balance_kurus;

async function bayiAc(username, slug) {
  await request(app).post('/api/auth/register').send({ username, email: `${username}@site.com`, password: SIFRE });
  const id = (await dbAsync.get('SELECT id FROM users WHERE username = ?', [username])).id;
  await admin.post('/api/admin/resellers').send({ owner: username, name: `${slug} SMM`, slug });
  return id;
}

test.before(async () => {
  await initDatabase();
  const ilk = request.agent(app);
  await ilk.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  await ilk.post('/api/admin/change-password').send({ current_password: 'admin12345', new_password: 'BayiApiAdmin_2026' });
  admin = request.agent(app);
  await admin.post('/api/auth/login').send({ username: 'admin', password: 'BayiApiAdmin_2026' });
  const saglayici = (await dbAsync.run("INSERT INTO providers (name, api_url, api_key, status) VALUES ('Api Test', 'https://saglayici.example.com/api/v2', 'gizli', 1)")).id;
  const kategori = (await dbAsync.run("INSERT INTO categories (name, name_tr, name_en) VALUES ('Api Test', 'Api Test', 'Api Test')")).id;
  // 1000 adet = 10,00 TL -> bayi alisi 9,00 -> musteri %30 karla 11,70
  servisId = (await dbAsync.run(
    `INSERT INTO services (category_id, provider_id, provider_service_id, name, name_tr, rate_per_1000, rate_per_1000_kurus,
       min_quantity, max_quantity, status, refill, provider_cancel)
     VALUES (?, ?, '9001', 'Instagram Takipçi', 'Instagram Takipçi', 10, 1000, 100, 100000, 1, 1, 1)`, [kategori, saglayici])).id;
  sahipId = await bayiAc('apici_sahip', 'apici');
  await dbAsync.run('UPDATE users SET balance_kurus = 100000, balance = 1000 WHERE id = ?', [sahipId]);
  panel = site();
  assert.equal((await panel.post('/api/panel/login').send({ username: 'apici_sahip', password: SIFRE })).status, 200);
  musteri = site();
  const kayit = await musteri.post('/api/auth/register').send({ username: 'api_musteri', email: 'api@musteri.com', password: SIFRE });
  musteri.id = kayit.body.customer.id;
  await dbAsync.run('UPDATE tenant_customers SET balance_kurus = 5000 WHERE id = ?', [musteri.id]);
});

test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('kayıt olan müşteriye bayinin adıyla hoş geldin e-postası gider', async () => {
  await bekle();
  const hosgeldin = giden.find(m => m.to === 'api@musteri.com');
  assert.ok(hosgeldin, 'hoş geldin e-postası');
  assert.equal(hosgeldin.fromName, 'apici SMM');
  assert.match(hosgeldin.subject, /apici SMM hesabın hazır/);
  assert.match(hosgeldin.text, /https:\/\/apici\.api\.test\/bakiye/);
  assert.doesNotMatch(hosgeldin.text, /Jet/);
});

test('müşteri API anahtarı oluşturur; anahtar yalnızca bu sitede ve yalnızca bu müşteri için geçer', async () => {
  assert.equal((await musteri.get('/api/account/api-key')).body.key, null);
  const yeni = await musteri.post('/api/account/api-key');
  assert.equal(yeni.status, 200);
  anahtar = yeni.body.key;
  assert.match(anahtar, /^[a-f0-9]{48}$/);
  assert.equal((await musteri.get('/api/account/api-key')).body.key, anahtar);

  assert.deepEqual((await api({ key: 'yanlis', action: 'balance' })).body, { error: 'Invalid API Key' });
  assert.deepEqual((await api({ key: anahtar, action: 'balance' })).body, { balance: '50.00', currency: 'TRY' });
  // Paneller cogunlukla form verisi gonderir.
  const form = await request(app).post('/api/v2').set('Host', HOST).type('form').send({ key: anahtar, action: 'balance' });
  assert.deepEqual(form.body, { balance: '50.00', currency: 'TRY' });
  assert.deepEqual((await api({ key: anahtar, action: 'uydurma' })).body, { error: 'Invalid action' });
  // Baska bayinin sitesinde ayni anahtar gecmez.
  await bayiAc('baska_sahip', 'baskasi');
  assert.deepEqual((await api({ key: anahtar, action: 'balance' }, 'baskasi.api.test')).body, { error: 'Invalid API Key' });
  // Jet'in API'si bayi musterisinin anahtarini tanimaz.
  assert.deepEqual((await request(app).post('/api/v2').send({ key: anahtar, action: 'balance' })).body, { error: 'Invalid API Key' });
});

test('services bayinin satış fiyatını verir; add sipariş açar, iki taraftan doğru tutar düşer; status yalnızca kendi siparişi', async () => {
  const servisler = (await api({ key: anahtar, action: 'services' })).body;
  const servis = servisler.find(s => s.service === servisId);
  assert.equal(servis.rate, '11.70');
  assert.equal(servis.refill, true);
  assert.equal(servis.category, 'Api Test');

  const onceSahip = await sahipBakiye();
  const ekle = await api({ key: anahtar, action: 'add', service: servisId, link: 'https://instagram.com/api_musteri', quantity: 1000 });
  assert.ok(Number.isInteger(ekle.body.order), JSON.stringify(ekle.body));
  assert.equal(await bakiye(musteri.id), 5000 - 1170);
  assert.equal(await sahipBakiye(), onceSahip - 900);
  const durum = (await api({ key: anahtar, action: 'status', order: ekle.body.order })).body;
  assert.equal(durum.charge, '11.70');
  assert.equal(durum.currency, 'TRY');
  const coklu = (await api({ key: anahtar, action: 'status', orders: `${ekle.body.order},999999` })).body;
  assert.equal(coklu['999999'].error, 'Incorrect order ID');

  assert.deepEqual((await api({ key: anahtar, action: 'add', service: 999999, link: 'https://x.com/a', quantity: 1000 })).body, { error: 'This service is currently unavailable.' });
  assert.equal((await api({ key: anahtar, action: 'add', service: servisId, link: 'https://instagram.com/a', quantity: 'cok' })).body.error, 'Invalid parameters');

  // Ikinci musteri ilk musterinin siparisini goremez, iptal edemez.
  const ikinci = site();
  await ikinci.post('/api/auth/register').send({ username: 'api_ikinci', email: 'ikinci@musteri.com', password: SIFRE });
  const ikinciAnahtar = (await ikinci.post('/api/account/api-key')).body.key;
  assert.deepEqual((await api({ key: ikinciAnahtar, action: 'status', order: ekle.body.order })).body, { error: 'Order not found' });
  assert.deepEqual((await api({ key: ikinciAnahtar, action: 'cancel', orders: String(ekle.body.order) })).body,
    [{ order: ekle.body.order, cancel: { error: 'Incorrect order ID' } }]);
  assert.deepEqual((await api({ key: ikinciAnahtar, action: 'refill', order: ekle.body.order })).body, { error: 'Incorrect order ID' });

  // Kendi siparisinde telafi ve iptal.
  await dbAsync.run("UPDATE orders SET status = 'completed' WHERE id = ?", [ekle.body.order]);
  const telafi = (await api({ key: anahtar, action: 'refill', order: ekle.body.order })).body;
  assert.ok(Number.isInteger(telafi.refill), JSON.stringify(telafi));
  const telafiDurum = (await api({ key: anahtar, action: 'refill_status', refill: telafi.refill })).body;
  assert.ok(telafiDurum.status);
  assert.deepEqual((await api({ key: ikinciAnahtar, action: 'refill_status', refill: telafi.refill })).body, { error: 'Refill not found' });

  const ikinciSiparis = await api({ key: anahtar, action: 'add', service: servisId, link: 'https://instagram.com/api_musteri', quantity: 500 });
  const iptal = (await api({ key: anahtar, action: 'cancel', orders: String(ikinciSiparis.body.order) })).body;
  assert.deepEqual(iptal, [{ order: ikinciSiparis.body.order, cancel: 1 }]);
});

test('bayi API\'yi kapatınca anahtarlar çalışmaz ve vitrinde anahtar gösterilmez', async () => {
  const ayar = await panel.get('/api/panel/api-settings');
  assert.equal(ayar.body.enabled, true);
  assert.equal(ayar.body.url, 'http://apici.api.test/api/v2');
  assert.equal((await panel.put('/api/panel/api-settings').send({ enabled: false })).status, 200);
  assert.deepEqual((await api({ key: anahtar, action: 'balance' })).body, { error: 'API is disabled' });
  assert.equal((await musteri.get('/api/account/api-key')).status, 404);
  assert.equal((await site().get('/api/site')).body.api, false);
  assert.equal((await panel.put('/api/panel/api-settings').send({ enabled: true })).status, 200);
  assert.equal((await api({ key: anahtar, action: 'balance' })).body.currency, 'TRY');
});

test('havale bildirimi bayiye, onaylanan ödeme müşteriye e-posta olarak gider', async () => {
  await panel.put('/api/panel/payment-settings/bank').send({ enabled: true, accounts: 'Ziraat · TR00 0000 (test)' });
  giden.length = 0;
  const bildirim = await musteri.post('/api/payments/bank').send({ amount: 150, bank_name: 'Ziraat', sender_name: 'Api Müşteri' });
  assert.equal(bildirim.status, 201, JSON.stringify(bildirim.body));
  await bekle();
  const bayiye = giden.find(m => m.to === 'apici_sahip@site.com');
  assert.ok(bayiye, 'bayiye havale e-postası');
  assert.match(bayiye.subject, /Yeni havale bildirimi · apici SMM/);
  assert.match(bayiye.text, /₺150,00/);
  assert.match(bayiye.text, /https:\/\/apici\.api\.test\/admin\/payments/);

  giden.length = 0;
  assert.equal((await panel.post(`/api/panel/payments/${bildirim.body.payment_id}/approve`)).status, 200);
  await bekle();
  const musteriye = giden.find(m => m.to === 'api@musteri.com');
  assert.ok(musteriye, 'müşteriye ödeme e-postası');
  assert.equal(musteriye.fromName, 'apici SMM');
  assert.match(musteriye.subject, /₺150,00 bakiyene eklendi/);
  const kayit = await panel.get('/api/panel/mail');
  assert.ok(kayit.body.log.some(l => l.kind === 'payment' && l.status === 'sent'));
});

test('sipariş bitti e-postası yalnızca bayi açtıysa gider; tercih kapatılınca hoş geldin de gitmez', async () => {
  const siparis = await dbAsync.get('SELECT id FROM orders WHERE tenant_customer_id = ? ORDER BY id LIMIT 1', [musteri.id]);
  giden.length = 0;
  assert.equal(await tenantMail.orderFinished(siparis.id), false, 'varsayılan kapalı');
  const kayit = await panel.put('/api/panel/mail').send({ notify: { welcome: false, payment: true, order: true } });
  assert.equal(kayit.status, 200, JSON.stringify(kayit.body));
  assert.equal(await tenantMail.orderFinished(siparis.id), true);
  assert.match(giden[0].subject, new RegExp(`#${siparis.id} siparişin tamamlandı`));
  assert.match(giden[0].text, /Instagram Takipçi/);

  giden.length = 0;
  await site().post('/api/auth/register').send({ username: 'sessiz', email: 'sessiz@musteri.com', password: SIFRE });
  await bekle();
  assert.equal(giden.length, 0);
});

test('bayinin Jet bakiyesi yetmeyince bayiye e-posta gider, 12 saatte bir kez', async () => {
  await dbAsync.run('UPDATE users SET balance_kurus = 0, balance = 0 WHERE id = ?', [sahipId]);
  giden.length = 0;
  for (let i = 0; i < 2; i++) {
    const res = await musteri.post('/api/orders').send({ service_id: servisId, link: 'https://instagram.com/api_musteri', quantity: 1000 });
    assert.equal(res.status, 503);
    await bekle();
  }
  const uyarilar = giden.filter(m => m.to === 'apici_sahip@site.com' && /Jet bakiyen yetmediği/.test(m.subject));
  assert.equal(uyarilar.length, 1);
  assert.match(uyarilar[0].text, /₺9,00/);
  await dbAsync.run('UPDATE users SET balance_kurus = 100000, balance = 1000 WHERE id = ?', [sahipId]);
});

test('bayinin SMTP\'si: özel ağ ve uygunsuz port reddedilir, parola geri gönderilmez', async () => {
  const yerel = await panel.put('/api/panel/mail').send({ smtp: { host: '127.0.0.1', port: 587, user: 'a', password: 'b', from: 'a@b.com' } });
  assert.equal(yerel.status, 400);
  assert.match(yerel.body.error, /Özel ağ/);
  const port = await panel.put('/api/panel/mail').send({ smtp: { host: 'smtp.example.com', port: 6379, user: 'a', password: 'b', from: 'a@b.com' } });
  assert.equal(port.status, 400);
  assert.match(port.body.error, /port/);
  const ayar = await panel.get('/api/panel/mail');
  assert.equal(ayar.body.smtp.active, false);
  assert.equal(ayar.body.smtp.has_password, false);
  assert.equal(ayar.body.owner_email, 'apici_sahip@site.com');
  assert.doesNotMatch(JSON.stringify(ayar.body), /smtp_pass/);
});
