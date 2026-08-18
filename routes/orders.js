const express = require('express');
const { z } = require('zod');
const { dbAsync } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { normalizePlainText } = require('../utils/security');
const { fromKurus } = require('../utils/money');
const SmmProviderClient = require('../services/smmProvider');

const router = express.Router();
const createSchema = z.object({
  service_id: z.coerce.number().int().positive(),
  link: z.string().trim().min(3).max(2048),
  quantity: z.coerce.number().int().positive(),
  drip_runs: z.coerce.number().int().min(1).max(100).default(1),
  drip_interval_minutes: z.coerce.number().int().min(5).max(10080).nullable().optional(),
  // Link uyari mesajinin dili; musterinin panelde secili dili gonderilir.
  lang: z.enum(['tr', 'en']).default('tr')
});

const { placeOrder } = require('../services/placeOrder');

router.post('/', authenticateToken, validate(createSchema), async (req, res, next) => {
  try {
    const { service_id, quantity, drip_runs, drip_interval_minutes, lang } = req.body;
    // Siparis olusturmanin tum adimlari services/placeOrder.js icinde:
    // panel ve /api/v2 ayni yoldan gecsin diye oraya tasindi.
    const result = await placeOrder({
      user: req.user,
      serviceId: service_id,
      link: req.body.link,
      quantity,
      dripRuns: drip_runs,
      dripIntervalMinutes: drip_interval_minutes,
      lang
    });
    res.status(201).json({
      message: 'Siparişiniz alındı ve sağlayıcıya iletildi.',
      order: {
        id: result.orderId,
        service_name: result.serviceName,
        quantity,
        charge: fromKurus(result.chargeKurus),
        status: result.status,
        provider_order_id: result.providerOrderId,
        drip_runs
      },
      new_balance: fromKurus(result.newBalanceKurus)
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
    // 'failed' siparisler kullaniciya gosterilmez: saglayiciya hic iletilemedi
    // ve tutar aninda iade edildi; listede "bekliyor" gibi gorunup kafa
    // karistiriyordu. Admin panelinde gorunmeye devam ederler.
    const total = await dbAsync.get("SELECT COUNT(*) count FROM orders WHERE user_id = ? AND status != 'failed'", [req.user.id]);
    const orders = await dbAsync.all(
      `SELECT o.*, ${serviceNameSql} service_name, s.refill, ${categoryNameSql} category_name
       FROM orders o JOIN services s ON o.service_id = s.id
       LEFT JOIN categories c ON s.category_id = c.id
       WHERE o.user_id = ? AND o.status != 'failed' ORDER BY o.id DESC LIMIT ? OFFSET ?`,
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
