// Servis bilgi penceresi: admin popup'inda girilen baslama suresi / hiz /
// ozellik / aciklama alanlari (TR+EN) kaydedilir, public katalogda doner ve
// yalnizca durum degistiren guncellemelerde silinmez.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-test-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.ENABLE_DEMO_PAYMENTS = 'false';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';

const { app } = require('../server');
const { initDatabase, db } = require('../config/database');

let admin;
let serviceId;

test.before(async () => {
  await initDatabase();
  admin = request.agent(app);
  assert.equal((await admin.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' })).status, 200);
  assert.equal((await admin.post('/api/admin/change-password').send({ current_password: 'admin12345', new_password: 'YeniGuvenliSifre_2026' })).status, 200);
  assert.equal((await admin.post('/api/auth/login').send({ username: 'admin', password: 'YeniGuvenliSifre_2026' })).status, 200);
});
test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('servis eklerken bilgi penceresi alanları TR+EN kaydedilir ve public katalogda döner', async () => {
  const created = await admin.post('/api/admin/services').send({
    category_name: 'Instagram Takipçi', category_name_en: 'Instagram Followers',
    name_tr: 'Instagram Türk Takipçi', name_en: 'Instagram Turkish Followers',
    rate_per_1000: 120, rate_per_1000_usd: 3.5, min_quantity: 100, max_quantity: 5000,
    description_tr: 'Türk profillerden takipçi.', description_en: 'Followers from Turkish profiles.',
    start_time_tr: '0-15 dakika', start_time_en: '0-15 minutes',
    speed_tr: 'Günde 5.000', speed_en: '5,000 / day',
    // Madde isaretleri ve bos satirlar temizlenir, HTML atilir.
    features_tr: '- Gerçek görünümlü profiller\n\n• Şifre gerekmez\n<b>30 gün</b> telafi',
    features_en: 'Real-looking profiles\nNo password required\n30-day refill'
  });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  serviceId = created.body.service_id;

  const catalog = await request(app).get('/api/services');
  assert.equal(catalog.status, 200);
  const service = catalog.body.services.find(s => s.id === serviceId);
  assert.ok(service, 'servis public katalogda yok');
  assert.equal(service.start_time_tr, '0-15 dakika');
  assert.equal(service.start_time_en, '0-15 minutes');
  assert.equal(service.speed_tr, 'Günde 5.000');
  assert.equal(service.speed_en, '5,000 / day');
  assert.equal(service.features_tr, 'Gerçek görünümlü profiller\nŞifre gerekmez\n30 gün telafi');
  assert.equal(service.features_en, 'Real-looking profiles\nNo password required\n30-day refill');
  assert.equal(service.description_en, 'Followers from Turkish profiles.');
});

test('bayi API (v2) ve Excel dışa aktarma yeni alanları içerir', async () => {
  const { dbAsync } = require('../config/database');
  await dbAsync.run("UPDATE users SET api_key = 'smm_testkey_service_info' WHERE username = 'admin'");
  const v2 = await request(app).post('/api/v2').send({ key: 'smm_testkey_service_info', action: 'services' });
  assert.equal(v2.status, 200, JSON.stringify(v2.body));
  const item = v2.body.find(s => s.service === serviceId);
  assert.ok(item, 'servis v2 listesinde yok');
  assert.equal(item.name, 'Instagram Turkish Followers');
  assert.equal(item.start_time, '0-15 minutes');
  assert.equal(item.speed, '5,000 / day');
  assert.deepEqual(item.features, ['Real-looking profiles', 'No password required', '30-day refill']);
  assert.equal(item.description, 'Followers from Turkish profiles.');
  assert.equal(typeof item.refill, 'boolean');

  const xlsx = await admin.get('/api/admin/services/export?status=all');
  assert.equal(xlsx.status, 200);
  assert.match(xlsx.headers['content-type'], /spreadsheetml/);
});

test('düzenleme popup\'ından gelen alanlar güncellenir', async () => {
  const updated = await admin.put(`/api/admin/services/${serviceId}`).send({
    start_time_tr: '1 saat içinde', start_time_en: 'Within 1 hour',
    speed_tr: 'Günde 10.000', speed_en: '10,000 / day',
    features_tr: 'Hızlı teslimat', features_en: 'Fast delivery'
  });
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  const service = (await admin.get('/api/admin/services')).body.services.find(s => s.id === serviceId);
  assert.equal(service.start_time_en, 'Within 1 hour');
  assert.equal(service.speed_tr, 'Günde 10.000');
  assert.equal(service.features_en, 'Fast delivery');
});

test('yalnızca durum değiştiren güncelleme bilgi alanlarını silmez', async () => {
  const toggled = await admin.put(`/api/admin/services/${serviceId}`).send({ name: 'Instagram Türk Takipçi', rate_per_1000: 120, min_quantity: 100, max_quantity: 5000, status: 0 });
  assert.equal(toggled.status, 200);
  const service = (await admin.get('/api/admin/services')).body.services.find(s => s.id === serviceId);
  assert.equal(service.status, 0);
  assert.equal(service.start_time_tr, '1 saat içinde');
  assert.equal(service.features_tr, 'Hızlı teslimat');
});

test('aşırı uzun alan reddedilir', async () => {
  const response = await admin.put(`/api/admin/services/${serviceId}`).send({ start_time_tr: 'x'.repeat(201) });
  assert.equal(response.status, 400);
});

test('arayüz: bilgi popup\'ı, sipariş kartı ve admin formları hazır', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'style.css'), 'utf8');

  assert.match(html, /id="modal-service-info"/);
  assert.match(html, /id="service-info-buy-btn"/);
  assert.match(html, /id="service-info-extra"/);
  for (const lang of ['tr', 'en']) {
    for (const prefix of ['single', 'edit-service']) {
      for (const field of ['start-time', 'speed', 'features']) {
        assert.match(html, new RegExp(`id="${prefix}-${field}-${lang}"`), `${prefix}-${field}-${lang} alanı yok`);
      }
    }
  }
  // Bilgi popup'i giris gerektirmeyen bolumde olmali (ziyaretci de acabilir).
  const authStart = html.indexOf('<!--AUTH-ONLY-START-->', html.indexOf('id="modal-api-guide"'));
  assert.ok(html.indexOf('id="modal-service-info"') < authStart, 'bilgi popup\'ı AUTH-ONLY bloğuna girmiş');

  assert.match(js, /openServiceInfoModal\(serviceId\)/);
  assert.match(js, /buyFromServiceInfo\(\)/);
  assert.match(js, /renderServiceInfoDetails\(service/);
  assert.ok((js.match(/app\.openServiceInfoModal\(\$\{s\.id\}\)/g) || []).length >= 2, 'bilgi butonu her iki tabloda da olmalı');
  assert.match(css, /\.service-info-modal/);
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*\.service-info-btn-text \{ display: none; \}/);
});

// Tekil ekleme popup'i saglayici maliyetini de gondermeli; eskiden yalnizca
// ekranda gosterilip atlaniyor, "Sağlayıcı Maliyeti" sutunu hep 0 kaliyordu.
test('tekil servis ekleme popup\'ı sağlayıcı maliyetini kaydeder', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
  const start = js.indexOf('async handleSaveSingleService(');
  const body = js.slice(start, js.indexOf('async loadAdminAddedServices', start));
  assert.match(body, /provider_cost_rate: this\.singleServiceCost/);
  assert.match(body, /provider_cost_currency: this\.singleServiceCost/);
  assert.match(js, /this\.singleServiceCost = \{ rate: cost, currency \}/);
});

test('admin favori servis işaretleme çalışır ve favori sekmesi var', async () => {
  const on = await admin.post(`/api/admin/services/${serviceId}/favorite`).send({ favorite: 1 });
  assert.equal(on.status, 200, JSON.stringify(on.body));
  let service = (await admin.get('/api/admin/services')).body.services.find(s => s.id === serviceId);
  assert.equal(service.is_favorite, 1);
  // Duzenleme kaydi favoriyi sifirlamamali.
  await admin.put(`/api/admin/services/${serviceId}`).send({ name: 'Instagram Türk Takipçi', rate_per_1000: 120, min_quantity: 100, max_quantity: 5000, status: 1 });
  service = (await admin.get('/api/admin/services')).body.services.find(s => s.id === serviceId);
  assert.equal(service.is_favorite, 1);
  const off = await admin.post(`/api/admin/services/${serviceId}/favorite`).send({ favorite: 0 });
  assert.equal(off.status, 200);
  assert.equal((await admin.post('/api/admin/services/999999/favorite').send({ favorite: 1 })).status, 404);
  assert.equal((await admin.post(`/api/admin/services/${serviceId}/favorite`).send({ favorite: 5 })).status, 400);

  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
  assert.match(html, /id="admin-services-tab-favorite"/);
  assert.match(js, /toggleAdminServiceFavorite\(serviceId\)/);
  assert.match(js, /statusFilter === 'favorite'/);
});

test('hizmet atama popup\'ında favori sekmesi ve arama var', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
  assert.match(html, /id="assign-service-tab-favorite"/);
  assert.match(html, /id="assign-service-search"/);
  assert.match(js, /setAssignServiceMode\(mode\)/);
  assert.match(js, /renderAssignServiceOptions\(\)/);
  // Favori bilgisi admin listesinden gelir; public katalogda yoktur.
  assert.match(js, /API\.getAdminServices\(\)[\s\S]{0,400}assignServiceList/);
});
