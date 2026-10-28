'use strict';

// Bayi musterisinin SMM siparisi: vitrin (tenant/routes.js) ve musteri
// API'si (tenant/apiRoutes.js) ayni yoldan gecer. Musteriden bayi fiyati,
// bayinin Jet bakiyesinden alis fiyati ayni islemde duser (placeOrder).
const { dbAsync } = require('../config/database');
const { fromKurus } = require('../utils/money');
const { placeOrder } = require('../services/placeOrder');
const { tenantPriceForService, logTenantActivity } = require('../services/resellers');
const tenantMail = require('../services/tenantMail');

function httpError(status, message, messageEn) {
  return Object.assign(new Error(message), { status, expose: true, messageEn });
}

async function placeTenantOrder(tenant, customer, order) {
  const price = await tenantPriceForService(tenant, order.serviceId);
  if (!price?.available) throw httpError(400, 'Bu servis şu anda satışta değil.', 'This service is currently unavailable.');
  const owner = await dbAsync.get('SELECT id, username, role, banned, balance_kurus FROM users WHERE id = ?', [tenant.owner_user_id]);
  if (!owner || owner.banned) throw httpError(503, 'Bu site şu anda sipariş kabul etmiyor.', 'This site is not accepting orders right now.');
  try {
    return await placeOrder({
      user: owner,
      serviceId: order.serviceId,
      link: order.link,
      quantity: order.quantity,
      comments: order.comments || '',
      dripRuns: order.dripRuns || 1,
      dripIntervalMinutes: order.dripIntervalMinutes ?? null,
      termsAccepted: order.termsAccepted,
      lang: order.lang || 'tr',
      tenant: { id: tenant.id, customerId: customer.id, sellRateKurus: price.rateKurus, discountPercent: price.discountPercent }
    });
  } catch (err) {
    // Bayinin Jet bakiyesi bitti: musteri genel mesaj gorur; bayi islem
    // kaydinda ve e-postayla (12 saatte bir) haber alir.
    if (err.code === 'TENANT_OWNER_BALANCE') {
      await logTenantActivity(dbAsync, {
        tenantId: tenant.id, actorType: 'system', action: 'owner_balance_low',
        details: { service_id: order.serviceId, required: fromKurus(err.requiredKurus), owner_balance: fromKurus(owner.balance_kurus) }
      }).catch(() => {});
      tenantMail.fireAndForget(tenantMail.ownerBalanceLow(tenant, err.requiredKurus));
    }
    throw err;
  }
}

module.exports = { placeTenantOrder };
