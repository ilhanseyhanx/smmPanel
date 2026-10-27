'use strict';

// Bayinin kendi alan adi (F2b). Akis:
//   1) Bayi panelde alan adini yazar -> Cloudflare'de custom hostname acilir,
//      tenant_domains'e 'pending' satiri yazilir.
//   2) Bayi kendi DNS'inde CNAME (-> CLOUDFLARE_CNAME_TARGET) ekler.
//   3) Isleyici 10 dakikada bir (veya bayi "Kontrol et" dediginde) durumu sorar;
//      alan adi ve SSL aktif olunca satir 'active' olur ve site o adreste acilir.
// Cozumleme www'siz yapilir (tenant/resolve.js normalizeHost): www.alan.com ve
// alan.com ayni bayiye gider; Cloudflare'e bayinin yazdigi ad kaydedilir.
const cron = require('node-cron');
const { dbAsync } = require('../config/database');
const cloudflare = require('./cloudflare');
const { normalizeHost, baseDomain, isMainHost, invalidateTenantCache } = require('../tenant/resolve');
const { logTenantActivity } = require('./resellers');

const MAX_DOMAINS = 2;
const DOMAIN_PATTERN = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
// Jet'in ve taban alan adinin kendi adresleri bayiye baglanamaz.
const BLOCKED = ['jetsmmpanel.com', 'smmjet.com'];

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Bayinin yazdigi metinden { hostname, domain } cikarir veya hata verir.
function parseDomain(input) {
  const raw = String(input || '').trim().toLowerCase()
    .replace(/^https?:\/\//, '').split(/[/?#]/)[0].replace(/:\d+$/, '').replace(/\.$/, '');
  if (!DOMAIN_PATTERN.test(raw)) throw httpError('Geçerli bir alan adı yaz (örnek: www.kankasmm.com).');
  const domain = normalizeHost(raw);
  const base = baseDomain();
  if (base && (domain === base || domain.endsWith(`.${base}`))) {
    throw httpError('Bu adres zaten sitenin alt adresi; ayrıca eklemene gerek yok.');
  }
  if (isMainHost(domain) || BLOCKED.some(b => domain === b || domain.endsWith(`.${b}`))) {
    throw httpError('Bu alan adı kullanılamaz.');
  }
  return { hostname: raw, domain };
}

function publicDomain(row) {
  return {
    id: row.id,
    domain: row.domain,
    hostname: row.cf_hostname || row.domain,
    status: row.status,
    cf_status: row.cf_status || null,
    ssl_status: row.cf_ssl_status || null,
    txt_name: row.verify_txt_name || null,
    txt_value: row.verify_txt_value || null,
    error: row.cf_error || null,
    managed: Boolean(row.cf_hostname_id),
    created_at: row.created_at,
    activated_at: row.activated_at || null,
    checked_at: row.checked_at || null
  };
}

async function addDomain(tenant, input, { actorId = null } = {}) {
  if (!cloudflare.isConfigured()) throw httpError('Özel alan adı bağlama şu anda kullanılamıyor.', 503);
  const { hostname, domain } = parseDomain(input);
  const count = await dbAsync.get('SELECT COUNT(*) AS n FROM tenant_domains WHERE tenant_id = ?', [tenant.id]);
  if (count.n >= MAX_DOMAINS) throw httpError(`En fazla ${MAX_DOMAINS} alan adı bağlayabilirsin. Önce birini kaldır.`, 409);
  if (await dbAsync.get('SELECT id FROM tenant_domains WHERE domain = ?', [domain])) {
    throw httpError('Bu alan adı zaten bir siteye bağlı.', 409);
  }
  const cf = await cloudflare.createHostname(hostname);
  const created = await dbAsync.run(
    `INSERT INTO tenant_domains (tenant_id, domain, status, cf_hostname, cf_hostname_id, cf_status, cf_ssl_status, cf_error,
                                 verify_txt_name, verify_txt_value, checked_at)
     VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [tenant.id, domain, hostname, cf.id, cf.status, cf.ssl_status, cf.error, cf.txt_name, cf.txt_value]
  );
  await logTenantActivity(dbAsync, { tenantId: tenant.id, actorType: 'owner', actorId, action: 'domain_added', details: { domain: hostname } });
  return publicDomain(await dbAsync.get('SELECT * FROM tenant_domains WHERE id = ?', [created.id]));
}

// Cloudflare'den durumu okur; alan adi ve SSL aktifse site o adreste acilir.
async function refreshDomain(row) {
  if (!row.cf_hostname_id) return publicDomain(row);
  let cf;
  try {
    cf = await cloudflare.getHostname(row.cf_hostname_id);
  } catch (err) {
    const message = err.status === 404 ? 'Cloudflare kaydı bulunamadı; alan adını kaldırıp yeniden ekle.' : err.message;
    await dbAsync.run('UPDATE tenant_domains SET cf_error = ?, checked_at = CURRENT_TIMESTAMP WHERE id = ?', [String(message).slice(0, 300), row.id]);
    return publicDomain(await dbAsync.get('SELECT * FROM tenant_domains WHERE id = ?', [row.id]));
  }
  const becameActive = cf.active && row.status !== 'active';
  await dbAsync.run(
    `UPDATE tenant_domains SET cf_status = ?, cf_ssl_status = ?, cf_error = ?, verify_txt_name = COALESCE(?, verify_txt_name),
            verify_txt_value = COALESCE(?, verify_txt_value), checked_at = CURRENT_TIMESTAMP,
            status = CASE WHEN ? = 1 THEN 'active' ELSE status END,
            activated_at = CASE WHEN ? = 1 THEN COALESCE(activated_at, CURRENT_TIMESTAMP) ELSE activated_at END
      WHERE id = ?`,
    [cf.status, cf.ssl_status, cf.error, cf.txt_name, cf.txt_value, cf.active ? 1 : 0, cf.active ? 1 : 0, row.id]
  );
  if (becameActive) {
    invalidateTenantCache();
    const tenant = await dbAsync.get('SELECT id, owner_user_id, name FROM tenants WHERE id = ?', [row.tenant_id]);
    if (tenant) {
      await logTenantActivity(dbAsync, { tenantId: tenant.id, actorType: 'system', action: 'domain_activated', details: { domain: row.cf_hostname || row.domain } });
      await dbAsync.run('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
        [tenant.owner_user_id, 'reseller', 'Alan adın bağlandı', `"${tenant.name}" artık https://${row.cf_hostname || row.domain} adresinde açılıyor.`]);
    }
  }
  return publicDomain(await dbAsync.get('SELECT * FROM tenant_domains WHERE id = ?', [row.id]));
}

async function removeDomain(row, { actorType = 'owner', actorId = null } = {}) {
  if (row.cf_hostname_id) await cloudflare.deleteHostname(row.cf_hostname_id);
  await dbAsync.run('DELETE FROM tenant_domains WHERE id = ?', [row.id]);
  invalidateTenantCache();
  await logTenantActivity(dbAsync, { tenantId: row.tenant_id, actorType, actorId, action: 'domain_removed', details: { domain: row.cf_hostname || row.domain } });
}

// Bayi silinirken Cloudflare kayitlari da temizlenir (hata silmeyi durdurmaz).
async function releaseTenantDomains(tenantId) {
  const rows = await dbAsync.all('SELECT cf_hostname_id FROM tenant_domains WHERE tenant_id = ? AND cf_hostname_id IS NOT NULL', [tenantId]);
  for (const row of rows) {
    await cloudflare.deleteHostname(row.cf_hostname_id).catch(err => console.error('Cloudflare alan adi silinemedi:', err.message));
  }
}

async function checkPendingDomains() {
  if (!cloudflare.isConfigured()) return 0;
  const rows = await dbAsync.all("SELECT * FROM tenant_domains WHERE status = 'pending' AND cf_hostname_id IS NOT NULL ORDER BY id LIMIT 50");
  for (const row of rows) await refreshDomain(row);
  return rows.length;
}

function startDomainWorker() {
  cron.schedule('*/10 * * * *', () => checkPendingDomains().catch(err => console.error('Tenant domain worker:', err.message)), { noOverlap: true });
}

module.exports = {
  MAX_DOMAINS, parseDomain, publicDomain, addDomain, refreshDomain, removeDomain, releaseTenantDomains,
  checkPendingDomains, startDomainWorker
};
