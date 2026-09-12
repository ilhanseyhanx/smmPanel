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

function providerQuantityFor(service, quantity) {
  const multiplier = Math.max(1, Number.parseInt(service.provider_quantity_multiplier || 1, 10));
  const result = quantity * multiplier;
  if (!Number.isSafeInteger(result) || result <= 0 || result > 100_000_000) {
    throw new Error('Sağlayıcıya gönderilecek miktar geçersiz.');
  }
  return result;
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
  inboundEmailDomain,
  relayAddressFromToken,
  verifyWebhookSignature
};
