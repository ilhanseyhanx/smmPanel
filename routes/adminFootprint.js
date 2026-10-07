'use strict';

// ZIYARETCI AYAK IZI (admin) — /api/admin/footprint
// Kimlik + admin yetkisi server.js'te bu router'a baglanirken uygulanir.
//
// "Gercek oturum": etkilesim olmus (fare/dokunma/kaydirma/tus) YA DA birden
// fazla sayfa gezilmis YA DA 10 sn'den uzun kalinmis YA DA giris yapilmis.
// Bunlarin disindakiler (tek sayfa, etkilesimsiz, anlik) "supheli" sayilir:
// JS calistiran tarama botlari genelde boyledir. Varsayilan olarak tum
// sayimlar gercek oturumlar uzerindendir; supheliler ayrica gosterilir.

const express = require('express');
const { dbAsync } = require('../config/database');
const { fromKurus } = require('../utils/money');

const router = express.Router();

const REAL = '(s.interacted = 1 OR s.pageviews > 1 OR s.duration_sec >= 10 OR s.user_id IS NOT NULL)';
const TZ = '+3 hours';
const CHANNELS = ['reklam', 'eposta', 'davet', 'kampanya', 'arama', 'sosyal', 'yonlendiren', 'dogrudan'];

function sqlTime(ms) {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * Zaman penceresi (TR saatine gore). range: today | yesterday | 7 | 30 | 90
 * ya da from/to (YYYY-MM-DD, TR gunu, dahil). [from, to) UTC SQL zamanlari.
 */
function windowOf(req) {
  const TR = 3 * 3600 * 1000;
  const trDayStart = ms => { const d = new Date(ms + TR); d.setUTCHours(0, 0, 0, 0); return d.getTime() - TR; };
  const now = Date.now();
  const day = /^\d{4}-\d{2}-\d{2}$/;
  if (day.test(String(req.query.from || '')) && day.test(String(req.query.to || ''))) {
    const from = Date.parse(`${req.query.from}T00:00:00Z`) - TR;
    const to = Date.parse(`${req.query.to}T00:00:00Z`) - TR + 86400000;
    if (Number.isFinite(from) && Number.isFinite(to) && to > from) return { from: sqlTime(from), to: sqlTime(Math.min(to, now + 60000)), span: to - from, label: `${req.query.from} – ${req.query.to}` };
  }
  const range = String(req.query.range || '7');
  if (range === 'today') { const f = trDayStart(now); return { from: sqlTime(f), to: sqlTime(now + 60000), span: now - f, label: 'Bugün' }; }
  if (range === 'yesterday') { const t = trDayStart(now); return { from: sqlTime(t - 86400000), to: sqlTime(t), span: 86400000, label: 'Dün' }; }
  const days = [7, 30, 90].includes(Number(range)) ? Number(range) : 7;
  const f = trDayStart(now) - (days - 1) * 86400000;
  return { from: sqlTime(f), to: sqlTime(now + 60000), span: now - f, label: `Son ${days} gün` };
}

const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

// Oturum filtresi (liste ve kullanici ekrani ortak).
function sessionFilters(req, where, params) {
  if (req.query.real !== '0') where.push(REAL);
  const eq = (col, val) => { where.push(`s.${col} = ?`); params.push(val); };
  if (CHANNELS.includes(String(req.query.channel || ''))) eq('channel', String(req.query.channel));
  if (/^[A-Z]{2}$/i.test(String(req.query.country || ''))) eq('country', String(req.query.country).toUpperCase());
  if (['mobile', 'desktop', 'tablet'].includes(String(req.query.device || ''))) eq('device', String(req.query.device));
  for (const [key, col] of [['registered', 'did_register'], ['ordered', 'did_order'], ['topup', 'did_topup'], ['course', 'did_course'], ['error', 'had_error'], ['consent', 'consent']]) {
    if (req.query[key] === '0' || req.query[key] === '1') eq(col, Number(req.query[key]));
  }
  if (req.query.member === '1') where.push('s.user_id IS NOT NULL');
  if (req.query.member === '0') where.push('s.user_id IS NULL');
  if (req.query.q) {
    const like = `%${String(req.query.q).slice(0, 80)}%`;
    where.push(`(u.username LIKE ? OR s.entry_path LIKE ? OR s.exit_path LIKE ? OR s.utm_campaign LIKE ? OR s.source LIKE ? OR s.referrer LIKE ? OR s.city LIKE ?
      OR EXISTS (SELECT 1 FROM track_events e WHERE e.session_id = s.id AND (e.path LIKE ? OR e.label LIKE ?)))`);
    params.push(like, like, like, like, like, like, like, like, like);
  }
}

// ---------------------------------------------------------------------------
// GENEL BAKIS
// ---------------------------------------------------------------------------

router.get('/overview', async (req, res, next) => {
  try {
    const w = windowOf(req);
    const win = [w.from, w.to];
    const inWin = 's.started_at >= ? AND s.started_at < ?';
    const base = `FROM track_sessions s WHERE ${inWin} AND ${REAL}`;
    const evWin = `e.created_at >= ? AND e.created_at < ? AND e.session_id IN (SELECT s.id ${base})`;
    const evParams = [...win, ...win];

    const summary = await dbAsync.get(`
      SELECT COUNT(*) sessions,
             COUNT(DISTINCT COALESCE(s.visitor_id, 'u' || s.user_id, s.id)) visitors,
             SUM(CASE WHEN s.consent = 1 AND s.is_new = 1 THEN 1 ELSE 0 END) new_visitors,
             SUM(CASE WHEN s.consent = 1 AND s.is_new = 0 THEN 1 ELSE 0 END) returning_visitors,
             SUM(s.consent) consented,
             SUM(CASE WHEN s.user_id IS NOT NULL THEN 1 ELSE 0 END) member_sessions,
             ROUND(AVG(s.duration_sec)) avg_duration,
             ROUND(AVG(s.pageviews), 1) pages_per_session,
             SUM(CASE WHEN s.pageviews <= 1 AND s.duration_sec < 15 THEN 1 ELSE 0 END) bounced,
             SUM(s.did_register) registered, SUM(s.did_login) logins,
             SUM(s.did_topup) topups, SUM(s.topup_kurus) topup_kurus,
             SUM(s.did_order) orders, SUM(s.did_course) courses, SUM(s.order_kurus) order_kurus,
             SUM(s.had_error) errors,
             SUM(CASE WHEN s.did_order = 1 OR s.did_course = 1 THEN 1 ELSE 0 END) converted
      ${base}`, win);
    const suspicious = await dbAsync.get(`SELECT COUNT(*) n FROM track_sessions s WHERE ${inWin} AND NOT ${REAL}`, win);
    const bots = await dbAsync.get(`SELECT COALESCE(SUM(hits), 0) n FROM track_bot_daily WHERE day >= date(?, '${TZ}') AND day <= date(?, '${TZ}')`, win);

    // Google ile giris/kayit: sunucu olaylarinin meta.method alanindan sayilir
    // (routes/auth.js /google). Oturum bazli; ayni oturumda iki kayit olmaz.
    const google = await dbAsync.get(`
      SELECT SUM(CASE WHEN e.kind = 'register_success' THEN 1 ELSE 0 END) registered,
             SUM(CASE WHEN e.kind = 'login_success' THEN 1 ELSE 0 END) logins
      FROM track_events e WHERE e.kind IN ('register_success', 'login_success')
        AND json_extract(e.meta, '$.method') = 'google' AND ${evWin}`, evParams);

    const hourly = w.span <= 26 * 3600 * 1000;
    const bucket = hourly ? `strftime('%H', s.started_at, '${TZ}')` : `date(s.started_at, '${TZ}')`;
    const timeline = await dbAsync.all(`
      SELECT ${bucket} bucket, COUNT(*) sessions, SUM(s.did_register) registered,
             SUM(CASE WHEN s.did_order = 1 OR s.did_course = 1 THEN 1 ELSE 0 END) converted,
             SUM(s.topup_kurus) topup_kurus
      ${base} GROUP BY bucket ORDER BY bucket`, win);

    const group = (col, limit = 12) => dbAsync.all(`
      SELECT COALESCE(${col}, 'bilinmiyor') k, COUNT(*) sessions,
             SUM(s.did_register) registered, SUM(s.did_topup) topups,
             SUM(CASE WHEN s.did_order = 1 OR s.did_course = 1 THEN 1 ELSE 0 END) converted,
             SUM(s.topup_kurus) topup_kurus, SUM(s.order_kurus) order_kurus
      ${base} GROUP BY k ORDER BY sessions DESC LIMIT ${limit}`, win);

    const [channels, sources, devices, oses, browsers, countries, cities, langs] = await Promise.all([
      group('s.channel'), group('s.source', 20), group('s.device'), group('s.os'), group('s.browser'),
      group('s.country', 15), group("s.city || ' (' || s.country || ')'", 15), group('s.lang', 8)
    ]);
    const referrers = await dbAsync.all(`
      SELECT s.referrer url, s.channel, COUNT(*) sessions, SUM(s.did_register) registered,
             SUM(CASE WHEN s.did_order = 1 OR s.did_course = 1 THEN 1 ELSE 0 END) converted
      ${base} AND s.referrer IS NOT NULL GROUP BY s.referrer ORDER BY sessions DESC LIMIT 25`, win);
    const campaigns = await dbAsync.all(`
      SELECT COALESCE(s.utm_source, '-') source, COALESCE(s.utm_medium, '-') medium, COALESCE(s.utm_campaign, '-') campaign,
             COUNT(*) sessions, SUM(s.did_register) registered,
             SUM(CASE WHEN s.did_order = 1 OR s.did_course = 1 THEN 1 ELSE 0 END) converted,
             SUM(s.topup_kurus) topup_kurus, SUM(s.order_kurus) order_kurus
      ${base} AND (s.utm_source IS NOT NULL OR s.utm_campaign IS NOT NULL OR s.click_id IS NOT NULL)
      GROUP BY source, medium, campaign ORDER BY sessions DESC LIMIT 20`, win);
    const landings = await dbAsync.all(`
      SELECT COALESCE(s.entry_path, '/') path, COUNT(*) sessions,
             SUM(CASE WHEN s.pageviews <= 1 AND s.duration_sec < 15 THEN 1 ELSE 0 END) bounced,
             SUM(s.did_register) registered, SUM(CASE WHEN s.did_order = 1 OR s.did_course = 1 THEN 1 ELSE 0 END) converted
      ${base} GROUP BY path ORDER BY sessions DESC LIMIT 20`, win);
    const exits = await dbAsync.all(`
      SELECT COALESCE(s.exit_path, '/') path, COUNT(*) sessions ${base}
      AND s.did_order = 0 AND s.did_course = 0 GROUP BY path ORDER BY sessions DESC LIMIT 12`, win);

    // Sayfa basina: goruntulenme, tekil oturum, ortalama kalma suresi ve kaydirma.
    const pages = await dbAsync.all(`
      SELECT e.path, COUNT(*) views, COUNT(DISTINCT e.session_id) sessions
      FROM track_events e WHERE e.kind = 'page_view' AND ${evWin} GROUP BY e.path ORDER BY views DESC LIMIT 25`, evParams);
    // Kalma suresi dilimlidir (sekme gizlenince bir page_leave yazilir): once
    // oturum+sayfa basina toplanir, sonra sayfa basina ortalamasi alinir.
    const leave = await dbAsync.all(`
      SELECT path, ROUND(AVG(ms) / 1000.0) avg_sec, ROUND(AVG(scroll)) avg_scroll FROM (
        SELECT e.session_id, e.path, SUM(CAST(json_extract(e.meta, '$.ms') AS INTEGER)) ms,
               MAX(CAST(json_extract(e.meta, '$.scroll') AS INTEGER)) scroll
        FROM track_events e WHERE e.kind = 'page_leave' AND ${evWin} GROUP BY e.session_id, e.path
      ) GROUP BY path`, evParams);
    const leaveMap = new Map(leave.map(r => [r.path, r]));

    const kindSessions = await dbAsync.all(`
      SELECT e.kind, COUNT(DISTINCT e.session_id) n FROM track_events e WHERE ${evWin} GROUP BY e.kind`, evParams);
    const byKind = Object.fromEntries(kindSessions.map(r => [r.kind, r.n]));
    const browsed = await dbAsync.get(`
      SELECT COUNT(DISTINCT e.session_id) n FROM track_events e WHERE ${evWin}
        AND (e.kind IN ('service_view', 'service_search', 'order_click') OR (e.kind = 'page_view' AND (e.path LIKE '/services%' OR e.path LIKE '%-satin-al%' OR e.path = '/new-order')))`, evParams);
    const funnel = [
      { key: 'visit', label: 'Siteye giren', n: summary.sessions || 0 },
      { key: 'browse', label: 'Hizmetlere bakan', n: browsed.n || 0 },
      { key: 'auth_view', label: 'Giriş/kayıt ekranına gelen', n: byKind.auth_view || 0 },
      { key: 'account', label: 'Kayıt olan / giriş yapan', n: (await dbAsync.get(`SELECT COUNT(DISTINCT e.session_id) n FROM track_events e WHERE e.kind IN ('register_success','login_success') AND ${evWin}`, evParams)).n || 0 },
      { key: 'topup_start', label: 'Bakiye yüklemeye başlayan', n: byKind.topup_start || 0 },
      { key: 'topup_success', label: 'Bakiye yükleyen', n: byKind.topup_success || 0 },
      { key: 'order_created', label: 'Sipariş veren', n: byKind.order_created || 0 }
    ];

    const searches = await dbAsync.all(`
      SELECT LOWER(e.label) term, COUNT(DISTINCT e.session_id) sessions,
             MIN(CAST(json_extract(e.meta, '$.results') AS INTEGER)) min_results
      FROM track_events e WHERE e.kind = 'service_search' AND e.label IS NOT NULL AND ${evWin}
      GROUP BY term ORDER BY sessions DESC LIMIT 20`, evParams);
    const errors = await dbAsync.all(`
      SELECT e.kind, COALESCE(e.label, '-') label, COUNT(*) n, COUNT(DISTINCT e.session_id) sessions
      FROM track_events e WHERE e.kind IN ('api_error', 'js_error', 'rage_click', 'not_found') AND ${evWin}
      GROUP BY e.kind, label ORDER BY n DESC LIMIT 20`, evParams);
    const clicks = await dbAsync.all(`
      SELECT e.label, COUNT(*) n, COUNT(DISTINCT e.session_id) sessions
      FROM track_events e WHERE e.kind IN ('click', 'outbound_click') AND e.label IS NOT NULL AND ${evWin}
      GROUP BY e.label ORDER BY n DESC LIMIT 20`, evParams);
    const hours = await dbAsync.all(`SELECT CAST(strftime('%H', s.started_at, '${TZ}') AS INTEGER) h, COUNT(*) n ${base} GROUP BY h`, win);

    const money = r => ({ ...r, topup: fromKurus(r.topup_kurus || 0), revenue: fromKurus(r.order_kurus || 0) });
    const s = Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, v || 0]));
    res.json({
      window: w,
      summary: {
        ...s,
        topup: fromKurus(s.topup_kurus), revenue: fromKurus(s.order_kurus),
        bounce_rate: pct(s.bounced, s.sessions), conversion_rate: pct(s.converted, s.sessions),
        consent_rate: pct(s.consented, s.sessions), register_rate: pct(s.registered, s.sessions),
        suspicious: suspicious.n || 0, bots: bots.n || 0,
        google_registered: Number(google?.registered) || 0, google_logins: Number(google?.logins) || 0
      },
      timeline: { unit: hourly ? 'hour' : 'day', rows: timeline.map(money) },
      channels: channels.map(money), sources: sources.map(money), referrers, campaigns: campaigns.map(money),
      landings: landings.map(r => ({ ...r, bounce_rate: pct(r.bounced, r.sessions), conversion_rate: pct(r.converted, r.sessions) })),
      exits,
      pages: pages.map(p => ({ ...p, avg_sec: leaveMap.get(p.path)?.avg_sec ?? null, avg_scroll: leaveMap.get(p.path)?.avg_scroll ?? null })),
      funnel, searches, errors, clicks,
      hours: Array.from({ length: 24 }, (_, h) => ({ h, n: hours.find(r => r.h === h)?.n || 0 })),
      devices, oses, browsers, countries, cities, langs
    });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// CANLI
// ---------------------------------------------------------------------------

router.get('/live', async (req, res, next) => {
  try {
    const rows = await dbAsync.all(`
      SELECT s.id, s.user_id, u.username, s.started_at, s.last_seen_at, s.duration_sec, s.pageviews, s.exit_path,
             s.entry_path, s.channel, s.source, s.device, s.os, s.browser, s.country, s.city, s.consent, s.interacted,
             (SELECT e.path FROM track_events e WHERE e.session_id = s.id AND e.kind = 'page_view' ORDER BY e.occurred_ms DESC LIMIT 1) current_path
      FROM track_sessions s LEFT JOIN users u ON u.id = s.user_id
      WHERE s.last_seen_at >= datetime('now', '-5 minutes')
      ORDER BY s.last_seen_at DESC LIMIT 100`);
    const pages = {};
    rows.forEach(r => { const p = r.current_path || r.exit_path || '/'; pages[p] = (pages[p] || 0) + 1; });
    res.json({
      count: rows.length,
      members: rows.filter(r => r.user_id).length,
      sessions: rows,
      pages: Object.entries(pages).map(([path, n]) => ({ path, n })).sort((a, b) => b.n - a.n).slice(0, 10)
    });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// OTURUMLAR
// ---------------------------------------------------------------------------

router.get('/sessions', async (req, res, next) => {
  try {
    const w = windowOf(req);
    const where = ['s.started_at >= ? AND s.started_at < ?'];
    const params = [w.from, w.to];
    sessionFilters(req, where, params);
    const clause = where.join(' AND ');
    const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 50));
    const page = Math.max(1, Number(req.query.page) || 1);
    const total = (await dbAsync.get(`SELECT COUNT(*) n FROM track_sessions s LEFT JOIN users u ON u.id = s.user_id WHERE ${clause}`, params)).n;
    const sessions = await dbAsync.all(`
      SELECT s.id, s.visitor_id, s.user_id, u.username, s.consent, s.started_at, s.last_seen_at, s.duration_sec,
             s.pageviews, s.event_count, s.entry_path, s.exit_path, s.channel, s.source, s.referrer, s.utm_campaign,
             s.device, s.os, s.browser, s.country, s.city, s.is_new, s.interacted,
             s.did_register, s.did_login, s.did_topup, s.did_order, s.did_course, s.had_error, s.topup_kurus, s.order_kurus
      FROM track_sessions s LEFT JOIN users u ON u.id = s.user_id
      WHERE ${clause} ORDER BY s.started_at DESC LIMIT ? OFFSET ?`, [...params, limit, (page - 1) * limit]);
    res.json({ window: w, total, page, pages: Math.ceil(total / limit), sessions: sessions.map(r => ({ ...r, topup: fromKurus(r.topup_kurus), revenue: fromKurus(r.order_kurus) })) });
  } catch (err) { next(err); }
});

router.get('/sessions/:id', async (req, res, next) => {
  try {
    const session = await dbAsync.get(`
      SELECT s.*, u.username, u.email, u.created_at user_created_at
      FROM track_sessions s LEFT JOIN users u ON u.id = s.user_id WHERE s.id = ?`, [String(req.params.id).slice(0, 40)]);
    if (!session) return res.status(404).json({ error: 'Oturum bulunamadı (90 günden eski kayıtlar silinir).' });
    const events = await dbAsync.all(`
      SELECT id, kind, path, label, value_kurus, meta, source, occurred_ms, created_at
      FROM track_events WHERE session_id = ? ORDER BY occurred_ms ASC, id ASC`, [session.id]);
    // Ayni kisinin diger ziyaretleri: onayli tarayici kimligi ya da hesap uzerinden.
    const others = await dbAsync.all(`
      SELECT id, started_at, duration_sec, pageviews, entry_path, exit_path, channel, source, device,
             did_register, did_topup, did_order, did_course, had_error
      FROM track_sessions
      WHERE id != ? AND ((? IS NOT NULL AND visitor_id = ?) OR (? IS NOT NULL AND user_id = ?))
      ORDER BY started_at DESC LIMIT 30`,
    [session.id, session.visitor_id, session.visitor_id, session.user_id, session.user_id]);
    const acquisition = session.user_id ? await dbAsync.get('SELECT * FROM user_acquisition WHERE user_id = ?', [session.user_id]) : null;
    res.json({
      session: { ...session, topup: fromKurus(session.topup_kurus), revenue: fromKurus(session.order_kurus) },
      events: events.map(e => ({ ...e, value: e.value_kurus == null ? null : fromKurus(e.value_kurus), meta: (() => { try { return e.meta ? JSON.parse(e.meta) : null; } catch { return null; } })() })),
      others,
      acquisition
    });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// KULLANICILAR (KAZANIM)
// ---------------------------------------------------------------------------

router.get('/users', async (req, res, next) => {
  try {
    const w = windowOf(req);
    const where = ['u.role != \'admin\'', 'u.created_at >= ? AND u.created_at < ?'];
    const params = [w.from, w.to];
    if (CHANNELS.includes(String(req.query.channel || ''))) { where.push('a.first_channel = ?'); params.push(String(req.query.channel)); }
    if (req.query.tracked === '1') where.push('a.user_id IS NOT NULL');
    // Kayit yontemi: Google dugmesi (signup_method='google') / kayit formu (digerleri).
    if (req.query.method === 'google') where.push("u.signup_method = 'google'");
    else if (req.query.method === 'form') where.push("(u.signup_method IS NULL OR u.signup_method != 'google')");
    if (req.query.q) {
      const like = `%${String(req.query.q).slice(0, 80)}%`;
      where.push('(u.username LIKE ? OR u.email LIKE ? OR a.first_source LIKE ? OR a.first_campaign LIKE ? OR a.first_referrer LIKE ?)');
      params.push(like, like, like, like, like);
    }
    const clause = where.join(' AND ');
    const limit = 50;
    const page = Math.max(1, Number(req.query.page) || 1);
    const total = (await dbAsync.get(`SELECT COUNT(*) n FROM users u LEFT JOIN user_acquisition a ON a.user_id = u.id WHERE ${clause}`, params)).n;
    const users = await dbAsync.all(`
      SELECT u.id, u.username, u.created_at, u.last_seen_at, u.signup_method, (u.google_sub IS NOT NULL) google_linked,
             a.first_channel, a.first_source, a.first_referrer, a.first_campaign, a.first_landing, a.first_seen_at,
             a.reg_channel, a.reg_source, a.reg_landing, a.sessions_before,
             (SELECT COUNT(*) FROM track_sessions s WHERE s.user_id = u.id) sessions,
             (SELECT COALESCE(SUM(amount_kurus), 0) FROM payments p WHERE p.user_id = u.id AND p.status = 'completed'
                AND p.method NOT LIKE 'Bonus%' AND p.method NOT LIKE 'Kupon%') deposit_kurus,
             (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) orders,
             (SELECT COALESCE(SUM(charge_kurus - refunded_kurus), 0) FROM orders o WHERE o.user_id = u.id) spent_kurus,
             (SELECT COUNT(*) FROM course_purchases c WHERE c.user_id = u.id) courses
      FROM users u LEFT JOIN user_acquisition a ON a.user_id = u.id
      WHERE ${clause} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`, [...params, limit, (page - 1) * limit]);
    // Kanal bazinda kazanim ozeti (secili donemde kayit olanlar).
    const byChannel = await dbAsync.all(`
      SELECT COALESCE(a.first_channel, 'izlenmedi') channel, COUNT(*) users,
             SUM(CASE WHEN EXISTS (SELECT 1 FROM payments p WHERE p.user_id = u.id AND p.status = 'completed'
               AND p.method NOT LIKE 'Bonus%' AND p.method NOT LIKE 'Kupon%') THEN 1 ELSE 0 END) payers
      FROM users u LEFT JOIN user_acquisition a ON a.user_id = u.id
      WHERE u.role != 'admin' AND u.created_at >= ? AND u.created_at < ? GROUP BY channel ORDER BY users DESC`, [w.from, w.to]);
    // Kayit yontemi ozeti: Google dugmesi mi, kayit formu mu (secili donem).
    const byMethod = await dbAsync.all(`
      SELECT CASE WHEN u.signup_method = 'google' THEN 'google' ELSE 'form' END method, COUNT(*) users,
             SUM(CASE WHEN EXISTS (SELECT 1 FROM payments p WHERE p.user_id = u.id AND p.status = 'completed'
               AND p.method NOT LIKE 'Bonus%' AND p.method NOT LIKE 'Kupon%') THEN 1 ELSE 0 END) payers
      FROM users u WHERE u.role != 'admin' AND u.created_at >= ? AND u.created_at < ? GROUP BY method ORDER BY users DESC`, [w.from, w.to]);
    res.json({
      window: w, total, page, pages: Math.ceil(total / limit),
      users: users.map(r => ({ ...r, deposit: fromKurus(r.deposit_kurus), spent: fromKurus(r.spent_kurus) })),
      by_channel: byChannel.map(r => ({ ...r, payer_rate: pct(r.payers, r.users) })),
      by_method: byMethod.map(r => ({ ...r, payer_rate: pct(r.payers, r.users) }))
    });
  } catch (err) { next(err); }
});

router.get('/users/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Geçersiz kullanıcı.' });
    const user = await dbAsync.get('SELECT id, username, email, role, created_at, last_seen_at, last_login_at, login_count, balance_kurus, signup_method, google_linked_at, (google_sub IS NOT NULL) google_linked FROM users WHERE id = ?', [id]);
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    const acquisition = await dbAsync.get('SELECT * FROM user_acquisition WHERE user_id = ?', [id]);
    const sessions = await dbAsync.all(`
      SELECT id, started_at, duration_sec, pageviews, event_count, entry_path, exit_path, channel, source, referrer,
             utm_campaign, device, os, browser, country, city, consent,
             did_register, did_login, did_topup, did_order, did_course, had_error, topup_kurus, order_kurus
      FROM track_sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT 200`, [id]);
    const totals = await dbAsync.get(`
      SELECT COUNT(*) sessions, COALESCE(SUM(duration_sec), 0) seconds, COALESCE(SUM(pageviews), 0) pageviews,
             MIN(started_at) first_seen, MAX(last_seen_at) last_seen
      FROM track_sessions WHERE user_id = ?`, [id]);
    const channels = await dbAsync.all('SELECT COALESCE(channel, \'bilinmiyor\') channel, COUNT(*) n FROM track_sessions WHERE user_id = ? GROUP BY channel ORDER BY n DESC', [id]);
    const topPages = await dbAsync.all(`
      SELECT e.path, COUNT(*) n FROM track_events e JOIN track_sessions s ON s.id = e.session_id
      WHERE s.user_id = ? AND e.kind = 'page_view' GROUP BY e.path ORDER BY n DESC LIMIT 15`, [id]);
    const money = await dbAsync.get(`
      SELECT (SELECT COALESCE(SUM(amount_kurus), 0) FROM payments WHERE user_id = ? AND status = 'completed'
                AND method NOT LIKE 'Bonus%' AND method NOT LIKE 'Kupon%') deposit_kurus,
             (SELECT COUNT(*) FROM orders WHERE user_id = ?) orders,
             (SELECT COALESCE(SUM(charge_kurus - refunded_kurus), 0) FROM orders WHERE user_id = ?) spent_kurus,
             (SELECT COUNT(*) FROM course_purchases WHERE user_id = ?) courses`, [id, id, id, id]);
    res.json({
      user: { ...user, balance: fromKurus(user.balance_kurus) },
      acquisition, totals, channels, top_pages: topPages,
      money: { ...money, deposit: fromKurus(money.deposit_kurus), spent: fromKurus(money.spent_kurus) },
      sessions: sessions.map(r => ({ ...r, topup: fromKurus(r.topup_kurus), revenue: fromKurus(r.order_kurus) }))
    });
  } catch (err) { next(err); }
});

module.exports = router;
