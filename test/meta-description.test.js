const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-meta-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.ENABLE_DEMO_PAYMENTS = 'false';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');
const { clampMetaDescription, buildMetaDescription, MIN_LENGTH, MAX_LENGTH } = require('../utils/metaDescription');

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

async function adminAgent() {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ username: 'admin', password: ADMIN_PASSWORD });
  assert.equal(res.status, 200, res.body.error);
  return agent;
}

const metaOf = html => (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] ?? null;

// ---------------------------------------------------------------
// Yardimci fonksiyon
// ---------------------------------------------------------------

test('sınır içindeki metin olduğu gibi kalır', () => {
  const metin = 'Instagram beğeni satın alırken nelere dikkat etmeli? Güvenli yöntemleri ve tuzakları bu rehberde adım adım anlatıyoruz.';
  assert.ok(metin.length <= MAX_LENGTH);
  assert.equal(clampMetaDescription(metin), metin);
});

test('uzun metin 160 karaktere kelime sınırından kesilir', () => {
  const uzun = 'YouTube beğeni ve etkileşim artırmanın 2026 yöntemleri: algoritmanın nasıl çalıştığını, hangi içeriklerin öne çıktığını, izlenme süresinin önemini ve organik büyüme taktiklerini detaylıca inceliyoruz.';
  assert.ok(uzun.length > MAX_LENGTH, 'test metni zaten kısa');
  const sonuc = clampMetaDescription(uzun);
  assert.ok(sonuc.length <= MAX_LENGTH, `hâlâ uzun: ${sonuc.length}`);
  assert.ok(sonuc.endsWith('…'), 'kesildiği belirtilmemiş');
  // Kelime ortasindan kesilmemeli
  assert.ok(!/\S…$/.test(sonuc) || uzun.startsWith(sonuc.slice(0, -1)), 'kelime ortasından kesilmiş');
  assert.ok(uzun.startsWith(sonuc.slice(0, -1).trim()), 'metin bozulmuş');
});

test('çok kısa metin kullanılmaz', () => {
  assert.equal(clampMetaDescription('Kısa'), '');
  assert.equal(clampMetaDescription(''), '');
  assert.equal(clampMetaDescription(null), '');
});

test('HTML etiketleri temizlenir', () => {
  const html = '<p>Bu bir <b>blog</b> yazısıdır ve içinde HTML etiketleri bulunmaktadır ki temizlenmesi gerekir.</p>';
  const sonuc = clampMetaDescription(html);
  assert.ok(!sonuc.includes('<'), 'etiket kalmış');
  assert.ok(sonuc.includes('blog yazısıdır'), 'metin bozulmuş');
});

test('adaylar sırayla denenir, ilk uygun olan seçilir', () => {
  const uygun = 'Bu açıklama tam olarak uygun uzunlukta olduğu için doğrudan seçilmelidir, başka adaya gerek yok.';
  assert.equal(buildMetaDescription(['Kısa', uygun, 'Başka bir şey']), uygun);
});

test('hiçbir aday yetmezse yedek metin kullanılır', () => {
  const yedek = 'TikTok Algoritması — Rehber | SMMJET sosyal medya büyüme paneli';
  assert.equal(buildMetaDescription(['', 'Kısa'], yedek), yedek);
});

test('tek uzun kelime bile sınırı aşmaz', () => {
  const sonuc = clampMetaDescription('a'.repeat(400));
  assert.ok(sonuc.length <= MAX_LENGTH, `sınır aşıldı: ${sonuc.length}`);
});

// ---------------------------------------------------------------
// Gercek sayfalar
// ---------------------------------------------------------------

async function yaziEkle({ slug, summary, seo }) {
  await dbAsync.run(
    `INSERT INTO blog_posts (title, title_tr, slug, category, category_tr, summary, summary_tr,
       seo_description_tr, content, content_tr, status, published_at)
     VALUES (?,?,?,?,?,?,?,?,?,?, 'published', CURRENT_TIMESTAMP)`,
    ['Test Yazısı', 'Test Yazısı', slug, 'Rehber', 'Rehber', summary, summary, seo,
      '<p>Yazının gövde metni yeterince uzun olsun diye buraya birkaç cümle yazıyorum ki içerikten açıklama üretilebilsin.</p>',
      '<p>Yazının gövde metni yeterince uzun olsun diye buraya birkaç cümle yazıyorum ki içerikten açıklama üretilebilsin.</p>']
  );
}

test('veritabanındaki açıklama çok uzunsa sayfaya kısaltılmış hali basılır', async () => {
  const cokUzun = 'YouTube beğeni ve etkileşim artırmanın 2026 yöntemleri: algoritmanın nasıl çalıştığını, hangi içeriklerin öne çıktığını, izlenme süresinin neden kritik olduğunu ve organik büyüme taktiklerini detaylıca inceliyoruz.';
  await yaziEkle({ slug: 'cok-uzun-aciklama', summary: cokUzun, seo: cokUzun });

  const html = (await request(app).get('/blog/cok-uzun-aciklama')).text;
  const meta = metaOf(html);
  assert.ok(meta, 'meta açıklama basılmamış');
  assert.ok(meta.length <= MAX_LENGTH, `sayfada hâlâ ${meta.length} karakter`);
  assert.ok(meta.length >= MIN_LENGTH, `çok kısa: ${meta.length}`);
});

test('açıklama çok kısaysa özet veya içerikten tamamlanır', async () => {
  await yaziEkle({ slug: 'cok-kisa-aciklama', summary: 'Kısa', seo: 'Az' });
  const meta = metaOf((await request(app).get('/blog/cok-kisa-aciklama')).text);
  assert.ok(meta.length >= MIN_LENGTH, `hâlâ çok kısa: "${meta}" (${meta.length})`);
  assert.ok(meta.length <= MAX_LENGTH);
});

test('ana sayfa ve blog listesi de sınır içindedir', async () => {
  for (const url of ['/', '/services', '/blog']) {
    const meta = metaOf((await request(app).get(url)).text);
    assert.ok(meta, `${url} -> meta açıklama yok`);
    assert.ok(meta.length >= MIN_LENGTH && meta.length <= MAX_LENGTH,
      `${url} -> ${meta.length} karakter (sınır dışı)`);
  }
});

test('yapısal veri açıklaması da sınır içindedir', async () => {
  const html = (await request(app).get('/blog/cok-uzun-aciklama')).text;
  const jsonLd = html.match(/"@type":"BlogPosting"[\s\S]*?\}<\/script>/);
  assert.ok(jsonLd, 'BlogPosting yapısal verisi yok');
  const aciklama = jsonLd[0].match(/"description":"((?:[^"\\]|\\.)*)"/);
  if (aciklama) {
    assert.ok(aciklama[1].length <= MAX_LENGTH, `yapısal veri açıklaması uzun: ${aciklama[1].length}`);
  }
});

// ---------------------------------------------------------------
// Kayit sirasinda uygulama (admin + AI)
// ---------------------------------------------------------------

test('admin panelinden uzun açıklama kaydedilirse veritabanına kısaltılmış girer', async () => {
  const agent = await adminAgent();
  const cokUzun = 'Bu açıklama kasıtlı olarak çok uzun yazılmıştır çünkü arama motorlarının 160 karakter sınırını aşıp aşmadığını ve sunucunun bunu kaydederken kısaltıp kısaltmadığını denemek istiyoruz, bu yüzden devam ediyor.';
  const res = await agent.post('/api/admin/blog').send({
    title_tr: 'Sınır Testi', title_en: 'Limit Test',
    category_tr: 'Rehber', category_en: 'Guide',
    summary_tr: 'Özet metni burada yer alıyor ve yeterince uzun.', summary_en: 'Summary text here, long enough.',
    content_tr: '<p>İçerik</p>', content_en: '<p>Content</p>',
    seo_description_tr: cokUzun, seo_description_en: cokUzun,
    status: 'draft', reading_minutes: 4
  });
  assert.equal(res.status, 200, res.body.error);

  const kayit = await dbAsync.get('SELECT seo_description_tr, seo_description_en FROM blog_posts WHERE title_tr = ?', ['Sınır Testi']);
  assert.ok(kayit.seo_description_tr.length <= MAX_LENGTH, `TR alanı ${kayit.seo_description_tr.length} karakter`);
  assert.ok(kayit.seo_description_en.length <= MAX_LENGTH, `EN alanı ${kayit.seo_description_en.length} karakter`);
});

test('AI istemi meta açıklama için doğru sınırı söyler', () => {
  const ai = fs.readFileSync(path.join(__dirname, '..', 'routes', 'ai.js'), 'utf8');
  assert.match(ai, /seo_description_tr ve seo_description_en/, 'istemde meta açıklama kuralı yok');
  assert.match(ai, /120-155 karakter/, 'istemde hedef karakter aralığı yok');
  assert.match(ai, /160 karakteri aşan/, 'istemde üst sınır uyarısı yok');
  // Eski hatali kural kalmamali: ozet 180-320 iken meta olarak kullanilirsa sinir asilir
  assert.ok(ai.includes('buildMetaDescription'), 'AI kaydı sunucu tarafında sınırlandırılmıyor');
});

test('blog editöründe karakter sayacı vardır', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  assert.ok(html.includes('data-meta-counter="blog-seo-count-tr"'), 'TR sayacı yok');
  assert.ok(html.includes('data-meta-counter="blog-seo-count-en"'), 'EN sayacı yok');
  assert.ok(!/id="blog-input-seo-description-tr"[^>]*maxlength="500"/.test(html), 'TR alanı hâlâ 500 karaktere izin veriyor');
  assert.ok(!/id="blog-input-seo-description-en"[^>]*maxlength="500"/.test(html), 'EN alanı hâlâ 500 karaktere izin veriyor');
});
