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
const { getResellerSettings, logTenantActivity, deleteTenantData, packageFeeTl, packageOf, PACKAGES, proMinimum } = require('./resellers');
const { invalidateTenantCache } = require('../tenant/resolve');
const mailer = require('./mailer');

const SUSPEND_REASON = 'Abonelik süresi doldu';
const BILLABLE = ['trial', 'active', 'past_due'];

// Paketin aylik ucreti (kurus). pkg verilmezse Standart.
function feeKurus(settings, pkg = 'standart') {
  return Math.max(0, Math.round(packageFeeTl(settings, pkg) * 100));
}

// Deneme sonrasi devam icin bayinin aktif bir ozel alan adi olmalidir.
async function hasActiveDomain(tenantId, db = dbAsync) {
  return Boolean(await db.get("SELECT 1 FROM tenant_domains WHERE tenant_id = ? AND status = 'active' LIMIT 1", [tenantId]));
}

const DOMAIN_REQUIRED = 'Devam etmek için önce kendi alan adını bağla (bayi paneli > Alan Adı). Deneme adresi yalnızca deneme süresince açıktır.';

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
  const result = await withTransaction(async tx => {
    const tenant = await tx.get('SELECT * FROM tenants WHERE id = ?', [tenantId]);
    if (!tenant) return { ok: false, reason: 'missing' };
    // Pro'dan Standart'a inis yeni donemle gecerli olur.
    const pkg = tenant.pending_package || packageOf(tenant);
    const fee = feeKurus(settings, pkg);
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
              package = ?, pending_package = NULL,
              status = CASE WHEN billing_suspended_at IS NOT NULL THEN 'active' ELSE status END,
              status_reason = CASE WHEN billing_suspended_at IS NOT NULL THEN NULL ELSE status_reason END,
              billing_suspended_at = NULL
        WHERE id = ?`,
      [end, pkg, tenant.id]
    );
    await logTenantActivity(tx, {
      tenantId: tenant.id, actorType, actorId, action: 'subscription_charged',
      details: { amount: fromKurus(fee), period_end: end, package: pkg }
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
    `${why} "${tenant.name}" sitesi kapatıldı. Bayi panelinden ${money(feeKurus(settings, tenant.pending_package || packageOf(tenant)))} ödeyerek hemen yeniden açabilirsin. `
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
    `Jet bakiyen ${money(feeKurus(settings, tenant.pending_package || packageOf(tenant)))} aylık ücreti karşılamadı. Site açık kalıyor; ${trDate(graceEnd)} tarihine kadar `
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
  const nowSql = sqlDate(now);
  const stats = { reminded: 0, charged: 0, past_due: 0, expired: 0, deleted: 0 };
  const rows = (sql, params) => dbAsync.all(
    `SELECT t.*, u.balance_kurus AS owner_balance_kurus FROM tenants t JOIN users u ON u.id = t.owner_user_id WHERE ${sql}`, params);
  const feeOf = t => feeKurus(settings, t.pending_package || packageOf(t));

  // 1) Deneme 1 gun icinde bitiyor (deneme 2 gun oldugu icin ikinci gun).
  for (const t of await rows(
    "t.plan_status = 'trial' AND t.trial_ends_at > ? AND t.trial_ends_at <= datetime(?, '+1 day') AND COALESCE(t.billing_notice, '') != 'trial_soon'",
    [nowSql, nowSql])) {
    const fee = feeOf(t);
    const domain = await hasActiveDomain(t.id);
    let message;
    if (!domain) {
      message = `Deneme ${trDate(t.trial_ends_at)} tarihinde bitiyor. Devam etmek için bayi panelinden kendi alan adını bağla ve ${money(fee)}/ay ile "Devam et"e bas; alan adı bağlanmazsa site kapanır.`;
    } else if (t.auto_renew) {
      message = t.owner_balance_kurus >= fee
        ? `Deneme ${trDate(t.trial_ends_at)} tarihinde bitiyor; ${money(fee)} Jet bakiyenden alınıp siten açık kalacak.`
        : `Deneme ${trDate(t.trial_ends_at)} tarihinde bitiyor. ${money(fee)} için Jet bakiyen yetersiz; bakiye yüklemezsen site askıya alınır.`;
    } else {
      message = `Deneme ${trDate(t.trial_ends_at)} tarihinde bitiyor. ${money(fee)}/ay ile devam etmek için bayi panelinde "Devam et"e bas; basmazsan site kapanır.`;
    }
    await notifyOwner(dbAsync, t, 'Bayi paneli denemen bitmek üzere', message);
    await setNotice(t.id, 'trial_soon');
    stats.reminded += 1;
  }

  // 2) Yenileme 2 gun icinde ve bakiye yetersiz.
  for (const t of await rows(
    "t.plan_status = 'active' AND t.auto_renew = 1 AND t.paid_until > ? AND t.paid_until <= datetime(?, '+2 days') AND COALESCE(t.billing_notice, '') != 'renew_low'",
    [nowSql, nowSql])) {
    const fee = feeOf(t);
    if (t.owner_balance_kurus >= fee) continue;
    await notifyOwner(dbAsync, t, 'Bayi paneli yenilemesi için bakiye yetersiz',
      `"${t.name}" ${trDate(t.paid_until)} tarihinde yenilenecek; ${money(fee)} için Jet bakiyeni yükle.`);
    await setNotice(t.id, 'renew_low');
    stats.reminded += 1;
  }

  // 3) Deneme bitti. Devam icin "Devam et" ve aktif ozel alan adi gerekir.
  for (const t of await rows("t.plan_status = 'trial' AND t.trial_ends_at <= ?", [nowSql])) {
    if (!t.auto_renew || !(await hasActiveDomain(t.id))) {
      if (await expireTenant(t, now, t.auto_renew ? 'Deneme bitti; kendi alan adın bağlı değil.' : 'Deneme süren bitti.')) stats.expired += 1;
      continue;
    }
    const charged = await chargeTenant(t.id, { periodStart: t.trial_ends_at, now });
    if (charged.ok) stats.charged += 1;
    else if (await markPastDue(t, now)) stats.past_due += 1;
  }

  // 4) Odenmis donem bitti.
  for (const t of await rows("t.plan_status = 'active' AND t.paid_until <= ?", [nowSql])) {
    if (!t.auto_renew || !(await hasActiveDomain(t.id))) {
      if (await expireTenant(t, now, t.auto_renew ? 'Kendi alan adın bağlı olmadığı için yenilenmedi.' : 'Abonelik yenilemesi kapalıydı.')) stats.expired += 1;
      continue;
    }
    const charged = await chargeTenant(t.id, { periodStart: t.paid_until, now });
    if (charged.ok) stats.charged += 1;
    else if (await markPastDue(t, now)) stats.past_due += 1;
  }

  // 5) Gecikmedekiler: bakiye yuklendiyse ucret alinir; sure dolduysa aski.
  for (const t of await rows("t.plan_status = 'past_due'", [])) {
    if (await hasActiveDomain(t.id)) {
      const charged = await chargeTenant(t.id, { periodStart: t.paid_until || t.trial_ends_at, now });
      if (charged.ok) { stats.charged += 1; continue; }
    }
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
        `"${t.name}" ${trDate(deleteAt)} tarihinde müşterileri ve ayarlarıyla silinecek. Bayi panelinden ${money(feeOf(t))} ödeyerek geri açabilirsin.`);
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
  if (!(await hasActiveDomain(tenantId))) return { ok: false, status: 409, code: 'DOMAIN_REQUIRED', error: DOMAIN_REQUIRED };
  if (tenant.plan_status === 'trial' || tenant.plan_status === 'active') {
    await dbAsync.run('UPDATE tenants SET auto_renew = 1, billing_notice = NULL WHERE id = ?', [tenantId]);
    await logTenantActivity(dbAsync, { tenantId, actorType: 'owner', actorId: owner.id, action: 'subscription_continue' });
    const settings = await getResellerSettings();
    const when = tenant.plan_status === 'trial' ? tenant.trial_ends_at : tenant.paid_until;
    return { ok: true, message: `Tamam. ${trDate(when)} tarihinde ${money(feeKurus(settings, tenant.pending_package || packageOf(tenant)))} Jet bakiyenden alınacak.` };
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

// Paket degisikligi.
//  deneme / gecikme / aski: hemen gecerli (sonraki ucret yeni paketten).
//  aktif donem, Standart -> Pro: kalan gune dusen fark simdi Jet bakiyesinden alinir.
//  aktif donem, Pro -> Standart: donem sonunda gecerli (pending_package).
// Pro'ya geciste en az pro_min_jet_services Jet servisi satista olmalidir.
async function changePackage(tenantId, owner, pkg, { now = new Date(), actorType = 'owner' } = {}) {
  if (!PACKAGES[pkg]) return { ok: false, status: 400, error: 'Bilinmeyen paket.' };
  const settings = await getResellerSettings();
  const tenant = await dbAsync.get('SELECT * FROM tenants WHERE id = ?', [tenantId]);
  if (!tenant) return { ok: false, status: 404, error: 'Bayi bulunamadı.' };
  const current = packageOf(tenant);
  if (current === pkg && !tenant.pending_package) return { ok: true, message: `Zaten ${PACKAGES[pkg].name} paketindesin.` };
  if (pkg === 'pro') {
    const min = await proMinimum(tenantId, settings);
    if (min.enabled < min.required) {
      return { ok: false, status: 409, code: 'PRO_MIN_SERVICES', error: `Pro pakette en az ${min.required} Jet servisi satışta olmalı; şu an ${min.enabled}. Önce kapattığın servislerden bazılarını aç.` };
    }
  }
  const log = details => logTenantActivity(dbAsync, { tenantId, actorType, actorId: owner?.id || null, action: 'package_changed', details });

  if (tenant.plan_status === 'active' && current === 'pro' && pkg === 'standart') {
    await dbAsync.run("UPDATE tenants SET pending_package = 'standart' WHERE id = ?", [tenantId]);
    await log({ from: current, to: pkg, effective: tenant.paid_until });
    return { ok: true, message: `Standart pakete ${trDate(tenant.paid_until)} tarihinde geçeceksin; o güne kadar Pro özellikleri açık.` };
  }
  if (tenant.plan_status === 'active' && current === 'pro' && pkg === 'pro') {
    await dbAsync.run('UPDATE tenants SET pending_package = NULL WHERE id = ?', [tenantId]);
    await log({ from: 'standart (bekleyen)', to: 'pro' });
    return { ok: true, message: 'Standart pakete geçiş iptal edildi; Pro devam ediyor.' };
  }
  if (tenant.plan_status === 'active' && pkg === 'pro') {
    const end = parseSqlDate(tenant.paid_until);
    const daysLeft = end ? Math.max(0, (end.getTime() - now.getTime()) / 86_400_000) : 0;
    const diff = Math.max(0, Math.round((feeKurus(settings, 'pro') - feeKurus(settings, 'standart')) * Math.min(30, daysLeft) / 30));
    const result = await withTransaction(async tx => {
      if (diff > 0) {
        const debit = await tx.run(
          'UPDATE users SET balance_kurus = balance_kurus - ?, balance = (balance_kurus - ?) / 100.0 WHERE id = ? AND balance_kurus >= ?',
          [diff, diff, tenant.owner_user_id, diff]);
        if (debit.changes !== 1) return { ok: false };
        await tx.run(
          `INSERT INTO tenant_invoices (tenant_id, owner_user_id, tenant_name, amount_kurus, period_start, period_end, note)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [tenant.id, tenant.owner_user_id, tenant.name, diff, sqlDate(now), tenant.paid_until, 'Pro paket farkı']);
      }
      await tx.run("UPDATE tenants SET package = 'pro', pending_package = NULL WHERE id = ?", [tenantId]);
      return { ok: true };
    });
    if (!result.ok) return { ok: false, status: 402, code: 'OWNER_BALANCE', error: `Pro'ya geçiş için ${money(diff)} fark gerekiyor; Jet bakiyen yetmiyor.` };
    await log({ from: current, to: pkg, charged: fromKurus(diff) });
    invalidateTenantCache();
    return { ok: true, message: diff > 0 ? `Pro pakete geçtin; kalan ${Math.ceil(daysLeft)} günün farkı ${money(diff)} Jet bakiyenden alındı.` : 'Pro pakete geçtin.' };
  }
  await dbAsync.run('UPDATE tenants SET package = ?, pending_package = NULL WHERE id = ?', [pkg, tenantId]);
  await log({ from: current, to: pkg });
  invalidateTenantCache();
  return { ok: true, message: `${PACKAGES[pkg].name} paketine geçtin; aylık ücret ${money(feeKurus(settings, pkg))}.` };
}

// Panel ve admin icin okunur ozet. Tarihler UTC SQLite metni olarak doner.
function subscriptionInfo(tenant, settings, ownerBalanceKurus) {
  const pkg = packageOf(tenant);
  const nextPkg = tenant.pending_package || pkg;
  const fee = feeKurus(settings, nextPkg);
  const status = tenant.plan_status || 'comp';
  const ends = status === 'trial' ? tenant.trial_ends_at : tenant.paid_until;
  const endDate = parseSqlDate(ends);
  const graceEnd = status === 'past_due' ? addDays(tenant.past_due_since, settings.grace_days) : null;
  const deleteAt = status === 'expired' ? addDays(tenant.billing_suspended_at, settings.delete_after_days) : null;
  return {
    plan_status: status,
    package: pkg,
    package_name: PACKAGES[pkg].name,
    pending_package: tenant.pending_package || null,
    fees: { standart: fromKurus(feeKurus(settings, 'standart')), pro: fromKurus(feeKurus(settings, 'pro')) },
    fee: fromKurus(fee),
    hours_left: endDate && ['trial', 'active'].includes(status) ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / 3_600_000)) : null,
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
  continueSubscription, cancelSubscription, changePackage, hasActiveDomain, subscriptionInfo, startBillingWorker
};
