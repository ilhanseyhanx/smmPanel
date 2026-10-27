// Bayi vitrini: tek sayfa uygulamasi. Sunucu tum adreslere ayni HTML'i verir;
// gorunum adres cubugundaki yola gore secilir.
(function () {
  'use strict';

  const state = { site: null, customer: null, categories: [], services: [], servicesLoaded: false, methods: [], method: null, payTimer: null };
  const USER_VIEWS = new Set(['order', 'orders', 'account', 'funds']);
  const ROUTES = { '/': 'home', '/services': 'services', '/order': 'order', '/orders': 'orders', '/account': 'account', '/bakiye': 'funds' };

  // Yasal sayfalar /sayfa/<slug> adresinde acilir.
  function routeOf(path) {
    return path.startsWith('/sayfa/') ? 'page' : (ROUTES[path] || 'home');
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
    $$('[data-auth-tab]').forEach(btn => btn.classList.toggle('active', btn.dataset.authTab === tab));
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
      navigate('/order');
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

  function renderServices() {
    const box = $('#sf-services-list');
    const query = ($('#sf-service-search').value || '').trim().toLocaleLowerCase('tr-TR');
    const matches = service => !query || service.name.toLocaleLowerCase('tr-TR').includes(query);
    const html = state.categories.map(category => {
      const items = state.services.filter(s => s.category_id === category.id && matches(s));
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
  const METHOD_ICON = { bank: 'fa-building-columns', paytr: 'fa-credit-card', nowpayments: 'fa-bitcoin-sign' };

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
    } else if (m.method === 'paytr') {
      box.innerHTML = `
        <form class="sf-form" id="sf-pay-form" data-method="paytr" novalidate>
          <p class="sf-muted sf-step">Güvenli kart ödeme sayfasına yönlendirileceksin. Ödeme onaylanınca bakiyen otomatik yüklenir.</p>
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
    if (!oid) return;
    history.replaceState({}, '', '/bakiye');
    toast('Ödemen kontrol ediliyor…');
    pollPayment(oid, 20, 3000);
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
        if (line.startsWith('## ')) { flushPara(); flushList(); out.push(`<h2>${escapeHtml(line.slice(3))}</h2>`); }
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
    $$('.sf-nav a').forEach(link => link.classList.toggle('active', link.dataset.nav === view));
    window.scrollTo(0, 0);
    if (view !== 'page' && state.site) document.title = state.site.name;
    if (view !== 'funds') clearTimeout(state.payTimer);
    try {
      if (view === 'funds') await loadFunds();
      if (view === 'page') await loadPage(decodeURIComponent(location.pathname.slice('/sayfa/'.length)));
      if (view === 'services') { await loadServices(); renderServices(); }
      if (view === 'order') {
        await loadServices();
        if (!$('#sf-order-category').options.length) fillCategorySelect(state.pendingServiceId || null);
        else if (state.pendingServiceId) fillCategorySelect(state.pendingServiceId);
        state.pendingServiceId = null;
      }
      if (view === 'orders') await loadOrders();
      if (view === 'account') await refreshCustomer();
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
      const nav = event.target.closest('[data-nav]');
      if (nav && nav.getAttribute('href')) {
        event.preventDefault();
        navigate(nav.getAttribute('href'));
        return;
      }
      const openAuth = event.target.closest('[data-open-auth]');
      if (openAuth) {
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
    $('#sf-logout').addEventListener('click', logout);
    $('#sf-service-search').addEventListener('input', renderServices);
    $('#sf-order-category').addEventListener('change', () => fillServiceSelect(null));
    $('#sf-order-service').addEventListener('change', () => { $('#sf-order-quantity').value = ''; onServiceChange(); });
    $('#sf-order-quantity').addEventListener('input', updateCharge);
    $('#sf-order-comments').addEventListener('input', updateCharge);
    $('#sf-order-form').addEventListener('submit', submitOrder);
    $('#sf-orders-refresh').addEventListener('click', loadOrders);
    window.addEventListener('popstate', () => showView(routeOf(location.pathname)));
  }

  async function init() {
    $('#sf-year').textContent = String(new Date().getFullYear());
    bindEvents();
    try {
      const site = await api('/site');
      state.site = site;
      setCustomer(site.customer);
      const note = site.settings?.announcement;
      if (note) { const bar = $('#sf-announcement'); bar.textContent = note; bar.hidden = false; }
      const contact = [site.settings?.support_email, site.settings?.telegram].filter(Boolean).map(escapeHtml).join(' · ');
      if (contact) $('#sf-contact').innerHTML = `İletişim: ${contact}`;
    } catch {
      setCustomer(null);
    }
    loadFooterLinks();
    showView(routeOf(location.pathname));
  }

  init();
})();
