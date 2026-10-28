'use strict';

// Demo bayinin (tenant/demo.js) ornek verileri: yonetim panelinin ve demo
// musterinin GET istekleri bu verilerle yanitlanir. Veriler sabit tohumla
// uretilir (her istekte ayni), tarihler simdiye gore kayar. Hicbir sey
// veritabanina yazilmaz.
const { METHODS } = require('../services/tenantPayments');

const HOUR = 3_600_000;

// Sabit tohumlu sozde rastgele sayi (mulberry32).
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rand, list) => list[Math.floor(rand() * list.length)];
const round2 = value => Math.round(value * 100) / 100;

// SQLite bicimi (UTC): "YYYY-AA-GG SS:DD:ss"
function sqlDate(ms) {
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

const CUSTOMERS = [
  'ayse.k', 'mert_34', 'elifyilmaz', 'can.medya', 'zeynep_ig', 'burak.tr', 'selin.shop',
  'emre_kaya', 'deniz.ajans', 'ozan61', 'irem.beauty', 'kerem_fx', 'gizem.art', 'tolga.music'
];

// [ad, birim, satis (1000 adet), alis (1000 adet), baglanti sablonu, miktarlar]
const SERVICES = [
  ['Instagram Türk Takipçi', 119.9, 84.6, u => `https://instagram.com/${u}`, [500, 1000, 2000, 5000]],
  ['Instagram Gerçek Beğeni', 24.9, 16.8, u => `https://instagram.com/p/C${u.length}x${u.charCodeAt(0)}Qa`, [1000, 2000, 5000, 10000]],
  ['TikTok İzlenme', 4.9, 3.15, u => `https://tiktok.com/@${u}/video/73${u.length}91048${u.charCodeAt(1)}`, [10000, 25000, 50000, 100000]],
  ['TikTok Takipçi', 139, 96.3, u => `https://tiktok.com/@${u}`, [500, 1000, 2500]],
  ['YouTube Abone (garantili)', 399, 281, u => `https://youtube.com/@${u}`, [100, 250, 500, 1000]],
  ['YouTube İzlenme', 49, 33.4, u => `https://youtube.com/watch?v=dQ${u.length}w4${u.charCodeAt(0)}XcQ`, [1000, 5000, 10000]],
  ['X (Twitter) Takipçi', 159, 110.2, u => `https://x.com/${u}`, [500, 1000, 2000]],
  ['Spotify Dinlenme', 29, 19.5, u => `https://open.spotify.com/track/4u${u.length}Zf${u.charCodeAt(0)}`, [1000, 5000, 10000]]
];

const STATUS_POOL = ['completed', 'completed', 'completed', 'completed', 'completed', 'completed', 'completed',
  'processing', 'processing', 'pending', 'partial', 'canceled'];

let cache = null;

// Veriler saat basinda yeniden kurulur (tarihler kayar, sayilar ayni kalir).
function dataset() {
  const hourStart = Math.floor(Date.now() / HOUR) * HOUR;
  if (cache && cache.at === hourStart) return cache.data;
  const rand = rng(20261028);
  const now = hourStart;

  const customers = CUSTOMERS.map((username, i) => ({
    id: 4101 + i,
    username,
    email: `${username.replace(/[._]/g, '')}@ornek.com`,
    banned: i === 12,
    created_at: sqlDate(now - (2 + Math.floor(rand() * 27)) * 24 * HOUR - Math.floor(rand() * 20) * HOUR),
    last_login_at: sqlDate(now - Math.floor(rand() * 72) * HOUR - 15 * 60_000),
    last_login_ip: null,
    balance: round2(pick(rand, [0, 12.5, 35, 48.9, 75, 120, 210.4, 18, 0, 64.2])),
    orders_count: 0,
    spent: 0
  }));

  const orders = [];
  for (let i = 0; i < 46; i++) {
    const customer = customers[Math.floor(rand() * customers.length)];
    const service = SERVICES[Math.floor(rand() * SERVICES.length)];
    const quantity = pick(rand, service[4]);
    const charge = round2(service[1] * quantity / 1000);
    const costValue = round2(service[2] * quantity / 1000);
    // En yeni siparis listenin basinda; ilk 5'i bugun.
    const ageHours = i < 5 ? i * 2 + rand() * 1.5 : 10 + i * 15 + rand() * 10;
    const status = i < 3 ? pick(rand, ['processing', 'pending', 'completed']) : pick(rand, STATUS_POOL);
    const refunded = status === 'canceled' ? charge : status === 'partial' ? round2(charge * 0.3) : 0;
    const refundedCost = status === 'canceled' ? costValue : status === 'partial' ? round2(costValue * 0.3) : 0;
    const created = now - ageHours * HOUR;
    orders.push({
      id: 18420 - i * 7,
      customer: customer.username,
      customer_id: customer.id,
      service_name: service[0],
      link: service[3](customer.username),
      quantity,
      status,
      start_count: status === 'pending' ? null : Math.floor(rand() * 4000),
      remains: status === 'partial' ? Math.floor(quantity * 0.3) : status === 'processing' ? Math.floor(quantity * rand() * 0.8) : 0,
      paid: round2(charge - refunded),
      refunded,
      cost: round2(costValue - refundedCost),
      profit: round2((charge - refunded) - (costValue - refundedCost)),
      refill: service[0].includes('garantili') || service[0].includes('Takipçi'),
      created_at: sqlDate(created),
      completed_at: status === 'completed' || status === 'partial' ? sqlDate(created + (0.5 + rand() * 5) * HOUR) : null
    });
  }
  for (const o of orders) {
    if (o.status === 'canceled') continue;
    const c = customers.find(x => x.id === o.customer_id);
    c.orders_count += 1;
    c.spent = round2(c.spent + o.paid);
  }

  const payments = [];
  const methods = ['bank', 'paytr', 'paytr', 'bank', 'nowpayments', 'paytr'];
  for (let i = 0; i < 16; i++) {
    const customer = customers[Math.floor(rand() * customers.length)];
    const method = i < 2 ? 'bank' : pick(rand, methods);
    const amount = pick(rand, [100, 150, 200, 250, 300, 500, 750, 1000]);
    const status = i < 2 ? 'pending' : i === 6 ? 'rejected' : i === 9 ? 'failed' : 'completed';
    const created = now - (i < 2 ? (i + 0.4) * HOUR : (6 + i * 37) * HOUR);
    payments.push({
      id: 905 - i * 3,
      method,
      method_label: METHODS[method].label,
      amount,
      status,
      failure_reason: status === 'rejected' ? 'Hesaba bu tutarda para gelmedi.' : status === 'failed' ? 'Kart sahibi ödemeyi tamamlamadı.' : null,
      created_at: sqlDate(created),
      completed_at: status === 'completed' ? sqlDate(created + 0.2 * HOUR) : null,
      customer: customer.username,
      customer_id: customer.id,
      bank_name: method === 'bank' ? pick(rand, ['Ziraat Bankası', 'Papara', 'Garanti BBVA', 'İş Bankası']) : null,
      sender_name: method === 'bank' ? pick(rand, ['Ayşe Kaya', 'Mert Demir', 'Elif Yılmaz', 'Can Öztürk']) : null,
      note: null,
      reviewed_by: status === 'completed' && method === 'bank' ? 'owner:demo_bayi' : null
    });
  }

  const digitalOrders = [
    ['Gmail Hesap (2015 öncesi, telefon onaylı)', 2, 29.26, 22.5],
    ['Netflix Premium 1 Ay', 1, 104.13, 80.1],
    ['Instagram Hesap (Türk, 1K takipçi)', 1, 58.38, 44.91],
    ['Windows 11 Pro Lisans Anahtarı', 3, 122.85, 94.5],
    ['Gmail Hesap (2015 öncesi, telefon onaylı)', 5, 73.15, 56.25],
    ['Spotify Premium 1 Ay', 1, 39.9, 29.7]
  ].map(([product, quantity, paid, cost], i) => {
    const customer = customers[(i * 5 + 3) % customers.length];
    return {
      id: 312 - i * 4,
      customer: customer.username,
      product_name: product,
      quantity,
      status: i === 4 ? 'refunded' : 'completed',
      paid: i === 4 ? 0 : paid,
      refunded: i === 4 ? paid : 0,
      cost: i === 4 ? 0 : cost,
      profit: i === 4 ? 0 : round2(paid - cost),
      created_at: sqlDate(now - (3 + i * 29) * HOUR)
    };
  });

  const activity = [];
  const push = (ms, actor_type, actor_name, action, details) => activity.push({ actor_type, actor_name, action, details, ip_address: actor_type === 'customer' ? '88.24.xxx.xxx' : null, created_at: sqlDate(ms) });
  for (const o of orders.slice(0, 12)) push(Date.parse(o.created_at.replace(' ', 'T') + 'Z') + 60_000, 'customer', o.customer, 'customer_login', null);
  for (const p of payments.filter(x => x.method === 'bank').slice(0, 5)) {
    push(Date.parse(p.created_at.replace(' ', 'T') + 'Z'), 'customer', p.customer, 'payment_notice', { amount: p.amount, bank: p.bank_name, sender: p.sender_name });
    if (p.status === 'completed') push(Date.parse(p.completed_at.replace(' ', 'T') + 'Z'), 'owner', null, 'payment_completed', { customer: p.customer, amount: p.amount, method: p.method_label });
  }
  for (const c of customers.slice(0, 6)) push(Date.parse(c.created_at.replace(' ', 'T') + 'Z'), 'customer', c.username, 'customer_registered', null);
  push(now - 40 * HOUR, 'owner', null, 'service_price_changed', { service_id: 1204, service: 'Instagram Türk Takipçi', after: { enabled: true, markup_percent: 42, fixed_price: null } });
  push(now - 41 * HOUR, 'owner', null, 'theme_changed', { from: 'Klasik', to: 'Gradyan' });
  push(now - 70 * HOUR, 'owner', null, 'owner_login', null);
  activity.sort((a, b) => b.created_at.localeCompare(a.created_at));
  activity.forEach((a, i) => { a.id = 9000 - i; });

  const balanceLogs = [];
  for (const p of payments.filter(x => x.status === 'completed').slice(0, 8)) {
    balanceLogs.push({ customer: p.customer, customer_id: p.customer_id, amount: p.amount, type: 'deposit', order_id: null, note: `${p.method_label} ile yükleme`, created_at: p.completed_at });
  }
  for (const o of orders.slice(0, 14)) {
    balanceLogs.push({ customer: o.customer, customer_id: o.customer_id, amount: -round2(o.paid + o.refunded), type: 'order', order_id: o.id, note: null, created_at: o.created_at });
    if (o.refunded > 0) balanceLogs.push({ customer: o.customer, customer_id: o.customer_id, amount: o.refunded, type: 'refund', order_id: o.id, note: null, created_at: o.completed_at || o.created_at });
  }
  balanceLogs.sort((a, b) => b.created_at.localeCompare(a.created_at));
  let running = 640;
  balanceLogs.forEach((l, i) => { l.id = 7000 - i; l.balance_after = round2(Math.max(0, running)); running -= l.amount; });

  // Demo musteri (vitrinde "Musteri gozuyle"): kendi siparisleri ve yuklemeleri.
  const shopperOrders = orders.slice(0, 9).map((o, i) => ({
    id: o.id, service_name: o.service_name, link: o.link.replace(o.customer, 'demo_musteri'), quantity: o.quantity,
    status: o.status, start_count: o.start_count, remains: o.remains, charge: round2(o.paid + o.refunded), refunded: o.refunded,
    refill: o.refill && i % 2 === 0, created_at: o.created_at
  }));
  const shopperPayments = payments.slice(2, 6).map(p => ({
    id: p.id, method: p.method, method_label: p.method_label, amount: p.amount, status: p.status,
    failure_reason: p.failure_reason, created_at: p.created_at, completed_at: p.completed_at
  }));

  cache = { at: hourStart, data: { now, customers, orders, payments, digitalOrders, activity, balanceLogs, shopperOrders, shopperPayments } };
  return cache.data;
}

function sumOrders(list) {
  const revenue = round2(list.reduce((s, o) => s + o.paid, 0));
  const cost = round2(list.reduce((s, o) => s + o.cost, 0));
  return { orders: list.length, revenue, cost, profit: round2(revenue - cost) };
}

function paged(list, query, limit) {
  const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1);
  return { page, pages: Math.max(1, Math.ceil(list.length / limit)), total: list.length, items: list.slice((page - 1) * limit, page * limit) };
}

const OWNER_BALANCE = 1840.5;

/** Demo aboneligi: panel her zaman Pro paket, "denemede 1 gun kaldi" gosterir. */
function demoSubscription(settings) {
  const ends = Math.floor(Date.now() / HOUR) * HOUR + 24 * HOUR;
  return {
    plan_status: 'trial', package: 'pro', package_name: 'Pro', pending_package: null,
    fees: { standart: settings.monthly_fee_tl, pro: settings.monthly_fee_pro_tl },
    fee: settings.monthly_fee_pro_tl, hours_left: 24, auto_renew: false,
    trial_ends_at: sqlDate(ends), paid_until: null, period_ends_at: sqlDate(ends), days_left: 1,
    grace_ends_at: null, delete_at: null, owner_balance: OWNER_BALANCE, balance_enough: OWNER_BALANCE >= settings.monthly_fee_pro_tl
  };
}

/**
 * Yonetim paneli GET istegi icin ornek yanit; ornek verisi olmayan adresler
 * (servisler, site ayarlari, tema, dijital katalog...) icin null doner ve
 * gercek isleyici calisir.
 */
function panelResponse(path, query, ctx) {
  const d = dataset();
  const q = String(query.q || '').trim().toLocaleLowerCase('tr-TR');
  if (path === '/dashboard') {
    const dayStart = new Date(new Date(d.now).toISOString().slice(0, 10) + 'T00:00:00Z').getTime();
    const today = d.orders.filter(o => Date.parse(o.created_at.replace(' ', 'T') + 'Z') >= dayStart);
    const month = sumOrders(d.orders);
    // Toplamlar: son 30 gunun uzerine onceki aylarin ornek cirosu.
    const revenue = round2(month.revenue + 9480.4);
    const cost = round2(month.cost + 6602.1);
    return {
      owner_balance: OWNER_BALANCE,
      failed_for_balance_7d: 0,
      totals: { orders: month.orders + 214, revenue, cost, profit: round2(revenue - cost), active: d.orders.filter(o => ['pending', 'processing'].includes(o.status)).length },
      last_30d: month,
      today: sumOrders(today),
      customers: { total: d.customers.length + 63, new_30d: d.customers.length, balance: round2(d.customers.reduce((s, c) => s + c.balance, 0)) },
      recent_orders: d.orders.slice(0, 8).map(o => ({ id: o.id, customer: o.customer, service_name: o.service_name, quantity: o.quantity, status: o.status, charge: o.paid, created_at: o.created_at }))
    };
  }
  if (path === '/customers') {
    return { customers: d.customers.filter(c => !q || `${c.username} ${c.email}`.includes(q)).map(({ last_login_ip, ...c }) => c) };
  }
  const customerMatch = /^\/customers\/(\d+)$/.exec(path);
  if (customerMatch) {
    const c = d.customers.find(x => x.id === Number(customerMatch[1]));
    if (!c) return { status: 404, body: { error: 'Müşteri bulunamadı.' } };
    return {
      customer: { id: c.id, username: c.username, email: c.email, balance: c.balance, banned: c.banned, created_at: c.created_at, last_login_at: c.last_login_at, last_login_ip: null },
      orders: d.orders.filter(o => o.customer_id === c.id).map(o => ({ id: o.id, service_name: o.service_name, link: o.link, quantity: o.quantity, status: o.status, created_at: o.created_at, paid: o.paid, refunded: o.refunded, profit: o.profit })),
      balance_logs: d.balanceLogs.filter(l => l.customer_id === c.id).map(({ customer, customer_id, ...l }) => l)
    };
  }
  if (path === '/orders') {
    const status = String(query.status || '');
    const list = d.orders.filter(o => (!status || o.status === status)
      && (!q || o.customer.includes(q) || o.link.toLowerCase().includes(q) || String(o.id) === q.replace(/^#/, '')));
    const p = paged(list, query, 50);
    return { page: p.page, pages: p.pages, total: p.total, orders: p.items.map(({ refill, ...o }) => o) };
  }
  if (path === '/payments') {
    const status = String(query.status || '');
    const method = String(query.method || '');
    const list = d.payments.filter(p => (!status || p.status === status) && (!method || p.method === method));
    const p = paged(list, query, 50);
    return { page: p.page, pages: p.pages, total: p.total, pending_bank: d.payments.filter(x => x.method === 'bank' && x.status === 'pending').length, payments: p.items };
  }
  if (path === '/logs') {
    return { activity: d.activity, balance_logs: d.balanceLogs.map(({ customer_id, ...l }) => l) };
  }
  if (path === '/digital/orders') {
    const p = paged(d.digitalOrders, query, 50);
    return { page: p.page, pages: p.pages, total: p.total, orders: p.items };
  }
  if (path === '/subscription') {
    return {
      subscription: demoSubscription(ctx.settings),
      has_domain: true,
      trial_days: ctx.settings.trial_days, grace_days: ctx.settings.grace_days, delete_after_days: ctx.settings.delete_after_days,
      top_up_url: ctx.topUpUrl, invoices: []
    };
  }
  if (path === '/mail') {
    const log = [
      ...d.payments.filter(p => p.status === 'completed').slice(0, 4).map(p => ({ kind: 'payment', recipient: `${p.customer.replace(/[._]/g, '')}@ornek.com`, subject: `Bakiyene ₺${p.amount} eklendi`, status: 'sent', error: null, created_at: p.completed_at })),
      ...d.payments.filter(p => p.method === 'bank').slice(0, 2).map(p => ({ kind: 'owner_bank_notice', recipient: 'sahip@ornekmedya.com', subject: 'Yeni havale bildirimi', status: 'sent', error: null, created_at: p.created_at })),
      ...d.customers.slice(0, 3).map(c => ({ kind: 'welcome', recipient: c.email, subject: 'Hesabın hazır', status: 'sent', error: null, created_at: c.created_at }))
    ].sort((a, b) => b.created_at.localeCompare(a.created_at));
    return {
      notify: { welcome: true, payment: true, order: false },
      smtp: { host: 'smtp.yandex.com', port: 465, secure: true, user: 'destek@ornekmedya.com', from: 'destek@ornekmedya.com', has_password: true, active: true },
      log,
      owner_email: 'sahip@ornekmedya.com'
    };
  }
  if (path === '/payment-settings') {
    const method = (key, enabled, extra = {}) => ({
      method: key, label: METHODS[key].label, enabled, configured: enabled, min: key === 'nowpayments' ? 400 : 10, max: 50000,
      accounts: '', instructions: '', test_mode: false, image_url: '',
      webhook_ready: key === 'shopier' ? false : undefined,
      saved: Object.fromEntries(METHODS[key].secrets.map(s => [s, enabled])),
      ...extra
    });
    return {
      methods: [
        method('bank', true, { accounts: 'Ziraat Bankası · Yıldız Medya Ltd.\nIBAN: TR00 0000 0000 0000 0000 0000 00 (örnek)\nPapara No: 1234567890 (örnek)', instructions: 'Açıklamaya kullanıcı adını yaz; ödeme 10 dakika içinde onaylanır.' }),
        method('paytr', true),
        method('shopier', false),
        method('nowpayments', true)
      ],
      callback_urls: ctx.callbackUrls
    };
  }
  return null;
}

/** Vitrinde demo musterisinin GET istekleri (siparislerim, yuklemeler, yontemler). */
function storefrontResponse(path, coins) {
  const d = dataset();
  if (path === '/orders') return { orders: d.shopperOrders, page: 1 };
  if (path === '/payments/history') return { payments: d.shopperPayments };
  if (path === '/payments/methods') {
    return {
      methods: [
        { method: 'bank', label: METHODS.bank.label, min: 10, max: 50000, accounts: 'Ziraat Bankası · Örnek Medya Ltd.\nIBAN: TR00 0000 0000 0000 0000 0000 00 (örnek)', instructions: 'Açıklamaya kullanıcı adını yaz.' },
        { method: 'paytr', label: METHODS.paytr.label, min: 10, max: 50000 },
        { method: 'nowpayments', label: METHODS.nowpayments.label, min: 400, max: 50000, coins }
      ]
    };
  }
  return null;
}

module.exports = { panelResponse, storefrontResponse, demoSubscription, OWNER_BALANCE, dataset };
