const cron = require('node-cron');
const { dbAsync } = require('../config/database');
const { fromKurus } = require('../utils/money');
const telegram = require('./telegramNotifier');
const { sendMail, isConfigured: mailConfigured } = require('./mailer');
const SmmProviderClient = require('./smmProvider');

let pollBusy = false;

// Telegram /start eslestirmelerini isler (30 sn'de bir, bot ayarliysa).
async function pollTelegramLinks() {
  if (pollBusy) return;
  pollBusy = true;
  try {
    await telegram.processLinkUpdates();
  } catch (err) {
    console.error('Telegram link poller error:', err.message);
  } finally {
    pollBusy = false;
  }
}

// Bakiyesi olup uzun suredir siparis vermeyen kullaniciya nazik hatirlatma
// e-postasi. Varsayilan kapali; admin panelinden acilir.
async function sendBalanceReminders() {
  try {
    const enabled = await dbAsync.get("SELECT value FROM site_settings WHERE key = 'reminder_email_enabled'");
    if (enabled?.value !== '1' || !(await mailConfigured())) return;

    const siteNameRow = await dbAsync.get("SELECT value FROM site_settings WHERE key = 'site_name'");
    const siteName = siteNameRow?.value || 'SMM Panel';

    // Kriter: musteri, banli degil, en az 1 TL bakiyesi var, son 3 gunde
    // siparisi yok ve son 7 gunde hatirlatma almamis. Tek seferde en fazla 50
    // kisi (SMTP limitlerini zorlamamak icin).
    const users = await dbAsync.all(`
      SELECT id, username, email, balance_kurus FROM users
      WHERE role = 'client' AND banned = 0 AND email_opt_out = 0 AND balance_kurus >= 100
        AND (last_reminder_email_at IS NULL OR last_reminder_email_at <= datetime('now', '-7 days'))
        AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = users.id AND o.created_at >= datetime('now', '-3 days'))
      LIMIT 50
    `);

    for (const user of users) {
      const balance = fromKurus(user.balance_kurus).toFixed(2);
      try {
        await sendMail({
          to: user.email,
          subject: `${siteName} — ₺${balance} bakiyen seni bekliyor! 🚀`,
          text: `Merhaba ${user.username},\n\nHesabında kullanılmayı bekleyen ₺${balance} bakiyen var. Panele göz at, güncel kampanyaları kaçırma!\n\n${siteName}`,
          html: `<p>Merhaba <b>${user.username}</b>,</p><p>Hesabında kullanılmayı bekleyen <b>₺${balance}</b> bakiyen var. Panele göz at, güncel kampanyaları kaçırma! 🚀</p><p>${siteName}</p>`
        });
        await dbAsync.run('UPDATE users SET last_reminder_email_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
      } catch (err) {
        console.error(`Hatırlatma e-postası gönderilemedi (${user.email}):`, err.message);
      }
    }
  } catch (err) {
    console.error('Reminder job error:', err.message);
  }
}

// ---------------------------------------------------------------------------
// SAĞLAYICI BAKİYE UYARISI
// Aktif saglayicilarin bakiyesi 30 dk'da bir cekilir. Esik altina dusunce
// iki asamali Telegram uyarisi gider: esikte ⚠️ uyari, esigin yarisinda 🚨
// kritik. Her dusus doneminde her seviye yalnizca BIR kez bildirilir; bakiye
// esigin ustune cikinca durum sifirlanir (spam yok).
// ---------------------------------------------------------------------------
async function checkProviderBalances() {
  try {
    const thresholdRow = await dbAsync.get("SELECT value FROM site_settings WHERE key = 'provider_balance_threshold'");
    const threshold = Number(thresholdRow?.value) || 0;
    if (threshold <= 0) return; // esik girilmemisse ozellik kapali

    const stateRow = await dbAsync.get("SELECT value FROM site_settings WHERE key = 'provider_balance_alert_state'");
    let state = {};
    try { state = JSON.parse(stateRow?.value || '{}'); } catch {}

    const providers = await dbAsync.all('SELECT * FROM providers WHERE status = 1');
    for (const provider of providers) {
      let balanceInfo;
      try {
        balanceInfo = await new SmmProviderClient(provider.api_url, provider.api_key).getBalance();
      } catch { continue; }
      const balance = Number(balanceInfo?.balance);
      if (!Number.isFinite(balance)) continue;
      const currency = String(balanceInfo?.currency || 'USD').toUpperCase();

      // Admin panelindeki gorunum de guncel kalsin.
      await dbAsync.run('UPDATE providers SET balance = ? WHERE id = ?', [balance, provider.id]);

      const level = balance < threshold / 2 ? 'critical' : balance < threshold ? 'warn' : 'ok';
      const previous = state[provider.id] || 'ok';

      if (level === 'warn' && previous === 'ok') {
        telegram.notifyPaymentEvent('⚠️ Sağlayıcı Bakiyesi Azalıyor', [
          `🔌 Sağlayıcı: ${provider.name}`,
          `💰 Bakiye: ${balance.toFixed(2)} ${currency}`,
          `📉 Uyarı eşiği: ${threshold} ${currency}`,
          '💡 Yükleme yapmayı planla; bakiye biterse siparişler başarısız olur.'
        ]);
      } else if (level === 'critical' && previous !== 'critical') {
        telegram.notifyPaymentEvent('🚨 Sağlayıcı Bakiyesi KRİTİK!', [
          `🔌 Sağlayıcı: ${provider.name}`,
          `💰 Bakiye: ${balance.toFixed(2)} ${currency} (eşiğin yarısının altı!)`,
          '🔥 Siparişler her an başarısız olmaya başlayabilir — HEMEN bakiye yükle!'
        ]);
      }

      if (level === 'ok') delete state[provider.id];
      else state[provider.id] = level;
    }

    await dbAsync.run(
      "INSERT INTO site_settings (key, value) VALUES ('provider_balance_alert_state', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [JSON.stringify(state)]
    );
  } catch (err) {
    console.error('Provider balance check error:', err.message);
  }
}

function startMarketingWorker() {
  cron.schedule('*/30 * * * * *', pollTelegramLinks, { noOverlap: true });
  // Her gun 10:00 UTC (13:00 TR'ye yakin bir saat) hatirlatma taramasi.
  cron.schedule('0 10 * * *', sendBalanceReminders, { noOverlap: true });
  // Saglayici bakiyesi 30 dakikada bir kontrol edilir; acilista da bir kez.
  cron.schedule('*/30 * * * *', checkProviderBalances, { noOverlap: true });
  setTimeout(() => checkProviderBalances().catch(() => {}), 90 * 1000);
  console.log('Marketing worker active (telegram link 30s, reminder daily, provider balance 30m)');
}

module.exports = { startMarketingWorker, pollTelegramLinks, sendBalanceReminders, checkProviderBalances };
