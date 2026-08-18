const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-duyuru-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.ENABLE_DEMO_PAYMENTS = 'false';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');

const ADMIN_PASSWORD = 'GuvenliAdminSifre_2026';

test.before(async () => {
  await initDatabase();
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  await agent.post('/api/admin/change-password').send({
    current_password: 'admin12345', new_password: ADMIN_PASSWORD
  });
});

test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

async function adminAgent() {
  const agent = request.agent(app);
  const login = await agent.post('/api/auth/login').send({ username: 'admin', password: ADMIN_PASSWORD });
  assert.equal(login.status, 200);
  return agent;
}

const anasayfa = async () => (await request(app).get('/')).text;

test('duyuru yazılınca ana sayfada görünür', async () => {
  const agent = await adminAgent();
  const kaydet = await agent.post('/api/admin/settings').send({
    announcement_tr: 'Açılışa özel %20 indirim!', announcement_en: 'Grand opening 20% off!'
  });
  assert.equal(kaydet.status, 200, kaydet.body.error);

  const html = await anasayfa();
  assert.ok(html.includes('id="announcement-bar"'), 'duyuru bandı sayfada yok');
  assert.ok(html.includes('Açılışa özel %20 indirim!'), 'duyuru metni basılmamış');
});

test('duyuru boşaltılınca bant sayfadan TAMAMEN kalkar', async () => {
  const agent = await adminAgent();
  const kaydet = await agent.post('/api/admin/settings').send({
    announcement_tr: '', announcement_en: ''
  });
  assert.equal(kaydet.status, 200, kaydet.body.error);

  const html = await anasayfa();
  assert.ok(!html.includes('id="announcement-bar"'), 'duyuru bandı hâlâ sayfada duruyor');
  // Asil sikayet: HTML'e gomulu eski kampanya metni ekranda kaliyordu
  assert.ok(!html.includes('Bahar Kampanyası'), 'HTML\'deki eski kampanya metni hâlâ görünüyor');
  // Sayfanin geri kalani bozulmamali
  assert.ok(html.includes('class="navbar"'), 'sayfanın geri kalanı bozulmuş');
  assert.ok(html.includes('id="app-viewport"'), 'ana içerik kaybolmuş');
});

test('sadece boşluk girilen duyuru da bandı kaldırır', async () => {
  const agent = await adminAgent();
  await agent.post('/api/admin/settings').send({ announcement_tr: '   ' });
  const html = await anasayfa();
  assert.ok(!html.includes('id="announcement-bar"'), 'boşluk duyuru sayılmış');
});

test('duyuru metnindeki özel karakterler HTML olarak yorumlanmaz', async () => {
  const agent = await adminAgent();
  await agent.post('/api/admin/settings').send({
    announcement_tr: '<script>alert(1)</script> & "indirim"'
  });
  const html = await anasayfa();
  assert.ok(!html.includes('<script>alert(1)</script>'), 'duyuru metni HTML olarak basılmış (XSS riski)');
  assert.ok(html.includes('&lt;script&gt;'), 'özel karakterler kaçışlanmamış');
  assert.ok(html.includes('&amp;'), '& kaçışlanmamış');
});

test('açılışa özel modu bant sınıfına yansır', async () => {
  const agent = await adminAgent();
  await agent.post('/api/admin/settings').send({
    announcement_tr: 'Kutlama zamanı', announcement_special: '1'
  });
  const html = await anasayfa();
  assert.ok(html.includes('announcement-launch'), 'kutlama modu sınıfı eklenmemiş');

  await agent.post('/api/admin/settings').send({
    announcement_tr: 'Normal duyuru', announcement_special: '0'
  });
  const html2 = await anasayfa();
  assert.ok(html2.includes('id="announcement-bar"'), 'bant kaybolmuş');
  assert.ok(!html2.includes('announcement-launch'), 'kutlama modu kapanmamış');
});

test('duyuru değişikliği anında yayına girer (önbellek tazelenir)', async () => {
  const agent = await adminAgent();
  await agent.post('/api/admin/settings').send({ announcement_tr: 'Birinci duyuru' });
  assert.ok((await anasayfa()).includes('Birinci duyuru'));

  // Onbellek tazelenmezse eski metin kalirdi
  await agent.post('/api/admin/settings').send({ announcement_tr: 'İkinci duyuru' });
  const html = await anasayfa();
  assert.ok(html.includes('İkinci duyuru'), 'yeni duyuru yayına girmemiş (önbellek tazelenmiyor)');
  assert.ok(!html.includes('Birinci duyuru'), 'eski duyuru hâlâ görünüyor');
});
