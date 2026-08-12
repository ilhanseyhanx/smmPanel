require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { rateLimit } = require('express-rate-limit');
const pinoHttp = require('pino-http');
const compression = require('compression');
const path = require('path');
const { initDatabase } = require('./config/database');
const { startOrderWorker } = require('./services/orderWorker');
const { notFoundApi, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const servicesRoutes = require('./routes/services');
const ordersRoutes = require('./routes/orders');
const paymentsRoutes = require('./routes/payments');
const ticketsRoutes = require('./routes/tickets');
const adminRoutes = require('./routes/admin');
const accountRoutes = require('./routes/account');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(pinoHttp({
  level: process.env.LOG_LEVEL || 'info',
  autoLogging: process.env.NODE_ENV !== 'test',
  redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie']
}));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || `http://localhost:${PORT}`).split(',').map(v => v.trim()).filter(Boolean));
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    callback(new Error('Bu kaynaktan erişime izin verilmiyor.'));
  }
}));
app.use(cookieParser());
app.use(compression());
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: false, limit: '512kb' }));

const apiLimiter = rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });
app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

// Serve frontend static assets
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
  }
}));

const blogRoutes = require('./routes/blog');
const aiRoutes = require('./routes/ai');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/account', accountRoutes);

// ----------------------------------------------------
// RESELLER API V2 (Standard SMM API Endpoint)
// ----------------------------------------------------
app.post('/api/v2', async (req, res) => {
  const { key, action, service, link, quantity, order, orders } = req.body;
  const { dbAsync, withTransaction } = require('./config/database');
  const { calculateChargeKurus, fromKurus, toKurus } = require('./utils/money');
  const { normalizePlainText } = require('./utils/security');

  if (!key) {
    return res.json({ error: 'Invalid API Key' });
  }

  const user = await dbAsync.get(`SELECT * FROM users WHERE api_key = ?`, [key]);
  if (!user) {
    return res.json({ error: 'Invalid API Key' });
  }

  if (action === 'services') {
    const list = await dbAsync.all(`SELECT id as service, name, rate_per_1000_kurus, min_quantity as min, max_quantity as max, category_id as category FROM services WHERE status = 1`);
    return res.json(list.map(item => ({ ...item, rate: fromKurus(item.rate_per_1000_kurus).toFixed(2), rate_per_1000_kurus: undefined })));
  }

  if (action === 'balance') {
    return res.json({ balance: fromKurus(user.balance_kurus).toFixed(2), currency: 'TRY' });
  }

  if (action === 'add') {
    const qty = Number(quantity);
    const target = normalizePlainText(link, 2048);
    if (!Number.isSafeInteger(qty) || !target || /^(javascript|data|file):/i.test(target)) return res.json({ error: 'Invalid parameters' });
    try {
      const created = await withTransaction(async tx => {
        const sObj = await tx.get('SELECT * FROM services WHERE id = ? AND status = 1', [service]);
        if (!sObj || qty < sObj.min_quantity || qty > sObj.max_quantity) { const err = new Error('Invalid service or quantity'); err.status = 400; throw err; }
        const chargeKurus = calculateChargeKurus(sObj.rate_per_1000_kurus || toKurus(sObj.rate_per_1000), qty);
        const debit = await tx.run('UPDATE users SET balance_kurus = balance_kurus - ?, balance = (balance_kurus - ?) / 100.0 WHERE id = ? AND balance_kurus >= ?', [chargeKurus, chargeKurus, user.id, chargeKurus]);
        if (debit.changes !== 1) { const err = new Error('Not enough balance'); err.status = 400; throw err; }
        const result = await tx.run(`INSERT INTO orders (user_id, service_id, provider_id, link, quantity, charge, charge_kurus, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`, [user.id, sObj.id, sObj.provider_id, target, qty, fromKurus(chargeKurus), chargeKurus]);
        return result.id;
      });
      return res.json({ order: created });
    } catch (err) { return res.json({ error: err.message }); }
  }

  if (action === 'status') {
    if (order) {
      const o = await dbAsync.get(`SELECT * FROM orders WHERE id = ? AND user_id = ?`, [order, user.id]);
      if (!o) return res.json({ error: 'Order not found' });
      const mapped = { completed: 'Completed', canceled: 'Canceled', partial: 'Partial', failed: 'Canceled', pending: 'Pending', processing: 'Processing' };
      return res.json({ status: mapped[o.status] || 'Processing', start_count: o.start_count, remains: o.remains, charge: fromKurus(o.charge_kurus).toFixed(2), currency: 'TRY' });
    }
    if (orders) {
      const ids = String(orders).split(',').map(Number).filter(Number.isSafeInteger).slice(0, 100);
      if (!ids.length) return res.json({ error: 'Invalid orders' });
      const rows = await dbAsync.all(`SELECT * FROM orders WHERE user_id = ? AND id IN (${ids.map(() => '?').join(',')})`, [user.id, ...ids]);
      const mapped = { completed: 'Completed', canceled: 'Canceled', partial: 'Partial', failed: 'Canceled', pending: 'Pending', processing: 'Processing' };
      return res.json(Object.fromEntries(rows.map(o => [o.id, { status: mapped[o.status] || 'Processing', start_count: o.start_count, remains: o.remains, charge: fromKurus(o.charge_kurus).toFixed(2), currency: 'TRY' }])));
    }
  }

  res.json({ error: 'Invalid action' });
});

// ----------------------------------------------------
// LOCAL MOCK PROVIDER API (For testing provider sync offline)
// ----------------------------------------------------
if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_MOCK_PROVIDER === 'true') app.post('/api/mock-provider', (req, res) => {
  const { action, service, link, quantity, order, orders } = req.body;

  if (action === 'services') {
    return res.json([
      { service: 101, name: 'Instagram HQ Followers [Refill 30D]', category: 'Instagram', rate: '0.80', min: '100', max: '50000', refill: true },
      { service: 102, name: 'Instagram Real Likes [Instant]', category: 'Instagram', rate: '0.20', min: '50', max: '20000', refill: false },
      { service: 201, name: 'TikTok Live Stream Views [60 Mins]', category: 'TikTok', rate: '0.50', min: '100', max: '5000', refill: false },
      { service: 202, name: 'TikTok Viral Followers', category: 'TikTok', rate: '0.90', min: '100', max: '25000', refill: true },
      { service: 301, name: 'YouTube Views [High Retention]', category: 'YouTube', rate: '1.40', min: '500', max: '100000', refill: true },
      { service: 401, name: 'Telegram Channel Members [Global]', category: 'Telegram', rate: '0.40', min: '100', max: '100000', refill: false }
    ]);
  }

  if (action === 'add') {
    const mockProviderOrderId = Math.floor(100000 + Math.random() * 900000);
    return res.json({ order: mockProviderOrderId });
  }

  if (action === 'status') {
    if (orders) {
      const orderIdList = orders.split(',');
      const result = {};
      orderIdList.forEach(id => {
        result[id] = { status: 'Completed', start_count: '250', remains: '0', charge: '0.15' };
      });
      return res.json(result);
    }
    return res.json({ status: 'Completed', start_count: '250', remains: '0', charge: '0.15' });
  }

  if (action === 'balance') {
    return res.json({ balance: '4850.00', currency: 'USD' });
  }

  res.status(400).json({ error: 'Geçersiz provider aksiyonu.' });
});

app.use(notFoundApi);

// Fallback SPA Route
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(errorHandler);

// Initialize DB and start server
async function startServer() {
  await initDatabase();
  return app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 SMM Panel Sunucusu Yayında!`);
    console.log(`🌐 Yerel Adres: http://localhost:${PORT}`);
    console.log(`==================================================\n`);

    // Start background order status sync worker
    startOrderWorker();
  });
}

if (require.main === module) {
  startServer().catch(err => {
    console.error('Sunucu başlatılamadı:', err);
    process.exitCode = 1;
  });
}

module.exports = { app, startServer };
