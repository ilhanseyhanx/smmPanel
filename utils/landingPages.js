'use strict';

// SATIS SAYFALARI (platform bazli landing page'ler)
// /instagram-takipci-satin-al gibi kok adresli, iki dilli, admin panelden
// yonetilen satis sayfalari. Her sayfa secili kategorilerdeki servisleri
// otomatik listeler; sunucu tarafinda basilir (SEO) ve SPA icinde ayni
// isaretlemeyle hidrate edilir. Dogrulama, veri cekme, HTML uretimi ve
// yapisal veri tek dosyada durur ki admin ucu, SSR ve API ayni kurallari
// paylassin.

const { normalizePlainText, sanitizeRichText, isSafeHttpUrl } = require('./security');
const { buildMetaDescription, stripHtml } = require('./metaDescription');
const { SAYFALAR } = require('./pageMeta');

const PLATFORMS = {
  instagram: { label: 'Instagram', icon: 'fa-brands fa-instagram' },
  tiktok: { label: 'TikTok', icon: 'fa-brands fa-tiktok' },
  youtube: { label: 'YouTube', icon: 'fa-brands fa-youtube' },
  telegram: { label: 'Telegram', icon: 'fa-brands fa-telegram' },
  facebook: { label: 'Facebook', icon: 'fa-brands fa-facebook' },
  'x-twitter': { label: 'X (Twitter)', icon: 'fa-brands fa-x-twitter' },
  spotify: { label: 'Spotify', icon: 'fa-brands fa-spotify' },
  linkedin: { label: 'LinkedIn', icon: 'fa-brands fa-linkedin' },
  twitch: { label: 'Twitch', icon: 'fa-brands fa-twitch' },
  kick: { label: 'Kick', icon: 'fa-solid fa-bolt' },
  threads: { label: 'Threads', icon: 'fa-brands fa-threads' },
  'social-media': { label: 'Sosyal Medya', icon: 'fa-solid fa-layer-group' }
};

// Kok adresli slug'lar SPA rotalari ve sistem dosyalariyla cakismamali.
const RESERVED_SLUGS = new Set([
  ...Object.keys(SAYFALAR).filter(Boolean),
  'blog', 'api', 'admin', 'landing-page', 'not-found', 'unsubscribe', 'sitemap.xml', 'robots.txt',
  'llms.txt', 'llms-full.txt', 'bingsiteauth.xml', 'css', 'js', 'favicon.ico', 'favicon.svg',
  'og-image.png', 'site.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'
]);

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugify(text) {
  return String(text || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    .slice(0, 120);
}

function isValidSlug(slug) {
  const s = String(slug || '');
  return s.length >= 3 && s.length <= 120 && SLUG_RE.test(s) && !RESERVED_SLUGS.has(s);
}

/** Satir satir liste (adimlar, ozellikler). Dizi veya "her satir bir madde" metni kabul eder. */
function parseList(value, { max = 12, maxLength = 300 } = {}) {
  const items = Array.isArray(value) ? value : String(value || '').split(/\r?\n/);
  return items.map(v => normalizePlainText(v, maxLength)).filter(Boolean).slice(0, max);
}

/**
 * SSS: dizi [{q, a}] veya bos satirla ayrilmis bloklar (ilk satir soru,
 * kalani yanit) kabul edilir.
 */
function parseFaq(value, { max = 15 } = {}) {
  let items = [];
  if (Array.isArray(value)) {
    items = value.map(v => ({ q: v?.q ?? v?.question, a: v?.a ?? v?.answer }));
  } else {
    items = String(value || '').split(/\r?\n\s*\r?\n/).map(block => {
      const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      return { q: lines[0], a: lines.slice(1).join(' ') };
    });
  }
  return items
    .map(v => ({ q: normalizePlainText(v.q, 200), a: normalizePlainText(v.a, 900) }))
    .filter(v => v.q && v.a)
    .slice(0, max);
}

function parseIds(value, max = 30) {
  const raw = Array.isArray(value) ? value : String(value || '').split(/[,\s]+/);
  const ids = raw.map(v => parseInt(v, 10)).filter(n => Number.isInteger(n) && n > 0);
  return [...new Set(ids)].slice(0, max);
}

function parseSlugs(value, max = 8) {
  const raw = Array.isArray(value) ? value : String(value || '').split(/[,\s]+/);
  const slugs = raw.map(v => String(v || '').trim()).filter(v => v && /^[a-z0-9-]{3,160}$/.test(v));
  return [...new Set(slugs)].slice(0, max);
}

function parseJsonArray(text) {
  try { const v = JSON.parse(text || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}

/**
 * Admin ucundan gelen govdeyi veritabani alanlarina cevirir. Eksik alanlar
 * mevcut kayittan (duzenleme) alinir. Hata varsa {error} doner.
 */
function normalizePagePayload(body, current = null) {
  const b = body || {};
  const pick = (key, fallback = '') => (b[key] !== undefined ? b[key] : (current ? current[key] : fallback));
  const titleTr = normalizePlainText(pick('title_tr'), 160);
  const titleEn = normalizePlainText(pick('title_en') || titleTr, 160);
  if (!titleTr) return { error: 'Türkçe başlık gereklidir.' };

  const slug = b.slug !== undefined ? slugify(b.slug) || slugify(titleTr) : (current ? current.slug : slugify(titleTr));
  if (!isValidSlug(slug)) return { error: 'Adres (slug) geçersiz ya da sistem tarafından ayrılmış. Küçük harf, rakam ve tire kullanın.' };

  const platformKey = PLATFORMS[pick('platform_key', 'social-media')] ? pick('platform_key', 'social-media') : 'social-media';
  const categoryIds = parseIds(b.category_ids !== undefined ? b.category_ids : parseJsonArray(current?.category_ids));
  if (!categoryIds.length) return { error: 'En az bir servis kategorisi seçin.' };

  const contentTr = sanitizeRichText(pick('content_tr'));
  const contentEn = sanitizeRichText(pick('content_en') || pick('content_tr'));
  if (!stripHtml(contentTr)) return { error: 'Türkçe sayfa içeriği gereklidir.' };

  const requestedImage = String(pick('image_url') || '').trim();
  const imageUrl = isSafeHttpUrl(requestedImage) || /^\/api\/blog\/cover\/[a-z-]+\/\d+\.svg(\?v=\d+)?$/.test(requestedImage) ? requestedImage : '';

  const stepsTr = parseList(b.steps_tr !== undefined ? b.steps_tr : parseJsonArray(current?.steps_tr));
  const stepsEn = parseList(b.steps_en !== undefined ? b.steps_en : parseJsonArray(current?.steps_en));
  const faqTr = parseFaq(b.faq_tr !== undefined ? b.faq_tr : parseJsonArray(current?.faq_tr));
  const faqEn = parseFaq(b.faq_en !== undefined ? b.faq_en : parseJsonArray(current?.faq_en));
  const related = parseSlugs(b.related_blog_slugs !== undefined ? b.related_blog_slugs : parseJsonArray(current?.related_blog_slugs));

  return {
    fields: {
      slug,
      status: pick('status', 'draft') === 'published' ? 'published' : 'draft',
      platform_key: platformKey,
      category_ids: JSON.stringify(categoryIds),
      image_url: imageUrl,
      title_tr: titleTr,
      title_en: titleEn,
      subtitle_tr: normalizePlainText(pick('subtitle_tr'), 300),
      subtitle_en: normalizePlainText(pick('subtitle_en'), 300),
      seo_title_tr: normalizePlainText(pick('seo_title_tr') || titleTr, 160),
      seo_title_en: normalizePlainText(pick('seo_title_en') || titleEn, 160),
      seo_description_tr: buildMetaDescription([pick('seo_description_tr'), pick('subtitle_tr'), contentTr], titleTr),
      seo_description_en: buildMetaDescription([pick('seo_description_en'), pick('subtitle_en'), contentEn], titleEn),
      content_tr: contentTr,
      content_en: contentEn,
      steps_tr: JSON.stringify(stepsTr),
      steps_en: JSON.stringify(stepsEn.length ? stepsEn : stepsTr),
      faq_tr: JSON.stringify(faqTr),
      faq_en: JSON.stringify(faqEn.length ? faqEn : faqTr),
      cta_text_tr: normalizePlainText(pick('cta_text_tr'), 80),
      cta_text_en: normalizePlainText(pick('cta_text_en'), 80),
      related_blog_slugs: JSON.stringify(related),
      sort_order: Math.max(0, Math.min(999, parseInt(pick('sort_order', 0), 10) || 0))
    }
  };
}

/** Veritabani satirini secilen dile gore duzlestirir. */
function localizePage(row, lang = 'tr') {
  const L = key => (lang === 'en' ? (row[`${key}_en`] || row[`${key}_tr`]) : (row[`${key}_tr`] || row[`${key}_en`])) || '';
  const platform = PLATFORMS[row.platform_key] || PLATFORMS['social-media'];
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    platform_key: row.platform_key,
    platform_label: platform.label,
    platform_icon: platform.icon,
    category_ids: parseIds(parseJsonArray(row.category_ids)),
    image_url: row.image_url || '',
    title: L('title'),
    subtitle: L('subtitle'),
    seo_title: L('seo_title') || L('title'),
    seo_description: L('seo_description') || L('subtitle'),
    content: L('content'),
    steps: parseJsonArray(lang === 'en' ? (row.steps_en || row.steps_tr) : (row.steps_tr || row.steps_en)),
    faq: parseJsonArray(lang === 'en' ? (row.faq_en || row.faq_tr) : (row.faq_tr || row.faq_en)),
    cta_text: L('cta_text'),
    related_blog_slugs: parseSlugs(parseJsonArray(row.related_blog_slugs)),
    views: row.views || 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
    published_at: row.published_at
  };
}

/**
 * Sayfayi, servislerini ve ilgili blog yazilarini yukler.
 * @returns {Promise<null|{page, services, posts}>}
 */
async function fetchPage(dbAsync, slug, { lang = 'tr', includeDraft = false } = {}) {
  if (!SLUG_RE.test(String(slug || ''))) return null;
  const row = await dbAsync.get(
    `SELECT * FROM landing_pages WHERE slug = ?${includeDraft ? '' : " AND status = 'published'"}`, [slug]);
  if (!row) return null;
  const page = localizePage(row, lang);
  const nameCol = lang === 'en' ? 'COALESCE(s.name_en, s.name_tr, s.name)' : 'COALESCE(s.name_tr, s.name)';
  const catCol = lang === 'en' ? 'COALESCE(c.name_en, c.name_tr, c.name)' : 'COALESCE(c.name_tr, c.name)';
  const services = page.category_ids.length
    ? await dbAsync.all(`SELECT s.id, s.category_id, ${nameCol} name, s.rate_per_1000, s.rate_per_1000_usd_cents,
        s.min_quantity, s.max_quantity, s.refill, ${catCol} category_name
      FROM services s JOIN categories c ON s.category_id = c.id
      WHERE s.status = 1 AND s.category_id IN (${page.category_ids.map(() => '?').join(',')})
      ORDER BY c.sort_order ASC, s.rate_per_1000 ASC, s.id ASC`, page.category_ids)
    : [];
  const posts = page.related_blog_slugs.length
    ? await dbAsync.all(`SELECT slug, image_url,
        COALESCE(title_${lang === 'en' ? 'en' : 'tr'}, title_tr, title) title,
        COALESCE(summary_${lang === 'en' ? 'en' : 'tr'}, summary_tr, summary) summary
      FROM blog_posts WHERE status = 'published' AND slug IN (${page.related_blog_slugs.map(() => '?').join(',')})`, page.related_blog_slugs)
    : [];
  return { page, services, posts };
}

/** Yayindaki sayfalarin kisa listesi (menu, sitemap, llms.txt). */
async function listPublished(dbAsync, lang = 'tr') {
  const rows = await dbAsync.all(`SELECT id, slug, platform_key, title_tr, title_en, subtitle_tr, subtitle_en, updated_at, published_at, created_at
    FROM landing_pages WHERE status = 'published' ORDER BY sort_order ASC, id ASC LIMIT 100`).catch(() => []);
  return rows.map(r => ({
    slug: r.slug,
    platform_key: r.platform_key,
    platform_icon: (PLATFORMS[r.platform_key] || PLATFORMS['social-media']).icon,
    title: (lang === 'en' ? (r.title_en || r.title_tr) : (r.title_tr || r.title_en)) || '',
    subtitle: (lang === 'en' ? (r.subtitle_en || r.subtitle_tr) : (r.subtitle_tr || r.subtitle_en)) || '',
    lastmod: (r.updated_at || r.published_at || r.created_at || '').slice(0, 10)
  }));
}

function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const T = {
  tr: {
    home: 'Ana Sayfa', servicesTitle: 'Hizmetler ve Fiyat Listesi', from: '1000 adet', fromSuffix: 'den başlayan fiyatlar',
    machineCap: 'SİPARİŞ MAKİNESİ', ready: 'HAZIR', category: 'KATEGORİ', service: 'HİZMET', qty: 'MİKTAR', limit: 'Limit',
    estimate: 'TAHMİNİ FİYAT', order: 'SİPARİŞ VER', colId: 'ID', colName: 'Servis Adı', colPrice: '1000 Adet Fiyatı',
    colLimits: 'Min / Max', colGuarantee: 'Garanti', colAction: 'İşlem', guaranteed: 'Garantili', standard: 'Standart',
    orderNow: 'Sipariş Ver', howTo: 'Nasıl Satın Alınır?', faq: 'Sık Sorulan Sorular', related: 'İlgili Rehberler',
    readMore: 'Yazıyı Oku', cta: 'Ücretsiz Hesap Oluştur', trust: ['⚡ Anında başlangıç', '🔒 Şifre istenmez', '💳 Güvenli ödeme', '🎧 7/24 destek'],
    noService: 'Bu sayfaya bağlı aktif servis bulunmuyor; tüm hizmetler için hizmet listesine bakın.'
  },
  en: {
    home: 'Home', servicesTitle: 'Services & Price List', from: 'Prices from', fromSuffix: 'per 1000',
    machineCap: 'ORDER MACHINE', ready: 'READY', category: 'CATEGORY', service: 'SERVICE', qty: 'QUANTITY', limit: 'Limit',
    estimate: 'ESTIMATED PRICE', order: 'ORDER NOW', colId: 'ID', colName: 'Service', colPrice: 'Price per 1000',
    colLimits: 'Min / Max', colGuarantee: 'Guarantee', colAction: 'Action', guaranteed: 'Guaranteed', standard: 'Standard',
    orderNow: 'Order Now', howTo: 'How to Buy', faq: 'Frequently Asked Questions', related: 'Related Guides',
    readMore: 'Read Article', cta: 'Create a Free Account', trust: ['⚡ Instant start', '🔒 No password needed', '💳 Secure payment', '🎧 24/7 support'],
    noService: 'No active service is linked to this page yet; see the full service list.'
  }
};

function isGuaranteed(s) {
  return s.refill == 1 || /telafi|garanti|refill|düşüşsüz|non-drop|30 gün|60 gün|90 gün|365 gün|days refill|yenileme/i.test(`${s.name} ${s.category_name}`);
}

function priceText(s, lang) {
  const usd = Number(s.rate_per_1000_usd_cents || 0) / 100;
  const tl = Number(s.rate_per_1000 || 0);
  return lang === 'en' && usd > 0 ? `$${usd.toFixed(2)} / ₺${tl.toFixed(2)}` : `₺${tl.toFixed(2)}`;
}

/**
 * Sayfanin ic isaretlemesi (#landing-page-root icine basilir). Hem SSR hem
 * API ayni fonksiyonu kullanir; app.js yalnizca makine ve tablo satirlarini
 * canli veriyle yeniden cizer.
 */
function renderLandingPageHtml({ page, services, posts, lang = 'tr' }) {
  const t = T[lang === 'en' ? 'en' : 'tr'];
  const minRate = services.reduce((min, s) => (Number(s.rate_per_1000) > 0 && (min === null || Number(s.rate_per_1000) < min) ? Number(s.rate_per_1000) : min), null);
  const categories = [];
  for (const s of services) {
    if (!categories.some(c => c.id === s.category_id)) categories.push({ id: s.category_id, name: s.category_name });
  }
  const firstCat = categories[0];

  const machine = `
    <div class="order-machine lp-machine" id="lp-machine" aria-label="${esc(t.order)}">
      <div class="machine-cap"><span>${t.machineCap}</span><small><i></i> ${t.ready}</small></div>
      <div class="machine-body">
        <label for="lp-machine-category">${t.category}</label>
        <div class="machine-field">
          <i class="${esc(page.platform_icon)}" id="lp-machine-icon" aria-hidden="true"></i>
          <select id="lp-machine-category" aria-label="${t.category}" onchange="app.onLpCategoryChange()">${categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
        </div>
        <label for="lp-machine-service">${t.service}</label>
        <div class="machine-field">
          <select id="lp-machine-service" aria-label="${t.service}" onchange="app.onLpServiceChange()">${services.filter(s => !firstCat || s.category_id === firstCat.id).map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>
        </div>
        <label for="lp-machine-qty">${t.qty}</label>
        <div class="machine-counter">
          <button type="button" aria-label="-" onclick="app.stepLpQty(-1)">−</button>
          <input id="lp-machine-qty" type="number" inputmode="numeric" value="1000" aria-label="${t.qty}" oninput="app.updateLpPrice()" onchange="app.commitLpQty()">
          <button type="button" aria-label="+" onclick="app.stepLpQty(1)">+</button>
        </div>
        <div class="machine-limits"><span id="lp-machine-limits"></span></div>
        <div class="machine-total"><small>${t.estimate}</small><strong id="lp-machine-price">₺0,00</strong></div>
        <button type="button" class="machine-submit" onclick="app.submitLpOrder()">${t.order} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>
      </div>
      <div class="machine-shadow"></div>
    </div>`;

  const rows = services.length ? services.map(s => `<tr>
      <td class="cell-nowrap">#${Number(s.id)}</td>
      <td class="cell-service-title" title="${esc(s.name)}"><span class="service-name-clamp">${esc(s.name)}</span></td>
      <td class="cell-nowrap price-cell">${esc(priceText(s, lang))}</td>
      <td class="cell-nowrap">${Number(s.min_quantity) || 0} - ${Number(s.max_quantity) || 0}</td>
      <td class="cell-nowrap">${isGuaranteed(s) ? `<span class="badge badge-completed"><i class="fa-solid fa-shield-check"></i> ${t.guaranteed}</span>` : `<span class="badge badge-pending">${t.standard}</span>`}</td>
      <td class="cell-nowrap" style="text-align:right;"><button type="button" class="btn btn-primary btn-sm" onclick="app.selectServiceForOrder(${Number(s.id)})">${t.orderNow}</button></td>
    </tr>`).join('')
    : `<tr><td colspan="6" class="text-center">${t.noService} <a href="/services" onclick="app.navigate('services');return false;">${t.servicesTitle}</a></td></tr>`;

  const steps = page.steps.length ? `
    <section class="lp-section glass-card lp-steps">
      <h2>${t.howTo}</h2>
      <ol class="lp-steps-list">${page.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      <a class="btn btn-primary lp-cta" id="lp-cta" href="/register" onclick="app.lpCta();return false;">${esc(page.cta_text || t.cta)} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
    </section>` : '';

  const faq = page.faq.length ? `
    <section class="lp-section glass-card lp-faq">
      <h2>${t.faq}</h2>
      ${page.faq.map(f => `<details class="lp-faq-item"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}
    </section>` : '';

  const related = posts.length ? `
    <section class="lp-section lp-related">
      <h2>${t.related}</h2>
      <div class="blog-cards-grid">${posts.map(p => `<a class="blog-card glass-card blog-card-ssr" href="/blog/${encodeURIComponent(p.slug)}"><h3>${esc(p.title)}</h3><p>${esc(String(p.summary || '').slice(0, 180))}</p><span class="lp-read-more">${t.readMore} →</span></a>`).join('')}</div>
    </section>` : '';

  return `
    <nav class="lp-breadcrumb" aria-label="breadcrumb"><a href="/" onclick="app.navigate('landing');return false;">${t.home}</a> <span aria-hidden="true">›</span> <a href="/services" onclick="app.navigate('services');return false;">${t.servicesTitle}</a> <span aria-hidden="true">›</span> <span>${esc(page.title)}</span></nav>
    <header class="lp-hero">
      <div class="lp-hero-text">
        <span class="lp-platform-badge"><i class="${esc(page.platform_icon)}" aria-hidden="true"></i> ${esc(page.platform_label)}</span>
        <h1 id="lp-title">${esc(page.title)}</h1>
        ${page.subtitle ? `<p class="lp-subtitle">${esc(page.subtitle)}</p>` : ''}
        <ul class="lp-trust">${t.trust.map(x => `<li>${x}</li>`).join('')}</ul>
        ${minRate !== null ? `<div class="lp-price-from">${t.from} <strong>₺${minRate.toFixed(2)}</strong>${lang === 'en' ? ` ${t.fromSuffix}` : `'${t.fromSuffix}`}</div>` : ''}
      </div>
      ${machine}
    </header>
    <section class="lp-section glass-card lp-services">
      <h2>${t.servicesTitle}</h2>
      <div class="table-responsive">
        <table class="custom-table table-fit-screen" id="lp-services-table">
          <thead><tr><th scope="col" style="width:70px;">${t.colId}</th><th scope="col">${t.colName}</th><th scope="col" style="width:150px;">${t.colPrice}</th><th scope="col" style="width:140px;">${t.colLimits}</th><th scope="col" style="width:120px;">${t.colGuarantee}</th><th scope="col" style="width:140px;text-align:right;">${t.colAction}</th></tr></thead>
          <tbody id="lp-services-tbody">${rows}</tbody>
        </table>
      </div>
    </section>
    <article class="lp-section glass-card lp-content" id="lp-content">${page.content}</article>
    ${steps}
    ${faq}
    ${related}`;
}

/** Service + OfferCatalog, FAQPage ve BreadcrumbList semalari. */
function buildLandingJsonLd({ page, services, base, siteName = 'Jet SMM Panel', lang = 'tr' }) {
  const url = `${base}/${page.slug}`;
  const out = [];
  out.push({
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${url}#service`,
    name: page.title,
    description: page.seo_description || page.subtitle || undefined,
    serviceType: 'Social Media Marketing',
    provider: { '@id': `${base}/#organization` },
    areaServed: 'TR',
    url,
    inLanguage: lang === 'en' ? 'en' : 'tr-TR',
    ...(services.length ? {
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: page.title,
        itemListElement: services.slice(0, 30).map(s => ({
          '@type': 'Offer',
          itemOffered: { '@type': 'Service', name: s.name },
          url: `${base}/services?service=${s.id}`,
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: Number(s.rate_per_1000 || 0).toFixed(2),
            priceCurrency: 'TRY',
            referenceQuantity: { '@type': 'QuantitativeValue', value: 1000 }
          },
          availability: 'https://schema.org/InStock'
        }))
      }
    } : {})
  });
  if (page.faq.length) {
    out.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: page.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
    });
  }
  out.push({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: lang === 'en' ? 'Home' : 'Ana Sayfa', item: `${base}/` },
      { '@type': 'ListItem', position: 2, name: lang === 'en' ? 'Services' : 'Hizmetler', item: `${base}/services` },
      { '@type': 'ListItem', position: 3, name: page.title, item: url }
    ]
  });
  void siteName;
  return out;
}

/**
 * Satis sayfasi baglanti listeleri (SSR).
 *  - footer: alt bilgi metin baglantilari
 *  - aside : blog listesinin sag sutunu (baslik + dugme listesi)
 */
function landingLinksHtml(pages, { variant = 'footer' } = {}) {
  if (!pages.length) return '';
  const link = (p, cls) => `<a href="/${esc(p.slug)}"${cls ? ` class="${cls}"` : ''} onclick="app.openLandingPage('${esc(p.slug)}');return false;">`
    + (cls ? `<i class="${esc(p.platform_icon)}" aria-hidden="true"></i> ` : '') + `${esc(p.title)}</a>`;
  if (variant === 'aside') {
    return `<h2 class="blog-aside-title">🛒 Hizmet Sayfaları</h2>`
      + `<p class="blog-aside-lead">Takipçi, beğeni ve izlenme paketlerine platforma göre ulaşın.</p>`
      + `<div class="blog-aside-links">${pages.map(p => link(p, 'blog-aside-btn')).join('')}</div>`;
  }
  return pages.map(p => link(p)).join('');
}

/**
 * Yazi icindeki servis ID'li linkleri (/services?service=ID veya #services?service=ID)
 * servisin kategorisine bagli satis sayfasina cevirir; eslesen sayfa yoksa
 * /services'e duser. Servisler silinip yeniden eklendiginde blog linkleri
 * kirilmasin diye: satis sayfasi adresi kalicidir, servisleri kendi listeler.
 * Servis bulunamazsa (silinmis) de /services'e duser.
 */
async function rewriteServiceLinks(html, dbAsync) {
  const source = String(html || '');
  const re = /href="(?:\/|#)services\?service=(\d+)"/g;
  const ids = [...new Set([...source.matchAll(re)].map(m => Number(m[1])))];
  if (!ids.length) return source;
  const services = await dbAsync.all(`SELECT id, category_id FROM services WHERE id IN (${ids.map(() => '?').join(',')})`, ids).catch(() => []);
  const pages = await dbAsync.all("SELECT slug, status, category_ids FROM landing_pages ORDER BY CASE status WHEN 'published' THEN 0 ELSE 1 END, sort_order ASC").catch(() => []);
  const pageOfCategory = new Map();
  for (const p of pages) {
    for (const cid of parseIds(parseJsonArray(p.category_ids))) {
      if (!pageOfCategory.has(cid)) pageOfCategory.set(cid, p.slug);
    }
  }
  const target = new Map();
  for (const id of ids) {
    const s = services.find(x => x.id === id);
    const slug = s ? pageOfCategory.get(Number(s.category_id)) : null;
    target.set(id, slug ? `/${slug}` : '/services');
  }
  return source.replace(re, (m, id) => `href="${target.get(Number(id))}"`);
}

module.exports = {
  rewriteServiceLinks,
  PLATFORMS, RESERVED_SLUGS, SLUG_RE, slugify, isValidSlug, parseList, parseFaq, parseIds, parseSlugs, parseJsonArray,
  normalizePagePayload, localizePage, fetchPage, listPublished, renderLandingPageHtml, buildLandingJsonLd, landingLinksHtml
};
