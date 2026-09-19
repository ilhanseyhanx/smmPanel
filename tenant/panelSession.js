'use strict';

// Bayi yonetim paneli (bayi.com/admin) oturumu. Bayi sahibi Jet hesabiyla
// (ayni kullanici adi/sifre + 2FA) girer; oturum yine de ayridir:
//  - cerez "tadmin", yalnizca bayinin alan adina yazilir,
//  - audience "tenant-admin:<id>": baska bayinin paneli, bayi musteri
//    oturumu (tenant:<id>) ya da Jet oturumu (smmpanel-web) burada gecmez,
//  - her istekte kullanicinin HALA bu bayinin sahibi oldugu, banli olmadigi
//    ve token_version'in degismedigi (sifre degisince cikis) kontrol edilir.
const jwt = require('jsonwebtoken');
const { dbAsync } = require('../config/database');
const { JWT_SECRET } = require('../middleware/auth');

const COOKIE = 'tadmin';
const ISSUER = 'smmpanel-tenant-admin';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function audienceFor(tenantId) {
  return `tenant-admin:${tenantId}`;
}

function signOwnerSession(tenant, user) {
  return jwt.sign(
    { uid: user.id, tid: tenant.id, ver: user.token_version || 0 },
    JWT_SECRET,
    { expiresIn: '12h', issuer: ISSUER, audience: audienceFor(tenant.id) }
  );
}

function setOwnerCookie(res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS,
    path: '/'
  });
}

function clearOwnerCookie(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

async function requireOwner(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE];
    let decoded = null;
    if (token) {
      try {
        decoded = jwt.verify(token, JWT_SECRET, { issuer: ISSUER, audience: audienceFor(req.tenant.id) });
      } catch { decoded = null; }
    }
    const user = decoded && Number(decoded.uid) === Number(req.tenant.owner_user_id)
      ? await dbAsync.get(
        'SELECT id, username, email, balance_kurus, banned, token_version, two_factor_enabled FROM users WHERE id = ?',
        [decoded.uid]
      )
      : null;
    if (!user || user.token_version !== decoded.ver) {
      clearOwnerCookie(res);
      return res.status(401).json({ error: 'Lütfen yönetim paneline giriş yapın.', error_en: 'Please sign in to the admin panel.' });
    }
    if (user.banned) {
      clearOwnerCookie(res);
      return res.status(403).json({ error: 'Hesabınız askıya alınmıştır.', error_en: 'Your account has been suspended.' });
    }
    req.owner = user;
    next();
  } catch (err) { next(err); }
}

module.exports = { signOwnerSession, setOwnerCookie, clearOwnerCookie, requireOwner };
