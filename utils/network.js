const dns = require('dns');
const dnsPromises = require('dns').promises;
const net = require('net');
const http = require('http');
const https = require('https');

function normalizeIp(address) {
  const value = String(address || '').trim().toLowerCase();
  // IPv4-mapped IPv6 (::ffff:10.0.0.1) IPv4 olarak degerlendirilmelidir.
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? mapped[1] : value;
}

function isPrivateIp(address) {
  const value = normalizeIp(address);

  if (net.isIPv4(value)) {
    const [a, b] = value.split('.').map(Number);
    return a === 0 // "bu ag"
      || a === 10 // ozel
      || a === 127 // loopback
      || (a === 100 && b >= 64 && b <= 127) // CGNAT
      || (a === 169 && b === 254) // link-local / bulut metadata
      || (a === 172 && b >= 16 && b <= 31) // ozel
      || (a === 192 && b === 0) // IETF protokol tahsisleri
      || (a === 192 && b === 168) // ozel
      || (a === 198 && b >= 18 && b <= 19) // kiyaslama
      || a >= 224; // multicast + ayrilmis
  }

  if (net.isIPv6(value)) {
    return value === '::' // belirtilmemis
      || value === '::1' // loopback
      || value.startsWith('fe80:') // link-local
      || value.startsWith('fc') || value.startsWith('fd') // benzersiz yerel
      || value.startsWith('ff'); // multicast
  }

  // Cozulemeyen bir deger guvenli sayilmaz.
  return true;
}

function allowsPrivateTargets() {
  return process.env.NODE_ENV !== 'production' && process.env.ALLOW_PRIVATE_PROVIDER_URLS === 'true';
}

async function assertPublicProviderUrl(value) {
  const parsed = new URL(value);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Sağlayıcı adresi HTTP veya HTTPS olmalıdır.');
  const records = await dnsPromises.lookup(parsed.hostname, { all: true });
  if (!allowsPrivateTargets() && records.some(record => isPrivateIp(record.address))) {
    throw new Error('Özel ağ ve localhost sağlayıcı adreslerine izin verilmiyor.');
  }
  return parsed.toString();
}

/**
 * Baglanti kurulmadan hemen once cozulen IP'yi yeniden dogrular.
 * assertPublicProviderUrl ile gercek istek arasindaki DNS rebinding
 * (TOCTOU) penceresini kapatir.
 */
function guardedLookup(hostname, options, callback) {
  const done = typeof options === 'function' ? options : callback;
  const opts = typeof options === 'function' ? {} : options;

  dns.lookup(hostname, { ...opts, all: true }, (err, records) => {
    if (err) return done(err);
    const list = Array.isArray(records) ? records : [records];
    if (!allowsPrivateTargets()) {
      const blocked = list.find(record => isPrivateIp(record.address));
      if (blocked) {
        return done(Object.assign(
          new Error(`Özel ağ adresine bağlantı engellendi (${hostname} → ${blocked.address}).`),
          { code: 'EBLOCKEDADDRESS' }
        ));
      }
    }
    if (opts.all) return done(null, list);
    return done(null, list[0].address, list[0].family);
  });
}

/**
 * Birebir IP hedeflerini baglanti kurulmadan once reddeder.
 * Node, host bir IP literali oldugunda DNS lookup'ini atladigi icin
 * guardedLookup bu durumda devreye girmez; bosluk burada kapatilir.
 */
function guardedCreateConnection(baseCreateConnection) {
  return function (options, callback) {
    const host = String(options.host || '').replace(/^\[|\]$/g, '');
    if (!allowsPrivateTargets() && net.isIP(host) && isPrivateIp(host)) {
      const error = Object.assign(
        new Error(`Özel ağ adresine bağlantı engellendi (${host}).`),
        { code: 'EBLOCKEDADDRESS' }
      );
      if (typeof callback === 'function') {
        process.nextTick(() => callback(error));
        return undefined;
      }
      throw error;
    }
    return baseCreateConnection(options, callback);
  };
}

const httpAgent = new http.Agent({ lookup: guardedLookup });
const httpsAgent = new https.Agent({ lookup: guardedLookup });
httpAgent.createConnection = guardedCreateConnection(httpAgent.createConnection.bind(httpAgent));
httpsAgent.createConnection = guardedCreateConnection(httpsAgent.createConnection.bind(httpsAgent));

/**
 * Her yonlendirme adiminda hedefi dogrular.
 *
 * Node, adres birebir IP ise (or. http://127.0.0.1/) DNS lookup'ini tamamen
 * atlar; bu yuzden agent uzerindeki guardedLookup tek basina yeterli degildir.
 * Burada protokol ve birebir IP hedefleri senkron olarak reddedilir, hostname
 * ile gelen hedefleri ise baglanti aninda guardedLookup yakalar.
 */
function assertRedirectAllowed(options) {
  const protocol = String(options.protocol || '').toLowerCase();
  if (!['http:', 'https:'].includes(protocol)) {
    throw Object.assign(new Error(`Yönlendirme reddedildi: ${protocol} protokolüne izin verilmiyor.`), { code: 'EBLOCKEDREDIRECT' });
  }
  if (allowsPrivateTargets()) return;
  const host = String(options.hostname || options.host || '').replace(/^\[|\]$/g, '');
  if (net.isIP(host) && isPrivateIp(host)) {
    throw Object.assign(new Error(`Yönlendirme reddedildi: özel ağ adresi (${host}).`), { code: 'EBLOCKEDREDIRECT' });
  }
}

/**
 * Dis servislere yapilan tum axios istekleri icin guvenli varsayilanlar.
 *
 * Iki katmanli SSRF korumasi:
 *  - beforeRedirect: her yonlendirme hedefinin protokolunu ve birebir IP'sini dogrular.
 *  - agent lookup:  hostname ile gelen hedeflerde cozulen IP'yi baglanti aninda dogrular
 *                   (DNS rebinding / TOCTOU penceresini kapatir).
 * Yonlendirme sayisi sinirlidir; http->https gibi mesru yonlendirmeler calisir.
 */
function safeRequestConfig(extra = {}) {
  return {
    ...extra,
    maxRedirects: 3,
    beforeRedirect: assertRedirectAllowed,
    httpAgent,
    httpsAgent
  };
}

module.exports = { assertPublicProviderUrl, isPrivateIp, safeRequestConfig, guardedLookup, assertRedirectAllowed };
