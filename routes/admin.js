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
const { toKurus, fromKurus, calculateChargeKurus } = require('../utils/money');
const { friendlyProviderReason } = require('../utils/providerErrors');
const { fetchProviderCatalog } = require('../services/providerCatalog');
const { chooseBlogCover, isLocalBlogCover } = require('../services/blogCover');
const telegram = require('../services/telegramNotifier');
const { buildXlsx, columnsFromRows } = require('../utils/xlsx');
const { buildMetaDescription } = require('../utils/metaDescription');

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
  // Istege bagli Ingilizce takma kod: iki kod ayni kuponu (ortak limit) kullanir.
  code_en: z.string().trim().max(64).optional().nullable(),
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
  // Blog yazari kimligi: gorunur imza + Person yapisal verisi (E-E-A-T).
  'blog_author_name', 'blog_author_title', 'blog_author_url',
  'bank_accounts', 'hero_title_tr', 'hero_title_en', 'hero_subtitle_tr', 'hero_subtitle_en',
  'announcement_tr', 'announcement_en', 'usd_try_rate',
  // Telegram bot bildirimleri (yeni kayit / yeni siparis)
  'telegram_bot_token', 'telegram_chat_id', 'telegram_notify_register', 'telegram_notify_order', 'telegram_notify_payment', 'telegram_notify_ticket',
  // Pazarlama: sosyal kanit seridi ve hatirlatma e-postasi anahtarlari
  'social_proof_enabled', 'reminder_email_enabled',
  // NOWPayments kripto odeme anahtarlari
  'nowpayments_api_key', 'nowpayments_ipn_secret',
  // SMTP (e-posta) ayarlari
  'smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_pass', 'mail_from',
  // SEO & analitik: GA olcum kimligi, Search Console ve Bing Webmaster dogrulama kodlari
  'google_analytics_id', 'google_site_verification', 'bing_site_verification',
  // Duyuru bandinin "acilisa ozel" kutlama gorunumu
  'announcement_special',
  // Saglayici bakiye uyari esigi (saglayicinin para biriminde; bos/0 = kapali)
  'provider_balance_threshold',
  // Sosyal profil adresleri: alt bilgideki baglantilar + Organization sameAs
  'social_instagram', 'social_x', 'social_youtube', 'social_tiktok',
  // Fiziksel isletme adresi: yapisal veride PostalAddress olarak yayinlanir
  'business_address'];
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
  // Saglayiciya odenen gercek birim maliyet. Kar/zarar raporu bu alana dayanir;
  // kaydedilmezse "Tedarikciye Giden" her zaman 0 gorunur.
  provider_cost_rate: z.coerce.number().finite().min(0).max(1_000_000).optional(),
  provider_cost_currency: z.string().trim().max(10).optional(),
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
    // Ciro: musteriden gercekten tahsil kalan tutar. Iptal/basarisiz siparisler
    // tamamen, kismi siparisler kismen iade edildigi icin charge yerine
    // (charge - iade) toplanir; boylece iade edilen para ciroda gorunmez.
    const revenueRow = await dbAsync.get(
      `SELECT COALESCE(SUM(charge_kurus - refunded_kurus), 0) as net_kurus FROM orders`
    );

    // Siparis sayilari durum kiriliminda: "toplam" yalnizca gecerli (iptal ve
    // basarisiz olmayan) siparisleri sayar; iptal/basarisiz ayrica raporlanir.
    const orderCountsRow = await dbAsync.get(`
      SELECT
        COUNT(*) as all_count,
        SUM(CASE WHEN status NOT IN ('canceled','failed') THEN 1 ELSE 0 END) as valid_count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
        SUM(CASE WHEN status IN ('pending','processing') THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial_count,
        SUM(CASE WHEN status = 'canceled' THEN 1 ELSE 0 END) as canceled_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
      FROM orders
    `);

    // Tedarikci maliyeti: saglayiciya gercekten iletilen siparislerde
    // miktar x saglayici birim maliyeti (1000 adet basina). Kismi teslimatta
    // yalnizca teslim edilen kisim maliyet sayilir. Maliyet, servis uzerindeki
    // guncel saglayici fiyatindan hesaplanir (siparis anindaki fiyat saklanmaz,
    // bu yuzden yaklasik bir degerdir); doviz kuru ayarlardaki usd_try_rate'tir.
    const costRows = await dbAsync.all(`
      SELECT COALESCE(s.provider_cost_currency, 'USD') as currency,
             SUM((o.quantity - CASE WHEN o.status = 'partial' THEN COALESCE(o.remains, 0) ELSE 0 END)
                 * s.provider_cost_rate / 1000.0) as cost
      FROM orders o
      JOIN services s ON o.service_id = s.id
      WHERE o.status IN ('pending','processing','completed','partial')
        AND s.provider_cost_rate > 0
      GROUP BY COALESCE(s.provider_cost_currency, 'USD')
    `);
    const exchangeSetting = await dbAsync.get("SELECT value FROM site_settings WHERE key = 'usd_try_rate'");
    const usdTryRate = Number(exchangeSetting?.value) > 0 ? Number(exchangeSetting.value) : 35;
    // Hem saglayiciya gercekten odenen doviz tutari hem de panel kuruyla TL
    // karsiligi ayri ayri tutulur; admin ikisini de gorur.
    let providerCostTry = 0;
    let providerCostUsd = 0;
    for (const row of costRows) {
      const cost = Number(row.cost) || 0;
      if (String(row.currency).toUpperCase() === 'TRY') {
        providerCostTry += cost;
        providerCostUsd += usdTryRate > 0 ? cost / usdTryRate : 0;
      } else {
        providerCostTry += cost * usdTryRate;
        providerCostUsd += cost;
      }
    }

    // Maliyeti bilinmeyen (saglayici fiyati olmayan / manuel) servislerdeki
    // gecerli siparis sayisi; kar hesabinin neyi kapsamadigini gosterir.
    const unknownCostRow = await dbAsync.get(`
      SELECT COUNT(*) as count FROM orders o
      JOIN services s ON o.service_id = s.id
      WHERE o.status IN ('pending','processing','completed','partial')
        AND (s.provider_cost_rate IS NULL OR s.provider_cost_rate <= 0)
    `);

    // Son 30 gunun gunluk ciro/maliyet serisi (grafik icin). Maliyet, guncel
    // saglayici fiyatiyla yaklasik hesaplanir ve kur uzerinden TL'ye cevrilir.
    const dailyRevenueRows = await dbAsync.all(`
      SELECT date(created_at) as day, SUM(charge_kurus - refunded_kurus) as net_kurus
      FROM orders WHERE created_at >= date('now', '-29 days')
      GROUP BY date(created_at)
    `);
    const dailyCostRows = await dbAsync.all(`
      SELECT date(o.created_at) as day, COALESCE(s.provider_cost_currency, 'USD') as currency,
             SUM((o.quantity - CASE WHEN o.status = 'partial' THEN COALESCE(o.remains, 0) ELSE 0 END)
                 * s.provider_cost_rate / 1000.0) as cost
      FROM orders o JOIN services s ON o.service_id = s.id
      WHERE o.created_at >= date('now', '-29 days')
        AND o.status IN ('pending','processing','completed','partial')
        AND s.provider_cost_rate > 0
      GROUP BY date(o.created_at), COALESCE(s.provider_cost_currency, 'USD')
    `);
    const revenueByDay = new Map(dailyRevenueRows.map(row => [row.day, fromKurus(row.net_kurus || 0)]));
    const costByDay = new Map();
    for (const row of dailyCostRows) {
      const cost = (Number(row.cost) || 0) * (String(row.currency).toUpperCase() === 'TRY' ? 1 : usdTryRate);
      costByDay.set(row.day, (costByDay.get(row.day) || 0) + cost);
    }
    const dailySeries = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const revenue = revenueByDay.get(date) || 0;
      const cost = costByDay.get(date) || 0;
      dailySeries.push({
        day: date,
        revenue: Math.round(revenue * 100) / 100,
        profit: Math.round((revenue - cost) * 100) / 100
      });
    }

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

    const totalRevenue = fromKurus(revenueRow.net_kurus || 0);
    res.json({
      stats: {
        total_revenue: totalRevenue,
        provider_cost: Math.round(providerCostTry * 100) / 100,
        provider_cost_usd: Math.round(providerCostUsd * 100) / 100,
        net_profit: Math.round((totalRevenue - providerCostTry) * 100) / 100,
        orders_without_cost: unknownCostRow.count || 0,
        usd_try_rate: usdTryRate,
        total_orders: orderCountsRow.valid_count || 0,
        completed_orders: orderCountsRow.completed_count || 0,
        active_orders: orderCountsRow.active_count || 0,
        partial_orders: orderCountsRow.partial_count || 0,
        canceled_orders: orderCountsRow.canceled_count || 0,
        failed_orders: orderCountsRow.failed_count || 0,
        total_users: totalUsersRow.count || 0,
        active_providers: activeProvidersRow.count || 0,
        pending_tickets: pendingTicketsRow.count || 0
        , pending_deposits: pendingDepositsRow.count || 0
      },
      dailySeries,
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

    // Saglayici fiyatlari genelde USD'dir. Once bakiye ucundan para birimini
    // ogrenip satis fiyatini KUR ile TL'ye ceviriyoruz. Bu yapilmazsa 1.50 $'lik
    // servis 1,50 ₺ sanilip zararina satilir.
    let providerCurrency = 'USD';
    try {
      const balance = await client.getBalance();
      providerCurrency = String(balance?.currency || 'USD').toUpperCase().slice(0, 10) || 'USD';
    } catch { /* para birimi okunamazsa USD varsayilir */ }
    const rateSetting = await dbAsync.get("SELECT value FROM site_settings WHERE key = 'usd_try_rate'");
    const usdTryRate = Number(rateSetting?.value) > 0 ? Number(rateSetting.value) : 35;
    const toTry = value => providerCurrency === 'TRY' ? value : value * usdTryRate;

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

      // Satis fiyati: saglayici maliyeti -> TL -> kar marji
      const rawRate = parseFloat(pService.rate || pService.price || pService.cost || 10);
      const calculatedRate = (toTry(rawRate) * profitMultiplier).toFixed(2);
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
          `INSERT INTO services (category_id, provider_id, provider_service_id, name, rate_per_1000, rate_per_1000_kurus,
           provider_cost_rate, provider_cost_currency, provider_cost_updated_at, min_quantity, max_quantity, description, status, refill)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, 1, ?)`,
          [
            category.id,
            providerId,
            pServiceId,
            serviceName,
            calculatedRate,
            toKurus(calculatedRate),
            // Saglayici birim maliyeti burada zaten elimizde; kaydedilmezse
            // kar/zarar raporu bos kalir.
            Number.isFinite(rawRate) && rawRate > 0 ? rawRate : null,
            providerCurrency,
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
    // Fiyatlarin hangi para biriminde oldugu ve panelin kuru: explorer'daki
    // satis fiyati hesabi bunlar olmadan yanlis cikar.
    let providerCurrency = 'USD';
    try {
      const balance = await client.getBalance();
      providerCurrency = String(balance?.currency || 'USD').toUpperCase().slice(0, 10) || 'USD';
    } catch { /* okunamazsa USD varsayilir */ }
    const rateSetting = await dbAsync.get("SELECT value FROM site_settings WHERE key = 'usd_try_rate'");

    res.json({
      services: safeServices,
      total: safeServices.length,
      provider_name: normalizePlainText(provider.name, 100),
      currency: providerCurrency,
      usd_try_rate: Number(rateSetting?.value) > 0 ? Number(rateSetting.value) : 35
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Sağlayıcı servisleri alınamadı.' });
  }
});

// --- EXCEL DISA AKTARMA ----------------------------------------------------
// Katalogtaki TUM basliklar aktarilir: sutunlar veriden dinamik kesfedilir,
// boylece sonradan eklenen bir alan da otomatik olarak dosyaya girer.

// Bilinen alanlar icin Turkce baslik; listede olmayanlar ham adiyla cikar.
const SERVICE_EXPORT_LABELS = {
  id: 'Servis ID', category_id: 'Kategori ID', category_name: 'Kategori',
  category_name_en: 'Kategori (EN)', provider_id: 'Sağlayıcı ID',
  provider_name: 'Sağlayıcı Adı', provider_service_id: 'Sağlayıcıdaki Servis ID',
  name: 'Servis Adı', name_tr: 'Servis Adı (TR)', name_en: 'Servis Adı (EN)',
  description: 'Açıklama', description_tr: 'Açıklama (TR)', description_en: 'Açıklama (EN)',
  rate_per_1000: 'Satış Fiyatı (₺/1000)', rate_per_1000_kurus: 'Satış Fiyatı (kuruş)',
  rate_per_1000_usd_cents: 'Satış Fiyatı (cent/1000)',
  provider_cost_rate: 'Sağlayıcı Maliyeti', provider_cost_currency: 'Maliyet Para Birimi',
  provider_cost_updated_at: 'Maliyet Güncelleme', min_quantity: 'Min. Adet',
  max_quantity: 'Maks. Adet', refill: 'Telafi (Refill)', status: 'Durum'
};

const PROVIDER_EXPORT_LABELS = {
  service: 'Sağlayıcı Servis ID', name: 'Servis Adı', category: 'Kategori',
  type: 'Tip', rate: 'Sağlayıcı Fiyatı (1000 adet)', min: 'Min. Adet', max: 'Maks. Adet',
  refill: 'Telafi (Refill)', cancel: 'İptal Edilebilir', dripfeed: 'Damla Besleme',
  description: 'Açıklama', currency: 'Para Birimi'
};

// Excel'de 1/0 yerine okunabilir metin gosterilir.
const BOOLEAN_LIKE = new Set(['refill', 'cancel', 'dripfeed']);

function prepareExportRow(row, { statusAsText = false } = {}) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) { out[key] = ''; continue; }
    if (key === 'status' && statusAsText) { out[key] = Number(value) === 1 ? 'Aktif' : 'Pasif'; continue; }
    if (BOOLEAN_LIKE.has(key) && (value === 0 || value === 1 || value === true || value === false)) {
      out[key] = (value === 1 || value === true) ? 'Evet' : 'Hayır';
      continue;
    }
    // Nesne/dizi donen saglayici alanlari hucrede [object Object] olmasin.
    out[key] = (typeof value === 'object') ? JSON.stringify(value) : value;
  }
  return out;
}

// Dosya adindaki tarih ve tirnak/aksan sorunlarina karsi guvenli ad uretir.
function exportFileName(prefix) {
  const stamp = new Date().toISOString().slice(0, 10);
  const safe = String(prefix).replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'liste';
  return `${safe}-${stamp}.xlsx`;
}

function sendXlsx(res, buffer, fileName) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  // filename* (RFC 5987) sayesinde Turkce karakterli adlar da bozulmaz.
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Cache-Control', 'no-store');
  res.end(buffer);
}

// Sitedeki servisler: aktif / pasif / tumu
router.get('/services/export', async (req, res) => {
  try {
    const scope = ['active', 'passive', 'all'].includes(req.query.status) ? req.query.status : 'all';
    const services = await dbAsync.all(`
      SELECT s.*, c.name as category_name, c.name_en as category_name_en, p.name as provider_name
      FROM services s
      JOIN categories c ON s.category_id = c.id
      LEFT JOIN providers p ON s.provider_id = p.id
      ORDER BY COALESCE(p.name, 'ZZZ'), s.id DESC
    `);

    const active = services.filter(s => Number(s.status) === 1).map(s => prepareExportRow(s, { statusAsText: true }));
    const passive = services.filter(s => Number(s.status) !== 1).map(s => prepareExportRow(s, { statusAsText: true }));

    const preferredOrder = ['id', 'name', 'name_tr', 'name_en', 'category_name', 'provider_name',
      'provider_service_id', 'rate_per_1000', 'provider_cost_rate', 'min_quantity', 'max_quantity', 'status'];
    // Sutunlar iki listenin birlesiminden cikarilir ki iki sayfa da ayni basliklara sahip olsun.
    const columns = columnsFromRows([...active, ...passive], { labels: SERVICE_EXPORT_LABELS, preferredOrder });

    const sheets = [];
    if (scope === 'active' || scope === 'all') sheets.push({ name: 'Aktif Servisler', columns, rows: active });
    if (scope === 'passive' || scope === 'all') sheets.push({ name: 'Pasif Servisler', columns, rows: passive });
    if (sheets.length === 0) sheets.push({ name: 'Servisler', columns, rows: [] });

    const namePrefix = scope === 'active' ? 'aktif-servisler' : scope === 'passive' ? 'pasif-servisler' : 'tum-servisler';
    sendXlsx(res, buildXlsx(sheets), exportFileName(namePrefix));
  } catch (err) {
    res.status(500).json({ error: 'Excel dosyası oluşturulamadı.' });
  }
});

// Saglayicinin kendi katalogundaki tum ham servisler
router.get('/providers/:id/services/export', requireIdParam, async (req, res) => {
  try {
    const provider = await dbAsync.get(`SELECT * FROM providers WHERE id = ?`, [req.recordId]);
    if (!provider) return res.status(404).json({ error: 'Sağlayıcı bulunamadı.' });

    const client = new SmmProviderClient(provider.api_url, provider.api_key);
    const rawServicesData = await client.getServices();
    let serviceList = [];
    if (Array.isArray(rawServicesData)) serviceList = rawServicesData;
    else if (rawServicesData && Array.isArray(rawServicesData.services)) serviceList = rawServicesData.services;
    else if (rawServicesData && Array.isArray(rawServicesData.data)) serviceList = rawServicesData.data;

    const rows = serviceList.slice(0, 20000).map(item => prepareExportRow({
      ...item,
      name: normalizePlainText(item.name || '', 220),
      category: normalizePlainText(item.category || 'Genel', 120),
      description: normalizePlainText(item.description || '', 1000)
    }));

    const columns = columnsFromRows(rows, {
      labels: PROVIDER_EXPORT_LABELS,
      preferredOrder: ['service', 'name', 'category', 'type', 'rate', 'min', 'max', 'refill', 'cancel', 'dripfeed']
    });

    const sheets = [{ name: provider.name || 'Sağlayıcı Kataloğu', columns, rows }];
    sendXlsx(res, buildXlsx(sheets), exportFileName(`${provider.name || 'saglayici'}-katalog`));
  } catch (err) {
    res.status(500).json({ error: err.message || 'Sağlayıcı kataloğu alınamadı.' });
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
      rate_per_1000, rate_per_1000_usd, provider_cost_rate, provider_cost_currency,
      min_quantity, max_quantity, description, description_tr, description_en, refill } = req.body;
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
       rate_per_1000_kurus, rate_per_1000_usd_cents, provider_cost_rate, provider_cost_currency, provider_cost_updated_at,
       min_quantity, max_quantity, description, description_tr, description_en, status, refill)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${Number(provider_cost_rate) > 0 ? 'CURRENT_TIMESTAMP' : 'NULL'}, ?, ?, ?, ?, ?, 1, ?)`,
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
        Number(provider_cost_rate) > 0 ? Number(provider_cost_rate) : null,
        Number(provider_cost_rate) > 0 ? String(provider_cost_currency || 'USD').toUpperCase() : null,
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
    // Siparis gecmisi VEYA bagli kampanya varsa silinemez (foreign key); pasife alinir.
    const used = await dbAsync.get(
      `SELECT 1 found FROM orders WHERE service_id = ?
       UNION ALL SELECT 1 FROM campaigns WHERE service_id = ? LIMIT 1`, [serviceId, serviceId]);
    if (used) await dbAsync.run('UPDATE services SET status = 0 WHERE id = ?', [serviceId]);
    else await dbAsync.run('DELETE FROM services WHERE id = ?', [serviceId]);
    await dbAsync.run('DELETE FROM categories WHERE NOT EXISTS (SELECT 1 FROM services WHERE services.category_id = categories.id)');
    res.json({ message: used ? 'Sipariş geçmişi korundu; servis pasife alındı.' : 'Servis silindi.' });
  } catch (err) {
    res.status(500).json({ error: 'Servis silinemedi.' });
  }
});

// BULK DELETE SERVICES
// Tekli silmeyle ayni mantik: siparis gecmisi (veya bagli kampanyasi) olan
// servis silinemez, pasife alinir; geri kalanlar gercekten SILINIR.
// Eskiden bu uc hicbir sey silmiyor, hepsini yalnizca status=0 yapiyordu;
// bu yuzden zaten pasif olan servisler "sil" denince listede kaliyordu.
const REFERENCED_SERVICE_SQL = `
  SELECT id FROM services WHERE
    id IN (SELECT service_id FROM orders WHERE service_id IS NOT NULL)
    OR id IN (SELECT service_id FROM campaigns WHERE service_id IS NOT NULL)`;

router.post('/services/bulk-delete', validate(bulkDeleteSchema), async (req, res) => {
  try {
    const { service_ids, delete_all } = req.body;

    const result = await withTransaction(async tx => {
      // Hedef kume: ya tum katalog ya da secilen id'ler
      let targetIds;
      if (delete_all) {
        targetIds = (await tx.all('SELECT id FROM services')).map(row => row.id);
      } else {
        const placeholders = service_ids.map(() => '?').join(',');
        targetIds = (await tx.all(`SELECT id FROM services WHERE id IN (${placeholders})`, service_ids)).map(row => row.id);
      }
      if (targetIds.length === 0) return { deleted: 0, kept: 0 };

      const referenced = new Set((await tx.all(REFERENCED_SERVICE_SQL)).map(row => row.id));
      const keep = targetIds.filter(id => referenced.has(id));
      const remove = targetIds.filter(id => !referenced.has(id));

      if (keep.length) {
        const ph = keep.map(() => '?').join(',');
        await tx.run(`UPDATE services SET status = 0 WHERE id IN (${ph})`, keep);
      }
      if (remove.length) {
        // 1000'lik parcalar halinde: SQLite'in parametre sinirina takilmayalim.
        for (let i = 0; i < remove.length; i += 900) {
          const chunk = remove.slice(i, i + 900);
          const ph = chunk.map(() => '?').join(',');
          await tx.run(`DELETE FROM services WHERE id IN (${ph})`, chunk);
        }
      }
      // Servisi kalmayan kategoriler listeyi kirletmesin.
      await tx.run('DELETE FROM categories WHERE NOT EXISTS (SELECT 1 FROM services WHERE services.category_id = categories.id)');

      return { deleted: remove.length, kept: keep.length };
    });

    // Ne olduğu net yazilir; "silindi" deyip pasife almak kafa karistiriyordu.
    const parts = [];
    if (result.deleted > 0) parts.push(`${result.deleted} servis silindi`);
    if (result.kept > 0) parts.push(`${result.kept} servis sipariş geçmişi olduğu için silinemedi, pasife alındı`);
    if (parts.length === 0) parts.push('Silinecek servis bulunamadı');

    res.json({ message: parts.join('; ') + '.', deleted: result.deleted, kept: result.kept });
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

// ---------------------------------------------------------------------------
// ISTATISTIK PANELI
// Ziyaretci (tekil), satin alinan servisler ve blog okunmalari.
// ---------------------------------------------------------------------------
router.get('/statistics', async (req, res) => {
  try {
    const { getVisitorStats } = require('../services/visitorTracker');

    const [visitors, services, blogPosts, orderTotals] = await Promise.all([
      getVisitorStats(),

      // Yalnizca SATIN ALINMIS servisler: orders ile JOIN edildigi icin hic
      // siparis almamis servisler listeye zaten girmez. Iptal/basarisiz
      // siparisler satis sayilmaz.
      dbAsync.all(`
        SELECT s.id, s.name, s.name_tr, s.name_en, s.status,
               c.name AS category_name, p.name AS provider_name,
               COUNT(o.id) AS order_count,
               SUM(o.quantity) AS total_quantity,
               SUM(o.charge_kurus - COALESCE(o.refunded_kurus, 0)) AS net_kurus,
               MAX(o.created_at) AS last_ordered_at
        FROM orders o
        JOIN services s ON s.id = o.service_id
        LEFT JOIN categories c ON c.id = s.category_id
        LEFT JOIN providers p ON p.id = s.provider_id
        WHERE o.status NOT IN ('canceled', 'failed')
        GROUP BY s.id
        ORDER BY order_count DESC, net_kurus DESC
      `),

      dbAsync.all(`
        SELECT id, slug, status, views,
               COALESCE(title_tr, title) AS title,
               COALESCE(category_tr, category) AS category,
               published_at, created_at
        FROM blog_posts
        ORDER BY COALESCE(views, 0) DESC, id DESC
      `),

      dbAsync.get(`
        SELECT COUNT(*) AS orders, COUNT(DISTINCT service_id) AS services
        FROM orders WHERE status NOT IN ('canceled', 'failed')
      `)
    ]);

    res.json({
      visitors,
      services: services.map(row => ({
        ...row,
        net_revenue: fromKurus(row.net_kurus || 0)
      })),
      blog: {
        posts: blogPosts,
        total_views: blogPosts.reduce((sum, p) => sum + (p.views || 0), 0),
        published: blogPosts.filter(p => p.status === 'published').length
      },
      totals: {
        purchased_services: orderTotals?.services || 0,
        valid_orders: orderTotals?.orders || 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'İstatistikler alınamadı.' });
  }
});

// USERS MANAGEMENT
router.get('/users', async (req, res) => {
  try {
    // ?q= kullanici adi veya e-postada gecen metni arar (buyuk/kucuk harf duyarsiz).
    const q = String(req.query.q || '').trim().slice(0, 100);
    let sql = `SELECT id, username, email, role, balance, banned, created_at FROM users`;
    const params = [];
    if (q) {
      // LIKE joker karakterleri aramada birebir metin sayilir.
      const like = `%${q.replace(/[\\%_]/g, ch => `\\${ch}`)}%`;
      sql += ` WHERE username LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\'`;
      params.push(like, like);
    }
    sql += ` ORDER BY id DESC LIMIT 500`;
    const users = await dbAsync.all(sql, params);
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Kullanıcılar alınamadı.' });
  }
});

// Yonetici hedef kullaniciyi banlar/aktive eder. Admin hesaplar ve kendisi
// hedeflenemez; ban aninda token_version artirilarak acik oturumlar dusurulur.
// KULLANICIYA OZEL HIZMET ATAMA: admin, secilen kullanici adina siparis
// olusturur. "Hediye" modunda kullanici bakiyesinden hicbir sey dusmez;
// "bakiyeden dus" modunda normal siparis gibi tahsil edilir.
const assignOrderSchema = z.object({
  service_id: z.coerce.number().int().positive(),
  link: z.string().trim().min(3).max(2048),
  quantity: quantityField,
  charge_user: z.coerce.boolean().default(false)
});

router.post('/users/:id/assign-order', requireIdParam, validate(assignOrderSchema), async (req, res) => {
  try {
    const userId = req.recordId;
    const { service_id, quantity, charge_user } = req.body;
    const link = normalizePlainText(req.body.link, 2048);

    const targetUser = await dbAsync.get('SELECT id, username, banned FROM users WHERE id = ?', [userId]);
    if (!targetUser) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    if (targetUser.banned) return res.status(400).json({ error: 'Banlı kullanıcıya hizmet atanamaz.' });

    const reserved = await withTransaction(async tx => {
      const service = await tx.get('SELECT * FROM services WHERE id = ? AND status = 1', [service_id]);
      if (!service) { const err = new Error('Seçilen servis aktif değil veya bulunamadı.'); err.status = 404; throw err; }
      if (quantity < service.min_quantity || quantity > service.max_quantity) {
        const err = new Error(`Miktar ${service.min_quantity} ile ${service.max_quantity} arasında olmalıdır.`); err.status = 400; throw err;
      }
      const rateKurus = service.rate_per_1000_kurus || toKurus(service.rate_per_1000);
      const fullChargeKurus = calculateChargeKurus(rateKurus, quantity);
      const chargeKurus = charge_user ? fullChargeKurus : 0; // hediye = 0 TL
      if (charge_user) {
        const debit = await tx.run(
          `UPDATE users SET balance_kurus = balance_kurus - ?, balance = (balance_kurus - ?) / 100.0
           WHERE id = ? AND balance_kurus >= ?`,
          [chargeKurus, chargeKurus, userId, chargeKurus]
        );
        if (debit.changes !== 1) { const err = new Error(`Kullanıcının bakiyesi yetersiz. Gerekli tutar: ₺${fromKurus(chargeKurus).toFixed(2)}.`); err.status = 400; throw err; }
      }
      const order = await tx.run(
        `INSERT INTO orders (user_id, service_id, provider_id, link, quantity, charge, charge_kurus, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [userId, service.id, service.provider_id, link, quantity, fromKurus(chargeKurus), chargeKurus]
      );
      return { service, chargeKurus, orderId: order.id };
    });

    try {
      if (!reserved.service.provider_id) throw new Error('Servise bağlı aktif sağlayıcı bulunmuyor.');
      const provider = await dbAsync.get('SELECT * FROM providers WHERE id = ? AND status = 1', [reserved.service.provider_id]);
      if (!provider) throw new Error('Sağlayıcı aktif değil.');
      const client = new SmmProviderClient(provider.api_url, provider.api_key);
      const response = await client.addOrder(reserved.service.provider_service_id, link, quantity, {});
      if (!response?.order) throw new Error(response?.error || 'Sağlayıcı sipariş numarası döndürmedi.');
      await dbAsync.run("UPDATE orders SET provider_order_id = ?, status = 'processing' WHERE id = ?", [String(response.order), reserved.orderId]);
    } catch (providerError) {
      const friendly = friendlyProviderReason(providerError.message);
      await withTransaction(async tx => {
        const order = await tx.get('SELECT refunded_kurus FROM orders WHERE id = ?', [reserved.orderId]);
        if (order && order.refunded_kurus === 0 && reserved.chargeKurus > 0) {
          await tx.run('UPDATE users SET balance_kurus = balance_kurus + ?, balance = (balance_kurus + ?) / 100.0 WHERE id = ?', [reserved.chargeKurus, reserved.chargeKurus, userId]);
        }
        await tx.run("UPDATE orders SET status = 'failed', refunded_kurus = ?, failure_reason = ? WHERE id = ?",
          [reserved.chargeKurus, normalizePlainText(`Admin ataması iletilemedi: ${friendly} [Sağlayıcı: ${providerError.message}]`, 500), reserved.orderId]);
      });
      return res.status(502).json({ error: `Atama başarısız: ${friendly}${reserved.chargeKurus > 0 ? ' Tutar kullanıcıya iade edildi.' : ''}` });
    }

    // Kullanici panel bildirimi + Telegram (beklenmez, hatalar yutulur).
    await dbAsync.run('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
      [userId, 'order', charge_user ? 'Hesabınıza sipariş oluşturuldu' : '🎁 Hesabınıza hediye sipariş tanımlandı',
       `"${reserved.service.name}" (${quantity} adet) siparişi hesabınıza ${charge_user ? 'oluşturuldu' : 'ücretsiz tanımlandı'}. Siparişlerim sayfasından takip edebilirsiniz.`]);
    telegram.notifyOrderOwner(userId, 'processing', { id: reserved.orderId, service_name: reserved.service.name, quantity });
    await dbAsync.run('INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, 'admin_assign_order', 'order', String(reserved.orderId),
       JSON.stringify({ target_user: targetUser.username, service_id, quantity, charged: charge_user, charge: fromKurus(reserved.chargeKurus) }), req.ip]);

    res.status(201).json({
      message: `"${reserved.service.name}" siparişi ${targetUser.username} kullanıcısına ${charge_user ? `oluşturuldu (₺${fromKurus(reserved.chargeKurus).toFixed(2)} bakiyesinden düşüldü)` : 'hediye olarak tanımlandı'}.`,
      order_id: reserved.orderId
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Hizmet ataması yapılamadı.' });
  }
});

router.post('/users/:id/ban', requireIdParam, validate(z.object({ banned: z.boolean() })), async (req, res) => {
  try {
    const userId = req.recordId;
    const { banned } = req.body;
    if (userId === req.user.id) return res.status(400).json({ error: 'Kendi hesabınızı banlayamazsınız.' });
    const target = await dbAsync.get('SELECT id, role FROM users WHERE id = ?', [userId]);
    if (!target) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    if (target.role === 'admin') return res.status(400).json({ error: 'Admin hesapları banlanamaz.' });

    await dbAsync.run('UPDATE users SET banned = ?, token_version = token_version + 1 WHERE id = ?', [banned ? 1 : 0, userId]);
    await dbAsync.run('INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, banned ? 'admin_user_banned' : 'admin_user_unbanned', 'user', String(userId), null, req.ip]);
    res.json({ message: banned ? 'Kullanıcı banlandı ve oturumları kapatıldı.' : 'Kullanıcının banı kaldırıldı.' });
  } catch (err) {
    res.status(500).json({ error: 'Ban durumu güncellenemedi.' });
  }
});

// Yonetici hedef kullanicinin sifresini belirler; eski oturumlar dusurulur.
router.post('/users/:id/password', requireIdParam, validate(z.object({
  new_password: z.string().min(10, 'Yeni şifre en az 10 karakter olmalıdır.').max(128)
})), async (req, res) => {
  try {
    const userId = req.recordId;
    const target = await dbAsync.get('SELECT id, role FROM users WHERE id = ?', [userId]);
    if (!target) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    // Diger adminlerin sifresi buradan degistirilemez; admin kendi sifresini
    // mevcut sifreyi dogrulayan /change-password ucundan degistirir.
    if (target.role === 'admin') return res.status(400).json({ error: 'Admin şifreleri bu alandan değiştirilemez.' });

    const hashed = await bcrypt.hash(req.body.new_password, 12);
    await dbAsync.run('UPDATE users SET password = ?, token_version = token_version + 1 WHERE id = ?', [hashed, userId]);
    await dbAsync.run('INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, 'admin_user_password_changed', 'user', String(userId), null, req.ip]);
    res.json({ message: 'Kullanıcının şifresi güncellendi ve açık oturumları kapatıldı.' });
  } catch (err) {
    res.status(500).json({ error: 'Şifre güncellenemedi.' });
  }
});

// Kullaniciyi tum kayitlariyla birlikte kalici olarak siler.
router.delete('/users/:id', requireIdParam, async (req, res) => {
  try {
    const userId = req.recordId;
    if (userId === req.user.id) return res.status(400).json({ error: 'Kendi hesabınızı silemezsiniz.' });
    const target = await dbAsync.get('SELECT id, role, username FROM users WHERE id = ?', [userId]);
    if (!target) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    if (target.role === 'admin') return res.status(400).json({ error: 'Admin hesapları silinemez.' });

    await withTransaction(async tx => {
      // FK'lari CASCADE olmayan bagimli kayitlar once temizlenir.
      await tx.run('DELETE FROM referral_earnings WHERE referrer_id = ? OR referred_user_id = ? OR order_id IN (SELECT id FROM orders WHERE user_id = ?)', [userId, userId, userId]);
      await tx.run('DELETE FROM ticket_messages WHERE ticket_id IN (SELECT id FROM tickets WHERE user_id = ?)', [userId]);
      await tx.run('DELETE FROM tickets WHERE user_id = ?', [userId]);
      await tx.run('DELETE FROM orders WHERE user_id = ?', [userId]);
      await tx.run('DELETE FROM payments WHERE user_id = ?', [userId]);
      await tx.run('DELETE FROM payment_intents WHERE user_id = ?', [userId]);
      await tx.run('DELETE FROM payment_notifications WHERE user_id = ?', [userId]);
      await tx.run('DELETE FROM user_coupons WHERE user_id = ?', [userId]);
      // Bu kullaniciyi referans gosterenlerin baglantisi koparilir.
      await tx.run('UPDATE users SET referrer_id = NULL WHERE referrer_id = ?', [userId]);
      await tx.run('DELETE FROM users WHERE id = ?', [userId]);
    });
    await dbAsync.run('INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, 'admin_user_deleted', 'user', String(userId), JSON.stringify({ username: target.username }), req.ip]);
    res.json({ message: `"${target.username}" kullanıcısı ve tüm kayıtları silindi.` });
  } catch (err) {
    res.status(500).json({ error: 'Kullanıcı silinemedi.' });
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
    // ?q= sayi ise sipariş no (bizim no veya saglayici no) olarak, degilse
    // kullanici adi / baglanti / servis adinda gecen metin olarak aranir.
    const q = String(req.query.q || '').trim().slice(0, 200);
    let where = '';
    const params = [];
    if (q) {
      const digits = q.replace(/^#/, '');
      if (/^\d+$/.test(digits)) {
        where = ` WHERE (o.id = ? OR o.provider_order_id = ?)`;
        params.push(Number(digits), digits);
      } else {
        const like = `%${q.replace(/[\\%_]/g, ch => `\\${ch}`)}%`;
        where = ` WHERE (u.username LIKE ? ESCAPE '\\' OR o.link LIKE ? ESCAPE '\\' OR s.name LIKE ? ESCAPE '\\')`;
        params.push(like, like, like);
      }
    }
    const orders = await dbAsync.all(
      `SELECT o.*, u.username, s.name as service_name, p.name as provider_name
       FROM orders o
       JOIN users u ON o.user_id = u.id
       JOIN services s ON o.service_id = s.id
       LEFT JOIN providers p ON o.provider_id = p.id
       ${where}
       ORDER BY o.id DESC LIMIT 100`,
      params
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
    let statusChange = null;
    await withTransaction(async tx => {
      const order = await tx.get(`SELECT * FROM orders WHERE id = ?`, [orderId]);
      if (!order) { const err = new Error('Sipariş bulunamadı.'); err.status = 404; throw err; }
      if (order.status === 'canceled' && status !== 'canceled') { const err = new Error('İptal edilmiş sipariş yeniden açılamaz.'); err.status = 409; throw err; }
      // Hatali (failed) siparis saglayiciya hic iletilmedi ve tutar iade
      // edildi; "tamamlandi" yapmak kullanicidan onay almadan onun yerine
      // siparis vermek olur. Durumu degistirilemez.
      if (order.status === 'failed') { const err = new Error('Hata almış sipariş üzerinde işlem yapılamaz; tutar zaten kullanıcıya iade edildi.'); err.status = 409; throw err; }
      let refundAmount = 0;
      if (status === 'canceled' && order.refunded_kurus === 0) {
        const refund = order.charge_kurus || toKurus(order.charge);
        refundAmount = refund;
        await tx.run('UPDATE users SET balance_kurus = balance_kurus + ?, balance = (balance_kurus + ?) / 100.0 WHERE id = ?', [refund, refund, order.user_id]);
        await tx.run("UPDATE orders SET status = ?, refunded_kurus = ?, failure_reason = COALESCE(failure_reason, 'Yönetici tarafından iptal edildi; tutar iade edildi.') WHERE id = ?", [status, refund, orderId]);
      } else if (status === 'canceled') {
        await tx.run("UPDATE orders SET status = ?, failure_reason = COALESCE(failure_reason, 'Yönetici tarafından iptal edildi.') WHERE id = ?", [status, orderId]);
      } else {
        await tx.run('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
      }
      await tx.run('INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)', [req.user.id, 'order_status_changed', 'order', String(orderId), JSON.stringify({ from: order.status, to: status }), req.ip]);
      if (status !== order.status && ['completed', 'partial', 'canceled'].includes(status)) {
        const service = await tx.get('SELECT name FROM services WHERE id = ?', [order.service_id]);
        statusChange = {
          userId: order.user_id,
          event: status,
          order: { id: order.id, service_name: service?.name || 'Servis', quantity: order.quantity, remains: order.remains, refund_amount: fromKurus(refundAmount) }
        };
      }
    });
    // Musteri Telegram'a bagliysa durum degisikligini ogrenir (beklenmez).
    if (statusChange) telegram.notifyOrderOwner(statusChange.userId, statusChange.event, statusChange.order);
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
    // Duyuru bandi sunucu tarafinda basiliyor ve onbellekleniyor; kaydedince
    // hemen tazelensin ki yeni acilan sayfalar eski duyuruyu gostermesin.
    req.app.get('invalidateAnnouncementCache')?.();
    // Dogrulama kodu kaydedilir kaydedilmez etikete yansimali: admin hemen
    // Bing/Search Console'da "Dogrula" dugmesine basacak.
    req.app.get('invalidateSeoCache')?.();
    res.json({ message: 'Site ayarları kaydedildi.' });
  } catch (err) {
    res.status(500).json({ error: 'Ayarlar kaydedilemedi.' });
  }
});

// CAMPAIGNS (indirim + bonus + popup)
const campaignSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum(['service_discount', 'deposit_bonus']),
  service_id: z.coerce.number().int().positive().nullable().optional(),
  discount_percent: z.coerce.number().min(1).max(90).nullable().optional(),
  bonus_percent: z.coerce.number().min(1).max(100).nullable().optional(),
  min_deposit: z.coerce.number().min(0).max(1_000_000).nullable().optional(),
  ends_at: z.string().trim().max(40).nullable().optional(),
  popup_enabled: z.coerce.boolean().default(false),
  popup_template: z.enum(['flash', 'gift', 'countdown', 'neon', 'minimal', 'rocket', 'opening']).default('flash'),
  popup_title: z.string().trim().max(140).nullable().optional(),
  popup_title_en: z.string().trim().max(140).nullable().optional(),
  popup_frequency_hours: z.coerce.number().int().min(1).max(720).default(24)
}).superRefine((value, ctx) => {
  if (value.type === 'service_discount') {
    if (!value.service_id) ctx.addIssue({ code: 'custom', message: 'İndirim kampanyası için servis seçin.' });
    if (!value.discount_percent) ctx.addIssue({ code: 'custom', message: 'İndirim yüzdesi girin.' });
  }
  if (value.type === 'deposit_bonus' && !value.bonus_percent) {
    ctx.addIssue({ code: 'custom', message: 'Bonus yüzdesi girin.' });
  }
});

router.get('/campaigns', async (req, res) => {
  try {
    // Donusum: kampanya suresince o servise verilen siparis sayisi.
    // (Siparis anindaki kampanya bilgisi saklanmadigi icin yaklasik bir olcudur.)
    const campaigns = await dbAsync.all(`
      SELECT c.*, s.name AS service_name,
        CASE WHEN c.type = 'service_discount' THEN (
          SELECT COUNT(*) FROM orders o
          WHERE o.service_id = c.service_id
            AND o.created_at >= c.created_at
            AND (c.ends_at IS NULL OR o.created_at <= c.ends_at)
            AND o.status NOT IN ('canceled','failed')
        ) ELSE NULL END AS conversions
      FROM campaigns c
      LEFT JOIN services s ON s.id = c.service_id
      ORDER BY c.id DESC
    `);
    res.json({ campaigns });
  } catch (err) {
    res.status(500).json({ error: 'Kampanyalar alınamadı.' });
  }
});

router.post('/campaigns', validate(campaignSchema), async (req, res) => {
  try {
    const body = req.body;
    if (body.service_id) {
      const service = await dbAsync.get('SELECT id FROM services WHERE id = ? AND status = 1', [body.service_id]);
      if (!service) return res.status(400).json({ error: 'Seçilen servis aktif değil veya bulunamadı.' });
    }
    const result = await dbAsync.run(
      `INSERT INTO campaigns (name, type, service_id, discount_percent, bonus_percent, min_deposit_kurus,
         ends_at, popup_enabled, popup_template, popup_title, popup_title_en, popup_frequency_hours)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        normalizePlainText(body.name, 120),
        body.type,
        body.type === 'service_discount' ? body.service_id : null,
        body.type === 'service_discount' ? body.discount_percent : null,
        body.type === 'deposit_bonus' ? body.bonus_percent : null,
        body.type === 'deposit_bonus' && body.min_deposit ? toKurus(body.min_deposit) : null,
        body.ends_at || null,
        body.popup_enabled ? 1 : 0,
        body.popup_template,
        body.popup_title ? normalizePlainText(body.popup_title, 140) : null,
        body.popup_title_en ? normalizePlainText(body.popup_title_en, 140) : null,
        body.popup_frequency_hours
      ]
    );
    await dbAsync.run('INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, 'campaign_created', 'campaign', String(result.id), JSON.stringify({ name: body.name, type: body.type }), req.ip]);
    res.status(201).json({ message: 'Kampanya oluşturuldu.', id: result.id });
  } catch (err) {
    res.status(500).json({ error: 'Kampanya oluşturulamadı.' });
  }
});

router.put('/campaigns/:id/status', requireIdParam, validate(z.object({ status: z.coerce.number().int().min(0).max(1) })), async (req, res) => {
  try {
    const result = await dbAsync.run('UPDATE campaigns SET status = ? WHERE id = ?', [req.body.status, req.recordId]);
    if (result.changes !== 1) return res.status(404).json({ error: 'Kampanya bulunamadı.' });
    res.json({ message: req.body.status ? 'Kampanya aktifleştirildi.' : 'Kampanya durduruldu.' });
  } catch (err) {
    res.status(500).json({ error: 'Kampanya güncellenemedi.' });
  }
});

router.delete('/campaigns/:id', requireIdParam, async (req, res) => {
  try {
    const result = await dbAsync.run('DELETE FROM campaigns WHERE id = ?', [req.recordId]);
    if (result.changes !== 1) return res.status(404).json({ error: 'Kampanya bulunamadı.' });
    res.json({ message: 'Kampanya silindi.' });
  } catch (err) {
    res.status(500).json({ error: 'Kampanya silinemedi.' });
  }
});

// ---------------------------------------------------------------------------
// E-POSTA PAZARLAMA
// Sablon havuzu + secmeli/toplu gonderim + gonderim gunlugu (istatistik).
// Alicilar: banli olmayan, listeden cikmamis musteriler.
// ---------------------------------------------------------------------------
const emailTemplateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  subject: z.string().trim().min(2).max(200),
  body: z.string().min(10).max(100_000)
});

// Yalnizca admin yazabilse de script/iframe gibi etiketler e-postada zaten
// calismaz; onizleme panelini korumak icin kayitta ayiklanir.
function stripDangerousHtml(html) {
  return String(html).replace(/<\s*\/?\s*(script|iframe|object|embed)\b[^>]*>/gi, '');
}

// Yer tutuculari doldurur ve abonelikten cikma altligini ekler.
function renderMarketingEmail(template, user, siteName, baseUrl) {
  const crypto = require('crypto');
  const replace = text => String(text)
    .replaceAll('{kullanici_adi}', user.username)
    .replaceAll('{site_adi}', siteName)
    .replaceAll('{site_link}', baseUrl || '#');
  const sig = crypto.createHmac('sha256', process.env.JWT_SECRET || 'dev').update(`unsub:${user.id}`).digest('hex').slice(0, 32);
  const unsubUrl = `${(baseUrl || '').replace(/\/$/, '')}/unsubscribe?u=${user.id}&s=${sig}`;
  const footer = `<div style="max-width:560px;margin:14px auto 0;text-align:center;color:#9ca3af;font-size:12px;font-family:Segoe UI,Arial,sans-serif;">
    Bu e-postayı ${siteName} üyeliğiniz nedeniyle aldınız. <a href="${unsubUrl}" style="color:#9ca3af;">Listeden çıkmak için tıklayın</a>.</div>`;
  return { subject: replace(template.subject), html: replace(template.body) + footer };
}

router.get('/email/templates', async (req, res) => {
  try {
    res.json({ templates: await dbAsync.all('SELECT * FROM email_templates ORDER BY id ASC') });
  } catch (err) { res.status(500).json({ error: 'Şablonlar alınamadı.' }); }
});

router.post('/email/templates', validate(emailTemplateSchema), async (req, res) => {
  try {
    const result = await dbAsync.run(
      'INSERT INTO email_templates (name, subject, body) VALUES (?, ?, ?)',
      [normalizePlainText(req.body.name, 80), normalizePlainText(req.body.subject, 200), stripDangerousHtml(req.body.body)]
    );
    res.status(201).json({ message: 'Şablon oluşturuldu.', id: result.id });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(400).json({ error: 'Bu isimde bir şablon zaten var.' });
    res.status(500).json({ error: 'Şablon oluşturulamadı.' });
  }
});

router.put('/email/templates/:id', requireIdParam, validate(emailTemplateSchema), async (req, res) => {
  try {
    const result = await dbAsync.run(
      'UPDATE email_templates SET name = ?, subject = ?, body = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [normalizePlainText(req.body.name, 80), normalizePlainText(req.body.subject, 200), stripDangerousHtml(req.body.body), req.recordId]
    );
    if (result.changes !== 1) return res.status(404).json({ error: 'Şablon bulunamadı.' });
    res.json({ message: 'Şablon güncellendi.' });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(400).json({ error: 'Bu isimde bir şablon zaten var.' });
    res.status(500).json({ error: 'Şablon güncellenemedi.' });
  }
});

router.delete('/email/templates/:id', requireIdParam, async (req, res) => {
  try {
    const result = await dbAsync.run('DELETE FROM email_templates WHERE id = ?', [req.recordId]);
    if (result.changes !== 1) return res.status(404).json({ error: 'Şablon bulunamadı.' });
    res.json({ message: 'Şablon silindi.' });
  } catch (err) { res.status(500).json({ error: 'Şablon silinemedi.' }); }
});

// Sablonu adminin kendi adresine test olarak gonderir.
router.post('/email/templates/:id/test', requireIdParam, async (req, res) => {
  try {
    const mailer = require('../services/mailer');
    if (!(await mailer.isConfigured())) return res.status(400).json({ error: 'Önce SMTP ayarlarını yapın (Site Ayarları → E-Posta).' });
    const template = await dbAsync.get('SELECT * FROM email_templates WHERE id = ?', [req.recordId]);
    if (!template) return res.status(404).json({ error: 'Şablon bulunamadı.' });
    const siteRow = await dbAsync.get("SELECT value FROM site_settings WHERE key = 'site_name'");
    const rendered = renderMarketingEmail(template, req.user, siteRow?.value || 'SMM Panel', process.env.PUBLIC_BASE_URL || '');
    await mailer.sendMail({ to: req.user.email, subject: `[TEST] ${rendered.subject}`, html: rendered.html, text: '' });
    res.json({ message: `Test e-postası ${req.user.email} adresine gönderildi.` });
  } catch (err) { res.status(400).json({ error: `Test gönderilemedi: ${err.message}` }); }
});

// Toplu / secmeli gonderim. Yanit hemen doner; gonderim arka planda surer
// (SMTP limitlerini zorlamamak icin e-postalar arasi kisa bekleme vardir).
router.post('/email/send', validate(z.object({
  template_id: z.coerce.number().int().positive(),
  mode: z.enum(['all', 'selected']).default('all'),
  user_ids: z.array(z.coerce.number().int().positive()).max(5000).optional()
})), async (req, res) => {
  try {
    const mailer = require('../services/mailer');
    if (!(await mailer.isConfigured())) return res.status(400).json({ error: 'Önce SMTP ayarlarını yapın (Site Ayarları → E-Posta).' });
    const template = await dbAsync.get('SELECT * FROM email_templates WHERE id = ?', [req.body.template_id]);
    if (!template) return res.status(404).json({ error: 'Şablon bulunamadı.' });
    if (req.body.mode === 'selected' && !req.body.user_ids?.length) {
      return res.status(400).json({ error: 'En az bir alıcı seçin.' });
    }

    let sql = `SELECT id, username, email FROM users WHERE role = 'client' AND banned = 0 AND email_opt_out = 0`;
    const params = [];
    if (req.body.mode === 'selected') {
      sql += ` AND id IN (${req.body.user_ids.map(() => '?').join(',')})`;
      params.push(...req.body.user_ids);
    }
    const recipients = await dbAsync.all(sql, params);
    if (!recipients.length) return res.status(400).json({ error: 'Uygun alıcı bulunamadı (banlı ve listeden çıkanlar hariç tutulur).' });

    const siteRow = await dbAsync.get("SELECT value FROM site_settings WHERE key = 'site_name'");
    const siteName = siteRow?.value || 'SMM Panel';
    const baseUrl = process.env.PUBLIC_BASE_URL || '';
    const batchId = createOpaqueToken('EM').slice(0, 24);

    // Arka plan gonderimi: istek yaniti beklemez.
    (async () => {
      for (const user of recipients) {
        try {
          const rendered = renderMarketingEmail(template, user, siteName, baseUrl);
          await mailer.sendMail({ to: user.email, subject: rendered.subject, html: rendered.html, text: '' });
          await dbAsync.run('INSERT INTO email_logs (batch_id, template_name, subject, user_id, email, status) VALUES (?, ?, ?, ?, ?, ?)',
            [batchId, template.name, rendered.subject, user.id, user.email, 'sent']);
        } catch (err) {
          await dbAsync.run('INSERT INTO email_logs (batch_id, template_name, subject, user_id, email, status, error) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [batchId, template.name, template.subject, user.id, user.email, 'failed', normalizePlainText(err.message, 300)]).catch(() => {});
        }
        // SMTP saglayicisini bogmamak icin e-postalar arasi bekleme.
        await new Promise(resolve => setTimeout(resolve, 400));
      }
      require('../services/telegramNotifier').notifyPaymentEvent('📧 Toplu E-Posta Tamamlandı', [
        `📝 Şablon: ${template.name}`,
        `👥 Alıcı: ${recipients.length}`,
        '📊 Ayrıntılar: Admin Panel → E-Posta Pazarlama'
      ]).catch(() => {});
    })();

    await dbAsync.run('INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, 'email_blast_started', 'email_batch', batchId, JSON.stringify({ template: template.name, recipients: recipients.length }), req.ip]);
    res.json({ message: `Gönderim başladı: ${recipients.length} alıcı. Sonuçları aşağıdaki geçmiş bölümünden takip edebilirsin.`, batch_id: batchId, total: recipients.length });
  } catch (err) { res.status(500).json({ error: 'Gönderim başlatılamadı.' }); }
});

router.get('/email/stats', async (req, res) => {
  try {
    const totals = await dbAsync.get(`SELECT
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM email_logs`);
    const audience = await dbAsync.get("SELECT COUNT(*) as count FROM users WHERE role = 'client' AND banned = 0 AND email_opt_out = 0");
    const optedOut = await dbAsync.get("SELECT COUNT(*) as count FROM users WHERE role = 'client' AND email_opt_out = 1");
    const batches = await dbAsync.all(`SELECT batch_id, template_name, MIN(created_at) as started_at,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM email_logs GROUP BY batch_id ORDER BY MIN(created_at) DESC LIMIT 20`);
    res.json({
      totals: { sent: totals?.sent || 0, failed: totals?.failed || 0 },
      audience: audience?.count || 0,
      opted_out: optedOut?.count || 0,
      batches
    });
  } catch (err) { res.status(500).json({ error: 'İstatistikler alınamadı.' }); }
});

router.get('/email/failures/:batchId', async (req, res) => {
  try {
    const batchId = String(req.params.batchId || '').slice(0, 32);
    const failures = await dbAsync.all(
      "SELECT email, error, created_at FROM email_logs WHERE batch_id = ? AND status = 'failed' ORDER BY id ASC LIMIT 500",
      [batchId]
    );
    res.json({ failures });
  } catch (err) { res.status(500).json({ error: 'Hata listesi alınamadı.' }); }
});

// E-POSTA (SMTP) TESTI: istege bagli hedef adres; bos birakilirsa admin'in
// kendi adresine gider.
router.post('/email/test', validate(z.object({
  to: z.email().max(254).optional().nullable()
})), async (req, res) => {
  try {
    const mailer = require('../services/mailer');
    if (!(await mailer.isConfigured())) {
      return res.status(400).json({ error: 'SMTP ayarları eksik. Sunucu, kullanıcı ve şifre alanlarını doldurup kaydedin.' });
    }
    const target = req.body.to || req.user.email;
    await mailer.sendMail({
      to: target,
      subject: 'SMMJET — SMTP test e-postası ✅',
      text: 'Bu bir test e-postasıdır. SMTP ayarlarınız çalışıyor!',
      html: '<p>Bu bir test e-postasıdır. <b>SMTP ayarlarınız çalışıyor!</b> 🎉</p>'
    });
    res.json({ message: `Test e-postası ${target} adresine gönderildi. Gelen kutunu (ve spam klasörünü) kontrol et.` });
  } catch (err) {
    res.status(400).json({ error: `E-posta gönderilemedi: ${err.message}` });
  }
});

// TELEGRAM BILDIRIM BOTU
// Test ve chat listesi uclari, kaydedilmis ayarlarin gercekten calistigini
// yoneticinin panelden dogrulayabilmesi icindir.
router.post('/telegram/test', async (req, res) => {
  try {
    await telegram.sendTestMessage();
    res.json({ message: 'Test mesajı gönderildi. Telegram sohbetini kontrol edin.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/telegram/chats', async (req, res) => {
  try {
    const chats = await telegram.listRecentChats();
    res.json({ chats });
  } catch (err) {
    res.status(400).json({ error: err.message });
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
      // Aktif bakiye bonusu kampanyasi banka yuklemelerinde de gecerlidir.
      const bankBonus = await require('./payments').applyDepositBonus(tx, notif.user_id, amountKurus, 'BANK');
      await tx.run('INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)', [req.user.id, 'payment_approved', 'payment_notification', String(notifId), JSON.stringify({ amount_kurus: amountKurus, user_id: notif.user_id }), req.ip]);
      const bankUser = await tx.get('SELECT username FROM users WHERE id = ?', [notif.user_id]);
      telegram.notifyDeposit({ username: bankUser?.username || `#${notif.user_id}`, amount: fromKurus(amountKurus), method: `Banka/Papara (onaylandı)`, bonus: fromKurus(bankBonus) });
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
    const { code, code_en, amount, max_uses } = req.body;
    const cleanCode = normalizePlainText(code, 64).toUpperCase();
    const cleanCodeEn = code_en ? normalizePlainText(code_en, 64).toUpperCase() : null;
    if (!cleanCode) return res.status(400).json({ error: 'Lütfen geçerli bir kupon kodu girin.' });
    if (cleanCodeEn && cleanCodeEn === cleanCode) return res.status(400).json({ error: 'İngilizce kod, Türkçe kod ile aynı olamaz.' });

    // code_en kolonu ALTER ile eklendigi icin UNIQUE kisiti yok; benzersizlik
    // iki kolona karsi burada dogrulanir.
    const codesToCheck = [cleanCode, cleanCodeEn].filter(Boolean);
    const clash = await dbAsync.get(
      `SELECT id FROM coupons WHERE code COLLATE NOCASE IN (${codesToCheck.map(() => '?').join(',')})
          OR (code_en IS NOT NULL AND code_en COLLATE NOCASE IN (${codesToCheck.map(() => '?').join(',')}))`,
      [...codesToCheck, ...codesToCheck]
    );
    if (clash) return res.status(400).json({ error: 'Bu kupon kodu (veya İngilizce karşılığı) zaten mevcut.' });

    await dbAsync.run(
      `INSERT INTO coupons (code, code_en, amount, amount_kurus, max_uses) VALUES (?, ?, ?, ?, ?)`,
      [cleanCode, cleanCodeEn, amount, toKurus(amount), max_uses]
    );

    res.json({ message: `"${cleanCode}"${cleanCodeEn ? ` (+ EN: "${cleanCodeEn}")` : ''} promosyon kuponu başarıyla oluşturuldu!` });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Bu kupon kodu zaten mevcut.' });
    }
    res.status(500).json({ error: 'Kupon oluşturulamadı.' });
  }
});

// Kuponu kimlerin kullandigi (kullanici adi + tarih) — admin kontrol listesi.
router.get('/coupons/:id/usages', requireIdParam, async (req, res) => {
  try {
    const coupon = await dbAsync.get('SELECT id, code, code_en FROM coupons WHERE id = ?', [req.recordId]);
    if (!coupon) return res.status(404).json({ error: 'Kupon bulunamadı.' });
    const usages = await dbAsync.all(
      `SELECT u.username, u.email, uc.used_at FROM user_coupons uc
       JOIN users u ON u.id = uc.user_id
       WHERE uc.coupon_id = ? ORDER BY uc.id DESC LIMIT 1000`,
      [req.recordId]
    );
    res.json({ coupon, usages });
  } catch (err) {
    res.status(500).json({ error: 'Kupon kullanımları alınamadı.' });
  }
});

router.delete('/coupons/:id', requireIdParam, async (req, res) => {
  try {
    // Kupon bir kez bile kullanildiysa user_coupons'ta kayit olusur ve
    // foreign_keys=ON oldugu icin dogrudan DELETE "constraint failed" verir.
    // Once kullanim kayitlarini, sonra kuponu siliyoruz (tek islemde).
    const result = await withTransaction(async tx => {
      const coupon = await tx.get('SELECT id FROM coupons WHERE id = ?', [req.recordId]);
      if (!coupon) return { found: false, usages: 0 };
      const usages = await tx.get('SELECT COUNT(*) AS count FROM user_coupons WHERE coupon_id = ?', [req.recordId]);
      await tx.run('DELETE FROM user_coupons WHERE coupon_id = ?', [req.recordId]);
      await tx.run('DELETE FROM coupons WHERE id = ?', [req.recordId]);
      return { found: true, usages: usages?.count || 0 };
    });

    if (!result.found) return res.status(404).json({ error: 'Kupon bulunamadı.' });
    res.json({
      message: result.usages > 0
        ? `Kupon silindi (${result.usages} kullanım kaydı da temizlendi).`
        : 'Kupon silindi.'
    });
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
       // Meta aciklama arama sonucunda kesilmemesi icin 160 karaktere sigdirilir.
       buildMetaDescription([seo_description_tr, summary_tr, summary, content_tr, content], safeTitleTr),
       buildMetaDescription([seo_description_en, summary_en, summary, content_en, content_tr, content], safeTitleEn),
       postStatus, req.user.id, Math.max(1, Math.min(60, parseInt(reading_minutes || 3))), postStatus]
    );
    // Yayinlanan yazi IndexNow ile Bing'e aninda bildirilir (AI aramalarinin
    // — ozellikle ChatGPT'nin — dizin kaynagi Bing'dir). Yaniti geciktirmez.
    if (postStatus === 'published') require('../services/indexNow').notifyBlogPublished(slug);
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
      normalizePlainText(req.body.seo_title_en || titleEn, 180),
      buildMetaDescription([req.body.seo_description_tr, req.body.summary_tr, current.summary_tr, current.summary], titleTr),
      buildMetaDescription([req.body.seo_description_en, req.body.summary_en, current.summary_en, current.summary], titleEn), status, Math.max(1, Math.min(60, parseInt(req.body.reading_minutes || current.reading_minutes || 3))), status, req.recordId
    ]);
    // Guncellenen yazi da IndexNow ile bildirilir (yayinda ise).
    if (status === 'published' && current.slug) require('../services/indexNow').notifyBlogPublished(current.slug);
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

// MÜŞTERİ YORUMLARI (ADMIN DENETİMİ)
// Kullanici yorumlari onaydan gecer; admin elle yorum da ekleyebilir
// (musteri Telegram/WhatsApp'tan iletmisse). Isimler sitede maskelenir.
router.get('/reviews', async (req, res) => {
  try {
    const reviews = await dbAsync.all(`
      SELECT r.id, r.rating, r.comment, r.status, r.created_at, r.display_name, r.order_id, u.username
      FROM reviews r LEFT JOIN users u ON r.user_id = u.id
      ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.id DESC`);
    res.json({ reviews });
  } catch (err) {
    res.status(500).json({ error: 'Yorumlar alınamadı.' });
  }
});

router.post('/reviews', async (req, res) => {
  try {
    const rating = Math.round(Number(req.body?.rating));
    const comment = String(req.body?.comment || '').replace(/\s+/g, ' ').trim();
    const displayName = String(req.body?.display_name || '').trim().slice(0, 60);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'Puan 1-5 arasında olmalıdır.' });
    if (comment.length < 10 || comment.length > 400) return res.status(400).json({ error: 'Yorum 10-400 karakter arasında olmalıdır.' });
    if (!displayName) return res.status(400).json({ error: 'Görünen ad gereklidir (sitede maskelenerek yayınlanır).' });
    await dbAsync.run(
      "INSERT INTO reviews (display_name, rating, comment, status) VALUES (?, ?, ?, 'approved')",
      [displayName, rating, comment]
    );
    res.status(201).json({ message: 'Yorum eklendi ve yayınlandı.' });
  } catch (err) {
    res.status(500).json({ error: 'Yorum eklenemedi.' });
  }
});

router.put('/reviews/:id/status', requireIdParam, async (req, res) => {
  try {
    const status = req.body?.status === 'approved' ? 'approved' : 'pending';
    await dbAsync.run('UPDATE reviews SET status = ? WHERE id = ?', [status, req.recordId]);
    res.json({ message: status === 'approved' ? 'Yorum onaylandı ve yayında.' : 'Yorum yayından kaldırıldı (beklemede).' });
  } catch (err) {
    res.status(500).json({ error: 'Yorum durumu güncellenemedi.' });
  }
});

router.delete('/reviews/:id', requireIdParam, async (req, res) => {
  try {
    await dbAsync.run('DELETE FROM reviews WHERE id = ?', [req.recordId]);
    res.json({ message: 'Yorum silindi.' });
  } catch (err) {
    res.status(500).json({ error: 'Yorum silinemedi.' });
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
