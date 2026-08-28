// Shopier (PAT + webhook) kart odemesi ve ayni saglayici servisinin
// ikinci kez eklenmesinin engellenmesi.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
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

const PAT = 'test-personal-access-token-123456';
const WEBHOOK_TOKEN = 'test-webhook-signing-token';
const ADMIN_PASSWORD = 'GuvenliAdminSifre_2026';

// --- Sahte Shopier sunucusu -------------------------------------------------
// Gercek api.shopier.com'a hic cikmadan urun/webhook uclarini taklit eder.
const sahte = {
  urunler: new Map(),
  webhooklar: new Map(),
  sonrakiId: 1000,
  patHatasi: false
};

function sahteShopierKur() {
  const mock = express();
  mock.use(express.json());
  mock.use((req, res, next) => {
    if (sahte.patHatasi) return res.status(401).json({ message: 'Invalid token' });
    if (req.headers.authorization !== `Bearer ${PAT}`) return res.status(401).json({ message: 'Invalid token' });
    next();
  });
  mock.post('/v1/products', (req, res) => {
    const id = String(sahte.sonrakiId++);
    sahte.urunler.set(id, req.body);
    res.json({ id, url: `https://www.shopier.com/${id}`, title: req.body.title, stockStatus: 'inStock' });
  });
  mock.delete('/v1/products/:id', (req, res) => {
    sahte.urunler.delete(String(req.params.id));
    res.json({ success: true });
  });
  mock.post('/v1/webhooks', (req, res) => {
    const id = String(sahte.sonrakiId++);
    sahte.webhooklar.set(id, req.body);
    res.json({ id, event: req.body.event, url: req.body.url, token: WEBHOOK_TOKEN });
  });
  mock.delete('/v1/webhooks/:id', (req, res) => {
    sahte.webhooklar.delete(String(req.params.id));
    res.json({ success: true });
  });
  return new Promise(resolve => {
    const server = mock.listen(0, '127.0.0.1', () => {
      process.env.SHOPIER_API_BASE = `http://127.0.0.1:${server.address().port}/v1`;
      resolve(server);
    });
  });
}

let mockServer;

test.before(async () => {
  await initDatabase();
  mockServer = await sahteShopierKur();
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  await agent.post('/api/admin/change-password').send({ current_password: 'admin12345', new_password: ADMIN_PASSWORD });
});

test.after(async () => {
  await new Promise(resolve => mockServer.close(resolve));
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

function imzala(govdeMetni, token = WEBHOOK_TOKEN, kodlama = 'hex') {
  return crypto.createHmac('sha256', token).update(govdeMetni).digest(kodlama);
}

// Webhook'u HAM govdeyle gonderir; imza tam olarak bu metin uzerinden hesaplanir.
function webhookGonder(govde, { token = WEBHOOK_TOKEN, kodlama = 'hex', imza } = {}) {
  const metin = JSON.stringify(govde);
  return request(app)
    .post('/api/payments/shopier/webhook')
    .set('Content-Type', 'application/json')
    .set('Shopier-Signature', imza !== undefined ? imza : imzala(metin, token, kodlama))
    .send(metin);
}

function siparis(productId, { paymentStatus = 'paid', id } = {}) {
  return {
    id: id || `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    paymentStatus,
    lineItems: [{ productId, price: '100', total: '100', quantity: 1 }],
    shippingInfo: { email: 'alici@ornek.com' }
  };
}

async function bakiye() {
  const row = await dbAsync.get('SELECT balance_kurus FROM users WHERE username = ?', ['demo_user']);
  return row.balance_kurus;
}

// --- KURULUM ---------------------------------------------------------------

test('PAT kaydedilince webhook aboneliği otomatik kurulur', async () => {
  const agent = await adminAgent();
  const res = await agent.post('/api/admin/shopier/pat').send({ pat: PAT });
  assert.equal(res.status, 200, res.body.error);
  assert.equal(res.body.status.pat_saved, true);
  assert.equal(res.body.status.webhook_registered, true);
  assert.equal(res.body.status.ready, true);

  // Shopier'de gercekten order.created aboneligi acilmis olmali.
  const abonelikler = [...sahte.webhooklar.values()];
  assert.equal(abonelikler.length, 1);
  assert.equal(abonelikler[0].event, 'order.created');
  assert.match(abonelikler[0].url, /\/api\/payments\/shopier\/webhook$/);
});

test('anahtar ve imza tokeni veritabanında düz metin durmaz', async () => {
  const rows = await dbAsync.all(
    "SELECT key, value FROM site_settings WHERE key IN ('shopier_pat', 'shopier_webhook_token')"
  );
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.ok(row.value, `${row.key} boş kaydedilmiş`);
    assert.ok(!row.value.includes(PAT), `${row.key} PAT'i düz metin saklıyor!`);
    assert.ok(!row.value.includes(WEBHOOK_TOKEN), `${row.key} imza tokenini düz metin saklıyor!`);
  }
});

test('geçersiz PAT kaydedilmez', async () => {
  const agent = await adminAgent();
  sahte.patHatasi = true;
  try {
    const res = await agent.post('/api/admin/shopier/pat').send({ pat: 'gecersiz-anahtar-12345' });
    assert.equal(res.status, 400, 'geçersiz anahtar kabul edildi');
    // Onceki calisan yapilandirma bozulmamis olmali.
    const config = await Shopier.getConfig();
    assert.equal(config.pat, PAT, 'geçersiz anahtar mevcut yapılandırmanın üzerine yazmış');
  } finally {
    sahte.patHatasi = false;
  }
});

test('Shopier hazır olunca ödeme yöntemi listesinde görünür', async () => {
  const res = await request(app).get('/api/services');
  assert.equal(res.body.paymentMethods.shopier, true);
});

// --- ÖDEME BAŞLATMA --------------------------------------------------------

test('ödeme başlatınca geçici ürün oluşturulur ve niyete bağlanır', async () => {
  const agent = await musteriAgent();
  const res = await agent.post('/api/payments/shopier/create').send({ amount: 150 });
  assert.equal(res.status, 201, res.body.error);
  assert.match(res.body.payment_url, /^https:\/\/www\.shopier\.com\/\d+$/);
  assert.equal(res.body.amount, 150);

  const intent = await dbAsync.get('SELECT * FROM payment_intents WHERE merchant_oid = ?', [res.body.merchant_oid]);
  assert.equal(intent.provider, 'shopier');
  assert.equal(intent.status, 'pending');
  assert.equal(intent.amount_kurus, 15000);
  assert.ok(intent.provider_ref, 'ürün kimliği kaydedilmemiş — webhook eşleşmesi imkânsız olur');

  // Shopier'e giden urun dogru tutarda ve dijital olmali.
  const urun = sahte.urunler.get(intent.provider_ref);
  assert.equal(urun.priceData.price, '150.00');
  assert.equal(urun.priceData.currency, 'TRY');
  assert.equal(urun.type, 'digital');
  assert.ok(urun.media && urun.media[0] && urun.media[0].url, 'ürün görseli zorunlu, gönderilmemiş');
});

test('oturumsuz kullanıcı ödeme başlatamaz', async () => {
  const res = await request(app).post('/api/payments/shopier/create').send({ amount: 100 });
  assert.equal(res.status, 401);
});

// --- WEBHOOK ---------------------------------------------------------------

test('imzalı ödeme bildirimi bakiyeyi yükler, ürünü siler ve tekrarı yok sayar', async () => {
  const agent = await musteriAgent();
  const create = await agent.post('/api/payments/shopier/create').send({ amount: 200 });
  const intent = await dbAsync.get('SELECT * FROM payment_intents WHERE merchant_oid = ?', [create.body.merchant_oid]);
  const oncesi = await bakiye();

  const govde = siparis(intent.provider_ref);
  const res = await webhookGonder(govde);
  assert.equal(res.status, 200, res.text);

  assert.equal(await bakiye() - oncesi, 20000, '200 TL bakiyeye eklenmemiş');

  const odeme = await dbAsync.get('SELECT * FROM payments WHERE transaction_id = ?', [create.body.merchant_oid]);
  assert.equal(odeme.method, 'Shopier');
  assert.equal(odeme.status, 'completed');

  // Gecici urun magazadan silinmis olmali.
  assert.equal(sahte.urunler.has(intent.provider_ref), false, 'geçici ürün mağazada kalmış');

  // Ayni bildirim tekrar gelirse bakiye ikinci kez yuklenmemeli.
  const sonrasi = await bakiye();
  const tekrar = await webhookGonder(govde);
  assert.equal(tekrar.status, 200);
  assert.equal(await bakiye(), sonrasi, 'mükerrer bildirim bakiyeyi tekrar yüklemiş');
});

test('base64 kodlu imza da kabul edilir', async () => {
  const agent = await musteriAgent();
  const create = await agent.post('/api/payments/shopier/create').send({ amount: 60 });
  const intent = await dbAsync.get('SELECT provider_ref FROM payment_intents WHERE merchant_oid = ?', [create.body.merchant_oid]);
  const oncesi = await bakiye();

  const res = await webhookGonder(siparis(intent.provider_ref), { kodlama: 'base64' });
  assert.equal(res.status, 200);
  assert.equal(await bakiye() - oncesi, 6000);
});

test('sahte imzalı bildirim reddedilir, bakiye değişmez', async () => {
  const agent = await musteriAgent();
  const create = await agent.post('/api/payments/shopier/create').send({ amount: 500 });
  const intent = await dbAsync.get('SELECT provider_ref FROM payment_intents WHERE merchant_oid = ?', [create.body.merchant_oid]);
  const oncesi = await bakiye();

  const res = await webhookGonder(siparis(intent.provider_ref), { token: 'yanlis-token' });
  assert.equal(res.status, 400, 'sahte imza kabul edildi!');
  assert.equal(await bakiye(), oncesi, 'sahte imzalı bildirim bakiye yüklemiş!');

  const sonra = await dbAsync.get('SELECT status FROM payment_intents WHERE merchant_oid = ?', [create.body.merchant_oid]);
  assert.equal(sonra.status, 'pending');
});

test('imzasız bildirim reddedilir', async () => {
  const agent = await musteriAgent();
  const create = await agent.post('/api/payments/shopier/create').send({ amount: 90 });
  const intent = await dbAsync.get('SELECT provider_ref FROM payment_intents WHERE merchant_oid = ?', [create.body.merchant_oid]);
  const oncesi = await bakiye();

  const res = await webhookGonder(siparis(intent.provider_ref), { imza: '' });
  assert.equal(res.status, 400);
  assert.equal(await bakiye(), oncesi);
});

test('ödenmemiş sipariş bakiye yüklemez', async () => {
  const agent = await musteriAgent();
  const create = await agent.post('/api/payments/shopier/create').send({ amount: 300 });
  const intent = await dbAsync.get('SELECT provider_ref FROM payment_intents WHERE merchant_oid = ?', [create.body.merchant_oid]);
  const oncesi = await bakiye();

  const res = await webhookGonder(siparis(intent.provider_ref, { paymentStatus: 'unpaid' }));
  assert.equal(res.status, 200);
  assert.equal(await bakiye(), oncesi, 'ödenmemiş sipariş bakiye yüklemiş!');
  const sonra = await dbAsync.get('SELECT status FROM payment_intents WHERE merchant_oid = ?', [create.body.merchant_oid]);
  assert.equal(sonra.status, 'pending');
});

test('mağazadaki normal satış bakiye yüklemez', async () => {
  const oncesi = await bakiye();
  // Bize ait olmayan bir urun kimligi: sessizce gecilmeli.
  const res = await webhookGonder(siparis('999999999'));
  assert.equal(res.status, 200);
  assert.equal(await bakiye(), oncesi);
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

// --- TEMİZLİK VE KAPATMA ---------------------------------------------------

test('ödenmeden bırakılan ürünler süresi dolunca temizlenir', async () => {
  const agent = await musteriAgent();
  const create = await agent.post('/api/payments/shopier/create').send({ amount: 45 });
  const intent = await dbAsync.get('SELECT * FROM payment_intents WHERE merchant_oid = ?', [create.body.merchant_oid]);
  assert.ok(sahte.urunler.has(intent.provider_ref));

  // Kaydi 2 gun eskitip supurgeyi calistir.
  await dbAsync.run("UPDATE payment_intents SET created_at = datetime('now', '-2 days') WHERE id = ?", [intent.id]);
  const temizlenen = await Shopier.sweepAbandonedProducts();

  assert.ok(temizlenen >= 1, 'eski ürün temizlenmedi');
  assert.equal(sahte.urunler.has(intent.provider_ref), false, 'geçici ürün mağazada kalmış');
  const sonra = await dbAsync.get('SELECT status, provider_ref FROM payment_intents WHERE id = ?', [intent.id]);
  assert.equal(sonra.status, 'failed');
  assert.equal(sonra.provider_ref, null);
});

test('yapılandırma kaldırılınca ödeme yöntemi kapanır', async () => {
  const agent = await adminAgent();
  const res = await agent.delete('/api/admin/shopier/config');
  assert.equal(res.status, 200, res.body.error);
  assert.equal(res.body.status.ready, false);

  const liste = await request(app).get('/api/services');
  assert.equal(liste.body.paymentMethods.shopier, false);

  const musteri = await musteriAgent();
  const odeme = await musteri.post('/api/payments/shopier/create').send({ amount: 100 });
  assert.equal(odeme.status, 503, 'yapılandırılmamış Shopier ile ödeme başlatılabiliyor');

  // Yarim kalan niyet pending kalmamali.
  const asili = await dbAsync.get(
    "SELECT COUNT(*) c FROM payment_intents WHERE provider = 'shopier' AND status = 'pending' AND amount_kurus = 10000"
  );
  assert.equal(asili.c, 0, 'başarısız ödeme niyeti pending kalmış');
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
