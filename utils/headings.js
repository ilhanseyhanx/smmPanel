'use strict';

// Site tek sayfalik bir uygulama: butun gorunumler (ana sayfa, hizmetler,
// blog, sozlesmeler...) ayni HTML dosyasinda durur ve her birinin kendi <h1>
// basligi vardir. Kullanici tek seferde birini gorur ama arama motoru kaynagin
// tamamini okur ve "bu sayfada 14 tane h1 var" uyarisi verir.
//
// Cozum: sunucu sayfayi gonderirken YALNIZCA o adrese ait gorunumun h1'ini
// birakir, digerlerini h2'ye cevirir. Gorunum bloklari <section id="view-...">
// ile basladigi icin hangi h1'in kime ait oldugu kaynaktan cikarilabilir.

const VIEW_START = /<section id="(view-[a-z0-9-]+)"/g;

// Cevrilen basliklar gorunusunu korumali: style.css'te element secicili
// kurallar var (.legal-page h1 gibi). Bu sinif o kurallarin h2'ye de
// uygulanmasini saglar (style.css icinde ".was-h1" olarak tanimli).
const MARKER = 'was-h1';

function demoteHeadings(chunk) {
  return chunk
    .replace(/<h1(\s[^>]*)?>/gi, (match, attrs) => {
      const attributes = attrs || '';
      if (/\sclass\s*=\s*"/i.test(attributes)) {
        return `<h2${attributes.replace(/(\sclass\s*=\s*")/i, `$1${MARKER} `)}>`;
      }
      return `<h2 class="${MARKER}"${attributes}>`;
    })
    .replace(/<\/h1>/gi, '</h2>');
}

/**
 * Sayfada tek bir <h1> birakir.
 * @param {string} html  Gonderilecek HTML
 * @param {string} keepViewId  h1'i korunacak gorunum (or. 'view-blog-detail')
 */
function enforceSingleH1(html, keepViewId) {
  const source = String(html || '');
  const starts = [];
  VIEW_START.lastIndex = 0;
  let match;
  while ((match = VIEW_START.exec(source)) !== null) {
    starts.push({ id: match[1], index: match.index });
  }
  if (!starts.length) return source;

  const parts = [];
  // Gorunumlerden onceki kisim (head, navbar) her zaman h1'siz olmali.
  parts.push(demoteHeadings(source.slice(0, starts[0].index)));

  for (let i = 0; i < starts.length; i++) {
    const from = starts[i].index;
    const to = i + 1 < starts.length ? starts[i + 1].index : source.length;
    const chunk = source.slice(from, to);
    parts.push(starts[i].id === keepViewId ? chunk : demoteHeadings(chunk));
  }
  return parts.join('');
}

// Adres -> o adresin ana gorunumu. Tek kaynak utils/pageMeta.js: baslik,
// aciklama, canonical ve gorunum ayni tabloda durur ki yeni bir sayfa
// eklenirken biri guncellenip digeri unutulmasin.
//
// Tanimsiz adresler artik ana sayfaya DUSMEZ; 404 gorunumune gider (eskiden
// var olmayan her adres ana sayfayi 200 ile donduruyordu, "soft 404").
function viewForPath(pathname) {
  const { pageForPath } = require('./pageMeta');
  return pageForPath(pathname).view;
}

module.exports = { enforceSingleH1, viewForPath, demoteHeadings };
