'use strict';

// Jet'in demo bayisi (slug 'demo', settings.demo = true). /bayilik sayfasindaki
// canli demolar buraya baglanir:
//  - demo.<taban> ve demo-<site>.<taban>: ayni bayi kaydi; her adres kendi
//    temasi ve markasiyla acilir (veritabaninda tek satir, yeni kullanici yok),
//  - /demo/musteri: demo musteri hesabiyla girip musteri ekranlarini gezme,
//  - /admin: sifresiz, salt okunur yonetim paneli.
// Demoda yazma istekleri calismaz (tenant/index.js). Siparis, musteri, odeme
// ve kayit listeleri tenant/demoData.js'teki ornek verilerle doldurulur;
// Jet'in siparis tablosuna sahte kayit yazilmaz.
const { themeOf } = require('./themes');

const DEMO_SLUG = 'demo';

// Adres parcasi -> tema ve ornek marka. Sira /bayilik galerisinin sirasidir.
const DEMO_SITES = {
  klasik: { theme: 'classic', name: 'Yıldız SMM', hero_title: 'Takipçini [dakikalar içinde] artır', hero_text: 'Instagram, TikTok ve YouTube için takipçi, beğeni ve izlenme. Bakiyeni yükle, siparişini ver, gerisini biz halledelim.' },
  gece: { theme: 'dark', name: 'Gece Medya', hero_title: 'Gece gündüz [kesintisiz] büyüme', hero_text: '7/24 çalışan otomatik sistem: siparişin gece yarısı da olsa dakikalar içinde başlar.' },
  pastel: { theme: 'pastel', name: 'Pembe Panel', hero_title: 'Hesabına [tatlı bir] dokunuş', hero_text: 'Butik markalar ve içerik üreticileri için gerçek görünümlü etkileşim paketleri.' },
  retro: { theme: 'retro', name: 'Retro Sosyal', hero_title: 'Eski usul güven, [yeni nesil] hız', hero_text: 'Yıllardır aynı kalite. Düşüş olursa telafi, sorun olursa iade.' },
  sade: { theme: 'minimal', name: 'Sade SMM', hero_title: 'Gereksiz yok, [sadece sonuç]', hero_text: 'Net fiyat listesi, hızlı sipariş ekranı, anlık durum takibi.' },
  kurumsal: { theme: 'corporate', name: 'Atlas Dijital', hero_title: 'Markanız için [kurumsal] sosyal medya çözümleri', hero_text: 'Ajanslar ve işletmeler için faturalı, garantili ve raporlanabilir hizmetler.' },
  neon: { theme: 'neon', name: 'Neon Boost', hero_title: 'Etkileşimini [parlat]', hero_text: 'Oyun yayıncıları ve içerik üreticileri için hızlı büyüme paketleri.' },
  gradyan: { theme: 'gradient', name: 'Mor Medya', hero_title: 'Sosyal medyada [bir adım önde] ol', hero_text: 'Binlerce müşterinin tercih ettiği otomatik SMM paneli. Kayıt ücretsiz, sipariş saniyeler içinde.' },
  cam: { theme: 'glass', name: 'Kristal SMM', hero_title: 'Şeffaf fiyat, [net sonuç]', hero_text: 'Her servisin başlama süresi, hızı ve garantisi açıkça yazılı. Sürpriz yok.' },
  cesur: { theme: 'bold', name: 'Cesur Takipçi', hero_title: 'Büyük düşün, [hızlı büyü]', hero_text: 'Türkiye’nin en hızlı takipçi servisleri tek panelde.' }
};
const DEMO_KEYS = Object.keys(DEMO_SITES);

const ANNOUNCEMENT = 'Bu bir demo sitedir: üstteki şeritten diğer temalara geç, müşteri ekranlarını ve yönetim panelini gez. Sipariş ve ödeme kapalıdır.';

function parseSettings(tenant) {
  try {
    const parsed = JSON.parse(tenant?.settings_json || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isDemoTenant(tenant) {
  return Boolean(tenant) && parseSettings(tenant).demo === true;
}

/** demo-<site> adresinin anahtari ('gece'); demo adresi degilse null. */
function demoKeyOfSlug(slug) {
  const match = /^demo-([a-z]+)$/.exec(String(slug || ''));
  return match && DEMO_SITES[match[1]] ? match[1] : null;
}

/** Demo bayinin o adres icin gorunen kopyasi (ayni id; ad, tema, metinler farkli). */
function demoVariant(tenant, key) {
  const site = DEMO_SITES[key];
  if (!site || !isDemoTenant(tenant)) return null;
  const settings = parseSettings(tenant);
  return {
    ...tenant,
    name: site.name,
    theme: site.theme,
    settings_json: JSON.stringify({
      ...settings,
      primary_color: '',
      hero_title: site.hero_title,
      hero_text: site.hero_text,
      footer_text: `${site.name} · Jet Bayi Paneli ile açılmış örnek site`,
      description: `${site.name} — Jet Bayi Paneli demo sitesi (${themeOf(site.theme).name} tema)`,
      demo_site: key
    })
  };
}

/** /bayilik sayfasi ve demo seridi icin demo site listesi. */
function demoSites(base) {
  return DEMO_KEYS.map(key => {
    const site = DEMO_SITES[key];
    const theme = themeOf(site.theme);
    return {
      key,
      name: site.name,
      theme: theme.key,
      theme_name: theme.name,
      layout: theme.layout,
      note: theme.note,
      accent: theme.accent,
      bg: theme.bg,
      host: base ? `demo-${key}.${base}` : null
    };
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/**
 * Demo sitelerin ustundeki serit: diger demo siteler + musteri/panel
 * baglantilari. hostSuffix: "taban.com" (yerelde port dahil); diger demolar
 * ayni koke protokolsuz baglanir.
 */
function demoBar({ currentKey, hostSuffix, jetUrl }) {
  const sites = DEMO_KEYS.map(key => {
    const site = DEMO_SITES[key];
    const label = themeOf(site.theme).name;
    const href = hostSuffix ? `//demo-${key}.${hostSuffix}/` : `/?tema=${site.theme}`;
    const active = key === currentKey;
    return `<a href="${escapeHtml(href)}" title="${escapeHtml(site.name)}"${active ? ' class="active" aria-current="page"' : ''}>${escapeHtml(label)}</a>`;
  }).join('');
  return `  <div class="sf-demo-bar" role="navigation" aria-label="Demo siteler">
    <span class="sf-demo-tag">DEMO</span>
    <span class="sf-demo-sites">${sites}</span>
    <span class="sf-demo-actions">
      <a href="/demo/musteri" class="sf-demo-cta"><i class="fa-solid fa-user" aria-hidden="true"></i> Müşteri gözüyle</a>
      <a href="/admin" class="sf-demo-cta"><i class="fa-solid fa-gauge-high" aria-hidden="true"></i> Yönetim paneli</a>
      ${jetUrl ? `<a href="${escapeHtml(jetUrl)}/bayilik" class="sf-demo-back">Bayilik <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>` : ''}
    </span>
  </div>`;
}

module.exports = {
  DEMO_SLUG, DEMO_SITES, DEMO_KEYS, ANNOUNCEMENT,
  isDemoTenant, demoKeyOfSlug, demoVariant, demoSites, demoBar
};
