// Bayi vitrini: tek sayfa uygulamasi. Sunucu tum adreslere ayni HTML'i verir;
// gorunum adres cubugundaki yola gore secilir.
(function () {
  'use strict';

  const state = { site: null, customer: null, categories: [], services: [], servicesLoaded: false, methods: [], method: null, payTimer: null, digital: [], dgCategory: '', afterAuth: null };
  const USER_VIEWS = new Set(['order', 'orders', 'account', 'funds', 'dorders']);
  const ROUTES = { '/': 'home', '/services': 'services', '/order': 'order', '/orders': 'orders', '/account': 'account', '/bakiye': 'funds', '/sifre-sifirla': 'reset', '/dijital': 'digital', '/dijital/siparislerim': 'dorders', '/api-dokumani': 'apidocs' };

  // Yasal sayfalar /sayfa/<slug> adresinde acilir.
  // Yasal sayfalar /sayfa/<slug>, blog yazilari /blog/<slug>, satis sayfalari /hizmet/<slug>.
  function routeOf(path) {
    if (path.startsWith('/sayfa/')) return 'page';
    if (/^\/(blog|hizmet)\/[^/]+\/?$/.test(path)) return 'post';
    if (/^\/blog\/?$/.test(path)) return 'blog';
    return ROUTES[path] || 'home';
  }

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function money(value) {
    return '₺' + Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Sunucu SQLite tarihini "YYYY-AA-GG SS:DD:ss" (UTC, dilimsiz) yazar.
  function formatDate(value) {
    if (!value) return '';
    const text = String(value);
    const date = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(text) ? new Date(text.replace(' ', 'T') + 'Z') : new Date(text);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
  }

  let toastTimer = null;
  function toast(message, type) {
    const el = $('#sf-toast');
    el.textContent = message;
    el.className = 'sf-toast show' + (type === 'error' ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'sf-toast'; }, 3500);
  }

  async function api(path, options = {}) {
    const res = await fetch('/api' + path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    const data = (res.headers.get('content-type') || '').includes('application/json') ? await res.json() : {};
    if (!res.ok) {
      const err = new Error(data.error || 'İşlem tamamlanamadı. Lütfen tekrar deneyin.');
      err.status = res.status;
      err.field = data.field;
      throw err;
    }
    return data;
  }

  // ---------------------------------------------------------------- oturum
  function setCustomer(customer) {
    state.customer = customer;
    const loggedIn = Boolean(customer);
    $$('[data-auth="guest"]').forEach(el => { el.hidden = loggedIn; });
    $$('[data-auth="user"]').forEach(el => { el.hidden = !loggedIn; });
    if (customer) {
      $('#sf-balance').textContent = money(customer.balance);
      $('#sf-account-balance').textContent = money(customer.balance);
      $('#sf-account-username').textContent = customer.username;
      $('#sf-account-email').textContent = customer.email;
    }
  }

  function showAuthTab(tab) {
    $$('.sf-tabs [data-auth-tab]').forEach(btn => btn.classList.toggle('active', btn.dataset.authTab === tab));
    $$('[data-auth-form]').forEach(form => { form.hidden = form.dataset.authForm !== tab; });
  }

  async function submitAuth(event, kind) {
    event.preventDefault();
    const form = event.currentTarget;
    const errorEl = $('.sf-form-error', form);
    const button = $('button[type=submit]', form);
    errorEl.textContent = '';
    button.disabled = true;
    try {
      const body = Object.fromEntries(new FormData(form).entries());
      const data = await api('/auth/' + kind, { method: 'POST', body: JSON.stringify(body) });
      setCustomer(data.customer);
      form.reset();
      toast(kind === 'register' ? 'Hesabın oluşturuldu, hoş geldin!' : 'Giriş yapıldı.');
      // Dijital urun penceresinden gelen ziyaretci urunlere geri doner.
      navigate(state.afterAuth || '/order');
      state.afterAuth = null;
    } catch (err) {
      errorEl.textContent = err.message;
    } finally {
      button.disabled = false;
    }
  }

  async function submitForgot(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const errorEl = $('.sf-form-error', form);
    const okEl = $('.sf-form-ok', form);
    const button = $('button[type=submit]', form);
    errorEl.textContent = '';
    okEl.textContent = '';
    button.disabled = true;
    try {
      const data = await api('/auth/forgot', { method: 'POST', body: JSON.stringify({ email: form.email.value.trim() }) });
      okEl.textContent = data.message;
    } catch (err) {
      errorEl.textContent = err.message;
    } finally {
      button.disabled = false;
    }
  }

  async function submitReset(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const errorEl = $('.sf-form-error', form);
    const button = $('button[type=submit]', form);
    const token = new URLSearchParams(location.search).get('token') || '';
    errorEl.textContent = '';
    button.disabled = true;
    try {
      const data = await api('/auth/reset', { method: 'POST', body: JSON.stringify({ token, password: form.password.value }) });
      form.reset();
      toast(data.message);
      setCustomer(null);
      navigate('/');
      showAuthTab('login');
    } catch (err) {
      errorEl.textContent = err.message;
    } finally {
      button.disabled = false;
    }
  }

  async function logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setCustomer(null);
    navigate('/');
  }

  async function refreshCustomer() {
    try {
      const data = await api('/auth/me');
      setCustomer(data.customer);
    } catch {
      setCustomer(null);
    }
  }

  // ---------------------------------------------------------------- servisler
  async function loadServices() {
    if (state.servicesLoaded) return;
    const data = await api('/services');
    state.categories = data.categories;
    state.services = data.services;
    state.servicesLoaded = true;
  }

  function priceLabel(service) {
    return service.pricing_model === 'per_item' ? 'adet başı' : '1000 adet';
  }

  // Ana sayfadaki platform kartlari: kategori adindan platform bulunur (ilk eslesen).
  const PLATFORMS = [
    { key: 'instagram', label: 'Instagram', icon: 'fa-brands fa-instagram', color: '#e1306c', re: /instagram|reels/ },
    { key: 'tiktok', label: 'TikTok', icon: 'fa-brands fa-tiktok', color: '#111111', re: /tik ?tok/ },
    { key: 'youtube', label: 'YouTube', icon: 'fa-brands fa-youtube', color: '#ff0033', re: /youtube|shorts/ },
    { key: 'x', label: 'X (Twitter)', icon: 'fa-brands fa-x-twitter', color: '#111111', re: /twitter|tweet|(^|[\s(])x([\s)]|$)/ },
    { key: 'facebook', label: 'Facebook', icon: 'fa-brands fa-facebook-f', color: '#1877f2', re: /facebook/ },
    { key: 'telegram', label: 'Telegram', icon: 'fa-brands fa-telegram', color: '#229ed9', re: /telegram/ },
    { key: 'spotify', label: 'Spotify', icon: 'fa-brands fa-spotify', color: '#1db954', re: /spotify/ },
    { key: 'twitch', label: 'Twitch', icon: 'fa-brands fa-twitch', color: '#9146ff', re: /twitch/ },
    { key: 'threads', label: 'Threads', icon: 'fa-brands fa-threads', color: '#111111', re: /threads/ },
    { key: 'linkedin', label: 'LinkedIn', icon: 'fa-brands fa-linkedin-in', color: '#0a66c2', re: /linkedin/ },
    { key: 'discord', label: 'Discord', icon: 'fa-brands fa-discord', color: '#5865f2', re: /discord/ },
    { key: 'pinterest', label: 'Pinterest', icon: 'fa-brands fa-pinterest-p', color: '#e60023', re: /pinterest/ },
    { key: 'soundcloud', label: 'SoundCloud', icon: 'fa-brands fa-soundcloud', color: '#ff5500', re: /soundcloud/ },
    { key: 'reddit', label: 'Reddit', icon: 'fa-brands fa-reddit-alien', color: '#ff4500', re: /reddit/ },
    { key: 'web', label: 'Web Trafiği', icon: 'fa-solid fa-globe', color: '#0ea5e9', re: /trafik|traffic|website/ }
  ];

  // Turkce kucuk harf "Instagram"i "ınstagram" yapar; ı -> i ile eslesme kacmaz.
  function platformOf(category) {
    const name = String(category?.name || '').toLocaleLowerCase('tr-TR').replace(/ı/g, 'i');
    return PLATFORMS.find(p => p.re.test(name)) || null;
  }

  function number(value) {
    return Number(value || 0).toLocaleString('tr-TR');
  }

  // Ziyaretci ana sayfasi: sayilar ve platform kartlari gercek servis listesinden.
  async function renderHome() {
    try { await loadServices(); } catch { return; }
    const services = state.services;
    if (!services.length) return;
    const byCategory = new Map(state.categories.map(c => [c.id, platformOf(c)]));
    const groups = new Map();
    for (const service of services) {
      const platform = byCategory.get(service.category_id);
      if (!platform) continue;
      const group = groups.get(platform.key) || { platform, count: 0, min: null };
      group.count++;
      if (service.pricing_model !== 'per_item' && service.rate > 0 && (group.min === null || service.rate < group.min)) group.min = service.rate;
      groups.set(platform.key, group);
    }
    const perThousand = services.filter(s => s.pricing_model !== 'per_item' && s.rate > 0).map(s => s.rate);
    const stats = [
      [number(services.length), 'aktif servis'],
      groups.size ? [number(groups.size), 'platform'] : null,
      [number(services.filter(s => s.refill).length), 'garantili servis'],
      perThousand.length ? [money(Math.min(...perThousand)), 'başlayan fiyat / 1000'] : null
    ].filter(Boolean);
    $('#sf-stats').innerHTML = stats.map(([value, label]) => `<div><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`).join('');
    $('#sf-stats').hidden = false;

    const cards = [...groups.values()].sort((a, b) => b.count - a.count).slice(0, 8);
    $('#sf-platforms-block').hidden = !cards.length;
    $('#sf-platform-grid').innerHTML = cards.map(({ platform, count, min }) => `
      <a class="sf-platform" href="/services" data-platform="${platform.key}" style="--brand:${platform.color}">
        <span class="sf-platform-icon"><i class="${platform.icon}" aria-hidden="true"></i></span>
        <span class="sf-platform-text"><b>${escapeHtml(platform.label)}</b><small>${number(count)} servis${min !== null ? ` · ${money(min)}'den` : ''}</small></span>
        <i class="fa-solid fa-arrow-right sf-platform-go" aria-hidden="true"></i>
      </a>`).join('');
  }

  function renderServices() {
    const box = $('#sf-services-list');
    const query = ($('#sf-service-search').value || '').trim().toLocaleLowerCase('tr-TR');
    const platform = PLATFORMS.find(p => p.key === state.platformKey) || null;
    const matches = (service, category) => platform
      ? platformOf(category) === platform
      : !query || service.name.toLocaleLowerCase('tr-TR').includes(query) || String(category.name).toLocaleLowerCase('tr-TR').includes(query);
    const html = state.categories.map(category => {
      const items = state.services.filter(s => s.category_id === category.id && matches(s, category));
      if (!items.length) return '';
      const rows = items.map(s => `
        <tr>
          <td>#${s.id}</td>
          <td><strong>${escapeHtml(s.name)}</strong>${s.refill ? ' <span class="sf-badge sf-badge-completed">Garantili</span>' : ''}${s.description ? `<div class="sf-muted" style="font-size:.82rem;margin-top:4px;">${escapeHtml(s.description).slice(0, 220)}</div>` : ''}</td>
          <td class="sf-price">${money(s.rate)} <small class="sf-muted">/ ${priceLabel(s)}</small></td>
          <td>${s.min.toLocaleString('tr-TR')} - ${s.max.toLocaleString('tr-TR')}</td>
          <td>${state.customer ? `<button type="button" class="sf-btn sf-btn-primary sf-btn-sm" data-order-service="${s.id}">Sipariş</button>` : ''}</td>
        </tr>`).join('');
      return `<div class="sf-category"><h2>${escapeHtml(category.name)}</h2><div class="sf-table-wrap"><table class="sf-table">
        <thead><tr><th>ID</th><th>Servis</th><th>Fiyat</th><th>Min - Maks</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
    }).join('');
    box.innerHTML = html || '<p class="sf-muted">Aramanıza uygun servis bulunamadı.</p>';
  }

  // ------------------------------------------------------------- yeni siparis
  function selectedService() {
    const id = Number($('#sf-order-service').value);
    return state.services.find(s => s.id === id) || null;
  }

  function fillCategorySelect(preferredServiceId) {
    const catSelect = $('#sf-order-category');
    catSelect.innerHTML = state.categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    const preferred = state.services.find(s => s.id === preferredServiceId);
    if (preferred) catSelect.value = String(preferred.category_id);
    fillServiceSelect(preferredServiceId);
  }

  function fillServiceSelect(preferredServiceId) {
    const categoryId = Number($('#sf-order-category').value);
    const items = state.services.filter(s => s.category_id === categoryId);
    const serviceSelect = $('#sf-order-service');
    serviceSelect.innerHTML = items.map(s => `<option value="${s.id}">#${s.id} · ${escapeHtml(s.name)} — ${money(s.rate)} / ${priceLabel(s)}</option>`).join('');
    if (preferredServiceId && items.some(s => s.id === preferredServiceId)) serviceSelect.value = String(preferredServiceId);
    onServiceChange();
  }

  function onServiceChange() {
    const service = selectedService();
    const info = $('#sf-service-info');
    const comments = service?.order_input_type === 'custom_comments';
    const email = service && ['email_delivery', 'email_invite'].includes(service.order_input_type);
    $('#sf-comments-label').hidden = !comments;
    $('#sf-quantity-label').hidden = comments;
    $('#sf-terms-label').hidden = !service?.terms_required;
    $('#sf-link-label').firstChild.textContent = email ? 'Teslimat e-posta adresi' : (service?.order_input_type === 'player_id' ? 'Oyuncu / kullanıcı kimliği' : 'Bağlantı');
    $('#sf-order-link').placeholder = email ? 'ornek@eposta.com' : 'https://...';
    if (service) {
      const qty = $('#sf-order-quantity');
      qty.min = service.min;
      qty.max = service.max;
      if (!qty.value) qty.value = service.min;
      info.hidden = false;
      info.innerHTML = `
        <div><strong>Min / Maks:</strong> ${service.min.toLocaleString('tr-TR')} / ${service.max.toLocaleString('tr-TR')}</div>
        ${service.start_time ? `<div><strong>Başlama:</strong> ${escapeHtml(service.start_time)}</div>` : ''}
        ${service.speed ? `<div><strong>Hız:</strong> ${escapeHtml(service.speed)}</div>` : ''}
        ${service.description ? `<div>${escapeHtml(service.description)}</div>` : ''}`;
    } else {
      info.hidden = true;
    }
    updateCharge();
  }

  function orderQuantity(service) {
    if (!service) return 0;
    if (service.order_input_type === 'custom_comments') {
      return $('#sf-order-comments').value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).length;
    }
    return Number($('#sf-order-quantity').value) || 0;
  }

  function updateCharge() {
    const service = selectedService();
    const qty = orderQuantity(service);
    const charge = !service || !qty ? 0
      : service.pricing_model === 'per_item' ? service.rate * qty : service.rate * qty / 1000;
    $('#sf-order-charge').textContent = money(Math.round(charge * 100) / 100);
  }

  async function submitOrder(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const errorEl = $('.sf-form-error', form);
    const button = $('#sf-order-submit');
    const service = selectedService();
    errorEl.textContent = '';
    if (!service) { errorEl.textContent = 'Bir servis seçin.'; return; }
    const body = {
      service_id: service.id,
      link: $('#sf-order-link').value.trim(),
      terms_accepted: $('#sf-order-terms').checked
    };
    if (service.order_input_type === 'custom_comments') body.comments = $('#sf-order-comments').value;
    else body.quantity = Number($('#sf-order-quantity').value);
    button.disabled = true;
    try {
      const data = await api('/orders', { method: 'POST', body: JSON.stringify(body) });
      state.customer.balance = data.balance;
      setCustomer(state.customer);
      toast(`Siparişin alındı (#${data.order.id}).`);
      $('#sf-order-link').value = '';
      $('#sf-order-comments').value = '';
      updateCharge();
    } catch (err) {
      errorEl.textContent = err.message;
      if (err.status === 401) { setCustomer(null); navigate('/'); }
    } finally {
      button.disabled = false;
    }
  }

  // ------------------------------------------------------------- siparislerim
  const STATUS = {
    pending: ['Bekliyor', 'pending'],
    processing: ['İşleniyor', 'processing'],
    completed: ['Tamamlandı', 'completed'],
    partial: ['Kısmi', 'partial'],
    canceled: ['İptal', 'canceled']
  };

  async function loadOrders() {
    const tbody = $('#sf-orders-tbody');
    try {
      const data = await api('/orders');
      if (!data.orders.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="sf-muted">Henüz siparişin yok.</td></tr>';
        return;
      }
      tbody.innerHTML = data.orders.map(o => {
        const [label, cls] = STATUS[o.status] || ['İşleniyor', 'processing'];
        const refund = o.refunded > 0 ? `<div class="sf-muted" style="font-size:.78rem;">iade ${money(o.refunded)}</div>` : '';
        const refill = o.status === 'completed' && o.refill
          ? `<button type="button" class="sf-btn sf-btn-ghost sf-btn-sm" data-refill="${o.id}">Telafi İste</button>` : '';
        return `<tr>
          <td>#${o.id}</td>
          <td>${escapeHtml(o.service_name)}</td>
          <td class="sf-link-cell" title="${escapeHtml(o.link)}">${escapeHtml(o.link)}</td>
          <td>${Number(o.quantity).toLocaleString('tr-TR')}${o.remains > 0 ? `<div class="sf-muted" style="font-size:.78rem;">kalan ${Number(o.remains).toLocaleString('tr-TR')}</div>` : ''}</td>
          <td class="sf-price">${money(o.charge)}${refund}</td>
          <td><span class="sf-badge sf-badge-${cls}">${label}</span></td>
          <td>${formatDate(o.created_at)}</td>
          <td>${refill}</td>
        </tr>`;
      }).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" class="sf-muted">${escapeHtml(err.message)}</td></tr>`;
    }
  }

  async function requestRefill(orderId, button) {
    button.disabled = true;
    try {
      const data = await api(`/orders/${orderId}/refill`, { method: 'POST' });
      toast(data.message);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      button.disabled = false;
    }
  }

  // ------------------------------------------------------------- bakiye yukle
  // Para bayinin kendi hesabina gider: havale bildirimi bayi onayiyla,
  // kart (PayTR) ve kripto (NOWPayments) saglayici onayiyla bakiyeye yazilir.
  const PAY_STATUS = {
    pending: ['Bekliyor', 'pending'],
    completed: ['Yüklendi', 'completed'],
    failed: ['Başarısız', 'canceled'],
    rejected: ['Reddedildi', 'canceled']
  };
  const METHOD_ICON = { bank: 'fa-building-columns', paytr: 'fa-credit-card', shopier: 'fa-credit-card', nowpayments: 'fa-bitcoin-sign' };
  // Shopier odeme sayfasi siteye geri yonlendirmez; musteri donunce son
  // odemesi bu anahtardan bulunup durumu sorulur.
  const PENDING_KEY = 'sf-pay-oid';
  function rememberPending(oid) { try { sessionStorage.setItem(PENDING_KEY, oid); } catch { /* gizli pencere */ } }
  function forgetPending() { try { sessionStorage.removeItem(PENDING_KEY); } catch { /* gizli pencere */ } }
  function pendingOid() { try { return sessionStorage.getItem(PENDING_KEY); } catch { return null; } }

  async function loadFunds() {
    const [methods, history] = await Promise.all([api('/payments/methods'), api('/payments/history')]);
    state.methods = methods.methods;
    if (!state.methods.some(m => m.method === state.method)) state.method = state.methods[0]?.method || null;
    renderMethodTabs();
    renderMethod();
    renderPayments(history.payments);
    watchReturn();
  }

  function renderMethodTabs() {
    const tabs = $('#sf-method-tabs');
    tabs.hidden = state.methods.length < 2;
    tabs.innerHTML = state.methods.map(m => `<button type="button" role="tab" aria-selected="${m.method === state.method}" class="${m.method === state.method ? 'active' : ''}" data-pay-method="${m.method}"><i class="fa-solid ${METHOD_ICON[m.method] || 'fa-wallet'}" aria-hidden="true"></i> ${escapeHtml(m.label)}</button>`).join('');
  }

  function amountField(m) {
    return `<label>Tutar (₺) <small>En az ${money(m.min)}, en fazla ${money(m.max)}</small><input name="amount" type="number" inputmode="decimal" min="${m.min}" max="${m.max}" step="0.01" required></label>`;
  }

  function renderMethod() {
    const box = $('#sf-method-body');
    const m = state.methods.find(x => x.method === state.method);
    if (!m) {
      const contact = [state.site?.settings?.support_email, state.site?.settings?.telegram].filter(Boolean).map(escapeHtml).join(' · ');
      box.innerHTML = `<div class="sf-empty"><i class="fa-solid fa-wallet" aria-hidden="true"></i><p>Bu sitede şu anda çevrim içi ödeme yöntemi yok.</p>${contact ? `<p class="sf-muted">Bakiye yüklemek için iletişime geç: ${contact}</p>` : ''}</div>`;
      return;
    }
    if (m.method === 'bank') {
      box.innerHTML = `
        <div class="sf-accounts">
          <h3>Hesap bilgileri</h3>
          <div class="sf-accounts-text">${escapeHtml(m.accounts)}</div>
          ${m.instructions ? `<p class="sf-muted">${escapeHtml(m.instructions)}</p>` : ''}
        </div>
        <form class="sf-form" id="sf-pay-form" data-method="bank" novalidate>
          <p class="sf-muted sf-step">Parayı yukarıdaki hesaba gönderdikten sonra bu formu doldur. Onaylanınca bakiyene eklenir.</p>
          ${amountField(m)}
          <label>Gönderdiğin hesap<input name="bank_name" maxlength="80" placeholder="Örn: Ziraat Bankası, Papara" required></label>
          <label>Gönderen adı soyadı<input name="sender_name" maxlength="120" autocomplete="name" required></label>
          <label>Not <small>(isteğe bağlı)</small><input name="note" maxlength="300"></label>
          <p class="sf-form-error" role="alert"></p>
          <button type="submit" class="sf-btn sf-btn-primary sf-btn-block">Ödeme Bildirimi Gönder</button>
        </form>`;
    } else if (m.method === 'paytr' || m.method === 'shopier') {
      box.innerHTML = `
        <form class="sf-form" id="sf-pay-form" data-method="${m.method}" novalidate>
          <p class="sf-muted sf-step">${m.method === 'shopier'
            ? 'Shopier ödeme sayfasına yönlendirileceksin. Ödemeden sonra bu sayfaya dönünce bakiyen kontrol edilip yüklenir.'
            : 'Güvenli kart ödeme sayfasına yönlendirileceksin. Ödeme onaylanınca bakiyen otomatik yüklenir.'}</p>
          ${amountField(m)}
          <p class="sf-form-error" role="alert"></p>
          <button type="submit" class="sf-btn sf-btn-primary sf-btn-block"><i class="fa-solid fa-lock" aria-hidden="true"></i> Kartla Öde</button>
        </form>`;
    } else if (m.method === 'nowpayments') {
      const coins = (m.coins || []).map(c => `<option value="${escapeHtml(c.code)}">${escapeHtml(c.label)} · ${escapeHtml(c.network)}${c.recommended ? ' (önerilen)' : ''}</option>`).join('');
      box.innerHTML = `
        <form class="sf-form" id="sf-pay-form" data-method="nowpayments" novalidate>
          <p class="sf-muted sf-step">Seçtiğin coin için ödeme adresi oluşturulur. Ödeme ağda onaylanınca bakiyen otomatik yüklenir.</p>
          ${amountField(m)}
          <label>Coin<select name="pay_currency">${coins}</select></label>
          <p class="sf-form-error" role="alert"></p>
          <button type="submit" class="sf-btn sf-btn-primary sf-btn-block">Ödeme Adresi Oluştur</button>
        </form>
        <div id="sf-crypto-box"></div>`;
    }
  }

  async function submitPayment(event) {
    event.preventDefault();
    const form = event.target;
    const method = form.dataset.method;
    const errorEl = $('.sf-form-error', form);
    const button = $('button[type=submit]', form);
    errorEl.textContent = '';
    const body = Object.fromEntries(new FormData(form).entries());
    body.amount = Number(String(body.amount || '').replace(',', '.'));
    if (!(body.amount > 0)) { errorEl.textContent = 'Yüklemek istediğin tutarı yaz.'; return; }
    button.disabled = true;
    try {
      if (method === 'bank') {
        const data = await api('/payments/bank', { method: 'POST', body: JSON.stringify(body) });
        toast(data.message);
        form.reset();
        loadPaymentHistory();
      } else if (method === 'paytr') {
        const data = await api('/payments/paytr/token', { method: 'POST', body: JSON.stringify(body) });
        location.href = data.payment_url;
        return;
      } else if (method === 'shopier') {
        const data = await api('/payments/shopier/create', { method: 'POST', body: JSON.stringify(body) });
        rememberPending(data.merchant_oid);
        location.href = data.payment_url;
        return;
      } else if (method === 'nowpayments') {
        const data = await api('/payments/nowpayments/create', { method: 'POST', body: JSON.stringify(body) });
        showCryptoBox(data);
        loadPaymentHistory();
      }
    } catch (err) {
      errorEl.textContent = err.message;
      if (err.status === 401) { setCustomer(null); navigate('/'); }
    } finally {
      button.disabled = false;
    }
  }

  function showCryptoBox(data) {
    $('#sf-crypto-box').innerHTML = `<div class="sf-crypto">
      <img src="${escapeHtml(data.qr)}" alt="Ödeme adresinin QR kodu" width="168" height="168">
      <div class="sf-crypto-info">
        <p>Tam olarak <strong>${escapeHtml(String(data.pay_amount))} ${escapeHtml(String(data.pay_currency).toUpperCase())}</strong> gönder.<br><span class="sf-muted">${escapeHtml(data.coin)} · ${money(data.amount)}</span></p>
        <div class="sf-copy"><code id="sf-crypto-address">${escapeHtml(data.pay_address)}</code><button type="button" class="sf-btn sf-btn-ghost sf-btn-sm" data-copy="#sf-crypto-address">Kopyala</button></div>
        <p class="sf-muted" id="sf-crypto-status">Ödeme bekleniyor. Bu sayfa durumu kendisi kontrol eder.</p>
      </div>
    </div>`;
    pollPayment(data.merchant_oid, 120, 15000);
  }

  function pollPayment(oid, tries, interval) {
    clearTimeout(state.payTimer);
    const tick = async left => {
      if (left <= 0 || location.pathname !== '/bakiye') return;
      try {
        const data = await api('/payments/status/' + encodeURIComponent(oid));
        const p = data.payment;
        if (p.status !== 'pending') {
          if (pendingOid() === oid) forgetPending();
          if (state.customer) { state.customer.balance = data.balance; setCustomer(state.customer); }
          const message = p.status === 'completed'
            ? `${money(p.amount)} bakiyene eklendi.`
            : `Ödeme tamamlanmadı${p.failure_reason ? ': ' + p.failure_reason : '.'}`;
          toast(message, p.status === 'completed' ? '' : 'error');
          const status = $('#sf-crypto-status');
          if (status) status.textContent = message;
          loadPaymentHistory();
          return;
        }
      } catch { /* ag hatasi: sonraki denemede tekrar bakilir */ }
      state.payTimer = setTimeout(() => tick(left - 1), interval);
    };
    tick(tries);
  }

  // Kart odemesinden donus: /bakiye?odeme=<kayit> (onay birkac saniye surebilir).
  function watchReturn() {
    const oid = new URLSearchParams(location.search).get('odeme');
    if (oid) {
      history.replaceState({}, '', '/bakiye');
      toast('Ödemen kontrol ediliyor…');
      pollPayment(oid, 20, 3000);
      return;
    }
    const shopierOid = pendingOid();
    if (shopierOid) pollPayment(shopierOid, 24, 5000);
  }

  async function loadPaymentHistory() {
    try { renderPayments((await api('/payments/history')).payments); } catch { /* liste sonra tazelenir */ }
  }

  function renderPayments(list) {
    $('#sf-payments').innerHTML = list.length ? `<ul class="sf-pay-list">${list.slice(0, 15).map(p => {
      const [label, cls] = PAY_STATUS[p.status] || PAY_STATUS.pending;
      return `<li>
        <div><strong>${money(p.amount)}</strong> <span class="sf-muted">${escapeHtml(p.method_label)}</span>
          <div class="sf-muted sf-small">${formatDate(p.created_at)}${p.failure_reason ? ' · ' + escapeHtml(p.failure_reason) : ''}</div></div>
        <span class="sf-badge sf-badge-${cls}">${label}</span></li>`;
    }).join('')}</ul>` : '<p class="sf-muted">Henüz yükleme yok.</p>';
  }

  async function copyText(selector, button) {
    const el = $(selector);
    if (!el) return;
    try {
      await navigator.clipboard.writeText(el.textContent);
      button.textContent = 'Kopyalandı';
    } catch {
      const range = document.createRange();
      range.selectNodeContents(el);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  // ------------------------------------------------------------- pencere
  function openModal(html) {
    $('#sf-modal-body').innerHTML = html;
    $('#sf-modal').hidden = false;
    document.body.classList.add('sf-modal-open');
    return $('#sf-modal-body');
  }

  function closeModal() {
    $('#sf-modal').hidden = true;
    $('#sf-modal-body').innerHTML = '';
    document.body.classList.remove('sf-modal-open');
  }

  // ------------------------------------------------------------- dijital urunler
  // Satin alma musterinin bakiyesinden yapilir; teslim edilen hesap/lisans
  // bilgileri yalnizca bu musteriye, "Dijital Siparislerim"de gosterilir.
  const DG_STATUS = {
    pending: ['Hazırlanıyor', 'processing'],
    processing: ['Hazırlanıyor', 'processing'],
    completed: ['Teslim edildi', 'completed'],
    failed: ['İade edildi', 'canceled'],
    refunded: ['İade edildi', 'canceled']
  };
  const fold = text => String(text || '').toLocaleLowerCase('tr-TR');

  function setDigitalNav(on) {
    $$('[data-digital-nav]').forEach(el => { el.hidden = !on; });
  }

  async function loadDigital() {
    const data = await api('/digital/products');
    state.digital = data.products;
    setDigitalNav(state.digital.length > 0);
    renderDigital();
  }

  function digitalCard(p) {
    const soldOut = p.stock !== null && p.stock <= 0;
    const meta = [
      p.delivery_time ? `<li><i class="fa-solid fa-bolt" aria-hidden="true"></i> ${escapeHtml(p.delivery_time)}</li>` : '',
      p.warranty_hours > 0 ? `<li><i class="fa-solid fa-shield-halved" aria-hidden="true"></i> ${p.warranty_hours} saat garanti</li>` : '',
      p.format ? `<li><i class="fa-solid fa-key" aria-hidden="true"></i> ${escapeHtml(p.format)}</li>` : ''
    ].join('');
    const stock = p.stock === null ? '' : `<span class="sf-dg-stock${soldOut ? ' is-out' : ''}">${soldOut ? 'Tükendi' : 'Stok: ' + Number(p.stock).toLocaleString('tr-TR')}</span>`;
    const media = p.image
      ? `<img src="${escapeHtml(p.image)}" alt="" loading="lazy" decoding="async" width="800" height="500">`
      : '<i class="fa-solid fa-bag-shopping" aria-hidden="true"></i>';
    return `<article class="sf-card sf-dg-card${soldOut ? ' is-sold-out' : ''}">
      <div class="sf-dg-media${p.image ? '' : ' is-empty'}">${media}${p.category ? `<span class="sf-dg-cat">${escapeHtml(p.category)}</span>` : ''}${stock}</div>
      <div class="sf-dg-body">
        <h2>${escapeHtml(p.name)}</h2>
        ${p.description ? `<p class="sf-dg-desc">${escapeHtml(p.description)}</p>` : ''}
        ${meta ? `<ul class="sf-dg-meta">${meta}</ul>` : ''}
        <div class="sf-dg-foot">
          <div><strong class="sf-price">${money(p.price)}</strong> <small class="sf-muted">/ adet</small></div>
          <button type="button" class="sf-btn sf-btn-primary sf-btn-sm" data-dg-buy="${p.id}"${soldOut ? ' disabled' : ''}>${soldOut ? 'Tükendi' : 'Satın Al'}</button>
        </div>
      </div>
    </article>`;
  }

  function renderDigital() {
    const cats = [...new Map(state.digital.filter(p => p.category).map(p => [fold(p.category), p.category])).entries()];
    if (!cats.some(([key]) => key === state.dgCategory)) state.dgCategory = '';
    const chips = $('#sf-digital-cats');
    chips.hidden = cats.length < 2;
    chips.innerHTML = [['', 'Tümü'], ...cats].map(([key, label]) => `<button type="button" class="${key === state.dgCategory ? 'active' : ''}" data-dg-cat="${escapeHtml(key)}">${escapeHtml(label)}</button>`).join('');
    const query = fold($('#sf-digital-search').value.trim());
    const list = state.digital.filter(p => (!state.dgCategory || fold(p.category) === state.dgCategory)
      && (!query || fold(`${p.name} ${p.category}`).includes(query)));
    $('#sf-digital-list').innerHTML = list.length ? list.map(digitalCard).join('')
      : `<div class="sf-card sf-empty"><i class="fa-solid fa-bag-shopping" aria-hidden="true"></i><p>${state.digital.length ? 'Aramana uygun ürün bulunamadı.' : 'Şu anda satışta dijital ürün yok.'}</p></div>`;
  }

  function openDigitalBuy(productId) {
    const p = state.digital.find(x => x.id === productId);
    if (!p) return;
    const head = `<h2 class="sf-modal-title" id="sf-modal-title">${escapeHtml(p.name)}</h2>
      <p class="sf-muted sf-modal-sub">${escapeHtml(p.category || 'Dijital ürün')} · ${money(p.price)} / adet</p>`;
    if (!state.customer) {
      openModal(`${head}
        <p>Satın almak için hesabına giriş yap. Hesabın yoksa kayıt birkaç saniye sürer.</p>
        <div class="sf-modal-actions">
          <button type="button" class="sf-btn sf-btn-primary" data-open-auth="login" data-after="/dijital">Giriş Yap</button>
          <button type="button" class="sf-btn sf-btn-ghost" data-open-auth="register" data-after="/dijital">Kayıt Ol</button>
        </div>`);
      return;
    }
    const maxQty = p.stock === null ? p.max : Math.max(0, Math.min(p.max, p.stock));
    if (maxQty < p.min) { toast('Bu ürünün stoğu yetersiz.', 'error'); return; }
    const box = openModal(`${head}
      ${p.description ? `<p class="sf-dg-full-desc">${escapeHtml(p.description)}</p>` : ''}
      ${p.format ? `<p class="sf-muted sf-small">Teslim biçimi: <strong>${escapeHtml(p.format)}</strong></p>` : ''}
      <form class="sf-form" id="sf-dg-form" novalidate>
        <label>Adet <small>(${p.min} – ${maxQty.toLocaleString('tr-TR')})</small>
          <input name="quantity" type="number" inputmode="numeric" min="${p.min}" max="${maxQty}" step="1" value="${p.min}" required></label>
        <dl class="sf-dg-sum" id="sf-dg-sum"></dl>
        <label class="sf-check"><input type="checkbox" name="consent"> Ürünün hemen teslim edilmesini istiyorum; teslimattan sonra cayma hakkımın sona ereceğini kabul ediyorum.</label>
        <p class="sf-form-error" role="alert"></p>
        <div id="sf-dg-action"></div>
      </form>`);
    const form = $('#sf-dg-form', box);
    const update = () => {
      const qty = Number.parseInt(form.quantity.value, 10) || 0;
      const total = Math.round(p.price * 100 * qty) / 100;
      const balance = Number(state.customer?.balance || 0);
      $('#sf-dg-sum', box).innerHTML = `<div><dt>Birim fiyat</dt><dd>${money(p.price)}</dd></div>
        <div><dt>Bakiyen</dt><dd>${money(balance)}</dd></div>
        <div class="is-total"><dt>Toplam</dt><dd>${money(total)}</dd></div>`;
      const action = $('#sf-dg-action', box);
      if (qty < p.min || qty > maxQty) {
        action.innerHTML = `<p class="sf-form-error">Adet ${p.min} ile ${maxQty} arasında olmalı.</p>`;
      } else if (balance < total) {
        action.innerHTML = `<a href="/bakiye" data-nav="funds" class="sf-btn sf-btn-primary sf-btn-block"><i class="fa-solid fa-wallet" aria-hidden="true"></i> Bakiye Yükle</a>
          <p class="sf-muted sf-small sf-center">Bakiyen yetersiz: ${money(total - balance)} daha gerekiyor.</p>`;
      } else {
        action.innerHTML = `<button type="submit" class="sf-btn sf-btn-primary sf-btn-block"><i class="fa-solid fa-wallet" aria-hidden="true"></i> Bakiyemle Satın Al · ${money(total)}</button>`;
      }
    };
    form.quantity.addEventListener('input', update);
    form.addEventListener('submit', event => { event.preventDefault(); buyDigital(p, form); });
    update();
  }

  async function buyDigital(p, form) {
    const errorEl = $('.sf-form-error', form);
    const button = $('button[type=submit]', form);
    errorEl.textContent = '';
    if (!form.consent.checked) { errorEl.textContent = 'Devam etmek için onay kutusunu işaretle.'; return; }
    if (button) button.disabled = true;
    try {
      const data = await api('/digital/orders', { method: 'POST', body: JSON.stringify({ product_id: p.id, quantity: Number(form.quantity.value), consent: true }) });
      state.customer.balance = data.balance;
      setCustomer(state.customer);
      if (data.order.status === 'completed') showDelivery(data.order, data.items, data.usage, true);
      else {
        openModal(`<h2 class="sf-modal-title" id="sf-modal-title">${escapeHtml(p.name)}</h2>
          <div class="sf-dg-wait"><i class="fa-solid fa-hourglass-half" aria-hidden="true"></i>
            <p><strong>Siparişin hazırlanıyor.</strong><br>Ürün birkaç dakika içinde teslim edilir; bilgiler Dijital Siparişlerim sayfasında görünür. Aynı ürünü tekrar satın alma.</p></div>
          <div class="sf-modal-actions"><a href="/dijital/siparislerim" data-nav="dorders" class="sf-btn sf-btn-primary">Siparişlerime Git</a></div>`);
      }
      loadDigital().catch(() => {});
    } catch (err) {
      errorEl.textContent = err.message;
      if (button) button.disabled = false;
      if (err.status === 401) { closeModal(); setCustomer(null); navigate('/'); }
      else refreshCustomer();
    }
  }

  function showDelivery(order, items, usage, fresh) {
    const list = Array.isArray(items) ? items : [];
    const box = openModal(`<h2 class="sf-modal-title" id="sf-modal-title">${escapeHtml(order.product_name)}</h2>
      <p class="sf-muted sf-modal-sub">#D${order.id} · ${order.quantity} adet</p>
      ${fresh ? '<p class="sf-dg-done"><i class="fa-solid fa-circle-check" aria-hidden="true"></i> Teslim edildi. Bilgilerini kopyala ya da indir; Dijital Siparişlerim sayfasından tekrar görebilirsin.</p>' : ''}
      ${list.length ? `<div class="sf-dg-items">
          <div class="sf-dg-items-head"><strong>${list.length} kayıt</strong>
            <span><button type="button" class="sf-btn sf-btn-ghost sf-btn-sm" data-dg-copy><i class="fa-solid fa-copy" aria-hidden="true"></i> Tümünü Kopyala</button>
            <button type="button" class="sf-btn sf-btn-ghost sf-btn-sm" data-dg-download><i class="fa-solid fa-download" aria-hidden="true"></i> .txt</button></span>
          </div>
          <ol>${list.map(item => `<li><code>${escapeHtml(item)}</code></li>`).join('')}</ol>
        </div>` : `<p class="sf-form-error">${escapeHtml(order.failure_reason || 'Bu sipariş için teslimat bilgisi bulunmuyor.')}</p>`}
      ${usage ? `<div class="sf-dg-usage"><strong>Kullanım talimatı</strong><p>${escapeHtml(usage)}</p></div>` : ''}
      <p class="sf-muted sf-small"><i class="fa-solid fa-lock" aria-hidden="true"></i> Bu bilgileri kimseyle paylaşma. Sorun olursa garanti süresi içinde site yöneticisine yaz.</p>`);
    $('[data-dg-copy]', box)?.addEventListener('click', async event => {
      try { await navigator.clipboard.writeText(list.join('\n')); event.currentTarget.textContent = 'Kopyalandı'; } catch { toast('Kopyalanamadı; metni seçip elle kopyala.', 'error'); }
    });
    $('[data-dg-download]', box)?.addEventListener('click', () => {
      const url = URL.createObjectURL(new Blob([list.join('\n') + '\n' + (usage ? '\n' + usage + '\n' : '')], { type: 'text/plain;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `siparis-D${order.id}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  async function openDelivery(orderId) {
    openModal('<p class="sf-muted">Yükleniyor…</p>');
    try {
      const data = await api('/digital/orders/' + orderId);
      showDelivery(data.order, data.items, data.usage, false);
    } catch (err) {
      openModal(`<p class="sf-form-error">${escapeHtml(err.message)}</p>`);
    }
  }

  async function loadDigitalOrders() {
    const tbody = $('#sf-dorders-tbody');
    try {
      const data = await api('/digital/orders');
      if (!data.orders.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="sf-muted">Henüz dijital siparişin yok.</td></tr>';
        return;
      }
      tbody.innerHTML = data.orders.map(o => {
        const [label, cls] = DG_STATUS[o.status] || DG_STATUS.processing;
        const refund = o.refunded > 0 ? `<div class="sf-muted sf-small">iade ${money(o.refunded)}</div>` : '';
        const view = o.status === 'completed' || (o.status === 'refunded' && o.item_count > 0)
          ? `<button type="button" class="sf-btn sf-btn-ghost sf-btn-sm" data-dg-view="${o.id}"><i class="fa-solid fa-key" aria-hidden="true"></i> Bilgiler</button>` : '';
        return `<tr>
          <td data-label="No">#D${o.id}</td>
          <td data-label="Ürün">${escapeHtml(o.product_name)}</td>
          <td data-label="Adet">${Number(o.quantity).toLocaleString('tr-TR')}</td>
          <td data-label="Tutar" class="sf-price"><span>${money(o.charge)}${refund}</span></td>
          <td data-label="Durum"><span class="sf-badge sf-badge-${cls}">${label}</span></td>
          <td data-label="Tarih">${formatDate(o.created_at)}</td>
          <td class="sf-rtable-action">${view}</td>
        </tr>`;
      }).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="sf-muted">${escapeHtml(err.message)}</td></tr>`;
    }
  }

  // ------------------------------------------------------------- API
  // Musteri API'si: bayi.com/api/v2 (standart SMM API v2). Anahtar Hesabim'da.
  async function loadApiCard() {
    const card = $('#sf-api-card');
    card.hidden = !state.site?.api;
    if (card.hidden) return;
    $('#sf-api-url').textContent = `${location.origin}/api/v2`;
    try {
      const data = await api('/account/api-key');
      showApiKey(data.key);
    } catch { card.hidden = true; }
  }

  function showApiKey(key) {
    $('#sf-api-key').textContent = key || 'Henüz yok';
    $('#sf-api-copy').hidden = !key;
    $('#sf-api-new').textContent = key ? 'Yeni anahtar oluştur' : 'Anahtar oluştur';
    $('#sf-api-new').dataset.hasKey = key ? '1' : '';
  }

  function newApiKey(button) {
    if (!button.dataset.hasKey) { createApiKey(button); return; }
    openModal(`<h2 class="sf-modal-title" id="sf-modal-title">Yeni API anahtarı</h2>
      <p>Yeni anahtar oluşturulunca eskisi hemen çalışmaz; kendi panelindeki anahtarı da güncellemen gerekir.</p>
      <div class="sf-modal-actions"><button type="button" class="sf-btn sf-btn-primary" id="sf-api-confirm">Yeni anahtar oluştur</button>
        <button type="button" class="sf-btn sf-btn-ghost" data-modal-close>Vazgeç</button></div>`);
    $('#sf-api-confirm').addEventListener('click', () => { closeModal(); createApiKey(button); });
  }

  async function createApiKey(button) {
    button.disabled = true;
    try {
      const data = await api('/account/api-key', { method: 'POST' });
      showApiKey(data.key);
      toast(data.message);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      button.disabled = false;
    }
  }

  const API_ACTIONS = [
    ['services', 'Servis listesi ve fiyatlar', [], '[{"service":1,"name":"Instagram Takipçi","type":"Default","category":"Instagram","rate":"11.70","min":100,"max":100000,"refill":true,"cancel":true,"dripfeed":false}]'],
    ['add', 'Sipariş ver', [['service', 'Servis ID'], ['link', 'Profil veya gönderi bağlantısı'], ['quantity', 'Miktar'], ['comments', 'Yorumlar, her satıra bir tane (yorum servislerinde)', true], ['runs', 'Tur sayısı (kademeli gönderim)', true], ['interval', 'Turlar arası dakika', true]], '{"order":23501}'],
    ['status', 'Sipariş durumu', [['order', 'Sipariş ID'], ['orders', 'Birden çok ID, virgülle (en fazla 100)', true]], '{"charge":"11.70","start_count":"3572","status":"Partial","remains":"157","currency":"TRY"}'],
    ['refill', 'Telafi iste', [['order', 'Sipariş ID'], ['orders', 'Birden çok ID, virgülle', true]], '{"refill":1}'],
    ['refill_status', 'Telafi durumu', [['refill', 'Telafi ID'], ['refills', 'Birden çok ID, virgülle', true]], '{"status":"Completed"}'],
    ['cancel', 'İptal iste', [['orders', 'Sipariş ID\'leri, virgülle']], '[{"order":9,"cancel":1}]'],
    ['balance', 'Bakiye', [], '{"balance":"100.84","currency":"TRY"}']
  ];

  function renderApiDocs() {
    const box = $('#sf-docs');
    if (!state.site?.api) {
      box.innerHTML = '<div class="sf-card sf-empty"><p>Bu sitede API kullanımı kapalı.</p></div>';
      return;
    }
    const url = `${location.origin}/api/v2`;
    const param = ([name, text, optional]) => `<tr><td><code>${name}</code></td><td>${escapeHtml(text)}${optional ? ' <span class="sf-muted">(isteğe bağlı)</span>' : ''}</td></tr>`;
    box.innerHTML = `<div class="sf-card sf-docs-intro">
        <dl class="sf-dl">
          <dt>Adres</dt><dd><code>${escapeHtml(url)}</code></dd>
          <dt>Yöntem</dt><dd>POST · JSON veya form verisi</dd>
          <dt>Anahtar</dt><dd>${state.customer ? '<a href="/account" data-nav="account">Hesabım</a> sayfasından' : 'Giriş yaptıktan sonra Hesabım sayfasından'} alınır.</dd>
          <dt>Yanıt</dt><dd>JSON. Hata olursa <code>{"error": "..."}</code> döner. Tutarlar TL'dir.</dd>
        </dl>
        <pre><code>curl -X POST ${escapeHtml(url)} -d key=ANAHTARIN -d action=balance</code></pre>
      </div>
      ${API_ACTIONS.map(([action, title, params, example]) => `<div class="sf-card sf-docs-action">
        <h2>${escapeHtml(title)} <code>action=${action}</code></h2>
        <div class="sf-table-wrap"><table class="sf-table"><thead><tr><th>Parametre</th><th>Açıklama</th></tr></thead><tbody>
          ${param(['key', 'API anahtarın'])}${param(['action', action])}${params.map(param).join('')}
        </tbody></table></div>
        <p class="sf-muted sf-small">Örnek yanıt</p>
        <pre><code>${escapeHtml(example)}</code></pre>
      </div>`).join('')}`;
  }

  // ------------------------------------------------------------- blog ve satis sayfalari (Pro)
  function trDay(value) {
    const date = new Date(String(value || '').replace(' ', 'T') + 'Z');
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  async function loadBlog() {
    const box = $('#sf-blog-list');
    try {
      const data = await api('/blog');
      box.innerHTML = data.posts.length ? data.posts.map(p => `<a class="sf-card sf-blog-card" href="/blog/${encodeURIComponent(p.slug)}" data-nav="post">${p.cover_url ? `<img src="${escapeHtml(p.cover_url)}" alt="" loading="lazy">` : ''}<span><b>${escapeHtml(p.title)}</b><small>${escapeHtml(trDay(p.published_at))}</small><em>${escapeHtml(p.excerpt)}</em></span></a>`).join('')
        : '<p class="sf-muted">Henüz yazı yok.</p>';
    } catch (err) {
      box.innerHTML = `<p class="sf-muted">${escapeHtml(err.message)}</p>`;
    }
  }

  async function loadPost(path) {
    const box = $('#sf-post');
    const cta = $('#sf-post-cta');
    cta.innerHTML = '';
    const [, kind, slug] = path.match(/^\/(blog|hizmet)\/([^/]+)/) || [];
    try {
      const data = await api(`/${kind}/${encodeURIComponent(decodeURIComponent(slug))}`);
      const post = data.post || data.page;
      document.title = `${post.title} · ${state.site?.name || ''}`;
      box.innerHTML = `<h1>${escapeHtml(post.title)}</h1>${kind === 'blog' ? `<p class="sf-muted sf-post-date">${escapeHtml(trDay(post.published_at))}</p>` : ''}${post.cover_url ? `<img class="sf-post-cover" src="${escapeHtml(post.cover_url)}" alt="">` : ''}${formatLegal(post.body)}`;
      const s = data.service;
      if (s) {
        cta.innerHTML = `<div class="sf-card sf-cta-box"><div><b>${escapeHtml(s.name)}</b><span class="sf-muted">${money(s.rate)} / ${s.pricing_model === 'per_item' ? 'adet' : '1000 adet'} · en az ${Number(s.min).toLocaleString('tr-TR')}</span></div>
          <button type="button" class="sf-btn sf-btn-primary sf-btn-lg" data-order-service="${s.id}">Sipariş ver</button></div>`;
      }
    } catch (err) {
      box.innerHTML = `<h1>Bulunamadı</h1><p class="sf-muted">${escapeHtml(err.message)}</p>`;
    }
  }

  // ------------------------------------------------------------- yasal sayfalar
  // Duz metin: "## " baslik, "- " madde, bos satir paragraf. Once kacis, sonra bicim.
  function formatLegal(text) {
    return String(text || '').split(/\n{2,}/).map(block => {
      const out = [];
      let list = [];
      let para = [];
      const flushList = () => { if (list.length) { out.push(`<ul>${list.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`); list = []; } };
      const flushPara = () => { if (para.length) { out.push(`<p>${para.map(escapeHtml).join('<br>')}</p>`); para = []; } };
      block.split('\n').map(line => line.trim()).filter(Boolean).forEach(line => {
        if (line.startsWith('### ')) { flushPara(); flushList(); out.push(`<h3>${escapeHtml(line.slice(4))}</h3>`); }
        else if (line.startsWith('## ')) { flushPara(); flushList(); out.push(`<h2>${escapeHtml(line.slice(3))}</h2>`); }
        else if (line.startsWith('- ')) { flushPara(); list.push(line.slice(2)); }
        else { flushList(); para.push(line); }
      });
      flushPara();
      flushList();
      return out.join('');
    }).join('');
  }

  async function loadPage(slug) {
    const box = $('#sf-legal');
    box.innerHTML = '<p class="sf-muted">Yükleniyor…</p>';
    try {
      const page = await api('/pages/' + encodeURIComponent(slug));
      document.title = `${page.title} · ${state.site?.name || ''}`;
      box.innerHTML = `<h1>${escapeHtml(page.title)}</h1>${formatLegal(page.body)}`;
    } catch (err) {
      box.innerHTML = `<p class="sf-muted">${escapeHtml(err.message)}</p>`;
    }
  }

  async function loadFooterLinks() {
    const landing = state.site?.landing_pages || [];
    $('#sf-footer-landing-links').innerHTML = landing.map(p => `<a href="/hizmet/${encodeURIComponent(p.slug)}" data-nav="post">${escapeHtml(p.title)}</a>`).join('');
    $('#sf-footer-landing').hidden = !landing.length;
    try {
      const data = await api('/pages');
      $('#sf-footer-links').innerHTML = data.pages.map(p => `<a href="/sayfa/${encodeURIComponent(p.slug)}" data-nav="page">${escapeHtml(p.title)}</a>`).join('');
    } catch { /* alt bilgi bagintisiz da calisir */ }
  }

  // ------------------------------------------------------------- yonlendirme
  async function showView(view) {
    if (USER_VIEWS.has(view) && !state.customer) view = 'home';
    if (view === 'home' && state.customer) view = 'order';
    $$('.sf-view').forEach(section => { section.hidden = section.dataset.view !== view; });
    const navKey = view === 'dorders' ? 'digital' : (view === 'post' && location.pathname.startsWith('/blog') ? 'blog' : view);
    $$('.sf-nav a').forEach(link => link.classList.toggle('active', link.dataset.nav === navKey));
    closeModal();
    window.scrollTo(0, 0);
    if (view !== 'page' && state.site) document.title = state.site.name;
    if (view !== 'funds') clearTimeout(state.payTimer);
    try {
      if (view === 'funds') await loadFunds();
      if (view === 'page') await loadPage(decodeURIComponent(location.pathname.slice('/sayfa/'.length)));
      if (view === 'blog') await loadBlog();
      if (view === 'post') await loadPost(location.pathname);
      if (view === 'home') await renderHome();
      if (view === 'services') { await loadServices(); renderServices(); }
      if (view === 'order') {
        await loadServices();
        if (!$('#sf-order-category').options.length) fillCategorySelect(state.pendingServiceId || null);
        else if (state.pendingServiceId) fillCategorySelect(state.pendingServiceId);
        state.pendingServiceId = null;
      }
      if (view === 'orders') await loadOrders();
      if (view === 'digital') await loadDigital();
      if (view === 'dorders') await loadDigitalOrders();
      if (view === 'account') { await refreshCustomer(); await loadApiCard(); }
      if (view === 'apidocs') renderApiDocs();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function navigate(path) {
    if (location.pathname !== path) history.pushState({}, '', path);
    showView(routeOf(path));
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const platformCard = event.target.closest('[data-platform]');
      if (platformCard) {
        event.preventDefault();
        state.platformKey = platformCard.dataset.platform;
        $('#sf-service-search').value = PLATFORMS.find(p => p.key === state.platformKey)?.label || '';
        navigate('/services');
        return;
      }
      const nav = event.target.closest('[data-nav]');
      if (nav && nav.getAttribute('href')) {
        event.preventDefault();
        navigate(nav.getAttribute('href'));
        return;
      }
      const openAuth = event.target.closest('[data-open-auth]');
      if (openAuth) {
        state.afterAuth = openAuth.dataset.after || null;
        navigate('/');
        showAuthTab(openAuth.dataset.openAuth);
        $('#sf-auth-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      const tab = event.target.closest('[data-auth-tab]');
      if (tab) { showAuthTab(tab.dataset.authTab); return; }
      const orderBtn = event.target.closest('[data-order-service]');
      if (orderBtn) {
        state.pendingServiceId = Number(orderBtn.dataset.orderService);
        navigate('/order');
        return;
      }
      const refillBtn = event.target.closest('[data-refill]');
      if (refillBtn) { requestRefill(Number(refillBtn.dataset.refill), refillBtn); return; }
      const buyBtn = event.target.closest('[data-dg-buy]');
      if (buyBtn) { openDigitalBuy(Number(buyBtn.dataset.dgBuy)); return; }
      const catBtn = event.target.closest('[data-dg-cat]');
      if (catBtn) { state.dgCategory = catBtn.dataset.dgCat; renderDigital(); return; }
      const viewBtn = event.target.closest('[data-dg-view]');
      if (viewBtn) { openDelivery(Number(viewBtn.dataset.dgView)); return; }
      if (event.target.closest('[data-modal-close]') || event.target.id === 'sf-modal') { closeModal(); return; }
      const payTab = event.target.closest('[data-pay-method]');
      if (payTab) { state.method = payTab.dataset.payMethod; renderMethodTabs(); renderMethod(); return; }
      const copy = event.target.closest('[data-copy]');
      if (copy) copyText(copy.dataset.copy, copy);
    });
    // Odeme formu her yontem seciminde yeniden cizilir; olay belgeden dinlenir.
    document.addEventListener('submit', event => {
      if (event.target.id === 'sf-pay-form') submitPayment(event);
    });
    $('#sf-login-form').addEventListener('submit', event => submitAuth(event, 'login'));
    $('#sf-register-form').addEventListener('submit', event => submitAuth(event, 'register'));
    $('#sf-forgot-form').addEventListener('submit', submitForgot);
    $('#sf-reset-form').addEventListener('submit', submitReset);
    $('#sf-logout').addEventListener('click', logout);
    // Elle yazilan arama platform suzgecini birakir.
    $('#sf-service-search').addEventListener('input', () => { state.platformKey = null; renderServices(); });
    $('#sf-order-category').addEventListener('change', () => fillServiceSelect(null));
    $('#sf-order-service').addEventListener('change', () => { $('#sf-order-quantity').value = ''; onServiceChange(); });
    $('#sf-order-quantity').addEventListener('input', updateCharge);
    $('#sf-order-comments').addEventListener('input', updateCharge);
    $('#sf-order-form').addEventListener('submit', submitOrder);
    $('#sf-orders-refresh').addEventListener('click', loadOrders);
    $('#sf-digital-search').addEventListener('input', renderDigital);
    $('#sf-api-new').addEventListener('click', event => newApiKey(event.currentTarget));
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('#sf-modal').hidden) closeModal(); });
    window.addEventListener('popstate', () => showView(routeOf(location.pathname)));
  }

  async function init() {
    $('#sf-year').textContent = String(new Date().getFullYear());
    bindEvents();
    try {
      const site = await api('/site');
      state.site = site;
      setCustomer(site.customer);
      setDigitalNav(Boolean(site.digital));
      $$('[data-blog-nav]').forEach(el => { el.hidden = !site.blog; });
      const note = site.settings?.announcement;
      if (note) { const bar = $('#sf-announcement'); bar.textContent = note; bar.hidden = false; }
      $$('[data-api-nav]').forEach(el => { el.hidden = !site.api; });
      const contact = [site.settings?.support_email, site.settings?.telegram].filter(Boolean).map(escapeHtml).join(' · ');
      if (contact) {
        $('#sf-contact').innerHTML = `İletişim: ${contact}`;
        $('#sf-footer-contact').innerHTML = `<i class="fa-solid fa-headset" aria-hidden="true"></i> ${contact}`;
        $('#sf-footer-contact').hidden = false;
      }
    } catch {
      setCustomer(null);
    }
    loadFooterLinks();
    showView(routeOf(location.pathname));
  }

  init();
})();
