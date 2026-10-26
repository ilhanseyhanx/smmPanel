'use strict';

// DIJITAL URUN SAGLAYICISI ISTEMCISI
//
// Standart SMM API'sinden (action=add/status, form govdesi) tamamen farkli
// bir REST API'dir; bu yuzden services/smmProvider.js'e karistirilmadi:
//   - kimlik: her istekte X-API-Key basligi
//   - temel adres: or. https://saglayici.com/api/v1 (uclar bunun altinda)
//   - yanit: { success: true, data: ... } | { success: false, error|message }
//   - GET /profile, /balance, /categories, /products, /products/{slug}
//   - POST /buy { product_id, quantity } -> teslimat bilgileri yanitta
//   - GET /orders/{order_id}  (pending siparisin takibi)
//   - POST /gmail-check { emails, request_id }
//
// HATA TURU (buy icin onemli): saglayici yanit verdiyse (4xx / success:false)
// islem kesin olarak gerceklesmemistir -> err.definite = true. Ag hatasi,
// zaman asimi veya 5xx'te siparis olusmus olabilir -> err.definite = false;
// cagiran yoneticiyi uyarir (bkz. digitalStore.purchase).

const axios = require('axios');
const { assertPublicProviderUrl, safeRequestConfig } = require('../utils/network');
const { normalizePlainText } = require('../utils/security');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function providerError(message, { definite = true, status = null } = {}) {
  const err = new Error(message);
  err.isProviderError = true;
  err.definite = definite;
  err.providerStatus = status;
  return err;
}

// Saglayici hata metni farkli alanlarda gelebilir: error (metin ya da
// { message }), message, errors[0].
function messageFrom(body, fallback) {
  if (!body || typeof body !== 'object') return fallback;
  const candidates = [
    typeof body.error === 'string' ? body.error : body.error?.message,
    body.message,
    Array.isArray(body.errors) ? (body.errors[0]?.message || body.errors[0]) : null
  ];
  const found = candidates.find(item => typeof item === 'string' && item.trim());
  return found ? normalizePlainText(found, 300) : fallback;
}

function toInt(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

/** Saglayici urununu panelin kullandigi sade bicime cevirir. */
function normalizeProduct(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id ?? raw.product_id ?? raw.slug;
  if (id === undefined || id === null || String(id).trim() === '') return null;
  const price = Number(raw.price);
  return {
    provider_product_id: String(id).trim().slice(0, 120),
    slug: normalizePlainText(String(raw.slug ?? id), 160),
    name: normalizePlainText(String(raw.name || ''), 220) || `Ürün #${id}`,
    category: normalizePlainText(String(raw.category?.name ?? raw.category ?? ''), 120),
    price: Number.isFinite(price) && price >= 0 ? price : null,
    stock: toInt(raw.stock),
    format: normalizePlainText(String(raw.format || ''), 120),
    delivery_time: normalizePlainText(String(raw.delivery_time || ''), 80),
    warranty_hours: Math.max(0, toInt(raw.warranty_hours, 0)),
    min: Math.max(1, toInt(raw.min, 1)),
    max: Math.max(1, toInt(raw.max, 100)),
    description: normalizePlainText(String(raw.description || ''), 5000),
    usage: normalizePlainText(String(raw.usage || ''), 5000)
  };
}

class DigitalProviderClient {
  constructor(apiUrl, apiKey) {
    this.baseUrl = String(apiUrl || '').trim().replace(/\/+$/, '');
    this.apiKey = String(apiKey || '');
  }

  async request(method, endpoint, { params, body, timeout = 20000 } = {}) {
    await assertPublicProviderUrl(this.baseUrl);
    let response;
    try {
      response = await axios(safeRequestConfig({
        method,
        url: `${this.baseUrl}${endpoint}`,
        params,
        data: body,
        timeout,
        headers: {
          'X-API-Key': this.apiKey,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT
        }
      }));
    } catch (err) {
      if (err.response) {
        const status = err.response.status;
        throw providerError(messageFrom(err.response.data, `Sağlayıcı ${status} hatası döndürdü.`), {
          // 5xx'te islemin saglayicida yapilip yapilmadigi bilinemez.
          definite: status < 500,
          status
        });
      }
      throw providerError(`Sağlayıcıya ulaşılamadı (${err.code || err.message}).`, { definite: false });
    }
    const data = response.data;
    if (!data || typeof data !== 'object') {
      throw providerError('Sağlayıcı geçersiz bir yanıt döndürdü.', { definite: false, status: response.status });
    }
    if (data.success === false) {
      throw providerError(messageFrom(data, 'Sağlayıcı isteği reddetti.'), { status: response.status });
    }
    return data.data !== undefined ? data.data : data;
  }

  async getProfile() {
    const data = await this.request('GET', '/profile', { timeout: 10000 });
    return {
      username: normalizePlainText(String(data?.username || ''), 100),
      balance: Number(data?.balance),
      currency: normalizePlainText(String(data?.currency || 'USD'), 10).toUpperCase() || 'USD'
    };
  }

  async getCategories() {
    const data = await this.request('GET', '/categories', { timeout: 10000 });
    return (Array.isArray(data) ? data : []).map(item => ({
      name: normalizePlainText(String(item?.name || ''), 120),
      slug: normalizePlainText(String(item?.slug || ''), 120),
      products: toInt(item?.products, 0)
    })).filter(item => item.name);
  }

  /** Tek sayfa urun (en fazla 50). */
  async listProducts(params = {}) {
    const data = await this.request('GET', '/products', { params });
    const list = Array.isArray(data?.products) ? data.products : (Array.isArray(data) ? data : []);
    const pagination = data?.pagination || {};
    return {
      products: list.map(normalizeProduct).filter(Boolean),
      page: Math.max(1, toInt(pagination.page, 1)),
      totalPages: Math.max(1, toInt(pagination.total_page ?? pagination.total_pages, 1)),
      total: toInt(pagination.total, list.length)
    };
  }

  /** Katalogun tamami (sayfa sayfa; sonsuz donguye karsi ust sinirli). */
  async listAllProducts({ maxPages = 40, ...params } = {}) {
    const all = [];
    let page = 1;
    let totalPages = 1;
    do {
      const result = await this.listProducts({ ...params, page });
      all.push(...result.products);
      totalPages = result.totalPages;
      if (!result.products.length) break;
      page += 1;
    } while (page <= totalPages && page <= maxPages);
    return all;
  }

  async getProduct(slug) {
    const data = await this.request('GET', `/products/${encodeURIComponent(String(slug))}`, { timeout: 10000 });
    return normalizeProduct(data);
  }

  /**
   * Satin alma. Tutar saglayicidaki bakiyemizden duser.
   * @returns {{order_id, status, quantity, total, balance, items: string[], usage}}
   */
  async buy(productId, quantity) {
    const data = await this.request('POST', '/buy', {
      body: { product_id: productId, quantity },
      timeout: 60000
    });
    return normalizeOrder(data);
  }

  async getOrder(orderId) {
    const data = await this.request('GET', `/orders/${encodeURIComponent(String(orderId))}`, { timeout: 15000 });
    return normalizeOrder(data);
  }

  /**
   * Toplu Gmail durum sorgusu. Ayni request_id ile tekrar edilen istek
   * saglayicida ikinci kez ucretlendirilmez; ag hatasinda guvenle yinelenir.
   */
  async gmailCheck(emails, requestId) {
    const data = await this.request('POST', '/gmail-check', {
      body: { emails, request_id: requestId },
      timeout: 120000
    });
    const results = (Array.isArray(data?.results) ? data.results : []).map(item => ({
      email: normalizePlainText(String(item?.email || ''), 254).toLowerCase(),
      status: CHECK_STATUSES.has(String(item?.status)) ? String(item.status) : 'unknown'
    })).filter(item => item.email);
    const cost = Number(data?.billing?.cost);
    return { results, cost: Number.isFinite(cost) ? cost : null };
  }
}

const CHECK_STATUSES = new Set(['live', 'verified', 'disabled', 'notexists', 'unknown']);
const ORDER_STATUSES = new Set(['completed', 'pending', 'failed', 'refunded']);

function normalizeOrder(data) {
  const status = String(data?.status || '').toLowerCase();
  const total = Number(data?.total);
  return {
    order_id: data?.order_id !== undefined && data?.order_id !== null ? String(data.order_id).slice(0, 120) : null,
    // Tanimsiz durum "pending" sayilir: siparis izlemeye alinir, iade edilmez.
    status: ORDER_STATUSES.has(status) ? status : 'pending',
    quantity: toInt(data?.quantity),
    total: Number.isFinite(total) ? total : null,
    items: (Array.isArray(data?.items) ? data.items : [])
      .map(item => (typeof item === 'string' ? item : JSON.stringify(item)))
      .map(item => String(item).replace(/\r/g, '').trim().slice(0, 2000))
      .filter(Boolean),
    usage: normalizePlainText(String(data?.usage || ''), 5000)
  };
}

module.exports = { DigitalProviderClient, normalizeProduct, normalizeOrder, CHECK_STATUSES };
