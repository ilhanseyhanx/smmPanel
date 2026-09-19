'use strict';

// Bakiye yuklemeleri tek tabloda (payments) farkli yontemlerle tutulur (banka
// onayi, Shopier, PayTR, kripto, bonus/kupon...). Admin raporlari ve bayilik
// acilis sarti (gercek para yuklemesi) ayni gruplamayi kullanir.
// Sorguda odeme tablosunun takma adi "p" olmalidir.
const PAYMENT_METHOD_GROUP_SQL = `CASE
  WHEN p.method LIKE 'Banka/Papara%' THEN 'bank'
  WHEN p.method = 'Shopier' THEN 'shopier'
  WHEN p.method = 'PayTR' THEN 'paytr'
  WHEN p.method LIKE 'Kripto%' THEN 'crypto'
  WHEN p.method LIKE 'Bonus%' OR p.method LIKE 'Kupon%' OR p.method = 'Referans Kazancı' THEN 'bonus'
  ELSE 'other' END`;

// Gercek para girisi sayilan gruplar: bonus/kupon/referans ve gelistirme
// ortami yuklemeleri ciroya katilmaz.
const REAL_MONEY_GROUPS = `('bank', 'shopier', 'paytr', 'crypto')`;

module.exports = { PAYMENT_METHOD_GROUP_SQL, REAL_MONEY_GROUPS };
