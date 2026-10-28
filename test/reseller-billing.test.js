// Bayi Paneli aboneligi (28 Eki 2026 modeli): Standart 599 / Pro 999 TL/ay,
// slug.taban adresinde 2 gun deneme, devam icin kendi alan adi zorunlu,
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
process.env.TENANT_LEGACY_BASE_DOMAINS = 'eski.test';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');
const billing = require('../services/resellerBilling');
const { invalidateTenantCache } = require('../tenant/resolve');

const SIFRE = 'AbonelikTestSifresi_2026';
const GUN = 86_400_000;
let admin;

function site(host, agent = request.agent(app)) {
  const call = method => url => agent[method](url).set('Host', host);
  return { get: call('get'), post: call('post'), put: call('put'), agent };
}

async function bayiAc(username, slug, bakiyeKurus, extra = {}) {
  await request(app).post('/api/auth/register').send({ username, email: `${username}@site.com`, password: SIFRE });
  const user = await dbAsync.get('SELECT id FROM users WHERE username = ?', [username]);
  await dbAsync.run('UPDATE users SET balance_kurus = ?, balance = ? WHERE id = ?', [bakiyeKurus, bakiyeKurus / 100, user.id]);
  const res = await admin.post('/api/admin/resellers').send({ owner: username, name: `${slug} SMM`, slug, ...extra });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const panel = site(`${slug}.abone.test`);
  assert.equal((await panel.post('/api/panel/login').send({ username, password: SIFRE })).status, 200);
  return { userId: user.id, tenantId: res.body.id, panel, host: `${slug}.abone.test`, domain: `${slug}.com` };
}

// Bayinin kendi alan adi (Cloudflare dogrulamasi testte atlanir).
async function alanAdiBagla(b) {
  await dbAsync.run("INSERT INTO tenant_domains (tenant_id, domain, status, activated_at) VALUES (?, ?, 'active', CURRENT_TIMESTAMP)", [b.tenantId, b.domain]);
  invalidateTenantCache();
}

const tenant = id => dbAsync.get('SELECT * FROM tenants WHERE id = ?', [id]);
const bakiye = async id => (await dbAsync.get('SELECT balance_kurus FROM users WHERE id = ?', [id])).balance_kurus;
const sonra = gun => new Date(Date.now() + gun * GUN);
const bildirimler = id => dbAsync.all('SELECT title, message FROM notifications WHERE user_id = ? AND type = ? ORDER BY id', [id, 'reseller']);

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

test('deneme 2 gün: son gün bir kez hatırlatılır (alan adı uyarısıyla); devam edilmezse site askıya alınır', async () => {
  const b = await bayiAc('deneme_sahibi', 'deneme1', 0);
  assert.equal((await tenant(b.tenantId)).plan_status, 'trial');
  const me = await b.panel.get('/api/panel/me');
  assert.equal(me.body.subscription.fee, 599);
  assert.equal(me.body.subscription.package, 'standart');
  assert.ok(me.body.subscription.hours_left <= 48 && me.body.subscription.hours_left >= 47);
  assert.equal((await site(b.host).get('/')).status, 200, 'deneme sitesi taban adreste açık');

  await billing.runBillingCycle(sonra(1.5));
  await billing.runBillingCycle(sonra(1.6));
  const uyarilar = await bildirimler(b.userId);
  assert.deepEqual(uyarilar.map(n => n.title), ['Bayi paneli denemen bitmek üzere']);
  assert.match(uyarilar[0].message, /alan adını bağla/);

  const sonuc = await billing.runBillingCycle(sonra(2.1));
  assert.equal(sonuc.expired, 1);
  const t = await tenant(b.tenantId);
  assert.equal(t.plan_status, 'expired');
  assert.equal(t.status, 'suspended');
  assert.equal((await site(b.host).get('/')).status, 503, 'askıdaki bayinin sitesi kapalı');
  assert.equal((await b.panel.get('/api/panel/me')).status, 200, 'panel askıda da açılır');
  assert.equal(await bakiye(b.userId), 0, 'devam demeyenden ücret alınmaz');
});

test('devam et kendi alan adı olmadan olmaz; alan adıyla deneme sonunda 599 TL alınır, fatura yazılır', async () => {
  const b = await bayiAc('devam_sahibi', 'devam1', 100000);
  const alansiz = await b.panel.post('/api/panel/subscription/continue');
  assert.equal(alansiz.status, 409);
  assert.equal(alansiz.body.code, 'DOMAIN_REQUIRED');
  assert.equal((await b.panel.get('/api/panel/subscription')).body.has_domain, false);

  await alanAdiBagla(b);
  const devam = await b.panel.post('/api/panel/subscription/continue');
  assert.equal(devam.status, 200, JSON.stringify(devam.body));
  assert.match(devam.body.message, /599/);
  assert.equal(await bakiye(b.userId), 100000, 'denemede hemen ücret alınmaz');

  const trialEnd = (await tenant(b.tenantId)).trial_ends_at;
  const sonuc = await billing.runBillingCycle(sonra(2.1));
  assert.equal(sonuc.charged, 1);
  assert.equal(await bakiye(b.userId), 100000 - 59900);
  const t = await tenant(b.tenantId);
  assert.equal(t.plan_status, 'active');
  const beklenen = (await dbAsync.get("SELECT datetime(?, '+1 month') AS v", [trialEnd])).v;
  assert.equal(t.paid_until, beklenen, 'dönem deneme bitişinden başlar');
  const fatura = await b.panel.get('/api/panel/subscription');
  assert.equal(fatura.body.invoices.length, 1);
  assert.equal(fatura.body.invoices[0].amount, 599);
  await billing.runBillingCycle(sonra(2.2));
  assert.equal(await bakiye(b.userId), 100000 - 59900, 'ikinci tur ikinci ücret almaz');
});

test('deneme bitince site yalnızca kendi alan adında açılır; taban adreste panel ve ödeme bildirimleri çalışır', async () => {
  const b = await bayiAc('tasima_sahibi', 'tasima1', 100000);
  await alanAdiBagla(b);
  await b.panel.post('/api/panel/subscription/continue');
  await billing.runBillingCycle(sonra(2.1));
  assert.equal((await tenant(b.tenantId)).plan_status, 'active');

  const yonlen = await site(b.host).get('/services?x=1');
  assert.equal(yonlen.status, 301);
  assert.equal(yonlen.headers.location, 'https://tasima1.com/services?x=1');
  assert.equal((await site(b.domain).get('/')).status, 200, 'kendi alan adında açık');
  assert.equal((await b.panel.get('/admin')).status, 200, 'panel taban adreste açık');
  assert.equal((await b.panel.get('/api/panel/me')).status, 200);
  const siparis = await site(b.host).post('/api/orders').send({ service_id: 1, link: 'https://x.com/a', quantity: 10 });
  assert.equal(siparis.status, 403, 'taban adreste vitrin işlemi yapılmaz');
  const geriBildirim = await site(b.host).post('/api/payments/paytr/callback').send({});
  assert.notEqual(geriBildirim.status, 403, 'deneme sırasında kurulan ödeme bildirimi adresi çalışmaya devam eder');
  // Eski taban adres de ayni kurala tabi.
  assert.equal((await site('tasima1.eski.test').get('/')).status, 301);
});

test('bakiye yetersiz: gecikmeye düşer; bakiye yüklenince ücret kendiliğinden alınır', async () => {
  const b = await bayiAc('gecikme_sahibi', 'gecikme1', 10000);
  await alanAdiBagla(b);
  await b.panel.post('/api/panel/subscription/continue');
  await billing.runBillingCycle(sonra(2.1));
  let t = await tenant(b.tenantId);
  assert.equal(t.plan_status, 'past_due');
  assert.equal(t.status, 'active');
  assert.ok((await bildirimler(b.userId)).some(n => n.title === 'Bayi paneli ücreti alınamadı'));

  await dbAsync.run('UPDATE users SET balance_kurus = 70000, balance = 700 WHERE id = ?', [b.userId]);
  await billing.runBillingCycle(sonra(3));
  t = await tenant(b.tenantId);
  assert.equal(t.plan_status, 'active');
  assert.equal(await bakiye(b.userId), 70000 - 59900);
});

test('gecikme süresi dolarsa askı; panelden ödeyince hemen yeniden açılır', async () => {
  const b = await bayiAc('aski_sahibi', 'aski1', 0);
  await alanAdiBagla(b);
  await b.panel.post('/api/panel/subscription/continue');
  await billing.runBillingCycle(sonra(2.1));
  assert.equal((await tenant(b.tenantId)).plan_status, 'past_due');
  await billing.runBillingCycle(sonra(9.5));
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
  assert.equal((await site(b.domain).get('/')).status, 200);
});

test('alan adı kaldırılırsa yenilenmez; askıdan 30 gün sonra bayi silinir, fatura kaydı kalır', async () => {
  const b = await bayiAc('silinecek_sahip', 'silinecek1', 200000);
  await alanAdiBagla(b);
  await b.panel.post('/api/panel/subscription/continue');
  await billing.runBillingCycle(sonra(2.1));
  await dbAsync.run('DELETE FROM tenant_domains WHERE tenant_id = ?', [b.tenantId]);
  await billing.runBillingCycle(sonra(2.1 + 31.5));
  assert.equal((await tenant(b.tenantId)).plan_status, 'expired', 'alan adı yoksa dönem sonunda askı');
  assert.equal(await bakiye(b.userId), 200000 - 59900, 'yenileme ücreti alınmadı');

  await billing.runBillingCycle(sonra(2.1 + 31.5 + 27.5));
  assert.ok((await bildirimler(b.userId)).some(n => n.title === 'Bayi panelin silinmek üzere'));
  const sonuc = await billing.runBillingCycle(sonra(2.1 + 31.5 + 30.5));
  assert.equal(sonuc.deleted, 1);
  assert.equal(await tenant(b.tenantId), undefined);
  assert.equal((await dbAsync.get('SELECT COUNT(*) AS n FROM tenant_invoices WHERE tenant_id = ?', [b.tenantId])).n, 1);
});

test('Pro paket 999 TL; Standart\'tan Pro\'ya geçişte kalan günün farkı alınır, Pro\'dan inişe dönem sonunda geçilir', async () => {
  const pro = await bayiAc('pro_sahibi', 'pro1', 200000, { package: 'pro' });
  assert.equal((await pro.panel.get('/api/panel/me')).body.subscription.fee, 999);
  await alanAdiBagla(pro);
  await pro.panel.post('/api/panel/subscription/continue');
  await billing.runBillingCycle(sonra(2.1));
  assert.equal(await bakiye(pro.userId), 200000 - 99900);

  const inis = await pro.panel.post('/api/panel/subscription/package').send({ package: 'standart' });
  assert.equal(inis.status, 200, JSON.stringify(inis.body));
  let t = await tenant(pro.tenantId);
  assert.equal(t.package, 'pro', 'dönem bitene kadar Pro');
  assert.equal(t.pending_package, 'standart');
  assert.equal((await pro.panel.get('/api/panel/subscription')).body.subscription.fee, 599, 'sonraki ücret Standart');
  await billing.runBillingCycle(sonra(2.1 + 31.5));
  t = await tenant(pro.tenantId);
  assert.equal(t.package, 'standart');
  assert.equal(t.pending_package, null);
  assert.equal(await bakiye(pro.userId), 200000 - 99900 - 59900);

  const yuksel = await bayiAc('yuksel_sahibi', 'yuksel1', 100000);
  await alanAdiBagla(yuksel);
  await yuksel.panel.post('/api/panel/subscription/continue');
  await billing.runBillingCycle(sonra(2.1));
  const once = await bakiye(yuksel.userId);
  const gec = await yuksel.panel.post('/api/panel/subscription/package').send({ package: 'pro' });
  assert.equal(gec.status, 200, JSON.stringify(gec.body));
  const fark = once - await bakiye(yuksel.userId);
  assert.ok(fark > 0 && fark <= 40000, `fark ${fark}`);
  assert.equal((await tenant(yuksel.tenantId)).package, 'pro');
  const faturalar = await dbAsync.all("SELECT note FROM tenant_invoices WHERE tenant_id = ? ORDER BY id", [yuksel.tenantId]);
  assert.equal(faturalar.at(-1).note, 'Pro paket farkı');
});

test('Pro: en az N Jet servisi açık kalır; Jet fiyatının altına satılamaz', async () => {
  const kategori = (await dbAsync.run("INSERT INTO categories (name, name_tr) VALUES ('Pro Test', 'Pro Test')")).id;
  const servis = (await dbAsync.run(
    `INSERT INTO services (category_id, name, name_tr, rate_per_1000, rate_per_1000_kurus, min_quantity, max_quantity, status)
     VALUES (?, 'Pro Takipçi', 'Pro Takipçi', 10, 1000, 10, 1000, 1)`, [kategori])).id;
  const toplam = (await dbAsync.get('SELECT COUNT(*) AS n FROM services WHERE status = 1 AND is_bundle = 0')).n;
  await admin.put('/api/admin/resellers/settings').send({ discount_percent: 10, applications_open: true, default_markup_percent: 30, pro_min_jet_services: toplam });

  const std = await bayiAc('std_sahibi', 'std1', 100000);
  assert.equal((await std.panel.put(`/api/panel/services/${servis}`).send({ enabled: false })).status, 200, 'Standart kapatabilir');
  const red = await std.panel.post('/api/panel/subscription/package').send({ package: 'pro' });
  assert.equal(red.status, 409);
  assert.equal(red.body.code, 'PRO_MIN_SERVICES');
  await std.panel.put(`/api/panel/services/${servis}`).send({ enabled: true });
  assert.equal((await std.panel.post('/api/panel/subscription/package').send({ package: 'pro' })).status, 200, 'denemede ücretsiz geçiş');

  const kapat = await std.panel.put(`/api/panel/services/${servis}`).send({ enabled: false });
  assert.equal(kapat.status, 409);
  const toplu = await std.panel.post('/api/panel/services/bulk').send({ service_ids: [servis], action: 'disable' });
  assert.equal(toplu.status, 409);

  // Jet fiyati 10,00; bayi alisi 9,00. Pro'da 9,50 sabit fiyat reddedilir; %5 kar Jet fiyatina yukselir.
  const ucuz = await std.panel.put(`/api/panel/services/${servis}`).send({ fixed_price: 9.5 });
  assert.equal(ucuz.status, 400);
  assert.match(ucuz.body.error, /Jet fiyatının/);
  await std.panel.put(`/api/panel/services/${servis}`).send({ markup_percent: 5 });
  const liste = await std.panel.get('/api/panel/services');
  const satir = liste.body.services.find(s => s.id === servis);
  assert.equal(satir.cost, 9);
  assert.equal(satir.jet_price, 10);
  assert.equal(satir.price, 10, 'Pro taban fiyatı Jet fiyatı');
  assert.equal(liste.body.pro, true);
  await admin.put('/api/admin/resellers/settings').send({ discount_percent: 10, applications_open: true, default_markup_percent: 30, pro_min_jet_services: 50 });
});

test('ücretsiz (comp) panel faturalanmaz ve taban adreste kalabilir; admin denemeyi uzatır', async () => {
  const comp = await bayiAc('comp_sahibi', 'comp1', 0, { plan: 'comp' });
  await billing.runBillingCycle(sonra(100));
  assert.equal((await tenant(comp.tenantId)).plan_status, 'comp');
  assert.equal((await site(comp.host).get('/')).status, 200, 'comp panel alt adreste açık');

  const b = await bayiAc('uzat_sahibi', 'uzat1', 0);
  await billing.runBillingCycle(sonra(2.1));
  assert.equal((await tenant(b.tenantId)).status, 'suspended');
  const uzat = await admin.post(`/api/admin/resellers/${b.tenantId}/subscription`).send({ action: 'trial', days: 14 });
  assert.equal(uzat.status, 200, JSON.stringify(uzat.body));
  const t = await tenant(b.tenantId);
  assert.equal(t.plan_status, 'trial');
  assert.equal(t.status, 'active');
  assert.equal(uzat.body.subscription.days_left, 14);
  const liste = await admin.get('/api/admin/resellers');
  assert.ok(liste.body.summary.fee_income_30d >= 599);
  assert.ok(liste.body.tenants.some(x => x.package === 'pro'));
});
