const axios = require('axios');
const { dbAsync } = require('../config/database');
const { safeRequestConfig } = require('../utils/network');

// Bildirimler admin panelinden yonetilir; .env degerleri yalnizca panelde
// bir sey kayitli degilse devreye giren yedektir.
const SETTING_KEYS = [
  'telegram_bot_token',
  'telegram_chat_id',
  'telegram_notify_register',
  'telegram_notify_order',
  'telegram_notify_payment',
  'telegram_notify_ticket'
];

// Token dogrudan istek yoluna girdigi icin bicimi zorunlu tutulur; boylece
// yanlis yapistirilan bir deger baska bir Telegram ucuna istek atamaz.
const TOKEN_PATTERN = /^\d{5,20}:[A-Za-z0-9_-]{20,250}$/;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatTimestamp() {
  return new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
}

async function loadConfig() {
  const placeholders = SETTING_KEYS.map(() => '?').join(',');
  const rows = await dbAsync.all(
    `SELECT key, value FROM site_settings WHERE key IN (${placeholders})`,
    SETTING_KEYS
  );
  const stored = {};
  rows.forEach(row => { stored[row.key] = row.value; });

  return {
    token: String(stored.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN || '').trim(),
    chatId: String(stored.telegram_chat_id || process.env.TELEGRAM_CHAT_ID || '').trim(),
    // Anahtar hic kaydedilmemisse bildirim acik kabul edilir.
    notifyRegister: stored.telegram_notify_register !== '0',
    notifyOrder: stored.telegram_notify_order !== '0',
    notifyPayment: stored.telegram_notify_payment !== '0',
    notifyTicket: stored.telegram_notify_ticket !== '0'
  };
}

// Telegram'in kisa Ingilizce hatalari yoneticiye tek basina bir sey anlatmiyor;
// en sik iki durum icin ne yapilmasi gerektigi yazilir.
function describeApiError(data, httpStatus) {
  const description = String(data?.description || '').trim();
  if (/unauthorized/i.test(description)) {
    return 'Bot token geçersiz (Telegram: Unauthorized). BotFather\'daki token\'ı yeniden kopyalayın.';
  }
  if (/chat not found/i.test(description)) {
    return 'Sohbet bulunamadı. Telegram\'dan botunuza bir mesaj (örn. /start) yazın, gruplarda botu gruba ekleyin; sonra Chat ID\'yi yeniden alın.';
  }
  return description || `Telegram API ${httpStatus} yanıtı döndürdü.`;
}

async function callBotApi(token, method, payload) {
  if (!TOKEN_PATTERN.test(token)) {
    throw new Error('Telegram bot token biçimi geçersiz. BotFather\'ın verdiği "123456789:AA..." değerini yapıştırın.');
  }
  const response = await axios.post(
    `https://api.telegram.org/bot${token}/${method}`,
    payload,
    safeRequestConfig({
      timeout: 12000,
      maxContentLength: 512 * 1024,
      // 4xx yanitlarda Telegram'in acikladigi hata metnini gorebilmek icin
      // axios'un kendi hatasini firlatmasi engellenir.
      validateStatus: () => true
    })
  );
  const data = response.data;
  if (!data || data.ok !== true) {
    throw new Error(describeApiError(data, response.status));
  }
  return data.result;
}

/**
 * Yapilandirma eksikse sessizce atlanir; hicbir bildirim hatasi kayit veya
 * siparis akisini bozmamalidir, bu yuzden hatalar burada yutulup loglanir.
 */
async function send(text) {
  try {
    const config = await loadConfig();
    if (!config.token || !config.chatId) return false;
    await callBotApi(config.token, 'sendMessage', {
      chat_id: config.chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
    return true;
  } catch (err) {
    console.error('Telegram bildirimi gönderilemedi:', err.message);
    return false;
  }
}

async function notifyNewUser(user, { referral } = {}) {
  try {
    const config = await loadConfig();
    if (!config.notifyRegister) return false;
  } catch { return false; }

  const lines = [
    '🆕 <b>Yeni Kullanıcı Kaydı</b>',
    '',
    `👤 Kullanıcı adı: <b>${escapeHtml(user.username)}</b>`,
    `✉️ E-posta: ${escapeHtml(user.email)}`,
    `🆔 Kullanıcı ID: ${escapeHtml(user.id)}`
  ];
  if (referral) lines.push(`🤝 Referans: ${escapeHtml(referral)}`);
  lines.push(`🕒 ${escapeHtml(formatTimestamp())}`);

  return send(lines.join('\n'));
}

async function notifyNewOrder({ orderId, username, serviceName, quantity, charge, link, status, providerOrderId }) {
  try {
    const config = await loadConfig();
    if (!config.notifyOrder) return false;
  } catch { return false; }

  const lines = [
    '🛒 <b>Yeni Sipariş Oluşturuldu</b>',
    '',
    `🧾 Sipariş No: <b>#${escapeHtml(orderId)}</b>`,
    `👤 Kullanıcı: ${escapeHtml(username)}`,
    `📦 Servis: ${escapeHtml(serviceName)}`,
    `🔢 Miktar: ${escapeHtml(Number(quantity).toLocaleString('tr-TR'))}`,
    `💰 Tutar: ₺${escapeHtml(Number(charge).toFixed(2))}`,
    `🔗 Hedef: ${escapeHtml(link)}`,
    `📊 Durum: ${escapeHtml(status)}`
  ];
  if (providerOrderId) lines.push(`🏷️ Sağlayıcı No: ${escapeHtml(providerOrderId)}`);
  lines.push(`🕒 ${escapeHtml(formatTimestamp())}`);

  return send(lines.join('\n'));
}

/**
 * Siparisin olusturulmasi ile bitmesi arasindaki sureyi okunabilir yazar.
 * Ornek: "3 dk 12 sn", "2 sa 5 dk", "1 gun 4 sa".
 */
function formatDuration(fromDate, toDate) {
  // new Date(null) 1970'e esittir; bos deger gecerli tarih sayilirsa bildirimde
  // "20680 gun" gibi sacma bir sure yazilir. Bu yuzden once bos kontrolu yapilir.
  if (fromDate === null || fromDate === undefined || fromDate === '') return null;
  const start = new Date(fromDate).getTime();
  const end = new Date(toDate || Date.now()).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;

  const totalSeconds = Math.round((end - start) / 1000);
  if (totalSeconds < 60) return `${totalSeconds} sn`;

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days} gün${hours > 0 ? ` ${hours} sa` : ''}`;
  if (hours > 0) return `${hours} sa${minutes > 0 ? ` ${minutes} dk` : ''}`;
  return `${minutes} dk${seconds > 0 ? ` ${seconds} sn` : ''}`;
}

/**
 * Siparis tamamlandiginda / kismi kaldiginda / iptal oldugunda admin kanalina
 * ozet gecer. Yeni siparis bildirimiyle ayni ayara (notifyOrder) baglidir.
 */
async function notifyOrderFinished({ orderId, username, serviceName, quantity, charge, link,
  status, providerOrderId, createdAt, remains, refundAmount }) {
  try {
    const config = await loadConfig();
    if (!config.notifyOrder) return false;
  } catch { return false; }

  const baslik = status === 'completed' ? '✅ <b>Sipariş Tamamlandı</b>'
    : status === 'partial' ? '⚠️ <b>Sipariş Kısmen Tamamlandı</b>'
      : '❌ <b>Sipariş İptal Edildi</b>';

  const lines = [
    baslik,
    '',
    `🧾 Sipariş No: <b>#${escapeHtml(orderId)}</b>`,
    `👤 Kullanıcı: ${escapeHtml(username || '-')}`,
    `📦 Servis: ${escapeHtml(serviceName || 'Servis')}`,
    `🔢 Miktar: ${escapeHtml(Number(quantity || 0).toLocaleString('tr-TR'))}`
  ];

  if (Number(remains) > 0) {
    const teslim = Math.max(0, Number(quantity || 0) - Number(remains));
    lines.push(`📉 Teslim edilen: ${escapeHtml(teslim.toLocaleString('tr-TR'))} · eksik: ${escapeHtml(Number(remains).toLocaleString('tr-TR'))}`);
  }

  lines.push(`💰 Tutar: ₺${escapeHtml(Number(charge || 0).toFixed(2))}`);
  if (Number(refundAmount) > 0) lines.push(`↩️ İade edilen: ₺${escapeHtml(Number(refundAmount).toFixed(2))}`);

  const sure = createdAt ? formatDuration(createdAt) : null;
  if (sure) lines.push(`⏱️ Süre: <b>${escapeHtml(sure)}</b>`);

  if (link) lines.push(`🔗 Hedef: ${escapeHtml(link)}`);
  if (providerOrderId) lines.push(`🏷️ Sağlayıcı No: ${escapeHtml(providerOrderId)}`);
  lines.push(`🕒 ${escapeHtml(formatTimestamp())}`);

  return send(lines.join('\n'));
}

/**
 * Admin panelindeki test butonu. send()'in aksine hatayi yutmaz; yoneticinin
 * "chat not found" gibi Telegram mesajlarini gorebilmesi gerekir.
 */
async function sendTestMessage() {
  const config = await loadConfig();
  if (!config.token) throw new Error('Önce bot token alanını doldurup kaydedin.');
  if (!config.chatId) throw new Error('Önce sohbet (chat) ID alanını doldurup kaydedin.');
  await callBotApi(config.token, 'sendMessage', {
    chat_id: config.chatId,
    text: `✅ <b>SMMJET test mesajı</b>\nBildirim ayarların çalışıyor.\n🕒 ${escapeHtml(formatTimestamp())}`,
    parse_mode: 'HTML',
    disable_web_page_preview: true
  });
  return true;
}

/**
 * Chat ID'yi elle bulmak zor oldugu icin, bota yazilmis son mesajlardan
 * sohbet listesi cikarilir. Bot once bir mesaj almis olmalidir.
 */
async function listRecentChats() {
  const config = await loadConfig();
  if (!config.token) throw new Error('Önce bot token alanını doldurup kaydedin.');
  const chats = new Map();

  // Kullanici eslestirme poller'i getUpdates offset'ini tukettigi icin, onun
  // biriktirdigi sohbet listesi birincil kaynaktir.
  try {
    const { dbAsync: db } = require('../config/database');
    const stored = await db.get("SELECT value FROM site_settings WHERE key = 'telegram_recent_chats'");
    for (const item of JSON.parse(stored?.value || '[]')) chats.set(item.id, item);
  } catch {}

  const updates = await callBotApi(config.token, 'getUpdates', { limit: 100, timeout: 0 });
  (Array.isArray(updates) ? updates : []).forEach(update => {
    const chat = (update.message || update.channel_post || update.my_chat_member)?.chat;
    if (!chat) return;
    chats.set(String(chat.id), {
      id: String(chat.id),
      title: chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || 'Sohbet',
      type: chat.type
    });
  });
  return [...chats.values()];
}

// ---------------------------------------------------------------------------
// KULLANICI TARAFI BİLDİRİMLERİ
// Musteri "Siparişlerim" sayfasindan bota baglanir (deep link + /start KOD);
// baglanti kurulunca siparis durumu degisimlerinde asagidaki sablonlar gider.
// ---------------------------------------------------------------------------

// Bot kullanici adi deep link icin gerekir; token degismedikce onbellekten okunur.
let cachedBotUsername = null;
let cachedBotTokenPrefix = null;

async function getBotUsername() {
  const config = await loadConfig();
  if (!config.token) throw new Error('Telegram botu yapılandırılmamış.');
  const prefix = config.token.slice(0, 16);
  if (cachedBotUsername && cachedBotTokenPrefix === prefix) return cachedBotUsername;
  const me = await callBotApi(config.token, 'getMe', {});
  cachedBotUsername = me.username;
  cachedBotTokenPrefix = prefix;
  return cachedBotUsername;
}

// Belirli bir chat'e ham mesaj (kullanici bildirimleri icin).
async function sendToChat(chatId, text) {
  try {
    const config = await loadConfig();
    if (!config.token || !chatId) return false;
    await callBotApi(config.token, 'sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
    return true;
  } catch (err) {
    console.error('Telegram kullanıcı bildirimi gönderilemedi:', err.message);
    return false;
  }
}

// Siparis durumu sablonlari. Kullanicinin dili panelde tutulmadigi icin TR.
function orderStatusMessage(event, order) {
  const head = `#${order.id} • ${order.service_name} • ${Number(order.quantity).toLocaleString('tr-TR')} adet`;
  if (event === 'processing') {
    return `📦 <b>Siparişin alındı!</b>\n${escapeHtml(head)}\nSağlayıcıya iletildi, teslimat başlıyor.`;
  }
  if (event === 'completed') {
    return `✅ <b>Siparişin tamamlandı!</b>\n${escapeHtml(head)}\nTamamı teslim edildi. Bizi tercih ettiğin için teşekkürler! 🎉`;
  }
  if (event === 'partial') {
    const delivered = Math.max(0, Number(order.quantity) - Number(order.remains || 0));
    return `◐ <b>Sipariş kısmen tamamlandı</b>\n${escapeHtml(head)}\n${delivered.toLocaleString('tr-TR')} adet gönderildi, kalan ${Number(order.remains || 0).toLocaleString('tr-TR')} adetin ücreti (₺${Number(order.refund_amount || 0).toFixed(2)}) bakiyene iade edildi.`;
  }
  if (event === 'canceled') {
    return `🚫 <b>Siparişin iptal edildi</b>\n${escapeHtml(head)}\n₺${Number(order.refund_amount || 0).toFixed(2)} bakiyene iade edildi.`;
  }
  return null;
}

// Siparis sahibine durum bildirimi; kullanici bagli degilse sessizce atlanir.
async function notifyOrderOwner(userId, event, order) {
  try {
    const { dbAsync: db } = require('../config/database');
    const user = await db.get('SELECT telegram_chat_id, telegram_notify FROM users WHERE id = ?', [userId]);
    if (!user?.telegram_chat_id || !user.telegram_notify) return false;
    const text = orderStatusMessage(event, order);
    if (!text) return false;
    return await sendToChat(user.telegram_chat_id, text);
  } catch (err) {
    console.error('Telegram sipariş bildirimi gönderilemedi:', err.message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// /start KOD eslestirme poller'i.
// getUpdates offset tuketir; admin panelindeki "Chat ID bul" bozulmasin diye
// gorulen sohbetler site_settings.telegram_recent_chats icinde saklanir ve
// listRecentChats o depodan da okur.
// ---------------------------------------------------------------------------
async function rememberChat(chat) {
  if (!chat) return;
  const { dbAsync: db } = require('../config/database');
  const row = await db.get("SELECT value FROM site_settings WHERE key = 'telegram_recent_chats'");
  let list = [];
  try { list = JSON.parse(row?.value || '[]'); } catch {}
  const entry = {
    id: String(chat.id),
    title: chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || 'Sohbet',
    type: chat.type
  };
  list = [entry, ...list.filter(item => item.id !== entry.id)].slice(0, 20);
  await db.run("INSERT INTO site_settings (key, value) VALUES ('telegram_recent_chats', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [JSON.stringify(list)]);
}

async function processLinkUpdates() {
  const config = await loadConfig();
  if (!config.token || !TOKEN_PATTERN.test(config.token)) return;
  const { dbAsync: db } = require('../config/database');
  const { tokenHash } = require('../utils/security');

  const offsetRow = await db.get("SELECT value FROM site_settings WHERE key = 'telegram_updates_offset'");
  const offset = Number(offsetRow?.value) || 0;
  const updates = await callBotApi(config.token, 'getUpdates', { offset: offset || undefined, limit: 50, timeout: 0 });
  if (!Array.isArray(updates) || !updates.length) return;

  let maxUpdateId = offset - 1;
  for (const update of updates) {
    maxUpdateId = Math.max(maxUpdateId, update.update_id);
    const message = update.message || update.channel_post;
    if (!message?.chat) continue;
    await rememberChat(message.chat);

    // "/start KOD" bicimindeki mesajlar hesap eslestirmesidir.
    const match = String(message.text || '').match(/^\/start[ =]+([A-Za-z0-9_-]{10,120})/);
    if (!match) continue;
    const token = await db.get(
      `SELECT vt.*, u.username FROM verification_tokens vt JOIN users u ON u.id = vt.user_id
       WHERE vt.purpose = 'telegram_link' AND vt.token_hash = ? AND vt.used_at IS NULL
         AND strftime('%s', vt.expires_at) > strftime('%s', 'now')`,
      [tokenHash(match[1])]
    );
    if (!token) {
      await sendToChat(message.chat.id, '⚠️ Bağlantı kodu geçersiz veya süresi dolmuş. Panelden "Telegram\'a Bağlan" düğmesine yeniden basın.');
      continue;
    }
    await db.run('UPDATE verification_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?', [token.id]);
    await db.run('UPDATE users SET telegram_chat_id = ?, telegram_username = ?, telegram_notify = 1 WHERE id = ?',
      [String(message.chat.id), message.chat.username || null, token.user_id]);
    await sendToChat(message.chat.id, `✅ <b>Hesabın bağlandı!</b>\n"${escapeHtml(token.username)}" hesabının sipariş bildirimleri artık buraya gelecek. 🎉`);
  }

  await db.run("INSERT INTO site_settings (key, value) VALUES ('telegram_updates_offset', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [String(maxUpdateId + 1)]);
}

// Genel odeme olayi bildirimi (talep olusturma, bildirim gelmesi, hata vb.).
// Baslik + serbest detay satirlari; "Ödeme bildirimleri" anahtari kapaliysa atlanir.
async function notifyPaymentEvent(title, detailLines = []) {
  try {
    const config = await loadConfig();
    if (!config.notifyPayment) return false;
  } catch { return false; }
  const lines = [`<b>${escapeHtml(title)}</b>`, '', ...detailLines.map(line => escapeHtml(line))];
  lines.push(`🕒 ${escapeHtml(formatTimestamp())}`);
  return send(lines.join('\n'));
}

// Destek talebi olaylari (yeni talep / musteri yaniti). Anahtar kapaliysa atlanir.
async function notifyTicketEvent(title, detailLines = []) {
  try {
    const config = await loadConfig();
    if (!config.notifyTicket) return false;
  } catch { return false; }
  const lines = [`<b>${escapeHtml(title)}</b>`, '', ...detailLines.map(line => escapeHtml(line))];
  lines.push(`🕒 ${escapeHtml(formatTimestamp())}`);
  return send(lines.join('\n'));
}

// Admin'e bakiye yuklemesi bildirimi (PayTR / kripto / banka). Hata yutulur.
async function notifyDeposit({ username, amount, method, bonus }) {
  try {
    const config = await loadConfig();
    if (!config.notifyPayment) return false;
  } catch { return false; }
  const lines = [
    '💰 <b>Yeni Bakiye Yüklemesi</b>',
    '',
    `👤 Kullanıcı: <b>${escapeHtml(username)}</b>`,
    `💳 Yöntem: ${escapeHtml(method)}`,
    `➕ Tutar: ₺${escapeHtml(Number(amount).toFixed(2))}`
  ];
  if (bonus > 0) lines.push(`🎁 Kampanya bonusu: ₺${escapeHtml(Number(bonus).toFixed(2))}`);
  lines.push(`🕒 ${escapeHtml(formatTimestamp())}`);
  return send(lines.join('\n'));
}

module.exports = {
  notifyNewUser, notifyNewOrder, notifyOrderFinished, formatDuration, sendTestMessage, listRecentChats, loadConfig,
  getBotUsername, sendToChat, notifyOrderOwner, processLinkUpdates, notifyDeposit, notifyPaymentEvent, notifyTicketEvent
};
