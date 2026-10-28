'use strict';

// Bayi sitesinin (vitrin) API'si. Her istekte req.tenant hazirdir (dispatcher).
// Bayinin musterisi Jet kullanicisi degildir; bu uclar yalnizca kendi
// tenant_customers kaydina ve kendi siparislerine erisir.
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { dbAsync } = require('../config/database');
const { validate, bilingual } = require('../middleware/validate');
const { fromKurus } = require('../utils/money');
const { requestRefill } = require('../services/refills');
const { tenantCatalog, logTenantActivity } = require('../services/resellers');
const { placeTenantOrder } = require('./orders');
const tenantOwn = require('../services/tenantOwn');
const tenantContent = require('../services/tenantContent');
const tenantMail = require('../services/tenantMail');
const securityMonitor = require('../services/securityMonitor');
const { tenantSettings } = require('./resolve');
const { listPages, getPage } = require('./legalPages');
const { digitalSettings, tenantDigitalCatalog } = require('../services/tenantDigital');
const {
  signCustomerSession, setCustomerCookie, clearCustomerCookie, loadCustomer, requireCustomer
} = require('./session');

const router = express.Router();

const DUMMY_PASSWORD_HASH = bcrypt.hashSync('invalid-placeholder-password', 12);

const usernameSchema = z.string().trim()
  .min(3, bilingual('Kullanıcı adı en az 3 karakter olmalıdır.', 'Username must be at least 3 characters.'))
  .max(32, bilingual('Kullanıcı adı en fazla 32 karakter olabilir.', 'Username can be at most 32 characters.'))
  .regex(/^[a-zA-Z0-9_.-]+$/, bilingual(
    'Kullanıcı adı yalnızca İngilizce harf, rakam, nokta, tire ve alt çizgi içerebilir.',
    'Username may only contain English letters, numbers, dot, hyphen and underscore.'
  ));
const passwordSchema = z.string()
  .min(10, bilingual('Şifre en az 10 karakter olmalıdır.', 'Password must be at least 10 characters.'))
  .max(128, bilingual('Şifre en fazla 128 karakter olabilir.', 'Password can be at most 128 characters.'));

const registerSchema = z.object({
  username: usernameSchema,
  email: z.email().max(254).transform(value => value.toLowerCase()),
  password: passwordSchema
});
const loginSchema = z.object({
  username: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(128)
});
const orderSchema = z.object({
  service_id: z.coerce.number().int().positive(),
  link: z.string().trim().min(3).max(2048),
  quantity: z.coerce.number().int().positive().optional(),
  comments: z.string().max(200000).optional().default(''),
  terms_accepted: z.boolean().optional().default(false),
  drip_runs: z.coerce.number().int().min(1).max(100).default(1),
  drip_interval_minutes: z.coerce.number().int().min(5).max(10080).nullable().optional()
});

// Askiya alinmis / uyuyan bayinin sitesi islem kabul etmez.
function requireActiveTenant(req, res, next) {
  if (req.tenant.status === 'active') return next();
  res.status(503).json({
    error: 'Bu site şu anda hizmet vermiyor.',
    error_en: 'This site is currently unavailable.'
  });
}

function publicCustomer(customer) {
  return {
    id: customer.id,
    username: customer.username,
    email: customer.email,
    balance: fromKurus(customer.balance_kurus)
  };
}

function clientIp(req) {
  return securityMonitor.clientIp(req);
}

router.get('/site', async (req, res, next) => {
  try {
    const settings = tenantSettings(req.tenant);
    const customer = await loadCustomer(req);
    res.json({
      name: req.tenant.name,
      theme: req.tenant.theme,
      status: req.tenant.status,
      currency: 'TRY',
      settings: {
        primary_color: settings.primary_color || null,
        announcement: settings.announcement || null,
        support_email: settings.support_email || null,
        telegram: settings.telegram || null
      },
      customer: customer && !customer.banned ? publicCustomer(customer) : null,
      api: apiEnabled(req.tenant),
      // Pro: blog menusu ve alt bilgideki satis sayfasi baglantilari.
      blog: (await tenantContent.publishedPosts(req.tenant, 'blog', 1)).length > 0,
      landing_pages: (await tenantContent.publishedPosts(req.tenant, 'page', 12)).map(p => ({ slug: p.slug, title: p.title })),
      // Menude "Dijital Urunler" yalnizca satista urun varsa gorunur.
      digital: digitalSettings(req.tenant).enabled && ((await tenantDigitalCatalog(req.tenant)).length > 0
        || (await require('../services/tenantOwnDigital').ownProducts(req.tenant)).length > 0)
    });
  } catch (err) { next(err); }
});

router.post('/auth/register', requireActiveTenant, validate(registerSchema), async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    const exists = await dbAsync.get(
      'SELECT username, email FROM tenant_customers WHERE tenant_id = ? AND (lower(username) = lower(?) OR email = ?)',
      [req.tenant.id, username, email]
    );
    if (exists) {
      const sameName = exists.username.toLowerCase() === username.toLowerCase();
      return res.status(409).json(sameName
        ? { error: 'Bu kullanıcı adı alınmış.', error_en: 'This username is taken.', field: 'username' }
        : { error: 'Bu e-posta adresiyle zaten bir hesap var.', error_en: 'An account with this email already exists.', field: 'email' });
    }
    const hash = await bcrypt.hash(password, 12);
    const created = await dbAsync.run(
      `INSERT INTO tenant_customers (tenant_id, username, email, password, last_login_at, last_login_ip)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
      [req.tenant.id, username, email, hash, clientIp(req)]
    );
    const customer = await dbAsync.get('SELECT * FROM tenant_customers WHERE id = ?', [created.id]);
    await logTenantActivity(dbAsync, {
      tenantId: req.tenant.id, actorType: 'customer', actorId: customer.id,
      action: 'customer_registered', details: { username, email }, ip: clientIp(req)
    });
    setCustomerCookie(res, signCustomerSession(req.tenant, customer));
    tenantMail.fireAndForget(tenantMail.customerWelcome(req.tenant, customer));
    res.status(201).json({ customer: publicCustomer(customer) });
  } catch (err) { next(err); }
});

router.post('/auth/login', requireActiveTenant, validate(loginSchema), async (req, res, next) => {
  try {
    const login = req.body.username;
    const customer = await dbAsync.get(
      'SELECT * FROM tenant_customers WHERE tenant_id = ? AND (lower(username) = lower(?) OR email = lower(?))',
      [req.tenant.id, login, login]
    );
    const ok = await bcrypt.compare(req.body.password, customer?.password || DUMMY_PASSWORD_HASH);
    if (!customer || !ok) {
      return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.', error_en: 'Incorrect username or password.' });
    }
    if (customer.banned) {
      return res.status(403).json({ error: 'Hesabınız askıya alınmıştır.', error_en: 'Your account has been suspended.' });
    }
    await dbAsync.run(
      'UPDATE tenant_customers SET last_login_at = CURRENT_TIMESTAMP, last_login_ip = ? WHERE id = ?',
      [clientIp(req), customer.id]
    );
    await logTenantActivity(dbAsync, {
      tenantId: req.tenant.id, actorType: 'customer', actorId: customer.id,
      action: 'customer_login', ip: clientIp(req)
    });
    setCustomerCookie(res, signCustomerSession(req.tenant, customer));
    res.json({ customer: publicCustomer(customer) });
  } catch (err) { next(err); }
});

// Sifre sifirlama: yanit her zaman aynidir (hangi e-postanin kayitli oldugu
// disari sizmaz). Jeton 1 saat gecerli; veritabaninda yalnizca ozeti durur.
const forgotSchema = z.object({ email: z.email().max(254).transform(value => value.toLowerCase()) });
const resetSchema = z.object({ token: z.string().trim().min(20).max(200), password: passwordSchema });
const hashToken = token => crypto.createHash('sha256').update(String(token)).digest('hex');

router.post('/auth/forgot', requireActiveTenant, validate(forgotSchema), async (req, res, next) => {
  try {
    const settings = tenantSettings(req.tenant);
    // Bayinin kendi SMTP'si yoksa e-posta gonderilmez (Jet'in sunucusundan
    // musteriye e-posta gitmez); yanit her e-posta icin aynidir.
    if (!(await tenantMail.customerMailReady(req.tenant.id))) {
      const contact = [settings.support_email, settings.telegram].filter(Boolean).join(' · ');
      return res.status(409).json({
        error: `Bu site şu anda e-posta gönderemiyor. Şifreni sıfırlamak için site yöneticisine ulaş${contact ? `: ${contact}` : '.'}`,
        error_en: 'This site cannot send email right now. Please contact the site administrator to reset your password.'
      });
    }
    const generic = { message: 'Bu e-posta kayıtlıysa şifre sıfırlama bağlantısı gönderildi.', message_en: 'If this email is registered, a reset link has been sent.' };
    const customer = await dbAsync.get('SELECT * FROM tenant_customers WHERE tenant_id = ? AND email = ?', [req.tenant.id, req.body.email]);
    if (!customer || customer.banned) return res.json(generic);
    const token = crypto.randomBytes(32).toString('hex');
    await dbAsync.run(
      "UPDATE tenant_customers SET reset_token_hash = ?, reset_expires_at = datetime('now', '+1 hour') WHERE id = ?",
      [hashToken(token), customer.id]
    );
    const link = `${req.protocol}://${req.get('host')}/sifre-sifirla?token=${token}`;
    await tenantMail.sendCustomerMail(req.tenant, {
      kind: 'password_reset',
      to: customer.email,
      subject: `${req.tenant.name} şifre sıfırlama`,
      text: `Merhaba ${customer.username},\n\n${req.tenant.name} hesabının şifresini sıfırlamak için bu bağlantıyı aç (1 saat geçerli):\n${link}\n\nBu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; şifren değişmez.\n\n— ${req.tenant.name}`
    });
    await logTenantActivity(dbAsync, {
      tenantId: req.tenant.id, actorType: 'customer', actorId: customer.id, action: 'password_reset_requested', ip: clientIp(req)
    });
    res.json(generic);
  } catch (err) { next(err); }
});

router.post('/auth/reset', requireActiveTenant, validate(resetSchema), async (req, res, next) => {
  try {
    const customer = await dbAsync.get(
      "SELECT id, banned FROM tenant_customers WHERE tenant_id = ? AND reset_token_hash = ? AND reset_expires_at > datetime('now')",
      [req.tenant.id, hashToken(req.body.token)]
    );
    if (!customer || customer.banned) {
      return res.status(400).json({ error: 'Bağlantının süresi dolmuş ya da geçersiz. Yeniden şifre sıfırlama iste.', error_en: 'This link is invalid or has expired. Request a new one.' });
    }
    const hash = await bcrypt.hash(req.body.password, 12);
    // token_version artar: eski oturumlar kapanir.
    await dbAsync.run(
      'UPDATE tenant_customers SET password = ?, reset_token_hash = NULL, reset_expires_at = NULL, token_version = token_version + 1 WHERE id = ?',
      [hash, customer.id]
    );
    await logTenantActivity(dbAsync, {
      tenantId: req.tenant.id, actorType: 'customer', actorId: customer.id, action: 'password_reset_done', ip: clientIp(req)
    });
    clearCustomerCookie(res);
    res.json({ message: 'Şifren değişti. Yeni şifrenle giriş yapabilirsin.', message_en: 'Your password has been changed. You can sign in now.' });
  } catch (err) { next(err); }
});

router.post('/auth/logout', (req, res) => {
  clearCustomerCookie(res);
  res.json({ ok: true });
});

router.get('/auth/me', requireCustomer, (req, res) => {
  res.json({ customer: publicCustomer(req.customer) });
});

// Musteri API anahtari (bayi.com/api/v2, tenant/apiRoutes.js). Bayi API'yi
// kapattiysa anahtar gosterilmez ve uretilmez.
function apiEnabled(tenant) {
  return tenantSettings(tenant).api_enabled !== false;
}

router.get('/account/api-key', requireCustomer, (req, res) => {
  if (!apiEnabled(req.tenant)) return res.status(404).json({ error: 'Bu sitede API kapalı.', error_en: 'API is disabled on this site.' });
  res.json({ key: req.customer.api_key || null });
});

router.post('/account/api-key', requireActiveTenant, requireCustomer, async (req, res, next) => {
  try {
    if (!apiEnabled(req.tenant)) return res.status(404).json({ error: 'Bu sitede API kapalı.', error_en: 'API is disabled on this site.' });
    const key = crypto.randomBytes(24).toString('hex');
    await dbAsync.run('UPDATE tenant_customers SET api_key = ? WHERE id = ?', [key, req.customer.id]);
    await logTenantActivity(dbAsync, {
      tenantId: req.tenant.id, actorType: 'customer', actorId: req.customer.id, action: 'api_key_created', ip: clientIp(req)
    });
    res.json({ key, message: 'Yeni API anahtarın oluşturuldu; eskisi artık çalışmaz.' });
  } catch (err) { next(err); }
});

router.get('/services', async (req, res, next) => {
  try {
    const catalog = await tenantCatalog(req.tenant);
    const categories = [];
    const seen = new Set();
    const services = catalog.map(row => {
      if (!seen.has(row.category_id)) {
        seen.add(row.category_id);
        categories.push({ id: row.category_id, name: row.category_name || 'Diğer' });
      }
      return {
        id: row.id,
        category_id: row.category_id,
        name: row.custom_name || row.name_tr || row.name,
        description: row.description_tr || row.description || '',
        rate: fromKurus(row.price.rateKurus),
        pricing_model: row.pricing_model === 'per_item' ? 'per_item' : 'per_1000',
        order_input_type: row.order_input_type || 'link',
        min: row.min_quantity,
        max: row.max_quantity,
        refill: Number(row.refill) === 1,
        dripfeed: (row.order_input_type || 'link') === 'link',
        terms_required: Number(row.terms_required) === 1,
        start_time: row.start_time_tr || '',
        speed: row.speed_tr || ''
      };
    });
    // Pro: bayinin kendi saglayicilarindan servisler (services/tenantOwn.js).
    const ownCategories = new Map();
    for (const own of await tenantOwn.ownCatalog(req.tenant)) {
      if (!ownCategories.has(own.category)) {
        const id = tenantOwn.OWN_ID_BASE + ownCategories.size + 1;
        ownCategories.set(own.category, id);
        categories.push({ id, name: own.category });
      }
      services.push({
        id: own.id, category_id: ownCategories.get(own.category), name: own.name, description: own.description,
        rate: own.rate, pricing_model: 'per_1000', order_input_type: 'link', min: own.min, max: own.max,
        refill: false, dripfeed: false, terms_required: false, start_time: '', speed: ''
      });
    }
    res.json({ categories, services });
  } catch (err) { next(err); }
});

router.post('/orders', requireActiveTenant, requireCustomer, validate(orderSchema), async (req, res, next) => {
  try {
    const body = req.body;
    const result = tenantOwn.isOwnId(body.service_id)
      ? await tenantOwn.placeOwnOrder(req.tenant, req.customer, { serviceId: body.service_id, link: body.link, quantity: body.quantity })
      : await placeTenantOrder(req.tenant, req.customer, {
      serviceId: body.service_id,
      link: body.link,
      quantity: body.quantity,
      comments: body.comments,
      dripRuns: body.drip_runs,
      dripIntervalMinutes: body.drip_interval_minutes,
      termsAccepted: body.terms_accepted,
      lang: 'tr'
    });
    const fresh = await dbAsync.get('SELECT balance_kurus FROM tenant_customers WHERE id = ?', [req.customer.id]);
    res.status(201).json({
      message: 'Siparişiniz alındı.',
      order: {
        id: result.orderId,
        service_name: result.serviceName,
        quantity: result.quantity,
        charge: fromKurus(result.tenantChargeKurus),
        status: result.status
      },
      balance: fromKurus(fresh.balance_kurus)
    });
  } catch (err) { next(err); }
});

router.get('/orders', requireCustomer, async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page || '1', 10) || 1);
    const limit = 25;
    const rows = await dbAsync.all(
      `SELECT o.id, o.link, o.quantity, o.status, o.start_count, o.remains, o.created_at,
              o.tenant_charge_kurus, o.tenant_refunded_kurus, o.drip_runs, s.refill,
              COALESCE(NULLIF(tp.custom_name, ''), NULLIF(s.name_tr, ''), s.name) AS service_name
         FROM orders o
         JOIN services s ON s.id = o.service_id
         LEFT JOIN tenant_service_prices tp ON tp.tenant_id = o.tenant_id AND tp.service_id = o.service_id
        WHERE o.tenant_id = ? AND o.tenant_customer_id = ? AND o.status != 'failed'
        ORDER BY o.id DESC LIMIT ? OFFSET ?`,
      [req.tenant.id, req.customer.id, limit, (page - 1) * limit]
    );
    // Kendi saglayici siparisleri ilk sayfada Jet siparisleriyle birlikte, tarihe gore.
    const own = page === 1 ? (await tenantOwn.customerOwnOrders(req.tenant.id, req.customer.id, { limit })).map(tenantOwn.publicOwnOrder) : [];
    const jet = rows.map(row => ({
        id: row.id,
        service_name: row.service_name,
        link: row.link,
        quantity: row.quantity,
        status: row.status,
        start_count: row.start_count,
        remains: row.remains,
        charge: fromKurus(row.tenant_charge_kurus),
        refunded: fromKurus(row.tenant_refunded_kurus),
        refill: Number(row.refill) === 1,
        created_at: row.created_at
      }));
    const merged = own.length ? [...jet, ...own].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))) : jet;
    res.json({ orders: merged, page });
  } catch (err) { next(err); }
});

// Pro: blog ve satis sayfalari (services/tenantContent.js).
router.get('/blog', async (req, res, next) => {
  try {
    res.json({ posts: await tenantContent.publishedPosts(req.tenant, 'blog') });
  } catch (err) { next(err); }
});

router.get('/blog/:slug', async (req, res, next) => {
  try {
    const post = await tenantContent.publishedPost(req.tenant, 'blog', req.params.slug);
    if (!post) return res.status(404).json({ error: 'Yazı bulunamadı.', error_en: 'Post not found.' });
    res.json({ post });
  } catch (err) { next(err); }
});

// Satis sayfasinin bagli servisi: fiyat ve miktar siniri vitrindekiyle ayni.
async function landingService(tenant, serviceId) {
  if (!serviceId) return null;
  if (tenantOwn.isOwnId(serviceId)) {
    const own = (await tenantOwn.ownCatalog(tenant)).find(s => s.id === Number(serviceId));
    return own ? { id: own.id, name: own.name, rate: own.rate, pricing_model: 'per_1000', min: own.min, max: own.max } : null;
  }
  const row = (await tenantCatalog(tenant)).find(s => s.id === Number(serviceId));
  return row ? {
    id: row.id, name: row.custom_name || row.name_tr || row.name, rate: fromKurus(row.price.rateKurus),
    pricing_model: row.pricing_model === 'per_item' ? 'per_item' : 'per_1000', min: row.min_quantity, max: row.max_quantity
  } : null;
}

router.get('/hizmet/:slug', async (req, res, next) => {
  try {
    const page = await tenantContent.publishedPost(req.tenant, 'page', req.params.slug);
    if (!page) return res.status(404).json({ error: 'Sayfa bulunamadı.', error_en: 'Page not found.' });
    res.json({ page, service: await landingService(req.tenant, page.service_id) });
  } catch (err) { next(err); }
});

// Yasal sayfalar (alt bilgideki baglantilar). Bayi duzenlemediyse sablondan.
function siteHost(req) {
  return String(req.get('host') || '').replace(/:\d+$/, '');
}

router.get('/pages', async (req, res, next) => {
  try {
    const pages = await listPages(req.tenant, siteHost(req));
    res.json({ pages: pages.map(p => ({ slug: p.slug, title: p.title })) });
  } catch (err) { next(err); }
});

router.get('/pages/:slug', async (req, res, next) => {
  try {
    const page = await getPage(req.tenant, String(req.params.slug), siteHost(req));
    if (!page) return res.status(404).json({ error: 'Sayfa bulunamadı.', error_en: 'Page not found.' });
    res.json({ slug: page.slug, title: page.title, body: page.body });
  } catch (err) { next(err); }
});

router.post('/orders/:id/refill', requireActiveTenant, requireCustomer, async (req, res, next) => {
  try {
    const orderId = Number(req.params.id);
    if (tenantOwn.isOwnId(orderId)) return res.status(400).json({ error: 'Bu servis telafi desteklemiyor.', error_en: 'Refill is not available for this service.' });
    const order = Number.isSafeInteger(orderId) && await dbAsync.get(
      'SELECT id FROM orders WHERE id = ? AND tenant_id = ? AND tenant_customer_id = ?',
      [orderId, req.tenant.id, req.customer.id]
    );
    if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı.', error_en: 'Order not found.' });
    const result = await requestRefill({ user: { id: req.tenant.owner_user_id }, orderId });
    await logTenantActivity(dbAsync, {
      tenantId: req.tenant.id, actorType: 'customer', actorId: req.customer.id,
      action: 'refill_requested', details: { order_id: orderId, refill_id: result.refillId }, ip: clientIp(req)
    });
    res.json({ message: 'Telafi talebiniz alındı.', refill: result.refillId });
  } catch (err) { next(err); }
});

module.exports = router;
module.exports.requireActiveTenant = requireActiveTenant;
