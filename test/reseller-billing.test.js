// Bayi Paneli aboneligi (F3): 7 gun deneme, 599 TL/ay Jet bakiyesinden,
// 7 gun gecikme payi, askidan 30 gun sonra silme. Zaman, runBillingCycle'a
// verilen "simdi" ile ileri alinir.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-abonelik-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.ENABLE_DEMO_PAYMENTS = 'false';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';
process.env.TENANT_BASE_DOMAIN = 'abone.test';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');
const billing = require('../services/resellerBilling');

const SIFRE = 'AbonelikTestSifresi_2026';
const GUN = 86_400_000;
let admin;

function site(host, agent = request.agent(app)) {
  const call = method => url => agent[method](url).set('Host', host);
  return { get: call('get'), post: call('post'), put: call('put'), agent };
}

async function bayiAc(username, slug, bakiyeKurus, plan) {
  await request(app).post('/api/auth/register').send({ username, email: `${username}@site.com`, password: SIFRE });
  const user = await dbAsync.get('SELECT id FROM users WHERE username = ?', [username]);
  await dbAsync.run('UPDATE users SET balance_kurus = ?, balance = ? WHERE id = ?', [bakiyeKurus, bakiyeKurus / 100, user.id]);
  const res = await admin.post('/api/admin/resellers').send({ owner: username, name: `${slug} SMM`, slug, ...(plan ? { plan } : {}) });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const panel = site(`${slug}.abone.test`);
  assert.equal((await panel.post('/api/panel/login').send({ username, password: SIFRE })).status, 200);
  return { userId: user.id, tenantId: res.body.id, panel, host: `${slug}.abone.test` };
}

const tenant = id => dbAsync.get('SELECT * FROM tenants WHERE id = ?', [id]);
const bakiye = async id => (await dbAsync.get('SELECT balance_kurus FROM users WHERE id = ?', [id])).balance_kurus;
const sonra = gun => new Date(Date.now() + gun * GUN);
const bildirimler = id => dbAsync.all('SELECT title FROM notifications WHERE user_id = ? AND type = ? ORDER BY id', [id, 'reseller']);

test.before(async () => {
  await initDatabase();
  const ilk = request.agent(app);
  await ilk.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  await ilk.post('/api/admin/change-password').send({ current_password: 'admin12345', new_password: 'AbonelikAdmin_2026' });
  admin = request.agent(app);
  await admin.post('/api/auth/login').send({ username: 'admin', password: 'AbonelikAdmin_2026' });
});

test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('deneme: 2 gün kala bir kez hatırlatılır; devam edilmezse bitince site askıya alınır', async () => {
  const b = await bayiAc('deneme_sahibi', 'deneme1', 0);
  const once = await tenant(b.tenantId);
  assert.equal(once.plan_status, 'trial');
  const me = await b.panel.get('/api/panel/me');
  assert.equal(me.body.subscription.plan_status, 'trial');
  assert.equal(me.body.subscription.fee, 599);

  await billing.runBillingCycle(sonra(5.5));
  await billing.runBillingCycle(sonra(5.6));
  assert.deepEqual((await bildirimler(b.userId)).map(n => n.title), ['Bayi paneli denemen bitmek üzere']);

  const sonuc = await billing.runBillingCycle(sonra(7.1));
  assert.equal(sonuc.expired, 1);
  const t = await tenant(b.tenantId);
  assert.equal(t.plan_status, 'expired');
  assert.equal(t.status, 'suspended');
  assert.equal((await site(b.host).get('/')).status, 503, 'askıdaki bayinin sitesi kapalı');
  assert.equal((await b.panel.get('/api/panel/me')).status, 200, 'panel askıda da açılır');
  assert.equal(await bakiye(b.userId), 0, 'devam demeyenden ücret alınmaz');
});

test('devam et: deneme sonunda 599 TL bakiyeden alınır, fatura yazılır, dönem 1 ay', async () => {
  const b = await bayiAc('devam_sahibi', 'devam1', 100000);
  const devam = await b.panel.post('/api/panel/subscription/continue');
  assert.equal(devam.status, 200, JSON.stringify(devam.body));
  assert.match(devam.body.message, /599/);
  assert.equal(await bakiye(b.userId), 100000, 'denemede hemen ücret alınmaz');

  const trialEnd = (await tenant(b.tenantId)).trial_ends_at;
  const sonuc = await billing.runBillingCycle(sonra(7.1));
  assert.equal(sonuc.charged, 1);
  assert.equal(await bakiye(b.userId), 100000 - 59900);
  const t = await tenant(b.tenantId);
  assert.equal(t.plan_status, 'active');
  const beklenen = (await dbAsync.get("SELECT datetime(?, '+1 month') AS v", [trialEnd])).v;
  assert.equal(t.paid_until, beklenen, 'dönem deneme bitişinden başlar');
  const fatura = await b.panel.get('/api/panel/subscription');
  assert.equal(fatura.body.invoices.length, 1);
  assert.equal(fatura.body.invoices[0].amount, 599);
  // Ayni turu tekrar calistirmak ikinci ucret almaz.
  await billing.runBillingCycle(sonra(7.2));
  assert.equal(await bakiye(b.userId), 100000 - 59900);
});

test('bakiye yetersiz: gecikmeye düşer, site açık kalır; bakiye yüklenince ücret kendiliğinden alınır', async () => {
  const b = await bayiAc('gecikme_sahibi', 'gecikme1', 10000);
  await b.panel.post('/api/panel/subscription/continue');
  await billing.runBillingCycle(sonra(7.1));
  let t = await tenant(b.tenantId);
  assert.equal(t.plan_status, 'past_due');
  assert.equal(t.status, 'active');
  assert.ok((await bildirimler(b.userId)).some(n => n.title === 'Bayi paneli ücreti alınamadı'));

  await dbAsync.run('UPDATE users SET balance_kurus = 70000, balance = 700 WHERE id = ?', [b.userId]);
  await billing.runBillingCycle(sonra(8));
  t = await tenant(b.tenantId);
  assert.equal(t.plan_status, 'active');
  assert.equal(await bakiye(b.userId), 70000 - 59900);
});

test('gecikme süresi (7 gün) dolarsa askı; panelden ödeyince hemen yeniden açılır', async () => {
  const b = await bayiAc('aski_sahibi', 'aski1', 0);
  await b.panel.post('/api/panel/subscription/continue');
  await billing.runBillingCycle(sonra(7.1));
  assert.equal((await tenant(b.tenantId)).plan_status, 'past_due');
  await billing.runBillingCycle(sonra(14.5));
  const t = await tenant(b.tenantId);
  assert.equal(t.plan_status, 'expired');
  assert.equal(t.status, 'suspended');

  const yetersiz = await b.panel.post('/api/panel/subscription/continue');
  assert.equal(yetersiz.status, 402);
  assert.equal(yetersiz.body.code, 'OWNER_BALANCE');

  await dbAsync.run('UPDATE users SET balance_kurus = 60000, balance = 600 WHERE id = ?', [b.userId]);
  const ode = await b.panel.post('/api/panel/subscription/continue');
  assert.equal(ode.status, 200, JSON.stringify(ode.body));
  const acik = await tenant(b.tenantId);
  assert.equal(acik.plan_status, 'active');
  assert.equal(acik.status, 'active');
  assert.equal(acik.status_reason, null);
  assert.equal((await site(b.host).get('/')).status, 200);
});

test('askıdan 30 gün sonra bayi silinir; 3 gün önce uyarılır; fatura kaydı kalır', async () => {
  const b = await bayiAc('silinecek_sahip', 'silinecek1', 100000);
  await b.panel.post('/api/panel/subscription/continue');
  await billing.runBillingCycle(sonra(7.1));
  await b.panel.post('/api/panel/subscription/cancel');
  await billing.runBillingCycle(sonra(7.1 + 31.5));
  assert.equal((await tenant(b.tenantId)).plan_status, 'expired', 'yenileme kapalıysa dönem sonunda askı');

  await billing.runBillingCycle(sonra(7.1 + 31.5 + 27.5));
  assert.ok((await bildirimler(b.userId)).some(n => n.title === 'Bayi panelin silinmek üzere'));
  assert.ok(await tenant(b.tenantId), 'süre dolmadan silinmez');

  const sonuc = await billing.runBillingCycle(sonra(7.1 + 31.5 + 30.5));
  assert.equal(sonuc.deleted, 1);
  assert.equal(await tenant(b.tenantId), undefined);
  assert.equal((await dbAsync.get('SELECT COUNT(*) AS n FROM tenant_invoices WHERE tenant_id = ?', [b.tenantId])).n, 1);
  assert.ok((await bildirimler(b.userId)).some(n => n.title === 'Bayi paneli silindi'));
});

test('ücretsiz (comp) panel faturalanmaz; admin süre uzatır ve askıyı kaldırır', async () => {
  const comp = await bayiAc('comp_sahibi', 'comp1', 0, 'comp');
  await billing.runBillingCycle(sonra(100));
  assert.equal((await tenant(comp.tenantId)).plan_status, 'comp');
  assert.equal((await tenant(comp.tenantId)).status, 'active');

  const b = await bayiAc('uzat_sahibi', 'uzat1', 0);
  await billing.runBillingCycle(sonra(7.1));
  assert.equal((await tenant(b.tenantId)).status, 'suspended');
  const uzat = await admin.post(`/api/admin/resellers/${b.tenantId}/subscription`).send({ action: 'trial', days: 14 });
  assert.equal(uzat.status, 200, JSON.stringify(uzat.body));
  const t = await tenant(b.tenantId);
  assert.equal(t.plan_status, 'trial');
  assert.equal(t.status, 'active');
  assert.equal(uzat.body.subscription.days_left, 14);

  const liste = await admin.get('/api/admin/resellers');
  assert.ok(liste.body.summary.fee_income_30d >= 599);
  assert.ok(liste.body.tenants.every(x => x.subscription && x.subscription.plan_status));
});
