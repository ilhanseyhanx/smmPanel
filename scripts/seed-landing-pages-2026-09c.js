'use strict';

// KAPSAM BOSLUGU SAYFALARI — 2 adet, 20 Eyl 2026
// Kelime dayanagi: SEO-ANALIZ-2026-09-20.md (GSC, 13 Agu - 17 Eyl)
//
// Bu iki kelimede TALEP KANITLI ama sayfa yok; gosterim baska sayfalara
// dusuyor ve donusmuyor:
//
//   "pinterest kaydetme satin al" .... 8 gosterim, pozisyon 46.1, 0 tiklama.
//       Sitede yalnizca /pinterest-takipci-satin-al var; kaydetme (save)
//       kelimesi karsilanmiyor. Pinterest'te kaydetme, begeniden daha
//       belirleyici bir sayactir — ayri sayfayi hak ediyor.
//   "youtube shorts izlenme" (2) + "youtube shots izlenme" (2, yazim hatali
//       varyant) .... toplam 4 gosterim, pozisyon 46-73. Blog yazisi var
//       ama satis sayfasi yok; gosterim bloga dusup satisa donmuyor.
//
// KATEGORI ESLESTIRME: Once categories tablosunda AKTIF SERVISI olan ve
// kaliba uyan kategoriler aranir; bulunamazsa kaynak satis sayfasinin
// (_kaynak) kategorileri devralinir. Ikisi de bossa sayfa ATLANIR.
//
// ICERIK KURALI (8 Eyl 2026 revizyonundan devam):
//   - SEO sonucu, siralama, onerilenlere girme, para kazanma GARANTISI yok.
//   - Saglayicinin teknik beyani ile bizim cumlemiz ayrilir.
//   - "Yenileme Yok / Garantisiz / Iptal Aktif" etiketleri gizlenmez.
//   - Fiyat/limit degerleri govdede tekrarlanmaz; canli tablodan gelir.
//
// Kullanim: cd /var/www/smmjet && node scripts/seed-landing-pages-2026-09c.js
// Var olan slug'lara DOKUNMAZ; sayfalar TASLAK olarak olusur.

const path = require('path');
const sqlite3 = require('sqlite3');
const { normalizePagePayload } = require('../utils/landingPages');

const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.join(__dirname, '..', 'database.sqlite');

const STEPS_TR = ['Ücretsiz hesap oluşturun ve kart, kripto ya da havale ile bakiye yükleyin.', 'Aşağıdaki tablodan ihtiyacınıza uygun paketi seçin; fiyat ve limitler kartta yazar.', 'Herkese açık bağlantıyı ve miktarı girin; şifre istenmez.', 'Sipariş saniyeler içinde başlar; ilerlemeyi Siparişlerim sayfasından izleyin.'];
const STEPS_EN = ['Create a free account and top up with card, crypto or bank transfer.', 'Pick the package that fits your need from the table below; price and limits are on the card.', 'Enter the public link and the quantity; no password needed.', 'The order starts within seconds; track progress on the My Orders page.'];

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
    slug: 'pinterest-kaydetme-satin-al', platform_key: 'social-media', sort_order: 69,
    kategori_kalibi: /pinterest/i, _kaynak: ['pinterest-takipci-satin-al'],
    title_tr: 'Pinterest Kaydetme Satın Al', title_en: 'Buy Pinterest Saves',
    subtitle_tr: 'Pin kaydetme (save), beğeni ve takipçi paketleri. Pinterest’te kaydetme sayısı, beğeniden daha belirleyici bir sinyaldir; sayfada nedenini ve doğru kullanımı anlattık.',
    subtitle_en: 'Pin save, like and follower packages. On Pinterest the save count is a stronger signal than likes; we explain why and how to use it properly.',
    seo_title_tr: 'Pinterest Kaydetme Satın Al – Pin Save ve Takipçi Paketleri',
    seo_title_en: 'Buy Pinterest Saves – Pin Save and Follower Packages',
    seo_description_tr: 'Pinterest kaydetme satın al: pin save, beğeni ve takipçi paketleri. Kaydetme sayısının neden beğeniden önemli olduğu ve doğru kullanımı bu sayfada.',
    seo_description_en: 'Buy Pinterest saves: pin save, like and follower packages, plus why the save count matters more than likes and how to use it properly.',
    content_tr: `<h2>Pinterest’te kaydetme neden beğeniden önemli?</h2>
<p>Pinterest, diğer sosyal ağlardan farklı çalışır: burada kullanıcılar içeriği tüketmek için değil, <strong>ileride kullanmak üzere biriktirmek</strong> için gezinir. Bu yüzden platformun en anlamlı etkileşimi beğeni değil kaydetmedir (save / repin). Bir pin kaydedildiğinde o kullanıcının panosuna eklenir ve o panoyu gezen başka kullanıcılara da görünür hâle gelir; yani kaydetme, içeriğin ikinci bir dağıtım halkasına girmesi demektir.</p>
<p>Kaydetme sayısı ayrıca pin’in altında herkese açık görünür. Bir pini ilk kez gören kullanıcı, kaydetme sayısına bakarak içeriğin işe yarar olup olmadığına dair hızlı bir izlenim edinir. Bu sayfadaki paketler bu sayacı yükseltir; arama sonuçlarında yükselme, önerilen pinlere girme veya site trafiği konusunda hiçbir sonuç taahhüt edilmez.</p>
<h2>Paket seçenekleri</h2>
<ul>
<li><strong>Pin kaydetme (save / repin):</strong> Belirli bir pinin kaydetme sayacını yükseltir. Sipariş sırasında pinin tam adresi girilir.</li>
<li><strong>Pin beğenisi:</strong> Kaydetmeyle birlikte kullanıldığında pin altındaki etkileşim görünümünü tamamlar.</li>
<li><strong>Profil takipçisi:</strong> Hesabınızın takipçi sayacını yükseltir; ayrıntılar ve paket farkları için <a href="/pinterest-takipci-satin-al">Pinterest takipçi satın al</a> sayfasına bakın.</li>
</ul>
<h2>Kimler için işe yarar?</h2>
<p>Pinterest, görsel ürün ve içerik üreten hesaplarda diğer platformlardan daha uzun ömürlü çalışır: bir pin aylar sonra bile keşfedilebilir. E-ticaret ürün görselleri, yemek tarifleri, iç mimari ve tasarım içerikleri, düğün ve etkinlik planlama, blog görselleri bu kategoridedir. Web sitesine trafik çekmeyi hedefleyen hesaplarda pinler siteye bağlantı taşıdığı için kaydetme sayısı doğrudan görünürlükle ilişkilidir; site trafiği konusunu <a href="/blog/web-sitesi-trafigini-artirmanin-seo-ya-etkisi-organik-mi-satin-alinan-mi-msvy8i2p">trafik ve SEO yazımızda</a> ayrıca ele aldık.</p>
<p>Sosyal kanıtın karar anındaki etkisini merak ediyorsanız <a href="/blog/sosyal-kanit-nedir-satisa-etkisi">sosyal kanıt yazımız</a> konuyu genel çerçevede anlatır. Diğer platformlardaki etkileşim sayaçlarını birlikte planlamak isterseniz <a href="/sosyal-medya-etkilesim-paketi">sosyal medya etkileşim paketi</a> sayfası giriş noktasıdır.</p>
<h2>Doğru kullanım</h2>
<p>Pininizin ve panonuzun herkese açık olması gerekir; gizli panolardaki (secret board) pinlere teslimat yapılamaz. Sipariş sırasında profil adresi değil <strong>pinin tam adresini</strong> girin. Kaydetme sayısını pinin görüntülenme hacmiyle orantılı tutun: birkaç yüz görüntülenmesi olan bir pine binlerce kaydetme gelmesi doğal görünmez. Pinterest’te kalıcı sonuç, düzenli ve konu odaklı pano yapısıyla kurulur; satın alınan kaydetme bunun yerine geçmez, başlangıç ivmesi sağlar.</p>
<h2>Garanti konusunda dürüst uyarı</h2>
<blockquote>Bu kategorideki hizmetlerin yenileme kapsamı pakete göre değişir; bazı paketler katalogda yenileme garantisi olmadan listelenir ve düşüş yaşanması hâlinde telafi yapılmaz. Kaynak kalitesine ilişkin ifadeler sağlayıcının beyanıdır. Pinterest, geçersiz saydığı etkileşimi geriye dönük olarak sayaçtan düşebilir; garanti kapsamı dışındaki düşüşler telafi edilmez. Pin’in arama sonuçlarında yükselmesi, önerilen pinlere girmesi veya siteye trafik getirmesi taahhüt edilmez.</blockquote>`,
    content_en: `<h2>Why do saves matter more than likes on Pinterest?</h2>
<p>Pinterest works differently from other networks: people browse here not to consume content but to <strong>collect it for later use</strong>. That makes the save (or repin) the platform's most meaningful interaction, not the like. When a pin is saved it joins that user's board and becomes visible to everyone browsing that board — so a save puts the content into a second distribution loop.</p>
<p>The save count is also publicly visible under the pin. Someone seeing it for the first time forms a quick impression of whether the content is useful by glancing at that number. The packages on this page raise that counter; no outcome is promised regarding search placement, the suggested pins feed or site traffic.</p>
<h2>Package options</h2>
<ul>
<li><strong>Pin saves (repins):</strong> raises the save counter on a specific pin. The full pin URL is submitted with the order.</li>
<li><strong>Pin likes:</strong> used alongside saves, completes the engagement picture under a pin.</li>
<li><strong>Profile followers:</strong> raises your account's follower counter; for details and package differences see <a href="/pinterest-takipci-satin-al">buy Pinterest followers</a>.</li>
</ul>
<h2>Who does it work for?</h2>
<p>Pinterest lasts longer than other platforms for accounts producing visual products and content: a pin can still be discovered months later. E-commerce product images, recipes, interior design, wedding and event planning, and blog graphics all fall in this category. For accounts aiming to drive site traffic, pins carry a link, so the save count relates directly to visibility; we covered site traffic separately in our <a href="/blog/web-sitesi-trafigini-artirmanin-seo-ya-etkisi-organik-mi-satin-alinan-mi-msvy8i2p">traffic and SEO article</a>.</p>
<p>If you are curious about social proof at the moment of decision, our <a href="/blog/sosyal-kanit-nedir-satisa-etkisi">social proof article</a> covers the general frame. To plan engagement counters across platforms together, the <a href="/sosyal-medya-etkilesim-paketi">social media engagement package</a> page is the entry point.</p>
<h2>Using it right</h2>
<p>Your pin and board must be public; pins on secret boards cannot receive delivery. Submit the <strong>full pin URL</strong>, not your profile address. Keep the save count proportional to the pin's view volume: thousands of saves on a pin with a few hundred views does not look natural. Lasting results on Pinterest come from a regular, topic-focused board structure; purchased saves do not replace that, they provide initial momentum.</p>
<h2>An honest note on guarantees</h2>
<blockquote>Refill cover in this category varies by package; some are listed without a refill guarantee and drops are not compensated. Statements about source quality are the provider's. Pinterest may retroactively remove engagement it deems invalid; drops outside guarantee cover are not compensated. A pin rising in search results, entering the suggested feed or bringing traffic to your site is not promised.</blockquote>`,
    faq_tr: [
      { q: 'Kaydetme mi beğeni mi almalıyım?', a: 'Pinterest’te kaydetme daha belirleyicidir; pin başka kullanıcıların panosuna eklendiği için ikinci bir görünürlük halkası oluşur. Beğeni, kaydetmeyle birlikte kullanıldığında tabloyu tamamlar.' },
      { q: 'Hangi adresi girmeliyim?', a: 'Pinin tam adresini. Profil adresi girilirse kaydetme siparişi işleme alınamaz; takipçi siparişlerinde ise profil adresi gerekir.' },
      { q: 'Gizli panodaki pine sipariş verebilir miyim?', a: 'Hayır. Gizli panolardaki (secret board) pinlere ve kapalı hesaplara teslimat yapılamaz; pinin herkese açık olması gerekir.' },
      { q: 'Kaydetme sayısı siteme trafik getirir mi?', a: 'Böyle bir taahhüt verilmez. Kaydetme sayacı pinin görünürlüğüyle ilişkilidir ancak tıklama ve site trafiği görselin, açıklamanın ve hedef sayfanın kalitesine bağlıdır.' }
    ],
    faq_en: [
      { q: 'Should I buy saves or likes?', a: 'Saves are more decisive on Pinterest; the pin joins other users’ boards, creating a second visibility loop. Likes complete the picture when used alongside saves.' },
      { q: 'Which URL should I submit?', a: 'The full pin URL. A save order cannot be processed if a profile address is submitted; follower orders require the profile address.' },
      { q: 'Can I order for a pin on a secret board?', a: 'No. Pins on secret boards and closed accounts cannot receive delivery; the pin must be public.' },
      { q: 'Will saves bring traffic to my site?', a: 'No such promise is made. The save counter relates to a pin’s visibility, but clicks and site traffic depend on the image, the description and the quality of the destination page.' }
    ],
    related_blog_slugs: ['web-sitesi-trafigini-artirmanin-seo-ya-etkisi-organik-mi-satin-alinan-mi-msvy8i2p', 'sosyal-kanit-nedir-satisa-etkisi', 'sosyal-medya-buyume-rehberi']
  }),

  // ---------------------------------------------------------------- 2
  page({
    slug: 'youtube-shorts-izlenme-satin-al', platform_key: 'youtube', sort_order: 70,
    kategori_kalibi: /shorts/i, _kaynak: ['youtube-izlenme-satin-al'],
    title_tr: 'YouTube Shorts İzlenme Satın Al', title_en: 'Buy YouTube Shorts Views',
    subtitle_tr: 'Shorts videolarınız için görüntülenme paketleri. Kısa video formatının uzun videolardan farkı, abone dönüşümü ve doğru miktar seçimi bu sayfada anlatıldı.',
    subtitle_en: 'View packages for your Shorts videos. How the short-form format differs from long video, subscriber conversion and choosing the right quantity.',
    seo_title_tr: 'YouTube Shorts İzlenme Satın Al – Kısa Video Görüntülenme',
    seo_title_en: 'Buy YouTube Shorts Views – Short-Form Video Views',
    seo_description_tr: 'YouTube Shorts izlenme satın al: kısa videolarınız için görüntülenme paketleri. Shorts’ın uzun videodan farkı, abone dönüşümü ve doğru miktar seçimi burada.',
    seo_description_en: 'Buy YouTube Shorts views: view packages for your short-form videos, how Shorts differs from long video, and how to choose the right quantity.',
    content_tr: `<h2>Shorts, uzun videodan neden farklı ölçülür?</h2>
<p>YouTube Shorts, klasik videodan ayrı bir akışta dağıtılır ve ayrı ölçülür. Uzun videoda belirleyici olan izlenme süresi ve tıklama oranıyken, Shorts tarafında öne çıkan ölçüt <strong>videonun sonuna kadar izlenme ve tekrar izlenme oranıdır</strong>. Bu yüzden Shorts için hazırlanan bir stratejinin uzun video stratejisiyle aynı olması beklenmez.</p>
<p>Bu sayfadaki paketler Shorts videonuzun <strong>görüntülenme sayacını</strong> yükseltir. Shorts akışında (feed) öne çıkma, önerilenlere girme, abone kazanımı veya para kazanma konusunda hiçbir sonuç taahhüt edilmez.</p>
<h2>Shorts izlenmesi ne işe yarar?</h2>
<p>Görüntülenme sayısı, videoyu açan izleyicinin gördüğü ilk sosyal kanıt unsurudur. Birkaç yüz izlenmesi olan bir Short ile on binlerce izlenmesi olan bir Short arasında, izleyicinin videoyu sonuna kadar izleme eğilimi farklıdır. Yeni bir kanalda bu eşiği aşmak, ilk izleyici kitlesini oluşturmayı kolaylaştırabilir.</p>
<p>Shorts izlenmesinin abone dönüşümüne nasıl bağlandığını ve hangi içerik yapısının işe yaradığını <a href="/blog/youtube-shorts-izlenme-nasil-artirilir-abone-kazandiran-shorts-stratejisi-6186">Shorts stratejisi yazımızda</a> ayrıntılı anlattık. Kanal genelinde izlenme süresi artırmanın yolları için <a href="/blog/youtube-izlenme-suresi-artirmanin-yollari">izlenme süresi yazısı</a>, başlık ve açıklama düzeni için <a href="/blog/youtube-video-seo-baslik-etiket-aciklama">YouTube video SEO</a> yazısı yardımcı olur.</p>
<h2>Diğer YouTube hizmetleriyle birlikte kullanım</h2>
<p>Yalnızca izlenmesi yüksek, beğenisi ve yorumu olmayan bir Short dengesiz görünür. Küçük hacimli beğeni paketleriyle desteklemek tabloyu tamamlar: <a href="/youtube-begeni-satin-al">YouTube beğeni satın al</a>. Uzun videolarınız ve canlı yayınlarınız için <a href="/youtube-izlenme-satin-al">YouTube izlenme satın al</a>, kanal abone sayacı için <a href="/youtube-abone-satin-al">YouTube abone satın al</a> sayfalarına bakabilirsiniz. Platformun tüm hizmetlerinin giriş noktası <a href="/youtube-smm-panel">YouTube panelidir</a>.</p>
<h2>İş ortaklığı programı hakkında gerçekçi uyarı</h2>
<p>YouTube’un para kazanma programında Shorts için ayrı bir eşik (90 günde belirli sayıda Shorts görüntülenmesi) uygulanır. Bu sayfadaki hizmetler görüntülenme sayacını yükseltir; bunun iş ortaklığı başvurusunda <em>sayılacağı taahhüt edilmez</em> ve YouTube geçersiz saydığı trafiği değerlendirmeye katmayabilir. Eşiklerin gerçekte nasıl aşıldığını <a href="/blog/youtube-da-1000-abone-ve-4000-saat-izlenme-suresine-ulasma-rehberi-2890">1.000 abone ve 4.000 saat rehberinde</a> ele aldık.</p>
<h2>Doğru kullanım</h2>
<p>Videonuzun herkese açık olması gerekir; gizli ve liste dışı videolara teslimat yapılamaz. Sipariş sırasında Shorts videosunun tam adresini girin. Kanal boyutunuzla orantısız bir izlenme yüklemesinden kaçının: 50 abonesi olan bir kanalın Short’una bir gecede yüz binlerce izlenme gelmesi doğal bir eğriye benzemez. Aynı video için ilk sipariş tamamlanmadan ikinci siparişi vermeyin.</p>
<h2>Garanti konusunda dürüst uyarı</h2>
<blockquote>Yenileme kapsamı pakete göre değişir; bazı paketler katalogda garantisiz listelenir ve düşüş telafi edilmez. Kaynak ve hıza ilişkin ifadeler sağlayıcının beyanıdır. YouTube, geçersiz saydığı görüntülenmeleri geriye dönük olarak silebilir; garanti kapsamı dışındaki düşüşlerde telafi yapılmaz. Shorts akışında öne çıkma, abone kazanımı ve para kazanma konusunda hiçbir sonuç taahhüt edilmez.</blockquote>`,
    content_en: `<h2>Why is Shorts measured differently from long video?</h2>
<p>YouTube Shorts is distributed in a separate feed and measured separately. Where watch time and click-through rate drive long video, the leading metric on Shorts is <strong>completion and replay rate</strong>. A Shorts strategy is therefore not expected to match a long-video one.</p>
<p>The packages on this page raise your Shorts video's <strong>view counter</strong>. No outcome is promised regarding prominence in the Shorts feed, the suggested list, subscriber gains or monetisation.</p>
<h2>What do Shorts views do?</h2>
<p>The view count is the first social proof signal a viewer sees when opening a video. Viewers behave differently toward a Short with a few hundred views than one with tens of thousands. On a new channel, crossing that threshold can make building an initial audience easier.</p>
<p>We explain how Shorts views connect to subscriber conversion, and which content structures work, in our <a href="/blog/youtube-shorts-izlenme-nasil-artirilir-abone-kazandiran-shorts-stratejisi-6186">Shorts strategy article</a>. For raising channel-wide watch time see the <a href="/blog/youtube-izlenme-suresi-artirmanin-yollari">watch time article</a>, and for title and description structure <a href="/blog/youtube-video-seo-baslik-etiket-aciklama">YouTube video SEO</a>.</p>
<h2>Using it with other YouTube services</h2>
<p>A Short with high views but no likes or comments looks unbalanced. Backing it with small like packages completes the picture: <a href="/youtube-begeni-satin-al">buy YouTube likes</a>. For long videos and live streams see <a href="/youtube-izlenme-satin-al">buy YouTube views</a>, and for the channel subscriber counter <a href="/youtube-abone-satin-al">buy YouTube subscribers</a>. The entry point to every service is the <a href="/youtube-smm-panel">YouTube panel</a>.</p>
<h2>A realistic note on the Partner Program</h2>
<p>YouTube's monetisation programme applies a separate Shorts threshold (a set number of Shorts views within 90 days). The services here raise the view counter; whether that <em>counts</em> toward a monetisation application is not promised, and YouTube may exclude traffic it deems invalid. We cover how the thresholds are actually crossed in our <a href="/blog/youtube-da-1000-abone-ve-4000-saat-izlenme-suresine-ulasma-rehberi-2890">1,000 subscribers and 4,000 hours guide</a>.</p>
<h2>Using it right</h2>
<p>Your video must be public; hidden and unlisted videos cannot receive delivery. Submit the full Shorts video URL. Avoid a view load out of proportion with your channel size: hundreds of thousands of views overnight on a Short from a 50-subscriber channel does not resemble a natural curve. Do not place a second order for the same video before the first completes.</p>
<h2>An honest note on guarantees</h2>
<blockquote>Refill cover varies by package; some are listed without a guarantee and drops are not compensated. Statements about source and speed are the provider's. YouTube may retroactively delete views it deems invalid; drops outside guarantee cover are not compensated. No outcome is promised regarding the Shorts feed, subscriber gains or monetisation.</blockquote>`,
    faq_tr: [
      { q: 'Shorts izlenmesi uzun video izlenmesinden farklı mı sipariş ediliyor?', a: 'Sipariş akışı aynıdır ancak servisler ayrılabilir: kataloğunda Shorts için ayrı servis varsa tabloda görünür. Sipariş sırasında Shorts videosunun tam adresini girmeniz gerekir.' },
      { q: 'Shorts izlenmesi abone kazandırır mı?', a: 'Böyle bir taahhüt verilmez. Görüntülenme sayacı yükselir; abone dönüşümü içeriğin kendisine, kanalın konusuna ve izleyicinin videoyu sonuna kadar izleyip izlemediğine bağlıdır.' },
      { q: 'Para kazanma eşiğine sayılır mı?', a: 'Taahhüt edilmez. YouTube iş ortaklığı değerlendirmesinde geçersiz saydığı trafiği hesaba katmayabilir. Eşiği aşmanın gerçekçi yolu içerik ve düzenli yayındır.' },
      { q: 'Ne kadar izlenme almalıyım?', a: 'Kanal boyutunuzla orantılı bir miktar önerilir. Az aboneli bir kanalın videosuna bir gecede çok yüksek izlenme gelmesi doğal bir eğriye benzemez; büyük hedefleri kademeli alın.' }
    ],
    faq_en: [
      { q: 'Is ordering Shorts views different from long video views?', a: 'The ordering flow is the same, but services may be separate: if the catalogue has a dedicated Shorts service it appears in the table. You must submit the full Shorts video URL.' },
      { q: 'Will Shorts views gain me subscribers?', a: 'No such promise is made. The view counter rises; subscriber conversion depends on the content itself, the channel topic and whether viewers watch to the end.' },
      { q: 'Does it count toward the monetisation threshold?', a: 'Not promised. YouTube may exclude traffic it deems invalid from the Partner Program assessment. The realistic route is content and consistent publishing.' },
      { q: 'How many views should I buy?', a: 'A quantity proportional to your channel size is advised. Very high views overnight on a video from a small channel does not resemble a natural curve; take large targets gradually.' }
    ],
    related_blog_slugs: ['youtube-shorts-izlenme-nasil-artirilir-abone-kazandiran-shorts-stratejisi-6186', 'youtube-izlenme-suresi-artirmanin-yollari', 'youtube-da-1000-abone-ve-4000-saat-izlenme-suresine-ulasma-rehberi-2890']
  })
];

module.exports = { PAGES };

if (require.main === module) {
  (async () => {
    const db = new sqlite3.Database(dbPath);
    db.configure('busyTimeout', 5000);
    const get = (q, prm = []) => new Promise((r, j) => db.get(q, prm, (e, row) => e ? j(e) : r(row)));
    const all = (q, prm = []) => new Promise((r, j) => db.all(q, prm, (e, rows) => e ? j(e) : r(rows)));
    const run = (q, prm = []) => new Promise((r, j) => db.run(q, prm, function (e) { e ? j(e) : r(this); }));

    const tablo = await get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'landing_pages'");
    if (!tablo) { console.error('landing_pages tablosu yok: once sunucuyu yeni kodla baslat.'); process.exit(1); }

    // Aktif servisi olan kategoriler (dijital seed'deki desen).
    const kategoriler = await all(`SELECT c.id, c.name, c.name_tr FROM categories c
      WHERE EXISTS (SELECT 1 FROM services s WHERE s.category_id = c.id AND s.status = 1)`).catch(() => []);

    // Kaynak satis sayfasinin kategorilerini devralma (yedek yontem).
    async function kaynaktanKategori(slugs) {
      const ids = [];
      for (const s of slugs || []) {
        const row = await get('SELECT category_ids FROM landing_pages WHERE slug = ?', [s]);
        if (!row) continue;
        try {
          const liste = JSON.parse(row.category_ids || '[]');
          if (Array.isArray(liste)) ids.push(...liste.filter(n => Number.isInteger(n) && n > 0));
        } catch { /* bozuk JSON: yok say */ }
      }
      return [...new Set(ids)].slice(0, 30);
    }

    let eklenen = 0, atlanan = 0;
    for (const ham of PAGES) {
      if (await get('SELECT id FROM landing_pages WHERE slug = ?', [ham.slug])) {
        console.log('atlandi (zaten var): ' + ham.slug); atlanan++; continue;
      }
      const { kategori_kalibi, _kaynak, ...sayfa } = ham;
      // Once kalip: kendi kategorisi varsa (or. Pinterest kaydetme) onu kullan.
      let ids = kategoriler.filter(c => kategori_kalibi.test(`${c.name_tr || ''} ${c.name || ''}`)).map(c => c.id).slice(0, 30);
      let kaynakAdi = 'kalip';
      if (!ids.length) { ids = await kaynaktanKategori(_kaynak); kaynakAdi = 'kaynak sayfa'; }
      if (!ids.length) {
        console.log('ATLANDI (kategori yok): ' + sayfa.slug + ' — ' + kategori_kalibi + ' kalibina uyan aktif servisli kategori de, kaynak sayfa da bulunamadi.');
        atlanan++; continue;
      }
      const sonuc = normalizePagePayload({ ...sayfa, category_ids: ids });
      if (sonuc.error) { console.error('HATA ' + sayfa.slug + ': ' + sonuc.error); continue; }
      const cols = Object.keys(sonuc.fields);
      await run('INSERT INTO landing_pages (' + cols.join(', ') + ', updated_at) VALUES ('
        + cols.map(() => '?').join(', ') + ', CURRENT_TIMESTAMP)', cols.map(c => sonuc.fields[c]));
      console.log('olusturuldu (taslak, ' + kaynakAdi + ': ' + ids.length + ' kategori): ' + sonuc.fields.slug);
      eklenen++;
    }
    db.close();
    console.log('Bitti: ' + eklenen + ' sayfa olusturuldu, ' + atlanan + ' atlandi.');
    console.log('Sayfalar TASLAK durumda. Yayina almak icin:');
    console.log('  node scripts/publish-landing-pages.js pinterest-kaydetme-satin-al');
  })().catch(err => { console.error(err); process.exit(1); });
}
