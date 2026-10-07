// ADMIN > IZLEME > ZIYARETCI AYAK IZI. Bu dosya ziyaretcilere GONDERILMEZ:
// yalnizca yonetici sekmeyi actiginda app.js tarafindan yuklenir
// (bkz. SmmApp.openAdminFootprintTab). Veri: routes/adminFootprint.js
/* global SmmApp, API, showToast */
'use strict';

const FP_CHANNELS = {
  reklam: { label: 'Reklam', color: '#ed2d2d' },
  eposta: { label: 'E-posta', color: '#7c3aed' },
  davet: { label: 'Davet linki', color: '#16a34a' },
  kampanya: { label: 'Kampanya (UTM)', color: '#f59e0b' },
  arama: { label: 'Arama motoru', color: '#1769e8' },
  sosyal: { label: 'Sosyal medya', color: '#e1306c' },
  yonlendiren: { label: 'Yönlendiren site', color: '#0891b2' },
  dogrudan: { label: 'Doğrudan', color: '#555555' },
  bilinmiyor: { label: 'Bilinmiyor', color: '#999999' },
  izlenmedi: { label: 'İzlenmedi (eski üye)', color: '#bbbbbb' }
};

const FP_KINDS = {
  page_view: ['📄', 'Sayfa açtı'],
  not_found: ['🚫', '404 — sayfa bulunamadı'],
  service_search: ['🔎', 'Hizmet aradı'],
  service_view: ['👀', 'Hizmet detayına baktı'],
  click: ['👆', 'Tıkladı'],
  outbound_click: ['↗️', 'Dış bağlantıya gitti'],
  auth_view: ['🔐', 'Giriş/kayıt ekranını açtı'],
  register_submit: ['📝', 'Kayıt formunu gönderdi'],
  login_submit: ['🔑', 'Giriş denedi'],
  order_click: ['🛒', 'Sipariş makinesinde sipariş verdi'],
  order_submit: ['🧾', 'Sipariş formunu gönderdi'],
  topup_start: ['💳', 'Bakiye yüklemeye başladı'],
  coupon_submit: ['🎟️', 'Kupon denedi'],
  ticket_submit: ['🎧', 'Destek formu gönderdi'],
  course_buy_open: ['🎓', 'Eğitim satın al penceresini açtı'],
  course_checkout: ['💳', 'Eğitim için kart ödemesi başlattı'],
  api_error: ['⚠️', 'Hata aldı'],
  js_error: ['🐞', 'Sayfa hatası'],
  rage_click: ['😤', 'Sinirli tıklama (çalışmayan bir şey olabilir)'],
  lang_change: ['🌐', 'Dil değiştirdi'],
  consent: ['🍪', 'Çerez tercihi'],
  register_success: ['✅', 'KAYIT OLDU'],
  login_success: ['🔓', 'Giriş yaptı'],
  topup_success: ['💰', 'BAKİYE YÜKLEDİ'],
  order_created: ['📦', 'SİPARİŞ VERDİ'],
  course_purchase: ['🎓', 'EĞİTİM SATIN ALDI'],
  ticket_created: ['🎧', 'Destek talebi açtı'],
  coupon_redeemed: ['🎟️', 'Kupon kullandı']
};

Object.assign(SmmApp.prototype, {
  // --- yardimcilar -------------------------------------------------------------
  fpE(v) { return this.escapeHtml(v == null ? '' : String(v)); },
  fpNum(v) { return Number(v || 0).toLocaleString('tr-TR'); },
  // Kayit yontemi rozeti: Google ile mi, formla mi? (users.signup_method / google_sub)
  fpSignup(u) {
    if (u?.signup_method === 'google') return ' <span class="fp-flag" title="Google ile giriş yaparak kayıt oldu"><i class="fa-brands fa-google"></i> Google</span>';
    if (Number(u?.google_linked) === 1) return ' <span class="fp-flag" title="Formla kayıt oldu, sonradan Google hesabını bağladı"><i class="fa-brands fa-google"></i> bağlı</span>';
    return '';
  },
  fpSignupText(u) {
    if (u?.signup_method === 'google') return ' · Google ile';
    return Number(u?.google_linked) === 1 ? ' · formla (Google bağlı)' : '';
  },
  fpMethodRow(r) {
    const ad = r.method === 'google' ? '<i class="fa-brands fa-google"></i> Google ile giriş' : 'Kayıt formu';
    return `<tr><td>${ad}</td><td>${this.fpNum(r.users)}</td><td>${this.fpNum(r.payers)}</td><td>%${r.payer_rate}</td></tr>`;
  },
  fpTL(v) { const n = Number(v || 0); return `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`; },
  fpDur(sec) {
    const s = Math.max(0, Math.round(Number(sec) || 0));
    if (s < 60) return `${s} sn`;
    if (s < 3600) return `${Math.floor(s / 60)} dk ${s % 60} sn`;
    return `${Math.floor(s / 3600)} sa ${Math.floor((s % 3600) / 60)} dk`;
  },
  fpDate(v, withSec = false) {
    if (!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: withSec ? '2-digit' : undefined });
  },
  fpChannel(c) {
    const ch = FP_CHANNELS[c] || FP_CHANNELS.bilinmiyor;
    return `<span class="fp-chip" style="--fp-c:${ch.color}">${this.fpE(ch.label)}</span>`;
  },
  fpDevice(r) {
    const icon = r.device === 'mobile' ? 'fa-mobile-screen' : r.device === 'tablet' ? 'fa-tablet-screen-button' : 'fa-desktop';
    return `<i class="fa-solid ${icon}" title="${this.fpE(r.device || '')}"></i> ${this.fpE([r.os, r.browser].filter(Boolean).join(' · ') || '—')}`;
  },
  fpPlace(r) {
    if (!r.country && !r.city) return '—';
    return `${this.fpE(r.city ? `${r.city}, ` : '')}${this.fpE(r.country || '')}`;
  },
  fpFlags(r) {
    const f = [];
    if (r.did_register) f.push('<span class="fp-flag good">Kayıt</span>');
    if (r.did_login) f.push('<span class="fp-flag">Giriş</span>');
    if (r.did_topup) f.push(`<span class="fp-flag good">Yükleme${r.topup ? ` ${this.fpTL(r.topup)}` : ''}</span>`);
    if (r.did_order) f.push('<span class="fp-flag good">Sipariş</span>');
    if (r.did_course) f.push('<span class="fp-flag good">Eğitim</span>');
    if (r.had_error) f.push('<span class="fp-flag bad">Hata</span>');
    if (r.interacted === 0 && (r.pageviews || 0) <= 1) f.push('<span class="fp-flag mid" title="Etkileşimsiz tek sayfa: olası bot">Şüpheli</span>');
    return f.join(' ') || '<span class="fp-muted">—</span>';
  },
  fpLink(url) {
    if (!url || !/^https?:\/\//i.test(url)) return this.fpE(url || '—');
    return `<a href="${this.fpE(url)}" target="_blank" rel="noopener noreferrer nofollow" class="fp-ext">${this.fpE(url.replace(/^https?:\/\/(www\.)?/, ''))}</a>`;
  },
  fpQuery() {
    const range = this.fpRange || '7';
    const params = new URLSearchParams();
    if (range === 'custom' && this.fpFrom && this.fpTo) { params.set('from', this.fpFrom); params.set('to', this.fpTo); } else params.set('range', range);
    return params;
  },
  fpToolbar(onChange) {
    const r = this.fpRange || '7';
    const opt = (v, l) => `<option value="${v}"${r === v ? ' selected' : ''}>${l}</option>`;
    return `<div class="glass-card fp-toolbar">
      <label for="fp-range">Dönem</label>
      <select id="fp-range" class="form-control" style="max-width: 170px;">
        ${opt('today', 'Bugün')}${opt('yesterday', 'Dün')}${opt('7', 'Son 7 gün')}${opt('30', 'Son 30 gün')}${opt('90', 'Son 90 gün')}${opt('custom', 'Tarih aralığı…')}
      </select>
      <span class="fp-custom" style="${r === 'custom' ? '' : 'display:none;'}">
        <input type="date" id="fp-from" class="form-control" value="${this.fpE(this.fpFrom || '')}">
        <input type="date" id="fp-to" class="form-control" value="${this.fpE(this.fpTo || '')}">
      </span>
      <button type="button" class="btn btn-outline btn-sm" id="fp-refresh"><i class="fa-solid fa-rotate"></i> Yenile</button>
      <span class="fp-muted" id="fp-window-label"></span>
    </div>`;
  },
  fpBindToolbar(root, onChange) {
    const sel = root.querySelector('#fp-range');
    const custom = root.querySelector('.fp-custom');
    const apply = () => {
      this.fpRange = sel.value;
      if (sel.value === 'custom') {
        custom.style.display = '';
        this.fpFrom = root.querySelector('#fp-from').value;
        this.fpTo = root.querySelector('#fp-to').value;
        if (!this.fpFrom || !this.fpTo) return;
      }
      onChange();
    };
    sel.addEventListener('change', apply);
    root.querySelector('#fp-from')?.addEventListener('change', apply);
    root.querySelector('#fp-to')?.addEventListener('change', apply);
    root.querySelector('#fp-refresh').addEventListener('click', onChange);
  },
  fpTable(head, rows, empty = 'Bu dönemde kayıt yok.') {
    return `<div class="table-responsive"><table class="custom-table fp-table"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.length ? rows.join('') : `<tr><td colspan="${head.length}" class="text-center fp-muted">${empty}</td></tr>`}</tbody></table></div>`;
  },
  fpCard(title, body, sub = '') {
    return `<section class="glass-card fp-card"><h3 class="fp-card-title">${title}${sub ? ` <small>${sub}</small>` : ''}</h3>${body}</section>`;
  },
  // Tek serili cubuk grafik (tek eksen, tek renk); deger uzerine gelince.
  fpBars(rows, key, title, labelOf, fmt = v => this.fpNum(v)) {
    const values = rows.map(r => Number(r[key] || 0));
    const max = Math.max(...values, 0);
    const total = values.reduce((a, b) => a + b, 0);
    const bars = rows.map((r, i) => {
      const h = max ? Math.max(values[i] ? 3 : 0, Math.round((values[i] / max) * 100)) : 0;
      const tip = `${labelOf(r)}: ${fmt(values[i])}`;
      return `<span class="crs-bar" data-tip="${this.fpE(tip)}" aria-label="${this.fpE(tip)}"><i style="height:${h}%"></i></span>`;
    }).join('');
    return `<figure class="glass-card crs-chart"><figcaption><span>${title}</span><strong>${fmt(total)}</strong></figcaption>
      <div class="crs-bars" role="img" aria-label="${this.fpE(`${title}: toplam ${fmt(total)}`)}">${bars}</div>
      <div class="crs-chart-axis"><span>${rows[0] ? this.fpE(labelOf(rows[0])) : ''}</span><span>en yüksek: ${fmt(max)}</span><span>${rows.length ? this.fpE(labelOf(rows[rows.length - 1])) : ''}</span></div></figure>`;
  },

  // --- bolum gecisi --------------------------------------------------------------
  showFootprintSection(section) {
    this.footprintSection = section === 'detail' ? (this.footprintSection || 'sessions') : section;
    document.querySelectorAll('#admin-tab-footprint [data-fp-panel]').forEach(el => { el.style.display = el.dataset.fpPanel === section ? '' : 'none'; });
    document.querySelectorAll('#fp-subtabs [data-fp-section]').forEach(btn => {
      const on = btn.dataset.fpSection === section;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (section !== 'live' && this.fpLiveTimer) { clearInterval(this.fpLiveTimer); this.fpLiveTimer = null; }
    if (section === 'overview') this.loadFootprintOverview();
    if (section === 'live') this.loadFootprintLive(true);
    if (section === 'sessions') this.loadFootprintSessions();
    if (section === 'users') this.loadFootprintUsers();
  },

  // --- GENEL BAKIS ------------------------------------------------------------------
  async loadFootprintOverview() {
    const box = document.getElementById('fp-panel-overview');
    if (!box) return;
    box.innerHTML = `${this.fpToolbar()}<p class="health-loading">Yükleniyor…</p>`;
    this.fpBindToolbar(box, () => this.loadFootprintOverview());
    try {
      const d = await API.request(`/admin/footprint/overview?${this.fpQuery()}`);
      this.renderFootprintOverview(box, d);
    } catch (err) {
      box.querySelector('.health-loading').outerHTML = `<div class="glass-card"><p style="color: var(--danger);">Ayak izi yüklenemedi: ${this.fpE(err.message)}</p></div>`;
    }
  },

  renderFootprintOverview(box, d) {
    const s = d.summary;
    const kpi = (icon, cls, value, label, sub = '') => `<div class="glass-card stat-card">
        <div class="stat-icon ${cls}"><i class="fa-solid ${icon}"></i></div>
        <div><div class="stat-val">${value}</div><div class="stat-lbl">${label}</div>${sub ? `<div class="course-kpi-sub">${sub}</div>` : ''}</div></div>`;
    const tl = d.timeline.rows;
    const tLabel = r => (d.timeline.unit === 'hour' ? `${r.bucket}:00` : new Date(`${r.bucket}T12:00:00Z`).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }));
    const conv = r => `%${r.sessions ? Math.round((r.converted / r.sessions) * 1000) / 10 : 0}`;
    const chRow = r => `<tr data-fp-filter="channel" data-fp-value="${this.fpE(r.k)}"><td>${this.fpChannel(r.k)}</td><td>${this.fpNum(r.sessions)}</td><td>${this.fpNum(r.registered)}</td><td>${this.fpNum(r.topups)}</td><td>${this.fpNum(r.converted)}</td><td>${conv(r)}</td><td>${this.fpTL(r.topup)}</td><td>${this.fpTL(r.revenue)}</td></tr>`;
    const simple = (rows, label) => this.fpTable([label, 'Oturum', 'Kayıt', 'Dönüşen'], rows.map(r => `<tr><td>${this.fpE(r.k)}</td><td>${this.fpNum(r.sessions)}</td><td>${this.fpNum(r.registered)}</td><td>${this.fpNum(r.converted)}</td></tr>`));
    const first = d.funnel[0]?.n || 0;
    const funnel = d.funnel.map((f, i) => {
      const prev = i ? d.funnel[i - 1].n : f.n;
      const w = first ? Math.max(2, Math.round((f.n / first) * 100)) : 0;
      return `<div class="fp-funnel-row"><span class="fp-funnel-label">${this.fpE(f.label)}</span>
        <span class="fp-funnel-bar"><i style="width:${w}%"></i></span>
        <span class="fp-funnel-n"><strong>${this.fpNum(f.n)}</strong> <small>${i ? `önceki adımın %${prev ? Math.round((f.n / prev) * 100) : 0}'i` : ''}</small></span></div>`;
    }).join('');

    box.innerHTML = `${this.fpToolbar()}
      <div class="stats-grid mb-20">
        ${kpi('fa-route', 'cyan', this.fpNum(s.sessions), 'Oturum', `${this.fpNum(s.visitors)} tekil ziyaretçi`)}
        ${kpi('fa-user-plus', '', `${this.fpNum(s.new_visitors)} / ${this.fpNum(s.returning_visitors)}`, 'Yeni / geri dönen', `çerez onayı: %${s.consent_rate}`)}
        ${kpi('fa-clock', 'cyan', this.fpDur(s.avg_duration), 'Ortalama süre', `${s.pages_per_session || 0} sayfa / oturum`)}
        ${kpi('fa-door-open', '', `%${s.bounce_rate}`, 'Hemen çıkma', 'tek sayfa ve 15 sn altı')}
        ${kpi('fa-id-card', 'cyan', this.fpNum(s.registered), 'Kayıt olan', `%${s.register_rate} · ${this.fpNum(s.logins)} giriş${s.google_registered || s.google_logins ? ` · Google ile: ${this.fpNum(s.google_registered)} kayıt / ${this.fpNum(s.google_logins)} giriş` : ''}`)}
        ${kpi('fa-wallet', '', this.fpTL(s.topup), 'Bakiye yükleme', `${this.fpNum(s.topups)} oturumda`)}
        ${kpi('fa-cart-shopping', 'cyan', this.fpTL(s.revenue), 'Sipariş + eğitim', `${this.fpNum(s.orders)} sipariş · ${this.fpNum(s.courses)} eğitim`)}
        ${kpi('fa-percent', '', `%${s.conversion_rate}`, 'Dönüşüm', 'sipariş/eğitim alan oturum')}
        ${kpi('fa-triangle-exclamation', 'cyan', this.fpNum(s.errors), 'Hata alan oturum')}
        ${kpi('fa-robot', '', `${this.fpNum(s.bots)}`, 'Ayıklanan bot isteği', `${this.fpNum(s.suspicious)} şüpheli oturum ayrıca gizlendi`)}
      </div>
      <div class="crs-chart-grid mb-20">
        ${this.fpBars(tl, 'sessions', d.timeline.unit === 'hour' ? 'Saatlik oturum' : 'Günlük oturum', tLabel)}
        ${this.fpBars(tl, 'registered', 'Kayıt olan', tLabel)}
        ${this.fpBars(tl, 'converted', 'Sipariş/eğitim alan oturum', tLabel)}
        ${this.fpBars(d.hours, 'n', 'Saatlere göre oturum (TR)', r => `${String(r.h).padStart(2, '0')}:00`)}
      </div>
      ${this.fpCard('Satış hunisi', `<div class="fp-funnel">${funnel}</div>`, 'adımı geçen oturum sayısı')}
      <div class="fp-grid">
        ${this.fpCard('Kanallar', this.fpTable(['Kanal', 'Oturum', 'Kayıt', 'Yükleme', 'Dönüşen', 'Dönüşüm', 'Yüklenen', 'Ciro'], d.channels.map(chRow)), 'satıra tıkla → oturumlar')}
        ${this.fpCard('Kaynaklar', this.fpTable(['Kaynak', 'Oturum', 'Kayıt', 'Yükleme', 'Dönüşen', 'Ciro'], d.sources.map(r => `<tr data-fp-filter="q" data-fp-value="${this.fpE(r.k)}"><td>${this.fpE(r.k)}</td><td>${this.fpNum(r.sessions)}</td><td>${this.fpNum(r.registered)}</td><td>${this.fpNum(r.topups)}</td><td>${this.fpNum(r.converted)}</td><td>${this.fpTL(r.revenue)}</td></tr>`)))}
      </div>
      ${this.fpCard('Geldikleri tam adresler', this.fpTable(['Referans adresi', 'Kanal', 'Oturum', 'Kayıt', 'Dönüşen'], d.referrers.map(r => `<tr><td class="fp-wrap">${this.fpLink(r.url)}</td><td>${this.fpChannel(r.channel)}</td><td>${this.fpNum(r.sessions)}</td><td>${this.fpNum(r.registered)}</td><td>${this.fpNum(r.converted)}</td></tr>`)), 'arama motorlarında gizlilik için yalnızca alan adı')}
      ${this.fpCard('Kampanyalar ve reklamlar (UTM / reklam tıklaması)', this.fpTable(['Kaynak', 'Ortam', 'Kampanya', 'Oturum', 'Kayıt', 'Dönüşen', 'Yüklenen', 'Ciro'], d.campaigns.map(r => `<tr><td>${this.fpE(r.source)}</td><td>${this.fpE(r.medium)}</td><td>${this.fpE(r.campaign)}</td><td>${this.fpNum(r.sessions)}</td><td>${this.fpNum(r.registered)}</td><td>${this.fpNum(r.converted)}</td><td>${this.fpTL(r.topup)}</td><td>${this.fpTL(r.revenue)}</td></tr>`), 'Bu dönemde UTM etiketli ya da reklamdan gelen ziyaret yok. Linklerine ?utm_source=...&utm_campaign=... ekleyerek takip edebilirsin.'))}
      <div class="fp-grid">
        ${this.fpCard('Giriş sayfaları', this.fpTable(['Sayfa', 'Oturum', 'Hemen çıkma', 'Kayıt', 'Dönüşüm'], d.landings.map(r => `<tr><td class="fp-wrap">${this.fpE(r.path)}</td><td>${this.fpNum(r.sessions)}</td><td>%${r.bounce_rate}</td><td>${this.fpNum(r.registered)}</td><td>%${r.conversion_rate}</td></tr>`)), 'ziyaretçinin ilk açtığı sayfa')}
        ${this.fpCard('Satın almadan çıkılan sayfalar', this.fpTable(['Son sayfa', 'Oturum'], d.exits.map(r => `<tr><td class="fp-wrap">${this.fpE(r.path)}</td><td>${this.fpNum(r.sessions)}</td></tr>`)), 'sipariş/eğitim almadan ayrılanlar')}
      </div>
      ${this.fpCard('Sayfalar: görüntülenme, kalma süresi, kaydırma', this.fpTable(['Sayfa', 'Görüntülenme', 'Oturum', 'Ort. kalma', 'Ort. kaydırma'], d.pages.map(r => `<tr><td class="fp-wrap">${this.fpE(r.path)}</td><td>${this.fpNum(r.views)}</td><td>${this.fpNum(r.sessions)}</td><td>${r.avg_sec == null ? '—' : this.fpDur(r.avg_sec)}</td><td>${r.avg_scroll == null ? '—' : `%${r.avg_scroll}`}</td></tr>`)))}
      <div class="fp-grid">
        ${this.fpCard('Hizmet aramaları', this.fpTable(['Aranan', 'Oturum', 'Sonuç'], d.searches.map(r => `<tr class="${Number(r.min_results) === 0 ? 'fp-row-bad' : ''}"><td>${this.fpE(r.term)}</td><td>${this.fpNum(r.sessions)}</td><td>${Number(r.min_results) === 0 ? '<span class="fp-flag bad">Bulunamadı</span>' : this.fpNum(r.min_results)}</td></tr>`)), 'kırmızı: sitede olmayan, eklenebilecek hizmet')}
        ${this.fpCard('En çok tıklananlar', this.fpTable(['Öğe', 'Tıklama', 'Oturum'], d.clicks.map(r => `<tr><td>${this.fpE(r.label)}</td><td>${this.fpNum(r.n)}</td><td>${this.fpNum(r.sessions)}</td></tr>`)))}
      </div>
      ${this.fpCard('Hatalar ve takılmalar', this.fpTable(['Tür', 'Ayrıntı', 'Kez', 'Oturum'], d.errors.map(r => `<tr><td>${(FP_KINDS[r.kind] || ['', r.kind]).join(' ')}</td><td class="fp-wrap">${this.fpE(r.label)}</td><td>${this.fpNum(r.n)}</td><td>${this.fpNum(r.sessions)}</td></tr>`), 'Bu dönemde hata yok 🎉'))}
      <div class="fp-grid fp-grid-3">
        ${this.fpCard('Cihaz', simple(d.devices, 'Cihaz'))}
        ${this.fpCard('İşletim sistemi', simple(d.oses, 'Sistem'))}
        ${this.fpCard('Tarayıcı / uygulama', simple(d.browsers, 'Tarayıcı'))}
        ${this.fpCard('Ülke', simple(d.countries, 'Ülke'))}
        ${this.fpCard('Şehir', simple(d.cities, 'Şehir'), 'Cloudflare konum başlığı açıksa')}
        ${this.fpCard('Dil', simple(d.langs, 'Dil'))}
      </div>`;
    box.querySelector('#fp-window-label').textContent = `${d.window.label}`;
    this.fpBindToolbar(box, () => this.loadFootprintOverview());
    box.querySelectorAll('[data-fp-filter]').forEach(tr => {
      tr.style.cursor = 'pointer';
      tr.addEventListener('click', () => {
        this.fpSessionFilters = { [tr.dataset.fpFilter]: tr.dataset.fpValue };
        this.showFootprintSection('sessions');
      });
    });
  },

  // --- CANLI ---------------------------------------------------------------------------
  async loadFootprintLive(first = false) {
    const box = document.getElementById('fp-panel-live');
    if (!box) return;
    if (first) box.innerHTML = '<p class="health-loading">Yükleniyor…</p>';
    try {
      const d = await API.request('/admin/footprint/live');
      const rows = d.sessions.map(r => `<tr data-fp-session="${this.fpE(r.id)}">
          <td>${r.username ? `<strong>${this.fpE(r.username)}</strong>` : '<span class="fp-muted">Ziyaretçi</span>'}${r.consent ? '' : ' <span class="fp-flag" title="Çerez onayı yok: anonim">anonim</span>'}</td>
          <td class="fp-wrap"><strong>${this.fpE(r.current_path || r.exit_path || '/')}</strong><br><small class="fp-muted">giriş: ${this.fpE(r.entry_path || '/')}</small></td>
          <td>${this.fpChannel(r.channel)}<br><small>${this.fpE(r.source || '')}</small></td>
          <td>${this.fpDur(r.duration_sec)} · ${this.fpNum(r.pageviews)} sayfa</td>
          <td>${this.fpDevice(r)}</td><td>${this.fpPlace(r)}</td>
          <td>${this.fpDate(r.last_seen_at, true)}</td></tr>`);
      box.innerHTML = `<div class="stats-grid mb-20">
          <div class="glass-card stat-card"><div class="stat-icon cyan"><i class="fa-solid fa-circle-dot"></i></div><div><div class="stat-val">${this.fpNum(d.count)}</div><div class="stat-lbl">Şu an sitede</div><div class="course-kpi-sub">son 5 dakikada hareket eden</div></div></div>
          <div class="glass-card stat-card"><div class="stat-icon"><i class="fa-solid fa-user-check"></i></div><div><div class="stat-val">${this.fpNum(d.members)}</div><div class="stat-lbl">Giriş yapmış üye</div></div></div>
        </div>
        ${d.pages.length ? this.fpCard('Şu an açık sayfalar', `<div class="fp-pills">${d.pages.map(p => `<span class="fp-pill">${this.fpE(p.path)} <strong>${p.n}</strong></span>`).join('')}</div>`) : ''}
        ${this.fpCard('Aktif ziyaretçiler', this.fpTable(['Kim', 'Şu anki sayfa', 'Kaynak', 'Süre', 'Cihaz', 'Konum', 'Son hareket'], rows, 'Şu an sitede kimse yok.'), '15 saniyede bir yenilenir · satıra tıkla → yolculuk')}`;
      box.querySelectorAll('[data-fp-session]').forEach(tr => { tr.style.cursor = 'pointer'; tr.addEventListener('click', () => this.openFootprintSession(tr.dataset.fpSession)); });
    } catch (err) {
      box.innerHTML = `<div class="glass-card"><p style="color: var(--danger);">Canlı veri alınamadı: ${this.fpE(err.message)}</p></div>`;
    }
    if (first && !this.fpLiveTimer) {
      this.fpLiveTimer = setInterval(() => {
        if (this.footprintSection !== 'live' || document.getElementById('admin-tab-footprint')?.style.display === 'none') {
          clearInterval(this.fpLiveTimer); this.fpLiveTimer = null; return;
        }
        if (document.visibilityState === 'visible') this.loadFootprintLive(false);
      }, 15000);
    }
  },

  // --- OTURUMLAR ------------------------------------------------------------------------
  async loadFootprintSessions(page = 1) {
    const box = document.getElementById('fp-panel-sessions');
    if (!box) return;
    const f = this.fpSessionFilters || {};
    const sel = (key, options) => `<select class="form-control" data-fp-key="${key}">${options.map(([v, l]) => `<option value="${v}"${String(f[key] ?? '') === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
    const yesNo = (key, label) => sel(key, [['', `${label}: hepsi`], ['1', `${label}: var`], ['0', `${label}: yok`]]);
    box.innerHTML = `${this.fpToolbar()}
      <div class="glass-card fp-filters">
        <input type="search" class="form-control" data-fp-key="q" placeholder="🔍 Kullanıcı, sayfa, kaynak, kampanya, şehir, aranan kelime…" value="${this.fpE(f.q || '')}">
        ${sel('channel', [['', 'Tüm kanallar'], ...Object.entries(FP_CHANNELS).filter(([k]) => k !== 'izlenmedi' && k !== 'bilinmiyor').map(([k, v]) => [k, v.label])])}
        ${sel('device', [['', 'Tüm cihazlar'], ['mobile', 'Mobil'], ['desktop', 'Masaüstü'], ['tablet', 'Tablet']])}
        ${sel('member', [['', 'Üye: hepsi'], ['1', 'Giriş yapmış'], ['0', 'Ziyaretçi']])}
        ${yesNo('registered', 'Kayıt')}${yesNo('topup', 'Yükleme')}${yesNo('ordered', 'Sipariş')}${yesNo('course', 'Eğitim')}${yesNo('error', 'Hata')}
        ${sel('real', [['', 'Gerçek oturumlar'], ['0', 'Şüpheliler dahil']])}
        <button type="button" class="btn btn-outline btn-sm" data-fp-clear>Temizle</button>
      </div>
      <div id="fp-sessions-body"><p class="health-loading">Yükleniyor…</p></div>`;
    this.fpBindToolbar(box, () => this.loadFootprintSessions());
    let qTimer;
    box.querySelectorAll('[data-fp-key]').forEach(el => {
      const update = () => {
        const next = { ...(this.fpSessionFilters || {}) };
        if (el.value) next[el.dataset.fpKey] = el.value; else delete next[el.dataset.fpKey];
        this.fpSessionFilters = next;
        this.loadFootprintSessionsBody(1);
      };
      el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', () => {
        if (el.tagName === 'INPUT') { clearTimeout(qTimer); qTimer = setTimeout(update, 450); } else update();
      });
    });
    box.querySelector('[data-fp-clear]').addEventListener('click', () => { this.fpSessionFilters = {}; this.loadFootprintSessions(); });
    this.loadFootprintSessionsBody(page);
  },

  async loadFootprintSessionsBody(page = 1) {
    const body = document.getElementById('fp-sessions-body');
    if (!body) return;
    const params = this.fpQuery();
    Object.entries(this.fpSessionFilters || {}).forEach(([k, v]) => params.set(k, v));
    params.set('page', page);
    try {
      const d = await API.request(`/admin/footprint/sessions?${params}`);
      const label = document.getElementById('fp-window-label');
      if (label) label.textContent = `${d.window.label} · ${this.fpNum(d.total)} oturum`;
      const rows = d.sessions.map(r => `<tr data-fp-session="${this.fpE(r.id)}">
          <td>${this.fpDate(r.started_at)}</td>
          <td>${r.username ? `<strong>${this.fpE(r.username)}</strong>` : '<span class="fp-muted">Ziyaretçi</span>'}${r.consent ? (r.is_new ? ' <span class="fp-flag">yeni</span>' : ' <span class="fp-flag">geri döndü</span>') : ' <span class="fp-flag" title="Çerez onayı yok">anonim</span>'}</td>
          <td>${this.fpChannel(r.channel)}<br><small class="fp-wrap">${this.fpE(r.source || '')}${r.utm_campaign ? ` · ${this.fpE(r.utm_campaign)}` : ''}</small></td>
          <td class="fp-wrap">${this.fpE(r.entry_path || '/')}${r.exit_path && r.exit_path !== r.entry_path ? `<br><small class="fp-muted">→ ${this.fpE(r.exit_path)}</small>` : ''}</td>
          <td>${this.fpNum(r.pageviews)} sayfa<br><small>${this.fpDur(r.duration_sec)}</small></td>
          <td>${this.fpDevice(r)}<br><small>${this.fpPlace(r)}</small></td>
          <td>${this.fpFlags(r)}</td></tr>`);
      body.innerHTML = `${this.fpTable(['Başlangıç', 'Kim', 'Kanal / kaynak', 'Giriş → çıkış', 'Gezinti', 'Cihaz / konum', 'Sonuç'], rows, 'Bu filtrelere uyan oturum yok.')}
        <div class="table-pagination fp-pager">
          <button class="btn btn-outline btn-sm" ${d.page <= 1 ? 'disabled' : ''} data-fp-page="${d.page - 1}">Önceki</button>
          <span>${d.page} / ${Math.max(1, d.pages)}</span>
          <button class="btn btn-outline btn-sm" ${d.page >= d.pages ? 'disabled' : ''} data-fp-page="${d.page + 1}">Sonraki</button>
        </div>`;
      body.querySelectorAll('[data-fp-session]').forEach(tr => { tr.style.cursor = 'pointer'; tr.addEventListener('click', () => this.openFootprintSession(tr.dataset.fpSession)); });
      body.querySelectorAll('[data-fp-page]').forEach(btn => btn.addEventListener('click', () => this.loadFootprintSessionsBody(Number(btn.dataset.fpPage))));
    } catch (err) {
      body.innerHTML = `<div class="glass-card"><p style="color: var(--danger);">Oturumlar alınamadı: ${this.fpE(err.message)}</p></div>`;
    }
  },

  // --- OTURUM DETAYI (YOLCULUK) ----------------------------------------------------------
  async openFootprintSession(id) {
    const box = document.getElementById('fp-panel-detail');
    if (!box) return;
    const back = this.footprintSection || 'sessions';
    this.showFootprintSection('detail');
    box.innerHTML = '<p class="health-loading">Yükleniyor…</p>';
    window.scrollTo({ top: 0, behavior: 'auto' });
    try {
      const d = await API.request(`/admin/footprint/sessions/${encodeURIComponent(id)}`);
      const s = d.session;
      const start = new Date(s.started_at).getTime();
      // page_leave adimlari (sekme gizlenince bir dilim) ilgili page_view
      // satirina "kalma / kaydirma" olarak toplanir.
      const dwell = new Map();
      let lastView = null;
      d.events.forEach(e => {
        if (e.kind === 'page_view') lastView = e;
        else if (e.kind === 'page_leave' && lastView && lastView.path === e.path) {
          const cur = dwell.get(lastView.id) || { ms: 0, scroll: 0 };
          cur.ms += Number(e.meta?.ms) || 0;
          cur.scroll = Math.max(cur.scroll, Number(e.meta?.scroll) || 0);
          dwell.set(lastView.id, cur);
        }
      });
      const events = d.events.filter(e => e.kind !== 'page_leave');
      const timeline = events.map(e => {
        const [icon, label] = FP_KINDS[e.kind] || ['•', e.kind];
        const off = Math.max(0, Math.round((e.occurred_ms - start) / 1000));
        let extra = '';
        if (e.kind === 'page_view' && dwell.has(e.id)) {
          const dw = dwell.get(e.id);
          extra = `<span class="fp-flag">${this.fpDur(dw.ms / 1000)} kaldı</span> <span class="fp-flag">%${dw.scroll} kaydırdı</span>`;
        }
        if (e.kind === 'service_search' && e.meta) extra = Number(e.meta.results) === 0 ? '<span class="fp-flag bad">sonuç yok</span>' : `<span class="fp-flag">${this.fpNum(e.meta.results)} sonuç</span>`;
        if (e.kind === 'api_error' && e.meta?.msg) extra = `<span class="fp-muted">${this.fpE(e.meta.msg)}</span>`;
        if ((e.kind === 'click' || e.kind === 'outbound_click') && e.meta) extra = `<span class="fp-muted">${this.fpE(e.meta.to || e.meta.url || '')}</span>`;
        if ((e.kind === 'register_success' || e.kind === 'login_success') && e.meta?.method === 'google') extra = '<span class="fp-flag"><i class="fa-brands fa-google"></i> Google ile</span>';
        const important = ['register_success', 'topup_success', 'order_created', 'course_purchase'].includes(e.kind);
        const bad = ['api_error', 'js_error', 'rage_click', 'not_found'].includes(e.kind);
        return `<li class="fp-step${important ? ' good' : ''}${bad ? ' bad' : ''}${e.kind === 'page_view' ? ' page' : ''}">
          <span class="fp-step-time">+${String(Math.floor(off / 60)).padStart(2, '0')}:${String(off % 60).padStart(2, '0')}</span>
          <span class="fp-step-icon" aria-hidden="true">${icon}</span>
          <span class="fp-step-body"><strong>${this.fpE(label)}</strong>
            ${e.kind === 'page_view' ? ` <code>${this.fpE(e.path)}</code>` : ''}
            ${e.label && e.kind !== 'page_view' ? ` — ${this.fpE(e.label)}` : ''}${e.kind === 'page_view' && e.label ? `<br><small class="fp-muted">${this.fpE(e.label)}</small>` : ''}
            ${e.value != null ? ` <strong>${this.fpTL(e.value)}</strong>` : ''}
            ${extra ? `<br>${extra}` : ''}
            ${e.kind !== 'page_view' && e.path ? `<br><small class="fp-muted">${this.fpE(e.path)}</small>` : ''}</span></li>`;
      }).join('');
      const utm = [['Kaynak', s.utm_source], ['Ortam', s.utm_medium], ['Kampanya', s.utm_campaign], ['Terim', s.utm_term], ['İçerik', s.utm_content]].filter(([, v]) => v);
      const fact = (k, v) => `<div class="fp-fact"><span>${k}</span><strong>${v}</strong></div>`;
      const acq = d.acquisition;
      box.innerHTML = `
        <div class="fp-detail-head">
          <button type="button" class="btn btn-outline btn-sm" data-fp-back><i class="fa-solid fa-arrow-left"></i> Geri</button>
          ${s.user_id ? `<button type="button" class="btn btn-outline btn-sm" data-fp-user="${Number(s.user_id)}"><i class="fa-solid fa-user"></i> ${this.fpE(s.username)} — tüm yolculuğu</button>` : ''}
        </div>
        <div class="fp-grid">
          ${this.fpCard('Ziyaret', `<div class="fp-facts">
            ${fact('Başlangıç', this.fpDate(s.started_at, true))}
            ${fact('Süre', this.fpDur(s.duration_sec))}
            ${fact('Sayfa / adım', `${this.fpNum(s.pageviews)} / ${this.fpNum(s.event_count)}`)}
            ${fact('Kim', s.username ? this.fpE(s.username) : 'Ziyaretçi')}
            ${fact('Ziyaretçi türü', s.consent ? (s.is_new ? 'Yeni (çerez onaylı)' : 'Geri dönen (çerez onaylı)') : 'Anonim (çerez onayı yok)')}
            ${fact('Sonuç', this.fpFlags(s))}
            ${s.order_kurus ? fact('Harcanan', this.fpTL(s.revenue)) : ''}
          </div>`)}
          ${this.fpCard('Nereden geldi', `<div class="fp-facts">
            ${fact('Kanal', this.fpChannel(s.channel))}
            ${fact('Kaynak', this.fpE(s.source || '—'))}
            ${fact('Geldiği adres', this.fpLink(s.referrer))}
            ${utm.map(([k, v]) => fact(`UTM ${k}`, this.fpE(v))).join('')}
            ${s.click_id ? fact('Reklam tıklaması', this.fpE(s.click_id.split(':')[0])) : ''}
            ${s.ref_code ? fact('Davet kodu', this.fpE(s.ref_code)) : ''}
            ${fact('Giriş sayfası', `<code>${this.fpE(s.entry_path || '/')}</code>`)}
            ${fact('Çıkış sayfası', `<code>${this.fpE(s.exit_path || '/')}</code>`)}
          </div>`)}
          ${this.fpCard('Cihaz ve konum', `<div class="fp-facts">
            ${fact('Cihaz', this.fpDevice(s))}
            ${fact('Ekran', this.fpE(s.screen || '—'))}
            ${fact('Dil / saat dilimi', this.fpE([s.lang, s.timezone].filter(Boolean).join(' · ') || '—'))}
            ${fact('Konum', this.fpPlace(s))}
            ${fact('IP özeti', `<code title="Ham IP saklanmaz">${this.fpE((s.ip_hash || '').slice(0, 10))}</code>`)}
          </div>`)}
          ${acq ? this.fpCard('Kullanıcının ilk geldiği yer', `<div class="fp-facts">
            ${fact('İlk ziyaret', this.fpDate(acq.first_seen_at))}
            ${fact('İlk kanal', this.fpChannel(acq.first_channel))}
            ${fact('İlk kaynak', this.fpE(acq.first_source || '—'))}
            ${fact('İlk adres', this.fpLink(acq.first_referrer))}
            ${fact('Kayıttan önceki ziyaret', this.fpNum(acq.sessions_before))}
          </div>`) : ''}
        </div>
        ${this.fpCard('Adım adım yolculuk', `<ol class="fp-timeline">${timeline || '<li class="fp-muted">Adım yok.</li>'}</ol>`, `${events.length} adım`)}
        ${d.others.length ? this.fpCard(s.user_id ? 'Bu kullanıcının diğer ziyaretleri' : 'Aynı ziyaretçinin diğer ziyaretleri', this.fpTable(['Tarih', 'Kanal', 'Giriş', 'Sayfa', 'Süre', 'Sonuç'], d.others.map(o => `<tr data-fp-session="${this.fpE(o.id)}"><td>${this.fpDate(o.started_at)}</td><td>${this.fpChannel(o.channel)}<br><small>${this.fpE(o.source || '')}</small></td><td class="fp-wrap">${this.fpE(o.entry_path || '/')}</td><td>${this.fpNum(o.pageviews)}</td><td>${this.fpDur(o.duration_sec)}</td><td>${this.fpFlags(o)}</td></tr>`))) : ''}`;
      box.querySelector('[data-fp-back]').addEventListener('click', () => this.showFootprintSection(back));
      box.querySelector('[data-fp-user]')?.addEventListener('click', ev => this.openFootprintUser(Number(ev.currentTarget.dataset.fpUser)));
      box.querySelectorAll('[data-fp-session]').forEach(tr => { tr.style.cursor = 'pointer'; tr.addEventListener('click', () => this.openFootprintSession(tr.dataset.fpSession)); });
    } catch (err) {
      box.innerHTML = `<div class="glass-card"><p style="color: var(--danger);">${this.fpE(err.message)}</p><button type="button" class="btn btn-outline btn-sm" data-fp-back>Geri</button></div>`;
      box.querySelector('[data-fp-back]').addEventListener('click', () => this.showFootprintSection(back));
    }
  },

  // --- KULLANICILAR (KAZANIM) ------------------------------------------------------------
  async loadFootprintUsers(page = 1) {
    const box = document.getElementById('fp-panel-users');
    if (!box) return;
    const f = this.fpUserFilters || {};
    box.innerHTML = `${this.fpToolbar()}
      <div class="glass-card fp-filters">
        <input type="search" class="form-control" data-fpu-key="q" placeholder="🔍 Kullanıcı adı, e-posta, kaynak, kampanya…" value="${this.fpE(f.q || '')}">
        <select class="form-control" data-fpu-key="channel"><option value="">İlk kanal: hepsi</option>${Object.entries(FP_CHANNELS).filter(([k]) => !['bilinmiyor', 'izlenmedi'].includes(k)).map(([k, v]) => `<option value="${k}"${f.channel === k ? ' selected' : ''}>${v.label}</option>`).join('')}</select>
        <select class="form-control" data-fpu-key="tracked"><option value="">Tüm üyeler</option><option value="1"${f.tracked === '1' ? ' selected' : ''}>Yalnızca kaynağı bilinenler</option></select>
        <select class="form-control" data-fpu-key="method"><option value="">Kayıt yöntemi: hepsi</option><option value="google"${f.method === 'google' ? ' selected' : ''}>Google ile giriş</option><option value="form"${f.method === 'form' ? ' selected' : ''}>Kayıt formu</option></select>
      </div>
      <div id="fp-users-body"><p class="health-loading">Yükleniyor…</p></div>`;
    this.fpBindToolbar(box, () => this.loadFootprintUsers());
    let t;
    box.querySelectorAll('[data-fpu-key]').forEach(el => {
      const update = () => {
        const next = { ...(this.fpUserFilters || {}) };
        if (el.value) next[el.dataset.fpuKey] = el.value; else delete next[el.dataset.fpuKey];
        this.fpUserFilters = next;
        this.loadFootprintUsersBody(1);
      };
      el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', () => { if (el.tagName === 'INPUT') { clearTimeout(t); t = setTimeout(update, 450); } else update(); });
    });
    this.loadFootprintUsersBody(page);
  },

  async loadFootprintUsersBody(page = 1) {
    const body = document.getElementById('fp-users-body');
    if (!body) return;
    const params = this.fpQuery();
    Object.entries(this.fpUserFilters || {}).forEach(([k, v]) => params.set(k, v));
    params.set('page', page);
    try {
      const d = await API.request(`/admin/footprint/users?${params}`);
      const label = document.getElementById('fp-window-label');
      if (label) label.textContent = `${d.window.label} · ${this.fpNum(d.total)} yeni üye`;
      const rows = d.users.map(u => `<tr data-fp-user="${Number(u.id)}">
          <td><strong>${this.fpE(u.username)}</strong>${this.fpSignup(u)}<br><small class="fp-muted">${this.fpDate(u.created_at)}</small></td>
          <td>${u.first_channel ? `${this.fpChannel(u.first_channel)}<br><small class="fp-wrap">${this.fpE(u.first_source || '')}${u.first_campaign ? ` · ${this.fpE(u.first_campaign)}` : ''}</small>` : this.fpChannel('izlenmedi')}</td>
          <td class="fp-wrap">${u.first_referrer ? this.fpLink(u.first_referrer) : '—'}</td>
          <td class="fp-wrap">${this.fpE(u.first_landing || '—')}</td>
          <td>${u.first_seen_at ? `${this.fpNum(u.sessions_before)} ziyaret` : '—'}</td>
          <td>${this.fpNum(u.sessions)}</td>
          <td>${this.fpTL(u.deposit)}</td>
          <td>${this.fpNum(u.orders)} · ${this.fpTL(u.spent)}</td>
          <td>${this.fpNum(u.courses)}</td>
          <td>${this.fpDate(u.last_seen_at)}</td></tr>`);
      const ch = d.by_channel.map(r => `<tr><td>${this.fpChannel(r.channel)}</td><td>${this.fpNum(r.users)}</td><td>${this.fpNum(r.payers)}</td><td>%${r.payer_rate}</td></tr>`);
      body.innerHTML = `
        ${this.fpCard('Hangi kanal üye ve müşteri getiriyor?', this.fpTable(['İlk kanal', 'Yeni üye', 'Ödeme yapan', 'Ödeme oranı'], ch), 'seçili dönemde kayıt olanlar')}
        ${this.fpCard('Nasıl kayıt oldular?', this.fpTable(['Kayıt yöntemi', 'Yeni üye', 'Ödeme yapan', 'Ödeme oranı'], (d.by_method || []).map(r => this.fpMethodRow(r))), 'Google düğmesi mi, kayıt formu mu')}
        ${this.fpCard('Üyeler ve geldikleri yer', `${this.fpTable(['Üye / kayıt', 'İlk kanal / kaynak', 'İlk geldiği adres', 'İlk sayfa', 'Kayıttan önce', 'Oturum', 'Yatırdığı', 'Sipariş · harcama', 'Eğitim', 'Son görülme'], rows, 'Bu dönemde kayıt olan üye yok.')}
          <div class="table-pagination fp-pager">
            <button class="btn btn-outline btn-sm" ${d.page <= 1 ? 'disabled' : ''} data-fp-page="${d.page - 1}">Önceki</button>
            <span>${d.page} / ${Math.max(1, d.pages)}</span>
            <button class="btn btn-outline btn-sm" ${d.page >= d.pages ? 'disabled' : ''} data-fp-page="${d.page + 1}">Sonraki</button>
          </div>`, 'satıra tıkla → üyenin tüm yolculuğu')}`;
      body.querySelectorAll('[data-fp-user]').forEach(tr => { tr.style.cursor = 'pointer'; tr.addEventListener('click', () => this.openFootprintUser(Number(tr.dataset.fpUser))); });
      body.querySelectorAll('[data-fp-page]').forEach(btn => btn.addEventListener('click', () => this.loadFootprintUsersBody(Number(btn.dataset.fpPage))));
    } catch (err) {
      body.innerHTML = `<div class="glass-card"><p style="color: var(--danger);">Üyeler alınamadı: ${this.fpE(err.message)}</p></div>`;
    }
  },

  async openFootprintUser(id) {
    const box = document.getElementById('fp-panel-detail');
    if (!box) return;
    const back = this.footprintSection || 'users';
    this.showFootprintSection('detail');
    box.innerHTML = '<p class="health-loading">Yükleniyor…</p>';
    window.scrollTo({ top: 0, behavior: 'auto' });
    try {
      const d = await API.request(`/admin/footprint/users/${Number(id)}`);
      const u = d.user;
      const a = d.acquisition;
      const fact = (k, v) => `<div class="fp-fact"><span>${k}</span><strong>${v}</strong></div>`;
      const touch = (title, p) => this.fpCard(title, `<div class="fp-facts">
          ${fact('Kanal', this.fpChannel(a[`${p}_channel`]))}
          ${fact('Kaynak', this.fpE(a[`${p}_source`] || '—'))}
          ${fact('Geldiği adres', this.fpLink(a[`${p}_referrer`]))}
          ${fact('Kampanya', this.fpE(a[`${p}_campaign`] || '—'))}
          ${fact('Giriş sayfası', `<code>${this.fpE(a[`${p}_landing`] || '/')}</code>`)}
          ${a[`${p}_session_id`] ? `<button type="button" class="btn btn-outline btn-sm" data-fp-session="${this.fpE(a[`${p}_session_id`])}">O ziyareti aç</button>` : ''}
        </div>`);
      box.innerHTML = `
        <div class="fp-detail-head">
          <button type="button" class="btn btn-outline btn-sm" data-fp-back><i class="fa-solid fa-arrow-left"></i> Geri</button>
          <button type="button" class="btn btn-outline btn-sm" data-fp-admin-user="${Number(u.id)}"><i class="fa-solid fa-id-card"></i> Kullanıcı detayına git</button>
        </div>
        <div class="stats-grid mb-20">
          <div class="glass-card stat-card"><div class="stat-icon cyan"><i class="fa-solid fa-user"></i></div><div><div class="stat-val" style="font-size:1.2rem;">${this.fpE(u.username)}</div><div class="stat-lbl">Kayıt: ${this.fpDate(u.created_at)}${this.fpSignupText(u)}</div></div></div>
          <div class="glass-card stat-card"><div class="stat-icon"><i class="fa-solid fa-route"></i></div><div><div class="stat-val">${this.fpNum(d.totals.sessions)}</div><div class="stat-lbl">Ziyaret</div><div class="course-kpi-sub">${this.fpNum(d.totals.pageviews)} sayfa · ${this.fpDur(d.totals.seconds)}</div></div></div>
          <div class="glass-card stat-card"><div class="stat-icon cyan"><i class="fa-solid fa-wallet"></i></div><div><div class="stat-val">${this.fpTL(d.money.deposit)}</div><div class="stat-lbl">Yatırdığı</div><div class="course-kpi-sub">bakiye: ${this.fpTL(u.balance)}</div></div></div>
          <div class="glass-card stat-card"><div class="stat-icon"><i class="fa-solid fa-cart-shopping"></i></div><div><div class="stat-val">${this.fpTL(d.money.spent)}</div><div class="stat-lbl">Harcadığı</div><div class="course-kpi-sub">${this.fpNum(d.money.orders)} sipariş · ${this.fpNum(d.money.courses)} eğitim</div></div></div>
        </div>
        ${a ? `<div class="fp-grid">${touch('İlk geldiği yer (ilk temas)', 'first')}${touch('Kayıt olduğu ziyaret', 'reg')}</div>
          <p class="course-admin-note">İlk ziyaret: ${this.fpDate(a.first_seen_at)} · kayıttan önce ${this.fpNum(a.sessions_before)} ziyaret${a.sessions_before > 1 ? ' (çerez onaylı tarayıcıda)' : ''}.</p>`
        : '<div class="glass-card mb-20"><p class="fp-muted">Bu üye ayak izi sistemi kurulmadan önce kayıt olmuş ya da kayıt anında izleme engelliydi; ilk geldiği yer bilinmiyor. Sonraki ziyaretleri aşağıda.</p></div>'}
        <div class="fp-grid">
          ${this.fpCard('Kullandığı kanallar', this.fpTable(['Kanal', 'Ziyaret'], d.channels.map(c => `<tr><td>${this.fpChannel(c.channel)}</td><td>${this.fpNum(c.n)}</td></tr>`)))}
          ${this.fpCard('En çok baktığı sayfalar', this.fpTable(['Sayfa', 'Görüntülenme'], d.top_pages.map(p => `<tr><td class="fp-wrap">${this.fpE(p.path)}</td><td>${this.fpNum(p.n)}</td></tr>`)))}
        </div>
        ${this.fpCard('Tüm ziyaretleri', this.fpTable(['Tarih', 'Kanal / kaynak', 'Giriş → çıkış', 'Gezinti', 'Cihaz / konum', 'Sonuç'], d.sessions.map(r => `<tr data-fp-session="${this.fpE(r.id)}">
            <td>${this.fpDate(r.started_at)}</td>
            <td>${this.fpChannel(r.channel)}<br><small>${this.fpE(r.source || '')}</small></td>
            <td class="fp-wrap">${this.fpE(r.entry_path || '/')}${r.exit_path && r.exit_path !== r.entry_path ? `<br><small class="fp-muted">→ ${this.fpE(r.exit_path)}</small>` : ''}</td>
            <td>${this.fpNum(r.pageviews)} sayfa · ${this.fpDur(r.duration_sec)}</td>
            <td>${this.fpDevice(r)}<br><small>${this.fpPlace(r)}</small></td>
            <td>${this.fpFlags(r)}</td></tr>`), 'Kayıtlı ziyaret yok.'), 'satıra tıkla → adım adım')}`;
      box.querySelector('[data-fp-back]').addEventListener('click', () => this.showFootprintSection(back));
      box.querySelector('[data-fp-admin-user]').addEventListener('click', () => { this.switchAdminTab('users'); this.openAdminUserDetail(Number(u.id)); });
      box.querySelectorAll('[data-fp-session]').forEach(el => { el.style.cursor = 'pointer'; el.addEventListener('click', () => this.openFootprintSession(el.dataset.fpSession)); });
    } catch (err) {
      box.innerHTML = `<div class="glass-card"><p style="color: var(--danger);">${this.fpE(err.message)}</p><button type="button" class="btn btn-outline btn-sm" data-fp-back>Geri</button></div>`;
      box.querySelector('[data-fp-back]').addEventListener('click', () => this.showFootprintSection(back));
    }
  }
});
