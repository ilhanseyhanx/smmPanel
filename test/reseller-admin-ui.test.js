// Admin > Bayiler arayuzu: sekme, form alanlari ve istemci uclarinin sunucu
// rotalariyla eslesmesi (yanlis adrese istek atan dugme kalmasin).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const kok = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(kok, 'public', 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(kok, 'public', 'js', 'app.js'), 'utf8');
// Bayi yonetim ekrani ayri dosyada: ziyaretcilere gonderilmez.
const modulJs = fs.readFileSync(path.join(kok, 'public', 'js', 'admin-resellers.js'), 'utf8');
const istemciJs = appJs + modulJs;
const apiJs = fs.readFileSync(path.join(kok, 'public', 'js', 'api.js'), 'utf8');
const rota = fs.readFileSync(path.join(kok, 'routes', 'adminResellers.js'), 'utf8');

test('Bayiler sekmesi menüde, mobil menüde ve panelde var', () => {
  assert.ok(html.includes('data-admin-tab="resellers"'), 'yan menü düğmesi yok');
  assert.ok(html.includes('id="admin-tab-resellers"'), 'panel yok');
  assert.match(html, /<option value="resellers">Bayiler<\/option>/, 'mobil menü seçeneği yok');
  assert.ok(appJs.includes("tabName === 'resellers'"), 'sekme açılınca veri yüklenmiyor');
});

test('ayar formu ve liste alanları HTML\'de, app.js bunları kullanıyor', () => {
  for (const id of ['reseller-setting-public', 'reseller-public-state', 'reseller-setting-discount', 'reseller-setting-min-deposit', 'reseller-setting-markup', 'reseller-setting-open',
    'reseller-settings-save', 'reseller-create-owner', 'reseller-create-name', 'reseller-create-slug',
    'admin-resellers-search', 'admin-resellers-tbody', 'admin-resellers-summary',
    'admin-resellers-list-view', 'admin-reseller-detail-view', 'admin-reseller-detail-content']) {
    assert.ok(html.includes(`id="${id}"`), `${id} alanı HTML'de yok`);
    assert.ok(istemciJs.includes(`'${id}'`), `${id} istemci kodunda kullanılmıyor`);
  }
});

test('HTML\'deki onclick çağrılarının hepsi app.js\'te tanımlı', () => {
  const blok = html.slice(html.indexOf('id="admin-tab-resellers"'), html.indexOf('<!-- ADMIN TAB 4: ALL ORDERS -->'));
  const cagrilar = new Set([...blok.matchAll(/app\.([a-zA-Z]+)\(/g)].map(m => m[1]));
  for (const ad of cagrilar) {
    assert.match(istemciJs, new RegExp(`\\n  (async )?${ad}\\(`), `app.${ad} tanımlı değil`);
  }
});

test('bayi yönetim kodu ziyaretçinin indirdiği pakete girmez', () => {
  // Kod app.js'te DEGIL ayri dosyada olmali; app.js yalnizca tembel yukleyiciyi
  // icermeli. Aksi halde bayilik kapaliyken bile herkes bu kodu indirirdi.
  for (const ad of ['renderAdminResellerDetail', 'saveResellerSettings', 'renderAdminResellersTable']) {
    const tanim = new RegExp(`\\n  (async )?${ad}\\(`);
    assert.ok(!tanim.test(appJs), `${ad} hâlâ app.js içinde`);
    assert.ok(tanim.test(modulJs), `${ad} modülde yok`);
  }
  assert.match(appJs, /loadResellerAdminModule\(\)/, 'tembel yükleyici yok');
  assert.match(appJs, /admin-resellers\$\{min\}\.js/, 'modül adresi app.js\'te yok');
  // HTML'de admin-resellers-* KIMLIKLERI olabilir; olmamasi gereken sey
  // modulun sabit <script> etiketiyle herkese yuklenmesidir.
  assert.ok(!/<script[^>]+admin-resellers/.test(html), 'modül index.html\'e sabit script olarak eklenmiş');
  assert.ok(modulJs.startsWith('// ADMIN > BAYILER'), 'modül başlığı beklenen biçimde değil');
  assert.match(modulJs, /Object\.assign\(SmmApp\.prototype/, 'modül SmmApp prototipine eklenmiyor');
});

test('build betiği modülün küçültülmüş sürümünü de üretir', () => {
  const build = fs.readFileSync(path.join(kok, 'scripts', 'build-assets.js'), 'utf8');
  assert.match(build, /admin-resellers\.js/, 'build listesinde modül yok');
  assert.ok(fs.existsSync(path.join(kok, 'public', 'js', 'admin-resellers.min.js')), 'küçültülmüş modül üretilmemiş');
});

test('istemci uçları sunucu rotalarıyla eşleşiyor', () => {
  const beklenen = [
    [/getAdminResellers: \(\) => API\.request\('\/admin\/resellers'\)/, /router\.get\('\/',/],
    [/'\/admin\/resellers\/settings', \{ method: 'PUT'/, /router\.put\('\/settings'/],
    [/\/admin\/resellers\/\$\{id\}\/status`, \{ method: 'POST'/, /router\.post\('\/:id\/status'/],
    [/\/admin\/resellers\/\$\{id\}\/domains\/\$\{domainId\}`, \{ method: 'PATCH'/, /router\.patch\('\/:id\/domains\/:domainId'/],
    [/\/customers\/\$\{customerId\}\/balance`, \{ method: 'POST'/, /router\.post\('\/:id\/customers\/:customerId\/balance'/],
    [/\/customers\/\$\{customerId\}\/ban`, \{ method: 'POST'/, /router\.post\('\/:id\/customers\/:customerId\/ban'/],
    [/\/admin\/resellers\/\$\{id\}`, \{ method: 'DELETE'/, /router\.delete\('\/:id',/]
  ];
  for (const [istemci, sunucu] of beklenen) {
    assert.match(apiJs, istemci, `api.js'te beklenen çağrı yok: ${istemci}`);
    assert.match(rota, sunucu, `sunucuda beklenen rota yok: ${sunucu}`);
  }
});

test('bayi vitrini Jet markası ve varlıkları içermez', () => {
  const vitrin = fs.readFileSync(path.join(kok, 'tenant', 'public', 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(kok, 'tenant', 'public', 'assets', 'storefront.js'), 'utf8');
  for (const kaynak of [vitrin, js]) {
    assert.doesNotMatch(kaynak, /SMMJET|jet ?smm|jetsmmpanel/i);
    assert.doesNotMatch(kaynak, /googletagmanager|gtag\(/i, 'bayi sitesine Jet analitiği girmiş');
  }
  assert.ok(vitrin.includes('%%SITE_NAME%%'), 'site adı yer tutucusu yok');
});
