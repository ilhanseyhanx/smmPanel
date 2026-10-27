// Bayinin kendi alan adi (F2b, Cloudflare for SaaS). Cloudflare cagrilari
// taklit edilir; akis: ekle -> bekliyor (markasiz 404) -> aktif -> site acilir.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-alanadi-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';
process.env.TENANT_BASE_DOMAIN = 'alan.test';
process.env.CLOUDFLARE_API_TOKEN = 'test-anahtar';
process.env.CLOUDFLARE_ZONE_ID = 'zone-1';
process.env.CLOUDFLARE_CNAME_TARGET = 'bayi-origin.alan.test';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');
const cloudflare = require('../services/cloudflare');

const SIFRE = 'AlanAdiTestSifresi_2026';
let admin;
let panel;
let tenantId;
let sahipId;
const cfKayit = new Map();
const silinen = [];
let sayac = 0;

cloudflare.createHostname = async hostname => {
  sayac += 1;
  const id = `cf-${sayac}`;
  cfKayit.set(id, { id, hostname, status: 'pending', ssl_status: 'initializing', txt_name: `_cf-custom-hostname.${hostname}`, txt_value: `deger-${sayac}`, error: null, active: false });
  return cfKayit.get(id);
};
cloudflare.getHostname = async id => cfKayit.get(id);
cloudflare.deleteHostname = async id => { silinen.push(id); return true; };

function site(host, agent = request.agent(app)) {
  const call = method => url => agent[method](url).set('Host', host);
  return { get: call('get'), post: call('post'), put: call('put'), delete: call('delete') };
}

test.before(async () => {
  await initDatabase();
  const ilk = request.agent(app);
  await ilk.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  await ilk.post('/api/admin/change-password').send({ current_password: 'admin12345', new_password: 'AlanAdiAdmin_2026' });
  admin = request.agent(app);
  await admin.post('/api/auth/login').send({ username: 'admin', password: 'AlanAdiAdmin_2026' });
  for (const u of ['alan_sahibi', 'baska_sahip']) {
    await request(app).post('/api/auth/register').send({ username: u, email: `${u}@site.com`, password: SIFRE });
  }
  sahipId = (await dbAsync.get("SELECT id FROM users WHERE username = 'alan_sahibi'")).id;
  tenantId = (await admin.post('/api/admin/resellers').send({ owner: 'alan_sahibi', name: 'Alan SMM', slug: 'alansmm' })).body.id;
  await admin.post('/api/admin/resellers').send({ owner: 'baska_sahip', name: 'Başka SMM', slug: 'baskasmm' });
  panel = site('alansmm.alan.test');
  assert.equal((await panel.post('/api/panel/login').send({ username: 'alan_sahibi', password: SIFRE })).status, 200);
});

test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('alan adı ekranı: alt adres, CNAME hedefi, geçersiz adresler reddedilir', async () => {
  const d = await panel.get('/api/panel/domains');
  assert.equal(d.status, 200);
  assert.equal(d.body.configured, true);
  assert.equal(d.body.cname_target, 'bayi-origin.alan.test');
  assert.equal(d.body.subdomain, 'alansmm.alan.test');
  for (const kotu of ['kanka', 'baska.alan.test', 'jetsmmpanel.com', 'www.jetsmmpanel.com', 'localhost']) {
    const res = await panel.post('/api/panel/domains').send({ domain: kotu });
    assert.equal(res.status, 400, kotu);
  }
  assert.equal(cfKayit.size, 0, 'geçersiz adres Cloudflare\'e gitmez');
});

test('ekle: Cloudflare kaydı açılır, doğrulanana kadar site açılmaz (markasız 404)', async () => {
  const res = await panel.post('/api/panel/domains').send({ domain: 'https://WWW.Kanka-Alan.com/' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.domain.hostname, 'www.kanka-alan.com');
  assert.equal(res.body.domain.status, 'pending');
  assert.equal(res.body.domain.txt_name, '_cf-custom-hostname.www.kanka-alan.com');
  const row = await dbAsync.get("SELECT * FROM tenant_domains WHERE domain = 'kanka-alan.com'");
  assert.equal(row.cf_hostname_id, 'cf-1');

  const bekleyen = await request(app).get('/').set('Host', 'www.kanka-alan.com').set('X-Bayi-Custom', '1');
  assert.equal(bekleyen.status, 404);
  assert.doesNotMatch(bekleyen.text, /SMMJET|jetsmmpanel|view-admin|Alan SMM/i);
  // Ana site adresinde baslik etkisizdir.
  assert.match((await request(app).get('/').set('X-Bayi-Custom', '1')).text, /view-admin/);
});

test('Cloudflare aktif deyince site www ve kök adreste açılır; sahibe bildirim gider', async () => {
  const kayit = cfKayit.get('cf-1');
  Object.assign(kayit, { status: 'active', ssl_status: 'active', active: true });
  const row = await dbAsync.get("SELECT id FROM tenant_domains WHERE domain = 'kanka-alan.com'");
  const kontrol = await panel.post(`/api/panel/domains/${row.id}/check`);
  assert.equal(kontrol.status, 200, JSON.stringify(kontrol.body));
  assert.equal(kontrol.body.domain.status, 'active');
  for (const host of ['www.kanka-alan.com', 'kanka-alan.com']) {
    const sayfa = await request(app).get('/').set('Host', host).set('X-Bayi-Custom', '1');
    assert.equal(sayfa.status, 200, host);
    assert.match(sayfa.text, /Alan SMM/);
  }
  const bildirim = await dbAsync.get("SELECT title FROM notifications WHERE user_id = ? AND title = 'Alan adın bağlandı'", [sahipId]);
  assert.ok(bildirim);
});

test('aynı alan adı başka bayiye eklenemez; en fazla 2 alan adı', async () => {
  const baska = site('baskasmm.alan.test');
  await baska.post('/api/panel/login').send({ username: 'baska_sahip', password: SIFRE });
  assert.equal((await baska.post('/api/panel/domains').send({ domain: 'kanka-alan.com' })).status, 409);
  assert.equal((await panel.post('/api/panel/domains').send({ domain: 'www.ikinci-alan.net' })).status, 201);
  assert.equal((await panel.post('/api/panel/domains').send({ domain: 'www.ucuncu-alan.org' })).status, 409);
});

test('kaldırınca Cloudflare kaydı silinir; bayi silinince kalan kayıtlar da temizlenir', async () => {
  const row = await dbAsync.get("SELECT id, cf_hostname_id FROM tenant_domains WHERE domain = 'ikinci-alan.net'");
  assert.equal((await panel.delete(`/api/panel/domains/${row.id}`)).status, 200);
  assert.ok(silinen.includes(row.cf_hostname_id));
  assert.equal(await dbAsync.get('SELECT id FROM tenant_domains WHERE id = ?', [row.id]), undefined);

  const kalan = await dbAsync.get("SELECT cf_hostname_id FROM tenant_domains WHERE domain = 'kanka-alan.com'");
  const sil = await admin.delete(`/api/admin/resellers/${tenantId}`).send({ confirm: 'alansmm' });
  assert.equal(sil.status, 200, JSON.stringify(sil.body));
  assert.ok(silinen.includes(kalan.cf_hostname_id));
  const sonra = await request(app).get('/').set('Host', 'www.kanka-alan.com').set('X-Bayi-Custom', '1');
  assert.equal(sonra.status, 404);
});
