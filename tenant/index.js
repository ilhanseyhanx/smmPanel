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
const { tenantForHost, tenantSettings } = require('./resolve');

const PUBLIC_DIR = path.join(__dirname, 'public');
const TEMPLATE_PATH = path.join(PUBLIC_DIR, 'index.html');
const PANEL_TEMPLATE_PATH = path.join(PUBLIC_DIR, 'panel.html');
const THEMES = new Set(['classic']);

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

function renderStorefront(tenant) {
  const settings = tenantSettings(tenant);
  const theme = THEMES.has(tenant.theme) ? tenant.theme : 'classic';
  return template()
    .replaceAll('%%SITE_NAME%%', escapeHtml(tenant.name))
    .replaceAll('%%THEME%%', theme)
    .replaceAll('%%PRIMARY%%', safeColor(settings.primary_color, '#6366f1'))
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
  app.use(express.json({ limit: '512kb' }));
  app.use(express.urlencoded({ extended: false, limit: '512kb' }));

  const rateLimitHandler = (req, res, next, options) => res.status(options.statusCode).send(options.message);
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false, handler: rateLimitHandler }));
  const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, handler: rateLimitHandler });
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  // Panel girisi ayri sayacla sinirlanir: musteri kayitlari sahibin giris
  // hakkini tuketmesin.
  app.use('/api/panel/login', rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, handler: rateLimitHandler }));
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  app.use('/api/panel', require('./panelRoutes'));
  app.use('/api', require('./routes'));
  app.use(notFoundApi);

  app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(req.tenant.status === 'active'
      ? 'User-agent: *\nAllow: /\nDisallow: /admin\n'
      : 'User-agent: *\nDisallow: /\n');
  });

  app.use('/assets', express.static(path.join(PUBLIC_DIR, 'assets'), {
    index: false,
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0
  }));

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
    res.type('html').send(renderStorefront(req.tenant));
  });

  app.use(errorHandler);
  return app;
}

const tenantApp = buildTenantApp();

function tenantDispatcher(req, res, next) {
  tenantForHost(req.headers.host).then(tenant => {
    if (!tenant) return next();
    req.tenant = tenant;
    tenantApp(req, res, err => {
      if (err) return errorHandler(err, req, res, () => {});
      res.status(404).json({ error: 'Bulunamadı.', error_en: 'Not found.' });
    });
  }).catch(next);
}

module.exports = { tenantDispatcher, renderStorefront, renderPanel, escapeHtml };
