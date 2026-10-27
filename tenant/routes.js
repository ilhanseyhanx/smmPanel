'use strict';

// Bayi sitesinin (vitrin) API'si. Her istekte req.tenant hazirdir (dispatcher).
// Bayinin musterisi Jet kullanicisi degildir; bu uclar yalnizca kendi
// tenant_customers kaydina ve kendi siparislerine erisir.
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const mailer = require('../services/mailer');
const { z } = require('zod');
const { dbAsync } = require('../config/database');
const { validate, bilingual } = require('../middleware/validate');
const { fromKurus } = require('../utils/money');
const { placeOrder } = require('../services/placeOrder');
const { requestRefill } = require('../services/refills');
const { tenantCatalog, tenantPriceForService, logTenantActivity } = require('../services/resellers');
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
      // Menude "Dijital Urunler" yalnizca satista urun varsa gorunur.
      digital: digitalSettings(req.tenant).enabled && (await tenantDigitalCatalog(req.tenant)).length > 0
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
    const generic = { message: 'Bu e-posta kayıtlıysa şifre sıfırlama bağlantısı gönderildi.', message_en: 'If this email is registered, a reset link has been sent.' };
    const customer = await dbAsync.get('SELECT * FROM tenant_customers WHERE tenant_id = ? AND email = ?', [req.tenant.id, req.body.email]);
    if (!customer || customer.banned) return res.json(generic);
    const token = crypto.randomBytes(32).toString('hex');
    await dbAsync.run(
      "UPDATE tenant_customers SET reset_token_hash = ?, reset_expires_at = datetime('now', '+1 hour') WHERE id = ?",
      [hashToken(token), customer.id]
    );
    const settings = tenantSettings(req.tenant);
    const link = `${req.protocol}://${req.get('host')}/sifre-sifirla?token=${token}`;
    try {
      await mailer.sendMail({
        to: customer.email,
        subject: `${req.tenant.name} şifre sıfırlama`,
        fromName: req.tenant.name,
        replyTo: settings.support_email || undefined,
        text: `Merhaba ${customer.username},\n\n${req.tenant.name} hesabının şifresini sıfırlamak için bu bağlantıyı aç (1 saat geçerli):\n${link}\n\nBu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; şifren değişmez.`
      });
    } catch (err) {
      console.error('Bayi sifre sifirlama e-postasi:', err.message);
    }
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
    res.json({ categories, services });
  } catch (err) { next(err); }
});

router.post('/orders', requireActiveTenant, requireCustomer, validate(orderSchema), async (req, res, next) => {
  try {
    const body = req.body;
    const price = await tenantPriceForService(req.tenant, body.service_id);
    if (!price?.available) {
      return res.status(400).json({ error: 'Bu servis şu anda satışta değil.', error_en: 'This service is currently unavailable.' });
    }
    const owner = await dbAsync.get(
      'SELECT id, username, role, banned, balance_kurus FROM users WHERE id = ?',
      [req.tenant.owner_user_id]
    );
    if (!owner || owner.banned) {
      return res.status(503).json({ error: 'Bu site şu anda sipariş kabul etmiyor.', error_en: 'This site is not accepting orders right now.' });
    }
    let result;
    try {
      result = await placeOrder({
        user: owner,
        serviceId: body.service_id,
        link: body.link,
        quantity: body.quantity,
        comments: body.comments,
        dripRuns: body.drip_runs,
        dripIntervalMinutes: body.drip_interval_minutes,
        termsAccepted: body.terms_accepted,
        lang: 'tr',
        tenant: {
          id: req.tenant.id,
          customerId: req.customer.id,
          sellRateKurus: price.rateKurus,
          discountPercent: price.discountPercent
        }
      });
    } catch (err) {
      // Bayinin Jet bakiyesi bitti: musteri genel mesaj gorur, bayi ve admin
      // bunu islem kaydinda gorur.
      if (err.code === 'TENANT_OWNER_BALANCE') {
        await logTenantActivity(dbAsync, {
          tenantId: req.tenant.id, actorType: 'system', action: 'owner_balance_low',
          details: { service_id: body.service_id, required: fromKurus(err.requiredKurus), owner_balance: fromKurus(owner.balance_kurus) }
        }).catch(() => {});
      }
      throw err;
    }
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
    res.json({
      orders: rows.map(row => ({
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
      })),
      page
    });
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
