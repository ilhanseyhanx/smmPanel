'use strict';

// Bayi sitesinde dijital urunler (F5). Katalog Jet'in satistaki dijital
// urunleridir; fiyat zinciri SMM servisleriyle aynidir:
//   Jet adet fiyati --(bayi indirimi %)--> bayinin alis fiyati
//   alis fiyati     --(kar % veya sabit)--> musterinin gordugu fiyat
// Bayi urun bazinda kapatabilir, ozel kar ya da sabit fiyat verebilir.
// Saglayici maliyeti bayinin alis fiyatina ulasan urun bayide gizlenir
// (Jet zararina satmaz).
const { dbAsync } = require('../config/database');
const { getResellerSettings, effectiveDiscountPercent, resellerCostRate, isProTenant } = require('./resellers');
const { tenantSettings } = require('../tenant/resolve');
const digitalStore = require('./digitalStore');
const { fromKurus } = require('../utils/money');

function digitalSettings(tenant) {
  const s = tenantSettings(tenant);
  const own = s.digital_markup_percent;
  return {
    enabled: s.digital_enabled !== false,
    markupPercent: own === undefined || own === null || own === '' || !Number.isFinite(Number(own))
      ? Number(tenant.default_markup_percent ?? 30)
      : Number(own)
  };
}

// floorKurus: Pro pakette Jet'in satis fiyati (altina satilamaz).
function priceFor(priceKurus, row, discountPercent, defaultMarkup, floorKurus = 0) {
  const costKurus = resellerCostRate(priceKurus, discountPercent);
  const floor = Math.max(costKurus, Number(floorKurus) || 0);
  if (row?.fixed_price_kurus) {
    return { costKurus, sellKurus: Math.max(floor, Number(row.fixed_price_kurus)), mode: 'fixed', markupPercent: null, floorKurus: floorKurus || 0 };
  }
  const custom = row?.markup_percent !== null && row?.markup_percent !== undefined;
  const markupPercent = custom ? Number(row.markup_percent) : defaultMarkup;
  return { costKurus, sellKurus: Math.max(floor, Math.round(costKurus * (100 + markupPercent) / 100)), mode: custom ? 'custom' : 'default', markupPercent, floorKurus: floorKurus || 0 };
}

/**
 * Bayinin dijital katalogu. includeHidden: kapali ve zararina dusenler de
 * (bayi paneli icin) listelenir.
 */
async function tenantDigitalCatalog(tenant, { includeHidden = false } = {}) {
  const ds = digitalSettings(tenant);
  if (!ds.enabled && !includeHidden) return [];
  const settings = await getResellerSettings();
  const discount = effectiveDiscountPercent(tenant, settings);
  const rows = await dbAsync.all(
    `SELECT p.*, tp.enabled AS t_enabled, tp.markup_percent AS t_markup, tp.fixed_price_kurus AS t_fixed
       FROM digital_products p
       JOIN digital_providers pr ON pr.id = p.provider_id AND pr.status = 1
       LEFT JOIN tenant_digital_prices tp ON tp.tenant_id = ? AND tp.product_id = p.id
      WHERE p.status = 1
      ORDER BY p.sort_order, p.id`,
    [tenant.id]
  );
  const out = [];
  for (const p of rows) {
    const price = priceFor(p.price_kurus, { markup_percent: p.t_markup, fixed_price_kurus: p.t_fixed }, discount, ds.markupPercent, isProTenant(tenant) ? p.price_kurus : 0);
    const providerCost = await digitalStore.costKurusOf(p.cost_rate, p.cost_currency).catch(() => 0);
    const belowCost = providerCost > 0 && providerCost >= price.costKurus;
    const enabled = p.t_enabled === null || p.t_enabled === undefined ? true : Boolean(p.t_enabled);
    if (!includeHidden && (!enabled || belowCost)) continue;
    out.push({ product: p, price, enabled, belowCost, custom: { markup_percent: p.t_markup, fixed_price_kurus: p.t_fixed } });
  }
  return out;
}

async function tenantDigitalItem(tenant, productId) {
  return (await tenantDigitalCatalog(tenant)).find(row => row.product.id === Number(productId)) || null;
}

// Vitrinde gosterilen urun (Jet'in alis fiyati ve saglayici bilgisi gizli).
function publicProduct(row) {
  const p = row.product;
  return {
    id: p.id,
    name: p.name,
    category: p.category || '',
    description: p.description || '',
    price: fromKurus(row.price.sellKurus),
    stock: p.stock === null || p.stock === undefined ? null : Number(p.stock),
    min: p.min_quantity,
    max: p.max_quantity,
    format: p.item_format || '',
    delivery_time: p.delivery_time || '',
    warranty_hours: Number(p.warranty_hours) || 0,
    image: p.image_url || null
  };
}

module.exports = { digitalSettings, priceFor, tenantDigitalCatalog, tenantDigitalItem, publicProduct };
