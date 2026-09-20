'use strict';

// PANEL HUB SAYFALARI (20 Eyl 2026) — GSC analizi: SEO-ANALIZ-2026-09-20.md
//
// NEDEN: Search Console'da marka disi gosterimlerin %57'si "panel" iceren
// sorgulardan geliyor (64 gosterim, 0 tiklama, ortalama pozisyon 39.7) ve
// sitede tek bir "panel" odakli sayfa yok — butun sayfalar "X satin al"
// kalibinda. Turk kullanici "tiktok takipci satin al" kadar sik "tiktok
// paneli" de ariyor:
//   smm panel tiktok (6) · tiktok smm panel (5) · tiktok takipci paneli (4)
//   twitter panel satin al (6) · twitter panel (3) · twitter takipci paneli (1)
//   youtube smm panel (2) · tiktok begeni paneli (2) · tiktok panel (1)
//
// IKINCI GOREV — IC LINK: Bu sayfalar ayni zamanda birer hub'dir. Sitede
// 31 satis sayfasi her sayfadan ESIT agirlikla linkli (duz yapi); Google'a
// hangisinin onemli oldugu sinyali gitmiyor. Panel sayfalari, o platformun
// satis sayfalarina GOVDE METNI ICINDEN baglam linki vererek dizine
// girmeyen sayfalari yukari ceker. Ozellikle su sayfalar 36 gun boyunca tek
// gosterim almadi ve buradan link aliyor:
//   instagram-takipci-satin-al · instagram-begeni-satin-al · instagram-yorum-satin-al
//   instagram-kaydetme-satin-al · instagram-kanal-uye-satin-al
//   instagram-hikaye-izlenme-satin-al · instagram-canli-yayin-izleyici-satin-al
//   tiktok-izlenme-satin-al · youtube-izlenme-satin-al
//
// ICERIK KURALI (8 Eyl 2026 revizyonundan devam):
//   - SEO sonucu, siralama, onerilenlere girme, para kazanma GARANTISI yok.
//   - Saglayicinin teknik beyani ile bizim cumlemiz ayrilir ("saglayici ... belirtir").
//   - "Yenileme Yok / Garantisiz / Iptal Aktif" etiketleri gizlenmez.
//   - Fiyat/limit degerleri govdede tekrarlanmaz; canli tablodan gelir.
//
// KATEGORILER: Elle ID yazilmaz. Her hub, kaynak satis sayfalarinin
// category_ids alanlarini DB'den okuyup birlestirir (_kaynak alani). Kaynak
// sayfa yoksa sessizce atlanir; boylece betik hem canlida hem yerelde calisir.
//
// Kullanim: cd /var/www/smmjet && node scripts/seed-landing-pages-panel-hub.js
// Var olan slug'lara DOKUNMAZ; sayfalar TASLAK olarak olusur.

const path = require('path');
const sqlite3 = require('sqlite3');
const { normalizePagePayload } = require('../utils/landingPages');

const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.join(__dirname, '..', 'database.sqlite');

const STEPS_TR = ['Ücretsiz hesap oluşturun ve kart, kripto ya da havale ile bakiye yükleyin.', 'Aşağıdaki tablodan ihtiyacınıza uygun servisi seçin; fiyat ve limitler kartta yazar.', 'Herkese açık bağlantıyı ve miktarı girin; şifre istenmez.', 'Sipariş saniyeler içinde başlar; ilerlemeyi Siparişlerim sayfasından izleyin.'];
const STEPS_EN = ['Create a free account and top up with card, crypto or bank transfer.', 'Pick the service that fits your need from the table below; price and limits are on the card.', 'Enter the public link and the quantity; no password needed.', 'The order starts within seconds; track progress on the My Orders page.'];

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
  // Hedef: "tiktok smm panel", "smm panel tiktok", "tiktok takipci paneli",
  // "tiktok panel", "tiktok begeni paneli" — GSC'de 20 gosterim, hepsi 58+ sirada.
  page({
    slug: 'tiktok-smm-panel', platform_key: 'tiktok', sort_order: 60,
    _kaynak: ['tiktok-takipci-satin-al', 'tiktok-begeni-satin-al', 'tiktok-izlenme-satin-al', 'tiktok-yorum-satin-al', 'tiktok-canli-yayin-izleyici-satin-al'],
    title_tr: 'TikTok SMM Panel', title_en: 'TikTok SMM Panel',
    subtitle_tr: 'TikTok takipçi, beğeni, izlenme, yorum ve canlı yayın izleyici hizmetlerinin tamamı tek panelde. Şifresiz sipariş, otomatik teslimat, API erişimi ve bayi fiyatlandırması.',
    subtitle_en: 'Every TikTok service — followers, likes, views, comments and live viewers — in a single panel. No password, automated delivery, API access and reseller pricing.',
    seo_title_tr: 'TikTok SMM Panel – Takipçi, Beğeni ve İzlenme Paneli',
    seo_title_en: 'TikTok SMM Panel – Followers, Likes and Views in One Place',
    seo_description_tr: 'TikTok SMM panel: takipçi, beğeni, izlenme, yorum ve canlı yayın izleyici servisleri tek ekranda. Şifresiz sipariş, otomatik teslimat, API ve bayi erişimi.',
    seo_description_en: 'TikTok SMM panel: followers, likes, views, comments and live viewers on one screen. No password, automated delivery, API and reseller access.',
    content_tr: `<h2>TikTok paneli nedir?</h2>
<p>TikTok paneli, bir TikTok hesabının herkese açık etkileşim sayaçlarına yönelik hizmetleri tek ekranda toplayan bir sipariş arayüzüdür. Her hizmet için ayrı ayrı site aramak yerine takipçi, beğeni, izlenme, yorum ve canlı yayın izleyici siparişlerini aynı bakiyeden verirsiniz; sipariş geçmişi, iptal talepleri ve yenileme kayıtları da aynı hesapta durur. Bu sayfa, panelimizdeki bütün TikTok servislerinin giriş noktasıdır.</p>
<p>Panel mantığının asıl faydası tek tek sipariş vermekten çok, <strong>bir kampanyayı bütün olarak planlayabilmektir</strong>. Yalnızca takipçi alınmış, ancak videoları izlenmesiz ve yorumsuz kalmış bir hesap dikkatli bir ziyaretçiye tutarsız görünür. Aşağıdaki hizmetler birbirini tamamlayacak şekilde seçilebilir.</p>
<h2>Paneldeki TikTok hizmetleri</h2>
<ul>
<li><strong>Takipçi:</strong> Profilinizin takipçi sayacını yükseltir. Kalite seçenekleri ve yenileme koşulları hizmet kartında yazar. Ayrıntılar ve sık sorulan sorular için <a href="/tiktok-takipci-satin-al">TikTok takipçi satın al</a> sayfasına bakın.</li>
<li><strong>İzlenme:</strong> Video görüntülenme sayacını yükselten, genellikle en hızlı başlayan hizmet grubudur. <a href="/tiktok-izlenme-satin-al">TikTok izlenme satın al</a> sayfasında paket farkları anlatılır.</li>
<li><strong>Beğeni:</strong> Video altındaki kalp sayacını yükseltir; izlenmeyle birlikte kullanıldığında oran daha dengeli görünür. Bkz. <a href="/tiktok-begeni-satin-al">TikTok beğeni satın al</a>.</li>
<li><strong>Yorum, paylaşım ve kaydetme:</strong> Sağlayıcı, yorumların gönderiyle ilgili yazıldığını ve emoji + metin içerdiğini belirtir. <a href="/tiktok-yorum-satin-al">TikTok yorum satın al</a> sayfasında paylaşım ve kaydetme seçenekleri de listelenir.</li>
<li><strong>Canlı yayın izleyici:</strong> Yayın süresince sayaçta görünen izleyici paketleri. Süre seçenekleri ve yayın başlamadan sipariş verme kuralı için <a href="/tiktok-canli-yayin-izleyici-satin-al">TikTok canlı yayın izleyici satın al</a> sayfasını okuyun.</li>
</ul>
<h2>Hangi hizmeti ne zaman seçmeli?</h2>
<p>Yeni açılmış bir hesapta ilk hedef profilin boş görünmemesidir; ölçülü bir takipçi paketi ve videolara izlenme bu eşiği aşmaya yardımcı olur. Zaten takipçisi olan ama videoları az izlenen bir hesapta takipçi eklemek tabloyu düzeltmez — burada izlenme ve beğeni önceliklidir. Marka iş birliği görüşmesine hazırlanıyorsanız etkileşim oranınızın takipçi sayınızla uyumlu olması gerekir; oranın nasıl hesaplandığını <a href="/blog/sosyal-medya-etkilesim-orani-hesaplama-rehberi">etkileşim oranı rehberimizde</a> anlattık.</p>
<p>Algoritmanın içerik dağıtımını nasıl yaptığı konusunda gerçekçi olmakta fayda var: satın alınan sayaçlar videonun keşfete çıkacağını veya önerilenlere gireceğini göstermez. Bu konudaki ayrıntılı değerlendirme <a href="/blog/tiktok-algoritmasi-nasil-calisir">TikTok algoritması nasıl çalışır</a> yazımızdadır.</p>
<h2>API ve bayi kullanımı</h2>
<p>Kendi panelini işleten veya siparişleri kendi sisteminden yönetmek isteyen kullanıcılar için API erişimi vardır; kimlik doğrulama, servis listesi, sipariş oluşturma ve durum sorgulama uçları örnek isteklerle birlikte <a href="/smm-panel-api">SMM panel API</a> sayfasında belgelenmiştir. Düzenli ve yüksek hacimli sipariş veren kullanıcılar için bayi fiyatlandırması ayrıca değerlendirilir.</p>
<h2>Garanti konusunda dürüst uyarı</h2>
<blockquote>Yenileme kapsamı hizmetten hizmete değişir. Bazı TikTok servisleri 30 gün yenileme etiketi taşır, bazıları katalogda yenileme garantisi olmadan listelenir; "gerçek kullanıcı" ve "düşüş yok" ifadeleri sağlayıcının beyanıdır. Hangi paketin hangi koşulla geldiği aşağıdaki tabloda her hizmet kartında açıkça yazar. TikTok zaman zaman etkileşim sayılarını yeniden doğrular; garanti kapsamı dışındaki düşüşlerde telafi yapılmaz.</blockquote>
<h2>Doğru kullanım</h2>
<p>Hesabınızın ve videonuzun herkese açık olması gerekir; gizli hesaplara teslimat yapılamaz. Aynı video için ilk sipariş tamamlanmadan ikinci siparişi vermemeniz önerilir. Mevcut takipçi sayınızın çok üzerinde bir paketi tek seferde yüklemek, profilin dengesini bozan en yaygın hatadır; büyük hedefleri birkaç güne yayın. Satın alınan etkileşim, düzenli içerik üretiminin yerine geçmez — kalıcı kitle videoyla kurulur.</p>`,
    content_en: `<h2>What is a TikTok panel?</h2>
<p>A TikTok panel is a single ordering interface that gathers the services aimed at a TikTok account's public engagement counters. Instead of hunting for a separate site per service, you order followers, likes, views, comments and live viewers from the same balance; order history, cancellation requests and refill records all live in the same account. This page is the entry point to every TikTok service in our panel.</p>
<p>The real benefit of the panel model is not ordering item by item but <strong>planning a campaign as a whole</strong>. An account with followers but no views or comments on its videos looks inconsistent to an attentive visitor. The services below can be chosen so they complement one another.</p>
<h2>TikTok services in the panel</h2>
<ul>
<li><strong>Followers:</strong> raises your profile's follower counter. Quality options and refill terms are written on the service card. See <a href="/tiktok-takipci-satin-al">buy TikTok followers</a> for details and FAQs.</li>
<li><strong>Views:</strong> raises the video view counter and is usually the fastest-starting group. Package differences are explained on <a href="/tiktok-izlenme-satin-al">buy TikTok views</a>.</li>
<li><strong>Likes:</strong> raises the heart counter under a video; used together with views, the ratio looks more balanced. See <a href="/tiktok-begeni-satin-al">buy TikTok likes</a>.</li>
<li><strong>Comments, shares and saves:</strong> the provider states comments are written to relate to the post and contain emoji + text. Share and save options are also listed on <a href="/tiktok-yorum-satin-al">buy TikTok comments</a>.</li>
<li><strong>Live stream viewers:</strong> viewer packages visible in the counter during a broadcast. For duration options and the rule about ordering before the stream starts, read <a href="/tiktok-canli-yayin-izleyici-satin-al">buy TikTok live viewers</a>.</li>
</ul>
<h2>Which service, and when?</h2>
<p>On a brand-new account the first goal is for the profile not to look empty; a measured follower package plus views on videos helps cross that threshold. On an account that already has followers but few views, adding followers does not fix the picture — views and likes come first there. If you are preparing for a brand collaboration, your engagement rate needs to be consistent with your follower count; we explain how it is calculated in our <a href="/blog/sosyal-medya-etkilesim-orani-hesaplama-rehberi">engagement rate guide</a>.</p>
<p>It pays to be realistic about how the algorithm distributes content: purchased counters do not mean a video will reach the For You feed or the suggested list. Our detailed assessment is in <a href="/blog/tiktok-algoritmasi-nasil-calisir">how the TikTok algorithm works</a>.</p>
<h2>API and reseller use</h2>
<p>API access is available for users running their own panel or managing orders from their own system; authentication, service list, order creation and status endpoints are documented with sample requests on the <a href="/smm-panel-api">SMM panel API</a> page. Reseller pricing is assessed separately for users placing regular, high-volume orders.</p>
<h2>An honest note on guarantees</h2>
<blockquote>Refill cover varies by service. Some TikTok services carry a 30-day refill tag, others are listed in the catalogue without a refill guarantee; "real users" and "no drop" are the provider's statements. Which package comes with which terms is stated openly on each service card in the table below. TikTok periodically revalidates engagement counts; drops outside guarantee cover are not compensated.</blockquote>
<h2>Using it right</h2>
<p>Your account and video must be public; hidden accounts cannot receive delivery. Avoid placing a second order for the same video before the first completes. Loading a package far above your current follower count in one go is the most common mistake that throws a profile off balance; spread large targets over several days. Purchased engagement is not a substitute for regular publishing — a lasting audience is built with video.</p>`,
    faq_tr: [
      { q: 'TikTok paneli ile satın alma sayfası arasındaki fark ne?', a: 'Bu sayfa panelimizdeki bütün TikTok hizmetlerini tek ekranda toplar ve hangisinin ne işe yaradığını anlatır. Tek bir hizmete odaklanan ayrıntılı paket bilgisi, sık sorulan sorular ve kullanım uyarıları ise ilgili satın alma sayfasındadır.' },
      { q: 'Aynı anda birden fazla TikTok hizmeti sipariş edebilir miyim?', a: 'Evet, hepsi aynı bakiyeden verilir. Ancak aynı video için bir hizmetin ilk siparişi tamamlanmadan ikincisini vermemeniz önerilir; teslimatlar çakıştığında ilerlemeyi takip etmek zorlaşır.' },
      { q: 'TikTok panelinde API var mı?', a: 'Evet. Kimlik doğrulama, servis listesi, sipariş oluşturma, durum sorgulama ve bakiye uçları örnek isteklerle SMM panel API sayfasında belgelenmiştir.' },
      { q: 'Hesabımın gizli olması sorun olur mu?', a: 'Evet. Gizli hesaplara ve liste dışı videolara teslimat yapılamaz; sipariş öncesi profilinizin herkese açık olması gerekir.' }
    ],
    faq_en: [
      { q: 'What is the difference between the panel and a buy page?', a: 'This page gathers every TikTok service in our panel on one screen and explains what each one does. Detailed package information, FAQs and usage warnings for a single service live on that service’s own buy page.' },
      { q: 'Can I order several TikTok services at once?', a: 'Yes, all from the same balance. However, avoid placing a second order for the same video before the first completes; overlapping deliveries make progress harder to track.' },
      { q: 'Does the TikTok panel have an API?', a: 'Yes. Authentication, service list, order creation, status and balance endpoints are documented with sample requests on the SMM panel API page.' },
      { q: 'Is a private account a problem?', a: 'Yes. Private accounts and unlisted videos cannot receive delivery; your profile must be public before ordering.' }
    ],
    related_blog_slugs: ['tiktok-algoritmasi-nasil-calisir', 'tiktok-hesap-buyutme-stratejileri-2026', 'tiktok-ta-viral-olmak-begeni-ve-izlenme-sayisinin-algoritmaya-etkisi-msvofnwa']
  }),

  // ---------------------------------------------------------------- 2
  // Hedef: "twitter panel satin al" (6), "twitter panel" (3),
  // "twitter takipci paneli" (1), "twitter ilan paneli satin al" (2) — 12 gosterim.
  page({
    slug: 'twitter-smm-panel', platform_key: 'x-twitter', sort_order: 61,
    _kaynak: ['twitter-takipci-satin-al', 'twitter-begeni-retweet-satin-al', 'twitter-goruntulenme-satin-al'],
    title_tr: 'Twitter (X) SMM Panel', title_en: 'Twitter (X) SMM Panel',
    subtitle_tr: 'X (Twitter) takipçi, beğeni, retweet ve tweet görüntülenme hizmetleri tek panelde. Şifresiz sipariş, otomatik teslimat ve API erişimi.',
    subtitle_en: 'X (Twitter) followers, likes, retweets and tweet views in a single panel. No password, automated delivery and API access.',
    seo_title_tr: 'Twitter Panel – X Takipçi, Beğeni ve Görüntülenme Paneli',
    seo_title_en: 'Twitter Panel – X Followers, Likes and Views in One Place',
    seo_description_tr: 'Twitter (X) SMM panel: takipçi, beğeni, retweet ve tweet görüntülenme servisleri tek ekranda. Şifresiz sipariş, otomatik teslimat, API ve bayi erişimi.',
    seo_description_en: 'Twitter (X) SMM panel: followers, likes, retweets and tweet view services on one screen. No password, automated delivery, API and reseller access.',
    content_tr: `<h2>Twitter paneli nedir?</h2>
<p>Twitter paneli — platformun yeni adıyla X paneli — bir hesabın herkese açık sayaçlarına yönelik hizmetleri tek arayüzde toplar. Takipçi, beğeni, retweet ve tweet görüntülenme siparişleri aynı bakiyeden verilir; her siparişin durumu tek listede izlenir. Bu sayfa panelimizdeki bütün X hizmetlerinin giriş noktasıdır.</p>
<p>X, diğer platformlardan bir noktada ayrılır: burada asıl görünürlük ölçüsü takipçi sayısından çok <strong>tweet başına gösterim</strong>dir. Bir tweet'in altında görünen görüntülenme sayısı, o tweet'i gören herkesi kapsar; beğeni ve retweet ise etkileşimi gösterir. Bu yüzden X tarafında hizmet seçerken hedefin ne olduğu netleşmelidir.</p>
<h2>Paneldeki X (Twitter) hizmetleri</h2>
<ul>
<li><strong>Takipçi:</strong> Profil takipçi sayacını yükseltir. Miktar aralıkları ve yenileme koşulları kartta yazar; ayrıntılar <a href="/twitter-takipci-satin-al">Twitter takipçi satın al</a> sayfasındadır.</li>
<li><strong>Beğeni ve retweet:</strong> Tek tweet'in altındaki etkileşim sayaçlarını yükseltir. İkisinin birlikte nasıl kullanıldığı <a href="/twitter-begeni-retweet-satin-al">Twitter beğeni ve retweet satın al</a> sayfasında anlatılır.</li>
<li><strong>Tweet görüntülenme:</strong> Gösterim, profil ziyareti ve etkileşim içeren paketler bulunur; ömür boyu garantili seçenek de vardır. Bkz. <a href="/twitter-goruntulenme-satin-al">Twitter görüntülenme satın al</a>.</li>
</ul>
<h2>Takipçi mi, görüntülenme mi?</h2>
<p>Hesabınız yeniyse ve profiliniz boş görünüyorsa takipçi önceliklidir; ziyaretçi takip etmeye değer olup olmadığınıza ilk bu sayıya bakarak karar verir. Buna karşılık belirli bir tweet'in yayılmasını istiyorsanız takipçi eklemek işe yaramaz — o tweet'e görüntülenme ve etkileşim gerekir. Bir duyuru, kampanya ya da iş ilanı paylaştıysanız görüntülenme paketi doğrudan o gönderiye uygulanır.</p>
<p>Türk kitleye hitap eden hesaplarda kaynak ülkesi önemlidir; hizmet tablosundaki ülke filtresiyle Türkiye kaynaklı servisleri ayırabilir, konuyu <a href="/turk-takipci-satin-al">Türk takipçi satın al</a> sayfasında ayrıntılı okuyabilirsiniz.</p>
<h2>API ve bayi kullanımı</h2>
<p>Siparişlerini kendi sisteminden yönetmek isteyenler için API erişimi vardır; uçlar ve örnek istekler <a href="/smm-panel-api">SMM panel API</a> sayfasında belgelenmiştir. Düzenli ve yüksek hacimli sipariş veren kullanıcılar için bayi fiyatlandırması ayrıca değerlendirilir.</p>
<h2>Garanti konusunda dürüst uyarı</h2>
<blockquote>X tarafındaki hizmetlerin yenileme kapsamı değişkendir: görüntülenme paketlerinde ömür boyu garantili seçenekler bulunurken, bazı takipçi servisleri katalogda yenileme garantisi olmadan listelenir. Kalite ve düşüş oranına ilişkin ifadeler sağlayıcının beyanıdır. Her hizmetin koşulu aşağıdaki tabloda kartında yazar. X, hesap doğrulama politikalarını sık değiştirir; garanti kapsamı dışındaki düşüşlerde telafi yapılmaz.</blockquote>
<h2>Doğru kullanım</h2>
<p>Hesabınızın herkese açık olması gerekir; korumalı (kilitli) hesaplara teslimat yapılamaz. Beğeni, retweet ve görüntülenme siparişlerinde tweet'in tam bağlantısını, takipçi siparişinde ise profil adresinizi girin. Silinen veya korumalı hâle getirilen bir tweet'e devam eden teslimat tamamlanamaz ve bu durumda telafi yapılmaz.</p>`,
    content_en: `<h2>What is a Twitter panel?</h2>
<p>A Twitter panel — an X panel, under the platform's new name — gathers the services aimed at an account's public counters into one interface. Follower, like, retweet and tweet view orders come from the same balance, and every order's status is tracked in a single list. This page is the entry point to every X service in our panel.</p>
<p>X differs from other platforms in one respect: the real measure of visibility here is not follower count but <strong>impressions per tweet</strong>. The view count under a tweet covers everyone who saw it, while likes and retweets show engagement. So on X, the goal needs to be clear before picking a service.</p>
<h2>X (Twitter) services in the panel</h2>
<ul>
<li><strong>Followers:</strong> raises the profile follower counter. Quantity ranges and refill terms are on the card; details are on <a href="/twitter-takipci-satin-al">buy Twitter followers</a>.</li>
<li><strong>Likes and retweets:</strong> raise the engagement counters under a single tweet. How to use the two together is explained on <a href="/twitter-begeni-retweet-satin-al">buy Twitter likes and retweets</a>.</li>
<li><strong>Tweet views:</strong> packages covering impressions, profile visits and engagement, including a lifetime-guarantee option. See <a href="/twitter-goruntulenme-satin-al">buy Twitter views</a>.</li>
</ul>
<h2>Followers or views?</h2>
<p>If your account is new and your profile looks empty, followers come first; a visitor decides whether you are worth following by glancing at that number. If instead you want a specific tweet to travel, adding followers will not help — that tweet needs views and engagement. If you have posted an announcement, a campaign or a job ad, a view package applies directly to that post.</p>
<p>For accounts addressing a Turkish audience the source country matters; you can isolate Turkey-based services with the country filter in the table and read more on <a href="/turk-takipci-satin-al">buy Turkish followers</a>.</p>
<h2>API and reseller use</h2>
<p>API access is available for users managing orders from their own system; endpoints and sample requests are documented on the <a href="/smm-panel-api">SMM panel API</a> page. Reseller pricing is assessed separately for regular, high-volume users.</p>
<h2>An honest note on guarantees</h2>
<blockquote>Refill cover varies across X services: view packages include lifetime-guarantee options, while some follower services are listed without a refill guarantee. Statements about quality and drop rate are the provider's. Each service's terms are written on its card in the table below. X changes its account verification policies often; drops outside guarantee cover are not compensated.</blockquote>
<h2>Using it right</h2>
<p>Your account must be public; protected (locked) accounts cannot receive delivery. For like, retweet and view orders submit the full tweet URL; for follower orders submit your profile address. Delivery in progress to a tweet that is deleted or made protected cannot complete, and no compensation is made in that case.</p>`,
    faq_tr: [
      { q: 'Twitter mı X mi, hangi isimle arıyorum fark eder mi?', a: 'Fark etmez. Platformun adı X olarak değişti ancak panelimizdeki hizmetler aynıdır; sayfada her iki isim de kullanılır.' },
      { q: 'Görüntülenme paketi hangi tweet’e uygulanır?', a: 'Sipariş sırasında girdiğiniz tweet bağlantısına. Profil adresi girilirse görüntülenme siparişi işleme alınamaz; takipçi siparişlerinde ise profil adresi gerekir.' },
      { q: 'Korumalı hesabım varsa sipariş verebilir miyim?', a: 'Hayır. Korumalı (kilitli) hesaplara ve gizli tweetlere teslimat yapılamaz. Siparişten önce hesabın herkese açık olması gerekir.' },
      { q: 'Tweet’i silersem ne olur?', a: 'Devam eden teslimat tamamlanamaz ve bu durumda telafi veya iade yapılmaz. Sipariş tamamlanana kadar tweeti silmeyin, korumalı hâle getirmeyin.' }
    ],
    faq_en: [
      { q: 'Twitter or X — does the name I search matter?', a: 'It does not. The platform was renamed X but the services in our panel are the same; both names are used on this page.' },
      { q: 'Which tweet does a view package apply to?', a: 'The tweet URL you submit with the order. A view order cannot be processed if a profile address is submitted; follower orders, in turn, require the profile address.' },
      { q: 'Can I order with a protected account?', a: 'No. Protected (locked) accounts and hidden tweets cannot receive delivery. The account must be public before ordering.' },
      { q: 'What if I delete the tweet?', a: 'Delivery in progress cannot complete and no compensation or refund is made. Do not delete or protect the tweet until the order completes.' }
    ],
    related_blog_slugs: ['x-twitter-takipci-ve-etkilesim-buyutme', 'sosyal-medya-etkilesim-orani-hesaplama-rehberi', 'sosyal-medya-algoritmalari-2026-rehberi']
  }),

  // ---------------------------------------------------------------- 3
  // Hedef: "instagram panel", "instagram takipci paneli", "instagram begeni
  // paneli". Ayrica dizine girmeyen 8 Instagram satis sayfasina baglam linki
  // tasir — bu hub'in ic link gorevi en agir olani.
  page({
    slug: 'instagram-smm-panel', platform_key: 'instagram', sort_order: 62,
    _kaynak: ['instagram-takipci-satin-al', 'instagram-begeni-satin-al', 'instagram-izlenme-satin-al', 'instagram-hikaye-izlenme-satin-al', 'instagram-yorum-satin-al', 'instagram-kaydetme-satin-al', 'instagram-kanal-uye-satin-al', 'instagram-canli-yayin-izleyici-satin-al'],
    title_tr: 'Instagram SMM Panel', title_en: 'Instagram SMM Panel',
    subtitle_tr: 'Instagram takipçi, beğeni, izlenme, hikaye, yorum, kaydetme, yayın kanalı ve canlı yayın izleyici hizmetlerinin tamamı tek panelde. Şifresiz sipariş, otomatik teslimat.',
    subtitle_en: 'Instagram followers, likes, views, stories, comments, saves, broadcast channel and live viewers — all in one panel. No password, automated delivery.',
    seo_title_tr: 'Instagram Panel – Takipçi, Beğeni ve İzlenme Paneli',
    seo_title_en: 'Instagram Panel – Followers, Likes and Views in One Place',
    seo_description_tr: 'Instagram SMM panel: takipçi, beğeni, izlenme, hikaye görüntülenme, yorum ve kaydetme servisleri tek ekranda. Şifresiz sipariş, otomatik teslimat, API erişimi.',
    seo_description_en: 'Instagram SMM panel: followers, likes, views, story views, comments and saves on one screen. No password, automated delivery, API access.',
    content_tr: `<h2>Instagram paneli nedir?</h2>
<p>Instagram paneli, bir hesabın herkese açık sayaçlarına yönelik hizmetleri tek arayüzde toplayan sipariş ekranıdır. Takipçiden hikaye görüntülenmeye, yorumdan kaydetmeye kadar bütün siparişler aynı bakiyeden verilir ve tek listeden izlenir. Instagram, panelimizde en çok hizmet çeşidi bulunan platformdur; bu sayfa hepsinin giriş noktasıdır.</p>
<p>Instagram'da sayaçların birbirine oranı, tek tek büyüklüklerinden daha çok şey anlatır. 50.000 takipçisi olup gönderi başına 40 beğeni alan bir hesap, marka iş birliği arayan biri için 5.000 takipçili dengeli bir hesaptan daha zayıf görünür. Bu yüzden panel mantığı Instagram tarafında özellikle değerlidir: <strong>tek bir sayacı değil, profilin bütününü planlarsınız</strong>.</p>
<h2>Paneldeki Instagram hizmetleri</h2>
<ul>
<li><strong>Takipçi:</strong> Kalite seçenekleri, gönderili gerçek hesap paketleri ve yenileme koşulları için <a href="/instagram-takipci-satin-al">Instagram takipçi satın al</a> sayfasına bakın.</li>
<li><strong>Beğeni:</strong> Gönderi altındaki beğeni sayacını yükseltir; takipçi sayısıyla dengeli tutulması önerilir. Bkz. <a href="/instagram-begeni-satin-al">Instagram beğeni satın al</a>.</li>
<li><strong>İzlenme (Reels ve video):</strong> Video görüntülenme sayacını yükseltir. Paket farkları <a href="/instagram-izlenme-satin-al">Instagram izlenme satın al</a> sayfasındadır.</li>
<li><strong>Hikaye görüntülenme:</strong> Hikayeleriniz yayındayken uygulanır ve 24 saatlik pencereyle sınırlıdır. Kural ve ayrıntılar için <a href="/instagram-hikaye-izlenme-satin-al">Instagram hikaye izlenme satın al</a>.</li>
<li><strong>Yorum:</strong> Sağlayıcı, yorumların gönderiyle ilgili yazıldığını belirtir. Bkz. <a href="/instagram-yorum-satin-al">Instagram yorum satın al</a>.</li>
<li><strong>Kaydetme ve paylaşım:</strong> Beğeni ötesindeki etkileşim sayaçlarını tamamlar. Bkz. <a href="/instagram-kaydetme-satin-al">Instagram kaydetme satın al</a>.</li>
<li><strong>Yayın kanalı (broadcast channel) üyesi:</strong> Instagram'ın yeni özelliği için üye paketleri; <a href="/instagram-kanal-uye-satin-al">Instagram kanal üyesi satın al</a>.</li>
<li><strong>Canlı yayın izleyici:</strong> Yayın süresince sayaçta görünen izleyiciler; <a href="/instagram-canli-yayin-izleyici-satin-al">Instagram canlı yayın izleyici satın al</a>.</li>
</ul>
<h2>Dengeli bir profil nasıl kurulur?</h2>
<p>Pratikte işe yarayan sıralama şudur: önce profilin boş görünmemesi için ölçülü bir takipçi paketi, ardından son gönderilere beğeni ve izlenme, en son da hikaye ve kaydetme gibi tamamlayıcı sayaçlar. Tek seferde büyük bir takipçi paketi yükleyip gönderileri boş bırakmak, düzeltmesi en zor tablodur. Takipçi düşüşü yaşarsanız nedenlerini ve yapılacakları <a href="/blog/instagram-takipci-dususu-nedenleri-ve-cozumleri">takipçi düşüşü rehberinde</a> ele aldık.</p>
<p>Erişiminizde ani bir düşüş fark ederseniz bunun her zaman satın alınan etkileşimle ilgisi yoktur; gölge yasağı iddiası çoğu zaman yanlış anlaşılır. Konuyu <a href="/blog/instagram-golge-yasagi-shadowban-nedir-nasil-kalkar">gölge yasağı yazımızda</a> ayrıntılandırdık. Keşfet dağıtımı hakkında gerçekçi beklenti için <a href="/blog/2026-instagram-kesfet-taktikleri">Keşfet taktikleri</a> yazısına bakabilirsiniz.</p>
<h2>API ve bayi kullanımı</h2>
<p>Kendi sisteminden sipariş yönetmek isteyenler için API erişimi vardır; kimlik doğrulama, servis listesi, sipariş oluşturma ve durum sorgulama uçları <a href="/smm-panel-api">SMM panel API</a> sayfasında belgelenmiştir.</p>
<h2>Garanti konusunda dürüst uyarı</h2>
<blockquote>Instagram hizmetlerinde yenileme kapsamı paketten pakete değişir; bazı takipçi ve beğeni servisleri 30 gün yenileme etiketi taşır, bazıları katalogda garantisiz listelenir. "Gerçek hesap" ve "düşüş yok" ifadeleri sağlayıcının beyanıdır. Koşullar aşağıdaki tabloda her kartta yazar. Instagram sahte etkileşim temizliği yapabilir; garanti kapsamı dışındaki düşüşlerde telafi yapılmaz. Keşfete çıkma, erişim artışı veya marka iş birliği sonucu taahhüt edilmez.</blockquote>
<h2>Doğru kullanım</h2>
<p>Hesabınızın herkese açık olması gerekir; gizli hesaplara teslimat yapılamaz ve şifreniz hiçbir hizmette istenmez. Mevcut takipçi sayınızın %10-20'sini aşan tek seferlik yüklemelerden kaçının, büyük hedefleri birkaç güne yayın. Hikaye siparişlerini hikaye yayındayken verin. Satın alınan sayaçlar, düzenli paylaşım ve gerçek topluluk yönetiminin yerine geçmez.</p>`,
    content_en: `<h2>What is an Instagram panel?</h2>
<p>An Instagram panel is an ordering screen that gathers the services aimed at an account's public counters into one interface. From followers to story views, from comments to saves, every order comes from the same balance and is tracked in one list. Instagram is the platform with the widest service range in our panel; this page is the entry point to all of them.</p>
<p>On Instagram the ratio between counters says more than their individual size. An account with 50,000 followers but 40 likes per post looks weaker to a brand scout than a balanced account with 5,000. That is why the panel model is especially valuable here: <strong>you plan the whole profile, not a single counter</strong>.</p>
<h2>Instagram services in the panel</h2>
<ul>
<li><strong>Followers:</strong> for quality options, real-account packages and refill terms see <a href="/instagram-takipci-satin-al">buy Instagram followers</a>.</li>
<li><strong>Likes:</strong> raises the like counter under a post; best kept in balance with follower count. See <a href="/instagram-begeni-satin-al">buy Instagram likes</a>.</li>
<li><strong>Views (Reels and video):</strong> raises the video view counter. Package differences are on <a href="/instagram-izlenme-satin-al">buy Instagram views</a>.</li>
<li><strong>Story views:</strong> applied while your stories are live and limited to the 24-hour window. See <a href="/instagram-hikaye-izlenme-satin-al">buy Instagram story views</a>.</li>
<li><strong>Comments:</strong> the provider states comments are written to relate to the post. See <a href="/instagram-yorum-satin-al">buy Instagram comments</a>.</li>
<li><strong>Saves and shares:</strong> complete the engagement counters beyond likes. See <a href="/instagram-kaydetme-satin-al">buy Instagram saves</a>.</li>
<li><strong>Broadcast channel members:</strong> member packages for Instagram's newer feature; <a href="/instagram-kanal-uye-satin-al">buy Instagram channel members</a>.</li>
<li><strong>Live stream viewers:</strong> viewers visible in the counter during a broadcast; <a href="/instagram-canli-yayin-izleyici-satin-al">buy Instagram live viewers</a>.</li>
</ul>
<h2>How to build a balanced profile</h2>
<p>The order that works in practice: first a measured follower package so the profile does not look empty, then likes and views on recent posts, and finally complementary counters such as stories and saves. Loading one large follower package while leaving posts empty is the hardest picture to fix. If you experience follower drops, we covered the causes and what to do in our <a href="/blog/instagram-takipci-dususu-nedenleri-ve-cozumleri">follower drop guide</a>.</p>
<p>A sudden fall in reach is not always related to purchased engagement; the shadowban claim is widely misunderstood. We go into it in our <a href="/blog/instagram-golge-yasagi-shadowban-nedir-nasil-kalkar">shadowban article</a>. For realistic expectations about Explore distribution, see <a href="/blog/2026-instagram-kesfet-taktikleri">Explore tactics</a>.</p>
<h2>API and reseller use</h2>
<p>API access is available for managing orders from your own system; authentication, service list, order creation and status endpoints are documented on the <a href="/smm-panel-api">SMM panel API</a> page.</p>
<h2>An honest note on guarantees</h2>
<blockquote>Refill cover varies package by package; some follower and like services carry a 30-day refill tag, others are listed without a guarantee. "Real accounts" and "no drop" are the provider's statements. Terms are written on each card in the table below. Instagram may run fake-engagement cleanups; drops outside guarantee cover are not compensated. Reaching Explore, growth in reach or a brand collaboration outcome is not promised.</blockquote>
<h2>Using it right</h2>
<p>Your account must be public; private accounts cannot receive delivery and no service ever asks for your password. Avoid one-off loads above 10-20% of your current follower count and spread large targets over several days. Place story orders while the story is live. Purchased counters are not a substitute for regular posting and genuine community management.</p>`,
    faq_tr: [
      { q: 'Hangi hizmetten başlamalıyım?', a: 'Profiliniz yeniyse ölçülü bir takipçi paketiyle başlayıp son gönderilere beğeni ve izlenme eklemek en dengeli sıralamadır. Takipçisi olup gönderileri etkileşimsiz kalan hesaplarda ise önce beğeni ve izlenme gerekir.' },
      { q: 'Gizli hesabıma sipariş verebilir miyim?', a: 'Hayır. Teslimat için hesabın herkese açık olması gerekir. Sipariş sırasında yalnızca herkese açık profil veya gönderi bağlantısı istenir; şifre hiçbir hizmette sorulmaz.' },
      { q: 'Hikaye görüntülenme siparişini ne zaman vermeliyim?', a: 'Hikaye yayındayken. Hikayeler 24 saat sonra kalktığı için yayından kalkmış bir hikayeye teslimat yapılamaz.' },
      { q: 'Takipçilerim düşerse ne olur?', a: '30 gün yenileme etiketi taşıyan paketlerde düşüşler kart koşullarına göre yenilenir. Garantisiz listelenen paketlerde telafi yapılmaz; hangi paketin hangi koşulla geldiği hizmet kartında yazar.' }
    ],
    faq_en: [
      { q: 'Which service should I start with?', a: 'If your profile is new, a measured follower package followed by likes and views on recent posts is the most balanced order. On accounts that have followers but no engagement, likes and views come first.' },
      { q: 'Can I order for a private account?', a: 'No. The account must be public for delivery. Only a public profile or post link is requested; no service ever asks for your password.' },
      { q: 'When should I place a story view order?', a: 'While the story is live. Stories expire after 24 hours and delivery cannot be made to an expired story.' },
      { q: 'What if my followers drop?', a: 'On packages carrying a 30-day refill tag, drops are refilled per the card terms. Packages listed without a guarantee are not compensated; which package carries which terms is written on the service card.' }
    ],
    related_blog_slugs: ['instagram-takipci-dususu-nedenleri-ve-cozumleri', '2026-instagram-kesfet-taktikleri', 'instagram-golge-yasagi-shadowban-nedir-nasil-kalkar']
  }),

  // ---------------------------------------------------------------- 4
  // Hedef: "youtube smm panel" (2), "youtube paneli", "youtube abone paneli".
  // Dizine girmeyen youtube-izlenme-satin-al sayfasina baglam linki tasir.
  page({
    slug: 'youtube-smm-panel', platform_key: 'youtube', sort_order: 63,
    _kaynak: ['youtube-abone-satin-al', 'youtube-izlenme-satin-al', 'youtube-begeni-satin-al'],
    title_tr: 'YouTube SMM Panel', title_en: 'YouTube SMM Panel',
    subtitle_tr: 'YouTube abone, izlenme, beğeni ve yorum hizmetleri tek panelde. Şifresiz sipariş, otomatik teslimat, API erişimi ve bayi fiyatlandırması.',
    subtitle_en: 'YouTube subscribers, views, likes and comments in a single panel. No password, automated delivery, API access and reseller pricing.',
    seo_title_tr: 'YouTube SMM Panel – Abone, İzlenme ve Beğeni Paneli',
    seo_title_en: 'YouTube SMM Panel – Subscribers, Views and Likes in One Place',
    seo_description_tr: 'YouTube SMM panel: abone, izlenme, beğeni ve yorum servisleri tek ekranda. Şifresiz sipariş, otomatik teslimat, API ve bayi erişimi.',
    seo_description_en: 'YouTube SMM panel: subscriber, view, like and comment services on one screen. No password, automated delivery, API and reseller access.',
    content_tr: `<h2>YouTube paneli nedir?</h2>
<p>YouTube paneli, bir kanalın ve videolarının herkese açık sayaçlarına yönelik hizmetleri tek ekranda toplar. Abone, izlenme, beğeni ve yorum siparişleri aynı bakiyeden verilir. Bu sayfa panelimizdeki bütün YouTube hizmetlerinin giriş noktasıdır.</p>
<p>YouTube'un diğer platformlardan farkı, sayaçların birbirinden bağımsız çalışmamasıdır. Abone sayısı kanalın güvenilirlik göstergesi, izlenme videonun yaygınlık göstergesi, beğeni ise izleyicinin videoyu beğenip beğenmediğinin işaretidir. Panelde hizmet seçerken hangi sayacın hangi soruyu yanıtladığını bilmek gerekir.</p>
<h2>Paneldeki YouTube hizmetleri</h2>
<ul>
<li><strong>Abone:</strong> Kanal abone sayacını yükseltir. Kalite seçenekleri ve yenileme koşulları için <a href="/youtube-abone-satin-al">YouTube abone satın al</a> sayfasına bakın.</li>
<li><strong>İzlenme:</strong> İzlenme süreli SEO odaklı görüntülenme ve canlı yayınlar için süreli izleyici paketleri bulunur. Ayrıntılar <a href="/youtube-izlenme-satin-al">YouTube izlenme satın al</a> sayfasındadır.</li>
<li><strong>Beğeni ve yorum:</strong> Video altındaki beğeni sayacı ve içeriğe özel üretilen yorum paketleri; bkz. <a href="/youtube-begeni-satin-al">YouTube beğeni satın al</a>.</li>
</ul>
<h2>İş ortaklığı programı hakkında gerçekçi uyarı</h2>
<p>YouTube'un para kazanma programı 1.000 abone ve 4.000 saat izlenme süresi eşiği arar. Paneldeki izlenme hizmetleri <strong>görüntülenme sayacını</strong> yükseltir; bunun iş ortaklığı başvurusunda sayılan izlenme süresine dönüşeceği <em>taahhüt edilmez</em> ve YouTube geçersiz saydığı trafiği başvuru değerlendirmesine katmayabilir. Eşiklerin gerçekte nasıl aşıldığını <a href="/blog/youtube-da-1000-abone-ve-4000-saat-izlenme-suresine-ulasma-rehberi-2890">1.000 abone ve 4.000 saat rehberinde</a> anlattık; izlenme süresini içerikle artırmanın yolları için <a href="/blog/youtube-izlenme-suresi-artirmanin-yollari">izlenme süresi yazımıza</a> bakın.</p>
<h2>Shorts tarafı</h2>
<p>Kısa video formatı uzun videolardan farklı ölçülür ve ayrı bir strateji ister. Shorts izlenmesi ve abone dönüşümü konusunu <a href="/blog/youtube-shorts-izlenme-nasil-artirilir-abone-kazandiran-shorts-stratejisi-6186">Shorts stratejisi yazımızda</a> ele aldık. Video başlık, etiket ve açıklama düzeni için <a href="/blog/youtube-video-seo-baslik-etiket-aciklama">YouTube video SEO</a> yazısı yardımcı olur.</p>
<h2>API ve bayi kullanımı</h2>
<p>Siparişleri kendi sisteminden yönetmek isteyenler için API erişimi vardır; uçlar ve örnek istekler <a href="/smm-panel-api">SMM panel API</a> sayfasında belgelenmiştir.</p>
<h2>Garanti konusunda dürüst uyarı</h2>
<blockquote>Yenileme kapsamı hizmete göre değişir: bazı abone ve beğeni servisleri 30 gün yenileme etiketi taşırken, ekonomik paketler katalogda garantisiz listelenir. "Yüksek kalite" ve "düşüş yok" ifadeleri sağlayıcının beyanıdır. YouTube, geçersiz saydığı görüntülenme ve aboneleri geriye dönük silebilir; garanti kapsamı dışındaki düşüşlerde telafi yapılmaz. Arama sıralaması, önerilenlere girme veya para kazanma konusunda hiçbir sonuç taahhüt edilmez.</blockquote>
<h2>Doğru kullanım</h2>
<p>Videolarınızın herkese açık olması gerekir; gizli ve liste dışı videolara teslimat yapılamaz. Beğeni ve izlenme siparişlerinde videonun izleme adresini (youtube.com/watch?v=... biçimi), abone siparişlerinde ise kanal adresini girin. Aynı video için ilk sipariş tamamlanmadan ikinci siparişi vermeyin.</p>`,
    content_en: `<h2>What is a YouTube panel?</h2>
<p>A YouTube panel gathers the services aimed at a channel's and its videos' public counters onto one screen. Subscriber, view, like and comment orders come from the same balance. This page is the entry point to every YouTube service in our panel.</p>
<p>What sets YouTube apart is that its counters do not work independently. Subscriber count signals channel credibility, views signal a video's spread, and likes signal whether viewers enjoyed it. When picking a service, it helps to know which counter answers which question.</p>
<h2>YouTube services in the panel</h2>
<ul>
<li><strong>Subscribers:</strong> raises the channel subscriber counter. For quality options and refill terms see <a href="/youtube-abone-satin-al">buy YouTube subscribers</a>.</li>
<li><strong>Views:</strong> SEO-oriented views with watch duration, plus timed viewer packages for live streams. Details on <a href="/youtube-izlenme-satin-al">buy YouTube views</a>.</li>
<li><strong>Likes and comments:</strong> the like counter under a video plus comment packages generated for your content; see <a href="/youtube-begeni-satin-al">buy YouTube likes</a>.</li>
</ul>
<h2>A realistic note on the Partner Program</h2>
<p>YouTube's monetisation programme looks for 1,000 subscribers and 4,000 hours of watch time. View services in the panel raise the <strong>view counter</strong>; turning that into the watch time counted in a monetisation application is <em>not promised</em>, and YouTube may exclude traffic it deems invalid from that assessment. We explain how the thresholds are actually crossed in our <a href="/blog/youtube-da-1000-abone-ve-4000-saat-izlenme-suresine-ulasma-rehberi-2890">1,000 subscribers and 4,000 hours guide</a>; for raising watch time with content, see our <a href="/blog/youtube-izlenme-suresi-artirmanin-yollari">watch time article</a>.</p>
<h2>The Shorts side</h2>
<p>The short-form format is measured differently from long videos and calls for its own strategy. We covered Shorts views and subscriber conversion in our <a href="/blog/youtube-shorts-izlenme-nasil-artirilir-abone-kazandiran-shorts-stratejisi-6186">Shorts strategy article</a>. For title, tag and description structure, <a href="/blog/youtube-video-seo-baslik-etiket-aciklama">YouTube video SEO</a> helps.</p>
<h2>API and reseller use</h2>
<p>API access is available for managing orders from your own system; endpoints and sample requests are documented on the <a href="/smm-panel-api">SMM panel API</a> page.</p>
<h2>An honest note on guarantees</h2>
<blockquote>Refill cover varies by service: some subscriber and like services carry a 30-day refill tag, while budget packages are listed without a guarantee. "High quality" and "no drop" are the provider's statements. YouTube may retroactively remove views and subscribers it deems invalid; drops outside guarantee cover are not compensated. No outcome is promised regarding search ranking, the suggested feed or monetisation.</blockquote>
<h2>Using it right</h2>
<p>Your videos must be public; hidden and unlisted videos cannot receive delivery. For like and view orders submit the watch URL (youtube.com/watch?v=... format); for subscriber orders submit the channel address. Do not place a second order for the same video before the first completes.</p>`,
    faq_tr: [
      { q: 'İzlenme satın almak para kazanma başvurumu geçirir mi?', a: 'Hayır, böyle bir taahhüt verilmez. Hizmetler görüntülenme sayacını yükseltir; YouTube iş ortaklığı değerlendirmesinde geçersiz saydığı trafiği hesaba katmayabilir. Eşikleri aşmanın gerçekçi yolu içerik ve izlenme süresidir.' },
      { q: 'Abone siparişinde hangi adresi girmeliyim?', a: 'Kanalınızın herkese açık adresini. Beğeni ve izlenme siparişlerinde ise videonun izleme adresi (youtube.com/watch?v=... biçimi) gerekir.' },
      { q: 'Liste dışı (unlisted) videoma sipariş verebilir miyim?', a: 'Hayır. Gizli ve liste dışı videolara teslimat yapılamaz; videonun herkese açık olması gerekir.' },
      { q: 'Aboneler düşerse yenileniyor mu?', a: '30 gün yenileme etiketi taşıyan paketlerde kart koşullarına göre yenilenir. Ekonomik paketler garantisiz listelenir ve düşüş telafi edilmez.' }
    ],
    faq_en: [
      { q: 'Will buying views get my monetisation application approved?', a: 'No, no such promise is made. The services raise the view counter; YouTube may exclude traffic it deems invalid from the Partner Program assessment. The realistic route to the thresholds is content and watch time.' },
      { q: 'Which address do I submit for a subscriber order?', a: 'Your channel’s public address. Like and view orders require the video watch URL (youtube.com/watch?v=... format).' },
      { q: 'Can I order for an unlisted video?', a: 'No. Hidden and unlisted videos cannot receive delivery; the video must be public.' },
      { q: 'Are dropped subscribers refilled?', a: 'On packages carrying a 30-day refill tag, yes, per the card terms. Budget packages are listed without a guarantee and drops are not compensated.' }
    ],
    related_blog_slugs: ['youtube-da-1000-abone-ve-4000-saat-izlenme-suresine-ulasma-rehberi-2890', 'youtube-shorts-izlenme-nasil-artirilir-abone-kazandiran-shorts-stratejisi-6186', 'youtube-video-seo-baslik-etiket-aciklama']
  })
];

module.exports = { PAGES };

if (require.main === module) {
  (async () => {
    const db = new sqlite3.Database(dbPath);
    db.configure('busyTimeout', 5000);
    const get = (q, prm = []) => new Promise((r, j) => db.get(q, prm, (e, row) => e ? j(e) : r(row)));
    const run = (q, prm = []) => new Promise((r, j) => db.run(q, prm, function (e) { e ? j(e) : r(this); }));

    const tablo = await get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'landing_pages'");
    if (!tablo) { console.error('landing_pages tablosu yok: once sunucuyu yeni kodla baslat.'); process.exit(1); }

    // Hub'in kategorileri = kaynak satis sayfalarinin kategorilerinin birlesimi.
    // Elle ID yazmak canli katalog degisince bozulur; burada DB'den okunur.
    async function kategorileriTopla(slugs) {
      const ids = [];
      for (const s of slugs) {
        const row = await get('SELECT category_ids FROM landing_pages WHERE slug = ?', [s]);
        if (!row) { console.warn('  uyari: kaynak sayfa yok, atlandi -> ' + s); continue; }
        try {
          const liste = JSON.parse(row.category_ids || '[]');
          if (Array.isArray(liste)) ids.push(...liste.filter(n => Number.isInteger(n) && n > 0));
        } catch { /* bozuk JSON: yok say */ }
      }
      return [...new Set(ids)].slice(0, 30); // normalizePagePayload ust siniri
    }

    let eklenen = 0, atlanan = 0;
    for (const ham of PAGES) {
      if (await get('SELECT id FROM landing_pages WHERE slug = ?', [ham.slug])) {
        console.log('atlandi (zaten var): ' + ham.slug); atlanan++; continue;
      }
      const { _kaynak, ...sayfa } = ham;
      sayfa.category_ids = await kategorileriTopla(_kaynak || []);
      if (!sayfa.category_ids.length) {
        console.warn('atlandi (hic kategori bulunamadi): ' + ham.slug);
        atlanan++; continue;
      }
      const sonuc = normalizePagePayload(sayfa);
      if (sonuc.error) { console.error('HATA ' + ham.slug + ': ' + sonuc.error); continue; }
      const cols = Object.keys(sonuc.fields);
      await run('INSERT INTO landing_pages (' + cols.join(', ') + ', updated_at) VALUES ('
        + cols.map(() => '?').join(', ') + ', CURRENT_TIMESTAMP)', cols.map(c => sonuc.fields[c]));
      console.log('olusturuldu (' + sonuc.fields.status + ', ' + sayfa.category_ids.length + ' kategori): ' + sonuc.fields.slug);
      eklenen++;
    }
    db.close();
    console.log('Bitti: ' + eklenen + ' sayfa olusturuldu, ' + atlanan + ' atlandi.');
    console.log('Sayfalar TASLAK durumda. Gunde bir tane yayina almak icin:');
    console.log('  node scripts/publish-landing-pages.js tiktok-smm-panel');
  })().catch(err => { console.error(err); process.exit(1); });
}
