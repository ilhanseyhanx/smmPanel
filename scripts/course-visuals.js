'use strict';

// EGITIM GORSELLERI URETICI (yalnizca LOKALDE calisir; sunucuda Edge yok)
//
// scripts/course-content/<slug>/ icerigindan, sitenin neo tasarim diliyle:
//   - kapak (TR + EN)          -> public/egitim/<slug>/kapak-<dil>-<ozet>.png  (1200x675, paylasim onizlemesi)
//   - ders infografigi (TR+EN) -> public/egitim/<slug>/ders-NN-<dil>-<ozet>.webp (1200x675)
// uretir ve hangi dosyanin nerede oldugunu scripts/course-content/<slug>/gorseller.json'a
// yazar (seed-course-content.js bu dosyayi okur).
//
// DOSYA ADINDAKI OZET: gorselin kaynak verisinden turetilir. Icerik degisince
// ad degisir; Cloudflare eski gorseli gunlerce tutmaz (bkz. services/shopier.js
// gorsel notu). Ayni veriden tekrar uretimde ad ayni kalir.
//
// Cizim: her gorsel bir HTML sayfasi olarak kurulur, Edge/Chrome headless'ta
// (CDP) acilir ve ekran goruntusu alinir. Yazi tipleri sitedekiyle ayni
// (Archivo Black, Outfit, IBM Plex Mono — Google Fonts), ikonlar Font Awesome.
//
// Kullanim: node scripts/course-visuals.js                (tum egitimler)
//           node scripts/course-visuals.js instagram-0dan-10k

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const KOK = path.join(__dirname, '..');
const ICERIK = path.join(__dirname, 'course-content');
const CIKTI = path.join(KOK, 'public', 'egitim');
const W = 1200;
const H = 675;

const PLATFORM = {
  instagram: { renk: '#e1306c', ikinci: '#ffde17', ikon: 'fa-brands fa-instagram', ad: 'Instagram' },
  tiktok: { renk: '#111111', ikinci: '#25f4ee', ikon: 'fa-brands fa-tiktok', ad: 'TikTok' },
  youtube: { renk: '#ff0033', ikinci: '#ffde17', ikon: 'fa-brands fa-youtube', ad: 'YouTube' },
  genel: { renk: '#1769e8', ikinci: '#ffde17', ikon: 'fa-solid fa-graduation-cap', ad: 'Social' }
};

const METIN = {
  tr: { kicker: 'JET SMM PANEL · EĞİTİM', ders: n => `${n} ders`, ucretsiz: n => `İlk ${n} ders ücretsiz`, dersNo: n => `DERS ${n}`, goreli: 'göreli ağırlık', site: 'jetsmmpanel.com/egitimler' },
  en: { kicker: 'JET SMM PANEL · COURSE', ders: n => `${n} lessons`, ucretsiz: n => `First ${n} lessons free`, dersNo: n => `LESSON ${n}`, goreli: 'relative weight', site: 'jetsmmpanel.com/egitimler' }
};

function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function ozet(veri) {
  return crypto.createHash('sha1').update(JSON.stringify(veri)).digest('hex').slice(0, 8);
}

// ---------------------------------------------------------------------------
// HTML SABLONLARI
// ---------------------------------------------------------------------------

function sayfa(govde, ekCss = '') {
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=IBM+Plex+Mono:wght@600;700&family=Outfit:wght@500;600;700;800&display=block" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{font-family:Outfit,Arial,sans-serif;color:#090909;background:#fffef8;
  background-image:linear-gradient(90deg,rgba(9,9,9,.06) 1px,transparent 1px),linear-gradient(rgba(9,9,9,.06) 1px,transparent 1px);background-size:32px 32px}
.mono{font-family:'IBM Plex Mono',monospace}
.arch{font-family:'Archivo Black',Arial Black,sans-serif}
${ekCss}
</style></head><body>${govde}</body></html>`;
}

function kapakHtml(course, lang) {
  const p = PLATFORM[course.platform] || PLATFORM.genel;
  const m = METIN[lang];
  const baslik = lang === 'en' ? course.title_en : course.title_tr;
  const slogan = lang === 'en' ? course.cover.tagline_en : course.cover.tagline_tr;
  const seviye = lang === 'en' ? course.level_en : course.level_tr;
  const uzun = baslik.length;
  const boy = uzun > 64 ? 46 : uzun > 48 ? 52 : uzun > 34 ? 60 : 70;
  const css = `
.zemin{position:absolute;inset:0;background:${p.renk}}
.desen{position:absolute;inset:0;background:repeating-linear-gradient(45deg,rgba(255,255,255,.07) 0 22px,transparent 22px 44px)}
.kart{position:absolute;left:48px;top:48px;width:760px;bottom:48px;background:#fffef8;border:5px solid #090909;box-shadow:14px 14px 0 #090909;padding:38px 40px;display:flex;flex-direction:column}
.kicker{display:inline-block;align-self:flex-start;padding:6px 12px;border:3px solid #090909;background:${p.ikinci};font-size:17px;font-weight:700;letter-spacing:.06em}
h1{margin-top:22px;font-size:${boy}px;line-height:1.02;letter-spacing:-.03em;text-transform:uppercase}
.slogan{margin-top:18px;font-size:25px;font-weight:600;line-height:1.3;color:#222}
.altlar{margin-top:auto;display:flex;gap:10px;flex-wrap:wrap}
.cip{padding:7px 12px;border:3px solid #090909;background:#fff;font-size:16px;font-weight:700;text-transform:uppercase}
.cip.y{background:#9af0b4}
.ikon{position:absolute;right:64px;top:86px;width:300px;height:300px;border:5px solid #090909;background:#fffef8;box-shadow:12px 12px 0 #090909;display:grid;place-items:center;transform:rotate(4deg)}
.ikon i{font-size:170px;color:${p.renk === '#111111' ? '#111' : p.renk}}
.etiket{position:absolute;right:70px;top:430px;padding:12px 18px;border:4px solid #090909;background:#ed2d2d;color:#fff;font-size:22px;transform:rotate(-5deg);box-shadow:7px 7px 0 #090909;max-width:300px;text-align:center}
.site{position:absolute;right:66px;bottom:58px;color:#fff;font-size:18px;font-weight:700;text-shadow:2px 2px 0 #090909}`;
  const govde = `<div class="zemin"></div><div class="desen"></div>
<div class="kart"><span class="kicker mono">${esc(m.kicker)}</span><h1 class="arch">${esc(baslik)}</h1>
<p class="slogan">${esc(slogan)}</p>
<div class="altlar"><span class="cip mono">${esc(m.ders(course.lessons.length))}</span><span class="cip mono">${esc(seviye)}</span><span class="cip y mono">${esc(m.ucretsiz(2))}</span></div></div>
<div class="ikon"><i class="${p.ikon}"></i></div>
<div class="etiket arch">${esc(p.ad)}</div>
<div class="site mono">${esc(m.site)}</div>`;
  return sayfa(govde, css);
}

function gorselGovde(v, lang) {
  const t = it => esc(lang === 'en' ? it.en : it.tr);
  const val = it => esc(lang === 'en' ? (it.value_en ?? it.value ?? '') : (it.value_tr ?? it.value ?? ''));
  const items = Array.isArray(v.items) ? v.items : [];
  switch (v.type) {
    case 'steps': {
      const n = items.length;
      return `<div class="steps">${items.map((it, i) => `<div class="step"><span class="no arch">${i + 1}</span><p>${t(it)}</p></div>${i < n - 1 ? '<i class="fa-solid fa-arrow-right ok"></i>' : ''}`).join('')}</div>`;
    }
    case 'checklist':
      return `<ul class="check ${items.length > 4 ? 'iki' : ''}">${items.map(it => `<li><span class="kutu"><i class="fa-solid fa-check"></i></span>${t(it)}</li>`).join('')}</ul>`;
    case 'compare': {
      const yanlis = items.slice(0, Math.ceil(items.length / 2));
      const dogru = items.slice(Math.ceil(items.length / 2));
      const bas = lang === 'en' ? ['WRONG', 'RIGHT'] : ['YANLIŞ', 'DOĞRU'];
      return `<div class="cmp"><div class="col kot"><b class="arch"><i class="fa-solid fa-xmark"></i> ${bas[0]}</b><ul>${yanlis.map(it => `<li>${t(it)}</li>`).join('')}</ul></div>
<div class="col iyi"><b class="arch"><i class="fa-solid fa-check"></i> ${bas[1]}</b><ul>${dogru.map(it => `<li>${t(it)}</li>`).join('')}</ul></div></div>`;
    }
    case 'timeline':
      return `<div class="tl"><div class="hat"></div>${items.map(it => `<div class="dur"><span class="nok"></span><b class="mono">${val(it)}</b><p>${t(it)}</p></div>`).join('')}</div>`;
    case 'bars': {
      const max = Math.max(1, ...items.map(it => Number(it.value) || 0));
      return `<div class="bars">${items.map(it => {
        const w = Math.max(6, Math.round(((Number(it.value) || 0) / max) * 100));
        return `<div class="bar"><span class="etk">${t(it)}</span><span class="cubuk"><i style="width:${w}%"></i></span></div>`;
      }).join('')}<small class="mono not">${esc(METIN[lang].goreli)}</small></div>`;
    }
    case 'funnel':
      return `<div class="fun">${items.map((it, i) => `<div class="kat" style="width:${100 - i * (60 / Math.max(1, items.length - 1))}%"><span class="arch">${i + 1}</span>${t(it)}</div>`).join('')}</div>`;
    default:
      return `<p>${esc(lang === 'en' ? v.title_en : v.title_tr)}</p>`;
  }
}

function dersGorselHtml(course, lessonIndex, lesson, lang) {
  const p = PLATFORM[course.platform] || PLATFORM.genel;
  const m = METIN[lang];
  const v = lesson.visual || { type: 'steps', items: [] };
  const baslik = lang === 'en' ? v.title_en : v.title_tr;
  const egitim = lang === 'en' ? course.title_en : course.title_tr;
  const css = `
.ust{position:absolute;left:0;right:0;top:0;height:74px;background:${p.renk};border-bottom:5px solid #090909;display:flex;align-items:center;gap:16px;padding:0 40px;color:#fff}
.ust .no{padding:6px 12px;border:3px solid #090909;background:${p.ikinci};color:#090909;font-size:18px;font-weight:700}
.ust .eg{font-size:20px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:2px 2px 0 rgba(0,0,0,.35)}
.ust i{margin-left:auto;font-size:34px}
h2{position:absolute;left:40px;right:40px;top:100px;font-size:${baslik.length > 40 ? 38 : 44}px;line-height:1.08;letter-spacing:-.02em}
.govde{position:absolute;left:40px;right:40px;top:${baslik.length > 40 ? 220 : 180}px;bottom:66px;display:flex;align-items:center;justify-content:center}
.alt{position:absolute;left:40px;right:40px;bottom:20px;display:flex;justify-content:space-between;font-size:15px;font-weight:700;color:#444}
.steps{display:flex;align-items:stretch;gap:12px;width:100%}
.step{flex:1;border:4px solid #090909;background:#fff;box-shadow:8px 8px 0 #090909;padding:22px 18px;display:flex;flex-direction:column;gap:14px;min-height:230px}
.step .no{display:grid;place-items:center;width:58px;height:58px;border:3px solid #090909;background:#ed2d2d;color:#fff;font-size:30px}
.step p{font-size:24px;font-weight:700;line-height:1.25}
.ok{align-self:center;font-size:30px}
.check{list-style:none;display:grid;gap:16px;width:100%;max-width:980px}
.check.iki{grid-template-columns:1fr 1fr}
.check li{display:flex;align-items:center;gap:16px;padding:16px 18px;border:3px solid #090909;background:#fff;box-shadow:6px 6px 0 #090909;font-size:24px;font-weight:700;line-height:1.2}
.kutu{flex:0 0 40px;height:40px;display:grid;place-items:center;border:3px solid #090909;background:#9af0b4;font-size:22px}
.cmp{display:grid;grid-template-columns:1fr 1fr;gap:28px;width:100%}
.col{border:4px solid #090909;box-shadow:9px 9px 0 #090909;padding:20px 24px}
.col b{display:block;font-size:28px;margin-bottom:12px}
.col ul{list-style:none;display:grid;gap:12px}
.col li{font-size:24px;font-weight:700;line-height:1.25;padding-left:22px;position:relative}
.col li::before{content:'';position:absolute;left:0;top:11px;width:10px;height:10px;background:#090909}
.kot{background:#ffd9d9}.kot b{color:#b91c1c}
.iyi{background:#d9f8e2}.iyi b{color:#15803d}
.tl{position:relative;display:flex;justify-content:space-between;gap:16px;width:100%;padding-top:20px}
.hat{position:absolute;left:4%;right:4%;top:44px;height:8px;background:#090909}
.dur{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px}
.nok{width:46px;height:46px;border:5px solid #090909;background:${p.ikinci};border-radius:50%;z-index:1}
.dur b{padding:4px 10px;border:3px solid #090909;background:#090909;color:#fff;font-size:18px}
.dur p{font-size:22px;font-weight:700;line-height:1.25;max-width:230px}
.bars{display:grid;gap:18px;width:100%;max-width:1040px}
.bar{display:grid;grid-template-columns:360px 1fr;align-items:center;gap:18px}
.etk{font-size:23px;font-weight:700;line-height:1.2}
.cubuk{height:44px;border:3px solid #090909;background:#fff}
.cubuk i{display:block;height:100%;background:${p.renk === '#111111' ? '#25f4ee' : p.renk};border-right:3px solid #090909}
.not{justify-self:end;color:#555;font-size:15px}
.fun{display:flex;flex-direction:column;align-items:center;gap:10px;width:100%}
.kat{display:flex;align-items:center;justify-content:center;gap:14px;min-height:72px;border:4px solid #090909;box-shadow:7px 7px 0 #090909;background:${p.ikinci};font-size:25px;font-weight:800;text-align:center;padding:0 18px}
.kat:nth-child(2){background:#9edcff}.kat:nth-child(3){background:#9af0b4}.kat:nth-child(4){background:#ffb3b3}
.kat span{display:grid;place-items:center;width:40px;height:40px;border:3px solid #090909;background:#fff;font-size:20px}`;
  const govde = `<div class="ust"><span class="no mono">${esc(m.dersNo(lessonIndex + 1))}</span><span class="eg">${esc(egitim)}</span><i class="${p.ikon}"></i></div>
<h2 class="arch">${esc(baslik)}</h2>
<div class="govde">${gorselGovde(v, lang)}</div>
<div class="alt mono"><span>JET SMM PANEL</span><span>${esc(m.site)}</span></div>`;
  return sayfa(govde, css);
}

// ---------------------------------------------------------------------------
// TARAYICI (CDP)
// ---------------------------------------------------------------------------

function tarayiciYolu() {
  const adaylar = [
    process.env.CHROME_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  ].filter(Boolean);
  const bulunan = adaylar.find(p => fs.existsSync(p));
  if (!bulunan) throw new Error('Edge/Chrome bulunamadı (CHROME_PATH ile yol verilebilir).');
  return bulunan;
}

async function tarayiciAc() {
  const port = 9400 + Math.floor(Math.random() * 400);
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'egitim-gorsel-'));
  const proc = spawn(tarayiciYolu(), ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, 'about:blank'], { stdio: 'ignore' });
  let hedef;
  for (let i = 0; i < 60 && !hedef; i++) {
    await new Promise(r => setTimeout(r, 300));
    try { hedef = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'); } catch {}
  }
  if (!hedef) throw new Error('Tarayıcıya bağlanılamadı.');
  const ws = new WebSocket(hedef.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  let sira = 0;
  const bekleyen = new Map();
  const olaylar = new Map();
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && bekleyen.has(m.id)) { bekleyen.get(m.id)(m); bekleyen.delete(m.id); }
    if (m.method && olaylar.has(m.method)) { olaylar.get(m.method)(m.params); olaylar.delete(m.method); }
  });
  const gonder = (method, params = {}) => new Promise((res, rej) => {
    const id = ++sira;
    bekleyen.set(id, m => (m.error ? rej(new Error(m.error.message)) : res(m.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
  const bekle = method => new Promise(res => olaylar.set(method, res));
  await gonder('Page.enable');
  await gonder('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  return {
    async cek(html, hedefDosya, format) {
      const gecici = path.join(profil, 'g.html');
      fs.writeFileSync(gecici, html);
      const yuklendi = bekle('Page.loadEventFired');
      await gonder('Page.navigate', { url: `file:///${gecici.split(path.sep).join('/')}` });
      await yuklendi;
      await gonder('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => true)', awaitPromise: true });
      await new Promise(r => setTimeout(r, 150));
      // Tasma denetimi: metin kutusundan tasan oge varsa uyar (kisaltma gerekir).
      const tasma = await gonder('Runtime.evaluate', {
        expression: `[...document.querySelectorAll('h1,h2,p,li,.etk,.kat,.slogan')].filter(e => e.scrollWidth > e.clientWidth + 2 || e.getBoundingClientRect().bottom > ${H} || e.getBoundingClientRect().right > ${W}).map(e => e.textContent.trim().slice(0, 40))`,
        returnByValue: true
      });
      const sonuc = await gonder('Page.captureScreenshot', {
        format, quality: format === 'webp' ? 86 : undefined,
        clip: { x: 0, y: 0, width: W, height: H, scale: 1 }
      });
      fs.writeFileSync(hedefDosya, Buffer.from(sonuc.data, 'base64'));
      return tasma.result.value || [];
    },
    kapat() {
      try { ws.close(); } catch {}
      proc.kill();
    }
  };
}

// ---------------------------------------------------------------------------
// ANA AKIS
// ---------------------------------------------------------------------------

async function main() {
  const istenen = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const sluglar = (istenen.length ? istenen : fs.readdirSync(ICERIK).filter(d => fs.existsSync(path.join(ICERIK, d, 'index.js'))));
  const tarayici = await tarayiciAc();
  const uyarilar = [];
  try {
    for (const slug of sluglar) {
      const course = require(path.join(ICERIK, slug, 'index.js'));
      const klasor = path.join(CIKTI, slug);
      fs.mkdirSync(klasor, { recursive: true });
      const manifest = { cover: {}, lessons: {} };
      for (const lang of ['tr', 'en']) {
        const veri = { v: 2, t: course[`title_${lang}`], s: course.cover[`tagline_${lang}`], n: course.lessons.length, l: course[`level_${lang}`], p: course.platform };
        const ad = `kapak-${lang}-${ozet(veri)}.png`;
        const tasma = await tarayici.cek(kapakHtml(course, lang), path.join(klasor, ad), 'png');
        if (tasma.length) uyarilar.push(`${slug} kapak-${lang}: taşma ${JSON.stringify(tasma)}`);
        manifest.cover[lang] = `/egitim/${slug}/${ad}`;
      }
      for (let i = 0; i < course.lessons.length; i++) {
        const lesson = course.lessons[i];
        manifest.lessons[lesson.slug] = {};
        for (const lang of ['tr', 'en']) {
          const veri = { v: 2, i, e: course[`title_${lang}`], vis: lesson.visual, lang, p: course.platform };
          const ad = `ders-${String(i + 1).padStart(2, '0')}-${lang}-${ozet(veri)}.webp`;
          const tasma = await tarayici.cek(dersGorselHtml(course, i, lesson, lang), path.join(klasor, ad), 'webp');
          if (tasma.length) uyarilar.push(`${slug} ders-${i + 1}-${lang}: taşma ${JSON.stringify(tasma)}`);
          manifest.lessons[lesson.slug][lang] = `/egitim/${slug}/${ad}`;
        }
      }
      // Artik kullanilmayan eski surumler silinir.
      const kullanilan = new Set([...Object.values(manifest.cover), ...Object.values(manifest.lessons).flatMap(o => Object.values(o))].map(u => path.basename(u)));
      for (const dosya of fs.readdirSync(klasor)) if (!kullanilan.has(dosya)) fs.unlinkSync(path.join(klasor, dosya));
      fs.writeFileSync(path.join(ICERIK, slug, 'gorseller.json'), JSON.stringify(manifest, null, 2) + '\n');
      console.log(`✓ ${slug}: 2 kapak + ${course.lessons.length * 2} ders görseli`);
    }
  } finally {
    tarayici.kapat();
  }
  if (uyarilar.length) {
    console.log('\nTAŞMA UYARILARI (metin kısaltılmalı):');
    uyarilar.forEach(u => console.log(' - ' + u));
    process.exitCode = 2;
  }
}

if (require.main === module) main().catch(err => { console.error(err); process.exit(1); });

module.exports = { kapakHtml, dersGorselHtml };
