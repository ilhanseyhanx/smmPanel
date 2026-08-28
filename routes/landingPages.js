'use strict';

// Satis sayfalari — herkese acik API. Admin uclari routes/admin.js icinde.
const express = require('express');
const router = express.Router();
const { dbAsync } = require('../config/database');
const { fetchPage, listPublished, renderLandingPageHtml } = require('../utils/landingPages');

// Yayindaki sayfalarin listesi (menu / vitrin).
router.get('/', async (req, res) => {
  try {
    const lang = req.query.lang === 'en' ? 'en' : 'tr';
    res.json({ pages: await listPublished(dbAsync, lang) });
  } catch {
    res.status(500).json({ error: 'Sayfalar alınamadı.' });
  }
});

// Tek sayfa: veri + sunucuda uretilmis isaretleme (SPA icinde de ayni gorunum).
router.get('/:slug', async (req, res) => {
  try {
    const lang = req.query.lang === 'en' ? 'en' : 'tr';
    const data = await fetchPage(dbAsync, req.params.slug, { lang });
    if (!data) return res.status(404).json({ error: 'Sayfa bulunamadı.', error_en: 'Page not found.' });
    res.json({ ...data, html: renderLandingPageHtml({ ...data, lang }) });
  } catch {
    res.status(500).json({ error: 'Sayfa alınamadı.' });
  }
});

module.exports = router;
