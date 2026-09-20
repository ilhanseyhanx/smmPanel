// Odeme baslatma hiz siniri (20 Eyl 2026).
//
// NEDEN: Her odeme baslatma istegi saglayicida gercek bir kayit yaratir —
// Shopier'de magazaya bir URUN eklenir. Genel /api limiti (dakikada 180) bu
// is icin fazla gevsekti; canlida bir hesap 31 Agustos'ta 4 saniye icinde
// 5 Shopier urunu olusturdu.
//
// EN KRITIK DAVRANIS: sinir KULLANICI bazlidir, IP bazli DEGIL.
// express-rate-limit varsayilani IP'dir; oyle birakilsaydi Turkiye'de mobil
// operatorlerin CGNAT'i yuzunden ayni cikis IP'sinden gorunen yuzlerce farkli
// musteri birbirinin kotasini yerdi. Asagidaki ucuncu test tam olarak bunu
// dogrular: iki farkli kullanici AYNI baglantidan (supertest, ayni IP) istek
// atar ve birincinin dolan kotasi ikinciyi etkilemez.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-ratelimit-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.ENABLE_DEMO_PAYMENTS = 'false';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';
// Uretim degeri (5) bilerek kullanilir: sinirin kendisi test ediliyor.
delete process.env.PAYMENT_RATE_LIMIT_MAX;

const { app } = require('../server');
const { initDatabase, db } = require('../config/database');

const LIMIT = 5;

test.before(async () => {
  await initDatabase();
});

test.after(async () => {
  // db.close geri cagirmasi beklenmezse Windows'ta dosya kilidi kalkmadan
  // rmSync calisir ve EPERM verir.
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

async function girisYap(username, password) {
  const agent = request.agent(app);
  const login = await agent.post('/api/auth/login').send({ username, password });
  assert.equal(login.status, 200, `${username} girisi basarisiz: ` + JSON.stringify(login.body));
  return agent;
}

async function kayitOlVeGir(username, email, password) {
  const kayit = await request(app).post('/api/auth/register').send({ username, email, password });
  assert.ok([200, 201].includes(kayit.status), 'kayit basarisiz: ' + JSON.stringify(kayit.body));
  return girisYap(username, password);
}

// Shopier yapilandirilmadigi icin handler 503 doner; bizi ilgilendiren tek
// sey istegin 429 OLUP OLMADIGI. Limiter zaten handler'dan once calisir.
const odemeBaslat = (agent, amount = 50) =>
  agent.post('/api/payments/shopier/create').send({ amount });

test('kullanıcı limiti aşana kadar ödeme başlatabilir', async () => {
  const agent = await girisYap('demo_user', 'user12345');
  for (let i = 1; i <= LIMIT; i++) {
    const res = await odemeBaslat(agent);
    assert.notEqual(res.status, 429, `${i}. istek beklenmedik sekilde sinira takildi`);
  }
});

test('limit aşılınca 429 ve anlaşılır Türkçe mesaj döner', async () => {
  // Onceki test demo_user kotasini doldurdu; bir sonraki istek reddedilmeli.
  const agent = await girisYap('demo_user', 'user12345');
  const res = await odemeBaslat(agent);
  assert.equal(res.status, 429, 'limit asildigi halde istek gecti');
  assert.match(String(res.body.error || ''), /ödeme başlattınız/i);
});

test('sınır KULLANICI bazlıdır: aynı IP’den gelen başka kullanıcı etkilenmez', async () => {
  // demo_user kotasi yukaridaki testlerde doldu. Ayni supertest baglantisi
  // (ayni IP) uzerinden ikinci bir kullanici olusturulur. Sinir IP bazli
  // olsaydi bu istek de 429 alirdi — CGNAT altindaki gercek musterilerin
  // yasayacagi sey budur.
  const ikinci = await kayitOlVeGir('ikinci_musteri', 'ikinci@ornek.com', 'GuvenliSifre_2026');
  const res = await odemeBaslat(ikinci);
  assert.notEqual(res.status, 429,
    'ikinci kullanici birincinin kotasindan etkilendi — sinir IP bazli kalmis');
});

test('kripto ve PayTR uçları da aynı sınıra tabidir', async () => {
  const agent = await kayitOlVeGir('ucuncu_musteri', 'ucuncu@ornek.com', 'GuvenliSifre_2026');
  // Kotayi Shopier ucuyla doldur.
  for (let i = 0; i < LIMIT; i++) await odemeBaslat(agent);

  const kripto = await agent.post('/api/payments/nowpayments/create').send({ amount: 500 });
  assert.equal(kripto.status, 429, 'kripto ucu ayri kota kullaniyor');

  const paytr = await agent.post('/api/payments/paytr/token').send({ amount: 500 });
  assert.equal(paytr.status, 429, 'PayTR ucu ayri kota kullaniyor');
});

test('oturumsuz istek sınıra değil kimlik doğrulamaya takılır', async () => {
  const res = await request(app).post('/api/payments/shopier/create').send({ amount: 50 });
  assert.equal(res.status, 401, 'oturumsuz istek 401 donmeliydi');
});
