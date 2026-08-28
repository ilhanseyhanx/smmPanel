const express = require('express');
const router = express.Router();
const { dbAsync } = require('../config/database');
const { activeServiceDiscounts, activeDepositBonus, activePopupCampaign } = require('../services/campaigns');
const { toKurus, fromKurus } = require('../utils/money');

// GET SERVICES & CATEGORIES FOR PUBLIC/CLIENT CATALOG
router.get('/', async (req, res) => {
  try {
    const categories = await dbAsync.all(`SELECT c.* FROM categories c WHERE EXISTS (SELECT 1 FROM services s WHERE s.category_id = c.id AND s.status = 1) ORDER BY c.sort_order ASC, c.id ASC`);
    const services = await dbAsync.all(`
      SELECT
        s.id,
        s.category_id,
        s.name,
        s.name_tr,
        s.name_en,
        s.rate_per_1000,
        s.rate_per_1000_usd_cents,
        s.min_quantity,
        s.max_quantity,
        s.description,
        s.description_tr,
        s.description_en,
        s.start_time_tr,
        s.start_time_en,
        s.speed_tr,
        s.speed_en,
        s.features_tr,
        s.features_en,
        s.refill,
        c.name as category_name,
        c.name_tr as category_name_tr,
        c.name_en as category_name_en,
        c.icon as category_icon
      FROM services s
      JOIN categories c ON s.category_id = c.id
      WHERE s.status = 1
      ORDER BY c.sort_order ASC, s.id ASC
    `);

    // Aktif servis indirimleri fiyat bilgisine islenir: musteri vitrinde
    // ustu cizili eski fiyati ve indirimli yeni fiyati birlikte gorur.
    const discounts = await activeServiceDiscounts();
    for (const service of services) {
      const discount = discounts.get(service.id);
      if (discount) {
        service.discount_percent = discount.discount_percent;
        service.discounted_rate_per_1000 = fromKurus(Math.max(1, Math.round(
          (toKurus(service.rate_per_1000)) * (100 - discount.discount_percent) / 100
        )));
      }
    }

    // Aktif bakiye bonusu ve popup kampanyasi (vitrin icin).
    const depositBonus = await activeDepositBonus();
    const popupCampaign = await activePopupCampaign();

    // Bakiye yukleme ekrani yalnizca yapilandirilmis yontemleri gosterir.
    const paymentMethods = {
      paytr: Boolean(process.env.PAYTR_MERCHANT_ID && process.env.PAYTR_MERCHANT_KEY && process.env.PAYTR_MERCHANT_SALT),
      crypto: await require('../services/nowpayments').isConfigured(),
      shopier: await require('../services/shopier').isConfigured()
    };

    // Live public stats from DB
    const ordersCountRow = await dbAsync.get(`SELECT COUNT(*) as count FROM orders WHERE status != 'canceled'`);
    const usersCountRow = await dbAsync.get(`SELECT COUNT(*) as count FROM users WHERE role = 'client'`);
    const completedOrdersRow = await dbAsync.get(`SELECT COUNT(*) as count FROM orders WHERE status = 'completed'`);
    // Vitrindeki "baslayan fiyatlar" degeri: aktif servisler icindeki en dusuk 1000 adet fiyati.
    const minRateRow = await dbAsync.get(`SELECT MIN(rate_per_1000_kurus) as min_kurus FROM services WHERE status = 1 AND rate_per_1000_kurus > 0`);
    // Siparis sikligi: son 30 gundeki ardisik siparisler arasindaki ortalama sure.
    const frequencyRow = await dbAsync.get(
      `SELECT COUNT(*) as count,
              (julianday(MAX(created_at)) - julianday(MIN(created_at))) * 86400.0 as span_seconds
       FROM orders WHERE created_at >= datetime('now', '-30 days')`
    );
    const orderIntervalSeconds = frequencyRow && frequencyRow.count > 1 && frequencyRow.span_seconds > 0
      ? frequencyRow.span_seconds / (frequencyRow.count - 1)
      : null;

    // Site Settings (Public)
    const publicSettingKeys = ['site_name', 'currency', 'telegram_link', 'support_email', 'hero_title', 'hero_subtitle', 'announcement',
      // Blog yazar imzasi istemci tarafinda da basilir (SSR ile ayni gorunum).
      'blog_author_name',
      'hero_title_tr', 'hero_title_en', 'hero_subtitle_tr', 'hero_subtitle_en', 'announcement_tr', 'announcement_en',
      // Havale/Papara hesaplari musteriye gosterilir (Bakiye Yukle sayfasi).
      'bank_accounts',
      // Duyuru bandinin acilisa ozel kutlama modu
      'announcement_special',
      // Alt bilgideki sosyal profil baglantilari (Organization sameAs alanina
      // da girer; denetim "sosyal profil baglantisi bulunamadi" diyordu).
      'social_instagram', 'social_x', 'social_youtube', 'social_tiktok',
      // Yazar imzasinin tiklanabilir profili (blog detayinda).
      'blog_author_url',
      // Isletme adresi: E-E-A-T guven sinyali, yapisal veride PostalAddress.
      'business_address'];
    const siteSettingsRows = await dbAsync.all(`SELECT key, value FROM site_settings WHERE key IN (${publicSettingKeys.map(() => '?').join(',')})`, publicSettingKeys);
    const settings = {};
    siteSettingsRows.forEach(r => { settings[r.key] = r.value; });

    // Active Landing Platforms & Featured Cards (Public)
    const landingPlatforms = await dbAsync.all(`SELECT * FROM landing_platforms WHERE status = 1 ORDER BY sort_order ASC, id ASC`);
    const featuredCards = await dbAsync.all(`SELECT * FROM featured_cards WHERE status = 1 ORDER BY sort_order ASC, id ASC`);

    // Sosyal kanit seridi: son siparisler, kullanici adi maskeli.
    // Ayar '0' yapilarak tamamen kapatilabilir.
    const socialProofSetting = await dbAsync.get("SELECT value FROM site_settings WHERE key = 'social_proof_enabled'");
    let liveFeed = [];
    if (socialProofSetting?.value !== '0') {
      const feedRows = await dbAsync.all(`
        SELECT o.quantity, o.created_at, o.status, u.username, s.name as service_name
        FROM orders o
        JOIN users u ON o.user_id = u.id
        JOIN services s ON o.service_id = s.id
        WHERE o.status IN ('pending','processing','completed','partial')
        ORDER BY o.id DESC LIMIT 12
      `);
      liveFeed = feedRows.map(row => ({
        // Gizlilik: kullanici adinin yalnizca ilk 2 harfi gorunur.
        username: String(row.username).slice(0, 2) + '***',
        service_name: row.service_name,
        quantity: row.quantity,
        created_at: row.created_at
      }));
    }

    // Onayli musteri yorumlari: ana sayfa seridi ve hizmetler sayfasi icin.
    // Isim her zaman maskelenir (kullanici yorumu = kullanici adi, admin
    // eklemesi = girilen gorunen ad).
    const reviewRows = await dbAsync.all(`
      SELECT r.rating, r.comment, r.created_at, r.display_name, u.username
      FROM reviews r LEFT JOIN users u ON r.user_id = u.id
      WHERE r.status = 'approved' ORDER BY r.id DESC LIMIT 24
    `).catch(() => []);
    const reviews = reviewRows.map(row => ({
      rating: Math.max(1, Math.min(5, Number(row.rating) || 5)),
      comment: row.comment,
      name: String(row.display_name || row.username || 'Müşteri').slice(0, 2) + '***',
      created_at: row.created_at
    }));

    res.json({
      categories,
      services,
      settings,
      landingPlatforms,
      featuredCards,
      liveFeed,
      reviews,
      paymentMethods,
      depositBonus: depositBonus ? {
        bonus_percent: depositBonus.bonus_percent,
        min_deposit: depositBonus.min_deposit_kurus ? fromKurus(depositBonus.min_deposit_kurus) : 0,
        ends_at: depositBonus.ends_at
      } : null,
      popup: popupCampaign || null,
      stats: {
        total_orders: ordersCountRow ? ordersCountRow.count : 0,
        active_users: usersCountRow ? usersCountRow.count : 0,
        total_services: services.length,
        completed_orders: completedOrdersRow ? completedOrdersRow.count : 0,
        // Kurus cinsinden saklanir; bicimlendirmeyi istemci yapar. Servis yoksa null.
        min_rate_kurus: minRateRow && minRateRow.min_kurus !== null ? minRateRow.min_kurus : null,
        order_interval_seconds: orderIntervalSeconds
      }
    });
  } catch (err) {
    console.error('Error fetching services:', err);
    res.status(500).json({ error: 'Servis listesi alınamadı.' });
  }
});

module.exports = router;
