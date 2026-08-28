require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { rateLimit } = require('express-rate-limit');
const pinoHttp = require('pino-http');
const compression = require('compression');
const path = require('path');
const { initDatabase } = require('./config/database');
const { startOrderWorker } = require('./services/orderWorker');
const { notFoundApi, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const servicesRoutes = require('./routes/services');
const ordersRoutes = require('./routes/orders');
const paymentsRoutes = require('./routes/payments');
const ticketsRoutes = require('./routes/tickets');
const adminRoutes = require('./routes/admin');
const accountRoutes = require('./routes/account');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(pinoHttp({
  level: process.env.LOG_LEVEL || 'info',
  autoLogging: process.env.NODE_ENV !== 'test',
  redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie']
}));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // googletagmanager/analytics: admin panelden GA kimligi girilirse calisir.
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com', 'https://www.googletagmanager.com'],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://*.google-analytics.com', 'https://*.analytics.google.com', 'https://www.googletagmanager.com'],
      objectSrc: ["'none'"],
      // Shopier odeme formu tarayicidan dogrudan shopier.com'a POST edilir;
      // helmet'in varsayilan "form-action 'self'" kurali bunu sessizce engeller.
      formAction: ["'self'", 'https://www.shopier.com'],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // Varsayilan "no-referrer" dis baglantilara hicbir kaynak bilgisi
  // gondermiyordu; marka atifi ve analitik icin dengeli politika yeterli.
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// Google Tag Assistant (GA'daki "Etiketi test et" dugmesi) siteyi window.open
// ile acar ve etiketi gorebilmek icin window.opener baglantisina ihtiyac duyar.
// helmet'in varsayilan "Cross-Origin-Opener-Policy: same-origin" basligi bu
// baglantiyi bilerek koparir; sonuc olarak etiket sayfada dururken GA
// "algilanmadi" der. Tag Assistant actigi adrese gtm_debug parametresini
// ekledigi icin korumayi yalnizca o istekte gevsetiyoruz — normal ziyaretciler
// tam korumayla gezmeye devam eder.
app.use((req, res, next) => {
  if (Object.prototype.hasOwnProperty.call(req.query, 'gtm_debug')) {
    res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
  }
  next();
});

// Permissions-Policy: sitenin hicbir yerinde kamera, mikrofon, konum, odeme
// API'si veya hareket sensoru kullanilmiyor. Tarayiciya bunu acikca soylemek,
// sayfaya sizan ucuncu parti bir betigin bu ozellikleri istemesini engeller.
// (helmet bu basligi kendiliginden eklemez.)
const PERMISSIONS_POLICY = [
  'accelerometer=()', 'ambient-light-sensor=()', 'autoplay=()', 'camera=()',
  'display-capture=()', 'encrypted-media=()', 'fullscreen=(self)',
  'geolocation=()', 'gyroscope=()', 'magnetometer=()', 'microphone=()',
  'midi=()', 'payment=()', 'usb=()', 'xr-spatial-tracking=()'
].join(', ');
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
  next();
});

const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || `http://localhost:${PORT}`).split(',').map(v => v.trim()).filter(Boolean));
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    callback(new Error('Bu kaynaktan erişime izin verilmiyor.'));
  }
}));
app.use(cookieParser());
app.use(compression());
// Shopier webhook imzasi HAM govde uzerinden hesaplanir; JSON'a cevrildikten
// sonra (bosluk/anahtar sirasi degisebilecegi icin) dogrulanamaz. Yalnizca o
// adres icin ham govde saklanir, diger isteklerde ek bellek maliyeti olmaz.
app.use(express.json({
  limit: '512kb',
  verify(req, res, buf) {
    if (req.originalUrl && req.originalUrl.split('?')[0] === '/api/payments/shopier/webhook') req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: '512kb' }));

// API yanitlari (siparis durumu, bakiye vb.) asla onbelleklenmemeli; mobil
// tarayicilarin eski veriyi gostermesini engeller.
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

const apiLimiter = rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });
app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

// ----------------------------------------------------
// SEO: dinamik sitemap + robots (statik dosyalardan ONCE tanimlanmali)
// Sitemap, PUBLIC_BASE_URL ve yayindaki blog yazilarindan uretilir.
// ----------------------------------------------------
app.get('/sitemap.xml', async (req, res) => {
  try {
    const { dbAsync } = require('./config/database');
    const base = String(process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const urls = [
      { loc: `${base}/`, priority: '1.0', changefreq: 'daily' },
      { loc: `${base}/services`, priority: '0.9', changefreq: 'daily' },
      { loc: `${base}/blog`, priority: '0.8', changefreq: 'weekly' },
      { loc: `${base}/about`, priority: '0.6', changefreq: 'monthly' },
      { loc: `${base}/api-docs`, priority: '0.5', changefreq: 'monthly' },
      { loc: `${base}/register`, priority: '0.6', changefreq: 'monthly' },
      { loc: `${base}/terms`, priority: '0.3', changefreq: 'yearly' },
      { loc: `${base}/privacy`, priority: '0.3', changefreq: 'yearly' },
      { loc: `${base}/refund`, priority: '0.3', changefreq: 'yearly' }
    ];
    // Blog yazilari gercek adresli SSR sayfalaridir (#hash degil) —
    // Google hash adresleri ayri sayfa saymadigi icin bu sart.
    const posts = await dbAsync.all("SELECT slug, updated_at, created_at FROM blog_posts WHERE status = 'published' ORDER BY id DESC LIMIT 500").catch(() => []);
    for (const post of posts) {
      urls.push({ loc: `${base}/blog/${encodeURIComponent(post.slug)}`, priority: '0.7', changefreq: 'monthly', lastmod: (post.updated_at || post.created_at || '').slice(0, 10) });
    }
    // Satis sayfalari (kok adresli landing page'ler): donusum sayfalari,
    // blogdan daha yuksek oncelikle sunulur.
    const satisSayfalari = await require('./utils/landingPages').listPublished(dbAsync).catch(() => []);
    for (const sayfa of satisSayfalari) {
      urls.push({ loc: `${base}/${encodeURIComponent(sayfa.slug)}`, priority: '0.9', changefreq: 'weekly', lastmod: sayfa.lastmod || undefined });
    }
    // Sik degisen sayfalara lastmod: en guncel yazinin tarihi makul bir
    // vekildir (katalog ve blog listesi en gec o gun degismistir).
    const sonYazi = posts.reduce((max, p) => {
      const d = (p.updated_at || p.created_at || '').slice(0, 10);
      return d > max ? d : max;
    }, '');
    if (sonYazi) {
      for (const u of urls) {
        if ([`${base}/`, `${base}/services`, `${base}/blog`].includes(u.loc)) u.lastmod = sonYazi;
      }
    }
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u =>
      `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`
    ).join('\n')}\n</urlset>`;
    res.type('application/xml').send(xml);
  } catch {
    res.status(500).type('text').send('sitemap error');
  }
});

// Bing Webmaster Tools "XML dosyasi" dogrulama yontemi. Bing sunucunun
// kokunde /BingSiteAuth.xml bekler; dosyayi FTP ile yuklemek yerine admin
// panelindeki koddan uretiyoruz. Bing adresi buyuk harfli ister, kullanici
// tarayicida kucuk harfle deneyebilir — ikisi de karsilanir.
app.get(['/BingSiteAuth.xml', '/bingsiteauth.xml'], async (req, res) => {
  try {
    const { dbAsync } = require('./config/database');
    const row = await dbAsync.get("SELECT value FROM site_settings WHERE key = 'bing_site_verification'");
    // Onbellek yok: admin kodu kaydettikten saniyeler sonra "Dogrula" der.
    const code = extractVerificationCode(row && row.value);
    if (!code) {
      return res.status(404).type('text/plain; charset=utf-8')
        .send('Bing doğrulama kodu admin panelinde tanımlı değil. Admin > Ayarlar > SEO & Analitik bölümünden ekleyin.');
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.type('application/xml').send(`<?xml version="1.0"?>\n<users>\n  <user>${code}</user>\n</users>`);
  } catch {
    res.status(500).type('text/plain; charset=utf-8').send('bing auth error');
  }
});

// IndexNow anahtar dosyasi: Bing, bildirilen anahtarin bu adreste
// yayinlandigini dogrular (bkz. services/indexNow.js).
const { indexNowKey } = require('./services/indexNow');
app.get(`/${indexNowKey()}.txt`, (req, res) => {
  res.type('text/plain').send(indexNowKey());
});

app.get('/robots.txt', (req, res) => {
  const base = String(process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  // AI botlari acikca karsilanir: site icerigi yapay zeka aramalarinda
  // (ChatGPT, Claude, Perplexity vb.) kaynak olarak gosterilebilsin.
  res.type('text/plain').send([
    'User-agent: *', 'Allow: /', 'Disallow: /api/', '',
    'User-agent: GPTBot', 'Allow: /', '',
    'User-agent: ClaudeBot', 'Allow: /', '',
    'User-agent: PerplexityBot', 'Allow: /', '',
    'User-agent: Google-Extended', 'Allow: /', '',
    `Sitemap: ${base}/sitemap.xml`, ''
  ].join('\n'));
});

// llms.txt: yapay zeka modellerinin siteyi tanimasi icin ozet dosya
// (llmstxt.org standardi). Icerik ayarlardan ve yayindaki bloglardan uretilir.
app.get('/llms.txt', async (req, res) => {
  try {
    const { dbAsync } = require('./config/database');
    const base = String(process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const rows = await dbAsync.all("SELECT key, value FROM site_settings WHERE key IN ('site_name', 'telegram_link', 'support_email')").catch(() => []);
    const settings = {};
    rows.forEach(row => { settings[row.key] = String(row.value || '').trim(); });
    const siteName = settings.site_name || 'Jet SMM Panel';
    const posts = await dbAsync.all("SELECT slug, COALESCE(title_tr, title) title, COALESCE(summary_tr, summary) summary FROM blog_posts WHERE status = 'published' ORDER BY id DESC LIMIT 20").catch(() => []);

    const lines = [
      `# ${siteName}`,
      '',
      `> ${siteName} (SMMJET, jetsmmpanel.com); Instagram, TikTok, YouTube ve diğer sosyal medya platformları için takipçi, beğeni ve izlenme gibi dijital pazarlama hizmetleri sunan Türkçe bir SMM panelidir. Kullanıcılar ön ödemeli bakiye ile sipariş verir; teslimat otomatiktir ve çoğu hizmette saniyeler içinde başlar.`,
      '',
      '## Önemli Sayfalar',
      `- [Ana Sayfa ve Hizmet Kataloğu](${base}/): Güncel hizmet listesi, fiyatlar ve sık sorulan sorular`,
      `- [Hizmetler ve Fiyat Listesi](${base}/services): Platform bazında tüm servisler, 1000 adet fiyatları ve limitler`,
      `- [Hakkımızda ve Editoryal Politika](${base}/about): Panelin işleyişi, kalite taahhütleri ve içerik ilkeleri`,
      `- [API Dokümantasyonu](${base}/api-docs): Bayiler için API v2 uçları, istek örnekleri ve hata kodları`,
      `- [Kullanım Şartları](${base}/terms): Üyelik ve hizmet koşulları`,
      `- [Gizlilik ve KVKK](${base}/privacy): Kişisel verilerin işlenmesi ve çerez politikası`,
      `- [İade Politikası](${base}/refund): İade, düşüş telafisi (refill) ve garanti koşulları`,
      ''
    ];
    const satisSayfalari = await require('./utils/landingPages').listPublished(dbAsync).catch(() => []);
    if (satisSayfalari.length) {
      lines.push('## Hizmet Sayfaları');
      for (const sayfa of satisSayfalari) {
        const ozet = String(sayfa.subtitle || '').replace(/\s+/g, ' ').trim().slice(0, 140);
        lines.push(`- [${String(sayfa.title).replace(/[\[\]]/g, '')}](${base}/${encodeURIComponent(sayfa.slug)})${ozet ? `: ${ozet}` : ''}`);
      }
      lines.push('');
    }
    if (posts.length) {
      lines.push('## Blog Yazıları');
      for (const post of posts) {
        const ozet = String(post.summary || '').replace(/\s+/g, ' ').trim().slice(0, 140);
        lines.push(`- [${String(post.title).replace(/[\[\]]/g, '')}](${base}/blog/${encodeURIComponent(post.slug)})${ozet ? `: ${ozet}` : ''}`);
      }
      lines.push('');
    }
    lines.push('## İletişim');
    lines.push(`- Destek talebi: ${base}/tickets`);
    if (settings.support_email) lines.push(`- E-posta: ${settings.support_email}`);
    if (settings.telegram_link) lines.push(`- Telegram: ${settings.telegram_link}`);
    lines.push('');
    lines.push('## Optional');
    lines.push(`- [Tüm blog içeriklerinin tam metni](${base}/llms-full.txt)`);
    lines.push('');
    res.type('text/plain; charset=utf-8').send(lines.join('\n'));
  } catch {
    res.status(500).type('text').send('llms.txt error');
  }
});

// llms-full.txt: blog yazilarinin tam metni tek dosyada (llms.txt
// standardinin genisletilmis surumu). AI modelleri site icerigini tek
// istekle okuyabilir. 30 sn onbellek: her bot istegi DB'yi yormasin.
let llmsFullCache = { at: 0, body: '' };
app.get('/llms-full.txt', async (req, res) => {
  try {
    if (Date.now() - llmsFullCache.at < 30000 && llmsFullCache.body) {
      return res.type('text/plain; charset=utf-8').send(llmsFullCache.body);
    }
    const { dbAsync } = require('./config/database');
    const base = String(process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const siteRow = await dbAsync.get("SELECT value FROM site_settings WHERE key = 'site_name'").catch(() => null);
    const siteName = String(siteRow?.value || 'Jet SMM Panel').trim();
    const posts = await dbAsync.all(`SELECT slug, published_at, created_at, updated_at,
        COALESCE(title_tr, title) title,
        COALESCE(category_tr, category) category,
        COALESCE(content_tr, content) content
      FROM blog_posts WHERE status = 'published' ORDER BY id DESC LIMIT 50`).catch(() => []);
    const { stripHtml } = require('./utils/metaDescription');
    const parts = [
      `# ${siteName} — Tüm Blog İçerikleri`,
      '',
      `> Bu dosya, ${base} sitesindeki yayınlanmış blog yazılarının tam metnini içerir. Güncel liste ve site özeti için: ${base}/llms.txt`,
      ''
    ];
    for (const post of posts) {
      const tarih = (post.updated_at || post.published_at || post.created_at || '').slice(0, 10);
      parts.push(`## ${post.title}`);
      parts.push('');
      parts.push(`- Adres: ${base}/blog/${encodeURIComponent(post.slug)}`);
      if (post.category) parts.push(`- Kategori: ${post.category}`);
      if (tarih) parts.push(`- Tarih: ${tarih}`);
      parts.push('');
      parts.push(stripHtml(post.content));
      parts.push('');
    }
    llmsFullCache = { at: Date.now(), body: parts.join('\n') };
    res.type('text/plain; charset=utf-8').send(llmsFullCache.body);
  } catch {
    res.status(500).type('text').send('llms-full.txt error');
  }
});

// ----------------------------------------------------
// PAZARLAMA E-POSTASI ABONELIK CIKISI
// Her pazarlama e-postasinin altindaki imzali link buraya gelir; imza
// dogruysa kullanici listeden cikarilir. Oturum gerektirmez.
// ----------------------------------------------------
app.get('/unsubscribe', async (req, res) => {
  const crypto = require('crypto');
  const { dbAsync } = require('./config/database');
  const page = (title, message) => `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title>
    <style>body{font-family:Segoe UI,system-ui,sans-serif;background:#fffef8;color:#1f2937;display:grid;place-items:center;min-height:100vh;margin:0;padding:20px;}
    .box{max-width:420px;text-align:center;padding:34px 28px;background:#fff;border:3px solid #090909;box-shadow:8px 8px 0 #090909;}
    h1{font-size:1.3rem;margin:0 0 10px;} p{margin:0;line-height:1.6;color:#4b5563;} a{color:#1769e8;}</style></head>
    <body><div class="box"><h1>${title}</h1><p>${message}</p></div></body></html>`;
  try {
    const userId = Number(req.query.u);
    const sig = String(req.query.s || '');
    const expected = crypto.createHmac('sha256', process.env.JWT_SECRET || 'dev').update(`unsub:${userId}`).digest('hex').slice(0, 32);
    if (!Number.isSafeInteger(userId) || userId <= 0 || sig !== expected) {
      return res.status(400).type('html').send(page('Geçersiz bağlantı', 'Bu abonelikten çıkma bağlantısı geçersiz veya süresi dolmuş.'));
    }
    await dbAsync.run('UPDATE users SET email_opt_out = 1 WHERE id = ?', [userId]);
    return res.type('html').send(page('Listeden çıkarıldınız ✅', 'Artık kampanya e-postası almayacaksınız. Sipariş ve güvenlik e-postaları (şifre sıfırlama gibi) gönderilmeye devam eder.'));
  } catch {
    return res.status(500).type('html').send(page('Bir sorun oluştu', 'Lütfen daha sonra tekrar deneyin.'));
  }
});

// ----------------------------------------------------
// BLOG SSR SAYFALARI: /blog/:slug
// SPA'daki #blog/... adresleri Google tarafindan ayri sayfa sayilmaz; bu
// sunucu tarafinda islenen sayfalar arama motorlari ve paylasim onizlemeleri
// icin gercek, indekslenebilir adresler saglar.
// ----------------------------------------------------
function escapeAttr(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

app.get('/blog/:slug', async (req, res) => {
  try {
    const { dbAsync } = require('./config/database');
    const { sanitizeRichText } = require('./utils/security');
    const base = String(process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const post = await dbAsync.get(`SELECT slug, image_url, reading_minutes, created_at, published_at, updated_at,
        COALESCE(title_tr, title) title,
        COALESCE(category_tr, category) category,
        COALESCE(summary_tr, summary) summary,
        COALESCE(content_tr, content) content,
        COALESCE(seo_title_tr, title_tr, title) seo_title,
        COALESCE(seo_description_tr, summary_tr, summary) seo_description
      FROM blog_posts WHERE status = 'published' AND slug = ?`, [req.params.slug]);
    if (!post) return res.status(404).redirect('/blog');

    // Okunma sayaci: Google'dan/dogrudan gelen ziyaretciler SPA'nin API ucuna
    // ugramadigi icin eskiden hic sayilmiyordu. Yaniti geciktirmez.
    dbAsync.run("UPDATE blog_posts SET views = COALESCE(views, 0) + 1 WHERE slug = ?", [req.params.slug]).catch(() => {});
    require('./services/visitorTracker').recordVisit(req).catch(() => {});

    const ayarRows = await dbAsync.all("SELECT key, value FROM site_settings WHERE key IN ('site_name', 'blog_author_name', 'blog_author_title', 'blog_author_url')").catch(() => []);
    const ayarlar = {};
    ayarRows.forEach(r => { ayarlar[r.key] = String(r.value || '').trim(); });
    // trim: ayardaki olasi bosluklar sema/baslik varlik adini bozmasin.
    const siteName = ayarlar.site_name || 'Jet SMM Panel';
    const pageUrl = `${base}/blog/${encodeURIComponent(post.slug)}`;
    const imageUrl = post.image_url ? (post.image_url.startsWith('http') ? post.image_url : `${base}${post.image_url}`) : '';
    // SVG kapaklar sayfada gorunur ama paylasim botlari ve Google gorsel
    // onizlemeleri raster ister; sema/og icin og-image.png'ye dusulur.
    const rasterGorsel = imageUrl && !imageUrl.toLowerCase().endsWith('.svg') ? imageUrl : `${base}/og-image.png`;
    const published = (post.published_at || post.created_at || '').slice(0, 10);
    const modified = (post.updated_at || post.published_at || post.created_at || '').slice(0, 10);
    // Icerik kayitta sanitize edilir; yine de cikista bir kez daha suzulur.
    const safeContent = sanitizeRichText(post.content || '');

    // Yazar: admin panelde gercek yazar tanimlanmissa Person (E-E-A-T sinyali
    // guclu), tanimlanmamissa Organization imzasina duser.
    const yazarAdi = ayarlar.blog_author_name || `${siteName} Editör Ekibi`;
    const yazarLd = ayarlar.blog_author_name
      ? {
          '@type': 'Person',
          name: ayarlar.blog_author_name,
          jobTitle: ayarlar.blog_author_title || undefined,
          url: ayarlar.blog_author_url || undefined,
          sameAs: ayarlar.blog_author_url ? [ayarlar.blog_author_url] : undefined,
          worksFor: { '@id': `${base}/#organization` }
        }
      : { '@type': 'Organization', name: yazarAdi, url: base };
    const jsonLd = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: buildMetaDescription([post.seo_description, post.summary]) || undefined,
      image: rasterGorsel,
      datePublished: published,
      dateModified: modified,
      mainEntityOfPage: pageUrl,
      inLanguage: 'tr-TR',
      articleSection: post.category || undefined,
      wordCount: String(post.content || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length || undefined,
      author: yazarLd,
      // Organization blogu her sayfada @id ile basiliyor (buildSeoParts);
      // kopya yerine referans, varlik adinin tek kaynaktan gelmesini saglar.
      publisher: { '@id': `${base}/#organization` },
      // Sesli asistanlar ve AI ozetleyiciler icin okunmaya uygun bolumler.
      speakable: {
        '@type': 'SpeakableSpecification',
        cssSelector: ['#blog-detail-title', '#blog-detail-content > p:first-of-type']
      }
    });

    // Kirinti yolu: Google sonuclarinda "Ana Sayfa > Blog > Yazi" seklinde
    // gorunur ve iki ic baglantiyi da yapisal veriyle iliskilendirir.
    const breadcrumbLd = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: `${base}/` },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${base}/blog` },
        { '@type': 'ListItem', position: 3, name: post.title, item: pageUrl }
      ]
    });

    // Blog sayfasi artik sitenin KENDI kabugunu kullanir. Eskiden burada
    // bambaska tasarimda tek basina bir HTML donuyordu; kullanici yazi icinde
    // sayfayi yenileyince (veya Google'dan gelince) menusuz, farkli gorunumlu
    // bir sayfayla karsilasiyordu. Icerik yine sunucudan basildigi icin arama
    // motorlari HTML'de gercek metni gormeye devam eder.
    let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
    html = stripGatedMarkup(html, sessionState(req));
    html = await applyTelegramLink(html);
    html = await applyLandingLinks(html);
    // API dokumanindaki localhost ornekleri botlar icin gercek adrese cevrilir.
    html = html.split('http://localhost:3000').join(base);
    html = html.replace(ANNOUNCEMENT_BLOCK, await announcementHtml());

    // Meta aciklama 25-160 karakter araligina getirilir. Veritabaninda ne
    // yazarsa yazsin (AI uzun ozet uretmis olabilir) sayfaya basilan hali
    // arama motoru kuralina uyar. Sirayla denenir: SEO aciklamasi, ozet,
    // yazi metninin ilk cumleleri; hicbiri yetmezse baslik + kategori.
    const metaAciklama = buildMetaDescription(
      [post.seo_description, post.summary, post.content],
      `${post.title} — ${post.category || 'Blog'} | ${siteName}`
    );
    html = html
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeAttr(post.seo_title)} | ${escapeAttr(siteName)}</title>`)
      .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escapeAttr(metaAciklama)}">`)
      .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${pageUrl}">`)
      .replace(/<meta property="og:type"[^>]*>/, '<meta property="og:type" content="article">')
      .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escapeAttr(post.seo_title)}">`)
      .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escapeAttr(metaAciklama)}">`)
      .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${pageUrl}">`)
      .replace(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${escapeAttr(post.seo_title)}">`)
      .replace(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${escapeAttr(metaAciklama)}">`)
      .replace(/<meta name="twitter:card"[^>]*>/, '<meta name="twitter:card" content="summary_large_image">');
    // Makale tarihleri: paylasim onizlemeleri ve AI botlari yayin/guncelleme
    // tarihini meta duzeyinde de gorebilsin (JSON-LD'dekiyle ayni degerler).
    if (published) {
      html = html.replace('</head>',
        `  <meta property="article:published_time" content="${escapeAttr(published)}">\n` +
        `  <meta property="article:modified_time" content="${escapeAttr(modified || published)}">\n</head>`);
    }
    if (imageUrl) {
      // SVG kapaklar (yerel uretilen kapak seti) sayfada gorunur ama sosyal
      // onizleme botlari (Facebook/X/WhatsApp) SVG'yi desteklemez; og:image
      // icin raster og-image.png'ye dusulur.
      html = html
        .replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${escapeAttr(rasterGorsel)}">`)
        .replace(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${escapeAttr(rasterGorsel)}">`)
        .replace(/<meta property="og:image:alt"[^>]*>/, `<meta property="og:image:alt" content="${escapeAttr(post.title)}">`)
        // Yazinin gorseli 1200x630 olmak zorunda degil; sabit boyut etiketleri
        // yaniltici olacagi icin bu sayfada kaldirilir.
        .replace(/\s*<meta property="og:image:(width|height)"[^>]*>/g, '');
    }
    // Analytics + arama motoru dogrulama etiketleri blog sayfasina da girer.
    // Eskiden girmiyordu: Google'dan gelen blog trafigi Analytics'te hic
    // gorunmuyordu ve dogrulama yalnizca ana sayfada gecerliydi.
    html = html.replace('</head>',
      `${await buildSeoSnippet(false)}  <script type="application/ld+json">${jsonLd}</script>\n` +
      `  <script type="application/ld+json">${breadcrumbLd}</script>\n</head>`);

    // Yaziyi HTML'e onceden bas: JavaScript calismadan da (Google botu, paylasim
    // onizlemesi) baslik ve metin gorunur. SPA acilinca ayni icerigi yeniden cizer.
    // Yazar imzasi: denetim "yazar imzasi bulunamadi" uyarisi veriyordu ve
    // BlogPosting semasindaki author alaninin sayfada gorunur karsiligi olmasi
    // E-E-A-T icin bekleniyor.
    // Yazar profili tanimliysa imza tiklanabilir olur (admin panelde girilen
    // Instagram/LinkedIn adresi buradan aciliyor).
    // Baglanti yalnizca gercek yazar adi tanimliyken kurulur; anonim "Editör
    // Ekibi" imzasini kisisel profile baglamak yaniltici olur.
    const yazarHtml = ayarlar.blog_author_name && ayarlar.blog_author_url && !/["'<>\s]/.test(ayarlar.blog_author_url)
      ? `<a href="${escapeAttr(ayarlar.blog_author_url)}" target="_blank" rel="me noopener noreferrer" style="color: inherit; text-decoration: underline;">${escapeAttr(yazarAdi)}</a>`
      : escapeAttr(yazarAdi);
    const tarihMetni = [yazarHtml, escapeAttr(post.category || 'Blog'), escapeAttr(published), post.reading_minutes ? `${post.reading_minutes} dk okuma` : '']
      .filter(Boolean).join(' • ');
    html = html
      .replace('<section id="view-landing" class="app-view neo-landing">', '<section id="view-landing" class="app-view neo-landing" style="display: none;">')
      .replace('<section id="view-blog-detail" class="app-view" style="display: none;">', '<section id="view-blog-detail" class="app-view" style="display: block;">')
      .replace(/(<span class="badge badge-completed mb-15" id="blog-detail-category">)[\s\S]*?(<\/span>)/, `$1${escapeAttr(post.category || 'Blog')}$2`)
      .replace(/(<h1 id="blog-detail-title"[^>]*>)[\s\S]*?(<\/h1>)/, `$1${escapeAttr(post.title)}$2`)
      // tarihMetni parcalari tek tek escape edildi; yazar baglantisi HTML olarak kalmali.
      .replace(/(id="blog-detail-date">)[\s\S]*?(<\/div>)/, `$1${tarihMetni}$2`)
      .replace(/(<div id="blog-detail-content"[^>]*>)[\s\S]*?(<\/div>)/, `$1${safeContent}$2`)
      // Paylasim baglantilari JavaScript beklemeden dogru adresi gostersin.
      .replace('href="https://twitter.com/intent/tweet"', `href="https://twitter.com/intent/tweet?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(post.title)}"`)
      .replace('href="https://www.facebook.com/sharer/sharer.php"', `href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}"`)
      .replace('href="https://wa.me/"', `href="https://wa.me/?text=${encodeURIComponent(`${post.title} ${pageUrl}`)}"`)
      .replace('href="https://t.me/share/url"', `href="https://t.me/share/url?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(post.title)}"`);
    if (imageUrl) {
      // Kapak gorseli sayfanin LCP adayidir (ekranin ustunde, en buyuk oge).
      // fetchpriority="high" + preload, tarayicinin onu diger isteklerin
      // arkasina koymasini engeller; denetim "LCP adayi optimize edilebilir:
      // no preload or fetchpriority" uyarisi veriyordu.
      html = html
        .replace(/<img id="blog-detail-img"[^>]*>/,
          `<img id="blog-detail-img" src="${escapeAttr(imageUrl)}" alt="${escapeAttr(post.title)}" fetchpriority="high" decoding="async" style="width: 100%; height: 350px; object-fit: cover; border-radius: var(--radius-md); margin-bottom: 24px;">`)
        .replace('</head>', `  <link rel="preload" as="image" href="${escapeAttr(imageUrl)}" fetchpriority="high">\n</head>`);
    }

    // Yazinin basligi sayfanin tek h1'i olmalidir; diger gorunumlerin
    // basliklari h2'ye cevrilir. Icerik basildiktan SONRA calisir, cunku
    // yukaridaki degistirmeler <h1 id="blog-detail-title"> etiketini arar.
    html = enforceSingleH1(html, 'view-blog-detail');

    res.setHeader('Cache-Control', 'no-cache');
    res.type('html').send(useMinifiedAssets(html));
  } catch (err) {
    res.redirect('/blog');
  }
});

// Serve frontend static assets.
// index: false -> ana sayfa istekleri asagidaki SPA handler'ina duser; orada
// Google Analytics / Search Console etiketleri sunucu tarafinda enjekte edilir.
app.use(express.static(path.join(__dirname, 'public'), {
  index: false,
  etag: true,
  // css/js baglantilari index.html'de ?v= surum parametresiyle cagrildigi icin
  // uzun onbellek guvenlidir; yeni surumde parametre degisir, tarayici yenisini ceker.
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (process.env.NODE_ENV === 'production' && /\.(css|js)$/.test(filePath)) {
      // css/js her zaman ?v= surum parametresiyle cagrilir; icerik degisince
      // parametre degisir. Bu yuzden 1 yil + immutable guvenlidir.
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

const blogRoutes = require('./routes/blog');
const aiRoutes = require('./routes/ai');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/landing-pages', require('./routes/landingPages'));

// ----------------------------------------------------
// RESELLER API V2 (Standard SMM API Endpoint)
// ----------------------------------------------------
app.post('/api/v2', async (req, res) => {
  const { key, action, service, link, quantity, order, orders } = req.body;
  const { dbAsync, withTransaction } = require('./config/database');
  const { calculateChargeKurus, fromKurus, toKurus } = require('./utils/money');
  const { normalizePlainText } = require('./utils/security');

  if (!key) {
    return res.json({ error: 'Invalid API Key' });
  }

  const user = await dbAsync.get(`SELECT * FROM users WHERE api_key = ?`, [key]);
  if (!user || user.banned) {
    return res.json({ error: 'Invalid API Key' });
  }

  if (action === 'services') {
    // Bayi API'si Ingilizce oncelikli: EN alani bossa TR'ye duser.
    const list = await dbAsync.all(`SELECT id as service, COALESCE(NULLIF(name_en, ''), name) as name, rate_per_1000_kurus,
      min_quantity as min, max_quantity as max, category_id as category, refill,
      COALESCE(NULLIF(description_en, ''), description, '') as description,
      COALESCE(NULLIF(start_time_en, ''), start_time_tr, '') as start_time,
      COALESCE(NULLIF(speed_en, ''), speed_tr, '') as speed,
      COALESCE(NULLIF(features_en, ''), features_tr, '') as features
      FROM services WHERE status = 1`);
    return res.json(list.map(item => ({
      ...item,
      rate: fromKurus(item.rate_per_1000_kurus).toFixed(2),
      refill: Number(item.refill) === 1,
      // Ozellikler satir satir saklanir; API'de dizi olarak verilir.
      features: String(item.features || '').split(/\r?\n/).filter(Boolean),
      rate_per_1000_kurus: undefined
    })));
  }

  if (action === 'balance') {
    return res.json({ balance: fromKurus(user.balance_kurus).toFixed(2), currency: 'TRY' });
  }

  if (action === 'add') {
    const qty = Number(quantity);
    if (!Number.isSafeInteger(qty) || !link) return res.json({ error: 'Invalid parameters' });
    try {
      // Panel siparisiyle AYNI yoldan gecer: link dogrulamasi, kampanya
      // indirimi, bakiye dusumu, saglayiciya iletim ve basarisizlikta iade.
      // Eskiden burada siparis yalnizca 'pending' olarak kaydedilip birakiliyor,
      // saglayiciya hic gonderilmiyordu.
      const { placeOrder } = require('./services/placeOrder');
      const result = await placeOrder({
        user, serviceId: service, link, quantity: qty, lang: 'en'
      });
      return res.json({ order: result.orderId });
    } catch (err) {
      // SMM API gelenegi: HTTP 200 + govdede error alani (Ingilizce).
      return res.json({ error: err.messageEn || err.message });
    }
  }

  if (action === 'status') {
    if (order) {
      const o = await dbAsync.get(`SELECT * FROM orders WHERE id = ? AND user_id = ?`, [order, user.id]);
      if (!o) return res.json({ error: 'Order not found' });
      const mapped = { completed: 'Completed', canceled: 'Canceled', partial: 'Partial', failed: 'Canceled', pending: 'Pending', processing: 'Processing' };
      return res.json({ status: mapped[o.status] || 'Processing', start_count: o.start_count, remains: o.remains, charge: fromKurus(o.charge_kurus).toFixed(2), currency: 'TRY' });
    }
    if (orders) {
      const ids = String(orders).split(',').map(Number).filter(Number.isSafeInteger).slice(0, 100);
      if (!ids.length) return res.json({ error: 'Invalid orders' });
      const rows = await dbAsync.all(`SELECT * FROM orders WHERE user_id = ? AND id IN (${ids.map(() => '?').join(',')})`, [user.id, ...ids]);
      const mapped = { completed: 'Completed', canceled: 'Canceled', partial: 'Partial', failed: 'Canceled', pending: 'Pending', processing: 'Processing' };
      return res.json(Object.fromEntries(rows.map(o => [o.id, { status: mapped[o.status] || 'Processing', start_count: o.start_count, remains: o.remains, charge: fromKurus(o.charge_kurus).toFixed(2), currency: 'TRY' }])));
    }
  }

  res.json({ error: 'Invalid action' });
});

// ----------------------------------------------------
// LOCAL MOCK PROVIDER API (For testing provider sync offline)
// ----------------------------------------------------
if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_MOCK_PROVIDER === 'true') app.post('/api/mock-provider', (req, res) => {
  const { action, service, link, quantity, order, orders } = req.body;

  if (action === 'services') {
    return res.json([
      { service: 101, name: 'Instagram HQ Followers [Refill 30D]', category: 'Instagram', rate: '0.80', min: '100', max: '50000', refill: true },
      { service: 102, name: 'Instagram Real Likes [Instant]', category: 'Instagram', rate: '0.20', min: '50', max: '20000', refill: false },
      { service: 201, name: 'TikTok Live Stream Views [60 Mins]', category: 'TikTok', rate: '0.50', min: '100', max: '5000', refill: false },
      { service: 202, name: 'TikTok Viral Followers', category: 'TikTok', rate: '0.90', min: '100', max: '25000', refill: true },
      { service: 301, name: 'YouTube Views [High Retention]', category: 'YouTube', rate: '1.40', min: '500', max: '100000', refill: true },
      { service: 401, name: 'Telegram Channel Members [Global]', category: 'Telegram', rate: '0.40', min: '100', max: '100000', refill: false }
    ]);
  }

  if (action === 'add') {
    const mockProviderOrderId = Math.floor(100000 + Math.random() * 900000);
    return res.json({ order: mockProviderOrderId });
  }

  if (action === 'status') {
    if (orders) {
      const orderIdList = orders.split(',');
      const result = {};
      orderIdList.forEach(id => {
        result[id] = { status: 'Completed', start_count: '250', remains: '0', charge: '0.15' };
      });
      return res.json(result);
    }
    return res.json({ status: 'Completed', start_count: '250', remains: '0', charge: '0.15' });
  }

  if (action === 'balance') {
    return res.json({ balance: '4850.00', currency: 'USD' });
  }

  res.status(400).json({ error: 'Geçersiz provider aksiyonu.' });
});

app.use(notFoundApi);

// ----------------------------------------------------
// SPA HTML: admin panelde girilen GA olcum kimligi ve Search Console
// dogrulama kodu </head> oncesine sunucu tarafinda islenir. Boylece
// Google botlari etiketi ilk istekte gorur (JS beklemez).
// ----------------------------------------------------
const fs = require('fs');
const { extractVerificationCode, extractAnalyticsId } = require('./utils/seoVerification');
// viewForPath artik burada gerekmiyor: gorunum bilgisi pageForPath ile
// baslik/aciklama/canonical'la birlikte tek seferde geliyor.
const { enforceSingleH1 } = require('./utils/headings');
const { buildMetaDescription } = require('./utils/metaDescription');
const { pageForPath } = require('./utils/pageMeta');
const { stripGatedMarkup, sessionState } = require('./utils/gatedMarkup');
// Etiketler iki parcaya ayrilir: "siteOgUrl" yalnizca ana sayfaya aittir
// (blog yazisinin kendi og:url'i vardir, ustune ana sayfaninki basilirsa
// paylasim onizlemesi yanlis adresi gosterir), "common" ise her sayfaya
// girmesi gereken kisimdir — dogrulama etiketleri ve Analytics dahil.
let seoCache = { at: 0, siteOgUrl: '', common: '', telegram: '', socialFooter: '' };
async function buildSeoParts() {
  if (Date.now() - seoCache.at < 60000) return seoCache;
  let siteOgUrl = '';
  let snippet = '';
  let telegram = '';
  let socialFooter = '';
  try {
    const { dbAsync } = require('./config/database');
    const rows = await dbAsync.all("SELECT key, value FROM site_settings WHERE key IN ('google_analytics_id', 'google_site_verification', 'bing_site_verification', 'site_name', 'telegram_link', 'support_email', 'social_instagram', 'social_x', 'social_youtube', 'social_tiktok', 'business_address')");
    const settings = {};
    rows.forEach(row => { settings[row.key] = String(row.value || '').trim(); });

    // FOOTER SOSYAL PROFILLERI: admin panelde girilen kanallar alt bilgiye
    // sunucu tarafinda basilir (eskiden yalnizca JS ekliyordu; botlar ve
    // JS'siz istemciler goremiyordu). data-social oznitelikleri sayesinde
    // app.js ayni kanali ikinci kez eklemez.
    const sosyalKanallar = [
      { key: 'social_instagram', icon: 'fa-instagram', ad: 'Instagram' },
      { key: 'social_x', icon: 'fa-x-twitter', ad: 'X' },
      { key: 'social_youtube', icon: 'fa-youtube', ad: 'YouTube' },
      { key: 'social_tiktok', icon: 'fa-tiktok', ad: 'TikTok' }
    ];
    socialFooter = sosyalKanallar.map(kanal => {
      let adres = settings[kanal.key];
      if (!adres) return '';
      if (!adres.startsWith('http')) adres = adres.includes('.') ? `https://${adres}` : '';
      if (!adres || /["'<>\s]/.test(adres)) return '';
      return `<li><a data-social="${kanal.key}" href="${adres}" target="_blank" rel="me noopener noreferrer" aria-label="${kanal.ad} profilimiz"><i class="fa-brands ${kanal.icon}" aria-hidden="true"></i><span class="sr-only">${kanal.ad}</span></a></li>`;
    }).join('');

    // TELEGRAM ADRESI: index.html'deki sabit t.me baglantilari (yuzen dugme,
    // destek karti, alt bilgi) sunucu tarafinda bu adresle degistirilir.
    // Boylece admin panelden girilen adres JavaScript beklemeden ve botlara
    // da dogru sekilde yansir. Kullanici adi da tam adres de girilebilir.
    if (settings.telegram_link) {
      const ham = settings.telegram_link;
      telegram = ham.startsWith('http') ? ham : `https://t.me/${ham.replace('@', '')}`;
      // Isaretlemeyi bozacak karakterler adreste isimizi bitirir; boylesi
      // bir deger geldiyse degistirme hic yapilmaz (varsayilan kalir).
      if (/["'<>\s]/.test(telegram)) telegram = '';
    }

    // Yapisal veri: Google ve yapay zeka botlari siteyi kurulus olarak tanir.
    const base = String(process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
    if (base) {
      const siteName = (settings.site_name || 'SMMJET').replace(/[<>"]/g, '');
      siteOgUrl = `  <meta property="og:url" content="${base}/">\n`;
      snippet += `  <meta property="og:site_name" content="${siteName}">\n`;

      // sameAs: dogrulanmis sosyal profiller. Google "Organization semasi
      // gecerli ancak oneriler mevcut" uyarisini bu alan eksikken verir.
      // Normalizasyon kanala gore yapilir: eskiden http'siz her deger t.me
      // linkine cevriliyordu ve sosyal profiller yanlis adrese donusuyordu.
      const telegramSameAs = settings.telegram_link || 'https://t.me/SmmPanelDestek';
      const sameAs = [
        telegramSameAs.startsWith('http') ? telegramSameAs : `https://t.me/${telegramSameAs.replace('@', '')}`,
        ...[settings.social_instagram, settings.social_x, settings.social_youtube, settings.social_tiktok]
          .filter(Boolean)
          .map(v => (v.startsWith('http') ? v : (v.includes('.') ? `https://${v}` : '')))
          .filter(Boolean)
      ];

      const organization = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        '@id': `${base}/#organization`,
        name: siteName,
        // Marka koprusu: gorsel kimlik "SMMJET", tam ad "Jet SMM Panel",
        // alan adi "jetsmmpanel.com". AI modelleri ve Knowledge Graph bu
        // adlarin AYNI varliga ait oldugunu buradan ogrenir (smmjet.com
        // adindaki rakip firmalarla karistirilmamasi icin kritik).
        alternateName: ['SMMJET', 'Jet SMM Panel', 'JetSMMPanel', 'jetsmmpanel.com'].filter(n => n !== siteName),
        foundingDate: '2026',
        url: `${base}/`,
        logo: { '@type': 'ImageObject', url: `${base}/icon-512.png`, width: 512, height: 512 },
        image: `${base}/og-image.png`,
        description: 'Instagram, TikTok, YouTube ve diğer sosyal medya platformları için dijital pazarlama hizmetleri sunan SMM paneli.',
        sameAs,
        contactPoint: [{
          '@type': 'ContactPoint',
          contactType: 'customer support',
          availableLanguage: ['tr', 'en'],
          url: `${base}/tickets`
        }]
      };
      // Fiziksel adres yalnizca admin panelde girilmisse basilir; uydurma
      // adres yapisal veriyi gecersiz kilar.
      if (settings.business_address) {
        organization.address = { '@type': 'PostalAddress', streetAddress: settings.business_address, addressCountry: 'TR' };
      }
      if (settings.support_email) organization.contactPoint[0].email = settings.support_email;

      snippet += `  <script type="application/ld+json">${JSON.stringify(organization)}</script>\n`;
      snippet += `  <script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        '@id': `${base}/#website`,
        name: siteName,
        url: `${base}/`,
        inLanguage: 'tr-TR',
        publisher: { '@id': `${base}/#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${base}/services?q={search_term_string}` },
          'query-input': 'required name=search_term_string'
        }
      })}</script>\n`;
    }

    // Dogrulama alanina sade kod, tam meta etiketi veya XML dosyasi icerigi
    // yapistirilabilir; extractVerificationCode hepsinden kodu ayiklar.
    const googleCode = extractVerificationCode(settings.google_site_verification);
    if (googleCode) snippet += `  <meta name="google-site-verification" content="${googleCode}">\n`;

    // Bing Webmaster Tools. Google Search Console'dan ice aktarim her zaman
    // calismaz; bu etiket manuel dogrulamanin en kolay yoludur.
    const bingCode = extractVerificationCode(settings.bing_site_verification);
    if (bingCode) snippet += `  <meta name="msvalidate.01" content="${bingCode}">\n`;

    // Alana sade kimlik de, Google'in verdigi gtag.js blogunun tamami da
    // yapistirilabilir; extractAnalyticsId ikisinden de kimligi cikarir.
    //
    // CEREZ ONAYI: Olcum betigi artik dogrudan calismaz. Kimlik bir data
    // ozniteliginde tasinir; app.js ziyaretci "Kabul et" dedikten sonra
    // (veya onceki onayi hatirlandiginda) gtag.js'i sayfaya ekler. Onay
    // verilmezse Google'a hicbir istek gitmez.
    const gaId = extractAnalyticsId(settings.google_analytics_id);
    if (gaId) snippet += `  <meta name="analytics-id" content="${gaId}">\n`;
  } catch { /* DB hazir degilse etiketsiz devam */ }
  seoCache = { at: Date.now(), siteOgUrl, common: snippet, telegram, socialFooter };
  return seoCache;
}

// withSiteUrl: yalnizca ana sayfa/SPA rotalari icin true. Blog yazisi kendi
// og:url'ini bastigi icin false gecer; Analytics ve dogrulama etiketleri
// (common) ise HER sayfaya girer — aksi halde blogdan gelen trafik
// Analytics'e hic yansimaz.
async function buildSeoSnippet(withSiteUrl = true) {
  const parts = await buildSeoParts();
  return (withSiteUrl ? parts.siteOgUrl : '') + parts.common;
}

// index.html'deki sabit Telegram baglantilarini (yuzen dugme, destek karti,
// alt bilgi) admin panelde girilen adresle degistirir ve sosyal profilleri
// alt bilgiye basar. Hem SPA hem blog kabugu bu yardimcidan gecer;
// JavaScript hic calismasa da dogru baglantilari gorunur.
async function applyTelegramLink(html) {
  const { telegram, socialFooter } = await buildSeoParts();
  let sonuc = html;
  if (telegram && telegram !== 'https://t.me/SmmPanelDestek') {
    sonuc = sonuc.split('https://t.me/SmmPanelDestek').join(telegram);
  }
  if (socialFooter) {
    const acilis = '<ul class="footer-social" id="footer-social-links" aria-label="Sosyal medya profillerimiz">';
    sonuc = sonuc.replace(acilis, acilis + socialFooter);
  }
  return sonuc;
}

// Duyuru bandi sunucu tarafinda islenir: admin duyuruyu bosaltinca band
// tamamen kaldirilir. Istemci tarafinda yapilinca once eski metin gorunup
// sonra kaybolur (hem hayalet metin hem sayfa kaymasi olur).
let announcementCache = { at: 0, value: null };
async function loadAnnouncement() {
  if (Date.now() - announcementCache.at < 30000) return announcementCache.value;
  let value = null;
  try {
    const { dbAsync } = require('./config/database');
    const rows = await dbAsync.all("SELECT key, value FROM site_settings WHERE key IN ('announcement_tr', 'announcement', 'announcement_special')");
    const settings = {};
    for (const row of rows) settings[row.key] = row.value;
    const text = String(settings.announcement_tr ?? settings.announcement ?? '').trim();
    value = text ? { text, special: settings.announcement_special === '1' } : null;
  } catch { value = null; }
  announcementCache = { at: Date.now(), value };
  return value;
}
function invalidateAnnouncementCache() { announcementCache = { at: 0, value: null }; }
app.set('invalidateAnnouncementCache', invalidateAnnouncementCache);

// SEO etiketleri de onbellekleniyor. Admin dogrulama kodunu kaydedip hemen
// "Dogrula" dedigi icin beklemeden tazelenmeli; yoksa Bing/Google etiketi
// goremeyip dogrulamayi reddeder.
app.set('invalidateSeoCache', () => { seoCache = { at: 0, siteOgUrl: '', common: '', telegram: '', socialFooter: '' }; });

const ANNOUNCEMENT_BLOCK = /<div id="announcement-bar"[\s\S]*?<\/div>/;

// ----------------------------------------------------
// Kucultulmus varliklar
// index.html gelistirme kolayligi icin okunabilir css/js dosyalarina baglanir.
// Uretimde bunlarin .min surumleri gonderilir (Lighthouse "CSS'yi kucultun" /
// "JavaScript'i kucultun" uyarilari). Dosya yoksa sessizce kaynak surume
// dusulur — eksik build deploy'u kirmaz, yalnizca kazanci kaybettirir.
// Uretmek icin: npm run build
// ----------------------------------------------------
const MIN_VARLIKLAR = [
  ['/css/style.css', '/css/style.min.css'],
  ['/js/api.js', '/js/api.min.js'],
  ['/js/app.js', '/js/app.min.js']
];
const minVarlikVar = new Map(
  MIN_VARLIKLAR.map(([kaynak, kucuk]) => [kaynak, fs.existsSync(path.join(__dirname, 'public', kucuk))])
);

function useMinifiedAssets(html) {
  if (process.env.NODE_ENV !== 'production') return html;
  let sonuc = html;
  for (const [kaynak, kucuk] of MIN_VARLIKLAR) {
    if (!minVarlikVar.get(kaynak)) continue;
    sonuc = sonuc.split(`"${kaynak}?v=`).join(`"${kucuk}?v=`);
  }
  return sonuc;
}

function escapeHtmlText(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Duyuru bandinin HTML'i (duyuru bosken bos metin = band hic basilmaz).
// Hem ana SPA rotasi hem blog sayfasi ayni ciktiyi kullanir.
async function announcementHtml() {
  const announcement = await loadAnnouncement();
  if (!announcement) return '';
  return `<div id="announcement-bar"${announcement.special ? ' class="announcement-launch"' : ''}>
    <span class="announcement-star">✦</span>
    <span id="announcement-text">${escapeHtmlText(announcement.text)}</span>
    <span class="announcement-star">✦</span>
  </div>`;
}

// ----------------------------------------------------
// GEO SSR: /services fiyat tablosu ve /blog listesi yalnizca JS ile
// doluyordu; AI botlari (GPTBot, PerplexityBot...) sitenin en degerli
// verisini goremiyordu. Bu yardimcilar ayni veriyi sunucu tarafinda
// HTML'e basar — app.js yuklendiginde kendi listesiyle uzerine yazar,
// kullanicinin gordugu gorunum degismez.
// ----------------------------------------------------
let servicesSsrCache = { at: 0, rows: '', jsonLd: '', reviewsHtml: '' };
async function buildServicesSsr(base) {
  if (Date.now() - servicesSsrCache.at < 60000) return servicesSsrCache;
  let rows = '';
  let jsonLd = '';
  let reviewsHtml = '';
  try {
    const { dbAsync } = require('./config/database');
    const services = await dbAsync.all(`SELECT s.id, COALESCE(s.name_tr, s.name) name, s.rate_per_1000,
        s.min_quantity, s.max_quantity, s.refill, COALESCE(c.name_tr, c.name) category
      FROM services s JOIN categories c ON s.category_id = c.id
      WHERE s.status = 1 ORDER BY c.sort_order ASC, s.id ASC LIMIT 25`);
    rows = services.map(s => `<tr>`
      + `<td>${Number(s.id)}</td>`
      + `<td>${escapeHtmlText(s.name)}</td>`
      + `<td>₺${Number(s.rate_per_1000 || 0).toFixed(2)}</td>`
      + `<td>${Number(s.min_quantity) || 0} / ${Number(s.max_quantity) || 0}</td>`
      + `<td>${s.refill ? 'Evet' : 'Hayır'}</td><td></td></tr>`).join('');

    // Service + OfferCatalog: kategori basina en dusuk 1000 adet fiyati.
    // AI modelleri "X panelinde Instagram takipci kac para?" sorusuna bu
    // yapisal veriden yanit cikarabilir.
    const cats = await dbAsync.all(`SELECT COALESCE(c.name_tr, c.name) name, MIN(s.rate_per_1000) min_rate
      FROM services s JOIN categories c ON s.category_id = c.id
      WHERE s.status = 1 AND s.rate_per_1000 > 0 GROUP BY c.id ORDER BY c.sort_order ASC LIMIT 20`);
    if (cats.length) {
      jsonLd = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Service',
        '@id': `${base}/services#service`,
        name: 'Sosyal Medya Büyüme Hizmetleri (SMM Panel)',
        serviceType: 'Social Media Marketing',
        provider: { '@id': `${base}/#organization` },
        areaServed: 'TR',
        url: `${base}/services`,
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: 'SMM Hizmet Kataloğu',
          itemListElement: cats.map(c => ({
            '@type': 'Offer',
            itemOffered: { '@type': 'Service', name: c.name },
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              price: Number(c.min_rate).toFixed(2),
              priceCurrency: 'TRY',
              referenceQuantity: { '@type': 'QuantitativeValue', value: 1000 }
            },
            availability: 'https://schema.org/InStock'
          }))
        }
      });
    }
    // Onayli musteri yorumlari da sunucu tarafinda basilir: sosyal kanit
    // botlara ve JS'siz istemcilere gorunur (E-E-A-T sinyali).
    const yorumlar = await dbAsync.all(`
      SELECT r.rating, r.comment, r.display_name, u.username
      FROM reviews r LEFT JOIN users u ON r.user_id = u.id
      WHERE r.status = 'approved' ORDER BY r.id DESC LIMIT 24`).catch(() => []);
    // Kart yapisi app.js reviewCardHtml ile birebir ayni tutulur; JS acilinca
    // ayni gorunumun uzerine yazar, gorsel sicrama olmaz.
    reviewsHtml = yorumlar.map(y => {
      const puan = Math.max(1, Math.min(5, Number(y.rating) || 5));
      const ad = String(y.display_name || y.username || 'Müşteri').slice(0, 2) + '***';
      const basHarf = ad.slice(0, 2).toLocaleUpperCase('tr-TR');
      return `<div class="review-card">`
        + `<div class="review-top"><span class="review-quote" aria-hidden="true">“</span><span class="review-stars" aria-label="${puan}/5 yıldız">${'★'.repeat(puan)}${'☆'.repeat(5 - puan)}</span></div>`
        + `<p>${escapeHtmlText(y.comment)}</p>`
        + `<div class="review-who"><span class="review-avatar" aria-hidden="true">${escapeHtmlText(basHarf)}</span>`
        + `<span class="review-id"><strong>${escapeHtmlText(ad)}</strong><em>✓ Doğrulanmış müşteri</em></span></div></div>`;
    }).join('');
  } catch { /* DB hazir degilse tablo bos kalir, sayfa yine calisir */ }
  servicesSsrCache = { at: Date.now(), rows, jsonLd, reviewsHtml };
  return servicesSsrCache;
}
app.set('invalidateServicesSsrCache', () => { servicesSsrCache = { at: 0, rows: '', jsonLd: '', reviewsHtml: '' }; });

let blogSsrCache = { at: 0, cards: '', jsonLd: '' };
async function buildBlogSsr(base) {
  if (Date.now() - blogSsrCache.at < 60000) return blogSsrCache;
  let cards = '';
  let jsonLd = '';
  try {
    const { dbAsync } = require('./config/database');
    const posts = await dbAsync.all(`SELECT slug, published_at, created_at,
        COALESCE(title_tr, title) title,
        COALESCE(category_tr, category) category,
        COALESCE(summary_tr, summary) summary
      FROM blog_posts WHERE status = 'published' ORDER BY id DESC LIMIT 20`);
    cards = posts.map(p => `<a class="blog-card glass-card blog-card-ssr" href="/blog/${encodeURIComponent(p.slug)}">`
      + `<h2>${escapeHtmlText(p.title)}</h2>`
      + `<p>${escapeHtmlText(String(p.summary || '').slice(0, 220))}</p></a>`).join('\n');
    if (posts.length) {
      jsonLd = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Blog',
        '@id': `${base}/blog#blog`,
        name: 'Jet SMM Panel Sosyal Medya Büyüme Rehberi',
        url: `${base}/blog`,
        inLanguage: 'tr-TR',
        publisher: { '@id': `${base}/#organization` },
        blogPost: posts.map(p => ({
          '@type': 'BlogPosting',
          headline: p.title,
          url: `${base}/blog/${encodeURIComponent(p.slug)}`,
          datePublished: (p.published_at || p.created_at || '').slice(0, 10) || undefined
        }))
      });
    }
  } catch { /* DB hazir degilse liste bos kalir */ }
  blogSsrCache = { at: Date.now(), cards, jsonLd };
  return blogSsrCache;
}
app.set('invalidateBlogSsrCache', () => { blogSsrCache = { at: 0, cards: '', jsonLd: '' }; });

// SATIS SAYFALARI: alt bilgi ve hizmet listesindeki baglanti seridi her
// sayfaya sunucu tarafinda basilir (ic baglanti agi — botlar JS beklemeden
// gorur). 60 sn onbellek; admin kaydedince aninda tazelenir.
let landingLinksCache = { at: 0, footer: '', aside: '' };
async function landingLinksParts() {
  if (Date.now() - landingLinksCache.at < 60000) return landingLinksCache;
  let footer = '';
  let aside = '';
  try {
    const { dbAsync } = require('./config/database');
    const { listPublished, landingLinksHtml } = require('./utils/landingPages');
    const pages = await listPublished(dbAsync);
    footer = landingLinksHtml(pages, { variant: 'footer' });
    aside = landingLinksHtml(pages, { variant: 'aside' });
  } catch { /* DB hazir degilse serit bos kalir */ }
  landingLinksCache = { at: Date.now(), footer, aside };
  return landingLinksCache;
}
async function applyLandingLinks(html) {
  const parts = await landingLinksParts();
  return html
    .replace('<nav class="footer-links footer-links-pages" id="footer-landing-pages"></nav>',
      parts.footer ? `<nav class="footer-links footer-links-pages" id="footer-landing-pages" aria-label="Hizmet sayfaları">${parts.footer}</nav>` : '')
    // Blog listesinin sag sutunu: satis sayfalari dugme listesi.
    .replace('<aside class="blog-aside" id="blog-landing-aside"></aside>',
      parts.aside ? `<aside class="blog-aside" id="blog-landing-aside" aria-label="Hizmet sayfaları">${parts.aside}</aside>` : '');
}
app.set('invalidateLandingCache', () => { landingLinksCache = { at: 0, footer: '', aside: '' }; });

// Satis sayfasi SSR: /instagram-takipci-satin-al gibi kok adresler. Bilinen
// SPA rotalari ve sistem dosyalari yukaridaki tabloda oldugu icin buraya
// dusmez; veritabaninda yayinda bir sayfa yoksa akis 404'e (catch-all) gecer.
app.use(async (req, res, next) => {
  try {
    if (req.method !== 'GET') return next();
    const route = req.path.replace(/^\/+/, '');
    const landing = require('./utils/landingPages');
    if (!route || route.includes('/') || !landing.SLUG_RE.test(route) || landing.RESERVED_SLUGS.has(route)) return next();
    if (pageForPath(req.path).status === 200) return next();
    const { dbAsync } = require('./config/database');
    const data = await landing.fetchPage(dbAsync, route, { lang: 'tr' });
    if (!data) {
      // Taslak sayfa: blog yazilari yayindan once link vermis olabilir; 404
      // yerine gecici olarak hizmet listesine yonlendir (kirik ic link olmasin).
      const taslak = await dbAsync.get("SELECT id FROM landing_pages WHERE slug = ? AND status != 'published'", [route]).catch(() => null);
      if (taslak) return res.redirect(302, '/services');
      return next();
    }
    const { page } = data;

    dbAsync.run('UPDATE landing_pages SET views = COALESCE(views, 0) + 1 WHERE id = ?', [page.id]).catch(() => {});
    require('./services/visitorTracker').recordVisit(req).catch(() => {});

    const base = String(process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const siteRow = await dbAsync.get("SELECT value FROM site_settings WHERE key = 'site_name'").catch(() => null);
    const siteName = String(siteRow?.value || 'Jet SMM Panel').trim() || 'Jet SMM Panel';
    const pageUrl = `${base}/${encodeURIComponent(page.slug)}`;
    const aciklama = buildMetaDescription([page.seo_description, page.subtitle, page.content], `${page.title} | ${siteName}`);
    const baslik = `${page.seo_title || page.title} | ${siteName}`;
    const gorsel = page.image_url && !page.image_url.toLowerCase().endsWith('.svg')
      ? (page.image_url.startsWith('http') ? page.image_url : `${base}${page.image_url}`)
      : `${base}/og-image.png`;

    let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
    html = stripGatedMarkup(html, sessionState(req));
    html = await applyTelegramLink(html);
    html = await applyLandingLinks(html);
    html = html.split('http://localhost:3000').join(base);
    html = html.replace(ANNOUNCEMENT_BLOCK, await announcementHtml());
    const { renderFaqHtml } = require('./utils/faqContent');
    html = html.replace('<div id="landing-faq"></div>', `<div id="landing-faq">${renderFaqHtml()}</div>`);

    html = html
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeAttr(baslik)}</title>`)
      .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escapeAttr(aciklama)}">`)
      .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${pageUrl}">`)
      .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escapeAttr(baslik)}">`)
      .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escapeAttr(aciklama)}">`)
      .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${pageUrl}">`)
      .replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${escapeAttr(gorsel)}">`)
      .replace(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${escapeAttr(baslik)}">`)
      .replace(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${escapeAttr(aciklama)}">`)
      .replace(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${escapeAttr(gorsel)}">`);

    const semalar = landing.buildLandingJsonLd({ ...data, base, siteName, lang: 'tr' })
      .map(obj => `  <script type="application/ld+json">${JSON.stringify(obj)}</script>\n`).join('');
    html = html.replace('</head>', `${await buildSeoSnippet(false)}${semalar}</head>`);

    // Gorunum: ana sayfa gizlenir, satis sayfasi gorunur ve icerigi basilir.
    // data-lp-slug: app.js acilista bu sayfayi tanir ve makineyi canli veriyle hidrate eder.
    html = html
      .replace('<section id="view-landing" class="app-view neo-landing">', '<section id="view-landing" class="app-view neo-landing" style="display: none;">')
      .replace('<section id="view-landing-page" class="app-view" style="display: none;">',
        `<section id="view-landing-page" class="app-view" data-lp-slug="${escapeAttr(page.slug)}" style="display: block;">`)
      .replace('<div class="main-content lp-page" id="landing-page-root"></div>',
        `<div class="main-content lp-page" id="landing-page-root">${landing.renderLandingPageHtml({ ...data, lang: 'tr' })}</div>`);
    html = enforceSingleH1(html, 'view-landing-page');

    res.setHeader('Cache-Control', 'no-cache');
    res.type('html').send(useMinifiedAssets(html));
  } catch (err) {
    next(err);
  }
});

// Fallback SPA Route
app.use(async (req, res) => {
  try {
    // Sondaki egik cizgi 301 ile tekil bicime yonlendirilir: /services/ ve
    // /services ayni icerigi 200 ile donuyordu (canonical riski kapatiyordu
    // ama tekil adres daha temiz).
    if (req.path.length > 1 && req.path.endsWith('/')) {
      const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
      return res.redirect(301, req.path.replace(/\/+$/, '') + query);
    }

    // Her adres ayni index.html'i paylastigi icin baslik, aciklama, canonical
    // ve robots etiketleri burada adrese gore yeniden yazilir. Yapilmazsa
    // butun alt sayfalar ana sayfanin kopyasi gibi gorunur (Google bunu
    // "yinelenen icerik" + "anasayfaya canonical" olarak isaretliyordu).
    const sayfa = pageForPath(req.path);

    // Ziyaret kaydi: yalnizca gercek sayfa acilislarinda calisir (statik dosya
    // ve /api istekleri buraya dusmez). Yanit beklemez, hata firlatmaz.
    require('./services/visitorTracker').recordVisit(req).catch(() => {});

    let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');

    // Panel ici ve yonetim isaretlemesi yalnizca ilgili oturuma gonderilir.
    html = stripGatedMarkup(html, sessionState(req));

    const seo = await buildSeoParts();
    const base = String(process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
    const canonicalPath = sayfa.canonicalPath || '/';
    const mutlakAdres = base ? `${base}${canonicalPath}` : canonicalPath;

    // Canonical mutlak adrese cevrilir (goreli canonical Google'da sorun cikarir).
    html = html.replace('<link rel="canonical" href="https://jetsmmpanel.com/">', `<link rel="canonical" href="${mutlakAdres}">`);

    // Baslik ve aciklama: her adresin kendine ait olani.
    if (sayfa.title) html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtmlText(sayfa.title)}</title>`);
    if (sayfa.description) {
      const aciklama = escapeHtmlText(buildMetaDescription([sayfa.description]));
      html = html
        .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${aciklama}">`)
        .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${aciklama}">`)
        .replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${aciklama}">`);
    }
    if (sayfa.title) {
      html = html
        .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escapeHtmlText(sayfa.title)}">`)
        .replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${escapeHtmlText(sayfa.title)}">`);
    }

    // Panel ici sayfalar ve 404: bot gordugu sey bos iskelet oldugu icin
    // indekslenmemeli, yoksa "benzer yinelenen icerik" uyarisi uretirler.
    if (sayfa.noindex) html = html.replace('</head>', '  <meta name="robots" content="noindex, follow">\n</head>');

    // og:url index.html'de sabit duruyor; eklemek yerine degistiriyoruz ki
    // sayfada iki kez basilmasin (paylasim araclari cift etiketi karistirir).
    if (base) html = html.replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${mutlakAdres}">`);
    if (seo.common) html = html.replace('</head>', `${seo.common}</head>`);

    html = await applyTelegramLink(html);
    html = await applyLandingLinks(html);

    // API dokumani gelistirme kolayligi icin localhost ornekleriyle yazilir;
    // botlar JS beklemeden dogru adresi gorsun diye sunucu tarafinda cevrilir
    // (app.js ayni degisimi JS acikken zaten yapiyordu).
    if (base) html = html.split('http://localhost:3000').join(base);

    // Ana sayfa SSS bolumu: gorunen HTML ve FAQPage JSON-LD ayni kaynaktan
    // (utils/faqContent.js) uretilir. Isaretleme her istekte basilir (bolum
    // landing gorunumunun icinde), sema yalnizca ana sayfa adresinde.
    const { renderFaqHtml, faqJsonLd } = require('./utils/faqContent');
    html = html.replace('<div id="landing-faq"></div>', `<div id="landing-faq">${renderFaqHtml()}</div>`);
    if (sayfa.view === 'view-landing') {
      html = html.replace('</head>', `  <script type="application/ld+json">${faqJsonLd()}</script>\n</head>`);
    } else if (sayfa.view === 'view-services') {
      const ssr = await buildServicesSsr(base || '');
      if (ssr.rows) html = html.replace('<tbody id="full-services-tbody">', `<tbody id="full-services-tbody">${ssr.rows}`);
      if (ssr.jsonLd) html = html.replace('</head>', `  <script type="application/ld+json">${ssr.jsonLd}</script>\n</head>`);
      if (ssr.reviewsHtml) {
        html = html
          .replace('<div class="services-reviews" id="services-reviews" style="display: none;">', '<div class="services-reviews" id="services-reviews">')
          .replace(/(<div class="services-reviews-track" id="services-reviews-grid"[^>]*>)<\/div>/, `$1${ssr.reviewsHtml}</div>`);
      }
    } else if (sayfa.view === 'view-blog') {
      const ssr = await buildBlogSsr(base || '');
      if (ssr.cards) html = html.replace('<div class="blog-cards-grid" id="public-blog-cards">', `<div class="blog-cards-grid" id="public-blog-cards">${ssr.cards}`);
      if (ssr.jsonLd) html = html.replace('</head>', `  <script type="application/ld+json">${ssr.jsonLd}</script>\n</head>`);
    }

    html = html.replace(ANNOUNCEMENT_BLOCK, await announcementHtml());
    // Tek sayfalik uygulamada butun gorunumlerin h1'i ayni kaynakta durur.
    // Bu adrese ait olan disindakiler h2'ye cevrilir (arama motoru uyarisi).
    html = enforceSingleH1(html, sayfa.view);

    res.setHeader('Cache-Control', 'no-cache');
    // Var olmayan adres artik 200 degil 404 doner (soft 404 duzeltmesi).
    res.status(sayfa.status || 200).type('html').send(useMinifiedAssets(html));
  } catch {
    res.status(500).sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

app.use(errorHandler);

// Initialize DB and start server
async function startServer() {
  await initDatabase();
  return app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 SMM Panel Sunucusu Yayında!`);
    console.log(`🌐 Yerel Adres: http://localhost:${PORT}`);
    console.log(`==================================================\n`);

    // Start background order status sync worker
    startOrderWorker();
    // Webhook gecikirse/kacarsa Shopier'in siparis API'sinden mutabakat yap.
    const reconcileShopier = () => paymentsRoutes.reconcilePendingShopierPayments?.()
      .catch(err => console.error('Shopier mutabakat worker:', err.message));
    reconcileShopier();
    const shopierReconcileTimer = setInterval(reconcileShopier, 60 * 1000);
    shopierReconcileTimer.unref?.();
    // Telegram hesap eslestirme + hatirlatma e-postasi isleri
    require('./services/marketingWorker').startMarketingWorker();
  });
}

if (require.main === module) {
  startServer().catch(err => {
    console.error('Sunucu başlatılamadı:', err);
    process.exitCode = 1;
  });
}

module.exports = { app, startServer };
