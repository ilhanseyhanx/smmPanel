// Sistem Sagligi - Faz 2 testleri.
// Kapsam: tablolar, yetki, saglayici telemetrisi (basari/zaman asimi/502/
// bakiye), gecikme toplami, dusuk ornek, redaction, kesme, telemetri hatasinin
// ana akisi bozmamasi, odeme olaylari, PII sizintisi, pencere filtresi,
// temizlik, cikti sirlari ve UI baglantisi.
// GERCEK saglayici/odeme cagrisi YOKTUR: axios.post taklit edilir, URL IP
// literali oldugu icin DNS'e de cikilmaz.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-saglik2-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';
// Taklit saglayici 127.0.0.1 uzerinde; axios.post zaten taklit edildigi icin
// hicbir baglanti acilmaz.
process.env.ALLOW_PRIVATE_PROVIDER_URLS = 'true';

const axios = require('axios');
const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');
const healthEvents = require('../services/healthEvents');
const healthReports = require('../services/healthReports');
const SmmProviderClient = require('../services/smmProvider');

const ADMIN_PASSWORD = 'GuvenliAdminSifre_2026';
const MUSTERI_SIFRE = 'MusteriSifresi_2026';
const SAGLAYICI_URL = 'http://127.0.0.1:9/api/v2';
const SAGLAYICI_ANAHTAR = 'sk_live_GIZLIANAHTAR_9f8e7d6c5b4a';
const gercekPost = axios.post;

test.before(async () => {
  await initDatabase();
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  await agent.post('/api/admin/change-password').send({ current_password: 'admin12345', new_password: ADMIN_PASSWORD });
  await request(app).post('/api/auth/register').send({
    username: 'saglik2_musteri', email: 'saglik2_musteri@ornek.com', password: MUSTERI_SIFRE
  });
});

test.afterEach(() => { axios.post = gercekPost; });

test.after(async () => {
  axios.post = gercekPost;
  await healthEvents.drain().catch(() => {});
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

async function adminAgent() {
  const agent = request.agent(app);
  const login = await agent.post('/api/auth/login').send({ username: 'admin', password: ADMIN_PASSWORD });
  assert.equal(login.status, 200, 'admin girişi başarısız');
  return agent;
}

async function musteriAgent() {
  const agent = request.agent(app);
  const login = await agent.post('/api/auth/login').send({ username: 'saglik2_musteri', password: MUSTERI_SIFRE });
  assert.equal(login.status, 200, 'müşteri girişi başarısız');
  return agent;
}

let sayac = 0;
async function yeniSaglayici(ad) {
  sayac++;
  const r = await dbAsync.run(
    'INSERT INTO providers (name, api_url, api_key, status) VALUES (?, ?, ?, 1)',
    [`${ad} ${sayac}`, SAGLAYICI_URL, SAGLAYICI_ANAHTAR]
  );
  return r.id;
}

function axiosHatasi({ code, status, data, message }) {
  const e = new Error(message || (status ? `Request failed with status code ${status}` : 'hata'));
  if (code) e.code = code;
  if (status) e.response = { status, data };
  return e;
}

async function metrikler(scope) {
  await healthEvents.drain();
  const satirlar = await dbAsync.all(
    'SELECT metric, SUM(n) n, SUM("sum") toplam, MIN("min") enaz, MAX("max") encok FROM health_metrics_hourly WHERE scope = ? GROUP BY metric',
    [scope]
  );
  return Object.fromEntries(satirlar.map(r => [r.metric, r]));
}

async function olaylar(kaynak) {
  await healthEvents.drain();
  return dbAsync.all('SELECT category, severity, source, detail FROM health_events WHERE source = ? ORDER BY id', [kaynak]);
}

// ------------------------------------------------------------ migration ----

test('migration idempotent: iki kez çalışır, tablolar ve indeksler doğru', async () => {
  await initDatabase();
  await initDatabase();
  const olay = (await dbAsync.all('PRAGMA table_info(health_events)')).map(c => c.name);
  assert.deepEqual(olay, ['id', 'category', 'severity', 'source', 'detail', 'created_at']);
  const metrik = (await dbAsync.all('PRAGMA table_info(health_metrics_hourly)')).map(c => c.name);
  assert.deepEqual(metrik, ['bucket', 'metric', 'scope', 'n', 'sum', 'min', 'max']);
  const pk = (await dbAsync.all('PRAGMA table_info(health_metrics_hourly)')).filter(c => c.pk > 0).map(c => c.name);
  assert.deepEqual(pk, ['bucket', 'metric', 'scope']);
  const indeksler = (await dbAsync.all("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'health_events'")).map(r => r.name);
  for (const ad of ['idx_health_events_at', 'idx_health_events_cat_at', 'idx_health_events_src_at']) {
    assert.ok(indeksler.includes(ad), `${ad} indeksi yok`);
  }
});

// ---------------------------------------------------------------- yetki ----

async function uclar() {
  const id = await yeniSaglayici('Yetki');
  return ['/api/admin/health/providers', '/api/admin/health/payments',
    '/api/admin/health/errors?window=24h', `/api/admin/health/provider/${id}`];
}

test('Faz 2 uçları: oturumsuz 401, müşteri 403, yönetici 200', async () => {
  const liste = await uclar();
  const musteri = await musteriAgent();
  const admin = await adminAgent();
  for (const uc of liste) {
    assert.equal((await request(app).get(uc)).status, 401, `${uc} oturumsuz erişime açık`);
    assert.equal((await musteri.get(uc)).status, 403, `${uc} müşteriye açık`);
    assert.equal((await admin.get(uc)).status, 200, `${uc} yöneticiye 200 dönmedi`);
  }
});

test('Faz 2 yazma ucu yoktur (POST/PUT/PATCH/DELETE başarılı olmaz)', async () => {
  const admin = await adminAgent();
  for (const uc of ['/api/admin/health/providers', '/api/admin/health/payments', '/api/admin/health/errors', '/api/admin/health/provider/1']) {
    for (const yontem of ['post', 'put', 'patch', 'delete']) {
      const res = await admin[yontem](uc).send({});
      assert.ok(res.status >= 400 && res.status < 500, `${yontem.toUpperCase()} ${uc} -> ${res.status}`);
    }
  }
});

test('geçersiz pencere ve geçersiz sağlayıcı kimliği 400 döner', async () => {
  const admin = await adminAgent();
  for (const w of ['abc', '30d', '1h;DROP', '']) {
    const res = await admin.get('/api/admin/health/errors?window=' + encodeURIComponent(w));
    if (w === '') assert.equal(res.status, 200, 'boş pencere varsayılan 24h olmalı');
    else assert.equal(res.status, 400, `pencere "${w}" kabul edildi`);
  }
  for (const id of ['abc', '-1', '0', '1.5', '../etc']) {
    const res = await admin.get('/api/admin/health/provider/' + encodeURIComponent(id));
    assert.ok([400, 404].includes(res.status), `kimlik "${id}" -> ${res.status}`);
  }
  assert.equal((await admin.get('/api/admin/health/provider/999999')).status, 404);
});

// ------------------------------------------------- saglayici telemetrisi ----

test('başarılı çağrı: yanıt aynen döner, ok ve gecikme sayılır', async () => {
  const id = await yeniSaglayici('Basari');
  axios.post = async () => ({ status: 200, data: { balance: '12.5', currency: 'USD' } });
  const r = await new SmmProviderClient(SAGLAYICI_URL, SAGLAYICI_ANAHTAR, { id }).getBalance();
  assert.deepEqual(r, { balance: '12.5', currency: 'USD' });
  const m = await metrikler('p:' + id);
  assert.equal(m.provider_call.n, 1);
  assert.equal(m.provider_ok.n, 1);
  assert.equal(m.provider_fail, undefined);
});

test('zaman aşımı: getMultiOrderStatus yine null döner, provider_timeout kaydedilir', async () => {
  const id = await yeniSaglayici('Zaman');
  axios.post = async () => { throw axiosHatasi({ code: 'ECONNABORTED', message: 'timeout of 15000ms exceeded' }); };
  const r = await new SmmProviderClient(SAGLAYICI_URL, SAGLAYICI_ANAHTAR, { id }).getMultiOrderStatus(['1', '2']);
  assert.equal(r, null, 'davranış değişmiş');
  const o = await olaylar('provider:' + id);
  assert.equal(o.length, 1);
  assert.equal(o[0].category, 'provider_timeout');
  assert.match(o[0].detail, /getMultiOrderStatus/);
  assert.equal((await metrikler('p:' + id)).provider_fail.n, 1);
});

test('502: addOrder aynı mesajla hata verir, ham HTML gövdesi kaydedilmez', async () => {
  const id = await yeniSaglayici('Bes');
  axios.post = async () => { throw axiosHatasi({ status: 502, data: '<html><body>502 Bad Gateway nginx</body></html>' }); };
  await assert.rejects(
    new SmmProviderClient(SAGLAYICI_URL, SAGLAYICI_ANAHTAR, { id }).addOrder(10, 'https://instagram.com/x', 100),
    { message: 'Sipariş sağlayıcıya iletilemedi: Request failed with status code 502' }
  );
  const o = await olaylar('provider:' + id);
  assert.equal(o[0].category, 'provider_5xx');
  assert.match(o[0].detail, /HTTP 502/);
  assert.ok(!/<html|nginx/i.test(o[0].detail), 'ham yanıt gövdesi kaydedilmiş');
});

test('bakiye hatası: HTTP 200 {error} gövdesi aynen döner, provider_balance kritik kaydedilir', async () => {
  const id = await yeniSaglayici('Bakiye');
  axios.post = async () => ({ status: 200, data: { error: 'Not enough funds' } });
  const r = await new SmmProviderClient(SAGLAYICI_URL, SAGLAYICI_ANAHTAR, { id }).addOrder(10, 'https://instagram.com/x', 100);
  assert.deepEqual(r, { error: 'Not enough funds' }, 'dönüş değeri değişmiş');
  const o = await olaylar('provider:' + id);
  assert.equal(o[0].category, 'provider_balance');
  assert.equal(o[0].severity, 'critical');
  assert.equal((await metrikler('p:' + id)).provider_fail.n, 1);
});

test('bakiye hatası HTTP 400 ile gelirse de sınıflanır; hata mesajı değişmez', async () => {
  const id = await yeniSaglayici('Bakiye400');
  axios.post = async () => { throw axiosHatasi({ status: 400, data: { error: 'Not enough balance' } }); };
  await assert.rejects(
    new SmmProviderClient(SAGLAYICI_URL, SAGLAYICI_ANAHTAR, { id }).addOrder(10, 'https://instagram.com/x', 100),
    { message: 'Sipariş sağlayıcıya iletilemedi: Not enough balance' }
  );
  assert.equal((await olaylar('provider:' + id))[0].category, 'provider_balance');
});

test('sipariş ve durum hataları ayrı kategorilere düşer', async () => {
  const id = await yeniSaglayici('Kategori');
  const c = new SmmProviderClient(SAGLAYICI_URL, SAGLAYICI_ANAHTAR, { id });
  axios.post = async () => ({ status: 200, data: { error: 'Invalid link' } });
  await c.addOrder(10, 'https://instagram.com/x', 100);
  axios.post = async () => ({ status: 200, data: { error: 'Incorrect request' } });
  const durum = await c.getMultiOrderStatus(['5']);
  assert.deepEqual(durum, { error: 'Incorrect request' });
  const kategoriler = (await olaylar('provider:' + id)).map(o => o.category).sort();
  assert.deepEqual(kategoriler, ['provider_order_error', 'provider_status_error']);
});

test('ağ hatasında host adı maskelenir', async () => {
  const id = await yeniSaglayici('Ag');
  axios.post = async () => { throw axiosHatasi({ code: 'EAI_AGAIN', message: 'getaddrinfo EAI_AGAIN gizli-saglayici.example.com' }); };
  await new SmmProviderClient(SAGLAYICI_URL, SAGLAYICI_ANAHTAR, { id }).getBalance();
  const o = await olaylar('provider:' + id);
  assert.equal(o[0].category, 'provider_network');
  assert.ok(!o[0].detail.includes('gizli-saglayici'), 'host adı sızmış');
});

test('meta verilmeyen istemci (yeni sağlayıcı testi) ölçülmez', async () => {
  const once = await dbAsync.get("SELECT COUNT(*) n FROM health_metrics_hourly WHERE metric = 'provider_call'");
  await healthEvents.drain();
  const once2 = await dbAsync.get("SELECT COALESCE(SUM(n), 0) n FROM health_metrics_hourly WHERE metric = 'provider_call'");
  axios.post = async () => ({ status: 200, data: { balance: '1', currency: 'USD' } });
  await new SmmProviderClient(SAGLAYICI_URL, SAGLAYICI_ANAHTAR).getBalance();
  await healthEvents.drain();
  const sonra = await dbAsync.get("SELECT COALESCE(SUM(n), 0) n FROM health_metrics_hourly WHERE metric = 'provider_call'");
  assert.ok(once.n >= 0);
  assert.equal(sonra.n, once2.n, 'kimliksiz istemci ölçülmüş');
});

test('mevcut davranış korunur: hata dönüşleri ve mesajları aynı', async () => {
  const id = await yeniSaglayici('Davranis');
  const c = new SmmProviderClient(SAGLAYICI_URL, SAGLAYICI_ANAHTAR, { id });
  axios.post = async () => { throw axiosHatasi({ status: 503 }); };
  assert.deepEqual(await c.getBalance(), { balance: 0, currency: 'USD' });
  assert.equal(await c.getOrderStatus('1'), null);
  assert.equal(await c.getMultiOrderStatus(['1']), null);
  await assert.rejects(c.requestRefill('1'), { message: 'Telafi isteği sağlayıcıya iletilemedi: Request failed with status code 503' });
  await assert.rejects(c.getServices(), { message: 'Sağlayıcı servisine bağlanılamadı (Request failed with status code 503).' });
  axios.post = async () => ({ status: 200, data: { order: 4242 } });
  assert.deepEqual(await c.addOrder(10, 'https://instagram.com/x', 100), { order: 4242 });
});

// -------------------------------------------------- toplama ve puanlama ----

test('gecikme toplamı saatlik UPSERT ile birikir (n, sum, min, max)', async () => {
  const scope = 'p:987654';
  healthEvents.recordMetric('provider_call', scope, 100);
  healthEvents.recordMetric('provider_call', scope, 200);
  healthEvents.recordMetric('provider_call', scope, 300);
  let m = await metrikler(scope);
  assert.equal(m.provider_call.n, 3);
  assert.equal(m.provider_call.toplam, 600);
  assert.equal(m.provider_call.enaz, 100);
  assert.equal(m.provider_call.encok, 300);
  healthEvents.recordMetric('provider_call', scope, 50);
  m = await metrikler(scope);
  assert.equal(m.provider_call.n, 4, 'ikinci boşaltma üzerine eklemedi');
  assert.equal(m.provider_call.toplam, 650);
  assert.equal(m.provider_call.enaz, 50);
  assert.equal(m.provider_call.encok, 300);
});

test('tanımsız metrik ve geçersiz kapsam kaydedilmez (metrik patlaması yok)', () => {
  assert.equal(healthEvents.recordMetric('rastgele_metrik', 'x', 1), false);
  assert.equal(healthEvents.recordMetric('provider_call', 'kötü kapsam!', 1), false);
  assert.equal(healthEvents.recordMetric('provider_call', 'p:1', 'sayi-degil'), false);
});

test('düşük örnek: 0 çağrı Veri Yok, 1-4 çağrı Yetersiz Örnek, asla kritik değil', async () => {
  const bos = await yeniSaglayici('Bos');
  const az = await yeniSaglayici('Az');
  axios.post = async () => { throw axiosHatasi({ status: 502 }); };
  const c = new SmmProviderClient(SAGLAYICI_URL, SAGLAYICI_ANAHTAR, { id: az });
  for (let i = 0; i < 3; i++) await c.getBalance();
  const rapor = await healthReports.providerReport();
  const pBos = rapor.providers.find(p => p.id === bos);
  const pAz = rapor.providers.find(p => p.id === az);
  assert.equal(pBos.status, 'no_data');
  assert.equal(pAz.status, 'low_sample', '3 başarısız çağrı kritik gösterilmemeli');
  assert.equal(pAz.window_24h.requests, 3);
  assert.equal(pAz.window_24h.err_5xx, 3);
});

test('eşikler: sağlıklı / uyarı / kritik / yavaş', () => {
  const d = (o) => healthReports.saglayiciDurumu({ timeouts: 0, err_5xx: 0, network: 0, avg_ms: 300, ...o }).status;
  assert.equal(d({ requests: 100, ok: 99, success_rate: 99 }), 'healthy');
  assert.equal(d({ requests: 100, ok: 90, success_rate: 90 }), 'warning');
  assert.equal(d({ requests: 100, ok: 70, success_rate: 70 }), 'critical');
  assert.equal(d({ requests: 100, ok: 85, success_rate: 85, timeouts: 10, err_5xx: 10 }), 'critical');
  assert.equal(d({ requests: 100, ok: 100, success_rate: 100, avg_ms: 6000 }), 'warning');
  assert.equal(d({ requests: 100, ok: 96, success_rate: 96, timeouts: 6 }), 'warning');
  assert.equal(d({ requests: 4, ok: 0, success_rate: 0 }), 'low_sample');
  assert.equal(d({ requests: 0, ok: 0, success_rate: null }), 'no_data');
});

test('sağlayıcı/ödeme SYSTEM HEALTH puanına katılmaz (seçenek A)', async () => {
  const admin = await adminAgent();
  const res = await admin.get('/api/admin/health/score-explain');
  const anahtarlar = res.body.components.map(c => c.key);
  assert.equal(anahtarlar.length, 6);
  assert.ok(!anahtarlar.some(k => /provider|payment|saglayici|odeme/.test(k)));
});

// ------------------------------------------------------------ redaction ----

test('redact: anahtar, URL, host, e-posta, JWT, bot token, kart, IP maskelenir', () => {
  const girdi = [
    'key=abc123def456ghi789', 'api_key: sk_live_ZZZZ', 'https://saglayici.example.com/api?key=x',
    'user@mail.com', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.imzaimzaimza',
    '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw', '4111 1111 1111 1111', '185.12.33.4',
    'Bearer abc.def.ghi', 'password=Sifre123', 'getaddrinfo ENOTFOUND panel.example.net',
    '0532 123 45 67'
  ].join(' ');
  const cikti = healthEvents.redact(girdi);
  for (const sizinti of ['abc123def456', 'sk_live_ZZZZ', 'example.com', 'user@mail.com', 'eyJhbGci', 'AAHdqTcv',
    '4111', '185.12.33.4', 'abc.def.ghi', 'Sifre123', 'panel.example', '123 45 67']) {
    assert.ok(!cikti.includes(sizinti), `redact sonrası sızıntı: ${sizinti} -> ${cikti}`);
  }
});

test('detail 300 karakterle sınırlanır (DB satırı dahil)', async () => {
  const uzun = 'hata metni '.repeat(100);
  assert.ok(healthEvents.redact(uzun).length <= 300);
  assert.ok(healthEvents.redact(uzun).endsWith('…'));
  healthEvents.recordHealthEvent({ category: 'payment_error', source: 'shopier_create', detail: uzun });
  const o = await olaylar('shopier_create');
  assert.ok(o.every(r => r.detail.length <= 300));
});

test('tanımsız kategori kaydedilmez; bilinmeyen kaynak "unknown" olur', async () => {
  assert.equal(healthEvents.recordHealthEvent({ category: 'uydurma_kategori', source: 'x', detail: 'y' }), false);
  healthEvents.recordHealthEvent({ category: 'worker_error', source: 'kötü kaynak/../', detail: 'kaynak testi' });
  const o = await olaylar('unknown');
  assert.ok(o.some(r => r.detail === 'kaynak testi'));
  const uydurma = await dbAsync.get("SELECT COUNT(*) n FROM health_events WHERE category = 'uydurma_kategori'");
  assert.equal(uydurma.n, 0);
});

test('taşma koruması: aynı olay dakikada bir satır, sayaç her seferinde artar', async () => {
  for (let i = 0; i < 5; i++) {
    healthEvents.recordHealthEvent({ category: 'telegram_5xx', source: 'telegram', detail: 'sendMessage · HTTP 502: tasma testi' });
  }
  const satir = (await olaylar('telegram')).filter(r => r.detail.includes('tasma testi'));
  assert.equal(satir.length, 1, 'aynı olay birden fazla satır yazmış');
  const m = await dbAsync.get("SELECT SUM(n) n FROM health_metrics_hourly WHERE metric = 'event' AND scope = 'telegram_5xx|warning|telegram'");
  assert.equal(m.n, 5, 'sayaç eksik');
});

test('Telegram: 429/5xx/zaman aşımı kaydedilir, kullanıcı düzeyi 4xx kaydedilmez', async () => {
  const e429 = new Error('Too Many Requests: retry after 5');
  assert.equal(healthEvents.recordTelegramFailure({ method: 'sendMessage', httpStatus: 429, error: e429 }), true);
  assert.equal(e429.healthRecorded, true);
  assert.equal(healthEvents.recordTelegramFailure({ method: 'getUpdates', error: axiosHatasi({ code: 'ECONNABORTED', message: 'timeout of 12000ms exceeded' }) }), true);
  assert.equal(healthEvents.recordTelegramFailure({ method: 'sendMessage', httpStatus: 403, error: new Error('Forbidden: bot was blocked by the user') }), false);
  const kategoriler = (await olaylar('telegram')).map(r => r.category);
  assert.ok(kategoriler.includes('telegram_429'));
  assert.ok(kategoriler.includes('telegram_timeout'));
});

// --------------------------------------------- telemetri ana akisi bozmaz ----

test('telemetri hata verse bile sağlayıcı çağrısı aynen döner', async () => {
  const id = await yeniSaglayici('Dayaniklilik');
  const asil = healthEvents.recordProviderCall;
  healthEvents.recordProviderCall = () => { throw new Error('telemetri patladı'); };
  try {
    axios.post = async () => ({ status: 200, data: { order: 77 } });
    const c = new SmmProviderClient(SAGLAYICI_URL, SAGLAYICI_ANAHTAR, { id });
    assert.deepEqual(await c.addOrder(10, 'https://instagram.com/x', 100), { order: 77 });
    axios.post = async () => { throw axiosHatasi({ status: 502 }); };
    assert.deepEqual(await c.getBalance(), { balance: 0, currency: 'USD' });
  } finally {
    healthEvents.recordProviderCall = asil;
  }
});

test('veritabanı yazılamazsa kayıt fonksiyonları fırlatmaz, akış sürer', async () => {
  const asil = dbAsync.run;
  dbAsync.run = () => Promise.reject(new Error('SQLITE_BUSY: database is locked'));
  try {
    assert.doesNotThrow(() => healthEvents.recordHealthEvent({ category: 'payment_error', source: 'shopier_create', detail: 'db kilitli testi' }));
    assert.doesNotThrow(() => healthEvents.recordError({ category: 'payment_error', source: 'paytr_token', error: new Error('x') }));
    assert.doesNotThrow(() => healthEvents.workerBeat('order_worker', false, new Error('y')));
    await healthEvents.drain();
  } finally {
    dbAsync.run = asil;
  }
});

// ------------------------------------------------------------- odeme ----

test('ödeme: webhook imza hatası kaydedilir, yanıt kodu değişmez', async () => {
  const res = await request(app).post('/api/payments/shopier/webhook')
    .set('content-type', 'application/json').send('{"id":"1","paymentStatus":"paid"}');
  assert.equal(res.status, 400);
  const o = await olaylar('shopier_webhook');
  assert.ok(o.some(r => r.category === 'webhook_error'), 'webhook hatası kaydedilmedi');
});

test('ödeme: PayTR callback hatası kaydedilir (yapılandırma yok)', async () => {
  const res = await request(app).post('/api/payments/paytr/callback')
    .type('form').send({ merchant_oid: 'X1', status: 'success', total_amount: '100', hash: 'sahte' });
  assert.ok([400, 500].includes(res.status), `beklenmeyen durum ${res.status}`);
  const o = await olaylar('paytr_callback');
  assert.ok(o.some(r => r.category === 'webhook_error'));
});

test('ödeme hatası detayında kişisel veri kalmaz', async () => {
  healthEvents.recordError({
    category: 'payment_error', source: 'nowpayments_create',
    error: new Error('Kullanici ali.veli@ornek.com kart 4111 1111 1111 1111 token=abc123xyz tel 0532 123 45 67 basarisiz')
  });
  const o = await olaylar('nowpayments_create');
  const d = o[o.length - 1].detail;
  for (const sizinti of ['ali.veli@ornek.com', '4111', 'abc123xyz', '123 45 67']) {
    assert.ok(!d.includes(sizinti), `PII sızdı: ${sizinti}`);
  }
});

test('SQLite hatası hangi akışta olursa olsun sqlite_error olur', async () => {
  const e = new Error('SQLITE_BUSY: database is locked');
  e.code = 'SQLITE_BUSY';
  healthEvents.recordError({ category: 'payment_worker_error', source: 'shopier_reconcile', error: e });
  const o = await olaylar('shopier_reconcile');
  assert.equal(o[o.length - 1].category, 'sqlite_error');
  assert.equal(o[o.length - 1].severity, 'critical');
});

test('ödeme raporu: son başarı ödeme kaydından okunur, PII içermez', async () => {
  const kullanici = await dbAsync.get("SELECT id FROM users WHERE username = 'saglik2_musteri'");
  await dbAsync.run(
    "INSERT INTO payment_intents (user_id, provider, merchant_oid, amount_kurus, status, completed_at) VALUES (?, 'shopier', 'TESTOIDGIZLI42', 98765, 'completed', CURRENT_TIMESTAMP)",
    [kullanici.id]
  );
  const admin = await adminAgent();
  const res = await admin.get('/api/admin/health/payments');
  assert.equal(res.status, 200);
  const shopier = res.body.providers.find(p => p.key === 'shopier');
  assert.ok(shopier.last_success_at, 'son başarı zamanı yok');
  assert.ok(shopier.intents_24h.completed >= 1);
  assert.equal(res.body.providers.find(p => p.key === 'nowpayments').intents_24h.created, 0);
  const govde = JSON.stringify(res.body);
  for (const sizinti of ['TESTOIDGIZLI42', '98765', '987.65', 'saglik2_musteri', '@ornek.com', '"user_id"', '"merchant_oid"', '"amount']) {
    assert.ok(!govde.includes(sizinti), `ödeme yanıtında PII/kimlik: ${sizinti}`);
  }
  const isciler = res.body.workers.map(w => w.key).sort();
  assert.deepEqual(isciler, ['order_worker', 'provider_balance', 'shopier_reconcile', 'telegram_poller']);
});

test('iş nabzı: art arda 3 hata kritik, sonra başarı sağlıklı', async () => {
  for (let i = 0; i < 3; i++) healthEvents.workerBeat('shopier_reconcile', false, new Error('Shopier zaman aşımı'));
  let r = await healthReports.paymentReport();
  assert.equal(r.workers.find(w => w.key === 'shopier_reconcile').status, 'critical');
  healthEvents.workerBeat('shopier_reconcile', true);
  r = await healthReports.paymentReport();
  const w = r.workers.find(x => x.key === 'shopier_reconcile');
  assert.equal(w.status, 'healthy');
  assert.ok(w.runs_24h >= 4);
  assert.ok(w.fails_24h >= 3);
});

// ----------------------------------------------------------- hatalar ----

test('hatalar: 1h / 24h / 7d penceresi saatlik kovalara göre süzülür', async () => {
  const simdi = Date.now();
  const an = Math.floor(simdi / 1000);
  const ekle = (ms, n) => dbAsync.run(
    "INSERT INTO health_metrics_hourly (bucket, metric, scope, n, \"sum\", \"min\", \"max\") VALUES (?, 'event', 'provider_network|warning|provider:424242', ?, 0, ?, ?)",
    [healthEvents.saatKovasi(ms), n, an, an]
  );
  await ekle(simdi, 1);
  await ekle(simdi - 5 * 3600 * 1000, 2);
  await ekle(simdi - 3 * 86400 * 1000, 4);
  const admin = await adminAgent();
  const say = async (w) => {
    const res = await admin.get('/api/admin/health/errors?window=' + w);
    assert.equal(res.status, 200);
    const kat = res.body.categories.find(c => c.category === 'provider_network');
    return (kat?.sources || []).filter(s => s.source === 'Sağlayıcı #424242').reduce((a, s) => a + s.count, 0);
  };
  assert.equal(await say('1h'), 1);
  assert.equal(await say('24h'), 3);
  assert.equal(await say('7d'), 7);
});

test('hatalar yanıtı kategori, sayı, önem, kaynak, son görülme ve örnek taşır', async () => {
  const admin = await adminAgent();
  const res = await admin.get('/api/admin/health/errors?window=24h');
  assert.equal(res.status, 200);
  assert.ok(res.body.window_note);
  const kat = res.body.categories[0];
  for (const alan of ['category', 'label', 'severity', 'count', 'last_seen', 'sources', 'samples']) {
    assert.ok(alan in kat, `${alan} alanı yok`);
  }
  assert.ok(res.body.categories.every(c => c.samples.length <= 3), 'örnek sayısı sınırsız');
});

// ------------------------------------------------------------ temizlik ----

test('temizlik: 7 günden eski olay, 30 günden eski metrik silinir', async () => {
  await dbAsync.run("INSERT INTO health_events (category, severity, source, detail, created_at) VALUES ('worker_error', 'warning', 'order_worker', 'eski olay', datetime('now', '-8 days'))");
  await dbAsync.run("INSERT INTO health_events (category, severity, source, detail) VALUES ('worker_error', 'warning', 'order_worker', 'yeni olay')");
  await dbAsync.run("INSERT INTO health_metrics_hourly (bucket, metric, scope, n) VALUES (?, 'worker_run', 'order_worker', 1)", [healthEvents.saatKovasi(Date.now() - 31 * 86400 * 1000)]);
  await dbAsync.run("INSERT INTO health_metrics_hourly (bucket, metric, scope, n) VALUES (?, 'worker_run', 'order_worker', 1) ON CONFLICT DO NOTHING", [healthEvents.saatKovasi(Date.now() - 2 * 86400 * 1000)]);
  const sonuc = await healthEvents.prune();
  assert.ok(sonuc.olay >= 1 && sonuc.metrik >= 1);
  const olayDetay = (await dbAsync.all("SELECT detail FROM health_events WHERE source = 'order_worker'")).map(r => r.detail);
  assert.ok(!olayDetay.includes('eski olay'));
  assert.ok(olayDetay.includes('yeni olay'));
  const eskiMetrik = await dbAsync.get("SELECT COUNT(*) n FROM health_metrics_hourly WHERE bucket < datetime('now', '-30 days')");
  assert.equal(eskiMetrik.n, 0);
});

// ------------------------------------------------------ çıktı güvenliği ----

test('Faz 2 yanıtlarında API anahtarı, URL veya sır bulunmaz', async () => {
  const admin = await adminAgent();
  const id = await yeniSaglayici('Sizinti');
  axios.post = async () => { throw axiosHatasi({ code: 'ENOTFOUND', message: `getaddrinfo ENOTFOUND 127.0.0.1 key=${SAGLAYICI_ANAHTAR}` }); };
  await new SmmProviderClient(SAGLAYICI_URL, SAGLAYICI_ANAHTAR, { id }).getBalance();
  const yasakliAnahtar = /"(api_?key|api_?url|api_?secret|secret|token|password|password_hash|authorization|cookie|jwt|webhook_secret|email)"/i;
  for (const uc of ['/api/admin/health/providers', '/api/admin/health/payments', '/api/admin/health/errors?window=7d', `/api/admin/health/provider/${id}`]) {
    const res = await admin.get(uc);
    assert.equal(res.status, 200);
    const govde = JSON.stringify(res.body);
    assert.ok(!govde.includes(SAGLAYICI_ANAHTAR), `${uc} API anahtarı sızdırıyor`);
    assert.ok(!govde.includes('sk_live'), `${uc} anahtar parçası sızdırıyor`);
    assert.ok(!govde.includes('127.0.0.1'), `${uc} sağlayıcı adresi sızdırıyor`);
    assert.ok(!yasakliAnahtar.test(govde), `${uc} yasaklı alan adı taşıyor`);
    assert.ok(!/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(govde), `${uc} e-posta taşıyor`);
  }
});

test('okuma yolu dış servise istek atmaz; yeni modüllerde kabuk yok', () => {
  const oku = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
  // Metin etiketlerini degil (or. 'shopier_webhook' kaynak adi) GERCEK
  // yuklemeleri ve ag cagrilarini denetler.
  for (const p of ['services/healthReports.js', 'routes/adminHealth.js']) {
    const k = oku(p);
    const yuklenen = [...k.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m => m[1]);
    for (const g of yuklenen) {
      assert.ok(!/axios|smmProvider|shopier|paytr|nowpayments|telegramNotifier|node-fetch|undici|^https?$/i.test(g),
        `${p} dış servis modülü yüklüyor: ${g}`);
    }
    assert.ok(!/\baxios\.|\bfetch\(|\bhttps?\.(request|get)\(/.test(k), `${p} ağ çağrısı yapıyor`);
  }
  for (const p of ['services/healthEvents.js', 'services/healthReports.js', 'routes/adminHealth.js']) {
    // (?<![.\w]) : RegExp.prototype.exec gibi ".exec(" metot cagrilarini disarida birakir.
    assert.ok(!/require\(\s*['"]child_process['"]\s*\)|execSync|spawnSync|(?<![.\w])spawn\(|(?<![.\w])exec\(/.test(oku(p)), `${p} kabuk kullanıyor`);
  }
  assert.ok(!/process\.on\(\s*['"](uncaughtException|unhandledRejection)/.test(oku('server.js')), 'süreç işleyicisi eklenmiş');
});

test('Faz 2 uçları 100 ms altında yanıt verir', async () => {
  const admin = await adminAgent();
  for (const uc of ['/api/admin/health/providers', '/api/admin/health/payments', '/api/admin/health/errors?window=7d']) {
    await admin.get(uc);
    const t = process.hrtime.bigint();
    const res = await admin.get(uc);
    const ms = Number(process.hrtime.bigint() - t) / 1e6;
    assert.equal(res.status, 200);
    assert.ok(ms < 100, `${uc} ${ms.toFixed(1)} ms sürdü`);
  }
});

// --------------------------------------------------------------- UI ----

test('admin panelinde Servisler / Ödemeler / Hatalar sekmeleri bağlı', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  for (const b of ['overview', 'application', 'providers', 'payments', 'errors']) {
    assert.ok(html.includes(`data-health-section="${b}"`), `${b} sekme düğmesi yok`);
    assert.ok(html.includes(`id="health-section-${b}"`), `${b} bölümü yok`);
  }
  for (const g of ['health-providers-body', 'health-payments-body', 'health-errors-body']) {
    assert.ok(html.includes(`id="${g}"`), `${g} gövdesi yok`);
  }
  const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
  for (const f of ['loadHealthProviders', 'loadHealthPayments', 'loadHealthErrors', 'renderHealthProviders', 'renderHealthPayments', 'renderHealthErrors']) {
    assert.ok(js.includes(f + '('), `${f} yok`);
  }
  assert.ok(js.includes('Veri Yok'), 'Veri Yok rozeti yok');
  assert.ok(js.includes('Yetersiz'), 'Yetersiz Örnek rozeti yok');
  const saglikBlogu = js.slice(js.indexOf('showHealthSection(bolum) {'), js.indexOf('toggleAuthViewMode() {'));
  assert.ok(!/api_key|api_url|apiKey/.test(saglikBlogu), 'sağlık arayüzü anahtar/adres alanına dokunuyor');
});
