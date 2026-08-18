'use strict';

// Ana sayfa SSS bolumu: gorunen HTML ve FAQPage JSON-LD ayni listeden
// uretilir ki ikisi asla birbirinden ayri dusmesin (Google, sayfada
// gorunmeyen isaretlemeyi spam sayar). Sorular AI aramalarinin (ChatGPT,
// Perplexity, Google AI Overviews) dogrudan cekebilecegi "soru + 40-60
// kelimelik yanit" kalibinda yazilmistir.

const FAQ_ITEMS = [
  {
    q: 'SMM panel nedir?',
    a: 'SMM panel; Instagram, TikTok, YouTube gibi sosyal medya platformları için takipçi, beğeni ve izlenme gibi hizmetlerin tek panelden satın alındığı çevrimiçi bir sistemdir. Jet SMM Panel (SMMJET), bu hizmetleri ön ödemeli bakiye modeliyle otomatik teslim eden Türkçe bir SMM panelidir.'
  },
  {
    q: 'Siparişler ne kadar sürede başlar?',
    a: 'Siparişler ödeme sonrası otomatik işleme alınır ve çoğu hizmette saniyeler içinde başlar. Teslimat hızı hizmete göre değişir; her hizmetin tahmini başlama süresi ile minimum ve maksimum limitleri hizmet listesinde ayrıca belirtilir.'
  },
  {
    q: 'Hangi ödeme yöntemleri destekleniyor?',
    a: 'Kredi kartı (PayTR güvenli ödeme altyapısı), kripto para ve banka havalesi ile bakiye yükleyebilirsiniz. Kart bilgileriniz sitede saklanmaz; ödeme, ödeme kuruluşunun güvenli sayfasında işlenir ve bakiyeniz onaylandığı anda hesabınıza yansır.'
  },
  {
    q: 'Takipçi veya beğeni satın almak hesabıma zarar verir mi?',
    a: 'Hizmetler hesap şifrenizi gerektirmez; yalnızca herkese açık profil veya gönderi bağlantısı istenir. Yine de ani ve aşırı yükselişler platform algoritmalarınca fark edilebilir. Kademeli (drip-feed) teslimatı tercih etmenizi ve satın alımı organik içerik stratejisiyle desteklemenizi öneririz.'
  },
  {
    q: 'Takipçi düşüşü olursa telafi (refill) var mı?',
    a: 'Garantili olarak işaretlenen hizmetlerde, belirtilen garanti süresi boyunca düşüş telafisi (refill) sağlanır. Her hizmetin garanti kapsamı hizmet listesinde görünür; iade ve telafi koşullarının tamamı İade Politikası sayfasında açıklanır.'
  },
  {
    q: 'Hangi platformlar destekleniyor?',
    a: 'Instagram, TikTok, YouTube ve X (Twitter) başta olmak üzere birçok platform için takipçi, beğeni, izlenme ve etkileşim hizmetleri sunulur. Katalog düzenli olarak güncellenir; desteklenen platformların ve hizmetlerin güncel listesi Hizmetler sayfasındadır.'
  },
  {
    q: 'API ile otomatik sipariş verebilir miyim?',
    a: 'Evet. Bayiler ve yazılımcılar için API v2 uçları sunulur; sipariş oluşturma, sipariş durumu sorgulama ve bakiye kontrolü API üzerinden yapılabilir. Uç adresleri, istek örnekleri ve hata kodları API Dokümantasyonu sayfasında yer alır.'
  }
];

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Ana sayfaya basilan gorunur SSS isaretlemesi (details/summary — JS gerektirmez). */
function renderFaqHtml() {
  return FAQ_ITEMS.map(item => `<details class="faq-item">
  <summary>${escapeHtml(item.q)}</summary>
  <p>${escapeHtml(item.a)}</p>
</details>`).join('\n');
}

/** Gorunen SSS ile birebir ayni metinleri tasiyan FAQPage JSON-LD'si. */
function faqJsonLd() {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a }
    }))
  });
}

module.exports = { FAQ_ITEMS, renderFaqHtml, faqJsonLd };
