'use strict';

// KOPRU (HUB) SATIS SAYFALARI — 5 adet, 20 Eyl 2026
// Kelime dayanagi ve kapsam analizi: SEO-ANALIZ-2026-09-20.md
//
// AMAC: Bu bes sayfa yalnizca kendi kelimelerini hedeflemez; ayni zamanda
// DIZINE GIRMEYEN satis sayfalarina govde metni icinden baglam linki tasir.
// Search Console'a gore 36 gun boyunca tek gosterim almayan sayfalar sunlar
// ve her biri asagidaki kopru sayfalarindan link alir:
//
//   instagram-takipci-satin-al ......... ucuz-smm-panel, turk-takipci-satin-al
//   instagram-begeni-satin-al .......... ucuz-smm-panel, sosyal-medya-etkilesim-paketi
//   instagram-yorum-satin-al ........... sosyal-medya-etkilesim-paketi
//   instagram-kaydetme-satin-al ........ sosyal-medya-etkilesim-paketi
//   instagram-canli-yayin-izleyici ..... canli-yayin-izleyici-satin-al
//   instagram-hikaye-izlenme-satin-al .. sosyal-medya-etkilesim-paketi
//   tiktok-izlenme-satin-al ............ ucuz-smm-panel
//   youtube-izlenme-satin-al ........... ucuz-smm-panel
//   telegram-uye-satin-al .............. ucuz-smm-panel, turk-takipci-satin-al
//   spotify-dinlenme-satin-al .......... muzik-dinlenme-satin-al
//   soundcloud-dinlenme-satin-al ....... muzik-dinlenme-satin-al
//   kick-takipci-satin-al .............. canli-yayin-izleyici-satin-al
//
// KELIME DAYANAGI (GSC, 13 Agu - 17 Eyl):
//   ucuz-smm-panel ............. "panel sitesi" (11 gos, poz 6.18), "smm panel"
//                                (2, poz 8.0), "medya panel" (2, poz 4.0), "smm" (5)
//   turk-takipci-satin-al ...... "2000 twitter turk takipci satin al" (poz 85),
//                                "50000 twitter takipci satin al" (4) — miktar+TR
//                                modifier'lari hic karsilanmiyor
//   canli-yayin-izleyici ....... twitch-izleyici sayfasi 1 tiklama aldi (poz 8.0);
//                                kategori talebi var, catı sayfa yok
//   muzik-dinlenme-satin-al .... spotify ve soundcloud sayfalari dizine girmedi
//   sosyal-medya-etkilesim ..... "begeni paneli" (poz 74), "instagram hikaye
//                                izlenme arttirma" (8 gos, poz 58-64)
//
// ICERIK KURALI (8 Eyl 2026 revizyonundan devam):
//   - SEO sonucu, siralama, onerilenlere girme, para kazanma GARANTISI yok.
//   - Saglayicinin teknik beyani ile bizim cumlemiz ayrilir.
//   - "Yenileme Yok / Garantisiz / Iptal Aktif" etiketleri gizlenmez.
//   - Fiyat/limit degerleri govdede tekrarlanmaz; canli tablodan gelir.
//
// KATEGORILER: Elle ID yazilmaz; kaynak satis sayfalarinin category_ids
// alanlari DB'den okunup birlestirilir (_kaynak alani).
//
// Kullanim: cd /var/www/smmjet && node scripts/seed-landing-pages-kopru.js
// Var olan slug'lara DOKUNMAZ; sayfalar TASLAK olarak olusur.
// NOT: twitter-smm-panel sayfasi /turk-takipci-satin-al adresine link verir,
// bu yuzden panel-hub betigiyle birlikte calistirilmasi onerilir.

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
  // EN GENIS KOPRU. Hedef: "ucuz smm panel", "panel sitesi", "smm panel",
  // "sosyal medya paneli", "medya panel". Butun platform hub'larina ve en
  // onemli satis sayfalarina link tasir.
  page({
    slug: 'ucuz-smm-panel', platform_key: 'social-media', sort_order: 64,
    _kaynak: ['instagram-takipci-satin-al', 'tiktok-takipci-satin-al', 'tiktok-izlenme-satin-al', 'youtube-izlenme-satin-al', 'telegram-uye-satin-al'],
    title_tr: 'Ucuz SMM Panel', title_en: 'Cheap SMM Panel',
    subtitle_tr: 'Ucuz olmak ile güvenilir olmak arasındaki farkı anlatan, fiyatın gerçekte neye göre belirlendiğini gösteren bir sayfa. Tüm platformların servisleri tek panelde, şeffaf birim fiyatla.',
    subtitle_en: 'A page that explains the difference between cheap and trustworthy, and shows what actually sets the price. Every platform in one panel, with transparent unit pricing.',
    seo_title_tr: 'Ucuz SMM Panel – Fiyat Nasıl Belirlenir, Neye Dikkat Edilir?',
    seo_title_en: 'Cheap SMM Panel – How Pricing Works and What to Watch For',
    seo_description_tr: 'Ucuz SMM panel arıyorsanız fiyatın neye göre belirlendiğini bilin: kaynak kalitesi, yenileme garantisi, teslimat hızı. Şeffaf birim fiyat, şifresiz sipariş.',
    seo_description_en: 'Looking for a cheap SMM panel? First learn what sets the price: source quality, refill cover and delivery speed. Transparent unit pricing, no password required.',
    content_tr: `<h2>"Ucuz panel" ararken gerçekte ne aranıyor?</h2>
<p>Bu kelimeyi arayan çoğu kullanıcı en düşük rakamı değil, <strong>ödediğinin karşılığını alacağı en düşük rakamı</strong> arıyor. Aradaki fark önemlidir: bin takipçiyi piyasanın yarı fiyatına veren bir servis, takipçilerin üç hafta içinde silinmesi hâlinde aslında iki katına mal olmuştur. Bu sayfada fiyatın neye göre oluştuğunu açıkça yazıyoruz ki karşılaştırmayı doğru yapabilesiniz.</p>
<h2>Fiyatı belirleyen üç şey</h2>
<ul>
<li><strong>Kaynak kalitesi.</strong> Gönderisi, profil fotoğrafı ve geçmişi olan hesaplardan gelen takipçi, boş hesaplardan gelene göre pahalıdır. Ucuz paketlerin büyük kısmı ikinci gruptandır; sayaç aynı görünür, dayanıklılık farklıdır.</li>
<li><strong>Yenileme (refill) garantisi.</strong> 30 gün yenileme etiketi taşıyan bir servis, sağlayıcının düşüş riskini üstlendiği anlamına gelir ve fiyata yansır. Katalogda "Yenileme Yok" etiketiyle listelenen paketler daha ucuzdur; bunu gizlemiyoruz, kartta açıkça yazar.</li>
<li><strong>Teslimat hızı ve kontrolü.</strong> Anında başlayan veya kademeli (drip-feed) teslim edilen servisler, sıraya girip günler içinde tamamlananlardan farklı fiyatlanır.</li>
</ul>
<h2>Ucuz panelde nelere dikkat etmeli?</h2>
<p>Şifre isteyen hiçbir siteyi kullanmayın; takipçi veya beğeni göndermek için şifre gerekmez, isteyen site hesabınızı hedefliyordur. Bu, listedeki tek gerçek "hesap kaybettiren" risktir ve fiyattan bağımsızdır. Konuyu <a href="/blog/takipci-satin-almak-guvenli-mi">takipçi satın almak güvenli mi</a> yazısında ayrıntılı ele aldık; şifresiz sipariş mantığı ise <a href="/blog/sifresiz-takipci-nasil-alinir">şifresiz takipçi nasıl alınır</a> yazısındadır.</p>
<p>İkinci dikkat noktası ödeme tarafıdır. Kart bilgisinin panelde saklanmadığı, ödemenin lisanslı bir kuruluşun sayfasında alındığı sistemlerde risk, bankada kart kullanmaktan farklı değildir. Ayrıntı için <a href="/blog/smm-panel-odeme-guvenligi-rehberi">ödeme güvenliği rehberi</a>.</p>
<h2>Panelimizdeki hizmetler</h2>
<p>Bütün platformların servisleri aynı bakiyeden sipariş edilir. Platform bazında giriş noktaları: <a href="/instagram-smm-panel">Instagram paneli</a>, <a href="/tiktok-smm-panel">TikTok paneli</a>, <a href="/youtube-smm-panel">YouTube paneli</a> ve <a href="/twitter-smm-panel">Twitter (X) paneli</a>. En çok tercih edilen tekil hizmetler ise <a href="/instagram-takipci-satin-al">Instagram takipçi</a>, <a href="/instagram-begeni-satin-al">Instagram beğeni</a>, <a href="/tiktok-izlenme-satin-al">TikTok izlenme</a>, <a href="/youtube-izlenme-satin-al">YouTube izlenme</a> ve <a href="/telegram-uye-satin-al">Telegram üye</a> sayfalarında ayrıntılı anlatılır. Türk kitleye hitap ediyorsanız <a href="/turk-takipci-satin-al">Türk takipçi satın al</a> sayfasındaki kaynak ülkesi açıklaması işinize yarar. Tüm sayfaların listesi <a href="/hizmet-sayfalari">hizmet sayfaları</a> bölümündedir.</p>
<h2>Fiyatı nasıl karşılaştırmalı?</h2>
<p>Tablodaki fiyatlar 1000 adet için geçerli birim fiyattır; 250 adetlik bir sipariş bu tutarın dörtte biridir. Karşılaştırma yaparken yalnızca rakama değil, aynı satırdaki <strong>garanti etiketine ve min/max aralığına</strong> da bakın. Aynı platformda iki servis arasındaki fiyat farkı neredeyse her zaman bu iki sütundan kaynaklanır. Güncel bütün fiyatlar <a href="/services">hizmet ve fiyat listesi</a> sayfasındadır.</p>
<h2>Dürüst uyarı</h2>
<blockquote>Bu sayfa bir fiyat vaadi değildir. Panelimizdeki bazı servisler piyasanın altında, bazıları üstündedir; hangisinin hangi koşulla geldiği hizmet kartında yazar. Satın alınan hiçbir hizmet arama sıralaması, keşfete çıkma, önerilenlere girme veya para kazanma sonucu taahhüt etmez. "Gerçek kullanıcı" ve "düşüş yok" ifadeleri sağlayıcının beyanıdır; garanti kapsamı dışındaki düşüşlerde telafi yapılmaz.</blockquote>`,
    content_en: `<h2>What are people actually looking for with "cheap panel"?</h2>
<p>Most users searching this term are not after the lowest number but <strong>the lowest number that still delivers what they paid for</strong>. The distinction matters: a service selling a thousand followers at half the market rate has actually cost double if those followers disappear within three weeks. This page states openly how pricing is formed so you can compare properly.</p>
<h2>Three things that set the price</h2>
<ul>
<li><strong>Source quality.</strong> Followers from accounts with posts, a profile picture and history cost more than those from empty accounts. Most cheap packages come from the second group; the counter looks the same, the durability does not.</li>
<li><strong>Refill cover.</strong> A service carrying a 30-day refill tag means the provider is absorbing the drop risk, and that shows in the price. Packages listed with a "No Refill" tag are cheaper; we do not hide this — it is written on the card.</li>
<li><strong>Delivery speed and control.</strong> Services that start instantly or deliver gradually (drip-feed) are priced differently from those that queue and complete over days.</li>
</ul>
<h2>What to watch for in a cheap panel</h2>
<p>Never use a site that asks for your password; sending followers or likes does not require one, and a site that asks is targeting your account. This is the only genuine "account-losing" risk on the list and it is independent of price. We covered it in <a href="/blog/takipci-satin-almak-guvenli-mi">is buying followers safe</a>; the no-password model is explained in <a href="/blog/sifresiz-takipci-nasil-alinir">how to buy followers without a password</a>.</p>
<p>The second point is payment. Where card details are not stored in the panel and payment is taken on a licensed provider's page, the risk is no different from using your card at a bank. See <a href="/blog/smm-panel-odeme-guvenligi-rehberi">the payment security guide</a>.</p>
<h2>Services in our panel</h2>
<p>Every platform is ordered from the same balance. Per-platform entry points: <a href="/instagram-smm-panel">Instagram panel</a>, <a href="/tiktok-smm-panel">TikTok panel</a>, <a href="/youtube-smm-panel">YouTube panel</a> and <a href="/twitter-smm-panel">Twitter (X) panel</a>. The most-chosen individual services are detailed on <a href="/instagram-takipci-satin-al">Instagram followers</a>, <a href="/instagram-begeni-satin-al">Instagram likes</a>, <a href="/tiktok-izlenme-satin-al">TikTok views</a>, <a href="/youtube-izlenme-satin-al">YouTube views</a> and <a href="/telegram-uye-satin-al">Telegram members</a>. If you address a Turkish audience, the source-country explanation on <a href="/turk-takipci-satin-al">buy Turkish followers</a> will help. A full list is in the <a href="/hizmet-sayfalari">service pages</a> section.</p>
<h2>How to compare prices</h2>
<p>Prices in the table are the unit price for 1,000; an order of 250 costs a quarter of that. When comparing, look not only at the number but at the <strong>guarantee tag and the min/max range</strong> on the same row. The price gap between two services on the same platform almost always comes from those two columns. All current prices are on the <a href="/services">service and price list</a> page.</p>
<h2>An honest note</h2>
<blockquote>This page is not a price promise. Some services in our panel sit below the market and some above; which comes with which terms is written on the service card. No purchased service promises an outcome in search ranking, Explore, the suggested feed or monetisation. "Real users" and "no drop" are the provider's statements; drops outside guarantee cover are not compensated.</blockquote>`,
    faq_tr: [
      { q: 'En ucuz paket neden her zaman en iyisi değil?', a: 'Fiyat farkı genellikle kaynak kalitesinden ve yenileme garantisinden gelir. Garantisiz bir pakette düşüş yaşanırsa telafi yapılmaz; bu durumda ucuz paket ikinci siparişle birlikte daha pahalıya gelebilir. Karşılaştırmayı fiyat ve garanti etiketine birlikte bakarak yapın.' },
      { q: 'Fiyatlar tabloda neye göre yazıyor?', a: '1000 adet için geçerli birim fiyat olarak. Daha küçük siparişlerde tutar orantılı hesaplanır; her servisin kabul ettiği en küçük ve en büyük miktar min/max sütununda yazar.' },
      { q: 'Ucuz panelde şifre istenir mi?', a: 'Bizde hiçbir hizmette istenmez, yalnızca herkese açık bağlantı yeterlidir. Şifre isteyen siteleri fiyatı ne olursa olsun kullanmayın.' },
      { q: 'Bayi (toplu) fiyatı var mı?', a: 'Düzenli ve yüksek hacimli sipariş veren kullanıcılar için bayi fiyatlandırması ayrıca değerlendirilir; API erişimi de aynı kapsamdadır.' }
    ],
    faq_en: [
      { q: 'Why is the cheapest package not always the best?', a: 'The price gap usually comes from source quality and refill cover. On a package without a guarantee, drops are not compensated, so a cheap package can end up costing more once you place a second order. Compare price and guarantee tag together.' },
      { q: 'What do the prices in the table refer to?', a: 'The unit price for 1,000 units. Smaller orders are calculated proportionally; each service’s minimum and maximum are in the min/max column.' },
      { q: 'Does a cheap panel ask for a password?', a: 'Ours never does for any service — only a public link is needed. Do not use sites that ask for your password, whatever the price.' },
      { q: 'Is there reseller (bulk) pricing?', a: 'Reseller pricing is assessed separately for users placing regular, high-volume orders; API access falls under the same arrangement.' }
    ],
    related_blog_slugs: ['takipci-satin-almak-guvenli-mi', 'smm-panel-nedir-nasil-kullanilir', 'smm-panel-odeme-guvenligi-rehberi']
  }),

  // ---------------------------------------------------------------- 2
  // Hedef: "turk takipci satin al", "gercek turk takipci", "turk takipci
  // paneli" + GSC'deki miktar modifier'lari ("2000 turk takipci", "50000...").
  page({
    slug: 'turk-takipci-satin-al', platform_key: 'social-media', sort_order: 65,
    _kaynak: ['instagram-takipci-satin-al', 'tiktok-takipci-satin-al', 'twitter-takipci-satin-al', 'youtube-abone-satin-al', 'telegram-uye-satin-al'],
    title_tr: 'Türk Takipçi Satın Al', title_en: 'Buy Turkish Followers',
    subtitle_tr: 'Türkiye kaynaklı takipçi paketleri: Instagram, TikTok, X ve Telegram için ülke filtresiyle ayrılmış servisler. Türk kitleye hitap eden hesaplarda kaynak ülkesi neden önemli, sayfada anlattık.',
    subtitle_en: 'Turkey-sourced follower packages for Instagram, TikTok, X and Telegram, isolated with the country filter. We explain why source country matters for Turkish-audience accounts.',
    seo_title_tr: 'Türk Takipçi Satın Al – Türkiye Kaynaklı Takipçi Paketleri',
    seo_title_en: 'Buy Turkish Followers – Turkey-Sourced Follower Packages',
    seo_description_tr: 'Türk takipçi satın al: Instagram, TikTok, X ve Telegram için Türkiye kaynaklı paketler. Kaynak ülkesinin etkileşim oranına etkisi ve doğru miktar seçimi.',
    seo_description_en: 'Buy Turkish followers for Instagram, TikTok, X and Telegram. How source country affects engagement rate and how to choose the right quantity, explained here.',
    content_tr: `<h2>Kaynak ülkesi neden önemli?</h2>
<p>Takipçinin hangi ülkeden geldiği, sayacın büyüklüğünden daha çok şey belirler. Türk kitleye Türkçe içerik üreten bir hesaba yurt dışı kaynaklı takipçi geldiğinde iki şey olur: <strong>etkileşim oranı düşer</strong>, çünkü gelen hesaplar içeriği anlamaz ve etkileşime girmez; ve <strong>istatistiklerdeki kitle dağılımı bozulur</strong>. Marka iş birliği görüşmelerinde ekran görüntüsü istenen ilk yer bu dağılımdır.</p>
<p>Buna karşılık içeriğiniz İngilizceyse veya uluslararası bir kitleye hitap ediyorsanız Türkiye kaynaklı takipçi ısrarı gereksizdir; orada küresel paketler daha uygundur. Karar ölçütü hesabın diliyle takipçinin ülkesinin uyuşmasıdır.</p>
<h2>Hangi platformlarda Türkiye kaynaklı seçenek var?</h2>
<ul>
<li><strong>Instagram:</strong> Ülke filtresinden Türkiye seçilerek ayrılabilir. Paket farkları ve yenileme koşulları <a href="/instagram-takipci-satin-al">Instagram takipçi satın al</a> sayfasındadır.</li>
<li><strong>TikTok:</strong> Takipçi ve etkileşim servisleri için <a href="/tiktok-takipci-satin-al">TikTok takipçi satın al</a>; platformun tüm hizmetleri <a href="/tiktok-smm-panel">TikTok panelinde</a>.</li>
<li><strong>X (Twitter):</strong> Miktar aralıkları geniştir; <a href="/twitter-takipci-satin-al">Twitter takipçi satın al</a> sayfasına bakın.</li>
<li><strong>YouTube:</strong> Abone tarafı için <a href="/youtube-abone-satin-al">YouTube abone satın al</a>.</li>
<li><strong>Telegram:</strong> Kanal ve grup üyeliği için <a href="/telegram-uye-satin-al">Telegram üye satın al</a>.</li>
</ul>
<h2>Ne kadar almalı? Miktar seçimi</h2>
<p>En sık yapılan hata, mevcut takipçi sayısıyla orantısız bir paketi tek seferde yüklemektir. 900 takipçili bir hesaba bir gecede 15.000 takipçi geldiğinde etkileşim oranı çöker ve düşüş riski artar. Pratik ölçü şudur: <strong>tek seferde mevcut takipçinizin %10-20'sini aşmayın</strong>, büyük hedefleri birkaç güne yayın. 2.000 veya 50.000 gibi büyük paketleri tek siparişte değil, kademeli olarak almak hem daha dengeli görünür hem de düşüş yaşanırsa zararı sınırlar.</p>
<p>Oranın nasıl hesaplandığını ve hangi aralığın normal sayıldığını <a href="/blog/sosyal-medya-etkilesim-orani-hesaplama-rehberi">etkileşim oranı hesaplama rehberinde</a> anlattık. Düşüş yaşarsanız nedenleri ve yapılacaklar <a href="/blog/instagram-takipci-dususu-nedenleri-ve-cozumleri">takipçi düşüşü yazısındadır</a>.</p>
<h2>"Gerçek Türk takipçi" ifadesi ne anlama geliyor?</h2>
<p>Katalogda bazı servisler "gerçek" veya "%100 Türk" ibaresiyle listelenir. Bu ifadeler <strong>sağlayıcının beyanıdır</strong>; biz bunları kendi taahhüdümüz gibi sunmuyoruz. Pratikte fark, hesapların gönderi ve profil geçmişi olup olmamasındadır. Gönderili gerçek hesaplardan gelen paketler daha pahalıdır ve genellikle yenileme etiketi taşır. Hangi servisin hangi nitelikte olduğu aşağıdaki tabloda her kartta yazar.</p>
<h2>Dürüst uyarı</h2>
<blockquote>Takipçinin ülkesi sağlayıcı tarafından belirtilir ve panel bu bilgiyi doğrudan aktarır; kaynak dağılımının tamamının Türkiye olacağı bizim tarafımızdan garanti edilmez. Yenileme kapsamı pakete göre değişir, garantisiz listelenen paketlerde düşüş telafi edilmez. Takipçi satın almak erişim artışı, keşfete çıkma veya marka iş birliği sonucu taahhüt etmez.</blockquote>`,
    content_en: `<h2>Why does source country matter?</h2>
<p>Where a follower comes from determines more than the size of the counter. When an account producing Turkish content for a Turkish audience receives followers from abroad, two things happen: <strong>the engagement rate falls</strong>, because those accounts do not understand the content and do not engage; and <strong>the audience breakdown in your statistics is skewed</strong>. That breakdown is the first screenshot requested in brand collaboration talks.</p>
<p>Conversely, if your content is in English or addresses an international audience, insisting on Turkey-sourced followers is unnecessary — global packages fit better there. The deciding test is whether the account's language matches the followers' country.</p>
<h2>Which platforms offer a Turkey-sourced option?</h2>
<ul>
<li><strong>Instagram:</strong> isolate it by selecting Turkey in the country filter. Package differences and refill terms are on <a href="/instagram-takipci-satin-al">buy Instagram followers</a>.</li>
<li><strong>TikTok:</strong> for followers and engagement see <a href="/tiktok-takipci-satin-al">buy TikTok followers</a>; all platform services are in the <a href="/tiktok-smm-panel">TikTok panel</a>.</li>
<li><strong>X (Twitter):</strong> quantity ranges are wide; see <a href="/twitter-takipci-satin-al">buy Twitter followers</a>.</li>
<li><strong>YouTube:</strong> for subscribers, <a href="/youtube-abone-satin-al">buy YouTube subscribers</a>.</li>
<li><strong>Telegram:</strong> for channel and group membership, <a href="/telegram-uye-satin-al">buy Telegram members</a>.</li>
</ul>
<h2>How many should you buy?</h2>
<p>The most common mistake is loading a package wildly out of proportion with your current count. When an account with 900 followers gains 15,000 overnight, the engagement rate collapses and drop risk rises. A practical rule: <strong>do not exceed 10-20% of your current followers in one go</strong>, and spread large targets over several days. Taking a 2,000 or 50,000 package gradually rather than in a single order both looks more balanced and limits the damage if drops occur.</p>
<p>We explain how the ratio is calculated and what range counts as normal in our <a href="/blog/sosyal-medya-etkilesim-orani-hesaplama-rehberi">engagement rate guide</a>. If you see drops, causes and remedies are in the <a href="/blog/instagram-takipci-dususu-nedenleri-ve-cozumleri">follower drop article</a>.</p>
<h2>What does "real Turkish followers" mean?</h2>
<p>Some services are listed with a "real" or "100% Turkish" label. These are <strong>the provider's statements</strong>; we do not present them as our own commitment. In practice the difference is whether the accounts have posting and profile history. Packages from real accounts with posts cost more and usually carry a refill tag. Which service has which quality is written on each card in the table below.</p>
<h2>An honest note</h2>
<blockquote>Follower country is stated by the provider and the panel passes that information on directly; we do not guarantee that the entire source distribution will be Turkey. Refill cover varies by package, and packages listed without a guarantee are not compensated for drops. Buying followers promises no outcome in reach, Explore or brand collaboration.</blockquote>`,
    faq_tr: [
      { q: 'Türk takipçi mi yabancı takipçi mi daha iyi?', a: 'Hesabınızın diline bağlı. Türkçe içerik üreten ve Türk kitleye hitap eden hesaplarda Türkiye kaynaklı paketler etkileşim oranını korur. İngilizce veya uluslararası içerikte küresel paketler daha uygundur.' },
      { q: '50.000 takipçiyi tek seferde alabilir miyim?', a: 'Teknik olarak servisin max limiti elverdiğince mümkündür, ancak önerilmez. Mevcut takipçinizin %10-20’sini aşan tek seferlik yüklemeler etkileşim oranını bozar ve düşüş riskini artırır; büyük hedefleri birkaç güne yayın.' },
      { q: '"%100 Türk" ifadesi garanti mi?', a: 'Hayır, sağlayıcının beyanıdır ve panel bu bilgiyi olduğu gibi aktarır. Kaynak dağılımının tamamının Türkiye olacağı bizim tarafımızdan garanti edilmez.' },
      { q: 'Hangi platformlarda Türkiye filtresi var?', a: 'Hizmet tablosundaki ülke filtresinden 🇹🇷 Türkiye seçeneğini işaretleyerek Türkiye kaynaklı servisleri ayırabilirsiniz; seçenek platforma ve kataloğun o anki içeriğine göre değişir.' }
    ],
    faq_en: [
      { q: 'Turkish or international followers — which is better?', a: 'It depends on your account’s language. For Turkish content addressing a Turkish audience, Turkey-sourced packages preserve the engagement rate. For English or international content, global packages fit better.' },
      { q: 'Can I buy 50,000 followers in one go?', a: 'Technically yes, as far as the service maximum allows, but it is not advised. One-off loads above 10-20% of your current followers distort the engagement rate and raise drop risk; spread large targets over several days.' },
      { q: 'Is "100% Turkish" a guarantee?', a: 'No, it is the provider’s statement and the panel passes it on as-is. We do not guarantee that the whole source distribution will be Turkey.' },
      { q: 'Which platforms have a Turkey filter?', a: 'Select 🇹🇷 Turkey in the country filter of the service table to isolate Turkey-sourced services; availability varies by platform and by the catalogue’s current contents.' }
    ],
    related_blog_slugs: ['sosyal-medya-etkilesim-orani-hesaplama-rehberi', 'instagram-takipci-dususu-nedenleri-ve-cozumleri', 'organik-buyume-vs-satin-alma-karsilastirmasi']
  }),

  // ---------------------------------------------------------------- 3
  // Cati sayfa: Twitch, Kick, TikTok ve Instagram canli yayin izleyici
  // sayfalarini toplar. twitch-izleyici-satin-al GSC'de 1 tiklama aldi
  // (poz 8.0) — kategoride talep var ama cati sayfa yoktu.
  page({
    slug: 'canli-yayin-izleyici-satin-al', platform_key: 'social-media', sort_order: 66,
    _kaynak: ['twitch-izleyici-satin-al', 'kick-takipci-satin-al', 'tiktok-canli-yayin-izleyici-satin-al', 'instagram-canli-yayin-izleyici-satin-al'],
    title_tr: 'Canlı Yayın İzleyici Satın Al', title_en: 'Buy Live Stream Viewers',
    subtitle_tr: 'Twitch, Kick, TikTok ve Instagram canlı yayınları için eşzamanlı izleyici paketleri. Yayın süresince sayaçta görünür; siparişin yayın başlamadan verilmesi gerekir.',
    subtitle_en: 'Concurrent viewer packages for Twitch, Kick, TikTok and Instagram live streams. Visible in the counter during the broadcast; the order must be placed before you go live.',
    seo_title_tr: 'Canlı Yayın İzleyici Satın Al – Twitch, Kick, TikTok ve Instagram',
    seo_title_en: 'Buy Live Stream Viewers – Twitch, Kick, TikTok and Instagram',
    seo_description_tr: 'Canlı yayın izleyici satın al: Twitch, Kick, TikTok ve Instagram yayınları için süreli eşzamanlı izleyici paketleri. Yayın öncesi sipariş, otomatik başlangıç.',
    seo_description_en: 'Buy live stream viewers for Twitch, Kick, TikTok and Instagram: timed concurrent viewer packages. Order before going live, automatic start.',
    content_tr: `<h2>Canlı yayın izleyici hizmeti nasıl çalışır?</h2>
<p>Canlı yayın izleyici paketleri, yayınınız açıkken izleyici sayacında görünen eşzamanlı izleyici sağlar. Diğer hizmetlerden iki önemli farkı vardır. Birincisi <strong>süre bazlıdır</strong>: paket 30, 60 veya 90 dakika gibi bir süre boyunca izleyiciyi sayaçta tutar, süre dolunca sayaç düşer — bu bir kusur değil, hizmetin doğasıdır. İkincisi <strong>zamanlama kritiktir</strong>: sipariş yayın başlamadan önce verilmelidir, çünkü sistemin izleyicileri yerleştirmesi birkaç dakika alır.</p>
<h2>Hangi platformda hangi sayfa?</h2>
<ul>
<li><strong>Twitch:</strong> Eşzamanlı izleyici ve bazı paketlerde otomatik sohbet seçeneği bulunur. Ayrıntılar <a href="/twitch-izleyici-satin-al">Twitch izleyici satın al</a> sayfasındadır.</li>
<li><strong>Kick:</strong> Yükselen yayın platformu; takipçi ve izleyici servisleri için <a href="/kick-takipci-satin-al">Kick takipçi satın al</a>.</li>
<li><strong>TikTok:</strong> Yayın süresince sayaçta görünen izleyici paketleri; <a href="/tiktok-canli-yayin-izleyici-satin-al">TikTok canlı yayın izleyici satın al</a>.</li>
<li><strong>Instagram:</strong> Canlı yayın izleyicisi için <a href="/instagram-canli-yayin-izleyici-satin-al">Instagram canlı yayın izleyici satın al</a>.</li>
</ul>
<h2>İzleyici sayısı neden önemli?</h2>
<p>Canlı yayın, sosyal kanıtın en doğrudan çalıştığı yerdir: bir yayına giren kullanıcı, izleyici sayısını görerek kalıp kalmayacağına saniyeler içinde karar verir. Üç izleyicili bir yayında kimse sohbete yazmaz; belirli bir eşiğin üzerinde ise etkileşim kendiliğinden başlar. Sosyal kanıtın satın alma ve katılım davranışına etkisini <a href="/blog/sosyal-kanit-nedir-satisa-etkisi">sosyal kanıt yazımızda</a> ele aldık.</p>
<p>Twitch tarafında büyüme stratejisi ve takipçi-izleyici dengesini <a href="/blog/twitch-takipci-ve-izleyici-artirma-rehberi">Twitch rehberimizde</a>, TikTok canlı yayın açma şartlarını ise <a href="/blog/tiktok-canli-yayin-acma-sartlari-ve-buyume">TikTok canlı yayın yazısında</a> bulabilirsiniz.</p>
<h2>Yayın öncesi kontrol listesi</h2>
<ul>
<li>Yayın hesabının ve kanalın herkese açık olduğundan emin olun.</li>
<li>Siparişi yayına başlamadan <strong>birkaç dakika önce</strong> verin; sistem izleyicileri yerleştirirken yayının açık olması gerekir.</li>
<li>Paket süresini yayın planınıza göre seçin: iki saatlik bir yayına 30 dakikalık paket almak, izleyici sayısının yayının ortasında düşmesi anlamına gelir.</li>
<li>Sohbet etkileşimi beklemeyin: izleyici paketleri sayaçta görünür, sohbete yazmaları taahhüt edilmez (otomatik sohbet içeren paketler kartta ayrıca belirtilir).</li>
</ul>
<h2>Dürüst uyarı</h2>
<blockquote>İzleyici paketleri süre bazlıdır ve süre dolduğunda sayaç düşer; bu bir düşüş değil, hizmetin kapsamının bitmesidir ve telafi edilmez. Yayın sırasında bağlantınız koparsa veya yayını erken kapatırsanız kalan süre iade edilmez. Platformların iş ortaklığı programlarında (Twitch Affiliate/Partner gibi) sayılan izleyici ölçütleri için bu hizmetler bir sonuç taahhüt etmez; platformlar geçersiz saydıkları izleyiciyi hesaba katmayabilir.</blockquote>`,
    content_en: `<h2>How do live viewer services work?</h2>
<p>Live viewer packages supply concurrent viewers visible in the counter while your stream is on. They differ from other services in two important ways. First they are <strong>duration-based</strong>: a package holds viewers in the counter for something like 30, 60 or 90 minutes, and the counter falls when the time is up — that is the nature of the service, not a fault. Second, <strong>timing is critical</strong>: the order must be placed before the stream starts, because placing viewers takes a few minutes.</p>
<h2>Which page for which platform?</h2>
<ul>
<li><strong>Twitch:</strong> concurrent viewers, with an auto-chat option on some packages. Details on <a href="/twitch-izleyici-satin-al">buy Twitch viewers</a>.</li>
<li><strong>Kick:</strong> the rising streaming platform; for follower and viewer services see <a href="/kick-takipci-satin-al">buy Kick followers</a>.</li>
<li><strong>TikTok:</strong> viewer packages visible in the counter during a broadcast; <a href="/tiktok-canli-yayin-izleyici-satin-al">buy TikTok live viewers</a>.</li>
<li><strong>Instagram:</strong> for live viewers, <a href="/instagram-canli-yayin-izleyici-satin-al">buy Instagram live viewers</a>.</li>
</ul>
<h2>Why does viewer count matter?</h2>
<p>Live streaming is where social proof works most directly: a user entering a stream decides within seconds whether to stay, based on the viewer count. Nobody types in a chat with three viewers; above a certain threshold, engagement starts on its own. We covered how social proof affects purchase and participation behaviour in our <a href="/blog/sosyal-kanit-nedir-satisa-etkisi">social proof article</a>.</p>
<p>For Twitch growth strategy and the follower-viewer balance, see our <a href="/blog/twitch-takipci-ve-izleyici-artirma-rehberi">Twitch guide</a>; for TikTok live requirements, the <a href="/blog/tiktok-canli-yayin-acma-sartlari-ve-buyume">TikTok live article</a>.</p>
<h2>Pre-stream checklist</h2>
<ul>
<li>Make sure the streaming account and channel are public.</li>
<li>Place the order <strong>a few minutes before</strong> going live; the stream needs to be on while the system places viewers.</li>
<li>Match the package duration to your plan: buying a 30-minute package for a two-hour stream means the count drops mid-broadcast.</li>
<li>Do not expect chat activity: viewer packages appear in the counter, and writing in chat is not promised (packages including auto-chat state so on the card).</li>
</ul>
<h2>An honest note</h2>
<blockquote>Viewer packages are duration-based and the counter falls when time is up; that is the end of cover, not a drop, and it is not compensated. If your connection fails or you end the stream early, remaining time is not refunded. These services promise no outcome for viewer criteria counted in platform partner programmes (such as Twitch Affiliate/Partner); platforms may exclude viewers they deem invalid.</blockquote>`,
    faq_tr: [
      { q: 'Siparişi ne zaman vermeliyim?', a: 'Yayına başlamadan birkaç dakika önce. Sistem izleyicileri yerleştirirken yayının açık olması gerekir; yayın kapalıyken verilen sipariş işleme alınamaz.' },
      { q: 'İzleyiciler sohbete yazar mı?', a: 'Standart paketlerde hayır; izleyiciler yalnızca sayaçta görünür. Otomatik sohbet içeren paketler hizmet kartında ayrıca belirtilir.' },
      { q: 'Süre bitince izleyiciler neden düşüyor?', a: 'Paket süre bazlıdır: satın aldığınız süre boyunca izleyici sayaçta tutulur, süre dolunca kapsam biter. Bu bir düşüş sayılmaz ve telafi edilmez; paket süresini yayın planınıza göre seçin.' },
      { q: 'Yayını erken kapatırsam kalan süre iade edilir mi?', a: 'Hayır. Bağlantı kopması veya yayının erken kapatılması durumunda kalan süre iade edilmez.' }
    ],
    faq_en: [
      { q: 'When should I place the order?', a: 'A few minutes before going live. The stream must be on while the system places viewers; an order placed while offline cannot be processed.' },
      { q: 'Will the viewers write in chat?', a: 'Not on standard packages; viewers only appear in the counter. Packages that include auto-chat state so on the service card.' },
      { q: 'Why do viewers drop when the time ends?', a: 'The package is duration-based: viewers are held in the counter for the time purchased, and cover ends when it expires. That is not counted as a drop and is not compensated; match the duration to your plan.' },
      { q: 'Is remaining time refunded if I end the stream early?', a: 'No. Remaining time is not refunded if your connection fails or you end the stream early.' }
    ],
    related_blog_slugs: ['twitch-takipci-ve-izleyici-artirma-rehberi', 'tiktok-canli-yayin-acma-sartlari-ve-buyume', 'sosyal-kanit-nedir-satisa-etkisi']
  }),

  // ---------------------------------------------------------------- 4
  // Cati sayfa: Spotify + SoundCloud. Iki sayfa da dizine girmedi; bu cati
  // ikisini birden besler ve "muzik dinlenme / sarki dinlenme" kumesini hedefler.
  page({
    slug: 'muzik-dinlenme-satin-al', platform_key: 'spotify', sort_order: 67,
    _kaynak: ['spotify-dinlenme-satin-al', 'soundcloud-dinlenme-satin-al'],
    title_tr: 'Müzik Dinlenme Satın Al', title_en: 'Buy Music Plays',
    subtitle_tr: 'Spotify ve SoundCloud için dinlenme, takipçi ve çalma listesi paketleri. Bağımsız müzisyenler ve prodüktörler için kaynak, hız ve telif tarafında bilinmesi gerekenler.',
    subtitle_en: 'Play, follower and playlist packages for Spotify and SoundCloud. What independent artists and producers need to know about source, speed and royalties.',
    seo_title_tr: 'Müzik Dinlenme Satın Al – Spotify ve SoundCloud Paketleri',
    seo_title_en: 'Buy Music Plays – Spotify and SoundCloud Packages',
    seo_description_tr: 'Müzik dinlenme satın al: Spotify ve SoundCloud için dinlenme, takipçi ve çalma listesi paketleri. Kaynak kalitesi, hız ve telif konusunda dürüst bilgi.',
    seo_description_en: 'Buy music plays: streams, followers and playlist packages for Spotify and SoundCloud, with honest detail on source quality, delivery speed and royalties.',
    content_tr: `<h2>Bağımsız müzisyen için dinlenme sayısı ne anlama gelir?</h2>
<p>Bir şarkının dinlenme sayısı, platformlarda görünen en belirgin sosyal kanıt unsurudur. Yeni bir dinleyici, hiç duymadığı bir sanatçının şarkısını açıp açmamaya karar verirken çoğu zaman bu sayıya bakar; çalma listesi küratörleri ve mekan/etkinlik tarafı da ilk bakışta aynı rakamı görür. Bu sayfadaki paketler <strong>dinlenme sayacını</strong> yükseltir. Algoritmik çalma listelerine girme, editör listelerine seçilme veya telif geliri konusunda hiçbir sonuç taahhüt edilmez.</p>
<h2>Platformlar ve sayfalar</h2>
<ul>
<li><strong>Spotify:</strong> Şarkı dinlenmesi, sanatçı takipçisi ve çalma listesi takipçisi seçenekleri bulunur. Paket farkları ve teslimat hızı <a href="/spotify-dinlenme-satin-al">Spotify dinlenme satın al</a> sayfasındadır.</li>
<li><strong>SoundCloud:</strong> Dinlenme, beğeni ve repost seçenekleri için <a href="/soundcloud-dinlenme-satin-al">SoundCloud dinlenme satın al</a> sayfasına bakın.</li>
</ul>
<h2>Hız neden önemli: müzikte kademeli teslimat</h2>
<p>Müzik platformları, dinlenme davranışını diğer sosyal ağlardan daha yakından inceler. Yeni yayınlanmış bir şarkıya birkaç saat içinde on binlerce dinlenme gelmesi, doğal bir yayılma eğrisine benzemez. Bu yüzden müzik tarafında <strong>kademeli teslimat, hızlı teslimattan daha değerlidir</strong>: paketi günlere yaymak hem daha doğal bir eğri oluşturur hem de platformun geçersiz sayma riskini azaltır. Teslimat hızı seçeneği olan servislerde bu tercih hizmet kartında belirtilir.</p>
<p>Spotify tarafında organik dinlenme ile hızlı dinlenme arasındaki tercihi ve hangisinin ne zaman mantıklı olduğunu <a href="/blog/spotify-da-organik-mi-yoksa-hizli-dinlenme-mi-dogru-stratejiyi-secmek-msuzilds">Spotify strateji yazımızda</a> ayrıntılı tartıştık; çalma listesi kurgusu için <a href="/blog/spotify-dinlenme-artirma-ve-playlist-stratejisi">playlist stratejisi</a> yazısına bakın.</p>
<h2>Telif geliri konusunda net olalım</h2>
<p>Satın alınan dinlenmelerin telif ödemesine dönüşeceği <strong>taahhüt edilmez</strong>. Platformlar geçersiz saydıkları dinlenmeleri hesaplamaya katmaz ve geriye dönük olarak sayaçtan düşebilir. Bu hizmetleri gelir yöntemi olarak değil, yeni bir dinleyicinin şarkıyı açmasını kolaylaştıran görünürlük unsuru olarak değerlendirin.</p>
<h2>Dürüst uyarı</h2>
<blockquote>Müzik platformları etkileşim doğrulamasını sık yapar ve geçersiz saydığı dinlenmeleri geriye dönük silebilir; garanti kapsamı dışındaki düşüşlerde telafi yapılmaz. Kaynak kalitesine ilişkin ifadeler sağlayıcının beyanıdır. Editör listelerine girme, algoritmik önerilere dahil olma ve telif geliri konusunda hiçbir sonuç taahhüt edilmez. Şarkınızın ve profilinizin herkese açık olması gerekir.</blockquote>`,
    content_en: `<h2>What does a play count mean for an independent artist?</h2>
<p>A track's play count is the most visible social proof signal on streaming platforms. A new listener deciding whether to open a track by an unknown artist usually glances at that number, and playlist curators and venue bookers see the same figure first. The packages on this page raise the <strong>play counter</strong>. No outcome is promised regarding algorithmic playlists, editorial selection or royalty income.</p>
<h2>Platforms and pages</h2>
<ul>
<li><strong>Spotify:</strong> track plays, artist followers and playlist followers are available. Package differences and delivery speed are on <a href="/spotify-dinlenme-satin-al">buy Spotify plays</a>.</li>
<li><strong>SoundCloud:</strong> for plays, likes and reposts see <a href="/soundcloud-dinlenme-satin-al">buy SoundCloud plays</a>.</li>
</ul>
<h2>Why speed matters: gradual delivery in music</h2>
<p>Music platforms scrutinise listening behaviour more closely than other social networks. Tens of thousands of plays arriving within hours of a release does not resemble a natural growth curve. On the music side, therefore, <strong>gradual delivery is worth more than fast delivery</strong>: spreading a package over days produces a more natural curve and lowers the risk of the platform invalidating it. Where a service offers a speed option, it is stated on the card.</p>
<p>We discussed the choice between organic and fast plays on Spotify, and when each makes sense, in our <a href="/blog/spotify-da-organik-mi-yoksa-hizli-dinlenme-mi-dogru-stratejiyi-secmek-msuzilds">Spotify strategy article</a>; for playlist construction see <a href="/blog/spotify-dinlenme-artirma-ve-playlist-stratejisi">playlist strategy</a>.</p>
<h2>Being clear about royalties</h2>
<p>Turning purchased plays into royalty payments is <strong>not promised</strong>. Platforms exclude plays they deem invalid and may remove them from the counter retroactively. Treat these services not as an income method but as a visibility signal that makes it easier for a new listener to press play.</p>
<h2>An honest note</h2>
<blockquote>Music platforms validate engagement frequently and may retroactively delete plays they deem invalid; drops outside guarantee cover are not compensated. Statements about source quality are the provider's. No outcome is promised regarding editorial playlists, algorithmic recommendations or royalty income. Your track and profile must be public.</blockquote>`,
    faq_tr: [
      { q: 'Satın alınan dinlenmeler telif geliri getirir mi?', a: 'Böyle bir taahhüt verilmez. Platformlar geçersiz saydıkları dinlenmeleri hesaplamaya katmaz ve geriye dönük silebilir. Bu hizmetleri gelir yöntemi olarak değil görünürlük unsuru olarak değerlendirin.' },
      { q: 'Hızlı mı yoksa kademeli teslimat mı seçmeliyim?', a: 'Müzikte kademeli teslimat genellikle daha uygundur: doğal bir yayılma eğrisine benzer ve platformun geçersiz sayma riskini azaltır. Hız seçeneği olan servislerde tercih hizmet kartında belirtilir.' },
      { q: 'Spotify mı SoundCloud mu?', a: 'Hedef kitlenize bağlı. Spotify daha geniş dinleyici kitlesi ve çalma listesi ekosistemi sunar; SoundCloud bağımsız prodüktörler ve erken sürüm paylaşımı için yaygındır. İkisi için de ayrı sayfalarımız var.' },
      { q: 'Şarkım yayında değilse sipariş verebilir miyim?', a: 'Hayır. Siparişten önce şarkının platformda yayında ve herkese açık olması, bağlantısının erişilebilir olması gerekir.' }
    ],
    faq_en: [
      { q: 'Do purchased plays generate royalties?', a: 'No such promise is made. Platforms exclude plays they deem invalid and may delete them retroactively. Treat these services as a visibility signal, not an income method.' },
      { q: 'Should I choose fast or gradual delivery?', a: 'In music, gradual delivery is usually the better fit: it resembles a natural curve and lowers the risk of invalidation. Where a speed option exists, it is stated on the service card.' },
      { q: 'Spotify or SoundCloud?', a: 'It depends on your audience. Spotify offers a wider listener base and playlist ecosystem; SoundCloud is common among independent producers and for early releases. We have separate pages for both.' },
      { q: 'Can I order if my track is not released yet?', a: 'No. Before ordering, the track must be live and public on the platform with an accessible link.' }
    ],
    related_blog_slugs: ['spotify-da-organik-mi-yoksa-hizli-dinlenme-mi-dogru-stratejiyi-secmek-msuzilds', 'spotify-dinlenme-artirma-ve-playlist-stratejisi', 'organik-buyume-vs-satin-alma-karsilastirmasi']
  }),

  // ---------------------------------------------------------------- 5
  // Cati sayfa: begeni otesi etkilesim sayaclari (yorum, kaydetme, hikaye,
  // tepki). Dizine girmeyen instagram-yorum / instagram-kaydetme /
  // instagram-hikaye-izlenme sayfalarini besler.
  // Hedef kelime: "begeni paneli" (poz 74), "etkilesim satin al",
  // "instagram hikaye izlenme arttirma" (8 gos, poz 58-64).
  page({
    slug: 'sosyal-medya-etkilesim-paketi', platform_key: 'social-media', sort_order: 68,
    _kaynak: ['instagram-yorum-satin-al', 'instagram-kaydetme-satin-al', 'instagram-hikaye-izlenme-satin-al', 'instagram-begeni-satin-al', 'tiktok-yorum-satin-al'],
    title_tr: 'Sosyal Medya Etkileşim Paketi', title_en: 'Social Media Engagement Package',
    subtitle_tr: 'Beğeninin ötesindeki sayaçlar: yorum, kaydetme, paylaşım, hikaye görüntülenme ve emoji tepkileri. Etkileşim oranını dengeli tutmak isteyen hesaplar için birleşik rehber.',
    subtitle_en: 'The counters beyond likes: comments, saves, shares, story views and emoji reactions. A combined guide for accounts that want a balanced engagement rate.',
    seo_title_tr: 'Sosyal Medya Etkileşim Paketi – Yorum, Kaydetme ve Hikaye',
    seo_title_en: 'Social Media Engagement Package – Comments, Saves and Stories',
    seo_description_tr: 'Sosyal medya etkileşim paketi: yorum, kaydetme, paylaşım, hikaye görüntülenme ve emoji tepkisi servisleri tek sayfada. Etkileşim oranını dengeli tutmanın yolu.',
    seo_description_en: 'Social media engagement package: comments, saves, shares, story views and emoji reactions in one place, plus how to keep your engagement rate balanced.',
    content_tr: `<h2>Neden yalnızca beğeni yetmiyor?</h2>
<p>Takipçi ve beğeni, bir hesabın en görünür iki sayacıdır — ve tam bu yüzden en kolay fark edilen dengesizliği de onlar yaratır. 50.000 takipçisi olup gönderilerinde yalnızca beğeni bulunan, yorumu ve kaydetmesi olmayan bir hesap, dikkatli bir ziyaretçiye ya da marka ekibine tutarsız görünür. Etkileşim, birbirini tamamlayan birkaç sayaçtan oluşur; bu sayfa beğeninin ötesindeki sayaçları tek yerde toplar.</p>
<h2>Etkileşim sayaçları ve sayfaları</h2>
<ul>
<li><strong>Yorum:</strong> Sağlayıcı, yorumların gönderiyle ilgili yazıldığını ve emoji + metin içerdiğini belirtir. Instagram için <a href="/instagram-yorum-satin-al">Instagram yorum satın al</a>, TikTok için <a href="/tiktok-yorum-satin-al">TikTok yorum satın al</a>.</li>
<li><strong>Kaydetme ve paylaşım:</strong> Kullanıcının gönderiyi sakladığını veya paylaştığını gösteren sayaçlar. Bkz. <a href="/instagram-kaydetme-satin-al">Instagram kaydetme satın al</a>.</li>
<li><strong>Hikaye görüntülenme:</strong> 24 saatlik pencereyle sınırlıdır ve hikaye yayındayken sipariş edilmelidir. Bkz. <a href="/instagram-hikaye-izlenme-satin-al">Instagram hikaye izlenme satın al</a>.</li>
<li><strong>Beğeni:</strong> Temel sayaç; diğerleriyle dengeli tutulması önerilir. Bkz. <a href="/instagram-begeni-satin-al">Instagram beğeni satın al</a>.</li>
<li><strong>Emoji tepkileri:</strong> Telegram ve WhatsApp kanallarında gönderi altındaki tepki sayaçları; <a href="/telegram-goruntulenme-satin-al">Telegram görüntülenme</a> ve <a href="/whatsapp-kanal-uye-satin-al">WhatsApp kanal üyesi</a> sayfalarında ayrıntılıdır.</li>
</ul>
<h2>Dengeli bir etkileşim tablosu nasıl kurulur?</h2>
<p>Pratikte işe yarayan yaklaşım, tek bir sayacı zorlamak yerine oranı korumaktır. Bir gönderide beğeni sayısı yükselirken yorum ve kaydetme sıfırda kalıyorsa tablo doğal görünmez. Küçük hacimli yorum ve kaydetme paketleri bu boşluğu kapatır. Hangi oranların normal sayıldığını ve kendi oranınızı nasıl hesaplayacağınızı <a href="/blog/sosyal-medya-etkilesim-orani-hesaplama-rehberi">etkileşim oranı hesaplama rehberinde</a> adım adım anlattık.</p>
<p>Platform bazında bütün hizmetleri görmek isterseniz <a href="/instagram-smm-panel">Instagram paneli</a> ve <a href="/tiktok-smm-panel">TikTok paneli</a> sayfaları giriş noktasıdır. Etkileşimi satın almak yerine içerikle artırmanın yollarını karşılaştırmalı olarak <a href="/blog/organik-buyume-vs-satin-alma-karsilastirmasi">organik büyüme ile satın alma karşılaştırmasında</a> ele aldık.</p>
<h2>Sık yapılan hata: orantısız yorum</h2>
<p>200 beğenili bir gönderiye 150 yorum gelmesi, hiç yorum olmamasından daha dikkat çekicidir. Yorum paketlerini gönderinin beğeni hacmiyle orantılı tutun; pratikte yorum sayısının beğeninin küçük bir yüzdesi olması daha doğal görünür. Aynı şekilde hikaye görüntülenmesi, takipçi sayınızın çok üzerinde olmamalıdır.</p>
<h2>Dürüst uyarı</h2>
<blockquote>Yorum metinleri bu paketlerde sağlayıcı tarafından gönderiye göre yazılır; özel metin listesi iletme seçeneği yoktur ve yorumların içeriği üzerinde tam denetim verilmez. Yenileme kapsamı hizmete göre değişir, garantisiz listelenen paketlerde düşüş telafi edilmez. Etkileşim satın almak keşfete çıkma, erişim artışı veya marka iş birliği sonucu taahhüt etmez. Gerçek soruları yanıtlamayı ve topluluk yönetimini sürdürün; satın alınan etkileşim bunun yerine geçmez.</blockquote>`,
    content_en: `<h2>Why are likes alone not enough?</h2>
<p>Followers and likes are an account's two most visible counters — which is exactly why they produce the most noticeable imbalance. An account with 50,000 followers whose posts carry likes but no comments or saves looks inconsistent to an attentive visitor or a brand team. Engagement is made of several complementary counters; this page gathers the ones beyond likes in a single place.</p>
<h2>Engagement counters and their pages</h2>
<ul>
<li><strong>Comments:</strong> the provider states comments are written to relate to the post and contain emoji + text. For Instagram see <a href="/instagram-yorum-satin-al">buy Instagram comments</a>, for TikTok <a href="/tiktok-yorum-satin-al">buy TikTok comments</a>.</li>
<li><strong>Saves and shares:</strong> counters showing that a user saved or shared the post. See <a href="/instagram-kaydetme-satin-al">buy Instagram saves</a>.</li>
<li><strong>Story views:</strong> limited to the 24-hour window and must be ordered while the story is live. See <a href="/instagram-hikaye-izlenme-satin-al">buy Instagram story views</a>.</li>
<li><strong>Likes:</strong> the base counter, best kept balanced with the others. See <a href="/instagram-begeni-satin-al">buy Instagram likes</a>.</li>
<li><strong>Emoji reactions:</strong> reaction counters under posts in Telegram and WhatsApp channels; detailed on <a href="/telegram-goruntulenme-satin-al">Telegram views</a> and <a href="/whatsapp-kanal-uye-satin-al">WhatsApp channel members</a>.</li>
</ul>
<h2>How to build a balanced engagement picture</h2>
<p>The approach that works is preserving the ratio rather than forcing a single counter. If likes climb on a post while comments and saves stay at zero, the picture does not look natural. Small comment and save packages close that gap. We explain which ratios count as normal, and how to calculate your own, step by step in the <a href="/blog/sosyal-medya-etkilesim-orani-hesaplama-rehberi">engagement rate guide</a>.</p>
<p>To see all services per platform, the <a href="/instagram-smm-panel">Instagram panel</a> and <a href="/tiktok-smm-panel">TikTok panel</a> pages are the entry points. We compare raising engagement with content instead of buying it in <a href="/blog/organik-buyume-vs-satin-alma-karsilastirmasi">organic growth versus buying</a>.</p>
<h2>A common mistake: disproportionate comments</h2>
<p>A post with 200 likes and 150 comments draws more attention than one with none. Keep comment packages proportional to the post's like volume; in practice a comment count that is a small percentage of likes looks more natural. Likewise, story views should not sit far above your follower count.</p>
<h2>An honest note</h2>
<blockquote>In these packages comment texts are written by the provider based on the post; there is no custom text list option and no full control over comment content. Refill cover varies by service, and packages listed without a guarantee are not compensated for drops. Buying engagement promises no outcome in Explore, reach or brand collaboration. Keep answering genuine questions and managing your community; purchased engagement does not replace that.</blockquote>`,
    faq_tr: [
      { q: 'Yorumların içeriğini ben belirleyebilir miyim?', a: 'Bu paketlerde hayır. Yorum metinleri sağlayıcı tarafından gönderiye göre yazılır ve emoji + metin biçiminde gelir; özel metin listesi iletme seçeneği yoktur.' },
      { q: 'Kaç yorum almalıyım?', a: 'Gönderinin beğeni hacmiyle orantılı bir miktar önerilir. Yorum sayısının beğeninin küçük bir yüzdesi olması daha doğal görünür; 200 beğenili bir gönderiye 150 yorum gelmesi dikkat çeker.' },
      { q: 'Hikaye görüntülenme siparişini ne zaman vermeliyim?', a: 'Hikaye yayındayken. Hikayeler 24 saat sonra kalktığı için yayından kalkmış hikayeye teslimat yapılamaz.' },
      { q: 'Etkileşim satın almak keşfete çıkarır mı?', a: 'Hayır, böyle bir taahhüt verilmez. Bu hizmetler gönderi altındaki sayaçları yükseltir; dağıtım, erişim ve keşfet sonuçları içerik kalitesi dâhil birçok faktöre bağlıdır.' }
    ],
    faq_en: [
      { q: 'Can I supply my own comment texts?', a: 'Not in these packages. Comment texts are written by the provider based on the post and arrive as emoji + text; there is no custom text list option.' },
      { q: 'How many comments should I order?', a: 'A quantity proportional to the post’s like volume is advised. A comment count that is a small percentage of likes looks more natural; 150 comments on a post with 200 likes stands out.' },
      { q: 'When should I order story views?', a: 'While the story is live. Stories expire after 24 hours and delivery cannot be made to an expired story.' },
      { q: 'Will buying engagement get me on Explore?', a: 'No, no such promise is made. These services raise the counters under a post; distribution, reach and Explore outcomes depend on many factors including content quality.' }
    ],
    related_blog_slugs: ['sosyal-medya-etkilesim-orani-hesaplama-rehberi', 'organik-buyume-vs-satin-alma-karsilastirmasi', 'sosyal-kanit-nedir-satisa-etkisi']
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

    // Kopru sayfasinin kategorileri = kaynak satis sayfalarinin birlesimi.
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
      return [...new Set(ids)].slice(0, 30);
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
    console.log('  node scripts/publish-landing-pages.js ucuz-smm-panel');
  })().catch(err => { console.error(err); process.exit(1); });
}
