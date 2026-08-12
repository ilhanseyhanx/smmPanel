// ==========================================================================
// SMM PANEL - FRONTEND APPLICATION LOGIC & ROUTER
// ==========================================================================

// --------------------------------------------------------------------------
// TOAST BİLDİRİM SİSTEMİ
// Tarayıcının engelleyici uyarı kutularının yerini alır. Sınıf dışında
// tanımlıdır; böylece `this` bağlamından bağımsız olarak her yerden çağrılır.
// --------------------------------------------------------------------------
const TOAST_ICONS = {
  success: 'fa-circle-check',
  error: 'fa-circle-exclamation',
  warning: 'fa-triangle-exclamation',
  info: 'fa-circle-info'
};

const TOAST_TITLES = {
  tr: { success: 'Başarılı', error: 'Hata', warning: 'Uyarı', info: 'Bilgi' },
  en: { success: 'Success', error: 'Error', warning: 'Warning', info: 'Info' }
};

const MAX_VISIBLE_TOASTS = 4;

function toastLocale() {
  return localStorage.getItem('smm_language') === 'en' ? 'en' : 'tr';
}

function dismissToast(toast) {
  if (!toast || toast.dataset.hiding === '1') return;
  toast.dataset.hiding = '1';
  toast.classList.add('toast-hiding');
  const remove = () => toast.remove();
  toast.addEventListener('animationend', remove, { once: true });
  // Animasyon çalışmazsa (reduced-motion vb.) yine de temizlenmesini garanti et.
  setTimeout(remove, 400);
}

function showToast(message, type = 'info', duration) {
  const container = document.getElementById('toast-container');
  const text = String(message ?? '').trim();
  if (!container || !text) return;

  const kind = TOAST_ICONS[type] ? type : 'info';
  // Hata mesajları okumak için daha uzun süre ekranda kalır.
  const visibleFor = duration ?? (kind === 'error' ? 7000 : 4200);

  while (container.children.length >= MAX_VISIBLE_TOASTS) {
    container.firstElementChild.remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${kind}`;
  toast.setAttribute('role', kind === 'error' ? 'alert' : 'status');

  const icon = document.createElement('div');
  icon.className = 'toast-icon';
  icon.innerHTML = `<i class="fa-solid ${TOAST_ICONS[kind]}"></i>`;

  const body = document.createElement('div');
  body.className = 'toast-body';
  const title = document.createElement('div');
  title.className = 'toast-title';
  title.textContent = TOAST_TITLES[toastLocale()][kind];
  const messageEl = document.createElement('div');
  // textContent kullanılır: mesaj içeriği asla HTML olarak yorumlanmaz.
  messageEl.textContent = text;
  body.append(title, messageEl);

  const close = document.createElement('button');
  close.className = 'toast-close';
  close.type = 'button';
  close.setAttribute('aria-label', toastLocale() === 'en' ? 'Dismiss' : 'Kapat');
  close.innerHTML = '<i class="fa-solid fa-xmark"></i>';

  const progress = document.createElement('div');
  progress.className = 'toast-progress';
  progress.style.animationDuration = `${visibleFor}ms`;

  toast.append(icon, body, close, progress);
  container.appendChild(toast);

  let timer = setTimeout(() => dismissToast(toast), visibleFor);
  close.addEventListener('click', () => { clearTimeout(timer); dismissToast(toast); });
  // Fare üstündeyken sayaç durur, çekilince kaldığı yerden devam eder.
  toast.addEventListener('mouseenter', () => {
    clearTimeout(timer);
    progress.style.animationPlayState = 'paused';
  });
  toast.addEventListener('mouseleave', () => {
    progress.style.animationPlayState = 'running';
    timer = setTimeout(() => dismissToast(toast), 1500);
  });

  return toast;
}

// --------------------------------------------------------------------------
// ONAY / GİRDİ DİYALOGLARI
// Tarayıcının engelleyici confirm() ve prompt() kutularının yerini alır.
// Promise döndürürler; çağrı yerlerinde `await` ile kullanılır.
// --------------------------------------------------------------------------
const DIALOG_LABELS = {
  tr: { confirm: 'Onayla', cancel: 'Vazgeç', ok: 'Tamam', title: 'Emin misiniz?', required: 'Bu alan boş bırakılamaz.' },
  en: { confirm: 'Confirm', cancel: 'Cancel', ok: 'OK', title: 'Are you sure?', required: 'This field cannot be empty.' }
};

function openDialog({ title, message, icon, danger = false, confirmText, cancelText, input = null }) {
  const labels = DIALOG_LABELS[toastLocale()];

  return new Promise(resolve => {
    const previousFocus = document.activeElement;

    const backdrop = document.createElement('div');
    backdrop.className = 'dialog-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');

    const card = document.createElement('div');
    card.className = `dialog-card${danger ? ' dialog-danger' : ''}`;

    const iconEl = document.createElement('div');
    iconEl.className = 'dialog-icon';
    iconEl.innerHTML = `<i class="fa-solid ${icon || (danger ? 'fa-triangle-exclamation' : 'fa-circle-question')}"></i>`;

    const titleEl = document.createElement('div');
    titleEl.className = 'dialog-title';
    titleEl.textContent = title || labels.title;

    const messageEl = document.createElement('div');
    messageEl.className = 'dialog-message';
    // textContent: mesaj içeriği asla HTML olarak yorumlanmaz.
    messageEl.textContent = message || '';

    card.append(iconEl, titleEl, messageEl);

    let field = null;
    let errorEl = null;
    if (input) {
      field = document.createElement('input');
      field.className = 'dialog-input';
      field.type = input.type || 'text';
      field.placeholder = input.placeholder || '';
      field.value = input.value || '';
      if (input.inputMode) field.inputMode = input.inputMode;
      errorEl = document.createElement('div');
      errorEl.className = 'dialog-error';
      card.append(field, errorEl);
    }

    const actions = document.createElement('div');
    actions.className = 'dialog-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-outline';
    cancelBtn.textContent = cancelText || labels.cancel;

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = `btn ${danger ? 'dialog-confirm-danger' : 'btn-primary'}`;
    confirmBtn.textContent = confirmText || (input ? labels.ok : labels.confirm);

    actions.append(cancelBtn, confirmBtn);
    card.append(actions);
    backdrop.append(card);
    document.body.appendChild(backdrop);

    // Diyalog açıkken arka planın kaymasını engelle.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    setTimeout(() => (field || confirmBtn).focus(), 60);

    let settled = false;
    const close = value => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = previousOverflow;
      backdrop.classList.add('dialog-closing');
      const cleanup = () => {
        backdrop.remove();
        if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
      };
      backdrop.addEventListener('animationend', cleanup, { once: true });
      setTimeout(cleanup, 300);
      resolve(value);
    };

    const accept = () => {
      if (!input) return close(true);
      const value = field.value.trim();
      if (input.required !== false && !value) {
        errorEl.textContent = labels.required;
        field.focus();
        return;
      }
      // İsteğe bağlı doğrulama: hata metni döndürürse diyalog açık kalır.
      const problem = input.validate ? input.validate(value) : null;
      if (problem) {
        errorEl.textContent = problem;
        field.focus();
        return;
      }
      close(value);
    };

    const reject = () => close(input ? null : false);

    confirmBtn.addEventListener('click', accept);
    cancelBtn.addEventListener('click', reject);
    backdrop.addEventListener('mousedown', event => { if (event.target === backdrop) reject(); });

    function onKey(event) {
      if (event.key === 'Escape') { event.preventDefault(); reject(); }
      else if (event.key === 'Enter' && (!input || document.activeElement === field)) { event.preventDefault(); accept(); }
    }
    document.addEventListener('keydown', onKey, true);
  });
}

// confirm() karşılığı: Promise<boolean>
function confirmDialog(message, options = {}) {
  return openDialog({ message, ...options });
}

// prompt() karşılığı: Promise<string|null> (iptal edilirse null)
function promptDialog(message, options = {}) {
  const { title, icon, danger, confirmText, cancelText, ...inputOptions } = options;
  return openDialog({
    message,
    title: title || (toastLocale() === 'en' ? 'Information needed' : 'Bilgi gerekli'),
    icon: icon || 'fa-pen-to-square',
    danger,
    confirmText,
    cancelText,
    input: inputOptions
  });
}

class SmmApp {
  constructor() {
    this.currentUser = null;
    this.allCategories = [];
    this.allServices = [];
    this.currentView = 'landing';
    this.locale = localStorage.getItem('smm_language') === 'en' ? 'en' : 'tr';
    this.authMode = 'login'; // 'login' or 'register'
    this.selectedPlatform = 'all';
    this.servicesPage = 1;
    this.servicesPerPage = 50;
    this.referralCode = null;

    this.debouncedFilterServicesTable = this.debounce(() => this.filterServicesTable(), 180);
    this.debouncedFilterExplorerTable = this.debounce(() => this.filterExplorerTable(), 180);
    this.debouncedFilterAdminAddedServices = this.debounce(() => this.filterAdminAddedServicesTable(), 180);

    // Oturum kontrolü asenkron tamamlanır; bekleyen işlemler bu sözü bekleyebilir.
    this.ready = this.init();
  }

  debounce(fn, delay = 180) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  t(key) {
    const dictionary = {
      tr: {
        'nav.home': 'Ana Sayfa', 'nav.services': 'Hizmetler', 'nav.order': 'Sipariş Ver',
        'nav.orders': 'Siparişlerim', 'nav.funds': 'Bakiye Yükle', 'nav.support': 'Destek',
        read_more: 'Devamını Oku', no_blog: 'Henüz yayınlanmış bir blog makalesi bulunmuyor.',
        standard: 'Standart', guaranteed: 'Garantili', order_now: 'Sipariş Ver',
        previous: 'Önceki', next: 'Sonraki', services_shown: 'servisten'
        , 'home.badge': 'Otomatik SMM Sosyal Medya Hizmetleri', 'home.start': 'Hizmetleri Keşfet', 'home.explore': 'Fiyatları İncele',
        'home.orders': 'Tamamlanan Sipariş', 'home.active_services': 'Aktif Servis Sayısı', 'home.users': 'Aktif Kullanıcı Sayısı',
        'home.starting_price': 'Başlayan Fiyatlar', 'home.happy_customers': 'Mutlu Müşteri',
        'home.completed_orders': 'Tamamlanan Siparişler', 'home.order_frequency': 'Sipariş Sıklığı',
        'services.title': '📋 Tüm Hizmetler ve Fiyat Listesi', 'services.subtitle': 'Anlık teslimatlı güncel servislerimizi inceleyin.',
        'blog.title': '📰 SMM & Sosyal Medya Rehberi', 'blog.subtitle': 'Google sıralamanızı yükseltecek, hesabınızı organik ve hızlı büyütecek en güncel tüyo ve makaleler.',
        'blog.back': 'Tüm Makalelere Dön'
      },
      en: {
        'nav.home': 'Home', 'nav.services': 'Services', 'nav.order': 'New Order',
        'nav.orders': 'My Orders', 'nav.funds': 'Add Funds', 'nav.support': 'Support',
        read_more: 'Read More', no_blog: 'No published blog posts yet.',
        standard: 'Standard', guaranteed: 'Guaranteed', order_now: 'Order Now',
        previous: 'Previous', next: 'Next', services_shown: 'services'
        , 'home.badge': 'Automated SMM Social Media Services', 'home.start': 'Explore Services', 'home.explore': 'View Pricing',
        'home.orders': 'Completed Orders', 'home.active_services': 'Active Services', 'home.users': 'Active Users',
        'home.starting_price': 'Starting Prices', 'home.happy_customers': 'Happy Customers',
        'home.completed_orders': 'Completed Orders', 'home.order_frequency': 'Order Frequency',
        'services.title': '📋 All Services and Price List', 'services.subtitle': 'Browse our current instant-delivery services.',
        'blog.title': '📰 SMM & Social Media Guide', 'blog.subtitle': 'Current guides and articles to grow your account quickly and improve its visibility.',
        'blog.back': 'Back to All Articles'
      }
    };
    return dictionary[this.locale]?.[key] || dictionary.tr[key] || key;
  }

  ui(tr, en) {
    return this.locale === 'en' ? en : tr;
  }

  localizeTicketSubject(subject = '') {
    if (this.locale !== 'en') return subject;
    const translations = {
      'Sipariş Hatası / İptal Talebi': 'Order Error / Cancellation Request',
      'Telafi / Düşüş Bildirimi': 'Refill / Drop Report',
      'Bakiye / Ödeme Sorunu': 'Balance / Payment Issue',
      'Diğer Sorular': 'Other Questions'
    };
    return Object.entries(translations).reduce(
      (result, [tr, en]) => result.startsWith(tr) ? result.replace(tr, en) : result,
      String(subject)
    );
  }

  localizeTicketStatus(status = '') {
    const normalized = String(status).toLowerCase();
    const statuses = {
      open: this.ui('Açık', 'Open'),
      replied: this.ui('Yanıtlandı', 'Replied'),
      closed: this.ui('Kapandı', 'Closed')
    };
    return statuses[normalized] || status;
  }

  applyTranslations() {
    document.title = this.locale === 'en'
      ? 'SMM Panel - Automated Social Media Growth Panel'
      : 'SMM Panel - Otomatik Sosyal Medya Büyüme Paneli';
    const localizedMeta = {
      description: this.ui(
        'Sosyal medya hizmetlerini, siparişlerini ve bakiyeni güvenli biçimde yönetebileceğin otomatik SMM paneli.',
        'An automated SMM panel where you can securely manage social media services, orders, and account balance.'
      ),
      'og:title': this.ui('SMM Panel - Sosyal Medya Hizmetleri', 'SMM Panel - Social Media Services'),
      'og:description': this.ui(
        'Instagram, TikTok, YouTube ve diğer platformlar için hızlı sosyal medya hizmetleri.',
        'Fast social media services for Instagram, TikTok, YouTube, and other platforms.'
      )
    };
    document.querySelector('meta[name="description"]')?.setAttribute('content', localizedMeta.description);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', localizedMeta['og:title']);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', localizedMeta['og:description']);
    document.querySelectorAll('[data-i18n]').forEach(element => {
      element.textContent = this.t(element.dataset.i18n);
    });
    const english = {
      'Giriş Yap': 'Login', 'Kayıt Ol': 'Register', 'Çıkış Yap': 'Logout', 'Ana Sayfa': 'Home',
      'Hizmetler': 'Services', 'Sipariş Ver': 'Order Now', 'Siparişlerim': 'My Orders', 'Bakiye Yükle': 'Add Funds',
      'Destek': 'Support', 'Admin Panel': 'Admin Panel', 'Tüm Hizmetler': 'All Services', 'Diğer': 'Other',
      'Servis Adı': 'Service Name', '1000 Adet Fiyatı': 'Price per 1000', 'Min / Max Limit': 'Min / Max Limit',
      'Garantili': 'Guaranteed', 'İşlem': 'Action', 'İşlemler': 'Actions', 'Durum': 'Status', 'Miktar': 'Quantity',
      'Tutar': 'Amount', 'Tarih': 'Date', 'Kategori': 'Category', 'Tüm Alt Kategoriler': 'All Subcategories',
      'Sipariş Geçmişim': 'My Order History', 'Yeni Sipariş Oluştur': 'Create New Order', 'Servis Seçin': 'Select a Service',
      'Hedef Bağlantı': 'Target URL', 'Minimum Miktar': 'Minimum Quantity', 'Maksimum Miktar': 'Maximum Quantity',
      'Toplam Tutar': 'Total Amount', 'Siparişi Oluştur': 'Create Order', 'Kupon Kodu': 'Coupon Code',
      'Kuponu Kullan': 'Redeem Coupon', 'Destek Taleplerim': 'My Support Tickets', 'Yeni Destek Talebi': 'New Support Ticket',
      'Konu': 'Subject', 'Mesaj': 'Message', 'Gönder': 'Send', 'Tüm Makalelere Dön': 'Back to All Articles',
      'Hesabın var mı?': 'Already have an account?', 'Hesabın yok mu?': "Don't have an account?",
      'Kullanıcı Adı': 'Username', 'E-posta': 'Email', 'Şifre': 'Password', 'Şifremi unuttum': 'Forgot password',
      'Güvenli oturum': 'Secure session', 'Havale / EFT': 'Bank Transfer', 'Ödeme Bildirimi Gönder': 'Send Payment Notice'
      , 'Başlayan Fiyatlar': 'Starting Prices', 'Mutlu Müşteri': 'Happy Customers', 'Tamamlanan Siparişler': 'Completed Orders',
      'Sipariş Sıklığı': 'Order Frequency', 'En Popüler Servislerimiz': 'Our Most Popular Services',
      'Sosyal Medya Büyümenizi': 'Grow Your Social Media',
      'Otomatik İlerleterek Zirveye Taşıyın': 'Automatically and Reach the Top',
      'Instagram, TikTok, YouTube ve diğer tüm platformlar için anlık teslimatlı, yüksek kaliteli ve uygun fiyatlı takipçi, beğeni ve izlenme servisleri.': 'Fast, high-quality, affordable follower, like, and view services for Instagram, TikTok, YouTube, and all other platforms.',
      'Bahar Kampanyası: Instagram ve TikTok Takipçi servislerinde %20 İndirim ve Anlık Teslimat!': 'Spring Campaign: 20% off Instagram and TikTok follower services with instant delivery!',
      'Öne Çıkan Sosyal Medya Hizmet Paketleri': 'Featured Social Media Service Packages', 'Min / Max': 'Min / Max',
      'Yeni Sipariş Ver': 'Place a New Order', 'Kategori Seçin': 'Select Category',
      'Servis açıklaması burada görünecektir.': 'The service description will appear here.', '1000 Adet:': 'Per 1000:',
      'Bağlantı (Link / Kullanıcı Adı)': 'Link (URL / Username)', 'Kademeli Gönderim (Drip-Feed)': 'Drip-Feed Delivery',
      'Tekrar Sayısı (Runs)': 'Number of Runs', 'Aralık (Dakika)': 'Interval (Minutes)',
      'Siparişi Onayla ve Gönder': 'Confirm and Submit Order', 'Mevcut Bakiyeniz': 'Current Balance',
      'VIP Statünüz': 'Your VIP Status', 'Toplam Harcama:': 'Total Spending:', '2FA Güvenliğini Aç': 'Enable 2FA Security',
      'E-postamı Doğrula': 'Verify My Email', 'Bilgilendirme': 'Information',
      'Siparişler otomatik olarak işleme alınır.': 'Orders are processed automatically.',
      'Gizli hesaplara gönderim yapılamaz. Hesabınızı açık konuma getirin.': 'Orders cannot be delivered to private accounts. Make your account public.',
      'İptal olan sipariş tutarı anında bakiyenize iade edilir.': 'Canceled order amounts are refunded to your balance immediately.',
      'Tüm Ülkeler': 'All Countries', 'Türkiye / Türk': 'Turkey / Turkish', 'ABD / Amerika': 'USA / America',
      'Almanya': 'Germany', 'İngiltere': 'United Kingdom', 'Rusya': 'Russia', 'Hindistan': 'India',
      'Global / Karışık': 'Global / Mixed', 'Servis': 'Service', 'Bağlantı': 'Link',
      'Bakiye Yükle & Promosyon Kuponları': 'Add Funds & Promotional Coupons',
      'Kredi Kartı / Otomatik Ödeme': 'Credit Card / Automatic Payment', 'Ödeme Yöntemi Seçin': 'Select Payment Method',
      'Kredi Kartı / Banka Kartı (PayTR)': 'Credit / Debit Card (PayTR)', 'Yüklenecek Miktar (₺)': 'Amount to Add (₺)',
      'Güvenli Bakiye Yükle': 'Securely Add Funds', 'Promosyon Kuponu Kullan': 'Redeem Promotional Coupon',
      'Elinizdeki promosyon veya hediye kupon kodunu yazarak anında ücretsiz bakiye kazanın!': 'Enter your promotional or gift coupon code to receive free balance instantly!',
      'Kuponu Kullan ve Bakiyeyi Al': 'Redeem Coupon and Add Balance', 'Banka Havalesi / Papara Ödeme Bildirimi': 'Bank Transfer / Papara Payment Notice',
      'Banka hesabımıza veya Papara adresimize ödeme yaptıktan sonra aşağıdaki formu doldurarak bildirim gönderin. Bakiyeniz dakikalar içinde onaylanacaktır.': 'After paying to our bank account or Papara address, submit the form below. Your balance will be reviewed within minutes.',
      'Banka / Ödeme Yöntemi': 'Bank / Payment Method', 'Gönderilen Tutar (₺)': 'Amount Sent (₺)',
      'Gönderen Adı Soyadı': 'Sender Full Name', 'Ödeme Bildirimini Gönder': 'Submit Payment Notice',
      'Davet Et & Kazan (Referans Sistemi)': 'Invite & Earn (Referral Program)',
      'Özel davet linkinizle arkadaşlarınızı davet edin, yaptıkları her bakiye yüklemesinden %5 nakit komisyon kazanın!': 'Invite friends with your personal link and earn 5% cash commission from every balance top-up they make!',
      'Kopyala': 'Copy', 'Biriken Komisyon:': 'Accrued Commission:', 'Bakiyeme Aktar': 'Transfer to My Balance',
      'Yeni Bilet Oluştur': 'Create New Ticket', 'Telegram Canlı Destek Hattı': 'Telegram Live Support',
      'Acil sipariş takibi veya sorularınız için Telegram temsilcimizle 7/24 birebir doğrudan sohbet edin.': 'Chat directly with our Telegram representative 24/7 for urgent order tracking or questions.',
      "Telegram'dan Yaz": 'Message on Telegram', 'SMM Reseller API Dokümantasyonu (v2)': 'SMM Reseller API Documentation (v2)',
      'Size Özel API Anahtarı': 'Your Personal API Key',
      'Kendi SMM panelinizden sitemize otomatik sipariş göndermek için aşağıdaki benzersiz API Anahtarınızı kullanın.': 'Use your unique API key below to send automatic orders from your own SMM panel.',
      'API Endpoint & Parametreler': 'API Endpoint & Parameters', '1. Servis Listesini Çekme': '1. Retrieve Service List',
      '2. Yeni Sipariş Gönderme': '2. Submit a New Order', '3. Sipariş Durumu Sorgulama': '3. Check Order Status',
      'Blog Başlığı': 'Blog Title', 'Rehber': 'Guide', 'Tüm Kategoriler': 'All Categories',
      'Açık': 'Open', 'Kapalı': 'Closed', 'Bekliyor': 'Pending', 'Tamamlandı': 'Completed',
      'Siber Mor': 'Cyber Purple', 'Altın Lüks': 'Luxury Gold', 'Zümrüt': 'Emerald',
      'E-Posta Adresi': 'Email Address', 'Doğrulama Kodu': 'Verification Code',
      'Giriş yap ve sosyal medya siparişlerini saniyeler içinde yönet.': 'Sign in and manage your social media orders in seconds.',
      'Ücretsiz Hesabını Aç': 'Create Your Free Account', 'Ücretsiz hesabını aç': 'Create your free account',
      'Hesabına Giriş Yap': 'Sign In to Your Account', 'Hesabına giriş yap': 'Sign in to your account',
      'Ücretsiz Kayıt Ol': 'Register for Free', 'Ücretsiz hesap aç': 'Create a free account',
      'Kaydol, bakiyeni yükle ve hemen sipariş vermeye başla.': 'Register, add funds, and start placing orders right away.',
      'Kullanıcı bilgilerini girerek paneline güvenle eriş.': 'Enter your account details to access your panel securely.',
      'Kullanıcı adını ve şifreni girerek paneline bağlan.': 'Enter your username and password to access your panel.',
      'Sosyal medya pazarlama paneli': 'Social media marketing panel',
      'Sosyal medyada': 'The fastest way to', 'büyümenin en hızlı yolu': 'grow on social media',
      'SMM Panelimiz; Instagram, TikTok, YouTube ve X için takipçi, beğeni, görüntülenme ve daha fazlasını anında teslimat ve şeffaf fiyatlarla sunan profesyonel bir sosyal medya panelidir. Kaydol, bakiyeni yükle ve saniyeler içinde ilk siparişini ver.': 'Our professional SMM panel provides followers, likes, views, and more for Instagram, TikTok, YouTube, and X with fast delivery and transparent pricing. Register, add funds, and place your first order in seconds.',
      'Ücretsiz kaydol': 'Register for free', 'Bakiyeni yükle': 'Add funds', 'Sipariş ver': 'Place an order',
      'Dakikalar içinde hesabını oluştur, kart bilgisi gerekmez.': 'Create your account in minutes; no card details required.',
      'Kart, kripto veya havaleyle güvenle bakiye ekle.': 'Add funds securely by card, crypto, or bank transfer.',
      'Servisi seç, bağlantını gir ve gönder; teslimat başlasın.': 'Choose a service, enter your link, and submit to start delivery.',
      'Binlerce servis tek panelde': 'Thousands of services in one panel',
      'Instagram, TikTok, YouTube ve X için binlerce farklı paket kategorilere ayrılmış katalogda.': 'Browse thousands of categorized packages for Instagram, TikTok, YouTube, and X.',
      'Anında teslimat': 'Fast delivery', 'Şeffaf, uygun fiyat': 'Transparent, affordable pricing',
      'Çoğu servis saniyeler içinde başlar; ortalama başlama süresini önceden gör.': 'Most services start within seconds; see the estimated start time in advance.',
      'Gizli ücret yok. Net 1000 adet fiyatlarıyla dilediğin kadar sipariş ver.': 'No hidden fees. Order any amount with clear per-1000 pricing.',
      'Güvenli ödeme + 7/24 destek': 'Secure payments + 24/7 support',
      'Kart, kripto ve havaleyle bakiye yükle; sorularına anında yanıt al.': 'Add funds by card, crypto, or bank transfer and get quick answers to your questions.',
      "Anında teslimat • Şeffaf fiyat • Güvenli ödeme • Bayi API'si • 7/24 destek": 'Fast delivery • Transparent pricing • Secure payments • Reseller API • 24/7 support',
      'Yeni Destek Bileti Oluştur': 'Create a New Support Ticket', 'Konu / Destek Türü': 'Subject / Support Type',
      'Sipariş Hatası / İptal Talebi': 'Order Error / Cancellation Request',
      'Telafi / Düşüş Bildirimi': 'Refill / Drop Report', 'Bakiye / Ödeme Sorunu': 'Balance / Payment Issue',
      'Diğer Sorular': 'Other Questions', 'Sipariş ID (İsteğe Bağlı)': 'Order ID (Optional)',
      'Mesajınız': 'Your Message', 'Bileti Gönder': 'Submit Ticket',
      'Destek Bileti Detayı': 'Support Ticket Details', 'Cevabınızı yazın...': 'Write your reply...'
      , 'Kayıt ol': 'Register', 'Giriş yap': 'Login', 'Zaten hesabın var mı?': 'Already have an account?',
      // Değerler sembol öneki OLMADAN yazılır: TreeWalker öneki
      // (ör. "#", "©") çeviriye kendisi ekler, aksi halde iki kez çıkar.
      '#102 • Açık': '102 • Open',

      // --- Neo-brutalist açılış sayfası ---------------------------------
      // Not: <br> ile bölünen başlıklar ayrı metin düğümleri oluşturur,
      // bu yüzden her satır ayrı bir anahtar olarak çevrilir.
      'SOSYAL BÜYÜME PLATFORMU': 'SOCIAL GROWTH PLATFORM',
      'AKIŞTA KAL.': 'STAY IN FEED.', 'ÖNDE': 'STAY', 'KAL.': 'AHEAD.',
      'Instagram, TikTok, YouTube ve diğer platformlarda görünürlüğünü saniyeler içinde artır.':
        'Boost your visibility on Instagram, TikTok, YouTube and more within seconds.',
      'kullanıcı büyümeyi SMMJET ile hızlandırıyor.': 'users accelerate their growth with SMMJET.',
      '6 saniyede başlar!': 'Starts in 6 seconds!',

      // Hero'daki sipariş makinesi
      'SİPARİŞ MAKİNESİ': 'ORDER MACHINE', 'HAZIR': 'READY',
      'HİZMET': 'SERVICE', 'MİKTAR': 'QUANTITY', 'TAHMİNİ FİYAT': 'ESTIMATED PRICE',
      'SİPARİŞ VER': 'PLACE ORDER', 'Instagram Takipçi': 'Instagram Followers',

      // Canlı veriler bölümü
      '02 / CANLI VERİLER': '02 / LIVE DATA',
      'Rakamlarla': 'SMMJET', 'SMMJET.': 'BY THE NUMBERS.',
      'Panelde gördüğün tüm rakamlar doğrudan sistemden gelir. Süs değil, gerçek performans.':
        'Every figure here comes straight from the system. Not decoration, real performance.',

      // Servis mozaiği
      'PLANLA': 'PLAN', 'YAYINLA': 'PUBLISH', 'BÜYÜT': 'GROW',
      'TRENDİ': 'CATCH THE', 'YAKALA': 'TREND',
      'VİDEONU': 'FEATURE YOUR', 'ÖNE ÇIKAR': 'VIDEO',
      'TÜM': 'ALL', 'ARAÇLAR': 'TOOLS',
      'Instagram hizmetleri →': 'Instagram services →',
      'TikTok hizmetleri →': 'TikTok services →',
      'YouTube hizmetleri →': 'YouTube services →',
      'Hepsini keşfet →': 'Explore all →',

      // Canlı servisler + nasıl çalışır
      '03 / CANLI SERVİSLER': '03 / LIVE SERVICES',
      'BUGÜN NE': "WHAT'S TRENDING", 'YÜKSELİYOR?': 'TODAY?',
      '04 / NASIL ÇALIŞIR?': '04 / HOW IT WORKS?',
      'Hizmeti seç': 'Pick a service',
      'İhtiyacına uygun platformu ve servisi bul.': 'Find the platform and service that fits your needs.',
      'Bilgileri gir': 'Enter the details',
      'Kullanıcı adı veya bağlantını ekle.': 'Add your username or link.',
      'Sonucu izle': 'Watch the results',
      'Siparişini panelden anlık takip et.': 'Track your order live from the panel.',

      // Güven bandı
      '7/24 DESTEK': '24/7 SUPPORT', 'Gerçek insanlar, hızlı çözümler.': 'Real people, fast solutions.',
      'GÜVENLİ ÖDEME': 'SECURE PAYMENT', 'Korunan ödeme altyapısı.': 'Protected payment infrastructure.',
      'ANLIK BAŞLANGIÇ': 'INSTANT START', 'Beklemeden harekete geç.': 'Get moving without waiting.',

      // Öne çıkanlar + kapanış
      '05 / ÖNE ÇIKANLAR': '05 / FEATURED',
      'SENİN İÇİN': 'PICKED', 'SEÇTİK.': 'FOR YOU.',
      'HAZIR MISIN?': 'READY?', 'SIRADAKİ': 'THE NEXT', 'BÜYÜME SENİN.': 'GROWTH IS YOURS.',
      'ÜCRETSİZ HESAP OLUŞTUR': 'CREATE A FREE ACCOUNT',

      // Sipariş formu (iki nokta üst üste ayrı bir anahtar sayılır)
      'Toplam Tutar:': 'Total Amount:',
      // VIP rozetinin HTML'deki başlangıç değeri; giriş yapılınca JS günceller.
      'BRONZ': 'BRONZE',

      // Alt bilgi
      'Hızlı. Güvenli. Ölçülebilir.': 'Fast. Secure. Measurable.',
      'Sosyal büyümede yeni standart.': 'The new standard in social growth.',
      '© 2026 SMMJET. Tüm hakları saklıdır.': '2026 SMMJET. All rights reserved.'
    };
    const placeholderEnglish = {
      '🔍 Servis ara...': '🔍 Search services...', 'Tüm Alt Kategoriler': 'All Subcategories',
      'Kullanıcı adınız': 'Your username', 'E-posta adresiniz': 'Your email', 'Şifreniz': 'Your password',
      'Hedef gönderi veya profil bağlantısı': 'Target post or profile URL', 'Cevabınızı yazın...': 'Write your reply...'
      , 'https://instagram.com/kullaniciadi veya post linki': 'https://instagram.com/username or post URL',
      'Örn: 1000': 'e.g. 1000', 'Örn: 100': 'e.g. 100', 'Örn: HOSGELDIN20': 'e.g. WELCOME20',
      'Örn: 150': 'e.g. 150', 'Örn: Ahmet Yılmaz': 'e.g. John Smith',
      'Kullanıcı adınızı yazın': 'Enter your username', 'ornek@domain.com': 'example@domain.com',
      'Örn: #1042': 'e.g. #1042',
      'Lütfen yaşadığınız sorunu detaylıca açıklayın...': 'Please describe your issue in detail...'
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (['SCRIPT', 'STYLE', 'TEXTAREA'].includes(node.parentElement?.tagName)) continue;
      if (node.__smmOriginalText === undefined) node.__smmOriginalText = node.nodeValue;
      const original = node.__smmOriginalText;
      const trimmed = original.trim();
      const symbolPrefix = trimmed.match(/^([^\p{L}\p{N}]+)/u)?.[0] || '';
      const lookupKey = english[trimmed] ? trimmed : trimmed.slice(symbolPrefix.length);
      if (!english[lookupKey]) continue;
      const leading = original.match(/^\s*/)?.[0] || '';
      const trailing = original.match(/\s*$/)?.[0] || '';
      node.nodeValue = this.locale === 'en' ? `${leading}${symbolPrefix}${english[lookupKey]}${trailing}` : original;
    }
    document.querySelectorAll('[placeholder]').forEach(field => {
      if (!field.dataset.placeholderTr) field.dataset.placeholderTr = field.getAttribute('placeholder');
      const original = field.dataset.placeholderTr;
      field.setAttribute('placeholder', this.locale === 'en' ? (placeholderEnglish[original] || original) : original);
    });
    document.querySelectorAll('[title]').forEach(element => {
      if (!element.dataset.titleTr) element.dataset.titleTr = element.getAttribute('title');
      const original = element.dataset.titleTr;
      element.setAttribute('title', this.locale === 'en' ? (english[original] || original) : original);
    });
    document.querySelectorAll('#view-api-docs pre').forEach(block => {
      if (!block.dataset.contentTr) block.dataset.contentTr = block.textContent;
      block.textContent = this.locale === 'en'
        ? block.dataset.contentTr.replaceAll('/kullaniciadi', '/username')
        : block.dataset.contentTr;
    });
  }

  async setLanguage(locale) {
    const selectedOrderCategory = document.getElementById('order-category-select')?.value;
    const selectedOrderService = document.getElementById('order-service-select')?.value;
    this.locale = locale === 'en' ? 'en' : 'tr';
    localStorage.setItem('smm_language', this.locale);
    document.documentElement.lang = this.locale;
    this.applyTranslations();
    await this.loadServicesData();
    // VIP rozeti gibi JS ile üretilen metinler yalnızca yeniden çizilince
    // yeni dile geçer.
    if (this.currentUser) await this.loadAccountSummary();
    if (this.currentView === 'blog') await this.loadBlogPosts();
    else if (this.currentView === 'blog-detail' && this.currentBlogSlug) await this.loadBlogPostDetail(this.currentBlogSlug);
    else if (this.currentView === 'services') this.renderFullServicesTable();
    else if (this.currentView === 'landing') this.renderLandingServices();
    else if (this.currentView === 'orders' && this.currentUser) await this.loadUserOrders();
    else if (this.currentView === 'tickets' && this.currentUser) await this.loadUserTickets();
    else if (this.currentView === 'new-order') {
      this.populateOrderCategories();
      const categorySelect = document.getElementById('order-category-select');
      if (categorySelect && [...categorySelect.options].some(option => option.value === selectedOrderCategory)) {
        categorySelect.value = selectedOrderCategory;
        this.onCategoryChange();
      }
      const serviceSelect = document.getElementById('order-service-select');
      if (serviceSelect && [...serviceSelect.options].some(option => option.value === selectedOrderService)) {
        serviceSelect.value = selectedOrderService;
        this.onServiceChange();
      }
    }

    if (document.getElementById('modal-auth')?.classList.contains('active')) this.showAuthModal(this.authMode);
    if (this.currentView === 'auth') this.showAuthPage(this.authMode);
    this.applyTranslations();
  }

  formatServicePrice(service) {
    const usd = Number(service?.rate_per_1000_usd_cents || 0) / 100;
    if (this.locale === 'en' && usd > 0) return `$${usd.toFixed(2)} / ₺${Number(service?.rate_per_1000 || 0).toFixed(2)}`;
    return `₺${Number(service?.rate_per_1000 || 0).toFixed(2)}`;
  }

  async init() {
    this.loadSavedTheme();
    const languageSelector = document.getElementById('language-selector');
    if (languageSelector) languageSelector.value = this.locale;
    document.documentElement.lang = this.locale;
    this.applyTranslations();
    // Check existing auth token
    if (API.getToken()) {
      try {
        const res = await API.getMe();
        this.currentUser = res.user;
        this.updateUserHeader();
        await this.loadAccountSummary();
      } catch (err) {
        API.clearToken();
        this.currentUser = null;
      }
    }

    // Load services data
    await this.loadServicesData();

    // Route based on URL hash or default to landing
    const hash = window.location.hash.replace('#', '') || 'landing';
    const [route, query = ''] = hash.split('?');
    this.referralCode = new URLSearchParams(query).get('ref');
    if (route.startsWith('blog/')) await this.loadBlogPostDetail(decodeURIComponent(route.slice(5)));
    else if (route === 'register') this.showAuthPage('register');
    else if (route === 'reset-password') await this.completePasswordReset(new URLSearchParams(query).get('token'));
    else if (route === 'verify-email') await this.completeEmailVerification(new URLSearchParams(query).get('token'));
    else {
      this.navigate(route);
      const linkedServiceId = Number(new URLSearchParams(query).get('service'));
      if (route === 'services' && linkedServiceId) this.openServiceFromBlog(linkedServiceId, false);
    }
  }

  updateUserHeader() {
    const badge = document.getElementById('user-header-badge');
    const authNavs = document.querySelectorAll('.auth-required');
    const adminNavs = document.querySelectorAll('.admin-only');

    if (this.currentUser) {
      badge.innerHTML = `
        <div class="balance-pill"><i class="fa-solid fa-wallet"></i> ₺${parseFloat(this.currentUser.balance).toFixed(2)}</div>
        <span style="font-weight: 600; color: #fff; font-size: 0.9rem;">
          <i class="fa-solid fa-user-circle"></i> ${this.currentUser.username}
        </span>
        <button class="btn btn-outline btn-sm" onclick="app.logout()" title="Çıkış Yap">
          <i class="fa-solid fa-right-from-bracket"></i>
        </button>
      `;

      authNavs.forEach(el => el.style.display = 'block');

      if (this.currentUser.role === 'admin') {
        adminNavs.forEach(el => el.style.display = 'inline-block');
      } else {
        adminNavs.forEach(el => el.style.display = 'none');
      }
    } else {
      badge.innerHTML = `
        <button class="btn btn-primary btn-sm" onclick="app.showAuthPage('login')">
          <i class="fa-solid fa-right-to-bracket"></i> Giriş Yap
        </button>
        <button class="btn btn-outline btn-sm" onclick="app.showAuthPage('register')">Kayıt Ol</button>
      `;
      authNavs.forEach(el => el.style.display = 'none');
      adminNavs.forEach(el => el.style.display = 'none');
    }
    this.applyTranslations();
  }

  async logout() {
    try { await API.logout(); } catch {}
    this.currentUser = null;
    this.updateUserHeader();
    this.navigate('landing');
    showToast('Çıkış yapıldı.', 'success');
  }

  // Ana sayfadaki "Hemen Başla" butonu: oturum açıksa hizmetlere,
  // değilse kayıt sayfasına yönlendirir.
  async startNow() {
    // Oturum HttpOnly cookie'de tutulduğu için giriş durumu ancak init()
    // içindeki /auth/me isteğiyle bilinir. Sayfa yeni yüklendiyse bu istek
    // hâlâ sürüyor olabilir; beklenmezse giriş yapmış kullanıcı yanlışlıkla
    // kayıt sayfasına düşerdi.
    if (!this.currentUser) {
      try { await this.ready; } catch {}
    }
    if (this.currentUser) this.navigate('services');
    else this.showAuthPage('register');
  }

  navigate(viewName) {
    // Auth check for restricted views
    if (['new-order', 'orders', 'add-funds', 'tickets'].includes(viewName) && !this.currentUser) {
      this.showAuthModal('login');
      return;
    }

    if (viewName === 'admin' && (!this.currentUser || this.currentUser.role !== 'admin')) {
      showToast('Bu alana erişim yetkiniz yok.', 'error');
      return;
    }

    this.currentView = viewName;
    window.location.hash = viewName;
    document.body.classList.toggle('admin-view-active', viewName === 'admin');
    document.body.classList.toggle('neo-app-active', viewName !== 'landing');
    document.body.dataset.activeView = viewName;

    // Hide all views
    document.querySelectorAll('.app-view').forEach(el => el.style.display = 'none');

    // Show target view
    const target = document.getElementById(`view-${viewName}`);
    if (target) target.style.display = 'block';

    // Hidden views otherwise retain the previous document/table scroll state.
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    if (target) {
      target.querySelectorAll('.table-responsive').forEach(table => {
        table.scrollTop = 0;
        table.scrollLeft = 0;
      });
    }

    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));

    // View specific initialization
    if (viewName === 'landing') {
      this.renderLandingServices();
    } else if (viewName === 'blog') {
      this.loadBlogPosts();
    } else if (viewName === 'auth') {
      // Auth view handles its state
    } else if (viewName === 'services') {
      this.renderFullServicesTable();
    } else if (viewName === 'new-order') {
      this.populateOrderCategories();
    } else if (viewName === 'orders') {
      this.loadUserOrders();
    } else if (viewName === 'tickets') {
      this.loadUserTickets();
    } else if (viewName === 'admin') {
      this.loadAdminStats();
    }
  }

  async loadServicesData() {
    try {
      const data = await API.getServices(this.locale);
      this.allCategories = (data.categories || []).map(category => ({
        ...category,
        name: this.locale === 'en' ? (category.name_en || category.name_tr || category.name) : (category.name_tr || category.name)
      }));
      this.landingPlatforms = data.landingPlatforms || [];
      this.featuredCards = data.featuredCards || [];
      this.allServices = (data.services || []).map(s => {
        const localizedName = this.locale === 'en' ? (s.name_en || s.name_tr || s.name) : (s.name_tr || s.name);
        const localizedDescription = this.locale === 'en' ? (s.description_en || s.description_tr || s.description) : (s.description_tr || s.description);
        const localizedCategory = this.locale === 'en' ? (s.category_name_en || s.category_name_tr || s.category_name) : (s.category_name_tr || s.category_name);
        return { ...s, name: localizedName, description: localizedDescription, category_name: localizedCategory, _searchIndex: `${s.id} ${localizedName || ''} ${localizedCategory || ''}`.toLowerCase() };
      });

      // Update Top Announcement Bar Text if custom announcement setting exists
      if (data.settings) {
        const textEl = document.getElementById('announcement-text');
        const announcementTr = data.settings.announcement_tr || data.settings.announcement;
        const announcementDefaultTr = '🚀 Bahar Kampanyası: Instagram ve TikTok Takipçi servislerinde %20 İndirim ve Anlık Teslimat!';
        const announcement = this.locale === 'en'
          ? (data.settings.announcement_en || (announcementTr === announcementDefaultTr
            ? '🚀 Spring Campaign: 20% off Instagram and TikTok follower services with instant delivery!'
            : announcementTr))
          : announcementTr;
        if (textEl && announcement) textEl.innerText = announcement;
        const heroTitle = document.getElementById('landing-hero-title');
        const heroSubtitle = document.getElementById('landing-hero-subtitle');
        const localizedTitle = this.locale === 'en' ? data.settings.hero_title_en : (data.settings.hero_title_tr || data.settings.hero_title);
        const localizedSubtitle = this.locale === 'en' ? data.settings.hero_subtitle_en : (data.settings.hero_subtitle_tr || data.settings.hero_subtitle);
        if (heroTitle && localizedTitle) heroTitle.textContent = localizedTitle;
        if (heroSubtitle && localizedSubtitle) heroSubtitle.textContent = localizedSubtitle;
      }

      if (data.stats) this.renderLandingMetrics(data.stats);
      // Hero'daki sipariş makinesi canlı katalogla doldurulur.
      this.populateOrderMachine();
    } catch (err) {
      console.error('Failed to load services:', err);
    }
  }

  // --- ANA SAYFA CANLI METRİK ŞERİDİ ---
  // Tüm değerler /api/services yanıtındaki canlı veritabanı sayımlarından gelir.
  renderLandingMetrics(stats) {
    const numberLocale = this.locale === 'en' ? 'en-US' : 'tr-TR';
    const formatCount = value => Number(value || 0).toLocaleString(numberLocale);

    // "0.01₺/1000" biçimi: en ucuz aktif servisin 1000 adet fiyatı.
    const formatStartingPrice = kurus => {
      if (kurus === null || kurus === undefined) return '—';
      const amount = Number(kurus) / 100;
      const pretty = amount.toLocaleString(numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `${pretty}₺/1000`;
    };

    // Sipariş sıklığı saniye cinsinden gelir; büyüklüğe göre sn/dk/sa/gün'e çevrilir.
    const formatInterval = seconds => {
      if (!Number.isFinite(Number(seconds)) || Number(seconds) <= 0) return '—';
      const value = Number(seconds);
      const units = this.locale === 'en'
        ? { s: 'sec', m: 'min', h: 'hr', d: 'days' }
        : { s: 'sn', m: 'dk', h: 'sa', d: 'gün' };
      if (value < 60) return `${value.toLocaleString(numberLocale, { maximumFractionDigits: 2 })} ${units.s}`;
      if (value < 3600) return `${(value / 60).toLocaleString(numberLocale, { maximumFractionDigits: 1 })} ${units.m}`;
      if (value < 86400) return `${(value / 3600).toLocaleString(numberLocale, { maximumFractionDigits: 1 })} ${units.h}`;
      return `${(value / 86400).toLocaleString(numberLocale, { maximumFractionDigits: 1 })} ${units.d}`;
    };

    const values = {
      'landing-metric-price': formatStartingPrice(stats.min_rate_kurus),
      'landing-metric-customers': formatCount(stats.active_users),
      'landing-metric-orders': formatCount(stats.completed_orders),
      'landing-metric-services': formatCount(stats.total_services),
      'landing-metric-frequency': formatInterval(stats.order_interval_seconds)
    };

    for (const [id, value] of Object.entries(values)) {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    }
    this.lastLandingStats = stats;
  }

  // --- ANA SAYFA SİPARİŞ MAKİNESİ ---
  // Hero'daki kutu gerçek katalogla çalışır: platform ve hizmet canlı
  // servislerden doldurulur, fiyat seçime göre anlık hesaplanır.

  localizedName(item, field = 'name') {
    if (!item) return '';
    return this.locale === 'en'
      ? (item[`${field}_en`] || item[`${field}_tr`] || item[field] || '')
      : (item[`${field}_tr`] || item[field] || '');
  }

  machineSelectedService() {
    const select = document.getElementById('landing-machine-service');
    if (!select) return null;
    return this.allServices.find(s => s.id === parseInt(select.value, 10)) || null;
  }

  populateOrderMachine() {
    const platformSelect = document.getElementById('landing-machine-platform');
    if (!platformSelect) return;

    // Yalnızca gerçekten servisi olan kategoriler listelenir.
    const categories = (this.allCategories || []).filter(c =>
      (this.allServices || []).some(s => s.category_id === c.id));

    if (!categories.length) {
      platformSelect.innerHTML = `<option value="">${this.ui('Servis yok', 'No services')}</option>`;
      const serviceSelect = document.getElementById('landing-machine-service');
      if (serviceSelect) serviceSelect.innerHTML = `<option value="">${this.ui('Servis yok', 'No services')}</option>`;
      this.updateMachinePrice();
      return;
    }

    const previous = platformSelect.value;
    platformSelect.innerHTML = categories
      .map(c => `<option value="${c.id}">${this.escapeHtml(this.localizedName(c))}</option>`)
      .join('');
    if (categories.some(c => String(c.id) === previous)) platformSelect.value = previous;

    this.onMachinePlatformChange();
  }

  onMachinePlatformChange() {
    const platformSelect = document.getElementById('landing-machine-platform');
    const serviceSelect = document.getElementById('landing-machine-service');
    if (!platformSelect || !serviceSelect) return;

    const categoryId = parseInt(platformSelect.value, 10);
    const services = (this.allServices || []).filter(s => s.category_id === categoryId);
    const previous = serviceSelect.value;

    serviceSelect.innerHTML = services
      .map(s => `<option value="${s.id}">${this.escapeHtml(this.localizedName(s))}</option>`)
      .join('');
    if (services.some(s => String(s.id) === previous)) serviceSelect.value = previous;

    // Kategoriye uygun marka simgesi
    const icon = document.getElementById('landing-machine-icon');
    if (icon) {
      const label = (platformSelect.options[platformSelect.selectedIndex]?.text || '').toLowerCase();
      const brands = {
        instagram: 'fa-brands fa-instagram', tiktok: 'fa-brands fa-tiktok',
        youtube: 'fa-brands fa-youtube', telegram: 'fa-brands fa-telegram',
        facebook: 'fa-brands fa-facebook', twitter: 'fa-brands fa-x-twitter',
        spotify: 'fa-brands fa-spotify', twitch: 'fa-brands fa-twitch',
        linkedin: 'fa-brands fa-linkedin'
      };
      const match = Object.keys(brands).find(key => label.includes(key));
      icon.className = match ? brands[match] : 'fa-solid fa-layer-group';
    }

    this.onMachineServiceChange();
  }

  onMachineServiceChange() {
    const service = this.machineSelectedService();
    const qtyInput = document.getElementById('landing-machine-qty');
    if (service && qtyInput) {
      qtyInput.min = service.min_quantity;
      qtyInput.max = service.max_quantity;
      qtyInput.value = this.clampMachineQty(Number(qtyInput.value) || service.min_quantity, service);
    }
    this.updateMachinePrice();
  }

  clampMachineQty(value, service = this.machineSelectedService()) {
    if (!service) return Math.max(1, Math.round(Number(value) || 0));
    const min = Number(service.min_quantity) || 1;
    const max = Number(service.max_quantity) || min;
    return Math.min(max, Math.max(min, Math.round(Number(value) || min)));
  }

  // Adım, servisin minimum miktarına göre belirlenir (çoğu serviste 100 gibi).
  stepMachineQty(direction) {
    const qtyInput = document.getElementById('landing-machine-qty');
    const service = this.machineSelectedService();
    if (!qtyInput || !service) return;
    const step = Math.max(1, Number(service.min_quantity) || 100);
    qtyInput.value = this.clampMachineQty((Number(qtyInput.value) || 0) + direction * step, service);
    this.updateMachinePrice();
  }

  // Kullanıcı elle yazdığında sınırlara çekilir (yazarken değil, alandan çıkınca).
  commitMachineQty() {
    const qtyInput = document.getElementById('landing-machine-qty');
    if (!qtyInput) return;
    qtyInput.value = this.clampMachineQty(qtyInput.value);
    this.updateMachinePrice();
  }

  updateMachinePrice() {
    const priceEl = document.getElementById('landing-machine-price');
    const limitsEl = document.getElementById('landing-machine-limits');
    const qtyInput = document.getElementById('landing-machine-qty');
    const service = this.machineSelectedService();
    if (!priceEl) return;

    if (!service) {
      priceEl.textContent = this.locale === 'en' ? '$0.00' : '₺0,00';
      if (limitsEl) limitsEl.textContent = '';
      return;
    }

    const qty = Number(qtyInput?.value) || 0;
    const charge = (Number(service.rate_per_1000) / 1000) * qty;
    const usdCharge = (Number(service.rate_per_1000_usd_cents || 0) / 100000) * qty;
    priceEl.textContent = this.locale === 'en' && usdCharge > 0
      ? `$${usdCharge.toFixed(2)}`
      : `₺${charge.toFixed(2)}`;

    if (limitsEl) {
      const min = Number(service.min_quantity) || 1;
      const max = Number(service.max_quantity) || min;
      const outOfRange = qty < min || qty > max;
      limitsEl.classList.toggle('is-invalid', outOfRange);
      limitsEl.textContent = this.ui(`Limit: ${min} - ${max}`, `Limit: ${min} - ${max}`);
    }
  }

  // Kutudaki seçimi gerçek sipariş formuna taşır; oturum yoksa kayda yönlendirir.
  async submitMachineOrder() {
    const service = this.machineSelectedService();
    if (!service) return showToast(this.ui('Önce bir hizmet seçin.', 'Please choose a service first.'), 'warning');

    const qty = this.clampMachineQty(document.getElementById('landing-machine-qty')?.value, service);

    if (!this.currentUser) {
      try { await this.ready; } catch {}
    }
    if (!this.currentUser) {
      this.pendingMachineOrder = { serviceId: service.id, quantity: qty };
      showToast(this.ui('Siparişi tamamlamak için hesap oluşturun.', 'Create an account to complete your order.'), 'info');
      return this.showAuthPage('register');
    }

    this.navigate('new-order');
    setTimeout(() => this.applyMachineSelection(service.id, qty), 120);
  }

  applyMachineSelection(serviceId, quantity) {
    const service = this.allServices.find(s => s.id === serviceId);
    if (!service) return;
    const categorySelect = document.getElementById('order-category-select');
    const serviceSelect = document.getElementById('order-service-select');
    const qtyInput = document.getElementById('order-qty-input');
    if (categorySelect) {
      categorySelect.value = service.category_id;
      this.onCategoryChange();
    }
    if (serviceSelect) {
      serviceSelect.value = service.id;
      this.onServiceChange();
    }
    if (qtyInput) {
      qtyInput.value = quantity;
      this.calculateOrderCharge();
    }
  }

  // MAIN PLATFORMS CONFIG
  getMainPlatforms() {
    return [
      { id: 'all', name: this.ui('Tüm Hizmetler', 'All Services'), icon: 'fa-globe' },
      { id: 'Instagram', name: 'Instagram', icon: 'fa-instagram' },
      { id: 'TikTok', name: 'TikTok', icon: 'fa-tiktok' },
      { id: 'YouTube', name: 'YouTube', icon: 'fa-youtube' },
      { id: 'Telegram', name: 'Telegram', icon: 'fa-paper-plane' },
      { id: 'Twitter', name: 'Twitter / X', icon: 'fa-x-twitter' },
      { id: 'Facebook', name: 'Facebook', icon: 'fa-facebook' },
      { id: 'Spotify', name: 'Spotify', icon: 'fa-spotify' },
      { id: 'Other', name: this.ui('Diğer', 'Other'), icon: 'fa-layer-group' }
    ];
  }

  // --- LANDING PAGE LOGIC ---
  renderLandingServices() {
    this.renderLandingPlatforms();
    this.renderFeaturedCards();

    const tabsContainer = document.getElementById('landing-platform-tabs');
    const tableBody = document.querySelector('#landing-services-table tbody');

    // Render clean main platform tabs
    const platforms = this.getMainPlatforms();
    let tabsHTML = '';
    platforms.forEach(p => {
      tabsHTML += `
        <div class="tab-btn ${this.selectedPlatform === p.id ? 'active' : ''}" onclick="app.filterLandingCategory('${p.id}')">
          <i class="fa-solid ${p.icon}"></i> ${p.name}
        </div>
      `;
    });
    tabsContainer.innerHTML = tabsHTML;

    // Filter services by platform keyword
    let filtered = this.filterServicesByPlatformKey(this.allServices, this.selectedPlatform);

    // Render max 8 popular services on landing
    const topServices = filtered.slice(0, 8);

    if (topServices.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center">${this.ui('Bu platformda henüz servis bulunmuyor.', 'No services are available for this platform yet.')}</td></tr>`;
      return;
    }

    tableBody.innerHTML = topServices.map((s, index) => {
      const isRefill = s.refill == 1 || /telafi|garanti|refill|düşüşsüz|non-drop|30 gün|60 gün|90 gün|365 gün/i.test(`${s.name} ${s.category_name}`);
      return `
        <tr>
          <td class="cell-nowrap">${String(index + 1).padStart(2, '0')}</td>
          <td class="cell-service-title" title="${this.escapeHtml(s.name)}">${this.escapeHtml(s.name)}</td>
          <td class="cell-nowrap" style="color: var(--accent-cyan); font-weight: 700;">${this.formatServicePrice(s)}</td>
          <td class="cell-nowrap">${s.min_quantity} - ${s.max_quantity}</td>
          <td class="cell-nowrap">
            ${isRefill ? `<span class="badge badge-completed"><i class="fa-solid fa-shield-check"></i> ${this.t('guaranteed')}</span>` : `<span class="badge badge-pending">${this.t('standard')}</span>`}
          </td>
          <td class="cell-nowrap" style="text-align: right;">
            <button class="btn btn-primary btn-sm" onclick="app.selectServiceForOrder(${s.id})">
              ${this.t('order_now')}
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  filterServicesByPlatformKey(services, platformId) {
    if (!platformId || platformId === 'all') return services;

    const mainKeys = ['instagram', 'tiktok', 'youtube', 'telegram', 'twitter', 'facebook', 'spotify'];

    if (platformId === 'Other') {
      return services.filter(s => {
        const cat = (s.category_name || '').toLowerCase();
        const name = (s.name || '').toLowerCase();
        return !mainKeys.some(k => cat.includes(k) || name.includes(k));
      });
    }

    const key = platformId.toLowerCase();
    return services.filter(s => {
      const cat = (s.category_name || '').toLowerCase();
      const name = (s.name || '').toLowerCase();
      return cat.includes(key) || name.includes(key);
    });
  }

  // Inline onclick argümanları XSS'e karşı encodeURIComponent ile gömülür; burada geri çözülür.
  decodeArg(value) {
    try { return decodeURIComponent(String(value ?? '')); } catch { return String(value ?? ''); }
  }

  filterLandingCategory(catName) {
    this.selectedPlatform = this.decodeArg(catName);
    this.renderLandingServices();
  }

  selectServiceForOrder(serviceId) {
    if (!this.currentUser) {
      this.showAuthModal('login');
      return;
    }
    this.navigate('new-order');

    setTimeout(() => {
      const service = this.allServices.find(s => s.id === serviceId);
      if (service) {
        document.getElementById('order-category-select').value = service.category_id;
        this.onCategoryChange();
        document.getElementById('order-service-select').value = service.id;
        this.onServiceChange();
      }
    }, 100);
  }

  // --- NEW ORDER FORM LOGIC ---
  populateOrderCategories() {
    const catSelect = document.getElementById('order-category-select');
    catSelect.innerHTML = this.allCategories.map(c => `
      <option value="${c.id}">${this.escapeHtml(c.name)}</option>
    `).join('');

    this.onCategoryChange();
    if (this.currentUser) {
      document.getElementById('dashboard-user-balance').innerText = `₺${parseFloat(this.currentUser.balance).toFixed(2)}`;
    }
  }

  onCategoryChange() {
    const catId = parseInt(document.getElementById('order-category-select').value);
    const serviceSelect = document.getElementById('order-service-select');

    const catServices = this.allServices.filter(s => s.category_id === catId);

    if (catServices.length === 0) {
      serviceSelect.innerHTML = `<option value="">${this.ui('Bu kategoride servis yok', 'No services in this category')}</option>`;
      this.onServiceChange();
      return;
    }

    serviceSelect.innerHTML = catServices.map(s => `
      <option value="${s.id}">#${s.id} - ${this.escapeHtml(s.name)} (${this.formatServicePrice(s)})</option>
    `).join('');

    this.onServiceChange();
  }

  onServiceChange() {
    const serviceId = parseInt(document.getElementById('order-service-select').value);
    const service = this.allServices.find(s => s.id === serviceId);

    if (!service) {
      document.getElementById('service-desc').innerText = this.ui('Servis bulunamadı.', 'Service not found.');
      document.getElementById('service-rate').innerText = this.locale === 'en' ? '$0.00 / ₺0.00' : '₺0.00';
      document.getElementById('service-limits').innerText = '0 - 0';
      return;
    }

    document.getElementById('service-desc').innerText = service.description || this.ui('Hızlı ve otomatik aktarımlı sosyal medya hizmeti.', 'Fast, automatically delivered social media service.');
    document.getElementById('service-rate').innerText = this.formatServicePrice(service);
    document.getElementById('service-limits').innerText = `${service.min_quantity} - ${service.max_quantity}`;

    this.calculateOrderCharge();
  }

  calculateOrderCharge() {
    const serviceId = parseInt(document.getElementById('order-service-select').value);
    const qty = parseInt(document.getElementById('order-qty-input').value) || 0;
    const service = this.allServices.find(s => s.id === serviceId);

    if (!service || qty <= 0) {
      document.getElementById('order-calculated-charge').innerText = this.locale === 'en' ? '$0.00 / ₺0.00' : '₺0.00';
      return;
    }

    let charge = (service.rate_per_1000 / 1000) * qty;

    const isDrip = document.getElementById('drip-feed-checkbox')?.checked;
    if (isDrip) {
      const runs = parseInt(document.getElementById('drip-runs-input')?.value) || 1;
      charge = charge * runs;
    }

    const usdCharge = (Number(service.rate_per_1000_usd_cents || 0) / 100000) * qty * (isDrip ? (parseInt(document.getElementById('drip-runs-input')?.value, 10) || 1) : 1);
    document.getElementById('order-calculated-charge').innerText = this.locale === 'en' && usdCharge > 0
      ? `$${usdCharge.toFixed(2)} / ₺${charge.toFixed(2)}`
      : `₺${charge.toFixed(2)}`;
  }

  async handleCreateOrder(e) {
    e.preventDefault();
    const service_id = parseInt(document.getElementById('order-service-select').value);
    const link = document.getElementById('order-link-input').value.trim();
    const quantity = parseInt(document.getElementById('order-qty-input').value);
    const isDrip = document.getElementById('drip-feed-checkbox')?.checked;
    const dripRuns = isDrip ? parseInt(document.getElementById('drip-runs-input').value, 10) : 1;
    const dripInterval = isDrip ? parseInt(document.getElementById('drip-interval-input').value, 10) : null;

    try {
      const res = await API.createOrder(service_id, link, quantity, dripRuns, dripInterval);
      showToast(res.message, 'success');
      this.currentUser.balance = res.new_balance;
      this.updateUserHeader();
      document.getElementById('dashboard-user-balance').innerText = `₺${parseFloat(res.new_balance).toFixed(2)}`;
      document.getElementById('order-form').reset();
      this.calculateOrderCharge();
      this.navigate('orders');
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  }

  // --- SERVICES CATALOG PAGE ---
  renderFullServicesTable() {
    const tabsContainer = document.getElementById('services-platform-tabs');
    const subCatSelect = document.getElementById('services-subcategory-select');

    // Render clean main platform tabs
    const platforms = this.getMainPlatforms();
    let tabsHTML = '';
    platforms.forEach(p => {
      tabsHTML += `
        <div class="tab-btn ${this.selectedPlatform === p.id ? 'active' : ''}" onclick="app.filterFullServicesCategory('${p.id}')">
          <i class="fa-solid ${p.icon}"></i> ${p.name}
        </div>
      `;
    });
    tabsContainer.innerHTML = tabsHTML;

    // Populate subcategory dropdown based on selected platform
    if (subCatSelect) {
      const platformServices = this.filterServicesByPlatformKey(this.allServices, this.selectedPlatform);
      const uniqueSubCats = [...new Set(platformServices.map(s => s.category_name))];

      subCatSelect.innerHTML = `<option value="all">${this.ui('Tüm Alt Kategoriler', 'All Subcategories')} (${platformServices.length})</option>` +
        uniqueSubCats.map(c => `<option value="${this.escapeHtml(c)}">${this.escapeHtml(c)}</option>`).join('');
    }

    this.filterServicesTable();
  }

  filterFullServicesCategory(catName) {
    this.selectedPlatform = catName;
    this.servicesPage = 1;
    this.renderFullServicesTable();
  }

  filterServicesTable(page = 1) {
    const search = (document.getElementById('services-search-input')?.value || '').trim().toLowerCase();
    const subCat = document.getElementById('services-subcategory-select')?.value || 'all';
    const country = document.getElementById('services-country-select')?.value || 'all';
    const tbody = document.getElementById('full-services-tbody');

    let filtered = this.filterServicesByPlatformKey(this.allServices, this.selectedPlatform);

    if (subCat && subCat !== 'all') {
      filtered = filtered.filter(s => s.category_name === subCat);
    }

    if (country && country !== 'all') {
      if (country === 'TR') {
        filtered = filtered.filter(s => /türk|türkiye|\btr\b|turkey/i.test(`${s.name} ${s.category_name}`));
      } else if (country === 'US') {
        filtered = filtered.filter(s => /usa|us|abd|america/i.test(`${s.name} ${s.category_name}`));
      } else if (country === 'DE') {
        filtered = filtered.filter(s => /germany|\bde\b|almanya/i.test(`${s.name} ${s.category_name}`));
      } else if (country === 'UK') {
        filtered = filtered.filter(s => /uk|\bgb\b|england|ingiltere/i.test(`${s.name} ${s.category_name}`));
      } else if (country === 'RU') {
        filtered = filtered.filter(s => /russia|\bru\b|rusya/i.test(`${s.name} ${s.category_name}`));
      } else if (country === 'IN') {
        filtered = filtered.filter(s => /india|\bin\b|hindistan/i.test(`${s.name} ${s.category_name}`));
      } else if (country === 'GLOBAL') {
        filtered = filtered.filter(s => /global|worldwide|mix|karışık/i.test(`${s.name} ${s.category_name}`));
      }
    }

    if (search) {
      filtered = filtered.filter(s => s._searchIndex ? s._searchIndex.includes(search) : (s.name || '').toLowerCase().includes(search));
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center">${this.ui('Aramanızla eşleşen servis bulunamadı.', 'No services matched your search.')}</td></tr>`;
      const pagination = document.getElementById('services-pagination');
      if (pagination) pagination.innerHTML = '';
      return;
    }

    const totalPages = Math.max(1, Math.ceil(filtered.length / this.servicesPerPage));
    this.servicesPage = Math.min(Math.max(1, Number(page) || 1), totalPages);
    const start = (this.servicesPage - 1) * this.servicesPerPage;
    const visibleServices = filtered.slice(start, start + this.servicesPerPage);

    tbody.innerHTML = visibleServices.map(s => {
      const isRefill = s.refill == 1 || /telafi|garanti|refill|düşüşsüz|non-drop|30 gün|60 gün|90 gün|365 gün/i.test(`${s.name} ${s.category_name}`);
      return `
        <tr>
          <td class="cell-nowrap">#${s.id}</td>
          <td class="cell-service-title" title="${this.escapeHtml(s.name)}">${this.escapeHtml(s.name)}</td>
          <td class="cell-nowrap" style="color: var(--accent-cyan); font-weight: 700;">${this.formatServicePrice(s)}</td>
          <td class="cell-nowrap">${s.min_quantity} - ${s.max_quantity}</td>
          <td class="cell-nowrap">
            ${isRefill ? `<span class="badge badge-completed"><i class="fa-solid fa-shield-check"></i> ${this.t('guaranteed')}</span>` : `<span class="badge badge-pending">${this.t('standard')}</span>`}
          </td>
          <td class="cell-nowrap" style="text-align: right;">
            <button class="btn btn-primary btn-sm" onclick="app.selectServiceForOrder(${s.id})">
              ${this.t('order_now')}
            </button>
          </td>
        </tr>
      `;
    }).join('');

    const pagination = document.getElementById('services-pagination');
    if (pagination) {
      const firstVisible = start + 1;
      const lastVisible = Math.min(start + this.servicesPerPage, filtered.length);
      pagination.innerHTML = `
        <span class="pagination-summary">${this.locale === 'en' ? `Showing ${firstVisible}-${lastVisible} of ${filtered.length} services` : `${filtered.length} servisten ${firstVisible}-${lastVisible} arası gösteriliyor`}</span>
        <div class="pagination-actions">
          <button class="btn btn-outline btn-sm" ${this.servicesPage === 1 ? 'disabled' : ''} onclick="app.filterServicesTable(${this.servicesPage - 1})">${this.t('previous')}</button>
          <span>${this.servicesPage} / ${totalPages}</span>
          <button class="btn btn-outline btn-sm" ${this.servicesPage === totalPages ? 'disabled' : ''} onclick="app.filterServicesTable(${this.servicesPage + 1})">${this.t('next')}</button>
        </div>`;
    }
  }

  // --- ORDERS HISTORY ---
  async loadUserOrders() {
    const tbody = document.getElementById('user-orders-tbody');
    try {
      const res = await API.getOrders(this.locale);
      if (!res.orders || res.orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center">${this.ui('Henüz bir siparişiniz bulunmamaktadır.', 'You do not have any orders yet.')}</td></tr>`;
        return;
      }

      tbody.innerHTML = res.orders.map(o => {
        let badgeClass = 'badge-pending';
        let statusText = this.ui('Beklemede', 'Pending');
        if (o.status === 'completed') { badgeClass = 'badge-completed'; statusText = this.ui('Tamamlandı', 'Completed'); }
        else if (o.status === 'processing') { badgeClass = 'badge-processing'; statusText = this.ui('İşleniyor', 'Processing'); }
        else if (o.status === 'canceled') { badgeClass = 'badge-canceled'; statusText = this.ui('İptal Edildi', 'Canceled'); }

        return `
          <tr>
            <td>#${o.id}</td>
            <td style="font-weight: 600;">${this.escapeHtml(o.service_name)}</td>
            <td>${this.renderOrderLink(o.link, 30, '0.85rem')}</td>
            <td>${o.quantity}</td>
            <td>₺${parseFloat(o.charge).toFixed(2)}</td>
            <td><span class="badge ${badgeClass}">${statusText}</span></td>
            <td style="font-size: 0.8rem; color: var(--text-dim);">${new Date(o.created_at).toLocaleString(this.locale === 'en' ? 'en-US' : 'tr-TR')}</td>
            <td>
              ${o.status === 'completed' ? `<button class="btn btn-cyan btn-sm" onclick="app.requestRefill(${o.id})"><i class="fa-solid fa-shield-check"></i> ${this.ui('Telafi İste', 'Request Refill')}</button>` : '-'}
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="color: var(--danger);">${this.ui('Siparişler yüklenemedi.', 'Orders could not be loaded.')}</td></tr>`;
    }
  }

  async requestRefill(orderId) {
    try {
      const res = await API.requestRefill(orderId);
      showToast(res.message, 'success');
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  }

  // --- ADD FUNDS & COUPON LOGIC ---
  async handleAddFunds(e) {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('payment-amount-input').value);
    const method = document.getElementById('payment-method-select').value;

    try {
      if (method !== 'paytr') throw new Error('Bu ödeme yöntemi henüz etkin değil.');
      const res = await API.createPaytrPayment(amount);
      window.location.assign(res.iframe_url);
    } catch (err) {
      showToast(`Bakiye eklenemedi: ${err.message}`, 'error');
    }
  }

  async handleRedeemCoupon(e) {
    e.preventDefault();
    const code = document.getElementById('coupon-code-input').value;
    try {
      const res = await API.redeemCoupon(code);
      showToast(res.message, 'success');
      this.currentUser.balance = res.new_balance;
      this.updateUserHeader();
      document.getElementById('coupon-code-input').value = '';
    } catch (err) {
      showToast(`Kupon hatası: ${err.message}`, 'error');
    }
  }

  async handleSendPaymentNotification(e) {
    e.preventDefault();
    const data = {
      bank_name: document.getElementById('notif-bank-select').value,
      amount: document.getElementById('notif-amount-input').value,
      sender_name: document.getElementById('notif-sender-input').value
    };

    try {
      const res = await API.sendPaymentNotification(data);
      showToast(res.message, 'success');
      document.getElementById('notif-amount-input').value = '';
      document.getElementById('notif-sender-input').value = '';
    } catch (err) {
      showToast(`Bildirim gönderilemedi: ${err.message}`, 'error');
    }
  }

  // --- SUPPORT TICKETS LOGIC ---
  async loadUserTickets() {
    const tbody = document.getElementById('tickets-tbody');
    try {
      const res = await API.getTickets();
      if (!res.tickets || res.tickets.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center">${this.ui('Açık destek talebiniz bulunmuyor.', 'You have no open support tickets.')}</td></tr>`;
        return;
      }

      tbody.innerHTML = res.tickets.map(t => `
        <tr>
          <td>#${t.id}</td>
          <td style="font-weight: 600;">${this.escapeHtml(this.localizeTicketSubject(t.subject))}</td>
          <td><span class="badge ${t.status === 'replied' ? 'badge-completed' : (t.status === 'closed' ? 'badge-canceled' : 'badge-pending')}">${this.escapeHtml(this.localizeTicketStatus(t.status))}</span></td>
          <td style="font-size: 0.85rem;">${new Date(t.created_at).toLocaleDateString(this.locale === 'en' ? 'en-US' : 'tr-TR')}</td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="app.openTicketChatModal(${t.id})">
              <i class="fa-solid fa-comments"></i> ${this.ui('Sohbet Et', 'Open Chat')}
            </button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center">${this.ui('Biletler alınamadı.', 'Tickets could not be loaded.')}</td></tr>`;
    }
  }

  showNewTicketModal() {
    document.getElementById('modal-create-ticket').classList.add('active');
  }

  async handleCreateTicket(e) {
    e.preventDefault();
    const subject = document.getElementById('ticket-subject-select').value;
    const orderId = document.getElementById('ticket-order-id-input').value;
    const message = document.getElementById('ticket-message-input').value;

    const fullSubject = orderId ? `${subject} (#${orderId})` : subject;

    try {
      const res = await API.createTicket(fullSubject, message);
      showToast(res.message, 'success');
      this.closeModal('modal-create-ticket');
      document.getElementById('ticket-message-input').value = '';
      await this.loadUserTickets();
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  }

  async openTicketChatModal(ticketId) {
    this.activeChatTicketId = ticketId;
    document.getElementById('modal-ticket-chat').classList.add('active');
    document.getElementById('chat-messages-container').innerHTML = `<div class="text-center p-20"><i class="fa-solid fa-spinner fa-spin"></i> ${this.ui('Mesajlar yükleniyor...', 'Loading messages...')}</div>`;

    try {
      const res = await API.getTicketDetails(ticketId);
      document.getElementById('chat-ticket-subject').innerText = this.localizeTicketSubject(res.ticket.subject);
      document.getElementById('chat-ticket-info').innerText = `#${res.ticket.id} • ${this.localizeTicketStatus(res.ticket.status)}`;

      document.getElementById('chat-messages-container').innerHTML = res.messages.map(m => `
        <div style="margin-bottom: 12px; display: flex; flex-direction: column; align-items: ${m.sender_role === 'admin' ? 'flex-start' : 'flex-end'};">
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 3px;">
            ${m.sender_role === 'admin' ? this.ui('🛡️ Müşteri Temsilcisi', '🛡️ Support Representative') : `👤 ${this.escapeHtml(m.username)}`} • ${new Date(m.created_at).toLocaleTimeString(this.locale === 'en' ? 'en-US' : 'tr-TR', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div style="padding: 10px 14px; border-radius: 12px; max-width: 80%; font-size: 0.9rem; background: ${m.sender_role === 'admin' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(168, 85, 247, 0.2)'}; border: 1px solid ${m.sender_role === 'admin' ? 'rgba(99, 102, 241, 0.4)' : 'rgba(168, 85, 247, 0.4)'}; color: #fff; white-space: pre-wrap;">
            ${this.escapeHtml(m.message)}
          </div>
        </div>
      `).join('');

      const container = document.getElementById('chat-messages-container');
      container.scrollTop = container.scrollHeight;
    } catch (err) {
      showToast(`Mesajlar çekilemedi: ${err.message}`, 'error');
    }
  }

  async handleSendTicketReply(e) {
    e.preventDefault();
    const input = document.getElementById('chat-reply-input');
    const message = input.value;
    if (!message || !this.activeChatTicketId) return;

    try {
      await API.replyTicket(this.activeChatTicketId, message);
      input.value = '';
      await this.openTicketChatModal(this.activeChatTicketId);
      if (this.currentUser && this.currentUser.role !== 'admin') {
        await this.loadUserTickets();
      }
    } catch (err) {
      showToast(`Cevap gönderilemedi: ${err.message}`, 'error');
    }
  }

  // --- ADMIN PANEL LOGIC ---
  switchAdminTab(tabName, evt) {
    document.querySelectorAll('#view-admin .sidebar-item').forEach(el => el.classList.remove('active'));
    const targetEl = (evt && evt.currentTarget) || document.querySelector(`#view-admin [data-admin-tab="${tabName}"]`);
    if (targetEl) targetEl.classList.add('active');
    const mobileNav = document.querySelector('.admin-mobile-nav');
    if (mobileNav) mobileNav.value = tabName;

    ['dashboard', 'providers', 'services', 'deposits', 'coupons', 'tickets', 'landing-design', 'ai-studio', 'users', 'orders', 'site-settings', 'reset'].forEach(tab => {
      const el = document.getElementById(`admin-tab-${tab}`);
      if (el) el.style.display = (tab === tabName) ? 'block' : 'none';
    });

    // Open every admin panel at its real top and clear nested table scroll.
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.querySelectorAll('#view-admin .table-responsive').forEach(table => {
      table.scrollTop = 0;
      table.scrollLeft = 0;
    });

    if (tabName === 'dashboard') this.loadAdminStats();
    if (tabName === 'providers') this.loadAdminProviders();
    if (tabName === 'services') this.loadAdminAddedServices();
    if (tabName === 'deposits') this.loadAdminPaymentNotifications();
    if (tabName === 'coupons') this.loadAdminCoupons();
    if (tabName === 'tickets') this.loadAdminTickets();
    if (tabName === 'landing-design') this.loadAdminLandingDesign();
    if (tabName === 'ai-studio') this.loadAiStudio();
    if (tabName === 'users') this.loadAdminUsers();
    if (tabName === 'orders') this.loadAdminOrders();
    if (tabName === 'site-settings') this.loadAdminSettings();
  }

  async loadAdminStats() {
    try {
      const data = await API.getAdminStats();
      document.getElementById('admin-stat-revenue').innerText = `₺${parseFloat(data.stats.total_revenue).toFixed(2)}`;
      document.getElementById('admin-stat-orders').innerText = data.stats.total_orders;
      document.getElementById('admin-stat-users').innerText = data.stats.total_users;
      const ticketCount = document.getElementById('admin-nav-tickets-count');
      const depositCount = document.getElementById('admin-nav-deposits-count');
      if (ticketCount) ticketCount.textContent = data.stats.pending_tickets || '';
      if (depositCount) depositCount.textContent = data.stats.pending_deposits || '';

      const recentTbody = document.getElementById('admin-recent-orders-tbody');
      recentTbody.innerHTML = data.recentOrders.map(o => `
        <tr>
          <td>#${o.id}</td>
          <td>${this.escapeHtml(o.username)}</td>
          <td>${this.escapeHtml(o.service_name)}</td>
          <td>${o.quantity}</td>
          <td>₺${parseFloat(o.charge).toFixed(2)}</td>
          <td><span class="badge ${o.status === 'completed' ? 'badge-completed' : 'badge-pending'}">${this.escapeHtml(o.status)}</span></td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Admin stats failed:', err);
    }
  }

  async loadAdminProviders() {
    const tbody = document.getElementById('admin-providers-tbody');
    try {
      const res = await API.getAdminProviders();
      tbody.innerHTML = res.providers.map(p => `
        <tr>
          <td>#${p.id}</td>
          <td style="font-weight: 700;">${this.escapeHtml(p.name)}</td>
          <td style="font-size: 0.85rem; color: var(--text-dim);">${this.escapeHtml(p.api_url)}</td>
          <td style="color: var(--success); font-weight: 700;">$${parseFloat(p.balance).toFixed(2)}</td>
          <td style="display: flex; gap: 8px;">
            <button class="btn btn-primary btn-sm" onclick="app.openProviderExplorer(${p.id})">
              <i class="fa-solid fa-magnifying-glass-list"></i> Servisleri İncele & Seçerek Ekle
            </button>
            <button class="btn btn-outline btn-sm" onclick="app.showImportServicesModal(${p.id})" title="Tüm servisleri % kar ile toplu aktar">
              <i class="fa-solid fa-bolt"></i> Toplu Aktar
            </button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center">Sağlayıcılar yüklenemedi.</td></tr>`;
    }
  }

  // --- PROVIDER SERVICES EXPLORER WORKSPACE ---
  async openProviderExplorer(providerId) {
    this.currentExplorerProviderId = providerId;
    this.selectedExplorerPlatform = 'all';
    this.explorerCurrentPage = 1;
    this.explorerPageSize = 50;
    document.getElementById('explorer-services-tbody').innerHTML = `<tr><td colspan="8" class="text-center"><i class="fa-solid fa-spinner fa-spin"></i> Sağlayıcı servisleri yükleniyor, lütfen bekleyin...</td></tr>`;
    document.getElementById('modal-provider-explorer').classList.add('active');

    try {
      const res = await API.getRawProviderServices(providerId);
      const rawList = res.services || [];
      // Pre-compute lowercase searchIndex for 60fps instant searching
      this.currentExplorerServices = rawList.map(s => {
        const sId = s.service || s.id || '';
        return {
          ...s,
          _sId: sId,
          _rate: parseFloat(s.rate || s.price || s.cost || 0),
          _min: parseInt(s.min || 100),
          _max: parseInt(s.max || 10000),
          _cat: s.category || 'Genel',
          _name: s.name || `Servis #${sId}`,
          _searchIndex: `${sId} ${s.name || ''} ${s.category || ''}`.toLowerCase()
        };
      });

      document.getElementById('explorer-provider-name').innerText = `${res.provider_name} (${res.total} Adet Servis)`;
      this.renderExplorerPlatformTabs();
      this.populateExplorerSubcategories();
      this.filterExplorerTable(true);
    } catch (err) {
      showToast(`Servisler yüklenemedi: ${err.message}`, 'error');
      this.closeModal('modal-provider-explorer');
    }
  }

  renderExplorerPlatformTabs() {
    const tabsContainer = document.getElementById('explorer-platform-tabs');
    if (!tabsContainer) return;

    const platforms = this.getMainPlatforms();
    let tabsHTML = '';
    platforms.forEach(p => {
      tabsHTML += `
        <div class="tab-btn ${this.selectedExplorerPlatform === p.id ? 'active' : ''}" onclick="app.filterExplorerCategory('${p.id}')">
          <i class="fa-solid ${p.icon}"></i> ${p.name}
        </div>
      `;
    });
    tabsContainer.innerHTML = tabsHTML;
  }

  filterExplorerCategory(platformId) {
    this.selectedExplorerPlatform = platformId;
    this.renderExplorerPlatformTabs();
    this.populateExplorerSubcategories();
    this.filterExplorerTable(true);
  }

  onExplorerCountryChange() {
    this.populateExplorerSubcategories();
    this.filterExplorerTable(true);
  }

  populateExplorerSubcategories() {
    const subCatSelect = document.getElementById('explorer-subcategory-select');
    const country = document.getElementById('explorer-country-select')?.value || 'all';
    if (!subCatSelect || !this.currentExplorerServices) return;

    let services = this.filterServicesByPlatformKey(this.currentExplorerServices, this.selectedExplorerPlatform);

    // Apply country filter to subcategories list
    if (country && country !== 'all') {
      if (country === 'TR') {
        services = services.filter(s => /türk|türkiye|\btr\b|turkey/i.test(`${s._name} ${s._cat}`));
      } else if (country === 'US') {
        services = services.filter(s => /usa|us|abd|america/i.test(`${s._name} ${s._cat}`));
      } else if (country === 'DE') {
        services = services.filter(s => /germany|\bde\b|almanya/i.test(`${s._name} ${s._cat}`));
      } else if (country === 'UK') {
        services = services.filter(s => /uk|\bgb\b|england|ingiltere/i.test(`${s._name} ${s._cat}`));
      } else if (country === 'RU') {
        services = services.filter(s => /russia|\bru\b|rusya/i.test(`${s._name} ${s._cat}`));
      } else if (country === 'IN') {
        services = services.filter(s => /india|\bin\b|hindistan/i.test(`${s._name} ${s._cat}`));
      } else if (country === 'GLOBAL') {
        services = services.filter(s => /global|worldwide|mix|karışık/i.test(`${s._name} ${s._cat}`));
      }
    }

    const currentSubCat = subCatSelect.value;
    const subCategories = Array.from(new Set(services.map(s => s._cat))).filter(Boolean).sort();

    subCatSelect.innerHTML = `<option value="all">Tüm Kategoriler (${subCategories.length} Kategori)</option>` + 
      subCategories.map(cat => `<option value="${this.escapeHtml(cat)}">${this.escapeHtml(cat)}</option>`).join('');

    if (subCategories.includes(currentSubCat)) {
      subCatSelect.value = currentSubCat;
    } else {
      subCatSelect.value = 'all';
    }
  }

  filterExplorerTable(resetPage = false) {
    if (resetPage) {
      this.explorerCurrentPage = 1;
    }

    const search = (document.getElementById('explorer-search-input')?.value || '').trim().toLowerCase();
    const subCat = document.getElementById('explorer-subcategory-select')?.value || 'all';
    const country = document.getElementById('explorer-country-select')?.value || 'all';
    const tbody = document.getElementById('explorer-services-tbody');

    if (!this.currentExplorerServices || this.currentExplorerServices.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center">Bu sağlayıcıda servis bulunamadı.</td></tr>`;
      this.renderExplorerPagination(0, 0);
      return;
    }

    let filtered = this.filterServicesByPlatformKey(this.currentExplorerServices, this.selectedExplorerPlatform);

    if (subCat && subCat !== 'all') {
      filtered = filtered.filter(s => s._cat === subCat);
    }

    if (country && country !== 'all') {
      if (country === 'TR') {
        filtered = filtered.filter(s => /türk|türkiye|\btr\b|turkey/i.test(`${s._name} ${s._cat}`));
      } else if (country === 'US') {
        filtered = filtered.filter(s => /usa|us|abd|america/i.test(`${s._name} ${s._cat}`));
      } else if (country === 'DE') {
        filtered = filtered.filter(s => /germany|\bde\b|almanya/i.test(`${s._name} ${s._cat}`));
      } else if (country === 'UK') {
        filtered = filtered.filter(s => /uk|\bgb\b|england|ingiltere/i.test(`${s._name} ${s._cat}`));
      } else if (country === 'RU') {
        filtered = filtered.filter(s => /russia|\bru\b|rusya/i.test(`${s._name} ${s._cat}`));
      } else if (country === 'IN') {
        filtered = filtered.filter(s => /india|\bin\b|hindistan/i.test(`${s._name} ${s._cat}`));
      } else if (country === 'GLOBAL') {
        filtered = filtered.filter(s => /global|worldwide|mix|karışık/i.test(`${s._name} ${s._cat}`));
      }
    }

    if (search) {
      filtered = filtered.filter(s => s._searchIndex ? s._searchIndex.includes(search) : s._name.toLowerCase().includes(search));
    }

    const totalItems = filtered.length;
    const pageSize = this.explorerPageSize || 50;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;

    if (this.explorerCurrentPage > totalPages) {
      this.explorerCurrentPage = totalPages;
    }

    const startIndex = (this.explorerCurrentPage - 1) * pageSize;
    const renderList = filtered.slice(startIndex, startIndex + pageSize);

    if (renderList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center">Aramanızla eşleşen servis bulunamadı.</td></tr>`;
      this.renderExplorerPagination(0, 0);
      return;
    }

    tbody.innerHTML = renderList.map(s => {
      const isRefill = s.refill == 1 || /telafi|garanti|refill|düşüşsüz|non-drop|30 gün|60 gün|90 gün|365 gün/i.test(`${s._name} ${s._cat}`);
      const rawIdStr = s._sId.toString();
      const displayId = (rawIdStr.length > 10) ? `#${rawIdStr.slice(0, 8)}...` : `#${rawIdStr}`;

      return `
        <tr>
          <td style="width: 45px; text-align: center;"><input type="checkbox" class="explorer-service-checkbox" value="${this.escapeHtml(s._sId)}" style="cursor: pointer;"></td>
          <td class="cell-nowrap" style="width: 120px; max-width: 120px; overflow: hidden; text-overflow: ellipsis; padding-left: 10px; font-weight: 700; color: var(--accent-cyan);" title="#${this.escapeHtml(s._sId)}">${this.escapeHtml(displayId)}</td>
          <td class="cell-nowrap" style="width: 220px; max-width: 220px; overflow: hidden; text-overflow: ellipsis;"><span class="badge badge-processing" title="${this.escapeHtml(s._cat)}">${this.escapeHtml(s._cat)}</span></td>
          <td class="cell-service-title" title="${this.escapeHtml(s._name)}">${this.escapeHtml(s._name)}</td>
          <td class="cell-nowrap" style="color: var(--accent-cyan); font-weight: 700;">$${s._rate.toFixed(3)}</td>
          <td class="cell-nowrap" style="font-size: 0.85rem;">${s._min} - ${s._max}</td>
          <td class="cell-nowrap">
            ${isRefill ? '<span class="badge badge-completed"><i class="fa-solid fa-shield-check"></i> Garantili</span>' : '<span class="badge badge-pending">Standart</span>'}
          </td>
          <td class="cell-actions" style="text-align: right;">
            <button class="btn btn-cyan btn-sm" onclick="app.openAddSingleServiceModal('${s._sId}', '${encodeURIComponent(s._cat)}', '${encodeURIComponent(s._name)}', ${s._rate}, ${s._min}, ${s._max})">
              <i class="fa-solid fa-plus"></i> Siteme Ekle
            </button>
          </td>
        </tr>
      `;
    }).join('');

    this.renderExplorerPagination(totalItems, totalPages);
  }

  renderExplorerPagination(totalItems, totalPages) {
    const infoEl = document.getElementById('explorer-pagination-info');
    const btnsEl = document.getElementById('explorer-pagination-buttons');
    if (!infoEl || !btnsEl) return;

    if (totalItems === 0) {
      infoEl.innerText = '0 Servis Bulundu';
      btnsEl.innerHTML = '';
      return;
    }

    const curr = this.explorerCurrentPage;
    infoEl.innerHTML = `Sayfa <strong>${curr}</strong> / <strong>${totalPages}</strong> (Toplam <strong>${totalItems}</strong> Servis)`;

    let buttonsHTML = '';

    // Prev Button
    buttonsHTML += `<button class="btn btn-outline btn-sm" ${curr === 1 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : `onclick="app.changeExplorerPage(${curr - 1})"`}>‹ Önceki</button>`;

    // Page numbers display logic (show max 5 numbered buttons)
    let startPage = Math.max(1, curr - 2);
    let endPage = Math.min(totalPages, startPage + 4);

    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }

    for (let p = startPage; p <= endPage; p++) {
      buttonsHTML += `
        <button class="btn btn-sm ${p === curr ? 'btn-cyan' : 'btn-outline'}" onclick="app.changeExplorerPage(${p})">
          ${p}
        </button>
      `;
    }

    // Next Button
    buttonsHTML += `<button class="btn btn-outline btn-sm" ${curr === totalPages ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : `onclick="app.changeExplorerPage(${curr + 1})"`}>Sonraki ›</button>`;

    btnsEl.innerHTML = buttonsHTML;
  }

  changeExplorerPage(page) {
    this.explorerCurrentPage = page;
    this.filterExplorerTable(false);
    const container = document.querySelector('.explorer-scroll-container');
    if (container) container.scrollTop = 0;
  }

  toggleSelectAllExplorerServices(checked) {
    const checkboxes = document.querySelectorAll('.explorer-service-checkbox');
    checkboxes.forEach(cb => cb.checked = checked);
  }

  async handleBulkImportSelectedFromExplorer() {
    const checkboxes = document.querySelectorAll('.explorer-service-checkbox:checked');
    const selectedIds = Array.from(checkboxes).map(cb => cb.value);

    if (selectedIds.length === 0) {
      showToast('Lütfen sitemize eklemek istediğiniz servisleri solundaki kutucukları işaretleyerek seçin.', 'warning');
      return;
    }

    const margin = parseFloat(document.getElementById('explorer-bulk-margin')?.value || 50);
    const profitMultiplier = 1 + (margin / 100);

    if (await confirmDialog(`İşaretlenen ${selectedIds.length} adet servis %${margin} kar marjı uygulanarak sitenize eklenecektir.`, {
      title: 'Servisleri içe aktar', icon: 'fa-cloud-arrow-down', confirmText: 'Aktar'
    })) {
      let addedCount = 0;
      for (const sId of selectedIds) {
        const item = (this.currentExplorerServices || []).find(s => s._sId.toString() === sId.toString());
        if (!item) continue;

        // Rate calculated in ₺ (assume 1 USD ~ 35 TRY if cost is in USD, or rate * profitMultiplier)
        const costInTry = item._rate > 1 ? item._rate : item._rate * 35;
        const sellRate = (costInTry * profitMultiplier).toFixed(2);
        const isRefill = /telafi|garanti|refill|düşüşsüz|non-drop|30 gün|60 gün|90 gün|365 gün/i.test(`${item._name} ${item._cat}`);

        try {
          await API.addAdminService({
            provider_id: this.currentExplorerProviderId,
            provider_service_id: item._sId,
            category_name: item._cat,
            name: item._name,
            rate_per_1000: sellRate > 1 ? sellRate : 10.00,
            rate_per_1000_usd: (Number(item._rate || 0) * profitMultiplier).toFixed(4),
            min_quantity: item._min,
            max_quantity: item._max,
            refill: isRefill ? 1 : 0
          });
          addedCount++;
        } catch (err) {
          console.error(`Service #${sId} import error:`, err);
        }
      }

      showToast(`${addedCount} adet servis başarıyla %${margin} kar marjı uygulanarak sitenize eklendi!`, 'success');
      this.closeModal('modal-provider-explorer');
      await this.loadAdminAddedServices();
      await this.loadServicesData();
    }
  }

  openAddSingleServiceModal(sId, encCat, encName, costRate, minQty, maxQty) {
    const cat = decodeURIComponent(encCat);
    const name = decodeURIComponent(encName);

    document.getElementById('single-provider-id').value = this.currentExplorerProviderId;
    document.getElementById('single-provider-service-id').value = sId;
    document.getElementById('single-category-name').value = cat;
    document.getElementById('single-category-name-en').value = cat;
    document.getElementById('single-service-name').value = name;
    document.getElementById('single-service-name-en').value = name;
    document.getElementById('single-cost-price').value = `$${parseFloat(costRate).toFixed(3)}`;

    // Auto detect refill status for modal select
    const isRefill = /telafi|garanti|refill|düşüşsüz|non-drop|30 gün|60 gün|90 gün|365 gün/i.test(`${name} ${cat}`);
    const refillSelect = document.getElementById('single-refill-select');
    if (refillSelect) refillSelect.value = isRefill ? "1" : "0";

    const suggestedSellPrice = (parseFloat(costRate) * 1.5 * 35).toFixed(2);
    document.getElementById('single-sell-price').value = suggestedSellPrice > 1 ? suggestedSellPrice : 15.00;
    document.getElementById('single-sell-price-usd').value = (parseFloat(costRate) * 1.5).toFixed(4);

    document.getElementById('single-min-qty').value = minQty;
    document.getElementById('single-max-qty').value = maxQty;

    document.getElementById('modal-add-single-service').classList.add('active');
  }

  async handleSaveSingleService(e) {
    e.preventDefault();
    const data = {
      provider_id: document.getElementById('single-provider-id').value,
      provider_service_id: document.getElementById('single-provider-service-id').value,
      category_name: document.getElementById('single-category-name').value,
      category_name_en: document.getElementById('single-category-name-en').value,
      name: document.getElementById('single-service-name').value,
      name_tr: document.getElementById('single-service-name').value,
      name_en: document.getElementById('single-service-name-en').value,
      rate_per_1000: document.getElementById('single-sell-price').value,
      rate_per_1000_usd: document.getElementById('single-sell-price-usd').value,
      description_tr: document.getElementById('single-description-tr').value,
      description_en: document.getElementById('single-description-en').value,
      min_quantity: document.getElementById('single-min-qty').value,
      max_quantity: document.getElementById('single-max-qty').value,
      refill: document.getElementById('single-refill-select')?.value || 0
    };

    try {
      const res = await API.addAdminService(data);
      showToast(res.message, 'success');
      this.closeModal('modal-add-single-service');
      await this.loadServicesData();
    } catch (err) {
      showToast(`Servis eklenemedi: ${err.message}`, 'error');
    }
  }

  // --- ADMIN ADDED SERVICES MANAGEMENT ---
  async loadAdminAddedServices() {
    const tbody = document.getElementById('admin-added-services-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="12" class="text-center"><i class="fa-solid fa-spinner fa-spin"></i> Sitedeki servisler yükleniyor...</td></tr>`;

    try {
      const res = await API.getAdminServices();
      this.adminUsdTryRate = Number(res.usd_try_rate) > 0 ? Number(res.usd_try_rate) : 35;
      const rawList = res.services || [];
      this.currentAdminAddedServices = rawList.map(s => ({
        ...s,
        _searchIndex: `${s.id} ${s.name || ''} ${s.category_name || ''} ${s.provider_name || ''}`.toLowerCase()
      }));
      this.filterAdminAddedServicesTable();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="12" class="text-center" style="color: var(--danger);">Servisler yüklenemedi.</td></tr>`;
    }
  }

  async refreshAdminProviderPrices() {
    const button = document.getElementById('refresh-provider-prices-btn');
    const original = button?.innerHTML;
    if (button) {
      button.disabled = true;
      button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Canlı fiyatlar alınıyor';
    }
    try {
      const res = await API.refreshAdminProviderPrices();
      showToast(res.message, 'success');
      await this.loadAdminAddedServices();
    } catch (err) {
      showToast(`Sağlayıcı fiyatları güncellenemedi: ${err.message}`, 'error');
    } finally {
      if (button) {
        button.disabled = false;
        button.innerHTML = original;
      }
    }
  }

  async openProviderPriceAudit() {
    const modal = document.getElementById('modal-provider-price-audit');
    if (!modal) return;
    modal.classList.add('active');
    if (!this.currentAdminAddedServices) await this.loadAdminAddedServices();
    const usdTryRate = Number(this.adminUsdTryRate || 35);
    this.providerPriceAuditResults = (this.currentAdminAddedServices || []).filter(service => service.status && service.provider_id).map(service => {
      const oldCost = service.provider_cost_rate === null ? null : Number(service.provider_cost_rate);
      const currency = String(service.provider_cost_currency || 'USD').toUpperCase();
      const oldCostTry = Number.isFinite(oldCost) ? (currency === 'TRY' ? oldCost : oldCost * usdTryRate) : null;
      return {
        id: service.id,
        name_tr: service.name_tr || service.name,
        name_en: service.name_en || service.name,
        provider_name: service.provider_name,
        provider_service_id: service.provider_service_id,
        previous_cost_rate: oldCost,
        previous_cost_currency: currency,
        current_cost_rate: null,
        current_cost_currency: currency,
        change_percent: null,
        price_increased: false,
        price_decreased: false,
        current_sale_try: Number(service.rate_per_1000 || 0),
        current_sale_usd: Number(service.rate_per_1000_usd_cents || 0) / 100,
        current_margin_percent: oldCostTry > 0 ? ((Number(service.rate_per_1000 || 0) / oldCostTry) - 1) * 100 : null,
        unavailable: true,
        _notChecked: true
      };
    });
    this.renderProviderPriceAudit();
  }

  async runProviderPriceAudit() {
    const button = document.getElementById('run-price-audit-btn');
    const tbody = document.getElementById('price-audit-tbody');
    const summary = document.getElementById('price-audit-summary');
    const original = button?.innerHTML;
    if (button) {
      button.disabled = true;
      button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sağlayıcı katalogları kontrol ediliyor';
    }
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center"><i class="fa-solid fa-spinner fa-spin"></i> Canlı fiyatlar getiriliyor...</td></tr>';
    if (summary) summary.textContent = 'Kontrol devam ediyor. Sağlayıcı kataloğunun büyüklüğüne göre biraz sürebilir.';
    try {
      const res = await API.auditAdminProviderPrices();
      this.providerPriceAuditResults = res.services || [];
      this.providerPriceAuditCheckedAt = res.checked_at;
      this.renderProviderPriceAudit();
    } catch (err) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="color:var(--danger);">${this.escapeHtml(err.message)}</td></tr>`;
      if (summary) summary.textContent = 'Kontrol tamamlanamadı.';
    } finally {
      if (button) {
        button.disabled = false;
        button.innerHTML = original;
      }
    }
  }

  formatProviderCost(rate, currency) {
    const value = Number(rate);
    if (!Number.isFinite(value)) return '<span class="badge badge-pending">Kayıt yok</span>';
    return `${String(currency || 'USD').toUpperCase() === 'TRY' ? '₺' : '$'}${value.toFixed(4)}`;
  }

  renderProviderPriceAudit() {
    const tbody = document.getElementById('price-audit-tbody');
    const summary = document.getElementById('price-audit-summary');
    const rows = this.providerPriceAuditResults || [];
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">Sağlayıcıya bağlı aktif servis bulunamadı.</td></tr>';
      if (summary) summary.textContent = 'Kontrol edilecek servis bulunamadı.';
      return;
    }
    const waiting = rows.filter(item => item._notChecked).length;
    const increased = rows.filter(item => item.price_increased && !item._updated).length;
    const decreased = rows.filter(item => item.price_decreased && !item._updated).length;
    const unavailable = rows.filter(item => item.unavailable).length;
    if (summary) summary.innerHTML = waiting
      ? `<strong>${rows.length}</strong> aktif servis hazır. Canlı fiyatları karşılaştırmak için “Tüm Aktif Servisleri Kontrol Et” düğmesine bas.`
      : `<strong>${rows.length}</strong> servis kontrol edildi · <span style="color:#f87171"><strong>${increased}</strong> artış</span> · <span style="color:#4ade80"><strong>${decreased}</strong> düşüş</span> · <strong>${unavailable}</strong> erişilemeyen`;
    tbody.innerHTML = rows.map(item => {
      const rowClass = item._updated ? 'price-audit-row-updated' : item.price_increased ? 'price-audit-row-increased' : item.price_decreased ? 'price-audit-row-decreased' : '';
      const change = item._notChecked ? '<span class="badge badge-pending">Kontrol bekliyor</span>' : item.change_percent === null
        ? '<span class="badge badge-pending">İlk kontrol</span>'
        : `<span class="badge ${item.price_increased ? 'badge-canceled' : item.price_decreased ? 'badge-completed' : 'badge-pending'}">${item.change_percent > 0 ? '+' : ''}%${Number(item.change_percent).toFixed(2)}</span>`;
      const suggestedMargin = Number.isFinite(Number(item.current_margin_percent)) ? Math.max(0, Number(item.current_margin_percent)).toFixed(1) : '70';
      return `<tr id="price-audit-row-${item.id}" class="${rowClass}">
        <td class="cell-truncate"><strong>${this.escapeHtml(item.name_tr)}</strong><small style="display:block;color:var(--text-dim);">${this.escapeHtml(item.provider_name)} · #${this.escapeHtml(item.provider_service_id)}</small></td>
        <td class="cell-nowrap">${this.formatProviderCost(item.previous_cost_rate, item.previous_cost_currency)}</td>
        <td class="cell-nowrap">${item._notChecked ? '<span class="badge badge-pending">Kontrol edilmedi</span>' : item.unavailable ? '<span class="badge badge-canceled">Bulunamadı</span>' : this.formatProviderCost(item.current_cost_rate, item.current_cost_currency)}</td>
        <td class="cell-nowrap">${change}</td>
        <td class="cell-nowrap"><strong>₺${Number(item.current_sale_try || 0).toFixed(2)}</strong><small style="display:block;color:var(--text-dim);">$${Number(item.current_sale_usd || 0).toFixed(2)}</small></td>
        <td><input id="price-audit-margin-${item.id}" class="form-control price-audit-margin-input" type="number" min="0" max="1000" step="0.1" value="${suggestedMargin}" ${item.unavailable ? 'disabled' : ''}></td>
        <td class="cell-nowrap"><button class="btn btn-primary btn-sm" onclick="app.applyAuditedProviderPrice(${item.id})" ${item.unavailable ? 'disabled' : ''}><i class="fa-solid fa-check"></i> ${item._updated ? 'Tekrar Güncelle' : 'Güncelle'}</button></td>
      </tr>`;
    }).join('');
  }

  async applyAuditedProviderPrice(serviceId) {
    const marginInput = document.getElementById(`price-audit-margin-${serviceId}`);
    const margin = Number(marginInput?.value);
    if (!Number.isFinite(margin) || margin < 0 || margin > 1000) return showToast('0 ile 1000 arasında geçerli bir kâr oranı gir.', 'warning');
    const row = document.getElementById(`price-audit-row-${serviceId}`);
    const button = row?.querySelector('button');
    const original = button?.innerHTML;
    if (button) {
      button.disabled = true;
      button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Güncelleniyor';
    }
    try {
      const res = await API.applyAdminProviderPrice(serviceId, margin);
      const item = (this.providerPriceAuditResults || []).find(entry => entry.id === serviceId);
      if (item) {
        item.previous_cost_rate = res.provider_cost_rate;
        item.previous_cost_currency = res.provider_cost_currency;
        item.current_cost_rate = res.provider_cost_rate;
        item.current_cost_currency = res.provider_cost_currency;
        item.current_sale_try = res.rate_try;
        item.current_sale_usd = res.rate_usd;
        item.current_margin_percent = res.profit_percentage;
        item.change_percent = 0;
        item.price_increased = false;
        item.price_decreased = false;
        item._updated = true;
      }
      this.renderProviderPriceAudit();
      await Promise.all([this.loadAdminAddedServices(), this.loadServicesData()]);
    } catch (err) {
      showToast(`Fiyat güncellenemedi: ${err.message}`, 'error');
      if (button) {
        button.disabled = false;
        button.innerHTML = original;
      }
    }
  }

  filterAdminAddedServicesTable() {
    const search = (document.getElementById('admin-added-services-search')?.value || '').trim().toLowerCase();
    const tbody = document.getElementById('admin-added-services-tbody');

    if (!this.currentAdminAddedServices || this.currentAdminAddedServices.length === 0) {
      tbody.innerHTML = `<tr><td colspan="12" class="text-center">Sitenize eklenmiş hiç servis bulunmuyor. Sağlayıcılar sekmesinden servis seçerek ekleyebilirsiniz.</td></tr>`;
      this.updateSelectedServicesCount();
      return;
    }

    let filtered = this.currentAdminAddedServices;
    if (search) {
      filtered = filtered.filter(s => s._searchIndex ? s._searchIndex.includes(search) : (s.name || '').toLowerCase().includes(search));
    }

    const renderList = filtered.slice(0, 100);

    if (renderList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="12" class="text-center">Aramanızla eşleşen servis bulunamadı.</td></tr>`;
      this.updateSelectedServicesCount();
      return;
    }

    tbody.innerHTML = renderList.map(s => {
      const providerCost = Number(s.provider_cost_rate);
      const hasProviderCost = s.provider_id && Number.isFinite(providerCost) && providerCost >= 0;
      const providerCurrency = String(s.provider_cost_currency || 'USD').toUpperCase();
      const usdTryRate = Number(this.adminUsdTryRate || 35);
      const providerCostTry = hasProviderCost ? (providerCurrency === 'TRY' ? providerCost : providerCost * usdTryRate) : 0;
      const saleTry = Number(s.rate_per_1000 || 0);
      const profitPercent = providerCostTry > 0 ? ((saleTry / providerCostTry) - 1) * 100 : null;
      const costLabel = !s.provider_id ? '<span class="badge badge-pending">Manuel</span>'
        : hasProviderCost
          ? `<strong>${providerCurrency === 'TRY' ? `₺${providerCost.toFixed(4)}` : `$${providerCost.toFixed(4)}`}</strong><small style="display:block;color:var(--text-dim);">≈ ₺${providerCostTry.toFixed(2)} · ${s.provider_cost_updated_at ? new Date(s.provider_cost_updated_at).toLocaleString('tr-TR') : ''}</small>`
          : '<span class="badge badge-pending">Güncellenmedi</span>';
      const profitLabel = profitPercent === null ? '—' : `<span class="badge ${profitPercent >= 0 ? 'badge-completed' : 'badge-canceled'}">%${profitPercent.toFixed(1)}</span>`;
      return `
      <tr>
        <td style="width: 40px;"><input type="checkbox" class="admin-service-checkbox" value="${s.id}" onchange="app.updateSelectedServicesCount()" style="cursor: pointer;"></td>
        <td class="cell-nowrap">#${s.id}</td>
        <td class="cell-nowrap"><span class="badge badge-processing">${this.escapeHtml(s.category_name)}</span></td>
        <td class="cell-truncate" style="font-weight: 600;"><strong>${this.escapeHtml(s.name_tr || s.name)}</strong><small style="display:block;color:var(--text-dim);">${this.escapeHtml(s.name_en || '')}</small></td>
        <td class="cell-nowrap" style="font-size: 0.85rem; color: var(--text-dim);">${this.escapeHtml(s.provider_name || 'Manuel')} (#${this.escapeHtml(s.provider_service_id || '-')})</td>
        <td class="cell-nowrap">${costLabel}</td>
        <td class="cell-nowrap" style="color: var(--success); font-weight: 700;">₺${parseFloat(s.rate_per_1000).toFixed(2)}</td>
        <td class="cell-nowrap" style="color: var(--accent-cyan); font-weight: 700;">$${(Number(s.rate_per_1000_usd_cents || 0) / 100).toFixed(2)}</td>
        <td class="cell-nowrap">${profitLabel}</td>
        <td class="cell-nowrap" style="font-size: 0.85rem;">${s.min_quantity} - ${s.max_quantity}</td>
        <td class="cell-nowrap">
          <span class="badge ${s.status ? 'badge-completed' : 'badge-canceled'}">
            ${s.status ? 'Aktif' : 'Pasif'}
          </span>
        </td>
        <td class="cell-actions">
          <div style="display: inline-flex; gap: 6px;">
            <button class="btn btn-cyan btn-sm" onclick="app.openEditServiceDetailsModal(${s.id})">
              <i class="fa-solid fa-pen-to-square"></i> Düzenle
            </button>
            <button class="btn btn-outline btn-sm" onclick="app.toggleAdminServiceStatus(${s.id}, ${s.status}, '${encodeURIComponent(s.name)}', ${s.rate_per_1000}, ${s.min_quantity}, ${s.max_quantity})">
              ${s.status ? 'Pasife Al' : 'Aktif Yap'}
            </button>
            <button class="btn btn-outline btn-sm" onclick="app.deleteAdminAddedService(${s.id})" style="color: var(--danger);">
              <i class="fa-solid fa-trash"></i> Sil
            </button>
          </div>
        </td>
      </tr>
    `;
    }).join('');

    this.updateSelectedServicesCount();
  }

  // --- BULK SERVICE MANAGEMENT HELPERS ---
  toggleSelectAllAdminServices(checked) {
    const checkboxes = document.querySelectorAll('.admin-service-checkbox');
    checkboxes.forEach(cb => cb.checked = checked);
    this.updateSelectedServicesCount();
  }

  updateSelectedServicesCount() {
    const selected = document.querySelectorAll('.admin-service-checkbox:checked');
    const badge = document.getElementById('selected-services-count-badge');
    if (badge) {
      badge.innerText = `${selected.length} Servis Seçildi`;
      badge.className = selected.length > 0 ? 'badge badge-completed' : 'badge badge-pending';
    }
  }

  getSelectedAdminServiceIds() {
    const selected = document.querySelectorAll('.admin-service-checkbox:checked');
    return Array.from(selected).map(cb => parseInt(cb.value));
  }

  async handleBulkDeleteSelected() {
    const ids = this.getSelectedAdminServiceIds();
    if (ids.length === 0) {
      showToast('Lütfen silinecek en az 1 servis seçin.', 'warning');
      return;
    }

    if (await confirmDialog(`Seçilen ${ids.length} adet servis silinecek. Sipariş geçmişi olan servisler pasife alınır.`, {
      title: 'Servisleri sil', danger: true, confirmText: 'Sil'
    })) {
      try {
        const res = await API.bulkDeleteAdminServices({ service_ids: ids });
        showToast(res.message, 'success');
        await this.loadAdminAddedServices();
        await this.loadServicesData();
      } catch (err) {
        showToast(`Toplu silme hatası: ${err.message}`, 'error');
      }
    }
  }

  async handleBulkStatusChange(status) {
    const ids = this.getSelectedAdminServiceIds();
    if (ids.length === 0) {
      showToast('Lütfen işlem yapılacak en az 1 servis seçin.', 'warning');
      return;
    }

    const actionText = status === 1 ? 'Aktif' : 'Pasif';
    if (await confirmDialog(`Seçilen ${ids.length} adet servis ${actionText} duruma getirilecek.`, {
      title: 'Durum güncelle', icon: 'fa-toggle-on', confirmText: 'Güncelle'
    })) {
      try {
        const res = await API.bulkStatusAdminServices({ service_ids: ids, status });
        showToast(res.message, 'success');
        await this.loadAdminAddedServices();
        await this.loadServicesData();
      } catch (err) {
        showToast(`Toplu güncelleme hatası: ${err.message}`, 'error');
      }
    }
  }

  async handleClearAllServicesFromSite() {
    // Yıkıcı işlem: onay ve "SİL" yazma adımı tek diyalogda birleştirildi,
    // yazılan kelime diyalog kapanmadan doğrulanır.
    const typed = await promptDialog(
      'Sitedeki TÜM servisler pasife alınacak. Bu işlemi geri alamazsınız.\n\nOnaylamak için aşağıya SİL yazın.',
      {
        title: '⚠️ Tüm servisleri sil',
        icon: 'fa-triangle-exclamation',
        danger: true,
        confirmText: 'Kalıcı olarak sil',
        placeholder: 'SİL',
        validate: value => value.trim().toLocaleUpperCase('tr-TR') === 'SİL' ? null : 'Onaylamak için SİL yazmalısınız.'
      }
    );
    if (!typed) return;
    try {
      const res = await API.bulkDeleteAdminServices({ delete_all: true });
      showToast(res.message, 'success');
      await this.loadAdminAddedServices();
      await this.loadServicesData();
    } catch (err) {
      showToast(`Tümünü silme hatası: ${err.message}`, 'error');
    }
  }

  openEditServiceDetailsModal(serviceId) {
    const service = (this.currentAdminAddedServices || []).find(s => s.id === serviceId);
    if (!service) return;

    document.getElementById('edit-service-id').value = service.id;
    document.getElementById('edit-service-category').value = service.category_name || 'Genel';
    document.getElementById('edit-service-category-en').value = service.category_name_en || service.category_name || 'General';
    document.getElementById('edit-service-name').value = service.name_tr || service.name || '';
    document.getElementById('edit-service-name-en').value = service.name_en || service.name || '';
    document.getElementById('edit-service-price').value = service.rate_per_1000;
    document.getElementById('edit-service-price-usd').value = (Number(service.rate_per_1000_usd_cents || 0) / 100).toFixed(4);
    document.getElementById('edit-service-description-tr').value = service.description_tr || service.description || '';
    document.getElementById('edit-service-description-en').value = service.description_en || service.description || '';
    document.getElementById('edit-service-min').value = service.min_quantity;
    document.getElementById('edit-service-max').value = service.max_quantity;
    document.getElementById('edit-service-refill').value = service.refill ? "1" : "0";
    document.getElementById('edit-service-status').value = service.status ? "1" : "0";

    document.getElementById('modal-edit-service-details').classList.add('active');
  }

  async handleSaveEditServiceDetails(e) {
    e.preventDefault();
    const serviceId = document.getElementById('edit-service-id').value;
    const data = {
      category_name: document.getElementById('edit-service-category').value,
      category_name_en: document.getElementById('edit-service-category-en').value,
      name: document.getElementById('edit-service-name').value,
      name_tr: document.getElementById('edit-service-name').value,
      name_en: document.getElementById('edit-service-name-en').value,
      rate_per_1000: document.getElementById('edit-service-price').value,
      rate_per_1000_usd: document.getElementById('edit-service-price-usd').value,
      description_tr: document.getElementById('edit-service-description-tr').value,
      description_en: document.getElementById('edit-service-description-en').value,
      min_quantity: document.getElementById('edit-service-min').value,
      max_quantity: document.getElementById('edit-service-max').value,
      refill: document.getElementById('edit-service-refill').value,
      status: document.getElementById('edit-service-status').value
    };

    try {
      await API.updateAdminService(serviceId, data);
      showToast('Servis ismi ve detayları başarıyla güncellendi!', 'success');
      this.closeModal('modal-edit-service-details');
      await this.loadAdminAddedServices();
      await this.loadServicesData();
    } catch (err) {
      showToast(`Güncelleme hatası: ${err.message}`, 'error');
    }
  }

  async toggleAdminServiceStatus(serviceId, currentStatus, encName, rate, min, max) {
    const name = decodeURIComponent(encName);
    const newStatus = currentStatus ? 0 : 1;
    try {
      await API.updateAdminService(serviceId, { name, rate_per_1000: rate, min_quantity: min, max_quantity: max, status: newStatus });
      await this.loadAdminAddedServices();
      await this.loadServicesData();
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  }

  async deleteAdminAddedService(serviceId) {
    if (await confirmDialog('Bu servis sitenizden kaldırılacak. Sipariş geçmişi varsa pasife alınır.', {
      title: 'Servisi sil', danger: true, confirmText: 'Sil'
    })) {
      try {
        const res = await API.deleteAdminService(serviceId);
        showToast(res.message, 'success');
        await this.loadAdminAddedServices();
        await this.loadServicesData();
      } catch (err) {
        showToast(`Silinemedi: ${err.message}`, 'error');
      }
    }
  }

  showAddProviderModal() {
    document.getElementById('modal-add-provider').classList.add('active');
  }

  async handleAddProvider(e) {
    e.preventDefault();
    const name = document.getElementById('prov-name').value;
    const api_url = document.getElementById('prov-url').value;
    const api_key = document.getElementById('prov-key').value;

    try {
      const res = await API.addAdminProvider(name, api_url, api_key);
      showToast(res.message, 'success');
      this.closeModal('modal-add-provider');
      this.loadAdminProviders();
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  }

  showImportServicesModal(providerId) {
    document.getElementById('import-provider-id').value = providerId;
    document.getElementById('modal-import-services').classList.add('active');
  }

  async handleImportServices(e) {
    e.preventDefault();
    const providerId = document.getElementById('import-provider-id').value;
    const profit = document.getElementById('import-profit-margin').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');

    if (!providerId) {
      showToast('Sağlayıcı seçimi bulunamadı.', 'error');
      return;
    }

    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sağlayıcıdan Servisler Çekiliyor...';

    try {
      const res = await API.importProviderServices(providerId, profit);
      showToast(res.message, 'success');
      this.closeModal('modal-import-services');
      await this.loadServicesData();
    } catch (err) {
      showToast(`Servis İçe Aktarma Hatası: ${err.message}`, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }

  async loadAdminUsers() {
    const tbody = document.getElementById('admin-users-tbody');
    try {
      const res = await API.getAdminUsers();
      tbody.innerHTML = res.users.map(u => `
        <tr>
          <td>#${u.id}</td>
          <td style="font-weight: 700;">${this.escapeHtml(u.username)}</td>
          <td>${this.escapeHtml(u.email)}</td>
          <td><span class="badge ${u.role === 'admin' ? 'badge-processing' : 'badge-completed'}">${this.escapeHtml(u.role)}</span></td>
          <td style="color: var(--success); font-weight: 700;">₺${parseFloat(u.balance).toFixed(2)}</td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="app.editUserBalance(${u.id}, 'add')">+ Bakiye</button>
            <button class="btn btn-outline btn-sm" onclick="app.editUserBalance(${u.id}, 'subtract')">- Bakiye</button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center">Kullanıcılar yüklenemedi.</td></tr>`;
    }
  }

  async editUserBalance(userId, action) {
    const isAdd = action !== 'subtract';
    const amount = await promptDialog(
      isAdd ? 'Kullanıcının bakiyesine eklenecek tutarı girin.' : 'Kullanıcının bakiyesinden düşülecek tutarı girin.',
      {
        title: isAdd ? 'Bakiye ekle' : 'Bakiye düş',
        icon: isAdd ? 'fa-plus' : 'fa-minus',
        danger: !isAdd,
        confirmText: isAdd ? 'Ekle' : 'Düş',
        type: 'number',
        inputMode: 'decimal',
        placeholder: 'Örn: 150.00',
        validate: value => Number(value) > 0 ? null : 'Sıfırdan büyük geçerli bir tutar girin.'
      }
    );
    if (!amount) return;

    try {
      const res = await API.updateUserBalance(userId, amount, action);
      showToast(res.message, 'success');
      this.loadAdminUsers();
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  }

  async loadAdminOrders() {
    const tbody = document.getElementById('admin-all-orders-tbody');
    try {
      const res = await API.getAdminOrders();
      tbody.innerHTML = res.orders.map(o => `
        <tr>
          <td>#${o.id}</td>
          <td>${this.escapeHtml(o.username)}</td>
          <td style="font-size: 0.85rem;">${this.escapeHtml(o.service_name)}</td>
          <td>${this.renderOrderLink(o.link, 40, '0.8rem')}</td>
          <td>${o.quantity}</td>
          <td><span class="badge ${o.status === 'completed' ? 'badge-completed' : 'badge-pending'}">${this.escapeHtml(o.status)}</span></td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="app.updateOrderStatus(${o.id}, 'completed')">Tamamla</button>
            <button class="btn btn-outline btn-sm" onclick="app.updateOrderStatus(${o.id}, 'canceled')">İptal & İade</button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center">Siparişler yüklenemedi.</td></tr>`;
    }
  }

  async updateOrderStatus(orderId, status) {
    try {
      const res = await API.updateOrderStatus(orderId, status);
      showToast(res.message, 'success');
      this.loadAdminOrders();
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  }

  // --- AUTH MODAL SYSTEM ---
  showAuthModal(mode) {
    this.authMode = mode;
    const title = document.getElementById('modal-auth-title');
    const submitBtn = document.getElementById('auth-submit-btn');
    const emailGroup = document.getElementById('auth-email-group');

    if (mode === 'register') {
      title.innerText = 'Hesap Oluştur';
      submitBtn.innerText = 'Kayıt Ol';
      emailGroup.style.display = 'block';
    } else {
      title.innerText = 'Giriş Yap';
      submitBtn.innerText = 'Giriş Yap';
      emailGroup.style.display = 'none';
    }

    document.getElementById('modal-auth').classList.add('active');
  }

  // --- ADMIN DEPOSITS, COUPONS, TICKETS ---
  async loadAdminPaymentNotifications() {
    const tbody = document.getElementById('admin-deposits-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="8" class="text-center"><i class="fa-solid fa-spinner fa-spin"></i> Yükleniyor...</td></tr>`;

    try {
      const res = await API.getAdminPaymentNotifications();
      if (!res.notifications || res.notifications.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center">Ödeme bildirimi bulunmuyor.</td></tr>`;
        return;
      }

      tbody.innerHTML = res.notifications.map(n => `
        <tr>
          <td>#${n.id}</td>
          <td><strong>${this.escapeHtml(n.username)}</strong> (${this.escapeHtml(n.email)})</td>
          <td><span class="badge badge-processing">${this.escapeHtml(n.bank_name)}</span></td>
          <td>${this.escapeHtml(n.sender_name)}</td>
          <td style="color: var(--success); font-weight: 700;">₺${parseFloat(n.amount).toFixed(2)}</td>
          <td style="font-size: 0.85rem;">${new Date(n.created_at).toLocaleDateString('tr-TR')}</td>
          <td><span class="badge ${n.status === 'approved' ? 'badge-completed' : (n.status === 'rejected' ? 'badge-canceled' : 'badge-pending')}">${n.status === 'approved' ? 'Onaylandı' : (n.status === 'rejected' ? 'Reddedildi' : 'Bekliyor')}</span></td>
          <td style="text-align: right;">
            ${n.status === 'pending' ? `
              <button class="btn btn-cyan btn-sm" onclick="app.handleApprovePaymentNotification(${n.id})"><i class="fa-solid fa-check"></i> Onayla & Yükle</button>
              <button class="btn btn-outline btn-sm" onclick="app.handleRejectPaymentNotification(${n.id})" style="color: var(--danger);"><i class="fa-solid fa-xmark"></i> Reddet</button>
            ` : '-'}
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center">Ödemeler yüklenemedi.</td></tr>`;
    }
  }

  async handleApprovePaymentNotification(id) {
    if (await confirmDialog('Bildirilen tutar kullanıcının bakiyesine eklenecek.', {
      title: 'Ödemeyi onayla', icon: 'fa-circle-check', confirmText: 'Onayla ve yükle'
    })) {
      try {
        const res = await API.approveAdminPaymentNotification(id);
        showToast(res.message, 'success');
        await this.loadAdminPaymentNotifications();
      } catch (err) {
        showToast(`Hata: ${err.message}`, 'error');
      }
    }
  }

  async handleRejectPaymentNotification(id) {
    if (await confirmDialog('Bu ödeme bildirimi reddedilecek ve kullanıcıya bakiye yüklenmeyecek.', {
      title: 'Bildirimi reddet', danger: true, confirmText: 'Reddet'
    })) {
      try {
        const res = await API.rejectAdminPaymentNotification(id);
        showToast(res.message, 'success');
        await this.loadAdminPaymentNotifications();
      } catch (err) {
        showToast(`Hata: ${err.message}`, 'error');
      }
    }
  }

  async loadAdminCoupons() {
    const tbody = document.getElementById('admin-coupons-tbody');
    if (!tbody) return;

    try {
      const res = await API.getAdminCoupons();
      if (!res.coupons || res.coupons.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center">Henüz tanımlanmış kupon bulunmuyor.</td></tr>`;
        return;
      }

      tbody.innerHTML = res.coupons.map(c => `
        <tr>
          <td>#${c.id}</td>
          <td><strong style="color: var(--accent-cyan); font-size: 1.1rem; letter-spacing: 1px;">${this.escapeHtml(c.code)}</strong></td>
          <td style="color: var(--success); font-weight: 700;">₺${parseFloat(c.amount).toFixed(2)}</td>
          <td>${c.used_count} / ${c.max_uses} Kullanım</td>
          <td style="font-size: 0.85rem;">${new Date(c.created_at).toLocaleDateString('tr-TR')}</td>
          <td style="text-align: right;">
            <button class="btn btn-outline btn-sm" onclick="app.handleDeleteCoupon(${c.id})" style="color: var(--danger);"><i class="fa-solid fa-trash"></i> Sil</button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center">Kuponlar yüklenemedi.</td></tr>`;
    }
  }

  showAddCouponModal() {
    document.getElementById('modal-add-coupon').classList.add('active');
  }

  async handleSaveNewCoupon(e) {
    e.preventDefault();
    const code = document.getElementById('new-coupon-code').value;
    const amount = document.getElementById('new-coupon-amount').value;
    const max_uses = document.getElementById('new-coupon-max').value;

    try {
      const res = await API.addAdminCoupon(code, amount, max_uses);
      showToast(res.message, 'success');
      this.closeModal('modal-add-coupon');
      await this.loadAdminCoupons();
    } catch (err) {
      showToast(`Kupon oluşturulamadı: ${err.message}`, 'error');
    }
  }

  async handleDeleteCoupon(id) {
    if (await confirmDialog('Bu promosyon kuponu kalıcı olarak silinecek.', {
      title: 'Kuponu sil', danger: true, confirmText: 'Sil'
    })) {
      try {
        const res = await API.deleteAdminCoupon(id);
        showToast(res.message, 'success');
        await this.loadAdminCoupons();
      } catch (err) {
        showToast(`Hata: ${err.message}`, 'error');
      }
    }
  }

  async loadAdminTickets() {
    const tbody = document.getElementById('admin-tickets-tbody');
    if (!tbody) return;

    try {
      const res = await API.getTickets();
      if (!res.tickets || res.tickets.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center">Destek talebi bulunmuyor.</td></tr>`;
        return;
      }

      tbody.innerHTML = res.tickets.map(t => `
        <tr>
          <td>#${t.id}</td>
          <td><strong>Müşteri #${t.user_id}</strong></td>
          <td style="font-weight: 600;">${this.escapeHtml(t.subject)}</td>
          <td><span class="badge ${t.status === 'replied' ? 'badge-completed' : (t.status === 'closed' ? 'badge-canceled' : 'badge-pending')}">${this.escapeHtml(t.status)}</span></td>
          <td style="font-size: 0.85rem;">${new Date(t.created_at).toLocaleDateString('tr-TR')}</td>
          <td style="text-align: right;">
            <button class="btn btn-cyan btn-sm" onclick="app.openTicketChatModal(${t.id})"><i class="fa-solid fa-reply"></i> Yanıtla & Sohbet</button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center">Biletler yüklenemedi.</td></tr>`;
    }
  }

  closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
  }

  async handleAuthSubmit(e) {
    e.preventDefault();
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value;
    const email = document.getElementById('auth-email').value.trim();
    const totp = document.getElementById('auth-totp')?.value.trim();

    try {
      let res;
      if (this.authMode === 'register') {
        res = await API.register(username, email, password, this.referralCode);
      } else {
        res = await API.login(username, password, totp);
      }

      this.currentUser = res.user;
      this.updateUserHeader();
      this.closeModal('modal-auth');
      showToast(`Hoş geldin ${res.user.username}!`, 'success');
      this.navigate('new-order');
    } catch (err) {
      if (err.code === 'TWO_FACTOR_REQUIRED') {
        document.getElementById('auth-totp-group').style.display = 'block';
        document.getElementById('auth-totp').focus();
        return;
      }
      showToast(`Hata: ${err.message}`, 'error');
    }
  }

  async confirmResetDemoData() {
    if (await confirmDialog('Tüm demo kullanıcılar, sağlayıcılar, servisler ve sipariş geçmişi kalıcı olarak silinecek.\n\nMevcut yönetici hesabınız korunur.', {
      title: '⚠️ Demo verileri temizle', danger: true, confirmText: 'Kalıcı olarak temizle'
    })) {
      try {
        const res = await API.resetDemoData();
        showToast(res.message, 'success');
        await this.loadServicesData();
        this.navigate('landing');
      } catch (err) {
        showToast(`Hata: ${err.message}`, 'error');
      }
    }
  }

  async handleChangeAdminPassword(e) {
    e.preventDefault();
    const new_password = document.getElementById('admin-new-password').value;
    const current_password = document.getElementById('admin-current-password').value;
    try {
      const res = await API.changeAdminPassword(current_password, new_password);
      showToast(res.message, 'success');
      document.getElementById('admin-current-password').value = '';
      document.getElementById('admin-new-password').value = '';
      this.currentUser = null;
      this.updateUserHeader();
      this.showAuthPage('login');
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  }

  // --- THEME SWITCHER ---
  setTheme(themeName) {
    document.body.setAttribute('data-theme', themeName);
    localStorage.setItem('smm_theme', themeName);
  }

  loadSavedTheme() {
    const saved = localStorage.getItem('smm_theme') || 'purple';
    document.body.setAttribute('data-theme', saved);
    const sel = document.getElementById('theme-selector');
    if (sel) sel.value = saved;
  }

  // --- DRIP FEED ---
  toggleDripFeed(checked) {
    const fields = document.getElementById('drip-feed-fields');
    if (fields) fields.style.display = checked ? 'grid' : 'none';
    this.calculateOrderCharge();
  }

  // --- VIP RANK SYSTEM ---
  updateUserVipRank(totalSpent) {
    const badge = document.getElementById('user-vip-badge');
    const spentEl = document.getElementById('user-total-spent');
    if (spentEl) spentEl.innerText = `₺${totalSpent.toFixed(2)}`;
    if (!badge) return;

    // Rozet metinleri JS ile üretildiği için TreeWalker çevirisine takılmaz;
    // seçili dile göre burada üretilir.
    if (totalSpent >= 5000) {
      badge.className = 'vip-badge vip-elmas';
      badge.textContent = this.ui('💎 ELMAS VIP', '💎 DIAMOND VIP');
    } else if (totalSpent >= 1500) {
      badge.className = 'vip-badge vip-altin';
      badge.textContent = this.ui('🥇 ALTIN VIP', '🥇 GOLD VIP');
    } else if (totalSpent >= 500) {
      badge.className = 'vip-badge vip-gumus';
      badge.textContent = this.ui('🥈 GÜMÜŞ VIP', '🥈 SILVER VIP');
    } else {
      badge.className = 'vip-badge vip-bronz';
      badge.textContent = this.ui('🥉 BRONZ VIP', '🥉 BRONZE VIP');
    }
  }

  // --- REFERRAL & API KEY HELPERS ---
  copyRefLink() {
    const input = document.getElementById('user-ref-link-input');
    if (input) {
      input.value = `${window.location.origin}/#register?ref=${encodeURIComponent(this.currentUser?.username || '')}`;
      input.select();
      navigator.clipboard.writeText(input.value);
      showToast('Referans linkiniz kopyalandı! Arkadaşlarınızla paylaşarak %5 komisyon kazanmaya başlayabilirsiniz.', 'success');
    }
  }

  async claimRefBalance() {
    try {
      const result = await API.claimReferralBalance();
      this.currentUser.balance = result.new_balance;
      this.updateUserHeader();
      await this.loadAccountSummary();
      showToast(result.message, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async loadAccountSummary() {
    if (!this.currentUser) return;
    try {
      const summary = await API.getAccountSummary();
      this.updateUserVipRank(summary.total_spent || 0);
      const refInput = document.getElementById('user-ref-link-input');
      if (refInput) refInput.value = `${window.location.origin}/#register?ref=${encodeURIComponent(summary.referral_code)}`;
      const refBalance = document.getElementById('user-ref-balance');
      if (refBalance) refBalance.innerText = `₺${Number(summary.referral_balance).toFixed(2)}`;
    } catch (err) {
      console.error('Account summary could not be loaded:', err.message);
    }
  }

  async forgotPassword() {
    const email = await promptDialog('Hesabınıza kayıtlı e-posta adresini girin. Sıfırlama bağlantısını göndereceğiz.', {
      title: 'Şifremi unuttum',
      icon: 'fa-key',
      confirmText: 'Bağlantı gönder',
      type: 'email',
      placeholder: 'ornek@domain.com',
      validate: value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : 'Geçerli bir e-posta adresi girin.'
    });
    if (!email) return;
    try {
      const result = await API.forgotPassword(email.trim());
      showToast(result.message, 'success');
      if (result.preview_token) console.info('Development reset token:', result.preview_token);
    } catch (err) { showToast(err.message, 'error'); }
  }

  async completePasswordReset(token) {
    if (!token) return this.navigate('landing');
    const password = await promptDialog('Hesabınız için yeni bir şifre belirleyin.', {
      title: 'Yeni şifre',
      icon: 'fa-lock',
      confirmText: 'Şifreyi güncelle',
      type: 'password',
      placeholder: 'En az 10 karakter',
      validate: value => value.length >= 10 ? null : 'Şifre en az 10 karakter olmalıdır.'
    });
    if (!password) return;
    try {
      const result = await API.resetPassword(token, password);
      showToast(result.message, 'success');
      this.showAuthPage('login');
    } catch (err) { showToast(err.message, 'error'); }
  }

  async completeEmailVerification(token) {
    try {
      const result = await API.confirmEmailVerification(token);
      showToast(result.message, 'success');
      this.navigate('landing');
    } catch (err) { showToast(err.message, 'error'); }
  }

  async enableTwoFactor() {
    try {
      const setup = await API.setupTwoFactor();
      const popup = window.open('', '_blank', 'width=420,height=560');
      if (popup) {
        popup.document.body.innerHTML = `<div style="font-family:sans-serif;padding:24px;text-align:center"><h2>İki Adımlı Doğrulama</h2><p>QR kodu doğrulayıcı uygulamanızla tarayın.</p><img src="${setup.qr_data_url}" alt="2FA QR"><p><code>${setup.manual_key}</code></p></div>`;
      }
      const token = await promptDialog('Doğrulayıcı uygulamanızda görünen 6 haneli kodu girin.', {
        title: 'İki adımlı doğrulama',
        icon: 'fa-shield-halved',
        confirmText: 'Etkinleştir',
        inputMode: 'numeric',
        placeholder: '123456',
        validate: value => /^\d{6}$/.test(value) ? null : 'Kod 6 haneli olmalıdır.'
      });
      if (!token) return;
      const result = await API.confirmTwoFactor(token);
      showToast(result.message, 'success');
      this.currentUser = null;
      this.updateUserHeader();
      this.showAuthPage('login');
    } catch (err) { showToast(err.message, 'error'); }
  }

  async requestEmailVerification() {
    try {
      const result = await API.requestEmailVerification();
      showToast(result.message, 'success');
      if (result.preview_token) console.info('Development verification token:', result.preview_token);
    } catch (err) { showToast(err.message, 'error'); }
  }

  copyApiKey() {
    const input = document.getElementById('user-api-key-input');
    if (input) {
      input.select();
      navigator.clipboard.writeText(input.value);
      showToast('API Anahtarınız panonuza kopyalandı!', 'success');
    }
  }

  updateTelegramLinks(link) {
    if (!link) return;
    const cleanLink = link.startsWith('http') ? link : `https://t.me/${link.replace('@', '')}`;
    const floatBtn = document.getElementById('floating-telegram-btn');
    const ticketLink = document.getElementById('tickets-telegram-link');
    if (floatBtn) floatBtn.href = cleanLink;
    if (ticketLink) ticketLink.href = cleanLink;
  }

  async loadAdminSettings() {
    try {
      const res = await API.getSettings();
      const s = res.settings || {};
      if (document.getElementById('setting-site-name')) document.getElementById('setting-site-name').value = s.site_name || 'SMM Panel';
      if (document.getElementById('setting-currency')) document.getElementById('setting-currency').value = s.currency || '₺';
      if (document.getElementById('setting-announcement-tr')) document.getElementById('setting-announcement-tr').value = s.announcement_tr || s.announcement || '';
      if (document.getElementById('setting-announcement-en')) document.getElementById('setting-announcement-en').value = s.announcement_en || '';
      if (document.getElementById('setting-hero-title-tr')) document.getElementById('setting-hero-title-tr').value = s.hero_title_tr || s.hero_title || '';
      if (document.getElementById('setting-hero-title-en')) document.getElementById('setting-hero-title-en').value = s.hero_title_en || '';
      if (document.getElementById('setting-hero-subtitle-tr')) document.getElementById('setting-hero-subtitle-tr').value = s.hero_subtitle_tr || s.hero_subtitle || '';
      if (document.getElementById('setting-hero-subtitle-en')) document.getElementById('setting-hero-subtitle-en').value = s.hero_subtitle_en || '';
      if (document.getElementById('setting-usd-try-rate')) document.getElementById('setting-usd-try-rate').value = s.usd_try_rate || '';
      if (document.getElementById('setting-telegram')) document.getElementById('setting-telegram').value = s.telegram_link || 'https://t.me/SmmPanelDestek';
      if (document.getElementById('setting-paytr-id')) document.getElementById('setting-paytr-id').value = s.paytr_merchant_id || '';
      if (document.getElementById('setting-paytr-key')) document.getElementById('setting-paytr-key').value = s.paytr_merchant_key || '';
      if (document.getElementById('setting-paytr-salt')) document.getElementById('setting-paytr-salt').value = s.paytr_merchant_salt || '';

      this.updateTelegramLinks(s.telegram_link || 'https://t.me/SmmPanelDestek');
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }

  async handleSaveSiteSettings(e) {
    e.preventDefault();
    const settingsObj = {
      site_name: document.getElementById('setting-site-name').value,
      currency: document.getElementById('setting-currency').value,
      announcement_tr: document.getElementById('setting-announcement-tr').value,
      announcement_en: document.getElementById('setting-announcement-en').value,
      hero_title_tr: document.getElementById('setting-hero-title-tr').value,
      hero_title_en: document.getElementById('setting-hero-title-en').value,
      hero_subtitle_tr: document.getElementById('setting-hero-subtitle-tr').value,
      hero_subtitle_en: document.getElementById('setting-hero-subtitle-en').value,
      usd_try_rate: document.getElementById('setting-usd-try-rate').value,
      telegram_link: document.getElementById('setting-telegram').value,
      paytr_merchant_id: document.getElementById('setting-paytr-id').value,
      paytr_merchant_key: document.getElementById('setting-paytr-key').value,
      paytr_merchant_salt: document.getElementById('setting-paytr-salt').value
    };

    try {
      const res = await API.saveSettings(settingsObj);
      if (settingsObj.announcement_tr || settingsObj.announcement_en) {
        const textEl = document.getElementById('announcement-text');
        if (textEl) textEl.innerText = this.locale === 'en' ? settingsObj.announcement_en : settingsObj.announcement_tr;
      }
      if (settingsObj.telegram_link) {
        this.updateTelegramLinks(settingsObj.telegram_link);
      }
      showToast(res.message, 'success');
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  }

  renderLandingPlatforms() {
    const container = document.getElementById('landing-platforms-bar');
    if (!container) return;

    let items = this.landingPlatforms;
    if (!items || items.length === 0) {
      items = [
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
    }

    // Duplicate list twice for seamless 60 FPS infinite marquee scroll
    const doubleList = [...items, ...items];

    const innerHTML = doubleList.map(p => {
      const iconClass = p.icon.startsWith('fa-') ? p.icon : `fa-${p.icon}`;
      const prefix = (p.icon.includes('facebook') || p.icon.includes('spotify') || p.icon.includes('tiktok') || p.icon.includes('discord') || p.icon.includes('snapchat') || p.icon.includes('soundcloud') || p.icon.includes('reddit') || p.icon.includes('pinterest') || p.icon.includes('telegram')) ? 'fa-brands' : 'fa-solid';
      return `
        <div class="platform-badge-item" onclick="app.filterLandingCategory('${encodeURIComponent(p.name)}')">
          <i class="${prefix} ${this.escapeHtml(iconClass)}"></i> ${this.escapeHtml(p.name)}
        </div>
      `;
    }).join('');

    container.innerHTML = `<div class="platforms-scroll-track">${innerHTML}</div>`;
  }

  renderFeaturedCards() {
    const container = document.getElementById('landing-featured-cards');
    if (!container) return;

    let cards = this.featuredCards;
    if (!cards || cards.length === 0) {
      cards = [
        { title: 'Instagram Reels İzlenme', subtitle: 'Reels', highlight: 'Keşfet' },
        { title: 'Instagram Hikaye İzlenme', subtitle: 'Hikaye', highlight: 'Erişimi' },
        { title: 'Instagram Kaydet', subtitle: 'İçerik', highlight: 'Değeri' },
        { title: 'Instagram Takipçi', subtitle: 'Hesap', highlight: 'Güçlendirme' },
        { title: 'Instagram Beğeni', subtitle: 'Gönderi', highlight: 'Etkileşimi' }
      ];
    }

    const featuredEnglish = {
      'Instagram Reels İzlenme': 'Instagram Reels Views',
      'Instagram Hikaye İzlenme': 'Instagram Story Views',
      'Instagram Kaydet': 'Instagram Saves',
      'Instagram Takipçi': 'Instagram Followers',
      'Instagram Beğeni': 'Instagram Likes',
      'Hikaye': 'Story', 'İçerik': 'Content', 'Hesap': 'Account', 'Gönderi': 'Post',
      'Keşfet': 'Explore', 'Erişimi': 'Reach', 'Değeri': 'Value',
      'Güçlendirme': 'Growth', 'Etkileşimi': 'Engagement', 'Sipariş Ver': 'Order Now'
    };
    const localizedCardValue = (trValue, enValue = '') => this.locale === 'en'
      ? (enValue || featuredEnglish[trValue] || trValue || '')
      : (trValue || '');

    // Duplicate list twice for seamless 60 FPS infinite marquee scroll
    const doubleCards = [...cards, ...cards];

    const innerHTML = doubleCards.map(c => `
      <div class="featured-card-box" style="min-width: 220px;">
        <div class="featured-card-title">${this.escapeHtml(localizedCardValue(c.title, c.title_en))}</div>
        <div>
          <div class="featured-card-sub">${this.escapeHtml(localizedCardValue(c.subtitle, c.subtitle_en))}</div>
          <div class="featured-card-highlight">${this.escapeHtml(localizedCardValue(c.highlight, c.highlight_en))}</div>
        </div>
        <button class="btn-magenta" onclick="app.navigate('services')">${this.escapeHtml(localizedCardValue(c.btn_text || 'Sipariş Ver', c.btn_text_en))}</button>
      </div>
    `).join('');

    container.innerHTML = `<div class="featured-cards-track">${innerHTML}</div>`;
  }

  // --- BLOG METHODS ---
  async loadBlogPosts() {
    const container = document.getElementById('public-blog-cards');
    if (!container) return;

    try {
      const res = await API.getBlogPosts(this.locale);
      if (!res.posts || res.posts.length === 0) {
        container.innerHTML = `<div class="text-center" style="grid-column: 1/-1; color: var(--text-muted);">${this.t('no_blog')}</div>`;
        return;
      }

      container.innerHTML = res.posts.map(p => `
        <div class="blog-card glass-card">
          <img src="${this.escapeHtml(p.image_url || 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80')}" class="blog-card-img" alt="${this.escapeHtml(p.title)}">
          <div style="padding: 20px;">
            <span class="badge badge-completed mb-10">${this.escapeHtml(p.category || this.ui('Rehber', 'Guide'))}</span>
            <h3 style="font-size: 1.1rem; margin-bottom: 8px; color: #fff; font-weight: 700;">${this.escapeHtml(p.title)}</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 16px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${this.escapeHtml(p.summary || '')}</p>
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-glass); padding-top: 12px;">
              <span style="font-size: 0.78rem; color: var(--text-dim);">${new Date(p.published_at || p.created_at).toLocaleDateString(this.locale === 'en' ? 'en-US' : 'tr-TR')}</span>
              <button class="btn btn-outline btn-sm" onclick="app.loadBlogPostDetail('${encodeURIComponent(p.slug)}')">${this.t('read_more')} <i class="fa-solid fa-arrow-right"></i></button>
            </div>
          </div>
        </div>
      `).join('');
    } catch (err) {
      console.error('Failed to load blog posts:', err);
    }
  }

  async loadBlogPostDetail(slug) {
    this.currentBlogSlug = slug;
    try {
      const res = await API.getBlogPostDetail(slug, this.locale);
      const post = res.post;
      if (!post) return;

      document.getElementById('blog-detail-category').innerText = post.category || this.ui('Rehber', 'Guide');
      document.getElementById('blog-detail-title').innerText = post.title;
      document.getElementById('blog-detail-date').innerText = `${new Date(post.published_at || post.created_at).toLocaleDateString(this.locale === 'en' ? 'en-US' : 'tr-TR')} • ${post.reading_minutes || 3} ${this.locale === 'en' ? 'min read' : 'dk okuma'}`;
      
      const img = document.getElementById('blog-detail-img');
      if (post.image_url) {
        img.src = post.image_url;
        img.style.display = 'block';
      } else {
        img.style.display = 'none';
      }

      const content = document.getElementById('blog-detail-content');
      content.innerHTML = post.content || post.summary || '';
      this.bindBlogInternalLinks(content);
      this.navigate('blog-detail');
      window.location.hash = `blog/${encodeURIComponent(slug)}`;
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  }

  bindBlogInternalLinks(container) {
    container.querySelectorAll('a[href^="#blog/"]').forEach(link => {
      link.addEventListener('click', event => {
        event.preventDefault();
        const slug = decodeURIComponent(link.getAttribute('href').slice('#blog/'.length));
        this.loadBlogPostDetail(slug);
      });
    });
    container.querySelectorAll('a[href^="#services"]').forEach(link => {
      link.addEventListener('click', event => {
        event.preventDefault();
        const raw = link.getAttribute('href');
        const serviceId = Number(new URLSearchParams(raw.split('?')[1] || '').get('service'));
        this.openServiceFromBlog(serviceId || null);
      });
    });
    container.querySelectorAll('a[href="#blog"]').forEach(link => {
      link.addEventListener('click', event => { event.preventDefault(); this.navigate('blog'); });
    });
  }

  openServiceFromBlog(serviceId, updateHash = true) {
    this.selectedPlatform = 'all';
    this.navigate('services');
    const search = document.getElementById('services-search-input');
    const subcategory = document.getElementById('services-subcategory-select');
    const country = document.getElementById('services-country-select');
    if (subcategory) subcategory.value = 'all';
    if (country) country.value = 'all';
    if (search) search.value = serviceId ? String(serviceId) : '';
    this.filterServicesTable(1);
    if (updateHash) window.location.hash = serviceId ? `services?service=${serviceId}` : 'services';
  }

  // --- ADMIN LANDING DESIGN & BLOG METHODS ---
  async loadAdminLandingDesign() {
    this.loadAdminPlatformsList();
    this.loadAdminCardsList();
    this.loadAdminBlogList();
  }

  async loadAdminPlatformsList() {
    const tbody = document.getElementById('admin-platforms-tbody');
    if (!tbody) return;
    try {
      const res = await API.getAdminPlatforms();
      tbody.innerHTML = (res.platforms || []).map(p => `
        <tr>
          <td style="font-weight:600;">${this.escapeHtml(p.name)}</td>
          <td><i class="fa-brands ${this.escapeHtml(p.icon.startsWith('fa-') ? p.icon : 'fa-' + p.icon)}"></i> ${this.escapeHtml(p.icon)}</td>
          <td>${p.status == 1 ? '<span class="badge badge-completed">Aktif</span>' : '<span class="badge badge-canceled">Pasif</span>'}</td>
          <td style="text-align: right;">
            <button class="btn btn-outline btn-sm" onclick="app.togglePlatformStatus(${p.id}, ${p.status == 1 ? 0 : 1})">${p.status == 1 ? 'Gizle' : 'Göster'}</button>
            <button class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="app.deleteAdminPlatform(${p.id})"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error(err);
    }
  }

  async handleCreateLandingPlatform(e) {
    e.preventDefault();
    const name = document.getElementById('admin-platform-name').value.trim();
    const icon = document.getElementById('admin-platform-icon').value.trim();
    try {
      const res = await API.addAdminPlatform(name, icon);
      showToast(res.message, 'success');
      document.getElementById('admin-platform-name').value = '';
      document.getElementById('admin-platform-icon').value = '';
      this.loadAdminPlatformsList();
      await this.loadServicesData();
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  }

  async togglePlatformStatus(id, newStatus) {
    try {
      await API.toggleAdminPlatformStatus(id, newStatus);
      this.loadAdminPlatformsList();
      await this.loadServicesData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async deleteAdminPlatform(id) {
    if (!await confirmDialog('Bu platform simgesi ana sayfadan kaldırılacak.', {
      title: 'Platformu sil', danger: true, confirmText: 'Sil'
    })) return;
    try {
      await API.deleteAdminPlatform(id);
      this.loadAdminPlatformsList();
      await this.loadServicesData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async loadAdminCardsList() {
    const tbody = document.getElementById('admin-cards-tbody');
    if (!tbody) return;
    try {
      const res = await API.getAdminCards();
      tbody.innerHTML = (res.cards || []).map(c => `
        <tr>
          <td style="font-weight:600;">${this.escapeHtml(c.title)}</td>
          <td><span style="color:#d946ef;">${this.escapeHtml(c.highlight || '-')}</span></td>
          <td>${c.status == 1 ? '<span class="badge badge-completed">Aktif</span>' : '<span class="badge badge-canceled">Pasif</span>'}</td>
          <td style="text-align: right;">
            <button class="btn btn-outline btn-sm" onclick="app.toggleCardStatus(${c.id}, ${c.status == 1 ? 0 : 1})">${c.status == 1 ? 'Gizle' : 'Göster'}</button>
            <button class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="app.deleteAdminCard(${c.id})"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error(err);
    }
  }

  async handleCreateFeaturedCard(e) {
    e.preventDefault();
    const title = document.getElementById('admin-card-title').value.trim();
    const subtitle = document.getElementById('admin-card-sub').value.trim();
    const highlight = document.getElementById('admin-card-highlight').value.trim();
    try {
      const res = await API.addAdminCard(title, subtitle, highlight);
      showToast(res.message, 'success');
      document.getElementById('admin-card-title').value = '';
      document.getElementById('admin-card-sub').value = '';
      document.getElementById('admin-card-highlight').value = '';
      this.loadAdminCardsList();
      await this.loadServicesData();
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  }

  async toggleCardStatus(id, newStatus) {
    try {
      await API.toggleAdminCardStatus(id, newStatus);
      this.loadAdminCardsList();
      await this.loadServicesData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async deleteAdminCard(id) {
    if (!await confirmDialog('Bu öne çıkan kart ana sayfadan kaldırılacak.', {
      title: 'Kartı sil', danger: true, confirmText: 'Sil'
    })) return;
    try {
      await API.deleteAdminCard(id);
      this.loadAdminCardsList();
      await this.loadServicesData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async loadAdminBlogList() {
    const tbody = document.getElementById('admin-blog-tbody');
    if (!tbody) return;
    try {
      const res = await API.getAdminBlogPosts();
      this.currentAdminBlogPosts = res.posts || [];
      tbody.innerHTML = this.currentAdminBlogPosts.map(p => `
        <tr>
          <td>#${p.id}</td>
          <td><img src="${this.escapeHtml(p.image_url || 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80')}" style="width: 40px; height: 30px; object-fit: cover; border-radius: 4px;"></td>
          <td style="font-weight:600;">${this.escapeHtml(p.title_tr || p.title)}<small style="display:block;color:var(--text-dim);">${this.escapeHtml(p.title_en || '')}</small></td>
          <td><span class="badge ${p.status === 'published' ? 'badge-completed' : 'badge-pending'}">${p.status === 'published' ? 'Yayında' : 'Taslak'}</span></td>
          <td style="font-size:0.8rem; color:var(--text-dim);">${new Date(p.created_at).toLocaleDateString('tr-TR')}</td>
          <td style="text-align: right;">
            <button class="btn btn-cyan btn-sm" onclick="app.showEditBlogModal(${p.id})"><i class="fa-solid fa-pen"></i> Düzenle</button>
            <button class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="app.deleteAdminBlogPost(${p.id})"><i class="fa-solid fa-trash"></i> Sil</button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error(err);
    }
  }

  showAddBlogModal() {
    document.querySelector('#modal-add-blog form')?.reset();
    document.getElementById('blog-input-id').value = '';
    document.getElementById('blog-input-category-tr').value = 'Sosyal Medya';
    document.getElementById('blog-input-category-en').value = 'Social Media';
    document.getElementById('blog-input-reading').value = 5;
    document.getElementById('blog-input-status').value = 'draft';
    document.getElementById('blog-editor-title').innerHTML = '<i class="fa-solid fa-pen-nib"></i> Yeni Çift Dilli Blog Yazısı';
    document.getElementById('modal-add-blog')?.classList.add('active');
  }

  showEditBlogModal(id) {
    const post = (this.currentAdminBlogPosts || []).find(item => item.id === id);
    if (!post) return;
    const fields = {
      'blog-input-id': post.id, 'blog-input-title-tr': post.title_tr || post.title || '', 'blog-input-title-en': post.title_en || post.title || '',
      'blog-input-category-tr': post.category_tr || post.category || '', 'blog-input-category-en': post.category_en || post.category || '',
      'blog-input-summary-tr': post.summary_tr || post.summary || '', 'blog-input-summary-en': post.summary_en || post.summary || '',
      'blog-input-content-tr': post.content_tr || post.content || '', 'blog-input-content-en': post.content_en || post.content || '',
      'blog-input-seo-title-tr': post.seo_title_tr || '', 'blog-input-seo-title-en': post.seo_title_en || '',
      'blog-input-seo-description-tr': post.seo_description_tr || '', 'blog-input-seo-description-en': post.seo_description_en || '',
      'blog-input-image': post.image_url || '', 'blog-input-reading': post.reading_minutes || 3, 'blog-input-status': post.status || 'draft'
    };
    Object.entries(fields).forEach(([fieldId, value]) => { const field = document.getElementById(fieldId); if (field) field.value = value; });
    document.getElementById('blog-editor-title').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Blog Yazısını Düzenle';
    document.getElementById('modal-add-blog')?.classList.add('active');
  }

  async handleCreateBlogPost(e) {
    e.preventDefault();
    const data = {
      title_tr: document.getElementById('blog-input-title-tr').value.trim(),
      title_en: document.getElementById('blog-input-title-en').value.trim(),
      category_tr: document.getElementById('blog-input-category-tr').value.trim(),
      category_en: document.getElementById('blog-input-category-en').value.trim(),
      image_url: document.getElementById('blog-input-image').value.trim(),
      summary_tr: document.getElementById('blog-input-summary-tr').value.trim(),
      summary_en: document.getElementById('blog-input-summary-en').value.trim(),
      content_tr: document.getElementById('blog-input-content-tr').value.trim(),
      content_en: document.getElementById('blog-input-content-en').value.trim(),
      seo_title_tr: document.getElementById('blog-input-seo-title-tr').value.trim(),
      seo_title_en: document.getElementById('blog-input-seo-title-en').value.trim(),
      seo_description_tr: document.getElementById('blog-input-seo-description-tr').value.trim(),
      seo_description_en: document.getElementById('blog-input-seo-description-en').value.trim(),
      reading_minutes: document.getElementById('blog-input-reading').value,
      status: document.getElementById('blog-input-status').value
    };

    try {
      const id = document.getElementById('blog-input-id').value;
      const res = id ? await API.updateAdminBlogPost(id, data) : await API.addAdminBlogPost(data);
      showToast(res.message, 'success');
      this.closeModal('modal-add-blog');
      this.loadAdminBlogList();
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  }

  previewBlogPost() {
    const locale = this.locale === 'en' ? 'en' : 'tr';
    const title = document.getElementById(`blog-input-title-${locale}`).value;
    const content = document.getElementById(`blog-input-content-${locale}`).value;
    const parsed = new DOMParser().parseFromString(`<article>${content}</article>`, 'text/html');
    parsed.querySelectorAll('script,style,iframe,object,embed,form').forEach(node => node.remove());
    parsed.querySelectorAll('*').forEach(node => Array.from(node.attributes).forEach(attr => {
      if (attr.name.startsWith('on')) node.removeAttribute(attr.name);
    }));
    const safePreview = parsed.body.innerHTML;
    const popup = window.open('', '_blank', 'width=980,height=760');
    if (!popup) return showToast('Önizleme için açılır pencereye izin verin.', 'info');
    popup.opener = null;
    popup.document.write(`<!doctype html><meta charset="utf-8"><title>Blog preview</title><style>body{max-width:820px;margin:40px auto;padding:20px;background:#08101d;color:#e5edf8;font:17px/1.75 Arial}h1{line-height:1.2}a{color:#67e8f9}</style><h1></h1>${safePreview}`);
    popup.document.querySelector('h1').textContent = title;
    popup.document.close();
  }

  async deleteAdminBlogPost(id) {
    if (!await confirmDialog('Bu blog makalesi kalıcı olarak silinecek.', {
      title: 'Makaleyi sil', danger: true, confirmText: 'Sil'
    })) return;
    try {
      await API.deleteAdminBlogPost(id);
      this.loadAdminBlogList();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // --- AI CONTENT & OPERATIONS STUDIO ---
  async loadAiStudio() {
    this.fillAiProviderDefaults(false);
    try {
      const [res, conversationRes] = await Promise.all([API.getAiProviders(), API.getAiConversations()]);
      this.aiProviders = res.providers || [];
      const select = document.getElementById('ai-chat-provider');
      const usableProviders = this.aiProviders.filter(provider => provider.status && provider.model && provider.model !== 'not-selected');
      if (select) select.innerHTML = usableProviders.map(provider => `<option value="${provider.id}" ${provider.is_default ? 'selected' : ''}>${this.escapeHtml(provider.name)} · ${this.escapeHtml(provider.model)}</option>`).join('');
      const list = document.getElementById('ai-provider-list');
      if (list) list.innerHTML = this.aiProviders.length ? this.aiProviders.map(provider => `
        <div class="ai-provider-item">
          <strong>${this.escapeHtml(provider.name)} ${provider.is_default ? '<span class="badge badge-completed">Aktif</span>' : ''}</strong>
          <small>${this.escapeHtml(provider.provider_type)} · ${provider.model === 'not-selected' ? 'Model henüz seçilmedi' : `Model: ${this.escapeHtml(provider.model)}`}</small>
          <div class="ai-provider-actions">
            <button class="btn btn-cyan btn-sm" onclick="app.editAiProvider(${provider.id})">Düzenle</button>
            <button class="btn btn-outline btn-sm" onclick="app.testAiProvider(${provider.id})">Test et ve modelleri getir</button>
            <button class="btn btn-outline btn-sm" style="color:var(--danger)" onclick="app.deleteAiProvider(${provider.id})">Sil</button>
          </div>
          <div class="ai-model-picker" id="ai-model-picker-${provider.id}" hidden>
            <select class="form-control" id="ai-model-select-${provider.id}"></select>
            <button class="btn btn-primary btn-sm" type="button" onclick="app.activateAiModel(${provider.id})">Seçili modeli etkinleştir</button>
          </div>
        </div>`).join('') : '<p class="admin-help">Henüz AI bağlantısı eklenmedi.</p>';
      const conversationList = document.getElementById('ai-conversation-list');
      if (conversationList) conversationList.innerHTML = (conversationRes.conversations || []).map(conversation => `
        <button class="ai-conversation-button" onclick="app.openAiConversation(${conversation.id})">
          <strong>${this.escapeHtml(conversation.title)}</strong><small>${this.escapeHtml(conversation.provider_name || '')}</small>
        </button>`).join('') || '<p class="admin-help">Henüz kayıtlı sohbet yok.</p>';
    } catch (err) {
      showToast(`AI sağlayıcıları yüklenemedi: ${err.message}`, 'error');
    }
  }

  fillAiProviderDefaults(force = true) {
    const type = document.getElementById('ai-provider-type')?.value || 'openai_compatible';
    const url = document.getElementById('ai-provider-url');
    const defaults = {
      openai_compatible: 'https://api.openai.com/v1',
      anthropic: 'https://api.anthropic.com/v1',
      gemini: 'https://generativelanguage.googleapis.com/v1beta'
    };
    if (url && (force || !url.value)) url.value = defaults[type];
  }

  editAiProvider(id) {
    const provider = (this.aiProviders || []).find(item => item.id === id);
    if (!provider) return;
    document.getElementById('ai-provider-id').value = provider.id;
    document.getElementById('ai-provider-name').value = provider.name;
    document.getElementById('ai-provider-type').value = provider.provider_type;
    document.getElementById('ai-provider-url').value = provider.api_base_url;
    document.getElementById('ai-provider-model').value = provider.model;
    document.getElementById('ai-provider-key').value = '';
    document.getElementById('ai-provider-key').placeholder = 'Değiştirmeyeceksen boş bırak';
    document.getElementById('ai-provider-web-search').checked = Boolean(provider.enable_web_search);
  }

  async handleSaveAiProvider(event) {
    event.preventDefault();
    const data = {
      name: document.getElementById('ai-provider-name').value.trim(),
      provider_type: document.getElementById('ai-provider-type').value,
      api_base_url: document.getElementById('ai-provider-url').value.trim(),
      model: document.getElementById('ai-provider-model').value.trim(),
      api_key: document.getElementById('ai-provider-key').value.trim(),
      enable_web_search: document.getElementById('ai-provider-web-search').checked
    };
    try {
      const id = document.getElementById('ai-provider-id').value;
      const res = id ? await API.updateAiProvider(id, data) : await API.addAiProvider(data);
      showToast(res.message, 'success');
      event.target.reset();
      document.getElementById('ai-provider-id').value = '';
      await this.loadAiStudio();
    } catch (err) { showToast(`AI bağlantısı kaydedilemedi: ${err.message}`, 'error'); }
  }

  async testAiProvider(id) {
    try {
      const res = await API.testAiProvider(id);
      this.renderAiModelPicker(id, res.models || [], res.active_model);
      showToast(`Bağlantı başarılı: ${res.message}`, 'success');
    }
    catch (err) { showToast(`Bağlantı testi başarısız: ${err.message}`, 'error'); }
  }

  renderAiModelPicker(id, models, activeModel = '') {
    const picker = document.getElementById(`ai-model-picker-${id}`);
    const select = document.getElementById(`ai-model-select-${id}`);
    if (!picker || !select) return;
    select.innerHTML = models.map(model => `<option value="${this.escapeHtml(model)}" ${model === activeModel ? 'selected' : ''}>${this.escapeHtml(model)}</option>`).join('');
    picker.hidden = models.length === 0;
  }

  async activateAiModel(id) {
    const select = document.getElementById(`ai-model-select-${id}`);
    if (!select?.value) return showToast('Önce listeden bir model seçmelisin.', 'warning');
    try {
      const res = await API.activateAiProviderModel(id, select.value);
      showToast(res.message, 'success');
      await this.loadAiStudio();
    } catch (err) { showToast(`Model etkinleştirilemedi: ${err.message}`, 'error'); }
  }

  async deleteAiProvider(id) {
    if (!await confirmDialog('Bu AI bağlantısı ve kayıtlı API anahtarı silinecek.', {
      title: 'AI sağlayıcısını sil', danger: true, confirmText: 'Sil'
    })) return;
    try { await API.deleteAiProvider(id); await this.loadAiStudio(); }
    catch (err) { showToast(err.message, 'error'); }
  }

  startNewAiConversation() {
    this.currentAiConversationId = null;
    const messages = document.getElementById('ai-chat-messages');
    const actions = document.getElementById('ai-action-queue');
    if (messages) messages.innerHTML = '<div class="ai-empty-state"><i class="fa-solid fa-robot"></i><strong>Yeni sohbet hazır</strong><span>Sitenle ilgili sorunu veya istediğin işlemi yaz.</span></div>';
    if (actions) actions.innerHTML = '';
  }

  async openAiConversation(id) {
    try {
      const res = await API.getAiConversation(id);
      this.currentAiConversationId = id;
      const container = document.getElementById('ai-chat-messages');
      if (container) container.innerHTML = '';
      (res.messages || []).filter(message => message.role !== 'system').forEach(message => this.appendAiMessage(message.role, message.content));
      const pending = (res.actions || []).filter(action => action.status === 'pending').map(action => ({ ...action, payload: action.payload }));
      const queue = document.getElementById('ai-action-queue');
      if (queue) queue.innerHTML = '';
      this.renderAiActions(pending);
    } catch (err) { showToast(`Sohbet yüklenemedi: ${err.message}`, 'error'); }
  }

  appendAiMessage(role, content) {
    const container = document.getElementById('ai-chat-messages');
    if (!container) return;
    container.querySelector('.ai-empty-state')?.remove();
    const message = document.createElement('div');
    message.className = `ai-message ${role}`;
    message.textContent = content;
    container.appendChild(message);
    container.scrollTop = container.scrollHeight;
  }

  renderAiActions(actions) {
    const queue = document.getElementById('ai-action-queue');
    if (!queue || !actions?.length) return;
    queue.innerHTML = actions.map(action => {
      const isProviderImport = action.action_type === 'import_provider_services';
      const serviceCount = Array.isArray(action.payload?.services) ? action.payload.services.length : 0;
      const title = isProviderImport
        ? `${serviceCount} sağlayıcı servisi · %${Number(action.payload?.profit_percentage || 0)} kâr`
        : action.action_type;
      const preview = isProviderImport
        ? action.payload.services.map((service, index) => `${index + 1}. ${service.name_tr}\n   ${service.name_en}`).join('\n')
        : JSON.stringify(action.payload, null, 2);
      return `
      <div class="ai-action-card" id="ai-action-${action.id}">
        <strong><i class="fa-solid fa-triangle-exclamation"></i> Onay bekliyor: ${this.escapeHtml(title)}</strong>
        <pre>${this.escapeHtml(preview)}</pre>
        <div class="ai-action-buttons">
          <button class="btn btn-outline btn-sm" onclick="app.rejectAiAction(${action.id})">Reddet</button>
          <button class="btn btn-primary btn-sm" onclick="app.executeAiAction(${action.id})">Onayla ve Uygula</button>
        </div>
      </div>`;
    }).join('');
  }

  async handleSendAiMessage(event) {
    event.preventDefault();
    const input = document.getElementById('ai-chat-input');
    const sendButton = document.getElementById('ai-chat-send');
    const message = input.value.trim();
    if (!message) return;
    this.appendAiMessage('user', message);
    input.value = '';
    sendButton.disabled = true;
    sendButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Düşünüyor';
    try {
      const res = await API.sendAiMessage({
        message,
        provider_id: Number(document.getElementById('ai-chat-provider').value),
        conversation_id: this.currentAiConversationId || undefined
      });
      this.currentAiConversationId = res.conversation_id;
      this.appendAiMessage('assistant', res.message);
      this.renderAiActions(res.actions);
    } catch (err) { this.appendAiMessage('assistant', `Hata: ${err.message}`); }
    finally {
      sendButton.disabled = false;
      sendButton.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Gönder';
    }
  }

  async executeAiAction(id) {
    if (!await confirmDialog('AI tarafından önerilen bu işlem sitenize uygulanacak.', {
      title: 'AI işlemini uygula', icon: 'fa-robot', confirmText: 'Uygula'
    })) return;
    try {
      const res = await API.executeAiAction(id);
      document.getElementById(`ai-action-${id}`)?.remove();
      this.appendAiMessage('assistant', `✓ ${res.message}`);
      await this.loadServicesData();
      await this.loadAdminAddedServices();
      await this.loadAdminBlogList();
    } catch (err) { showToast(err.message, 'error'); }
  }

  async rejectAiAction(id) {
    try { await API.rejectAiAction(id); document.getElementById(`ai-action-${id}`)?.remove(); }
    catch (err) { showToast(err.message, 'error'); }
  }

  escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  // Sipariş hedefi kullanıcı girdisidir: yalnızca http(s) adresleri tıklanabilir yapılır,
  // kullanıcı adı gibi diğer değerler düz metin olarak gösterilir.
  isSafeHttpUrl(value) {
    try {
      const protocol = new URL(String(value)).protocol;
      return protocol === 'http:' || protocol === 'https:';
    } catch {
      return false;
    }
  }

  renderOrderLink(link, maxLength = 30, fontSize = '0.85rem') {
    const raw = String(link ?? '');
    const shown = raw.length > maxLength ? `${raw.slice(0, maxLength)}...` : raw;
    if (!this.isSafeHttpUrl(raw)) {
      return `<span style="font-size: ${fontSize};">${this.escapeHtml(shown)}</span>`;
    }
    return `<a href="${this.escapeHtml(raw)}" target="_blank" rel="noopener noreferrer nofollow" style="font-size: ${fontSize};">${this.escapeHtml(shown)}</a>`;
  }

  // --- AUTH SYSTEM (MATCHING IMAGE DESIGN) ---
  showAuthModal(mode = 'login') {
    this.authMode = mode;
    const title = document.getElementById('modal-auth-title');
    const subtitle = document.getElementById('modal-auth-subtitle');
    const submitBtn = document.getElementById('auth-submit-btn');
    const emailGroup = document.getElementById('auth-email-group');
    const switchText = document.getElementById('auth-switch-text');
    const switchLink = document.getElementById('auth-switch-link');

    if (mode === 'register') {
      if (title) title.innerText = this.ui('Ücretsiz Hesabını Aç', 'Create Your Free Account');
      if (subtitle) subtitle.innerText = this.ui('Kaydol, bakiyeni yükle ve hemen sipariş vermeye başla.', 'Register, add funds, and start placing orders right away.');
      if (submitBtn) submitBtn.innerText = this.ui('Kayıt Ol', 'Register');
      if (emailGroup) emailGroup.style.display = 'block';
      if (switchText) switchText.innerText = this.ui('Zaten hesabın var mı?', 'Already have an account?');
      if (switchLink) switchLink.innerText = this.ui('Giriş Yap', 'Login');
    } else {
      if (title) title.innerText = this.ui('Hesabına Giriş Yap', 'Sign In to Your Account');
      if (subtitle) subtitle.innerText = this.ui('Kullanıcı bilgilerini girerek paneline güvenle eriş.', 'Enter your account details to access your panel securely.');
      if (submitBtn) submitBtn.innerText = this.ui('Giriş Yap', 'Login');
      if (emailGroup) emailGroup.style.display = 'none';
      if (switchText) switchText.innerText = this.ui('Hesabın yok mu?', "Don't have an account?");
      if (switchLink) switchLink.innerText = this.ui('Ücretsiz Kayıt Ol', 'Register for Free');
    }

    document.getElementById('modal-auth').classList.add('active');
  }

  toggleAuthModalMode() {
    this.showAuthModal(this.authMode === 'login' ? 'register' : 'login');
  }

  showAuthPage(mode = 'register') {
    this.authMode = mode;
    const title = document.getElementById('auth-page-title');
    const subtitle = document.getElementById('auth-page-subtitle');
    const submitBtn = document.getElementById('vauth-submit-btn');
    const emailGroup = document.getElementById('view-auth-email-group');
    const switchText = document.getElementById('vauth-switch-text');
    const switchLink = document.getElementById('vauth-switch-link');

    if (mode === 'register') {
      if (title) title.innerText = this.ui('Ücretsiz hesabını aç', 'Create your free account');
      if (subtitle) subtitle.innerText = this.ui('Kaydol, bakiyeni yükle ve hemen sipariş vermeye başla.', 'Register, add funds, and start placing orders right away.');
      if (submitBtn) submitBtn.innerText = this.ui('Kayıt ol', 'Register');
      if (emailGroup) emailGroup.style.display = 'block';
      if (switchText) switchText.innerText = this.ui('Zaten hesabın var mı?', 'Already have an account?');
      if (switchLink) switchLink.innerText = this.ui('Giriş yap', 'Login');
    } else {
      if (title) title.innerText = this.ui('Hesabına giriş yap', 'Sign in to your account');
      if (subtitle) subtitle.innerText = this.ui('Kullanıcı adını ve şifreni girerek paneline bağlan.', 'Enter your username and password to access your panel.');
      if (submitBtn) submitBtn.innerText = this.ui('Giriş yap', 'Login');
      if (emailGroup) emailGroup.style.display = 'none';
      if (switchText) switchText.innerText = this.ui('Hesabın yok mu?', "Don't have an account?");
      if (switchLink) switchLink.innerText = this.ui('Ücretsiz hesap aç', 'Create a free account');
    }

    this.navigate('auth');
  }

  toggleAuthViewMode() {
    this.showAuthPage(this.authMode === 'login' ? 'register' : 'login');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  }

  async handleAuthSubmit(e) {
    e.preventDefault();
    const isViewForm = e.target.id === 'view-auth-form';
    const usernameInput = isViewForm ? document.getElementById('vauth-username') : document.getElementById('auth-username');
    const emailInput = isViewForm ? document.getElementById('vauth-email') : document.getElementById('auth-email');
    const passwordInput = isViewForm ? document.getElementById('vauth-password') : document.getElementById('auth-password');

    const username = usernameInput ? usernameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';
    const totpInput = isViewForm ? document.getElementById('vauth-totp') : document.getElementById('auth-totp');
    const totp = totpInput?.value.trim();

    try {
      let res;
      if (this.authMode === 'register') {
        res = await API.register(username, email, password, this.referralCode);
      } else {
        res = await API.login(username, password, totp);
      }

      this.currentUser = res.user;
      this.updateUserHeader();
      this.closeModal('modal-auth');

      showToast(this.authMode === 'register' ? 'Hesabınız başarıyla oluşturuldu! Hoş geldiniz.' : 'Giriş başarılı! Hoş geldiniz.', 'success');
      
      if (this.currentUser.role === 'admin') {
        this.navigate('admin');
      } else {
        this.navigate('new-order');
        // Sipariş makinesinden gelindiyse seçim forma taşınır.
        if (this.pendingMachineOrder) {
          const { serviceId, quantity } = this.pendingMachineOrder;
          this.pendingMachineOrder = null;
          setTimeout(() => this.applyMachineSelection(serviceId, quantity), 150);
        }
      }
    } catch (err) {
      if (err.code === 'TWO_FACTOR_REQUIRED') {
        const group = isViewForm ? document.getElementById('vauth-totp-group') : document.getElementById('auth-totp-group');
        if (group) group.style.display = 'block';
        totpInput?.focus();
        return;
      }
      showToast(`İşlem Başarısız: ${err.message}`, 'error');
    }
  }
}

// Global App Instance
const app = new SmmApp();
