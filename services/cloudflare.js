'use strict';

// Bayinin kendi alan adi: Cloudflare for SaaS (Custom Hostnames).
// Bayi www.alanadi.com icin CNAME -> CLOUDFLARE_CNAME_TARGET ekler; Cloudflare
// alan adini dogrular ve SSL'i kendisi verir. Istekler "fallback origin"
// uzerinden sunucumuza gelir (nginx varsayilan blok). Anahtar .env'de:
//   CLOUDFLARE_API_TOKEN   zone icin "SSL and Certificates: Edit" + "DNS: Edit"
//   CLOUDFLARE_ZONE_ID     taban alan adinin zone kimligi
//   CLOUDFLARE_CNAME_TARGET bayinin CNAME hedefi (or. bayi-origin.seyilstudios.com)
const axios = require('axios');

function config() {
  return {
    token: String(process.env.CLOUDFLARE_API_TOKEN || '').trim(),
    zoneId: String(process.env.CLOUDFLARE_ZONE_ID || '').trim(),
    cnameTarget: String(process.env.CLOUDFLARE_CNAME_TARGET || '').trim().toLowerCase()
  };
}

function isConfigured() {
  const c = config();
  return Boolean(c.token && c.zoneId && c.cnameTarget);
}

async function request(method, path, data) {
  const c = config();
  if (!c.token || !c.zoneId) {
    const err = new Error('Özel alan adı bağlama henüz yapılandırılmamış.');
    err.status = 503;
    throw err;
  }
  const res = await axios({
    method,
    url: `https://api.cloudflare.com/client/v4/zones/${c.zoneId}${path}`,
    data,
    timeout: 20000,
    headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
    validateStatus: () => true
  });
  if (!res.data?.success) {
    const codes = (res.data?.errors || []).map(e => e.code);
    const raw = (res.data?.errors || []).map(e => e.message).join('; ');
    let message = raw || `Cloudflare isteği başarısız (HTTP ${res.status}).`;
    // 1406: ayni ad baska bir Cloudflare hesabinda/zone'da kayitli.
    if (codes.includes(1406) || /already exists/i.test(raw)) message = 'Bu alan adı Cloudflare\'de zaten başka bir yere bağlı.';
    const err = new Error(message);
    err.status = res.status === 404 ? 404 : 400;
    throw err;
  }
  return res.data.result;
}

// Cloudflare kaydinin panelde gosterilecek ozeti.
function summarize(h) {
  const ssl = h.ssl || {};
  const own = h.ownership_verification || {};
  const errors = [
    ...(h.verification_errors || []),
    ...((ssl.validation_errors || []).map(e => e.message))
  ].filter(Boolean);
  return {
    id: h.id,
    hostname: h.hostname,
    status: h.status || null,
    ssl_status: ssl.status || null,
    txt_name: own.type === 'txt' ? own.name : null,
    txt_value: own.type === 'txt' ? own.value : null,
    error: errors.slice(0, 2).join(' · ').slice(0, 300) || null,
    active: h.status === 'active' && ssl.status === 'active'
  };
}

async function createHostname(hostname) {
  return summarize(await request('post', '/custom_hostnames', {
    hostname,
    ssl: { method: 'http', type: 'dv', settings: { min_tls_version: '1.2' } }
  }));
}

async function getHostname(id) {
  return summarize(await request('get', `/custom_hostnames/${encodeURIComponent(id)}`));
}

// Cloudflare'de zaten yoksa da basarili sayilir.
async function deleteHostname(id) {
  try {
    await request('delete', `/custom_hostnames/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err.status !== 404) throw err;
  }
  return true;
}

module.exports = { config, isConfigured, createHostname, getHostname, deleteHostname, summarize };
