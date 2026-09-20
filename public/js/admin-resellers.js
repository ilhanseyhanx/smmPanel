// ADMIN > BAYILER ekrani. Bu dosya ziyaretcilere GONDERILMEZ: yalnizca
// yonetici "Bayiler" sekmesini actiginda app.js tarafindan yuklenir
// (bkz. SmmApp.loadResellerAdminModule). Boylece bayilik ozelligi kapali
// ya da kullanilmiyorken site JS yuku artmaz.
/* global SmmApp, API, showToast, confirmDialog, promptDialog */
'use strict';

Object.assign(SmmApp.prototype, {
// Genel bayilik ayarlari, bayi listesi ve tam sayfa bayi detayi: sahibi,
  // adresleri, musterileri, siparisleri, fiyatlari, bakiye hareketleri ve
  // islem kaydi tek ekrandan izlenir ve yonetilir.
  showAdminResellersList() {
    this.adminResellerDetailId = null;
    const list = document.getElementById('admin-resellers-list-view');
    const detail = document.getElementById('admin-reseller-detail-view');
    if (list) list.style.display = 'block';
    if (detail) detail.style.display = 'none';
  },

  async loadAdminResellers() {
    const tbody = document.getElementById('admin-resellers-tbody');
    if (tbody && !this.adminResellersData) tbody.innerHTML = '<tr><td colspan="10" class="text-center">Yükleniyor…</td></tr>';
    try {
      const data = await API.getAdminResellers();
      this.adminResellersData = data;
      this.fillResellerSettingsForm(data.settings);
      this.renderAdminResellersSummary(data);
      this.renderAdminResellersTable();
    } catch (err) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="color:var(--danger);">Bayiler yüklenemedi: ${this.escapeHtml(err.message)}</td></tr>`;
    }
  },

  fillResellerSettingsForm(settings) {
    if (!settings) return;
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value; };
    set('reseller-setting-discount', settings.discount_percent);
    set('reseller-setting-min-deposit', settings.min_deposit_tl);
    set('reseller-setting-markup', settings.default_markup_percent);
    const open = document.getElementById('reseller-setting-open');
    if (open) open.checked = Boolean(settings.applications_open);
    const pub = document.getElementById('reseller-setting-public');
    if (pub) {
      pub.checked = Boolean(settings.public_page_enabled);
      if (!pub.dataset.bound) {
        pub.dataset.bound = '1';
        pub.addEventListener('change', () => this.renderResellerPublicState(pub.checked));
      }
    }
    this.renderResellerPublicState(Boolean(settings.public_page_enabled));
  },

  renderResellerPublicState(enabled) {
    const state = document.getElementById('reseller-public-state');
    const box = document.getElementById('reseller-public-box');
    if (state) state.textContent = enabled ? 'Yayında' : 'Kapalı';
    if (box) box.classList.toggle('is-on', enabled);
  },

  resellerKpi(icon, cls, value, label, sub = '') {
    return `
      <div class="glass-card stat-card">
        <div class="stat-icon ${cls}"><i class="fa-solid ${icon}"></i></div>
        <div><div class="stat-val" style="font-size:1.15rem;">${value}</div><div class="stat-lbl">${label}${sub ? ` <small style="color:var(--text-dim);">${sub}</small>` : ''}</div></div>
      </div>`;
  },

  renderAdminResellersSummary(data) {
    const box = document.getElementById('admin-resellers-summary');
    if (!box) return;
    const s = data.summary || {};
    const settings = data.settings || {};
    box.innerHTML = [
      this.resellerKpi('fa-handshake', 'cyan', String(s.total || 0), 'Bayi', `${s.active || 0} aktif`),
      this.resellerKpi('fa-users', '', String(s.customers || 0), 'Bayi Müşterisi'),
      this.resellerKpi('fa-boxes-stacked', '', String(s.orders_30d || 0), 'Sipariş', 'son 30 gün'),
      this.resellerKpi('fa-sack-dollar', 'green', this.fmtTl(s.jet_revenue_30d), 'Bayilerden Size Gelen', 'son 30 gün'),
      this.resellerKpi('fa-chart-line', 'cyan', this.fmtTl(s.reseller_profit_30d), 'Bayilerin Kârı', 'son 30 gün'),
      this.resellerKpi('fa-percent', '', `%${settings.discount_percent ?? 0}`, 'Bayi İndirimi', `açılış ₺${settings.min_deposit_tl ?? 0}`),
      this.resellerKpi('fa-store', settings.public_page_enabled ? 'green' : '', settings.public_page_enabled ? 'Yayında' : 'Kapalı', 'Sitede Bayilik Sayfası')
    ].join('');
  },

  resellerStatusInfo(status) {
    return {
      active: { label: 'Aktif', badge: 'badge-completed', icon: 'fa-circle-check' },
      suspended: { label: 'Askıda', badge: 'badge-canceled', icon: 'fa-ban' },
      sleeping: { label: 'Uykuda', badge: 'badge-pending', icon: 'fa-moon' }
    }[status] || { label: status, badge: 'badge-pending', icon: 'fa-circle' };
  },

  resellerAddressesHtml(t) {
    const esc = v => this.escapeHtml(v ?? '');
    const parts = [];
    if (t.subdomain) parts.push(`<code>${esc(t.subdomain)}</code>`);
    for (const d of t.domains || []) {
      const color = d.status === 'active' ? 'var(--success)' : 'var(--text-dim)';
      parts.push(`<span style="color:${color};" title="${esc(d.status)}"><i class="fa-solid fa-globe"></i> ${esc(d.domain)}</span>`);
    }
    return parts.length ? parts.join('<br>') : `<code>${esc(t.slug)}</code>`;
  },

  renderAdminResellersTable() {
    const tbody = document.getElementById('admin-resellers-tbody');
    if (!tbody || !this.adminResellersData) return;
    const esc = v => this.escapeHtml(v ?? '');
    const q = String(document.getElementById('admin-resellers-search')?.value || '').trim().toLocaleLowerCase('tr-TR');
    const rows = (this.adminResellersData.tenants || []).filter(t => !q || [
      t.name, t.slug, t.subdomain, t.owner?.username, t.owner?.email, ...(t.domains || []).map(d => d.domain)
    ].some(v => String(v || '').toLocaleLowerCase('tr-TR').includes(q)));
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="color:var(--text-dim);">${q ? 'Aramaya uyan bayi yok.' : 'Henüz bayi yok. Bayilik başvurusu gelince ya da elle açınca burada görünür.'}</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(t => {
      const st = this.resellerStatusInfo(t.status);
      const lowBalance = t.owner && t.owner.balance < 50;
      return `<tr>
        <td><a href="#" onclick="app.openAdminResellerDetail(${t.id}); return false;"><strong>${esc(t.name)}</strong></a><small style="display:block;color:var(--text-dim);">#${t.id} · ${this.fmtDbDateTime(t.created_at)}</small></td>
        <td>${t.owner ? `<a href="#" onclick="app.openUserFromReseller(${t.owner.id}); return false;">${esc(t.owner.username)}</a>${t.owner.banned ? ' <span class="badge badge-canceled">Banlı</span>' : ''}` : '—'}</td>
        <td style="font-size:.85rem;">${this.resellerAddressesHtml(t)}</td>
        <td><span class="badge ${st.badge}"><i class="fa-solid ${st.icon}"></i> ${st.label}</span></td>
        <td>${t.stats.customers_total}${t.stats.customers_30d ? `<small style="display:block;color:var(--text-dim);">+${t.stats.customers_30d} yeni</small>` : ''}</td>
        <td>${t.stats.orders_30d}${t.stats.orders_active ? `<small style="display:block;color:var(--text-dim);">${t.stats.orders_active} aktif</small>` : ''}</td>
        <td>${this.fmtTl(t.stats.cost_30d)}</td>
        <td>${this.fmtTl(t.stats.profit_30d)}</td>
        <td style="${lowBalance ? 'color:var(--danger);font-weight:700;' : ''}">${t.owner ? this.fmtTl(t.owner.balance) : '—'}</td>
        <td><button type="button" class="btn btn-outline btn-sm" onclick="app.openAdminResellerDetail(${t.id})"><i class="fa-solid fa-magnifying-glass"></i> Detay</button></td>
      </tr>`;
    }).join('');
  },

  openUserFromReseller(userId) {
    this.switchAdminTab('users');
    this.openAdminUserDetail(userId);
  },

  async saveResellerSettings() {
    const num = id => Number(document.getElementById(id)?.value);
    const payload = {
      public_page_enabled: Boolean(document.getElementById('reseller-setting-public')?.checked),
      discount_percent: num('reseller-setting-discount'),
      min_deposit_tl: num('reseller-setting-min-deposit'),
      default_markup_percent: num('reseller-setting-markup'),
      applications_open: Boolean(document.getElementById('reseller-setting-open')?.checked)
    };
    if (!Number.isFinite(payload.discount_percent) || payload.discount_percent < 0 || payload.discount_percent > 90) {
      showToast('Bayi indirimi 0 ile 90 arasında olmalı.', 'warning'); return;
    }
    if (!Number.isFinite(payload.min_deposit_tl) || payload.min_deposit_tl < 0) { showToast('Açılış şartı geçerli bir tutar olmalı.', 'warning'); return; }
    if (!Number.isFinite(payload.default_markup_percent) || payload.default_markup_percent < 0) { showToast('Varsayılan kâr geçerli bir oran olmalı.', 'warning'); return; }
    const before = this.adminResellersData?.settings;
    if (before && before.public_page_enabled !== payload.public_page_enabled) {
      const ok = await confirmDialog(
        payload.public_page_enabled
          ? 'Bayilik sayfası sitenizde yayına alınacak ve şartı sağlayan kullanıcılar başvurabilecek.'
          : 'Bayilik sayfası sitenizden kaldırılacak ve yeni başvuru alınmayacak. Mevcut bayiler ve elle bayi açma çalışmaya devam eder.',
        { title: payload.public_page_enabled ? 'Bayilik sayfasını aç' : 'Bayilik sayfasını kapat', icon: 'fa-store', confirmText: payload.public_page_enabled ? 'Yayına Al' : 'Kapat' }
      );
      if (!ok) return;
    }
    if (before && before.discount_percent !== payload.discount_percent) {
      const ok = await confirmDialog(
        `Bayi indirimi %${before.discount_percent} → %${payload.discount_percent} olacak. Özel oranı olmayan tüm bayilerin maliyeti ve müşteri fiyatları anında değişir.`,
        { title: 'Bayilere uygula', icon: 'fa-percent', confirmText: 'Kaydet ve Uygula' }
      );
      if (!ok) return;
    }
    const btn = document.getElementById('reseller-settings-save');
    if (btn) btn.disabled = true;
    try {
      const res = await API.saveAdminResellerSettings(payload);
      showToast(res.message, 'success');
      await this.loadAdminResellers();
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  async createResellerManually() {
    const val = id => String(document.getElementById(id)?.value || '').trim();
    const payload = { owner: val('reseller-create-owner'), name: val('reseller-create-name'), slug: val('reseller-create-slug').toLowerCase() };
    if (!payload.owner || !payload.name || !payload.slug) { showToast('Sahip, site adı ve adres gerekli.', 'warning'); return; }
    try {
      const res = await API.createAdminReseller(payload);
      showToast(res.message, 'success');
      ['reseller-create-owner', 'reseller-create-name', 'reseller-create-slug'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      await this.loadAdminResellers();
      if (res.id) this.openAdminResellerDetail(res.id);
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  },

  async openAdminResellerDetail(id) {
    this.adminResellerDetailId = Number(id);
    this.adminResellerDetailSection = this.adminResellerDetailSection || 'orders';
    const list = document.getElementById('admin-resellers-list-view');
    const detail = document.getElementById('admin-reseller-detail-view');
    const content = document.getElementById('admin-reseller-detail-content');
    if (list) list.style.display = 'none';
    if (detail) detail.style.display = 'block';
    if (content) content.innerHTML = '<p class="admin-help">Bayi bilgileri yükleniyor…</p>';
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    await this.refreshAdminResellerDetail();
  },

  async refreshAdminResellerDetail() {
    const id = this.adminResellerDetailId;
    const content = document.getElementById('admin-reseller-detail-content');
    if (!id || !content) return;
    try {
      const data = await API.getAdminReseller(id);
      if (this.adminResellerDetailId !== id) return;
      this.adminResellerDetailData = data;
      this.renderAdminResellerDetail(data);
    } catch (err) {
      if (err.status === 404) { showToast('Bayi artık yok.', 'warning'); this.showAdminResellersList(); this.loadAdminResellers(); return; }
      content.innerHTML = `<p class="admin-help" style="color:var(--danger);">Bayi detayı yüklenemedi: ${this.escapeHtml(err.message)}</p>`;
    }
  },

  setAdminResellerDetailSection(section) {
    this.adminResellerDetailSection = section;
    if (this.adminResellerDetailData) this.renderAdminResellerDetail(this.adminResellerDetailData);
  },

  renderAdminResellerDetail(data) {
    const content = document.getElementById('admin-reseller-detail-content');
    if (!content) return;
    const esc = v => this.escapeHtml(v ?? '');
    const t = data.tenant;
    const o = data.owner;
    const st = data.stats || {};
    const status = this.resellerStatusInfo(t.status);
    const ownDiscount = t.discount_percent !== null && t.discount_percent !== undefined;
    const badge = (label, cls, icon) => `<span class="badge ${cls}">${icon ? `<i class="fa-solid ${icon}"></i> ` : ''}${label}</span>`;
    const badges = [
      badge(status.label, status.badge, status.icon),
      badge(`İndirim %${t.effective_discount_percent}${ownDiscount ? ' (özel)' : ' (genel)'}`, ownDiscount ? 'badge-processing' : 'badge-completed', 'fa-percent'),
      badge(`Kâr %${t.default_markup_percent}`, 'badge-completed', 'fa-arrow-trend-up'),
      badge(`Tema: ${esc(t.theme)}`, 'badge-pending', 'fa-palette'),
      st.below_cost_services ? badge(`${st.below_cost_services} servis zararına (gizli)`, 'badge-canceled', 'fa-triangle-exclamation') : ''
    ].filter(Boolean).join(' ');

    const actions = `
      ${t.status === 'active'
        ? `<button class="btn btn-outline btn-sm" style="color:var(--danger);border-color:var(--danger);" onclick="app.changeResellerStatus('suspended')"><i class="fa-solid fa-ban"></i> Askıya Al</button>
           <button class="btn btn-outline btn-sm" onclick="app.changeResellerStatus('sleeping')"><i class="fa-solid fa-moon"></i> Uyku Modu</button>`
        : `<button class="btn btn-cyan btn-sm" onclick="app.changeResellerStatus('active')"><i class="fa-solid fa-circle-check"></i> Aktifleştir</button>`}
      <button class="btn btn-outline btn-sm" onclick="app.editResellerField('name')"><i class="fa-solid fa-pen"></i> Adı</button>
      <button class="btn btn-outline btn-sm" onclick="app.editResellerField('discount_percent')"><i class="fa-solid fa-percent"></i> İndirim</button>
      <button class="btn btn-outline btn-sm" onclick="app.editResellerField('default_markup_percent')"><i class="fa-solid fa-arrow-trend-up"></i> Kâr</button>
      <button class="btn btn-outline btn-sm" onclick="app.addResellerDomain()"><i class="fa-solid fa-globe"></i> Alan Adı Ekle</button>
      <button class="btn btn-outline btn-sm" style="color:var(--danger);border-color:var(--danger);" onclick="app.deleteReseller()"><i class="fa-solid fa-trash"></i> Sil</button>`;

    const info = (label, value) => `
      <div class="user-detail-info-item">
        <div class="user-detail-info-label">${label}</div>
        <div class="user-detail-info-value">${value}</div>
      </div>`;
    const kpi = (icon, cls, value, label, sub) => this.resellerKpi(icon, cls, value, label, sub);

    const sections = [
      { key: 'orders', label: 'Siparişler', count: (data.orders || []).length, icon: 'fa-boxes-stacked' },
      { key: 'customers', label: 'Müşteriler', count: (data.customers || []).length, icon: 'fa-users' },
      { key: 'balance', label: 'Bakiye Hareketleri', count: (data.balance_logs || []).length, icon: 'fa-wallet' },
      { key: 'prices', label: 'Fiyat Ayarları', count: (data.prices || []).length, icon: 'fa-tags' },
      { key: 'activity', label: 'İşlem Kaydı', count: (data.activity || []).length, icon: 'fa-clipboard-list' },
      { key: 'domains', label: 'Adresler', count: (t.domains || []).length + (t.subdomain ? 1 : 0), icon: 'fa-globe' }
    ];
    const active = sections.some(s => s.key === this.adminResellerDetailSection) ? this.adminResellerDetailSection : 'orders';

    content.innerHTML = `
      <div class="glass-card user-detail-header">
        <div class="user-detail-avatar">${esc(String(t.name || '?').slice(0, 2).toUpperCase())}</div>
        <div class="user-detail-identity">
          <h2 style="margin:0;">${esc(t.name)} <small style="font-weight:500;color:var(--text-dim);">#${t.id} · ${esc(t.slug)}</small></h2>
          <div style="color:var(--text-muted);margin:4px 0 8px;font-size:.9rem;">${this.resellerAddressesHtml(t)}</div>
          <div class="user-detail-badges">${badges}</div>
          ${t.status_reason ? `<p class="admin-help" style="margin:8px 0 0;color:var(--danger);">Sebep: ${esc(t.status_reason)}</p>` : ''}
        </div>
        <div class="user-detail-actions">${actions}</div>
      </div>

      <div class="stats-grid user-detail-kpis">
        ${kpi('fa-users', 'cyan', String(st.customers_total || 0), 'Müşteri', `${st.customers_30d || 0} yeni (30g)`)}
        ${kpi('fa-boxes-stacked', '', String(st.orders_total || 0), 'Sipariş', `${st.orders_30d || 0} son 30g · ${st.orders_active || 0} aktif`)}
        ${kpi('fa-cash-register', 'cyan', this.fmtTl(st.revenue), 'Müşterilerin Ödediği', `30g ${this.fmtTl(st.revenue_30d)}`)}
        ${kpi('fa-sack-dollar', 'green', this.fmtTl(st.cost), 'Size Ödenen (maliyet)', `30g ${this.fmtTl(st.cost_30d)}`)}
        ${kpi('fa-chart-line', 'green', this.fmtTl(st.profit), 'Bayinin Kârı', `30g ${this.fmtTl(st.profit_30d)}`)}
        ${kpi('fa-wallet', '', this.fmtTl(st.customer_balance), 'Müşteri Bakiyeleri', 'toplam')}
        ${kpi('fa-user-tie', o && o.balance < 50 ? '' : 'cyan', o ? this.fmtTl(o.balance) : '—', 'Sahibin Jet Bakiyesi', o && o.balance < 50 ? '<span style="color:var(--danger);">düşük</span>' : '')}
        ${kpi('fa-list-check', '', String(st.visible_services || 0), 'Satıştaki Servis', `${st.hidden_services || 0} gizli`)}
      </div>

      <div class="glass-card" style="margin-bottom:20px;">
        <div class="service-editor-section-title"><i class="fa-solid fa-circle-info"></i> Bayi Bilgileri</div>
        <div class="user-detail-info-grid">
          ${info('Sahip', o ? `<a href="#" onclick="app.openUserFromReseller(${o.id}); return false;">${esc(o.username)}</a>${o.banned ? ' <span class="badge badge-canceled">Banlı</span>' : ''}` : '—')}
          ${info('Sahip E-posta', o ? esc(o.email) : '—')}
          ${info('Sahibin Gerçek Yüklemesi', o ? this.fmtTl(o.real_deposit) : '—')}
          ${info('Sahibin Son Girişi', o?.last_login_at ? `${this.fmtDbDateTime(o.last_login_at)} <small style="color:var(--text-dim);">(${this.fmtTimeAgo(o.last_login_at)})</small>` : '—')}
          ${info('Açılış Tarihi', `${this.fmtDbDateTime(t.created_at)} <small style="color:var(--text-dim);">(${this.fmtTimeAgo(t.created_at)})</small>`)}
          ${info('Son Sipariş', t.last_order_at ? `${this.fmtDbDateTime(t.last_order_at)} <small style="color:var(--text-dim);">(${this.fmtTimeAgo(t.last_order_at)})</small>` : '—')}
          ${info('Bayi İndirimi', ownDiscount ? `%${t.discount_percent} <small style="color:var(--text-dim);">(bayiye özel; genel %${data.global_settings?.discount_percent})</small>` : `%${t.effective_discount_percent} <small style="color:var(--text-dim);">(genel ayar)</small>`)}
          ${info('Varsayılan Kâr', `%${t.default_markup_percent}`)}
          ${info('Son Güncelleme', this.fmtDbDateTime(t.updated_at))}
          ${info('Bayi Yönetim Paneli', t.subdomain ? `<a href="https://${esc(t.subdomain)}/admin" target="_blank" rel="noopener">${esc(t.subdomain)}/admin</a>` : (t.domains || []).some(d => d.status === 'active') ? `${esc(t.domains.find(d => d.status === 'active').domain)}/admin` : '—')}
        </div>
      </div>

      <div class="user-detail-tabs">
        ${sections.map(s => `<button type="button" class="btn ${active === s.key ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="app.setAdminResellerDetailSection('${s.key}')"><i class="fa-solid ${s.icon}"></i> ${s.label} <span class="user-detail-count">${s.count}</span></button>`).join('')}
      </div>
      <div class="glass-card">${this.renderAdminResellerDetailSection(active, data)}</div>`;
  },

  resellerActivityLabel(action) {
    return {
      tenant_created: 'Bayi paneli açıldı',
      tenant_updated: 'Bayi ayarı değişti',
      status_changed: 'Durum değişti',
      global_settings_changed: 'Genel bayilik ayarları değişti',
      domain_added: 'Alan adı eklendi',
      domain_removed: 'Alan adı kaldırıldı',
      domain_status_changed: 'Alan adı durumu değişti',
      customer_registered: 'Müşteri kaydoldu',
      customer_login: 'Müşteri girişi',
      customer_balance_changed: 'Müşteri bakiyesi değişti',
      customer_banned: 'Müşteri banlandı',
      customer_unbanned: 'Müşteri banı kaldırıldı',
      owner_balance_low: 'Bayinin bakiyesi yetmedi, sipariş alınamadı',
      refill_requested: 'Telafi istendi',
      owner_login: 'Bayi paneline giriş',
      service_price_changed: 'Servis fiyatı değişti',
      services_bulk_changed: 'Toplu servis işlemi',
      site_settings_changed: 'Site ayarları değişti'
    }[action] || action;
  },

  resellerActivityDetail(entry) {
    const d = entry.details;
    if (!d || typeof d !== 'object') return this.escapeHtml(d ?? '');
    const esc = v => this.escapeHtml(v ?? '');
    const fieldLabels = { name: 'Ad', theme: 'Tema', discount_percent: 'İndirim %', default_markup_percent: 'Kâr %' };
    switch (entry.action) {
      case 'tenant_updated':
        return Object.entries(d).map(([k, v]) => `${esc(fieldLabels[k] || k)}: ${esc(v?.from ?? 'genel')} → ${esc(v?.to ?? 'genel')}`).join('<br>');
      case 'status_changed':
        return `${esc(this.resellerStatusInfo(d.from).label)} → ${esc(this.resellerStatusInfo(d.to).label)}${d.reason ? ` · ${esc(d.reason)}` : ''}`;
      case 'global_settings_changed':
        return (d.before?.public_page_enabled !== d.after?.public_page_enabled
          ? `Bayilik sayfası ${d.after?.public_page_enabled ? 'yayına alındı' : 'kapatıldı'} · ` : '') + `İndirim %${esc(d.before?.discount_percent)} → %${esc(d.after?.discount_percent)} · Açılış ₺${esc(d.before?.min_deposit_tl)} → ₺${esc(d.after?.min_deposit_tl)} · Kâr %${esc(d.before?.default_markup_percent)} → %${esc(d.after?.default_markup_percent)}`;
      case 'customer_balance_changed':
        return `${esc(d.customer)}: ${Number(d.amount) > 0 ? '+' : ''}${this.fmtTl(d.amount)} → ${this.fmtTl(d.balance_after)}${d.note ? ` · ${esc(d.note)}` : ''}`;
      case 'owner_balance_low':
        return `Gerekli ${this.fmtTl(d.required)} · sahibin bakiyesi ${this.fmtTl(d.owner_balance)} · servis #${esc(d.service_id)}`;
      case 'domain_status_changed':
        return `${esc(d.domain)}: ${esc(d.from)} → ${esc(d.to)}`;
      case 'service_price_changed': {
        const a = d.after || {};
        const fiyat = a.fixed_price !== null && a.fixed_price !== undefined ? `sabit ${this.fmtTl(a.fixed_price)}`
          : (a.markup_percent !== null && a.markup_percent !== undefined ? `kâr %${esc(a.markup_percent)}` : 'varsayılan kâr');
        return `#${esc(d.service_id)} ${esc(d.service)} · ${a.enabled ? 'satışta' : 'satışta değil'} · ${fiyat}${a.custom_name ? ` · ad: ${esc(a.custom_name)}` : ''}`;
      }
      case 'services_bulk_changed':
        return `${esc(d.count)} servis · ${esc({ enable: 'satışa açıldı', disable: 'satıştan kaldırıldı', markup: 'kâr oranı', reset: 'varsayılana döndü' }[d.action] || d.action)}${d.markup_percent !== null && d.markup_percent !== undefined ? ` %${esc(d.markup_percent)}` : ''}`;
      case 'site_settings_changed':
        return Object.entries(d).map(([k, v]) => `${esc(k)}: ${esc(v?.from)} → ${esc(v?.to)}`).join('<br>');
      default:
        return Object.entries(d).map(([k, v]) => `${esc(k)}: ${esc(typeof v === 'object' ? JSON.stringify(v) : v)}`).join(' · ');
    }
  },

  renderAdminResellerDetailSection(section, data) {
    const esc = v => this.escapeHtml(v ?? '');
    const dt = v => this.fmtDbDateTime(v);
    const table = (headers, rows, empty) => rows.length
      ? `<div class="table-responsive"><table class="custom-table"><thead><tr>${headers.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`
      : `<p class="admin-help">${empty}</p>`;

    if (section === 'orders') {
      return table(['No', 'Müşteri', 'Servis', 'Bağlantı', 'Miktar', 'Müşteri Ödedi', 'Maliyet (size)', 'Bayi Kârı', 'Durum', 'Tarih'], (data.orders || []).map(o => {
        const info = this.adminOrderStatusInfo(o.status);
        const reason = o.failure_reason ? `<small style="display:block;color:var(--text-dim);max-width:240px;">${esc(o.failure_reason)}</small>` : '';
        return `<tr>
          <td class="cell-nowrap"><strong>#${o.id}</strong>${o.provider_order_id ? `<small style="display:block;color:var(--text-dim);">Sağl. #${esc(o.provider_order_id)}</small>` : ''}</td>
          <td>${esc(o.customer_username || `#${o.customer_id}`)}</td>
          <td class="cell-truncate" title="${esc(o.service_name)}">${esc(o.service_name)}</td>
          <td>${this.renderOrderLink(o.link, 28, '0.82rem')}</td>
          <td>${Number(o.quantity).toLocaleString('tr-TR')}</td>
          <td>${this.fmtTl(o.customer_paid)}${o.customer_refunded > 0 ? `<small style="display:block;color:var(--text-dim);">iade ${this.fmtTl(o.customer_refunded)}</small>` : ''}</td>
          <td>${this.fmtTl(o.cost)}</td>
          <td style="color:${o.profit >= 0 ? 'var(--success)' : 'var(--danger)'};font-weight:600;">${this.fmtTl(o.profit)}</td>
          <td><span class="badge ${info.badge}">${info.label}</span>${reason}</td>
          <td class="cell-nowrap">${dt(o.created_at)}</td>
        </tr>`;
      }), 'Bu bayinin henüz siparişi yok.');
    }

    if (section === 'customers') {
      return table(['ID', 'Kullanıcı', 'E-posta', 'Bakiye', 'Sipariş', 'Harcama', 'Kayıt', 'Son Giriş', 'İşlemler'], (data.customers || []).map(c => `<tr>
        <td>#${c.id}</td>
        <td><strong>${esc(c.username)}</strong>${c.banned ? ' <span class="badge badge-canceled">Banlı</span>' : ''}</td>
        <td>${esc(c.email)}</td>
        <td>${this.fmtTl(c.balance)}</td>
        <td>${c.orders_count}</td>
        <td>${this.fmtTl(c.spent)}</td>
        <td class="cell-nowrap">${dt(c.created_at)}</td>
        <td class="cell-nowrap">${c.last_login_at ? `${dt(c.last_login_at)}${c.last_login_ip ? `<small style="display:block;color:var(--text-dim);">${esc(c.last_login_ip)}</small>` : ''}` : '—'}</td>
        <td class="cell-nowrap">
          <button class="btn btn-outline btn-sm" onclick="app.adjustResellerCustomerBalance(${c.id}, '${esc(c.username)}', 'add')">+ Bakiye</button>
          <button class="btn btn-outline btn-sm" onclick="app.adjustResellerCustomerBalance(${c.id}, '${esc(c.username)}', 'subtract')">- Bakiye</button>
          <button class="btn btn-outline btn-sm" onclick="app.toggleResellerCustomerBan(${c.id}, '${esc(c.username)}', ${c.banned ? 'false' : 'true'})"><i class="fa-solid ${c.banned ? 'fa-unlock' : 'fa-ban'}"></i></button>
        </td>
      </tr>`), 'Bu bayinin henüz müşterisi yok.');
    }

    if (section === 'balance') {
      const typeLabels = { order: 'Sipariş', refund: 'İade', manual_add: 'Elle ekleme', manual_subtract: 'Elle düşme', deposit: 'Bakiye yükleme' };
      return table(['Tarih', 'Müşteri', 'Tür', 'Tutar', 'Sonraki Bakiye', 'Sipariş', 'Not', 'Yapan'], (data.balance_logs || []).map(l => `<tr>
        <td class="cell-nowrap">${dt(l.created_at)}</td>
        <td>${esc(l.customer_username || `#${l.customer_id}`)}</td>
        <td>${esc(typeLabels[l.type] || l.type)}</td>
        <td style="color:${l.amount >= 0 ? 'var(--success)' : 'var(--danger)'};font-weight:600;">${l.amount >= 0 ? '+' : ''}${this.fmtTl(l.amount)}</td>
        <td>${this.fmtTl(l.balance_after)}</td>
        <td>${l.order_id ? `#${l.order_id}` : '—'}</td>
        <td>${esc(l.note || '')}</td>
        <td><small>${esc(l.actor || '')}</small></td>
      </tr>`), 'Henüz bakiye hareketi yok.');
    }

    if (section === 'prices') {
      return `<p class="admin-help">Yalnızca bayinin özel ayar yaptığı ya da maliyetin altına düştüğü için satıştan kalkan servisler listelenir. Diğer tüm servisler varsayılan kârla (%${esc(data.tenant.default_markup_percent)}) satılır.</p>` +
        table(['Servis', 'Jet Fiyatı', 'Bayi Maliyeti', 'Müşteri Fiyatı', 'Yöntem', 'Durum'], (data.prices || []).map(p => `<tr>
          <td><strong>#${p.service_id}</strong> ${esc(p.custom_name || p.service_name)}${p.custom_name ? `<small style="display:block;color:var(--text-dim);">${esc(p.service_name)}</small>` : ''}</td>
          <td>${this.fmtTl(p.jet_price)}</td>
          <td>${this.fmtTl(p.cost)}</td>
          <td>${this.fmtTl(p.sell)}</td>
          <td>${p.mode === 'fixed' ? 'Sabit fiyat' : `Kâr %${esc(p.markup_percent)}`}</td>
          <td>${p.below_cost ? '<span class="badge badge-canceled">Zararına · gizli</span>' : (p.enabled ? '<span class="badge badge-completed">Satışta</span>' : '<span class="badge badge-pending">Kapalı</span>')}</td>
        </tr>`), 'Bayi henüz özel fiyat ayarı yapmamış.');
    }

    if (section === 'activity') {
      const actorLabel = a => ({
        jet_admin: `<span class="badge badge-processing">Admin</span> ${esc(a.actor_name || '')}`,
        owner: `<span class="badge badge-completed">Bayi sahibi</span> ${esc(a.actor_name || '')}`,
        customer: `<span class="badge badge-pending">Müşteri</span> ${esc(a.actor_name || '')}`,
        system: '<span class="badge badge-canceled">Sistem</span>'
      }[a.actor_type] || esc(a.actor_type));
      return table(['Tarih', 'Kim', 'İşlem', 'Ayrıntı', 'IP'], (data.activity || []).map(a => `<tr>
        <td class="cell-nowrap">${dt(a.created_at)}</td>
        <td class="cell-nowrap">${actorLabel(a)}</td>
        <td>${esc(this.resellerActivityLabel(a.action))}</td>
        <td style="font-size:.85rem;">${this.resellerActivityDetail(a)}</td>
        <td><small>${esc(a.ip_address || '')}</small></td>
      </tr>`), 'Henüz işlem kaydı yok.');
    }

    if (section === 'domains') {
      const t = data.tenant;
      const statusLabels = { active: ['Aktif', 'badge-completed'], pending: ['Bekliyor', 'badge-pending'], disabled: ['Kapalı', 'badge-canceled'] };
      const rows = [];
      if (t.subdomain) {
        rows.push(`<tr><td><code>${esc(t.subdomain)}</code></td><td>Alt adres (otomatik)</td><td><span class="badge badge-completed">Aktif</span></td><td>${dt(t.created_at)}</td><td>—</td></tr>`);
      }
      for (const d of t.domains || []) {
        const [label, cls] = statusLabels[d.status] || [d.status, 'badge-pending'];
        rows.push(`<tr>
          <td><strong>${esc(d.domain)}</strong></td>
          <td>Özel alan adı</td>
          <td><span class="badge ${cls}">${label}</span></td>
          <td>${dt(d.created_at)}${d.activated_at ? `<small style="display:block;color:var(--text-dim);">aktif: ${dt(d.activated_at)}</small>` : ''}</td>
          <td class="cell-nowrap">
            ${d.status === 'active'
              ? `<button class="btn btn-outline btn-sm" onclick="app.setResellerDomainStatus(${d.id}, 'disabled')">Kapat</button>`
              : `<button class="btn btn-cyan btn-sm" onclick="app.setResellerDomainStatus(${d.id}, 'active')">Aktifleştir</button>`}
            <button class="btn btn-outline btn-sm" style="color:var(--danger);border-color:var(--danger);" onclick="app.removeResellerDomain(${d.id}, '${esc(d.domain)}')"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>`);
      }
      const note = t.subdomain ? '' : '<p class="admin-help">Alt adres için sunucuda <code>TENANT_BASE_DOMAIN</code> ayarlı değil; bayi yalnızca özel alan adından açılır.</p>';
      return note + table(['Adres', 'Tür', 'Durum', 'Tarih', 'İşlemler'], rows, 'Henüz adres yok. "Alan Adı Ekle" ile ekleyebilirsiniz.');
    }
    return '';
  },

  async changeResellerStatus(status) {
    const id = this.adminResellerDetailId;
    if (!id) return;
    let reason = '';
    if (status !== 'active') {
      const text = await promptDialog(
        status === 'suspended'
          ? 'Bayinin sitesi kapanacak ve sipariş alamayacak. Sebebi yazın (kayda geçer).'
          : 'Bayinin sitesi uyku moduna alınacak. Sebebi yazın (kayda geçer).',
        { title: status === 'suspended' ? 'Bayiyi askıya al' : 'Uyku modu', icon: status === 'suspended' ? 'fa-ban' : 'fa-moon', danger: status === 'suspended', confirmText: 'Onayla', placeholder: 'Örn: ödeme sorunu', required: false }
      );
      if (text === null) return;
      reason = text;
    }
    try {
      const res = await API.setAdminResellerStatus(id, status, reason);
      showToast(res.message, 'success');
      await this.refreshAdminResellerDetail();
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  },

  async editResellerField(field) {
    const id = this.adminResellerDetailId;
    const t = this.adminResellerDetailData?.tenant;
    if (!id || !t) return;
    const config = {
      name: { title: 'Site adı', message: 'Bayinin sitesinde görünen ad.', icon: 'fa-pen', value: t.name },
      discount_percent: {
        title: 'Bayiye özel indirim',
        message: `Bu bayiye özel indirim oranı (%). Boş bırakırsanız genel oran (%${this.adminResellerDetailData.global_settings?.discount_percent}) kullanılır.`,
        icon: 'fa-percent', value: t.discount_percent ?? '', type: 'number'
      },
      default_markup_percent: { title: 'Varsayılan kâr', message: 'Bayinin müşteri fiyatlarına eklenen kâr oranı (%).', icon: 'fa-arrow-trend-up', value: t.default_markup_percent, type: 'number' }
    }[field];
    if (!config) return;
    const value = await promptDialog(config.message, {
      title: config.title,
      icon: config.icon,
      confirmText: 'Kaydet',
      required: field !== 'discount_percent',
      type: config.type || 'text',
      value: String(config.value ?? ''),
      validate: v => {
        if (field === 'name') return String(v).trim().length >= 2 ? null : 'En az 2 karakter girin.';
        if (field === 'discount_percent' && String(v).trim() === '') return null;
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) return 'Geçerli bir oran girin.';
        if (field === 'discount_percent' && n > 90) return 'İndirim en fazla %90 olabilir.';
        return null;
      }
    });
    if (value === null) return;
    let payloadValue = value;
    if (field === 'discount_percent') payloadValue = String(value).trim() === '' ? null : Number(value);
    if (field === 'default_markup_percent') payloadValue = Number(value);
    try {
      const res = await API.updateAdminReseller(id, { [field]: payloadValue });
      showToast(res.message, 'success');
      await this.refreshAdminResellerDetail();
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  },

  async addResellerDomain() {
    const id = this.adminResellerDetailId;
    if (!id) return;
    const domain = await promptDialog('Bayinin alan adını girin. Alan adının DNS\'i sunucuya yönlendirilmiş olmalı.', {
      title: 'Alan adı ekle', icon: 'fa-globe', confirmText: 'Ekle', placeholder: 'kankasmm.com',
      validate: v => /^[^\s]+\.[^\s]+$/.test(String(v).trim()) ? null : 'Geçerli bir alan adı girin.'
    });
    if (!domain) return;
    try {
      const res = await API.addAdminResellerDomain(id, domain.trim());
      showToast(res.message, 'success');
      this.adminResellerDetailSection = 'domains';
      await this.refreshAdminResellerDetail();
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  },

  async setResellerDomainStatus(domainId, status) {
    try {
      const res = await API.setAdminResellerDomainStatus(this.adminResellerDetailId, domainId, status);
      showToast(res.message, 'success');
      await this.refreshAdminResellerDetail();
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  },

  async removeResellerDomain(domainId, domain) {
    const ok = await confirmDialog(`${domain} bu bayiden kaldırılacak; o adrese gelen ziyaretçi bayi sitesini göremez.`, { title: 'Alan adını kaldır', icon: 'fa-trash', danger: true, confirmText: 'Kaldır' });
    if (!ok) return;
    try {
      const res = await API.removeAdminResellerDomain(this.adminResellerDetailId, domainId);
      showToast(res.message, 'success');
      await this.refreshAdminResellerDetail();
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  },

  async adjustResellerCustomerBalance(customerId, username, action) {
    const isAdd = action === 'add';
    const amount = await promptDialog(`${username} kullanıcısının bayideki bakiyesine ${isAdd ? 'eklenecek' : 'düşülecek'} tutar.`, {
      title: isAdd ? 'Müşteriye bakiye ekle' : 'Müşteriden bakiye düş', icon: isAdd ? 'fa-plus' : 'fa-minus', danger: !isAdd,
      confirmText: isAdd ? 'Ekle' : 'Düş', type: 'number', inputMode: 'decimal', placeholder: 'Örn: 100',
      validate: v => Number(v) > 0 ? null : 'Sıfırdan büyük bir tutar girin.'
    });
    if (!amount) return;
    const note = await promptDialog('Not (isteğe bağlı): neden değişti? Bakiye hareketlerinde görünür.', {
      title: 'Not', icon: 'fa-note-sticky', confirmText: 'Kaydet', placeholder: 'Örn: havale ile yükleme', required: false
    });
    if (note === null) return;
    try {
      const res = await API.changeAdminResellerCustomerBalance(this.adminResellerDetailId, customerId, { amount: Number(amount), action, note });
      showToast(res.message, 'success');
      await this.refreshAdminResellerDetail();
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  },

  async toggleResellerCustomerBan(customerId, username, banned) {
    const ok = await confirmDialog(banned ? `${username} banlanacak ve oturumu kapanacak.` : `${username} kullanıcısının banı kaldırılacak.`, {
      title: banned ? 'Müşteriyi banla' : 'Banı kaldır', icon: banned ? 'fa-ban' : 'fa-unlock', danger: banned, confirmText: banned ? 'Banla' : 'Kaldır'
    });
    if (!ok) return;
    try {
      const res = await API.setAdminResellerCustomerBan(this.adminResellerDetailId, customerId, banned);
      showToast(res.message, 'success');
      await this.refreshAdminResellerDetail();
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  },

  async deleteReseller() {
    const t = this.adminResellerDetailData?.tenant;
    if (!t) return;
    const confirmText = await promptDialog(
      `"${t.name}" bayiliği tamamen silinecek: müşterileri, müşteri bakiyeleri, alan adları, fiyatları ve işlem kaydı gider. Siparişler sahibin Jet siparişi olarak kalır. Onaylamak için bayinin adresini (${t.slug}) yazın.`,
      { title: 'Bayiliği sil', icon: 'fa-trash', danger: true, confirmText: 'Kalıcı Olarak Sil', placeholder: t.slug,
        validate: v => String(v).trim() === t.slug ? null : `Adresi tam olarak "${t.slug}" yazın.` }
    );
    if (!confirmText) return;
    try {
      const res = await API.deleteAdminReseller(t.id, confirmText.trim());
      showToast(res.message, 'success');
      this.adminResellerDetailData = null;
      this.showAdminResellersList();
      await this.loadAdminResellers();
    } catch (err) {
      showToast(`Hata: ${err.message}`, 'error');
    }
  }
});
