// Ziyaretci ayak izi: kayit, bot/yonetici ayiklamasi, cerez onayi, sunucu
// olaylari, kullanici kazanimi ve admin uclari.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-footprint-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';

const { app } = require('../server');
const { initDatabase, dbAsync, db } = require('../config/database');

const ADMIN_PASSWORD = 'GuvenliAdminSifre_2026';
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
let seq = 0;
const newId = () => `${Date.now().toString(16)}-test-${(++seq).toString().padStart(6, '0')}`.slice(0, 36);

function track(body, { ua = CHROME, agent = request(app), headers = {} } = {}) {
  let r = agent.post('/api/track').set('User-Agent', ua).set('Content-Type', 'application/json');
  for (const [k, v] of Object.entries(headers)) r = r.set(k, v);
  return r.send(JSON.stringify(body));
}

const pageView = (p, extra = {}) => ({ kind: 'page_view', path: p, label: 'Başlık', ts: Date.now(), ...extra });

test.before(async () => {
  await initDatabase();
  const ilk = request.agent(app);
  await ilk.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  await ilk.post('/api/admin/change-password').send({ current_password: 'admin12345', new_password: ADMIN_PASSWORD });
});

test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

async function adminAgent() {
  const agent = request.agent(app);
  const login = await agent.post('/api/auth/login').set('User-Agent', CHROME).send({ username: 'admin', password: ADMIN_PASSWORD });
  assert.equal(login.status, 200);
  return agent;
}

test('normal ziyaret: oturum, kanal (arama), cihaz ve adımlar kaydedilir', async () => {
  const sid = newId();
  const res = await track({
    sid, consent: false, hi: true,
    ctx: { path: '/services', referrer: 'https://www.google.com/search?q=smm+panel', lang: 'tr', screen: '390x844', tz: 'Europe/Istanbul', utm: {} },
    events: [pageView('/services'), { kind: 'service_search', label: 'instagram takipçi', meta: { results: 12 }, ts: Date.now() }, { kind: 'uydurma_tur', ts: Date.now() }],
    sent_at: Date.now()
  }, { ua: IPHONE, headers: { 'CF-IPCountry': 'TR', 'CF-IPCity': 'Istanbul' } });
  assert.equal(res.status, 204);
  const s = await dbAsync.get('SELECT * FROM track_sessions WHERE id = ?', [sid]);
  assert.ok(s, 'oturum yazılmalı');
  assert.equal(s.channel, 'arama');
  assert.equal(s.referrer, 'https://www.google.com/', 'arama motorunda yalnızca alan adı saklanmalı');
  assert.equal(s.device, 'mobile');
  assert.equal(s.os, 'iOS');
  assert.equal(s.country, 'TR');
  assert.equal(s.city, 'Istanbul');
  assert.equal(s.visitor_id, null, 'onaysız ziyaretçide kalıcı kimlik olmamalı');
  assert.equal(s.pageviews, 1);
  assert.equal(s.interacted, 1);
  assert.ok(s.ip_hash && !s.ip_hash.includes('.'), 'ham IP saklanmamalı');
  const events = await dbAsync.all('SELECT kind FROM track_events WHERE session_id = ?', [sid]);
  assert.deepEqual(events.map(e => e.kind).sort(), ['page_view', 'service_search'], 'liste dışı tür atılmalı');
});

test('botlar, otomasyon tarayıcısı ve /admin yolu kaydedilmez; bot sayacı artar', async () => {
  const bots = [
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0 Safari/537.36',
    'curl/8.4.0'
  ];
  for (const ua of bots) {
    const sid = newId();
    await track({ sid, ctx: { path: '/' }, events: [pageView('/')] }, { ua });
    assert.equal(await dbAsync.get('SELECT 1 FROM track_sessions WHERE id = ?', [sid]), undefined, ua);
  }
  const wd = newId();
  await track({ sid: wd, wd: true, ctx: { path: '/' }, events: [pageView('/')] });
  assert.equal(await dbAsync.get('SELECT 1 FROM track_sessions WHERE id = ?', [wd]), undefined, 'navigator.webdriver');
  const adm = newId();
  await track({ sid: adm, ctx: { path: '/admin' }, events: [pageView('/admin')] });
  assert.equal(await dbAsync.get('SELECT 1 FROM track_sessions WHERE id = ?', [adm]), undefined, '/admin');
  const sayac = await dbAsync.get('SELECT SUM(hits) n FROM track_bot_daily');
  assert.ok(sayac.n >= 4);
});

test('giriş yapmış yönetici izlenmez; tarayıcısı işaretlenir ve eski izleri silinir', async () => {
  const vid = newId();
  const once = newId();
  await track({ sid: once, vid, consent: true, ctx: { path: '/' }, events: [pageView('/')] });
  assert.ok(await dbAsync.get('SELECT 1 FROM track_sessions WHERE id = ?', [once]), 'giriş öncesi anonim gezinti yazılır');
  const admin = await adminAgent();
  await track({ sid: newId(), vid, consent: true, ctx: { path: '/' }, events: [pageView('/')] }, { agent: admin });
  assert.equal(await dbAsync.get('SELECT 1 FROM track_sessions WHERE visitor_id = ?', [vid]), undefined, 'yönetici tarayıcısının izleri silinmeli');
  // Cikis yapsa bile ayni tarayici artik yazilmaz.
  const sonra = newId();
  await track({ sid: sonra, vid, consent: true, ctx: { path: '/' }, events: [pageView('/')] });
  assert.equal(await dbAsync.get('SELECT 1 FROM track_sessions WHERE id = ?', [sonra]), undefined);
});

test('çerez onayıyla ziyaretçi bağlanır; kayıt anında ilk temas kaynağı kaydedilir', async () => {
  const vid = newId();
  const ilk = newId();
  await track({
    sid: ilk, vid, consent: true, hi: true,
    ctx: { path: '/instagram-takipci-satin-al', referrer: 'https://l.instagram.com/', utm: { source: 'instagram', medium: 'bio', campaign: 'ekim-kampanya' } },
    events: [pageView('/instagram-takipci-satin-al')]
  });
  const ikinci = newId();
  await track({ sid: ikinci, vid, consent: true, hi: true, ctx: { path: '/register', referrer: '' }, events: [pageView('/register'), { kind: 'auth_view', label: 'register', ts: Date.now() }] });
  const s2 = await dbAsync.get('SELECT * FROM track_sessions WHERE id = ?', [ikinci]);
  assert.equal(s2.is_new, 0, 'aynı tarayıcının ikinci ziyareti geri dönen sayılmalı');
  assert.equal(s2.channel, 'dogrudan');

  const agent = request.agent(app);
  const reg = await agent.post('/api/auth/register').set('User-Agent', CHROME).set('X-Track-Sid', ikinci)
    .send({ username: 'izci_kullanici', email: 'izci@example.com', password: 'CokGucluSifre_123' });
  assert.equal(reg.status, 201, reg.body.error);
  const user = await dbAsync.get("SELECT id FROM users WHERE username = 'izci_kullanici'");
  // Kayit rotasi izleme yazimini beklemez (yanit gecikmesin); kisa sure yoklanir.
  let s;
  for (let i = 0; i < 40; i++) {
    s = await dbAsync.get('SELECT * FROM track_sessions WHERE id = ?', [ikinci]);
    if (s.did_register === 1 && await dbAsync.get('SELECT 1 FROM user_acquisition WHERE user_id = ?', [user.id])) break;
    await new Promise(r => setTimeout(r, 50));
  }
  assert.equal(s.did_register, 1);
  assert.equal(s.user_id, user.id);
  const a = await dbAsync.get('SELECT * FROM user_acquisition WHERE user_id = ?', [user.id]);
  assert.ok(a, 'kazanım kaydı oluşmalı');
  assert.equal(a.first_session_id, ilk);
  assert.equal(a.first_channel, 'kampanya');
  assert.equal(a.first_campaign, 'ekim-kampanya');
  assert.equal(a.first_landing, '/instagram-takipci-satin-al');
  assert.equal(a.reg_session_id, ikinci);
  assert.equal(a.sessions_before, 2);
  // Kayit oncesi anonim gezinmeler de kullaniciya baglanir.
  const ilkSatir = await dbAsync.get('SELECT user_id FROM track_sessions WHERE id = ?', [ilk]);
  assert.equal(ilkSatir.user_id, user.id);
});

test('reklam tıklaması reklam kanalına, davet kodu davet kanalına düşer', async () => {
  const r = newId();
  await track({ sid: r, ctx: { path: '/', click_type: 'google', click_id: 'abc123', referrer: 'https://www.google.com/' }, events: [pageView('/')] });
  const d = newId();
  await track({ sid: d, ctx: { path: '/register', ref: 'ali' }, events: [pageView('/register')] });
  assert.equal((await dbAsync.get('SELECT channel FROM track_sessions WHERE id = ?', [r])).channel, 'reklam');
  assert.equal((await dbAsync.get('SELECT channel FROM track_sessions WHERE id = ?', [d])).channel, 'davet');
});

test('admin ayak izi uçları: genel bakış, oturumlar, detay, canlı, kullanıcılar', async () => {
  const admin = await adminAgent();
  const ov = await admin.get('/api/admin/footprint/overview?range=7');
  assert.equal(ov.status, 200, ov.body.error);
  assert.ok(ov.body.summary.sessions >= 3);
  assert.ok(ov.body.summary.registered >= 1);
  assert.ok(ov.body.summary.bots >= 4);
  assert.ok(ov.body.channels.some(c => c.k === 'arama'));
  assert.ok(ov.body.searches.some(s => s.term === 'instagram takipçi'));
  assert.equal(ov.body.funnel[0].key, 'visit');

  const list = await admin.get('/api/admin/footprint/sessions?range=7&registered=1');
  assert.equal(list.status, 200);
  assert.ok(list.body.sessions.length >= 1);
  assert.ok(list.body.sessions.every(s => s.did_register === 1));

  const detay = await admin.get(`/api/admin/footprint/sessions/${list.body.sessions[0].id}`);
  assert.equal(detay.status, 200);
  assert.ok(detay.body.events.some(e => e.kind === 'register_success'));
  assert.ok(detay.body.acquisition);

  const canli = await admin.get('/api/admin/footprint/live');
  assert.equal(canli.status, 200);
  assert.ok(canli.body.count >= 1);

  const users = await admin.get('/api/admin/footprint/users?range=7');
  assert.equal(users.status, 200);
  const u = users.body.users.find(x => x.username === 'izci_kullanici');
  assert.equal(u.first_channel, 'kampanya');
  const yolculuk = await admin.get(`/api/admin/footprint/users/${u.id}`);
  assert.equal(yolculuk.status, 200);
  assert.ok(yolculuk.body.sessions.length >= 2);
});

test('admin olmayan ayak izine erişemez', async () => {
  assert.equal((await request(app).get('/api/admin/footprint/overview')).status, 401);
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'demo_user', password: 'user12345' });
  assert.equal((await agent.get('/api/admin/footprint/overview')).status, 403);
});

test('geçersiz oturum kimliği ve bozuk gövde sessizce yok sayılır', async () => {
  const res = await track({ sid: 'kisa', events: [pageView('/')] });
  assert.equal(res.status, 204);
  const res2 = await request(app).post('/api/track').set('User-Agent', CHROME).set('Content-Type', 'application/json').send('{bozuk');
  assert.ok([204, 400].includes(res2.status));
});

test('bağlamsız paket önce gelirse giriş bilgisi sonradan gelen bağlamla doldurulur', async () => {
  const sid = newId();
  await track({ sid, events: [{ kind: 'click', label: 'Kabul et', ts: Date.now() }] });
  let s = await dbAsync.get('SELECT * FROM track_sessions WHERE id = ?', [sid]);
  assert.equal(s.entry_path, null);
  await track({ sid, ctx: { path: '/kampanya', referrer: '', utm: { source: 'telegram', campaign: 'yaz' } }, events: [pageView('/kampanya')] });
  s = await dbAsync.get('SELECT * FROM track_sessions WHERE id = ?', [sid]);
  assert.equal(s.entry_path, '/kampanya');
  assert.equal(s.channel, 'kampanya');
  assert.equal(s.utm_campaign, 'yaz');
});

test('404 sayfasında tarayıcı aynı adrese yeniden yüklenmez (sonsuz döngü düzeltmesi)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
  assert.match(src, /!SPA_ROTALARI\.includes\(route\) && !document\.getElementById\(`view-\$\{route\}`\)\) \{[\s\S]{0,400}this\.navigate\('not-found', false\)/);
});
