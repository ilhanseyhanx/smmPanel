'use strict';

// DIJITAL URUNLER — katalog sorgusu, dil secimi ve sunucuda basilan sayfa.
// Sayfa (/dijital-urunler) server.js'teki SPA isleyicisinde bu HTML ile
// doldurulur (botlar JS beklemeden urunleri gorur); public/js/digital.js
// acilinca ayni isaretlemeyi canli veriyle (ve secili dille) yeniden cizer.
// Kart sablonu iki tarafta ayni tutulmali.

const { fromKurus } = require('./money');

const T = {
  tr: {
    kicker: 'Anında teslimat',
    title: 'Dijital Ürünler',
    intro: 'Hazır hesaplar ve dijital ürünler: ödemeni bakiyenden yap, bilgiler saniyeler içinde hesabına teslim edilsin. Teslim edilen bilgiler yalnızca sana görünür.',
    tabs: { products: 'Ürünler', orders: 'Siparişlerim', checker: 'Gmail Checker' },
    all: 'Tümü',
    search: 'Ürün ara…',
    stock: n => `Stok: ${n}`,
    soldOut: 'Tükendi',
    perItem: '/ adet',
    buy: 'Satın Al',
    warranty: h => `${h} saat garanti`,
    emptyTitle: 'Ürünler hazırlanıyor',
    emptyText: 'Bu bölüme yakında yeni ürünler eklenecek. Sonra tekrar uğra.',
    stats: { label: 'Mağaza istatistikleri', sold: 'Satılan ürün', users: 'Kayıtlı kullanıcı', products: 'Dijital ürün çeşidi', stock: 'Stoktaki ürün' }
  },
  en: {
    kicker: 'Instant delivery',
    title: 'Digital Products',
    intro: 'Ready-made accounts and digital products: pay from your balance and the details are delivered to your account within seconds. Delivered details are visible only to you.',
    tabs: { products: 'Products', orders: 'My Orders', checker: 'Gmail Checker' },
    all: 'All',
    search: 'Search products…',
    stock: n => `Stock: ${n}`,
    soldOut: 'Sold out',
    perItem: '/ item',
    buy: 'Buy',
    warranty: h => `${h}h warranty`,
    emptyTitle: 'Products coming soon',
    emptyText: 'New products will be added to this section soon. Check back later.',
    stats: { label: 'Store statistics', sold: 'Products sold', users: 'Registered users', products: 'Digital products', stock: 'Items in stock' }
  }
};

/**
 * Sayfadaki istatistik kutusu. Satilan urun = teslim edilmis siparislerin
 * adet toplami (iade edilenler sayilmaz); kullanici = yonetici disindaki
 * kayitli hesaplar; urun cesidi ve stok yalnizca satistaki urunlerden.
 */
async function storeStats(db) {
  const [sold, users, products] = await Promise.all([
    db.get("SELECT COALESCE(SUM(quantity), 0) n FROM digital_orders WHERE status = 'completed'"),
    db.get("SELECT COUNT(*) n FROM users WHERE role != 'admin' AND COALESCE(banned, 0) = 0"),
    db.get(`SELECT COUNT(*) n, COALESCE(SUM(CASE WHEN d.stock > 0 THEN d.stock ELSE 0 END), 0) stock
              FROM digital_products d JOIN digital_providers p ON p.id = d.provider_id
             WHERE d.status = 1 AND p.status = 1`)
  ]);
  return {
    sold: Number(sold?.n || 0),
    users: Number(users?.n || 0),
    products: Number(products?.n || 0),
    stock: Number(products?.stock || 0)
  };
}

// Degeri 0 olan kutu gosterilmez: yeni magazada "0 satis" yazisi guven
// vermez; ilk satistan sonra kutu kendiliginden belirir.
const STAT_ITEMS = [
  ['sold', 'fa-bag-shopping', 'is-yellow'],
  ['users', 'fa-users', 'is-blue'],
  ['products', 'fa-layer-group', 'is-red'],
  ['stock', 'fa-boxes-stacked', 'is-green']
];

function statsHtml(stats, lang) {
  if (!stats) return '';
  const t = T[normLang(lang)];
  const items = STAT_ITEMS.filter(([key]) => Number(stats[key]) > 0).map(([key, icon, cls]) =>
    `<li class="${cls}"><i class="fa-solid ${icon}" aria-hidden="true"></i><strong>${esc(Number(stats[key]).toLocaleString('tr-TR'))}</strong><span>${esc(t.stats[key])}</span></li>`);
  return items.length ? `<ul class="dg-stats" aria-label="${esc(t.stats.label)}">${items.join('')}</ul>` : '';
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

function fold(value) {
  return String(value || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').toLowerCase();
}

function normLang(lang) {
  return lang === 'en' ? 'en' : 'tr';
}

/** Satista olan urunler (aktif saglayicida). */
async function listActiveProducts(db) {
  return db.all(`
    SELECT d.* FROM digital_products d
      JOIN digital_providers p ON p.id = d.provider_id
     WHERE d.status = 1 AND p.status = 1
     ORDER BY d.sort_order ASC, COALESCE(d.category, '') ASC, d.price_kurus ASC, d.id ASC`);
}

function localizeProduct(row, lang = 'tr') {
  const en = normLang(lang) === 'en';
  const pick = (trValue, enValue) => (en && String(enValue || '').trim() ? enValue : trValue) || '';
  return {
    id: row.id,
    name: pick(row.name, row.name_en),
    category: pick(row.category, row.category_en),
    description: pick(row.description, row.description_en),
    price: fromKurus(row.price_kurus),
    stock: row.stock === null || row.stock === undefined ? null : Number(row.stock),
    min: row.min_quantity,
    max: row.max_quantity,
    format: row.item_format || '',
    delivery_time: row.delivery_time || '',
    warranty_hours: Number(row.warranty_hours || 0),
    image: row.image_url || null
  };
}

function formatPrice(value) {
  const n = Number(value || 0);
  return `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function cardHtml(product, lang) {
  const t = T[normLang(lang)];
  const soldOut = product.stock !== null && product.stock <= 0;
  const meta = [
    product.delivery_time ? `<li><i class="fa-solid fa-bolt" aria-hidden="true"></i> ${esc(product.delivery_time)}</li>` : '',
    product.warranty_hours > 0 ? `<li><i class="fa-solid fa-shield-halved" aria-hidden="true"></i> ${esc(t.warranty(product.warranty_hours))}</li>` : '',
    product.format ? `<li><i class="fa-solid fa-key" aria-hidden="true"></i> ${esc(product.format)}</li>` : ''
  ].filter(Boolean).join('');
  const stock = product.stock === null ? ''
    : `<span class="dg-stock ${soldOut ? 'is-out' : 'is-in'}">${esc(soldOut ? t.soldOut : t.stock(product.stock.toLocaleString('tr-TR')))}</span>`;
  // Gorsel secilmemis urunde notr bir zemin + simge gosterilir.
  const media = product.image
    ? `<img src="${esc(product.image)}" alt="${esc(product.name)}" loading="lazy" decoding="async" width="800" height="500">`
    : '<i class="fa-solid fa-bag-shopping" aria-hidden="true"></i>';
  return `<article class="dg-card glass-card${soldOut ? ' is-sold-out' : ''}" data-dg-id="${Number(product.id)}" data-dg-cat="${esc(fold(product.category))}" data-dg-search="${esc(fold(`${product.name} ${product.category}`))}" data-track-pid="${Number(product.id)}" data-track-ctx="${esc(product.name.slice(0, 80))}">
      <div class="dg-card-media${product.image ? '' : ' is-empty'}">${media}${product.category ? `<span class="dg-cat">${esc(product.category)}</span>` : ''}${stock}</div>
      <div class="dg-card-body">
        <h2 class="dg-card-title">${esc(product.name)}</h2>
        ${product.description ? `<p class="dg-card-desc">${esc(product.description)}</p>` : ''}
        ${meta ? `<ul class="dg-card-meta">${meta}</ul>` : ''}
        <div class="dg-card-foot">
          <div class="dg-price-box"><strong class="dg-price">${esc(formatPrice(product.price))}</strong><small>${esc(t.perItem)}</small></div>
          <button type="button" class="dg-buy-btn" data-dg-buy="${Number(product.id)}"${soldOut ? ' disabled' : ''}><span>${esc(soldOut ? t.soldOut : t.buy)}</span>${soldOut ? '' : ' <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>'}</button>
        </div>
      </div>
    </article>`;
}

function chipsHtml(products, lang) {
  const t = T[normLang(lang)];
  const seen = new Map();
  for (const p of products) {
    if (p.category && !seen.has(fold(p.category))) seen.set(fold(p.category), p.category);
  }
  if (seen.size < 2) return '';
  return [`<button type="button" class="dg-chip active" data-dg-cat="">${esc(t.all)}</button>`,
    ...[...seen].map(([key, label]) => `<button type="button" class="dg-chip" data-dg-cat="${esc(key)}">${esc(label)}</button>`)].join('');
}

/** /dijital-urunler sayfasinin tamami (sekmeler + urun izgarasi). */
function renderCatalogHtml(rows, { lang = 'tr', checkerEnabled = false, stats = null } = {}) {
  const t = T[normLang(lang)];
  const products = rows.map(row => localizeProduct(row, lang));
  const grid = products.length
    ? products.map(p => cardHtml(p, lang)).join('\n')
    : `<div class="glass-card dg-empty"><i class="fa-solid fa-box-open" aria-hidden="true"></i><h2>${esc(t.emptyTitle)}</h2><p>${esc(t.emptyText)}</p></div>`;
  return `<div class="dg-wrap" data-lang="${normLang(lang)}">
    <header class="dg-head">
      <span class="dg-kicker"><i class="fa-solid fa-bolt" aria-hidden="true"></i> ${esc(t.kicker)}</span>
      <h1>${esc(t.title)}</h1>
      <p>${esc(t.intro)}</p>
    </header>
    ${statsHtml(stats, lang)}
    <div class="dg-tabs" role="tablist">
      <button type="button" class="dg-tab active" role="tab" aria-selected="true" data-dg-tab="products"><i class="fa-solid fa-store" aria-hidden="true"></i> ${esc(t.tabs.products)}</button>
      <button type="button" class="dg-tab" role="tab" aria-selected="false" data-dg-tab="orders"><i class="fa-solid fa-receipt" aria-hidden="true"></i> ${esc(t.tabs.orders)}</button>
      <button type="button" class="dg-tab" role="tab" aria-selected="false" data-dg-tab="checker"${checkerEnabled ? '' : ' hidden'}><i class="fa-solid fa-envelope-circle-check" aria-hidden="true"></i> ${esc(t.tabs.checker)}</button>
    </div>
    <section class="dg-panel" data-dg-panel="products">
      <div class="dg-toolbar">
        <input type="search" class="form-control dg-search" id="dg-search" placeholder="${esc(t.search)}" aria-label="${esc(t.search)}">
        <div class="dg-chips" id="dg-chips">${chipsHtml(products, lang)}</div>
      </div>
      <div class="dg-grid" id="dg-grid">${grid}</div>
    </section>
    <section class="dg-panel" data-dg-panel="orders" hidden></section>
    <section class="dg-panel" data-dg-panel="checker" hidden></section>
  </div>`;
}

module.exports = { T, esc, fold, listActiveProducts, localizeProduct, storeStats, statsHtml, renderCatalogHtml };
