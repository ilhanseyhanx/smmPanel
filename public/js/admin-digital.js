// ADMIN > DIJITAL URUNLER ekrani. Bu dosya ziyaretcilere GONDERILMEZ:
// yalnizca yonetici "Dijital Urunler" sekmesini actiginda app.js tarafindan
// yuklenir (bkz. SmmApp.openAdminDigitalTab).
//
// Alt sekmeler: Magaza Urunleri (liste, fiyat, durum) | Urun Ekle (saglayici
// katalogundan tek tek secim) | Siparisler (teslimat, iade, durum sorgu) |
// Gmail Checker (fiyat + ac/kapat) | Saglayici (API adresi + anahtar).
/* global SmmApp, API, showToast, confirmDialog, promptDialog */
'use strict';

Object.assign(SmmApp.prototype, {
  dgaTL(value) {
    const n = Number(value || 0);
    return `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  },

  dgaDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  },

  dgaCost(value, currency) {
    if (value === null || value === undefined) return '—';
    return String(currency).toUpperCase() === 'TRY' ? this.dgaTL(value) : `$${Number(value).toFixed(4).replace(/0{1,2}$/, '')}`;
  },

  dgaStatus(status) {
    const map = {
      pending: ['badge-pending', 'Bekliyor'],
      processing: ['badge-processing', 'Hazırlanıyor'],
      completed: ['badge-completed', 'Teslim edildi'],
      failed: ['badge-canceled', 'Başarısız (iade)'],
      refunded: ['badge-canceled', 'İade edildi']
    };
    const [cls, label] = map[status] || ['badge-pending', status];
    return `<span class="badge ${cls}">${label}</span>`;
  },

  setDigitalPanel(section) {
    this.digitalSection = section;
    document.querySelectorAll('#admin-tab-digital [data-digital-panel]').forEach(el => {
      el.style.display = el.dataset.digitalPanel === section ? '' : 'none';
    });
    document.querySelectorAll('#digital-subtabs [data-digital-section]').forEach(btn => {
      const active = btn.dataset.digitalSection === section;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  },

  showDigitalSection(section) {
    this.setDigitalPanel(section);
    if (section === 'products') this.loadAdminDigitalProducts();
    if (section === 'catalog') this.loadAdminDigitalCatalog();
    if (section === 'orders') this.loadAdminDigitalOrders();
    if (section === 'checker') this.loadAdminDigitalChecker();
    if (section === 'providers') this.loadAdminDigitalProviders();
  },

  async dgaProviders(force = false) {
    if (!force && this.dgaProviderList) return this.dgaProviderList;
    const data = await API.getAdminDigitalProviders();
    this.dgaProviderList = data.providers || [];
    return this.dgaProviderList;
  },

  dgaNoProvider(boxId) {
    const box = document.getElementById(boxId);
    if (box) box.innerHTML = `<div class="glass-card" style="text-align: center; padding: 40px 20px;">
        <h3 style="margin-bottom: 8px;">Önce sağlayıcıyı bağla</h3>
        <p style="color: var(--text-muted); margin-bottom: 16px;">Dijital ürün sağlayıcının API adresini ve anahtarını gir; bağlantı test edilip kaydedilir.</p>
        <button type="button" class="btn btn-primary" onclick="app.showDigitalSection('providers')"><i class="fa-solid fa-plug"></i> Sağlayıcı Ekle</button>
      </div>`;
  },

  // Basit form penceresi (urun ekle/duzenle).
  dgaModal(title, bodyHtml) {
    document.getElementById('dga-modal')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'dga-modal';
    overlay.className = 'modal-backdrop active';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `<div class="glass-card modal-content dga-modal">
        <div class="flex-between mb-20"><h3 style="margin: 0;">${title}</h3>
        <button type="button" class="btn-icon" aria-label="Kapat" data-dga-close><i class="fa-solid fa-xmark"></i></button></div>
        ${bodyHtml}
      </div>`;
    overlay.addEventListener('click', event => {
      if (event.target === overlay || event.target.closest('[data-dga-close]')) overlay.remove();
    });
    document.body.appendChild(overlay);
    return overlay;
  },

  // ===========================================================================
  // MAGAZA URUNLERI
  // ===========================================================================
  async loadAdminDigitalProducts() {
    const box = document.getElementById('digital-panel-products');
    if (!box) return;
    if (!this.dgaProductsData) box.innerHTML = '<p class="health-loading">Yükleniyor…</p>';
    try {
      const [data, overview, providers] = await Promise.all([API.getAdminDigitalProducts(), API.getAdminDigitalOverview(), this.dgaProviders(true)]);
      if (!providers.length) { this.dgaNoProvider('digital-panel-products'); return; }
      this.dgaProductsData = data.products || [];
      this.dgaOverview = overview;
      this.renderAdminDigitalProducts();
    } catch (err) {
      box.innerHTML = `<div class="glass-card"><p style="color: var(--danger);">Ürünler yüklenemedi: ${this.escapeHtml(err.message)}</p></div>`;
    }
  },

  renderAdminDigitalProducts() {
    const box = document.getElementById('digital-panel-products');
    const products = this.dgaProductsData || [];
    const o = this.dgaOverview || { orders: {}, checks: {}, products: {} };
    const kpi = (icon, cls, value, label, sub = '') => `<div class="glass-card stat-card">
        <div class="stat-icon ${cls}"><i class="fa-solid ${icon}"></i></div>
        <div><div class="stat-val">${value}</div><div class="stat-lbl">${label}</div>${sub ? `<div class="course-kpi-sub">${sub}</div>` : ''}</div>
      </div>`;
    const rows = products.map(p => {
      const margin = p.margin_percent;
      const marginHtml = margin === null ? '—'
        : `<span style="color: ${margin <= 0 ? 'var(--danger)' : margin < 15 ? '#b45309' : '#15803d'}; font-weight: 800;">%${margin.toLocaleString('tr-TR')}</span>`;
      const stock = p.stock === null ? '—' : Number(p.stock) <= 0 ? '<span class="badge badge-canceled">Tükendi</span>' : Number(p.stock).toLocaleString('tr-TR');
      return `<tr>
        <td><strong>${this.escapeHtml(p.name)}</strong>${p.name_en ? ` <span class="badge badge-processing" title="${this.escapeHtml(p.name_en)}">EN</span>` : ''}<br>
          <small style="color: var(--text-dim);">${this.escapeHtml(p.category || '—')} · ${this.escapeHtml(p.provider_name)} #${this.escapeHtml(p.provider_product_id)}</small></td>
        <td>${this.dgaTL(p.price)}</td>
        <td>${this.dgaCost(p.cost_rate, p.cost_currency)}${p.cost_try !== null && String(p.cost_currency).toUpperCase() !== 'TRY' ? `<br><small style="color: var(--text-dim);">≈ ${this.dgaTL(p.cost_try)}</small>` : ''}</td>
        <td>${marginHtml}</td>
        <td>${stock}</td>
        <td>${Number(p.min_quantity)}–${Number(p.max_quantity)}</td>
        <td>${Number(p.sales)} <small style="color: var(--text-dim);">(${Number(p.sold_items)} adet)</small><br><small>${this.dgaTL(p.revenue)}</small></td>
        <td>${Number(p.status) === 1 ? '<span class="badge badge-completed">Satışta</span>' : '<span class="badge badge-pending">Pasif</span>'}</td>
        <td><div class="course-admin-actions">
          <button type="button" class="btn btn-outline btn-sm" onclick="app.editAdminDigitalProduct(${Number(p.id)})" title="Düzenle"><i class="fa-solid fa-pen"></i></button>
          <button type="button" class="btn btn-outline btn-sm" onclick="app.toggleAdminDigitalProduct(${Number(p.id)})" title="${Number(p.status) === 1 ? 'Satıştan kaldır' : 'Satışa aç'}"><i class="fa-solid ${Number(p.status) === 1 ? 'fa-eye-slash' : 'fa-eye'}"></i></button>
          <button type="button" class="btn btn-outline btn-sm" style="color: var(--danger);" onclick="app.deleteAdminDigitalProduct(${Number(p.id)})" title="Sil"><i class="fa-solid fa-trash"></i></button>
        </div></td>
      </tr>`;
    }).join('');
    const loss = products.filter(p => Number(p.status) === 1 && p.margin_percent !== null && p.margin_percent <= 0);
    box.innerHTML = `
      <div class="stats-grid mb-20">
        ${kpi('fa-store', '', `${o.products.active || 0} / ${o.products.total || 0}`, 'Satışta / Toplam Ürün')}
        ${kpi('fa-cart-shopping', 'cyan', Number(o.orders.count || 0).toLocaleString('tr-TR'), 'Satış', `${Number(o.orders.items || 0).toLocaleString('tr-TR')} adet ürün`)}
        ${kpi('fa-coins', '', this.dgaTL(o.orders.revenue), 'Net Ciro', `Maliyet ≈ ${this.dgaTL(o.orders.cost_try)}`)}
        ${kpi('fa-chart-line', 'cyan', this.dgaTL(o.orders.profit), 'Tahmini Kâr', `Checker: ${this.dgaTL(o.checks.revenue)} (${Number(o.checks.emails || 0).toLocaleString('tr-TR')} adres)`)}
      </div>
      ${loss.length ? `<div class="glass-card mb-20" style="border-color: var(--danger) !important;"><strong style="color: var(--danger);"><i class="fa-solid fa-triangle-exclamation"></i> ${loss.length} ürün zararına düştü</strong>
        <p style="margin: 6px 0 0; font-size: .88rem;">Sağlayıcı maliyeti satış fiyatını geçtiği için bu ürünlerin satışı kendiliğinden durduruluyor: ${loss.map(p => this.escapeHtml(p.name)).join(', ')}. Fiyatı güncelle.</p></div>` : ''}
      <div class="flex-between mb-20" style="gap: 10px; flex-wrap: wrap;">
        <small style="color: var(--text-muted);">Kur: 1 USD = ₺${Number(o.usd_try || 0).toFixed(2)} · Stok ve maliyet 10 dakikada bir otomatik güncellenir.</small>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button type="button" class="btn btn-outline btn-sm" id="dga-sync-btn" onclick="app.syncAdminDigitalProducts()"><i class="fa-solid fa-rotate"></i> Stok/Maliyet Güncelle</button>
          <button type="button" class="btn btn-primary btn-sm" onclick="app.showDigitalSection('catalog')"><i class="fa-solid fa-plus"></i> Ürün Ekle</button>
        </div>
      </div>
      ${products.length ? `<div class="glass-card" style="padding: 0;">
        <div class="table-responsive"><table class="custom-table">
          <thead><tr><th>Ürün</th><th>Satış</th><th>Maliyet</th><th>Kâr</th><th>Stok</th><th>Adet</th><th>Satış / Ciro</th><th>Durum</th><th>İşlemler</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>` : `<div class="glass-card" style="text-align: center; padding: 40px 20px;">
        <h3 style="margin-bottom: 8px;">Mağazada henüz ürün yok</h3>
        <p style="color: var(--text-muted); margin-bottom: 16px;">Sağlayıcı kataloğundan satmak istediğin ürünleri seçip fiyat vererek ekle.</p>
        <button type="button" class="btn btn-primary" onclick="app.showDigitalSection('catalog')"><i class="fa-solid fa-plus"></i> Ürün Ekle</button>
      </div>`}`;
  },

  async syncAdminDigitalProducts() {
    const btn = document.getElementById('dga-sync-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Güncelleniyor…'; }
    try {
      const res = await API.syncAdminDigitalProducts();
      showToast(res.message, 'success');
      await this.loadAdminDigitalProducts();
    } catch (err) {
      showToast(err.message, 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Stok/Maliyet Güncelle'; }
    }
  },

  dgaProductForm(values, { usdTry, cost, costCurrency, isNew }) {
    const v = key => this.escapeHtml(values[key] ?? '');
    const costTry = cost === null || cost === undefined ? null : (String(costCurrency).toUpperCase() === 'TRY' ? cost : cost * usdTry);
    return `<form id="dga-product-form" class="course-form-grid">
        <div class="form-group"><label>Ürün Adı (TR)</label><input class="form-control" name="name" required maxlength="220" value="${v('name')}"></div>
        <div class="form-group"><label>Ürün Adı (EN) <span class="course-hint">boşsa TR gösterilir</span></label><input class="form-control" name="name_en" maxlength="220" value="${v('name_en')}"></div>
        <div class="form-group"><label>Kategori (TR)</label><input class="form-control" name="category" maxlength="120" value="${v('category')}"></div>
        <div class="form-group"><label>Kategori (EN)</label><input class="form-control" name="category_en" maxlength="120" value="${v('category_en')}"></div>
        <div class="form-group span-2"><label>Açıklama (TR)</label><textarea class="form-control" name="description" rows="3" maxlength="5000">${v('description')}</textarea></div>
        <div class="form-group span-2"><label>Açıklama (EN)</label><textarea class="form-control" name="description_en" rows="2" maxlength="5000">${v('description_en')}</textarea></div>
        <div class="form-group"><label>Satış Fiyatı (₺ / 1 adet)</label><input class="form-control" name="price" type="number" step="0.01" min="0.01" required value="${v('price')}"></div>
        <div class="form-group"><label>Kâr Oranı (%) <span class="course-hint">fiyatı hesaplar</span></label><input class="form-control" name="margin" type="number" step="1" ${costTry ? '' : 'disabled'} placeholder="${costTry ? 'örn. 50' : 'maliyet bilinmiyor'}"></div>
        <div class="form-group"><label>En Az Adet</label><input class="form-control" name="min_quantity" type="number" min="1" value="${v('min_quantity')}"></div>
        <div class="form-group"><label>En Fazla Adet</label><input class="form-control" name="max_quantity" type="number" min="1" value="${v('max_quantity')}"></div>
        <div class="form-group span-2"><p class="course-hint" id="dga-margin-note" style="margin: 0;"></p></div>
        <div class="form-group span-2" style="display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap;">
          <label style="display: inline-flex; align-items: center; gap: 8px; margin-right: auto;"><input type="checkbox" name="status" ${Number(values.status ?? 1) === 1 ? 'checked' : ''}> Satışta</label>
          <button type="button" class="btn btn-outline" data-dga-close>Vazgeç</button>
          <button type="submit" class="btn btn-primary"><i class="fa-solid fa-floppy-disk"></i> ${isNew ? 'Mağazaya Ekle' : 'Kaydet'}</button>
        </div>
      </form>`;
  },

  dgaBindProductForm(overlay, { usdTry, cost, costCurrency }, onSubmit) {
    const form = overlay.querySelector('#dga-product-form');
    const costTry = cost === null || cost === undefined ? null : (String(costCurrency).toUpperCase() === 'TRY' ? Number(cost) : Number(cost) * usdTry);
    const note = overlay.querySelector('#dga-margin-note');
    const refreshNote = () => {
      const price = Number(form.price.value);
      if (!costTry || !price) { note.textContent = costTry ? '' : 'Sağlayıcı maliyeti bilinmiyor.'; return; }
      const margin = ((price / costTry) - 1) * 100;
      note.innerHTML = `Maliyet ${this.dgaCost(cost, costCurrency)} ≈ ${this.dgaTL(costTry)} / adet → kâr <b style="color: ${margin <= 0 ? 'var(--danger)' : '#15803d'};">%${margin.toFixed(1)}</b> (adet başı ${this.dgaTL(price - costTry)})${margin <= 0 ? ' — zararına satış engellenir!' : ''}`;
    };
    form.margin.addEventListener('input', () => {
      const m = Number(form.margin.value);
      if (costTry && Number.isFinite(m)) form.price.value = (costTry * (1 + m / 100)).toFixed(2);
      refreshNote();
    });
    form.price.addEventListener('input', refreshNote);
    refreshNote();
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      const data = {
        name: form.name.value.trim(),
        name_en: form.name_en.value.trim(),
        category: form.category.value.trim(),
        category_en: form.category_en.value.trim(),
        description: form.description.value,
        description_en: form.description_en.value,
        price: Number(form.price.value),
        status: form.status.checked ? 1 : 0
      };
      if (form.min_quantity.value) data.min_quantity = Number(form.min_quantity.value);
      if (form.max_quantity.value) data.max_quantity = Number(form.max_quantity.value);
      try {
        await onSubmit(data);
        overlay.remove();
      } catch (err) {
        showToast(err.message, 'error');
        btn.disabled = false;
      }
    });
  },

  editAdminDigitalProduct(id) {
    const p = (this.dgaProductsData || []).find(item => Number(item.id) === Number(id));
    if (!p) return;
    const usdTry = Number(this.dgaOverview?.usd_try) || 0;
    const overlay = this.dgaModal(`Ürünü Düzenle — #${Number(p.id)}`,
      this.dgaProductForm(p, { usdTry, cost: p.cost_rate, costCurrency: p.cost_currency, isNew: false }));
    this.dgaBindProductForm(overlay, { usdTry, cost: p.cost_rate, costCurrency: p.cost_currency }, async data => {
      const res = await API.updateAdminDigitalProduct(p.id, data);
      showToast(res.message, 'success');
      await this.loadAdminDigitalProducts();
    });
  },

  async toggleAdminDigitalProduct(id) {
    const p = (this.dgaProductsData || []).find(item => Number(item.id) === Number(id));
    if (!p) return;
    try {
      await API.updateAdminDigitalProduct(p.id, { status: Number(p.status) === 1 ? 0 : 1 });
      showToast(Number(p.status) === 1 ? 'Ürün satıştan kaldırıldı.' : 'Ürün satışa açıldı.', 'success');
      await this.loadAdminDigitalProducts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async deleteAdminDigitalProduct(id) {
    const p = (this.dgaProductsData || []).find(item => Number(item.id) === Number(id));
    if (!p) return;
    const ok = await confirmDialog(`"${p.name}" mağazadan silinsin mi? Siparişi olan ürün silinmez, pasife alınır.`, { danger: true, confirmText: 'Sil' });
    if (!ok) return;
    try {
      const res = await API.deleteAdminDigitalProduct(p.id);
      showToast(res.message, 'success');
      await this.loadAdminDigitalProducts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  // ===========================================================================
  // URUN EKLE (saglayici katalogu)
  // ===========================================================================
  async loadAdminDigitalCatalog(refresh = false) {
    const box = document.getElementById('digital-panel-catalog');
    if (!box) return;
    let providers;
    try {
      providers = await this.dgaProviders();
    } catch (err) {
      box.innerHTML = `<div class="glass-card"><p style="color: var(--danger);">${this.escapeHtml(err.message)}</p></div>`;
      return;
    }
    if (!providers.length) { this.dgaNoProvider('digital-panel-catalog'); return; }
    const providerId = Number(this.dgaCatalogProviderId) || providers[0].id;
    this.dgaCatalogProviderId = providerId;
    box.innerHTML = '<p class="health-loading">Sağlayıcı kataloğu alınıyor…</p>';
    try {
      const data = await API.getAdminDigitalCatalog(providerId, refresh);
      this.dgaCatalog = data;
      this.renderAdminDigitalCatalog();
    } catch (err) {
      box.innerHTML = `<div class="glass-card"><p style="color: var(--danger);">${this.escapeHtml(err.message)}</p>
        <button type="button" class="btn btn-outline btn-sm" onclick="app.loadAdminDigitalCatalog(true)"><i class="fa-solid fa-rotate"></i> Tekrar Dene</button></div>`;
    }
  },

  renderAdminDigitalCatalog() {
    const box = document.getElementById('digital-panel-catalog');
    const data = this.dgaCatalog || { products: [] };
    const providers = this.dgaProviderList || [];
    const categories = [...new Set(data.products.map(p => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
    box.innerHTML = `
      <div class="glass-card mb-20 course-stats-toolbar">
        ${providers.length > 1 ? `<label>Sağlayıcı <select class="form-control" id="dga-cat-provider" style="width: auto; display: inline-block;">
          ${providers.map(p => `<option value="${Number(p.id)}"${Number(p.id) === Number(this.dgaCatalogProviderId) ? ' selected' : ''}>${this.escapeHtml(p.name)}</option>`).join('')}</select></label>` : `<strong>${this.escapeHtml(data.provider?.name || '')}</strong>`}
        <input type="search" class="form-control" id="dga-cat-search" placeholder="Ürün ara…" style="max-width: 260px;">
        <select class="form-control" id="dga-cat-category" style="max-width: 220px;"><option value="">Tüm kategoriler</option>${categories.map(c => `<option>${this.escapeHtml(c)}</option>`).join('')}</select>
        <label style="display: inline-flex; align-items: center; gap: 6px;"><input type="checkbox" id="dga-cat-instock"> Yalnız stokta</label>
        <button type="button" class="btn btn-outline btn-sm" onclick="app.loadAdminDigitalCatalog(true)"><i class="fa-solid fa-rotate"></i> Yenile</button>
        <small style="color: var(--text-muted); margin-left: auto;">${data.products.length} ürün · 1 USD = ₺${Number(data.usd_try || 0).toFixed(2)}</small>
      </div>
      <div class="glass-card" style="padding: 0;"><div class="table-responsive"><table class="custom-table">
        <thead><tr><th>ID</th><th>Ürün</th><th>Maliyet</th><th>Stok</th><th>Adet</th><th>Teslim / Garanti</th><th></th></tr></thead>
        <tbody id="dga-cat-rows"></tbody>
      </table></div></div>`;
    const filter = () => this.filterAdminDigitalCatalog();
    box.querySelector('#dga-cat-search').addEventListener('input', filter);
    box.querySelector('#dga-cat-category').addEventListener('change', filter);
    box.querySelector('#dga-cat-instock').addEventListener('change', filter);
    box.querySelector('#dga-cat-provider')?.addEventListener('change', event => {
      this.dgaCatalogProviderId = Number(event.target.value);
      this.loadAdminDigitalCatalog();
    });
    filter();
  },

  filterAdminDigitalCatalog() {
    const tbody = document.getElementById('dga-cat-rows');
    if (!tbody) return;
    const data = this.dgaCatalog || { products: [] };
    const q = (document.getElementById('dga-cat-search')?.value || '').toLocaleLowerCase('tr');
    const cat = document.getElementById('dga-cat-category')?.value || '';
    const inStock = document.getElementById('dga-cat-instock')?.checked;
    const currency = data.provider?.currency || 'USD';
    const list = data.products.filter(p => (!q || `${p.name} ${p.category} ${p.provider_product_id}`.toLocaleLowerCase('tr').includes(q))
      && (!cat || p.category === cat) && (!inStock || (p.stock === null || p.stock > 0))).slice(0, 500);
    tbody.innerHTML = list.length ? list.map(p => `<tr>
        <td><small>${this.escapeHtml(p.provider_product_id)}</small></td>
        <td><strong>${this.escapeHtml(p.name)}</strong><br><small style="color: var(--text-dim);">${this.escapeHtml(p.category || '—')}${p.format ? ` · ${this.escapeHtml(p.format)}` : ''}</small></td>
        <td>${this.dgaCost(p.price, currency)}${p.price !== null && currency !== 'TRY' ? `<br><small style="color: var(--text-dim);">≈ ${this.dgaTL(p.price * Number(data.usd_try || 0))}</small>` : ''}</td>
        <td>${p.stock === null ? '—' : Number(p.stock).toLocaleString('tr-TR')}</td>
        <td>${Number(p.min)}–${Number(p.max)}</td>
        <td><small>${this.escapeHtml(p.delivery_time || '—')} · ${Number(p.warranty_hours) ? `${Number(p.warranty_hours)} sa` : 'garantisiz'}</small></td>
        <td>${p.added_id
          ? `<span class="badge ${Number(p.added_status) === 1 ? 'badge-completed' : 'badge-pending'}">Mağazada${Number(p.added_status) === 1 ? '' : ' (pasif)'}</span>`
          : `<button type="button" class="btn btn-primary btn-sm" data-dga-add="${this.escapeHtml(p.provider_product_id)}"><i class="fa-solid fa-plus"></i> Ekle</button>`}</td>
      </tr>`).join('') : '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Ürün bulunamadı.</td></tr>';
    tbody.querySelectorAll('[data-dga-add]').forEach(btn => btn.addEventListener('click', () => this.openAdminDigitalAdd(btn.dataset.dgaAdd)));
  },

  openAdminDigitalAdd(providerProductId) {
    const data = this.dgaCatalog || { products: [] };
    const p = data.products.find(item => item.provider_product_id === providerProductId);
    if (!p) return;
    const usdTry = Number(data.usd_try) || 0;
    const currency = data.provider?.currency || 'USD';
    const costTry = p.price === null ? null : (currency === 'TRY' ? p.price : p.price * usdTry);
    const values = {
      name: p.name, category: p.category, description: p.description,
      price: costTry ? (costTry * 1.5).toFixed(2) : '',
      min_quantity: p.min, max_quantity: p.max, status: 1
    };
    const overlay = this.dgaModal(`Mağazaya Ekle — ${this.escapeHtml(p.name)}`,
      this.dgaProductForm(values, { usdTry, cost: p.price, costCurrency: currency, isNew: true }));
    if (costTry) overlay.querySelector('[name="margin"]').value = 50;
    this.dgaBindProductForm(overlay, { usdTry, cost: p.price, costCurrency: currency }, async form => {
      const res = await API.addAdminDigitalProduct({ ...form, provider_id: this.dgaCatalogProviderId, provider_product_id: p.provider_product_id });
      showToast(res.message, 'success');
      p.added_id = res.id;
      p.added_status = form.status;
      this.filterAdminDigitalCatalog();
      this.dgaProductsData = null;
    });
  },

  // ===========================================================================
  // SIPARISLER
  // ===========================================================================
  async loadAdminDigitalOrders(page = 1) {
    const box = document.getElementById('digital-panel-orders');
    if (!box) return;
    this.dgaOrderFilter = this.dgaOrderFilter || { status: '', q: '' };
    if (!box.querySelector('#dga-order-rows')) {
      box.innerHTML = `<div class="glass-card mb-20 course-stats-toolbar">
          <label>Durum <select class="form-control" id="dga-order-status" style="width: auto; display: inline-block;">
            <option value="">Tümü</option><option value="processing">Hazırlanıyor</option><option value="completed">Teslim edildi</option>
            <option value="failed">Başarısız</option><option value="refunded">İade edildi</option></select></label>
          <input type="search" class="form-control" id="dga-order-q" placeholder="Kullanıcı, ürün, #D sipariş ya da sağlayıcı no" style="max-width: 320px;">
          <small style="color: var(--text-muted); margin-left: auto;">[Belirsiz] işaretli başarısızlıklarda sağlayıcı panelini kontrol et: sipariş orada oluşmuş olabilir.</small>
        </div>
        <div class="glass-card" style="padding: 0;"><div class="table-responsive"><table class="custom-table">
          <thead><tr><th>#</th><th>Kullanıcı</th><th>Ürün</th><th>Tutar</th><th>Maliyet</th><th>Durum</th><th>Tarih</th><th>İşlemler</th></tr></thead>
          <tbody id="dga-order-rows"><tr><td colspan="8">Yükleniyor…</td></tr></tbody>
        </table></div><div id="dga-order-pager" class="dg-pager"></div></div>`;
      box.querySelector('#dga-order-status').addEventListener('change', event => { this.dgaOrderFilter.status = event.target.value; this.loadAdminDigitalOrders(1); });
      let timer;
      box.querySelector('#dga-order-q').addEventListener('input', event => {
        clearTimeout(timer);
        timer = setTimeout(() => { this.dgaOrderFilter.q = event.target.value.trim(); this.loadAdminDigitalOrders(1); }, 350);
      });
    }
    try {
      const params = { page };
      if (this.dgaOrderFilter.status) params.status = this.dgaOrderFilter.status;
      if (this.dgaOrderFilter.q) params.q = this.dgaOrderFilter.q;
      const data = await API.getAdminDigitalOrders(params);
      const rows = (data.orders || []).map(o => `<tr>
          <td>#D${Number(o.id)}${o.provider_order_id ? `<br><small style="color: var(--text-dim);">${this.escapeHtml(o.provider_order_id)}</small>` : ''}</td>
          <td>${this.escapeHtml(o.username)}</td>
          <td><strong>${this.escapeHtml(o.product_name)}</strong> × ${Number(o.quantity)}${o.failure_reason ? `<br><small style="color: var(--text-dim);">${this.escapeHtml(o.failure_reason)}</small>` : ''}</td>
          <td>${this.dgaTL(o.charge)}${o.refunded > 0 ? `<br><small style="color: var(--danger);">iade ${this.dgaTL(o.refunded)}</small>` : ''}</td>
          <td>${o.provider_total === null || o.provider_total === undefined ? '—' : this.dgaCost(o.provider_total, o.cost_currency || 'USD')}</td>
          <td>${this.dgaStatus(o.status)}</td>
          <td><small>${this.dgaDate(o.created_at)}</small></td>
          <td><div class="course-admin-actions">
            ${o.item_count > 0 ? `<button type="button" class="btn btn-outline btn-sm" onclick="app.viewAdminDigitalOrder(${Number(o.id)})" title="Teslim edilen bilgiler"><i class="fa-solid fa-key"></i></button>` : ''}
            ${o.status === 'processing' && o.provider_order_id ? `<button type="button" class="btn btn-outline btn-sm" onclick="app.syncAdminDigitalOrder(${Number(o.id)})" title="Sağlayıcıdan durum sor"><i class="fa-solid fa-rotate"></i></button>` : ''}
            ${['completed', 'processing', 'pending'].includes(o.status) && o.charge > o.refunded ? `<button type="button" class="btn btn-outline btn-sm" style="color: var(--danger);" onclick="app.refundAdminDigitalOrder(${Number(o.id)})" title="İade et"><i class="fa-solid fa-rotate-left"></i></button>` : ''}
          </div></td>
        </tr>`).join('');
      document.getElementById('dga-order-rows').innerHTML = rows || '<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">Sipariş yok.</td></tr>';
      const p = data.pagination || {};
      document.getElementById('dga-order-pager').innerHTML = p.pages > 1
        ? `<button type="button" class="btn btn-outline btn-sm" onclick="app.loadAdminDigitalOrders(${p.page - 1})"${p.page <= 1 ? ' disabled' : ''}>‹</button><span>${p.page} / ${p.pages} · ${p.total} sipariş</span><button type="button" class="btn btn-outline btn-sm" onclick="app.loadAdminDigitalOrders(${p.page + 1})"${p.page >= p.pages ? ' disabled' : ''}>›</button>`
        : '';
      this.dgaOrderPage = p.page || 1;
    } catch (err) {
      document.getElementById('dga-order-rows').innerHTML = `<tr><td colspan="8" style="color: var(--danger);">${this.escapeHtml(err.message)}</td></tr>`;
    }
  },

  async viewAdminDigitalOrder(id) {
    try {
      const res = await API.getAdminDigitalOrder(id);
      const items = res.items || [];
      const overlay = this.dgaModal(`#D${Number(res.order.id)} — ${this.escapeHtml(res.order.product_name)} × ${Number(res.order.quantity)}`, `
        <p style="margin-top: 0;">Müşteri: <b>${this.escapeHtml(res.order.username)}</b> · ${this.dgaStatus(res.order.status)} · Sağlayıcı no: ${this.escapeHtml(res.order.provider_order_id || '—')}</p>
        <textarea class="form-control" rows="${Math.min(14, Math.max(4, items.length + 1))}" readonly style="font-family: 'IBM Plex Mono', monospace; font-size: .82rem;">${this.escapeHtml(items.join('\n'))}</textarea>
        ${res.usage ? `<p class="course-hint" style="margin-top: 10px;"><b>Kullanım:</b> ${this.escapeHtml(res.usage)}</p>` : ''}
        <p class="course-hint">Bu görüntüleme denetim kaydına yazıldı.</p>`);
      overlay.querySelector('textarea')?.addEventListener('focus', event => event.target.select());
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async syncAdminDigitalOrder(id) {
    try {
      const res = await API.syncAdminDigitalOrder(id);
      showToast(res.message, 'success');
      this.loadAdminDigitalOrders(this.dgaOrderPage || 1);
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async refundAdminDigitalOrder(id) {
    const value = await promptDialog('İade tutarı (₺). Boş bırakırsan kalan tutarın tamamı iade edilir ve sipariş "İade edildi" olur.', {
      title: `#D${id} iadesi`, placeholder: 'örn. 9.50 — boş: tamamı', confirmText: 'İade Et', danger: true, required: false, inputMode: 'decimal'
    });
    if (value === null) return;
    const amount = String(value).trim() ? Number(String(value).replace(',', '.')) : null;
    if (amount !== null && !(amount > 0)) { showToast('Geçerli bir tutar girin.', 'warning'); return; }
    try {
      const res = await API.refundAdminDigitalOrder(id, amount);
      showToast(res.message, 'success');
      this.loadAdminDigitalOrders(this.dgaOrderPage || 1);
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  // ===========================================================================
  // GMAIL CHECKER
  // ===========================================================================
  async loadAdminDigitalChecker() {
    const box = document.getElementById('digital-panel-checker');
    if (!box) return;
    box.innerHTML = '<p class="health-loading">Yükleniyor…</p>';
    try {
      const [data, providers] = await Promise.all([API.getAdminDigitalChecker(), this.dgaProviders(true)]);
      if (!providers.length) { this.dgaNoProvider('digital-panel-checker'); return; }
      const cfg = data.config || {};
      const summary = s => (s ? ['live', 'verified', 'disabled', 'notexists', 'unknown'].filter(k => s[k]).map(k => `${k}: ${s[k]}`).join(' · ') : '—');
      box.innerHTML = `<div class="glass-card mb-20">
          <h3 style="margin-top: 0;">Ayarlar</h3>
          <p style="color: var(--text-muted); font-size: .88rem;">Müşteri e-posta listesini yapıştırır; adres başı fiyat bakiyesinden düşer, sonuç dönmeyen adreslerin ücreti iade edilir. Sağlayıcı tarafında paket hakkın varsa oradan, yoksa sağlayıcı bakiyenden düşer.</p>
          <form id="dga-checker-form" class="course-form-grid">
            <div class="form-group"><label>Adres Başı Fiyat (₺)</label><input class="form-control" name="price" type="number" step="0.0001" min="0" value="${Number(cfg.price || 0)}"></div>
            <div class="form-group"><label>Sağlayıcı</label><select class="form-control" name="provider_id">
              ${providers.map(p => `<option value="${Number(p.id)}"${Number(p.id) === Number(cfg.provider_id) ? ' selected' : ''}>${this.escapeHtml(p.name)}${Number(p.status) === 1 ? '' : ' (pasif)'}</option>`).join('')}</select></div>
            <div class="form-group span-2" style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
              <label style="display: inline-flex; align-items: center; gap: 8px;"><input type="checkbox" name="enabled" ${cfg.enabled ? 'checked' : ''}> Gmail Checker müşterilere açık</label>
              <button type="submit" class="btn btn-primary" style="margin-left: auto;"><i class="fa-solid fa-floppy-disk"></i> Kaydet</button>
            </div>
          </form>
        </div>
        <div class="glass-card" style="padding: 0;"><div class="table-responsive"><table class="custom-table">
          <thead><tr><th>#</th><th>Kullanıcı</th><th>Adres</th><th>Sonuç</th><th>Tahsilat</th><th>Sağlayıcı ücreti</th><th>Tarih</th></tr></thead>
          <tbody>${(data.checks || []).map(c => `<tr>
            <td>${Number(c.id)}</td><td>${this.escapeHtml(c.username)}</td>
            <td>${Number(c.checked)} / ${Number(c.email_count)}</td>
            <td><small>${c.status === 'failed' ? `<span style="color: var(--danger);">${this.escapeHtml(c.failure_reason || 'Başarısız')}</span>` : this.escapeHtml(summary(c.summary))}</small></td>
            <td>${c.status === 'failed' ? '—' : this.dgaTL(c.charge)}</td>
            <td>${c.provider_cost === null || c.provider_cost === undefined ? '—' : `$${Number(c.provider_cost)}`}</td>
            <td><small>${this.dgaDate(c.created_at)}</small></td>
          </tr>`).join('') || '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Henüz sorgu yok.</td></tr>'}</tbody>
        </table></div></div>`;
      box.querySelector('#dga-checker-form').addEventListener('submit', async event => {
        event.preventDefault();
        const form = event.target;
        try {
          const res = await API.saveAdminDigitalChecker({
            enabled: form.enabled.checked,
            price: Number(form.price.value || 0),
            provider_id: Number(form.provider_id.value) || null
          });
          showToast(res.message, 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    } catch (err) {
      box.innerHTML = `<div class="glass-card"><p style="color: var(--danger);">${this.escapeHtml(err.message)}</p></div>`;
    }
  },

  // ===========================================================================
  // SAGLAYICI
  // ===========================================================================
  async loadAdminDigitalProviders() {
    const box = document.getElementById('digital-panel-providers');
    if (!box) return;
    box.innerHTML = '<p class="health-loading">Yükleniyor…</p>';
    try {
      const providers = await this.dgaProviders(true);
      const cards = providers.map(p => `<div class="glass-card mb-20">
          <div class="flex-between" style="gap: 12px; flex-wrap: wrap;">
            <div>
              <h3 style="margin: 0 0 4px;">${this.escapeHtml(p.name)} ${Number(p.status) === 1 ? '<span class="badge badge-completed">Aktif</span>' : '<span class="badge badge-pending">Pasif</span>'}</h3>
              <small style="color: var(--text-muted);">${this.escapeHtml(p.api_url)} · Anahtar ${this.escapeHtml(p.api_key_hint)} · ${Number(p.product_count || 0)} ürün</small>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 1.3rem; font-weight: 900;">${p.balance === null || p.balance === undefined ? '—' : `${Number(p.balance).toLocaleString('tr-TR', { maximumFractionDigits: 4 })} ${this.escapeHtml(p.currency || 'USD')}`}</div>
              <small style="color: var(--text-muted);">bakiye · ${this.dgaDate(p.balance_checked_at)}</small>
            </div>
          </div>
          <div class="course-admin-actions" style="margin-top: 12px;">
            <button type="button" class="btn btn-outline btn-sm" onclick="app.testAdminDigitalProvider(${Number(p.id)})"><i class="fa-solid fa-plug-circle-check"></i> Bağlantıyı Test Et</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="app.editAdminDigitalProvider(${Number(p.id)})"><i class="fa-solid fa-pen"></i> Düzenle</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="app.toggleAdminDigitalProvider(${Number(p.id)})"><i class="fa-solid ${Number(p.status) === 1 ? 'fa-pause' : 'fa-play'}"></i> ${Number(p.status) === 1 ? 'Pasife Al' : 'Aktif Et'}</button>
            <button type="button" class="btn btn-outline btn-sm" style="color: var(--danger);" onclick="app.deleteAdminDigitalProvider(${Number(p.id)})"><i class="fa-solid fa-trash"></i> Sil</button>
          </div>
        </div>`).join('');
      box.innerHTML = `${cards}
        <div class="glass-card">
          <h3 style="margin-top: 0;">${providers.length ? 'Yeni Sağlayıcı Ekle' : 'Sağlayıcıyı Bağla'}</h3>
          <p style="color: var(--text-muted); font-size: .88rem;">Bu bölüm yalnızca <b>X-API-Key</b> başlıklı, <b>/products</b> ve <b>/buy</b> uçları olan dijital ürün API'si içindir (SMM servis sağlayıcıları <b>Sağlayıcılar</b> sekmesinde kalır). API adresi olarak dokümandaki <b>temel adresi</b> gir, ör. <code>https://site.com/api/v1</code>. Kaydetmeden önce bağlantı <code>/profile</code> ile test edilir; anahtar şifreli saklanır.</p>
          <form id="dga-provider-form" class="course-form-grid">
            <div class="form-group"><label>Ad</label><input class="form-control" name="name" required maxlength="100" placeholder="ör. Hesap Sağlayıcım"></div>
            <div class="form-group"><label>API Adresi (temel)</label><input class="form-control" name="api_url" required type="url" placeholder="https://site.com/api/v1"></div>
            <div class="form-group span-2"><label>API Anahtarı (X-API-Key)</label><input class="form-control" name="api_key" required autocomplete="off" placeholder="Anahtarın"></div>
            <div class="form-group span-2" style="text-align: right;"><button type="submit" class="btn btn-primary"><i class="fa-solid fa-plug"></i> Test Et ve Kaydet</button></div>
          </form>
        </div>`;
      box.querySelector('#dga-provider-form').addEventListener('submit', async event => {
        event.preventDefault();
        const form = event.target;
        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Bağlantı test ediliyor…';
        try {
          const res = await API.addAdminDigitalProvider({ name: form.name.value.trim(), api_url: form.api_url.value.trim(), api_key: form.api_key.value.trim() });
          showToast(res.message, 'success');
          this.dgaProviderList = null;
          this.loadAdminDigitalProviders();
        } catch (err) {
          showToast(err.message, 'error');
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-plug"></i> Test Et ve Kaydet';
        }
      });
    } catch (err) {
      box.innerHTML = `<div class="glass-card"><p style="color: var(--danger);">${this.escapeHtml(err.message)}</p></div>`;
    }
  },

  async testAdminDigitalProvider(id) {
    try {
      const res = await API.refreshAdminDigitalProvider(id);
      showToast(`${res.message} Bakiye: ${res.balance} ${res.currency}${res.username ? ` (${res.username})` : ''}`, 'success');
      this.loadAdminDigitalProviders();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  editAdminDigitalProvider(id) {
    const p = (this.dgaProviderList || []).find(item => Number(item.id) === Number(id));
    if (!p) return;
    const overlay = this.dgaModal(`Sağlayıcıyı Düzenle — ${this.escapeHtml(p.name)}`, `
      <form id="dga-provider-edit" class="course-form-grid">
        <div class="form-group"><label>Ad</label><input class="form-control" name="name" required maxlength="100" value="${this.escapeHtml(p.name)}"></div>
        <div class="form-group"><label>API Adresi (temel)</label><input class="form-control" name="api_url" required type="url" value="${this.escapeHtml(p.api_url)}"></div>
        <div class="form-group span-2"><label>Yeni API Anahtarı <span class="course-hint">boş bırakırsan mevcut anahtar (${this.escapeHtml(p.api_key_hint)}) kalır</span></label><input class="form-control" name="api_key" autocomplete="off"></div>
        <div class="form-group span-2" style="display: flex; gap: 10px; justify-content: flex-end;">
          <button type="button" class="btn btn-outline" data-dga-close>Vazgeç</button>
          <button type="submit" class="btn btn-primary"><i class="fa-solid fa-floppy-disk"></i> Kaydet</button>
        </div>
      </form>`);
    overlay.querySelector('#dga-provider-edit').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.target;
      const data = { name: form.name.value.trim(), api_url: form.api_url.value.trim() };
      if (form.api_key.value.trim()) data.api_key = form.api_key.value.trim();
      try {
        const res = await API.updateAdminDigitalProvider(p.id, data);
        showToast(res.message, 'success');
        overlay.remove();
        this.loadAdminDigitalProviders();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  },

  async toggleAdminDigitalProvider(id) {
    const p = (this.dgaProviderList || []).find(item => Number(item.id) === Number(id));
    if (!p) return;
    try {
      await API.updateAdminDigitalProvider(p.id, { status: Number(p.status) === 1 ? 0 : 1 });
      showToast(Number(p.status) === 1 ? 'Sağlayıcı pasife alındı; ürünleri satıştan kalktı.' : 'Sağlayıcı aktif edildi.', 'success');
      this.loadAdminDigitalProviders();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async deleteAdminDigitalProvider(id) {
    const p = (this.dgaProviderList || []).find(item => Number(item.id) === Number(id));
    if (!p) return;
    const ok = await confirmDialog(`"${p.name}" sağlayıcısı silinsin mi?`, { danger: true, confirmText: 'Sil' });
    if (!ok) return;
    try {
      const res = await API.deleteAdminDigitalProvider(p.id);
      showToast(res.message, 'success');
      this.dgaProviderList = null;
      this.loadAdminDigitalProviders();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
});
