'use strict';

// Shopier odeme sayfasinda gorunen urun gorselini uretir.
//
// Neden ayri bir gorsel: her bakiye yuklemesinde Shopier magazasinda gecici bir
// urun olusturuyoruz ve Shopier gorseli kendi CDN'ine kopyaliyor. Ilk denemede
// paylasim gorseli (og-image.png) verilmisti; Shopier dosyayi indirdi (nginx
// kaydinda 200) ama CDN kopyasi 404 kaldi. Iki supheli vardi: 1200x630 genis
// oran ve alfa kanali. Bu betik ikisini birden ortadan kaldirir:
//   - kare (800x800), urun kucuk resmi olarak kirpilmadan oturur
//   - SAYDAMLIK YOK: PNG renk turu 2 (RGB), alfa kanali hic yazilmaz
//
// Kullanim:  node scripts/make-shopier-image.js
// (ikon degisirse tekrar calistirilmali; cikti git'e islenir)

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const KAYNAK = path.join(__dirname, '..', 'public', 'icon-512.png');
const HEDEF = path.join(__dirname, '..', 'public', 'shopier-product.png');

const BOYUT = 800;
const IKON_BOYUT = 460;

// ---------------------------------------------------------------
// PNG okuma (8 bit RGBA, interlace yok — kendi ikonumuz bu bicimde)
// ---------------------------------------------------------------
function pngOku(dosya) {
  const ham = fs.readFileSync(dosya);
  let konum = 8;
  let en = 0, boy = 0;
  const parcalar = [];
  while (konum < ham.length) {
    const uzunluk = ham.readUInt32BE(konum);
    const tur = ham.toString('ascii', konum + 4, konum + 8);
    const govde = ham.subarray(konum + 8, konum + 8 + uzunluk);
    if (tur === 'IHDR') {
      en = govde.readUInt32BE(0);
      boy = govde.readUInt32BE(4);
      if (govde[8] !== 8 || govde[9] !== 6 || govde[12] !== 0) {
        throw new Error('Yalnızca 8 bit RGBA, interlace edilmemiş PNG desteklenir.');
      }
    } else if (tur === 'IDAT') {
      parcalar.push(govde);
    }
    konum += 12 + uzunluk;
  }
  const acilmis = zlib.inflateSync(Buffer.concat(parcalar));

  // Satir filtrelerini geri al (PNG spec bolum 9).
  const pikselBayt = 4;
  const satirBayt = en * pikselBayt;
  const cikti = Buffer.alloc(satirBayt * boy);
  for (let y = 0; y < boy; y++) {
    const filtre = acilmis[y * (satirBayt + 1)];
    const kaynakSatir = acilmis.subarray(y * (satirBayt + 1) + 1, (y + 1) * (satirBayt + 1));
    for (let i = 0; i < satirBayt; i++) {
      const ham2 = kaynakSatir[i];
      const sol = i >= pikselBayt ? cikti[y * satirBayt + i - pikselBayt] : 0;
      const ust = y > 0 ? cikti[(y - 1) * satirBayt + i] : 0;
      const solUst = (y > 0 && i >= pikselBayt) ? cikti[(y - 1) * satirBayt + i - pikselBayt] : 0;
      let deger;
      switch (filtre) {
        case 0: deger = ham2; break;
        case 1: deger = ham2 + sol; break;
        case 2: deger = ham2 + ust; break;
        case 3: deger = ham2 + ((sol + ust) >> 1); break;
        case 4: {
          const p = sol + ust - solUst;
          const pa = Math.abs(p - sol), pb = Math.abs(p - ust), pc = Math.abs(p - solUst);
          deger = ham2 + (pa <= pb && pa <= pc ? sol : (pb <= pc ? ust : solUst));
          break;
        }
        default: throw new Error(`Bilinmeyen PNG satır filtresi: ${filtre}`);
      }
      cikti[y * satirBayt + i] = deger & 0xff;
    }
  }
  return { en, boy, veri: cikti };
}

// ---------------------------------------------------------------
// PNG yazma — renk turu 2 (RGB, alfa YOK)
// ---------------------------------------------------------------
const CRC_TABLOSU = (() => {
  const tablo = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tablo[n] = c;
  }
  return tablo;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLOSU[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

function parca(tur, govde) {
  const uzunluk = Buffer.alloc(4);
  uzunluk.writeUInt32BE(govde.length);
  const etiketVeGovde = Buffer.concat([Buffer.from(tur, 'ascii'), govde]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(etiketVeGovde) >>> 0);
  return Buffer.concat([uzunluk, etiketVeGovde, crc]);
}

function pngYazRgb(dosya, en, boy, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(en, 0);
  ihdr.writeUInt32BE(boy, 4);
  ihdr[8] = 8;   // bit derinligi
  ihdr[9] = 2;   // renk turu: RGB (alfa yok)
  const satirBayt = en * 3;
  const satirlar = Buffer.alloc((satirBayt + 1) * boy);
  for (let y = 0; y < boy; y++) {
    satirlar[y * (satirBayt + 1)] = 0; // filtre yok
    rgb.copy(satirlar, y * (satirBayt + 1) + 1, y * satirBayt, (y + 1) * satirBayt);
  }
  fs.writeFileSync(dosya, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    parca('IHDR', ihdr),
    parca('IDAT', zlib.deflateSync(satirlar, { level: 9 })),
    parca('IEND', Buffer.alloc(0))
  ]));
}

// ---------------------------------------------------------------
// Cizim
// ---------------------------------------------------------------
const ikon = pngOku(KAYNAK);
const tuval = Buffer.alloc(BOYUT * BOYUT * 3);

// Zemin: kosegen marka gecisi (mor -> gece mavisi), og-image ile ayni aile.
const SOL_UST = [36, 22, 84];
const SAG_ALT = [7, 10, 18];
for (let y = 0; y < BOYUT; y++) {
  for (let x = 0; x < BOYUT; x++) {
    const oran = (x / BOYUT + y / BOYUT) / 2;
    const k = (y * BOYUT + x) * 3;
    for (let c = 0; c < 3; c++) {
      tuval[k + c] = Math.round(SOL_UST[c] + (SAG_ALT[c] - SOL_UST[c]) * oran);
    }
  }
}

// Merkezde yumusak bir isik halesi: logo zeminden ayrilsin.
const merkez = BOYUT / 2;
const HALE_YARICAP = BOYUT * 0.42;
for (let y = 0; y < BOYUT; y++) {
  for (let x = 0; x < BOYUT; x++) {
    const uzaklik = Math.hypot(x - merkez, y - merkez);
    if (uzaklik >= HALE_YARICAP) continue;
    // Merkeze yaklastikca artan, kenarda sifirlanan yumusak parlaklik.
    const guc = Math.pow(1 - uzaklik / HALE_YARICAP, 2) * 0.30;
    const k = (y * BOYUT + x) * 3;
    tuval[k] = Math.min(255, Math.round(tuval[k] + 120 * guc));
    tuval[k + 1] = Math.min(255, Math.round(tuval[k + 1] + 80 * guc));
    tuval[k + 2] = Math.min(255, Math.round(tuval[k + 2] + 200 * guc));
  }
}

// Ikonu bilineer olceklendirip ortala; alfa kanali zemine karistirilir
// (ciktida saydamlik kalmaz).
const basla = Math.round((BOYUT - IKON_BOYUT) / 2);
for (let y = 0; y < IKON_BOYUT; y++) {
  for (let x = 0; x < IKON_BOYUT; x++) {
    const kx = (x + 0.5) * ikon.en / IKON_BOYUT - 0.5;
    const ky = (y + 0.5) * ikon.boy / IKON_BOYUT - 0.5;
    const x0 = Math.max(0, Math.floor(kx)), y0 = Math.max(0, Math.floor(ky));
    const x1 = Math.min(ikon.en - 1, x0 + 1), y1 = Math.min(ikon.boy - 1, y0 + 1);
    const fx = kx - x0, fy = ky - y0;

    const ornek = (px, py, c) => ikon.veri[(py * ikon.en + px) * 4 + c];
    const kanal = c =>
      ornek(x0, y0, c) * (1 - fx) * (1 - fy) +
      ornek(x1, y0, c) * fx * (1 - fy) +
      ornek(x0, y1, c) * (1 - fx) * fy +
      ornek(x1, y1, c) * fx * fy;

    const alfa = kanal(3) / 255;
    if (alfa <= 0) continue;
    const hedefK = ((basla + y) * BOYUT + (basla + x)) * 3;
    for (let c = 0; c < 3; c++) {
      tuval[hedefK + c] = Math.round(kanal(c) * alfa + tuval[hedefK + c] * (1 - alfa));
    }
  }
}

pngYazRgb(HEDEF, BOYUT, BOYUT, tuval);
const boyutKb = (fs.statSync(HEDEF).size / 1024).toFixed(0);
console.log(`Shopier ürün görseli yazıldı: ${path.relative(process.cwd(), HEDEF)} (${BOYUT}x${BOYUT}, RGB/saydamlıksız, ${boyutKb} KB)`);
