'use strict';

// 5 yeni satis sayfasi (11 Eyl 2026) — kelime calismasi: SEO-KELIME-CALISMASI.md
// Kapsam boslugu analiziyle secildi: aktif servisi olup hicbir sayfada
// listelenmeyen kategoriler + Google SERP kontrolu (hepsinde ticari niyetli
// "satin al" sonuclari var).
//
// ICERIK KURALI (kullanici revizyonu, 8 Eyl 2026 — youtube seed'inden devam):
//   - SEO sonucu, siralama, onerilenlere girme veya para kazanma GARANTISI yok.
//   - Algoritmayi etkileyecegi/manipule edecegi iddiasi yok.
//   - SAGLAYICININ teknik hizmet ozelligi ile BIZIM pazarlama cumlemiz ayrilir;
//     bunun icin "saglayici ... olarak belirtir" kalibi bilincli kullanildi.
//   - Katalogdaki "Yenileme Yok / Garantisiz / Iptal Aktif" uyarilari korunur.
//
// Fiyat, min/max ve servis adlari CANLI katalogdan gelir; bu dosyada
// tekrarlanmaz. Uydurma ozellik yazilmadi.
//
// Kullanim: cd /var/www/smmjet && node scripts/seed-landing-pages-2026-09.js
// Var olan slug'lara DOKUNMAZ; sayfalar TASLAK olarak olusturulur.

const path = require('path');
const sqlite3 = require('sqlite3');
const { normalizePagePayload } = require('../utils/landingPages');

const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.join(__dirname, '..', 'database.sqlite');

const STEPS_TR = ['Ücretsiz hesap oluşturun ve kart, kripto ya da havale ile bakiye yükleyin.', 'Tablodan ihtiyacınıza uygun paketi seçin; fiyat ve limitler kartta yazar.', 'Herkese açık bağlantıyı ve miktarı girin; şifre istenmez.', 'Sipariş saniyeler içinde başlar; ilerlemeyi Siparişlerim sayfasından izleyin.'];
const STEPS_EN = ['Create a free account and top up with card, crypto or bank transfer.', 'Pick the package that fits your need from the table; price and limits are on the card.', 'Enter the public link and the quantity; no password needed.', 'The order starts within seconds; track progress on the My Orders page.'];

const FAQ_COMMON_TR = [
  { q: 'Şifremi vermem gerekir mi?', a: 'Hayır. Yalnızca herkese açık bağlantı istenir; hesabınıza asla giriş yapılmaz.' },
  { q: 'Hangi ödeme yöntemleri var?', a: 'Kredi/banka kartı, kripto para ve banka havalesi ile bakiye yükleyebilirsiniz; bakiye onaylanır onaylanmaz hesabınıza yansır.' },
  { q: 'Sipariş tamamlanmazsa ne olur?', a: '"İptal Aktif" etiketli hizmetlerde teslim edilmeyen kısım bakiyenize iade edilir. Diğer hizmetlerde destek ekibi sağlayıcıyla birlikte takip eder; iade koşulları İade Politikası sayfasında yazar.' }
];
const FAQ_COMMON_EN = [
  { q: 'Do I need to give my password?', a: 'No. Only a public link is required; nobody ever logs into your account.' },
  { q: 'Which payment methods are available?', a: 'Credit/debit card, cryptocurrency and bank transfer; the balance is credited as soon as the payment is confirmed.' },
  { q: 'What if the order does not complete?', a: 'On services tagged "Cancel Enabled" the undelivered part is refunded to your balance. For other services support follows up with the provider; refund terms are on the Refund Policy page.' }
];

const page = (o) => ({
  status: 'draft', cta_text_tr: 'Ücretsiz Hesap Oluştur', cta_text_en: 'Create a Free Account',
  steps_tr: STEPS_TR, steps_en: STEPS_EN,
  ...o,
  faq_tr: [...(o.faq_tr || []), ...FAQ_COMMON_TR],
  faq_en: [...(o.faq_en || []), ...FAQ_COMMON_EN]
});

const PAGES = [
  // ---------------------------------------------------------------- 1
  page({
    slug: 'youtube-begeni-satin-al', platform_key: 'youtube', category_ids: [257, 259], sort_order: 50,
    title_tr: 'YouTube Beğeni Satın Al', title_en: 'Buy YouTube Likes',
    subtitle_tr: 'Yüksek kaliteli hesaplardan video beğenisi: 30 gün yenilemeli seçenek, anında başlangıç ve içeriğe özel üretilen yapay zekâ yorumları. Şifresiz sipariş, sadece video bağlantısı.',
    subtitle_en: 'Video likes from high-quality accounts: a 30-day refill option, instant start, plus AI-generated comments tailored to your content. No password, just your video link.',
    seo_title_tr: 'YouTube Beğeni Satın Al – 30 Gün Yenilemeli, Anında Başlangıç',
    seo_title_en: 'Buy YouTube Likes – 30-Day Refill Option, Instant Start',
    seo_description_tr: 'YouTube beğeni satın al: yüksek kaliteli hesaplardan anında başlayan beğeni, 30 gün yenilemeli seçenek ve içeriğe özel AI yorum paketleri. Şifresiz sipariş.',
    seo_description_en: 'Buy YouTube likes: instant-start likes from high-quality accounts with a 30-day refill option, plus AI comment packages tailored to your video.',
    content_tr: [
      '<h2>YouTube beğenisi ne işe yarar?</h2>',
      '<p>Beğeni sayısı, bir videonun altında herkese açık görünen etkileşim sayaçlarından biridir. Videoyu yeni açan bir izleyici, beğeni-izlenme dengesine bakarak içerik hakkında hızlı bir izlenim edinir; bu yüzden beğeni, sosyal kanıt unsurlarından sayılabilir. YouTube beğeni satın al paketleri yalnızca bu sayacı yükseltir; izlenme süresi, arama sıralaması, önerilenlere girme veya para kazanma konusunda bir sonuç taahhüt etmez.</p>',
      '<h2>Paket seçenekleri</h2>',
      '<ul>',
      '<li><strong>Yüksek kaliteli (HQ) hesaplardan beğeni:</strong> Sağlayıcı, hesap kalitesini yüksek, düşüş oranını "neredeyse yok" olarak belirtir; 30 gün yenileme etiketi taşır ve anında başlar. Saatlik teslimat hızı hizmet kartında yazar.</li>',
      '<li><strong>Ekonomik beğeni paketi:</strong> 0-1 saat içinde başlayan, daha yüksek hacimli günlük teslimat. Katalogda yenileme garantisi OLMADAN listelenir.</li>',
      '<li><strong>İçeriğe özel AI yorumları:</strong> Sağlayıcı, yorumların videonun içeriğine göre otomatik üretildiğini ve ABD kaynaklı hesaplardan geldiğini belirtir; 30 gün yenileme etiketi taşır. Beğeniyle birlikte kullanıldığında video altındaki etkileşim görünümünü tamamlar.</li>',
      '</ul>',
      '<h2>Beğeni ve yorum birlikte nasıl kullanılır?</h2>',
      '<p>Yalnızca beğeni sayısı yüksek, yorumu hiç olmayan bir video doğal görünmeyebilir. Küçük bir yorum paketiyle beğeniyi desteklemek, video altındaki tabloyu daha dengeli hâle getirir. Yorum içerikleri videonuza göre üretildiği için alakasız kalıp yorumlarla karşılaşmazsınız; yine de yayın öncesi videonuzun başlık ve açıklamasının konuyu net anlatması, üretilen yorumların isabetini artırır.</p>',
      '<h2>Garanti konusunda dürüst uyarı</h2>',
      '<blockquote>Yenileme garantisi paketten pakete değişir: HQ beğeni ve AI yorum hizmetleri 30 gün yenileme etiketi taşır, ekonomik beğeni paketi ise garanti içermez. Hangi paketin hangi koşulla geldiği hizmet kartında açıkça yazar; sipariş vermeden önce kartı okuyun. YouTube zaman zaman etkileşim sayılarını yeniden doğrular; garanti kapsamı dışındaki düşüşlerde telafi yapılmaz.</blockquote>',
      '<h2>Doğru kullanım</h2>',
      '<p>Videonuzun herkese açık olması gerekir; gizli veya liste dışı videolara teslimat yapılamaz. Aynı video için ilk sipariş tamamlanmadan ikinci siparişi vermemeniz önerilir. Beğeni sayısını düzenli içerik üretiminin yerine geçen bir yöntem olarak değil, yayın stratejinizin yanında duran bir unsur olarak değerlendirin; kalıcı izleyici kazanımı içerikle kurulur.</p>'
    ].join('\n'),
    content_en: [
      '<h2>What do YouTube likes do for you?</h2>',
      '<p>The like count is one of the public engagement counters under a video. A first-time viewer glances at the like-to-view balance to form a quick impression, which is why likes can be read as a social proof signal. Buy-YouTube-likes packages raise that counter only; they make no commitment about watch time, search ranking, the suggested feed or monetisation.</p>',
      '<h2>Package options</h2>',
      '<ul>',
      '<li><strong>Likes from high-quality (HQ) accounts:</strong> the provider states high account quality and a near-zero drop rate; the service carries a 30-day refill tag and starts instantly. Hourly delivery speed is written on the service card.</li>',
      '<li><strong>Budget like package:</strong> starts within 0-1 hour with higher daily volume. Listed in the catalogue WITHOUT a refill guarantee.</li>',
      '<li><strong>AI comments tailored to your content:</strong> the provider states that comments are generated automatically from the video content and come from US-based accounts; carries a 30-day refill tag. Combined with likes, it completes the engagement picture under a video.</li>',
      '</ul>',
      '<h2>Using likes and comments together</h2>',
      '<p>A video with a high like count but zero comments may not look natural. Backing likes with a small comment package balances the picture under the video. Comment texts are generated from your video, so you will not get irrelevant boilerplate; still, a clear title and description improve how on-topic the generated comments are.</p>',
      '<h2>An honest note on guarantees</h2>',
      '<blockquote>Refill cover varies by package: the HQ likes and AI comment services carry a 30-day refill tag, while the budget like package has no guarantee. Which package comes with which terms is stated openly on the service card — read it before ordering. YouTube periodically revalidates engagement counts; drops outside guarantee cover are not compensated.</blockquote>',
      '<h2>Using it right</h2>',
      '<p>Your video must be public; hidden or unlisted videos cannot receive delivery. Avoid placing a second order for the same video before the first completes. Treat the like count as something that sits alongside a regular publishing strategy, not as a replacement for it; lasting audience growth is built with content.</p>'
    ].join('\n'),
    faq_tr: [
      { q: 'Beğeniler düşer mi, telafisi var mı?', a: 'HQ beğeni ve AI yorum paketleri 30 gün yenileme etiketi taşır; bu süre içindeki düşüşler kart koşullarına göre yenilenir. Ekonomik paket garanti içermez. Koşullar her hizmet kartında açıkça yazar.' },
      { q: 'AI yorumlar videomla alakalı mı olur?', a: 'Sağlayıcı, yorumların video içeriğine göre otomatik üretildiğini belirtir. Başlık ve açıklaması net olan videolarda üretilen yorumların isabeti daha yüksektir.' },
      { q: 'Beğeni satın almak videoyu öne çıkarır mı?', a: 'Beğeni yalnızca video altındaki sayacı yükseltir. Arama sonuçlarında yükselme, önerilenlere girme veya izlenme artışı garanti edilmez; bu sonuçlar içerik kalitesi dâhil birçok faktöre bağlıdır.' },
      { q: 'Hangi bağlantıyı girmeliyim?', a: 'Videonun herkese açık izleme adresini girin (youtube.com/watch?v=... biçimi). Kanal adresi beğeni siparişinde kabul edilmez.' }
    ],
    faq_en: [
      { q: 'Will likes drop, is there compensation?', a: 'The HQ likes and AI comment packages carry a 30-day refill tag; drops within that period are refilled per the card terms. The budget package has no guarantee. Terms are stated on each service card.' },
      { q: 'Will AI comments be relevant to my video?', a: 'The provider states comments are generated automatically from the video content. Videos with a clear title and description get more on-topic comments.' },
      { q: 'Will buying likes promote my video?', a: 'Likes only raise the counter under the video. Higher search placement, the suggested feed or extra views are not guaranteed; those outcomes depend on many factors including content quality.' },
      { q: 'Which link should I submit?', a: 'Use the public watch URL (youtube.com/watch?v=... format). Channel URLs are not accepted for like orders.' }
    ],
    related_blog_slugs: ['youtube-begeni-ve-etkilesim-artirmanin-2026-yontemleri-msvocbys', 'youtube-video-seo-baslik-etiket-aciklama', 'youtube-izlenme-suresi-artirmanin-yollari']
  }),

  // ---------------------------------------------------------------- 2
  page({
    slug: 'whatsapp-kanal-uye-satin-al', platform_key: 'social-media', category_ids: [256, 251], sort_order: 51,
    title_tr: 'WhatsApp Kanal Üyesi Satın Al', title_en: 'Buy WhatsApp Channel Members',
    subtitle_tr: 'WhatsApp kanalınız için üye (takipçi) paketleri ve gönderilerinize karışık emoji tepkileri. Şifresiz sipariş; yalnızca herkese açık kanal bağlantısı yeterli.',
    subtitle_en: 'Member (follower) packages for your WhatsApp channel plus mixed emoji reactions for your posts. No password; a public channel link is all it takes.',
    seo_title_tr: 'WhatsApp Kanal Üyesi Satın Al – Kanal Takipçi ve Emoji Tepki',
    seo_title_en: 'Buy WhatsApp Channel Members – Followers and Emoji Reactions',
    seo_description_tr: 'WhatsApp kanal üyesi satın al: kanalınıza takipçi paketleri ve gönderilere karışık emoji tepkileri. Şifresiz sipariş, dakikalar içinde işleme alınır.',
    seo_description_en: 'Buy WhatsApp channel members: follower packages for your channel and mixed emoji reactions for posts. No password; orders are processed within minutes.',
    content_tr: [
      '<h2>WhatsApp kanalı neden önemli hâle geldi?</h2>',
      '<p>WhatsApp, Türkiye\'de en yaygın kullanılan mesajlaşma uygulaması ve kanallar özelliği, markaların ve içerik üreticilerin takipçilerine bildirim kutusundan ulaşmasını sağlıyor. Bir kanalın üye sayısı, kanal sayfasında herkese açık görünür; yeni bir ziyaretçi katılıp katılmamaya karar verirken çoğu zaman bu sayıya bakar. WhatsApp kanal üye satın al paketleri bu sayacı yükseltir; kanal içi görüntülenme, satış veya kalıcı etkileşim konusunda bir sonuç taahhüt etmez.</p>',
      '<h2>Paket seçenekleri</h2>',
      '<ul>',
      '<li><strong>Kanal üyesi (takipçi):</strong> Kanalınızın takipçi sayısını yükseltir. Minimum ve maksimum sipariş limitleri hizmet kartında yazar.</li>',
      '<li><strong>Karışık emoji tepkileri:</strong> Gönderilerinize 👍 ❤️ 😂 😲 😥 🙏 karışımından tepkiler gelir. Tepki sayısı, gönderinin altında herkese açık görünür ve gönderiye etkileşim görünümü kazandırır.</li>',
      '</ul>',
      '<h2>Üye ve tepkiyi birlikte kullanmak</h2>',
      '<p>Üye sayısı yüksek ama gönderileri tepkisiz bir kanal, dikkatli bir ziyaretçiye boş görünebilir. Yeni gönderilerinize küçük tepki paketleri eklemek, kanalın genel görünümünü dengeler. En sağlıklı kullanım; düzenli gönderi paylaşan bir kanalda üye paketini başlangıç ivmesi olarak değerlendirmek, kalıcı kitleyi ise içerik ve tanıtımla büyütmektir.</p>',
      '<h2>Garanti konusunda dürüst uyarı</h2>',
      '<blockquote>Bu kategorideki hizmetler katalogda yenileme garantisi olmadan listelenir; düşüş yaşanması hâlinde telafi veya iade yapılmaz. Sipariş vermeden önce hizmet kartındaki koşulları okuyun.</blockquote>',
      '<h2>Doğru kullanım</h2>',
      '<p>Kanalınızın herkese açık olması ve bağlantının whatsapp.com/channel/... biçiminde paylaşım adresi olması gerekir. Aynı kanal için ilk sipariş tamamlanmadan ikinci siparişi vermemeniz önerilir. Satın alınan üyeler bildirim kutunuza gelen gerçek müşteriler değildir; kanalınızı satış kanalı olarak kullanıyorsanız gerçek müşteri kitlenizi ayrıca büyütmeye devam edin.</p>'
    ].join('\n'),
    content_en: [
      '<h2>Why WhatsApp channels started to matter</h2>',
      '<p>WhatsApp is the most widely used messaging app in Türkiye, and the channels feature lets brands and creators reach followers right in the notification tray. A channel\'s member count is publicly visible on its page; a new visitor usually glances at it when deciding whether to join. Buy-WhatsApp-members packages raise that counter; they make no commitment about in-channel views, sales or lasting engagement.</p>',
      '<h2>Package options</h2>',
      '<ul>',
      '<li><strong>Channel members (followers):</strong> raises your channel\'s follower count. Minimum and maximum order limits are written on the service card.</li>',
      '<li><strong>Mixed emoji reactions:</strong> your posts receive reactions from a 👍 ❤️ 😂 😲 😥 🙏 mix. The reaction count is publicly visible under the post and gives it an engaged look.</li>',
      '</ul>',
      '<h2>Combining members and reactions</h2>',
      '<p>A channel with many members but reaction-less posts can look hollow to a careful visitor. Adding small reaction packages to new posts balances the overall picture. The healthiest use is to treat the member package as initial momentum on a channel that posts regularly, while growing the lasting audience with content and promotion.</p>',
      '<h2>An honest note on guarantees</h2>',
      '<blockquote>Services in this category are listed without a refill guarantee; drops are not compensated or refunded. Read the terms on the service card before ordering.</blockquote>',
      '<h2>Using it right</h2>',
      '<p>Your channel must be public and the link must be the share URL in the whatsapp.com/channel/... format. Avoid placing a second order for the same channel before the first completes. Purchased members are not real customers arriving in your inbox; if the channel is a sales channel for you, keep growing your genuine customer base separately.</p>'
    ].join('\n'),
    faq_tr: [
      { q: 'Kanal bağlantısını nereden alırım?', a: 'WhatsApp\'ta kanalınızı açın, kanal adına dokunun ve "Kanal bağlantısını paylaş" seçeneğiyle whatsapp.com/channel/... adresini kopyalayın. Siparişte bu adresi girin.' },
      { q: 'Üyeler kanalıma mesaj atabilir mi?', a: 'WhatsApp kanallarında takipçiler kanala mesaj gönderemez; yalnızca siz gönderi paylaşırsınız. Üyeler gönderilerinize tepki bırakabilir.' },
      { q: 'Tepkiler hangi gönderiye gelir?', a: 'Sipariş verirken belirttiğiniz gönderinin bağlantısına gelir. Her yeni gönderi için ayrı sipariş verilir.' },
      { q: 'Üyeler düşer mi?', a: 'Bu kategorideki hizmetler yenileme garantisi olmadan listelenir; düşüş hâlinde telafi yapılmaz. Koşullar hizmet kartında açıkça yazar.' }
    ],
    faq_en: [
      { q: 'Where do I find my channel link?', a: 'Open your channel in WhatsApp, tap the channel name and copy the whatsapp.com/channel/... address via "Share channel link". Submit that address with your order.' },
      { q: 'Can members message my channel?', a: 'Followers cannot send messages to a WhatsApp channel; only you post. Members can react to your posts.' },
      { q: 'Which post receives the reactions?', a: 'The post whose link you submit with the order. Place a separate order for each new post.' },
      { q: 'Will members drop?', a: 'Services in this category are listed without a refill guarantee; drops are not compensated. Terms are stated on the service card.' }
    ],
    related_blog_slugs: ['telegram-kanal-uye-artirma-rehberi', 'sosyal-medya-buyume-rehberi', 'sosyal-medya-etkilesim-orani-hesaplama-rehberi']
  }),

  // ---------------------------------------------------------------- 3
  page({
    slug: 'web-sitesi-trafik-satin-al', platform_key: 'social-media', category_ids: [255], sort_order: 52,
    title_tr: 'Web Sitesi Trafiği Satın Al', title_en: 'Buy Website Traffic',
    subtitle_tr: 'Dünya geneli ziyaretçi paketleri: sağlayıcının Google yönlendirmeli (organik görünümlü) ve doğrudan (referrer\'sız) olarak belirttiği iki trafik tipi. Yüksek hacim desteklenir.',
    subtitle_en: 'Worldwide visitor packages: two traffic types the provider describes as Google-referred (organic-looking) and direct (no referrer). High volume supported.',
    seo_title_tr: 'Web Sitesi Trafiği Satın Al – Google Yönlendirmeli ve Direkt Hit',
    seo_title_en: 'Buy Website Traffic – Google-Referred and Direct Visits',
    seo_description_tr: 'Web sitesi trafiği satın al: sağlayıcı beyanıyla Google yönlendirmeli organik görünümlü ziyaret veya doğrudan URL trafiği. Yüksek hacim, hızlı başlangıç.',
    seo_description_en: 'Buy website traffic: Google-referred organic-looking visits or direct URL traffic as stated by the provider. High volume and a fast start.',
    content_tr: [
      '<h2>Trafik paketleri ne sunar?</h2>',
      '<p>Bu sayfadaki paketler, belirttiğiniz web adresine ziyaretçi gönderir. İki tip vardır: sağlayıcının <em>Google üzerinden yönlendirme (organik görünümlü)</em> olarak belirttiği trafik ve <em>referrer bilgisi taşımayan doğrudan (direct)</em> trafik. Bu ifadeler sağlayıcının teknik beyanıdır ve trafiğin analiz araçlarında hangi kaynakta görüneceğini tarif eder; arama motoru sıralamanızın yükseleceği anlamına gelmez.</p>',
      '<h2>Hangi durumda hangi tip?</h2>',
      '<ul>',
      '<li><strong>Google yönlendirmeli (organik görünümlü):</strong> Analiz araçlarında organik/arama kaynaklı görünen ziyaret trafiği. Raporlarında arama kaynaklı ziyaret görünümü isteyenler tercih eder.</li>',
      '<li><strong>Doğrudan (direct) trafik:</strong> Referrer bilgisi olmadan gelen ziyaretler; analiz araçlarında "doğrudan" kaynağında görünür. Toplam ziyaret sayısını yükseltmek isteyenler için.</li>',
      '</ul>',
      '<h2>SEO konusunda dürüst uyarı</h2>',
      '<blockquote>Satın alınan trafik, sitenizin Google sıralamasını yükseltmez ve bu sayfadaki hiçbir paket SEO sonucu taahhüt etmez. Arama sıralaması; içerik kalitesi, teknik altyapı ve bağlantı profili gibi faktörlerle belirlenir. Trafik paketleri, ziyaretçi sayacını ve analiz raporlarındaki ziyaret hacmini yükseltir; reklam gelirine, satışa veya sıralamaya dönüşeceği garanti edilmez. Ayrıca reklam yayınlayan sayfalara (ör. AdSense) satın alınmış trafik göndermek reklam ağının politikalarını ihlal edebilir; bu riski göz önünde bulundurun.</blockquote>',
      '<h2>Doğru kullanım</h2>',
      '<p>Sipariş verirken sayfanın tam adresini (https:// ile) girin. Ziyaretçi hacmini analiz aracınızdan izleyebilirsiniz; trafiğin görünür olması için sitenizde ölçüm kodunun kurulu olması gerekir. Yüksek hacimli siparişlerde teslimat gün içine yayılır; sunucunuzun bu hacmi kaldırabildiğinden emin olun. Trafik paketleri en çok; yeni açılan bir sitenin ziyaret istatistiğini hareketlendirmek veya bir kampanya sayfasının ziyaret sayacını desteklemek gibi görünürlük amaçlı senaryolarda kullanılır.</p>',
      '<h2>Trafik mi, SEO çalışması mı?</h2>',
      '<p>Kalıcı arama trafiği istiyorsanız çözüm içerik ve teknik SEO çalışmasıdır; satın alınan trafik bunun yerine geçmez. İki yaklaşımın farkını ve hangi durumda neyin mantıklı olduğunu aşağıdaki ilgili rehberlerde ayrıntılı anlattık.</p>'
    ].join('\n'),
    content_en: [
      '<h2>What do traffic packages provide?</h2>',
      '<p>The packages on this page send visitors to the URL you submit. There are two types: traffic the provider describes as <em>Google-referred (organic-looking)</em> and <em>direct traffic carrying no referrer</em>. These are the provider\'s technical statements describing which source the visits appear under in analytics tools; they do not mean your search ranking will rise.</p>',
      '<h2>Which type for which case?</h2>',
      '<ul>',
      '<li><strong>Google-referred (organic-looking):</strong> visits that show up under the organic/search source in analytics tools. Preferred by those who want search-sourced visits in their reports.</li>',
      '<li><strong>Direct traffic:</strong> visits arriving without referrer data, shown under the "direct" source in analytics. For raising the total visit count.</li>',
      '</ul>',
      '<h2>An honest note on SEO</h2>',
      '<blockquote>Purchased traffic does not raise your Google ranking, and no package on this page commits to an SEO outcome. Search placement is determined by factors such as content quality, technical health and link profile. Traffic packages raise the visitor counter and the visit volume in analytics reports; conversion into ad revenue, sales or rankings is not guaranteed. Also note that sending purchased traffic to pages running ads (e.g. AdSense) may violate the ad network\'s policies; weigh that risk.</blockquote>',
      '<h2>Using it right</h2>',
      '<p>Submit the full page address (with https://). You can watch the visitor volume in your analytics tool; your site needs the measurement code installed for the traffic to be visible. High-volume orders are spread across the day; make sure your server can handle the load. Traffic packages are most commonly used for visibility scenarios such as activating the visit statistics of a brand-new site or backing the visit counter of a campaign page.</p>',
      '<h2>Traffic or SEO work?</h2>',
      '<p>If you want lasting search traffic, the answer is content and technical SEO work; purchased traffic is not a substitute. The related guides below explain the difference and when each approach makes sense.</p>'
    ].join('\n'),
    faq_tr: [
      { q: 'Trafik Google Analytics\'te görünür mü?', a: 'Sitenizde ölçüm kodu kuruluysa ziyaretler analiz aracınızda görünür. Google yönlendirmeli paket organik/arama kaynağında, direkt paket "doğrudan" kaynağında listelenir; bu dağılım sağlayıcının beyanına dayanır.' },
      { q: 'Trafik satın almak SEO sıralamamı yükseltir mi?', a: 'Hayır. Satın alınan trafik sıralama faktörü değildir ve bu sayfadaki paketler SEO sonucu garanti etmez. Kalıcı arama trafiği için içerik ve teknik SEO çalışması gerekir.' },
      { q: 'Ziyaretçiler sitede gezinir mi, satın alma yapar mı?', a: 'Paketler ziyaret (sayfa açılışı) sağlar; sitede gezinme, form doldurma veya satın alma taahhüt edilmez. Dönüşüm, sitenizin kendi içeriğine ve teklifinize bağlıdır.' },
      { q: 'Reklam gösteren sayfama trafik gönderebilir miyim?', a: 'Önerilmez. Reklam ağları (ör. AdSense) satın alınmış trafiği politika ihlali sayabilir ve hesabınıza yaptırım uygulayabilir. Bu riski almadan önce reklam ağınızın kurallarını okuyun.' }
    ],
    faq_en: [
      { q: 'Will the traffic show in Google Analytics?', a: 'If your site has the measurement code installed, visits appear in your analytics tool. The Google-referred package lists under the organic/search source and the direct package under "direct"; that distribution is based on the provider\'s statement.' },
      { q: 'Will buying traffic raise my SEO ranking?', a: 'No. Purchased traffic is not a ranking factor and these packages guarantee no SEO outcome. Lasting search traffic requires content and technical SEO work.' },
      { q: 'Will visitors browse or buy?', a: 'Packages deliver visits (page opens); browsing, form fills or purchases are not committed. Conversion depends on your own content and offer.' },
      { q: 'Can I send traffic to a page running ads?', a: 'Not recommended. Ad networks (e.g. AdSense) may treat purchased traffic as a policy violation and sanction your account. Read your ad network\'s rules before taking that risk.' }
    ],
    related_blog_slugs: ['web-sitesi-trafigini-artirmanin-seo-ya-etkisi-organik-mi-satin-alinan-mi-msvy8i2p', 'organik-buyume-vs-satin-alma-karsilastirmasi', 'smm-panel-nedir-nasil-kullanilir']
  }),

  // ---------------------------------------------------------------- 4
  page({
    slug: 'twitter-goruntulenme-satin-al', platform_key: 'x-twitter', category_ids: [166], sort_order: 53,
    title_tr: 'Twitter (X) Görüntülenme Satın Al', title_en: 'Buy Twitter (X) Views',
    subtitle_tr: 'Tweet ve video görüntülenmesini gösterim, etkileşim, detay tıklaması ve profil ziyaretiyle birlikte yükselten paketler. Ömür boyu garantili seçenek mevcut; anında başlangıç.',
    subtitle_en: 'Packages that raise tweet and video views together with impressions, engagements, detail clicks and profile visits. A lifetime-guarantee option is available; instant start.',
    seo_title_tr: 'Tweet Görüntülenme Satın Al – Gösterim, Etkileşim ve Profil Ziyareti',
    seo_title_en: 'Buy Tweet Views – Impressions, Engagements and Profile Visits',
    seo_description_tr: 'Tweet görüntülenme satın al: görüntülenmeyle birlikte gösterim, etkileşim, detay tıklaması ve profil ziyareti. Ömür boyu garantili seçenek, anında başlangıç.',
    seo_description_en: 'Buy tweet views: views delivered together with impressions, engagements, detail clicks and profile visits. Lifetime-guarantee option with an instant start.',
    content_tr: [
      '<h2>Tweet görüntülenmesi neden önemli?</h2>',
      '<p>X (Twitter), her gönderinin altında görüntülenme sayısını herkese açık gösterir. Düşük görüntülenmeli bir tweet, içeriği ne kadar iyi olursa olsun ilgisiz görünebilir; görüntülenme sayısı bu yüzden gönderinin ilk izlenimini belirleyen sosyal kanıt unsurlarından biridir. Tweet görüntülenme satın al paketleri bu sayacı ve sağlayıcının belirttiği eşlik eden metrikleri yükseltir; keşfet/akış sıralaması, takipçi kazanımı veya viral olma konusunda bir sonuç taahhüt etmez.</p>',
      '<h2>Paketlerde ne var?</h2>',
      '<p>Bu kategorideki hizmetler yalnızca görüntülenme sayacını değil, sağlayıcının beyanına göre birlikte gelen bir metrik demetini kapsar: <strong>görüntülenme + gösterim + etkileşim + detay tıklaması + profil ziyareti</strong>. Yani gönderinin analitik panelinde tek kalem değil, birden çok kalem hareketlenir. Paketler arasındaki fark hız, kalite ve garanti koşuludur:</p>',
      '<ul>',
      '<li><strong>Ekonomik paket:</strong> Katalogdaki en düşük birim fiyat; anında başlangıç ve çok yüksek günlük hız. Yenileme garantisi yoktur.</li>',
      '<li><strong>Ömür boyu garantili paket:</strong> Sağlayıcı düşüş hâlinde ömür boyu yenileme belirtir; uzun ömürlü kalması istenen gönderiler için.</li>',
      '<li><strong>Yüksek kalite paket:</strong> Sağlayıcı %0 düşüş belirtir, "İptal Aktif" etiketi taşır (teslim edilmeyen kısım iade edilir); katalogda yenileme yok uyarısıyla listelenir.</li>',
      '</ul>',
      '<h2>Garanti konusunda dürüst uyarı</h2>',
      '<blockquote>Garanti koşulu pakete göre değişir: bir paket ömür boyu yenileme etiketi taşırken, diğerleri yenileme garantisi olmadan listelenir. "%0 düşüş" ifadesi sağlayıcının beyanıdır. Hangi koşulun geçerli olduğu her hizmet kartında yazar; sipariş öncesi kartı okuyun.</blockquote>',
      '<h2>Doğru kullanım</h2>',
      '<p>Gönderinizin herkese açık bir hesapta olması gerekir; gizli hesapların tweetlerine teslimat yapılamaz. Bağlantı olarak tweetin tam adresini girin (x.com/kullanici/status/... biçimi). Görüntülenme, düzenli içerik ve gerçek etkileşimin yerine geçmez; thread\'ler, doğru saatte paylaşım ve profil düzeni gibi organik taktikleri aşağıdaki rehberde bulabilirsiniz.</p>'
    ].join('\n'),
    content_en: [
      '<h2>Why do tweet views matter?</h2>',
      '<p>X (Twitter) shows the view count publicly under every post. A low-view tweet can look ignored no matter how good the content is, which makes the view count one of the social proof signals shaping a post\'s first impression. Buy-tweet-views packages raise that counter and the accompanying metrics stated by the provider; they make no commitment about feed placement, follower gain or going viral.</p>',
      '<h2>What is inside the packages?</h2>',
      '<p>Services in this category cover, per the provider\'s statement, a bundle of metrics rather than the view counter alone: <strong>views + impressions + engagements + detail clicks + profile visits</strong>. In other words, several lines move in the post\'s analytics panel, not just one. The packages differ in speed, quality and guarantee terms:</p>',
      '<ul>',
      '<li><strong>Budget package:</strong> the lowest unit price in the catalogue; instant start and very high daily speed. No refill guarantee.</li>',
      '<li><strong>Lifetime-guarantee package:</strong> the provider states lifetime refill on drops; for posts meant to stay strong long-term.</li>',
      '<li><strong>High-quality package:</strong> the provider states 0% drop and it carries the "Cancel Enabled" tag (the undelivered part is refunded); listed with a no-refill notice in the catalogue.</li>',
      '</ul>',
      '<h2>An honest note on guarantees</h2>',
      '<blockquote>Guarantee terms vary by package: one carries a lifetime refill tag while the others are listed without refill cover. "0% drop" is the provider\'s statement. The applicable terms are written on each service card — read it before ordering.</blockquote>',
      '<h2>Using it right</h2>',
      '<p>The post must belong to a public account; tweets of protected accounts cannot receive delivery. Submit the full tweet URL (x.com/user/status/... format). Views are no substitute for regular content and genuine engagement; you can find organic tactics such as threads, posting times and profile structure in the guide below.</p>'
    ].join('\n'),
    faq_tr: [
      { q: 'Görüntülenme ile gösterim aynı şey mi?', a: 'X analitiğinde görüntülenme, gönderinin görülme sayacıdır; gösterim (impression) ise gönderinin akışta ekrana gelme sayısıdır. Bu kategorideki paketler sağlayıcı beyanına göre ikisini birlikte yükseltir.' },
      { q: 'Profil ziyaretleri takipçi kazandırır mı?', a: 'Paketler profil ziyareti sayacını yükseltir; ziyaretlerin takibe dönüşeceği garanti edilmez. Takipçi kazanımı profilinizin içeriğine bağlıdır.' },
      { q: 'Hangi paket uzun vadede daha güvenli?', a: 'Uzun süre görünür kalacak gönderiler için ömür boyu yenileme etiketli paket mantıklıdır. Kısa ömürlü kampanya gönderilerinde ekonomik paket yeterli olabilir; garanti koşulları kartta yazar.' },
      { q: 'Gizli (kilitli) hesabın tweetine sipariş verilebilir mi?', a: 'Hayır. Teslimat için gönderinin herkese açık olması gerekir; kilitli hesap gönderileri işlenemez.' }
    ],
    faq_en: [
      { q: 'Are views and impressions the same?', a: 'In X analytics, views are the post\'s view counter while impressions count how often it appeared on screens in feeds. Per the provider\'s statement, these packages raise both together.' },
      { q: 'Do profile visits bring followers?', a: 'Packages raise the profile visit counter; conversion of visits into follows is not guaranteed. Follower gain depends on your profile\'s content.' },
      { q: 'Which package is safer long-term?', a: 'For posts meant to stay visible long-term, the lifetime-refill package makes sense. For short-lived campaign posts the budget package may be enough; guarantee terms are on the card.' },
      { q: 'Can I order for a protected account\'s tweet?', a: 'No. The post must be public for delivery; protected-account posts cannot be processed.' }
    ],
    related_blog_slugs: ['x-twitter-takipci-ve-etkilesim-buyutme', 'sosyal-medya-etkilesim-orani-hesaplama-rehberi', 'organik-buyume-vs-satin-alma-karsilastirmasi']
  }),

  // ---------------------------------------------------------------- 5
  page({
    slug: 'tiktok-yorum-satin-al', platform_key: 'tiktok', category_ids: [240, 238, 236, 233], sort_order: 54,
    title_tr: 'TikTok Yorum Satın Al', title_en: 'Buy TikTok Comments',
    subtitle_tr: 'Sağlayıcının %100 gerçek kullanıcılardan, gönderiyle ilgili olarak belirttiği emoji + metin yorumları; yanında paylaşım, video kaydetme ve hikaye görüntülenme paketleri.',
    subtitle_en: 'Emoji + text comments the provider states come from 100% real users and relate to your post, alongside share, video-save and story-view packages.',
    seo_title_tr: 'TikTok Yorum Satın Al – Gönderiyle İlgili Gerçek Yorumlar',
    seo_title_en: 'Buy TikTok Comments – Real, Post-Related Comments',
    seo_description_tr: 'TikTok yorum satın al: sağlayıcı beyanıyla %100 gerçek kullanıcılardan gönderiyle ilgili emoji + metin yorumları; paylaşım, kaydetme ve hikaye izlenme paketleri.',
    seo_description_en: 'Buy TikTok comments: emoji + text comments related to your post from 100% real users per the provider, plus share, save and story view packages.',
    content_tr: [
      '<h2>TikTok\'ta yorum neden en değerli etkileşim?</h2>',
      '<p>Beğeni tek dokunuşla verilir; yorum ise videonun altında herkese açık duran, okunabilir bir izdir. İzleyiciler bir videonun yorumlarını gerçek insanların tepkisini görmek için açar; bomboş bir yorum bölümü, yüksek izlenmeli videoda bile soğuk bir izlenim bırakabilir. TikTok yorum satın al paketleri bu bölümü hareketlendirir; videonun keşfete çıkması, izlenme artışı veya takipçi kazanımı konusunda bir sonuç taahhüt etmez.</p>',
      '<h2>Yorum paketleri nasıl çalışır?</h2>',
      '<p>Yorum hizmetleri sabit paketler hâlinde satılır ve hizmet kartındaki miktar/limit bilgisi esastır. Sağlayıcı, yorumların <strong>%100 gerçek kullanıcılardan</strong> geldiğini, <strong>gönderiyle ilgili</strong> olduğunu ve <strong>emoji + metin</strong> biçiminde yazıldığını belirtir. İki kalite seviyesi vardır: standart gerçek kullanıcı yorumları ve sağlayıcının üst kalite hesaplar olarak belirttiği seçenek.</p>',
      '<h2>Yorumu tamamlayan etkileşim paketleri</h2>',
      '<ul>',
      '<li><strong>Paylaşım:</strong> Videonun paylaşım sayacını yükseltir; süper anında başlangıç ve çok yüksek günlük hız seçenekleri vardır. Ömür boyu yenileme etiketli seçenek mevcuttur; "İptal Aktif" etiketli paketlerde teslim edilmeyen kısım iade edilir.</li>',
      '<li><strong>Video kaydetme:</strong> İzleyicinin videoyu kaydetmesine karşılık gelen sayacı yükseltir; 30 gün yenileme etiketli seçenekler vardır.</li>',
      '<li><strong>Hikaye görüntülenme:</strong> TikTok hikayeleriniz için dünya geneli görüntülenme; sağlayıcı yüksek kalite ve gerçek kullanıcı belirtir, "İptal Aktif" etiketi taşır.</li>',
      '</ul>',
      '<h2>Garanti konusunda dürüst uyarı</h2>',
      '<blockquote>Garanti koşulu pakete göre değişir: paylaşım ve kaydetme tarafında ömür boyu / 30 gün yenileme etiketli seçenekler varken, bazı paketler yenileme garantisi olmadan listelenir. "%100 gerçek kullanıcı" ve "%0 düşüş" ifadeleri sağlayıcının beyanıdır. Geçerli koşullar her hizmet kartında yazar.</blockquote>',
      '<h2>Doğru kullanım</h2>',
      '<p>Videonuzun ve hesabınızın herkese açık olması gerekir. Yorum siparişinde videonun tam bağlantısını girin. Yorumlar videonuzun konusuna göre yazıldığı için, açıklaması net olan videolarda sonuç daha doğal görünür. Yorum bölümüne gelen gerçek sorulara kendiniz yanıt vermeye devam edin; satın alınan etkileşim, topluluk yönetiminin yerine geçmez.</p>'
    ].join('\n'),
    content_en: [
      '<h2>Why are comments TikTok\'s most valuable engagement?</h2>',
      '<p>A like takes one tap; a comment is a readable trace that stays publicly under the video. Viewers open the comments to see how real people reacted, and an empty comment section can feel cold even under a high-view video. Buy-TikTok-comments packages bring that section to life; they make no commitment about reaching the For You feed, view growth or follower gain.</p>',
      '<h2>How do comment packages work?</h2>',
      '<p>Comment services are sold as fixed packages, and the quantity/limit info on the service card is definitive. The provider states the comments come from <strong>100% real users</strong>, are <strong>related to your post</strong> and are written as <strong>emoji + text</strong>. Two quality levels exist: standard real-user comments and an option the provider describes as top-quality accounts.</p>',
      '<h2>Engagement packages that complete the picture</h2>',
      '<ul>',
      '<li><strong>Shares:</strong> raises the video\'s share counter; super-instant start and very high daily speed options exist. A lifetime-refill option is available; on "Cancel Enabled" packages the undelivered part is refunded.</li>',
      '<li><strong>Video saves:</strong> raises the counter for viewers saving your video; options with a 30-day refill tag exist.</li>',
      '<li><strong>Story views:</strong> worldwide views for your TikTok stories; the provider states high quality and real users, with a "Cancel Enabled" tag.</li>',
      '</ul>',
      '<h2>An honest note on guarantees</h2>',
      '<blockquote>Guarantee terms vary by package: shares and saves include lifetime / 30-day refill options, while some packages are listed without refill cover. "100% real users" and "0% drop" are the provider\'s statements. The applicable terms are written on each service card.</blockquote>',
      '<h2>Using it right</h2>',
      '<p>Your video and account must be public. Submit the full video URL with a comment order. Since comments are written to match your video\'s topic, results look most natural on videos with a clear description. Keep answering genuine questions in your comments yourself; purchased engagement is not a substitute for community management.</p>'
    ].join('\n'),
    faq_tr: [
      { q: 'Yorumlar videomla alakalı mı olur?', a: 'Sağlayıcı, yorumların gönderiyle ilgili yazıldığını ve emoji + metin içerdiğini belirtir. Videonuzun konusu açıklamadan net anlaşılıyorsa yorumların isabeti artar.' },
      { q: 'Yorumların içeriğini ben belirleyebilir miyim?', a: 'Bu paketlerde yorum metinleri sağlayıcı tarafından gönderiye göre yazılır; özel metin listesi iletme seçeneği yoktur. Kartta yazan biçim (emoji + metin) esastır.' },
      { q: 'Kaydetme ve paylaşım ne işe yarar?', a: 'Her ikisi de videonun altındaki ilgili sayaçları yükseltir ve videonun etkileşim görünümünü tamamlar. Keşfete çıkma veya izlenme artışı garanti edilmez.' },
      { q: 'Hikaye görüntülenme siparişi nasıl verilir?', a: 'Hikayeniz yayındayken profil bağlantınızı girerek sipariş verirsiniz; hikayeler 24 saat sonra kalktığı için siparişi hikaye yayındayken vermeniz gerekir.' }
    ],
    faq_en: [
      { q: 'Will the comments relate to my video?', a: 'The provider states comments are written to relate to the post and contain emoji + text. A clearly described video gets more on-topic comments.' },
      { q: 'Can I supply my own comment texts?', a: 'In these packages the comment texts are written by the provider based on the post; there is no custom text list option. The format on the card (emoji + text) is definitive.' },
      { q: 'What do saves and shares do?', a: 'Both raise the respective counters under the video and complete its engagement picture. Reaching the For You feed or view growth is not guaranteed.' },
      { q: 'How do I order story views?', a: 'Order with your profile link while the story is live; since stories expire after 24 hours, the order must be placed while the story is up.' }
    ],
    related_blog_slugs: ['tiktok-algoritmasi-nasil-calisir', 'tiktok-ta-viral-olmak-begeni-ve-izlenme-sayisinin-algoritmaya-etkisi-msvofnwa', 'tiktok-hesap-buyutme-stratejileri-2026']
  })
];

// Revizyon betikleri ayni metinleri kullanabilsin diye disa aktarilir.
module.exports = { PAGES };

if (require.main === module) {
  (async () => {
    const db = new sqlite3.Database(dbPath);
    db.configure('busyTimeout', 5000);
    const get = (q, prm = []) => new Promise((r, j) => db.get(q, prm, (e, row) => e ? j(e) : r(row)));
    const run = (q, prm = []) => new Promise((r, j) => db.run(q, prm, function (e) { e ? j(e) : r(this); }));

    const tablo = await get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'landing_pages'");
    if (!tablo) { console.error('landing_pages tablosu yok: once sunucuyu yeni kodla baslat.'); process.exit(1); }

    let eklenen = 0, atlanan = 0;
    for (const ham of PAGES) {
      if (await get('SELECT id FROM landing_pages WHERE slug = ?', [ham.slug])) {
        console.log('atlandi (zaten var): ' + ham.slug); atlanan++; continue;
      }
      const sonuc = normalizePagePayload(ham);
      if (sonuc.error) { console.error('HATA ' + ham.slug + ': ' + sonuc.error); continue; }
      const cols = Object.keys(sonuc.fields);
      await run('INSERT INTO landing_pages (' + cols.join(', ') + ', updated_at) VALUES ('
        + cols.map(() => '?').join(', ') + ', CURRENT_TIMESTAMP)', cols.map(c => sonuc.fields[c]));
      console.log('olusturuldu (' + sonuc.fields.status + '): ' + sonuc.fields.slug);
      eklenen++;
    }
    db.close();
    console.log('Bitti: ' + eklenen + ' sayfa olusturuldu, ' + atlanan + ' atlandi.');
    console.log('Yayina almak icin: node scripts/publish-landing-pages.js youtube-begeni-satin-al whatsapp-kanal-uye-satin-al web-sitesi-trafik-satin-al twitter-goruntulenme-satin-al tiktok-yorum-satin-al');
  })().catch(err => { console.error(err); process.exit(1); });
}
