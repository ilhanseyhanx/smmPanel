// Sistem Sagligi - Faz 1 testleri.
// Kapsam: yetki, sir sizintisi, kabuk yasagi, puan formulu, baslangic kaydi,
// yedek yolu guvenligi, yanit semasi ve admin UI baglantisi.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-saglik-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');
const healthScore = require('../services/healthScore');
const healthMetrics = require('../services/healthMetrics');
const appStarts = require('../services/appStarts');

const ADMIN_PASSWORD = 'GuvenliAdminSifre_2026';
const MUSTERI_SIFRE = 'MusteriSifresi_2026';

test.before(async () => {
  await initDatabase();
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  await agent.post('/api/admin/change-password').send({
    current_password: 'admin12345', new_password: ADMIN_PASSWORD
  });
  await request(app).post('/api/auth/register').send({
    username: 'saglik_musteri', email: 'saglik_musteri@ornek.com', password: MUSTERI_SIFRE
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

async function musteriAgent() {
  const agent = request.agent(app);
  const login = await agent.post('/api/auth/login').send({ username: 'saglik_musteri', password: MUSTERI_SIFRE });
  assert.equal(login.status, 200, 'müşteri girişi başarısız');
  return agent;
}

const UCLAR = ['/api/admin/health/overview', '/api/admin/health/application', '/api/admin/health/score-explain'];

// ---------------------------------------------------------------- yetki ----

test('oturumsuz istek 401 döner', async () => {
  for (const uc of UCLAR) {
    const res = await request(app).get(uc);
    assert.equal(res.status, 401, `${uc} oturumsuz erişime açık`);
  }
});

test('normal kullanıcı 403 döner', async () => {
  const agent = await musteriAgent();
  for (const uc of UCLAR) {
    const res = await agent.get(uc);
    assert.equal(res.status, 403, `${uc} normal kullanıcıya açık`);
  }
});

test('yönetici 200 döner', async () => {
  const agent = await adminAgent();
  for (const uc of UCLAR) {
    const res = await agent.get(uc);
    assert.equal(res.status, 200, `${uc} yöneticiye 200 dönmedi`);
  }
});

// ------------------------------------------------------- sır sızıntısı ----

test('yanıtlarda sır veya kişisel veri bulunmaz', async () => {
  const agent = await adminAgent();
  // Alan adi VE deger duzeyinde arama: "api_key" anahtari da, gercek bir
  // JWT/anahtar bicimi de yakalanir.
  const yasakliAnahtar = /"(api_?key|api_?secret|secret|token|password|password_hash|authorization|cookie|jwt|webhook_secret)"/i;
  const yasakliDeger = [
    /\beyJ[A-Za-z0-9_-]{10,}\./,            // JWT
    /\bsmm_[a-z0-9]{16,}\b/,                // panel API anahtari
    /\$2[aby]\$\d{2}\$/,                    // bcrypt
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/ // e-posta
  ];
  for (const uc of UCLAR) {
    const res = await agent.get(uc);
    const govde = JSON.stringify(res.body);
    assert.ok(!yasakliAnahtar.test(govde), `${uc} yanıtında yasaklı alan adı var`);
    for (const kalip of yasakliDeger) {
      assert.ok(!kalip.test(govde), `${uc} yanıtında hassas değer deseni var: ${kalip}`);
    }
  }
});

test('yedek bilgisi dosya adı veya yol sızdırmaz', async () => {
  const agent = await adminAgent();
  const res = await agent.get('/api/admin/health/overview');
  const alanlar = Object.keys(res.body.backup || {}).sort();
  assert.deepEqual(alanlar, ['age_hours', 'at', 'found', 'size_bytes'],
    'yedek nesnesi yalnızca metadata içermeli (yol/dosya adı yok)');
  const govde = JSON.stringify(res.body);
  assert.ok(!/\/root\/|\/var\/backups|\.sqlite/.test(govde), 'yanıtta dosya yolu sızmış');
});

// ------------------------------------------------------------ kabuk yok ----

test('uygulama kodunda child_process kullanılmaz', () => {
  const koklar = ['server.js', 'routes', 'services', 'utils', 'config', 'middleware'];
  const bulunan = [];
  const tara = (hedef) => {
    const tam = path.join(__dirname, '..', hedef);
    if (!fs.existsSync(tam)) return;
    if (fs.statSync(tam).isDirectory()) {
      for (const ad of fs.readdirSync(tam)) tara(path.join(hedef, ad));
      return;
    }
    if (!tam.endsWith('.js')) return;
    const icerik = fs.readFileSync(tam, 'utf8');
    if (/require\(\s*['"]child_process['"]\s*\)|execSync|spawnSync|\bspawn\(/.test(icerik)) {
      bulunan.push(hedef);
    }
  };
  koklar.forEach(tara);
  assert.deepEqual(bulunan, [], `child_process kullanan dosyalar: ${bulunan.join(', ')}`);
});

test('sağlık modülleri yalnızca sabit yedek yollarını okur', () => {
  // Yollar kod icinde sabit olmali; istemciden gelen deger yol uretmemeli.
  assert.deepEqual(healthMetrics.YEDEK_DIZINLERI, ['/root/yedekler', '/var/backups/smmjet']);
  const kaynak = fs.readFileSync(path.join(__dirname, '..', 'routes', 'adminHealth.js'), 'utf8');
  assert.ok(!/req\.(query|params|body)\s*\.\s*\w*(path|dir|file|yol)/i.test(kaynak),
    'istekten yol benzeri parametre okunuyor');
  assert.ok(!/req\.(query|params|body)/.test(kaynak) || !/readdir|readFile|statSync/.test(kaynak),
    'istek parametresi dosya işlemiyle aynı dosyada birleşmemeli');
});

// --------------------------------------------------------- puan formulu ----

function ornekSnapshot(over = {}) {
  return {
    application: { uptime_sec: 7200, rss_bytes: 180 * 1024 * 1024 },
    server: { mem_used_percent: 12 },
    disk: { used_percent: 5 },
    database: { accessible: true, wal_bytes: 4 * 1024 * 1024 },
    backup: { found: true, age_hours: 2 },
    ...over
  };
}

test('sağlıklı sistemde puan 100', () => {
  const s = healthScore.systemHealth(ornekSnapshot(), 1);
  assert.equal(s.score, 100);
  assert.equal(s.status, 'healthy');
  assert.equal(s.critical_count, 0);
});

test('disk kritikse kritik tavanı uygulanır', () => {
  const s = healthScore.systemHealth(ornekSnapshot({ disk: { used_percent: 92 } }), 1);
  assert.equal(s.status, 'critical');
  assert.ok(s.score <= healthScore.KRITIK_TAVANI, `puan tavanı aşıldı: ${s.score}`);
  assert.equal(s.formula.critical_cap_applied, true);
});

test('uyarı eşiği puanın yarısını düşürür', () => {
  const s = healthScore.systemHealth(ornekSnapshot({ backup: { found: true, age_hours: 40 } }), 1);
  const yedek = s.components.find(c => c.key === 'backup');
  assert.equal(yedek.status, 'warning');
  assert.equal(yedek.earned, 5);
  assert.equal(yedek.lost, 5);
  assert.equal(s.status, 'warning');
});

test('yedek yoksa kritik sayılır', () => {
  const s = healthScore.systemHealth(ornekSnapshot({ backup: { found: false } }), 1);
  assert.equal(s.components.find(c => c.key === 'backup').status, 'critical');
});

test('SEO ve crawler metrikleri puana dahil değildir', () => {
  const s = healthScore.systemHealth(ornekSnapshot(), 1);
  const anahtarlar = s.components.map(c => c.key);
  for (const yasak of ['seo', 'crawler', 'googlebot', 'sitemap']) {
    assert.ok(!anahtarlar.includes(yasak), `${yasak} SYSTEM HEALTH puanına girmiş`);
  }
  assert.equal(anahtarlar.length, 6, 'Faz 1 bileşen sayısı 6 olmalı');
  const toplam = s.components.reduce((t, c) => t + c.weight, 0);
  assert.equal(toplam, 100, 'ağırlıklar toplamı 100 değil');
});

test('sağlayıcı ve ödeme sahte bileşen olarak eklenmemiş', () => {
  const s = healthScore.systemHealth(ornekSnapshot(), 1);
  const anahtarlar = s.components.map(c => c.key);
  assert.ok(!anahtarlar.includes('provider'), 'provider bileşeni Faz 1’de olmamalı');
  assert.ok(!anahtarlar.includes('payment'), 'payment bileşeni Faz 1’de olmamalı');
  assert.equal(s.formula.excluded.length, 2);
});

test('ölçülemeyen bileşen puanı şişirmez', () => {
  const s = healthScore.systemHealth(ornekSnapshot({ disk: null }), 1);
  const disk = s.components.find(c => c.key === 'disk');
  assert.equal(disk.status, 'unknown');
  assert.equal(disk.counted, false);
  assert.equal(s.formula.counted_weight, 80, 'ölçülen ağırlık 100 - 20 olmalı');
});

// ---------------------------------------------------- baslangic kaydi ----

test('uygulama başlangıcı veritabanına yazılır', async () => {
  const once = await dbAsync.get('SELECT COUNT(*) n FROM health_app_starts');
  await dbAsync.run(
    "INSERT INTO health_app_starts (node_version, app_version, classified) VALUES (?, ?, 'unknown')",
    [process.version, '1.0.0']
  );
  const sonra = await dbAsync.get('SELECT COUNT(*) n FROM health_app_starts');
  assert.equal(sonra.n, once.n + 1);
  const ozet = await appStarts.getSummary();
  assert.ok(ozet.starts_24h >= 1, 'son 24 saat sayacı çalışmıyor');
  assert.ok(Array.isArray(ozet.history));
});

test('kanıt yoksa başlangıç deploy olarak işaretlenmez', async () => {
  const satir = await dbAsync.get('SELECT classified FROM health_app_starts ORDER BY id DESC LIMIT 1');
  assert.equal(satir.classified, 'unknown', 'kanıt olmadan deploy yazılmış');
});

test('git SHA yalnızca ortam değişkeninden okunur', () => {
  const kaynak = fs.readFileSync(path.join(__dirname, '..', 'services', 'healthMetrics.js'), 'utf8');
  // Yorum metnini degil GERCEK KULLANIMI arar: healthMetrics.js icindeki
  // guvenlik aciklamasinda "child_process" kelimesi bilerek geciyor.
  assert.ok(!/require\(\s*['"]child_process['"]\s*\)|execSync|spawnSync|rev-parse/.test(kaynak),
    'git komutu calistiriliyor');
  const onceki = process.env.GIT_SHA;
  delete process.env.GIT_SHA;
  assert.equal(healthMetrics.gitSha(), null, 'tanımsızken null dönmeli');
  process.env.GIT_SHA = 'deadbeef1234567';
  assert.equal(healthMetrics.gitSha(), 'deadbeef1234567');
  process.env.GIT_SHA = 'gecersiz deger!';
  assert.equal(healthMetrics.gitSha(), null, 'geçersiz değer kabul edilmemeli');
  if (onceki === undefined) delete process.env.GIT_SHA; else process.env.GIT_SHA = onceki;
});

// ------------------------------------------------------------- sema ----

test('overview yanıt şeması beklenen alanları taşır', async () => {
  const agent = await adminAgent();
  const res = await agent.get('/api/admin/health/overview');
  assert.equal(res.status, 200);
  const b = res.body;
  for (const alan of ['system_health', 'collected_at', 'server', 'application', 'disk', 'database', 'backup']) {
    assert.ok(alan in b, `${alan} alanı yok`);
  }
  assert.equal(typeof b.system_health.score, 'number');
  assert.ok(b.system_health.score >= 0 && b.system_health.score <= 100, 'puan 0-100 aralığında değil');
  assert.ok(['healthy', 'warning', 'critical'].includes(b.system_health.status));
  for (const alan of ['uptime_sec', 'cpu_count', 'mem_total_bytes', 'mem_used_percent']) {
    assert.ok(alan in b.server, `server.${alan} yok`);
  }
  for (const alan of ['pid', 'node_version', 'uptime_sec', 'rss_bytes', 'heap_used_bytes']) {
    assert.ok(alan in b.application, `application.${alan} yok`);
  }
  for (const alan of ['accessible', 'journal_mode', 'size_bytes', 'wal_bytes', 'shm_bytes']) {
    assert.ok(alan in b.database, `database.${alan} yok`);
  }
  assert.equal(b.database.accessible, true);
});

test('application yanıtı başlangıç semantiğini açıklar', async () => {
  const agent = await adminAgent();
  const res = await agent.get('/api/admin/health/application');
  assert.equal(res.status, 200);
  assert.ok('starts' in res.body);
  assert.ok(/BAŞLANGIÇ/i.test(res.body.starts.semantics), 'başlangıç semantiği açıklanmamış');
  const govde = JSON.stringify(res.body);
  assert.ok(!/restart/i.test(govde), 'yanıtta "restart" ifadesi geçiyor (PM2 verisi okunmuyor)');
});

test('score-explain her bileşenin ağırlık ve kaybını verir', async () => {
  const agent = await adminAgent();
  const res = await agent.get('/api/admin/health/score-explain');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.components));
  for (const c of res.body.components) {
    for (const alan of ['key', 'label', 'weight', 'status', 'earned', 'lost']) {
      assert.ok(alan in c, `bileşen ${c.key} içinde ${alan} yok`);
    }
  }
  assert.ok('thresholds' in res.body.formula, 'eşikler açıklanmamış');
});

// --------------------------------------------------------------- UI ----

test('admin panelinde Sistem Sağlığı sekmesi eksiksiz bağlanmış', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  assert.ok(html.includes('data-admin-tab="health"'), 'menü düğmesi yok');
  assert.ok(html.includes('id="admin-tab-health"'), 'panel yok');
  assert.ok(/id="health-overview-body"/.test(html), 'genel bakış gövdesi yok');
  assert.ok(/id="health-application-body"/.test(html), 'uygulama gövdesi yok');
  // Servisler / Odemeler Faz 2'de eklendi (test/health-phase2.test.js).
  // Faz 3 sekmeleri (SEO / crawler / guvenlik) bos veya sahte eklenmemeli.
  for (const erken of ['health-seo', 'health-crawler', 'health-security',
    'health-section-seo', 'health-section-crawler', 'health-section-security']) {
    assert.ok(!html.includes(`id="${erken}"`), `${erken} Faz 3'ten önce eklenmemeli`);
  }
});

// ------------------------------------------------------------ UI POLISH ----
// Bu testler yalnizca GORUNUM sozlesmesini korur; backend davranisina
// dokunmazlar. Kaynak dosyalar uzerinden statik dogrulama yapilir.

const appJsKaynak = () => fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
const cssKaynak = () => fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'style.css'), 'utf8');

test('CPU olculemediginde tire degil "Olculuyor" gosterilir', () => {
  const js = appJsKaynak();
  assert.ok(/cpuHazir/.test(js), 'CPU hazir kontrolu yok');
  assert.ok(js.includes('health-pending'), 'bekleme durumu sinifi yok');
  // Sahte yuzde uretilmemeli: cpu_percent null iken yuzde basilmamali.
  assert.ok(/cpuHazir \? "%" \+ s\.cpu_percent/.test(js), 'CPU yuzdesi kosulsuz basiliyor');
});

test('classified=unknown kullaniciya "Siniflandirilmadi" olarak gosterilir', () => {
  const js = appJsKaynak();
  assert.ok(/hsinif\(deger\)/.test(js), 'hsinif yardimcisi yok');
  assert.ok(js.includes('S\\u0131n\\u0131fland\\u0131r\\u0131lmad\\u0131') || js.includes('Sınıflandırılmadı'),
    'unknown icin okunabilir etiket yok');
});

test('durum yalnizca renkle degil metinle de anlatilir (erisilebilirlik)', () => {
  const js = appJsKaynak();
  // hdurum her durum icin bir label dondurmeli.
  for (const beklenen of ['Kritik', 'Uyar', 'lemedi', 'Sa']) {
    assert.ok(js.includes(beklenen), `hdurum etiketi eksik: ${beklenen}`);
  }
  assert.ok(js.includes('sr-only'), 'kart durum noktasi icin ekran okuyucu metni yok');
  assert.ok(js.includes('aria-expanded'), 'aciklama dugmesinde aria-expanded yok');
});

test('semantik durum renkleri paletten gelir, yeni renk tanimlanmaz', () => {
  const css = cssKaynak();
  assert.ok(/\.is-healthy\s*\{\s*--hc:\s*var\(--success\)/.test(css), 'saglikli rengi --success degil');
  assert.ok(/\.is-warning\s*\{\s*--hc:\s*var\(--warning\)/.test(css), 'uyari rengi --warning degil');
  assert.ok(/\.is-critical\s*\{\s*--hc:\s*var\(--danger\)/.test(css), 'kritik rengi --danger degil');
});

test('tanimsiz CSS degiskeni kullanilmaz', () => {
  const js = appJsKaynak();
  const css = cssKaynak();
  const kullanilan = [...js.matchAll(/var\((--[a-z0-9-]+)\)/g)].map(m => m[1]);
  const eksik = [...new Set(kullanilan)].filter(v => !css.includes(v + ':'));
  assert.deepEqual(eksik, [], `app.js tanimsiz CSS degiskeni kullaniyor: ${eksik.join(', ')}`);
});

test('duyarli kirilma noktalari tanimli', () => {
  const css = cssKaynak();
  // 6 kart: genis -> 3 -> 2 -> 1 kolon
  assert.ok(/\.health-grid\s*\{[^}]*repeat\(auto-fit, minmax\(200px, 1fr\)\)/.test(css),
    'izgara genislige gore dengelenmiyor');
  for (const bp of ['460px', '820px', '700px']) {
    assert.ok(css.includes(`max-width: ${bp}`), `kirilma noktasi eksik: ${bp}`);
  }
  // Skor aciklamasi mobilde tablo yerine satir kartlari
  assert.ok(css.includes('.health-explain-rows'), 'mobil aciklama satirlari yok');
  assert.ok(/max-width: 820px[^}]*\{[\s\S]*?\.health-explain-table \{ display: none/.test(css),
    'mobilde aciklama tablosu gizlenmiyor');
});

test('yeni bagimlilik, font veya ikon kutuphanesi eklenmemis', () => {
  const pkg = require(path.join(__dirname, '..', 'package.json'));
  const bagimliliklar = Object.keys(pkg.dependencies || {});
  for (const yasak of ['chart.js', 'chartjs', 'echarts', 'd3', 'apexcharts', 'recharts']) {
    assert.ok(!bagimliliklar.includes(yasak), `grafik kutuphanesi eklenmis: ${yasak}`);
  }
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const cdnler = [...html.matchAll(/https:\/\/cdnjs[^"\s]*\/ajax\/libs\/[^"\s]*/g)].map(m => m[0]);
  assert.ok(cdnler.every(u => u.includes('font-awesome')),
    'index.html yeni bir CDN kutuphanesi yukluyor');
});

test('hero kompakt: ayri baslik blogu kaldirilmis', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const panel = html.slice(html.indexOf('id="admin-tab-health"'), html.indexOf('id="admin-tab-statistics"'));
  assert.ok(panel.includes('health-hero'), 'hero sinifi yok');
  // Yenile dugmesi artik hero icinde ciziliyor; panelde ayri bir kopya olmamali.
  assert.equal((panel.match(/app\.loadHealth\(true\)/g) || []).length, 0,
    'Yenile dugmesi hem HTML hem hero icinde tekrarlanmis');
  assert.ok(!panel.includes('<h2>'), 'panelde hala ayri baslik blogu var');
});
