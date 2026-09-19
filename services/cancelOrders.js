'use strict';

// Bayi API'si "cancel" komutu. Iptal saglayiciya iletilen bir TALEPTIR: tutar
// burada iade edilmez. Saglayici siparisi iptal ettiginde durum senkronu
// (orderWorker.applyProviderStatus) iadeyi her zamanki gibi yapar.
const { dbAsync } = require('../config/database');
const { normalizePlainText } = require('../utils/security');
const SmmProviderClient = require('./smmProvider');

const GENERIC_ERROR = 'Cancel request failed';

function isAccepted(value) {
  return value === 1 || value === true || value === '1' || value === 'true';
}

// Saglayici yanitini { saglayiciSiparisNo -> true | hata metni } haritasina
// cevirir. Standart bicim dizidir; tek siparislik nesne ve genel hata da
// karsilanir.
function parseCancelResponse(response, providerOrderIds) {
  const outcome = new Map();
  const errorText = value => normalizePlainText(String(value), 200) || GENERIC_ERROR;
  if (Array.isArray(response)) {
    for (const item of response) {
      if (!item || typeof item !== 'object' || item.order == null) continue;
      const cancel = item.cancel;
      if (cancel && typeof cancel === 'object') outcome.set(String(item.order), errorText(cancel.error || GENERIC_ERROR));
      else if (item.error) outcome.set(String(item.order), errorText(item.error));
      else outcome.set(String(item.order), isAccepted(cancel) ? true : GENERIC_ERROR);
    }
  } else if (response && typeof response === 'object') {
    if (response.error) {
      for (const id of providerOrderIds) outcome.set(id, errorText(response.error));
    } else if (providerOrderIds.length === 1 && response.cancel !== undefined) {
      const cancel = response.cancel;
      outcome.set(providerOrderIds[0], cancel && typeof cancel === 'object'
        ? errorText(cancel.error || GENERIC_ERROR)
        : (isAccepted(cancel) ? true : GENERIC_ERROR));
    }
  }
  return outcome;
}

// orderIds: en fazla 100 tekil pozitif sayi. Donus standart bicimdedir:
// [{ order, cancel: 1 | { error } }]
async function requestCancel({ user, orderIds }) {
  const results = new Map();
  const rows = orderIds.length ? await dbAsync.all(
    `SELECT o.id, o.status, o.provider_order_id, o.provider_id, p.api_url, p.api_key, p.status provider_status
       FROM orders o LEFT JOIN providers p ON p.id = o.provider_id
      WHERE o.user_id = ? AND o.id IN (${orderIds.map(() => '?').join(',')})`,
    [user.id, ...orderIds]
  ) : [];
  const byId = new Map(rows.map(row => [row.id, row]));

  const groups = new Map();
  for (const id of orderIds) {
    const order = byId.get(id);
    if (!order) { results.set(id, { error: 'Incorrect order ID' }); continue; }
    if (!['pending', 'processing'].includes(order.status) || !order.provider_order_id
      || !order.api_url || Number(order.provider_status) !== 1) {
      results.set(id, { error: 'This order cannot be canceled' });
      continue;
    }
    // Saglayiciya gitmeden once isaretlenir: ayni siparis icin es zamanli iki
    // istek saglayiciya iki iptal gondermez.
    const claim = await dbAsync.run(
      'UPDATE orders SET cancel_requested_at = CURRENT_TIMESTAMP WHERE id = ? AND cancel_requested_at IS NULL',
      [order.id]
    );
    if (claim.changes !== 1) { results.set(id, { error: 'Cancel already requested' }); continue; }
    if (!groups.has(order.provider_id)) groups.set(order.provider_id, []);
    groups.get(order.provider_id).push(order);
  }

  for (const orders of groups.values()) {
    const first = orders[0];
    const providerOrderIds = orders.map(order => String(order.provider_order_id));
    let outcome = new Map();
    try {
      const response = await new SmmProviderClient(first.api_url, first.api_key, { id: first.provider_id })
        .cancelOrders(providerOrderIds);
      outcome = parseCancelResponse(response, providerOrderIds);
    } catch { /* hepsi genel hata olarak doner, isaretler geri alinir */ }
    for (const order of orders) {
      const result = outcome.get(String(order.provider_order_id));
      if (result === true) {
        results.set(order.id, 1);
      } else {
        await dbAsync.run('UPDATE orders SET cancel_requested_at = NULL WHERE id = ?', [order.id]);
        results.set(order.id, { error: result || GENERIC_ERROR });
      }
    }
  }

  return orderIds.map(id => ({ order: id, cancel: results.get(id) }));
}

module.exports = { requestCancel, parseCancelResponse };
