// Bayi yonetim paneli (bayi.com/admin): tek sayfa uygulamasi.
// Sunucu /admin ve alt adreslerine ayni HTML'i verir; gorunum yola gore secilir.
(function () {
  'use strict';

  const VIEWS = {
    dashboard: { path: '/admin', title: 'Özet' },
    services: { path: '/admin/services', title: 'Servisler & Fiyatlar' },
    customers: { path: '/admin/customers', title: 'Müşteriler' },
    orders: { path: '/admin/orders', title: 'Siparişler' },
    digital: { path: '/admin/digital', title: 'Dijital Ürünler' },
    providers: { path: '/admin/providers', title: 'Sağlayıcılarım' },
    content: { path: '/admin/content', title: 'Blog & Sayfalar' },
    payments: { path: '/admin/payments', title: 'Ödemeler' },
    paysettings: { path: '/admin/payment-settings', title: 'Ödeme Ayarları' },
    site: { path: '/admin/site', title: 'Site Ayarları' },
    mail: { path: '/admin/mail', title: 'E-posta & API' },
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
  const state = { me: null, services: null, selected: new Set(), orderPage: 1, payPage: 1, logTab: 'activity', logs: null, pages: [], callbackUrls: {}, digital: null, dgTab: 'products', dgPage: 1 };

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
    // Demo panel: sifresiz ve salt okunur; cikis yerine siteye/bayilik sayfasina donus.
    const demoBox = $('#pn-demo');
    demoBox.hidden = !me.demo;
    $('#pn-logout').hidden = Boolean(me.demo);
    if (me.demo) {
      demoBox.innerHTML = `<span><strong>DEMO</strong>Yönetim panelini gez; ayarlar, fiyatlar ve listeler gerçek paneldekiyle aynı. Değişiklikler kaydedilmez.</span>
        <span class="pn-demo-actions"><a href="/">Siteye dön</a>${me.demo.jet_url ? `<a href="${escapeHtml(me.demo.jet_url)}/bayilik">Bayilik sayfası</a>` : ''}</span>`;
    }
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

  // Deneme sonrasi site yalnizca bayinin kendi alan adinda acilir.
  function hasActiveDomain() {
    return Boolean(state.me?.tenant?.domains?.some(d => d.status === 'active'));
  }

  function timeLeft(sub) {
    return sub.hours_left !== null && sub.hours_left < 48 ? `${sub.hours_left} saat` : `${sub.days_left} gün`;
  }

  // Her sayfanin ustundeki durum seridi: yalnizca yapilacak bir sey varsa gorunur.
  function renderBillingBanner(sub) {
    const box = $('#pn-billing');
    if (!sub || sub.plan_status === 'comp') { box.hidden = true; return; }
    const fee = money(sub.fee);
    const topUp = state.me?.top_up_url ? `<a class="sf-btn sf-btn-ghost sf-btn-sm" href="${escapeHtml(state.me.top_up_url)}" target="_blank" rel="noopener">Jet bakiyesi yükle</a>` : '';
    const pay = label => `<button type="button" class="sf-btn sf-btn-primary sf-btn-sm" data-sub-continue>${escapeHtml(label)}</button>`;
    const connect = '<a class="sf-btn sf-btn-primary sf-btn-sm" href="/admin/domain" data-go="domain">Alan adını bağla</a>';
    let tone = 'info';
    let text = '';
    let actions = '';
    if (sub.plan_status === 'trial') {
      if (!hasActiveDomain()) {
        text = `Ücretsiz deneme: ${timeLeft(sub)} kaldı. Devam etmek için önce kendi alan adını bağla, sonra ${fee}/ay ile devam et; deneme adresi deneme bitince kapanır.`;
        actions = connect;
        tone = sub.hours_left !== null && sub.hours_left <= 24 ? 'warn' : 'info';
      } else if (sub.auto_renew) {
        text = `Deneme ${day(sub.trial_ends_at)} tarihinde bitiyor; ${fee} Jet bakiyenden alınacak.`;
        if (!sub.balance_enough) { tone = 'warn'; text += ' Bakiyen şu an yetersiz.'; actions = topUp; }
      } else {
        text = `Ücretsiz deneme: ${timeLeft(sub)} kaldı. Alan adın hazır; devam etmezsen deneme bitince site kapanır.`;
        actions = pay(`${fee}/ay ile devam et`);
        tone = sub.hours_left !== null && sub.hours_left <= 24 ? 'warn' : 'info';
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

  const PACKAGE_FEATURES = {
    standart: ['Hazır site ve yönetim paneli', 'Jet servisleri %10 indirimli, fiyatı sen belirlersin', 'Jet dijital ürünleri', 'Kendi alan adın ve otomatik SSL', '10 tema, logo ve renk', 'Ödemeler doğrudan sana, müşteri API\'si'],
    pro: ['Standart\'taki her şey', 'Kendi SMM sağlayıcılarını bağla', 'Blog yazıları', 'Satış sayfaları (SEO)', 'Kendi dijital ürünlerin', 'Jet servisleri Jet fiyatından itibaren satılır; en az 50 Jet servisi açık kalır']
  };

  function renderPackages(sub) {
    const box = $('#pn-packages');
    if (!sub.fees) { box.innerHTML = ''; return; }
    box.innerHTML = ['standart', 'pro'].map(key => {
      const current = sub.package === key;
      const pending = sub.pending_package === key;
      let action = '';
      if (pending) action = `<span class="sf-badge sf-badge-pending">${day(sub.paid_until)} tarihinde geçilecek</span>`;
      else if (current && sub.pending_package) action = `<button type="button" class="sf-btn sf-btn-ghost sf-btn-sm" data-package-change="${key}">Pro'da kal</button>`;
      else if (current) action = '<span class="sf-badge sf-badge-completed">Kullandığın paket</span>';
      else if (sub.plan_status !== 'comp') action = `<button type="button" class="sf-btn sf-btn-primary sf-btn-sm" data-package-change="${key}">${key === 'pro' ? 'Pro\'ya geç' : 'Standart\'a geç'}</button>`;
      return `<div class="sf-card pn-package${current ? ' is-current' : ''}">
        <div class="pn-pay-head"><h3>${key === 'pro' ? 'Pro' : 'Standart'}</h3><strong>${money(sub.fees[key])}<small>/ay</small></strong></div>
        <ul>${PACKAGE_FEATURES[key].map(item => `<li><i class="fa-solid fa-check" aria-hidden="true"></i> ${escapeHtml(item)}</li>`).join('')}</ul>
        <div class="pn-row-actions" style="justify-content:flex-start;">${action}</div>
      </div>`;
    }).join('');
  }

  async function changePackage(pkg) {
    const sub = state.subscription;
    let message;
    if (sub.plan_status === 'active' && pkg === 'pro' && sub.package !== 'pro') message = `Pro'ya hemen geçersin; bu dönemin kalan günlerinin farkı Jet bakiyenden alınır. Sonraki aylar ${money(sub.fees.pro)}.`;
    else if (sub.plan_status === 'active' && pkg === 'standart') message = `Standart'a ${day(sub.paid_until)} tarihinde geçersin; o güne kadar Pro özellikleri açık kalır. Sonra kendi sağlayıcıların, blogun ve satış sayfaların sitende gizlenir.`;
    else message = `${pkg === 'pro' ? 'Pro' : 'Standart'} paketine geçeceksin; aylık ücret ${money(sub.fees[pkg])} olur.`;
    if (!(await confirmBox('Paket değişikliği', message, 'Onayla'))) return;
    try {
      toast((await api('/subscription/package', { method: 'POST', body: JSON.stringify({ package: pkg }) })).message);
      await loadMe();
      await loadSubscription();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function loadSubscription() {
    const d = await api('/subscription');
    const sub = d.subscription;
    state.subscription = sub;
    renderPackages(sub);
    const [label, cls] = PLAN_LABEL[sub.plan_status] || PLAN_LABEL.trial;
    const rows = [['Paket', `${sub.package_name}${sub.pending_package ? ` (${day(sub.paid_until)} tarihinde Standart)` : ''}`]];
    if (sub.plan_status !== 'comp') rows.push(['Kendi alan adı', d.has_domain ? 'Bağlı' : 'Bağlı değil (devam için gerekli)']);
    if (sub.plan_status === 'trial') rows.push(['Deneme bitişi', day(sub.trial_ends_at)], ['Kalan', timeLeft(sub)]);
    if (sub.plan_status === 'active') rows.push(['Dönem sonu', day(sub.paid_until)], ['Otomatik yenileme', sub.auto_renew ? 'Açık' : 'Kapalı']);
    if (sub.plan_status === 'past_due') rows.push(['Son ödeme günü', day(sub.grace_ends_at)]);
    if (sub.plan_status === 'expired') rows.push(['Silinme tarihi', day(sub.delete_at)]);
    rows.push(['Aylık ücret', sub.plan_status === 'comp' ? 'Ücretsiz' : money(sub.fee)], ['Jet bakiyen', money(sub.owner_balance)]);
    let actions = '';
    if (sub.plan_status !== 'comp' && !d.has_domain) {
      actions = '<a class="sf-btn sf-btn-primary" href="/admin/domain" data-go="domain">Önce alan adını bağla</a>';
    } else if (sub.plan_status === 'trial' || sub.plan_status === 'active') {
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
      `İlk ${d.trial_days} gün ücretsiz ve deneme adresinde açılır. Devam etmek için kendi alan adını bağlayıp "Devam et"e basarsın; deneme bitince site yalnızca kendi alan adında açılır.`,
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
    const proNote = $('#pn-svc-pro');
    proNote.hidden = !data.pro;
    if (data.pro && data.pro_minimum) {
      proNote.textContent = `Pro paket: Jet servisleri Jet fiyatının altına satılamaz (kârın Jet fiyatının altında kalırsa fiyat Jet fiyatına çıkar). En az ${data.pro_minimum.required} Jet servisi satışta kalmalı; şu an ${data.pro_minimum.enabled} açık.`;
    }
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
        <td class="pn-num">${money(s.price)} <span class="pn-sub">${mode}${state.services.pro ? ` · taban ${money(s.jet_price)}` : ''}</span></td>
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
        <div class="pn-preview">Maliyetiniz: <strong>${money(s.cost)}</strong> ${unitLabel(s)}${state.services.pro ? ` · Jet fiyatı (en düşük satış): <strong>${money(s.jet_price)}</strong>` : ''}</div>
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
      // Pro: Jet servisleri Jet fiyatinin altina satilamaz.
      if (state.services.pro && m !== 'fixed') price = Math.max(price, s.jet_price);
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
        <button type="button" class="sf-btn sf-btn-ghost sf-btn-sm" data-cust-password="${c.id}" data-name="${escapeHtml(c.username)}" title="Yeni şifre belirle"><i class="fa-solid fa-key" aria-hidden="true"></i></button>
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

  // Musteriye yeni sifre: e-posta (SMTP) kurulu degilse sifre sifirlamanin yolu.
  function setCustomerPassword(id, name) {
    const random = () => {
      const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const bytes = crypto.getRandomValues(new Uint8Array(12));
      return Array.from(bytes, b => chars[b % chars.length]).join('');
    };
    openModal(`${name} için yeni şifre`, `
      <form class="sf-form" id="pn-cust-pass-form" novalidate>
        <p class="sf-muted" style="margin:0;">Şifreyi müşterine kendin ilet. Müşterinin açık oturumları kapanır.</p>
        <label>Yeni şifre <small>(en az 10 karakter)</small>
          <span class="pn-color-row"><input name="password" class="sf-input" minlength="10" maxlength="128" value="${random()}" autocomplete="off"><button type="button" class="sf-btn sf-btn-ghost sf-btn-sm" id="pn-pass-random">Yenile</button></span>
        </label>
        <p class="sf-form-error" role="alert"></p>
        <button type="submit" class="sf-btn sf-btn-primary">Kaydet</button>
      </form>`);
    const form = $('#pn-cust-pass-form');
    $('#pn-pass-random').addEventListener('click', () => { form.password.value = random(); });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const password = form.password.value;
      if (password.length < 10) { $('.sf-form-error', form).textContent = 'Şifre en az 10 karakter olmalı.'; return; }
      try {
        const res = await api(`/customers/${id}/password`, { method: 'POST', body: JSON.stringify({ password }) });
        closeModal();
        toast(res.message);
      } catch (err) {
        $('.sf-form-error', form).textContent = err.message;
      }
    });
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
      const types = { order: 'Sipariş', refund: 'İade', manual_add: 'Bakiye ekleme', manual_subtract: 'Bakiye düşme', deposit: 'Yükleme', digital_order: 'Dijital sipariş' };
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

  // ------------------------------------------------------------- dijital urunler
  // Katalog Jet'in dijital urunleridir; alis fiyati Jet fiyatindan bayi
  // indirimiyle hesaplanir, satis fiyati kar orani ya da sabit fiyatla.
  const DG_STATUS = { pending: 'processing', processing: 'processing', completed: 'completed', failed: 'canceled', refunded: 'canceled' };
  const DG_LABEL = { pending: 'Hazırlanıyor', processing: 'Hazırlanıyor', completed: 'Teslim edildi', failed: 'İade edildi', refunded: 'İade edildi' };

  async function loadDigital() {
    const d = await api('/digital');
    state.digital = d;
    const form = $('#pn-dg-settings-form');
    form.enabled.checked = d.enabled;
    form.markup.value = d.own_markup ?? '';
    form.markup.placeholder = `Servislerle aynı (%${state.me?.tenant?.default_markup_percent ?? d.markup_percent})`;
    $('#pn-dg-help').textContent = `Alış fiyatınız Jet fiyatından %${d.discount_percent} indirimlidir. Özel ayar yapmadığınız ürünler alışınızın üzerine %${d.markup_percent} eklenerek satılır. Müşteri satın aldığında tutar müşterinin bakiyesinden, alış fiyatı sizin bakiyenizden düşer; bilgiler müşteriye anında teslim edilir.`;
    renderDigitalProducts();
    if (state.dgTab === 'orders') await loadDigitalOrders();
  }

  function renderDigitalProducts() {
    const d = state.digital;
    if (!d) return;
    const q = $('#pn-dg-search').value.trim().toLocaleLowerCase('tr-TR');
    const rows = d.products.filter(p => !q || `${p.name} ${p.category}`.toLocaleLowerCase('tr-TR').includes(q));
    $('#pn-dg-products').innerHTML = rows.length ? rows.map(p => {
      let status;
      if (p.below_cost) status = '<span class="sf-badge sf-badge-canceled">Zararına · gizli</span>';
      else if (!p.enabled) status = '<span class="sf-badge sf-badge-pending">Satışta değil</span>';
      else if (p.stock !== null && p.stock <= 0) status = '<span class="sf-badge sf-badge-pending">Stok yok</span>';
      else status = '<span class="sf-badge sf-badge-completed">Satışta</span>';
      const mode = p.mode === 'fixed' ? 'sabit fiyat' : (p.mode === 'custom' ? `özel %${p.markup_percent}` : `varsayılan %${d.markup_percent}`);
      const thumb = p.image ? `<img class="pn-dg-thumb" src="${escapeHtml(p.image)}" alt="" loading="lazy">` : '<span class="pn-dg-thumb"><i class="fa-solid fa-key" aria-hidden="true"></i></span>';
      return `<tr>
        <td><div class="pn-dg-name">${thumb}<div><strong>${escapeHtml(p.name)}</strong>${p.category ? `<span class="pn-sub">${escapeHtml(p.category)}</span>` : ''}</div></div></td>
        <td>${p.stock === null ? '—' : num(p.stock)}</td>
        <td class="pn-num">${money(p.cost)} <span class="pn-sub">Jet fiyatı ${money(p.jet_price)}</span></td>
        <td class="pn-num">${money(p.sell)} <span class="pn-sub">${mode}</span></td>
        <td>${profitCell(p.profit)}</td>
        <td>${status}</td>
        <td><button type="button" class="sf-btn sf-btn-ghost sf-btn-sm" data-dg-edit="${p.id}">Düzenle</button></td>
      </tr>`;
    }).join('') : `<tr><td colspan="7" class="sf-muted">${d.products.length ? 'Aramaya uyan ürün yok.' : 'Şu anda satışta dijital ürün yok.'}</td></tr>`;
  }

  function editDigital(id) {
    const d = state.digital;
    const p = d?.products.find(x => x.id === id);
    if (!p) return;
    const mode = p.mode === 'fixed' ? 'fixed' : (p.mode === 'custom' ? 'markup' : 'default');
    openModal(p.name, `
      <form class="sf-form" id="pn-dg-form" novalidate>
        <div class="pn-preview">Alışınız: <strong>${money(p.cost)}</strong> / adet${d.pro ? ` · Jet fiyatı (en düşük satış): <strong>${money(p.jet_price)}</strong>` : ''}</div>
        ${p.below_cost ? '<p class="pn-alert pn-alert-warn" style="margin:0;">Bu ürünün sağlayıcı maliyeti şu an alış fiyatınızın üzerinde; fiyat düşene kadar sitenizde gizli kalır.</p>' : ''}
        <div class="pn-radio-group">
          <label class="pn-radio"><input type="radio" name="mode" value="default" ${mode === 'default' ? 'checked' : ''}> Varsayılan kâr (%${d.markup_percent})</label>
          <label class="pn-radio"><input type="radio" name="mode" value="markup" ${mode === 'markup' ? 'checked' : ''}> Bu ürüne özel kâr oranı</label>
          <label class="pn-radio"><input type="radio" name="mode" value="fixed" ${mode === 'fixed' ? 'checked' : ''}> Sabit satış fiyatı</label>
        </div>
        <label id="pn-dg-markup-label">Kâr oranı (%)<input name="markup" type="number" min="0" max="1000" step="0.1" class="sf-input" value="${p.markup_percent ?? d.markup_percent}"></label>
        <label id="pn-dg-fixed-label">Satış fiyatı (₺ / adet)<input name="fixed" type="number" min="${p.cost}" step="0.01" class="sf-input" value="${p.fixed_price ?? p.sell}"></label>
        <label class="pn-radio"><input type="checkbox" name="enabled" ${p.enabled ? 'checked' : ''}> Sitede satışta</label>
        <div class="pn-preview" id="pn-dg-preview"></div>
        <p class="sf-form-error" role="alert"></p>
        <button type="submit" class="sf-btn sf-btn-primary">Kaydet</button>
      </form>`);
    const form = $('#pn-dg-form');
    const update = () => {
      const m = form.mode.value;
      $('#pn-dg-markup-label').hidden = m !== 'markup';
      $('#pn-dg-fixed-label').hidden = m !== 'fixed';
      const rate = m === 'markup' ? Number(form.markup.value) || 0 : d.markup_percent;
      let price = m === 'fixed' ? Number(form.fixed.value) || 0 : Math.round(p.cost * 100 * (100 + rate) / 100) / 100;
      if (d.pro && m !== 'fixed') price = Math.max(price, p.jet_price);
      const profit = price - p.cost;
      $('#pn-dg-preview').innerHTML = `Müşterinin göreceği fiyat: <strong>${money(price)}</strong> / adet · kârınız <span class="${profit >= 0 ? 'pn-profit-pos' : 'pn-profit-neg'}">${money(profit)}</span>`;
    };
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    update();
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const m = form.mode.value;
      const body = {
        enabled: form.enabled.checked,
        markup_percent: m === 'markup' ? Number(form.markup.value) : null,
        fixed_price: m === 'fixed' ? Number(form.fixed.value) : null
      };
      try {
        const res = await api(`/digital/products/${p.id}`, { method: 'PUT', body: JSON.stringify(body) });
        closeModal();
        toast(res.message);
        await loadDigital();
      } catch (err) {
        $('.sf-form-error', form).textContent = err.message;
      }
    });
  }

  async function saveDigitalSettings(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const raw = form.markup.value.trim();
    if (raw !== '' && !(Number(raw) >= 0)) { toast('Geçerli bir oran girin.', 'error'); return; }
    try {
      const res = await api('/digital/settings', { method: 'PUT', body: JSON.stringify({ enabled: form.enabled.checked, markup_percent: raw === '' ? null : Number(raw) }) });
      toast(res.message);
      await loadDigital();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function loadDigitalOrders() {
    const d = await api(`/digital/orders?page=${state.dgPage}`);
    $('#pn-dg-orders').innerHTML = d.orders.length ? d.orders.map(o => `<tr>
      <td>#D${o.id}</td>
      <td>${escapeHtml(o.customer || '—')}</td>
      <td>${escapeHtml(o.product_name)}</td>
      <td>${num(o.quantity)}</td>
      <td class="pn-num">${money(o.paid)}${o.refunded > 0 ? `<span class="pn-sub">iade ${money(o.refunded)}</span>` : ''}</td>
      <td class="pn-num">${money(o.cost)}</td>
      <td>${profitCell(o.profit)}</td>
      <td><span class="sf-badge sf-badge-${DG_STATUS[o.status] || 'processing'}">${DG_LABEL[o.status] || 'Hazırlanıyor'}</span></td>
      <td>${formatDate(o.created_at)}</td></tr>`).join('') : '<tr><td colspan="9" class="sf-muted">Henüz dijital ürün satışınız yok.</td></tr>';
    $('#pn-dg-pager').innerHTML = d.pages > 1 ? `
      <button type="button" class="sf-btn sf-btn-ghost sf-btn-sm" data-dg-page="${d.page - 1}" ${d.page <= 1 ? 'disabled' : ''}>Önceki</button>
      <span class="sf-muted">${d.page} / ${d.pages} · ${num(d.total)} satış</span>
      <button type="button" class="sf-btn sf-btn-ghost sf-btn-sm" data-dg-page="${d.page + 1}" ${d.page >= d.pages ? 'disabled' : ''}>Sonraki</button>` : `<span class="sf-muted">${num(d.total)} satış</span>`;
  }

  function switchDigitalTab(tab) {
    state.dgTab = tab;
    $$('[data-dg-tab]').forEach(btn => btn.classList.toggle('active', btn.dataset.dgTab === tab));
    $$('[data-dg-panel]').forEach(panel => { panel.hidden = panel.dataset.dgPanel !== tab; });
    if (tab === 'orders') loadDigitalOrders().catch(err => toast(err.message, 'error'));
  }

  // ------------------------------------------------------------- kendi saglayicilar (Pro)
  const OWN_STATUS = { pending: 'processing', processing: 'processing', completed: 'completed', partial: 'partial', canceled: 'canceled', failed: 'canceled' };
  const OWN_LABEL = { pending: 'Bekliyor', processing: 'İşleniyor', completed: 'Tamamlandı', partial: 'Kısmi', canceled: 'İptal', failed: 'Gönderilemedi' };

  async function loadOwn() {
    const d = await api('/own');
    state.own = d;
    $('#pn-own-lock').hidden = d.pro;
    $('#pn-own-body').hidden = !d.pro;
    if (!d.pro) return;
    $('#pn-own-providers').innerHTML = d.providers.length ? d.providers.map(p => `<li>
        <div><strong>${escapeHtml(p.name)}</strong>${p.status ? '' : ' <span class="sf-badge sf-badge-pending">Kapalı</span>'}
          <span class="pn-sub">${escapeHtml(p.api_url)} · bakiye ${escapeHtml(p.balance ?? '—')} ${escapeHtml(p.currency || '')} · ${num(p.service_count)} servis</span></div>
        <span class="pn-actions">
          <button type="button" class="sf-btn sf-btn-primary sf-btn-sm" data-own-import="${p.id}">Servis ekle</button>
          <button type="button" class="sf-btn sf-btn-ghost sf-btn-sm" data-own-refresh="${p.id}" title="Bakiyeyi yenile"><i class="fa-solid fa-rotate" aria-hidden="true"></i></button>
          <button type="button" class="sf-btn sf-btn-ghost sf-btn-sm" data-own-toggle="${p.id}" data-enabled="${p.status ? '0' : '1'}">${p.status ? 'Kapat' : 'Aç'}</button>
          <button type="button" class="sf-btn sf-btn-ghost sf-btn-sm" data-own-remove="${p.id}" data-name="${escapeHtml(p.name)}" title="Kaldır"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
        </span></li>`).join('') : '<li class="sf-muted">Henüz sağlayıcı bağlamadın.</li>';
    renderOwnServices();
    await loadOwnOrders();
  }

  function renderOwnServices() {
    const q = $('#pn-own-search').value.trim().toLocaleLowerCase('tr-TR');
    const rows = (state.own?.services || []).filter(s => !q || `${s.name} ${s.category} ${s.provider_name}`.toLocaleLowerCase('tr-TR').includes(q));
    $('#pn-own-services').innerHTML = rows.length ? rows.map(s => `<tr>
      <td>#${s.id}</td>
      <td><strong>${escapeHtml(s.name)}</strong><span class="pn-sub">${escapeHtml(s.category)} · ${escapeHtml(s.provider_name || '')} #${escapeHtml(s.provider_service_id)}</span></td>
      <td class="pn-num">${escapeHtml(s.provider_rate || '—')}</td>
      <td class="pn-num">${money(s.rate)}</td>
      <td>${num(s.min)} - ${num(s.max)}</td>
      <td>${s.enabled ? '<span class="sf-badge sf-badge-completed">Satışta</span>' : '<span class="sf-badge sf-badge-pending">Satışta değil</span>'}</td>
      <td class="pn-actions"><button type="button" class="sf-btn sf-btn-ghost sf-btn-sm" data-own-edit="${s.local_id}">Düzenle</button>
        <button type="button" class="sf-btn sf-btn-ghost sf-btn-sm" data-own-delete="${s.local_id}" title="Sil"><i class="fa-solid fa-trash" aria-hidden="true"></i></button></td>
    </tr>`).join('') : `<tr><td colspan="7" class="sf-muted">${state.own?.services?.length ? 'Aramaya uyan servis yok.' : 'Henüz kendi servisin yok; bir sağlayıcı bağlayıp "Servis ekle"ye bas.'}</td></tr>`;
  }

  async function loadOwnOrders() {
    const d = await api(`/own/orders?page=${state.ownPage || 1}`);
    $('#pn-own-orders').innerHTML = d.orders.length ? d.orders.map(o => `<tr>
      <td>#${o.id}</td><td>${escapeHtml(o.customer || '—')}</td><td>${escapeHtml(o.service_name)}</td><td>${num(o.quantity)}</td>
      <td class="pn-num">${money(o.charge - o.refunded)}${o.refunded > 0 ? `<span class="pn-sub">iade ${money(o.refunded)}</span>` : ''}</td>
      <td>${escapeHtml(o.provider_name || '—')}${o.provider_order_id ? `<span class="pn-sub">#${escapeHtml(o.provider_order_id)}</span>` : ''}${o.error ? `<span class="pn-sub" style="color:var(--danger);">${escapeHtml(o.error)}</span>` : ''}</td>
      <td><span class="sf-badge sf-badge-${OWN_STATUS[o.status] || 'processing'}">${OWN_LABEL[o.status] || o.status}</span></td>
      <td>${formatDate(o.created_at)}</td></tr>`).join('') : '<tr><td colspan="8" class="sf-muted">Henüz kendi sağlayıcı siparişi yok.</td></tr>';
    $('#pn-own-pager').innerHTML = d.pages > 1 ? `
      <button type="button" class="sf-btn sf-btn-ghost sf-btn-sm" data-own-page="${d.page - 1}" ${d.page <= 1 ? 'disabled' : ''}>Önceki</button>
      <span class="sf-muted">${d.page} / ${d.pages}</span>
      <button type="button" class="sf-btn sf-btn-ghost sf-btn-sm" data-own-page="${d.page + 1}" ${d.page >= d.pages ? 'disabled' : ''}>Sonraki</button>` : '';
  }

  async function addOwnProvider(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const errorEl = $('.sf-form-error', form);
    errorEl.textContent = '';
    const button = $('button[type=submit]', form);
    button.disabled = true;
    try {
      const res = await api('/own/providers', { method: 'POST', body: JSON.stringify({ name: form.name.value.trim(), api_url: form.api_url.value.trim(), api_key: form.api_key.value.trim() }) });
      form.reset();
      toast(res.message);
      await loadOwn();
    } catch (err) {
      errorEl.textContent = err.message;
    } finally {
      button.disabled = false;
    }
  }

  async function importOwnServices(providerId) {
    openModal('Servis ekle', '<p class="sf-muted">Sağlayıcının servis listesi alınıyor…</p>', { wide: true });
    let d;
    try {
      d = await api(`/own/providers/${providerId}/services`);
    } catch (err) {
      openModal('Servis ekle', `<p class="sf-form-error">${escapeHtml(err.message)}</p>`);
      return;
    }
    openModal(`Servis ekle · ${d.provider.name}`, `
      <form class="sf-form" id="pn-own-import-form" novalidate>
        <div class="pn-filters" style="margin:0;"><input type="search" class="sf-input" id="pn-own-import-search" placeholder="Ara (ad veya kategori)"></div>
        <div class="sf-table-wrap pn-own-import-list"><table class="sf-table"><thead><tr><th><input type="checkbox" id="pn-own-import-all" aria-label="Tümünü seç"></th><th>Servis</th><th>Fiyat (1000)</th><th>Min - Maks</th></tr></thead>
          <tbody id="pn-own-import-rows"></tbody></table></div>
        <label>Kâr oranı (%) <small>satış = sağlayıcı fiyatı × kur × (1 + kâr); sonra servis servis değiştirebilirsin</small><input name="markup" type="number" min="0" max="1000" step="1" value="50" class="sf-input"></label>
        <p class="sf-form-error" role="alert"></p>
        <button type="submit" class="sf-btn sf-btn-primary">Seçilenleri ekle</button>
      </form>`, { wide: true });
    const form = $('#pn-own-import-form');
    const selected = new Set();
    const render = () => {
      const q = $('#pn-own-import-search').value.trim().toLocaleLowerCase('tr-TR');
      const rows = d.services.filter(s => !q || `${s.name} ${s.category}`.toLocaleLowerCase('tr-TR').includes(q)).slice(0, 300);
      $('#pn-own-import-rows').innerHTML = rows.map(s => `<tr>
        <td><input type="checkbox" data-pick="${escapeHtml(s.service)}" ${selected.has(s.service) ? 'checked' : ''}></td>
        <td><strong>${escapeHtml(s.name)}</strong><span class="pn-sub">${escapeHtml(s.category)} · #${escapeHtml(s.service)}${s.imported ? ' · eklendi' : ''}</span></td>
        <td class="pn-num">${escapeHtml(String(s.rate))} ${escapeHtml(d.provider.currency || '')}</td><td>${num(s.min)} - ${num(s.max)}</td></tr>`).join('')
        || '<tr><td colspan="4" class="sf-muted">Servis bulunamadı.</td></tr>';
    };
    form.addEventListener('change', event => {
      const pick = event.target.closest('[data-pick]');
      if (pick) { if (pick.checked) selected.add(pick.dataset.pick); else selected.delete(pick.dataset.pick); }
      if (event.target.id === 'pn-own-import-all') {
        $$('[data-pick]', form).forEach(box => { box.checked = event.target.checked; if (box.checked) selected.add(box.dataset.pick); else selected.delete(box.dataset.pick); });
      }
    });
    $('#pn-own-import-search').addEventListener('input', debounce(render, 150));
    render();
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!selected.size) { $('.sf-form-error', form).textContent = 'En az bir servis seç.'; return; }
      try {
        const res = await api(`/own/providers/${providerId}/import`, { method: 'POST', body: JSON.stringify({ service_ids: [...selected], markup_percent: Number(form.markup.value) || 0 }) });
        closeModal();
        toast(res.message);
        await loadOwn();
      } catch (err) {
        $('.sf-form-error', form).textContent = err.message;
      }
    });
  }

  function editOwnService(localId) {
    const s = state.own.services.find(x => x.local_id === localId);
    if (!s) return;
    openModal(s.name, `
      <form class="sf-form" id="pn-own-edit" novalidate>
        <div class="pn-preview">Sağlayıcı fiyatı: <strong>${escapeHtml(s.provider_rate || '—')}</strong> / 1000</div>
        <label>Sitede görünen ad<input name="name" class="sf-input" maxlength="200" value="${escapeHtml(s.name)}"></label>
        <label>Kategori<input name="category" class="sf-input" maxlength="100" value="${escapeHtml(s.category)}"></label>
        <label>Açıklama <small>(isteğe bağlı)</small><textarea name="description" class="sf-input" rows="2" maxlength="1000">${escapeHtml(s.description)}</textarea></label>
        <label>Satış fiyatı (₺ / 1000)<input name="rate" type="number" min="0.01" step="0.01" class="sf-input" value="${s.rate}"></label>
        <label class="pn-radio"><input type="checkbox" name="enabled" ${s.enabled ? 'checked' : ''}> Sitede satışta</label>
        <p class="sf-form-error" role="alert"></p>
        <button type="submit" class="sf-btn sf-btn-primary">Kaydet</button>
      </form>`);
    const form = $('#pn-own-edit');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      try {
        const res = await api(`/own/services/${localId}`, { method: 'PUT', body: JSON.stringify({
          name: form.name.value.trim(), category: form.category.value.trim(), description: form.description.value.trim(),
          rate: Number(form.rate.value), enabled: form.enabled.checked
        }) });
        closeModal();
        toast(res.message);
        await loadOwn();
      } catch (err) {
        $('.sf-form-error', form).textContent = err.message;
      }
    });
  }

  async function ownAction(fn, message) {
    try {
      const res = await fn();
      if (res?.message || message) toast(res?.message || message);
      await loadOwn();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // ------------------------------------------------------------- blog & satis sayfalari (Pro)
  async function loadContent() {
    const d = await api('/content');
    state.content = d;
    state.contentTab = state.contentTab || 'blog';
    $('#pn-content-lock').hidden = d.pro;
    $('#pn-content-body').hidden = !d.pro;
    if (d.pro) renderContent();
  }

  function siteOrigin() {
    const domain = state.me?.tenant?.domains?.find(x => x.status === 'active')?.domain;
    return `https://${domain || state.me?.tenant?.subdomain || location.host}`;
  }

  function renderContent() {
    const tab = state.contentTab;
    $$('[data-content-tab]').forEach(btn => btn.classList.toggle('active', btn.dataset.contentTab === tab));
    const rows = state.content.posts.filter(p => p.type === tab);
    const prefix = tab === 'blog' ? '/blog/' : '/hizmet/';
    $('#pn-content-rows').innerHTML = rows.length ? rows.map(p => `<tr>
      <td><strong>${escapeHtml(p.title)}</strong>${p.excerpt ? `<span class="pn-sub">${escapeHtml(p.excerpt.slice(0, 90))}</span>` : ''}</td>
      <td>${p.status === 'published' ? `<a href="${escapeHtml(siteOrigin() + prefix + p.slug)}" target="_blank" rel="noopener">${escapeHtml(prefix + p.slug)}</a>` : escapeHtml(prefix + p.slug)}</td>
      <td>${p.status === 'published' ? '<span class="sf-badge sf-badge-completed">Yayında</span>' : '<span class="sf-badge sf-badge-pending">Taslak</span>'}</td>
      <td>${formatDate(p.published_at || p.created_at)}</td>
      <td class="pn-actions"><button type="button" class="sf-btn sf-btn-ghost sf-btn-sm" data-content-edit="${p.id}">Düzenle</button>
        <button type="button" class="sf-btn sf-btn-ghost sf-btn-sm" data-content-delete="${p.id}" title="Sil"><i class="fa-solid fa-trash" aria-hidden="true"></i></button></td>
    </tr>`).join('') : `<tr><td colspan="5" class="sf-muted">${tab === 'blog' ? 'Henüz blog yazın yok.' : 'Henüz satış sayfan yok.'}</td></tr>`;
  }

  async function editContent(id) {
    const tab = state.contentTab;
    const post = id ? state.content.posts.find(p => p.id === id) : { type: tab, title: '', slug: '', excerpt: '', body: '', cover_url: '', service_id: null, status: 'draft' };
    if (!post) return;
    let serviceOptions = '';
    if (post.type === 'page') {
      const [svc, own] = await Promise.all([state.services ? state.services : api('/services'), api('/own').catch(() => ({ services: [] }))]);
      state.services = svc;
      const options = [
        ...svc.services.filter(s => s.visible).map(s => [s.id, `#${s.id} ${s.custom_name || s.name}`]),
        ...own.services.filter(s => s.enabled).map(s => [s.id, `#${s.id} ${s.name} (kendi sağlayıcın)`])
      ];
      serviceOptions = `<label>Bağlı servis <small>(sayfada "Sipariş ver" kutusu çıkar)</small><select name="service_id" class="sf-input"><option value="">Servis yok</option>
        ${options.map(([value, label]) => `<option value="${value}"${Number(post.service_id) === value ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></label>`;
    }
    openModal(id ? 'Düzenle' : (post.type === 'blog' ? 'Yeni blog yazısı' : 'Yeni satış sayfası'), `
      <form class="sf-form" id="pn-content-form" novalidate>
        <label>Başlık<input name="title" class="sf-input" maxlength="160" value="${escapeHtml(post.title)}" required></label>
        <label>Adres <small>(${post.type === 'blog' ? '/blog/' : '/hizmet/'}… boş bırakırsan başlıktan oluşur)</small><input name="slug" class="sf-input" maxlength="80" value="${escapeHtml(post.slug)}" placeholder="instagram-takipci-satin-al"></label>
        <label>Kısa açıklama <small>(arama motorlarında görünür, en fazla 300 karakter)</small><input name="excerpt" class="sf-input" maxlength="300" value="${escapeHtml(post.excerpt || '')}"></label>
        <label>Kapak görseli <small>(isteğe bağlı, https:// adresi)</small><input name="cover_url" class="sf-input" maxlength="500" value="${escapeHtml(post.cover_url || '')}"></label>
        ${serviceOptions}
        <label>Metin <small>## ara başlık · ### küçük başlık · - madde · boş satır yeni paragraf</small><textarea name="body" class="sf-input" rows="14" maxlength="30000">${escapeHtml(post.body || '')}</textarea></label>
        <label>Durum<select name="status" class="sf-input"><option value="published"${post.status === 'published' ? ' selected' : ''}>Yayında</option><option value="draft"${post.status === 'draft' ? ' selected' : ''}>Taslak</option></select></label>
        <p class="sf-form-error" role="alert"></p>
        <button type="submit" class="sf-btn sf-btn-primary">Kaydet</button>
      </form>`, { wide: true });
    const form = $('#pn-content-form');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const body = {
        type: post.type, title: form.title.value.trim(), slug: form.slug.value.trim(), excerpt: form.excerpt.value.trim(),
        cover_url: form.cover_url.value.trim(), body: form.body.value, status: form.status.value,
        service_id: form.service_id && form.service_id.value ? Number(form.service_id.value) : null
      };
      try {
        const res = await api(id ? `/content/${id}` : '/content', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
        closeModal();
        toast(res.message);
        await loadContent();
      } catch (err) {
        $('.sf-form-error', form).textContent = err.message;
      }
    });
  }

  // ------------------------------------------------------------- e-posta & API
  const MAIL_KIND = {
    welcome: 'Hoş geldin', payment: 'Bakiye yüklendi', order: 'Sipariş bitti', test: 'Test',
    owner_bank_notice: 'Sana: havale bildirimi', owner_balance_low: 'Sana: bakiye yetmedi'
  };
  const MAIL_STATUS = { sent: ['Gitti', 'completed'], failed: ['Gitmedi', 'canceled'], skipped: ['Atlandı', 'pending'] };

  function renderMail(d) {
    const notify = $('#pn-notify-form');
    notify.welcome.checked = d.notify.welcome;
    notify.payment.checked = d.notify.payment;
    notify.order.checked = d.notify.order;
    const smtp = $('#pn-smtp-form');
    smtp.host.value = d.smtp.host;
    smtp.port.value = String(d.smtp.port || 587);
    smtp.user.value = d.smtp.user;
    smtp.from.value = d.smtp.from;
    smtp.password.value = '';
    smtp.password.placeholder = d.smtp.has_password ? 'Kayıtlı; değiştirmek için yaz' : '';
    const state = $('#pn-smtp-state');
    state.textContent = d.smtp.active ? 'Kurulu' : 'Kurulu değil';
    state.className = `sf-badge sf-badge-${d.smtp.active ? 'completed' : 'pending'}`;
    $('#pn-mail-warning').hidden = d.smtp.active;
    $('#pn-smtp-test').disabled = !d.smtp.active;
    $('#pn-smtp-clear').hidden = !d.smtp.active;
    state.dataset.ownerEmail = d.owner_email || '';
    $('#pn-mail-log').innerHTML = d.log.length ? d.log.map(l => {
      const [label, cls] = MAIL_STATUS[l.status] || MAIL_STATUS.skipped;
      return `<li><b><span>${escapeHtml(MAIL_KIND[l.kind] || l.kind)} · ${escapeHtml(l.recipient || '')}</span><span class="sf-badge sf-badge-${cls}">${label}</span></b>
        <small>${formatDate(l.created_at)} · ${escapeHtml(l.subject || '')}</small>${l.error ? `<small class="pn-mail-err">${escapeHtml(l.error)}</small>` : ''}</li>`;
    }).join('') : '<li class="sf-muted">Henüz e-posta gönderilmedi.</li>';
  }

  async function loadMail() {
    const [mail, apiInfo] = await Promise.all([api('/mail'), api('/api-settings')]);
    renderMail(mail);
    $('#pn-api-enabled').checked = apiInfo.enabled;
    $('#pn-api-info').innerHTML = `<dt>Adres</dt><dd><code>${escapeHtml(apiInfo.url)}</code></dd>
      <dt>Doküman</dt><dd><a href="${escapeHtml(apiInfo.docs_url)}" target="_blank" rel="noopener">${escapeHtml(apiInfo.docs_url)}</a></dd>`;
  }

  async function saveNotify(event) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const res = await api('/mail', { method: 'PUT', body: JSON.stringify({ notify: { welcome: form.welcome.checked, payment: form.payment.checked, order: form.order.checked } }) });
      renderMail(res);
      toast(res.message);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function saveSmtp(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const errorEl = $('.sf-form-error', form);
    errorEl.textContent = '';
    const smtp = {
      host: form.host.value.trim(), port: Number(form.port.value), secure: form.port.value === '465',
      user: form.user.value.trim(), password: form.password.value, from: form.from.value.trim()
    };
    if (!smtp.host || !smtp.user || !smtp.from) { errorEl.textContent = 'Sunucu, kullanıcı adı ve gönderen e-posta gerekli.'; return; }
    try {
      const res = await api('/mail', { method: 'PUT', body: JSON.stringify({ smtp }) });
      renderMail(res);
      toast(res.message);
    } catch (err) {
      errorEl.textContent = err.message;
    }
  }

  async function testSmtp(button) {
    const to = await new Promise(resolve => {
      openModal('Test e-postası', `
        <form class="sf-form" id="pn-mail-test-form" novalidate>
          <label>Gideceği adres<input name="to" type="email" class="sf-input" value="${escapeHtml($('#pn-smtp-state').dataset.ownerEmail || '')}" required></label>
          <button type="submit" class="sf-btn sf-btn-primary">Gönder</button>
        </form>`);
      $('#pn-mail-test-form').addEventListener('submit', event => {
        event.preventDefault();
        const value = event.currentTarget.to.value.trim();
        closeModal();
        resolve(value || null);
      });
      $('#pn-modal')._resolve = () => resolve(null);
    });
    if (!to) return;
    button.disabled = true;
    try {
      toast((await api('/mail/test', { method: 'POST', body: JSON.stringify({ to }) })).message);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      button.disabled = false;
      loadMail().catch(() => {});
    }
  }

  async function clearSmtp() {
    if (!(await confirmBox('SMTP\'yi kaldır', 'Kaldırınca müşterilerine hiçbir e-posta (şifre sıfırlama dahil) gönderilmez.', 'Kaldır'))) return;
    try {
      const res = await api('/mail', { method: 'PUT', body: JSON.stringify({ smtp: null }) });
      renderMail(res);
      toast(res.message);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function toggleApi(event) {
    const enabled = event.target.checked;
    try {
      toast((await api('/api-settings', { method: 'PUT', body: JSON.stringify({ enabled }) })).message);
    } catch (err) {
      event.target.checked = !enabled;
      toast(err.message, 'error');
    }
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
    page_reset: 'Yasal sayfa otomatiğe döndü',
    mail_settings_changed: 'E-posta ayarları değişti',
    own_provider_added: 'Sağlayıcı bağlandı',
    own_provider_removed: 'Sağlayıcı kaldırıldı',
    own_services_imported: 'Sağlayıcıdan servis eklendi',
    own_order: 'Kendi sağlayıcı siparişi',
    content_saved: 'Blog / satış sayfası kaydedildi',
    customer_password_set: 'Müşteriye yeni şifre verildi',
    api_settings_changed: 'Müşteri API ayarı değişti',
    api_key_created: 'Müşteri API anahtarı oluşturdu',
    password_reset_requested: 'Müşteri şifre sıfırlama istedi',
    password_reset_done: 'Müşteri şifresini değiştirdi',
    package_changed: 'Paket değişti',
    digital_order: 'Dijital ürün satıldı',
    digital_settings_changed: 'Dijital ürün ayarı değişti',
    digital_price_changed: 'Dijital ürün fiyatı değişti'
  };
  const ACTORS = { owner: 'Siz', customer: 'Müşteri', jet_admin: 'Yönetim', system: 'Sistem' };

  function detailText(entry) {
    const d = entry.details;
    if (!d || typeof d !== 'object') return '';
    if (entry.action === 'customer_balance_changed') return `${escapeHtml(d.customer)}: ${Number(d.amount) > 0 ? '+' : ''}${money(d.amount)} → ${money(d.balance_after)}${d.note ? ' · ' + escapeHtml(d.note) : ''}`;
    if (entry.action === 'owner_balance_low') return d.product
      ? `${escapeHtml(d.product)} · gerekli ${money(d.required)}`
      : `Gerekli ${money(d.required)}, bakiyeniz ${money(d.owner_balance)}`;
    if (entry.action === 'mail_settings_changed') {
      const n = d.notify || {};
      const onOff = value => (value ? 'açık' : 'kapalı');
      return `Hoş geldin ${onOff(n.welcome)} · Bakiye ${onOff(n.payment)} · Sipariş ${onOff(n.order)} · SMTP: ${escapeHtml(d.smtp || 'ortak sunucu')}`;
    }
    if (entry.action === 'api_settings_changed') return d.enabled ? 'API açıldı' : 'API kapatıldı';
    if (entry.action === 'digital_order') return `#D${Number(d.order_id)} ${escapeHtml(d.product)} × ${num(d.quantity)} · ${money(d.charge)}`;
    if (entry.action === 'digital_settings_changed') return `${d.enabled ? 'satışta' : 'sitede gizli'} · ${d.markup_percent === null || d.markup_percent === undefined ? 'servislerle aynı kâr' : `kâr %${d.markup_percent}`}`;
    if (entry.action === 'digital_price_changed') {
      const parts = [d.enabled ? 'satışta' : 'satışta değil'];
      if (d.fixed_price !== null && d.fixed_price !== undefined) parts.push(`sabit ${money(d.fixed_price)}`);
      else if (d.markup_percent !== null && d.markup_percent !== undefined) parts.push(`kâr %${d.markup_percent}`);
      else parts.push('varsayılan kâr');
      return `${escapeHtml(d.product)} · ${parts.join(' · ')}`;
    }
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
    const types = { order: 'Sipariş', refund: 'İade', manual_add: 'Bakiye ekleme', manual_subtract: 'Bakiye düşme', deposit: 'Yükleme', digital_order: 'Dijital sipariş' };
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
      if (view === 'digital') await loadDigital();
      if (view === 'providers') await loadOwn();
      if (view === 'content') await loadContent();
      if (view === 'payments') await loadPayments();
      if (view === 'paysettings') await loadPaySettings();
      if (view === 'pages') await loadPagesView();
      if (view === 'subscription') await loadSubscription();
      if (view === 'appearance') await loadThemes();
      if (view === 'domain') await loadDomains();
      if (view === 'site') await loadSite();
      if (view === 'mail') await loadMail();
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
    $('#pn-dg-settings-form').addEventListener('submit', saveDigitalSettings);
    $('#pn-notify-form').addEventListener('submit', saveNotify);
    $('#pn-own-add').addEventListener('submit', addOwnProvider);
    $('#pn-own-search').addEventListener('input', debounce(renderOwnServices, 150));
    $('#pn-smtp-form').addEventListener('submit', saveSmtp);
    $('#pn-smtp-test').addEventListener('click', event => testSmtp(event.currentTarget));
    $('#pn-smtp-clear').addEventListener('click', clearSmtp);
    $('#pn-api-enabled').addEventListener('change', toggleApi);
    $('#pn-dg-search').addEventListener('input', debounce(renderDigitalProducts, 150));
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
      const dgEdit = t.closest('[data-dg-edit]');
      if (dgEdit) { editDigital(Number(dgEdit.dataset.dgEdit)); return; }
      const dgTab = t.closest('[data-dg-tab]');
      if (dgTab) { switchDigitalTab(dgTab.dataset.dgTab); return; }
      const dgPage = t.closest('[data-dg-page]');
      if (dgPage && !dgPage.disabled) { state.dgPage = Number(dgPage.dataset.dgPage); loadDigitalOrders().catch(err => toast(err.message, 'error')); return; }
      const bulk = t.closest('[data-bulk]');
      if (bulk) { bulkAction(bulk.dataset.bulk); return; }
      const bal = t.closest('[data-cust-balance]');
      if (bal) { changeBalance(Number(bal.dataset.custBalance), bal.dataset.action, bal.dataset.name); return; }
      const det = t.closest('[data-cust-detail]');
      if (det) { customerDetail(Number(det.dataset.custDetail)); return; }
      const pass = t.closest('[data-cust-password]');
      if (pass) { setCustomerPassword(Number(pass.dataset.custPassword), pass.dataset.name); return; }
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
      const contentTab = t.closest('[data-content-tab]');
      if (contentTab) { state.contentTab = contentTab.dataset.contentTab; renderContent(); return; }
      if (t.closest('#pn-content-new')) { editContent(null); return; }
      const contentEdit = t.closest('[data-content-edit]');
      if (contentEdit) { editContent(Number(contentEdit.dataset.contentEdit)); return; }
      const contentDelete = t.closest('[data-content-delete]');
      if (contentDelete) {
        confirmBox('Sil', 'Bu içerik sitenden kaldırılacak.', 'Sil').then(async ok => {
          if (!ok) return;
          try { toast((await api(`/content/${contentDelete.dataset.contentDelete}`, { method: 'DELETE' })).message); await loadContent(); } catch (err) { toast(err.message, 'error'); }
        });
        return;
      }
      const ownImport = t.closest('[data-own-import]');
      if (ownImport) { importOwnServices(Number(ownImport.dataset.ownImport)); return; }
      const ownRefresh = t.closest('[data-own-refresh]');
      if (ownRefresh) { ownAction(() => api(`/own/providers/${ownRefresh.dataset.ownRefresh}/refresh`, { method: 'POST' }), 'Bakiye yenilendi.'); return; }
      const ownToggle = t.closest('[data-own-toggle]');
      if (ownToggle) { ownAction(() => api(`/own/providers/${ownToggle.dataset.ownToggle}`, { method: 'PUT', body: JSON.stringify({ enabled: ownToggle.dataset.enabled === '1' }) })); return; }
      const ownRemove = t.closest('[data-own-remove]');
      if (ownRemove) {
        confirmBox('Sağlayıcıyı kaldır', `"${ownRemove.dataset.name}" ve ondan eklediğin servisler kaldırılacak.`, 'Kaldır')
          .then(ok => ok && ownAction(() => api(`/own/providers/${ownRemove.dataset.ownRemove}`, { method: 'DELETE' })));
        return;
      }
      const ownEdit = t.closest('[data-own-edit]');
      if (ownEdit) { editOwnService(Number(ownEdit.dataset.ownEdit)); return; }
      const ownDelete = t.closest('[data-own-delete]');
      if (ownDelete) {
        confirmBox('Servisi sil', 'Bu servis sitenden kaldırılacak.', 'Sil')
          .then(ok => ok && ownAction(() => api(`/own/services/${ownDelete.dataset.ownDelete}`, { method: 'DELETE' })));
        return;
      }
      const ownPage = t.closest('[data-own-page]');
      if (ownPage && !ownPage.disabled) { state.ownPage = Number(ownPage.dataset.ownPage); loadOwnOrders().catch(err => toast(err.message, 'error')); return; }
      const pkgBtn = t.closest('[data-package-change]');
      if (pkgBtn) { changePackage(pkgBtn.dataset.packageChange); return; }
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
