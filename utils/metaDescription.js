'use strict';

// Arama motorlari meta aciklamayi 25-160 karakter arasinda bekler.
// 160'i asan aciklama sonuclarda kesilir; 25'in altindaki aciklama yok sayilip
// yerine sayfadan rastgele metin gosterilir. Bu yuzden sayfaya basilan
// aciklama, veritabaninda ne yazarsa yazsin bu araliga getirilir.

const MIN_LENGTH = 25;
const MAX_LENGTH = 160;
// Kesme siniri: sonuna eklenecek "…" ile birlikte 160'i asmamali.
const CUT_LENGTH = MAX_LENGTH - 1;

function stripHtml(value) {
  return String(value == null ? '' : value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Metni meta aciklama sinirlarina getirir.
 * @returns {string} 160 karakteri asmayan metin; kullanilamayacak kadar
 *   kisaysa bos string (cagiran taraf yedege duser).
 */
function clampMetaDescription(value) {
  const text = stripHtml(value);
  if (!text) return '';
  if (text.length <= MAX_LENGTH) return text.length >= MIN_LENGTH ? text : '';

  const kesilmis = text.slice(0, CUT_LENGTH);

  // Once tam cumlede bitirmeyi dene: yarim birakilan cumle ("...farki ve…")
  // arama sonucunda ve AI alintilarinda kotu gorunur. Son cumle sonu
  // noktalamasi yeterince ilerideyse metin orada, uc nokta olmadan biter.
  const sonCumleSonu = Math.max(kesilmis.lastIndexOf('. '), kesilmis.lastIndexOf('! '), kesilmis.lastIndexOf('? '),
    kesilmis.endsWith('.') || kesilmis.endsWith('!') || kesilmis.endsWith('?') ? kesilmis.length - 1 : -1);
  if (sonCumleSonu >= MIN_LENGTH) return kesilmis.slice(0, sonCumleSonu + 1);

  // Cumle sonu yoksa kelimenin ortasindan kesmemek icin son bosluktan geri sar.
  const sonBosluk = kesilmis.lastIndexOf(' ');
  // Bosluk cok geride kaldiysa (tek uzun kelime) sert kesmek zorundayiz.
  const govde = sonBosluk > MIN_LENGTH ? kesilmis.slice(0, sonBosluk) : kesilmis;
  // Sondaki noktalama "…" ile ust uste binmesin.
  return `${govde.replace(/[\s,;:.!?-]+$/, '')}…`;
}

/**
 * Adaylari sirayla dener, ilk uygun olani dondurur.
 * Hicbiri yetmezse adaylari birlestirip 25 karakter esigini asmaya calisir.
 * @param {string[]} candidates  Oncelik sirasiyla aday metinler
 * @param {string} [fallback]    Hepsi bosa cikarsa kullanilacak metin
 */
function buildMetaDescription(candidates, fallback = '') {
  const list = (Array.isArray(candidates) ? candidates : [candidates]).filter(Boolean);
  for (const candidate of list) {
    const clamped = clampMetaDescription(candidate);
    if (clamped) return clamped;
  }
  // Tek tek yetersiz kalan parcalari birlestirmeyi dene (or. kisa ozet + baslik).
  const birlesik = clampMetaDescription(list.map(stripHtml).filter(Boolean).join(' — '));
  if (birlesik) return birlesik;
  return clampMetaDescription(fallback);
}

module.exports = { clampMetaDescription, buildMetaDescription, stripHtml, MIN_LENGTH, MAX_LENGTH };
