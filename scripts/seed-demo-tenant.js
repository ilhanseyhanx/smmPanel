'use strict';

// Jet'in tema vitrini: demo.<taban-alan-adi> adresinde calisan demo bayi.
// /bayilik sayfasindaki tema galerisi buraya ?tema=<ad> ile baglanir.
// Demo sitede kayit, giris, siparis ve odeme kapalidir (tenant/index.js),
// arama motorlarina kapalidir. Tekrar calistirmak guvenlidir (varsa gunceller).
//   node scripts/seed-demo-tenant.js
require('dotenv').config({ quiet: true });
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { initDatabase, dbAsync } = require('../config/database');

const SETTINGS = {
  demo: true,
  announcement: 'Bu bir demo sitedir: yukarıdaki şeritten temaları değiştirip dene. Kayıt ve sipariş kapalıdır.',
  description: 'Jet Bayi Paneli demo sitesi',
  hero_title: 'Kendi SMM panelin [böyle görünür]',
  hero_text: 'Bu sayfa Jet Bayi Paneli ile açılmış örnek bir sitedir. Tema, renk, logo ve metinleri bayi kendi panelinden değiştirir.',
  footer_text: 'Demo site · Jet Bayi Paneli',
  support_email: ''
};

(async () => {
  await initDatabase();
  let user = await dbAsync.get("SELECT id FROM users WHERE username = 'demo_bayi'");
  if (!user) {
    // Giris yapilamayan sistem hesabi: parola rastgele, kimse bilmez.
    const hash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
    const created = await dbAsync.run(
      "INSERT INTO users (username, email, password, role) VALUES ('demo_bayi', 'demo-bayi@jetsmmpanel.invalid', ?, 'user')",
      [hash]
    );
    user = { id: created.id };
  }
  const existing = await dbAsync.get("SELECT id FROM tenants WHERE slug = 'demo'");
  if (existing) {
    await dbAsync.run("UPDATE tenants SET name = 'Demo SMM', plan_status = 'comp', status = 'active', settings_json = ? WHERE id = ?",
      [JSON.stringify(SETTINGS), existing.id]);
    console.log('demo bayi guncellendi:', existing.id);
  } else {
    const created = await dbAsync.run(
      "INSERT INTO tenants (owner_user_id, slug, name, theme, plan_status, settings_json) VALUES (?, 'demo', 'Demo SMM', 'gradient', 'comp', ?)",
      [user.id, JSON.stringify(SETTINGS)]
    );
    console.log('demo bayi olusturuldu:', created.id);
  }
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
