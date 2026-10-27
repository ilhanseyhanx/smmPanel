'use strict';

// DIJITAL URUN GORSEL GALERISI
//
// Her marka/kategori icin 3 cesit gorsel (800x500 WebP) uretir:
//   1 Renkli  — marka renginde zemin, beyaz logo
//   2 Neo     — sitenin sari/siyah neo dili, cerceveli logo karosu + ad
//   3 Koyu    — koyu zemin, marka renginde isik
// Admin, Dijital Urunler'de urun eklerken/duzenlerken bu galeriden secer
// (public/js/admin-digital.js). Galeri listesi: public/dijital-gorseller/gorseller.json
//
// Logolar acik lisansli kaynaklardan indirilir ve scripts/digital-visuals/icons/
// altinda saklanir (yeniden uretim icin internet gerekmez):
//   - Simple Icons (CC0 1.0)              https://simpleicons.org
//   - Font Awesome Free (ikonlar CC BY 4.0) https://fontawesome.com
// Marka adlari ve logolari sahiplerine aittir; yalnizca urunu tanitmak icin kullanilir.
//
// Kullanim (LOKAL, Chrome gerekir):
//   node scripts/digital-visuals.js            -> eksik gorselleri uretir
//   node scripts/digital-visuals.js --force    -> hepsini yeniden uretir

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const KOK = path.join(__dirname, '..');
const IKON_DIR = path.join(__dirname, 'digital-visuals', 'icons');
const CIKTI_DIR = path.join(KOK, 'public', 'dijital-gorseller');
const MANIFEST = path.join(CIKTI_DIR, 'gorseller.json');
const FORCE = process.argv.includes('--force');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SI = 'https://cdn.jsdelivr.net/npm/simple-icons@13.21.0/icons/';
const FA = 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.1/svgs/';
const W = 800;
const H = 500;

// Sira onemli: oneri listesinde ozel markalar genel kategorilerden once gelir.
// keywords: urun adi + kategori (kucuk harf) icinde aranir.
const BRANDS = [
  ['instagram', 'Instagram', '#FF0069', 'si:instagram', ['instagram']],
  ['gmail', 'Gmail', '#EA4335', 'si:gmail', ['gmail']],
  ['x', 'X (Twitter)', '#000000', 'si:x', ['twitter', 'x (twitter)']],
  ['tiktok', 'TikTok', '#000000', 'si:tiktok', ['tiktok']],
  ['outlook', 'Outlook / Hotmail', '#0078D4', 'fab:microsoft', ['outlook', 'hotmail', 'microsoft']],
  ['facebook', 'Facebook', '#0866FF', 'si:facebook', ['facebook']],
  ['telegram', 'Telegram', '#26A5E4', 'si:telegram', ['telegram']],
  ['discord', 'Discord', '#5865F2', 'si:discord', ['discord']],
  ['threads', 'Threads', '#000000', 'si:threads', ['threads']],
  ['linkedin', 'LinkedIn', '#0A66C2', 'si:linkedin', ['linkedin']],
  ['twitch', 'Twitch', '#9146FF', 'si:twitch', ['twitch']],
  ['snapchat', 'Snapchat', '#FFFC00', 'si:snapchat', ['snapchat']],
  ['pinterest', 'Pinterest', '#BD081C', 'si:pinterest', ['pinterest']],
  ['youtube', 'YouTube', '#FF0000', 'si:youtube', ['youtube']],
  ['reddit', 'Reddit', '#FF4500', 'si:reddit', ['reddit']],
  ['yahoo', 'Yahoo Mail', '#6001D2', 'fab:yahoo', ['yahoo']],
  ['maildotcom', 'Mail.com', '#004788', 'si:maildotcom', ['mail.com']],
  ['gmx', 'GMX', '#1C449B', 'si:gmx', ['gmx']],
  ['windows', 'Windows', '#0078D4', 'fab:windows', ['windows']],
  ['office', 'Microsoft Office', '#D83B01', 'fab:microsoft', ['office']],
  ['coreldraw', 'CorelDRAW', '#009F4D', 'si:coreldraw', ['coreldraw', 'corel']],
  ['adobe', 'Adobe Acrobat', '#EC1C24', 'si:adobeacrobatreader', ['adobe', 'acrobat']],
  ['chatgpt', 'ChatGPT', '#10A37F', 'si:openai', ['chatgpt', 'gpt', 'openai', 'codex']],
  ['claude', 'Claude', '#D97757', 'si:claude', ['claude']],
  ['gemini', 'Gemini', '#8E75B2', 'si:googlegemini', ['gemini', 'google one']],
  ['grok', 'Grok', '#111111', 'fas:bolt', ['grok']],
  ['nordvpn', 'NordVPN', '#4687FF', 'si:nordvpn', ['nordvpn']],
  ['expressvpn', 'ExpressVPN', '#DA3940', 'si:expressvpn', ['expressvpn']],
  ['pia', 'Private Internet Access', '#4BB749', 'si:privateinternetaccess', ['pia vpn', 'private internet']],
  ['semrush', 'Semrush', '#FF642D', 'si:semrush', ['semrush']],
  ['envato', 'Envato', '#87E64B', 'si:envato', ['envato']],
  ['freepik', 'Freepik', '#1273EB', 'si:freepik', ['freepik']],
  ['netflix', 'Netflix', '#E50914', 'si:netflix', ['netflix']],
  ['duolingo', 'Duolingo', '#58CC02', 'si:duolingo', ['duolingo']],
  ['protonmail', 'Proton Mail', '#6D4AFF', 'si:protonmail', ['proton']],
  ['capcut', 'CapCut', '#111111', 'fas:scissors', ['capcut']],
  ['winrar', 'WinRAR', '#6D28D9', 'fas:file-zipper', ['winrar']],
  // Genel kategoriler (marka eslesmezse onerilir).
  ['vpn', 'VPN', '#16A34A', 'fas:shield-halved', ['vpn']],
  ['ai', 'Yapay Zekâ API', '#7C3AED', 'fas:robot', ['kimi', 'qwen', 'deepseek', 'glm', 'yapay zeka', 'ai api', ' api']],
  ['seo', 'SEO Araçları', '#F97316', 'fas:magnifying-glass-chart', ['seo', 'screaming frog']],
  ['design', 'Tasarım & Stok', '#EC4899', 'fas:palette', ['design', 'flaticon', 'motion array', 'stock']],
  ['email', 'E-posta Hesabı', '#0EA5E9', 'fas:envelope', ['firstmail', 'rambler', 'mail account', 'e-posta']],
  ['license', 'Lisans Anahtarı', '#F59E0B', 'fas:key', ['license', 'lifetime', 'retail', 'lisans']],
  ['premium', 'Premium Üyelik', '#A855F7', 'fas:crown', ['premium', 'subscription', 'super', 'pro ', 'üyelik']],
  ['account', 'Hazır Hesap', '#2563EB', 'fas:user-shield', ['account', 'hesap']]
].map(([slug, label, color, icon, keywords]) => ({ slug, label, color, icon, keywords }));

const VARIANTS = [
  { n: 1, label: 'Renkli' },
  { n: 2, label: 'Neo' },
  { n: 3, label: 'Koyu' }
];

// --- yardimcilar ------------------------------------------------------------

function luminance(hex) {
  const c = hex.replace('#', '').match(/../g).map(v => parseInt(v, 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

// Rengi beyaza dogru acar (koyu zeminde koyu markalar okunur olsun).
function lighten(hex, amount) {
  const c = hex.replace('#', '').match(/../g).map(v => parseInt(v, 16));
  return '#' + c.map(v => Math.round(v + (255 - v) * amount).toString(16).padStart(2, '0')).join('');
}

function iconUrl(icon) {
  const [set, name] = icon.split(':');
  if (set === 'si') return `${SI}${name}.svg`;
  return `${FA}${set === 'fab' ? 'brands' : 'solid'}/${name}.svg`;
}

async function ensureIcon(icon) {
  fs.mkdirSync(IKON_DIR, { recursive: true });
  const file = path.join(IKON_DIR, `${icon.replace(':', '-')}.svg`);
  if (!fs.existsSync(file)) {
    const res = await fetch(iconUrl(icon));
    if (!res.ok) throw new Error(`${icon} indirilemedi (${res.status})`);
    fs.writeFileSync(file, await res.text());
    console.log('indirildi', icon);
  }
  // Baslik ve yorumlar atilir; renk CSS'ten (fill) gelir.
  return fs.readFileSync(file, 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<title>[\s\S]*?<\/title>/g, '')
    .replace(/\sfill="[^"]*"/g, '')
    .replace(/<svg /, '<svg class="logo" ');
}

function esc(v) {
  return String(v).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
}

// --- sablon -----------------------------------------------------------------

function html(brand, variant, svg) {
  const color = brand.color;
  const light = luminance(color) > 0.6;        // sari Snapchat, acik yesil Envato...
  const dark = luminance(color) < 0.02;        // siyah markalar (X, TikTok, Threads)
  const tiktok = brand.slug === 'tiktok';
  let body;
  if (variant === 1) {
    const fill = light ? '#090909' : '#ffffff';
    const shadow = tiktok
      ? 'drop-shadow(-7px -6px 0 #25F4EE) drop-shadow(7px 6px 0 #FE2C55)'
      : `drop-shadow(10px 10px 0 rgba(0,0,0,${light ? '.18' : '.32'}))`;
    body = `<div class="v1" style="background:${color}">
      <div class="stripes"></div><div class="ring r1"></div><div class="ring r2"></div>
      <div class="center"><div class="logo-wrap" style="--fill:${fill};filter:${shadow}">${svg}</div></div>
    </div>`;
  } else if (variant === 2) {
    const fill = light ? '#090909' : color;
    body = `<div class="v2">
      <div class="grid"></div><div class="stamp">${esc(brand.label.toUpperCase())}</div>
      <div class="center col">
        <div class="tile" style="--fill:${fill}">${svg}</div>
        <div class="name">${esc(brand.label)}</div>
      </div>
    </div>`;
  } else {
    // Koyu zeminde koyu marka rengi (Mail.com, GMX, Yahoo...) okunmuyordu:
    // dusuk parlakliktaki renk beyaza dogru acilir.
    const glow = dark ? '#ffffff' : color;
    const fill = dark ? '#ffffff' : (luminance(color) < 0.14 ? lighten(color, 0.45) : color);
    body = `<div class="v3" style="--glow:${glow}">
      <div class="glow"></div><div class="grid light"></div>
      <div class="center"><div class="logo-wrap" style="--fill:${fill};filter:drop-shadow(0 0 34px ${glow}aa)${tiktok ? ' drop-shadow(-5px -4px 0 #25F4EE) drop-shadow(5px 4px 0 #FE2C55)' : ''}">${svg}</div></div>
      <div class="bar" style="background:${glow}"></div>
    </div>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:${W}px;height:${H}px;overflow:hidden}
    body>div{position:relative;width:${W}px;height:${H}px;overflow:hidden}
    .center{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
    .col{flex-direction:column;gap:30px}
    .logo-wrap{width:210px;height:210px;display:flex;align-items:center;justify-content:center}
    .logo{width:100%;height:100%;fill:var(--fill)}
    .stripes{position:absolute;inset:0;background:repeating-linear-gradient(135deg,rgba(255,255,255,.08) 0 26px,transparent 26px 52px)}
    .ring{position:absolute;border-radius:50%;border:10px solid rgba(0,0,0,.16)}
    .r1{width:420px;height:420px;right:-150px;bottom:-190px}
    .r2{width:220px;height:220px;left:-80px;top:-90px;border-color:rgba(255,255,255,.18)}
    .v2{background:#ffde17}
    .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(9,9,9,.09) 2px,transparent 2px),linear-gradient(90deg,rgba(9,9,9,.09) 2px,transparent 2px);background-size:50px 50px}
    .grid.light{background-image:linear-gradient(rgba(255,255,255,.05) 2px,transparent 2px),linear-gradient(90deg,rgba(255,255,255,.05) 2px,transparent 2px)}
    .tile{width:200px;height:200px;background:#fff;border:8px solid #090909;box-shadow:16px 16px 0 #090909;display:flex;align-items:center;justify-content:center;padding:36px}
    .tile .logo{fill:var(--fill)}
    .name{font:900 46px/1 'Arial Black','Segoe UI',Arial,sans-serif;letter-spacing:-1.5px;color:#090909;text-align:center;max-width:700px}
    .stamp{position:absolute;top:26px;right:-60px;transform:rotate(18deg);padding:8px 80px;background:#ed2d2d;color:#fff;border:5px solid #090909;font:900 18px/1 'Segoe UI',Arial,sans-serif;letter-spacing:3px;white-space:nowrap;max-width:none}
    .v3{background:#0b0e14}
    .glow{position:absolute;inset:-20%;background:radial-gradient(circle at 50% 50%,var(--glow) 0%,transparent 46%);opacity:.38}
    .bar{position:absolute;left:0;right:0;bottom:0;height:12px}
  </style></head><body>${body}</body></html>`;
}

// --- Chrome (CDP) -----------------------------------------------------------

async function openChrome() {
  const port = 9400 + Math.floor(Math.random() * 400);
  const profile = path.join(require('os').tmpdir(), `dv-profile-${Date.now()}`);
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    await new Promise(r => setTimeout(r, 250));
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'); } catch { /* bekle */ }
  }
  if (!target) throw new Error('Chrome acilamadi');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  let seq = 0;
  const pending = new Map();
  const waiters = [];
  ws.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Page.loadEventFired') waiters.splice(0).forEach(fn => fn());
  });
  const send = (method, params = {}) => new Promise(resolve => { const id = ++seq; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  return {
    async render(markup, file) {
      const loaded = new Promise(r => waiters.push(r));
      await send('Page.navigate', { url: `data:text/html;base64,${Buffer.from(markup).toString('base64')}` });
      await loaded;
      await new Promise(r => setTimeout(r, 60));
      const shot = await send('Page.captureScreenshot', { format: 'webp', quality: 82, clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
      fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
    },
    close() { ws.close(); chrome.kill(); }
  };
}

(async () => {
  fs.mkdirSync(CIKTI_DIR, { recursive: true });
  const svgs = new Map();
  for (const b of BRANDS) if (!svgs.has(b.icon)) svgs.set(b.icon, await ensureIcon(b.icon));

  const chrome = await openChrome();
  let made = 0;
  const manifest = [];
  try {
    for (const b of BRANDS) {
      for (const v of VARIANTS) {
        const name = `${b.slug}-${v.n}.webp`;
        const file = path.join(CIKTI_DIR, name);
        if (FORCE || !fs.existsSync(file)) {
          await chrome.render(html(b, v.n, svgs.get(b.icon)), file);
          made++;
        }
        manifest.push({ id: `${b.slug}-${v.n}`, file: `/dijital-gorseller/${name}`, brand: b.slug, label: b.label, variant: v.n, variant_label: v.label, keywords: b.keywords });
      }
    }
  } finally {
    chrome.close();
  }
  fs.writeFileSync(MANIFEST, JSON.stringify({
    note: 'scripts/digital-visuals.js ile uretilir. Logolar: Simple Icons (CC0 1.0), Font Awesome Free (CC BY 4.0). Marka adlari ve logolari sahiplerine aittir.',
    brands: BRANDS.map(b => b.slug),
    images: manifest
  }, null, 1));
  const size = manifest.reduce((t, m) => t + fs.statSync(path.join(KOK, 'public', m.file)).size, 0);
  console.log(`${made} gorsel uretildi, galeride ${manifest.length} gorsel (${Math.round(size / 1024)} KB).`);
})().catch(err => { console.error(err); process.exit(1); });
