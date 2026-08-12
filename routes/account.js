const express = require('express');
const { dbAsync, withTransaction } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { fromKurus } = require('../utils/money');

const router = express.Router();
router.use(authenticateToken);

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
