'use strict';

// Bayi (child panel) sisteminin cekirdegi: genel ayarlar, fiyat hesabi,
// bayi musterisi bakiye defteri, bayi islem kaydi ve iade senkronu.
//
// Fiyat zinciri (kurus, servisin kendi biriminde: 1000 adet ya da adet basi):
//   Jet satis fiyati  --(bayi indirimi %)-->  bayi maliyeti
//   bayi maliyeti     --(kar % veya sabit)-->  musterinin gordugu fiyat
// Maliyet her istekte canli hesaplanir; admin indirim oranini ya da servis
// fiyatini degistirip kaydettigi an butun bayilere yansir.
const { dbAsync, withTransaction } = require('../config/database');
const { toKurus } = require('../utils/money');
const { PAYMENT_METHOD_GROUP_SQL, REAL_MONEY_GROUPS } = require('../utils/paymentGroups');

const SETTING_KEYS = {
  public_page_enabled: 'reseller_public_page',
  discount_percent: 'reseller_discount_percent',
  min_deposit_tl: 'reseller_min_deposit_tl',
  applications_open: 'reseller_applications_open',
  default_markup_percent: 'reseller_default_markup_percent',
  monthly_fee_tl: 'reseller_monthly_fee_tl',
  monthly_fee_pro_tl: 'reseller_monthly_fee_pro_tl',
  pro_min_jet_services: 'reseller_pro_min_jet_services',
  trial_days: 'reseller_trial_days',
  grace_days: 'reseller_grace_days',
  delete_after_days: 'reseller_delete_after_days'
};

// public_page_enabled varsayilan KAPALI: admin acana kadar Jet sitesinde
// bayilikle ilgili hicbir sey gorunmez ve basvuru alinmaz. Admin panelinden
// elle bayi acmak her durumda calisir.
const DEFAULT_SETTINGS = Object.freeze({
  public_page_enabled: false,
  discount_percent: 10,
  min_deposit_tl: 500,
  applications_open: true,
  default_markup_percent: 30,
  // Abonelik (28 Eki 2026 karari): iki paket (Standart 599, Pro 999 TL/ay),
  // jetsmmpanel.com alt adresinde 2 gun deneme, sonra kendi alan adi zorunlu;
  // 7 gun gecikme payi, askidan 30 gun sonra silme. Pro'da en az 50 Jet
  // servisi satista kalir ve Jet servisleri Jet fiyatinin altina satilamaz.
  monthly_fee_tl: 599,
  monthly_fee_pro_tl: 999,
  pro_min_jet_services: 50,
  trial_days: 2,
  grace_days: 7,
  delete_after_days: 30
});

// Paketler: tenants.package. Pro'nun ekstralari (kendi saglayicilari, blog,
// satis sayfalari, kendi dijital urunleri) isProTenant ile acilir.
const PACKAGES = Object.freeze({
  standart: { key: 'standart', name: 'Standart', feeKey: 'monthly_fee_tl' },
  pro: { key: 'pro', name: 'Pro', feeKey: 'monthly_fee_pro_tl' }
});

function packageOf(tenant) {
  return tenant?.package === 'pro' ? 'pro' : 'standart';
}

function isProTenant(tenant) {
  return packageOf(tenant) === 'pro';
}

function packageFeeTl(settings, pkg) {
  return Number(settings[PACKAGES[pkg === 'pro' ? 'pro' : 'standart'].feeKey]) || 0;
}

function clampInt(value, fallback, min, max) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

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
    default_markup_percent: toPercent(raw[SETTING_KEYS.default_markup_percent], DEFAULT_SETTINGS.default_markup_percent),
    monthly_fee_tl: toPercent(raw[SETTING_KEYS.monthly_fee_tl], DEFAULT_SETTINGS.monthly_fee_tl),
    monthly_fee_pro_tl: toPercent(raw[SETTING_KEYS.monthly_fee_pro_tl], DEFAULT_SETTINGS.monthly_fee_pro_tl),
    pro_min_jet_services: raw[SETTING_KEYS.pro_min_jet_services] === undefined ? DEFAULT_SETTINGS.pro_min_jet_services : clampInt(raw[SETTING_KEYS.pro_min_jet_services], DEFAULT_SETTINGS.pro_min_jet_services, 0, 10000),
    trial_days: raw[SETTING_KEYS.trial_days] === undefined ? DEFAULT_SETTINGS.trial_days : clampInt(raw[SETTING_KEYS.trial_days], DEFAULT_SETTINGS.trial_days, 0, 60),
    grace_days: raw[SETTING_KEYS.grace_days] === undefined ? DEFAULT_SETTINGS.grace_days : clampInt(raw[SETTING_KEYS.grace_days], DEFAULT_SETTINGS.grace_days, 0, 60),
    delete_after_days: raw[SETTING_KEYS.delete_after_days] === undefined ? DEFAULT_SETTINGS.delete_after_days : clampInt(raw[SETTING_KEYS.delete_after_days], DEFAULT_SETTINGS.delete_after_days, 7, 365)
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
  // Abonelik alanlari istege bagli: eski admin ekrani gondermese de korunur.
  for (const key of ['monthly_fee_tl', 'monthly_fee_pro_tl', 'pro_min_jet_services', 'trial_days', 'grace_days', 'delete_after_days']) {
    if (values[key] !== undefined && values[key] !== null) entries[SETTING_KEYS[key]] = String(values[key]);
  }
  if (values.min_deposit_tl === undefined || values.min_deposit_tl === null) delete entries[SETTING_KEYS.min_deposit_tl];
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
// floorKurus: Pro pakette Jet'in kendi satis fiyati; bayi bunun altina satamaz.
// Donus: { rateKurus, costKurus, belowCost, mode, markupPercent, floorKurus }
function sellRate({ costKurus, priceRow, tenant, settings, floorKurus = 0 }) {
  const floor = Math.max(0, Number(floorKurus) || 0);
  if (priceRow && priceRow.fixed_rate_kurus !== null && priceRow.fixed_rate_kurus !== undefined) {
    const fixed = Math.max(Number(priceRow.fixed_rate_kurus), floor);
    return { rateKurus: fixed, costKurus, belowCost: fixed < costKurus, mode: 'fixed', markupPercent: null, floorKurus: floor };
  }
  const markup = [priceRow?.markup_percent, tenant?.default_markup_percent, settings.default_markup_percent]
    .find(value => value !== null && value !== undefined);
  const markupPercent = toPercent(markup, DEFAULT_SETTINGS.default_markup_percent);
  const rateKurus = Math.max(Math.ceil(costKurus * (100 + markupPercent) / 100), floor);
  return { rateKurus, costKurus, belowCost: false, mode: 'markup', markupPercent, floorKurus: floor };
}

// Pro'da satista kalmasi gereken en az Jet servisi; Jet'te daha az servis
// varsa hepsi.
async function jetServiceCounts(tenantId) {
  const row = await dbAsync.get(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN tp.enabled = 0 THEN 0 ELSE 1 END) AS enabled
       FROM services s LEFT JOIN tenant_service_prices tp ON tp.service_id = s.id AND tp.tenant_id = ?
      WHERE s.status = 1 AND s.is_bundle = 0`, [tenantId]);
  return { total: row.total || 0, enabled: row.enabled || 0 };
}

async function proMinimum(tenantId, settings) {
  const counts = await jetServiceCounts(tenantId);
  return { ...counts, required: Math.min(settings.pro_min_jet_services, counts.total) };
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
    const price = sellRate({ costKurus, priceRow, tenant, settings, floorKurus: isProTenant(tenant) ? baseRateKurus : 0 });
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
  const price = sellRate({ costKurus, priceRow, tenant, settings, floorKurus: isProTenant(tenant) ? serviceRateKurus(row) : 0 });
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

// Bayiligi tamamen siler: musteriler, bakiyeleri, odemeler, sayfalar, alan
// adlari, fiyatlar ve islem kaydi gider. Siparisler ve abonelik faturalari
// Jet tarafinda kalir. Admin silmesi ve abonelik silme isleyicisi kullanir.
async function deleteTenantData(tenantId) {
  await withTransaction(async tx => {
    for (const table of ['tenant_balance_logs', 'tenant_activity_logs', 'tenant_service_prices', 'tenant_digital_prices', 'tenant_payments', 'tenant_mail_settings', 'tenant_mail_log',
      'tenant_payment_settings', 'tenant_pages', 'tenant_domains', 'tenant_customers']) {
      await tx.run(`DELETE FROM ${table} WHERE tenant_id = ?`, [tenantId]);
    }
    await tx.run('DELETE FROM tenants WHERE id = ?', [tenantId]);
  });
  // Yuklenen logo ve simge de silinir.
  await require('./tenantBranding').removeAll(tenantId).catch(() => {});
}

// Alt alan adinda kullanilir: kankasmm.<taban-alan-adi>
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;
const RESERVED_SLUGS = new Set([
  'www', 'api', 'admin', 'panel', 'app', 'mail', 'smtp', 'ftp', 'ns1', 'ns2', 'cdn', 'static', 'assets',
  'jet', 'jetsmm', 'jetsmmpanel', 'smmjet', 'demo', 'test', 'destek', 'support', 'bayi', 'status',
  // Taban alan adinda (seyilstudios.com) baska islere ayrilmis adresler.
  'legal', 'send', 'cf-bounce', 'email', 'mx', 'blog', 'docs', 'help', 'bayi-origin', 'fallback'
]);

function validateSlug(value) {
  const slug = String(value || '').trim().toLowerCase();
  if (!SLUG_PATTERN.test(slug) || slug.includes('--')) return { ok: false, slug, reason: 'format' };
  // demo, demo2, demo-xxx: Jet'in demo siteleri icin ayrilmis.
  if (RESERVED_SLUGS.has(slug) || /^demo(\d*|-.*)$/.test(slug)) return { ok: false, slug, reason: 'reserved' };
  return { ok: true, slug };
}

module.exports = {
  DEFAULT_SETTINGS,
  PACKAGES,
  packageOf,
  isProTenant,
  packageFeeTl,
  jetServiceCounts,
  proMinimum,
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
  deleteTenantData,
  validateSlug
};
