// F4 2/3 ve 3/3: logo, sekme simgesi, ana sayfa metinleri, demo bayi ve
// /bayilik tema galerisi.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-marka-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.TENANT_ASSETS_DIR = path.join(tempDir, 'uploads');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';
process.env.TENANT_BASE_DOMAIN = 'marka.test';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');
const { invalidateTenantCache } = require('../tenant/resolve');

const SIFRE = 'MarkaTestSifresi_2026';
const HOST = 'markali.marka.test';
// 1x1 seffaf PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const ICO = `data:image/x-icon;base64,${Buffer.from([0, 0, 1, 0, 1, 0, 16, 16, 0, 0, 1, 0, 32, 0]).toString('base64')}`;
let admin;
let panel;
let tenantId;

function site(host = HOST, agent = request.agent(app)) {
  const call = method => url => agent[method](url).set('Host', host);
  return { get: call('get'), post: call('post'), put: call('put'), delete: call('delete') };
}

test.before(async () => {
  await initDatabase();
  const ilk = request.agent(app);
  await ilk.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  await ilk.post('/api/admin/change-password').send({ current_password: 'admin12345', new_password: 'MarkaAdminSifre_2026' });
  admin = request.agent(app);
  await admin.post('/api/auth/login').send({ username: 'admin', password: 'MarkaAdminSifre_2026' });
  await request(app).post('/api/auth/register').send({ username: 'marka_sahibi', email: 'marka@site.com', password: SIFRE });
  tenantId = (await admin.post('/api/admin/resellers').send({ owner: 'marka_sahibi', name: 'Markalı SMM', slug: 'markali' })).body.id;
  panel = site();
  assert.equal((await panel.post('/api/panel/login').send({ username: 'marka_sahibi', password: SIFRE })).status, 200);
});

test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('logo yüklenir, sitede görünür, doğru türle sunulur; adı gizleme seçeneği', async () => {
  assert.equal((await site().get('/brand/logo')).status, 404);
  const yukle = await panel.post('/api/panel/branding/logo').send({ data: PNG });
  assert.equal(yukle.status, 200, JSON.stringify(yukle.body));
  assert.match(yukle.body.logo_url, /^\/brand\/logo\?v=/);
  const dosya = await site().get('/brand/logo');
  assert.equal(dosya.status, 200);
  assert.match(dosya.headers['content-type'], /image\/png/);
  const sayfa = await site().get('/');
  assert.match(sayfa.text, /<img class="sf-brand-logo" src="\/brand\/logo\?v=/);
  assert.doesNotMatch(sayfa.text, /sf-sr-only/);
  assert.equal((await panel.put('/api/panel/branding').send({ hide_name: true })).status, 200);
  assert.match((await site().get('/')).text, /sf-brand-name sf-sr-only/);
});

test('SVG, metin ve büyük dosya reddedilir; simge ICO kabul edilir; kaldırınca sunulmaz', async () => {
  const svg = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64')}`;
  assert.equal((await panel.post('/api/panel/branding/logo').send({ data: svg })).status, 400);
  assert.equal((await panel.post('/api/panel/branding/logo').send({ data: 'data:text/plain;base64,bWVyaGFiYQ==' })).status, 400);
  const buyuk = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(320 * 1024)]);
  assert.equal((await panel.post('/api/panel/branding/logo').send({ data: `data:image/png;base64,${buyuk.toString('base64')}` })).status, 400);
  assert.equal((await panel.post('/api/panel/branding/kotu').send({ data: PNG })).status, 404);

  assert.equal((await panel.post('/api/panel/branding/favicon').send({ data: ICO })).status, 200);
  assert.match((await site().get('/')).text, /rel="icon" href="\/brand\/favicon\?v=/);
  assert.match((await site().get('/brand/favicon')).headers['content-type'], /image\/x-icon/);

  assert.equal((await panel.delete('/api/panel/branding/logo')).status, 200);
  assert.equal((await site().get('/brand/logo')).status, 404);
  assert.match((await site().get('/')).text, /sf-brand-mark/);
  assert.equal((await site().post('/api/panel/branding/logo').send({ data: PNG })).status, 401);
});

test('ana sayfa başlığı, metni ve alt bilgi bayinin yazdığı gibi; HTML kaçırılır', async () => {
  const kaydet = await panel.put('/api/panel/site').send({
    name: 'Markalı SMM', hero_title: 'Takipçini [anında] <b>artır</b>', hero_text: 'En hızlı servisler', footer_text: 'Telegram: @markali'
  });
  assert.equal(kaydet.status, 200, JSON.stringify(kaydet.body));
  const sayfa = (await site().get('/')).text;
  assert.match(sayfa, /<h1>Takipçini <span>anında<\/span> artır<\/h1>/);
  assert.match(sayfa, /<p>En hızlı servisler<\/p>/);
  assert.match(sayfa, /<span class="sf-footer-text">Telegram: @markali<\/span>/);
  const ayar = await panel.get('/api/panel/site');
  assert.equal(ayar.body.footer_text, 'Telegram: @markali');
});

test('bayi silinince yüklenen görselleri de silinir', async () => {
  await panel.post('/api/panel/branding/logo').send({ data: PNG });
  const klasor = path.join(process.env.TENANT_ASSETS_DIR, String(tenantId));
  assert.ok(fs.existsSync(klasor));
  assert.equal((await admin.delete(`/api/admin/resellers/${tenantId}`).send({ confirm: 'markali' })).status, 200);
  assert.ok(!fs.existsSync(klasor));
});

test('demo bayi: site şeridi, kayıt/sipariş kapalı, arama motorlarına kapalı', async () => {
  const sahip = (await dbAsync.run("INSERT INTO users (username, email, password) VALUES ('demo_bayi', 'demo@x.invalid', 'x')")).id;
  await dbAsync.run("INSERT INTO tenants (owner_user_id, slug, name, plan_status, settings_json) VALUES (?, 'demo', 'Demo SMM', 'comp', ?)",
    [sahip, JSON.stringify({ demo: true })]);
  invalidateTenantCache();
  const demo = site('demo.marka.test');
  const sayfa = await demo.get('/?tema=neon');
  assert.equal(sayfa.status, 200);
  assert.match(sayfa.text, /sf-demo-bar/);
  assert.match(sayfa.text, /href="\/\/demo-neon\.marka\.test\/"/);
  assert.match(sayfa.text, /name="robots" content="noindex"/);
  assert.match((await demo.get('/robots.txt')).text, /Disallow: \//);
  const kayit = await demo.post('/api/auth/register').send({ username: 'deneme', email: 'd@x.com', password: 'DenemeSifre_2026' });
  assert.equal(kayit.status, 403);
  assert.equal((await demo.get('/api/services')).status, 200, 'okuma açık');
});

test('/bayilik canlı demolar her tema için demo sitesine bağlanır; demo- adresleri ayrılmış', async () => {
  await admin.put('/api/admin/resellers/settings').send({ public_page_enabled: true, discount_percent: 10, applications_open: true, default_markup_percent: 30 });
  const sayfa = (await request(app).get('/bayilik')).text;
  assert.match(sayfa, /10 hazır tema/);
  assert.match(sayfa, /https:\/\/demo-cam\.marka\.test\//);
  assert.match(sayfa, /https:\/\/demo\.marka\.test\/admin/);
  const { validateSlug } = require('../services/resellers');
  assert.equal(validateSlug('demo-neon').ok, false);
  assert.equal(validateSlug('demolar').ok, true);
});
