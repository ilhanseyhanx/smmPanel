/**
 * Guvenlik sertlestirmeleri icin regresyon testleri.
 * Kapsam: SSRF (yonlendirme + DNS rebinding + birebir IP), ozel ag IP tespiti,
 * giris zamanlama sizintisi, admin girdi dogrulamasi ve istemci HTML kacislari.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const axios = require('axios');
const request = require('supertest');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smmpanel-hardening-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-and-not-production';
process.env.ENABLE_DEMO_PAYMENTS = 'false';
process.env.ALLOW_PRIVATE_PROVIDER_URLS = 'false';

const { app } = require('../server');
const { initDatabase, db } = require('../config/database');
const { isPrivateIp, safeRequestConfig } = require('../utils/network');

test.before(async () => { await initDatabase(); });
test.after(async () => {
  await new Promise(resolve => db.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

// --- SSRF ------------------------------------------------------------------

test('isPrivateIp özel, loopback, link-local ve CGNAT aralıklarını yakalar', () => {
  const privateOnes = ['127.0.0.1', '10.0.0.5', '172.16.0.1', '192.168.1.1', '169.254.169.254',
    '100.64.0.1', '0.0.0.0', '224.0.0.1', '198.18.0.1', '::1', '::ffff:127.0.0.1', 'fd00::1', 'fe80::1'];
  const publicOnes = ['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.32.0.1', '2606:4700::1111'];
  for (const ip of privateOnes) assert.equal(isPrivateIp(ip), true, `${ip} özel sayılmalıydı`);
  for (const ip of publicOnes) assert.equal(isPrivateIp(ip), false, `${ip} genel sayılmalıydı`);
});

test('güvenli istek yapılandırması özel ağa erişimi her yoldan engeller', async t => {
  const secret = http.createServer((req, res) => res.end('GIZLI-IC-VERI'));
  await new Promise(resolve => secret.listen(0, '127.0.0.1', resolve));
  const secretPort = secret.address().port;

  // Birebir IP'ye yonlendiren sunucu
  const redirectToIp = http.createServer((req, res) => {
    res.writeHead(302, { Location: `http://127.0.0.1:${secretPort}/` });
    res.end();
  });
  // Hostname'e yonlendiren sunucu (DNS uzerinden ozel adrese cikar)
  const redirectToHost = http.createServer((req, res) => {
    res.writeHead(302, { Location: `http://localhost:${secretPort}/` });
    res.end();
  });
  await new Promise(resolve => redirectToIp.listen(0, '127.0.0.1', resolve));
  await new Promise(resolve => redirectToHost.listen(0, '127.0.0.1', resolve));

  t.after(() => { secret.close(); redirectToIp.close(); redirectToHost.close(); });

  const expectBlocked = async (label, url) => {
    await assert.rejects(
      () => axios.get(url, safeRequestConfig({ timeout: 5000 })),
      error => {
        assert.ok(!String(error.response?.data || '').includes('GIZLI-IC-VERI'), `${label}: iç veri sızdı`);
        return true;
      },
      `${label} engellenmeliydi`
    );
  };

  await expectBlocked('doğrudan özel IP', `http://127.0.0.1:${secretPort}/`);
  await expectBlocked('özel IP’ye yönlendirme', `http://127.0.0.1:${redirectToIp.address().port}/`);
  await expectBlocked('hostname ile yönlendirme', `http://127.0.0.1:${redirectToHost.address().port}/`);

  // Kontrol: koruma olmadan ayni adres gercekten erisilebilir durumda.
  const unguarded = await axios.get(`http://127.0.0.1:${secretPort}/`, { timeout: 5000 });
  assert.equal(unguarded.data, 'GIZLI-IC-VERI');
});

test('geliştirme ortamında özel sağlayıcı adreslerine bilinçli olarak izin verilebilir', async t => {
  const server = http.createServer((req, res) => res.end('YEREL-MOCK'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());

  const previous = process.env.ALLOW_PRIVATE_PROVIDER_URLS;
  process.env.ALLOW_PRIVATE_PROVIDER_URLS = 'true';
  t.after(() => { process.env.ALLOW_PRIVATE_PROVIDER_URLS = previous; });

  const response = await axios.get(`http://127.0.0.1:${server.address().port}/`, safeRequestConfig({ timeout: 5000 }));
  assert.equal(response.data, 'YEREL-MOCK');
});

// --- Kullanici enumerasyonu ------------------------------------------------

test('giriş, var olmayan kullanıcıda da parola karşılaştırması yapar', async () => {
  const measure = async username => {
    const started = process.hrtime.bigint();
    const response = await request(app).post('/api/auth/login').send({ username, password: 'YanlisSifre_12345' });
    return { ms: Number(process.hrtime.bigint() - started) / 1e6, status: response.status };
  };

  const existing = await measure('admin');
  const missing = await measure('kesinlikle_olmayan_kullanici');

  assert.equal(existing.status, 401);
  assert.equal(missing.status, 401);
  // Var olmayan kullanicida bcrypt atlanirsa yanit neredeyse anlik olurdu.
  // Gercek bir bcrypt karsilastirmasi en az birkac on milisaniye surer.
  assert.ok(missing.ms > 25, `var olmayan kullanıcı çok hızlı reddedildi (${missing.ms.toFixed(1)} ms)`);
});

// --- Admin girdi dogrulamasi -----------------------------------------------

test('admin bakiye ucu geçersiz tutar ve kullanıcı numarasını reddeder', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin12345' });
  await agent.post('/api/admin/change-password').send({ current_password: 'admin12345', new_password: 'GuvenliAdminSifre_2026' });
  await agent.post('/api/auth/login').send({ username: 'admin', password: 'GuvenliAdminSifre_2026' });

  assert.equal((await agent.post('/api/admin/users/1/balance').send({ amount: -50, action: 'add' })).status, 400);
  assert.equal((await agent.post('/api/admin/users/1/balance').send({ amount: 'abc', action: 'add' })).status, 400);
  assert.equal((await agent.post('/api/admin/users/1/balance').send({ amount: 10, action: 'hack' })).status, 400);
  assert.equal((await agent.post('/api/admin/users/abc/balance').send({ amount: 10, action: 'add' })).status, 400);
  assert.equal((await agent.post('/api/admin/users/999999/balance').send({ amount: 10, action: 'add' })).status, 404);
});

test('toplu servis silme yalnızca gerçek boolean true ile tümünü kapsar', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'admin', password: 'GuvenliAdminSifre_2026' });

  // "false" metni coerce edilip true'ya donuserek tum servisleri pasife almamali.
  const spoofed = await agent.post('/api/admin/services/bulk-delete').send({ delete_all: 'false' });
  assert.equal(spoofed.status, 400, '"false" metni delete_all olarak kabul edilmemeli');

  assert.equal((await agent.post('/api/admin/services/bulk-delete').send({})).status, 400);
  assert.equal((await agent.post('/api/admin/services/bulk-delete').send({ service_ids: ['abc'] })).status, 400);
});

test('site ayarları yalnızca izinli anahtar ve geçerli kuru kabul eder', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'admin', password: 'GuvenliAdminSifre_2026' });

  assert.equal((await agent.post('/api/admin/settings').send({ usd_try_rate: 'bes-lira' })).status, 400);
  assert.equal((await agent.post('/api/admin/settings').send({ usd_try_rate: '0' })).status, 400);
  assert.equal((await agent.post('/api/admin/settings').send({ usd_try_rate: '41.5' })).status, 200);

  // Kur alani bos birakildiginda form kaydi tamamen reddedilmemeli;
  // diger ayarlar yazilmali, onceki kur korunmali.
  const withBlankRate = await agent.post('/api/admin/settings').send({ usd_try_rate: '', site_name: 'Panelim' });
  assert.equal(withBlankRate.status, 200);
  const afterBlank = (await agent.get('/api/admin/settings')).body.settings;
  assert.equal(afterBlank.site_name, 'Panelim');
  assert.equal(afterBlank.usd_try_rate, '41.5');

  // Izinsiz anahtar sessizce yok sayilir, yazilmaz.
  assert.equal((await agent.post('/api/admin/settings').send({ evil_key: 'x' })).status, 200);
  const settings = (await agent.get('/api/admin/settings')).body.settings;
  assert.equal(settings.evil_key, undefined);
  assert.equal(settings.usd_try_rate, '41.5');
});

// --- Istemci tarafi HTML kacisi --------------------------------------------

test('istemci şablonlarında kullanıcı verisi kaçışsız basılmaz', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');

  // Siparis hedefi (kullanici girdisi) dogrudan href icine yazilmamali.
  assert.ok(!/href="\$\{o\.link\}"/.test(source), 'o.link kaçışsız biçimde href içine basılıyor');
  assert.ok(source.includes('renderOrderLink('), 'sipariş bağlantısı güvenli yardımcı ile render edilmeli');

  // Sik kullanilan kullanici alanlari kacissiz kalmamali.
  const rawInterpolations = [
    '${o.link}', '${m.message}', '${t.subject}', '${u.username}', '${u.email}',
    '${n.bank_name}', '${n.sender_name}', '${c.code}'
  ];
  for (const fragment of rawInterpolations) {
    assert.ok(!source.includes(fragment), `${fragment} kaçışsız olarak şablona basılıyor`);
  }
});

// --- Toast bildirimleri -----------------------------------------------------

test('kullanıcı bildirimleri engelleyici alert() yerine toast ile gösterilir', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
  const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const cssSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'style.css'), 'utf8');

  const remainingAlerts = appSource.match(/(?<![\w.$])alert\s*\(/g) || [];
  assert.equal(remainingAlerts.length, 0, 'app.js içinde hâlâ tarayıcı alert() çağrısı var');

  assert.match(appSource, /function showToast\(/, 'showToast tanımlı değil');
  assert.ok(appSource.includes('showToast('), 'showToast hiç kullanılmıyor');
  assert.ok(htmlSource.includes('id="toast-container"'), 'toast kabı index.html içinde yok');

  for (const cls of ['.toast-success', '.toast-error', '.toast-warning', '.toast-info', '.toast-progress']) {
    assert.ok(cssSource.includes(cls), `${cls} stili eksik`);
  }
});

test('onay ve girdi kutuları engelleyici confirm()/prompt() kullanmaz', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');

  // Yorum satırlarını ayıkla, sonra yerleşik tarayıcı diyaloglarını ara.
  const code = appSource
    .split('\n')
    .filter(line => !line.trim().startsWith('//'))
    .join('\n');
  const natives = code.match(/(^|[^\w.$])(confirm|prompt)\s*\(/gm) || [];
  assert.equal(natives.length, 0, 'app.js içinde hâlâ tarayıcı confirm()/prompt() çağrısı var');

  assert.match(appSource, /function confirmDialog\(/, 'confirmDialog tanımlı değil');
  assert.match(appSource, /function promptDialog\(/, 'promptDialog tanımlı değil');
});

test('her diyalog çağrısı await ile yapılır', () => {
  // Kritik: await unutulursa Promise nesnesi truthy olduğu için
  // "if (confirmDialog(...))" her zaman doğru olur ve yıkıcı işlem onaysız çalışır.
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
  const offenders = [];

  appSource.split('\n').forEach((line, index) => {
    if (line.trim().startsWith('//')) return;
    const callRe = /(confirmDialog|promptDialog)\s*\(/g;
    let match;
    while ((match = callRe.exec(line)) !== null) {
      const before = line.slice(0, match.index);
      if (/function\s+$/.test(before)) continue; // tanımın kendisi
      if (!/await/.test(before)) offenders.push(`${index + 1}: ${line.trim()}`);
    }
  });

  assert.deepEqual(offenders, [], `await'siz diyalog çağrısı bulundu:\n${offenders.join('\n')}`);
  assert.ok((appSource.match(/await\s+confirmDialog\(/g) || []).length > 0, 'hiç confirmDialog kullanımı yok');
});

test('toast mesajı HTML olarak yorumlanmaz', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
  const body = appSource.slice(appSource.indexOf('function showToast('), appSource.indexOf('class SmmApp'));
  // Sunucudan gelen hata metinleri de toast'a düştüğü için mesaj gövdesi
  // asla innerHTML ile yazılmamalıdır.
  assert.match(body, /messageEl\.textContent = text/, 'toast mesajı textContent ile yazılmıyor');
  assert.ok(!/messageEl\.innerHTML/.test(body), 'toast mesajı innerHTML ile yazılıyor');
});

test('escapeHtml öznitelik kırılmasına yol açan karakterleri kaçırır', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
  const match = source.match(/escapeHtml\(value\) \{[\s\S]*?\n {2}\}/);
  assert.ok(match, 'escapeHtml tanımı bulunamadı');

  const escapeHtml = new Function(`return function ${match[0]}`)();
  assert.equal(escapeHtml('abc" onmouseover="alert(1)'), 'abc&quot; onmouseover=&quot;alert(1)');
  assert.equal(escapeHtml("x' onfocus='alert(1)"), 'x&#39; onfocus=&#39;alert(1)');
  assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
  assert.equal(escapeHtml('a & b'), 'a &amp; b');
});
