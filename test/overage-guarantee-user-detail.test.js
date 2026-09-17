// 17 Eyl 2026 duzenlemeleri:
// 1) Servis bazli "fazla gonderim" yuzdesi: saglayiciya daha fazla gider,
//    musteri yalnizca istedigi miktari oder; kismi teslimde fazla pay once erir.
// 2) Garanti bilgisinin tek kaynagi admin secimi (refill); "Garantisiz" adli
//    servis vitrinde "Garantili" gorunmez.
// 3) Siparis formu ornek baglantisi servisin platformuna gore gelir.
// 4) Admin kullanici detay sayfasi ve son giris takibi.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-overage-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.ENABLE_DEMO_PAYMENTS = 'false';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');
const { providerQuantityFor, customerRemainsFrom } = require('../services/orderTypes');
const { detectRefillFromText, parseRefillFlag } = require('../utils/serviceFlags');
const { linkExamplesFor } = require('../utils/linkValidator');
const { applyProviderStatus } = require('../services/orderWorker');

const SmmProviderClient = require('../services/smmProvider');
let saglayiciyaGidenler = [];
SmmProviderClient.prototype.addOrder = async function (providerServiceId, link, quantity, options = {}) {
  saglayiciyaGidenler.push({ providerServiceId, link, quantity, options });
  return { order: 700000 + saglayiciyaGidenler.length };
};

let admin;
let musteri;
let musteriId;
let aboneServisId;
let saglayiciId;

test.before(async () => {
  await initDatabase();
  admin = request.agent(app);
  assert.equal((await admin.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' })).status, 200);
  assert.equal((await admin.post('/api/admin/change-password').send({ current_password: 'admin12345', new_password: 'YeniGuvenliSifre_2026' })).status, 200);
  assert.equal((await admin.post('/api/auth/login').send({ username: 'admin', password: 'YeniGuvenliSifre_2026' })).status, 200);

  musteri = request.agent(app);
  assert.equal((await musteri.post('/api/auth/register').send({ username: 'abone_musteri', email: 'abone@site.com', password: 'MusteriSifresi_2026' })).status, 201);
  const row = await dbAsync.get("SELECT id FROM users WHERE username = 'abone_musteri'");
  musteriId = row.id;
  await dbAsync.run('UPDATE users SET balance_kurus = 1000000, balance = 10000 WHERE id = ?', [musteriId]);
  assert.equal((await musteri.post('/api/auth/login').send({ username: 'abone_musteri', password: 'MusteriSifresi_2026' })).status, 200);

  saglayiciId = (await dbAsync.run(
    "INSERT INTO providers (name, api_url, api_key, status) VALUES ('Ana Saglayici', 'https://saglayici.example.com/api/v2', 'gizli', 1)"
  )).id;
});
test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

// --- 1) Fazla gonderim -------------------------------------------------------

test('fazla gönderim yüzdesi sağlayıcı miktarını tam sayı olarak artırır', () => {
  assert.equal(providerQuantityFor({ provider_overage_percent: 14 }, 400), 456);
  assert.equal(providerQuantityFor({ provider_overage_percent: 14 }, 250), 285);
  assert.equal(providerQuantityFor({ provider_overage_percent: 13.8 }, 100), 114);
  assert.equal(providerQuantityFor({ provider_overage_percent: 0 }, 400), 400);
  assert.equal(providerQuantityFor({ provider_overage_percent: null }, 400), 400);
  assert.equal(providerQuantityFor({ provider_overage_percent: -5 }, 400), 400);
  // Carpanla birlikte
  assert.equal(providerQuantityFor({ provider_quantity_multiplier: 1000, provider_overage_percent: 10 }, 2), 2200);
});

test('sağlayıcının "remains" değeri müşteri eksiğine çevrilirken fazla pay önce erir', () => {
  const siparis = { quantity: 400, provider_quantity: 456 };
  assert.equal(customerRemainsFrom(siparis, 40), 0, '456 gönderildi, 40 kaldı: müşteri 416 aldı, eksik yok');
  assert.equal(customerRemainsFrom(siparis, 56), 0);
  assert.equal(customerRemainsFrom(siparis, 100), 44);
  assert.equal(customerRemainsFrom(siparis, 456), 400, 'hiç teslim yoksa tüm sipariş eksik');
  assert.equal(customerRemainsFrom({ quantity: 400, provider_quantity: null }, 30), 30, 'eski sipariş: olduğu gibi');
  assert.equal(customerRemainsFrom({ quantity: 2, provider_quantity: 2000 }, 1500, 1000), 2);
  assert.equal(customerRemainsFrom({ quantity: 2, provider_quantity: 2000 }, 0, 1000), 0);
});

test('admin servis eklerken/düzenlerken fazla gönderim oranı kaydedilir ve müşteriye sızmaz', async () => {
  const created = await admin.post('/api/admin/services').send({
    category_name: 'YouTube Abone', category_name_en: 'YouTube Subscribers',
    name_tr: 'YouTube Abone | %100 Türk | Garantisiz', name_en: 'YouTube Subscribers | Turkish | No Refill',
    provider_id: saglayiciId, provider_service_id: '684',
    rate_per_1000: 199.19, rate_per_1000_usd: 5, min_quantity: 10, max_quantity: 10000,
    provider_overage_percent: 14, refill: 0
  });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  aboneServisId = created.body.service_id;

  let servis = (await admin.get('/api/admin/services')).body.services.find(s => s.id === aboneServisId);
  assert.equal(Number(servis.provider_overage_percent), 14);
  assert.equal(Number(servis.refill), 0, 'admin "Standart" seçti; ad "Garantisiz" içerse de garantili kaydedilmemeli');

  const updated = await admin.put(`/api/admin/services/${aboneServisId}`).send({ provider_overage_percent: 12.5 });
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  servis = (await admin.get('/api/admin/services')).body.services.find(s => s.id === aboneServisId);
  assert.equal(Number(servis.provider_overage_percent), 12.5);

  // Yalnizca durum degistiren guncelleme orani sifirlamaz.
  await admin.put(`/api/admin/services/${aboneServisId}`).send({ name: 'YouTube Abone | %100 Türk | Garantisiz', rate_per_1000: 199.19, min_quantity: 10, max_quantity: 10000, status: 1 });
  servis = (await admin.get('/api/admin/services')).body.services.find(s => s.id === aboneServisId);
  assert.equal(Number(servis.provider_overage_percent), 12.5);
  assert.equal(Number(servis.refill), 0);

  await admin.put(`/api/admin/services/${aboneServisId}`).send({ provider_overage_percent: 14 });
  assert.equal((await admin.put(`/api/admin/services/${aboneServisId}`).send({ provider_overage_percent: 900 })).status, 400);
  assert.equal((await admin.put(`/api/admin/services/${aboneServisId}`).send({ provider_overage_percent: -1 })).status, 400);

  // Public katalog orani ve carpani musteriye gostermez.
  const katalog = await request(app).get('/api/services');
  const publik = katalog.body.services.find(s => s.id === aboneServisId);
  assert.ok(publik, 'servis public katalogda yok');
  assert.equal(publik.provider_overage_percent, undefined, 'fazla gönderim oranı müşteriye sızdı');
});

test('sipariş: müşteri 400 öder, sağlayıcıya 456 gider; müşteri listesinde sağlayıcı miktarı görünmez', async () => {
  saglayiciyaGidenler = [];
  const once = (await dbAsync.get('SELECT balance_kurus FROM users WHERE id = ?', [musteriId])).balance_kurus;
  const res = await musteri.post('/api/orders').send({ service_id: aboneServisId, link: 'https://www.youtube.com/@kanaladi', quantity: 400 });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(saglayiciyaGidenler.length, 1);
  assert.equal(saglayiciyaGidenler[0].quantity, 456, 'sağlayıcıya fazla gönderim uygulanmalı');
  assert.equal(res.body.order.quantity, 400, 'müşteri kendi miktarını görür');

  const sonra = (await dbAsync.get('SELECT balance_kurus FROM users WHERE id = ?', [musteriId])).balance_kurus;
  assert.equal(once - sonra, Math.round(19919 * 400 / 1000), 'müşteri yalnızca 400 adet için ödemeli');

  const kayit = await dbAsync.get('SELECT * FROM orders WHERE id = ?', [res.body.order.id]);
  assert.equal(kayit.quantity, 400);
  assert.equal(kayit.provider_quantity, 456);

  const liste = await musteri.get('/api/orders');
  assert.equal(liste.status, 200);
  const benim = liste.body.orders.find(o => o.id === res.body.order.id);
  assert.ok(benim);
  assert.equal(benim.quantity, 400);
  assert.equal(benim.provider_quantity, undefined, 'sağlayıcıya giden miktar müşteri listesinde olmamalı');

  // Admin listesi ise saglayici miktarini gorur.
  const adminListe = await admin.get('/api/admin/orders');
  const adminKayit = adminListe.body.orders.find(o => o.id === res.body.order.id);
  assert.equal(adminKayit.provider_quantity, 456);

  // Kismi teslim: saglayici 456'dan 40 eksik birakti -> musteri eksigi 0, iade yok.
  await applyProviderStatus(res.body.order.id, { status: 'Partial', remains: '40', start_count: '10' });
  const kismi = await dbAsync.get('SELECT status, remains, refunded_kurus FROM orders WHERE id = ?', [res.body.order.id]);
  assert.equal(kismi.status, 'partial');
  assert.equal(kismi.remains, 0);
  assert.equal(kismi.refunded_kurus, 0, 'fazla pay eksiği karşıladı; iade olmamalı');
});

test('kısmi teslimde fazla payı aşan eksik müşteri birimiyle iade edilir', async () => {
  saglayiciyaGidenler = [];
  const res = await musteri.post('/api/orders').send({ service_id: aboneServisId, link: 'https://www.youtube.com/@kanaladi', quantity: 400 });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const once = (await dbAsync.get('SELECT balance_kurus FROM users WHERE id = ?', [musteriId])).balance_kurus;
  // 456 gonderildi, 156 kaldi -> 300 teslim -> musteri eksigi 100 -> ucretin 1/4'u iade
  await applyProviderStatus(res.body.order.id, { status: 'Partial', remains: '156' });
  const kayit = await dbAsync.get('SELECT status, remains, refunded_kurus, charge_kurus FROM orders WHERE id = ?', [res.body.order.id]);
  assert.equal(kayit.remains, 100);
  assert.equal(kayit.refunded_kurus, Math.round(kayit.charge_kurus * 100 / 400));
  const sonra = (await dbAsync.get('SELECT balance_kurus FROM users WHERE id = ?', [musteriId])).balance_kurus;
  assert.equal(sonra - once, kayit.refunded_kurus);
});

// --- 2) Garanti bayragi -----------------------------------------------------

test('addan garanti tahmini "Garantisiz" ve "No Refill" için yanlış pozitif vermez', () => {
  assert.equal(detectRefillFromText('YouTube Abone | %100 Türk | Garantisiz'), false);
  assert.equal(detectRefillFromText('TikTok Likes | No Refill'), false);
  assert.equal(detectRefillFromText('Instagram Takipçi | 30 Gün Garantili'), true);
  assert.equal(detectRefillFromText('IG Followers [Refill 30D]'), true);
  assert.equal(detectRefillFromText(''), false);
  assert.equal(parseRefillFlag('0'), 0);
  assert.equal(parseRefillFlag(true), 1);
  assert.equal(parseRefillFlag(undefined), null);
});

test('admin garanti seçimini değiştirince public katalog ve satış sayfası kaynağı aynı değeri döner', async () => {
  // Ad "garanti" iceriyor; admin Standart -> Garantili -> Standart yapiyor.
  await admin.put(`/api/admin/services/${aboneServisId}`).send({ refill: 1 });
  let publik = (await request(app).get('/api/services')).body.services.find(s => s.id === aboneServisId);
  assert.equal(Number(publik.refill), 1);
  await admin.put(`/api/admin/services/${aboneServisId}`).send({ refill: '0' });
  publik = (await request(app).get('/api/services')).body.services.find(s => s.id === aboneServisId);
  assert.equal(Number(publik.refill), 0);

  // Secim gonderilmezse addan tahmin: "Garantisiz" -> 0, "Garantili" -> 1.
  const tahmin = await admin.post('/api/admin/services').send({
    category_name: 'Instagram', name_tr: 'Instagram Takipçi | 30 Gün Garantili', rate_per_1000: 10, min_quantity: 10, max_quantity: 1000
  });
  assert.equal(tahmin.status, 200, JSON.stringify(tahmin.body));
  const tahminServis = (await admin.get('/api/admin/services')).body.services.find(s => s.id === tahmin.body.service_id);
  assert.equal(Number(tahminServis.refill), 1);
});

test('vitrin garanti rozetini yalnızca refill alanından okur (ad regex\'i kalktı)', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
  const lp = fs.readFileSync(path.join(__dirname, '..', 'utils', 'landingPages.js'), 'utf8');
  assert.match(js, /isServiceGuaranteed\(service\)\s*\{\s*return Number\(service\?\.refill\) === 1;/);
  assert.ok(!/s\.refill == 1 \|\| \/telafi\|garanti/.test(js), 'app.js hâlâ ada bakarak garantili gösteriyor');
  assert.match(lp, /function isGuaranteed\(s\)\s*\{\s*return Number\(s\.refill\) === 1;/);
});

// --- 3) Platforma gore ornek baglanti ---------------------------------------

test('public katalog her servise platformuna uygun örnek bağlantı ekler', async () => {
  const publik = (await request(app).get('/api/services')).body.services.find(s => s.id === aboneServisId);
  assert.equal(publik.link_platform, 'YouTube');
  assert.equal(publik.link_target, 'profile');
  assert.equal(publik.link_example_profile, 'https://www.youtube.com/@kanaladi');
  assert.match(publik.link_example_media, /youtube\.com\/watch/);

  assert.equal(linkExamplesFor({ name: 'TikTok Beğeni', category_name: 'TikTok' }).link_example_media, 'https://www.tiktok.com/@kullaniciadi/video/7300000000000000000');
  assert.equal(linkExamplesFor({ name: 'Instagram Story Views', category_name: 'Instagram' }).link_example_story, 'https://www.instagram.com/stories/kullaniciadi/123...');
  assert.equal(linkExamplesFor({ name: 'Bilinmeyen Servis', category_name: 'Genel' }).link_platform, null);

  const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
  assert.match(js, /serviceLinkExamples\(service\)/);
  assert.match(js, /link_example_profile/);
  const hintStart = js.indexOf('updateOrderLinkHint(service) {');
  const hintBody = js.slice(hintStart, js.indexOf('serviceLinkExamples(service) {', hintStart));
  assert.ok(!hintBody.includes("ipucu = 'https://instagram.com/kullaniciadi'"), 'ipucu hâlâ sabit Instagram örneği');
});

// --- 4) Kullanici detay sayfasi ---------------------------------------------

test('giriş yapınca son giriş / giriş sayısı kaydedilir', async () => {
  await musteri.post('/api/auth/login').send({ username: 'abone_musteri', password: 'MusteriSifresi_2026' });
  await new Promise(resolve => setTimeout(resolve, 50));
  const row = await dbAsync.get('SELECT last_login_at, login_count, last_seen_at FROM users WHERE id = ?', [musteriId]);
  assert.ok(row.last_login_at, 'last_login_at boş');
  assert.ok(row.login_count >= 2, `login_count: ${row.login_count}`);
  assert.ok(row.last_seen_at);
});

test('admin kullanıcı detayı: özet, siparişler, yüklemeler ve gizli alanlar', async () => {
  await dbAsync.run("INSERT INTO payments (user_id, amount, amount_kurus, method, status, transaction_id) VALUES (?, 250, 25000, 'PayTR', 'completed', 'TX-1')", [musteriId]);
  await dbAsync.run("INSERT INTO payments (user_id, amount, amount_kurus, method, status, transaction_id) VALUES (?, 25, 2500, 'Bonus (Kampanya)', 'completed', 'TX-2')", [musteriId]);
  await dbAsync.run("INSERT INTO payment_notifications (user_id, bank_name, amount, amount_kurus, sender_name, status) VALUES (?, 'Papara', 100, 10000, 'Abone Müşteri', 'pending')", [musteriId]);
  await dbAsync.run("INSERT INTO tickets (user_id, subject, status) VALUES (?, 'Siparişim eksik geldi', 'open')", [musteriId]);
  assert.equal((await admin.post(`/api/admin/users/${musteriId}/balance`).send({ amount: 10, action: 'add' })).status, 200);

  const res = await admin.get(`/api/admin/users/${musteriId}/detail`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const { user, stats } = res.body;
  assert.equal(user.username, 'abone_musteri');
  assert.equal(user.password, undefined, 'şifre hash\'i dönmemeli');
  assert.equal(user.api_key, undefined, 'API anahtarı dönmemeli');
  assert.equal(user.two_factor_secret, undefined);
  assert.equal(typeof user.has_api_key, 'boolean');
  assert.ok(user.last_login_at);
  assert.ok(user.login_count >= 2);

  assert.equal(stats.orders_total, 2);
  assert.equal(stats.deposits_total, 2);
  assert.equal(stats.deposited_real, 250);
  assert.equal(stats.deposited_bonus, 25);
  assert.equal(stats.tickets_open, 1);
  assert.ok(stats.spent > 0);

  assert.equal(res.body.orders.length, 2);
  assert.equal(res.body.orders[0].provider_quantity, 456);
  assert.ok(res.body.orders[0].service_name);
  assert.equal(res.body.payments.length, 2);
  assert.equal(res.body.payments.find(p => p.transaction_id === 'TX-1').method_group, 'paytr');
  assert.equal(res.body.payment_notifications.length, 1);
  assert.equal(res.body.tickets.length, 1);
  assert.ok(res.body.audit_logs.some(a => a.action === 'admin_balance_adjusted' && a.details?.amount_kurus === 1000));

  assert.equal((await admin.get('/api/admin/users/999999/detail')).status, 404);
  assert.equal((await admin.get('/api/admin/users/abc/detail')).status, 400);
  // Musteri kendi hesabiyla admin ucuna ulasamaz.
  assert.equal((await musteri.get(`/api/admin/users/${musteriId}/detail`)).status, 403);
});

test('arayüz: kullanıcı detayı tam sayfa görünüm ve fazla gönderim alanları bağlı', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
  const api = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'api.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'style.css'), 'utf8');

  // Detay sayfasi Kullanicilar sekmesinin icinde (yeni sekme degil): sekme
  // tutarlilik testleri bozulmaz, listeden tam sayfa gecis yapilir.
  const usersTab = html.slice(html.indexOf('id="admin-tab-users"'), html.indexOf('id="admin-tab-orders"'));
  assert.match(usersTab, /id="admin-users-list-view"/);
  assert.match(usersTab, /id="admin-user-detail-view"/);
  assert.match(usersTab, /id="admin-user-detail-content"/);
  assert.match(usersTab, /app\.showAdminUsersList\(\)/);
  assert.match(js, /openAdminUserDetail\(userId\)/);
  assert.match(js, /renderAdminUserDetailSection\(section, data\)/);
  assert.match(js, /tabName === 'users'\) \{ this\.showAdminUsersList\(\);/);
  assert.match(api, /getAdminUserDetail:/);
  assert.match(css, /\.user-detail-header/);

  for (const id of ['single-provider-overage', 'edit-service-provider-overage', 'single-overage-help', 'edit-overage-help']) {
    assert.ok(html.includes(`id="${id}"`), `${id} alanı yok`);
  }
  assert.match(js, /provider_overage_percent: document\.getElementById\('single-provider-overage'\)/);
  assert.match(js, /provider_overage_percent: document\.getElementById\('edit-service-provider-overage'\)/);
  assert.match(js, /providerQuantityNote\(o\)/);
});
