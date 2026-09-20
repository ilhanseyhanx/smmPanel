// Servis vitrini istatistikleri (20 Eyl 2026): medyan tamamlanma suresi ve
// "En Cok Kullanilanlar" populerlik puani.
//
// IKI KARAR BURADA KORUNUYOR:
//
// 1) MEDYAN, ORTALAMA DEGIL. Canlida tamamlanan 83 siparisin 42'si 5 dakikanin
//    altinda bitiyordu ama tek bir siparis 3.475 dakika surmustu; aritmetik
//    ortalama bu tek deger yuzunden 90 dakika cikiyor ve sitenin gercekten iyi
//    olan teslimat hizini kotu gosteriyordu.
//
// 2) POPULERLIK = KISI-GUN. Ayni kisinin ayni servisten AYNI GUN verdigi
//    siparisler 1 sayilir. Ham siparis sayisi kullanilsaydi tek musterinin
//    arka arkaya verdigi 63 siparis listeyi tek basina domine ederdi.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-svcstats-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.PUBLIC_BASE_URL = 'https://jetsmmpanel.com';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');
const { getServiceStats, invalidateServiceStats, medyan, MIN_SIPARIS, GUVENILIR_ORNEK } = require('../services/serviceStats');

let servisA, servisB, servisC;

test.before(async () => {
  await initDatabase();

  // Siparis satirlari user_id'ye FK ile bagli; test kullanicilari olusturulur.
  const kullanici = async (ad) => {
    const mevcut = await dbAsync.get('SELECT id FROM users WHERE username = ?', [ad]);
    if (mevcut) return mevcut.id;
    const r = await dbAsync.run(
      `INSERT INTO users (username, email, password, role) VALUES (?, ?, 'x', 'user')`,
      [ad, `${ad}@ornek.test`]);
    return r.id;
  };
  const k1 = await kullanici('stat_musteri_1');
  const k2 = await kullanici('stat_musteri_2');
  const k3 = await kullanici('stat_musteri_3');
  const k4 = await kullanici('stat_musteri_4'); // onbellek testinde kullanilir
  void k4;

  const kategori = await dbAsync.get('SELECT id FROM categories LIMIT 1');
  const yeniServis = async (ad) => {
    const r = await dbAsync.run(
      `INSERT INTO services (category_id, name, name_tr, rate_per_1000, min_quantity, max_quantity, status)
       VALUES (?, ?, ?, 10, 10, 1000, 1)`, [kategori.id, ad, ad]);
    return r.id;
  };
  servisA = await yeniServis('Test Servis A - medyan');
  servisB = await yeniServis('Test Servis B - az siparis');
  servisC = await yeniServis('Test Servis C - populerlik');

  const siparis = async (servisId, kullaniciId, gun, dakika, durum = 'completed') => {
    const olusma = `2026-09-${String(gun).padStart(2, '0')} 10:00:00`;
    const bitis = dakika === null ? null
      : `2026-09-${String(gun).padStart(2, '0')} ${String(10 + Math.floor(dakika / 60)).padStart(2, '0')}:${String(dakika % 60).padStart(2, '0')}:00`;
    await dbAsync.run(
      `INSERT INTO orders (user_id, service_id, link, quantity, charge, charge_kurus, status, created_at, completed_at)
       VALUES (?, ?, 'https://example.com/test', 100, 10, 1000, ?, ?, ?)`,
      [kullaniciId, servisId, durum, olusma, bitis]);
  };

  // A: 5 tamamlanmis siparis — 2, 4, 5, 6, 600 dakika.
  // Ortalama 123.4 dk (tek uc deger yuzunden), MEDYAN 5 dk.
  for (const [gun, dk] of [[1, 2], [2, 4], [3, 5], [4, 6], [5, 600]]) {
    await siparis(servisA, k1, gun, dk);
  }
  // B: yalnizca 2 tamamlanmis siparis — esigin altinda, medyan gosterilmemeli.
  await siparis(servisB, k1, 1, 7);
  await siparis(servisB, k1, 2, 9);

  // C: ayni kisi AYNI GUN 6 siparis + baska gun 1 + baska kisi ayni gun 1
  //    -> kisi-gun puani 3 olmali (k1|09-10, k1|09-11, k2|09-10), ham siparis 8.
  for (let i = 0; i < 6; i++) await siparis(servisC, k1, 10, 5);
  await siparis(servisC, k1, 11, 5);
  await siparis(servisC, k2, 10, 5);
  // Iptal edilen siparis puana girmemeli.
  await siparis(servisC, k3, 12, null, 'canceled');

  invalidateServiceStats();
});

test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('medyan yardımcısı tek ve çift sayıda değerde doğru çalışır', () => {
  assert.equal(medyan([5]), 5);
  assert.equal(medyan([2, 4, 5, 6, 600]), 5);      // tek: ortadaki
  assert.equal(medyan([2, 4, 6, 8]), 5);            // çift: ortadaki ikisinin ortalaması
  assert.equal(medyan([]), null);
});

test('uç değer medyanı bozmaz — ortalama kullanılsaydı 123 dk çıkardı', async () => {
  const stats = await getServiceStats();
  const a = stats[servisA];
  assert.ok(a, 'servis A istatistigi yok');
  assert.equal(a.median_minutes, 5, 'medyan 5 dakika olmaliydi');
  assert.equal(a.completed_count, 5);

  // Ortalama olsaydi: (2+4+5+6+600)/5 = 123.4
  const ortalama = (2 + 4 + 5 + 6 + 600) / 5;
  assert.ok(ortalama > 100, 'test verisi uc deger icermiyor');
  assert.ok(a.median_minutes < ortalama / 10,
    'medyan, ortalamadan belirgin sekilde dusuk olmali (uc deger etkisi)');
});

test('tek siparişi olan servis de süre gösterir (eşik 1)', async () => {
  assert.equal(MIN_SIPARIS, 1, 'esik degismis; admin ekraniyla tutarsizlik dogar');
  const stats = await getServiceStats();
  // B servisinde 2 tamamlanmis siparis var (7 ve 9 dk) -> medyan 8.
  assert.equal(stats[servisB]?.median_minutes, 8, 'esik alti servis gizlenmis');
  assert.equal(stats[servisB]?.completed_count, 2);
});

test('ölçüm sayısı gönderilir ama vitrinde görsel ayrım yapılmaz', async () => {
  // Az olcumden gelen deger de gercek bir olcumdur; tabloda tek tip gorunur
  // (kullanici karari). Sayi yine de API'de tasinir: admin tarafi ve ileride
  // yapilacak degerlendirmeler icin gerekli.
  const stats = await getServiceStats();
  assert.equal(typeof stats[servisA].completed_count, 'number');
  assert.equal(typeof stats[servisB].completed_count, 'number');
  assert.ok(GUVENILIR_ORNEK > 0, 'sabit kaldirilmis');
});

test('popülerlik kişi-gün olarak sayılır: aynı kişi aynı gün = 1', async () => {
  const stats = await getServiceStats();
  // 6 siparis (kisi 2, 10 Eyl) + 1 (kisi 2, 11 Eyl) + 1 (kisi 3, 10 Eyl) = 3 puan
  assert.equal(stats[servisC]?.popularity, 3,
    'kisi-gun kurali uygulanmamis (ham siparis sayilmis olabilir)');
});

test('iptal edilen sipariş popülerliğe sayılmaz', async () => {
  const ham = await dbAsync.get('SELECT COUNT(*) n FROM orders WHERE service_id = ?', [servisC]);
  assert.equal(ham.n, 9, 'test verisi beklendigi gibi degil');
  const stats = await getServiceStats();
  // 9 siparisin 1'i iptal; iptal sayilsaydi puan 4 olurdu.
  assert.equal(stats[servisC].popularity, 3, 'iptal edilen siparis puana girmis');
});

test('katalog ucu medyan süre ve popülerlik alanlarını döndürür', async () => {
  const res = await request(app).get('/api/services');
  assert.equal(res.status, 200);
  const liste = res.body.services || res.body;
  assert.ok(Array.isArray(liste), 'servis listesi dizi degil');

  const a = liste.find(s => s.id === servisA);
  assert.ok(a, 'servis A katalogda yok');
  assert.equal(a.median_minutes, 5);
  assert.equal(typeof a.popularity, 'number');

  assert.equal(a.median_sample, 5, 'olcum sayisi gonderilmedi');

  const b = liste.find(s => s.id === servisB);
  assert.equal(b.median_minutes, 8, 'tek/cift siparisli serviste sure gonderilmedi');
  assert.equal(b.median_sample, 2);
});

test('önbellek geçersiz kılınınca yeni sipariş istatistiğe yansır', async () => {
  const once = await getServiceStats();
  const oncekiPuan = once[servisC].popularity;

  await dbAsync.run(
    `INSERT INTO orders (user_id, service_id, link, quantity, charge, charge_kurus, status, created_at, completed_at)
     VALUES ((SELECT id FROM users WHERE username = 'stat_musteri_4'), ?, 'https://example.com/test', 100, 10, 1000, 'completed', '2026-09-20 10:00:00', '2026-09-20 10:05:00')`,
    [servisC]);

  // Onbellek hala eski degeri vermeli (5 dakikalik pencere).
  const onbellekli = await getServiceStats();
  assert.equal(onbellekli[servisC].popularity, oncekiPuan, 'onbellek calismiyor');

  invalidateServiceStats();
  const sonra = await getServiceStats();
  assert.equal(sonra[servisC].popularity, oncekiPuan + 1, 'onbellek tazelenmedi');
});
