'use strict';

// Demo bayiyi (tenant/demo.js) kurar ya da onarir. Tekrar calistirmak
// guvenlidir: eksik olani olusturur, var olani demo ayarlarina dondurur.
// Kullananlar: scripts/seed-demo-tenant.js ve admin "Demo siteleri kur" dugmesi.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { dbAsync } = require('../config/database');
const { DEMO_SLUG, ANNOUNCEMENT } = require('../tenant/demo');
const { invalidateTenantCache } = require('../tenant/resolve');

const OWNER_USERNAME = 'demo_bayi';
const SHOPPER_USERNAME = 'demo_musteri';
const SHOPPER_BALANCE_KURUS = 25000;

const SETTINGS = {
  demo: true,
  announcement: ANNOUNCEMENT,
  description: 'Jet Bayi Paneli demo sitesi',
  hero_title: 'Kendi SMM panelin [böyle görünür]',
  hero_text: 'Bu sayfa Jet Bayi Paneli ile açılmış örnek bir sitedir. Tema, renk, logo ve metinleri bayi kendi panelinden değiştirir.',
  footer_text: 'Demo site · Jet Bayi Paneli',
  support_email: '',
  telegram: '@ornekdestek',
  legal_name: 'Örnek Medya Ltd. Şti.',
  legal_address: 'Örnek Mah. Demo Sok. No:1, İstanbul'
};

// Giris yapilamayan hesap parolasi: rastgele, kimse bilmez.
async function randomPasswordHash() {
  return bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
}

async function ensureDemoTenant() {
  let owner = await dbAsync.get('SELECT id FROM users WHERE username = ?', [OWNER_USERNAME]);
  if (!owner) {
    const created = await dbAsync.run(
      "INSERT INTO users (username, email, password, role) VALUES (?, 'demo-bayi@jetsmmpanel.invalid', ?, 'user')",
      [OWNER_USERNAME, await randomPasswordHash()]
    );
    owner = { id: created.id };
  }
  const other = await dbAsync.get('SELECT id, slug FROM tenants WHERE owner_user_id = ? AND slug != ?', [owner.id, DEMO_SLUG]);
  if (other) throw Object.assign(new Error(`${OWNER_USERNAME} hesabına başka bir bayi (${other.slug}) bağlı.`), { status: 409, expose: true });

  let tenant = await dbAsync.get('SELECT id FROM tenants WHERE slug = ?', [DEMO_SLUG]);
  let created = false;
  if (tenant) {
    await dbAsync.run(
      `UPDATE tenants SET owner_user_id = ?, name = 'Jet Demo', theme = 'gradient', plan_status = 'comp', status = 'active',
              status_reason = NULL, settings_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [owner.id, JSON.stringify(SETTINGS), tenant.id]
    );
  } else {
    const row = await dbAsync.run(
      "INSERT INTO tenants (owner_user_id, slug, name, theme, plan_status, settings_json) VALUES (?, ?, 'Jet Demo', 'gradient', 'comp', ?)",
      [owner.id, DEMO_SLUG, JSON.stringify(SETTINGS)]
    );
    tenant = { id: row.id };
    created = true;
  }

  // "Musteri gozuyle" girisinde kullanilan hesap (sifresi kimsede yok).
  const shopper = await dbAsync.get('SELECT id FROM tenant_customers WHERE tenant_id = ? AND username = ?', [tenant.id, SHOPPER_USERNAME]);
  if (shopper) {
    await dbAsync.run('UPDATE tenant_customers SET balance_kurus = ?, banned = 0 WHERE id = ?', [SHOPPER_BALANCE_KURUS, shopper.id]);
  } else {
    await dbAsync.run(
      "INSERT INTO tenant_customers (tenant_id, username, email, password, balance_kurus) VALUES (?, ?, 'demo-musteri@jetsmmpanel.invalid', ?, ?)",
      [tenant.id, SHOPPER_USERNAME, await randomPasswordHash(), SHOPPER_BALANCE_KURUS]
    );
  }
  invalidateTenantCache();
  return { id: tenant.id, created };
}

module.exports = { ensureDemoTenant, OWNER_USERNAME, SHOPPER_USERNAME };
