// Google ile giris / kayit: belirtec dogrulama (yerel RSA anahtari + sahte
// JWKS), hesap bulma sirasi (sub -> e-posta -> yeni), 2FA/ban, sayfa ve
// guvenlik basliklari, admin istatistiklerinde ve ayak izinde kayit yontemi.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-google-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.ENABLE_DEMO_PAYMENTS = 'false';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';
const CLIENT_ID = '123456-test.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_ID = CLIENT_ID;

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');
const googleAuth = require('../services/googleAuth');
const { encryptSecret } = require('../utils/security');
const { generateSecret, generate } = require('otplib');

const ADMIN_PASSWORD = 'GuvenliAdminSifre_2026';
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const GECERLI_SIFRE = 'CokGuvenliSifre_2026';

// Kimlik uclari (login/register/google) ortak hiz sinirini paylasir (20 istek /
// 15 dk, IP bazli). Sunucu "trust proxy" ile X-Forwarded-For'a guvendigi icin
// her test istegi farkli bir IP'den gelir; sinir testi bolmez.
let ipSayac = 0;
const yeniIp = () => `10.77.${(++ipSayac >> 8) & 255}.${ipSayac & 255}`;
// Semada credential en az 20 karakter: kisa test anahtarlari doldurulur.
const padTok = t => String(t).padEnd(32, '-');

// --- Gercek dogrulayici icin yerel anahtar + sahte Google anahtar listesi ----
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'test-kid-1';
const JWK = { ...publicKey.export({ format: 'jwk' }), kid: KID, use: 'sig', alg: 'RS256' };
const gercekFetch = global.fetch;
function sahteJwks() {
  global.fetch = async () => ({
    ok: true, status: 200,
    headers: { get: () => 'public, max-age=3600' },
    json: async () => ({ keys: [JWK] })
  });
}
function imzala(payload, options = {}) {
  return jwt.sign(
    { iss: 'https://accounts.google.com', aud: CLIENT_ID, email_verified: true, ...payload },
    privateKey,
    { algorithm: 'RS256', keyid: KID, expiresIn: '1h', ...options }
  );
}

// --- Rota testleri icin dogrulayici yerine sabit profiller ---------------------
const PROFILLER = new Map();
const gercekVerify = googleAuth.verifyIdToken;
function profil(credential, data) {
  PROFILLER.set(padTok(credential), { emailVerified: true, name: 'Test', picture: '', ...data });
  return credential;
}

test.before(async () => {
  await initDatabase();
  const ilk = request.agent(app);
  await ilk.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  await ilk.post('/api/admin/change-password').send({ current_password: 'admin12345', new_password: ADMIN_PASSWORD });
  googleAuth.verifyIdToken = async credential => {
    const p = PROFILLER.get(credential);
    if (!p) {
      const err = new Error('Google doğrulaması başarısız: belirteç tanınmadı.');
      err.status = 401; err.messageEn = 'Google verification failed.'; err.code = 'GOOGLE_TOKEN_INVALID';
      throw err;
    }
    return p;
  };
});

test.after(async () => {
  googleAuth.verifyIdToken = gercekVerify;
  global.fetch = gercekFetch;
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

const googleGiris = (credential, extra = {}) => request(app).post('/api/auth/google').set('User-Agent', CHROME).set('X-Forwarded-For', yeniIp()).send({ credential: padTok(credential), ...extra });
const kayitOl = body => request(app).post('/api/auth/register').set('X-Forwarded-For', yeniIp()).send(body);

async function adminAgent() {
  const agent = request.agent(app);
  const login = await agent.post('/api/auth/login').set('User-Agent', CHROME).set('X-Forwarded-For', yeniIp()).send({ username: 'admin', password: ADMIN_PASSWORD });
  assert.equal(login.status, 200);
  return agent;
}

// ---------------------------------------------------------------
// Belirtec dogrulama (gercek kod yolu)
// ---------------------------------------------------------------
test('yerel anahtarla imzalı geçerli belirteç kabul edilir; e-posta küçük harfe çevrilir', async () => {
  sahteJwks();
  googleAuth._resetKeyCache();
  const p = await gercekVerify(imzala({ sub: '10001', email: 'Ornek.Kisi@Gmail.com', name: 'Örnek Kişi' }), CLIENT_ID);
  assert.equal(p.sub, '10001');
  assert.equal(p.email, 'ornek.kisi@gmail.com');
  assert.equal(p.emailVerified, true);
  assert.equal(p.name, 'Örnek Kişi');
});

test('yanlış audience, yanlış issuer, süresi dolmuş, HS256 ve bozuk belirteçler reddedilir', async () => {
  sahteJwks();
  googleAuth._resetKeyCache();
  const bekle = (token, neden) => assert.rejects(() => gercekVerify(token, CLIENT_ID), err => err.status === 401 && err.code === 'GOOGLE_TOKEN_INVALID', neden);
  await bekle(imzala({ sub: '1', email: 'a@b.com', aud: 'baska-client' }), 'audience');
  await bekle(imzala({ sub: '1', email: 'a@b.com', iss: 'https://evil.example' }), 'issuer');
  await bekle(imzala({ sub: '1', email: 'a@b.com' }, { expiresIn: '-10s' }), 'süre');
  await bekle(jwt.sign({ sub: '1', email: 'a@b.com', iss: 'https://accounts.google.com', aud: CLIENT_ID }, 'gizli', { algorithm: 'HS256', keyid: KID }), 'HS256');
  await bekle('bozuk.belirtec', 'biçim');
});

test('bilinmeyen anahtar kimliği (kid) için anahtar listesi yenilenir', async () => {
  let cagri = 0;
  global.fetch = async () => { cagri++; return { ok: true, status: 200, headers: { get: () => 'max-age=3600' }, json: async () => ({ keys: [JWK] }) }; };
  googleAuth._resetKeyCache();
  await gercekVerify(imzala({ sub: '1', email: 'a@b.com' }), CLIENT_ID);
  await gercekVerify(imzala({ sub: '1', email: 'a@b.com' }), CLIENT_ID);
  assert.equal(cagri, 1, 'ikinci dogrulama onbellekten yapilmali');
  await assert.rejects(() => gercekVerify(imzala({ sub: '1', email: 'a@b.com' }, { keyid: 'yok-boyle-anahtar' }), CLIENT_ID));
  assert.equal(cagri, 1, 'son indirmeden 60 sn gecmeden sahte kid icin yeniden indirilmemeli');
});

test('istemci kimliği: panel ayarı ortam değişkenine göre önceliklidir, bozuk değer atlanır', async () => {
  assert.equal(await googleAuth.getClientId(), CLIENT_ID);
  await dbAsync.run("DELETE FROM site_settings WHERE key = 'google_client_id'");
  await dbAsync.run("INSERT INTO site_settings (key, value) VALUES ('google_client_id', 'panel-123.apps.googleusercontent.com')");
  assert.equal(await googleAuth.getClientId(), 'panel-123.apps.googleusercontent.com');
  await dbAsync.run("UPDATE site_settings SET value = '<script>bozuk' WHERE key = 'google_client_id'");
  assert.equal(await googleAuth.getClientId(), CLIENT_ID, 'bozuk panel değeri ortam değişkenine düşmeli');
  await dbAsync.run("DELETE FROM site_settings WHERE key = 'google_client_id'");
});

// ---------------------------------------------------------------
// Giris / kayit akisi
// ---------------------------------------------------------------
test('yeni Google hesabı: kullanıcı adı e-postadan türetilir, e-posta doğrulanmış sayılır, oturum açılır', async () => {
  profil('tok-yeni', { sub: 'g-1', email: 'Yeni.Kisi@gmail.com' });
  const res = await googleGiris('tok-yeni');
  assert.equal(res.status, 201, res.body.error);
  assert.equal(res.body.created, true);
  assert.equal(res.body.user.username, 'yeni.kisi');
  assert.equal(res.body.user.email, 'yeni.kisi@gmail.com');
  assert.equal(res.body.user.email_verified, true);
  assert.equal(res.body.user.google_linked, true);
  assert.ok(String(res.headers['set-cookie'] || '').includes('smm_session='), 'oturum çerezi yazılmalı');
  const row = await dbAsync.get("SELECT signup_method, google_sub, email_verified, password FROM users WHERE username = 'yeni.kisi'");
  assert.equal(row.signup_method, 'google');
  assert.equal(row.google_sub, 'g-1');
  assert.equal(row.email_verified, 1);
  assert.ok(row.password && row.password.startsWith('$2'), 'rastgele de olsa bcrypt şifre yazılmalı');
});

test('aynı Google hesabı ikinci kez girince yeni hesap açılmaz, giriş sayılır', async () => {
  const res = await googleGiris('tok-yeni');
  assert.equal(res.status, 200, res.body.error);
  assert.equal(res.body.created, false);
  assert.equal(res.body.user.username, 'yeni.kisi');
  assert.equal((await dbAsync.get("SELECT COUNT(*) n FROM users WHERE email = 'yeni.kisi@gmail.com'")).n, 1);
  // Giris sayaci yanit beklenmeden guncellenir (login rotasindaki gibi); kisa sure yoklanir.
  let row;
  for (let i = 0; i < 40; i++) {
    row = await dbAsync.get("SELECT login_count FROM users WHERE username = 'yeni.kisi'");
    if (row.login_count >= 1) break;
    await new Promise(r => setTimeout(r, 25));
  }
  assert.ok(row.login_count >= 1, 'giriş sayacı artmalı');
});

test('formla açılmış hesabın e-postasıyla gelen Google girişi hesaba bağlanır', async () => {
  const kayit = await kayitOl({ username: 'mevcutkisi', email: 'mevcut@site.com', password: GECERLI_SIFRE });
  assert.equal(kayit.status, 201, kayit.body.error);
  profil('tok-mevcut', { sub: 'g-2', email: 'MEVCUT@site.com' });
  const res = await googleGiris('tok-mevcut');
  assert.equal(res.status, 200, res.body.error);
  assert.equal(res.body.linked, true);
  assert.equal(res.body.user.id, kayit.body.user.id);
  assert.equal(res.body.user.google_linked, true);
  const row = await dbAsync.get('SELECT google_sub, google_linked_at, signup_method, email_verified FROM users WHERE id = ?', [kayit.body.user.id]);
  assert.equal(row.google_sub, 'g-2');
  assert.ok(row.google_linked_at);
  assert.equal(row.signup_method, null, 'formla açılan hesap Google kaydı sayılmamalı');
  assert.equal(row.email_verified, 1, 'Google doğruladığı için e-posta doğrulanmış olmalı');
});

test('kullanıcı adı doluysa türetilen ada sayı eklenir', async () => {
  const kayit = await kayitOl({ username: 'ali', email: 'ali@site.com', password: GECERLI_SIFRE });
  assert.equal(kayit.status, 201, kayit.body.error);
  profil('tok-ali', { sub: 'g-3', email: 'ali@gmail.com' });
  const res = await googleGiris('tok-ali');
  assert.equal(res.status, 201, res.body.error);
  assert.match(res.body.user.username, /^ali\d+$/, res.body.user.username);
});

test('çok kısa / özel karakterli e-posta adından geçerli kullanıcı adı üretilir', async () => {
  profil('tok-kisa', { sub: 'g-4', email: 'ab@gmail.com' });
  const res = await googleGiris('tok-kisa');
  assert.equal(res.status, 201, res.body.error);
  assert.match(res.body.user.username, /^[a-zA-Z0-9_.-]{3,32}$/);
  profil('tok-ozel', { sub: 'g-4b', email: '..şey-adı..@gmail.com' });
  const res2 = await googleGiris('tok-ozel');
  assert.equal(res2.status, 201, res2.body.error);
  assert.match(res2.body.user.username, /^[a-zA-Z0-9_.-]{3,32}$/);
  assert.ok(!/^[._-]/.test(res2.body.user.username), 'ad nokta/tire ile başlamamalı');
});

test('davet koduyla gelen Google kaydı referansa bağlanır', async () => {
  profil('tok-davetli', { sub: 'g-5', email: 'davetli@gmail.com' });
  const res = await googleGiris('tok-davetli', { referral: 'mevcutkisi' });
  assert.equal(res.status, 201, res.body.error);
  const row = await dbAsync.get('SELECT referrer_id FROM users WHERE id = ?', [res.body.user.id]);
  const ref = await dbAsync.get("SELECT id FROM users WHERE username = 'mevcutkisi'");
  assert.equal(row.referrer_id, ref.id);
});

test('e-postası doğrulanmamış Google profili 403 alır, hesap açılmaz', async () => {
  profil('tok-dogrulanmamis', { sub: 'g-unv', email: 'unv@gmail.com', emailVerified: false });
  const res = await googleGiris('tok-dogrulanmamis');
  assert.equal(res.status, 403);
  assert.match(res.body.error, /doğrulanmamış/i);
  assert.equal(await dbAsync.get("SELECT 1 FROM users WHERE email = 'unv@gmail.com'"), undefined);
});

test('tanınmayan belirteç 401 ve GOOGLE_TOKEN_INVALID döner', async () => {
  const res = await googleGiris('tok-sahte-belirtec-xxxxxxxx');
  assert.equal(res.status, 401);
  assert.equal(res.body.code, 'GOOGLE_TOKEN_INVALID');
  assert.ok(res.body.error_en, 'İngilizce karşılığı olmalı');
});

test('eksik/kısa credential doğrulamadan geçmez', async () => {
  const res = await request(app).post('/api/auth/google').set('X-Forwarded-For', yeniIp()).send({ credential: 'kisa' });
  assert.equal(res.status, 400);
});

test('banlı hesap Google ile de giremez', async () => {
  await dbAsync.run("UPDATE users SET banned = 1 WHERE username = 'yeni.kisi'");
  const res = await googleGiris('tok-yeni');
  assert.equal(res.status, 403);
  assert.match(res.body.error, /askıya/i);
  await dbAsync.run("UPDATE users SET banned = 0 WHERE username = 'yeni.kisi'");
});

test('2FA açık hesapta Google girişi kod ister; doğru kodla açılır', async () => {
  const secret = generateSecret();
  await dbAsync.run("UPDATE users SET two_factor_enabled = 1, two_factor_secret = ? WHERE username = 'yeni.kisi'", [encryptSecret(secret)]);
  const kodsuz = await googleGiris('tok-yeni');
  assert.equal(kodsuz.status, 401);
  assert.equal(kodsuz.body.code, 'TWO_FACTOR_REQUIRED');
  const yanlis = await googleGiris('tok-yeni', { totp: '000000' });
  assert.equal(yanlis.status, 401);
  assert.notEqual(yanlis.body.code, 'TWO_FACTOR_REQUIRED');
  const kod = await generate({ secret });
  const dogru = await googleGiris('tok-yeni', { totp: kod });
  assert.equal(dogru.status, 200, dogru.body.error);
  await dbAsync.run("UPDATE users SET two_factor_enabled = 0, two_factor_secret = NULL WHERE username = 'yeni.kisi'");
});

test('2FA açık ve henüz bağlanmamış hesapta Google bağlantısı kod doğrulanmadan yazılmaz', async () => {
  const kayit = await kayitOl({ username: 'ikiadim', email: 'ikiadim@site.com', password: GECERLI_SIFRE });
  assert.equal(kayit.status, 201, kayit.body.error);
  await dbAsync.run("UPDATE users SET two_factor_enabled = 1, two_factor_secret = ? WHERE id = ?", [encryptSecret(generateSecret()), kayit.body.user.id]);
  profil('tok-ikiadim', { sub: 'g-2fa', email: 'ikiadim@site.com' });
  const res = await googleGiris('tok-ikiadim');
  assert.equal(res.body.code, 'TWO_FACTOR_REQUIRED');
  const row = await dbAsync.get('SELECT google_sub FROM users WHERE id = ?', [kayit.body.user.id]);
  assert.equal(row.google_sub, null, 'kod doğrulanmadan Google hesabı bağlanmamalı');
});

test('istemci kimliği hiç yoksa uç 503 döner', async () => {
  const eski = process.env.GOOGLE_CLIENT_ID;
  process.env.GOOGLE_CLIENT_ID = '';
  try {
    const res = await googleGiris('tok-yeni');
    assert.equal(res.status, 503);
    assert.ok(res.body.error_en);
  } finally { process.env.GOOGLE_CLIENT_ID = eski; }
});

// ---------------------------------------------------------------
// Sayfa ciktisi ve guvenlik basliklari
// ---------------------------------------------------------------
test('giriş sayfası istemci kimliğini meta etiketiyle taşır ve Google düğme yuvalarını içerir', async () => {
  const res = await request(app).get('/auth');
  assert.equal(res.status, 200);
  assert.ok(res.text.includes(`<meta name="google-client-id" content="${CLIENT_ID}">`), 'meta etiketi yok');
  assert.ok(res.text.includes('id="vauth-google-wrap"'), 'tam sayfa formda düğme yuvası yok');
  assert.ok(res.text.includes('id="auth-google-wrap"'), 'modal formda düğme yuvası yok');
  assert.ok(!res.text.includes('accounts.google.com/gsi/client'), 'Google betiği sayfaya sabit gömülmemeli; app.js gerektiğinde yükler');
});

test('CSP ve COOP başlıkları Google Identity Services için açılmış, diğer korumalar yerinde', async () => {
  const res = await request(app).get('/auth');
  const csp = res.headers['content-security-policy'] || '';
  assert.match(csp, /script-src[^;]*https:\/\/accounts\.google\.com\/gsi\/client/, 'script-src');
  assert.match(csp, /frame-src[^;]*https:\/\/accounts\.google\.com\/gsi\//, 'frame-src');
  assert.match(csp, /connect-src[^;]*https:\/\/accounts\.google\.com\/gsi\//, 'connect-src');
  assert.match(csp, /style-src[^;]*https:\/\/accounts\.google\.com\/gsi\/style/, 'style-src');
  assert.match(csp, /frame-ancestors 'none'/, 'clickjacking koruması kalkmış');
  assert.equal(res.headers['cross-origin-opener-policy'], 'same-origin-allow-popups');
});

test('ana sayfada Google düğmesi yuvası yoktur (kimlik formu yalnızca noindex rotalarda)', async () => {
  const res = await request(app).get('/');
  assert.ok(!res.text.includes('google-wrap'));
});

// ---------------------------------------------------------------
// Admin istatistikleri ve ayak izi: kim nasil kayit olmus
// ---------------------------------------------------------------
test('admin kullanıcı listesi ve detayı kayıt yöntemini verir', async () => {
  const admin = await adminAgent();
  const list = await admin.get('/api/admin/users?q=yeni.kisi');
  assert.equal(list.status, 200);
  const u = list.body.users.find(x => x.username === 'yeni.kisi');
  assert.ok(u, 'kullanıcı listede yok');
  assert.equal(u.signup_method, 'google');
  assert.equal(Number(u.google_linked), 1);
  const detay = await admin.get(`/api/admin/users/${u.id}/detail`);
  assert.equal(detay.status, 200);
  assert.equal(detay.body.user.signup_method, 'google');
  assert.equal(Number(detay.body.user.google_linked), 1);
  assert.ok(detay.body.user.google_linked_at);
  const form = (await admin.get('/api/admin/users?q=mevcutkisi')).body.users.find(x => x.username === 'mevcutkisi');
  assert.equal(form.signup_method, null);
  assert.equal(Number(form.google_linked), 1, 'formla kayıt olup sonradan Google bağlayan görünmeli');
});

test('istatistik hunisi Google ile açılan hesapları ayrıca sayar', async () => {
  const admin = await adminAgent();
  const res = await admin.get('/api/admin/statistics');
  assert.equal(res.status, 200);
  assert.ok(res.body.funnel, 'huni yok');
  assert.ok(res.body.funnel.google_signups >= 4, JSON.stringify(res.body.funnel));
  assert.ok(res.body.funnel.signups >= res.body.funnel.google_signups);
});

test('ayak izi üye listesi kayıt yöntemine göre özet ve filtre verir', async () => {
  const admin = await adminAgent();
  const hepsi = await admin.get('/api/admin/footprint/users?range=7');
  assert.equal(hepsi.status, 200);
  const byMethod = Object.fromEntries((hepsi.body.by_method || []).map(r => [r.method, r.users]));
  assert.ok(byMethod.google >= 4, `google kayıt sayısı: ${JSON.stringify(hepsi.body.by_method)}`);
  assert.ok(byMethod.form >= 2, 'form kayıtları sayılmalı');
  const sadeceGoogle = await admin.get('/api/admin/footprint/users?range=7&method=google');
  assert.ok(sadeceGoogle.body.users.length >= 4);
  assert.ok(sadeceGoogle.body.users.every(u => u.signup_method === 'google'));
  const sadeceForm = await admin.get('/api/admin/footprint/users?range=7&method=form');
  assert.ok(sadeceForm.body.users.length >= 2);
  assert.ok(sadeceForm.body.users.every(u => u.signup_method !== 'google'));
  const detay = await admin.get(`/api/admin/footprint/users/${sadeceGoogle.body.users[0].id}`);
  assert.equal(detay.status, 200);
  assert.equal(detay.body.user.signup_method, 'google');
});

test('ayak izi: Google ile kayıt olayı yöntemle işaretlenir ve genel bakışta sayılır', async () => {
  const sid = `${Date.now().toString(16)}-google-000001`.slice(0, 36);
  const tr = await request(app).post('/api/track').set('User-Agent', CHROME).set('Content-Type', 'application/json')
    .send(JSON.stringify({
      sid, consent: true, hi: true,
      ctx: { path: '/register', referrer: '', lang: 'tr', screen: '1920x1080', tz: 'Europe/Istanbul', utm: {} },
      events: [{ kind: 'page_view', path: '/register', label: 'Kayıt', ts: Date.now() }],
      sent_at: Date.now()
    }));
  assert.equal(tr.status, 204);
  profil('tok-izli', { sub: 'g-6', email: 'izli@gmail.com' });
  const res = await request(app).post('/api/auth/google').set('User-Agent', CHROME).set('X-Forwarded-For', yeniIp()).set('X-Track-Sid', sid).send({ credential: padTok('tok-izli') });
  assert.equal(res.status, 201, res.body.error);
  // Kayit rotasi izleme yazimini beklemez (yanit gecikmesin); kisa sure yoklanir.
  let ev;
  for (let i = 0; i < 60 && !ev; i++) {
    ev = await dbAsync.get("SELECT meta FROM track_events WHERE session_id = ? AND kind = 'register_success'", [sid]);
    if (!ev) await new Promise(r => setTimeout(r, 25));
  }
  assert.ok(ev, 'kayıt olayı yazılmalı');
  assert.equal(JSON.parse(ev.meta).method, 'google');
  const admin = await adminAgent();
  const ov = await admin.get('/api/admin/footprint/overview?range=7');
  assert.equal(ov.status, 200);
  assert.ok(ov.body.summary.google_registered >= 1, JSON.stringify(ov.body.summary));
  const detay = await admin.get(`/api/admin/footprint/sessions/${sid}`);
  assert.equal(detay.status, 200);
  const kayitOlayi = detay.body.events.find(e => e.kind === 'register_success');
  assert.ok(kayitOlayi, 'oturum detayında kayıt adımı yok');
  const meta = typeof kayitOlayi.meta === 'string' ? JSON.parse(kayitOlayi.meta) : kayitOlayi.meta;
  assert.equal(meta.method, 'google');
});
