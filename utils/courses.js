'use strict';

// EGITIMLER — veri okuma, admin girdisi dogrulama ve sunucu tarafi isaretleme.
//
// Uc adres vardir ve ucu de sunucuda basilir (server.js):
//   /egitimler                    -> katalog (yayindaki tum egitimler)
//   /egitimler/:egitim            -> egitim tanitimi + ders listesi
//   /egitimler/:egitim/:ders      -> ders okuma ekrani
//
// UCRETSIZ / KILITLI: dersler sort_order'a gore siralanir; ilk
// free_lesson_count ders herkese aciktir ve indekslenir. Kalanlar yalnizca
// egitimi satin alan (veya yonetici) icin basilir; digerleri kilit kutusunu
// gorur ve sayfa noindex olur. Fiyati 0 olan egitimin tum dersleri aciktir.
//
// Icerik admin panelinde girilir; kayitta ve cikista sanitizeRichText'ten
// gecer (blog ile ayni beyaz liste).

const { sanitizeRichText } = require('./security');
const { slugify, SLUG_RE } = require('./landingPages');

const LEVELS = ['Başlangıç', 'Orta', 'İleri', 'Her Seviye'];
const BASE_PATH = '/egitimler';

function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** ₺149 / ₺149,90 — kurus tam liraysa kusurat yazilmaz. */
function formatPrice(kurus) {
  const value = Number(kurus || 0) / 100;
  const hasFraction = Number(kurus || 0) % 100 !== 0;
  return `₺${value.toLocaleString('tr-TR', { minimumFractionDigits: hasFraction ? 2 : 0, maximumFractionDigits: 2 })}`;
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

// Duz metin alanlari (baslik, ozet...). normalizePlainText HTML varliklarina
// cevirir ("&" -> "&amp;"); cikista esc() bir kez daha kacirinca ekranda
// "&amp;" gorunurdu. Burada etiketler atilip ham metin saklanir; her
// basimda esc()'den gectigi icin guvenlidir.
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
  if (!isSafeImageUrl(cover)) return { error: 'Kapak görseli geçerli bir adres olmalı (https://... veya /...).' };

  const level = normalizePlainText(pick('level') || '', 40);
  const sortOrder = Number(pick('sort_order') || 0);

  return {
    fields: {
      slug,
      status,
      title,
      subtitle: normalizePlainText(pick('subtitle') || '', 300),
      description: sanitizeRichText(pick('description') || ''),
      cover_image_url: cover,
      level,
      price_kurus: priceKurus,
      free_lesson_count: freeCount,
      seo_title: normalizePlainText(pick('seo_title') || '', 180),
      seo_description: normalizePlainText(pick('seo_description') || '', 300),
      sort_order: Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 0
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
  const content = sanitizeRichText(pick('content') || '');
  return {
    fields: {
      slug,
      title,
      summary: normalizePlainText(pick('summary') || '', 400),
      content,
      reading_minutes: estimateMinutes(content)
    }
  };
}

// ---------------------------------------------------------------------------
// VERI
// ---------------------------------------------------------------------------

const LESSON_LIST_COLUMNS = 'id, course_id, slug, title, summary, reading_minutes, sort_order';

async function listLessons(dbAsync, courseId) {
  return dbAsync.all(`SELECT ${LESSON_LIST_COLUMNS} FROM course_lessons WHERE course_id = ? ORDER BY sort_order ASC, id ASC`, [courseId]);
}

/** Katalog: yayindaki egitimler + ders sayisi ve toplam okuma suresi. */
async function listPublishedCourses(dbAsync) {
  return dbAsync.all(`
    SELECT c.id, c.slug, c.title, c.subtitle, c.cover_image_url, c.level, c.price_kurus, c.free_lesson_count,
           c.updated_at, c.published_at, c.created_at,
           (SELECT COUNT(*) FROM course_lessons l WHERE l.course_id = c.id) lesson_count,
           (SELECT COALESCE(SUM(reading_minutes), 0) FROM course_lessons l WHERE l.course_id = c.id) total_minutes
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

function courseUrl(course) {
  return `${BASE_PATH}/${encodeURIComponent(course.slug)}`;
}

function lessonUrl(course, lesson) {
  return `${courseUrl(course)}/${encodeURIComponent(lesson.slug)}`;
}

function coverHtml(course, cls) {
  if (course.cover_image_url) {
    return `<div class="${cls}"><img src="${esc(course.cover_image_url)}" alt="${esc(course.title)}" loading="lazy" decoding="async"></div>`;
  }
  return `<div class="${cls} crs-cover-fallback" aria-hidden="true"><i class="fa-solid fa-graduation-cap"></i></div>`;
}

function breadcrumbHtml(items) {
  return `<nav class="lp-breadcrumb crs-breadcrumb" aria-label="breadcrumb">${items.map((item, i) => {
    const sep = i ? ' <span aria-hidden="true">›</span> ' : '';
    return item.href ? `${sep}<a href="${esc(item.href)}">${esc(item.label)}</a>` : `${sep}<span>${esc(item.label)}</span>`;
  }).join('')}</nav>`;
}

function freeBadgeText(course, lessonCount) {
  if (isFreeCourse(course)) return 'Tüm dersler ücretsiz';
  const free = Math.min(Number(course.free_lesson_count || 0), lessonCount);
  return free ? `İlk ${free} ders ücretsiz` : '';
}

/**
 * Katalog sayfasi.
 * @param {{courses: object[], ownedIds?: Set<number>}} data
 */
function renderCatalogHtml({ courses, ownedIds = new Set() }) {
  const cards = courses.map(course => {
    const owned = ownedIds.has(Number(course.id));
    const meta = [
      `<span><i class="fa-solid fa-book-open" aria-hidden="true"></i> ${Number(course.lesson_count) || 0} ders</span>`,
      course.total_minutes ? `<span><i class="fa-regular fa-clock" aria-hidden="true"></i> ~${Number(course.total_minutes)} dk</span>` : '',
      course.level ? `<span><i class="fa-solid fa-signal" aria-hidden="true"></i> ${esc(course.level)}</span>` : ''
    ].filter(Boolean).join('');
    const free = freeBadgeText(course, Number(course.lesson_count) || 0);
    const price = owned
      ? '<span class="crs-owned-badge"><i class="fa-solid fa-circle-check" aria-hidden="true"></i> Satın aldın</span>'
      : `<strong class="crs-price">${isFreeCourse(course) ? 'Ücretsiz' : formatPrice(course.price_kurus)}</strong>`;
    return `<a class="crs-card glass-card" href="${courseUrl(course)}" data-course-id="${Number(course.id)}">
      ${coverHtml(course, 'crs-card-cover')}
      <div class="crs-card-body">
        <div class="crs-card-meta">${meta}</div>
        <h2 class="crs-card-title">${esc(course.title)}</h2>
        ${course.subtitle ? `<p class="crs-card-sub">${esc(course.subtitle)}</p>` : ''}
        <div class="crs-card-foot">
          <div>${price}${free && !owned ? `<small class="crs-free-note">${esc(free)}</small>` : ''}</div>
          <span class="crs-card-cta">${owned ? 'Devam et' : 'İncele'} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span>
        </div>
      </div>
    </a>`;
  }).join('\n');

  const empty = `<div class="glass-card crs-empty"><i class="fa-solid fa-hourglass-half" aria-hidden="true"></i>
      <h2>Eğitimler hazırlanıyor</h2><p>İlk eğitim serilerimiz çok yakında burada olacak.</p></div>`;

  return `<div class="crs-wrap" data-crs-page="catalog">
    ${breadcrumbHtml([{ label: 'Ana Sayfa', href: '/' }, { label: 'Eğitimler' }])}
    <header class="crs-catalog-head">
      <span class="crs-kicker"><i class="fa-solid fa-graduation-cap" aria-hidden="true"></i> Jet SMM Panel Eğitimleri</span>
      <h1>Sosyal Medya Eğitimleri</h1>
      <p>Instagram, TikTok ve YouTube'da hesabını adım adım büyütmen için hazırladığımız yazılı ve görselli eğitim serileri. Her eğitimin ilk dersleri ücretsiz; beğenirsen bakiyenle satın alıp tamamına erişirsin.</p>
    </header>
    <div class="crs-grid">${courses.length ? cards : empty}</div>
  </div>`;
}

/** Ders listesi (egitim sayfasinda ve ders ekraninin yan sutununda ortak). */
function lessonListHtml({ course, lessons, owned, isAdmin, completed = new Set(), currentId = null }) {
  const items = lessons.map((lesson, index) => {
    const free = isLessonFree(course, index);
    const open = free || owned || isAdmin;
    const done = completed.has(Number(lesson.id));
    const current = Number(lesson.id) === Number(currentId);
    const tag = done
      ? '<span class="crs-ltag done"><i class="fa-solid fa-check" aria-hidden="true"></i> Okundu</span>'
      : free && !owned && !isFreeCourse(course)
        ? '<span class="crs-ltag free">Ücretsiz</span>'
        : open ? '' : '<span class="crs-ltag locked"><i class="fa-solid fa-lock" aria-hidden="true"></i> Satın al</span>';
    const inner = `<span class="crs-lnum">${index + 1}</span>
        <span class="crs-ltitle">${esc(lesson.title)}</span>
        ${tag}
        <span class="crs-lmin">${Number(lesson.reading_minutes) || 1} dk</span>`;
    const cls = `crs-lesson${open ? '' : ' is-locked'}${done ? ' is-done' : ''}${current ? ' is-current' : ''}`;
    // Kilitli ders baglanti degil dugmedir: kilitli adreslere ic baglanti
    // verilmez (noindex sayfalar), tiklayinca satin alma penceresi acilir.
    return open
      ? `<li class="${cls}"><a href="${lessonUrl(course, lesson)}"${current ? ' aria-current="page"' : ''}>${inner}</a></li>`
      : `<li class="${cls}"><button type="button" data-crs-buy>${inner}</button></li>`;
  }).join('');
  return `<ol class="crs-lesson-list">${items}</ol>`;
}

function progressHtml(lessons, completed) {
  if (!lessons.length) return '';
  const done = lessons.filter(l => completed.has(Number(l.id))).length;
  const pct = Math.round((done / lessons.length) * 100);
  return `<div class="crs-progress" aria-label="İlerleme">
      <div class="crs-progress-bar"><span style="width:${pct}%"></span></div>
      <small>${done}/${lessons.length} ders tamamlandı</small>
    </div>`;
}

function dataAttrs({ page, course, lesson = null, owned }) {
  return `data-crs-page="${page}" data-course-id="${Number(course.id)}" data-course-slug="${esc(course.slug)}"`
    + ` data-course-title="${esc(course.title)}" data-price="${Number(course.price_kurus) || 0}" data-owned="${owned ? '1' : '0'}"`
    + (lesson ? ` data-lesson-id="${Number(lesson.id)}"` : '');
}

/** Satin alma kutusu: fiyat + dugme (sahibi icin "devam et"). */
function buyBoxHtml({ course, lessons, owned, completed }) {
  const firstOpen = lessons[0];
  const nextUnread = lessons.find(l => !completed.has(Number(l.id))) || firstOpen;
  if (owned || isFreeCourse(course)) {
    return `<div class="crs-buybox">
        ${owned ? '<span class="crs-owned-badge"><i class="fa-solid fa-circle-check" aria-hidden="true"></i> Bu eğitim senin</span>' : '<strong class="crs-price lg">Ücretsiz</strong>'}
        ${nextUnread ? `<a class="btn btn-primary crs-buy-btn" href="${lessonUrl(course, nextUnread)}"><i class="fa-solid fa-book-open-reader" aria-hidden="true"></i> ${completed.size ? 'Kaldığın yerden devam et' : 'Okumaya başla'}</a>` : ''}
      </div>`;
  }
  const free = freeBadgeText(course, lessons.length);
  return `<div class="crs-buybox">
      <strong class="crs-price lg">${formatPrice(course.price_kurus)}</strong>
      <small class="crs-buy-note">Tek seferlik ödeme, süresiz erişim</small>
      <button type="button" class="btn btn-primary crs-buy-btn" data-crs-buy><i class="fa-solid fa-unlock" aria-hidden="true"></i> Eğitimi Satın Al</button>
      ${firstOpen && free ? `<a class="btn btn-outline crs-buy-btn" href="${lessonUrl(course, firstOpen)}"><i class="fa-solid fa-book-open" aria-hidden="true"></i> ${esc(free)}: hemen oku</a>` : ''}
    </div>`;
}

/**
 * Egitim tanitim sayfasi.
 * @param {{course, lessons, owned?: boolean, isAdmin?: boolean, completed?: Set<number>}} data
 */
function renderCourseHtml({ course, lessons, owned = false, isAdmin = false, completed = new Set() }) {
  const totalMinutes = lessons.reduce((sum, l) => sum + (Number(l.reading_minutes) || 1), 0);
  const free = freeBadgeText(course, lessons.length);
  const meta = [
    `<span><i class="fa-solid fa-book-open" aria-hidden="true"></i> ${lessons.length} ders</span>`,
    totalMinutes ? `<span><i class="fa-regular fa-clock" aria-hidden="true"></i> ~${totalMinutes} dk okuma</span>` : '',
    course.level ? `<span><i class="fa-solid fa-signal" aria-hidden="true"></i> ${esc(course.level)}</span>` : '',
    free ? `<span><i class="fa-solid fa-gift" aria-hidden="true"></i> ${esc(free)}</span>` : ''
  ].filter(Boolean).join('');

  return `<div class="crs-wrap" ${dataAttrs({ page: 'course', course, owned })}>
    ${breadcrumbHtml([{ label: 'Ana Sayfa', href: '/' }, { label: 'Eğitimler', href: BASE_PATH }, { label: course.title }])}
    ${course.status !== 'published' ? '<div class="crs-draft-note"><i class="fa-solid fa-eye-slash" aria-hidden="true"></i> Bu eğitim taslakta; ziyaretçiler göremez.</div>' : ''}
    <section class="crs-hero glass-card">
      <div class="crs-hero-text">
        <span class="crs-kicker"><i class="fa-solid fa-graduation-cap" aria-hidden="true"></i> Eğitim Serisi</span>
        <h1>${esc(course.title)}</h1>
        ${course.subtitle ? `<p class="crs-hero-sub">${esc(course.subtitle)}</p>` : ''}
        <div class="crs-hero-meta">${meta}</div>
        ${owned ? progressHtml(lessons, completed) : ''}
      </div>
      <div class="crs-hero-side">
        ${coverHtml(course, 'crs-hero-cover')}
        ${buyBoxHtml({ course, lessons, owned, completed })}
      </div>
    </section>
    <div class="crs-detail-grid">
      <article class="glass-card crs-prose crs-about">
        <h2>Bu eğitimde neler var?</h2>
        ${sanitizeRichText(course.description || '') || `<p>${esc(course.subtitle || course.title)}</p>`}
      </article>
      <aside class="glass-card crs-lessons-box" aria-label="Dersler">
        <h2>Dersler</h2>
        ${lessons.length ? lessonListHtml({ course, lessons, owned, isAdmin, completed }) : '<p class="crs-muted">Dersler yakında eklenecek.</p>'}
      </aside>
    </div>
  </div>`;
}

/**
 * Ders okuma ekrani.
 * @param {{course, lessons, lesson, content: string, canRead: boolean, owned?: boolean, isAdmin?: boolean, completed?: Set<number>}} data
 */
function renderLessonHtml({ course, lessons, lesson, content, canRead, owned = false, isAdmin = false, completed = new Set() }) {
  const index = lessons.findIndex(l => Number(l.id) === Number(lesson.id));
  const prev = index > 0 ? lessons[index - 1] : null;
  const next = index >= 0 && index < lessons.length - 1 ? lessons[index + 1] : null;
  const free = isLessonFree(course, index);
  const nextOpen = next && (isLessonFree(course, index + 1) || owned || isAdmin);

  const headTags = [
    `<span>Ders ${index + 1} / ${lessons.length}</span>`,
    `<span><i class="fa-regular fa-clock" aria-hidden="true"></i> ${Number(lesson.reading_minutes) || 1} dk okuma</span>`,
    free && !isFreeCourse(course) ? '<span class="crs-ltag free">Ücretsiz ders</span>' : ''
  ].filter(Boolean).join('');

  const body = canRead
    ? `<div class="crs-prose crs-lesson-content" id="crs-lesson-content">${sanitizeRichText(content || '')}</div>
       <div class="crs-lesson-end" id="crs-lesson-end" aria-hidden="true"></div>`
    : `<div class="crs-locked">
        <i class="fa-solid fa-lock crs-locked-icon" aria-hidden="true"></i>
        <h2>Bu ders eğitimi satın alanlara açık</h2>
        <p>${lesson.summary ? esc(lesson.summary) : 'Eğitimin geri kalan derslerine erişmek için eğitimi satın al.'}</p>
        <strong class="crs-price lg">${formatPrice(course.price_kurus)}</strong>
        <button type="button" class="btn btn-primary" data-crs-buy><i class="fa-solid fa-unlock" aria-hidden="true"></i> Eğitimi Satın Al</button>
      </div>`;

  // Son ucretsiz derste (sahibi degilse) devami icin satin alma cagrisi.
  const lastFree = canRead && !owned && !isAdmin && !isFreeCourse(course) && next && !nextOpen;
  const upsell = lastFree
    ? `<div class="crs-upsell">
        <div><strong>Ücretsiz dersler burada bitiyor 🎯</strong><p>Kalan ${lessons.length - index - 1} derse erişmek için eğitimi satın al.</p></div>
        <button type="button" class="btn btn-primary" data-crs-buy><i class="fa-solid fa-unlock" aria-hidden="true"></i> ${formatPrice(course.price_kurus)} · Satın Al</button>
      </div>`
    : '';

  const pager = `<nav class="crs-pager" aria-label="Ders gezinme">
      ${prev ? `<a class="btn btn-outline btn-sm" href="${lessonUrl(course, prev)}"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Önceki ders</a>` : `<a class="btn btn-outline btn-sm" href="${courseUrl(course)}"><i class="fa-solid fa-list" aria-hidden="true"></i> Eğitim sayfası</a>`}
      ${next
        ? (nextOpen
          ? `<a class="btn btn-primary btn-sm" href="${lessonUrl(course, next)}">Sonraki ders <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>`
          : '<button type="button" class="btn btn-primary btn-sm" data-crs-buy><i class="fa-solid fa-lock" aria-hidden="true"></i> Sonraki ders · Satın al</button>')
        : `<a class="btn btn-primary btn-sm" href="${courseUrl(course)}"><i class="fa-solid fa-flag-checkered" aria-hidden="true"></i> Eğitimi bitirdin</a>`}
    </nav>`;

  return `<div class="crs-wrap" ${dataAttrs({ page: 'lesson', course, lesson, owned })} data-can-read="${canRead ? '1' : '0'}">
    ${breadcrumbHtml([
      { label: 'Ana Sayfa', href: '/' },
      { label: 'Eğitimler', href: BASE_PATH },
      { label: course.title, href: courseUrl(course) },
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
      <aside class="glass-card crs-lessons-box" aria-label="Dersler">
        <a class="crs-aside-course" href="${courseUrl(course)}">${esc(course.title)}</a>
        ${owned ? progressHtml(lessons, completed) : ''}
        ${lessonListHtml({ course, lessons, owned, isAdmin, completed, currentId: lesson.id })}
        ${!owned && !isAdmin && !isFreeCourse(course) ? `<button type="button" class="btn btn-primary btn-sm crs-aside-buy" data-crs-buy><i class="fa-solid fa-unlock" aria-hidden="true"></i> Tamamını aç · ${formatPrice(course.price_kurus)}</button>` : ''}
      </aside>
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// YAPISAL VERI
// ---------------------------------------------------------------------------

function breadcrumbLd(base, items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: item.url }))
  };
}

function catalogJsonLd({ base, courses }) {
  return [
    breadcrumbLd(base, [{ name: 'Ana Sayfa', url: `${base}/` }, { name: 'Eğitimler', url: `${base}${BASE_PATH}` }]),
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Sosyal Medya Eğitimleri',
      itemListElement: courses.map((course, i) => ({
        '@type': 'ListItem', position: i + 1, url: `${base}${courseUrl(course)}`, name: course.title
      }))
    }
  ];
}

function courseJsonLd({ base, course, lessons, description }) {
  const totalMinutes = lessons.reduce((sum, l) => sum + (Number(l.reading_minutes) || 1), 0);
  const url = `${base}${courseUrl(course)}`;
  return [
    breadcrumbLd(base, [
      { name: 'Ana Sayfa', url: `${base}/` },
      { name: 'Eğitimler', url: `${base}${BASE_PATH}` },
      { name: course.title, url }
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'Course',
      '@id': `${url}#course`,
      name: course.title,
      description: description || course.subtitle || course.title,
      url,
      inLanguage: 'tr-TR',
      provider: { '@id': `${base}/#organization` },
      image: course.cover_image_url ? (course.cover_image_url.startsWith('http') ? course.cover_image_url : `${base}${course.cover_image_url}`) : undefined,
      educationalLevel: course.level || undefined,
      numberOfLessons: lessons.length || undefined,
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

function lessonJsonLd({ base, course, lesson, description }) {
  const url = `${base}${lessonUrl(course, lesson)}`;
  return [
    breadcrumbLd(base, [
      { name: 'Ana Sayfa', url: `${base}/` },
      { name: 'Eğitimler', url: `${base}${BASE_PATH}` },
      { name: course.title, url: `${base}${courseUrl(course)}` },
      { name: lesson.title, url }
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: lesson.title,
      description: description || undefined,
      url,
      inLanguage: 'tr-TR',
      isPartOf: { '@id': `${base}${courseUrl(course)}#course` },
      publisher: { '@id': `${base}/#organization` },
      dateModified: String(lesson.updated_at || course.updated_at || '').slice(0, 10) || undefined
    }
  ];
}

module.exports = {
  BASE_PATH, LEVELS,
  esc, formatPrice, estimateMinutes, isFreeCourse, isLessonFree, isSafeImageUrl,
  normalizeCoursePayload, normalizeLessonPayload,
  listLessons, listPublishedCourses, loadCourse,
  courseUrl, lessonUrl,
  renderCatalogHtml, renderCourseHtml, renderLessonHtml,
  catalogJsonLd, courseJsonLd, lessonJsonLd
};
