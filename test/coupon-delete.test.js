const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-kupon-'));
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
  assert.equal(login.status, 200, 'admin girişi başarısız');
  return agent;
}

test('kupon oluşturulup silinebilir', async () => {
  const agent = await adminAgent();

  const olustur = await agent.post('/api/admin/coupons').send({
    code: 'SILINEBILIRMI', code_en: 'CANDELETE', amount: 25, max_uses: 100
  });
  assert.equal(olustur.status, 200, olustur.body.error);

  const kupon = await dbAsync.get("SELECT * FROM coupons WHERE code = 'SILINEBILIRMI'");
  assert.ok(kupon, 'kupon oluşturulmadı');

  const sil = await agent.delete(`/api/admin/coupons/${kupon.id}`);
  assert.equal(sil.status, 200, sil.body.error);

  const kalan = await dbAsync.get('SELECT * FROM coupons WHERE id = ?', [kupon.id]);
  assert.equal(kalan, undefined, 'kupon silinmedi, hâlâ duruyor');
});

test('KULLANILMIŞ kupon da silinebilir (asıl şikâyet edilen durum)', async () => {
  const agent = await adminAgent();

  const olustur = await agent.post('/api/admin/coupons').send({
    code: 'KULLANILMIS', code_en: 'USEDONE', amount: 25, max_uses: 100
  });
  assert.equal(olustur.status, 200, olustur.body.error);
  const kupon = await dbAsync.get("SELECT * FROM coupons WHERE code = 'KULLANILMIS'");

  // Müşteri kuponu kullansın: user_coupons tablosunda kayıt oluşur
  const musteri = await dbAsync.get("SELECT id FROM users WHERE role = 'client' LIMIT 1");
  await dbAsync.run('INSERT INTO user_coupons (user_id, coupon_id) VALUES (?, ?)', [musteri.id, kupon.id]);
  const kullanim = await dbAsync.get('SELECT COUNT(*) n FROM user_coupons WHERE coupon_id = ?', [kupon.id]);
  assert.equal(kullanim.n, 1, 'kullanım kaydı oluşmadı');

  const sil = await agent.delete(`/api/admin/coupons/${kupon.id}`);
  assert.equal(sil.status, 200, sil.body.error);

  const kalan = await dbAsync.get('SELECT * FROM coupons WHERE id = ?', [kupon.id]);
  assert.equal(kalan, undefined, 'kullanılmış kupon silinemedi');

  // Kupon silinince kullanım kayitlari oksuz kalmamali
  const artik = await dbAsync.get('SELECT COUNT(*) n FROM user_coupons WHERE coupon_id = ?', [kupon.id]);
  assert.equal(artik.n, 0, 'kupon silindi ama kullanım kayıtları öksüz kaldı');
});

test('olmayan kupon silinmeye çalışılırsa 404 döner', async () => {
  const agent = await adminAgent();
  const sil = await agent.delete('/api/admin/coupons/999999');
  assert.equal(sil.status, 404, `beklenen 404, gelen ${sil.status}`);
});

test('geçersiz id ile silme reddedilir', async () => {
  const agent = await adminAgent();
  assert.equal((await agent.delete('/api/admin/coupons/abc')).status, 400);
  assert.equal((await agent.delete('/api/admin/coupons/-5')).status, 400);
});

test('yetkisiz kullanıcı kupon silemez', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({
    username: 'kupon_denek', email: 'kupon@example.com', password: 'GuvenliSifre_123'
  });
  assert.equal((await agent.delete('/api/admin/coupons/1')).status, 403);
});
