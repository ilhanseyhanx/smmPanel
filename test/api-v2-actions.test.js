// Bayi API'si (Faz 0) duzeltmeleri: fiyat/kategori bicimi, kademeli gonderim,
// telafi (refill + refill_status), iptal (cancel), toplu durum hatalari ve
// durum iscisinin 100'luk parcalar halinde sormasi.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-apiv2-actions-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.ENABLE_DEMO_PAYMENTS = 'false';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');
const { checkPendingOrders } = require('../services/orderWorker');
const { checkOpenRefills } = require('../services/refills');

const SIFRE = 'ApiAksiyonSifresi_2026';
let apiKey;
let kullaniciId;
let saglayiciId;
let kategoriId;
let servisId;
let telafisizServisId;
let dijitalServisId;

// Saglayici taklidi: gercek HTTP istegi atilmaz, giden cagrilar kaydedilir.
const SmmProviderClient = require('../services/smmProvider');
const giden = { add: [], refill: [], refillStatus: [], cancel: [], status: [] };
let saglayiciSiparisNo = 700000;
let telafiYaniti = () => ({ refill: 9001 });
let telafiDurumu = () => ({ status: 'Pending' });
let iptalYaniti = ids => ids.map(id => ({ order: Number(id), cancel: 1 }));

SmmProviderClient.prototype.addOrder = async function (serviceId, link, quantity, options = {}) {
  giden.add.push({ serviceId, link, quantity, options });
  saglayiciSiparisNo += 1;
  return { order: saglayiciSiparisNo };
};
SmmProviderClient.prototype.requestRefill = async function (providerOrderId) {
  giden.refill.push(String(providerOrderId));
  return telafiYaniti(providerOrderId);
};
SmmProviderClient.prototype.getRefillStatus = async function (providerRefillId) {
  giden.refillStatus.push(String(providerRefillId));
  return telafiDurumu(providerRefillId);
};
SmmProviderClient.prototype.cancelOrders = async function (ids) {
  giden.cancel.push([...ids]);
  return iptalYaniti(ids);
};
SmmProviderClient.prototype.getMultiOrderStatus = async function (ids) {
  giden.status.push(ids.length);
  return {};
};

const v2 = body => request(app).post('/api/v2').send(body);

async function siparisVer(serviceId = servisId, extra = {}) {
  const res = await v2({
    key: apiKey, action: 'add', service: serviceId,
    link: 'https://instagram.com/kullaniciadi', quantity: 1000, ...extra
  });
  assert.ok(res.body.order, `sipariş oluşmadı: ${JSON.stringify(res.body)}`);
  return res.body.order;
}

async function bakiye() {
  return (await dbAsync.get('SELECT balance_kurus FROM users WHERE id = ?', [kullaniciId])).balance_kurus;
}

test.before(async () => {
  await initDatabase();
  await request(app).post('/api/auth/register')
    .send({ username: 'aksiyon_musteri', email: 'aksiyon@site.com', password: SIFRE });
  const user = await dbAsync.get('SELECT id, api_key FROM users WHERE username = ?', ['aksiyon_musteri']);
  kullaniciId = user.id;
  apiKey = user.api_key;
  await dbAsync.run('UPDATE users SET balance_kurus = 10000000, balance = 100000 WHERE id = ?', [kullaniciId]);

  saglayiciId = (await dbAsync.run(
    "INSERT INTO providers (name, api_url, api_key, status) VALUES ('Aksiyon Saglayici', 'https://saglayici.example.com/api/v2', 'gizli', 1)"
  )).id;
  kategoriId = (await dbAsync.run(
    "INSERT INTO categories (name, name_tr, name_en) VALUES ('Instagram Takipçi Test', 'Instagram Takipçi Test', 'Instagram Followers Test')"
  )).id;
  servisId = (await dbAsync.run(
    `INSERT INTO services (category_id, provider_id, provider_service_id, name, name_tr, rate_per_1000,
       rate_per_1000_kurus, min_quantity, max_quantity, status, refill, provider_cancel, provider_dripfeed)
     VALUES (?, ?, '8001', 'Instagram Takipçi Garantili', 'Instagram Takipçi Garantili', 12.5, 1250, 100, 50000, 1, 1, 1, 1)`,
    [kategoriId, saglayiciId]
  )).id;
  telafisizServisId = (await dbAsync.run(
    `INSERT INTO services (category_id, provider_id, provider_service_id, name, name_tr, rate_per_1000,
       rate_per_1000_kurus, min_quantity, max_quantity, status, refill)
     VALUES (?, ?, '8002', 'Instagram Takipçi Ekonomik', 'Instagram Takipçi Ekonomik', 5, 500, 100, 50000, 1, 0)`,
    [kategoriId, saglayiciId]
  )).id;
  dijitalServisId = (await dbAsync.run(
    `INSERT INTO services (category_id, provider_id, provider_service_id, name, name_tr, rate_per_1000,
       rate_per_1000_kurus, min_quantity, max_quantity, status, order_input_type, pricing_model)
     VALUES (?, ?, '8003', 'Windows License', 'Windows Lisansı', 50, 5000, 1, 10, 1, 'email_delivery', 'per_item')`,
    [kategoriId, saglayiciId]
  )).id;
});

test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test.beforeEach(() => {
  for (const liste of Object.values(giden)) liste.length = 0;
  telafiYaniti = () => ({ refill: 9001 });
  telafiDurumu = () => ({ status: 'Pending' });
  iptalYaniti = ids => ids.map(id => ({ order: Number(id), cancel: 1 }));
});

// ---------------------------------------------------------------
// services
// ---------------------------------------------------------------

test('services: kategori numara değil ad olarak döner (İngilizce öncelikli)', async () => {
  const res = await v2({ key: apiKey, action: 'services' });
  const servis = res.body.find(s => s.service === servisId);
  assert.equal(servis.category, 'Instagram Followers Test');
  assert.equal(typeof servis.category, 'string');
});

test('services: adet başı fiyatlı üründe rate 1000 adet fiyatına çevrilir', async () => {
  const res = await v2({ key: apiKey, action: 'services' });
  const dijital = res.body.find(s => s.service === dijitalServisId);
  // 50 TL/adet -> 1000 adet 50.000 TL. Bayi panelleri rate/1000 x adet hesaplar.
  assert.equal(dijital.rate, '50000.00');
  assert.equal(Number(dijital.rate) / 1000 * 2, 100, 'bayi paneli 2 adet için 100 TL hesaplamalı');
  const normal = res.body.find(s => s.service === servisId);
  assert.equal(normal.rate, '12.50', '1000 adet fiyatlı serviste rate değişmemeli');
});

test('services: refill / cancel / dripfeed bayrakları doğru döner', async () => {
  const res = await v2({ key: apiKey, action: 'services' });
  const servis = res.body.find(s => s.service === servisId);
  assert.equal(servis.refill, true);
  assert.equal(servis.cancel, true);
  assert.equal(servis.dripfeed, true);
  const telafisiz = res.body.find(s => s.service === telafisizServisId);
  assert.equal(telafisiz.refill, false);
  assert.equal(telafisiz.cancel, false);
  assert.equal(telafisiz.dripfeed, false);
  // E-posta teslimli urunde kademeli gonderim olamaz.
  assert.equal(res.body.find(s => s.service === dijitalServisId).dripfeed, false);
});

// ---------------------------------------------------------------
// Kimlik ve girdi saglamligi
// ---------------------------------------------------------------

test('metin olmayan anahtar 500 değil "Invalid API Key" döner', async () => {
  const res = await v2({ key: ['smm_x'], action: 'balance' });
  assert.equal(res.status, 200);
  assert.equal(res.body.error, 'Invalid API Key');
});

test('prototip adları komut sayılmaz', async () => {
  assert.equal((await v2({ key: apiKey, action: 'constructor' })).body.error, 'Invalid action');
});

// ---------------------------------------------------------------
// add: kademeli gonderim
// ---------------------------------------------------------------

test('add: runs / interval sağlayıcıya gider ve ücret tur sayısıyla çarpılır', async () => {
  const once = await bakiye();
  await siparisVer(servisId, { runs: 3, interval: 30 });
  assert.equal(giden.add.length, 1);
  assert.equal(giden.add[0].options.runs, 3);
  assert.equal(giden.add[0].options.interval, 30);
  assert.equal(once - await bakiye(), 1250 * 3, 'tur başına ücret x tur sayısı düşülmeli');
});

test('add: geçersiz runs / interval reddedilir, sağlayıcıya gitmez', async () => {
  const az = await v2({ key: apiKey, action: 'add', service: servisId, link: 'https://instagram.com/a', quantity: 1000, runs: 3, interval: 1 });
  assert.match(az.body.error, /interval/i);
  const cok = await v2({ key: apiKey, action: 'add', service: servisId, link: 'https://instagram.com/a', quantity: 1000, runs: 500, interval: 30 });
  assert.match(cok.body.error, /runs/i);
  assert.equal(giden.add.length, 0);
});

test('add: servis numarası yoksa açık hata döner', async () => {
  const res = await v2({ key: apiKey, action: 'add', link: 'https://instagram.com/a', quantity: 1000 });
  assert.equal(res.body.error, 'Incorrect service ID');
});

// ---------------------------------------------------------------
// status
// ---------------------------------------------------------------

test('status toplu: bulunamayan sipariş için hata satırı döner', async () => {
  const benim = await siparisVer();
  const res = await v2({ key: apiKey, action: 'status', orders: `${benim},99999999` });
  assert.equal(res.body[benim].status, 'Processing');
  assert.deepEqual(res.body['99999999'], { error: 'Incorrect order ID' });
});

// ---------------------------------------------------------------
// refill + refill_status
// ---------------------------------------------------------------

async function tamamlanmisSiparis(serviceId = servisId) {
  const id = await siparisVer(serviceId);
  await dbAsync.run("UPDATE orders SET status = 'completed' WHERE id = ?", [id]);
  return id;
}

test('refill: tamamlanan siparişte telafi sağlayıcıya iletilir ve numara döner', async () => {
  const siparis = await tamamlanmisSiparis();
  const res = await v2({ key: apiKey, action: 'refill', order: siparis });
  assert.ok(Number.isInteger(res.body.refill), JSON.stringify(res.body));
  assert.equal(giden.refill.length, 1);

  const kayit = await dbAsync.get('SELECT * FROM order_refills WHERE id = ?', [res.body.refill]);
  assert.equal(kayit.order_id, siparis);
  assert.equal(kayit.provider_refill_id, '9001');

  const durum = await v2({ key: apiKey, action: 'refill_status', refill: res.body.refill });
  assert.equal(durum.body.status, 'Pending');
});

test('refill: aktif telafi varken ikinci talep sağlayıcıya gitmez', async () => {
  const siparis = await tamamlanmisSiparis();
  assert.ok((await v2({ key: apiKey, action: 'refill', order: siparis })).body.refill);
  const ikinci = await v2({ key: apiKey, action: 'refill', order: siparis });
  assert.match(ikinci.body.error, /already active/i);
  assert.equal(giden.refill.length, 1);
});

test('refill: telafisiz servis, bitmemiş sipariş ve başkasının siparişi reddedilir', async () => {
  const telafisiz = await tamamlanmisSiparis(telafisizServisId);
  assert.match((await v2({ key: apiKey, action: 'refill', order: telafisiz })).body.error, /not available/i);
  const bitmemis = await siparisVer();
  assert.match((await v2({ key: apiKey, action: 'refill', order: bitmemis })).body.error, /completed/i);
  assert.equal((await v2({ key: apiKey, action: 'refill', order: 99999999 })).body.error, 'Incorrect order ID');
  assert.equal(giden.refill.length, 0);
});

test('refill: sağlayıcı reddederse sipariş kilitli kalmaz', async () => {
  const siparis = await tamamlanmisSiparis();
  telafiYaniti = () => ({ error: 'Refill is disabled for this service' });
  const res = await v2({ key: apiKey, action: 'refill', order: siparis });
  assert.match(res.body.error, /Refill is disabled/);
  const satir = await dbAsync.get('SELECT refill_status FROM orders WHERE id = ?', [siparis]);
  assert.notEqual(satir.refill_status, 'requested', 'başarısız talep siparişi kilitli bırakmış');
  telafiYaniti = () => ({ refill: 9002 });
  assert.ok((await v2({ key: apiKey, action: 'refill', order: siparis })).body.refill, 'yeniden denenemiyor');
});

test('refill toplu: her sipariş için ayrı sonuç döner', async () => {
  const iyi = await tamamlanmisSiparis();
  const kotu = await tamamlanmisSiparis(telafisizServisId);
  const res = await v2({ key: apiKey, action: 'refill', orders: `${iyi},${kotu}` });
  assert.ok(Array.isArray(res.body));
  assert.ok(Number.isInteger(res.body.find(r => r.order === iyi).refill));
  assert.ok(res.body.find(r => r.order === kotu).refill.error);
});

test('telafi takibi: sağlayıcı tamamlayınca durum güncellenir ve sipariş yeni telafiye açılır', async () => {
  const siparis = await tamamlanmisSiparis();
  const telafi = (await v2({ key: apiKey, action: 'refill', order: siparis })).body.refill;

  telafiDurumu = () => ({ status: 'Completed' });
  await checkOpenRefills();
  assert.ok(giden.refillStatus.includes('9001'), 'sağlayıcıya durum sorulmamış');

  const durum = await v2({ key: apiKey, action: 'refill_status', refills: `${telafi},99999999` });
  assert.deepEqual(durum.body, [
    { refill: telafi, status: 'Completed' },
    { refill: 99999999, status: { error: 'Refill not found' } }
  ]);
  const yeni = await v2({ key: apiKey, action: 'refill', order: siparis });
  assert.ok(yeni.body.refill, `tamamlanan telafiden sonra yeni talep açılamıyor: ${JSON.stringify(yeni.body)}`);
});

test('telafi takibi: numarasız ve eski talepler süresi dolunca kapanır', async () => {
  const siparis = await tamamlanmisSiparis();
  telafiYaniti = () => ({ status: 'ok' });
  const telafi = (await v2({ key: apiKey, action: 'refill', order: siparis })).body.refill;
  await dbAsync.run("UPDATE order_refills SET created_at = datetime('now', '-2 days') WHERE id = ?", [telafi]);
  await checkOpenRefills();
  const kayit = await dbAsync.get('SELECT status FROM order_refills WHERE id = ?', [telafi]);
  assert.equal(kayit.status, 'expired');
  const satir = await dbAsync.get('SELECT refill_status FROM orders WHERE id = ?', [siparis]);
  assert.equal(satir.refill_status, 'none');
});

test('panel telafi düğmesi de aynı akıştan geçer (ikinci talep 409)', async () => {
  const siparis = await tamamlanmisSiparis();
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'aksiyon_musteri', password: SIFRE });
  const ilk = await agent.post(`/api/orders/${siparis}/refill`);
  assert.equal(ilk.status, 200, JSON.stringify(ilk.body));
  assert.ok(ilk.body.refill);
  const ikinci = await agent.post(`/api/orders/${siparis}/refill`);
  assert.equal(ikinci.status, 409);
});

test('panel: sağlayıcı telafiyi reddederse gerçek sebep gösterilir', async () => {
  const siparis = await tamamlanmisSiparis();
  telafiYaniti = () => ({ error: 'Refill not allowed yet' });
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'aksiyon_musteri', password: SIFRE });
  const res = await agent.post(`/api/orders/${siparis}/refill`);
  assert.equal(res.status, 502);
  assert.match(res.body.error, /Refill not allowed yet/);
});

// ---------------------------------------------------------------
// cancel
// ---------------------------------------------------------------

test('cancel: işlemdeki sipariş için iptal talebi sağlayıcıya iletilir', async () => {
  const siparis = await siparisVer();
  const res = await v2({ key: apiKey, action: 'cancel', orders: `${siparis}` });
  assert.deepEqual(res.body, [{ order: siparis, cancel: 1 }]);
  assert.equal(giden.cancel.length, 1);
  const satir = await dbAsync.get('SELECT cancel_requested_at, status FROM orders WHERE id = ?', [siparis]);
  assert.ok(satir.cancel_requested_at, 'iptal talebi işaretlenmemiş');
  // Iade burada yapilmaz; saglayici iptal edince durum senkronu yapar.
  assert.equal(satir.status, 'processing');
});

test('cancel: tekrar talep, bilinmeyen ve bitmiş sipariş ayrı hatalar alır', async () => {
  const siparis = await siparisVer();
  await v2({ key: apiKey, action: 'cancel', orders: `${siparis}` });
  const biten = await tamamlanmisSiparis();
  giden.cancel.length = 0;
  const res = await v2({ key: apiKey, action: 'cancel', orders: `${siparis},${biten},99999999` });
  assert.deepEqual(res.body, [
    { order: siparis, cancel: { error: 'Cancel already requested' } },
    { order: biten, cancel: { error: 'This order cannot be canceled' } },
    { order: 99999999, cancel: { error: 'Incorrect order ID' } }
  ]);
  assert.equal(giden.cancel.length, 0, 'uygun olmayan siparişler sağlayıcıya gitmiş');
});

test('cancel: sağlayıcı reddederse hata döner ve işaret geri alınır', async () => {
  const siparis = await siparisVer();
  iptalYaniti = ids => ids.map(id => ({ order: Number(id), cancel: { error: 'Cancel is not available' } }));
  const res = await v2({ key: apiKey, action: 'cancel', orders: `${siparis}` });
  assert.deepEqual(res.body, [{ order: siparis, cancel: { error: 'Cancel is not available' } }]);
  const satir = await dbAsync.get('SELECT cancel_requested_at FROM orders WHERE id = ?', [siparis]);
  assert.equal(satir.cancel_requested_at, null);
});

test('cancel: başkasının siparişi iptal edilemez', async () => {
  await request(app).post('/api/auth/register')
    .send({ username: 'baska_aksiyon', email: 'baska_aksiyon@site.com', password: SIFRE });
  const baska = await dbAsync.get('SELECT api_key FROM users WHERE username = ?', ['baska_aksiyon']);
  const benim = await siparisVer();
  const res = await v2({ key: baska.api_key, action: 'cancel', orders: `${benim}` });
  assert.deepEqual(res.body, [{ order: benim, cancel: { error: 'Incorrect order ID' } }]);
  assert.equal(giden.cancel.length, 0);
});

// ---------------------------------------------------------------
// Durum iscisi
// ---------------------------------------------------------------

test('durum işçisi 100\'den fazla siparişi 100\'lük parçalarla sorar', async () => {
  const kolonlar = "user_id, service_id, provider_id, provider_order_id, link, quantity, charge, charge_kurus, status";
  for (let i = 0; i < 150; i++) {
    await dbAsync.run(
      `INSERT INTO orders (${kolonlar}) VALUES (?, ?, ?, ?, 'https://instagram.com/x', 100, 1.25, 125, 'processing')`,
      [kullaniciId, servisId, saglayiciId, 900000 + i]
    );
  }
  await checkPendingOrders();
  assert.ok(giden.status.length >= 2, `tek istekte sorulmuş: ${JSON.stringify(giden.status)}`);
  assert.ok(giden.status.every(n => n <= 100), `100'ü aşan istek var: ${JSON.stringify(giden.status)}`);
});

// ---------------------------------------------------------------
// Panel siparisinde saglayici reddi
// ---------------------------------------------------------------

test('panel: sağlayıcı siparişi reddedince müşteri iade mesajını görür', async () => {
  const eski = SmmProviderClient.prototype.addOrder;
  SmmProviderClient.prototype.addOrder = async () => ({ error: 'Invalid link' });
  try {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ username: 'aksiyon_musteri', password: SIFRE });
    const res = await agent.post('/api/orders').send({ service_id: servisId, link: 'https://instagram.com/kullaniciadi', quantity: 1000 });
    assert.equal(res.status, 502);
    assert.match(res.body.error, /iade edildi/, `genel hata mesajı gösterilmiş: ${res.body.error}`);
    assert.ok(res.body.error_en, 'İngilizce karşılık yok');
  } finally {
    SmmProviderClient.prototype.addOrder = eski;
  }
});

// ---------------------------------------------------------------
// Admin: saglayici listesinden cancel / dripfeed bayraklari
// ---------------------------------------------------------------

test('admin "sağlayıcı fiyatlarını güncelle" iptal ve kademeli gönderim desteğini de yazar', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  const degis = await agent.post('/api/admin/change-password').send({ current_password: 'admin12345', new_password: 'AksiyonAdminSifre_2026' });
  assert.equal(degis.status, 200, JSON.stringify(degis.body));
  const admin = request.agent(app);
  assert.equal((await admin.post('/api/auth/login').send({ username: 'admin', password: 'AksiyonAdminSifre_2026' })).status, 200);

  const eskiServisler = SmmProviderClient.prototype.getServices;
  const eskiBakiye = SmmProviderClient.prototype.getBalance;
  SmmProviderClient.prototype.getServices = async () => ([
    { service: '8001', name: 'Followers', category: 'Instagram', rate: '0.5', min: 100, max: 50000, refill: true, cancel: false, dripfeed: false },
    { service: '8002', name: 'Followers Eco', category: 'Instagram', rate: '0.2', min: 100, max: 50000, refill: false, cancel: true, dripfeed: true }
  ]);
  SmmProviderClient.prototype.getBalance = async () => ({ balance: '10', currency: 'USD' });
  try {
    const res = await admin.post('/api/admin/services/refresh-provider-prices');
    assert.equal(res.status, 200, JSON.stringify(res.body));
  } finally {
    SmmProviderClient.prototype.getServices = eskiServisler;
    SmmProviderClient.prototype.getBalance = eskiBakiye;
  }
  const garantili = await dbAsync.get('SELECT provider_cancel, provider_dripfeed FROM services WHERE id = ?', [servisId]);
  assert.deepEqual({ ...garantili }, { provider_cancel: 0, provider_dripfeed: 0 });
  const ekonomik = await dbAsync.get('SELECT provider_cancel, provider_dripfeed FROM services WHERE id = ?', [telafisizServisId]);
  assert.deepEqual({ ...ekonomik }, { provider_cancel: 1, provider_dripfeed: 1 });
});

test('form-encoded istekler (PHP bayi panellerinin çoğu) da çalışır', async () => {
  const form = body => request(app).post('/api/v2').type('form').send(body);
  const bakiyeYaniti = await form({ key: apiKey, action: 'balance' });
  assert.ok(bakiyeYaniti.body.balance, JSON.stringify(bakiyeYaniti.body));
  const eklendi = await form({
    key: apiKey, action: 'add', service: String(servisId),
    link: 'https://instagram.com/kullaniciadi', quantity: '1000', runs: '2', interval: '15'
  });
  assert.ok(eklendi.body.order, JSON.stringify(eklendi.body));
  assert.equal(giden.add[0].options.runs, 2);
  const durum = await form({ key: apiKey, action: 'status', orders: `${eklendi.body.order}` });
  assert.equal(durum.body[eklendi.body.order].status, 'Processing');
});
