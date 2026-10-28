'use strict';

// Jet kullanicisinin bayilik durumu ve basvurusu (28 Eki 2026 modeli):
// basvuruda paket secilir (Standart / Pro), panel aninda slug.jetsmmpanel.com
// adresinde acilir ve ucretsiz deneme baslar (varsayilan 2 gun); devam icin
// kendi alan adi baglanir ve aylik ucret Jet bakiyesinden alinir. Ayrintilar
// services/resellerBilling.js'te.
const express = require('express');
const { z } = require('zod');
const { dbAsync } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { normalizePlainText } = require('../utils/security');
const { fromKurus } = require('../utils/money');
const {
  getResellerSettings, validateSlug, logTenantActivity, PACKAGES, packageFeeTl
} = require('../services/resellers');
const billing = require('../services/resellerBilling');
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
      monthly_fee: settings.monthly_fee_tl,
      packages: packageList(settings),
      trial_days: settings.trial_days,
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
  slug: z.string().trim().min(3).max(30),
  package: z.enum(['standart', 'pro']).optional().default('standart')
});

function packageList(settings) {
  return Object.values(PACKAGES).map(p => ({ key: p.key, name: p.name, fee: packageFeeTl(settings, p.key) }));
}

function tenantSummary(tenant, settings, ownerBalanceKurus) {
  const base = baseDomain();
  return {
    subscription: settings ? billing.subscriptionInfo(tenant, settings, ownerBalanceKurus) : undefined,
    panel_url: base ? `https://${tenant.slug}.${base}/admin` : null,
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
    theme: tenant.theme,
    address: base ? `${tenant.slug}.${base}` : null,
    package: tenant.package === 'pro' ? 'pro' : 'standart',
    created_at: tenant.created_at
  };
}

router.get('/me', async (req, res, next) => {
  try {
    const [settings, tenant] = await Promise.all([
      getResellerSettings(),
      dbAsync.get('SELECT * FROM tenants WHERE owner_user_id = ?', [req.user.id])
    ]);
    // Program kapaliyken yalnizca zaten bayisi olan kullanici durumunu gorur.
    if (!settings.public_page_enabled && !tenant) return programClosed(res);
    res.json({
      program_enabled: settings.public_page_enabled,
      applications_open: settings.applications_open,
      monthly_fee: settings.monthly_fee_tl,
      packages: packageList(settings),
      trial_days: settings.trial_days,
      discount_percent: settings.discount_percent,
      balance: fromKurus(req.user.balance_kurus || 0),
      base_domain: baseDomain() || null,
      tenant: tenant ? tenantSummary(tenant, settings, req.user.balance_kurus) : null
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

    const trial = await billing.trialFields();
    const created = await dbAsync.run(
      'INSERT INTO tenants (owner_user_id, slug, name, default_markup_percent, plan_status, trial_ends_at, package) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, slugCheck.slug, name, settings.default_markup_percent, trial.plan_status, trial.trial_ends_at, req.body.package]
    );
    await logTenantActivity(dbAsync, {
      tenantId: created.id, actorType: 'owner', actorId: req.user.id, action: 'tenant_created',
      details: { name, slug: slugCheck.slug, package: req.body.package, trial_ends_at: trial.trial_ends_at }, ip: req.ip
    });
    invalidateTenantCache();
    const tenant = await dbAsync.get('SELECT * FROM tenants WHERE id = ?', [created.id]);
    res.status(201).json({
      message: `${PACKAGES[req.body.package].name} bayi panelin açıldı. ${settings.trial_days} günlük ücretsiz deneme başladı; devam etmek için deneme bitmeden kendi alan adını bağla.`,
      tenant: tenantSummary(tenant, settings, req.user.balance_kurus)
    });
  } catch (err) { next(err); }
});

module.exports = router;
