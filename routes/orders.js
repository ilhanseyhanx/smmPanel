const express = require('express');
const { z } = require('zod');
const { dbAsync, withTransaction } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { normalizePlainText, isSafeHttpUrl } = require('../utils/security');
const { toKurus, fromKurus, calculateChargeKurus } = require('../utils/money');
const SmmProviderClient = require('../services/smmProvider');

const router = express.Router();
const createSchema = z.object({
  service_id: z.coerce.number().int().positive(),
  link: z.string().trim().min(3).max(2048),
  quantity: z.coerce.number().int().positive(),
  drip_runs: z.coerce.number().int().min(1).max(100).default(1),
  drip_interval_minutes: z.coerce.number().int().min(5).max(10080).nullable().optional()
});

function validTarget(value) {
  if (/^(javascript|data|file):/i.test(value)) return false;
  return !value.includes('://') || isSafeHttpUrl(value);
}

router.post('/', authenticateToken, validate(createSchema), async (req, res, next) => {
  try {
    const { service_id, quantity, drip_runs, drip_interval_minutes } = req.body;
    const link = normalizePlainText(req.body.link, 2048);
    if (!validTarget(link)) return res.status(400).json({ error: 'Geçerli bir bağlantı veya kullanıcı adı girin.' });

    const reserved = await withTransaction(async tx => {
      const service = await tx.get('SELECT * FROM services WHERE id = ? AND status = 1', [service_id]);
      if (!service) { const err = new Error('Seçilen servis aktif değil veya bulunamadı.'); err.status = 404; throw err; }
      if (quantity < service.min_quantity || quantity > service.max_quantity) {
        const err = new Error(`Miktar ${service.min_quantity} ile ${service.max_quantity} arasında olmalıdır.`); err.status = 400; throw err;
      }
      const rateKurus = service.rate_per_1000_kurus || toKurus(service.rate_per_1000);
      const chargeKurus = calculateChargeKurus(rateKurus, quantity) * drip_runs;
      if (chargeKurus <= 0) { const err = new Error('Hesaplanan sipariş tutarı geçersiz.'); err.status = 400; throw err; }
      const debit = await tx.run(
        `UPDATE users
         SET balance_kurus = balance_kurus - ?, balance = (balance_kurus - ?) / 100.0
         WHERE id = ? AND balance_kurus >= ?`,
        [chargeKurus, chargeKurus, req.user.id, chargeKurus]
      );
      if (debit.changes !== 1) { const err = new Error(`Yetersiz bakiye. Gerekli tutar ₺${fromKurus(chargeKurus).toFixed(2)}.`); err.status = 400; throw err; }
      const order = await tx.run(
        `INSERT INTO orders
         (user_id, service_id, provider_id, link, quantity, charge, charge_kurus, status, drip_runs, drip_interval_minutes)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
        [req.user.id, service.id, service.provider_id, link, quantity, fromKurus(chargeKurus), chargeKurus, drip_runs, drip_runs > 1 ? drip_interval_minutes : null]
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
        reserved.service.provider_service_id,
        link,
        quantity,
        { runs: drip_runs, interval: drip_interval_minutes }
      );
      if (!response?.order) throw new Error(response?.error || 'Sağlayıcı sipariş numarası döndürmedi.');
      providerOrderId = String(response.order);
      status = 'processing';
      await dbAsync.run('UPDATE orders SET provider_order_id = ?, status = ? WHERE id = ?', [providerOrderId, status, reserved.orderId]);
    } catch (providerError) {
      await withTransaction(async tx => {
        const order = await tx.get('SELECT status, refunded_kurus FROM orders WHERE id = ?', [reserved.orderId]);
        if (order && order.refunded_kurus === 0) {
          await tx.run('UPDATE users SET balance_kurus = balance_kurus + ?, balance = (balance_kurus + ?) / 100.0 WHERE id = ?', [reserved.chargeKurus, reserved.chargeKurus, req.user.id]);
          await tx.run("UPDATE orders SET status = 'failed', refunded_kurus = ?, failure_reason = ? WHERE id = ?", [reserved.chargeKurus, normalizePlainText(providerError.message, 500), reserved.orderId]);
        }
      });
      const err = new Error('Sipariş sağlayıcıya iletilemedi; ayrılan tutar bakiyenize iade edildi.');
      err.status = 502;
      throw err;
    }

    const updatedUser = await dbAsync.get('SELECT balance_kurus FROM users WHERE id = ?', [req.user.id]);
    res.status(201).json({
      message: 'Siparişiniz alındı ve sağlayıcıya iletildi.',
      order: { id: reserved.orderId, service_name: reserved.service.name, quantity, charge: fromKurus(reserved.chargeKurus), status, provider_order_id: providerOrderId, drip_runs },
      new_balance: fromKurus(updatedUser.balance_kurus)
    });
  } catch (err) { next(err); }
});

router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const lang = req.query.lang === 'en' ? 'en' : 'tr';
    const serviceNameSql = lang === 'en'
      ? "COALESCE(NULLIF(s.name_en, ''), NULLIF(s.name_tr, ''), s.name)"
      : "COALESCE(NULLIF(s.name_tr, ''), s.name)";
    const categoryNameSql = lang === 'en'
      ? "COALESCE(NULLIF(c.name_en, ''), NULLIF(c.name_tr, ''), c.name)"
      : "COALESCE(NULLIF(c.name_tr, ''), c.name)";
    const page = Math.max(1, Number.parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(10, Number.parseInt(req.query.limit || '25', 10)));
    const offset = (page - 1) * limit;
    const total = await dbAsync.get('SELECT COUNT(*) count FROM orders WHERE user_id = ?', [req.user.id]);
    const orders = await dbAsync.all(
      `SELECT o.*, ${serviceNameSql} service_name, s.refill, ${categoryNameSql} category_name
       FROM orders o JOIN services s ON o.service_id = s.id
       LEFT JOIN categories c ON s.category_id = c.id
       WHERE o.user_id = ? ORDER BY o.id DESC LIMIT ? OFFSET ?`,
      [req.user.id, limit, offset]
    );
    res.json({ orders: orders.map(o => ({ ...o, charge: fromKurus(o.charge_kurus) })), pagination: { page, limit, total: total.count, pages: Math.ceil(total.count / limit) } });
  } catch (err) { next(err); }
});

router.post('/:id/refill', authenticateToken, async (req, res, next) => {
  try {
    const order = await dbAsync.get(
      `SELECT o.*, s.refill, p.api_url, p.api_key
       FROM orders o JOIN services s ON s.id = o.service_id
       LEFT JOIN providers p ON p.id = o.provider_id
       WHERE o.id = ? AND o.user_id = ?`,
      [req.params.id, req.user.id]
    );
    if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı.' });
    if (!order.refill) return res.status(400).json({ error: 'Bu servis telafi desteklemiyor.' });
    if (order.status !== 'completed') return res.status(400).json({ error: 'Yalnızca tamamlanmış siparişler için telafi istenebilir.' });
    if (order.refill_status === 'requested' || order.refill_status === 'processing') return res.status(409).json({ error: 'Bu sipariş için aktif bir telafi talebi var.' });
    if (!order.provider_order_id || !order.api_url) return res.status(400).json({ error: 'Sağlayıcı telafi bağlantısı bulunamadı.' });
    const response = await new SmmProviderClient(order.api_url, order.api_key).requestRefill(order.provider_order_id);
    if (response?.error) return res.status(502).json({ error: `Sağlayıcı telafi hatası: ${normalizePlainText(response.error, 300)}` });
    await dbAsync.run("UPDATE orders SET refill_status = 'requested' WHERE id = ? AND refill_status NOT IN ('requested','processing')", [order.id]);
    res.json({ message: 'Telafi talebiniz sağlayıcıya iletildi.', refill: response?.refill || null });
  } catch (err) { next(err); }
});

module.exports = router;
