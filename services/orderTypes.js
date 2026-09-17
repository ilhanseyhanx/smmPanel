'use strict';

const crypto = require('crypto');
const { normalizePlainText } = require('../utils/security');

const ORDER_INPUT_TYPES = new Set([
  'link',
  'custom_comments',
  'email_delivery',
  'email_invite',
  'player_id'
]);

const PRICING_MODELS = new Set(['per_1000', 'per_item']);

function normalizeOrderInputType(value) {
  return ORDER_INPUT_TYPES.has(value) ? value : 'link';
}

function normalizePricingModel(value) {
  return PRICING_MODELS.has(value) ? value : 'per_1000';
}

function normalizeComments(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map(line => normalizePlainText(line, 500).trim())
    .filter(Boolean)
    .slice(0, 100000);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
    && String(value).trim().length <= 254;
}

function calculateServiceChargeKurus(rateKurus, quantity, pricingModel = 'per_1000') {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('Geçersiz miktar.');
  const rate = Number(rateKurus);
  if (!Number.isSafeInteger(rate) || rate < 0) throw new Error('Geçersiz servis fiyatı.');
  return normalizePricingModel(pricingModel) === 'per_item'
    ? rate * quantity
    : Math.round((rate * quantity) / 1000);
}

// Servis bazli fazla gonderim yuzdesi (0-500). Gecersiz/negatif deger 0 sayilir.
function overagePercentOf(service) {
  const value = Number(service?.provider_overage_percent);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(500, value);
}

// Saglayiciya gidecek miktar: musteri miktari x carpan x (1 + fazla gonderim).
// Fazla gonderim, eksik teslim eden saglayicilari telafi eder; musteri bunu
// gormez ve odemez (bkz. provider_overage_percent). Yukari yuvarlanir ki
// kucuk siparislerde de en az istenen kadar teslim olsun.
function providerQuantityFor(service, quantity) {
  const multiplier = Math.max(1, Number.parseInt(service.provider_quantity_multiplier || 1, 10));
  const base = quantity * multiplier;
  const overage = overagePercentOf(service);
  // Tam sayi aritmetigi: 400 * 1.14 kayan noktada 456.00000000000006 olup
  // 457'ye yuvarlaniyordu; yuzde 2 ondalikla tam sayiya cevrilir.
  const result = overage > 0 ? Math.ceil(base * (10000 + Math.round(overage * 100)) / 10000) : base;
  if (!Number.isSafeInteger(result) || result <= 0 || result > 100_000_000) {
    throw new Error('Sağlayıcıya gönderilecek miktar geçersiz.');
  }
  return result;
}

// Saglayicinin bildirdigi "remains" saglayici birimindedir ve fazla gonderilen
// pay dahildir. Musteriye yansiyan eksik: once fazla pay erir, kalan musteri
// birimine (carpan) cevrilir. Ornek: 400 istendi, 456 gonderildi, 40 kaldi ->
// musteri 416 aldi, eksik 0. Eski siparislerde (provider_quantity yok) oldugu
// gibi doner.
function customerRemainsFrom(order, providerRemains, multiplier = 1) {
  const remains = Number.parseInt(providerRemains, 10);
  if (!Number.isFinite(remains) || remains <= 0) return 0;
  const sent = Number.parseInt(order?.provider_quantity, 10);
  const quantity = Number.parseInt(order?.quantity, 10);
  if (!Number.isFinite(sent) || sent <= 0 || !Number.isFinite(quantity) || quantity <= 0) return remains;
  const factor = Math.max(1, Number.parseInt(multiplier || 1, 10));
  const extra = Math.max(0, sent - quantity * factor);
  const shortfall = Math.max(0, remains - extra);
  return Math.min(quantity, Math.ceil(shortfall / factor));
}

function inboundEmailDomain() {
  return String(process.env.INBOUND_EMAIL_DOMAIN || 'jetsmmpanel.com')
    .trim().toLowerCase().replace(/^@/, '');
}

function relayAddressFromToken(token) {
  return `order-${token}@${inboundEmailDomain()}`;
}

function verifyWebhookSignature(rawBody, signature) {
  const secret = String(process.env.INBOUND_EMAIL_WEBHOOK_SECRET || '');
  if (!secret || !Buffer.isBuffer(rawBody) || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const supplied = String(signature).replace(/^sha256=/i, '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(supplied)) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(supplied, 'hex'));
}

module.exports = {
  ORDER_INPUT_TYPES,
  PRICING_MODELS,
  normalizeOrderInputType,
  normalizePricingModel,
  normalizeComments,
  isEmail,
  calculateServiceChargeKurus,
  providerQuantityFor,
  overagePercentOf,
  customerRemainsFrom,
  inboundEmailDomain,
  relayAddressFromToken,
  verifyWebhookSignature
};
