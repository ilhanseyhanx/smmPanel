'use strict';

// PAKET SERVIS YONETIMI (admin) — /api/admin/bundles
// Kimlik + admin yetkisi server.js'te bu router'a baglanirken uygulanir.
const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { dbAsync, withTransaction } = require('../config/database');
const { validate } = require('../middleware/validate');
const { toKurus, fromKurus } = require('../utils/money');
const { normalizePlainText } = require('../utils/security');
const { parseRefillFlag } = require('../utils/serviceFlags');
const bundles = require('../services/bundles');

const itemSchema = z.object({
  service_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(1).max(100_000_000)
});

const bundleSchema = z.object({
  name_tr: z.string().trim().min(2).max(220),
  name_en: z.string().trim().max(220).optional(),
  category_name: z.string().trim().min(1).max(100),
  category_name_en: z.string().trim().max(100).optional(),
  description_tr: z.string().max(5000).optional(),
  description_en: z.string().max(5000).optional(),
  // Paket fiyati (TL): tek paketin satis fiyati. Musteri N paket alirsa N x fiyat oder.
  price: z.coerce.number().finite().min(0.01).max(1_000_000),
  price_usd: z.coerce.number().finite().min(0).max(1_000_000).optional(),
  min_packages: z.coerce.number().int().min(1).max(100_000).optional(),
  max_packages: z.coerce.number().int().min(1).max(100_000).optional(),
  refill: z.union([z.boolean(), z.string(), z.number()]).optional(),
  start_time_tr: z.string().max(200).optional(),
  start_time_en: z.string().max(200).optional(),
  speed_tr: z.string().max(200).optional(),
  speed_en: z.string().max(200).optional(),
  features_tr: z.string().max(3000).optional(),
  features_en: z.string().max(3000).optional(),
  warranty_hours: z.coerce.number().int().min(0).max(87600).optional(),
  refund_policy_tr: z.string().max(3000).optional(),
  refund_policy_en: z.string().max(3000).optional(),
  terms_required: z.union([z.boolean(), z.string(), z.number()]).optional(),
  status: z.coerce.number().int().min(0).max(1).optional(),
  items: z.array(itemSchema).min(bundles.MIN_ITEMS).max(bundles.MAX_ITEMS)
});

const statusSchema = z.object({ status: z.coerce.number().int().min(0).max(1) });

function requireIdParam(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Geçersiz kayıt numarası.' });
  req.recordId = id;
  next();
}

function featureList(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value).split(/\r?\n/)
    .map(line => normalizePlainText(line.replace(/^\s*[-•*]\s*/, ''), 200))
    .filter(Boolean).slice(0, 20).join('\n');
}

function truthy(value) {
  return value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0;
}

async function categoryIdFor(db, name, nameEn) {
  const safeName = normalizePlainText(name, 100);
  const existing = await db.get('SELECT id FROM categories WHERE name = ? OR name_tr = ? LIMIT 1', [safeName, safeName]);
  if (existing) return existing.id;
  const created = await db.run(
    `INSERT INTO categories (name, name_tr, name_en, icon) VALUES (?, ?, ?, 'fa-box-open')`,
    [safeName, safeName, normalizePlainText(nameEn || name, 100)]
  );
  return created.id;
}

// Paket satirini admin ekrani icin zenginlestirir: icerik, tek tek deger, uyarilar.
async function decorate(bundle) {
  const items = await bundles.bundleItemsOf(dbAsync, bundle.id);
  const standaloneKurus = items.reduce((acc, item) => acc + bundles.componentValueKurus(item, 1), 0);
  const warnings = [];
  for (const item of items) {
    const label = item.name_tr || item.name;
    if (Number(item.status) !== 1) warnings.push(`"${label}" pasif durumda; paket sipariş edilemez.`);
    else if (!item.provider_id || Number(item.provider_status) !== 1) warnings.push(`"${label}" servisinin aktif bir sağlayıcısı yok.`);
    if (item.quantity * bundle.max_quantity > item.max_quantity) {
      warnings.push(`"${label}" için en fazla ${Math.floor(item.max_quantity / item.quantity)} paket sipariş edilebilir (servis limiti ${item.max_quantity}).`);
    }
  }
  return {
    ...bundle,
    price: fromKurus(bundle.rate_per_1000_kurus || toKurus(bundle.rate_per_1000)),
    price_usd: Number(bundle.rate_per_1000_usd_cents || 0) / 100,
    standalone_value: fromKurus(standaloneKurus),
    items: items.map(item => ({
      id: item.id,
      service_id: item.component_service_id,
      quantity: item.quantity,
      name: item.name_tr || item.name,
      name_en: item.name_en || item.name,
      category_name: item.category_name,
      provider_name: item.provider_name,
      status: item.status,
      provider_ok: Boolean(item.provider_id) && Number(item.provider_status) === 1,
      min_quantity: item.min_quantity,
      max_quantity: item.max_quantity,
      rate_per_1000: item.rate_per_1000,
      pricing_model: item.pricing_model,
      refill: item.refill,
      value: fromKurus(bundles.componentValueKurus(item, 1))
    })),
    warnings
  };
}

router.get('/', async (req, res) => {
  try {
    const rows = await dbAsync.all(
      `SELECT s.*, c.name AS category_name, c.name_en AS category_name_en,
              (SELECT COUNT(DISTINCT o.bundle_group) FROM orders o WHERE o.bundle_service_id = s.id) AS order_count,
              (SELECT MAX(o.created_at) FROM orders o WHERE o.bundle_service_id = s.id) AS last_order_at
         FROM services s LEFT JOIN categories c ON c.id = s.category_id
        WHERE s.is_bundle = 1 ORDER BY s.id DESC`
    );
    const list = [];
    for (const row of rows) list.push(await decorate(row));
    res.json({ bundles: list });
  } catch (err) {
    res.status(500).json({ error: 'Paketler alınamadı.' });
  }
});

router.get('/:id', requireIdParam, async (req, res) => {
  try {
    const row = await dbAsync.get(
      `SELECT s.*, c.name AS category_name, c.name_en AS category_name_en
         FROM services s LEFT JOIN categories c ON c.id = s.category_id WHERE s.id = ? AND s.is_bundle = 1`,
      [req.recordId]
    );
    if (!row) return res.status(404).json({ error: 'Paket bulunamadı.' });
    res.json({ bundle: await decorate(row) });
  } catch (err) {
    res.status(500).json({ error: 'Paket alınamadı.' });
  }
});

function packageLimits(body, current = null) {
  const min = Math.max(1, Number.parseInt(body.min_packages ?? current?.min_quantity ?? 1, 10) || 1);
  const max = Math.max(min, Number.parseInt(body.max_packages ?? current?.max_quantity ?? 10, 10) || min);
  return { min, max };
}

router.post('/', validate(bundleSchema), async (req, res) => {
  try {
    const body = req.body;
    const result = await withTransaction(async tx => {
      const items = await bundles.validateComponents(tx, body.items);
      const categoryId = await categoryIdFor(tx, body.category_name, body.category_name_en);
      const nameTr = normalizePlainText(body.name_tr, 220);
      const nameEn = normalizePlainText(body.name_en || body.name_tr, 220);
      const { min, max } = packageLimits(body);
      // Garanti: admin secmediyse bilesenlerin hepsi garantiliyse paket de garantilidir.
      const explicitRefill = parseRefillFlag(body.refill);
      const componentRows = await tx.all(
        `SELECT refill FROM services WHERE id IN (${items.map(() => '?').join(',')})`, items.map(item => item.component_service_id)
      );
      const refill = explicitRefill !== null ? explicitRefill : (componentRows.every(row => Number(row.refill) === 1) ? 1 : 0);
      const created = await tx.run(
        `INSERT INTO services (category_id, provider_id, provider_service_id, name, name_tr, name_en,
           rate_per_1000, rate_per_1000_kurus, rate_per_1000_usd_cents, min_quantity, max_quantity,
           description, description_tr, description_en, status, refill, is_bundle,
           start_time_tr, start_time_en, speed_tr, speed_en, features_tr, features_en,
           order_input_type, pricing_model, provider_quantity_multiplier, provider_overage_percent,
           warranty_hours, refund_policy_tr, refund_policy_en, terms_required)
         VALUES (?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, 'link', 'per_item', 1, 0, ?, ?, ?, ?)`,
        [
          categoryId, nameTr, nameTr, nameEn,
          Number(body.price), toKurus(body.price), Math.round(Number(body.price_usd || 0) * 100), min, max,
          normalizePlainText(body.description_tr || '', 1000),
          normalizePlainText(body.description_tr || '', 1000),
          normalizePlainText(body.description_en || body.description_tr || '', 1000),
          body.status === undefined ? 1 : Number(body.status), refill,
          normalizePlainText(body.start_time_tr || '', 200), normalizePlainText(body.start_time_en || '', 200),
          normalizePlainText(body.speed_tr || '', 200), normalizePlainText(body.speed_en || '', 200),
          featureList(body.features_tr), featureList(body.features_en),
          Math.max(0, Number.parseInt(body.warranty_hours || 0, 10) || 0),
          normalizePlainText(body.refund_policy_tr || '', 3000), normalizePlainText(body.refund_policy_en || '', 3000),
          truthy(body.terms_required)
        ]
      );
      for (const item of items) {
        await tx.run(
          'INSERT INTO service_bundle_items (bundle_service_id, component_service_id, quantity, sort_order) VALUES (?, ?, ?, ?)',
          [created.id, item.component_service_id, item.quantity, item.sort_order]
        );
      }
      return created.id;
    });
    try { req.app.get('invalidateServicesSsrCache')?.(); } catch { /* onbellek sart degil */ }
    res.status(201).json({ message: 'Paket oluşturuldu.', bundle_id: result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Paket oluşturulamadı.' });
  }
});

router.put('/:id', requireIdParam, validate(bundleSchema), async (req, res) => {
  try {
    const body = req.body;
    await withTransaction(async tx => {
      const current = await tx.get('SELECT * FROM services WHERE id = ? AND is_bundle = 1', [req.recordId]);
      if (!current) { const err = new Error('Paket bulunamadı.'); err.status = 404; throw err; }
      const items = await bundles.validateComponents(tx, body.items);
      const categoryId = await categoryIdFor(tx, body.category_name, body.category_name_en);
      const nameTr = normalizePlainText(body.name_tr, 220);
      const nameEn = normalizePlainText(body.name_en || body.name_tr, 220);
      const { min, max } = packageLimits(body, current);
      const explicitRefill = parseRefillFlag(body.refill);
      await tx.run(
        `UPDATE services SET category_id = ?, name = ?, name_tr = ?, name_en = ?,
           rate_per_1000 = ?, rate_per_1000_kurus = ?, rate_per_1000_usd_cents = ?, min_quantity = ?, max_quantity = ?,
           description = ?, description_tr = ?, description_en = ?, status = ?, refill = ?,
           start_time_tr = ?, start_time_en = ?, speed_tr = ?, speed_en = ?, features_tr = ?, features_en = ?,
           warranty_hours = ?, refund_policy_tr = ?, refund_policy_en = ?, terms_required = ?
         WHERE id = ?`,
        [
          categoryId, nameTr, nameTr, nameEn,
          Number(body.price), toKurus(body.price), Math.round(Number(body.price_usd ?? (current.rate_per_1000_usd_cents / 100)) * 100), min, max,
          normalizePlainText(body.description_tr ?? current.description_tr ?? '', 1000),
          normalizePlainText(body.description_tr ?? current.description_tr ?? '', 1000),
          normalizePlainText(body.description_en ?? current.description_en ?? '', 1000),
          body.status === undefined ? current.status : Number(body.status),
          explicitRefill !== null ? explicitRefill : current.refill,
          normalizePlainText(body.start_time_tr ?? current.start_time_tr ?? '', 200),
          normalizePlainText(body.start_time_en ?? current.start_time_en ?? '', 200),
          normalizePlainText(body.speed_tr ?? current.speed_tr ?? '', 200),
          normalizePlainText(body.speed_en ?? current.speed_en ?? '', 200),
          featureList(body.features_tr, current.features_tr ?? ''), featureList(body.features_en, current.features_en ?? ''),
          Math.max(0, Number.parseInt(body.warranty_hours ?? current.warranty_hours ?? 0, 10) || 0),
          normalizePlainText(body.refund_policy_tr ?? current.refund_policy_tr ?? '', 3000),
          normalizePlainText(body.refund_policy_en ?? current.refund_policy_en ?? '', 3000),
          body.terms_required === undefined ? Number(current.terms_required || 0) : truthy(body.terms_required),
          req.recordId
        ]
      );
      await tx.run('DELETE FROM service_bundle_items WHERE bundle_service_id = ?', [req.recordId]);
      for (const item of items) {
        await tx.run(
          'INSERT INTO service_bundle_items (bundle_service_id, component_service_id, quantity, sort_order) VALUES (?, ?, ?, ?)',
          [req.recordId, item.component_service_id, item.quantity, item.sort_order]
        );
      }
      await tx.run('DELETE FROM categories WHERE NOT EXISTS (SELECT 1 FROM services WHERE services.category_id = categories.id)');
    });
    try { req.app.get('invalidateServicesSsrCache')?.(); } catch { /* onbellek sart degil */ }
    res.json({ message: 'Paket güncellendi.' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Paket güncellenemedi.' });
  }
});

router.put('/:id/status', requireIdParam, validate(statusSchema), async (req, res) => {
  try {
    const result = await dbAsync.run('UPDATE services SET status = ? WHERE id = ? AND is_bundle = 1', [req.body.status, req.recordId]);
    if (result.changes !== 1) return res.status(404).json({ error: 'Paket bulunamadı.' });
    try { req.app.get('invalidateServicesSsrCache')?.(); } catch { /* onbellek sart degil */ }
    res.json({ message: req.body.status ? 'Paket yayına alındı.' : 'Paket pasife alındı.' });
  } catch (err) {
    res.status(500).json({ error: 'Paket durumu güncellenemedi.' });
  }
});

router.delete('/:id', requireIdParam, async (req, res) => {
  try {
    const bundle = await dbAsync.get('SELECT id FROM services WHERE id = ? AND is_bundle = 1', [req.recordId]);
    if (!bundle) return res.status(404).json({ error: 'Paket bulunamadı.' });
    // Siparis gecmisi olan paket silinmez, pasife alinir (gecmis raporlari korunur).
    const used = await dbAsync.get(
      `SELECT 1 found FROM orders WHERE bundle_service_id = ? OR service_id = ?
       UNION ALL SELECT 1 FROM campaigns WHERE service_id = ? LIMIT 1`, [req.recordId, req.recordId, req.recordId]
    );
    await withTransaction(async tx => {
      if (used) {
        await tx.run('UPDATE services SET status = 0 WHERE id = ?', [req.recordId]);
      } else {
        await tx.run('DELETE FROM service_bundle_items WHERE bundle_service_id = ?', [req.recordId]);
        await tx.run('DELETE FROM services WHERE id = ?', [req.recordId]);
        await tx.run('DELETE FROM categories WHERE NOT EXISTS (SELECT 1 FROM services WHERE services.category_id = categories.id)');
      }
    });
    try { req.app.get('invalidateServicesSsrCache')?.(); } catch { /* onbellek sart degil */ }
    res.json({ message: used ? 'Sipariş geçmişi korundu; paket pasife alındı.' : 'Paket silindi.' });
  } catch (err) {
    res.status(500).json({ error: 'Paket silinemedi.' });
  }
});

module.exports = router;
