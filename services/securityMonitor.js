'use strict';

// Uygulama katmani guvenlik izleme.
//
// Ne yapar: basarisiz girisler, hiz limiti ihlalleri ve engelli IP'lerin
// denemeleri veritabanina islenir; admin panelindeki Guvenlik Merkezi bu
// kayitlardan beslenir. Panelden engellenen IP'ler bellekte tutulur ve
// istek daha isin basinda 403 ile kesilir.
//
// Not: Hacimli (volumetrik) DDoS saldirilari uygulamaya ulasmadan Cloudflare
// katmaninda durdurulur; buradaki amac uygulama seviyesine sizan kotu niyetli
// denemeleri gorunur kilmak ve tek tikla engelleyebilmektir.

const { dbAsync } = require('../config/database');

// Ziyaretci sayacindaki mantigin aynisi: Cloudflare/proxy arkasinda gercek
// istemci IP'si basliktan okunur.
function clientIp(req) {
  const cf = req.headers['cf-connecting-ip'];
  if (cf) return String(cf).trim();
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || '';
}

// Engelli IP'ler her istekte sorgu atmamak icin bellekte tutulur.
const blockedIps = new Set();

async function loadBlockedIps() {
  const rows = await dbAsync.all('SELECT ip FROM blocked_ips');
  blockedIps.clear();
  rows.forEach(row => blockedIps.add(row.ip));
}

function isBlocked(ip) {
  return blockedIps.has(String(ip || '').trim());
}

async function blockIp(ip, reason, adminId) {
  const safeIp = String(ip || '').trim().slice(0, 64);
  if (!safeIp) throw new Error('IP adresi gerekli.');
  await dbAsync.run(
    'INSERT OR REPLACE INTO blocked_ips (ip, reason, created_by) VALUES (?, ?, ?)',
    [safeIp, String(reason || '').slice(0, 200), adminId || null]
  );
  blockedIps.add(safeIp);
}

async function unblockIp(ip) {
  const safeIp = String(ip || '').trim().slice(0, 64);
  await dbAsync.run('DELETE FROM blocked_ips WHERE ip = ?', [safeIp]);
  blockedIps.delete(safeIp);
}

function listBlockedIps() {
  return dbAsync.all('SELECT ip, reason, created_at FROM blocked_ips ORDER BY id DESC');
}

// Ayni (tur|IP) ikilisi dakikada en fazla bir kez yazilir: saldiri aninda
// SQLite'a binlerce satir basip siteyi yavaslatmak, saldirganin isini
// kolaylastirmak olurdu.
const lastLogged = new Map();
const LOG_THROTTLE_MS = 60_000;

function logEvent(type, req, extra = {}) {
  try {
    const ip = clientIp(req).slice(0, 64);
    const key = `${type}|${ip}`;
    const now = Date.now();
    const prev = lastLogged.get(key);
    if (prev && now - prev < LOG_THROTTLE_MS) return;
    lastLogged.set(key, now);
    if (lastLogged.size > 5000) lastLogged.clear();
    // Yanit beklenmez; log yazilamazsa site islemeye devam eder.
    dbAsync.run(
      'INSERT INTO security_events (type, ip, path, username, detail) VALUES (?, ?, ?, ?, ?)',
      [
        String(type).slice(0, 40),
        ip,
        String(req.originalUrl || req.url || '').split('?')[0].slice(0, 200),
        String(extra.username || '').slice(0, 64) || null,
        String(extra.detail || '').slice(0, 300) || null
      ]
    ).catch(() => {});
  } catch { /* guvenlik logu asla istegi dusurmez */ }
}

// 30 gunden eski olaylar temizlenir; tablo sisip paneli yavaslatmasin.
function pruneOldEvents() {
  return dbAsync.run("DELETE FROM security_events WHERE created_at < datetime('now', '-30 days')").catch(() => {});
}

// Guvenlik Merkezi tek istekte her seyi alir: ozet sayilar, olay listesi,
// supheli IP'ler, hedef alinan kullanicilar ve engelli IP'ler.
async function getOverview({ type = null, limit = 100 } = {}) {
  const eventWhere = type ? 'WHERE type = ?' : '';
  const eventParams = type ? [type, limit] : [limit];
  const [dayCounts, events, topIps, targetedUsers, blocked] = await Promise.all([
    dbAsync.all(`SELECT type, COUNT(*) n FROM security_events WHERE created_at >= datetime('now', '-1 day') GROUP BY type`),
    dbAsync.all(`SELECT id, type, ip, path, username, detail, created_at FROM security_events ${eventWhere} ORDER BY id DESC LIMIT ?`, eventParams),
    dbAsync.all(`SELECT ip, COUNT(*) n, MAX(created_at) last_at, GROUP_CONCAT(DISTINCT type) types
                 FROM security_events
                 WHERE created_at >= datetime('now', '-7 days') AND ip != ''
                 GROUP BY ip ORDER BY n DESC LIMIT 20`),
    dbAsync.all(`SELECT e.username, COUNT(*) n, MAX(e.created_at) last_at, u.id user_id, u.banned
                 FROM security_events e
                 LEFT JOIN users u ON u.username = e.username COLLATE NOCASE
                 WHERE e.type IN ('failed_login', 'banned_login')
                   AND e.created_at >= datetime('now', '-7 days')
                   AND e.username IS NOT NULL AND e.username != ''
                 GROUP BY e.username COLLATE NOCASE ORDER BY n DESC LIMIT 20`),
    listBlockedIps()
  ]);
  const summary = { failed_login: 0, rate_limit: 0, blocked_hit: 0, banned_login: 0 };
  dayCounts.forEach(row => { summary[row.type] = row.n; });
  return {
    summary,
    blocked_count: blocked.length,
    events,
    top_ips: topIps.map(row => ({ ...row, blocked: isBlocked(row.ip) })),
    targeted_users: targetedUsers,
    blocked_ips: blocked
  };
}

async function init() {
  await loadBlockedIps();
  await pruneOldEvents();
}

module.exports = { clientIp, init, isBlocked, blockIp, unblockIp, listBlockedIps, logEvent, getOverview, pruneOldEvents };
