// Egitimler: sayfa basimi, kilitli icerik, bakiyeyle satin alma, eksik
// tutarin Shopier'den odenip egitimin otomatik acilmasi, okuma takibi,
// admin istatistikleri, iade ve site haritasi.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-courses-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.ENABLE_DEMO_PAYMENTS = 'false';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';
process.env.PAYMENT_RATE_LIMIT_MAX = '500';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');

const PAT = 'test-personal-access-token-123456';
const WEBHOOK_TOKEN = 'test-webhook-signing-token';
const ADMIN_PASSWORD = 'GuvenliAdminSifre_2026';

// --- Sahte Shopier sunucusu (bkz. shopier-and-duplicate-service.test.js) ---
const sahte = { urunler: new Map(), sonrakiId: 5000 };
function sahteShopierKur() {
  const mock = express();
  mock.use(express.json());
  mock.use((req, res, next) => (req.headers.authorization === `Bearer ${PAT}` ? next() : res.status(401).json({ message: 'Invalid token' })));
  mock.post('/v1/products', (req, res) => {
    const id = String(sahte.sonrakiId++);
    sahte.urunler.set(id, req.body);
    res.json({ id, url: `https://www.shopier.com/${id}` });
  });
  mock.delete('/v1/products/:id', (req, res) => { sahte.urunler.delete(String(req.params.id)); res.json({ success: true }); });
  mock.get('/v1/orders', (req, res) => res.json([]));
  mock.post('/v1/webhooks', (req, res) => res.json({ id: 'wh1', event: req.body.event, url: req.body.url, token: WEBHOOK_TOKEN }));
  mock.delete('/v1/webhooks/:id', (req, res) => res.json({ success: true }));
  return new Promise(resolve => {
    const server = mock.listen(0, '127.0.0.1', () => {
      process.env.SHOPIER_API_BASE = `http://127.0.0.1:${server.address().port}/v1`;
      resolve(server);
    });
  });
}

let mockServer;
let admin;
const ids = {};

async function adminAgent() {
  const agent = request.agent(app);
  const login = await agent.post('/api/auth/login').send({ username: 'admin', password: ADMIN_PASSWORD });
  assert.equal(login.status, 200, 'admin girisi basarisiz');
  return agent;
}

async function musteriAgent() {
  const agent = request.agent(app);
  const login = await agent.post('/api/auth/login').send({ username: 'demo_user', password: 'user12345' });
  assert.equal(login.status, 200, 'demo girisi basarisiz');
  return agent;
}

async function bakiyeAyarla(kurus) {
  await dbAsync.run('UPDATE users SET balance_kurus = ?, balance = ? / 100.0 WHERE username = ?', [kurus, kurus, 'demo_user']);
}

async function bakiye() {
  return (await dbAsync.get('SELECT balance_kurus FROM users WHERE username = ?', ['demo_user'])).balance_kurus;
}

function webhookGonder(govde) {
  const metin = JSON.stringify(govde);
  return request(app)
    .post('/api/payments/shopier/webhook')
    .set('Content-Type', 'application/json')
    .set('Shopier-Signature', crypto.createHmac('sha256', WEBHOOK_TOKEN).update(metin).digest('hex'))
    .send(metin);
}

async function egitimOlustur(agent, { title, price, lessons = 3 }) {
  const res = await agent.post('/api/admin/courses').send({ title, price, free_lesson_count: 2, status: 'published', description: '<p>Tanıtım <script>alert(1)</script></p>' });
  assert.equal(res.status, 201, res.body.error);
  const course = await dbAsync.get('SELECT * FROM courses WHERE id = ?', [res.body.id]);
  assert.equal(course.status, 'draft', 'yeni egitim dersi yokken yayina alinmamali');
  assert.ok(!course.description.includes('<script'), 'tanitim metni temizlenmemis');
  const lessonIds = [];
  for (let i = 1; i <= lessons; i++) {
    const l = await agent.post(`/api/admin/courses/${course.id}/lessons`).send({
      title: `Ders ${i} Başlığı`, summary: `Ders ${i} özeti`, content: `<h2>Bölüm</h2><p>GIZLI-ICERIK-${course.id}-${i} ${'kelime '.repeat(250)}</p>`
    });
    assert.equal(l.status, 201, l.body.error);
    lessonIds.push(l.body.id);
  }
  const pub = await agent.put(`/api/admin/courses/${course.id}`).send({ status: 'published' });
  assert.equal(pub.status, 200, pub.body.error);
  return { id: course.id, slug: course.slug, lessonIds };
}

test.before(async () => {
  await initDatabase();
  mockServer = await sahteShopierKur();
  const ilk = request.agent(app);
  await ilk.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  await ilk.post('/api/admin/change-password').send({ current_password: 'admin12345', new_password: ADMIN_PASSWORD });
  admin = await adminAgent();
  const pat = await admin.post('/api/admin/shopier/pat').send({ pat: PAT });
  assert.equal(pat.status, 200, pat.body.error);
  ids.a = await egitimOlustur(admin, { title: 'Instagram 0dan 10K Eğitimi', price: 150 });
  ids.b = await egitimOlustur(admin, { title: 'TikTok Keşfet Rehberi', price: 200 });
});

test.after(async () => {
  await new Promise(resolve => mockServer.close(resolve));
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

// --- SAYFALAR -----------------------------------------------------------------

test('katalog sayfası yayındaki eğitimleri sunucuda basar', async () => {
  const res = await request(app).get('/egitimler');
  assert.equal(res.status, 200);
  assert.match(res.text, /Instagram 0dan 10K Eğitimi/);
  assert.match(res.text, /TikTok Keşfet Rehberi/);
  assert.match(res.text, /<link rel="canonical" href="http:\/\/localhost:3000\/egitimler">/);
  assert.match(res.text, /<body class="neo-app-active"/);
  assert.ok(!/<meta name="robots"[^>]*noindex/.test(res.text), 'katalog indekslenebilir olmalı');
  assert.equal((res.text.match(/<h1[\s>]/g) || []).length, 1, 'tek h1 olmalı');
});

test('eğitim sayfası: Course şeması, ücretsiz dersler bağlantı, kilitliler düğme', async () => {
  const res = await request(app).get(`/egitimler/${ids.a.slug}`);
  assert.equal(res.status, 200);
  assert.match(res.text, /"@type":"Course"/);
  assert.match(res.text, new RegExp(`href="/egitimler/${ids.a.slug}/ders-1-basligi"`));
  assert.match(res.text, new RegExp(`href="/egitimler/${ids.a.slug}/ders-2-basligi"`));
  assert.ok(!res.text.includes(`href="/egitimler/${ids.a.slug}/ders-3-basligi"`), 'kilitli derse bağlantı verilmemeli');
  assert.match(res.text, /data-crs-buy/);
});

test('ücretsiz ders herkese açık ve indekslenir', async () => {
  const res = await request(app).get(`/egitimler/${ids.a.slug}/ders-1-basligi`);
  assert.equal(res.status, 200);
  assert.match(res.text, new RegExp(`GIZLI-ICERIK-${ids.a.id}-1`));
  assert.ok(!/<meta name="robots"[^>]*noindex/.test(res.text), 'ücretsiz ders indekslenebilir olmalı');
});

test('kilitli ders ziyaretçiye içerik göstermez ve noindex olur', async () => {
  const res = await request(app).get(`/egitimler/${ids.a.slug}/ders-3-basligi`);
  assert.equal(res.status, 200);
  assert.ok(!res.text.includes(`GIZLI-ICERIK-${ids.a.id}-3`), 'kilitli içerik sızdı');
  assert.match(res.text, /Bu ders eğitimi satın alanlara açık/);
  assert.match(res.text, /<meta name="robots" content="noindex, follow">/);
});

test('olmayan eğitim / ders yönlendirilir, taslak eğitim ziyaretçiye görünmez', async () => {
  assert.equal((await request(app).get('/egitimler/yok-boyle-egitim')).status, 302);
  assert.equal((await request(app).get(`/egitimler/${ids.a.slug}/yok-boyle-ders`)).status, 302);
  await dbAsync.run("INSERT INTO courses (slug, title, status) VALUES ('taslak-egitim', 'Taslak', 'draft')");
  const res = await request(app).get('/egitimler/taslak-egitim');
  assert.equal(res.status, 302);
  const katalog = await request(app).get('/egitimler');
  assert.ok(!katalog.text.includes('taslak-egitim'));
});

test('site haritası eğitimi ve ücretsiz dersleri içerir, kilitli dersi içermez', async () => {
  const res = await request(app).get('/sitemap.xml');
  assert.match(res.text, /\/egitimler<\/loc>/);
  assert.match(res.text, new RegExp(`/egitimler/${ids.a.slug}</loc>`));
  assert.match(res.text, new RegExp(`/egitimler/${ids.a.slug}/ders-2-basligi</loc>`));
  assert.ok(!res.text.includes(`/egitimler/${ids.a.slug}/ders-3-basligi`));
});

// --- BAKIYEYLE SATIN ALMA -----------------------------------------------------

test('satın alma giriş ve dijital içerik onayı ister', async () => {
  assert.equal((await request(app).post(`/api/courses/${ids.a.slug}/purchase`).send({ consent: true })).status, 401);
  const agent = await musteriAgent();
  const res = await agent.post(`/api/courses/${ids.a.slug}/purchase`).send({});
  assert.equal(res.status, 400);
});

test('bakiye yetmezse 402 ve eksik tutar döner, bakiyeye dokunulmaz', async () => {
  await bakiyeAyarla(4000);
  const agent = await musteriAgent();
  const res = await agent.post(`/api/courses/${ids.a.slug}/purchase`).send({ consent: true });
  assert.equal(res.status, 402);
  assert.equal(res.body.code, 'insufficient_balance');
  assert.equal(res.body.shortfall, 110);
  assert.equal(res.body.pay_amount, 110);
  assert.equal(await bakiye(), 4000);
  const q = await agent.get(`/api/courses/${ids.a.slug}/quote`);
  assert.equal(q.status, 200);
  assert.equal(q.body.price, 150);
  assert.equal(q.body.balance, 40);
  assert.equal(q.body.shopier_ready, true);
});

test('bakiye yeterliyse eğitim alınır, kilitli ders sahibine açılır', async () => {
  await bakiyeAyarla(20000);
  const agent = await musteriAgent();
  const res = await agent.post(`/api/courses/${ids.a.slug}/purchase`).send({ consent: true });
  assert.equal(res.status, 201, res.body.error);
  assert.equal(await bakiye(), 5000);
  const purchase = await dbAsync.get('SELECT * FROM course_purchases WHERE course_id = ?', [ids.a.id]);
  assert.equal(purchase.price_kurus, 15000);
  assert.equal(purchase.source, 'balance');
  assert.ok(purchase.consent_at, 'onay zamanı kaydedilmeli');

  const ders = await agent.get(`/egitimler/${ids.a.slug}/ders-3-basligi`);
  assert.match(ders.text, new RegExp(`GIZLI-ICERIK-${ids.a.id}-3`));
  assert.match(ders.headers['cache-control'], /private/);

  const tekrar = await agent.post(`/api/courses/${ids.a.slug}/purchase`).send({ consent: true });
  assert.equal(tekrar.status, 409);
  assert.equal(await bakiye(), 5000, 'ikinci satın alma bakiyeden düşmemeli');
});

// --- SHOPIER: EKSIK TUTAR -----------------------------------------------------

test('bakiye yetmezse eksik tutar kadar Shopier ödemesi açılır, ödeme gelince eğitim otomatik alınır', async () => {
  await bakiyeAyarla(5000);
  const agent = await musteriAgent();
  const res = await agent.post('/api/payments/shopier/course-checkout').send({ course_slug: ids.b.slug, consent: true });
  assert.equal(res.status, 201, res.body.error);
  assert.equal(res.body.amount, 150, 'ödenecek = fiyat (200) - bakiye (50)');
  const intent = await dbAsync.get('SELECT * FROM payment_intents WHERE merchant_oid = ?', [res.body.merchant_oid]);
  assert.equal(intent.course_id, ids.b.id);
  assert.equal(intent.amount_kurus, 15000);
  assert.match(sahte.urunler.get(intent.provider_ref).title, /^Eğitim: TikTok Keşfet Rehberi/);

  const once = await agent.get(`/api/payments/shopier/status/${res.body.merchant_oid}`);
  assert.equal(once.body.course_owned, false);

  const hook = await webhookGonder({
    id: `ORD-${Date.now()}`, paymentStatus: 'paid',
    lineItems: [{ productId: intent.provider_ref, price: '150.00', total: '150.00', quantity: 1 }]
  });
  assert.equal(hook.status, 200);
  assert.equal(await bakiye(), 0, '50 bakiye + 150 ödeme = 200 eğitime gitmeli');
  const purchase = await dbAsync.get('SELECT * FROM course_purchases WHERE course_id = ?', [ids.b.id]);
  assert.equal(purchase.source, 'shopier');
  assert.equal(purchase.payment_intent_id, intent.id);

  const sonra = await agent.get(`/api/payments/shopier/status/${res.body.merchant_oid}`);
  assert.equal(sonra.body.status, 'completed');
  assert.equal(sonra.body.course_owned, true);
});

test('eksik tutar 10 TL altındaysa 10 TL ödetilir, artan bakiyede kalır', async () => {
  const c = await egitimOlustur(admin, { title: 'Profil Optimizasyonu', price: 99 });
  await bakiyeAyarla(9500); // eksik 4 TL
  const agent = await musteriAgent();
  const res = await agent.post('/api/payments/shopier/course-checkout').send({ course_slug: c.slug, consent: true });
  assert.equal(res.status, 201, res.body.error);
  assert.equal(res.body.amount, 10);
  const intent = await dbAsync.get('SELECT * FROM payment_intents WHERE merchant_oid = ?', [res.body.merchant_oid]);
  await webhookGonder({
    id: `ORD-${Date.now()}-b`, paymentStatus: 'paid',
    lineItems: [{ productId: intent.provider_ref, price: '10.00', total: '10.00', quantity: 1 }]
  });
  assert.equal(await bakiye(), 600, '95 + 10 - 99 = 6 TL kalmalı');
  assert.ok(await dbAsync.get('SELECT 1 FROM course_purchases WHERE course_id = ?', [c.id]));
});

test('bakiye yeterken Shopier ödemesi açılmaz', async () => {
  const c = await egitimOlustur(admin, { title: 'Viral İçerik Formülü', price: 5 });
  const agent = await musteriAgent();
  const res = await agent.post('/api/payments/shopier/course-checkout').send({ course_slug: c.slug, consent: true });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'enough_balance');
});

// --- OKUMA TAKIBI ---------------------------------------------------------------

test('ücretsiz ders okuması sayılır, kilitli ders ziyaretçiden sayılmaz, süre sınırlanır', async () => {
  const [l1, , l3] = ids.a.lessonIds;
  const visitor = 'ziyaretci12345678';
  await request(app).post('/api/courses/track').send({ lesson_id: l1, visitor_id: visitor, seconds: 15 }).expect(204);
  await request(app).post('/api/courses/track').send({ lesson_id: l1, visitor_id: visitor, seconds: 60, completed: true }).expect(204);
  const row = await dbAsync.get('SELECT * FROM course_reading WHERE lesson_id = ? AND viewer_key = ?', [l1, `v:${visitor}`]);
  assert.equal(row.seconds, 45, 'tek istekte en fazla 30 sn yazılmalı');
  assert.equal(row.completed, 1);

  await request(app).post('/api/courses/track').send({ lesson_id: l3, visitor_id: visitor, seconds: 15 }).expect(204);
  assert.equal(await dbAsync.get('SELECT 1 FROM course_reading WHERE lesson_id = ? AND viewer_key = ?', [l3, `v:${visitor}`]), undefined);

  // Sahibi kilitli dersi okuyabilir ve sayilir.
  const agent = await musteriAgent();
  await agent.post('/api/courses/track').send({ lesson_id: l3, seconds: 20 }).expect(204);
  assert.ok(await dbAsync.get("SELECT 1 FROM course_reading WHERE lesson_id = ? AND viewer_key LIKE 'u:%'", [l3]));
});

test('sayfa görüntüleme olayı 30 dk içinde tekrar yazılmaz', async () => {
  for (let i = 0; i < 3; i++) {
    await request(app).post('/api/courses/event').send({ course_id: ids.a.id, type: 'page_view', visitor_id: 'tekrarlayan123' }).expect(204);
  }
  const n = await dbAsync.get("SELECT COUNT(*) n FROM course_events WHERE course_id = ? AND viewer_key = 'v:tekrarlayan123'", [ids.a.id]);
  assert.equal(n.n, 1);
});

// --- ADMIN ----------------------------------------------------------------------

test('admin istatistikleri: özet, ders bazında okuma ve satışlar', async () => {
  const overview = await admin.get('/api/admin/courses/overview?days=30');
  assert.equal(overview.status, 200, overview.body.error);
  assert.ok(overview.body.kpi.sales >= 3);
  assert.equal(overview.body.series.length, 30);
  assert.ok(overview.body.kpi.readers >= 2);

  const stats = await admin.get(`/api/admin/courses/${ids.a.id}/stats`);
  assert.equal(stats.status, 200, stats.body.error);
  const ilk = stats.body.lessons[0];
  assert.equal(ilk.is_free, true);
  assert.ok(ilk.readers >= 1);
  assert.equal(stats.body.lessons[2].is_free, false);
  assert.ok(stats.body.top_members.some(m => m.username === 'demo_user' && m.owned));

  const sales = await admin.get('/api/admin/courses/sales');
  assert.equal(sales.status, 200);
  assert.ok(sales.body.purchases.length >= 3);
  assert.ok(sales.body.intents.length >= 2);

  const list = await admin.get('/api/admin/courses');
  const a = list.body.courses.find(c => c.id === ids.a.id);
  assert.equal(a.sales, 1);
  assert.equal(a.lesson_count, 3);
});

test('admin dışı kullanıcı yönetim uçlarına erişemez', async () => {
  const agent = await musteriAgent();
  assert.equal((await agent.get('/api/admin/courses')).status, 403);
  assert.equal((await request(app).get('/api/admin/courses')).status, 401);
});

test('satışı olan eğitim silinemez; iade bakiyeyi geri verir ve erişimi kaldırır', async () => {
  const del = await admin.delete(`/api/admin/courses/${ids.a.id}`);
  assert.equal(del.status, 409);

  await bakiyeAyarla(0);
  const purchase = await dbAsync.get('SELECT id FROM course_purchases WHERE course_id = ?', [ids.a.id]);
  const res = await admin.post(`/api/admin/courses/purchases/${purchase.id}/refund`);
  assert.equal(res.status, 200, res.body.error);
  assert.equal(await bakiye(), 15000);
  const agent = await musteriAgent();
  const ders = await agent.get(`/egitimler/${ids.a.slug}/ders-3-basligi`);
  assert.ok(!ders.text.includes(`GIZLI-ICERIK-${ids.a.id}-3`), 'iade sonrası erişim kalmamalı');
});

test('hediye: admin kullanıcıya eğitimi ücretsiz tanımlar', async () => {
  const res = await admin.post(`/api/admin/courses/${ids.a.id}/grant`).send({ username: 'demo_user' });
  assert.equal(res.status, 200, res.body.error);
  const p = await dbAsync.get('SELECT * FROM course_purchases WHERE course_id = ?', [ids.a.id]);
  assert.equal(p.source, 'gift');
  assert.equal(p.price_kurus, 0);
  assert.equal((await admin.post(`/api/admin/courses/${ids.a.id}/grant`).send({ username: 'demo_user' })).status, 409);
});

test('ders sırası değiştirilebilir ve ücretsiz dersler yeni sıraya göre belirlenir', async () => {
  const [l1, l2, l3] = ids.b.lessonIds;
  const res = await admin.post(`/api/admin/courses/${ids.b.id}/lessons/reorder`).send({ ids: [l3, l1, l2] });
  assert.equal(res.status, 200, res.body.error);
  const sayfa = await request(app).get(`/egitimler/${ids.b.slug}/ders-3-basligi`);
  assert.match(sayfa.text, new RegExp(`GIZLI-ICERIK-${ids.b.id}-3`), 'başa alınan ders ücretsiz olmalı');
  const eksik = await admin.post(`/api/admin/courses/${ids.b.id}/lessons/reorder`).send({ ids: [l1, l2] });
  assert.equal(eksik.status, 400);
});
