'use strict';

// EGITIM SATIN ALMA VE OKUMA TAKIBI
//
// Satin alma her zaman BAKIYEDEN yapilir. Bakiye yetmiyorsa istemci eksik
// tutari Shopier'den odetir (routes/payments.js, course-checkout); odeme
// gelince settleShopierOrder once bakiyeyi yazar, sonra AYNI islem icinde
// purchaseWithBalance'i cagirir. Boylece "para cekildi ama egitim acilmadi"
// durumu olusmaz: egitim alinamazsa (or. fiyat bu arada artti) tutar
// bakiyede kalir ve kullaniciya bildirim gider.

const { dbAsync } = require('../config/database');
const { fromKurus } = require('../utils/money');

// Shopier'in kabul ettigi en dusuk odeme (routes/payments.js SHOPIER_MIN_TRY).
const MIN_TOPUP_KURUS = 1000;

// Okuma kalp atisi: istemci gorunur sekmede 15 sn'de bir gonderir. Tek
// istekte en fazla 30 sn, tek okuyucu-ders kaydinda en fazla 6 saat yazilir;
// acik unutulan sekme istatistigi sisirmesin.
const MAX_BEAT_SECONDS = 30;
const MAX_READING_SECONDS = 6 * 60 * 60;
const VISITOR_RE = /^[a-z0-9]{8,40}$/;

function httpError(status, message, extra = {}) {
  const err = new Error(message);
  err.status = status;
  Object.assign(err, extra);
  return err;
}

/** Istatistik anahtari: giris yapan kullanici "u:ID", ziyaretci "v:<rastgele>". */
function viewerKey(user, visitorId) {
  if (user?.id) return `u:${Number(user.id)}`;
  const id = String(visitorId || '').toLowerCase();
  return VISITOR_RE.test(id) ? `v:${id}` : null;
}

async function isOwned(db, userId, courseId) {
  if (!userId) return false;
  return Boolean(await db.get('SELECT 1 FROM course_purchases WHERE user_id = ? AND course_id = ?', [userId, courseId]));
}

async function ownedCourseIds(db, userId) {
  if (!userId) return new Set();
  const rows = await db.all('SELECT course_id FROM course_purchases WHERE user_id = ?', [userId]);
  return new Set(rows.map(r => Number(r.course_id)));
}

async function completedLessonIds(db, userId, courseId) {
  if (!userId) return new Set();
  const rows = await db.all(
    'SELECT lesson_id FROM course_reading WHERE viewer_key = ? AND course_id = ? AND completed = 1',
    [`u:${Number(userId)}`, courseId]
  );
  return new Set(rows.map(r => Number(r.lesson_id)));
}

/**
 * Satin alma ozeti: fiyat, bakiye ve Shopier'den odenecek tutar.
 * Eksik tutar Shopier alt sinirinin altindaysa alt sinir odetilir; artan
 * kisim bakiyede kalir.
 */
function quote(course, balanceKurus) {
  const price = Number(course.price_kurus || 0);
  const balance = Math.max(0, Number(balanceKurus || 0));
  const shortfall = Math.max(0, price - balance);
  return {
    price_kurus: price,
    balance_kurus: balance,
    shortfall_kurus: shortfall,
    pay_kurus: shortfall ? Math.max(shortfall, MIN_TOPUP_KURUS) : 0
  };
}

/**
 * Egitimi kullanicinin bakiyesinden satin alir. Cagiranin islemi (tx) icinde
 * calisir; bakiye dusumu kosullu UPDATE ile yapilir (yaris durumunda eksiye
 * dusmez).
 * @returns {Promise<{status: 'purchased'|'owned'|'insufficient'|'not_found', price_kurus?: number, balance_kurus?: number, purchase_id?: number}>}
 */
async function purchaseWithBalance(tx, { userId, courseId, source = 'balance', intentId = null, consentAt = null }) {
  const course = await tx.get('SELECT id, title, price_kurus FROM courses WHERE id = ?', [courseId]);
  if (!course) return { status: 'not_found' };
  if (await tx.get('SELECT 1 FROM course_purchases WHERE user_id = ? AND course_id = ?', [userId, courseId])) {
    return { status: 'owned' };
  }
  const price = Number(course.price_kurus || 0);
  if (price > 0) {
    const charged = await tx.run(
      'UPDATE users SET balance_kurus = balance_kurus - ?, balance = (balance_kurus - ?) / 100.0 WHERE id = ? AND balance_kurus >= ?',
      [price, price, userId, price]
    );
    if (charged.changes !== 1) {
      const user = await tx.get('SELECT balance_kurus FROM users WHERE id = ?', [userId]);
      return { status: 'insufficient', price_kurus: price, balance_kurus: Number(user?.balance_kurus || 0) };
    }
  }
  const ins = await tx.run(
    `INSERT INTO course_purchases (user_id, course_id, price_kurus, source, payment_intent_id, consent_at)
     VALUES (?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
    [userId, courseId, price, source, intentId, consentAt]
  );
  await tx.run('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)', [
    userId, 'payment', 'Eğitim açıldı 🎓',
    price > 0
      ? `"${course.title}" eğitimini satın aldın (₺${fromKurus(price).toFixed(2)}). Tüm derslere erişebilirsin.`
      : `"${course.title}" eğitimine kaydoldun. Tüm derslere erişebilirsin.`
  ]);
  const user = await tx.get('SELECT username, balance_kurus FROM users WHERE id = ?', [userId]);
  return {
    status: 'purchased',
    purchase_id: ins.id,
    price_kurus: price,
    balance_kurus: Number(user?.balance_kurus || 0),
    username: user?.username || `#${userId}`,
    course_title: course.title
  };
}

/** Telegram'a satis bildirimi (beklenmez, hata yutulur). */
function notifySale({ username, courseTitle, priceKurus, source }) {
  try {
    const sourceLabel = { balance: 'Bakiye', shopier: 'Shopier (eksik tutar) + bakiye', gift: 'Hediye (admin)' }[source] || source;
    require('./telegramNotifier').notifyPaymentEvent('🎓 Eğitim Satıldı', [
      `👤 Kullanıcı: ${username}`,
      `📚 Eğitim: ${courseTitle}`,
      `💰 Tutar: ₺${fromKurus(priceKurus).toFixed(2)}`,
      `💳 Ödeme: ${sourceLabel}`
    ]);
  } catch { /* bildirim sart degil */ }
}

/**
 * Okuma kalp atisi / tamamlama. Yalnizca okunabilir derslerde cagrilmali
 * (route bunu dogrular).
 */
async function recordReading({ courseId, lessonId, key, userId = null, seconds = 0, completed = false }) {
  const add = Math.max(0, Math.min(MAX_BEAT_SECONDS, Math.round(Number(seconds) || 0)));
  await dbAsync.run(
    `INSERT INTO course_reading (course_id, lesson_id, viewer_key, user_id, seconds, completed)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(lesson_id, viewer_key) DO UPDATE SET
       seconds = MIN(?, course_reading.seconds + excluded.seconds),
       completed = MAX(course_reading.completed, excluded.completed),
       user_id = COALESCE(course_reading.user_id, excluded.user_id),
       last_seen_at = CURRENT_TIMESTAMP`,
    [courseId, lessonId, key, userId, add, completed ? 1 : 0, MAX_READING_SECONDS]
  );
}

const EVENT_TYPES = new Set(['page_view', 'buy_open', 'checkout_start']);

async function recordEvent({ courseId, type, key }) {
  if (!EVENT_TYPES.has(type) || !key) return;
  // Ayni ziyaretcinin ayni olayi 30 dk icinde tekrar yazilmaz (yenileme,
  // pencereyi acip kapama istatistigi sisirmesin).
  const recent = await dbAsync.get(
    `SELECT 1 FROM course_events WHERE course_id = ? AND type = ? AND viewer_key = ?
       AND created_at >= datetime('now', '-30 minutes') LIMIT 1`,
    [courseId, type, key]
  );
  if (recent) return;
  await dbAsync.run('INSERT INTO course_events (course_id, type, viewer_key) VALUES (?, ?, ?)', [courseId, type, key]);
}

module.exports = {
  MIN_TOPUP_KURUS, MAX_BEAT_SECONDS, VISITOR_RE,
  httpError, viewerKey, isOwned, ownedCourseIds, completedLessonIds, quote,
  purchaseWithBalance, notifySale, recordReading, recordEvent
};
