const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-cost-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.ENABLE_DEMO_PAYMENTS = 'false';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');
const { formatDuration } = require('../services/telegramNotifier');

const ADMIN_PASSWORD = 'GuvenliAdminSifre_2026';

test.before(async () => {
  await initDatabase();
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  await agent.post('/api/admin/change-password').send({
    current_password: 'admin12345', new_password: ADMIN_PASSWORD
  });
  await dbAsync.run("INSERT OR REPLACE INTO site_settings (key, value) VALUES ('usd_try_rate', '48')");
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

// --- Sağlayıcı maliyeti kaydediliyor mu -----------------------------------

test('servis eklenirken sağlayıcı maliyeti veritabanına yazılır', async () => {
  const agent = await adminAgent();
  const res = await agent.post('/api/admin/services').send({
    category_name: 'Test Kategori',
    name: 'Instagram Followers Test',
    rate_per_1000: 213.41,          // satış ₺
    provider_cost_rate: 4.446,      // sağlayıcıya ödenen $
    provider_cost_currency: 'USD',
    min_quantity: 10,
    max_quantity: 10000
  });
  assert.equal(res.status, 200, res.body.error);

  const kayit = await dbAsync.get('SELECT * FROM services WHERE id = ?', [res.body.service_id]);
  assert.equal(Number(kayit.provider_cost_rate), 4.446, 'maliyet kaydedilmemiş (rapor 0 kalır)');
  assert.equal(kayit.provider_cost_currency, 'USD');
  assert.ok(kayit.provider_cost_updated_at, 'maliyet tarihi yazılmamış');
});

test('maliyet gönderilmezse alan boş kalır, hatalı 0 yazılmaz', async () => {
  const agent = await adminAgent();
  const res = await agent.post('/api/admin/services').send({
    category_name: 'Test Kategori',
    name: 'Manuel Servis',
    rate_per_1000: 50,
    min_quantity: 10,
    max_quantity: 1000
  });
  assert.equal(res.status, 200);
  const kayit = await dbAsync.get('SELECT * FROM services WHERE id = ?', [res.body.service_id]);
  assert.equal(kayit.provider_cost_rate, null, 'maliyeti bilinmeyen servis 0 olarak kaydedilmiş');
});

// --- İstatistik hem $ hem ₺ veriyor mu ------------------------------------

test('tedarikçiye giden para hem dolar hem TL olarak döner', async () => {
  const agent = await adminAgent();

  // Maliyeti bilinen bir servise sipariş yaz: 1000 adet, $4.446/1000 -> $4.446
  const servis = await dbAsync.get("SELECT id FROM services WHERE name = 'Instagram Followers Test'");
  const musteri = await dbAsync.get("SELECT id FROM users WHERE role = 'client' LIMIT 1");
  await dbAsync.run(
    `INSERT INTO orders (user_id, service_id, link, quantity, charge, charge_kurus, status)
     VALUES (?, ?, ?, ?, ?, ?, 'completed')`,
    [musteri.id, servis.id, 'https://instagram.com/test', 1000, 300, 30000]
  );

  const res = await agent.get('/api/admin/stats');
  assert.equal(res.status, 200);
  const s = res.body.stats;

  assert.equal(s.usd_try_rate, 48, 'panel kuru okunmamış');
  assert.ok(s.provider_cost_usd > 0, 'dolar maliyeti 0 kalmış');
  assert.ok(s.provider_cost > 0, 'TL maliyeti 0 kalmış');

  // 1000 adet x $4.446/1000 = $4.446
  assert.ok(Math.abs(s.provider_cost_usd - 4.446) < 0.02,
    `dolar maliyeti yanlış: ${s.provider_cost_usd} (beklenen ~4.45)`);
  // TL karşılığı kur ile tutarlı olmalı
  assert.ok(Math.abs(s.provider_cost - s.provider_cost_usd * 48) < 0.5,
    `TL karşılığı kurla uyuşmuyor: ${s.provider_cost} vs ${s.provider_cost_usd} x 48`);
});

test('maliyeti bilinmeyen siparişler ayrıca sayılır', async () => {
  const agent = await adminAgent();
  const manuel = await dbAsync.get("SELECT id FROM services WHERE name = 'Manuel Servis'");
  const musteri = await dbAsync.get("SELECT id FROM users WHERE role = 'client' LIMIT 1");
  await dbAsync.run(
    `INSERT INTO orders (user_id, service_id, link, quantity, charge, charge_kurus, status)
     VALUES (?, ?, ?, ?, ?, ?, 'completed')`,
    [musteri.id, manuel.id, 'https://instagram.com/x', 500, 25, 2500]
  );
  const res = await agent.get('/api/admin/stats');
  assert.ok(res.body.stats.orders_without_cost >= 1, 'maliyeti bilinmeyen sipariş sayılmamış');
});

// --- Süre biçimlendirme ---------------------------------------------------

test('sipariş süresi okunabilir biçimde yazılır', () => {
  const t = (saniye) => {
    const start = new Date('2026-08-15T10:00:00Z');
    const end = new Date(start.getTime() + saniye * 1000);
    return formatDuration(start, end);
  };
  assert.equal(t(45), '45 sn');
  assert.equal(t(60), '1 dk');
  assert.equal(t(192), '3 dk 12 sn');
  assert.equal(t(3600), '1 sa');
  assert.equal(t(7500), '2 sa 5 dk');
  assert.equal(t(86400), '1 gün');
  assert.equal(t(100800), '1 gün 4 sa');
});

test('geçersiz tarihlerde süre yazılmaz (bildirim bozulmaz)', () => {
  assert.equal(formatDuration('olmayan-tarih', new Date()), null);
  assert.equal(formatDuration(null, new Date()), null);
  // Bitis baslangictan onceyse (saat kaymasi) null doner
  assert.equal(formatDuration(new Date('2026-08-15T12:00:00Z'), new Date('2026-08-15T10:00:00Z')), null);
});

test('tamamlanma bildirimi fonksiyonu dışa aktarılmış', () => {
  const telegram = require('../services/telegramNotifier');
  assert.equal(typeof telegram.notifyOrderFinished, 'function');
  const worker = fs.readFileSync(path.join(__dirname, '..', 'services', 'orderWorker.js'), 'utf8');
  assert.ok(worker.includes('notifyOrderFinished'), 'worker tamamlanma bildirimini çağırmıyor');
  assert.ok(worker.includes('createdAt: order.created_at'), 'süre için sipariş tarihi gönderilmiyor');
});
