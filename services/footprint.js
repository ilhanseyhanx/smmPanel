'use strict';

// ZIYARETCI AYAK IZI (5 Eki 2026)
//
// Her ziyaret bir OTURUM (track_sessions), oturumdaki her hareket bir ADIM
// (track_events). Amac yalnizca "kac kisi geldi" degil: nereden geldi, neye
// bakti, nerede takildi, ne aldi — ve bir kullanicinin kayit olana kadarki
// tam yolu (user_acquisition).
//
// CEREZ ONAYI (kullanici karari): "Kabul et" diyen ziyaretcinin tarayicisinda
// kalici bir kimlik (visitor_id) tutulur; tekrar gelisleri ayni kisiye baglanir.
// Onay vermeyen ya da henuz cevaplamayan ziyaretci ANONIM izlenir: oturum
// kimligi yalnizca o sekmenin sessionStorage'inda yasar, kalici kimlik yoktur.
// Giris yapmis kullanicinin oturumu hesabina baglanir (hizmet kaydi).
//
// AYIKLAMA: bilinen bot imzalari, otomasyon tarayicilari (navigator.webdriver)
// ve isletim sistemi/tarayici imzasi tasimayan istekler HIC yazilmaz (yalnizca
// gunluk sayaci artar). Yoneticinin kendi gezintisi de yazilmaz: giris yapmis
// yonetici, yoneticinin kullandigi tarayici kimlikleri ve /admin yolu.
//
// GIZLILIK: ham IP saklanmaz (HMAC ozeti). Form alanlarina yazilan degerler
// toplanmaz; yalnizca hizmet aramasindaki kelime tutulur. Arama motoru
// referanslarinda yalnizca alan adi saklanir. Kayitlar 90 gun sonra silinir.

const { createHmac } = require('crypto');
const { dbAsync } = require('../config/database');
const { optionalUser, JWT_SECRET } = require('../middleware/auth');

const SESSION_GAP_MS = 30 * 60 * 1000;
const MAX_EVENTS_PER_BATCH = 40;
const MAX_EVENTS_PER_SESSION = 800;
const ID_RE = /^[a-z0-9-]{16,40}$/i;
const SETTING_ADMIN_DEVICES = 'track_admin_visitors';

// Istemcinin gonderebilecegi adim turleri; listede olmayan sessizce atilir.
const CLIENT_KINDS = new Set([
  'page_view', 'page_leave', 'not_found',
  'service_search', 'service_view', 'click', 'outbound_click',
  'auth_view', 'register_submit', 'login_submit',
  'order_click', 'order_submit', 'topup_start', 'coupon_submit', 'ticket_submit',
  'course_buy_open', 'course_checkout',
  'api_error', 'js_error', 'rage_click',
  'lang_change', 'consent'
]);
// Sunucunun yazdigi (istemci engellense de kaybolmayan) basari adimlari.
const SERVER_KINDS = new Set([
  'register_success', 'login_success', 'topup_success', 'order_created',
  'course_purchase', 'ticket_created', 'coupon_redeemed'
]);
const ERROR_KINDS = new Set(['api_error', 'js_error', 'rage_click', 'not_found']);

// ---------------------------------------------------------------------------
// YARDIMCILAR
// ---------------------------------------------------------------------------

const text = (value, max) => {
  const s = String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
  return s || null;
};

function clientIp(req) {
  const cf = req.headers['cf-connecting-ip'];
  if (cf) return String(cf).trim();
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.ip || '';
}

const hashIp = ip => (ip ? createHmac('sha256', JWT_SECRET).update(`ip|${ip}`).digest('hex').slice(0, 24) : null);

function parseUserAgent(ua) {
  const s = String(ua || '');
  const device = /iPad|Tablet/i.test(s) ? 'tablet' : /Mobi|Android|iPhone/i.test(s) ? 'mobile' : 'desktop';
  const os = /Windows/i.test(s) ? 'Windows'
    : /Android/i.test(s) ? 'Android'
      : /iPhone|iPad|iOS/i.test(s) ? 'iOS'
        : /Mac OS X/i.test(s) ? 'macOS'
          : /CrOS/i.test(s) ? 'ChromeOS'
            : /Linux/i.test(s) ? 'Linux' : null;
  // Sira onemli: Edge/Opera/Samsung kendini Chrome, Chrome da Safari gibi tanitir.
  const browser = /Instagram/i.test(s) ? 'Instagram'
    : /FBAN|FBAV/i.test(s) ? 'Facebook'
      : /TikTok|musical_ly/i.test(s) ? 'TikTok'
        : /Edg\//i.test(s) ? 'Edge'
          : /OPR\/|Opera/i.test(s) ? 'Opera'
            : /SamsungBrowser/i.test(s) ? 'Samsung'
              : /YaBrowser/i.test(s) ? 'Yandex'
                : /Chrome\//i.test(s) ? 'Chrome'
                  : /Firefox\//i.test(s) ? 'Firefox'
                    : /Safari\//i.test(s) ? 'Safari' : null;
  return { device, os, browser };
}

// Bot imzalari. Yalnizca bota OZGU kaliplar: "yandex", "whatsapp" gibi adlar
// tek basina yazilmaz (gercek tarayicilari/uygulama ici tarayicilari var).
// "(compatible; ..." tarama botlarinin ortak imzasidir (eski MSIE haric).
// "Nexus 5X Build/MMB29P" Google'in mobil tarayicisinin taban kimligidir.
const BOT_UA = /bot\b|bots?\/|\(compatible;(?!\s*msie)|nexus 5x build\/mmb29p|googleother|google-inspectiontool|google-extended|google-read-aloud|google-pagerenderer|feedfetcher-google|mediapartners-google|apis-google|crawl|spider|scrap|slurp|headless|phantom|puppeteer|playwright|selenium|webdriver|curl\/|wget\/|python-requests|python-urllib|aiohttp|httpx|axios\/|node-fetch|go-http-client|java\/|okhttp|libwww|apache-httpclient|guzzle|postman|insomnia|facebookexternalhit|embedly|bingpreview|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|semrush|ahrefs|mj12|dotbot|petalbot|bytespider|dataforseo|serpstat|screaming frog|gptbot|claudebot|ccbot|oai-searchbot|perplexitybot|applebot|yandexbot|baiduspider|duckduckbot|telegrambot|whatsapp\/|preview/i;

function isBotRequest(req, body = {}) {
  const ua = String(req.headers['user-agent'] || '');
  if (ua.length < 20) return true;
  if (BOT_UA.test(ua)) return true;
  if (body && body.wd === true) return true; // navigator.webdriver: otomasyon tarayicisi
  const { os, browser } = parseUserAgent(ua);
  return !os && !browser;
}

async function countBot() {
  const day = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
  await dbAsync.run(
    'INSERT INTO track_bot_daily (day, hits) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET hits = hits + 1', [day]
  ).catch(() => {});
}

const ARAMA = /(^|\.)(google|bing|yandex|duckduckgo|yahoo|ecosia|search\.brave|baidu|startpage|qwant|yaani|naver|seznam)\./i;
const SOSYAL = /(^|\.)(t\.me|telegram|instagram|facebook|fb|twitter|x\.com|tiktok|youtube|youtu\.be|linkedin|pinterest|reddit|whatsapp|wa\.me|discord|twitch|threads|snapchat|vk)\./i;
const SOSYAL_TAM = new Set(['t.me', 'x.com', 'fb.com', 'wa.me', 'youtu.be', 'lnkd.in', 'l.instagram.com', 'lm.facebook.com', 'l.facebook.com', 'm.facebook.com']);

function siteHost() {
  try { return new URL(process.env.PUBLIC_BASE_URL || 'https://jetsmmpanel.com').hostname.replace(/^www\./, '').toLowerCase(); }
  catch { return ''; }
}

/** Referans adresini guvenli bicime getirir: arama motorunda yalnizca alan adi, digerlerinde sorgusuz yol. */
function normalizeReferrer(raw) {
  const s = String(raw || '').trim();
  if (!s) return { url: null, host: null };
  try {
    const u = new URL(s);
    if (!/^https?:$/.test(u.protocol)) return { url: null, host: null };
    const host = u.hostname.toLowerCase();
    if (ARAMA.test(host)) return { url: `${u.protocol}//${host}/`, host };
    return { url: `${u.protocol}//${host}${u.pathname}`.slice(0, 300), host };
  } catch {
    return { url: null, host: null };
  }
}

/**
 * Trafik kanali: reklam | eposta | davet | kampanya | arama | sosyal | yonlendiren | dogrudan
 * Oncelik: reklam tiklama kimligi > ucretli UTM > e-posta > davet kodu > UTM > referans.
 */
function classifyChannel({ clickId, utm = {}, referrerHost, refCode }) {
  const medium = String(utm.medium || '');
  if (clickId) return 'reklam';
  if (/cpc|ppc|paid|ads?$|display|cpm/i.test(medium)) return 'reklam';
  if (/e-?mail|e-?posta|newsletter/i.test(medium)) return 'eposta';
  if (refCode) return 'davet';
  if (utm.source) return 'kampanya';
  if (!referrerHost) return 'dogrudan';
  const own = siteHost();
  const host = referrerHost.replace(/^www\./, '');
  if (own && (host === own || host.endsWith(`.${own}`))) return 'dogrudan';
  if (ARAMA.test(referrerHost)) return 'arama';
  if (SOSYAL.test(referrerHost) || SOSYAL_TAM.has(referrerHost)) return 'sosyal';
  return 'yonlendiren';
}

function sourceLabel({ utm = {}, referrerHost, clickType, refCode }) {
  if (utm.source) return text(utm.source, 80);
  if (clickType) return clickType;
  if (referrerHost) return referrerHost.replace(/^www\./, '');
  if (refCode) return `davet:${refCode}`;
  return null;
}

/** Istemci saatini sunucu saatine cevirir (telefon saati kayik olabilir). */
function occurrenceClock(sentAt, now = Date.now()) {
  const sent = Number(sentAt);
  const skew = Number.isFinite(sent) && Math.abs(now - sent) < 24 * 3600 * 1000 ? now - sent : null;
  return ts => {
    const t = Number(ts);
    if (skew === null || !Number.isFinite(t)) return now;
    const at = Math.round(t + skew);
    if (at > now || now - at > SESSION_GAP_MS) return now;
    return at;
  };
}

// ---------------------------------------------------------------------------
// YONETICI IZLERI
// ---------------------------------------------------------------------------

let adminDevices = null;
async function loadAdminDevices() {
  const row = await dbAsync.get('SELECT value FROM site_settings WHERE key = ?', [SETTING_ADMIN_DEVICES]).catch(() => null);
  let ids = [];
  try { ids = row?.value ? JSON.parse(row.value) : []; } catch { ids = []; }
  adminDevices = new Set(Array.isArray(ids) ? ids.map(String) : []);
  return adminDevices;
}

async function saveAdminDevices() {
  await dbAsync.run(
    'INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [SETTING_ADMIN_DEVICES, JSON.stringify([...(adminDevices || [])].slice(-300))]
  );
}

async function deleteSessions(where, params) {
  await dbAsync.run(`DELETE FROM track_events WHERE session_id IN (SELECT id FROM track_sessions WHERE ${where})`, params);
  await dbAsync.run(`DELETE FROM track_sessions WHERE ${where}`, params);
}

/** Bir oturumu ve (varsa) tarayici kimligini yonetici izi olarak isaretleyip siler. */
async function purgeAdminTrace({ sessionId = null, visitorId = null } = {}) {
  if (!adminDevices) await loadAdminDevices();
  if (sessionId && ID_RE.test(sessionId)) {
    const s = await dbAsync.get('SELECT visitor_id FROM track_sessions WHERE id = ?', [sessionId]);
    if (s?.visitor_id) visitorId = visitorId || s.visitor_id;
    await deleteSessions('id = ?', [sessionId]);
  }
  if (visitorId && ID_RE.test(visitorId)) {
    if (!adminDevices.has(visitorId)) { adminDevices.add(visitorId); await saveAdminDevices(); }
    await deleteSessions('visitor_id = ?', [visitorId]);
  }
}

/** Acilista: yonetici hesaplarina bagli ve /admin yolundan gecen gecmis izler silinir. */
async function purgeAdminTraces() {
  await loadAdminDevices();
  const rows = await dbAsync.all(`SELECT DISTINCT s.visitor_id FROM track_sessions s JOIN users u ON u.id = s.user_id
    WHERE u.role = 'admin' AND s.visitor_id IS NOT NULL`).catch(() => []);
  let changed = false;
  for (const r of rows) if (!adminDevices.has(r.visitor_id)) { adminDevices.add(r.visitor_id); changed = true; }
  if (changed) await saveAdminDevices();
  const ids = [...adminDevices];
  const inList = ids.length ? `visitor_id IN (${ids.map(() => '?').join(',')})` : '0';
  await deleteSessions(`user_id IN (SELECT id FROM users WHERE role = 'admin') OR entry_path LIKE '/admin%' OR ${inList}`, ids).catch(() => {});
}

// ---------------------------------------------------------------------------
// ISTEMCI KAYDI: POST /api/track
// ---------------------------------------------------------------------------

// Oturumun giris baglamindan gelen alanlari (kaynak, UTM, dil, ekran...).
const CTX_COLUMNS = ['entry_path', 'exit_path', 'channel', 'source', 'referrer', 'referrer_host', 'utm_source', 'utm_medium',
  'utm_campaign', 'utm_term', 'utm_content', 'click_id', 'ref_code', 'lang', 'screen', 'timezone'];

function contextFields(req, ctx) {
  const ref = normalizeReferrer(ctx.referrer);
  const utm = ctx.utm && typeof ctx.utm === 'object' ? ctx.utm : {};
  const u = {
    source: text(utm.source, 100), medium: text(utm.medium, 100), campaign: text(utm.campaign, 150),
    term: text(utm.term, 150), content: text(utm.content, 150)
  };
  const clickType = ctx.click_type && /^(google|meta|tiktok|microsoft)$/.test(ctx.click_type) ? ctx.click_type : null;
  const clickId = text(ctx.click_id, 120);
  const refCode = text(ctx.ref, 40);
  return {
    entry_path: text(ctx.path, 200),
    exit_path: text(ctx.path, 200),
    channel: classifyChannel({ clickId, utm: u, referrerHost: ref.host, refCode }),
    source: sourceLabel({ utm: u, referrerHost: ref.host, clickType: clickType ? `${clickType} ads` : null, refCode }),
    referrer: ref.url,
    referrer_host: ref.host,
    utm_source: u.source, utm_medium: u.medium, utm_campaign: u.campaign, utm_term: u.term, utm_content: u.content,
    click_id: clickId ? `${clickType || 'click'}:${clickId}` : null,
    ref_code: refCode,
    lang: text(ctx.lang, 5),
    screen: text(ctx.screen, 20),
    timezone: text(ctx.tz, 50)
  };
}

/**
 * @param {import('express').Request} req
 * @param {object} body { sid, vid?, consent, hi, wd, ctx?, events[], sent_at }
 * @returns {Promise<{recorded: boolean, accepted?: number, reason?: string}>}
 */
async function record(req, body = {}) {
  const sid = String(body.sid || '');
  if (!ID_RE.test(sid)) return { recorded: false, reason: 'sid' };
  if (isBotRequest(req, body)) { await countBot(); return { recorded: false, reason: 'bot' }; }
  if (!adminDevices) await loadAdminDevices();

  const consent = body.consent === true || body.consent === 1;
  const vid = consent && ID_RE.test(String(body.vid || '')) ? String(body.vid) : null;
  const user = await optionalUser(req);

  // Yonetici izleri yazilmaz (ve bu tarayicinin eski izleri de silinir).
  if (user?.role === 'admin') { await purgeAdminTrace({ sessionId: sid, visitorId: vid }); return { recorded: false, reason: 'admin' }; }
  if (vid && adminDevices.has(vid)) return { recorded: false, reason: 'admin' };
  const ctx = body.ctx && typeof body.ctx === 'object' ? body.ctx : {};
  const events = Array.isArray(body.events) ? body.events.slice(0, MAX_EVENTS_PER_BATCH) : [];
  if (String(ctx.path || '').startsWith('/admin') || events.some(e => String(e?.path || '').startsWith('/admin'))) {
    return { recorded: false, reason: 'admin' };
  }

  let session = await dbAsync.get('SELECT * FROM track_sessions WHERE id = ?', [sid]);
  const hasCtx = Boolean(body.ctx && typeof body.ctx === 'object' && body.ctx.path);
  if (!session) {
    const f = contextFields(req, ctx);
    const isNew = vid ? !(await dbAsync.get('SELECT 1 FROM track_sessions WHERE visitor_id = ? LIMIT 1', [vid])) : true;
    const cols = ['id', 'visitor_id', 'user_id', 'consent', 'is_new', 'device', 'os', 'browser', 'country', 'city', 'ip_hash', ...CTX_COLUMNS];
    const ua = parseUserAgent(req.headers['user-agent']);
    const values = [sid, vid, user?.id || null, consent ? 1 : 0, isNew ? 1 : 0, ua.device, ua.os, ua.browser,
      text(req.headers['cf-ipcountry'], 2), text(req.headers['cf-ipcity'], 60), hashIp(clientIp(req)),
      ...CTX_COLUMNS.map(c => f[c])];
    await dbAsync.run(`INSERT OR IGNORE INTO track_sessions (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, values);
    session = await dbAsync.get('SELECT * FROM track_sessions WHERE id = ?', [sid]);
    if (!session) return { recorded: false, reason: 'db' };
  } else {
    if (hasCtx && !session.entry_path) {
      // Baglamli ilk paket, baglamsiz bir paketten sonra islendi (es zamanli
      // istek): bos kalan giris bilgileri simdi doldurulur.
      const f = contextFields(req, ctx);
      const cols = CTX_COLUMNS.filter(c => c !== 'exit_path'); // ilerlemis cikis sayfasi ezilmez
      await dbAsync.run(`UPDATE track_sessions SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ? AND entry_path IS NULL`,
        [...cols.map(c => f[c]), sid]);
    }
    if (vid && !session.visitor_id) {
      // Oturum sirasinda cerez onayi verildi: oturum kisiye baglanir.
      await dbAsync.run('UPDATE track_sessions SET visitor_id = ?, consent = 1 WHERE id = ?', [vid, sid]);
    }
  }

  const clock = occurrenceClock(body.sent_at);
  let accepted = 0;
  let pageviews = 0;
  let exitPath = null;
  let error = 0;
  const room = Math.max(0, MAX_EVENTS_PER_SESSION - Number(session.event_count || 0));
  for (const raw of events.slice(0, room)) {
    const kind = String(raw?.kind || '');
    if (!CLIENT_KINDS.has(kind)) continue;
    let meta = null;
    if (raw.meta && typeof raw.meta === 'object') {
      try { meta = JSON.stringify(raw.meta).slice(0, 800); } catch { meta = null; }
    }
    const path = text(raw.path, 200);
    try {
      await dbAsync.run(
        `INSERT INTO track_events (session_id, user_id, kind, path, label, value_kurus, meta, source, occurred_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'client', ?)`,
        [sid, user?.id || session.user_id || null, kind, path, text(raw.label, 160),
          Number.isFinite(Number(raw.value_kurus)) && raw.value_kurus !== null && raw.value_kurus !== undefined ? Math.trunc(Number(raw.value_kurus)) : null,
          meta, clock(raw.ts)]
      );
      accepted++;
    } catch { continue; }
    if (kind === 'page_view') { pageviews++; if (path) exitPath = path; }
    if (ERROR_KINDS.has(kind)) error = 1;
  }

  await dbAsync.run(
    `UPDATE track_sessions SET
       last_seen_at = CURRENT_TIMESTAMP,
       duration_sec = MAX(duration_sec, CAST((julianday('now') - julianday(started_at)) * 86400 AS INTEGER)),
       pageviews = pageviews + ?,
       event_count = event_count + ?,
       exit_path = COALESCE(?, exit_path),
       interacted = MAX(interacted, ?),
       had_error = MAX(had_error, ?),
       user_id = COALESCE(user_id, ?)
     WHERE id = ?`,
    [pageviews, accepted, exitPath, body.hi ? 1 : 0, error, user?.id || null, sid]
  );
  // Giris yapmis kullanicinin onayli tarayicisindaki onceki anonim gezinmeleri de hesaba baglanir.
  if (user?.id && vid) {
    await dbAsync.run('UPDATE track_sessions SET user_id = ? WHERE visitor_id = ? AND user_id IS NULL', [user.id, vid]).catch(() => {});
  }
  return { recorded: true, accepted };
}

// ---------------------------------------------------------------------------
// SUNUCU OLAYLARI
// ---------------------------------------------------------------------------

function sessionIdFrom(req) {
  const sid = String(req?.headers?.['x-track-sid'] || '');
  return ID_RE.test(sid) ? sid : null;
}

/**
 * Basari adimini kullanicinin oturumuna yazar. Oturum, istekteki X-Track-Sid
 * basligindan; yoksa (or. odeme webhook'u) kullanicinin son 3 saatteki en son
 * oturumundan bulunur. Izleme hicbir kosulda asil islemi bozmaz.
 */
async function serverEvent({ req = null, sessionId = null, userId = null, kind, label = null, valueKurus = null, meta = null, path = null }) {
  try {
    if (!SERVER_KINDS.has(kind)) return;
    if (userId) {
      const u = await dbAsync.get('SELECT role FROM users WHERE id = ?', [userId]);
      if (u?.role === 'admin') {
        const sid = sessionId || sessionIdFrom(req);
        if (sid) await purgeAdminTrace({ sessionId: sid });
        return;
      }
    }
    let sid = sessionId || sessionIdFrom(req);
    let session = sid ? await dbAsync.get('SELECT * FROM track_sessions WHERE id = ?', [sid]) : null;
    if (!session && userId) {
      session = await dbAsync.get(
        `SELECT * FROM track_sessions WHERE user_id = ? AND last_seen_at >= datetime('now', '-3 hours')
         ORDER BY last_seen_at DESC LIMIT 1`, [userId]);
    }
    if (!session) return;
    sid = session.id;
    let metaText = null;
    if (meta && typeof meta === 'object') { try { metaText = JSON.stringify(meta).slice(0, 800); } catch { /* yoksay */ } }
    await dbAsync.run(
      `INSERT INTO track_events (session_id, user_id, kind, path, label, value_kurus, meta, source, occurred_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'server', ?)`,
      [sid, userId, kind, text(path, 200), text(label, 160), valueKurus == null ? null : Math.trunc(Number(valueKurus)) || 0, metaText, Date.now()]
    );
    const v = Math.max(0, Math.trunc(Number(valueKurus) || 0));
    await dbAsync.run(
      `UPDATE track_sessions SET
         event_count = event_count + 1,
         last_seen_at = CURRENT_TIMESTAMP,
         user_id = COALESCE(user_id, ?),
         did_register = MAX(did_register, ?),
         did_login = MAX(did_login, ?),
         did_topup = MAX(did_topup, ?),
         did_order = MAX(did_order, ?),
         did_course = MAX(did_course, ?),
         topup_kurus = topup_kurus + ?,
         order_kurus = order_kurus + ?
       WHERE id = ?`,
      [userId,
        kind === 'register_success' ? 1 : 0, kind === 'login_success' ? 1 : 0, kind === 'topup_success' ? 1 : 0,
        kind === 'order_created' ? 1 : 0, kind === 'course_purchase' ? 1 : 0,
        kind === 'topup_success' ? v : 0, kind === 'order_created' || kind === 'course_purchase' ? v : 0, sid]
    );
    if (userId && session.visitor_id && (kind === 'register_success' || kind === 'login_success')) {
      // Onayli tarayicinin kayit/giris oncesi gezinmeleri de kullaniciya baglanir.
      await dbAsync.run('UPDATE track_sessions SET user_id = ? WHERE visitor_id = ? AND user_id IS NULL', [userId, session.visitor_id]);
    }
    if (kind === 'register_success' && userId) await saveAcquisition(userId, session);
  } catch {
    // izleme asil islemi asla bozmaz
  }
}

/** Kayit aninda kullanicinin ilk temas ve kayit oturumu kaynagini saklar. */
async function saveAcquisition(userId, regSession) {
  let first = regSession;
  let before = 1;
  if (regSession.visitor_id) {
    first = await dbAsync.get('SELECT * FROM track_sessions WHERE visitor_id = ? ORDER BY started_at ASC LIMIT 1', [regSession.visitor_id]) || regSession;
    before = (await dbAsync.get('SELECT COUNT(*) n FROM track_sessions WHERE visitor_id = ?', [regSession.visitor_id]))?.n || 1;
  }
  const camp = s => s.utm_campaign || (s.click_id ? s.click_id.split(':')[0] + ' ads' : null);
  await dbAsync.run(
    `INSERT OR IGNORE INTO user_acquisition (user_id, first_session_id, first_seen_at, first_channel, first_source, first_referrer,
       first_campaign, first_landing, reg_session_id, reg_channel, reg_source, reg_referrer, reg_campaign, reg_landing, sessions_before)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, first.id, first.started_at, first.channel, first.source, first.referrer, camp(first), first.entry_path,
      regSession.id, regSession.channel, regSession.source, regSession.referrer, camp(regSession), regSession.entry_path, before]
  );
}

/** Saklama suresi (gun) dolan kayitlar silinir. */
async function sweep(days = 90) {
  const d = Number.isInteger(days) && days > 0 ? days : 90;
  await dbAsync.run(`DELETE FROM track_events WHERE session_id IN (SELECT id FROM track_sessions WHERE started_at < datetime('now', ?))`, [`-${d} days`]);
  await dbAsync.run("DELETE FROM track_sessions WHERE started_at < datetime('now', ?)", [`-${d} days`]);
  await dbAsync.run("DELETE FROM track_bot_daily WHERE day < date('now', ?)", [`-${d} days`]);
}

function startFootprintWorker() {
  purgeAdminTraces().catch(() => {});
  const timer = setInterval(() => sweep(90).catch(() => {}), 24 * 3600 * 1000);
  timer.unref?.();
}

module.exports = {
  CLIENT_KINDS, SERVER_KINDS, ERROR_KINDS,
  record, serverEvent, sessionIdFrom, sweep, startFootprintWorker, purgeAdminTraces,
  isBotRequest, parseUserAgent, classifyChannel, normalizeReferrer, occurrenceClock
};
