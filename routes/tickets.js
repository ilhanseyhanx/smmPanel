const express = require('express');
const router = express.Router();
const { dbAsync } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { normalizePlainText } = require('../utils/security');
const telegram = require('../services/telegramNotifier');

// Talep listesinde son hareket: son mesajin zamani, kimden geldigi, kisa
// onizlemesi ve mesaj sayisi (admin listesi "kim bekliyor" sorusunu buradan
// cevaplar; kullanici listesi son mesaji kartta gosterir).
const TICKET_ACTIVITY = `
  (SELECT COUNT(*) FROM ticket_messages m WHERE m.ticket_id = t.id) message_count,
  (SELECT MAX(m.created_at) FROM ticket_messages m WHERE m.ticket_id = t.id) last_message_at,
  (SELECT m.sender_role FROM ticket_messages m WHERE m.ticket_id = t.id ORDER BY m.id DESC LIMIT 1) last_sender,
  (SELECT substr(m.message, 1, 160) FROM ticket_messages m WHERE m.ticket_id = t.id ORDER BY m.id DESC LIMIT 1) last_message`;

// GET TICKETS (User gets own, Admin gets all)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let tickets;
    if (req.user.role === 'admin') {
      tickets = await dbAsync.all(
        `SELECT t.*, u.username, u.email, ${TICKET_ACTIVITY}
           FROM tickets t JOIN users u ON t.user_id = u.id ORDER BY t.id DESC`
      );
    } else {
      tickets = await dbAsync.all(
        `SELECT t.*, ${TICKET_ACTIVITY} FROM tickets t WHERE t.user_id = ? ORDER BY t.id DESC`,
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

    require('../services/footprint').serverEvent({ req, userId, kind: 'ticket_created', label: normalizePlainText(subject, 120), path: '/tickets' });
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
    // Talebi acan kullanicinin adi da doner (admin sohbet basliginda gorur).
    const ticket = await dbAsync.get(
      `SELECT t.*, u.username, u.email FROM tickets t JOIN users u ON u.id = t.user_id
        WHERE t.id = ? AND (t.user_id = ? OR ? = 'admin')`,
      [ticketId, req.user.id, req.user.role]
    );

    if (!ticket) {
      return res.status(404).json({ error: 'Destek talebi bulunamadı.' });
    }
    if (req.user.role !== 'admin') delete ticket.email;

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

    // Kapali talebe yazilan mesaj talebi yeniden acar.
    await dbAsync.run(`UPDATE tickets SET status = ?, closed_at = NULL WHERE id = ?`, [newStatus, ticketId]);

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

// KAPAT / YENIDEN AC. Admin her talebi kapatip acabilir; kullanici yalnizca
// kendi talebini kapatabilir (yazarsa zaten yeniden acilir). Admin kapatinca
// kullaniciya bildirim gider.
router.post('/:id/status', authenticateToken, async (req, res) => {
  try {
    const status = String(req.body?.status || '');
    if (!['closed', 'open'].includes(status)) {
      return res.status(400).json({ error: 'Geçersiz durum.', error_en: 'Invalid status.' });
    }
    const isAdmin = req.user.role === 'admin';
    if (!isAdmin && status !== 'closed') {
      return res.status(403).json({ error: 'Talebi yeniden açmak için mesaj yazabilirsiniz.', error_en: 'Send a message to reopen the ticket.' });
    }
    const ticket = await dbAsync.get(
      'SELECT * FROM tickets WHERE id = ? AND (user_id = ? OR ? = 1)',
      [req.params.id, req.user.id, isAdmin ? 1 : 0]
    );
    if (!ticket) return res.status(404).json({ error: 'Destek talebi bulunamadı.', error_en: 'Ticket not found.' });

    if (status === 'closed') {
      await dbAsync.run("UPDATE tickets SET status = 'closed', closed_at = CURRENT_TIMESTAMP WHERE id = ?", [ticket.id]);
      if (isAdmin && ticket.status !== 'closed') {
        await dbAsync.run('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)', [
          ticket.user_id, 'ticket', 'Destek talebin kapatıldı',
          `#${ticket.id} numaralı "${normalizePlainText(ticket.subject, 120)}" talebin çözüldü olarak kapatıldı. Yeni bir sorunda talebe yazman yeterli; talep yeniden açılır.`
        ]).catch(() => {});
      }
    } else {
      // Yeniden acilan talep: son mesaj adminden geldiyse "yanitlandi" kalir.
      const last = await dbAsync.get('SELECT sender_role FROM ticket_messages WHERE ticket_id = ? ORDER BY id DESC LIMIT 1', [ticket.id]);
      await dbAsync.run('UPDATE tickets SET status = ?, closed_at = NULL WHERE id = ?', [last?.sender_role === 'admin' ? 'replied' : 'open', ticket.id]);
    }
    const updated = await dbAsync.get('SELECT id, status, closed_at FROM tickets WHERE id = ?', [ticket.id]);
    res.json({
      message: status === 'closed' ? 'Talep kapatıldı.' : 'Talep yeniden açıldı.',
      message_en: status === 'closed' ? 'Ticket closed.' : 'Ticket reopened.',
      ticket: updated
    });
  } catch (err) {
    res.status(500).json({ error: 'Talep durumu değiştirilemedi.', error_en: 'Ticket status could not be changed.' });
  }
});

module.exports = router;
