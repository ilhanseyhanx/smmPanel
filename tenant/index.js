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
const { tenantForHost, tenantSettings, baseDomain, normalizeHost, isMainHost } = require('./resolve');

const PUBLIC_DIR = path.join(__dirname, 'public');
const TEMPLATE_PATH = path.join(PUBLIC_DIR, 'index.html');
const PANEL_TEMPLATE_PATH = path.join(PUBLIC_DIR, 'panel.html');
const { themeOf, fontHref, THEME_KEYS } = require('./themes');
const tenantBranding = require('../services/tenantBranding');

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

// Demo site: ustte tema degistirici serit (yalnizca demo bayide).
function demoBanner(current) {
  const links = THEME_KEYS.map(key => `<a href="/?tema=${key}"${key === current ? ' class="active" aria-current="true"' : ''}>${escapeHtml(themeOf(key).name)}</a>`).join('');
  return `  <div class="sf-demo-bar"><strong>Demo site · temaları dene:</strong>${links}</div>`;
}

// previewTheme: ?tema= ile gosterilen tema (kaydedilmez, dizine eklenmez).
function renderStorefront(tenant, { previewTheme = null } = {}) {
  const settings = tenantSettings(tenant);
  const theme = themeOf(previewTheme || tenant.theme);
  const primary = safeColor(settings.primary_color, theme.accent);
  const font = `'${theme.font}', system-ui, -apple-system, 'Segoe UI', sans-serif`;
  return template()
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
    .replaceAll('%%DEMO_BANNER%%', settings.demo ? demoBanner(theme.key) : '')
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
  // Demo bayi (Jet'in tema vitrini): kayit, giris, siparis ve odeme kapali.
  app.use('/api', (req, res, next) => {
    if (req.method === 'GET' || req.path.startsWith('/panel') || !tenantSettings(req.tenant).demo) return next();
    res.status(403).json({ error: 'Bu bir demo site; kayıt, giriş ve sipariş kapalı.', error_en: 'This is a demo site; sign-up and orders are disabled.' });
  });

  app.use('/api/panel', require('./panelRoutes'));
  app.use('/api/payments', require('./paymentRoutes'));
  app.use('/api/digital', require('./digitalRoutes'));
  app.use('/api', require('./routes'));
  app.use(notFoundApi);

  app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(req.tenant.status === 'active' && !tenantSettings(req.tenant).demo
      ? 'User-agent: *\nAllow: /\nDisallow: /admin\n'
      : 'User-agent: *\nDisallow: /\n');
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

  // Yonetim paneli askidaki bayide de acilir: sahip durumu ve sebebi gorur.
  app.get(['/admin', /^\/admin\/.*/], (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.type('html').send(renderPanel(req.tenant));
  });

  // Vitrin tek sayfa uygulamasidir: bilinmeyen her adres ayni HTML'i alir.
  app.get(/.*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    if (req.tenant.status !== 'active') {
      return res.status(503).type('html').send(unavailablePage(req.tenant));
    }
    const tema = String(req.query.tema || '');
    res.type('html').send(renderStorefront(req.tenant, { previewTheme: THEME_KEYS.includes(tema) ? tema : null }));
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
  const base = baseDomain();
  const host = normalizeHost(rawHost);
  return Boolean(base && host && host !== base && host.endsWith(`.${base}`) && !isMainHost(host));
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
    req.tenant = tenant;
    tenantApp(req, res, err => {
      if (err) return errorHandler(err, req, res, () => {});
      res.status(404).json({ error: 'Bulunamadı.', error_en: 'Not found.' });
    });
  }).catch(next);
}

module.exports = { tenantDispatcher, renderStorefront, renderPanel, escapeHtml, onColor };
