// BAYILIK (/bayilik) — Jet kullanicisinin "Bayi Panelim" kutusu. Tanitim
// metni sunucuda basilir (utils/resellerPage.js); bu dosya yalnizca bu
// sayfada app.js tarafindan tembel yuklenir (bkz. SmmApp.openResellerPage)
// ve #bayilik-account kutusunu cizer:
//   ziyaretci      -> kayit / giris (girisden sonra bu sayfaya donulur)
//   bayisi yok     -> site adi + adres formu, "ucretsiz baslat"
//   bayisi var     -> adres, panel baglantisi, abonelik durumu
/* global SmmApp, API, showToast */
'use strict';

Object.assign(SmmApp.prototype, {
  rpPlanText(sub) {
    if (!sub) return '';
    const day = value => {
      const date = new Date(String(value || '').replace(' ', 'T') + 'Z');
      return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    };
    const fee = `₺${Number(sub.fee).toLocaleString('tr-TR')}`;
    switch (sub.plan_status) {
      case 'trial': return sub.auto_renew
        ? `Deneme ${day(sub.trial_ends_at)} tarihinde bitiyor; ${fee} Jet bakiyenden alınacak.`
        : `Ücretsiz deneme: ${sub.days_left} gün kaldı. Devam etmek için panelde "Devam et"e bas.`;
      case 'active': return `Aktif · ${day(sub.paid_until)} tarihine kadar ödendi${sub.auto_renew ? '' : ' (yenileme kapalı)'}.`;
      case 'past_due': return `Aylık ücret alınamadı. ${day(sub.grace_ends_at)} tarihine kadar Jet bakiyeni yükle.`;
      case 'expired': return `Site askıda. ${day(sub.delete_at)} tarihinde silinecek; panelden ödeyip açabilirsin.`;
      default: return 'Ücretsiz panel.';
    }
  },

  async renderResellerAccount() {
    const box = document.getElementById('bayilik-account');
    if (!box) return;
    const esc = value => this.escapeHtml(value);
    if (!this.currentUser) {
      box.innerHTML = `<div class="bp-card bp-cta">
        <div><h2>Hemen ücretsiz başla</h2><p>Jet hesabınla giriş yap; panelin bir dakikada açılsın.</p></div>
        <div class="bp-cta-actions">
          <button type="button" class="btn btn-primary" data-rp-auth="register"><i class="fa-solid fa-user-plus" aria-hidden="true"></i> Ücretsiz Kayıt Ol</button>
          <button type="button" class="btn btn-outline" data-rp-auth="login"><i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i> Giriş Yap</button>
        </div>
      </div>`;
      this.rpBind(box);
      return;
    }
    box.innerHTML = '<div class="bp-card"><p class="bp-muted">Yükleniyor…</p></div>';
    let me;
    try {
      me = await API.getResellerMe();
    } catch (err) {
      box.innerHTML = `<div class="bp-card"><p class="bp-muted">${esc(err.message)}</p></div>`;
      return;
    }
    if (me.tenant) {
      const t = me.tenant;
      const panelUrl = t.panel_url || (t.address ? `https://${t.address}/admin` : '');
      box.innerHTML = `<div class="bp-card bp-mine">
        <div class="bp-mine-head"><span class="bp-kicker"><i class="fa-solid fa-store" aria-hidden="true"></i> Bayi Panelim</span><h2>${esc(t.name)}</h2></div>
        <dl class="bp-dl">
          <dt>Site adresi</dt><dd>${t.address ? `<a href="https://${esc(t.address)}" target="_blank" rel="noopener">${esc(t.address)}</a>` : 'Adres yakında tanımlanacak'}</dd>
          <dt>Durum</dt><dd>${esc(this.rpPlanText(t.subscription))}</dd>
        </dl>
        ${panelUrl ? `<a class="btn btn-primary" href="${esc(panelUrl)}" target="_blank" rel="noopener"><i class="fa-solid fa-gauge-high" aria-hidden="true"></i> Yönetim Paneline Git</a>` : ''}
        <p class="bp-muted">Panele Jet kullanıcı adın ve şifrenle girersin.</p>
      </div>`;
      return;
    }
    if (!me.applications_open) {
      box.innerHTML = '<div class="bp-card"><p>Bayilik başvuruları şu anda kapalı. Kısa süre sonra yeniden açılacak.</p></div>';
      return;
    }
    const base = me.base_domain || '';
    box.innerHTML = `<form class="bp-card bp-form" id="rp-apply-form" novalidate>
      <h2>Panelini aç · ${esc(me.trial_days)} gün ücretsiz</h2>
      <label>Site adı<input name="name" class="form-control" maxlength="60" placeholder="Örn: Kanka SMM" required></label>
      <label>Adres <small>(küçük harf, rakam ve tire; 3-30 karakter)</small>
        <span class="bp-slug"><input name="slug" class="form-control" maxlength="30" placeholder="kankasmm" autocomplete="off" spellcheck="false" required>${base ? `<span>.${esc(base)}</span>` : ''}</span>
      </label>
      <p class="bp-preview" id="rp-preview"></p>
      <p class="bp-error" role="alert"></p>
      <button type="submit" class="btn btn-primary"><i class="fa-solid fa-rocket" aria-hidden="true"></i> Ücretsiz Başlat</button>
      <p class="bp-muted">Deneme süresince ücret alınmaz. Sonrasında devam edersen aylık ₺${Number(me.monthly_fee).toLocaleString('tr-TR')} Jet bakiyenden alınır.</p>
    </form>`;
    const form = document.getElementById('rp-apply-form');
    const preview = () => {
      const slug = form.elements.namedItem('slug').value.trim().toLowerCase();
      document.getElementById('rp-preview').textContent = slug && base ? `Siten: https://${slug}.${base}` : '';
    };
    form.elements.namedItem('name').addEventListener('input', event => {
      const slugInput = form.elements.namedItem('slug');
      if (slugInput.dataset.touched) return;
      slugInput.value = event.target.value.toLocaleLowerCase('tr-TR')
        .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
      preview();
    });
    form.elements.namedItem('slug').addEventListener('input', event => { event.target.dataset.touched = '1'; preview(); });
    form.addEventListener('submit', event => this.rpSubmit(event));
  },

  async rpSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const errorEl = form.querySelector('.bp-error');
    const button = form.querySelector('button[type=submit]');
    errorEl.textContent = '';
    button.disabled = true;
    try {
      const res = await API.applyReseller({
        name: form.elements.namedItem('name').value.trim(),
        slug: form.elements.namedItem('slug').value.trim().toLowerCase()
      });
      showToast(res.message, 'success');
      this.jt?.('reseller_apply', { label: res.tenant?.slug || '' });
      await this.renderResellerAccount();
    } catch (err) {
      errorEl.textContent = err.message;
      button.disabled = false;
    }
  },

  rpBind(box) {
    box.querySelectorAll('[data-rp-auth]').forEach(btn => btn.addEventListener('click', () => {
      try { sessionStorage.setItem('girisSonrasiAdres', '/bayilik'); } catch { /* gizli pencere */ }
      this.showAuthPage(btn.dataset.rpAuth === 'register' ? 'register' : 'login');
    }));
  }
});
