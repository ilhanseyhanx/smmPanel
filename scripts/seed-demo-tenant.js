'use strict';

// Jet'in demo bayisini kurar / onarir (services/demoTenant.js):
// demo.<taban> ve demo-<site>.<taban> adresleri, musteri gozuyle gezme ve
// salt okunur yonetim paneli. Tekrar calistirmak guvenlidir.
// Ayni islem admin > Bayiler > "Demo siteleri kur" dugmesiyle de yapilir.
//   node scripts/seed-demo-tenant.js
require('dotenv').config({ quiet: true });
const { initDatabase } = require('../config/database');
const { ensureDemoTenant } = require('../services/demoTenant');

(async () => {
  await initDatabase();
  const result = await ensureDemoTenant();
  console.log(result.created ? 'demo bayi olusturuldu:' : 'demo bayi guncellendi:', result.id);
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
