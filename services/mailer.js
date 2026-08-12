const nodemailer = require('nodemailer');

function configured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_FROM);
}

async function sendMail({ to, subject, text, html }) {
  if (!configured()) {
    if (process.env.NODE_ENV === 'production') throw new Error('E-posta servisi yapılandırılmamış.');
    return false;
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  await transporter.sendMail({ from: process.env.MAIL_FROM, to, subject, text, html });
  return true;
}

module.exports = { sendMail, configured };
