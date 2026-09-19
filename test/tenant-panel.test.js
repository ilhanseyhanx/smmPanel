// Bayi yonetim paneli (Faz 2): bayi.com/admin girisi, yetki izolasyonu,
// fiyat ayarlarinin vitrine yansimasi, musteri/siparis yonetimi, site
// ayarlari ve islem kaydi.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-bayipanel-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.ENABLE_DEMO_PAYMENTS = 'false';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';
process.env.TENANT_BASE_DOMAIN = 'panel.test';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');
const { encryptSecret } = require('../utils/security');
const { generateSecret, generate } = require('otplib');

const SIFRE = 'PanelTestSifresi_2026';
const HOST = 'kanka.panel.test';
const DIGER = 'diger.panel.test';
let sahipId;
let tenantId;
let servisId;
let admin;

const SmmProviderClient = require('../services/smmProvider');
let saglayiciNo = 800000;
SmmProviderClient.prototype.addOrder = async () => { saglayiciNo += 1; return { order: saglayiciNo }; };

function site(host = HOST, agent = request.agent(app)) {
  const call = method => url => agent[method](url).set('Host', host);
  return { get: call('get'), post: call('post'), put: call('put'), agent };
}

async function jetKullanici(username, bakiyeKurus = 0) {
  await request(app).post('/api/auth/register').send({ username, email: `${username}@site.com`, password: SIFRE });
  const user = await dbAsync.get('SELECT id FROM users WHERE username = ?', [username]);
  if (bakiyeKurus) await dbAsync.run('UPDATE users SET balance_kurus = ?, balance = ? WHERE id = ?', [bakiyeKurus, bakiyeKurus / 100, user.id]);
  return user.id;
}

async function panelGiris(host = HOST, username = 'panel_sahibi') {
  const p = site(host);
  const res = await p.post('/api/panel/login').send({ username, password: SIFRE });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return p;
}

async function vitrinFiyati(id = servisId) {
  const res = await site().get('/api/services');
  return res.body.services.find(s => s.id === id);
}

test.before(async () => {
  await initDatabase();
  const ilk = request.agent(app);
  await ilk.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  await ilk.post('/api/admin/change-password').send({ current_password: 'admin12345', new_password: 'PanelAdminSifre_2026' });
  admin = request.agent(app);
  await admin.post('/api/auth/login').send({ username: 'admin', password: 'PanelAdminSifre_2026' });

  sahipId = await jetKullanici('panel_sahibi', 100000);
  await jetKullanici('yabanci_jet');
  const digerSahip = await jetKullanici('diger_sahip');
  const t = await admin.post('/api/admin/resellers').send({ owner: 'panel_sahibi', name: 'Kanka SMM', slug: 'kanka' });
  tenantId = t.body.id;
  await admin.post('/api/admin/resellers').send({ owner: String(digerSahip), name: 'Diğer SMM', slug: 'diger' });

  const saglayici = (await dbAsync.run(
    "INSERT INTO providers (name, api_url, api_key, status) VALUES ('Panel Saglayici', 'https://saglayici.example.com/api/v2', 'gizli', 1)"
  )).id;
  const kategori = (await dbAsync.run("INSERT INTO categories (name, name_tr) VALUES ('Panel Test', 'Panel Test')")).id;
  // 10,00 TL / 1000 -> maliyet 9,00 (%10) -> satis 11,70 (%30)
  servisId = (await dbAsync.run(
    `INSERT INTO services (category_id, provider_id, provider_service_id, name, name_tr, rate_per_1000, rate_per_1000_kurus,
       min_quantity, max_quantity, status)
     VALUES (?, ?, '6001', 'Instagram Takipçi', 'Instagram Takipçi', 10, 1000, 100, 100000, 1)`,
    [kategori, saglayici]
  )).id;
});

test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Giris ve yetki
// ---------------------------------------------------------------------------

test('/admin bayinin panel sayfasını açar, arama motorlarına kapalıdır', async () => {
  const res = await site().get('/admin/services');
  assert.equal(res.status, 200);
  assert.match(res.text, /Yönetim Paneli/);
  assert.match(res.text, /Kanka SMM/);
  assert.match(res.headers['x-robots-tag'], /noindex/);
  assert.doesNotMatch(res.text, /SMMJET|jetsmmpanel/i);
  assert.match((await site().get('/robots.txt')).text, /Disallow: \/admin/);
});

test('giriş yapmadan panel verisi alınamaz', async () => {
  assert.equal((await site().get('/api/panel/me')).status, 401);
  assert.equal((await site().get('/api/panel/customers')).status, 401);
});

test('yalnızca bayinin sahibi girer; başka Jet hesabı aynı hatayı alır', async () => {
  const yanlis = await site().post('/api/panel/login').send({ username: 'panel_sahibi', password: 'yanlis-sifre-123' });
  assert.equal(yanlis.status, 401);
  const yabanci = await site().post('/api/panel/login').send({ username: 'yabanci_jet', password: SIFRE });
  assert.equal(yabanci.status, 401);
  assert.equal(yabanci.body.error, yanlis.body.error, 'sahip olmayan hesap için farklı mesaj: hesap varlığı sızıyor');
  const sahip = await panelGiris();
  const me = await sahip.get('/api/panel/me');
  assert.equal(me.body.owner.username, 'panel_sahibi');
  assert.equal(me.body.tenant.subdomain, 'kanka.panel.test');
  assert.equal(me.body.top_up_url, 'http://localhost:3000/add-funds');
});

test('panel oturumu başka bayide, Jet sitesinde ya da müşteri oturumuyla geçmez', async () => {
  const sahip = await panelGiris();
  // Ayni cerez kavanozu baska bayiye:
  assert.equal((await sahip.agent.get('/api/panel/me').set('Host', DIGER)).status, 401);
  // Panel cerezi Jet admin paneline yetki vermez:
  assert.equal((await sahip.agent.get('/api/admin/resellers')).status, 401);
  // Jet oturumu bayi paneline girmez:
  const jet = request.agent(app);
  await jet.post('/api/auth/login').send({ username: 'panel_sahibi', password: SIFRE });
  assert.equal((await jet.get('/api/panel/me').set('Host', HOST)).status, 401);
  // Musteri oturumu bayi paneline girmez:
  const musteri = site();
  await musteri.post('/api/auth/register').send({ username: 'sinsi_musteri', email: 'sinsi@m.com', password: SIFRE });
  assert.equal((await musteri.get('/api/panel/me')).status, 401);
});

test('iki adımlı doğrulama açık sahip kodsuz giremez, doğru kodla girer', async () => {
  const secret = generateSecret();
  await dbAsync.run('UPDATE users SET two_factor_enabled = 1, two_factor_secret = ? WHERE id = ?', [encryptSecret(secret), sahipId]);
  try {
    const kodsuz = await site().post('/api/panel/login').send({ username: 'panel_sahibi', password: SIFRE });
    assert.equal(kodsuz.status, 401);
    assert.equal(kodsuz.body.code, 'TWO_FACTOR_REQUIRED');
    const yanlis = await site().post('/api/panel/login').send({ username: 'panel_sahibi', password: SIFRE, totp: '000000' });
    assert.equal(yanlis.status, 401);
    const token = await generate({ secret });
    const dogru = await site().post('/api/panel/login').send({ username: 'panel_sahibi', password: SIFRE, totp: token });
    assert.equal(dogru.status, 200, JSON.stringify(dogru.body));
  } finally {
    await dbAsync.run('UPDATE users SET two_factor_enabled = 0, two_factor_secret = NULL WHERE id = ?', [sahipId]);
  }
});

test('Jet şifresi değişince açık panel oturumu kapanır', async () => {
  const sahip = await panelGiris();
  await dbAsync.run('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [sahipId]);
  assert.equal((await sahip.get('/api/panel/me')).status, 401);
});

// ---------------------------------------------------------------------------
// Servisler ve fiyatlar
// ---------------------------------------------------------------------------

test('servis listesi bayinin maliyetini ve satış fiyatını gösterir', async () => {
  const sahip = await panelGiris();
  const res = await sahip.get('/api/panel/services');
  const s = res.body.services.find(x => x.id === servisId);
  assert.equal(s.cost, 9);
  assert.equal(s.price, 11.7);
  assert.equal(s.mode, 'markup');
  assert.equal(s.effective_markup_percent, 30);
});

test('özel kâr, sabit fiyat, özel ad ve kapatma vitrine anında yansır', async () => {
  const sahip = await panelGiris();
  assert.equal((await sahip.put(`/api/panel/services/${servisId}`).send({ markup_percent: 50 })).status, 200);
  assert.equal((await vitrinFiyati()).rate, 13.5);

  const zarar = await sahip.put(`/api/panel/services/${servisId}`).send({ fixed_price: 5 });
  assert.equal(zarar.status, 400, 'maliyetin altında sabit fiyat kaydedildi');
  assert.match(zarar.body.error, /9[.,]00/);

  assert.equal((await sahip.put(`/api/panel/services/${servisId}`).send({ fixed_price: 15, custom_name: 'Türk Takipçi' })).status, 200);
  const vitrin = await vitrinFiyati();
  assert.equal(vitrin.rate, 15);
  assert.equal(vitrin.name, 'Türk Takipçi');

  assert.equal((await sahip.put(`/api/panel/services/${servisId}`).send({ enabled: false })).status, 200);
  assert.equal(await vitrinFiyati(), undefined, 'kapatılan servis vitrinde');

  // Varsayilana donus: kayit silinir.
  await sahip.put(`/api/panel/services/${servisId}`).send({ enabled: true, fixed_price: null, markup_percent: null, custom_name: null });
  assert.equal(await dbAsync.get('SELECT 1 FROM tenant_service_prices WHERE tenant_id = ? AND service_id = ?', [tenantId, servisId]), undefined);
  assert.equal((await vitrinFiyati()).rate, 11.7);
});

test('toplu işlem ve varsayılan kâr oranı', async () => {
  const sahip = await panelGiris();
  let res = await sahip.post('/api/panel/services/bulk').send({ service_ids: [servisId], action: 'markup', markup_percent: 100 });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal((await vitrinFiyati()).rate, 18);
  res = await sahip.post('/api/panel/services/bulk').send({ service_ids: [servisId], action: 'disable' });
  assert.equal(await vitrinFiyati(), undefined);
  res = await sahip.post('/api/panel/services/bulk').send({ service_ids: [servisId, 999999], action: 'reset' });
  assert.equal(res.body.changed, 1, 'olmayan servis sayıldı');
  assert.equal((await vitrinFiyati()).rate, 11.7);

  assert.equal((await sahip.put('/api/panel/pricing').send({ default_markup_percent: 20 })).status, 200);
  assert.equal((await vitrinFiyati()).rate, 10.8);
  await sahip.put('/api/panel/pricing').send({ default_markup_percent: 30 });
});

// ---------------------------------------------------------------------------
// Musteriler ve siparisler
// ---------------------------------------------------------------------------

test('müşteri listesi, bakiye yükleme/düşme ve ban', async () => {
  const musteri = site();
  const kayit = await musteri.post('/api/auth/register').send({ username: 'panel_musteri', email: 'pm@m.com', password: SIFRE });
  const id = kayit.body.customer.id;
  const sahip = await panelGiris();

  const liste = await sahip.get('/api/panel/customers?q=panel_mus');
  assert.equal(liste.body.customers.length, 1);

  const ekle = await sahip.post(`/api/panel/customers/${id}/balance`).send({ amount: 100, action: 'add', note: 'havale' });
  assert.equal(ekle.status, 200, JSON.stringify(ekle.body));
  assert.equal(ekle.body.balance, 100);
  assert.equal((await sahip.post(`/api/panel/customers/${id}/balance`).send({ amount: 500, action: 'subtract' })).status, 400);

  // Siparis ver, panelde gorunsun
  const siparis = await musteri.post('/api/orders').send({ service_id: servisId, link: 'https://instagram.com/kullaniciadi', quantity: 1000 });
  assert.equal(siparis.status, 201, JSON.stringify(siparis.body));

  const detay = await sahip.get(`/api/panel/customers/${id}`);
  assert.equal(detay.body.customer.balance, 88.3);
  assert.equal(detay.body.orders[0].paid, 11.7);
  assert.equal(detay.body.orders[0].profit, 2.7);
  assert.ok(detay.body.balance_logs.some(l => l.type === 'manual_add' && l.note === 'havale'));

  const ban = await sahip.post(`/api/panel/customers/${id}/ban`).send({ banned: true });
  assert.equal(ban.status, 200);
  assert.equal((await musteri.get('/api/auth/me')).status, 401, 'banlanan müşterinin oturumu açık kaldı');
  await sahip.post(`/api/panel/customers/${id}/ban`).send({ banned: false });
});

test('sipariş listesi kâr gösterir, filtrelenir ve aranır', async () => {
  const sahip = await panelGiris();
  const tum = await sahip.get('/api/panel/orders');
  assert.ok(tum.body.total >= 1);
  const o = tum.body.orders[0];
  assert.equal(o.customer, 'panel_musteri');
  assert.equal(o.paid, 11.7);
  assert.equal(o.cost, 9);
  assert.equal(o.profit, 2.7);
  assert.equal((await sahip.get('/api/panel/orders?status=completed')).body.total, 0);
  assert.equal((await sahip.get('/api/panel/orders?q=panel_mus')).body.total, tum.body.total);
  const dash = await sahip.get('/api/panel/dashboard');
  assert.equal(dash.body.totals.profit, 2.7);
  assert.equal(dash.body.customers.total >= 2, true);
});

test('başka bayinin müşterisine erişilemez', async () => {
  const diger = site(DIGER);
  const kayit = await diger.post('/api/auth/register').send({ username: 'diger_musteri', email: 'dm@m.com', password: SIFRE });
  const sahip = await panelGiris();
  assert.equal((await sahip.get(`/api/panel/customers/${kayit.body.customer.id}`)).status, 404);
  assert.equal((await sahip.post(`/api/panel/customers/${kayit.body.customer.id}/balance`).send({ amount: 10, action: 'add' })).status, 404);
});

// ---------------------------------------------------------------------------
// Site ayarlari, durum, kayitlar
// ---------------------------------------------------------------------------

test('site ayarları vitrine yansır; hatalı renk reddedilir', async () => {
  const sahip = await panelGiris();
  const kotu = await sahip.put('/api/panel/site').send({ name: 'Kanka SMM', primary_color: 'red;}body{' });
  assert.equal(kotu.status, 400);
  const iyi = await sahip.put('/api/panel/site').send({
    name: 'Kanka Pro', primary_color: '#ff5500', announcement: 'Hafta sonu indirimi!', support_email: 'destek@kanka.com', telegram: '@kankadestek'
  });
  assert.equal(iyi.status, 200, JSON.stringify(iyi.body));
  const sayfa = await site().get('/');
  assert.match(sayfa.text, /<title>Kanka Pro<\/title>/);
  assert.match(sayfa.text, /--primary: #ff5500/);
  const bilgi = await site().get('/api/site');
  assert.equal(bilgi.body.settings.announcement, 'Hafta sonu indirimi!');
  assert.equal(bilgi.body.settings.support_email, 'destek@kanka.com');
});

test('askıya alınan bayinin sahibi panele girip durumu görür', async () => {
  await admin.post(`/api/admin/resellers/${tenantId}/status`).send({ status: 'suspended', reason: 'ödeme' });
  try {
    const sahip = await panelGiris();
    const me = await sahip.get('/api/panel/me');
    assert.equal(me.body.tenant.status, 'suspended');
    assert.equal(me.body.tenant.status_reason, 'ödeme');
    assert.equal((await site().get('/')).status, 503);
    assert.equal((await site().get('/admin')).status, 200, 'askıdaki bayide panel sayfası açılmıyor');
  } finally {
    await admin.post(`/api/admin/resellers/${tenantId}/status`).send({ status: 'active' });
  }
});

test('sahibin işlemleri işlem kaydına düşer, Jet admini de görür; admin IP\'si bayiye gösterilmez', async () => {
  const sahip = await panelGiris();
  const kayit = await sahip.get('/api/panel/logs');
  const eylemler = new Set(kayit.body.activity.map(a => a.action));
  for (const e of ['owner_login', 'service_price_changed', 'services_bulk_changed', 'customer_balance_changed', 'site_settings_changed', 'customer_banned']) {
    assert.ok(eylemler.has(e), `panel kaydında ${e} yok`);
  }
  const adminIslemi = kayit.body.activity.find(a => a.actor_type === 'jet_admin');
  assert.ok(adminIslemi, 'admin işlemi kayıtta yok');
  assert.equal(adminIslemi.ip_address, null);
  const jet = await admin.get(`/api/admin/resellers/${tenantId}`);
  assert.ok(jet.body.activity.some(a => a.action === 'service_price_changed' && a.actor_type === 'owner'));
});
