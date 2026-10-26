'use strict';

// CANLI USD/TRY KURU (5 Eki 2026)
//
// Dijital urun fiyatlari TL'dir; Ingilizce sayfada gosterilen dolar karsiligi
// ve saglayici maliyetinin (USD) TL karsiligi bu kurla hesaplanir. Odeme her
// zaman TL'dir.
//
// Kaynak sirasi:
//   1) TCMB gunluk kurlar (today.xml, USD doviz satis)
//   2) open.er-api.com (anahtarsiz, gunluk guncellenen ucretsiz kaynak)
//   3) son basarili deger (site_settings.fx_usd_try_live — yeniden baslatmada kaybolmasin)
//   4) admin ayarlarindaki usd_try_rate (elle girilen kur)
// 6 saatte bir tazelenir. Testlerde ve FX_FETCH=off iken disari cikilmaz.

const axios = require('axios');
const { dbAsync } = require('../config/database');

const REFRESH_MS = 6 * 60 * 60 * 1000;
const SETTING_KEY = 'fx_usd_try_live';
let cache = null; // { rate, source, at }
let inflight = null;

function fetchDisabled() {
  return process.env.NODE_ENV === 'test' || String(process.env.FX_FETCH || '').toLowerCase() === 'off';
}

function sane(rate) {
  const n = Number(rate);
  // Akli basinda bir USD/TRY araligi; bozuk yanit kuru sacmalatmasin.
  return Number.isFinite(n) && n > 5 && n < 1000 ? Math.round(n * 10000) / 10000 : null;
}

async function fromTcmb() {
  const res = await axios.get('https://www.tcmb.gov.tr/kurlar/today.xml', { timeout: 8000, responseType: 'text', maxContentLength: 512 * 1024 });
  const xml = String(res.data || '');
  const block = xml.match(/<Currency[^>]*CurrencyCode="USD"[^>]*>([\s\S]*?)<\/Currency>/);
  const selling = block && block[1].match(/<ForexSelling>([\d.]+)<\/ForexSelling>/);
  return sane(selling && selling[1]);
}

async function fromOpenEr() {
  const res = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 8000, maxContentLength: 512 * 1024 });
  return sane(res.data && res.data.rates && res.data.rates.TRY);
}

async function readSetting(key) {
  const row = await dbAsync.get('SELECT value FROM site_settings WHERE key = ?', [key]).catch(() => null);
  return row ? row.value : null;
}

async function persisted() {
  try {
    const saved = JSON.parse(await readSetting(SETTING_KEY) || 'null');
    if (saved && sane(saved.rate)) return { rate: sane(saved.rate), source: saved.source || 'kayıt', at: saved.at || null };
  } catch { /* bozuk kayit yok sayilir */ }
  return null;
}

async function manual() {
  const rate = sane(await readSetting('usd_try_rate'));
  return rate ? { rate, source: 'ayar', at: null } : { rate: 35, source: 'varsayılan', at: null };
}

/** Kaynaklardan tazeler; basarisizsa onceki degeri korur. */
async function refresh() {
  if (fetchDisabled()) return null;
  if (inflight) return inflight;
  inflight = (async () => {
    for (const [source, fn] of [['TCMB', fromTcmb], ['open.er-api', fromOpenEr]]) {
      try {
        const rate = await fn();
        if (rate) {
          cache = { rate, source, at: new Date().toISOString() };
          await dbAsync.run(
            'INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
            [SETTING_KEY, JSON.stringify(cache)]
          ).catch(() => {});
          return cache;
        }
      } catch (err) {
        console.error(`Kur alınamadı (${source}):`, err.message);
      }
    }
    return null;
  })().finally(() => { inflight = null; });
  return inflight;
}

/**
 * Guncel USD/TRY kuru. Asla hata firlatmaz; sirayla canli -> kayitli ->
 * elle girilen kura duser. Bayatsa arka planda tazeler (cagiran beklemez).
 * @returns {Promise<{rate: number, source: string, at: string|null}>}
 */
async function getUsdTry() {
  if (!cache) cache = await persisted();
  const stale = !cache || !cache.at || Date.now() - new Date(cache.at).getTime() > REFRESH_MS;
  if (stale && !fetchDisabled()) refresh().catch(() => {});
  return cache || manual();
}

/** TL kurusu -> USD (2 ondalik). */
function tryToUsd(kurus, rate) {
  const r = Number(rate) || 0;
  if (!r) return 0;
  return Math.round((Number(kurus || 0) / 100 / r) * 100) / 100;
}

function startFxWorker() {
  if (fetchDisabled()) return;
  refresh().catch(() => {});
  const timer = setInterval(() => refresh().catch(() => {}), REFRESH_MS);
  timer.unref?.();
}

// Testler icin.
function _reset(value = null) { cache = value; }

module.exports = { getUsdTry, refresh, tryToUsd, startFxWorker, _reset };
