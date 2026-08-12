const express = require('express');
const { z } = require('zod');
const { dbAsync, withTransaction } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { normalizePlainText, createOpaqueToken } = require('../utils/security');
const { toKurus, fromKurus } = require('../utils/money');
const PayTR = require('../services/paytr');

const router = express.Router();

router.post('/paytr/callback', async (req, res) => {
  try {
    if (!PayTR.verifyCallback(req.body)) return res.status(400).type('text').send('PAYTR notification failed: bad hash');
    const merchantOid = String(req.body.merchant_oid || '').slice(0, 64);
    await withTransaction(async tx => {
      const intent = await tx.get("SELECT * FROM payment_intents WHERE provider = 'paytr' AND merchant_oid = ?", [merchantOid]);
      if (!intent || intent.status === 'completed' || intent.status === 'failed') return;
      const { hash, ...safeCallback } = req.body;
      await tx.run('INSERT OR IGNORE INTO payment_webhooks (provider, external_id, payload) VALUES (?, ?, ?)', ['paytr', merchantOid, JSON.stringify(safeCallback)]);
      if (req.body.status === 'success') {
        const claimed = await tx.run("UPDATE payment_intents SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'", [intent.id]);
        if (claimed.changes !== 1) return;
        await tx.run('UPDATE users SET balance_kurus = balance_kurus + ?, balance = (balance_kurus + ?) / 100.0 WHERE id = ?', [intent.amount_kurus, intent.amount_kurus, intent.user_id]);
        await tx.run(`INSERT INTO payments (user_id, amount, amount_kurus, method, status, transaction_id) VALUES (?, ?, ?, 'PayTR', 'completed', ?)`, [intent.user_id, fromKurus(intent.amount_kurus), intent.amount_kurus, merchantOid]);
        await tx.run('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)', [intent.user_id, 'payment', 'Ödeme tamamlandı', `₺${fromKurus(intent.amount_kurus).toFixed(2)} bakiyenize eklendi.`]);
      } else {
        await tx.run("UPDATE payment_intents SET status = 'failed', failure_reason = ? WHERE id = ? AND status = 'pending'", [normalizePlainText(req.body.failed_reason_msg || 'Ödeme reddedildi.', 500), intent.id]);
      }
    });
    return res.type('text').send('OK');
  } catch (err) {
    console.error('PayTR callback error:', err.message);
    return res.status(500).type('text').send('ERROR');
  }
});

router.post('/paytr/token', authenticateToken, validate(z.object({ amount: z.coerce.number().min(10).max(100000) })), async (req, res, next) => {
  try {
    const amountKurus = toKurus(req.body.amount);
    const merchantOid = createOpaqueToken('SM').replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);
    await dbAsync.run("INSERT INTO payment_intents (user_id, provider, merchant_oid, amount_kurus) VALUES (?, 'paytr', ?, ?)", [req.user.id, merchantOid, amountKurus]);
    try {
      const token = await PayTR.createIframeToken({ user: req.user, amountKurus, merchantOid, userIp: req.ip });
      res.status(201).json({ token, merchant_oid: merchantOid, iframe_url: `https://www.paytr.com/odeme/guvenli/${token}` });
    } catch (err) {
      await dbAsync.run("UPDATE payment_intents SET status = 'failed', failure_reason = ? WHERE merchant_oid = ?", [normalizePlainText(err.message, 500), merchantOid]);
      throw err;
    }
  } catch (err) { next(err); }
});

router.post('/add-funds', authenticateToken, validate(z.object({
  amount: z.coerce.number().positive().max(100000),
  method: z.string().trim().max(80).optional()
})), async (req, res, next) => {
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_DEMO_PAYMENTS !== 'true') {
    return res.status(403).json({ error: 'Doğrudan demo bakiye yükleme kapalıdır. Banka bildirimi veya yapılandırılmış ödeme sağlayıcısını kullanın.' });
  }
  try {
    const amountKurus = toKurus(req.body.amount);
    const result = await withTransaction(async tx => {
      const txId = createOpaqueToken('DEV_').slice(0, 28);
      await tx.run(
        `INSERT INTO payments (user_id, amount, amount_kurus, method, status, transaction_id)
         VALUES (?, ?, ?, ?, 'completed', ?)`,
        [req.user.id, fromKurus(amountKurus), amountKurus, 'Geliştirme Ortamı', txId]
      );
      await tx.run('UPDATE users SET balance_kurus = balance_kurus + ?, balance = (balance_kurus + ?) / 100.0 WHERE id = ?', [amountKurus, amountKurus, req.user.id]);
      return { txId, user: await tx.get('SELECT balance_kurus FROM users WHERE id = ?', [req.user.id]) };
    });
    res.json({ message: 'Geliştirme bakiyesi eklendi.', transaction_id: result.txId, new_balance: fromKurus(result.user.balance_kurus) });
  } catch (err) { next(err); }
});

router.get('/history', authenticateToken, async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(10, Number.parseInt(req.query.limit || '25', 10)));
    const total = await dbAsync.get('SELECT COUNT(*) count FROM payments WHERE user_id = ?', [req.user.id]);
    const payments = await dbAsync.all('SELECT * FROM payments WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?', [req.user.id, limit, (page - 1) * limit]);
    res.json({ payments: payments.map(p => ({ ...p, amount: fromKurus(p.amount_kurus) })), pagination: { page, limit, total: total.count, pages: Math.ceil(total.count / limit) } });
  } catch (err) { next(err); }
});

router.post('/coupon/redeem', authenticateToken, validate(z.object({ code: z.string().trim().min(2).max(64) })), async (req, res, next) => {
  try {
    const cleanCode = normalizePlainText(req.body.code, 64).toUpperCase();
    const result = await withTransaction(async tx => {
      const coupon = await tx.get('SELECT * FROM coupons WHERE code = ? COLLATE NOCASE', [cleanCode]);
      if (!coupon) { const err = new Error('Geçersiz kupon kodu.'); err.status = 404; throw err; }
      const claim = await tx.run(
        `UPDATE coupons SET used_count = used_count + 1
         WHERE id = ? AND used_count < max_uses
           AND NOT EXISTS (SELECT 1 FROM user_coupons WHERE user_id = ? AND coupon_id = coupons.id)`,
        [coupon.id, req.user.id]
      );
      if (claim.changes !== 1) { const err = new Error('Bu kupon daha önce kullanılmış veya kullanım limiti dolmuş.'); err.status = 409; throw err; }
      const amountKurus = coupon.amount_kurus || toKurus(coupon.amount);
      await tx.run('INSERT INTO user_coupons (user_id, coupon_id) VALUES (?, ?)', [req.user.id, coupon.id]);
      await tx.run('UPDATE users SET balance_kurus = balance_kurus + ?, balance = (balance_kurus + ?) / 100.0 WHERE id = ?', [amountKurus, amountKurus, req.user.id]);
      const txId = createOpaqueToken('CPN_').slice(0, 28);
      await tx.run(
        `INSERT INTO payments (user_id, amount, amount_kurus, method, status, transaction_id)
         VALUES (?, ?, ?, ?, 'completed', ?)`,
        [req.user.id, fromKurus(amountKurus), amountKurus, `Kupon: ${cleanCode}`, txId]
      );
      return { amountKurus, user: await tx.get('SELECT balance_kurus FROM users WHERE id = ?', [req.user.id]) };
    });
    res.json({ message: `₺${fromKurus(result.amountKurus).toFixed(2)} kupon bakiyesi eklendi.`, new_balance: fromKurus(result.user.balance_kurus) });
  } catch (err) { next(err); }
});

router.post('/notification', authenticateToken, validate(z.object({
  bank_name: z.string().trim().min(2).max(80),
  amount: z.coerce.number().positive().max(1000000),
  sender_name: z.string().trim().min(2).max(120)
})), async (req, res, next) => {
  try {
    const amountKurus = toKurus(req.body.amount);
    const duplicate = await dbAsync.get(
      `SELECT id FROM payment_notifications
       WHERE user_id = ? AND amount_kurus = ? AND sender_name = ? AND status = 'pending'
         AND created_at >= datetime('now', '-10 minutes')`,
      [req.user.id, amountKurus, req.body.sender_name]
    );
    if (duplicate) return res.status(409).json({ error: 'Aynı ödeme bildirimi kısa süre önce gönderilmiş.' });
    await dbAsync.run(
      `INSERT INTO payment_notifications (user_id, bank_name, amount, amount_kurus, sender_name, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [req.user.id, normalizePlainText(req.body.bank_name, 80), fromKurus(amountKurus), amountKurus, normalizePlainText(req.body.sender_name, 120)]
    );
    res.status(201).json({ message: 'Ödeme bildiriminiz incelemeye alındı.' });
  } catch (err) { next(err); }
});

module.exports = router;
