const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-link-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.ENABLE_DEMO_PAYMENTS = 'false';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');

let begeniServisId, takipciServisId;

test.before(async () => {
  await initDatabase();
  const kategori = await dbAsync.get('SELECT id FROM categories LIMIT 1');
  const begeni = await dbAsync.run(
    `INSERT INTO services (category_id, name, name_tr, name_en, rate_per_1000, rate_per_1000_kurus,
      min_quantity, max_quantity, status) VALUES (?,?,?,?,?,?,?,?,1)`,
    [kategori.id, 'Instagram Likes [Turkey] Real', 'Instagram Beğeni [Türk]', 'Instagram Likes [Turkey]', 1, 100, 10, 10000]
  );
  begeniServisId = begeni.id;
  const takipci = await dbAsync.run(
    `INSERT INTO services (category_id, name, name_tr, name_en, rate_per_1000, rate_per_1000_kurus,
      min_quantity, max_quantity, status) VALUES (?,?,?,?,?,?,?,?,1)`,
    [kategori.id, 'Instagram Followers [Real]', 'Instagram Takipçi', 'Instagram Followers', 1, 100, 10, 10000]
  );
  takipciServisId = takipci.id;
});

test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

async function musteri() {
  const agent = request.agent(app);
  const login = await agent.post('/api/auth/login').send({ username: 'demo_user', password: 'user12345' });
  assert.equal(login.status, 200, 'demo müşteri girişi başarısız');
  return { agent, userId: login.body.user.id };
}

const bakiye = async (userId) =>
  (await dbAsync.get('SELECT balance_kurus FROM users WHERE id = ?', [userId])).balance_kurus;

test('yanlış link ile sipariş reddedilir VE bakiyeden para düşmez', async () => {
  const { agent, userId } = await musteri();
  const oncekiBakiye = await bakiye(userId);
  const oncekiSiparis = await dbAsync.get('SELECT COUNT(*) c FROM orders WHERE user_id = ?', [userId]);

  // Beğeni servisine profil linki: İlhan'ın Peakerr'da yaptığı hatanın aynısı
  const res = await agent.post('/api/orders').send({
    service_id: begeniServisId,
    link: 'https://www.instagram.com/kullaniciadi',
    quantity: 100,
    drip_runs: 1
  });

  assert.equal(res.status, 400, 'sipariş reddedilmeliydi');
  assert.match(res.body.error, /gönderi/i, 'hata mesajı gönderi linki istemeli');

  assert.equal(await bakiye(userId), oncekiBakiye, 'BAKİYEDEN PARA DÜŞMÜŞ - kritik hata');
  const sonrakiSiparis = await dbAsync.get('SELECT COUNT(*) c FROM orders WHERE user_id = ?', [userId]);
  assert.equal(sonrakiSiparis.c, oncekiSiparis.c, 'reddedilen sipariş veritabanına yazılmış');
});

test('hata mesajı müşterinin diline göre döner', async () => {
  const { agent } = await musteri();
  const res = await agent.post('/api/orders').send({
    service_id: begeniServisId,
    link: 'https://www.instagram.com/kullaniciadi',
    quantity: 100,
    drip_runs: 1,
    lang: 'en'
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /post\/video link/i);
});

test('yanlış platform linki de engellenir', async () => {
  const { agent, userId } = await musteri();
  const oncekiBakiye = await bakiye(userId);
  const res = await agent.post('/api/orders').send({
    service_id: takipciServisId,
    link: 'https://www.tiktok.com/@kullanici',
    quantity: 100,
    drip_runs: 1
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /Instagram/);
  assert.equal(await bakiye(userId), oncekiBakiye, 'bakiyeden para düşmüş');
});

test('doğru link ile sipariş link kontrolüne takılmaz', async () => {
  const { agent } = await musteri();
  // Sağlayıcı test ortamında erişilemez olduğu için 502 bekleriz; onemli olan
  // 400 (link hatasi) ALMAMAK - yani dogru link kontrolden gecmis olmali.
  const res = await agent.post('/api/orders').send({
    service_id: begeniServisId,
    link: 'https://www.instagram.com/p/Cxyz123abc/',
    quantity: 100,
    drip_runs: 1
  });
  assert.notEqual(res.status, 400, `doğru link reddedildi: ${res.body.error}`);
});

test('takipçi servisinde sadece kullanıcı adı kabul edilir', async () => {
  const { agent } = await musteri();
  const res = await agent.post('/api/orders').send({
    service_id: takipciServisId,
    link: 'kullaniciadi',
    quantity: 100,
    drip_runs: 1
  });
  assert.notEqual(res.status, 400, `kullanıcı adı reddedildi: ${res.body.error}`);
});
