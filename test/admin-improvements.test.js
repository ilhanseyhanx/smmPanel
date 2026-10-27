// 27 Eki 2026 iyilestirmeleri: destek talebi kapatma/yeniden acma ve kullanici
// adi, Genel Bakis donem filtresi, SEO dosyalari ve eski egitim adreslerinde
// bot kaydi, ayak izinde hizmet baglami (tiklama + liste secimi) ve admin
// menusunun akordeon davranisi.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-iyilestirme-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.ENABLE_DEMO_PAYMENTS = 'false';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');
const crawler = require('../services/crawlerTracker');

const ADMIN_PASSWORD = 'GuvenliAdminSifre_2026';
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
let admin;
let musteri;

test.before(async () => {
  await initDatabase();
  const ilk = request.agent(app);
  await ilk.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  await ilk.post('/api/admin/change-password').send({ current_password: 'admin12345', new_password: ADMIN_PASSWORD });
  admin = request.agent(app);
  assert.equal((await admin.post('/api/auth/login').set('User-Agent', CHROME).send({ username: 'admin', password: ADMIN_PASSWORD })).status, 200);
  musteri = request.agent(app);
  const kayit = await musteri.post('/api/auth/register').set('User-Agent', CHROME).send({ username: 'destek_musteri', email: 'destek@site.com', password: 'MusteriSifresi_2026' });
  assert.equal(kayit.status, 201, kayit.body.error);
});

test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('destek: admin kullanıcı adını görür, talebi kapatır/açar; müşteri yazınca talep yeniden açılır', async () => {
  const yeni = await musteri.post('/api/tickets').send({ subject: 'Ödeme Sorunu', message: 'Bakiye yüklenmedi.' });
  assert.equal(yeni.status, 200);
  const id = yeni.body.ticket_id;

  const liste = await admin.get('/api/tickets');
  const t = liste.body.tickets.find(x => x.id === id);
  assert.equal(t.username, 'destek_musteri');
  assert.equal(t.message_count, 1);
  assert.equal(t.last_sender, 'client');

  const detay = await admin.get(`/api/tickets/${id}`);
  assert.equal(detay.body.ticket.username, 'destek_musteri');
  assert.equal((await musteri.get(`/api/tickets/${id}`)).body.ticket.email, undefined, 'müşteriye e-posta dönmemeli');

  const kapat = await admin.post(`/api/tickets/${id}/status`).send({ status: 'closed' });
  assert.equal(kapat.status, 200, kapat.body.error);
  assert.equal(kapat.body.ticket.status, 'closed');
  assert.ok(kapat.body.ticket.closed_at);
  const bildirim = await dbAsync.get("SELECT title FROM notifications WHERE user_id = (SELECT id FROM users WHERE username = 'destek_musteri') ORDER BY id DESC LIMIT 1");
  assert.match(bildirim.title, /kapatıldı/);

  // Musteri dugmeyle yeniden acamaz; yazinca acilir.
  assert.equal((await musteri.post(`/api/tickets/${id}/status`).send({ status: 'open' })).status, 403);
  await musteri.post(`/api/tickets/${id}/reply`).send({ message: 'Hâlâ çözülmedi.' });
  const sonra = await dbAsync.get('SELECT status, closed_at FROM tickets WHERE id = ?', [id]);
  assert.equal(sonra.status, 'open');
  assert.equal(sonra.closed_at, null);

  // Musteri kendi talebini kapatabilir; admin yeniden acinca son mesaja gore durum alir.
  assert.equal((await musteri.post(`/api/tickets/${id}/status`).send({ status: 'closed' })).status, 200);
  const ac = await admin.post(`/api/tickets/${id}/status`).send({ status: 'open' });
  assert.equal(ac.body.ticket.status, 'open');
  assert.equal((await admin.post(`/api/tickets/${id}/status`).send({ status: 'bozuk' })).status, 400);
});

test('genel bakış: dönem filtresi siparişleri ve yeni müşteriyi seçilen döneme göre sayar', async () => {
  const user = await dbAsync.get("SELECT id FROM users WHERE username = 'destek_musteri'");
  const service = await dbAsync.get('SELECT id FROM services ORDER BY id LIMIT 1');
  const ekle = (when) => dbAsync.run(
    `INSERT INTO orders (user_id, service_id, link, quantity, charge, charge_kurus, status, created_at)
     VALUES (?, ?, 'https://instagram.com/x', 100, 10, 1000, 'completed', ${when})`, [user.id, service.id]);
  await ekle("datetime('now')");
  await ekle("datetime('now', '-40 days')");

  const tumu = (await admin.get('/api/admin/stats')).body;
  assert.equal(tumu.period, 'all');
  const bugun = (await admin.get('/api/admin/stats?period=today')).body;
  assert.equal(bugun.period, 'today');
  assert.equal(bugun.chart_unit, 'hour');
  assert.equal(bugun.dailySeries.length, 24);
  assert.equal(bugun.stats.total_orders, 1, 'bugün yalnızca 1 sipariş var');
  assert.equal(bugun.stats.total_revenue, 10);
  assert.ok(bugun.stats.new_users >= 1);
  const otuz = (await admin.get('/api/admin/stats?period=30d')).body;
  assert.equal(otuz.dailySeries.length, 30);
  assert.equal(otuz.stats.total_orders, 1, '40 gün önceki sipariş 30 günde sayılmaz');
  assert.ok(tumu.stats.total_orders >= 2);
  assert.equal((await admin.get('/api/admin/stats?period=bozuk')).body.period, 'all');
});

test('arama motoru: sitemap/robots ve eski eğitim adresleri bot kaydına girer', async () => {
  crawler._reset();
  await request(app).get('/sitemap.xml').set('User-Agent', GOOGLEBOT);
  await request(app).get('/robots.txt').set('User-Agent', GOOGLEBOT);
  const eski = await request(app).get('/egitimler/eski-ders').set('User-Agent', GOOGLEBOT);
  assert.equal(eski.status, 301);
  await new Promise(r => setTimeout(r, 50));
  const rapor = await crawler.report(24);
  const grup = Object.fromEntries(rapor.path_groups.map(g => [g.group, g.hits]));
  assert.equal(grup['seo-dosyasi'], 2);
  assert.equal(grup['eski-egitim'], 1);
  assert.equal(crawler.yolGrubu('/dijital-urunler'), 'dijital-urunler');

  const seo = await admin.get('/api/admin/health/seo?window=24h');
  assert.equal(seo.status, 200);
  assert.ok('ok_30d' in seo.body.indexnow);
  assert.ok('digital' in seo.body.sitemap.breakdown);
});

test('ayak izi: satır bağlamlı tıklama ve liste seçimi hizmet ilgisinde toplanır', async () => {
  const service = await dbAsync.get('SELECT id FROM services ORDER BY id LIMIT 1');
  const sid = `${Date.now().toString(16)}-iyilestirme-0001`.slice(0, 36);
  const res = await request(app).post('/api/track').set('User-Agent', CHROME).set('Content-Type', 'application/json').send(JSON.stringify({
    sid, hi: true, ctx: { path: '/services' },
    events: [
      { kind: 'page_view', path: '/services', ts: Date.now() },
      { kind: 'click', path: '/services', label: `Sipariş Ver · #${service.id} Test`, meta: { sid: service.id }, ts: Date.now() },
      { kind: 'select_change', path: '/new-order', label: `Servis Seçin: #${service.id}`, meta: { field: 'order-service-select', sid: service.id }, ts: Date.now() }
    ]
  }));
  assert.ok(res.status < 300, `track ${res.status}`);
  const kayit = await dbAsync.get("SELECT COUNT(*) n FROM track_events WHERE session_id = ? AND kind = 'select_change'", [sid]);
  assert.equal(kayit.n, 1, 'select_change kaydedilmeli');
  const ov = await admin.get('/api/admin/footprint/overview?range=7');
  assert.equal(ov.status, 200, ov.body.error);
  const satir = ov.body.services.find(s => Number(s.sid) === Number(service.id));
  assert.ok(satir, 'hizmet ilgisinde görünmeli');
  assert.equal(satir.clicks, 2);
  assert.ok(Array.isArray(ov.body.digital));
});

test('admin menüsü akordeon: yalnızca aktif sekmenin grubu açık kalır', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
  const govde = js.slice(js.indexOf('  syncAdminNavGroups(activeTab) {'), js.indexOf('  updateAdminNavGroupBadges() {'));
  assert.ok(govde.length > 0);
  assert.ok(!govde.includes("state[key] === 1"), 'kayıtlı açık gruplar artık birikmemeli');
  assert.match(js, /setAdminNavGroupOpen\(key, open\) \{[\s\S]*?group\.dataset\.navGroup === key \? open : false/);
});
