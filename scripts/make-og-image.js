'use strict';

// Sosyal paylasim gorseli (og:image) uretir.
//
// Neden ayri bir dosya: Facebook/X/WhatsApp onizlemesi 1.91:1 orana gore
// kirpar. Kare favicon (icon-512.png) verilince kenarlardan kesiliyor ve
// denetim araclari "og:image:width/height eksik" uyarisi veriyordu. Bu betik
// mevcut ikonu 1200x630'luk marka zeminine yerlestirip public/og-image.png
// dosyasini yeniden yazar.
//
// Kullanim:  node scripts/make-og-image.js
// (ikon degisirse tekrar calistirilmali; cikti git'e islenir)

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const KAYNAK = path.join(__dirname, '..', 'public', 'icon-512.png');
const HEDEF = path.join(__dirname, '..', 'public', 'og-image.png');

const GENISLIK = 1200;
const YUKSEKLIK = 630;
const IKON_BOYUT = 340;

// ---------------------------------------------------------------
// PNG okuma (8 bit RGBA, interlace yok - kendi ikonumuz bu bicimde)
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
// PNG yazma (filtresiz satirlar; boyut onemli degil, 1200x630 kucuk kaliyor)
// ---------------------------------------------------------------
function parca(tur, govde) {
  const uzunluk = Buffer.alloc(4);
  uzunluk.writeUInt32BE(govde.length);
  const etiketVeGovde = Buffer.concat([Buffer.from(tur, 'ascii'), govde]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(etiketVeGovde) >>> 0);
  return Buffer.concat([uzunluk, etiketVeGovde, crc]);
}

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

function pngYaz(dosya, en, boy, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(en, 0);
  ihdr.writeUInt32BE(boy, 4);
  ihdr[8] = 8;   // bit derinligi
  ihdr[9] = 6;   // renk turu: RGBA
  const satirlar = Buffer.alloc((en * 4 + 1) * boy);
  for (let y = 0; y < boy; y++) {
    satirlar[y * (en * 4 + 1)] = 0; // filtre yok
    rgba.copy(satirlar, y * (en * 4 + 1) + 1, y * en * 4, (y + 1) * en * 4);
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
const tuval = Buffer.alloc(GENISLIK * YUKSEKLIK * 4);

// Zemin: sol ustten sag alta marka moru -> gece mavisi gecisi.
const SOL_UST = [24, 16, 58];
const SAG_ALT = [7, 10, 18];
for (let y = 0; y < YUKSEKLIK; y++) {
  for (let x = 0; x < GENISLIK; x++) {
    const oran = (x / GENISLIK + y / YUKSEKLIK) / 2;
    const i = (y * GENISLIK + x) * 4;
    for (let k = 0; k < 3; k++) tuval[i + k] = Math.round(SOL_UST[k] + (SAG_ALT[k] - SOL_UST[k]) * oran);
    tuval[i + 3] = 255;
  }
}

// Alt kenarda vurgu seridi (tema rengi).
const SERIT = [33, 169, 246];
for (let y = YUKSEKLIK - 10; y < YUKSEKLIK; y++) {
  for (let x = 0; x < GENISLIK; x++) {
    const i = (y * GENISLIK + x) * 4;
    for (let k = 0; k < 3; k++) tuval[i + k] = SERIT[k];
  }
}

// Ikonu ortala ve alfa harmanlamayla yerlestir (en yakin komsu olcekleme).
const baslangicX = Math.round((GENISLIK - IKON_BOYUT) / 2);
const baslangicY = Math.round((YUKSEKLIK - IKON_BOYUT) / 2) - 10;
for (let y = 0; y < IKON_BOYUT; y++) {
  for (let x = 0; x < IKON_BOYUT; x++) {
    const kx = Math.min(ikon.en - 1, Math.floor(x * ikon.en / IKON_BOYUT));
    const ky = Math.min(ikon.boy - 1, Math.floor(y * ikon.boy / IKON_BOYUT));
    const k = (ky * ikon.en + kx) * 4;
    const alfa = ikon.veri[k + 3] / 255;
    if (alfa === 0) continue;
    const h = ((baslangicY + y) * GENISLIK + (baslangicX + x)) * 4;
    for (let c = 0; c < 3; c++) {
      tuval[h + c] = Math.round(ikon.veri[k + c] * alfa + tuval[h + c] * (1 - alfa));
    }
  }
}

pngYaz(HEDEF, GENISLIK, YUKSEKLIK, tuval);
console.log(`og-image.png yazıldı: ${GENISLIK}x${YUKSEKLIK}, ${(fs.statSync(HEDEF).size / 1024).toFixed(1)} KB`);
