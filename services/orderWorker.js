const cron = require('node-cron');
const { dbAsync, withTransaction } = require('../config/database');
const { toKurus, fromKurus } = require('../utils/money');
const SmmProviderClient = require('./smmProvider');
const telegram = require('./telegramNotifier');

let running = false;

function mapStatus(value, fallback) {
  const status = String(value || '').toLowerCase();
  if (status.includes('completed') || status.includes('tamamlandı')) return 'completed';
  if (status.includes('processing') || status.includes('in progress') || status.includes('işleniyor')) return 'processing';
  if (status.includes('canceled') || status.includes('cancelled') || status.includes('iptal')) return 'canceled';
  if (status.includes('partial') || status.includes('kısmen')) return 'partial';
  return fallback;
}

async function applyProviderStatus(orderId, providerStatus) {
  // Transaction bittikten sonra Telegram bildirimi atabilmek icin durum
  // degisikligi bilgisi disari tasinir (bildirim asla islemi bloklamaz).
  let statusChange = null;
  await withTransaction(async tx => {
    const order = await tx.get('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order || !['pending', 'processing'].includes(order.status)) return;
    const newStatus = mapStatus(providerStatus.status, order.status);
    const startCount = Number.isFinite(Number(providerStatus.start_count)) ? Number.parseInt(providerStatus.start_count, 10) : order.start_count;
    const remains = Number.isFinite(Number(providerStatus.remains)) ? Math.max(0, Number.parseInt(providerStatus.remains, 10)) : order.remains;
    const chargeKurus = order.charge_kurus || toKurus(order.charge);
    let targetRefund = order.refunded_kurus || 0;
    if (newStatus === 'canceled') targetRefund = chargeKurus;
    if (newStatus === 'partial' && order.quantity > 0) targetRefund = Math.min(chargeKurus, Math.round(chargeKurus * remains / order.quantity));
    const refundDelta = Math.max(0, targetRefund - (order.refunded_kurus || 0));
    if (refundDelta > 0) {
      await tx.run('UPDATE users SET balance_kurus = balance_kurus + ?, balance = (balance_kurus + ?) / 100.0 WHERE id = ?', [refundDelta, refundDelta, order.user_id]);
    }
    await tx.run('UPDATE orders SET status = ?, start_count = ?, remains = ?, refunded_kurus = ? WHERE id = ?', [newStatus, startCount, remains, targetRefund, order.id]);
    // Saglayici iptal/kismi kararlarinin sebebi admin panelinde gorunsun.
    if (newStatus === 'canceled') {
      await tx.run("UPDATE orders SET failure_reason = COALESCE(failure_reason, 'Sağlayıcı siparişi iptal etti; tutar iade edildi.') WHERE id = ?", [order.id]);
    } else if (newStatus === 'partial') {
      await tx.run("UPDATE orders SET failure_reason = COALESCE(failure_reason, 'Sağlayıcı siparişi kısmen tamamladı; kalan miktarın tutarı iade edildi.') WHERE id = ?", [order.id]);
    }

    if (newStatus !== order.status && ['completed', 'partial', 'canceled'].includes(newStatus)) {
      const service = await tx.get('SELECT name FROM services WHERE id = ?', [order.service_id]);
      const owner = await tx.get('SELECT username FROM users WHERE id = ?', [order.user_id]);
      statusChange = {
        userId: order.user_id,
        event: newStatus,
        order: {
          id: order.id,
          service_name: service?.name || 'Servis',
          quantity: order.quantity,
          remains,
          refund_amount: fromKurus(refundDelta)
        },
        // Admin kanalina gidecek ozet; siparisin ne kadar surdugu de yazilir.
        adminSummary: {
          orderId: order.id,
          username: owner?.username || '-',
          serviceName: service?.name || 'Servis',
          quantity: order.quantity,
          charge: fromKurus(chargeKurus),
          link: order.link,
          status: newStatus,
          providerOrderId: order.provider_order_id,
          createdAt: order.created_at,
          remains,
          refundAmount: fromKurus(targetRefund)
        }
      };
    }

    if (newStatus === 'completed') {
      const referred = await tx.get('SELECT referrer_id FROM users WHERE id = ?', [order.user_id]);
      if (referred?.referrer_id) {
        const commission = Math.max(1, Math.round(chargeKurus * 0.05));
        const earning = await tx.run(
          `INSERT OR IGNORE INTO referral_earnings (referrer_id, referred_user_id, order_id, amount_kurus)
           VALUES (?, ?, ?, ?)`,
          [referred.referrer_id, order.user_id, order.id, commission]
        );
        if (earning.changes === 1) {
          await tx.run('UPDATE users SET referral_balance_kurus = referral_balance_kurus + ? WHERE id = ?', [commission, referred.referrer_id]);
          await tx.run('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)', [referred.referrer_id, 'referral', 'Referans kazancı', `₺${fromKurus(commission).toFixed(2)} referans kazancı hesabınıza eklendi.`]);
        }
      }
      await tx.run('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)', [order.user_id, 'order', 'Sipariş tamamlandı', `#${order.id} numaralı sipariş tamamlandı.`]);
    }
  });

  // Transaction basariyla bittikten sonra; beklenmez, hatalari kendi yutar.
  if (statusChange) {
    telegram.notifyOrderOwner(statusChange.userId, statusChange.event, statusChange.order);
    telegram.notifyOrderFinished(statusChange.adminSummary);
  }
}

async function checkPendingOrders() {
  if (running) return;
  running = true;
  try {
    const pendingOrders = await dbAsync.all(`SELECT * FROM orders WHERE status IN ('pending', 'processing') AND provider_order_id IS NOT NULL`);
    const groups = new Map();
    for (const order of pendingOrders) {
      if (!groups.has(order.provider_id)) groups.set(order.provider_id, []);
      groups.get(order.provider_id).push(order);
    }
    for (const [providerId, orders] of groups) {
      const provider = await dbAsync.get('SELECT * FROM providers WHERE id = ? AND status = 1', [providerId]);
      if (!provider) continue;
      const statusMap = await new SmmProviderClient(provider.api_url, provider.api_key).getMultiOrderStatus(orders.map(o => o.provider_order_id));
      if (!statusMap) continue;
      for (const order of orders) {
        const status = statusMap[String(order.provider_order_id)] || (orders.length === 1 && statusMap.status ? statusMap : null);
        if (status?.status) await applyProviderStatus(order.id, status);
      }
    }
  } catch (err) {
    console.error('Order worker error:', err.message);
  } finally {
    running = false;
  }
}

function startOrderWorker() {
  cron.schedule('*/30 * * * * *', checkPendingOrders, { noOverlap: true });
  console.log('Order status worker active (30s)');
}

module.exports = { startOrderWorker, checkPendingOrders, applyProviderStatus };
