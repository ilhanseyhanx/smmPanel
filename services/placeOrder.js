'use strict';

// Siparis olusturmanin TEK dogru yolu.
//
// Onceden iki ayri yol vardi: panel siparisi burada yapilan her seyi yapiyordu,
// /api/v2 "add" ise yalnizca bakiyeyi dusup siparisi 'pending' olarak kaydedip
// birakiyordu. Saglayiciya hic gonderilmedigi ve arka plan isleyicisi de
// yalnizca provider_order_id'si olan siparisleri takip ettigi icin API ile
// verilen siparisler parasi alinmis halde sonsuza kadar bekliyordu.
// Iki yol da artik bu fonksiyonu kullanir.

const { dbAsync, withTransaction } = require('../config/database');
const { toKurus, fromKurus, calculateChargeKurus } = require('../utils/money');
const { normalizePlainText, isSafeHttpUrl } = require('../utils/security');
const { activeServiceDiscount, applyDiscountKurus } = require('./campaigns');
const { validateOrderLink } = require('../utils/linkValidator');
const { friendlyProviderReason } = require('../utils/providerErrors');
const SmmProviderClient = require('./smmProvider');
const telegram = require('./telegramNotifier');

function validTarget(value) {
  if (/^(javascript|data|file):/i.test(value)) return false;
  return !value.includes('://') || isSafeHttpUrl(value);
}

function fail(message, status, messageEn) {
  const err = new Error(message);
  err.status = status;
  if (messageEn) err.messageEn = messageEn;
  return err;
}

/**
 * Bakiyeyi duser, siparisi olusturur ve saglayiciya iletir.
 * Saglayici kabul etmezse tutar ayni istekte iade edilir.
 *
 * @returns {Promise<{orderId:number, providerOrderId:string|null, status:string,
 *   chargeKurus:number, serviceName:string, newBalanceKurus:number}>}
 */
async function placeOrder({
  user,
  serviceId,
  link: rawLink,
  quantity,
  dripRuns = 1,
  dripIntervalMinutes = null,
  lang = 'tr',
  notify = true
}) {
  const link = normalizePlainText(rawLink, 2048);
  if (!validTarget(link)) {
    throw fail('Geçerli bir bağlantı veya kullanıcı adı girin.', 400, 'Enter a valid link or username.');
  }

  // Aktif kampanya indirimi sunucu tarafinda uygulanir; popup'taki vaat ile
  // tahsil edilen tutar birebir ayni olur.
  const discount = await activeServiceDiscount(serviceId);

  const reserved = await withTransaction(async tx => {
    const service = await tx.get(
      `SELECT s.*, c.name AS category_name, c.name_en AS category_name_en
         FROM services s LEFT JOIN categories c ON c.id = s.category_id
        WHERE s.id = ? AND s.status = 1`, [serviceId]);
    if (!service) throw fail('Seçilen servis aktif değil veya bulunamadı.', 404, 'The selected service is not active or was not found.');
    if (quantity < service.min_quantity || quantity > service.max_quantity) {
      throw fail(
        `Miktar ${service.min_quantity} ile ${service.max_quantity} arasında olmalıdır.`, 400,
        `Quantity must be between ${service.min_quantity} and ${service.max_quantity}.`
      );
    }
    // Link tipi servise uymuyorsa siparis saglayiciya HIC gitmesin: bakiye
    // dusulmeden burada durur. Yanlis link = odenmis ama bosa giden siparis.
    const linkCheck = validateOrderLink(link, service, lang);
    if (!linkCheck.ok) throw fail(linkCheck.message, 400, validateOrderLink(link, service, 'en').message);

    let rateKurus = service.rate_per_1000_kurus || toKurus(service.rate_per_1000);
    if (discount) rateKurus = applyDiscountKurus(rateKurus, discount.discount_percent);
    const chargeKurus = calculateChargeKurus(rateKurus, quantity) * dripRuns;
    if (chargeKurus <= 0) throw fail('Hesaplanan sipariş tutarı geçersiz.', 400, 'The calculated order amount is invalid.');

    const debit = await tx.run(
      `UPDATE users
          SET balance_kurus = balance_kurus - ?, balance = (balance_kurus - ?) / 100.0
        WHERE id = ? AND balance_kurus >= ?`,
      [chargeKurus, chargeKurus, user.id, chargeKurus]
    );
    if (debit.changes !== 1) {
      throw fail(
        `Yetersiz bakiye. Gerekli tutar ₺${fromKurus(chargeKurus).toFixed(2)}.`, 400,
        `Not enough balance. Required amount: ${fromKurus(chargeKurus).toFixed(2)} TRY.`
      );
    }
    const order = await tx.run(
      `INSERT INTO orders
         (user_id, service_id, provider_id, link, quantity, charge, charge_kurus, status, drip_runs, drip_interval_minutes)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [user.id, service.id, service.provider_id, link, quantity, fromKurus(chargeKurus), chargeKurus,
        dripRuns, dripRuns > 1 ? dripIntervalMinutes : null]
    );
    return { service, chargeKurus, orderId: order.id };
  });

  let providerOrderId = null;
  let status = 'pending';
  try {
    if (!reserved.service.provider_id) throw new Error('Servise bağlı aktif sağlayıcı bulunmuyor.');
    const provider = await dbAsync.get('SELECT * FROM providers WHERE id = ? AND status = 1', [reserved.service.provider_id]);
    if (!provider) throw new Error('Sağlayıcı aktif değil.');
    const client = new SmmProviderClient(provider.api_url, provider.api_key);
    const response = await client.addOrder(
      reserved.service.provider_service_id, link, quantity,
      { runs: dripRuns, interval: dripIntervalMinutes }
    );
    if (!response?.order) throw new Error(response?.error || 'Sağlayıcı sipariş numarası döndürmedi.');
    providerOrderId = String(response.order);
    status = 'processing';
    await dbAsync.run('UPDATE orders SET provider_order_id = ?, status = ? WHERE id = ?', [providerOrderId, status, reserved.orderId]);
  } catch (providerError) {
    const friendly = friendlyProviderReason(providerError.message);
    await withTransaction(async tx => {
      const order = await tx.get('SELECT status, refunded_kurus FROM orders WHERE id = ?', [reserved.orderId]);
      if (order && order.refunded_kurus === 0) {
        await tx.run('UPDATE users SET balance_kurus = balance_kurus + ?, balance = (balance_kurus + ?) / 100.0 WHERE id = ?',
          [reserved.chargeKurus, reserved.chargeKurus, user.id]);
        // Admin panelde hem anlasilir sebep hem ham saglayici mesaji gorunur.
        await tx.run("UPDATE orders SET status = 'failed', refunded_kurus = ?, failure_reason = ? WHERE id = ?",
          [reserved.chargeKurus, normalizePlainText(`${friendly} [Sağlayıcı: ${providerError.message}]`, 500), reserved.orderId]);
      }
    });
    throw fail(
      `Sipariş alınamadı: ${friendly} Tutar bakiyenize iade edildi.`, 502,
      'The order could not be placed and the amount was refunded to your balance.'
    );
  }

  const updatedUser = await dbAsync.get('SELECT balance_kurus FROM users WHERE id = ?', [user.id]);

  if (notify) {
    // Bildirimler beklenmez; hatalari servis icinde yutulur.
    telegram.notifyOrderOwner(user.id, 'processing', {
      id: reserved.orderId, service_name: reserved.service.name, quantity
    });
    telegram.notifyNewOrder({
      orderId: reserved.orderId,
      username: user.username,
      serviceName: reserved.service.name,
      quantity,
      charge: fromKurus(reserved.chargeKurus),
      link,
      status,
      providerOrderId
    });
  }

  return {
    orderId: reserved.orderId,
    providerOrderId,
    status,
    chargeKurus: reserved.chargeKurus,
    serviceName: reserved.service.name,
    newBalanceKurus: updatedUser.balance_kurus
  };
}

module.exports = { placeOrder, validTarget };
