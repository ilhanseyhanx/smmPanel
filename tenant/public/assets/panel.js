// Bayi yonetim paneli (bayi.com/admin): tek sayfa uygulamasi.
// Sunucu /admin ve alt adreslerine ayni HTML'i verir; gorunum yola gore secilir.
(function () {
  'use strict';

  const VIEWS = {
    dashboard: { path: '/admin', title: 'Özet' },
    services: { path: '/admin/services', title: 'Servisler & Fiyatlar' },
    customers: { path: '/admin/customers', title: 'Müşteriler' },
    orders: { path: '/admin/orders', title: 'Siparişler' },
    site: { path: '/admin/site', title: 'Site Ayarları' },
    logs: { path: '/admin/logs', title: 'Kayıtlar' }
  };
  const STATUS = {
    pending: ['Bekliyor', 'pending'],
    processing: ['İşleniyor', 'processing'],
    completed: ['Tamamlandı', 'completed'],
    partial: ['Kısmi', 'partial'],
    canceled: ['İptal', 'canceled']
  };
  const state = { me: null, services: null, selected: new Set(), orderPage: 1, logTab: 'activity', logs: null };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }
  function money(value) {
    return '₺' + Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function num(value) {
    return Number(value || 0).toLocaleString('tr-TR');
  }
  function formatDate(value) {
    if (!value) return '—';
    const text = String(value);
    const date = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(text) ? new Date(text.replace(' ', 'T') + 'Z') : new Date(text);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
  }
  function statusBadge(status) {
    const [label, cls] = STATUS[status] || ['İşleniyor', 'processing'];
    return `<span class="sf-badge sf-badge-${cls}">${label}</span>`;
  }
  function profitCell(value) {
    return `<span class="${value >= 0 ? 'pn-profit-pos' : 'pn-profit-neg'}">${money(value)}</span>`;
  }
  function debounce(fn, ms) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
  }

  let toastTimer;
  function toast(message, type) {
    const el = $('#sf-toast');
    el.textContent = message;
    el.className = 'sf-toast show' + (type === 'error' ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'sf-toast'; }, 3500);
  }

  async function api(path, options = {}) {
    const res = await fetch('/api/panel' + path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    const data = (res.headers.get('content-type') || '').includes('application/json') ? await res.json() : {};
    if (!res.ok) {
      const err = new Error(data.error || 'İşlem tamamlanamadı.');
      err.status = res.status;
      err.code = data.code;
      err.field = data.field;
      if (res.status === 401 && data.code !== 'TWO_FACTOR_REQUIRED' && path !== '/login') showLogin();
      throw err;
    }
    return data;
  }

  // ------------------------------------------------------------- pencere
  function openModal(title, html, { wide = false } = {}) {
    $('#pn-modal')._resolve = null;
    $('#pn-modal-title').textContent = title;
    $('#pn-modal-body').innerHTML = html;
    $('.pn-modal-box').classList.toggle('wide', wide);
    $('#pn-modal').hidden = false;
    const first = $('#pn-modal-body input, #pn-modal-body select, #pn-modal-body textarea');
    if (first) first.focus();
  }
  function closeModal() {
    $('#pn-modal').hidden = true;
    $('#pn-modal-body').innerHTML = '';
  }

  // Tutar + not soran kucuk form: Promise<{amount, note}|null>
  function askAmount(title, message) {
    return new Promise(resolve => {
      openModal(title, `
        <form class="sf-form" id="pn-amount-form" novalidate>
          <p class="sf-muted" style="margin:0;">${escapeHtml(message)}</p>
          <label>Tutar (₺)<input name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" class="sf-input" required></label>
          <label>Not <small>(isteğe bağlı, bakiye hareketlerinde görünür)</small><input name="note" class="sf-input" maxlength="300" placeholder="Örn: havale ile yükleme"></label>
          <p class="sf-form-error" role="alert"></p>
          <button type="submit" class="sf-btn sf-btn-primary">Onayla</button>
        </form>`);
      const form = $('#pn-amount-form');
      form.addEventListener('submit', event => {
        event.preventDefault();
        const amount = Number(form.amount.value);
        if (!(amount > 0)) { $('.sf-form-error', form).textContent = 'Sıfırdan büyük bir tutar girin.'; return; }
        const note = form.note.value.trim();
        closeModal();
        resolve({ amount, note });
      });
      $('#pn-modal')._resolve = () => resolve(null);
    });
  }

  function confirmBox(title, message, confirmText = 'Onayla') {
    return new Promise(resolve => {
      openModal(title, `
        <p style="margin:0 0 16px;">${escapeHtml(message)}</p>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button type="button" class="sf-btn sf-btn-ghost" data-modal-close>Vazgeç</button>
          <button type="button" class="sf-btn sf-btn-primary" id="pn-confirm-yes">${escapeHtml(confirmText)}</button>
        </div>`);
      $('#pn-confirm-yes').addEventListener('click', () => { closeModal(); resolve(true); });
      $('#pn-modal')._resolve = () => resolve(false);
    });
  }

  // ------------------------------------------------------------- giris
  function showLogin() {
    $('#pn-app').hidden = true;
    $('#pn-login').hidden = false;
  }

  async function submitLogin(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const errorEl = $('.sf-form-error', form);
    const button = $('button[type=submit]', form);
    errorEl.textContent = '';
    button.disabled = true;
    try {
      const body = { username: form.username.value.trim(), password: form.password.value };
      if (!$('#pn-totp-label').hidden && form.totp.value.trim()) body.totp = form.totp.value.trim();
      await api('/login', { method: 'POST', body: JSON.stringify(body) });
      form.reset();
      $('#pn-totp-label').hidden = true;
      await start();
    } catch (err) {
      if (err.code === 'TWO_FACTOR_REQUIRED') {
        $('#pn-totp-label').hidden = false;
        form.totp.focus();
      }
      errorEl.textContent = err.message;
    } finally {
      button.disabled = false;
    }
  }

  async function logout() {
    await api('/logout', { method: 'POST' }).catch(() => {});
    showLogin();
  }

  async function loadMe() {
    const me = await api('/me');
    state.me = me;
    const balance = $('#pn-balance');
    $('#pn-balance-value').textContent = money(me.owner.balance);
    balance.classList.toggle('low', me.owner.balance < 50);
    $('#pn-owner').textContent = me.owner.username;
    const topup = $('#pn-topup');
    if (me.top_up_url) { topup.href = me.top_up_url; topup.hidden = false; }
    const alert = $('#pn-status-alert');
    if (me.tenant.status !== 'active') {
      alert.hidden = false;
      alert.textContent = me.tenant.status === 'suspended'
        ? `Siteniz askıya alındı; müşteriler şu an sipariş veremez.${me.tenant.status_reason ? ' Sebep: ' + me.tenant.status_reason : ''}`
        : 'Siteniz uyku modunda; müşteriler şu an siteyi göremez.';
    } else {
      alert.hidden = true;
    }
    return me;
  }

  // ------------------------------------------------------------- ozet
  async function loadDashboard() {
    const d = await api('/dashboard');
    const kpi = (label, value, sub, cls = '') => `<div class="pn-kpi ${cls}"><div class="pn-kpi-label">${label}</div><div class="pn-kpi-value">${value}</div><div class="pn-kpi-sub">${sub}</div></div>`;
    $('#pn-kpis').innerHTML = [
      kpi('Bugün', money(d.today.revenue), `${d.today.orders} sipariş · kâr ${money(d.today.profit)}`),
      kpi('Son 30 Gün Ciro', money(d.last_30d.revenue), `${d.last_30d.orders} sipariş`),
      kpi('Son 30 Gün Kâr', money(d.last_30d.profit), `maliyet ${money(d.last_30d.cost)}`, 'pn-kpi-profit'),
      kpi('Toplam Kâr', money(d.totals.profit), `${num(d.totals.orders)} sipariş · ${d.totals.active} aktif`, 'pn-kpi-profit'),
      kpi('Müşteriler', num(d.customers.total), `${d.customers.new_30d} yeni (30g)`),
      kpi('Müşteri Bakiyeleri', money(d.customers.balance), 'müşterilerinizin sitenizdeki toplam bakiyesi'),
      kpi('Bakiyeniz', money(d.owner_balance), 'sipariş maliyetleri buradan düşer')
    ].join('');
    const warn = $('#pn-balance-alert');
    if (d.failed_for_balance_7d > 0 || d.owner_balance < 50) {
      warn.hidden = false;
      warn.textContent = d.failed_for_balance_7d > 0
        ? `Son 7 günde bakiyeniz yetmediği için ${d.failed_for_balance_7d} sipariş alınamadı. Kayıp yaşamamak için bakiye yükleyin.`
        : 'Bakiyeniz azaldı. Bakiye bittiğinde müşterileriniz sipariş veremez.';
    } else {
      warn.hidden = true;
    }
    $('#pn-recent').innerHTML = d.recent_orders.length ? d.recent_orders.map(o => `<tr>
      <td>#${o.id}</td><td>${escapeHtml(o.customer || '—')}</td><td>${escapeHtml(o.service_name)}</td>
      <td class="pn-num">${money(o.charge)}</td><td>${statusBadge(o.status)}</td><td>${formatDate(o.created_at)}</td></tr>`).join('')
      : '<tr><td colspan="6" class="sf-muted">Henüz sipariş yok.</td></tr>';
    const me = state.me;
    const addresses = [];
    if (me.tenant.subdomain) addresses.push(`<li><a href="https://${escapeHtml(me.tenant.subdomain)}" target="_blank" rel="noopener">${escapeHtml(me.tenant.subdomain)}</a><span class="sf-badge sf-badge-completed">Aktif</span></li>`);
    for (const d2 of me.tenant.domains) {
      const active = d2.status === 'active';
      addresses.push(`<li><span>${escapeHtml(d2.domain)}</span><span class="sf-badge sf-badge-${active ? 'completed' : 'pending'}">${active ? 'Aktif' : 'Bekliyor'}</span></li>`);
    }
    $('#pn-addresses').innerHTML = addresses.join('') || '<li class="sf-muted">Henüz adres yok.</li>';
    $('#pn-pricing-summary').textContent = `Alış indiriminiz %${me.tenant.discount_percent}, varsayılan kârınız %${me.tenant.default_markup_percent}. Özel ayar yapmadığınız servisler bu oranla satılır.`;
  }

  // ------------------------------------------------------------- servisler
  async function loadServices(force = false) {
    if (!state.services || force) state.services = await api('/services');
    const data = state.services;
    $('#pn-default-markup').value = data.default_markup_percent;
    const cat = $('#pn-svc-category');
    const current = cat.value;
    cat.innerHTML = '<option value="">Tüm kategoriler</option>' + data.categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    cat.value = current;
    renderServices();
  }

  function unitLabel(s) {
    return s.pricing_model === 'per_item' ? '/ adet' : '/ 1000';
  }

  function filteredServices() {
    const data = state.services;
    if (!data) return [];
    const category = $('#pn-svc-category').value;
    const filter = $('#pn-svc-filter').value;
    const q = $('#pn-svc-search').value.trim().toLocaleLowerCase('tr-TR');
    return data.services.filter(s => {
      if (category && String(s.category_id) !== category) return false;
      if (filter === 'custom' && s.markup_percent === null && s.fixed_price === null && !s.custom_name && s.enabled) return false;
      if (filter === 'hidden' && s.visible) return false;
      if (filter === 'below' && !s.below_cost) return false;
      if (q && !`${s.id} ${s.name} ${s.custom_name || ''}`.toLocaleLowerCase('tr-TR').includes(q)) return false;
      return true;
    });
  }

  function renderServices() {
    const rows = filteredServices();
    const visibleRows = rows.slice(0, 400);
    $('#pn-services').innerHTML = visibleRows.length ? visibleRows.map(s => {
      const profit = s.price - s.cost;
      let status;
      if (s.below_cost) status = '<span class="sf-badge sf-badge-canceled">Zararına · gizli</span>';
      else if (!s.enabled) status = '<span class="sf-badge sf-badge-pending">Satışta değil</span>';
      else status = '<span class="sf-badge sf-badge-completed">Satışta</span>';
      const mode = s.mode === 'fixed' ? 'sabit fiyat' : (s.markup_percent === null ? `varsayılan %${s.effective_markup_percent}` : `özel %${s.markup_percent}`);
      return `<tr>
        <td><input type="checkbox" data-svc-check="${s.id}" ${state.selected.has(s.id) ? 'checked' : ''} aria-label="Seç"></td>
        <td>#${s.id}</td>
        <td><strong>${escapeHtml(s.custom_name || s.name)}</strong>${s.custom_name ? `<span class="pn-sub">${escapeHtml(s.name)}</span>` : ''}<span class="pn-sub">${num(s.min)} - ${num(s.max)}${s.refill ? ' · garantili' : ''}</span></td>
        <td class="pn-num">${money(s.cost)} <span class="pn-sub">${unitLabel(s)}</span></td>
        <td class="pn-num">${money(s.price)} <span class="pn-sub">${mode}</span></td>
        <td>${profitCell(profit)}</td>
        <td>${status}</td>
        <td><button type="button" class="sf-btn sf-btn-ghost sf-btn-sm" data-svc-edit="${s.id}">Düzenle</button></td>
      </tr>`;
    }).join('') : '<tr><td colspan="8" class="sf-muted">Filtreye uyan servis yok.</td></tr>';
    $('#pn-svc-count').textContent = rows.length > visibleRows.length
      ? `${rows.length} servisten ilk ${visibleRows.length} tanesi gösteriliyor; kategori seçerek veya arayarak daraltın.`
      : `${rows.length} servis`;
    $('#pn-svc-all').checked = visibleRows.length > 0 && visibleRows.every(s => state.selected.has(s.id));
    renderBulk();
  }

  function renderBulk() {
    $('#pn-bulk').hidden = state.selected.size === 0;
    $('#pn-bulk-count').textContent = `${state.selected.size} seçili`;
  }

  function editService(id) {
    const s = state.services.services.find(x => x.id === id);
    if (!s) return;
    const mode = s.fixed_price !== null ? 'fixed' : (s.markup_percent !== null ? 'markup' : 'default');
    openModal(`#${s.id} · ${s.name}`, `
      <form class="sf-form" id="pn-svc-form" novalidate>
        <div class="pn-preview">Maliyetiniz: <strong>${money(s.cost)}</strong> ${unitLabel(s)}</div>
        <label>Sitede görünecek ad <small>(boş bırakırsanız orijinal ad)</small><input name="custom_name" class="sf-input" maxlength="160" value="${escapeHtml(s.custom_name || '')}" placeholder="${escapeHtml(s.name)}"></label>
        <div class="pn-radio-group">
          <label class="pn-radio"><input type="radio" name="mode" value="default" ${mode === 'default' ? 'checked' : ''}> Varsayılan kâr (%${state.services.default_markup_percent})</label>
          <label class="pn-radio"><input type="radio" name="mode" value="markup" ${mode === 'markup' ? 'checked' : ''}> Bu servise özel kâr oranı</label>
          <label class="pn-radio"><input type="radio" name="mode" value="fixed" ${mode === 'fixed' ? 'checked' : ''}> Sabit satış fiyatı</label>
        </div>
        <label id="pn-svc-markup-label">Kâr oranı (%)<input name="markup" type="number" min="0" max="1000" step="0.1" class="sf-input" value="${s.markup_percent ?? state.services.default_markup_percent}"></label>
        <label id="pn-svc-fixed-label">Satış fiyatı (₺ ${unitLabel(s)})<input name="fixed" type="number" min="0" step="0.01" class="sf-input" value="${s.fixed_price ?? s.price}"></label>
        <label class="pn-radio"><input type="checkbox" name="enabled" ${s.enabled ? 'checked' : ''}> Sitede satışta</label>
        <div class="pn-preview" id="pn-svc-preview"></div>
        <p class="sf-form-error" role="alert"></p>
        <button type="submit" class="sf-btn sf-btn-primary">Kaydet</button>
      </form>`);
    const form = $('#pn-svc-form');
    const update = () => {
      const m = form.mode.value;
      $('#pn-svc-markup-label').hidden = m !== 'markup';
      $('#pn-svc-fixed-label').hidden = m !== 'fixed';
      let price;
      if (m === 'fixed') price = Number(form.fixed.value) || 0;
      else price = Math.ceil(s.cost * 100 * (100 + (m === 'markup' ? Number(form.markup.value) || 0 : state.services.default_markup_percent)) / 100) / 100;
      const profit = price - s.cost;
      $('#pn-svc-preview').innerHTML = `Müşterinin göreceği fiyat: <strong>${money(price)}</strong> ${unitLabel(s)} · kârınız <span class="${profit >= 0 ? 'pn-profit-pos' : 'pn-profit-neg'}">${money(profit)}</span>`;
    };
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    update();
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const m = form.mode.value;
      const body = {
        enabled: form.enabled.checked,
        custom_name: form.custom_name.value.trim() || null,
        markup_percent: m === 'markup' ? Number(form.markup.value) : null,
        fixed_price: m === 'fixed' ? Number(form.fixed.value) : null
      };
      try {
        const res = await api(`/services/${s.id}`, { method: 'PUT', body: JSON.stringify(body) });
        closeModal();
        toast(res.message);
        await loadServices(true);
      } catch (err) {
        $('.sf-form-error', form).textContent = err.message;
      }
    });
  }

  async function bulkAction(action) {
    const ids = [...state.selected];
    if (!ids.length) return;
    const body = { service_ids: ids, action };
    if (action === 'markup') {
      const value = await new Promise(resolve => {
        openModal('Kâr oranı uygula', `
          <form class="sf-form" id="pn-bulk-form" novalidate>
            <p class="sf-muted" style="margin:0;">Seçili ${ids.length} servise bu kâr oranı uygulanır (sabit fiyatlar kaldırılır).</p>
            <label>Kâr oranı (%)<input name="markup" type="number" min="0" max="1000" step="0.1" class="sf-input" required></label>
            <button type="submit" class="sf-btn sf-btn-primary">Uygula</button>
          </form>`);
        $('#pn-bulk-form').addEventListener('submit', event => {
          event.preventDefault();
          const v = Number(event.currentTarget.markup.value);
          if (!(v >= 0)) return;
          closeModal();
          resolve(v);
        });
        $('#pn-modal')._resolve = () => resolve(null);
      });
      if (value === null) return;
      body.markup_percent = value;
    } else {
      const labels = { enable: 'satışa açılacak', disable: 'satıştan kaldırılacak', reset: 'varsayılan ayara döndürülecek (özel ad, kâr ve sabit fiyat silinir)' };
      if (!(await confirmBox('Toplu işlem', `Seçili ${ids.length} servis ${labels[action]}.`))) return;
    }
    try {
      const res = await api('/services/bulk', { method: 'POST', body: JSON.stringify(body) });
      toast(res.message);
      state.selected.clear();
      await loadServices(true);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function saveDefaultMarkup(event) {
    event.preventDefault();
    const value = Number($('#pn-default-markup').value);
    if (!(value >= 0)) { toast('Geçerli bir oran girin.', 'error'); return; }
    try {
      const res = await api('/pricing', { method: 'PUT', body: JSON.stringify({ default_markup_percent: value }) });
      toast(res.message);
      await loadMe();
      await loadServices(true);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // ------------------------------------------------------------- musteriler
  async function loadCustomers() {
    const q = $('#pn-cust-search').value.trim();
    const data = await api('/customers' + (q ? `?q=${encodeURIComponent(q)}` : ''));
    $('#pn-customers').innerHTML = data.customers.length ? data.customers.map(c => `<tr>
      <td><strong>${escapeHtml(c.username)}</strong>${c.banned ? ' <span class="sf-badge sf-badge-canceled">Banlı</span>' : ''}</td>
      <td>${escapeHtml(c.email)}</td>
      <td class="pn-num">${money(c.balance)}</td>
      <td>${num(c.orders_count)}</td>
      <td class="pn-num">${money(c.spent)}</td>
      <td>${formatDate(c.created_at)}</td>
      <td>${formatDate(c.last_login_at)}</td>
      <td class="pn-actions">
        <button type="button" class="sf-btn sf-btn-primary sf-btn-sm" data-cust-balance="${c.id}" data-action="add" data-name="${escapeHtml(c.username)}">+ Bakiye</button>
        <button type="button" class="sf-btn sf-btn-ghost sf-btn-sm" data-cust-balance="${c.id}" data-action="subtract" data-name="${escapeHtml(c.username)}">- Bakiye</button>
        <button type="button" class="sf-btn sf-btn-ghost sf-btn-sm" data-cust-detail="${c.id}">Detay</button>
        <button type="button" class="sf-btn sf-btn-ghost sf-btn-sm" data-cust-ban="${c.id}" data-banned="${c.banned ? '1' : '0'}" data-name="${escapeHtml(c.username)}" title="${c.banned ? 'Banı kaldır' : 'Banla'}"><i class="fa-solid ${c.banned ? 'fa-unlock' : 'fa-ban'}" aria-hidden="true"></i></button>
      </td></tr>`).join('') : `<tr><td colspan="8" class="sf-muted">${q ? 'Aramaya uyan müşteri yok.' : 'Henüz müşteriniz yok.'}</td></tr>`;
  }

  async function changeBalance(id, action, name) {
    const result = await askAmount(action === 'add' ? 'Bakiye ekle' : 'Bakiye düş',
      `${name} kullanıcısının bakiyesine ${action === 'add' ? 'eklenecek' : 'düşülecek'} tutar.`);
    if (!result) return;
    try {
      const res = await api(`/customers/${id}/balance`, { method: 'POST', body: JSON.stringify({ ...result, action }) });
      toast(res.message);
      await loadCustomers();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function toggleBan(id, banned, name) {
    const ok = await confirmBox(banned ? 'Müşteriyi banla' : 'Banı kaldır',
      banned ? `${name} banlanacak ve oturumu kapanacak.` : `${name} kullanıcısının banı kaldırılacak.`, banned ? 'Banla' : 'Kaldır');
    if (!ok) return;
    try {
      const res = await api(`/customers/${id}/ban`, { method: 'POST', body: JSON.stringify({ banned }) });
      toast(res.message);
      await loadCustomers();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function customerDetail(id) {
    try {
      const d = await api(`/customers/${id}`);
      const c = d.customer;
      const types = { order: 'Sipariş', refund: 'İade', manual_add: 'Bakiye ekleme', manual_subtract: 'Bakiye düşme', deposit: 'Yükleme' };
      openModal(c.username, `
        <div class="pn-kpis" style="margin-bottom:14px;">
          <div class="pn-kpi"><div class="pn-kpi-label">Bakiye</div><div class="pn-kpi-value">${money(c.balance)}</div><div class="pn-kpi-sub">${escapeHtml(c.email)}</div></div>
          <div class="pn-kpi"><div class="pn-kpi-label">Kayıt</div><div class="pn-kpi-value" style="font-size:1rem;">${formatDate(c.created_at)}</div><div class="pn-kpi-sub">son giriş ${formatDate(c.last_login_at)}</div></div>
        </div>
        <h3 class="pn-card-title">Siparişler</h3>
        <div class="sf-table-wrap"><table class="sf-table"><thead><tr><th>No</th><th>Servis</th><th>Miktar</th><th>Ödedi</th><th>Kâr</th><th>Durum</th><th>Tarih</th></tr></thead><tbody>
          ${d.orders.map(o => `<tr><td>#${o.id}</td><td>${escapeHtml(o.service_name)}</td><td>${num(o.quantity)}</td><td class="pn-num">${money(o.paid)}</td><td>${profitCell(o.profit)}</td><td>${statusBadge(o.status)}</td><td>${formatDate(o.created_at)}</td></tr>`).join('') || '<tr><td colspan="7" class="sf-muted">Sipariş yok.</td></tr>'}
        </tbody></table></div>
        <h3 class="pn-card-title" style="margin-top:16px;">Bakiye Hareketleri</h3>
        <div class="sf-table-wrap"><table class="sf-table"><thead><tr><th>Tarih</th><th>Tür</th><th>Tutar</th><th>Sonraki</th><th>Not</th></tr></thead><tbody>
          ${d.balance_logs.map(l => `<tr><td>${formatDate(l.created_at)}</td><td>${types[l.type] || escapeHtml(l.type)}${l.order_id ? ` #${l.order_id}` : ''}</td><td>${profitCell(l.amount)}</td><td class="pn-num">${money(l.balance_after)}</td><td>${escapeHtml(l.note || '')}</td></tr>`).join('') || '<tr><td colspan="5" class="sf-muted">Hareket yok.</td></tr>'}
        </tbody></table></div>`, { wide: true });
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // ------------------------------------------------------------- siparisler
  async function loadOrders() {
    const params = new URLSearchParams({ page: String(state.orderPage) });
    const status = $('#pn-ord-status').value;
    const q = $('#pn-ord-search').value.trim();
    if (status) params.set('status', status);
    if (q) params.set('q', q);
    const d = await api('/orders?' + params.toString());
    $('#pn-orders').innerHTML = d.orders.length ? d.orders.map(o => `<tr>
      <td>#${o.id}</td>
      <td>${escapeHtml(o.customer || '—')}</td>
      <td>${escapeHtml(o.service_name)}</td>
      <td class="pn-link-cell" title="${escapeHtml(o.link)}">${escapeHtml(o.link)}</td>
      <td>${num(o.quantity)}${o.remains > 0 ? `<span class="pn-sub">kalan ${num(o.remains)}</span>` : ''}</td>
      <td class="pn-num">${money(o.paid)}${o.refunded > 0 ? `<span class="pn-sub">iade ${money(o.refunded)}</span>` : ''}</td>
      <td class="pn-num">${money(o.cost)}</td>
      <td>${profitCell(o.profit)}</td>
      <td>${statusBadge(o.status)}</td>
      <td>${formatDate(o.created_at)}</td></tr>`).join('') : '<tr><td colspan="10" class="sf-muted">Sipariş bulunamadı.</td></tr>';
    $('#pn-ord-pager').innerHTML = d.pages > 1 ? `
      <button type="button" class="sf-btn sf-btn-ghost sf-btn-sm" data-page="${d.page - 1}" ${d.page <= 1 ? 'disabled' : ''}>Önceki</button>
      <span class="sf-muted">${d.page} / ${d.pages} · ${num(d.total)} sipariş</span>
      <button type="button" class="sf-btn sf-btn-ghost sf-btn-sm" data-page="${d.page + 1}" ${d.page >= d.pages ? 'disabled' : ''}>Sonraki</button>` : `<span class="sf-muted">${num(d.total)} sipariş</span>`;
  }

  // ------------------------------------------------------------- site
  async function loadSite() {
    const s = await api('/site');
    const form = $('#pn-site-form');
    form.name.value = s.name;
    form.primary_color.value = s.primary_color;
    $('#pn-color-picker').value = s.primary_color;
    form.description.value = s.description;
    form.announcement.value = s.announcement;
    form.support_email.value = s.support_email;
    form.telegram.value = s.telegram;
  }

  async function saveSite(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const errorEl = $('.sf-form-error', form);
    errorEl.textContent = '';
    const body = Object.fromEntries(['name', 'primary_color', 'description', 'announcement', 'support_email', 'telegram'].map(key => [key, form[key].value.trim()]));
    try {
      const res = await api('/site', { method: 'PUT', body: JSON.stringify(body) });
      toast(res.message);
      document.documentElement.style.setProperty('--primary', body.primary_color);
      $$('.sf-brand-name').forEach(el => { el.textContent = body.name; });
    } catch (err) {
      errorEl.textContent = err.message;
    }
  }

  // ------------------------------------------------------------- kayitlar
  const ACTIONS = {
    tenant_created: 'Bayi paneli açıldı',
    tenant_updated: 'Bayi ayarı değişti',
    status_changed: 'Site durumu değişti',
    global_settings_changed: 'Genel fiyatlandırma değişti',
    domain_added: 'Alan adı eklendi',
    domain_removed: 'Alan adı kaldırıldı',
    domain_status_changed: 'Alan adı durumu değişti',
    customer_registered: 'Müşteri kaydoldu',
    customer_login: 'Müşteri girişi',
    customer_balance_changed: 'Müşteri bakiyesi değişti',
    customer_banned: 'Müşteri banlandı',
    customer_unbanned: 'Müşteri banı kaldırıldı',
    owner_balance_low: 'Bakiyeniz yetmedi, sipariş alınamadı',
    owner_login: 'Panele giriş',
    refill_requested: 'Telafi istendi',
    service_price_changed: 'Servis fiyatı değişti',
    services_bulk_changed: 'Toplu servis işlemi',
    site_settings_changed: 'Site ayarları değişti'
  };
  const ACTORS = { owner: 'Siz', customer: 'Müşteri', jet_admin: 'Yönetim', system: 'Sistem' };

  function detailText(entry) {
    const d = entry.details;
    if (!d || typeof d !== 'object') return '';
    if (entry.action === 'customer_balance_changed') return `${escapeHtml(d.customer)}: ${Number(d.amount) > 0 ? '+' : ''}${money(d.amount)} → ${money(d.balance_after)}${d.note ? ' · ' + escapeHtml(d.note) : ''}`;
    if (entry.action === 'owner_balance_low') return `Gerekli ${money(d.required)}, bakiyeniz ${money(d.owner_balance)}`;
    if (entry.action === 'service_price_changed') {
      const a = d.after || {};
      const parts = [a.enabled ? 'satışta' : 'satışta değil'];
      if (a.fixed_price !== null && a.fixed_price !== undefined) parts.push(`sabit ${money(a.fixed_price)}`);
      else if (a.markup_percent !== null && a.markup_percent !== undefined) parts.push(`kâr %${a.markup_percent}`);
      else parts.push('varsayılan kâr');
      if (a.custom_name) parts.push(`ad: ${escapeHtml(a.custom_name)}`);
      return `#${d.service_id} ${escapeHtml(d.service || '')} · ${parts.join(' · ')}`;
    }
    if (entry.action === 'services_bulk_changed') return `${d.count} servis · ${escapeHtml(d.action)}${d.markup_percent !== null && d.markup_percent !== undefined ? ` %${d.markup_percent}` : ''}`;
    if (entry.action === 'global_settings_changed') return `Alış indirimi %${escapeHtml(d.before?.discount_percent)} → %${escapeHtml(d.after?.discount_percent)}`;
    if (entry.action === 'status_changed') return `${escapeHtml(d.from)} → ${escapeHtml(d.to)}${d.reason ? ' · ' + escapeHtml(d.reason) : ''}`;
    return Object.entries(d).map(([k, v]) => `${escapeHtml(k)}: ${escapeHtml(typeof v === 'object' && v !== null ? `${v.from ?? ''} → ${v.to ?? ''}` : v)}`).join(' · ');
  }

  async function loadLogs(force = false) {
    if (!state.logs || force) state.logs = await api('/logs');
    const types = { order: 'Sipariş', refund: 'İade', manual_add: 'Bakiye ekleme', manual_subtract: 'Bakiye düşme', deposit: 'Yükleme' };
    $$('[data-log-tab]').forEach(btn => btn.classList.toggle('active', btn.dataset.logTab === state.logTab));
    if (state.logTab === 'activity') {
      $('#pn-logs-head').innerHTML = '<tr><th>Tarih</th><th>Kim</th><th>İşlem</th><th>Ayrıntı</th><th>IP</th></tr>';
      $('#pn-logs').innerHTML = state.logs.activity.map(a => `<tr>
        <td>${formatDate(a.created_at)}</td>
        <td>${ACTORS[a.actor_type] || escapeHtml(a.actor_type)}${a.actor_name ? ': ' + escapeHtml(a.actor_name) : ''}</td>
        <td>${escapeHtml(ACTIONS[a.action] || a.action)}</td>
        <td>${detailText(a)}</td>
        <td class="sf-muted">${escapeHtml(a.ip_address || '')}</td></tr>`).join('') || '<tr><td colspan="5" class="sf-muted">Kayıt yok.</td></tr>';
    } else {
      $('#pn-logs-head').innerHTML = '<tr><th>Tarih</th><th>Müşteri</th><th>Tür</th><th>Tutar</th><th>Sonraki Bakiye</th><th>Not</th></tr>';
      $('#pn-logs').innerHTML = state.logs.balance_logs.map(l => `<tr>
        <td>${formatDate(l.created_at)}</td>
        <td>${escapeHtml(l.customer || '—')}</td>
        <td>${types[l.type] || escapeHtml(l.type)}${l.order_id ? ` #${l.order_id}` : ''}</td>
        <td>${profitCell(l.amount)}</td>
        <td class="pn-num">${money(l.balance_after)}</td>
        <td>${escapeHtml(l.note || '')}</td></tr>`).join('') || '<tr><td colspan="6" class="sf-muted">Hareket yok.</td></tr>';
    }
  }

  // ------------------------------------------------------------- yonlendirme
  function viewFromPath(path) {
    const clean = path.replace(/\/+$/, '') || '/admin';
    return Object.keys(VIEWS).find(key => VIEWS[key].path === clean) || 'dashboard';
  }

  async function showView(view) {
    $$('.pn-view').forEach(section => { section.hidden = section.dataset.view !== view; });
    $$('.pn-nav a').forEach(link => link.classList.toggle('active', link.dataset.go === view));
    $('#pn-title').textContent = VIEWS[view].title;
    document.title = `${VIEWS[view].title} · Yönetim Paneli`;
    try {
      if (view === 'dashboard') await loadDashboard();
      if (view === 'services') await loadServices();
      if (view === 'customers') await loadCustomers();
      if (view === 'orders') await loadOrders();
      if (view === 'site') await loadSite();
      if (view === 'logs') await loadLogs(true);
    } catch (err) {
      if (err.status !== 401) toast(err.message, 'error');
    }
  }

  function go(view) {
    const path = VIEWS[view].path;
    if (location.pathname !== path) history.pushState({}, '', path);
    showView(view);
  }

  async function start() {
    try {
      await loadMe();
    } catch {
      showLogin();
      return;
    }
    $('#pn-login').hidden = true;
    $('#pn-app').hidden = false;
    showView(viewFromPath(location.pathname));
  }

  function bind() {
    $('#pn-login-form').addEventListener('submit', submitLogin);
    $('#pn-logout').addEventListener('click', logout);
    $('#pn-default-markup-form').addEventListener('submit', saveDefaultMarkup);
    $('#pn-site-form').addEventListener('submit', saveSite);
    $('#pn-color-picker').addEventListener('input', event => { $('#pn-site-form').primary_color.value = event.target.value; });
    $('#pn-svc-category').addEventListener('change', renderServices);
    $('#pn-svc-filter').addEventListener('change', renderServices);
    $('#pn-svc-search').addEventListener('input', debounce(renderServices, 150));
    $('#pn-cust-search').addEventListener('input', debounce(loadCustomers, 300));
    $('#pn-ord-status').addEventListener('change', () => { state.orderPage = 1; loadOrders(); });
    $('#pn-ord-search').addEventListener('input', debounce(() => { state.orderPage = 1; loadOrders(); }, 300));
    $('#pn-svc-all').addEventListener('change', event => {
      const rows = filteredServices().slice(0, 400);
      rows.forEach(s => { if (event.target.checked) state.selected.add(s.id); else state.selected.delete(s.id); });
      renderServices();
    });
    $('#pn-modal').addEventListener('mousedown', event => {
      if (event.target.id === 'pn-modal') { const r = $('#pn-modal')._resolve; closeModal(); if (r) r(); }
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !$('#pn-modal').hidden) { const r = $('#pn-modal')._resolve; closeModal(); if (r) r(); }
    });
    document.addEventListener('click', event => {
      const t = event.target;
      const nav = t.closest('[data-go]');
      if (nav) { event.preventDefault(); go(nav.dataset.go); return; }
      if (t.closest('[data-modal-close]')) { const r = $('#pn-modal')._resolve; closeModal(); if (r) r(); return; }
      const check = t.closest('[data-svc-check]');
      if (check) {
        const id = Number(check.dataset.svcCheck);
        if (check.checked) state.selected.add(id); else state.selected.delete(id);
        renderBulk();
        return;
      }
      const edit = t.closest('[data-svc-edit]');
      if (edit) { editService(Number(edit.dataset.svcEdit)); return; }
      const bulk = t.closest('[data-bulk]');
      if (bulk) { bulkAction(bulk.dataset.bulk); return; }
      const bal = t.closest('[data-cust-balance]');
      if (bal) { changeBalance(Number(bal.dataset.custBalance), bal.dataset.action, bal.dataset.name); return; }
      const det = t.closest('[data-cust-detail]');
      if (det) { customerDetail(Number(det.dataset.custDetail)); return; }
      const ban = t.closest('[data-cust-ban]');
      if (ban) { toggleBan(Number(ban.dataset.custBan), ban.dataset.banned !== '1', ban.dataset.name); return; }
      const page = t.closest('[data-page]');
      if (page && !page.disabled) { state.orderPage = Number(page.dataset.page); loadOrders(); return; }
      const tab = t.closest('[data-log-tab]');
      if (tab) { state.logTab = tab.dataset.logTab; loadLogs(); }
    });
    window.addEventListener('popstate', () => showView(viewFromPath(location.pathname)));
  }

  bind();
  start();
})();
