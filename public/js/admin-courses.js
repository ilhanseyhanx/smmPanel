// ADMIN > EGITIMLER ekrani. Bu dosya ziyaretcilere GONDERILMEZ: yalnizca
// yonetici "Egitimler" sekmesini actiginda app.js tarafindan yuklenir
// (bkz. SmmApp.openAdminCoursesTab).
//
// Alt sekmeler: Egitimler (liste) | Egitim Ekle/Duzenle (egitim + ders
// editoru) | Istatistikler (donem ozeti, gunluk grafik, ders bazli okuma) |
// Satislar & Odemeler (satislar, iade, bekleyen kart odemeleri).
/* global SmmApp, API, showToast, confirmDialog, promptDialog */
'use strict';

Object.assign(SmmApp.prototype, {
  courseTL(value) {
    const n = Number(value || 0);
    return `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
  },

  courseNum(value) {
    return Number(value || 0).toLocaleString('tr-TR');
  },

  courseDate(value, withTime = true) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return withTime
      ? d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
  },

  // Yalnizca panel/sekme gorunurlugu; veri yuklemez.
  setCoursePanel(section) {
    this.courseSection = section;
    document.querySelectorAll('#admin-tab-courses [data-course-panel]').forEach(el => {
      el.style.display = el.dataset.coursePanel === section ? '' : 'none';
    });
    document.querySelectorAll('#course-subtabs [data-course-section]').forEach(btn => {
      const active = btn.dataset.courseSection === section;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  },

  showCourseSection(section) {
    if (section === 'editor') { this.openCourseEditor(this.courseEditorId); return; }
    this.setCoursePanel(section);
    if (section === 'list') this.loadAdminCourseList();
    if (section === 'stats') this.loadCourseOverview();
    if (section === 'sales') this.loadCourseSales();
  },

  // ===========================================================================
  // LISTE
  // ===========================================================================
  async loadAdminCourseList() {
    const box = document.getElementById('course-panel-list');
    if (!box) return;
    if (!this.adminCoursesData) box.innerHTML = '<p class="health-loading">Yükleniyor…</p>';
    try {
      const data = await API.getAdminCourses();
      this.adminCoursesData = data.courses || [];
      this.renderAdminCourseList();
    } catch (err) {
      box.innerHTML = `<div class="glass-card"><p style="color: var(--danger);">Eğitimler yüklenemedi: ${this.escapeHtml(err.message)}</p></div>`;
    }
  },

  renderAdminCourseList() {
    const box = document.getElementById('course-panel-list');
    const courses = this.adminCoursesData || [];
    const published = courses.filter(c => c.status === 'published').length;
    const totals = courses.reduce((t, c) => ({
      sales: t.sales + Number(c.sales || 0),
      revenue: t.revenue + Number(c.revenue || 0),
      readers: t.readers + Number(c.readers || 0)
    }), { sales: 0, revenue: 0, readers: 0 });

    const kpi = (icon, cls, value, label) => `<div class="glass-card stat-card">
        <div class="stat-icon ${cls}"><i class="fa-solid ${icon}"></i></div>
        <div><div class="stat-val">${value}</div><div class="stat-lbl">${label}</div></div>
      </div>`;

    const rows = courses.map(c => {
      const url = `/egitimler/${encodeURIComponent(c.slug)}`;
      const cover = c.cover_image_url
        ? `<img src="${this.escapeHtml(c.cover_image_url)}" alt="" class="course-admin-thumb" loading="lazy">`
        : '<span class="course-admin-thumb is-empty" aria-hidden="true"><i class="fa-solid fa-graduation-cap"></i></span>';
      const free = Number(c.price) === 0 ? 'Tümü' : Math.min(Number(c.free_lesson_count || 0), Number(c.lesson_count || 0));
      return `<tr>
        <td>${cover}</td>
        <td><strong>${this.escapeHtml(c.title)}</strong>${c.title_en ? ` <span class="badge badge-processing" title="İngilizce sürüm var">EN ${Number(c.lessons_en || 0)}/${Number(c.lesson_count || 0)}</span>` : ''}<br><small style="color: var(--text-dim);">${this.escapeHtml(url)}</small></td>
        <td>${c.status === 'published' ? '<span class="badge badge-completed">Yayında</span>' : '<span class="badge badge-pending">Taslak</span>'}</td>
        <td>${Number(c.price) === 0 ? 'Ücretsiz' : `${this.courseTL(c.price)}<br><small style="color: var(--text-dim);">≈ ${Number(c.price_usd || 0).toFixed(2)}</small>`}</td>
        <td>${this.courseNum(c.lesson_count)} <small style="color: var(--text-dim);">(${free} ücretsiz)</small></td>
        <td>${this.courseNum(c.visitors)}</td>
        <td>${this.courseNum(c.readers)}</td>
        <td>${this.courseNum(c.sales)}</td>
        <td>${this.courseTL(c.revenue)}</td>
        <td><div class="course-admin-actions">
          <button type="button" class="btn btn-outline btn-sm" onclick="app.openCourseEditor(${Number(c.id)})" title="Düzenle"><i class="fa-solid fa-pen"></i></button>
          <button type="button" class="btn btn-outline btn-sm" onclick="app.openCourseStats(${Number(c.id)})" title="İstatistik"><i class="fa-solid fa-chart-line"></i></button>
          <button type="button" class="btn btn-outline btn-sm" onclick="app.grantCourse(${Number(c.id)})" title="Kullanıcıya hediye et"><i class="fa-solid fa-gift"></i></button>
          <a class="btn btn-outline btn-sm" href="${url}" target="_blank" rel="noopener" title="Sitede gör"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>
          <button type="button" class="btn btn-outline btn-sm" style="color: var(--danger);" onclick="app.deleteCourse(${Number(c.id)})" title="Sil"><i class="fa-solid fa-trash"></i></button>
        </div></td>
      </tr>`;
    }).join('');

    box.innerHTML = `
      <div class="stats-grid mb-20">
        ${kpi('fa-graduation-cap', '', `${published} / ${courses.length - published}`, 'Yayında / Taslak')}
        ${kpi('fa-cart-shopping', 'cyan', this.courseNum(totals.sales), 'Toplam Satış')}
        ${kpi('fa-coins', '', this.courseTL(totals.revenue), 'Toplam Ciro')}
        ${kpi('fa-book-open-reader', 'cyan', this.courseNum(totals.readers), 'Okuyucu (eğitim bazında)')}
      </div>
      ${courses.length ? `<div class="glass-card" style="padding: 0;">
        <div class="table-responsive"><table class="custom-table">
          <thead><tr><th></th><th>Eğitim</th><th>Durum</th><th>Fiyat</th><th>Ders</th><th>Ziyaretçi</th><th>Okuyucu</th><th>Satış</th><th>Ciro</th><th>İşlemler</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>` : `<div class="glass-card" style="text-align: center; padding: 40px 20px;">
        <i class="fa-solid fa-graduation-cap" style="font-size: 2rem; color: var(--primary); margin-bottom: 12px;"></i>
        <h3 style="margin-bottom: 8px;">Henüz eğitim yok</h3>
        <p style="color: var(--text-muted); margin-bottom: 16px;">İlk eğitimini oluştur, derslerini ekle ve yayınla.</p>
        <button type="button" class="btn btn-primary" onclick="app.openCourseEditor()"><i class="fa-solid fa-plus"></i> Yeni Eğitim</button>
      </div>`}
      <p class="course-admin-note"><i class="fa-solid fa-circle-info"></i> Ziyaretçi ve okuyucu sayıları tekil kişidir (giriş yapan kullanıcı ya da tarayıcı); yönetici ziyaretleri sayılmaz.</p>`;
  },

  async deleteCourse(id) {
    const course = (this.adminCoursesData || []).find(c => Number(c.id) === Number(id));
    if (!await confirmDialog(`"${course?.title || 'Eğitim'}" ve tüm dersleri kalıcı olarak silinecek.`, {
      title: 'Eğitimi sil', icon: 'fa-trash', danger: true, confirmText: 'Sil'
    })) return;
    try {
      const res = await API.deleteAdminCourse(id);
      showToast(res.message, 'success');
      if (Number(this.courseEditorId) === Number(id)) this.courseEditorId = null;
      this.loadAdminCourseList();
    } catch (err) { showToast(err.message, 'error'); }
  },

  async grantCourse(id) {
    const course = (this.adminCoursesData || []).find(c => Number(c.id) === Number(id));
    const username = await promptDialog(`"${course?.title || 'Eğitim'}" eğitimini ücretsiz tanımlamak istediğin kullanıcının adını veya e-postasını yaz.`, {
      title: 'Eğitimi hediye et', icon: 'fa-gift', confirmText: 'Tanımla', placeholder: 'kullanici_adi'
    });
    if (!username) return;
    try {
      const res = await API.grantAdminCourse(id, username);
      showToast(res.message, 'success');
    } catch (err) { showToast(err.message, 'error'); }
  },

  // ===========================================================================
  // EDITOR
  // ===========================================================================
  async openCourseEditor(id = null) {
    this.courseEditorId = id ? Number(id) : null;
    this.courseLessonEditing = null;
    const label = document.getElementById('course-subtab-editor-label');
    if (label) label.textContent = this.courseEditorId ? 'Eğitimi Düzenle' : 'Eğitim Ekle';
    const box = document.getElementById('course-panel-editor');
    if (box) box.innerHTML = '<p class="health-loading">Yükleniyor…</p>';
    this.setCoursePanel('editor');
    if (!this.courseEditorId) {
      this.renderCourseEditor({ status: 'draft', free_lesson_count: 2, price: '', sort_order: 0 }, []);
      return;
    }
    try {
      const data = await API.getAdminCourse(this.courseEditorId);
      this.renderCourseEditor(data.course, data.lessons || []);
    } catch (err) {
      if (box) box.innerHTML = `<div class="glass-card"><p style="color: var(--danger);">Eğitim yüklenemedi: ${this.escapeHtml(err.message)}</p></div>`;
    }
  },

  courseToolbarHtml(target) {
    const btn = (action, icon, title) => `<button type="button" class="course-tool" data-tool="${action}" data-target="${target}" title="${title}" aria-label="${title}">${icon}</button>`;
    return `<div class="course-toolbar" role="toolbar" aria-label="Biçimlendirme">
      ${btn('h2', '<b>H2</b>', 'Ara başlık')}
      ${btn('h3', '<b>H3</b>', 'Alt başlık')}
      ${btn('p', '¶', 'Paragraf')}
      ${btn('strong', '<i class="fa-solid fa-bold"></i>', 'Kalın')}
      ${btn('em', '<i class="fa-solid fa-italic"></i>', 'İtalik')}
      ${btn('ul', '<i class="fa-solid fa-list-ul"></i>', 'Madde listesi')}
      ${btn('ol', '<i class="fa-solid fa-list-ol"></i>', 'Numaralı liste')}
      ${btn('blockquote', '<i class="fa-solid fa-quote-left"></i>', 'Bilgi kutusu / alıntı')}
      ${btn('img', '<i class="fa-solid fa-image"></i>', 'Görsel')}
      ${btn('a', '<i class="fa-solid fa-link"></i>', 'Bağlantı')}
      ${btn('table', '<i class="fa-solid fa-table"></i>', 'Tablo')}
      ${btn('hr', '―', 'Ayraç')}
    </div>`;
  },

  // Secili metni etiketle sarar; secim yoksa ornek metin ekler.
  applyCourseTool(tool, textarea) {
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end);
    const wrap = (open, close, fallback) => `${open}${selected || fallback}${close}`;
    const snippets = {
      h2: () => `\n<h2>${selected || 'Ara başlık'}</h2>\n`,
      h3: () => `\n<h3>${selected || 'Alt başlık'}</h3>\n`,
      p: () => `\n<p>${selected || 'Paragraf metni'}</p>\n`,
      strong: () => wrap('<strong>', '</strong>', 'kalın metin'),
      em: () => wrap('<em>', '</em>', 'italik metin'),
      ul: () => `\n<ul>\n  <li>${selected || 'Madde'}</li>\n  <li>Madde</li>\n</ul>\n`,
      ol: () => `\n<ol>\n  <li>${selected || 'Adım'}</li>\n  <li>Adım</li>\n</ol>\n`,
      blockquote: () => `\n<blockquote>${selected || '💡 İpucu: önemli bir not'}</blockquote>\n`,
      img: () => '\n<figure>\n  <img src="https://" alt="Görselin kısa açıklaması">\n  <figcaption>Görsel açıklaması</figcaption>\n</figure>\n',
      a: () => `<a href="https://">${selected || 'bağlantı metni'}</a>`,
      table: () => '\n<table>\n  <thead><tr><th>Başlık</th><th>Başlık</th></tr></thead>\n  <tbody><tr><td>Değer</td><td>Değer</td></tr></tbody>\n</table>\n',
      hr: () => '\n<hr>\n'
    };
    const text = (snippets[tool] || (() => selected))();
    textarea.setRangeText(text, start, end, 'end');
    textarea.focus();
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  },

  bindCourseToolbars(root) {
    root.querySelectorAll('.course-tool').forEach(btn => {
      btn.addEventListener('click', () => this.applyCourseTool(btn.dataset.tool, document.getElementById(btn.dataset.target)));
    });
  },

  // Onizleme yalnizca yoneticinin kendi tarayicisinda calisir; yine de betik,
  // cerceve ve olay ozellikleri ayiklanir. Asil temizlik sunucuda yapilir.
  coursePreviewHtml(html) {
    const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
    doc.querySelectorAll('script, style, iframe, object, embed, form').forEach(el => el.remove());
    doc.querySelectorAll('*').forEach(el => {
      [...el.attributes].forEach(attr => {
        if (/^on/i.test(attr.name) || /^\s*javascript:/i.test(attr.value)) el.removeAttribute(attr.name);
      });
    });
    return doc.body.firstChild.innerHTML;
  },

  courseSlugify(text) {
    return String(text || '').toLocaleLowerCase('tr-TR')
      .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ö/g, 'o').replace(/ü/g, 'u')
      .normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 120);
  },

  renderCourseEditor(course, lessons) {
    const box = document.getElementById('course-panel-editor');
    if (!box) return;
    this.courseEditorCourse = course;
    this.courseEditorLessons = lessons;
    const e = v => this.escapeHtml(v ?? '');
    const levels = ['', 'Başlangıç', 'Orta', 'İleri', 'Her Seviye'];
    const isNew = !course.id;

    box.innerHTML = `
      <div class="course-editor-grid">
        <form class="glass-card course-editor-form" id="ce-form" novalidate>
          <div class="flex-between" style="gap: 10px; flex-wrap: wrap; margin-bottom: 14px;">
            <h3 style="margin: 0;">${isNew ? '➕ Yeni Eğitim' : '✏️ Eğitim Bilgileri'}</h3>
            ${isNew ? '' : `<a class="btn btn-outline btn-sm" href="/egitimler/${encodeURIComponent(course.slug)}" target="_blank" rel="noopener"><i class="fa-solid fa-eye"></i> Sitede Önizle</a>`}
          </div>
          <div class="course-form-grid">
            <div class="form-group span-2">
              <label class="form-label" for="ce-title">Eğitim başlığı *</label>
              <input type="text" id="ce-title" class="form-control" maxlength="160" required value="${e(course.title)}" placeholder="Instagram 0'dan 10K'ya: Adım Adım Büyüme Planı">
            </div>
            <div class="form-group span-2">
              <label class="form-label" for="ce-slug">Adres (slug)</label>
              <input type="text" id="ce-slug" class="form-control" maxlength="120" value="${e(course.slug)}" placeholder="boş bırakırsan başlıktan üretilir">
              <small class="course-hint">Adres: jetsmmpanel.com/egitimler/<b id="ce-slug-preview">${e(course.slug || '…')}</b></small>
            </div>
            <div class="form-group span-2">
              <label class="form-label" for="ce-subtitle">Kısa açıklama <small class="course-hint">(kartta ve başlığın altında görünür)</small></label>
              <textarea id="ce-subtitle" class="form-control" rows="2" maxlength="300">${e(course.subtitle)}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label" for="ce-price">Fiyat (₺)</label>
              <input type="number" id="ce-price" class="form-control" min="0" max="100000" step="0.01" value="${e(course.price)}" placeholder="149">
              <small class="course-hint">0 = tüm dersler ücretsiz</small>
            </div>
            <div class="form-group">
              <label class="form-label" for="ce-free">Ücretsiz ders sayısı</label>
              <input type="number" id="ce-free" class="form-control" min="0" max="50" step="1" value="${e(course.free_lesson_count ?? 2)}">
              <small class="course-hint">İlk kaç ders herkese açık olsun</small>
            </div>
            <div class="form-group">
              <label class="form-label" for="ce-level">Seviye</label>
              <select id="ce-level" class="form-control">${levels.map(l => `<option value="${e(l)}"${(course.level || '') === l ? ' selected' : ''}>${l || '— Seçilmedi —'}</option>`).join('')}</select>
            </div>
            <div class="form-group">
              <label class="form-label" for="ce-status">Durum</label>
              <select id="ce-status" class="form-control"${isNew ? ' disabled title="Önce ders ekle, sonra yayınla"' : ''}>
                <option value="draft"${course.status !== 'published' ? ' selected' : ''}>Taslak</option>
                <option value="published"${course.status === 'published' ? ' selected' : ''}>Yayında</option>
              </select>
            </div>
            <div class="form-group span-2">
              <label class="form-label" for="ce-cover">Kapak görseli adresi</label>
              <div style="display: flex; gap: 10px; align-items: center;">
                <input type="text" id="ce-cover" class="form-control" maxlength="500" value="${e(course.cover_image_url)}" placeholder="https://... (16:9 önerilir)">
                <img id="ce-cover-preview" alt="" class="course-admin-thumb" style="${course.cover_image_url ? '' : 'display: none;'}" src="${e(course.cover_image_url)}">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="ce-sort">Sıra</label>
              <input type="number" id="ce-sort" class="form-control" step="1" value="${e(course.sort_order ?? 0)}">
              <small class="course-hint">Küçük sayı listede önce görünür</small>
            </div>
            <div class="form-group span-2">
              <label class="form-label" for="ce-description">Eğitim tanıtımı <small class="course-hint">("Bu eğitimde neler var?" bölümü — güvenli HTML)</small></label>
              ${this.courseToolbarHtml('ce-description')}
              <textarea id="ce-description" class="form-control course-content-editor" rows="10">${e(course.description)}</textarea>
            </div>
            <div class="form-group span-2">
              <label class="form-label" for="ce-seo-title">SEO başlığı <small class="course-hint">(boşsa eğitim başlığı kullanılır)</small></label>
              <input type="text" id="ce-seo-title" class="form-control" maxlength="180" value="${e(course.seo_title)}">
            </div>
            <div class="form-group span-2">
              <label class="form-label" for="ce-seo-desc">SEO açıklaması <small class="course-hint">(Google'da görünen metin, 120-160 karakter ideal)</small></label>
              <textarea id="ce-seo-desc" class="form-control" rows="2" maxlength="300">${e(course.seo_description)}</textarea>
              <small class="course-hint" id="ce-seo-count"></small>
            </div>
            <details class="span-2 course-en-block"${course.title_en ? ' open' : ''}>
              <summary>🇬🇧 İngilizce sürüm <small class="course-hint">(boş alanlar Türkçe metne düşer; sayfa ?lang=en ile açılır)</small></summary>
              <div class="course-form-grid">
                <div class="form-group span-2"><label class="form-label" for="ce-title-en">Title</label><input type="text" id="ce-title-en" class="form-control" maxlength="160" value="${e(course.title_en)}"></div>
                <div class="form-group span-2"><label class="form-label" for="ce-subtitle-en">Subtitle</label><textarea id="ce-subtitle-en" class="form-control" rows="2" maxlength="300">${e(course.subtitle_en)}</textarea></div>
                <div class="form-group"><label class="form-label" for="ce-level-en">Level</label><input type="text" id="ce-level-en" class="form-control" maxlength="40" value="${e(course.level_en)}" placeholder="Beginner / Intermediate / Advanced"></div>
                <div class="form-group"><label class="form-label" for="ce-cover-en">Cover image URL</label><input type="text" id="ce-cover-en" class="form-control" maxlength="500" value="${e(course.cover_image_url_en)}"></div>
                <div class="form-group span-2"><label class="form-label" for="ce-description-en">Description (safe HTML)</label>${this.courseToolbarHtml('ce-description-en')}<textarea id="ce-description-en" class="form-control course-content-editor" rows="8">${e(course.description_en)}</textarea></div>
                <div class="form-group span-2"><label class="form-label" for="ce-seo-title-en">SEO title</label><input type="text" id="ce-seo-title-en" class="form-control" maxlength="180" value="${e(course.seo_title_en)}"></div>
                <div class="form-group span-2"><label class="form-label" for="ce-seo-desc-en">SEO description</label><textarea id="ce-seo-desc-en" class="form-control" rows="2" maxlength="300">${e(course.seo_description_en)}</textarea></div>
              </div>
            </details>
          </div>
          <div class="editor-actions">
            <button type="button" class="btn btn-outline" onclick="app.showCourseSection('list')"><i class="fa-solid fa-arrow-left"></i> Listeye Dön</button>
            <button type="submit" class="btn btn-primary" id="ce-save"><i class="fa-solid fa-floppy-disk"></i> ${isNew ? 'Eğitimi Oluştur' : 'Kaydet'}</button>
          </div>
        </form>

        <section class="glass-card course-lessons-admin" id="ce-lessons">
          ${isNew
            ? `<h3>📚 Dersler</h3><p class="course-hint" style="font-size: .9rem;">Önce eğitimi oluştur; ardından dersleri buraya ekleyebilirsin. Eğitim, en az bir dersi olunca yayınlanabilir.</p>`
            : this.courseLessonsAdminHtml(course, lessons)}
        </section>
      </div>
      <!-- Ders editoru iki sutunun altinda tam genislikte acilir (uzun metin yazilir). -->
      <div id="ce-lesson-editor"></div>`;

    const form = box.querySelector('#ce-form');
    const title = box.querySelector('#ce-title');
    const slug = box.querySelector('#ce-slug');
    const slugPreview = box.querySelector('#ce-slug-preview');
    const updateSlug = () => { slugPreview.textContent = slug.value.trim() || this.courseSlugify(title.value) || '…'; };
    title.addEventListener('input', updateSlug);
    slug.addEventListener('input', updateSlug);
    const cover = box.querySelector('#ce-cover');
    const coverPreview = box.querySelector('#ce-cover-preview');
    cover.addEventListener('input', () => {
      const url = cover.value.trim();
      coverPreview.style.display = /^(https?:\/\/|\/)/.test(url) ? '' : 'none';
      if (coverPreview.style.display === '') coverPreview.src = url;
    });
    const seo = box.querySelector('#ce-seo-desc');
    const seoCount = box.querySelector('#ce-seo-count');
    const updateSeo = () => {
      const n = seo.value.trim().length;
      seoCount.textContent = n ? `${n} karakter${n < 120 ? ' — biraz kısa' : n > 160 ? ' — Google kesebilir' : ' — ideal'}` : '';
    };
    seo.addEventListener('input', updateSeo);
    updateSeo();
    this.bindCourseToolbars(box);
    form.addEventListener('submit', event => { event.preventDefault(); this.saveCourse(); });
    if (!isNew) this.bindCourseLessonsAdmin();
  },

  async saveCourse() {
    const val = id => document.getElementById(id)?.value ?? '';
    const payload = {
      title: val('ce-title').trim(),
      slug: val('ce-slug').trim(),
      subtitle: val('ce-subtitle').trim(),
      price: val('ce-price').trim(),
      free_lesson_count: Number(val('ce-free') || 0),
      level: val('ce-level'),
      status: val('ce-status') || 'draft',
      cover_image_url: val('ce-cover').trim(),
      sort_order: Number(val('ce-sort') || 0),
      description: val('ce-description'),
      seo_title: val('ce-seo-title').trim(),
      seo_description: val('ce-seo-desc').trim(),
      title_en: val('ce-title-en').trim(),
      subtitle_en: val('ce-subtitle-en').trim(),
      level_en: val('ce-level-en').trim(),
      cover_image_url_en: val('ce-cover-en').trim(),
      description_en: val('ce-description-en'),
      seo_title_en: val('ce-seo-title-en').trim(),
      seo_description_en: val('ce-seo-desc-en').trim()
    };
    if (payload.title.length < 3) { showToast('Eğitim başlığı en az 3 karakter olmalı.', 'warning'); return; }
    // Bos fiyat sessizce 0 (tum dersler ucretsiz) sayilmasin; ucretsiz egitim bilincli olarak 0 yazilir.
    if (payload.price === '') { showToast('Fiyat gir (tüm dersleri ücretsiz yapmak için 0 yaz).', 'warning'); document.getElementById('ce-price')?.focus(); return; }
    const btn = document.getElementById('ce-save');
    if (btn) btn.disabled = true;
    try {
      if (this.courseEditorId) {
        const res = await API.updateAdminCourse(this.courseEditorId, payload);
        showToast(res.message, 'success');
        this.adminCoursesData = null;
        await this.openCourseEditor(this.courseEditorId);
      } else {
        const res = await API.addAdminCourse(payload);
        showToast(res.message, 'success');
        this.adminCoursesData = null;
        await this.openCourseEditor(res.id);
      }
    } catch (err) {
      showToast(err.message, 'error');
      if (btn) btn.disabled = false;
    }
  },

  courseLessonsAdminHtml(course, lessons) {
    const freeAll = Number(course.price) === 0;
    const rows = lessons.map((l, i) => `<li class="course-lesson-row" data-lesson-id="${Number(l.id)}">
        <span class="course-lesson-num">${i + 1}</span>
        <div class="course-lesson-info">
          <strong>${this.escapeHtml(l.title)}</strong>
          <small>${l.is_free ? '<span class="badge badge-completed">Ücretsiz</span>' : '<span class="badge badge-processing">Ücretli</span>'} · ${Number(l.reading_minutes) || 1} dk okuma · /${this.escapeHtml(l.slug)}</small>
        </div>
        <div class="course-admin-actions">
          <button type="button" class="btn btn-outline btn-sm" data-lesson-move="up" ${i === 0 ? 'disabled' : ''} title="Yukarı taşı" aria-label="Yukarı taşı"><i class="fa-solid fa-arrow-up"></i></button>
          <button type="button" class="btn btn-outline btn-sm" data-lesson-move="down" ${i === lessons.length - 1 ? 'disabled' : ''} title="Aşağı taşı" aria-label="Aşağı taşı"><i class="fa-solid fa-arrow-down"></i></button>
          <button type="button" class="btn btn-outline btn-sm" data-lesson-edit title="Düzenle" aria-label="Düzenle"><i class="fa-solid fa-pen"></i></button>
          <a class="btn btn-outline btn-sm" href="/egitimler/${encodeURIComponent(course.slug)}/${encodeURIComponent(l.slug)}" target="_blank" rel="noopener" title="Sitede gör" aria-label="Sitede gör"><i class="fa-solid fa-eye"></i></a>
          <button type="button" class="btn btn-outline btn-sm" style="color: var(--danger);" data-lesson-delete title="Sil" aria-label="Sil"><i class="fa-solid fa-trash"></i></button>
        </div>
      </li>`).join('');
    return `<div class="flex-between" style="gap: 10px; flex-wrap: wrap; margin-bottom: 10px;">
        <h3 style="margin: 0;">📚 Dersler (${lessons.length})</h3>
        <button type="button" class="btn btn-primary btn-sm" data-lesson-new><i class="fa-solid fa-plus"></i> Yeni Ders</button>
      </div>
      <p class="course-hint" style="margin-bottom: 12px;">${freeAll
        ? 'Fiyat 0 olduğu için tüm dersler herkese açık.'
        : `İlk <b>${Number(course.free_lesson_count || 0)}</b> ders herkese açık (Google'da da görünür), kalanlar satın alana açılır. Sırayı oklarla değiştirebilirsin.`}</p>
      ${lessons.length ? `<ol class="course-lesson-admin-list">${rows}</ol>` : '<p class="course-hint">Henüz ders yok. "Yeni Ders" ile ilk dersi ekle.</p>'}`;
  },

  bindCourseLessonsAdmin() {
    const root = document.getElementById('ce-lessons');
    if (!root) return;
    root.addEventListener('click', event => {
      const target = event.target.closest('button');
      if (!target) return;
      const row = target.closest('[data-lesson-id]');
      const lessonId = row ? Number(row.dataset.lessonId) : null;
      if (target.hasAttribute('data-lesson-new')) this.openLessonEditor(null);
      else if (target.hasAttribute('data-lesson-edit')) this.openLessonEditor(lessonId);
      else if (target.hasAttribute('data-lesson-delete')) this.deleteLesson(lessonId);
      else if (target.dataset.lessonMove) this.moveLesson(lessonId, target.dataset.lessonMove);
    });
  },

  openLessonEditor(lessonId) {
    const holder = document.getElementById('ce-lesson-editor');
    if (!holder) return;
    const lesson = lessonId ? (this.courseEditorLessons || []).find(l => Number(l.id) === Number(lessonId)) : {};
    if (lessonId && !lesson) return;
    this.courseLessonEditing = lessonId || null;
    const e = v => this.escapeHtml(v ?? '');
    holder.innerHTML = `<form class="course-lesson-editor" id="le-form" novalidate>
        <h4>${lessonId ? '✏️ Dersi Düzenle' : '➕ Yeni Ders'}</h4>
        <div class="course-form-grid">
          <div class="form-group span-2">
            <label class="form-label" for="le-title">Ders başlığı *</label>
            <input type="text" id="le-title" class="form-control" maxlength="160" required value="${e(lesson.title)}">
          </div>
          <div class="form-group span-2">
            <label class="form-label" for="le-slug">Ders adresi (slug)</label>
            <input type="text" id="le-slug" class="form-control" maxlength="120" value="${e(lesson.slug)}" placeholder="boş bırakırsan başlıktan üretilir">
          </div>
          <div class="form-group span-2">
            <label class="form-label" for="le-summary">Kısa özet <small class="course-hint">(kilitli derste satın almayanlara gösterilir, Google açıklaması olur)</small></label>
            <textarea id="le-summary" class="form-control" rows="2" maxlength="400">${e(lesson.summary)}</textarea>
          </div>
          <div class="form-group span-2">
            <div class="flex-between" style="gap: 8px; flex-wrap: wrap;">
              <label class="form-label" for="le-content" style="margin: 0;">Ders içeriği <small class="course-hint">(güvenli HTML — görsel için &lt;img src="https://..."&gt;)</small></label>
              <label class="course-hint" style="display: inline-flex; gap: 6px; align-items: center; cursor: pointer;"><input type="checkbox" id="le-preview-toggle"> Önizleme</label>
            </div>
            ${this.courseToolbarHtml('le-content')}
            <textarea id="le-content" class="form-control course-content-editor" rows="18">${e(lesson.content)}</textarea>
            <div class="crs-prose course-lesson-preview" id="le-preview" style="display: none;"></div>
            <small class="course-hint" id="le-words"></small>
          </div>
          <details class="span-2 course-en-block"${lesson.title_en ? ' open' : ''}>
            <summary>🇬🇧 İngilizce sürüm <small class="course-hint">(boşsa İngilizce sayfada Türkçe metin görünür)</small></summary>
            <div class="course-form-grid">
              <div class="form-group span-2"><label class="form-label" for="le-title-en">Title</label><input type="text" id="le-title-en" class="form-control" maxlength="160" value="${e(lesson.title_en)}"></div>
              <div class="form-group span-2"><label class="form-label" for="le-summary-en">Summary</label><textarea id="le-summary-en" class="form-control" rows="2" maxlength="400">${e(lesson.summary_en)}</textarea></div>
              <div class="form-group span-2"><label class="form-label" for="le-content-en">Content (safe HTML)</label>${this.courseToolbarHtml('le-content-en')}<textarea id="le-content-en" class="form-control course-content-editor" rows="18">${e(lesson.content_en)}</textarea></div>
            </div>
          </details>
        </div>
        <div class="editor-actions">
          <button type="button" class="btn btn-outline" id="le-cancel">Vazgeç</button>
          <button type="submit" class="btn btn-primary" id="le-save"><i class="fa-solid fa-floppy-disk"></i> Dersi Kaydet</button>
        </div>
      </form>`;
    const contentTr = holder.querySelector('#le-content');
    const contentEn = holder.querySelector('#le-content-en');
    let content = contentTr;
    const preview = holder.querySelector('#le-preview');
    const toggle = holder.querySelector('#le-preview-toggle');
    const words = holder.querySelector('#le-words');
    const refresh = () => {
      const count = content.value.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
      words.textContent = `${content === contentEn ? 'EN' : 'TR'}: ${count} kelime · yaklaşık ${Math.max(1, Math.ceil(count / 200))} dk okuma`;
      if (toggle.checked) preview.innerHTML = this.coursePreviewHtml(content.value);
    };
    // Onizleme ve kelime sayaci en son duzenlenen dilin metnini gosterir.
    [contentTr, contentEn].forEach(area => {
      area.addEventListener('input', () => { content = area; refresh(); });
      area.addEventListener('focus', () => { content = area; refresh(); });
    });
    toggle.addEventListener('change', () => { preview.style.display = toggle.checked ? '' : 'none'; refresh(); });
    refresh();
    this.bindCourseToolbars(holder);
    holder.querySelector('#le-cancel').addEventListener('click', () => { holder.innerHTML = ''; this.courseLessonEditing = null; });
    holder.querySelector('#le-form').addEventListener('submit', event => { event.preventDefault(); this.saveLesson(); });
    holder.scrollIntoView({ behavior: 'smooth', block: 'start' });
    holder.querySelector('#le-title').focus({ preventScroll: true });
  },

  async saveLesson() {
    const val = id => document.getElementById(id)?.value ?? '';
    const payload = {
      title: val('le-title').trim(), slug: val('le-slug').trim(), summary: val('le-summary').trim(), content: val('le-content'),
      title_en: val('le-title-en').trim(), summary_en: val('le-summary-en').trim(), content_en: val('le-content-en')
    };
    if (payload.title.length < 2) { showToast('Ders başlığı en az 2 karakter olmalı.', 'warning'); return; }
    const btn = document.getElementById('le-save');
    if (btn) btn.disabled = true;
    try {
      const res = this.courseLessonEditing
        ? await API.updateAdminCourseLesson(this.courseLessonEditing, payload)
        : await API.addAdminCourseLesson(this.courseEditorId, payload);
      showToast(res.message, 'success');
      this.adminCoursesData = null;
      await this.openCourseEditor(this.courseEditorId);
    } catch (err) {
      showToast(err.message, 'error');
      if (btn) btn.disabled = false;
    }
  },

  async deleteLesson(lessonId) {
    const lesson = (this.courseEditorLessons || []).find(l => Number(l.id) === Number(lessonId));
    if (!await confirmDialog(`"${lesson?.title || 'Ders'}" dersi ve okuma istatistikleri silinecek.`, {
      title: 'Dersi sil', icon: 'fa-trash', danger: true, confirmText: 'Sil'
    })) return;
    try {
      const res = await API.deleteAdminCourseLesson(lessonId);
      showToast(res.message, 'success');
      this.adminCoursesData = null;
      await this.openCourseEditor(this.courseEditorId);
    } catch (err) { showToast(err.message, 'error'); }
  },

  async moveLesson(lessonId, direction) {
    const ids = (this.courseEditorLessons || []).map(l => Number(l.id));
    const i = ids.indexOf(Number(lessonId));
    const j = direction === 'up' ? i - 1 : i + 1;
    if (i === -1 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    try {
      await API.reorderAdminCourseLessons(this.courseEditorId, ids);
      await this.openCourseEditor(this.courseEditorId);
    } catch (err) { showToast(err.message, 'error'); }
  },

  // ===========================================================================
  // ISTATISTIKLER
  // ===========================================================================
  openCourseStats(courseId) {
    this.courseStatsCourseId = Number(courseId);
    this.showCourseSection('stats');
  },

  async loadCourseOverview() {
    const box = document.getElementById('course-panel-stats');
    if (!box) return;
    const days = this.courseStatsDays || 30;
    box.innerHTML = '<p class="health-loading">Yükleniyor…</p>';
    try {
      const data = await API.getAdminCourseOverview(days);
      this.renderCourseOverview(data);
      const detailId = this.courseStatsCourseId || data.courses?.[0]?.id;
      if (detailId) this.loadCourseLessonStats(detailId);
    } catch (err) {
      box.innerHTML = `<div class="glass-card"><p style="color: var(--danger);">İstatistikler yüklenemedi: ${this.escapeHtml(err.message)}</p></div>`;
    }
  },

  // Tek serili gunluk cubuk grafik: tek eksen, tek renk; deger uzerine
  // gelince (veya odaklaninca) ipucu kutusunda gorunur. Ayni verinin tablo
  // karsiligi egitim bazli tabloda durur.
  courseBarChart(series, key, title, format = v => this.courseNum(v)) {
    const values = series.map(s => Number(s[key] || 0));
    const max = Math.max(...values, 0);
    const total = values.reduce((a, b) => a + b, 0);
    const bars = series.map((s, i) => {
      const h = max ? Math.max(values[i] ? 3 : 0, Math.round((values[i] / max) * 100)) : 0;
      const tip = `${this.courseDate(`${s.date}T12:00:00Z`, false)}: ${format(values[i])}`;
      return `<span class="crs-bar" data-tip="${this.escapeHtml(tip)}" aria-label="${this.escapeHtml(tip)}"><i style="height: ${h}%"></i></span>`;
    }).join('');
    const first = series[0]?.date;
    const last = series[series.length - 1]?.date;
    return `<figure class="glass-card crs-chart">
        <figcaption><span>${title}</span><strong>${format(total)}</strong></figcaption>
        <div class="crs-bars" role="img" aria-label="${this.escapeHtml(`${title}: toplam ${format(total)}, en yüksek gün ${format(max)}`)}">${bars}</div>
        <div class="crs-chart-axis"><span>${first ? this.courseDate(`${first}T12:00:00Z`, false) : ''}</span><span>en yüksek gün: ${format(max)}</span><span>${last ? this.courseDate(`${last}T12:00:00Z`, false) : ''}</span></div>
      </figure>`;
  },

  renderCourseOverview(data) {
    const box = document.getElementById('course-panel-stats');
    const k = data.kpi || {};
    const kpi = (icon, cls, value, label, sub = '') => `<div class="glass-card stat-card">
        <div class="stat-icon ${cls}"><i class="fa-solid ${icon}"></i></div>
        <div><div class="stat-val">${value}</div><div class="stat-lbl">${label}</div>${sub ? `<div class="course-kpi-sub">${sub}</div>` : ''}</div>
      </div>`;
    const courseOptions = (data.courses || []).map(c => `<option value="${Number(c.id)}"${Number(c.id) === Number(this.courseStatsCourseId) ? ' selected' : ''}>${this.escapeHtml(c.title)}</option>`).join('');
    const rows = (data.courses || []).map(c => `<tr>
        <td><button type="button" class="course-link-btn" onclick="app.loadCourseLessonStats(${Number(c.id)})">${this.escapeHtml(c.title)}</button>${c.status !== 'published' ? ' <span class="badge badge-pending">Taslak</span>' : ''}</td>
        <td>${this.courseNum(c.visitors)}</td>
        <td>${this.courseNum(c.readers)}</td>
        <td>${this.courseNum(c.minutes)} dk</td>
        <td>${c.avg_minutes} dk</td>
        <td>${this.courseNum(c.buy_open)}</td>
        <td>${this.courseNum(c.checkout_start)}</td>
        <td>${this.courseNum(c.sales)}</td>
        <td>${this.courseTL(c.revenue)}</td>
        <td>%${c.conversion_percent}</td>
      </tr>`).join('');

    box.innerHTML = `
      <div class="glass-card course-stats-toolbar">
        <label for="course-stats-days">Dönem</label>
        <select id="course-stats-days" class="form-control" style="max-width: 160px;" onchange="app.courseStatsDays = Number(this.value); app.loadCourseOverview();">
          ${[7, 30, 90, 365].map(d => `<option value="${d}"${d === data.days ? ' selected' : ''}>Son ${d} gün</option>`).join('')}
        </select>
        <button type="button" class="btn btn-outline btn-sm" onclick="app.loadCourseOverview()"><i class="fa-solid fa-rotate"></i> Yenile</button>
      </div>

      <div class="stats-grid mb-20">
        ${kpi('fa-cart-shopping', 'cyan', this.courseNum(k.sales), 'Satış', `${this.courseNum(k.via_balance)} bakiye · ${this.courseNum(k.via_shopier)} kart · ${this.courseNum(k.gifts)} hediye`)}
        ${kpi('fa-coins', '', this.courseTL(k.revenue), 'Ciro', `${this.courseNum(k.buyers)} farklı alıcı`)}
        ${kpi('fa-eye', 'cyan', this.courseNum(k.visitors), 'Tekil ziyaretçi', 'eğitim sayfalarını açan kişi')}
        ${kpi('fa-book-open-reader', '', this.courseNum(k.readers), 'Okuyucu', `${this.courseNum(k.member_readers)} üye · ${this.courseNum(k.readers - k.member_readers)} ziyaretçi`)}
        ${kpi('fa-clock', 'cyan', `${this.courseNum(k.reading_minutes)} dk`, 'Toplam okuma süresi', `okuyucu başına ort. ${k.avg_minutes_per_reader} dk`)}
        ${kpi('fa-flag-checkered', '', this.courseNum(k.completions), 'Sonuna kadar okunan ders')}
        ${kpi('fa-hand-pointer', 'cyan', this.courseNum(k.buy_open), '"Satın Al" tıklayan', `${this.courseNum(k.checkout_start)} kişi kart ödemesi başlattı`)}
        ${kpi('fa-percent', '', `%${k.conversion_percent}`, 'Dönüşüm', 'satış ÷ tekil ziyaretçi')}
      </div>

      <div class="crs-chart-grid mb-20">
        ${this.courseBarChart(data.series || [], 'visitors', 'Günlük tekil ziyaretçi')}
        ${this.courseBarChart(data.series || [], 'readers', 'Günlük okuyucu')}
        ${this.courseBarChart(data.series || [], 'sales', 'Günlük satış (adet)')}
      </div>

      <div class="glass-card mb-20" style="padding: 0;">
        <h3 class="course-table-title">Eğitim bazında huni <small>(seçili dönem)</small></h3>
        <div class="table-responsive"><table class="custom-table">
          <thead><tr><th>Eğitim</th><th>Ziyaretçi</th><th>Okuyucu</th><th>Okuma</th><th>Ort. okuma</th><th>Satın Al tıklama</th><th>Kart ödemesi</th><th>Satış</th><th>Ciro</th><th>Dönüşüm</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="10" class="text-center">Henüz eğitim yok.</td></tr>'}</tbody>
        </table></div>
      </div>

      <div class="glass-card course-stats-toolbar">
        <label for="course-stats-course">Ders detayı</label>
        <select id="course-stats-course" class="form-control" style="max-width: 360px;" onchange="app.loadCourseLessonStats(Number(this.value))">${courseOptions}</select>
      </div>
      <div id="course-lesson-stats"></div>`;
  },

  async loadCourseLessonStats(courseId) {
    if (!courseId) return;
    this.courseStatsCourseId = Number(courseId);
    const select = document.getElementById('course-stats-course');
    if (select) select.value = String(courseId);
    const box = document.getElementById('course-lesson-stats');
    if (!box) return;
    box.innerHTML = '<p class="health-loading">Yükleniyor…</p>';
    try {
      const data = await API.getAdminCourseStats(courseId);
      const f = data.funnel || {};
      const step = (label, value) => `<div class="course-funnel-step"><strong>${this.courseNum(value)}</strong><span>${label}</span></div>`;
      const lessonRows = (data.lessons || []).map(l => `<tr>
          <td>${l.position}</td>
          <td>${this.escapeHtml(l.title)}</td>
          <td>${l.is_free ? '<span class="badge badge-completed">Ücretsiz</span>' : '<span class="badge badge-processing">Ücretli</span>'}</td>
          <td><strong>${this.courseNum(l.readers)}</strong></td>
          <td>${this.courseNum(l.members)}</td>
          <td>${this.courseNum(l.guests)}</td>
          <td>${this.courseNum(l.minutes)} dk</td>
          <td>${l.avg_minutes} dk <small style="color: var(--text-dim);">/ ${l.reading_minutes} dk</small></td>
          <td>${this.courseNum(l.completions)}</td>
          <td>%${l.completion_percent}</td>
        </tr>`).join('');
      const memberRows = (data.top_members || []).map(m => `<tr>
          <td><button type="button" class="course-link-btn" onclick="app.switchAdminTab('users'); app.openAdminUserDetail(${Number(m.user_id)})">${this.escapeHtml(m.username)}</button></td>
          <td>${this.courseNum(m.lessons)}</td>
          <td>${this.courseNum(m.minutes)} dk</td>
          <td>${this.courseNum(m.completed)}</td>
          <td>${m.owned ? '<span class="badge badge-completed">Satın aldı</span>' : '<span class="badge badge-pending">Almadı</span>'}</td>
          <td>${this.courseDate(m.last_seen_at)}</td>
        </tr>`).join('');
      box.innerHTML = `
        <div class="glass-card mb-20">
          <h3 style="margin-bottom: 12px;">${this.escapeHtml(data.course.title)} — tüm zamanlar</h3>
          <div class="course-funnel">
            ${step('Tekil ziyaretçi', f.visitors)}
            ${step('Ücretsiz dersleri okuyan', f.free_readers)}
            ${step('"Satın Al" tıklayan', f.buy_open)}
            ${step('Kart ödemesi başlatan', f.checkout_start)}
            ${step(`Satış · ${this.courseTL(f.revenue)}`, f.sales)}
          </div>
        </div>
        <div class="glass-card mb-20" style="padding: 0;">
          <h3 class="course-table-title">Ders bazında okuma</h3>
          <div class="table-responsive"><table class="custom-table">
            <thead><tr><th>#</th><th>Ders</th><th>Tür</th><th>Okuyucu</th><th>Üye</th><th>Ziyaretçi</th><th>Toplam okuma</th><th>Ort. / beklenen</th><th>Sonuna kadar</th><th>Tamamlama</th></tr></thead>
            <tbody>${lessonRows || '<tr><td colspan="10" class="text-center">Bu eğitimin dersi yok.</td></tr>'}</tbody>
          </table></div>
        </div>
        <div class="glass-card" style="padding: 0;">
          <h3 class="course-table-title">En çok okuyan üyeler</h3>
          <div class="table-responsive"><table class="custom-table">
            <thead><tr><th>Kullanıcı</th><th>Okunan ders</th><th>Okuma</th><th>Bitirilen</th><th>Durum</th><th>Son okuma</th></tr></thead>
            <tbody>${memberRows || '<tr><td colspan="6" class="text-center">Henüz giriş yapmış okuyucu yok.</td></tr>'}</tbody>
          </table></div>
        </div>`;
    } catch (err) {
      box.innerHTML = `<div class="glass-card"><p style="color: var(--danger);">Ders istatistiği yüklenemedi: ${this.escapeHtml(err.message)}</p></div>`;
    }
  },

  // ===========================================================================
  // SATISLAR & ODEMELER
  // ===========================================================================
  async loadCourseSales() {
    const box = document.getElementById('course-panel-sales');
    if (!box) return;
    box.innerHTML = '<p class="health-loading">Yükleniyor…</p>';
    try {
      if (!this.adminCoursesData) this.adminCoursesData = (await API.getAdminCourses()).courses || [];
      const data = await API.getAdminCourseSales(this.courseSalesFilter || null);
      const sourceBadge = s => ({
        balance: '<span class="badge badge-completed">Bakiye</span>',
        shopier: '<span class="badge badge-processing">Kart + bakiye</span>',
        gift: '<span class="badge badge-pending">Hediye</span>'
      }[s] || this.escapeHtml(s));
      const statusBadge = s => ({
        completed: '<span class="badge badge-completed">Tamamlandı</span>',
        pending: '<span class="badge badge-pending">Bekliyor</span>',
        failed: '<span class="badge badge-canceled">Tamamlanmadı</span>'
      }[s] || this.escapeHtml(s));
      const total = data.purchases.reduce((sum, p) => sum + Number(p.price || 0), 0);
      const purchaseRows = data.purchases.map(p => `<tr>
          <td>${this.courseDate(p.created_at)}</td>
          <td>${p.username ? `<button type="button" class="course-link-btn" onclick="app.switchAdminTab('users'); app.openAdminUserDetail(${Number(p.user_id)})">${this.escapeHtml(p.username)}</button>` : '—'}</td>
          <td>${this.escapeHtml(p.course_title || '—')}</td>
          <td>${this.courseTL(p.price)}</td>
          <td>${sourceBadge(p.source)}</td>
          <td>${p.consent_at ? '<i class="fa-solid fa-check" title="Dijital içerik onayı verildi" style="color: var(--success);"></i>' : '—'}</td>
          <td><button type="button" class="btn btn-outline btn-sm" onclick="app.refundCoursePurchase(${Number(p.id)})" title="İade et / erişimi kaldır"><i class="fa-solid fa-rotate-left"></i> ${p.source === 'gift' ? 'Kaldır' : 'İade'}</button></td>
        </tr>`).join('');
      const intentRows = data.intents.map(i => `<tr>
          <td>${this.courseDate(i.created_at)}</td>
          <td>${this.escapeHtml(i.username || '—')}</td>
          <td>${this.escapeHtml(i.course_title || '—')}</td>
          <td>${this.courseTL(i.amount)}</td>
          <td>${statusBadge(i.status)}</td>
          <td><small style="color: var(--text-dim);">${this.escapeHtml(i.failure_reason || i.merchant_oid)}</small></td>
        </tr>`).join('');
      box.innerHTML = `
        <div class="glass-card course-stats-toolbar">
          <label for="course-sales-filter">Eğitim</label>
          <select id="course-sales-filter" class="form-control" style="max-width: 360px;" onchange="app.courseSalesFilter = Number(this.value) || null; app.loadCourseSales();">
            <option value="">Tüm eğitimler</option>
            ${this.adminCoursesData.map(c => `<option value="${Number(c.id)}"${Number(c.id) === Number(this.courseSalesFilter) ? ' selected' : ''}>${this.escapeHtml(c.title)}</option>`).join('')}
          </select>
          <span class="course-hint">${this.courseNum(data.purchases.length)} satış · ${this.courseTL(total)}</span>
        </div>
        <div class="glass-card mb-20" style="padding: 0;">
          <h3 class="course-table-title">Satışlar</h3>
          <div class="table-responsive"><table class="custom-table">
            <thead><tr><th>Tarih</th><th>Kullanıcı</th><th>Eğitim</th><th>Tutar</th><th>Ödeme</th><th>Onay</th><th>İşlem</th></tr></thead>
            <tbody>${purchaseRows || '<tr><td colspan="7" class="text-center">Henüz satış yok.</td></tr>'}</tbody>
          </table></div>
        </div>
        <div class="glass-card" style="padding: 0;">
          <h3 class="course-table-title">Kart ödemeleri (Shopier, eksik tutar) <small>son 100</small></h3>
          <div class="table-responsive"><table class="custom-table">
            <thead><tr><th>Tarih</th><th>Kullanıcı</th><th>Eğitim</th><th>Kart tutarı</th><th>Durum</th><th>Not / referans</th></tr></thead>
            <tbody>${intentRows || '<tr><td colspan="6" class="text-center">Henüz kartla eğitim ödemesi yok.</td></tr>'}</tbody>
          </table></div>
        </div>
        <p class="course-admin-note"><i class="fa-solid fa-circle-info"></i> Kart ödemesi tamamlanınca tutar önce kullanıcının bakiyesine yazılır, eğitim aynı anda bakiyeden alınır. Bu yüzden ödeme ayrıca "Para Yatırma" listesinde de görünür.</p>`;
    } catch (err) {
      box.innerHTML = `<div class="glass-card"><p style="color: var(--danger);">Satışlar yüklenemedi: ${this.escapeHtml(err.message)}</p></div>`;
    }
  },

  async refundCoursePurchase(id) {
    if (!await confirmDialog('Kullanıcının bu eğitime erişimi kaldırılacak; ödediği tutar (hediye değilse) bakiyesine iade edilecek.', {
      title: 'Satışı geri al', icon: 'fa-rotate-left', danger: true, confirmText: 'Geri Al'
    })) return;
    try {
      const res = await API.refundAdminCoursePurchase(id);
      showToast(res.message, 'success');
      this.adminCoursesData = null;
      this.loadCourseSales();
    } catch (err) { showToast(err.message, 'error'); }
  }
});
