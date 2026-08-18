const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-kayit-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.ENABLE_DEMO_PAYMENTS = 'false';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');

const GECERLI_SIFRE = 'CokGuvenliSifre_2026';

test.before(async () => { await initDatabase(); });

test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

const kayitOl = (body) => request(app).post('/api/auth/register').send(body);

// ---------------------------------------------------------------
// Kayit hatalari: kullanici NEYIN yanlis oldugunu gormeli
// ---------------------------------------------------------------

test('kısa şifre reddedilince sebebi açıkça yazılır', async () => {
  const res = await kayitOl({ username: 'kisasifre', email: 'kisa@site.com', password: '12345' });
  assert.equal(res.status, 400);
  assert.notEqual(res.body.error, 'Gönderilen bilgiler geçersiz.');
  assert.match(res.body.error, /en az 10 karakter/i, `anlaşılmaz mesaj: ${res.body.error}`);
  assert.match(res.body.error_en, /at least 10 characters/i, `İngilizce karşılığı yok: ${res.body.error_en}`);
});

test('hata ayrıntısı hangi alana ait olduğunu söyler', async () => {
  const res = await kayitOl({ username: 'ab', email: 'gecersiz-eposta', password: '123' });
  assert.equal(res.status, 400);
  const alanlar = res.body.details.map(d => d.field);
  assert.ok(alanlar.includes('username'), 'kullanıcı adı hatası bildirilmemiş');
  assert.ok(alanlar.includes('email'), 'e-posta hatası bildirilmemiş');
  assert.ok(alanlar.includes('password'), 'şifre hatası bildirilmemiş');
  for (const detay of res.body.details) {
    assert.ok(detay.message && detay.message_en, `${detay.field} için iki dilli mesaj yok`);
    assert.ok(!/^(Invalid|Too small|Too big|Required|Expected)/i.test(detay.message),
      `Zod'un ham İngilizce mesajı sızmış: ${detay.message}`);
  }
});

test('geçersiz e-posta için örnekli açıklama verilir', async () => {
  const res = await kayitOl({ username: 'epostatest', email: 'ad-site-com', password: GECERLI_SIFRE });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /e-posta/i);
  assert.match(res.body.error, /örnek/i, 'örnek gösterilmemiş');
  assert.match(res.body.error_en, /valid email/i);
});

test('Türkçe karakterli kullanıcı adında sebep açıklanır', async () => {
  const res = await kayitOl({ username: 'ilhanşeyhan', email: 'ilhan@site.com', password: GECERLI_SIFRE });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /harf, rakam|Türkçe karakter/i, `sebep belirsiz: ${res.body.error}`);
  assert.match(res.body.error_en, /letters, numbers/i);
});

test('kullanıcı adı doluysa "kullanıcı adı" dolu olduğu söylenir', async () => {
  await kayitOl({ username: 'ayni_kisi', email: 'ayni@site.com', password: GECERLI_SIFRE });
  const res = await kayitOl({ username: 'ayni_kisi', email: 'baska@site.com', password: GECERLI_SIFRE });
  assert.equal(res.status, 409);
  assert.match(res.body.error, /kullanıcı adı/i);
  assert.ok(!/e-posta/i.test(res.body.error), 'e-posta suçlanmış, oysa sorun kullanıcı adında');
  assert.equal(res.body.field, 'username', 'işaretlenecek alan bildirilmemiş');
  assert.match(res.body.error_en, /username/i);
});

test('e-posta doluysa şifre sıfırlama önerilir', async () => {
  const res = await kayitOl({ username: 'yeni_kisi', email: 'ayni@site.com', password: GECERLI_SIFRE });
  assert.equal(res.status, 409);
  assert.match(res.body.error, /e-posta/i);
  assert.match(res.body.error, /Şifremi unuttum|giriş/i, 'ne yapacağı söylenmemiş');
  assert.equal(res.body.field, 'email');
  assert.match(res.body.error_en, /email/i);
});

test('geçerli bilgilerle kayıt hâlâ sorunsuz çalışır', async () => {
  const res = await kayitOl({ username: 'duzgun_kayit', email: 'duzgun@site.com', password: GECERLI_SIFRE });
  assert.equal(res.status, 201, res.body.error);
  assert.equal(res.body.user.username, 'duzgun_kayit');
});

test('giriş hatası iki dilli ve yol gösterici', async () => {
  const res = await request(app).post('/api/auth/login')
    .send({ username: 'duzgun_kayit', password: 'yanlissifre123' });
  assert.equal(res.status, 401);
  assert.match(res.body.error, /hatalı/i);
  assert.ok(res.body.error_en, 'İngilizce mesaj yok');
  assert.match(res.body.error_en, /Incorrect username or password/i);
});

// ---------------------------------------------------------------
// Referans sistemi: gercek veriler
// ---------------------------------------------------------------

async function girisYap(username, password) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ username, password });
  assert.equal(res.status, 200, res.body.error);
  return agent;
}

test('davet linkiyle kaydolan kullanıcı davet edene bağlanır', async () => {
  await kayitOl({ username: 'davetci', email: 'davetci@site.com', password: GECERLI_SIFRE });
  const res = await kayitOl({
    username: 'davetli_bir', email: 'davetli1@site.com', password: GECERLI_SIFRE, referral: 'davetci'
  });
  assert.equal(res.status, 201, res.body.error);

  const davetci = await dbAsync.get('SELECT id FROM users WHERE username = ?', ['davetci']);
  const davetli = await dbAsync.get('SELECT referrer_id FROM users WHERE username = ?', ['davetli_bir']);
  assert.equal(davetli.referrer_id, davetci.id, 'davet eşleşmesi kurulmamış');
});

test('referans paneli gerçek sayıları döner', async () => {
  await kayitOl({ username: 'davetli_iki', email: 'davetli2@site.com', password: GECERLI_SIFRE, referral: 'davetci' });
  const agent = await girisYap('davetci', GECERLI_SIFRE);
  const res = await agent.get('/api/account/referrals');
  assert.equal(res.status, 200, res.body.error);
  assert.equal(res.body.code, 'davetci', 'davet kodu yanlış');
  assert.equal(res.body.invited_count, 2, `davet sayısı yanlış: ${res.body.invited_count}`);
  assert.equal(res.body.active_count, 0, 'sipariş vermeyen davetli aktif sayılmış');
  assert.equal(res.body.commission_rate, 5);
  assert.equal(res.body.invited.length, 2);
});

test('davet edilen kullanıcı adları maskelenir', async () => {
  const agent = await girisYap('davetci', GECERLI_SIFRE);
  const res = await agent.get('/api/account/referrals');
  for (const kisi of res.body.invited) {
    assert.ok(kisi.username.includes('*'), `maskelenmemiş kullanıcı adı: ${kisi.username}`);
    assert.ok(!kisi.username.includes('davetli_bir'), 'tam kullanıcı adı sızmış');
  }
});

test('kazanç ve aktarılabilir bakiye gerçek kayıtlardan gelir', async () => {
  const davetci = await dbAsync.get('SELECT id FROM users WHERE username = ?', ['davetci']);
  const davetli = await dbAsync.get('SELECT id FROM users WHERE username = ?', ['davetli_bir']);
  const servis = await dbAsync.get('SELECT id FROM services LIMIT 1');
  // Komisyon gercek bir siparise baglidir; sahte numara yabanci anahtara takilir.
  const siparis = await dbAsync.run(
    `INSERT INTO orders (user_id, service_id, link, quantity, charge, status)
     VALUES (?, ?, 'https://instagram.com/p/abc', 100, 24.69, 'completed')`,
    [davetli.id, servis.id]
  );
  await dbAsync.run(
    `INSERT INTO referral_earnings (referrer_id, referred_user_id, order_id, amount_kurus)
     VALUES (?, ?, ?, ?)`,
    [davetci.id, davetli.id, siparis.id, 12345]
  );
  await dbAsync.run('UPDATE users SET referral_balance_kurus = 12345 WHERE id = ?', [davetci.id]);

  const agent = await girisYap('davetci', GECERLI_SIFRE);
  const res = await agent.get('/api/account/referrals');
  assert.equal(res.body.total_earned, 123.45, `toplam kazanç yanlış: ${res.body.total_earned}`);
  assert.equal(res.body.available, 123.45, `aktarılabilir bakiye yanlış: ${res.body.available}`);
  const kayit = res.body.invited.find(k => k.earned > 0);
  assert.ok(kayit, 'kazanç davetli satırına yansımamış');
  assert.equal(kayit.earned, 123.45);
});

test('başkasının referans verisi görülemez', async () => {
  const agent = await girisYap('duzgun_kayit', GECERLI_SIFRE);
  const res = await agent.get('/api/account/referrals');
  assert.equal(res.status, 200);
  assert.equal(res.body.invited_count, 0, 'başka kullanıcının davetlileri sızmış');
  assert.equal(res.body.total_earned, 0);
});

test('oturumsuz istek referans verisi alamaz', async () => {
  const res = await request(app).get('/api/account/referrals');
  assert.equal(res.status, 401);
});

test('davet kartında demo yer tutucu kalmamıştır', async () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  assert.ok(!html.includes('ref=demo_user'), 'demo davet linki hâlâ HTML içinde');
  assert.ok(!html.includes('localhost:3000/#register'), 'localhost adresi HTML içinde kalmış');
  // Karttaki vaat, sistemin gercekte odedigi seyle ayni olmali
  assert.ok(!html.includes('yaptıkları her bakiye yüklemesinden'),
    'kart hâlâ "bakiye yüklemesinden komisyon" diyor; sistem siparişten ödüyor');
});
