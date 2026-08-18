// 16.08.2026 tarihli seoanalizi.com denetiminde bulunan sorunlarin geri
// donmemesi icin yazildi. Her test bir denetim bulgusuna karsilik gelir.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-seo-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.PUBLIC_BASE_URL = 'https://jetsmmpanel.com';

const { app } = require('../server');
const { initDatabase, db } = require('../config/database');
const { SAYFALAR, NOT_FOUND, pageForPath } = require('../utils/pageMeta');
const { stripGatedMarkup } = require('../utils/gatedMarkup');

test.before(async () => { await initDatabase(); });
test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

const sayfa = async url => (await request(app).get(url));
const oznitelik = (html, re) => { const m = re.exec(html); return m ? m[1] : null; };
const dugumSayisi = html => (html.match(/<[a-zA-Z][a-zA-Z0-9-]*(\s|>|\/)/g) || []).length;

// ---------------------------------------------------------------
// Teknik SEO — [HATA] Özel 404 sayfası (soft 404)
// ---------------------------------------------------------------

test('var olmayan adres 404 döner, 200 değil', async () => {
  for (const url of ['/boyle-bir-sayfa-yok', '/services/olmayan', '/rastgele-1234']) {
    const res = await sayfa(url);
    assert.equal(res.status, 404, `${url} adresi ${res.status} döndü (soft 404)`);
  }
});

test('404 sayfası kullanıcıyı boş ekranda bırakmaz', async () => {
  const res = await sayfa('/boyle-bir-sayfa-yok');
  assert.match(res.text, /id="view-not-found"/, '404 görünümü sayfada yok');
  assert.match(res.text, /<h1[^>]*>[\s\S]*?Aradığın sayfa[\s\S]*?<\/h1>/, '404 başlığı görünmüyor');
  assert.match(res.text, /<meta name="robots" content="noindex/, '404 sayfası indekslenmemeli');
  // Ana bolumlere yonlendiren baglantilar bulunmali
  for (const hedef of ['/services', '/blog', '/tickets']) {
    assert.ok(res.text.includes(`href="${hedef}"`), `404 sayfasında ${hedef} bağlantısı yok`);
  }
});

test('bilinen adresler 404 dönmez', async () => {
  for (const url of ['/', '/services', '/blog', '/register', '/tickets', '/api-docs', '/terms', '/privacy', '/refund']) {
    assert.equal((await sayfa(url)).status, 200, `${url} yanlışlıkla 404 döndü`);
  }
});

// ---------------------------------------------------------------
// Site geneli — [HATA] Anasayfaya canonical + Benzer yinelenen içerik
// ---------------------------------------------------------------

test('her sayfa kendi canonical adresini bildirir', async () => {
  const beklenen = {
    '/': 'https://jetsmmpanel.com/',
    '/services': 'https://jetsmmpanel.com/services',
    '/blog': 'https://jetsmmpanel.com/blog',
    '/register': 'https://jetsmmpanel.com/register',
    '/api-docs': 'https://jetsmmpanel.com/api-docs',
    '/terms': 'https://jetsmmpanel.com/terms'
  };
  for (const [url, canonical] of Object.entries(beklenen)) {
    const html = (await sayfa(url)).text;
    assert.equal(oznitelik(html, /<link rel="canonical" href="([^"]+)">/), canonical,
      `${url} sayfasının canonical adresi yanlış`);
    assert.equal(oznitelik(html, /<meta property="og:url" content="([^"]+)">/), canonical,
      `${url} sayfasının og:url adresi yanlış`);
  }
});

test('her sayfanın kendi başlığı vardır (yinelenen içerik uyarısı)', async () => {
  const basliklar = new Set();
  for (const url of ['/', '/services', '/blog', '/register', '/api-docs', '/terms', '/privacy', '/refund']) {
    const html = (await sayfa(url)).text;
    const baslik = oznitelik(html, /<title>([\s\S]*?)<\/title>/);
    assert.ok(baslik, `${url} sayfasının başlığı yok`);
    assert.ok(!basliklar.has(baslik), `"${baslik}" başlığı birden çok sayfada kullanılıyor`);
    basliklar.add(baslik);
  }
});

test('panel içi sayfalar indekslenmez (ince/yinelenen içerik)', async () => {
  for (const url of ['/orders', '/profile', '/add-funds', '/new-order', '/admin']) {
    const html = (await sayfa(url)).text;
    assert.match(html, /<meta name="robots" content="noindex/, `${url} indekslenmeye açık`);
  }
});

test('herkese açık sayfalar indekslenmeye açıktır', async () => {
  for (const url of ['/', '/services', '/blog', '/register', '/terms']) {
    const html = (await sayfa(url)).text;
    assert.ok(!/<meta name="robots" content="noindex/.test(html), `${url} yanlışlıkla noindex`);
  }
});

// ---------------------------------------------------------------
// Temel SEO — [UYARI] Meta açıklama uzunluğu (120-160)
// ---------------------------------------------------------------

test('tanımlı her meta açıklama 120-160 karakter arasındadır', () => {
  const kayitlar = [...Object.entries(SAYFALAR), ['404', NOT_FOUND]];
  for (const [ad, kayit] of kayitlar) {
    if (!kayit.description) continue;
    const n = kayit.description.length;
    assert.ok(n >= 120 && n <= 160, `/${ad} açıklaması ${n} karakter (120-160 olmalı)`);
  }
});

test('sayfalara basılan açıklama gerçekten yerine geçer', async () => {
  const html = (await sayfa('/services')).text;
  const desc = oznitelik(html, /<meta name="description" content="([^"]+)">/);
  assert.ok(desc.length >= 120 && desc.length <= 160, `açıklama ${desc.length} karakter`);
  assert.match(desc, /fiyat listesi/i, 'hizmetler sayfasına ana sayfanın açıklaması basılmış');
  // og ve twitter aciklamalari da ayni olmali
  assert.equal(oznitelik(html, /<meta property="og:description" content="([^"]+)">/), desc);
  assert.equal(oznitelik(html, /<meta name="twitter:description" content="([^"]+)">/), desc);
});

// ---------------------------------------------------------------
// Performans — [HATA] DOM boyutu, sayfa ağırlığı, metin/HTML oranı
// ---------------------------------------------------------------

test('oturumsuz ziyaretçiye gönderilen DOM 800 düğümün altındadır', async () => {
  const html = (await sayfa('/')).text;
  const n = dugumSayisi(html);
  assert.ok(n < 800, `DOM ${n} düğüm (önerilen < 800)`);
});

test('HTML dokümanı 100 KB altındadır', async () => {
  const html = (await sayfa('/')).text;
  assert.ok(Buffer.byteLength(html) < 100 * 1024,
    `HTML ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB (önerilen < 100 KB)`);
});

test('yönetim paneli işaretlemesi oturumsuz ziyaretçiye gönderilmez', async () => {
  const html = (await sayfa('/')).text;
  assert.ok(!html.includes('admin-tab-dashboard'), 'admin paneli herkese gönderiliyor');
  assert.ok(!html.includes('id="modal-add-provider"'), 'admin modalleri herkese gönderiliyor');
  assert.ok(!html.includes('id="view-orders"'), 'panel içi görünümler herkese gönderiliyor');
});

test('oturum açan kullanıcı panel işaretlemesini alır', () => {
  const kaynak = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const yonetici = stripGatedMarkup(kaynak, { admin: true, authenticated: true });
  const musteri = stripGatedMarkup(kaynak, { admin: false, authenticated: true });
  const ziyaretci = stripGatedMarkup(kaynak, { admin: false, authenticated: false });

  assert.ok(yonetici.includes('admin-tab-dashboard'), 'yönetici admin panelini alamıyor');
  assert.ok(musteri.includes('id="view-orders"'), 'müşteri sipariş görünümünü alamıyor');
  assert.ok(!musteri.includes('admin-tab-dashboard'), 'müşteriye admin paneli gidiyor');
  assert.ok(!ziyaretci.includes('id="view-add-funds"'), 'ziyaretçiye bakiye ekranı gidiyor');
  // Admin gorunumu icin bos kabuk kalmali (app.js tazeleme kararini buna gore verir)
  assert.match(ziyaretci, /<section id="view-admin"[^>]*data-gated="admin"/, 'admin yer tutucusu yok');
});

test('işaretler bozuksa HTML olduğu gibi kalır (veri kaybı olmaz)', () => {
  const bozuk = '<div>bir</div><!--ADMIN-ONLY-START--><div>iki</div>'; // kapanış yok
  assert.equal(stripGatedMarkup(bozuk, {}), bozuk);
  assert.equal(stripGatedMarkup('<p>işaretsiz</p>', {}), '<p>işaretsiz</p>');
});

// ---------------------------------------------------------------
// Erişilebilirlik — [HATA] ARIA etiketleri + form etiketleri
// ---------------------------------------------------------------

test('her form alanının erişilebilir adı vardır', async () => {
  const html = (await sayfa('/')).text;
  const { Parser } = require('htmlparser2');
  const KONTROL = new Set(['input', 'select', 'textarea']);
  const labelFor = new Set([...html.matchAll(/<label[^>]*\sfor="([^"]+)"/g)].map(m => m[1]));
  const eksik = [];
  let labelDerinlik = 0;
  const p = new Parser({
    onopentag(ad, oz) {
      if (ad === 'label') labelDerinlik++;
      if (!KONTROL.has(ad) || oz.type === 'hidden') return;
      const adiVar = oz['aria-label'] || oz['aria-labelledby'] || oz.title ||
        (oz.id && labelFor.has(oz.id)) || labelDerinlik > 0;
      if (!adiVar) eksik.push(`${ad}#${oz.id || '?'}`);
    },
    onclosetag(ad) { if (ad === 'label') labelDerinlik--; }
  }, { lowerCaseTags: true, recognizeSelfClosing: true });
  p.write(html); p.end();
  assert.deepEqual(eksik, [], `etiketsiz form alanları: ${eksik.join(', ')}`);
});

test('ikondan ibaret düğme ve bağlantıların erişilebilir adı vardır', async () => {
  const html = (await sayfa('/')).text;
  const { Parser } = require('htmlparser2');
  const eksik = [];
  let acik = null;
  const p = new Parser({
    onopentag(ad, oz) { if (ad === 'button' || ad === 'a') acik = { ad, oz, metin: '' }; },
    ontext(t) { if (acik) acik.metin += t; },
    onclosetag(ad) {
      if ((ad === 'button' || ad === 'a') && acik) {
        const adiVar = acik.metin.trim() || acik.oz['aria-label'] || acik.oz['aria-labelledby'] || acik.oz.title;
        if (!adiVar) eksik.push(`<${acik.ad} class="${acik.oz.class || ''}">`);
        acik = null;
      }
    }
  }, { lowerCaseTags: true, recognizeSelfClosing: true });
  p.write(html); p.end();
  assert.deepEqual(eksik, [], `adsız etkileşimli öğeler: ${eksik.join(', ')}`);
});

test('atlama bağlantısı ve işaret bölgeleri vardır', async () => {
  const html = (await sayfa('/')).text;
  assert.match(html, /class="skip-link" href="#app-viewport"/, 'atlama bağlantısı yok');
  assert.match(html, /<header class="site-header">/, 'banner işaret bölgesi (header) yok');
  assert.match(html, /<main id="app-viewport">/, 'main işaret bölgesi yok');
  assert.match(html, /<footer class="neo-footer">/, 'contentinfo (footer) yok');
  assert.match(html, /<nav class="navbar" aria-label="[^"]+">/, 'gezinme bölgesinin adı yok');
});

test('tablo başlıkları scope bildirir', async () => {
  const html = (await sayfa('/')).text;
  // (?=[\s>]) sart: aksi halde kalip <thead> etiketini de yakalar.
  const scopesuz = (html.match(/<th(?=[\s>])(?![^>]*\bscope=)/g) || []).length;
  assert.equal(scopesuz, 0, `${scopesuz} adet <th> scope bildirmiyor`);
});

// ---------------------------------------------------------------
// Güvenlik — [UYARI] noopener + Permissions-Policy
// ---------------------------------------------------------------

test('dış bağlantılar noopener/noreferrer taşır', async () => {
  const html = (await sayfa('/')).text;
  const disBaglantilar = [...html.matchAll(/<a\s[^>]*target="_blank"[^>]*>/g)].map(m => m[0]);
  assert.ok(disBaglantilar.length > 0, 'test edilecek dış bağlantı bulunamadı');
  for (const etiket of disBaglantilar) {
    assert.match(etiket, /rel="[^"]*noopener[^"]*"/, `noopener eksik: ${etiket.slice(0, 90)}`);
    assert.match(etiket, /rel="[^"]*noreferrer[^"]*"/, `noreferrer eksik: ${etiket.slice(0, 90)}`);
  }
});

test('Permissions-Policy başlığı gönderilir', async () => {
  const res = await sayfa('/');
  const baslik = res.headers['permissions-policy'];
  assert.ok(baslik, 'Permissions-Policy başlığı yok');
  for (const ozellik of ['camera=()', 'microphone=()', 'geolocation=()', 'payment=()']) {
    assert.ok(baslik.includes(ozellik), `${ozellik} kısıtlaması eksik`);
  }
});

// ---------------------------------------------------------------
// Sosyal medya — [UYARI] og:image boyutları, paylaşım, profiller
// ---------------------------------------------------------------

test('og:image boyutlarıyla birlikte bildirilir ve dosya gerçekten vardır', async () => {
  const html = (await sayfa('/')).text;
  assert.match(html, /<meta property="og:image" content="https:\/\/jetsmmpanel\.com\/og-image\.png">/);
  assert.match(html, /<meta property="og:image:width" content="1200">/);
  assert.match(html, /<meta property="og:image:height" content="630">/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  const res = await sayfa('/og-image.png');
  assert.equal(res.status, 200, 'og-image.png sunucuda yok');
});

test('alt bilgide sosyal profil bağlantısı vardır', async () => {
  const html = (await sayfa('/')).text;
  assert.match(html, /id="footer-social-links"/, 'sosyal profil listesi yok');
  assert.match(html, /rel="me noopener noreferrer"/, 'profil bağlantısı rel="me" taşımıyor');
});

// ---------------------------------------------------------------
// Yasal uyum — [UYARI] Çerez onayı
// ---------------------------------------------------------------

test('çerez onay bandı sayfada bulunur', async () => {
  const html = (await sayfa('/')).text;
  assert.match(html, /id="cookie-consent"/, 'çerez onay bandı yok');
  assert.match(html, /app\.setCookieConsent\('rejected'\)/, 'reddetme seçeneği yok');
  assert.match(html, /app\.setCookieConsent\('accepted'\)/, 'kabul seçeneği yok');
});

// ---------------------------------------------------------------
// AI/GEO — [UYARI] llms.txt referansı
// ---------------------------------------------------------------

test('llms.txt hem sunulur hem de referans verilir', async () => {
  const html = (await sayfa('/')).text;
  assert.match(html, /<link rel="alternate" type="text\/plain" href="\/llms\.txt"/, 'head içinde llms.txt referansı yok');
  const dosya = await sayfa('/llms.txt');
  assert.equal(dosya.status, 200);
  const robots = await sayfa('/robots.txt');
  assert.match(robots.text, /llms\.txt/, 'robots.txt llms.txt adresini duyurmuyor');
});

// ---------------------------------------------------------------
// İçerik — [UYARI] bağlantı yoğunluğu ve başlık hiyerarşisi
// ---------------------------------------------------------------

test('bağlantı yoğunluğu 100 kelimede en az 0.5 bağlantıdır', async () => {
  const html = (await sayfa('/')).text;
  const metin = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const kelime = metin.split(' ').length;
  const baglanti = (html.match(/<a\s[^>]*href=/g) || []).length;
  const yogunluk = baglanti / kelime * 100;
  assert.ok(yogunluk >= 0.5, `bağlantı yoğunluğu ${yogunluk.toFixed(2)} (en az 0.5 olmalı)`);
});

test('başlık hiyerarşisinde seviye atlanmaz', async () => {
  for (const url of ['/', '/services', '/blog', '/terms']) {
    const html = (await sayfa(url)).text;
    const seviyeler = [...html.matchAll(/<(h[1-6])[^>]*>/gi)].map(m => Number(m[1][1]));
    let onceki = 0;
    for (const seviye of seviyeler) {
      assert.ok(!(onceki && seviye > onceki + 1), `${url}: h${onceki} sonrası h${seviye} geliyor`);
      onceki = seviye;
    }
    assert.equal(seviyeler.filter(s => s === 1).length, 1, `${url} sayfasında tek h1 olmalı`);
  }
});

test('görünen başlıklar 10 karakterden kısa değildir', async () => {
  const html = (await sayfa('/')).text;
  const kisa = [...html.matchAll(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map(m => m[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim())
    .filter(t => t.length > 0 && t.length < 10);
  assert.deepEqual(kisa, [], `çok kısa başlıklar: ${kisa.join(', ')}`);
});

// ---------------------------------------------------------------
// Yapısal veri — [UYARI] önerilen alanlar
// ---------------------------------------------------------------

test('Organization şeması önerilen alanları içerir', async () => {
  const html = (await sayfa('/')).text;
  const bloklar = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map(m => JSON.parse(m[1]));
  const org = bloklar.find(b => b['@type'] === 'Organization');
  assert.ok(org, 'Organization şeması yok');
  for (const alan of ['name', 'url', 'logo', 'description', 'sameAs', 'contactPoint']) {
    assert.ok(org[alan], `Organization şemasında ${alan} eksik`);
  }
  assert.ok(Array.isArray(org.sameAs) && org.sameAs.length > 0, 'sameAs boş');

  const site = bloklar.find(b => b['@type'] === 'WebSite');
  assert.ok(site, 'WebSite şeması yok');
  assert.ok(site.potentialAction, 'WebSite şemasında SearchAction eksik');
  assert.ok(site.publisher, 'WebSite şemasında publisher eksik');
});

// ---------------------------------------------------------------
// Adres -> sayfa eşlemesi
// ---------------------------------------------------------------

test('adres eşlemesi sondaki eğik çizgi ve sorgudan etkilenmez', () => {
  assert.equal(pageForPath('/services/').view, 'view-services');
  assert.equal(pageForPath('/services?q=x').view, 'view-services');
  assert.equal(pageForPath('/').view, 'view-landing');
  assert.equal(pageForPath('/landing').view, 'view-landing');
  assert.equal(pageForPath('/blog/bir-yazi').view, 'view-blog-detail');
  assert.equal(pageForPath('/blog/bir-yazi').status, 200);
  assert.equal(pageForPath('/olmayan').status, 404);
});

// ---------------------------------------------------------------
// E-E-A-T — Hakkında sayfası, editoryal politika, kaynak atıfları
// ---------------------------------------------------------------

test('hakkımızda sayfası yayında ve alt bilgiden bağlantılı', async () => {
  const res = await sayfa('/about');
  assert.equal(res.status, 200);
  assert.match(res.text, /<h1[^>]*>[\s\S]*?Hakkımızda[\s\S]*?<\/h1>/, 'hakkımızda başlığı yok');
  assert.ok(!/<meta name="robots" content="noindex/.test(res.text), 'hakkımızda sayfası noindex');

  const anasayfa = (await sayfa('/')).text;
  assert.ok(anasayfa.includes('href="/about"'), 'alt bilgide hakkımızda bağlantısı yok');
});

test('editoryal politika hakkımızda sayfasında yer alır', async () => {
  const html = (await sayfa('/about')).text;
  assert.match(html, /Editoryal Politikamız/, 'editoryal politika bölümü yok');
  assert.match(html, /Editorial Policy/, 'editoryal politikanın İngilizcesi yok');
});

test('tanınmış kaynaklara dış bağlantı verilir', async () => {
  const html = (await sayfa('/about')).text;
  const kaynaklar = ['help.instagram.com', 'tiktok.com/community-guidelines', 'youtube.com/howyoutubeworks', 'kvkk.gov.tr'];
  for (const kaynak of kaynaklar) {
    assert.ok(html.includes(kaynak), `otoriter kaynak atfı eksik: ${kaynak}`);
  }
});

test('hakkımızda sayfası sitemap ve llms.txt içinde duyurulur', async () => {
  assert.match((await sayfa('/sitemap.xml')).text, /<loc>[^<]*\/about<\/loc>/, 'sitemap hakkımızda sayfasını içermiyor');
  assert.match((await sayfa('/llms.txt')).text, /\/about/, 'llms.txt hakkımızda sayfasını içermiyor');
});

// ---------------------------------------------------------------
// Performans — [Lighthouse] CSS/JS küçültme
// ---------------------------------------------------------------

test('küçültülmüş varlıklar güncel kaynaktan üretilmiş', () => {
  const crypto = require('crypto');
  const esler = [
    ['public/css/style.css', 'public/css/style.min.css'],
    ['public/js/api.js', 'public/js/api.min.js'],
    ['public/js/app.js', 'public/js/app.min.js']
  ];
  for (const [kaynakYol, kucukYol] of esler) {
    const tam = path.join(__dirname, '..', kucukYol);
    assert.ok(fs.existsSync(tam), `${kucukYol} üretilmemiş — "npm run build" çalıştırın`);
    const kaynak = fs.readFileSync(path.join(__dirname, '..', kaynakYol), 'utf8');
    const damga = crypto.createHash('sha1').update(kaynak).digest('hex').slice(0, 12);
    const kucuk = fs.readFileSync(tam, 'utf8');
    assert.ok(kucuk.startsWith(`/*src:${damga}*/`),
      `${kucukYol} güncel değil — kaynak değişmiş, "npm run build" çalıştırın`);
    assert.ok(kucuk.length < kaynak.length, `${kucukYol} kaynaktan küçük değil`);
  }
});

test('HTML içinden çağrılan her app metodu küçültülmüş dosyada durur', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const kucuk = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.min.js'), 'utf8');
  const cagrilan = [...new Set([...html.matchAll(/\bapp\.([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]))];
  assert.ok(cagrilan.length > 50, 'çağrı taraması beklenenden az sonuç verdi');
  const eksik = cagrilan.filter(ad => !new RegExp(`[^\\w$]${ad}\\s*[(=]`).test(kucuk));
  assert.deepEqual(eksik, [], `küçültme şu metotları bozmuş: ${eksik.join(', ')}`);
});

test('küçültülmüş dosyalar geçerli JavaScript', () => {
  const vm = require('node:vm');
  for (const dosya of ['app.min.js', 'api.min.js']) {
    const kod = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', dosya), 'utf8');
    assert.doesNotThrow(() => new vm.Script(kod), `${dosya} sözdizimi bozuk`);
  }
});

test('sitemap.xml içindeki her adres geçerlidir (404 vermez)', async () => {
  const xml = (await sayfa('/sitemap.xml')).text;
  const adresler = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].replace('https://jetsmmpanel.com', ''));
  assert.ok(adresler.length > 0, 'sitemap boş');
  for (const adres of adresler) {
    assert.equal(pageForPath(adres).status, 200, `sitemap'teki ${adres} adresi 404 dönüyor`);
  }
});
