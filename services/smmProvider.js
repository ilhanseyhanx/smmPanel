const axios = require('axios');
const { assertPublicProviderUrl, safeRequestConfig } = require('../utils/network');

class SmmProviderClient {
  constructor(apiUrl, apiKey) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json, text/plain, */*'
    };
  }

  async getServices() {
    try {
      await assertPublicProviderUrl(this.apiUrl);
      // Try POST request with form body
      const response = await axios.post(
        this.apiUrl,
        new URLSearchParams({ key: this.apiKey, action: 'services' }).toString(),
        safeRequestConfig({ headers: this.headers, timeout: 15000 })
      );
      return response.data;
    } catch (err) {
      console.error(`SMM Provider getServices Error [${this.apiUrl}]:`, err.message);
      throw new Error(`Sağlayıcı servisine bağlanılamadı (${err.message}).`);
    }
  }

  async addOrder(serviceId, link, quantity, drip = {}) {
    try {
      await assertPublicProviderUrl(this.apiUrl);
      const response = await axios.post(
        this.apiUrl,
        new URLSearchParams({
          key: this.apiKey,
          action: 'add',
          service: serviceId.toString(),
          link: link,
          quantity: quantity.toString(),
          ...(drip.runs > 1 ? { runs: String(drip.runs), interval: String(drip.interval) } : {})
        }).toString(),
        safeRequestConfig({ headers: this.headers, timeout: 15000 })
      );
      return response.data;
    } catch (err) {
      // Saglayicinin JSON govdesindeki asil hata mesaji ("Invalid link",
      // "Not enough funds" vb.) axios'un "status code 400" metninde kaybolur;
      // varsa onu one cikart ki musteriye/admine gercek sebep gosterilebilsin.
      const providerMessage = err.response?.data?.error || err.response?.data?.message;
      const detail = providerMessage ? String(providerMessage) : err.message;
      console.error(`SMM Provider addOrder Error [${this.apiUrl}]:`, detail);
      throw new Error(`Sipariş sağlayıcıya iletilemedi: ${detail}`);
    }
  }

  async requestRefill(providerOrderId) {
    try {
      await assertPublicProviderUrl(this.apiUrl);
      const response = await axios.post(
        this.apiUrl,
        new URLSearchParams({ key: this.apiKey, action: 'refill', order: providerOrderId.toString() }).toString(),
        safeRequestConfig({ headers: this.headers, timeout: 15000 })
      );
      return response.data;
    } catch (err) {
      throw new Error(`Telafi isteği sağlayıcıya iletilemedi: ${err.message}`);
    }
  }

  async getOrderStatus(providerOrderId) {
    try {
      await assertPublicProviderUrl(this.apiUrl);
      const response = await axios.post(
        this.apiUrl,
        new URLSearchParams({
          key: this.apiKey,
          action: 'status',
          order: providerOrderId.toString()
        }).toString(),
        safeRequestConfig({ headers: this.headers, timeout: 15000 })
      );
      return response.data;
    } catch (err) {
      console.error(`SMM Provider getOrderStatus Error [${this.apiUrl}]:`, err.message);
      return null;
    }
  }

  async getMultiOrderStatus(orderIds) {
    try {
      await assertPublicProviderUrl(this.apiUrl);
      const response = await axios.post(
        this.apiUrl,
        new URLSearchParams({
          key: this.apiKey,
          action: 'status',
          orders: Array.isArray(orderIds) ? orderIds.join(',') : orderIds.toString()
        }).toString(),
        safeRequestConfig({ headers: this.headers, timeout: 15000 })
      );
      return response.data;
    } catch (err) {
      console.error(`SMM Provider getMultiOrderStatus Error [${this.apiUrl}]:`, err.message);
      return null;
    }
  }

  async getBalance() {
    try {
      await assertPublicProviderUrl(this.apiUrl);
      const response = await axios.post(
        this.apiUrl,
        new URLSearchParams({ key: this.apiKey, action: 'balance' }).toString(),
        safeRequestConfig({ headers: this.headers, timeout: 10000 })
      );
      return response.data;
    } catch (err) {
      console.error(`SMM Provider getBalance Error [${this.apiUrl}]:`, err.message);
      return { balance: 0, currency: 'USD' };
    }
  }
}

module.exports = SmmProviderClient;
