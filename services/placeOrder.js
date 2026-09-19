'use strict';

// Panel ve bayi API siparisleri bu tek akis uzerinden gecer.
const { dbAsync, withTransaction } = require('../config/database');
const { toKurus, fromKurus } = require('../utils/money');
const {
  normalizePlainText,
  isSafeHttpUrl,
  encryptSecret,
  createOpaqueToken,
  tokenHash
} = require('../utils/security');
const { activeServiceDiscount, applyDiscountKurus } = require('./campaigns');
const { changeCustomerBalance, syncTenantRefund } = require('./resellers');
const { validateOrderLink } = require('../utils/linkValidator');
const { friendlyProviderReason } = require('../utils/providerErrors');
const SmmProviderClient = require('./smmProvider');
const telegram = require('./telegramNotifier');
const {
  normalizeOrderInputType,
  normalizeComments,
  isEmail,
  calculateServiceChargeKurus,
  providerQuantityFor,
  relayAddressFromToken
} = require('./orderTypes');

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

async function placeOrder({
  user,
  serviceId,
  link: rawLink,
  quantity,
  dripRuns = 1,
  dripIntervalMinutes = null,
  lang = 'tr',
  comments = '',
  termsAccepted = false,
  notify = true,
  // Bayi sitesinden gelen siparis: { id, customerId, sellRateKurus, discountPercent }.
  // user bu durumda bayinin sahibidir; musteri bayinin fiyatindan, sahip ise
  // indirimli maliyetten AYNI islemde odenir.
  tenant = null
}) {
  const link = normalizePlainText(rawLink, 2048);
  const commentLines = normalizeComments(comments);
  const discount = await activeServiceDiscount(serviceId);

  const reserved = await withTransaction(async tx => {
    const service = await tx.get(
      `SELECT s.*, c.name AS category_name, c.name_en AS category_name_en
         FROM services s LEFT JOIN categories c ON c.id = s.category_id
        WHERE s.id = ? AND s.status = 1`, [serviceId]
    );
    if (!service) throw fail('Seçilen servis aktif değil veya bulunamadı.', 404, 'The selected service is not active or was not found.');

    const inputType = normalizeOrderInputType(service.order_input_type);
    const requestedQuantity = inputType === 'custom_comments' ? commentLines.length : Number(quantity);
    if (!Number.isSafeInteger(requestedQuantity) || requestedQuantity <= 0) {
      throw fail('Geçerli bir miktar girin.', 400, 'Enter a valid quantity.');
    }
    if (inputType === 'custom_comments' && !commentLines.length) {
      throw fail('Her satıra bir yorum gelecek şekilde en az bir yorum girin.', 400, 'Enter at least one comment, one per line.');
    }
    if (requestedQuantity < service.min_quantity || requestedQuantity > service.max_quantity) {
      throw fail(
        `Miktar ${service.min_quantity} ile ${service.max_quantity} arasında olmalıdır.`, 400,
        `Quantity must be between ${service.min_quantity} and ${service.max_quantity}.`
      );
    }

    if (inputType === 'email_delivery' || inputType === 'email_invite') {
      if (!isEmail(link)) throw fail('Geçerli bir teslimat e-posta adresi girin.', 400, 'Enter a valid delivery email address.');
    } else {
      if (!validTarget(link)) {
        throw fail('Geçerli bir bağlantı, kullanıcı adı veya oyuncu kimliği girin.', 400, 'Enter a valid link, username, or player ID.');
      }
      if (inputType !== 'player_id') {
        const linkCheck = validateOrderLink(link, service, lang);
        if (!linkCheck.ok) throw fail(linkCheck.message, 400, validateOrderLink(link, service, 'en').message);
      }
    }
    if (Number(service.terms_required) === 1 && !termsAccepted) {
      throw fail('Teslimat, garanti ve iade koşullarını kabul etmelisiniz.', 400, 'You must accept the delivery, warranty, and refund terms.');
    }
    if (inputType !== 'link' && dripRuns > 1) {
      throw fail('Bu servis türünde kademeli gönderim kullanılamaz.', 400, 'Drip-feed is not available for this service type.');
    }

    const baseRateKurus = service.rate_per_1000_kurus || toKurus(service.rate_per_1000);
    let rateKurus = baseRateKurus;
    if (discount) rateKurus = applyDiscountKurus(baseRateKurus, discount.discount_percent);
    // Bayi maliyeti: kampanya ile bayi indiriminden hangisi ucuzsa o.
    if (tenant && tenant.discountPercent > 0) {
      rateKurus = Math.min(rateKurus, applyDiscountKurus(baseRateKurus, tenant.discountPercent));
    }
    const chargeKurus = calculateServiceChargeKurus(rateKurus, requestedQuantity, service.pricing_model) * dripRuns;
    if (chargeKurus <= 0) throw fail('Hesaplanan sipariş tutarı geçersiz.', 400, 'The calculated order amount is invalid.');

    let tenantChargeKurus = 0;
    let tenantLogId = null;
    if (tenant) {
      tenantChargeKurus = calculateServiceChargeKurus(tenant.sellRateKurus, requestedQuantity, service.pricing_model) * dripRuns;
      // Maliyetin altinda satis yapilmaz (bayi zarar etmesin).
      if (!(tenantChargeKurus >= chargeKurus)) {
        throw fail('Bu servis şu anda satışta değil.', 400, 'This service is currently unavailable.');
      }
      // Once musteri: yetersiz bakiye musterinin kendi hatasidir ve oncelikle
      // o soylenir. Bayinin bakiyesi yetmezse asagida hepsi geri alinir.
      const debited = await changeCustomerBalance(tx, {
        tenantId: tenant.id,
        customerId: tenant.customerId,
        amountKurus: -tenantChargeKurus,
        type: 'order',
        actor: 'customer'
      });
      if (!debited) {
        throw fail(
          `Yetersiz bakiye. Gerekli tutar ₺${fromKurus(tenantChargeKurus).toFixed(2)}.`, 400,
          `Not enough balance. Required amount: ${fromKurus(tenantChargeKurus).toFixed(2)} TRY.`
        );
      }
      tenantLogId = debited.logId;
    }

    const providerQuantity = providerQuantityFor(service, requestedQuantity);
    // E-posta altyapilari yerel kismi kucuk harfe cevirebilir. Tokeni bastan
    // kucuk harfli tutarak RCPT TO normalizasyonunda siparis eslesmesini koruruz.
    const relayToken = inputType === 'email_delivery' ? createOpaqueToken().toLowerCase() : null;
    const providerTarget = relayToken ? relayAddressFromToken(relayToken) : link;
    const securePayload = inputType === 'custom_comments'
      ? encryptSecret(JSON.stringify({ comments: commentLines }))
      : null;

    const debit = await tx.run(
      `UPDATE users
          SET balance_kurus = balance_kurus - ?, balance = (balance_kurus - ?) / 100.0
        WHERE id = ? AND balance_kurus >= ?`,
      [chargeKurus, chargeKurus, user.id, chargeKurus]
    );
    if (debit.changes !== 1 && tenant) {
      // Bayinin Jet bakiyesi bitmis: musteriye maliyet/tutar gosterilmez.
      const err = fail(
        'Bu servis şu anda geçici olarak kullanılamıyor. Lütfen biraz sonra tekrar deneyin.', 503,
        'This service is temporarily unavailable. Please try again shortly.'
      );
      err.expose = true;
      err.code = 'TENANT_OWNER_BALANCE';
      err.requiredKurus = chargeKurus;
      throw err;
    }
    if (debit.changes !== 1) {
      throw fail(
        `Yetersiz bakiye. Gerekli tutar ₺${fromKurus(chargeKurus).toFixed(2)}.`, 400,
        `Not enough balance. Required amount: ${fromKurus(chargeKurus).toFixed(2)} TRY.`
      );
    }

    const order = await tx.run(
      `INSERT INTO orders
         (user_id, service_id, provider_id, link, quantity, provider_quantity, charge, charge_kurus, status,
          drip_runs, drip_interval_minutes, order_input_type, secure_payload, delivery_email,
          delivery_token_hash, delivery_status, terms_accepted_at,
          tenant_id, tenant_customer_id, tenant_charge_kurus)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id, service.id, service.provider_id, link, requestedQuantity, providerQuantity,
        fromKurus(chargeKurus), chargeKurus, dripRuns, dripRuns > 1 ? dripIntervalMinutes : null,
        inputType, securePayload,
        inputType === 'email_delivery' || inputType === 'email_invite' ? link : null,
        relayToken ? tokenHash(relayToken) : null,
        inputType === 'email_delivery' ? 'waiting' : 'none',
        Number(service.terms_required) === 1 ? new Date().toISOString() : null,
        tenant ? tenant.id : null,
        tenant ? tenant.customerId : null,
        tenantChargeKurus
      ]
    );
    if (tenant) {
      await tx.run('UPDATE tenant_balance_logs SET order_id = ? WHERE id = ?', [order.id, tenantLogId]);
      await tx.run('UPDATE tenants SET last_order_at = CURRENT_TIMESTAMP WHERE id = ?', [tenant.id]);
    }
    return {
      service,
      chargeKurus,
      tenantChargeKurus,
      orderId: order.id,
      quantity: requestedQuantity,
      providerQuantity,
      providerTarget,
      inputType,
      commentLines
    };
  });

  let providerOrderId = null;
  let status = 'pending';
  try {
    if (!reserved.service.provider_id) throw new Error('Servise bağlı aktif sağlayıcı bulunmuyor.');
    const provider = await dbAsync.get('SELECT * FROM providers WHERE id = ? AND status = 1', [reserved.service.provider_id]);
    if (!provider) throw new Error('Sağlayıcı aktif değil.');
    const client = new SmmProviderClient(provider.api_url, provider.api_key, { id: provider.id });
    const response = await client.addOrder(
      reserved.service.provider_service_id,
      reserved.providerTarget,
      reserved.providerQuantity,
      {
        runs: dripRuns,
        interval: dripIntervalMinutes,
        comments: reserved.inputType === 'custom_comments' ? reserved.commentLines.join('\n') : undefined
      }
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
        await tx.run(
          'UPDATE users SET balance_kurus = balance_kurus + ?, balance = (balance_kurus + ?) / 100.0 WHERE id = ?',
          [reserved.chargeKurus, reserved.chargeKurus, user.id]
        );
        await tx.run(
          "UPDATE orders SET status = 'failed', refunded_kurus = ?, failure_reason = ? WHERE id = ?",
          [reserved.chargeKurus, normalizePlainText(`${friendly} [Sağlayıcı: ${providerError.message}]`, 500), reserved.orderId]
        );
        // Bayi musterisi de odedigi tutarin tamamini geri alir.
        await syncTenantRefund(tx, reserved.orderId);
      }
    });
    const err = fail(
      `Sipariş alınamadı: ${friendly} Tutar bakiyenize iade edildi.`, 502,
      'The order could not be placed and the amount was refunded to your balance.'
    );
    // Mesaj bilerek musteriye gosterilir: iade yapildigini bilmesi gerekir.
    err.expose = true;
    throw err;
  }

  const updatedUser = await dbAsync.get('SELECT balance_kurus FROM users WHERE id = ?', [user.id]);
  // Bayi siparisinde sahibin Telegram'ina her musteri siparisi gitmez.
  if (notify && !tenant) {
    telegram.notifyOrderOwner(user.id, 'processing', {
      id: reserved.orderId,
      service_name: reserved.service.name,
      quantity: reserved.quantity
    });
  }
  if (notify) {
    telegram.notifyNewOrder({
      orderId: reserved.orderId,
      username: tenant ? `${user.username} (bayi müşterisi)` : user.username,
      serviceName: reserved.service.name,
      quantity: reserved.quantity,
      providerQuantity: reserved.providerQuantity,
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
    tenantChargeKurus: reserved.tenantChargeKurus,
    serviceName: reserved.service.name,
    quantity: reserved.quantity,
    newBalanceKurus: updatedUser.balance_kurus
  };
}

module.exports = { placeOrder, validTarget };
