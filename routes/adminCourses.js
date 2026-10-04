'use strict';

// EGITIM YONETIMI (admin) — /api/admin/courses
// Kimlik + admin yetkisi server.js'te bu router'a baglanirken uygulanir.
//
// Istatistik kaynaklari:
//   course_events   -> sayfa goruntuleme / satin alma penceresi / odeme baslatma
//                      (yalnizca JS calistiran ziyaretciler, yonetici haric)
//   course_reading  -> okuyucu-ders basina toplam okuma suresi + tamamlama
//   course_purchases-> satislar
// "Okuyucu" = ayni ders icin tek kayit: giris yapan kullanici "u:ID",
// ziyaretci tarayicida saklanan rastgele kimlik "v:...".

const express = require('express');
const { z } = require('zod');
const { dbAsync, withTransaction } = require('../config/database');
const { validate } = require('../middleware/validate');
const { fromKurus } = require('../utils/money');
const {
  normalizeCoursePayload, normalizeLessonPayload, isLessonFree, listLessons
} = require('../utils/courses');

const router = express.Router();

function idParam(name = 'id') {
  return (req, res, next) => {
    const id = Number(req.params[name]);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Geçersiz kayıt numarası.' });
    req.recordId = id;
    next();
  };
}

function periodDays(req) {
  const days = Number(req.query.days);
  return [7, 30, 90, 365].includes(days) ? days : 30;
}

async function audit(req, action, entityId, details) {
  await dbAsync.run(
    'INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
    [req.user.id, action, 'course', String(entityId), JSON.stringify(details || {}), req.ip]
  ).catch(() => {});
}

// ---------------------------------------------------------------------------
// LISTE + GENEL ISTATISTIK
// ---------------------------------------------------------------------------

router.get('/', async (req, res, next) => {
  try {
    const courses = await dbAsync.all(`
      SELECT c.id, c.slug, c.status, c.title, c.subtitle, c.level, c.price_kurus, c.free_lesson_count,
             c.cover_image_url, c.sort_order, c.updated_at, c.published_at,
             (SELECT COUNT(*) FROM course_lessons l WHERE l.course_id = c.id) lesson_count,
             (SELECT COUNT(*) FROM course_purchases p WHERE p.course_id = c.id) sales,
             (SELECT COALESCE(SUM(price_kurus), 0) FROM course_purchases p WHERE p.course_id = c.id) revenue_kurus,
             (SELECT COUNT(DISTINCT viewer_key) FROM course_events e WHERE e.course_id = c.id AND e.type = 'page_view') visitors,
             (SELECT COUNT(DISTINCT viewer_key) FROM course_reading r WHERE r.course_id = c.id) readers
      FROM courses c ORDER BY c.sort_order ASC, c.id ASC`);
    res.json({
      courses: courses.map(c => ({ ...c, price: fromKurus(c.price_kurus), revenue: fromKurus(c.revenue_kurus) }))
    });
  } catch (err) { next(err); }
});

// Donem ozeti: KPI kartlari, gunluk seri ve egitim bazli huni tablosu.
router.get('/overview', async (req, res, next) => {
  try {
    const days = periodDays(req);
    const since = `-${days} days`;

    const sales = await dbAsync.get(`
      SELECT COUNT(*) count, COALESCE(SUM(price_kurus), 0) revenue_kurus, COUNT(DISTINCT user_id) buyers,
             COALESCE(SUM(CASE WHEN source = 'shopier' THEN 1 ELSE 0 END), 0) via_shopier,
             COALESCE(SUM(CASE WHEN source = 'balance' THEN 1 ELSE 0 END), 0) via_balance,
             COALESCE(SUM(CASE WHEN source = 'gift' THEN 1 ELSE 0 END), 0) gifts
      FROM course_purchases WHERE created_at >= datetime('now', ?)`, [since]);
    const visitors = await dbAsync.get(`
      SELECT COUNT(DISTINCT viewer_key) n FROM course_events WHERE type = 'page_view' AND created_at >= datetime('now', ?)`, [since]);
    const reading = await dbAsync.get(`
      SELECT COUNT(DISTINCT viewer_key) readers,
             COUNT(DISTINCT CASE WHEN viewer_key LIKE 'u:%' THEN viewer_key END) member_readers,
             COALESCE(SUM(seconds), 0) seconds,
             COALESCE(SUM(completed), 0) completions
      FROM course_reading WHERE last_seen_at >= datetime('now', ?)`, [since]);
    const funnel = await dbAsync.get(`
      SELECT COUNT(DISTINCT CASE WHEN type = 'buy_open' THEN viewer_key END) buy_open,
             COUNT(DISTINCT CASE WHEN type = 'checkout_start' THEN viewer_key END) checkout_start
      FROM course_events WHERE created_at >= datetime('now', ?)`, [since]);

    // Gunluk seri (TR saati): ziyaretci, okuyucu, satis, ciro.
    const dailyVisitors = await dbAsync.all(`
      SELECT date(created_at, '+3 hours') d, COUNT(DISTINCT viewer_key) n
      FROM course_events WHERE type = 'page_view' AND created_at >= datetime('now', ?) GROUP BY d`, [since]);
    const dailySales = await dbAsync.all(`
      SELECT date(created_at, '+3 hours') d, COUNT(*) n, COALESCE(SUM(price_kurus), 0) k
      FROM course_purchases WHERE created_at >= datetime('now', ?) GROUP BY d`, [since]);
    const dailyReaders = await dbAsync.all(`
      SELECT date(last_seen_at, '+3 hours') d, COUNT(DISTINCT viewer_key) n
      FROM course_reading WHERE last_seen_at >= datetime('now', ?) GROUP BY d`, [since]);
    const byDay = new Map();
    const slot = d => {
      if (!byDay.has(d)) byDay.set(d, { date: d, visitors: 0, readers: 0, sales: 0, revenue: 0 });
      return byDay.get(d);
    };
    dailyVisitors.forEach(r => { slot(r.d).visitors = r.n; });
    dailyReaders.forEach(r => { slot(r.d).readers = r.n; });
    dailySales.forEach(r => { const s = slot(r.d); s.sales = r.n; s.revenue = fromKurus(r.k); });
    const series = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() + 3 * 3600 * 1000 - i * 86400 * 1000).toISOString().slice(0, 10);
      series.push(byDay.get(d) || { date: d, visitors: 0, readers: 0, sales: 0, revenue: 0 });
    }

    // Egitim bazli huni (donem icinde).
    const perCourse = await dbAsync.all(`
      SELECT c.id, c.title, c.status, c.price_kurus,
        (SELECT COUNT(DISTINCT viewer_key) FROM course_events e WHERE e.course_id = c.id AND e.type = 'page_view' AND e.created_at >= datetime('now', ?1)) visitors,
        (SELECT COUNT(DISTINCT viewer_key) FROM course_reading r WHERE r.course_id = c.id AND r.last_seen_at >= datetime('now', ?1)) readers,
        (SELECT COALESCE(SUM(seconds), 0) FROM course_reading r WHERE r.course_id = c.id AND r.last_seen_at >= datetime('now', ?1)) seconds,
        (SELECT COUNT(DISTINCT viewer_key) FROM course_events e WHERE e.course_id = c.id AND e.type = 'buy_open' AND e.created_at >= datetime('now', ?1)) buy_open,
        (SELECT COUNT(DISTINCT viewer_key) FROM course_events e WHERE e.course_id = c.id AND e.type = 'checkout_start' AND e.created_at >= datetime('now', ?1)) checkout_start,
        (SELECT COUNT(*) FROM course_purchases p WHERE p.course_id = c.id AND p.created_at >= datetime('now', ?1)) sales,
        (SELECT COALESCE(SUM(price_kurus), 0) FROM course_purchases p WHERE p.course_id = c.id AND p.created_at >= datetime('now', ?1)) revenue_kurus
      FROM courses c ORDER BY c.sort_order ASC, c.id ASC`, [since]);

    res.json({
      days,
      kpi: {
        sales: sales.count,
        revenue: fromKurus(sales.revenue_kurus),
        buyers: sales.buyers,
        via_shopier: sales.via_shopier,
        via_balance: sales.via_balance,
        gifts: sales.gifts,
        visitors: visitors.n,
        readers: reading.readers,
        member_readers: reading.member_readers,
        reading_minutes: Math.round(reading.seconds / 60),
        avg_minutes_per_reader: reading.readers ? Math.round((reading.seconds / 60 / reading.readers) * 10) / 10 : 0,
        completions: reading.completions,
        buy_open: funnel.buy_open,
        checkout_start: funnel.checkout_start,
        conversion_percent: visitors.n ? Math.round((sales.count / visitors.n) * 1000) / 10 : 0
      },
      series,
      courses: perCourse.map(c => ({
        ...c,
        price: fromKurus(c.price_kurus),
        revenue: fromKurus(c.revenue_kurus),
        minutes: Math.round(c.seconds / 60),
        avg_minutes: c.readers ? Math.round((c.seconds / 60 / c.readers) * 10) / 10 : 0,
        conversion_percent: c.visitors ? Math.round((c.sales / c.visitors) * 1000) / 10 : 0
      }))
    });
  } catch (err) { next(err); }
});

// Satislar + bekleyen/basarisiz egitim odemeleri.
router.get('/sales', async (req, res, next) => {
  try {
    const courseId = Number(req.query.course_id) || null;
    const purchases = await dbAsync.all(`
      SELECT p.id, p.user_id, p.course_id, p.price_kurus, p.source, p.created_at, p.consent_at,
             u.username, c.title course_title
      FROM course_purchases p
      LEFT JOIN users u ON u.id = p.user_id
      LEFT JOIN courses c ON c.id = p.course_id
      ${courseId ? 'WHERE p.course_id = ?' : ''}
      ORDER BY p.id DESC LIMIT 300`, courseId ? [courseId] : []);
    const intents = await dbAsync.all(`
      SELECT i.id, i.merchant_oid, i.amount_kurus, i.status, i.failure_reason, i.created_at, i.completed_at,
             u.username, c.title course_title
      FROM payment_intents i
      LEFT JOIN users u ON u.id = i.user_id
      LEFT JOIN courses c ON c.id = i.course_id
      WHERE i.course_id IS NOT NULL ${courseId ? 'AND i.course_id = ?' : ''}
      ORDER BY i.id DESC LIMIT 100`, courseId ? [courseId] : []);
    res.json({
      purchases: purchases.map(p => ({ ...p, price: fromKurus(p.price_kurus) })),
      intents: intents.map(i => ({ ...i, amount: fromKurus(i.amount_kurus) }))
    });
  } catch (err) { next(err); }
});

// Satisi geri al: kayit silinir, odenen tutar (hediye degilse) bakiyeye
// iade edilir. Kullanici egitime erisimini kaybeder.
router.post('/purchases/:id/refund', idParam(), async (req, res, next) => {
  try {
    const result = await withTransaction(async tx => {
      const purchase = await tx.get(`SELECT p.*, c.title FROM course_purchases p LEFT JOIN courses c ON c.id = p.course_id WHERE p.id = ?`, [req.recordId]);
      if (!purchase) return null;
      await tx.run('DELETE FROM course_purchases WHERE id = ?', [purchase.id]);
      const refund = purchase.source === 'gift' ? 0 : Number(purchase.price_kurus || 0);
      if (refund > 0) {
        await tx.run('UPDATE users SET balance_kurus = balance_kurus + ?, balance = (balance_kurus + ?) / 100.0 WHERE id = ?', [refund, refund, purchase.user_id]);
      }
      await tx.run('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)', [
        purchase.user_id, 'payment', 'Eğitim iadesi',
        refund > 0
          ? `"${purchase.title || 'Eğitim'}" satın alımın iade edildi; ₺${fromKurus(refund).toFixed(2)} bakiyene eklendi.`
          : `"${purchase.title || 'Eğitim'}" erişimin kaldırıldı.`
      ]);
      return { purchase, refund };
    });
    if (!result) return res.status(404).json({ error: 'Satış kaydı bulunamadı.' });
    await audit(req, 'course_purchase_refunded', result.purchase.course_id, { purchase_id: result.purchase.id, user_id: result.purchase.user_id, refund_kurus: result.refund });
    res.json({ message: result.refund > 0 ? `İade edildi: ₺${fromKurus(result.refund).toFixed(2)} kullanıcının bakiyesine eklendi.` : 'Erişim kaldırıldı.' });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// TEK EGITIM
// ---------------------------------------------------------------------------

router.get('/:id', idParam(), async (req, res, next) => {
  try {
    const course = await dbAsync.get('SELECT * FROM courses WHERE id = ?', [req.recordId]);
    if (!course) return res.status(404).json({ error: 'Eğitim bulunamadı.' });
    const lessons = await dbAsync.all('SELECT * FROM course_lessons WHERE course_id = ? ORDER BY sort_order ASC, id ASC', [course.id]);
    res.json({
      course: { ...course, price: fromKurus(course.price_kurus) },
      lessons: lessons.map((l, i) => ({ ...l, is_free: isLessonFree(course, i) }))
    });
  } catch (err) { next(err); }
});

// Egitimin ders bazli okuma istatistigi + en cok okuyan uyeler.
router.get('/:id/stats', idParam(), async (req, res, next) => {
  try {
    const course = await dbAsync.get('SELECT * FROM courses WHERE id = ?', [req.recordId]);
    if (!course) return res.status(404).json({ error: 'Eğitim bulunamadı.' });
    const lessons = await listLessons(dbAsync, course.id);
    const rows = await dbAsync.all(`
      SELECT lesson_id,
             COUNT(*) readers,
             SUM(CASE WHEN viewer_key LIKE 'u:%' THEN 1 ELSE 0 END) members,
             COALESCE(SUM(seconds), 0) seconds,
             COALESCE(SUM(completed), 0) completions
      FROM course_reading WHERE course_id = ? GROUP BY lesson_id`, [course.id]);
    const byLesson = new Map(rows.map(r => [Number(r.lesson_id), r]));
    const lessonStats = lessons.map((lesson, index) => {
      const r = byLesson.get(Number(lesson.id)) || { readers: 0, members: 0, seconds: 0, completions: 0 };
      return {
        id: lesson.id,
        title: lesson.title,
        position: index + 1,
        is_free: isLessonFree(course, index),
        reading_minutes: lesson.reading_minutes,
        readers: r.readers,
        members: r.members,
        guests: r.readers - r.members,
        minutes: Math.round(r.seconds / 60),
        avg_minutes: r.readers ? Math.round((r.seconds / 60 / r.readers) * 10) / 10 : 0,
        completions: r.completions,
        completion_percent: r.readers ? Math.round((r.completions / r.readers) * 100) : 0
      };
    });
    const funnel = await dbAsync.get(`
      SELECT COUNT(DISTINCT CASE WHEN type = 'page_view' THEN viewer_key END) visitors,
             COUNT(DISTINCT CASE WHEN type = 'buy_open' THEN viewer_key END) buy_open,
             COUNT(DISTINCT CASE WHEN type = 'checkout_start' THEN viewer_key END) checkout_start
      FROM course_events WHERE course_id = ?`, [course.id]);
    const sales = await dbAsync.get('SELECT COUNT(*) n, COALESCE(SUM(price_kurus), 0) k FROM course_purchases WHERE course_id = ?', [course.id]);
    const freeReaders = await dbAsync.get(`
      SELECT COUNT(DISTINCT r.viewer_key) n FROM course_reading r
      WHERE r.course_id = ? AND r.lesson_id IN (${lessonStats.filter(l => l.is_free).map(l => Number(l.id)).join(',') || 0})`, [course.id]);
    const topMembers = await dbAsync.all(`
      SELECT r.user_id, u.username, COUNT(*) lessons, COALESCE(SUM(r.seconds), 0) seconds, COALESCE(SUM(r.completed), 0) completed,
             MAX(r.last_seen_at) last_seen_at,
             EXISTS(SELECT 1 FROM course_purchases p WHERE p.user_id = r.user_id AND p.course_id = r.course_id) owned
      FROM course_reading r JOIN users u ON u.id = r.user_id
      WHERE r.course_id = ? AND r.user_id IS NOT NULL
      GROUP BY r.user_id ORDER BY seconds DESC LIMIT 25`, [course.id]);
    res.json({
      course: { id: course.id, title: course.title, price: fromKurus(course.price_kurus) },
      funnel: { ...funnel, free_readers: freeReaders.n, sales: sales.n, revenue: fromKurus(sales.k) },
      lessons: lessonStats,
      top_members: topMembers.map(m => ({ ...m, minutes: Math.round(m.seconds / 60), owned: Boolean(m.owned) }))
    });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const result = normalizeCoursePayload(req.body || {});
    if (result.error) return res.status(400).json({ error: result.error });
    const f = result.fields;
    // Yeni egitimin henuz dersi yok; yayina ders eklendikten sonra alinir.
    f.status = 'draft';
    if (await dbAsync.get('SELECT id FROM courses WHERE slug = ?', [f.slug])) {
      return res.status(409).json({ error: `"${f.slug}" adresi başka bir eğitimde kullanılıyor.` });
    }
    const cols = Object.keys(f);
    const ins = await dbAsync.run(
      `INSERT INTO courses (${cols.join(', ')}, published_at) VALUES (${cols.map(() => '?').join(', ')}, CASE WHEN ? = 'published' THEN CURRENT_TIMESTAMP ELSE NULL END)`,
      [...cols.map(c => f[c]), f.status]
    );
    await audit(req, 'course_created', ins.id, { title: f.title });
    res.status(201).json({ message: 'Eğitim oluşturuldu. Şimdi derslerini ekleyebilirsin.', id: ins.id, slug: f.slug });
  } catch (err) { next(err); }
});

router.put('/:id', idParam(), async (req, res, next) => {
  try {
    const current = await dbAsync.get('SELECT * FROM courses WHERE id = ?', [req.recordId]);
    if (!current) return res.status(404).json({ error: 'Eğitim bulunamadı.' });
    const result = normalizeCoursePayload(req.body || {}, current);
    if (result.error) return res.status(400).json({ error: result.error });
    const f = result.fields;
    if (f.slug !== current.slug && await dbAsync.get('SELECT id FROM courses WHERE slug = ? AND id != ?', [f.slug, current.id])) {
      return res.status(409).json({ error: `"${f.slug}" adresi başka bir eğitimde kullanılıyor.` });
    }
    if (f.status === 'published') {
      const count = await dbAsync.get('SELECT COUNT(*) n FROM course_lessons WHERE course_id = ?', [current.id]);
      if (!count.n) return res.status(400).json({ error: 'Dersi olmayan eğitim yayınlanamaz. Önce en az bir ders ekle.' });
    }
    const cols = Object.keys(f);
    await dbAsync.run(
      `UPDATE courses SET ${cols.map(c => `${c} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP,
       published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, CURRENT_TIMESTAMP) ELSE published_at END
       WHERE id = ?`,
      [...cols.map(c => f[c]), f.status, current.id]
    );
    if (current.price_kurus !== f.price_kurus) {
      await audit(req, 'course_price_changed', current.id, { from_kurus: current.price_kurus, to_kurus: f.price_kurus });
    }
    res.json({ message: f.status === 'published' ? 'Eğitim kaydedildi ve yayında.' : 'Eğitim taslak olarak kaydedildi.', slug: f.slug });
  } catch (err) { next(err); }
});

// Satisi olan egitim silinemez (alicilarin erisimi kaybolurdu); taslaga
// almak yeterli — sahipleri taslak egitimi okumaya devam eder.
router.delete('/:id', idParam(), async (req, res, next) => {
  try {
    const course = await dbAsync.get('SELECT id, title FROM courses WHERE id = ?', [req.recordId]);
    if (!course) return res.status(404).json({ error: 'Eğitim bulunamadı.' });
    const sold = await dbAsync.get('SELECT COUNT(*) n FROM course_purchases WHERE course_id = ?', [course.id]);
    if (sold.n) return res.status(409).json({ error: `Bu eğitimin ${sold.n} satışı var; silinemez. Yayından kaldırmak için taslağa al (alıcılar okumaya devam eder).` });
    await withTransaction(async tx => {
      await tx.run('UPDATE payment_intents SET course_id = NULL WHERE course_id = ?', [course.id]);
      await tx.run('DELETE FROM courses WHERE id = ?', [course.id]);
    });
    await audit(req, 'course_deleted', course.id, { title: course.title });
    res.json({ message: 'Eğitim silindi.' });
  } catch (err) { next(err); }
});

// Kullaniciya egitimi hediye et (ucretsiz erisim).
router.post('/:id/grant', idParam(), validate(z.object({ username: z.string().trim().min(2).max(80) })), async (req, res, next) => {
  try {
    const course = await dbAsync.get('SELECT id, title FROM courses WHERE id = ?', [req.recordId]);
    if (!course) return res.status(404).json({ error: 'Eğitim bulunamadı.' });
    const user = await dbAsync.get('SELECT id, username FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE', [req.body.username, req.body.username]);
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    const ins = await dbAsync.run(
      "INSERT OR IGNORE INTO course_purchases (user_id, course_id, price_kurus, source) VALUES (?, ?, 0, 'gift')",
      [user.id, course.id]
    );
    if (ins.changes !== 1) return res.status(409).json({ error: `${user.username} bu eğitime zaten sahip.` });
    await dbAsync.run('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
      [user.id, 'payment', 'Hediye eğitim 🎁', `"${course.title}" eğitimi hesabına tanımlandı. Tüm derslere erişebilirsin.`]);
    await audit(req, 'course_granted', course.id, { user_id: user.id });
    res.json({ message: `"${course.title}" eğitimi ${user.username} kullanıcısına tanımlandı.` });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// DERSLER
// ---------------------------------------------------------------------------

router.post('/:id/lessons', idParam(), async (req, res, next) => {
  try {
    const course = await dbAsync.get('SELECT id FROM courses WHERE id = ?', [req.recordId]);
    if (!course) return res.status(404).json({ error: 'Eğitim bulunamadı.' });
    const result = normalizeLessonPayload(req.body || {});
    if (result.error) return res.status(400).json({ error: result.error });
    const f = result.fields;
    if (await dbAsync.get('SELECT id FROM course_lessons WHERE course_id = ? AND slug = ?', [course.id, f.slug])) {
      return res.status(409).json({ error: `"${f.slug}" adresli bir ders bu eğitimde zaten var.` });
    }
    const max = await dbAsync.get('SELECT COALESCE(MAX(sort_order), 0) m FROM course_lessons WHERE course_id = ?', [course.id]);
    const ins = await dbAsync.run(
      `INSERT INTO course_lessons (course_id, slug, title, summary, content, reading_minutes, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [course.id, f.slug, f.title, f.summary, f.content, f.reading_minutes, max.m + 1]
    );
    await dbAsync.run('UPDATE courses SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [course.id]);
    res.status(201).json({ message: 'Ders eklendi.', id: ins.id });
  } catch (err) { next(err); }
});

router.put('/lessons/:lessonId', idParam('lessonId'), async (req, res, next) => {
  try {
    const current = await dbAsync.get('SELECT * FROM course_lessons WHERE id = ?', [req.recordId]);
    if (!current) return res.status(404).json({ error: 'Ders bulunamadı.' });
    const result = normalizeLessonPayload(req.body || {}, current);
    if (result.error) return res.status(400).json({ error: result.error });
    const f = result.fields;
    if (f.slug !== current.slug && await dbAsync.get('SELECT id FROM course_lessons WHERE course_id = ? AND slug = ? AND id != ?', [current.course_id, f.slug, current.id])) {
      return res.status(409).json({ error: `"${f.slug}" adresli bir ders bu eğitimde zaten var.` });
    }
    await dbAsync.run(
      `UPDATE course_lessons SET slug = ?, title = ?, summary = ?, content = ?, reading_minutes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [f.slug, f.title, f.summary, f.content, f.reading_minutes, current.id]
    );
    await dbAsync.run('UPDATE courses SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [current.course_id]);
    res.json({ message: 'Ders kaydedildi.' });
  } catch (err) { next(err); }
});

router.delete('/lessons/:lessonId', idParam('lessonId'), async (req, res, next) => {
  try {
    const lesson = await dbAsync.get('SELECT id, course_id FROM course_lessons WHERE id = ?', [req.recordId]);
    if (!lesson) return res.status(404).json({ error: 'Ders bulunamadı.' });
    const course = await dbAsync.get('SELECT status FROM courses WHERE id = ?', [lesson.course_id]);
    const count = await dbAsync.get('SELECT COUNT(*) n FROM course_lessons WHERE course_id = ?', [lesson.course_id]);
    if (course?.status === 'published' && count.n <= 1) {
      return res.status(400).json({ error: 'Yayındaki eğitimin son dersi silinemez. Önce eğitimi taslağa al.' });
    }
    await dbAsync.run('DELETE FROM course_lessons WHERE id = ?', [lesson.id]);
    res.json({ message: 'Ders silindi.' });
  } catch (err) { next(err); }
});

// Ders sirasi: istemci tum ders kimliklerini yeni sirayla gonderir.
router.post('/:id/lessons/reorder', idParam(), validate(z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1).max(200)
})), async (req, res, next) => {
  try {
    const lessons = await dbAsync.all('SELECT id FROM course_lessons WHERE course_id = ?', [req.recordId]);
    const own = new Set(lessons.map(l => Number(l.id)));
    const ids = req.body.ids.map(Number);
    if (ids.length !== own.size || !ids.every(id => own.has(id)) || new Set(ids).size !== ids.length) {
      return res.status(400).json({ error: 'Ders listesi eksik veya hatalı; sayfayı yenileyip tekrar deneyin.' });
    }
    await withTransaction(async tx => {
      for (let i = 0; i < ids.length; i++) {
        await tx.run('UPDATE course_lessons SET sort_order = ? WHERE id = ?', [i + 1, ids[i]]);
      }
    });
    res.json({ message: 'Ders sırası kaydedildi.' });
  } catch (err) { next(err); }
});

module.exports = router;
