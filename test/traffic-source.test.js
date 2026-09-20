// Trafik kaynagi takibi (20 Eyl 2026).
//
// NEDEN: Search Console 36 gunde 17 tiklama gosterirken sitede 6.871 ziyaret
// kaydi vardi — yani trafigin neredeyse tamami Google disindan geliyordu ama
// hangi kanaldan geldigi hic olculmuyordu. Panelde "nereden geliyorlar"
// sorusunu cevaplayabilmek icin ziyaretin ILK temasindaki referans alan adi,
// kanal tipi ve giris sayfasi kaydedilir.
//
// GIZLILIK KURALI: tam adres DEGIL yalnizca alan adi saklanir; arama sorgusu,
// izleme parametreleri ve ham IP kayda girmez.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-traffic-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.PUBLIC_BASE_URL = 'https://jetsmmpanel.com';
process.env.PAYMENT_RATE_LIMIT_MAX = '500';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');
const { parseReferrer, recordVisit, getTrafficSources } = require('../services/visitorTracker');

const ADMIN_PASSWORD = 'GuvenliAdminSifre_2026';

test.before(async () => {
  await initDatabase();
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  await agent.post('/api/admin/change-password').send({ current_password: 'admin12345', new_password: ADMIN_PASSWORD });
});

test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

// Sahte istek: yalnizca parseReferrer'in okudugu alanlar.
const istek = (referer, url = '/') => ({ headers: referer ? { referer } : {}, originalUrl: url });

test('arama motorları "arama" kanalına düşer', () => {
  for (const u of ['https://www.google.com/search?q=smm+panel', 'https://www.bing.com/search?q=x',
    'https://yandex.com.tr/search/?text=y', 'https://duckduckgo.com/?q=z']) {
    const { type } = parseReferrer(istek(u));
    assert.equal(type, 'arama', `${u} arama sayilmadi`);
  }
});

test('sosyal ağlar "sosyal" kanalına düşer (t.me ve x.com dâhil)', () => {
  for (const u of ['https://t.me/kanalim', 'https://x.com/biri/status/1', 'https://www.instagram.com/p/abc',
    'https://www.youtube.com/watch?v=1', 'https://wa.me/905550000000']) {
    const { type } = parseReferrer(istek(u));
    assert.equal(type, 'sosyal', `${u} sosyal sayilmadi`);
  }
});

test('tanınmayan site "yönlendiren" olur; alan adı VE sayfa yolu saklanır', () => {
  const { host, path, type } = parseReferrer(istek('https://www.producthunt.com/products/jet-smm-panel/reviews'));
  assert.equal(type, 'yonlendiren');
  assert.equal(host, 'www.producthunt.com');
  // Forum/yorum linkinde hangi sayfadan gelindigi bilinmeli.
  assert.equal(path, '/products/jet-smm-panel/reviews');
});

test('forum konusundan gelen ziyaretin tam sayfası kaydedilir', () => {
  const { host, path, type } = parseReferrer(istek('https://www.r10.net/sosyal-medya/1234567-en-iyi-smm-panel-onerisi.html?page=3'));
  assert.equal(type, 'yonlendiren');
  assert.equal(host, 'www.r10.net');
  assert.equal(path, '/sosyal-medya/1234567-en-iyi-smm-panel-onerisi.html');
  assert.ok(!String(path).includes('?'), 'sorgu dizesi saklanmis');
});

test('arama motorlarında sayfa yolu KAYDEDİLMEZ (sorgu sızıntısı riski)', () => {
  // Bazi motorlar aramayi yola yazar: /search/gizli+sorgu
  const { host, path, type } = parseReferrer(istek('https://www.google.com/search/gizli+arama+sorgusu'));
  assert.equal(type, 'arama');
  assert.equal(host, 'www.google.com');
  assert.equal(path, null, 'arama motorunda yol saklanmis — sorgu sizabilir');
});

test('referans yoksa veya bozuksa "doğrudan" sayılır', () => {
  assert.equal(parseReferrer(istek(null)).type, 'dogrudan');
  assert.equal(parseReferrer(istek('')).type, 'dogrudan');
  assert.equal(parseReferrer(istek('bu bir adres degil')).type, 'dogrudan');
});

test('kendi sitemizden gelen geçiş kaynak sayılmaz (iç gezinme)', () => {
  // PUBLIC_BASE_URL = https://jetsmmpanel.com
  for (const u of ['https://jetsmmpanel.com/blog', 'https://www.jetsmmpanel.com/services']) {
    const { host, type } = parseReferrer(istek(u));
    assert.equal(type, 'dogrudan', `${u} ic gezinme sayilmadi`);
    assert.equal(host, null);
  }
});

test('tam adres değil yalnızca alan adı saklanır (gizlilik)', () => {
  const { host } = parseReferrer(istek('https://www.google.com/search?q=gizli+arama+sorgusu&hl=tr'));
  assert.equal(host, 'www.google.com');
  assert.ok(!String(host).includes('gizli'), 'arama sorgusu alan adina sizmis');
  assert.ok(!String(host).includes('?'), 'sorgu dizesi saklanmis');
});

test('ziyaret kaydında kaynak ve giriş sayfası veritabanına yazılır', async () => {
  const req = {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      'accept-language': 'tr-TR',
      referer: 'https://t.me/smmjetduyuru'
    },
    originalUrl: '/tiktok-smm-panel?utm_source=telegram',
    ip: '203.0.113.10',
    socket: { remoteAddress: '203.0.113.10' }
  };
  assert.equal(await recordVisit(req), true);

  const satir = await dbAsync.get(
    "SELECT referrer_host, referrer_path, source_type, landing_path FROM site_visits WHERE source_type = 'sosyal' ORDER BY id DESC LIMIT 1"
  );
  assert.ok(satir, 'ziyaret kaydi olusmadi');
  assert.equal(satir.referrer_host, 't.me');
  assert.equal(satir.referrer_path, '/smmjetduyuru', 'kaynak sayfa yolu yazilmadi');
  assert.equal(satir.source_type, 'sosyal');
  // Sorgu dizesi ayiklanmis olmali.
  assert.equal(satir.landing_path, '/tiktok-smm-panel');
});

test('aynı ziyaretçi gün içinde tekrar gelirse İLK kaynağı korunur', async () => {
  const ortak = {
    'user-agent': 'Mozilla/5.0 (Macintosh) AppleWebKit/605 Safari/605',
    'accept-language': 'tr'
  };
  const ilk = { headers: { ...ortak, referer: 'https://www.google.com/search?q=smm' }, originalUrl: '/', ip: '198.51.100.7', socket: { remoteAddress: '198.51.100.7' } };
  await recordVisit(ilk);

  // Ayni kisi site icinde gezinip tekrar kayda dusuyor: kaynak degismemeli,
  // yoksa her ziyaretci sonunda "dogrudan" gorunurdu.
  const ikinci = { headers: { ...ortak }, originalUrl: '/services', ip: '198.51.100.7', socket: { remoteAddress: '198.51.100.7' } };
  await recordVisit(ikinci);

  const satirlar = await dbAsync.all(
    "SELECT referrer_host, source_type, landing_path FROM site_visits WHERE referrer_host = 'www.google.com'"
  );
  assert.equal(satirlar.length, 1, 'ayni gun icin ikinci satir olusmus');
  assert.equal(satirlar[0].source_type, 'arama');
  assert.equal(satirlar[0].landing_path, '/', 'ilk giris sayfasi ezilmis');
});

test('bot ziyareti kaynak tablosuna girmez', async () => {
  const oncesi = await dbAsync.get('SELECT COUNT(*) n FROM site_visits');
  await recordVisit({
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', referer: 'https://www.google.com/' },
    originalUrl: '/', ip: '66.249.66.1', socket: { remoteAddress: '66.249.66.1' }
  });
  const sonrasi = await dbAsync.get('SELECT COUNT(*) n FROM site_visits');
  assert.equal(sonrasi.n, oncesi.n, 'bot ziyareti kaydedilmis');
});

test('getTrafficSources kanal dağılımını ve alan adlarını döndürür', async () => {
  const t = await getTrafficSources(30);
  assert.ok(Array.isArray(t.channels), 'channels dizi degil');
  assert.ok(Array.isArray(t.domains), 'domains dizi degil');
  assert.ok(Array.isArray(t.landing_pages), 'landing_pages dizi degil');

  const tipler = t.channels.map(c => c.type);
  assert.ok(tipler.includes('sosyal') && tipler.includes('arama'), 'kanallar eksik: ' + tipler.join(','));
  // Yuzde paylari toplami makul olmali (yuvarlama payi birakilir).
  const toplamPay = t.channels.reduce((s, c) => s + c.share, 0);
  assert.ok(toplamPay >= 95 && toplamPay <= 105, 'kanal paylari toplami hatali: ' + toplamPay);

  const hostlar = t.domains.map(d => d.host);
  assert.ok(hostlar.includes('t.me'), 'alan adi listesi eksik: ' + hostlar.join(','));

  // Tam kaynak sayfa listesi: tiklanabilir adresle birlikte gelmeli.
  assert.ok(Array.isArray(t.source_pages), 'source_pages dizi degil');
  const telegram = t.source_pages.find(s => s.host === 't.me');
  assert.ok(telegram, 'kaynak sayfa listesinde t.me yok');
  assert.equal(telegram.url, 'https://t.me/smmjetduyuru');
  // Arama motoru kayitlari yol tutmadigi icin bu listeye girmemeli.
  assert.ok(!t.source_pages.some(s => s.type === 'arama'), 'arama motoru kaynak sayfa listesine girmis');
});

test('admin istatistik ucu trafik, satış sayfası ve huni verisini döndürür', async () => {
  const agent = request.agent(app);
  const login = await agent.post('/api/auth/login').send({ username: 'admin', password: ADMIN_PASSWORD });
  assert.equal(login.status, 200, 'admin girisi basarisiz');

  const res = await agent.get('/api/admin/statistics?days=7');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.window_days, 7, 'gun penceresi uygulanmadi');

  assert.ok(res.body.traffic, 'traffic alani yok');
  assert.ok(Array.isArray(res.body.traffic.channels), 'traffic.channels yok');
  assert.ok(res.body.landing, 'landing alani yok');
  assert.ok(Array.isArray(res.body.landing.pages), 'landing.pages yok');
  assert.ok(res.body.growth, 'growth alani yok');
  assert.ok(Array.isArray(res.body.growth.revenue), 'growth.revenue yok');
  assert.ok(res.body.funnel, 'funnel alani yok');
  for (const alan of ['visitors', 'signups', 'buyers', 'payers']) {
    assert.equal(typeof res.body.funnel[alan], 'number', `funnel.${alan} sayi degil`);
  }
  // Eski alanlar korunmali (panelin diger bolumleri bunlari kullaniyor).
  assert.ok(res.body.visitors && res.body.blog && res.body.services, 'mevcut alanlar bozulmus');
});

test('istatistik ucu oturumsuz erişime kapalı', async () => {
  const res = await request(app).get('/api/admin/statistics');
  assert.ok([401, 403].includes(res.status), 'yetkisiz erisim engellenmedi: ' + res.status);
});
