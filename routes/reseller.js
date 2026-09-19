'use strict';

// Jet kullanicisinin bayilik durumu ve basvurusu. Bayilik ucretsizdir; acilis
// sarti gercek para ile toplam yukleme (admin panelinden ayarlanir, varsayilan
// 500 TL). Sart saglaniyorsa panel hemen acilir; admin istedigi an askiya alir.
const express = require('express');
const { z } = require('zod');
const { dbAsync } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { normalizePlainText } = require('../utils/security');
const { fromKurus } = require('../utils/money');
const {
  getResellerSettings, realDepositKurus, validateSlug, logTenantActivity
} = require('../services/resellers');
const { baseDomain, invalidateTenantCache } = require('../tenant/resolve');

const router = express.Router();

// Herkese acik: Jet sitesindeki bayilik sayfasi/menusu bunu okuyarak kendini
// gosterir ya da gizler. Kapaliyken baska bilgi verilmez.
router.get('/program', async (req, res, next) => {
  try {
    const settings = await getResellerSettings();
    if (!settings.public_page_enabled) return res.json({ enabled: false });
    res.json({
      enabled: true,
      applications_open: settings.applications_open,
      min_deposit: settings.min_deposit_tl,
      discount_percent: settings.discount_percent
    });
  } catch (err) { next(err); }
});

router.use(authenticateToken);

function programClosed(res) {
  return res.status(404).json({ error: 'Bayilik programı şu anda kapalı.', error_en: 'The reseller program is currently closed.', code: 'PROGRAM_CLOSED' });
}

const applySchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z.string().trim().min(3).max(30)
});

function tenantSummary(tenant) {
  const base = baseDomain();
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
    theme: tenant.theme,
    address: base ? `${tenant.slug}.${base}` : null,
    created_at: tenant.created_at
  };
}

router.get('/me', async (req, res, next) => {
  try {
    const [settings, deposited, tenant] = await Promise.all([
      getResellerSettings(),
      realDepositKurus(req.user.id),
      dbAsync.get('SELECT * FROM tenants WHERE owner_user_id = ?', [req.user.id])
    ]);
    const requiredKurus = Math.round(settings.min_deposit_tl * 100);
    // Program kapaliyken yalnizca zaten bayisi olan kullanici durumunu gorur.
    if (!settings.public_page_enabled && !tenant) return programClosed(res);
    res.json({
      program_enabled: settings.public_page_enabled,
      applications_open: settings.applications_open,
      min_deposit: settings.min_deposit_tl,
      deposited: fromKurus(deposited),
      eligible: deposited >= requiredKurus,
      tenant: tenant ? tenantSummary(tenant) : null
    });
  } catch (err) { next(err); }
});

router.post('/apply', validate(applySchema), async (req, res, next) => {
  try {
    const settings = await getResellerSettings();
    if (!settings.public_page_enabled) return programClosed(res);
    if (!settings.applications_open) {
      return res.status(403).json({ error: 'Bayilik başvuruları şu anda kapalı.', error_en: 'Reseller applications are currently closed.' });
    }
    if (await dbAsync.get('SELECT id FROM tenants WHERE owner_user_id = ?', [req.user.id])) {
      return res.status(409).json({ error: 'Zaten bir bayi paneliniz var.', error_en: 'You already have a reseller panel.' });
    }
    const deposited = await realDepositKurus(req.user.id);
    const requiredKurus = Math.round(settings.min_deposit_tl * 100);
    if (deposited < requiredKurus) {
      return res.status(403).json({
        error: `Bayi paneli açmak için hesabınıza toplam en az ₺${settings.min_deposit_tl.toFixed(2)} bakiye yüklemiş olmanız gerekir. Şu ana kadar yüklenen: ₺${fromKurus(deposited).toFixed(2)}.`,
        error_en: `You need to have added at least ${settings.min_deposit_tl.toFixed(2)} TRY in total to open a reseller panel. Added so far: ${fromKurus(deposited).toFixed(2)} TRY.`,
        code: 'MIN_DEPOSIT'
      });
    }
    const slugCheck = validateSlug(req.body.slug);
    if (!slugCheck.ok) {
      return res.status(400).json({
        error: slugCheck.reason === 'reserved'
          ? 'Bu adres kullanılamaz, başka bir adres seçin.'
          : 'Adres 3-30 karakter olmalı; yalnızca küçük harf, rakam ve tire içerebilir.',
        error_en: slugCheck.reason === 'reserved'
          ? 'This address is reserved, choose another one.'
          : 'The address must be 3-30 characters: lowercase letters, numbers and hyphens only.',
        field: 'slug'
      });
    }
    if (await dbAsync.get('SELECT id FROM tenants WHERE slug = ?', [slugCheck.slug])) {
      return res.status(409).json({ error: 'Bu adres başka bir bayi tarafından kullanılıyor.', error_en: 'This address is already taken.', field: 'slug' });
    }
    const name = normalizePlainText(req.body.name, 60);
    if (!name) return res.status(400).json({ error: 'Site adı gerekli.', error_en: 'Site name is required.', field: 'name' });

    const created = await dbAsync.run(
      'INSERT INTO tenants (owner_user_id, slug, name, default_markup_percent) VALUES (?, ?, ?, ?)',
      [req.user.id, slugCheck.slug, name, settings.default_markup_percent]
    );
    await logTenantActivity(dbAsync, {
      tenantId: created.id, actorType: 'owner', actorId: req.user.id, action: 'tenant_created',
      details: { name, slug: slugCheck.slug, deposited: fromKurus(deposited) }, ip: req.ip
    });
    invalidateTenantCache();
    const tenant = await dbAsync.get('SELECT * FROM tenants WHERE id = ?', [created.id]);
    res.status(201).json({ message: 'Bayi paneliniz oluşturuldu.', tenant: tenantSummary(tenant) });
  } catch (err) { next(err); }
});

module.exports = router;
