const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-toplusil-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.ENABLE_DEMO_PAYMENTS = 'false';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');

const ADMIN_PASSWORD = 'GuvenliAdminSifre_2026';
let kategoriId, musteriId;

test.before(async () => {
  await initDatabase();
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  await agent.post('/api/admin/change-password').send({
    current_password: 'admin12345', new_password: ADMIN_PASSWORD
  });
  kategoriId = (await dbAsync.get('SELECT id FROM categories LIMIT 1')).id;
  musteriId = (await dbAsync.get("SELECT id FROM users WHERE role = 'client' LIMIT 1")).id;
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

async function servisEkle(ad, { pasif = false } = {}) {
  const r = await dbAsync.run(
    `INSERT INTO services (category_id, name, name_tr, rate_per_1000, rate_per_1000_kurus,
      min_quantity, max_quantity, status) VALUES (?, ?, ?, 10, 1000, 10, 1000, ?)`,
    [kategoriId, ad, ad, pasif ? 0 : 1]
  );
  return r.id;
}

const varMi = async (id) => !!(await dbAsync.get('SELECT 1 FROM services WHERE id = ?', [id]));
const durumu = async (id) => (await dbAsync.get('SELECT status FROM services WHERE id = ?', [id]))?.status;

test('PASİF servisler toplu silinince gerçekten SİLİNİR (şikâyet edilen durum)', async () => {
  const agent = await adminAgent();
  const a = await servisEkle('Pasif Servis A', { pasif: true });
  const b = await servisEkle('Pasif Servis B', { pasif: true });

  const res = await agent.post('/api/admin/services/bulk-delete').send({ service_ids: [a, b] });
  assert.equal(res.status, 200, res.body.error);

  assert.equal(await varMi(a), false, 'pasif servis silinmedi, hâlâ duruyor');
  assert.equal(await varMi(b), false, 'pasif servis silinmedi, hâlâ duruyor');
  assert.equal(res.body.deleted, 2, 'silinen sayısı yanlış bildirildi');
  assert.match(res.body.message, /2 servis silindi/);
});

test('sipariş geçmişi olan servis silinmez, pasife alınır ve bu açıkça söylenir', async () => {
  const agent = await adminAgent();
  const temiz = await servisEkle('Temiz Servis');
  const siparisli = await servisEkle('Siparişli Servis');
  await dbAsync.run(
    `INSERT INTO orders (user_id, service_id, link, quantity, charge, charge_kurus, status)
     VALUES (?, ?, 'https://x.com/a', 100, 5, 500, 'completed')`,
    [musteriId, siparisli]
  );

  const res = await agent.post('/api/admin/services/bulk-delete').send({ service_ids: [temiz, siparisli] });
  assert.equal(res.status, 200, res.body.error);

  assert.equal(await varMi(temiz), false, 'geçmişi olmayan servis silinmeliydi');
  assert.equal(await varMi(siparisli), true, 'sipariş geçmişi olan servis silinmiş (veri kaybı)');
  assert.equal(await durumu(siparisli), 0, 'korunan servis pasife alınmamış');

  assert.equal(res.body.deleted, 1);
  assert.equal(res.body.kept, 1);
  assert.match(res.body.message, /1 servis silindi/);
  assert.match(res.body.message, /sipariş geçmişi/);
});

test('"TÜM SERVİSLERİ SİL" gerçekten siler, sadece geçmişi olanları bırakır', async () => {
  const agent = await adminAgent();

  // Once tabloyu temizle, kontrollu bir kume kur
  await dbAsync.run('DELETE FROM orders');
  await dbAsync.run('DELETE FROM services');
  const s1 = await servisEkle('Silinecek 1');
  const s2 = await servisEkle('Silinecek 2', { pasif: true });
  const s3 = await servisEkle('Korunacak');
  await dbAsync.run(
    `INSERT INTO orders (user_id, service_id, link, quantity, charge, charge_kurus, status)
     VALUES (?, ?, 'https://x.com/b', 100, 5, 500, 'completed')`,
    [musteriId, s3]
  );

  const res = await agent.post('/api/admin/services/bulk-delete').send({ delete_all: true });
  assert.equal(res.status, 200, res.body.error);

  assert.equal(await varMi(s1), false, 'aktif servis silinmedi');
  assert.equal(await varMi(s2), false, 'pasif servis silinmedi');
  assert.equal(await varMi(s3), true, 'sipariş geçmişi olan servis silinmiş');
  assert.equal(await durumu(s3), 0);
  assert.equal(res.body.deleted, 2);
  assert.equal(res.body.kept, 1);
});

test('kampanyaya bağlı servis silinmez (foreign key hatası vermez)', async () => {
  const agent = await adminAgent();
  await dbAsync.run('DELETE FROM orders');
  await dbAsync.run('DELETE FROM campaigns');
  await dbAsync.run('DELETE FROM services');

  const kampanyali = await servisEkle('Kampanyalı Servis');
  await dbAsync.run(
    `INSERT INTO campaigns (name, type, service_id, discount_percent, status)
     VALUES ('Test Kampanya', 'service_discount', ?, 20, 1)`,
    [kampanyali]
  );

  const res = await agent.post('/api/admin/services/bulk-delete').send({ service_ids: [kampanyali] });
  assert.equal(res.status, 200, res.body.error);
  assert.equal(await varMi(kampanyali), true, 'kampanyaya bağlı servis silinmiş');
  assert.equal(res.body.kept, 1);
});

test('silme işlemi kısmen başarısız olursa hiçbir şey değişmez (işlem bütünlüğü)', async () => {
  const agent = await adminAgent();
  await dbAsync.run('DELETE FROM orders');
  await dbAsync.run('DELETE FROM campaigns');
  await dbAsync.run('DELETE FROM services');

  const a = await servisEkle('Toplu A');
  const b = await servisEkle('Toplu B');
  const res = await agent.post('/api/admin/services/bulk-delete').send({ service_ids: [a, b, 999999] });
  assert.equal(res.status, 200, res.body.error);
  // Var olmayan id sessizce atlanir, gercek olanlar silinir
  assert.equal(await varMi(a), false);
  assert.equal(await varMi(b), false);
  assert.equal(res.body.deleted, 2);
});

test('servissiz kalan kategoriler temizlenir', async () => {
  const agent = await adminAgent();
  await dbAsync.run('DELETE FROM orders');
  await dbAsync.run('DELETE FROM services');

  const yeni = await dbAsync.run("INSERT INTO categories (name, icon) VALUES ('Geçici Kategori', 'fa-folder')");
  await dbAsync.run(
    `INSERT INTO services (category_id, name, name_tr, rate_per_1000, rate_per_1000_kurus,
      min_quantity, max_quantity, status) VALUES (?, 'Tek Servis', 'Tek Servis', 10, 1000, 10, 1000, 1)`,
    [yeni.id]
  );
  const servis = await dbAsync.get("SELECT id FROM services WHERE name = 'Tek Servis'");

  await agent.post('/api/admin/services/bulk-delete').send({ service_ids: [servis.id] });
  const kategori = await dbAsync.get('SELECT 1 FROM categories WHERE id = ?', [yeni.id]);
  assert.equal(kategori, undefined, 'boş kalan kategori silinmemiş');
});
