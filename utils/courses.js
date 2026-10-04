'use strict';

// EGITIMLER — veri okuma, admin girdisi dogrulama ve sunucu tarafi isaretleme.
//
// Uc adres vardir ve ucu de sunucuda basilir (server.js):
//   /egitimler                    -> katalog (yayindaki tum egitimler)
//   /egitimler/:egitim            -> egitim tanitimi + ders listesi
//   /egitimler/:egitim/:ders      -> ders okuma ekrani
//
// IKI DIL (5 Eki 2026): ayni adresler ?lang=en ile Ingilizce basilir
// (dil cerezi smm_lang=en de yeterlidir). Ingilizce alan bossa Turkce metne
// duser. Fiyat her iki dilde de TL'dir ve odeme TL alinir; Ingilizce sayfada
// gunluk kurla hesaplanan dolar karsiligi one cikarilir (bkz. services/fx.js).
//
// UCRETSIZ / KILITLI: dersler sort_order'a gore siralanir; ilk
// free_lesson_count ders herkese aciktir ve indekslenir. Kalanlar yalnizca
// egitimi satin alan (veya yonetici) icin basilir; digerleri kilit kutusunu
// gorur ve sayfa noindex olur. Fiyati 0 olan egitimin tum dersleri aciktir.
//
// Icerik kayitta ve cikista sanitizeCourseHtml'den gecer: blog beyaz listesi
// + egitim bilesenleri (bilgi kutulari, renkli tablolar, adim kartlari...)
// icin yalnizca tanimli class degerleri.

const sanitizeHtml = require('sanitize-html');
const { slugify, SLUG_RE } = require('./landingPages');

const LEVELS = ['Başlangıç', 'Orta', 'İleri', 'Her Seviye'];
const LEVELS_EN = { 'Başlangıç': 'Beginner', 'Orta': 'Intermediate', 'İleri': 'Advanced', 'Her Seviye': 'All Levels' };
const BASE_PATH = '/egitimler';

function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// ICERIK TEMIZLEME
// ---------------------------------------------------------------------------

// Egitim icerik bilesenleri (scripts/course-content/YAZIM-KURALLARI.md).
// Listede olmayan class sessizce silinir; style ozniteligi hic gecmez.
const COURSE_CLASSES = {
  div: ['crs-callout', 'tip', 'warn', 'danger', 'info', 'success', 'crs-compare', 'crs-compare-col', 'good', 'bad',
    'crs-template', 'crs-keypoints', 'crs-task'],
  span: ['crs-badge', 'good', 'bad', 'mid', 'new', 'crs-template-label'],
  strong: ['crs-callout-title', 'crs-compare-title'],
  table: ['crs-table', 'blue', 'yellow', 'red', 'green', 'purple'],
  ol: ['crs-steps'],
  ul: ['crs-checklist'],
  figure: ['crs-figure']
};

function sanitizeCourseHtml(value) {
  return sanitizeHtml(String(value || ''), {
    allowedTags: ['p', 'br', 'hr', 'h2', 'h3', 'h4', 'strong', 'em', 'u', 'mark', 'ul', 'ol', 'li', 'blockquote', 'a',
      'figure', 'figcaption', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'pre', 'code', 'div', 'span'],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
      th: ['colspan', 'rowspan'], td: ['colspan', 'rowspan']
    },
    allowedClasses: COURSE_CLASSES,
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      // Site ici baglantilar nofollow almaz; dis baglantilar yeni sekmede ve
      // nofollow (blog ile ayni kural, bkz. utils/security.js).
      a(tagName, attribs) {
        const href = String(attribs.href || '');
        const ic = href.startsWith('/') || href.startsWith('#');
        return { tagName: 'a', attribs: ic ? { ...attribs, rel: 'noopener noreferrer' } : { ...attribs, rel: 'noopener noreferrer nofollow', target: '_blank' } };
      },
      img: sanitizeHtml.simpleTransform('img', { loading: 'lazy', decoding: 'async' }, true)
    }
  });
}

// ---------------------------------------------------------------------------
// DIL
// ---------------------------------------------------------------------------

const T = {
  tr: {
    home: 'Ana Sayfa', courses: 'Eğitimler', kicker: 'Jet SMM Panel Eğitimleri', series: 'Eğitim Serisi',
    catalogTitle: 'Sosyal Medya Eğitimleri',
    catalogIntro: "Instagram, TikTok ve YouTube'da hesabını adım adım büyütmen için hazırladığımız yazılı ve görselli eğitim serileri. Her eğitimin ilk dersleri ücretsiz; beğenirsen bakiyenle satın alıp tamamına erişirsin.",
    lessons: n => `${n} ders`, minutes: n => `~${n} dk`, minutesRead: n => `~${n} dk okuma`, min: n => `${n} dk`,
    allFree: 'Tüm dersler ücretsiz', firstFree: n => `İlk ${n} ders ücretsiz`, free: 'Ücretsiz',
    owned: 'Satın aldın', ownedBadge: 'Bu eğitim senin', cont: 'Devam et', view: 'İncele',
    emptyTitle: 'Eğitimler hazırlanıyor', emptyText: 'İlk eğitim serilerimiz çok yakında burada olacak.',
    draft: 'Bu eğitim taslakta; ziyaretçiler göremez.', about: 'Bu eğitimde neler var?', lessonsTitle: 'Dersler',
    soon: 'Dersler yakında eklenecek.', done: 'Okundu', buy: 'Satın al', freeTag: 'Ücretsiz',
    progress: (d, t) => `${d}/${t} ders tamamlandı`, progressLabel: 'İlerleme',
    resume: 'Kaldığın yerden devam et', start: 'Okumaya başla', oneTime: 'Tek seferlik ödeme, süresiz erişim',
    buyCourse: 'Eğitimi Satın Al', readNow: t => `${t}: hemen oku`,
    lessonOf: (i, n) => `Ders ${i} / ${n}`, freeLesson: 'Ücretsiz ders',
    lockedTitle: 'Bu ders eğitimi satın alanlara açık', lockedText: 'Eğitimin geri kalan derslerine erişmek için eğitimi satın al.',
    freeEnds: 'Ücretsiz dersler burada bitiyor 🎯', remaining: n => `Kalan ${n} derse erişmek için eğitimi satın al.`,
    buyShort: 'Satın Al', prev: 'Önceki ders', coursePage: 'Eğitim sayfası', next: 'Sonraki ders',
    nextLocked: 'Sonraki ders · Satın al', finished: 'Eğitimi bitirdin', unlockAll: 'Tamamını aç', nav: 'Ders gezinme',
    lessonsAria: 'Dersler', chargedTry: '', breadcrumb: 'breadcrumb'
  },
  en: {
    home: 'Home', courses: 'Courses', kicker: 'Jet SMM Panel Academy', series: 'Course',
    catalogTitle: 'Social Media Courses',
    catalogIntro: 'Step-by-step written courses with visuals to grow on Instagram, TikTok and YouTube. The first lessons of every course are free; if you like it, unlock the rest with your balance.',
    lessons: n => `${n} lessons`, minutes: n => `~${n} min`, minutesRead: n => `~${n} min read`, min: n => `${n} min`,
    allFree: 'All lessons free', firstFree: n => `First ${n} lessons free`, free: 'Free',
    owned: 'Purchased', ownedBadge: 'You own this course', cont: 'Continue', view: 'View',
    emptyTitle: 'Courses are on the way', emptyText: 'Our first course series will be here very soon.',
    draft: 'This course is a draft; visitors cannot see it.', about: "What's inside this course?", lessonsTitle: 'Lessons',
    soon: 'Lessons will be added soon.', done: 'Read', buy: 'Unlock', freeTag: 'Free',
    progress: (d, t) => `${d}/${t} lessons completed`, progressLabel: 'Progress',
    resume: 'Continue where you left off', start: 'Start reading', oneTime: 'One-time payment, lifetime access',
    buyCourse: 'Buy This Course', readNow: t => `${t}: read now`,
    lessonOf: (i, n) => `Lesson ${i} / ${n}`, freeLesson: 'Free lesson',
    lockedTitle: 'This lesson is available to course owners', lockedText: 'Buy the course to unlock the remaining lessons.',
    freeEnds: 'The free lessons end here 🎯', remaining: n => `Buy the course to unlock the remaining ${n} lessons.`,
    buyShort: 'Buy', prev: 'Previous lesson', coursePage: 'Course page', next: 'Next lesson',
    nextLocked: 'Next lesson · Unlock', finished: 'You finished the course', unlockAll: 'Unlock all', nav: 'Lesson navigation',
    lessonsAria: 'Lessons', chargedTry: 'Charged in Turkish lira', breadcrumb: 'breadcrumb'
  }
};

function normLang(lang) {
  return lang === 'en' ? 'en' : 'tr';
}

/** Egitim satirinin istenen dildeki gorunumu (bos Ingilizce alan Turkceye duser). */
function localizeCourse(row, lang) {
  if (!row) return row;
  if (normLang(lang) !== 'en') return { ...row };
  const pick = key => (row[`${key}_en`] && String(row[`${key}_en`]).trim() ? row[`${key}_en`] : row[key]);
  return {
    ...row,
    title: pick('title'),
    subtitle: pick('subtitle'),
    description: pick('description'),
    seo_title: row.seo_title_en || (row.title_en ? '' : row.seo_title),
    seo_description: pick('seo_description'),
    cover_image_url: pick('cover_image_url'),
    level: row.level_en || LEVELS_EN[row.level] || row.level,
    total_minutes: row.total_minutes_en || row.total_minutes
  };
}

function localizeLesson(row, lang) {
  if (!row) return row;
  if (normLang(lang) !== 'en') return { ...row };
  const pick = key => (row[`${key}_en`] && String(row[`${key}_en`]).trim() ? row[`${key}_en`] : row[key]);
  return {
    ...row,
    title: pick('title'),
    summary: pick('summary'),
    content: row.content_en && String(row.content_en).trim() ? row.content_en : row.content,
    reading_minutes: row.reading_minutes_en || row.reading_minutes
  };
}

// ---------------------------------------------------------------------------
// FIYAT
// ---------------------------------------------------------------------------

/** ₺149 / ₺149,90 — kurus tam liraysa kusurat yazilmaz. */
function formatPrice(kurus) {
  const value = Number(kurus || 0) / 100;
  const hasFraction = Number(kurus || 0) % 100 !== 0;
  return `₺${value.toLocaleString('tr-TR', { minimumFractionDigits: hasFraction ? 2 : 0, maximumFractionDigits: 2 })}`;
}

function formatUsd(kurus, rate) {
  const r = Number(rate) || 0;
  if (!r) return '';
  return `$${(Number(kurus || 0) / 100 / r).toFixed(2)}`;
}

/**
 * Dile gore fiyat metni. TR: "₺349". EN: "$7.12" ve yaninda TL tutari
 * (odeme TL alinir; kullanici neyin cekilecegini bilsin).
 */
function priceParts(kurus, lang, rate) {
  if (normLang(lang) === 'en' && rate) return { main: formatUsd(kurus, rate), sub: `≈ ${formatPrice(kurus)}` };
  return { main: formatPrice(kurus), sub: '' };
}

function priceHtml(kurus, lang, rate, cls = 'crs-price') {
  const p = priceParts(kurus, lang, rate);
  return `<strong class="${cls}">${esc(p.main)}</strong>${p.sub ? `<small class="crs-price-sub">${esc(p.sub)}</small>` : ''}`;
}

/** Duz metin kelime sayisindan okuma suresi (dakikada ~200 kelime, en az 1). */
function estimateMinutes(html) {
  const words = String(html || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function isFreeCourse(course) {
  return Number(course?.price_kurus || 0) === 0;
}

/** Siradaki (0 tabanli) ders herkese acik mi? */
function isLessonFree(course, index) {
  return isFreeCourse(course) || index < Number(course?.free_lesson_count || 0);
}

// Duz metin alanlari (baslik, ozet...). Etiketler atilip ham metin saklanir;
// her basimda esc()'den gectigi icin guvenlidir ("&" -> "&amp;amp;" olmaz).
function normalizePlainText(value, maxLength) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function isSafeImageUrl(value) {
  const url = String(value || '').trim();
  if (!url) return true;
  if (/["'<>\s]/.test(url)) return false;
  if (url.startsWith('/') && !url.startsWith('//')) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// ADMIN GIRDISI
// ---------------------------------------------------------------------------

/**
 * Egitim formunu dogrular. current verilirse eksik alanlar ondan tamamlanir
 * (kismi guncelleme).
 * @returns {{fields: object}|{error: string}}
 */
function normalizeCoursePayload(body = {}, current = null) {
  const pick = key => (body[key] !== undefined ? body[key] : current?.[key]);
  const title = normalizePlainText(pick('title') || '', 160);
  if (title.length < 3) return { error: 'Eğitim başlığı en az 3 karakter olmalı.' };

  let slug = String(pick('slug') || '').trim().toLowerCase();
  if (!slug) slug = slugify(title);
  if (!SLUG_RE.test(slug) || slug.length < 3 || slug.length > 120) {
    return { error: 'Adres (slug) yalnızca küçük harf, rakam ve tire içerebilir (3-120 karakter).' };
  }

  const status = pick('status') === 'published' ? 'published' : 'draft';

  // Fiyat formda TL olarak gelir (price), veritabaninda kurus tutulur.
  let priceKurus;
  if (body.price !== undefined && body.price !== '') {
    const price = Number(String(body.price).replace(',', '.'));
    if (!Number.isFinite(price) || price < 0 || price > 100000) return { error: 'Fiyat 0 ile 100.000 TL arasında olmalı.' };
    priceKurus = Math.round(price * 100);
  } else {
    priceKurus = Number(current?.price_kurus || 0);
  }

  const freeCount = Number(pick('free_lesson_count') ?? 2);
  if (!Number.isInteger(freeCount) || freeCount < 0 || freeCount > 50) return { error: 'Ücretsiz ders sayısı 0-50 arasında olmalı.' };

  const cover = String(pick('cover_image_url') || '').trim();
  const coverEn = String(pick('cover_image_url_en') || '').trim();
  if (!isSafeImageUrl(cover) || !isSafeImageUrl(coverEn)) return { error: 'Kapak görseli geçerli bir adres olmalı (https://... veya /...).' };

  const sortOrder = Number(pick('sort_order') || 0);

  return {
    fields: {
      slug,
      status,
      title,
      subtitle: normalizePlainText(pick('subtitle') || '', 300),
      description: sanitizeCourseHtml(pick('description') || ''),
      cover_image_url: cover,
      level: normalizePlainText(pick('level') || '', 40),
      price_kurus: priceKurus,
      free_lesson_count: freeCount,
      seo_title: normalizePlainText(pick('seo_title') || '', 180),
      seo_description: normalizePlainText(pick('seo_description') || '', 300),
      sort_order: Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 0,
      title_en: normalizePlainText(pick('title_en') || '', 160),
      subtitle_en: normalizePlainText(pick('subtitle_en') || '', 300),
      description_en: sanitizeCourseHtml(pick('description_en') || ''),
      seo_title_en: normalizePlainText(pick('seo_title_en') || '', 180),
      seo_description_en: normalizePlainText(pick('seo_description_en') || '', 300),
      cover_image_url_en: coverEn,
      level_en: normalizePlainText(pick('level_en') || '', 40)
    }
  };
}

function normalizeLessonPayload(body = {}, current = null) {
  const pick = key => (body[key] !== undefined ? body[key] : current?.[key]);
  const title = normalizePlainText(pick('title') || '', 160);
  if (title.length < 2) return { error: 'Ders başlığı en az 2 karakter olmalı.' };
  let slug = String(pick('slug') || '').trim().toLowerCase();
  if (!slug) slug = slugify(title);
  if (!SLUG_RE.test(slug) || slug.length < 2 || slug.length > 120) {
    return { error: 'Ders adresi (slug) yalnızca küçük harf, rakam ve tire içerebilir.' };
  }
  const content = sanitizeCourseHtml(pick('content') || '');
  const contentEn = sanitizeCourseHtml(pick('content_en') || '');
  return {
    fields: {
      slug,
      title,
      summary: normalizePlainText(pick('summary') || '', 400),
      content,
      reading_minutes: estimateMinutes(content),
      title_en: normalizePlainText(pick('title_en') || '', 160),
      summary_en: normalizePlainText(pick('summary_en') || '', 400),
      content_en: contentEn,
      reading_minutes_en: contentEn ? estimateMinutes(contentEn) : null
    }
  };
}

// ---------------------------------------------------------------------------
// VERI
// ---------------------------------------------------------------------------

const LESSON_LIST_COLUMNS = 'id, course_id, slug, title, summary, reading_minutes, sort_order, updated_at, title_en, summary_en, reading_minutes_en';

async function listLessons(dbAsync, courseId) {
  return dbAsync.all(`SELECT ${LESSON_LIST_COLUMNS} FROM course_lessons WHERE course_id = ? ORDER BY sort_order ASC, id ASC`, [courseId]);
}

/** Katalog: yayindaki egitimler + ders sayisi ve toplam okuma suresi. */
async function listPublishedCourses(dbAsync) {
  return dbAsync.all(`
    SELECT c.id, c.slug, c.title, c.subtitle, c.cover_image_url, c.level, c.price_kurus, c.free_lesson_count,
           c.title_en, c.subtitle_en, c.cover_image_url_en, c.level_en,
           c.updated_at, c.published_at, c.created_at,
           (SELECT COUNT(*) FROM course_lessons l WHERE l.course_id = c.id) lesson_count,
           (SELECT COALESCE(SUM(reading_minutes), 0) FROM course_lessons l WHERE l.course_id = c.id) total_minutes,
           (SELECT COALESCE(SUM(COALESCE(reading_minutes_en, reading_minutes)), 0) FROM course_lessons l WHERE l.course_id = c.id) total_minutes_en
    FROM courses c WHERE c.status = 'published'
    ORDER BY c.sort_order ASC, c.id ASC`).catch(() => []);
}

/**
 * Egitimi ve ders listesini (icerik haric) yukler.
 * Taslak egitim yalnizca includeDraft ile doner (sahibi/yonetici).
 */
async function loadCourse(dbAsync, slug, { includeDraft = false } = {}) {
  if (!SLUG_RE.test(String(slug || ''))) return null;
  const course = await dbAsync.get(`SELECT * FROM courses WHERE slug = ?${includeDraft ? '' : " AND status = 'published'"}`, [slug]);
  if (!course) return null;
  const lessons = await listLessons(dbAsync, course.id);
  return { course, lessons };
}

// ---------------------------------------------------------------------------
// ISARETLEME
// ---------------------------------------------------------------------------

function withLang(url, lang) {
  return normLang(lang) === 'en' ? `${url}?lang=en` : url;
}

function catalogUrl(lang) {
  return withLang(BASE_PATH, lang);
}

function courseUrl(course, lang = 'tr') {
  return withLang(`${BASE_PATH}/${encodeURIComponent(course.slug)}`, lang);
}

function lessonUrl(course, lesson, lang = 'tr') {
  return withLang(`${BASE_PATH}/${encodeURIComponent(course.slug)}/${encodeURIComponent(lesson.slug)}`, lang);
}

function coverHtml(course, cls, eager = false) {
  if (course.cover_image_url) {
    return `<div class="${cls}"><img src="${esc(course.cover_image_url)}" alt="${esc(course.title)}" width="1200" height="675"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async"></div>`;
  }
  return `<div class="${cls} crs-cover-fallback" aria-hidden="true"><i class="fa-solid fa-graduation-cap"></i></div>`;
}

function breadcrumbHtml(items) {
  return `<nav class="lp-breadcrumb crs-breadcrumb" aria-label="breadcrumb">${items.map((item, i) => {
    const sep = i ? ' <span aria-hidden="true">›</span> ' : '';
    return item.href ? `${sep}<a href="${esc(item.href)}">${esc(item.label)}</a>` : `${sep}<span>${esc(item.label)}</span>`;
  }).join('')}</nav>`;
}

function freeBadgeText(course, lessonCount, t) {
  if (isFreeCourse(course)) return t.allFree;
  const free = Math.min(Number(course.free_lesson_count || 0), lessonCount);
  return free ? t.firstFree(free) : '';
}

/**
 * Katalog sayfasi.
 * @param {{courses: object[], ownedIds?: Set<number>, lang?: string, rate?: number}} data
 */
function renderCatalogHtml({ courses, ownedIds = new Set(), lang = 'tr', rate = 0 }) {
  const t = T[normLang(lang)];
  const cards = courses.map(raw => {
    const course = localizeCourse(raw, lang);
    const owned = ownedIds.has(Number(course.id));
    const meta = [
      `<span><i class="fa-solid fa-book-open" aria-hidden="true"></i> ${esc(t.lessons(Number(course.lesson_count) || 0))}</span>`,
      course.total_minutes ? `<span><i class="fa-regular fa-clock" aria-hidden="true"></i> ${esc(t.minutes(Number(course.total_minutes)))}</span>` : '',
      course.level ? `<span><i class="fa-solid fa-signal" aria-hidden="true"></i> ${esc(course.level)}</span>` : ''
    ].filter(Boolean).join('');
    const free = freeBadgeText(course, Number(course.lesson_count) || 0, t);
    const price = owned
      ? `<span class="crs-owned-badge"><i class="fa-solid fa-circle-check" aria-hidden="true"></i> ${esc(t.owned)}</span>`
      : (isFreeCourse(course) ? `<strong class="crs-price">${esc(t.free)}</strong>` : priceHtml(course.price_kurus, lang, rate));
    return `<a class="crs-card glass-card" href="${courseUrl(course, lang)}" data-course-id="${Number(course.id)}">
      ${coverHtml(course, 'crs-card-cover')}
      <div class="crs-card-body">
        <div class="crs-card-meta">${meta}</div>
        <h2 class="crs-card-title">${esc(course.title)}</h2>
        ${course.subtitle ? `<p class="crs-card-sub">${esc(course.subtitle)}</p>` : ''}
        <div class="crs-card-foot">
          <div>${price}${free && !owned ? `<small class="crs-free-note">${esc(free)}</small>` : ''}</div>
          <span class="crs-card-cta">${esc(owned ? t.cont : t.view)} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span>
        </div>
      </div>
    </a>`;
  }).join('\n');

  const empty = `<div class="glass-card crs-empty"><i class="fa-solid fa-hourglass-half" aria-hidden="true"></i>
      <h2>${esc(t.emptyTitle)}</h2><p>${esc(t.emptyText)}</p></div>`;

  return `<div class="crs-wrap" data-crs-page="catalog" data-lang="${normLang(lang)}">
    ${breadcrumbHtml([{ label: t.home, href: '/' }, { label: t.courses }])}
    <header class="crs-catalog-head">
      <span class="crs-kicker"><i class="fa-solid fa-graduation-cap" aria-hidden="true"></i> ${esc(t.kicker)}</span>
      <h1>${esc(t.catalogTitle)}</h1>
      <p>${esc(t.catalogIntro)}</p>
    </header>
    <div class="crs-grid">${courses.length ? cards : empty}</div>
  </div>`;
}

/** Ders listesi (egitim sayfasinda ve ders ekraninin yan sutununda ortak). */
function lessonListHtml({ course, lessons, owned, isAdmin, completed = new Set(), currentId = null, lang = 'tr' }) {
  const t = T[normLang(lang)];
  const items = lessons.map((lesson, index) => {
    const free = isLessonFree(course, index);
    const open = free || owned || isAdmin;
    const done = completed.has(Number(lesson.id));
    const current = Number(lesson.id) === Number(currentId);
    const tag = done
      ? `<span class="crs-ltag done"><i class="fa-solid fa-check" aria-hidden="true"></i> ${esc(t.done)}</span>`
      : free && !owned && !isFreeCourse(course)
        ? `<span class="crs-ltag free">${esc(t.freeTag)}</span>`
        : open ? '' : `<span class="crs-ltag locked"><i class="fa-solid fa-lock" aria-hidden="true"></i> ${esc(t.buy)}</span>`;
    const inner = `<span class="crs-lnum">${index + 1}</span>
        <span class="crs-ltitle">${esc(lesson.title)}</span>
        ${tag}
        <span class="crs-lmin">${esc(t.min(Number(lesson.reading_minutes) || 1))}</span>`;
    const cls = `crs-lesson${open ? '' : ' is-locked'}${done ? ' is-done' : ''}${current ? ' is-current' : ''}`;
    // Kilitli ders baglanti degil dugmedir: kilitli adreslere ic baglanti
    // verilmez (noindex sayfalar), tiklayinca satin alma penceresi acilir.
    return open
      ? `<li class="${cls}"><a href="${lessonUrl(course, lesson, lang)}"${current ? ' aria-current="page"' : ''}>${inner}</a></li>`
      : `<li class="${cls}"><button type="button" data-crs-buy>${inner}</button></li>`;
  }).join('');
  return `<ol class="crs-lesson-list">${items}</ol>`;
}

function progressHtml(lessons, completed, t) {
  if (!lessons.length) return '';
  const done = lessons.filter(l => completed.has(Number(l.id))).length;
  const pct = Math.round((done / lessons.length) * 100);
  return `<div class="crs-progress" aria-label="${esc(t.progressLabel)}">
      <div class="crs-progress-bar"><span style="width:${pct}%"></span></div>
      <small>${esc(t.progress(done, lessons.length))}</small>
    </div>`;
}

function dataAttrs({ page, course, lesson = null, owned, lang, rate }) {
  return `data-crs-page="${page}" data-course-id="${Number(course.id)}" data-course-slug="${esc(course.slug)}"`
    + ` data-course-title="${esc(course.title)}" data-price="${Number(course.price_kurus) || 0}" data-owned="${owned ? '1' : '0'}"`
    + ` data-lang="${normLang(lang)}" data-usd-rate="${Number(rate) || 0}"`
    + (lesson ? ` data-lesson-id="${Number(lesson.id)}"` : '');
}

/** Satin alma kutusu: fiyat + dugme (sahibi icin "devam et"). */
function buyBoxHtml({ course, lessons, owned, completed, lang, rate }) {
  const t = T[normLang(lang)];
  const firstOpen = lessons[0];
  const nextUnread = lessons.find(l => !completed.has(Number(l.id))) || firstOpen;
  if (owned || isFreeCourse(course)) {
    return `<div class="crs-buybox">
        ${owned ? `<span class="crs-owned-badge"><i class="fa-solid fa-circle-check" aria-hidden="true"></i> ${esc(t.ownedBadge)}</span>` : `<strong class="crs-price lg">${esc(t.free)}</strong>`}
        ${nextUnread ? `<a class="btn btn-primary crs-buy-btn" href="${lessonUrl(course, nextUnread, lang)}"><i class="fa-solid fa-book-open-reader" aria-hidden="true"></i> ${esc(completed.size ? t.resume : t.start)}</a>` : ''}
      </div>`;
  }
  const free = freeBadgeText(course, lessons.length, t);
  return `<div class="crs-buybox">
      <div class="crs-price-row">${priceHtml(course.price_kurus, lang, rate, 'crs-price lg')}</div>
      <small class="crs-buy-note">${esc(t.oneTime)}${t.chargedTry ? ` · ${esc(t.chargedTry)}` : ''}</small>
      <button type="button" class="btn btn-primary crs-buy-btn" data-crs-buy><i class="fa-solid fa-unlock" aria-hidden="true"></i> ${esc(t.buyCourse)}</button>
      ${firstOpen && free ? `<a class="btn btn-outline crs-buy-btn" href="${lessonUrl(course, firstOpen, lang)}"><i class="fa-solid fa-book-open" aria-hidden="true"></i> ${esc(t.readNow(free))}</a>` : ''}
    </div>`;
}

/**
 * Egitim tanitim sayfasi.
 * @param {{course, lessons, owned?: boolean, isAdmin?: boolean, completed?: Set<number>, lang?: string, rate?: number}} data
 */
function renderCourseHtml({ course: rawCourse, lessons: rawLessons, owned = false, isAdmin = false, completed = new Set(), lang = 'tr', rate = 0 }) {
  const t = T[normLang(lang)];
  const course = localizeCourse(rawCourse, lang);
  const lessons = rawLessons.map(l => localizeLesson(l, lang));
  const totalMinutes = lessons.reduce((sum, l) => sum + (Number(l.reading_minutes) || 1), 0);
  const free = freeBadgeText(course, lessons.length, t);
  const meta = [
    `<span><i class="fa-solid fa-book-open" aria-hidden="true"></i> ${esc(t.lessons(lessons.length))}</span>`,
    totalMinutes ? `<span><i class="fa-regular fa-clock" aria-hidden="true"></i> ${esc(t.minutesRead(totalMinutes))}</span>` : '',
    course.level ? `<span><i class="fa-solid fa-signal" aria-hidden="true"></i> ${esc(course.level)}</span>` : '',
    free ? `<span><i class="fa-solid fa-gift" aria-hidden="true"></i> ${esc(free)}</span>` : ''
  ].filter(Boolean).join('');

  return `<div class="crs-wrap" ${dataAttrs({ page: 'course', course, owned, lang, rate })}>
    ${breadcrumbHtml([{ label: t.home, href: '/' }, { label: t.courses, href: catalogUrl(lang) }, { label: course.title }])}
    ${course.status !== 'published' ? `<div class="crs-draft-note"><i class="fa-solid fa-eye-slash" aria-hidden="true"></i> ${esc(t.draft)}</div>` : ''}
    <section class="crs-hero glass-card">
      <div class="crs-hero-text">
        <span class="crs-kicker"><i class="fa-solid fa-graduation-cap" aria-hidden="true"></i> ${esc(t.series)}</span>
        <h1>${esc(course.title)}</h1>
        ${course.subtitle ? `<p class="crs-hero-sub">${esc(course.subtitle)}</p>` : ''}
        <div class="crs-hero-meta">${meta}</div>
        ${owned ? progressHtml(lessons, completed, t) : ''}
      </div>
      <div class="crs-hero-side">
        ${coverHtml(course, 'crs-hero-cover', true)}
        ${buyBoxHtml({ course, lessons, owned, completed, lang, rate })}
      </div>
    </section>
    <div class="crs-detail-grid">
      <article class="glass-card crs-prose crs-about">
        <h2>${esc(t.about)}</h2>
        ${sanitizeCourseHtml(course.description || '') || `<p>${esc(course.subtitle || course.title)}</p>`}
      </article>
      <aside class="glass-card crs-lessons-box" aria-label="${esc(t.lessonsAria)}">
        <h2>${esc(t.lessonsTitle)}</h2>
        ${lessons.length ? lessonListHtml({ course, lessons, owned, isAdmin, completed, lang }) : `<p class="crs-muted">${esc(t.soon)}</p>`}
      </aside>
    </div>
  </div>`;
}

/**
 * Ders okuma ekrani.
 * @param {{course, lessons, lesson, content: string, canRead: boolean, owned?: boolean, isAdmin?: boolean, completed?: Set<number>, lang?: string, rate?: number}} data
 */
function renderLessonHtml({ course: rawCourse, lessons: rawLessons, lesson: rawLesson, content, canRead, owned = false, isAdmin = false, completed = new Set(), lang = 'tr', rate = 0 }) {
  const t = T[normLang(lang)];
  const course = localizeCourse(rawCourse, lang);
  const lessons = rawLessons.map(l => localizeLesson(l, lang));
  const lesson = localizeLesson(rawLesson, lang);
  const index = lessons.findIndex(l => Number(l.id) === Number(lesson.id));
  const prev = index > 0 ? lessons[index - 1] : null;
  const next = index >= 0 && index < lessons.length - 1 ? lessons[index + 1] : null;
  const free = isLessonFree(course, index);
  const nextOpen = next && (isLessonFree(course, index + 1) || owned || isAdmin);
  const price = priceParts(course.price_kurus, lang, rate);

  const headTags = [
    `<span>${esc(t.lessonOf(index + 1, lessons.length))}</span>`,
    `<span><i class="fa-regular fa-clock" aria-hidden="true"></i> ${esc(t.minutesRead(Number(lesson.reading_minutes) || 1).replace('~', ''))}</span>`,
    free && !isFreeCourse(course) ? `<span class="crs-ltag free">${esc(t.freeLesson)}</span>` : ''
  ].filter(Boolean).join('');

  const body = canRead
    ? `<div class="crs-prose crs-lesson-content" id="crs-lesson-content">${sanitizeCourseHtml(content || '')}</div>
       <div class="crs-lesson-end" id="crs-lesson-end" aria-hidden="true"></div>`
    : `<div class="crs-locked">
        <i class="fa-solid fa-lock crs-locked-icon" aria-hidden="true"></i>
        <h2>${esc(t.lockedTitle)}</h2>
        <p>${lesson.summary ? esc(lesson.summary) : esc(t.lockedText)}</p>
        <div class="crs-price-row">${priceHtml(course.price_kurus, lang, rate, 'crs-price lg')}</div>
        <button type="button" class="btn btn-primary" data-crs-buy><i class="fa-solid fa-unlock" aria-hidden="true"></i> ${esc(t.buyCourse)}</button>
      </div>`;

  // Son ucretsiz derste (sahibi degilse) devami icin satin alma cagrisi.
  const lastFree = canRead && !owned && !isAdmin && !isFreeCourse(course) && next && !nextOpen;
  const upsell = lastFree
    ? `<div class="crs-upsell">
        <div><strong>${esc(t.freeEnds)}</strong><p>${esc(t.remaining(lessons.length - index - 1))}</p></div>
        <button type="button" class="btn btn-primary" data-crs-buy><i class="fa-solid fa-unlock" aria-hidden="true"></i> ${esc(price.main)} · ${esc(t.buyShort)}</button>
      </div>`
    : '';

  const pager = `<nav class="crs-pager" aria-label="${esc(t.nav)}">
      ${prev ? `<a class="btn btn-outline btn-sm" href="${lessonUrl(course, prev, lang)}"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> ${esc(t.prev)}</a>` : `<a class="btn btn-outline btn-sm" href="${courseUrl(course, lang)}"><i class="fa-solid fa-list" aria-hidden="true"></i> ${esc(t.coursePage)}</a>`}
      ${next
        ? (nextOpen
          ? `<a class="btn btn-primary btn-sm" href="${lessonUrl(course, next, lang)}">${esc(t.next)} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>`
          : `<button type="button" class="btn btn-primary btn-sm" data-crs-buy><i class="fa-solid fa-lock" aria-hidden="true"></i> ${esc(t.nextLocked)}</button>`)
        : `<a class="btn btn-primary btn-sm" href="${courseUrl(course, lang)}"><i class="fa-solid fa-flag-checkered" aria-hidden="true"></i> ${esc(t.finished)}</a>`}
    </nav>`;

  return `<div class="crs-wrap" ${dataAttrs({ page: 'lesson', course, lesson, owned, lang, rate })} data-can-read="${canRead ? '1' : '0'}">
    ${breadcrumbHtml([
      { label: t.home, href: '/' },
      { label: t.courses, href: catalogUrl(lang) },
      { label: course.title, href: courseUrl(course, lang) },
      { label: lesson.title }
    ])}
    <div class="crs-lesson-layout">
      <article class="glass-card crs-reader">
        <div class="crs-reader-head">${headTags}</div>
        <h1 class="crs-reader-title">${esc(lesson.title)}</h1>
        ${body}
        ${upsell}
        ${pager}
      </article>
      <aside class="glass-card crs-lessons-box" aria-label="${esc(t.lessonsAria)}">
        <a class="crs-aside-course" href="${courseUrl(course, lang)}">${esc(course.title)}</a>
        ${owned ? progressHtml(lessons, completed, t) : ''}
        ${lessonListHtml({ course, lessons, owned, isAdmin, completed, currentId: lesson.id, lang })}
        ${!owned && !isAdmin && !isFreeCourse(course) ? `<button type="button" class="btn btn-primary btn-sm crs-aside-buy" data-crs-buy><i class="fa-solid fa-unlock" aria-hidden="true"></i> ${esc(t.unlockAll)} · ${esc(price.main)}</button>` : ''}
      </aside>
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// YAPISAL VERI
// ---------------------------------------------------------------------------

function breadcrumbLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: item.url }))
  };
}

function absUrl(base, url) {
  if (!url) return undefined;
  return url.startsWith('http') ? url : `${base}${url}`;
}

function catalogJsonLd({ base, courses, lang = 'tr' }) {
  const t = T[normLang(lang)];
  return [
    breadcrumbLd([{ name: t.home, url: `${base}/` }, { name: t.courses, url: `${base}${catalogUrl(lang)}` }]),
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: t.catalogTitle,
      itemListElement: courses.map((raw, i) => {
        const course = localizeCourse(raw, lang);
        return { '@type': 'ListItem', position: i + 1, url: `${base}${courseUrl(course, lang)}`, name: course.title };
      })
    }
  ];
}

function courseJsonLd({ base, course: raw, lessons, description, lang = 'tr' }) {
  const t = T[normLang(lang)];
  const course = localizeCourse(raw, lang);
  const totalMinutes = lessons.map(l => localizeLesson(l, lang)).reduce((sum, l) => sum + (Number(l.reading_minutes) || 1), 0);
  const url = `${base}${courseUrl(course, lang)}`;
  return [
    breadcrumbLd([
      { name: t.home, url: `${base}/` },
      { name: t.courses, url: `${base}${catalogUrl(lang)}` },
      { name: course.title, url }
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'Course',
      '@id': `${url}#course`,
      name: course.title,
      description: description || course.subtitle || course.title,
      url,
      inLanguage: normLang(lang) === 'en' ? 'en' : 'tr-TR',
      provider: { '@id': `${base}/#organization` },
      image: absUrl(base, course.cover_image_url),
      educationalLevel: course.level || undefined,
      numberOfLessons: lessons.length || undefined,
      // Odeme TL alindigi icin teklif her iki dilde de TRY'dir.
      offers: {
        '@type': 'Offer',
        category: isFreeCourse(course) ? 'Free' : 'Paid',
        price: (Number(course.price_kurus || 0) / 100).toFixed(2),
        priceCurrency: 'TRY',
        availability: 'https://schema.org/InStock',
        url
      },
      hasCourseInstance: {
        '@type': 'CourseInstance',
        courseMode: 'Online',
        courseWorkload: totalMinutes ? `PT${totalMinutes}M` : undefined
      }
    }
  ];
}

function lessonJsonLd({ base, course: rawCourse, lesson: rawLesson, description, lang = 'tr' }) {
  const t = T[normLang(lang)];
  const course = localizeCourse(rawCourse, lang);
  const lesson = localizeLesson(rawLesson, lang);
  const url = `${base}${lessonUrl(course, lesson, lang)}`;
  return [
    breadcrumbLd([
      { name: t.home, url: `${base}/` },
      { name: t.courses, url: `${base}${catalogUrl(lang)}` },
      { name: course.title, url: `${base}${courseUrl(course, lang)}` },
      { name: lesson.title, url }
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: lesson.title,
      description: description || undefined,
      url,
      inLanguage: normLang(lang) === 'en' ? 'en' : 'tr-TR',
      image: absUrl(base, course.cover_image_url),
      isPartOf: { '@id': `${base}${courseUrl(course, lang)}#course` },
      publisher: { '@id': `${base}/#organization` },
      dateModified: String(lesson.updated_at || course.updated_at || '').slice(0, 10) || undefined
    }
  ];
}

module.exports = {
  BASE_PATH, LEVELS, LEVELS_EN, T, COURSE_CLASSES,
  esc, formatPrice, formatUsd, priceParts, estimateMinutes, isFreeCourse, isLessonFree, isSafeImageUrl,
  sanitizeCourseHtml, normLang, localizeCourse, localizeLesson,
  normalizeCoursePayload, normalizeLessonPayload,
  listLessons, listPublishedCourses, loadCourse,
  catalogUrl, courseUrl, lessonUrl,
  renderCatalogHtml, renderCourseHtml, renderLessonHtml,
  catalogJsonLd, courseJsonLd, lessonJsonLd
};
