'use strict';

// Servis adindan / kategorisinden "garantili mi" tahmini.
//
// Yalnizca ilk ekleme aninda (admin secim yapmadiysa) ve saglayici katalogunu
// listelerken kullanilir. Kayitli servislerde TEK GERCEK KAYNAK services.refill
// sutunudur: admin "Standart" secince vitrin artik ada bakip "Garantili"
// yazmaz. Eskiden "Garantisiz" yazan servis bile /garanti/ eslesince
// garantili gorunuyordu.

const NEGATIVE = /garantisiz|telafisiz|no\s*refill|non[\s-]*refill|without\s*refill|refill\s*yok|garanti\s*yok|no\s*guarantee|no\s*warranty/i;
const POSITIVE = /telafi|garanti|guarantee|refill|düşüşsüz|dusussuz|non[\s-]*drop|no[\s-]*drop|30 gün|60 gün|90 gün|365 gün|days? refill|yenileme|lifetime/i;

function detectRefillFromText(text) {
  const value = String(text || '');
  if (!value.trim()) return false;
  if (NEGATIVE.test(value)) return false;
  return POSITIVE.test(value);
}

// Form/API'den gelen refill degeri: 1/"1"/true/"true" -> 1, 0/"0"/false -> 0,
// verilmemisse null (cagiran taraf tahmine duser).
function parseRefillFlag(value) {
  if (value === undefined || value === null || value === '') return null;
  if (value === true || value === 1 || value === '1' || value === 'true') return 1;
  if (value === false || value === 0 || value === '0' || value === 'false') return 0;
  return null;
}

module.exports = { detectRefillFromText, parseRefillFlag };
