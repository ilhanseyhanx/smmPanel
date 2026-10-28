'use strict';

// Pro: bayinin kendi dijital urunleri (stoklu hesap / lisans). Bayi stogu
// satir satir yukler (her satir bir teslimat, sifreli saklanir); musteri
// bakiyesiyle alir, kayitlar ayni islemde ayrilir ve yalnizca alana
// gosterilir. Para musterinin bayi bakiyesinden duser; Jet'e ucret yoktur.
// Numaralar Jet dijital urunleriyle karismasin diye OWN_ID_BASE'den baslar.
const { dbAsync, withTransaction } = require('../config/database');
const { encryptSecret, decryptSecret } = require('../utils/security');
const { fromKurus } = require('../utils/money');
const { isProTenant, changeCustomerBalance, logTenantActivity } = require('./resellers');
const { OWN_ID_BASE, isOwnId } = require('./tenantOwn');

const toPublic = id => OWN_ID_BASE + Number(id);
const toLocal = id => Number(id) - OWN_ID_BASE;
const MAX_STOCK_UPLOAD = 5000;

function httpError(status, message, messageEn, extra = {}) {
  return Object.assign(new Error(message), { status, expose: true, ...(messageEn ? { messageEn } : {}), ...extra });
}

const STOCK_SQL = '(SELECT COUNT(*) FROM tenant_own_product_items i WHERE i.product_id = p.id AND i.sold_order_id IS NULL)';

function publicProduct(p) {
  return {
    id: toPublic(p.id), name: p.name, category: p.category || '', description: p.description || '',
    price: fromKurus(p.price_kurus), stock: Number(p.stock) || 0, min: p.min_quantity, max: p.max_quantity,
    format: p.item_format || '', delivery_time: 'Anında', warranty_hours: 0, image: p.image_url || null, own: true
  };
}

/** Vitrin: satistaki kendi urunleri (Pro degilse bos). */
async function ownProducts(tenant) {
  if (!isProTenant(tenant)) return [];
  const rows = await dbAsync.all(`SELECT p.*, ${STOCK_SQL} AS stock FROM tenant_own_products p WHERE p.tenant_id = ? AND p.enabled = 1 ORDER BY p.category, p.id`, [tenant.id]);
  return rows.map(publicProduct);
}

/** Panel: hepsi, stok ve satis sayilariyla. */
async function panelProducts(tenantId) {
  const rows = await dbAsync.all(
    `SELECT p.*, ${STOCK_SQL} AS stock,
            (SELECT COUNT(*) FROM tenant_own_product_items i WHERE i.product_id = p.id AND i.sold_order_id IS NOT NULL) AS sold
       FROM tenant_own_products p WHERE p.tenant_id = ? ORDER BY p.id DESC`, [tenantId]);
  return rows.map(p => ({ ...publicProduct(p), local_id: p.id, sold: p.sold, enabled: Boolean(p.enabled), usage_note: p.usage_note || '' }));
}

async function saveProduct(tenant, localId, input) {
  if (!isProTenant(tenant)) throw httpError(403, 'Kendi dijital ürünlerin Pro pakete özel.');
  if (input.image_url && !/^https:\/\/[^\s"'<>]+$/i.test(input.image_url)) throw httpError(400, 'Görsel https:// ile başlayan bir adres olmalı.');
  if (input.min_quantity > input.max_quantity) throw httpError(400, 'En az adet, en çok adetten büyük olamaz.');
  const values = [input.name, input.category || 'Diğer', input.description || null, input.usage_note || null, input.item_format || null,
    input.image_url || null, Math.round(input.price * 100), input.min_quantity, input.max_quantity, input.enabled ? 1 : 0];
  if (localId) {
    const changed = await dbAsync.run(
      `UPDATE tenant_own_products SET name = ?, category = ?, description = ?, usage_note = ?, item_format = ?, image_url = ?,
              price_kurus = ?, min_quantity = ?, max_quantity = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND tenant_id = ?`, [...values, localId, tenant.id]);
    if (changed.changes !== 1) throw httpError(404, 'Ürün bulunamadı.');
    return localId;
  }
  const count = (await dbAsync.get('SELECT COUNT(*) AS n FROM tenant_own_products WHERE tenant_id = ?', [tenant.id])).n;
  if (count >= 200) throw httpError(400, 'En fazla 200 ürün eklenebilir.');
  const created = await dbAsync.run(
    `INSERT INTO tenant_own_products (tenant_id, name, category, description, usage_note, item_format, image_url, price_kurus, min_quantity, max_quantity, enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [tenant.id, ...values]);
  return created.id;
}

async function addStock(tenant, localId, text) {
  if (!isProTenant(tenant)) throw httpError(403, 'Kendi dijital ürünlerin Pro pakete özel.');
  const product = await dbAsync.get('SELECT id FROM tenant_own_products WHERE id = ? AND tenant_id = ?', [localId, tenant.id]);
  if (!product) throw httpError(404, 'Ürün bulunamadı.');
  const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) throw httpError(400, 'Her satıra bir teslimat (örn. e-posta|şifre) yaz.');
  if (lines.length > MAX_STOCK_UPLOAD) throw httpError(400, `Tek seferde en fazla ${MAX_STOCK_UPLOAD} satır yüklenebilir.`);
  if (lines.some(line => line.length > 1000)) throw httpError(400, 'Bir satır en fazla 1000 karakter olabilir.');
  await withTransaction(async tx => {
    for (const line of lines) {
      await tx.run('INSERT INTO tenant_own_product_items (tenant_id, product_id, item_encrypted) VALUES (?, ?, ?)', [tenant.id, product.id, encryptSecret(line)]);
    }
  });
  return lines.length;
}

// Satilmamis stok silinir; satilmislar siparis kaydinda kalir.
async function deleteProduct(tenant, localId) {
  const product = await dbAsync.get('SELECT id FROM tenant_own_products WHERE id = ? AND tenant_id = ?', [localId, tenant.id]);
  if (!product) throw httpError(404, 'Ürün bulunamadı.');
  await dbAsync.run('DELETE FROM tenant_own_product_items WHERE product_id = ?', [product.id]);
  await dbAsync.run('DELETE FROM tenant_own_products WHERE id = ?', [product.id]);
}

function decryptItems(order) {
  try {
    const items = JSON.parse(decryptSecret(order.items_encrypted || ''));
    return Array.isArray(items) ? items.map(String) : [];
  } catch {
    return [];
  }
}

function publicOrder(o) {
  return {
    id: toPublic(o.id), product_id: o.product_id ? toPublic(o.product_id) : null, product_name: o.product_name, quantity: o.quantity,
    unit_price: fromKurus(Math.round(o.charge_kurus / Math.max(1, o.quantity))), charge: fromKurus(o.charge_kurus),
    refunded: fromKurus(o.refunded_kurus), status: o.status, item_count: o.quantity, failure_reason: null,
    created_at: o.created_at, completed_at: o.created_at, own: true
  };
}

/**
 * Satin alma: bakiye duser, stoktan adet kadar kayit ayrilir, siparis yazilir
 * (hepsi tek islem). Donus Jet dijital satin almasiyla ayni bicimdedir.
 */
async function purchase(tenant, customer, { productId, quantity }) {
  if (!isProTenant(tenant)) throw httpError(404, 'Ürün bulunamadı veya satışta değil.', 'Product not found or not for sale.');
  const product = await dbAsync.get(`SELECT p.*, ${STOCK_SQL} AS stock FROM tenant_own_products p WHERE p.id = ? AND p.tenant_id = ? AND p.enabled = 1`,
    [toLocal(productId), tenant.id]);
  if (!product) throw httpError(404, 'Ürün bulunamadı veya satışta değil.', 'Product not found or not for sale.');
  const qty = Number(quantity);
  if (!Number.isSafeInteger(qty) || qty < product.min_quantity || qty > product.max_quantity) {
    throw httpError(400, `Adet ${product.min_quantity} ile ${product.max_quantity} arasında olmalı.`, `Quantity must be between ${product.min_quantity} and ${product.max_quantity}.`);
  }
  if (product.stock < qty) throw httpError(409, `Stokta yalnızca ${product.stock} adet var.`, `Only ${product.stock} in stock.`);
  const charge = product.price_kurus * qty;

  const result = await withTransaction(async tx => {
    const debit = await changeCustomerBalance(tx, {
      tenantId: tenant.id, customerId: customer.id, amountKurus: -charge, type: 'digital_order', note: `${product.name} × ${qty}`, actor: 'customer'
    });
    if (!debit) throw httpError(402, `Yetersiz bakiye. Gerekli tutar ₺${fromKurus(charge).toFixed(2)}.`, `Not enough balance. Required amount: ${fromKurus(charge).toFixed(2)} TRY.`, { code: 'insufficient_balance' });
    const items = await tx.all('SELECT id, item_encrypted FROM tenant_own_product_items WHERE product_id = ? AND sold_order_id IS NULL ORDER BY id LIMIT ?', [product.id, qty]);
    if (items.length < qty) throw httpError(409, 'Stok bu sırada tükendi; tutar düşülmedi.', 'Stock ran out; you were not charged.');
    const plain = items.map(item => decryptSecret(item.item_encrypted));
    const order = await tx.run(
      `INSERT INTO tenant_own_digital_orders (tenant_id, customer_id, product_id, product_name, quantity, charge_kurus, items_encrypted, usage_note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenant.id, customer.id, product.id, product.name, qty, charge, encryptSecret(JSON.stringify(plain)), product.usage_note || null]);
    // Ayni kaydi iki satin alma alamaz: yalnizca hala satilmamis olanlar isaretlenir.
    const marked = await tx.run(
      `UPDATE tenant_own_product_items SET sold_order_id = ? WHERE id IN (${items.map(() => '?').join(',')}) AND sold_order_id IS NULL`,
      [order.id, ...items.map(item => item.id)]);
    if (marked.changes !== qty) throw httpError(409, 'Stok bu sırada tükendi; tutar düşülmedi.', 'Stock ran out; you were not charged.');
    await tx.run('UPDATE tenant_balance_logs SET note = ? WHERE id = ?', [`Dijital #${toPublic(order.id)}: ${product.name} × ${qty}`, debit.logId]);
    return { orderId: order.id, items: plain, balanceKurus: debit.balanceKurus };
  });
  await logTenantActivity(dbAsync, {
    tenantId: tenant.id, actorType: 'customer', actorId: customer.id, action: 'digital_order',
    details: { order_id: toPublic(result.orderId), product: product.name, quantity: qty, charge: fromKurus(charge) }
  }).catch(() => {});
  const order = await dbAsync.get('SELECT * FROM tenant_own_digital_orders WHERE id = ?', [result.orderId]);
  return { order: publicOrder(order), items: result.items, usage: product.usage_note || '', balance: fromKurus(result.balanceKurus) };
}

async function customerOrders(tenantId, customerId) {
  const rows = await dbAsync.all('SELECT * FROM tenant_own_digital_orders WHERE tenant_id = ? AND customer_id = ? ORDER BY id DESC LIMIT 50', [tenantId, customerId]);
  return rows.map(publicOrder);
}

async function customerOrder(tenantId, customerId, publicId) {
  if (!isOwnId(publicId)) return null;
  const row = await dbAsync.get('SELECT * FROM tenant_own_digital_orders WHERE id = ? AND tenant_id = ? AND customer_id = ?', [toLocal(publicId), tenantId, customerId]);
  return row ? { order: publicOrder(row), items: decryptItems(row), usage: row.usage_note || '' } : null;
}

// Panelin "Satislar" sekmesi: kendi urun satislari (maliyet 0, kar = odenen).
async function panelOrders(tenantId) {
  const rows = await dbAsync.all(
    `SELECT o.*, c.username AS customer FROM tenant_own_digital_orders o LEFT JOIN tenant_customers c ON c.id = o.customer_id
      WHERE o.tenant_id = ? ORDER BY o.id DESC LIMIT 50`, [tenantId]);
  return rows.map(o => ({
    id: toPublic(o.id), customer: o.customer, product_name: o.product_name, quantity: o.quantity, status: o.status,
    paid: fromKurus(o.charge_kurus - o.refunded_kurus), refunded: fromKurus(o.refunded_kurus), cost: 0,
    profit: fromKurus(o.charge_kurus - o.refunded_kurus), created_at: o.created_at, own: true
  }));
}

module.exports = { ownProducts, panelProducts, saveProduct, addStock, deleteProduct, purchase, customerOrders, customerOrder, panelOrders, isOwnId };
