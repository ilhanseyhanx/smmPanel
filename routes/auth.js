const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { generateSecret, generateURI, verify } = require('otplib');
const QRCode = require('qrcode');
const { dbAsync, withTransaction } = require('../config/database');
const { authenticateToken, signSession, setSessionCookie } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createOpaqueToken, tokenHash, encryptSecret, decryptSecret, normalizePlainText } = require('../utils/security');
const { fromKurus } = require('../utils/money');
const { sendMail } = require('../services/mailer');

const router = express.Router();

// Kullanici bulunamadiginda da bcrypt.compare calistirilir; boylece yanit suresi
// farkindan gecerli kullanici adi cikarilamaz (kullanici enumerasyonu).
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('invalid-placeholder-password', 12);

const usernameSchema = z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_.-]+$/, 'Kullanıcı adı yalnızca harf, sayı, nokta, tire ve alt çizgi içerebilir.');
const passwordSchema = z.string().min(10, 'Şifre en az 10 karakter olmalıdır.').max(128);

const registerSchema = z.object({
  username: usernameSchema,
  email: z.email().max(254).transform(v => v.toLowerCase()),
  password: passwordSchema,
  referral: z.string().trim().max(32).optional()
});

const loginSchema = z.object({ username: z.string().trim().min(1).max(254), password: z.string().min(1).max(128), totp: z.string().regex(/^\d{6}$/).optional() });

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    balance: fromKurus(user.balance_kurus),
    api_key: user.api_key,
    referral_balance: fromKurus(user.referral_balance_kurus),
    email_verified: Boolean(user.email_verified),
    must_change_password: Boolean(user.must_change_password)
    , two_factor_enabled: Boolean(user.two_factor_enabled)
  };
}

router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { username, email, password, referral } = req.body;
    const hashedPassword = await bcrypt.hash(password, 12);
    const apiKey = createOpaqueToken('smm_');
    const user = await withTransaction(async tx => {
      const existing = await tx.get('SELECT id FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE', [username, email]);
      if (existing) { const err = new Error('Bu kullanıcı adı veya e-posta zaten kullanılıyor.'); err.status = 409; throw err; }
      let referrerId = null;
      if (referral) referrerId = (await tx.get('SELECT id FROM users WHERE username = ? COLLATE NOCASE', [referral]))?.id || null;
      const result = await tx.run(
        `INSERT INTO users (username, email, password, role, balance, balance_kurus, api_key, referrer_id)
         VALUES (?, ?, ?, 'client', 0, 0, ?, ?)`,
        [normalizePlainText(username, 32), email, hashedPassword, apiKey, referrerId]
      );
      return tx.get('SELECT * FROM users WHERE id = ?', [result.id]);
    });
    setSessionCookie(res, signSession(user));
    res.status(201).json({ message: 'Hesabınız oluşturuldu.', user: publicUser(user) });
  } catch (err) { next(err); }
});

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const user = await dbAsync.get('SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE', [req.body.username, req.body.username.toLowerCase()]);
    const passwordMatches = await bcrypt.compare(req.body.password, user?.password || DUMMY_PASSWORD_HASH);
    if (!user || !passwordMatches) return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
    if (user.two_factor_enabled) {
      if (!req.body.totp) return res.status(401).json({ error: 'İki adımlı doğrulama kodu gerekli.', code: 'TWO_FACTOR_REQUIRED' });
      if (!(await verify({ token: req.body.totp, secret: decryptSecret(user.two_factor_secret) })).valid) return res.status(401).json({ error: 'İki adımlı doğrulama kodu geçersiz.' });
    }
    setSessionCookie(res, signSession(user));
    res.json({ message: 'Giriş başarılı.', user: publicUser(user) });
  } catch (err) { next(err); }
});

router.post('/logout', (req, res) => {
  res.clearCookie('smm_session', { path: '/', sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
  res.json({ message: 'Oturum kapatıldı.' });
});

router.get('/me', authenticateToken, (req, res) => res.json({ user: publicUser(req.user) }));

router.post('/api-key', authenticateToken, async (req, res, next) => {
  try {
    const newApiKey = createOpaqueToken('smm_');
    await dbAsync.run('UPDATE users SET api_key = ? WHERE id = ?', [newApiKey, req.user.id]);
    res.json({ api_key: newApiKey });
  } catch (err) { next(err); }
});

router.post('/change-password', authenticateToken, validate(z.object({
  current_password: z.string().min(1).max(128),
  new_password: passwordSchema
})), async (req, res, next) => {
  try {
    const row = await dbAsync.get('SELECT password FROM users WHERE id = ?', [req.user.id]);
    if (!await bcrypt.compare(req.body.current_password, row.password)) return res.status(400).json({ error: 'Mevcut şifre hatalı.' });
    const hashed = await bcrypt.hash(req.body.new_password, 12);
    await dbAsync.run('UPDATE users SET password = ?, must_change_password = 0, token_version = token_version + 1 WHERE id = ?', [hashed, req.user.id]);
    res.clearCookie('smm_session', { path: '/' });
    res.json({ message: 'Şifreniz güncellendi.' });
  } catch (err) { next(err); }
});

router.post('/forgot-password', validate(z.object({ email: z.email().max(254).transform(v => v.toLowerCase()) })), async (req, res, next) => {
  try {
    const user = await dbAsync.get('SELECT id, email FROM users WHERE email = ? COLLATE NOCASE', [req.body.email]);
    let previewToken;
    if (user) {
      const token = createOpaqueToken();
      previewToken = process.env.NODE_ENV !== 'production' ? token : undefined;
      await dbAsync.run("UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL", [user.id]);
      await dbAsync.run("INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, datetime('now', '+30 minutes'))", [user.id, tokenHash(token)]);
      const url = `${(process.env.PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')}/#reset-password?token=${encodeURIComponent(token)}`;
      await sendMail({ to: user.email, subject: 'Şifre sıfırlama', text: `Şifrenizi 30 dakika içinde sıfırlayın: ${url}`, html: `<p>Şifrenizi 30 dakika içinde sıfırlamak için <a href="${url}">bu bağlantıyı kullanın</a>.</p>` });
    }
    res.json({ message: 'Hesap varsa şifre sıfırlama bağlantısı gönderildi.', ...(previewToken ? { preview_token: previewToken } : {}) });
  } catch (err) { next(err); }
});

router.post('/reset-password', validate(z.object({ token: z.string().min(32).max(200), new_password: passwordSchema })), async (req, res, next) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.new_password, 12);
    await withTransaction(async tx => {
      const tokenRow = await tx.get("SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP", [tokenHash(req.body.token)]);
      if (!tokenRow) { const err = new Error('Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş.'); err.status = 400; throw err; }
      await tx.run('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?', [tokenRow.id]);
      await tx.run('UPDATE users SET password = ?, must_change_password = 0, token_version = token_version + 1 WHERE id = ?', [hashedPassword, tokenRow.user_id]);
    });
    res.json({ message: 'Şifreniz yenilendi. Tüm eski oturumlar kapatıldı.' });
  } catch (err) { next(err); }
});

router.post('/verify-email/request', authenticateToken, async (req, res, next) => {
  try {
    if (req.user.email_verified) return res.json({ message: 'E-posta adresiniz zaten doğrulanmış.' });
    const token = createOpaqueToken();
    await dbAsync.run("INSERT INTO verification_tokens (user_id, purpose, token_hash, expires_at) VALUES (?, 'email', ?, datetime('now', '+24 hours'))", [req.user.id, tokenHash(token)]);
    const url = `${(process.env.PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')}/#verify-email?token=${encodeURIComponent(token)}`;
    await sendMail({ to: req.user.email, subject: 'E-posta doğrulama', text: `E-postanızı doğrulayın: ${url}`, html: `<p>E-postanızı doğrulamak için <a href="${url}">bu bağlantıyı kullanın</a>.</p>` });
    res.json({ message: 'Doğrulama bağlantısı gönderildi.', ...(process.env.NODE_ENV !== 'production' ? { preview_token: token } : {}) });
  } catch (err) { next(err); }
});

router.post('/verify-email/confirm', validate(z.object({ token: z.string().min(32).max(200) })), async (req, res, next) => {
  try {
    await withTransaction(async tx => {
      const row = await tx.get("SELECT * FROM verification_tokens WHERE purpose = 'email' AND token_hash = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP", [tokenHash(req.body.token)]);
      if (!row) { const err = new Error('Doğrulama bağlantısı geçersiz veya süresi dolmuş.'); err.status = 400; throw err; }
      await tx.run('UPDATE verification_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?', [row.id]);
      await tx.run('UPDATE users SET email_verified = 1 WHERE id = ?', [row.user_id]);
    });
    res.json({ message: 'E-posta adresiniz doğrulandı.' });
  } catch (err) { next(err); }
});

router.post('/2fa/setup', authenticateToken, async (req, res, next) => {
  try {
    const secret = generateSecret();
    const keyUri = generateURI({ label: req.user.email, issuer: 'SMM Panel', secret });
    await dbAsync.run('UPDATE users SET two_factor_secret = ?, two_factor_enabled = 0 WHERE id = ?', [encryptSecret(secret), req.user.id]);
    res.json({ qr_data_url: await QRCode.toDataURL(keyUri), manual_key: secret });
  } catch (err) { next(err); }
});

router.post('/2fa/confirm', authenticateToken, validate(z.object({ token: z.string().regex(/^\d{6}$/) })), async (req, res, next) => {
  try {
    const user = await dbAsync.get('SELECT two_factor_secret FROM users WHERE id = ?', [req.user.id]);
    if (!user.two_factor_secret || !(await verify({ token: req.body.token, secret: decryptSecret(user.two_factor_secret) })).valid) return res.status(400).json({ error: 'Doğrulama kodu geçersiz.' });
    await dbAsync.run('UPDATE users SET two_factor_enabled = 1, token_version = token_version + 1 WHERE id = ?', [req.user.id]);
    res.clearCookie('smm_session', { path: '/' });
    res.json({ message: 'İki adımlı doğrulama etkinleştirildi. Yeniden giriş yapın.' });
  } catch (err) { next(err); }
});

module.exports = router;
