const express = require('express');
const { z } = require('zod');
const { dbAsync } = require('../config/database');
const { validate } = require('../middleware/validate');

const router = express.Router();

// Popup istatistigi: goruntulenme ve tiklama sayaci (halka acik, oturum gerektirmez).
// Yalnizca aktif ve popup'i acik kampanyalarda sayar; kapali kampanyaya event basilamaz.
router.post('/:id/event', validate(z.object({ type: z.enum(['view', 'click']) })), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'Geçersiz kampanya.' });
    const column = req.body.type === 'click' ? 'clicks' : 'views';
    await dbAsync.run(
      `UPDATE campaigns SET ${column} = ${column} + 1
       WHERE id = ? AND popup_enabled = 1 AND status = 1`,
      [id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Kaydedilemedi.' });
  }
});

module.exports = router;
