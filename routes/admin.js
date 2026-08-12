const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { dbAsync } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const SmmProviderClient = require('../services/smmProvider');
const bcrypt = require('bcryptjs');
const { withTransaction } = require('../config/database');
const { normalizePlainText, sanitizeRichText, isSafeHttpUrl, createOpaqueToken } = require('../utils/security');
const { toKurus, fromKurus } = require('../utils/money');
const { fetchProviderCatalog } = require('../services/providerCatalog');
const { chooseBlogCover, isLocalBlogCover } = require('../services/blogCover');

// --- Ortak dogrulama semalari ---------------------------------------------
// Admin uclari da musteri uclari gibi sema ile dogrulanir; boylece negatif
// tutar, tasan sayi veya beklenmeyen tipler veritabanina ulasmaz.
const moneyAmount = z.coerce.number().finite().positive().max(1_000_000);
const idList = z.array(z.coerce.number().int().positive()).min(1).max(1000);
const quantityField = z.coerce.number().int().min(1).max(100_000_000);
const percentField = z.coerce.number().finite().min(0).max(1000);

const providerCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  api_url: z.string().trim().url().max(500),
  api_key: z.string().trim().min(1).max(500)
});

const importServicesSchema = z.object({
  profit_percentage: percentField.optional()
});

const userBalanceSchema = z.object({
  amount: moneyAmount,
  action: z.enum(['add', 'subtract']).default('add')
});

// delete_all tum servisleri pasife aldigi icin coerce KULLANILMAZ:
// z.coerce.boolean() "false" metnini de true'ya cevirirdi.
const bulkDeleteSchema = z.object({
  service_ids: idList.optional(),
  delete_all: z.literal(true).optional()
}).refine(value => value.delete_all || value.service_ids?.length, {
  message: 'Silinecek servis seçilmedi.'
});

const bulkStatusSchema = z.object({
  service_ids: idList,
  status: z.coerce.number().int().min(0).max(1)
});

const couponSchema = z.object({
  code: z.string().trim().min(2).max(64),
  amount: moneyAmount,
  max_uses: z.coerce.number().int().min(1).max(1_000_000).default(100)
});

const orderStatusSchema = z.object({
  status: z.enum(['pending', 'processing', 'completed', 'partial', 'canceled', 'failed'])
});

const changePasswordSchema = z.object({
  current_password: z.string().min(1).max(128),
  new_password: z.string().min(10, 'Yeni şifre en az 10 karakter olmalıdır.').max(128)
});

const ALLOWED_SETTING_KEYS = ['site_name', 'currency', 'telegram_link', 'support_email', 'hero_title', 'hero_subtitle',
  'bank_accounts', 'hero_title_tr', 'hero_title_en', 'hero_subtitle_tr', 'hero_subtitle_en',
  'announcement_tr', 'announcement_en', 'usd_try_rate'];
// Ayar degerleri yalnizca ilkel tip olabilir; obje/dizi "[object Object]" olarak kaydedilirdi.
const settingsSchema = z.record(z.string(), z.union([z.string().max(20000), z.number(), z.boolean()]));

const serviceCreateSchema = z.object({
  category_name: z.string().trim().min(1).max(100),
  category_name_en: z.string().trim().max(100).optional(),
  provider_id: z.coerce.number().int().positive().nullable().optional(),
  provider_service_id: z.union([z.string().trim().max(64), z.coerce.number()]).nullable().optional(),
  name: z.string().trim().max(220).optional(),
  name_tr: z.string().trim().max(220).optional(),
  name_en: z.string().trim().max(220).optional(),
  rate_per_1000: z.coerce.number().finite().min(0).max(1_000_000),
  rate_per_1000_usd: z.coerce.number().finite().min(0).max(1_000_000).optional(),
  min_quantity: quantityField.optional(),
  max_quantity: quantityField.optional(),
  description: z.string().max(5000).optional(),
  description_tr: z.string().max(5000).optional(),
  description_en: z.string().max(5000).optional(),
  refill: z.union([z.boolean(), z.string(), z.number()]).optional()
});

const serviceUpdateSchema = serviceCreateSchema.partial().extend({
  status: z.coerce.number().int().min(0).max(1).optional()
});

const platformSchema = z.object({
  name: z.string().trim().min(1).max(80),
  icon: z.string().trim().min(1).max(80)
});

const featuredCardSchema = z.object({
  title: z.string().trim().min(1).max(120),
  subtitle: z.string().trim().max(120).optional(),
  highlight: z.string().trim().max(120).optional()
});

const statusOnlySchema = z.object({ status: z.coerce.number().int().min(0).max(1) });

const applyProviderPriceSchema = z.object({ profit_percentage: percentField });

// Rota parametreleri: gecersiz id'ler sorguya hic ulasmadan reddedilir.
function requireIdParam(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Geçersiz kayıt numarası.' });
  req.recordId = id;
  next();
}

// All routes require Admin Auth
router.use(authenticateToken, requireAdmin);

// DASHBOARD STATS
router.get('/stats', async (req, res) => {
  try {
    const totalRevenueRow = await dbAsync.get(`SELECT SUM(charge) as total FROM orders WHERE status != 'canceled'`);
    const totalOrdersRow = await dbAsync.get(`SELECT COUNT(*) as count FROM orders`);
    const totalUsersRow = await dbAsync.get(`SELECT COUNT(*) as count FROM users WHERE role = 'client'`);
    const activeProvidersRow = await dbAsync.get(`SELECT COUNT(*) as count FROM providers WHERE status = 1`);
    const pendingTicketsRow = await dbAsync.get(`SELECT COUNT(*) as count FROM tickets WHERE status = 'open'`);
    const pendingDepositsRow = await dbAsync.get(`SELECT COUNT(*) as count FROM payment_notifications WHERE status = 'pending'`);

    // Recent 10 Orders
    const recentOrders = await dbAsync.all(
      `SELECT o.*, u.username, s.name as service_name
       FROM orders o
       JOIN users u ON o.user_id = u.id
       JOIN services s ON o.service_id = s.id
       ORDER BY o.id DESC LIMIT 10`
    );

    res.json({
      stats: {
        total_revenue: totalRevenueRow.total || 0,
        total_orders: totalOrdersRow.count || 0,
        total_users: totalUsersRow.count || 0,
        active_providers: activeProvidersRow.count || 0,
        pending_tickets: pendingTicketsRow.count || 0
        , pending_deposits: pendingDepositsRow.count || 0
      },
      recentOrders
    });
  } catch (err) {
    console.error('Admin Stats Error:', err);
    res.status(500).json({ error: 'İstatistikler alınamadı.' });
  }
});

// PROVIDERS MANAGMENT
router.get('/providers', async (req, res) => {
  try {
    const providers = await dbAsync.all(`SELECT id, name, api_url, balance, status, created_at FROM providers ORDER BY id DESC`);
    res.json({ providers });
  } catch (err) {
    res.status(500).json({ error: 'Sağlayıcılar yüklenemedi.' });
  }
});

router.post('/providers', validate(providerCreateSchema), async (req, res) => {
  try {
    const { name, api_url, api_key } = req.body;
    if (!isSafeHttpUrl(api_url)) return res.status(400).json({ error: 'Sağlayıcı adresi geçerli bir HTTP/HTTPS adresi olmalıdır.' });

    const client = new SmmProviderClient(api_url, api_key);
    const balanceObj = await client.getBalance();
    const balance = balanceObj && balanceObj.balance ? parseFloat(balanceObj.balance) : 0;

    const result = await dbAsync.run(
      `INSERT INTO providers (name, api_url, api_key, balance, status) VALUES (?, ?, ?, ?, 1)`,
      [normalizePlainText(name, 100), api_url, api_key, balance]
    );

    res.json({ message: 'Sağlayıcı başarıyla eklendi.', provider_id: result.id, balance });
  } catch (err) {
    res.status(500).json({ error: 'Sağlayıcı eklenirken hata oluştu.' });
  }
});

// IMPORT SERVICES FROM PROVIDER API
router.post('/providers/:id/import-services', requireIdParam, validate(importServicesSchema), async (req, res) => {
  try {
    const providerId = req.recordId;
    const { profit_percentage } = req.body; // e.g. 50% profit
    const profitMultiplier = 1 + ((profit_percentage ?? 50) / 100);

    const provider = await dbAsync.get(`SELECT * FROM providers WHERE id = ?`, [providerId]);
    if (!provider) {
      return res.status(404).json({ error: 'Sağlayıcı bulunamadı.' });
    }

    const client = new SmmProviderClient(provider.api_url, provider.api_key);
    let rawServicesData = await client.getServices();

    let serviceList = [];
    if (Array.isArray(rawServicesData)) {
      serviceList = rawServicesData;
    } else if (rawServicesData && Array.isArray(rawServicesData.services)) {
      serviceList = rawServicesData.services;
    } else if (rawServicesData && Array.isArray(rawServicesData.data)) {
      serviceList = rawServicesData.data;
    } else if (rawServicesData && rawServicesData.error) {
      return res.status(400).json({ error: `Sağlayıcı API Hatası: ${rawServicesData.error}` });
    } else {
      return res.status(400).json({ error: 'Sağlayıcı servis listesi geçersiz veya boş format döndürdü.' });
    }

    let importedCount = 0;

    for (const pService of serviceList) {
      const pServiceId = pService.service || pService.id || pService.service_id;
      if (!pServiceId) continue;

      const catName = normalizePlainText(pService.category || 'Genel', 120);
      
      // Get or create category
      let category = await dbAsync.get(`SELECT id FROM categories WHERE name = ?`, [catName]);
      if (!category) {
        const catRes = await dbAsync.run(`INSERT INTO categories (name, icon) VALUES (?, 'fa-folder')`, [catName]);
        category = { id: catRes.id };
      }

      // Calculate new rate with profit margin
      const rawRate = parseFloat(pService.rate || pService.price || pService.cost || 10);
      const calculatedRate = (rawRate * profitMultiplier).toFixed(2);
      const minQty = parseInt(pService.min || 100);
      const maxQty = parseInt(pService.max || 10000);
      const serviceName = normalizePlainText(pService.name || `Servis #${pServiceId}`, 220);

      // Check if service already imported
      const existing = await dbAsync.get(
        `SELECT id FROM services WHERE provider_id = ? AND provider_service_id = ?`,
        [providerId, pServiceId]
      );

      // Auto-detect refill/guarantee from provider API or title keywords
      const isRefill = (
        pService.refill == true || 
        pService.refill === 1 || 
        pService.refill === "1" || 
        pService.refill === "true" ||
        /telafi|garanti|refill|düşüşsüz|non-drop|30 gün|60 gün|90 gün|365 gün/i.test(`${serviceName} ${catName}`)
      ) ? 1 : 0;

      if (!existing) {
        await dbAsync.run(
          `INSERT INTO services (category_id, provider_id, provider_service_id, name, rate_per_1000, rate_per_1000_kurus, min_quantity, max_quantity, description, status, refill)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          [
            category.id,
            providerId,
            pServiceId,
            serviceName,
            calculatedRate,
            toKurus(calculatedRate),
            minQty,
            maxQty,
            pService.description || `${catName} için kaliteli servis.`,
            isRefill
          ]
        );
        importedCount++;
      }
    }

    res.json({
      message: `${importedCount} adet yeni servis başarıyla içe aktarıldı ve %${profit_percentage || 50} kar marjı uygulandı! (Toplam taranan: ${serviceList.length})`,
      total_fetched: serviceList.length,
      imported_count: importedCount
    });
  } catch (err) {
    console.error('Import services error:', err);
    res.status(500).json({ error: err.message || 'Servisler içe aktarılırken bir sorun oluştu.' });
  }
});

// FETCH RAW PROVIDER SERVICES LIST FOR ADMIN EXPLORER
router.get('/providers/:id/raw-services', requireIdParam, async (req, res) => {
  try {
    const providerId = req.recordId;
    const provider = await dbAsync.get(`SELECT * FROM providers WHERE id = ?`, [providerId]);
    if (!provider) return res.status(404).json({ error: 'Sağlayıcı bulunamadı.' });

    const client = new SmmProviderClient(provider.api_url, provider.api_key);
    let rawServicesData = await client.getServices();

    let serviceList = [];
    if (Array.isArray(rawServicesData)) {
      serviceList = rawServicesData;
    } else if (rawServicesData && Array.isArray(rawServicesData.services)) {
      serviceList = rawServicesData.services;
    } else if (rawServicesData && Array.isArray(rawServicesData.data)) {
      serviceList = rawServicesData.data;
    }

    const safeServices = serviceList.slice(0, 20000).map(item => ({
      ...item,
      name: normalizePlainText(item.name || '', 220),
      category: normalizePlainText(item.category || 'Genel', 120),
      description: normalizePlainText(item.description || '', 1000)
    }));
    res.json({ services: safeServices, total: safeServices.length, provider_name: normalizePlainText(provider.name, 100) });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Sağlayıcı servisleri alınamadı.' });
  }
});

// MANAGE ADDED SERVICES (CRUD)
router.get('/services', async (req, res) => {
  try {
    const [services, exchangeSetting] = await Promise.all([dbAsync.all(`
      SELECT s.*, c.name as category_name, c.name_en as category_name_en, p.name as provider_name
      FROM services s
      JOIN categories c ON s.category_id = c.id
      LEFT JOIN providers p ON s.provider_id = p.id
      ORDER BY s.id DESC
    `), dbAsync.get("SELECT value FROM site_settings WHERE key = 'usd_try_rate'")]);
    res.json({ services, usd_try_rate: Number(exchangeSetting?.value) > 0 ? Number(exchangeSetting.value) : 35 });
  } catch (err) {
    res.status(500).json({ error: 'Servisler alınamadı.' });
  }
});

router.post('/services/refresh-provider-prices', async (req, res) => {
  try {
    const providers = await dbAsync.all(`SELECT DISTINCT p.* FROM providers p
      JOIN services s ON s.provider_id = p.id WHERE p.status = 1 AND s.provider_service_id IS NOT NULL`);
    const updates = [];
    const failures = [];
    for (const provider of providers) {
      try {
        const catalog = await fetchProviderCatalog(provider);
        const catalogMap = new Map(catalog.services.map(item => [String(item.provider_service_id), item]));
        const linked = await dbAsync.all('SELECT id, provider_service_id FROM services WHERE provider_id = ?', [provider.id]);
        for (const service of linked) {
          const source = catalogMap.get(String(service.provider_service_id));
          if (source) updates.push({ id: service.id, rate: source.cost_rate, currency: catalog.currency });
        }
      } catch (error) {
        failures.push(normalizePlainText(provider.name, 100));
      }
    }
    await withTransaction(async tx => {
      for (const update of updates) {
        await tx.run(`UPDATE services SET provider_cost_rate = ?, provider_cost_currency = ?,
          provider_cost_updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [update.rate, update.currency, update.id]);
      }
    });
    res.json({
      message: `${updates.length} servisin sağlayıcı maliyeti güncellendi.${failures.length ? ` Bağlanılamayan: ${failures.join(', ')}` : ''}`,
      updated_count: updates.length,
      failed_providers: failures
    });
  } catch (err) {
    res.status(500).json({ error: 'Sağlayıcı fiyatları güncellenemedi.' });
  }
});

router.post('/services/provider-price-audit', async (req, res) => {
  try {
    const [services, providers, exchangeSetting] = await Promise.all([
      dbAsync.all(`SELECT s.id, s.name, s.name_tr, s.name_en, s.provider_id, s.provider_service_id,
        s.provider_cost_rate, s.provider_cost_currency, s.provider_cost_updated_at, s.rate_per_1000,
        s.rate_per_1000_usd_cents, p.name provider_name
        FROM services s JOIN providers p ON p.id = s.provider_id
        WHERE s.status = 1 AND p.status = 1 AND s.provider_service_id IS NOT NULL ORDER BY s.id DESC`),
      dbAsync.all('SELECT * FROM providers WHERE status = 1'),
      dbAsync.get("SELECT value FROM site_settings WHERE key = 'usd_try_rate'")
    ]);
    const usdTryRate = Number(exchangeSetting?.value) > 0 ? Number(exchangeSetting.value) : 35;
    const catalogMaps = new Map();
    const providerErrors = new Set();
    for (const provider of providers) {
      try {
        const catalog = await fetchProviderCatalog(provider, { force: true });
        catalogMaps.set(provider.id, { currency: catalog.currency, services: new Map(catalog.services.map(item => [String(item.provider_service_id), item])) });
      } catch (error) {
        providerErrors.add(provider.id);
      }
    }
    const results = services.map(service => {
      const catalog = catalogMaps.get(service.provider_id);
      const current = catalog?.services.get(String(service.provider_service_id));
      const oldRate = Number(service.provider_cost_rate);
      const hasOldRate = Number.isFinite(oldRate) && oldRate >= 0 && service.provider_cost_rate !== null;
      const currentRate = Number(current?.cost_rate);
      const hasCurrentRate = Number.isFinite(currentRate) && currentRate >= 0;
      const oldCurrency = String(service.provider_cost_currency || catalog?.currency || 'USD').toUpperCase();
      const currentCurrency = String(catalog?.currency || oldCurrency).toUpperCase();
      const oldTry = hasOldRate ? (oldCurrency === 'TRY' ? oldRate : oldRate * usdTryRate) : null;
      const currentTry = hasCurrentRate ? (currentCurrency === 'TRY' ? currentRate : currentRate * usdTryRate) : null;
      const changePercent = oldTry > 0 && currentTry !== null ? ((currentTry / oldTry) - 1) * 100 : null;
      const currentMargin = currentTry > 0 ? ((Number(service.rate_per_1000) / currentTry) - 1) * 100 : null;
      return {
        id: service.id,
        name_tr: service.name_tr || service.name,
        name_en: service.name_en || service.name,
        provider_name: service.provider_name,
        provider_service_id: service.provider_service_id,
        previous_cost_rate: hasOldRate ? oldRate : null,
        previous_cost_currency: oldCurrency,
        current_cost_rate: hasCurrentRate ? currentRate : null,
        current_cost_currency: currentCurrency,
        change_percent: changePercent,
        price_increased: changePercent !== null && changePercent > 0.001,
        price_decreased: changePercent !== null && changePercent < -0.001,
        current_sale_try: Number(service.rate_per_1000),
        current_sale_usd: Number(service.rate_per_1000_usd_cents || 0) / 100,
        current_margin_percent: currentMargin,
        unavailable: providerErrors.has(service.provider_id) || !hasCurrentRate,
        previous_checked_at: service.provider_cost_updated_at
      };
    });
    res.json({ services: results, usd_try_rate: usdTryRate, checked_at: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: 'Canlı sağlayıcı fiyat kontrolü tamamlanamadı.' });
  }
});

router.post('/services/:id/apply-provider-price', requireIdParam, validate(applyProviderPriceSchema), async (req, res) => {
  try {
    const margin = req.body.profit_percentage;
    const service = await dbAsync.get(`SELECT s.*, p.name provider_name, p.api_url, p.api_key, p.status provider_status
      FROM services s JOIN providers p ON p.id = s.provider_id WHERE s.id = ?`, [req.recordId]);
    if (!service) return res.status(404).json({ error: 'Sağlayıcıya bağlı servis bulunamadı.' });
    if (!service.provider_status) return res.status(400).json({ error: 'Servisin sağlayıcısı aktif değil.' });
    const catalog = await fetchProviderCatalog({ id: service.provider_id, api_url: service.api_url, api_key: service.api_key });
    const source = catalog.services.find(item => String(item.provider_service_id) === String(service.provider_service_id));
    if (!source) return res.status(409).json({ error: 'Servis güncel sağlayıcı kataloğunda bulunamadı.' });
    const exchangeSetting = await dbAsync.get("SELECT value FROM site_settings WHERE key = 'usd_try_rate'");
    const usdTryRate = Number(exchangeSetting?.value) > 0 ? Number(exchangeSetting.value) : 35;
    const multiplier = 1 + (margin / 100);
    const sellTry = catalog.currency === 'TRY' ? source.cost_rate * multiplier : source.cost_rate * multiplier * usdTryRate;
    const sellUsd = catalog.currency === 'TRY' ? (source.cost_rate * multiplier) / usdTryRate : source.cost_rate * multiplier;
    await dbAsync.run(`UPDATE services SET provider_cost_rate = ?, provider_cost_currency = ?, provider_cost_updated_at = CURRENT_TIMESTAMP,
      rate_per_1000 = ?, rate_per_1000_kurus = ?, rate_per_1000_usd_cents = ? WHERE id = ?`, [
      source.cost_rate, catalog.currency, Number(sellTry.toFixed(2)), toKurus(sellTry), Math.round(sellUsd * 100), service.id
    ]);
    res.json({
      message: `${service.name_tr || service.name} fiyatı %${margin} kâr oranıyla güncellendi.`,
      service_id: service.id,
      provider_cost_rate: source.cost_rate,
      provider_cost_currency: catalog.currency,
      rate_try: Number(sellTry.toFixed(2)),
      rate_usd: Number(sellUsd.toFixed(2)),
      profit_percentage: margin
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Servis fiyatı güncellenemedi.' });
  }
});

router.post('/services', validate(serviceCreateSchema), async (req, res) => {
  try {
    const { category_name, category_name_en, provider_id, provider_service_id, name, name_tr, name_en,
      rate_per_1000, rate_per_1000_usd, min_quantity, max_quantity, description, description_tr, description_en, refill } = req.body;
    const safeNameTr = normalizePlainText(name_tr || name, 220);
    const safeNameEn = normalizePlainText(name_en || name_tr || name, 220);

    if (!safeNameTr) {
      return res.status(400).json({ error: 'Servis adı zorunludur.' });
    }

    // Get or create category
    let category = await dbAsync.get(`SELECT id FROM categories WHERE name = ?`, [category_name]);
    if (!category) {
      const catRes = await dbAsync.run(`INSERT INTO categories (name, name_tr, name_en, icon) VALUES (?, ?, ?, 'fa-folder')`, [category_name, category_name, category_name_en || category_name]);
      category = { id: catRes.id };
    }

    const isRefill = (
      refill == 1 || refill === "1" || refill === true || refill === "true" ||
      /telafi|garanti|refill|düşüşsüz|non-drop|30 gün|60 gün|90 gün|365 gün/i.test(`${safeNameTr} ${safeNameEn} ${category_name}`)
    ) ? 1 : 0;

    const result = await dbAsync.run(
      `INSERT INTO services (category_id, provider_id, provider_service_id, name, name_tr, name_en, rate_per_1000,
       rate_per_1000_kurus, rate_per_1000_usd_cents, min_quantity, max_quantity, description, description_tr, description_en, status, refill)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        category.id,
        provider_id || null,
        provider_service_id || null,
        safeNameTr,
        safeNameTr,
        safeNameEn,
        parseFloat(rate_per_1000),
        toKurus(rate_per_1000),
        Math.round(Number(rate_per_1000_usd || 0) * 100),
        parseInt(min_quantity || 100),
        parseInt(max_quantity || 10000),
        normalizePlainText(description_tr || description || 'Kaliteli sosyal medya hizmeti.', 1000),
        normalizePlainText(description_tr || description || 'Kaliteli sosyal medya hizmeti.', 1000),
        normalizePlainText(description_en || description || 'Quality social media service.', 1000),
        isRefill
      ]
    );

    res.json({ message: 'Servis başarıyla sitenize eklendi!', service_id: result.id });
  } catch (err) {
    res.status(500).json({ error: 'Servis eklenirken hata oluştu.' });
  }
});

router.put('/services/:id', requireIdParam, validate(serviceUpdateSchema), async (req, res) => {
  try {
    const serviceId = req.recordId;
    const current = await dbAsync.get(`SELECT s.*, c.name category_name FROM services s JOIN categories c ON c.id = s.category_id WHERE s.id = ?`, [serviceId]);
    if (!current) return res.status(404).json({ error: 'Servis bulunamadı.' });
    const { category_name, category_name_en, name, name_tr, name_en, rate_per_1000, rate_per_1000_usd,
      min_quantity, max_quantity, status, refill, description_tr, description_en } = req.body;
    let categoryId = current.category_id;
    if (category_name && category_name !== current.category_name) {
      let category = await dbAsync.get('SELECT id FROM categories WHERE name = ? OR name_tr = ? LIMIT 1', [category_name, category_name]);
      if (!category) {
        const created = await dbAsync.run(`INSERT INTO categories (name, name_tr, name_en, icon) VALUES (?, ?, ?, 'fa-folder')`, [normalizePlainText(category_name, 100), normalizePlainText(category_name, 100), normalizePlainText(category_name_en || category_name, 100)]);
        category = { id: created.id };
      }
      categoryId = category.id;
    }
    const safeNameTr = normalizePlainText(name_tr || name || current.name_tr || current.name, 220);
    const safeNameEn = normalizePlainText(name_en || current.name_en || safeNameTr, 220);
    const tlRate = Number(rate_per_1000 ?? current.rate_per_1000);
    await dbAsync.run(`UPDATE services SET category_id = ?, name = ?, name_tr = ?, name_en = ?, description = ?,
      description_tr = ?, description_en = ?, rate_per_1000 = ?, rate_per_1000_kurus = ?, rate_per_1000_usd_cents = ?,
      min_quantity = ?, max_quantity = ?, status = ?, refill = ? WHERE id = ?`, [
      categoryId, safeNameTr, safeNameTr, safeNameEn,
      normalizePlainText(description_tr ?? current.description_tr ?? current.description ?? '', 1000),
      normalizePlainText(description_tr ?? current.description_tr ?? current.description ?? '', 1000),
      normalizePlainText(description_en ?? current.description_en ?? current.description ?? '', 1000),
      tlRate, toKurus(tlRate), Math.round(Number(rate_per_1000_usd ?? (current.rate_per_1000_usd_cents / 100)) * 100),
      parseInt(min_quantity ?? current.min_quantity), parseInt(max_quantity ?? current.max_quantity),
      status === undefined ? current.status : parseInt(status), refill === undefined ? current.refill : parseInt(refill), serviceId
    ]);

    res.json({ message: 'Servis bilgileri güncellendi!' });
  } catch (err) {
    res.status(500).json({ error: 'Servis güncellenemedi.' });
  }
});

router.delete('/services/:id', requireIdParam, async (req, res) => {
  try {
    const serviceId = req.recordId;
    const used = await dbAsync.get('SELECT 1 found FROM orders WHERE service_id = ? LIMIT 1', [serviceId]);
    if (used) await dbAsync.run('UPDATE services SET status = 0 WHERE id = ?', [serviceId]);
    else await dbAsync.run('DELETE FROM services WHERE id = ?', [serviceId]);
    await dbAsync.run('DELETE FROM categories WHERE NOT EXISTS (SELECT 1 FROM services WHERE services.category_id = categories.id)');
    res.json({ message: used ? 'Sipariş geçmişi korundu; servis pasife alındı.' : 'Servis silindi.' });
  } catch (err) {
    res.status(500).json({ error: 'Servis silinemedi.' });
  }
});

// BULK DELETE SERVICES
router.post('/services/bulk-delete', validate(bulkDeleteSchema), async (req, res) => {
  try {
    const { service_ids, delete_all } = req.body;

    if (delete_all) {
      await dbAsync.run(`UPDATE services SET status = 0`);
      return res.json({ message: 'Tüm servisler pasife alındı; sipariş geçmişi korundu.' });
    }

    const placeholders = service_ids.map(() => '?').join(',');
    await dbAsync.run(`UPDATE services SET status = 0 WHERE id IN (${placeholders})`, service_ids);
    res.json({ message: `${service_ids.length} servis pasife alındı.` });
  } catch (err) {
    console.error('Bulk delete error:', err);
    res.status(500).json({ error: 'Toplu silme işleminde hata oluştu.' });
  }
});

// BULK STATUS UPDATE (ACTIVE/INACTIVE)
router.post('/services/bulk-status', validate(bulkStatusSchema), async (req, res) => {
  try {
    const { service_ids, status } = req.body;

    const placeholders = service_ids.map(() => '?').join(',');
    await dbAsync.run(`UPDATE services SET status = ? WHERE id IN (${placeholders})`, [status, ...service_ids]);
    res.json({ message: `${service_ids.length} adet servisin durumu güncellendi!` });
  } catch (err) {
    console.error('Bulk status error:', err);
    res.status(500).json({ error: 'Toplu durum güncellemede hata oluştu.' });
  }
});

// USERS MANAGEMENT
router.get('/users', async (req, res) => {
  try {
    const users = await dbAsync.all(`SELECT id, username, email, role, balance, created_at FROM users ORDER BY id DESC`);
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Kullanıcılar alınamadı.' });
  }
});

router.post('/users/:id/balance', requireIdParam, validate(userBalanceSchema), async (req, res) => {
  try {
    const userId = req.recordId;
    const { amount, action } = req.body; // action: 'add' or 'subtract'
    const amountKurus = toKurus(amount);

    if (action === 'subtract') {
      const result = await dbAsync.run(`UPDATE users SET balance_kurus = balance_kurus - ?, balance = (balance_kurus - ?) / 100.0 WHERE id = ? AND balance_kurus >= ?`, [amountKurus, amountKurus, userId, amountKurus]);
      if (result.changes !== 1) return res.status(400).json({ error: 'Kullanıcı bulunamadı veya bakiyesi yetersiz.' });
    } else {
      const result = await dbAsync.run(`UPDATE users SET balance_kurus = balance_kurus + ?, balance = (balance_kurus + ?) / 100.0 WHERE id = ?`, [amountKurus, amountKurus, userId]);
      if (result.changes !== 1) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    }

    const updated = await dbAsync.get(`SELECT balance_kurus FROM users WHERE id = ?`, [userId]);
    await dbAsync.run('INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, 'admin_balance_adjusted', 'user', String(userId), JSON.stringify({ action, amount_kurus: amountKurus }), req.ip]);
    res.json({ message: 'Kullanıcı bakiyesi güncellendi.', new_balance: fromKurus(updated.balance_kurus) });
  } catch (err) {
    res.status(500).json({ error: 'Bakiye güncellenemedi.' });
  }
});

// ALL ORDERS MANAGEMENT
router.get('/orders', async (req, res) => {
  try {
    const orders = await dbAsync.all(
      `SELECT o.*, u.username, s.name as service_name, p.name as provider_name
       FROM orders o
       JOIN users u ON o.user_id = u.id
       JOIN services s ON o.service_id = s.id
       LEFT JOIN providers p ON o.provider_id = p.id
       ORDER BY o.id DESC LIMIT 100`
    );
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: 'Siparişler alınamadı.' });
  }
});

router.put('/orders/:id/status', requireIdParam, validate(orderStatusSchema), async (req, res) => {
  try {
    const orderId = req.recordId;
    const { status } = req.body;
    await withTransaction(async tx => {
      const order = await tx.get(`SELECT * FROM orders WHERE id = ?`, [orderId]);
      if (!order) { const err = new Error('Sipariş bulunamadı.'); err.status = 404; throw err; }
      if (order.status === 'canceled' && status !== 'canceled') { const err = new Error('İptal edilmiş sipariş yeniden açılamaz.'); err.status = 409; throw err; }
      if (status === 'canceled' && order.refunded_kurus === 0) {
        const refund = order.charge_kurus || toKurus(order.charge);
        await tx.run('UPDATE users SET balance_kurus = balance_kurus + ?, balance = (balance_kurus + ?) / 100.0 WHERE id = ?', [refund, refund, order.user_id]);
        await tx.run('UPDATE orders SET status = ?, refunded_kurus = ? WHERE id = ?', [status, refund, orderId]);
      } else {
        await tx.run('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
      }
      await tx.run('INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)', [req.user.id, 'order_status_changed', 'order', String(orderId), JSON.stringify({ from: order.status, to: status }), req.ip]);
    });
    res.json({ message: 'Sipariş durumu güncellendi.' });
  } catch (err) {
    res.status(500).json({ error: 'Durum güncellenemedi.' });
  }
});

// RESET DEMO DATA
router.post('/reset-demo-data', async (req, res) => {
  try {
    const { clearAllDemoData } = require('../config/database');
    await clearAllDemoData(true); // Keep current admin account
    res.json({ message: 'Tüm demo kullanıcılar, sağlayıcılar, servisler ve test siparişleri temizlendi! Sistem şu an tertemiz ve gerçek verilerinize hazır.' });
  } catch (err) {
    console.error('Reset demo data error:', err);
    res.status(500).json({ error: 'Demo veriler temizlenirken bir sorun oluştu.' });
  }
});

// CHANGE ADMIN PASSWORD
router.post('/change-password', validate(changePasswordSchema), async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const current = await dbAsync.get('SELECT password FROM users WHERE id = ?', [req.user.id]);
    if (!await bcrypt.compare(current_password, current.password)) return res.status(400).json({ error: 'Mevcut şifre hatalı.' });
    const hashed = await bcrypt.hash(new_password, 12);
    await dbAsync.run(`UPDATE users SET password = ?, must_change_password = 0, token_version = token_version + 1 WHERE id = ?`, [hashed, req.user.id]);
    res.clearCookie('smm_session', { path: '/' });
    res.json({ message: 'Admin şifreniz güncellendi. Lütfen yeniden giriş yapın.' });
  } catch (err) {
    res.status(500).json({ error: 'Şifre değiştirilemedi.' });
  }
});

// SITE SETTINGS
router.get('/settings', async (req, res) => {
  try {
    const rows = await dbAsync.all(`SELECT * FROM site_settings`);
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: 'Ayarlar yüklenemedi.' });
  }
});

router.post('/settings', validate(settingsSchema), async (req, res) => {
  try {
    const settingsObj = req.body;
    const allowedKeys = new Set(ALLOWED_SETTING_KEYS);
    for (const key of Object.keys(settingsObj).filter(key => allowedKeys.has(key))) {
      const value = String(settingsObj[key]);
      if (key === 'usd_try_rate') {
        // Bos birakilan kur alani yok sayilir; okuyucular varsayilana duser.
        // Boylece form kaydi tek bir bos alan yuzunden tamamen reddedilmez.
        if (!value.trim()) continue;
        // Dolu geldiginde hesaplamalarda kullanildigi icin sayisal olmak zorunda.
        if (!(Number(value) > 0)) {
          return res.status(400).json({ error: 'USD/TRY kuru sıfırdan büyük bir sayı olmalıdır.' });
        }
      }
      await dbAsync.run(
        `INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, value]
      );
    }
    res.json({ message: 'Site ayarları kaydedildi.' });
  } catch (err) {
    res.status(500).json({ error: 'Ayarlar kaydedilemedi.' });
  }
});

// PAYMENT NOTIFICATIONS MANAGEMENT (ADMIN)
router.get('/payment-notifications', async (req, res) => {
  try {
    const notifications = await dbAsync.all(
      `SELECT pn.*, u.username, u.email FROM payment_notifications pn JOIN users u ON pn.user_id = u.id ORDER BY pn.id DESC`
    );
    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ error: 'Ödeme bildirimleri alınamadı.' });
  }
});

router.post('/payment-notifications/:id/approve', requireIdParam, async (req, res) => {
  try {
    const notifId = req.recordId;
    const approved = await withTransaction(async tx => {
      const notif = await tx.get(`SELECT * FROM payment_notifications WHERE id = ?`, [notifId]);
      if (!notif) { const err = new Error('Ödeme bildirimi bulunamadı.'); err.status = 404; throw err; }
      const claim = await tx.run("UPDATE payment_notifications SET status = 'approved' WHERE id = ? AND status = 'pending'", [notifId]);
      if (claim.changes !== 1) { const err = new Error('Bu bildirim daha önce işleme alınmış.'); err.status = 409; throw err; }
      const amountKurus = notif.amount_kurus || toKurus(notif.amount);
      await tx.run('UPDATE users SET balance_kurus = balance_kurus + ?, balance = (balance_kurus + ?) / 100.0 WHERE id = ?', [amountKurus, amountKurus, notif.user_id]);
      const txId = createOpaqueToken('BANK_').slice(0, 28);
      await tx.run(`INSERT INTO payments (user_id, amount, amount_kurus, method, status, transaction_id) VALUES (?, ?, ?, ?, 'completed', ?)`, [notif.user_id, fromKurus(amountKurus), amountKurus, `Banka/Papara (${normalizePlainText(notif.bank_name, 80)})`, txId]);
      await tx.run('INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)', [req.user.id, 'payment_approved', 'payment_notification', String(notifId), JSON.stringify({ amount_kurus: amountKurus, user_id: notif.user_id }), req.ip]);
      return amountKurus;
    });
    res.json({ message: `₺${fromKurus(approved).toFixed(2)} ödeme onaylandı.` });
  } catch (err) {
    res.status(500).json({ error: 'Ödeme onaylanamadı.' });
  }
});

router.post('/payment-notifications/:id/reject', requireIdParam, async (req, res) => {
  try {
    // Yalnizca bekleyen bildirimler reddedilebilir; onaylanmis bir bildirimin
    // durumu geri alinip bakiye tutarsizligi olusturulamaz.
    const claim = await dbAsync.run(`UPDATE payment_notifications SET status = 'rejected' WHERE id = ? AND status = 'pending'`, [req.recordId]);
    if (claim.changes !== 1) return res.status(409).json({ error: 'Bu bildirim daha önce işleme alınmış veya bulunamadı.' });
    res.json({ message: 'Ödeme bildirimi reddedildi.' });
  } catch (err) {
    res.status(500).json({ error: 'İşlem gerçekleştirilemedi.' });
  }
});

// COUPONS MANAGEMENT (ADMIN)
router.get('/coupons', async (req, res) => {
  try {
    const coupons = await dbAsync.all(`SELECT * FROM coupons ORDER BY id DESC`);
    res.json({ coupons });
  } catch (err) {
    res.status(500).json({ error: 'Kuponlar alınamadı.' });
  }
});

router.post('/coupons', validate(couponSchema), async (req, res) => {
  try {
    const { code, amount, max_uses } = req.body;
    const cleanCode = normalizePlainText(code, 64).toUpperCase();
    if (!cleanCode) return res.status(400).json({ error: 'Lütfen geçerli bir kupon kodu girin.' });

    await dbAsync.run(
      `INSERT INTO coupons (code, amount, amount_kurus, max_uses) VALUES (?, ?, ?, ?)`,
      [cleanCode, amount, toKurus(amount), max_uses]
    );

    res.json({ message: `"${cleanCode}" promosyon kuponu başarıyla oluşturuldu!` });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Bu kupon kodu zaten mevcut.' });
    }
    res.status(500).json({ error: 'Kupon oluşturulamadı.' });
  }
});

router.delete('/coupons/:id', requireIdParam, async (req, res) => {
  try {
    await dbAsync.run(`DELETE FROM coupons WHERE id = ?`, [req.recordId]);
    res.json({ message: 'Kupon silindi.' });
  } catch (err) {
    res.status(500).json({ error: 'Kupon silinemedi.' });
  }
});

// BLOG MANAGEMENT (ADMIN)
router.get('/blog', async (req, res) => {
  try {
    const posts = await dbAsync.all(`SELECT * FROM blog_posts ORDER BY id DESC`);
    res.json({ posts });
  } catch (err) {
    res.status(500).json({ error: 'Blog yazıları alınamadı.' });
  }
});

router.post('/blog', async (req, res) => {
  try {
    const { title, title_tr, title_en, category, category_tr, category_en, summary, summary_tr, summary_en,
      content, content_tr, content_en, image_url, seo_title_tr, seo_title_en, seo_description_tr,
      seo_description_en, status, reading_minutes } = req.body;
    const safeTitleTr = normalizePlainText(title_tr || title, 180);
    const safeTitleEn = normalizePlainText(title_en || title_tr || title, 180);
    if (!safeTitleTr || !safeTitleEn || !(content_tr || content) || !(content_en || content_tr || content)) {
      return res.status(400).json({ error: 'TR/EN başlık ve içerik gereklidir.' });
    }
    const slug = safeTitleTr.toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.floor(1000 + Math.random() * 9000);
    const postStatus = status === 'draft' ? 'draft' : 'published';
    const safeSummaryTr = normalizePlainText(summary_tr || summary || content_tr || content, 320);
    const safeSummaryEn = normalizePlainText(summary_en || content_en || safeSummaryTr, 320);
    const generatedCover = await chooseBlogCover(dbAsync, `${safeTitleTr} ${safeTitleEn} ${category_tr || category || ''}`);
    const safeImageUrl = isSafeHttpUrl(image_url || '') || isLocalBlogCover(image_url) ? image_url : generatedCover;
    await dbAsync.run(
      `INSERT INTO blog_posts (title, slug, category, summary, content, image_url, title_tr, title_en, category_tr, category_en,
       summary_tr, summary_en, content_tr, content_en, seo_title_tr, seo_title_en, seo_description_tr, seo_description_en,
       status, author_id, reading_minutes, updated_at, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CASE WHEN ? = 'published' THEN CURRENT_TIMESTAMP ELSE NULL END)`,
      [safeTitleTr, slug, normalizePlainText(category_tr || category || 'Sosyal Medya', 80), safeSummaryTr,
       sanitizeRichText(content_tr || content), safeImageUrl, safeTitleTr, safeTitleEn,
       normalizePlainText(category_tr || category || 'Sosyal Medya', 80), normalizePlainText(category_en || 'Social Media', 80),
       safeSummaryTr, safeSummaryEn,
       sanitizeRichText(content_tr || content), sanitizeRichText(content_en || content_tr || content),
       normalizePlainText(seo_title_tr || safeTitleTr, 180), normalizePlainText(seo_title_en || safeTitleEn, 180),
       normalizePlainText(seo_description_tr || summary_tr || summary || '', 500), normalizePlainText(seo_description_en || summary_en || '', 500),
       postStatus, req.user.id, Math.max(1, Math.min(60, parseInt(reading_minutes || 3))), postStatus]
    );
    res.json({ message: postStatus === 'draft' ? 'Blog taslağı kaydedildi.' : 'Blog yazısı yayınlandı!' });
  } catch (err) {
    res.status(500).json({ error: 'Blog eklenemedi.' });
  }
});

router.put('/blog/:id', requireIdParam, async (req, res) => {
  try {
    const current = await dbAsync.get('SELECT * FROM blog_posts WHERE id = ?', [req.recordId]);
    if (!current) return res.status(404).json({ error: 'Blog yazısı bulunamadı.' });
    const titleTr = normalizePlainText(req.body.title_tr || current.title_tr || current.title, 180);
    const titleEn = normalizePlainText(req.body.title_en || current.title_en || current.title, 180);
    const status = req.body.status === 'draft' ? 'draft' : 'published';
    const requestedImage = req.body.image_url ?? current.image_url ?? '';
    const safeImageUrl = isSafeHttpUrl(requestedImage) || isLocalBlogCover(requestedImage)
      ? requestedImage
      : await chooseBlogCover(dbAsync, `${titleTr} ${titleEn} ${req.body.category_tr || current.category_tr || current.category || ''}`);
    await dbAsync.run(`UPDATE blog_posts SET title = ?, title_tr = ?, title_en = ?, category = ?, category_tr = ?, category_en = ?,
      summary = ?, summary_tr = ?, summary_en = ?, content = ?, content_tr = ?, content_en = ?, image_url = ?,
      seo_title_tr = ?, seo_title_en = ?, seo_description_tr = ?, seo_description_en = ?, status = ?, reading_minutes = ?,
      updated_at = CURRENT_TIMESTAMP, published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, CURRENT_TIMESTAMP) ELSE NULL END WHERE id = ?`, [
      titleTr, titleTr, titleEn, normalizePlainText(req.body.category_tr || current.category_tr || current.category, 80),
      normalizePlainText(req.body.category_tr || current.category_tr || current.category, 80), normalizePlainText(req.body.category_en || current.category_en || current.category, 80),
      normalizePlainText(req.body.summary_tr ?? current.summary_tr ?? current.summary ?? '', 500), normalizePlainText(req.body.summary_tr ?? current.summary_tr ?? current.summary ?? '', 500),
      normalizePlainText(req.body.summary_en ?? current.summary_en ?? current.summary ?? '', 500), sanitizeRichText(req.body.content_tr ?? current.content_tr ?? current.content),
      sanitizeRichText(req.body.content_tr ?? current.content_tr ?? current.content), sanitizeRichText(req.body.content_en ?? current.content_en ?? current.content),
      safeImageUrl, normalizePlainText(req.body.seo_title_tr || titleTr, 180),
      normalizePlainText(req.body.seo_title_en || titleEn, 180), normalizePlainText(req.body.seo_description_tr || '', 500),
      normalizePlainText(req.body.seo_description_en || '', 500), status, Math.max(1, Math.min(60, parseInt(req.body.reading_minutes || current.reading_minutes || 3))), status, req.recordId
    ]);
    res.json({ message: 'Blog yazısı güncellendi.' });
  } catch (err) {
    res.status(500).json({ error: 'Blog güncellenemedi.' });
  }
});

router.delete('/blog/:id', requireIdParam, async (req, res) => {
  try {
    await dbAsync.run(`DELETE FROM blog_posts WHERE id = ?`, [req.recordId]);
    res.json({ message: 'Blog yazısı silindi.' });
  } catch (err) {
    res.status(500).json({ error: 'Blog silinemedi.' });
  }
});

// LANDING PLATFORMS MANAGEMENT (ADMIN)
router.get('/landing-platforms', async (req, res) => {
  try {
    const platforms = await dbAsync.all(`SELECT * FROM landing_platforms ORDER BY sort_order ASC, id ASC`);
    res.json({ platforms });
  } catch (err) {
    res.status(500).json({ error: 'Platformlar alınamadı.' });
  }
});

router.post('/landing-platforms', validate(platformSchema), async (req, res) => {
  try {
    const { name, icon } = req.body;
    await dbAsync.run(`INSERT INTO landing_platforms (name, icon, status) VALUES (?, ?, 1)`, [normalizePlainText(name, 80), normalizePlainText(icon, 80)]);
    res.json({ message: 'Yeni platform eklendi!' });
  } catch (err) {
    res.status(500).json({ error: 'Platform eklenemedi.' });
  }
});

router.put('/landing-platforms/:id/status', requireIdParam, validate(statusOnlySchema), async (req, res) => {
  try {
    await dbAsync.run(`UPDATE landing_platforms SET status = ? WHERE id = ?`, [req.body.status, req.recordId]);
    res.json({ message: 'Platform durumu güncellendi.' });
  } catch (err) {
    res.status(500).json({ error: 'Güncellenemedi.' });
  }
});

router.delete('/landing-platforms/:id', requireIdParam, async (req, res) => {
  try {
    await dbAsync.run(`DELETE FROM landing_platforms WHERE id = ?`, [req.recordId]);
    res.json({ message: 'Platform silindi.' });
  } catch (err) {
    res.status(500).json({ error: 'Silinemedi.' });
  }
});

// FEATURED CARDS MANAGEMENT (ADMIN)
router.get('/featured-cards', async (req, res) => {
  try {
    const cards = await dbAsync.all(`SELECT * FROM featured_cards ORDER BY sort_order ASC, id ASC`);
    res.json({ cards });
  } catch (err) {
    res.status(500).json({ error: 'Kartlar alınamadı.' });
  }
});

router.post('/featured-cards', validate(featuredCardSchema), async (req, res) => {
  try {
    const { title, subtitle, highlight } = req.body;
    await dbAsync.run(`INSERT INTO featured_cards (title, subtitle, highlight, status) VALUES (?, ?, ?, 1)`, [normalizePlainText(title, 120), normalizePlainText(subtitle || '', 120), normalizePlainText(highlight || '', 120)]);
    res.json({ message: 'Öne çıkan kart eklendi!' });
  } catch (err) {
    res.status(500).json({ error: 'Kart eklenemedi.' });
  }
});

router.put('/featured-cards/:id/status', requireIdParam, validate(statusOnlySchema), async (req, res) => {
  try {
    await dbAsync.run(`UPDATE featured_cards SET status = ? WHERE id = ?`, [req.body.status, req.recordId]);
    res.json({ message: 'Kart durumu güncellendi.' });
  } catch (err) {
    res.status(500).json({ error: 'Güncellenemedi.' });
  }
});

router.delete('/featured-cards/:id', requireIdParam, async (req, res) => {
  try {
    await dbAsync.run(`DELETE FROM featured_cards WHERE id = ?`, [req.recordId]);
    res.json({ message: 'Kart silindi.' });
  } catch (err) {
    res.status(500).json({ error: 'Silinemedi.' });
  }
});

module.exports = router;
