const jwt = require('jsonwebtoken');
const { dbAsync } = require('../config/database');

const developmentFallback = 'development-only-change-this-secret-2026';
const JWT_SECRET = process.env.JWT_SECRET || developmentFallback;

if (process.env.NODE_ENV === 'production' && JWT_SECRET === developmentFallback) {
  throw new Error('Production ortamında JWT_SECRET zorunludur.');
}

function getRequestToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return req.cookies?.smm_session || null;
}

function signSession(user, extra = {}) {
  return jwt.sign({ id: user.id, role: user.role, ver: user.token_version || 0, ...extra }, JWT_SECRET, {
    expiresIn: '12h',
    issuer: 'smmpanel',
    audience: 'smmpanel-web'
  });
}

function setSessionCookie(res, token) {
  res.cookie('smm_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 12 * 60 * 60 * 1000,
    path: '/'
  });
}

async function authenticateToken(req, res, next) {
  const token = getRequestToken(req);
  if (!token) return res.status(401).json({ error: 'Lütfen giriş yapın.' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { issuer: 'smmpanel', audience: 'smmpanel-web' });
    const user = await dbAsync.get(
      `SELECT id, username, email, role, balance, balance_kurus, api_key,
              referral_balance_kurus, email_verified, must_change_password
              , two_factor_enabled, token_version
       FROM users WHERE id = ?`,
      [decoded.id]
    );
    if (!user || user.role !== decoded.role || user.token_version !== decoded.ver) return res.status(403).json({ error: 'Geçersiz kullanıcı oturumu.' });
    req.user = user;
    req.auth = decoded;
    next();
  } catch {
    res.clearCookie('smm_session', { path: '/' });
    return res.status(401).json({ error: 'Oturum süresi dolmuş veya geçersiz.' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Bu işlem için yetkiniz bulunmuyor.' });
  if (req.user.must_change_password && req.path !== '/change-password') {
    return res.status(428).json({ error: 'Devam etmeden önce varsayılan yönetici şifresini değiştirin.', code: 'PASSWORD_CHANGE_REQUIRED' });
  }
  next();
}

module.exports = { authenticateToken, requireAdmin, JWT_SECRET, signSession, setSessionCookie };
