'use strict';

// Bayi vitrini: musterinin bakiye yuklemesi (/api/payments). Para BAYININ
// kendi hesabina gider (PayTR, NOWPayments, havale/EFT). Bu uclar odeme
// kaydini acar, saglayici bildirimini bayinin anahtariyla dogrular ve
// tutari musteri bakiyesine yazar. Jet hesabina hicbir sey dusmez.
const crypto = require('crypto');
const express = require('express');
const QRCode = require('qrcode');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { z } = require('zod');
const { dbAsync, withTransaction } = require('../config/database');
const { validate, bilingual } = require('../middleware/validate');
const { normalizePlainText } = require('../utils/security');
const { toKurus, fromKurus } = require('../utils/money');
const PayTR = require('../services/paytr');
const NowPayments = require('../services/nowpayments');
const { loadMethods, amountError, completePayment, closePayment, publicPayment } = require('../services/tenantPayments');
const { logTenantActivity } = require('../services/resellers');
const securityMonitor = require('../services/securityMonitor');
const { requireCustomer } = require('./session');
const { requireActiveTenant } = require('./routes');

const router = express.Router();

// Her baslatma saglayicida gercek kayit acar (PayTR token, kripto adresi);
// musteri basina 10 dakikada 5 deneme. Anahtar musteri kimligidir (CGNAT).
const startLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: Number(process.env.PAYMENT_RATE_LIMIT_MAX || 5),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: req => (req.customer ? `bayi-musteri:${req.customer.id}` : ipKeyGenerator(req)),
  handler: (req, res, next, options) => res.status(options.statusCode).json({
    error: 'Çok fazla ödeme denemesi yaptınız. Birkaç dakika bekleyip tekrar deneyin.',
    error_en: 'Too many payment attempts. Please wait a few minutes and try again.'
  })
});

const amountField = z.coerce.number().finite().positive().max(100000);
const bankSchema = z.object({
  amount: amountField,
  bank_name: z.string().trim().min(2, bilingual('Ödeme yaptığın hesabı seç.', 'Choose the account you paid to.')).max(80),
  sender_name: z.string().trim().min(2, bilingual('Gönderen adını yaz.', 'Enter the sender name.')).max(120),
  note: z.string().trim().max(300).optional().default('')
});
const cardSchema = z.object({ amount: amountField });
const cryptoSchema = z.object({
  amount: amountField,
  pay_currency: z.string().trim().toLowerCase().max(20).default('usdttrc20')
});

function siteUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

function newOid(prefix) {
  return `${prefix}${crypto.randomBytes(12).toString('hex')}`.slice(0, 40);
}

function clientIp(req) {
  return securityMonitor.clientIp(req);
}

async function enabledMethod(req, res, name) {
  const method = (await loadMethods(req.tenant.id))[name];
  if (!method.enabled || !method.configured) {
    res.status(400).json({ error: 'Bu ödeme yöntemi şu anda kullanılamıyor.', error_en: 'This payment method is not available right now.' });
    return null;
  }
  return method;
}

function checkAmount(res, method, amountKurus) {
  const message = amountError(method, amountKurus);
  if (message) res.status(400).json({ error: message, field: 'amount' });
  return !message;
}

async function insertPayment({ tenantId, customerId, method, amountKurus, oid, bankName = null, senderName = null, note = null }) {
  const created = await dbAsync.run(
    `INSERT INTO tenant_payments (tenant_id, customer_id, method, amount_kurus, merchant_oid, bank_name, sender_name, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, customerId, method, amountKurus, oid, bankName, senderName, note]
  );
  return created.id;
}

// ------------------------------------------------------------------ yontemler
router.get('/methods', async (req, res, next) => {
  try {
    const methods = await loadMethods(req.tenant.id);
    res.json({
      methods: Object.values(methods).filter(m => m.enabled && m.configured).map(m => ({
        method: m.method,
        label: m.label,
        min: fromKurus(m.min_kurus),
        max: fromKurus(m.max_kurus),
        ...(m.method === 'bank' ? { accounts: m.public.accounts || '', instructions: m.public.instructions || '' } : {}),
        ...(m.method === 'nowpayments' ? {
          coins: Object.entries(NowPayments.SUPPORTED_COINS).map(([code, c]) => ({
            code, label: c.label, network: c.network, recommended: Boolean(c.recommended)
          }))
        } : {})
      }))
    });
  } catch (err) { next(err); }
});

router.get('/history', requireCustomer, async (req, res, next) => {
  try {
    const rows = await dbAsync.all(
      'SELECT * FROM tenant_payments WHERE tenant_id = ? AND customer_id = ? ORDER BY id DESC LIMIT 50',
      [req.tenant.id, req.customer.id]
    );
    res.json({ payments: rows.map(publicPayment) });
  } catch (err) { next(err); }
});

router.get('/status/:oid', requireCustomer, async (req, res, next) => {
  try {
    const row = await dbAsync.get(
      'SELECT * FROM tenant_payments WHERE tenant_id = ? AND customer_id = ? AND merchant_oid = ?',
      [req.tenant.id, req.customer.id, String(req.params.oid || '').slice(0, 64)]
    );
    if (!row) return res.status(404).json({ error: 'Ödeme kaydı bulunamadı.', error_en: 'Payment not found.' });
    const fresh = await dbAsync.get('SELECT balance_kurus FROM tenant_customers WHERE id = ?', [req.customer.id]);
    res.json({ payment: publicPayment(row), balance: fromKurus(fresh.balance_kurus) });
  } catch (err) { next(err); }
});

// ------------------------------------------------------------ havale / EFT
// Musteri parayi bayinin hesabina gonderir ve bildirir; bayi panelden onaylar.
router.post('/bank', requireActiveTenant, requireCustomer, startLimiter, validate(bankSchema), async (req, res, next) => {
  try {
    const method = await enabledMethod(req, res, 'bank');
    if (!method) return;
    const amountKurus = toKurus(req.body.amount);
    if (!checkAmount(res, method, amountKurus)) return;
    const senderName = normalizePlainText(req.body.sender_name, 120);
    const pending = await dbAsync.get(
      "SELECT COUNT(*) AS n FROM tenant_payments WHERE customer_id = ? AND method = 'bank' AND status = 'pending'",
      [req.customer.id]
    );
    if (pending.n >= 3) {
      return res.status(409).json({
        error: 'Onay bekleyen 3 bildirimin var. Onaylanmalarını bekle.',
        error_en: 'You already have 3 notices awaiting approval.'
      });
    }
    const id = await insertPayment({
      tenantId: req.tenant.id, customerId: req.customer.id, method: 'bank', amountKurus, oid: newOid('BH'),
      bankName: normalizePlainText(req.body.bank_name, 80), senderName, note: normalizePlainText(req.body.note, 300) || null
    });
    await logTenantActivity(dbAsync, {
      tenantId: req.tenant.id, actorType: 'customer', actorId: req.customer.id, action: 'payment_notice',
      details: { payment_id: id, amount: fromKurus(amountKurus), sender: senderName }, ip: clientIp(req)
    });
    res.status(201).json({ message: 'Ödeme bildirimin alındı. Onaylanınca bakiyene eklenecek.', payment_id: id });
  } catch (err) { next(err); }
});

// ------------------------------------------------------------------- PayTR
function paytrCreds(req, method) {
  return {
    merchantId: method.secrets.merchant_id,
    merchantKey: method.secrets.merchant_key,
    merchantSalt: method.secrets.merchant_salt,
    baseUrl: siteUrl(req),
    testMode: Boolean(method.public.test_mode)
  };
}

router.post('/paytr/token', requireActiveTenant, requireCustomer, startLimiter, validate(cardSchema), async (req, res, next) => {
  try {
    const method = await enabledMethod(req, res, 'paytr');
    if (!method) return;
    const amountKurus = toKurus(req.body.amount);
    if (!checkAmount(res, method, amountKurus)) return;
    const oid = newOid('BY');
    const id = await insertPayment({ tenantId: req.tenant.id, customerId: req.customer.id, method: 'paytr', amountKurus, oid });
    const base = siteUrl(req);
    try {
      const token = await PayTR.createIframeToken({
        user: { email: req.customer.email, username: req.customer.username },
        amountKurus,
        merchantOid: oid,
        userIp: clientIp(req),
        creds: paytrCreds(req, method),
        okUrl: `${base}/bakiye?odeme=${oid}`,
        failUrl: `${base}/bakiye?odeme=${oid}`,
        basketName: `${req.tenant.name} Bakiye`
      });
      res.status(201).json({ merchant_oid: oid, payment_url: `https://www.paytr.com/odeme/guvenli/${token}` });
    } catch (err) {
      await closePayment(dbAsync, id, err.message);
      err.status = err.status && err.status < 500 ? err.status : 502;
      throw err;
    }
  } catch (err) { next(err); }
});

// PayTR bildirimi (bayinin PayTR panelinde "Bildirim URL" olarak bu adres yazilir).
// PayTR "OK" gorene kadar tekrar dener; bilinmeyen kayitta da OK donulur.
router.post('/paytr/callback', async (req, res) => {
  try {
    const oid = String(req.body?.merchant_oid || '').slice(0, 64);
    const method = (await loadMethods(req.tenant.id)).paytr;
    if (!method.configured || !PayTR.verifyCallback(req.body || {}, paytrCreds(req, method))) {
      return res.status(400).type('text').send('PAYTR notification failed: bad hash');
    }
    const payment = await dbAsync.get(
      "SELECT * FROM tenant_payments WHERE tenant_id = ? AND method = 'paytr' AND merchant_oid = ?",
      [req.tenant.id, oid]
    );
    if (payment?.status === 'pending') {
      if (req.body.status === 'success') {
        await withTransaction(tx => completePayment(tx, payment.id));
      } else {
        await closePayment(dbAsync, payment.id, req.body.failed_reason_msg || 'Ödeme reddedildi.');
      }
    }
    return res.type('text').send('OK');
  } catch (err) {
    console.error('Bayi PayTR bildirimi:', err.message);
    return res.status(500).type('text').send('ERROR');
  }
});

// ------------------------------------------------------------ NOWPayments
function nowCreds(req, method) {
  return { apiKey: method.secrets.api_key, ipnSecret: method.secrets.ipn_secret, baseUrl: siteUrl(req) };
}

router.post('/nowpayments/create', requireActiveTenant, requireCustomer, startLimiter, validate(cryptoSchema), async (req, res, next) => {
  try {
    const method = await enabledMethod(req, res, 'nowpayments');
    if (!method) return;
    const coin = NowPayments.SUPPORTED_COINS[req.body.pay_currency];
    if (!coin) return res.status(400).json({ error: 'Desteklenmeyen coin seçildi.', error_en: 'Unsupported coin.' });
    const amountKurus = toKurus(req.body.amount);
    if (!checkAmount(res, method, amountKurus)) return;
    const oid = newOid('BC');
    const id = await insertPayment({ tenantId: req.tenant.id, customerId: req.customer.id, method: 'nowpayments', amountKurus, oid });
    try {
      const payment = await NowPayments.createPayment({
        amountTry: fromKurus(amountKurus),
        payCurrency: req.body.pay_currency,
        orderId: oid,
        config: nowCreds(req, method),
        callbackUrl: `${siteUrl(req)}/api/payments/nowpayments/callback`,
        description: `${req.tenant.name} bakiye yükleme`
      });
      await dbAsync.run('UPDATE tenant_payments SET provider_ref = ? WHERE id = ?', [payment.paymentId, id]);
      const qr = await QRCode.toDataURL(payment.payAddress, { margin: 1, width: 240 });
      res.status(201).json({
        merchant_oid: oid,
        pay_address: payment.payAddress,
        pay_amount: payment.payAmount,
        pay_currency: payment.payCurrency,
        coin: `${coin.label} (${coin.network})`,
        expires_at: payment.expiresAt,
        amount: fromKurus(amountKurus),
        qr
      });
    } catch (err) {
      await closePayment(dbAsync, id, err.message);
      throw err;
    }
  } catch (err) { next(err); }
});

router.post('/nowpayments/callback', async (req, res) => {
  try {
    const method = (await loadMethods(req.tenant.id)).nowpayments;
    if (!method.configured || !await NowPayments.verifyIpnSignature(req.body || {}, req.headers['x-nowpayments-sig'], nowCreds(req, method))) {
      return res.status(400).type('text').send('bad signature');
    }
    const oid = String(req.body.order_id || '').slice(0, 64);
    const status = String(req.body.payment_status || '').toLowerCase();
    const payment = await dbAsync.get(
      "SELECT * FROM tenant_payments WHERE tenant_id = ? AND method = 'nowpayments' AND merchant_oid = ?",
      [req.tenant.id, oid]
    );
    if (payment?.status === 'pending') {
      if (status === 'finished') {
        await withTransaction(tx => completePayment(tx, payment.id, { providerRef: String(req.body.payment_id || '') || null }));
      } else if (['failed', 'expired', 'refunded'].includes(status)) {
        await closePayment(dbAsync, payment.id, `NOWPayments: ${status}`);
      } else if (status === 'partially_paid') {
        // Eksik odeme otomatik yazilmaz; bayi panelden gorup elle telafi eder.
        const paid = req.body.actually_paid ? `${req.body.actually_paid} ${req.body.pay_currency || ''}` : 'bilinmiyor';
        await closePayment(dbAsync, payment.id, `Eksik ödeme (gelen: ${paid})`);
      }
    }
    return res.type('text').send('OK');
  } catch (err) {
    console.error('Bayi NOWPayments bildirimi:', err.message);
    return res.status(500).type('text').send('ERROR');
  }
});

module.exports = router;
