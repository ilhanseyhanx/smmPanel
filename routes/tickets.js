const express = require('express');
const router = express.Router();
const { dbAsync } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { normalizePlainText } = require('../utils/security');
const telegram = require('../services/telegramNotifier');

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

    // Yalnizca bosluktan olusan metin de bos sayilir; aksi halde sohbette
    // icerigi olmayan balon olusuyordu.
    if (!String(subject || '').trim() || !String(message || '').trim()) {
      return res.status(400).json({
        error: 'Lütfen konu ve mesaj alanlarını doldurun.',
        error_en: 'Please fill in both the subject and the message.'
      });
    }

    const tResult = await dbAsync.run(
      `INSERT INTO tickets (user_id, subject, status) VALUES (?, ?, 'open')`,
      [userId, normalizePlainText(subject, 160)]
    );

    await dbAsync.run(
      `INSERT INTO ticket_messages (ticket_id, user_id, sender_role, message) VALUES (?, ?, 'client', ?)`,
      [tResult.id, userId, normalizePlainText(message, 5000)]
    );

    // Yeni destek talebi Telegram'dan haber verilir (beklenmez, hata yutulur).
    telegram.notifyTicketEvent('🎫 Yeni Destek Talebi', [
      `👤 Kullanıcı: ${req.user.username}`,
      `📌 Konu: ${normalizePlainText(subject, 160)}`,
      `💬 ${normalizePlainText(message, 200)}${String(message).length > 200 ? '…' : ''}`,
      '👉 Admin Panel → Destek bölümünden yanıtlayabilirsin.'
    ]);

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

    if (!String(message || '').trim()) {
      return res.status(400).json({
        error: 'Lütfen mesajınızı girin.',
        error_en: 'Please enter your message.'
      });
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

    // Musteri mevcut talebe yanit yazarsa da haber gelir (admin yanitlari haric).
    if (senderRole === 'client') {
      telegram.notifyTicketEvent('💬 Destek Talebine Yeni Yanıt', [
        `👤 Kullanıcı: ${req.user.username}`,
        `🎫 Talep: #${ticketId} — ${normalizePlainText(ticket.subject, 120)}`,
        `💬 ${normalizePlainText(message, 200)}${String(message).length > 200 ? '…' : ''}`
      ]);
    }

    res.json({ message: 'Cevabınız gönderildi.' });
  } catch (err) {
    res.status(500).json({ error: 'Mesaj gönderilemedi.' });
  }
});

module.exports = router;
