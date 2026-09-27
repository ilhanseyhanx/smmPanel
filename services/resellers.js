'use strict';

// Bayi (child panel) sisteminin cekirdegi: genel ayarlar, fiyat hesabi,
// bayi musterisi bakiye defteri, bayi islem kaydi ve iade senkronu.
//
// Fiyat zinciri (kurus, servisin kendi biriminde: 1000 adet ya da adet basi):
//   Jet satis fiyati  --(bayi indirimi %)-->  bayi maliyeti
//   bayi maliyeti     --(kar % veya sabit)-->  musterinin gordugu fiyat
// Maliyet her istekte canli hesaplanir; admin indirim oranini ya da servis
// fiyatini degistirip kaydettigi an butun bayilere yansir.
const { dbAsync } = require('../config/database');
const { toKurus } = require('../utils/money');
const { PAYMENT_METHOD_GROUP_SQL, REAL_MONEY_GROUPS } = require('../utils/paymentGroups');

const SETTING_KEYS = {
  public_page_enabled: 'reseller_public_page',
  discount_percent: 'reseller_discount_percent',
  min_deposit_tl: 'reseller_min_deposit_tl',
  applications_open: 'reseller_applications_open',
  default_markup_percent: 'reseller_default_markup_percent'
};

// public_page_enabled varsayilan KAPALI: admin acana kadar Jet sitesinde
// bayilikle ilgili hicbir sey gorunmez ve basvuru alinmaz. Admin panelinden
// elle bayi acmak her durumda calisir.
const DEFAULT_SETTINGS = Object.freeze({
  public_page_enabled: false,
  discount_percent: 10,
  min_deposit_tl: 500,
  applications_open: true,
  default_markup_percent: 30
});

const SETTINGS_TTL_MS = 30_000;
let settingsCache = { at: 0, value: null };

// Siparisle ayni kaynak: kurus sutunu bossa (eski/elle eklenmis servis)
// ondalik fiyat kullanilir. Aksi halde maliyet 0 cikar ve servis bedava
// gorunurdu.
function serviceRateKurus(row) {
  if (row.rate_per_1000_kurus) return Number(row.rate_per_1000_kurus);
  const legacy = Number(row.rate_per_1000);
  return Number.isFinite(legacy) && legacy > 0 ? toKurus(legacy) : 0;
}

function toPercent(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

async function getResellerSettings() {
  if (settingsCache.value && Date.now() - settingsCache.at < SETTINGS_TTL_MS) return settingsCache.value;
  const rows = await dbAsync.all(
    `SELECT key, value FROM site_settings WHERE key IN (${Object.values(SETTING_KEYS).map(() => '?').join(',')})`,
    Object.values(SETTING_KEYS)
  );
  const raw = Object.fromEntries(rows.map(row => [row.key, row.value]));
  const value = {
    public_page_enabled: raw[SETTING_KEYS.public_page_enabled] === '1',
    discount_percent: Math.min(90, toPercent(raw[SETTING_KEYS.discount_percent], DEFAULT_SETTINGS.discount_percent)),
    min_deposit_tl: toPercent(raw[SETTING_KEYS.min_deposit_tl], DEFAULT_SETTINGS.min_deposit_tl),
    applications_open: raw[SETTING_KEYS.applications_open] === undefined
      ? DEFAULT_SETTINGS.applications_open
      : raw[SETTING_KEYS.applications_open] === '1',
    default_markup_percent: toPercent(raw[SETTING_KEYS.default_markup_percent], DEFAULT_SETTINGS.default_markup_percent)
  };
  settingsCache = { at: Date.now(), value };
  return value;
}

async function saveResellerSettings(values) {
  const entries = {
    [SETTING_KEYS.public_page_enabled]: values.public_page_enabled ? '1' : '0',
    [SETTING_KEYS.discount_percent]: String(values.discount_percent),
    [SETTING_KEYS.min_deposit_tl]: String(values.min_deposit_tl),
    [SETTING_KEYS.applications_open]: values.applications_open ? '1' : '0',
    [SETTING_KEYS.default_markup_percent]: String(values.default_markup_percent)
  };
  for (const [key, value] of Object.entries(entries)) {
    await dbAsync.run(
      'INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, value]
    );
  }
  settingsCache = { at: 0, value: null };
  return getResellerSettings();
}

// Bayiye ozel oran girildiyse o, yoksa genel oran gecerlidir.
function effectiveDiscountPercent(tenant, settings) {
  const own = tenant?.discount_percent;
  return own === null || own === undefined ? settings.discount_percent : Number(own);
}

function resellerCostRate(serviceRateKurus, discountPercent) {
  const rate = Number(serviceRateKurus) || 0;
  if (!(discountPercent > 0)) return rate;
  return Math.max(1, Math.round(rate * (100 - discountPercent) / 100));
}

// priceRow: tenant_service_prices satiri (yoksa null).
// Donus: { rateKurus, costKurus, belowCost, mode, markupPercent }
function sellRate({ costKurus, priceRow, tenant, settings }) {
  if (priceRow && priceRow.fixed_rate_kurus !== null && priceRow.fixed_rate_kurus !== undefined) {
    const fixed = Number(priceRow.fixed_rate_kurus);
    return { rateKurus: fixed, costKurus, belowCost: fixed < costKurus, mode: 'fixed', markupPercent: null };
  }
  const markup = [priceRow?.markup_percent, tenant?.default_markup_percent, settings.default_markup_percent]
    .find(value => value !== null && value !== undefined);
  const markupPercent = toPercent(markup, DEFAULT_SETTINGS.default_markup_percent);
  const rateKurus = Math.ceil(costKurus * (100 + markupPercent) / 100);
  return { rateKurus, costKurus, belowCost: false, mode: 'markup', markupPercent };
}

// Bayinin musterisine gosterilecek katalog. Kapali, maliyetin altina dusmus
// ya da Jet'te pasif servisler listelenmez (includeHidden ile admin gorur).
async function tenantCatalog(tenant, { includeHidden = false } = {}) {
  const settings = await getResellerSettings();
  const discount = effectiveDiscountPercent(tenant, settings);
  const rows = await dbAsync.all(
    `SELECT s.id, s.category_id, s.name, s.name_tr, s.name_en, s.rate_per_1000_kurus, s.rate_per_1000, s.min_quantity, s.max_quantity,
            s.description_tr, s.description_en, s.description, s.refill, s.order_input_type, s.pricing_model,
            s.provider_cancel, s.provider_dripfeed, s.terms_required, s.start_time_tr, s.speed_tr, s.status,
            COALESCE(NULLIF(c.name_tr, ''), c.name) AS category_name, c.sort_order AS category_sort,
            tp.enabled, tp.markup_percent, tp.fixed_rate_kurus, tp.custom_name
       FROM services s
       LEFT JOIN categories c ON c.id = s.category_id
       LEFT JOIN tenant_service_prices tp ON tp.service_id = s.id AND tp.tenant_id = ?
      WHERE s.status = 1 AND s.is_bundle = 0
      ORDER BY COALESCE(c.sort_order, 0), s.category_id, s.id`,
    [tenant.id]
  );
  const list = [];
  for (const row of rows) {
    const baseRateKurus = serviceRateKurus(row);
    const costKurus = resellerCostRate(baseRateKurus, discount);
    const priceRow = row.enabled === null || row.enabled === undefined ? null : row;
    const price = sellRate({ costKurus, priceRow, tenant, settings });
    const enabled = priceRow ? Number(priceRow.enabled) === 1 : true;
    const visible = enabled && !price.belowCost && price.rateKurus > 0;
    if (!visible && !includeHidden) continue;
    list.push({ ...row, base_rate_kurus: baseRateKurus, enabled, visible, price });
  }
  return list;
}

async function tenantPriceForService(tenant, serviceId) {
  const settings = await getResellerSettings();
  const row = await dbAsync.get(
    `SELECT s.id, s.rate_per_1000_kurus, s.rate_per_1000, s.status, s.is_bundle, tp.enabled, tp.markup_percent, tp.fixed_rate_kurus
       FROM services s LEFT JOIN tenant_service_prices tp ON tp.service_id = s.id AND tp.tenant_id = ?
      WHERE s.id = ?`,
    [tenant.id, serviceId]
  );
  // Paket servisler bayi kanalinda satilmaz (bkz. services/bundles.js).
  if (!row || Number(row.status) !== 1 || Number(row.is_bundle) === 1) return null;
  const discountPercent = effectiveDiscountPercent(tenant, settings);
  const costKurus = resellerCostRate(serviceRateKurus(row), discountPercent);
  const priceRow = row.enabled === null || row.enabled === undefined ? null : row;
  const price = sellRate({ costKurus, priceRow, tenant, settings });
  const enabled = priceRow ? Number(priceRow.enabled) === 1 : true;
  return { ...price, enabled, discountPercent, available: enabled && !price.belowCost && price.rateKurus > 0 };
}

async function logTenantActivity(db, { tenantId, actorType, actorId = null, action, details = null, ip = null }) {
  await db.run(
    `INSERT INTO tenant_activity_logs (tenant_id, actor_type, actor_id, action, details, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [tenantId, actorType, actorId, action, details ? JSON.stringify(details) : null, ip ? String(ip).slice(0, 64) : null]
  );
}

// Musteri bakiyesini degistirir ve deftere yazar. Eksiye dusecek dusum
// yapilmaz (null doner). db: transaction baglantisi veya dbAsync.
async function changeCustomerBalance(db, { tenantId, customerId, amountKurus, type, orderId = null, note = null, actor = null }) {
  const amount = Math.trunc(Number(amountKurus));
  if (!Number.isSafeInteger(amount) || amount === 0) throw new Error('Geçersiz bakiye tutarı.');
  const result = await db.run(
    `UPDATE tenant_customers SET balance_kurus = balance_kurus + ?
      WHERE id = ? AND tenant_id = ? AND balance_kurus + ? >= 0`,
    [amount, customerId, tenantId, amount]
  );
  if (result.changes !== 1) return null;
  const row = await db.get('SELECT balance_kurus FROM tenant_customers WHERE id = ?', [customerId]);
  const log = await db.run(
    `INSERT INTO tenant_balance_logs (tenant_id, customer_id, amount_kurus, balance_after_kurus, type, order_id, note, actor)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, customerId, amount, row.balance_kurus, type, orderId, note, actor]
  );
  return { balanceKurus: row.balance_kurus, logId: log.id };
}

// Jet tarafinda sahibine yapilan iade (orders.refunded_kurus) musteriye ayni
// oranda yansitilir: iptal -> tamami, kismi -> teslim edilmeyen pay. Hangi yol
// iade yaparsa yapsin (durum iscisi, admin, saglayici hatasi) bu cagrilir;
// tekrar cagrilmasi guvenlidir (yalnizca fark kadar iade eder).
async function syncTenantRefund(tx, orderId) {
  const order = await tx.get(
    `SELECT id, tenant_id, tenant_customer_id, charge_kurus, refunded_kurus, tenant_charge_kurus, tenant_refunded_kurus
       FROM orders WHERE id = ?`,
    [orderId]
  );
  if (!order?.tenant_customer_id || !(order.tenant_charge_kurus > 0)) return 0;
  const ownerRefund = Math.min(order.refunded_kurus || 0, order.charge_kurus || 0);
  const target = order.charge_kurus > 0
    ? Math.min(order.tenant_charge_kurus, Math.round(order.tenant_charge_kurus * ownerRefund / order.charge_kurus))
    : 0;
  const delta = target - (order.tenant_refunded_kurus || 0);
  if (delta <= 0) return 0;
  const changed = await changeCustomerBalance(tx, {
    tenantId: order.tenant_id,
    customerId: order.tenant_customer_id,
    amountKurus: delta,
    type: 'refund',
    orderId: order.id,
    actor: 'system'
  });
  // Musteri silinmisse iade yazilacak hesap yoktur; siparis yine isaretlenir.
  await tx.run('UPDATE orders SET tenant_refunded_kurus = ? WHERE id = ?', [target, order.id]);
  return changed ? delta : 0;
}

// Bayilik acilis sarti: gercek para ile yuklenen toplam (bonus/kupon haric).
async function realDepositKurus(userId) {
  const row = await dbAsync.get(
    `SELECT COALESCE(SUM(p.amount_kurus), 0) AS total FROM payments p
      WHERE p.user_id = ? AND p.status = 'completed' AND ${PAYMENT_METHOD_GROUP_SQL} IN ${REAL_MONEY_GROUPS}`,
    [userId]
  );
  return row?.total || 0;
}

// Alt alan adinda kullanilir: kankasmm.<taban-alan-adi>
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;
const RESERVED_SLUGS = new Set([
  'www', 'api', 'admin', 'panel', 'app', 'mail', 'smtp', 'ftp', 'ns1', 'ns2', 'cdn', 'static', 'assets',
  'jet', 'jetsmm', 'jetsmmpanel', 'smmjet', 'demo', 'test', 'destek', 'support', 'bayi', 'status'
]);

function validateSlug(value) {
  const slug = String(value || '').trim().toLowerCase();
  if (!SLUG_PATTERN.test(slug) || slug.includes('--')) return { ok: false, slug, reason: 'format' };
  if (RESERVED_SLUGS.has(slug) || /^demo\d*$/.test(slug)) return { ok: false, slug, reason: 'reserved' };
  return { ok: true, slug };
}

module.exports = {
  DEFAULT_SETTINGS,
  getResellerSettings,
  saveResellerSettings,
  effectiveDiscountPercent,
  resellerCostRate,
  sellRate,
  tenantCatalog,
  tenantPriceForService,
  logTenantActivity,
  changeCustomerBalance,
  syncTenantRefund,
  realDepositKurus,
  validateSlug
};
