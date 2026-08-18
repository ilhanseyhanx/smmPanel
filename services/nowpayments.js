const crypto = require('crypto');
const axios = require('axios');
const { dbAsync } = require('../config/database');
const { safeRequestConfig } = require('../utils/network');

const API_BASE = 'https://api.nowpayments.io/v1';

// Anahtarlar admin panelinden yonetilir; .env yalnizca yedektir.
async function getConfig() {
  const rows = await dbAsync.all(
    `SELECT key, value FROM site_settings WHERE key IN ('nowpayments_api_key', 'nowpayments_ipn_secret')`
  );
  const stored = {};
  rows.forEach(row => { stored[row.key] = row.value; });
  return {
    apiKey: String(stored.nowpayments_api_key || process.env.NOWPAYMENTS_API_KEY || '').trim(),
    ipnSecret: String(stored.nowpayments_ipn_secret || process.env.NOWPAYMENTS_IPN_SECRET || '').trim(),
    baseUrl: String(process.env.PUBLIC_BASE_URL || '').trim()
  };
}

async function isConfigured() {
  const config = await getConfig();
  return Boolean(config.apiKey && config.ipnSecret);
}

/**
 * Kripto odeme faturasi olusturur; NOWPayments'in kendi barindirdigi odeme
 * sayfasinin adresini dondurur (coin secimi, QR, sure sayaci hepsi onlarda).
 */
async function createInvoice({ amountTry, orderId, successUrl, cancelUrl }) {
  const config = await getConfig();
  if (!config.apiKey || !config.ipnSecret) {
    const error = new Error('Kripto ödemesi henüz yapılandırılmamış. Admin panelinden NOWPayments anahtarlarını ekleyin.');
    error.status = 503;
    throw error;
  }
  if (!config.baseUrl) {
    const error = new Error('PUBLIC_BASE_URL ayarlanmadan kripto ödemesi alınamaz (ödeme onayı bu adrese gelir).');
    error.status = 503;
    throw error;
  }

  const response = await axios.post(`${API_BASE}/invoice`, {
    price_amount: Number(amountTry),
    price_currency: 'try',
    order_id: orderId,
    order_description: 'SMM Panel Bakiye Yükleme',
    ipn_callback_url: `${config.baseUrl.replace(/\/$/, '')}/api/payments/nowpayments/callback`,
    success_url: successUrl,
    cancel_url: cancelUrl
  }, safeRequestConfig({
    timeout: 20000,
    maxContentLength: 512 * 1024,
    headers: { 'x-api-key': config.apiKey, 'Content-Type': 'application/json' },
    validateStatus: () => true
  }));

  const data = response.data;
  if (response.status >= 400 || !data?.invoice_url) {
    const raw = String(data?.message || '');
    // NOWPayments'in Ingilizce hatalari musteriye anlasilir Turkce dondurulur.
    if (/less than minimal|minimal amount|too small/i.test(raw)) {
      throw new Error('Tutar, seçilen coinin blockchain alt limitinin altında kaldı. Lütfen daha yüksek bir tutar girin.');
    }
    throw new Error(raw || `NOWPayments fatura oluşturamadı (HTTP ${response.status}).`);
  }
  return { invoiceId: String(data.id), invoiceUrl: data.invoice_url };
}

// NOWPayments IPN imzasi: govde anahtarlari alfabetik siralanip JSON'lanir,
// IPN secret ile HMAC-SHA512 alinir ve x-nowpayments-sig ile karsilastirilir.
function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = sortKeysDeep(value[key]);
      return acc;
    }, {});
  }
  return value;
}

async function verifyIpnSignature(body, signature) {
  const config = await getConfig();
  if (!config.ipnSecret || !signature) return false;
  const expected = crypto
    .createHmac('sha512', config.ipnSecret)
    .update(JSON.stringify(sortKeysDeep(body)))
    .digest('hex');
  const provided = String(signature);
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

// ---------------------------------------------------------------------------
// SİTE İÇİ ÖDEME AKIŞI (hazir NOWPayments sayfasi yerine kendi ekranimiz)
// ---------------------------------------------------------------------------

// Musteriye sunulacak coinler. Memo/tag gerektiren coinler (XRP, TON vb.)
// bilerek listede yok; memo unutulunca para kaybolur, destek yuku olur.
const SUPPORTED_COINS = {
  usdttrc20: { label: 'USDT', network: 'TRC-20 · Tron', recommended: true },
  usdtbsc: { label: 'USDT', network: 'BEP-20 · BSC' },
  usdterc20: { label: 'USDT', network: 'ERC-20 · Ethereum' },
  btc: { label: 'Bitcoin', network: 'BTC' },
  eth: { label: 'Ethereum', network: 'ETH' },
  ltc: { label: 'Litecoin', network: 'LTC' },
  trx: { label: 'TRON', network: 'TRX' },
  doge: { label: 'Dogecoin', network: 'DOGE' },
  bnbbsc: { label: 'BNB', network: 'BEP-20 · BSC' },
  sol: { label: 'Solana', network: 'SOL' }
};

async function apiGet(pathname, params) {
  const config = await getConfig();
  const response = await axios.get(`${API_BASE}/${pathname}`, safeRequestConfig({
    timeout: 15000,
    maxContentLength: 512 * 1024,
    params,
    headers: { 'x-api-key': config.apiKey },
    validateStatus: () => true
  }));
  if (response.status >= 400) {
    const error = new Error(response.data?.message || `NOWPayments ${pathname} hatası (HTTP ${response.status}).`);
    error.status = 400; // musteriye anlamli mesaj gitsin (500 genellesiyor)
    throw error;
  }
  return response.data;
}

// Hesapta acik olan coinler ile bizim listenin kesisimi (10 dk onbellek).
let currenciesCache = { at: 0, list: null };
async function getAvailableCoins() {
  if (currenciesCache.list && Date.now() - currenciesCache.at < 600000) return currenciesCache.list;
  let merchantCoins = null;
  try {
    const data = await apiGet('merchant/coins');
    if (Array.isArray(data?.selectedCurrencies) && data.selectedCurrencies.length) {
      merchantCoins = new Set(data.selectedCurrencies.map(c => String(c).toLowerCase()));
    }
  } catch { /* liste alinamazsa tum desteklenenler gosterilir */ }

  const list = Object.entries(SUPPORTED_COINS)
    .filter(([code]) => !merchantCoins || merchantCoins.has(code))
    .map(([code, meta]) => ({ code, ...meta }));
  currenciesCache = { at: Date.now(), list: list.length ? list : Object.entries(SUPPORTED_COINS).map(([code, meta]) => ({ code, ...meta })) };
  return currenciesCache.list;
}

// TRY tutarinin secilen coindeki karsiligi.
async function estimateFromTry(amountTry, payCurrency) {
  const data = await apiGet('estimate', { amount: amountTry, currency_from: 'try', currency_to: payCurrency });
  const estimated = Number(data?.estimated_amount);
  if (!(estimated > 0)) throw new Error('Kur tahmini alınamadı, lütfen tekrar deneyin.');
  return estimated;
}

// Coinin kabul edilen en dusuk odeme miktari (coin biriminde).
async function getMinAmount(payCurrency) {
  const data = await apiGet('min-amount', { currency_from: payCurrency });
  return Number(data?.min_amount) || 0;
}

// Coinin TL cinsinden yaklasik alt limiti (10 dk onbellek + %5 kur payi).
// Kullanici daha tutari yazarken gercek limiti gorebilsin diye kullanilir.
const minTryCache = new Map();
async function getMinTryFor(payCurrency) {
  const cached = minTryCache.get(payCurrency);
  if (cached && Date.now() - cached.at < 600000) return cached.value;

  const [coinPer100Try, minCoin] = await Promise.all([
    estimateFromTry(100, payCurrency),
    getMinAmount(payCurrency)
  ]);
  let minTry = 0;
  if (minCoin > 0 && coinPer100Try > 0) {
    // Kur dalgalanmasina karsi %5 pay birakilir; 10 TL'ye yuvarlanir.
    minTry = Math.ceil((minCoin / coinPer100Try) * 100 * 1.05 / 10) * 10;
  }
  minTryCache.set(payCurrency, { at: Date.now(), value: minTry });
  return minTry;
}

/**
 * Dogrudan odeme olusturur: adres + gonderilecek net miktar doner.
 * QR ve gorunum tamamen bizim sayfamizda cizilir.
 */
async function createPayment({ amountTry, payCurrency, orderId }) {
  const config = await getConfig();
  if (!config.apiKey || !config.ipnSecret) {
    const error = new Error('Kripto ödemesi henüz yapılandırılmamış. Admin panelinden NOWPayments anahtarlarını ekleyin.');
    error.status = 503;
    throw error;
  }
  if (!config.baseUrl) {
    const error = new Error('PUBLIC_BASE_URL ayarlanmadan kripto ödemesi alınamaz (ödeme onayı bu adrese gelir).');
    error.status = 503;
    throw error;
  }
  const response = await axios.post(`${API_BASE}/payment`, {
    price_amount: Number(amountTry),
    price_currency: 'try',
    pay_currency: payCurrency,
    order_id: orderId,
    order_description: 'SMM Panel Bakiye Yükleme',
    ipn_callback_url: `${config.baseUrl.replace(/\/$/, '')}/api/payments/nowpayments/callback`
  }, safeRequestConfig({
    timeout: 20000,
    maxContentLength: 512 * 1024,
    headers: { 'x-api-key': config.apiKey, 'Content-Type': 'application/json' },
    validateStatus: () => true
  }));

  const data = response.data;
  if (response.status >= 400 || !data?.pay_address) {
    const raw = String(data?.message || '');
    // status=400 verilir ki errorHandler mesaji musteriye aynen iletsin
    // (500'lerde genel mesaja cevriliyor).
    let error;
    if (/less than minimal|minimal amount|too small/i.test(raw)) {
      error = new Error('Tutar bu coinin blockchain alt limitinin altında. Daha yüksek tutar girin veya USDT (TRC-20) seçin.');
    } else if (/invalid api key|unauthorized|forbidden/i.test(raw)) {
      error = new Error('NOWPayments API anahtarı geçersiz. Admin panelinden anahtarı kontrol edin.');
    } else {
      error = new Error(raw ? `Ödeme sağlayıcısı hatası: ${raw}` : `NOWPayments ödeme oluşturamadı (HTTP ${response.status}).`);
    }
    error.status = 400;
    throw error;
  }
  return {
    paymentId: String(data.payment_id),
    payAddress: data.pay_address,
    payAmount: Number(data.pay_amount),
    payCurrency: String(data.pay_currency || payCurrency),
    expiresAt: data.expiration_estimate_date || null
  };
}

module.exports = {
  createInvoice, verifyIpnSignature, isConfigured, getConfig,
  SUPPORTED_COINS, getAvailableCoins, estimateFromTry, getMinAmount, getMinTryFor, createPayment
};
