'use strict';

// Telafi (refill) talepleri: panel ve bayi API'si bu tek akistan gecer.
// Saglayici talebi kabul edince order_refills kaydi acilir; durumu arka planda
// (orderWorker) saglayicidan okunur. Talep kapaninca siparis yeni telafiye
// yeniden acilir — eskiden 'requested' durumu hic temizlenmiyordu.
const { dbAsync, withTransaction } = require('../config/database');
const { normalizePlainText } = require('../utils/security');
const SmmProviderClient = require('./smmProvider');

// Saglayici numara vermediyse durumu okunamaz; talep 1 gun sonra kapatilir.
// Numarasi olan ama 7 gunde sonuclanmayan talep de kapatilir ki musteri
// yeniden isteyebilsin (saglayici erken talebi zaten kendisi reddeder).
const EXPIRE_WITHOUT_ID = '-1 day';
const EXPIRE_WITH_ID = '-7 days';
const RECHECK_AFTER = '-10 minutes';

// API'de standart SMM etiketleri kullanilir.
const API_LABELS = {
  pending: 'Pending',
  processing: 'In progress',
  completed: 'Completed',
  rejected: 'Rejected',
  expired: 'Rejected'
};

// Saglayici kaynakli 502'ler de musteriye gosterilir (expose): metin zaten
// temizlenmis saglayici mesajidir, ic hata degildir.
function fail(message, status, messageEn) {
  const err = new Error(message);
  err.status = status;
  if (messageEn) err.messageEn = messageEn;
  if (status === 502) err.expose = true;
  return err;
}

function mapProviderRefillStatus(value) {
  const status = String(value || '').toLowerCase();
  if (status.includes('complet')) return 'completed';
  if (status.includes('reject') || status.includes('cancel') || status.includes('error') || status.includes('fail')) return 'rejected';
  if (status.includes('progress') || status.includes('processing')) return 'processing';
  if (status.includes('pending')) return 'pending';
  return null;
}

function refillStatusLabel(status) {
  return API_LABELS[status] || 'Pending';
}

async function releaseOrder(orderId, previousStatus) {
  await dbAsync.run(
    "UPDATE orders SET refill_status = ? WHERE id = ? AND refill_status = 'requested'",
    [previousStatus, orderId]
  ).catch(() => {});
}

async function requestRefill({ user, orderId }) {
  const id = Number(orderId);
  if (!Number.isSafeInteger(id) || id <= 0) throw fail('Sipariş bulunamadı.', 404, 'Incorrect order ID');
  const order = await dbAsync.get(
    `SELECT o.*, s.refill, p.api_url, p.api_key
       FROM orders o JOIN services s ON s.id = o.service_id
       LEFT JOIN providers p ON p.id = o.provider_id
      WHERE o.id = ? AND o.user_id = ?`,
    [id, user.id]
  );
  if (!order) throw fail('Sipariş bulunamadı.', 404, 'Incorrect order ID');
  if (!order.refill) throw fail('Bu servis telafi desteklemiyor.', 400, 'Refill is not available for this service');
  if (order.status !== 'completed') throw fail('Yalnızca tamamlanmış siparişler için telafi istenebilir.', 400, 'Refill is only available for completed orders');
  if (!order.provider_order_id || !order.api_url) throw fail('Sağlayıcı telafi bağlantısı bulunamadı.', 400, 'Refill is not available for this order');

  // Talep saglayiciya gitmeden once siparis kilitlenir: ayni anda gelen iki
  // istek (cift tik, API tekrari) saglayiciya iki telafi gondermez.
  const previousStatus = order.refill_status || 'none';
  const claim = await dbAsync.run(
    "UPDATE orders SET refill_status = 'requested' WHERE id = ? AND refill_status NOT IN ('requested', 'processing')",
    [order.id]
  );
  if (claim.changes !== 1) throw fail('Bu sipariş için aktif bir telafi talebi var.', 409, 'A refill request is already active for this order');

  let response;
  try {
    response = await new SmmProviderClient(order.api_url, order.api_key, { id: order.provider_id })
      .requestRefill(order.provider_order_id);
  } catch (err) {
    await releaseOrder(order.id, previousStatus);
    throw fail(err.message, 502, 'The refill request could not be sent to the provider');
  }

  const nested = response && typeof response.refill === 'object' && response.refill !== null ? response.refill : null;
  const providerError = response?.error || nested?.error || (!response || typeof response !== 'object' ? 'geçersiz yanıt' : null);
  if (providerError) {
    await releaseOrder(order.id, previousStatus);
    const text = normalizePlainText(String(providerError), 300);
    throw fail(`Sağlayıcı telafi hatası: ${text}`, 502, `Provider refill error: ${text}`);
  }

  const providerRefillId = !nested && response.refill != null && response.refill !== ''
    ? normalizePlainText(String(response.refill), 64) || null
    : null;
  const row = await dbAsync.run(
    "INSERT INTO order_refills (order_id, user_id, provider_refill_id, status) VALUES (?, ?, ?, 'pending')",
    [order.id, user.id, providerRefillId]
  );
  return { refillId: row.id, providerRefillId };
}

async function closeRefill(refillId, orderId, status, providerStatus = null) {
  await withTransaction(async tx => {
    const changed = await tx.run(
      `UPDATE order_refills SET status = ?, provider_status = COALESCE(?, provider_status),
              last_checked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status IN ('pending', 'processing')`,
      [status, providerStatus, refillId]
    );
    if (changed.changes !== 1) return;
    // Suresi dolan talep "sonuclandi" sayilmaz; siparis yalnizca serbest kalir.
    await tx.run(
      "UPDATE orders SET refill_status = ? WHERE id = ? AND refill_status = 'requested'",
      [status === 'expired' ? 'none' : status, orderId]
    );
  });
}

// orderWorker'dan periyodik cagrilir. Donus: kontrol edilen talep sayisi.
async function checkOpenRefills({ limit = 50 } = {}) {
  const stale = await dbAsync.all(
    `SELECT id, order_id FROM order_refills
      WHERE status IN ('pending', 'processing')
        AND ((provider_refill_id IS NULL AND created_at < datetime('now', ?))
          OR created_at < datetime('now', ?))`,
    [EXPIRE_WITHOUT_ID, EXPIRE_WITH_ID]
  );
  for (const row of stale) await closeRefill(row.id, row.order_id, 'expired');

  const rows = await dbAsync.all(
    `SELECT r.id, r.order_id, r.status, r.provider_refill_id, o.provider_id, p.api_url, p.api_key
       FROM order_refills r
       JOIN orders o ON o.id = r.order_id
       JOIN providers p ON p.id = o.provider_id AND p.status = 1
      WHERE r.status IN ('pending', 'processing') AND r.provider_refill_id IS NOT NULL
        AND (r.last_checked_at IS NULL OR r.last_checked_at < datetime('now', ?))
      ORDER BY COALESCE(r.last_checked_at, r.created_at)
      LIMIT ?`,
    [RECHECK_AFTER, limit]
  );
  for (const row of rows) {
    const data = await new SmmProviderClient(row.api_url, row.api_key, { id: row.provider_id })
      .getRefillStatus(row.provider_refill_id);
    const providerStatus = data && typeof data === 'object' && typeof data.status === 'string'
      ? normalizePlainText(data.status, 60)
      : null;
    const mapped = mapProviderRefillStatus(providerStatus);
    if (mapped === 'completed' || mapped === 'rejected') {
      await closeRefill(row.id, row.order_id, mapped, providerStatus);
    } else {
      await dbAsync.run(
        `UPDATE order_refills SET status = ?, provider_status = COALESCE(?, provider_status),
                last_checked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND status IN ('pending', 'processing')`,
        [mapped || row.status, providerStatus, row.id]
      );
    }
  }
  return rows.length;
}

module.exports = {
  requestRefill,
  checkOpenRefills,
  refillStatusLabel,
  mapProviderRefillStatus
};
