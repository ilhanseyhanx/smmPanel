// Sistem Sagligi - Faz 3 testleri: SEO & Crawler.
// Kapsam: yetki, bot kaydi (gizlilik: IP/UA saklanmaz), 404 yolu temizligi,
// sitemap tutarliligi, IndexNow metrik semasi, taskin korumasi.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-saglik3-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');
const crawlerTracker = require('../services/crawlerTracker');

const ADMIN_PASSWORD = 'GuvenliAdminSifre_2026';
const GOOGLEBOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

test.before(async () => {
  await initDatabase();
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  await agent.post('/api/admin/change-password').send({
    current_password: 'admin12345', new_password: ADMIN_PASSWORD
  });
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

// Fire-and-forget INSERT'lerin oturmasi icin kisa bekleme.
const bekle = (ms = 60) => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------- yetki ----

test('SEO ucu oturumsuz 401, geçersiz pencere 400 döner', async () => {
  assert.equal((await request(app).get('/api/admin/health/seo')).status, 401);
  const agent = await adminAgent();
  assert.equal((await agent.get('/api/admin/health/seo?window=99x')).status, 400);
});

// ------------------------------------------------------------- bot kaydi ----

test('Googlebot ziyareti kaydedilir; IP ve ham UA saklanmaz', async () => {
  crawlerTracker._reset();
  const res = await request(app).get('/').set('User-Agent', GOOGLEBOT_UA);
  assert.equal(res.status, 200);
  await bekle();
  const satir = await dbAsync.get("SELECT * FROM crawler_visits WHERE bot = 'googlebot' AND path_group = 'ana-sayfa'");
  assert.ok(satir, 'googlebot ziyareti yazılmadı');
  assert.equal(satir.status, 200);
  // Gizlilik: tabloda IP veya UA sutunu yok; 200 istekte path de bos.
  assert.equal(satir.path, '');
  const kolonlar = (await dbAsync.all('PRAGMA table_info(crawler_visits)')).map(k => k.name);
  assert.ok(!kolonlar.includes('ip') && !kolonlar.includes('user_agent'), 'gizlilik sözleşmesi bozuldu');
});

test('normal tarayıcı ziyareti crawler tablosuna YAZILMAZ', async () => {
  await request(app).get('/about').set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0');
  await bekle();
  const satir = await dbAsync.get("SELECT * FROM crawler_visits WHERE path_group = 'sabit-sayfa' AND status = 200");
  assert.equal(satir, undefined, 'gerçek ziyaretçi bot tablosuna yazıldı');
});

test('botun gördüğü 404, temizlenmiş adresle kaydedilir', async () => {
  const res = await request(app).get('/olmayan-sayfa-xyz?a=<script>').set('User-Agent', GOOGLEBOT_UA);
  assert.equal(res.status, 404);
  await bekle();
  const satir = await dbAsync.get("SELECT * FROM crawler_visits WHERE status = 404 AND bot = 'googlebot'");
  assert.ok(satir, '404 ziyareti yazılmadı');
  assert.ok(satir.path.includes('olmayan-sayfa-xyz'), 'yol kaydedilmedi');
  assert.ok(!satir.path.includes('<') && !satir.path.includes('?'), 'yol temizlenmedi');
});

test('bot adı ve yol grubu doğru eşlenir', () => {
  assert.equal(crawlerTracker.botAdi('Mozilla/5.0 (compatible; bingbot/2.0)'), 'bingbot');
  assert.equal(crawlerTracker.botAdi('GPTBot/1.0'), 'gptbot');
  assert.equal(crawlerTracker.botAdi('TuhafBot/9.9 (crawl)'), 'diger-bot');
  assert.equal(crawlerTracker.botAdi('Mozilla/5.0 Chrome/128.0'), null);
  assert.equal(crawlerTracker.yolGrubu('/blog/ornek-yazi'), 'blog-yazisi');
  assert.equal(crawlerTracker.yolGrubu('/instagram-takipci-satin-al'), 'satis-sayfasi');
  assert.equal(crawlerTracker.yolGrubu('/hizmet-sayfalari'), 'vitrin');
  assert.equal(crawlerTracker.yolGrubu('/sitemap.xml'), 'seo-dosyasi');
});

// ---------------------------------------------------------------- rapor ----

test('SEO raporu: crawler + sitemap + indexnow şeması, sır sızıntısı yok', async () => {
  const agent = await adminAgent();
  const res = await agent.get('/api/admin/health/seo?window=24h');
  assert.equal(res.status, 200);
  const d = res.body;
  assert.ok(Array.isArray(d.crawler.bots), 'bot listesi yok');
  assert.ok(d.crawler.bots.some(b => b.bot === 'googlebot'), 'googlebot raporda görünmüyor');
  // Sitemap: beklenen sayı, kalemlerin toplamıyla birebir tutmalı ve
  // veritabanındaki gerçek yayın sayılarından türemeli.
  const kalem = d.sitemap.breakdown;
  assert.equal(kalem.core, 8);
  assert.equal(d.sitemap.expected_urls, kalem.core + kalem.blog_published + kalem.landing_published + kalem.hub);
  const blogGercek = (await dbAsync.get("SELECT COUNT(*) n FROM blog_posts WHERE status = 'published'")).n;
  assert.equal(kalem.blog_published, blogGercek, 'blog sayısı veritabanıyla tutmuyor');
  assert.ok(Object.prototype.hasOwnProperty.call(d.indexnow, 'ok_7d'), 'indexnow alanı yok');
  const metin = JSON.stringify(d).toLowerCase();
  for (const sir of ['api_key', 'password', 'jwt', 'authorization', 'cookie']) {
    assert.ok(!metin.includes(sir), `yanıtta sır alanı var: ${sir}`);
  }
});

test('sitemap tutarlılığı yayın sayılarını izler; bayat statik dosya uyarı üretir', async () => {
  const agent0 = await adminAgent();
  const once = (await agent0.get('/api/admin/health/seo')).body.sitemap.expected_urls;

  const { normalizePagePayload } = require('../utils/landingPages');
  await dbAsync.run("INSERT INTO categories (name, name_tr, sort_order) VALUES ('SEO Test Kat', 'SEO Test Kat', 9)");
  const kat = await dbAsync.get("SELECT id FROM categories WHERE name = 'SEO Test Kat'");
  const sayfa = normalizePagePayload({
    slug: 'seo-test-sayfasi-faz3', status: 'published', platform_key: 'instagram',
    category_ids: [kat.id], title_tr: 'SEO Test Sayfası', content_tr: '<p>test içeriği burada</p>'
  });
  assert.ok(!sayfa.error, sayfa.error);
  const cols = Object.keys(sayfa.fields);
  await dbAsync.run(`INSERT INTO landing_pages (${cols.join(',')}, published_at) VALUES (${cols.map(() => '?').join(',')}, CURRENT_TIMESTAMP)`, cols.map(c => sayfa.fields[c]));

  const agent = await adminAgent();
  const d = (await agent.get('/api/admin/health/seo')).body;
  // İlk satış sayfası +1 satış ve +1 vitrin getirir; repo'daki statik fosil
  // 8 adresli olduğu için bayatlık uyarısı da tetiklenmeli (dosya mevcutsa).
  assert.equal(d.sitemap.expected_urls, once + 2);
  if (d.sitemap.static_file.exists) {
    assert.ok(d.sitemap.static_file.risk, 'bayat statik sitemap uyarısı üretilmedi');
  }
});

// ------------------------------------------------------ taskin korumasi ----

test('saatlik satır sınırı aşılınca yeni satır açılmaz (taşkın koruması)', async () => {
  crawlerTracker._reset();
  // Sinira kadar farkli 404 yolu uret: 400 satirdan sonrasi reddedilir.
  let kabul = 0;
  for (let i = 0; i < 450; i++) {
    const sahte = { headers: { 'user-agent': GOOGLEBOT_UA }, path: `/probe-${i}` };
    if (crawlerTracker.record(sahte, 404)) kabul++;
  }
  assert.ok(kabul <= 400, `taşkın koruması çalışmıyor: ${kabul} satır kabul edildi`);
  crawlerTracker._reset();
});

// ------------------------------------------------------------- UI bağı ----

test('admin panelinde SEO & Crawler sekmesi ve gövdesi vardır', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  assert.ok(html.includes('data-health-section="seo"'), 'sekme düğmesi yok');
  assert.ok(html.includes('id="health-seo-body"'), 'sekme gövdesi yok');
  const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
  assert.ok(js.includes('loadHealthSeo') && js.includes('renderHealthSeo'), 'app.js yükleyicisi eksik');
});
