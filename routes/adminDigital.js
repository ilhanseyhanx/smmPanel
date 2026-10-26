'use strict';

// DIJITAL URUN YONETIMI (admin) — /api/admin/digital
// Kimlik + admin yetkisi server.js'te bu router'a baglanirken uygulanir.
//
// Akis: saglayici eklenir (baglanti /profile ile dogrulanir, anahtar sifreli
// saklanir) -> saglayici katalogundan urunler TEK TEK secilip TL fiyatla
// magazaya eklenir -> satislar, iadeler ve Gmail Checker ayari buradan.

const express = require('express');
const { z } = require('zod');
const { dbAsync } = require('../config/database');
const { validate } = require('../middleware/validate');
const { toKurus, fromKurus } = require('../utils/money');
const { encryptSecret, decryptSecret, normalizePlainText, isSafeHttpUrl } = require('../utils/security');
const { DigitalProviderClient } = require('../services/digitalProvider');
const Store = require('../services/digitalStore');

const router = express.Router();

function idParam(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'Geçersiz kayıt numarası.' });
  req.recordId = id;
  next();
}

function sendError(res, err, next) {
  if (!err.expose || !err.status) return next(err);
  return res.status(err.status).json({ error: err.message, code: err.code });
}

async function audit(req, action, entityId, details) {
  await dbAsync.run(
    'INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
    [req.user.id, action, 'digital', String(entityId), JSON.stringify(details || {}), req.ip]
  ).catch(() => {});
}

function maskKey(provider) {
  try {
    const key = decryptSecret(provider.api_key_encrypted);
    return key.length > 6 ? `••••${key.slice(-4)}` : '••••';
  } catch {
    return '(çözülemedi)';
  }
}

function publicProvider(p) {
  return {
    id: p.id,
    name: p.name,
    api_url: p.api_url,
    api_key_hint: maskKey(p),
    status: p.status,
    balance: p.balance,
    currency: p.currency || 'USD',
    balance_checked_at: p.balance_checked_at,
    created_at: p.created_at,
    product_count: p.product_count ?? undefined
  };
}

// Katalog onbellegi: explorer'da arama/sayfa gezinirken saglayiciya her
// seferinde 40 sayfa istek atilmasin.
const catalogCache = new Map();
async function providerCatalog(provider, { force = false } = {}) {
  const cached = catalogCache.get(provider.id);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.items;
  const items = await Store.clientFor(provider).listAllProducts();
  catalogCache.set(provider.id, { items, expiresAt: Date.now() + 2 * 60 * 1000 });
  return items;
}

// ---------------------------------------------------------------------------
// GENEL BAKIS
// ---------------------------------------------------------------------------

router.get('/overview', async (req, res, next) => {
  try {
    const [orders, byStatus, costs, checks, products, fx] = await Promise.all([
      dbAsync.get(`SELECT COUNT(*) n, COALESCE(SUM(charge_kurus - refunded_kurus), 0) net_kurus, COALESCE(SUM(quantity), 0) items
                     FROM digital_orders WHERE status IN ('completed', 'processing', 'refunded')`),
      dbAsync.all('SELECT status, COUNT(*) n FROM digital_orders GROUP BY status'),
      // Saglayiciya odenen gercek tutar (iade ettigimiz siparisler dahil,
      // cunku saglayici o parayi bize geri vermez).
      dbAsync.all(`SELECT COALESCE(cost_currency, 'USD') currency, COALESCE(SUM(provider_total), 0) total
                     FROM digital_orders WHERE status IN ('completed', 'processing', 'refunded') AND provider_total IS NOT NULL
                    GROUP BY COALESCE(cost_currency, 'USD')`),
      dbAsync.get(`SELECT COUNT(*) n, COALESCE(SUM(checked_count), 0) emails, COALESCE(SUM(charge_kurus - refunded_kurus), 0) net_kurus,
                          COALESCE(SUM(provider_cost), 0) cost
                     FROM digital_checks WHERE status = 'completed'`),
      dbAsync.get('SELECT COUNT(*) total, SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) active FROM digital_products'),
      require('../services/fx').getUsdTry()
    ]);
    const rate = Number(fx.rate) || 0;
    const costTry = costs.reduce((sum, row) => sum + (row.currency === 'TRY' ? Number(row.total) : Number(row.total) * rate), 0);
    const revenueTry = fromKurus(orders.net_kurus);
    res.json({
      orders: {
        count: orders.n,
        items: orders.items,
        revenue: revenueTry,
        cost_try: Math.round(costTry * 100) / 100,
        profit: Math.round((revenueTry - costTry) * 100) / 100,
        by_status: Object.fromEntries(byStatus.map(r => [r.status, r.n]))
      },
      checks: { count: checks.n, emails: checks.emails, revenue: fromKurus(checks.net_kurus), cost: checks.cost },
      products: { total: products.total || 0, active: products.active || 0 },
      usd_try: rate
    });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// SAGLAYICILAR
// ---------------------------------------------------------------------------

const providerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  api_url: z.string().trim().min(8).max(500),
  api_key: z.string().trim().min(4).max(500)
});

router.get('/providers', async (req, res, next) => {
  try {
    const rows = await dbAsync.all(`SELECT p.*, (SELECT COUNT(*) FROM digital_products d WHERE d.provider_id = p.id) product_count
                                      FROM digital_providers p ORDER BY p.id DESC`);
    res.json({ providers: rows.map(publicProvider) });
  } catch (err) { next(err); }
});

// Baglanti test edilmeden kayit yapilmaz: yanlis adres/anahtar sessizce
// kaydedilip satis aninda patlamasin.
async function testConnection(apiUrl, apiKey) {
  try {
    return await new DigitalProviderClient(apiUrl, apiKey).getProfile();
  } catch (err) {
    throw Store.httpError(400, `Sağlayıcıya bağlanılamadı: ${err.message}`);
  }
}

router.post('/providers', validate(providerSchema), async (req, res, next) => {
  try {
    const apiUrl = req.body.api_url.replace(/\/+$/, '');
    if (!isSafeHttpUrl(apiUrl)) return res.status(400).json({ error: 'API adresi geçerli bir HTTP/HTTPS adresi olmalıdır.' });
    const profile = await testConnection(apiUrl, req.body.api_key);
    const ins = await dbAsync.run(
      `INSERT INTO digital_providers (name, api_url, api_key_encrypted, balance, currency, balance_checked_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [normalizePlainText(req.body.name, 100), apiUrl, encryptSecret(req.body.api_key),
        Number.isFinite(profile.balance) ? profile.balance : null, profile.currency]
    );
    await audit(req, 'digital_provider_created', ins.id, { name: req.body.name, api_url: apiUrl });
    res.status(201).json({
      message: `Bağlantı başarılı. Sağlayıcı eklendi (bakiye: ${Number.isFinite(profile.balance) ? profile.balance : '?'} ${profile.currency}).`,
      id: ins.id
    });
  } catch (err) { sendError(res, err, next); }
});

router.put('/providers/:id', idParam, validate(z.object({
  name: z.string().trim().min(1).max(100).optional(),
  api_url: z.string().trim().min(8).max(500).optional(),
  api_key: z.string().trim().max(500).optional(),
  status: z.coerce.number().int().min(0).max(1).optional()
})), async (req, res, next) => {
  try {
    const current = await dbAsync.get('SELECT * FROM digital_providers WHERE id = ?', [req.recordId]);
    if (!current) return res.status(404).json({ error: 'Sağlayıcı bulunamadı.' });
    const apiUrl = req.body.api_url ? req.body.api_url.replace(/\/+$/, '') : current.api_url;
    if (!isSafeHttpUrl(apiUrl)) return res.status(400).json({ error: 'API adresi geçerli bir HTTP/HTTPS adresi olmalıdır.' });
    const newKey = req.body.api_key ? req.body.api_key : null;
    // Adres ya da anahtar degistiyse yeni bilgilerle baglanti yeniden denenir.
    if (newKey || apiUrl !== current.api_url) {
      await testConnection(apiUrl, newKey || decryptSecret(current.api_key_encrypted));
    }
    await dbAsync.run(
      'UPDATE digital_providers SET name = ?, api_url = ?, api_key_encrypted = ?, status = ? WHERE id = ?',
      [req.body.name ? normalizePlainText(req.body.name, 100) : current.name, apiUrl,
        newKey ? encryptSecret(newKey) : current.api_key_encrypted,
        req.body.status ?? current.status, current.id]
    );
    catalogCache.delete(current.id);
    await audit(req, 'digital_provider_updated', current.id, { api_url: apiUrl, key_changed: Boolean(newKey), status: req.body.status });
    res.json({ message: 'Sağlayıcı güncellendi.' });
  } catch (err) { sendError(res, err, next); }
});

router.post('/providers/:id/refresh', idParam, async (req, res, next) => {
  try {
    const provider = await dbAsync.get('SELECT * FROM digital_providers WHERE id = ?', [req.recordId]);
    if (!provider) return res.status(404).json({ error: 'Sağlayıcı bulunamadı.' });
    const profile = await Store.clientFor(provider).getProfile().catch(err => { throw Store.httpError(502, `Sağlayıcıya bağlanılamadı: ${err.message}`); });
    await dbAsync.run(
      'UPDATE digital_providers SET balance = ?, currency = ?, balance_checked_at = CURRENT_TIMESTAMP WHERE id = ?',
      [Number.isFinite(profile.balance) ? profile.balance : null, profile.currency, provider.id]
    );
    res.json({ message: 'Bağlantı çalışıyor.', balance: profile.balance, currency: profile.currency, username: profile.username });
  } catch (err) { sendError(res, err, next); }
});

router.delete('/providers/:id', idParam, async (req, res, next) => {
  try {
    const provider = await dbAsync.get('SELECT * FROM digital_providers WHERE id = ?', [req.recordId]);
    if (!provider) return res.status(404).json({ error: 'Sağlayıcı bulunamadı.' });
    const used = await dbAsync.get('SELECT COUNT(*) n FROM digital_products WHERE provider_id = ?', [provider.id]);
    if (used.n > 0) {
      return res.status(409).json({ error: `Bu sağlayıcıya bağlı ${used.n} ürün var. Önce ürünleri kaldırın ya da sağlayıcıyı pasife alın.` });
    }
    await dbAsync.run('DELETE FROM digital_providers WHERE id = ?', [provider.id]);
    catalogCache.delete(provider.id);
    await audit(req, 'digital_provider_deleted', provider.id, { name: provider.name });
    res.json({ message: 'Sağlayıcı silindi.' });
  } catch (err) { next(err); }
});

// Saglayicinin canli katalogu: magazaya eklenecek urunun secildigi liste.
router.get('/providers/:id/catalog', idParam, async (req, res, next) => {
  try {
    const provider = await dbAsync.get('SELECT * FROM digital_providers WHERE id = ?', [req.recordId]);
    if (!provider) return res.status(404).json({ error: 'Sağlayıcı bulunamadı.' });
    let items;
    try {
      items = await providerCatalog(provider, { force: req.query.refresh === '1' });
    } catch (err) {
      return res.status(502).json({ error: `Sağlayıcı kataloğu alınamadı: ${err.message}` });
    }
    const added = await dbAsync.all('SELECT id, provider_product_id, status FROM digital_products WHERE provider_id = ?', [provider.id]);
    const addedMap = new Map(added.map(row => [String(row.provider_product_id), row]));
    const fx = await require('../services/fx').getUsdTry();
    res.json({
      provider: publicProvider(provider),
      usd_try: fx.rate,
      products: items.map(item => {
        const ours = addedMap.get(item.provider_product_id);
        return { ...item, added_id: ours ? ours.id : null, added_status: ours ? ours.status : null };
      })
    });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// MAGAZA URUNLERI
// ---------------------------------------------------------------------------

const productFields = {
  name: z.string().trim().min(1).max(220),
  name_en: z.string().trim().max(220).optional(),
  category: z.string().trim().max(120).optional(),
  category_en: z.string().trim().max(120).optional(),
  description: z.string().max(5000).optional(),
  description_en: z.string().max(5000).optional(),
  price: z.coerce.number().finite().positive().max(1_000_000),
  min_quantity: z.coerce.number().int().min(1).max(100000).optional(),
  max_quantity: z.coerce.number().int().min(1).max(100000).optional(),
  status: z.coerce.number().int().min(0).max(1).optional(),
  sort_order: z.coerce.number().int().min(-100000).max(100000).optional()
};

router.get('/products', async (req, res, next) => {
  try {
    const [rows, fx] = await Promise.all([
      dbAsync.all(`
        SELECT d.*, p.name provider_name, p.status provider_status,
               (SELECT COUNT(*) FROM digital_orders o WHERE o.product_id = d.id AND o.status IN ('completed', 'processing', 'refunded')) sales,
               (SELECT COALESCE(SUM(quantity), 0) FROM digital_orders o WHERE o.product_id = d.id AND o.status IN ('completed', 'processing', 'refunded')) sold_items,
               (SELECT COALESCE(SUM(charge_kurus - refunded_kurus), 0) FROM digital_orders o WHERE o.product_id = d.id AND o.status IN ('completed', 'processing', 'refunded')) revenue_kurus
          FROM digital_products d JOIN digital_providers p ON p.id = d.provider_id
         ORDER BY d.sort_order ASC, d.id DESC`),
      require('../services/fx').getUsdTry()
    ]);
    const rate = Number(fx.rate) || 0;
    res.json({
      usd_try: rate,
      products: rows.map(row => {
        const costTry = row.cost_rate === null ? null
          : (String(row.cost_currency).toUpperCase() === 'TRY' ? row.cost_rate : row.cost_rate * rate);
        const price = fromKurus(row.price_kurus);
        return {
          id: row.id,
          provider_id: row.provider_id,
          provider_name: row.provider_name,
          provider_status: row.provider_status,
          provider_product_id: row.provider_product_id,
          provider_slug: row.provider_slug,
          name: row.name,
          name_en: row.name_en,
          category: row.category,
          category_en: row.category_en,
          description: row.description,
          description_en: row.description_en,
          price,
          cost_rate: row.cost_rate,
          cost_currency: row.cost_currency,
          cost_try: costTry === null ? null : Math.round(costTry * 100) / 100,
          margin_percent: costTry > 0 ? Math.round(((price / costTry) - 1) * 1000) / 10 : null,
          stock: row.stock,
          min_quantity: row.min_quantity,
          max_quantity: row.max_quantity,
          item_format: row.item_format,
          delivery_time: row.delivery_time,
          warranty_hours: row.warranty_hours,
          status: row.status,
          sort_order: row.sort_order,
          synced_at: row.synced_at,
          sales: row.sales,
          sold_items: row.sold_items,
          revenue: fromKurus(row.revenue_kurus)
        };
      })
    });
  } catch (err) { next(err); }
});

router.post('/products', validate(z.object({
  provider_id: z.coerce.number().int().positive(),
  provider_product_id: z.string().trim().min(1).max(120),
  ...productFields
})), async (req, res, next) => {
  try {
    const provider = await dbAsync.get('SELECT * FROM digital_providers WHERE id = ?', [req.body.provider_id]);
    if (!provider) return res.status(404).json({ error: 'Sağlayıcı bulunamadı.' });
    const exists = await dbAsync.get('SELECT id FROM digital_products WHERE provider_id = ? AND provider_product_id = ?', [provider.id, req.body.provider_product_id]);
    if (exists) return res.status(409).json({ error: `Bu ürün mağazada zaten var (#${exists.id}).`, code: 'already_added', id: exists.id });

    // Urun bilgisi istemciden degil saglayicidan alinir (maliyet, stok, sinirlar).
    let source;
    try {
      source = (await providerCatalog(provider)).find(item => item.provider_product_id === req.body.provider_product_id);
    } catch (err) {
      return res.status(502).json({ error: `Sağlayıcı kataloğu alınamadı: ${err.message}` });
    }
    if (!source) return res.status(404).json({ error: 'Ürün sağlayıcı kataloğunda bulunamadı.' });
    // Detay ucu aciklama ve kullanim talimatini da verir; alinamazsa liste yeter.
    const detail = await Store.clientFor(provider).getProduct(source.slug).catch(() => null);

    const priceKurus = toKurus(req.body.price);
    const min = req.body.min_quantity ?? source.min;
    const max = Math.max(min, req.body.max_quantity ?? source.max);
    const ins = await dbAsync.run(
      `INSERT INTO digital_products (provider_id, provider_product_id, provider_slug, name, name_en, category, category_en,
         description, description_en, price_kurus, cost_rate, cost_currency, stock, min_quantity, max_quantity,
         item_format, delivery_time, warranty_hours, status, sort_order, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [provider.id, source.provider_product_id, source.slug,
        normalizePlainText(req.body.name, 220), normalizePlainText(req.body.name_en || '', 220) || null,
        normalizePlainText(req.body.category ?? source.category, 120) || null,
        normalizePlainText(req.body.category_en || '', 120) || null,
        normalizePlainText(req.body.description ?? (detail?.description || source.description || ''), 5000) || null,
        normalizePlainText(req.body.description_en || '', 5000) || null,
        priceKurus, detail?.price ?? source.price, provider.currency || 'USD',
        detail?.stock ?? source.stock, min, max,
        source.format || null, source.delivery_time || null, source.warranty_hours || 0,
        req.body.status ?? 1, req.body.sort_order ?? 0]
    );
    await audit(req, 'digital_product_created', ins.id, { name: req.body.name, price_kurus: priceKurus, provider_product_id: source.provider_product_id });
    res.status(201).json({ message: 'Ürün mağazaya eklendi.', id: ins.id });
  } catch (err) { next(err); }
});

router.put('/products/:id', idParam, validate(z.object(productFields).partial()), async (req, res, next) => {
  try {
    const current = await dbAsync.get('SELECT * FROM digital_products WHERE id = ?', [req.recordId]);
    if (!current) return res.status(404).json({ error: 'Ürün bulunamadı.' });
    const b = req.body;
    const min = b.min_quantity ?? current.min_quantity;
    const max = b.max_quantity ?? current.max_quantity;
    if (max < min) return res.status(400).json({ error: 'En fazla adet, en az adetten küçük olamaz.' });
    const text = (value, fallback, max) => (value === undefined ? fallback : (normalizePlainText(value, max) || null));
    await dbAsync.run(
      `UPDATE digital_products SET name = ?, name_en = ?, category = ?, category_en = ?, description = ?, description_en = ?,
         price_kurus = ?, min_quantity = ?, max_quantity = ?, status = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [text(b.name, current.name, 220) || current.name, text(b.name_en, current.name_en, 220),
        text(b.category, current.category, 120), text(b.category_en, current.category_en, 120),
        text(b.description, current.description, 5000), text(b.description_en, current.description_en, 5000),
        b.price === undefined ? current.price_kurus : toKurus(b.price), min, max,
        b.status ?? current.status, b.sort_order ?? current.sort_order, current.id]
    );
    await audit(req, 'digital_product_updated', current.id, { price: b.price, status: b.status });
    res.json({ message: 'Ürün güncellendi.' });
  } catch (err) { next(err); }
});

// Siparisi olan urun silinmez (gecmis kayitlar urun adini korur ama rapor
// butunlugu icin), pasife alinir.
router.delete('/products/:id', idParam, async (req, res, next) => {
  try {
    const product = await dbAsync.get('SELECT id, name FROM digital_products WHERE id = ?', [req.recordId]);
    if (!product) return res.status(404).json({ error: 'Ürün bulunamadı.' });
    const used = await dbAsync.get('SELECT COUNT(*) n FROM digital_orders WHERE product_id = ?', [product.id]);
    if (used.n > 0) {
      await dbAsync.run('UPDATE digital_products SET status = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [product.id]);
      await audit(req, 'digital_product_disabled', product.id, { name: product.name });
      return res.json({ message: 'Bu ürünün siparişleri olduğu için silinmedi, satıştan kaldırıldı (pasif).', disabled: true });
    }
    await dbAsync.run('DELETE FROM digital_products WHERE id = ?', [product.id]);
    await audit(req, 'digital_product_deleted', product.id, { name: product.name });
    res.json({ message: 'Ürün silindi.' });
  } catch (err) { next(err); }
});

router.post('/products/sync', async (req, res, next) => {
  try {
    await Store.syncCatalog();
    catalogCache.clear();
    res.json({ message: 'Stok ve maliyetler sağlayıcıdan güncellendi.' });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// SIPARISLER
// ---------------------------------------------------------------------------

router.get('/orders', async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page || '1', 10) || 1);
    const limit = 50;
    const where = [];
    const params = [];
    if (['pending', 'processing', 'completed', 'failed', 'refunded'].includes(req.query.status)) {
      where.push('o.status = ?');
      params.push(req.query.status);
    }
    const q = String(req.query.q || '').trim().slice(0, 100);
    if (q) {
      const idMatch = q.replace(/^#?D?/i, '');
      where.push('(u.username LIKE ? OR o.product_name LIKE ? OR o.provider_order_id = ? OR o.id = ?)');
      params.push(`%${q}%`, `%${q}%`, q, /^\d+$/.test(idMatch) ? Number(idMatch) : -1);
    }
    const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = await dbAsync.get(`SELECT COUNT(*) n FROM digital_orders o JOIN users u ON u.id = o.user_id ${sqlWhere}`, params);
    const rows = await dbAsync.all(
      `SELECT o.*, u.username FROM digital_orders o JOIN users u ON u.id = o.user_id ${sqlWhere}
        ORDER BY o.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit]
    );
    res.json({
      orders: rows.map(row => ({
        ...Store.publicOrder(row),
        user_id: row.user_id,
        username: row.username,
        provider_order_id: row.provider_order_id,
        provider_total: row.provider_total,
        cost_currency: row.cost_currency
      })),
      pagination: { page, limit, total: total.n, pages: Math.max(1, Math.ceil(total.n / limit)) }
    });
  } catch (err) { next(err); }
});

// Destek icin yonetici teslim edilen bilgileri gorebilir; her goruntuleme
// denetim kaydina yazilir.
router.get('/orders/:id', idParam, async (req, res, next) => {
  try {
    const row = await dbAsync.get('SELECT o.*, u.username FROM digital_orders o JOIN users u ON u.id = o.user_id WHERE o.id = ?', [req.recordId]);
    if (!row) return res.status(404).json({ error: 'Sipariş bulunamadı.' });
    await audit(req, 'digital_order_viewed', row.id, {});
    res.json({
      order: { ...Store.publicOrder(row), username: row.username, provider_order_id: row.provider_order_id, provider_total: row.provider_total, cost_currency: row.cost_currency },
      items: Store.decryptItems(row),
      usage: row.usage_note || ''
    });
  } catch (err) { next(err); }
});

router.post('/orders/:id/refund', idParam, validate(z.object({
  amount: z.coerce.number().finite().positive().max(1_000_000).optional()
})), async (req, res, next) => {
  try {
    const result = await Store.adminRefund(req.recordId, req.body.amount === undefined ? null : toKurus(req.body.amount));
    await audit(req, 'digital_order_refunded', req.recordId, { refunded_kurus: result.refunded_kurus, full: result.full });
    res.json({ message: `₺${fromKurus(result.refunded_kurus).toFixed(2)} kullanıcının bakiyesine iade edildi.`, ...result });
  } catch (err) { sendError(res, err, next); }
});

router.post('/orders/:id/sync', idParam, async (req, res, next) => {
  try {
    const order = await dbAsync.get('SELECT * FROM digital_orders WHERE id = ?', [req.recordId]);
    if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı.' });
    if (!order.provider_order_id) return res.status(400).json({ error: 'Bu siparişin sağlayıcı numarası yok.' });
    const provider = await Store.getProvider(order.provider_id, { activeOnly: false });
    if (!provider) return res.status(400).json({ error: 'Sağlayıcı bulunamadı.' });
    let result;
    try {
      result = await Store.clientFor(provider).getOrder(order.provider_order_id);
    } catch (err) {
      return res.status(502).json({ error: `Sağlayıcıdan durum alınamadı: ${err.message}` });
    }
    const updated = await Store.applyProviderOrder(order.id, result, { allowEmptyCompletion: true });
    res.json({ message: `Sağlayıcıdaki durum: ${result.status}.`, status: updated?.status });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GMAIL CHECKER
// ---------------------------------------------------------------------------

router.get('/checker', async (req, res, next) => {
  try {
    const [config, recent] = await Promise.all([
      Store.getCheckerConfig(),
      dbAsync.all(`SELECT c.id, c.email_count, c.checked_count, c.charge_kurus, c.refunded_kurus, c.status, c.summary,
                          c.provider_cost, c.failure_reason, c.created_at, u.username
                     FROM digital_checks c JOIN users u ON u.id = c.user_id ORDER BY c.id DESC LIMIT 50`)
    ]);
    res.json({
      config: { enabled: config.enabled, price: fromKurus(config.priceKurus), provider_id: config.providerId },
      checks: recent.map(row => ({
        id: row.id,
        username: row.username,
        email_count: row.email_count,
        checked: row.checked_count,
        charge: fromKurus(row.charge_kurus - row.refunded_kurus),
        provider_cost: row.provider_cost,
        status: row.status,
        summary: row.summary ? JSON.parse(row.summary) : null,
        failure_reason: row.failure_reason,
        created_at: row.created_at
      }))
    });
  } catch (err) { next(err); }
});

router.put('/checker', validate(z.object({
  enabled: z.boolean(),
  price: z.coerce.number().finite().min(0).max(10000),
  provider_id: z.coerce.number().int().positive().nullable().optional()
})), async (req, res, next) => {
  try {
    const providerId = req.body.provider_id || null;
    if (req.body.enabled) {
      if (!(req.body.price > 0)) return res.status(400).json({ error: 'Checker açıkken adres başı fiyat 0\'dan büyük olmalı.' });
      if (!providerId || !(await Store.getProvider(providerId))) return res.status(400).json({ error: 'Checker için aktif bir sağlayıcı seçin.' });
    }
    const config = await Store.saveCheckerConfig({ enabled: req.body.enabled, priceKurus: toKurus(req.body.price), providerId });
    await audit(req, 'digital_checker_updated', providerId || 0, { enabled: config.enabled, price_kurus: config.priceKurus });
    res.json({ message: 'Gmail Checker ayarları kaydedildi.', config: { enabled: config.enabled, price: fromKurus(config.priceKurus), provider_id: config.providerId } });
  } catch (err) { next(err); }
});

module.exports = router;
