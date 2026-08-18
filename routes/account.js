const express = require('express');
const crypto = require('crypto');
const { dbAsync, withTransaction } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { fromKurus } = require('../utils/money');
const { tokenHash, createOpaqueToken } = require('../utils/security');
const telegram = require('../services/telegramNotifier');

const router = express.Router();
router.use(authenticateToken);

// --- TELEGRAM SİPARİŞ BİLDİRİMLERİ -----------------------------------------
// Bot kullanici adina mesaj atamaz (Telegram kurali); bu yuzden kullanici
// tek kullanimlik kodlu deep link ile bota /start atar, poller eslestirir.

router.get('/telegram/status', async (req, res, next) => {
  try {
    const user = await dbAsync.get('SELECT telegram_chat_id, telegram_username, telegram_notify FROM users WHERE id = ?', [req.user.id]);
    res.json({
      connected: Boolean(user?.telegram_chat_id),
      telegram_username: user?.telegram_username || null,
      notify: Boolean(user?.telegram_notify)
    });
  } catch (err) { next(err); }
});

router.post('/telegram/link-code', async (req, res, next) => {
  try {
    const botUsername = await telegram.getBotUsername().catch(() => null);
    if (!botUsername) return res.status(503).json({ error: 'Telegram bildirimleri şu an kullanılamıyor. (Bot yapılandırılmamış.)' });

    // Deep link payload'i en fazla 64 karakter olabilir; 24 bayt base64url ~32.
    const code = crypto.randomBytes(24).toString('base64url');
    await dbAsync.run('DELETE FROM verification_tokens WHERE user_id = ? AND purpose = ?', [req.user.id, 'telegram_link']);
    await dbAsync.run(
      `INSERT INTO verification_tokens (user_id, purpose, token_hash, expires_at)
       VALUES (?, 'telegram_link', ?, datetime('now', '+30 minutes'))`,
      [req.user.id, tokenHash(code)]
    );
    res.json({ link: `https://t.me/${botUsername}?start=${code}`, bot_username: botUsername });
  } catch (err) { next(err); }
});

router.post('/telegram/disconnect', async (req, res, next) => {
  try {
    await dbAsync.run('UPDATE users SET telegram_chat_id = NULL, telegram_username = NULL WHERE id = ?', [req.user.id]);
    res.json({ message: 'Telegram bağlantısı kaldırıldı.' });
  } catch (err) { next(err); }
});

// --- MÜŞTERİ YORUMU ---------------------------------------------------------
// Yalnizca tamamlanmis siparisi olan kullanici yorum birakabilir; yorum admin
// onayindan gecmeden yayinlanmaz. Siparis basina bir yorum hakki vardir.
router.post('/review', async (req, res, next) => {
  try {
    const rating = Math.round(Number(req.body?.rating));
    const comment = String(req.body?.comment || '').replace(/\s+/g, ' ').trim();
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Puan 1 ile 5 arasında olmalıdır.' });
    }
    if (comment.length < 10 || comment.length > 400) {
      return res.status(400).json({ error: 'Yorum 10-400 karakter arasında olmalıdır.' });
    }
    // Henuz yorumlanmamis, tamamlanmis bir siparis bulunmali.
    const order = await dbAsync.get(`
      SELECT o.id FROM orders o
      WHERE o.user_id = ? AND o.status = 'completed'
        AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.order_id = o.id)
      ORDER BY o.id DESC LIMIT 1`, [req.user.id]);
    if (!order) {
      return res.status(400).json({ error: 'Yorum bırakmak için tamamlanmış (ve henüz yorumlanmamış) bir siparişin olmalı.' });
    }
    await dbAsync.run(
      'INSERT INTO reviews (user_id, order_id, rating, comment, status) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, order.id, rating, comment, 'pending']
    );
    res.status(201).json({ message: 'Teşekkürler! Yorumun onaylandıktan sonra yayınlanacak.' });
  } catch (err) { next(err); }
});

router.get('/summary', async (req, res, next) => {
  try {
    const spent = await dbAsync.get("SELECT COALESCE(SUM(charge_kurus - refunded_kurus), 0) total FROM orders WHERE user_id = ? AND status IN ('completed','partial')", [req.user.id]);
    const referrals = await dbAsync.get('SELECT COUNT(*) count FROM users WHERE referrer_id = ?', [req.user.id]);
    const totalSpent = spent.total || 0;
    const vip = totalSpent >= 500000 ? 'elmas' : totalSpent >= 150000 ? 'altin' : totalSpent >= 50000 ? 'gumus' : 'bronz';
    res.json({
      balance: fromKurus(req.user.balance_kurus),
      referral_balance: fromKurus(req.user.referral_balance_kurus),
      referral_count: referrals.count,
      referral_code: req.user.username,
      total_spent: fromKurus(totalSpent),
      vip
    });
  } catch (err) { next(err); }
});

// Profil sayfasi: bakiye yukleme gecmisi (onaylanan odemeler + bekleyenler).
router.get('/payments', async (req, res, next) => {
  try {
    const rows = await dbAsync.all(
      `SELECT id, amount, amount_kurus, method, status, transaction_id, created_at
       FROM payments WHERE user_id = ? ORDER BY id DESC LIMIT 100`,
      [req.user.id]
    );
    res.json({
      payments: rows.map(row => ({
        id: row.id,
        amount: row.amount_kurus ? fromKurus(row.amount_kurus) : Number(row.amount || 0),
        method: row.method,
        status: row.status,
        created_at: row.created_at
      }))
    });
  } catch (err) { next(err); }
});

// --- API ANAHTARI ----------------------------------------------------------
// Anahtar kayit sirasinda uretilir; ancak eski hesaplarda bos olabilir ve
// sizdirildiginda yenilenebilmelidir. Ikisi de bu uctan yapilir.

router.get('/api-key', async (req, res, next) => {
  try {
    const row = await dbAsync.get('SELECT api_key, api_key_created_at FROM users WHERE id = ?', [req.user.id]);
    res.json({ api_key: row?.api_key || null, created_at: row?.api_key_created_at || null });
  } catch (err) { next(err); }
});

router.post('/api-key', async (req, res, next) => {
  try {
    const row = await dbAsync.get('SELECT api_key FROM users WHERE id = ?', [req.user.id]);
    // Var olan anahtar yalnizca acikca "yenile" denildiginde degisir; aksi
    // halde musterinin calisan entegrasyonu sessizce bozulurdu.
    if (row?.api_key && req.body?.regenerate !== true) {
      return res.status(409).json({
        error: 'Zaten bir API anahtarınız var. Yenilemek istiyorsanız "Yenile" seçeneğini kullanın.',
        error_en: 'You already have an API key. Use the "Regenerate" option if you want a new one.'
      });
    }
    const apiKey = createOpaqueToken('smm_');
    await dbAsync.run(
      "UPDATE users SET api_key = ?, api_key_created_at = datetime('now') WHERE id = ?",
      [apiKey, req.user.id]
    );
    res.json({
      api_key: apiKey,
      regenerated: Boolean(row?.api_key),
      message: row?.api_key
        ? 'API anahtarınız yenilendi. Eski anahtar artık çalışmıyor, entegrasyonunuzu güncelleyin.'
        : 'API anahtarınız oluşturuldu.',
      message_en: row?.api_key
        ? 'Your API key has been regenerated. The old key no longer works — update your integration.'
        : 'Your API key has been created.'
    });
  } catch (err) { next(err); }
});

// Referans komisyonu tamamlanan siparislerden odenir (services/orderWorker.js).
// Oran orada sabit; panelde de ayni degeri gostermek icin buradan gonderilir.
const REFERRAL_RATE = 5;

// Davet edilen kullanici adi kismen maskelenir: davet eden kisi kimin
// kaydoldugunu gorebilmeli ama link herkese acik paylasildigi icin yabanci
// kullanici adlarinin tam listesi cikarilabilir olmamali.
function maskUsername(username) {
  const value = String(username || '');
  if (value.length <= 3) return `${value.slice(0, 1)}**`;
  return `${value.slice(0, 3)}${'*'.repeat(Math.min(6, value.length - 3))}`;
}

router.get('/referrals', async (req, res, next) => {
  try {
    const invited = await dbAsync.all(
      `SELECT u.id, u.username, u.created_at,
              (SELECT COUNT(*) FROM orders o
                WHERE o.user_id = u.id AND o.status IN ('completed','partial')) order_count,
              (SELECT COALESCE(SUM(e.amount_kurus), 0) FROM referral_earnings e
                WHERE e.referred_user_id = u.id AND e.referrer_id = ?) earned_kurus
         FROM users u
        WHERE u.referrer_id = ?
        ORDER BY u.id DESC
        LIMIT 200`,
      [req.user.id, req.user.id]
    );
    const totals = await dbAsync.get(
      `SELECT COALESCE(SUM(amount_kurus), 0) total,
              COALESCE(SUM(CASE WHEN status = 'claimed' THEN amount_kurus ELSE 0 END), 0) claimed
         FROM referral_earnings WHERE referrer_id = ?`,
      [req.user.id]
    );

    res.json({
      code: req.user.username,
      commission_rate: REFERRAL_RATE,
      invited_count: invited.length,
      // Siparis vermis davetliler: komisyon yalnizca onlardan gelir.
      active_count: invited.filter(row => row.order_count > 0).length,
      available: fromKurus(req.user.referral_balance_kurus),
      total_earned: fromKurus(totals.total),
      claimed: fromKurus(totals.claimed),
      invited: invited.map(row => ({
        username: maskUsername(row.username),
        joined_at: row.created_at,
        order_count: row.order_count,
        earned: fromKurus(row.earned_kurus)
      }))
    });
  } catch (err) { next(err); }
});

router.post('/referrals/claim', async (req, res, next) => {
  try {
    const result = await withTransaction(async tx => {
      const user = await tx.get('SELECT referral_balance_kurus FROM users WHERE id = ?', [req.user.id]);
      if (!user || user.referral_balance_kurus <= 0) { const err = new Error('Aktarılabilir referans bakiyesi bulunmuyor.'); err.status = 400; throw err; }
      const amount = user.referral_balance_kurus;
      await tx.run('UPDATE users SET referral_balance_kurus = 0, balance_kurus = balance_kurus + ?, balance = (balance_kurus + ?) / 100.0 WHERE id = ?', [amount, amount, req.user.id]);
      await tx.run("UPDATE referral_earnings SET status = 'claimed' WHERE referrer_id = ? AND status = 'available'", [req.user.id]);
      await tx.run('INSERT INTO payments (user_id, amount, amount_kurus, method, status, transaction_id) VALUES (?, ?, ?, ?, ?, ?)', [req.user.id, fromKurus(amount), amount, 'Referans Kazancı', 'completed', `REF_${Date.now()}_${req.user.id}`]);
      return { amount, user: await tx.get('SELECT balance_kurus FROM users WHERE id = ?', [req.user.id]) };
    });
    res.json({ message: `₺${fromKurus(result.amount).toFixed(2)} bakiyenize aktarıldı.`, new_balance: fromKurus(result.user.balance_kurus) });
  } catch (err) { next(err); }
});

router.get('/notifications', async (req, res, next) => {
  try {
    const notifications = await dbAsync.all('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50', [req.user.id]);
    res.json({ notifications });
  } catch (err) { next(err); }
});

router.post('/notifications/read', async (req, res, next) => {
  try {
    await dbAsync.run('UPDATE notifications SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP) WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'Bildirimler okundu.' });
  } catch (err) { next(err); }
});

module.exports = router;
