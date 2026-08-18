const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-istatistik-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.ENABLE_DEMO_PAYMENTS = 'false';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');
const { isBot, visitorHash } = require('../services/visitorTracker');

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
  await dbAsync.run('DELETE FROM orders');
  await dbAsync.run('DELETE FROM site_visits');
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

async function servisEkle(ad) {
  const r = await dbAsync.run(
    `INSERT INTO services (category_id, name, name_tr, rate_per_1000, rate_per_1000_kurus,
      min_quantity, max_quantity, status) VALUES (?, ?, ?, 10, 1000, 10, 100000, 1)`,
    [kategoriId, ad, ad]
  );
  return r.id;
}

async function siparisEkle(servisId, { durum = 'completed', adet = 1000, tutarKurus = 1000 } = {}) {
  await dbAsync.run(
    `INSERT INTO orders (user_id, service_id, link, quantity, charge, charge_kurus, status)
     VALUES (?, ?, 'https://instagram.com/x', ?, ?, ?, ?)`,
    [musteriId, servisId, adet, tutarKurus / 100, tutarKurus, durum]
  );
}

// --- Yetki ------------------------------------------------------------------

test('istatistik ucu yetkisiz erişime kapalıdır', async () => {
  assert.equal((await request(app).get('/api/admin/statistics')).status, 401);
});

// --- Servis istatistigi -----------------------------------------------------

test('SADECE satın alınan servisler listelenir, diğerleri gelmez', async () => {
  const agent = await adminAgent();
  const satilan = await servisEkle('Satılan Servis');
  const satilmayan = await servisEkle('Hiç Satılmayan Servis');

  await siparisEkle(satilan);
  await siparisEkle(satilan);
  await siparisEkle(satilan);

  const res = await agent.get('/api/admin/statistics');
  assert.equal(res.status, 200, res.body.error);

  const idler = res.body.services.map(s => s.id);
  assert.ok(idler.includes(satilan), 'satın alınan servis listede yok');
  assert.ok(!idler.includes(satilmayan), 'hiç satılmamış servis listeye girmiş');

  const kayit = res.body.services.find(s => s.id === satilan);
  assert.equal(kayit.order_count, 3, `sipariş sayısı yanlış: ${kayit.order_count}`);
  assert.equal(kayit.total_quantity, 3000, 'toplam adet yanlış');
});

test('iptal ve başarısız siparişler satış sayılmaz', async () => {
  const agent = await adminAgent();
  const servis = await servisEkle('İptalli Servis');
  await siparisEkle(servis, { durum: 'completed' });
  await siparisEkle(servis, { durum: 'canceled' });
  await siparisEkle(servis, { durum: 'failed' });

  const res = await agent.get('/api/admin/statistics');
  const kayit = res.body.services.find(s => s.id === servis);
  assert.equal(kayit.order_count, 1, 'iptal/başarısız siparişler de sayılmış');
});

test('servisler en çok satılandan aza doğru sıralanır', async () => {
  const agent = await adminAgent();
  const res = await agent.get('/api/admin/statistics');
  const sayilar = res.body.services.map(s => s.order_count);
  const sirali = [...sayilar].sort((a, b) => b - a);
  assert.deepEqual(sayilar, sirali, 'sıralama en çok satılandan başlamıyor');
});

test('pasife alınmış ama satılmış servis istatistikte kalır', async () => {
  const agent = await adminAgent();
  const servis = await servisEkle('Pasif Ama Satılmış');
  await siparisEkle(servis);
  await dbAsync.run('UPDATE services SET status = 0 WHERE id = ?', [servis]);

  const res = await agent.get('/api/admin/statistics');
  const kayit = res.body.services.find(s => s.id === servis);
  assert.ok(kayit, 'pasife alınan servisin geçmiş satışı kaybolmuş');
  assert.equal(kayit.status, 0);
});

// --- Blog okunma ------------------------------------------------------------

test('blog yazısı okundukça görüntülenme sayacı artar', async () => {
  const agent = await adminAgent();
  const slug = 'istatistik-test-yazisi';
  await dbAsync.run(
    `INSERT INTO blog_posts (title, title_tr, slug, category, category_tr, summary, content, content_tr, status, published_at)
     VALUES ('İstatistik Testi','İstatistik Testi',?,'Genel','Genel','özet','içerik','içerik','published',CURRENT_TIMESTAMP)`,
    [slug]
  );

  const once = await agent.get('/api/admin/statistics');
  const oncekiGoruntuleme = once.body.blog.posts.find(p => p.slug === slug).views;

  await request(app).get(`/api/blog/${slug}`);
  await request(app).get(`/api/blog/${slug}`);
  await request(app).get(`/api/blog/${slug}`);
  await new Promise(r => setTimeout(r, 150));   // sayac yaniti beklemeden artar

  const sonra = await agent.get('/api/admin/statistics');
  const yeni = sonra.body.blog.posts.find(p => p.slug === slug).views;
  assert.equal(yeni, oncekiGoruntuleme + 3, `görüntülenme artmadı: ${oncekiGoruntuleme} -> ${yeni}`);
});

test('blog özeti toplam görüntülenmeyi doğru hesaplar', async () => {
  const agent = await adminAgent();
  const res = await agent.get('/api/admin/statistics');
  const toplam = res.body.blog.posts.reduce((s, p) => s + (p.views || 0), 0);
  assert.equal(res.body.blog.total_views, toplam, 'toplam görüntülenme yanlış');
});

// --- Ziyaretci sayimi -------------------------------------------------------

test('sayfa açılışı tekil ziyaretçi olarak sayılır', async () => {
  const agent = await adminAgent();
  await dbAsync.run('DELETE FROM site_visits');

  await request(app).get('/').set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0)').set('X-Forwarded-For', '1.2.3.4');
  await new Promise(r => setTimeout(r, 150));

  const res = await agent.get('/api/admin/statistics');
  assert.equal(res.body.visitors.daily, 1, 'ziyaretçi sayılmadı');
  assert.equal(res.body.visitors.weekly, 1);
  assert.equal(res.body.visitors.monthly, 1);
});

test('aynı ziyaretçi gün içinde defalarca girse TEK sayılır', async () => {
  const agent = await adminAgent();
  await dbAsync.run('DELETE FROM site_visits');

  for (let i = 0; i < 5; i++) {
    await request(app).get('/').set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0)').set('X-Forwarded-For', '5.5.5.5');
  }
  await new Promise(r => setTimeout(r, 200));

  const res = await agent.get('/api/admin/statistics');
  assert.equal(res.body.visitors.daily, 1, `aynı kişi ${res.body.visitors.daily} kez sayılmış`);
});

test('farklı ziyaretçiler ayrı ayrı sayılır', async () => {
  const agent = await adminAgent();
  await dbAsync.run('DELETE FROM site_visits');

  await request(app).get('/').set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0)').set('X-Forwarded-For', '10.0.0.1');
  await request(app).get('/').set('User-Agent', 'Mozilla/5.0 (Macintosh)').set('X-Forwarded-For', '10.0.0.2');
  await request(app).get('/').set('User-Agent', 'Mozilla/5.0 (iPhone)').set('X-Forwarded-For', '10.0.0.3');
  await new Promise(r => setTimeout(r, 200));

  const res = await agent.get('/api/admin/statistics');
  assert.equal(res.body.visitors.daily, 3, `3 ziyaretçi beklenirken ${res.body.visitors.daily} sayıldı`);
});

test('botlar ziyaretçi olarak sayılmaz', async () => {
  const agent = await adminAgent();
  await dbAsync.run('DELETE FROM site_visits');

  for (const ua of ['Googlebot/2.1', 'facebookexternalhit/1.1', 'curl/8.0', 'python-requests/2.31', 'UptimeRobot/2.0']) {
    await request(app).get('/').set('User-Agent', ua).set('X-Forwarded-For', '20.0.0.1');
  }
  await new Promise(r => setTimeout(r, 200));

  const res = await agent.get('/api/admin/statistics');
  assert.equal(res.body.visitors.daily, 0, `bot sayılmış: ${res.body.visitors.daily}`);
});

test('haftalık ve aylık sayım aynı kişiyi tekrar saymaz', async () => {
  const agent = await adminAgent();
  await dbAsync.run('DELETE FROM site_visits');

  // Ayni ziyaretci 3 farkli gunde gelmis gibi kaydedelim
  const sahteHash = 'a'.repeat(32);
  await dbAsync.run("INSERT INTO site_visits (visitor_hash, visit_date) VALUES (?, date('now'))", [sahteHash]);
  await dbAsync.run("INSERT INTO site_visits (visitor_hash, visit_date) VALUES (?, date('now','-2 days'))", [sahteHash]);
  await dbAsync.run("INSERT INTO site_visits (visitor_hash, visit_date) VALUES (?, date('now','-20 days'))", [sahteHash]);

  const res = await agent.get('/api/admin/statistics');
  assert.equal(res.body.visitors.daily, 1);
  assert.equal(res.body.visitors.weekly, 1, 'haftalık sayımda aynı kişi tekrar sayılmış');
  assert.equal(res.body.visitors.monthly, 1, 'aylık sayımda aynı kişi tekrar sayılmış');
  assert.equal(res.body.visitors.total, 1, 'toplam sayımda aynı kişi tekrar sayılmış');
});

test('30 günlük ziyaretçi serisi eksiksiz döner', async () => {
  const agent = await adminAgent();
  const res = await agent.get('/api/admin/statistics');
  assert.equal(res.body.visitors.series.length, 30, 'seri 30 gün değil');
  assert.ok(res.body.visitors.series.every(d => typeof d.visitors === 'number'), 'boş günler doldurulmamış');
});

// --- Gizlilik ---------------------------------------------------------------

test('ham IP adresi veritabanına yazılmaz', async () => {
  await dbAsync.run('DELETE FROM site_visits');
  await request(app).get('/').set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0)').set('X-Forwarded-For', '77.88.99.111');
  await new Promise(r => setTimeout(r, 150));

  const kayitlar = await dbAsync.all('SELECT * FROM site_visits');
  assert.ok(kayitlar.length > 0, 'ziyaret kaydedilmemiş');
  const hepsi = JSON.stringify(kayitlar);
  assert.ok(!hepsi.includes('77.88.99.111'), 'ham IP veritabanına yazılmış (gizlilik ihlali)');
  assert.match(kayitlar[0].visitor_hash, /^[a-f0-9]{32}$/, 'hash biçimi beklenenden farklı');
});

test('bot tespiti ve hash üretimi doğrudur', () => {
  assert.equal(isBot('Googlebot/2.1'), true);
  assert.equal(isBot('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), false);
  assert.equal(isBot(''), true, 'boş user-agent bot sayılmalı');

  const istek = (ip, ua) => ({ headers: { 'user-agent': ua, 'accept-language': 'tr' }, ip });
  const a = visitorHash(istek('1.1.1.1', 'Chrome'));
  const b = visitorHash(istek('1.1.1.1', 'Chrome'));
  const c = visitorHash(istek('2.2.2.2', 'Chrome'));
  assert.equal(a, b, 'aynı ziyaretçi farklı hash almış');
  assert.notEqual(a, c, 'farklı ziyaretçiler aynı hash almış');
});
