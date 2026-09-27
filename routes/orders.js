const express = require('express');
const { z } = require('zod');
const { dbAsync } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { decryptSecret } = require('../utils/security');
const { fromKurus } = require('../utils/money');
const { requestRefill } = require('../services/refills');

const router = express.Router();
const createSchema = z.object({
  service_id: z.coerce.number().int().positive(),
  link: z.string().trim().min(3).max(2048),
  // Custom Comments servisinde asil miktar bos olmayan yorum satirlarindan
  // hesaplanir; quantity bu nedenle API tarafinda istege baglidir.
  quantity: z.coerce.number().int().positive().optional(),
  comments: z.string().max(200000).optional().default(''),
  terms_accepted: z.boolean().optional().default(false),
  drip_runs: z.coerce.number().int().min(1).max(100).default(1),
  drip_interval_minutes: z.coerce.number().int().min(5).max(10080).nullable().optional(),
  // Link uyari mesajinin dili; musterinin panelde secili dili gonderilir.
  lang: z.enum(['tr', 'en']).default('tr')
});

const { placeOrder } = require('../services/placeOrder');

router.post('/', authenticateToken, validate(createSchema), async (req, res, next) => {
  try {
    const { service_id, quantity, drip_runs, drip_interval_minutes, lang, comments, terms_accepted } = req.body;
    // Siparis olusturmanin tum adimlari services/placeOrder.js icinde:
    // panel ve /api/v2 ayni yoldan gecsin diye oraya tasindi.
    const result = await placeOrder({
      user: req.user,
      serviceId: service_id,
      link: req.body.link,
      quantity,
      dripRuns: drip_runs,
      dripIntervalMinutes: drip_interval_minutes,
      lang,
      comments,
      termsAccepted: terms_accepted
    });
    // Paket siparisinde iletilemeyen bilesen varsa payinin iade edildigi soylenir.
    const failedParts = result.bundle?.failed?.length || 0;
    res.status(201).json({
      message: failedParts
        ? `Paket siparişiniz alındı; ${failedParts} bileşen sağlayıcıya iletilemedi ve payı bakiyenize iade edildi.`
        : 'Siparişiniz alındı ve sağlayıcıya iletildi.',
      order: {
        id: result.orderId,
        service_name: result.serviceName,
        quantity: result.quantity,
        charge: fromKurus(result.chargeKurus),
        status: result.status,
        provider_order_id: result.providerOrderId,
        drip_runs,
        bundle: result.bundle || null
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
      `SELECT o.*, ${serviceNameSql} service_name, s.refill, ${categoryNameSql} category_name,
              ${lang === 'en' ? "COALESCE(NULLIF(b.name_en, ''), NULLIF(b.name_tr, ''), b.name)" : "COALESCE(NULLIF(b.name_tr, ''), b.name)"} bundle_name
       FROM orders o JOIN services s ON o.service_id = s.id
       LEFT JOIN categories c ON s.category_id = c.id
       LEFT JOIN services b ON b.id = o.bundle_service_id
       WHERE o.user_id = ? AND o.status != 'failed' ORDER BY o.id DESC LIMIT ? OFFSET ?`,
      [req.user.id, limit, offset]
    );
    res.json({
      orders: orders.map(o => {
        // Yorumlar ve urun teslimat icerigi sifreli olsa da liste ucundan
        // istemciye ham ciphertext olarak dahi cikmaz. Saglayiciya giden
        // gercek miktar (fazla gonderim/carpan) da musteriye gosterilmez.
        const { secure_payload, delivery_token_hash, provider_quantity, ...safeOrder } = o;
        return { ...safeOrder, charge: fromKurus(o.charge_kurus) };
      }),
      pagination: { page, limit, total: total.count, pages: Math.ceil(total.count / limit) }
    });
  } catch (err) { next(err); }
});

// E-posta ile gelen dijital urun bilgisi sadece siparis sahibine acilir.
router.get('/:id/delivery', authenticateToken, async (req, res, next) => {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isSafeInteger(orderId) || orderId <= 0) return res.status(400).json({ error: 'Geçersiz sipariş numarası.' });
    const row = await dbAsync.get(
      `SELECT d.*, o.user_id, o.delivery_status, s.name service_name
         FROM orders o JOIN services s ON s.id = o.service_id
         LEFT JOIN email_deliveries d ON d.id = (
           SELECT id FROM email_deliveries WHERE order_id = o.id ORDER BY id DESC LIMIT 1
         )
        WHERE o.id = ? AND o.user_id = ?`,
      [orderId, req.user.id]
    );
    if (!row) return res.status(404).json({ error: 'Sipariş bulunamadı.' });
    if (!row.content_encrypted) return res.status(404).json({ error: 'Teslimat bilgisi henüz ulaşmadı.' });
    const content = JSON.parse(decryptSecret(row.content_encrypted));
    res.json({
      order_id: orderId,
      service_name: row.service_name,
      subject: row.subject,
      sender: row.sender,
      received_at: row.created_at,
      content
    });
  } catch (err) { next(err); }
});

router.post('/:id/refill', authenticateToken, async (req, res, next) => {
  try {
    // Panel ve bayi API'si ayni akistan gecer (services/refills.js): talep
    // kaydedilir, durumu arka planda izlenir ve bitince yeni talebe acilir.
    const result = await requestRefill({ user: req.user, orderId: req.params.id });
    res.json({ message: 'Telafi talebiniz sağlayıcıya iletildi.', refill: result.refillId });
  } catch (err) { next(err); }
});

module.exports = router;
