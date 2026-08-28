const express = require('express');
const { z } = require('zod');
const { dbAsync, withTransaction } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { normalizePlainText, createOpaqueToken } = require('../utils/security');
const { toKurus, fromKurus } = require('../utils/money');
const PayTR = require('../services/paytr');
const QRCode = require('qrcode');
const NowPayments = require('../services/nowpayments');
const Shopier = require('../services/shopier');
const telegram = require('../services/telegramNotifier');
const { activeDepositBonus } = require('../services/campaigns');

const router = express.Router();

// Aktif "bakiye bonusu" kampanyasi varsa yatirilan tutara ek bonus yazar.
// Islem, cagiranin transaction'i icinde kosar; bonus satiri payments'ta ayrica
// gorunur ki muhasebe izlenebilir kalsin.
// routes/admin.js banka onayinda da ayni bonus mantigini kullanir.
async function applyDepositBonus(tx, userId, amountKurus, sourceLabel) {
  const bonus = await activeDepositBonus();
  if (!bonus) return 0;
  if (bonus.min_deposit_kurus && amountKurus < bonus.min_deposit_kurus) return 0;
  const bonusKurus = Math.round(amountKurus * Number(bonus.bonus_percent) / 100);
  if (bonusKurus <= 0) return 0;
  await tx.run('UPDATE users SET balance_kurus = balance_kurus + ?, balance = (balance_kurus + ?) / 100.0 WHERE id = ?', [bonusKurus, bonusKurus, userId]);
  await tx.run(
    `INSERT INTO payments (user_id, amount, amount_kurus, method, status, transaction_id)
     VALUES (?, ?, ?, ?, 'completed', ?)`,
    [userId, fromKurus(bonusKurus), bonusKurus, `Bonus (%${bonus.bonus_percent})`, `BONUS_${sourceLabel}_${userId}_${Date.now()}`]
  );
  await tx.run('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
    [userId, 'payment', 'Bakiye bonusu 🎁', `"${bonus.name}" kampanyasıyla ₺${fromKurus(bonusKurus).toFixed(2)} bonus bakiyenize eklendi.`]);
  return bonusKurus;
}

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
        const paytrBonus = await applyDepositBonus(tx, intent.user_id, intent.amount_kurus, 'PAYTR');
        const paytrUser = await tx.get('SELECT username FROM users WHERE id = ?', [intent.user_id]);
        // Bildirim beklenmez; hatalari servis icinde yutulur.
        telegram.notifyDeposit({ username: paytrUser?.username || `#${intent.user_id}`, amount: fromKurus(intent.amount_kurus), method: 'PayTR (Kart)', bonus: fromKurus(paytrBonus) });
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
      // Talep bildirimi beklenmez; hatalari servis icinde yutulur.
      telegram.notifyPaymentEvent('💳 Yükleme Talebi Oluşturuldu (PayTR)', [
        `👤 Kullanıcı: ${req.user.username}`,
        `➕ Tutar: ₺${fromKurus(amountKurus).toFixed(2)}`,
        '⏳ Kart ödemesi bekleniyor…'
      ]);
      res.status(201).json({ token, merchant_oid: merchantOid, iframe_url: `https://www.paytr.com/odeme/guvenli/${token}` });
    } catch (err) {
      await dbAsync.run("UPDATE payment_intents SET status = 'failed', failure_reason = ? WHERE merchant_oid = ?", [normalizePlainText(err.message, 500), merchantOid]);
      throw err;
    }
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// SHOPIER (KART) BAKİYE YÜKLEME
// Shopier'in "odeme baslat" ucu olmadigi icin akis su sekilde: her yukleme icin
// magazada gecici bir urun olusturulur, musteri o urunun sayfasinda oder,
// order.created webhook'u gelince bakiye yazilir ve urun silinir.
// Eslestirme urun kimligi (payment_intents.provider_ref) uzerinden yapilir.
// ---------------------------------------------------------------------------

const SHOPIER_MIN_TRY = 10;

router.post('/shopier/create', authenticateToken, validate(z.object({
  amount: z.coerce.number().min(SHOPIER_MIN_TRY).max(100000)
})), async (req, res, next) => {
  try {
    const amountKurus = toKurus(req.body.amount);
    const merchantOid = createOpaqueToken('SH').replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);
    const intent = await dbAsync.run(
      "INSERT INTO payment_intents (user_id, provider, merchant_oid, amount_kurus) VALUES (?, 'shopier', ?, ?)",
      [req.user.id, merchantOid, amountKurus]
    );
    try {
      const product = await Shopier.createTopUpProduct({
        amountKurus,
        merchantOid,
        username: req.user.username
      });
      // Webhook'ta kendi referansimiz gelmedigi icin eslestirme buradan yapilir.
      await dbAsync.run('UPDATE payment_intents SET provider_ref = ? WHERE id = ?', [product.productId, intent.id]);

      telegram.notifyPaymentEvent('🛍️ Yükleme Talebi Oluşturuldu (Shopier)', [
        `👤 Kullanıcı: ${req.user.username}`,
        `➕ Tutar: ₺${fromKurus(amountKurus).toFixed(2)}`,
        '⏳ Kart ödemesi bekleniyor…'
      ]);
      res.status(201).json({ merchant_oid: merchantOid, payment_url: product.url, amount: fromKurus(amountKurus) });
    } catch (err) {
      await dbAsync.run("UPDATE payment_intents SET status = 'failed', failure_reason = ? WHERE id = ?",
        [normalizePlainText(err.message, 500), intent.id]);
      throw err;
    }
    // Odenmeden birakilmis eski yuklemelerin urunleri arka planda toplanir;
    // yanit beklemez, magazada urun birikmesini engeller.
    Shopier.sweepAbandonedProducts().catch(() => {});
  } catch (err) { next(err); }
});

// Kullanicinin kendi odeme niyetinin durumu (donus sayfasinin yoklamasi icin).
router.get('/shopier/status/:oid', authenticateToken, async (req, res, next) => {
  try {
    const oid = String(req.params.oid || '').slice(0, 64);
    const intent = await dbAsync.get(
      "SELECT status, amount_kurus, failure_reason FROM payment_intents WHERE provider = 'shopier' AND merchant_oid = ? AND user_id = ?",
      [oid, req.user.id]
    );
    if (!intent) return res.status(404).json({ error: 'Ödeme kaydı bulunamadı.' });
    res.json({ status: intent.status, amount: fromKurus(intent.amount_kurus), failure_reason: intent.failure_reason });
  } catch (err) { next(err); }
});

// Shopier order.created bildirimi. Imza ham govde uzerinden dogrulanir
// (server.js express.json'un verify kancasinda req.rawBody'e alinir).
router.post('/shopier/webhook', async (req, res) => {
  try {
    const rawBody = req.rawBody;
    if (!rawBody || !await Shopier.verifyWebhook(rawBody, req.headers['shopier-signature'])) {
      console.error('Shopier webhook: imza doğrulanamadı.');
      return res.status(400).type('text').send('bad signature');
    }

    const order = req.body || {};
    const orderId = String(order.id || '').slice(0, 64);
    const paid = String(order.paymentStatus || '').toLowerCase() === 'paid';
    // Satirlardaki urun kimlikleri: hangi bakiye yuklemesi oldugunu bunlar soyler.
    const productIds = Array.isArray(order.lineItems)
      ? order.lineItems.map(item => String(item?.productId || '')).filter(Boolean)
      : [];
    if (!orderId || !productIds.length) return res.type('text').send('OK');
    if (!paid) return res.type('text').send('OK');

    let completedInfo = null;
    let productToDelete = null;
    await withTransaction(async tx => {
      const placeholders = productIds.map(() => '?').join(',');
      const intent = await tx.get(
        `SELECT * FROM payment_intents WHERE provider = 'shopier' AND provider_ref IN (${placeholders})`,
        productIds
      );
      // Bize ait olmayan bir siparis (magazadaki normal satis) sessizce gecilir.
      if (!intent || intent.status === 'completed' || intent.status === 'failed') return;

      // Ayni bildirim yalnizca bir kez islenir.
      const dedupe = await tx.run(
        'INSERT OR IGNORE INTO payment_webhooks (provider, external_id, payload) VALUES (?, ?, ?)',
        ['shopier', `order:${orderId}`, JSON.stringify(order)]
      );
      if (dedupe.changes !== 1) return;

      const claimed = await tx.run(
        "UPDATE payment_intents SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'",
        [intent.id]
      );
      if (claimed.changes !== 1) return;

      await tx.run('UPDATE users SET balance_kurus = balance_kurus + ?, balance = (balance_kurus + ?) / 100.0 WHERE id = ?',
        [intent.amount_kurus, intent.amount_kurus, intent.user_id]);
      await tx.run(`INSERT INTO payments (user_id, amount, amount_kurus, method, status, transaction_id) VALUES (?, ?, ?, 'Shopier', 'completed', ?)`,
        [intent.user_id, fromKurus(intent.amount_kurus), intent.amount_kurus, intent.merchant_oid]);
      await tx.run('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
        [intent.user_id, 'payment', 'Ödeme tamamlandı', `₺${fromKurus(intent.amount_kurus).toFixed(2)} bakiyenize eklendi.`]);
      const bonusKurus = await applyDepositBonus(tx, intent.user_id, intent.amount_kurus, 'SHOPIER');
      const user = await tx.get('SELECT username FROM users WHERE id = ?', [intent.user_id]);
      completedInfo = { username: user?.username || `#${intent.user_id}`, amount: fromKurus(intent.amount_kurus), bonus: fromKurus(bonusKurus) };
      productToDelete = intent.provider_ref;
    });

    if (completedInfo) telegram.notifyDeposit({ ...completedInfo, method: 'Shopier (Kart)' });
    // Gecici urun magazadan temizlenir; hatasi yutulur, odeme zaten tamamlandi.
    if (productToDelete) {
      await Shopier.deleteProduct(productToDelete);
      await dbAsync.run('UPDATE payment_intents SET provider_ref = NULL WHERE provider_ref = ?', [productToDelete]);
    }
    return res.type('text').send('OK');
  } catch (err) {
    console.error('Shopier webhook error:', err.message);
    return res.status(500).type('text').send('ERROR');
  }
});

// ---------------------------------------------------------------------------
// NOWPAYMENTS (KRİPTO) BAKİYE YÜKLEME
// Akis PayTR ile ayni iskelette: intent olustur -> kullanici odesin ->
// imzali IPN gelince bakiye yaz. payment_webhooks tekrari engeller.
// ---------------------------------------------------------------------------
// NOWPayments'in coin bazli alt limitleri var (ag ucretleri nedeniyle).
// Taban limit USDT'yi rahat karsilar; coin bazli gercek limit create sirasinda
// estimate + min-amount ile ayrica dogrulanir.
const MIN_CRYPTO_TRY = 400;

// Musterinin secebilecegi coin listesi (hesapta acik olanlarla kesisim).
router.get('/nowpayments/currencies', authenticateToken, async (req, res, next) => {
  try {
    res.json({ coins: await NowPayments.getAvailableCoins(), min_try: MIN_CRYPTO_TRY });
  } catch (err) { next(err); }
});

// Secilen coinin TL cinsinden guncel alt limiti (ekranda canli gosterilir).
router.get('/nowpayments/min/:coin', authenticateToken, async (req, res, next) => {
  try {
    const coin = String(req.params.coin || '').toLowerCase();
    if (!NowPayments.SUPPORTED_COINS[coin]) return res.status(400).json({ error: 'Desteklenmeyen coin.' });
    const minTry = await NowPayments.getMinTryFor(coin).catch(() => 0);
    res.json({ min_try: Math.max(MIN_CRYPTO_TRY, minTry) });
  } catch (err) { next(err); }
});

router.post('/nowpayments/create', authenticateToken, validate(z.object({
  amount: z.coerce.number().min(MIN_CRYPTO_TRY, `Kripto ödemelerde alt limit ₺${MIN_CRYPTO_TRY}'dür (blockchain ağ ücretleri nedeniyle).`).max(100000),
  pay_currency: z.string().trim().toLowerCase().max(20).default('usdttrc20')
})), async (req, res, next) => {
  try {
    const payCurrency = req.body.pay_currency;
    if (!NowPayments.SUPPORTED_COINS[payCurrency]) {
      return res.status(400).json({ error: 'Desteklenmeyen coin seçildi.' });
    }
    const amountTry = req.body.amount;

    // Coin bazli alt limit: tutarin coin karsiligi, NOWPayments'in o coin icin
    // kabul ettigi en dusuk miktarin altindaysa odeme hic baslatilmaz ve
    // musteriye TL cinsinden yaklasik alt limit soylenir.
    try {
      const minTry = await NowPayments.getMinTryFor(payCurrency);
      if (minTry > 0 && amountTry < minTry) {
        const coin = NowPayments.SUPPORTED_COINS[payCurrency];
        // Kullanicinin sectigi coini kendisine "alternatif" diye onermeyelim.
        const suggestion = payCurrency === 'usdttrc20'
          ? 'Lütfen tutarı artırın.'
          : 'Tutarı artırın veya USDT (TRC-20) gibi düşük limitli bir coin seçin.';
        return res.status(400).json({
          error: `${coin.label} (${coin.network}) için minimum yükleme yaklaşık ₺${minTry}. ${suggestion}`
        });
      }
    } catch (limitErr) {
      // Limit sorgusu basarisiz olursa akisi kesmeyiz; NOWPayments create
      // sirasinda ayni kontrolu kendisi de yapar.
      if (limitErr.status === 503) throw limitErr;
    }

    const amountKurus = toKurus(amountTry);
    const merchantOid = createOpaqueToken('CR').replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);
    await dbAsync.run("INSERT INTO payment_intents (user_id, provider, merchant_oid, amount_kurus) VALUES (?, 'nowpayments', ?, ?)", [req.user.id, merchantOid, amountKurus]);
    try {
      const payment = await NowPayments.createPayment({ amountTry: fromKurus(amountKurus), payCurrency, orderId: merchantOid });
      const coinMeta = NowPayments.SUPPORTED_COINS[payCurrency];
      telegram.notifyPaymentEvent('🪙 Yükleme Talebi Oluşturuldu (Kripto)', [
        `👤 Kullanıcı: ${req.user.username}`,
        `➕ Tutar: ₺${fromKurus(amountKurus).toFixed(2)}`,
        `🪙 Coin: ${coinMeta.label} (${coinMeta.network}) → ${payment.payAmount}`,
        '⏳ Blockchain ödemesi bekleniyor…'
      ]);
      // QR sitede cizilir: cogu cuzdan duz adresi sorunsuz okur.
      const qr = await QRCode.toDataURL(payment.payAddress, { margin: 1, width: 240 });
      res.status(201).json({
        merchant_oid: merchantOid,
        pay_address: payment.payAddress,
        pay_amount: payment.payAmount,
        pay_currency: payment.payCurrency,
        expires_at: payment.expiresAt,
        amount_try: fromKurus(amountKurus),
        qr
      });
    } catch (err) {
      await dbAsync.run("UPDATE payment_intents SET status = 'failed', failure_reason = ? WHERE merchant_oid = ?", [normalizePlainText(err.message, 500), merchantOid]);
      throw err;
    }
  } catch (err) { next(err); }
});

// Kullanicinin kendi odeme niyetinin durumu (odeme sonrasi ekran yoklamasi icin).
router.get('/nowpayments/status/:oid', authenticateToken, async (req, res, next) => {
  try {
    const oid = String(req.params.oid || '').slice(0, 64);
    const intent = await dbAsync.get(
      "SELECT status, amount_kurus, failure_reason FROM payment_intents WHERE provider = 'nowpayments' AND merchant_oid = ? AND user_id = ?",
      [oid, req.user.id]
    );
    if (!intent) return res.status(404).json({ error: 'Ödeme kaydı bulunamadı.' });
    res.json({ status: intent.status, amount: fromKurus(intent.amount_kurus), failure_reason: intent.failure_reason });
  } catch (err) { next(err); }
});

router.post('/nowpayments/callback', async (req, res) => {
  try {
    // Imza dogrulanamayan istekler tamamen yok sayilir.
    if (!await NowPayments.verifyIpnSignature(req.body, req.headers['x-nowpayments-sig'])) {
      return res.status(400).type('text').send('bad signature');
    }
    const merchantOid = String(req.body.order_id || '').slice(0, 64);
    const paymentStatus = String(req.body.payment_status || '').toLowerCase();
    const paymentId = String(req.body.payment_id || req.body.invoice_id || merchantOid).slice(0, 64);
    if (!merchantOid) return res.status(400).type('text').send('missing order');

    let completedInfo = null;
    let problemInfo = null;
    await withTransaction(async tx => {
      const intent = await tx.get("SELECT * FROM payment_intents WHERE provider = 'nowpayments' AND merchant_oid = ?", [merchantOid]);
      if (!intent || intent.status === 'completed') return;

      // Ayni bildirim (odeme + durum) yalnizca bir kez islenir.
      const dedupe = await tx.run(
        'INSERT OR IGNORE INTO payment_webhooks (provider, external_id, payload) VALUES (?, ?, ?)',
        ['nowpayments', `${paymentId}:${paymentStatus}`, JSON.stringify(req.body)]
      );
      if (dedupe.changes !== 1) return;

      if (paymentStatus === 'finished') {
        const claimed = await tx.run("UPDATE payment_intents SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'", [intent.id]);
        if (claimed.changes !== 1) return;
        await tx.run('UPDATE users SET balance_kurus = balance_kurus + ?, balance = (balance_kurus + ?) / 100.0 WHERE id = ?', [intent.amount_kurus, intent.amount_kurus, intent.user_id]);
        await tx.run(`INSERT INTO payments (user_id, amount, amount_kurus, method, status, transaction_id) VALUES (?, ?, ?, 'Kripto (NOWPayments)', 'completed', ?)`, [intent.user_id, fromKurus(intent.amount_kurus), intent.amount_kurus, merchantOid]);
        await tx.run('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)', [intent.user_id, 'payment', 'Kripto ödemesi tamamlandı 🪙', `₺${fromKurus(intent.amount_kurus).toFixed(2)} bakiyenize eklendi.`]);
        const bonusKurus = await applyDepositBonus(tx, intent.user_id, intent.amount_kurus, 'CRYPTO');
        const user = await tx.get('SELECT username FROM users WHERE id = ?', [intent.user_id]);
        completedInfo = { username: user?.username || `#${intent.user_id}`, amount: fromKurus(intent.amount_kurus), bonus: fromKurus(bonusKurus) };
      } else if (['failed', 'expired', 'refunded'].includes(paymentStatus)) {
        const changed = await tx.run("UPDATE payment_intents SET status = 'failed', failure_reason = ? WHERE id = ? AND status = 'pending'", [normalizePlainText(`NOWPayments: ${paymentStatus}`, 500), intent.id]);
        if (changed.changes === 1) {
          const user = await tx.get('SELECT username FROM users WHERE id = ?', [intent.user_id]);
          problemInfo = { title: '⚠️ Kripto Ödemesi Tamamlanamadı', lines: [
            `👤 Kullanıcı: ${user?.username || `#${intent.user_id}`}`,
            `➕ Tutar: ₺${fromKurus(intent.amount_kurus).toFixed(2)}`,
            `❌ Durum: ${paymentStatus}`
          ]};
        }
      } else if (paymentStatus === 'partially_paid') {
        // Eksik odeme otomatik tahsil edilmez; yonetici kullanici bakiyesinden
        // elle telafi edebilsin diye gerekce kaydedilir.
        const paid = req.body.actually_paid ? `${req.body.actually_paid} ${req.body.pay_currency || ''}` : 'bilinmiyor';
        const changed = await tx.run("UPDATE payment_intents SET status = 'failed', failure_reason = ? WHERE id = ? AND status = 'pending'", [normalizePlainText(`Eksik ödeme (gelen: ${paid})`, 500), intent.id]);
        if (changed.changes === 1) {
          const user = await tx.get('SELECT username FROM users WHERE id = ?', [intent.user_id]);
          problemInfo = { title: '⚠️ Eksik Kripto Ödemesi — Elle Kontrol Gerekli', lines: [
            `👤 Kullanıcı: ${user?.username || `#${intent.user_id}`}`,
            `➕ Beklenen: ₺${fromKurus(intent.amount_kurus).toFixed(2)}`,
            `📉 Gelen: ${paid}`,
            '💡 Gerekirse Kullanıcılar sekmesinden elle bakiye ekleyebilirsin.'
          ]};
        }
      }
      // waiting / confirming / confirmed / sending ara durumlardir; dokunulmaz.
    });

    if (completedInfo) telegram.notifyDeposit({ ...completedInfo, method: 'Kripto (NOWPayments)' });
    if (problemInfo) telegram.notifyPaymentEvent(problemInfo.title, problemInfo.lines);
    return res.type('text').send('OK');
  } catch (err) {
    console.error('NOWPayments callback error:', err.message);
    return res.status(500).type('text').send('ERROR');
  }
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
    // Kupon istismarina karsi: kod kullanmak dogrulanmis e-posta ister.
    // Istemci bu kodu gorunce animasyonlu dogrulama ekranini acar.
    if (!req.user.email_verified) {
      return res.status(403).json({
        error: 'Kupon kullanabilmek için önce e-posta adresini doğrulaman gerekiyor.',
        error_en: 'Please verify your email address before redeeming a coupon.',
        code: 'email_verification_required'
      });
    }
    const cleanCode = normalizePlainText(req.body.code, 64).toUpperCase();
    const result = await withTransaction(async tx => {
      // TR kodu da EN takma kodu da ayni kuponu bulur (ortak limit/kullanim).
      const coupon = await tx.get('SELECT * FROM coupons WHERE code = ? COLLATE NOCASE OR code_en = ? COLLATE NOCASE', [cleanCode, cleanCode]);
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
    telegram.notifyPaymentEvent('🎟️ Kupon Kullanıldı', [
      `👤 Kullanıcı: ${req.user.username}`,
      `🎫 Kod: ${cleanCode}`,
      `➕ Eklenen: ₺${fromKurus(result.amountKurus).toFixed(2)}`
    ]);
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
    // Bu bildirim admin onayi gerektirir; Telegram'dan aninda haber verilir.
    telegram.notifyPaymentEvent('🏦 Yeni Banka/Papara Ödeme Bildirimi', [
      `👤 Kullanıcı: ${req.user.username}`,
      `🏦 Yöntem: ${normalizePlainText(req.body.bank_name, 80)}`,
      `➕ Tutar: ₺${fromKurus(amountKurus).toFixed(2)}`,
      `✍️ Gönderen: ${normalizePlainText(req.body.sender_name, 120)}`,
      '👉 Admin Panel → Ödeme Bildirimleri bölümünden onaylayabilirsin.'
    ]);
    res.status(201).json({ message: 'Ödeme bildiriminiz incelemeye alındı.' });
  } catch (err) { next(err); }
});

module.exports = router;
module.exports.applyDepositBonus = applyDepositBonus;
