'use strict';

// Bagimlilik eklemeden gercek .xlsx (Excel) dosyasi uretir.
// .xlsx aslinda icinde XML dosyalari olan bir ZIP arsividir; ZIP'i Node'un
// yerlesik zlib modulu ile kendimiz paketliyoruz. Boylece sunucuya yeni bir
// npm paketi kurmak gerekmez.

const zlib = require('zlib');

// --- CRC32 (ZIP baslıklari icin zorunlu) -----------------------------------
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[i]) & 0xFF];
  return (crc ^ -1) >>> 0;
}

// --- Minimal ZIP yazici ----------------------------------------------------
function zipFiles(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const content = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, 'utf8');
    const compressed = zlib.deflateRawSync(content, { level: 9 });
    const crc = crc32(content);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);   // yerel dosya basligi imzasi
    local.writeUInt16LE(20, 4);           // gereken surum
    local.writeUInt16LE(0x0800, 6);       // bayrak: dosya adlari UTF-8
    local.writeUInt16LE(8, 8);            // sikistirma yontemi: deflate
    local.writeUInt16LE(0, 10);           // saat (sabit)
    local.writeUInt16LE(0x21, 12);        // tarih (sabit: 1980-01-01)
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);           // ekstra alan yok

    chunks.push(local, nameBuf, compressed);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);      // merkezi dizin imzasi
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0x21, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(compressed.length, 20);
    cd.writeUInt32LE(content.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([cd, nameBuf]));

    offset += local.length + nameBuf.length + compressed.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);       // arsiv sonu imzasi
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...chunks, centralBuf, end]);
}

// --- XML yardimcilari ------------------------------------------------------
function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
    // XML 1.0'da yasakli kontrol karakterleri Excel'in dosyayi bozuk saymasina yol acar.
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function columnLetter(index) {
  let letter = '';
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

// Excel sayfa adi kisitlari: en fazla 31 karakter ve : \ / ? * [ ] yasak.
function safeSheetName(name, fallback) {
  const cleaned = String(name || fallback).replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31);
  return cleaned || fallback;
}

function cellXml(ref, value, styleIndex) {
  const style = styleIndex ? ` s="${styleIndex}"` : '';
  if (value === null || value === undefined || value === '') return `<c r="${ref}"${style}/>`;

  // Sayilar sayi olarak yazilir ki Excel'de toplama/siralama yapilabilsin.
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"${style}><v>${value}</v></c>`;
  }
  const text = String(value);
  // inlineStr kullanildigi icin basindaki "=" Excel'de formul olarak calismaz.
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
}

function sheetXml(columns, rows) {
  const colWidths = columns.map((col, i) =>
    `<col min="${i + 1}" max="${i + 1}" width="${col.width || 18}" customWidth="1"/>`).join('');

  const headerCells = columns.map((col, i) => cellXml(`${columnLetter(i)}1`, col.header, 1)).join('');
  const headerRow = `<row r="1" ht="20" customHeight="1">${headerCells}</row>`;

  const bodyRows = rows.map((row, r) => {
    const cells = columns.map((col, i) => cellXml(`${columnLetter(i)}${r + 2}`, row[col.key])).join('');
    return `<row r="${r + 2}">${cells}</row>`;
  }).join('');

  const lastCol = columnLetter(Math.max(columns.length - 1, 0));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetPr><outlinePr summaryBelow="1" summaryRight="1"/></sheetPr>
<dimension ref="A1:${lastCol}${rows.length + 1}"/>
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${colWidths}</cols>
<sheetData>${headerRow}${bodyRows}</sheetData>
<autoFilter ref="A1:${lastCol}${rows.length + 1}"/>
</worksheet>`;
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2">
<font><sz val="11"/><color theme="1"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF6D28D9"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>
</cellXfs>
</styleSheet>`;

/**
 * sheets: [{ name, columns: [{ header, key, width }], rows: [obj] }]
 * Excel'in acabilecegi .xlsx Buffer'i dondurur.
 */
function buildXlsx(sheets) {
  const list = (Array.isArray(sheets) ? sheets : [sheets]).filter(Boolean);
  if (list.length === 0) throw new Error('En az bir sayfa gerekli.');

  // Ayni ada sahip iki sayfa Excel'de dosyayi bozar; adlari benzersizlestiriyoruz.
  const usedNames = new Set();
  const named = list.map((sheet, i) => {
    let name = safeSheetName(sheet.name, `Sayfa${i + 1}`);
    let suffix = 2;
    while (usedNames.has(name.toLowerCase())) {
      const base = name.slice(0, 28);
      name = `${base}_${suffix++}`;
    }
    usedNames.add(name.toLowerCase());
    return { ...sheet, name };
  });

  const entries = [
    {
      name: '[Content_Types].xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${named.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
</Types>`
    },
    {
      name: '_rels/.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
    },
    {
      name: 'xl/workbook.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${named.map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
</workbook>`
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${named.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n')}
<Relationship Id="rId${named.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
    },
    { name: 'xl/styles.xml', data: STYLES_XML }
  ];

  named.forEach((sheet, i) => {
    entries.push({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: sheetXml(sheet.columns || [], sheet.rows || [])
    });
  });

  return zipFiles(entries);
}

/**
 * Kayitlardaki TUM alanlari tarayip sutun listesi cikarir; hicbir baslik atlanmaz.
 * labels: bilinen alanlar icin Turkce baslik; bilinmeyenler ham anahtar adiyla gelir.
 * preferredOrder: bu alanlar (varsa) once gelir, kalanlar kesfedilme sirasiyla eklenir.
 */
function columnsFromRows(rows, { labels = {}, preferredOrder = [], hide = [] } = {}) {
  const hidden = new Set(hide);
  const keys = [];
  const seen = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row || {})) {
      if (seen.has(key) || hidden.has(key)) continue;
      seen.add(key);
      keys.push(key);
    }
  }
  const ordered = [
    ...preferredOrder.filter(k => seen.has(k)),
    ...keys.filter(k => !preferredOrder.includes(k))
  ];
  return ordered.map(key => ({
    key,
    header: labels[key] || key,
    width: Math.min(Math.max((labels[key] || key).length + 4, 12), 50)
  }));
}

module.exports = { buildXlsx, columnsFromRows, escapeXml, columnLetter, safeSheetName };
