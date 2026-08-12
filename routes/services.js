const express = require('express');
const router = express.Router();
const { dbAsync } = require('../config/database');

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
      'hero_title_tr', 'hero_title_en', 'hero_subtitle_tr', 'hero_subtitle_en', 'announcement_tr', 'announcement_en'];
    const siteSettingsRows = await dbAsync.all(`SELECT key, value FROM site_settings WHERE key IN (${publicSettingKeys.map(() => '?').join(',')})`, publicSettingKeys);
    const settings = {};
    siteSettingsRows.forEach(r => { settings[r.key] = r.value; });

    // Active Landing Platforms & Featured Cards (Public)
    const landingPlatforms = await dbAsync.all(`SELECT * FROM landing_platforms WHERE status = 1 ORDER BY sort_order ASC, id ASC`);
    const featuredCards = await dbAsync.all(`SELECT * FROM featured_cards WHERE status = 1 ORDER BY sort_order ASC, id ASC`);

    res.json({
      categories,
      services,
      settings,
      landingPlatforms,
      featuredCards,
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
