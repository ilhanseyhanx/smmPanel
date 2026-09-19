'use strict';

// ADMIN > BAYILER: genel bayilik ayarlari (indirim, acilis sarti, varsayilan
// kar), bayi listesi ve her bayinin tum detayi (sahibi, alan adlari,
// musterileri, siparisleri, fiyatlari, bakiye hareketleri, islem kaydi).
// Kimlik + admin yetkisi server.js'te baglanirken uygulanir.
const express = require('express');
const { z } = require('zod');
const { dbAsync, withTransaction } = require('../config/database');
const { validate } = require('../middleware/validate');
const { normalizePlainText } = require('../utils/security');
const { fromKurus, toKurus } = require('../utils/money');
const { PAYMENT_METHOD_GROUP_SQL, REAL_MONEY_GROUPS } = require('../utils/paymentGroups');
const {
  getResellerSettings, saveResellerSettings, effectiveDiscountPercent, tenantCatalog,
  logTenantActivity, changeCustomerBalance, validateSlug
} = require('../services/resellers');
const { baseDomain, normalizeHost, invalidateTenantCache, tenantSettings } = require('../tenant/resolve');

const router = express.Router();

const percent = max => z.coerce.number().finite().min(0).max(max);
const settingsSchema = z.object({
  // Gonderilmezse mevcut deger korunur (eski istemciler anahtari ezmesin).
  public_page_enabled: z.boolean().optional(),
  discount_percent: percent(90),
  min_deposit_tl: z.coerce.number().finite().min(0).max(1_000_000),
  applications_open: z.boolean(),
  default_markup_percent: percent(1000)
});
const createSchema = z.object({
  owner: z.string().trim().min(1).max(254),
  name: z.string().trim().min(2).max(60),
  slug: z.string().trim().min(3).max(30)
});
const updateSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  theme: z.enum(['classic']).optional(),
  discount_percent: percent(90).nullable().optional(),
  default_markup_percent: percent(1000).optional()
});
const statusSchema = z.object({
  status: z.enum(['active', 'suspended', 'sleeping']),
  reason: z.string().trim().max(300).optional().default('')
});
const domainSchema = z.object({
  domain: z.string().trim().min(4).max(253),
  status: z.enum(['pending', 'active', 'disabled']).default('active')
});
const domainStatusSchema = z.object({ status: z.enum(['pending', 'active', 'disabled']) });
const balanceSchema = z.object({
  amount: z.coerce.number().finite().positive().max(1_000_000),
  action: z.enum(['add', 'subtract']),
  note: z.string().trim().max(300).optional().default('')
});
const banSchema = z.object({ banned: z.boolean() });
const deleteSchema = z.object({ confirm: z.string().trim().min(1).max(30) });

const DOMAIN_PATTERN = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

function idParam(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function notFound(res) {
  return res.status(404).json({ error: 'Bayi bulunamadı.' });
}

async function audit(req, action, entityId, details) {
  await dbAsync.run(
    'INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
    [req.user.id, action, 'tenant', entityId === null ? null : String(entityId), details ? JSON.stringify(details) : null, req.ip]
  );
}

function adminActivity(req, tenantId, action, details) {
  return logTenantActivity(dbAsync, { tenantId, actorType: 'jet_admin', actorId: req.user.id, action, details, ip: req.ip });
}

function addressesOf(tenant, domains) {
  const base = baseDomain();
  return {
    subdomain: base ? `${tenant.slug}.${base}` : null,
    domains: domains.map(d => ({ id: d.id, domain: d.domain, status: d.status, created_at: d.created_at, activated_at: d.activated_at }))
  };
}

// Bayi basina ozet rakamlar. Ciro = musterilerin bayiye odedigi (iade dusulmus),
// maliyet = bayinin Jet'e odedigi, bayi kari = ciro - maliyet.
const TENANT_STATS_SQL = `
  (SELECT COUNT(*) FROM tenant_customers c WHERE c.tenant_id = t.id) AS customers_total,
  (SELECT COUNT(*) FROM tenant_customers c WHERE c.tenant_id = t.id AND c.created_at >= datetime('now', '-30 days')) AS customers_30d,
  (SELECT COALESCE(SUM(c.balance_kurus), 0) FROM tenant_customers c WHERE c.tenant_id = t.id) AS customer_balance_kurus,
  (SELECT COUNT(*) FROM orders o WHERE o.tenant_id = t.id AND o.status != 'failed') AS orders_total,
  (SELECT COUNT(*) FROM orders o WHERE o.tenant_id = t.id AND o.status != 'failed' AND o.created_at >= datetime('now', '-30 days')) AS orders_30d,
  (SELECT COUNT(*) FROM orders o WHERE o.tenant_id = t.id AND o.status IN ('pending', 'processing')) AS orders_active,
  (SELECT COALESCE(SUM(o.tenant_charge_kurus - o.tenant_refunded_kurus), 0) FROM orders o WHERE o.tenant_id = t.id AND o.status != 'failed') AS revenue_kurus,
  (SELECT COALESCE(SUM(o.charge_kurus - o.refunded_kurus), 0) FROM orders o WHERE o.tenant_id = t.id AND o.status != 'failed') AS cost_kurus,
  (SELECT COALESCE(SUM(o.tenant_charge_kurus - o.tenant_refunded_kurus), 0) FROM orders o WHERE o.tenant_id = t.id AND o.status != 'failed' AND o.created_at >= datetime('now', '-30 days')) AS revenue_30d_kurus,
  (SELECT COALESCE(SUM(o.charge_kurus - o.refunded_kurus), 0) FROM orders o WHERE o.tenant_id = t.id AND o.status != 'failed' AND o.created_at >= datetime('now', '-30 days')) AS cost_30d_kurus`;

function statsFromRow(row) {
  return {
    customers_total: row.customers_total,
    customers_30d: row.customers_30d,
    customer_balance: fromKurus(row.customer_balance_kurus),
    orders_total: row.orders_total,
    orders_30d: row.orders_30d,
    orders_active: row.orders_active,
    revenue: fromKurus(row.revenue_kurus),
    cost: fromKurus(row.cost_kurus),
    profit: fromKurus(row.revenue_kurus - row.cost_kurus),
    revenue_30d: fromKurus(row.revenue_30d_kurus),
    cost_30d: fromKurus(row.cost_30d_kurus),
    profit_30d: fromKurus(row.revenue_30d_kurus - row.cost_30d_kurus)
  };
}

function parseDetails(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return value; }
}

// ---------------------------------------------------------------- ayarlar
router.get('/settings', async (req, res, next) => {
  try {
    res.json({ settings: await getResellerSettings(), base_domain: baseDomain() || null });
  } catch (err) { next(err); }
});

router.put('/settings', validate(settingsSchema), async (req, res, next) => {
  try {
    const before = await getResellerSettings();
    const settings = await saveResellerSettings({
      ...req.body,
      public_page_enabled: req.body.public_page_enabled ?? before.public_page_enabled
    });
    await audit(req, 'reseller_settings_updated', null, { before, after: settings });
    // Ayar her bayinin islem kaydina da duser: bayi detayinda "indirim ne
    // zaman degisti" sorusu tek yerden cevaplanir.
    const tenants = await dbAsync.all('SELECT id FROM tenants');
    for (const tenant of tenants) {
      await adminActivity(req, tenant.id, 'global_settings_changed', { before, after: settings });
    }
    invalidateTenantCache();
    res.json({ message: 'Bayilik ayarları kaydedildi; tüm bayilere anında yansıdı.', settings });
  } catch (err) { next(err); }
});

// ------------------------------------------------------------------ liste
router.get('/', async (req, res, next) => {
  try {
    const [settings, rows, domains] = await Promise.all([
      getResellerSettings(),
      dbAsync.all(
        `SELECT t.*, u.username AS owner_username, u.email AS owner_email, u.balance_kurus AS owner_balance_kurus,
                u.banned AS owner_banned, ${TENANT_STATS_SQL}
           FROM tenants t JOIN users u ON u.id = t.owner_user_id
          ORDER BY t.id DESC`
      ),
      dbAsync.all('SELECT id, tenant_id, domain, status, created_at, activated_at FROM tenant_domains ORDER BY id')
    ]);
    const byTenant = new Map();
    for (const domain of domains) {
      if (!byTenant.has(domain.tenant_id)) byTenant.set(domain.tenant_id, []);
      byTenant.get(domain.tenant_id).push(domain);
    }
    const tenants = rows.map(row => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      status_reason: row.status_reason,
      theme: row.theme,
      created_at: row.created_at,
      last_order_at: row.last_order_at,
      discount_percent: row.discount_percent,
      effective_discount_percent: effectiveDiscountPercent(row, settings),
      default_markup_percent: row.default_markup_percent,
      owner: {
        id: row.owner_user_id,
        username: row.owner_username,
        email: row.owner_email,
        balance: fromKurus(row.owner_balance_kurus),
        banned: Boolean(row.owner_banned)
      },
      ...addressesOf(row, byTenant.get(row.id) || []),
      stats: statsFromRow(row)
    }));
    const summary = tenants.reduce((acc, t) => {
      acc.total += 1;
      if (t.status === 'active') acc.active += 1;
      acc.customers += t.stats.customers_total;
      acc.orders_30d += t.stats.orders_30d;
      acc.jet_revenue_30d += t.stats.cost_30d;
      acc.reseller_profit_30d += t.stats.profit_30d;
      return acc;
    }, { total: 0, active: 0, customers: 0, orders_30d: 0, jet_revenue_30d: 0, reseller_profit_30d: 0 });
    for (const key of ['jet_revenue_30d', 'reseller_profit_30d']) summary[key] = Math.round(summary[key] * 100) / 100;
    res.json({ settings, base_domain: baseDomain() || null, summary, tenants });
  } catch (err) { next(err); }
});

// Admin, sart aramadan herhangi bir kullaniciya bayi paneli acabilir.
router.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const ownerKey = req.body.owner;
    const owner = /^\d+$/.test(ownerKey)
      ? await dbAsync.get('SELECT id, username FROM users WHERE id = ?', [Number(ownerKey)])
      : await dbAsync.get('SELECT id, username FROM users WHERE lower(username) = lower(?) OR lower(email) = lower(?)', [ownerKey, ownerKey]);
    if (!owner) return res.status(404).json({ error: 'Kullanıcı bulunamadı (kullanıcı adı, e-posta veya ID girin).' });
    if (await dbAsync.get('SELECT id FROM tenants WHERE owner_user_id = ?', [owner.id])) {
      return res.status(409).json({ error: `${owner.username} kullanıcısının zaten bir bayi paneli var.` });
    }
    const slugCheck = validateSlug(req.body.slug);
    if (!slugCheck.ok) {
      return res.status(400).json({ error: slugCheck.reason === 'reserved' ? 'Bu adres ayrılmış, başka bir adres seçin.' : 'Adres 3-30 karakter olmalı; küçük harf, rakam ve tire.', field: 'slug' });
    }
    if (await dbAsync.get('SELECT id FROM tenants WHERE slug = ?', [slugCheck.slug])) {
      return res.status(409).json({ error: 'Bu adres başka bir bayi tarafından kullanılıyor.', field: 'slug' });
    }
    const settings = await getResellerSettings();
    const name = normalizePlainText(req.body.name, 60);
    const created = await dbAsync.run(
      'INSERT INTO tenants (owner_user_id, slug, name, default_markup_percent) VALUES (?, ?, ?, ?)',
      [owner.id, slugCheck.slug, name, settings.default_markup_percent]
    );
    await adminActivity(req, created.id, 'tenant_created', { name, slug: slugCheck.slug, owner: owner.username, by: 'admin' });
    await audit(req, 'tenant_created', created.id, { name, slug: slugCheck.slug, owner: owner.username });
    invalidateTenantCache();
    res.status(201).json({ message: `"${name}" bayi paneli ${owner.username} için oluşturuldu.`, id: created.id });
  } catch (err) { next(err); }
});

// ------------------------------------------------------------------ detay
router.get('/:id', async (req, res, next) => {
  try {
    const id = idParam(req.params.id);
    if (!id) return notFound(res);
    const settings = await getResellerSettings();
    const tenant = await dbAsync.get(
      `SELECT t.*, ${TENANT_STATS_SQL} FROM tenants t WHERE t.id = ?`, [id]
    );
    if (!tenant) return notFound(res);

    const [owner, ownerDeposit, domains, customers, orders, balanceLogs, activity, catalog] = await Promise.all([
      dbAsync.get(
        `SELECT id, username, email, balance_kurus, banned, created_at, last_login_at, last_seen_at
           FROM users WHERE id = ?`, [tenant.owner_user_id]),
      dbAsync.get(
        `SELECT COALESCE(SUM(p.amount_kurus), 0) AS total FROM payments p
          WHERE p.user_id = ? AND p.status = 'completed' AND ${PAYMENT_METHOD_GROUP_SQL} IN ${REAL_MONEY_GROUPS}`,
        [tenant.owner_user_id]),
      dbAsync.all('SELECT * FROM tenant_domains WHERE tenant_id = ? ORDER BY id', [id]),
      dbAsync.all(
        `SELECT c.id, c.username, c.email, c.balance_kurus, c.banned, c.created_at, c.last_login_at, c.last_login_ip,
                (SELECT COUNT(*) FROM orders o WHERE o.tenant_customer_id = c.id AND o.status != 'failed') AS orders_count,
                (SELECT COALESCE(SUM(o.tenant_charge_kurus - o.tenant_refunded_kurus), 0) FROM orders o
                  WHERE o.tenant_customer_id = c.id AND o.status != 'failed') AS spent_kurus
           FROM tenant_customers c WHERE c.tenant_id = ? ORDER BY c.id DESC LIMIT 500`, [id]),
      dbAsync.all(
        `SELECT o.id, o.link, o.quantity, o.status, o.created_at, o.completed_at, o.provider_order_id, o.failure_reason,
                o.charge_kurus, o.refunded_kurus, o.tenant_charge_kurus, o.tenant_refunded_kurus, o.tenant_customer_id,
                c.username AS customer_username, COALESCE(NULLIF(s.name_tr, ''), s.name) AS service_name
           FROM orders o
           LEFT JOIN tenant_customers c ON c.id = o.tenant_customer_id
           LEFT JOIN services s ON s.id = o.service_id
          WHERE o.tenant_id = ? ORDER BY o.id DESC LIMIT 500`, [id]),
      dbAsync.all(
        `SELECT l.*, c.username AS customer_username FROM tenant_balance_logs l
           LEFT JOIN tenant_customers c ON c.id = l.customer_id
          WHERE l.tenant_id = ? ORDER BY l.id DESC LIMIT 500`, [id]),
      dbAsync.all(
        `SELECT a.*, u.username AS jet_username, c.username AS customer_username
           FROM tenant_activity_logs a
           LEFT JOIN users u ON a.actor_type IN ('jet_admin', 'owner') AND u.id = a.actor_id
           LEFT JOIN tenant_customers c ON a.actor_type = 'customer' AND c.id = a.actor_id
          WHERE a.tenant_id = ? ORDER BY a.id DESC LIMIT 500`, [id]),
      tenantCatalog(tenant, { includeHidden: true })
    ]);

    // Fiyat tablosu: bayinin ozel ayar yaptigi servisler + maliyetin altina
    // dustugu icin satistan kalkanlar (uyari).
    const prices = catalog
      .filter(row => row.enabled === false || row.fixed_rate_kurus !== null || row.markup_percent !== null || row.custom_name || row.price.belowCost)
      .map(row => ({
        service_id: row.id,
        service_name: row.name_tr || row.name,
        custom_name: row.custom_name || null,
        pricing_model: row.pricing_model,
        jet_price: fromKurus(row.base_rate_kurus),
        cost: fromKurus(row.price.costKurus),
        sell: fromKurus(row.price.rateKurus),
        mode: row.price.mode,
        markup_percent: row.price.markupPercent,
        enabled: row.enabled,
        below_cost: row.price.belowCost
      }));

    res.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        theme: tenant.theme,
        status: tenant.status,
        status_reason: tenant.status_reason,
        discount_percent: tenant.discount_percent,
        effective_discount_percent: effectiveDiscountPercent(tenant, settings),
        default_markup_percent: tenant.default_markup_percent,
        settings: tenantSettings(tenant),
        created_at: tenant.created_at,
        updated_at: tenant.updated_at,
        last_order_at: tenant.last_order_at,
        ...addressesOf(tenant, domains)
      },
      global_settings: settings,
      owner: owner ? {
        id: owner.id,
        username: owner.username,
        email: owner.email,
        balance: fromKurus(owner.balance_kurus),
        banned: Boolean(owner.banned),
        real_deposit: fromKurus(ownerDeposit?.total || 0),
        created_at: owner.created_at,
        last_login_at: owner.last_login_at,
        last_seen_at: owner.last_seen_at
      } : null,
      stats: {
        ...statsFromRow(tenant),
        visible_services: catalog.filter(row => row.visible).length,
        hidden_services: catalog.filter(row => !row.visible).length,
        below_cost_services: catalog.filter(row => row.price.belowCost).length
      },
      customers: customers.map(c => ({
        id: c.id,
        username: c.username,
        email: c.email,
        balance: fromKurus(c.balance_kurus),
        banned: Boolean(c.banned),
        orders_count: c.orders_count,
        spent: fromKurus(c.spent_kurus),
        created_at: c.created_at,
        last_login_at: c.last_login_at,
        last_login_ip: c.last_login_ip
      })),
      orders: orders.map(o => ({
        id: o.id,
        customer_id: o.tenant_customer_id,
        customer_username: o.customer_username,
        service_name: o.service_name,
        link: o.link,
        quantity: o.quantity,
        status: o.status,
        provider_order_id: o.provider_order_id,
        failure_reason: o.failure_reason,
        customer_paid: fromKurus(o.tenant_charge_kurus - o.tenant_refunded_kurus),
        customer_refunded: fromKurus(o.tenant_refunded_kurus),
        cost: fromKurus(o.charge_kurus - o.refunded_kurus),
        profit: fromKurus((o.tenant_charge_kurus - o.tenant_refunded_kurus) - (o.charge_kurus - o.refunded_kurus)),
        created_at: o.created_at,
        completed_at: o.completed_at
      })),
      prices,
      balance_logs: balanceLogs.map(l => ({
        id: l.id,
        customer_id: l.customer_id,
        customer_username: l.customer_username,
        amount: fromKurus(l.amount_kurus),
        balance_after: fromKurus(l.balance_after_kurus),
        type: l.type,
        order_id: l.order_id,
        note: l.note,
        actor: l.actor,
        created_at: l.created_at
      })),
      activity: activity.map(a => ({
        id: a.id,
        actor_type: a.actor_type,
        actor_id: a.actor_id,
        actor_name: a.jet_username || a.customer_username || null,
        action: a.action,
        details: parseDetails(a.details),
        ip_address: a.ip_address,
        created_at: a.created_at
      }))
    });
  } catch (err) { next(err); }
});

async function loadTenant(req, res) {
  const id = idParam(req.params.id);
  const tenant = id && await dbAsync.get('SELECT * FROM tenants WHERE id = ?', [id]);
  if (!tenant) { notFound(res); return null; }
  return tenant;
}

router.put('/:id', validate(updateSchema), async (req, res, next) => {
  try {
    const tenant = await loadTenant(req, res);
    if (!tenant) return;
    const changes = {};
    for (const key of ['name', 'theme', 'discount_percent', 'default_markup_percent']) {
      if (req.body[key] === undefined) continue;
      const value = key === 'name' ? normalizePlainText(req.body.name, 60) : req.body[key];
      if (key === 'name' && !value) return res.status(400).json({ error: 'Site adı boş olamaz.', field: 'name' });
      if (value !== tenant[key]) changes[key] = { from: tenant[key], to: value };
    }
    if (!Object.keys(changes).length) return res.json({ message: 'Değişiklik yok.' });
    const sets = Object.keys(changes).map(key => `${key} = ?`).join(', ');
    await dbAsync.run(
      `UPDATE tenants SET ${sets}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [...Object.values(changes).map(change => change.to), tenant.id]
    );
    await adminActivity(req, tenant.id, 'tenant_updated', changes);
    await audit(req, 'tenant_updated', tenant.id, changes);
    invalidateTenantCache();
    res.json({ message: 'Bayi güncellendi.' });
  } catch (err) { next(err); }
});

router.post('/:id/status', validate(statusSchema), async (req, res, next) => {
  try {
    const tenant = await loadTenant(req, res);
    if (!tenant) return;
    const reason = normalizePlainText(req.body.reason, 300) || null;
    await dbAsync.run(
      'UPDATE tenants SET status = ?, status_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [req.body.status, req.body.status === 'active' ? null : reason, tenant.id]
    );
    await adminActivity(req, tenant.id, 'status_changed', { from: tenant.status, to: req.body.status, reason });
    await audit(req, 'tenant_status_changed', tenant.id, { from: tenant.status, to: req.body.status, reason });
    invalidateTenantCache();
    const labels = { active: 'aktif edildi', suspended: 'askıya alındı', sleeping: 'uyku moduna alındı' };
    res.json({ message: `Bayi ${labels[req.body.status]}.` });
  } catch (err) { next(err); }
});

router.post('/:id/domains', validate(domainSchema), async (req, res, next) => {
  try {
    const tenant = await loadTenant(req, res);
    if (!tenant) return;
    const domain = normalizeHost(req.body.domain.replace(/^https?:\/\//i, '').split('/')[0]);
    if (!DOMAIN_PATTERN.test(domain)) return res.status(400).json({ error: 'Geçerli bir alan adı girin (örnek: kankasmm.com).', field: 'domain' });
    const base = baseDomain();
    if (base && (domain === base || domain.endsWith(`.${base}`))) {
      return res.status(400).json({ error: 'Taban alan adının alt adresleri ayrıca eklenmez; bayi zaten slug adresinden açılır.', field: 'domain' });
    }
    const existing = await dbAsync.get('SELECT tenant_id FROM tenant_domains WHERE domain = ?', [domain]);
    if (existing) return res.status(409).json({ error: 'Bu alan adı zaten bir bayiye bağlı.', field: 'domain' });
    await dbAsync.run(
      `INSERT INTO tenant_domains (tenant_id, domain, status, activated_at)
       VALUES (?, ?, ?, CASE WHEN ? = 'active' THEN CURRENT_TIMESTAMP END)`,
      [tenant.id, domain, req.body.status, req.body.status]
    );
    await adminActivity(req, tenant.id, 'domain_added', { domain, status: req.body.status });
    await audit(req, 'tenant_domain_added', tenant.id, { domain, status: req.body.status });
    invalidateTenantCache();
    res.status(201).json({ message: `${domain} eklendi.` });
  } catch (err) { next(err); }
});

router.patch('/:id/domains/:domainId', validate(domainStatusSchema), async (req, res, next) => {
  try {
    const tenant = await loadTenant(req, res);
    if (!tenant) return;
    const domain = await dbAsync.get('SELECT * FROM tenant_domains WHERE id = ? AND tenant_id = ?', [idParam(req.params.domainId), tenant.id]);
    if (!domain) return res.status(404).json({ error: 'Alan adı bulunamadı.' });
    await dbAsync.run(
      `UPDATE tenant_domains SET status = ?, activated_at = CASE WHEN ? = 'active' THEN COALESCE(activated_at, CURRENT_TIMESTAMP) ELSE activated_at END
        WHERE id = ?`,
      [req.body.status, req.body.status, domain.id]
    );
    await adminActivity(req, tenant.id, 'domain_status_changed', { domain: domain.domain, from: domain.status, to: req.body.status });
    invalidateTenantCache();
    res.json({ message: 'Alan adı durumu güncellendi.' });
  } catch (err) { next(err); }
});

router.delete('/:id/domains/:domainId', async (req, res, next) => {
  try {
    const tenant = await loadTenant(req, res);
    if (!tenant) return;
    const domain = await dbAsync.get('SELECT * FROM tenant_domains WHERE id = ? AND tenant_id = ?', [idParam(req.params.domainId), tenant.id]);
    if (!domain) return res.status(404).json({ error: 'Alan adı bulunamadı.' });
    await dbAsync.run('DELETE FROM tenant_domains WHERE id = ?', [domain.id]);
    await adminActivity(req, tenant.id, 'domain_removed', { domain: domain.domain });
    await audit(req, 'tenant_domain_removed', tenant.id, { domain: domain.domain });
    invalidateTenantCache();
    res.json({ message: `${domain.domain} kaldırıldı.` });
  } catch (err) { next(err); }
});

router.post('/:id/customers/:customerId/balance', validate(balanceSchema), async (req, res, next) => {
  try {
    const tenant = await loadTenant(req, res);
    if (!tenant) return;
    const customer = await dbAsync.get(
      'SELECT id, username FROM tenant_customers WHERE id = ? AND tenant_id = ?',
      [idParam(req.params.customerId), tenant.id]
    );
    if (!customer) return res.status(404).json({ error: 'Müşteri bulunamadı.' });
    const amountKurus = toKurus(req.body.amount) * (req.body.action === 'add' ? 1 : -1);
    const note = normalizePlainText(req.body.note, 300) || null;
    const result = await withTransaction(tx => changeCustomerBalance(tx, {
      tenantId: tenant.id,
      customerId: customer.id,
      amountKurus,
      type: req.body.action === 'add' ? 'manual_add' : 'manual_subtract',
      note,
      actor: `jet_admin:${req.user.username}`
    }));
    if (!result) return res.status(400).json({ error: 'Müşterinin bakiyesi bu tutarı düşmeye yetmiyor.' });
    await adminActivity(req, tenant.id, 'customer_balance_changed', {
      customer: customer.username, amount: fromKurus(amountKurus), note, balance_after: fromKurus(result.balanceKurus)
    });
    res.json({ message: `${customer.username} bakiyesi güncellendi.`, balance: fromKurus(result.balanceKurus) });
  } catch (err) { next(err); }
});

router.post('/:id/customers/:customerId/ban', validate(banSchema), async (req, res, next) => {
  try {
    const tenant = await loadTenant(req, res);
    if (!tenant) return;
    const customer = await dbAsync.get(
      'SELECT id, username FROM tenant_customers WHERE id = ? AND tenant_id = ?',
      [idParam(req.params.customerId), tenant.id]
    );
    if (!customer) return res.status(404).json({ error: 'Müşteri bulunamadı.' });
    // Banlanan musterinin acik oturumlari da kapanir (token_version).
    await dbAsync.run(
      'UPDATE tenant_customers SET banned = ?, token_version = token_version + ? WHERE id = ?',
      [req.body.banned ? 1 : 0, req.body.banned ? 1 : 0, customer.id]
    );
    await adminActivity(req, tenant.id, req.body.banned ? 'customer_banned' : 'customer_unbanned', { customer: customer.username });
    res.json({ message: `${customer.username} ${req.body.banned ? 'banlandı' : 'banı kaldırıldı'}.` });
  } catch (err) { next(err); }
});

// Bayiligi tamamen siler: musteriler, bakiyeleri, alan adlari, fiyatlar ve
// islem kaydi gider. Siparisler Jet tarafinda sahibin siparisi olarak kalir.
// Yanlislikla silinmesin diye bayinin adresi (slug) yazilarak onaylanir.
router.delete('/:id', validate(deleteSchema), async (req, res, next) => {
  try {
    const tenant = await loadTenant(req, res);
    if (!tenant) return;
    if (req.body.confirm !== tenant.slug) {
      return res.status(400).json({ error: `Silmeyi onaylamak için bayinin adresini ("${tenant.slug}") yazın.` });
    }
    await withTransaction(async tx => {
      await tx.run('DELETE FROM tenant_balance_logs WHERE tenant_id = ?', [tenant.id]);
      await tx.run('DELETE FROM tenant_activity_logs WHERE tenant_id = ?', [tenant.id]);
      await tx.run('DELETE FROM tenant_service_prices WHERE tenant_id = ?', [tenant.id]);
      await tx.run('DELETE FROM tenant_domains WHERE tenant_id = ?', [tenant.id]);
      await tx.run('DELETE FROM tenant_customers WHERE tenant_id = ?', [tenant.id]);
      await tx.run('DELETE FROM tenants WHERE id = ?', [tenant.id]);
    });
    await audit(req, 'tenant_deleted', tenant.id, { name: tenant.name, slug: tenant.slug, owner_user_id: tenant.owner_user_id });
    invalidateTenantCache();
    res.json({ message: `"${tenant.name}" bayiliği silindi.` });
  } catch (err) { next(err); }
});

module.exports = router;
