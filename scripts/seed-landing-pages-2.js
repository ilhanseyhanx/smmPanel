'use strict';

// Satis sayfalari — 2. parti (28 Agu 2026): katalogdaki kalan tum servis
// alanlari icin TASLAK sayfalar. Kullanim: cd /var/www/smmjet && node scripts/seed-landing-pages-2.js
// Var olan slug'lara dokunmaz. Kategori ID'leri canli katalogdan.

const path = require('path');
const sqlite3 = require('sqlite3');
const { normalizePagePayload } = require('../utils/landingPages');

const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.join(__dirname, '..', 'database.sqlite');

// Ortak SSS ve adimlar (her sayfada ozel maddelerle birlestirilir).
const STEPS_TR = ['Ücretsiz hesap oluşturun ve kart, kripto ya da havale ile bakiye yükleyin.', 'Tablodan ihtiyacınıza uygun paketi seçin; fiyat ve limitler kartta yazar.', 'Herkese açık bağlantıyı ve miktarı girin; şifre istenmez.', 'Sipariş saniyeler içinde başlar; ilerlemeyi Siparişlerim sayfasından izleyin.'];
const STEPS_EN = ['Create a free account and top up with card, crypto or bank transfer.', 'Pick the package that fits your need from the table; price and limits are on the card.', 'Enter the public link and the quantity; no password needed.', 'The order starts within seconds; track progress on the My Orders page.'];
const FAQ_COMMON_TR = [
  { q: 'Şifremi vermem gerekir mi?', a: 'Hayır. Yalnızca herkese açık profil, gönderi veya kanal bağlantısı istenir; hesabınıza asla giriş yapılmaz.' },
  { q: 'Hangi ödeme yöntemleri var?', a: 'Kredi/banka kartı (PayTR), kripto para ve banka havalesi ile bakiye yükleyebilirsiniz; bakiye onaylanır onaylanmaz hesabınıza yansır.' },
  { q: 'Sipariş tamamlanmazsa ne olur?', a: '"İptal Aktif" etiketli hizmetlerde teslim edilmeyen kısım bakiyenize iade edilir. Diğer hizmetlerde destek ekibi sağlayıcıyla birlikte takip eder; iade koşulları İade Politikası sayfasında yazar.' }
];
const FAQ_COMMON_EN = [
  { q: 'Do I need to give my password?', a: 'No. Only a public profile, post or channel link is required; nobody ever logs into your account.' },
  { q: 'Which payment methods are available?', a: 'Credit/debit card (PayTR), cryptocurrency and bank transfer; the balance is credited as soon as the payment is confirmed.' },
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
  page({
    slug: 'facebook-sayfa-begeni-satin-al', platform_key: 'facebook', category_ids: [234, 177], sort_order: 80,
    title_tr: 'Facebook Sayfa Beğeni ve Takipçi Satın Al', title_en: 'Buy Facebook Page Likes and Followers',
    subtitle_tr: 'Facebook sayfanız ve profiliniz için düşüşsüz, ömür boyu garantili takipçi paketleri. Günlük 500K hız, anında başlangıç, şifresiz sipariş.',
    subtitle_en: 'No-drop, lifetime-guaranteed follower packages for your Facebook page and profile. Up to 500K per day, instant start, no password.',
    seo_title_tr: 'Facebook Sayfa Beğeni ve Takipçi Satın Al – Düşüşsüz, Garantili', seo_title_en: 'Buy Facebook Page Likes & Followers – No Drop, Guaranteed',
    seo_description_tr: 'Facebook sayfa beğeni ve takipçi satın al: düşüşsüz, ömür boyu garantili paketler. Tüm sayfa türleri, günlük 500K hız, anında başlangıç ve güvenli ödeme.',
    seo_description_en: 'Buy Facebook page likes and followers: no-drop, lifetime-guaranteed packages. All page types, up to 500K per day, instant start and secure payment.',
    content_tr: `<h2>Facebook sayfa beğenisi neden hâlâ önemli?</h2>
<p>Facebook, yerel işletmeler ve 30+ yaş kitle için Türkiye'de hâlâ en büyük platformlardan biri. Sayfanızın beğeni ve takipçi sayısı, reklam verdiğinizde ya da müşteri sayfanıza baktığında ilk güven ölçütüdür; 40 beğenili bir işletme sayfası reklam bütçesini boşa harcar. Jet SMM Panel'deki Facebook sayfa paketleri bu ilk eşiği düşüşsüz ve garantili biçimde geçmenizi sağlar.</p>
<h2>Paket seçenekleri</h2>
<ul>
<li><strong>Sayfa takipçisi (ömür boyu garantili):</strong> Maksimum 100K-10M, düşüş yok, günlük 500K hız.</li>
<li><strong>Sayfa beğenisi + takipçi:</strong> Tüm sayfa türlerinde çalışır; beğeni ve takipçi birlikte gelir.</li>
<li><strong>Profil takipçisi:</strong> Kişisel profiller için yüksek kalite, düşük düşüş, günlük 50K-100K.</li>
<li><strong>İptal aktif seçenek:</strong> Teslim edilmeyen kısım bakiyenize döner.</li>
</ul>
<h2>Doğru kullanım</h2>
<p>Yeni sayfa ise "Yeni Sayfa" tasarımına geçtiğinizden ve sayfanın herkese açık olduğundan emin olun. Beğeniyi düzenli paylaşımla destekleyin; içeriksiz sayfada takipçi artışı reklam kalite puanına katkı sağlamaz. Sayfa profesyonel modda kişisel profil ise "Takipçi" paketini seçin.</p>
<blockquote>Dürüst uyarı: Satın alınan beğeni sayfanızın erişimini doğrudan artırmaz; Facebook dağıtımı gönderi etkileşimine bakar. Beğeniyi sosyal kanıt olarak kullanın, erişim için gönderi etkileşimi ve reklam gerekir.</blockquote>`,
    content_en: `<h2>Why do Facebook page likes still matter?</h2>
<p>Facebook is still one of the largest platforms in Turkey for local businesses and the 30+ audience. Your page's like and follower count is the first trust metric when you run ads or a customer checks your page; a business page with 40 likes wastes its ad budget. Facebook page packages on Jet SMM Panel get you past that first threshold with no-drop, guaranteed delivery.</p>
<h2>Package options</h2>
<ul>
<li><strong>Page followers (lifetime guarantee):</strong> up to 100K-10M, no drop, 500K per day.</li>
<li><strong>Page likes + followers:</strong> works on all page types; likes and followers arrive together.</li>
<li><strong>Profile followers:</strong> high quality, low drop, 50K-100K per day for personal profiles.</li>
<li><strong>Cancel-enabled option:</strong> the undelivered part returns to your balance.</li>
</ul>
<h2>Using it right</h2>
<p>If the page is new, make sure it uses the "New Pages" design and is public. Support likes with regular posting; follower growth on a contentless page adds nothing to ad quality score. If your page is a personal profile in professional mode, choose the "Followers" package.</p>
<blockquote>Honest warning: purchased likes do not directly increase your reach; Facebook distribution looks at post engagement. Use likes as social proof — reach needs post engagement and ads.</blockquote>`,
    faq_tr: [
      { q: 'Yeni sayfa tasarımında çalışır mı?', a: 'Evet; "Tüm Sayfa Türleri" etiketli paket hem klasik hem yeni sayfa tasarımında çalışır. Profesyonel moddaki kişisel profiller için "Takipçi" paketini seçin.' },
      { q: 'Beğeniler düşer mi?', a: 'Ömür boyu garantili paketlerde düşüş yaşanırsa telafi edilir; 30 gün yenilemeli seçenekte süre kartta yazar.' }
    ],
    faq_en: [
      { q: 'Does it work with the new page design?', a: 'Yes; the package tagged "All Page Types" works on both classic and new page designs. For personal profiles in professional mode choose the "Followers" package.' },
      { q: 'Will the likes drop?', a: 'Lifetime-guaranteed packages are compensated if drops occur; the 30-day refill option states its period on the card.' }
    ],
    related_blog_slugs: ['sosyal-medya-buyume-rehberi', 'sosyal-kanit-nedir-satisa-etkisi', 'organik-buyume-vs-satin-alma-karsilastirmasi']
  }),
  page({
    slug: 'facebook-izlenme-satin-al', platform_key: 'facebook', category_ids: [170, 169, 171], sort_order: 90,
    title_tr: 'Facebook Video ve Reels İzlenme Satın Al', title_en: 'Buy Facebook Video and Reels Views',
    subtitle_tr: 'Facebook video, Reels ve canlı yayın için izlenme paketleri; 60K dakikalık izlenme süresi paketleriyle para kazanma şartlarına destek.',
    subtitle_en: 'View packages for Facebook video, Reels and live streams; 60K-minute watch-time packages to support monetisation requirements.',
    seo_title_tr: 'Facebook İzlenme Satın Al – Video, Reels, Canlı Yayın ve İzlenme Süresi', seo_title_en: 'Buy Facebook Views – Video, Reels, Live and Watch Time',
    seo_description_tr: 'Facebook izlenme satın al: video ve Reels görüntülenme, canlı yayın izleyici ve 60K dakika izlenme süresi paketleri. Ömür boyu yenileme, anında başlangıç.',
    seo_description_en: 'Buy Facebook views: video and Reels views, live stream viewers and 60K-minute watch-time packages. Lifetime refill, instant start.',
    content_tr: `<h2>Facebook'ta izlenme neyi açar?</h2>
<p>Facebook'un içerik para kazanma programı belirli takipçi ve izlenme süresi eşikleri ister; Reels dağıtımı ise ilk saatteki izlenme ve tamamlanma oranına bakar. İzlenme paketleri hem yeni videonun ilk dağıtım halkasını genişletir hem de izlenme süresi paketleriyle eşiklere yaklaşmanıza yardımcı olur.</p>
<h2>Paket seçenekleri</h2>
<ul>
<li><strong>Video / Reels görüntülenme:</strong> Sınırsız maksimum, %0 düşüş, ömür boyu yenileme, saatlik 1M'ye varan hız.</li>
<li><strong>Canlı yayın izlenme:</strong> 15 veya 60 dakikalık eş zamanlı izleyici; anında başlar.</li>
<li><strong>İzlenme süresi (60K dakika):</strong> 1, 2 veya 3 saatlik çevrimdışı videolar için; düşüş yok.</li>
</ul>
<h2>Doğru kullanım</h2>
<p>İzlenme süresi paketleri video uzunluğuna göre seçilmelidir: 3 saatlik video için "3 saatlik videolar için" etiketli paketi alın, aksi halde süre eksik sayılır. Canlı yayın paketini yayın başladıktan sonra sipariş edin.</p>
<blockquote>Dürüst uyarı: Facebook para kazanma programı yapay etkileşimi tespit ederse başvuruyu reddedebilir. Paketleri gerçek içerik akışının yanında, ölçülü kullanın.</blockquote>`,
    content_en: `<h2>What do views unlock on Facebook?</h2>
<p>Facebook's content monetisation programme requires specific follower and watch-time thresholds; Reels distribution looks at first-hour views and completion. View packages widen a new video's first distribution ring and, with watch-time packages, help you approach those thresholds.</p>
<h2>Package options</h2>
<ul>
<li><strong>Video / Reels views:</strong> unlimited maximum, 0% drop, lifetime refill, speeds up to 1M per hour.</li>
<li><strong>Live stream viewers:</strong> 15 or 60 minutes of concurrent viewers; instant start.</li>
<li><strong>Watch time (60K minutes):</strong> for 1, 2 or 3-hour on-demand videos; no drop.</li>
</ul>
<h2>Using it right</h2>
<p>Choose watch-time packages by video length: for a 3-hour video pick the package labelled "for 3-hour videos", otherwise the time is under-counted. Order the live package after the stream has started.</p>
<blockquote>Honest warning: if Facebook's monetisation programme detects artificial engagement it can reject the application. Use packages moderately alongside real content.</blockquote>`,
    faq_tr: [{ q: 'İzlenme süresi paketi hangi videolarda çalışır?', a: 'Yalnızca çevrimdışı (yüklenmiş) videolarda; video uzunluğu paket etiketindeki süreye uygun olmalıdır.' }],
    faq_en: [{ q: 'Which videos do watch-time packages work on?', a: 'Only on-demand (uploaded) videos; the video length must match the duration in the package label.' }],
    related_blog_slugs: ['sosyal-medya-algoritmalari-2026-rehberi', 'sosyal-medya-buyume-rehberi']
  }),
  page({
    slug: 'instagram-izlenme-satin-al', platform_key: 'instagram', category_ids: [187, 188, 195, 194], sort_order: 100,
    title_tr: 'Instagram İzlenme Satın Al (Reels ve Video)', title_en: 'Buy Instagram Views (Reels and Video)',
    subtitle_tr: 'Reels, video ve IGTV için anında başlayan izlenme paketleri; erişim, gösterim ve profil ziyareti içeren seçenekler. 1000 adet ₺0,46\'dan.',
    subtitle_en: 'Instant-start view packages for Reels, video and IGTV, with options that include reach, impressions and profile visits. From ₺0.46 per 1000.',
    seo_title_tr: 'Instagram İzlenme Satın Al – Reels ve Video Görüntülenme, Erişim', seo_title_en: 'Buy Instagram Views – Reels & Video Views with Reach',
    seo_description_tr: 'Instagram izlenme satın al: Reels ve video için saniyeler içinde başlayan görüntülenme paketleri; erişim, gösterim ve profil ziyareti seçenekleri, en ucuz fiyat.',
    seo_description_en: 'Buy Instagram views: view packages for Reels and video that start within seconds. Options with reach, impressions and profile visits at the lowest price.',
    content_tr: `<h2>İzlenme Reels dağıtımını nasıl etkiler?</h2>
<p>Instagram, Reels'i önce takipçi olmayan küçük bir kitleye gösterir ve izlenme, tamamlanma ve paylaşım oranına göre dağıtımı büyütür. İlk saatte gelen izlenme bu test aşamasını geçmenin en ucuz yoludur; katalogdaki en düşük 1000 adet fiyatı da izlenme paketlerindedir.</p>
<h2>Paket seçenekleri</h2>
<ul>
<li><strong>Standart görüntülenme:</strong> Anında başlar, maksimum 100M, tüm bağlantılar kabul edilir.</li>
<li><strong>Görüntülenme + erişim + gösterim + profil ziyareti:</strong> Sayaç yanında Insights verisini de besler; Reels ve video için.</li>
<li><strong>Görüntülenme + %5 beğeni + %5 takipçi:</strong> Oranları doğal tutan karma paket.</li>
</ul>
<h2>Doğru kullanım</h2>
<p>Bütçenizi tek videoya yoğunlaştırın, yayından sonraki ilk 30-60 dakikada kademeli teslimatla başlayın. İzlenme yükselirken beğeni oranı düşmesin diye orantılı beğeni ekleyin. Gönderinin herkese açık olduğundan emin olun.</p>
<blockquote>Dürüst uyarı: İzlenme tamamlanma oranını yükseltmez; kancası zayıf video geniş kitlede de erken terk edilir. Satın alma yalnızca iyi videonun görülme şansını artırır.</blockquote>`,
    content_en: `<h2>How do views affect Reels distribution?</h2>
<p>Instagram first shows a Reel to a small non-follower audience and scales distribution by view, completion and share rate. First-hour views are the cheapest way to pass that test stage; the lowest price per 1000 in the catalogue is in the view packages.</p>
<h2>Package options</h2>
<ul>
<li><strong>Standard views:</strong> instant start, up to 100M, all link types accepted.</li>
<li><strong>Views + reach + impressions + profile visits:</strong> feeds Insights data alongside the counter; for Reels and video.</li>
<li><strong>Views + 5% likes + 5% followers:</strong> a mixed package that keeps ratios natural.</li>
</ul>
<h2>Using it right</h2>
<p>Concentrate your budget on one video and start drip-feed delivery within 30-60 minutes of posting. Add proportional likes so the like ratio does not fall as views climb. Make sure the post is public.</p>
<blockquote>Honest warning: views do not raise completion rate; a video with a weak hook is abandoned early by a wider audience too. Buying views only improves a good video's chance to be seen.</blockquote>`,
    faq_tr: [{ q: 'İzlenmeler Insights\'ta görünür mü?', a: '"Erişim + gösterim" içeren paketlerde evet; standart görüntülenme paketleri yalnızca sayaca yansır.' }],
    faq_en: [{ q: 'Do the views show in Insights?', a: 'Yes for packages that include "reach + impressions"; standard view packages only affect the counter.' }],
    related_blog_slugs: ['instagram-reels-izlenme-nasil-artirilir-drip-feed-ile-guvenli-buyume-rehberi-2026-2844', '2026-instagram-kesfet-taktikleri', 'instagram-reels-vs-tiktok-hangisi']
  }),
  page({
    slug: 'instagram-hikaye-izlenme-satin-al', platform_key: 'instagram', category_ids: [186, 185, 184, 192], sort_order: 110,
    title_tr: 'Instagram Hikaye İzlenme Satın Al', title_en: 'Buy Instagram Story Views',
    subtitle_tr: 'Tüm hikayelerinize dakikalar içinde gelen görüntülenme, hikaye beğenisi ve anket oyu paketleri. Gerçek hesaplar, düşüş yok.',
    subtitle_en: 'Story views, story likes and poll vote packages delivered to all your stories within minutes. Real accounts, no drop.',
    seo_title_tr: 'Instagram Hikaye İzlenme Satın Al – Tüm Hikayeler, Anında', seo_title_en: 'Buy Instagram Story Views – All Stories, Instant',
    seo_description_tr: 'Instagram hikaye izlenme satın al: tüm hikayelere dakikalar içinde gelen görüntülenme, hikaye beğenisi ve anket oyu paketleri. Gerçek hesaplar, düşüş yok, şifresiz.',
    seo_description_en: 'Buy Instagram story views: view, story like and poll vote packages delivered to all stories within minutes. Real accounts, no drop, no password.',
    content_tr: `<h2>Hikaye izlenmesi neden önemli?</h2>
<p>Hikaye görüntülenme sayısı, markaların iş birliği kararında baktığı ilk metriklerden biridir; takipçi sayısıyla hikaye izlenmesi arasındaki oran hesabın "canlı" olup olmadığını gösterir. Hikaye paketleri bu oranı korumanıza, anket oyu paketleri de etkileşimli hikayelerin dolu görünmesine yardımcı olur.</p>
<h2>Paket seçenekleri</h2>
<ul>
<li><strong>Hikaye görüntülenme:</strong> Tüm aktif hikayelere, karışık hesaplardan, günlük 15K-20K; en ucuz seçenek 1000 adet ₺0,72.</li>
<li><strong>Hikaye görüntülenme + beğeni:</strong> Gerçek ve ülke hedefli seçenekler (İtalya, Hindistan).</li>
<li><strong>Hikaye anket oyu:</strong> Evet/Hayır veya 1./2. seçenek için günlük 25K'ya varan hız.</li>
</ul>
<h2>Doğru kullanım</h2>
<p>Sipariş, veriliş anında yayında olan hikayelere işlenir; hikayeleri paylaştıktan sonra sipariş verin. Takipçi sayınızın %10-30'u kadar izlenme doğal bir orandır.</p>
<blockquote>Dürüst uyarı: Hikaye görüntülenmesi profil ziyaretini garanti etmez; marka iş birliklerinde ekran görüntüsü istenirse Insights verisiyle tutarlı olması için ölçülü kullanın.</blockquote>`,
    content_en: `<h2>Why do story views matter?</h2>
<p>Story view count is one of the first metrics brands check for collaborations; the ratio between followers and story views shows whether an account is "alive". Story packages help you keep that ratio and poll vote packages make interactive stories look active.</p>
<h2>Package options</h2>
<ul>
<li><strong>Story views:</strong> to all active stories, mixed accounts, 15K-20K per day; the cheapest option is ₺0.72 per 1000.</li>
<li><strong>Story views + likes:</strong> real and country-targeted options (Italy, India).</li>
<li><strong>Story poll votes:</strong> yes/no or first/second option, up to 25K per day.</li>
</ul>
<h2>Using it right</h2>
<p>The order applies to stories live at the moment of ordering, so post the stories first. Views equal to 10-30% of your follower count are a natural ratio.</p>
<blockquote>Honest warning: story views do not guarantee profile visits; if brands ask for screenshots, keep volumes moderate so they stay consistent with Insights data.</blockquote>`,
    faq_tr: [{ q: 'Sonradan eklediğim hikayelere de gelir mi?', a: 'Hayır; teslimat sipariş anındaki aktif hikayelere yapılır. Yeni hikayeler için yeni sipariş gerekir.' }],
    faq_en: [{ q: 'Will views also go to stories I add later?', a: 'No; delivery applies to stories active at the time of ordering. New stories need a new order.' }],
    related_blog_slugs: ['instagram-hikaye-izlenme-artirma-taktikleri', 'sosyal-medya-etkilesim-orani-hesaplama-rehberi']
  }),
  page({
    slug: 'instagram-yorum-satin-al', platform_key: 'instagram', category_ids: [196, 197, 198], sort_order: 120,
    title_tr: 'Instagram Yorum Satın Al', title_en: 'Buy Instagram Comments',
    subtitle_tr: 'Gönderinize %100 gerçek kullanıcılardan emoji ve metin yorumlar, rastgele yorum paketleri ve yorum beğenisi. Gönderiyle ilgili, yüksek kalite.',
    subtitle_en: 'Emoji and text comments from 100% real users, random comment packages and comment likes for your posts. Post-relevant, high quality.',
    seo_title_tr: 'Instagram Yorum Satın Al – Gerçek Kullanıcı Yorumları ve Yorum Beğenisi', seo_title_en: 'Buy Instagram Comments – Real User Comments & Comment Likes',
    seo_description_tr: 'Instagram yorum satın al: %100 gerçek kullanıcılardan emoji ve metin yorumlar, 3-5 yorumluk paketler ve yorum beğenisi. Anında başlangıç, şifresiz sipariş.',
    seo_description_en: 'Buy Instagram comments: emoji and text comments from 100% real users, 3-5 comment packages and comment likes. Instant start, no password.',
    content_tr: `<h2>Yorum neden en güçlü sinyal?</h2>
<p>Instagram algoritması yorumu beğeniden daha ağır tartar: yorum yazmak zaman ister ve gerçek ilgi gösterir. Yorum sayısı sıfır olan bir gönderi, beğenisi yüksek olsa bile "şişirilmiş" görünür. Yorum paketleri gönderinin ilk saatlerinde tartışma başlatır; yorum beğenisi ise kendi yorumlarınızı üst sıraya taşır.</p>
<h2>Paket seçenekleri</h2>
<ul>
<li><strong>3 veya 5 yorum paketi:</strong> %100 gerçek kullanıcı, emoji + metin, gönderiyle ilgili.</li>
<li><strong>Rastgele emoji yorumlar:</strong> Hızlı ve ekonomik.</li>
<li><strong>%98 beğeni + %2 yorum:</strong> Karma etkileşim paketi, maksimum 50K.</li>
<li><strong>Yorum beğenisi:</strong> Belirli bir yoruma veya kullanıcı adına göre; günlük 5K-10K.</li>
</ul>
<h2>Doğru kullanım</h2>
<p>Yorumları yayından sonraki ilk saatte alın ve gelen yorumlara kendiniz yanıt verin; yanıtlanan yorum ikinci bir etkileşim sinyali üretir. Gönderinin yorumlara açık olduğundan emin olun.</p>
<blockquote>Dürüst uyarı: Metin yorumları gönderinizin bağlamına genel olarak uyar ancak ürün adı gibi özel bilgiler içermez. Yorum sınırlaması açık hesaplarda teslimat yapılamaz.</blockquote>`,
    content_en: `<h2>Why are comments the strongest signal?</h2>
<p>Instagram's algorithm weighs a comment more than a like: writing one takes time and shows real interest. A post with zero comments looks "inflated" even with many likes. Comment packages spark a conversation in the post's first hours; comment likes push your own comments to the top.</p>
<h2>Package options</h2>
<ul>
<li><strong>3 or 5 comment packages:</strong> 100% real users, emoji + text, post-relevant.</li>
<li><strong>Random emoji comments:</strong> fast and economical.</li>
<li><strong>98% likes + 2% comments:</strong> mixed engagement package, up to 50K.</li>
<li><strong>Comment likes:</strong> for a specific comment or by username; 5K-10K per day.</li>
</ul>
<h2>Using it right</h2>
<p>Get comments within the first hour after posting and reply to them yourself; a replied comment produces a second engagement signal. Make sure the post allows comments.</p>
<blockquote>Honest warning: text comments fit your post's general context but do not contain specifics such as product names. Delivery is not possible on accounts with comment restrictions enabled.</blockquote>`,
    faq_tr: [{ q: 'Yorumların içeriğini seçebilir miyim?', a: 'Paket yorumlar gönderiyle ilgili genel emoji ve metinlerden oluşur; özel metin listesi için destek ekibiyle iletişime geçin.' }],
    faq_en: [{ q: 'Can I choose the comment text?', a: 'Package comments consist of general post-relevant emoji and text; contact support for custom comment lists.' }],
    related_blog_slugs: ['sosyal-medya-etkilesim-orani-hesaplama-rehberi', '2026-instagram-kesfet-taktikleri']
  }),
  page({
    slug: 'tiktok-begeni-satin-al', platform_key: 'tiktok', category_ids: [228, 241], sort_order: 130,
    title_tr: 'TikTok Beğeni Satın Al', title_en: 'Buy TikTok Likes',
    subtitle_tr: 'Profil fotoğraflı %100 gerçek hesaplardan TikTok beğenisi; 30 veya 60 gün yenilemeli seçenekler, düşük düşüş, anında başlangıç.',
    subtitle_en: 'TikTok likes from 100% real accounts with profile photos; options with 30 or 60-day refill, low drop, instant start.',
    seo_title_tr: 'TikTok Beğeni Satın Al – Gerçek Hesaplar, 30/60 Gün Yenileme', seo_title_en: 'Buy TikTok Likes – Real Accounts, 30/60-Day Refill',
    seo_description_tr: 'TikTok beğeni satın al: profil fotoğraflı gerçek hesaplardan, saniyeler içinde başlayan beğeni paketleri. 30/60 gün yenileme, iptal aktif, günlük 100K hız.',
    seo_description_en: 'Buy TikTok likes: like packages from real accounts with profile photos that start within seconds. 30/60-day refill, cancel enabled, 100K per day.',
    content_tr: `<h2>Beğeni TikTok algoritmasında ne yapar?</h2>
<p>TikTok, videonun ilk test kitlesindeki beğeni/izlenme oranına bakarak bir sonraki dağıtım halkasına geçip geçmeyeceğine karar verir. İzlenmesi yüksek ama beğenisi düşük video "ilgisiz" sayılır. Beğeni paketleri bu oranı korur; izlenme paketiyle birlikte kullanıldığında en dengeli sonucu verir.</p>
<h2>Paket seçenekleri</h2>
<ul>
<li><strong>Yenilemesiz:</strong> En ekonomik; düşüş olursa telafi yok.</li>
<li><strong>30 gün yenileme:</strong> Düşük düşüş, iptal aktif, günlük 100K.</li>
<li><strong>60 gün yenileme:</strong> En uzun garanti süresi.</li>
<li><strong>Yorum beğenisi:</strong> Kendi yorumunuzu öne çıkarmak için, maksimum 1M.</li>
</ul>
<h2>Doğru kullanım</h2>
<p>İzlenmenin %5-10'u kadar beğeni doğal bir orandır; 10.000 izlenmeli videoya 5.000 beğeni almayın. Yayından sonraki ilk saatte kademeli başlayın.</p>
<blockquote>Dürüst uyarı: Beğeni tek başına Keşfet (For You) dağıtımı garanti etmez; tamamlanma oranı ve paylaşım daha belirleyicidir.</blockquote>`,
    content_en: `<h2>What do likes do in TikTok's algorithm?</h2>
<p>TikTok looks at the like-to-view ratio in a video's first test audience to decide whether to move to the next distribution ring. A video with high views but few likes is treated as "uninteresting". Like packages protect that ratio and give the most balanced result when paired with a view package.</p>
<h2>Package options</h2>
<ul>
<li><strong>No refill:</strong> the most economical; no compensation for drops.</li>
<li><strong>30-day refill:</strong> low drop, cancel enabled, 100K per day.</li>
<li><strong>60-day refill:</strong> the longest guarantee period.</li>
<li><strong>Comment likes:</strong> to highlight your own comment, up to 1M.</li>
</ul>
<h2>Using it right</h2>
<p>Likes equal to 5-10% of views are a natural ratio; do not buy 5,000 likes for a 10,000-view video. Start drip-feed within the first hour after posting.</p>
<blockquote>Honest warning: likes alone do not guarantee For You distribution; completion rate and shares matter more.</blockquote>`,
    faq_tr: [{ q: 'Beğeniler gerçek hesaplardan mı geliyor?', a: 'Evet; listelenen paketler profil fotoğraflı %100 gerçek hesaplardan gelir ve düşük düşüş oranıyla çalışır.' }],
    faq_en: [{ q: 'Do the likes come from real accounts?', a: 'Yes; listed packages come from 100% real accounts with profile photos and run with a low drop rate.' }],
    related_blog_slugs: ['tiktok-ta-viral-olmak-begeni-ve-izlenme-sayisinin-algoritmaya-etkisi-msvofnwa', 'tiktok-algoritmasi-nasil-calisir']
  }),
  page({
    slug: 'tiktok-canli-yayin-izleyici-satin-al', platform_key: 'tiktok', category_ids: [229, 230, 231], sort_order: 140,
    title_tr: 'TikTok Canlı Yayın Beğeni ve PK Puanı Satın Al', title_en: 'Buy TikTok Live Likes and PK Battle Points',
    subtitle_tr: 'Canlı yayınınız için 3-5 dakikada başlayan beğeni ve PK savaş puanı paketleri; sınırsız maksimum, günlük 50M hız.',
    subtitle_en: 'Like and PK battle point packages for your live stream that start within 3-5 minutes; unlimited maximum, up to 50M per day.',
    seo_title_tr: 'TikTok Canlı Yayın Beğeni ve PK Puanı Satın Al – 3 Dakikada Başlar', seo_title_en: 'Buy TikTok Live Likes & PK Points – Starts in 3 Minutes',
    seo_description_tr: 'TikTok canlı yayın beğeni ve PK savaş puanı satın al: yayın sırasında 3-5 dakikada başlayan paketler, sınırsız maksimum, günlük 50M hız, güvenli ödeme.',
    seo_description_en: 'Buy TikTok live likes and PK battle points: packages that start within 3-5 minutes during the stream, unlimited maximum, 50M per day, secure payment.',
    content_tr: `<h2>Canlı yayında beğeni ve PK puanı</h2>
<p>TikTok canlı yayınlarında ekranda akan beğeniler ve PK (yayıncı düellosu) puanı, izleyicinin kalma kararını ve rakiple mücadeleyi doğrudan etkiler. Paketler yayın sırasında sipariş edilir ve 3-5 dakika içinde akmaya başlar.</p>
<h2>Paket seçenekleri</h2>
<ul>
<li><strong>Canlı yayın beğenisi:</strong> Maksimum 100M-2.1B, 3-5 dakikada başlar, günlük 500K-700K.</li>
<li><strong>PK savaş puanı:</strong> Sınırsız veya 1M maksimum; günlük 50M hız.</li>
<li><strong>Canlı yayın + PK puanı:</strong> İkisini birlikte içeren paket.</li>
</ul>
<h2>Doğru kullanım</h2>
<p>Siparişi yayın başladıktan sonra, yayın bağlantısıyla verin; yayın kapanırsa teslimat durur. PK puanını düellonun ilk yarısında alın ki geri kalan süre organik izleyiciyi tetiklesin.</p>
<blockquote>Dürüst uyarı: Yayın bitince kalan miktar teslim edilemez; miktarı yayın süresine göre seçin. TikTok kuralları yapay etkileşimi onaylamaz.</blockquote>`,
    content_en: `<h2>Likes and PK points during a live stream</h2>
<p>In TikTok lives, the likes flowing on screen and the PK (creator battle) score directly affect whether viewers stay and how the battle goes. Packages are ordered during the stream and start flowing within 3-5 minutes.</p>
<h2>Package options</h2>
<ul>
<li><strong>Live likes:</strong> up to 100M-2.1B, starts in 3-5 minutes, 500K-700K per day.</li>
<li><strong>PK battle points:</strong> unlimited or 1M maximum; 50M per day.</li>
<li><strong>Live + PK points:</strong> a package that includes both.</li>
</ul>
<h2>Using it right</h2>
<p>Order after the stream has started using the live link; delivery stops if the stream ends. Buy PK points in the first half of the battle so the remaining time triggers organic viewers.</p>
<blockquote>Honest warning: the remaining quantity cannot be delivered after the stream ends; size the order to the stream length. TikTok's rules do not endorse artificial engagement.</blockquote>`,
    faq_tr: [{ q: 'Yayın bitince kalan miktar ne olur?', a: 'Teslimat durur ve kalan kısım genellikle iade edilmez; miktarı yayın süresine göre seçin, iptal aktif paketleri tercih edin.' }],
    faq_en: [{ q: 'What happens to the remaining quantity when the stream ends?', a: 'Delivery stops and the remainder is usually not refunded; size the order to the stream length and prefer cancel-enabled packages.' }],
    related_blog_slugs: ['tiktok-canli-yayin-acma-sartlari-ve-buyume', 'tiktok-hesap-buyutme-stratejileri-2026']
  }),
  page({
    slug: 'telegram-goruntulenme-satin-al', platform_key: 'telegram', category_ids: [217, 221, 215], sort_order: 150,
    title_tr: 'Telegram Görüntülenme ve Tepki Satın Al', title_en: 'Buy Telegram Post Views and Reactions',
    subtitle_tr: 'Kanal gönderileriniz için 1000 adet ₺0,50\'den başlayan görüntülenme, pozitif/negatif tepki ve hikaye görüntülenme paketleri. Ultra hızlı.',
    subtitle_en: 'Post view packages from ₺0.50 per 1000, positive/negative reactions and story views for your channel posts. Ultra fast.',
    seo_title_tr: 'Telegram Görüntülenme Satın Al – Gönderi İzlenme ve Tepki Paketleri', seo_title_en: 'Buy Telegram Views – Post Views & Reaction Packages',
    seo_description_tr: 'Telegram görüntülenme satın al: kanal gönderileri için 1000 adet ₺0,50\'den başlayan izlenme, emoji tepki ve hikaye görüntülenme paketleri. Ultra hızlı, şifresiz.',
    seo_description_en: 'Buy Telegram views: post view packages from ₺0.50 per 1000, emoji reactions and story views for channels. Ultra fast, no password.',
    content_tr: `<h2>Görüntülenme Telegram kanalında neden şart?</h2>
<p>Telegram'da her gönderinin altında görüntülenme sayısı görünür; 5.000 üyeli kanalda 80 görüntülenme, üyelerin sahte olduğunu bağırır. Üye paketiyle birlikte görüntülenme desteği almak kanalın bütününü tutarlı gösterir; tepki paketleri de gönderiye etkileşim katar.</p>
<h2>Paket seçenekleri</h2>
<ul>
<li><strong>Gönderi görüntülenme:</strong> Son 1 gönderi veya belirli bir gönderi; sınırsız maksimum, günlük 1M; en ucuz 1000 adet ₺0,50.</li>
<li><strong>Tepkiler:</strong> Karışık pozitif (👍🔥❤️) veya negatif emoji paketleri; bonus görüntülenme içeren seçenekler.</li>
<li><strong>Hikaye görüntülenme:</strong> Telegram Premium hikayeleri için.</li>
</ul>
<h2>Doğru kullanım</h2>
<p>Üye sayınızın %20-40'ı kadar görüntülenme doğal bir orandır. Gönderi bağlantısı t.me/kanal/123 biçiminde olmalı; kanal herkese açık olmalıdır.</p>
<blockquote>Dürüst uyarı: Görüntülenme satın almak mesajın okunması anlamına gelmez; reklam veren "görüntülenme başına" fiyatlandırma yapıyorsa bunu abartmak güven kaybettirir.</blockquote>`,
    content_en: `<h2>Why are views essential on a Telegram channel?</h2>
<p>Every Telegram post shows its view count; 80 views on a 5,000-member channel screams fake members. Pairing member packages with view support keeps the whole channel consistent; reaction packages add engagement to posts.</p>
<h2>Package options</h2>
<ul>
<li><strong>Post views:</strong> last post or a specific post; unlimited maximum, 1M per day; cheapest at ₺0.50 per 1000.</li>
<li><strong>Reactions:</strong> mixed positive (👍🔥❤️) or negative emoji packages; options with bonus views.</li>
<li><strong>Story views:</strong> for Telegram Premium stories.</li>
</ul>
<h2>Using it right</h2>
<p>Views equal to 20-40% of your member count are a natural ratio. The post link must look like t.me/channel/123 and the channel must be public.</p>
<blockquote>Honest warning: buying views does not mean the message was read; if you sell ads priced per view, exaggerating this costs trust.</blockquote>`,
    faq_tr: [{ q: 'Gelecek gönderilere otomatik görüntülenme gelir mi?', a: 'Bu sayfadaki paketler tek gönderiye çalışır; her gönderi için ayrı sipariş gerekir.' }],
    faq_en: [{ q: 'Do future posts get views automatically?', a: 'Packages on this page work per post; each post needs a separate order.' }],
    related_blog_slugs: ['telegram-kanal-uye-artirma-rehberi']
  }),
  page({
    slug: 'twitter-begeni-retweet-satin-al', platform_key: 'x-twitter', category_ids: [247, 250, 244, 245], sort_order: 160,
    title_tr: 'Twitter (X) Beğeni, Retweet ve Görüntülenme Satın Al', title_en: 'Buy Twitter (X) Likes, Retweets and Views',
    subtitle_tr: 'Tweetleriniz için beğeni, retweet, görüntülenme ve son 5-50 gönderiye toplu görüntülenme paketleri. 1000 görüntülenme ₺0,34\'ten.',
    subtitle_en: 'Likes, retweets, views and bulk view packages for your last 5-50 posts. Views from ₺0.34 per 1000.',
    seo_title_tr: 'Twitter (X) Beğeni ve Retweet Satın Al – Görüntülenme Paketleriyle', seo_title_en: 'Buy Twitter (X) Likes & Retweets – With View Packages',
    seo_description_tr: 'Twitter (X) beğeni, retweet ve görüntülenme satın al: tweet başına veya son 50 gönderiye toplu paketler. 1000 görüntülenme ₺0,34\'ten, anında başlangıç.',
    seo_description_en: 'Buy Twitter (X) likes, retweets and views: per tweet or bulk packages for your last 50 posts. Views from ₺0.34 per 1000, instant start.',
    content_tr: `<h2>X'te etkileşim "Sizin için" akışını nasıl açar?</h2>
<p>X'in öneri algoritması beğeniyi 1x, retweeti yaklaşık 20x ağırlıkla puanlar; görüntülenme ise gösterim sayacında görünür ve profili canlı gösterir. Bu sayfadaki paketler tweet başına ya da son 5-50 gönderiye toplu olarak uygulanır.</p>
<h2>Paket seçenekleri</h2>
<ul>
<li><strong>Beğeni:</strong> Eski hesaplardan, 30 gün yenilemeli seçenek, günlük 20K-30K.</li>
<li><strong>Retweet:</strong> Düşük düşüş, gerçek global kullanıcı seçeneği, 30 gün garanti.</li>
<li><strong>Tweet görüntülenme:</strong> Maksimum 2.1B, günlük 5M+, en ucuz 1000 adet ₺0,34.</li>
<li><strong>Toplu görüntülenme:</strong> Son 5/10/20/50 gönderiye tek siparişle görüntülenme + tüm istatistikler.</li>
</ul>
<h2>Doğru kullanım</h2>
<p>Retweet paketini beğeninin %10-20'si kadar tutun; retweeti beğeniden fazla tweet doğal görünmez. Toplu görüntülenme paketi yeni profilleri hızla "aktif" göstermek için idealdir.</p>
<blockquote>Dürüst uyarı: X sahte etkileşimi kurallarında yasaklar; ekonomik paketlerde düşüş olabilir ve "Yenileme Yok" etiketinde telafi yapılmaz.</blockquote>`,
    content_en: `<h2>How does engagement unlock the "For you" feed on X?</h2>
<p>X's recommendation algorithm scores a like at 1x and a repost at roughly 20x; views appear in the impression counter and make a profile look alive. Packages on this page apply per tweet or in bulk to your last 5-50 posts.</p>
<h2>Package options</h2>
<ul>
<li><strong>Likes:</strong> from aged accounts, a 30-day refill option, 20K-30K per day.</li>
<li><strong>Retweets:</strong> low drop, a real global user option, 30-day guarantee.</li>
<li><strong>Tweet views:</strong> up to 2.1B, 5M+ per day, cheapest at ₺0.34 per 1000.</li>
<li><strong>Bulk views:</strong> views + full statistics for your last 5/10/20/50 posts in one order.</li>
</ul>
<h2>Using it right</h2>
<p>Keep retweets at 10-20% of likes; a tweet with more reposts than likes does not look natural. The bulk view package is ideal for making a new profile look active quickly.</p>
<blockquote>Honest warning: X's rules prohibit fake engagement; budget packages may drop and "No Refill" packages are not compensated.</blockquote>`,
    faq_tr: [{ q: 'Toplu görüntülenme paketi nasıl çalışır?', a: 'Profil bağlantınızı girersiniz; sipariş anındaki son 5, 10, 20 veya 50 gönderinize görüntülenme ve istatistik dağıtılır.' }],
    faq_en: [{ q: 'How does the bulk view package work?', a: 'You enter your profile link; views and statistics are distributed to your last 5, 10, 20 or 50 posts at the time of ordering.' }],
    related_blog_slugs: ['x-twitter-takipci-ve-etkilesim-buyutme', 'sosyal-medya-etkilesim-orani-hesaplama-rehberi']
  }),
  page({
    slug: 'twitch-izleyici-satin-al', platform_key: 'twitch', category_ids: [242, 243, 248], sort_order: 170,
    title_tr: 'Twitch İzleyici Satın Al', title_en: 'Buy Twitch Viewers',
    subtitle_tr: 'Canlı yayınınız için 5-10 dakikalık veya ABD + Avrupa kaynaklı benzersiz izleyici paketleri; kayıtlı videolar için 60 gün yenilemeli görüntülenme.',
    subtitle_en: 'Unique viewer packages for your live stream (5-10 minutes or US + EU sourced); 60-day refill views for VODs.',
    seo_title_tr: 'Twitch İzleyici Satın Al – Canlı Yayın ve Video Görüntülenme', seo_title_en: 'Buy Twitch Viewers – Live Stream & Video Views',
    seo_description_tr: 'Twitch izleyici satın al: canlı yayın için anında başlayan izleyici paketleri (ABD + Avrupa seçeneği) ve kayıtlı videolar için 60 gün yenilemeli görüntülenme.',
    seo_description_en: 'Buy Twitch viewers: instant-start live viewer packages (US + EU option) and 60-day refill views for recorded videos.',
    content_tr: `<h2>Twitch'te izleyici sayısı neyi belirler?</h2>
<p>Twitch kategori sayfaları yayınları eş zamanlı izleyici sayısına göre sıralar; 0 izleyicili yayın listenin en altında görünmez kalır. Affiliate için ortalama 3 eş zamanlı izleyici, Partner için 75 izleyici şartı vardır. İzleyici paketleri yayını listede yukarı taşıyarak organik keşfi tetikler.</p>
<h2>Paket seçenekleri</h2>
<ul>
<li><strong>Canlı yayın izleyici (5 veya 10 dakika):</strong> Kısa süreli, ekonomik test paketleri.</li>
<li><strong>Benzersiz canlı izleyici (ABD + Avrupa):</strong> 20-3.500 arası, anında başlar.</li>
<li><strong>Video görüntülenme:</strong> Kayıtlı yayın ve klipler için, günlük 100K-500K, 60 gün yenileme.</li>
</ul>
<h2>Doğru kullanım</h2>
<p>Yayın başladıktan sonra sipariş verin ve izleyici sayısını kategorinizdeki orta sıralarla uyumlu tutun; 0'dan 500'e sıçrayan yayın Twitch'in dikkatini çeker. Raid ve sohbet etkileşimiyle destekleyin.</p>
<blockquote>Dürüst uyarı: Twitch, izleyici botlarını Hizmet Şartları'nda açıkça yasaklar ve tespit ederse Affiliate/Partner statüsünü kaldırabilir. Bu paketler yalnızca kısa süreli görünürlük içindir; ölçülü ve organik büyümeyle birlikte kullanın.</blockquote>`,
    content_en: `<h2>What does viewer count determine on Twitch?</h2>
<p>Twitch category pages rank streams by concurrent viewers; a stream with 0 viewers stays invisible at the bottom. Affiliate requires an average of 3 concurrent viewers, Partner 75. Viewer packages move the stream up the list and trigger organic discovery.</p>
<h2>Package options</h2>
<ul>
<li><strong>Live viewers (5 or 10 minutes):</strong> short, economical test packages.</li>
<li><strong>Unique live viewers (US + EU):</strong> 20-3,500, instant start.</li>
<li><strong>Video views:</strong> for VODs and clips, 100K-500K per day, 60-day refill.</li>
</ul>
<h2>Using it right</h2>
<p>Order after the stream starts and keep viewer counts in line with the middle of your category; a jump from 0 to 500 draws Twitch's attention. Support it with raids and chat interaction.</p>
<blockquote>Honest warning: Twitch explicitly prohibits viewer bots in its Terms of Service and can remove Affiliate/Partner status if detected. These packages are for short-term visibility only; use them moderately alongside organic growth.</blockquote>`,
    faq_tr: [{ q: 'İzleyiciler sohbete yazar mı?', a: 'Hayır; izleyici paketleri yalnızca eş zamanlı izleyici sayısını artırır, sohbet etkileşimi sağlamaz.' }],
    faq_en: [{ q: 'Do the viewers chat?', a: 'No; viewer packages only increase the concurrent viewer count and do not provide chat interaction.' }],
    related_blog_slugs: ['twitch-takipci-ve-izleyici-artirma-rehberi']
  }),
  page({
    slug: 'kick-takipci-satin-al', platform_key: 'kick', category_ids: [200, 199], sort_order: 180,
    title_tr: 'Kick Takipçi ve İzleyici Satın Al', title_en: 'Buy Kick Followers and Viewers',
    subtitle_tr: 'Kick kanalınız için düşüşsüz, 30 gün yenilemeli takipçi ve 15-60 dakikalık canlı yayın izleyici paketleri. Global kullanıcılar, anında başlangıç.',
    subtitle_en: 'No-drop followers with 30-day refill and 15-60 minute live viewer packages for your Kick channel. Global users, instant start.',
    seo_title_tr: 'Kick Takipçi Satın Al – Düşüşsüz Takipçi ve Canlı Yayın İzleyici', seo_title_en: 'Buy Kick Followers – No-Drop Followers & Live Viewers',
    seo_description_tr: 'Kick takipçi satın al: düşüşsüz, 30 gün yenilemeli takipçi paketleri ve 15-60 dakikalık canlı yayın izleyicisi. Günlük 10K hız, anında başlangıç, güvenli ödeme.',
    seo_description_en: 'Buy Kick followers: no-drop follower packages with 30-day refill and 15-60 minute live viewers. 10K per day, instant start, secure payment.',
    content_tr: `<h2>Kick'te erken başlamanın avantajı</h2>
<p>Kick, yayıncıya %95 abonelik payı veren genç bir platform; kategori sayfaları henüz kalabalık değil. 1.000 takipçi ve düzenli izleyiciyle kategori üstlerine çıkmak Twitch'e göre çok daha kolay. Takipçi paketleri kanalın ilk sosyal kanıtını kurar, izleyici paketleri yayını listede yukarı taşır.</p>
<h2>Paket seçenekleri</h2>
<ul>
<li><strong>Takipçi (düşüşsüz):</strong> Global kullanıcılar, 30 gün yenileme, günlük 10K.</li>
<li><strong>Canlı yayın izleyici:</strong> 15, 30 veya 60 dakika eş zamanlı izleyici.</li>
</ul>
<h2>Doğru kullanım</h2>
<p>İzleyici paketini yayın başladıktan sonra sipariş edin. Takipçiyi haftalık yayın düzeniyle destekleyin; takipçisi çok, yayını olmayan kanal izleyiciyi tutmaz.</p>
<blockquote>Dürüst uyarı: Kick Topluluk Kuralları yapay izleyiciyi yasaklar; Affiliate programı için gerçek etkileşim gerekir. Ölçülü kullanın.</blockquote>`,
    content_en: `<h2>The advantage of starting early on Kick</h2>
<p>Kick is a young platform that gives streamers a 95% subscription share, and its category pages are not crowded yet. Reaching the top of a category with 1,000 followers and steady viewers is far easier than on Twitch. Follower packages build the channel's first social proof; viewer packages move the stream up the list.</p>
<h2>Package options</h2>
<ul>
<li><strong>Followers (no drop):</strong> global users, 30-day refill, 10K per day.</li>
<li><strong>Live viewers:</strong> 15, 30 or 60 minutes of concurrent viewers.</li>
</ul>
<h2>Using it right</h2>
<p>Order the viewer package after the stream starts. Support followers with a weekly streaming schedule; a channel with many followers and no streams cannot keep viewers.</p>
<blockquote>Honest warning: Kick's Community Guidelines prohibit artificial viewers; the Affiliate programme requires real engagement. Use moderately.</blockquote>`,
    faq_tr: [{ q: 'Kick kanal bağlantısı nasıl girilir?', a: 'kick.com/kullaniciadi biçiminde kanal bağlantınızı girin; izleyici paketleri için yayın açık olmalıdır.' }],
    faq_en: [{ q: 'How do I enter my Kick channel link?', a: 'Enter your channel link as kick.com/username; the stream must be live for viewer packages.' }],
    related_blog_slugs: ['twitch-takipci-ve-izleyici-artirma-rehberi', 'sosyal-medya-buyume-rehberi']
  }),
  page({
    slug: 'threads-takipci-satin-al', platform_key: 'threads', category_ids: [226, 223, 224, 225], sort_order: 190,
    title_tr: 'Threads Takipçi ve Beğeni Satın Al', title_en: 'Buy Threads Followers and Likes',
    subtitle_tr: 'Meta\'nın Threads uygulaması için organik hızda gelen takipçi ve beğeni paketleri; görüntülenme ve yeniden paylaşım seçenekleri.',
    subtitle_en: 'Follower and like packages that arrive at an organic pace for Meta\'s Threads app; view and repost options.',
    seo_title_tr: 'Threads Takipçi Satın Al – Organik Hızda Takipçi, Beğeni ve Repost', seo_title_en: 'Buy Threads Followers – Organic-Pace Followers, Likes & Reposts',
    seo_description_tr: 'Threads takipçi satın al: yüksek kaliteli hesaplardan organik hızda gelen takipçi ve beğeni paketleri; görüntülenme ve yeniden paylaşım seçenekleri, şifresiz sipariş.',
    seo_description_en: 'Buy Threads followers: follower and like packages from high-quality accounts at an organic pace; view and repost options, no password.',
    content_tr: `<h2>Threads'te erken otorite</h2>
<p>Threads, Instagram hesabınıza bağlı çalışır ve Meta bu ağa Instagram profilinde "Threads rozeti" ile görünürlük verir. Henüz rekabetin düşük olduğu bu ağda 5-10K takipçili bir hesap kolayca "öneriler" listesine girer. Paketler organik hızda (günlük 250-650) gelir; ani sıçrama olmaz.</p>
<h2>Paket seçenekleri</h2>
<ul>
<li><strong>Organik takipçi:</strong> Yüksek kaliteli hesaplar, günlük 250-500, maksimum 50K.</li>
<li><strong>Organik beğeni:</strong> Günlük 350-650, düşük düşüş.</li>
<li><strong>Görüntülenme ve yeniden paylaşım:</strong> Gönderi erişimi için.</li>
</ul>
<h2>Doğru kullanım</h2>
<p>Threads algoritması yanıt ve yeniden paylaşımı öne çıkarır; takipçiyi haftada 3-5 gönderi ve yanıt alışkanlığıyla destekleyin. Profil herkese açık olmalıdır.</p>
<blockquote>Dürüst uyarı: Threads, Instagram ile aynı Topluluk Kurallarına tabidir; yapay etkileşim iki hesabı da etkileyebilir. Yalnızca organik hızlı paketler sunulur.</blockquote>`,
    content_en: `<h2>Early authority on Threads</h2>
<p>Threads works linked to your Instagram account, and Meta gives the network visibility through the "Threads badge" on Instagram profiles. On this still low-competition network, an account with 5-10K followers easily enters "suggested" lists. Packages arrive at an organic pace (250-650 per day); no sudden spikes.</p>
<h2>Package options</h2>
<ul>
<li><strong>Organic followers:</strong> high-quality accounts, 250-500 per day, up to 50K.</li>
<li><strong>Organic likes:</strong> 350-650 per day, low drop.</li>
<li><strong>Views and reposts:</strong> for post reach.</li>
</ul>
<h2>Using it right</h2>
<p>The Threads algorithm favours replies and reposts; support followers with 3-5 posts per week and a habit of replying. The profile must be public.</p>
<blockquote>Honest warning: Threads is subject to the same Community Guidelines as Instagram; artificial engagement can affect both accounts. Only organic-pace packages are offered.</blockquote>`,
    faq_tr: [{ q: 'Instagram hesabım etkilenir mi?', a: 'Threads ve Instagram aynı Meta hesabına bağlıdır; bu yüzden yalnızca organik hızlı, düşük riskli paketler sunulur ve şifre istenmez.' }],
    faq_en: [{ q: 'Will my Instagram account be affected?', a: 'Threads and Instagram share the same Meta account; that is why only organic-pace, low-risk packages are offered and no password is required.' }],
    related_blog_slugs: ['sosyal-medya-algoritmalari-2026-rehberi', 'sosyal-medya-buyume-rehberi']
  }),
  page({
    slug: 'linkedin-takipci-satin-al', platform_key: 'linkedin', category_ids: [203, 201, 202], sort_order: 200,
    title_tr: 'LinkedIn Takipçi ve Beğeni Satın Al', title_en: 'Buy LinkedIn Followers and Likes',
    subtitle_tr: 'Profil ve şirket sayfaları için düşüşsüz LinkedIn takipçi paketleri (ABD seçeneği), gönderi beğenisi ve kutlama tepkisi. 30 gün yenileme.',
    subtitle_en: 'No-drop LinkedIn follower packages for profiles and company pages (US option), post likes and celebrate reactions. 30-day refill.',
    seo_title_tr: 'LinkedIn Takipçi Satın Al – Profil ve Şirket Sayfası, Düşüşsüz', seo_title_en: 'Buy LinkedIn Followers – Profile & Company Page, No Drop',
    seo_description_tr: 'LinkedIn takipçi satın al: profil ve şirket sayfaları için düşüşsüz, 30 gün yenilemeli takipçi paketleri; ABD seçeneği, gönderi beğenisi ve tepki. Şifresiz, anında.',
    seo_description_en: 'Buy LinkedIn followers: no-drop follower packages with 30-day refill for profiles and company pages; US option, post likes and reactions. No password, instant.',
    content_tr: `<h2>LinkedIn'de takipçi sayısı iş getirir mi?</h2>
<p>LinkedIn'de profil ziyaretçisi karar vermeden önce takipçi sayısına ve gönderi etkileşimine bakar; 200 takipçili bir danışman profili ya da 30 takipçili şirket sayfası güven vermez. Bu sayfadaki paketler B2B görünürlüğün ilk eşiğini geçmenize yardımcı olur; gerçek fırsatı düzenli içerik ve yorumlarınız getirir.</p>
<h2>Paket seçenekleri</h2>
<ul>
<li><strong>Profil / şirket takipçisi:</strong> Şimdiye kadar düşüş yok, 30 gün yenileme, günlük 5K-10K; ABD odaklı seçenek.</li>
<li><strong>Gönderi beğenisi:</strong> Maksimum 10K, gerçek kullanıcılar, karışık cinsiyet.</li>
<li><strong>Kutlama tepkisi 👏:</strong> Terfi ve başarı gönderileri için.</li>
</ul>
<h2>Doğru kullanım</h2>
<p>LinkedIn'de doğallık her platformdan önemli: haftada 500-1.000 takipçiyi aşmayın, beğeniyi gönderi yayınından sonraki 2 saat içinde kademeli alın. Şirket sayfası için sayfa bağlantısını (linkedin.com/company/…) girin.</p>
<blockquote>Dürüst uyarı: LinkedIn, otomatik etkileşimi Kullanıcı Sözleşmesi'nde yasaklar ve profesyonel ağınız sahte takipçiyi fark edebilir. Paketleri ölçülü, itibarınızı koruyarak kullanın.</blockquote>`,
    content_en: `<h2>Does follower count bring business on LinkedIn?</h2>
<p>On LinkedIn, profile visitors look at follower count and post engagement before deciding; a consultant with 200 followers or a company page with 30 does not build trust. Packages on this page help you cross the first threshold of B2B visibility; real opportunities come from your regular content and comments.</p>
<h2>Package options</h2>
<ul>
<li><strong>Profile / company followers:</strong> no drop so far, 30-day refill, 5K-10K per day; US-focused option.</li>
<li><strong>Post likes:</strong> up to 10K, real users, mixed gender.</li>
<li><strong>Celebrate reaction 👏:</strong> for promotion and achievement posts.</li>
</ul>
<h2>Using it right</h2>
<p>Naturalness matters more on LinkedIn than anywhere: stay under 500-1,000 followers per week and drip likes within 2 hours of posting. For company pages, enter the page link (linkedin.com/company/…).</p>
<blockquote>Honest warning: LinkedIn prohibits automated engagement in its User Agreement and your professional network can spot fake followers. Use packages moderately, protecting your reputation.</blockquote>`,
    faq_tr: [{ q: 'Şirket sayfası için çalışır mı?', a: 'Evet; "Profil / Şirket Takipçisi" paketi hem kişisel profil hem şirket sayfası bağlantısını kabul eder.' }],
    faq_en: [{ q: 'Does it work for company pages?', a: 'Yes; the "Profile / Company Followers" package accepts both personal profile and company page links.' }],
    related_blog_slugs: ['linkedin-de-profesyonel-marka-insasi-takipci-ve-etkilesim-stratejileri-msx2obdc', 'sosyal-kanit-nedir-satisa-etkisi']
  }),
  page({
    slug: 'pinterest-takipci-satin-al', platform_key: 'social-media', category_ids: [213, 204, 205, 206], sort_order: 210,
    title_tr: 'Pinterest Takipçi, Beğeni ve Kaydetme Satın Al', title_en: 'Buy Pinterest Followers, Likes and Saves',
    subtitle_tr: 'Pinterest profiliniz ve pinleriniz için takipçi, beğeni, görüntülenme ve kaydetme paketleri. E-ticaret ve blog trafiği için görsel arama gücü.',
    subtitle_en: 'Follower, like, view and save packages for your Pinterest profile and pins. Visual search power for e-commerce and blog traffic.',
    seo_title_tr: 'Pinterest Takipçi Satın Al – Pin Kaydetme, Beğeni ve Görüntülenme', seo_title_en: 'Buy Pinterest Followers – Pin Saves, Likes & Views',
    seo_description_tr: 'Pinterest takipçi satın al: profil takipçisi, pin beğenisi, görüntülenme ve kaydetme paketleri. E-ticaret ve blog trafiği için, şifresiz ve güvenli ödeme.',
    seo_description_en: 'Buy Pinterest followers: profile followers, pin likes, views and saves. For e-commerce and blog traffic, no password and secure payment.',
    content_tr: `<h2>Pinterest'te kaydetme neden takipçiden değerli?</h2>
<p>Pinterest bir sosyal ağdan çok görsel arama motorudur: pin, aylar sonra bile aramadan trafik getirir. Algoritma "kaydetme" sinyalini en ağır tartar; kaydedilen pin daha çok panoya ve arama sonucuna dağılır. Takipçi profil güvenini, kaydetme ve beğeni ise pinin dağıtımını besler.</p>
<h2>Paket seçenekleri</h2>
<ul>
<li><strong>Takipçi:</strong> Profil için.</li>
<li><strong>Pin kaydetme:</strong> Dağıtımı doğrudan etkileyen sinyal.</li>
<li><strong>Pin beğeni ve görüntülenme:</strong> Yeni pinlerin ilk günlerini desteklemek için.</li>
</ul>
<h2>Doğru kullanım</h2>
<p>Pin yayınladıktan sonraki ilk 24 saatte kaydetme alın; açıklamaya anahtar kelime yazmayı unutmayın. İşletme hesabında Analytics ile sonuçları ölçün.</p>
<blockquote>Dürüst uyarı: Pinterest spam politikası yapay etkileşimi yasaklar; hesap işletme hesabıysa ve web sitesi bağlıysa ölçülü kullanın.</blockquote>`,
    content_en: `<h2>Why are saves worth more than followers on Pinterest?</h2>
<p>Pinterest is a visual search engine more than a social network: a pin can bring traffic from search months later. The algorithm weighs the "save" signal the most; a saved pin spreads to more boards and search results. Followers feed profile trust, saves and likes feed pin distribution.</p>
<h2>Package options</h2>
<ul>
<li><strong>Followers:</strong> for the profile.</li>
<li><strong>Pin saves:</strong> the signal that directly affects distribution.</li>
<li><strong>Pin likes and views:</strong> to support a new pin's first days.</li>
</ul>
<h2>Using it right</h2>
<p>Get saves within the first 24 hours after publishing a pin and always write keywords in the description. Measure results with Analytics on a business account.</p>
<blockquote>Honest warning: Pinterest's spam policy prohibits artificial engagement; if the account is a business account with a linked website, use moderately.</blockquote>`,
    faq_tr: [{ q: 'Pin bağlantısını nasıl girerim?', a: 'pinterest.com/pin/123... biçimindeki pin bağlantısını; takipçi için profil bağlantısını (pinterest.com/kullaniciadi) girin.' }],
    faq_en: [{ q: 'How do I enter the pin link?', a: 'Enter the pin link in the form pinterest.com/pin/123...; for followers enter the profile link (pinterest.com/username).' }],
    related_blog_slugs: ['web-sitesi-trafigini-artirmanin-seo-ya-etkisi-organik-mi-satin-alinan-mi-msvy8i2p', 'sosyal-medya-buyume-rehberi']
  }),
  page({
    slug: 'soundcloud-dinlenme-satin-al', platform_key: 'social-media', category_ids: [208, 210], sort_order: 220,
    title_tr: 'SoundCloud Dinlenme Satın Al', title_en: 'Buy SoundCloud Plays',
    subtitle_tr: 'Parçalarınız için anında başlayan, günlük 500K hızlı SoundCloud dinlenme paketleri; ABD ve Rusya hedefli seçenekler.',
    subtitle_en: 'Instant-start SoundCloud play packages at up to 500K per day for your tracks; US and Russia targeted options.',
    seo_title_tr: 'SoundCloud Dinlenme Satın Al – Günlük 500K, ABD ve Rusya Seçeneği', seo_title_en: 'Buy SoundCloud Plays – 500K/Day, US & Russia Options',
    seo_description_tr: 'SoundCloud dinlenme satın al: parçalarınız için saniyeler içinde başlayan, günlük 500K hızlı dinlenme paketleri. ABD ve Rusya hedefli seçenekler, güvenli ödeme.',
    seo_description_en: 'Buy SoundCloud plays: play packages for your tracks that start within seconds at up to 500K per day. US and Russia targeted options, secure payment.',
    content_tr: `<h2>SoundCloud'da dinlenme sayısı</h2>
<p>SoundCloud, bağımsız üreticilerin demo ve remix paylaştığı ilk platform olmaya devam ediyor; parça sayfasındaki dinlenme sayısı DJ'lerin ve plak şirketlerinin baktığı ilk sinyal. Dinlenme paketleri yeni parçanın ilk günlerini destekler, "Trending" listeleri için ivme oluşturur.</p>
<h2>Paket seçenekleri</h2>
<ul>
<li><strong>Global dinlenme:</strong> Yüksek hız, günlük 500K, anında başlar.</li>
<li><strong>ABD hedefli:</strong> Amerika pazarına yönelik parçalar için.</li>
<li><strong>Rusya hedefli:</strong> Doğu Avrupa/BDT kitlesi için.</li>
</ul>
<h2>Doğru kullanım</h2>
<p>Parçanın herkese açık olduğundan emin olun; özel (private) parçalara teslimat yapılamaz. Dinlenmeyi beğeni ve repost'la dengelemek profili doğal gösterir.</p>
<blockquote>Dürüst uyarı: SoundCloud, yapay dinlenmeyi tespit ederse sayacı sıfırlayabilir; ölçülü kullanın ve organik tanıtımla birleştirin.</blockquote>`,
    content_en: `<h2>Play counts on SoundCloud</h2>
<p>SoundCloud remains the first platform where independent producers share demos and remixes; the play count on a track page is the first signal DJs and labels check. Play packages support a new track's first days and build momentum for "Trending" lists.</p>
<h2>Package options</h2>
<ul>
<li><strong>Global plays:</strong> high speed, 500K per day, instant start.</li>
<li><strong>US targeted:</strong> for tracks aimed at the American market.</li>
<li><strong>Russia targeted:</strong> for Eastern Europe / CIS audiences.</li>
</ul>
<h2>Using it right</h2>
<p>Make sure the track is public; delivery to private tracks is not possible. Balancing plays with likes and reposts keeps the profile looking natural.</p>
<blockquote>Honest warning: if SoundCloud detects artificial plays it can reset the counter; use moderately and combine with organic promotion.</blockquote>`,
    faq_tr: [{ q: 'Özel parçalara dinlenme gelir mi?', a: 'Hayır; parça herkese açık olmalıdır. Gizli bağlantılı (secret link) parçalara da teslimat yapılamaz.' }],
    faq_en: [{ q: 'Do private tracks receive plays?', a: 'No; the track must be public. Delivery to secret-link tracks is not possible either.' }],
    related_blog_slugs: ['spotify-dinlenme-artirma-ve-playlist-stratejisi', 'spotify-da-organik-mi-yoksa-hizli-dinlenme-mi-dogru-stratejiyi-secmek-msuzilds']
  }),
  page({
    slug: 'instagram-canli-yayin-izleyici-satin-al', platform_key: 'instagram', category_ids: [183], sort_order: 230,
    title_tr: 'Instagram Canlı Yayın İzleyici Satın Al', title_en: 'Buy Instagram Live Viewers',
    subtitle_tr: 'Canlı yayınınızda 15, 30, 60 veya 90 dakika kalan izleyici paketleri; yayın başladıktan sonra sipariş verilir, dakikalar içinde katılır.',
    subtitle_en: 'Viewer packages that stay 15, 30, 60 or 90 minutes in your live; ordered after the stream starts, they join within minutes.',
    seo_title_tr: 'Instagram Canlı Yayın İzleyici Satın Al – 15 ila 90 Dakika Kalış', seo_title_en: 'Buy Instagram Live Viewers – 15 to 90 Minute Stay',
    seo_description_tr: 'Instagram canlı yayın izleyici satın al: 15, 30, 60 veya 90 dakika yayında kalan izleyici paketleri. Yayın başladıktan sonra sipariş, dakikalar içinde katılım.',
    seo_description_en: 'Buy Instagram live viewers: viewer packages that stay 15, 30, 60 or 90 minutes. Order after the stream starts, viewers join within minutes.',
    content_tr: `<h2>Canlı yayında izleyici sayısı</h2>
<p>Instagram canlı yayınında ekranın üstündeki izleyici sayısı, hikaye çubuğundan gelen ziyaretçinin kalıp kalmayacağını belirler; 3 izleyicili yayın hızla terk edilir. İzleyici paketleri yayının ilk dakikalarında kalabalık görünmesini sağlar, organik izleyici bu kalabalığa katılır.</p>
<h2>Paket seçenekleri</h2>
<ul>
<li><strong>15 dakika:</strong> Kısa duyuru yayınları için.</li>
<li><strong>30 ve 60 dakika:</strong> Standart soru-cevap ve ürün tanıtımı yayınları için.</li>
<li><strong>90 dakika:</strong> Uzun etkinlik ve söyleşi yayınları için.</li>
</ul>
<h2>Doğru kullanım</h2>
<p>Yayını başlatın, kullanıcı adınızı girerek sipariş verin; izleyiciler dakikalar içinde katılır. Kalış süresi yayın süresiyle uyumlu paketi seçin. Yayın bitince paket sona erer.</p>
<blockquote>Dürüst uyarı: İzleyici paketleri yorum yazmaz; yayın içinde soru yöneltip gerçek izleyiciyi konuşturmak gerekir. Instagram kuralları yapay etkileşimi onaylamaz.</blockquote>`,
    content_en: `<h2>Viewer count during a live</h2>
<p>The viewer count at the top of an Instagram live decides whether a visitor from the story bar stays; a live with 3 viewers is abandoned fast. Viewer packages make the live look busy in its first minutes so organic viewers join the crowd.</p>
<h2>Package options</h2>
<ul>
<li><strong>15 minutes:</strong> for short announcement lives.</li>
<li><strong>30 and 60 minutes:</strong> for standard Q&A and product lives.</li>
<li><strong>90 minutes:</strong> for long events and interviews.</li>
</ul>
<h2>Using it right</h2>
<p>Start the live, then order with your username; viewers join within minutes. Pick the stay duration that matches your stream length. The package ends when the live ends.</p>
<blockquote>Honest warning: viewer packages do not comment; you still need to ask questions and get real viewers talking. Instagram's rules do not endorse artificial engagement.</blockquote>`,
    faq_tr: [{ q: 'Yayın başlamadan sipariş verebilir miyim?', a: 'Hayır; izleyiciler yalnızca aktif yayına katılabilir. Önce yayını başlatın, sonra sipariş verin.' }],
    faq_en: [{ q: 'Can I order before the live starts?', a: 'No; viewers can only join an active live. Start the live first, then order.' }],
    related_blog_slugs: ['instagram-hikaye-izlenme-artirma-taktikleri', 'tiktok-canli-yayin-acma-sartlari-ve-buyume']
  })
];

(async () => {
  const db = new sqlite3.Database(dbPath);
  const run = (q, p = []) => new Promise((r, j) => db.run(q, p, function (e) { e ? j(e) : r(this); }));
  const get = (q, p = []) => new Promise((r, j) => db.get(q, p, (e, row) => e ? j(e) : r(row)));
  db.configure('busyTimeout', 5000);
  const tablo = await get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'landing_pages'");
  if (!tablo) { console.error('landing_pages tablosu yok: once sunucuyu yeni kodla baslat.'); process.exit(1); }
  let eklendi = 0;
  for (const p of PAGES) {
    if (await get('SELECT id FROM landing_pages WHERE slug = ?', [p.slug])) { console.log(`atlandi (var): ${p.slug}`); continue; }
    const result = normalizePagePayload(p);
    if (result.error) { console.error(`HATA ${p.slug}: ${result.error}`); continue; }
    const cols = Object.keys(result.fields);
    await run(`INSERT INTO landing_pages (${cols.join(', ')}, updated_at) VALUES (${cols.map(() => '?').join(', ')}, CURRENT_TIMESTAMP)`, cols.map(c => result.fields[c]));
    eklendi++;
    console.log(`eklendi: ${p.slug} (${result.fields.status})`);
  }
  console.log(`Bitti: ${eklendi} sayfa eklendi.`);
  db.close();
})().catch(err => { console.error(err); process.exit(1); });
