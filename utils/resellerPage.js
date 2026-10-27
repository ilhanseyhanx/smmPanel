'use strict';

// /bayilik: "Jet Bayi Paneli" tanitim sayfasi (sunucuda basilir; botlar JS
// beklemeden gorur). Giris yapmis kullanicinin basvuru formu / panel durumu
// #bayilik-account kutusuna, kazanc hesaplayicisi #bp-calc'a
// public/js/reseller.js ile cizilir/baglanir.
// Sayfa, site_settings.reseller_public_page kapaliyken 404'tur (server.js).
// Gorseller public/img/bayilik/ altinda: demo sitelerin (tenant/demo.js)
// gercek ekran goruntuleri. Yeniden cekilirse IMG_VERSION artirilir.

const { demoSites } = require('../tenant/demo');

const IMG_VERSION = '1';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function tl(value, digits = 0) {
  return `₺${Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function img(name) {
  return `/img/bayilik/${name}.webp?v=${IMG_VERSION}`;
}

function faqItems(settings, baseDomain) {
  const fee = tl(settings.monthly_fee_tl);
  return [
    ['Alan adı almam gerekiyor mu?', `Hayır. Panelin ${baseDomain ? `siteadin.${baseDomain}` : 'sana verilen alt adreste'} hemen açılır. İstersen kendi alan adını panelden bağlarsın: tek bir DNS kaydı yeter, SSL otomatik.`],
    ['Müşterilerimin ödediği para kime gider?', 'Doğrudan sana. Havale/EFT, PayTR, Shopier veya kripto hesabını panelden bağlarsın; Jet hiçbir tahsilat yapmaz, komisyon almaz.'],
    ['Sitemde Jet adı görünür mü?', 'Hayır. Site senin adınla, logonla ve renginle açılır; müşterilerin Jet\'i görmez.'],
    ['Servisler nereden geliyor?', `Jet'in servislerinden. Jet fiyatının %${settings.discount_percent} altına alırsın, satış fiyatını sen belirlersin; sipariş, durum takibi, telafi ve iade otomatiktir.`],
    ['Dijital ürün de satabilir miyim?', 'Evet. Jet\'in dijital ürünleri (hesap, lisans, abonelik) panelinde hazır gelir; ayrı kâr oranıyla satarsın, teslimat anında ve otomatiktir.'],
    ['Deneme bitince ne olur?', `${settings.trial_days} gün ücretsizdir. "Devam et" dersen aylık ${fee} Jet bakiyenden alınır. Demezsen site kapanır, ${settings.delete_after_days} gün içinde ödeyip yeniden açabilirsin.`],
    ['Bakiyem yetmezse?', `${settings.grace_days} gün içinde Jet bakiyeni yüklemen yeterli; ücret kendiliğinden alınır, siten kapanmaz.`],
    ['Demoyu nasıl gezerim?', 'Bu sayfadaki demo kartlarından herhangi birine tıkla. Her tema ayrı bir örnek site; "Yönetim paneli" ve "Müşteri gözüyle" şifresiz açılır, hiçbir değişiklik kaydedilmez.'],
    ['API ile çalışmak istersem?', 'Kendi panelin varsa bayi paneline gerek yok: Jet API\'si ücretsizdir, hesabından anahtarını alıp bağlanabilirsin.']
  ];
}

// Kazanc ornegi: Jet fiyati 12,50 TL olan bir servis.
function exampleChain(settings) {
  const jet = 12.5;
  const cost = Math.round(jet * (100 - Number(settings.discount_percent || 0))) / 100;
  const markup = Number(settings.default_markup_percent || 30);
  const sell = Math.round(cost * (100 + markup)) / 100;
  return { jet, cost, sell, profit: Math.round((sell - cost) * 100) / 100, markup };
}

// Hesaplayici: musterinin odedigi aylik tutardan kar = satis * kar / (100 + kar).
function calcValues(sales, markup, fee) {
  const gross = sales * markup / (100 + markup);
  return { gross, net: gross - fee };
}

function renderResellerHtml(settings, baseDomain) {
  const fee = tl(settings.monthly_fee_tl);
  const trial = Number(settings.trial_days) || 0;
  const chain = exampleChain(settings);
  const calcSales = 10000;
  const calc = calcValues(calcSales, chain.markup, Number(settings.monthly_fee_tl) || 0);
  const sites = demoSites(baseDomain);
  const demoUrl = path => (baseDomain ? `https://demo.${esc(baseDomain)}${path}` : null);
  const siteUrl = site => (site.host ? `https://${esc(site.host)}/` : null);
  const shopperUrl = baseDomain ? `https://demo-gradyan.${esc(baseDomain)}/demo/musteri` : null;

  const features = [
    ['fa-store', 'Hazır site', `Başvurduğun an ${baseDomain ? `<strong>siteadin.${esc(baseDomain)}</strong>` : 'kendi adresinde'} açılır: servisler, sipariş, bakiye ve müşteri hesabı hazır.`],
    ['fa-tags', 'Kendi fiyatın', 'Kârını tek oranla, servis servis ya da sabit fiyatla ayarla. Maliyetin altına düşen servis kendiliğinden gizlenir.'],
    ['fa-wallet', 'Ödeme doğrudan sana', 'Havale/EFT, PayTR, Shopier ve kripto. Para kendi hesabına girer; Jet aracılık etmez, komisyon almaz.'],
    ['fa-key', 'Dijital ürünler', 'Hesap, lisans ve abonelik gibi dijital ürünleri de sat. Teslimat anında, bilgiler yalnızca alıcıya görünür.'],
    ['fa-globe', 'Kendi alan adın', 'Tek DNS kaydıyla kendi alan adını bağla; SSL sertifikası otomatik kurulur ve yenilenir.'],
    ['fa-palette', 'Senin markan', 'Logo, renk, sekme simgesi ve ana sayfa metinleri senin. Sitende Jet adı hiçbir yerde geçmez.'],
    ['fa-users', 'Müşteri yönetimi', 'Bakiye ekle/düş, ban, sipariş ve ödeme geçmişi, havale onayı ve işlem kaydı tek ekranda.'],
    ['fa-scale-balanced', 'Yasal sayfalar', 'Gizlilik, Mesafeli Satış, İade ve KVKK metinleri senin bilgilerinle otomatik dolar.']
  ];
  const compare = [
    ['Kurulum süresi', 'Günler, bazen haftalar', '1 dakika'],
    ['Sunucu, SSL ve güvenlik', 'Kendin kiralar, kurar, korursun', 'Dahil, Jet yönetir'],
    ['Panel yazılımı', 'Lisans ayrıca ödenir', 'Dahil, güncellemeler otomatik'],
    ['Servis sağlayıcı', 'Bulursun, bağlarsın, ayrı bakiye tutarsın', `Jet servisleri hazır, %${esc(settings.discount_percent)} indirimli`],
    ['Ödeme altyapısı', 'Her yöntemi kendin entegre edersin', 'Havale, PayTR, Shopier, kripto hazır'],
    ['Yasal sayfalar', 'Kendin yazarsın', 'Bilgilerinle otomatik dolar'],
    ['Aylık maliyet', 'Sunucu + lisans + bakım', `${fee} sabit, komisyon yok`]
  ];
  const included = [
    'Hazır site ve yönetim paneli',
    `${sites.length} tema, logo, renk ve metinler`,
    'Kendi alan adı ve otomatik SSL',
    '4 ödeme yöntemi, para doğrudan sana',
    `Jet servisleri %${esc(settings.discount_percent)} indirimli`,
    'Dijital ürün satışı',
    'Otomatik sipariş, telafi ve iade',
    'Komisyon yok, istediğin zaman kapat'
  ];
  const steps = [
    ['Başvur', 'Site adını ve adresini seç. Panelin ve siten anında açılır.'],
    [`${trial} gün ücretsiz dene`, 'Fiyatlarını ayarla, ödeme yöntemini bağla, ilk müşterilerini al.'],
    ['Devam et', `Beğendiysen "Devam et" de; aylık ${fee} Jet bakiyenden alınır.`]
  ];

  return `<div class="bp2">
  <section class="bp2-hero" aria-labelledby="bp2-title">
    <div class="bp2-hero-copy">
      <p class="bp2-kicker"><span>JET BAYİ PANELİ</span> ${trial ? `${trial} gün ücretsiz · kart gerekmez` : 'Hazır SMM paneli'}</p>
      <h1 id="bp2-title">Kendi SMM panelini <span>1 dakikada</span> aç</h1>
      <p class="bp2-lead">Senin adın, senin fiyatın, senin müşterin. Servisler, teslimat, iade ve ödeme altyapısı hazır gelir; sen yalnızca satışa odaklanırsın.</p>
      <div class="bp2-actions">
        <a class="bp2-btn bp2-btn-primary" href="#bayilik-basla">Ücretsiz başla <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
        <a class="bp2-btn bp2-btn-ghost" href="#bp-demolar"><i class="fa-solid fa-play" aria-hidden="true"></i> Canlı demoyu gez</a>
      </div>
      <ul class="bp2-checks">
        <li><i class="fa-solid fa-check" aria-hidden="true"></i> Sunucu, yazılım ve SSL dahil</li>
        <li><i class="fa-solid fa-check" aria-hidden="true"></i> Kendi alan adını bağla</li>
        <li><i class="fa-solid fa-check" aria-hidden="true"></i> Komisyon yok, istediğin zaman kapat</li>
      </ul>
    </div>
    <div class="bp2-hero-visual" aria-hidden="true">
      <div class="bp2-browser">
        <div class="bp2-browser-bar"><i></i><i></i><i></i><span>${baseDomain ? `siteadin.${esc(baseDomain)}` : 'siteadin.com'}</span></div>
        <img src="${img('vitrin-masaustu')}" alt="" width="960" height="600" fetchpriority="high">
      </div>
      <div class="bp2-phone"><img src="${img('vitrin-mobil')}" alt="" width="300" height="600"></div>
      <div class="bp2-chip bp2-chip-profit"><small>BUGÜNKÜ KÂR</small><strong>₺1.284,50</strong></div>
      <div class="bp2-chip bp2-chip-order"><i class="fa-solid fa-circle-check"></i> Yeni sipariş · Instagram Takipçi</div>
    </div>
  </section>

  <section class="bp2-band" aria-label="Kısaca">
    <div><strong>%${esc(settings.discount_percent)}</strong><span>Jet fiyatından indirimli alış</span></div>
    <div><strong>${sites.length}</strong><span>hazır tema, tek tıkla değişir</span></div>
    <div><strong>4</strong><span>ödeme yöntemi, para doğrudan sana</span></div>
    <div><strong>${fee}</strong><span>aylık sabit ücret, komisyon yok</span></div>
  </section>

  <section class="bp2-section" id="bp-kazanc" aria-labelledby="bp2-earn-title">
    <header class="bp2-head">
      <span class="bp2-label">01 / KAZANÇ</span>
      <h2 id="bp2-earn-title">Fiyatı sen koyarsın, farkı sen kazanırsın</h2>
      <p>Jet servislerini %${esc(settings.discount_percent)} indirimle alırsın, üzerine istediğin kârı eklersin. Müşterin sipariş verdiği an fark senin olur; maliyet Jet bakiyenden otomatik düşer.</p>
    </header>
    <div class="bp2-earn">
      <ol class="bp2-flow">
        <li><b>Müşterin öder</b><strong>${tl(chain.sell, 2)}</strong><span>senin belirlediğin fiyat (%${esc(chain.markup)} kâr), senin hesabına</span></li>
        <li><b>Jet'e alış</b><strong>${tl(chain.cost, 2)}</strong><span>Jet fiyatı ${tl(chain.jet, 2)} − %${esc(settings.discount_percent)} bayi indirimi</span></li>
        <li class="is-profit"><b>Senin kârın</b><strong>${tl(chain.profit, 2)}</strong><span>her siparişte, otomatik</span></li>
      </ol>
      <div class="bp2-calc" id="bp-calc" data-fee="${esc(settings.monthly_fee_tl)}">
        <h3>Kazancını hesapla</h3>
        <label for="bp-calc-sales">Aylık satış <small>(müşterilerinin ödediği)</small> <output id="bp-calc-sales-out">${tl(calcSales)}</output></label>
        <input type="range" id="bp-calc-sales" min="1000" max="100000" step="1000" value="${calcSales}">
        <label for="bp-calc-markup">Ortalama kâr oranın <output id="bp-calc-markup-out">%${esc(chain.markup)}</output></label>
        <input type="range" id="bp-calc-markup" min="5" max="100" step="5" value="${esc(chain.markup)}">
        <dl>
          <div><dt>Brüt kâr</dt><dd id="bp-calc-gross">${tl(calc.gross)}</dd></div>
          <div><dt>Panel ücreti</dt><dd>−${fee}</dd></div>
          <div class="is-total"><dt>Aylık net kazanç</dt><dd id="bp-calc-net">${tl(calc.net)}</dd></div>
        </dl>
        <p class="bp2-note">Örnek hesaptır; kâr = satış × oran ÷ (100 + oran).</p>
      </div>
    </div>
  </section>

  <section class="bp2-section" id="bp-demolar" aria-labelledby="bp2-demo-title">
    <header class="bp2-head">
      <span class="bp2-label">02 / CANLI DEMO</span>
      <h2 id="bp2-demo-title">Almadan önce gez</h2>
      <p>Her tema gerçek bir site olarak açık. Müşterinin göreceği ekranları ve senin yöneteceğin paneli şifresiz dolaş; hiçbir şey kaydedilmez.</p>
    </header>
    ${baseDomain ? `<div class="bp2-demo-main">
      <a class="bp2-demo-card" href="${demoUrl('/admin')}" target="_blank" rel="noopener">
        <img src="${img('panel')}" alt="Jet Bayi Paneli yönetim ekranı: kâr, sipariş ve müşteri özeti" width="1000" height="625" loading="lazy">
        <div><b><i class="fa-solid fa-gauge-high" aria-hidden="true"></i> Yönetim paneli</b><span>Siparişler, müşteriler, fiyatlar, ödemeler ve kâr özeti; örnek verilerle dolu.</span><em>Paneli aç <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></em></div>
      </a>
      <a class="bp2-demo-card" href="${shopperUrl}" target="_blank" rel="noopener">
        <img src="${img('musteri')}" alt="Bayi sitesinde müşterinin sipariş ekranı" width="1000" height="625" loading="lazy">
        <div><b><i class="fa-solid fa-user" aria-hidden="true"></i> Müşteri gözüyle</b><span>Sipariş ekranı, bakiye yükleme ve siparişlerim; müşterin ne görüyorsa.</span><em>Siteye gir <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></em></div>
      </a>
    </div>` : ''}
    <div class="bp2-themes-head">
      <h3 id="bp-themes-title">${sites.length} hazır tema</h3>
      <p>Temanı panelden tek tıkla değiştirirsin; logo, renk ve ana sayfa metinleri de senin.</p>
    </div>
    <ul class="bp2-themes">
      ${sites.map(site => {
        const href = siteUrl(site);
        const body = `<span class="bp2-theme-img"><img src="${img(`tema-${site.key}`)}" alt="${esc(site.theme_name)} tema: ${esc(site.name)} örnek sitesi" width="640" height="400" loading="lazy"></span>
          <span class="bp2-theme-meta"><b>${esc(site.theme_name)}</b><small>${esc(site.note)}</small></span>
          ${href ? '<span class="bp2-theme-go">Siteyi aç <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></span>' : ''}`;
        return href
          ? `<li><a href="${href}" target="_blank" rel="noopener">${body}</a></li>`
          : `<li><div>${body}</div></li>`;
      }).join('\n      ')}
    </ul>
  </section>

  <section class="bp2-section" aria-labelledby="bp2-feat-title">
    <header class="bp2-head">
      <span class="bp2-label">03 / ÖZELLİKLER</span>
      <h2 id="bp2-feat-title">Bir SMM sitesinin ihtiyacı olan her şey hazır</h2>
    </header>
    <ul class="bp2-features">
      ${features.map(([icon, title, text]) => `<li><i class="fa-solid ${icon}" aria-hidden="true"></i><h3>${esc(title)}</h3><p>${text}</p></li>`).join('\n      ')}
    </ul>
  </section>

  <section class="bp2-section" aria-labelledby="bp2-cmp-title">
    <header class="bp2-head">
      <span class="bp2-label">04 / KARŞILAŞTIR</span>
      <h2 id="bp2-cmp-title">Sıfırdan kurmak mı, hazır panel mi?</h2>
    </header>
    <div class="bp2-compare" role="table" aria-label="Kendi panelini kurmak ile Jet Bayi Paneli karşılaştırması">
      <div class="bp2-compare-row bp2-compare-head" role="row"><span role="columnheader"></span><span role="columnheader">Kendin kurarsan</span><span role="columnheader">Jet Bayi Paneli</span></div>
      ${compare.map(([label, own, jet]) => `<div class="bp2-compare-row" role="row"><b role="rowheader">${esc(label)}</b><span role="cell" data-label="Kendin kurarsan"><i class="fa-solid fa-xmark" aria-hidden="true"></i> ${esc(own)}</span><span role="cell" data-label="Jet Bayi Paneli"><i class="fa-solid fa-check" aria-hidden="true"></i> ${jet}</span></div>`).join('\n      ')}
    </div>
  </section>

  <section class="bp2-section" id="bayilik-basla" aria-labelledby="bp2-price-title">
    <header class="bp2-head">
      <span class="bp2-label">05 / FİYAT</span>
      <h2 id="bp2-price-title">Tek plan, sürpriz yok</h2>
    </header>
    <div class="bp2-pricing">
      <div class="bp2-plan">
        <span class="bp2-plan-tag">TEK PLAN</span>
        <h3>Jet Bayi Paneli</h3>
        <p class="bp2-plan-price"><strong>${fee}</strong><span>/ ay</span></p>
        <p class="bp2-plan-trial">${trial ? `İlk ${trial} gün ücretsiz` : 'Hemen başla'}</p>
        <ul>${included.map(item => `<li><i class="fa-solid fa-check" aria-hidden="true"></i> ${item}</li>`).join('')}</ul>
        <p class="bp2-note">Ücret Jet bakiyenden alınır. Deneme sonunda "Devam et" demezsen hiçbir şey ödemezsin.</p>
      </div>
      <div class="bp2-apply">
        <div class="bp-account" id="bayilik-account"></div>
        <ul class="bp2-assure">
          <li><i class="fa-solid fa-credit-card" aria-hidden="true"></i><div><b>Kart bilgisi istenmez</b><span>Deneme için ödeme bilgisi gerekmez; Jet hesabın yeter.</span></div></li>
          <li><i class="fa-solid fa-hand" aria-hidden="true"></i><div><b>Kendiliğinden ücret yok</b><span>Deneme bitince "Devam et" demezsen hiçbir şey alınmaz.</span></div></li>
          <li><i class="fa-solid fa-gauge-high" aria-hidden="true"></i><div><b>Panel siteyle birlikte açılır</b><span>Yönetim panelin ${baseDomain ? `siteadin.${esc(baseDomain)}/admin` : 'siteadin/admin'} adresinde; Jet şifrenle girersin.</span></div></li>
          <li><i class="fa-solid fa-headset" aria-hidden="true"></i><div><b>Takıldığın yerde destek</b><span>Ödeme yöntemi ve alan adı kurulumunda destek talebi açabilirsin.</span></div></li>
        </ul>
      </div>
    </div>
  </section>

  <section class="bp2-section" aria-labelledby="bp2-steps-title">
    <header class="bp2-head">
      <span class="bp2-label">06 / BAŞLANGIÇ</span>
      <h2 id="bp2-steps-title">Üç adımda yayındasın</h2>
    </header>
    <ol class="bp2-steps">
      ${steps.map(([title, text]) => `<li><h3>${esc(title)}</h3><p>${esc(text)}</p></li>`).join('\n      ')}
    </ol>
  </section>

  <section class="bp2-section" aria-labelledby="bp2-faq-title">
    <header class="bp2-head">
      <span class="bp2-label">07 / SSS</span>
      <h2 id="bp2-faq-title">Sık sorulanlar</h2>
    </header>
    <div class="bp2-faq">
      ${faqItems(settings, baseDomain).map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n      ')}
    </div>
  </section>

  <section class="bp2-final" aria-labelledby="bp2-final-title">
    <h2 id="bp2-final-title">Panelin bir dakika uzağında</h2>
    <p>${trial ? `${trial} gün ücretsiz dene; beğenmezsen hiçbir şey ödemezsin.` : 'Hemen başvur, panelin anında açılsın.'}</p>
    <div class="bp2-actions">
      <a class="bp2-btn bp2-btn-primary" href="#bayilik-basla">Ücretsiz başla <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
      ${baseDomain ? `<a class="bp2-btn bp2-btn-ghost" href="${demoUrl('/admin')}" target="_blank" rel="noopener">Demo paneli aç</a>` : ''}
    </div>
  </section>
</div>`;
}

function resellerJsonLd(settings, baseDomain, base) {
  const graph = [
    {
      '@type': 'Service',
      name: 'Jet Bayi Paneli',
      serviceType: 'SMM bayi paneli (child panel)',
      description: 'Kendi markanla çalışan hazır SMM paneli: Jet servisleri ve dijital ürünler, kendi fiyatın, ödemeler doğrudan sana.',
      provider: { '@type': 'Organization', name: 'Jet SMM Panel', url: base || undefined },
      areaServed: 'TR',
      offers: {
        '@type': 'Offer',
        price: String(settings.monthly_fee_tl),
        priceCurrency: 'TRY',
        url: base ? `${base}/bayilik` : undefined,
        description: `${settings.trial_days} gün ücretsiz deneme, sonrasında aylık`
      }
    },
    {
      '@type': 'FAQPage',
      mainEntity: faqItems(settings, baseDomain).map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } }))
    }
  ];
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}

module.exports = { renderResellerHtml, resellerJsonLd, calcValues };
