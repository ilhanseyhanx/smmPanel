const nodemailer = require('nodemailer');

// SMTP bilgileri admin panelinden (site_settings) yonetilir; .env yalnizca
// panelde deger yoksa devreye giren yedektir.
const SETTING_KEYS = ['smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_pass', 'mail_from'];

async function getConfig() {
  const { dbAsync } = require('../config/database');
  const stored = {};
  try {
    const rows = await dbAsync.all(
      `SELECT key, value FROM site_settings WHERE key IN (${SETTING_KEYS.map(() => '?').join(',')})`,
      SETTING_KEYS
    );
    rows.forEach(row => { stored[row.key] = row.value; });
  } catch { /* tablo yoksa (ilk kurulum) env'e duselim */ }

  const host = String(stored.smtp_host || process.env.SMTP_HOST || '').trim();
  let pass = String(stored.smtp_pass || process.env.SMTP_PASS || '');
  // Gmail uygulama sifreleri "abcd efgh ijkl mnop" bicimiyle kopyalanir;
  // bosluklar kozmetiktir ve girisin reddedilmesine yol acar — temizlenir.
  if (host.includes('gmail')) pass = pass.replace(/\s+/g, '');
  return {
    host,
    port: Number(stored.smtp_port || process.env.SMTP_PORT || 587),
    secure: stored.smtp_secure !== undefined ? stored.smtp_secure === '1' : process.env.SMTP_SECURE === 'true',
    user: String(stored.smtp_user || process.env.SMTP_USER || '').trim(),
    pass,
    from: String(stored.mail_from || process.env.MAIL_FROM || '').trim()
  };
}

async function isConfigured() {
  const config = await getConfig();
  return Boolean(config.host && config.user && config.pass && config.from);
}

async function sendMail({ to, subject, text, html }) {
  const config = await getConfig();
  if (!config.host || !config.user || !config.pass || !config.from) {
    if (process.env.NODE_ENV === 'production') throw new Error('E-posta servisi yapılandırılmamış. Admin panelinden SMTP ayarlarını girin.');
    return false;
  }
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass }
  });
  await transporter.sendMail({ from: config.from, to, subject, text, html });
  return true;
}

module.exports = { sendMail, isConfigured, getConfig };
