// Bayi sitesi temalari (F4): 10 tema, 3 iskelet, ?tema= onizlemesi, panelden secim.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-tema-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';
process.env.TENANT_BASE_DOMAIN = 'tema.test';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');
const { THEME_KEYS, THEMES } = require('../tenant/themes');

const SIFRE = 'TemaTestSifresi_2026';
const HOST = 'renkli.tema.test';
let panel;

function site(agent = request.agent(app)) {
  const call = method => url => agent[method](url).set('Host', HOST);
  return { get: call('get'), post: call('post'), put: call('put') };
}
const htmlTag = text => text.match(/<html[^>]*>/)[0];

test.before(async () => {
  await initDatabase();
  const ilk = request.agent(app);
  await ilk.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  await ilk.post('/api/admin/change-password').send({ current_password: 'admin12345', new_password: 'TemaAdminSifre_2026' });
  const admin = request.agent(app);
  await admin.post('/api/auth/login').send({ username: 'admin', password: 'TemaAdminSifre_2026' });
  await request(app).post('/api/auth/register').send({ username: 'tema_sahibi', email: 'tema@site.com', password: SIFRE });
  assert.equal((await admin.post('/api/admin/resellers').send({ owner: 'tema_sahibi', name: 'Renkli SMM', slug: 'renkli' })).status, 201);
  panel = site();
  assert.equal((await panel.post('/api/panel/login').send({ username: 'tema_sahibi', password: SIFRE })).status, 200);
});

test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('10 tema ve 3 iskelet tanımlı; her temanın yazı tipi adresi geçerli biçimde', () => {
  assert.equal(THEME_KEYS.length, 10);
  assert.deepEqual([...new Set(Object.values(THEMES).map(t => t.layout))].sort(), ['klasik', 'tablo', 'vitrin']);
  for (const t of Object.values(THEMES)) assert.match(t.accent, /^#[0-9a-f]{6}$/);
});

test('varsayılan klasik; ?tema= önizlemesi o temayla açılır ve dizine eklenmez', async () => {
  const varsayilan = await site().get('/');
  assert.match(htmlTag(varsayilan.text), /data-theme="classic" data-layout="klasik"/);
  assert.doesNotMatch(varsayilan.text, /name="robots" content="noindex"/);
  assert.match(varsayilan.text, /--primary: #6366f1; --on-primary: #ffffff;/);

  const onizleme = await site().get('/?tema=neon');
  assert.match(htmlTag(onizleme.text), /data-theme="neon" data-layout="tablo"/);
  assert.match(onizleme.text, /name="robots" content="noindex"/);
  assert.match(onizleme.text, /--on-primary: #0b0b0f;/, 'açık vurgu renginde koyu yazı');
  assert.match(onizleme.text, /family=Sora/);

  const gecersiz = await site().get('/?tema=<script>');
  assert.match(htmlTag(gecersiz.text), /data-theme="classic"/);
  assert.doesNotMatch(gecersiz.text, /<script>"/);
  assert.equal((await site().get('/assets/themes.css')).status, 200);
});

test('bayi panelden tema seçer; ana renk temanın rengine döner', async () => {
  assert.equal((await panel.put('/api/panel/site').send({ name: 'Renkli SMM', primary_color: '#112233' })).status, 200);
  assert.match((await site().get('/')).text, /--primary: #112233;/);

  const liste = await panel.get('/api/panel/theme');
  assert.equal(liste.body.themes.length, 10);
  assert.equal(liste.body.current, 'classic');

  const sec = await panel.put('/api/panel/theme').send({ theme: 'glass' });
  assert.equal(sec.status, 200, JSON.stringify(sec.body));
  const sayfa = await site().get('/');
  assert.match(htmlTag(sayfa.text), /data-theme="glass" data-layout="vitrin"/);
  assert.match(sayfa.text, /--primary: #38bdf8;/, 'özel renk temayla sıfırlandı');
  assert.equal((await panel.get('/api/panel/site')).body.primary_color, '#38bdf8');

  assert.equal((await panel.put('/api/panel/theme').send({ theme: 'yok' })).status, 400);
  assert.equal((await site().put('/api/panel/theme').send({ theme: 'neon' })).status, 401);
  const kayit = await dbAsync.get("SELECT details FROM tenant_activity_logs WHERE action = 'theme_changed' ORDER BY id DESC");
  assert.deepEqual(JSON.parse(kayit.details), { from: 'classic', to: 'glass' });
});
