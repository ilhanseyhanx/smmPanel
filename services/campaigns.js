const { dbAsync } = require('../config/database');

// Kampanya "aktif" sayilir: durumu acik VE bitis tarihi gecmemis.
// ends_at UTC ISO metni olarak saklanir (istemci gondermeden once cevirir).
const ACTIVE_WHERE = `status = 1 AND (ends_at IS NULL OR strftime('%s', ends_at) > strftime('%s', 'now'))`;

// Servis bazli aktif indirimler: serviceId -> { id, discount_percent }
// Ayni servise birden fazla aktif kampanya varsa en yuksek indirim gecerlidir.
async function activeServiceDiscounts() {
  const rows = await dbAsync.all(
    `SELECT id, service_id, discount_percent FROM campaigns
     WHERE type = 'service_discount' AND service_id IS NOT NULL AND discount_percent > 0 AND ${ACTIVE_WHERE}`
  );
  const map = new Map();
  for (const row of rows) {
    const current = map.get(row.service_id);
    if (!current || row.discount_percent > current.discount_percent) {
      map.set(row.service_id, { id: row.id, discount_percent: row.discount_percent });
    }
  }
  return map;
}

async function activeServiceDiscount(serviceId) {
  return (await activeServiceDiscounts()).get(Number(serviceId)) || null;
}

// Aktif bakiye bonusu (birden fazlaysa en yuksek yuzde gecerli olur).
async function activeDepositBonus() {
  return dbAsync.get(
    `SELECT id, name, bonus_percent, min_deposit_kurus, ends_at FROM campaigns
     WHERE type = 'deposit_bonus' AND bonus_percent > 0 AND ${ACTIVE_WHERE}
     ORDER BY bonus_percent DESC LIMIT 1`
  );
}

// Vitrinde gosterilecek aktif popup kampanyasi (en yeni kazanir).
async function activePopupCampaign() {
  return dbAsync.get(
    `SELECT c.id, c.name, c.type, c.service_id, c.discount_percent, c.bonus_percent,
            c.min_deposit_kurus, c.ends_at, c.popup_template, c.popup_title, c.popup_title_en, c.popup_frequency_hours,
            s.name AS service_name, s.rate_per_1000 AS service_rate
     FROM campaigns c
     LEFT JOIN services s ON s.id = c.service_id
     WHERE c.popup_enabled = 1 AND ${ACTIVE_WHERE.replaceAll('status', 'c.status').replaceAll('ends_at', 'c.ends_at')}
     ORDER BY c.id DESC LIMIT 1`
  );
}

// Kurus bazinda indirimli fiyat; en az 1 kurus kalir ki bedava siparis olusmasin.
function applyDiscountKurus(rateKurus, discountPercent) {
  const discounted = Math.round(Number(rateKurus) * (100 - Number(discountPercent)) / 100);
  return Math.max(1, discounted);
}

module.exports = { activeServiceDiscounts, activeServiceDiscount, activeDepositBonus, activePopupCampaign, applyDiscountKurus };
