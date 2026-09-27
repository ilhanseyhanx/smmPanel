'use strict';

// ----------------------------------------------------
// BAYI API'SI (standart SMM API v2)
// Panelle ayni akislari kullanir: siparis placeOrder, telafi refills, iptal
// cancelOrders. SMM API gelenegi: HTTP 200 + hata govdedeki `error` alaninda
// (Ingilizce). Bayi sistemi de ileride ayni komutlari kendi musterilerine
// verecegi icin sunucu dosyasindan buraya tasindi.
// ----------------------------------------------------
const express = require('express');
const { dbAsync } = require('../config/database');
const { fromKurus, toKurus } = require('../utils/money');
const { placeOrder } = require('../services/placeOrder');
const { normalizeOrderInputType, normalizePricingModel } = require('../services/orderTypes');
const { requestRefill, refillStatusLabel } = require('../services/refills');
const { requestCancel } = require('../services/cancelOrders');

const router = express.Router();

const MAX_BATCH = 100;
const ORDER_STATUS = {
  completed: 'Completed',
  canceled: 'Canceled',
  partial: 'Partial',
  failed: 'Canceled',
  pending: 'Pending',
  processing: 'Processing'
};

function isBlank(value) {
  return value === undefined || value === null || value === '';
}

// "1,2,3" (standart) veya dizi. Gecersizler ve tekrarlar atilir, en fazla 100.
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

// Beklenmeyen ic hata metni (SQLITE_BUSY vb.) istemciye sizdirilmaz.
function apiError(err, fallback) {
  if (err.messageEn) return err.messageEn;
  return Number.isInteger(err.status) && err.status < 500 ? err.message : fallback;
}

function orderStatusBody(order) {
  return {
    status: ORDER_STATUS[order.status] || 'Processing',
    start_count: order.start_count,
    remains: order.remains,
    charge: fromKurus(order.charge_kurus).toFixed(2),
    currency: 'TRY'
  };
}

async function services() {
  // Bayi API'si Ingilizce oncelikli: EN alani bossa TR'ye duser.
  const rows = await dbAsync.all(`SELECT s.id AS service, COALESCE(NULLIF(s.name_en, ''), s.name) AS name,
      COALESCE(NULLIF(c.name_en, ''), NULLIF(c.name_tr, ''), c.name, 'Other') AS category,
      s.rate_per_1000_kurus, s.rate_per_1000, s.pricing_model, s.order_input_type,
      s.min_quantity AS min, s.max_quantity AS max, s.refill, s.provider_cancel, s.provider_dripfeed,
      COALESCE(NULLIF(s.description_en, ''), s.description, '') AS description,
      COALESCE(NULLIF(s.start_time_en, ''), s.start_time_tr, '') AS start_time,
      COALESCE(NULLIF(s.speed_en, ''), s.speed_tr, '') AS speed,
      COALESCE(NULLIF(s.features_en, ''), s.features_tr, '') AS features
    FROM services s LEFT JOIN categories c ON c.id = s.category_id
    WHERE s.status = 1 AND s.is_bundle = 0
    ORDER BY COALESCE(c.sort_order, 0), s.category_id, s.id`);
  return rows.map(row => {
    const inputType = normalizeOrderInputType(row.order_input_type);
    const pricingModel = normalizePricingModel(row.pricing_model);
    const rateKurus = row.rate_per_1000_kurus || toKurus(row.rate_per_1000);
    return {
      service: row.service,
      name: row.name,
      type: inputType === 'custom_comments' ? 'Custom Comments' : 'Default',
      category: row.category,
      // Bayi panelleri ucreti her zaman rate / 1000 x adet diye hesaplar.
      // Adet basi fiyatlanan urunde (dijital) rate 1000 ile carpilmazsa
      // bayi urunu 1000 kat ucuz sanip zararina satar.
      rate: fromKurus(pricingModel === 'per_item' ? rateKurus * 1000 : rateKurus).toFixed(2),
      min: row.min,
      max: row.max,
      refill: Number(row.refill) === 1,
      cancel: Number(row.provider_cancel) === 1,
      dripfeed: inputType === 'link' && Number(row.provider_dripfeed) === 1,
      description: row.description,
      start_time: row.start_time,
      speed: row.speed,
      // Ozellikler satir satir saklanir; API'de dizi olarak verilir.
      features: String(row.features || '').split(/\r?\n/).filter(Boolean),
      order_input_type: inputType,
      pricing_model: pricingModel
    };
  });
}

async function balance(user) {
  return { balance: fromKurus(user.balance_kurus).toFixed(2), currency: 'TRY' };
}

async function add(user, body, req) {
  const { service, quantity, comments, runs, interval } = body;
  // Oyuncu kimligi gibi hedefler JSON'da sayi olarak gelebilir.
  const link = typeof body.link === 'number' ? String(body.link) : body.link;
  const serviceId = singleId(service);
  if (!serviceId) return { error: 'Incorrect service ID' };
  const qty = isBlank(quantity) ? undefined : Number(quantity);
  if ((qty !== undefined && !Number.isSafeInteger(qty)) || typeof link !== 'string' || !link.trim()) {
    return { error: 'Invalid parameters' };
  }
  if (!isBlank(comments) && typeof comments !== 'string') return { error: 'Invalid parameters' };

  // Kademeli gonderim (drip-feed): quantity her turun miktaridir, ucret
  // quantity x runs. Eskiden bu alanlar yok sayiliyor, tek tur gidiyordu.
  let dripRuns = 1;
  let dripInterval = null;
  if (!isBlank(runs)) {
    dripRuns = Number(runs);
    if (!Number.isSafeInteger(dripRuns) || dripRuns < 1 || dripRuns > 100) return { error: 'Invalid runs (1-100)' };
    if (dripRuns > 1) {
      dripInterval = Number(interval);
      if (!Number.isSafeInteger(dripInterval) || dripInterval < 5 || dripInterval > 10080) {
        return { error: 'Invalid interval (5-10080 minutes)' };
      }
    }
  }

  try {
    // Panel siparisiyle AYNI yoldan gecer: link dogrulamasi, kampanya
    // indirimi, bakiye dusumu, saglayiciya iletim ve basarisizlikta iade.
    const result = await placeOrder({
      user,
      serviceId,
      link,
      quantity: qty,
      comments: comments || '',
      dripRuns,
      dripIntervalMinutes: dripInterval,
      termsAccepted: true,
      lang: 'en'
    });
    return { order: result.orderId };
  } catch (err) {
    if (!err.messageEn && !(Number.isInteger(err.status) && err.status < 500)) req.log?.error({ err }, 'api_v2_add_failed');
    return { error: apiError(err, 'The order could not be placed. Please try again.') };
  }
}

async function status(user, body) {
  if (!isBlank(body.order)) {
    const id = singleId(body.order);
    const order = id && await dbAsync.get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [id, user.id]);
    return order ? orderStatusBody(order) : { error: 'Order not found' };
  }
  if (!isBlank(body.orders)) {
    const ids = idList(body.orders);
    if (!ids.length) return { error: 'Invalid orders' };
    const rows = await dbAsync.all(
      `SELECT * FROM orders WHERE user_id = ? AND id IN (${ids.map(() => '?').join(',')})`,
      [user.id, ...ids]
    );
    const byId = new Map(rows.map(row => [row.id, row]));
    return Object.fromEntries(ids.map(id => [id, byId.has(id) ? orderStatusBody(byId.get(id)) : { error: 'Incorrect order ID' }]));
  }
  return { error: 'Invalid parameters' };
}

async function refillOne(user, orderId, req) {
  try {
    const result = await requestRefill({ user, orderId });
    return result.refillId;
  } catch (err) {
    if (!err.messageEn) req.log?.error({ err }, 'api_v2_refill_failed');
    return { error: apiError(err, 'The refill request could not be processed.') };
  }
}

async function refill(user, body, req) {
  if (!isBlank(body.order)) {
    const result = await refillOne(user, body.order, req);
    return typeof result === 'object' ? result : { refill: result };
  }
  if (!isBlank(body.orders)) {
    const ids = idList(body.orders);
    if (!ids.length) return { error: 'Invalid orders' };
    const results = [];
    for (const id of ids) results.push({ order: id, refill: await refillOne(user, id, req) });
    return results;
  }
  return { error: 'Invalid parameters' };
}

async function refillStatus(user, body) {
  if (!isBlank(body.refill)) {
    const id = singleId(body.refill);
    const row = id && await dbAsync.get('SELECT status FROM order_refills WHERE id = ? AND user_id = ?', [id, user.id]);
    return row ? { status: refillStatusLabel(row.status) } : { error: 'Refill not found' };
  }
  if (!isBlank(body.refills)) {
    const ids = idList(body.refills);
    if (!ids.length) return { error: 'Invalid refills' };
    const rows = await dbAsync.all(
      `SELECT id, status FROM order_refills WHERE user_id = ? AND id IN (${ids.map(() => '?').join(',')})`,
      [user.id, ...ids]
    );
    const byId = new Map(rows.map(row => [row.id, row]));
    return ids.map(id => ({
      refill: id,
      status: byId.has(id) ? refillStatusLabel(byId.get(id).status) : { error: 'Refill not found' }
    }));
  }
  return { error: 'Invalid parameters' };
}

async function cancel(user, body) {
  // Standart alan "orders"; tek siparis icin "order" da kabul edilir.
  const ids = idList(isBlank(body.orders) ? body.order : body.orders);
  if (!ids.length) return { error: 'Invalid orders' };
  return requestCancel({ user, orderIds: ids });
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
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const key = body.key;
    if (typeof key !== 'string' || !key || key.length > 200) return res.json({ error: 'Invalid API Key' });

    const user = await dbAsync.get('SELECT * FROM users WHERE api_key = ?', [key]);
    if (!user || user.banned) return res.json({ error: 'Invalid API Key' });

    const handler = typeof body.action === 'string' ? ACTIONS.get(body.action) : null;
    if (!handler) return res.json({ error: 'Invalid action' });
    res.json(await handler(user, body, req));
  } catch (err) { next(err); }
});

module.exports = router;
