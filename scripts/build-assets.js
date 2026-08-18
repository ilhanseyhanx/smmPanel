'use strict';

// CSS ve JS dosyalarinin kucultulmus (minified) surumlerini uretir.
//
// Neden: Lighthouse "CSS'yi kucultun" ve "JavaScript'i kucultun" uyarilari
// veriyordu. Kaynak dosyalar oldugu gibi kalir (gelistirme ve okunabilirlik
// bozulmaz); bu betik yanlarina .min surumlerini yazar, server.js uretimde
// index.html'deki baglantilari onlara cevirir (bkz. useMinifiedAssets).
//
// Kullanim:
//   node scripts/build-assets.js         -> uretir
//   node scripts/build-assets.js --check -> guncel mi diye bakar (CI/deploy)
//
// ONEMLI: css/js degistiginde bu betik yeniden calistirilmali ve
// index.html'deki ?v= surum parametresi guncellenmeli.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { minify } = require('terser');
const CleanCSS = require('clean-css');

const KOK = path.join(__dirname, '..');
const KONTROL = process.argv.includes('--check');

const DOSYALAR = [
  { kaynak: 'public/css/style.css', hedef: 'public/css/style.min.css', tur: 'css' },
  { kaynak: 'public/js/api.js', hedef: 'public/js/api.min.js', tur: 'js' },
  { kaynak: 'public/js/app.js', hedef: 'public/js/app.min.js', tur: 'js' }
];

async function kucult(icerik, tur) {
  if (tur === 'css') {
    const sonuc = new CleanCSS({ level: 2, returnPromise: false }).minify(icerik);
    if (sonuc.errors.length) throw new Error(`CSS küçültme hatası: ${sonuc.errors.join(', ')}`);
    return sonuc.styles;
  }
  // JS: sinif/fonksiyon adlari korunur. app.js icindeki metotlar HTML'den
  // onclick="app.xxx()" ile cagriliyor; isimler degisirse sayfa kirilir.
  const sonuc = await minify(icerik, {
    compress: { drop_debugger: true, passes: 2 },
    mangle: { keep_classnames: true, keep_fnames: true },
    format: { comments: false }
  });
  if (!sonuc.code) throw new Error('JS küçültme boş çıktı verdi');
  return sonuc.code;
}

const ozet = veri => crypto.createHash('sha1').update(veri).digest('hex').slice(0, 12);

(async () => {
  let guncelDegil = [];
  for (const dosya of DOSYALAR) {
    const kaynakYol = path.join(KOK, dosya.kaynak);
    const hedefYol = path.join(KOK, dosya.hedef);
    const icerik = fs.readFileSync(kaynakYol, 'utf8');
    const kucuk = await kucult(icerik, dosya.tur);
    // Kaynagin ozeti ciktinin ilk satirina yazilir: --check bununla
    // ciktinin gercekten guncel kaynaktan uretilip uretilmedigini anlar.
    const damga = `/*src:${ozet(icerik)}*/`;
    const yeni = `${damga}\n${kucuk}`;

    if (KONTROL) {
      const mevcut = fs.existsSync(hedefYol) ? fs.readFileSync(hedefYol, 'utf8') : '';
      if (!mevcut.startsWith(damga)) guncelDegil.push(dosya.hedef);
      continue;
    }

    fs.writeFileSync(hedefYol, yeni);
    const once = Buffer.byteLength(icerik) / 1024;
    const sonra = Buffer.byteLength(yeni) / 1024;
    console.log(`${dosya.hedef.padEnd(26)} ${once.toFixed(0)} KB -> ${sonra.toFixed(0)} KB  (%${((1 - sonra / once) * 100).toFixed(0)} küçüldü)`);
  }

  if (KONTROL) {
    if (guncelDegil.length) {
      console.error(`Küçültülmüş dosyalar güncel değil: ${guncelDegil.join(', ')}\n"npm run build" çalıştırın.`);
      process.exit(1);
    }
    console.log('Küçültülmüş dosyalar güncel.');
  }
})().catch(err => { console.error(err.message); process.exit(1); });
