const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);
db.configure('busyTimeout', 5000);

// Helper wrapper for async/await
const dbAsync = {
  run: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  },
  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },
  exec: (sql) => new Promise((resolve, reject) => {
    db.exec(sql, (err) => err ? reject(err) : resolve());
  })
};

function wrapConnection(connection) {
  return {
    run: (sql, params = []) => new Promise((resolve, reject) => {
      connection.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    }),
    get: (sql, params = []) => new Promise((resolve, reject) => {
      connection.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
    }),
    all: (sql, params = []) => new Promise((resolve, reject) => {
      connection.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
    })
  };
}

async function withTransaction(work) {
  const connection = new sqlite3.Database(dbPath);
  connection.configure('busyTimeout', 5000);
  const tx = wrapConnection(connection);
  try {
    await tx.run('PRAGMA foreign_keys = ON');
    await tx.run('BEGIN IMMEDIATE');
    const result = await work(tx);
    await tx.run('COMMIT');
    return result;
  } catch (err) {
    try { await tx.run('ROLLBACK'); } catch {}
    throw err;
  } finally {
    await new Promise(resolve => connection.close(() => resolve()));
  }
}

async function addColumnIfMissing(table, column, definition) {
  const columns = await dbAsync.all(`PRAGMA table_info(${table})`);
  if (!columns.some(item => item.name === column)) {
    await dbAsync.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function runMigrations() {
  await addColumnIfMissing('users', 'balance_kurus', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing('users', 'referral_balance_kurus', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing('users', 'referrer_id', 'INTEGER REFERENCES users(id)');
  await addColumnIfMissing('users', 'email_verified', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing('users', 'must_change_password', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing('users', 'two_factor_secret', 'TEXT');
  await addColumnIfMissing('users', 'two_factor_enabled', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing('users', 'token_version', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing('users', 'banned', 'INTEGER NOT NULL DEFAULT 0');
  // Telegram sipariş bildirimleri: chat_id ancak kullanici bota /start ile
  // baglandiginda dolar; username yalnizca panelde gostermek icindir.
  await addColumnIfMissing('users', 'telegram_chat_id', 'TEXT');
  await addColumnIfMissing('users', 'telegram_username', 'TEXT');
  await addColumnIfMissing('users', 'telegram_notify', 'INTEGER NOT NULL DEFAULT 1');
  // Pazarlama hatirlatma e-postasinin ayni kisiye tekrar tekrar gitmemesi icin.
  await addColumnIfMissing('users', 'last_reminder_email_at', 'DATETIME');
  // Ayni kuponun Ingilizce takma kodu: iki kod tek havuzu (limit/kullanim) paylasir.
  await addColumnIfMissing('coupons', 'code_en', 'TEXT');

  // Kampanyalar: servis indirimi veya bakiye bonusu; istege bagli popup vitrini.
  await dbAsync.run(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('service_discount','deposit_bonus')),
      service_id INTEGER REFERENCES services(id),
      discount_percent REAL,
      bonus_percent REAL,
      min_deposit_kurus INTEGER,
      ends_at DATETIME,
      status INTEGER NOT NULL DEFAULT 1,
      popup_enabled INTEGER NOT NULL DEFAULT 0,
      popup_template TEXT DEFAULT 'flash',
      popup_title TEXT,
      popup_frequency_hours INTEGER NOT NULL DEFAULT 24,
      views INTEGER NOT NULL DEFAULT 0,
      clicks INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // Popup ozel basligi dil bazli gosterilir (EN bos ise TR kullanilir).
  await addColumnIfMissing('campaigns', 'popup_title_en', 'TEXT');

  // Pazarlama e-postalarindan cikma tercihi (abonelikten cik linki).
  await addColumnIfMissing('users', 'email_opt_out', 'INTEGER NOT NULL DEFAULT 0');
  // API anahtarinin ne zaman uretildigi: panelde "en son ne zaman yenilendi"
  // bilgisi gosterilir.
  await addColumnIfMissing('users', 'api_key_created_at', 'DATETIME');

  // E-posta pazarlama: sablonlar ve gonderim kayitlari (istatistik icin).
  await dbAsync.run(`
    CREATE TABLE IF NOT EXISTS email_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await dbAsync.run(`
    CREATE TABLE IF NOT EXISTS email_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT NOT NULL,
      template_name TEXT,
      subject TEXT,
      user_id INTEGER,
      email TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('sent','failed')),
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await dbAsync.run('CREATE INDEX IF NOT EXISTS idx_email_logs_batch ON email_logs(batch_id)');

  // Ilk kurulumda 10 hazir sablon eklenir (tablo bos ise).
  const templateCount = await dbAsync.get('SELECT COUNT(*) as count FROM email_templates');
  if (!templateCount || templateCount.count === 0) {
    const { DEFAULT_TEMPLATES } = require('../services/emailTemplates');
    for (const template of DEFAULT_TEMPLATES) {
      await dbAsync.run(
        'INSERT OR IGNORE INTO email_templates (name, subject, body) VALUES (?, ?, ?)',
        [template.name, template.subject, template.body]
      );
    }
  }
  // Yorum daveti sablonu mevcut kurulumlara da eklenir (name UNIQUE oldugu
  // icin varsa dokunulmaz — adminin duzenledigi metin asla ezilmez).
  {
    const { DEFAULT_TEMPLATES, REVIEW_TEMPLATE_NAME } = require('../services/emailTemplates');
    const reviewTemplate = DEFAULT_TEMPLATES.find(t => t.name === REVIEW_TEMPLATE_NAME);
    if (reviewTemplate) {
      await dbAsync.run(
        'INSERT OR IGNORE INTO email_templates (name, subject, body) VALUES (?, ?, ?)',
        [reviewTemplate.name, reviewTemplate.subject, reviewTemplate.body]
      );
    }
  }
  await addColumnIfMissing('services', 'rate_per_1000_kurus', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing('services', 'name_tr', 'TEXT');
  await addColumnIfMissing('services', 'name_en', 'TEXT');
  await addColumnIfMissing('services', 'description_tr', 'TEXT');
  await addColumnIfMissing('services', 'description_en', 'TEXT');
  // Servis bilgi penceresi (musteri tarafindaki "i" butonu ve siparis
  // sayfasindaki kart): baslama suresi, hiz ve satir satir ozellik listesi.
  await addColumnIfMissing('services', 'start_time_tr', 'TEXT');
  await addColumnIfMissing('services', 'start_time_en', 'TEXT');
  await addColumnIfMissing('services', 'speed_tr', 'TEXT');
  await addColumnIfMissing('services', 'speed_en', 'TEXT');
  await addColumnIfMissing('services', 'features_tr', 'TEXT');
  await addColumnIfMissing('services', 'features_en', 'TEXT');
  // Admin panel "Favori Servislerim" sekmesi: sik kullanilan servislere hizli erisim.
  await addColumnIfMissing('services', 'is_favorite', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing('services', 'rate_per_1000_usd_cents', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing('services', 'provider_cost_rate', 'REAL');
  await addColumnIfMissing('services', 'provider_cost_currency', "TEXT DEFAULT 'USD'");
  await addColumnIfMissing('services', 'provider_cost_updated_at', 'DATETIME');
  await addColumnIfMissing('categories', 'name_tr', 'TEXT');
  await addColumnIfMissing('categories', 'name_en', 'TEXT');
  await addColumnIfMissing('blog_posts', 'title_tr', 'TEXT');
  await addColumnIfMissing('blog_posts', 'title_en', 'TEXT');
  await addColumnIfMissing('blog_posts', 'category_tr', 'TEXT');
  await addColumnIfMissing('blog_posts', 'category_en', 'TEXT');
  await addColumnIfMissing('blog_posts', 'summary_tr', 'TEXT');
  await addColumnIfMissing('blog_posts', 'summary_en', 'TEXT');
  await addColumnIfMissing('blog_posts', 'content_tr', 'TEXT');
  await addColumnIfMissing('blog_posts', 'content_en', 'TEXT');
  await addColumnIfMissing('blog_posts', 'seo_title_tr', 'TEXT');
  await addColumnIfMissing('blog_posts', 'seo_title_en', 'TEXT');
  await addColumnIfMissing('blog_posts', 'seo_description_tr', 'TEXT');
  await addColumnIfMissing('blog_posts', 'seo_description_en', 'TEXT');
  await addColumnIfMissing('blog_posts', 'status', "TEXT NOT NULL DEFAULT 'published'");
  await addColumnIfMissing('blog_posts', 'author_id', 'INTEGER');
  await addColumnIfMissing('blog_posts', 'reading_minutes', 'INTEGER NOT NULL DEFAULT 3');
  await addColumnIfMissing('blog_posts', 'updated_at', 'DATETIME');
  await addColumnIfMissing('blog_posts', 'published_at', 'DATETIME');
  await addColumnIfMissing('orders', 'charge_kurus', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing('orders', 'refunded_kurus', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing('orders', 'drip_runs', 'INTEGER NOT NULL DEFAULT 1');
  await addColumnIfMissing('orders', 'drip_interval_minutes', 'INTEGER');
  await addColumnIfMissing('orders', 'failure_reason', 'TEXT');
  // Yorum daveti maili gonderildiyse zamani tutulur (cift gonderimi onlemek icin).
  await addColumnIfMissing('orders', 'review_mail_sent_at', 'DATETIME');
  await addColumnIfMissing('payments', 'amount_kurus', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing('coupons', 'amount_kurus', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing('payment_notifications', 'amount_kurus', 'INTEGER NOT NULL DEFAULT 0');
  // Blog yazisi okunma sayaci (istatistik panelinde gosterilir).
  await addColumnIfMissing('blog_posts', 'views', 'INTEGER NOT NULL DEFAULT 0');

  // Tekil ziyaretci sayimi. Ham IP saklanmaz; IP + tarayici imzasi gizli
  // anahtarla hashlenir. Ayni ziyaretci ayni gun icinde tek kayit olusturur
  // (UNIQUE), farkli gunlerde ayni hash'i aldigi icin haftalik/aylik tekil
  // sayim da dogru calisir.
  await dbAsync.run(`
    CREATE TABLE IF NOT EXISTS site_visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_hash TEXT NOT NULL,
      visit_date TEXT NOT NULL,
      first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(visitor_hash, visit_date)
    )
  `);
  await dbAsync.run('CREATE INDEX IF NOT EXISTS idx_site_visits_date ON site_visits(visit_date)');

  // Guvenlik Merkezi: basarisiz giris / hiz limiti / engelli IP denemeleri
  // burada birikir (30 gun saklanir); panelden engellenen IP'ler blocked_ips'te.
  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS security_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      ip TEXT NOT NULL DEFAULT '',
      path TEXT,
      username TEXT,
      detail TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_security_events_ip ON security_events(ip);
    CREATE TABLE IF NOT EXISTS blocked_ips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT UNIQUE NOT NULL,
      reason TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await dbAsync.exec(`
    UPDATE users SET balance_kurus = CAST(ROUND(balance * 100) AS INTEGER) WHERE balance_kurus = 0 AND balance != 0;
    UPDATE services SET rate_per_1000_kurus = CAST(ROUND(rate_per_1000 * 100) AS INTEGER) WHERE rate_per_1000_kurus = 0 AND rate_per_1000 != 0;
    UPDATE services SET name_tr = name WHERE name_tr IS NULL OR name_tr = '';
    UPDATE services SET name_en = name WHERE name_en IS NULL OR name_en = '';
    UPDATE services SET description_tr = description WHERE description_tr IS NULL;
    UPDATE services SET description_en = description WHERE description_en IS NULL;
    UPDATE categories SET name_tr = name WHERE name_tr IS NULL OR name_tr = '';
    UPDATE categories SET name_en = name WHERE name_en IS NULL OR name_en = '';
    UPDATE blog_posts SET title_tr = title WHERE title_tr IS NULL OR title_tr = '';
    UPDATE blog_posts SET title_en = title WHERE title_en IS NULL OR title_en = '';
    UPDATE blog_posts SET category_tr = category WHERE category_tr IS NULL OR category_tr = '';
    UPDATE blog_posts SET category_en = category WHERE category_en IS NULL OR category_en = '';
    UPDATE blog_posts SET summary_tr = summary WHERE summary_tr IS NULL;
    UPDATE blog_posts SET summary_en = summary WHERE summary_en IS NULL;
    UPDATE blog_posts SET content_tr = content WHERE content_tr IS NULL;
    UPDATE blog_posts SET content_en = content WHERE content_en IS NULL;
    UPDATE blog_posts SET published_at = COALESCE(published_at, created_at) WHERE status = 'published';
    UPDATE orders SET charge_kurus = CAST(ROUND(charge * 100) AS INTEGER) WHERE charge_kurus = 0 AND charge != 0;
    UPDATE payments SET amount_kurus = CAST(ROUND(amount * 100) AS INTEGER) WHERE amount_kurus = 0 AND amount != 0;
    UPDATE coupons SET amount_kurus = CAST(ROUND(amount * 100) AS INTEGER) WHERE amount_kurus = 0 AND amount != 0;
    UPDATE payment_notifications SET amount_kurus = CAST(ROUND(amount * 100) AS INTEGER) WHERE amount_kurus = 0 AND amount != 0;

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS referral_earnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_id INTEGER NOT NULL,
      referred_user_id INTEGER NOT NULL,
      order_id INTEGER NOT NULL,
      amount_kurus INTEGER NOT NULL CHECK(amount_kurus > 0),
      status TEXT NOT NULL DEFAULT 'available',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(order_id),
      FOREIGN KEY (referrer_id) REFERENCES users(id),
      FOREIGN KEY (referred_user_id) REFERENCES users(id),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS verification_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      purpose TEXT NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS payment_webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      external_id TEXT NOT NULL,
      payload TEXT,
      processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(provider, external_id)
    );
    CREATE TABLE IF NOT EXISTS payment_intents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      provider TEXT NOT NULL,
      merchant_oid TEXT UNIQUE NOT NULL,
      amount_kurus INTEGER NOT NULL CHECK(amount_kurus > 0),
      status TEXT NOT NULL DEFAULT 'pending',
      failure_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS ai_providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      provider_type TEXT NOT NULL CHECK(provider_type IN ('openai_compatible', 'anthropic', 'gemini')),
      api_base_url TEXT NOT NULL,
      api_key_encrypted TEXT NOT NULL,
      model TEXT NOT NULL,
      enable_web_search INTEGER NOT NULL DEFAULT 0,
      status INTEGER NOT NULL DEFAULT 1,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_user_id INTEGER NOT NULL,
      provider_id INTEGER,
      title TEXT NOT NULL DEFAULT 'Yeni sohbet',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (provider_id) REFERENCES ai_providers(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS ai_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS ai_action_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      admin_user_id INTEGER NOT NULL,
      action_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'failed')),
      result_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      executed_at DATETIME,
      FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_provider_status ON orders(provider_id, status);
    CREATE INDEX IF NOT EXISTS idx_services_category_status ON services(category_id, status);
    CREATE INDEX IF NOT EXISTS idx_services_provider_service ON services(provider_id, provider_service_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_user_status ON tickets(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_payments_user_created ON payments(user_id, created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_coupon_unique ON user_coupons(user_id, coupon_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read_at, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_payment_intents_user_created ON payment_intents(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_blog_status_published ON blog_posts(status, published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id, id);
    CREATE INDEX IF NOT EXISTS idx_ai_actions_status ON ai_action_logs(admin_user_id, status, id DESC);
    DELETE FROM categories WHERE NOT EXISTS (SELECT 1 FROM services WHERE services.category_id = categories.id);
  `);

  // Shopier: odeme icin olusturulan gecici urunun kimligi. Webhook'ta kendi
  // referansimizi tasiyacak alan olmadigi icin eslestirme bunun uzerinden yapilir.
  // (payment_intents yukaridaki blokta olusturuluyor, bu yuzden burada.)
  await addColumnIfMissing('payment_intents', 'provider_ref', 'TEXT');

  const admins = await dbAsync.all("SELECT id, password FROM users WHERE role = 'admin' AND must_change_password = 0");
  for (const admin of admins) {
    if (await bcrypt.compare('admin123', admin.password)) {
      await dbAsync.run('UPDATE users SET must_change_password = 1 WHERE id = ?', [admin.id]);
    }
  }
}

async function initDatabase() {
    await dbAsync.run('PRAGMA foreign_keys = ON');
    await dbAsync.run('PRAGMA journal_mode = WAL');
    // 1. Users Table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'client',
        balance REAL DEFAULT 0,
        api_key TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Providers Table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS providers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        api_url TEXT NOT NULL,
        api_key TEXT NOT NULL,
        balance REAL DEFAULT 0,
        status INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Categories Table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        icon TEXT DEFAULT 'folder',
        sort_order INTEGER DEFAULT 0
      )
    `);

    // 4. Services Table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER,
        provider_id INTEGER,
        provider_service_id INTEGER,
        name TEXT NOT NULL,
        rate_per_1000 REAL NOT NULL,
        min_quantity INTEGER DEFAULT 10,
        max_quantity INTEGER DEFAULT 10000,
        description TEXT,
        status INTEGER DEFAULT 1,
        refill INTEGER DEFAULT 0,
        FOREIGN KEY (category_id) REFERENCES categories(id),
        FOREIGN KEY (provider_id) REFERENCES providers(id)
      )
    `);

    // 5. Orders Table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        service_id INTEGER NOT NULL,
        provider_id INTEGER,
        provider_order_id INTEGER,
        link TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        charge REAL NOT NULL,
        start_count INTEGER DEFAULT 0,
        remains INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        refill_status TEXT DEFAULT 'none',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (service_id) REFERENCES services(id)
      )
    `);

    // 6. Payments Table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        method TEXT NOT NULL,
        status TEXT DEFAULT 'completed',
        transaction_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // 6b. Musteri yorumlari: kullanici gonderir (pending), admin onaylar;
    // admin elle de ekleyebilir (user_id NULL, display_name dolu). Yayinlanan
    // isim her zaman maskelenir (gizlilik).
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        order_id INTEGER,
        display_name TEXT,
        rating INTEGER NOT NULL,
        comment TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (order_id) REFERENCES orders(id)
      )
    `);

    // 7. Tickets Table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        subject TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // 8. Ticket Messages Table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS ticket_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        sender_role TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id)
      )
    `);

    // 9. Site Settings Table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS site_settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);

    // 10. Coupons Table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        amount REAL NOT NULL,
        max_uses INTEGER DEFAULT 100,
        used_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 11. User Coupons Table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS user_coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        coupon_id INTEGER NOT NULL,
        used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (coupon_id) REFERENCES coupons(id)
      )
    `);

    // 12. Payment Notifications Table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS payment_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        bank_name TEXT NOT NULL,
        amount REAL NOT NULL,
        sender_name TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // 13. Blog Posts Table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS blog_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        category TEXT DEFAULT 'Sosyal Medya',
        summary TEXT,
        content TEXT,
        image_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 14. Landing Supported Platforms Table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS landing_platforms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        icon TEXT NOT NULL,
        status INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0
      )
    `);

    // 14b. Satis sayfalari (platform bazli landing page'ler, iki dilli).
    // Kategorilerdeki servisler sayfada otomatik listelenir (utils/landingPages.js).
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS landing_pages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        platform_key TEXT DEFAULT 'social-media',
        category_ids TEXT DEFAULT '[]',
        image_url TEXT,
        title_tr TEXT NOT NULL,
        title_en TEXT,
        subtitle_tr TEXT,
        subtitle_en TEXT,
        seo_title_tr TEXT,
        seo_title_en TEXT,
        seo_description_tr TEXT,
        seo_description_en TEXT,
        content_tr TEXT,
        content_en TEXT,
        steps_tr TEXT DEFAULT '[]',
        steps_en TEXT DEFAULT '[]',
        faq_tr TEXT DEFAULT '[]',
        faq_en TEXT DEFAULT '[]',
        cta_text_tr TEXT,
        cta_text_en TEXT,
        related_blog_slugs TEXT DEFAULT '[]',
        sort_order INTEGER DEFAULT 0,
        views INTEGER NOT NULL DEFAULT 0,
        author_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME,
        published_at DATETIME
      )
    `);
    await dbAsync.run('CREATE INDEX IF NOT EXISTS idx_landing_pages_status ON landing_pages(status, sort_order)');

    // 15. Landing Featured Cards Table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS featured_cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        subtitle TEXT,
        highlight TEXT,
        btn_text TEXT DEFAULT 'Sipariş Ver',
        status INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0
      )
    `);

    await runMigrations();

    // Seed Data
    await seedInitialData();
}

async function seedInitialData() {
  try {
    // Check if admin user exists
    const admin = await dbAsync.get(`SELECT * FROM users WHERE role = 'admin'`);
    if (!admin) {
      const isProduction = process.env.NODE_ENV === 'production';
      const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || (isProduction ? null : 'admin12345');
      if (!initialPassword || initialPassword.length < 10) throw new Error('İlk admin hesabı için en az 10 karakterli INITIAL_ADMIN_PASSWORD zorunludur.');
      const hashedPass = await bcrypt.hash(initialPassword, 12);
      const adminApiKey = 'smm_' + crypto.randomBytes(32).toString('base64url');
      await dbAsync.run(
        `INSERT INTO users (username, email, password, role, balance, balance_kurus, api_key, must_change_password) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ['admin', 'admin@smmpanel.local', hashedPass, 'admin', 0, 0, adminApiKey, isProduction ? 0 : 1]
      );

      // Create a default client user as well
      if (!isProduction) {
        const clientPass = await bcrypt.hash('user12345', 12);
        const clientApiKey = 'smm_' + crypto.randomBytes(32).toString('base64url');
        await dbAsync.run(
          `INSERT INTO users (username, email, password, role, balance, balance_kurus, api_key) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          ['demo_user', 'user@smmpanel.local', clientPass, 'client', 250.00, 25000, clientApiKey]
        );
        console.log('Geliştirme admin ve demo müşteri hesapları oluşturuldu.');
      }
    }

    // Check if providers exist
    const provider = await dbAsync.get(`SELECT * FROM providers LIMIT 1`);
    if (!provider && process.env.NODE_ENV !== 'production') {
      const demoProvider = await dbAsync.run(
        `INSERT INTO providers (name, api_url, api_key, balance, status) VALUES (?, ?, ?, ?, ?)`,
        ['Demo Main Provider', 'http://localhost:3000/api/mock-provider', 'demo_secret_key_123', 5000.00, 1]
      );

      // Seed categories
      const categories = [
        { name: 'Instagram', icon: 'fa-instagram' },
        { name: 'TikTok', icon: 'fa-tiktok' },
        { name: 'YouTube', icon: 'fa-youtube' },
        { name: 'Telegram', icon: 'fa-paper-plane' },
        { name: 'Twitter X', icon: 'fa-x-twitter' },
        { name: 'Spotify', icon: 'fa-spotify' }
      ];

      for (const cat of categories) {
        const result = await dbAsync.run(
          `INSERT INTO categories (name, icon) VALUES (?, ?)`,
          [cat.name, cat.icon]
        );
        const catId = result.id;

        // Seed initial services
        if (cat.name === 'Instagram') {
          await dbAsync.run(
            `INSERT INTO services (category_id, provider_id, provider_service_id, name, rate_per_1000, min_quantity, max_quantity, description, refill)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [catId, demoProvider.id, 101, 'Instagram Türk Organik Takipçi [30 Gün Garantili]', 18.50, 50, 50000, 'Hızlı aktarım, %100 Türk gerçek profiller.', 1]
          );
          await dbAsync.run(
            `INSERT INTO services (category_id, provider_id, provider_service_id, name, rate_per_1000, min_quantity, max_quantity, description, refill)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [catId, demoProvider.id, 102, 'Instagram HQ Beğeni [Anlık Başlatma]', 4.20, 100, 100000, 'Tüm gönderilere uyumlu anlık yüksek kaliteli beğeni.', 0]
          );
        } else if (cat.name === 'TikTok') {
          await dbAsync.run(
            `INSERT INTO services (category_id, provider_id, provider_service_id, name, rate_per_1000, min_quantity, max_quantity, description, refill)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [catId, demoProvider.id, 201, 'TikTok Canlı Yayın İzlenme [60 Dakika]', 12.00, 100, 10000, 'Yayın boyunca aktif kalan izleyiciler.', 0]
          );
          await dbAsync.run(
            `INSERT INTO services (category_id, provider_id, provider_service_id, name, rate_per_1000, min_quantity, max_quantity, description, refill)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [catId, demoProvider.id, 202, 'TikTok Takipçi [Keşfet Etkili]', 24.00, 100, 20000, 'Yüksek kaliteli hesaplardan takipçi gönderimi.', 1]
          );
        } else if (cat.name === 'YouTube') {
          await dbAsync.run(
            `INSERT INTO services (category_id, provider_id, provider_service_id, name, rate_per_1000, min_quantity, max_quantity, description, refill)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [catId, demoProvider.id, 301, 'YouTube İzlenme [4K Para Kazanma Uyumlu]', 35.00, 1000, 500000, 'Yüksek elde tutma (High Retention) izlenmeler.', 1]
          );
        } else if (cat.name === 'Telegram') {
          await dbAsync.run(
            `INSERT INTO services (category_id, provider_id, provider_service_id, name, rate_per_1000, min_quantity, max_quantity, description, refill)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [catId, demoProvider.id, 401, 'Telegram Kanal Üyesi [Global]', 9.90, 100, 100000, 'Hızlı teslimatlı kanal ve grup üyesi.', 0]
          );
        }
      }
      console.log('✅ Seed Categories & Services initialized.');
    }

    // Seed Supported Platforms if empty
    const platformCount = await dbAsync.get(`SELECT COUNT(*) as c FROM landing_platforms`);
    if (!platformCount || platformCount.c === 0) {
      const defaultPlatforms = [
        { name: 'Facebook', icon: 'fa-facebook' },
        { name: 'Spotify', icon: 'fa-spotify' },
        { name: 'TikTok', icon: 'fa-tiktok' },
        { name: 'Discord', icon: 'fa-discord' },
        { name: 'Telegram', icon: 'fa-paper-plane' },
        { name: 'Snapchat', icon: 'fa-snapchat' },
        { name: 'Soundcloud', icon: 'fa-soundcloud' },
        { name: 'Reddit', icon: 'fa-reddit' },
        { name: 'Kick', icon: 'fa-vimeo-v' },
        { name: 'Pinterest', icon: 'fa-pinterest' }
      ];
      for (let i = 0; i < defaultPlatforms.length; i++) {
        await dbAsync.run(
          `INSERT INTO landing_platforms (name, icon, status, sort_order) VALUES (?, ?, 1, ?)`,
          [defaultPlatforms[i].name, defaultPlatforms[i].icon, i]
        );
      }
    }

    // Seed Featured Cards if empty
    const cardCount = await dbAsync.get(`SELECT COUNT(*) as c FROM featured_cards`);
    if (!cardCount || cardCount.c === 0) {
      const defaultCards = [
        { title: 'Instagram Reels İzlenme', subtitle: 'Reels', highlight: 'Keşfet' },
        { title: 'Instagram Hikaye İzlenme', subtitle: 'Hikaye', highlight: 'Erişimi' },
        { title: 'Instagram Kaydet', subtitle: 'İçerik', highlight: 'Değeri' },
        { title: 'Instagram Takipçi', subtitle: 'Hesap', highlight: 'Güçlendirme' },
        { title: 'Instagram Beğeni', subtitle: 'Gönderi', highlight: 'Etkileşimi' }
      ];
      for (let i = 0; i < defaultCards.length; i++) {
        await dbAsync.run(
          `INSERT INTO featured_cards (title, subtitle, highlight, btn_text, status, sort_order) VALUES (?, ?, ?, 'Sipariş Ver', 1, ?)`,
          [defaultCards[i].title, defaultCards[i].subtitle, defaultCards[i].highlight, i]
        );
      }
    }

    // Seed Blog Posts if empty
    const blogCount = await dbAsync.get(`SELECT COUNT(*) as c FROM blog_posts`);
    if (!blogCount || blogCount.c === 0) {
      await dbAsync.run(
        `INSERT INTO blog_posts (title, slug, category, summary, content, image_url) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          '2026 Instagram Keşfet Taktikleri: Organik Takipçi Nasıl Artırılır?',
          '2026-instagram-kesfet-taktikleri',
          'Instagram Rehberi',
          'Instagram algoritmalarını lehine çevirerek keşfet sayfasına düşmenin en etkili ve güncel yöntemleri.',
          '<p>Instagram 2026 algoritmalarında içeriğin ilk 3 saniyede izleyicinin dikkatini çekmesi ve kaydetme (bookmark) sayıları hayati önem taşıyor.</p><h2>1. Reels Videolarında İlk 3 Saniye Kuralı</h2><p>İçeriklerinizde kanca (hook) kullanarak izleyicinin durmasını sağlayın. Ardından kaliteli etkileşim paketleriyle gönderinizi destekleyin.</p>',
          'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80'
        ]
      );
      await dbAsync.run(
        `INSERT INTO blog_posts (title, slug, category, summary, content, image_url) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          'TikTok Algoritması Nasıl Çalışır? Gerçek İzlenme Alma Rehberi',
          'tiktok-algoritmasi-nasil-calisir',
          'TikTok İpuçları',
          'TikTok videolarınızın milyarlarca izlenmeye ulaşması için dikkat etmeniz gereken kritik metrikler.',
          '<p>TikTok algoritmalarında izlenme tamamlama oranı (watch time) ve canlı yayın etkileşimleri en yüksek ağırlığa sahiptir.</p>',
          'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=800&q=80'
        ]
      );
    }
  } catch (err) {
    console.error('Error seeding data:', err);
  }
}

async function clearAllDemoData(keepAdmin = true) {
  await dbAsync.run(`DELETE FROM audit_logs`);
  await dbAsync.run(`DELETE FROM notifications`);
  await dbAsync.run(`DELETE FROM referral_earnings`);
  await dbAsync.run(`DELETE FROM ticket_messages`);
  await dbAsync.run(`DELETE FROM tickets`);
  await dbAsync.run(`DELETE FROM user_coupons`);
  await dbAsync.run(`DELETE FROM payment_notifications`);
  await dbAsync.run(`DELETE FROM payment_intents`);
  await dbAsync.run(`DELETE FROM payment_webhooks`);
  await dbAsync.run(`DELETE FROM payments`);
  await dbAsync.run(`DELETE FROM orders`);
  await dbAsync.run(`DELETE FROM services`);
  await dbAsync.run(`DELETE FROM categories`);
  await dbAsync.run(`DELETE FROM providers`);
  
  if (keepAdmin) {
    await dbAsync.run(`DELETE FROM users WHERE role != 'admin'`);
  } else {
    await dbAsync.run(`DELETE FROM users`);
  }

  console.log('🧹 Tüm demo verileri başarıyla temizlendi.');
}

module.exports = { db, dbAsync, initDatabase, clearAllDemoData, withTransaction };
