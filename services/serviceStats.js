'use strict';

// SERVIS VITRINI ISTATISTIKLERI (20 Eyl 2026)
//
// Katalog tablosunda iki sey gosterilir:
//   1) "Ortalama sure" sutunu — tamamlanmis siparislerin MEDYAN suresi
//   2) "En Cok Kullanilanlar" sekmesinin siralamasi
//
// NEDEN MEDYAN, ORTALAMA DEGIL:
// Sitede tamamlanan 83 siparisin 42'si 5 dakikanin altinda bitiyor, ama tek
// bir siparis 3.475 dakika surmus. Aritmetik ortalama bu tek deger yuzunden
// 90 dakikaya ciikiyor ve gercek performansi (tipik 5 dakika) kotu gosteriyor.
// Medyan uc degerlerden etkilenmez; musteriye "genelde ne kadar surer"
// sorusunun dogru cevabini verir. Basliga "Ortalama sure" yazilir (sektorde
// bilinen ifade) ama yanindaki bilgi simgesi ortanca oldugunu soyler.
//
// POPULERLIK KURALI (kullanici karari):
// Ayni kisinin AYNI SERVISTEN AYNI GUN verdigi siparisler 1 sayilir; ertesi
// gun tekrar alirsa +1. Boylece tek musterinin arka arkaya verdigi 63 siparis
// listeyi tek basina domine etmiyor (ham sayida 63'e 5 olan fark, bu kuralla
// 15'e 5'e dusuyor ve liste okunabilir kaliyor).
// Admin siparisleri DAHILDIR: kullanici, musterileri adina da panelden
// siparis veriyor; o talepler gercek.
//
// Sorgular her katalog istegi icin degil, 5 dakikada bir calisir.

const { dbAsync } = require('../config/database');

const ONBELLEK_MS = 5 * 60 * 1000;
// Tek siparisi olan servis de sure gosterir (kullanici karari 20 Eyl):
// admin panelindeki "Tamamlanma Sureleri" ekrani zaten esiksiz calisiyordu ve
// 29 servis listeliyordu; katalogda 3 esigi yuzunden yalnizca 4'u gorunuyor,
// arada tutarsizlik olusuyordu.
const MIN_SIPARIS = 1;
// Bu sayinin altindaki olcumler "yaklasik" sayilir: vitrin basina ~ koyar ve
// kac siparisten hesaplandigini ipucunda soyler. Tek siparisten cikan deger
// medyan degil o siparisin kendi suresidir; okuyan yanilmasin.
const GUVENILIR_ORNEK = 3;

let onbellek = null;
let onbellekZamani = 0;

function medyan(sayilar) {
  if (!sayilar.length) return null;
  const s = [...sayilar].sort((a, b) => a - b);
  const orta = Math.floor(s.length / 2);
  return s.length % 2 ? s[orta] : (s[orta - 1] + s[orta]) / 2;
}

/**
 * Servis kimligine gore { median_minutes, completed_count, popularity } dondurur.
 * Hata durumunda bos nesne doner; katalog asla bu yuzden bozulmaz.
 */
async function getServiceStats() {
  if (onbellek && Date.now() - onbellekZamani < ONBELLEK_MS) return onbellek;
  try {
    const [sureler, populerlik] = await Promise.all([
      // completed_at > created_at: saat kaymasi/veri hatasi negatif sure uretmesin.
      dbAsync.all(`
        SELECT service_id, (julianday(completed_at) - julianday(created_at)) * 1440.0 AS dk
        FROM orders
        WHERE status = 'completed' AND completed_at IS NOT NULL AND completed_at > created_at
      `),
      dbAsync.all(`
        SELECT service_id, COUNT(DISTINCT user_id || '|' || date(created_at)) AS puan
        FROM orders
        WHERE status NOT IN ('canceled', 'failed')
        GROUP BY service_id
      `)
    ]);

    const sureHaritasi = new Map();
    for (const satir of sureler) {
      if (!Number.isFinite(satir.dk)) continue;
      if (!sureHaritasi.has(satir.service_id)) sureHaritasi.set(satir.service_id, []);
      sureHaritasi.get(satir.service_id).push(satir.dk);
    }

    const sonuc = {};
    for (const [servisId, liste] of sureHaritasi) {
      if (liste.length < MIN_SIPARIS) continue;
      sonuc[servisId] = {
        median_minutes: Math.round(medyan(liste)),
        completed_count: liste.length
      };
    }
    for (const satir of populerlik) {
      sonuc[satir.service_id] = { ...(sonuc[satir.service_id] || {}), popularity: satir.puan };
    }

    onbellek = sonuc;
    onbellekZamani = Date.now();
    return sonuc;
  } catch {
    // Istatistik olmadan da katalog calismali.
    return onbellek || {};
  }
}

/** Siparis/servis degisince bir sonraki istekte yeniden hesaplanir. */
function invalidateServiceStats() {
  onbellek = null;
  onbellekZamani = 0;
}

module.exports = { getServiceStats, invalidateServiceStats, medyan, MIN_SIPARIS, GUVENILIR_ORNEK };
