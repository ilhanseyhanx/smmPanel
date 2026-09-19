'use strict';

// Bayi musterisi oturumu. Ana sitenin oturumundan tamamen ayridir:
//  - ayri cerez adi (tsess), cerez yalnizca bayinin alan adina yazilir,
//  - token audience'i "tenant:<id>": bir bayinin tokeni baska bayide ya da
//    ana sitede (audience 'smmpanel-web') gecmez, tersi de gecmez.
const jwt = require('jsonwebtoken');
const { dbAsync } = require('../config/database');
const { JWT_SECRET } = require('../middleware/auth');

const COOKIE = 'tsess';
const ISSUER = 'smmpanel-tenant';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function audienceFor(tenantId) {
  return `tenant:${tenantId}`;
}

function signCustomerSession(tenant, customer) {
  return jwt.sign(
    { cid: customer.id, tid: tenant.id, ver: customer.token_version || 0 },
    JWT_SECRET,
    { expiresIn: '7d', issuer: ISSUER, audience: audienceFor(tenant.id) }
  );
}

function setCustomerCookie(res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS,
    path: '/'
  });
}

function clearCustomerCookie(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

function requestToken(req) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return req.cookies?.[COOKIE] || null;
}

async function loadCustomer(req) {
  const token = requestToken(req);
  if (!token) return null;
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET, { issuer: ISSUER, audience: audienceFor(req.tenant.id) });
  } catch {
    return null;
  }
  const customer = await dbAsync.get(
    `SELECT id, tenant_id, username, email, balance_kurus, banned, token_version, api_key, created_at
       FROM tenant_customers WHERE id = ? AND tenant_id = ?`,
    [decoded.cid, req.tenant.id]
  );
  if (!customer || customer.token_version !== decoded.ver) return null;
  return customer;
}

async function requireCustomer(req, res, next) {
  try {
    const customer = await loadCustomer(req);
    if (!customer) {
      clearCustomerCookie(res);
      return res.status(401).json({ error: 'Lütfen giriş yapın.', error_en: 'Please sign in.' });
    }
    if (customer.banned) {
      return res.status(403).json({ error: 'Hesabınız askıya alınmıştır.', error_en: 'Your account has been suspended.' });
    }
    req.customer = customer;
    next();
  } catch (err) { next(err); }
}

module.exports = {
  COOKIE,
  signCustomerSession,
  setCustomerCookie,
  clearCustomerCookie,
  loadCustomer,
  requireCustomer
};
