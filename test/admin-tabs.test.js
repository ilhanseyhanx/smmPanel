const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');

const benzersiz = (dizi) => [...new Set(dizi)].sort();
const bul = (kaynak, kalip) => benzersiz([...kaynak.matchAll(kalip)].map(m => m[1]));

const panelSekmeleri = bul(html, /id="admin-tab-([a-z-]+)"/g);
const menuDugmeleri = bul(html, /data-admin-tab="([a-z-]+)"/g);

// admin-mobile-nav select'i icindeki secenekler
const mobilBlok = /<select[^>]*admin-mobile-nav[\s\S]*?<\/select>/.exec(html);
const mobilSecenekler = mobilBlok ? bul(mobilBlok[0], /value="([a-z-]+)"/g) : [];

test('her yan menü düğmesinin karşılığı bir panel vardır', () => {
  const eksik = menuDugmeleri.filter(t => !panelSekmeleri.includes(t));
  assert.deepEqual(eksik, [], `bu sekmelerin paneli yok: ${eksik.join(', ')}`);
});

test('her panelin yan menüde bir düğmesi vardır', () => {
  const eksik = panelSekmeleri.filter(t => !menuDugmeleri.includes(t));
  assert.deepEqual(eksik, [], `bu panellerin menü düğmesi yok: ${eksik.join(', ')}`);
});

test('mobil menü tüm sekmeleri içerir', () => {
  const eksik = panelSekmeleri.filter(t => !mobilSecenekler.includes(t));
  assert.deepEqual(eksik, [], `mobil menüde eksik sekmeler: ${eksik.join(', ')}`);
});

// Asil hata buydu: sekme listesi app.js icinde elle yazilmisti ve yeni eklenen
// "statistics" orada olmadigi icin panel hic gosterilmiyor, ekran bos kaliyordu.
test('sekme gösterme mantığı elle yazılmış listeye dayanmaz', () => {
  assert.ok(
    appJs.includes('[id^="admin-tab-"]'),
    'switchAdminTab sekmeleri DOM\'dan okumalı; elle yazılan liste yeni sekme eklendiğinde beyaz ekrana yol açıyor'
  );

  // Eski hatali kalip geri gelmesin
  const elleYazilmisListe = /\[\s*'dashboard',\s*'providers',\s*'services'/.test(appJs);
  assert.equal(elleYazilmisListe, false, 'elle yazılmış sekme listesi geri gelmiş');
});

test('İstatistik sekmesi eksiksiz bağlanmış', () => {
  assert.ok(panelSekmeleri.includes('statistics'), 'istatistik paneli yok');
  assert.ok(menuDugmeleri.includes('statistics'), 'istatistik menü düğmesi yok');
  assert.ok(mobilSecenekler.includes('statistics'), 'istatistik mobil menüde yok');
  assert.ok(appJs.includes("tabName === 'statistics'"), 'sekme açılınca veri yüklenmiyor');
  assert.ok(appJs.includes('loadAdminStatistics'), 'yükleme fonksiyonu tanımlı değil');
});

test('İstatistik panelinin tüm alanları HTML\'de mevcut', () => {
  for (const id of ['stat-visitors-daily', 'stat-visitors-weekly', 'stat-visitors-monthly',
    'stat-visitors-total', 'stat-services-tbody', 'stat-blog-tbody',
    'stat-services-summary', 'stat-blog-summary']) {
    assert.ok(html.includes(`id="${id}"`), `${id} alanı eksik`);
  }
});
