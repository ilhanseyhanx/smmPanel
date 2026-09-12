'use strict';

const express = require('express');
const crypto = require('crypto');
const sanitizeHtml = require('sanitize-html');
const { z } = require('zod');
const { dbAsync } = require('../config/database');
const { encryptSecret, normalizePlainText, tokenHash } = require('../utils/security');
const { inboundEmailDomain, verifyWebhookSignature } = require('../services/orderTypes');
const { sendMail } = require('../services/mailer');

const router = express.Router();

const payloadSchema = z.object({
  recipient: z.string().trim().email().max(254),
  sender: z.string().trim().max(254).optional().default(''),
  subject: z.string().max(500).optional().default('Dijital ürün teslimatı'),
  text: z.string().max(200000).optional().default(''),
  html: z.string().max(300000).optional().default(''),
  message_id: z.string().trim().max(500).optional().default('')
});

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function cleanProviderHtml(value) {
  return sanitizeHtml(String(value || ''), {
    allowedTags: ['p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'pre', 'code', 'table', 'tbody', 'tr', 'th', 'td'],
    allowedAttributes: {},
    disallowedTagsMode: 'discard'
  }).slice(0, 200000);
}

function deliveryEmailHtml({ siteName, username, orderId, serviceName, subject, text, html }) {
  const content = html || `<pre style="white-space:pre-wrap;font-family:Segoe UI,Arial,sans-serif;">${escapeHtml(text)}</pre>`;
  const panelUrl = `${String(process.env.PUBLIC_BASE_URL || 'https://smmjet.com').replace(/\/$/, '')}/orders`;
  return `<div style="max-width:620px;margin:0 auto;font-family:Segoe UI,Arial,sans-serif;color:#1f2937;line-height:1.65;">
    <div style="padding:20px 24px;background:linear-gradient(135deg,#0b0e14,#312e81);border-radius:14px 14px 0 0;text-align:center;color:#fff;font-size:22px;font-weight:800;">${escapeHtml(siteName)}</div>
    <div style="padding:28px 24px;background:#fff;border:1px solid #e5e7eb;border-top:0;">
      <h2 style="margin:0 0 12px;color:#111827;">Dijital ürünün teslim edildi 🎉</h2>
      <p>Merhaba ${escapeHtml(username)}, <b>#${orderId}</b> numaralı <b>${escapeHtml(serviceName)}</b> siparişinin bilgileri aşağıdadır.</p>
      <div style="margin:18px 0;padding:18px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;word-break:break-word;">
        <div style="font-size:12px;color:#64748b;margin-bottom:8px;">${escapeHtml(subject)}</div>${content}
      </div>
      <p style="font-size:13px;color:#6b7280;">Bilgileri güvenli bir yerde sakla ve hizmet açıklamasındaki ilk kullanım/garanti süresini kaçırma.</p>
      <p style="text-align:center;margin:24px 0 4px;"><a href="${escapeHtml(panelUrl)}" style="display:inline-block;padding:12px 24px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:9px;font-weight:700;">Siparişlerime Git</a></p>
    </div>
  </div>`;
}

router.post('/cloudflare', async (req, res, next) => {
  try {
    if (!verifyWebhookSignature(req.rawBody, req.get('x-smmjet-signature'))) {
      return res.status(401).json({ error: 'Geçersiz webhook imzası.' });
    }
    const parsed = payloadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Geçersiz e-posta içeriği.' });

    const payload = parsed.data;
    const expectedDomain = inboundEmailDomain();
    // Token base64url ve buyuk/kucuk harfe duyarlidir; adresin tamamini
    // lower-case yapmak hash eslesmesini bozar.
    const match = payload.recipient.match(new RegExp(`^order-([a-zA-Z0-9_-]{20,100})@${expectedDomain.replace(/\./g, '\\.')}$`, 'i'));
    if (!match) return res.status(404).json({ error: 'Sipariş teslimat adresi bulunamadı.' });

    const order = await dbAsync.get(
      `SELECT o.id, o.user_id, o.status, o.delivery_email, o.delivery_status,
              u.username, s.name service_name,
              COALESCE((SELECT value FROM site_settings WHERE key = 'site_name'), 'Jet SMM Panel') site_name
         FROM orders o JOIN users u ON u.id = o.user_id JOIN services s ON s.id = o.service_id
        WHERE o.delivery_token_hash = ? AND o.order_input_type = 'email_delivery'`,
      [tokenHash(match[1])]
    );
    if (!order || ['failed', 'canceled'].includes(order.status)) {
      return res.status(404).json({ error: 'Aktif teslimat siparişi bulunamadı.' });
    }

    const cleanText = normalizePlainText(payload.text, 100000);
    const cleanHtml = cleanProviderHtml(payload.html);
    if (!cleanText && !cleanHtml) return res.status(400).json({ error: 'Teslimat e-postası boş.' });
    const messageId = normalizePlainText(payload.message_id, 500)
      || crypto.createHash('sha256').update(req.rawBody).digest('hex');
    const encrypted = encryptSecret(JSON.stringify({ text: cleanText, html: cleanHtml }));

    let delivery;
    try {
      delivery = await dbAsync.run(
        `INSERT INTO email_deliveries (order_id, message_id, sender, subject, content_encrypted)
         VALUES (?, ?, ?, ?, ?)`,
        [order.id, messageId, normalizePlainText(payload.sender, 254), normalizePlainText(payload.subject, 500), encrypted]
      );
    } catch (err) {
      if (/UNIQUE constraint failed/i.test(err.message)) return res.json({ ok: true, duplicate: true });
      throw err;
    }

    await dbAsync.run(
      "UPDATE orders SET delivery_status = 'delivered', delivery_received_at = CURRENT_TIMESTAMP WHERE id = ?",
      [order.id]
    );

    try {
      await sendMail({
        to: order.delivery_email,
        subject: `Sipariş #${order.id} teslim edildi — ${order.service_name}`,
        text: cleanText,
        html: deliveryEmailHtml({
          siteName: order.site_name,
          username: order.username,
          orderId: order.id,
          serviceName: order.service_name,
          subject: payload.subject,
          text: cleanText,
          html: cleanHtml
        })
      });
      await dbAsync.run(
        "UPDATE email_deliveries SET forward_status = 'sent', forwarded_at = CURRENT_TIMESTAMP WHERE id = ?",
        [delivery.id]
      );
    } catch (mailError) {
      await dbAsync.run(
        "UPDATE email_deliveries SET forward_status = 'failed', forward_error = ? WHERE id = ?",
        [normalizePlainText(mailError.message, 500), delivery.id]
      );
      // Icerik panelde kayitli oldugu icin Cloudflare'a basarili donulur; aksi
      // halde ayni e-posta tekrar tekrar teslim edilirdi.
    }

    res.json({ ok: true, order_id: order.id });
  } catch (err) { next(err); }
});

module.exports = router;
