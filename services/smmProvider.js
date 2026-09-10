const axios = require('axios');
const { assertPublicProviderUrl, safeRequestConfig } = require('../utils/network');
const healthEvents = require('./healthEvents');

class SmmProviderClient {
  // meta = { id, name }: yalnizca KAYITLI saglayicida verilir; saglik
  // telemetrisi bu kimlikle tutulur. api_url / api_key telemetriye GITMEZ.
  // meta yoksa (or. yeni saglayici eklenirken yapilan baglanti testi) olcum
  // yapilmaz; davranis tamamen ayni kalir.
  constructor(apiUrl, apiKey, meta = null) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    this.meta = meta && Number(meta.id) > 0 ? { id: Number(meta.id) } : null;
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json, text/plain, */*'
    };
  }

  // Pasif olcum: donus degerini, hatayi veya akisi DEGISTIRMEZ; telemetri
  // hata verse bile cagri sonucu aynen doner.
  _telemetri(operation, baslangic, error, body) {
    if (!this.meta) return;
    try {
      healthEvents.recordProviderCall({
        providerId: this.meta.id,
        operation,
        latencyMs: Date.now() - baslangic,
        error,
        body
      });
    } catch { /* telemetri ana akisi bozmaz */ }
  }

  async getServices() {
    const baslangic = Date.now();
    try {
      await assertPublicProviderUrl(this.apiUrl);
      // Try POST request with form body
      const response = await axios.post(
        this.apiUrl,
        new URLSearchParams({ key: this.apiKey, action: 'services' }).toString(),
        safeRequestConfig({ headers: this.headers, timeout: 15000 })
      );
      this._telemetri('getServices', baslangic, null, response.data);
      return response.data;
    } catch (err) {
      this._telemetri('getServices', baslangic, err);
      console.error(`SMM Provider getServices Error [${this.apiUrl}]:`, err.message);
      throw new Error(`Sağlayıcı servisine bağlanılamadı (${err.message}).`);
    }
  }

  async addOrder(serviceId, link, quantity, drip = {}) {
    const baslangic = Date.now();
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
      this._telemetri('addOrder', baslangic, null, response.data);
      return response.data;
    } catch (err) {
      this._telemetri('addOrder', baslangic, err);
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
    const baslangic = Date.now();
    try {
      await assertPublicProviderUrl(this.apiUrl);
      const response = await axios.post(
        this.apiUrl,
        new URLSearchParams({ key: this.apiKey, action: 'refill', order: providerOrderId.toString() }).toString(),
        safeRequestConfig({ headers: this.headers, timeout: 15000 })
      );
      this._telemetri('requestRefill', baslangic, null, response.data);
      return response.data;
    } catch (err) {
      this._telemetri('requestRefill', baslangic, err);
      throw new Error(`Telafi isteği sağlayıcıya iletilemedi: ${err.message}`);
    }
  }

  async getOrderStatus(providerOrderId) {
    const baslangic = Date.now();
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
      this._telemetri('getOrderStatus', baslangic, null, response.data);
      return response.data;
    } catch (err) {
      this._telemetri('getOrderStatus', baslangic, err);
      console.error(`SMM Provider getOrderStatus Error [${this.apiUrl}]:`, err.message);
      return null;
    }
  }

  async getMultiOrderStatus(orderIds) {
    const baslangic = Date.now();
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
      this._telemetri('getMultiOrderStatus', baslangic, null, response.data);
      return response.data;
    } catch (err) {
      this._telemetri('getMultiOrderStatus', baslangic, err);
      console.error(`SMM Provider getMultiOrderStatus Error [${this.apiUrl}]:`, err.message);
      return null;
    }
  }

  async getBalance() {
    const baslangic = Date.now();
    try {
      await assertPublicProviderUrl(this.apiUrl);
      const response = await axios.post(
        this.apiUrl,
        new URLSearchParams({ key: this.apiKey, action: 'balance' }).toString(),
        safeRequestConfig({ headers: this.headers, timeout: 10000 })
      );
      this._telemetri('getBalance', baslangic, null, response.data);
      return response.data;
    } catch (err) {
      this._telemetri('getBalance', baslangic, err);
      console.error(`SMM Provider getBalance Error [${this.apiUrl}]:`, err.message);
      return { balance: 0, currency: 'USD' };
    }
  }
}

module.exports = SmmProviderClient;
