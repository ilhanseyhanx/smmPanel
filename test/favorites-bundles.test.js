// 27 Eyl 2026 duzenlemeleri:
// 1) Paket servisler: birden fazla servis tek urun olarak satilir; her bilesen
//    icin ayri siparis acilir, tek tahsilat yapilir, paylar orantili bolunur.
// 2) Siparis makinesi (ana sayfa + satis sayfasi) adet bazli fiyati 1000'e bolmez.
// 3) Admin hizli siparis (favori servis) adet bazli fiyati dogru hesaplar.
// 4) Admin kenar cubugu gruplu; "Favoriler & Paketler" sekmesi bagli.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-bundles-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.ENABLE_DEMO_PAYMENTS = 'false';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');
const { splitChargeKurus } = require('../services/bundles');

const SmmProviderClient = require('../services/smmProvider');
let gidenler = [];
let reddedilen = null; // saglayici servis no ya da 'all'
SmmProviderClient.prototype.addOrder = async function (providerServiceId, link, quantity, options = {}) {
  if (reddedilen === 'all' || String(providerServiceId) === String(reddedilen)) throw new Error('Not enough balance');
  gidenler.push({ providerServiceId: String(providerServiceId), link, quantity, options });
  return { order: 900000 + gidenler.length };
};

const kok = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(kok, 'public', 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(kok, 'public', 'js', 'app.js'), 'utf8');
const apiJs = fs.readFileSync(path.join(kok, 'public', 'js', 'api.js'), 'utf8');
const css = fs.readFileSync(path.join(kok, 'public', 'css', 'style.css'), 'utf8');

let admin;
let musteri;
let musteriId;
let saglayiciId;
let izlenmeId;
let begeniId;
let yorumId;
let paketId;

const LINK = 'https://www.youtube.com/watch?v=abc123xyz';
const bakiye = async () => (await dbAsync.get('SELECT balance_kurus FROM users WHERE id = ?', [musteriId])).balance_kurus;

async function servisEkle(veri) {
  const res = await admin.post('/api/admin/services').send({
    category_name: 'YouTube', category_name_en: 'YouTube', provider_id: saglayiciId, ...veri
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.service_id;
}

const paketVerisi = () => ({
  name_tr: 'YouTube Başlangıç Paketi', name_en: 'YouTube Starter Pack',
  category_name: 'Paketler', category_name_en: 'Bundles',
  price: 10, price_usd: 0.5, min_packages: 1, max_packages: 3,
  description_tr: 'İzlenme + beğeni tek pakette.',
  items: [{ service_id: izlenmeId, quantity: 1000 }, { service_id: begeniId, quantity: 100 }]
});

test.before(async () => {
  await initDatabase();
  admin = request.agent(app);
  assert.equal((await admin.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' })).status, 200);
  assert.equal((await admin.post('/api/admin/change-password').send({ current_password: 'admin12345', new_password: 'YeniGuvenliSifre_2026' })).status, 200);
  assert.equal((await admin.post('/api/auth/login').send({ username: 'admin', password: 'YeniGuvenliSifre_2026' })).status, 200);

  musteri = request.agent(app);
  assert.equal((await musteri.post('/api/auth/register').send({ username: 'paket_musteri', email: 'paket@site.com', password: 'MusteriSifresi_2026' })).status, 201);
  musteriId = (await dbAsync.get("SELECT id FROM users WHERE username = 'paket_musteri'")).id;
  await dbAsync.run('UPDATE users SET balance_kurus = 100000, balance = 1000 WHERE id = ?', [musteriId]);
  assert.equal((await musteri.post('/api/auth/login').send({ username: 'paket_musteri', password: 'MusteriSifresi_2026' })).status, 200);

  saglayiciId = (await dbAsync.run(
    "INSERT INTO providers (name, api_url, api_key, status) VALUES ('Paket Saglayici', 'https://saglayici.example.com/api/v2', 'gizli', 1)"
  )).id;
  izlenmeId = await servisEkle({ name_tr: 'YouTube İzlenme', name_en: 'YouTube Views', rate_per_1000: 20, min_quantity: 100, max_quantity: 100000, provider_service_id: 501, refill: 1 });
  begeniId = await servisEkle({ name_tr: 'YouTube Beğeni', name_en: 'YouTube Likes', rate_per_1000: 50, min_quantity: 10, max_quantity: 5000, provider_service_id: 502, refill: 0 });
  yorumId = await servisEkle({ name_tr: 'YouTube Özel Yorum', name_en: 'YouTube Custom Comments', rate_per_1000: 300, min_quantity: 5, max_quantity: 1000, provider_service_id: 503, order_input_type: 'custom_comments' });
});
test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

// --- Veritabani -------------------------------------------------------------

test('göç: is_bundle sütunu, paket içerik tablosu ve sipariş grup sütunları var', async () => {
  const servisSutunlari = (await dbAsync.all('PRAGMA table_info(services)')).map(c => c.name);
  assert.ok(servisSutunlari.includes('is_bundle'));
  const siparisSutunlari = (await dbAsync.all('PRAGMA table_info(orders)')).map(c => c.name);
  assert.ok(siparisSutunlari.includes('bundle_service_id'));
  assert.ok(siparisSutunlari.includes('bundle_group'));
  assert.ok(await dbAsync.get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'service_bundle_items'"));
});

test('paket tutarı bileşenlere orantılı bölünür ve kuruşu kuruşuna toplanır', () => {
  const items = [
    { quantity: 1000, rate_per_1000_kurus: 2000, pricing_model: 'per_1000' }, // 2000 kurus deger
    { quantity: 100, rate_per_1000_kurus: 5000, pricing_model: 'per_1000' }   // 500 kurus deger
  ];
  assert.deepEqual(splitChargeKurus(1000, items, 1), [800, 200]);
  assert.deepEqual(splitChargeKurus(999, items, 1), [799, 200]);
  // Degeri olmayan bilesenler esit bolunur.
  assert.deepEqual(splitChargeKurus(1001, [{ quantity: 1 }, { quantity: 1 }, { quantity: 1 }], 1), [333, 333, 335]);
});

// --- Admin: paket olusturma ---------------------------------------------------

test('paket doğrulaması: tek bileşen, yorum servisi, tekrar ve limit dışı adet reddedilir', async () => {
  const temel = { name_tr: 'Hatalı Paket', category_name: 'Paketler', price: 100 };
  const tek = await admin.post('/api/admin/bundles').send({ ...temel, items: [{ service_id: izlenmeId, quantity: 1000 }] });
  assert.equal(tek.status, 400);

  const yorum = await admin.post('/api/admin/bundles').send({ ...temel, items: [{ service_id: izlenmeId, quantity: 1000 }, { service_id: yorumId, quantity: 10 }] });
  assert.equal(yorum.status, 400);
  assert.match(yorum.body.error, /bağlantı ile sipariş/);

  const tekrar = await admin.post('/api/admin/bundles').send({ ...temel, items: [{ service_id: izlenmeId, quantity: 1000 }, { service_id: izlenmeId, quantity: 500 }] });
  assert.equal(tekrar.status, 400);
  assert.match(tekrar.body.error, /iki kez/);

  const limit = await admin.post('/api/admin/bundles').send({ ...temel, items: [{ service_id: izlenmeId, quantity: 1000 }, { service_id: begeniId, quantity: 5 }] });
  assert.equal(limit.status, 400);
  assert.match(limit.body.error, /arasında/);
});

test('paket oluşturulur; public katalogda adet bazlı ve içeriğiyle görünür, başlangıç fiyatını etkilemez', async () => {
  const res = await admin.post('/api/admin/bundles').send(paketVerisi());
  assert.equal(res.status, 201, JSON.stringify(res.body));
  paketId = res.body.bundle_id;

  const liste = await admin.get('/api/admin/bundles');
  assert.equal(liste.status, 200);
  const paket = liste.body.bundles.find(b => b.id === paketId);
  assert.ok(paket, 'paket admin listesinde yok');
  assert.equal(paket.items.length, 2);
  assert.equal(paket.price, 10);
  assert.equal(paket.standalone_value, 25); // 1000 x ₺20/1000 + 100 x ₺50/1000
  assert.equal(Number(paket.refill), 0, 'bileşenlerden biri garantisizken paket otomatik standart olmalı');
  assert.deepEqual(paket.warnings, []);

  const pub = await request(app).get('/api/services');
  assert.equal(pub.status, 200);
  const vitrin = pub.body.services.find(s => s.id === paketId);
  assert.ok(vitrin, 'paket public katalogda yok');
  assert.equal(Number(vitrin.is_bundle), 1);
  assert.equal(vitrin.pricing_model, 'per_item');
  assert.equal(Number(vitrin.rate_per_1000), 10);
  assert.deepEqual(vitrin.bundle_items.map(i => [i.service_id, i.quantity]), [[izlenmeId, 1000], [begeniId, 100]]);
  // "Baslayan fiyatlar" paketin 10 TL'sini degil en ucuz normal servisi (20 TL) gosterir.
  assert.equal(pub.body.stats.min_rate_kurus, 2000);
  // Normal servislerde icerik alani yoktur.
  assert.equal(pub.body.services.find(s => s.id === izlenmeId).bundle_items, undefined);
});

// --- Musteri: paket siparisi ----------------------------------------------------

test('müşteri paketi alır: tek tahsilat, her bileşene ayrı sipariş, aynı grup, sağlayıcıya ayrı ayrı gider', async () => {
  gidenler = [];
  const once = await bakiye();
  const res = await musteri.post('/api/orders').send({ service_id: paketId, link: LINK, quantity: 2 });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.order.charge, 20);
  assert.equal(res.body.order.bundle.orders.length, 2);
  assert.equal(res.body.order.bundle.failed.length, 0);
  assert.equal(once - (await bakiye()), 2000);

  const satirlar = await dbAsync.all('SELECT * FROM orders WHERE bundle_service_id = ? ORDER BY id', [paketId]);
  assert.equal(satirlar.length, 2);
  assert.equal(satirlar[0].bundle_group, satirlar[1].bundle_group);
  assert.ok(satirlar[0].bundle_group);
  assert.deepEqual(
    satirlar.map(r => [r.service_id, r.quantity, r.charge_kurus, r.status]),
    [[izlenmeId, 2000, 1600, 'processing'], [begeniId, 200, 400, 'processing']]
  );
  assert.deepEqual(gidenler.map(g => [g.providerServiceId, g.quantity, g.link]), [['501', 2000, LINK], ['502', 200, LINK]]);

  const benim = await musteri.get('/api/orders');
  const paketSiparisleri = benim.body.orders.filter(o => o.bundle_service_id === paketId);
  assert.equal(paketSiparisleri.length, 2);
  assert.equal(paketSiparisleri[0].bundle_name, 'YouTube Başlangıç Paketi');

  const adminListe = await admin.get('/api/admin/orders');
  assert.ok(adminListe.body.orders.some(o => o.bundle_name === 'YouTube Başlangıç Paketi'), 'admin listesinde paket adı yok');

  const adminPaketler = await admin.get('/api/admin/bundles');
  assert.equal(adminPaketler.body.bundles.find(b => b.id === paketId).order_count, 1, 'iki bileşen tek paket siparişi sayılmalı');
});

test('paket adedi sınırı ve kademeli gönderim reddedilir; bakiye düşmez', async () => {
  const once = await bakiye();
  const fazla = await musteri.post('/api/orders').send({ service_id: paketId, link: LINK, quantity: 4 });
  assert.equal(fazla.status, 400);
  assert.match(fazla.body.error, /1 ile 3/);
  const drip = await musteri.post('/api/orders').send({ service_id: paketId, link: LINK, quantity: 1, drip_runs: 2, drip_interval_minutes: 10 });
  assert.equal(drip.status, 400);
  assert.equal(await bakiye(), once);
});

test('paket bağlantısı her bileşen için doğrulanır (YouTube paketine Instagram linki verilemez)', async () => {
  const once = await bakiye();
  const res = await musteri.post('/api/orders').send({ service_id: paketId, link: 'https://www.instagram.com/p/abc123/', quantity: 1 });
  assert.equal(res.status, 400);
  assert.equal(await bakiye(), once);
});

test('bileşen sağlayıcıda reddedilirse yalnızca onun payı iade edilir, diğeri devam eder', async () => {
  reddedilen = '502';
  gidenler = [];
  const once = await bakiye();
  const res = await musteri.post('/api/orders').send({ service_id: paketId, link: LINK, quantity: 1 });
  reddedilen = null;
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.match(res.body.message, /iade/);
  assert.equal(res.body.order.bundle.failed.length, 1);
  assert.equal(res.body.order.charge, 8);
  assert.equal(once - (await bakiye()), 800);
  const grup = res.body.order.bundle.group;
  const satirlar = await dbAsync.all('SELECT service_id, status, charge_kurus, refunded_kurus FROM orders WHERE bundle_group = ? ORDER BY id', [grup]);
  assert.deepEqual(satirlar, [
    { service_id: izlenmeId, status: 'processing', charge_kurus: 800, refunded_kurus: 0 },
    { service_id: begeniId, status: 'failed', charge_kurus: 200, refunded_kurus: 200 }
  ]);
});

test('tüm bileşenler reddedilirse sipariş alınamaz ve tamamı iade edilir', async () => {
  reddedilen = 'all';
  const once = await bakiye();
  const res = await musteri.post('/api/orders').send({ service_id: paketId, link: LINK, quantity: 1 });
  reddedilen = null;
  assert.equal(res.status, 502);
  assert.match(res.body.error, /iade/);
  assert.equal(await bakiye(), once);
});

test('pasif bileşen paketi geçici olarak sipariş dışı bırakır; admin listesi uyarır', async () => {
  assert.equal((await admin.put(`/api/admin/services/${begeniId}`).send({ status: 0 })).status, 200);
  const once = await bakiye();
  const res = await musteri.post('/api/orders').send({ service_id: paketId, link: LINK, quantity: 1 });
  assert.equal(res.status, 409);
  assert.match(res.body.error, /aktif değil/);
  assert.equal(await bakiye(), once);
  const liste = await admin.get('/api/admin/bundles');
  const paket = liste.body.bundles.find(b => b.id === paketId);
  assert.ok(paket.warnings.some(w => /pasif/.test(w)), 'pasif bileşen uyarısı yok');
  assert.equal((await admin.put(`/api/admin/services/${begeniId}`).send({ status: 1 })).status, 200);
});

test('bayi kanalı paketi göstermez ve sipariş edemez', async () => {
  const { placeOrder } = require('../services/placeOrder');
  const user = await dbAsync.get('SELECT * FROM users WHERE id = ?', [musteriId]);
  await assert.rejects(
    placeOrder({ user, serviceId: paketId, link: LINK, quantity: 1, tenant: { id: 1, customerId: 1, sellRateKurus: 1000, discountPercent: 0 } }),
    /bayi/
  );
  const v2 = await request(app).post('/api/v2').send({ key: user.api_key, action: 'services' });
  assert.equal(v2.status, 200);
  assert.ok(Array.isArray(v2.body));
  assert.ok(!v2.body.some(s => s.service === paketId), 'paket API v2 listesinde görünmemeli');
  assert.ok(v2.body.some(s => s.service === izlenmeId), 'normal servis API v2 listesinde olmalı');
});

// --- Admin: guncelleme / silme ----------------------------------------------------

test('paket güncellenir (içerik ve fiyat) ve sipariş geçmişi olan paket silinince pasife alınır', async () => {
  const guncel = await admin.put(`/api/admin/bundles/${paketId}`).send({
    ...paketVerisi(), price: 12,
    items: [{ service_id: izlenmeId, quantity: 500 }, { service_id: begeniId, quantity: 50 }]
  });
  assert.equal(guncel.status, 200, JSON.stringify(guncel.body));
  const tek = await admin.get(`/api/admin/bundles/${paketId}`);
  assert.equal(tek.body.bundle.price, 12);
  assert.deepEqual(tek.body.bundle.items.map(i => i.quantity), [500, 50]);

  const sil = await admin.delete(`/api/admin/bundles/${paketId}`);
  assert.equal(sil.status, 200);
  assert.match(sil.body.message, /pasife/);
  assert.equal((await dbAsync.get('SELECT status FROM services WHERE id = ?', [paketId])).status, 0);
  // Gecmis korunur: bilesen siparisleri paket adini hala tasir.
  const benim = await musteri.get('/api/orders');
  assert.ok(benim.body.orders.some(o => o.bundle_name === 'YouTube Başlangıç Paketi'));
});

test('bileşen olarak kullanılan servis silinmez, pasife alınır; siparişsiz paket gerçekten silinir', async () => {
  const aId = await servisEkle({ name_tr: 'TikTok İzlenme', name_en: 'TikTok Views', rate_per_1000: 5, min_quantity: 100, max_quantity: 100000, provider_service_id: 601 });
  const bId = await servisEkle({ name_tr: 'TikTok Beğeni', name_en: 'TikTok Likes', rate_per_1000: 30, min_quantity: 10, max_quantity: 10000, provider_service_id: 602 });
  const olustur = await admin.post('/api/admin/bundles').send({
    name_tr: 'TikTok Paketi', category_name: 'Paketler', price: 20,
    items: [{ service_id: aId, quantity: 1000 }, { service_id: bId, quantity: 100 }]
  });
  assert.equal(olustur.status, 201, JSON.stringify(olustur.body));
  const tiktokPaketId = olustur.body.bundle_id;

  const silA = await admin.delete(`/api/admin/services/${aId}`);
  assert.equal(silA.status, 200);
  const a = await dbAsync.get('SELECT status FROM services WHERE id = ?', [aId]);
  assert.ok(a, 'bileşen servis gerçekten silinmemeli (paket içeriği ona bağlı)');
  assert.equal(a.status, 0);

  const silPaket = await admin.delete(`/api/admin/bundles/${tiktokPaketId}`);
  assert.equal(silPaket.status, 200);
  assert.match(silPaket.body.message, /silindi/);
  assert.equal(await dbAsync.get('SELECT id FROM services WHERE id = ?', [tiktokPaketId]), undefined);
  assert.equal((await dbAsync.get('SELECT COUNT(*) c FROM service_bundle_items WHERE bundle_service_id = ?', [tiktokPaketId])).c, 0);
});

// --- Admin: hizli siparis (favori servis) ------------------------------------------

test('admin hızlı sipariş adet bazlı fiyatı 1000\'e bölmez ve paket atayamaz', async () => {
  gidenler = [];
  const aboneId = await servisEkle({
    category_name: 'Abonelikler', name_tr: 'Premium Abonelik 1 Ay', name_en: 'Premium 1 Month',
    rate_per_1000: 150, min_quantity: 1, max_quantity: 5, provider_service_id: 701, pricing_model: 'per_item'
  });
  const once = await bakiye();
  const res = await admin.post(`/api/admin/users/${musteriId}/assign-order`).send({ service_id: aboneId, link: 'https://instagram.com/testhesap', quantity: 2, charge_user: true });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(once - (await bakiye()), 30000, '2 adet x ₺150 = ₺300 düşmeli');
  assert.equal(gidenler.length, 1);

  const paketRes = await admin.post('/api/admin/bundles').send(paketVerisi());
  assert.equal(paketRes.status, 201);
  const atama = await admin.post(`/api/admin/users/${musteriId}/assign-order`).send({ service_id: paketRes.body.bundle_id, link: LINK, quantity: 1, charge_user: false });
  assert.equal(atama.status, 400);
  assert.match(atama.body.error, /Paket/);
});

// --- Arayuz (statik) -------------------------------------------------------------

test('sipariş makineleri adet bazlı fiyatı 1000\'e bölmez', () => {
  const makine = appJs.slice(appJs.indexOf('updateMachinePrice() {'), appJs.indexOf('async submitMachineOrder('));
  assert.match(makine, /pricing_model === 'per_item'/, 'ana sayfa makinesi adet bazlı fiyatı tanımıyor');
  const satis = appJs.slice(appJs.indexOf('updateLpPrice() {'), appJs.indexOf('async submitLpOrder('));
  assert.match(satis, /pricing_model === 'per_item'/, 'satış sayfası makinesi adet bazlı fiyatı tanımıyor');
  // SSR fiyat metni de birimi soyler.
  const ssr = fs.readFileSync(path.join(kok, 'utils', 'landingPages.js'), 'utf8');
  assert.match(ssr, /per_item/, 'satış sayfası SSR fiyatında adet birimi yok');
});

test('admin kenar çubuğu gruplu; Favoriler & Paketler sekmesi her yerde bağlı', () => {
  for (const key of ['operations', 'finance', 'customers', 'content', 'monitoring', 'system']) {
    assert.ok(html.includes(`data-nav-group="${key}"`), `menü grubu yok: ${key}`);
  }
  assert.ok(html.includes('class="admin-nav-toggle"'), 'grup başlığı düğmesi yok');
  assert.ok(html.includes('data-admin-tab="favorites"'), 'menü düğmesi yok');
  assert.ok(html.includes('id="admin-tab-favorites"'), 'panel yok');
  assert.ok(/<optgroup label="/.test(html), 'mobil menü grupsuz');
  assert.ok(appJs.includes("tabName === 'favorites'"), 'sekme açılınca veri yüklenmiyor');
  for (const fn of ['loadAdminFavoritesTab', 'syncAdminNavGroups', 'toggleAdminNavGroup', 'openQuickOrder', 'openBundleEditor', 'saveBundle']) {
    assert.ok(appJs.includes(`${fn}(`), `app.js'te ${fn} yok`);
  }
  for (const fn of ['getAdminBundles', 'createAdminBundle', 'updateAdminBundle', 'setAdminBundleStatus', 'deleteAdminBundle']) {
    assert.ok(apiJs.includes(`${fn}:`), `api.js'te ${fn} yok`);
  }
  for (const id of ['modal-add-favorite', 'modal-quick-order', 'modal-admin-service-info', 'modal-bundle-editor', 'admin-favorites-grid', 'admin-bundles-tbody']) {
    assert.ok(html.includes(`id="${id}"`), `${id} alanı eksik`);
  }
});

test('mobilde hizmet adı bloğu geniş ve 3 satıra sarar', () => {
  const mobil = css.slice(css.indexOf('@media (max-width: 900px)'), css.indexOf('@media (max-width: 900px)') + 6000);
  assert.match(mobil, /\.service-name-clamp \{[^}]*width: min\(76vw, 560px\)/, 'ad bloğu genişliği yok');
  assert.match(mobil, /-webkit-line-clamp: 3/, '3 satır sınırı yok');
  assert.ok(!/min-width: 440px/.test(mobil), 'eski hücre min-width kuralı geri gelmiş');
});
