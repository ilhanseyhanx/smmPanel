'use strict';

// Bayi sitesi temalari (F4). Tek vitrin kodu + 3 yerlesim iskeleti:
//   klasik  ust menu, solda giris metni + sagda giris karti
//   tablo   genis ekranda soldaki menu, yogun tablolar
//   vitrin  ortalanmis buyuk giris bandi, buyuk kartlar
// Tema = iskelet + renk/yazi/kose ayarlari (tenant/public/assets/themes.css).
// Bayinin sectigi ana renk temanin vurgu rengini ezer.
const THEMES = {
  classic: { bg: '#f6f7fb', name: 'Klasik', layout: 'klasik', accent: '#6366f1', font: 'Plus Jakarta Sans', weights: '400;500;600;700;800', note: 'Açık, sade; varsayılan' },
  dark: { bg: '#0b1020', name: 'Gece', layout: 'klasik', accent: '#22d3ee', font: 'Plus Jakarta Sans', weights: '400;500;600;700;800', note: 'Koyu zemin, camgöbeği vurgu' },
  pastel: { bg: '#fdf6f9', name: 'Pastel', layout: 'klasik', accent: '#ec4899', font: 'Nunito', weights: '400;500;600;700;800', note: 'Yumuşak tonlar, yuvarlak köşeler' },
  retro: { bg: '#f3ead7', name: 'Retro', layout: 'klasik', accent: '#e4572e', font: 'Bricolage Grotesque', weights: '400;500;600;700;800', note: 'Kalın kenarlar, sert gölgeler' },
  minimal: { bg: '#fafafa', name: 'Sade', layout: 'tablo', accent: '#18181b', font: 'Inter', weights: '400;500;600;700;800', note: 'Yan menü, gri tonlar, yoğun liste' },
  corporate: { bg: '#f3f6fb', name: 'Kurumsal', layout: 'tablo', accent: '#1d4ed8', font: 'IBM Plex Sans', weights: '400;500;600;700', note: 'Lacivert yan menü, ciddi görünüm' },
  neon: { bg: '#07070c', name: 'Neon', layout: 'tablo', accent: '#a3e635', font: 'Sora', weights: '400;500;600;700;800', note: 'Koyu zemin, parlak yeşil vurgu' },
  gradient: { bg: '#f7f5ff', name: 'Gradyan', layout: 'vitrin', accent: '#7c3aed', font: 'Manrope', weights: '400;500;600;700;800', note: 'Renk geçişli büyük giriş bandı' },
  glass: { bg: '#0a1224', name: 'Cam', layout: 'vitrin', accent: '#38bdf8', font: 'Outfit', weights: '400;500;600;700;800', note: 'Koyu zemin, buzlu cam kartlar' },
  bold: { bg: '#ffffff', name: 'Cesur', layout: 'vitrin', accent: '#f43f5e', font: 'Archivo', weights: '400;500;600;700;800', display: 'Archivo Black', note: 'Dev yazılar, keskin köşeler' }
};

const LAYOUT_NAMES = { klasik: 'Klasik', tablo: 'Tablo', vitrin: 'Vitrin' };
const THEME_KEYS = Object.keys(THEMES);

function themeOf(key) {
  return THEMES[key] ? { key, ...THEMES[key] } : { key: 'classic', ...THEMES.classic };
}

// Google Fonts adresi: yalnizca temanin kullandigi aileler yuklenir.
function fontHref(theme) {
  const family = name => name.replace(/ /g, '+');
  const parts = [`family=${family(theme.font)}:wght@${theme.weights}`];
  if (theme.display) parts.push(`family=${family(theme.display)}`);
  return `https://fonts.googleapis.com/css2?${parts.join('&')}&display=swap`;
}

function publicThemes() {
  return THEME_KEYS.map(key => ({
    key, name: THEMES[key].name, layout: THEMES[key].layout, layout_name: LAYOUT_NAMES[THEMES[key].layout],
    accent: THEMES[key].accent, bg: THEMES[key].bg, note: THEMES[key].note
  }));
}

module.exports = { THEMES, THEME_KEYS, LAYOUT_NAMES, themeOf, fontHref, publicThemes };
