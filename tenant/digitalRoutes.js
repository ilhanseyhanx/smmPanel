'use strict';

// Bayi vitrini: dijital urunler (/api/digital). Satin alma Jet'in dijital
// akisini kullanir (services/digitalStore.purchase, tenant dali): musterinin
// bakiyesinden bayi fiyati, bayinin Jet bakiyesinden alis fiyati ayni islemde
// duser; teslim edilen bilgiler yalnizca bu musteriye gosterilir.
const express = require('express');
const { z } = require('zod');
const { dbAsync } = require('../config/database');
const { validate, bilingual } = require('../middleware/validate');
const { fromKurus } = require('../utils/money');
const digitalStore = require('../services/digitalStore');
const { digitalSettings, tenantDigitalCatalog, tenantDigitalItem, publicProduct } = require('../services/tenantDigital');
const { logTenantActivity } = require('../services/resellers');
const securityMonitor = require('../services/securityMonitor');
const { requireCustomer } = require('./session');
const { requireActiveTenant } = require('./routes');

const router = express.Router();

const buySchema = z.object({
  product_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive().max(100000),
  consent: z.literal(true, { error: bilingual('Satın alma koşullarını onaylaman gerekiyor.', 'You need to accept the purchase terms.') })
});

router.get('/products', async (req, res, next) => {
  try {
    const ds = digitalSettings(req.tenant);
    const catalog = ds.enabled ? await tenantDigitalCatalog(req.tenant) : [];
    res.json({ enabled: ds.enabled, products: catalog.map(publicProduct) });
  } catch (err) { next(err); }
});

router.post('/orders', requireActiveTenant, requireCustomer, validate(buySchema), async (req, res, next) => {
  try {
    if (!digitalSettings(req.tenant).enabled) return res.status(404).json({ error: 'Dijital ürünler bu sitede satışta değil.' });
    const item = await tenantDigitalItem(req.tenant, req.body.product_id);
    if (!item) return res.status(404).json({ error: 'Ürün bulunamadı veya satışta değil.', error_en: 'Product not found or not for sale.' });
    const owner = await dbAsync.get('SELECT id, username, banned FROM users WHERE id = ?', [req.tenant.owner_user_id]);
    if (!owner || owner.banned) return res.status(503).json({ error: 'Bu site şu anda sipariş kabul etmiyor.', error_en: 'This site is not accepting orders right now.' });
    try {
      const result = await digitalStore.purchase({
        user: owner,
        productId: item.product.id,
        quantity: req.body.quantity,
        tenant: {
          id: req.tenant.id, tenantName: req.tenant.name,
          customerId: req.customer.id, customerName: req.customer.username,
          unitCostKurus: item.price.costKurus, unitSellKurus: item.price.sellKurus
        }
      });
      await logTenantActivity(dbAsync, {
        tenantId: req.tenant.id, actorType: 'customer', actorId: req.customer.id, action: 'digital_order',
        details: { order_id: result.order.id, product: item.product.name, quantity: req.body.quantity, charge: result.order.charge },
        ip: securityMonitor.clientIp(req)
      });
      res.status(201).json(result);
    } catch (err) {
      if (err.code === 'TENANT_OWNER_BALANCE') {
        await logTenantActivity(dbAsync, {
          tenantId: req.tenant.id, actorType: 'system', action: 'owner_balance_low',
          details: { product: item.product.name, required: fromKurus(item.price.costKurus * req.body.quantity) }
        }).catch(() => {});
      }
      throw err;
    }
  } catch (err) { next(err); }
});

router.get('/orders', requireCustomer, async (req, res, next) => {
  try {
    const rows = await dbAsync.all(
      'SELECT * FROM digital_orders WHERE tenant_id = ? AND tenant_customer_id = ? ORDER BY id DESC LIMIT 50',
      [req.tenant.id, req.customer.id]
    );
    res.json({ orders: rows.map(digitalStore.tenantPublicOrder) });
  } catch (err) { next(err); }
});

router.get('/orders/:id', requireCustomer, async (req, res, next) => {
  try {
    const order = await dbAsync.get(
      'SELECT * FROM digital_orders WHERE id = ? AND tenant_id = ? AND tenant_customer_id = ?',
      [Number(req.params.id) || 0, req.tenant.id, req.customer.id]
    );
    if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı.', error_en: 'Order not found.' });
    const showItems = ['completed', 'refunded'].includes(order.status);
    res.json({ order: digitalStore.tenantPublicOrder(order), items: showItems ? digitalStore.decryptItems(order) : [], usage: order.usage_note || '' });
  } catch (err) { next(err); }
});

module.exports = router;
