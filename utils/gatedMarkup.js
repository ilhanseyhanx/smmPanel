'use strict';

// Tek sayfalik uygulamanin TUM gorunumleri index.html icinde durur ve eskiden
// herkese oldugu gibi gonderiliyordu. Ziyaretcinin (ve arama motoru botunun)
// asla goremeyecegi yonetim paneli + panel ici ekranlar sayfanin buyuk
// bolumunu kapliyordu:
//
//   DOM dugumu   2.312  (onerilen < 800)
//   HTML boyutu  195 KB (onerilen < 100 KB)
//   metin/HTML   %14,8
//   ayrica denetimin saydigi 180 form alaninin 155'i bu gizli ekranlardandi.
//
// Cozum: isaretleme index.html'de TEK kaynakta kalir (admin testleri ve
// gelistirme akisi degismez); sunucu her istekte yalnizca o ziyaretcinin
// gercekten kullanabilecegi bolumleri gonderir.
//
// GUVENLIK NOTU: bu bir yetki siniri DEGILDIR, sayfa agirligi optimizasyonudur.
// Butun uclar routes/*.js icinde ayrica dogrulanir; isaretlemeyi ele geciren
// biri hicbir sey kazanmaz.

const BLOKLAR = {
  // Yalnizca yonetici oturumuna gonderilir.
  admin: {
    bas: '<!--ADMIN-ONLY-START-->',
    son: '<!--ADMIN-ONLY-END-->',
    // Ilk blogun (admin gorunumu) yerine bos kabuk konur ki app.js
    // "bu gorunum yok" diye ana sayfaya dusmesin, tazeleme isteyebilsin.
    yerTutucu: '<section id="view-admin" class="app-view" data-gated="admin" style="display: none;"></section>'
  },
  // Oturum acmis her kullaniciya gonderilir (siparis, bakiye, destek...).
  auth: {
    bas: '<!--AUTH-ONLY-START-->',
    son: '<!--AUTH-ONLY-END-->',
    yerTutucu: ''
  }
};

function blokSil(html, ayar) {
  const kaynak = String(html);
  let sonuc = '';
  let konum = 0;
  let ilk = true;
  let bulundu = false;
  for (;;) {
    const bas = kaynak.indexOf(ayar.bas, konum);
    if (bas === -1) break;
    const son = kaynak.indexOf(ayar.son, bas);
    if (son === -1) break; // isaretler eslesmiyorsa hic dokunma
    bulundu = true;
    sonuc += kaynak.slice(konum, bas);
    if (ilk && ayar.yerTutucu) { sonuc += ayar.yerTutucu; ilk = false; }
    konum = son + ayar.son.length;
  }
  return bulundu ? sonuc + kaynak.slice(konum) : kaynak;
}

/**
 * Ziyaretcinin kullanamayacagi isaretlemeyi cikarir.
 * @param {string} html
 * @param {{admin?: boolean, authenticated?: boolean}} durum
 */
function stripGatedMarkup(html, durum = {}) {
  let sonuc = String(html || '');
  // Yonetici zaten oturum acmis sayilir.
  const adminMi = Boolean(durum.admin);
  const oturumVar = Boolean(durum.authenticated) || adminMi;
  if (!adminMi) sonuc = blokSil(sonuc, BLOKLAR.admin);
  if (!oturumVar) sonuc = blokSil(sonuc, BLOKLAR.auth);
  return sonuc;
}

/**
 * Istekteki oturum cerezini cozer. Yalnizca hangi isaretlemenin
 * gonderilecegine karar vermek icin kullanilir (bkz. guvenlik notu):
 * veritabanina gidilmez, token surumu/ban durumu burada sorgulanmaz.
 */
function sessionState(req) {
  const token = req?.cookies?.smm_session;
  if (!token) return { authenticated: false, admin: false };
  try {
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'development-only-change-this-secret-2026';
    const decoded = jwt.verify(token, secret, { issuer: 'smmpanel', audience: 'smmpanel-web' });
    return { authenticated: true, admin: decoded?.role === 'admin' };
  } catch {
    return { authenticated: false, admin: false };
  }
}

module.exports = { stripGatedMarkup, sessionState, BLOKLAR };
