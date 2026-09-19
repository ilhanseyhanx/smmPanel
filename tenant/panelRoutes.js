'use strict';

// Bayi yonetim paneli API'si (bayi.com/admin arayuzu bunu kullanir).
// Yalnizca bayinin sahibi girer (panelSession.requireOwner). Sahip yalnizca
// KENDI bayisinin verisine erisir: her sorgu req.tenant.id ile sinirlidir.
// Yaptigi her degisiklik bayi islem kaydina (Jet admini de gorur) yazilir.
const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { verify } = require('otplib');
const { dbAsync, withTransaction } = require('../config/database');
const { validate } = require('../middleware/validate');
const { normalizePlainText, decryptSecret } = require('../utils/security');
const { fromKurus, toKurus } = require('../utils/money');
const securityMonitor = require('../services/securityMonitor');
const {
  getResellerSettings, effectiveDiscountPercent, tenantCatalog, logTenantActivity, changeCustomerBalance
} = require('../services/resellers');
const { invalidateTenantCache, tenantSettings, baseDomain } = require('./resolve');
const { signOwnerSession, setOwnerCookie, clearOwnerCookie, requireOwner } = require('./panelSession');

const router = express.Router();
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('invalid-placeholder-password', 12);

const loginSchema = z.object({
  username: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(128),
  totp: z.string().regex(/^\d{6}$/).optional()
});
const markupField = z.coerce.number().finite().min(0).max(1000);
const servicePriceSchema = z.object({
  enabled: z.boolean().optional(),
  markup_percent: markupField.nullable().optional(),
  fixed_price: z.coerce.number().finite().min(0).max(10_000_000).nullable().optional(),
  custom_name: z.string().trim().max(160).nullable().optional()
});
const bulkSchema = z.object({
  service_ids: z.array(z.coerce.number().int().positive()).min(1).max(5000),
  action: z.enum(['enable', 'disable', 'markup', 'reset']),
  markup_percent: markupField.optional()
});
const pricingSchema = z.object({ default_markup_percent: markupField });
const balanceSchema = z.object({
  amount: z.coerce.number().finite().positive().max(1_000_000),
  action: z.enum(['add', 'subtract']),
  note: z.string().trim().max(300).optional().default('')
});
const banSchema = z.object({ banned: z.boolean() });
const siteSchema = z.object({
  name: z.string().trim().min(2).max(60),
  primary_color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional().default('#6366f1'),
  description: z.string().trim().max(300).optional().default(''),
  announcement: z.string().trim().max(300).optional().default(''),
  support_email: z.union([z.literal(''), z.email().max(254)]).optional().default(''),
  telegram: z.string().trim().max(100).optional().default('')
});

function ip(req) {
  return securityMonitor.clientIp(req);
}

function ownerActivity(req, action, details) {
  return logTenantActivity(dbAsync, {
    tenantId: req.tenant.id, actorType: 'owner', actorId: req.owner.id, action, details, ip: ip(req)
  });
}

function idParam(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function jetTopUpUrl() {
  const base = String(process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  return base ? `${base}/add-funds` : null;
}

// ------------------------------------------------------------------- giris
router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const login = req.body.username;
    const user = await dbAsync.get(
      'SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE',
      [login, login.toLowerCase()]
    );
    const passwordOk = await bcrypt.compare(req.body.password, user?.password || DUMMY_PASSWORD_HASH);
    // Kullanici var ama bu bayinin sahibi degilse de ayni mesaj: panel,
    // hangi Jet hesaplarinin var oldugunu disari sizdirmaz.
    if (!user || !passwordOk || Number(user.id) !== Number(req.tenant.owner_user_id)) {
      securityMonitor.logEvent('failed_login', req, { username: login, detail: `Bayi paneli girişi (#${req.tenant.id})` });
      return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.', error_en: 'Incorrect username or password.' });
    }
    if (user.banned) {
      return res.status(403).json({ error: 'Hesabınız askıya alınmıştır.', error_en: 'Your account has been suspended.' });
    }
    if (user.two_factor_enabled) {
      if (!req.body.totp) {
        return res.status(401).json({
          error: 'İki adımlı doğrulama kodu gerekli.', error_en: 'Two-factor code required.', code: 'TWO_FACTOR_REQUIRED'
        });
      }
      if (!(await verify({ token: req.body.totp, secret: decryptSecret(user.two_factor_secret) })).valid) {
        securityMonitor.logEvent('failed_login', req, { username: user.username, detail: 'Bayi paneli: geçersiz 2FA' });
        return res.status(401).json({ error: 'Doğrulama kodu geçersiz.', error_en: 'Invalid verification code.' });
      }
    }
    setOwnerCookie(res, signOwnerSession(req.tenant, user));
    req.owner = user;
    await ownerActivity(req, 'owner_login');
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/logout', (req, res) => {
  clearOwnerCookie(res);
  res.json({ ok: true });
});

router.use(requireOwner);

router.get('/me', async (req, res, next) => {
  try {
    const settings = await getResellerSettings();
    const base = baseDomain();
    const domains = await dbAsync.all("SELECT domain, status FROM tenant_domains WHERE tenant_id = ? ORDER BY id", [req.tenant.id]);
    res.json({
      owner: { username: req.owner.username, balance: fromKurus(req.owner.balance_kurus) },
      tenant: {
        name: req.tenant.name,
        slug: req.tenant.slug,
        status: req.tenant.status,
        status_reason: req.tenant.status_reason,
        discount_percent: effectiveDiscountPercent(req.tenant, settings),
        default_markup_percent: req.tenant.default_markup_percent,
        subdomain: base ? `${req.tenant.slug}.${base}` : null,
        domains
      },
      top_up_url: jetTopUpUrl()
    });
  } catch (err) { next(err); }
});

// ------------------------------------------------------------------- ozet
router.get('/dashboard', async (req, res, next) => {
  try {
    const t = req.tenant.id;
    const [totals, last30, today, customers, recent, lowBalance] = await Promise.all([
      dbAsync.get(
        `SELECT COUNT(*) AS orders,
                COALESCE(SUM(tenant_charge_kurus - tenant_refunded_kurus), 0) AS revenue,
                COALESCE(SUM(charge_kurus - refunded_kurus), 0) AS cost,
                SUM(CASE WHEN status IN ('pending', 'processing') THEN 1 ELSE 0 END) AS active
           FROM orders WHERE tenant_id = ? AND status != 'failed'`, [t]),
      dbAsync.get(
        `SELECT COUNT(*) AS orders,
                COALESCE(SUM(tenant_charge_kurus - tenant_refunded_kurus), 0) AS revenue,
                COALESCE(SUM(charge_kurus - refunded_kurus), 0) AS cost
           FROM orders WHERE tenant_id = ? AND status != 'failed' AND created_at >= datetime('now', '-30 days')`, [t]),
      dbAsync.get(
        `SELECT COUNT(*) AS orders,
                COALESCE(SUM(tenant_charge_kurus - tenant_refunded_kurus), 0) AS revenue,
                COALESCE(SUM(charge_kurus - refunded_kurus), 0) AS cost
           FROM orders WHERE tenant_id = ? AND status != 'failed' AND date(created_at) = date('now')`, [t]),
      dbAsync.get(
        `SELECT COUNT(*) AS total, COALESCE(SUM(balance_kurus), 0) AS balance,
                SUM(CASE WHEN created_at >= datetime('now', '-30 days') THEN 1 ELSE 0 END) AS new_30d
           FROM tenant_customers WHERE tenant_id = ?`, [t]),
      dbAsync.all(
        `SELECT o.id, o.quantity, o.status, o.created_at, o.tenant_charge_kurus, o.tenant_refunded_kurus,
                c.username AS customer, COALESCE(NULLIF(tp.custom_name, ''), NULLIF(s.name_tr, ''), s.name) AS service_name
           FROM orders o
           LEFT JOIN tenant_customers c ON c.id = o.tenant_customer_id
           LEFT JOIN services s ON s.id = o.service_id
           LEFT JOIN tenant_service_prices tp ON tp.tenant_id = o.tenant_id AND tp.service_id = o.service_id
          WHERE o.tenant_id = ? AND o.status != 'failed' ORDER BY o.id DESC LIMIT 8`, [t]),
      dbAsync.get(
        `SELECT COUNT(*) AS n FROM tenant_activity_logs
          WHERE tenant_id = ? AND action = 'owner_balance_low' AND created_at >= datetime('now', '-7 days')`, [t])
    ]);
    const money = row => ({
      orders: row.orders || 0,
      revenue: fromKurus(row.revenue),
      cost: fromKurus(row.cost),
      profit: fromKurus(row.revenue - row.cost)
    });
    res.json({
      owner_balance: fromKurus(req.owner.balance_kurus),
      failed_for_balance_7d: lowBalance.n,
      totals: { ...money(totals), active: totals.active || 0 },
      last_30d: money(last30),
      today: money(today),
      customers: { total: customers.total, new_30d: customers.new_30d || 0, balance: fromKurus(customers.balance) },
      recent_orders: recent.map(o => ({
        id: o.id,
        customer: o.customer,
        service_name: o.service_name,
        quantity: o.quantity,
        status: o.status,
        charge: fromKurus(o.tenant_charge_kurus - o.tenant_refunded_kurus),
        created_at: o.created_at
      }))
    });
  } catch (err) { next(err); }
});

// ------------------------------------------------------ servisler & fiyatlar
router.get('/services', async (req, res, next) => {
  try {
    const catalog = await tenantCatalog(req.tenant, { includeHidden: true });
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
        name: row.name_tr || row.name,
        custom_name: row.custom_name || null,
        pricing_model: row.pricing_model === 'per_item' ? 'per_item' : 'per_1000',
        min: row.min_quantity,
        max: row.max_quantity,
        refill: Number(row.refill) === 1,
        cost: fromKurus(row.price.costKurus),
        price: fromKurus(row.price.rateKurus),
        mode: row.price.mode,
        markup_percent: row.markup_percent,
        effective_markup_percent: row.price.markupPercent,
        fixed_price: row.fixed_rate_kurus === null || row.fixed_rate_kurus === undefined ? null : fromKurus(row.fixed_rate_kurus),
        enabled: row.enabled,
        below_cost: row.price.belowCost,
        visible: row.visible
      };
    });
    res.json({ default_markup_percent: req.tenant.default_markup_percent, categories, services });
  } catch (err) { next(err); }
});

// db: dbAsync ya da transaction baglantisi (toplu islemde hepsi tek islemde).
async function servicePriceRow(db, tenantId, serviceId) {
  return db.get('SELECT * FROM tenant_service_prices WHERE tenant_id = ? AND service_id = ?', [tenantId, serviceId]);
}

// Varsayilanla ayni hale gelen satir silinir: tablo yalnizca gercek ozel
// ayarlari tutar (Jet admini "Fiyat Ayarlari"nda bunlari gorur).
async function savePriceRow(db, tenantId, serviceId, row) {
  const isDefault = row.enabled === 1 && row.markup_percent === null && row.fixed_rate_kurus === null && !row.custom_name;
  if (isDefault) {
    await db.run('DELETE FROM tenant_service_prices WHERE tenant_id = ? AND service_id = ?', [tenantId, serviceId]);
    return;
  }
  await db.run(
    `INSERT INTO tenant_service_prices (tenant_id, service_id, enabled, markup_percent, fixed_rate_kurus, custom_name, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(tenant_id, service_id) DO UPDATE SET enabled = excluded.enabled, markup_percent = excluded.markup_percent,
       fixed_rate_kurus = excluded.fixed_rate_kurus, custom_name = excluded.custom_name, updated_at = CURRENT_TIMESTAMP`,
    [tenantId, serviceId, row.enabled, row.markup_percent, row.fixed_rate_kurus, row.custom_name]
  );
}

router.put('/services/:id', validate(servicePriceSchema), async (req, res, next) => {
  try {
    const serviceId = idParam(req.params.id);
    const catalog = serviceId ? await tenantCatalog(req.tenant, { includeHidden: true }) : [];
    const service = catalog.find(row => row.id === serviceId);
    if (!service) return res.status(404).json({ error: 'Servis bulunamadı.' });
    const current = await servicePriceRow(dbAsync, req.tenant.id, serviceId);
    const next_ = {
      enabled: current ? Number(current.enabled) : 1,
      markup_percent: current?.markup_percent ?? null,
      fixed_rate_kurus: current?.fixed_rate_kurus ?? null,
      custom_name: current?.custom_name || null
    };
    if (req.body.enabled !== undefined) next_.enabled = req.body.enabled ? 1 : 0;
    if (req.body.markup_percent !== undefined) next_.markup_percent = req.body.markup_percent;
    if (req.body.custom_name !== undefined) next_.custom_name = normalizePlainText(req.body.custom_name || '', 160) || null;
    if (req.body.fixed_price !== undefined) {
      next_.fixed_rate_kurus = req.body.fixed_price === null ? null : toKurus(req.body.fixed_price);
      // Maliyetin altinda sabit fiyat kaydedilmez (zararina satis).
      if (next_.fixed_rate_kurus !== null && next_.fixed_rate_kurus < service.price.costKurus) {
        return res.status(400).json({
          error: `Satış fiyatı maliyetinizin (₺${fromKurus(service.price.costKurus).toFixed(2)}) altında olamaz.`,
          field: 'fixed_price'
        });
      }
    }
    await savePriceRow(dbAsync, req.tenant.id, serviceId, next_);
    await ownerActivity(req, 'service_price_changed', {
      service_id: serviceId,
      service: service.name_tr || service.name,
      before: current ? { enabled: current.enabled, markup_percent: current.markup_percent, fixed_price: current.fixed_rate_kurus === null ? null : fromKurus(current.fixed_rate_kurus), custom_name: current.custom_name } : null,
      after: { enabled: next_.enabled, markup_percent: next_.markup_percent, fixed_price: next_.fixed_rate_kurus === null ? null : fromKurus(next_.fixed_rate_kurus), custom_name: next_.custom_name }
    });
    res.json({ message: 'Servis güncellendi.' });
  } catch (err) { next(err); }
});

router.post('/services/bulk', validate(bulkSchema), async (req, res, next) => {
  try {
    const { action, service_ids: ids } = req.body;
    if (action === 'markup' && req.body.markup_percent === undefined) {
      return res.status(400).json({ error: 'Kâr oranı girin.', field: 'markup_percent' });
    }
    const valid = new Set((await dbAsync.all(
      `SELECT id FROM services WHERE status = 1 AND id IN (${ids.map(() => '?').join(',')})`, ids
    )).map(row => row.id));
    let changed = 0;
    await withTransaction(async tx => {
      for (const serviceId of ids) {
        if (!valid.has(serviceId)) continue;
        const current = await servicePriceRow(tx, req.tenant.id, serviceId);
        const row = {
          enabled: current ? Number(current.enabled) : 1,
          markup_percent: current?.markup_percent ?? null,
          fixed_rate_kurus: current?.fixed_rate_kurus ?? null,
          custom_name: current?.custom_name || null
        };
        if (action === 'enable') row.enabled = 1;
        if (action === 'disable') row.enabled = 0;
        if (action === 'markup') { row.markup_percent = req.body.markup_percent; row.fixed_rate_kurus = null; }
        if (action === 'reset') { row.enabled = 1; row.markup_percent = null; row.fixed_rate_kurus = null; row.custom_name = null; }
        await savePriceRow(tx, req.tenant.id, serviceId, row);
        changed += 1;
      }
    });
    await ownerActivity(req, 'services_bulk_changed', { action, count: changed, markup_percent: req.body.markup_percent ?? null });
    res.json({ message: `${changed} servis güncellendi.`, changed });
  } catch (err) { next(err); }
});

router.put('/pricing', validate(pricingSchema), async (req, res, next) => {
  try {
    const before = req.tenant.default_markup_percent;
    await dbAsync.run(
      'UPDATE tenants SET default_markup_percent = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [req.body.default_markup_percent, req.tenant.id]
    );
    await ownerActivity(req, 'tenant_updated', { default_markup_percent: { from: before, to: req.body.default_markup_percent } });
    invalidateTenantCache();
    res.json({ message: 'Varsayılan kâr oranı kaydedildi.' });
  } catch (err) { next(err); }
});

// -------------------------------------------------------------- musteriler
router.get('/customers', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 100);
    const params = [req.tenant.id];
    let where = 'c.tenant_id = ?';
    if (q) {
      where += ' AND (c.username LIKE ? OR c.email LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }
    const rows = await dbAsync.all(
      `SELECT c.id, c.username, c.email, c.balance_kurus, c.banned, c.created_at, c.last_login_at,
              (SELECT COUNT(*) FROM orders o WHERE o.tenant_customer_id = c.id AND o.status != 'failed') AS orders_count,
              (SELECT COALESCE(SUM(o.tenant_charge_kurus - o.tenant_refunded_kurus), 0) FROM orders o
                WHERE o.tenant_customer_id = c.id AND o.status != 'failed') AS spent_kurus
         FROM tenant_customers c WHERE ${where} ORDER BY c.id DESC LIMIT 500`,
      params
    );
    res.json({
      customers: rows.map(c => ({
        id: c.id, username: c.username, email: c.email, balance: fromKurus(c.balance_kurus), banned: Boolean(c.banned),
        orders_count: c.orders_count, spent: fromKurus(c.spent_kurus), created_at: c.created_at, last_login_at: c.last_login_at
      }))
    });
  } catch (err) { next(err); }
});

async function loadCustomer(req, res) {
  const customer = await dbAsync.get(
    'SELECT id, username, email, balance_kurus, banned, created_at, last_login_at, last_login_ip FROM tenant_customers WHERE id = ? AND tenant_id = ?',
    [idParam(req.params.id), req.tenant.id]
  );
  if (!customer) res.status(404).json({ error: 'Müşteri bulunamadı.' });
  return customer;
}

router.get('/customers/:id', async (req, res, next) => {
  try {
    const customer = await loadCustomer(req, res);
    if (!customer) return;
    const [orders, logs] = await Promise.all([
      dbAsync.all(
        `SELECT o.id, o.link, o.quantity, o.status, o.created_at, o.tenant_charge_kurus, o.tenant_refunded_kurus,
                o.charge_kurus, o.refunded_kurus,
                COALESCE(NULLIF(tp.custom_name, ''), NULLIF(s.name_tr, ''), s.name) AS service_name
           FROM orders o LEFT JOIN services s ON s.id = o.service_id
           LEFT JOIN tenant_service_prices tp ON tp.tenant_id = o.tenant_id AND tp.service_id = o.service_id
          WHERE o.tenant_id = ? AND o.tenant_customer_id = ? AND o.status != 'failed' ORDER BY o.id DESC LIMIT 200`,
        [req.tenant.id, customer.id]),
      dbAsync.all(
        'SELECT * FROM tenant_balance_logs WHERE tenant_id = ? AND customer_id = ? ORDER BY id DESC LIMIT 200',
        [req.tenant.id, customer.id])
    ]);
    res.json({
      customer: {
        id: customer.id, username: customer.username, email: customer.email, balance: fromKurus(customer.balance_kurus),
        banned: Boolean(customer.banned), created_at: customer.created_at, last_login_at: customer.last_login_at, last_login_ip: customer.last_login_ip
      },
      orders: orders.map(o => ({
        id: o.id, service_name: o.service_name, link: o.link, quantity: o.quantity, status: o.status, created_at: o.created_at,
        paid: fromKurus(o.tenant_charge_kurus - o.tenant_refunded_kurus), refunded: fromKurus(o.tenant_refunded_kurus),
        profit: fromKurus((o.tenant_charge_kurus - o.tenant_refunded_kurus) - (o.charge_kurus - o.refunded_kurus))
      })),
      balance_logs: logs.map(l => ({
        id: l.id, amount: fromKurus(l.amount_kurus), balance_after: fromKurus(l.balance_after_kurus), type: l.type,
        order_id: l.order_id, note: l.note, created_at: l.created_at
      }))
    });
  } catch (err) { next(err); }
});

router.post('/customers/:id/balance', validate(balanceSchema), async (req, res, next) => {
  try {
    const customer = await loadCustomer(req, res);
    if (!customer) return;
    const amountKurus = toKurus(req.body.amount) * (req.body.action === 'add' ? 1 : -1);
    const note = normalizePlainText(req.body.note, 300) || null;
    const result = await withTransaction(tx => changeCustomerBalance(tx, {
      tenantId: req.tenant.id,
      customerId: customer.id,
      amountKurus,
      type: req.body.action === 'add' ? 'manual_add' : 'manual_subtract',
      note,
      actor: `owner:${req.owner.username}`
    }));
    if (!result) return res.status(400).json({ error: 'Müşterinin bakiyesi bu tutarı düşmeye yetmiyor.' });
    await ownerActivity(req, 'customer_balance_changed', {
      customer: customer.username, amount: fromKurus(amountKurus), note, balance_after: fromKurus(result.balanceKurus)
    });
    res.json({ message: `${customer.username} bakiyesi güncellendi.`, balance: fromKurus(result.balanceKurus) });
  } catch (err) { next(err); }
});

router.post('/customers/:id/ban', validate(banSchema), async (req, res, next) => {
  try {
    const customer = await loadCustomer(req, res);
    if (!customer) return;
    await dbAsync.run(
      'UPDATE tenant_customers SET banned = ?, token_version = token_version + ? WHERE id = ?',
      [req.body.banned ? 1 : 0, req.body.banned ? 1 : 0, customer.id]
    );
    await ownerActivity(req, req.body.banned ? 'customer_banned' : 'customer_unbanned', { customer: customer.username });
    res.json({ message: `${customer.username} ${req.body.banned ? 'banlandı' : 'banı kaldırıldı'}.` });
  } catch (err) { next(err); }
});

// --------------------------------------------------------------- siparisler
const ORDER_STATUSES = new Set(['pending', 'processing', 'completed', 'partial', 'canceled']);

router.get('/orders', async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page || '1', 10) || 1);
    const limit = 50;
    const params = [req.tenant.id];
    let where = "o.tenant_id = ? AND o.status != 'failed'";
    const status = String(req.query.status || '');
    if (ORDER_STATUSES.has(status)) { where += ' AND o.status = ?'; params.push(status); }
    const q = String(req.query.q || '').trim().slice(0, 200);
    if (q) {
      where += ' AND (c.username LIKE ? OR o.link LIKE ? OR CAST(o.id AS TEXT) = ?)';
      params.push(`%${q}%`, `%${q}%`, q.replace(/^#/, ''));
    }
    const [total, rows] = await Promise.all([
      dbAsync.get(`SELECT COUNT(*) AS n FROM orders o LEFT JOIN tenant_customers c ON c.id = o.tenant_customer_id WHERE ${where}`, params),
      dbAsync.all(
        `SELECT o.id, o.link, o.quantity, o.status, o.start_count, o.remains, o.created_at, o.completed_at,
                o.tenant_charge_kurus, o.tenant_refunded_kurus, o.charge_kurus, o.refunded_kurus,
                c.username AS customer, o.tenant_customer_id AS customer_id,
                COALESCE(NULLIF(tp.custom_name, ''), NULLIF(s.name_tr, ''), s.name) AS service_name
           FROM orders o
           LEFT JOIN tenant_customers c ON c.id = o.tenant_customer_id
           LEFT JOIN services s ON s.id = o.service_id
           LEFT JOIN tenant_service_prices tp ON tp.tenant_id = o.tenant_id AND tp.service_id = o.service_id
          WHERE ${where} ORDER BY o.id DESC LIMIT ? OFFSET ?`,
        [...params, limit, (page - 1) * limit])
    ]);
    res.json({
      page,
      pages: Math.max(1, Math.ceil(total.n / limit)),
      total: total.n,
      orders: rows.map(o => ({
        id: o.id, customer: o.customer, customer_id: o.customer_id, service_name: o.service_name, link: o.link,
        quantity: o.quantity, status: o.status, start_count: o.start_count, remains: o.remains,
        paid: fromKurus(o.tenant_charge_kurus - o.tenant_refunded_kurus),
        refunded: fromKurus(o.tenant_refunded_kurus),
        cost: fromKurus(o.charge_kurus - o.refunded_kurus),
        profit: fromKurus((o.tenant_charge_kurus - o.tenant_refunded_kurus) - (o.charge_kurus - o.refunded_kurus)),
        created_at: o.created_at, completed_at: o.completed_at
      }))
    });
  } catch (err) { next(err); }
});

// ------------------------------------------------------------ site ayarlari
router.get('/site', (req, res) => {
  const settings = tenantSettings(req.tenant);
  res.json({
    name: req.tenant.name,
    primary_color: settings.primary_color || '#6366f1',
    description: settings.description || '',
    announcement: settings.announcement || '',
    support_email: settings.support_email || '',
    telegram: settings.telegram || ''
  });
});

router.put('/site', validate(siteSchema), async (req, res, next) => {
  try {
    const name = normalizePlainText(req.body.name, 60);
    if (!name) return res.status(400).json({ error: 'Site adı gerekli.', field: 'name' });
    const before = tenantSettings(req.tenant);
    const settings = {
      ...before,
      primary_color: req.body.primary_color,
      description: normalizePlainText(req.body.description, 300),
      announcement: normalizePlainText(req.body.announcement, 300),
      support_email: req.body.support_email,
      telegram: normalizePlainText(req.body.telegram, 100)
    };
    await dbAsync.run(
      'UPDATE tenants SET name = ?, settings_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, JSON.stringify(settings), req.tenant.id]
    );
    const changes = {};
    if (name !== req.tenant.name) changes.name = { from: req.tenant.name, to: name };
    for (const key of ['primary_color', 'description', 'announcement', 'support_email', 'telegram']) {
      if ((before[key] || '') !== (settings[key] || '')) changes[key] = { from: before[key] || '', to: settings[key] || '' };
    }
    if (Object.keys(changes).length) await ownerActivity(req, 'site_settings_changed', changes);
    invalidateTenantCache();
    res.json({ message: 'Site ayarları kaydedildi.' });
  } catch (err) { next(err); }
});

// -------------------------------------------------------------- kayitlar
router.get('/logs', async (req, res, next) => {
  try {
    const [activity, balance] = await Promise.all([
      dbAsync.all(
        `SELECT a.id, a.actor_type, a.action, a.details, a.ip_address, a.created_at, c.username AS customer
           FROM tenant_activity_logs a
           LEFT JOIN tenant_customers c ON a.actor_type = 'customer' AND c.id = a.actor_id
          WHERE a.tenant_id = ? ORDER BY a.id DESC LIMIT 300`, [req.tenant.id]),
      dbAsync.all(
        `SELECT l.*, c.username AS customer FROM tenant_balance_logs l
           LEFT JOIN tenant_customers c ON c.id = l.customer_id
          WHERE l.tenant_id = ? ORDER BY l.id DESC LIMIT 300`, [req.tenant.id])
    ]);
    const parse = value => { try { return JSON.parse(value); } catch { return null; } };
    res.json({
      // Jet adminine ait kayitlarda adminin kimligi bayiye gosterilmez.
      activity: activity.map(a => ({
        id: a.id,
        actor_type: a.actor_type,
        actor_name: a.actor_type === 'customer' ? a.customer : null,
        action: a.action,
        details: parse(a.details),
        ip_address: a.actor_type === 'jet_admin' ? null : a.ip_address,
        created_at: a.created_at
      })),
      balance_logs: balance.map(l => ({
        id: l.id, customer: l.customer, amount: fromKurus(l.amount_kurus), balance_after: fromKurus(l.balance_after_kurus),
        type: l.type, order_id: l.order_id, note: l.note, created_at: l.created_at
      }))
    });
  } catch (err) { next(err); }
});

module.exports = router;
