const express = require('express');
const router = express.Router();
const { dbAsync } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { normalizePlainText } = require('../utils/security');

// GET TICKETS (User gets own, Admin gets all)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let tickets;
    if (req.user.role === 'admin') {
      tickets = await dbAsync.all(
        `SELECT t.*, u.username, u.email FROM tickets t JOIN users u ON t.user_id = u.id ORDER BY t.id DESC`
      );
    } else {
      tickets = await dbAsync.all(
        `SELECT * FROM tickets WHERE user_id = ? ORDER BY id DESC`,
        [req.user.id]
      );
    }
    res.json({ tickets });
  } catch (err) {
    res.status(500).json({ error: 'Destek talepleri alınamadı.' });
  }
});

// CREATE TICKET
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { subject, message } = req.body;
    const userId = req.user.id;

    if (!subject || !message) {
      return res.status(400).json({ error: 'Lütfen konu ve mesaj alanlarını doldurun.' });
    }

    const tResult = await dbAsync.run(
      `INSERT INTO tickets (user_id, subject, status) VALUES (?, ?, 'open')`,
      [userId, normalizePlainText(subject, 160)]
    );

    await dbAsync.run(
      `INSERT INTO ticket_messages (ticket_id, user_id, sender_role, message) VALUES (?, ?, 'client', ?)`,
      [tResult.id, userId, normalizePlainText(message, 5000)]
    );

    res.json({ message: 'Destek talebiniz başarıyla oluşturuldu.', ticket_id: tResult.id });
  } catch (err) {
    res.status(500).json({ error: 'Destek talebi oluşturulurken bir hata oluştu.' });
  }
});

// GET TICKET DETAILS & MESSAGES
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const ticketId = req.params.id;
    const ticket = await dbAsync.get(`SELECT * FROM tickets WHERE id = ? AND (user_id = ? OR ? = 'admin')`, [
      ticketId,
      req.user.id,
      req.user.role
    ]);

    if (!ticket) {
      return res.status(404).json({ error: 'Destek talebi bulunamadı.' });
    }

    const messages = await dbAsync.all(
      `SELECT tm.*, u.username FROM ticket_messages tm JOIN users u ON tm.user_id = u.id WHERE tm.ticket_id = ? ORDER BY tm.id ASC`,
      [ticketId]
    );

    res.json({ ticket, messages });
  } catch (err) {
    res.status(500).json({ error: 'Mesajlar alınamadı.' });
  }
});

// REPLY TO TICKET
router.post('/:id/reply', authenticateToken, async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Lütfen mesajınızı girin.' });
    }

    const ticket = await dbAsync.get(`SELECT * FROM tickets WHERE id = ? AND (user_id = ? OR ? = 'admin')`, [
      ticketId,
      req.user.id,
      req.user.role
    ]);

    if (!ticket) {
      return res.status(404).json({ error: 'Destek talebi bulunamadı.' });
    }

    const senderRole = req.user.role === 'admin' ? 'admin' : 'client';
    const newStatus = senderRole === 'admin' ? 'replied' : 'open';

    await dbAsync.run(
      `INSERT INTO ticket_messages (ticket_id, user_id, sender_role, message) VALUES (?, ?, ?, ?)`,
      [ticketId, req.user.id, senderRole, normalizePlainText(message, 5000)]
    );

    await dbAsync.run(`UPDATE tickets SET status = ? WHERE id = ?`, [newStatus, ticketId]);

    res.json({ message: 'Cevabınız gönderildi.' });
  } catch (err) {
    res.status(500).json({ error: 'Mesaj gönderilemedi.' });
  }
});

module.exports = router;
