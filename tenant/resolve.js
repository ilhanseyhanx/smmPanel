'use strict';

// Gelen istegin alan adindan bayiyi (tenant) bulur.
//  - Ana site adresleri (PUBLIC_BASE_URL, ALLOWED_ORIGINS, localhost) hic
//    veritabanina sorulmadan ana siteye birakilir.
//  - Bayinin kendi alan adi (tenant_domains, yalnizca 'active') veya
//    TENANT_BASE_DOMAIN altindaki alt alan adi (slug.taban.com) eslesir.
//  - Eslesmeyen bilinmeyen adresler de ana siteye birakilir (bugunku davranis).
// Sonuclar (bulunamayanlar dahil) kisa sure onbellekte tutulur; admin bayi
// ya da alan adi degistirdiginde invalidateTenantCache() cagrilir.
const { dbAsync } = require('../config/database');

const CACHE_TTL_MS = 30_000;
const MAX_CACHE = 5000;
const cache = new Map();
let mainHostsCache = null;

function normalizeHost(value) {
  let host = String(value || '').trim().toLowerCase();
  if (!host) return '';
  // IPv6 [::1]:3000 bicimi
  if (host.startsWith('[')) host = host.slice(1, host.indexOf(']') > 0 ? host.indexOf(']') : undefined);
  else host = host.replace(/:\d+$/, '');
  host = host.replace(/\.$/, '');
  if (host.startsWith('www.')) host = host.slice(4);
  if (host.length > 253 || !/^[a-z0-9.:-]+$/.test(host)) return '';
  return host;
}

function hostOf(url) {
  try { return normalizeHost(new URL(url).host); } catch { return ''; }
}

function mainHosts() {
  if (mainHostsCache) return mainHostsCache;
  const hosts = new Set(['localhost', '127.0.0.1', '::1']);
  const base = hostOf(process.env.PUBLIC_BASE_URL || '');
  if (base) hosts.add(base);
  for (const origin of String(process.env.ALLOWED_ORIGINS || '').split(',')) {
    const host = hostOf(origin.trim());
    if (host) hosts.add(host);
  }
  mainHostsCache = hosts;
  return hosts;
}

function baseDomain() {
  return normalizeHost(process.env.TENANT_BASE_DOMAIN || '');
}

function isMainHost(host) {
  return mainHosts().has(host);
}

const TENANT_COLUMNS = `t.id, t.owner_user_id, t.slug, t.name, t.theme, t.status, t.status_reason,
  t.discount_percent, t.default_markup_percent, t.settings_json`;

async function lookup(host) {
  const base = baseDomain();
  if (base && host.endsWith(`.${base}`)) {
    const slug = host.slice(0, -(base.length + 1));
    if (!slug || slug.includes('.')) return null;
    return (await dbAsync.get(`SELECT ${TENANT_COLUMNS} FROM tenants t WHERE t.slug = ?`, [slug])) || null;
  }
  return (await dbAsync.get(
    `SELECT ${TENANT_COLUMNS} FROM tenant_domains d JOIN tenants t ON t.id = d.tenant_id
      WHERE d.domain = ? AND d.status = 'active'`,
    [host]
  )) || null;
}

async function tenantForHost(rawHost) {
  const host = normalizeHost(rawHost);
  if (!host || isMainHost(host)) return null;
  const hit = cache.get(host);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.tenant;
  const tenant = await lookup(host);
  if (cache.size >= MAX_CACHE) cache.clear();
  cache.set(host, { at: Date.now(), tenant });
  return tenant;
}

function invalidateTenantCache() {
  cache.clear();
}

// Testler ortam degiskenlerini degistirdiginde ana adres listesi yeniden okunur.
function resetHostConfig() {
  mainHostsCache = null;
  cache.clear();
}

function tenantSettings(tenant) {
  try {
    const parsed = JSON.parse(tenant?.settings_json || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

module.exports = {
  normalizeHost,
  baseDomain,
  isMainHost,
  tenantForHost,
  invalidateTenantCache,
  resetHostConfig,
  tenantSettings
};
