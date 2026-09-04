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
    this.servicesPerPage = 20;
    this.referralCode = null;

    this.debouncedFilterServicesTable = this.debounce(() => this.filterServicesTable(), 180);
    this.debouncedFilterExplorerTable = this.debounce(() => this.filterExplorerTable(), 180);
    this.debouncedFilterAdminAddedServices = this.debounce(() => this.filterAdminAddedServicesTable(), 180);
    // Kullanici ve siparis aramalari sunucudan filtreli veri ceker; her tus
    // vurusunda istek atmamak icin 300ms bekletilir.
    this.debouncedAdminUsersSearch = this.debounce(() => this.loadAdminUsers(), 300);
    this.debouncedAdminOrdersSearch = this.debounce(() => this.loadAdminOrders(), 300);
    this.debouncedAdminPaymentsSearch = this.debounce(() => this.loadAdminPayments(), 300);

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
        'blog.back': 'Tüm Makalelere Dön',
        'info.price_1000': '1000 Adet', 'info.limits': 'Limit', 'info.button': 'Bilgi', 'info.buy': 'Satın Al',
        'info.start_time': 'Başlama Süresi', 'info.speed': 'Hız', 'info.guarantee': 'Garanti', 'info.features': 'Özellikler',
        'info.description': 'Açıklama', 'info.min_max': 'Min / Max', 'info.no_details': 'Bu servis için ek bilgi girilmemiş.'
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
        'blog.back': 'Back to All Articles',
        'info.price_1000': 'Per 1000', 'info.limits': 'Limits', 'info.button': 'Info', 'info.buy': 'Buy Now',
        'info.start_time': 'Start Time', 'info.speed': 'Speed', 'info.guarantee': 'Guarantee', 'info.features': 'Features',
        'info.description': 'Description', 'info.min_max': 'Min / Max', 'info.no_details': 'No extra details have been added for this service.'
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
    // Yasal sayfalar gibi uzun iceriklerde ceviri sozluk yerine dil bloklariyla
    // yapilir: .lang-tr / .lang-en gorunurlugu bu sinifla yonetilir.
    document.body.classList.toggle('locale-en', this.locale === 'en');
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

      // Liste bölümünün sol sütunu
      'AKTİF SERVİS': 'ACTIVE SERVICES', 'BAŞLAYAN FİYAT': 'STARTING PRICE',
      'SEÇİLİ PLATFORM': 'SELECTED PLATFORM', 'TÜM HİZMETLER': 'ALL SERVICES',
      'Fiyatlar ve stok doğrudan sağlayıcı kataloğundan gelir.':
        'Prices and availability come straight from the provider catalog.',

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
      '© 2026 SMMJET. Tüm hakları saklıdır.': '2026 SMMJET. All rights reserved.',
      'Kullanım Şartları': 'Terms of Service',
      'Gizlilik & KVKK': 'Privacy Policy',
      'İade Politikası': 'Refund Policy',

      // --- Bakiye yükleme ekranı (yöntem kartları + adımlar) -------------
      'Ödeme yöntemini seç': 'Choose a payment method',
      'Tutarı belirle': 'Set the amount',
      'Ödemeye geç': 'Proceed to payment',
      'Coin seç': 'Choose a coin',
      'Aşağıdaki hesaba ödemeni yap': 'Send your payment to an account below',
      'Ödemeni bildir': 'Notify us of your payment',
      'Kredi / Banka Kartı': 'Credit / Debit Card',
      'PayTR güvenli ödeme': 'Secure payment via PayTR',
      'Shopier güvenli ödeme': 'Secure payment via Shopier',
      'Güvenli Öde — Shopier': 'Pay Securely — Shopier',
      'Kripto Para': 'Cryptocurrency',
      'USDT, BTC ve 300+ coin': 'USDT, BTC and 300+ coins',
      'Havale / Papara': 'Bank Transfer / Papara',
      'Bildirim ile onaylanır': 'Approved via payment notice',
      'Güvenli Öde — Kart': 'Pay Securely — Card',
      "Kart bilgilerin PayTR'nin güvenli sayfasında işlenir; sitemizde saklanmaz.":
        "Your card details are processed on PayTR's secure page; we never store them.",
      'Ödemeyi yaptıktan sonra bu formu doldur; ekibimiz dakikalar içinde onaylar ve bakiyen yüklenir.':
        'After sending your payment, fill in this form; our team approves it within minutes and your balance is added.',
      'Promosyon Kuponu': 'Promotional Coupon',
      'Coinler yükleniyor…': 'Loading coins…',

      // --- Siparişlerim: Telegram bildirim kartı --------------------------
      'Telegram Sipariş Bildirimleri': 'Telegram Order Notifications',
      "Siparişin tamamlanınca veya durumu değişince Telegram'dan anında haber al.":
        'Get instant Telegram updates when your order completes or its status changes.',

      // --- Yasal sayfa başlıkları -----------------------------------------
      'Gizlilik Politikası & KVKK Aydınlatma Metni': 'Privacy Policy & Data Protection Notice',
      'İade ve İptal Politikası': 'Refund & Cancellation Policy'
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
      'Lütfen yaşadığınız sorunu detaylıca açıklayın...': 'Please describe your issue in detail...',
      'Kupon kodu: HOSGELDIN20': 'Coupon code: WELCOME20'
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
    // API dokumanlarindaki ornek adresler siteye gore dinamiktir:
    // localhost yaziyorsa canli alan adiyla degistirilir.
    const apiBaseSpan = document.getElementById('api-docs-base-url');
    if (apiBaseSpan) apiBaseSpan.textContent = `${window.location.origin}/api/v2`;
    document.querySelectorAll('#view-api-docs pre').forEach(block => {
      if (!block.dataset.contentTr) block.dataset.contentTr = block.textContent;
      const localized = this.locale === 'en'
        ? block.dataset.contentTr.replaceAll('/kullaniciadi', '/username')
        : block.dataset.contentTr;
      block.textContent = localized.replaceAll('http://localhost:3000', window.location.origin);
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
    else if (this.currentView === 'landing-page' && this.currentLandingSlug) await this.openLandingPage(this.currentLandingSlug, false);
    else if (this.currentView === 'services') this.renderFullServicesTable();
    else if (this.currentView === 'landing') this.renderLandingServices();
    else if (this.currentView === 'orders' && this.currentUser) { await this.loadUserOrders(); this.loadTelegramConnectCard(); }
    else if (this.currentView === 'add-funds') { this.initAddFundsView(); this.renderDepositBonusBanner(); }
    else if (this.currentView === 'tickets' && this.currentUser) await this.loadUserTickets();
    else if (this.currentView === 'profile' && this.currentUser) await this.loadProfileView();
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
    // Aktif kampanya indirimi varsa dusen fiyat gosterilir (duz metin).
    const rate = service?.discounted_rate_per_1000 ?? Number(service?.rate_per_1000 || 0);
    const usd = Number(service?.rate_per_1000_usd_cents || 0) / 100;
    if (this.locale === 'en' && usd > 0 && !service?.discount_percent) return `$${usd.toFixed(2)} / ₺${rate.toFixed(2)}`;
    return `₺${rate.toFixed(2)}${service?.discount_percent ? ` (-%${service.discount_percent})` : ''}`;
  }

  // --- MOBİL MENÜ ---
  // 1100px altinda .nav-links satir icine sigmadigi icin hamburger ile acilan
  // bir panele donusur; burada yalnizca acma/kapama davranisi yonetilir.
  setupMobileMenu() {
    document.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target : null;
      // Kisaltilmis tablo hucreleri (uzun servis adlari) tiklaninca acilir/kapanir.
      // Icindeki baglanti veya dugme tiklandiginda hucre davranisi devreye girmez.
      const truncated = target?.closest('.cell-truncate');
      if (truncated && !target.closest('a, button, input, select')) truncated.classList.toggle('expanded');

      const navbar = document.querySelector('.navbar');
      if (!navbar || !navbar.classList.contains('nav-open')) return;
      if (target && (target.closest('#nav-toggle') || target.closest('#main-nav-links'))) return;
      this.closeMobileMenu();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') this.closeMobileMenu();
    });
    // Masaustu genislige donuldugunde panel durumu takili kalmamali.
    window.addEventListener('resize', () => {
      if (window.innerWidth > 1100) this.closeMobileMenu();
    });
  }

  toggleMobileMenu(force) {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;
    const open = typeof force === 'boolean' ? force : !navbar.classList.contains('nav-open');
    navbar.classList.toggle('nav-open', open);

    const toggle = document.getElementById('nav-toggle');
    if (!toggle) return;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('i')?.classList.replace(
      open ? 'fa-bars' : 'fa-xmark',
      open ? 'fa-xmark' : 'fa-bars'
    );
  }

  closeMobileMenu() {
    this.toggleMobileMenu(false);
  }

  // Erisilebilirlik: gorunen <label> etiketlerini ayni gruptaki form alanina
  // baglar (for="..."). Ekran okuyucular ve Lighthouse denetimleri icin.
  // ---------------------------------------------------------------
  // Cerez onayi
  // Olcum (Analytics) cerezleri ancak ziyaretci acikca izin verdikten sonra
  // yuklenir. Sunucu gtag betigini artik dogrudan basmaz; yalnizca olcum
  // kimligini <meta name="analytics-id"> icinde birakir (bkz. server.js).
  // ---------------------------------------------------------------
  cookieConsentValue() {
    try { return localStorage.getItem('cerezOnayi'); } catch { return null; }
  }

  initCookieConsent() {
    const onay = this.cookieConsentValue();
    if (onay === 'accepted') { this.loadAnalytics(); return; }
    if (onay === 'rejected') return;
    const bant = document.getElementById('cookie-consent');
    if (bant) bant.hidden = false;
  }

  setCookieConsent(deger) {
    try { localStorage.setItem('cerezOnayi', deger); } catch {}
    const bant = document.getElementById('cookie-consent');
    if (bant) bant.hidden = true;
    if (deger === 'accepted') this.loadAnalytics();
  }

  loadAnalytics() {
    if (this.analyticsLoaded) return;
    const id = document.querySelector('meta[name="analytics-id"]')?.content;
    if (!id) return;
    this.analyticsLoaded = true;
    const betik = document.createElement('script');
    betik.async = true;
    betik.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(betik);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', id, { anonymize_ip: true });
  }

  /** Blog yazisinin paylasim baglantilarini acik olan adrese gore gunceller. */
  updateShareLinks(baslik) {
    const adres = encodeURIComponent(window.location.href);
    const metin = encodeURIComponent(baslik || document.title);
    const hedefler = {
      'share-x': `https://twitter.com/intent/tweet?url=${adres}&text=${metin}`,
      'share-facebook': `https://www.facebook.com/sharer/sharer.php?u=${adres}`,
      'share-whatsapp': `https://wa.me/?text=${metin}%20${adres}`,
      'share-telegram': `https://t.me/share/url?url=${adres}&text=${metin}`
    };
    for (const [id, href] of Object.entries(hedefler)) {
      const el = document.getElementById(id);
      if (el) el.href = href;
    }
  }

  async copyPageLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast('Bağlantı kopyalandı.', 'success');
    } catch {
      showToast('Bağlantı kopyalanamadı.', 'error');
    }
  }

  associateFormLabels() {
    document.querySelectorAll('.form-group').forEach(group => {
      const label = group.querySelector('label:not([for])');
      const control = group.querySelector('input[id], select[id], textarea[id]');
      if (label && control) label.htmlFor = control.id;
    });
  }

  async init() {
    this.setupMobileMenu();
    this.loadSavedTheme();
    this.associateFormLabels();
    this.initCookieConsent();

    // Mobil tarayicilar geri/ileri gecislerde sayfayi bellekten (bfcache)
    // geri getirir; eski sinyaller (bakiye, siparis durumu) ekranda kalir.
    // Boyle bir geri donuste sayfa tazelenir.
    window.addEventListener('pageshow', event => {
      if (event.persisted) window.location.reload();
    });

    // Siparislerim ekrani aciksa durumlar 30 saniyede bir sunucudan tazelenir
    // (admin onayi / iptali aninda kullaniciya yansisin diye).
    setInterval(() => {
      if (this.currentView === 'orders' && this.currentUser && document.visibilityState === 'visible') {
        this.loadUserOrders();
        // Iptal iadesi bakiyeye yansimis olabilir; ust bardaki bakiye de tazelenir.
        API.getMe().then(res => { this.currentUser = res.user; this.updateUserHeader(); }).catch(() => {});
      }
    }, 30000);
    // Destek sohbeti: Enter gonderir, Shift+Enter alt satir acar. Yazi alani
    // icerige gore buyur.
    const chatInput = document.getElementById('chat-reply-input');
    if (chatInput) {
      chatInput.addEventListener('input', () => this.autoGrowChatInput(chatInput));
      chatInput.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          chatInput.form?.requestSubmit();
        }
      });
    }
    // Sekmeye geri donuldugunde sohbet aninda tazelensin (bekleme olmasin).
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.activeChatTicketId) this.refreshTicketChat(false);
    });

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

    // Adres cozumleme: temiz yol (/services gibi) esastir. Eski #hash linkleri
    // (yer imleri, gonderilmis e-postalar) sessizce yeni bicime cevrilir.
    let raw = window.location.pathname.replace(/^\/+|\/+$/g, '') + window.location.search;
    const legacyHash = window.location.hash.replace(/^#/, '');
    if (legacyHash) {
      raw = legacyHash;
      history.replaceState(null, '', '/' + legacyHash);
    }
    if (!raw) raw = 'landing';
    const [route, query = ''] = raw.split('?');
    this.referralCode = new URLSearchParams(query).get('ref');
    if (route.startsWith('blog/')) await this.loadBlogPostDetail(decodeURIComponent(route.slice(5)), false);
    else if (route === 'register') this.showAuthPage('register');
    else if (route === 'reset-password') await this.completePasswordReset(new URLSearchParams(query).get('token'));
    else if (route === 'verify-email') await this.completeEmailVerification(new URLSearchParams(query).get('token'));
    else if (route === 'payment-success' || route === 'payment-failed') await this.showPaymentResult(route === 'payment-success', query);
    else if (!document.getElementById(`view-${route}`) && document.getElementById('view-landing-page')?.dataset.lpSlug === route) {
      // Satis sayfasi (sunucu SSR ile basti); makine ve tablo canli veriyle hidrate edilir.
      await this.openLandingPage(route, false);
    }
    else {
      this.navigate(route, false);
      const linkedServiceId = Number(new URLSearchParams(query).get('service'));
      if (route === 'services' && linkedServiceId) this.openServiceFromBlog(linkedServiceId, false);
    }

    // Giris sirasinda tam sayfa yuklemesi olduysa siparis makinesindeki secim
    // burada forma tasinir.
    try {
      const bekleyen = sessionStorage.getItem('bekleyenMakineSecimi');
      if (bekleyen) {
        sessionStorage.removeItem('bekleyenMakineSecimi');
        const { serviceId, quantity } = JSON.parse(bekleyen);
        if (serviceId) setTimeout(() => this.applyMachineSelection(serviceId, quantity), 150);
      }
    } catch {}

    // Tarayici geri/ileri dugmeleri: adres degisince ilgili gorunume gecilir.
    window.addEventListener('popstate', () => {
      const path = window.location.pathname.replace(/^\/+|\/+$/g, '') || 'landing';
      const [popRoute] = path.split('?');
      if (popRoute.startsWith('blog/')) this.loadBlogPostDetail(decodeURIComponent(popRoute.slice(5)), false);
      else if (!document.getElementById(`view-${popRoute}`) && /^[a-z0-9-]+$/.test(popRoute)) this.openLandingPage(popRoute, false);
      else this.navigate(popRoute, false);
    });
  }

  updateUserHeader() {
    // Satis sayfasi acikken oturum sonradan yuklenirse dugme metni de guncellenir.
    this.updateLpCta();
    const badge = document.getElementById('user-header-badge');
    const authNavs = document.querySelectorAll('.auth-required');
    const adminNavs = document.querySelectorAll('.admin-only');

    if (this.currentUser) {
      badge.innerHTML = `
        <div class="balance-pill"><i class="fa-solid fa-wallet"></i> ₺${parseFloat(this.currentUser.balance).toFixed(2)}</div>
        <button class="btn btn-outline btn-sm" onclick="app.navigate('profile')" title="${this.ui('Profilim', 'My Profile')}">
          <i class="fa-solid fa-user-circle"></i> ${this.currentUser.username}
        </button>
        <button class="btn btn-outline btn-sm" onclick="app.logout()" title="Çıkış Yap" aria-label="Çıkış Yap">
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

  navigate(viewName, push = true) {
    // Yetki kontrolu ONCE calisir. Sunucu panel ici gorunumleri yalnizca
    // oturum acmis ziyaretciye gonderdigi icin (bkz. utils/gatedMarkup.js),
    // asagidaki "gorunum var mi" kontrolu once calissaydi cikis yapmis bir
    // kullanici /orders adresinde giris ekrani yerine ana sayfayi gorurdu.
    if (['new-order', 'orders', 'add-funds', 'tickets', 'profile'].includes(viewName) && !this.currentUser) {
      this.showAuthPage('login');
      return;
    }

    if (viewName === 'admin' && (!this.currentUser || this.currentUser.role !== 'admin')) {
      showToast('Bu alana erişim yetkiniz yok.', 'error');
      return;
    }

    // Oturum acildi ama sayfa oturumsuzken yuklendiyse gorunumun isaretlemesi
    // henuz gelmemistir; tam yukleme ile sunucudan istenir.
    if (!document.getElementById(`view-${viewName}`) && this.currentUser) {
      window.location.assign(viewName === 'landing' ? '/' : `/${viewName}`);
      return;
    }

    // Bilinmeyen adresler ana sayfaya duser (bos ekran yerine).
    if (!document.getElementById(`view-${viewName}`)) viewName = 'landing';

    this.currentView = viewName;
    // Temiz adres: #hash yerine gercek yol (ana sayfa "/", digerleri "/gorunum").
    if (push) history.pushState({ view: viewName }, '', viewName === 'landing' ? '/' : `/${viewName}`);
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
    // Mobil panelden gelen gecislerde menu acik kalmamali.
    this.closeMobileMenu();

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
    } else if (viewName === 'add-funds') {
      this.initAddFundsView();
    } else if (viewName === 'orders') {
      this.loadUserOrders();
      this.loadTelegramConnectCard();
    } else if (viewName === 'profile') {
      this.loadProfileView();
      this.loadApiKey();
    } else if (viewName === 'api-docs') {
      this.loadApiKey();
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
        const announcement = (this.locale === 'en'
          ? (data.settings.announcement_en || (announcementTr === announcementDefaultTr
            ? '🚀 Spring Campaign: 20% off Instagram and TikTok follower services with instant delivery!'
            : announcementTr))
          : announcementTr) || '';
        const bar = document.getElementById('announcement-bar');
        // Duyuru bosaltildiysa band tamamen gizlenir. Eskiden bos deger atlanip
        // HTML'deki eski metin ekranda kaliyordu; duyuru bir turlu silinemiyordu.
        if (announcement.trim()) {
          if (textEl) textEl.innerText = announcement;
          if (bar) bar.style.display = '';
        } else if (bar) {
          bar.style.display = 'none';
        }
        // Acilisa ozel kutlama modu: duyuru bandi animasyonlu kutlama stiline gecer.
        if (bar) bar.classList.toggle('announcement-launch', data.settings.announcement_special === '1');
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

      // Kampanya vitrini: popup, sosyal kanit seridi ve bakiye bonus bandi.
      this.activePopup = data.popup || null;
      this.depositBonus = data.depositBonus || null;
      this.liveFeed = data.liveFeed || [];
      this.reviews = data.reviews || [];
      this.renderReviewsTicker();
      this.renderServicesReviews();
      this.paymentMethods = data.paymentMethods || {};
      this.bankAccountsRaw = data.settings?.bank_accounts || '';
      this.siteName = (data.settings?.site_name || 'Jet SMM Panel').trim();
      this.blogAuthorName = (data.settings?.blog_author_name || '').trim();
      this.blogAuthorUrl = (data.settings?.blog_author_url || '').trim();
      if (data.settings?.telegram_link) this.updateTelegramLinks(data.settings.telegram_link);
      this.renderSocialLinks(data.settings || {});
      this.renderBusinessAddress(data.settings || {});
      this.maybeShowPromoPopup();
      this.startSocialProofTicker();
      this.renderDepositBonusBanner();
    } catch (err) {
      console.error('Failed to load services:', err);
    }
  }

  // === KAMPANYA VİTRİNİ ======================================================

  // Fiyat gosteriminde kullanilacak efektif (indirimliyse indirimli) 1000'lik fiyat.
  effectiveRate(service) {
    return service?.discounted_rate_per_1000 ?? Number(service?.rate_per_1000 || 0);
  }

  // Ustu cizili eski fiyat + indirimli fiyat + %chip (HTML dondurur).
  renderPriceHtml(service) {
    const current = `₺${this.effectiveRate(service).toFixed(2)}`;
    if (!service?.discount_percent) return current;
    return `<span class="price-strike">₺${Number(service.rate_per_1000).toFixed(2)}</span>${current}<span class="discount-chip">-%${service.discount_percent}</span>`;
  }

  // --- POPUP ---
  maybeShowPromoPopup() {
    const popup = this.activePopup;
    const root = document.getElementById('promo-popup-root');
    if (!popup || !root || root.childElementCount) return;
    // Admin panelde calisirken popup gosterilmez.
    if (this.currentUser?.role === 'admin') return;

    // Gosterim sikligi: localStorage'daki son gosterim zamani esik altindaysa atla.
    const storageKey = `promo_seen_${popup.id}`;
    const lastSeen = Number(localStorage.getItem(storageKey) || 0);
    const frequencyMs = (popup.popup_frequency_hours || 24) * 3600 * 1000;
    if (Date.now() - lastSeen < frequencyMs) return;

    const isDiscount = popup.type === 'service_discount';
    const en = this.locale === 'en';
    const isOpening = popup.popup_template === 'opening';
    const badge = isDiscount ? `-%${popup.discount_percent}` : `+%${popup.bonus_percent}`;
    const defaultTitle = isDiscount
      ? (en ? `${popup.discount_percent}% OFF on ${popup.service_name}!` : `${popup.service_name} şimdi %${popup.discount_percent} indirimli!`)
      : (en ? `${popup.bonus_percent}% bonus on every deposit!` : `Her bakiye yüklemene %${popup.bonus_percent} bonus!`);
    const sub = isDiscount
      ? (en ? 'Order through this campaign and the discount is applied automatically.' : 'Bu kampanyadan siparişe git, indirim otomatik uygulansın.')
      : (en ? 'Top up now and the bonus lands instantly.' : 'Hemen bakiye yükle, bonus anında hesabına geçsin.');
    const cta = isDiscount ? (en ? '🛒 Grab the Deal' : '🛒 İndirimi Kap') : (en ? '💳 Top Up Now' : '💳 Bakiye Yükle');
    // Ozel baslik dile gore secilir: EN'de once popup_title_en, yoksa TR, yoksa otomatik.
    const customTitle = en ? (popup.popup_title_en || popup.popup_title) : popup.popup_title;

    const overlay = document.createElement('div');
    overlay.className = 'promo-overlay';
    overlay.innerHTML = `
      <div class="promo-box tpl-${this.escapeHtml(popup.popup_template || 'flash')}" role="dialog" aria-modal="true">
        <button type="button" class="promo-close" aria-label="Kapat">✕</button>
        ${isOpening ? `<div class="promo-ribbon">🎉 ${en ? 'GRAND OPENING SPECIAL' : 'AÇILIŞA ÖZEL'} 🎉</div>` : ''}
        <div class="promo-badge">${this.escapeHtml(badge)}</div>
        <div class="promo-title">${this.escapeHtml(customTitle || defaultTitle)}</div>
        ${popup.popup_template === 'countdown' && popup.ends_at ? '<div class="promo-countdown" id="promo-countdown">--:--:--</div>' : ''}
        <div class="promo-sub">${this.escapeHtml(sub)}</div>
        <button type="button" class="promo-cta">${this.escapeHtml(cta)} <i class="fa-solid fa-arrow-right"></i></button>
      </div>`;

    const close = () => {
      localStorage.setItem(storageKey, String(Date.now()));
      if (this.promoCountdownTimer) clearInterval(this.promoCountdownTimer);
      overlay.remove();
    };
    overlay.querySelector('.promo-close').onclick = close;
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    overlay.querySelector('.promo-cta').onclick = () => {
      API.campaignEvent(popup.id, 'click').catch(() => {});
      close();
      if (isDiscount) this.goToDiscountedOrder(popup.service_id);
      else if (this.currentUser) this.navigate('add-funds');
      else this.showAuthPage('register');
    };

    // Geri sayimli sablonda kalan sure canli islenir.
    if (popup.popup_template === 'countdown' && popup.ends_at) {
      const tick = () => {
        const el = document.getElementById('promo-countdown');
        if (!el) return;
        const left = Math.max(0, new Date(popup.ends_at).getTime() - Date.now());
        const h = Math.floor(left / 3600000), m = Math.floor(left % 3600000 / 60000), sn = Math.floor(left % 60000 / 1000);
        el.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sn).padStart(2, '0')}`;
        if (left <= 0) { clearInterval(this.promoCountdownTimer); close(); }
      };
      this.promoCountdownTimer = setInterval(tick, 1000);
      tick();
    }

    root.appendChild(overlay);
    API.campaignEvent(popup.id, 'view').catch(() => {});
  }

  // Popup'tan tek tikla on secimli siparise gecis.
  async goToDiscountedOrder(serviceId) {
    if (!this.currentUser) { try { await this.ready; } catch {} }
    if (this.currentUser) {
      this.navigate('new-order');
      setTimeout(() => {
        const service = this.allServices.find(s => s.id === Number(serviceId));
        this.applyMachineSelection(Number(serviceId), service?.min_quantity || 100);
      }, 150);
    } else {
      // Kayit sonrasi secim forma tasinir (siparis makinesiyle ayni akis).
      const service = this.allServices.find(s => s.id === Number(serviceId));
      this.pendingMachineOrder = { serviceId: Number(serviceId), quantity: service?.min_quantity || 100 };
      this.showAuthPage('register');
    }
  }

  // --- SOSYAL KANIT ŞERİDİ ---
  startSocialProofTicker() {
    const root = document.getElementById('social-proof-ticker');
    if (!root || !this.liveFeed?.length) return;
    if (sessionStorage.getItem('proof_dismissed') === '1') return;
    if (this.proofTimer) return; // zaten calisiyor

    let index = 0;
    const timeAgo = createdAt => {
      const minutes = Math.max(1, Math.round((Date.now() - new Date(createdAt + 'Z').getTime()) / 60000));
      if (this.locale === 'en') return minutes < 60 ? `${minutes} min ago` : `${Math.round(minutes / 60)} hr ago`;
      return minutes < 60 ? `${minutes} dk önce` : `${Math.round(minutes / 60)} saat önce`;
    };
    const show = () => {
      // Admin panelinde serit gosterilmez.
      if (document.body.classList.contains('admin-view-active')) { root.style.display = 'none'; return; }
      const item = this.liveFeed[index % this.liveFeed.length];
      index++;
      root.innerHTML = `
        <div class="proof-card">
          <i class="fa-solid fa-bolt proof-icon"></i>
          <div>
            <strong>${this.escapeHtml(item.username)} ${this.locale === 'en' ? 'ordered' : 'sipariş verdi'}</strong>
            <small>${Number(item.quantity).toLocaleString(this.locale === 'en' ? 'en-US' : 'tr-TR')} × ${this.escapeHtml(String(item.service_name).slice(0, 42))} • ${timeAgo(item.created_at)}</small>
          </div>
          <button type="button" class="proof-close" aria-label="Kapat">✕</button>
        </div>`;
      root.style.display = 'block';
      root.querySelector('.proof-close').onclick = () => {
        sessionStorage.setItem('proof_dismissed', '1');
        clearInterval(this.proofTimer);
        this.proofTimer = null;
        root.style.display = 'none';
      };
      // 6 sn goster, 9 sn ara ver.
      setTimeout(() => { if (root.style.display !== 'none' && !document.body.classList.contains('admin-view-active')) root.style.display = 'none'; }, 6000);
    };
    show();
    this.proofTimer = setInterval(show, 15000);
  }

  // --- BAKİYE BONUS BANDI ---
  renderDepositBonusBanner() {
    const banner = document.getElementById('deposit-bonus-banner');
    if (!banner) return;
    if (!this.depositBonus) { banner.style.display = 'none'; banner.innerHTML = ''; return; }
    const bonus = this.depositBonus;
    const min = Number(bonus.min_deposit) > 0
      ? (this.locale === 'en' ? ` (min ₺${bonus.min_deposit})` : ` (en az ₺${bonus.min_deposit})`)
      : '';
    banner.innerHTML = `
      <div class="bonus-banner">
        <i class="fa-solid fa-gift"></i>
        <div>${this.locale === 'en'
          ? `Active campaign: <strong>+${bonus.bonus_percent}% bonus</strong> on every deposit${min}. Applied automatically!`
          : `Aktif kampanya: Her bakiye yüklemene <strong>+%${bonus.bonus_percent} bonus</strong>${min}. Otomatik uygulanır!`}</div>
      </div>`;
    banner.style.display = 'block';
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
    // Kampanya indirimi varsa makine fiyati da indirimli hesaplanir.
    const charge = (this.effectiveRate(service) / 1000) * qty;
    const usdCharge = (Number(service.rate_per_1000_usd_cents || 0) / 100000) * qty;
    priceEl.textContent = this.locale === 'en' && usdCharge > 0 && !service.discount_percent
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
    this.updateLandingAside(filtered);

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
          <td class="cell-service-title" title="${this.escapeHtml(s.name)}"><span class="service-name-clamp">${this.escapeHtml(s.name)}</span></td>
          <td class="cell-nowrap price-cell">${s.discount_percent ? this.renderPriceHtml(s) : this.formatServicePrice(s)}</td>
          <td class="cell-nowrap">${s.min_quantity} - ${s.max_quantity}</td>
          <td class="cell-nowrap">
            ${isRefill ? `<span class="badge badge-completed"><i class="fa-solid fa-shield-check"></i> ${this.t('guaranteed')}</span>` : `<span class="badge badge-pending">${this.t('standard')}</span>`}
          </td>
          <td class="cell-nowrap" style="text-align: right;">
            <div class="service-row-actions">
              <button type="button" class="btn btn-outline btn-sm service-info-btn" onclick="app.openServiceInfoModal(${s.id})" title="${this.t('info.button')}" aria-label="${this.t('info.button')}">
                <i class="fa-solid fa-circle-info"></i><span class="service-info-btn-text"> ${this.t('info.button')}</span>
              </button>
              <button class="btn btn-primary btn-sm" onclick="app.selectServiceForOrder(${s.id})">
                ${this.t('order_now')}
              </button>
            </div>
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

  // scrollToList: mozaik kartlarından gelindiğinde liste görünür alana getirilir.
  filterLandingCategory(catName, scrollToList = false) {
    this.selectedPlatform = this.decodeArg(catName);
    this.renderLandingServices();
    if (!scrollToList) return;
    const target = document.getElementById('landing-live-services');
    if (!target) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  // Liste bölümünün sol sütunundaki canlı özet.
  updateLandingAside(filteredServices) {
    const countEl = document.getElementById('landing-aside-services');
    const priceEl = document.getElementById('landing-aside-price');
    const platformEl = document.getElementById('landing-aside-platform');
    if (!countEl && !priceEl && !platformEl) return;

    const services = filteredServices || [];
    const numberLocale = this.locale === 'en' ? 'en-US' : 'tr-TR';

    if (countEl) countEl.textContent = services.length.toLocaleString(numberLocale);

    if (priceEl) {
      const rates = services.map(s => Number(s.rate_per_1000)).filter(r => Number.isFinite(r) && r > 0);
      priceEl.textContent = rates.length
        ? `₺${Math.min(...rates).toLocaleString(numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : '—';
    }

    if (platformEl) {
      const active = this.getMainPlatforms().find(p => p.id === this.selectedPlatform);
      platformEl.textContent = active ? active.name : (this.selectedPlatform || this.ui('Tümü', 'All'));
    }
  }

  selectServiceForOrder(serviceId) {
    if (!this.currentUser) {
      this.showAuthPage('login');
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

  // --- SERVIS BILGI PENCERESI ---
  // Admin panelde girilen baslama suresi / hiz / ozellik / aciklama alanlarini
  // aktif dile gore toplar. Ozellikler satir satir saklanir.
  serviceInfoOf(service) {
    const pick = (tr, en) => {
      const value = this.locale === 'en' ? (en || tr) : (tr || en);
      return String(value || '').trim();
    };
    const features = pick(service.features_tr, service.features_en)
      .split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const guaranteed = service.refill == 1 || /telafi|garanti|refill|düşüşsüz|non-drop|30 gün|60 gün|90 gün|365 gün/i.test(`${service.name} ${service.category_name}`);
    return {
      startTime: pick(service.start_time_tr, service.start_time_en),
      speed: pick(service.speed_tr, service.speed_en),
      description: String(service.description || '').trim(),
      features,
      guaranteed
    };
  }

  // Bilgi kartlari: sipariş sayfasindaki kutuda ve "i" popup'inda ortak kullanilir.
  renderServiceInfoDetails(service, { withDescription = true, withLimits = false } = {}) {
    const info = this.serviceInfoOf(service);
    const stats = [];
    if (info.startTime) stats.push({ icon: 'fa-clock', label: this.t('info.start_time'), value: info.startTime });
    if (info.speed) stats.push({ icon: 'fa-gauge-high', label: this.t('info.speed'), value: info.speed });
    stats.push({
      icon: info.guaranteed ? 'fa-shield-check' : 'fa-bolt',
      label: this.t('info.guarantee'),
      value: info.guaranteed ? this.t('guaranteed') : this.t('standard'),
      tone: info.guaranteed ? 'ok' : 'muted'
    });
    if (withLimits) stats.push({ icon: 'fa-arrows-left-right', label: this.t('info.min_max'), value: `${service.min_quantity} - ${service.max_quantity}` });

    let html = `<div class="service-info-grid">${stats.map(stat => `
      <div class="service-info-stat ${stat.tone ? `tone-${stat.tone}` : ''}">
        <i class="fa-solid ${stat.icon}"></i>
        <div><small>${this.escapeHtml(stat.label)}</small><strong>${this.escapeHtml(stat.value)}</strong></div>
      </div>`).join('')}</div>`;

    if (info.features.length) {
      html += `<div class="service-info-block"><div class="service-info-block-title"><i class="fa-solid fa-list-check"></i> ${this.t('info.features')}</div>
        <ul class="service-info-features">${info.features.map(f => `<li><i class="fa-solid fa-check"></i> ${this.escapeHtml(f)}</li>`).join('')}</ul></div>`;
    }
    if (withDescription && info.description) {
      html += `<div class="service-info-block"><div class="service-info-block-title"><i class="fa-solid fa-align-left"></i> ${this.t('info.description')}</div>
        <p class="service-info-desc-text">${this.escapeHtml(info.description)}</p></div>`;
    }
    return html;
  }

  openServiceInfoModal(serviceId) {
    const service = this.allServices.find(s => s.id === serviceId);
    if (!service) return;
    this.serviceInfoModalId = serviceId;
    document.getElementById('service-info-category').textContent = service.category_name || '';
    document.getElementById('service-info-title').textContent = `#${service.id} · ${service.name}`;
    document.getElementById('service-info-modal-body').innerHTML = this.renderServiceInfoDetails(service, { withDescription: true, withLimits: true });
    document.getElementById('service-info-price-label').textContent = this.t('info.price_1000');
    document.getElementById('service-info-price').innerHTML = service.discount_percent ? this.renderPriceHtml(service) : this.formatServicePrice(service);
    const buyBtn = document.getElementById('service-info-buy-btn');
    if (buyBtn) buyBtn.innerHTML = `<i class="fa-solid fa-cart-shopping"></i> ${this.t('info.buy')}`;
    document.getElementById('modal-service-info').classList.add('active');
  }

  buyFromServiceInfo() {
    const serviceId = this.serviceInfoModalId;
    this.closeModal('modal-service-info');
    if (serviceId) this.selectServiceForOrder(serviceId);
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
      const extraEmpty = document.getElementById('service-info-extra');
      if (extraEmpty) extraEmpty.innerHTML = '';
      this.updateOrderLinkHint(null);
      return;
    }

    document.getElementById('service-desc').innerText = service.description || this.ui('Hızlı ve otomatik aktarımlı sosyal medya hizmeti.', 'Fast, automatically delivered social media service.');
    document.getElementById('service-rate').innerText = this.formatServicePrice(service);
    document.getElementById('service-limits').innerText = `${service.min_quantity} - ${service.max_quantity}`;
    // Baslama suresi / hiz / ozellik kartlari (admin doldurduysa).
    const extra = document.getElementById('service-info-extra');
    if (extra) extra.innerHTML = this.renderServiceInfoDetails(service, { withDescription: false });

    this.updateOrderLinkHint(service);
    this.calculateOrderCharge();
  }

  // Secilen servisin profil mi yoksa gonderi linki mi istedigini onceden soyler.
  // Sunucu tarafinda da ayni kontrol var; bu yalnizca kullaniciyi hata almadan
  // once uyarmak icin.
  updateOrderLinkHint(service) {
    const hint = document.getElementById('order-link-hint');
    const input = document.getElementById('order-link-input');
    if (!hint) return;
    if (!service) { hint.style.display = 'none'; return; }

    const text = `${service.name || ''} ${service.category_name || ''}`
      .replace(/İ/g, 'I').replace(/ı/g, 'i').toLowerCase();

    const profilServisi = /follower|subscriber|abone|takipci|takipçi|member|üye|uye|\bfan/.test(text);
    const hikayeServisi = /stor(y|ies)|hikaye|hikâye/.test(text);
    const gonderiServisi = /like|beğeni|begeni|view|izlen|comment|yorum|share|paylaş|repost|retweet|save/.test(text);

    let mesaj = '', ipucu = '';
    if (hikayeServisi) {
      mesaj = this.ui('Bu servis HİKÂYE bağlantısı istiyor.', 'This service needs a STORY link.');
      ipucu = 'https://instagram.com/stories/kullaniciadi/123...';
    } else if (profilServisi) {
      mesaj = this.ui('Bu servis PROFİL bağlantısı veya kullanıcı adı istiyor. Gönderi linki göndermeyin.',
        'This service needs a PROFILE link or username. Do not send a post link.');
      ipucu = 'https://instagram.com/kullaniciadi';
    } else if (gonderiServisi) {
      mesaj = this.ui('Bu servis GÖNDERİ/VİDEO bağlantısı istiyor. Profil linki göndermeyin.',
        'This service needs a POST/VIDEO link. Do not send a profile link.');
      ipucu = 'https://instagram.com/p/Cxxxxxxxxxx/';
    } else {
      hint.style.display = 'none';
      return;
    }

    hint.innerHTML = `<i class="fa-solid fa-circle-info"></i> <strong>${this.escapeHtml(mesaj)}</strong><br>${this.ui('Örnek', 'Example')}: ${this.escapeHtml(ipucu)}`;
    hint.style.display = 'block';
    if (input) input.placeholder = ipucu;
  }

  calculateOrderCharge() {
    const serviceId = parseInt(document.getElementById('order-service-select').value);
    const qty = parseInt(document.getElementById('order-qty-input').value) || 0;
    const service = this.allServices.find(s => s.id === serviceId);

    if (!service || qty <= 0) {
      document.getElementById('order-calculated-charge').innerText = this.locale === 'en' ? '$0.00 / ₺0.00' : '₺0.00';
      return;
    }

    // Kampanya indirimi varsa siparis formu da indirimli fiyati kullanir
    // (sunucu tarafi hesapla birebir ayni).
    let charge = (this.effectiveRate(service) / 1000) * qty;

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
      const res = await API.createOrder(service_id, link, quantity, dripRuns, dripInterval, this.locale === 'en' ? 'en' : 'tr');
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
          <td class="cell-service-title" title="${this.escapeHtml(s.name)}"><span class="service-name-clamp">${this.escapeHtml(s.name)}</span></td>
          <td class="cell-nowrap price-cell">${s.discount_percent ? this.renderPriceHtml(s) : this.formatServicePrice(s)}</td>
          <td class="cell-nowrap">${s.min_quantity} - ${s.max_quantity}</td>
          <td class="cell-nowrap">
            ${isRefill ? `<span class="badge badge-completed"><i class="fa-solid fa-shield-check"></i> ${this.t('guaranteed')}</span>` : `<span class="badge badge-pending">${this.t('standard')}</span>`}
          </td>
          <td class="cell-nowrap" style="text-align: right;">
            <div class="service-row-actions">
              <button type="button" class="btn btn-outline btn-sm service-info-btn" onclick="app.openServiceInfoModal(${s.id})" title="${this.t('info.button')}" aria-label="${this.t('info.button')}">
                <i class="fa-solid fa-circle-info"></i><span class="service-info-btn-text"> ${this.t('info.button')}</span>
              </button>
              <button class="btn btn-primary btn-sm" onclick="app.selectServiceForOrder(${s.id})">
                ${this.t('order_now')}
              </button>
            </div>
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
      // Deneyim paylasimi karti: tamamlanmis siparisi olan kullaniciya gorunur
      // (sunucu ayrica "siparis basina bir yorum" kuralini uygular).
      const reviewCard = document.getElementById('review-invite-card');
      if (reviewCard) reviewCard.style.display = (res.orders || []).some(o => o.status === 'completed') ? 'block' : 'none';
      if (!res.orders || res.orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center">${this.ui('Henüz bir siparişiniz bulunmamaktadır.', 'You do not have any orders yet.')}</td></tr>`;
        return;
      }

      tbody.innerHTML = res.orders.map(o => {
        let badgeClass = 'badge-pending';
        let statusText = this.ui('Beklemede', 'Pending');
        if (o.status === 'completed') { badgeClass = 'badge-completed'; statusText = this.ui('Tamamlandı', 'Completed'); }
        else if (o.status === 'processing' || o.status === 'in_progress') { badgeClass = 'badge-processing'; statusText = this.ui('İşleniyor', 'Processing'); }
        else if (o.status === 'partial') { badgeClass = 'badge-processing'; statusText = this.ui('Kısmi Tamamlandı', 'Partially Completed'); }
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
  // === BAKİYE YÜKLEME EKRANI =================================================

  // Gorunum acildiginda: yapilandirilmamis yontem kartlari gizlenir, gorunur
  // ilk yontem secili hale getirilir.
  initAddFundsView() {
    const methods = this.paymentMethods || {};
    const tiles = document.querySelectorAll('#pay-method-tiles .pay-tile');
    let firstVisible = null;
    tiles.forEach(tile => {
      const method = tile.dataset.method;
      // Havale/Papara her zaman acik; kart (PayTR/Shopier) ve kripto
      // yapilandirmaya bagli.
      const visible = method === 'bank' ? true
        : method === 'paytr' ? methods.paytr !== false
          : method === 'shopier' ? methods.shopier === true
            : methods.crypto === true;
      tile.style.display = visible ? '' : 'none';
      if (visible && !firstVisible) firstVisible = method;
    });
    const current = this.selectedPayMethod;
    const currentVisible = current && [...tiles].some(t => t.dataset.method === current && t.style.display !== 'none');
    this.selectPayMethod(currentVisible ? current : (firstVisible || 'bank'));
    // Onceki oturumdan kalan kripto bekleme kutusu temizlenir.
    const waitBox = document.getElementById('crypto-wait-box');
    if (waitBox && !this.cryptoPollTimer) { waitBox.style.display = 'none'; waitBox.innerHTML = ''; }
    this.renderBankAccounts();
  }

  // Admin panelde tanimlanan Havale/Papara hesaplarini (IBAN dahil) isler ve
  // bildirim formundaki banka secimini ayni listeyle doldurur.
  // Satir bicimi: "Banka Adı | Hesap Sahibi | IBAN veya Papara No"
  renderBankAccounts() {
    const container = document.getElementById('deposit-bank-accounts');
    const select = document.getElementById('notif-bank-select');
    if (!container) return;

    const accounts = String(this.bankAccountsRaw || '')
      .split('\n')
      .map(line => line.split('|').map(part => part.trim()))
      .filter(parts => parts[0] && parts.length >= 2)
      .map(parts => ({ bank: parts[0], holder: parts.length >= 3 ? parts[1] : '', iban: parts[parts.length - 1] }));

    if (!accounts.length) {
      container.innerHTML = `<p style="font-size: .85rem; color: var(--text-dim);">${this.ui(
        'Hesap bilgileri yakında eklenecek. Şimdilik destek ekibiyle iletişime geçebilirsin.',
        'Account details will be added soon. Please contact support in the meantime.'
      )}</p>`;
      return;
    }

    container.innerHTML = accounts.map(account => `
      <div class="bank-account-card">
        <i class="fa-solid ${/papara/i.test(account.bank) ? 'fa-wallet' : 'fa-building-columns'} bank-ico"></i>
        <div class="bank-info">
          <strong>${this.escapeHtml(account.bank)}</strong>
          ${account.holder ? `<small>${this.escapeHtml(account.holder)}</small>` : ''}
          <div class="bank-iban">${this.escapeHtml(account.iban)}</div>
        </div>
        <button type="button" class="btn btn-outline btn-sm" onclick="app.copyIban('${this.escapeHtml(account.iban)}', this)">
          <i class="fa-solid fa-copy"></i> ${this.ui('Kopyala', 'Copy')}
        </button>
      </div>
    `).join('');

    // Bildirim formundaki secenekler de ayni hesaplardan gelir.
    if (select) {
      select.innerHTML = accounts
        .map(account => `<option value="${this.escapeHtml(`${account.bank} (${account.iban})`.slice(0, 120))}">${this.escapeHtml(account.bank)}${account.holder ? ` — ${this.escapeHtml(account.holder)}` : ''}</option>`)
        .join('');
    }
  }

  async copyIban(iban, button) {
    try {
      await navigator.clipboard.writeText(iban.replace(/\s+/g, ''));
      const original = button.innerHTML;
      button.innerHTML = `<i class="fa-solid fa-check"></i> ${this.ui('Kopyalandı', 'Copied')}`;
      setTimeout(() => { button.innerHTML = original; }, 1800);
    } catch {
      showToast(this.ui('Kopyalanamadı; adresi elle seçip kopyalayabilirsin.', 'Could not copy; please select and copy the address manually.'), 'warning');
    }
  }

  // Yontem bazli alt limit: kripto blockchain ucretleri nedeniyle yuksektir.
  // Kripto icin secili coinin sunucudan cekilen gercek limiti kullanilir.
  depositMinFor(method) {
    return method === 'crypto' ? (this.coinMinTry || 400) : 10;
  }

  // Secili coinin TL alt limitini ceker; gelince tum tutar arayuzunu tazeler.
  async refreshCoinMin() {
    if (!this.selectedCoin) return;
    const coinAtRequest = this.selectedCoin;
    try {
      const res = await API.getCryptoMin(coinAtRequest);
      // Kullanici bu arada baska coine gectiyse sonuc uygulanmaz.
      if (this.selectedCoin !== coinAtRequest) return;
      this.coinMinTry = Number(res.min_try) || 400;
    } catch {
      this.coinMinTry = 400;
    }
    this.applyDepositMinUi();
  }

  // Alt limit degistiginde hizli secim haplari, placeholder ve not guncellenir.
  applyDepositMinUi() {
    if (this.selectedPayMethod !== 'crypto') return;
    const min = this.depositMinFor('crypto');
    document.querySelectorAll('.amount-chips button').forEach(chip => {
      chip.style.display = Number(chip.dataset.amount) < min ? 'none' : '';
    });
    const amountInput = document.getElementById('payment-amount-input');
    if (amountInput) { amountInput.min = min; amountInput.placeholder = String(min); }
    const note = document.getElementById('deposit-method-note');
    if (note) {
      const coin = (this.cryptoCoins || []).find(c => c.code === this.selectedCoin);
      const coinName = coin ? `${coin.label} (${coin.network})` : this.ui('Bu coin', 'This coin');
      note.textContent = this.ui(
        `${coinName} için minimum ₺${min}. Sana özel adres ve QR kod oluşturulur; gönderim onaylanınca bakiyen otomatik yüklenir.`,
        `Minimum for ${coinName}: ₺${min}. A unique address and QR code will be generated; your balance is added automatically once the transfer is confirmed.`
      );
    }
    this.validateDepositAmount();
  }

  selectPayMethod(method) {
    this.selectedPayMethod = method;
    document.querySelectorAll('#pay-method-tiles .pay-tile').forEach(tile => {
      tile.classList.toggle('active', tile.dataset.method === method);
    });
    const amountArea = document.getElementById('deposit-amount-area');
    const bankArea = document.getElementById('deposit-bank-area');
    if (amountArea) amountArea.style.display = method === 'bank' ? 'none' : 'block';
    if (bankArea) bankArea.style.display = method === 'bank' ? 'block' : 'none';

    // Alt limitin altindaki hizli secim duymeleri bu yontemde gizlenir.
    const min = this.depositMinFor(method);
    document.querySelectorAll('.amount-chips button').forEach(chip => {
      chip.style.display = Number(chip.dataset.amount) < min ? 'none' : '';
    });
    const amountInput = document.getElementById('payment-amount-input');
    if (amountInput) {
      amountInput.min = min;
      amountInput.placeholder = String(min === 400 ? 400 : 100);
    }
    this.validateDepositAmount();

    // Coin secici yalnizca kripto yonteminde gorunur; adim numarasi kayar.
    const coinPicker = document.getElementById('crypto-coin-picker');
    if (coinPicker) coinPicker.style.display = method === 'crypto' ? 'block' : 'none';
    const payStepNum = document.getElementById('deposit-pay-step-num');
    if (payStepNum) payStepNum.textContent = method === 'crypto' ? '4' : '3';
    if (method === 'crypto') this.loadCryptoCoins();

    const submit = document.getElementById('deposit-submit-btn');
    const note = document.getElementById('deposit-method-note');
    if (submit && note) {
      if (method === 'crypto') {
        submit.innerHTML = `<i class="fa-brands fa-bitcoin"></i> ${this.ui('Ödeme Adresi Oluştur', 'Generate Payment Address')}`;
        note.textContent = this.ui(
          'Sana özel adres ve QR kod oluşturulur; gönderim onaylanınca bakiyen otomatik yüklenir.',
          'A unique address and QR code will be generated for you; your balance is added automatically once the transfer is confirmed.'
        );
      } else if (method === 'shopier') {
        submit.innerHTML = `<i class="fa-solid fa-lock"></i> ${this.ui('Güvenli Öde — Shopier', 'Pay Securely — Shopier')}`;
        note.textContent = this.ui(
          "Kart bilgilerin Shopier'in güvenli sayfasında işlenir; sitemizde saklanmaz. Ödeme onaylanınca bakiyen otomatik yüklenir.",
          "Your card details are processed on Shopier's secure page; we never store them. Your balance is added automatically once the payment is approved."
        );
      } else {
        submit.innerHTML = `<i class="fa-solid fa-lock"></i> ${this.ui('Güvenli Öde — Kart', 'Pay Securely — Card')}`;
        note.textContent = this.ui(
          "Kart bilgilerin PayTR'nin güvenli sayfasında işlenir; sitemizde saklanmaz.",
          "Your card details are processed on PayTR's secure page; we never store them."
        );
      }
    }
    // Coin listesi onbellekteyse alt limit arayuzu hemen tazelenir
    // (yeni yukleniyorsa selectCoin zinciri zaten tazeleyecek).
    if (method === 'crypto' && this.cryptoCoins) this.applyDepositMinUi();
  }

  // --- KRİPTO: COİN SEÇİMİ + SİTE İÇİ ÖDEME EKRANI ---

  async loadCryptoCoins() {
    if (this.cryptoCoins) { this.renderCoinChips(); return; }
    try {
      const res = await API.getCryptoCurrencies();
      this.cryptoCoins = res.coins || [];
      // Onerilen coin (USDT TRC-20) varsayilan secimdir; limiti de hemen cekilir.
      const defaultCoin = (this.cryptoCoins.find(c => c.recommended) || this.cryptoCoins[0])?.code || null;
      if (defaultCoin) this.selectCoin(defaultCoin);
    } catch (err) {
      const chips = document.getElementById('coin-chips');
      if (chips) chips.innerHTML = `<span style="color: var(--danger); font-size: .85rem;">${this.ui('Coin listesi alınamadı', 'Could not load coins')}: ${this.escapeHtml(err.message)}</span>`;
    }
  }

  renderCoinChips() {
    const chips = document.getElementById('coin-chips');
    if (!chips || !this.cryptoCoins) return;
    chips.innerHTML = this.cryptoCoins.map(coin => `
      <button type="button" class="coin-chip${coin.code === this.selectedCoin ? ' active' : ''}" onclick="app.selectCoin('${this.escapeHtml(coin.code)}')">
        <strong>${this.escapeHtml(coin.label)}</strong>
        <small>${this.escapeHtml(coin.network)}</small>
        ${coin.recommended ? `<em>${this.ui('ÖNERİLEN', 'RECOMMENDED')}</em>` : ''}
      </button>
    `).join('');
  }

  selectCoin(code) {
    this.selectedCoin = code;
    this.renderCoinChips();
    // Coin degisince o coinin gercek TL alt limiti cekilir.
    this.coinMinTry = null;
    this.applyDepositMinUi();
    this.refreshCoinMin();
  }

  // Site ici odeme paneli: QR + adres + net miktar + canli durum satiri.
  renderCryptoPaymentPanel(payment) {
    const box = document.getElementById('crypto-wait-box');
    if (!box) return;
    const coin = (this.cryptoCoins || []).find(c => c.code === payment.pay_currency) || { label: String(payment.pay_currency).toUpperCase(), network: '' };
    const amountText = `${payment.pay_amount} ${coin.label}`;
    box.style.display = 'block';
    box.innerHTML = `
      <div class="crypto-pay-panel">
        <div class="crypto-pay-head">
          <i class="fa-brands fa-bitcoin"></i>
          <div><strong>${this.ui(`₺${Number(payment.amount_try).toFixed(2)} karşılığı ödeme`, `Payment worth ₺${Number(payment.amount_try).toFixed(2)}`)}</strong><br>
          <small>${this.ui(
            `Aşağıdaki adrese <b>tam olarak ${this.escapeHtml(amountText)}</b> gönder — tek seferde, tek işlemle.`,
            `Send <b>exactly ${this.escapeHtml(amountText)}</b> to the address below — in a single transaction.`
          )}</small></div>
        </div>
        <div class="crypto-pay-grid">
          <img class="crypto-qr" src="${payment.qr}" alt="${this.ui('Ödeme adresi QR kodu', 'Payment address QR code')}">
          <div class="crypto-pay-fields">
            <label>${this.ui('Gönderilecek Miktar', 'Amount to Send')}</label>
            <div class="crypto-copy-row">
              <b>${this.escapeHtml(amountText)}</b>
              <button type="button" class="btn btn-outline btn-sm" onclick="app.copyIban('${payment.pay_amount}', this)"><i class="fa-solid fa-copy"></i></button>
            </div>
            <label>${this.ui('Adres', 'Address')} <span class="crypto-net">${this.escapeHtml(coin.network)}</span></label>
            <div class="crypto-copy-row crypto-addr">
              <span>${this.escapeHtml(payment.pay_address)}</span>
              <button type="button" class="btn btn-outline btn-sm" onclick="app.copyIban('${this.escapeHtml(payment.pay_address)}', this)"><i class="fa-solid fa-copy"></i></button>
            </div>
            <div class="crypto-status-line" id="crypto-status-line">
              <i class="fa-solid fa-hourglass-half fa-spin"></i> ${this.ui(
                'Ödeme bekleniyor… Onay gelince bakiyen otomatik yüklenecek, bu sayfayı kapatabilirsin.',
                'Waiting for payment… Your balance will be added automatically once confirmed; you can close this page.'
              )}
            </div>
            <small class="crypto-warn-note">${this.ui(
              `⚠️ Yalnızca <b>${this.escapeHtml(coin.network || coin.label)}</b> ağından gönder; farklı ağdan gönderilen para kaybolur. Eksik gönderilen tutar otomatik yüklenmez.`,
              `⚠️ Send only via the <b>${this.escapeHtml(coin.network || coin.label)}</b> network; funds sent over a different network are lost. Underpaid amounts are not credited automatically.`
            )}</small>
          </div>
        </div>
      </div>`;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  setDepositAmount(amount) {
    const input = document.getElementById('payment-amount-input');
    if (input) input.value = amount;
    document.querySelectorAll('.amount-chips button').forEach(chip => {
      chip.classList.toggle('active', Number(chip.dataset.amount) === amount);
    });
    this.validateDepositAmount();
  }

  // Tutar yazilirken canli dogrulama: alt limitin altinda kirmizi uyari
  // gosterilir ve odeme dugmesi kilitlenir.
  validateDepositAmount() {
    const input = document.getElementById('payment-amount-input');
    const warning = document.getElementById('deposit-amount-warning');
    const submit = document.getElementById('deposit-submit-btn');
    if (!input || !warning) return;
    const min = this.depositMinFor(this.selectedPayMethod);
    const amount = parseFloat(input.value);
    const tooLow = input.value !== '' && (!Number.isFinite(amount) || amount < min);

    warning.style.display = tooLow ? 'flex' : 'none';
    if (tooLow) {
      const message = this.selectedPayMethod === 'crypto'
        ? this.ui(
          `Kripto ödemelerde minimum tutar <b>₺${min}</b>'dür (blockchain ağ ücretleri nedeniyle). Daha düşük tutar için kart veya havale kullanabilirsin.`,
          `The minimum for crypto payments is <b>₺${min}</b> (due to blockchain network fees). For smaller amounts use card or bank transfer.`)
        : this.ui(`Minimum yükleme tutarı <b>₺${min}</b>'dur.`, `The minimum top-up amount is <b>₺${min}</b>.`);
      warning.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${message}`;
    }
    if (submit) {
      submit.disabled = tooLow;
      submit.style.opacity = tooLow ? '.5' : '';
      submit.style.cursor = tooLow ? 'not-allowed' : '';
    }
  }

  async handleAddFunds(e) {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('payment-amount-input').value);
    const minAmount = this.depositMinFor(this.selectedPayMethod);
    if (!Number.isFinite(amount) || amount < minAmount) {
      this.validateDepositAmount();
      showToast(this.ui(`Bu yöntem için en az ₺${minAmount} girmelisin.`, `Enter at least ₺${minAmount} for this method.`), 'warning');
      return;
    }

    const submitBtn = document.getElementById('deposit-submit-btn');
    try {
      if (this.selectedPayMethod === 'crypto') {
        if (!this.selectedCoin) {
          showToast(this.ui('Önce bir coin seç.', 'Choose a coin first.'), 'warning');
          return;
        }
        // Adres olusturma birkac saniye surebilir; cift tiklamayi engelle.
        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${this.ui('Adres oluşturuluyor…', 'Generating address…')}`; }
        const res = await API.createCryptoPayment(amount, this.selectedCoin);
        // Odeme ekrani sitenin icinde cizilir; harici sayfa acilmaz.
        this.renderCryptoPaymentPanel(res);
        this.watchCryptoPayment(res.merchant_oid, amount);
      } else if (this.selectedPayMethod === 'shopier') {
        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${this.ui('Ödeme sayfası hazırlanıyor…', 'Preparing payment page…')}`; }
        const res = await API.createShopierPayment(amount);
        // Shopier'in odeme sayfasi kendi alan adinda acilir ve bize geri
        // donmez; bu yuzden yeni sekmede acilir, bu sekme durumu yoklamaya
        // devam eder ve odeme onaylaninca ekran kendiliginden guncellenir.
        const opened = window.open(res.payment_url, '_blank', 'noopener');
        this.renderShopierWaitPanel(res, !opened);
        this.watchShopierPayment(res.merchant_oid);
      } else {
        const res = await API.createPaytrPayment(amount);
        window.location.assign(res.iframe_url);
      }
    } catch (err) {
      showToast(this.ui(`Bakiye eklenemedi: ${err.message}`, `Could not add funds: ${err.message}`), 'error');
    } finally {
      if (submitBtn && this.selectedPayMethod === 'crypto') {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="fa-brands fa-bitcoin"></i> ${this.ui('Ödeme Adresi Oluştur', 'Generate Payment Address')}`;
      } else if (submitBtn && this.selectedPayMethod === 'shopier' && !this.shopierRedirecting) {
        // Yonlendirme basladiysa dugmeye dokunulmaz; sayfa zaten Shopier'e gidiyor.
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="fa-solid fa-lock"></i> ${this.ui('Güvenli Öde — Shopier', 'Pay Securely — Shopier')}`;
      }
    }
  }

  // Shopier odemesi yeni sekmede yapilir; bu panel bekleyen odemeyi gosterir.
  renderShopierWaitPanel(payment, popupBlocked) {
    const box = document.getElementById('crypto-wait-box');
    if (!box) return;
    box.style.display = 'block';
    box.innerHTML = `
      <div class="crypto-pay-panel">
        <div class="crypto-pay-head">
          <i class="fa-solid fa-bag-shopping"></i>
          <div>
            <strong>${this.ui(`₺${Number(payment.amount).toFixed(2)} için ödeme sayfası açıldı`, `Payment page opened for ₺${Number(payment.amount).toFixed(2)}`)}</strong><br>
            <small>${popupBlocked
              ? this.ui('Tarayıcın yeni sekmeyi engelledi. Ödemeye devam etmek için aşağıdaki bağlantıya tıkla.',
                'Your browser blocked the new tab. Use the link below to continue to payment.')
              : this.ui('Ödemeni Shopier sayfasında tamamla, sonra bu sekmeye dön — bakiyen otomatik güncellenecek.',
                'Complete your payment on the Shopier page, then come back to this tab — your balance updates automatically.')}</small>
          </div>
        </div>
        <div class="crypto-pay-fields" style="margin-top: 12px;">
          <a class="btn btn-primary" href="${this.escapeHtml(payment.payment_url)}" target="_blank" rel="noopener">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> ${this.ui('Ödeme Sayfasını Aç', 'Open Payment Page')}
          </a>
          <div class="crypto-status-line" id="shopier-status-line" style="margin-top: 12px;">
            <i class="fa-solid fa-hourglass-half fa-spin"></i> ${this.ui(
              'Ödeme bekleniyor… Onay gelince bakiyen otomatik yüklenecek.',
              'Waiting for payment… Your balance will be added automatically once confirmed.')}
          </div>
        </div>
      </div>`;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Odeme sonucunu arka planda yoklar (kripto akisiyla ayni desen).
  watchShopierPayment(merchantOid) {
    if (this.shopierPollTimer) clearInterval(this.shopierPollTimer);
    const box = document.getElementById('crypto-wait-box');
    const startedAt = Date.now();
    this.shopierPollTimer = setInterval(async () => {
      // 1 saat sonra yoklama durur; webhook bakiyeyi yine de yukler.
      if (Date.now() - startedAt > 3600000) { clearInterval(this.shopierPollTimer); this.shopierPollTimer = null; return; }
      try {
        const res = await API.getShopierPaymentStatus(merchantOid);
        if (res.status === 'completed') {
          clearInterval(this.shopierPollTimer);
          this.shopierPollTimer = null;
          if (box) box.innerHTML = `
            <div class="crypto-wait success">
              <i class="fa-solid fa-circle-check"></i>
              <div><strong>${this.ui('Ödeme tamamlandı! 🎉', 'Payment completed! 🎉')}</strong><br><small>${this.ui(`₺${Number(res.amount).toFixed(2)} bakiyene eklendi.`, `₺${Number(res.amount).toFixed(2)} was added to your balance.`)}</small></div>
            </div>`;
          showToast(this.ui(`₺${Number(res.amount).toFixed(2)} bakiyene eklendi! 🎉`, `₺${Number(res.amount).toFixed(2)} added to your balance! 🎉`), 'success');
          try { const me = await API.getMe(); this.currentUser = me.user; this.updateUserHeader(); } catch {}
        } else if (res.status === 'failed') {
          clearInterval(this.shopierPollTimer);
          this.shopierPollTimer = null;
          const line = document.getElementById('shopier-status-line');
          const reason = res.failure_reason || this.ui('bilinmeyen neden', 'unknown reason');
          if (line) line.innerHTML = `<i class="fa-solid fa-circle-xmark" style="color: var(--danger);"></i> ${this.ui(`Ödeme tamamlanamadı: ${this.escapeHtml(reason)}`, `Payment failed: ${this.escapeHtml(reason)}`)}`;
        }
      } catch {}
    }, 8000);
  }

  // Odeme saglayicisindan donuste (/payment-success, /payment-failed) sonucu
  // Bakiye Yukle ekraninda gosterir ve bakiyeyi tazeler.
  async showPaymentResult(basarili, query) {
    this.navigate('add-funds', false);
    history.replaceState(null, '', '/add-funds');

    const box = document.getElementById('crypto-wait-box');
    let oid = new URLSearchParams(query).get('oid') || '';
    if (!oid) { try { oid = sessionStorage.getItem('shopierOdemeNo') || ''; } catch {} }
    try { sessionStorage.removeItem('shopierOdemeNo'); } catch {}

    let amountText = '';
    if (basarili && oid) {
      // Tutari sunucudan dogrulariz; adres cubugundaki degere guvenilmez.
      try {
        const res = await API.getShopierPaymentStatus(oid);
        if (res.status === 'completed') amountText = `₺${Number(res.amount).toFixed(2)}`;
      } catch {}
    }

    if (basarili) {
      showToast(this.ui(
        amountText ? `${amountText} bakiyene eklendi! 🎉` : 'Ödemen alındı, bakiyen güncelleniyor.',
        amountText ? `${amountText} was added to your balance! 🎉` : 'Payment received, your balance is being updated.'
      ), 'success');
      if (box) {
        box.style.display = 'block';
        box.innerHTML = `
          <div class="crypto-wait success">
            <i class="fa-solid fa-circle-check"></i>
            <div><strong>${this.ui('Ödeme tamamlandı! 🎉', 'Payment completed! 🎉')}</strong><br><small>${this.ui(
              amountText ? `${amountText} bakiyene eklendi.` : 'Bakiyen birkaç saniye içinde güncellenir.',
              amountText ? `${amountText} was added to your balance.` : 'Your balance will update within a few seconds.'
            )}</small></div>
          </div>`;
      }
      try { const me = await API.getMe(); this.currentUser = me.user; this.updateUserHeader(); } catch {}
    } else {
      showToast(this.ui('Ödeme tamamlanamadı. Tutar hesabından çekilmediyse tekrar deneyebilirsin.',
        'The payment could not be completed. If you were not charged, you can try again.'), 'error');
      if (box) {
        box.style.display = 'block';
        box.innerHTML = `
          <div class="crypto-wait">
            <i class="fa-solid fa-circle-xmark" style="color: var(--danger);"></i>
            <div><strong>${this.ui('Ödeme tamamlanamadı', 'Payment could not be completed')}</strong><br><small>${this.ui(
              'Kart ödemesi onaylanmadı. Tekrar deneyebilir veya havale/kripto seçeneklerini kullanabilirsin.',
              'The card payment was not approved. You can try again or use bank transfer / crypto instead.'
            )}</small></div>
          </div>`;
      }
    }
  }

  // Kripto odemesinin sonucunu arka planda yoklar; paneldeki durum satirini
  // gunceller, tamamlaninca bakiyeyi tazeler.
  watchCryptoPayment(merchantOid, amount) {
    const box = document.getElementById('crypto-wait-box');
    if (this.cryptoPollTimer) clearInterval(this.cryptoPollTimer);
    const startedAt = Date.now();
    this.cryptoPollTimer = setInterval(async () => {
      // 1 saat sonra yoklama durdurulur (IPN yine de bakiyeyi yukler).
      if (Date.now() - startedAt > 3600000) { clearInterval(this.cryptoPollTimer); this.cryptoPollTimer = null; return; }
      try {
        const res = await API.getCryptoPaymentStatus(merchantOid);
        if (res.status === 'completed') {
          clearInterval(this.cryptoPollTimer);
          this.cryptoPollTimer = null;
          if (box) box.innerHTML = `
            <div class="crypto-wait success">
              <i class="fa-solid fa-circle-check"></i>
              <div><strong>${this.ui('Ödeme tamamlandı! 🎉', 'Payment completed! 🎉')}</strong><br><small>${this.ui(`₺${Number(res.amount).toFixed(2)} bakiyene eklendi.`, `₺${Number(res.amount).toFixed(2)} was added to your balance.`)}</small></div>
            </div>`;
          showToast(this.ui(`₺${Number(res.amount).toFixed(2)} bakiyene eklendi! 🪙`, `₺${Number(res.amount).toFixed(2)} added to your balance! 🪙`), 'success');
          try { const me = await API.getMe(); this.currentUser = me.user; this.updateUserHeader(); } catch {}
        } else if (res.status === 'failed') {
          clearInterval(this.cryptoPollTimer);
          this.cryptoPollTimer = null;
          // Panel yerinde kalir; durum satiri neden basarisiz oldugunu soyler.
          const reason = res.failure_reason || this.ui('bilinmeyen neden', 'unknown reason');
          const statusLine = document.getElementById('crypto-status-line');
          if (statusLine) statusLine.innerHTML = `<i class="fa-solid fa-circle-xmark" style="color: var(--danger);"></i> ${this.ui(`Ödeme tamamlanamadı: ${this.escapeHtml(reason)}. Destek ekibiyle iletişime geçebilirsin.`, `Payment failed: ${this.escapeHtml(reason)}. You can contact our support team.`)}`;
          showToast(this.ui(`Kripto ödemesi tamamlanamadı: ${reason}`, `Crypto payment failed: ${reason}`), 'error');
        }
      } catch {}
    }, 8000);
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
      // Kupon dogrulanmis e-posta ister: animasyonlu dogrulama akisi acilir,
      // dogrulama biter bitmez ayni kupon otomatik tekrar denenir.
      if (err.code === 'email_verification_required') {
        this.openEmailVerifyModal(() => this.handleRedeemCoupon(new Event('submit')));
        return;
      }
      showToast(`Kupon hatası: ${err.message}`, 'error');
    }
  }

  // === E-POSTA DOĞRULAMA MODALI =============================================
  // Uc adim: davet -> 6 haneli kod -> basari animasyonu. Dogrulama bitince
  // (varsa) bekleyen islem (ör. kupon) otomatik tekrar calistirilir.

  openEmailVerifyModal(sonrasinda) {
    this.afterEmailVerify = sonrasinda || null;
    const modal = document.getElementById('modal-email-verify');
    if (!modal) return;
    // Adimlar sifirlanir.
    document.getElementById('ev-step-intro').style.display = '';
    document.getElementById('ev-step-code').style.display = 'none';
    document.getElementById('ev-step-success').style.display = 'none';
    document.getElementById('ev-error').textContent = '';
    // E-posta maskeli gosterilir: ab***@gmail.com
    const email = this.currentUser?.email || '';
    const [kutu, alan] = email.split('@');
    document.getElementById('ev-email').textContent = kutu && alan ? `${kutu.slice(0, 2)}***@${alan}` : email;
    this.setupVerifyCodeBoxes();
    modal.classList.add('active');
  }

  closeEmailVerifyModal() {
    document.getElementById('modal-email-verify')?.classList.remove('active');
    if (this.evResendInterval) { clearInterval(this.evResendInterval); this.evResendInterval = null; }
  }

  // Kod kutulari: yazinca sonrakine gecer, silince geri doner, yapistirilan
  // 6 haneli kod kutulara dagitilir. (Kurulum idempotenttir.)
  setupVerifyCodeBoxes() {
    const kutular = [...document.querySelectorAll('.ev-code-box')];
    kutular.forEach((kutu, i) => {
      if (kutu.dataset.bagli) return;
      kutu.dataset.bagli = '1';
      kutu.addEventListener('input', () => {
        kutu.value = kutu.value.replace(/\D/g, '').slice(0, 1);
        kutu.classList.toggle('dolu', Boolean(kutu.value));
        if (kutu.value && i < kutular.length - 1) kutular[i + 1].focus();
        // Tum kutular doluysa otomatik dogrula.
        if (kutular.every(k => k.value)) this.confirmVerifyCode();
      });
      kutu.addEventListener('keydown', ev => {
        if (ev.key === 'Backspace' && !kutu.value && i > 0) kutular[i - 1].focus();
      });
      kutu.addEventListener('paste', ev => {
        const metin = (ev.clipboardData?.getData('text') || '').replace(/\D/g, '');
        if (metin.length >= 2) {
          ev.preventDefault();
          metin.slice(0, 6).split('').forEach((hane, j) => {
            if (kutular[j]) { kutular[j].value = hane; kutular[j].classList.add('dolu'); }
          });
          kutular[Math.min(metin.length, 6) - 1].focus();
          if (metin.length >= 6) this.confirmVerifyCode();
        }
      });
    });
    kutular.forEach(k => { k.value = ''; k.classList.remove('dolu'); });
  }

  async sendVerifyCode(tekrar = false) {
    const buton = tekrar ? document.getElementById('ev-resend-btn') : document.getElementById('ev-send-btn');
    if (buton) buton.disabled = true;
    try {
      const res = await API.requestVerifyCode();
      if (res.already_verified) {
        this.showVerifySuccess(res.message);
        return;
      }
      showToast(res.message, 'success');
      document.getElementById('ev-step-intro').style.display = 'none';
      document.getElementById('ev-step-code').style.display = '';
      document.getElementById('ev-error').textContent = '';
      document.querySelector('.ev-code-box')?.focus();
      this.startResendTimer(60);
    } catch (err) {
      showToast(err.message, 'error');
      // 429 (cok erken tekrar) durumunda da kod ekraninda kal.
      if (err.status === 429 && document.getElementById('ev-step-code').style.display === 'none') {
        document.getElementById('ev-step-intro').style.display = 'none';
        document.getElementById('ev-step-code').style.display = '';
        this.startResendTimer(60);
      }
    } finally {
      if (buton) buton.disabled = false;
    }
  }

  startResendTimer(saniye) {
    const buton = document.getElementById('ev-resend-btn');
    const sayac = document.getElementById('ev-resend-timer');
    if (this.evResendInterval) clearInterval(this.evResendInterval);
    let kalan = saniye;
    if (buton) buton.disabled = true;
    if (sayac) sayac.textContent = `(${kalan}s)`;
    this.evResendInterval = setInterval(() => {
      kalan--;
      if (sayac) sayac.textContent = kalan > 0 ? `(${kalan}s)` : '';
      if (kalan <= 0) {
        clearInterval(this.evResendInterval);
        this.evResendInterval = null;
        if (buton) buton.disabled = false;
      }
    }, 1000);
  }

  async confirmVerifyCode() {
    const kutular = [...document.querySelectorAll('.ev-code-box')];
    const kod = kutular.map(k => k.value).join('');
    const hata = document.getElementById('ev-error');
    if (kod.length !== 6) {
      if (hata) hata.textContent = 'Lütfen 6 haneli kodun tamamını gir.';
      return;
    }
    const buton = document.getElementById('ev-confirm-btn');
    if (buton) buton.disabled = true;
    try {
      const res = await API.confirmVerifyCode(kod);
      this.showVerifySuccess(res.message);
    } catch (err) {
      if (hata) hata.textContent = err.message;
      // Yanlis kod: kutular sarsilir ve temizlenir.
      const satir = document.getElementById('ev-code-row');
      satir?.classList.add('ev-shake');
      setTimeout(() => satir?.classList.remove('ev-shake'), 450);
      kutular.forEach(k => { k.value = ''; k.classList.remove('dolu'); });
      kutular[0]?.focus();
    } finally {
      if (buton) buton.disabled = false;
    }
  }

  showVerifySuccess(mesaj) {
    if (this.currentUser) this.currentUser.email_verified = true;
    document.getElementById('ev-step-intro').style.display = 'none';
    document.getElementById('ev-step-code').style.display = 'none';
    document.getElementById('ev-step-success').style.display = '';
    if (mesaj) {
      const metin = document.getElementById('ev-success-text');
      if (metin && this.afterEmailVerify) metin.textContent = 'E-posta adresin doğrulandı. Kuponun şimdi uygulanıyor...';
    }
    // Basari animasyonu izlensin, ardindan modal kapanip bekleyen islem calisir.
    setTimeout(() => {
      this.closeEmailVerifyModal();
      const devam = this.afterEmailVerify;
      this.afterEmailVerify = null;
      if (devam) devam();
    }, 1800);
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

  // --- DESTEK SOHBETI --------------------------------------------------------
  // Eskiden mesajlar yalnizca pencere acilirken bir kez cekiliyordu; karsi
  // taraf yazdiginda ekranda hicbir sey olmuyor, pencereyi kapatip acmak
  // gerekiyordu. Artik pencere acikken duzenli araliklarla yenilenir.

  async openTicketChatModal(ticketId) {
    this.activeChatTicketId = ticketId;
    this.chatSignature = undefined;
    document.getElementById('modal-ticket-chat').classList.add('active');
    const container = document.getElementById('chat-messages-container');
    container.innerHTML = `<div class="chat-loading"><i class="fa-solid fa-spinner fa-spin"></i> ${this.ui('Mesajlar yükleniyor...', 'Loading messages...')}</div>`;

    const yuklendi = await this.refreshTicketChat(true);
    if (yuklendi) {
      this.startTicketChatPolling();
      document.getElementById('chat-reply-input')?.focus();
    }
  }

  // Yenileme: yalnizca degisiklik varsa yeniden cizer, boylece yazi secimi ve
  // kaydirma konumu bos yere bozulmaz.
  async refreshTicketChat(ilkYukleme = false) {
    const ticketId = this.activeChatTicketId;
    if (!ticketId) return false;
    try {
      const res = await API.getTicketDetails(ticketId);
      if (this.activeChatTicketId !== ticketId) return false; // pencere degismis

      const subject = document.getElementById('chat-ticket-subject');
      const info = document.getElementById('chat-ticket-info');
      if (subject) subject.innerText = this.localizeTicketSubject(res.ticket.subject);
      if (info) info.innerText = `#${res.ticket.id} • ${this.localizeTicketStatus(res.ticket.status)}`;

      const mesajlar = res.messages || [];
      const sonId = mesajlar.length ? mesajlar[mesajlar.length - 1].id : 0;
      const imza = `${mesajlar.length}:${sonId}`;
      if (!ilkYukleme && imza === this.chatSignature) return true; // degisiklik yok
      this.chatSignature = imza;

      this.renderTicketMessages(mesajlar, { ilkYukleme });
      return true;
    } catch (err) {
      if (ilkYukleme) showToast(`${this.ui('Mesajlar çekilemedi', 'Messages could not be loaded')}: ${err.message}`, 'error');
      return false;
    }
  }

  renderTicketMessages(mesajlar, { ilkYukleme = false } = {}) {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;
    // Kullanici yukari kaydirip eski mesaji okuyorsa asagi zorlamayiz.
    const dipteMi = ilkYukleme ||
      (container.scrollHeight - container.scrollTop - container.clientHeight) < 60;

    if (!mesajlar.length) {
      container.innerHTML = `<div class="chat-empty">${this.ui('Henüz mesaj yok. İlk mesajı siz yazın.', 'No messages yet. Send the first one.')}</div>`;
      return;
    }

    const tarihMetni = value => new Date(value).toLocaleDateString(this.locale === 'en' ? 'en-GB' : 'tr-TR',
      { day: 'numeric', month: 'long', year: 'numeric' });
    const saatMetni = value => new Date(value).toLocaleTimeString(this.locale === 'en' ? 'en-US' : 'tr-TR',
      { hour: '2-digit', minute: '2-digit' });

    // Bize ait mesaj = oturumdaki rolle ayni taraftan gelen mesaj.
    const benAdminMiyim = this.currentUser?.role === 'admin';
    let oncekiGun = '';
    let oncekiTaraf = '';

    container.innerHTML = mesajlar.map(m => {
      const adminMesaji = m.sender_role === 'admin';
      const bana = adminMesaji === benAdminMiyim;
      const gun = tarihMetni(m.created_at);
      const gunAyraci = gun !== oncekiGun ? `<div class="chat-day"><span>${this.escapeHtml(gun)}</span></div>` : '';
      // Ayni kisinin ard arda mesajlarinda isim tekrar yazilmaz.
      const taraf = `${m.sender_role}:${gun}`;
      const basligiGoster = taraf !== oncekiTaraf || gunAyraci;
      oncekiGun = gun;
      oncekiTaraf = taraf;

      const kim = adminMesaji
        ? this.ui('Müşteri Temsilcisi', 'Support')
        : this.escapeHtml(m.username || this.ui('Müşteri', 'Customer'));

      return `${gunAyraci}
        <div class="chat-row ${bana ? 'chat-row-mine' : 'chat-row-theirs'}">
          ${basligiGoster ? `<div class="chat-meta">
            <span class="chat-who">${adminMesaji ? '<i class="fa-solid fa-headset"></i> ' : ''}${kim}</span>
          </div>` : ''}
          <div class="chat-bubble">${this.escapeHtml(m.message)}<span class="chat-time">${saatMetni(m.created_at)}</span></div>
        </div>`;
    }).join('');

    if (dipteMi) container.scrollTop = container.scrollHeight;
    else this.showNewMessageJump();
  }

  showNewMessageJump() {
    const container = document.getElementById('chat-messages-container');
    if (!container || document.getElementById('chat-jump-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'chat-jump-btn';
    btn.type = 'button';
    btn.className = 'chat-jump';
    btn.innerHTML = `<i class="fa-solid fa-arrow-down"></i> ${this.ui('Yeni mesaj', 'New message')}`;
    btn.onclick = () => {
      container.scrollTop = container.scrollHeight;
      btn.remove();
    };
    container.parentElement?.appendChild(btn);
  }

  startTicketChatPolling() {
    this.stopTicketChatPolling();
    // 4 saniye: anlik hissettirecek kadar sik, sunucuyu yormayacak kadar seyrek.
    this.chatPollTimer = setInterval(() => {
      // Sekme arka plandayken sorgu atmaya gerek yok.
      if (document.hidden) return;
      if (!document.getElementById('modal-ticket-chat')?.classList.contains('active')) {
        this.stopTicketChatPolling();
        return;
      }
      this.refreshTicketChat(false);
    }, 4000);
  }

  stopTicketChatPolling() {
    if (this.chatPollTimer) {
      clearInterval(this.chatPollTimer);
      this.chatPollTimer = null;
    }
  }

  async handleSendTicketReply(e) {
    e.preventDefault();
    const input = document.getElementById('chat-reply-input');
    const button = document.getElementById('chat-send-btn');
    const message = input.value.trim();
    if (!message || !this.activeChatTicketId) return;

    // Cift gonderim engellenir; yavas baglantida iki kez basilabiliyordu.
    input.disabled = true;
    if (button) button.disabled = true;
    try {
      await API.replyTicket(this.activeChatTicketId, message);
      input.value = '';
      this.autoGrowChatInput(input);
      await this.refreshTicketChat(true);
      if (this.currentUser && this.currentUser.role !== 'admin') {
        await this.loadUserTickets();
      }
    } catch (err) {
      showToast(`${this.ui('Cevap gönderilemedi', 'Reply could not be sent')}: ${err.message}`, 'error');
    } finally {
      input.disabled = false;
      if (button) button.disabled = false;
      input.focus();
    }
  }

  // Yazi alani icerige gore buyur (tek satirdan basla, uzadikca acil).
  autoGrowChatInput(input) {
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(120, input.scrollHeight)}px`;
  }

  // --- ADMIN PANEL LOGIC ---
  switchAdminTab(tabName, evt) {
    document.querySelectorAll('#view-admin .sidebar-item').forEach(el => el.classList.remove('active'));
    const targetEl = (evt && evt.currentTarget) || document.querySelector(`#view-admin [data-admin-tab="${tabName}"]`);
    if (targetEl) targetEl.classList.add('active');
    const mobileNav = document.querySelector('.admin-mobile-nav');
    if (mobileNav) mobileNav.value = tabName;

    // Sekme listesi DOM'dan okunur. Elle yazilan listede yeni sekmeyi eklemeyi
    // unutmak tum panelleri gizleyip bos (beyaz) ekran birakiyordu.
    document.querySelectorAll('#view-admin [id^="admin-tab-"]').forEach(el => {
      el.style.display = (el.id === `admin-tab-${tabName}`) ? 'block' : 'none';
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
    if (tabName === 'statistics') this.loadAdminStatistics();
    if (tabName === 'deposits') this.loadAdminPaymentNotifications();
    if (tabName === 'payments') this.loadAdminPayments();
    if (tabName === 'coupons') this.loadAdminCoupons();
    if (tabName === 'campaigns') this.loadAdminCampaigns();
    if (tabName === 'email-marketing') this.loadAdminEmailMarketing();
    if (tabName === 'tickets') this.loadAdminTickets();
    if (tabName === 'reviews') this.loadAdminReviews();
    if (tabName === 'landing-design') this.loadAdminLandingDesign();
    if (tabName === 'landing-pages') this.loadAdminLandingPages();
    if (tabName === 'ai-studio') this.loadAiStudio();
    if (tabName === 'users') this.loadAdminUsers();
    if (tabName === 'orders') this.loadAdminOrders();
    if (tabName === 'completion') this.loadCompletionTimes();
    if (tabName === 'reset') this.showResetSection(this.currentResetSection || 'security');
    if (tabName === 'site-settings') {
      this.loadAdminSettings();
      // Sekme hangi yoldan acilirsa acilsin (mobil secim kutusu dahil) bolum
      // gorunumu ve aktif buton isaretleri senkron kalir.
      this.showSettingsSection(this.currentSettingsSection || 'general');
    }
    // Alt menu yalnizca ayarlar sekmesindeyken acik durur; baska sekmeye
    // gecildiginde kenar cubugu sade kalsin diye kapanir.
    this.setSettingsMenuOpen(tabName === 'site-settings');
  }

  // --- SİTE AYARLARI ALT BÖLÜMLERİ ---
  // Ana "Site Ayarları" butonu akordeon gibi calisir: kapaliysa alt menuyu
  // acip ayarlar sekmesine gecer, acik ise yalnizca alt menuyu kapatir.
  toggleSettingsMenu() {
    const open = !document.getElementById('settings-subnav')?.classList.contains('open');
    this.setSettingsMenuOpen(open);
    if (open) this.openSettingsSection(this.currentSettingsSection || 'general');
  }

  setSettingsMenuOpen(open) {
    document.getElementById('settings-subnav')?.classList.toggle('open', open);
    document.querySelector('#view-admin [data-admin-tab="site-settings"]')?.classList.toggle('submenu-open', open);
  }

  // Kenar cubugundaki alt kategori butonlari: once ayarlar sekmesine gecer,
  // sonra istenen bolumu gosterir.
  openSettingsSection(section) {
    this.currentSettingsSection = section;
    this.switchAdminTab('site-settings');
  }

  showSettingsSection(section) {
    this.currentSettingsSection = section;
    document.querySelectorAll('#admin-tab-site-settings .settings-section').forEach(el => {
      el.style.display = el.dataset.section === section ? '' : 'none';
    });
    // Hem kenar cubugu alt butonlari hem sekme cubugu ayni data ozniteligini kullanir.
    document.querySelectorAll('[data-settings-section]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.settingsSection === section);
    });
    // Guvenlik bolumunun kendi formu var; genel kaydet dugmesi orada gizlenir.
    const saveBtn = document.getElementById('settings-save-btn');
    if (saveBtn) saveBtn.style.display = section === 'security' ? 'none' : '';
  }

  // --- ISTATISTIK PANELI ----------------------------------------------------
  // Tablolar sayfa basina 10 kayit gosterir; siralama sunucudan zaten en cok
  // satilan / en cok okunan seklinde gelir.
  // Sayfa basina kayit sayisi (istatistik tablolari).
  get statPageSize() { return 10; }

  // Servis katalogundaki sayfalama ile ayni gorunum; tek yerden uretilir.
  renderStatPagination(boxId, totalItems, currentPage, onPageFn) {
    const box = document.getElementById(boxId);
    if (!box) return;
    const pageSize = this.statPageSize;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    if (totalItems <= pageSize) { box.innerHTML = ''; return; }

    const first = (currentPage - 1) * pageSize + 1;
    const last = Math.min(currentPage * pageSize, totalItems);

    // Uzun listelerde tum numaralari basmamak icin aktif sayfanin etrafinda pencere
    const pages = [];
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2)) pages.push(p);
      else if (pages[pages.length - 1] !== '...') pages.push('...');
    }

    const btn = (label, page, { disabled = false, active = false } = {}) =>
      `<button type="button" class="btn btn-sm ${active ? 'btn-primary' : 'btn-outline'}"
        ${disabled ? 'disabled' : `onclick="app.${onPageFn}(${page})"`}
        style="min-width:36px;${disabled ? 'opacity:.4;cursor:not-allowed;' : ''}">${label}</button>`;

    box.innerHTML = `
      <div style="font-size:.82rem;color:var(--text-muted);">
        ${first}-${last} / <strong style="color:#fff;">${totalItems}</strong>
        <span style="color:var(--text-dim);">(${this.ui('sayfa', 'page')} ${currentPage}/${totalPages})</span>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
        ${btn('<i class="fa-solid fa-angle-left"></i>', currentPage - 1, { disabled: currentPage === 1 })}
        ${pages.map(p => p === '...'
          ? '<span style="color:var(--text-dim);padding:0 4px;">…</span>'
          : btn(p, p, { active: p === currentPage })).join('')}
        ${btn('<i class="fa-solid fa-angle-right"></i>', currentPage + 1, { disabled: currentPage === totalPages })}
      </div>`;
  }

  setStatServicesPage(page) { this.statServicesPage = page; this.renderStatServicesPage(); }
  setStatBlogPage(page) { this.statBlogPage = page; this.renderStatBlogPage(); }

  renderStatServicesPage() {
    const tbody = document.getElementById('stat-services-tbody');
    if (!tbody) return;
    const list = this.statServices || [];
    const pageSize = this.statPageSize;
    const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    const page = Math.min(Math.max(this.statServicesPage || 1, 1), totalPages);
    this.statServicesPage = page;

    const sayi = n => Number(n || 0).toLocaleString('tr-TR');
    const dilim = list.slice((page - 1) * pageSize, page * pageSize);

    tbody.innerHTML = dilim.length ? dilim.map((s, i) => `
      <tr>
        <td class="cell-nowrap" style="color:var(--text-dim);">${(page - 1) * pageSize + i + 1}</td>
        <td class="cell-truncate" style="font-weight:600;">
          ${this.escapeHtml(s.name_tr || s.name)}
          <small style="display:block;color:var(--text-dim);">#${s.id}${s.status ? '' : ' · pasif'}</small>
        </td>
        <td class="cell-nowrap"><span class="badge badge-processing">${this.escapeHtml(s.category_name || '-')}</span></td>
        <td class="cell-nowrap" style="font-size:.85rem;color:var(--text-dim);">${this.escapeHtml(s.provider_name || 'Manuel')}</td>
        <td class="cell-nowrap"><strong style="color:var(--accent-cyan);font-size:1.05rem;">${sayi(s.order_count)}</strong> kez</td>
        <td class="cell-nowrap">${sayi(s.total_quantity)}</td>
        <td class="cell-nowrap" style="color:var(--success);font-weight:700;">₺${Number(s.net_revenue || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="cell-nowrap" style="font-size:.8rem;color:var(--text-dim);">${s.last_ordered_at ? new Date(s.last_ordered_at).toLocaleDateString('tr-TR') : '-'}</td>
      </tr>`).join('')
      : '<tr><td colspan="8" class="text-center">Henüz satın alınan servis yok. Sipariş geldikçe burada listelenir.</td></tr>';

    this.renderStatPagination('stat-services-pagination', list.length, page, 'setStatServicesPage');
  }

  renderStatBlogPage() {
    const tbody = document.getElementById('stat-blog-tbody');
    if (!tbody) return;
    const list = this.statBlogPosts || [];
    const pageSize = this.statPageSize;
    const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    const page = Math.min(Math.max(this.statBlogPage || 1, 1), totalPages);
    this.statBlogPage = page;

    const sayi = n => Number(n || 0).toLocaleString('tr-TR');
    const dilim = list.slice((page - 1) * pageSize, page * pageSize);

    tbody.innerHTML = dilim.length ? dilim.map((p, i) => `
      <tr>
        <td class="cell-nowrap" style="color:var(--text-dim);">${(page - 1) * pageSize + i + 1}</td>
        <td class="cell-truncate" style="font-weight:600;">
          ${this.escapeHtml(p.title || '-')}
          <small style="display:block;color:var(--text-dim);">/blog/${this.escapeHtml(p.slug || '')}</small>
        </td>
        <td class="cell-nowrap"><span class="badge badge-processing">${this.escapeHtml(p.category || '-')}</span></td>
        <td class="cell-nowrap"><span class="badge ${p.status === 'published' ? 'badge-completed' : 'badge-pending'}">${p.status === 'published' ? 'Yayında' : 'Taslak'}</span></td>
        <td class="cell-nowrap"><strong style="color:var(--accent-cyan);font-size:1.05rem;">${sayi(p.views)}</strong> kez</td>
        <td class="cell-nowrap" style="font-size:.8rem;color:var(--text-dim);">${p.published_at ? new Date(p.published_at).toLocaleDateString('tr-TR') : '-'}</td>
      </tr>`).join('')
      : '<tr><td colspan="6" class="text-center">Henüz blog yazısı yok.</td></tr>';

    this.renderStatPagination('stat-blog-pagination', list.length, page, 'setStatBlogPage');
  }

  async loadAdminStatistics() {
    const servicesTbody = document.getElementById('stat-services-tbody');
    const blogTbody = document.getElementById('stat-blog-tbody');
    if (!servicesTbody || !blogTbody) return;

    servicesTbody.innerHTML = '<tr><td colspan="8" class="text-center"><i class="fa-solid fa-spinner fa-spin"></i> Yükleniyor...</td></tr>';
    blogTbody.innerHTML = '<tr><td colspan="6" class="text-center"><i class="fa-solid fa-spinner fa-spin"></i> Yükleniyor...</td></tr>';

    try {
      const data = await API.getAdminStatistics();
      const sayi = n => Number(n || 0).toLocaleString('tr-TR');
      const setText = (id, value) => { const el = document.getElementById(id); if (el) el.innerText = value; };

      setText('stat-visitors-daily', sayi(data.visitors.daily));
      setText('stat-visitors-weekly', sayi(data.visitors.weekly));
      setText('stat-visitors-monthly', sayi(data.visitors.monthly));
      setText('stat-visitors-total', sayi(data.visitors.total));

      // Veriyi sakla; sayfa degistirilirken sunucuya tekrar gidilmez.
      this.statServices = data.services || [];
      this.statBlogPosts = data.blog?.posts || [];
      this.statServicesPage = 1;
      this.statBlogPage = 1;

      setText('stat-services-summary',
        this.statServices.length
          ? `${sayi(this.statServices.length)} farklı servis satın alındı · toplam ${sayi(data.totals.valid_orders)} sipariş`
          : '');
      setText('stat-blog-summary',
        this.statBlogPosts.length
          ? `${sayi(this.statBlogPosts.length)} yazı · ${sayi(data.blog.published)} yayında · toplam ${sayi(data.blog.total_views)} görüntülenme`
          : '');

      this.renderStatServicesPage();
      this.renderStatBlogPage();

    } catch (err) {
      servicesTbody.innerHTML = `<tr><td colspan="8" class="text-center" style="color:var(--danger);">${this.escapeHtml(err.message)}</td></tr>`;
      blogTbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color:var(--danger);">İstatistikler yüklenemedi.</td></tr>`;
    }
  }

  async loadAdminStats() {
    try {
      const data = await API.getAdminStats();
      const lira = value => `₺${Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const setStat = (id, value) => { const el = document.getElementById(id); if (el) el.innerText = value; };

      setStat('admin-stat-revenue', lira(data.stats.total_revenue));
      // Tedarikciye giden para: ustte saglayiciya gercekten odenen doviz,
      // altinda panel kuruyla TL karsiligi.
      const dolar = value => `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      setStat('admin-stat-provider-cost', dolar(data.stats.provider_cost_usd));
      setStat('admin-stat-provider-cost-try', `≈ ${lira(data.stats.provider_cost)}`);
      setStat('admin-stat-profit', lira(data.stats.net_profit));
      // Kar hesabi guncel saglayici fiyatina dayanir; kapsam disinda kalan
      // siparis varsa etikette belirtilir.
      const costLbl = document.getElementById('admin-stat-provider-cost-lbl');
      if (costLbl) {
        costLbl.innerText = data.stats.orders_without_cost > 0
          ? `Tedarikçiye Giden • ${data.stats.orders_without_cost} siparişin maliyeti bilinmiyor`
          : `Tedarikçiye Giden (kur: ${data.stats.usd_try_rate})`;
      }

      setStat('admin-stat-orders', data.stats.total_orders);
      setStat('admin-stat-orders-completed', data.stats.completed_orders);
      setStat('admin-stat-orders-active', data.stats.active_orders);
      setStat('admin-stat-orders-partial', data.stats.partial_orders);
      setStat('admin-stat-orders-canceled', data.stats.canceled_orders);
      setStat('admin-stat-orders-failed', data.stats.failed_orders);
      setStat('admin-stat-users', data.stats.total_users);
      const ticketCount = document.getElementById('admin-nav-tickets-count');
      const depositCount = document.getElementById('admin-nav-deposits-count');
      if (ticketCount) ticketCount.textContent = data.stats.pending_tickets || '';
      if (depositCount) depositCount.textContent = data.stats.pending_deposits || '';

      this.renderProfitChart(data.dailySeries || []);

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

  // Son 30 gunun ciro/kar cubuklari; harici kutuphane yerine saf SVG.
  renderProfitChart(series) {
    const container = document.getElementById('admin-profit-chart');
    if (!container) return;
    if (!series.length || series.every(d => !d.revenue && !d.profit)) {
      container.innerHTML = '<p style="color: var(--text-dim); font-size: .85rem; padding: 14px 0;">Henüz grafik için yeterli sipariş verisi yok.</p>';
      return;
    }
    const W = 900, H = 220, PAD = 34, innerH = H - PAD - 18;
    const max = Math.max(...series.map(d => Math.max(d.revenue, d.profit, 0)), 1);
    const min = Math.min(...series.map(d => Math.min(d.profit, 0)), 0);
    const range = max - min || 1;
    const yOf = value => 12 + innerH * (1 - (value - min) / range);
    const zeroY = yOf(0);
    const slot = (W - PAD - 8) / series.length;
    const barW = Math.max(4, slot * 0.32);

    let bars = '';
    series.forEach((d, i) => {
      const x = PAD + i * slot;
      const tip = `${d.day}\nCiro: ₺${d.revenue.toFixed(2)}\nKâr: ₺${d.profit.toFixed(2)}`;
      const rTop = Math.min(yOf(d.revenue), zeroY), rH = Math.max(1, Math.abs(zeroY - yOf(d.revenue)));
      const pTop = Math.min(yOf(d.profit), zeroY), pH = Math.max(1, Math.abs(zeroY - yOf(d.profit)));
      bars += `<g><title>${tip}</title>
        <rect x="${x.toFixed(1)}" y="${rTop.toFixed(1)}" width="${barW.toFixed(1)}" height="${rH.toFixed(1)}" rx="2" fill="rgba(139,92,246,.65)"/>
        <rect x="${(x + barW + 1.5).toFixed(1)}" y="${pTop.toFixed(1)}" width="${barW.toFixed(1)}" height="${pH.toFixed(1)}" rx="2" fill="${d.profit >= 0 ? 'rgba(16,185,129,.85)' : 'rgba(239,68,68,.85)'}"/>
      </g>`;
      // Her 5 gunde bir tarih etiketi (gg.aa)
      if (i % 5 === 0 || i === series.length - 1) {
        const [, month, dayNum] = d.day.split('-');
        bars += `<text x="${(x + barW).toFixed(1)}" y="${H - 4}" text-anchor="middle" font-size="9" fill="var(--text-dim)">${dayNum}.${month}</text>`;
      }
    });

    container.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" style="width: 100%; min-width: 640px; height: auto; display: block;" role="img" aria-label="Son 30 gün ciro ve kâr grafiği">
        <line x1="${PAD}" y1="${zeroY.toFixed(1)}" x2="${W - 4}" y2="${zeroY.toFixed(1)}" stroke="rgba(148,163,184,.25)" stroke-width="1"/>
        <text x="4" y="${(yOf(max) + 4).toFixed(1)}" font-size="10" fill="var(--text-dim)">₺${Math.round(max)}</text>
        <text x="4" y="${(zeroY + 4).toFixed(1)}" font-size="10" fill="var(--text-dim)">₺0</text>
        ${bars}
      </svg>`;
  }

  // === KAMPANYA YÖNETİMİ (ADMIN) ============================================

  onCampaignTypeChange() {
    const type = document.getElementById('campaign-type')?.value;
    const discountFields = document.getElementById('campaign-discount-fields');
    const bonusFields = document.getElementById('campaign-bonus-fields');
    if (discountFields) discountFields.style.display = type === 'service_discount' ? 'grid' : 'none';
    if (bonusFields) bonusFields.style.display = type === 'deposit_bonus' ? 'grid' : 'none';
  }

  onCampaignPopupToggle() {
    const fields = document.getElementById('campaign-popup-fields');
    if (fields) fields.style.display = document.getElementById('campaign-popup-enabled')?.checked ? 'block' : 'none';
  }

  async loadAdminCampaigns() {
    // Servis secim listesi aktif katalogla doldurulur.
    const serviceSelect = document.getElementById('campaign-service');
    if (serviceSelect && !serviceSelect.options.length) {
      serviceSelect.innerHTML = this.allServices
        .map(s => `<option value="${s.id}">#${s.id} — ${this.escapeHtml(String(s.name).slice(0, 70))} (₺${Number(s.rate_per_1000).toFixed(2)})</option>`)
        .join('');
    }

    // Pazarlama otomasyon anahtarlari ve ust duyuru alanlari mevcut
    // ayarlarla senkronlanir.
    try {
      const settingsRes = await API.getSettings();
      const s = settingsRes.settings || {};
      const proof = document.getElementById('setting-social-proof');
      const reminder = document.getElementById('setting-reminder-email');
      if (proof) proof.checked = s.social_proof_enabled !== '0';
      if (reminder) reminder.checked = s.reminder_email_enabled === '1';
      if (document.getElementById('camp-announcement-tr')) document.getElementById('camp-announcement-tr').value = s.announcement_tr || s.announcement || '';
      if (document.getElementById('camp-announcement-en')) document.getElementById('camp-announcement-en').value = s.announcement_en || '';
      if (document.getElementById('camp-announcement-special')) document.getElementById('camp-announcement-special').checked = s.announcement_special === '1';
    } catch {}

    const tbody = document.getElementById('admin-campaigns-tbody');
    if (!tbody) return;
    try {
      const res = await API.getAdminCampaigns();
      if (!res.campaigns.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Henüz kampanya yok. Yukarıdan ilk kampanyanı oluştur!</td></tr>';
        return;
      }
      const now = Date.now();
      tbody.innerHTML = res.campaigns.map(c => {
        const expired = c.ends_at && new Date(c.ends_at).getTime() < now;
        const detail = c.type === 'service_discount'
          ? `🏷️ ${this.escapeHtml(String(c.service_name || '#' + c.service_id).slice(0, 44))} → <b>-%${c.discount_percent}</b>`
          : `🎁 Bakiye bonusu <b>+%${c.bonus_percent}</b>${c.min_deposit_kurus ? ` (min ₺${(c.min_deposit_kurus / 100).toFixed(0)})` : ''}`;
        const popupStat = c.popup_enabled
          ? `👁 ${c.views} • 🖱 ${c.clicks}${c.conversions !== null && c.conversions !== undefined ? ` • 🛒 ${c.conversions}` : ''}`
          : '<span style="color: var(--text-dim);">Popup kapalı</span>';
        return `
        <tr${!c.status || expired ? ' style="opacity:.55;"' : ''}>
          <td>#${c.id}</td>
          <td style="font-weight: 700;">${this.escapeHtml(c.name)}</td>
          <td style="font-size: .85rem;">${detail}</td>
          <td class="cell-nowrap" style="font-size: .8rem;">${c.ends_at ? new Date(c.ends_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : 'Süresiz'}${expired ? ' <span class="badge badge-canceled">Bitti</span>' : ''}</td>
          <td class="cell-nowrap" style="font-size: .8rem;">${popupStat}</td>
          <td>${c.status ? '<span class="badge badge-completed">Aktif</span>' : '<span class="badge badge-pending">Durduruldu</span>'}</td>
          <td class="cell-nowrap" style="text-align: right;">
            <button class="btn btn-outline btn-sm" onclick="app.toggleCampaign(${c.id}, ${c.status ? 0 : 1})" title="${c.status ? 'Durdur' : 'Aktifleştir'}">
              <i class="fa-solid ${c.status ? 'fa-pause' : 'fa-play'}"></i>
            </button>
            <button class="btn btn-outline btn-sm" style="color: var(--danger); border-color: var(--danger);" onclick="app.removeCampaign(${c.id}, '${this.escapeHtml(c.name)}')" title="Sil">
              <i class="fa-solid fa-trash"></i>
            </button>
          </td>
        </tr>`;
      }).join('');
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">Kampanyalar yüklenemedi.</td></tr>';
    }
  }

  async handleCreateCampaign(e) {
    e.preventDefault();
    const type = document.getElementById('campaign-type').value;
    const endsRaw = document.getElementById('campaign-ends').value;
    const payload = {
      name: document.getElementById('campaign-name').value,
      type,
      service_id: type === 'service_discount' ? Number(document.getElementById('campaign-service').value) || null : null,
      discount_percent: type === 'service_discount' ? Number(document.getElementById('campaign-discount').value) || null : null,
      bonus_percent: type === 'deposit_bonus' ? Number(document.getElementById('campaign-bonus').value) || null : null,
      min_deposit: type === 'deposit_bonus' ? Number(document.getElementById('campaign-min-deposit').value) || null : null,
      // datetime-local yerel saattir; sunucu UTC karsilastirdigi icin ISO'ya cevrilir.
      ends_at: endsRaw ? new Date(endsRaw).toISOString() : null,
      popup_enabled: document.getElementById('campaign-popup-enabled').checked,
      popup_template: document.querySelector('input[name="campaign-template"]:checked')?.value || 'flash',
      popup_title: document.getElementById('campaign-popup-title').value || null,
      popup_title_en: document.getElementById('campaign-popup-title-en').value || null,
      popup_frequency_hours: Number(document.getElementById('campaign-popup-frequency').value) || 24
    };
    try {
      const res = await API.createCampaign(payload);
      showToast(res.message, 'success');
      e.target.reset();
      this.onCampaignTypeChange();
      this.onCampaignPopupToggle();
      this.loadAdminCampaigns();
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  }

  async toggleCampaign(id, status) {
    try {
      const res = await API.setCampaignStatus(id, status);
      showToast(res.message, 'success');
      this.loadAdminCampaigns();
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  }

  async removeCampaign(id, name) {
    const confirmed = await confirmDialog(`"${name}" kampanyası silinecek. Emin misin?`,
      { title: 'Kampanyayı sil', icon: 'fa-trash', danger: true, confirmText: 'Sil' });
    if (!confirmed) return;
    try {
      const res = await API.deleteCampaign(id);
      showToast(res.message, 'success');
      this.loadAdminCampaigns();
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  }

  // Kampanyalar sekmesindeki ust duyuru karti: yalnizca duyuru anahtarlarini
  // kaydeder (Site Ayarlari'ndaki buyuk formdan ve popup'lardan bagimsiz).
  async saveAnnouncementFromCampaigns() {
    const announcementTr = document.getElementById('camp-announcement-tr').value.trim();
    const announcementEn = document.getElementById('camp-announcement-en').value.trim();
    const special = document.getElementById('camp-announcement-special').checked;
    try {
      await API.saveSettings({
        announcement_tr: announcementTr,
        announcement_en: announcementEn,
        announcement_special: special ? '1' : '0'
      });
      // Bant aninda guncellenir; sayfa yenilemeye gerek kalmaz.
      const textEl = document.getElementById('announcement-text');
      const bar = document.getElementById('announcement-bar');
      const localized = this.locale === 'en' ? (announcementEn || announcementTr) : announcementTr;
      if (localized) {
        if (textEl) textEl.innerText = localized;
        if (bar) bar.style.display = '';
      } else if (bar) {
        bar.style.display = 'none';   // duyuru bosaltildi -> band kalksin
      }
      bar?.classList.toggle('announcement-launch', special);
      // Site Ayarlari'ndaki es alanlar da senkron kalsin (aciksa).
      if (document.getElementById('setting-announcement-tr')) document.getElementById('setting-announcement-tr').value = announcementTr;
      if (document.getElementById('setting-announcement-en')) document.getElementById('setting-announcement-en').value = announcementEn;
      if (document.getElementById('setting-announcement-special')) document.getElementById('setting-announcement-special').checked = special;
      showToast(localized ? 'Duyuru bandı güncellendi ve yayında! 📣' : 'Duyuru bandı kaldırıldı.', 'success');
    } catch (err) {
      showToast(`Duyuru kaydedilemedi: ${err.message}`, 'error');
    }
  }

  async saveMarketingToggles() {
    try {
      const res = await API.saveSettings({
        social_proof_enabled: document.getElementById('setting-social-proof').checked ? '1' : '0',
        reminder_email_enabled: document.getElementById('setting-reminder-email').checked ? '1' : '0'
      });
      showToast(res.message, 'success');
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  }

  // === TELEGRAM BAĞLANTI KARTI (Siparişlerim) ================================

  async loadTelegramConnectCard() {
    const card = document.getElementById('telegram-connect-card');
    if (!card || !this.currentUser) return;
    const statusEl = document.getElementById('telegram-connect-status');
    const actionsEl = document.getElementById('telegram-connect-actions');
    try {
      const res = await API.getTelegramStatus();
      card.style.display = 'block';
      if (res.connected) {
        statusEl.innerHTML = this.ui(
          `✅ Bağlı${res.telegram_username ? `: <b>@${this.escapeHtml(res.telegram_username)}</b>` : ''} — sipariş durumu değişince Telegram'dan mesaj alacaksın.`,
          `✅ Connected${res.telegram_username ? `: <b>@${this.escapeHtml(res.telegram_username)}</b>` : ''} — you'll get a Telegram message whenever your order status changes.`
        );
        actionsEl.innerHTML = `<button class="btn btn-outline btn-sm" onclick="app.disconnectTelegram()"><i class="fa-solid fa-link-slash"></i> ${this.ui('Bağlantıyı Kes', 'Disconnect')}</button>`;
      } else {
        statusEl.innerHTML = this.ui(
          'Siparişin tamamlanınca, kısmen teslim edilince veya iptal olunca Telegram\'dan anında haber al.',
          'Get instant Telegram updates when your order is completed, partially delivered, or canceled.'
        );
        actionsEl.innerHTML = `
          <button class="btn btn-primary btn-sm" onclick="app.connectTelegram()"><i class="fa-brands fa-telegram"></i> ${this.ui("Telegram'a Bağlan", 'Connect Telegram')}</button>
          <button class="btn btn-outline btn-sm" onclick="app.loadTelegramConnectCard()" title="${this.ui('Bağlantıyı kontrol et', 'Check connection')}"><i class="fa-solid fa-rotate"></i></button>`;
      }
    } catch {
      // Bot yapilandirilmamissa kart tamamen gizlenir; musteriyi yormayalim.
      card.style.display = 'none';
    }
  }

  async connectTelegram() {
    try {
      const res = await API.createTelegramLinkCode();
      window.open(res.link, '_blank', 'noopener');
      showToast(this.ui(
        'Telegram açıldı! Botta "BAŞLAT / START" düğmesine bas, sonra buraya dönüp 🔄 ile kontrol et. Bağlantı 1 dakika içinde tamamlanır.',
        'Telegram opened! Tap "START" in the bot, then come back and press 🔄 to check. The link completes within a minute.'
      ), 'info', 9000);
    } catch (err) {
      showToast(this.ui(`Telegram bağlantısı başlatılamadı: ${err.message}`, `Could not start Telegram linking: ${err.message}`), 'error');
    }
  }

  async disconnectTelegram() {
    try {
      const res = await API.disconnectTelegram();
      showToast(res.message, 'success');
      this.loadTelegramConnectCard();
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  }

  async loadAdminProviders() {
    const tbody = document.getElementById('admin-providers-tbody');
    try {
      const res = await API.getAdminProviders();
      // Tekil servis ekleme popup'inda saglayici adini gostermek icin.
      this.adminProviderNames = Object.fromEntries(res.providers.map(p => [String(p.id), p.name]));
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
            <button class="btn btn-outline btn-sm" onclick="app.confirmDeleteProvider(${p.id})" title="Sağlayıcıyı ve tüm servislerini sil"
                    style="color: var(--danger); border-color: rgba(239, 68, 68, 0.4);">
              <i class="fa-solid fa-trash"></i> Sil
            </button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center">Sağlayıcılar yüklenemedi.</td></tr>`;
    }
  }

  async confirmDeleteProvider(providerId) {
    const name = this.adminProviderNames?.[String(providerId)] || `#${providerId}`;
    const confirmed = await confirmDialog(
      `"${name}" sağlayıcısı ve bu sağlayıcıya ait TÜM servisler silinecek.\n\nSipariş geçmişi olan servisler rapor bütünlüğü için silinmez; pasife alınır ve sağlayıcı bağlantısı koparılır. Bu işlem geri alınamaz. Devam edilsin mi?`,
      { title: 'Sağlayıcıyı sil', icon: 'fa-trash', danger: true, confirmText: 'Evet, Sağlayıcıyı ve Servislerini Sil' }
    );
    if (!confirmed) return;
    try {
      const res = await API.deleteAdminProvider(providerId);
      showToast(res.message, 'success');
      this.loadAdminProviders();
      // Servis listesi ve vitrindeki katalog da degisti; acik onbellekler tazelenir.
      this.loadAdminAddedServices?.();
      this.loadServicesData?.();
    } catch (err) {
      showToast(`Sağlayıcı silinemedi: ${err.message}`, 'error');
    }
  }

  // Dakika cinsinden ortalama sureyi okunur metne cevirir (12 dk, 3 sa 20 dk, 2 gün 5 sa).
  // Saglayici API'leri bu veriyi vermez; kendi tamamlanan siparislerimizden hesaplanir.
  formatAvgCompletion(minutes, count) {
    const m = Number(minutes);
    if (!Number.isFinite(m) || m <= 0 || !count) return '<span style="color:var(--text-dim);">—</span>';
    let label;
    if (m < 60) label = `${Math.round(m)} dk`;
    else if (m < 1440) label = `${Math.floor(m / 60)} sa ${Math.round(m % 60)} dk`;
    else label = `${Math.floor(m / 1440)} gün ${Math.round((m % 1440) / 60)} sa`;
    return `<strong>${label}</strong><small style="display:block;color:var(--text-dim);">${count} sipariş ort.</small>`;
  }

  // --- PROVIDER SERVICES EXPLORER WORKSPACE ---
  async openProviderExplorer(providerId) {
    this.currentExplorerProviderId = providerId;
    this.selectedExplorerPlatform = 'all';
    this.explorerCurrentPage = 1;
    this.explorerPageSize = 50;
    document.getElementById('explorer-services-tbody').innerHTML = `<tr><td colspan="9" class="text-center"><i class="fa-solid fa-spinner fa-spin"></i> Sağlayıcı servisleri yükleniyor, lütfen bekleyin...</td></tr>`;
    document.getElementById('modal-provider-explorer').classList.add('active');

    try {
      const res = await API.getRawProviderServices(providerId);
      // Saglayicinin para birimi ve panel kuru: fiyat hesabi bunlara dayanir.
      this.explorerCurrency = String(res.currency || 'USD').toUpperCase();
      this.explorerUsdTryRate = Number(res.usd_try_rate) > 0 ? Number(res.usd_try_rate) : 35;
      // Sitemizde bu saglayicidan zaten ekli olan servislerin ID'leri; ayni
      // servisi ikinci kez eklemeyi engellemek icin kullanilir.
      this.explorerAddedIds = new Set((res.added_service_ids || []).map(String));
      // Kendi siparislerimizden hesaplanan ortalama tamamlanma sureleri
      // (provider_service_id -> {n, avg_minutes}); yalnizca siparis verilmis servislerde dolu.
      this.explorerCompletionStats = res.completion_stats || {};
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
      tbody.innerHTML = `<tr><td colspan="9" class="text-center">Bu sağlayıcıda servis bulunamadı.</td></tr>`;
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
      tbody.innerHTML = `<tr><td colspan="9" class="text-center">Aramanızla eşleşen servis bulunamadı.</td></tr>`;
      this.renderExplorerPagination(0, 0);
      return;
    }

    tbody.innerHTML = renderList.map(s => {
      const isRefill = s.refill == 1 || /telafi|garanti|refill|düşüşsüz|non-drop|30 gün|60 gün|90 gün|365 gün/i.test(`${s._name} ${s._cat}`);
      const rawIdStr = s._sId.toString();
      const displayId = (rawIdStr.length > 10) ? `#${rawIdStr.slice(0, 8)}...` : `#${rawIdStr}`;
      // Ayni servis daha once eklendiyse satir soluklasir, secim ve ekleme kilitlenir.
      const alreadyAdded = this.explorerAddedIds?.has(rawIdStr);

      return `
        <tr${alreadyAdded ? ' style="opacity: .55;"' : ''}>
          <td style="width: 45px; text-align: center;"><input type="checkbox" class="explorer-service-checkbox" value="${this.escapeHtml(s._sId)}" ${alreadyAdded ? 'disabled title="Bu servis sitende zaten ekli"' : ''} style="cursor: ${alreadyAdded ? 'not-allowed' : 'pointer'};"></td>
          <td class="cell-nowrap" style="width: 120px; max-width: 120px; overflow: hidden; text-overflow: ellipsis; padding-left: 10px; font-weight: 700; color: var(--accent-cyan);" title="#${this.escapeHtml(s._sId)}">${this.escapeHtml(displayId)}</td>
          <td class="cell-nowrap" style="width: 220px; max-width: 220px; overflow: hidden; text-overflow: ellipsis;"><span class="badge badge-processing" title="${this.escapeHtml(s._cat)}">${this.escapeHtml(s._cat)}</span></td>
          <td class="cell-service-title" title="${this.escapeHtml(s._name)}">${this.escapeHtml(s._name)}</td>
          <td class="cell-nowrap" style="color: var(--accent-cyan); font-weight: 700;">$${s._rate.toFixed(3)}</td>
          <td class="cell-nowrap" style="font-size: 0.85rem;">${s._min} - ${s._max}</td>
          <td class="cell-nowrap" style="font-size: 0.85rem;">${(() => { const st = this.explorerCompletionStats?.[rawIdStr]; return st ? this.formatAvgCompletion(st.avg_minutes, st.n) : '<span style="color:var(--text-dim);" title="Bu servise henüz sipariş verilmedi">—</span>'; })()}</td>
          <td class="cell-nowrap">
            ${isRefill ? '<span class="badge badge-completed"><i class="fa-solid fa-shield-check"></i> Garantili</span>' : '<span class="badge badge-pending">Standart</span>'}
          </td>
          <td class="cell-actions" style="text-align: right;">
            ${alreadyAdded
              ? `<button class="btn btn-outline btn-sm" disabled title="Bu servis sitende zaten ekli" style="opacity:.75; cursor: not-allowed;">
                   <i class="fa-solid fa-circle-check" style="color: var(--success);"></i> Sitene Eklendi
                 </button>`
              : `<button class="btn btn-cyan btn-sm" onclick="app.openAddSingleServiceModal('${s._sId}', '${encodeURIComponent(s._cat)}', '${encodeURIComponent(s._name)}', ${s._rate}, ${s._min}, ${s._max})">
                   <i class="fa-solid fa-plus"></i> Siteme Ekle
                 </button>`}
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
    // Sitede zaten ekli olan satirlarin kutucugu kilitlidir; onlara dokunulmaz.
    document.querySelectorAll('.explorer-service-checkbox:not([disabled])').forEach(cb => { cb.checked = checked; });
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
      let skippedCount = 0;
      for (const sId of selectedIds) {
        const item = (this.currentExplorerServices || []).find(s => s._sId.toString() === sId.toString());
        if (!item) continue;
        // Sitede zaten ekli olan servis tekrar gonderilmez (sunucu da reddeder).
        if (this.explorerAddedIds?.has(sId.toString())) { skippedCount++; continue; }

        // Saglayici fiyati sabit para birimindedir (genelde USD). Once panelin
        // kuruyla TL'ye cevrilir, sonra kar marji uygulanir. Eskiden "fiyat 1'den
        // buyukse zaten TL'dir" varsayimi vardi; 1.50 $'lik servis 1,50 ₺ sanilip
        // zararina satiliyordu.
        const cost = Number(item._rate) || 0;
        const costInTry = this.explorerCurrency === 'TRY' ? cost : cost * this.explorerUsdTryRate;
        const sellRate = (costInTry * profitMultiplier).toFixed(2);
        const isRefill = /telafi|garanti|refill|düşüşsüz|non-drop|30 gün|60 gün|90 gün|365 gün/i.test(`${item._name} ${item._cat}`);

        try {
          await API.addAdminService({
            provider_id: this.currentExplorerProviderId,
            provider_service_id: item._sId,
            category_name: item._cat,
            name: item._name,
            rate_per_1000: Number(sellRate) > 0 ? sellRate : 10.00,
            rate_per_1000_usd: (this.explorerCurrency === 'TRY'
              ? (costInTry / (this.explorerUsdTryRate || 1)) * profitMultiplier
              : cost * profitMultiplier).toFixed(4),
            // Kar/zarar raporunun calismasi icin saglayici maliyeti de kaydedilir.
            provider_cost_rate: cost,
            provider_cost_currency: this.explorerCurrency,
            min_quantity: item._min,
            max_quantity: item._max,
            refill: isRefill ? 1 : 0
          });
          addedCount++;
          this.explorerAddedIds?.add(sId.toString());
        } catch (err) {
          // Sunucu "zaten ekli" derse bu bir hata degil, atlanan satirdir.
          if (err.code === 'service_already_added') {
            skippedCount++;
            this.explorerAddedIds?.add(sId.toString());
          } else {
            console.error(`Service #${sId} import error:`, err);
          }
        }
      }

      showToast(
        `${addedCount} adet servis başarıyla %${margin} kar marjı uygulanarak sitenize eklendi!` +
        (skippedCount ? ` ${skippedCount} servis zaten ekli olduğu için atlandı.` : ''),
        addedCount ? 'success' : 'warning'
      );
      this.closeModal('modal-provider-explorer');
      await this.loadAdminAddedServices();
      await this.loadServicesData();
    }
  }

  openAddSingleServiceModal(sId, encCat, encName, costRate, minQty, maxQty) {
    // Ayni saglayici servisi ikinci kez eklenemez.
    if (this.explorerAddedIds?.has(String(sId))) {
      showToast(`Bu servis (#${sId}) sitende zaten ekli.`, 'warning');
      return;
    }
    const cat = decodeURIComponent(encCat);
    const name = decodeURIComponent(encName);

    document.getElementById('single-provider-id').value = this.currentExplorerProviderId;
    document.getElementById('single-provider-service-id').value = sId;
    document.getElementById('single-category-name').value = cat;
    document.getElementById('single-category-name-en').value = cat;
    document.getElementById('single-service-name').value = name;
    document.getElementById('single-service-name-en').value = name;
    // Saglayici maliyeti kaydedilmek uzere saklanir; eskiden yalnizca ekranda
    // gosteriliyor, sunucuya gonderilmiyordu -> "Sağlayıcı Maliyeti" hep 0 kaliyordu.
    const cost = Number(costRate) || 0;
    const currency = String(this.explorerCurrency || 'USD').toUpperCase();
    const usdTry = Number(this.explorerUsdTryRate) > 0 ? Number(this.explorerUsdTryRate) : 35;
    this.singleServiceCost = { rate: cost, currency };
    document.getElementById('single-cost-price').value = `${currency === 'TRY' ? '₺' : '$'}${cost.toFixed(4)}${currency === 'TRY' ? '' : ` ≈ ₺${(cost * usdTry).toFixed(2)}`}`;

    // Auto detect refill status for modal select
    const isRefill = /telafi|garanti|refill|düşüşsüz|non-drop|30 gün|60 gün|90 gün|365 gün/i.test(`${name} ${cat}`);
    const refillSelect = document.getElementById('single-refill-select');
    if (refillSelect) refillSelect.value = isRefill ? "1" : "0";

    // Onerilen satis fiyati: maliyet -> TL (panel kuru) -> %50 kar.
    const costInTry = currency === 'TRY' ? cost : cost * usdTry;
    const suggestedSellPrice = (costInTry * 1.5).toFixed(2);
    document.getElementById('single-sell-price').value = Number(suggestedSellPrice) > 0 ? suggestedSellPrice : 15.00;
    document.getElementById('single-sell-price-usd').value = ((costInTry / usdTry) * 1.5).toFixed(4);

    document.getElementById('single-min-qty').value = minQty;
    document.getElementById('single-max-qty').value = maxQty;

    // Bilgi penceresi alanlari her acilista temizlenir (onceki servisten kalmasin).
    ['single-start-time-tr', 'single-start-time-en', 'single-speed-tr', 'single-speed-en',
      'single-features-tr', 'single-features-en', 'single-description-tr', 'single-description-en']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const providerLabel = document.getElementById('single-provider-label');
    if (providerLabel) providerLabel.textContent = this.adminProviderNames?.[String(this.currentExplorerProviderId)] || `#${this.currentExplorerProviderId}`;
    const providerServiceLabel = document.getElementById('single-provider-service-label');
    if (providerServiceLabel) providerServiceLabel.textContent = sId;

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
      // Kar/zarar raporu ve fiyat denetimi icin saglayici maliyeti de kaydedilir.
      provider_cost_rate: this.singleServiceCost?.rate || 0,
      provider_cost_currency: this.singleServiceCost?.currency || 'USD',
      description_tr: document.getElementById('single-description-tr').value,
      description_en: document.getElementById('single-description-en').value,
      start_time_tr: document.getElementById('single-start-time-tr').value,
      start_time_en: document.getElementById('single-start-time-en').value,
      speed_tr: document.getElementById('single-speed-tr').value,
      speed_en: document.getElementById('single-speed-en').value,
      features_tr: document.getElementById('single-features-tr').value,
      features_en: document.getElementById('single-features-en').value,
      min_quantity: document.getElementById('single-min-qty').value,
      max_quantity: document.getElementById('single-max-qty').value,
      refill: document.getElementById('single-refill-select')?.value || 0
    };

    try {
      const res = await API.addAdminService(data);
      showToast(res.message, 'success');
      this.closeModal('modal-add-single-service');
      // Explorer acik kalir: eklenen satir aninda "Sitene Eklendi"ye doner.
      if (data.provider_service_id) {
        this.explorerAddedIds?.add(String(data.provider_service_id));
        if (document.getElementById('modal-provider-explorer')?.classList.contains('active')) this.filterExplorerTable(false);
      }
      await this.loadServicesData();
    } catch (err) {
      if (err.code === 'service_already_added') {
        this.explorerAddedIds?.add(String(data.provider_service_id));
        this.closeModal('modal-add-single-service');
        if (document.getElementById('modal-provider-explorer')?.classList.contains('active')) this.filterExplorerTable(false);
        showToast(err.message, 'warning');
        return;
      }
      showToast(`Servis eklenemedi: ${err.message}`, 'error');
    }
  }

  // --- ADMIN ADDED SERVICES MANAGEMENT ---
  async loadAdminAddedServices() {
    const tbody = document.getElementById('admin-added-services-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="13" class="text-center"><i class="fa-solid fa-spinner fa-spin"></i> Sitedeki servisler yükleniyor...</td></tr>`;

    try {
      const res = await API.getAdminServices();
      this.adminUsdTryRate = Number(res.usd_try_rate) > 0 ? Number(res.usd_try_rate) : 35;
      const rawList = res.services || [];
      this.currentAdminAddedServices = rawList.map(s => ({
        ...s,
        // Saglayicidaki servis ID'si de aranabilir olmali: admin katalogda
        // gordugu numarayla "bunu eklemis miyim?" diye bakiyor.
        _searchIndex: `${s.id} ${s.name || ''} ${s.name_tr || ''} ${s.name_en || ''} ${s.category_name || ''} ${s.provider_name || ''} ${s.provider_service_id ?? ''}`.toLowerCase()
      }));
      this.syncAdminServicesProviderFilter();
      this.filterAdminAddedServicesTable();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="13" class="text-center" style="color: var(--danger);">Servisler yüklenemedi.</td></tr>`;
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
      // Kar/zarar raporu bu maliyete dayanir; maliyet degisince ozet de tazelenmeli.
      await this.loadAdminStats();
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
    this.priceAuditFilter = 'all';
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
    const filtersEl = document.getElementById('price-audit-filters');
    const rows = this.providerPriceAuditResults || [];
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">Sağlayıcıya bağlı aktif servis bulunamadı.</td></tr>';
      if (summary) summary.textContent = 'Kontrol edilecek servis bulunamadı.';
      if (filtersEl) filtersEl.innerHTML = '';
      return;
    }
    const waiting = rows.filter(item => item._notChecked).length;
    const increased = rows.filter(item => item.price_increased && !item._updated).length;
    const decreased = rows.filter(item => item.price_decreased && !item._updated).length;
    const unavailable = rows.filter(item => item.unavailable).length;
    if (summary) summary.innerHTML = waiting
      ? `<strong>${rows.length}</strong> aktif servis hazır. Canlı fiyatları karşılaştırmak için “Tüm Aktif Servisleri Kontrol Et” düğmesine bas.`
      : `<strong>${rows.length}</strong> servis kontrol edildi · <span style="color:#f87171"><strong>${increased}</strong> artış</span> · <span style="color:#4ade80"><strong>${decreased}</strong> düşüş</span> · <strong>${unavailable}</strong> erişilemeyen`;

    // Filtre dugmeleri: kontrol yapildiktan sonra anlamlidir.
    const filter = this.priceAuditFilter || 'all';
    if (filtersEl) {
      if (waiting) {
        filtersEl.innerHTML = '';
      } else {
        const defs = [
          { key: 'all', label: 'Tümü', count: rows.length },
          { key: 'increased', label: '📈 Fiyatı Artan', count: increased },
          { key: 'decreased', label: '📉 Fiyatı Düşen', count: decreased },
          { key: 'unavailable', label: '❌ Bulunamayan', count: unavailable }
        ];
        filtersEl.innerHTML = defs.map(d => `
          <button type="button" class="btn ${filter === d.key ? 'btn-primary' : 'btn-outline'} btn-sm"
                  onclick="app.setPriceAuditFilter('${d.key}')">${d.label} (${d.count})</button>`).join('');
      }
    }

    const visible = (waiting || filter === 'all') ? rows : rows.filter(item => {
      if (filter === 'unavailable') return item.unavailable;
      if (filter === 'increased') return item.price_increased && !item._updated;
      if (filter === 'decreased') return item.price_decreased && !item._updated;
      return true;
    });
    if (!visible.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">Bu filtreye uyan servis yok.</td></tr>';
      return;
    }
    tbody.innerHTML = visible.map(item => {
      const rowClass = item._updated ? 'price-audit-row-updated' : item.price_increased ? 'price-audit-row-increased' : item.price_decreased ? 'price-audit-row-decreased' : '';
      const change = item._notChecked ? '<span class="badge badge-pending">Kontrol bekliyor</span>' : item.change_percent === null
        ? '<span class="badge badge-pending">İlk kontrol</span>'
        : `<span class="badge ${item.price_increased ? 'badge-canceled' : item.price_decreased ? 'badge-completed' : 'badge-pending'}">${item.change_percent > 0 ? '+' : ''}%${Number(item.change_percent).toFixed(2)}</span>`;
      const suggestedMargin = Number.isFinite(Number(item.current_margin_percent)) ? Math.max(0, Number(item.current_margin_percent)).toFixed(1) : '70';
      // Saglayicida bulunamayan (silinmis) servis icin fiyat guncellenemez;
      // onun yerine dogrudan pasife alma / silme secenekleri sunulur.
      const actions = item._notChecked
        ? `<button class="btn btn-primary btn-sm" disabled><i class="fa-solid fa-check"></i> Güncelle</button>`
        : item.unavailable
          ? `<button class="btn btn-outline btn-sm" title="Servisi sitede pasife al (satışa kapat)" onclick="app.deactivateAuditedService(${item.id})"><i class="fa-solid fa-eye-slash"></i> Pasife Al</button>
             <button class="btn btn-outline btn-sm" title="Servisi kalıcı olarak sil" style="color:var(--danger);border-color:rgba(239,68,68,.4);" onclick="app.deleteAuditedService(${item.id})"><i class="fa-solid fa-trash"></i> Sil</button>`
          : `<button class="btn btn-primary btn-sm" onclick="app.applyAuditedProviderPrice(${item.id})"><i class="fa-solid fa-check"></i> ${item._updated ? 'Tekrar Güncelle' : 'Güncelle'}</button>`;
      return `<tr id="price-audit-row-${item.id}" class="${rowClass}">
        <td class="cell-truncate" title="${this.escapeHtml(item.name_tr)}"><strong>${this.escapeHtml(item.name_tr)}</strong><small style="display:block;color:var(--text-dim);">${this.escapeHtml(item.provider_name)} · #${this.escapeHtml(item.provider_service_id)}</small></td>
        <td class="cell-nowrap">${this.formatProviderCost(item.previous_cost_rate, item.previous_cost_currency)}</td>
        <td class="cell-nowrap">${item._notChecked ? '<span class="badge badge-pending">Kontrol edilmedi</span>' : item.unavailable ? '<span class="badge badge-canceled">Bulunamadı</span>' : this.formatProviderCost(item.current_cost_rate, item.current_cost_currency)}</td>
        <td class="cell-nowrap">${change}</td>
        <td class="cell-nowrap"><strong>₺${Number(item.current_sale_try || 0).toFixed(2)}</strong><small style="display:block;color:var(--text-dim);">$${Number(item.current_sale_usd || 0).toFixed(2)}</small></td>
        <td><input id="price-audit-margin-${item.id}" class="form-control price-audit-margin-input" type="number" min="0" max="1000" step="0.1" value="${suggestedMargin}" ${item.unavailable ? 'disabled' : ''}></td>
        <td class="cell-nowrap">${actions}</td>
      </tr>`;
    }).join('');
  }

  setPriceAuditFilter(filter) {
    this.priceAuditFilter = filter;
    this.renderProviderPriceAudit();
  }

  // Saglayicida artik bulunmayan servisi listeden pasife alir; satir tablodan
  // dusurulur, katalog onbellekleri tazelenir.
  async deactivateAuditedService(serviceId) {
    try {
      await API.bulkStatusAdminServices({ service_ids: [serviceId], status: 0 });
      showToast('Servis pasife alındı; sitede satışa kapatıldı.', 'success');
      this.providerPriceAuditResults = (this.providerPriceAuditResults || []).filter(item => item.id !== serviceId);
      this.renderProviderPriceAudit();
      await Promise.all([this.loadAdminAddedServices(), this.loadServicesData()]);
    } catch (err) {
      showToast(`Servis pasife alınamadı: ${err.message}`, 'error');
    }
  }

  async deleteAuditedService(serviceId) {
    const item = (this.providerPriceAuditResults || []).find(entry => entry.id === serviceId);
    const confirmed = await confirmDialog(
      `"${item?.name_tr || `#${serviceId}`}" servisi kalıcı olarak silinecek. Sipariş geçmişi varsa silinmez, pasife alınır. Devam edilsin mi?`,
      { title: 'Servisi sil', icon: 'fa-trash', danger: true, confirmText: 'Sil' }
    );
    if (!confirmed) return;
    try {
      const res = await API.deleteAdminService(serviceId);
      showToast(res.message, 'success');
      this.providerPriceAuditResults = (this.providerPriceAuditResults || []).filter(entry => entry.id !== serviceId);
      this.renderProviderPriceAudit();
      await Promise.all([this.loadAdminAddedServices(), this.loadServicesData()]);
    } catch (err) {
      showToast(`Servis silinemedi: ${err.message}`, 'error');
    }
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

  // --- EXCEL DISA AKTARMA ---
  // Buton, indirme suresince kilitlenir; boylece cift tiklamada iki istek gitmez.
  async runExcelExport(button, task, successMessage) {
    const original = button ? button.innerHTML : null;
    if (button) {
      button.disabled = true;
      button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Excel hazırlanıyor...';
    }
    try {
      const fileName = await task();
      showToast(`${successMessage} (${fileName})`, 'success');
    } catch (err) {
      showToast(`Excel indirilemedi: ${err.message}`, 'error');
    } finally {
      if (button) {
        button.disabled = false;
        button.innerHTML = original;
      }
    }
  }

  exportAdminServicesExcel(scope, event) {
    const labels = { active: 'Aktif servisler indirildi.', passive: 'Pasif servisler indirildi.', all: 'Tüm servisler indirildi.' };
    return this.runExcelExport(event?.currentTarget, () => API.exportAdminServices(scope), labels[scope] || 'Liste indirildi.');
  }

  exportProviderCatalogExcel(event) {
    const providerId = this.currentExplorerProviderId;
    if (!providerId) {
      showToast('Önce bir sağlayıcı kataloğu açın.', 'warning');
      return;
    }
    return this.runExcelExport(event?.currentTarget, () => API.exportProviderServices(providerId), 'Sağlayıcı kataloğu indirildi.');
  }

  // Servis kataloğu: aktif/pasif sekmesi, sağlayıcı filtresi ve 50'lik sayfalama.
  providerLabelOf(service) {
    return service.provider_name || 'Manuel Eklenen';
  }

  syncAdminServicesProviderFilter() {
    const select = document.getElementById('admin-services-provider-filter');
    if (!select) return;
    const names = [...new Set((this.currentAdminAddedServices || []).map(s => this.providerLabelOf(s)))].sort((a, b) => a.localeCompare(b, 'tr'));
    const previous = this.adminServicesProviderFilter || 'all';
    select.innerHTML = `<option value="all">🏷️ Tüm Sağlayıcılar</option>` +
      names.map(n => `<option value="${this.escapeHtml(n)}">${this.escapeHtml(n)}</option>`).join('');
    // Sağlayıcı silinmişse seçim "all"a döner, aksi halde korunur.
    select.value = names.includes(previous) ? previous : 'all';
    this.adminServicesProviderFilter = select.value;
  }

  switchAdminServicesStatus(status) {
    this.adminServicesStatusFilter = status;
    this.adminServicesPage = 1;
    document.getElementById('admin-services-tab-active')?.classList.toggle('active', status === 1);
    document.getElementById('admin-services-tab-passive')?.classList.toggle('active', status === 0);
    document.getElementById('admin-services-tab-favorite')?.classList.toggle('active', status === 'favorite');
    this.filterAdminAddedServicesTable();
  }

  // Satirdaki yildiz: favoriye ekler/cikarir; liste sunucuya gitmeden guncellenir.
  async toggleAdminServiceFavorite(serviceId) {
    const service = (this.currentAdminAddedServices || []).find(s => s.id === serviceId);
    if (!service) return;
    const next = Number(service.is_favorite) === 1 ? 0 : 1;
    try {
      const res = await API.setAdminServiceFavorite(serviceId, next);
      service.is_favorite = next;
      showToast(res.message, 'success');
      this.filterAdminAddedServicesTable();
    } catch (err) {
      showToast(`Favori güncellenemedi: ${err.message}`, 'error');
    }
  }

  onAdminServicesProviderChange() {
    this.adminServicesProviderFilter = document.getElementById('admin-services-provider-filter')?.value || 'all';
    this.adminServicesPage = 1;
    this.filterAdminAddedServicesTable();
  }

  setAdminServicesPage(page) {
    this.adminServicesPage = page;
    this.filterAdminAddedServicesTable();
    document.getElementById('admin-tab-services')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  renderAdminServicesPagination(totalItems, totalPages, currentPage, pageSize) {
    const box = document.getElementById('admin-services-pagination');
    if (!box) return;
    if (totalItems === 0) { box.innerHTML = ''; return; }

    const firstItem = (currentPage - 1) * pageSize + 1;
    const lastItem = Math.min(currentPage * pageSize, totalItems);

    // Uzun listelerde tüm sayfa numaralarını basmamak için aktif sayfanın etrafında pencere.
    const pages = [];
    const windowSize = 2;
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= currentPage - windowSize && p <= currentPage + windowSize)) pages.push(p);
      else if (pages[pages.length - 1] !== '...') pages.push('...');
    }

    const btn = (label, page, opts = {}) => {
      const { disabled = false, active = false, title = '' } = opts;
      return `<button type="button" class="btn btn-sm ${active ? 'btn-primary' : 'btn-outline'}"
        ${disabled ? 'disabled' : `onclick="app.setAdminServicesPage(${page})"`}
        ${title ? `title="${title}"` : ''}
        style="min-width: 38px; ${disabled ? 'opacity:.4; cursor:not-allowed;' : ''}">${label}</button>`;
    };

    box.innerHTML = `
      <div style="font-size: 0.85rem; color: var(--text-muted);">
        Toplam <strong style="color:#fff;">${totalItems}</strong> servis · ${firstItem}-${lastItem} arası gösteriliyor
        <span style="color: var(--text-dim);">(sayfa ${currentPage}/${totalPages})</span>
      </div>
      <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
        ${btn('<i class="fa-solid fa-angle-left"></i>', currentPage - 1, { disabled: currentPage === 1, title: 'Önceki' })}
        ${pages.map(p => p === '...'
          ? `<span style="color: var(--text-dim); padding: 0 4px;">…</span>`
          : btn(p, p, { active: p === currentPage })).join('')}
        ${btn('<i class="fa-solid fa-angle-right"></i>', currentPage + 1, { disabled: currentPage === totalPages, title: 'Sonraki' })}
      </div>`;
  }

  filterAdminAddedServicesTable() {
    const search = (document.getElementById('admin-added-services-search')?.value || '').trim().toLowerCase();
    const tbody = document.getElementById('admin-added-services-tbody');
    if (!tbody) return;

    const statusFilter = this.adminServicesStatusFilter ?? 1;
    const providerFilter = this.adminServicesProviderFilter || 'all';
    const pageSize = 50;
    const all = this.currentAdminAddedServices || [];

    const activeTotal = all.filter(s => Number(s.status) === 1).length;
    const passiveTotal = all.length - activeTotal;
    const activeBadge = document.getElementById('admin-services-active-count');
    const passiveBadge = document.getElementById('admin-services-passive-count');
    if (activeBadge) activeBadge.innerText = activeTotal;
    if (passiveBadge) passiveBadge.innerText = passiveTotal;
    const favoriteBadge = document.getElementById('admin-services-favorite-count');
    if (favoriteBadge) favoriteBadge.innerText = all.filter(s => Number(s.is_favorite) === 1).length;

    if (all.length === 0) {
      tbody.innerHTML = `<tr><td colspan="13" class="text-center">Sitenize eklenmiş hiç servis bulunmuyor. Sağlayıcılar sekmesinden servis seçerek ekleyebilirsiniz.</td></tr>`;
      this.renderAdminServicesPagination(0, 0, 1, pageSize);
      this.updateSelectedServicesCount();
      return;
    }

    // Favori sekmesi aktif/pasif ayrimi yapmaz; yildizli her servis listelenir.
    let filtered = statusFilter === 'favorite'
      ? all.filter(s => Number(s.is_favorite) === 1)
      : all.filter(s => Number(s.status) === statusFilter);
    if (providerFilter !== 'all') filtered = filtered.filter(s => this.providerLabelOf(s) === providerFilter);
    if (search) {
      filtered = filtered.filter(s => s._searchIndex ? s._searchIndex.includes(search) : (s.name || '').toLowerCase().includes(search));
    }

    // Sağlayıcıya göre grupla (grup içinde en yeni servis üstte kalsın).
    filtered = [...filtered].sort((a, b) => {
      const cmp = this.providerLabelOf(a).localeCompare(this.providerLabelOf(b), 'tr');
      return cmp !== 0 ? cmp : Number(b.id) - Number(a.id);
    });

    if (filtered.length === 0) {
      const emptyMsg = statusFilter === 'favorite'
        ? 'Henüz favori servisiniz yok. Aktif/Pasif listesinde satırdaki ⭐ butonuna basarak ekleyebilirsiniz.'
        : statusFilter === 1
          ? 'Bu filtreyle eşleşen aktif servis bulunamadı.'
          : 'Pasife alınmış servis bulunmuyor.';
      tbody.innerHTML = `<tr><td colspan="13" class="text-center">${emptyMsg}</td></tr>`;
      this.renderAdminServicesPagination(0, 0, 1, pageSize);
      this.updateSelectedServicesCount();
      return;
    }

    const totalPages = Math.ceil(filtered.length / pageSize);
    // Filtre daraldığında mevcut sayfa listenin dışında kalabilir.
    let currentPage = this.adminServicesPage || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
    this.adminServicesPage = currentPage;

    const renderList = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const groupCounts = new Map();
    for (const s of filtered) {
      const label = this.providerLabelOf(s);
      groupCounts.set(label, (groupCounts.get(label) || 0) + 1);
    }
    // Tek sağlayıcı varken grup başlığı gereksiz gürültü olur.
    const showProviderGroups = groupCounts.size > 1;
    let lastProvider = null;

    tbody.innerHTML = renderList.map(s => {
      let groupHeader = '';
      const providerLabel = this.providerLabelOf(s);
      if (showProviderGroups && providerLabel !== lastProvider) {
        const countInGroup = groupCounts.get(providerLabel);
        groupHeader = `
      <tr class="provider-group-row">
        <td colspan="13" style="background: rgba(139, 92, 246, 0.12); border-top: 2px solid var(--primary); font-weight: 800; color: #fff; padding: 10px 14px;">
          <i class="fa-solid fa-server" style="color: var(--accent-cyan);"></i>
          ${this.escapeHtml(providerLabel)}
          <span class="badge badge-processing" style="margin-left: 8px;">${countInGroup} servis</span>
        </td>
      </tr>`;
        lastProvider = providerLabel;
      }
      return groupHeader + this.renderAdminServiceRow(s);
    }).join('');

    this.renderAdminServicesPagination(filtered.length, totalPages, currentPage, pageSize);
    this.updateSelectedServicesCount();
  }

  renderAdminServiceRow(s) {
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
        <td class="cell-nowrap" style="font-size: 0.85rem;">
          <strong style="color: var(--accent-cyan);">${this.escapeHtml(s.provider_name || 'Manuel Eklenen')}</strong>
          <small style="display:block;color:var(--text-dim);">Servis #${this.escapeHtml(s.provider_service_id || '-')}</small>
        </td>
        <td class="cell-nowrap">${costLabel}</td>
        <td class="cell-nowrap" style="color: var(--success); font-weight: 700;">₺${parseFloat(s.rate_per_1000).toFixed(2)}</td>
        <td class="cell-nowrap" style="color: var(--accent-cyan); font-weight: 700;">$${(Number(s.rate_per_1000_usd_cents || 0) / 100).toFixed(2)}</td>
        <td class="cell-nowrap">${profitLabel}</td>
        <td class="cell-nowrap" style="font-size: 0.85rem;">${s.min_quantity} - ${s.max_quantity}</td>
        <td class="cell-nowrap" style="font-size: 0.85rem;">${this.formatAvgCompletion(s.avg_completion_minutes, s.completed_order_count)}</td>
        <td class="cell-nowrap">
          <span class="badge ${s.status ? 'badge-completed' : 'badge-canceled'}">
            ${s.status ? 'Aktif' : 'Pasif'}
          </span>
        </td>
        <td class="cell-actions">
          <div style="display: inline-flex; gap: 6px;">
            <button class="btn btn-outline btn-sm admin-fav-btn ${Number(s.is_favorite) === 1 ? 'is-fav' : ''}" onclick="app.toggleAdminServiceFavorite(${s.id})" title="${Number(s.is_favorite) === 1 ? 'Favorilerden çıkar' : 'Favorilere ekle'}" aria-label="Favori">
              <i class="fa-${Number(s.is_favorite) === 1 ? 'solid' : 'regular'} fa-star"></i>
            </button>
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
      'Sitedeki TÜM servisler kalıcı olarak SİLİNECEK.\n\nYalnızca sipariş geçmişi olan servisler silinemez; onlar geçmiş kayıtları bozulmasın diye pasife alınır.\n\nBu işlemi geri alamazsınız. Onaylamak için aşağıya SİL yazın.',
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
    document.getElementById('edit-service-start-time-tr').value = service.start_time_tr || '';
    document.getElementById('edit-service-start-time-en').value = service.start_time_en || '';
    document.getElementById('edit-service-speed-tr').value = service.speed_tr || '';
    document.getElementById('edit-service-speed-en').value = service.speed_en || '';
    document.getElementById('edit-service-features-tr').value = service.features_tr || '';
    document.getElementById('edit-service-features-en').value = service.features_en || '';
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
      start_time_tr: document.getElementById('edit-service-start-time-tr').value,
      start_time_en: document.getElementById('edit-service-start-time-en').value,
      speed_tr: document.getElementById('edit-service-speed-tr').value,
      speed_en: document.getElementById('edit-service-speed-en').value,
      features_tr: document.getElementById('edit-service-features-tr').value,
      features_en: document.getElementById('edit-service-features-en').value,
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
      // Servis artik acik olan sekmeden cikacagi icin nereye tasindigi soylenir.
      showToast(newStatus ? 'Servis aktif edildi ve "Aktif Servisler" sekmesine taşındı.' : 'Servis pasife alındı ve "Pasif Servisler" sekmesine taşındı.', 'success');
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
    const q = document.getElementById('admin-users-search')?.value.trim() || '';
    try {
      const res = await API.getAdminUsers(q);
      if (!res.users.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center">${q ? 'Aramanla eşleşen kullanıcı bulunamadı.' : 'Henüz kullanıcı yok.'}</td></tr>`;
        return;
      }
      tbody.innerHTML = res.users.map(u => `
        <tr${u.banned ? ' style="opacity:.6;"' : ''}>
          <td>#${u.id}</td>
          <td style="font-weight: 700;">${this.escapeHtml(u.username)}</td>
          <td>${this.escapeHtml(u.email)}</td>
          <td><span class="badge ${u.role === 'admin' ? 'badge-processing' : 'badge-completed'}">${this.escapeHtml(u.role)}</span></td>
          <td>${u.banned ? '<span class="badge badge-canceled">Banlı</span>' : '<span class="badge badge-completed">Aktif</span>'}</td>
          <td style="color: var(--success); font-weight: 700;">₺${parseFloat(u.balance).toFixed(2)}</td>
          <td style="white-space: nowrap;">
            <button class="btn btn-cyan btn-sm" onclick="app.openAssignService(${u.id}, '${this.escapeHtml(u.username)}')" title="Kullanıcıya hizmet ata"><i class="fa-solid fa-gift"></i> Hizmet Ata</button>
            <button class="btn btn-outline btn-sm" onclick="app.editUserBalance(${u.id}, 'add')" title="Bakiye ekle">+ Bakiye</button>
            <button class="btn btn-outline btn-sm" onclick="app.editUserBalance(${u.id}, 'subtract')" title="Bakiye düş">- Bakiye</button>
            ${u.role === 'admin' ? '' : `
            <button class="btn btn-outline btn-sm" onclick="app.changeUserPassword(${u.id}, '${this.escapeHtml(u.username)}')" title="Şifre değiştir"><i class="fa-solid fa-key"></i></button>
            <button class="btn btn-outline btn-sm" onclick="app.toggleUserBan(${u.id}, '${this.escapeHtml(u.username)}', ${u.banned ? 'false' : 'true'})" title="${u.banned ? 'Banı kaldır' : 'Banla'}">
              <i class="fa-solid ${u.banned ? 'fa-unlock' : 'fa-ban'}"></i>
            </button>
            <button class="btn btn-outline btn-sm" style="color: var(--danger); border-color: var(--danger);" onclick="app.deleteUserAccount(${u.id}, '${this.escapeHtml(u.username)}')" title="Kullanıcıyı sil"><i class="fa-solid fa-trash"></i></button>`}
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center">Kullanıcılar yüklenemedi.</td></tr>`;
    }
  }

  // --- KULLANICIYA HIZMET ATAMA (Admin) ---
  async openAssignService(userId, username) {
    this.assignServiceTargetUser = { id: userId, username };
    document.getElementById('assign-service-username').textContent = username;
    document.getElementById('assign-service-link').value = '';
    document.getElementById('assign-service-qty').value = '';
    document.getElementById('assign-service-charge').value = 'gift';
    const search = document.getElementById('assign-service-search');
    if (search) search.value = '';

    // Favori bilgisi yalnizca admin listesinde var; henuz yuklenmediyse cekilir.
    if (!Array.isArray(this.currentAdminAddedServices) || !this.currentAdminAddedServices.length) {
      try {
        const res = await API.getAdminServices();
        this.currentAdminAddedServices = (res.services || []).map(s => ({
          ...s, _searchIndex: `${s.id} ${s.name || ''} ${s.category_name || ''} ${s.provider_name || ''}`.toLowerCase()
        }));
      } catch { this.currentAdminAddedServices = this.currentAdminAddedServices || []; }
    }
    this.assignServiceList = (this.currentAdminAddedServices || [])
      .filter(s => Number(s.status) === 1)
      .map(s => ({ ...s, name: s.name_tr || s.name, _searchIndex: `${s.id} ${s.name_tr || s.name || ''} ${s.name_en || ''} ${s.category_name || ''}`.toLowerCase() }));
    const hasFavorites = this.assignServiceList.some(s => Number(s.is_favorite) === 1);
    // Favori varsa dogrudan favorilerden baslanir; yoksa tum liste.
    this.setAssignServiceMode(hasFavorites ? 'favorite' : 'all');
    document.getElementById('modal-assign-service').classList.add('active');
  }

  setAssignServiceMode(mode) {
    this.assignServiceMode = mode === 'favorite' ? 'favorite' : 'all';
    document.getElementById('assign-service-tab-all')?.classList.toggle('active', this.assignServiceMode === 'all');
    document.getElementById('assign-service-tab-favorite')?.classList.toggle('active', this.assignServiceMode === 'favorite');
    this.renderAssignServiceOptions();
  }

  renderAssignServiceOptions() {
    const select = document.getElementById('assign-service-select');
    if (!select) return;
    const list = this.assignServiceList || [];
    const search = (document.getElementById('assign-service-search')?.value || '').trim().toLowerCase();
    const favorites = list.filter(s => Number(s.is_favorite) === 1);
    const countAll = document.getElementById('assign-service-count-all');
    const countFav = document.getElementById('assign-service-count-favorite');
    if (countAll) countAll.textContent = list.length;
    if (countFav) countFav.textContent = favorites.length;

    let filtered = this.assignServiceMode === 'favorite' ? favorites : list;
    if (search) filtered = filtered.filter(s => s._searchIndex.includes(search));

    const previous = Number(select.value);
    select.innerHTML = filtered.map(s =>
      `<option value="${s.id}">${Number(s.is_favorite) === 1 ? '⭐ ' : ''}#${s.id} — ${this.escapeHtml(s.name)} (₺${Number(s.rate_per_1000).toFixed(2)}/1000)</option>`
    ).join('');
    if (filtered.some(s => s.id === previous)) select.value = String(previous);
    else if (filtered.length) select.selectedIndex = 0;

    const empty = document.getElementById('assign-service-empty');
    if (empty) {
      empty.style.display = filtered.length ? 'none' : 'block';
      empty.textContent = this.assignServiceMode === 'favorite' && !favorites.length
        ? 'Henüz favori servisiniz yok. Servisler sekmesinde satırdaki ⭐ ile ekleyin.'
        : 'Aramayla eşleşen servis bulunamadı.';
    }
    this.onAssignServiceChange();
  }

  onAssignServiceChange() {
    const serviceId = Number(document.getElementById('assign-service-select')?.value);
    const service = (this.assignServiceList || this.allServices || []).find(s => s.id === serviceId);
    const limitsEl = document.getElementById('assign-service-limits');
    const totalEl = document.getElementById('assign-service-total');
    const qtyInput = document.getElementById('assign-service-qty');
    if (!service) { if (limitsEl) limitsEl.textContent = ''; if (totalEl) totalEl.textContent = '₺0.00'; return; }
    limitsEl.textContent = `Limit: ${service.min_quantity} - ${service.max_quantity}`;
    qtyInput.min = service.min_quantity;
    qtyInput.max = service.max_quantity;
    if (!qtyInput.value) qtyInput.value = service.min_quantity;
    const qty = Number(qtyInput.value) || 0;
    const chargeMode = document.getElementById('assign-service-charge').value;
    const total = chargeMode === 'charge' ? (Number(service.rate_per_1000) * qty) / 1000 : 0;
    totalEl.textContent = `₺${total.toFixed(2)}`;
  }

  async handleAssignServiceSubmit(e) {
    e.preventDefault();
    const target = this.assignServiceTargetUser;
    if (!target) return;
    const service_id = Number(document.getElementById('assign-service-select').value);
    const link = document.getElementById('assign-service-link').value.trim();
    const quantity = Number(document.getElementById('assign-service-qty').value);
    const charge_user = document.getElementById('assign-service-charge').value === 'charge';
    const confirmed = await confirmDialog(
      `"${target.username}" kullanıcısına ${quantity} adet sipariş oluşturulacak ve sağlayıcıya iletilecek.\n\nÜcretlendirme: ${charge_user ? 'kullanıcının bakiyesinden düşülecek' : 'HEDİYE (ücret alınmayacak)'}. Devam edilsin mi?`,
      { title: 'Hizmet atamasını onayla', icon: 'fa-gift', confirmText: 'Oluştur ve Gönder' }
    );
    if (!confirmed) return;
    try {
      const res = await API.assignUserOrder(target.id, { service_id, link, quantity, charge_user });
      showToast(res.message, 'success');
      this.closeModal('modal-assign-service');
      this.loadAdminUsers();
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  }

  async toggleUserBan(userId, username, banned) {
    const confirmed = await confirmDialog(
      banned
        ? `"${username}" kullanıcısı banlanacak: giriş yapamaz, açık oturumları anında kapanır. Devam edilsin mi?`
        : `"${username}" kullanıcısının banı kaldırılacak ve yeniden giriş yapabilecek. Devam edilsin mi?`,
      { title: banned ? 'Kullanıcıyı banla' : 'Banı kaldır', icon: banned ? 'fa-ban' : 'fa-unlock', danger: banned, confirmText: banned ? 'Banla' : 'Banı Kaldır' }
    );
    if (!confirmed) return;
    try {
      const res = await API.setUserBan(userId, banned);
      showToast(res.message, 'success');
      this.loadAdminUsers();
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  }

  async changeUserPassword(userId, username) {
    const newPassword = await promptDialog(
      `"${username}" kullanıcısı için yeni şifreyi girin. Kullanıcının açık oturumları kapatılır.`,
      {
        title: 'Kullanıcı şifresini değiştir',
        icon: 'fa-key',
        confirmText: 'Şifreyi Değiştir',
        placeholder: 'En az 10 karakter',
        validate: value => String(value).length >= 10 ? null : 'Şifre en az 10 karakter olmalıdır.'
      }
    );
    if (!newPassword) return;
    try {
      const res = await API.setUserPassword(userId, newPassword);
      showToast(res.message, 'success');
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  }

  async deleteUserAccount(userId, username) {
    const confirmed = await confirmDialog(
      `"${username}" kullanıcısı; siparişleri, ödemeleri ve destek talepleriyle birlikte KALICI olarak silinecek. Bu işlem geri alınamaz! Emin misin?`,
      { title: 'Kullanıcıyı sil', icon: 'fa-trash', danger: true, confirmText: 'Kalıcı Olarak Sil' }
    );
    if (!confirmed) return;
    try {
      const res = await API.deleteUser(userId);
      showToast(res.message, 'success');
      this.loadAdminUsers();
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
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
    const q = document.getElementById('admin-orders-search')?.value.trim() || '';
    try {
      const res = await API.getAdminOrders(q);
      this.adminOrdersCache = res.orders || [];
      this.adminOrdersQuery = q;
      this.renderAdminOrders();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center">Siparişler yüklenemedi.</td></tr>`;
    }
  }

  // Durum gruplari: filtre dugmeleri ve rozetler ayni tanimi kullanir.
  adminOrderStatusInfo(status) {
    const map = {
      pending: { label: 'Bekliyor', badge: 'badge-pending', group: 'pending' },
      processing: { label: 'İşlemde', badge: 'badge-processing', group: 'active' },
      in_progress: { label: 'İşlemde', badge: 'badge-processing', group: 'active' },
      completed: { label: 'Tamamlandı', badge: 'badge-completed', group: 'completed' },
      partial: { label: 'Kısmi Teslim', badge: 'badge-pending', group: 'problem' },
      canceled: { label: 'İptal Edildi', badge: 'badge-canceled', group: 'problem' },
      failed: { label: 'Başarısız', badge: 'badge-canceled', group: 'problem' }
    };
    return map[status] || { label: status, badge: 'badge-pending', group: 'problem' };
  }

  renderAdminOrders() {
    const tbody = document.getElementById('admin-all-orders-tbody');
    const filtersEl = document.getElementById('admin-orders-filters');
    if (!tbody) return;
    const orders = this.adminOrdersCache || [];
    const filter = this.adminOrdersFilter || 'all';

    // Filtre dugmeleri sayaçlariyla birlikte her cizimde tazelenir.
    if (filtersEl) {
      const groups = [
        { key: 'all', label: 'Tümü', count: orders.length },
        { key: 'pending', label: 'Bekleyen' },
        { key: 'active', label: 'İşlemde' },
        { key: 'completed', label: 'Tamamlanan' },
        { key: 'problem', label: 'Sorunlu' }
      ];
      groups.forEach(g => {
        if (g.key !== 'all') g.count = orders.filter(o => this.adminOrderStatusInfo(o.status).group === g.key).length;
      });
      filtersEl.innerHTML = groups.map(g => `
        <button type="button" class="btn ${filter === g.key ? 'btn-primary' : 'btn-outline'} btn-sm"
                onclick="app.setAdminOrdersFilter('${g.key}')">${g.label} (${g.count})</button>`).join('');
    }

    const visible = filter === 'all' ? orders : orders.filter(o => this.adminOrderStatusInfo(o.status).group === filter);
    if (!visible.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center">${this.adminOrdersQuery ? 'Aramanla eşleşen sipariş bulunamadı.' : (orders.length ? 'Bu filtreye uyan sipariş yok.' : 'Henüz sipariş yok.')}</td></tr>`;
      return;
    }

    tbody.innerHTML = visible.map(o => {
      const info = this.adminOrderStatusInfo(o.status);
      // Hata/iptal sebebi durumun hemen altinda gorunur (saglayici mesaji dahil).
      const reason = o.failure_reason
        ? `<div style="font-size:.72rem;color:var(--danger);margin-top:4px;max-width:240px;white-space:normal;line-height:1.35;">${this.escapeHtml(o.failure_reason)}</div>`
        : '';
      // Mudahale butonlari yalnizca hala akista olan siparislerde gorunur.
      // failed: islem hic yapilmadi, tutar iade edildi -> mudahale edilemez.
      // completed/canceled: is bitti -> buton gereksiz.
      const canAct = ['pending', 'processing', 'in_progress'].includes(o.status);
      // Tamamlanan siparise yorum daveti maili: sablon E-Posta Pazarlama >
      // Sablonlar'daki "Sipariş Tamamlandı — Yorum Daveti" kaydidir.
      const reviewMailBtn = o.status === 'completed'
        ? (o.review_mail_sent_at
          ? `<button class="btn btn-outline btn-sm" title="Gönderildi: ${new Date(o.review_mail_sent_at).toLocaleString('tr-TR')} — tekrar göndermek için tıkla" onclick="app.sendOrderReviewMail(${o.id}, true)"><i class="fa-solid fa-envelope-circle-check"></i> Gönderildi</button>`
          : `<button class="btn btn-primary btn-sm" title="Yorum daveti maili gönder" onclick="app.sendOrderReviewMail(${o.id}, false)"><i class="fa-solid fa-envelope"></i> Mail Gönder</button>`)
        : '';
      const actions = canAct
        ? `<button class="btn btn-primary btn-sm" onclick="app.updateOrderStatus(${o.id}, 'completed')">Tamamla</button>
           <button class="btn btn-outline btn-sm" onclick="app.updateOrderStatus(${o.id}, 'canceled')">İptal & İade</button>`
        : (reviewMailBtn || '');
      const tarih = o.created_at ? new Date(o.created_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
      const saglayici = o.provider_name
        ? `<small style="display:block;color:var(--text-dim);">${this.escapeHtml(o.provider_name)}${o.provider_order_id ? ` · #${this.escapeHtml(String(o.provider_order_id))}` : ''}</small>`
        : '<small style="display:block;color:var(--text-dim);">Manuel</small>';
      return `
      <tr>
        <td class="cell-nowrap"><strong>#${o.id}</strong><small style="display:block;color:var(--text-dim);">${tarih}</small></td>
        <td>${this.escapeHtml(o.username)}</td>
        <td class="cell-truncate" style="font-size: 0.85rem;" title="${this.escapeHtml(o.service_name)}">${this.escapeHtml(o.service_name)}${saglayici}</td>
        <td>${this.renderOrderLink(o.link, 40, '0.8rem')}</td>
        <td>${o.quantity}</td>
        <td class="cell-nowrap" style="font-weight: 700;">₺${Number(o.charge || 0).toFixed(2)}</td>
        <td><span class="badge ${info.badge}">${info.label}</span>${reason}</td>
        <td class="cell-nowrap">
          <button class="btn btn-outline btn-sm" onclick="app.openOrderDetail(${o.id})" title="Sipariş detayları ve servisi tekrar kullanma"><i class="fa-solid fa-eye"></i> Detay</button>
          ${actions}
        </td>
      </tr>`;
    }).join('');
  }

  setAdminOrdersFilter(filter) {
    this.adminOrdersFilter = filter;
    this.renderAdminOrders();
  }

  // --- SİPARİŞ DETAY POPUP'I ---
  openOrderDetail(orderId) {
    const o = (this.adminOrdersCache || []).find(item => item.id === orderId);
    if (!o) return showToast('Sipariş bulunamadı; listeyi yenileyip tekrar dene.', 'warning');
    this.orderDetailOrder = o;

    const info = this.adminOrderStatusInfo(o.status);
    const tarih = v => v ? new Date(v).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
    const alan = (label, value) => `
      <div>
        <div style="font-size: .72rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 2px;">${label}</div>
        <div style="font-size: .92rem; font-weight: 600; word-break: break-word;">${value}</div>
      </div>`;

    document.getElementById('order-detail-title').innerHTML = `<i class="fa-solid fa-box-open"></i> Sipariş #${o.id}`;
    document.getElementById('order-detail-info').innerHTML = [
      alan('Müşteri', this.escapeHtml(o.username)),
      alan('Durum', `<span class="badge ${info.badge}">${info.label}</span>`),
      alan('Servis', this.escapeHtml(o.service_name)),
      alan('Sağlayıcı', o.provider_name ? `${this.escapeHtml(o.provider_name)}${o.provider_order_id ? ` · Sağlayıcı No: #${this.escapeHtml(String(o.provider_order_id))}` : ''}` : 'Manuel / atanmadı'),
      alan('Bağlantı', this.renderOrderLink(o.link, 60, '0.88rem')),
      alan('Miktar', String(o.quantity)),
      alan('Tutar', `₺${Number(o.charge || 0).toFixed(2)}`),
      alan('Başlangıç Sayacı', o.start_count ? String(o.start_count) : '—'),
      alan('Kalan', o.remains ? String(o.remains) : '—'),
      alan('Oluşturulma', tarih(o.created_at)),
      alan('Bitiş', o.completed_at ? tarih(o.completed_at) : (['completed', 'canceled', 'failed', 'partial'].includes(o.status) ? 'Kayıt yok (eski sipariş)' : 'Devam ediyor'))
    ].join('');

    // Hata/iptal sebebi varsa ayri kutuda gosterilir.
    const errBox = document.getElementById('order-detail-error');
    if (o.failure_reason) {
      errBox.innerHTML = `<strong><i class="fa-solid fa-triangle-exclamation"></i> Hata / İptal Sebebi:</strong><br>${this.escapeHtml(o.failure_reason)}`;
      errBox.style.display = 'block';
    } else {
      errBox.style.display = 'none';
    }

    document.getElementById('modal-order-detail').classList.add('active');
  }

  // --- SERVİSİ TEKRAR KULLAN (siparis detayindan ve tamamlanma listesinden) ---
  openServiceReuseFromOrder() {
    const o = this.orderDetailOrder;
    if (!o) return;
    this.openServiceReuse(o.service_id, o.service_name, { username: o.username, quantity: o.quantity });
  }

  async openServiceReuse(serviceId, serviceName, opts = {}) {
    if (!serviceName) {
      const s = (this.completionTimesList || []).find(x => x.id === serviceId)
        || (this.currentAdminAddedServices || []).find(x => x.id === serviceId);
      serviceName = s ? (s.name_tr || s.name) : null;
    }
    this.serviceReuseContext = { serviceId, serviceName: serviceName || `Servis #${serviceId}` };
    this.orderReuseSelectedUser = null;

    document.getElementById('order-reuse-summary').innerHTML = `<strong>Servis:</strong> ${this.escapeHtml(this.serviceReuseContext.serviceName)}<br>"Bakiyeden düş" tutarı kullanıcının bakiyesinden tahsil eder; "Hediye" ücret almaz.`;
    document.getElementById('order-reuse-username').value = opts.username || '';
    document.getElementById('order-reuse-qty').value = opts.quantity || 1;
    document.getElementById('order-reuse-link').value = '';
    document.getElementById('order-reuse-charge').value = 'charge';
    document.getElementById('order-reuse-user-list').style.display = 'none';
    document.getElementById('modal-service-reuse').classList.add('active');

    // Kullanici listesi arka planda yuklenir; secim kutusu aninda calisir.
    if (!this.orderReuseUsers) {
      try {
        const res = await API.getAdminUsers('');
        this.orderReuseUsers = res.users || [];
      } catch { this.orderReuseUsers = []; }
    }
    // Onceden dolu gelen kullanici adi listeden dogrulanip secili sayilir.
    if (opts.username) {
      this.orderReuseSelectedUser = (this.orderReuseUsers || []).find(u => u.username.toLowerCase() === String(opts.username).toLowerCase()) || null;
    }
  }

  filterOrderReuseUsers() {
    const input = document.getElementById('order-reuse-username');
    const list = document.getElementById('order-reuse-user-list');
    if (!input || !list) return;
    const q = input.value.trim().toLowerCase();
    // Elle yazilan metin secimi gecersiz kilar; gonderimde yeniden dogrulanir.
    if (this.orderReuseSelectedUser && this.orderReuseSelectedUser.username.toLowerCase() !== q) this.orderReuseSelectedUser = null;
    const users = this.orderReuseUsers || [];
    const matches = (q ? users.filter(u => u.username.toLowerCase().includes(q) || String(u.email || '').toLowerCase().includes(q)) : users).slice(0, 30);
    if (!matches.length) {
      list.innerHTML = '<div style="padding: 8px 10px; color: var(--text-dim); font-size: .85rem;">Eşleşen kullanıcı yok.</div>';
    } else {
      list.innerHTML = matches.map(u => `
        <button type="button" class="btn btn-outline btn-sm" style="display: flex; width: 100%; justify-content: space-between; align-items: center; margin-bottom: 4px; text-align: left;"
                onclick="app.selectOrderReuseUser(${u.id})">
          <span><strong>${this.escapeHtml(u.username)}</strong>${u.banned ? ' <span class="badge badge-canceled">Banlı</span>' : ''}<small style="display:block;color:var(--text-dim);">${this.escapeHtml(u.email || '')}</small></span>
          <span style="color: var(--success); font-weight: 700; font-size: .8rem;">₺${Number(u.balance || 0).toFixed(2)}</span>
        </button>`).join('');
    }
    list.style.display = 'block';
  }

  selectOrderReuseUser(userId) {
    const user = (this.orderReuseUsers || []).find(u => u.id === userId);
    if (!user) return;
    this.orderReuseSelectedUser = user;
    document.getElementById('order-reuse-username').value = user.username;
    this.hideOrderReuseUserList();
  }

  hideOrderReuseUserList() {
    const list = document.getElementById('order-reuse-user-list');
    if (list) list.style.display = 'none';
  }

  async handleOrderReuseSubmit(e) {
    e.preventDefault();
    const ctx = this.serviceReuseContext;
    if (!ctx) return;
    const username = document.getElementById('order-reuse-username').value.trim();
    const link = document.getElementById('order-reuse-link').value.trim();
    const quantity = Number(document.getElementById('order-reuse-qty').value);
    const chargeUser = document.getElementById('order-reuse-charge').value === 'charge';
    if (!username || !link || !quantity) return;

    // Listeden secilmisse dogrudan kullanilir; elle yazilmissa birebir eslesme aranir.
    let target = this.orderReuseSelectedUser && this.orderReuseSelectedUser.username.toLowerCase() === username.toLowerCase()
      ? this.orderReuseSelectedUser : null;
    if (!target) {
      try {
        const res = await API.getAdminUsers(username);
        target = (res.users || []).find(u => u.username.toLowerCase() === username.toLowerCase());
      } catch (err) {
        return showToast(`Kullanıcı aranamadı: ${err.message}`, 'error');
      }
    }
    if (!target) return showToast(`"${username}" adında bir kullanıcı bulunamadı. Listeden seçmeyi dene.`, 'warning');
    if (target.banned) return showToast(`"${username}" banlı; banlı kullanıcıya sipariş oluşturulamaz.`, 'warning');

    const confirmed = await confirmDialog(
      `"${target.username}" kullanıcısına ${quantity} adet sipariş oluşturulacak ve sağlayıcıya iletilecek.\n\nServis: ${ctx.serviceName}\nÜcretlendirme: ${chargeUser ? 'kullanıcının bakiyesinden düşülecek' : 'HEDİYE (ücret alınmayacak)'}. Devam edilsin mi?`,
      { title: 'Servisi tekrar kullan', icon: 'fa-rotate-right', confirmText: 'Oluştur ve Gönder' }
    );
    if (!confirmed) return;

    try {
      const res = await API.assignUserOrder(target.id, { service_id: ctx.serviceId, link, quantity, charge_user: chargeUser });
      showToast(res.message, 'success');
      this.closeModal('modal-service-reuse');
      this.closeModal('modal-order-detail');
      this.loadAdminOrders();
    } catch (err) {
      showToast(`Sipariş oluşturulamadı: ${err.message}`, 'error');
    }
  }

  // --- TAMAMLANMA SÜRELERİ SEKMESİ ---
  async loadCompletionTimes() {
    const tbody = document.getElementById('completion-times-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center"><i class="fa-solid fa-spinner fa-spin"></i> Yükleniyor...</td></tr>';
    try {
      const res = await API.getAdminServices();
      this.adminUsdTryRate = Number(res.usd_try_rate) > 0 ? Number(res.usd_try_rate) : 35;
      this.completionTimesList = (res.services || []).filter(s => Number(s.completed_order_count) > 0);
      this.renderCompletionTimes();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color:var(--danger);">Liste yüklenemedi: ${this.escapeHtml(err.message)}</td></tr>`;
    }
  }

  renderCompletionTimes() {
    const tbody = document.getElementById('completion-times-tbody');
    if (!tbody) return;
    const q = (document.getElementById('completion-search')?.value || '').trim().toLowerCase();
    let list = this.completionTimesList || [];
    if (q) list = list.filter(s => `${s.name_tr || s.name} ${s.category_name || ''}`.toLowerCase().includes(q));
    // En hizli tamamlananlar ustte: hangi servislerin akici oldugu ilk bakista gorunur.
    list = [...list].sort((a, b) => (a.avg_completion_minutes || 0) - (b.avg_completion_minutes || 0));
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center">${q ? 'Aramanla eşleşen servis yok.' : 'Henüz tamamlanan sipariş verisi yok. Siparişler tamamlandıkça ortalama süreler burada birikecek.'}</td></tr>`;
      return;
    }
    tbody.innerHTML = list.map(s => `
      <tr>
        <td class="cell-nowrap"><span class="badge badge-processing">${this.escapeHtml(s.category_name || '—')}</span></td>
        <td class="cell-truncate" title="${this.escapeHtml(s.name_tr || s.name)}"><strong>${this.escapeHtml(s.name_tr || s.name)}</strong><small style="display:block;color:var(--text-dim);">${this.escapeHtml(s.provider_name || 'Manuel')} · Servis #${this.escapeHtml(String(s.provider_service_id || s.id))}</small></td>
        <td class="cell-nowrap">${this.formatAvgCompletion(s.avg_completion_minutes, s.completed_order_count)}</td>
        <td class="cell-nowrap"><strong>${s.completed_order_count}</strong></td>
        <td class="cell-nowrap"><span class="badge ${s.status ? 'badge-completed' : 'badge-canceled'}">${s.status ? 'Aktif' : 'Pasif'}</span></td>
        <td class="cell-nowrap">
          <button class="btn btn-primary btn-sm" onclick="app.openServiceReuse(${s.id})" ${s.status ? '' : 'disabled title="Pasif servise sipariş verilemez"'}>
            <i class="fa-solid fa-rotate-right"></i> Tekrar Kullan
          </button>
        </td>
      </tr>`).join('');
  }

  async sendOrderReviewMail(orderId, tekrar) {
    if (tekrar && !window.confirm('Bu siparişe daha önce yorum daveti gönderilmiş. Tekrar gönderilsin mi?')) return;
    try {
      const res = await API.sendOrderReviewMail(orderId);
      showToast(res.message, 'success');
      await this.loadAdminOrders();
    } catch (err) {
      showToast(err.message, 'error');
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

  // --- FİNANS: PARA YATIRMA (TÜM YÖNTEMLER) ---
  adminPaymentMethodInfo(group) {
    const map = {
      bank: { label: 'Havale/EFT', icon: 'fa-building-columns', badge: 'badge-processing' },
      shopier: { label: 'Shopier', icon: 'fa-credit-card', badge: 'badge-completed' },
      paytr: { label: 'PayTR', icon: 'fa-credit-card', badge: 'badge-completed' },
      crypto: { label: 'Kripto', icon: 'fa-coins', badge: 'badge-pending' },
      bonus: { label: 'Bonus/Kupon', icon: 'fa-gift', badge: 'badge-pending' },
      other: { label: 'Diğer', icon: 'fa-circle-question', badge: 'badge-pending' }
    };
    return map[group] || map.other;
  }

  async loadAdminPayments() {
    const tbody = document.getElementById('admin-payments-tbody');
    if (!tbody) return;
    const q = document.getElementById('admin-payments-search')?.value.trim() || '';
    const method = this.adminPaymentsFilter || '';
    try {
      const res = await API.getAdminPayments(q, method);

      // Ozet kartlari (gercek para: bonus/kupon haric)
      const tl = v => `₺${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      document.getElementById('pay-stat-today').textContent = tl(res.stats.today);
      document.getElementById('pay-stat-week').textContent = tl(res.stats.week);
      document.getElementById('pay-stat-month').textContent = tl(res.stats.month);
      document.getElementById('pay-stat-total').textContent = tl(res.stats.total);
      document.getElementById('pay-stat-count').textContent = `(${res.stats.count} işlem)`;

      // Yontem kirilimi kartlari
      const breakdown = document.getElementById('pay-method-breakdown');
      const order = ['bank', 'shopier', 'paytr', 'crypto', 'bonus', 'other'];
      const byMethod = new Map((res.by_method || []).map(row => [row.group, row]));
      breakdown.innerHTML = order
        .filter(g => byMethod.has(g))
        .map(g => {
          const row = byMethod.get(g);
          const info = this.adminPaymentMethodInfo(g);
          return `
            <div class="glass-card stat-card">
              <div class="stat-icon cyan"><i class="fa-solid ${info.icon}"></i></div>
              <div>
                <div class="stat-val" style="font-size: 1.05rem;">${tl(row.total)}</div>
                <div class="stat-lbl">${info.label} <small style="color: var(--text-dim);">(${row.count})</small></div>
              </div>
            </div>`;
        }).join('') || '<p class="admin-help">Henüz ödeme kaydı yok.</p>';

      // Yontem filtre dugmeleri
      const filtersEl = document.getElementById('admin-payments-filters');
      const filterDefs = [{ key: '', label: 'Tümü' }].concat(order.map(g => ({ key: g, label: this.adminPaymentMethodInfo(g).label })));
      filtersEl.innerHTML = filterDefs.map(f => `
        <button type="button" class="btn ${method === f.key ? 'btn-primary' : 'btn-outline'} btn-sm"
                onclick="app.setAdminPaymentsFilter('${f.key}')">${f.label}</button>`).join('');

      // Liste
      if (!(res.payments || []).length) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center">${q || method ? 'Filtrene uyan ödeme kaydı bulunamadı.' : 'Henüz para yatırma kaydı yok.'}</td></tr>`;
        return;
      }
      tbody.innerHTML = res.payments.map(p => {
        const info = this.adminPaymentMethodInfo(p.method_group);
        const tutar = Number.isFinite(Number(p.amount_kurus)) && p.amount_kurus > 0 ? p.amount_kurus / 100 : Number(p.amount || 0);
        return `
        <tr>
          <td>#${p.id}</td>
          <td><strong>${this.escapeHtml(p.username)}</strong><small style="display:block;color:var(--text-dim);">${this.escapeHtml(p.email || '')}</small></td>
          <td><span class="badge ${info.badge}"><i class="fa-solid ${info.icon}"></i> ${info.label}</span><small style="display:block;color:var(--text-dim);margin-top:2px;">${this.escapeHtml(p.method)}</small></td>
          <td class="cell-nowrap" style="color: var(--success); font-weight: 700;">${tl(tutar)}</td>
          <td style="font-size: 0.78rem; color: var(--text-dim); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${this.escapeHtml(p.transaction_id || '')}">${this.escapeHtml(p.transaction_id || '—')}</td>
          <td class="cell-nowrap" style="font-size: 0.85rem;">${p.created_at ? new Date(p.created_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
        </tr>`;
      }).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color:var(--danger);">Para yatırma kayıtları yüklenemedi: ${this.escapeHtml(err.message)}</td></tr>`;
    }
  }

  setAdminPaymentsFilter(method) {
    this.adminPaymentsFilter = method;
    this.loadAdminPayments();
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
          <td>
            <strong style="color: var(--accent-cyan); font-size: 1.1rem; letter-spacing: 1px;">${this.escapeHtml(c.code)}</strong>
            ${c.code_en ? `<small style="display:block; color: var(--text-dim);">🇬🇧 ${this.escapeHtml(c.code_en)}</small>` : ''}
          </td>
          <td style="color: var(--success); font-weight: 700;">₺${parseFloat(c.amount).toFixed(2)}</td>
          <td>${c.used_count} / ${c.max_uses} Kullanım</td>
          <td style="font-size: 0.85rem;">${new Date(c.created_at).toLocaleDateString('tr-TR')}</td>
          <td style="text-align: right; white-space: nowrap;">
            <button class="btn btn-outline btn-sm" onclick="app.showCouponUsages(${c.id})" title="Kimler kullandı?"><i class="fa-solid fa-users"></i> Kullananlar</button>
            <button class="btn btn-outline btn-sm" onclick="app.handleDeleteCoupon(${c.id})" style="color: var(--danger);"><i class="fa-solid fa-trash"></i> Sil</button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center">Kuponlar yüklenemedi.</td></tr>`;
    }
  }

  // Secilen kuponu kimlerin kullandigini tablo altindaki kartta listeler.
  async showCouponUsages(couponId) {
    const card = document.getElementById('coupon-usages-card');
    const body = document.getElementById('coupon-usages-body');
    if (!card || !body) return;
    card.style.display = 'block';
    body.innerHTML = '<p style="color: var(--text-dim);"><i class="fa-solid fa-spinner fa-spin"></i> Yükleniyor…</p>';
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    try {
      const res = await API.getCouponUsages(couponId);
      const title = `${res.coupon.code}${res.coupon.code_en ? ` / ${res.coupon.code_en}` : ''}`;
      if (!res.usages.length) {
        body.innerHTML = `<p style="margin:0;"><b>${this.escapeHtml(title)}</b> kuponunu henüz kimse kullanmamış.</p>`;
        return;
      }
      body.innerHTML = `
        <p style="margin: 0 0 12px;"><b>${this.escapeHtml(title)}</b> — toplam <b>${res.usages.length}</b> kullanım:</p>
        <div class="table-responsive" style="max-height: 320px;">
          <table class="custom-table">
            <thead><tr><th>Kullanıcı</th><th>E-Posta</th><th>Kullanım Tarihi</th></tr></thead>
            <tbody>
              ${res.usages.map(u => `
                <tr>
                  <td style="font-weight: 700;">${this.escapeHtml(u.username)}</td>
                  <td>${this.escapeHtml(u.email)}</td>
                  <td class="cell-nowrap">${new Date(u.used_at + 'Z').toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (err) {
      body.innerHTML = `<p style="color: var(--danger); margin:0;">Kullanım listesi alınamadı: ${this.escapeHtml(err.message)}</p>`;
    }
  }

  showAddCouponModal() {
    document.getElementById('modal-add-coupon').classList.add('active');
  }

  async handleSaveNewCoupon(e) {
    e.preventDefault();
    const code = document.getElementById('new-coupon-code').value;
    const code_en = document.getElementById('new-coupon-code-en').value.trim() || null;
    const amount = document.getElementById('new-coupon-amount').value;
    const max_uses = document.getElementById('new-coupon-max').value;

    try {
      const res = await API.addAdminCoupon(code, amount, max_uses, code_en);
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

  // === E-POSTA PAZARLAMA (ADMIN) ============================================

  async loadAdminEmailMarketing() {
    // Istatistikler + gonderim gecmisi
    try {
      const stats = await API.getEmailStats();
      const set = (id, value) => { const el = document.getElementById(id); if (el) el.innerText = value; };
      set('email-stat-sent', stats.totals.sent);
      set('email-stat-failed', stats.totals.failed);
      set('email-stat-audience', stats.audience);
      set('email-stat-optout', stats.opted_out);

      const batchesTbody = document.getElementById('email-batches-tbody');
      if (batchesTbody) {
        batchesTbody.innerHTML = stats.batches.length ? stats.batches.map(b => `
          <tr>
            <td class="cell-nowrap" style="font-size:.82rem;">${new Date(b.started_at + 'Z').toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</td>
            <td style="font-weight:700;">${this.escapeHtml(b.template_name || '—')}</td>
            <td>${b.total}</td>
            <td style="color: var(--success); font-weight:700;">${b.sent}</td>
            <td style="color: ${b.failed > 0 ? 'var(--danger)' : 'var(--text-dim)'}; font-weight:700;">${b.failed}</td>
            <td style="text-align:right;">${b.failed > 0 ? `<button class="btn btn-outline btn-sm" onclick="app.showEmailBatchFailures('${this.escapeHtml(b.batch_id)}')"><i class="fa-solid fa-magnifying-glass"></i> Hatalar</button>` : ''}</td>
          </tr>`).join('')
          : '<tr><td colspan="6" class="text-center">Henüz gönderim yapılmadı.</td></tr>';
      }
    } catch {}

    // Sablonlar
    try {
      const res = await API.getEmailTemplates();
      this.emailTemplates = res.templates || [];
      const select = document.getElementById('email-send-template');
      if (select) select.innerHTML = this.emailTemplates.map(t => `<option value="${t.id}">${this.escapeHtml(t.name)}</option>`).join('');
      const tbody = document.getElementById('email-templates-tbody');
      if (tbody) {
        tbody.innerHTML = this.emailTemplates.map(t => `
          <tr>
            <td>#${t.id}</td>
            <td style="font-weight:700;">${this.escapeHtml(t.name)}</td>
            <td style="font-size:.85rem;">${this.escapeHtml(String(t.subject).slice(0, 70))}</td>
            <td style="text-align:right; white-space:nowrap;">
              <button class="btn btn-outline btn-sm" onclick="app.previewEmailTemplate(${t.id})" title="Önizle"><i class="fa-solid fa-eye"></i></button>
              <button class="btn btn-outline btn-sm" onclick="app.editEmailTemplate(${t.id})" title="Düzenle"><i class="fa-solid fa-pen"></i></button>
              <button class="btn btn-outline btn-sm" onclick="app.testEmailTemplate(${t.id})" title="Kendime test gönder"><i class="fa-solid fa-paper-plane"></i></button>
              <button class="btn btn-outline btn-sm" style="color: var(--danger);" onclick="app.deleteEmailTemplateConfirm(${t.id}, '${this.escapeHtml(t.name)}')" title="Sil"><i class="fa-solid fa-trash"></i></button>
            </td>
          </tr>`).join('');
      }
    } catch {}

    // Secmeli gonderim icin alici havuzu
    try {
      const res = await API.getAdminUsers('');
      this.emailRecipients = (res.users || []).filter(u => u.role === 'client' && !u.banned);
      if (!this.emailSelectedIds) this.emailSelectedIds = new Set();
      this.renderEmailRecipients();
    } catch {}
  }

  renderEmailRecipients() {
    const list = document.getElementById('email-recipient-list');
    if (!list || !this.emailRecipients) return;
    const query = (document.getElementById('email-recipient-search')?.value || '').toLowerCase().trim();
    const visible = this.emailRecipients.filter(u =>
      !query || u.username.toLowerCase().includes(query) || String(u.email).toLowerCase().includes(query));
    this.emailVisibleIds = visible.map(u => u.id);
    if (!visible.length) {
      list.innerHTML = '<p style="margin:6px; color: var(--text-dim); font-size:.85rem;">Eşleşen kullanıcı yok.</p>';
      return;
    }
    list.innerHTML = visible.map(u => `
      <label style="display:flex; align-items:center; gap:10px; padding:6px 8px; cursor:pointer; font-size:.87rem;">
        <input type="checkbox" ${this.emailSelectedIds.has(u.id) ? 'checked' : ''} onchange="app.toggleEmailRecipient(${u.id}, this.checked)">
        <b>${this.escapeHtml(u.username)}</b>
        <span style="color: var(--text-dim); font-size:.8rem;">${this.escapeHtml(u.email)}</span>
      </label>`).join('');
  }

  toggleEmailRecipient(userId, checked) {
    if (checked) this.emailSelectedIds.add(userId);
    else this.emailSelectedIds.delete(userId);
  }

  filterEmailRecipients() { this.renderEmailRecipients(); }

  toggleAllEmailRecipients() {
    const checked = document.getElementById('email-recipient-selectall')?.checked;
    (this.emailVisibleIds || []).forEach(id => {
      if (checked) this.emailSelectedIds.add(id);
      else this.emailSelectedIds.delete(id);
    });
    this.renderEmailRecipients();
  }

  toggleEmailRecipientMode() {
    const mode = document.querySelector('input[name="email-recipient-mode"]:checked')?.value;
    const picker = document.getElementById('email-recipient-picker');
    if (picker) picker.style.display = mode === 'selected' ? 'block' : 'none';
  }

  // Sablon onizlemesi: yer tutucular ornek verilerle doldurulur.
  previewEmailTemplate(templateId) {
    const id = templateId ?? Number(document.getElementById('email-send-template')?.value);
    const template = (this.emailTemplates || []).find(t => t.id === Number(id));
    if (!template) { showToast('Önce bir şablon seç.', 'warning'); return; }
    const sample = text => String(text)
      .replaceAll('{kullanici_adi}', this.currentUser?.username || 'ornek_kullanici')
      .replaceAll('{site_adi}', this.siteName || 'SMMJET')
      .replaceAll('{site_link}', window.location.origin);
    document.getElementById('email-preview-subject').textContent = sample(template.subject);
    document.getElementById('email-preview-body').innerHTML = sample(template.body);
    const card = document.getElementById('email-preview-card');
    card.style.display = 'block';
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  newEmailTemplate() {
    document.getElementById('email-editor-id').value = '';
    document.getElementById('email-editor-name').value = '';
    document.getElementById('email-editor-subject').value = '';
    document.getElementById('email-editor-body').value = '';
    document.getElementById('email-editor-title').innerHTML = '<i class="fa-solid fa-pen"></i> Yeni Şablon';
    const card = document.getElementById('email-editor-card');
    card.style.display = 'block';
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  editEmailTemplate(id) {
    const template = (this.emailTemplates || []).find(t => t.id === id);
    if (!template) return;
    document.getElementById('email-editor-id').value = template.id;
    document.getElementById('email-editor-name').value = template.name;
    document.getElementById('email-editor-subject').value = template.subject;
    document.getElementById('email-editor-body').value = template.body;
    document.getElementById('email-editor-title').innerHTML = `<i class="fa-solid fa-pen"></i> Şablonu Düzenle: ${this.escapeHtml(template.name)}`;
    const card = document.getElementById('email-editor-card');
    card.style.display = 'block';
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async handleSaveEmailTemplate() {
    const id = document.getElementById('email-editor-id').value;
    const payload = {
      name: document.getElementById('email-editor-name').value,
      subject: document.getElementById('email-editor-subject').value,
      body: document.getElementById('email-editor-body').value
    };
    if (!payload.name.trim() || !payload.subject.trim() || payload.body.trim().length < 10) {
      showToast('Şablon adı, konu ve içerik zorunludur.', 'warning');
      return;
    }
    try {
      const res = id ? await API.updateEmailTemplate(id, payload) : await API.createEmailTemplate(payload);
      showToast(res.message, 'success');
      document.getElementById('email-editor-card').style.display = 'none';
      this.loadAdminEmailMarketing();
    } catch (err) {
      showToast(`Şablon kaydedilemedi: ${err.message}`, 'error');
    }
  }

  async deleteEmailTemplateConfirm(id, name) {
    if (!await confirmDialog(`"${name}" şablonu silinecek. Emin misin?`, { title: 'Şablonu sil', danger: true, confirmText: 'Sil' })) return;
    try {
      const res = await API.deleteEmailTemplate(id);
      showToast(res.message, 'success');
      this.loadAdminEmailMarketing();
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  }

  async testEmailTemplate(id) {
    try {
      const res = await API.testEmailTemplate(id);
      showToast(res.message, 'success');
    } catch (err) {
      showToast(`Test başarısız: ${err.message}`, 'error');
    }
  }

  async handleSendEmailBlast() {
    const templateId = Number(document.getElementById('email-send-template')?.value);
    if (!templateId) { showToast('Önce bir şablon seç.', 'warning'); return; }
    const mode = document.querySelector('input[name="email-recipient-mode"]:checked')?.value || 'all';
    const userIds = mode === 'selected' ? [...this.emailSelectedIds] : [];
    if (mode === 'selected' && !userIds.length) { showToast('En az bir alıcı seç.', 'warning'); return; }

    const template = (this.emailTemplates || []).find(t => t.id === templateId);
    const who = mode === 'all' ? 'TÜM uygun kullanıcılara' : `seçtiğin ${userIds.length} kullanıcıya`;
    if (!await confirmDialog(`"${template?.name}" şablonu ${who} gönderilecek. Bu işlem geri alınamaz. Başlatılsın mı?`,
      { title: 'Toplu e-posta gönder', icon: 'fa-paper-plane', confirmText: 'Gönder' })) return;

    try {
      const res = await API.sendEmailBlast({ template_id: templateId, mode, user_ids: userIds });
      showToast(res.message, 'success', 7000);
      // Gonderim arka planda surer; kisa bir gecikmeyle istatistikleri tazele.
      setTimeout(() => this.loadAdminEmailMarketing(), 4000);
    } catch (err) {
      showToast(`Gönderim başlatılamadı: ${err.message}`, 'error');
    }
  }

  async showEmailBatchFailures(batchId) {
    const box = document.getElementById('email-failures-box');
    if (!box) return;
    box.style.display = 'block';
    box.innerHTML = '<p style="color: var(--text-dim);"><i class="fa-solid fa-spinner fa-spin"></i> Yükleniyor…</p>';
    try {
      const res = await API.getEmailFailures(batchId);
      box.innerHTML = res.failures.length ? `
        <h4 style="margin-bottom: 10px; font-size: .95rem; color: var(--danger);">❌ Bu gönderimdeki hatalar (${res.failures.length})</h4>
        <div class="table-responsive" style="max-height: 240px;">
          <table class="custom-table">
            <thead><tr><th>E-Posta</th><th>Hata</th></tr></thead>
            <tbody>${res.failures.map(f => `<tr><td>${this.escapeHtml(f.email)}</td><td style="font-size:.8rem;">${this.escapeHtml(f.error || '—')}</td></tr>`).join('')}</tbody>
          </table>
        </div>` : '<p style="margin:0;">Bu gönderimde hata yok. 🎉</p>';
    } catch (err) {
      box.innerHTML = `<p style="color: var(--danger); margin:0;">Hata listesi alınamadı: ${this.escapeHtml(err.message)}</p>`;
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

  // --- TEHLİKE ALANI: ALT BÖLÜMLER & GÜVENLİK MERKEZİ ---
  showResetSection(section) {
    this.currentResetSection = section;
    document.querySelectorAll('#admin-tab-reset [data-reset-section]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.resetSection === section);
    });
    document.getElementById('reset-section-security').style.display = section === 'security' ? 'block' : 'none';
    document.getElementById('reset-section-cleanup').style.display = section === 'cleanup' ? 'block' : 'none';
    if (section === 'security') this.loadSecurityCenter();
  }

  async loadSecurityCenter() {
    const eventsTbody = document.getElementById('sec-events-tbody');
    if (!eventsTbody) return;
    const typeFilter = document.getElementById('sec-event-type-filter')?.value || '';
    try {
      const res = await API.getSecurityOverview(typeFilter);

      // Ozet kartlari (son 24 saat)
      document.getElementById('sec-stat-failed-login').textContent = (res.summary.failed_login || 0) + (res.summary.banned_login || 0);
      document.getElementById('sec-stat-rate-limit').textContent = res.summary.rate_limit || 0;
      document.getElementById('sec-stat-blocked-hit').textContent = res.summary.blocked_hit || 0;
      document.getElementById('sec-stat-blocked-count').textContent = res.blocked_count || 0;

      const typeLabel = t => ({
        failed_login: '<span class="badge badge-pending">Başarısız giriş</span>',
        banned_login: '<span class="badge badge-canceled">Banlı hesap denemesi</span>',
        rate_limit: '<span class="badge badge-canceled">Hız limiti ihlali</span>',
        blocked_hit: '<span class="badge badge-canceled">Engelli IP denemesi</span>'
      }[t] || `<span class="badge badge-pending">${this.escapeHtml(t)}</span>`);
      const tarih = v => v ? new Date(v).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

      // Supheli IP'ler
      const topIpsTbody = document.getElementById('sec-top-ips-tbody');
      topIpsTbody.innerHTML = (res.top_ips || []).length
        ? res.top_ips.map(row => `
          <tr>
            <td class="cell-nowrap"><code>${this.escapeHtml(row.ip)}</code></td>
            <td><strong>${row.n}</strong></td>
            <td style="font-size: 0.8rem;">${String(row.types || '').split(',').map(t => typeLabel(t)).join(' ')}</td>
            <td class="cell-nowrap" style="font-size: 0.85rem;">${tarih(row.last_at)}</td>
            <td class="cell-nowrap">${row.blocked
              ? '<span class="badge badge-canceled">Engelli</span>'
              : `<button class="btn btn-outline btn-sm" style="color:var(--danger);border-color:rgba(239,68,68,.4);" onclick="app.blockIpFromList('${this.escapeHtml(row.ip)}')"><i class="fa-solid fa-ban"></i> IP'yi Engelle</button>`}</td>
          </tr>`).join('')
        : '<tr><td colspan="5" class="text-center">Son 7 günde şüpheli hareket kaydedilmedi. 👍</td></tr>';

      // Hedef alinan kullanicilar
      const usersTbody = document.getElementById('sec-targeted-users-tbody');
      usersTbody.innerHTML = (res.targeted_users || []).length
        ? res.targeted_users.map(row => `
          <tr>
            <td><strong>${this.escapeHtml(row.username)}</strong>${row.user_id ? '' : ' <small style="color:var(--text-dim);">(kayıtlı değil)</small>'}</td>
            <td><strong>${row.n}</strong></td>
            <td class="cell-nowrap" style="font-size: 0.85rem;">${tarih(row.last_at)}</td>
            <td>${row.user_id ? (row.banned ? '<span class="badge badge-canceled">Banlı</span>' : '<span class="badge badge-completed">Aktif</span>') : '—'}</td>
            <td class="cell-nowrap">${row.user_id && !row.banned
              ? `<button class="btn btn-outline btn-sm" style="color:var(--danger);border-color:rgba(239,68,68,.4);" onclick="app.banUserFromSecurity(${row.user_id}, '${this.escapeHtml(row.username)}')"><i class="fa-solid fa-user-slash"></i> Hesabı Banla</button>`
              : '—'}</td>
          </tr>`).join('')
        : '<tr><td colspan="5" class="text-center">Son 7 günde hesaplara yönelik giriş denemesi yok. 👍</td></tr>';

      // Engelli IP listesi
      const blockedTbody = document.getElementById('sec-blocked-ips-tbody');
      blockedTbody.innerHTML = (res.blocked_ips || []).length
        ? res.blocked_ips.map(row => `
          <tr>
            <td class="cell-nowrap"><code>${this.escapeHtml(row.ip)}</code></td>
            <td style="font-size: 0.85rem;">${this.escapeHtml(row.reason || '—')}</td>
            <td class="cell-nowrap" style="font-size: 0.85rem;">${tarih(row.created_at)}</td>
            <td><button class="btn btn-outline btn-sm" onclick="app.unblockSecurityIp('${this.escapeHtml(row.ip)}')"><i class="fa-solid fa-unlock"></i> Engeli Kaldır</button></td>
          </tr>`).join('')
        : '<tr><td colspan="4" class="text-center">Engelli IP yok.</td></tr>';

      // Olay gunlugu
      eventsTbody.innerHTML = (res.events || []).length
        ? res.events.map(ev => `
          <tr>
            <td class="cell-nowrap" style="font-size: 0.85rem;">${tarih(ev.created_at)}</td>
            <td>${typeLabel(ev.type)}</td>
            <td class="cell-nowrap"><code>${this.escapeHtml(ev.ip || '—')}</code></td>
            <td style="font-size: 0.8rem; color: var(--text-dim);">${this.escapeHtml(ev.path || '—')}</td>
            <td>${this.escapeHtml(ev.username || '—')}</td>
            <td style="font-size: 0.85rem;">${this.escapeHtml(ev.detail || '—')}</td>
          </tr>`).join('')
        : `<tr><td colspan="6" class="text-center">${typeFilter ? 'Bu türde olay kaydı yok.' : 'Henüz güvenlik olayı kaydedilmedi. Sistem temiz. 👍'}</td></tr>`;
    } catch (err) {
      eventsTbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color:var(--danger);">Güvenlik verileri yüklenemedi: ${this.escapeHtml(err.message)}</td></tr>`;
    }
  }

  async handleBlockIpSubmit(e) {
    e.preventDefault();
    const ipInput = document.getElementById('sec-block-ip-input');
    const reasonInput = document.getElementById('sec-block-reason-input');
    const ip = ipInput.value.trim();
    if (!ip) return;
    try {
      const res = await API.blockSecurityIp(ip, reasonInput.value.trim());
      showToast(res.message, 'success');
      ipInput.value = '';
      reasonInput.value = '';
      this.loadSecurityCenter();
    } catch (err) {
      showToast(`IP engellenemedi: ${err.message}`, 'error');
    }
  }

  async blockIpFromList(ip) {
    const confirmed = await confirmDialog(
      `${ip} adresi engellenecek: bu IP'den gelen TÜM istekler (site dahil) reddedilecek. Devam edilsin mi?`,
      { title: "IP'yi engelle", icon: 'fa-ban', danger: true, confirmText: 'Engelle' }
    );
    if (!confirmed) return;
    try {
      const res = await API.blockSecurityIp(ip, 'Güvenlik Merkezi: şüpheli hareket listesinden engellendi');
      showToast(res.message, 'success');
      this.loadSecurityCenter();
    } catch (err) {
      showToast(`IP engellenemedi: ${err.message}`, 'error');
    }
  }

  async unblockSecurityIp(ip) {
    try {
      const res = await API.unblockSecurityIp(ip);
      showToast(res.message, 'success');
      this.loadSecurityCenter();
    } catch (err) {
      showToast(`Engel kaldırılamadı: ${err.message}`, 'error');
    }
  }

  // Guvenlik Merkezi'nden hizli ban: kullanicilar sekmesindeki onay akisinin aynisi.
  async banUserFromSecurity(userId, username) {
    const confirmed = await confirmDialog(
      `"${username}" kullanıcısı banlanacak: giriş yapamaz, açık oturumları anında kapanır. Devam edilsin mi?`,
      { title: 'Kullanıcıyı banla', icon: 'fa-ban', danger: true, confirmText: 'Banla' }
    );
    if (!confirmed) return;
    try {
      const res = await API.setUserBan(userId, true);
      showToast(res.message, 'success');
      this.loadSecurityCenter();
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
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
    if (!input) return;
    const code = this.referralData?.code || this.currentUser?.username || '';
    if (!code) return;
    input.value = `${window.location.origin}/register?ref=${encodeURIComponent(code)}`;
    input.select();
    navigator.clipboard.writeText(input.value);
    const rate = this.referralData?.commission_rate ?? 5;
    showToast(this.ui(
      `Davet linkiniz kopyalandı! Paylaştığınız kişilerin tamamlanan siparişlerinden %${rate} komisyon kazanırsınız.`,
      `Your invite link was copied! You earn ${rate}% commission on completed orders from people you invite.`
    ), 'success');
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
      if (refInput) refInput.value = `${window.location.origin}/register?ref=${encodeURIComponent(summary.referral_code)}`;
      const refBalance = document.getElementById('user-ref-balance');
      if (refBalance) refBalance.innerText = `₺${Number(summary.referral_balance).toFixed(2)}`;
    } catch (err) {
      console.error('Account summary could not be loaded:', err.message);
    }
    await this.loadReferralPanel();
  }

  // --- REFERANS PANELI (gercek veriler) --------------------------------------

  async loadReferralPanel() {
    if (!this.currentUser || !document.getElementById('ref-stat-invited')) return;
    try {
      const data = await API.getReferralOverview();
      this.referralData = data;
      this.referralPage = 1;
      this.renderReferralPanel();
    } catch (err) {
      console.error('Referral panel could not be loaded:', err.message);
    }
  }

  renderReferralPanel() {
    const data = this.referralData;
    if (!data) return;
    const money = value => `₺${Number(value || 0).toFixed(2)}`;
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.innerText = value; };

    setText('ref-intro-text', this.ui(
      `Özel davet linkinizle arkadaşlarınızı davet edin, tamamlanan her siparişlerinden %${data.commission_rate} nakit komisyon kazanın.`,
      `Invite friends with your personal link and earn ${data.commission_rate}% cash commission on each of their completed orders.`
    ));
    setText('ref-stat-invited-label', this.ui('Davet Edilen', 'Invited'));
    setText('ref-stat-active-label', this.ui('Sipariş Veren', 'Ordered'));
    setText('ref-stat-total-label', this.ui('Toplam Kazanç', 'Total Earned'));
    setText('ref-stat-invited', String(data.invited_count));
    setText('ref-stat-active', String(data.active_count));
    setText('ref-stat-total', money(data.total_earned));

    const balanceLabel = document.getElementById('ref-balance-label');
    if (balanceLabel) {
      balanceLabel.innerHTML = `${this.ui('Aktarılabilir Komisyon', 'Available Commission')}: <strong id="user-ref-balance" style="color: var(--success);">${money(data.available)}</strong>`;
    }

    setText('ref-invited-title', this.ui('Davet Ettikleriniz', 'People You Invited'));
    setText('ref-th-user', this.ui('Kullanıcı', 'User'));
    setText('ref-th-date', this.ui('Katılım', 'Joined'));
    setText('ref-th-orders', this.ui('Sipariş', 'Orders'));
    setText('ref-th-earned', this.ui('Kazandırdı', 'Earned'));

    const wrap = document.getElementById('ref-invited-wrap');
    const emptyNote = document.getElementById('ref-empty-note');
    const list = data.invited || [];
    if (!list.length) {
      if (wrap) wrap.style.display = 'none';
      if (emptyNote) {
        emptyNote.style.display = 'block';
        emptyNote.innerText = this.ui(
          'Henüz davet ettiğiniz kimse yok. Linkinizi paylaştığınızda katılanlar burada listelenir.',
          'You have not invited anyone yet. People who join through your link will be listed here.'
        );
      }
      const pager = document.getElementById('ref-invited-pagination');
      if (pager) pager.innerHTML = '';
      return;
    }
    if (emptyNote) emptyNote.style.display = 'none';
    if (wrap) wrap.style.display = 'block';

    const size = this.statPageSize;
    const pageCount = Math.max(1, Math.ceil(list.length / size));
    const page = Math.min(Math.max(1, this.referralPage || 1), pageCount);
    this.referralPage = page;
    const slice = list.slice((page - 1) * size, page * size);

    const tbody = document.getElementById('ref-invited-tbody');
    if (tbody) {
      tbody.innerHTML = slice.map(row => `
        <tr>
          <td style="font-weight: 600;">${this.escapeHtml(row.username)}</td>
          <td>${row.joined_at ? new Date(row.joined_at).toLocaleDateString(this.locale === 'en' ? 'en-GB' : 'tr-TR') : '-'}</td>
          <td>${row.order_count}</td>
          <td style="text-align: right; color: var(--success); font-weight: 600;">${money(row.earned)}</td>
        </tr>
      `).join('');
    }
    this.renderStatPagination('ref-invited-pagination', list.length, page, 'setReferralPage');
  }

  setReferralPage(page) {
    this.referralPage = page;
    this.renderReferralPanel();
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
      // Dogrulama sonrasi guncel email_verified degeri cekilmezse arayuzde
      // "E-postani dogrula" butonu takili kaliyordu.
      if (this.currentUser) {
        try {
          const res = await API.getMe();
          this.currentUser = res.user;
          this.updateUserHeader();
        } catch { /* oturum yoksa sorun degil */ }
      }
      this.navigate(this.currentUser ? 'profile' : 'landing');
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

  // --- PROFİL SAYFASI ---
  async loadProfileView() {
    if (!this.currentUser) return;
    document.getElementById('profile-username').textContent = this.currentUser.username;
    document.getElementById('profile-email').textContent = this.currentUser.email;
    document.getElementById('profile-balance').textContent = `₺${parseFloat(this.currentUser.balance).toFixed(2)}`;
    this.renderProfileSecurity();

    try {
      const summary = await API.getAccountSummary();
      document.getElementById('profile-total-spent').textContent = `₺${Number(summary.total_spent || 0).toFixed(2)}`;
      document.getElementById('profile-ref-balance').textContent = `₺${Number(summary.referral_balance || 0).toFixed(2)}`;
      const badge = document.getElementById('profile-vip-badge');
      const mainBadge = document.getElementById('user-vip-badge');
      this.updateUserVipRank(summary.total_spent || 0);
      if (badge && mainBadge) { badge.className = mainBadge.className; badge.textContent = mainBadge.textContent; }
    } catch { /* özet yüklenemezse kart varsayılan kalır */ }

    this.loadProfilePayments();
    this.loadProfileSpending();
  }

  renderProfileSecurity() {
    const emailArea = document.getElementById('profile-email-verify-area');
    const tfaArea = document.getElementById('profile-2fa-area');
    if (!emailArea || !tfaArea) return;

    if (this.currentUser.email_verified) {
      emailArea.innerHTML = `<div class="flex-between" style="gap:8px;">
        <span style="font-size:.88rem;color:var(--text-muted);"><i class="fa-solid fa-envelope-circle-check"></i> ${this.ui('E-posta Doğrulama', 'Email Verification')}</span>
        <span class="badge badge-completed"><i class="fa-solid fa-check"></i> ${this.ui('Doğrulandı', 'Verified')}</span>
      </div>`;
    } else {
      emailArea.innerHTML = `<button type="button" class="btn btn-outline btn-sm" onclick="app.requestEmailVerification()" style="width:100%;">
        <i class="fa-solid fa-envelope-circle-check"></i> ${this.ui('E-postamı Doğrula', 'Verify My Email')}
      </button>`;
    }

    if (this.currentUser.two_factor_enabled) {
      tfaArea.innerHTML = `<div class="flex-between" style="gap:8px;">
        <span style="font-size:.88rem;color:var(--text-muted);"><i class="fa-solid fa-shield-halved"></i> ${this.ui('İki Adımlı Doğrulama', 'Two-Factor Auth')}</span>
        <span class="badge badge-completed"><i class="fa-solid fa-check"></i> ${this.ui('Aktif', 'Enabled')}</span>
      </div>`;
    } else {
      tfaArea.innerHTML = `<button type="button" class="btn btn-outline btn-sm" onclick="app.enableTwoFactor()" style="width:100%;">
        <i class="fa-solid fa-shield-halved"></i> ${this.ui('2FA Güvenliğini Aç', 'Enable 2FA')}
      </button>`;
    }
  }

  showProfileTab(tab) {
    const tabs = ['payments', 'spending'];
    tabs.forEach(name => {
      const panel = document.getElementById(`profile-tab-${name}`);
      const btn = document.getElementById(`profile-tab-btn-${name}`);
      if (panel) panel.style.display = name === tab ? 'block' : 'none';
      if (btn) btn.className = name === tab ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm';
    });
  }

  profileDate(value) {
    // SQLite UTC verir; kullanicinin yerel saatine cevrilir.
    const date = new Date(String(value || '').replace(' ', 'T') + (String(value || '').includes('Z') ? '' : 'Z'));
    if (Number.isNaN(date.getTime())) return value || '-';
    return date.toLocaleString(this.locale === 'en' ? 'en-GB' : 'tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  async loadProfilePayments() {
    const tbody = document.getElementById('profile-payments-tbody');
    if (!tbody) return;
    try {
      const data = await API.getPaymentHistory();
      const rows = data.payments || [];
      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">${this.ui('Henüz bakiye yüklemesi yok.', 'No balance top-ups yet.')}</td></tr>`;
        return;
      }
      tbody.innerHTML = rows.map(p => {
        const badge = p.status === 'completed' ? 'badge-completed' : (p.status === 'pending' ? 'badge-pending' : 'badge-canceled');
        const statusText = p.status === 'completed' ? this.ui('Onaylandı', 'Completed') : (p.status === 'pending' ? this.ui('Bekliyor', 'Pending') : this.ui('Başarısız', 'Failed'));
        return `<tr>
          <td class="cell-nowrap">${this.profileDate(p.created_at)}</td>
          <td>${this.escapeHtml(p.method || '-')}</td>
          <td style="text-align:right;font-weight:700;color:var(--success);">₺${Number(p.amount).toFixed(2)}</td>
          <td><span class="badge ${badge}">${statusText}</span></td>
        </tr>`;
      }).join('');
    } catch {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--danger);">${this.ui('Geçmiş yüklenemedi.', 'Could not load history.')}</td></tr>`;
    }
  }

  async loadProfileSpending() {
    const tbody = document.getElementById('profile-spending-tbody');
    if (!tbody) return;
    try {
      const data = await API.request(`/orders?lang=${encodeURIComponent(this.locale)}&limit=100`);
      const rows = (data.orders || []).filter(o => o.status !== 'canceled');
      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">${this.ui('Henüz harcama yok.', 'No spending yet.')}</td></tr>`;
        return;
      }
      tbody.innerHTML = rows.slice(0, 100).map(o => {
        let badge = 'badge-pending', statusText = this.ui('Bekliyor', 'Pending');
        if (o.status === 'completed') { badge = 'badge-completed'; statusText = this.ui('Tamamlandı', 'Completed'); }
        else if (o.status === 'processing' || o.status === 'in_progress') { badge = 'badge-processing'; statusText = this.ui('İşleniyor', 'Processing'); }
        else if (o.status === 'partial') { badge = 'badge-processing'; statusText = this.ui('Kısmi', 'Partial'); }
        return `<tr>
          <td class="cell-nowrap">${this.profileDate(o.created_at)}</td>
          <td>${this.escapeHtml(o.service_name || `#${o.service_id}`)}</td>
          <td style="text-align:right;font-weight:700;">₺${Number(o.charge).toFixed(2)}</td>
          <td><span class="badge ${badge}">${statusText}</span></td>
        </tr>`;
      }).join('');
    } catch {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--danger);">${this.ui('Geçmiş yüklenemedi.', 'Could not load history.')}</td></tr>`;
    }
  }

  async handleProfilePasswordChange(e) {
    e.preventDefault();
    const current_password = document.getElementById('profile-current-password').value;
    const new_password = document.getElementById('profile-new-password').value;
    try {
      const result = await API.changePassword(current_password, new_password);
      showToast(result.message, 'success');
      // Sunucu tüm oturumları kapattı; kullanıcı yeniden giriş yapmalı.
      this.currentUser = null;
      this.updateUserHeader();
      this.showAuthPage('login');
    } catch (err) { showToast(err.message, 'error'); }
  }

  copyApiKey(inputId = 'user-api-key-input') {
    const input = document.getElementById(inputId);
    if (!input || !input.value) return;
    input.select();
    navigator.clipboard.writeText(input.value);
    showToast(this.ui('API anahtarınız panonuza kopyalandı!', 'Your API key was copied to the clipboard!'), 'success');
  }

  // --- META ACIKLAMA SAYACI --------------------------------------------------
  // Arama motoru 25-160 karakter bekler. Admin yazarken anlik geri bildirim
  // gorur; sunucu ayrica kesin siniri uygular (utils/metaDescription.js).

  initMetaCounters() {
    document.querySelectorAll('[data-meta-counter]').forEach(field => {
      if (field.dataset.counterBound) return;
      field.dataset.counterBound = '1';
      const guncelle = () => this.updateMetaCounter(field);
      field.addEventListener('input', guncelle);
      guncelle();
    });
  }

  updateMetaCounter(field) {
    const box = document.getElementById(field.dataset.metaCounter);
    if (!box) return;
    const uzunluk = field.value.trim().length;
    let durum = 'ok';
    let mesaj = `${uzunluk} / 160 karakter — arama sonucunda tam görünür.`;
    if (uzunluk === 0) {
      durum = 'warn';
      mesaj = 'Boş bırakılırsa kısa özet kullanılır. En iyisi 120-155 karakterlik bir açıklama yazmak.';
    } else if (uzunluk < 25) {
      durum = 'bad';
      mesaj = `${uzunluk} / 160 karakter — çok kısa. Arama motoru 25 karakterin altını yok sayar.`;
    } else if (uzunluk > 155) {
      durum = 'warn';
      mesaj = `${uzunluk} / 160 karakter — sınıra çok yakın, kesilebilir.`;
    }
    box.textContent = mesaj;
    box.className = `meta-counter meta-counter-${durum}`;
  }

  // --- API KULLANIM KILAVUZU -------------------------------------------------
  // Hic API kullanmamis birinin de takip edebilecegi sekilde yazildi:
  // once "bu nedir", sonra adim adim kurulum, sonra komut sozlugu ve
  // kopyala-yapistir kod ornekleri.

  showApiGuide() {
    const body = document.getElementById('api-guide-body');
    const title = document.getElementById('api-guide-title');
    if (!body) return;
    if (title) title.textContent = this.ui('API Nasıl Kullanılır?', 'How to Use the API');
    body.innerHTML = this.apiGuideHtml();
    document.getElementById('modal-api-guide')?.classList.add('active');
  }

  apiGuideHtml() {
    const base = `${window.location.origin}/api/v2`;
    const key = this.currentUser?.api_key || document.getElementById('user-api-key-input')?.value || 'API_ANAHTARINIZ';
    const en = this.locale === 'en';
    const kod = text => `<pre class="api-guide-code">${this.escapeHtml(text)}</pre>`;
    const adim = (n, baslik, icerik) =>
      `<div class="api-guide-step"><div class="api-guide-step-no">${n}</div><div><h4>${baslik}</h4>${icerik}</div></div>`;

    const komutlar = [
      {
        ad: 'services',
        tr: 'Satıştaki tüm servisleri listeler. Kendi sitenizde fiyat listesi göstermek için kullanılır.',
        en: 'Lists every service on sale. Use it to show a price list on your own site.',
        istek: `{\n  "key": "${key}",\n  "action": "services"\n}`,
        yanit: `[\n  {\n    "service": 101,\n    "name": "Instagram Takipçi",\n    "rate": "12.50",\n    "min": 100,\n    "max": 50000,\n    "category": 3,\n    "refill": true,\n    "description": "High quality followers.",\n    "start_time": "0-15 minutes",\n    "speed": "5,000 / day",\n    "features": ["Real-looking profiles", "No password required"]\n  }\n]`,
        notTr: '<b>rate</b> = 1000 adet için ücret (TL). 250 adet için ücret: rate ÷ 1000 × 250.',
        notEn: '<b>rate</b> = price per 1000 units (TRY). Price for 250 units: rate ÷ 1000 × 250.'
      },
      {
        ad: 'balance',
        tr: 'Panelimizdeki bakiyenizi gösterir. Sipariş göndermeden önce bakiye kontrolü için kullanın.',
        en: 'Shows your balance on our panel. Check it before sending orders.',
        istek: `{\n  "key": "${key}",\n  "action": "balance"\n}`,
        yanit: `{\n  "balance": "1250.00",\n  "currency": "TRY"\n}`
      },
      {
        ad: 'add',
        tr: 'Yeni sipariş oluşturur. Bakiyeniz anında düşer ve sipariş sağlayıcıya iletilir.',
        en: 'Creates a new order. Your balance is charged immediately and the order is sent to the provider.',
        istek: `{\n  "key": "${key}",\n  "action": "add",\n  "service": 101,\n  "link": "https://instagram.com/kullaniciadi",\n  "quantity": 1000\n}`,
        yanit: `{\n  "order": 1042\n}`,
        notTr: 'Dönen <b>order</b> numarasını kaydedin — durum sorgulaması bu numarayla yapılır. Sağlayıcı siparişi kabul etmezse tutar aynı anda bakiyenize iade edilir ve <code>error</code> döner.',
        notEn: 'Store the returned <b>order</b> number — status queries use it. If the provider rejects the order, the amount is refunded to your balance immediately and an <code>error</code> is returned.'
      },
      {
        ad: 'status',
        tr: 'Tek bir siparişin durumunu sorgular.',
        en: 'Queries the status of a single order.',
        istek: `{\n  "key": "${key}",\n  "action": "status",\n  "order": 1042\n}`,
        yanit: `{\n  "status": "Processing",\n  "start_count": 250,\n  "remains": 750,\n  "charge": "12.50",\n  "currency": "TRY"\n}`
      },
      {
        ad: 'status (toplu)',
        tr: 'Tek istekte en fazla 100 siparişin durumunu sorgular. Sunucunuzu yormamak için tercih edin.',
        en: 'Queries up to 100 orders in a single request. Prefer this to avoid hammering the API.',
        istek: `{\n  "key": "${key}",\n  "action": "status",\n  "orders": "1042,1043,1044"\n}`,
        yanit: `{\n  "1042": { "status": "Completed", "remains": 0, "charge": "12.50" },\n  "1043": { "status": "Processing", "remains": 500, "charge": "8.00" }\n}`
      }
    ];

    const komutKarti = c => `
      <div class="api-guide-cmd">
        <div class="api-guide-cmd-head"><code>${c.ad}</code><span>${en ? c.en : c.tr}</span></div>
        <div class="api-guide-cols">
          <div><div class="api-guide-label">${en ? 'Request' : 'Gönderilen'}</div>${kod(c.istek)}</div>
          <div><div class="api-guide-label">${en ? 'Response' : 'Gelen yanıt'}</div>${kod(c.yanit)}</div>
        </div>
        ${(en ? c.notEn : c.notTr) ? `<p class="api-guide-note">${en ? c.notEn : c.notTr}</p>` : ''}
      </div>`;

    const durumlar = [
      ['Pending', 'Sipariş alındı, sağlayıcı henüz başlatmadı.', 'Order received, the provider has not started yet.'],
      ['Processing', 'Teslimat sürüyor.', 'Delivery is in progress.'],
      ['Completed', 'Tamamlandı.', 'Completed.'],
      ['Partial', 'Kısmen teslim edildi; teslim edilmeyen kısmın ücreti iade edildi.', 'Partially delivered; the undelivered portion was refunded.'],
      ['Canceled', 'İptal edildi, ücret iade edildi.', 'Canceled and refunded.']
    ];

    const php = `<?php
$veri = [
  "key"      => "${key}",
  "action"   => "add",
  "service"  => 101,
  "link"     => "https://instagram.com/kullaniciadi",
  "quantity" => 1000
];

$ch = curl_init("${base}");
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Content-Type: application/json"]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($veri));
$yanit = json_decode(curl_exec($ch), true);
curl_close($ch);

if (isset($yanit["error"])) {
  echo "Hata: " . $yanit["error"];
} else {
  echo "Sipariş numarası: " . $yanit["order"];
}`;

    const js = `const yanit = await fetch("${base}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    key: "${key}",
    action: "add",
    service: 101,
    link: "https://instagram.com/kullaniciadi",
    quantity: 1000
  })
});
const sonuc = await yanit.json();
if (sonuc.error) console.error("Hata:", sonuc.error);
else console.log("Sipariş numarası:", sonuc.order);`;

    const python = `import requests

yanit = requests.post("${base}", json={
    "key": "${key}",
    "action": "add",
    "service": 101,
    "link": "https://instagram.com/kullaniciadi",
    "quantity": 1000
})
sonuc = yanit.json()
print(sonuc.get("error") or sonuc.get("order"))`;

    const hatalar = [
      ['Invalid API Key', 'Anahtar yanlış, boşluk içeriyor veya yenilendiği için eskisi geçersiz.', 'The key is wrong, contains spaces, or was replaced by a regenerated key.'],
      ['Invalid action', 'action alanı yazım hatalı. Geçerli değerler: services, balance, add, status.', 'The action field is misspelled. Valid values: services, balance, add, status.'],
      ['Invalid parameters', 'quantity sayı değil ya da link boş.', 'quantity is not a number, or link is empty.'],
      ['Not enough balance', 'Bakiyeniz yetersiz. Önce bakiye yükleyin.', 'Insufficient balance. Add funds first.'],
      ['Order not found', 'Sipariş numarası size ait değil veya hiç oluşmamış.', 'The order number does not belong to you or was never created.']
    ];

    return `
      <p class="api-guide-lead">${en
        ? 'This API lets you place orders on our panel automatically from your own website or panel — no manual entry. Everything below works with a single address and a single key.'
        : 'Bu API, kendi sitenizden veya panelinizden bizim panele otomatik sipariş göndermenizi sağlar; elle giriş yapmanıza gerek kalmaz. Aşağıdaki her şey tek bir adres ve tek bir anahtarla çalışır.'}</p>

      <div class="api-guide-box">
        <div class="api-guide-label">${en ? 'Your API address' : 'API adresiniz'}</div>
        <code class="api-guide-url">${this.escapeHtml(base)}</code>
        <p class="api-guide-note">${en
          ? 'Every command goes to this same address with the <b>POST</b> method and <code>Content-Type: application/json</code>. Only the <b>action</b> field changes.'
          : 'Bütün komutlar bu aynı adrese <b>POST</b> yöntemiyle ve <code>Content-Type: application/json</code> başlığıyla gider. Sadece <b>action</b> alanı değişir.'}</p>
      </div>

      <h3 class="api-guide-h">${en ? 'Getting started in 3 steps' : '3 adımda başlayın'}</h3>
      ${adim(1,
      en ? 'Get your API key' : 'API anahtarınızı alın',
      `<p>${en
        ? 'On this page, use the <b>Create API Key</b> button in the API key card. You can also see it under Profile. Treat it like a password — anyone holding it can spend your balance.'
        : 'Bu sayfadaki API anahtarı kartında <b>API Anahtarı Oluştur</b> düğmesini kullanın. Profilim sayfasından da görebilirsiniz. Bu anahtarı şifreniz gibi saklayın — eline geçen kişi bakiyenizi harcayabilir.'}</p>`)}
      ${adim(2,
      en ? 'Load funds' : 'Bakiye yükleyin',
      `<p>${en
        ? 'Orders are charged from your panel balance at the moment they are created. Without balance, the add command returns "Not enough balance".'
        : 'Siparişler oluşturulduğu anda panel bakiyenizden düşülür. Bakiye yoksa add komutu "Not enough balance" hatası verir.'}</p>`)}
      ${adim(3,
      en ? 'Fetch the service list and note the IDs' : 'Servis listesini çekin ve numaraları not edin',
      `<p>${en
        ? 'Run the <code>services</code> command once and store the <b>service</b> numbers. You need that number when placing an order. Service numbers can change over time, so refresh the list periodically.'
        : '<code>services</code> komutunu bir kez çalıştırıp <b>service</b> numaralarını kaydedin. Sipariş verirken bu numara gerekir. Servis numaraları zamanla değişebilir, listeyi ara ara yenileyin.'}</p>`)}

      <h3 class="api-guide-h">${en ? 'Command reference' : 'Komut sözlüğü'}</h3>
      ${komutlar.map(komutKarti).join('')}

      <h3 class="api-guide-h">${en ? 'What the statuses mean' : 'Durumlar ne anlama geliyor'}</h3>
      <table class="api-guide-table">
        <tbody>${durumlar.map(([d, tr, ing]) =>
      `<tr><td><code>${d}</code></td><td>${en ? ing : tr}</td></tr>`).join('')}</tbody>
      </table>

      <h3 class="api-guide-h">${en ? 'Ready-to-use code' : 'Hazır kod örnekleri'}</h3>
      <div class="api-guide-label">PHP (cURL)</div>${kod(php)}
      <div class="api-guide-label">JavaScript (fetch)</div>${kod(js)}
      <div class="api-guide-label">Python (requests)</div>${kod(python)}

      <h3 class="api-guide-h">${en ? 'Error messages' : 'Hata mesajları'}</h3>
      <table class="api-guide-table">
        <tbody>${hatalar.map(([e, tr, ing]) =>
      `<tr><td><code>${e}</code></td><td>${en ? ing : tr}</td></tr>`).join('')}</tbody>
      </table>
      <p class="api-guide-note">${en
        ? 'Note: errors are returned with HTTP status 200 and an <code>error</code> field in the body — this is the standard SMM API convention. Always check for <code>error</code> before reading <code>order</code>.'
        : 'Not: hatalar HTTP 200 durumuyla ve gövdede <code>error</code> alanıyla döner — bu, SMM API standardının gereğidir. <code>order</code> alanını okumadan önce mutlaka <code>error</code> var mı diye bakın.'}</p>

      <div class="api-guide-warn">
        <b>${en ? 'Security' : 'Güvenlik'}</b><br>
        ${en
        ? '• Never put the key in front-end JavaScript that visitors can view — call the API from your own server.<br>• If the key leaks, press <b>Regenerate</b> right away; the old key stops working instantly.<br>• Do not query <code>status</code> more often than once a minute; use the bulk form for many orders.'
        : '• Anahtarı ziyaretçilerin görebileceği tarayıcı tarafı koda koymayın — API çağrısını kendi sunucunuzdan yapın.<br>• Anahtar sızarsa hemen <b>Yenile</b> deyin; eski anahtar anında çalışmayı durdurur.<br>• <code>status</code> sorgusunu dakikada birden sık yapmayın; çok sipariş için toplu biçimi kullanın.'}
      </div>`;
  }

  // --- API ANAHTARI YONETIMI -------------------------------------------------

  async loadApiKey() {
    const goster = (id, show) => { const el = document.getElementById(id); if (el) el.style.display = show ? 'block' : 'none'; };
    if (!this.currentUser) {
      goster('api-key-guest', true);
      goster('api-key-empty', false);
      goster('api-key-ready', false);
      return;
    }
    goster('api-key-guest', false);
    try {
      const data = await API.getApiKey();
      this.applyApiKey(data.api_key, data.created_at);
    } catch (err) {
      console.error('API key could not be loaded:', err.message);
    }
  }

  applyApiKey(apiKey, createdAt) {
    const goster = (id, show) => { const el = document.getElementById(id); if (el) el.style.display = show ? 'block' : 'none'; };
    const varMi = Boolean(apiKey);
    goster('api-key-empty', !varMi);
    goster('api-key-ready', varMi);
    goster('profile-api-empty', !varMi);
    goster('profile-api-ready', varMi);
    if (!varMi) return;

    for (const id of ['user-api-key-input', 'profile-api-key-input']) {
      const input = document.getElementById(id);
      if (input) input.value = apiKey;
    }
    const not = createdAt
      ? this.ui(`Oluşturulma: ${new Date(createdAt).toLocaleString('tr-TR')}`,
        `Created: ${new Date(createdAt).toLocaleString('en-GB')}`)
      : '';
    for (const id of ['api-key-created-note', 'profile-api-created-note']) {
      const el = document.getElementById(id);
      if (el) el.textContent = not;
    }
  }

  async createApiKey(regenerate = false) {
    if (!this.currentUser) { this.showAuthModal('login'); return; }
    if (regenerate) {
      const onay = await confirmDialog(this.ui(
        'Yeni bir anahtar üretilecek ve ESKİ ANAHTAR ÇALIŞMAYI DURDURACAK. Sitenizde eski anahtarı kullanan entegrasyon varsa hemen güncellemeniz gerekir.',
        'A new key will be generated and THE OLD KEY WILL STOP WORKING. If your site uses the old key, you must update it immediately.'
      ), {
        title: this.ui('API anahtarını yenile', 'Regenerate API key'),
        danger: true,
        confirmText: this.ui('Yenile', 'Regenerate')
      });
      if (!onay) return;
    }
    try {
      const res = await API.createApiKey(regenerate);
      this.applyApiKey(res.api_key, new Date().toISOString());
      if (this.currentUser) this.currentUser.api_key = res.api_key;
      showToast(this.locale === 'en' ? res.message_en : res.message, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // === MÜŞTERİ YORUMLARI =====================================================
  // Onayli yorumlar /api/services yanitindan gelir (this.reviews). Ana sayfada
  // kayan serit, hizmetler sayfasinda kart dizilimi olarak gosterilir.

  reviewStars(rating) {
    const r = Math.max(1, Math.min(5, Number(rating) || 5));
    return '★'.repeat(r) + '☆'.repeat(5 - r);
  }

  reviewCardHtml(review) {
    // Gercek yorum paneli gorunumu: alinti isareti, yildiz rozeti, maskeli
    // ad + bas harfli avatar ve "dogrulanmis musteri" etiketi.
    const basHarf = String(review.name || 'M').slice(0, 2).toLocaleUpperCase('tr-TR');
    return `<div class="review-card">
      <div class="review-top"><span class="review-quote" aria-hidden="true">“</span><span class="review-stars" aria-label="${review.rating}/5 yıldız">${this.reviewStars(review.rating)}</span></div>
      <p>${this.escapeHtml(review.comment)}</p>
      <div class="review-who">
        <span class="review-avatar" aria-hidden="true">${this.escapeHtml(basHarf)}</span>
        <span class="review-id"><strong>${this.escapeHtml(review.name)}</strong><em><i class="fa-solid fa-circle-check" aria-hidden="true"></i> ${this.ui('Doğrulanmış müşteri', 'Verified customer')}</em></span>
      </div>
    </div>`;
  }

  renderReviewsTicker() {
    const kutu = document.getElementById('reviews-ticker');
    const serit = document.getElementById('reviews-ticker-track');
    if (!kutu || !serit) return;
    const yorumlar = this.reviews || [];
    if (!yorumlar.length) { kutu.style.display = 'none'; return; }
    // Kesintisiz dongu icin icerik iki kez basilir (CSS animasyonu %50 kaydirir).
    const kartlar = yorumlar.map(r => this.reviewCardHtml(r)).join('');
    serit.innerHTML = kartlar + kartlar;
    kutu.style.display = '';
  }

  renderServicesReviews() {
    const kutu = document.getElementById('services-reviews');
    const serit = document.getElementById('services-reviews-grid');
    if (!kutu || !serit) return;
    // Karusel oldugu icin ust sinir genis: yorum artsa da sayfa dikeyde uzamaz.
    const yorumlar = (this.reviews || []).slice(0, 24);
    if (!yorumlar.length) { kutu.style.display = 'none'; return; }
    serit.innerHTML = yorumlar.map(r => this.reviewCardHtml(r)).join('');
    kutu.style.display = '';
    this.initServicesReviewsCarousel();
  }

  // Karusel: 4,5 sn'de bir sonraki karta akar; uzerine gelinince/dokununca
  // durur, sona gelince basa sarar. Mobilde parmakla kaydirma dogal calisir.
  initServicesReviewsCarousel() {
    const serit = document.getElementById('services-reviews-grid');
    if (!serit) return;
    if (!serit.dataset.carousel) {
      serit.dataset.carousel = '1';
      const dur = () => { this.srPaused = true; };
      const devam = () => { this.srPaused = false; };
      serit.addEventListener('pointerenter', dur);
      serit.addEventListener('pointerleave', devam);
      serit.addEventListener('touchstart', dur, { passive: true });
      serit.addEventListener('touchend', () => setTimeout(devam, 3000), { passive: true });
      serit.addEventListener('focusin', dur);
      serit.addEventListener('focusout', devam);
    }
    if (this.srInterval) clearInterval(this.srInterval);
    this.srInterval = setInterval(() => {
      // Gorunum kapali ya da kullanici etkilesimdeyken akmaz.
      if (this.srPaused || !serit.offsetParent) return;
      const kart = serit.querySelector('.review-card');
      if (!kart) return;
      const adim = kart.offsetWidth + 20;
      const sondaMi = serit.scrollLeft + serit.clientWidth >= serit.scrollWidth - 10;
      serit.scrollTo({ left: sondaMi ? 0 : serit.scrollLeft + adim, behavior: 'smooth' });
    }, 4500);
  }

  scrollServicesReviews(yon) {
    const serit = document.getElementById('services-reviews-grid');
    if (!serit) return;
    const kart = serit.querySelector('.review-card');
    serit.scrollBy({ left: yon * ((kart?.offsetWidth || 320) + 20), behavior: 'smooth' });
  }

  async submitReview() {
    const puan = document.getElementById('review-rating')?.value;
    const yorum = document.getElementById('review-comment')?.value?.trim();
    const buton = document.getElementById('review-submit-btn');
    if (!yorum || yorum.length < 10) {
      showToast(this.ui('Yorum en az 10 karakter olmalı.', 'Review must be at least 10 characters.'), 'warning');
      return;
    }
    if (buton) buton.disabled = true;
    try {
      const res = await API.submitReview(Number(puan), yorum);
      showToast(res.message, 'success');
      const kart = document.getElementById('review-invite-card');
      if (kart) kart.style.display = 'none';
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      if (buton) buton.disabled = false;
    }
  }

  // --- Admin yorum denetimi ---
  async loadAdminReviews() {
    const tbody = document.getElementById('admin-reviews-tbody');
    if (!tbody) return;
    try {
      const res = await API.getAdminReviews();
      const yorumlar = res.reviews || [];
      const bekleyen = yorumlar.filter(r => r.status === 'pending').length;
      const sayac = document.getElementById('admin-nav-reviews-count');
      if (sayac) sayac.textContent = bekleyen ? String(bekleyen) : '';
      if (!yorumlar.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Henüz yorum yok. Üstteki formdan elle ekleyebilirsin.</td></tr>';
        return;
      }
      tbody.innerHTML = yorumlar.map(r => {
        const ad = r.display_name || r.username || '-';
        const durum = r.status === 'approved'
          ? '<span class="badge badge-completed">Yayında</span>'
          : '<span class="badge badge-pending">Bekliyor</span>';
        const islem = r.status === 'approved'
          ? `<button class="btn btn-outline btn-sm" onclick="app.setReviewStatus(${r.id}, 'pending')">Yayından Al</button>`
          : `<button class="btn btn-primary btn-sm" onclick="app.setReviewStatus(${r.id}, 'approved')">Onayla</button>`;
        return `<tr>
          <td>#${r.id}</td>
          <td>${this.escapeHtml(ad)}</td>
          <td title="${r.rating}/5">${this.reviewStars(r.rating)}</td>
          <td style="max-width: 380px; white-space: normal;">${this.escapeHtml(r.comment)}</td>
          <td>${durum}</td>
          <td>${new Date(r.created_at).toLocaleDateString('tr-TR')}</td>
          <td style="text-align: right; white-space: nowrap;">${islem}
            <button class="btn btn-outline btn-sm" title="Sil" onclick="app.deleteReview(${r.id})"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>`;
      }).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center">${this.escapeHtml(err.message)}</td></tr>`;
    }
  }

  async addAdminReview() {
    const ad = document.getElementById('admin-review-name')?.value?.trim();
    const puan = document.getElementById('admin-review-rating')?.value;
    const yorum = document.getElementById('admin-review-comment')?.value?.trim();
    try {
      const res = await API.addAdminReview(ad, Number(puan), yorum);
      showToast(res.message, 'success');
      document.getElementById('admin-review-name').value = '';
      document.getElementById('admin-review-comment').value = '';
      await this.loadAdminReviews();
      await this.loadServicesData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async setReviewStatus(id, status) {
    try {
      const res = await API.setAdminReviewStatus(id, status);
      showToast(res.message, 'success');
      await this.loadAdminReviews();
      await this.loadServicesData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async deleteReview(id) {
    if (!window.confirm('Bu yorum kalıcı olarak silinsin mi?')) return;
    try {
      const res = await API.deleteAdminReview(id);
      showToast(res.message, 'success');
      await this.loadAdminReviews();
      await this.loadServicesData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  updateTelegramLinks(link) {
    if (!link) return;
    const cleanLink = link.startsWith('http') ? link : `https://t.me/${link.replace('@', '')}`;
    const floatBtn = document.getElementById('floating-telegram-btn');
    const ticketLink = document.getElementById('tickets-telegram-link');
    if (floatBtn) floatBtn.href = cleanLink;
    if (ticketLink) ticketLink.href = cleanLink;
    const social = document.querySelector('#footer-social-links a[rel~="me"]');
    if (social) social.href = cleanLink;
  }

  /**
   * Hakkimizda sayfasindaki fiziksel adres satiri. Admin panelde adres
   * girilmediyse satir hic basilmaz — uydurma adres guven sinyali degil,
   * yanlis bilgidir.
   */
  renderBusinessAddress(settings = {}) {
    const alan = document.getElementById('about-business-address');
    if (!alan) return;
    const adres = String(settings.business_address || '').trim();
    alan.textContent = adres ? `Adres: ${adres}` : '';
    alan.style.display = adres ? '' : 'none';
  }

  /**
   * Alt bilgideki sosyal profil baglantilari. Admin panelde adres girilen
   * kanallar eklenir; Telegram HTML'de hazir durdugu icin burada yinelenmez.
   */
  renderSocialLinks(settings = {}) {
    const liste = document.getElementById('footer-social-links');
    if (!liste) return;
    const kanallar = [
      { key: 'social_instagram', icon: 'fa-instagram', ad: 'Instagram' },
      { key: 'social_x', icon: 'fa-x-twitter', ad: 'X' },
      { key: 'social_youtube', icon: 'fa-youtube', ad: 'YouTube' },
      { key: 'social_tiktok', icon: 'fa-tiktok', ad: 'TikTok' }
    ];
    for (const kanal of kanallar) {
      let adres = String(settings[kanal.key] || '').trim();
      // "instagram.com/x" gibi http'siz girilen adresler de kabul edilir.
      if (adres && !adres.startsWith('http') && adres.includes('.')) adres = `https://${adres}`;
      if (!adres || !adres.startsWith('http')) continue;
      if (liste.querySelector(`[data-social="${kanal.key}"]`)) continue;
      const li = document.createElement('li');
      li.innerHTML = `<a data-social="${kanal.key}" href="${this.escapeHtml(adres)}" target="_blank" rel="me noopener noreferrer" aria-label="${kanal.ad} profilimiz"><i class="fa-brands ${kanal.icon}" aria-hidden="true"></i><span class="sr-only">${kanal.ad}</span></a>`;
      liste.appendChild(li);
    }
  }

  async loadAdminSettings() {
    try {
      const res = await API.getSettings();
      const s = res.settings || {};
      if (document.getElementById('setting-site-name')) document.getElementById('setting-site-name').value = s.site_name || 'SMM Panel';
      if (document.getElementById('setting-currency')) document.getElementById('setting-currency').value = s.currency || '₺';
      if (document.getElementById('setting-announcement-tr')) document.getElementById('setting-announcement-tr').value = s.announcement_tr || s.announcement || '';
      if (document.getElementById('setting-announcement-en')) document.getElementById('setting-announcement-en').value = s.announcement_en || '';
      if (document.getElementById('setting-announcement-special')) document.getElementById('setting-announcement-special').checked = s.announcement_special === '1';
      if (document.getElementById('setting-hero-title-tr')) document.getElementById('setting-hero-title-tr').value = s.hero_title_tr || s.hero_title || '';
      if (document.getElementById('setting-hero-title-en')) document.getElementById('setting-hero-title-en').value = s.hero_title_en || '';
      if (document.getElementById('setting-hero-subtitle-tr')) document.getElementById('setting-hero-subtitle-tr').value = s.hero_subtitle_tr || s.hero_subtitle || '';
      if (document.getElementById('setting-hero-subtitle-en')) document.getElementById('setting-hero-subtitle-en').value = s.hero_subtitle_en || '';
      if (document.getElementById('setting-usd-try-rate')) document.getElementById('setting-usd-try-rate').value = s.usd_try_rate || '';
      if (document.getElementById('setting-telegram')) document.getElementById('setting-telegram').value = s.telegram_link || 'https://t.me/SmmPanelDestek';
      if (document.getElementById('setting-blog-author-name')) document.getElementById('setting-blog-author-name').value = s.blog_author_name || '';
      if (document.getElementById('setting-blog-author-title')) document.getElementById('setting-blog-author-title').value = s.blog_author_title || '';
      if (document.getElementById('setting-blog-author-url')) document.getElementById('setting-blog-author-url').value = s.blog_author_url || '';
      if (document.getElementById('setting-telegram-bot-token')) document.getElementById('setting-telegram-bot-token').value = s.telegram_bot_token || '';
      if (document.getElementById('setting-telegram-chat-id')) document.getElementById('setting-telegram-chat-id').value = s.telegram_chat_id || '';
      // Ayar hic kaydedilmemisse bildirimler acik kabul edilir (sunucuyla ayni varsayilan).
      if (document.getElementById('setting-telegram-notify-register')) document.getElementById('setting-telegram-notify-register').checked = s.telegram_notify_register !== '0';
      if (document.getElementById('setting-telegram-notify-order')) document.getElementById('setting-telegram-notify-order').checked = s.telegram_notify_order !== '0';
      if (document.getElementById('setting-telegram-notify-payment')) document.getElementById('setting-telegram-notify-payment').checked = s.telegram_notify_payment !== '0';
      if (document.getElementById('setting-paytr-id')) document.getElementById('setting-paytr-id').value = s.paytr_merchant_id || '';
      if (document.getElementById('setting-paytr-key')) document.getElementById('setting-paytr-key').value = s.paytr_merchant_key || '';
      if (document.getElementById('setting-paytr-salt')) document.getElementById('setting-paytr-salt').value = s.paytr_merchant_salt || '';
      if (document.getElementById('setting-bank-accounts')) document.getElementById('setting-bank-accounts').value = s.bank_accounts || '';
      if (document.getElementById('setting-provider-threshold')) document.getElementById('setting-provider-threshold').value = s.provider_balance_threshold || '';
      // Shopier anahtari sifreli saklanir ve geri okunmaz; yalnizca durumu gosterilir.
      this.loadShopierStatus();
      if (document.getElementById('setting-nowpayments-key')) document.getElementById('setting-nowpayments-key').value = s.nowpayments_api_key || '';
      if (document.getElementById('setting-nowpayments-ipn')) document.getElementById('setting-nowpayments-ipn').value = s.nowpayments_ipn_secret || '';
      if (document.getElementById('setting-telegram-notify-ticket')) document.getElementById('setting-telegram-notify-ticket').checked = s.telegram_notify_ticket !== '0';
      // SEO & analitik
      if (document.getElementById('setting-ga-id')) document.getElementById('setting-ga-id').value = s.google_analytics_id || '';
      if (document.getElementById('setting-gsc-verification')) document.getElementById('setting-gsc-verification').value = s.google_site_verification || '';
      if (document.getElementById('setting-bing-verification')) document.getElementById('setting-bing-verification').value = s.bing_site_verification || '';
      // Adresler tam haliyle gosterilir; admin kopyalayip arama motoruna yapistirir.
      const sitemapEl = document.getElementById('seo-sitemap-url');
      if (sitemapEl) sitemapEl.textContent = `${window.location.origin}/sitemap.xml`;
      const bingSitemapEl = document.getElementById('bing-sitemap-url');
      if (bingSitemapEl) bingSitemapEl.textContent = `${window.location.origin}/sitemap.xml`;
      const bingAuthEl = document.getElementById('bing-auth-url');
      if (bingAuthEl) bingAuthEl.textContent = `${window.location.origin}/BingSiteAuth.xml`;
      // SMTP
      if (document.getElementById('setting-smtp-host')) document.getElementById('setting-smtp-host').value = s.smtp_host || '';
      if (document.getElementById('setting-smtp-port')) document.getElementById('setting-smtp-port').value = s.smtp_port || '';
      if (document.getElementById('setting-smtp-secure')) document.getElementById('setting-smtp-secure').checked = s.smtp_secure === '1';
      if (document.getElementById('setting-smtp-user')) document.getElementById('setting-smtp-user').value = s.smtp_user || '';
      if (document.getElementById('setting-smtp-pass')) document.getElementById('setting-smtp-pass').value = s.smtp_pass || '';
      if (document.getElementById('setting-mail-from')) document.getElementById('setting-mail-from').value = s.mail_from || '';

      // Sosyal profiller ve isletme bilgisi
      if (document.getElementById('setting-social-instagram')) document.getElementById('setting-social-instagram').value = s.social_instagram || '';
      if (document.getElementById('setting-social-x')) document.getElementById('setting-social-x').value = s.social_x || '';
      if (document.getElementById('setting-social-youtube')) document.getElementById('setting-social-youtube').value = s.social_youtube || '';
      if (document.getElementById('setting-social-tiktok')) document.getElementById('setting-social-tiktok').value = s.social_tiktok || '';
      if (document.getElementById('setting-support-email')) document.getElementById('setting-support-email').value = s.support_email || '';
      if (document.getElementById('setting-business-address')) document.getElementById('setting-business-address').value = s.business_address || '';

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
      announcement_special: document.getElementById('setting-announcement-special').checked ? '1' : '0',
      hero_title_tr: document.getElementById('setting-hero-title-tr').value,
      hero_title_en: document.getElementById('setting-hero-title-en').value,
      hero_subtitle_tr: document.getElementById('setting-hero-subtitle-tr').value,
      hero_subtitle_en: document.getElementById('setting-hero-subtitle-en').value,
      usd_try_rate: document.getElementById('setting-usd-try-rate').value,
      telegram_link: document.getElementById('setting-telegram').value,
      telegram_bot_token: document.getElementById('setting-telegram-bot-token').value.trim(),
      telegram_chat_id: document.getElementById('setting-telegram-chat-id').value.trim(),
      // Sunucu ayar degerlerini metne cevirdigi icin boolean yerine '1'/'0' gonderilir.
      telegram_notify_register: document.getElementById('setting-telegram-notify-register').checked ? '1' : '0',
      telegram_notify_order: document.getElementById('setting-telegram-notify-order').checked ? '1' : '0',
      telegram_notify_payment: document.getElementById('setting-telegram-notify-payment').checked ? '1' : '0',
      paytr_merchant_id: document.getElementById('setting-paytr-id').value,
      paytr_merchant_key: document.getElementById('setting-paytr-key').value,
      paytr_merchant_salt: document.getElementById('setting-paytr-salt').value,
      bank_accounts: document.getElementById('setting-bank-accounts').value,
      provider_balance_threshold: document.getElementById('setting-provider-threshold').value.trim(),
      nowpayments_api_key: document.getElementById('setting-nowpayments-key').value.trim(),
      nowpayments_ipn_secret: document.getElementById('setting-nowpayments-ipn').value.trim(),
      telegram_notify_ticket: document.getElementById('setting-telegram-notify-ticket').checked ? '1' : '0',
      google_analytics_id: document.getElementById('setting-ga-id').value.trim(),
      google_site_verification: document.getElementById('setting-gsc-verification').value.trim(),
      bing_site_verification: document.getElementById('setting-bing-verification').value.trim(),
      smtp_host: document.getElementById('setting-smtp-host').value.trim(),
      smtp_port: document.getElementById('setting-smtp-port').value.trim(),
      smtp_secure: document.getElementById('setting-smtp-secure').checked ? '1' : '0',
      smtp_user: document.getElementById('setting-smtp-user').value.trim(),
      smtp_pass: document.getElementById('setting-smtp-pass').value,
      mail_from: document.getElementById('setting-mail-from').value.trim(),
      // Guven sinyalleri: sosyal profiller + fiziksel adres (alt bilgi ve
      // Organization yapisal verisi bunlardan beslenir).
      social_instagram: document.getElementById('setting-social-instagram')?.value.trim() || '',
      social_x: document.getElementById('setting-social-x')?.value.trim() || '',
      social_youtube: document.getElementById('setting-social-youtube')?.value.trim() || '',
      social_tiktok: document.getElementById('setting-social-tiktok')?.value.trim() || '',
      support_email: document.getElementById('setting-support-email')?.value.trim() || '',
      business_address: document.getElementById('setting-business-address')?.value.trim() || '',
      // Blog yazari: gorunur imza + Person yapisal verisi (E-E-A-T).
      blog_author_name: document.getElementById('setting-blog-author-name')?.value.trim() || '',
      blog_author_title: document.getElementById('setting-blog-author-title')?.value.trim() || '',
      blog_author_url: document.getElementById('setting-blog-author-url')?.value.trim() || ''
    };

    try {
      const res = await API.saveSettings(settingsObj);
      if (settingsObj.announcement_tr || settingsObj.announcement_en) {
        const textEl = document.getElementById('announcement-text');
        if (textEl) textEl.innerText = this.locale === 'en' ? settingsObj.announcement_en : settingsObj.announcement_tr;
      }
      // Acilis modu degisikligi kaydeder kaydetmez bantta gorunur.
      document.getElementById('announcement-bar')?.classList.toggle('announcement-launch', settingsObj.announcement_special === '1');
      if (settingsObj.telegram_link) {
        this.updateTelegramLinks(settingsObj.telegram_link);
      }
      showToast(res.message, 'success');
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  }

  // --- SHOPIER YAPILANDIRMASI (ADMIN) ---
  // Anahtar sunucuda sifreli durur ve hicbir uctan geri okunmaz; burada
  // yalnizca "kurulu mu, bildirim calisiyor mu" durumu gosterilir.
  async loadShopierStatus() {
    const box = document.getElementById('shopier-status-box');
    if (!box) return;
    try {
      this.renderShopierStatus(await API.getShopierStatus());
    } catch (err) {
      box.innerHTML = `<div class="badge badge-canceled">Durum alınamadı: ${this.escapeHtml(err.message)}</div>`;
    }
  }

  renderShopierStatus(status) {
    const box = document.getElementById('shopier-status-box');
    if (!box) return;
    const satir = (tamam, metin) => `
      <div style="display: flex; align-items: center; gap: 8px; font-size: .88rem; margin-bottom: 6px;">
        <i class="fa-solid ${tamam ? 'fa-circle-check' : 'fa-circle-xmark'}" style="color: ${tamam ? 'var(--success)' : 'var(--danger)'};"></i>
        <span>${metin}</span>
      </div>`;
    box.innerHTML = `
      ${satir(status.pat_saved, status.pat_saved ? 'Kişisel erişim anahtarı kayıtlı' : 'Kişisel erişim anahtarı girilmedi')}
      ${satir(status.webhook_registered, status.webhook_registered ? `Ödeme bildirimi kurulu (abonelik #${this.escapeHtml(String(status.webhook_id || '-'))})` : 'Ödeme bildirimi kurulu değil — bakiye otomatik yüklenmez')}
      ${satir(status.base_url_set, status.base_url_set ? 'Site adresi (PUBLIC_BASE_URL) tanımlı' : 'PUBLIC_BASE_URL tanımsız — bildirim adresi üretilemez')}
      ${satir(Boolean(status.product_image_url), status.product_image_url ? 'Ürün görseli adresi tanımlı' : 'Ürün görseli adresi yok — site logosu (Shopier kırık gösterebilir)')}
      <div class="badge ${status.ready ? 'badge-completed' : 'badge-pending'}" style="margin-top: 8px;">
        ${status.ready ? 'Shopier ödeme yöntemi AÇIK' : 'Shopier ödeme yöntemi kapalı'}
      </div>`;
    // Kayitli gorsel adresi input alanina yansitilir (yazarken uzerine yazma).
    const imgField = document.getElementById('setting-shopier-image');
    if (imgField && document.activeElement !== imgField) imgField.value = status.product_image_url || '';
  }

  async saveShopierImage() {
    const field = document.getElementById('setting-shopier-image');
    const url = (field ? field.value : '').trim();
    try {
      const res = await API.saveShopierImage(url);
      this.renderShopierStatus(res.status);
      showToast(res.message, 'success');
    } catch (err) {
      showToast(`Görsel kaydedilemedi: ${err.message}`, 'error');
    }
  }

  async saveShopierPat() {
    const field = document.getElementById('setting-shopier-pat');
    const pat = (field?.value || '').trim();
    if (pat.length < 10) {
      showToast('Geçerli bir Kişisel Erişim Anahtarı yapıştır.', 'warning');
      return;
    }
    try {
      const res = await API.saveShopierPat(pat);
      // Anahtar ekranda kalmasin.
      if (field) field.value = '';
      this.renderShopierStatus(res.status);
      showToast(res.message, 'success');
    } catch (err) {
      showToast(`Shopier kurulamadı: ${err.message}`, 'error');
      this.loadShopierStatus();
    }
  }

  async registerShopierWebhook() {
    try {
      const res = await API.registerShopierWebhook();
      this.renderShopierStatus(res.status);
      showToast(res.message, 'success');
    } catch (err) {
      showToast(`Bildirim kurulamadı: ${err.message}`, 'error');
    }
  }

  async removeShopierConfig() {
    if (!await confirmDialog('Shopier anahtarı ve ödeme bildirimi silinecek. Kart ödemesi kapanır.', {
      title: 'Shopier yapılandırmasını kaldır', icon: 'fa-trash', confirmText: 'Kaldır'
    })) return;
    try {
      const res = await API.removeShopierConfig();
      this.renderShopierStatus(res.status);
      showToast(res.message, 'success');
    } catch (err) {
      showToast(`Kaldırılamadı: ${err.message}`, 'error');
    }
  }

  toggleSecretField(fieldId, button) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    const revealed = field.type === 'text';
    field.type = revealed ? 'password' : 'text';
    button?.querySelector('i')?.classList.replace(
      revealed ? 'fa-eye-slash' : 'fa-eye',
      revealed ? 'fa-eye' : 'fa-eye-slash'
    );
  }

  // Kayitli SMTP ayarlariyla test maili atar; hedef alani bossa admin'in
  // kendi adresine gider.
  async sendEmailTest() {
    try {
      const target = document.getElementById('email-test-target')?.value.trim() || null;
      const res = await API.sendEmailTest(target);
      showToast(res.message, 'success');
    } catch (err) {
      showToast(`E-posta testi başarısız: ${err.message}`, 'error');
    }
  }

  // Test ve Chat ID bulma, kaydedilmis ayarlar uzerinden calisir; bu yuzden
  // once formdaki degerlerin kaydedilmis olmasi gerekir.
  async sendTelegramTest() {
    try {
      const res = await API.sendTelegramTest();
      showToast(res.message, 'success');
    } catch (err) {
      showToast(`Telegram testi başarısız: ${err.message}`, 'error');
    }
  }

  async findTelegramChatId() {
    try {
      const res = await API.getTelegramChats();
      const chats = res.chats || [];
      if (!chats.length) {
        showToast('Sohbet bulunamadı. Telegram\'dan botunuza bir mesaj (örn. /start) yazıp tekrar deneyin.', 'warning');
        return;
      }
      const field = document.getElementById('setting-telegram-chat-id');
      if (field) field.value = chats[0].id;
      const others = chats.slice(1).map(chat => `${chat.title}: ${chat.id}`).join(' • ');
      showToast(
        `Chat ID dolduruldu: ${chats[0].title} (${chats[0].id}).${others ? ` Diğer sohbetler → ${others}` : ''} Kaydetmeyi unutmayın.`,
        'success'
      );
    } catch (err) {
      showToast(`Chat ID bulunamadı: ${err.message}`, 'error');
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
  // Liste sayfa sayfa gosterilir: sayfa basina 15 kart + numarali gecis.
  get blogPageSize() { return 15; }

  async loadBlogPosts() {
    const container = document.getElementById('public-blog-cards');
    if (!container) return;

    try {
      const res = await API.getBlogPosts(this.locale);
      if (!res.posts || res.posts.length === 0) {
        container.innerHTML = `<div class="text-center" style="grid-column: 1/-1; color: var(--text-muted);">${this.t('no_blog')}</div>`;
        return;
      }
      this.allBlogPosts = res.posts;
      this.blogPage = 1;
      this.renderBlogPage();
    } catch (err) {
      console.error('Failed to load blog posts:', err);
    }
  }

  renderBlogPage() {
    const container = document.getElementById('public-blog-cards');
    if (!container || !this.allBlogPosts) return;
    const boyut = this.blogPageSize;
    const toplamSayfa = Math.max(1, Math.ceil(this.allBlogPosts.length / boyut));
    this.blogPage = Math.min(Math.max(1, this.blogPage || 1), toplamSayfa);
    const posts = this.allBlogPosts.slice((this.blogPage - 1) * boyut, this.blogPage * boyut);

    container.innerHTML = posts.map(p => `
      <div class="blog-card glass-card">
        <img src="${this.escapeHtml(p.image_url || 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80')}" class="blog-card-img" alt="${this.escapeHtml(p.title)}" loading="lazy">
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

    // Sayfa numaralari: tek sayfa varsa hic gosterilmez.
    const sayfalama = document.getElementById('blog-pagination');
    if (sayfalama) {
      if (toplamSayfa <= 1) {
        sayfalama.innerHTML = '';
      } else {
        const dugmeler = [];
        if (this.blogPage > 1) dugmeler.push(`<button class="btn btn-outline btn-sm" onclick="app.goBlogPage(${this.blogPage - 1})" aria-label="${this.ui('Önceki sayfa', 'Previous page')}">‹</button>`);
        for (let i = 1; i <= toplamSayfa; i++) {
          dugmeler.push(`<button class="btn ${i === this.blogPage ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="app.goBlogPage(${i})" ${i === this.blogPage ? 'aria-current="page"' : ''}>${i}</button>`);
        }
        if (this.blogPage < toplamSayfa) dugmeler.push(`<button class="btn btn-outline btn-sm" onclick="app.goBlogPage(${this.blogPage + 1})" aria-label="${this.ui('Sonraki sayfa', 'Next page')}">›</button>`);
        sayfalama.innerHTML = dugmeler.join('');
      }
    }
  }

  goBlogPage(sayfa) {
    this.blogPage = sayfa;
    this.renderBlogPage();
    // Yeni sayfada liste basindan baslanir.
    document.getElementById('view-blog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async loadBlogPostDetail(slug, push = true) {
    this.currentBlogSlug = slug;
    try {
      const res = await API.getBlogPostDetail(slug, this.locale);
      const post = res.post;
      if (!post) return;

      document.getElementById('blog-detail-category').innerText = post.category || this.ui('Rehber', 'Guide');
      document.getElementById('blog-detail-title').innerText = post.title;
      const yazarImza = this.blogAuthorName || `${this.siteName || 'Jet SMM Panel'} ${this.locale === 'en' ? 'Editorial Team' : 'Editör Ekibi'}`;
      // Yazar profili tanimliysa imza tiklanabilir (admin ayari blog_author_url).
      const yazarHtml = this.blogAuthorName && this.blogAuthorUrl && this.blogAuthorUrl.startsWith('http')
        ? `<a href="${this.escapeHtml(this.blogAuthorUrl)}" target="_blank" rel="me noopener noreferrer" style="color: inherit; text-decoration: underline;">${this.escapeHtml(yazarImza)}</a>`
        : this.escapeHtml(yazarImza);
      document.getElementById('blog-detail-date').innerHTML = `${yazarHtml} • ${new Date(post.published_at || post.created_at).toLocaleDateString(this.locale === 'en' ? 'en-US' : 'tr-TR')} • ${post.reading_minutes || 3} ${this.locale === 'en' ? 'min read' : 'dk okuma'}`;
      
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
      this.navigate('blog-detail', false);
      if (push) history.pushState({ view: 'blog-detail' }, '', `/blog/${encodeURIComponent(slug)}`);
      // Adres pushState'ten SONRA kesinlestigi icin paylasim baglantilari
      // burada guncellenir.
      this.updateShareLinks(post.title);
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
    // Blog icindeki hizmet linkleri temiz yolla (/services?service=ID) yazilir;
    // eski #services biçimi de yakalanir ki iki bicim de SPA icinde acilsin.
    container.querySelectorAll('a[href^="#services"], a[href^="/services"]').forEach(link => {
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
    if (updateHash) history.pushState({ view: 'services' }, '', serviceId ? `/services?service=${serviceId}` : '/services');
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
    this.initMetaCounters();
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
    this.previewBlogCover();
    this.initMetaCounters();
  }

  // --- BLOG KAPAK GORSELI ---------------------------------------------------
  // Sunucu iki bicimi kabul eder: tam http(s) adresi VEYA site ici hazir kapak
  // (/api/blog/cover/<platform>/<1-50>.svg). Kabul edilmeyen deger sessizce
  // otomatik kapakla degistiriliyordu; burada kullaniciya onceden soyluyoruz.
  isBuiltInBlogCover(value) {
    return /^\/api\/blog\/cover\/(instagram|tiktok|youtube|telegram|facebook|x-twitter|spotify|linkedin|twitch|social-media)\/([1-9]|[1-4]\d|50)\.svg(\?v=2)?$/.test(String(value || ''));
  }

  // Ayni kapagi iki yazida kullanmamak icin kullanilmayan ilk varyanti secer.
  nextFreeBlogCover(platform) {
    const used = new Set((this.currentAdminBlogPosts || [])
      .map(p => String(p.image_url || '').match(new RegExp(`^/api/blog/cover/${platform}/(\\d+)\\.svg`)))
      .filter(Boolean).map(m => Number(m[1])));
    let variant = 1;
    while (variant <= 50 && used.has(variant)) variant++;
    return `/api/blog/cover/${platform}/${variant > 50 ? 1 : variant}.svg?v=2`;
  }

  useBuiltInBlogCover() {
    const platform = document.getElementById('blog-cover-platform')?.value || 'social-media';
    const input = document.getElementById('blog-input-image');
    if (!input) return;
    input.value = this.nextFreeBlogCover(platform);
    this.previewBlogCover();
    showToast('Hazır kapak seçildi.', 'success');
  }

  previewBlogCover() {
    const input = document.getElementById('blog-input-image');
    const preview = document.getElementById('blog-cover-preview');
    const hint = document.getElementById('blog-cover-hint');
    if (!input || !hint) return;

    const value = input.value.trim();
    if (!value) {
      if (preview) preview.style.display = 'none';
      hint.textContent = 'Boş bırakırsan konuya uygun kapak otomatik atanır.';
      hint.style.color = 'var(--text-dim)';
      return;
    }

    const gecerli = this.isBuiltInBlogCover(value) || /^https?:\/\/\S+$/i.test(value);
    if (preview) {
      preview.src = value;
      preview.style.display = gecerli ? 'inline-block' : 'none';
      preview.onerror = () => { preview.style.display = 'none'; };
    }

    if (!gecerli) {
      hint.textContent = 'Bu adres kabul edilmez; kaydedince otomatik kapak atanır. https://... ile başlayan bir resim adresi veya hazır kapak kullan.';
      hint.style.color = 'var(--warning)';
    } else if (/\.(html?|php|aspx)(\?|$)/i.test(value)) {
      // pngtree gibi sitelerde sayfa adresi kopyalanip resim sanilabiliyor.
      hint.textContent = 'Dikkat: bu bir web sayfası adresi gibi görünüyor, resim dosyası değil. Resme sağ tıklayıp "Resim adresini kopyala" demelisin.';
      hint.style.color = 'var(--warning)';
    } else {
      hint.textContent = this.isBuiltInBlogCover(value) ? 'Hazır kapak kullanılıyor (sunucunda üretilir, hiç kopmaz).' : 'Dış bağlantı kullanılıyor.';
      hint.style.color = 'var(--success)';
    }
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

  // =====================================================================
  // SATIS SAYFALARI (platform bazli landing page'ler) — ziyaretci tarafi
  // Isaretleme sunucudan gelir (utils/landingPages.js); burada yalnizca
  // siparis makinesi ve tablo canli katalog verisiyle (indirim, USD fiyat,
  // bilgi penceresi) yeniden cizilir.
  // =====================================================================
  async openLandingPage(slug, push = true) {
    const root = document.getElementById('landing-page-root');
    const section = document.getElementById('view-landing-page');
    if (!root || !section) return false;
    try {
      const res = await API.getLandingPage(slug, this.locale);
      this.currentLandingSlug = slug;
      this.currentLandingPage = res.page;
      root.innerHTML = res.html;
      section.dataset.lpSlug = slug;
      this.navigate('landing-page', false);
      if (push) history.pushState({ view: 'landing-page', slug }, '', `/${encodeURIComponent(slug)}`);
      this.hydrateLandingPage();
      document.title = `${res.page.seo_title || res.page.title} | ${this.siteName || 'Jet SMM Panel'}`;
      return true;
    } catch (err) {
      if (err.status === 404) { this.navigate('not-found', false); return false; }
      showToast(err.message, 'error');
      return false;
    }
  }

  hydrateLandingPage() {
    const page = this.currentLandingPage;
    if (!page) return;
    const ids = new Set((page.category_ids || []).map(Number));
    this.lpServices = (this.allServices || []).filter(s => ids.has(Number(s.category_id)));
    this.lpCategories = (this.allCategories || []).filter(c => ids.has(Number(c.id)) && this.lpServices.some(s => s.category_id === c.id));

    const tbody = document.getElementById('lp-services-tbody');
    if (tbody && this.lpServices.length) tbody.innerHTML = this.lpServices.map(s => this.lpServiceRowHtml(s)).join('');
    this.populateLpMachine();

    const content = document.getElementById('lp-content');
    if (content) this.bindBlogInternalLinks(content);
    this.updateLpCta();
    // Ilgili rehber kartlari SPA icinde acilir (tam sayfa yuklemesi yerine).
    document.querySelectorAll('#landing-page-root a[href^="/blog/"]').forEach(link => {
      link.addEventListener('click', event => {
        event.preventDefault();
        this.loadBlogPostDetail(decodeURIComponent(link.getAttribute('href').slice('/blog/'.length)));
      });
    });
  }

  // "Nasil satin alinir" dugmesi: oturum varsa siparis sayfasina, yoksa kayda.
  // SSR metni "hesap olustur" der; giris yapmis ziyaretcide metin de degisir.
  updateLpCta() {
    const cta = document.getElementById('lp-cta');
    if (!cta) return;
    if (this.currentUser) {
      cta.setAttribute('href', '/new-order');
      cta.innerHTML = `${this.ui('Hemen Sipariş Ver', 'Order Now')} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>`;
    }
  }

  async lpCta() {
    if (!this.currentUser) { try { await this.ready; } catch {} }
    if (this.currentUser) {
      // Makinede secili servis varsa formu onunla acar.
      const service = this.lpSelectedService();
      if (service) {
        const qty = this.clampMachineQty(document.getElementById('lp-machine-qty')?.value, service);
        this.navigate('new-order');
        setTimeout(() => this.applyMachineSelection(service.id, qty), 120);
      } else this.navigate('new-order');
      return;
    }
    this.showAuthPage('register');
  }

  lpServiceRowHtml(s) {
    const isRefill = s.refill == 1 || /telafi|garanti|refill|düşüşsüz|non-drop|30 gün|60 gün|90 gün|365 gün|yenileme|days refill/i.test(`${s.name} ${s.category_name}`);
    return `<tr>
      <td class="cell-nowrap">#${s.id}</td>
      <td class="cell-service-title" title="${this.escapeHtml(s.name)}"><span class="service-name-clamp">${this.escapeHtml(s.name)}</span></td>
      <td class="cell-nowrap price-cell">${s.discount_percent ? this.renderPriceHtml(s) : this.formatServicePrice(s)}</td>
      <td class="cell-nowrap">${s.min_quantity} - ${s.max_quantity}</td>
      <td class="cell-nowrap">${isRefill ? `<span class="badge badge-completed"><i class="fa-solid fa-shield-check"></i> ${this.t('guaranteed')}</span>` : `<span class="badge badge-pending">${this.t('standard')}</span>`}</td>
      <td class="cell-nowrap" style="text-align: right;">
        <div class="service-row-actions">
          <button type="button" class="btn btn-outline btn-sm service-info-btn" onclick="app.openServiceInfoModal(${s.id})" title="${this.t('info.button')}" aria-label="${this.t('info.button')}"><i class="fa-solid fa-circle-info"></i></button>
          <button type="button" class="btn btn-primary btn-sm" onclick="app.selectServiceForOrder(${s.id})">${this.t('order_now')}</button>
        </div>
      </td>
    </tr>`;
  }

  // --- Satis sayfasi siparis makinesi -----------------------------------
  populateLpMachine() {
    const catSelect = document.getElementById('lp-machine-category');
    if (!catSelect) return;
    catSelect.innerHTML = (this.lpCategories || []).map(c => `<option value="${c.id}">${this.escapeHtml(this.localizedName(c))}</option>`).join('')
      || `<option value="">${this.ui('Servis yok', 'No services')}</option>`;
    this.onLpCategoryChange();
  }

  lpSelectedService() {
    const select = document.getElementById('lp-machine-service');
    if (!select) return null;
    return (this.lpServices || []).find(s => s.id === parseInt(select.value, 10)) || null;
  }

  onLpCategoryChange() {
    const catSelect = document.getElementById('lp-machine-category');
    const serviceSelect = document.getElementById('lp-machine-service');
    if (!catSelect || !serviceSelect) return;
    const categoryId = parseInt(catSelect.value, 10);
    const services = (this.lpServices || []).filter(s => s.category_id === categoryId);
    serviceSelect.innerHTML = services.map(s => `<option value="${s.id}">${this.escapeHtml(this.localizedName(s))} (${this.formatServicePrice(s)})</option>`).join('')
      || `<option value="">${this.ui('Servis yok', 'No services')}</option>`;
    this.onLpServiceChange();
  }

  onLpServiceChange() {
    const service = this.lpSelectedService();
    const qtyInput = document.getElementById('lp-machine-qty');
    if (service && qtyInput) {
      qtyInput.min = service.min_quantity;
      qtyInput.max = service.max_quantity;
      qtyInput.value = this.clampMachineQty(Number(qtyInput.value) || service.min_quantity, service);
    }
    this.updateLpPrice();
  }

  stepLpQty(direction) {
    const qtyInput = document.getElementById('lp-machine-qty');
    const service = this.lpSelectedService();
    if (!qtyInput || !service) return;
    const step = Math.max(1, Number(service.min_quantity) || 100);
    qtyInput.value = this.clampMachineQty((Number(qtyInput.value) || 0) + direction * step, service);
    this.updateLpPrice();
  }

  commitLpQty() {
    const qtyInput = document.getElementById('lp-machine-qty');
    const service = this.lpSelectedService();
    if (!qtyInput || !service) return;
    qtyInput.value = this.clampMachineQty(qtyInput.value, service);
    this.updateLpPrice();
  }

  updateLpPrice() {
    const priceEl = document.getElementById('lp-machine-price');
    const limitsEl = document.getElementById('lp-machine-limits');
    const qtyInput = document.getElementById('lp-machine-qty');
    const service = this.lpSelectedService();
    if (!priceEl) return;
    if (!service) {
      priceEl.textContent = this.locale === 'en' ? '$0.00' : '₺0,00';
      if (limitsEl) limitsEl.textContent = '';
      return;
    }
    const qty = Number(qtyInput?.value) || 0;
    const charge = (this.effectiveRate(service) / 1000) * qty;
    const usdCharge = (Number(service.rate_per_1000_usd_cents || 0) / 100000) * qty;
    priceEl.textContent = this.locale === 'en' && usdCharge > 0 && !service.discount_percent ? `$${usdCharge.toFixed(2)}` : `₺${charge.toFixed(2)}`;
    if (limitsEl) {
      const min = Number(service.min_quantity) || 1;
      const max = Number(service.max_quantity) || min;
      limitsEl.classList.toggle('is-invalid', qty < min || qty > max);
      limitsEl.textContent = `Limit: ${min} - ${max}`;
    }
  }

  // Giris yapmis ziyaretci dogrudan siparis formuna, digerleri giris ekranina
  // gider; secim oturum sonrasi forma tasinir (bekleyenMakineSecimi).
  async submitLpOrder() {
    const service = this.lpSelectedService();
    if (!service) return showToast(this.ui('Önce bir hizmet seçin.', 'Please choose a service first.'), 'warning');
    const qty = this.clampMachineQty(document.getElementById('lp-machine-qty')?.value, service);
    if (!this.currentUser) {
      try { await this.ready; } catch {}
    }
    if (!this.currentUser) {
      this.pendingMachineOrder = { serviceId: service.id, quantity: qty };
      showToast(this.ui('Siparişi tamamlamak için giriş yapın veya ücretsiz hesap oluşturun.', 'Sign in or create a free account to complete your order.'), 'info');
      return this.showAuthPage('login');
    }
    this.navigate('new-order');
    setTimeout(() => this.applyMachineSelection(service.id, qty), 120);
  }

  // =====================================================================
  // SATIS SAYFALARI — yonetim paneli
  // =====================================================================
  async loadAdminLandingPages() {
    const tbody = document.getElementById('admin-landing-pages-tbody');
    if (!tbody) return;
    try {
      const res = await API.getAdminLandingPages();
      this.adminLandingPages = res.pages || [];
      this.lpPlatforms = res.platforms || {};
      if (!this.adminLandingPages.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding: 28px; color: var(--text-dim);">Henüz satış sayfası yok. "Yeni Satış Sayfası" ile ilkini oluştur.</td></tr>';
        return;
      }
      tbody.innerHTML = this.adminLandingPages.map(p => {
        const platform = this.lpPlatforms[p.platform_key] || { label: p.platform_key, icon: 'fa-solid fa-layer-group' };
        const catNames = (p.category_ids || []).map(id => this.localizedName((this.allCategories || []).find(c => c.id === id)) || `#${id}`);
        return `<tr>
          <td>#${p.id}</td>
          <td style="font-weight: 600;">${this.escapeHtml(p.title_tr)}<small style="display: block; color: var(--text-dim);">${this.escapeHtml(p.title_en || '')}</small></td>
          <td><code style="font-size: .8rem;">/${this.escapeHtml(p.slug)}</code></td>
          <td><i class="${this.escapeHtml(platform.icon)}"></i> ${this.escapeHtml(platform.label)}</td>
          <td style="font-size: .8rem; max-width: 220px;" title="${this.escapeHtml(catNames.join(', '))}">${this.escapeHtml(catNames.slice(0, 2).join(', '))}${catNames.length > 2 ? ` +${catNames.length - 2}` : ''}</td>
          <td><span class="badge ${p.status === 'published' ? 'badge-completed' : 'badge-pending'}">${p.status === 'published' ? 'Yayında' : 'Taslak'}</span></td>
          <td>${Number(p.views || 0).toLocaleString('tr-TR')}</td>
          <td style="text-align: right; white-space: nowrap;">
            ${p.status === 'published' ? `<a class="btn btn-outline btn-sm" href="/${this.escapeHtml(p.slug)}" target="_blank" rel="noopener" title="Sayfayı aç"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>` : ''}
            <button class="btn btn-cyan btn-sm" onclick="app.showEditLandingPageModal(${p.id})"><i class="fa-solid fa-pen"></i> Düzenle</button>
            <button class="btn btn-outline btn-sm" style="color: var(--danger);" onclick="app.deleteAdminLandingPage(${p.id})"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>`;
      }).join('');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  lpPlatformOptionsHtml(selected = 'social-media') {
    const platforms = Object.keys(this.lpPlatforms || {}).length ? this.lpPlatforms : {
      instagram: { label: 'Instagram' }, tiktok: { label: 'TikTok' }, youtube: { label: 'YouTube' }, telegram: { label: 'Telegram' },
      facebook: { label: 'Facebook' }, 'x-twitter': { label: 'X (Twitter)' }, spotify: { label: 'Spotify' }, linkedin: { label: 'LinkedIn' },
      twitch: { label: 'Twitch' }, kick: { label: 'Kick' }, threads: { label: 'Threads' }, 'social-media': { label: 'Sosyal Medya' }
    };
    return Object.entries(platforms).map(([key, p]) => `<option value="${key}" ${key === selected ? 'selected' : ''}>${this.escapeHtml(p.label)}</option>`).join('');
  }

  // Kategori adindan platform grubu: secici listesi platforma gore katlanir.
  lpPlatformGroupOf(name) {
    const n = String(name || '').toLowerCase();
    const groups = [
      ['instagram', 'Instagram', 'fa-brands fa-instagram'], ['tiktok', 'TikTok', 'fa-brands fa-tiktok'], ['youtube', 'YouTube', 'fa-brands fa-youtube'],
      ['telegram', 'Telegram', 'fa-brands fa-telegram'], ['twitter', 'Twitter / X', 'fa-brands fa-x-twitter'], ['facebook', 'Facebook', 'fa-brands fa-facebook'],
      ['spotify', 'Spotify', 'fa-brands fa-spotify'], ['twitch', 'Twitch', 'fa-brands fa-twitch'], ['kick', 'Kick', 'fa-solid fa-bolt'],
      ['threads', 'Threads', 'fa-brands fa-threads'], ['linkedin', 'LinkedIn', 'fa-brands fa-linkedin'], ['pinterest', 'Pinterest', 'fa-brands fa-pinterest'],
      ['soundcloud', 'SoundCloud', 'fa-brands fa-soundcloud'], ['whatsapp', 'WhatsApp', 'fa-brands fa-whatsapp']
    ];
    const hit = groups.find(g => n.includes(g[0]));
    return hit ? { key: hit[0], label: hit[1], icon: hit[2] } : { key: 'other', label: 'Diğer', icon: 'fa-solid fa-layer-group' };
  }

  // Secili ogelerin cip listesi (kategori ve blog secicileri ortak kullanir).
  renderLpSelectedChips(boxId, items, onRemove) {
    const box = document.getElementById(boxId);
    if (!box) return;
    box.innerHTML = items.map(item => `<span class="lp-chip-sel" title="${this.escapeHtml(item.label)}"><span>${this.escapeHtml(item.label)}</span><button type="button" aria-label="Kaldır" onclick="${onRemove(item)}">×</button></span>`).join('');
  }

  renderLpCategoryPicker() {
    const box = document.getElementById('lp-category-picker');
    const summary = document.getElementById('lp-category-summary');
    if (!box) return;
    const q = (document.getElementById('lp-category-search')?.value || '').trim().toLowerCase();
    const selected = this.lpSelectedCategoryIds || (this.lpSelectedCategoryIds = new Set());
    const categories = (this.allCategories || []).map(c => {
      const services = (this.allServices || []).filter(s => s.category_id === c.id);
      const minRate = services.reduce((m, s) => (Number(s.rate_per_1000) > 0 && (m === null || Number(s.rate_per_1000) < m) ? Number(s.rate_per_1000) : m), null);
      return { ...c, count: services.length, minRate, label: c.name_tr || c.name, group: this.lpPlatformGroupOf(`${c.name_tr || ''} ${c.name_en || ''} ${c.name || ''}`) };
    }).filter(c => c.count > 0 && (!q || `${c.name_tr || ''} ${c.name_en || ''} ${c.name || ''}`.toLowerCase().includes(q)));

    // Platform gruplari; secili oge iceren veya aramada eslesen gruplar acik gelir.
    const groups = new Map();
    for (const c of categories) {
      if (!groups.has(c.group.key)) groups.set(c.group.key, { ...c.group, items: [] });
      groups.get(c.group.key).items.push(c);
    }
    box.innerHTML = [...groups.values()].map(g => {
      const open = q || g.items.some(c => selected.has(c.id));
      return `<details class="lp-picker-group" ${open ? 'open' : ''}>
        <summary><i class="${g.icon}"></i> ${this.escapeHtml(g.label)} <small>${g.items.length} kategori</small></summary>
        ${g.items.map(c => `<label class="lp-picker-item"><input type="checkbox" ${selected.has(c.id) ? 'checked' : ''} onchange="app.toggleLpCategory(${c.id}, this.checked)"><span>${this.escapeHtml(c.label)}</span><small>${c.count} servis${c.minRate !== null ? ` · ₺${c.minRate.toFixed(2)}'den` : ''}</small></label>`).join('')}
      </details>`;
    }).join('') || '<div class="lp-picker-empty">Eşleşen kategori yok.</div>';

    const secili = (this.allCategories || []).filter(c => selected.has(c.id)).map(c => ({ id: c.id, label: c.name_tr || c.name }));
    this.renderLpSelectedChips('lp-category-selected', secili, item => `app.toggleLpCategory(${item.id}, false)`);
    if (summary) {
      const count = (this.allServices || []).filter(s => selected.has(s.category_id)).length;
      summary.textContent = selected.size ? `${selected.size} kategori seçildi → sayfada ${count} servis listelenecek.` : 'Henüz kategori seçilmedi.';
    }
  }

  toggleLpCategory(id, checked) {
    const selected = this.lpSelectedCategoryIds || (this.lpSelectedCategoryIds = new Set());
    if (checked) selected.add(id); else selected.delete(id);
    this.renderLpCategoryPicker();
  }

  async renderLpBlogPicker() {
    const box = document.getElementById('lp-blog-picker');
    const summary = document.getElementById('lp-blog-summary');
    if (!box) return;
    if (!this.currentAdminBlogPosts) {
      try { this.currentAdminBlogPosts = (await API.getAdminBlogPosts()).posts || []; } catch { this.currentAdminBlogPosts = []; }
    }
    const q = (document.getElementById('lp-blog-search')?.value || '').trim().toLowerCase();
    const selected = this.lpSelectedBlogSlugs || (this.lpSelectedBlogSlugs = new Set());
    const posts = this.currentAdminBlogPosts
      .filter(p => p.status === 'published' && (!q || `${p.title_tr || ''} ${p.title_en || ''} ${p.slug}`.toLowerCase().includes(q)))
      .sort((a, b) => String(b.published_at || b.created_at || '').localeCompare(String(a.published_at || a.created_at || '')));
    box.innerHTML = posts.map(p => `<label class="lp-picker-item"><input type="checkbox" ${selected.has(p.slug) ? 'checked' : ''} onchange="app.toggleLpBlog('${this.escapeHtml(p.slug)}', this.checked)"><span>${this.escapeHtml(p.title_tr || p.title)}</span><small>${new Date(p.published_at || p.created_at).toLocaleDateString('tr-TR')}</small></label>`).join('')
      || '<div class="lp-picker-empty">Yayında eşleşen yazı yok.</div>';
    const secili = this.currentAdminBlogPosts.filter(p => selected.has(p.slug)).map(p => ({ slug: p.slug, label: p.title_tr || p.title }));
    this.renderLpSelectedChips('lp-blog-selected', secili, item => `app.toggleLpBlog('${this.escapeHtml(item.slug)}', false)`);
    if (summary) summary.textContent = selected.size ? `${selected.size} yazı seçildi (en fazla 8).` : 'Yazı seçilmedi; bu bölüm sayfada görünmez.';
  }

  toggleLpBlog(slug, checked) {
    const selected = this.lpSelectedBlogSlugs || (this.lpSelectedBlogSlugs = new Set());
    if (checked) {
      if (selected.size >= 8) return showToast('En fazla 8 ilgili yazı seçebilirsin.', 'warning');
      selected.add(slug);
    } else selected.delete(slug);
    this.renderLpBlogPicker();
  }

  updateLpSlugPreview() {
    const preview = document.getElementById('lp-slug-preview');
    if (!preview) return;
    const raw = document.getElementById('lp-input-slug')?.value.trim() || document.getElementById('lp-input-title-tr')?.value || '';
    const slug = raw.toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ö/g, 'o').replace(/ü/g, 'u')
      .normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    preview.textContent = slug || '…';
  }

  // Editor her acilista katalogu ve blog listesini tazeler: yeni eklenen
  // kategori/yazi sayfa yenilemeden secicide gorunur.
  async refreshLpPickerSources() {
    try { await this.loadServicesData(); } catch {}
    try { this.currentAdminBlogPosts = (await API.getAdminBlogPosts()).posts || []; } catch {}
  }

  async showAddLandingPageModal() {
    await this.refreshLpPickerSources();
    document.querySelector('#modal-landing-page form')?.reset();
    document.getElementById('lp-input-id').value = '';
    document.getElementById('lp-input-platform').innerHTML = this.lpPlatformOptionsHtml('instagram');
    document.getElementById('lp-input-status').value = 'draft';
    document.getElementById('lp-editor-title').innerHTML = '<i class="fa-solid fa-store"></i> Yeni Satış Sayfası';
    this.lpSelectedCategoryIds = new Set();
    this.lpSelectedBlogSlugs = new Set();
    this.renderLpCategoryPicker();
    await this.renderLpBlogPicker();
    this.updateLpSlugPreview();
    document.getElementById('modal-landing-page')?.classList.add('active');
    this.initMetaCounters();
  }

  async showEditLandingPageModal(id) {
    const page = (this.adminLandingPages || []).find(p => p.id === id);
    if (!page) return;
    await this.refreshLpPickerSources();
    const faqText = list => (list || []).map(f => `${f.q}\n${f.a}`).join('\n\n');
    const fields = {
      'lp-input-id': page.id, 'lp-input-slug': page.slug, 'lp-input-status': page.status || 'draft', 'lp-input-sort': page.sort_order || 0,
      'lp-input-image': page.image_url || '',
      'lp-input-title-tr': page.title_tr || '', 'lp-input-title-en': page.title_en || '',
      'lp-input-subtitle-tr': page.subtitle_tr || '', 'lp-input-subtitle-en': page.subtitle_en || '',
      'lp-input-seo-title-tr': page.seo_title_tr || '', 'lp-input-seo-title-en': page.seo_title_en || '',
      'lp-input-seo-description-tr': page.seo_description_tr || '', 'lp-input-seo-description-en': page.seo_description_en || '',
      'lp-input-content-tr': page.content_tr || '', 'lp-input-content-en': page.content_en || '',
      'lp-input-steps-tr': (page.steps_tr || []).join('\n'), 'lp-input-steps-en': (page.steps_en || []).join('\n'),
      'lp-input-faq-tr': faqText(page.faq_tr), 'lp-input-faq-en': faqText(page.faq_en),
      'lp-input-cta-tr': page.cta_text_tr || '', 'lp-input-cta-en': page.cta_text_en || ''
    };
    document.getElementById('lp-input-platform').innerHTML = this.lpPlatformOptionsHtml(page.platform_key || 'social-media');
    Object.entries(fields).forEach(([fieldId, value]) => { const field = document.getElementById(fieldId); if (field) field.value = value; });
    this.lpSelectedCategoryIds = new Set(page.category_ids || []);
    this.lpSelectedBlogSlugs = new Set(page.related_blog_slugs || []);
    document.getElementById('lp-category-search').value = '';
    document.getElementById('lp-blog-search').value = '';
    this.renderLpCategoryPicker();
    await this.renderLpBlogPicker();
    document.getElementById('lp-editor-title').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Satış Sayfasını Düzenle';
    this.updateLpSlugPreview();
    document.getElementById('modal-landing-page')?.classList.add('active');
    this.initMetaCounters();
  }

  lpFormData() {
    const v = id => (document.getElementById(id)?.value ?? '').trim();
    return {
      slug: v('lp-input-slug'),
      platform_key: v('lp-input-platform'),
      status: v('lp-input-status'),
      sort_order: v('lp-input-sort'),
      image_url: v('lp-input-image'),
      category_ids: [...(this.lpSelectedCategoryIds || [])],
      related_blog_slugs: [...(this.lpSelectedBlogSlugs || [])],
      title_tr: v('lp-input-title-tr'), title_en: v('lp-input-title-en'),
      subtitle_tr: v('lp-input-subtitle-tr'), subtitle_en: v('lp-input-subtitle-en'),
      seo_title_tr: v('lp-input-seo-title-tr'), seo_title_en: v('lp-input-seo-title-en'),
      seo_description_tr: v('lp-input-seo-description-tr'), seo_description_en: v('lp-input-seo-description-en'),
      content_tr: v('lp-input-content-tr'), content_en: v('lp-input-content-en'),
      steps_tr: v('lp-input-steps-tr'), steps_en: v('lp-input-steps-en'),
      faq_tr: v('lp-input-faq-tr'), faq_en: v('lp-input-faq-en'),
      cta_text_tr: v('lp-input-cta-tr'), cta_text_en: v('lp-input-cta-en')
    };
  }

  async handleSaveLandingPage(e) {
    e.preventDefault();
    const data = this.lpFormData();
    if (!data.category_ids.length) return showToast('En az bir servis kategorisi seç.', 'warning');
    try {
      const id = document.getElementById('lp-input-id').value;
      const res = id ? await API.updateAdminLandingPage(id, data) : await API.addAdminLandingPage(data);
      showToast(res.message, 'success');
      this.closeModal('modal-landing-page');
      this.loadAdminLandingPages();
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  }

  // Kayitli sayfayi (taslak dahil) sunucunun urettigi isaretlemeyle yeni sekmede gosterir.
  async previewLandingPage() {
    const id = document.getElementById('lp-input-id').value;
    if (!id) return showToast('Önizleme için önce sayfayı (taslak olarak) kaydet.', 'info');
    try {
      const res = await API.previewAdminLandingPage(id, this.locale);
      const popup = window.open('', '_blank', 'width=1180,height=820');
      if (!popup) return showToast('Önizleme için açılır pencereye izin verin.', 'info');
      popup.opener = null;
      popup.document.write(`<!doctype html><html lang="${this.locale}"><head><meta charset="utf-8"><title>Önizleme</title><link rel="stylesheet" href="/css/style.css"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"></head><body class="neo-app-active" style="padding: 24px;"><section id="view-landing-page" class="app-view"><div class="main-content lp-page">${res.html}</div></section></body></html>`);
      popup.document.close();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async deleteAdminLandingPage(id) {
    if (!await confirmDialog('Bu satış sayfası kalıcı olarak silinecek. Yayındaysa adresi 404 dönmeye başlar.', {
      title: 'Satış sayfasını sil', danger: true, confirmText: 'Sil'
    })) return;
    try {
      const res = await API.deleteAdminLandingPage(id);
      showToast(res.message, 'success');
      this.loadAdminLandingPages();
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
    } catch (err) { this.appendAiMessage('assistant error', `⚠️ Hata: ${err.message}`); }
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

    this.prepareAuthForm('auth-form', mode);
    document.getElementById('modal-auth').classList.add('active');
  }

  // Kayit/giris arasinda gecerken eski hatalar ve ipuclari temizlenir;
  // kayit modunda sifre kurali onceden gorunur (kullanici denemeden bilsin).
  prepareAuthForm(formId, mode) {
    const form = document.getElementById(formId);
    this.clearAuthFieldErrors(form);
    const prefix = formId === 'view-auth-form' ? 'vauth' : 'auth';
    const hint = document.getElementById(`${prefix}-password-hint`);
    if (hint) {
      hint.style.display = mode === 'register' ? 'block' : 'none';
      hint.textContent = this.ui('Şifre en az 10 karakter olmalıdır.', 'Password must be at least 10 characters.');
    }
    // Davet linkiyle gelindiyse kimin davet ettigi acikca yazilir.
    const invite = document.getElementById(`${prefix}-invite-note`);
    if (invite) {
      const show = mode === 'register' && Boolean(this.referralCode);
      invite.style.display = show ? 'block' : 'none';
      if (show) {
        invite.textContent = this.ui(
          `🎁 ${this.referralCode} sizi davet etti. Kaydınız bu davetle eşleştirilecek.`,
          `🎁 ${this.referralCode} invited you. Your account will be linked to this invitation.`
        );
      }
    }
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

    this.prepareAuthForm('view-auth-form', mode);
    this.navigate('auth');
  }

  toggleAuthViewMode() {
    this.showAuthPage(this.authMode === 'login' ? 'register' : 'login');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
    // Sohbet kapaninca arka planda sorgu atmaya devam etmesin.
    if (modalId === 'modal-ticket-chat') {
      this.stopTicketChatPolling();
      this.activeChatTicketId = null;
      this.chatSignature = undefined;
      document.getElementById('chat-jump-btn')?.remove();
    }
  }

  // --- KAYIT / GIRIS HATA GOSTERIMI -----------------------------------------
  // Eskiden her hata "İşlem Başarısız: Gönderilen bilgiler geçersiz." olarak
  // gorunuyordu; kullanici hangi alani duzeltecegini bilemiyordu. Artik mesaj
  // dogrudan ilgili alanin altina yazilir.

  clearAuthFieldErrors(form) {
    if (!form) return;
    form.querySelectorAll('.field-error').forEach(el => el.remove());
    form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
  }

  showAuthFieldError(input, message) {
    if (!input) return false;
    input.classList.add('is-invalid');
    const group = input.closest('.form-group') || input.parentElement;
    let holder = group?.querySelector('.field-error');
    if (!holder) {
      holder = document.createElement('div');
      holder.className = 'field-error';
      // Sifremi unuttum dugmesinin altinda kalmamasi icin input'un hemen ardina.
      input.insertAdjacentElement('afterend', holder);
    }
    holder.textContent = message;
    return true;
  }

  // Sunucuya gitmeden once bariz hatalar yakalanir: kullanici beklemeden
  // ne duzeltecegini gorur. Kurallar sunucudakiyle birebir aynidir.
  checkRegistrationInputs({ username, email, password }) {
    const problems = [];
    if (username.length < 3) {
      problems.push({ field: 'username', message: this.ui('Kullanıcı adı en az 3 karakter olmalıdır.', 'Username must be at least 3 characters.') });
    } else if (username.length > 32) {
      problems.push({ field: 'username', message: this.ui('Kullanıcı adı en fazla 32 karakter olabilir.', 'Username can be at most 32 characters.') });
    } else if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
      problems.push({
        field: 'username',
        message: this.ui(
          'Kullanıcı adı yalnızca İngilizce harf, rakam, nokta, tire ve alt çizgi içerebilir. (Türkçe karakter ve boşluk kullanılamaz.)',
          'Username may only contain English letters, numbers, dot, hyphen and underscore. (No spaces or accented characters.)'
        )
      });
    }
    if (!email) {
      problems.push({ field: 'email', message: this.ui('E-posta adresi zorunludur.', 'Email address is required.') });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      problems.push({
        field: 'email',
        message: this.ui('Geçerli bir e-posta adresi girin. (örnek: ad@site.com)', 'Enter a valid email address. (example: name@site.com)')
      });
    }
    if (password.length < 10) {
      problems.push({
        field: 'password',
        message: this.ui(
          `Şifre en az 10 karakter olmalıdır. Şu an ${password.length} karakter girdiniz.`,
          `Password must be at least 10 characters. You entered ${password.length}.`
        )
      });
    } else if (password.length > 128) {
      problems.push({ field: 'password', message: this.ui('Şifre en fazla 128 karakter olabilir.', 'Password can be at most 128 characters.') });
    }
    return problems;
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

    const inputsByField = { username: usernameInput, email: emailInput, password: passwordInput, totp: totpInput };
    this.clearAuthFieldErrors(e.target);

    if (this.authMode === 'register') {
      const problems = this.checkRegistrationInputs({ username, email, password });
      if (problems.length) {
        problems.forEach(problem => this.showAuthFieldError(inputsByField[problem.field], problem.message));
        inputsByField[problems[0].field]?.focus();
        showToast(problems[0].message, 'error');
        return;
      }
    }

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
      
      // Sipariş makinesinden gelindiyse seçim forma taşınır. Aşağıdaki
      // navigate() tam sayfa yüklemesine dönebileceği için seçim önce
      // sessionStorage'a alınır; init() sayfa açılınca geri okur.
      if (this.pendingMachineOrder) {
        try { sessionStorage.setItem('bekleyenMakineSecimi', JSON.stringify(this.pendingMachineOrder)); } catch {}
      }

      if (this.currentUser.role === 'admin') {
        this.navigate('admin');
      } else {
        this.navigate('new-order');
        if (this.pendingMachineOrder) {
          const { serviceId, quantity } = this.pendingMachineOrder;
          this.pendingMachineOrder = null;
          try { sessionStorage.removeItem('bekleyenMakineSecimi'); } catch {}
          setTimeout(() => this.applyMachineSelection(serviceId, quantity), 150);
        }
      }
    } catch (err) {
      if (err.code === 'TWO_FACTOR_REQUIRED') {
        const group = isViewForm ? document.getElementById('vauth-totp-group') : document.getElementById('auth-totp-group');
        if (group) group.style.display = 'block';
        totpInput?.focus();
        showToast(err.message, 'error');
        return;
      }

      // Sunucu hangi alanlarin sorunlu oldugunu bildiriyorsa mesaji dogrudan
      // o alanin altina yaziyoruz; kullanici nereye bakacagini aramasin.
      let marked = false;
      for (const item of err.details || []) {
        if (this.showAuthFieldError(inputsByField[item.field], item.message)) marked = true;
      }
      if (!marked && err.field) {
        marked = this.showAuthFieldError(inputsByField[err.field], err.message);
      }
      if (marked) inputsByField[(err.details?.[0]?.field) || err.field]?.focus();
      showToast(err.message, 'error');
    }
  }
}

// Global App Instance
const app = new SmmApp();
