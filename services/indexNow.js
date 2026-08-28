'use strict';

// IndexNow: yeni/guncellenen sayfalari Bing'e (ve protokolu destekleyen
// diger motorlara) aninda bildirir. ChatGPT web aramasi Bing dizinine
// dayandigi icin blog yayinlarinin AI aramalarinda gorunmesini hizlandirir.
//
// Anahtar: INDEXNOW_KEY env degiskeninden okunur; tanimli degilse
// JWT_SECRET'tan turetilen sabit bir anahtar kullanilir (sunucu yeniden
// baslasa da degismez — Bing anahtarin /{key}.txt adresinde durmasini ister).

const crypto = require('crypto');
const axios = require('axios');

function indexNowKey() {
  if (process.env.INDEXNOW_KEY) return String(process.env.INDEXNOW_KEY).trim();
  const secret = process.env.JWT_SECRET || 'development-only-change-this-secret-2026';
  return crypto.createHash('sha256').update(`indexnow:${secret}`).digest('hex').slice(0, 32);
}

/**
 * URL listesini IndexNow'a gonderir. Hata durumunda sessizce loglar;
 * yayinlama akisini asla bloklamaz veya bozmaz.
 * @param {string[]} urls Mutlak adresler (ayni host'a ait olmali)
 */
async function submitToIndexNow(urls) {
  try {
    const base = String(process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
    // Taban adres yoksa (yerel gelistirme) bildirim anlamsizdir.
    if (!base || !Array.isArray(urls) || !urls.length) return false;
    const host = new URL(base).host;
    const key = indexNowKey();
    const res = await axios.post('https://api.indexnow.org/indexnow', {
      host,
      key,
      keyLocation: `${base}/${key}.txt`,
      urlList: urls.slice(0, 100)
    }, { timeout: 10000, validateStatus: () => true });
    // 200/202 basari sayilir; digerleri yalnizca loglanir.
    if (res.status !== 200 && res.status !== 202) {
      console.warn(`IndexNow bildirimi reddedildi: HTTP ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('IndexNow bildirimi gonderilemedi:', err.message);
    return false;
  }
}

/** Blog yayinlandiginda/guncellendiginde cagrilir: yazi + liste sayfalari. */
function notifyBlogPublished(slug) {
  const base = String(process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (!base) return;
  const urls = [`${base}/blog/${encodeURIComponent(slug)}`, `${base}/blog`, `${base}/sitemap.xml`];
  // Beklenmez (fire-and-forget): yayinlama yanitini geciktirmemeli.
  submitToIndexNow(urls.slice(0, 2)).catch(() => {});
}

/** Satis sayfasi (landing page) yayinlandiginda/guncellendiginde cagrilir. */
function notifyLandingPagePublished(slug) {
  const base = String(process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (!base) return;
  submitToIndexNow([`${base}/${encodeURIComponent(slug)}`, `${base}/services`]).catch(() => {});
}

module.exports = { indexNowKey, submitToIndexNow, notifyBlogPublished, notifyLandingPagePublished };
