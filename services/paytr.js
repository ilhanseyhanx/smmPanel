const crypto = require('crypto');
const axios = require('axios');

function getConfig() {
  const config = {
    merchantId: process.env.PAYTR_MERCHANT_ID,
    merchantKey: process.env.PAYTR_MERCHANT_KEY,
    merchantSalt: process.env.PAYTR_MERCHANT_SALT,
    baseUrl: process.env.PUBLIC_BASE_URL
  };
  if (!config.merchantId || !config.merchantKey || !config.merchantSalt || !config.baseUrl) {
    const error = new Error('PayTR henüz yapılandırılmamış. Merchant bilgilerini ortam değişkenlerine ekleyin.');
    error.status = 503;
    throw error;
  }
  return config;
}

function hmacBase64(value, key) {
  return crypto.createHmac('sha256', key).update(value).digest('base64');
}

async function createIframeToken({ user, amountKurus, merchantOid, userIp }) {
  const config = getConfig();
  const basket = Buffer.from(JSON.stringify([['SMM Panel Bakiye', (amountKurus / 100).toFixed(2), 1]])).toString('base64');
  const fields = {
    merchant_id: config.merchantId,
    user_ip: String(userIp || '').replace('::ffff:', '').slice(0, 39),
    merchant_oid: merchantOid,
    email: user.email,
    payment_amount: String(amountKurus),
    user_basket: basket,
    no_installment: '0',
    max_installment: '12',
    currency: 'TL',
    test_mode: process.env.PAYTR_TEST_MODE === '1' ? '1' : '0'
  };
  const hashValue = `${fields.merchant_id}${fields.user_ip}${fields.merchant_oid}${fields.email}${fields.payment_amount}${fields.user_basket}${fields.no_installment}${fields.max_installment}${fields.currency}${fields.test_mode}${config.merchantSalt}`;
  const response = await axios.post('https://www.paytr.com/odeme/api/get-token', new URLSearchParams({
    ...fields,
    paytr_token: hmacBase64(hashValue, config.merchantKey),
    merchant_ok_url: `${config.baseUrl.replace(/\/$/, '')}/payment-success`,
    merchant_fail_url: `${config.baseUrl.replace(/\/$/, '')}/payment-failed`,
    user_name: user.username,
    user_address: 'Online Hizmet',
    user_phone: '0000000000',
    timeout_limit: '30',
    debug_on: process.env.NODE_ENV === 'production' ? '0' : '1',
    lang: 'tr'
  }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 });
  if (response.data?.status !== 'success' || !response.data.token) {
    const error = new Error(response.data?.reason || 'PayTR ödeme oturumu oluşturulamadı.');
    error.status = 502;
    throw error;
  }
  return response.data.token;
}

function verifyCallback(body) {
  const config = getConfig();
  const expected = hmacBase64(`${body.merchant_oid}${config.merchantSalt}${body.status}${body.total_amount}`, config.merchantKey);
  const actualBuffer = Buffer.from(String(body.hash || ''));
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

module.exports = { createIframeToken, verifyCallback };
