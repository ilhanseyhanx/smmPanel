const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const kok = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(kok, 'public', 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(kok, 'public', 'js', 'app.js'), 'utf8');
const api = fs.readFileSync(path.join(kok, 'public', 'js', 'api.js'), 'utf8');
const adminRoute = fs.readFileSync(path.join(kok, 'routes', 'admin.js'), 'utf8');

// Sinif metotlari + constructor'da atanan fonksiyon ozellikleri
// (this.debouncedX = this.debounce(...) gibi tanimlar da cagrilabilir).
function appMetotlari() {
  const set = new Set();
  for (const m of js.matchAll(/^\s{2}(?:async\s+)?(?:get\s+)?([A-Za-z_$][\w$]*)\s*\(/gm)) set.add(m[1]);
  for (const m of js.matchAll(/this\.([A-Za-z_$][\w$]*)\s*=/g)) set.add(m[1]);
  return set;
}

// index.html icindeki onclick="app.X(...)" cagrilari
function htmldeCagrilanlar() {
  const set = new Set();
  for (const m of html.matchAll(/\bapp\.([A-Za-z_$][\w$]*)\s*\(/g)) set.add(m[1]);
  return set;
}

test('HTML içinde çağrılan her app fonksiyonu gerçekten tanımlı', () => {
  const tanimli = appMetotlari();
  const cagrilan = htmldeCagrilanlar();
  const eksik = [...cagrilan].filter(ad => !tanimli.has(ad));
  assert.deepEqual(eksik, [], `HTML bu fonksiyonları çağırıyor ama app.js'te yok: ${eksik.join(', ')}`);
});

// Asil hata bu yondeydi: sunucuda uc, app.js'te fonksiyon vardi ama
// index.html'de dugme YOKTU. Ozellik aylarca calistirilamadi ve
// "Tedarikciye Giden Para" hep 0 gorundu.
test('sağlayıcı maliyetlerini güncelleme düğmesi panelde vardır', () => {
  assert.ok(html.includes('id="refresh-provider-prices-btn"'),
    'Maliyet güncelleme düğmesi index.html\'de yok — özellik çalıştırılamaz');
  assert.ok(html.includes('app.refreshAdminProviderPrices()'),
    'Düğme fonksiyonu çağırmıyor');
  assert.match(js, /async refreshAdminProviderPrices\(\)/, 'fonksiyon app.js\'te yok');
  assert.match(api, /refreshAdminProviderPrices:/, 'API çağrısı api.js\'te yok');
  assert.match(adminRoute, /router\.post\('\/services\/refresh-provider-prices'/, 'sunucu ucu yok');
});

test('maliyet güncellendikten sonra kâr özeti de tazelenir', () => {
  const bas = js.indexOf('async refreshAdminProviderPrices()');
  const govde = js.slice(bas, js.indexOf('async openProviderPriceAudit', bas));
  assert.match(govde, /loadAdminStats/,
    'maliyet güncellenince kâr/zarar özeti yenilenmiyor, admin eski rakamı görür');
});

test('app.js içindeki düğme kimlikleri HTML\'de karşılığını bulur', () => {
  // getElementById('...-btn') ile aranan dugmeler gercekten sayfada olmali;
  // yoksa fonksiyon calissa bile kullanici erisemez.
  const aranan = new Set();
  for (const m of js.matchAll(/getElementById\('([\w-]*-btn)'\)/g)) aranan.add(m[1]);
  // JS'in kendi olusturdugu dugmeler (btn.id = '...') HTML'de aranmaz.
  const dinamik = new Set();
  for (const m of js.matchAll(/\.id\s*=\s*'([\w-]+)'/g)) dinamik.add(m[1]);
  const eksik = [...aranan].filter(id => !dinamik.has(id) && !html.includes(`id="${id}"`));
  assert.deepEqual(eksik, [], `app.js bu düğmeleri arıyor ama HTML'de yok: ${eksik.join(', ')}`);
});

test('sunucu, maliyeti kataloğa göre yazan güncelleme mantığını içerir', () => {
  const bas = adminRoute.indexOf("router.post('/services/refresh-provider-prices'");
  const govde = adminRoute.slice(bas, bas + 1600);
  assert.match(govde, /provider_cost_rate = \?/, 'maliyet alanı yazılmıyor');
  assert.match(govde, /provider_cost_currency = \?/, 'para birimi yazılmıyor');
  assert.match(govde, /provider_cost_updated_at = CURRENT_TIMESTAMP/, 'güncelleme tarihi yazılmıyor');
  // Satis fiyatina dokunmamali: yanlislikla musteri fiyatlarini ezmesin
  assert.ok(!/rate_per_1000\s*=\s*\?/.test(govde),
    'maliyet güncellemesi satış fiyatını da değiştiriyor — müşteri fiyatları ezilir');
});

test('kâr/zarar sorgusu maliyeti olmayan servisleri hesaba katmaz', () => {
  assert.match(adminRoute, /AND s\.provider_cost_rate > 0/,
    'maliyeti girilmemiş servisler kâr hesabına sıfır maliyetle giriyor olabilir');
});
