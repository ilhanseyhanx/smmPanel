function notFoundApi(req, res, next) {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API adresi bulunamadı.' });
  next();
}

function errorHandler(err, req, res, next) {
  req.log?.error({ err }, 'request_failed');
  if (res.headersSent) return next(err);
  const status = Number.isInteger(err.status) ? err.status : 500;
  const message = status >= 500 ? 'Beklenmeyen bir sunucu hatası oluştu.' : err.message;
  res.status(status).json({ error: message });
}

module.exports = { notFoundApi, errorHandler };

