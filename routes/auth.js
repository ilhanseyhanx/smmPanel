const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { generateSecret, generateURI, verify } = require('otplib');
const QRCode = require('qrcode');
const { dbAsync, withTransaction } = require('../config/database');
const { authenticateToken, signSession, setSessionCookie } = require('../middleware/auth');
const { validate, bilingual } = require('../middleware/validate');
const { createOpaqueToken, tokenHash, encryptSecret, decryptSecret, normalizePlainText } = require('../utils/security');
const { fromKurus } = require('../utils/money');
const { sendMail } = require('../services/mailer');
const { transactionalEmail, verificationCodeEmail } = require('../services/emailTemplates');
const telegram = require('../services/telegramNotifier');
const securityMonitor = require('../services/securityMonitor');

async function getSiteName() {
  try {
    const row = await dbAsync.get("SELECT value FROM site_settings WHERE key = 'site_name'");
    return row?.value || 'SMMJET';
  } catch { return 'SMMJET'; }
}

const router = express.Router();

// Kullanici bulunamadiginda da bcrypt.compare calistirilir; boylece yanit suresi
// farkindan gecerli kullanici adi cikarilamaz (kullanici enumerasyonu).
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('invalid-placeholder-password', 12);

// Kullaniciya gosterilecek mesajlar tek tek yazilir: kayit ekraninda "gecersiz"
// demek yerine tam olarak neyin yanlis oldugu soylenmelidir.
const usernameSchema = z.string().trim()
  .min(3, bilingual('Kullanıcı adı en az 3 karakter olmalıdır.', 'Username must be at least 3 characters.'))
  .max(32, bilingual('Kullanıcı adı en fazla 32 karakter olabilir.', 'Username can be at most 32 characters.'))
  .regex(/^[a-zA-Z0-9_.-]+$/, bilingual(
    'Kullanıcı adı yalnızca İngilizce harf, rakam, nokta, tire ve alt çizgi içerebilir. (Türkçe karakter ve boşluk kullanılamaz.)',
    'Username may only contain English letters, numbers, dot, hyphen and underscore. (No spaces or accented characters.)'
  ));
const passwordSchema = z.string()
  .min(10, bilingual('Şifre en az 10 karakter olmalıdır.', 'Password must be at least 10 characters.'))
  .max(128, bilingual('Şifre en fazla 128 karakter olabilir.', 'Password can be at most 128 characters.'));
const emailSchema = z.string().trim()
  .min(1, bilingual('E-posta adresi zorunludur.', 'Email address is required.'))
  .max(254, bilingual('E-posta adresi en fazla 254 karakter olabilir.', 'Email address can be at most 254 characters.'))
  .pipe(z.email(bilingual(
    'Geçerli bir e-posta adresi girin. (örnek: ad@site.com)',
    'Enter a valid email address. (example: name@site.com)'
  )))
  .transform(v => v.toLowerCase());

const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
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
      // Hangisinin dolu oldugu ayrica sorulur: "biri kullaniliyor" demek
      // kullaniciyi hangisini degistirecegini bilemez halde birakiyordu.
      const existing = await tx.get(
        `SELECT
           MAX(CASE WHEN username = ? COLLATE NOCASE THEN 1 ELSE 0 END) username_taken,
           MAX(CASE WHEN email = ? COLLATE NOCASE THEN 1 ELSE 0 END) email_taken
         FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE`,
        [username, email, username, email]
      );
      if (existing && (existing.username_taken || existing.email_taken)) {
        const both = existing.username_taken && existing.email_taken;
        const err = new Error(
          both
            ? 'Bu kullanıcı adı ve e-posta adresi zaten kayıtlı. Farklı bir kullanıcı adı seçin veya mevcut hesabınıza giriş yapın.'
            : existing.username_taken
              ? 'Bu kullanıcı adı başkası tarafından alınmış. Lütfen farklı bir kullanıcı adı seçin.'
              : 'Bu e-posta adresiyle zaten bir hesap var. Giriş yapabilir veya "Şifremi unuttum" ile şifrenizi sıfırlayabilirsiniz.'
        );
        err.messageEn = both
          ? 'This username and email address are already registered. Choose a different username or sign in to your existing account.'
          : existing.username_taken
            ? 'This username is already taken. Please choose a different one.'
            : 'An account with this email already exists. You can sign in, or use "Forgot password" to reset it.';
        err.status = 409;
        err.field = existing.username_taken ? 'username' : 'email';
        throw err;
      }
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
    // Bildirim beklenmez: Telegram yavaslarsa veya hata verirse kayit yaniti
    // gecikmemelidir. notifyNewUser kendi hatalarini yutup loglar.
    telegram.notifyNewUser(user, { referral });
    res.status(201).json({ message: 'Hesabınız oluşturuldu.', user: publicUser(user) });
  } catch (err) { next(err); }
});

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const user = await dbAsync.get('SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE', [req.body.username, req.body.username.toLowerCase()]);
    const passwordMatches = await bcrypt.compare(req.body.password, user?.password || DUMMY_PASSWORD_HASH);
    // Hangisinin yanlis oldugu bilerek soylenmez: aksi halde gecerli kullanici
    // adlari denenerek tespit edilebilirdi (kullanici enumerasyonu).
    if (!user || !passwordMatches) {
      securityMonitor.logEvent('failed_login', req, { username: req.body.username, detail: 'Hatalı kullanıcı adı veya şifre' });
      return res.status(401).json({
        error: 'Kullanıcı adı veya şifre hatalı. Büyük/küçük harfe ve klavye diline dikkat edin.',
        error_en: 'Incorrect username or password. Check your caps lock and keyboard layout.'
      });
    }
    if (user.banned) {
      securityMonitor.logEvent('banned_login', req, { username: user.username, detail: 'Banlı hesap giriş denemesi' });
      return res.status(403).json({
        error: 'Hesabınız askıya alınmıştır. Destek ekibiyle iletişime geçin.',
        error_en: 'Your account has been suspended. Please contact support.'
      });
    }
    if (user.two_factor_enabled) {
      if (!req.body.totp) {
        return res.status(401).json({
          error: 'İki adımlı doğrulama kodu gerekli. Uygulamanızdaki 6 haneli kodu girin.',
          error_en: 'Two-factor code required. Enter the 6-digit code from your app.',
          code: 'TWO_FACTOR_REQUIRED'
        });
      }
      if (!(await verify({ token: req.body.totp, secret: decryptSecret(user.two_factor_secret) })).valid) {
        securityMonitor.logEvent('failed_login', req, { username: user.username, detail: 'Geçersiz 2FA kodu' });
        return res.status(401).json({
          error: 'İki adımlı doğrulama kodu geçersiz veya süresi dolmuş. Uygulamadaki güncel kodu girin.',
          error_en: 'Two-factor code is invalid or expired. Enter the current code from your app.'
        });
      }
    }
    setSessionCookie(res, signSession(user));
    res.json({ message: 'Giriş başarılı.', user: publicUser(user) });
  } catch (err) { next(err); }
});

router.post('/logout', (req, res) => {
  res.clearCookie('smm_session', { path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
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
      const url = `${(process.env.PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
      const siteName = await getSiteName();
      await sendMail({
        to: user.email,
        subject: `🔐 ${siteName} şifre sıfırlama bağlantın`,
        text: `Şifrenizi 30 dakika içinde sıfırlayın: ${url}`,
        html: transactionalEmail({
          siteName,
          title: 'Şifreni mi unuttun? Sorun değil. 🔐',
          intro: 'Hesabın için şifre sıfırlama talebi aldık. Aşağıdaki butona tıklayarak yeni şifreni hemen belirleyebilirsin. Bu bağlantı güvenliğin için <b>30 dakika</b> geçerlidir.',
          buttonText: 'Yeni Şifremi Belirle',
          buttonUrl: url,
          note: 'Bu talebi sen yapmadıysan bu maili görmezden gelebilirsin; şifren değişmeden kalır.'
        })
      });
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
    const url = `${(process.env.PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(token)}`;
    const siteName = await getSiteName();
    await sendMail({
      to: req.user.email,
      subject: `✅ ${siteName} — e-posta adresini doğrula`,
      text: `E-postanızı doğrulayın: ${url}`,
      html: transactionalEmail({
        siteName,
        title: `Tek adım kaldı, ${req.user.username}! ✅`,
        intro: 'Hesabının sana ait olduğunu doğrulamak için aşağıdaki butona tıklaman yeterli. Doğrulanmış hesaplar bildirimleri ve önemli bilgilendirmeleri eksiksiz alır. Bu bağlantı <b>24 saat</b> geçerlidir.',
        buttonText: 'E-postamı Doğrula',
        buttonUrl: url,
        note: 'Bu talebi sen yapmadıysan bu maili görmezden gelebilirsin.'
      })
    });
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

// --- KODLU E-POSTA DOĞRULAMA -------------------------------------------------
// Site icindeki animasyonlu dogrulama ekrani icin 6 haneli kod akisi.
// (Baglantili /verify-email/request akisi da calismaya devam eder; bu akis
// kullaniciyi sayfadan ayirmadan dogrulama yaptirir — ör. kupon kullanimi.)

// Kaba kuvvet siniri: kullanici basina 10 dakikada en fazla 5 yanlis deneme.
const dogrulamaDenemeleri = new Map();
function denemeKontrol(userId) {
  const simdi = Date.now();
  const kayit = dogrulamaDenemeleri.get(userId);
  if (!kayit || simdi > kayit.resetAt) {
    dogrulamaDenemeleri.set(userId, { count: 0, resetAt: simdi + 10 * 60 * 1000 });
    return true;
  }
  return kayit.count < 5;
}

router.post('/verify-email/request-code', authenticateToken, async (req, res, next) => {
  try {
    if (req.user.email_verified) return res.json({ message: 'E-posta adresiniz zaten doğrulanmış.', already_verified: true });
    // Tekrar gonderim siniri: son 60 saniyede kod uretildiyse beklenir.
    const son = await dbAsync.get(
      "SELECT 1 FROM verification_tokens WHERE user_id = ? AND purpose = 'email_code' AND created_at > datetime('now', '-60 seconds')",
      [req.user.id]
    );
    if (son) return res.status(429).json({ error: 'Yeni kod istemek için biraz bekle (60 saniye).' });

    const code = String(require('crypto').randomInt(100000, 1000000));
    await dbAsync.run("DELETE FROM verification_tokens WHERE user_id = ? AND purpose = 'email_code'", [req.user.id]);
    await dbAsync.run(
      "INSERT INTO verification_tokens (user_id, purpose, token_hash, expires_at) VALUES (?, 'email_code', ?, datetime('now', '+15 minutes'))",
      [req.user.id, tokenHash(code)]
    );
    const siteName = await getSiteName();
    await sendMail({
      to: req.user.email,
      subject: `🔐 ${siteName} doğrulama kodun: ${code}`,
      text: `E-posta doğrulama kodun: ${code} (15 dakika geçerli)`,
      html: verificationCodeEmail({ siteName, username: req.user.username, code })
    });
    res.json({ message: 'Doğrulama kodu e-posta adresine gönderildi.' });
  } catch (err) { next(err); }
});

router.post('/verify-email/confirm-code', authenticateToken, validate(z.object({ code: z.string().regex(/^\d{6}$/) })), async (req, res, next) => {
  try {
    if (req.user.email_verified) return res.json({ message: 'E-posta adresiniz zaten doğrulanmış.' });
    if (!denemeKontrol(req.user.id)) {
      return res.status(429).json({ error: 'Çok fazla yanlış deneme. 10 dakika sonra tekrar dene.' });
    }
    const row = await dbAsync.get(
      "SELECT * FROM verification_tokens WHERE user_id = ? AND purpose = 'email_code' AND token_hash = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP",
      [req.user.id, tokenHash(req.body.code)]
    );
    if (!row) {
      const kayit = dogrulamaDenemeleri.get(req.user.id);
      if (kayit) kayit.count++;
      return res.status(400).json({ error: 'Kod hatalı veya süresi dolmuş. Kontrol edip tekrar dene.' });
    }
    await dbAsync.run('UPDATE verification_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?', [row.id]);
    await dbAsync.run('UPDATE users SET email_verified = 1 WHERE id = ?', [req.user.id]);
    dogrulamaDenemeleri.delete(req.user.id);
    res.json({ message: 'E-posta adresin doğrulandı! 🎉' });
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
