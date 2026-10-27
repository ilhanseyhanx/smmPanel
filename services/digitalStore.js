'use strict';

// DIJITAL URUNLER — satis, teslimat takibi ve Gmail Checker
//
// SATIN ALMA AKISI (purchase)
//   1. Urun ve saglayici aktif mi, miktar sinirlar icinde mi?
//   2. Saglayicidan canli urun bilgisi: stok yetiyor mu, guncel maliyet satis
//      fiyatini asmis mi (zararina satis yapilmaz)?
//   3. Tek islemde bakiye dusulur + siparis 'pending' yazilir.
//   4. POST /buy:
//        completed -> hesap bilgileri sifreli kaydedilir, musteri aninda gorur
//        pending   -> 'processing'; isci dakikada bir GET /orders/{id} sorar
//        failed / refunded / kesin hata -> tutar iade edilir ('failed')
//        belirsiz hata (zaman asimi, 5xx) -> iade + yoneticiye Telegram
//          uyarisi: saglayicida siparis olusmus olabilir, panelden bakilmali.
//
// GMAIL CHECKER: adres basi sabit TL fiyat (admin ayari). Tutar once dusulur,
// saglayicinin sonuc dondurmedigi adreslerin payi iade edilir. Ayni
// request_id ile tekrar saglayicida ikinci kez ucret almadigi icin ag
// hatasinda istek bir kez yinelenir.

const crypto = require('crypto');
const cron = require('node-cron');
const { dbAsync, withTransaction } = require('../config/database');
const { encryptSecret, decryptSecret, normalizePlainText } = require('../utils/security');
const { fromKurus } = require('../utils/money');
const { DigitalProviderClient } = require('./digitalProvider');
const { changeCustomerBalance } = require('./resellers');

const MAX_CHECK_EMAILS = 1000;
// Uzun sure 'processing' kalan ve tamamlandi deyip hesap gondermeyen
// siparisler bu sureden sonra yoneticiye bildirilir.
const STUCK_MINUTES = 60;

const CHECKER_KEYS = {
  enabled: 'digital_checker_enabled',
  priceKurus: 'digital_checker_price_kurus',
  providerId: 'digital_checker_provider_id'
};

function httpError(status, message, extra = {}) {
  const err = new Error(message);
  err.status = status;
  err.expose = true;
  Object.assign(err, extra);
  return err;
}

function clientFor(provider) {
  let apiKey = '';
  try { apiKey = decryptSecret(provider.api_key_encrypted); } catch { apiKey = ''; }
  return new DigitalProviderClient(provider.api_url, apiKey);
}

async function getProvider(id, { activeOnly = true } = {}) {
  if (!id) return null;
  return dbAsync.get(`SELECT * FROM digital_providers WHERE id = ?${activeOnly ? ' AND status = 1' : ''}`, [id]);
}

async function notifyAdmin(title, lines) {
  try { await require('./telegramNotifier').notifyPaymentEvent(title, lines); } catch { /* bildirim sart degil */ }
}

/** Saglayici maliyetinin TL kurus karsiligi (birim). */
async function costKurusOf(costRate, currency) {
  const cost = Number(costRate);
  if (!Number.isFinite(cost) || cost <= 0) return 0;
  if (String(currency || 'USD').toUpperCase() === 'TRY') return Math.round(cost * 100);
  const { rate } = await require('./fx').getUsdTry();
  return Math.round(cost * Number(rate || 0) * 100);
}

function decryptItems(order) {
  if (!order?.items_encrypted) return [];
  try {
    const items = JSON.parse(decryptSecret(order.items_encrypted));
    return Array.isArray(items) ? items.map(String) : [];
  } catch {
    return [];
  }
}

// Musteriye donen siparis ozeti (hesap bilgileri ayri istenir).
function publicOrder(order) {
  return {
    id: order.id,
    product_id: order.product_id,
    product_name: order.product_name,
    quantity: order.quantity,
    unit_price: fromKurus(order.unit_price_kurus),
    charge: fromKurus(order.charge_kurus),
    refunded: fromKurus(order.refunded_kurus || 0),
    status: order.status,
    item_count: order.item_count || 0,
    failure_reason: order.failure_reason || null,
    created_at: order.created_at,
    completed_at: order.completed_at
  };
}

async function refundInTx(tx, order, amountKurus) {
  const remaining = Math.max(0, Number(order.charge_kurus) - Number(order.refunded_kurus || 0));
  const amount = Math.min(remaining, Math.max(0, Math.round(Number(amountKurus) || 0)));
  if (amount <= 0) return 0;
  await tx.run('UPDATE users SET balance_kurus = balance_kurus + ?, balance = (balance_kurus + ?) / 100.0 WHERE id = ?', [amount, amount, order.user_id]);
  await tx.run('UPDATE digital_orders SET refunded_kurus = refunded_kurus + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [amount, order.id]);
  if (order.tenant_customer_id) await syncDigitalTenantRefund(tx, order.id);
  return amount;
}

// Bayi sitesinden alinan sipariste bayiye (Jet tarafi) yapilan iade, bayinin
// musterisine ayni oranda yansir. Tekrar cagrilmasi guvenlidir: yalnizca fark
// kadar iade eder (SMM tarafindaki syncTenantRefund ile ayni kural).
async function syncDigitalTenantRefund(tx, orderId) {
  const o = await tx.get(
    `SELECT id, tenant_id, tenant_customer_id, charge_kurus, refunded_kurus, tenant_charge_kurus, tenant_refunded_kurus
       FROM digital_orders WHERE id = ?`, [orderId]);
  if (!o?.tenant_customer_id || !(o.tenant_charge_kurus > 0)) return 0;
  const ownerRefund = Math.min(o.refunded_kurus || 0, o.charge_kurus || 0);
  const target = o.charge_kurus > 0
    ? Math.min(o.tenant_charge_kurus, Math.round(o.tenant_charge_kurus * ownerRefund / o.charge_kurus))
    : 0;
  const delta = target - (o.tenant_refunded_kurus || 0);
  if (delta <= 0) return 0;
  const changed = await changeCustomerBalance(tx, {
    tenantId: o.tenant_id, customerId: o.tenant_customer_id, amountKurus: delta,
    type: 'refund', note: `Dijital #D${o.id} iadesi`, actor: 'system'
  });
  if (!changed) return 0; // musteri silinmis olabilir
  await tx.run('UPDATE digital_orders SET tenant_refunded_kurus = tenant_refunded_kurus + ? WHERE id = ?', [delta, o.id]);
  return delta;
}

// Bayi musterisine donen siparis ozeti: tutarlar musterinin odedigidir.
function tenantPublicOrder(order) {
  const base = publicOrder(order);
  return {
    ...base,
    unit_price: fromKurus(Math.round((order.tenant_charge_kurus || 0) / Math.max(1, order.quantity))),
    charge: fromKurus(order.tenant_charge_kurus || 0),
    refunded: fromKurus(order.tenant_refunded_kurus || 0)
  };
}

/**
 * Saglayicinin bildirdigi siparis durumunu uygular (satin alma ve isci ortak).
 * Yalnizca acik (pending/processing) siparislere dokunur.
 * @returns {Promise<object|null>} guncel siparis satiri
 */
async function applyProviderOrder(orderId, providerOrder, { allowEmptyCompletion = false } = {}) {
  let event = null;
  const updated = await withTransaction(async tx => {
    const order = await tx.get('SELECT * FROM digital_orders WHERE id = ?', [orderId]);
    if (!order || !['pending', 'processing'].includes(order.status)) return order;
    const providerOrderId = order.provider_order_id || providerOrder.order_id || null;
    const total = providerOrder.total ?? order.provider_total;

    if (providerOrder.status === 'completed' && (providerOrder.items.length || allowEmptyCompletion)) {
      const items = providerOrder.items.slice(0, 10000);
      await tx.run(
        `UPDATE digital_orders SET status = 'completed', provider_order_id = ?, provider_total = ?,
           items_encrypted = ?, item_count = ?, usage_note = ?, failure_reason = ?,
           completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [providerOrderId, total, encryptSecret(JSON.stringify(items)), items.length,
          providerOrder.usage || order.usage_note || null,
          items.length ? null : 'Sağlayıcı siparişi tamamladı ama hesap bilgisi göndermedi; destek ekibimiz kontrol ediyor.',
          order.id]
      );
      // Bayi siparisinde alici bayinin musterisidir; Jet bildirimi gitmez.
      if (!order.tenant_id) {
        await tx.run('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)', [
          order.user_id, 'order', 'Dijital ürün teslim edildi',
          `#D${order.id} numaralı "${order.product_name}" siparişin hazır. Bilgileri Dijital Ürünler > Siparişlerim bölümünden görebilirsin.`
        ]);
      }
      event = { type: items.length ? 'completed' : 'empty', order };
    } else if (providerOrder.status === 'failed' || providerOrder.status === 'refunded') {
      const refunded = await refundInTx(tx, order, order.charge_kurus);
      await tx.run(
        `UPDATE digital_orders SET status = 'failed', provider_order_id = ?, provider_total = ?,
           failure_reason = COALESCE(failure_reason, ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [providerOrderId, total, 'Sağlayıcı siparişi tamamlayamadı; tutar bakiyene iade edildi.', order.id]
      );
      if (!order.tenant_id) {
        await tx.run('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)', [
          order.user_id, 'order', 'Dijital ürün siparişi iade edildi',
          `#D${order.id} numaralı "${order.product_name}" siparişi tamamlanamadı; ₺${fromKurus(refunded).toFixed(2)} bakiyene iade edildi.`
        ]);
      }
      event = { type: 'failed', order };
    } else if (order.status !== 'processing' || providerOrderId !== order.provider_order_id) {
      await tx.run(
        "UPDATE digital_orders SET status = 'processing', provider_order_id = ?, provider_total = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [providerOrderId, total, order.id]
      );
    }
    return tx.get('SELECT * FROM digital_orders WHERE id = ?', [order.id]);
  });
  if (event?.type === 'empty') {
    notifyAdmin('⚠️ Dijital Ürün: Teslimat Bilgisi Yok', [
      `Sipariş: #D${event.order.id} (sağlayıcı: ${event.order.provider_order_id || providerOrder.order_id || '-'})`,
      `Ürün: ${event.order.product_name} × ${event.order.quantity}`,
      'Sağlayıcı "tamamlandı" dedi ama hesap bilgisi göndermedi. Sağlayıcı panelinden kontrol edin.'
    ]);
  }
  return updated;
}

// ---------------------------------------------------------------------------
// SATIN ALMA
// ---------------------------------------------------------------------------

// tenant (bayi sitesinden alim): { id, customerId, customerName, tenantName,
//   unitCostKurus: bayinin adet alis fiyati (Jet fiyati - bayi indirimi),
//   unitSellKurus: musterinin odedigi adet fiyat }. user = bayinin sahibi.
// Musteri bakiyesi ve sahibin Jet bakiyesi ayni islemde duser.
async function purchase({ user, productId, quantity, tenant = null }) {
  const qty = Number(quantity);
  const product = await dbAsync.get('SELECT * FROM digital_products WHERE id = ? AND status = 1', [productId]);
  if (!product) throw httpError(404, 'Ürün bulunamadı veya satışta değil.', { messageEn: 'Product not found or not for sale.' });
  if (!Number.isSafeInteger(qty) || qty < product.min_quantity || qty > product.max_quantity) {
    throw httpError(400, `Adet ${product.min_quantity} ile ${product.max_quantity} arasında olmalıdır.`, {
      messageEn: `Quantity must be between ${product.min_quantity} and ${product.max_quantity}.`
    });
  }
  const provider = await getProvider(product.provider_id);
  if (!provider) throw httpError(503, 'Bu ürün şu anda satışta değil.', { messageEn: 'This product is currently unavailable.' });
  const client = clientFor(provider);

  // Canli kontrol: stok ve guncel maliyet. Ag hatasinda son bilinen veriyle
  // devam edilir (satin alma zaten basarisiz olursa tutar iade edilir).
  let live = null;
  try {
    live = await client.getProduct(product.provider_slug || product.provider_product_id);
  } catch (err) {
    if (err.definite) throw httpError(409, 'Bu ürün şu anda satışta değil.', { messageEn: 'This product is currently unavailable.' });
  }
  if (live) {
    await dbAsync.run(
      'UPDATE digital_products SET stock = ?, cost_rate = COALESCE(?, cost_rate), synced_at = CURRENT_TIMESTAMP WHERE id = ?',
      [live.stock, live.price, product.id]
    ).catch(() => {});
    if (live.stock !== null) product.stock = live.stock;
    if (live.price !== null) product.cost_rate = live.price;
  }
  if (product.stock !== null && product.stock !== undefined && Number(product.stock) < qty) {
    throw httpError(409, Number(product.stock) > 0
      ? `Stokta yalnızca ${product.stock} adet var.`
      : 'Bu ürünün stoğu tükendi.', {
      messageEn: Number(product.stock) > 0 ? `Only ${product.stock} left in stock.` : 'This product is out of stock.',
      code: 'out_of_stock'
    });
  }
  const unitCostKurus = await costKurusOf(product.cost_rate, product.cost_currency);
  if (unitCostKurus > 0 && unitCostKurus >= product.price_kurus) {
    notifyAdmin('⚠️ Dijital Ürün Zararına Düştü', [
      `Ürün: ${product.name} (#${product.id})`,
      `Satış: ₺${fromKurus(product.price_kurus).toFixed(2)} / adet`,
      `Güncel maliyet: ≈ ₺${fromKurus(unitCostKurus).toFixed(2)} / adet (${product.cost_rate} ${product.cost_currency})`,
      'Satış durduruldu; admin panelinden fiyatı güncelleyin.'
    ]);
    throw httpError(409, 'Bu ürün şu anda satışta değil.', { messageEn: 'This product is currently unavailable.' });
  }
  // Bayi indirimi Jet'i zarara sokuyorsa bayiye satilmaz.
  if (tenant && unitCostKurus > 0 && unitCostKurus >= tenant.unitCostKurus) {
    throw httpError(409, 'Bu ürün şu anda satışta değil.', { messageEn: 'This product is currently unavailable.' });
  }

  const unitPriceKurus = tenant ? tenant.unitCostKurus : product.price_kurus;
  const chargeKurus = unitPriceKurus * qty;
  const tenantChargeKurus = tenant ? tenant.unitSellKurus * qty : 0;
  const orderId = await withTransaction(async tx => {
    let tenantLog = null;
    if (tenant) {
      tenantLog = await changeCustomerBalance(tx, {
        tenantId: tenant.id, customerId: tenant.customerId, amountKurus: -tenantChargeKurus,
        type: 'digital_order', note: `Dijital: ${product.name} × ${qty}`, actor: `customer:${tenant.customerName}`
      });
      if (!tenantLog) {
        throw httpError(402, `Yetersiz bakiye. Gerekli tutar ₺${fromKurus(tenantChargeKurus).toFixed(2)}.`, {
          messageEn: `Not enough balance. Required amount: ${fromKurus(tenantChargeKurus).toFixed(2)} TRY.`,
          code: 'insufficient_balance'
        });
      }
    }
    const debit = await tx.run(
      'UPDATE users SET balance_kurus = balance_kurus - ?, balance = (balance_kurus - ?) / 100.0 WHERE id = ? AND balance_kurus >= ?',
      [chargeKurus, chargeKurus, user.id, chargeKurus]
    );
    if (debit.changes !== 1) {
      // Bayinin Jet bakiyesi bitti: musteri tutar gormez, bayi islem kaydinda gorur.
      if (tenant) {
        throw httpError(503, 'Bu site şu anda sipariş kabul etmiyor. Lütfen daha sonra tekrar dene.', {
          messageEn: 'This site is not accepting orders right now.', code: 'TENANT_OWNER_BALANCE'
        });
      }
      throw httpError(402, `Yetersiz bakiye. Gerekli tutar ₺${fromKurus(chargeKurus).toFixed(2)}.`, {
        messageEn: `Not enough balance. Required amount: ${fromKurus(chargeKurus).toFixed(2)} TRY.`,
        code: 'insufficient_balance'
      });
    }
    const ins = await tx.run(
      `INSERT INTO digital_orders (user_id, product_id, provider_id, product_name, quantity, unit_price_kurus,
         charge_kurus, cost_currency, consent_at, tenant_id, tenant_customer_id, tenant_charge_kurus)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)`,
      [user.id, product.id, provider.id, product.name, qty, unitPriceKurus, chargeKurus, provider.currency || 'USD',
        tenant ? tenant.id : null, tenant ? tenant.customerId : null, tenantChargeKurus]
    );
    if (tenantLog) await tx.run('UPDATE tenant_balance_logs SET note = ? WHERE id = ?', [`Dijital #D${ins.id}: ${product.name} × ${qty}`, tenantLog.logId]);
    return ins.id;
  });

  // Yalnizca saglayici cagrisi iade dalina baglanir: satin alma basariliysa
  // sonraki bir hata (or. veritabani) teslim edilmis urunun parasini iade
  // ettirmemeli.
  let result;
  try {
    result = await client.buy(product.provider_product_id, qty);
  } catch (err) {
    const reason = normalizePlainText(err.message || 'Bilinmeyen hata', 300);
    await withTransaction(async tx => {
      const row = await tx.get('SELECT * FROM digital_orders WHERE id = ?', [orderId]);
      if (!row || !['pending', 'processing'].includes(row.status)) return;
      await refundInTx(tx, row, row.charge_kurus);
      await tx.run(
        "UPDATE digital_orders SET status = 'failed', failure_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [`${err.definite === false ? '[Belirsiz] ' : ''}Sağlayıcı: ${reason}`, orderId]
      );
    });
    if (err.definite === false) {
      notifyAdmin('⚠️ Dijital Ürün: Belirsiz Satın Alma', [
        `Sipariş: #D${orderId} — ${product.name} × ${qty}`,
        `Müşteri: ${user.username}`,
        `Hata: ${reason}`,
        'Müşteriye iade yapıldı. Sağlayıcı panelinde bu sipariş oluşmuş olabilir; kontrol edin.'
      ]);
    }
    throw httpError(502, 'Sipariş tamamlanamadı, tutar bakiyene iade edildi. Lütfen biraz sonra tekrar dene.', {
      messageEn: 'The order could not be completed and the amount was refunded to your balance. Please try again shortly.'
    });
  }

  const order = await applyProviderOrder(orderId, result);
  if (order.status === 'processing' && !order.provider_order_id) {
    notifyAdmin('⚠️ Dijital Ürün: Sipariş Numarası Yok', [
      `Sipariş: #D${orderId} — ${product.name} × ${qty}`,
      'Sağlayıcı siparişi "hazırlanıyor" dedi ama sipariş numarası döndürmedi; otomatik takip edilemiyor. Sağlayıcı panelinden kontrol edin.'
    ]);
  }
  if (order.status !== 'failed') {
    notifyAdmin('🛍️ Dijital Ürün Satıldı', [
      tenant ? `🏪 Bayi: ${tenant.tenantName} (sahibi ${user.username}) · müşteri ${tenant.customerName}` : `👤 Kullanıcı: ${user.username}`,
      `📦 Ürün: ${product.name} × ${qty}`,
      `💰 Tutar: ₺${fromKurus(chargeKurus).toFixed(2)}`,
      order.provider_total !== null && order.provider_total !== undefined
        ? `🏷️ Sağlayıcı maliyeti: ${order.provider_total} ${provider.currency || 'USD'}` : null,
      `📌 Durum: ${order.status === 'completed' ? 'Teslim edildi' : 'Hazırlanıyor'}`
    ].filter(Boolean));
  }

  if (tenant) {
    const customer = await dbAsync.get('SELECT balance_kurus FROM tenant_customers WHERE id = ?', [tenant.customerId]);
    return {
      order: tenantPublicOrder(order),
      items: order.status === 'completed' ? decryptItems(order) : [],
      usage: order.usage_note || '',
      balance: fromKurus(customer?.balance_kurus || 0)
    };
  }
  const balance = await dbAsync.get('SELECT balance_kurus FROM users WHERE id = ?', [user.id]);
  return {
    order: publicOrder(order),
    items: order.status === 'completed' ? decryptItems(order) : [],
    usage: order.usage_note || '',
    balance: fromKurus(balance?.balance_kurus || 0)
  };
}

// ---------------------------------------------------------------------------
// ARKA PLAN: acik siparislerin takibi + stok/maliyet tazeleme
// ---------------------------------------------------------------------------

let syncRunning = false;

async function syncOpenOrders() {
  if (syncRunning) return;
  syncRunning = true;
  try {
    const open = await dbAsync.all(
      `SELECT o.*, (julianday('now') - julianday(o.created_at)) * 1440.0 AS age_minutes
         FROM digital_orders o
        WHERE o.status = 'processing' AND o.provider_order_id IS NOT NULL
        ORDER BY o.id LIMIT 200`
    );
    const clients = new Map();
    for (const order of open) {
      if (!clients.has(order.provider_id)) {
        const provider = await getProvider(order.provider_id);
        clients.set(order.provider_id, provider ? clientFor(provider) : null);
      }
      const client = clients.get(order.provider_id);
      if (!client) continue;
      try {
        const result = await client.getOrder(order.provider_order_id);
        await applyProviderOrder(order.id, result, { allowEmptyCompletion: Number(order.age_minutes) > STUCK_MINUTES });
      } catch (err) {
        // Saglayici siparisi tanimiyorsa (404) yonetici bakmali; tutar
        // otomatik iade edilmez cunku teslimat yapilmis olabilir.
        console.error(`Digital order sync #${order.id}:`, err.message);
      }
    }
  } finally {
    syncRunning = false;
  }
}

/** Urunlerimizin stok ve maliyetini saglayici katalogundan tazeler. */
async function syncCatalog() {
  const providers = await dbAsync.all(
    'SELECT p.* FROM digital_providers p WHERE p.status = 1 AND EXISTS (SELECT 1 FROM digital_products d WHERE d.provider_id = p.id)'
  );
  for (const provider of providers) {
    try {
      const client = clientFor(provider);
      const catalog = await client.listAllProducts();
      const byId = new Map(catalog.map(item => [item.provider_product_id, item]));
      const ours = await dbAsync.all('SELECT id, provider_product_id FROM digital_products WHERE provider_id = ?', [provider.id]);
      await withTransaction(async tx => {
        for (const row of ours) {
          const item = byId.get(String(row.provider_product_id));
          // Katalogdan kalkan urun stoksuz sayilir (satin alma da engellenir).
          await tx.run(
            'UPDATE digital_products SET stock = ?, cost_rate = COALESCE(?, cost_rate), synced_at = CURRENT_TIMESTAMP WHERE id = ?',
            [item ? item.stock : 0, item ? item.price : null, row.id]
          );
        }
      });
      const profile = await client.getProfile().catch(() => null);
      if (profile && Number.isFinite(profile.balance)) {
        await dbAsync.run(
          'UPDATE digital_providers SET balance = ?, currency = ?, balance_checked_at = CURRENT_TIMESTAMP WHERE id = ?',
          [profile.balance, profile.currency, provider.id]
        );
      }
    } catch (err) {
      console.error(`Digital catalog sync [${provider.name}]:`, err.message);
    }
  }
}

function startDigitalWorker() {
  cron.schedule('* * * * *', () => syncOpenOrders().catch(err => console.error('Digital order worker:', err.message)), { noOverlap: true });
  cron.schedule('*/10 * * * *', () => syncCatalog().catch(err => console.error('Digital catalog worker:', err.message)), { noOverlap: true });
}

// ---------------------------------------------------------------------------
// YONETICI ISLEMLERI
// ---------------------------------------------------------------------------

/**
 * Elle iade (or. gecersiz cikan hesap). Tutar verilmezse kalanin tamami.
 * Tamami iade edilen siparis 'refunded' olur; acik siparis ise takipten cikar.
 */
async function adminRefund(orderId, amountKurus = null) {
  return withTransaction(async tx => {
    const order = await tx.get('SELECT * FROM digital_orders WHERE id = ?', [orderId]);
    if (!order) throw httpError(404, 'Sipariş bulunamadı.');
    if (!['completed', 'processing', 'pending'].includes(order.status)) throw httpError(400, 'Bu sipariş iade edilebilir durumda değil.');
    const remaining = order.charge_kurus - order.refunded_kurus;
    if (remaining <= 0) throw httpError(400, 'Bu siparişin tamamı zaten iade edilmiş.');
    const amount = amountKurus === null ? remaining : Math.min(remaining, amountKurus);
    if (!(amount > 0)) throw httpError(400, 'Geçerli bir iade tutarı girin.');
    await refundInTx(tx, order, amount);
    const full = amount >= remaining;
    if (full) await tx.run("UPDATE digital_orders SET status = 'refunded', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [order.id]);
    await tx.run('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)', [
      order.user_id, 'order', 'Dijital ürün iadesi',
      `#D${order.id} numaralı "${order.product_name}" siparişin için ₺${fromKurus(amount).toFixed(2)} bakiyene iade edildi.`
    ]);
    return { refunded_kurus: amount, full };
  });
}

// ---------------------------------------------------------------------------
// GMAIL CHECKER
// ---------------------------------------------------------------------------

async function getCheckerConfig() {
  const rows = await dbAsync.all(
    'SELECT key, value FROM site_settings WHERE key IN (?, ?, ?)',
    [CHECKER_KEYS.enabled, CHECKER_KEYS.priceKurus, CHECKER_KEYS.providerId]
  );
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
  const priceKurus = Number.parseInt(map[CHECKER_KEYS.priceKurus] || '0', 10);
  const providerId = Number.parseInt(map[CHECKER_KEYS.providerId] || '0', 10);
  return {
    enabled: map[CHECKER_KEYS.enabled] === '1',
    priceKurus: Number.isSafeInteger(priceKurus) && priceKurus > 0 ? priceKurus : 0,
    providerId: Number.isSafeInteger(providerId) && providerId > 0 ? providerId : null
  };
}

async function saveCheckerConfig({ enabled, priceKurus, providerId }) {
  const values = [
    [CHECKER_KEYS.enabled, enabled ? '1' : '0'],
    [CHECKER_KEYS.priceKurus, String(Math.max(0, Math.round(Number(priceKurus) || 0)))],
    [CHECKER_KEYS.providerId, providerId ? String(providerId) : '']
  ];
  await withTransaction(async tx => {
    for (const [key, value] of values) {
      await tx.run('INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
    }
  });
  return getCheckerConfig();
}

/** Satir, virgul veya bosluk ile ayrilmis adresler -> tekil, gecerli, kucuk harf. */
function parseEmailList(input) {
  const parts = Array.isArray(input) ? input : String(input || '').split(/[\s,;]+/);
  const seen = new Set();
  const valid = [];
  let invalid = 0;
  for (const part of parts) {
    const email = String(part || '').trim().toLowerCase();
    if (!email) continue;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) { invalid += 1; continue; }
    if (seen.has(email)) continue;
    seen.add(email);
    valid.push(email);
  }
  return { emails: valid, invalid };
}

function summarize(results) {
  const summary = { live: 0, verified: 0, disabled: 0, notexists: 0, unknown: 0 };
  for (const r of results) summary[r.status] = (summary[r.status] || 0) + 1;
  return summary;
}

async function runGmailCheck({ user, emails: input }) {
  const config = await getCheckerConfig();
  const provider = config.enabled && config.priceKurus > 0 ? await getProvider(config.providerId) : null;
  if (!provider) throw httpError(503, 'Gmail Checker şu anda kullanılamıyor.', { messageEn: 'Gmail Checker is currently unavailable.' });
  const { emails } = parseEmailList(input);
  if (!emails.length) throw httpError(400, 'Kontrol edilecek geçerli bir e-posta adresi girin.', { messageEn: 'Enter at least one valid email address.' });
  if (emails.length > MAX_CHECK_EMAILS) {
    throw httpError(400, `Tek seferde en fazla ${MAX_CHECK_EMAILS} adres kontrol edilebilir.`, { messageEn: `You can check at most ${MAX_CHECK_EMAILS} addresses at once.` });
  }

  const chargeKurus = emails.length * config.priceKurus;
  const requestId = `jet-${crypto.randomBytes(12).toString('hex')}`;
  const checkId = await withTransaction(async tx => {
    const debit = await tx.run(
      'UPDATE users SET balance_kurus = balance_kurus - ?, balance = (balance_kurus - ?) / 100.0 WHERE id = ? AND balance_kurus >= ?',
      [chargeKurus, chargeKurus, user.id, chargeKurus]
    );
    if (debit.changes !== 1) {
      throw httpError(402, `Yetersiz bakiye. Gerekli tutar ₺${fromKurus(chargeKurus).toFixed(2)}.`, {
        messageEn: `Not enough balance. Required amount: ${fromKurus(chargeKurus).toFixed(2)} TRY.`,
        code: 'insufficient_balance'
      });
    }
    const ins = await tx.run(
      `INSERT INTO digital_checks (user_id, provider_id, request_id, email_count, unit_price_kurus, charge_kurus)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user.id, provider.id, requestId, emails.length, config.priceKurus, chargeKurus]
    );
    return ins.id;
  });

  const client = clientFor(provider);
  let response = null;
  let lastError = null;
  for (let attempt = 0; attempt < 2 && !response; attempt++) {
    try {
      response = await client.gmailCheck(emails, requestId);
    } catch (err) {
      lastError = err;
      if (err.definite !== false) break;
    }
  }

  if (!response) {
    await withTransaction(async tx => {
      await tx.run('UPDATE users SET balance_kurus = balance_kurus + ?, balance = (balance_kurus + ?) / 100.0 WHERE id = ?', [chargeKurus, chargeKurus, user.id]);
      await tx.run("UPDATE digital_checks SET status = 'failed', refunded_kurus = ?, failure_reason = ? WHERE id = ?",
        [chargeKurus, normalizePlainText(lastError?.message || 'Bilinmeyen hata', 300), checkId]);
    });
    throw httpError(502, 'Kontrol yapılamadı, tutar bakiyene iade edildi. Lütfen biraz sonra tekrar dene.', {
      messageEn: 'The check could not be completed and the amount was refunded. Please try again shortly.'
    });
  }

  // Yalnizca istenen adreslerin ilk sonucu sayilir; sonuc gelmeyenler iade.
  const requested = new Set(emails);
  const byEmail = new Map();
  for (const r of response.results) {
    if (requested.has(r.email) && !byEmail.has(r.email)) byEmail.set(r.email, r.status);
  }
  const results = emails.filter(e => byEmail.has(e)).map(e => ({ email: e, status: byEmail.get(e) }));
  const refundKurus = (emails.length - results.length) * config.priceKurus;
  const summary = summarize(results);
  await withTransaction(async tx => {
    if (refundKurus > 0) {
      await tx.run('UPDATE users SET balance_kurus = balance_kurus + ?, balance = (balance_kurus + ?) / 100.0 WHERE id = ?', [refundKurus, refundKurus, user.id]);
    }
    await tx.run(
      `UPDATE digital_checks SET status = 'completed', checked_count = ?, refunded_kurus = ?, summary = ?,
         results_encrypted = ?, provider_cost = ? WHERE id = ?`,
      [results.length, refundKurus, JSON.stringify(summary), encryptSecret(JSON.stringify(results)), response.cost, checkId]
    );
  });

  const balance = await dbAsync.get('SELECT balance_kurus FROM users WHERE id = ?', [user.id]);
  return {
    id: checkId,
    checked: results.length,
    requested: emails.length,
    charge: fromKurus(chargeKurus - refundKurus),
    refunded: fromKurus(refundKurus),
    summary,
    results,
    balance: fromKurus(balance?.balance_kurus || 0)
  };
}

function decryptCheckResults(row) {
  if (!row?.results_encrypted) return [];
  try {
    const list = JSON.parse(decryptSecret(row.results_encrypted));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

module.exports = {
  MAX_CHECK_EMAILS,
  httpError,
  clientFor,
  getProvider,
  costKurusOf,
  decryptItems,
  publicOrder,
  tenantPublicOrder,
  syncDigitalTenantRefund,
  applyProviderOrder,
  purchase,
  syncOpenOrders,
  syncCatalog,
  startDigitalWorker,
  adminRefund,
  getCheckerConfig,
  saveCheckerConfig,
  parseEmailList,
  runGmailCheck,
  decryptCheckResults
};
