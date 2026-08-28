const crypto = require('crypto');
const { dbAsync } = require('../config/database');

// Shopier'in odeme sayfasi bir REST ucu degil: imzali bir HTML formu bu adrese
// POST edilir, musteri Shopier'de oder, sonuc yine POST ile geri doner.
const SHOPIER_PAY_URL = 'https://www.shopier.com/ShowProduct/api_pay4.php';

// Anahtarlar admin panelinden yonetilir; .env yalnizca yedektir
// (NOWPayments ile ayni kalip).
async function getConfig() {
  const rows = await dbAsync.all(
    `SELECT key, value FROM site_settings WHERE key IN ('shopier_api_key', 'shopier_api_secret')`
  );
  const stored = {};
  rows.forEach(row => { stored[row.key] = row.value; });
  return {
    apiKey: String(stored.shopier_api_key || process.env.SHOPIER_API_KEY || '').trim(),
    apiSecret: String(stored.shopier_api_secret || process.env.SHOPIER_API_SECRET || '').trim(),
    baseUrl: String(process.env.PUBLIC_BASE_URL || '').trim()
  };
}

async function isConfigured() {
  const config = await getConfig();
  return Boolean(config.apiKey && config.apiSecret);
}

// Shopier alici alanlari yalnizca harf/rakam kabul eder; kullanici adindaki
// nokta, alt cizgi gibi karakterler odeme formunu reddettirir.
function safeName(value, fallback) {
  const clean = String(value || '')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  return clean || fallback;
}

function hmacBase64(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64');
}

/**
 * Odeme formunun alanlarini uretir. Istemci bu alanlari gizli bir form olarak
 * Shopier'e POST eder; kart bilgisi hicbir zaman bizim sunucumuza ugramaz.
 */
async function buildPaymentForm({ user, amountKurus, merchantOid, createdAt }) {
  const config = await getConfig();
  if (!config.apiKey || !config.apiSecret) {
    const error = new Error('Shopier ödemesi henüz yapılandırılmamış. Admin panelinden API anahtarı ve şifresini ekleyin.');
    error.status = 503;
    throw error;
  }
  if (!config.baseUrl) {
    const error = new Error('PUBLIC_BASE_URL ayarlanmadan Shopier ödemesi alınamaz (ödeme onayı bu adrese gelir).');
    error.status = 503;
    throw error;
  }

  // Imza bu metnin tam olarak gonderilen haliyle alinir; tutari once
  // bicimlendirip sonra imzalamak sart (10 ile 10.00 farkli imza uretir).
  const totalOrderValue = (amountKurus / 100).toFixed(2);
  const currency = '0'; // 0 = TL, 1 = USD, 2 = EUR
  const randomNr = String(crypto.randomInt(100000, 1000000));

  // Hesap yasi (gun): Shopier'in dolandiricilik puanlamasinda kullanilir.
  const accountAgeDays = createdAt
    ? Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000))
    : 0;

  const fields = {
    API_key: config.apiKey,
    website_index: '1',
    platform_order_id: merchantOid,
    product_name: 'SMM Panel Bakiye Yükleme',
    product_type: '1', // 1 = dijital / indirilebilir urun
    buyer_name: safeName(user.username, 'Musteri'),
    buyer_surname: safeName(user.username, 'Kullanici'),
    buyer_email: String(user.email || '').slice(0, 100),
    buyer_account_age: String(accountAgeDays),
    buyer_id_nr: String(user.id),
    buyer_phone: '05000000000',
    billing_address: 'Online Hizmet',
    billing_city: 'Istanbul',
    billing_country: 'Turkiye',
    billing_postcode: '34000',
    shipping_address: 'Online Hizmet',
    shipping_city: 'Istanbul',
    shipping_country: 'Turkiye',
    shipping_postcode: '34000',
    total_order_value: totalOrderValue,
    currency,
    platform: '0',
    is_in_frame: '0',
    current_language: '0', // 0 = tr-TR
    modul_version: '1.0.4',
    random_nr: randomNr
  };

  fields.signature = hmacBase64(
    `${randomNr}${merchantOid}${totalOrderValue}${currency}`,
    config.apiSecret
  );

  return { action: SHOPIER_PAY_URL, fields };
}

/**
 * Shopier'in geri donus imzasi: random_nr + platform_order_id metninin
 * API sifresiyle alinmis HMAC-SHA256'sinin base64'u.
 */
async function verifyCallback(body) {
  const config = await getConfig();
  if (!config.apiSecret) return false;
  // Form-encoded govdede '+' karakteri bosluga cevrilebiliyor; base64 imza
  // bu yuzden bozulur.
  const provided = String(body?.signature || '').replace(/ /g, '+');
  const expected = hmacBase64(`${body?.random_nr || ''}${body?.platform_order_id || ''}`, config.apiSecret);
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

module.exports = { SHOPIER_PAY_URL, getConfig, isConfigured, buildPaymentForm, verifyCallback };
