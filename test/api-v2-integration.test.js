const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-apiv2-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.ENABLE_DEMO_PAYMENTS = 'false';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');

const SIFRE = 'ApiTestSifresi_2026';
let apiKey;
let servisId;
let kullaniciId;

// Saglayici cagrisini taklit et: gercek HTTP istegi atilmasin ama siparisin
// saglayiciya GERCEKTEN iletilip iletilmedigi olculebilsin.
const SmmProviderClient = require('../services/smmProvider');
let saglayiciyaGidenler = [];
let saglayiciKabulEtsin = true;
SmmProviderClient.prototype.addOrder = async function (providerServiceId, link, quantity) {
  saglayiciyaGidenler.push({ providerServiceId, link, quantity });
  if (!saglayiciKabulEtsin) return { error: 'Provider rejected' };
  return { order: 500000 + saglayiciyaGidenler.length };
};

test.before(async () => {
  await initDatabase();

  await request(app).post('/api/auth/register')
    .send({ username: 'api_musteri', email: 'api@site.com', password: SIFRE });
  const user = await dbAsync.get('SELECT id, api_key FROM users WHERE username = ?', ['api_musteri']);
  kullaniciId = user.id;
  apiKey = user.api_key;
  await dbAsync.run('UPDATE users SET balance_kurus = 500000, balance = 5000 WHERE id = ?', [kullaniciId]);

  // Saglayicisi olan gercek bir servis
  const saglayici = await dbAsync.run(
    "INSERT INTO providers (name, api_url, api_key, status) VALUES ('Test Saglayici', 'https://saglayici.example.com/api/v2', 'gizli', 1)"
  );
  const kategori = await dbAsync.get('SELECT id FROM categories LIMIT 1');
  const servis = await dbAsync.run(
    `INSERT INTO services (category_id, provider_id, provider_service_id, name, name_tr, rate_per_1000,
       rate_per_1000_kurus, min_quantity, max_quantity, status)
     VALUES (?, ?, '9001', 'Instagram Takipçi', 'Instagram Takipçi', 12.5, 1250, 100, 50000, 1)`,
    [kategori.id, saglayici.id]
  );
  servisId = servis.id;
});

test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

const v2 = body => request(app).post('/api/v2').send(body);

test.beforeEach(() => { saglayiciyaGidenler = []; saglayiciKabulEtsin = true; });

// ---------------------------------------------------------------
// Kimlik dogrulama
// ---------------------------------------------------------------

test('anahtarsız veya yanlış anahtarlı istek reddedilir', async () => {
  assert.equal((await v2({ action: 'balance' })).body.error, 'Invalid API Key');
  assert.equal((await v2({ key: 'smm_uydurma', action: 'balance' })).body.error, 'Invalid API Key');
});

test('bilinmeyen komut açıkça reddedilir', async () => {
  assert.equal((await v2({ key: apiKey, action: 'ucus_rezervasyonu' })).body.error, 'Invalid action');
});

// ---------------------------------------------------------------
// services / balance
// ---------------------------------------------------------------

test('services komutu gerçek servis listesini döner', async () => {
  const res = await v2({ key: apiKey, action: 'services' });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body), 'liste dönmedi');
  const servis = res.body.find(s => s.service === servisId);
  assert.ok(servis, 'eklenen servis listede yok');
  assert.equal(servis.rate, '12.50', `fiyat yanlış: ${servis.rate}`);
  assert.equal(servis.min, 100);
  assert.equal(servis.max, 50000);
  assert.ok(servis.name, 'servis adı yok');
});

test('balance komutu paneldeki gerçek bakiyeyi döner', async () => {
  const res = await v2({ key: apiKey, action: 'balance' });
  assert.equal(res.body.currency, 'TRY');
  const db_ = await dbAsync.get('SELECT balance_kurus FROM users WHERE id = ?', [kullaniciId]);
  assert.equal(res.body.balance, (db_.balance_kurus / 100).toFixed(2), 'API bakiyesi veritabanıyla uyuşmuyor');
});

// ---------------------------------------------------------------
// add: ASIL SORU — siparis gercekten saglayiciya gidiyor mu?
// ---------------------------------------------------------------

test('add komutu siparişi SAĞLAYICIYA İLETİR (sadece pending bırakmaz)', async () => {
  const res = await v2({
    key: apiKey, action: 'add', service: servisId,
    link: 'https://instagram.com/kullaniciadi', quantity: 1000
  });
  assert.ok(res.body.order, `sipariş oluşmadı: ${JSON.stringify(res.body)}`);

  assert.equal(saglayiciyaGidenler.length, 1, 'sipariş sağlayıcıya hiç gönderilmemiş');
  // SQLite sayisal affinity yuzunden 9001 sayi olarak donebilir; onemli olan deger.
  assert.equal(String(saglayiciyaGidenler[0].providerServiceId), '9001', 'sağlayıcıya yanlış servis numarası gitmiş');
  assert.equal(saglayiciyaGidenler[0].quantity, 1000);

  const siparis = await dbAsync.get('SELECT * FROM orders WHERE id = ?', [res.body.order]);
  assert.equal(siparis.status, 'processing', `sipariş '${siparis.status}' durumunda kalmış`);
  assert.ok(siparis.provider_order_id, 'sağlayıcı sipariş numarası kaydedilmemiş');
  assert.equal(siparis.user_id, kullaniciId);
});

test('add komutu bakiyeyi doğru tutarda düşer', async () => {
  const once = (await dbAsync.get('SELECT balance_kurus FROM users WHERE id = ?', [kullaniciId])).balance_kurus;
  const res = await v2({
    key: apiKey, action: 'add', service: servisId,
    link: 'https://instagram.com/kullaniciadi', quantity: 1000
  });
  assert.ok(res.body.order, res.body.error);
  const sonra = (await dbAsync.get('SELECT balance_kurus FROM users WHERE id = ?', [kullaniciId])).balance_kurus;
  // 1000 adet x 1250 kurus/1000 = 1250 kurus
  assert.equal(once - sonra, 1250, `düşülen tutar yanlış: ${once - sonra}`);
});

test('API siparişi panelde de görünür (aynı hesabın sipariş listesinde)', async () => {
  const res = await v2({
    key: apiKey, action: 'add', service: servisId,
    link: 'https://instagram.com/kullaniciadi', quantity: 500
  });
  assert.ok(res.body.order, res.body.error);

  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'api_musteri', password: SIFRE });
  const panel = await agent.get('/api/orders');
  assert.equal(panel.status, 200);
  const bulundu = panel.body.orders.find(o => o.id === res.body.order);
  assert.ok(bulundu, 'API ile verilen sipariş panelde görünmüyor');
  assert.equal(bulundu.quantity, 500);
});

test('sağlayıcı reddederse tutar aynı anda iade edilir', async () => {
  saglayiciKabulEtsin = false;
  const once = (await dbAsync.get('SELECT balance_kurus FROM users WHERE id = ?', [kullaniciId])).balance_kurus;
  const res = await v2({
    key: apiKey, action: 'add', service: servisId,
    link: 'https://instagram.com/kullaniciadi', quantity: 1000
  });
  assert.ok(res.body.error, 'hata dönmesi gerekirdi');
  assert.ok(!res.body.order, 'başarısız siparişte sipariş numarası dönmüş');
  const sonra = (await dbAsync.get('SELECT balance_kurus FROM users WHERE id = ?', [kullaniciId])).balance_kurus;
  assert.equal(sonra, once, `iade yapılmamış: ${once} -> ${sonra}`);
});

test('yetersiz bakiyede sipariş oluşmaz ve sağlayıcıya gitmez', async () => {
  await dbAsync.run('UPDATE users SET balance_kurus = 10, balance = 0.1 WHERE id = ?', [kullaniciId]);
  const res = await v2({
    key: apiKey, action: 'add', service: servisId,
    link: 'https://instagram.com/kullaniciadi', quantity: 1000
  });
  assert.match(res.body.error, /balance/i, `beklenen bakiye hatası değil: ${res.body.error}`);
  assert.equal(saglayiciyaGidenler.length, 0, 'bakiye yokken sağlayıcıya istek gitmiş');
  await dbAsync.run('UPDATE users SET balance_kurus = 500000, balance = 5000 WHERE id = ?', [kullaniciId]);
});

test('yanlış link tipi API üzerinden de engellenir', async () => {
  const res = await v2({
    key: apiKey, action: 'add', service: servisId,
    link: 'javascript:alert(1)', quantity: 1000
  });
  assert.ok(res.body.error, 'zararlı bağlantı kabul edilmiş');
  assert.equal(saglayiciyaGidenler.length, 0);
});

test('miktar sınırları API üzerinden de uygulanır', async () => {
  const az = await v2({ key: apiKey, action: 'add', service: servisId, link: 'https://instagram.com/x', quantity: 10 });
  assert.match(az.body.error, /Quantity must be between 100 and 50000/i, `mesaj: ${az.body.error}`);
  const cok = await v2({ key: apiKey, action: 'add', service: servisId, link: 'https://instagram.com/x', quantity: 99999 });
  assert.ok(cok.body.error);
  assert.equal(saglayiciyaGidenler.length, 0);
});

// ---------------------------------------------------------------
// status
// ---------------------------------------------------------------

test('status komutu tek siparişin gerçek durumunu döner', async () => {
  const eklendi = await v2({
    key: apiKey, action: 'add', service: servisId,
    link: 'https://instagram.com/kullaniciadi', quantity: 1000
  });
  const res = await v2({ key: apiKey, action: 'status', order: eklendi.body.order });
  assert.equal(res.body.status, 'Processing', `durum: ${res.body.status}`);
  assert.equal(res.body.currency, 'TRY');
  assert.equal(res.body.charge, '12.50');
});

test('status toplu sorgu birden çok siparişi tek istekte döner', async () => {
  const a = (await v2({ key: apiKey, action: 'add', service: servisId, link: 'https://instagram.com/a', quantity: 200 })).body.order;
  const b = (await v2({ key: apiKey, action: 'add', service: servisId, link: 'https://instagram.com/b', quantity: 300 })).body.order;
  const res = await v2({ key: apiKey, action: 'status', orders: `${a},${b}` });
  assert.ok(res.body[a], `${a} numaralı sipariş yanıtta yok`);
  assert.ok(res.body[b], `${b} numaralı sipariş yanıtta yok`);
  assert.equal(res.body[a].status, 'Processing');
});

test('başkasının siparişinin durumu görülemez', async () => {
  await request(app).post('/api/auth/register')
    .send({ username: 'baska_api', email: 'baska@site.com', password: SIFRE });
  const baska = await dbAsync.get('SELECT api_key FROM users WHERE username = ?', ['baska_api']);
  const benim = (await v2({ key: apiKey, action: 'add', service: servisId, link: 'https://instagram.com/c', quantity: 200 })).body.order;

  const res = await v2({ key: baska.api_key, action: 'status', order: benim });
  assert.equal(res.body.error, 'Order not found', 'başkasının siparişi görülebiliyor');
});

// ---------------------------------------------------------------
// API anahtari yonetimi
// ---------------------------------------------------------------

async function girisYap(username) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ username, password: SIFRE });
  assert.equal(res.status, 200, res.body.error);
  return agent;
}

test('kullanıcı kendi API anahtarını görebilir', async () => {
  const agent = await girisYap('api_musteri');
  const res = await agent.get('/api/account/api-key');
  assert.equal(res.status, 200);
  assert.equal(res.body.api_key, apiKey);
});

test('anahtarı olmayan kullanıcı yeni anahtar oluşturabilir', async () => {
  const agent = await girisYap('baska_api');
  await dbAsync.run('UPDATE users SET api_key = NULL WHERE username = ?', ['baska_api']);

  const bos = await agent.get('/api/account/api-key');
  assert.equal(bos.body.api_key, null, 'anahtar temizlenmemiş');

  const res = await agent.post('/api/account/api-key').send({});
  assert.equal(res.status, 200, res.body.error);
  assert.match(res.body.api_key, /^smm_/, `anahtar biçimi yanlış: ${res.body.api_key}`);
  assert.equal(res.body.regenerated, false);
  assert.ok(res.body.message && res.body.message_en, 'iki dilli mesaj yok');

  // Yeni anahtar gercekten calismali
  const kullanim = await v2({ key: res.body.api_key, action: 'balance' });
  assert.ok(kullanim.body.balance !== undefined, 'yeni anahtar API\'de çalışmıyor');
});

test('mevcut anahtar kazara ezilmez, yenileme açıkça istenmelidir', async () => {
  const agent = await girisYap('api_musteri');
  const res = await agent.post('/api/account/api-key').send({});
  assert.equal(res.status, 409, 'mevcut anahtar sessizce değiştirilmiş');
  const hala = await dbAsync.get('SELECT api_key FROM users WHERE id = ?', [kullaniciId]);
  assert.equal(hala.api_key, apiKey, 'anahtar değişmiş');
});

test('yenilenen anahtar çalışır, eski anahtar geçersizleşir', async () => {
  const agent = await girisYap('api_musteri');
  const eski = apiKey;
  const res = await agent.post('/api/account/api-key').send({ regenerate: true });
  assert.equal(res.status, 200, res.body.error);
  assert.equal(res.body.regenerated, true);
  assert.notEqual(res.body.api_key, eski, 'anahtar değişmemiş');

  assert.equal((await v2({ key: eski, action: 'balance' })).body.error, 'Invalid API Key', 'eski anahtar hâlâ çalışıyor');
  assert.ok((await v2({ key: res.body.api_key, action: 'balance' })).body.balance, 'yeni anahtar çalışmıyor');
  apiKey = res.body.api_key;
});

test('oturumsuz istek API anahtarı alamaz veya üretemez', async () => {
  assert.equal((await request(app).get('/api/account/api-key')).status, 401);
  assert.equal((await request(app).post('/api/account/api-key').send({})).status, 401);
});

// ---------------------------------------------------------------
// Sayfa arayuzu
// ---------------------------------------------------------------

test('API sayfasında anahtar oluşturma ve kılavuz düğmesi vardır', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  assert.ok(html.includes('app.createApiKey(false)'), 'anahtar oluşturma düğmesi yok');
  assert.ok(html.includes('app.createApiKey(true)'), 'anahtar yenileme düğmesi yok');
  assert.ok(html.includes('app.showApiGuide()'), 'kılavuz düğmesi yok');
  assert.ok(html.includes('id="modal-api-guide"'), 'kılavuz penceresi yok');
  assert.ok(html.includes('id="profile-api-key-input"'), 'profil sayfasında anahtar alanı yok');
});

test('kılavuz gerçekten desteklenen komutları anlatır', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
  const bas = js.indexOf('apiGuideHtml()');
  assert.ok(bas > 0, 'kılavuz fonksiyonu bulunamadı');
  const kilavuz = js.slice(bas, js.indexOf('async loadApiKey', bas));
  for (const komut of ['services', 'balance', 'add', 'status']) {
    assert.ok(kilavuz.includes(`ad: '${komut}'`) || kilavuz.includes(`ad: '${komut} `),
      `kılavuzda "${komut}" komutu anlatılmamış`);
  }
  // Desteklenmeyen komut ornek olarak verilmemeli
  assert.ok(!/ad: 'refill'/.test(kilavuz), 'kılavuz desteklenmeyen refill komutunu anlatıyor');
  assert.ok(!/ad: 'cancel'/.test(kilavuz), 'kılavuz desteklenmeyen cancel komutunu anlatıyor');
});
