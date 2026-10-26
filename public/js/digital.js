// DIJITAL URUNLER (/dijital-urunler) — katalog, satin alma, siparisler ve
// Gmail Checker. Urun kartlari sunucuda basilir (utils/digitalProducts.js);
// bu dosya yalnizca bu sayfada app.js tarafindan tembel yuklenir (bkz.
// SmmApp.openDigitalStore) ve sayfayi canli veriyle, secili dilde yeniden
// cizer. KART SABLONU sunucudakiyle ayni tutulmali.
//
// SATIN ALMA: giris yoksa giris/kayit secenekleri (giristen sonra ayni
// urunun penceresi kendiliginden acilir: ?satin-al=<id>). Bakiye yetiyorsa
// adet + onay kutusu -> bakiyeden satin al -> hesap bilgileri ayni pencerede
// teslim edilir. Hazirlanan siparis "Siparislerim" sekmesinde tamamlanir.
/* global SmmApp, API, showToast */
'use strict';

Object.assign(SmmApp.prototype, {
  dgText(tr, en) {
    return this.locale === 'en' ? en : tr;
  },

  dgFold(value) {
    return String(value || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').toLowerCase();
  },

  dgFmt(value) {
    const n = Number(value || 0);
    return `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  },

  // Dile gore tutar: TR "₺9,50", EN "$0.27 (₺9,50)". Odeme her zaman TL.
  dgMoney(tl) {
    const rate = Number(this.dgData?.usd_try) || 0;
    if (this.locale !== 'en' || !rate) return this.dgFmt(tl);
    return `$${(Number(tl || 0) / rate).toFixed(2)} <small class="dg-try-note">(${this.dgFmt(tl)})</small>`;
  },

  dgMoneyText(tl) {
    return this.dgMoney(tl).replace(/<[^>]+>/g, '');
  },

  dgDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(this.locale === 'en' ? 'en-GB' : 'tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  },

  dgStatus(status) {
    const map = {
      pending: ['badge-pending', 'Bekliyor', 'Pending'],
      processing: ['badge-processing', 'Hazırlanıyor', 'Preparing'],
      completed: ['badge-completed', 'Teslim edildi', 'Delivered'],
      failed: ['badge-canceled', 'Başarısız · iade edildi', 'Failed · refunded'],
      refunded: ['badge-canceled', 'İade edildi', 'Refunded']
    };
    const [cls, tr, en] = map[status] || ['badge-pending', status, status];
    return `<span class="badge ${cls}">${this.escapeHtml(this.dgText(tr, en))}</span>`;
  },

  // ===========================================================================
  // SAYFA
  // ===========================================================================
  async initDigitalStore() {
    const root = document.getElementById('dijital-root');
    if (!root) return;
    this.dgState = this.dgState || { tab: 'products', category: '', query: '' };
    if (!this.dgBound) {
      this.dgBound = true;
      root.addEventListener('click', event => this.onDigitalClick(event));
      root.addEventListener('input', event => this.onDigitalInput(event));
    }
    try {
      this.dgData = await API.getDigitalProducts(this.locale);
      this.renderDigitalPage();
    } catch (err) {
      // Sunucunun bastigi kartlar yerinde kalir; yalnizca uyari gosterilir.
      if (!root.querySelector('.dg-wrap')) {
        root.innerHTML = `<div class="glass-card dg-empty"><i class="fa-solid fa-triangle-exclamation"></i><p>${this.escapeHtml(err.message)}</p></div>`;
      }
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const buyId = Number(params.get('satin-al'));
    if (params.has('tab') || params.has('satin-al')) {
      params.delete('satin-al');
      const rest = params.toString();
      history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : ''));
    }
    if (['orders', 'checker'].includes(tab)) this.switchDigitalTab(tab);
    else this.switchDigitalTab(this.dgState.tab || 'products');
    if (buyId && this.currentUser) this.openDigitalBuy(buyId);
  },

  dgCardHtml(p) {
    const soldOut = p.stock !== null && p.stock <= 0;
    const meta = [
      p.delivery_time ? `<li><i class="fa-solid fa-bolt" aria-hidden="true"></i> ${this.escapeHtml(p.delivery_time)}</li>` : '',
      p.warranty_hours > 0 ? `<li><i class="fa-solid fa-shield-halved" aria-hidden="true"></i> ${this.escapeHtml(this.dgText(`${p.warranty_hours} saat garanti`, `${p.warranty_hours}h warranty`))}</li>` : '',
      p.format ? `<li><i class="fa-solid fa-key" aria-hidden="true"></i> ${this.escapeHtml(p.format)}</li>` : ''
    ].filter(Boolean).join('');
    const stock = p.stock === null ? ''
      : `<span class="dg-stock ${soldOut ? 'is-out' : 'is-in'}">${this.escapeHtml(soldOut ? this.dgText('Tükendi', 'Sold out') : `${this.dgText('Stok', 'Stock')}: ${Number(p.stock).toLocaleString('tr-TR')}`)}</span>`;
    return `<article class="dg-card glass-card${soldOut ? ' is-sold-out' : ''}" data-dg-id="${Number(p.id)}" data-dg-cat="${this.escapeHtml(this.dgFold(p.category))}" data-dg-search="${this.escapeHtml(this.dgFold(`${p.name} ${p.category}`))}">
      <div class="dg-card-top">${p.category ? `<span class="dg-cat">${this.escapeHtml(p.category)}</span>` : '<span></span>'}${stock}</div>
      <h2 class="dg-card-title">${this.escapeHtml(p.name)}</h2>
      ${p.description ? `<p class="dg-card-desc">${this.escapeHtml(p.description)}</p>` : ''}
      ${meta ? `<ul class="dg-card-meta">${meta}</ul>` : ''}
      <div class="dg-card-foot">
        <div class="dg-price-box"><strong class="dg-price">${this.dgMoney(p.price)}</strong><small>${this.escapeHtml(this.dgText('/ adet', '/ item'))}</small></div>
        <button type="button" class="dg-buy-btn" data-dg-buy="${Number(p.id)}"${soldOut ? ' disabled' : ''}>${this.escapeHtml(soldOut ? this.dgText('Tükendi', 'Sold out') : this.dgText('Satın Al', 'Buy'))}</button>
      </div>
    </article>`;
  },

  // Istatistik kutusu (utils/digitalProducts.js statsHtml ile ayni isaretleme).
  // Degeri 0 olan kutu gosterilmez.
  dgStatsHtml(stats) {
    if (!stats) return '';
    const items = [
      ['sold', 'fa-bag-shopping', 'is-yellow', 'Satılan ürün', 'Products sold'],
      ['users', 'fa-users', 'is-blue', 'Kayıtlı kullanıcı', 'Registered users'],
      ['products', 'fa-layer-group', 'is-red', 'Dijital ürün çeşidi', 'Digital products'],
      ['stock', 'fa-boxes-stacked', 'is-green', 'Stoktaki ürün', 'Items in stock']
    ].filter(([key]) => Number(stats[key]) > 0)
      .map(([key, icon, cls, tr, en]) => `<li class="${cls}"><i class="fa-solid ${icon}" aria-hidden="true"></i><strong>${Number(stats[key]).toLocaleString('tr-TR')}</strong><span>${this.escapeHtml(this.dgText(tr, en))}</span></li>`);
    return items.length ? `<ul class="dg-stats" aria-label="${this.escapeHtml(this.dgText('Mağaza istatistikleri', 'Store statistics'))}">${items.join('')}</ul>` : '';
  },

  renderDigitalPage() {
    const root = document.getElementById('dijital-root');
    const products = this.dgData?.products || [];
    const checkerOn = Boolean(this.dgData?.checker?.enabled);
    const cats = new Map();
    products.forEach(p => { if (p.category && !cats.has(this.dgFold(p.category))) cats.set(this.dgFold(p.category), p.category); });
    const chips = cats.size < 2 ? '' : [
      `<button type="button" class="dg-chip${this.dgState.category ? '' : ' active'}" data-dg-cat="">${this.escapeHtml(this.dgText('Tümü', 'All'))}</button>`,
      ...[...cats].map(([key, label]) => `<button type="button" class="dg-chip${this.dgState.category === key ? ' active' : ''}" data-dg-cat="${this.escapeHtml(key)}">${this.escapeHtml(label)}</button>`)
    ].join('');
    const grid = products.length
      ? products.map(p => this.dgCardHtml(p)).join('')
      : `<div class="glass-card dg-empty"><i class="fa-solid fa-box-open" aria-hidden="true"></i><h2>${this.escapeHtml(this.dgText('Ürünler hazırlanıyor', 'Products coming soon'))}</h2><p>${this.escapeHtml(this.dgText('Bu bölüme yakında yeni ürünler eklenecek. Sonra tekrar uğra.', 'New products will be added to this section soon. Check back later.'))}</p></div>`;
    const tab = (key, icon, tr, en, hidden = false) => `<button type="button" class="dg-tab" role="tab" aria-selected="false" data-dg-tab="${key}"${hidden ? ' hidden' : ''}><i class="fa-solid ${icon}" aria-hidden="true"></i> ${this.escapeHtml(this.dgText(tr, en))}</button>`;
    root.innerHTML = `<div class="dg-wrap" data-lang="${this.locale}">
      <header class="dg-head">
        <span class="dg-kicker"><i class="fa-solid fa-bolt" aria-hidden="true"></i> ${this.escapeHtml(this.dgText('Anında teslimat', 'Instant delivery'))}</span>
        <h1>${this.escapeHtml(this.dgText('Dijital Ürünler', 'Digital Products'))}</h1>
        <p>${this.escapeHtml(this.dgText(
          'Hazır hesaplar ve dijital ürünler: ödemeni bakiyenden yap, bilgiler saniyeler içinde hesabına teslim edilsin. Teslim edilen bilgiler yalnızca sana görünür.',
          'Ready-made accounts and digital products: pay from your balance and the details are delivered to your account within seconds. Delivered details are visible only to you.'))}</p>
      </header>
      ${this.dgStatsHtml(this.dgData?.stats)}
      <div class="dg-tabs" role="tablist">
        ${tab('products', 'fa-store', 'Ürünler', 'Products')}
        ${tab('orders', 'fa-receipt', 'Siparişlerim', 'My Orders')}
        ${tab('checker', 'fa-envelope-circle-check', 'Gmail Checker', 'Gmail Checker', !checkerOn)}
      </div>
      <section class="dg-panel" data-dg-panel="products">
        <div class="dg-toolbar">
          <input type="search" class="form-control dg-search" id="dg-search" value="${this.escapeHtml(this.dgState.query)}" placeholder="${this.escapeHtml(this.dgText('Ürün ara…', 'Search products…'))}" aria-label="${this.escapeHtml(this.dgText('Ürün ara', 'Search products'))}">
          <div class="dg-chips" id="dg-chips">${chips}</div>
        </div>
        <div class="dg-grid" id="dg-grid">${grid}</div>
        <p class="dg-no-match" id="dg-no-match" hidden>${this.escapeHtml(this.dgText('Aramana uygun ürün bulunamadı.', 'No products match your search.'))}</p>
      </section>
      <section class="dg-panel" data-dg-panel="orders" hidden></section>
      <section class="dg-panel" data-dg-panel="checker" hidden></section>
    </div>`;
    this.applyDigitalFilter();
  },

  applyDigitalFilter() {
    const q = this.dgFold(this.dgState.query).trim();
    const cat = this.dgState.category;
    let visible = 0;
    document.querySelectorAll('#dg-grid .dg-card').forEach(card => {
      const show = (!cat || card.dataset.dgCat === cat) && (!q || card.dataset.dgSearch.includes(q));
      card.hidden = !show;
      if (show) visible += 1;
    });
    const none = document.getElementById('dg-no-match');
    if (none) none.hidden = visible > 0 || !document.querySelector('#dg-grid .dg-card');
  },

  onDigitalInput(event) {
    if (event.target.id === 'dg-search') {
      this.dgState.query = event.target.value;
      this.applyDigitalFilter();
    } else if (event.target.id === 'dg-check-input') {
      this.updateDigitalCheckCost();
    }
  },

  onDigitalClick(event) {
    const tab = event.target.closest('[data-dg-tab]');
    if (tab) { this.switchDigitalTab(tab.dataset.dgTab); return; }
    const chip = event.target.closest('.dg-chip');
    if (chip) {
      this.dgState.category = chip.dataset.dgCat || '';
      document.querySelectorAll('#dg-chips .dg-chip').forEach(el => el.classList.toggle('active', el === chip));
      this.applyDigitalFilter();
      return;
    }
    const buy = event.target.closest('[data-dg-buy]');
    if (buy) { this.openDigitalBuy(Number(buy.dataset.dgBuy)); return; }
    const view = event.target.closest('[data-dg-view]');
    if (view) { this.openDigitalDelivery(Number(view.dataset.dgView)); return; }
    const page = event.target.closest('[data-dg-page]');
    if (page) { this.loadDigitalOrders(Number(page.dataset.dgPage)); return; }
    const auth = event.target.closest('[data-dg-auth]');
    if (auth) { this.digitalAuth(auth.dataset.dgAuth, auth.dataset.dgReturn || ''); return; }
    const run = event.target.closest('#dg-check-run');
    if (run) { this.runDigitalCheck(run); return; }
    const filter = event.target.closest('[data-dg-check-filter]');
    if (filter) { this.filterDigitalCheck(filter.dataset.dgCheckFilter); return; }
    const copy = event.target.closest('[data-dg-check-copy]');
    if (copy) { this.copyDigitalCheck(copy.dataset.dgCheckCopy); return; }
    const old = event.target.closest('[data-dg-check-open]');
    if (old) { this.openDigitalCheck(Number(old.dataset.dgCheckOpen)); }
  },

  switchDigitalTab(tab) {
    this.dgState.tab = tab;
    document.querySelectorAll('#dijital-root [data-dg-tab]').forEach(btn => {
      const active = btn.dataset.dgTab === tab;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('#dijital-root [data-dg-panel]').forEach(panel => {
      panel.hidden = panel.dataset.dgPanel !== tab;
    });
    if (tab === 'orders') this.loadDigitalOrders(1);
    if (tab === 'checker') this.renderDigitalChecker();
  },

  // Giris yapmamis ziyaretci: giristen sonra ayni sayfaya (ve sekmeye) donulur.
  digitalAuth(mode, returnQuery) {
    try { sessionStorage.setItem('girisSonrasiAdres', `/dijital-urunler${returnQuery ? `?${returnQuery}` : ''}`); } catch {}
    this.showAuthPage(mode === 'register' ? 'register' : 'login');
  },

  dgLoginBox(message, returnQuery) {
    return `<div class="glass-card dg-login-box">
      <i class="fa-solid fa-lock" aria-hidden="true"></i>
      <p>${this.escapeHtml(message)}</p>
      <div class="dg-login-actions">
        <button type="button" class="btn btn-primary" data-dg-auth="login" data-dg-return="${this.escapeHtml(returnQuery)}"><i class="fa-solid fa-right-to-bracket"></i> ${this.escapeHtml(this.dgText('Giriş Yap', 'Sign In'))}</button>
        <button type="button" class="btn btn-outline" data-dg-auth="register" data-dg-return="${this.escapeHtml(returnQuery)}"><i class="fa-solid fa-user-plus"></i> ${this.escapeHtml(this.dgText('Ücretsiz Kayıt Ol', 'Create a Free Account'))}</button>
      </div>
    </div>`;
  },

  // ===========================================================================
  // SATIN ALMA PENCERESI
  // ===========================================================================
  dgModal(innerHtml) {
    let overlay = document.getElementById('dg-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'dg-modal';
      overlay.className = 'modal-backdrop active';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'dg-modal-title');
      overlay.addEventListener('click', event => {
        if (event.target === overlay || event.target.closest('[data-dg-close]')) this.closeDigitalModal();
      });
      this.dgEscHandler = event => { if (event.key === 'Escape') this.closeDigitalModal(); };
      document.addEventListener('keydown', this.dgEscHandler);
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `<div class="glass-card modal-content crs-buy-modal dg-modal">
        <button type="button" class="btn-icon crs-buy-close" aria-label="${this.escapeHtml(this.dgText('Kapat', 'Close'))}" data-dg-close><i class="fa-solid fa-xmark"></i></button>
        ${innerHtml}
      </div>`;
    return overlay;
  },

  closeDigitalModal() {
    document.getElementById('dg-modal')?.remove();
    if (this.dgEscHandler) document.removeEventListener('keydown', this.dgEscHandler);
    this.dgEscHandler = null;
  },

  dgModalHead(title, subtitle = '', icon = 'fa-bag-shopping') {
    return `<div class="crs-buy-head">
        <span class="crs-buy-icon" aria-hidden="true"><i class="fa-solid ${icon}"></i></span>
        <div><h2 id="dg-modal-title">${this.escapeHtml(title)}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div>
      </div>`;
  },

  openDigitalBuy(productId) {
    const product = (this.dgData?.products || []).find(p => Number(p.id) === Number(productId));
    if (!product) { showToast(this.dgText('Ürün bulunamadı.', 'Product not found.'), 'error'); return; }
    this.jt('digital_buy_open', { label: product.name, meta: { product_id: product.id } });

    if (!this.currentUser) {
      this.dgModal(`${this.dgModalHead(product.name, this.escapeHtml(this.dgText(
        'Satın almak için hesabına giriş yap. Hesabın yoksa ücretsiz kayıt birkaç saniye sürer.',
        'Sign in to buy. No account yet? Signing up is free and takes a few seconds.')))}
        <div class="crs-buy-actions">
          <button type="button" class="btn btn-primary" data-dg-modal-auth="login"><i class="fa-solid fa-right-to-bracket"></i> ${this.escapeHtml(this.dgText('Giriş Yap', 'Sign In'))}</button>
          <button type="button" class="btn btn-outline" data-dg-modal-auth="register"><i class="fa-solid fa-user-plus"></i> ${this.escapeHtml(this.dgText('Ücretsiz Kayıt Ol', 'Create a Free Account'))}</button>
        </div>`).querySelectorAll('[data-dg-modal-auth]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.closeDigitalModal();
          this.digitalAuth(btn.dataset.dgModalAuth, `satin-al=${Number(product.id)}`);
        });
      });
      return;
    }

    const maxQty = product.stock !== null ? Math.max(0, Math.min(product.max, product.stock)) : product.max;
    if (maxQty < product.min) {
      showToast(this.dgText('Bu ürünün stoğu yetersiz.', 'Not enough stock for this product.'), 'warning');
      return;
    }
    const facts = [
      product.format ? [this.dgText('Teslimat biçimi', 'Delivery format'), this.escapeHtml(product.format)] : null,
      product.delivery_time ? [this.dgText('Teslim süresi', 'Delivery time'), this.escapeHtml(product.delivery_time)] : null,
      product.warranty_hours > 0 ? [this.dgText('Garanti', 'Warranty'), this.escapeHtml(this.dgText(`${product.warranty_hours} saat`, `${product.warranty_hours} hours`))] : null
    ].filter(Boolean);
    const overlay = this.dgModal(`${this.dgModalHead(product.name, product.category ? this.escapeHtml(product.category) : '')}
      ${product.description ? `<p class="dg-modal-desc">${this.escapeHtml(product.description)}</p>` : ''}
      ${facts.length ? `<dl class="crs-buy-rows dg-facts">${facts.map(([k, v]) => `<div><dt>${this.escapeHtml(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>` : ''}
      <label class="dg-qty">
        <span>${this.escapeHtml(this.dgText('Adet', 'Quantity'))} <small>(${product.min}–${maxQty.toLocaleString('tr-TR')})</small></span>
        <div class="dg-qty-row">
          <button type="button" class="dg-qty-step" data-step="-1" aria-label="-1">−</button>
          <input type="number" class="form-control" id="dg-qty" min="${product.min}" max="${maxQty}" step="1" value="${product.min}" inputmode="numeric">
          <button type="button" class="dg-qty-step" data-step="1" aria-label="+1">+</button>
        </div>
      </label>
      <dl class="crs-buy-rows" id="dg-buy-rows"></dl>
      <label class="crs-consent">
        <input type="checkbox" id="dg-consent">
        <span>${this.escapeHtml(this.dgText(
          'Dijital ürünün hemen teslim edilmesini istiyorum; teslimattan sonra cayma hakkımın sona ereceğini kabul ediyorum.',
          'I want the digital product delivered immediately and I accept that my right of withdrawal ends after delivery.'))}</span>
      </label>
      <div class="crs-buy-actions" id="dg-buy-actions"></div>`);

    const qtyInput = overlay.querySelector('#dg-qty');
    const update = () => {
      let qty = Number.parseInt(qtyInput.value, 10);
      if (!Number.isFinite(qty)) qty = product.min;
      const total = Math.round(product.price * 100 * qty) / 100;
      const balance = Number(this.currentUser?.balance || 0);
      const enough = balance >= total;
      const valid = qty >= product.min && qty <= maxQty;
      const rows = [
        [this.dgText('Birim fiyat', 'Unit price'), this.dgMoney(product.price)],
        [this.dgText('Toplam', 'Total'), this.dgMoney(total)],
        [this.dgText('Mevcut bakiyen', 'Your balance'), this.dgMoney(balance)]
      ];
      overlay.querySelector('#dg-buy-rows').innerHTML = rows.map(([k, v], i) => `<div class="${i === 1 ? 'is-strong' : ''}"><dt>${this.escapeHtml(k)}</dt><dd>${v}</dd></div>`).join('');
      const actions = overlay.querySelector('#dg-buy-actions');
      if (!valid) {
        actions.innerHTML = `<p class="crs-buy-error">${this.escapeHtml(this.dgText(`Adet ${product.min} ile ${maxQty} arasında olmalı.`, `Quantity must be between ${product.min} and ${maxQty}.`))}</p>`;
      } else if (enough) {
        actions.innerHTML = `<button type="button" class="btn btn-primary crs-buy-go" id="dg-buy-go"><i class="fa-solid fa-wallet"></i> ${this.escapeHtml(this.dgText('Bakiyemle Satın Al', 'Buy with My Balance'))} · ${this.escapeHtml(this.dgMoneyText(total))}</button>`;
        actions.querySelector('#dg-buy-go').addEventListener('click', () => this.purchaseDigitalProduct(product, qty, overlay));
      } else {
        actions.innerHTML = `<a class="btn btn-primary crs-buy-go" href="/add-funds" onclick="app.closeDigitalModal(); app.navigate('add-funds'); return false;"><i class="fa-solid fa-wallet"></i> ${this.escapeHtml(this.dgText('Bakiye Yükle', 'Add Funds'))}</a>
          <small class="crs-buy-hint">${this.escapeHtml(this.dgText(
            `Bakiyen yetersiz: ${this.dgMoneyText(total - balance)} daha gerekiyor. Bakiye yükledikten sonra bu sayfaya dönüp satın alabilirsin.`,
            `Not enough balance: you need ${this.dgMoneyText(total - balance)} more. Add funds, then come back to buy.`))}</small>`;
      }
    };
    qtyInput.addEventListener('input', update);
    overlay.querySelectorAll('.dg-qty-step').forEach(btn => btn.addEventListener('click', () => {
      const next = (Number.parseInt(qtyInput.value, 10) || product.min) + Number(btn.dataset.step);
      qtyInput.value = Math.max(product.min, Math.min(maxQty, next));
      update();
    }));
    update();
  },

  async purchaseDigitalProduct(product, qty, overlay) {
    if (!overlay.querySelector('#dg-consent')?.checked) {
      showToast(this.dgText('Devam etmek için onay kutusunu işaretle.', 'Tick the checkbox to continue.'), 'warning');
      overlay.querySelector('.crs-consent')?.classList.add('is-required');
      return;
    }
    const btn = overlay.querySelector('#dg-buy-go');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${this.escapeHtml(this.dgText('Satın alınıyor…', 'Purchasing…'))}`;
    }
    try {
      const res = await API.buyDigitalProduct(product.id, qty);
      if (this.currentUser) { this.currentUser.balance = res.balance; this.updateUserHeader(); }
      if (res.order.status === 'completed') {
        this.renderDigitalDelivery(res.order, res.items, res.usage, true);
      } else {
        this.dgModal(`${this.dgModalHead(product.name, '', 'fa-hourglass-half')}
          <div class="crs-buy-wait"><i class="fa-solid fa-hourglass-half fa-spin" aria-hidden="true"></i><div>
            <strong>${this.escapeHtml(this.dgText('Siparişin hazırlanıyor', 'Your order is being prepared'))}</strong>
            <p>${this.escapeHtml(this.dgText(
              'Sağlayıcı ürünü birkaç dakika içinde teslim edecek. Bilgiler hazır olunca Siparişlerim sekmesinde görünür ve bildirim alırsın. Aynı ürünü tekrar satın alma.',
              'The provider will deliver within a few minutes. The details will appear under My Orders and you will get a notification. Please do not buy the same product again.'))}</p>
          </div></div>
          <div class="crs-buy-actions"><button type="button" class="btn btn-primary" id="dg-go-orders"><i class="fa-solid fa-receipt"></i> ${this.escapeHtml(this.dgText('Siparişlerime Git', 'Go to My Orders'))}</button></div>`)
          .querySelector('#dg-go-orders').addEventListener('click', () => { this.closeDigitalModal(); this.switchDigitalTab('orders'); });
      }
      // Stok bilgisi degisti: katalog tazelenir (pencere acik kalir).
      API.getDigitalProducts(this.locale).then(data => { this.dgData = data; if (this.dgState.tab === 'products') { this.renderDigitalPage(); this.switchDigitalTab('products'); } }).catch(() => {});
    } catch (err) {
      showToast(err.message, 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-wallet"></i> ${this.escapeHtml(this.dgText('Bakiyemle Satın Al', 'Buy with My Balance'))}`;
      }
      try { const me = await API.getMe(); this.currentUser = me.user; this.updateUserHeader(); } catch {}
    }
  },

  // ===========================================================================
  // TESLIMAT (hesap bilgileri)
  // ===========================================================================
  renderDigitalDelivery(order, items, usage, fresh = false) {
    const list = Array.isArray(items) ? items : [];
    const overlay = this.dgModal(`${this.dgModalHead(order.product_name, `#D${Number(order.id)} · ${this.escapeHtml(this.dgText(`${order.quantity} adet`, `${order.quantity} item(s)`))}`, 'fa-key')}
      ${fresh ? `<div class="crs-buy-done"><i class="fa-solid fa-circle-check" aria-hidden="true"></i><strong>${this.escapeHtml(this.dgText('Teslim edildi! 🎉', 'Delivered! 🎉'))}</strong><p>${this.escapeHtml(this.dgText('Bilgilerini aşağıdan kopyala ya da indir. Siparişlerim sekmesinden istediğin zaman tekrar görebilirsin.', 'Copy or download your details below. You can view them again anytime under My Orders.'))}</p></div>` : ''}
      ${list.length ? `<div class="dg-items">
          <div class="dg-items-head"><strong>${this.escapeHtml(this.dgText(`${list.length} kayıt`, `${list.length} record(s)`))}</strong>
            <div class="dg-items-actions">
              <button type="button" class="btn btn-outline btn-sm" id="dg-items-copy"><i class="fa-solid fa-copy"></i> ${this.escapeHtml(this.dgText('Tümünü Kopyala', 'Copy All'))}</button>
              <button type="button" class="btn btn-outline btn-sm" id="dg-items-download"><i class="fa-solid fa-download"></i> .txt</button>
            </div>
          </div>
          <ol class="dg-item-list">${list.map(item => `<li><code>${this.escapeHtml(item)}</code></li>`).join('')}</ol>
        </div>` : `<p class="crs-buy-error">${this.escapeHtml(order.failure_reason || this.dgText('Bu sipariş için teslimat bilgisi bulunmuyor.', 'There are no delivery details for this order.'))}</p>`}
      ${usage ? `<div class="dg-usage"><strong><i class="fa-solid fa-circle-info"></i> ${this.escapeHtml(this.dgText('Kullanım talimatı', 'Usage instructions'))}</strong><p>${this.escapeHtml(usage)}</p></div>` : ''}
      <p class="crs-buy-hint"><i class="fa-solid fa-lock"></i> ${this.escapeHtml(this.dgText('Bu bilgileri kimseyle paylaşma ve güvenli bir yerde sakla. Sorun olursa garanti süresi içinde destek kaydı aç.', 'Keep these details private and store them safely. If something is wrong, open a support ticket within the warranty period.'))}</p>`);
    overlay.querySelector('#dg-items-copy')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(list.join('\n'));
        showToast(this.dgText('Kopyalandı.', 'Copied.'), 'success');
      } catch {
        showToast(this.dgText('Kopyalanamadı; metni seçip elle kopyala.', 'Could not copy; select the text and copy manually.'), 'warning');
      }
    });
    overlay.querySelector('#dg-items-download')?.addEventListener('click', () => {
      const blob = new Blob([`${list.join('\n')}\n${usage ? `\n${usage}\n` : ''}`], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `siparis-D${Number(order.id)}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  },

  async openDigitalDelivery(orderId) {
    this.dgModal(`<p class="crs-buy-loading"><i class="fa-solid fa-spinner fa-spin"></i> ${this.escapeHtml(this.dgText('Yükleniyor…', 'Loading…'))}</p>`);
    try {
      const res = await API.getDigitalOrder(orderId);
      this.renderDigitalDelivery(res.order, res.items, res.usage);
    } catch (err) {
      this.dgModal(`<p class="crs-buy-error"><i class="fa-solid fa-circle-exclamation"></i> ${this.escapeHtml(err.message)}</p>`);
    }
  },

  // ===========================================================================
  // SIPARISLERIM
  // ===========================================================================
  async loadDigitalOrders(page = 1) {
    const panel = document.querySelector('#dijital-root [data-dg-panel="orders"]');
    if (!panel) return;
    if (!this.currentUser) {
      panel.innerHTML = this.dgLoginBox(this.dgText('Siparişlerini görmek için giriş yap.', 'Sign in to see your orders.'), 'tab=orders');
      return;
    }
    if (!panel.innerHTML.trim()) panel.innerHTML = `<p class="health-loading">${this.escapeHtml(this.dgText('Yükleniyor…', 'Loading…'))}</p>`;
    try {
      const data = await API.getDigitalOrders(page);
      const orders = data.orders || [];
      if (!orders.length) {
        panel.innerHTML = `<div class="glass-card dg-empty"><i class="fa-solid fa-receipt" aria-hidden="true"></i><p>${this.escapeHtml(this.dgText('Henüz dijital ürün siparişin yok.', 'You have no digital product orders yet.'))}</p></div>`;
        return;
      }
      const rows = orders.map(o => `<tr>
          <td>#D${Number(o.id)}</td>
          <td><strong>${this.escapeHtml(o.product_name)}</strong>${o.status === 'failed' && o.failure_reason ? `<br><small class="dg-muted">${this.escapeHtml(o.failure_reason)}</small>` : ''}</td>
          <td>${Number(o.quantity).toLocaleString('tr-TR')}</td>
          <td>${this.dgMoney(o.charge)}${o.refunded > 0 ? `<br><small class="dg-muted">${this.escapeHtml(this.dgText('İade', 'Refund'))}: ${this.dgMoneyText(o.refunded)}</small>` : ''}</td>
          <td>${this.dgStatus(o.status)}</td>
          <td>${this.escapeHtml(this.dgDate(o.created_at))}</td>
          <td>${['completed', 'refunded'].includes(o.status) && o.item_count > 0
            ? `<button type="button" class="btn btn-primary btn-sm" data-dg-view="${Number(o.id)}"><i class="fa-solid fa-key"></i> ${this.escapeHtml(this.dgText('Bilgileri Gör', 'View Details'))}</button>`
            : (o.status === 'processing' ? `<small class="dg-muted">${this.escapeHtml(this.dgText('Birkaç dakika içinde hazır', 'Ready in a few minutes'))}</small>` : '—')}</td>
        </tr>`).join('');
      const p = data.pagination || {};
      const pager = p.pages > 1 ? `<div class="dg-pager">
          <button type="button" class="btn btn-outline btn-sm" data-dg-page="${p.page - 1}"${p.page <= 1 ? ' disabled' : ''}>‹</button>
          <span>${p.page} / ${p.pages}</span>
          <button type="button" class="btn btn-outline btn-sm" data-dg-page="${p.page + 1}"${p.page >= p.pages ? ' disabled' : ''}>›</button>
        </div>` : '';
      panel.innerHTML = `<div class="glass-card dg-table-card"><div class="table-responsive"><table class="custom-table">
          <thead><tr><th>#</th><th>${this.escapeHtml(this.dgText('Ürün', 'Product'))}</th><th>${this.escapeHtml(this.dgText('Adet', 'Qty'))}</th><th>${this.escapeHtml(this.dgText('Tutar', 'Amount'))}</th><th>${this.escapeHtml(this.dgText('Durum', 'Status'))}</th><th>${this.escapeHtml(this.dgText('Tarih', 'Date'))}</th><th></th></tr></thead>
          <tbody>${rows}</tbody></table></div>${pager}</div>`;
      // Hazirlanan siparis varsa liste kendini tazeler (sekme acik kaldikca).
      clearTimeout(this.dgOrdersTimer);
      if (orders.some(o => o.status === 'processing' || o.status === 'pending')) {
        this.dgOrdersTimer = setTimeout(() => { if (this.dgState.tab === 'orders' && this.currentView === 'dijital-urunler') this.loadDigitalOrders(p.page || 1); }, 20000);
      }
    } catch (err) {
      panel.innerHTML = `<div class="glass-card dg-empty"><p class="crs-buy-error">${this.escapeHtml(err.message)}</p></div>`;
    }
  },

  // ===========================================================================
  // GMAIL CHECKER
  // ===========================================================================
  renderDigitalChecker() {
    const panel = document.querySelector('#dijital-root [data-dg-panel="checker"]');
    if (!panel) return;
    const cfg = this.dgData?.checker || {};
    if (!cfg.enabled) {
      panel.innerHTML = `<div class="glass-card dg-empty"><p>${this.escapeHtml(this.dgText('Gmail Checker şu anda kullanılamıyor.', 'Gmail Checker is currently unavailable.'))}</p></div>`;
      return;
    }
    if (!this.currentUser) {
      panel.innerHTML = this.dgLoginBox(this.dgText('Gmail Checker\'ı kullanmak için giriş yap.', 'Sign in to use Gmail Checker.'), 'tab=checker');
      return;
    }
    panel.innerHTML = `<div class="dg-checker">
      <div class="glass-card dg-checker-form">
        <h2>${this.escapeHtml(this.dgText('Gmail Checker', 'Gmail Checker'))}</h2>
        <p class="dg-muted">${this.escapeHtml(this.dgText(
          `E-posta adreslerini her satıra bir tane gelecek şekilde yapıştır (en fazla ${cfg.max_emails}). Adres başı ${this.dgMoneyText(cfg.price)}; sonuç dönmeyen adreslerin ücreti iade edilir.`,
          `Paste email addresses, one per line (up to ${cfg.max_emails}). ${this.dgMoneyText(cfg.price)} per address; addresses without a result are refunded.`))}</p>
        <textarea class="form-control dg-check-input" id="dg-check-input" rows="9" spellcheck="false" placeholder="ornek1@gmail.com&#10;ornek2@gmail.com"></textarea>
        <div class="dg-check-bar">
          <span id="dg-check-cost" class="dg-check-cost"></span>
          <button type="button" class="btn btn-primary" id="dg-check-run"><i class="fa-solid fa-magnifying-glass"></i> ${this.escapeHtml(this.dgText('Kontrol Et', 'Check'))}</button>
        </div>
        <ul class="dg-legend">
          <li><span class="dg-st st-live">live</span> ${this.escapeHtml(this.dgText('Sağlam', 'Working'))}</li>
          <li><span class="dg-st st-verified">verified</span> ${this.escapeHtml(this.dgText('Doğrulama gerekiyor', 'Verification required'))}</li>
          <li><span class="dg-st st-disabled">disabled</span> ${this.escapeHtml(this.dgText('Devre dışı', 'Disabled'))}</li>
          <li><span class="dg-st st-notexists">notexists</span> ${this.escapeHtml(this.dgText('Mevcut değil', 'Does not exist'))}</li>
          <li><span class="dg-st st-unknown">unknown</span> ${this.escapeHtml(this.dgText('Belirlenemedi', 'Unknown'))}</li>
        </ul>
      </div>
      <div id="dg-check-result"></div>
      <div id="dg-check-history"></div>
    </div>`;
    this.updateDigitalCheckCost();
    this.loadDigitalCheckHistory();
  },

  dgParseEmails(text) {
    const seen = new Set();
    for (const part of String(text || '').split(/[\s,;]+/)) {
      const email = part.trim().toLowerCase();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) seen.add(email);
    }
    return [...seen];
  },

  updateDigitalCheckCost() {
    const box = document.getElementById('dg-check-cost');
    const input = document.getElementById('dg-check-input');
    if (!box || !input) return;
    const count = this.dgParseEmails(input.value).length;
    const cfg = this.dgData?.checker || {};
    const over = count > cfg.max_emails;
    box.innerHTML = `${this.escapeHtml(this.dgText(`${count} geçerli adres`, `${count} valid address(es)`))} · <strong>${this.dgMoney(count * Number(cfg.price || 0))}</strong>${over ? ` <span class="crs-buy-error">${this.escapeHtml(this.dgText(`(en fazla ${cfg.max_emails})`, `(max ${cfg.max_emails})`))}</span>` : ''}`;
  },

  async runDigitalCheck(btn) {
    const input = document.getElementById('dg-check-input');
    const emails = this.dgParseEmails(input?.value);
    const cfg = this.dgData?.checker || {};
    if (!emails.length) { showToast(this.dgText('Geçerli bir e-posta adresi gir.', 'Enter a valid email address.'), 'warning'); return; }
    if (emails.length > cfg.max_emails) { showToast(this.dgText(`Tek seferde en fazla ${cfg.max_emails} adres.`, `At most ${cfg.max_emails} addresses at once.`), 'warning'); return; }
    btn.disabled = true;
    const label = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${this.escapeHtml(this.dgText('Kontrol ediliyor…', 'Checking…'))}`;
    try {
      const res = await API.runDigitalCheck(emails);
      if (this.currentUser) { this.currentUser.balance = res.balance; this.updateUserHeader(); }
      this.renderDigitalCheckResult(res);
      this.loadDigitalCheckHistory();
      showToast(this.dgText(`${res.checked} adres kontrol edildi.`, `${res.checked} address(es) checked.`), 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = label;
    }
  },

  renderDigitalCheckResult(res) {
    const box = document.getElementById('dg-check-result');
    if (!box) return;
    this.dgCheckResults = res.results || [];
    const s = res.summary || {};
    const chip = (key, label) => `<button type="button" class="dg-chip" data-dg-check-filter="${key}">${this.escapeHtml(label)} <b>${Number(key ? s[key] || 0 : this.dgCheckResults.length)}</b></button>`;
    box.innerHTML = `<div class="glass-card dg-check-result">
      <div class="dg-items-head">
        <strong>${this.escapeHtml(this.dgText(`${res.checked} / ${res.requested} adres · ${this.dgMoneyText(res.charge)}`, `${res.checked} / ${res.requested} addresses · ${this.dgMoneyText(res.charge)}`))}${res.refunded > 0 ? ` <small class="dg-muted">(${this.escapeHtml(this.dgText('iade', 'refunded'))} ${this.escapeHtml(this.dgMoneyText(res.refunded))})</small>` : ''}</strong>
        <button type="button" class="btn btn-outline btn-sm" data-dg-check-copy="live"><i class="fa-solid fa-copy"></i> ${this.escapeHtml(this.dgText('Sağlamları Kopyala', 'Copy Working'))}</button>
      </div>
      <div class="dg-chips">
        ${chip('', this.dgText('Tümü', 'All'))}${chip('live', 'live')}${chip('verified', 'verified')}${chip('disabled', 'disabled')}${chip('notexists', 'notexists')}${chip('unknown', 'unknown')}
      </div>
      <div class="table-responsive dg-check-table"><table class="custom-table"><tbody id="dg-check-rows"></tbody></table></div>
    </div>`;
    this.filterDigitalCheck('');
  },

  filterDigitalCheck(status) {
    const rows = document.getElementById('dg-check-rows');
    if (!rows) return;
    document.querySelectorAll('#dg-check-result [data-dg-check-filter]').forEach(el => el.classList.toggle('active', el.dataset.dgCheckFilter === status));
    const list = (this.dgCheckResults || []).filter(r => !status || r.status === status);
    rows.innerHTML = list.length
      ? list.map(r => `<tr><td><code>${this.escapeHtml(r.email)}</code></td><td><span class="dg-st st-${this.escapeHtml(r.status)}">${this.escapeHtml(r.status)}</span></td></tr>`).join('')
      : `<tr><td colspan="2" class="dg-muted">${this.escapeHtml(this.dgText('Bu durumda adres yok.', 'No addresses with this status.'))}</td></tr>`;
  },

  async copyDigitalCheck(status) {
    const list = (this.dgCheckResults || []).filter(r => r.status === status).map(r => r.email);
    if (!list.length) { showToast(this.dgText('Kopyalanacak adres yok.', 'Nothing to copy.'), 'info'); return; }
    try {
      await navigator.clipboard.writeText(list.join('\n'));
      showToast(this.dgText(`${list.length} adres kopyalandı.`, `${list.length} address(es) copied.`), 'success');
    } catch {
      showToast(this.dgText('Kopyalanamadı.', 'Could not copy.'), 'warning');
    }
  },

  async loadDigitalCheckHistory() {
    const box = document.getElementById('dg-check-history');
    if (!box) return;
    try {
      const data = await API.getDigitalChecks();
      const checks = data.checks || [];
      if (!checks.length) { box.innerHTML = ''; return; }
      box.innerHTML = `<div class="glass-card dg-table-card">
        <h3 class="dg-sub">${this.escapeHtml(this.dgText('Son sorguların', 'Your recent checks'))}</h3>
        <div class="table-responsive"><table class="custom-table">
          <thead><tr><th>${this.escapeHtml(this.dgText('Tarih', 'Date'))}</th><th>${this.escapeHtml(this.dgText('Adres', 'Addresses'))}</th><th>live</th><th>${this.escapeHtml(this.dgText('Tutar', 'Amount'))}</th><th></th></tr></thead>
          <tbody>${checks.map(c => `<tr>
            <td>${this.escapeHtml(this.dgDate(c.created_at))}</td>
            <td>${Number(c.checked)} / ${Number(c.email_count)}</td>
            <td>${c.summary ? Number(c.summary.live || 0) : '—'}</td>
            <td>${c.status === 'failed' ? `<span class="badge badge-canceled">${this.escapeHtml(this.dgText('İade edildi', 'Refunded'))}</span>` : this.dgMoney(c.charge)}</td>
            <td>${c.status === 'completed' ? `<button type="button" class="btn btn-outline btn-sm" data-dg-check-open="${Number(c.id)}">${this.escapeHtml(this.dgText('Sonuçlar', 'Results'))}</button>` : ''}</td>
          </tr>`).join('')}</tbody>
        </table></div></div>`;
    } catch {
      box.innerHTML = '';
    }
  },

  async openDigitalCheck(id) {
    try {
      const res = await API.getDigitalCheck(id);
      this.renderDigitalCheckResult({ ...res, refunded: 0 });
      document.getElementById('dg-check-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
});
