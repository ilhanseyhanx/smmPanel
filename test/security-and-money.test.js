const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const crypto = require('crypto');
const { generate } = require('otplib');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-test-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.ENABLE_DEMO_PAYMENTS = 'false';
process.env.PAYTR_MERCHANT_ID = 'test-merchant';
process.env.PAYTR_MERCHANT_KEY = 'test-key';
process.env.PAYTR_MERCHANT_SALT = 'test-salt';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');

test.before(async () => { await initDatabase(); });
test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('bilinmeyen API adresi JSON 404 döndürür', async () => {
  const response = await request(app).get('/api/does-not-exist');
  assert.equal(response.status, 404);
  assert.match(response.headers['content-type'], /json/);
});

test('varsayılan admin şifre değiştirmeden panele giremez', async () => {
  const agent = request.agent(app);
  const login = await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.must_change_password, true);
  assert.equal((await agent.get('/api/admin/stats')).status, 428);
  const change = await agent.post('/api/admin/change-password').send({ current_password: 'admin12345', new_password: 'YeniGuvenliSifre_2026' });
  assert.equal(change.status, 200);
  assert.equal((await agent.post('/api/auth/login').send({ username: 'admin', password: 'YeniGuvenliSifre_2026' })).status, 200);
  assert.equal((await agent.get('/api/admin/stats')).status, 200);
});

test('kayıt doğrulaması ve HttpOnly cookie oturumu çalışır', async () => {
  const invalid = await request(app).post('/api/auth/register').send({ username: '<img>', email: 'x@example.com', password: 'GuvenliSifre_123' });
  assert.equal(invalid.status, 400);
  const agent = request.agent(app);
  const created = await agent.post('/api/auth/register').send({ username: 'test_user', email: 'test@example.com', password: 'GuvenliSifre_123' });
  assert.equal(created.status, 201);
  assert.ok(created.headers['set-cookie'][0].includes('HttpOnly'));
  assert.equal((await agent.get('/api/auth/me')).status, 200);
});

test('demo bakiye yükleme kapalıdır', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'demo_user', password: 'user12345' });
  const response = await agent.post('/api/payments/add-funds').send({ amount: 100, method: 'card' });
  assert.equal(response.status, 403);
});

test('kupon doğrulanmamış e-posta ile kullanılamaz', async () => {
  const agent = request.agent(app);
  const login = await agent.post('/api/auth/login').send({ username: 'demo_user', password: 'user12345' });
  await dbAsync.run('UPDATE users SET email_verified = 0 WHERE id = ?', [login.body.user.id]);
  await dbAsync.run("INSERT INTO coupons (code, amount, amount_kurus, max_uses) VALUES ('VERIFY10', 10, 1000, 10)");
  const response = await agent.post('/api/payments/coupon/redeem').send({ code: 'VERIFY10' });
  assert.equal(response.status, 403);
  assert.equal(response.body.code, 'email_verification_required');
});

test('kupon eşzamanlı isteklerde yalnızca bir kez bakiye ekler', async () => {
  const agent = request.agent(app);
  const login = await agent.post('/api/auth/login').send({ username: 'demo_user', password: 'user12345' });
  const userId = login.body.user.id;
  // Kupon kullanimi dogrulanmis e-posta ister; bu test es zamanlilik kilidini
  // olctugu icin kullanici dogrulanmis kabul edilir.
  await dbAsync.run('UPDATE users SET email_verified = 1 WHERE id = ?', [userId]);
  await dbAsync.run("INSERT INTO coupons (code, amount, amount_kurus, max_uses) VALUES ('ONCE100', 100, 10000, 10)");
  const results = await Promise.all([
    agent.post('/api/payments/coupon/redeem').send({ code: 'ONCE100' }),
    agent.post('/api/payments/coupon/redeem').send({ code: 'ONCE100' })
  ]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  const user = await dbAsync.get('SELECT balance_kurus FROM users WHERE id = ?', [userId]);
  assert.equal(user.balance_kurus, 35000);
});

test('sağlayıcı hatasında ayrılan sipariş tutarı iade edilir', async () => {
  const agent = request.agent(app);
  const login = await agent.post('/api/auth/login').send({ username: 'demo_user', password: 'user12345' });
  const before = await dbAsync.get('SELECT balance_kurus FROM users WHERE id = ?', [login.body.user.id]);
  const service = await dbAsync.get('SELECT * FROM services ORDER BY id LIMIT 1');
  const response = await agent.post('/api/orders').send({ service_id: service.id, link: 'https://example.com/post', quantity: service.min_quantity, drip_runs: 1 });
  assert.equal(response.status, 502);
  const after = await dbAsync.get('SELECT balance_kurus FROM users WHERE id = ?', [login.body.user.id]);
  assert.equal(after.balance_kurus, before.balance_kurus);
  const order = await dbAsync.get('SELECT status, charge_kurus, refunded_kurus FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 1', [login.body.user.id]);
  assert.equal(order.status, 'failed');
  assert.equal(order.refunded_kurus, order.charge_kurus);
});

test('şifre sıfırlama eski oturumları geçersiz kılar', async () => {
  const forgot = await request(app).post('/api/auth/forgot-password').send({ email: 'test@example.com' });
  assert.equal(forgot.status, 200);
  assert.ok(forgot.body.preview_token);
  const reset = await request(app).post('/api/auth/reset-password').send({ token: forgot.body.preview_token, new_password: 'YeniTestSifresi_2026' });
  assert.equal(reset.status, 200);
  assert.equal((await request(app).post('/api/auth/login').send({ username: 'test_user', password: 'GuvenliSifre_123' })).status, 401);
  assert.equal((await request(app).post('/api/auth/login').send({ username: 'test_user', password: 'YeniTestSifresi_2026' })).status, 200);
});

test('2FA etkinleştirildiğinde giriş kod ister', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'test_user', password: 'YeniTestSifresi_2026' });
  const setup = await agent.post('/api/auth/2fa/setup').send({});
  assert.equal(setup.status, 200);
  const token = await generate({ secret: setup.body.manual_key });
  assert.equal((await agent.post('/api/auth/2fa/confirm').send({ token })).status, 200);
  const withoutCode = await request(app).post('/api/auth/login').send({ username: 'test_user', password: 'YeniTestSifresi_2026' });
  assert.equal(withoutCode.body.code, 'TWO_FACTOR_REQUIRED');
  assert.equal((await request(app).post('/api/auth/login').send({ username: 'test_user', password: 'YeniTestSifresi_2026', totp: await generate({ secret: setup.body.manual_key }) })).status, 200);
});

test('PayTR callback tekrarlansa da bakiye yalnızca bir kez eklenir', async () => {
  const user = await dbAsync.get("SELECT id, balance_kurus FROM users WHERE username = 'demo_user'");
  const merchantOid = 'TESTPAYMENT001';
  await dbAsync.run("INSERT INTO payment_intents (user_id, provider, merchant_oid, amount_kurus) VALUES (?, 'paytr', ?, 12345)", [user.id, merchantOid]);
  const callback = { merchant_oid: merchantOid, status: 'success', total_amount: '12345' };
  callback.hash = crypto.createHmac('sha256', process.env.PAYTR_MERCHANT_KEY).update(`${merchantOid}${process.env.PAYTR_MERCHANT_SALT}success12345`).digest('base64');
  assert.equal((await request(app).post('/api/payments/paytr/callback').type('form').send(callback)).text, 'OK');
  assert.equal((await request(app).post('/api/payments/paytr/callback').type('form').send(callback)).text, 'OK');
  const after = await dbAsync.get('SELECT balance_kurus FROM users WHERE id = ?', [user.id]);
  assert.equal(after.balance_kurus, user.balance_kurus + 12345);
  const records = await dbAsync.get("SELECT COUNT(*) count FROM payments WHERE transaction_id = ?", [merchantOid]);
  assert.equal(records.count, 1);
});

test('çift dilli blog taslak, düzenleme ve yayın akışı çalışır', async () => {
  const agent = request.agent(app);
  assert.equal((await agent.post('/api/auth/login').send({ username: 'admin', password: 'YeniGuvenliSifre_2026' })).status, 200);
  const created = await agent.post('/api/admin/blog').send({
    title_tr: 'Türkçe Test Yazısı', title_en: 'English Test Article',
    category_tr: 'Rehber', category_en: 'Guide',
    summary_tr: 'Türkçe özet', summary_en: 'English summary',
    content_tr: '<h2>Merhaba</h2><p>Türkçe içerik</p>',
    content_en: '<h2>Hello</h2><p>English content</p>', status: 'draft'
  });
  assert.equal(created.status, 200);
  const row = await dbAsync.get("SELECT * FROM blog_posts WHERE title_tr = 'Türkçe Test Yazısı'");
  assert.equal(row.status, 'draft');
  assert.equal((await request(app).get(`/api/blog/${row.slug}?lang=en`)).status, 404);
  assert.equal((await agent.put(`/api/admin/blog/${row.id}`).send({ ...row, status: 'published' })).status, 200);
  const english = await request(app).get(`/api/blog/${row.slug}?lang=en`);
  assert.equal(english.status, 200);
  assert.equal(english.body.post.title, 'English Test Article');
});

test('konuya göre üretilen 50 blog kapağı geçerli ve birbirinden farklıdır', async () => {
  const first = await request(app).get('/api/blog/cover/instagram/1.svg');
  const last = await request(app).get('/api/blog/cover/instagram/50.svg');
  assert.equal(first.status, 200);
  assert.match(first.headers['content-type'], /image\/svg\+xml/);
  assert.equal(last.status, 200);
  assert.notEqual(first.body.toString('utf8'), last.body.toString('utf8'));
  assert.doesNotMatch(first.body.toString('utf8'), /<text\b/i);
  assert.equal((await request(app).get('/api/blog/cover/instagram/51.svg')).status, 404);
});

test('AI yönetim uçları yalnızca admin oturumuna açıktır', async () => {
  assert.equal((await request(app).get('/api/ai/providers')).status, 401);
  const client = request.agent(app);
  await client.post('/api/auth/login').send({ username: 'demo_user', password: 'user12345' });
  assert.equal((await client.get('/api/ai/providers')).status, 403);
  const admin = request.agent(app);
  await admin.post('/api/auth/login').send({ username: 'admin', password: 'YeniGuvenliSifre_2026' });
  assert.equal((await admin.get('/api/ai/providers')).status, 200);
});

test('AI işlemi admin onayı olmadan uygulanmaz ve onayla güvenli taslak oluşturur', async () => {
  const adminUser = await dbAsync.get("SELECT id FROM users WHERE username = 'admin'");
  const conversation = await dbAsync.run("INSERT INTO ai_conversations (admin_user_id, title) VALUES (?, 'Test sohbeti')", [adminUser.id]);
  const payload = {
    title_tr: 'AI Taslak TR', title_en: 'AI Draft EN', category_tr: 'AI', category_en: 'AI',
    summary_tr: 'Özet', summary_en: 'Summary', content_tr: '<p>Türkçe</p>', content_en: '<p>English</p>'
  };
  const action = await dbAsync.run(`INSERT INTO ai_action_logs (conversation_id, admin_user_id, action_type, payload_json)
    VALUES (?, ?, 'create_blog_draft', ?)`, [conversation.id, adminUser.id, JSON.stringify(payload)]);
  assert.equal((await dbAsync.get("SELECT COUNT(*) count FROM blog_posts WHERE title_tr = 'AI Taslak TR'")).count, 0);
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'admin', password: 'YeniGuvenliSifre_2026' });
  const executed = await agent.post(`/api/ai/actions/${action.id}/execute`).send({});
  assert.equal(executed.status, 200);
  const post = await dbAsync.get("SELECT status FROM blog_posts WHERE title_tr = 'AI Taslak TR'");
  assert.equal(post.status, 'draft');
  assert.equal((await dbAsync.get('SELECT status FROM ai_action_logs WHERE id = ?', [action.id])).status, 'approved');
});
