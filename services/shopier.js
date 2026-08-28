const crypto = require('crypto');
const axios = require('axios');
const { dbAsync } = require('../config/database');
const { encryptSecret, decryptSecret } = require('../utils/security');

// Shopier REST API. Kisisel Erisim Anahtari (PAT) ile KENDI satici hesabimiza
// erisiriz — sozlesmenin 4.7. maddesi bu kullanimi acikca kapsar.
//
// AKIS: Shopier'in "odeme baslat" diye bir ucu YOK. Bunun yerine her bakiye
// yuklemesi icin magazada gecici bir urun olustururuz, musteriyi o urunun
// sayfasina yollariz, odeme bitince order.created webhook'u gelir ve urunu
// sileriz. Urun kimligi payment_intents.provider_ref'te tutulur; webhook'u
// dogru kullaniciyla bu sayede eslestiririz (Shopier'de urune/siparise kendi
// referansimizi yazacak alan yok).
// Adres cagri aninda okunur (modul yuklenirken degil): testler sahte bir
// Shopier sunucusuna yonlendirebilsin diye.
function apiBase() {
  return String(process.env.SHOPIER_API_BASE || 'https://api.shopier.com/v1').replace(/\/$/, '');
}

// ---------------------------------------------------------------------------
// YAPILANDIRMA
// PAT hesaba "suresiz ve sinirsiz" erisim verdigi icin (Shopier'in kendi
// uyarisi) duz metin saklanmaz; site_settings'e sifreli yazilir.
// ---------------------------------------------------------------------------
const SETTING_KEYS = ['shopier_pat', 'shopier_webhook_token', 'shopier_webhook_id', 'shopier_product_image_url'];

async function readSettings() {
  const rows = await dbAsync.all(
    `SELECT key, value FROM site_settings WHERE key IN (${SETTING_KEYS.map(() => '?').join(',')})`,
    SETTING_KEYS
  );
  const stored = {};
  rows.forEach(row => { stored[row.key] = row.value; });
  return stored;
}

// Sifresi cozulemeyen deger (anahtar rotasyonu, elle duzenleme) akisi
// cokertmemeli; bos sayilir ve yontem kapali gorunur.
function decryptOrEmpty(value) {
  if (!value) return '';
  try {
    return decryptSecret(value);
  } catch {
    return '';
  }
}

async function getConfig() {
  const stored = await readSettings();
  return {
    pat: decryptOrEmpty(stored.shopier_pat) || String(process.env.SHOPIER_PAT || '').trim(),
    webhookToken: decryptOrEmpty(stored.shopier_webhook_token) || String(process.env.SHOPIER_WEBHOOK_TOKEN || '').trim(),
    webhookId: String(stored.shopier_webhook_id || '').trim(),
    productImage: String(stored.shopier_product_image_url || '').trim(),
    baseUrl: String(process.env.PUBLIC_BASE_URL || '').trim()
  };
}

async function saveSecret(key, plainValue) {
  const value = plainValue ? encryptSecret(plainValue) : '';
  await dbAsync.run(
    `INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

async function savePlain(key, value) {
  await dbAsync.run(
    `INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, String(value || '')]
  );
}

// Odeme yontemi ancak anahtar VE webhook birlikte hazirsa acilir: webhook
// olmadan odeme alinir ama bakiye hic yuklenmez — en kotu senaryo budur.
async function isConfigured() {
  const config = await getConfig();
  return Boolean(config.pat && config.webhookToken && config.baseUrl);
}

async function getStatus() {
  const config = await getConfig();
  return {
    pat_saved: Boolean(config.pat),
    webhook_registered: Boolean(config.webhookToken && config.webhookId),
    webhook_id: config.webhookId || null,
    base_url_set: Boolean(config.baseUrl),
    product_image_url: config.productImage || null,
    ready: Boolean(config.pat && config.webhookToken && config.baseUrl)
  };
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
function configError(message) {
  const error = new Error(message);
  error.status = 503;
  return error;
}

async function request(method, path, { body, pat } = {}) {
  const token = pat || (await getConfig()).pat;
  if (!token) throw configError('Shopier ödemesi henüz yapılandırılmamış. Admin panelinden Kişisel Erişim Anahtarını ekleyin.');

  const response = await axios({
    method,
    url: `${apiBase()}${path}`,
    data: body,
    timeout: 20000,
    maxContentLength: 1024 * 1024,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    validateStatus: () => true
  });

  if (response.status >= 400) {
    const raw = String(response.data?.message || response.data?.error || '');
    let error;
    if (response.status === 401 || response.status === 403) {
      error = new Error('Shopier Kişisel Erişim Anahtarı geçersiz veya yetkisiz. Admin panelinden anahtarı yenileyin.');
    } else if (response.status === 429) {
      error = new Error('Shopier istek sınırına takıldı, lütfen birkaç saniye sonra tekrar deneyin.');
    } else {
      error = new Error(raw ? `Shopier hatası: ${raw}` : `Shopier ${path} isteği başarısız (HTTP ${response.status}).`);
    }
    // 400 verilir ki errorHandler mesaji musteriye aynen iletsin (500'ler
    // genel mesaja cevriliyor).
    error.status = 400;
    throw error;
  }
  return response.data;
}

// ---------------------------------------------------------------------------
// WEBHOOK ABONELIGI
// Panelden degil API'den kurulur; imza anahtari (token) YALNIZCA olusturma
// yanitinda bir kez doner, o yuzden hemen sifreli kaydedilir.
// ---------------------------------------------------------------------------
async function registerWebhook(patOverride) {
  const config = await getConfig();
  const pat = patOverride || config.pat;
  if (!pat) throw configError('Önce Kişisel Erişim Anahtarını kaydedin.');
  if (!config.baseUrl) throw configError('PUBLIC_BASE_URL ayarlanmadan webhook kurulamaz (ödeme onayı bu adrese gelir).');

  const url = `${config.baseUrl.replace(/\/$/, '')}/api/payments/shopier/webhook`;

  // Ayni adrese ikinci bir abonelik birakmayalim: varsa once temizlenir.
  await removeWebhook(pat).catch(() => {});

  const created = await request('post', '/webhooks', { pat, body: { event: 'order.created', url } });
  if (!created?.token) {
    const error = new Error('Shopier webhook aboneliği oluşturuldu ama imza anahtarı (token) dönmedi. Aboneliği silip tekrar deneyin.');
    error.status = 502;
    throw error;
  }
  await saveSecret('shopier_webhook_token', String(created.token));
  await savePlain('shopier_webhook_id', String(created.id || ''));
  return { id: created.id, url, event: created.event || 'order.created' };
}

async function removeWebhook(patOverride) {
  const config = await getConfig();
  const pat = patOverride || config.pat;
  if (!pat || !config.webhookId) return false;
  await request('delete', `/webhooks/${encodeURIComponent(config.webhookId)}`, { pat });
  await saveSecret('shopier_webhook_token', '');
  await savePlain('shopier_webhook_id', '');
  return true;
}

// ---------------------------------------------------------------------------
// IMZA DOGRULAMA
// Shopier webhook govdesini HS256 (HMAC-SHA256) ile imzalar ve Shopier-Signature
// basliginda gonderir. Kodlamanin hex mi base64 mu oldugu dokumanda yazmiyor;
// ikisi de ayni HMAC'ten turedigi icin her iki bicim de sabit surede denenir.
// ---------------------------------------------------------------------------
function timingSafeEqualString(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function verifyWebhookSignature(rawBody, signatureHeader, token) {
  if (!token || !signatureHeader || !rawBody) return false;
  // Bazi gonderimlerde imza "sha256=..." onekiyle gelir.
  const provided = String(signatureHeader).replace(/^sha256=/i, '').trim();
  const mac = crypto.createHmac('sha256', token).update(rawBody);
  const digest = mac.digest();
  return timingSafeEqualString(provided, digest.toString('hex'))
    || timingSafeEqualString(provided, digest.toString('base64'));
}

async function verifyWebhook(rawBody, signatureHeader) {
  const config = await getConfig();
  return verifyWebhookSignature(rawBody, signatureHeader, config.webhookToken);
}

// ---------------------------------------------------------------------------
// ÖDEME: GEÇİCİ ÜRÜN
// ---------------------------------------------------------------------------
// Urun gorseli zorunlu ve Shopier onu kendi CDN'ine kopyalar.
//
// DIKKAT — public/shopier-product.png ELLE HAZIRLANMIS bir dosyadir, betikle
// URETILMEZ. Once paylasim gorseli (og-image.png), sonra kendi PNG yazicimizla
// urettigimiz kare/saydamliksiz bir ikon denendi; Shopier ikisini de indirdi
// (nginx kaydinda "Shopier" UA ile 200) ama CDN kopyalari 404 kaldi.
// Calisan dosyayla karsilastirinca fark ortaya cikti: ikisi de 8 bit RGB ve
// interlace edilmemisti, tek fark bizim yazicinin tek buyuk IDAT blogu
// uretmesiydi (normal kutuphane ciktisi 64 KB'lik bloklara boler).
// Yani sorun oran veya alfa degil, kendi PNG yazicimiz.
// Bu dosyayi scripts/make-og-image.js benzeri bir uretecle YENIDEN URETME;
// gorsel Shopier'de kirik cikar.
//
// GORSELI DEGISTIRIRKEN DOSYA ADINI DA DEGISTIR: Cloudflare bu adresi
// onbellege aliyor ve ayni adla yuklenen yeni dosya disariya (dolayisiyla
// Shopier'e) gunlerce eski haliyle gidiyor.
function productImageUrl(config) {
  // Shopier, bizim sunucumuzdan URL ile cekilen gorseli isleyemiyor (CDN
  // kopyasi 404 kaliyor). Admin, Shopier'in KENDI CDN'indeki (cdn.shopier.app)
  // calisan bir gorselin adresini ayara girerse o kullanilir — Shopier kendi
  // sunucusundan aldigi icin isleme sorunu olmaz. Ayar bossa kendi dosyamiza
  // duseriz (en azindan gecerli bir gorsel gider).
  if (config.productImage) return config.productImage;
  return `${config.baseUrl.replace(/\/$/, '')}/shopier-urun-logo.png`;
}

/**
 * Bakiye yuklemesi icin gecici bir urun olusturur.
 * @returns {{productId: string, url: string}} musterinin yonlendirilecegi adres
 */
async function createTopUpProduct({ amountKurus, merchantOid }) {
  const config = await getConfig();
  if (!config.pat) throw configError('Shopier ödemesi henüz yapılandırılmamış. Admin panelinden Kişisel Erişim Anahtarını ekleyin.');
  if (!config.webhookToken) throw configError('Shopier webhook kaydı yapılmadan ödeme alınamaz (ödeme onayı gelmez, bakiye yüklenmez).');
  if (!config.baseUrl) throw configError('PUBLIC_BASE_URL ayarlanmadan Shopier ödemesi alınamaz.');

  const amount = (amountKurus / 100).toFixed(2);
  const product = await request('post', '/products', {
    body: {
      title: `Bakiye Yükleme ₺${amount}`,
      type: 'digital',
      // Bu metin Shopier'de HERKESE ACIK urun sayfasinda gorunur; kullanici
      // adi buraya yazilmaz. Referans opak bir jetondur, destek icin kalir.
      description: `Jet SMM Panel bakiye yüklemesi. Ödeme onaylandığında bakiyeniz otomatik yüklenir. Referans: ${merchantOid}`,
      media: [{ type: 'image', url: productImageUrl(config), placement: 1 }],
      priceData: { currency: 'TRY', price: amount },
      // Dijital urun; kargo yok ama alan zorunlu.
      shippingPayer: 'sellerPays',
      // Tek kullanimlik: ayni urunden ikinci bir alim yapilamasin.
      stockQuantity: 1
    }
  });

  const productId = product?.id;
  const url = product?.url;
  if (!productId || !url) {
    const error = new Error('Shopier ödeme sayfası oluşturulamadı (ürün kimliği veya adresi dönmedi).');
    error.status = 502;
    throw error;
  }
  return { productId: String(productId), url: String(url) };
}

// Odeme bitince (veya yarim kalinca) gecici urun magazadan silinir; aksi halde
// dukkanda yuzlerce "Bakiye Yukleme" urunu birikir. Hata yutulur: temizlik
// basarisiz olsa da odeme akisi etkilenmemeli.
async function deleteProduct(productId) {
  if (!productId) return false;
  try {
    await request('delete', `/products/${encodeURIComponent(productId)}`);
    return true;
  } catch (err) {
    console.error('Shopier ürün silinemedi:', productId, err.message);
    return false;
  }
}

/**
 * Odenmeden birakilmis eski yuklemelerin urunlerini toplar.
 * Ayri bir zamanlanmis is kurmamak icin yeni odeme baslatilirken cagrilir;
 * her seferinde en fazla `limit` kayit islenir.
 */
async function sweepAbandonedProducts(limit = 10) {
  const stale = await dbAsync.all(
    `SELECT id, provider_ref FROM payment_intents
     WHERE provider = 'shopier' AND status = 'pending' AND provider_ref IS NOT NULL
       AND created_at < datetime('now', '-1 day')
     ORDER BY id ASC LIMIT ?`,
    [limit]
  );
  let cleaned = 0;
  for (const intent of stale) {
    const removed = await deleteProduct(intent.provider_ref);
    // Silinsin ya da silinmesin tekrar denememek icin niyet kapatilir.
    await dbAsync.run(
      "UPDATE payment_intents SET status = 'failed', failure_reason = ?, provider_ref = NULL WHERE id = ? AND status = 'pending'",
      ['Ödeme tamamlanmadı (süresi doldu).', intent.id]
    );
    if (removed) cleaned++;
  }
  return cleaned;
}

// Admin panelinden urun gorseli adresini (Shopier CDN veya baska bir URL)
// kaydeder. Bos deger fallback'e (kendi dosyamiza) doner.
async function setProductImage(url) {
  await savePlain('shopier_product_image_url', String(url || '').trim());
  return (await getConfig()).productImage;
}

module.exports = {
  apiBase,
  getConfig, isConfigured, getStatus, saveSecret, savePlain,
  registerWebhook, removeWebhook,
  verifyWebhookSignature, verifyWebhook,
  createTopUpProduct, deleteProduct, sweepAbandonedProducts, setProductImage
};
