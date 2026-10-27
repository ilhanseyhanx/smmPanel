// Bayi yonetim paneli (bayi.com/admin): tek sayfa uygulamasi.
// Sunucu /admin ve alt adreslerine ayni HTML'i verir; gorunum yola gore secilir.
(function () {
  'use strict';

  const VIEWS = {
    dashboard: { path: '/admin', title: 'Özet' },
    services: { path: '/admin/services', title: 'Servisler & Fiyatlar' },
    customers: { path: '/admin/customers', title: 'Müşteriler' },
    orders: { path: '/admin/orders', title: 'Siparişler' },
    payments: { path: '/admin/payments', title: 'Ödemeler' },
    paysettings: { path: '/admin/payment-settings', title: 'Ödeme Ayarları' },
    site: { path: '/admin/site', title: 'Site Ayarları' },
    pages: { path: '/admin/pages', title: 'Yasal Sayfalar' },
    subscription: { path: '/admin/subscription', title: 'Abonelik' },
    appearance: { path: '/admin/appearance', title: 'Görünüm' },
    domain: { path: '/admin/domain', title: 'Alan Adı' },
    logs: { path: '/admin/logs', title: 'Kayıtlar' }
  };
  const STATUS = {
    pending: ['Bekliyor', 'pending'],
    processing: ['İşleniyor', 'processing'],
    completed: ['Tamamlandı', 'completed'],
    partial: ['Kısmi', 'partial'],
    canceled: ['İptal', 'canceled']
  };
  const state = { me: null, services: null, selected: new Set(), orderPage: 1, payPage: 1, logTab: 'activity', logs: null, pages: [], callbackUrls: {} };

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
    // Abonelik yuzunden askidaysa bunu abonelik seridi anlatir (ikisi ust uste binmesin).
    if (me.tenant.status !== 'active' && me.subscription?.plan_status !== 'expired') {
      alert.hidden = false;
      alert.textContent = me.tenant.status === 'suspended'
        ? `Siteniz askıya alındı; müşteriler şu an sipariş veremez.${me.tenant.status_reason ? ' Sebep: ' + me.tenant.status_reason : ''}`
        : 'Siteniz uyku modunda; müşteriler şu an siteyi göremez.';
    } else {
      alert.hidden = true;
    }
    renderBillingBanner(me.subscription);
    return me;
  }

  // ------------------------------------------------------------- abonelik
  const PLAN_LABEL = {
    trial: ['Ücretsiz deneme', 'processing'],
    active: ['Aktif', 'completed'],
    past_due: ['Ödeme bekleniyor', 'pending'],
    expired: ['Askıda', 'canceled'],
    comp: ['Ücretsiz', 'completed']
  };

  function day(value) {
    if (!value) return '';
    const date = new Date(String(value).replace(' ', 'T') + 'Z');
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // Her sayfanin ustundeki durum seridi: yalnizca yapilacak bir sey varsa gorunur.
  function renderBillingBanner(sub) {
    const box = $('#pn-billing');
    if (!sub || sub.plan_status === 'comp') { box.hidden = true; return; }
    const fee = money(sub.fee);
    const topUp = state.me?.top_up_url ? `<a class="sf-btn sf-btn-ghost sf-btn-sm" href="${escapeHtml(state.me.top_up_url)}" target="_blank" rel="noopener">Jet bakiyesi yükle</a>` : '';
    const pay = label => `<button type="button" class="sf-btn sf-btn-primary sf-btn-sm" data-sub-continue>${escapeHtml(label)}</button>`;
    let tone = 'info';
    let text = '';
    let actions = '';
    if (sub.plan_status === 'trial') {
      if (sub.auto_renew) {
        text = `Deneme ${day(sub.trial_ends_at)} tarihinde bitiyor; ${fee} Jet bakiyenden alınacak.`;
        if (!sub.balance_enough) { tone = 'warn'; text += ' Bakiyen şu an yetersiz.'; actions = topUp; }
      } else {
        text = `Ücretsiz deneme: ${sub.days_left} gün kaldı (${day(sub.trial_ends_at)}). Devam etmezsen deneme bitince site kapanır.`;
        actions = pay(`${fee}/ay ile devam et`);
        tone = sub.days_left <= 2 ? 'warn' : 'info';
      }
    } else if (sub.plan_status === 'active') {
      if (!sub.auto_renew) {
        tone = 'warn';
        text = `Yenileme kapalı; site ${day(sub.paid_until)} tarihinde kapanacak.`;
        actions = pay('Yenilemeyi aç');
      } else if (sub.days_left <= 3 && !sub.balance_enough) {
        tone = 'warn';
        text = `Abonelik ${day(sub.paid_until)} tarihinde yenilenecek; ${fee} için Jet bakiyen yetersiz.`;
        actions = topUp;
      }
    } else if (sub.plan_status === 'past_due') {
      tone = 'warn';
      text = `Aylık ücret (${fee}) alınamadı. ${day(sub.grace_ends_at)} tarihine kadar bakiye yüklersen kendiliğinden alınır; yüklemezsen site askıya alınır.`;
      actions = topUp + pay('Şimdi öde');
    } else if (sub.plan_status === 'expired') {
      tone = 'danger';
      text = `Site askıda. ${day(sub.delete_at)} tarihinde müşterileri ve ayarlarıyla silinecek.`;
      actions = topUp + pay(`${fee} öde ve aç`);
    }
    if (!text) { box.hidden = true; return; }
    box.hidden = false;
    box.className = `pn-billing pn-billing-${tone}`;
    box.innerHTML = `<span>${escapeHtml(text)}</span><span class="pn-billing-actions">${actions}</span>`;
  }

  async function loadSubscription() {
    const d = await api('/subscription');
    const sub = d.subscription;
    const [label, cls] = PLAN_LABEL[sub.plan_status] || PLAN_LABEL.trial;
    const rows = [];
    if (sub.plan_status === 'trial') rows.push(['Deneme bitişi', day(sub.trial_ends_at)], ['Kalan', `${sub.days_left} gün`]);
    if (sub.plan_status === 'active') rows.push(['Dönem sonu', day(sub.paid_until)], ['Otomatik yenileme', sub.auto_renew ? 'Açık' : 'Kapalı']);
    if (sub.plan_status === 'past_due') rows.push(['Son ödeme günü', day(sub.grace_ends_at)]);
    if (sub.plan_status === 'expired') rows.push(['Silinme tarihi', day(sub.delete_at)]);
    rows.push(['Aylık ücret', sub.plan_status === 'comp' ? 'Ücretsiz' : money(sub.fee)], ['Jet bakiyen', money(sub.owner_balance)]);
    let actions = '';
    if (sub.plan_status === 'trial' || sub.plan_status === 'active') {
      actions = sub.auto_renew
        ? '<button type="button" class="sf-btn sf-btn-ghost" data-sub-cancel>Yenilemeyi kapat</button>'
        : `<button type="button" class="sf-btn sf-btn-primary" data-sub-continue>${money(sub.fee)}/ay ile devam et</button>`;
    } else if (sub.plan_status === 'past_due' || sub.plan_status === 'expired') {
      actions = `<button type="button" class="sf-btn sf-btn-primary" data-sub-continue>${money(sub.fee)} öde ve ${sub.plan_status === 'expired' ? 'aç' : 'devam et'}</button>`;
    }
    if (actions && d.top_up_url) actions += `<a class="sf-btn sf-btn-ghost" href="${escapeHtml(d.top_up_url)}" target="_blank" rel="noopener">Jet bakiyesi yükle</a>`;
    $('#pn-sub-card').innerHTML = `
      <div class="pn-pay-head"><h3>Jet Bayi Paneli</h3><span class="sf-badge sf-badge-${cls}">${label}</span></div>
      <dl class="sf-dl pn-sub-dl">${rows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('')}</dl>
      ${actions ? `<div class="pn-row-actions pn-sub-actions">${actions}</div>` : ''}`;
    $('#pn-sub-rules').innerHTML = [
      `Aylık ücret ${money(sub.fee)}; Jet hesabının bakiyesinden alınır.`,
      `İlk ${d.trial_days} gün ücretsiz. "Devam et" demezsen deneme bitince site kapanır.`,
      'Sonraki aylar kendiliğinden yenilenir; istediğin zaman yenilemeyi kapatabilirsin.',
      `Bakiye yetmezse ${d.grace_days} gün içinde yüklemen yeterli; ücret kendiliğinden alınır.`,
      `Askıya alınan site ${d.delete_after_days} gün sonra müşterileri ve ayarlarıyla silinir.`
    ].map(item => `<li>${escapeHtml(item)}</li>`).join('');
    $('#pn-invoices').innerHTML = d.invoices.length
      ? d.invoices.map(i => `<tr><td>${formatDate(i.created_at)}</td><td class="pn-num">${money(i.amount)}</td><td>${day(i.period_start)} – ${day(i.period_end)}</td></tr>`).join('')
      : '<tr><td colspan="3" class="sf-muted">Henüz ödeme yok.</td></tr>';
  }

  // ------------------------------------------------------------- alan adi
  const DOMAIN_STATUS = { active: ['Aktif', 'completed'], pending: ['Doğrulanıyor', 'pending'], disabled: ['Kapalı', 'canceled'] };

  function dnsName(hostname) {
    return hostname.startsWith('www.') ? 'www' : hostname;
  }

  async function loadDomains() {
    const d = await api('/domains');
    state.domainInfo = d;
    $('#pn-subdomain').innerHTML = d.subdomain
      ? `<a href="https://${escapeHtml(d.subdomain)}" target="_blank" rel="noopener">${escapeHtml(d.subdomain)}</a>`
      : '<span class="sf-muted">Alt adres tanımlı değil.</span>';
    const form = $('#pn-domain-form');
    form.hidden = !d.configured;
    form.querySelector('button[type=submit]').disabled = d.domains.length >= d.max_domains;
    $('#pn-domains').innerHTML = d.domains.map(item => {
      const [label, cls] = DOMAIN_STATUS[item.status] || DOMAIN_STATUS.pending;
      const dns = item.status === 'active' || !item.managed ? '' : `
        <p class="pn-help" style="margin:0;">Alan adı firmanın DNS ayarlarına şu kaydı ekle:</p>
        <div class="sf-table-wrap"><table class="sf-table pn-table pn-dns-table">
          <thead><tr><th>Tür</th><th>Ad (Host)</th><th>Hedef / Değer</th></tr></thead>
          <tbody>
            <tr><td><strong>CNAME</strong></td><td><code>${escapeHtml(dnsName(item.hostname))}</code></td><td><code>${escapeHtml(d.cname_target || '')}</code></td></tr>
            ${item.txt_name ? `<tr><td>TXT <span class="pn-sub">isteğe bağlı, doğrulamayı hızlandırır</span></td><td><code>${escapeHtml(item.txt_name)}</code></td><td><code>${escapeHtml(item.txt_value)}</code></td></tr>` : ''}
          </tbody>
        </table></div>
        <p class="sf-muted pn-help" style="margin:0;">Alan adın Cloudflare'deyse kaydın proxy'sini (turuncu bulut) kapalı bırak. DNS'in yayılması birkaç dakika ile birkaç saat sürebilir; durum 10 dakikada bir kendiliğinden kontrol edilir.</p>`;
      return `<article class="sf-card pn-domain">
        <div class="pn-pay-head"><h3>${item.status === 'active' ? `<a href="https://${escapeHtml(item.hostname)}" target="_blank" rel="noopener">${escapeHtml(item.hostname)}</a>` : escapeHtml(item.hostname)}</h3><span class="sf-badge sf-badge-${cls}">${label}</span></div>
        ${item.error && item.status !== 'active' ? `<p class="pn-domain-error">${escapeHtml(item.error)}</p>` : ''}
        ${dns}
        <div class="pn-row-actions pn-theme-actions">
          ${item.managed && item.status !== 'active' ? `<button type="button" class="sf-btn sf-btn-primary sf-btn-sm" data-domain-check="${item.id}">Kontrol et</button>` : ''}
          <button type="button" class="sf-btn sf-btn-ghost sf-btn-sm" data-domain-remove="${item.id}" data-name="${escapeHtml(item.hostname)}">Kaldır</button>
        </div>
      </article>`;
    }).join('') || (d.configured ? '' : '<div class="sf-card"><p class="sf-muted" style="margin:0;">Kendi alan adını bağlama çok yakında açılacak.</p></div>');
  }

  async function addDomain(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const errorEl = $('.sf-form-error', form);
    const button = $('button[type=submit]', form);
    errorEl.textContent = '';
    button.disabled = true;
    try {
      const res = await api('/domains', { method: 'POST', body: JSON.stringify({ domain: form.elements.namedItem('domain').value.trim() }) });
      form.reset();
      toast(res.message);
      await loadDomains();
    } catch (err) {
      errorEl.textContent = err.message;
      button.disabled = false;
    }
  }

  async function checkDomain(id, button) {
    button.disabled = true;
    try {
      const res = await api(`/domains/${id}/check`, { method: 'POST' });
      toast(res.message, res.domain.status === 'active' ? undefined : 'info');
      await loadDomains();
    } catch (err) {
      toast(err.message, 'error');
      button.disabled = false;
    }
  }

  async function removeDomain(id, name) {
    if (!await confirmBox('Alan adını kaldır', `${name} siteden ayrılacak; DNS kaydını da silebilirsin.`, 'Kaldır')) return;
    try {
      const res = await api(`/domains/${id}`, { method: 'DELETE' });
      toast(res.message);
      await loadDomains();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // ------------------------------------------------------------- gorunum
  function renderBranding(b) {
    const show = (id, url, kind) => {
      $(id).innerHTML = url ? `<img src="${escapeHtml(url)}" alt="">` : '<i class="fa-solid fa-image" aria-hidden="true"></i>';
      $(`[data-brand-remove="${kind}"]`).hidden = !url;
    };
    show('#pn-logo-preview', b.logo_url, 'logo');
    show('#pn-favicon-preview', b.favicon_url, 'favicon');
    $('#pn-hide-name').checked = b.hide_name;
    $('#pn-hide-name').disabled = !b.logo_url;
  }

  function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Dosya okunamadı.'));
      reader.readAsDataURL(file);
    });
  }

  async function uploadBrand(input) {
    const kind = input.dataset.brandUpload;
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    const limit = kind === 'logo' ? 300 : 100;
    if (file.size > limit * 1024) { toast(`Dosya en fazla ${limit} KB olabilir.`, 'error'); return; }
    try {
      const res = await api(`/branding/${kind}`, { method: 'POST', body: JSON.stringify({ data: await readAsDataUrl(file) }) });
      toast(res.message);
      renderBranding(res);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function removeBrand(kind) {
    try {
      const res = await api(`/branding/${kind}`, { method: 'DELETE' });
      toast(res.message);
      renderBranding(res);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function loadThemes() {
    renderBranding(await api('/branding'));
    const d = await api('/theme');
    $('#pn-themes').innerHTML = d.themes.map(t => {
      const current = t.key === d.current;
      return `<article class="sf-card pn-theme${current ? ' is-current' : ''}">
        <div class="pn-theme-thumb" data-layout="${escapeHtml(t.layout)}" style="--t-bg:${escapeHtml(t.bg)};--t-accent:${escapeHtml(t.accent)}" aria-hidden="true"><i></i><b></b><s></s><u></u></div>
        <div class="pn-pay-head"><h3>${escapeHtml(t.name)}</h3><span class="sf-badge sf-badge-${current ? 'completed' : 'processing'}">${current ? 'Kullanılıyor' : escapeHtml(t.layout_name)}</span></div>
        <p class="sf-muted">${escapeHtml(t.note)} · ${escapeHtml(t.layout_name)} yerleşim</p>
        <div class="pn-row-actions pn-theme-actions">
          <a class="sf-btn sf-btn-ghost sf-btn-sm" href="/?tema=${encodeURIComponent(t.key)}" target="_blank" rel="noopener">Önizle</a>
          ${current ? '' : `<button type="button" class="sf-btn sf-btn-primary sf-btn-sm" data-theme-use="${escapeHtml(t.key)}">Kullan</button>`}
        </div>
      </article>`;
    }).join('');
  }

  async function useTheme(key) {
    try {
      const res = await api('/theme', { method: 'PUT', body: JSON.stringify({ theme: key }) });
      toast(res.message);
      await loadThemes();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function subscriptionAction(kind) {
    if (kind === 'cancel' && !await confirmBox('Yenilemeyi kapat', 'Dönem sonunda site kapanır; o zamana kadar her şey çalışmaya devam eder.', 'Yenilemeyi Kapat')) return;
    try {
      const res = await api(`/subscription/${kind}`, { method: 'POST' });
      toast(res.message);
      await loadMe();
      if (location.pathname === VIEWS.subscription.path) await loadSubscription();
    } catch (err) {
      toast(err.message, 'error');
    }
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
    form.legal_name.value = s.legal_name;
    form.hero_title.value = s.hero_title;
    form.hero_text.value = s.hero_text;
    form.footer_text.value = s.footer_text;
    form.legal_address.value = s.legal_address;
    form.phone.value = s.phone;
  }

  async function saveSite(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const errorEl = $('.sf-form-error', form);
    errorEl.textContent = '';
    const body = Object.fromEntries(['name', 'primary_color', 'description', 'announcement', 'support_email', 'telegram', 'legal_name', 'legal_address', 'phone', 'hero_title', 'hero_text', 'footer_text']
      .map(key => [key, form.elements.namedItem(key).value.trim()]));
    try {
      const res = await api('/site', { method: 'PUT', body: JSON.stringify(body) });
      toast(res.message);
      document.documentElement.style.setProperty('--primary', body.primary_color);
      $$('.sf-brand-name').forEach(el => { el.textContent = body.name; });
    } catch (err) {
      errorEl.textContent = err.message;
    }
  }

  // ------------------------------------------------------------- odemeler
  // Musteri parasi bayinin hesabina gider; havale bildirimi burada onaylanir,
  // kart ve kripto saglayici onayiyla kendiliginden bakiyeye yazilir.
  const PAY_STATUS = {
    pending: ['Bekliyor', 'pending'],
    completed: ['Yüklendi', 'completed'],
    failed: ['Başarısız', 'canceled'],
    rejected: ['Reddedildi', 'canceled']
  };
  const METHOD_LABEL = { bank: 'Havale / EFT', paytr: 'Kart (PayTR)', shopier: 'Kart (Shopier)', nowpayments: 'Kripto' };

  function setPayCount(count) {
    const el = $('#pn-pay-count');
    el.hidden = !(count > 0);
    el.textContent = count > 99 ? '99+' : String(count || '');
  }

  async function loadPayments() {
    const params = new URLSearchParams({ page: String(state.payPage) });
    const status = $('#pn-pay-status').value;
    const method = $('#pn-pay-method').value;
    if (status) params.set('status', status);
    if (method) params.set('method', method);
    const d = await api('/payments?' + params.toString());
    setPayCount(d.pending_bank);
    const alert = $('#pn-pay-alert');
    alert.hidden = !(d.pending_bank > 0);
    alert.textContent = d.pending_bank > 0 ? `Onay bekleyen ${d.pending_bank} havale bildirimi var. Parayı hesabında gördükten sonra onayla.` : '';
    $('#pn-payments').innerHTML = d.payments.length ? d.payments.map(p => {
      const [label, cls] = PAY_STATUS[p.status] || PAY_STATUS.pending;
      const detail = p.method === 'bank'
        ? [p.sender_name && `Gönderen: ${escapeHtml(p.sender_name)}`, p.bank_name && escapeHtml(p.bank_name), p.note && escapeHtml(p.note)].filter(Boolean).join('<br>')
        : '';
      const actions = p.method === 'bank' && p.status === 'pending'
        ? `<div class="pn-row-actions"><button type="button" class="sf-btn sf-btn-primary sf-btn-sm" data-pay-approve="${p.id}" data-amount="${p.amount}" data-name="${escapeHtml(p.customer || '')}">Onayla</button><button type="button" class="sf-btn sf-btn-ghost sf-btn-sm" data-pay-reject="${p.id}">Reddet</button></div>`
        : '';
      return `<tr>
        <td>#${p.id}</td>
        <td>${escapeHtml(p.customer || '—')}</td>
        <td>${escapeHtml(METHOD_LABEL[p.method] || p.method_label)}</td>
        <td class="pn-num">${money(p.amount)}</td>
        <td>${detail || '<span class="sf-muted">—</span>'}</td>
        <td><span class="sf-badge sf-badge-${cls}">${label}</span>${p.failure_reason ? `<span class="pn-sub">${escapeHtml(p.failure_reason)}</span>` : ''}</td>
        <td>${formatDate(p.created_at)}</td>
        <td>${actions}</td></tr>`;
    }).join('') : '<tr><td colspan="8" class="sf-muted">Ödeme kaydı yok.</td></tr>';
    $('#pn-pay-pager').innerHTML = d.pages > 1 ? `
      <button type="button" class="sf-btn sf-btn-ghost sf-btn-sm" data-pay-page="${d.page - 1}" ${d.page <= 1 ? 'disabled' : ''}>Önceki</button>
      <span class="sf-muted">${d.page} / ${d.pages} · ${num(d.total)} ödeme</span>
      <button type="button" class="sf-btn sf-btn-ghost sf-btn-sm" data-pay-page="${d.page + 1}" ${d.page >= d.pages ? 'disabled' : ''}>Sonraki</button>` : `<span class="sf-muted">${num(d.total)} ödeme</span>`;
  }

  async function approvePayment(id, amount, name) {
    const ok = await confirmBox('Havale onayı', `${money(amount)} tutarı ${name || 'müşterinin'} bakiyesine eklenecek. Parayı hesabında gördün mü?`, 'Onayla ve Yükle');
    if (!ok) return;
    try {
      const res = await api(`/payments/${id}/approve`, { method: 'POST' });
      toast(res.message);
      loadPayments();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function rejectPayment(id) {
    openModal('Bildirimi reddet', `
      <form class="sf-form" id="pn-reject-form" novalidate>
        <label>Sebep <small>(müşteri görür)</small><input name="reason" class="sf-input" maxlength="300" placeholder="Örn: Ödeme hesaba ulaşmadı"></label>
        <p class="sf-form-error" role="alert"></p>
        <button type="submit" class="sf-btn sf-btn-primary">Reddet</button>
      </form>`);
    $('#pn-reject-form').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      try {
        const res = await api(`/payments/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason: form.elements.namedItem('reason').value.trim() }) });
        closeModal();
        toast(res.message);
        loadPayments();
      } catch (err) {
        $('.sf-form-error', form).textContent = err.message;
      }
    });
  }

  // ------------------------------------------------------------- odeme ayarlari
  const SECRET_LABELS = {
    merchant_id: 'Mağaza no (Merchant ID)',
    merchant_key: 'Merchant Key',
    merchant_salt: 'Merchant Salt',
    api_key: 'API anahtarı',
    ipn_secret: 'IPN gizli anahtarı',
    pat: 'Kişisel Erişim Anahtarı (PAT)'
  };
  const PAY_FIELDS = ['accounts', 'instructions', 'merchant_id', 'merchant_key', 'merchant_salt', 'api_key', 'ipn_secret', 'pat', 'image_url'];

  function secretInput(m, key) {
    const placeholder = m.saved[key] ? 'Kayıtlı. Değiştirmek için yenisini yaz.' : 'Henüz girilmedi';
    return `<label>${SECRET_LABELS[key]}<input name="${key}" class="sf-input" type="password" autocomplete="off" spellcheck="false" placeholder="${placeholder}"></label>`;
  }

  function paySettingsCard(m) {
    const urls = state.callbackUrls;
    let fields = '';
    if (m.method === 'bank') {
      fields = `
        <label>Hesap bilgileri <small>(müşteri aynen görür: banka, IBAN, alıcı adı, Papara no)</small><textarea name="accounts" class="sf-input" rows="5" maxlength="2000">${escapeHtml(m.accounts)}</textarea></label>
        <label>Müşteriye not <small>(isteğe bağlı)</small><input name="instructions" class="sf-input" maxlength="1000" value="${escapeHtml(m.instructions)}" placeholder="Örn: Açıklamaya kullanıcı adını yaz"></label>`;
    } else if (m.method === 'paytr') {
      fields = `${['merchant_id', 'merchant_key', 'merchant_salt'].map(key => secretInput(m, key)).join('')}
        <label class="sf-check"><input type="checkbox" name="test_mode" ${m.test_mode ? 'checked' : ''}> Test modu (gerçek çekim yapılmaz)</label>
        <div class="pn-note">PayTR mağaza panelinde <strong>Bildirim URL</strong> alanına bunu yaz:<code>${escapeHtml(urls.paytr || '')}</code></div>`;
    } else if (m.method === 'shopier') {
      fields = `${secretInput(m, 'pat')}
        <label>Ürün görseli adresi <small>(isteğe bağlı; boşsa ödeme sayfasında görsel olmaz)</small><input name="image_url" class="sf-input" maxlength="500" inputmode="url" value="${escapeHtml(m.image_url)}" placeholder="https://cdn.shopier.app/..."></label>
        <div class="pn-note">Shopier panelinde <strong>Entegrasyonlar → Kişisel Erişim Anahtarı</strong> bölümünden anahtar oluştur. Kaydedince ödeme bildirimi senin Shopier hesabına otomatik kurulur.
          <code>${m.webhook_ready ? 'Ödeme bildirimi kurulu' : 'Ödeme bildirimi henüz kurulmadı'}</code></div>`;
    } else if (m.method === 'nowpayments') {
      fields = `${['api_key', 'ipn_secret'].map(key => secretInput(m, key)).join('')}
        <div class="pn-note">IPN gizli anahtarını NOWPayments panelinde <strong>Store Settings → IPN</strong> bölümünden alırsın. Bildirim adresi her ödemeyle otomatik gönderilir.</div>`;
    }
    const badge = m.enabled ? ['Açık', 'completed'] : m.configured ? ['Kapalı', 'pending'] : ['Bilgi eksik', 'canceled'];
    return `<form class="sf-card sf-form pn-pay-card" data-pay-settings="${m.method}" novalidate>
      <div class="pn-pay-head"><h3>${escapeHtml(m.label)}</h3><span class="sf-badge sf-badge-${badge[1]}">${badge[0]}</span></div>
      <label class="sf-check"><input type="checkbox" name="enabled" ${m.enabled ? 'checked' : ''}> Müşterilere göster</label>
      ${fields}
      <div class="pn-pay-limits">
        <label>En az (₺)<input name="min" type="number" class="sf-input" min="1" step="0.01" value="${m.min}"></label>
        <label>En fazla (₺)<input name="max" type="number" class="sf-input" min="1" step="0.01" value="${m.max}"></label>
      </div>
      <p class="sf-form-error" role="alert"></p>
      <button type="submit" class="sf-btn sf-btn-primary">Kaydet</button>
    </form>`;
  }

  async function loadPaySettings() {
    const d = await api('/payment-settings');
    state.callbackUrls = d.callback_urls;
    $('#pn-pay-settings').innerHTML = d.methods.map(paySettingsCard).join('');
  }

  async function savePaySettings(form) {
    const field = name => form.elements.namedItem(name);
    const errorEl = $('.sf-form-error', form);
    errorEl.textContent = '';
    const body = { enabled: field('enabled').checked, min: Number(field('min').value), max: Number(field('max').value) };
    PAY_FIELDS.forEach(key => { if (field(key)) body[key] = field(key).value.trim(); });
    if (field('test_mode')) body.test_mode = field('test_mode').checked;
    const button = $('button[type=submit]', form);
    button.disabled = true;
    try {
      const res = await api('/payment-settings/' + form.dataset.paySettings, { method: 'PUT', body: JSON.stringify(body) });
      toast(res.message);
      form.outerHTML = paySettingsCard(res.method);
    } catch (err) {
      errorEl.textContent = err.message;
      button.disabled = false;
    }
  }

  // ------------------------------------------------------------- yasal sayfalar
  async function loadPagesView() {
    const d = await api('/pages');
    state.pages = d.pages;
    const alert = $('#pn-pages-alert');
    alert.hidden = !d.missing_info.length;
    alert.innerHTML = d.missing_info.length
      ? `Metinlerde "Belirtilmedi" yazmasın diye <a href="/admin/site" data-go="site">Site Ayarları</a> sayfasından şunları doldur: ${d.missing_info.map(escapeHtml).join(', ')}.`
      : '';
    $('#pn-pages').innerHTML = d.pages.map(p => `<tr>
      <td><strong>${escapeHtml(p.title)}</strong><span class="pn-sub">/sayfa/${escapeHtml(p.slug)}</span></td>
      <td>${p.customized ? `<span class="sf-badge sf-badge-processing">Düzenlendi</span><span class="pn-sub">${formatDate(p.updated_at)}</span>` : '<span class="sf-badge sf-badge-completed">Otomatik</span>'}</td>
      <td><div class="pn-row-actions">
        <a class="sf-btn sf-btn-ghost sf-btn-sm" href="/sayfa/${encodeURIComponent(p.slug)}" target="_blank" rel="noopener">Görüntüle</a>
        <button type="button" class="sf-btn sf-btn-primary sf-btn-sm" data-page-edit="${escapeHtml(p.slug)}">Düzenle</button>
        ${p.customized ? `<button type="button" class="sf-btn sf-btn-ghost sf-btn-sm" data-page-reset="${escapeHtml(p.slug)}">Otomatiğe Dön</button>` : ''}
      </div></td></tr>`).join('');
  }

  function editPage(slug) {
    const page = state.pages.find(p => p.slug === slug);
    if (!page) return;
    openModal(page.title, `
      <form class="sf-form" id="pn-page-form" novalidate>
        <label>Başlık<input name="title" class="sf-input" maxlength="120" value="${escapeHtml(page.title)}" required></label>
        <label>Metin <small>("## " ile başlayan satır başlık, "- " madde, boş satır yeni paragraf)</small><textarea name="body" class="sf-input pn-page-body" rows="18" maxlength="30000">${escapeHtml(page.body)}</textarea></label>
        <p class="sf-form-error" role="alert"></p>
        <button type="submit" class="sf-btn sf-btn-primary">Kaydet</button>
      </form>`, { wide: true });
    $('#pn-page-form').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      try {
        const res = await api('/pages/' + encodeURIComponent(slug), {
          method: 'PUT',
          body: JSON.stringify({ title: form.elements.namedItem('title').value.trim(), body: form.elements.namedItem('body').value })
        });
        closeModal();
        toast(res.message);
        loadPagesView();
      } catch (err) {
        $('.sf-form-error', form).textContent = err.message;
      }
    });
  }

  async function resetPage(slug) {
    if (!await confirmBox('Otomatiğe dön', 'Düzenlediğin metin silinir; sayfa site bilgilerinle otomatik dolar.', 'Otomatiğe Dön')) return;
    try {
      const res = await api('/pages/' + encodeURIComponent(slug), { method: 'DELETE' });
      toast(res.message);
      loadPagesView();
    } catch (err) {
      toast(err.message, 'error');
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
    site_settings_changed: 'Site ayarları değişti',
    payment_notice: 'Havale bildirimi geldi',
    payment_completed: 'Bakiye yüklendi',
    payment_rejected: 'Havale bildirimi reddedildi',
    payment_settings_changed: 'Ödeme ayarı değişti',
    page_saved: 'Yasal sayfa düzenlendi',
    subscription_charged: 'Aylık ücret alındı',
    subscription_continue: 'Abonelik devam ettirildi',
    subscription_cancel: 'Yenileme kapatıldı',
    subscription_past_due: 'Ücret alınamadı (bakiye yetersiz)',
    subscription_expired: 'Abonelik bitti, site askıya alındı',
    subscription_admin: 'Yönetim aboneliği güncelledi',
    theme_changed: 'Tema değişti',
    domain_activated: 'Alan adı aktif oldu',
    branding_changed: 'Logo / simge değişti',
    page_reset: 'Yasal sayfa otomatiğe döndü'
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
      if (view === 'payments') await loadPayments();
      if (view === 'paysettings') await loadPaySettings();
      if (view === 'pages') await loadPagesView();
      if (view === 'subscription') await loadSubscription();
      if (view === 'appearance') await loadThemes();
      if (view === 'domain') await loadDomains();
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
    // Menude bekleyen havale sayisi (sayfa acilir acilmaz gorunsun).
    api('/payments?status=pending&method=bank').then(d => setPayCount(d.pending_bank)).catch(() => {});
  }

  function bind() {
    $('#pn-login-form').addEventListener('submit', submitLogin);
    $('#pn-logout').addEventListener('click', logout);
    $('#pn-default-markup-form').addEventListener('submit', saveDefaultMarkup);
    $('#pn-site-form').addEventListener('submit', saveSite);
    $('#pn-domain-form').addEventListener('submit', addDomain);
    document.addEventListener('change', event => {
      if (event.target.matches('[data-brand-upload]')) uploadBrand(event.target);
    });
    $('#pn-hide-name').addEventListener('change', async event => {
      try { renderBranding(await api('/branding', { method: 'PUT', body: JSON.stringify({ hide_name: event.target.checked }) })); toast('Kaydedildi.'); }
      catch (err) { toast(err.message, 'error'); }
    });
    $('#pn-color-picker').addEventListener('input', event => { $('#pn-site-form').primary_color.value = event.target.value; });
    $('#pn-svc-category').addEventListener('change', renderServices);
    $('#pn-svc-filter').addEventListener('change', renderServices);
    $('#pn-svc-search').addEventListener('input', debounce(renderServices, 150));
    $('#pn-cust-search').addEventListener('input', debounce(loadCustomers, 300));
    $('#pn-ord-status').addEventListener('change', () => { state.orderPage = 1; loadOrders(); });
    $('#pn-ord-search').addEventListener('input', debounce(() => { state.orderPage = 1; loadOrders(); }, 300));
    $('#pn-pay-status').addEventListener('change', () => { state.payPage = 1; loadPayments(); });
    $('#pn-pay-method').addEventListener('change', () => { state.payPage = 1; loadPayments(); });
    document.addEventListener('submit', event => {
      if (event.target.matches('[data-pay-settings]')) { event.preventDefault(); savePaySettings(event.target); }
    });
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
      const payPage = t.closest('[data-pay-page]');
      if (payPage && !payPage.disabled) { state.payPage = Number(payPage.dataset.payPage); loadPayments(); return; }
      const approve = t.closest('[data-pay-approve]');
      if (approve) { approvePayment(Number(approve.dataset.payApprove), Number(approve.dataset.amount), approve.dataset.name); return; }
      const reject = t.closest('[data-pay-reject]');
      if (reject) { rejectPayment(Number(reject.dataset.payReject)); return; }
      if (t.closest('[data-sub-continue]')) { subscriptionAction('continue'); return; }
      const domainCheck = t.closest('[data-domain-check]');
      if (domainCheck) { checkDomain(Number(domainCheck.dataset.domainCheck), domainCheck); return; }
      const domainRemove = t.closest('[data-domain-remove]');
      if (domainRemove) { removeDomain(Number(domainRemove.dataset.domainRemove), domainRemove.dataset.name); return; }
      const brandRemove = t.closest('[data-brand-remove]');
      if (brandRemove) { removeBrand(brandRemove.dataset.brandRemove); return; }
      const themeUse = t.closest('[data-theme-use]');
      if (themeUse) { useTheme(themeUse.dataset.themeUse); return; }
      if (t.closest('[data-sub-cancel]')) { subscriptionAction('cancel'); return; }
      const pageEdit = t.closest('[data-page-edit]');
      if (pageEdit) { editPage(pageEdit.dataset.pageEdit); return; }
      const pageReset = t.closest('[data-page-reset]');
      if (pageReset) { resetPage(pageReset.dataset.pageReset); return; }
      const tab = t.closest('[data-log-tab]');
      if (tab) { state.logTab = tab.dataset.logTab; loadLogs(); }
    });
    window.addEventListener('popstate', () => showView(viewFromPath(location.pathname)));
  }

  bind();
  start();
})();
