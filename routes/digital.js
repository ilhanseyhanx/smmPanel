'use strict';

// DIJITAL URUNLER — herkese acik katalog + musteri uclari (/api/digital).
// Sayfanin kendisi server.js'teki SPA isleyicisinde basilir; is mantigi
// services/digitalStore.js'te. Yonetim uclari routes/adminDigital.js'te.

const express = require('express');
const { z } = require('zod');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { dbAsync } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { validate, bilingual } = require('../middleware/validate');
const { fromKurus } = require('../utils/money');
const { listActiveProducts, localizeProduct } = require('../utils/digitalProducts');
const Store = require('../services/digitalStore');

const router = express.Router();

// Satin alma ve sorgu saglayiciya para odeten islemlerdir; kullanici
// basina sinirlanir (CGNAT yuzunden IP degil kullanici kimligi).
const actionLimiter = rateLimit({
  windowMs: 60_000,
  limit: Number(process.env.DIGITAL_RATE_LIMIT_MAX || 20),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: req => (req.user?.id ? `kullanici:${req.user.id}` : ipKeyGenerator(req)),
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json({
      error: 'Çok fazla istek gönderdin. Lütfen bir dakika bekleyip tekrar dene.',
      error_en: 'Too many requests. Please wait a minute and try again.'
    });
  }
});

// Servis katmaninin bilerek musteriye yazdigi hatalar kod ve Ingilizce
// karsiligiyla doner; digerleri genel hata isleyicisine gider.
function sendError(res, err, next) {
  if (!err.expose || !err.status) return next(err);
  const body = { error: err.message };
  if (err.messageEn) body.error_en = err.messageEn;
  if (err.code) body.code = err.code;
  return res.status(err.status).json(body);
}

function idParam(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'Geçersiz kayıt numarası.' });
  req.recordId = id;
  next();
}

// Katalog (herkese acik). Checker fiyati da burada: sekme gorunurlugu icin.
router.get('/products', async (req, res, next) => {
  try {
    const lang = req.query.lang === 'en' ? 'en' : 'tr';
    const [rows, checker, fx] = await Promise.all([
      listActiveProducts(dbAsync),
      Store.getCheckerConfig(),
      require('../services/fx').getUsdTry()
    ]);
    res.json({
      products: rows.map(row => localizeProduct(row, lang)),
      checker: {
        enabled: Boolean(checker.enabled && checker.priceKurus > 0 && checker.providerId),
        price: fromKurus(checker.priceKurus),
        max_emails: Store.MAX_CHECK_EMAILS
      },
      usd_try: fx.rate
    });
  } catch (err) { next(err); }
});

router.get('/products/:id', idParam, async (req, res, next) => {
  try {
    const lang = req.query.lang === 'en' ? 'en' : 'tr';
    const rows = await listActiveProducts(dbAsync);
    const row = rows.find(r => Number(r.id) === req.recordId);
    if (!row) return res.status(404).json({ error: 'Ürün bulunamadı.', error_en: 'Product not found.' });
    res.json({ product: localizeProduct(row, lang) });
  } catch (err) { next(err); }
});

// Satin alma. Dijital urun oldugu icin "hemen teslim / cayma hakki" onayi zorunlu.
router.post('/orders', authenticateToken, actionLimiter, validate(z.object({
  product_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive().max(100000),
  consent: z.literal(true, { message: bilingual('Satın almak için dijital ürün onayını işaretlemelisin.', 'Tick the digital product consent box to buy.') })
})), async (req, res, next) => {
  try {
    const result = await Store.purchase({ user: req.user, productId: req.body.product_id, quantity: req.body.quantity });
    res.status(201).json(result);
  } catch (err) { sendError(res, err, next); }
});

router.get('/orders', authenticateToken, async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page || '1', 10) || 1);
    const limit = 20;
    const total = await dbAsync.get('SELECT COUNT(*) n FROM digital_orders WHERE user_id = ?', [req.user.id]);
    const rows = await dbAsync.all(
      'SELECT * FROM digital_orders WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?',
      [req.user.id, limit, (page - 1) * limit]
    );
    res.json({
      orders: rows.map(Store.publicOrder),
      pagination: { page, limit, total: total.n, pages: Math.max(1, Math.ceil(total.n / limit)) }
    });
  } catch (err) { next(err); }
});

// Teslim edilen hesap bilgileri yalnizca siparis sahibine acilir.
router.get('/orders/:id', authenticateToken, idParam, async (req, res, next) => {
  try {
    const order = await dbAsync.get('SELECT * FROM digital_orders WHERE id = ? AND user_id = ?', [req.recordId, req.user.id]);
    if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı.', error_en: 'Order not found.' });
    res.json({
      order: Store.publicOrder(order),
      items: order.status === 'completed' || order.status === 'refunded' ? Store.decryptItems(order) : [],
      usage: order.usage_note || ''
    });
  } catch (err) { next(err); }
});

router.post('/check', authenticateToken, actionLimiter, validate(z.object({
  emails: z.union([z.string().max(60000), z.array(z.string().max(254)).max(5000)])
})), async (req, res, next) => {
  try {
    const result = await Store.runGmailCheck({ user: req.user, emails: req.body.emails });
    res.status(201).json(result);
  } catch (err) { sendError(res, err, next); }
});

router.get('/checks', authenticateToken, async (req, res, next) => {
  try {
    const rows = await dbAsync.all(
      `SELECT id, email_count, checked_count, charge_kurus, refunded_kurus, status, summary, failure_reason, created_at
         FROM digital_checks WHERE user_id = ? ORDER BY id DESC LIMIT 30`,
      [req.user.id]
    );
    res.json({
      checks: rows.map(row => ({
        id: row.id,
        email_count: row.email_count,
        checked: row.checked_count,
        charge: fromKurus(row.charge_kurus - row.refunded_kurus),
        status: row.status,
        summary: row.summary ? JSON.parse(row.summary) : null,
        failure_reason: row.failure_reason,
        created_at: row.created_at
      }))
    });
  } catch (err) { next(err); }
});

router.get('/checks/:id', authenticateToken, idParam, async (req, res, next) => {
  try {
    const row = await dbAsync.get('SELECT * FROM digital_checks WHERE id = ? AND user_id = ?', [req.recordId, req.user.id]);
    if (!row) return res.status(404).json({ error: 'Kayıt bulunamadı.', error_en: 'Record not found.' });
    res.json({
      id: row.id,
      checked: row.checked_count,
      requested: row.email_count,
      charge: fromKurus(row.charge_kurus - row.refunded_kurus),
      summary: row.summary ? JSON.parse(row.summary) : null,
      results: Store.decryptCheckResults(row),
      created_at: row.created_at
    });
  } catch (err) { next(err); }
});

module.exports = router;
