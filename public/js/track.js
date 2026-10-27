// ZIYARETCI AYAK IZI — tarayici tarafi (bkz. services/footprint.js)
//
// Her sayfada yuklenir; adimlari biriktirip 4 sn'de bir /api/track'e yollar,
// sayfa kapanirken sendBeacon ile son paketi gonderir.
//
// CEREZ ONAYI: "Kabul et" (localStorage cerezOnayi = accepted) verildiyse
// tarayicida kalici ziyaretci kimligi (jt_vid) tutulur ve oturum sekmeler arasi
// paylasilir. Onay yoksa YALNIZCA sekmeye ozel oturum kimligi (sessionStorage)
// vardir; tarayici kapaninca kaybolur, tekrar gelis ayni kisiye baglanmaz.
//
// TOPLANMAYAN: form alanlarina yazilan degerler, sifreler, bakiye/kart bilgisi.
// Yonetici ve /admin sayfalari izlenmez; otomasyon tarayicilari hic gondermez.
(function () {
  'use strict';
  if (window.JT) return;
  var ENDPOINT = '/api/track';
  var GAP_MS = 30 * 60 * 1000;
  var FLUSH_MS = 4000;
  var disabled = !!navigator.webdriver || /^\/admin/.test(location.pathname);
  var queue = [];
  var interacted = false;
  var ctxPending = null;
  var page = null; // { path, start, visibleMs, visibleSince, scroll }
  var errorCount = 0;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* yoksay */ } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* yoksay */ } }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* yoksay */ } }
  function consent() { return lsGet('cerezOnayi') === 'accepted'; }
  function store() { return consent() ? { get: lsGet, set: lsSet } : { get: ssGet, set: ssSet }; }
  function uid() {
    try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* eski tarayici */ }
    var s = '';
    for (var i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
    return s.slice(0, 8) + '-' + s.slice(8, 12) + '-' + s.slice(12, 16) + '-' + s.slice(16, 20) + '-' + s.slice(20);
  }
  function vid() {
    if (!consent()) return null;
    var v = lsGet('jt_vid');
    if (!v || !/^[a-z0-9-]{16,40}$/i.test(v)) { v = uid(); lsSet('jt_vid', v); }
    return v;
  }
  function path() {
    var lang = /[?&]lang=en\b/.test(location.search) ? '?lang=en' : '';
    return (location.pathname || '/').slice(0, 190) + lang;
  }

  // Oturum: 30 dk hareketsizlikten (adim gonderilmeyen sure) sonra yenisi
  // baslar. Yeni oturumun ilk paketi giris baglamini (kaynak, UTM, cihaz)
  // tasir. Referans yalnizca sayfanin ILK yuklenisinde gecerlidir: ayni sekmede
  // zaman asimindan sonra acilan oturum "dogrudan" sayilir.
  var pageLoadReferrer = document.referrer;
  function session(touch) {
    var st = store();
    var sid = st.get('jt_sid');
    var last = Number(st.get('jt_last')) || 0;
    var now = Date.now();
    if (!sid || !/^[a-z0-9-]{16,40}$/i.test(sid) || now - last > GAP_MS) {
      sid = uid();
      st.set('jt_sid', sid);
      ctxPending = context(pageLoadReferrer);
      touch = true;
    }
    pageLoadReferrer = '';
    if (touch) st.set('jt_last', String(now));
    return sid;
  }

  function context(referrer) {
    var q = new URLSearchParams(location.search);
    var click = q.get('gclid') ? ['google', q.get('gclid')]
      : q.get('fbclid') ? ['meta', q.get('fbclid')]
        : q.get('ttclid') ? ['tiktok', q.get('ttclid')]
          : q.get('msclkid') ? ['microsoft', q.get('msclkid')] : null;
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* yoksay */ }
    return {
      path: path(),
      referrer: referrer || '',
      utm: {
        source: q.get('utm_source'), medium: q.get('utm_medium'), campaign: q.get('utm_campaign'),
        term: q.get('utm_term'), content: q.get('utm_content')
      },
      click_type: click ? click[0] : null,
      click_id: click ? click[1] : null,
      ref: q.get('ref'),
      lang: lsGet('smm_language') === 'en' || /[?&]lang=en\b/.test(location.search) ? 'en' : 'tr',
      screen: (screen.width || 0) + 'x' + (screen.height || 0),
      tz: tz
    };
  }

  function event(kind, props) {
    if (disabled || !kind) return;
    props = props || {};
    if (queue.length >= 120) return;
    queue.push({
      kind: kind,
      path: props.path || path(),
      label: props.label == null ? null : String(props.label).slice(0, 160),
      value_kurus: props.value_kurus == null ? null : props.value_kurus,
      meta: props.meta || null,
      ts: Date.now()
    });
  }

  function payload() {
    var sid = session(true);
    var body = {
      sid: sid, vid: vid(), consent: consent(), hi: interacted, wd: !!navigator.webdriver,
      events: queue.splice(0, 40), sent_at: Date.now()
    };
    if (ctxPending) { body.ctx = ctxPending; ctxPending = null; }
    return body;
  }

  // Ayni anda tek paket: oturumun ilk paketi (giris baglamini tasiyan) sunucuda
  // islenirken ikinci paket gelirse oturum baglamsiz acilabiliyordu. Baglam
  // tasiyan paket basarisiz olursa baglam bir sonraki pakete aktarilir.
  var inflight = false;
  function flush(beacon) {
    if (disabled || (!queue.length && !ctxPending)) return;
    if (inflight && !beacon) return;
    var p = payload();
    var body = JSON.stringify(p);
    if (beacon && navigator.sendBeacon) {
      try { if (navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))) return; } catch (e) { /* fetch'e dus */ }
    }
    var restore = function () { if (p.ctx && !ctxPending) ctxPending = p.ctx; };
    inflight = true;
    try {
      fetch(ENDPOINT, { method: 'POST', body: body, keepalive: true, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } })
        .then(function (r) { if (!r.ok) restore(); }, restore)
        .then(function () { inflight = false; });
    } catch (e) { inflight = false; restore(); }
  }

  // --- SAYFA: goruntuleme, gorunur kalma suresi, kaydirma derinligi ---------
  function scrollPct() {
    var h = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
    var seen = (window.scrollY || 0) + window.innerHeight;
    return h > 0 ? Math.min(100, Math.round((seen / h) * 100)) : 0;
  }
  function leavePage() {
    if (!page) return;
    var ms = page.visibleMs + (page.visibleSince ? Date.now() - page.visibleSince : 0);
    event('page_leave', { path: page.path, meta: { ms: ms, scroll: page.scroll } });
    page = null;
  }
  function viewPage() {
    var p = path();
    if (page && page.path === p) return;
    leavePage();
    page = { path: p, visibleMs: 0, visibleSince: document.visibilityState === 'visible' ? Date.now() : null, scroll: scrollPct() };
    // Baslik SPA'da gezinmeden hemen sonra guncellenir; kisa gecikmeyle okunur.
    setTimeout(function () { event('page_view', { path: p, label: document.title }); }, 60);
  }
  ['pushState', 'replaceState'].forEach(function (name) {
    var orig = history[name];
    history[name] = function () {
      var r = orig.apply(this, arguments);
      try { if (/^\/admin/.test(location.pathname)) { disabled = true; queue = []; } else viewPage(); } catch (e) { /* yoksay */ }
      return r;
    };
  });
  window.addEventListener('popstate', function () { viewPage(); });
  window.addEventListener('scroll', function () {
    if (page) { var s = scrollPct(); if (s > page.scroll) page.scroll = s; }
  }, { passive: true });
  // Sekme gizlenince (baska sekme ya da sayfadan cikis) kalma suresi HEMEN
  // gonderilir: Chrome cikista once bu olayi, sonra pagehide'i tetikler ve
  // ikinci beacon cogu zaman yolda kalir. Sekmeye donulurse ayni sayfa yeni
  // bir dilimle devam eder (page_view yazilmaz); panel dilimleri toplar.
  var pausedPath = null;
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      if (page) { pausedPath = page.path; leavePage(); }
      flush(true);
    } else {
      session(false); // uzun aradan donuldu: gerekirse yeni oturum
      if (!page && pausedPath && pausedPath === path()) {
        page = { path: pausedPath, visibleMs: 0, visibleSince: Date.now(), scroll: scrollPct() };
      }
      pausedPath = null;
    }
  });
  window.addEventListener('pagehide', function () { leavePage(); flush(true); });

  // --- ETKILESIM, TIKLAMA, SINIRLI TIKLAMA -----------------------------------
  ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(function (t) {
    window.addEventListener(t, function () { interacted = true; }, { passive: true, once: true });
  });
  window.addEventListener('scroll', function () { interacted = true; }, { passive: true, once: true });

  var recent = [];
  document.addEventListener('click', function (e) {
    if (disabled) return;
    var el = e.target && e.target.closest ? e.target.closest('a, button, [role="button"], [data-track], label.crs-consent, select') : null;
    if (!el || el.closest('#view-admin')) return;
    if (el.tagName === 'SELECT') return;
    var label = (el.getAttribute('data-track') || el.getAttribute('aria-label') || el.textContent || el.title || '').replace(/\s+/g, ' ').trim().slice(0, 70);
    var href = el.tagName === 'A' ? el.getAttribute('href') || '' : '';
    var meta = null;
    var kind = 'click';
    if (href && /^https?:/i.test(href)) {
      try {
        var u = new URL(href);
        if (u.hostname !== location.hostname) { kind = 'outbound_click'; meta = { url: (u.hostname + u.pathname).slice(0, 150) }; label = label || u.hostname; }
        else meta = { to: u.pathname.slice(0, 150) };
      } catch (err) { /* yoksay */ }
    } else if (href && href.charAt(0) === '/') meta = { to: href.split('?')[0].slice(0, 150) };
    // Satir/kart baglami: "Sipariş Ver" tek basina hangi hizmet oldugunu
    // soylemez; satirdaki data-track-ctx (or. "#123 Instagram Takipçi")
    // etikete eklenir, hizmet/urun kimligi meta'ya yazilir.
    var ctxEl = el.closest('[data-track-ctx]');
    if (ctxEl) {
      var ctx = (ctxEl.getAttribute('data-track-ctx') || '').replace(/\s+/g, ' ').trim().slice(0, 90);
      if (ctx && label.indexOf(ctx) === -1) label = label ? label + ' · ' + ctx : ctx;
      meta = meta || {};
      var sid = Number(ctxEl.getAttribute('data-track-sid'));
      var pid = Number(ctxEl.getAttribute('data-track-pid'));
      if (sid > 0) meta.sid = sid;
      if (pid > 0) meta.pid = pid;
    }
    if (!label && !meta) return;
    event(kind, { label: label || (meta && (meta.to || meta.url)), meta: meta });
    // Ayni yere 0,8 sn icinde 3+ tiklama: sinirli tiklama (bir sey calismiyor).
    var now = Date.now();
    recent = recent.filter(function (c) { return now - c.t < 800; });
    recent.push({ t: now, x: e.clientX, y: e.clientY });
    var near = recent.filter(function (c) { return Math.abs(c.x - e.clientX) < 30 && Math.abs(c.y - e.clientY) < 30; });
    if (near.length === 3) event('rage_click', { label: label || 'tıklama' });
  }, true);

  // --- SECIMLER ---------------------------------------------------------------
  // Acilir liste secimleri (yeni sipariste kategori/hizmet, hizmet listesinde
  // ulke ve alt kategori filtresi...). Tiklama dinleyicisi SELECT'i atliyor;
  // secilen deger ancak change olayinda belli olur. Dil secimi lang_change
  // olarak zaten yaziliyor.
  document.addEventListener('change', function (e) {
    if (disabled) return;
    var el = e.target;
    if (!el || el.tagName !== 'SELECT' || el.id === 'language-selector' || (el.closest && el.closest('#view-admin'))) return;
    var opt = el.options && el.options[el.selectedIndex];
    if (!opt) return;
    var labelEl = el.id ? document.querySelector('label[for="' + el.id + '"]') : null;
    var field = (el.getAttribute('aria-label') || (labelEl && labelEl.textContent) || el.name || el.id || 'Seçim').replace(/\s+/g, ' ').trim().slice(0, 40);
    var text = (opt.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100);
    var meta = { field: el.id || null };
    if (el.id === 'order-service-select' && /^\d+$/.test(el.value)) meta.sid = Number(el.value);
    event('select_change', { label: field + ': ' + text, meta: meta });
  }, true);

  // --- HATALAR ----------------------------------------------------------------
  window.addEventListener('error', function (e) {
    if (errorCount++ > 5 || !e || !e.message) return;
    event('js_error', { label: String(e.message).slice(0, 140), meta: { src: String(e.filename || '').split('/').pop().slice(0, 60), line: e.lineno || null } });
  });
  window.addEventListener('unhandledrejection', function (e) {
    if (errorCount++ > 5) return;
    var msg = e && e.reason && (e.reason.message || String(e.reason));
    if (msg && !/API Error|Failed to fetch|NetworkError|Load failed/i.test(msg)) event('js_error', { label: String(msg).slice(0, 140) });
  });

  window.JT = {
    event: event,
    flush: flush,
    sid: function () { return disabled ? null : session(false); },
    disable: function () { disabled = true; queue = []; },
    // Cerez tercihi degisince: onayla kalici kimlik olusur ve sekme oturumu
    // kalici depoya tasinir; retle kalici kimlik silinir.
    consentChanged: function (value) {
      if (value === 'accepted') {
        var sid = ssGet('jt_sid');
        if (sid) { lsSet('jt_sid', sid); lsSet('jt_last', String(Date.now())); }
        vid();
      } else {
        lsDel('jt_vid'); lsDel('jt_sid'); lsDel('jt_last');
      }
      event('consent', { label: value });
      flush();
    }
  };

  if (!disabled) {
    session(true);
    viewPage();
    setInterval(function () { flush(false); }, FLUSH_MS);
  }
})();
