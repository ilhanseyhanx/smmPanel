'use strict';

// Bayi musterisinin bakiye yuklemesi (Bayi Paneli F1).
// Para dogrudan BAYININ odeme hesabina gider; Jet tahsilat yapmaz. Bu modul
// yontem ayarlarini (anahtarlar sifreli), odeme kaydinin tamamlanmasini ve
// musteri bakiyesine yazilmasini yonetir. Anahtarlar panele geri gonderilmez;
// panel yalnizca "kayitli" bilgisini gorur.
const { dbAsync } = require('../config/database');
const { encryptSecret, decryptSecret, normalizePlainText } = require('../utils/security');
const { fromKurus } = require('../utils/money');
const { changeCustomerBalance, logTenantActivity } = require('./resellers');

const MAX_KURUS = 10_000_000; // 100.000 TL

const METHODS = {
  bank: { label: 'Havale / EFT / Papara', secrets: [], minKurus: 1000, floorKurus: 100 },
  paytr: { label: 'Kredi / Banka Kartı', secrets: ['merchant_id', 'merchant_key', 'merchant_salt'], minKurus: 1000, floorKurus: 100 },
  // Shopier: bayi yalnizca anahtarini (PAT) girer; webhook imza anahtari
  // kaydederken bayinin hesabinda acilan abonelikten gelir (webhook_token).
  shopier: { label: 'Kart (Shopier)', secrets: ['pat'], minKurus: 1000, floorKurus: 1000 },
  nowpayments: { label: 'Kripto Para', secrets: ['api_key', 'ipn_secret'], minKurus: 40000, floorKurus: 10000 }
};

function decryptJson(value) {
  if (!value) return {};
  try { return JSON.parse(decryptSecret(value)) || {}; } catch { return {}; }
}

function parseJson(value) {
  try { return JSON.parse(value || '{}') || {}; } catch { return {}; }
}

function isConfigured(method, secrets, pub) {
  if (method === 'bank') return Boolean(String(pub.accounts || '').trim());
  if (method === 'shopier' && !String(secrets.webhook_token || '').trim()) return false;
  return METHODS[method].secrets.every(key => String(secrets[key] || '').trim());
}

async function loadMethods(tenantId, db = dbAsync) {
  const rows = await db.all('SELECT * FROM tenant_payment_settings WHERE tenant_id = ?', [tenantId]);
  const out = {};
  for (const [method, meta] of Object.entries(METHODS)) {
    const row = rows.find(r => r.method === method);
    const secrets = decryptJson(row?.secrets_encrypted);
    const pub = parseJson(row?.public_json);
    out[method] = {
      method,
      label: meta.label,
      enabled: Boolean(row?.enabled),
      min_kurus: row?.min_kurus ?? meta.minKurus,
      max_kurus: row?.max_kurus ?? MAX_KURUS,
      public: pub,
      secrets,
      configured: isConfigured(method, secrets, pub)
    };
  }
  return out;
}

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Bos gelen anahtar alani eskisini korur: panel anahtari geri gostermedigi
// icin bayi yalnizca degistirdigi alani doldurur.
// internalSecrets: kullanicidan gelmeyen, sistemin urettigi gizli degerler
// (Shopier webhook imza anahtari gibi).
async function saveMethod(tenantId, method, { enabled, minKurus, maxKurus, publicData, secrets, internalSecrets }) {
  const meta = METHODS[method];
  if (!meta) throw httpError('Bilinmeyen ödeme yöntemi.');
  const current = (await loadMethods(tenantId))[method];
  const merged = { ...current.secrets, ...(internalSecrets || {}) };
  for (const key of meta.secrets) {
    const value = String(secrets?.[key] ?? '').trim();
    if (value) merged[key] = value;
  }
  const pub = publicData ?? current.public;
  const min = minKurus ?? current.min_kurus;
  const max = maxKurus ?? current.max_kurus;
  if (min < meta.floorKurus) throw httpError(`En düşük tutar ₺${fromKurus(meta.floorKurus)} altında olamaz.`);
  if (max < min) throw httpError('En yüksek tutar, en düşük tutardan küçük olamaz.');
  if (enabled && !isConfigured(method, merged, pub)) {
    throw httpError(method === 'bank'
      ? 'Açmadan önce en az bir hesap bilgisi (IBAN / Papara) yazın.'
      : method === 'shopier'
        ? 'Açmadan önce Kişisel Erişim Anahtarını girin (ödeme bildirimi kaydederken kurulur).'
        : 'Açmadan önce tüm anahtar alanlarını doldurun.');
  }
  await dbAsync.run(
    `INSERT INTO tenant_payment_settings (tenant_id, method, enabled, min_kurus, max_kurus, public_json, secrets_encrypted, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(tenant_id, method) DO UPDATE SET enabled = excluded.enabled, min_kurus = excluded.min_kurus,
       max_kurus = excluded.max_kurus, public_json = excluded.public_json,
       secrets_encrypted = excluded.secrets_encrypted, updated_at = CURRENT_TIMESTAMP`,
    [tenantId, method, enabled ? 1 : 0, min, max, JSON.stringify(pub),
      Object.keys(merged).length ? encryptSecret(JSON.stringify(merged)) : null]
  );
  return (await loadMethods(tenantId))[method];
}

function amountError(method, amountKurus) {
  if (amountKurus < method.min_kurus) return `${method.label} ile en az ₺${fromKurus(method.min_kurus).toFixed(2)} yükleyebilirsin.`;
  if (amountKurus > method.max_kurus) return `${method.label} ile tek seferde en fazla ₺${fromKurus(method.max_kurus).toFixed(2)} yükleyebilirsin.`;
  return null;
}

// Yalnizca 'pending' kayit bir kez 'completed' olur ve musteri bakiyesine
// yazilir; saglayici bildirimi tekrar gelse de cift yukleme olmaz.
// db: transaction baglantisi.
async function completePayment(db, paymentId, { actor = null, actorType = 'system', actorId = null, providerRef = null } = {}) {
  const claimed = await db.run(
    `UPDATE tenant_payments SET status = 'completed', completed_at = CURRENT_TIMESTAMP,
            provider_ref = COALESCE(?, provider_ref), reviewed_by = COALESCE(?, reviewed_by)
      WHERE id = ? AND status = 'pending'`,
    [providerRef, actor, paymentId]
  );
  if (claimed.changes !== 1) return null;
  const payment = await db.get('SELECT * FROM tenant_payments WHERE id = ?', [paymentId]);
  const label = METHODS[payment.method]?.label || payment.method;
  const result = await changeCustomerBalance(db, {
    tenantId: payment.tenant_id,
    customerId: payment.customer_id,
    amountKurus: payment.amount_kurus,
    type: 'deposit',
    note: `${label} · ödeme #${payment.id}`,
    actor: actor || `system:${payment.method}`
  });
  if (!result) throw httpError('Müşteri bakiyesi güncellenemedi.', 500);
  await db.run('UPDATE tenant_payments SET balance_log_id = ? WHERE id = ?', [result.logId, payment.id]);
  await logTenantActivity(db, {
    tenantId: payment.tenant_id, actorType, actorId, action: 'payment_completed',
    details: { payment_id: payment.id, method: payment.method, amount: fromKurus(payment.amount_kurus), customer_id: payment.customer_id }
  });
  return { payment, balanceKurus: result.balanceKurus };
}

async function closePayment(db, paymentId, reason, { status = 'failed', actor = null } = {}) {
  const changed = await db.run(
    `UPDATE tenant_payments SET status = ?, failure_reason = ?, reviewed_by = COALESCE(?, reviewed_by), completed_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'pending'`,
    [status, normalizePlainText(String(reason || ''), 300) || null, actor, paymentId]
  );
  return changed.changes === 1;
}

function publicPayment(p) {
  return {
    id: p.id,
    method: p.method,
    method_label: METHODS[p.method]?.label || p.method,
    amount: fromKurus(p.amount_kurus),
    status: p.status,
    failure_reason: p.failure_reason || null,
    created_at: p.created_at,
    completed_at: p.completed_at || null
  };
}

module.exports = {
  METHODS, MAX_KURUS, loadMethods, saveMethod, amountError, completePayment, closePayment, publicPayment, isConfigured
};
