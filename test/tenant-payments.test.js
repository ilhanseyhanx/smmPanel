// Bayi Paneli F1: bayinin musterisi kendi bakiyesini yukler. Para bayinin
// hesabina gider; havale bayi onayiyla, PayTR ve NOWPayments imzali
// bildirimle bakiyeye yazilir. Anahtarlar panele geri donmez.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-bayiodeme-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.ENABLE_DEMO_PAYMENTS = 'false';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';
process.env.TENANT_BASE_DOMAIN = 'panel.test';
process.env.PAYMENT_RATE_LIMIT_MAX = '500';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');
const PayTR = require('../services/paytr');
const NowPayments = require('../services/nowpayments');

const SIFRE = 'OdemeTestSifresi_2026';
const HOST = 'odeme.panel.test';
const DIGER = 'baska.panel.test';
const PAYTR = { merchant_id: '123456', merchant_key: 'bayi-paytr-anahtar', merchant_salt: 'bayi-paytr-tuz' };
const NOW = { api_key: 'bayi-now-anahtar', ipn_secret: 'bayi-now-ipn-gizli' };
let tenantId;
let panel;
let musteri;
let admin;

function site(host = HOST, agent = request.agent(app)) {
  const call = method => url => agent[method](url).set('Host', host);
  return { get: call('get'), post: call('post'), put: call('put'), delete: call('delete'), agent };
}

async function jetKullanici(username) {
  await request(app).post('/api/auth/register').send({ username, email: `${username}@site.com`, password: SIFRE });
  return (await dbAsync.get('SELECT id FROM users WHERE username = ?', [username])).id;
}

async function yeniMusteri(username, host = HOST) {
  const s = site(host);
  const res = await s.post('/api/auth/register').send({ username, email: `${username}@musteri.com`, password: SIFRE });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { ...s, id: res.body.customer.id };
}

async function bakiye(customerId) {
  return (await dbAsync.get('SELECT balance_kurus FROM tenant_customers WHERE id = ?', [customerId])).balance_kurus;
}

function paytrHash(body, creds = PAYTR) {
  return crypto.createHmac('sha256', creds.merchant_key)
    .update(`${body.merchant_oid}${creds.merchant_salt}${body.status}${body.total_amount}`).digest('base64');
}

function nowImza(body, secret = NOW.ipn_secret) {
  const sirala = v => (Array.isArray(v) ? v.map(sirala) : v && typeof v === 'object'
    ? Object.keys(v).sort().reduce((a, k) => { a[k] = sirala(v[k]); return a; }, {}) : v);
  return crypto.createHmac('sha512', secret).update(JSON.stringify(sirala(body))).digest('hex');
}

test.before(async () => {
  await initDatabase();
  const ilk = request.agent(app);
  await ilk.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  await ilk.post('/api/admin/change-password').send({ current_password: 'admin12345', new_password: 'OdemeAdminSifre_2026' });
  admin = request.agent(app);
  await admin.post('/api/auth/login').send({ username: 'admin', password: 'OdemeAdminSifre_2026' });
  await jetKullanici('odeme_sahibi');
  const digerSahip = await jetKullanici('baska_sahip');
  tenantId = (await admin.post('/api/admin/resellers').send({ owner: 'odeme_sahibi', name: 'Ödeme SMM', slug: 'odeme' })).body.id;
  await admin.post('/api/admin/resellers').send({ owner: String(digerSahip), name: 'Başka SMM', slug: 'baska' });
  panel = site();
  const giris = await panel.post('/api/panel/login').send({ username: 'odeme_sahibi', password: SIFRE });
  assert.equal(giris.status, 200, JSON.stringify(giris.body));
  musteri = await yeniMusteri('odeyen_musteri');
});

test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('başlangıçta hiçbir yöntem açık değil; vitrin boş liste görür', async () => {
  const ayar = await panel.get('/api/panel/payment-settings');
  assert.equal(ayar.status, 200);
  assert.deepEqual(ayar.body.methods.map(m => m.method), ['bank', 'paytr', 'nowpayments']);
  assert.ok(ayar.body.methods.every(m => !m.enabled));
  assert.match(ayar.body.callback_urls.paytr, /odeme\.panel\.test\/api\/payments\/paytr\/callback$/);
  assert.deepEqual((await site().get('/api/payments/methods')).body.methods, []);
  assert.equal((await site().get('/api/panel/payment-settings')).status, 401);
});

test('havale hesap bilgisi olmadan açılamaz; açılınca vitrinde hesaplar görünür', async () => {
  const bos = await panel.put('/api/panel/payment-settings/bank').send({ enabled: true });
  assert.equal(bos.status, 400);
  const ok = await panel.put('/api/panel/payment-settings/bank').send({
    enabled: true, min: 20, accounts: 'Ziraat Bankası\nTR00 0000 0000 0000 0000 0000 00\nAlıcı: Ödeme SMM', instructions: 'Açıklamaya kullanıcı adını yaz.'
  });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const vitrin = await site().get('/api/payments/methods');
  const bank = vitrin.body.methods.find(m => m.method === 'bank');
  assert.equal(bank.min, 20);
  assert.match(bank.accounts, /TR00 0000/);
  assert.match(bank.accounts, /\n/, 'satır sonları korunur');
});

test('havale bildirimi: giriş ister, alt limiti uygular, bayi onaylayınca bakiyeye yazılır', async () => {
  assert.equal((await site().post('/api/payments/bank').send({ amount: 100, bank_name: 'Ziraat', sender_name: 'Ali Veli' })).status, 401);
  const az = await musteri.post('/api/payments/bank').send({ amount: 10, bank_name: 'Ziraat', sender_name: 'Ali Veli' });
  assert.equal(az.status, 400);
  const once = await bakiye(musteri.id);
  const bildirim = await musteri.post('/api/payments/bank').send({ amount: 150, bank_name: 'Ziraat', sender_name: 'Ali Veli' });
  assert.equal(bildirim.status, 201, JSON.stringify(bildirim.body));
  assert.equal(await bakiye(musteri.id), once, 'onaydan önce bakiye değişmez');

  const liste = await panel.get('/api/panel/payments?status=pending');
  assert.equal(liste.body.pending_bank, 1);
  const kayit = liste.body.payments[0];
  assert.equal(kayit.customer, 'odeyen_musteri');
  assert.equal(kayit.sender_name, 'Ali Veli');

  const onay = await panel.post(`/api/panel/payments/${kayit.id}/approve`);
  assert.equal(onay.status, 200, JSON.stringify(onay.body));
  assert.equal(await bakiye(musteri.id), once + 15000);
  assert.equal((await panel.post(`/api/panel/payments/${kayit.id}/approve`)).status, 409, 'ikinci onay yok');
  const log = await dbAsync.get("SELECT * FROM tenant_balance_logs WHERE customer_id = ? AND type = 'deposit' ORDER BY id DESC", [musteri.id]);
  assert.equal(log.amount_kurus, 15000);
  const gecmis = await musteri.get('/api/payments/history');
  assert.equal(gecmis.body.payments[0].status, 'completed');
});

test('havale bildirimi reddedilirse bakiye değişmez, sebep müşteriye görünür', async () => {
  const once = await bakiye(musteri.id);
  const b = await musteri.post('/api/payments/bank').send({ amount: 50, bank_name: 'Papara', sender_name: 'Ali Veli' });
  const red = await panel.post(`/api/panel/payments/${b.body.payment_id}/reject`).send({ reason: 'Para gelmedi' });
  assert.equal(red.status, 200);
  assert.equal(await bakiye(musteri.id), once);
  const gecmis = await musteri.get('/api/payments/history');
  const kayit = gecmis.body.payments.find(p => p.id === b.body.payment_id);
  assert.equal(kayit.status, 'rejected');
  assert.equal(kayit.failure_reason, 'Para gelmedi');
});

test('başka bayinin sahibi bu bayinin ödemesini göremez ve onaylayamaz', async () => {
  const b = await musteri.post('/api/payments/bank').send({ amount: 30, bank_name: 'Ziraat', sender_name: 'Ali Veli' });
  const baska = site(DIGER);
  await baska.post('/api/panel/login').send({ username: 'baska_sahip', password: SIFRE });
  assert.equal((await baska.post(`/api/panel/payments/${b.body.payment_id}/approve`)).status, 404);
  assert.equal((await baska.get('/api/panel/payments')).body.total, 0);
  await panel.post(`/api/panel/payments/${b.body.payment_id}/reject`).send({});
});

test('PayTR anahtarları kaydedilir ama panele geri dönmez', async () => {
  const eksik = await panel.put('/api/panel/payment-settings/paytr').send({ enabled: true, merchant_id: PAYTR.merchant_id });
  assert.equal(eksik.status, 400);
  const ok = await panel.put('/api/panel/payment-settings/paytr').send({ enabled: true, test_mode: true, ...PAYTR });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const ayar = await panel.get('/api/panel/payment-settings');
  const text = JSON.stringify(ayar.body);
  assert.ok(!text.includes(PAYTR.merchant_key) && !text.includes(PAYTR.merchant_salt));
  const paytr = ayar.body.methods.find(m => m.method === 'paytr');
  assert.deepEqual(paytr.saved, { merchant_id: true, merchant_key: true, merchant_salt: true });
  // Bos alan gonderilince eski anahtar korunur.
  assert.equal((await panel.put('/api/panel/payment-settings/paytr').send({ enabled: true, test_mode: true })).status, 200);
  const row = await dbAsync.get("SELECT secrets_encrypted FROM tenant_payment_settings WHERE tenant_id = ? AND method = 'paytr'", [tenantId]);
  assert.ok(!row.secrets_encrypted.includes(PAYTR.merchant_key), 'veritabanında şifreli');
});

test('PayTR: ödeme bayinin anahtarıyla başlar, imzalı bildirim bakiyeyi bir kez yazar', async () => {
  const gercek = PayTR.createIframeToken;
  let gelen;
  PayTR.createIframeToken = async args => { gelen = args; return 'bayi-token-1'; };
  try {
    const res = await musteri.post('/api/payments/paytr/token').send({ amount: 250 });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.payment_url, 'https://www.paytr.com/odeme/guvenli/bayi-token-1');
    assert.equal(gelen.creds.merchantKey, PAYTR.merchant_key);
    assert.equal(gelen.creds.testMode, true);
    assert.match(gelen.okUrl, /^http:\/\/odeme\.panel\.test\/bakiye\?odeme=BY/);
    assert.equal(gelen.amountKurus, 25000);

    const once = await bakiye(musteri.id);
    const govde = { merchant_oid: res.body.merchant_oid, status: 'success', total_amount: '25000' };
    const sahte = await site().post('/api/payments/paytr/callback').type('form').send({ ...govde, hash: 'yanlis' });
    assert.equal(sahte.status, 400);
    const cb = await site().post('/api/payments/paytr/callback').type('form').send({ ...govde, hash: paytrHash(govde) });
    assert.equal(cb.text, 'OK');
    assert.equal(await bakiye(musteri.id), once + 25000);
    await site().post('/api/payments/paytr/callback').type('form').send({ ...govde, hash: paytrHash(govde) });
    assert.equal(await bakiye(musteri.id), once + 25000, 'tekrar gelen bildirim çift yüklemez');
    // Ayni bildirim baska bayinin adresine gelirse o bayinin anahtari tutmaz.
    assert.equal((await site(DIGER).post('/api/payments/paytr/callback').type('form').send({ ...govde, hash: paytrHash(govde) })).status, 400);
  } finally {
    PayTR.createIframeToken = gercek;
  }
});

test('PayTR başarısız bildirim ödemeyi kapatır, bakiyeye dokunmaz', async () => {
  const gercek = PayTR.createIframeToken;
  PayTR.createIframeToken = async () => 'bayi-token-2';
  try {
    const res = await musteri.post('/api/payments/paytr/token').send({ amount: 40 });
    const once = await bakiye(musteri.id);
    const govde = { merchant_oid: res.body.merchant_oid, status: 'failed', total_amount: '4000', failed_reason_msg: 'Kart limiti yetersiz' };
    await site().post('/api/payments/paytr/callback').type('form').send({ ...govde, hash: paytrHash(govde) });
    assert.equal(await bakiye(musteri.id), once);
    const durum = await musteri.get(`/api/payments/status/${res.body.merchant_oid}`);
    assert.equal(durum.body.payment.status, 'failed');
    assert.equal(durum.body.payment.failure_reason, 'Kart limiti yetersiz');
  } finally {
    PayTR.createIframeToken = gercek;
  }
});

test('NOWPayments: bayinin anahtarıyla adres alınır, imzalı finished bildirimi bakiyeye yazılır', async () => {
  assert.equal((await panel.put('/api/panel/payment-settings/nowpayments').send({ enabled: true, ...NOW })).status, 200);
  const gercek = NowPayments.createPayment;
  let gelen;
  NowPayments.createPayment = async args => {
    gelen = args;
    return { paymentId: '987', payAddress: 'TXyzBayiAdresi', payAmount: 12.5, payCurrency: 'usdttrc20', expiresAt: null };
  };
  try {
    const az = await musteri.post('/api/payments/nowpayments/create').send({ amount: 100, pay_currency: 'usdttrc20' });
    assert.equal(az.status, 400, 'kripto alt limiti 400 TL');
    const res = await musteri.post('/api/payments/nowpayments/create').send({ amount: 500, pay_currency: 'usdttrc20' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.pay_address, 'TXyzBayiAdresi');
    assert.match(res.body.qr, /^data:image\/png;base64,/);
    assert.equal(gelen.config.apiKey, NOW.api_key);
    assert.equal(gelen.callbackUrl, 'http://odeme.panel.test/api/payments/nowpayments/callback');

    const once = await bakiye(musteri.id);
    const govde = { order_id: res.body.merchant_oid, payment_id: 987, payment_status: 'finished', pay_currency: 'usdttrc20' };
    const sahte = await site().post('/api/payments/nowpayments/callback').set('x-nowpayments-sig', nowImza(govde, 'yanlis')).send(govde);
    assert.equal(sahte.status, 400);
    const cb = await site().post('/api/payments/nowpayments/callback').set('x-nowpayments-sig', nowImza(govde)).send(govde);
    assert.equal(cb.text, 'OK');
    assert.equal(await bakiye(musteri.id), once + 50000);
  } finally {
    NowPayments.createPayment = gercek;
  }
});

test('yasal sayfalar şablondan bayinin bilgileriyle dolar', async () => {
  const liste = await site().get('/api/pages');
  assert.deepEqual(liste.body.pages.map(p => p.slug), ['gizlilik', 'mesafeli-satis', 'iade', 'kvkk']);
  const once = await site().get('/api/pages/mesafeli-satis');
  assert.match(once.body.body, /Satıcı: Ödeme SMM/);
  assert.match(once.body.body, /Adres: Belirtilmedi/);
  assert.doesNotMatch(once.body.body, /\{\{/);

  const eksik = await panel.get('/api/panel/pages');
  assert.ok(eksik.body.missing_info.includes('Adres'));
  const kayit = await panel.put('/api/panel/site').send({
    name: 'Ödeme SMM', legal_name: 'Ali Veli Dijital Hizmetler', legal_address: 'Kadıköy, İstanbul', phone: '0555 000 00 00', support_email: 'destek@odeme.com'
  });
  assert.equal(kayit.status, 200, JSON.stringify(kayit.body));
  const sonra = await site().get('/api/pages/mesafeli-satis');
  assert.match(sonra.body.body, /Satıcı: Ali Veli Dijital Hizmetler/);
  assert.match(sonra.body.body, /Adres: Kadıköy, İstanbul/);
  assert.match(sonra.body.body, /odeme\.panel\.test/);
  assert.match((await site().get('/api/pages/kvkk')).body.body, /destek@odeme\.com/);
  assert.equal((await site().get('/api/pages/yok')).status, 404);
  assert.deepEqual((await panel.get('/api/panel/pages')).body.missing_info, []);
});

test('bayi yasal sayfayı düzenler ve şablona geri döndürebilir', async () => {
  const kaydet = await panel.put('/api/panel/pages/iade').send({
    title: 'İade Koşulları', body: '<script>x()</script>Siparişlerde iade yalnızca bakiyeye yapılır. Ayrıntı için bize yazın.'
  });
  assert.equal(kaydet.status, 200, JSON.stringify(kaydet.body));
  const ozel = await site().get('/api/pages/iade');
  assert.equal(ozel.body.title, 'İade Koşulları');
  assert.doesNotMatch(ozel.body.body, /<script>/);
  assert.match(ozel.body.body, /iade yalnızca bakiyeye/);
  const panelListe = await panel.get('/api/panel/pages');
  assert.equal(panelListe.body.pages.find(p => p.slug === 'iade').customized, true);

  assert.equal((await panel.put('/api/panel/pages/yok').send({ title: 'Yok', body: 'x'.repeat(30) })).status, 404);
  assert.equal((await site().put('/api/panel/pages/iade').send({ title: 'Hack', body: 'x'.repeat(30) })).status, 401);

  assert.equal((await panel.delete('/api/panel/pages/iade')).status, 200);
  const sablon = await site().get('/api/pages/iade');
  assert.equal(sablon.body.title, 'İade Politikası');
  assert.match(sablon.body.body, /Bakiyeye otomatik iade/);
});

test('bayi silinince ödeme kayıtları ve ayarları da silinir', async () => {
  const say = async table => (await dbAsync.get(`SELECT COUNT(*) AS n FROM ${table} WHERE tenant_id = ?`, [tenantId])).n;
  assert.ok(await say('tenant_payments') > 0);
  const sil = await admin.delete(`/api/admin/resellers/${tenantId}`).send({ confirm: 'odeme' });
  assert.equal(sil.status, 200, JSON.stringify(sil.body));
  assert.equal(await say('tenant_payments'), 0);
  assert.equal(await say('tenant_payment_settings'), 0);
});
