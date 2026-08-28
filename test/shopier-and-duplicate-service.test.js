// Shopier kart odemesi + ayni saglayici servisinin ikinci kez eklenmesi.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-shopier-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.ENABLE_DEMO_PAYMENTS = 'false';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');
const Shopier = require('../services/shopier');

const API_KEY = 'test-shopier-api-key';
const API_SECRET = 'test-shopier-api-secret';
const ADMIN_PASSWORD = 'GuvenliAdminSifre_2026';

test.before(async () => {
  await initDatabase();
  await dbAsync.run("INSERT OR REPLACE INTO site_settings (key, value) VALUES ('shopier_api_key', ?)", [API_KEY]);
  await dbAsync.run("INSERT OR REPLACE INTO site_settings (key, value) VALUES ('shopier_api_secret', ?)", [API_SECRET]);
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  await agent.post('/api/admin/change-password').send({ current_password: 'admin12345', new_password: ADMIN_PASSWORD });
});

test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

async function musteriAgent() {
  const agent = request.agent(app);
  const login = await agent.post('/api/auth/login').send({ username: 'demo_user', password: 'user12345' });
  assert.equal(login.status, 200, 'demo girisi basarisiz: ' + JSON.stringify(login.body));
  return agent;
}

async function adminAgent() {
  const agent = request.agent(app);
  const login = await agent.post('/api/auth/login').send({ username: 'admin', password: ADMIN_PASSWORD });
  assert.equal(login.status, 200, 'admin girisi basarisiz');
  return agent;
}

function callbackImzasi(randomNr, orderId) {
  return crypto.createHmac('sha256', API_SECRET).update(`${randomNr}${orderId}`).digest('base64');
}

// --- ÖDEME FORMU ----------------------------------------------------------

test('Shopier ödeme formu imzalı alanlarla döner', async () => {
  const agent = await musteriAgent();
  const res = await agent.post('/api/payments/shopier/create').send({ amount: 150 });
  assert.equal(res.status, 201, res.body.error);
  assert.equal(res.body.action, Shopier.SHOPIER_PAY_URL);

  const f = res.body.fields;
  assert.equal(f.API_key, API_KEY);
  assert.equal(f.total_order_value, '150.00', 'tutar 2 haneli biçimlenmeli (imza buna bağlı)');
  assert.equal(f.currency, '0', '0 = TL');
  assert.equal(f.platform_order_id, res.body.merchant_oid);

  // İmza: random_nr + platform_order_id + total_order_value + currency
  const beklenen = crypto.createHmac('sha256', API_SECRET)
    .update(`${f.random_nr}${f.platform_order_id}${f.total_order_value}${f.currency}`)
    .digest('base64');
  assert.equal(f.signature, beklenen, 'Shopier imzası yanlış — ödeme sayfası isteği reddeder');

  const intent = await dbAsync.get('SELECT * FROM payment_intents WHERE merchant_oid = ?', [res.body.merchant_oid]);
  assert.equal(intent.provider, 'shopier');
  assert.equal(intent.status, 'pending');
  assert.equal(intent.amount_kurus, 15000, 'tutar kuruş cinsinden saklanmalı');
});

test('oturumsuz kullanıcı Shopier ödemesi başlatamaz', async () => {
  const res = await request(app).post('/api/payments/shopier/create').send({ amount: 100 });
  assert.equal(res.status, 401);
});

// --- GERİ DÖNÜŞ (CALLBACK) ------------------------------------------------

test('geçerli imzalı başarı bildirimi bakiyeyi yükler ve tekrarı yok sayar', async () => {
  const agent = await musteriAgent();
  const create = await agent.post('/api/payments/shopier/create').send({ amount: 200 });
  const oid = create.body.merchant_oid;

  const oncesi = await dbAsync.get('SELECT balance_kurus FROM users WHERE username = ?', ['demo_user']);

  const randomNr = '123456';
  const govde = {
    platform_order_id: oid,
    payment_id: 'PAY-1',
    installment: '0',
    status: 'success',
    random_nr: randomNr,
    signature: callbackImzasi(randomNr, oid)
  };

  const res = await request(app).post('/api/payments/shopier/callback').type('form').send(govde);
  assert.equal(res.status, 303, 'müşteri sonuç sayfasına yönlendirilmeli');
  assert.match(res.headers.location, /^\/payment-success/);

  const sonrasi = await dbAsync.get('SELECT balance_kurus FROM users WHERE username = ?', ['demo_user']);
  assert.equal(sonrasi.balance_kurus - oncesi.balance_kurus, 20000, '200 TL bakiyeye eklenmemiş');

  const odeme = await dbAsync.get('SELECT * FROM payments WHERE transaction_id = ?', [oid]);
  assert.equal(odeme.method, 'Shopier');
  assert.equal(odeme.status, 'completed');

  // Shopier aynı bildirimi tekrar gönderirse bakiye ikinci kez yüklenmemeli.
  const tekrar = await request(app).post('/api/payments/shopier/callback').type('form').send(govde);
  assert.equal(tekrar.status, 303);
  const sonHal = await dbAsync.get('SELECT balance_kurus FROM users WHERE username = ?', ['demo_user']);
  assert.equal(sonHal.balance_kurus, sonrasi.balance_kurus, 'mükerrer bildirim bakiyeyi tekrar yüklemiş');
});

test('imzası geçersiz bildirim bakiyeye dokunmaz', async () => {
  const agent = await musteriAgent();
  const create = await agent.post('/api/payments/shopier/create').send({ amount: 500 });
  const oid = create.body.merchant_oid;
  const oncesi = await dbAsync.get('SELECT balance_kurus FROM users WHERE username = ?', ['demo_user']);

  const res = await request(app).post('/api/payments/shopier/callback').type('form').send({
    platform_order_id: oid,
    status: 'success',
    random_nr: '999999',
    signature: Buffer.from('sahte-imza-sahte-imza-sahte-imz').toString('base64')
  });
  assert.equal(res.status, 303);
  assert.match(res.headers.location, /^\/payment-failed/);

  const sonrasi = await dbAsync.get('SELECT balance_kurus FROM users WHERE username = ?', ['demo_user']);
  assert.equal(sonrasi.balance_kurus, oncesi.balance_kurus, 'sahte imzalı bildirim bakiye yüklemiş!');
  const intent = await dbAsync.get('SELECT status FROM payment_intents WHERE merchant_oid = ?', [oid]);
  assert.equal(intent.status, 'pending', 'imza doğrulanmadan niyet durumu değişmemeli');
});

test('başarısız ödeme bildirimi niyeti failed yapar, bakiye değişmez', async () => {
  const agent = await musteriAgent();
  const create = await agent.post('/api/payments/shopier/create').send({ amount: 75 });
  const oid = create.body.merchant_oid;
  const oncesi = await dbAsync.get('SELECT balance_kurus FROM users WHERE username = ?', ['demo_user']);

  const randomNr = '246810';
  const res = await request(app).post('/api/payments/shopier/callback').type('form').send({
    platform_order_id: oid,
    payment_id: 'PAY-FAIL',
    status: 'failed',
    random_nr: randomNr,
    signature: callbackImzasi(randomNr, oid)
  });
  assert.equal(res.status, 303);
  assert.match(res.headers.location, /^\/payment-failed/);

  const sonrasi = await dbAsync.get('SELECT balance_kurus FROM users WHERE username = ?', ['demo_user']);
  assert.equal(sonrasi.balance_kurus, oncesi.balance_kurus);
  const intent = await dbAsync.get('SELECT status FROM payment_intents WHERE merchant_oid = ?', [oid]);
  assert.equal(intent.status, 'failed');
});

test('ödeme durumu ucu yalnızca kendi kaydını gösterir', async () => {
  const agent = await musteriAgent();
  const create = await agent.post('/api/payments/shopier/create').send({ amount: 120 });
  const oid = create.body.merchant_oid;

  const kendi = await agent.get(`/api/payments/shopier/status/${oid}`);
  assert.equal(kendi.status, 200);
  assert.equal(kendi.body.status, 'pending');
  assert.equal(kendi.body.amount, 120);

  const baskasi = await (await adminAgent()).get(`/api/payments/shopier/status/${oid}`);
  assert.equal(baskasi.status, 404, 'başka kullanıcının ödeme kaydı görünüyor!');
});

// --- YAPILANDIRMA ---------------------------------------------------------

test('Shopier yapılandırılmışsa ödeme yöntemi listesinde görünür', async () => {
  const res = await request(app).get('/api/services');
  assert.equal(res.status, 200);
  assert.equal(res.body.paymentMethods.shopier, true);
});

test('anahtarlar silinince Shopier kapanır ve ödeme başlatılamaz', async () => {
  await dbAsync.run("UPDATE site_settings SET value = '' WHERE key IN ('shopier_api_key', 'shopier_api_secret')");
  try {
    const liste = await request(app).get('/api/services');
    assert.equal(liste.body.paymentMethods.shopier, false);

    const agent = await musteriAgent();
    const res = await agent.post('/api/payments/shopier/create').send({ amount: 100 });
    assert.equal(res.status, 503, 'yapılandırılmamış Shopier ile ödeme başlatılabiliyor');

    // Yarım kalan niyet "failed" olarak kapatılmalı ki listede asılı kalmasın.
    const asili = await dbAsync.get("SELECT COUNT(*) c FROM payment_intents WHERE provider = 'shopier' AND status = 'pending' AND amount_kurus = 10000");
    assert.equal(asili.c, 0, 'başarısız ödeme niyeti pending kalmış');
  } finally {
    await dbAsync.run("UPDATE site_settings SET value = ? WHERE key = 'shopier_api_key'", [API_KEY]);
    await dbAsync.run("UPDATE site_settings SET value = ? WHERE key = 'shopier_api_secret'", [API_SECRET]);
  }
});

// --- AYNI SERVİSİN İKİNCİ KEZ EKLENMESİ -----------------------------------

test('aynı sağlayıcı servisi ikinci kez eklenemez', async () => {
  const agent = await adminAgent();
  const saglayici = await dbAsync.run(
    "INSERT INTO providers (name, api_url, api_key, balance, status) VALUES ('Test Saglayici', 'https://ornek.com/api/v2', 'k', 0, 1)"
  );

  const govde = {
    provider_id: saglayici.id,
    provider_service_id: '4242',
    category_name: 'Mükerrer Test',
    name: 'Instagram Takipçi',
    rate_per_1000: 50,
    min_quantity: 10,
    max_quantity: 1000
  };

  const ilk = await agent.post('/api/admin/services').send(govde);
  assert.equal(ilk.status, 200, ilk.body.error);

  const ikinci = await agent.post('/api/admin/services').send(govde);
  assert.equal(ikinci.status, 409, 'aynı servis ikinci kez eklenebiliyor!');
  assert.equal(ikinci.body.code, 'service_already_added');
  assert.equal(ikinci.body.service_id, ilk.body.service_id);

  const sayim = await dbAsync.get(
    'SELECT COUNT(*) c FROM services WHERE provider_id = ? AND provider_service_id = ?',
    [saglayici.id, '4242']
  );
  assert.equal(sayim.c, 1, 'veritabanında mükerrer servis oluşmuş');

  // Pasife alınmış olsa bile tekrar eklenmemeli (aksi halde kopya birikir).
  await dbAsync.run('UPDATE services SET status = 0 WHERE id = ?', [ilk.body.service_id]);
  const ucuncu = await agent.post('/api/admin/services').send(govde);
  assert.equal(ucuncu.status, 409);

  // Farklı servis ID'si sorunsuz eklenir.
  const farkli = await agent.post('/api/admin/services').send({ ...govde, provider_service_id: '4243' });
  assert.equal(farkli.status, 200, farkli.body.error);

  // Manuel servisler (sağlayıcısız) bu kuraldan etkilenmez.
  const manuel1 = await agent.post('/api/admin/services').send({ category_name: 'Manuel', name: 'Elle Eklenen', rate_per_1000: 10 });
  const manuel2 = await agent.post('/api/admin/services').send({ category_name: 'Manuel', name: 'Elle Eklenen', rate_per_1000: 10 });
  assert.equal(manuel1.status, 200);
  assert.equal(manuel2.status, 200, 'manuel servis eklemesi engellenmemeli');
});
