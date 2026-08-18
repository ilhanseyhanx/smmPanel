const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-sohbet-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.ENABLE_DEMO_PAYMENTS = 'false';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';

const { app } = require('../server');
const { initDatabase, db } = require('../config/database');

const ADMIN_PASSWORD = 'GuvenliAdminSifre_2026';
const MUSTERI_SIFRE = 'MusteriSifresi_2026';
let musteriAgent;
let adminAgent;
let ticketId;

test.before(async () => {
  await initDatabase();

  const ilk = request.agent(app);
  await ilk.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  await ilk.post('/api/admin/change-password').send({ current_password: 'admin12345', new_password: ADMIN_PASSWORD });

  adminAgent = request.agent(app);
  const adminGiris = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: ADMIN_PASSWORD });
  assert.equal(adminGiris.status, 200, adminGiris.body.error);

  musteriAgent = request.agent(app);
  const kayit = await musteriAgent.post('/api/auth/register')
    .send({ username: 'sohbet_musteri', email: 'sohbet@site.com', password: MUSTERI_SIFRE });
  assert.equal(kayit.status, 201, kayit.body.error);

  const bilet = await musteriAgent.post('/api/tickets')
    .send({ subject: 'Sipariş Sorunu', message: 'Siparişim ilerlemiyor, yardım eder misiniz?' });
  assert.equal(bilet.status, 200, bilet.body.error);
  ticketId = bilet.body.ticket_id;
  assert.ok(ticketId, `bilet numarası dönmedi: ${JSON.stringify(bilet.body)}`);
});

test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

const mesajlariAl = async agent => {
  const res = await agent.get(`/api/tickets/${ticketId}`);
  assert.equal(res.status, 200, res.body.error);
  return res.body.messages;
};

// ---------------------------------------------------------------
// Veri yolu: iki taraf da digerinin mesajini gorebilmeli
// ---------------------------------------------------------------

test('müşterinin açtığı bilet admin tarafında görünür', async () => {
  const mesajlar = await mesajlariAl(adminAgent);
  assert.equal(mesajlar.length, 1);
  assert.match(mesajlar[0].message, /ilerlemiyor/);
});

test('adminin cevabı müşteri tarafında ANINDA okunabilir', async () => {
  const cevap = await adminAgent.post(`/api/tickets/${ticketId}/reply`)
    .send({ message: 'Merhaba, siparişinizi kontrol ediyorum.' });
  assert.equal(cevap.status, 200, cevap.body.error);

  // Musteri yeniden sorguladiginda (yenileme dongusu bunu yapar) yeni mesaj gelmeli
  const mesajlar = await mesajlariAl(musteriAgent);
  assert.equal(mesajlar.length, 2, 'admin cevabı müşteri tarafında görünmüyor');
  assert.equal(mesajlar[1].sender_role, 'admin');
  assert.match(mesajlar[1].message, /kontrol ediyorum/);
});

test('müşterinin cevabı admin tarafında ANINDA okunabilir', async () => {
  const cevap = await musteriAgent.post(`/api/tickets/${ticketId}/reply`)
    .send({ message: 'Teşekkürler, bekliyorum.' });
  assert.equal(cevap.status, 200, cevap.body.error);

  const mesajlar = await mesajlariAl(adminAgent);
  assert.equal(mesajlar.length, 3, 'müşteri cevabı admin tarafında görünmüyor');
  assert.equal(mesajlar[2].sender_role, 'client');
});

test('her mesajın kimliği vardır (yenileme değişikliği bu sayede anlar)', async () => {
  const mesajlar = await mesajlariAl(musteriAgent);
  const idler = mesajlar.map(m => m.id);
  assert.ok(idler.every(id => Number.isInteger(id)), 'mesaj kimlikleri sayı değil');
  assert.deepEqual(idler, [...idler].sort((a, b) => a - b), 'mesajlar sıralı gelmiyor');
  assert.equal(new Set(idler).size, idler.length, 'yinelenen mesaj kimliği var');
  // Gonderen ve zaman bilgisi arayuzde gosteriliyor
  for (const m of mesajlar) {
    assert.ok(m.created_at, 'zaman bilgisi yok');
    assert.ok(m.sender_role, 'gönderen rolü yok');
    assert.ok(m.username, 'kullanıcı adı yok');
  }
});

test('başkasının bileti okunamaz', async () => {
  const yabanci = request.agent(app);
  await yabanci.post('/api/auth/register')
    .send({ username: 'yabanci_kisi', email: 'yabanci@site.com', password: MUSTERI_SIFRE });
  const res = await yabanci.get(`/api/tickets/${ticketId}`);
  assert.equal(res.status, 404, 'başkasının destek sohbeti okunabiliyor');
});

test('oturumsuz istek bilet okuyamaz', async () => {
  assert.equal((await request(app).get(`/api/tickets/${ticketId}`)).status, 401);
});

test('boş mesaj gönderilemez', async () => {
  const res = await musteriAgent.post(`/api/tickets/${ticketId}/reply`).send({ message: '   ' });
  assert.ok(res.status >= 400, 'boş mesaj kabul edilmiş');
});

// ---------------------------------------------------------------
// Arayuz: otomatik yenileme gercekten kurulmus mu
// ---------------------------------------------------------------

const appJs = () => fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
const indexHtml = () => fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

test('sohbet açıkken mesajlar otomatik yenilenir', () => {
  const js = appJs();
  assert.match(js, /startTicketChatPolling\(\)\s*\{[\s\S]*?setInterval/, 'otomatik yenileme döngüsü yok');
  assert.match(js, /refreshTicketChat\(false\)/, 'yenileme çağrısı yok');
  // Yenileme araligi makul olmali (anlik hissettirsin ama sunucuyu yormasin)
  const aralik = js.match(/this\.chatPollTimer = setInterval\([\s\S]*?\}, (\d+)\)/);
  assert.ok(aralik, 'yenileme aralığı bulunamadı');
  const ms = Number(aralik[1]);
  assert.ok(ms >= 2000 && ms <= 10000, `yenileme aralığı uygun değil: ${ms}ms`);
});

test('pencere kapanınca yenileme durur (arka planda sorgu atmaz)', () => {
  const js = appJs();
  // closeModal tek tanim olmali; ikinci bir tanim ilkini sessizce gecersiz kilar
  const tanimSayisi = (js.match(/^\s{2}closeModal\(modalId\)/gm) || []).length;
  assert.equal(tanimSayisi, 1, `closeModal ${tanimSayisi} kez tanımlanmış (ölü kopya var)`);

  const bas = js.indexOf('closeModal(modalId)');
  const closeModal = js.slice(bas, bas + 500);
  assert.match(closeModal, /stopTicketChatPolling/, 'kapatınca yenileme durdurulmuyor');
  assert.match(js, /stopTicketChatPolling\(\)\s*\{[\s\S]*?clearInterval/, 'zamanlayıcı temizlenmiyor');
});

test('sekme arka plandayken gereksiz sorgu atılmaz', () => {
  assert.match(appJs(), /if \(document\.hidden\) return;/, 'arka plan kontrolü yok');
});

test('gönderim sırasında çift tıklama engellenir', () => {
  const js = appJs();
  const bas = js.indexOf('async handleSendTicketReply');
  const gonder = js.slice(bas, js.indexOf('  // Yazi alani icerige gore buyur', bas));
  assert.match(gonder, /input\.disabled = true/, 'gönderim sırasında alan kilitlenmiyor');
  assert.match(gonder, /finally/, 'hata durumunda alan tekrar açılmıyor');
});

test('sohbet penceresi modern bileşenleri içerir', () => {
  const html = indexHtml();
  for (const parca of ['chat-window', 'chat-header', 'chat-messages', 'chat-composer', 'chat-send', 'chat-live-badge']) {
    assert.ok(html.includes(parca), `"${parca}" bileşeni yok`);
  }
  // Eski satir ici stiller yerine sinif tabanli tasarim
  assert.ok(!html.includes('id="chat-messages-container" style="max-height: 380px'), 'eski satır içi stil kalmış');
});

test('yazma alanı okunabilir: zemin ve yazı rengi açıkça tanımlı', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'style.css'), 'utf8');
  // Sohbet her zaman uygulama ici (neo-app-active) pencerede acilir; orada
  // pencere zemini beyazdir. Yazi rengi acikca koyu verilmezse beyaz uzerine
  // beyaz dusuyordu.
  const kural = css.slice(css.indexOf('body.neo-app-active .chat-window .chat-input {'));
  assert.ok(kural, 'uygulama içi yazma alanı kuralı yok');
  const blok = kural.slice(0, kural.indexOf('}'));
  assert.match(blok, /background:\s*#fff/i, 'yazma alanının zemini açıkça beyaz değil');
  assert.match(blok, /color:\s*#090909/i, 'yazma alanının yazı rengi açıkça koyu değil');

  // Yazi rengi tema degiskenine birakilmamali (tema degisince gorunmez olur)
  const genelBlok = css.slice(css.indexOf('.chat-input {'), css.indexOf('.chat-input {') + 400);
  assert.ok(!/color:\s*var\(--text-main\)/.test(genelBlok) || /color:\s*#090909/.test(css),
    'yazı rengi hâlâ tema değişkenine bağlı');
});

test('mesaj balonlarının rengi pencere kuralı tarafından ezilmez', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'style.css'), 'utf8');
  // body.neo-app-active .modal-body p/h3 { color: #090909 !important } kurali
  // koyu mesaj alanindaki beyaz yaziyi silikleştirebiliyordu.
  assert.match(css, /body\.neo-app-active \.chat-window \.chat-bubble \{ color: #fff !important/,
    'balon yazısı için koruma yok');
  assert.match(css, /\.chat-messages \{ background: #0d121e !important/,
    'mesaj alanı zemini kesinleştirilmemiş');
});

test('sohbet stilleri tanımlı', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'style.css'), 'utf8');
  for (const kural of ['.chat-window', '.chat-bubble', '.chat-row-mine', '.chat-row-theirs', '.chat-send', '.chat-live-dot']) {
    assert.ok(css.includes(kural), `"${kural}" stili yok`);
  }
  assert.match(css, /\.chat-window \{[\s\S]*?position: relative/, 'yeni mesaj düğmesi için konumlandırma yok');
});
