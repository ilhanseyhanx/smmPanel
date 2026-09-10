const healthEvents = require('../services/healthEvents');

function notFoundApi(req, res, next) {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API adresi bulunamadı.', error_en: 'API endpoint not found.' });
  }
  next();
}

function errorHandler(err, req, res, next) {
  req.log?.error({ err }, 'request_failed');
  if (res.headersSent) return next(err);
  const status = Number.isInteger(err.status) ? err.status : 500;
  // 5xx'te ic hata metni disari sizdirilmaz; durum kodu ise korunur
  // (502 sağlayıcı hatasi ile 500 sunucu hatasi ayri sinyallerdir).
  if (status >= 500) {
    // Sistem Sagligi: yalnizca veritabani kaynakli 5xx'ler kaydedilir
    // (SQLITE_BUSY vb.). Kayit asla yaniti etkilemez.
    if (healthEvents.sqliteHatasiMi(err)) {
      healthEvents.recordError({ category: 'sqlite_error', source: 'http', error: err });
    }
    return res.status(status).json({
      error: 'Beklenmeyen bir sunucu hatası oluştu.',
      error_en: 'An unexpected server error occurred.'
    });
  }
  // Site iki dilli: rota mesaji Ingilizce karsiligini err.messageEn ile
  // verebilir. Vermezse istemci Turkce mesaji gosterir.
  const body = { error: err.message };
  if (err.messageEn) body.error_en = err.messageEn;
  // Hangi form alaninin sorunlu oldugu biliniyorsa istemci onu isaretler.
  if (err.field) body.field = err.field;
  res.status(status).json(body);
}

module.exports = { notFoundApi, errorHandler };
