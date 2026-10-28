'use strict';

// Bayi musterisinin API'si: bayi.com/api/v2 (standart SMM API v2; Jet'in
// routes/apiV2.js ile ayni sozlesme: HTTP 200 + hata govdedeki `error`).
// Anahtar tenant_customers.api_key; yalnizca bu bayinin musterisi, yalnizca
// kendi siparisleri. Fiyatlar bayinin satis fiyatidir. Bayi panelden API'yi
// kapatabilir (settings.api_enabled = false).
const express = require('express');
const { dbAsync } = require('../config/database');
const { fromKurus } = require('../utils/money');
const { tenantCatalog, logTenantActivity } = require('../services/resellers');
const { requestRefill, refillStatusLabel } = require('../services/refills');
const { requestCancel } = require('../services/cancelOrders');
const { normalizeOrderInputType, normalizePricingModel } = require('../services/orderTypes');
const { tenantSettings } = require('./resolve');
const { placeTenantOrder } = require('./orders');

const router = express.Router();

const MAX_BATCH = 100;
const ORDER_STATUS = {
  completed: 'Completed', canceled: 'Canceled', partial: 'Partial', failed: 'Canceled', pending: 'Pending', processing: 'Processing'
};

const isBlank = value => value === undefined || value === null || value === '';

function idList(value) {
  const parts = Array.isArray(value) ? value : String(value ?? '').split(',');
  const ids = [];
  for (const part of parts) {
    const id = Number(String(part).trim());
    if (Number.isSafeInteger(id) && id > 0 && !ids.includes(id)) ids.push(id);
    if (ids.length >= MAX_BATCH) break;
  }
  return ids;
}

function singleId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function apiError(err, fallback) {
  if (err.messageEn) return err.messageEn;
  return Number.isInteger(err.status) && err.status < 500 ? err.message : fallback;
}

function orderStatusBody(order) {
  return {
    status: ORDER_STATUS[order.status] || 'Processing',
    start_count: order.start_count,
    remains: order.remains,
    charge: fromKurus(order.tenant_charge_kurus).toFixed(2),
    currency: 'TRY'
  };
}

async function customerOrders(ctx, ids) {
  if (!ids.length) return [];
  return dbAsync.all(
    `SELECT * FROM orders WHERE tenant_id = ? AND tenant_customer_id = ? AND id IN (${ids.map(() => '?').join(',')})`,
    [ctx.tenant.id, ctx.customer.id, ...ids]
  );
}

async function services(ctx) {
  const catalog = await tenantCatalog(ctx.tenant);
  return catalog.map(row => {
    const inputType = normalizeOrderInputType(row.order_input_type);
    const pricingModel = normalizePricingModel(row.pricing_model);
    return {
      service: row.id,
      name: row.custom_name || row.name_tr || row.name,
      type: inputType === 'custom_comments' ? 'Custom Comments' : 'Default',
      category: row.category_name || 'Diğer',
      // Paneller ucreti rate / 1000 x adet diye hesaplar; adet basi urunde
      // rate 1000 ile carpilir (bkz. routes/apiV2.js).
      rate: fromKurus(pricingModel === 'per_item' ? row.price.rateKurus * 1000 : row.price.rateKurus).toFixed(2),
      min: row.min_quantity,
      max: row.max_quantity,
      refill: Number(row.refill) === 1,
      cancel: Number(row.provider_cancel) === 1,
      dripfeed: inputType === 'link' && Number(row.provider_dripfeed) === 1,
      description: row.description_tr || row.description || ''
    };
  });
}

async function balance(ctx) {
  return { balance: fromKurus(ctx.customer.balance_kurus).toFixed(2), currency: 'TRY' };
}

async function add(ctx, body, req) {
  if (ctx.tenant.status !== 'active') return { error: 'This site is currently unavailable' };
  const serviceId = singleId(body.service);
  if (!serviceId) return { error: 'Incorrect service ID' };
  const link = typeof body.link === 'number' ? String(body.link) : body.link;
  const qty = isBlank(body.quantity) ? undefined : Number(body.quantity);
  if ((qty !== undefined && !Number.isSafeInteger(qty)) || typeof link !== 'string' || !link.trim() || link.length > 2048) {
    return { error: 'Invalid parameters' };
  }
  if (!isBlank(body.comments) && typeof body.comments !== 'string') return { error: 'Invalid parameters' };
  let runs = 1;
  let interval = null;
  if (!isBlank(body.runs)) {
    runs = Number(body.runs);
    if (!Number.isSafeInteger(runs) || runs < 1 || runs > 100) return { error: 'Invalid runs (1-100)' };
    if (runs > 1) {
      interval = Number(body.interval);
      if (!Number.isSafeInteger(interval) || interval < 5 || interval > 10080) return { error: 'Invalid interval (5-10080 minutes)' };
    }
  }
  try {
    const result = await placeTenantOrder(ctx.tenant, ctx.customer, {
      serviceId, link, quantity: qty, comments: body.comments || '', dripRuns: runs, dripIntervalMinutes: interval,
      termsAccepted: true, lang: 'en'
    });
    return { order: result.orderId };
  } catch (err) {
    if (!err.messageEn && !(Number.isInteger(err.status) && err.status < 500)) req.log?.error({ err }, 'tenant_api_add_failed');
    return { error: apiError(err, 'The order could not be placed. Please try again.') };
  }
}

async function status(ctx, body) {
  if (!isBlank(body.order)) {
    const id = singleId(body.order);
    const [order] = id ? await customerOrders(ctx, [id]) : [];
    return order ? orderStatusBody(order) : { error: 'Order not found' };
  }
  if (!isBlank(body.orders)) {
    const ids = idList(body.orders);
    if (!ids.length) return { error: 'Invalid orders' };
    const byId = new Map((await customerOrders(ctx, ids)).map(row => [row.id, row]));
    return Object.fromEntries(ids.map(id => [id, byId.has(id) ? orderStatusBody(byId.get(id)) : { error: 'Incorrect order ID' }]));
  }
  return { error: 'Invalid parameters' };
}

// Telafi saglayiciya bayinin (siparisin Jet sahibi) adina gider; once
// siparisin bu musteriye ait oldugu dogrulanir.
async function refillOne(ctx, orderId, req) {
  const id = singleId(orderId);
  const [order] = id ? await customerOrders(ctx, [id]) : [];
  if (!order) return { error: 'Incorrect order ID' };
  try {
    const result = await requestRefill({ user: { id: ctx.tenant.owner_user_id }, orderId: id });
    await logTenantActivity(dbAsync, {
      tenantId: ctx.tenant.id, actorType: 'customer', actorId: ctx.customer.id,
      action: 'refill_requested', details: { order_id: id, refill_id: result.refillId, via: 'api' }
    }).catch(() => {});
    return result.refillId;
  } catch (err) {
    if (!err.messageEn) req.log?.error({ err }, 'tenant_api_refill_failed');
    return { error: apiError(err, 'The refill request could not be processed.') };
  }
}

async function refill(ctx, body, req) {
  if (ctx.tenant.status !== 'active') return { error: 'This site is currently unavailable' };
  if (!isBlank(body.order)) {
    const result = await refillOne(ctx, body.order, req);
    return typeof result === 'object' ? result : { refill: result };
  }
  if (!isBlank(body.orders)) {
    const ids = idList(body.orders);
    if (!ids.length) return { error: 'Invalid orders' };
    const results = [];
    for (const id of ids) results.push({ order: id, refill: await refillOne(ctx, id, req) });
    return results;
  }
  return { error: 'Invalid parameters' };
}

async function refillRows(ctx, ids) {
  return dbAsync.all(
    `SELECT r.id, r.status FROM order_refills r JOIN orders o ON o.id = r.order_id
      WHERE o.tenant_id = ? AND o.tenant_customer_id = ? AND r.id IN (${ids.map(() => '?').join(',')})`,
    [ctx.tenant.id, ctx.customer.id, ...ids]
  );
}

async function refillStatus(ctx, body) {
  if (!isBlank(body.refill)) {
    const id = singleId(body.refill);
    const [row] = id ? await refillRows(ctx, [id]) : [];
    return row ? { status: refillStatusLabel(row.status) } : { error: 'Refill not found' };
  }
  if (!isBlank(body.refills)) {
    const ids = idList(body.refills);
    if (!ids.length) return { error: 'Invalid refills' };
    const byId = new Map((await refillRows(ctx, ids)).map(row => [row.id, row]));
    return ids.map(id => ({ refill: id, status: byId.has(id) ? refillStatusLabel(byId.get(id).status) : { error: 'Refill not found' } }));
  }
  return { error: 'Invalid parameters' };
}

async function cancel(ctx, body) {
  if (ctx.tenant.status !== 'active') return { error: 'This site is currently unavailable' };
  const ids = idList(isBlank(body.orders) ? body.order : body.orders);
  if (!ids.length) return { error: 'Invalid orders' };
  const own = new Set((await customerOrders(ctx, ids)).map(row => row.id));
  const allowed = ids.filter(id => own.has(id));
  const results = allowed.length ? await requestCancel({ user: { id: ctx.tenant.owner_user_id }, orderIds: allowed }) : [];
  const byOrder = new Map(results.map(item => [item.order, item]));
  return ids.map(id => byOrder.get(id) || { order: id, cancel: { error: 'Incorrect order ID' } });
}

const ACTIONS = new Map([
  ['services', services],
  ['balance', balance],
  ['add', add],
  ['status', status],
  ['refill', refill],
  ['refill_status', refillStatus],
  ['cancel', cancel]
]);

router.post('/', async (req, res, next) => {
  try {
    if (tenantSettings(req.tenant).api_enabled === false) return res.json({ error: 'API is disabled' });
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const key = body.key;
    if (typeof key !== 'string' || !key || key.length > 200) return res.json({ error: 'Invalid API Key' });
    const customer = await dbAsync.get('SELECT * FROM tenant_customers WHERE api_key = ? AND tenant_id = ?', [key, req.tenant.id]);
    if (!customer || customer.banned) return res.json({ error: 'Invalid API Key' });
    const handler = typeof body.action === 'string' ? ACTIONS.get(body.action) : null;
    if (!handler) return res.json({ error: 'Invalid action' });
    res.json(await handler({ tenant: req.tenant, customer }, body, req));
  } catch (err) { next(err); }
});

module.exports = router;
