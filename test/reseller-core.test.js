// Bayi (child panel) Faz 1: basvuru sarti, alan adina gore bayi sitesi,
// musteri oturum ayrimi, fiyat zinciri, iki katmanli bakiye, iade zinciri,
// admin Bayiler bolumu.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-bayi-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.ENABLE_DEMO_PAYMENTS = 'false';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';
process.env.TENANT_BASE_DOMAIN = 'bayi.test';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');
const { applyProviderStatus } = require('../services/orderWorker');

const SIFRE = 'BayiTestSifresi_2026';
const ADMIN_SIFRE = 'BayiAdminSifresi_2026';
const HOST = 'kanka.bayi.test';
let admin;
let sahipId;
let tenantId;
let servisId;
let pahaliServisId;
let saglayiciId;

const SmmProviderClient = require('../services/smmProvider');
let saglayiciKabul = true;
let saglayiciNo = 400000;
const giden = [];
SmmProviderClient.prototype.addOrder = async function (serviceId, link, quantity) {
  giden.push({ serviceId, link, quantity });
  if (!saglayiciKabul) return { error: 'Provider rejected' };
  saglayiciNo += 1;
  return { order: saglayiciNo };
};
SmmProviderClient.prototype.requestRefill = async () => ({ refill: 77 });

const kurus = async (sql, params) => (await dbAsync.get(sql, params));
const sahipBakiye = async () => (await kurus('SELECT balance_kurus FROM users WHERE id = ?', [sahipId])).balance_kurus;
const musteriBakiye = async id => (await kurus('SELECT balance_kurus FROM tenant_customers WHERE id = ?', [id])).balance_kurus;

function vitrin(host = HOST) {
  const agent = request.agent(app);
  const wrap = method => (url) => agent[method](url).set('Host', host);
  return { get: wrap('get'), post: wrap('post'), agent };
}

async function jetKullanici(username) {
  await request(app).post('/api/auth/register').send({ username, email: `${username}@site.com`, password: SIFRE });
  return dbAsync.get('SELECT id FROM users WHERE username = ?', [username]);
}

async function musteriOlustur(site, username, bakiyeKurus = 0) {
  const res = await site.post('/api/auth/register').send({ username, email: `${username}@musteri.com`, password: SIFRE });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  if (bakiyeKurus) await dbAsync.run('UPDATE tenant_customers SET balance_kurus = ? WHERE id = ?', [bakiyeKurus, res.body.customer.id]);
  return res.body.customer.id;
}

test.before(async () => {
  await initDatabase();
  const ilk = request.agent(app);
  await ilk.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  await ilk.post('/api/admin/change-password').send({ current_password: 'admin12345', new_password: ADMIN_SIFRE });
  admin = request.agent(app);
  assert.equal((await admin.post('/api/auth/login').send({ username: 'admin', password: ADMIN_SIFRE })).status, 200);

  saglayiciId = (await dbAsync.run(
    "INSERT INTO providers (name, api_url, api_key, status) VALUES ('Bayi Test Saglayici', 'https://saglayici.example.com/api/v2', 'gizli', 1)"
  )).id;
  const kategori = (await dbAsync.run(
    "INSERT INTO categories (name, name_tr, name_en) VALUES ('Bayi Test Instagram', 'Bayi Test Instagram', 'Reseller Test Instagram')"
  )).id;
  // 1000 adet = 10,00 TL (1000 kurus)
  servisId = (await dbAsync.run(
    `INSERT INTO services (category_id, provider_id, provider_service_id, name, name_tr, rate_per_1000, rate_per_1000_kurus,
       min_quantity, max_quantity, status, refill)
     VALUES (?, ?, '5001', 'Instagram Takipçi', 'Instagram Takipçi', 10, 1000, 100, 100000, 1, 1)`,
    [kategori, saglayiciId]
  )).id;
  pahaliServisId = (await dbAsync.run(
    `INSERT INTO services (category_id, provider_id, provider_service_id, name, name_tr, rate_per_1000, rate_per_1000_kurus,
       min_quantity, max_quantity, status)
     VALUES (?, ?, '5002', 'Instagram Takipçi Premium', 'Instagram Takipçi Premium', 50, 5000, 100, 100000, 1)`,
    [kategori, saglayiciId]
  )).id;
});

test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test.beforeEach(() => { giden.length = 0; saglayiciKabul = true; });

// ---------------------------------------------------------------------------
// Ayarlar ve basvuru
// ---------------------------------------------------------------------------

test('varsayılan bayilik ayarları: sayfa kapalı, %10 indirim, 500 TL açılış şartı, %30 kâr', async () => {
  const res = await admin.get('/api/admin/resellers/settings');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.settings, {
    public_page_enabled: false, discount_percent: 10, min_deposit_tl: 500, applications_open: true, default_markup_percent: 30
  });
});

test('bayilik sayfası kapalıyken sitede görünmez, başvuru alınmaz; admin elle açabilir', async () => {
  const program = await request(app).get('/api/reseller/program');
  assert.deepEqual(program.body, { enabled: false }, 'kapalı program dışarıya bilgi veriyor');
  const kullanici = await jetKullanici('erken_basvuran');
  await dbAsync.run(
    "INSERT INTO payments (user_id, amount, amount_kurus, method, status, transaction_id) VALUES (?, 900, 90000, 'PayTR', 'completed', 'E1')",
    [kullanici.id]
  );
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'erken_basvuran', password: SIFRE });
  const basvuru = await agent.post('/api/reseller/apply').send({ name: 'Erken Panel', slug: 'erken' });
  assert.equal(basvuru.status, 404);
  assert.equal(basvuru.body.code, 'PROGRAM_CLOSED');
  assert.equal((await agent.get('/api/reseller/me')).status, 404);

  // Admin elle acar; sahibi artik durumunu gorebilir.
  const elle = await admin.post('/api/admin/resellers').send({ owner: 'erken_basvuran', name: 'Erken Panel', slug: 'erken' });
  assert.equal(elle.status, 201, JSON.stringify(elle.body));
  const durum = await agent.get('/api/reseller/me');
  assert.equal(durum.status, 200);
  assert.equal(durum.body.tenant.slug, 'erken');
  assert.equal(durum.body.program_enabled, false);
  // Elle acilan bayinin sitesi calisir.
  assert.match((await vitrin('erken.bayi.test').get('/')).text, /Erken Panel/);
});

test('ayar kaydında sayfa anahtarı gönderilmezse mevcut değer korunur', async () => {
  await admin.put('/api/admin/resellers/settings').send({
    public_page_enabled: true, discount_percent: 10, min_deposit_tl: 500, applications_open: true, default_markup_percent: 30
  });
  const eski = await admin.put('/api/admin/resellers/settings').send({
    discount_percent: 10, min_deposit_tl: 500, applications_open: true, default_markup_percent: 30
  });
  assert.equal(eski.body.settings.public_page_enabled, true);
  const program = await request(app).get('/api/reseller/program');
  assert.equal(program.body.enabled, true);
  assert.equal(program.body.min_deposit, 500);
});

test('bayilik başvurusu: 500 TL gerçek yükleme olmadan açılmaz, bonus sayılmaz', async () => {
  const sahip = await jetKullanici('bayi_sahibi');
  sahipId = sahip.id;
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'bayi_sahibi', password: SIFRE });

  const bos = await agent.post('/api/reseller/apply').send({ name: 'Kanka SMM', slug: 'kanka' });
  assert.equal(bos.status, 403);
  assert.equal(bos.body.code, 'MIN_DEPOSIT');

  await dbAsync.run(
    "INSERT INTO payments (user_id, amount, amount_kurus, method, status, transaction_id) VALUES (?, 1000, 100000, 'Bonus (kampanya)', 'completed', 'B1')",
    [sahipId]
  );
  assert.equal((await agent.post('/api/reseller/apply').send({ name: 'Kanka SMM', slug: 'kanka' })).status, 403, 'bonus yükleme şartı karşılamamalı');

  await dbAsync.run(
    "INSERT INTO payments (user_id, amount, amount_kurus, method, status, transaction_id) VALUES (?, 500, 50000, 'Shopier', 'completed', 'S1')",
    [sahipId]
  );
  const durum = await agent.get('/api/reseller/me');
  assert.equal(durum.body.eligible, true);
  assert.equal(durum.body.deposited, 500);

  const ayrilmis = await agent.post('/api/reseller/apply').send({ name: 'Kanka SMM', slug: 'admin' });
  assert.equal(ayrilmis.status, 400);
  assert.equal(ayrilmis.body.field, 'slug');

  const ok = await agent.post('/api/reseller/apply').send({ name: 'Kanka SMM', slug: 'kanka' });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.equal(ok.body.tenant.address, 'kanka.bayi.test');
  tenantId = ok.body.tenant.id;

  assert.equal((await agent.post('/api/reseller/apply').send({ name: 'İkinci', slug: 'ikinci' })).status, 409);
  await dbAsync.run('UPDATE users SET balance_kurus = 100000, balance = 1000 WHERE id = ?', [sahipId]);
});

// ---------------------------------------------------------------------------
// Alan adina gore site
// ---------------------------------------------------------------------------

test('bayi adresi Jet sitesini değil bayinin vitrinini açar (marka sızmaz)', async () => {
  const res = await vitrin().get('/');
  assert.equal(res.status, 200);
  assert.match(res.text, /Kanka SMM/);
  for (const iz of [/SMMJET/i, /jet ?smm/i, /jetsmmpanel/i, /view-admin/]) {
    assert.doesNotMatch(res.text, iz, `bayi sitesinde Jet izi var: ${iz}`);
  }
  // Ana sitenin SEO / statik uclari bayi adresinde calismaz.
  const sitemap = await vitrin().get('/sitemap.xml');
  assert.doesNotMatch(sitemap.text, /jetsmmpanel|urlset/i);
  const css = await vitrin().get('/css/style.css');
  assert.doesNotMatch(css.text, /--accent-cyan/, 'ana sitenin stil dosyası bayi adresinden servis ediliyor');
  const robots = await vitrin().get('/robots.txt');
  assert.match(robots.text, /Allow: \//);
});

test('ana site ve bilinmeyen adres eskisi gibi Jet sitesini açar', async () => {
  const ana = await request(app).get('/');
  assert.match(ana.text, /view-admin/);
  const bilinmeyen = await request(app).get('/').set('Host', 'baska-bir-site.com');
  assert.match(bilinmeyen.text, /view-admin/);
});

// ---------------------------------------------------------------------------
// Musteri oturumu ve izolasyon
// ---------------------------------------------------------------------------

test('bayi müşterisi kayıt / giriş / me; Jet hesabı ile karışmaz', async () => {
  const site = vitrin();
  const id = await musteriOlustur(site, 'musteri1');
  const me = await site.get('/api/auth/me');
  assert.equal(me.body.customer.username, 'musteri1');

  // Ayni kullanici adi Jet'te yok: musteri Jet'e giris yapamaz.
  const jet = await request(app).post('/api/auth/login').send({ username: 'musteri1', password: SIFRE });
  assert.equal(jet.status, 401);

  // Bayi tokeni Jet'te gecmez.
  const girdi = await site.post('/api/auth/login').send({ username: 'musteri1', password: SIFRE });
  const token = /tsess=([^;]+)/.exec(girdi.headers['set-cookie'].join(';'))[1];
  const jetMe = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  assert.ok([401, 403].includes(jetMe.status), 'bayi tokeni Jet oturumu açtı');
  assert.ok(id > 0);
});

test('bir bayinin müşteri oturumu başka bayide geçmez', async () => {
  const digerSahip = await jetKullanici('diger_bayi');
  await dbAsync.run("INSERT INTO tenants (owner_user_id, slug, name) VALUES (?, 'diger', 'Diğer Panel')", [digerSahip.id]);
  require('../tenant/resolve').invalidateTenantCache();

  const site = vitrin();
  await site.post('/api/auth/login').send({ username: 'musteri1', password: SIFRE });
  // Ayni cerez kavanozu (ayni agent) ile diger bayiye gidilir.
  const baska = await site.agent.get('/api/auth/me').set('Host', 'diger.bayi.test');
  assert.equal(baska.status, 401);
  const baskaGiris = await site.agent.post('/api/auth/login').set('Host', 'diger.bayi.test').send({ username: 'musteri1', password: SIFRE });
  assert.equal(baskaGiris.status, 401, 'başka bayinin müşterisiyle giriş yapılabildi');
});

// ---------------------------------------------------------------------------
// Fiyat zinciri
// ---------------------------------------------------------------------------

async function vitrinFiyati(id = servisId) {
  const res = await vitrin().get('/api/services');
  return res.body.services.find(s => s.id === id);
}

test('müşteri fiyatı = Jet fiyatı - bayi indirimi + bayi kârı', async () => {
  // 10,00 TL -> %10 indirim -> 9,00 maliyet -> %30 kar -> 11,70
  assert.equal((await vitrinFiyati()).rate, 11.7);
});

test('admin indirimi kaydedince tüm bayilerin fiyatına anında yansır', async () => {
  const res = await admin.put('/api/admin/resellers/settings').send({
    public_page_enabled: true, discount_percent: 20, min_deposit_tl: 500, applications_open: true, default_markup_percent: 30
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  // 10,00 -> %20 -> 8,00 -> %30 -> 10,40
  assert.equal((await vitrinFiyati()).rate, 10.4);
  await admin.put('/api/admin/resellers/settings').send({
    discount_percent: 10, min_deposit_tl: 500, applications_open: true, default_markup_percent: 30
  });
  assert.equal((await vitrinFiyati()).rate, 11.7);
});

test('bayiye özel indirim genel oranı ezer', async () => {
  assert.equal((await admin.put(`/api/admin/resellers/${tenantId}`).send({ discount_percent: 50 })).status, 200);
  // 10,00 -> %50 -> 5,00 -> %30 -> 6,50
  assert.equal((await vitrinFiyati()).rate, 6.5);
  assert.equal((await admin.put(`/api/admin/resellers/${tenantId}`).send({ discount_percent: null })).status, 200);
  assert.equal((await vitrinFiyati()).rate, 11.7);
});

test('maliyetin altındaki sabit fiyatlı servis satıştan kalkar', async () => {
  await dbAsync.run('INSERT INTO tenant_service_prices (tenant_id, service_id, fixed_rate_kurus) VALUES (?, ?, 100)', [tenantId, pahaliServisId]);
  assert.equal(await vitrinFiyati(pahaliServisId), undefined, 'zararına servis listede');
  const site = vitrin();
  await musteriOlustur(site, 'zararci', 100000);
  const res = await site.post('/api/orders').send({ service_id: pahaliServisId, link: 'https://instagram.com/kullaniciadi', quantity: 1000 });
  assert.equal(res.status, 400);
  assert.equal(giden.length, 0);
  const detay = await admin.get(`/api/admin/resellers/${tenantId}`);
  assert.ok(detay.body.prices.find(p => p.service_id === pahaliServisId && p.below_cost), 'admin uyarıyı görmüyor');
});

// ---------------------------------------------------------------------------
// Siparis ve para akisi
// ---------------------------------------------------------------------------

async function siparis(site, extra = {}) {
  return site.post('/api/orders').send({ service_id: servisId, link: 'https://instagram.com/kullaniciadi', quantity: 1000, ...extra });
}

test('sipariş: müşteri bayi fiyatından, bayi Jet maliyetinden öder; sağlayıcıya gider', async () => {
  const site = vitrin();
  const musteri = await musteriOlustur(site, 'alici', 10000);
  const sahipOnce = await sahipBakiye();
  const res = await siparis(site);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.order.charge, 11.7);
  assert.equal(await musteriBakiye(musteri), 10000 - 1170);
  assert.equal(sahipOnce - await sahipBakiye(), 900, 'bayiden indirimli maliyet düşülmeli');
  assert.equal(giden.length, 1);

  const order = await dbAsync.get('SELECT * FROM orders WHERE id = ?', [res.body.order.id]);
  assert.equal(order.user_id, sahipId);
  assert.equal(order.tenant_id, tenantId);
  assert.equal(order.tenant_customer_id, musteri);
  assert.equal(order.tenant_charge_kurus, 1170);
  assert.equal(order.charge_kurus, 900);
  const log = await dbAsync.get('SELECT * FROM tenant_balance_logs WHERE order_id = ?', [order.id]);
  assert.equal(log.amount_kurus, -1170);

  const liste = await site.get('/api/orders');
  assert.equal(liste.body.orders[0].id, order.id);
  assert.equal(liste.body.orders[0].charge, 11.7);
  assert.equal(liste.body.orders[0].provider_order_id, undefined, 'müşteriye sağlayıcı bilgisi sızıyor');
});

test('müşteri bakiyesi yetmezse hiçbir şey düşmez', async () => {
  const site = vitrin();
  const musteri = await musteriOlustur(site, 'fakir', 100);
  const sahipOnce = await sahipBakiye();
  const res = await siparis(site);
  assert.equal(res.status, 400);
  assert.match(res.body.error, /Yetersiz bakiye.*11\.70/);
  assert.equal(await musteriBakiye(musteri), 100);
  assert.equal(await sahipBakiye(), sahipOnce);
  assert.equal(giden.length, 0);
});

test('bayinin Jet bakiyesi yetmezse müşteri tutar görmez, bayi işlem kaydına düşer', async () => {
  const site = vitrin();
  const musteri = await musteriOlustur(site, 'zengin', 100000);
  await dbAsync.run('UPDATE users SET balance_kurus = 10, balance = 0.1 WHERE id = ?', [sahipId]);
  try {
    const res = await siparis(site);
    assert.equal(res.status, 503);
    assert.match(res.body.error, /geçici olarak kullanılamıyor/);
    assert.doesNotMatch(res.body.error, /₺|9[.,]00/, 'müşteriye bayinin maliyeti gösterildi');
    assert.equal(await musteriBakiye(musteri), 100000, 'müşteriden para düşüldü');
    const kayit = await dbAsync.get("SELECT * FROM tenant_activity_logs WHERE tenant_id = ? AND action = 'owner_balance_low'", [tenantId]);
    assert.ok(kayit, 'bayi bakiye uyarısı kaydedilmedi');
  } finally {
    await dbAsync.run('UPDATE users SET balance_kurus = 100000, balance = 1000 WHERE id = ?', [sahipId]);
  }
});

test('sağlayıcı reddederse müşteri ve bayi tam iade alır', async () => {
  const site = vitrin();
  const musteri = await musteriOlustur(site, 'iadeci', 10000);
  const sahipOnce = await sahipBakiye();
  saglayiciKabul = false;
  const res = await siparis(site);
  assert.equal(res.status, 502);
  assert.match(res.body.error, /iade edildi/);
  assert.equal(await musteriBakiye(musteri), 10000);
  assert.equal(await sahipBakiye(), sahipOnce);
});

test('kısmi teslimde müşteri kendi ödediği fiyattan orantılı iade alır', async () => {
  const site = vitrin();
  const musteri = await musteriOlustur(site, 'kismi', 10000);
  const id = (await siparis(site)).body.order.id;
  const sahipOnce = await sahipBakiye();
  await applyProviderStatus(id, { status: 'Partial', remains: 500 });
  assert.equal(await sahipBakiye() - sahipOnce, 450, 'bayiye maliyetin yarısı dönmeli');
  assert.equal(await musteriBakiye(musteri), 10000 - 1170 + 585, 'müşteriye ödediğinin yarısı dönmeli');
  // Ayni durum tekrar gelirse ikinci kez iade olmaz.
  await applyProviderStatus(id, { status: 'Partial', remains: 500 });
  assert.equal(await musteriBakiye(musteri), 10000 - 1170 + 585);
});

test('iptalde müşteri tamamını alır; admin elle iptal de yansır', async () => {
  const site = vitrin();
  const musteri = await musteriOlustur(site, 'iptalci', 10000);
  const a = (await siparis(site)).body.order.id;
  const b = (await siparis(site)).body.order.id;
  await applyProviderStatus(a, { status: 'Canceled' });
  assert.equal(await musteriBakiye(musteri), 10000 - 1170);
  const res = await admin.put(`/api/admin/orders/${b}/status`).send({ status: 'canceled' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(await musteriBakiye(musteri), 10000);
});

test('bayi müşterisi telafi isteyebilir, yalnızca kendi siparişi için', async () => {
  const site = vitrin();
  await musteriOlustur(site, 'telafici', 10000);
  const id = (await siparis(site)).body.order.id;
  await dbAsync.run("UPDATE orders SET status = 'completed' WHERE id = ?", [id]);
  const res = await site.post(`/api/orders/${id}/refill`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const baska = vitrin();
  await musteriOlustur(baska, 'meraklı'.replace('ı', 'i'), 0);
  assert.equal((await baska.post(`/api/orders/${id}/refill`)).status, 404);
});

// ---------------------------------------------------------------------------
// Admin Bayiler bolumu
// ---------------------------------------------------------------------------

test('admin listesi bayinin sahibi, müşteri sayısı ve ciro/kâr özetini verir', async () => {
  const res = await admin.get('/api/admin/resellers');
  assert.equal(res.status, 200);
  const t = res.body.tenants.find(x => x.id === tenantId);
  assert.equal(t.owner.username, 'bayi_sahibi');
  assert.equal(t.subdomain, 'kanka.bayi.test');
  assert.ok(t.stats.customers_total >= 5);
  assert.ok(t.stats.orders_total >= 1);
  assert.ok(t.stats.revenue > t.stats.cost, 'bayi kârı hesaplanmıyor');
  assert.equal(t.effective_discount_percent, 10);
  assert.ok(res.body.summary.total >= 2);
});

test('admin detayı: müşteriler, siparişler, bakiye hareketleri ve işlem kaydı', async () => {
  const res = await admin.get(`/api/admin/resellers/${tenantId}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.owner.username, 'bayi_sahibi');
  assert.equal(res.body.owner.real_deposit, 500);
  assert.ok(res.body.customers.some(c => c.username === 'alici'));
  const alici = res.body.orders.find(o => o.customer_username === 'alici');
  assert.ok(alici, 'sipariş listesinde müşteri adı yok');
  assert.equal(alici.customer_paid, 11.7);
  assert.equal(alici.cost, 9);
  assert.equal(alici.profit, 2.7);
  assert.ok(res.body.balance_logs.some(l => l.type === 'order'));
  const eylemler = new Set(res.body.activity.map(a => a.action));
  for (const eylem of ['tenant_created', 'customer_registered', 'customer_login', 'global_settings_changed', 'tenant_updated', 'owner_balance_low']) {
    assert.ok(eylemler.has(eylem), `işlem kaydında ${eylem} yok`);
  }
});

test('admin müşteri bakiyesini değiştirir, deftere ve işlem kaydına yazılır', async () => {
  const musteri = await dbAsync.get("SELECT id, balance_kurus FROM tenant_customers WHERE username = 'musteri1' AND tenant_id = ?", [tenantId]);
  const res = await admin.post(`/api/admin/resellers/${tenantId}/customers/${musteri.id}/balance`).send({ amount: 25, action: 'add', note: 'havale' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(await musteriBakiye(musteri.id), musteri.balance_kurus + 2500);
  const fazla = await admin.post(`/api/admin/resellers/${tenantId}/customers/${musteri.id}/balance`).send({ amount: 999999, action: 'subtract' });
  assert.equal(fazla.status, 400, 'bakiye eksiye düşürülebildi');
  const log = await dbAsync.get("SELECT * FROM tenant_balance_logs WHERE customer_id = ? AND type = 'manual_add'", [musteri.id]);
  assert.equal(log.note, 'havale');
});

test('askıya alınan bayinin sitesi kapanır, sipariş alamaz', async () => {
  const site = vitrin();
  await site.post('/api/auth/login').send({ username: 'alici', password: SIFRE });
  assert.equal((await admin.post(`/api/admin/resellers/${tenantId}/status`).send({ status: 'suspended', reason: 'test' })).status, 200);
  try {
    const sayfa = await vitrin().get('/');
    assert.equal(sayfa.status, 503);
    const res = await siparis(site);
    assert.equal(res.status, 503);
  } finally {
    await admin.post(`/api/admin/resellers/${tenantId}/status`).send({ status: 'active' });
  }
  assert.equal((await vitrin().get('/')).status, 200);
});

test('admin özel alan adı ekler; aktifken açılır, kapatılınca açılmaz', async () => {
  const eklendi = await admin.post(`/api/admin/resellers/${tenantId}/domains`).send({ domain: 'https://www.KankaSMM.com/' });
  assert.equal(eklendi.status, 201, JSON.stringify(eklendi.body));
  const sayfa = await vitrin('kankasmm.com').get('/');
  assert.match(sayfa.text, /Kanka SMM/);
  assert.match((await vitrin('www.kankasmm.com').get('/')).text, /Kanka SMM/);

  const detay = await admin.get(`/api/admin/resellers/${tenantId}`);
  const alan = detay.body.tenant.domains.find(d => d.domain === 'kankasmm.com');
  assert.equal((await admin.patch(`/api/admin/resellers/${tenantId}/domains/${alan.id}`).send({ status: 'disabled' })).status, 200);
  assert.match((await vitrin('kankasmm.com').get('/')).text, /view-admin/, 'kapatılan alan adı hâlâ bayiyi açıyor');
  assert.equal((await admin.post(`/api/admin/resellers/${tenantId}/domains`).send({ domain: 'kankasmm.com' })).status, 409);
});

test('bayi uçları yalnızca admine açık', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'bayi_sahibi', password: SIFRE });
  assert.equal((await agent.get('/api/admin/resellers')).status, 403);
  assert.equal((await request(app).get('/api/admin/resellers')).status, 401);
});

test('bayisi olan kullanıcı silinemez; bayilik adres onayıyla silinir', async () => {
  const sil = await admin.delete(`/api/admin/users/${sahipId}`);
  assert.equal(sil.status, 409);
  const yanlis = await admin.delete(`/api/admin/resellers/${tenantId}`).send({ confirm: 'baska' });
  assert.equal(yanlis.status, 400);
  const diger = await dbAsync.get("SELECT id FROM tenants WHERE slug = 'diger'");
  assert.equal((await admin.delete(`/api/admin/resellers/${diger.id}`).send({ confirm: 'diger' })).status, 200);
  assert.equal((await vitrin('diger.bayi.test').get('/')).text.includes('view-admin'), true, 'silinen bayi hâlâ açılıyor');
});

test('telafi geçmişi olan kullanıcı silinebilir (yabancı anahtar hatası yok)', async () => {
  const kullanici = await jetKullanici('silinecek');
  const order = await dbAsync.run(
    `INSERT INTO orders (user_id, service_id, provider_id, provider_order_id, link, quantity, charge, charge_kurus, status)
     VALUES (?, ?, ?, 1, 'https://instagram.com/x', 100, 1, 100, 'completed')`,
    [kullanici.id, servisId, saglayiciId]
  );
  await dbAsync.run("INSERT INTO order_refills (order_id, user_id, status) VALUES (?, ?, 'pending')", [order.id, kullanici.id]);
  const res = await admin.delete(`/api/admin/users/${kullanici.id}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
});

test('kuruş sütunu boş eski servislerde fiyat ondalık sütundan hesaplanır (bedava görünmez)', async () => {
  const kategori = await dbAsync.get('SELECT category_id FROM services WHERE id = ?', [servisId]);
  const eski = (await dbAsync.run(
    `INSERT INTO services (category_id, provider_id, provider_service_id, name, name_tr, rate_per_1000, rate_per_1000_kurus,
       min_quantity, max_quantity, status)
     VALUES (?, ?, '5009', 'Instagram Eski Servis', 'Instagram Eski Servis', 20, 0, 100, 100000, 1)`,
    [kategori.category_id, saglayiciId]
  )).id;
  // 20,00 -> %10 -> 18,00 -> %30 -> 23,40
  assert.equal((await vitrinFiyati(eski)).rate, 23.4);
});
