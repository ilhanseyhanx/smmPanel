'use strict';

// Ziyaretci ayak izi — istemci paketleri (public/js/track.js). Kayit mantigi,
// bot/yonetici ayiklamasi ve gizlilik kurallari services/footprint.js'te.
const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const footprint = require('../services/footprint');

const router = express.Router();

// Oturum kimligi basina sinir: tek sekme dakikada en fazla ~20 paket yollar.
// Kimlik yoksa IP'ye duser. Sinira takilan paket sessizce atilir (204).
const trackLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: req => {
    const sid = String(req.body?.sid || '');
    return /^[a-z0-9-]{16,40}$/i.test(sid) ? `sid:${sid}` : ipKeyGenerator(req.ip || '');
  },
  handler: (req, res) => res.status(204).end()
});

router.post('/', trackLimiter, async (req, res) => {
  try {
    await footprint.record(req, req.body || {});
  } catch { /* izleme hicbir zaman hata dondurmez */ }
  res.status(204).end();
});

module.exports = router;
