'use strict';

// Google ile giris / kayit.
//
// Tarayicidaki "Google ile devam et" dugmesi (Google Identity Services) bir
// kimlik belirteci (ID token: RS256 imzali JWT) uretir ve /api/auth/google'a
// gonderir. Burada belirtecin imzasi Google'in acik anahtarlariyla dogrulanir.
// Ek paket kurulmaz: imza kontrolu jsonwebtoken + Node crypto ile yapilir,
// Google'in anahtar listesi (JWKS) bellekte onbellenir (Cache-Control'e gore).
//
// Istemci kimligi (Client ID) once admin panelden (site_settings.google_client_id),
// o bossa ortam degiskeninden (GOOGLE_CLIENT_ID) okunur. Ikisi de bossa ozellik
// kapalidir: sayfaya meta etiketi basilmaz, dugme hic gorunmez, uc 503 doner.

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
// Client ID bicimi: "123456-abc.apps.googleusercontent.com". Meta etigine ve
// SQL'e girdigi icin yalnizca guvenli karakterler kabul edilir.
const CLIENT_ID_RE = /^[A-Za-z0-9._-]{8,200}$/;

let keyCache = { keys: new Map(), fetchedAt: 0, expiresAt: 0 };

function normalizeClientId(value) {
  const v = String(value || '').trim();
  return CLIENT_ID_RE.test(v) ? v : '';
}

async function getClientId() {
  try {
    const { dbAsync } = require('../config/database');
    const row = await dbAsync.get("SELECT value FROM site_settings WHERE key = 'google_client_id'");
    const fromDb = normalizeClientId(row?.value);
    if (fromDb) return fromDb;
  } catch { /* veritabani hazir degilse ortam degiskenine dusulur */ }
  return normalizeClientId(process.env.GOOGLE_CLIENT_ID);
}

async function fetchKeys() {
  const res = await fetch(CERTS_URL, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Google anahtar listesi alinamadi (${res.status})`);
  const body = await res.json();
  const keys = new Map();
  for (const jwk of body.keys || []) {
    if (jwk.kty !== 'RSA' || !jwk.kid) continue;
    keys.set(jwk.kid, crypto.createPublicKey({ key: jwk, format: 'jwk' }).export({ type: 'spki', format: 'pem' }));
  }
  const cacheControl = (res.headers && typeof res.headers.get === 'function' ? res.headers.get('cache-control') : '') || '';
  const maxAge = Number((/max-age=(\d+)/.exec(cacheControl) || [])[1]) || 3600;
  keyCache = { keys, fetchedAt: Date.now(), expiresAt: Date.now() + Math.min(maxAge, 24 * 3600) * 1000 };
  return keys;
}

async function publicKeyFor(kid) {
  const fresh = Date.now() < keyCache.expiresAt;
  if (fresh && keyCache.keys.has(kid)) return keyCache.keys.get(kid);
  // Bilinmeyen kid: Google anahtarlarini dondurmus olabilir. Ama sahte kid'li
  // isteklerle her seferinde indirme yaptirilmasin: son indirmeden en az
  // 60 saniye gecmis olmali (onbellek suresi dolduysa her halukarda indirilir).
  if (!fresh || Date.now() - keyCache.fetchedAt > 60_000) await fetchKeys();
  return keyCache.keys.get(kid) || null;
}

function fail(message, messageEn) {
  const err = new Error(message);
  err.messageEn = messageEn;
  err.status = 401;
  err.code = 'GOOGLE_TOKEN_INVALID';
  return err;
}

/**
 * Google ID token'ini dogrular; gecerliyse profil ozetini dondurur.
 * @param {string} credential  Tarayicidan gelen belirtec
 * @param {string} clientId    Beklenen audience (bizim Client ID'miz)
 * @returns {Promise<{sub:string, email:string, emailVerified:boolean, name:string, picture:string}>}
 */
async function verifyIdToken(credential, clientId) {
  const token = String(credential || '');
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || decoded.header?.alg !== 'RS256' || !decoded.header.kid) {
    throw fail('Google doğrulaması başarısız: belirteç tanınmadı.', 'Google verification failed: unrecognized token.');
  }
  let pem = null;
  try {
    pem = await publicKeyFor(decoded.header.kid);
  } catch (err) {
    throw fail(`Google ile bağlantı kurulamadı (${err.message}). Biraz sonra tekrar deneyin.`, `Could not reach Google (${err.message}). Please try again shortly.`);
  }
  if (!pem) throw fail('Google doğrulaması başarısız: imza anahtarı bulunamadı.', 'Google verification failed: signing key not found.');
  let payload;
  try {
    payload = jwt.verify(token, pem, { algorithms: ['RS256'], audience: clientId, issuer: ISSUERS });
  } catch (err) {
    throw fail(`Google doğrulaması başarısız (${err.message}). Sayfayı yenileyip tekrar deneyin.`, `Google verification failed (${err.message}). Refresh the page and try again.`);
  }
  if (!payload.sub || !payload.email) {
    throw fail('Google hesabından e-posta adresi alınamadı.', 'Could not read the email address of your Google account.');
  }
  return {
    sub: String(payload.sub),
    email: String(payload.email).trim().toLowerCase(),
    emailVerified: payload.email_verified === true || payload.email_verified === 'true',
    name: String(payload.name || '').slice(0, 80),
    picture: String(payload.picture || '').slice(0, 500)
  };
}

function _resetKeyCache() {
  keyCache = { keys: new Map(), fetchedAt: 0, expiresAt: 0 };
}

module.exports = { getClientId, verifyIdToken, normalizeClientId, _resetKeyCache };
