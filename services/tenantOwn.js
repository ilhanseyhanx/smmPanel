'use strict';

// Pro bayinin kendi SMM saglayicilari (28 Eki 2026). Bayi baska bir panelin
// standart SMM API'sini (v2) baglar, servislerini secip kendi fiyatiyla satar.
//  - Musteri bayinin sitesindeki bakiyesiyle oder; saglayici ucreti bayinin
//    o saglayicidaki hesabindan gider. Jet'in bakiyesi ve orders tablosu
//    kullanilmaz, Jet komisyon almaz.
//  - Kendi servis ve siparis numaralari Jet'inkilerle karismasin diye
//    OWN_ID_BASE'den baslar (vitrin ve musteri API'si ayni numarayi gorur).
//  - Durum takibi startOwnOrderWorker ile; iptal/kismi teslimde musteriye
//    odedigi fiyattan oranli iade.
//  - Yalnizca Pro pakette gorunur; Standart'a inen bayinin kayitlari silinmez,
//    gizlenir.
const cron = require('node-cron');
const { dbAsync, withTransaction } = require('../config/database');
const SmmProviderClient = require('./smmProvider');
const { encryptSecret, decryptSecret } = require('../utils/security');
const { fromKurus } = require('../utils/money');
const { isProTenant, changeCustomerBalance, logTenantActivity } = require('./resellers');

const OWN_ID_BASE = 50_000_000;
const MAX_IMPORT = 500;

const isOwnId = id => Number(id) >= OWN_ID_BASE;
const toPublic = id => OWN_ID_BASE + Number(id);
const toLocal = id => Number(id) - OWN_ID_BASE;

function httpError(status, message, messageEn) {
  return Object.assign(new Error(message), { status, expose: true, ...(messageEn ? { messageEn } : {}) });
}

function requirePro(tenant) {
  if (!isProTenant(tenant)) throw httpError(403, 'Kendi sağlayıcıların Pro pakete özel.');
}

// Saglayici anahtari kimse tarafindan geri okunmaz; Jet saglik olcumune
// karismasin diye istemci kimliksiz (meta = null) kurulur.
function clientFor(provider) {
  return new SmmProviderClient(provider.api_url, decryptSecret(provider.api_key_encrypted), null);
}

function publicProvider(p) {
  return { id: p.id, name: p.name, api_url: p.api_url, currency: p.currency || null, balance: p.balance ?? null, status: p.status, checked_at: p.checked_at, created_at: p.created_at };
}

async function getProvider(tenantId, providerId) {
  const provider = await dbAsync.get('SELECT * FROM tenant_providers WHERE id = ? AND tenant_id = ?', [providerId, tenantId]);
  if (!provider) throw httpError(404, 'Sağlayıcı bulunamadı.');
  return provider;
}

async function listProviders(tenantId) {
  const rows = await dbAsync.all(
    `SELECT p.*, (SELECT COUNT(*) FROM tenant_own_services s WHERE s.provider_id = p.id) AS service_count
       FROM tenant_providers p WHERE p.tenant_id = ? ORDER BY p.id`, [tenantId]);
  return rows.map(p => ({ ...publicProvider(p), service_count: p.service_count }));
}

async function addProvider(tenant, { name, api_url: apiUrl, api_key: apiKey }) {
  requirePro(tenant);
  let url;
  try { url = new URL(apiUrl); } catch { throw httpError(400, 'API adresi geçerli değil.'); }
  if (url.protocol !== 'https:') throw httpError(400, 'API adresi https:// ile başlamalı.');
  const count = (await dbAsync.get('SELECT COUNT(*) AS n FROM tenant_providers WHERE tenant_id = ?', [tenant.id])).n;
  if (count >= 10) throw httpError(400, 'En fazla 10 sağlayıcı ekleyebilirsin.');
  const probe = await new SmmProviderClient(url.toString(), apiKey, null).getBalance();
  if (!probe || probe.error || probe.balance === undefined) {
    throw httpError(400, `Sağlayıcı bağlantıyı kabul etmedi${probe?.error ? `: ${String(probe.error).slice(0, 120)}` : '. API adresini ve anahtarı kontrol et.'}`);
  }
  const created = await dbAsync.run(
    `INSERT INTO tenant_providers (tenant_id, name, api_url, api_key_encrypted, currency, balance, checked_at)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [tenant.id, name, url.toString(), encryptSecret(apiKey), String(probe.currency || 'USD').toUpperCase().slice(0, 8), String(probe.balance).slice(0, 32)]
  );
  return publicProvider(await dbAsync.get('SELECT * FROM tenant_providers WHERE id = ?', [created.id]));
}

async function refreshProvider(tenant, providerId) {
  requirePro(tenant);
  const provider = await getProvider(tenant.id, providerId);
  const probe = await clientFor(provider).getBalance();
  if (probe && probe.balance !== undefined && !probe.error) {
    await dbAsync.run('UPDATE tenant_providers SET balance = ?, currency = ?, checked_at = CURRENT_TIMESTAMP WHERE id = ?',
      [String(probe.balance).slice(0, 32), String(probe.currency || provider.currency || 'USD').toUpperCase().slice(0, 8), provider.id]);
  }
  return publicProvider(await getProvider(tenant.id, providerId));
}

async function removeProvider(tenant, providerId) {
  const provider = await getProvider(tenant.id, providerId);
  const open = (await dbAsync.get("SELECT COUNT(*) AS n FROM tenant_own_orders WHERE provider_id = ? AND status IN ('pending', 'processing')", [provider.id])).n;
  if (open > 0) throw httpError(409, `Bu sağlayıcıda ${open} açık sipariş var; bitince kaldırabilirsin. Şimdilik kapatabilirsin.`);
  await dbAsync.run('DELETE FROM tenant_own_services WHERE provider_id = ?', [provider.id]);
  await dbAsync.run('DELETE FROM tenant_providers WHERE id = ?', [provider.id]);
}

async function setProviderStatus(tenant, providerId, enabled) {
  const provider = await getProvider(tenant.id, providerId);
  await dbAsync.run('UPDATE tenant_providers SET status = ? WHERE id = ?', [enabled ? 1 : 0, provider.id]);
}

// Saglayicinin servis listesi (ice aktarma ekrani icin).
async function providerServices(tenant, providerId) {
  requirePro(tenant);
  const provider = await getProvider(tenant.id, providerId);
  const data = await clientFor(provider).getServices();
  if (!Array.isArray(data)) throw httpError(502, `Sağlayıcı servis listesi vermedi${data?.error ? `: ${String(data.error).slice(0, 120)}` : '.'}`);
  const imported = new Set((await dbAsync.all('SELECT provider_service_id FROM tenant_own_services WHERE provider_id = ?', [provider.id])).map(r => r.provider_service_id));
  return {
    provider: publicProvider(provider),
    services: data.slice(0, 5000).map(s => ({
      service: String(s.service),
      name: String(s.name || '').slice(0, 200),
      category: String(s.category || 'Diğer').slice(0, 100),
      type: String(s.type || 'Default'),
      rate: Number(s.rate) || 0,
      min: Number.parseInt(s.min, 10) || 1,
      max: Number.parseInt(s.max, 10) || 1000000,
      imported: imported.has(String(s.service))
    })).filter(s => s.service && s.name && s.type.toLowerCase() === 'default')
  };
}

// Secilen servisleri satis fiyatiyla ekler: fiyat = saglayici fiyati x kur x (1 + kar).
// Saglayici TL degilse USD kabul edilir (kur sitedeki guncel USD/TRY).
async function importServices(tenant, providerId, { service_ids: ids, markup_percent: markup }) {
  requirePro(tenant);
  const list = await providerServices(tenant, providerId);
  const wanted = new Set(ids.map(String).slice(0, MAX_IMPORT));
  const currency = String(list.provider.currency || 'USD').toUpperCase();
  const fx = currency === 'TRY' || currency === 'TL' ? 1 : Number((await require('./fx').getUsdTry())?.rate) || 0;
  if (!(fx > 0)) throw httpError(503, 'Döviz kuru şu an alınamadı; biraz sonra tekrar dene.');
  let added = 0;
  for (const s of list.services) {
    if (!wanted.has(s.service)) continue;
    const rateKurus = Math.max(1, Math.round(s.rate * fx * (100 + markup)));
    await dbAsync.run(
      `INSERT INTO tenant_own_services (tenant_id, provider_id, provider_service_id, name, category, provider_rate, rate_kurus, min_quantity, max_quantity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(provider_id, provider_service_id) DO UPDATE SET name = excluded.name, category = excluded.category,
         provider_rate = excluded.provider_rate, rate_kurus = excluded.rate_kurus, min_quantity = excluded.min_quantity, max_quantity = excluded.max_quantity`,
      [tenant.id, list.provider.id, s.service, s.name, s.category, `${s.rate} ${currency}`, rateKurus, s.min, s.max]
    );
    added += 1;
  }
  return { added, fx, currency };
}

function publicOwnService(row) {
  return {
    id: toPublic(row.id), local_id: row.id, provider_id: row.provider_id, provider_name: row.provider_name || null,
    provider_service_id: row.provider_service_id, name: row.name, category: row.category, description: row.description || '',
    provider_rate: row.provider_rate, rate: fromKurus(row.rate_kurus), min: row.min_quantity, max: row.max_quantity,
    enabled: Boolean(row.enabled)
  };
}

async function listOwnServices(tenantId) {
  const rows = await dbAsync.all(
    `SELECT s.*, p.name AS provider_name FROM tenant_own_services s JOIN tenant_providers p ON p.id = s.provider_id
      WHERE s.tenant_id = ? ORDER BY s.category, s.id`, [tenantId]);
  return rows.map(publicOwnService);
}

async function updateOwnService(tenant, localId, changes) {
  const row = await dbAsync.get('SELECT * FROM tenant_own_services WHERE id = ? AND tenant_id = ?', [localId, tenant.id]);
  if (!row) throw httpError(404, 'Servis bulunamadı.');
  const next = {
    name: changes.name ?? row.name,
    category: changes.category ?? row.category,
    description: changes.description !== undefined ? changes.description : row.description,
    rate_kurus: changes.rate !== undefined ? Math.round(changes.rate * 100) : row.rate_kurus,
    enabled: changes.enabled !== undefined ? (changes.enabled ? 1 : 0) : row.enabled
  };
  if (!(next.rate_kurus > 0)) throw httpError(400, 'Fiyat sıfırdan büyük olmalı.');
  await dbAsync.run('UPDATE tenant_own_services SET name = ?, category = ?, description = ?, rate_kurus = ?, enabled = ? WHERE id = ?',
    [next.name, next.category, next.description, next.rate_kurus, next.enabled, row.id]);
}

async function deleteOwnService(tenant, localId) {
  const changed = await dbAsync.run('DELETE FROM tenant_own_services WHERE id = ? AND tenant_id = ?', [localId, tenant.id]);
  if (changed.changes !== 1) throw httpError(404, 'Servis bulunamadı.');
}

/** Vitrin ve musteri API'si icin satistaki kendi servisleri (Pro degilse bos). */
async function ownCatalog(tenant) {
  if (!isProTenant(tenant)) return [];
  const rows = await dbAsync.all(
    `SELECT s.* FROM tenant_own_services s JOIN tenant_providers p ON p.id = s.provider_id AND p.status = 1
      WHERE s.tenant_id = ? AND s.enabled = 1 ORDER BY s.category, s.id`, [tenant.id]);
  return rows.map(publicOwnService);
}

// --------------------------------------------------------------- siparis

/**
 * Musteri bakiyesinden duser, siparisi kaydeder ve saglayiciya iletir.
 * Saglayici reddederse tutar iade edilir ve hata firlatilir.
 */
async function placeOwnOrder(tenant, customer, { serviceId, link, quantity }) {
  if (!isProTenant(tenant)) throw httpError(400, 'Bu servis şu anda satışta değil.', 'This service is currently unavailable.');
  const service = await dbAsync.get(
    `SELECT s.*, p.status AS provider_status FROM tenant_own_services s JOIN tenant_providers p ON p.id = s.provider_id
      WHERE s.id = ? AND s.tenant_id = ?`, [toLocal(serviceId), tenant.id]);
  if (!service || !service.enabled || Number(service.provider_status) !== 1) {
    throw httpError(400, 'Bu servis şu anda satışta değil.', 'This service is currently unavailable.');
  }
  const qty = Number(quantity);
  if (!Number.isSafeInteger(qty) || qty < service.min_quantity || qty > service.max_quantity) {
    throw httpError(400, `Miktar ${service.min_quantity} ile ${service.max_quantity} arasında olmalı.`, `Quantity must be between ${service.min_quantity} and ${service.max_quantity}.`);
  }
  const cleanLink = String(link || '').trim();
  if (cleanLink.length < 3 || cleanLink.length > 2048) throw httpError(400, 'Bağlantı geçersiz.', 'Invalid link.');
  const charge = Math.max(1, Math.round(service.rate_kurus * qty / 1000));

  const orderId = await withTransaction(async tx => {
    const debit = await changeCustomerBalance(tx, {
      tenantId: tenant.id, customerId: customer.id, amountKurus: -charge, type: 'order', note: `${service.name} × ${qty}`, actor: 'customer'
    });
    if (!debit) throw Object.assign(httpError(402, `Yetersiz bakiye. Gerekli tutar ₺${fromKurus(charge).toFixed(2)}.`, `Not enough balance. Required amount: ${fromKurus(charge).toFixed(2)} TRY.`), { code: 'insufficient_balance' });
    const row = await tx.run(
      `INSERT INTO tenant_own_orders (tenant_id, customer_id, service_id, provider_id, service_name, link, quantity, charge_kurus)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenant.id, customer.id, service.id, service.provider_id, service.name, cleanLink, qty, charge]);
    await tx.run('UPDATE tenant_balance_logs SET order_id = ?, note = ? WHERE id = ?', [toPublic(row.id), `#${toPublic(row.id)} ${service.name} × ${qty}`, debit.logId]);
    return row.id;
  });

  const provider = await dbAsync.get('SELECT * FROM tenant_providers WHERE id = ?', [service.provider_id]);
  let response;
  try {
    response = await clientFor(provider).addOrder(service.provider_service_id, cleanLink, qty);
  } catch (err) {
    response = { error: err.message };
  }
  if (!response || response.error || !response.order) {
    const reason = String(response?.error || 'Sağlayıcı siparişi kabul etmedi.').slice(0, 300);
    await refundOwnOrder(orderId, charge, 'failed', reason);
    throw httpError(502, 'Sipariş tamamlanamadı, tutar bakiyene iade edildi. Lütfen biraz sonra tekrar dene.', 'The order could not be completed and the amount was refunded to your balance.');
  }
  await dbAsync.run("UPDATE tenant_own_orders SET provider_order_id = ?, status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [String(response.order), orderId]);
  await logTenantActivity(dbAsync, {
    tenantId: tenant.id, actorType: 'customer', actorId: customer.id, action: 'own_order',
    details: { order_id: toPublic(orderId), service: service.name, quantity: qty, charge: fromKurus(charge) }
  }).catch(() => {});
  return { orderId: toPublic(orderId), serviceName: service.name, quantity: qty, tenantChargeKurus: charge, status: 'processing' };
}

// Iadeyi musteriye yazar ve siparisin iade toplamini yukseltir (tek islem).
async function refundOwnOrder(orderId, amountKurus, status, reason = null) {
  await withTransaction(async tx => {
    const order = await tx.get('SELECT * FROM tenant_own_orders WHERE id = ?', [orderId]);
    if (!order) return;
    const amount = Math.min(Math.max(0, Math.round(amountKurus)), order.charge_kurus - order.refunded_kurus);
    if (amount > 0) {
      await changeCustomerBalance(tx, {
        tenantId: order.tenant_id, customerId: order.customer_id, amountKurus: amount, type: 'refund',
        orderId: toPublic(order.id), note: `#${toPublic(order.id)} iadesi`, actor: 'system'
      });
    }
    await tx.run(
      'UPDATE tenant_own_orders SET refunded_kurus = refunded_kurus + ?, status = ?, error = COALESCE(?, error), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [amount, status, reason, order.id]);
  });
}

function publicOwnOrder(o) {
  return {
    id: toPublic(o.id), service_name: o.service_name, link: o.link, quantity: o.quantity, status: o.status === 'failed' ? 'canceled' : o.status,
    start_count: o.start_count, remains: o.remains, charge: fromKurus(o.charge_kurus), refunded: fromKurus(o.refunded_kurus),
    refill: false, own: true, created_at: o.created_at
  };
}

async function customerOwnOrders(tenantId, customerId, { limit = 50, ids = null } = {}) {
  if (ids) {
    const local = ids.filter(isOwnId).map(toLocal);
    if (!local.length) return [];
    return dbAsync.all(`SELECT * FROM tenant_own_orders WHERE tenant_id = ? AND customer_id = ? AND id IN (${local.map(() => '?').join(',')})`,
      [tenantId, customerId, ...local]);
  }
  return dbAsync.all("SELECT * FROM tenant_own_orders WHERE tenant_id = ? AND customer_id = ? AND status != 'failed' ORDER BY id DESC LIMIT ?",
    [tenantId, customerId, limit]);
}

async function panelOwnOrders(tenantId, page = 1) {
  const limit = 50;
  const [total, rows] = await Promise.all([
    dbAsync.get('SELECT COUNT(*) AS n FROM tenant_own_orders WHERE tenant_id = ?', [tenantId]),
    dbAsync.all(
      `SELECT o.*, c.username AS customer, p.name AS provider_name FROM tenant_own_orders o
         LEFT JOIN tenant_customers c ON c.id = o.customer_id LEFT JOIN tenant_providers p ON p.id = o.provider_id
        WHERE o.tenant_id = ? ORDER BY o.id DESC LIMIT ? OFFSET ?`, [tenantId, limit, (page - 1) * limit])
  ]);
  return {
    page, pages: Math.max(1, Math.ceil(total.n / limit)), total: total.n,
    orders: rows.map(o => ({ ...publicOwnOrder(o), status: o.status, customer: o.customer, provider_name: o.provider_name, provider_order_id: o.provider_order_id, error: o.error }))
  };
}

// --------------------------------------------------------------- durum takibi

function mapStatus(value) {
  const status = String(value || '').toLowerCase();
  if (status.includes('completed')) return 'completed';
  if (status.includes('partial')) return 'partial';
  if (status.includes('cancel') || status.includes('refund') || status.includes('fail')) return 'canceled';
  if (status.includes('progress') || status.includes('processing')) return 'processing';
  if (status.includes('pending')) return 'processing';
  return null;
}

async function applyOwnStatus(order, info) {
  const status = mapStatus(info?.status);
  if (!status) return;
  const remains = Number.parseInt(info.remains, 10);
  const startCount = Number.parseInt(info.start_count, 10);
  await dbAsync.run('UPDATE tenant_own_orders SET start_count = ?, remains = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [Number.isFinite(startCount) ? startCount : order.start_count, Number.isFinite(remains) ? Math.max(0, remains) : order.remains, order.id]);
  if (status === 'canceled') return refundOwnOrder(order.id, order.charge_kurus, 'canceled');
  if (status === 'partial') {
    const left = Number.isFinite(remains) ? Math.min(order.quantity, Math.max(0, remains)) : 0;
    return refundOwnOrder(order.id, Math.round(order.charge_kurus * left / order.quantity), 'partial');
  }
  if (status !== order.status) {
    await dbAsync.run('UPDATE tenant_own_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, order.id]);
  }
}

let syncing = false;
async function syncOwnOrders() {
  if (syncing) return;
  syncing = true;
  try {
    const open = await dbAsync.all("SELECT * FROM tenant_own_orders WHERE status IN ('pending', 'processing') AND provider_order_id IS NOT NULL");
    const byProvider = new Map();
    for (const order of open) {
      if (!byProvider.has(order.provider_id)) byProvider.set(order.provider_id, []);
      byProvider.get(order.provider_id).push(order);
    }
    for (const [providerId, orders] of byProvider) {
      const provider = await dbAsync.get('SELECT * FROM tenant_providers WHERE id = ?', [providerId]);
      if (!provider) continue;
      const client = clientFor(provider);
      for (let i = 0; i < orders.length; i += 100) {
        const batch = orders.slice(i, i + 100);
        const data = await client.getMultiOrderStatus(batch.map(o => o.provider_order_id));
        if (!data || typeof data !== 'object') continue;
        for (const order of batch) {
          await applyOwnStatus(order, data[order.provider_order_id]).catch(err => console.error('Bayi sağlayıcı durumu:', err.message));
        }
      }
    }
  } finally {
    syncing = false;
  }
}

function startOwnOrderWorker() {
  cron.schedule('*/3 * * * *', () => syncOwnOrders().catch(err => console.error('Bayi sağlayıcı işleyicisi:', err.message)), { noOverlap: true });
}

module.exports = {
  OWN_ID_BASE, isOwnId, toPublic, toLocal,
  listProviders, addProvider, refreshProvider, removeProvider, setProviderStatus, providerServices, importServices,
  listOwnServices, updateOwnService, deleteOwnService, ownCatalog,
  placeOwnOrder, customerOwnOrders, publicOwnOrder, panelOwnOrders, syncOwnOrders, applyOwnStatus, startOwnOrderWorker
};
