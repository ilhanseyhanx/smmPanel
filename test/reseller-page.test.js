// /bayilik tanitim sayfasi (F3): program anahtarina bagli; kapaliyken sayfa
// 404, menu baglantisi gizli, site haritasinda yok.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-bayilik-sayfa-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';
process.env.TENANT_BASE_DOMAIN = 'seyilstudios.test';

const { app } = require('../server');
const { initDatabase, db } = require('../config/database');

let admin;

test.before(async () => {
  await initDatabase();
  const ilk = request.agent(app);
  await ilk.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  await ilk.post('/api/admin/change-password').send({ current_password: 'admin12345', new_password: 'BayilikSayfa_2026' });
  admin = request.agent(app);
  await admin.post('/api/auth/login').send({ username: 'admin', password: 'BayilikSayfa_2026' });
});

test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('program kapalıyken /bayilik 404, menü bağlantısı gizli, haritada yok', async () => {
  const sayfa = await request(app).get('/bayilik');
  assert.equal(sayfa.status, 404);
  assert.doesNotMatch(sayfa.text, /id="bp2-title"/);
  const ana = await request(app).get('/');
  assert.match(ana.text, /data-reseller-nav hidden/);
  assert.doesNotMatch((await request(app).get('/sitemap.xml')).text, /\/bayilik/);
  assert.doesNotMatch((await request(app).get('/llms.txt')).text, /\/bayilik/);
});

test('program açılınca sayfa sunucuda basılır: fiyat, deneme, SSS ve JSON-LD', async () => {
  const kayit = await admin.put('/api/admin/resellers/settings').send({
    public_page_enabled: true, discount_percent: 10, applications_open: true, default_markup_percent: 30
  });
  assert.equal(kayit.status, 200, JSON.stringify(kayit.body));
  const sayfa = await request(app).get('/bayilik');
  assert.equal(sayfa.status, 200);
  assert.match(sayfa.text, /<h1 id="bp2-title">Kendi SMM panelini <span>1 dakikada<\/span> aç<\/h1>/);
  assert.match(sayfa.text, /id="bp-calc" data-fee="599"/);
  assert.match(sayfa.text, /₺2\.308/, 'hesaplayıcının ilk değeri: 10.000 TL satış, %30 kâr');
  assert.match(sayfa.text, /₺599/);
  assert.match(sayfa.text, /7 gün ücretsiz/);
  assert.match(sayfa.text, /siteadin\.seyilstudios\.test/);
  assert.match(sayfa.text, /id="bayilik-account"/);
  const ld = [...sayfa.text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
  const graph = ld.flatMap(x => x['@graph'] || [x]);
  assert.ok(graph.some(x => x['@type'] === 'FAQPage' && x.mainEntity.length >= 5));
  assert.ok(graph.some(x => x['@type'] === 'Service' && x.offers.price === '599' && x.offers.priceCurrency === 'TRY'));
  assert.match(sayfa.text, /<title>Bayilik - Kendi SMM Panelini Aç/);
  assert.doesNotMatch(sayfa.text, /data-reseller-nav hidden/, 'menü bağlantısı görünür');
  // Tanitim yalnizca kendi adresinde basilir.
  assert.doesNotMatch((await request(app).get('/services')).text, /id="bp2-title"/);
  assert.match((await request(app).get('/sitemap.xml')).text, /\/bayilik<\/loc>/);
  assert.match((await request(app).get('/llms.txt')).text, /\[Bayi Paneli\]\(http:\/\/localhost:3000\/bayilik\)/);
});
