'use strict';

// Egitimler — herkese acik API. Sayfalarin kendisi sunucuda basilir
// (server.js /egitimler); bu uclar satin alma penceresi, okuma takibi ve
// katalogdaki "satin aldin" rozetleri icindir. Admin uclari
// routes/adminCourses.js'te. Eksik bakiyeyi Shopier'den odetme ucu ise odeme
// hiz siniriyla birlikte routes/payments.js'te (shopier/course-checkout).

const express = require('express');
const { z } = require('zod');
const { dbAsync, withTransaction } = require('../config/database');
const { authenticateToken, optionalUser } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { fromKurus } = require('../utils/money');
const { listPublishedCourses, isLessonFree, isFreeCourse, listLessons } = require('../utils/courses');
const Courses = require('../services/courses');
const Shopier = require('../services/shopier');

const router = express.Router();

async function publishedCourseBySlug(slug) {
  return dbAsync.get("SELECT * FROM courses WHERE slug = ? AND status = 'published'", [String(slug || '').slice(0, 120)]);
}

// Katalog (JSON). Giris yapildiysa satin alinanlarin kimlikleri de doner.
router.get('/', async (req, res, next) => {
  try {
    const user = await optionalUser(req);
    const courses = await listPublishedCourses(dbAsync);
    const owned = await Courses.ownedCourseIds(dbAsync, user?.id);
    res.json({
      courses: courses.map(c => ({
        id: c.id, slug: c.slug, title: c.title, subtitle: c.subtitle, cover_image_url: c.cover_image_url,
        level: c.level, price: fromKurus(c.price_kurus), lesson_count: c.lesson_count, owned: owned.has(Number(c.id))
      }))
    });
  } catch (err) { next(err); }
});

// Satin alma penceresinin ozeti: fiyat, bakiye, odenecek eksik tutar.
router.get('/:slug/quote', authenticateToken, async (req, res, next) => {
  try {
    const course = await publishedCourseBySlug(req.params.slug);
    if (!course) return res.status(404).json({ error: 'Eğitim bulunamadı.' });
    const owned = await Courses.isOwned(dbAsync, req.user.id, course.id);
    const q = Courses.quote(course, req.user.balance_kurus);
    res.json({
      course: { id: course.id, slug: course.slug, title: course.title },
      owned,
      price: fromKurus(q.price_kurus),
      balance: fromKurus(q.balance_kurus),
      shortfall: fromKurus(q.shortfall_kurus),
      pay_amount: fromKurus(q.pay_kurus),
      shopier_ready: await Shopier.isConfigured().catch(() => false)
    });
  } catch (err) { next(err); }
});

// Bakiyeden satin alma. Dijital icerik oldugu icin kullanicinin "hemen
// erisim / cayma hakki" onayi zorunludur ve kayda gecer.
router.post('/:slug/purchase', authenticateToken, validate(z.object({
  consent: z.literal(true, { message: 'Satın almak için dijital içerik onayını işaretlemelisin.' })
})), async (req, res, next) => {
  try {
    const course = await publishedCourseBySlug(req.params.slug);
    if (!course) return res.status(404).json({ error: 'Eğitim bulunamadı.' });
    const result = await withTransaction(tx => Courses.purchaseWithBalance(tx, {
      userId: req.user.id, courseId: course.id, source: 'balance'
    }));
    if (result.status === 'owned') return res.status(409).json({ error: 'Bu eğitim zaten senin.', code: 'already_owned' });
    if (result.status === 'insufficient') {
      const q = Courses.quote(course, result.balance_kurus);
      return res.status(402).json({
        error: 'Bakiyen bu eğitim için yetersiz.',
        code: 'insufficient_balance',
        price: fromKurus(q.price_kurus),
        balance: fromKurus(q.balance_kurus),
        shortfall: fromKurus(q.shortfall_kurus),
        pay_amount: fromKurus(q.pay_kurus)
      });
    }
    if (result.status !== 'purchased') return res.status(404).json({ error: 'Eğitim bulunamadı.' });
    Courses.notifySale({ username: result.username, courseTitle: result.course_title, priceKurus: result.price_kurus, source: 'balance' });
    res.status(201).json({
      message: isFreeCourse(course) ? 'Eğitime kaydoldun!' : 'Eğitim satın alındı, tüm dersler açıldı!',
      balance: fromKurus(result.balance_kurus)
    });
  } catch (err) { next(err); }
});

// Okuma kalp atisi ve "dersi bitirdi" isareti. Yalnizca okunabilir derslerde
// (ucretsiz / satin alinmis / yonetici) kayit tutulur.
router.post('/track', validate(z.object({
  lesson_id: z.coerce.number().int().positive(),
  visitor_id: z.string().trim().max(40).optional(),
  seconds: z.coerce.number().min(0).max(60).default(0),
  completed: z.boolean().optional()
})), async (req, res, next) => {
  try {
    const user = await optionalUser(req);
    const key = Courses.viewerKey(user, req.body.visitor_id);
    if (!key) return res.status(204).end();
    const lesson = await dbAsync.get(
      `SELECT l.id, l.course_id, c.status, c.price_kurus, c.free_lesson_count
       FROM course_lessons l JOIN courses c ON c.id = l.course_id WHERE l.id = ?`,
      [req.body.lesson_id]
    );
    if (!lesson) return res.status(204).end();
    const lessons = await listLessons(dbAsync, lesson.course_id);
    const index = lessons.findIndex(l => Number(l.id) === Number(lesson.id));
    const owned = await Courses.isOwned(dbAsync, user?.id, lesson.course_id);
    const canRead = user?.role === 'admin' || owned || (lesson.status === 'published' && isLessonFree(lesson, index));
    // Yonetici kendi okumasini istatistige katmaz.
    if (!canRead || user?.role === 'admin') return res.status(204).end();
    await Courses.recordReading({
      courseId: lesson.course_id, lessonId: lesson.id, key, userId: user?.id || null,
      seconds: req.body.seconds, completed: Boolean(req.body.completed)
    });
    res.status(204).end();
  } catch (err) { next(err); }
});

// Huni olaylari: sayfa goruntuleme ve satin alma penceresinin acilmasi.
// Sayfa goruntuleme sunucuda degil burada sayilir: JS calistirmayan botlar
// istatistige girmesin.
router.post('/event', validate(z.object({
  course_id: z.coerce.number().int().positive(),
  type: z.enum(['page_view', 'buy_open']),
  visitor_id: z.string().trim().max(40).optional()
})), async (req, res, next) => {
  try {
    const user = await optionalUser(req);
    if (user?.role === 'admin') return res.status(204).end();
    const key = Courses.viewerKey(user, req.body.visitor_id);
    const course = await dbAsync.get("SELECT id FROM courses WHERE id = ? AND status = 'published'", [req.body.course_id]);
    if (key && course) await Courses.recordEvent({ courseId: course.id, type: req.body.type, key });
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
