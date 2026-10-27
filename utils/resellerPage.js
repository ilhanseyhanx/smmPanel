'use strict';

// /bayilik: "Jet Bayi Paneli" tanitim sayfasi (sunucuda basilir; botlar JS
// beklemeden gorur). Giris yapmis kullanicinin basvuru formu / panel durumu
// #bayilik-account kutusuna public/js/reseller.js ile cizilir.
// Sayfa, site_settings.reseller_public_page kapaliyken 404'tur (server.js).

const THEME_LIST = require('../tenant/themes').publicThemes();

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function tl(value) {
  return `₺${Number(value || 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`;
}

function faqItems(settings, baseDomain) {
  const fee = tl(settings.monthly_fee_tl);
  return [
    ['Alan adı almam gerekiyor mu?', `Hayır. Panelin ${baseDomain ? `siteadin.${baseDomain}` : 'sana verilen alt adreste'} hemen açılır. İstersen kendi alan adını panelden bağlarsın: tek bir DNS kaydı yeter, SSL otomatik.`],
    ['Müşterilerimin ödediği para kime gider?', 'Doğrudan sana. Havale/EFT, PayTR, Shopier veya kripto hesabını panelden bağlarsın; Jet hiçbir tahsilat yapmaz.'],
    ['Sitemde Jet adı görünür mü?', 'Hayır. Site senin adınla ve renginle açılır; müşterilerin Jet\'i görmez.'],
    ['Servisler nereden geliyor?', `Jet'in servislerinden. Jet fiyatının %${settings.discount_percent} altına alırsın, satış fiyatını sen belirlersin; sipariş, durum takibi ve iade otomatiktir.`],
    ['Deneme bitince ne olur?', `${settings.trial_days} gün ücretsizdir. "Devam et" dersen aylık ${fee} Jet bakiyenden alınır. Demezsen site kapanır, ${settings.delete_after_days} gün içinde ödeyip yeniden açabilirsin.`],
    ['Bakiyem yetmezse?', `${settings.grace_days} gün içinde Jet bakiyeni yüklemen yeterli; ücret kendiliğinden alınır, siten kapanmaz.`],
    ['API ile çalışmak istersem?', 'Kendi panelin varsa bayi paneline gerek yok: Jet API\'si ücretsizdir, hesabından anahtarını alıp bağlanabilirsin.']
  ];
}

function renderResellerHtml(settings, baseDomain) {
  const fee = tl(settings.monthly_fee_tl);
  const features = [
    ['fa-store', 'Hazır site', `Başvurduğun an ${baseDomain ? `<strong>siteadin.${esc(baseDomain)}</strong> adresinde` : 'kendi adresinde'} sitin açılır: servisler, sipariş, bakiye, müşteri hesabı hazır.`],
    ['fa-tags', 'Fiyatı sen belirlersin', `Jet servislerini %${esc(settings.discount_percent)} indirimli alırsın; kârını servis servis veya toplu ayarlarsın.`],
    ['fa-wallet', 'Ödeme doğrudan sana', 'Havale/EFT, PayTR, Shopier ve kripto. Müşteri yüklediği bakiyeyle sipariş verir, para senin hesabına girer.'],
    ['fa-users', 'Müşteri yönetimi', 'Müşteri bakiyeleri, siparişler, havale onayı ve kayıtlar tek panelde. İptal ve kısmi iadeler müşteriye otomatik yansır.'],
    ['fa-scale-balanced', 'Yasal sayfalar hazır', 'Gizlilik, Mesafeli Satış, İade ve KVKK metinleri senin bilgilerinle otomatik dolar.'],
    ['fa-eye-slash', 'Senin markan', 'Sitende Jet adı geçmez. Logon, site adın, rengin ve duyurun senin; istersen kendi alan adını da bağlarsın.']
  ];
  const steps = [
    ['Başvur', 'Site adını ve adresini seç. Panelin anında açılır.'],
    [`${settings.trial_days} gün ücretsiz dene`, 'Fiyatlarını ayarla, ödeme yöntemini bağla, ilk müşterilerini al.'],
    ['Devam et', `Beğendiysen "Devam et" de; aylık ${fee} Jet bakiyenden alınır.`]
  ];
  return `<div class="bp-wrap">
  <header class="bp-hero">
    <span class="bp-kicker"><i class="fa-solid fa-gift" aria-hidden="true"></i> ${esc(settings.trial_days)} gün ücretsiz</span>
    <h1>Kendi SMM panelini aç, Jet servisleriyle sat</h1>
    <p>Kendi markanla, kendi fiyatınla ve kendi ödeme yöntemlerinle çalışan hazır bir site. Servisler, teslimat ve iadeler Jet'ten otomatik gelir; sen müşterine odaklanırsın.</p>
    <div class="bp-price"><strong>${fee}</strong><span>/ay · ilk ${esc(settings.trial_days)} gün ücretsiz · istediğin zaman kapat</span></div>
  </header>
  <div class="bp-account" id="bayilik-account"></div>
  <section class="bp-section" aria-labelledby="bp-features-title">
    <h2 id="bp-features-title">Panelde neler var?</h2>
    <ul class="bp-features">
      ${features.map(([icon, title, text]) => `<li><i class="fa-solid ${icon}" aria-hidden="true"></i><h3>${esc(title)}</h3><p>${text}</p></li>`).join('\n      ')}
    </ul>
  </section>
  <section class="bp-section" aria-labelledby="bp-themes-title">
    <h2 id="bp-themes-title">${THEME_LIST.length} hazır tema</h2>
    <p class="bp-lead">Temanı panelden tek tıkla değiştirirsin; logo, renk ve ana sayfa metinleri de senin. ${baseDomain ? 'Her temayı demo sitede canlı dene.' : ''}</p>
    <ul class="bp-themes">
      ${THEME_LIST.map(t => `<li>
        <div class="bp-theme-thumb" data-layout="${esc(t.layout)}" style="--t-bg:${esc(t.bg)};--t-accent:${esc(t.accent)}" aria-hidden="true"><i></i><b></b><s></s><u></u></div>
        <h3>${esc(t.name)}</h3><p>${esc(t.note)}</p>
        ${baseDomain ? `<a href="https://demo.${esc(baseDomain)}/?tema=${esc(t.key)}" target="_blank" rel="noopener">Canlı önizle <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>` : ''}
      </li>`).join('\n      ')}
    </ul>
  </section>
  <section class="bp-section" aria-labelledby="bp-steps-title">
    <h2 id="bp-steps-title">Nasıl başlarım?</h2>
    <ol class="bp-steps">
      ${steps.map(([title, text]) => `<li><h3>${esc(title)}</h3><p>${esc(text)}</p></li>`).join('\n      ')}
    </ol>
  </section>
  <section class="bp-section" aria-labelledby="bp-faq-title">
    <h2 id="bp-faq-title">Sık sorulanlar</h2>
    <div class="bp-faq">
      ${faqItems(settings, baseDomain).map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n      ')}
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
      description: 'Kendi markanla çalışan hazır SMM paneli: Jet servisleri, kendi fiyatın, ödemeler doğrudan sana.',
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

module.exports = { renderResellerHtml, resellerJsonLd };
