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

const DEMO_POSTS = [
  ['blog', 'instagram-takipci-nasil-artar', 'Instagram takipçisi nasıl artar? 7 pratik yol', 'Organik büyüme ile reklamı birlikte kullanmanın kısa rehberi.',
    '## Düzenli paylaş\nHaftada en az 3 gönderi ve her gün hikâye, algoritmanın seni unutmamasını sağlar.\n\n## Reels kullan\n- İlk 2 saniyede dikkat çek\n- Trend sesleri kullan\n- Altyazı ekle\n\n## Etkileşimi büyüt\nYeni bir hesapta ilk izlenim önemlidir; takipçi ve beğeni desteği ilk ivmeyi verir.'],
  ['blog', 'tiktok-kesfete-dusmek', 'TikTok keşfete nasıl düşülür?', 'Keşfet algoritmasının sevdiği 5 alışkanlık.',
    '## İzlenme süresi her şeydir\nVideonun sonuna kadar izlenmesi, beğeniden daha değerlidir.\n\n- Kısa ve net giriş\n- Döngüye giren kurgu\n- Yorum davet eden soru'],
  ['page', 'instagram-takipci-satin-al', 'Instagram Takipçi Satın Al', 'Hızlı başlangıç, düşüşe karşı telafi, güvenli ödeme.',
    '## Neden bizden almalısın?\n- Siparişler dakikalar içinde başlar\n- Şifre istemeyiz, yalnızca kullanıcı adı yeter\n- Düşüş olursa telafi isteyebilirsin\n\n## Nasıl sipariş verilir?\nAşağıdan "Sipariş ver"e bas, bağlantını yapıştır ve miktarı seç.']
];

// Demo icerigi: yoksa eklenir, varsa dokunulmaz (tekrar calistirmak guvenli).
async function seedDemoContent(tenantId) {
  for (const [type, slug, title, excerpt, body] of DEMO_POSTS) {
    await dbAsync.run(
      `INSERT OR IGNORE INTO tenant_posts (tenant_id, type, slug, title, excerpt, body, status, published_at)
       VALUES (?, ?, ?, ?, ?, ?, 'published', CURRENT_TIMESTAMP)`, [tenantId, type, slug, title, excerpt, body]);
  }
  const page = await dbAsync.get("SELECT id, service_id FROM tenant_posts WHERE tenant_id = ? AND type = 'page' AND slug = 'instagram-takipci-satin-al'", [tenantId]);
  if (page && !page.service_id) {
    const service = await dbAsync.get(
      `SELECT s.id FROM services s LEFT JOIN categories c ON c.id = s.category_id
        WHERE s.status = 1 AND s.is_bundle = 0 ORDER BY (lower(COALESCE(s.name_tr, s.name)) LIKE '%instagram%takip%') DESC, s.id LIMIT 1`);
    if (service) await dbAsync.run('UPDATE tenant_posts SET service_id = ? WHERE id = ?', [service.id, page.id]);
  }
  if (!(await dbAsync.get('SELECT 1 FROM tenant_own_products WHERE tenant_id = ?', [tenantId]))) {
    const { encryptSecret } = require('../utils/security');
    const product = await dbAsync.run(
      `INSERT INTO tenant_own_products (tenant_id, name, category, description, usage_note, item_format, price_kurus)
       VALUES (?, 'Spotify Premium 1 Ay (bayinin kendi ürünü)', 'Abonelik', 'Pro pakette bayi kendi stoğunu yükleyip satar.', 'Örnek ürün.', 'email|şifre', 3990)`, [tenantId]);
    for (let i = 1; i <= 5; i++) {
      await dbAsync.run('INSERT INTO tenant_own_product_items (tenant_id, product_id, item_encrypted) VALUES (?, ?, ?)',
        [tenantId, product.id, encryptSecret(`ornek${i}@demo.invalid|OrnekSifre${i}`)]);
    }
  }
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

  // Demo Pro pakette: blog, satis sayfasi ve kendi dijital urunu ornekleri.
  await dbAsync.run("UPDATE tenants SET package = 'pro', pending_package = NULL WHERE id = ?", [tenant.id]);
  await seedDemoContent(tenant.id);

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
