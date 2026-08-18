'use strict';

// Arama motoru dogrulama kodlarini normallestirir.
//
// Admin panelindeki alana kullanicinin ne yapistiracagi belli olmaz:
//   - sade kod:        1A2B3C4D5E6F...
//   - tam meta etiketi: <meta name="msvalidate.01" content="1A2B..." />
//   - Bing'in verdigi XML dosyasinin icerigi: <?xml ...?><users><user>1A2B...</user></users>
// Bing dogrulama sayfasinda ucunu de yan yana gosterdigi icin hangisinin
// kopyalandigi tahmin edilemez; hepsinden kodu ayikliyoruz.

// Kod hicbir zaman bosluk ya da HTML karakteri icermez. Temizlik ayni zamanda
// degerin meta etiketine enjeksiyonunu (tirnak kacisi) engeller.
function clean(value) {
  return String(value == null ? '' : value)
    .replace(/[<>"'\s]/g, '')
    .slice(0, 200);
}

function extractVerificationCode(raw) {
  const value = String(raw == null ? '' : raw).trim();
  if (!value) return '';

  const metaTag = value.match(/content\s*=\s*["']([^"']+)["']/i);
  if (metaTag) return clean(metaTag[1]);

  const xmlFile = value.match(/<user>([\s\S]*?)<\/user>/i);
  if (xmlFile) return clean(xmlFile[1]);

  return clean(value);
}

// Google Analytics olcum kimligi. Google kurulum ekraninda kimligi degil,
// gtag.js kod blogunun tamamini kopyalatir; admin de dogal olarak onu
// yapistirir. Blogun icinden kimligi cekiyoruz.
//   G-XXXXXXX  (GA4)  |  UA-12345-1 (eski)  |  AW-123456 (Ads)
const ANALYTICS_ID = /\b((?:G|AW)-[A-Z0-9]{6,18}|UA-\d{4,12}-\d{1,4})\b/i;

function extractAnalyticsId(raw) {
  const value = String(raw == null ? '' : raw).trim();
  if (!value) return '';
  const found = value.match(ANALYTICS_ID);
  if (!found) return '';
  // G-/AW- kimlikleri buyuk harfle yazilir; kucuk yazilirsa Google eslestiremez.
  return found[1].toUpperCase();
}

module.exports = { extractVerificationCode, extractAnalyticsId };
