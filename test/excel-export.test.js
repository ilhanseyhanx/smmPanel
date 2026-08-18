const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-xlsx-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.ENABLE_DEMO_PAYMENTS = 'false';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');
const { buildXlsx, columnsFromRows } = require('../utils/xlsx');

const ADMIN_PASSWORD = 'GuvenliAdminSifre_2026';

test.before(async () => {
  await initDatabase();
  // Varsayilan admin sifresi zorunlu olarak degistirilmeden panel uclari kullanilamaz.
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  await agent.post('/api/admin/change-password').send({
    current_password: 'admin12345', new_password: ADMIN_PASSWORD
  });
});
test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

// .xlsx bir ZIP arsividir; Excel'in yapacagi gibi acip icerigini okuruz.
function readXlsx(buffer) {
  const files = {};
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(eocd > 0, 'ZIP arşiv sonu imzası bulunamadı');
  const count = buffer.readUInt16LE(eocd + 10);
  let ptr = buffer.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const nameLen = buffer.readUInt16LE(ptr + 28);
    const extraLen = buffer.readUInt16LE(ptr + 30);
    const commentLen = buffer.readUInt16LE(ptr + 32);
    const localOff = buffer.readUInt32LE(ptr + 42);
    const name = buffer.slice(ptr + 46, ptr + 46 + nameLen).toString('utf8');
    const compSize = buffer.readUInt32LE(ptr + 20);
    const lNameLen = buffer.readUInt16LE(localOff + 26);
    const lExtraLen = buffer.readUInt16LE(localOff + 28);
    const start = localOff + 30 + lNameLen + lExtraLen;
    files[name] = zlib.inflateRawSync(buffer.slice(start, start + compSize)).toString('utf8');
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const sheetTexts = xml => [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(m => m[1]);
const sheetNames = wb => [...wb.matchAll(/<sheet name="([^"]+)"/g)].map(m => m[1]);

async function adminAgent() {
  const agent = request.agent(app);
  const login = await agent.post('/api/auth/login').send({ username: 'admin', password: ADMIN_PASSWORD });
  assert.equal(login.status, 200, 'admin oturumu açılamadı');
  return agent;
}

test('üretilen xlsx geçerli bir ZIP ve Excel paketidir', () => {
  const rows = [{ a: 'İçerik & <test>', b: 12.5 }];
  const cols = columnsFromRows(rows, { labels: { a: 'Başlık A' } });
  const files = readXlsx(buildXlsx([{ name: 'Sayfa', columns: cols, rows }]));

  for (const part of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml',
    'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml']) {
    assert.ok(files[part], `${part} arşivde yok`);
  }
  const sheet = files['xl/worksheets/sheet1.xml'];
  assert.ok(sheet.includes('İçerik &amp; &lt;test&gt;'), 'özel karakterler XML-kaçışlı değil');
  assert.ok(sheet.includes('<v>12.5</v>'), 'sayı sayı olarak yazılmamış');
  assert.ok(!sheet.includes('<f>'), 'hücre formül olarak yazılmış');
});

test('formül gibi görünen metin Excel formülü olarak çalışmaz', () => {
  const rows = [{ x: '=1+1', y: '@SUM(A1)', z: '+cmd|calc' }];
  const cols = columnsFromRows(rows);
  const sheet = readXlsx(buildXlsx([{ name: 'S', columns: cols, rows }]))['xl/worksheets/sheet1.xml'];
  assert.ok(!sheet.includes('<f>'), 'formül hücresi üretilmiş');

  // Veri satirindaki (2. satir) uc hucrenin de metin tipinde olmasi gerekir.
  const dataRow = sheet.match(/<row r="2">([\s\S]*?)<\/row>/)[1];
  assert.equal((dataRow.match(/t="inlineStr"/g) || []).length, 3, 'formül metinleri inlineStr değil');
  assert.ok(dataRow.includes('=1+1') && dataRow.includes('@SUM(A1)'), 'metinler olduğu gibi korunmamış');
});

test('sütunlar tüm kayıtlardaki alanlardan çıkarılır, hiçbir başlık atlanmaz', () => {
  const rows = [{ a: 1 }, { b: 2 }, { a: 3, c: 4 }];
  const cols = columnsFromRows(rows);
  assert.deepEqual(cols.map(c => c.key), ['a', 'b', 'c']);

  const ordered = columnsFromRows(rows, { preferredOrder: ['c', 'a'] });
  assert.deepEqual(ordered.map(c => c.key), ['c', 'a', 'b'], 'tercih edilen sıra uygulanmadı');
});

test('servis dışa aktarma oturum açmamış kullanıcıya kapalıdır', async () => {
  assert.equal((await request(app).get('/api/admin/services/export')).status, 401);
  assert.equal((await request(app).get('/api/admin/providers/1/services/export')).status, 401);
});

test('normal kullanıcı servis listesini Excel olarak indiremez', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({
    username: 'excel_denemesi', email: 'excel@example.com', password: 'GuvenliSifre_123'
  });
  assert.equal((await agent.get('/api/admin/services/export')).status, 403);
});

test('aktif ve pasif servisler ayrı sayfalar olarak Excel indirilir', async () => {
  const agent = await adminAgent();

  const category = await dbAsync.get(`SELECT id FROM categories LIMIT 1`);
  await dbAsync.run(
    `INSERT INTO services (category_id, name, name_tr, rate_per_1000, min_quantity, max_quantity, status)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [category.id, 'Aktif Test Servisi İĞÜŞÇÖ', 'Aktif Test Servisi İĞÜŞÇÖ', 15.5, 10, 1000]
  );
  await dbAsync.run(
    `INSERT INTO services (category_id, name, name_tr, rate_per_1000, min_quantity, max_quantity, status)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [category.id, 'Pasif Test Servisi', 'Pasif Test Servisi', 7.25, 5, 500]
  );

  const res = await agent.get('/api/admin/services/export?status=all').buffer().parse((r, cb) => {
    const chunks = [];
    r.on('data', c => chunks.push(c));
    r.on('end', () => cb(null, Buffer.concat(chunks)));
  });

  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /spreadsheetml\.sheet/);
  assert.match(res.headers['content-disposition'], /attachment/);
  assert.match(res.headers['content-disposition'], /\.xlsx/);

  const files = readXlsx(res.body);
  const names = sheetNames(files['xl/workbook.xml']);
  assert.deepEqual(names, ['Aktif Servisler', 'Pasif Servisler'], 'iki sayfa üretilmedi');

  const aktif = sheetTexts(files['xl/worksheets/sheet1.xml']);
  const pasif = sheetTexts(files['xl/worksheets/sheet2.xml']);

  assert.ok(aktif.includes('Aktif Test Servisi İĞÜŞÇÖ'), 'aktif servis aktif sayfada yok');
  assert.ok(!aktif.includes('Pasif Test Servisi'), 'pasif servis aktif sayfaya sızmış');
  assert.ok(pasif.includes('Pasif Test Servisi'), 'pasif servis pasif sayfada yok');
  assert.ok(!pasif.includes('Aktif Test Servisi İĞÜŞÇÖ'), 'aktif servis pasif sayfaya sızmış');

  // Katalogtaki TUM basliklar: veritabani sutunlarinin hepsi dosyada olmali.
  const dbColumns = (await dbAsync.all(`PRAGMA table_info(services)`)).map(c => c.name);
  const headerRow = files['xl/worksheets/sheet1.xml'].split('</row>')[0];
  const headers = [...headerRow.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(m => m[1]);
  assert.ok(headers.length >= dbColumns.length, `başlık sayısı yetersiz: ${headers.length} < ${dbColumns.length}`);
  for (const label of ['Servis ID', 'Servis Adı', 'Kategori', 'Sağlayıcı Adı', 'Durum', 'Min. Adet', 'Maks. Adet']) {
    assert.ok(headers.includes(label), `"${label}" başlığı eksik`);
  }
  // Durum 1/0 yerine okunabilir metin olmali.
  assert.ok(aktif.includes('Aktif'), 'durum metne çevrilmemiş');
});

test('sadece aktifler veya sadece pasifler indirilebilir', async () => {
  const agent = await adminAgent();
  const fetchSheet = async (status) => {
    const res = await agent.get(`/api/admin/services/export?status=${status}`).buffer().parse((r, cb) => {
      const chunks = [];
      r.on('data', c => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    assert.equal(res.status, 200);
    return readXlsx(res.body);
  };

  const aktifDosya = await fetchSheet('active');
  assert.deepEqual(sheetNames(aktifDosya['xl/workbook.xml']), ['Aktif Servisler']);
  assert.ok(!sheetTexts(aktifDosya['xl/worksheets/sheet1.xml']).includes('Pasif Test Servisi'));

  const pasifDosya = await fetchSheet('passive');
  assert.deepEqual(sheetNames(pasifDosya['xl/workbook.xml']), ['Pasif Servisler']);
  assert.ok(sheetTexts(pasifDosya['xl/worksheets/sheet1.xml']).includes('Pasif Test Servisi'));

  // Gecersiz status degeri hata vermez, tum listeye duser.
  const hatali = await fetchSheet('boyle-bir-sey-yok');
  assert.equal(sheetNames(hatali['xl/workbook.xml']).length, 2);
});

test('olmayan sağlayıcının kataloğu istenirse 404 döner', async () => {
  const agent = await adminAgent();
  assert.equal((await agent.get('/api/admin/providers/999999/services/export')).status, 404);
});
