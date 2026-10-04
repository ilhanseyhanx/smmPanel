// EGITIM SAYFALARI (/egitimler...) — satin alma penceresi ve okuma takibi.
// Sayfanin kendisi sunucuda basilir; bu dosya yalnizca egitim adreslerinde
// app.js tarafindan tembel yuklenir (bkz. SmmApp.openCoursesPage).
//
// SATIN ALMA AKISI
//   giris yok           -> giris/kayit secenekleri; giristen sonra ayni sayfaya
//                          donulur ve pencere kendiliginden acilir (?satin-al=1)
//   bakiye yeterli      -> ozet + onay kutusu -> bakiyeden satin al
//   bakiye yetersiz     -> eksik tutar yazili Shopier odemesi; odeme onaylaninca
//                          sunucu bakiyeyi yukler ve egitimi otomatik acar
//
// DIL: metinler this.ui(tr, en) ile secilir. Ingilizce sayfada tutarlar dolar
// olarak one cikar (gunluk kur), TL karsiligi yaninda yazar; odeme TL alinir.
/* global SmmApp, API, showToast */
'use strict';

Object.assign(SmmApp.prototype, {
  courseFmt(value) {
    const n = Number(value || 0);
    return `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
  },

  // Dile gore tutar: TR "₺349", EN "$7.12 (₺349)".
  courseMoney(tl) {
    const rate = Number(this.courseCtx?.usdRate) || 0;
    if (this.locale !== 'en' || !rate) return this.courseFmt(tl);
    return `$${(Number(tl || 0) / rate).toFixed(2)} <small class="crs-try-note">(${this.courseFmt(tl)})</small>`;
  },

  courseMoneyText(tl) {
    return this.courseMoney(tl).replace(/<[^>]+>/g, '');
  },

  // Ziyaretci kimligi: yalnizca okuma istatistigi icindir (kac farkli kisi
  // okudu). Kisisel veri tasimaz; tarayicida rastgele uretilir.
  courseVisitorId() {
    try {
      let id = localStorage.getItem('egitim_ziyaretci');
      if (!/^[a-z0-9]{8,40}$/.test(id || '')) {
        id = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => (b % 36).toString(36)).join('');
        localStorage.setItem('egitim_ziyaretci', id);
      }
      return id;
    } catch {
      return '';
    }
  },

  courseLangQuery() {
    return this.locale === 'en' ? 'lang=en' : '';
  },

  initCoursePage() {
    const wrap = document.querySelector('#egitim-root .crs-wrap');
    if (!wrap) return;
    this.courseCtx = {
      page: wrap.dataset.crsPage,
      id: Number(wrap.dataset.courseId) || null,
      slug: wrap.dataset.courseSlug || '',
      title: wrap.dataset.courseTitle || '',
      owned: wrap.dataset.owned === '1',
      lessonId: Number(wrap.dataset.lessonId) || null,
      canRead: wrap.dataset.canRead === '1',
      usdRate: Number(wrap.dataset.usdRate) || 0
    };
    wrap.addEventListener('click', event => {
      const btn = event.target.closest('[data-crs-buy]');
      if (!btn) return;
      event.preventDefault();
      this.openCourseBuy();
    });
    if (this.courseCtx.id && this.currentUser?.role !== 'admin') {
      API.courseEvent({ course_id: this.courseCtx.id, type: 'page_view', visitor_id: this.courseVisitorId() }).catch(() => {});
    }
    if (this.courseCtx.page === 'lesson' && this.courseCtx.canRead && this.courseCtx.lessonId) {
      this.startCourseReadingTracker(this.courseCtx.lessonId);
    }
    // Giristen donuldu: satin alma penceresi kaldigi yerden acilir.
    const params = new URLSearchParams(window.location.search);
    if (params.get('satin-al') === '1') {
      params.delete('satin-al');
      const rest = params.toString();
      history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : ''));
      if (this.currentUser && !this.courseCtx.owned && this.courseCtx.slug) this.openCourseBuy();
    }
  },

  // --- OKUMA TAKIBI ----------------------------------------------------------
  // Sekme gorunurken 15 sn'de bir kalp atisi; sekme gizlenince/kapaninca kalan
  // sure sendBeacon ile gonderilir. Metnin sonuna inilince ders "okundu" olur.
  startCourseReadingTracker(lessonId) {
    const visitorId = this.courseVisitorId();
    let pending = 0;
    let completedSent = false;
    let visibleSince = document.visibilityState === 'visible' ? Date.now() : null;
    let totalSeen = 0;

    const flush = (useBeacon = false, completed = false) => {
      if (visibleSince) {
        const now = Date.now();
        const delta = Math.round((now - visibleSince) / 1000);
        pending += delta;
        totalSeen += delta;
        visibleSince = document.visibilityState === 'visible' ? now : null;
      }
      const seconds = Math.min(30, pending);
      if (!seconds && !completed) return;
      pending = Math.max(0, pending - seconds);
      const body = { lesson_id: lessonId, visitor_id: visitorId, seconds, completed: completed || undefined };
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon('/api/courses/track', new Blob([JSON.stringify(body)], { type: 'application/json' }));
      } else {
        API.trackCourseReading(body).catch(() => {});
      }
    };

    setInterval(() => { if (document.visibilityState === 'visible') flush(); }, 15000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush(true);
      else visibleSince = Date.now();
    });
    window.addEventListener('pagehide', () => flush(true));

    const end = document.getElementById('crs-lesson-end');
    if (end && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        if (completedSent || !entries.some(e => e.isIntersecting)) return;
        // Sayfayi hizla en alta kaydirmak "okudu" sayilmasin.
        const seen = totalSeen + (visibleSince ? (Date.now() - visibleSince) / 1000 : 0);
        if (seen < 20) return;
        completedSent = true;
        observer.disconnect();
        flush(false, true);
      });
      observer.observe(end);
      // 20 sn dolmadan en alta inildiyse esik dolunca tekrar bakilir.
      setTimeout(() => { if (!completedSent) { observer.unobserve(end); observer.observe(end); } }, 21000);
    }
  },

  // --- SATIN ALMA PENCERESI --------------------------------------------------
  courseModal(innerHtml) {
    let overlay = document.getElementById('crs-buy-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'crs-buy-modal';
      overlay.className = 'modal-backdrop active';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'crs-buy-title');
      overlay.addEventListener('click', event => {
        if (event.target === overlay || event.target.closest('[data-crs-close]')) this.closeCourseBuy();
      });
      document.addEventListener('keydown', this.courseEscHandler = event => {
        if (event.key === 'Escape') this.closeCourseBuy();
      });
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `<div class="glass-card modal-content crs-buy-modal">
        <button type="button" class="btn-icon crs-buy-close" aria-label="${this.ui('Kapat', 'Close')}" data-crs-close><i class="fa-solid fa-xmark"></i></button>
        ${innerHtml}
      </div>`;
    return overlay;
  },

  closeCourseBuy() {
    if (this.coursePollTimer) {
      clearInterval(this.coursePollTimer);
      this.coursePollTimer = null;
      showToast(this.ui('Ödemen onaylandığında eğitim hesabında otomatik açılacak.', 'The course will unlock in your account automatically once your payment is approved.'), 'info');
    }
    document.getElementById('crs-buy-modal')?.remove();
    if (this.courseEscHandler) document.removeEventListener('keydown', this.courseEscHandler);
    this.courseEscHandler = null;
  },

  courseBuyHead(subtitle = '') {
    return `<div class="crs-buy-head">
        <span class="crs-buy-icon" aria-hidden="true"><i class="fa-solid fa-graduation-cap"></i></span>
        <div><h2 id="crs-buy-title">${this.escapeHtml(this.courseCtx.title)}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div>
      </div>`;
  },

  async openCourseBuy() {
    const ctx = this.courseCtx;
    if (!ctx?.slug) return;
    if (ctx.owned) { window.location.reload(); return; }
    API.courseEvent({ course_id: ctx.id, type: 'buy_open', visitor_id: this.courseVisitorId() }).catch(() => {});
    this.jt('course_buy_open', { label: ctx.title, meta: { slug: ctx.slug } });

    if (!this.currentUser) {
      this.courseModal(`${this.courseBuyHead(this.ui(
        'Eğitimi satın almak için hesabına giriş yap. Hesabın yoksa ücretsiz kayıt birkaç saniye sürer.',
        'Sign in to buy this course. No account yet? Signing up is free and takes a few seconds.'))}
        <div class="crs-buy-actions">
          <button type="button" class="btn btn-primary" data-crs-auth="login"><i class="fa-solid fa-right-to-bracket"></i> ${this.ui('Giriş Yap', 'Sign In')}</button>
          <button type="button" class="btn btn-outline" data-crs-auth="register"><i class="fa-solid fa-user-plus"></i> ${this.ui('Ücretsiz Kayıt Ol', 'Create a Free Account')}</button>
        </div>`).querySelectorAll('[data-crs-auth]').forEach(btn => {
        btn.addEventListener('click', () => {
          const lang = this.courseLangQuery();
          try { sessionStorage.setItem('girisSonrasiAdres', `${window.location.pathname}?satin-al=1${lang ? `&${lang}` : ''}`); } catch {}
          this.showAuthPage(btn.dataset.crsAuth);
        });
      });
      return;
    }

    this.courseModal(`${this.courseBuyHead()}<p class="crs-buy-loading"><i class="fa-solid fa-spinner fa-spin"></i> ${this.ui('Hazırlanıyor…', 'Preparing…')}</p>`);
    try {
      const q = await API.getCourseQuote(ctx.slug);
      if (q.owned) { window.location.reload(); return; }
      if (q.usd_try) ctx.usdRate = Number(q.usd_try);
      this.renderCourseQuote(q);
    } catch (err) {
      this.courseModal(`${this.courseBuyHead()}<p class="crs-buy-error"><i class="fa-solid fa-circle-exclamation"></i> ${this.escapeHtml(err.message)}</p>`);
    }
  },

  renderCourseQuote(q) {
    const enough = q.shortfall <= 0;
    const rows = [
      [this.ui('Eğitim fiyatı', 'Course price'), this.courseMoney(q.price)],
      [this.ui('Mevcut bakiyen', 'Your balance'), this.courseMoney(q.balance)]
    ];
    if (enough) rows.push([this.ui('Satın alma sonrası bakiye', 'Balance after purchase'), this.courseMoney(q.balance - q.price)]);
    else rows.push([this.ui('Eksik tutar', 'Amount due'), this.courseMoney(q.shortfall)]);

    const consent = `<label class="crs-consent">
        <input type="checkbox" id="crs-consent">
        <span>${this.ui(
          'Dijital içeriğe hemen erişmek istiyorum; içerik açıldıktan sonra cayma hakkımın sona ereceğini kabul ediyorum.',
          'I want immediate access to the digital content and I accept that my right of withdrawal ends once the content is unlocked.')}</span>
      </label>`;
    const tryNote = this.locale === 'en'
      ? '<small class="crs-buy-hint"><i class="fa-solid fa-circle-info"></i> Payments are charged in Turkish lira (TRY); the dollar amount is shown at today\'s exchange rate.</small>'
      : '';

    let action;
    if (enough) {
      action = `<button type="button" class="btn btn-primary crs-buy-go" id="crs-buy-go"><i class="fa-solid fa-wallet"></i> ${this.ui('Bakiyemle Satın Al', 'Buy with My Balance')} · ${this.courseMoneyText(q.price)}</button>${tryNote}`;
    } else if (q.shopier_ready) {
      const extra = q.pay_amount > q.shortfall
        ? `<small class="crs-buy-hint">${this.ui(
          `Kartla en az ₺10 ödenebildiği için ${this.courseFmt(q.pay_amount)} ödeyeceksin; artan ${this.courseFmt(q.pay_amount - q.shortfall)} bakiyende kalır.`,
          `The minimum card payment is ₺10, so you will pay ${this.courseFmt(q.pay_amount)}; the remaining ${this.courseFmt(q.pay_amount - q.shortfall)} stays in your balance.`)}</small>`
        : '';
      action = `<button type="button" class="btn btn-primary crs-buy-go" id="crs-buy-go"><i class="fa-solid fa-credit-card"></i> ${this.ui('Kartla Öde', 'Pay by Card')} · ${this.courseMoneyText(q.pay_amount)}</button>
        <small class="crs-buy-hint"><i class="fa-solid fa-lock"></i> ${this.ui(
          "Ödeme Shopier'in güvenli sayfasında yeni sekmede açılır. Ödeme onaylanınca tutar bakiyene yüklenir ve eğitim otomatik açılır.",
          "Payment opens on Shopier's secure page in a new tab. Once approved, the amount is added to your balance and the course unlocks automatically.")}</small>${extra}${tryNote}`;
    } else {
      action = `<a class="btn btn-primary crs-buy-go" href="/add-funds"><i class="fa-solid fa-wallet"></i> ${this.ui('Bakiye Yükle', 'Add Funds')}</a>
        <small class="crs-buy-hint">${this.ui(
          'Bakiyeni yükledikten sonra bu sayfaya dönüp eğitimi bakiyenle satın alabilirsin.',
          'After adding funds, come back to this page and buy the course with your balance.')}</small>`;
    }

    const overlay = this.courseModal(`${this.courseBuyHead(enough
      ? this.ui('Bakiyen bu eğitim için yeterli.', 'Your balance covers this course.')
      : this.ui('Bakiyen bu eğitim için yetersiz; eksik kısmı kartla tamamlayabilirsin.', "Your balance doesn't cover this course; you can pay the difference by card."))}
      <dl class="crs-buy-rows">${rows.map(([k, v], i) => `<div class="${!enough && i === rows.length - 1 ? 'is-strong' : ''}"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      ${enough || q.shopier_ready ? consent : ''}
      <div class="crs-buy-actions">${action}</div>`);

    const go = overlay.querySelector('#crs-buy-go');
    if (!go || go.tagName === 'A') return;
    go.addEventListener('click', () => {
      if (!overlay.querySelector('#crs-consent')?.checked) {
        showToast(this.ui('Devam etmek için onay kutusunu işaretle.', 'Tick the checkbox to continue.'), 'warning');
        overlay.querySelector('.crs-consent')?.classList.add('is-required');
        return;
      }
      if (enough) this.purchaseCourseWithBalance(go);
      else this.startCourseCheckout(go, q);
    });
  },

  async purchaseCourseWithBalance(btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${this.ui('Satın alınıyor…', 'Purchasing…')}`;
    try {
      await API.purchaseCourse(this.courseCtx.slug);
      this.courseSuccess();
    } catch (err) {
      if (err.code === 'already_owned') { window.location.reload(); return; }
      showToast(err.message, 'error');
      // Bakiye bu arada degismis olabilir: ozet yeniden alinir.
      try { this.renderCourseQuote(await API.getCourseQuote(this.courseCtx.slug)); } catch {}
    }
  },

  async startCourseCheckout(btn, q) {
    // Yeni sekme TIKLAMA ANINDA acilir; istek bittikten sonra acilmaya
    // calisilsa tarayici acilir pencere engelleyicisine takilir.
    const win = window.open('about:blank', '_blank');
    this.jt('course_checkout', { label: this.courseCtx.title, value_kurus: Math.round(Number(q.pay_amount || 0) * 100), meta: { slug: this.courseCtx.slug } });
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${this.ui('Ödeme sayfası hazırlanıyor…', 'Preparing payment page…')}`;
    try {
      const res = await API.startCourseCheckout(this.courseCtx.slug);
      let opened = false;
      if (win && !win.closed) {
        try { win.opener = null; win.location.href = res.payment_url; opened = true; } catch {}
      }
      this.renderCourseWaiting(res, opened);
      this.watchCoursePayment(res.merchant_oid);
    } catch (err) {
      try { win?.close(); } catch {}
      if (err.code === 'already_owned') { window.location.reload(); return; }
      if (err.code === 'enough_balance') {
        try { this.renderCourseQuote(await API.getCourseQuote(this.courseCtx.slug)); } catch {}
        return;
      }
      showToast(err.message, 'error');
      this.renderCourseQuote(q);
    }
  },

  renderCourseWaiting(payment, opened) {
    this.courseModal(`${this.courseBuyHead()}
      <div class="crs-buy-wait">
        <i class="fa-solid fa-hourglass-half fa-spin" aria-hidden="true"></i>
        <div>
          <strong>${this.ui(`${this.courseFmt(payment.amount)} ödemen bekleniyor`, `Waiting for your ${this.courseMoneyText(payment.amount)} payment`)}</strong>
          <p>${opened
            ? this.ui('Ödemeni yeni açılan Shopier sekmesinde tamamla, sonra bu sekmeye dön. Onay gelince eğitim burada otomatik açılacak.',
              'Complete your payment in the new Shopier tab, then come back here. The course will unlock automatically once approved.')
            : this.ui('Tarayıcın yeni sekmeyi açmadı. Aşağıdaki düğmeyle ödeme sayfasına geç; onay gelince eğitim burada otomatik açılacak.',
              'Your browser blocked the new tab. Use the button below to open the payment page; the course will unlock here once approved.')}</p>
        </div>
      </div>
      <div class="crs-buy-actions">
        <a class="btn ${opened ? 'btn-outline' : 'btn-primary'}" href="${this.escapeHtml(payment.payment_url)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${this.ui('Ödeme Sayfasını Aç', 'Open Payment Page')}</a>
      </div>
      <p class="crs-buy-status" id="crs-buy-status" aria-live="polite"></p>`);
  },

  watchCoursePayment(merchantOid) {
    if (this.coursePollTimer) clearInterval(this.coursePollTimer);
    const startedAt = Date.now();
    this.coursePollTimer = setInterval(async () => {
      if (Date.now() - startedAt > 3600000) { clearInterval(this.coursePollTimer); this.coursePollTimer = null; return; }
      try {
        const res = await API.getShopierPaymentStatus(merchantOid);
        if (res.status === 'completed') {
          clearInterval(this.coursePollTimer);
          this.coursePollTimer = null;
          if (res.course_owned) {
            this.courseSuccess();
          } else {
            showToast(this.ui('Ödemen bakiyene eklendi ama eğitim otomatik açılamadı; bakiyenle tekrar deneyebilirsin.',
              'Your payment was added to your balance but the course could not be unlocked automatically; try again with your balance.'), 'warning');
            try { this.renderCourseQuote(await API.getCourseQuote(this.courseCtx.slug)); } catch {}
          }
          try { const me = await API.getMe(); this.currentUser = me.user; this.updateUserHeader(); } catch {}
        } else if (res.status === 'failed') {
          clearInterval(this.coursePollTimer);
          this.coursePollTimer = null;
          const status = document.getElementById('crs-buy-status');
          if (status) {
            const reason = this.escapeHtml(res.failure_reason || this.ui('bilinmeyen neden', 'unknown reason'));
            status.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> ${this.ui(
              `Ödeme tamamlanamadı: ${reason}. Pencereyi kapatıp tekrar deneyebilirsin.`,
              `Payment could not be completed: ${reason}. Close this window and try again.`)}`;
          }
        }
      } catch {}
    }, 5000);
  },

  courseSuccess() {
    const overlay = this.courseModal(`${this.courseBuyHead()}
      <div class="crs-buy-done">
        <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
        <strong>${this.ui('Eğitim açıldı! 🎉', 'Course unlocked! 🎉')}</strong>
        <p>${this.ui('Tüm derslere artık erişebilirsin. Keyifli okumalar.', 'You now have access to every lesson. Enjoy!')}</p>
      </div>
      <div class="crs-buy-actions"><button type="button" class="btn btn-primary" id="crs-buy-start"><i class="fa-solid fa-book-open-reader"></i> ${this.ui('Derslere Başla', 'Start Learning')}</button></div>`);
    showToast(this.ui('Eğitim hesabına tanımlandı! 🎉', 'The course has been added to your account! 🎉'), 'success');
    overlay.querySelector('#crs-buy-start').addEventListener('click', () => window.location.reload());
    setTimeout(() => window.location.reload(), 4000);
  }
});
