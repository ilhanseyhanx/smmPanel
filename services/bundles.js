'use strict';

// PAKET SERVISLER (27 Eyl 2026)
//
// Admin, birden fazla servisi (orn. 1000 izlenme + 100 begeni + 50 kaydetme)
// TEK bir "paket servis" olarak satisa cikarir. Paket, services tablosunda
// is_bundle = 1 olan sıradan bir satirdir (fiyat, ad, aciklama, kategori
// hepsi orada); icerigi service_bundle_items tablosunda durur.
//
// Siparis modeli: paket icin AYRI bir "ana siparis" YOKTUR. Musteri paketi
// aldiginda her bilesen icin normal bir siparis (orders satiri) acilir;
// hepsi ayni bundle_group kimligini ve bundle_service_id'yi tasir. Boylece:
//   - saglayici durum senkronu, telafi, kismi iade (orderWorker) aynen calisir
//   - ciro/kar raporlari cift saymaz (paket tutari bilesenlere pay edilir)
//   - admin her bileseni ayri ayri yonetebilir
// Paket tutari bilesenlerin tek basina degerleriyle ORANTILI olarak paylasilir;
// kurus farki son bilesene yazilir ki toplam kurusu kurusuna tutsun.

const crypto = require('crypto');
const { dbAsync, withTransaction } = require('../config/database');
const { toKurus, fromKurus } = require('../utils/money');
const { normalizePlainText, isSafeHttpUrl } = require('../utils/security');
const { activeServiceDiscount, applyDiscountKurus } = require('./campaigns');
const { validateOrderLink } = require('../utils/linkValidator');
const { friendlyProviderReason } = require('../utils/providerErrors');
const SmmProviderClient = require('./smmProvider');
const telegram = require('./telegramNotifier');
const {
  normalizeOrderInputType,
  calculateServiceChargeKurus,
  providerQuantityFor
} = require('./orderTypes');

const MIN_ITEMS = 2;
const MAX_ITEMS = 10;

function fail(message, status, messageEn) {
  const err = new Error(message);
  err.status = status;
  if (messageEn) err.messageEn = messageEn;
  return err;
}

function validTarget(value) {
  if (/^(javascript|data|file):/i.test(value)) return false;
  return !value.includes('://') || isSafeHttpUrl(value);
}

// Paketin icerigi, bilesen servis bilgileriyle birlikte (admin ekrani ve siparis).
async function bundleItemsOf(db, bundleId) {
  return db.all(
    `SELECT bi.id, bi.bundle_service_id, bi.component_service_id, bi.quantity, bi.sort_order,
            s.name, s.name_tr, s.name_en, s.status, s.provider_id, s.provider_service_id,
            s.min_quantity, s.max_quantity, s.rate_per_1000, s.rate_per_1000_kurus, s.pricing_model,
            s.order_input_type, s.refill, s.provider_quantity_multiplier, s.provider_overage_percent,
            s.category_id, c.name AS category_name, c.name_en AS category_name_en,
            p.name AS provider_name, p.status AS provider_status
       FROM service_bundle_items bi
       JOIN services s ON s.id = bi.component_service_id
       LEFT JOIN categories c ON c.id = s.category_id
       LEFT JOIN providers p ON p.id = s.provider_id
      WHERE bi.bundle_service_id = ?
      ORDER BY bi.sort_order ASC, bi.id ASC`,
    [bundleId]
  );
}

// Tum paketlerin icerigi tek sorguda: public katalog (bilgi penceresi) icin.
async function bundleItemsMap(db = dbAsync) {
  const rows = await db.all(
    `SELECT bi.bundle_service_id, bi.component_service_id AS service_id, bi.quantity,
            s.name, s.name_tr, s.name_en, s.status
       FROM service_bundle_items bi JOIN services s ON s.id = bi.component_service_id
      ORDER BY bi.bundle_service_id, bi.sort_order, bi.id`
  );
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.bundle_service_id)) map.set(row.bundle_service_id, []);
    map.get(row.bundle_service_id).push(row);
  }
  return map;
}

// Bilesenin tek basina alinsa tutacagi tutar (kurus). Fiyat onerisi ve pay
// hesabi icin; gecersiz durumda 0 doner, asla firlatmaz.
function componentValueKurus(item, packages = 1) {
  try {
    const rate = item.rate_per_1000_kurus || toKurus(item.rate_per_1000 || 0);
    return calculateServiceChargeKurus(rate, Number(item.quantity) * Number(packages), item.pricing_model);
  } catch {
    return 0;
  }
}

// Paket tutarini bilesenlere pay eder; toplam tam olarak totalKurus eder.
function splitChargeKurus(totalKurus, items, packages = 1) {
  const values = items.map(item => componentValueKurus(item, packages));
  const sum = values.reduce((acc, value) => acc + value, 0);
  const shares = [];
  let used = 0;
  items.forEach((item, index) => {
    let share;
    if (index === items.length - 1) share = totalKurus - used;
    else share = sum > 0 ? Math.floor(totalKurus * values[index] / sum) : Math.floor(totalKurus / items.length);
    share = Math.max(0, share);
    shares.push(share);
    used += share;
  });
  return shares;
}

// Admin kaydi icin bilesen listesi dogrulamasi.
// rawItems: [{ service_id, quantity }] -> [{ component_service_id, quantity, sort_order }]
async function validateComponents(db, rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length < MIN_ITEMS) {
    throw fail(`Paket en az ${MIN_ITEMS} servisten oluşmalıdır.`, 400);
  }
  if (rawItems.length > MAX_ITEMS) throw fail(`Paket en fazla ${MAX_ITEMS} servis içerebilir.`, 400);
  const ids = rawItems.map(item => Number(item.service_id));
  if (new Set(ids).size !== ids.length) throw fail('Aynı servis pakete iki kez eklenemez.', 400);
  const rows = await db.all(
    `SELECT id, name, name_tr, status, is_bundle, order_input_type, min_quantity, max_quantity
       FROM services WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids
  );
  const byId = new Map(rows.map(row => [row.id, row]));
  return rawItems.map((raw, index) => {
    const service = byId.get(Number(raw.service_id));
    if (!service) throw fail(`#${raw.service_id} numaralı servis bulunamadı.`, 400);
    const label = service.name_tr || service.name;
    if (Number(service.is_bundle) === 1) throw fail(`"${label}" zaten bir paket; paket içine paket eklenemez.`, 400);
    if (Number(service.status) !== 1) throw fail(`"${label}" pasif; pakete yalnızca aktif servisler eklenebilir.`, 400);
    if (normalizeOrderInputType(service.order_input_type) !== 'link') {
      throw fail(`"${label}" bağlantı ile sipariş edilen bir servis değil; pakete eklenemez.`, 400);
    }
    const quantity = Number(raw.quantity);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) throw fail(`"${label}" için geçerli bir adet girin.`, 400);
    if (quantity < service.min_quantity || quantity > service.max_quantity) {
      throw fail(`"${label}" adedi ${service.min_quantity} - ${service.max_quantity} arasında olmalıdır.`, 400);
    }
    return { component_service_id: service.id, quantity, sort_order: index };
  });
}

// Musteri paketi satin alir: her bilesen icin ayri siparis, tek tahsilat.
async function placeBundleOrder({
  user,
  serviceId,
  link: rawLink,
  quantity,
  dripRuns = 1,
  lang = 'tr',
  termsAccepted = false,
  notify = true,
  tenant = null
}) {
  if (tenant) {
    throw fail('Paket servisler bayi panelinden sipariş edilemez.', 400, 'Bundle services cannot be ordered from a reseller panel.');
  }
  if (Number(dripRuns) > 1) {
    throw fail('Paket servislerde kademeli gönderim kullanılamaz.', 400, 'Drip-feed is not available for bundle services.');
  }
  const link = normalizePlainText(rawLink, 2048);
  const discount = await activeServiceDiscount(serviceId);

  const reserved = await withTransaction(async tx => {
    const bundle = await tx.get(
      `SELECT s.*, c.name AS category_name FROM services s LEFT JOIN categories c ON c.id = s.category_id
        WHERE s.id = ? AND s.status = 1 AND s.is_bundle = 1`, [serviceId]
    );
    if (!bundle) throw fail('Seçilen paket aktif değil veya bulunamadı.', 404, 'The selected bundle is not active or was not found.');

    const packages = Number(quantity);
    if (!Number.isSafeInteger(packages) || packages <= 0) throw fail('Geçerli bir paket adedi girin.', 400, 'Enter a valid package quantity.');
    if (packages < bundle.min_quantity || packages > bundle.max_quantity) {
      throw fail(
        `Paket adedi ${bundle.min_quantity} ile ${bundle.max_quantity} arasında olmalıdır.`, 400,
        `Package quantity must be between ${bundle.min_quantity} and ${bundle.max_quantity}.`
      );
    }
    if (!validTarget(link)) throw fail('Geçerli bir bağlantı veya kullanıcı adı girin.', 400, 'Enter a valid link or username.');
    if (Number(bundle.terms_required) === 1 && !termsAccepted) {
      throw fail('Teslimat, garanti ve iade koşullarını kabul etmelisiniz.', 400, 'You must accept the delivery, warranty, and refund terms.');
    }

    const items = await bundleItemsOf(tx, bundle.id);
    if (!items.length) throw fail('Paketin içeriği tanımlı değil; lütfen destek ile iletişime geçin.', 409, 'This bundle has no contents yet; please contact support.');
    for (const item of items) {
      const nameTr = item.name_tr || item.name;
      const nameEn = item.name_en || item.name;
      if (Number(item.status) !== 1 || !item.provider_id || Number(item.provider_status) !== 1) {
        throw fail(
          `Paketteki "${nameTr}" servisi şu anda aktif değil; paket geçici olarak sipariş edilemiyor.`, 409,
          `The "${nameEn}" service in this bundle is currently unavailable; the bundle cannot be ordered right now.`
        );
      }
      const componentQty = item.quantity * packages;
      if (componentQty < item.min_quantity || componentQty > item.max_quantity) {
        throw fail(
          `Bu paket adedinde "${nameTr}" servisinin sınırı aşılıyor (${item.min_quantity} - ${item.max_quantity}). Paket adedini değiştirin.`, 400,
          `This package quantity exceeds the limit of "${nameEn}" (${item.min_quantity} - ${item.max_quantity}). Change the package quantity.`
        );
      }
      const check = validateOrderLink(link, item, lang);
      if (!check.ok) throw fail(check.message, 400, validateOrderLink(link, item, 'en').message);
    }

    const baseRateKurus = bundle.rate_per_1000_kurus || toKurus(bundle.rate_per_1000);
    const rateKurus = discount ? applyDiscountKurus(baseRateKurus, discount.discount_percent) : baseRateKurus;
    // Paket her zaman adet bazli fiyatlanir: tutar = paket fiyati x paket adedi.
    const chargeKurus = calculateServiceChargeKurus(rateKurus, packages, 'per_item');
    if (chargeKurus <= 0) throw fail('Hesaplanan sipariş tutarı geçersiz.', 400, 'The calculated order amount is invalid.');

    const debit = await tx.run(
      `UPDATE users SET balance_kurus = balance_kurus - ?, balance = (balance_kurus - ?) / 100.0
        WHERE id = ? AND balance_kurus >= ?`,
      [chargeKurus, chargeKurus, user.id, chargeKurus]
    );
    if (debit.changes !== 1) {
      throw fail(
        `Yetersiz bakiye. Gerekli tutar ₺${fromKurus(chargeKurus).toFixed(2)}.`, 400,
        `Not enough balance. Required amount: ${fromKurus(chargeKurus).toFixed(2)} TRY.`
      );
    }

    const shares = splitChargeKurus(chargeKurus, items, packages);
    const group = `${bundle.id}-${crypto.randomBytes(6).toString('hex')}`;
    const termsAt = Number(bundle.terms_required) === 1 ? new Date().toISOString() : null;
    const children = [];
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const componentQty = item.quantity * packages;
      const providerQuantity = providerQuantityFor(item, componentQty);
      const row = await tx.run(
        `INSERT INTO orders
           (user_id, service_id, provider_id, link, quantity, provider_quantity, charge, charge_kurus, status,
            drip_runs, order_input_type, delivery_status, terms_accepted_at, bundle_service_id, bundle_group)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 1, 'link', 'none', ?, ?, ?)`,
        [user.id, item.component_service_id, item.provider_id, link, componentQty, providerQuantity,
          fromKurus(shares[index]), shares[index], termsAt, bundle.id, group]
      );
      children.push({ orderId: row.id, item, quantity: componentQty, providerQuantity, shareKurus: shares[index] });
    }
    try { require('./serviceStats').invalidateServiceStats(); } catch { /* istatistik sart degil */ }
    return { bundle, chargeKurus, group, children };
  });

  // Saglayicilara gonderim: her bilesen ayri gider; iletilemeyen bilesenin
  // payi aninda iade edilir, digerleri normal akista devam eder.
  const placed = [];
  const failed = [];
  for (const child of reserved.children) {
    try {
      const provider = await dbAsync.get('SELECT * FROM providers WHERE id = ? AND status = 1', [child.item.provider_id]);
      if (!provider) throw new Error('Sağlayıcı aktif değil.');
      const client = new SmmProviderClient(provider.api_url, provider.api_key, { id: provider.id });
      const response = await client.addOrder(child.item.provider_service_id, link, child.providerQuantity, {});
      if (!response?.order) throw new Error(response?.error || 'Sağlayıcı sipariş numarası döndürmedi.');
      const providerOrderId = String(response.order);
      await dbAsync.run("UPDATE orders SET provider_order_id = ?, status = 'processing' WHERE id = ?", [providerOrderId, child.orderId]);
      placed.push({ ...child, providerOrderId });
    } catch (providerError) {
      const friendly = friendlyProviderReason(providerError.message);
      await withTransaction(async tx => {
        const order = await tx.get('SELECT status, refunded_kurus FROM orders WHERE id = ?', [child.orderId]);
        if (!order || order.refunded_kurus !== 0) return;
        if (child.shareKurus > 0) {
          await tx.run(
            'UPDATE users SET balance_kurus = balance_kurus + ?, balance = (balance_kurus + ?) / 100.0 WHERE id = ?',
            [child.shareKurus, child.shareKurus, user.id]
          );
        }
        await tx.run(
          "UPDATE orders SET status = 'failed', refunded_kurus = ?, failure_reason = ? WHERE id = ?",
          [child.shareKurus, normalizePlainText(`${friendly} [Sağlayıcı: ${providerError.message}]`, 500), child.orderId]
        );
      });
      failed.push({ ...child, reason: friendly });
    }
  }

  const refundedKurus = failed.reduce((acc, item) => acc + item.shareKurus, 0);
  if (!placed.length) {
    const err = fail(
      `Sipariş alınamadı: ${failed[0]?.reason || ''} Tutar bakiyenize iade edildi.`.replace(/\s+/g, ' ').trim(), 502,
      'The order could not be placed and the amount was refunded to your balance.'
    );
    err.expose = true;
    throw err;
  }

  const updatedUser = await dbAsync.get('SELECT balance_kurus FROM users WHERE id = ?', [user.id]);
  const packages = Number(quantity);
  if (notify) {
    telegram.notifyOrderOwner(user.id, 'processing', {
      id: placed[0].orderId,
      service_name: reserved.bundle.name,
      quantity: packages
    });
    telegram.notifyNewOrder({
      orderId: placed.map(item => item.orderId).join(', '),
      username: user.username,
      serviceName: `📦 ${reserved.bundle.name} (${placed.length}/${reserved.children.length} bileşen)`,
      quantity: packages,
      providerQuantity: null,
      charge: fromKurus(reserved.chargeKurus - refundedKurus),
      link,
      status: 'processing',
      providerOrderId: placed.map(item => item.providerOrderId).join(', ')
    });
  }

  return {
    orderId: placed[0].orderId,
    providerOrderId: placed.map(item => item.providerOrderId).join(','),
    status: 'processing',
    chargeKurus: reserved.chargeKurus - refundedKurus,
    tenantChargeKurus: 0,
    serviceName: reserved.bundle.name,
    quantity: packages,
    newBalanceKurus: updatedUser.balance_kurus,
    bundle: {
      service_id: reserved.bundle.id,
      group: reserved.group,
      orders: placed.map(item => item.orderId),
      failed: failed.map(item => ({ order_id: item.orderId, reason: item.reason, refunded: fromKurus(item.shareKurus) })),
      refundedKurus
    }
  };
}

module.exports = {
  MIN_ITEMS,
  MAX_ITEMS,
  bundleItemsOf,
  bundleItemsMap,
  componentValueKurus,
  splitChargeKurus,
  validateComponents,
  placeBundleOrder
};
