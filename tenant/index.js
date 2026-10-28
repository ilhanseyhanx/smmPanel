'use strict';

// Bayi siteleri: ana uygulamanin EN BASINDA (helmet'ten hemen sonra) calisan
// yonlendirici. Istek bir bayinin alan adina geldiyse ana sitenin hicbir
// parcasina (statik dosyalar, SEO, blog, sitemap, admin) dokunmadan bayi
// uygulamasi cevap verir; boylece Jet markasi ve icerigi bayi sitesine sizmaz.
const fs = require('fs');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const { rateLimit } = require('express-rate-limit');
const { notFoundApi, errorHandler } = require('../middleware/errorHandler');
const { tenantForHost, tenantSettings, baseDomains, normalizeHost, isMainHost } = require('./resolve');

const PUBLIC_DIR = path.join(__dirname, 'public');
const TEMPLATE_PATH = path.join(PUBLIC_DIR, 'index.html');
const PANEL_TEMPLATE_PATH = path.join(PUBLIC_DIR, 'panel.html');
const { themeOf, fontHref, THEME_KEYS } = require('./themes');
const tenantBranding = require('../services/tenantBranding');
const demo = require('./demo');
const demoData = require('./demoData');
const { loadCustomer, signCustomerSession, setCustomerCookie } = require('./session');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Yalnizca #rgb / #rrggbb kabul edilir: stil etiketine yazildigi icin
// baska bir deger CSS enjeksiyonuna yol acabilirdi.
function safeColor(value, fallback) {
  return /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(String(value || '')) ? value : fallback;
}

const templateCache = new Map();
function template(file = TEMPLATE_PATH) {
  if (templateCache.has(file) && process.env.NODE_ENV === 'production') return templateCache.get(file);
  const html = fs.readFileSync(file, 'utf8');
  templateCache.set(file, html);
  return html;
}

// Bayi yonetim paneli (bayi.com/admin): musteri vitriniyle ayni sunucu, ayri sayfa.
function renderPanel(tenant) {
  const settings = tenantSettings(tenant);
  return template(PANEL_TEMPLATE_PATH)
    .replaceAll('%%SITE_NAME%%', escapeHtml(tenant.name))
    .replaceAll('%%PRIMARY%%', safeColor(settings.primary_color, '#6366f1'));
}

// Vurgu renginin ustundeki yazi rengi: acik renkte koyu, koyu renkte beyaz.
function onColor(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#0b0b0f' : '#ffffff';
}

const DEFAULT_HERO_TITLE = 'Sosyal medya hesaplarını [hızla büyüt]';
const DEFAULT_HERO_TEXT = 'Takipçi, beğeni, izlenme ve daha fazlası. Hesabını oluştur, bakiyeni yükle ve siparişini saniyeler içinde ver.';

// Giris basligi: [koseli parantez] icindeki kisim vurgu rengiyle yazilir.
// Once tum metin kacirilir, sonra yalnizca ilk [..] <span> olur.
function heroTitle(value) {
  return escapeHtml(value || DEFAULT_HERO_TITLE).replace(/\[([^\]]{1,80})\]/, '<span>$1</span>').replace(/[[\]]/g, '');
}

// Demo seridindeki diger demo sitelere giden adreslerin koku: "demo-gece.taban.com"
// isteginde "taban.com" (yerelde port dahil). Demo adresi degilse bos.
function demoHostSuffix(host) {
  const value = String(host || '').toLowerCase();
  const dot = value.indexOf('.');
  return dot > 0 && /^demo(-[a-z]+)?$/.test(value.slice(0, dot)) ? value.slice(dot + 1) : '';
}

function jetUrl() {
  return String(process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
}

// Pro icerigi (blog, satis sayfasi) sunucuda basilir: dogru gorunum acik
// gelir, baslik ve aciklama icerige gore yazilir (botlar JS beklemez).
// page = { view: 'blog' | 'post', title, description, html }
function applyPrerender(html, page, tenant) {
  if (!page) return html.replace('%%PRERENDER_BLOG%%', '').replace('%%PRERENDER_POST%%', '');
  const description = escapeHtml(String(page.description || '').slice(0, 300));
  return html
    .replace('<title>%%SITE_NAME%%</title>', `<title>${escapeHtml(page.title)} · ${escapeHtml(tenant.name)}</title>`)
    .replaceAll('content="%%DESCRIPTION%%"', `content="${description}"`)
    .replace('<section class="sf-view" data-view="home">', '<section class="sf-view" data-view="home" hidden>')
    .replace(`<section class="sf-view" data-view="${page.view}" hidden>`, `<section class="sf-view" data-view="${page.view}">`)
    .replace(page.view === 'blog' ? '%%PRERENDER_BLOG%%' : '%%PRERENDER_POST%%', page.html)
    .replace('%%PRERENDER_BLOG%%', '').replace('%%PRERENDER_POST%%', '');
}

function trDay(value) {
  const date = new Date(String(value || '').replace(' ', 'T') + 'Z');
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' });
}

async function contentPage(tenant, reqPath) {
  const tenantContent = require('../services/tenantContent');
  if (/^\/blog\/?$/.test(reqPath)) {
    const posts = await tenantContent.publishedPosts(tenant, 'blog');
    if (!posts.length) return null;
    return {
      view: 'blog', title: 'Blog', description: `${tenant.name} blog yazıları`,
      html: posts.map(p => `<a class="sf-card sf-blog-card" href="/blog/${escapeHtml(p.slug)}" data-nav="post">${p.cover_url ? `<img src="${escapeHtml(p.cover_url)}" alt="" loading="lazy">` : ''}<span><b>${escapeHtml(p.title)}</b><small>${escapeHtml(trDay(p.published_at))}</small><em>${escapeHtml(p.excerpt)}</em></span></a>`).join('')
    };
  }
  const match = /^\/(blog|hizmet)\/([a-z0-9-]{1,80})\/?$/.exec(reqPath);
  if (!match) return undefined;
  const post = await tenantContent.publishedPost(tenant, match[1] === 'blog' ? 'blog' : 'page', match[2]);
  if (!post) return null;
  return {
    view: 'post', title: post.title, description: post.excerpt,
    html: `<h1>${escapeHtml(post.title)}</h1>${match[1] === 'blog' ? `<p class="sf-muted sf-post-date">${escapeHtml(trDay(post.published_at))}</p>` : ''}${post.cover_url ? `<img class="sf-post-cover" src="${escapeHtml(post.cover_url)}" alt="">` : ''}${tenantContent.formatBody(post.body)}`
  };
}

// previewTheme: ?tema= ile gosterilen tema (kaydedilmez, dizine eklenmez).
// host: istegin adresi (demo seridi diger demo sitelere bu koke baglanir).
function renderStorefront(tenant, { previewTheme = null, host = '', page = null } = {}) {
  const settings = tenantSettings(tenant);
  const theme = themeOf(previewTheme || tenant.theme);
  const primary = safeColor(settings.primary_color, theme.accent);
  const font = `'${theme.font}', system-ui, -apple-system, 'Segoe UI', sans-serif`;
  return applyPrerender(template(), page, tenant)
    .replaceAll('%%SITE_NAME%%', escapeHtml(tenant.name))
    .replaceAll('%%THEME%%', theme.key)
    .replaceAll('%%LAYOUT%%', theme.layout)
    .replaceAll('%%FONT_HREF%%', escapeHtml(fontHref(theme)))
    .replaceAll('%%FONT_DISPLAY%%', theme.display ? `'${theme.display}', ${font}` : font)
    .replaceAll('%%FONT%%', font)
    .replaceAll('%%ROBOTS%%', previewTheme || settings.demo ? '\n  <meta name="robots" content="noindex">' : '')
    .replaceAll('%%FAVICON%%', settings.favicon_type ? `/brand/favicon?v=${escapeHtml(settings.favicon_v || '1')}` : 'data:,')
    .replaceAll('%%BRAND_MARK%%', settings.logo_type
      ? `<img class="sf-brand-logo" src="/brand/logo?v=${escapeHtml(settings.logo_v || '1')}" alt="">`
      : '<span class="sf-brand-mark"><i class="fa-solid fa-bolt" aria-hidden="true"></i></span>')
    .replaceAll('%%BRAND_NAME_CLASS%%', settings.logo_type && settings.hide_name ? 'sf-brand-name sf-sr-only' : 'sf-brand-name')
    .replaceAll('%%HERO_TITLE%%', heroTitle(settings.hero_title))
    .replaceAll('%%HERO_TEXT%%', escapeHtml(settings.hero_text || DEFAULT_HERO_TEXT))
    .replaceAll('%%FOOTER_TEXT%%', settings.footer_text ? `<span class="sf-footer-text">${escapeHtml(settings.footer_text)}</span>` : '')
    .replaceAll('%%DEMO_BANNER%%', settings.demo ? demo.demoBar({ currentKey: settings.demo_site || null, hostSuffix: demoHostSuffix(host), jetUrl: jetUrl() }) : '')
    .replace('--primary: %%PRIMARY%%;', `--primary: ${primary}; --on-primary: ${onColor(primary)};`)
    .replaceAll('%%PRIMARY%%', primary)
    .replaceAll('%%DESCRIPTION%%', escapeHtml(settings.description || `${tenant.name} — sosyal medya hizmetleri paneli`));
}

function unavailablePage(tenant) {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${escapeHtml(tenant.name)}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0}
main{text-align:center;padding:24px}h1{font-size:1.4rem;margin:0 0 8px}p{color:#94a3b8;margin:0}</style></head>
<body><main><h1>${escapeHtml(tenant.name)}</h1><p>Site şu anda bakımda. Lütfen daha sonra tekrar deneyin.</p></main></body></html>`;
}

function buildTenantApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(cookieParser());
  app.use(compression());
  // Shopier bildirimi imzayi ham govde uzerinden dogrular.
  app.use(express.json({
    limit: '512kb',
    verify: (req, res, buf) => { if (req.url.startsWith('/api/payments/shopier/webhook')) req.rawBody = buf; }
  }));
  app.use(express.urlencoded({ extended: false, limit: '512kb' }));

  const rateLimitHandler = (req, res, next, options) => res.status(options.statusCode).send(options.message);
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false, handler: rateLimitHandler }));
  const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, handler: rateLimitHandler });
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/api/auth/forgot', authLimiter);
  app.use('/api/auth/reset', authLimiter);
  // Panel girisi ayri sayacla sinirlanir: musteri kayitlari sahibin giris
  // hakkini tuketmesin.
  app.use('/api/panel/login', rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, handler: rateLimitHandler }));
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  // Demo bayi (tenant/demo.js): hicbir yazma istegi calismaz (cikis haric).
  app.use('/api', (req, res, next) => {
    if (req.method === 'GET' || !tenantSettings(req.tenant).demo || req.path === '/auth/logout') return next();
    if (req.path.startsWith('/panel')) {
      return res.status(403).json({ error: 'Bu bir demo panel; gezebilirsin ama değişiklikler kaydedilmez.', error_en: 'This is a demo panel; changes are not saved.' });
    }
    res.status(403).json({ error: 'Bu bir demo site; kayıt, sipariş ve ödeme kapalı.', error_en: 'This is a demo site; sign-up, orders and payments are disabled.' });
  });
  // Demo musterisinin siparis ve yukleme listeleri ornek veridir.
  app.get(['/api/orders', '/api/payments/history', '/api/payments/methods'], async (req, res, next) => {
    try {
      if (!tenantSettings(req.tenant).demo || !(await loadCustomer(req))) return next();
      const coins = Object.entries(require('../services/nowpayments').SUPPORTED_COINS)
        .map(([code, c]) => ({ code, label: c.label, network: c.network, recommended: Boolean(c.recommended) }));
      const body = demoData.storefrontResponse(req.path.slice(4), coins);
      return body ? res.json(body) : next();
    } catch (err) { next(err); }
  });

  app.use('/api/panel', require('./panelRoutes'));
  app.use('/api/payments', require('./paymentRoutes'));
  app.use('/api/digital', require('./digitalRoutes'));
  app.use('/api/v2', require('./apiRoutes'));
  app.use('/api', require('./routes'));
  app.use(notFoundApi);

  app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(req.tenant.status === 'active' && !tenantSettings(req.tenant).demo
      ? `User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${req.protocol}://${req.get('host')}/sitemap.xml\n`
      : 'User-agent: *\nDisallow: /\n');
  });

  // Bayinin site haritasi: ana sayfa, servisler, dijital urunler, yasal
  // sayfalar ve (Pro) blog yazilari ile satis sayfalari.
  app.get('/sitemap.xml', async (req, res, next) => {
    try {
      if (req.tenant.status !== 'active' || tenantSettings(req.tenant).demo) return res.status(404).end();
      const tenantContent = require('../services/tenantContent');
      const base = `${req.protocol}://${req.get('host')}`;
      const urls = ['/', '/services'];
      const { digitalSettings, tenantDigitalCatalog } = require('../services/tenantDigital');
      if (digitalSettings(req.tenant).enabled && (await tenantDigitalCatalog(req.tenant)).length) urls.push('/dijital');
      const blog = await tenantContent.publishedPosts(req.tenant, 'blog', 1000);
      if (blog.length) urls.push('/blog', ...blog.map(p => `/blog/${p.slug}`));
      urls.push(...(await tenantContent.publishedPosts(req.tenant, 'page', 1000)).map(p => `/hizmet/${p.slug}`));
      const { listPages } = require('./legalPages');
      urls.push(...(await listPages(req.tenant, String(req.get('host') || '').replace(/:\d+$/, ''))).map(p => `/sayfa/${p.slug}`));
      res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${escapeHtml(base + u)}</loc></url>`).join('\n')}\n</urlset>\n`);
    } catch (err) { next(err); }
  });

  // Dijital urun kart gorselleri (Jet'in galerisi; marka icermez).
  app.use('/dijital-gorseller', express.static(path.join(__dirname, '..', 'public', 'dijital-gorseller'), {
    index: false,
    maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0
  }));

  app.use('/assets', express.static(path.join(PUBLIC_DIR, 'assets'), {
    index: false,
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0
  }));

  // Bayinin logosu ve sekme simgesi (services/tenantBranding.js).
  app.get('/brand/:kind', (req, res) => {
    const kind = req.params.kind;
    const type = tenantSettings(req.tenant)[`${kind}_type`];
    const file = type && tenantBranding.assetPath(req.tenant.id, kind, type);
    if (!file) return res.status(404).end();
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.type(tenantBranding.MIME[type]).sendFile(file, err => { if (err && !res.headersSent) res.status(404).end(); });
  });

  // Demo: "Musteri gozuyle" - sifresiz demo musteri hesabiyla giris.
  app.get('/demo/musteri', async (req, res, next) => {
    try {
      if (!tenantSettings(req.tenant).demo) return next();
      const { SHOPPER_USERNAME } = require('../services/demoTenant');
      const customer = await require('../config/database').dbAsync.get(
        'SELECT id, token_version FROM tenant_customers WHERE tenant_id = ? AND username = ?', [req.tenant.id, SHOPPER_USERNAME]);
      if (!customer) return res.redirect(302, '/');
      setCustomerCookie(res, signCustomerSession(req.tenant, customer));
      res.setHeader('Cache-Control', 'no-store');
      res.redirect(302, '/order');
    } catch (err) { next(err); }
  });

  // Yonetim paneli askidaki bayide de acilir: sahip durumu ve sebebi gorur.
  app.get(['/admin', /^\/admin\/.*/], (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.type('html').send(renderPanel(req.tenant));
  });

  // Vitrin tek sayfa uygulamasidir: bilinmeyen her adres ayni HTML'i alir.
  app.get(/.*/, async (req, res, next) => {
    try {
      res.setHeader('Cache-Control', 'no-cache');
      if (req.tenant.status !== 'active') {
        return res.status(503).type('html').send(unavailablePage(req.tenant));
      }
      const tema = String(req.query.tema || '');
      // null: blog/satis sayfasi adresi ama icerik yok -> 404 (vitrin "bulunamadi" der).
      const page = await contentPage(req.tenant, req.path);
      if (page === null) res.status(404);
      res.type('html').send(renderStorefront(req.tenant, { previewTheme: THEME_KEYS.includes(tema) ? tema : null, host: req.headers.host, page: page || null }));
    } catch (err) { next(err); }
  });

  app.use(errorHandler);
  return app;
}

const tenantApp = buildTenantApp();

// Taban alan adinin bayisi olmayan alt adresi (rastgele.taban.com): Jet sitesi
// ACILMAZ; markasiz bir "bulunamadi" sayfasi doner ve dizine eklenmez.
function unknownSubdomainPage() {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Site bulunamadı</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0}
main{text-align:center;padding:24px}h1{font-size:1.4rem;margin:0 0 8px}p{color:#94a3b8;margin:0}</style></head>
<body><main><h1>Site bulunamadı</h1><p>Bu adreste yayında bir site yok.</p></main></body></html>`;
}

function isBaseSubdomain(rawHost) {
  const host = normalizeHost(rawHost);
  return Boolean(host && !isMainHost(host) && baseDomains().some(base => host !== base && host.endsWith(`.${base}`)));
}

// Deneme bittikten sonra (28 Eki 2026 karari) site yalnizca bayinin kendi
// alan adinda acilir. Taban alt adreste (slug.jetsmmpanel.com) yonetim paneli
// ve odeme bildirimleri calismaya devam eder; vitrin kendi alan adina
// yonlenir, alan adi yoksa kapali sayfasi gorunur. Jet'in ucretsiz verdigi
// (comp) paneller ve demo bu kurala tabi degildir.
const OWN_DOMAIN_PLANS = new Set(['active', 'past_due', 'expired']);
const BASE_ALWAYS_OPEN = /^\/(admin(\/.*)?|api\/panel(\/.*)?|api\/payments\/(paytr\/callback|shopier\/webhook|nowpayments\/callback)|assets\/.*|brand\/.*|dijital-gorseller\/.*|robots\.txt)$/;

function needsOwnDomain(tenant) {
  return tenant.via === 'base' && OWN_DOMAIN_PLANS.has(tenant.plan_status) && !tenantSettings(tenant).demo;
}

function movedPage(tenant) {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${escapeHtml(tenant.name)}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0}
main{text-align:center;padding:24px}h1{font-size:1.4rem;margin:0 0 8px}p{color:#94a3b8;margin:0}</style></head>
<body><main><h1>${escapeHtml(tenant.name)}</h1><p>Bu site şu anda bu adreste hizmet vermiyor.</p></main></body></html>`;
}

function ownDomainGate(req, res, tenant) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (tenant.primary_domain && (req.method === 'GET' || req.method === 'HEAD')) {
    return res.redirect(301, `https://${tenant.primary_domain}${req.originalUrl}`);
  }
  if (req.path.startsWith('/api/')) {
    return res.status(403).json({ error: 'Bu site artık bu adreste hizmet vermiyor.', error_en: 'This site is no longer served at this address.' });
  }
  res.status(503).type('html').send(movedPage(tenant));
}

function tenantDispatcher(req, res, next) {
  tenantForHost(req.headers.host).then(tenant => {
    if (!tenant) {
      // X-Bayi-Custom: nginx'in bayi alan adlari icin varsayilan blogu ekler
      // (Cloudflare for SaaS). Ana site adresinde etkisizdir.
      const customDomain = req.headers['x-bayi-custom'] === '1' && !isMainHost(normalizeHost(req.headers.host));
      if (!isBaseSubdomain(req.headers.host) && !customDomain) return next();
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      return res.status(404).type('html').send(unknownSubdomainPage());
    }
    if (needsOwnDomain(tenant) && !BASE_ALWAYS_OPEN.test(req.path)) return ownDomainGate(req, res, tenant);
    req.tenant = tenant;
    tenantApp(req, res, err => {
      if (err) return errorHandler(err, req, res, () => {});
      res.status(404).json({ error: 'Bulunamadı.', error_en: 'Not found.' });
    });
  }).catch(next);
}

module.exports = { tenantDispatcher, renderStorefront, renderPanel, escapeHtml, onColor };
