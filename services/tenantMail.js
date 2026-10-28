'use strict';

// Bayi e-postalari (F6).
//  Musteriye (bayinin adiyla): hos geldin, bakiye yuklendi, siparis bitti.
//  Bayiye (Jet hesabinin e-postasina, Jet'ten): yeni havale bildirimi,
//  Jet bakiyesi yetmedigi icin alinamayan siparis.
// KURAL: bayinin musterisine Jet'in sunucusundan e-posta GITMEZ. Musteri
// e-postalari (sifre sifirlama dahil) yalnizca bayi kendi SMTP'sini girdiyse
// onun adresinden gider; girmediyse gonderilmez ve kayda "atlandi" duser.
// Bayiye giden e-postalar (Jet hesabina) Jet SMTP'siyle gider.
// Gonderim hicbir zaman cagiranin akisini bozmaz: hata tenant_mail_log'a
// yazilir. Demo bayi e-posta gondermez.
const dns = require('dns').promises;
const nodemailer = require('nodemailer');
const { dbAsync } = require('../config/database');
const mailer = require('./mailer');
const { encryptSecret, decryptSecret } = require('../utils/security');
const { isPrivateIp } = require('../utils/network');
const { fromKurus } = require('../utils/money');
const { tenantSettings, baseDomain } = require('../tenant/resolve');

const SMTP_PORTS = new Set([25, 465, 587, 2525]);
const DEFAULTS = { notify_welcome: 1, notify_payment: 1, notify_order: 0 };

function money(kurus) {
  return `₺${fromKurus(kurus).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function settingsRow(tenantId) {
  return (await dbAsync.get('SELECT * FROM tenant_mail_settings WHERE tenant_id = ?', [tenantId])) || { tenant_id: tenantId, ...DEFAULTS };
}

function smtpReady(row) {
  return Boolean(row.smtp_host && row.smtp_port && row.smtp_user && row.smtp_pass_encrypted && row.smtp_from);
}

/** Panelde gosterilen ayarlar (parola geri gonderilmez). */
async function mailSettings(tenantId) {
  const row = await settingsRow(tenantId);
  const log = await dbAsync.all(
    'SELECT kind, recipient, subject, status, error, created_at FROM tenant_mail_log WHERE tenant_id = ? ORDER BY id DESC LIMIT 20', [tenantId]);
  return {
    notify: { welcome: Boolean(row.notify_welcome), payment: Boolean(row.notify_payment), order: Boolean(row.notify_order) },
    smtp: {
      host: row.smtp_host || '', port: row.smtp_port || 587, secure: Boolean(row.smtp_secure), user: row.smtp_user || '',
      from: row.smtp_from || '', has_password: Boolean(row.smtp_pass_encrypted), active: smtpReady(row)
    },
    log
  };
}

// Bayinin girdigi sunucu yalnizca acik internette olabilir (SSRF): ad
// cozulur, ozel/yerel adres reddedilir ve baglanti cozulen IP'ye yapilir
// (DNS'in sonradan degismesiyle ic aga yonlenemez). TLS adi korunur.
async function safeSmtpTarget(host, port) {
  if (!SMTP_PORTS.has(Number(port))) throw Object.assign(new Error('SMTP portu 25, 465, 587 veya 2525 olmalı.'), { status: 400 });
  let records;
  try {
    records = await dns.lookup(host, { all: true });
  } catch {
    throw Object.assign(new Error('SMTP sunucusunun adresi bulunamadı.'), { status: 400 });
  }
  if (!records.length || records.some(r => isPrivateIp(r.address))) {
    throw Object.assign(new Error('Özel ağ ve yerel adreslere bağlanılamaz; SMTP sağlayıcının adresini gir.'), { status: 400 });
  }
  return records[0].address;
}

async function customTransport(row) {
  const ip = await safeSmtpTarget(row.smtp_host, row.smtp_port);
  return nodemailer.createTransport({
    host: ip,
    port: Number(row.smtp_port),
    secure: Boolean(row.smtp_secure),
    auth: { user: row.smtp_user, pass: decryptSecret(row.smtp_pass_encrypted) },
    tls: { servername: row.smtp_host },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000
  });
}

async function logMail(tenantId, kind, recipient, subject, status, error = null) {
  await dbAsync.run(
    'INSERT INTO tenant_mail_log (tenant_id, kind, recipient, subject, status, error) VALUES (?, ?, ?, ?, ?, ?)',
    [tenantId, kind, recipient || null, String(subject || '').slice(0, 200), status, error ? String(error).slice(0, 300) : null]
  ).catch(() => {});
}

/**
 * Musteriye bayinin adiyla e-posta. true: gitti, false: gitmedi (kaydi var).
 * Hata firlatmaz.
 */
async function sendCustomerMail(tenant, { kind, to, subject, text }) {
  const settings = tenantSettings(tenant);
  if (settings.demo || !to) return false;
  try {
    const row = await settingsRow(tenant.id);
    if (!smtpReady(row)) {
      await logMail(tenant.id, kind, to, subject, 'skipped', 'Kendi e-posta (SMTP) ayarın olmadığı için gönderilmedi.');
      return false;
    }
    const transport = await customTransport(row);
    await transport.sendMail({ from: mailer.withName(row.smtp_from, tenant.name), to, subject, text, ...(settings.support_email ? { replyTo: settings.support_email } : {}) });
    await logMail(tenant.id, kind, to, subject, 'sent');
    return true;
  } catch (err) {
    await logMail(tenant.id, kind, to, subject, 'failed', err.message);
    return false;
  }
}

/** Bayi sahibine (Jet hesabinin e-postasi) Jet SMTP'si ile. */
async function sendOwnerMail(tenant, { kind, subject, text }) {
  if (tenantSettings(tenant).demo) return false;
  const owner = await dbAsync.get('SELECT email FROM users WHERE id = ?', [tenant.owner_user_id]).catch(() => null);
  if (!owner?.email) return false;
  try {
    const sent = await mailer.sendMail({ to: owner.email, subject, text });
    await logMail(tenant.id, kind, owner.email, subject, sent ? 'sent' : 'skipped', sent ? null : 'E-posta servisi yapılandırılmamış.');
    return Boolean(sent);
  } catch (err) {
    await logMail(tenant.id, kind, owner.email, subject, 'failed', err.message);
    return false;
  }
}

async function recentlySent(tenantId, kind, hours) {
  const row = await dbAsync.get(
    `SELECT 1 FROM tenant_mail_log WHERE tenant_id = ? AND kind = ? AND status = 'sent' AND created_at >= datetime('now', ?) LIMIT 1`,
    [tenantId, kind, `-${hours} hours`]);
  return Boolean(row);
}

/** Sitenin musteriye gosterilen adresi: aktif ozel alan adi, yoksa alt adres. */
async function siteUrl(tenant) {
  const domain = await dbAsync.get("SELECT domain FROM tenant_domains WHERE tenant_id = ? AND status = 'active' ORDER BY id LIMIT 1", [tenant.id]).catch(() => null);
  if (domain) return `https://${domain.domain}`;
  const base = baseDomain();
  return base ? `https://${tenant.slug}.${base}` : '';
}

function signature(tenant, url) {
  return `\n\n— ${tenant.name}${url ? `\n${url}` : ''}`;
}

async function loadTenant(tenantId) {
  return dbAsync.get('SELECT * FROM tenants WHERE id = ?', [tenantId]);
}

// ------------------------------------------------------------ musteriye

async function customerWelcome(tenant, customer) {
  const row = await settingsRow(tenant.id);
  if (!row.notify_welcome) return false;
  const url = await siteUrl(tenant);
  return sendCustomerMail(tenant, {
    kind: 'welcome',
    to: customer.email,
    subject: `${tenant.name} hesabın hazır`,
    text: `Merhaba ${customer.username},\n\n${tenant.name} hesabın oluşturuldu. Bakiyeni yükleyip hemen sipariş verebilirsin.${url ? `\n\nBakiye yükle: ${url}/bakiye\nYeni sipariş: ${url}/order` : ''}${signature(tenant, url)}`
  });
}

async function paymentCompleted(paymentId) {
  const payment = await dbAsync.get(
    `SELECT p.*, c.username, c.email, c.balance_kurus AS customer_balance FROM tenant_payments p
       JOIN tenant_customers c ON c.id = p.customer_id WHERE p.id = ?`, [paymentId]);
  if (!payment || payment.status !== 'completed') return false;
  const tenant = await loadTenant(payment.tenant_id);
  if (!tenant) return false;
  const row = await settingsRow(tenant.id);
  if (!row.notify_payment) return false;
  const url = await siteUrl(tenant);
  return sendCustomerMail(tenant, {
    kind: 'payment',
    to: payment.email,
    subject: `${tenant.name}: ${money(payment.amount_kurus)} bakiyene eklendi`,
    text: `Merhaba ${payment.username},\n\n${money(payment.amount_kurus)} tutarındaki ödemen onaylandı ve bakiyene eklendi.\nGüncel bakiyen: ${money(payment.customer_balance)}${url ? `\n\nSipariş vermek için: ${url}/order` : ''}${signature(tenant, url)}`
  });
}

const FINISHED = {
  completed: (o, refund) => [`#${o.id} siparişin tamamlandı`, `#${o.id} numaralı siparişin tamamlandı.`],
  partial: (o, refund) => [`#${o.id} siparişin kısmen tamamlandı`, `#${o.id} numaralı siparişin kısmen tamamlandı; gönderilemeyen kısmın tutarı (${money(refund)}) bakiyene iade edildi.`],
  canceled: (o, refund) => [`#${o.id} siparişin iptal edildi`, `#${o.id} numaralı siparişin iptal edildi; ${money(refund)} bakiyene iade edildi.`]
};

async function orderFinished(orderId) {
  const order = await dbAsync.get(
    `SELECT o.id, o.tenant_id, o.status, o.link, o.quantity, o.tenant_refunded_kurus, c.username, c.email,
            COALESCE(NULLIF(tp.custom_name, ''), NULLIF(s.name_tr, ''), s.name) AS service_name
       FROM orders o
       JOIN tenant_customers c ON c.id = o.tenant_customer_id
       LEFT JOIN services s ON s.id = o.service_id
       LEFT JOIN tenant_service_prices tp ON tp.tenant_id = o.tenant_id AND tp.service_id = o.service_id
      WHERE o.id = ?`, [orderId]);
  if (!order || !FINISHED[order.status]) return false;
  const tenant = await loadTenant(order.tenant_id);
  if (!tenant) return false;
  const row = await settingsRow(tenant.id);
  if (!row.notify_order) return false;
  const url = await siteUrl(tenant);
  const [title, line] = FINISHED[order.status](order, order.tenant_refunded_kurus || 0);
  return sendCustomerMail(tenant, {
    kind: 'order',
    to: order.email,
    subject: `${tenant.name}: ${title}`,
    text: `Merhaba ${order.username},\n\n${line}\n\nServis: ${order.service_name || '-'}\nMiktar: ${Number(order.quantity).toLocaleString('tr-TR')}\nBağlantı: ${order.link}${url ? `\n\nSiparişlerin: ${url}/orders` : ''}${signature(tenant, url)}`
  });
}

// ------------------------------------------------------------ bayiye

async function ownerBankNotice(tenant, payment, customer) {
  const url = await siteUrl(tenant);
  return sendOwnerMail(tenant, {
    kind: 'owner_bank_notice',
    subject: `Yeni havale bildirimi · ${tenant.name}`,
    text: `"${tenant.name}" sitende ${customer.username} kullanıcısı ${money(payment.amount_kurus)} havale bildirdi.\nGönderen: ${payment.sender_name || '-'} · ${payment.bank_name || '-'}\n\nParayı hesabında gördükten sonra onayla: ${url ? `${url}/admin/payments` : 'bayi paneli > Ödemeler'}`
  });
}

// Bayinin Jet bakiyesi yetmedigi icin musterinin siparisi alinamadi.
// 12 saatte en fazla bir e-posta.
async function ownerBalanceLow(tenant, requiredKurus) {
  if (await recentlySent(tenant.id, 'owner_balance_low', 12)) return false;
  return sendOwnerMail(tenant, {
    kind: 'owner_balance_low',
    subject: `Jet bakiyen yetmediği için sipariş alınamadı · ${tenant.name}`,
    text: `"${tenant.name}" sitende bir müşterinin ${requiredKurus ? `${money(requiredKurus)} maliyetli ` : ''}siparişi, Jet bakiyen yetmediği için alınamadı. Müşteriye tutar gösterilmedi; yalnızca sitenin şu an sipariş almadığı söylendi.\n\nMüşteri kaybetmemek için Jet bakiyeni yükle. Bu uyarı en fazla 12 saatte bir gönderilir.`
  });
}

// ------------------------------------------------------------ panel

/**
 * Bildirim tercihleri ve SMTP kaydi. smtp: null -> SMTP silinir; parola bos
 * gelirse kayitli parola korunur.
 */
async function saveMailSettings(tenantId, { notify, smtp }) {
  const current = await settingsRow(tenantId);
  const next = {
    notify_welcome: notify ? (notify.welcome ? 1 : 0) : current.notify_welcome,
    notify_payment: notify ? (notify.payment ? 1 : 0) : current.notify_payment,
    notify_order: notify ? (notify.order ? 1 : 0) : current.notify_order,
    smtp_host: current.smtp_host || null,
    smtp_port: current.smtp_port || null,
    smtp_secure: current.smtp_secure ? 1 : 0,
    smtp_user: current.smtp_user || null,
    smtp_pass_encrypted: current.smtp_pass_encrypted || null,
    smtp_from: current.smtp_from || null
  };
  if (smtp === null) {
    Object.assign(next, { smtp_host: null, smtp_port: null, smtp_secure: 0, smtp_user: null, smtp_pass_encrypted: null, smtp_from: null });
  } else if (smtp) {
    await safeSmtpTarget(smtp.host, smtp.port);
    Object.assign(next, {
      smtp_host: smtp.host,
      smtp_port: Number(smtp.port),
      smtp_secure: smtp.secure ? 1 : 0,
      smtp_user: smtp.user,
      smtp_from: smtp.from,
      smtp_pass_encrypted: smtp.password ? encryptSecret(smtp.password) : (current.smtp_pass_encrypted || null)
    });
    if (!next.smtp_pass_encrypted) throw Object.assign(new Error('SMTP parolasını gir.'), { status: 400, field: 'password' });
  }
  await dbAsync.run(
    `INSERT INTO tenant_mail_settings (tenant_id, notify_welcome, notify_payment, notify_order, smtp_host, smtp_port, smtp_secure,
       smtp_user, smtp_pass_encrypted, smtp_from, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(tenant_id) DO UPDATE SET notify_welcome = excluded.notify_welcome, notify_payment = excluded.notify_payment,
       notify_order = excluded.notify_order, smtp_host = excluded.smtp_host, smtp_port = excluded.smtp_port,
       smtp_secure = excluded.smtp_secure, smtp_user = excluded.smtp_user, smtp_pass_encrypted = excluded.smtp_pass_encrypted,
       smtp_from = excluded.smtp_from, updated_at = CURRENT_TIMESTAMP`,
    [tenantId, next.notify_welcome, next.notify_payment, next.notify_order, next.smtp_host, next.smtp_port, next.smtp_secure,
      next.smtp_user, next.smtp_pass_encrypted, next.smtp_from]
  );
  return mailSettings(tenantId);
}

/** Musteriye e-posta gonderilebilir mi (bayinin kendi SMTP'si kayitli mi)? */
async function customerMailReady(tenantId) {
  return smtpReady(await settingsRow(tenantId));
}

/** Paneldeki "Test e-postasi gonder": hata mesaji bayiye gosterilir. */
async function sendTestMail(tenant, to) {
  const row = await settingsRow(tenant.id);
  if (!smtpReady(row)) throw Object.assign(new Error('Önce SMTP bilgilerini kaydet; müşteri e-postaları yalnızca senin adresinden gider.'), { status: 400 });
  const subject = `${tenant.name} test e-postası`;
  const text = `Bu bir test e-postasıdır. Müşterilerine giden e-postalar bu adresten ve "${tenant.name}" adıyla gönderilecek.`;
  try {
    const transport = await customTransport(row);
    await transport.sendMail({ from: mailer.withName(row.smtp_from, tenant.name), to, subject, text });
  } catch (err) {
    await logMail(tenant.id, 'test', to, subject, 'failed', err.message);
    throw Object.assign(new Error(`Gönderilemedi: ${err.message}`), { status: 400 });
  }
  await logMail(tenant.id, 'test', to, subject, 'sent');
  return { custom: true };
}

// Cagiranlar beklemez; hata yalnizca kayda duser.
function fireAndForget(promise) {
  Promise.resolve(promise).catch(err => console.error('Bayi e-postası:', err.message));
}

module.exports = {
  mailSettings, saveMailSettings, sendTestMail, safeSmtpTarget, SMTP_PORTS, customerMailReady,
  customerWelcome, paymentCompleted, orderFinished, ownerBankNotice, ownerBalanceLow,
  sendCustomerMail, fireAndForget
};
