'use strict';

// Bayi Paneli aboneligi (F3). Ucret bayinin Jet bakiyesinden duser; yeni
// odeme entegrasyonu yoktur.
//
// tenants.plan_status:
//   trial    deneme suruyor (trial_ends_at'e kadar)
//   active   odenmis donem suruyor (paid_until'e kadar)
//   past_due donem bitti, ucret alinamadi; grace_days boyunca her turda yeniden denenir
//   expired  site askida (billing_suspended_at); delete_after_days sonra silinir
//   comp     Jet'in ucretsiz verdigi panel; ucret alinmaz
// Deneme sonunda ucret ANCAK bayi "devam et" dediyse (auto_renew = 1) cekilir;
// demediyse site askiya alinir. Sonraki aylar otomatik yenilenir; bayi
// yenilemeyi kapatirsa donem sonunda askiya alinir.
const cron = require('node-cron');
const { dbAsync, withTransaction } = require('../config/database');
const { fromKurus } = require('../utils/money');
const { getResellerSettings, logTenantActivity, deleteTenantData } = require('./resellers');
const { invalidateTenantCache } = require('../tenant/resolve');
const mailer = require('./mailer');

const SUSPEND_REASON = 'Abonelik süresi doldu';
const BILLABLE = ['trial', 'active', 'past_due'];

function feeKurus(settings) {
  return Math.max(0, Math.round(Number(settings.monthly_fee_tl) * 100));
}

// SQLite tarih bicimi (UTC): "YYYY-AA-GG SS:DD:ss"
function sqlDate(date = new Date()) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function parseSqlDate(value) {
  if (!value) return null;
  const date = new Date(String(value).replace(' ', 'T') + (String(value).length > 10 && !/Z$/.test(value) ? 'Z' : ''));
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(value, days) {
  const date = parseSqlDate(value);
  return date ? new Date(date.getTime() + days * 86_400_000) : null;
}

function trDate(value) {
  const date = value instanceof Date ? value : parseSqlDate(value);
  return date ? date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' }) : '';
}

function money(kurus) {
  return `₺${fromKurus(kurus).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Yeni bayi icin deneme alanlari (basvuru ve admin acilisi kullanir).
async function trialFields(now = new Date()) {
  const settings = await getResellerSettings();
  return { plan_status: 'trial', trial_ends_at: sqlDate(new Date(now.getTime() + settings.trial_days * 86_400_000)) };
}

// Jet panelinde bildirim + (yapilandirildiysa) e-posta. Hata akisi durdurmaz.
async function notifyOwner(db, tenant, title, message) {
  await db.run('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
    [tenant.owner_user_id, 'reseller', title, message]);
  const owner = await db.get('SELECT email FROM users WHERE id = ?', [tenant.owner_user_id]);
  if (owner?.email) {
    mailer.isConfigured()
      .then(ok => ok && mailer.sendMail({ to: owner.email, subject: `${title} · ${tenant.name}`, text: message }))
      .catch(() => {});
  }
}

// Donem ucretini sahibin Jet bakiyesinden duser ve donemi baslatir.
// periodStart verilmezse donem simdi baslar (askidaki/gecikmedeki bayinin elle odemesi).
async function chargeTenant(tenantId, { periodStart = null, actorType = 'system', actorId = null, now = new Date() } = {}) {
  const settings = await getResellerSettings();
  const fee = feeKurus(settings);
  const result = await withTransaction(async tx => {
    const tenant = await tx.get('SELECT * FROM tenants WHERE id = ?', [tenantId]);
    if (!tenant) return { ok: false, reason: 'missing' };
    if (fee > 0) {
      const debit = await tx.run(
        'UPDATE users SET balance_kurus = balance_kurus - ?, balance = (balance_kurus - ?) / 100.0 WHERE id = ? AND balance_kurus >= ?',
        [fee, fee, tenant.owner_user_id, fee]
      );
      if (debit.changes !== 1) return { ok: false, reason: 'balance', feeKurus: fee, tenant };
    }
    const start = periodStart || sqlDate(now);
    const end = (await tx.get("SELECT datetime(?, '+1 month') AS value", [start])).value;
    await tx.run(
      `INSERT INTO tenant_invoices (tenant_id, owner_user_id, tenant_name, amount_kurus, period_start, period_end, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tenant.id, tenant.owner_user_id, tenant.name, fee, start, end, actorType === 'owner' ? 'Bayi ödedi' : 'Otomatik yenileme']
    );
    await tx.run(
      `UPDATE tenants SET plan_status = 'active', paid_until = ?, auto_renew = 1, past_due_since = NULL, billing_notice = NULL,
              status = CASE WHEN billing_suspended_at IS NOT NULL THEN 'active' ELSE status END,
              status_reason = CASE WHEN billing_suspended_at IS NOT NULL THEN NULL ELSE status_reason END,
              billing_suspended_at = NULL
        WHERE id = ?`,
      [end, tenant.id]
    );
    await logTenantActivity(tx, {
      tenantId: tenant.id, actorType, actorId, action: 'subscription_charged',
      details: { amount: fromKurus(fee), period_end: end }
    });
    await notifyOwner(tx, tenant, 'Bayi paneli ücreti alındı',
      `"${tenant.name}" için ${money(fee)} Jet bakiyenden düşüldü. Yeni dönem ${trDate(end)} tarihine kadar geçerli.`);
    return { ok: true, feeKurus: fee, periodEnd: end, tenant };
  });
  if (result.ok) invalidateTenantCache();
  return result;
}

async function expireTenant(tenant, now, why) {
  const settings = await getResellerSettings();
  const changed = await dbAsync.run(
    `UPDATE tenants SET plan_status = 'expired', billing_suspended_at = ?, auto_renew = 0, past_due_since = NULL,
            billing_notice = NULL, status = 'suspended', status_reason = ?
      WHERE id = ? AND plan_status IN ('trial', 'active', 'past_due')`,
    [sqlDate(now), SUSPEND_REASON, tenant.id]
  );
  if (changed.changes !== 1) return false;
  invalidateTenantCache();
  const deleteAt = new Date(now.getTime() + settings.delete_after_days * 86_400_000);
  await logTenantActivity(dbAsync, { tenantId: tenant.id, actorType: 'system', action: 'subscription_expired', details: { reason: why } });
  await notifyOwner(dbAsync, tenant, 'Bayi paneli askıya alındı',
    `${why} "${tenant.name}" sitesi kapatıldı. Bayi panelinden ${money(feeKurus(settings))} ödeyerek hemen yeniden açabilirsin. `
    + `Ödeme yapılmazsa site ve müşteri verileri ${trDate(deleteAt)} tarihinde silinir.`);
  return true;
}

async function markPastDue(tenant, now) {
  const settings = await getResellerSettings();
  const changed = await dbAsync.run(
    "UPDATE tenants SET plan_status = 'past_due', past_due_since = COALESCE(past_due_since, ?) WHERE id = ? AND plan_status IN ('trial', 'active')",
    [sqlDate(now), tenant.id]
  );
  if (changed.changes !== 1) return false;
  const graceEnd = new Date(now.getTime() + settings.grace_days * 86_400_000);
  await logTenantActivity(dbAsync, { tenantId: tenant.id, actorType: 'system', action: 'subscription_past_due' });
  await notifyOwner(dbAsync, tenant, 'Bayi paneli ücreti alınamadı',
    `Jet bakiyen ${money(feeKurus(settings))} aylık ücreti karşılamadı. Site açık kalıyor; ${trDate(graceEnd)} tarihine kadar `
    + 'bakiye yüklersen ücret kendiliğinden alınır. Yüklenmezse site askıya alınır.');
  return true;
}

async function setNotice(tenantId, notice) {
  await dbAsync.run('UPDATE tenants SET billing_notice = ? WHERE id = ?', [notice, tenantId]);
}

// Saatte bir calisir; ayni turda tekrar calismasi guvenlidir (her adim durum
// kontrolluyle ilerler, uyarilar billing_notice ile bir kez gider).
async function runBillingCycle(now = new Date()) {
  const settings = await getResellerSettings();
  const fee = feeKurus(settings);
  const nowSql = sqlDate(now);
  const stats = { reminded: 0, charged: 0, past_due: 0, expired: 0, deleted: 0 };
  const rows = (sql, params) => dbAsync.all(
    `SELECT t.*, u.balance_kurus AS owner_balance_kurus FROM tenants t JOIN users u ON u.id = t.owner_user_id WHERE ${sql}`, params);

  // 1) Deneme 2 gun icinde bitiyor.
  for (const t of await rows(
    "t.plan_status = 'trial' AND t.trial_ends_at > ? AND t.trial_ends_at <= datetime(?, '+2 days') AND COALESCE(t.billing_notice, '') != 'trial_soon'",
    [nowSql, nowSql])) {
    const message = t.auto_renew
      ? (t.owner_balance_kurus >= fee
        ? `Deneme ${trDate(t.trial_ends_at)} tarihinde bitiyor; ${money(fee)} Jet bakiyenden alınıp panelin açık kalacak.`
        : `Deneme ${trDate(t.trial_ends_at)} tarihinde bitiyor. ${money(fee)} için Jet bakiyen yetersiz; bakiye yüklemezsen site askıya alınır.`)
      : `Deneme ${trDate(t.trial_ends_at)} tarihinde bitiyor. ${money(fee)}/ay ile devam etmek için bayi panelinde "Devam et"e bas; basmazsan site kapanır.`;
    await notifyOwner(dbAsync, t, 'Bayi paneli denemen bitmek üzere', message);
    await setNotice(t.id, 'trial_soon');
    stats.reminded += 1;
  }

  // 2) Yenileme 2 gun icinde ve bakiye yetersiz.
  for (const t of await rows(
    "t.plan_status = 'active' AND t.auto_renew = 1 AND t.paid_until > ? AND t.paid_until <= datetime(?, '+2 days') AND u.balance_kurus < ? AND COALESCE(t.billing_notice, '') != 'renew_low'",
    [nowSql, nowSql, fee])) {
    await notifyOwner(dbAsync, t, 'Bayi paneli yenilemesi için bakiye yetersiz',
      `"${t.name}" ${trDate(t.paid_until)} tarihinde yenilenecek; ${money(fee)} için Jet bakiyeni yükle.`);
    await setNotice(t.id, 'renew_low');
    stats.reminded += 1;
  }

  // 3) Deneme bitti.
  for (const t of await rows("t.plan_status = 'trial' AND t.trial_ends_at <= ?", [nowSql])) {
    if (!t.auto_renew) {
      if (await expireTenant(t, now, 'Deneme süren bitti.')) stats.expired += 1;
      continue;
    }
    const charged = await chargeTenant(t.id, { periodStart: t.trial_ends_at, now });
    if (charged.ok) stats.charged += 1;
    else if (await markPastDue(t, now)) stats.past_due += 1;
  }

  // 4) Odenmis donem bitti.
  for (const t of await rows("t.plan_status = 'active' AND t.paid_until <= ?", [nowSql])) {
    if (!t.auto_renew) {
      if (await expireTenant(t, now, 'Abonelik yenilemesi kapalıydı.')) stats.expired += 1;
      continue;
    }
    const charged = await chargeTenant(t.id, { periodStart: t.paid_until, now });
    if (charged.ok) stats.charged += 1;
    else if (await markPastDue(t, now)) stats.past_due += 1;
  }

  // 5) Gecikmedekiler: bakiye yuklendiyse ucret alinir; sure dolduysa aski.
  for (const t of await rows("t.plan_status = 'past_due'", [])) {
    const charged = await chargeTenant(t.id, { periodStart: t.paid_until || t.trial_ends_at, now });
    if (charged.ok) { stats.charged += 1; continue; }
    const graceEnd = addDays(t.past_due_since, settings.grace_days);
    if (graceEnd && graceEnd <= now && await expireTenant(t, now, 'Aylık ücret gecikme süresinde ödenmedi.')) stats.expired += 1;
  }

  // 6) Askidakiler: silmeden 3 gun once uyari, sure dolunca silme.
  for (const t of await rows("t.plan_status = 'expired' AND t.billing_suspended_at IS NOT NULL", [])) {
    const deleteAt = addDays(t.billing_suspended_at, settings.delete_after_days);
    if (!deleteAt) continue;
    if (deleteAt <= now) {
      await require('./tenantDomains').releaseTenantDomains(t.id);
      await deleteTenantData(t.id);
      invalidateTenantCache();
      await dbAsync.run('INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details) VALUES (NULL, ?, ?, ?, ?)',
        ['tenant_deleted_unpaid', 'tenant', String(t.id), JSON.stringify({ name: t.name, slug: t.slug, owner_user_id: t.owner_user_id })]);
      await dbAsync.run('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
        [t.owner_user_id, 'reseller', 'Bayi paneli silindi', `"${t.name}" ${settings.delete_after_days} gün ödenmediği için silindi.`]);
      stats.deleted += 1;
    } else if (deleteAt.getTime() - now.getTime() <= 3 * 86_400_000 && t.billing_notice !== 'delete_soon') {
      await notifyOwner(dbAsync, t, 'Bayi panelin silinmek üzere',
        `"${t.name}" ${trDate(deleteAt)} tarihinde müşterileri ve ayarlarıyla silinecek. Bayi panelinden ${money(fee)} ödeyerek geri açabilirsin.`);
      await setNotice(t.id, 'delete_soon');
      stats.reminded += 1;
    }
  }
  return stats;
}

// ------------------------------------------------------------ bayi islemleri
async function continueSubscription(tenantId, owner) {
  const tenant = await dbAsync.get('SELECT * FROM tenants WHERE id = ?', [tenantId]);
  if (!tenant) return { ok: false, status: 404, error: 'Bayi bulunamadı.' };
  if (tenant.plan_status === 'comp') return { ok: true, message: 'Panelin ücretsiz; ödeme gerekmiyor.' };
  if (tenant.plan_status === 'trial' || tenant.plan_status === 'active') {
    await dbAsync.run('UPDATE tenants SET auto_renew = 1, billing_notice = NULL WHERE id = ?', [tenantId]);
    await logTenantActivity(dbAsync, { tenantId, actorType: 'owner', actorId: owner.id, action: 'subscription_continue' });
    const settings = await getResellerSettings();
    const when = tenant.plan_status === 'trial' ? tenant.trial_ends_at : tenant.paid_until;
    return { ok: true, message: `Tamam. ${trDate(when)} tarihinde ${money(feeKurus(settings))} Jet bakiyenden alınacak.` };
  }
  // Gecikmede veya askida: ucret hemen alinir, donem simdi baslar.
  const result = await chargeTenant(tenantId, { actorType: 'owner', actorId: owner.id });
  if (!result.ok) {
    return { ok: false, status: 402, code: 'OWNER_BALANCE', error: `Jet bakiyen ${money(result.feeKurus)} ücreti karşılamıyor. Önce bakiye yükle.` };
  }
  return { ok: true, message: `${money(result.feeKurus)} alındı; panelin ${trDate(result.periodEnd)} tarihine kadar açık.` };
}

async function cancelSubscription(tenantId, owner) {
  const tenant = await dbAsync.get('SELECT * FROM tenants WHERE id = ?', [tenantId]);
  if (!tenant || !['trial', 'active'].includes(tenant.plan_status)) {
    return { ok: false, status: 409, error: 'Bu durumda yenileme kapatılamaz.' };
  }
  await dbAsync.run('UPDATE tenants SET auto_renew = 0 WHERE id = ?', [tenantId]);
  await logTenantActivity(dbAsync, { tenantId, actorType: 'owner', actorId: owner.id, action: 'subscription_cancel' });
  const when = tenant.plan_status === 'trial' ? tenant.trial_ends_at : tenant.paid_until;
  return { ok: true, message: `Yenileme kapatıldı. Site ${trDate(when)} tarihinde kapanacak; istediğin zaman yeniden açabilirsin.` };
}

// Panel ve admin icin okunur ozet. Tarihler UTC SQLite metni olarak doner.
function subscriptionInfo(tenant, settings, ownerBalanceKurus) {
  const fee = feeKurus(settings);
  const status = tenant.plan_status || 'comp';
  const ends = status === 'trial' ? tenant.trial_ends_at : tenant.paid_until;
  const endDate = parseSqlDate(ends);
  const graceEnd = status === 'past_due' ? addDays(tenant.past_due_since, settings.grace_days) : null;
  const deleteAt = status === 'expired' ? addDays(tenant.billing_suspended_at, settings.delete_after_days) : null;
  return {
    plan_status: status,
    fee: fromKurus(fee),
    auto_renew: Boolean(tenant.auto_renew),
    trial_ends_at: tenant.trial_ends_at || null,
    paid_until: tenant.paid_until || null,
    period_ends_at: ends || null,
    days_left: endDate && ['trial', 'active'].includes(status) ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / 86_400_000)) : null,
    grace_ends_at: graceEnd ? sqlDate(graceEnd) : null,
    delete_at: deleteAt ? sqlDate(deleteAt) : null,
    owner_balance: ownerBalanceKurus === undefined ? undefined : fromKurus(ownerBalanceKurus),
    balance_enough: ownerBalanceKurus === undefined ? undefined : ownerBalanceKurus >= fee
  };
}

function startBillingWorker() {
  // Her saatin 7. dakikasi: deneme/donem sonlari saat hassasiyetinde islenir.
  cron.schedule('7 * * * *', () => runBillingCycle().catch(err => console.error('Reseller billing worker:', err.message)), { noOverlap: true });
}

module.exports = {
  BILLABLE, SUSPEND_REASON, feeKurus, sqlDate, trialFields, chargeTenant, runBillingCycle,
  continueSubscription, cancelSubscription, subscriptionInfo, startBillingWorker
};
