'use strict';

// Satis sayfalari baslangic icerigi (27 Agu 2026): 2 yayin + 5 taslak.
// Kullanim (sunucuda, deploy + restart SONRASI — tablo server acilisinda olusur):
//   cd /var/www/smmjet && node scripts/seed-landing-pages.js
// Var olan slug'lara dokunmaz (idempotent). Kategori ID'leri canli katalogdan.

const path = require('path');
const sqlite3 = require('sqlite3');
const { normalizePagePayload } = require('../utils/landingPages');

const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.join(__dirname, '..', 'database.sqlite');

const PAGES = [
  {
    slug: 'instagram-takipci-satin-al', status: 'published', platform_key: 'instagram', category_ids: [72], sort_order: 10,
    title_tr: 'Instagram Takipçi Satın Al',
    title_en: 'Buy Instagram Followers',
    subtitle_tr: 'Şifre istemeden, saniyeler içinde başlayan Instagram takipçi paketleri. Gönderili gerçek hesaplardan gelen takipçi, iptal edilebilir sipariş ve 7/24 destek.',
    subtitle_en: 'Instagram follower packages that start within seconds, no password required. Followers from real accounts with posts, cancellable orders and 24/7 support.',
    seo_title_tr: 'Instagram Takipçi Satın Al – Şifresiz, Anında Başlayan Paketler',
    seo_title_en: 'Buy Instagram Followers – Instant Start, No Password',
    seo_description_tr: 'Instagram takipçi satın al: şifresiz, saniyeler içinde başlayan paketler. Gerçek hesaplar, iptal edilebilir sipariş, güvenli ödeme ve 7/24 destek.',
    seo_description_en: 'Buy Instagram followers: packages that start within seconds with no password. Real accounts, cancellable orders, secure payment and 24/7 support.',
    content_tr: `<h2>Instagram takipçi satın almak ne işe yarar?</h2>
<p>Yeni bir hesabın ilk güven eşiğini aşması aylar sürebilir. Takipçi sayısı, ziyaretçinin profili "takip etmeye değer mi" diye ölçtüğü ilk sinyaldir; sosyal kanıt olmadan en iyi içerik bile takip edilmeden geçilir. Jet SMM Panel'deki Instagram takipçi paketleri bu ilk eşiği hızlı ve kontrollü biçimde aşmanızı sağlar: siparişiniz saniyeler içinde işleme alınır, kademeli teslimatla doğal bir büyüme eğrisi oluşturabilirsiniz.</p>
<h2>Neden Jet SMM Panel?</h2>
<ul>
<li><strong>Şifre istenmez.</strong> Yalnızca herkese açık profil bağlantınız yeterlidir; hesabınıza asla giriş yapılmaz.</li>
<li><strong>Gönderili gerçek hesaplar.</strong> Listelenen takipçi paketleri profil fotoğrafı ve gönderisi olan hesaplardan gelir; hizmet kartında kaynak ve hız bilgisi açıkça yazar.</li>
<li><strong>İptal edilebilir sipariş.</strong> "İptal Aktif" etiketli hizmetlerde teslim edilmeyen kısım bakiyenize iade edilir.</li>
<li><strong>Şeffaf fiyat.</strong> Her paketin 1000 adet fiyatı, minimum ve maksimum limiti aşağıdaki tabloda görünür; gizli ücret yoktur.</li>
<li><strong>Güvenli ödeme.</strong> Kredi kartı (PayTR), kripto para ve havale ile bakiye yükleyebilirsiniz; kart bilgileri sitede saklanmaz.</li>
</ul>
<h2>Hangi paketi seçmeliyim?</h2>
<p>Yeni ve küçük hesaplarda 100-500 adetlik küçük paketlerle başlayıp içerik akışınızla birlikte artırmanızı öneririz. Kurumsal hesaplarda mevcut takipçi sayısının %10-20'sini aşmayan artışlar hem doğal görünür hem de etkileşim oranınızı bozmaz. Hız değeri yüksek paketler (günlük 100K) büyük hesaplar içindir; küçük hesapta ani sıçrama Instagram algoritmasının dikkatini çekebilir.</p>
<h2>Dürüst uyarı</h2>
<blockquote>Satın alınan takipçi tek başına satış veya etkileşim getirmez; içerik kalitesinin yerini tutmaz. Instagram Topluluk Kuralları yapay etkileşimi onaylamaz; kademeli (drip-feed) teslimatı tercih edin ve satın alımı düzenli paylaşımla destekleyin. Yenileme (refill) kapsamı her hizmet kartında ayrıca belirtilir; "Yenileme Yok" yazan paketlerde düşüş telafisi yapılmaz.</blockquote>`,
    content_en: `<h2>What does buying Instagram followers actually do?</h2>
<p>A new account can take months to pass its first credibility threshold. Follower count is the first signal a visitor uses to decide whether a profile is worth following; without social proof even great content gets scrolled past. The Instagram follower packages on Jet SMM Panel help you cross that threshold quickly and in a controlled way: orders are processed within seconds and drip-feed delivery lets you shape a natural growth curve.</p>
<h2>Why Jet SMM Panel?</h2>
<ul>
<li><strong>No password required.</strong> Only your public profile link is needed; nobody ever logs into your account.</li>
<li><strong>Real accounts with posts.</strong> Listed packages come from accounts with profile photos and posts; source and speed are stated on every service card.</li>
<li><strong>Cancellable orders.</strong> On services tagged "Cancel Enabled", the undelivered part is refunded to your balance.</li>
<li><strong>Transparent pricing.</strong> Price per 1000, minimum and maximum limits are shown in the table below; no hidden fees.</li>
<li><strong>Secure payment.</strong> Top up with credit card (PayTR), crypto or bank transfer; card details are never stored on the site.</li>
</ul>
<h2>Which package should I pick?</h2>
<p>For new and small accounts, start with 100-500 followers and scale up alongside your content flow. For business accounts, increases that stay under 10-20% of your current follower count look natural and keep your engagement rate intact. High-speed packages (100K/day) are meant for large accounts; a sudden jump on a small account can draw the algorithm's attention.</p>
<h2>Honest warning</h2>
<blockquote>Purchased followers alone do not bring sales or engagement and never replace content quality. Instagram's Community Guidelines do not endorse artificial engagement; prefer drip-feed delivery and back the purchase with regular posting. Refill coverage is stated separately on each service card; packages marked "No Refill" are not compensated for drops.</blockquote>`,
    steps_tr: ['Ücretsiz hesap oluşturun ve kart, kripto ya da havale ile bakiye yükleyin.', 'Aşağıdaki tablodan hesabınıza uygun Instagram takipçi paketini seçin.', 'Herkese açık profil bağlantınızı ve miktarı girin; şifre istenmez.', 'Sipariş saniyeler içinde başlar; ilerlemeyi Siparişlerim sayfasından takip edin.'],
    steps_en: ['Create a free account and top up with card, crypto or bank transfer.', 'Pick the Instagram follower package that fits your account from the table below.', 'Enter your public profile link and the quantity; no password needed.', 'The order starts within seconds; track progress on the My Orders page.'],
    faq_tr: [
      { q: 'Instagram takipçi satın almak için şifre vermem gerekir mi?', a: 'Hayır. Yalnızca herkese açık profil bağlantınız istenir. Hesabınıza giriş yapılmaz; profiliniz gizli (private) ise sipariş işlenemez, sipariş süresince herkese açık tutun.' },
      { q: 'Takipçiler ne zaman gelmeye başlar?', a: 'Çoğu pakette sipariş saniyeler içinde işleme alınır ve ilk takipçiler dakikalar içinde görünür. Her hizmetin tahmini başlama süresi ve günlük hızı hizmet kartında yazar.' },
      { q: 'Takipçiler düşer mi, telafi var mı?', a: 'Gönderili gerçek hesaplardan gelen paketlerde düşüş genellikle %0-3 aralığındadır. Yenileme (refill) kapsamı hizmete göre değişir ve kartta açıkça belirtilir; "Yenileme Yok" yazan paketlerde düşüş telafisi yapılmaz, bu nedenle küçük paketle test etmenizi öneririz.' },
      { q: 'Hesabım kapanır mı?', a: 'Takipçi satın almak hesap şifresi gerektirmediği için hesabınız ele geçirilemez. Yine de yapay etkileşim Instagram kurallarına aykırıdır; ani ve aşırı artışlardan kaçının, kademeli teslimatı tercih edin ve satın alımı düzenli içerikle destekleyin.' },
      { q: 'Minimum sipariş miktarı nedir?', a: 'Paketlere göre değişir; çoğu Instagram takipçi paketinde minimum 100, maksimum 100K-5M adettir. Tablodaki "Min / Max" sütununda her paketin sınırı yazar.' },
      { q: 'Hangi ödeme yöntemleri var?', a: 'Kredi/banka kartı (PayTR), kripto para ve banka havalesi ile bakiye yükleyebilirsiniz. Bakiye onaylandığı anda hesabınıza yansır ve dilediğiniz kadar sipariş için kullanılır.' }
    ],
    faq_en: [
      { q: 'Do I need to give my password to buy Instagram followers?', a: 'No. Only your public profile link is required. Nobody logs into your account; if your profile is private the order cannot be processed, so keep it public while the order runs.' },
      { q: 'When do the followers start arriving?', a: 'Most packages are processed within seconds and the first followers appear within minutes. The estimated start time and daily speed are stated on each service card.' },
      { q: 'Will the followers drop? Is there a refill?', a: 'Packages sourced from real accounts with posts usually see 0-3% drop. Refill coverage varies by service and is clearly stated on the card; packages marked "No Refill" are not compensated, so we recommend testing with a small package first.' },
      { q: 'Can my account get banned?', a: 'Buying followers does not require your password, so your account cannot be taken over. Artificial engagement is still against Instagram\'s rules; avoid sudden spikes, prefer drip-feed delivery and support the purchase with regular content.' },
      { q: 'What is the minimum order?', a: 'It depends on the package; most Instagram follower packages have a minimum of 100 and a maximum of 100K-5M. The "Min / Max" column in the table shows each package\'s limits.' },
      { q: 'Which payment methods are available?', a: 'You can top up with credit/debit card (PayTR), cryptocurrency or bank transfer. The balance is credited as soon as the payment is confirmed and can be used for any number of orders.' }
    ],
    cta_text_tr: 'Ücretsiz Hesap Oluştur ve Sipariş Ver', cta_text_en: 'Create a Free Account and Order',
    related_blog_slugs: ['instagram-takipci-dususu-nedenleri-ve-cozumleri', '2026-instagram-kesfet-taktikleri', 'organik-buyume-vs-satin-alma-karsilastirmasi', 'smm-panel-nedir-nasil-kullanilir']
  },
  {
    slug: 'tiktok-takipci-satin-al', status: 'published', platform_key: 'tiktok', category_ids: [239], sort_order: 20,
    title_tr: 'TikTok Takipçi Satın Al',
    title_en: 'Buy TikTok Followers',
    subtitle_tr: 'TikTok hesabınız için anında başlayan, iptal edilebilir takipçi paketleri. Şifre istenmez; sipariş saniyeler içinde işleme alınır.',
    subtitle_en: 'Instant-start, cancellable TikTok follower packages. No password required; orders are processed within seconds.',
    seo_title_tr: 'TikTok Takipçi Satın Al – Anında Başlayan, İptal Edilebilir Paketler',
    seo_title_en: 'Buy TikTok Followers – Instant Start, Cancellable Packages',
    seo_description_tr: 'TikTok takipçi satın al: şifre istemeyen, saniyeler içinde başlayan takipçi paketleri. Şeffaf fiyat, iptal edilebilir sipariş, güvenli ödeme ve 7/24 destek.',
    seo_description_en: 'Buy TikTok followers: packages that start within seconds with no password. Transparent pricing, cancellable orders, secure payment and 24/7 support.',
    content_tr: `<h2>TikTok'ta takipçi sayısı neden önemli?</h2>
<p>TikTok algoritması dağıtımı takipçi sayısına değil videonun ilk saatteki performansına göre yapar; yine de takipçi sayısı profil ziyaretçisinin karar verdiği ilk eşiktir. 1.000 takipçi barajı canlı yayın açma hakkı için de şarttır. Jet SMM Panel'deki TikTok takipçi paketleri bu eşikleri hızlı geçmenize yardımcı olur; kalan işi düzenli video akışınız ve güçlü kancalarınız yapar.</p>
<h2>Paket özellikleri</h2>
<ul>
<li><strong>Anında başlangıç.</strong> Sipariş saniyeler içinde işleme alınır; günlük 100K'ya varan hız.</li>
<li><strong>İptal edilebilir.</strong> Teslim edilmeyen kısım bakiyenize iade edilir.</li>
<li><strong>Şifre istenmez.</strong> Yalnızca herkese açık profil bağlantınız yeterlidir.</li>
<li><strong>Şeffaf kalite etiketi.</strong> Hizmet adında hesap kalitesi (LQ/HQ), maksimum adet ve yenileme durumu açıkça yazar; sürpriz yoktur.</li>
</ul>
<h2>Nasıl kullanmalı?</h2>
<p>Takipçi paketini yeni bir video yayınlamadan hemen önce veya sonra değil, düzenli paylaşım yaptığınız bir haftanın ortasında kullanmanızı öneririz: profil ziyaretlerinin arttığı dönemde sosyal kanıt en çok işe yarar. Küçük hesaplarda 100-500 adetle başlayın; sonuçları 48-72 saat sonra TikTok Analytics'ten ölçün.</p>
<h2>Dürüst uyarı</h2>
<blockquote>Bu sayfadaki ekonomik paketler profil doldurma amaçlıdır; satın alınan takipçi videolarınızı izlemez, beğenmez ve Keşfet dağıtımını doğrudan artırmaz. Hesap güvenilirliği için içerik kalitesi ve tamamlanma oranı her zaman daha belirleyicidir. "Yenileme Yok" etiketli paketlerde düşüş telafisi yapılmaz.</blockquote>`,
    content_en: `<h2>Why does follower count matter on TikTok?</h2>
<p>TikTok's algorithm distributes videos based on first-hour performance rather than follower count, yet followers remain the first threshold a profile visitor judges. The 1,000-follower mark is also required to go live. The TikTok follower packages on Jet SMM Panel help you clear those thresholds fast; your regular video flow and strong hooks do the rest.</p>
<h2>Package features</h2>
<ul>
<li><strong>Instant start.</strong> Orders are processed within seconds; speeds up to 100K per day.</li>
<li><strong>Cancellable.</strong> The undelivered part is refunded to your balance.</li>
<li><strong>No password.</strong> Only your public profile link is required.</li>
<li><strong>Transparent quality label.</strong> Account quality (LQ/HQ), maximum quantity and refill status are stated in the service name; no surprises.</li>
</ul>
<h2>How to use it well</h2>
<p>Use the package in the middle of a week of regular posting rather than right before or after a single video: social proof works best when profile visits are already rising. Start with 100-500 on small accounts and measure results in TikTok Analytics after 48-72 hours.</p>
<h2>Honest warning</h2>
<blockquote>The budget packages on this page are meant to fill out a profile; purchased followers do not watch or like your videos and do not directly increase For You distribution. Content quality and completion rate always matter more for account credibility. Packages marked "No Refill" are not compensated for drops.</blockquote>`,
    steps_tr: ['Ücretsiz hesap oluşturun ve bakiye yükleyin.', 'Tablodan TikTok takipçi paketini seçin.', 'Herkese açık TikTok profil bağlantınızı ve miktarı girin.', 'Sipariş anında başlar; Siparişlerim sayfasından takip edin.'],
    steps_en: ['Create a free account and top up your balance.', 'Choose a TikTok follower package from the table.', 'Enter your public TikTok profile link and the quantity.', 'The order starts instantly; track it on the My Orders page.'],
    faq_tr: [
      { q: 'TikTok takipçi satın almak güvenli mi?', a: 'Şifre istenmediği için hesabınız ele geçirilemez. Ancak yapay etkileşim TikTok kurallarına aykırıdır; kademeli kullanın ve düzenli içerikle destekleyin.' },
      { q: 'Canlı yayın için 1000 takipçi barajını geçer miyim?', a: 'Takipçi sayınız 1000\'i geçtiğinde TikTok canlı yayın seçeneğini açar; bu genellikle birkaç saat ile 48 saat arasında güncellenir. Yaş ve bölge şartları ayrıca geçerlidir.' },
      { q: 'Takipçiler düşer mi?', a: 'Ekonomik paketlerde zamanla düşüş olabilir. "Yenileme Yok" etiketli paketlerde telafi yapılmaz; küçük miktarla test edip sonucu görmenizi öneririz.' },
      { q: 'Sipariş ne kadar sürede tamamlanır?', a: 'Sipariş saniyeler içinde başlar; tamamlanma süresi miktara ve paketin günlük hızına bağlıdır. Hız bilgisi hizmet kartında yazar.' },
      { q: 'Profilim gizliyse ne olur?', a: 'Gizli profillere teslimat yapılamaz. Sipariş süresince profilinizi herkese açık tutun; aksi halde sipariş tamamlanamaz.' }
    ],
    faq_en: [
      { q: 'Is buying TikTok followers safe?', a: 'Your account cannot be taken over because no password is required. Artificial engagement is still against TikTok\'s rules; use it gradually and support it with regular content.' },
      { q: 'Will I pass the 1,000-follower mark for going live?', a: 'TikTok unlocks the live option once you exceed 1,000 followers, usually within a few hours to 48 hours. Age and region requirements still apply.' },
      { q: 'Will the followers drop?', a: 'Budget packages may see drops over time. Packages marked "No Refill" are not compensated; we recommend testing with a small quantity first.' },
      { q: 'How long does the order take?', a: 'The order starts within seconds; completion depends on the quantity and the package\'s daily speed, which is stated on the service card.' },
      { q: 'What if my profile is private?', a: 'Delivery to private profiles is not possible. Keep your profile public while the order runs; otherwise it cannot complete.' }
    ],
    cta_text_tr: 'Hemen Başla', cta_text_en: 'Get Started',
    related_blog_slugs: ['tiktok-hesap-buyutme-stratejileri-2026', 'tiktok-algoritmasi-nasil-calisir', 'tiktok-ta-viral-olmak-begeni-ve-izlenme-sayisinin-algoritmaya-etkisi-msvofnwa']
  },
  {
    slug: 'instagram-begeni-satin-al', status: 'draft', platform_key: 'instagram', category_ids: [30, 182], sort_order: 30,
    title_tr: 'Instagram Beğeni Satın Al',
    title_en: 'Buy Instagram Likes',
    subtitle_tr: 'Gönderi ve Reels için anında başlayan Instagram beğeni paketleri. Profil fotoğraflı hesaplar, düşük düşüş, şeffaf fiyat.',
    subtitle_en: 'Instant-start Instagram like packages for posts and Reels. Accounts with profile photos, low drop, transparent pricing.',
    seo_title_tr: 'Instagram Beğeni Satın Al – Anında Başlayan, Düşük Düşüşlü Paketler',
    seo_title_en: 'Buy Instagram Likes – Instant Start, Low Drop',
    seo_description_tr: 'Instagram beğeni satın al: gönderi ve Reels için saniyeler içinde başlayan beğeni paketleri. Profil fotoğraflı hesaplar, düşük düşüş, şifresiz ve güvenli ödeme.',
    seo_description_en: 'Buy Instagram likes: packages for posts and Reels that start within seconds. Accounts with profile photos, low drop, no password and secure payment.',
    content_tr: `<h2>Beğeni satın almak gönderinize ne katar?</h2>
<p>Instagram, yayınlanan gönderiyi önce küçük bir kitleye gösterir ve ilk saatteki beğeni, kaydetme ve paylaşım oranına göre daha geniş dağıtıma karar verir. İlk beğeniler geç gelirse gönderi bu "test" aşamasını zayıf geçer. Beğeni paketleri, özellikle küçük ve orta ölçekli hesaplarda bu ilk sosyal kanıtı hızlı oluşturmanıza yardımcı olur; ayrıca profil ziyaretçisinin gördüğü beğeni sayısı güven sinyalidir.</p>
<h2>Paket türleri</h2>
<ul>
<li><strong>Standart beğeni:</strong> Yüksek hız, karışık hesaplar; ekonomik seçenek.</li>
<li><strong>Profil fotoğraflı hesaplardan beğeni:</strong> Düşük düşüş oranı, günlük 100K'ya varan hız; maksimum 10M adet.</li>
<li><strong>Görüntülenme + beğeni:</strong> Reels ve video gönderilerde izlenme ile birlikte %10-20 beğeni; oran doğal kalır.</li>
</ul>
<h2>Doğru kullanım</h2>
<p>Beğeni sayısını mevcut takipçi sayınızla orantılı tutun: 1.000 takipçili hesapta 5.000 beğeni doğal görünmez. Yayından sonraki ilk 30-60 dakikada başlayan kademeli teslimat en iyi sonucu verir. Instagram beğeni satın alırken gönderinin herkese açık olduğundan emin olun.</p>
<blockquote>Dürüst uyarı: Beğeni, gönderinin kalitesini değiştirmez; yalnızca dağıtım eşiğini geçmeye yardımcı olur. Instagram kuralları yapay etkileşimi onaylamaz; kademeli teslimat ve düzenli içerik şarttır. Yenileme kapsamı hizmet kartında yazar.</blockquote>`,
    content_en: `<h2>What do purchased likes add to your post?</h2>
<p>Instagram first shows a new post to a small audience and decides on wider distribution based on the like, save and share rate in the first hour. If early likes arrive late, the post fails that "test" phase. Like packages help small and mid-sized accounts build that first social proof quickly; the like count a profile visitor sees is also a trust signal.</p>
<h2>Package types</h2>
<ul>
<li><strong>Standard likes:</strong> high speed, mixed accounts; the budget option.</li>
<li><strong>Likes from accounts with profile photos:</strong> low drop rate, speeds up to 100K per day; up to 10M per order.</li>
<li><strong>Views + likes:</strong> for Reels and video posts, 10-20% likes delivered alongside views so the ratio stays natural.</li>
</ul>
<h2>Using it right</h2>
<p>Keep the like count proportional to your follower count: 5,000 likes on a 1,000-follower account does not look natural. Drip-feed delivery that starts within 30-60 minutes of posting gives the best results. Make sure the post is public before ordering.</p>
<blockquote>Honest warning: likes do not change the quality of a post; they only help clear the distribution threshold. Instagram's rules do not endorse artificial engagement, so drip-feed delivery and regular content are essential. Refill coverage is stated on each service card.</blockquote>`,
    steps_tr: ['Hesap oluşturup bakiye yükleyin.', 'Beğeni paketini seçin.', 'Gönderi veya Reels bağlantısını ve miktarı girin.', 'Sipariş saniyeler içinde başlar.'],
    steps_en: ['Create an account and top up.', 'Pick a like package.', 'Enter the post or Reels link and the quantity.', 'The order starts within seconds.'],
    faq_tr: [
      { q: 'Instagram beğeni satın almak için ne gerekir?', a: 'Yalnızca herkese açık gönderi veya Reels bağlantısı. Şifre istenmez, hesabınıza giriş yapılmaz.' },
      { q: 'Beğeniler ne kadar sürede gelir?', a: 'Sipariş saniyeler içinde başlar; küçük siparişler dakikalar içinde tamamlanır, büyük siparişler paketin günlük hızına göre ilerler.' },
      { q: 'Beğeniler düşer mi?', a: 'Profil fotoğraflı hesaplardan gelen paketlerde düşüş düşüktür. Yenileme kapsamı hizmete göre değişir ve kartta yazar.' },
      { q: 'Reels için beğeni alabilir miyim?', a: 'Evet; Reels bağlantısı gönderi bağlantısı gibi kabul edilir. İzlenme ile birlikte beğeni almak istiyorsanız "Görüntülenme + Beğeni" paketini seçin.' },
      { q: 'Kaç beğeni almalıyım?', a: 'Takipçi sayınızın %5-15\'i kadar beğeni doğal bir orandır. Önce küçük paketle deneyin, sonucu görüp artırın.' }
    ],
    faq_en: [
      { q: 'What do I need to buy Instagram likes?', a: 'Only a public post or Reels link. No password is required and nobody logs into your account.' },
      { q: 'How fast do the likes arrive?', a: 'The order starts within seconds; small orders complete within minutes, larger ones progress at the package\'s daily speed.' },
      { q: 'Will the likes drop?', a: 'Packages from accounts with profile photos have a low drop rate. Refill coverage varies by service and is stated on the card.' },
      { q: 'Can I buy likes for Reels?', a: 'Yes; a Reels link is accepted like a post link. Choose the "Views + Likes" package if you want likes delivered alongside views.' },
      { q: 'How many likes should I buy?', a: 'Likes equal to 5-15% of your follower count is a natural ratio. Try a small package first, review the result and scale up.' }
    ],
    cta_text_tr: 'Ücretsiz Hesap Oluştur', cta_text_en: 'Create a Free Account',
    related_blog_slugs: ['instagram-begeni-satin-almanin-guvenli-yollari-2026-rehberi-msuz2k2w', 'sosyal-medya-etkilesim-orani-hesaplama-rehberi', 'instagram-golge-yasagi-shadowban-nedir-nasil-kalkar']
  },
  {
    slug: 'tiktok-izlenme-satin-al', status: 'draft', platform_key: 'tiktok', category_ids: [235, 237], sort_order: 40,
    title_tr: 'TikTok İzlenme Satın Al',
    title_en: 'Buy TikTok Views',
    subtitle_tr: 'Videonuzun ilk dağıtım dalgasını genişleten, anında başlayan TikTok izlenme paketleri. Sınırsız maksimum, 30 gün yenilemeli seçenekler.',
    subtitle_en: 'Instant-start TikTok view packages that widen your video\'s first distribution wave. Unlimited maximum, options with 30-day refill.',
    seo_title_tr: 'TikTok İzlenme Satın Al – Anında Başlayan, Yenilemeli Paketler',
    seo_title_en: 'Buy TikTok Views – Instant Start, Refill Options',
    seo_description_tr: 'TikTok izlenme satın al: saniyeler içinde başlayan, günlük 1M hıza ulaşan izlenme paketleri. 30 gün yenilemeli seçenekler, şeffaf fiyat ve güvenli ödeme.',
    seo_description_en: 'Buy TikTok views: packages that start within seconds and reach 1M per day. Options with 30-day refill, transparent pricing and secure payment.',
    content_tr: `<h2>İzlenme TikTok algoritmasını nasıl etkiler?</h2>
<p>TikTok her videoyu önce küçük bir test kitlesine gösterir; izlenme, tamamlanma ve paylaşım oranı yeterliyse bir sonraki dağıtım halkasına geçer. İzlenme paketi bu ilk halkayı genişletir: video daha çok kişiye ulaşır, doğal izleyicilerden gelen tamamlanma ve etkileşim sinyali de büyür. En düşük 1000 adet fiyatıyla en ekonomik büyüme desteğidir.</p>
<h2>Paket seçenekleri</h2>
<ul>
<li><strong>Yüksek kalite, 30 gün yenileme:</strong> İptal aktif, günlük 1M hız, sınırsız maksimum.</li>
<li><strong>Yenilemesiz ekonomik:</strong> En düşük fiyat; düşüş olursa telafi yapılmaz.</li>
<li><strong>Görüntülenme + paylaşım:</strong> İzlenme ile birlikte paylaşım sinyali; algoritmanın en güçlü ikinci sinyalini besler.</li>
</ul>
<h2>Doğru kullanım</h2>
<p>İzlenmeyi yayından sonraki ilk saat içinde ve kademeli gönderimle kullanın. İzlenme artarken beğeni oranının bozulmaması için orantılı beğeni desteği ekleyebilirsiniz. Sonuçları 48-72 saat sonra TikTok Analytics'ten ölçüp bir sonraki videonun kurgusunu güncelleyin.</p>
<blockquote>Dürüst uyarı: İzlenme tamamlanma oranını yükseltmez; kanca zayıfsa daha geniş kitle de erken terk eder. Satın alma yalnızca iyi videonun görülme şansını artırır.</blockquote>`,
    content_en: `<h2>How do views affect the TikTok algorithm?</h2>
<p>TikTok first shows every video to a small test audience; if the view, completion and share rates are good enough, it moves to the next distribution ring. A view package widens that first ring: the video reaches more people and the completion and engagement signals from organic viewers grow too. With the lowest price per 1000 it is the most economical growth support.</p>
<h2>Package options</h2>
<ul>
<li><strong>High quality, 30-day refill:</strong> cancel enabled, 1M per day, unlimited maximum.</li>
<li><strong>Budget without refill:</strong> lowest price; drops are not compensated.</li>
<li><strong>Views + shares:</strong> a share signal delivered alongside views; feeds the algorithm's second-strongest signal.</li>
</ul>
<h2>Using it right</h2>
<p>Use views within the first hour after posting and with drip-feed delivery. You can add proportional like support so the like ratio stays intact as views climb. Measure results in TikTok Analytics after 48-72 hours and adjust the structure of your next video.</p>
<blockquote>Honest warning: views do not raise your completion rate; if the hook is weak a wider audience will also leave early. Buying views only increases a good video's chance of being seen.</blockquote>`,
    steps_tr: ['Hesap oluşturup bakiye yükleyin.', 'İzlenme paketini seçin (yenilemeli veya ekonomik).', 'Video bağlantısını ve miktarı girin.', 'Sipariş anında başlar; ilerlemeyi Siparişlerim sayfasından izleyin.'],
    steps_en: ['Create an account and top up.', 'Choose a view package (with refill or budget).', 'Enter the video link and the quantity.', 'The order starts instantly; track it on the My Orders page.'],
    faq_tr: [
      { q: 'TikTok izlenme satın almak hesabıma zarar verir mi?', a: 'Şifre istenmez, hesabınıza giriş yapılmaz. Yapay etkileşim TikTok kurallarına aykırı olduğundan kademeli teslimatı tercih edin ve gerçek içerikle destekleyin.' },
      { q: 'İzlenmeler sayılır mı, düşer mi?', a: 'İzlenmeler video sayacına yansır. 30 gün yenilemeli paketlerde düşüş süre içinde telafi edilir; yenilemesiz paketlerde telafi yoktur.' },
      { q: 'Ne kadar hızlı gelir?', a: 'Sipariş saniyeler içinde başlar; hız paketine göre günlük 1M\'ye kadar çıkar.' },
      { q: 'İzlenme Keşfet\'e (For You) çıkarır mı?', a: 'Doğrudan değil. İzlenme ilk dağıtım halkasını genişletir; For You dağıtımına tamamlanma oranı, paylaşım ve yorum sinyalleri karar verir.' },
      { q: 'Minimum kaç izlenme alabilirim?', a: 'Çoğu pakette minimum 100 adettir; maksimum sınırsızdır.' }
    ],
    faq_en: [
      { q: 'Does buying TikTok views harm my account?', a: 'No password is required and nobody logs into your account. Artificial engagement is against TikTok\'s rules, so prefer drip-feed delivery and back it with real content.' },
      { q: 'Do the views count, and will they drop?', a: 'Views are reflected in the video counter. Packages with 30-day refill compensate drops within that period; packages without refill do not.' },
      { q: 'How fast do they arrive?', a: 'The order starts within seconds; speed reaches up to 1M per day depending on the package.' },
      { q: 'Will views get me onto the For You page?', a: 'Not directly. Views widen the first distribution ring; For You distribution is decided by completion rate, shares and comments.' },
      { q: 'What is the minimum I can order?', a: 'Most packages have a minimum of 100 views; the maximum is unlimited.' }
    ],
    cta_text_tr: 'Ücretsiz Hesap Oluştur', cta_text_en: 'Create a Free Account',
    related_blog_slugs: ['tiktok-algoritmasi-nasil-calisir', 'tiktok-ta-viral-olmak-begeni-ve-izlenme-sayisinin-algoritmaya-etkisi-msvofnwa', 'tiktok-hesap-buyutme-stratejileri-2026']
  },
  {
    slug: 'telegram-uye-satin-al', status: 'draft', platform_key: 'telegram', category_ids: [219, 216], sort_order: 50,
    title_tr: 'Telegram Üye Satın Al',
    title_en: 'Buy Telegram Members',
    subtitle_tr: 'Kanal ve gruplar için anında başlayan Telegram üye paketleri. Yüksek kaliteli hesaplar, 3/7/30 gün yenilemeli seçenekler, iptal edilebilir sipariş.',
    subtitle_en: 'Instant-start Telegram member packages for channels and groups. High-quality accounts, options with 3/7/30-day refill, cancellable orders.',
    seo_title_tr: 'Telegram Üye Satın Al – Kanal ve Grup İçin Yenilemeli Paketler',
    seo_title_en: 'Buy Telegram Members – Refill Packages for Channels and Groups',
    seo_description_tr: 'Telegram üye satın al: kanal ve grup için anında başlayan üye paketleri. Yüksek kaliteli hesaplar, 30 güne kadar yenileme, iptal edilebilir sipariş.',
    seo_description_en: 'Buy Telegram members: packages for channels and groups that start within seconds. High-quality accounts, refill up to 30 days, cancellable orders.',
    content_tr: `<h2>Telegram kanalında üye sayısı neden kritik?</h2>
<p>Telegram'da algoritma yoktur; kanalınız yalnızca üyelerinize ulaşır. Bu yüzden üye sayısı hem erişiminizin sınırı hem de yeni gelenin "bu kanal canlı mı" sorusuna verdiği ilk yanıttır. Boş görünen bir kanala kimse katılmaz. Jet SMM Panel'deki Telegram üye paketleri kanalınızı ilk güven eşiğinin üstüne taşır; içerik düzeniniz ve çapraz tanıtımınız kalan büyümeyi getirir.</p>
<h2>Paket özellikleri</h2>
<ul>
<li><strong>Yüksek kaliteli (HQ) hesaplar,</strong> maksimum 1M adet, süper anında başlangıç.</li>
<li><strong>Yenileme seçenekleri:</strong> 3, 7 veya 30 gün yenilemeli paketler; yenilemesiz ekonomik seçenek.</li>
<li><strong>Gerçek kullanıcı abone paketi:</strong> Dünya geneli, günlük 1K hızla doğal artış.</li>
<li><strong>İptal aktif:</strong> Teslim edilmeyen kısım bakiyenize döner.</li>
</ul>
<h2>Sipariş öncesi kontrol listesi</h2>
<p>Kanal veya grup bağlantınız herkese açık olmalı (t.me/kanaladi biçiminde); özel davet bağlantılarına teslimat yapılamaz. Gruplarda "yeni üye onayı" kapalı olmalıdır. Büyük siparişleri kademeli verin; Telegram, kısa sürede gelen yüksek üye artışını spam olarak işaretleyebilir.</p>
<blockquote>Dürüst uyarı: Satın alınan üyeler mesajlarınızı okumaz ve görüntülenme sayınızı artırmaz; görüntülenme için ayrı paketler vardır. Üye/görüntülenme oranı çok düşük kanallar ziyaretçiye "şişirilmiş" görünür; üye ile birlikte gönderi görüntülenme desteği almanız daha doğal sonuç verir.</blockquote>`,
    content_en: `<h2>Why is member count critical on a Telegram channel?</h2>
<p>Telegram has no algorithm; your channel only reaches its members. Member count is therefore both the ceiling of your reach and the first answer a newcomer gets to "is this channel alive?". Nobody joins a channel that looks empty. The Telegram member packages on Jet SMM Panel lift your channel above that first credibility threshold; your content routine and cross-promotion bring the rest.</p>
<h2>Package features</h2>
<ul>
<li><strong>High-quality (HQ) accounts,</strong> up to 1M per order, super instant start.</li>
<li><strong>Refill options:</strong> packages with 3, 7 or 30-day refill; a budget option without refill.</li>
<li><strong>Real-user subscriber package:</strong> worldwide, natural growth at 1K per day.</li>
<li><strong>Cancel enabled:</strong> the undelivered part returns to your balance.</li>
</ul>
<h2>Pre-order checklist</h2>
<p>Your channel or group link must be public (t.me/channelname); delivery to private invite links is not possible. In groups, "approve new members" must be off. Place large orders gradually; Telegram may flag a sudden member surge as spam.</p>
<blockquote>Honest warning: purchased members do not read your posts or raise your view count; there are separate packages for views. Channels with a very low member-to-view ratio look "inflated" to visitors; pairing members with post view support gives a more natural result.</blockquote>`,
    steps_tr: ['Hesap oluşturup bakiye yükleyin.', 'Üye paketini seçin (yenileme süresine göre).', 'Herkese açık kanal/grup bağlantısını ve miktarı girin.', 'Sipariş anında başlar; ilerlemeyi Siparişlerim sayfasından izleyin.'],
    steps_en: ['Create an account and top up.', 'Choose a member package by refill period.', 'Enter your public channel/group link and the quantity.', 'The order starts instantly; track it on the My Orders page.'],
    faq_tr: [
      { q: 'Özel (private) kanala üye gönderilir mi?', a: 'Hayır. Yalnızca herkese açık t.me bağlantılarına teslimat yapılır. Siparişten önce kanalınızı herkese açık yapın; sonra tekrar gizleyebilirsiniz.' },
      { q: 'Üyeler düşer mi?', a: 'Zamanla bir kısmı ayrılabilir. 3/7/30 gün yenilemeli paketlerde düşüş süre içinde telafi edilir; yenilemesiz pakette telafi yoktur.' },
      { q: 'Üyeler gönderilerimi görüntüler mi?', a: 'Hayır; üye paketleri yalnızca üye sayısını artırır. Görüntülenme için Telegram gönderi görüntülenme paketleri ayrıca sunulur.' },
      { q: 'Ne kadar sürede tamamlanır?', a: 'Başlangıç anında; günlük 100K hızla ilerler. 10K üye çoğunlukla birkaç saat içinde tamamlanır.' },
      { q: 'Telegram kanalımı kapatır mı?', a: 'Şifre istenmediği için hesap güvenliğiniz etkilenmez. Ani ve aşırı artış spam sinyali üretebilir; kademeli sipariş verin.' }
    ],
    faq_en: [
      { q: 'Can members be delivered to a private channel?', a: 'No. Delivery only works for public t.me links. Make your channel public before ordering; you can make it private again afterwards.' },
      { q: 'Will the members drop?', a: 'Some may leave over time. Packages with 3/7/30-day refill compensate drops within that period; the package without refill does not.' },
      { q: 'Will the members view my posts?', a: 'No; member packages only increase the member count. Telegram post view packages are offered separately.' },
      { q: 'How long does it take?', a: 'It starts instantly and progresses at up to 100K per day. 10K members usually complete within a few hours.' },
      { q: 'Can my Telegram channel get banned?', a: 'No password is required, so your account security is unaffected. A sudden, extreme surge can produce a spam signal; order gradually.' }
    ],
    cta_text_tr: 'Ücretsiz Hesap Oluştur', cta_text_en: 'Create a Free Account',
    related_blog_slugs: ['telegram-kanal-uye-artirma-rehberi', 'sosyal-medya-hesap-guvenligi-rehberi', 'smm-panel-odeme-guvenligi-rehberi']
  },
  {
    slug: 'twitter-takipci-satin-al', status: 'draft', platform_key: 'x-twitter', category_ids: [246, 249], sort_order: 60,
    title_tr: 'Twitter (X) Takipçi Satın Al',
    title_en: 'Buy Twitter (X) Followers',
    subtitle_tr: 'X hesabınız için eski hesaplardan gelen, anında başlayan takipçi paketleri. Günlük 50K hız, ABD odaklı seçenek, şifresiz sipariş.',
    subtitle_en: 'Instant-start follower packages for your X account from aged accounts. 50K per day, a US-focused option, no password needed.',
    seo_title_tr: 'Twitter (X) Takipçi Satın Al – Eski Hesaplardan, Anında Başlayan',
    seo_title_en: 'Buy Twitter (X) Followers – Aged Accounts, Instant Start',
    seo_description_tr: 'Twitter (X) takipçi satın al: eski hesaplardan gelen, saniyeler içinde başlayan takipçi paketleri. ABD odaklı seçenek, şeffaf fiyat, şifresiz ve güvenli ödeme.',
    seo_description_en: 'Buy Twitter (X) followers: packages from aged accounts that start within seconds. A US-focused option, transparent pricing, no password and secure payment.',
    content_tr: `<h2>X'te takipçi sayısı neyi değiştirir?</h2>
<p>X'in "Sizin için" akışı etkileşime göre dağıtım yapsa da profil ziyaretçisi ve marka iş birlikleri hâlâ takipçi sayısına bakar. Az takipçili bir hesabın thread'i ne kadar iyi olursa olsun "kim bu" filtresine takılır. Takipçi paketleri profilinizi ilk güven eşiğinin üstüne taşır; düzenli thread, yanıt ve alıntı stratejiniz etkileşimi getirir.</p>
<h2>Paket seçenekleri</h2>
<ul>
<li><strong>Eski hesaplardan takipçi:</strong> Günlük 20K hız, anında başlangıç.</li>
<li><strong>Düşüşsüz takipçi:</strong> Şu ana kadar düşüş görülmeyen paket, günlük 50K.</li>
<li><strong>ABD takipçi:</strong> ABD odaklı profiller, maksimum 10K, 0-30 dakikada başlar; İngilizce içerik üreten hesaplar için.</li>
<li><strong>Ekonomik:</strong> Yenilemesiz, hızlı teslimat.</li>
</ul>
<h2>Doğru kullanım</h2>
<p>Takipçiyi etkileşimle dengeleyin: takipçisi çok, beğenisi sıfır profil güven vermez. Aynı dönemde tweet görüntülenme ve beğeni desteği almak oranı doğal tutar. Kurumsal hesaplarda mevcut takipçinin %20'sini aşmayan kademeli artışlar önerilir.</p>
<blockquote>Dürüst uyarı: X, sahte etkileşimi kurallarında yasaklar; satın alınan takipçi içerik üretmez, yanıt vermez. "Yenileme Yok" etiketli paketlerde düşüş telafisi yapılmaz.</blockquote>`,
    content_en: `<h2>What does follower count change on X?</h2>
<p>Even though X's "For you" feed distributes by engagement, profile visitors and brand partners still look at follower count. A great thread from a low-follower account gets stuck at the "who is this?" filter. Follower packages lift your profile above that first credibility threshold; a steady thread, reply and quote strategy brings the engagement.</p>
<h2>Package options</h2>
<ul>
<li><strong>Followers from aged accounts:</strong> 20K per day, instant start.</li>
<li><strong>No-drop followers:</strong> a package with no drops observed so far, 50K per day.</li>
<li><strong>US followers:</strong> US-focused profiles, up to 10K, starts within 0-30 minutes; for accounts posting in English.</li>
<li><strong>Budget:</strong> no refill, fast delivery.</li>
</ul>
<h2>Using it right</h2>
<p>Balance followers with engagement: a profile with many followers and zero likes does not build trust. Adding tweet view and like support in the same period keeps the ratio natural. For business accounts, gradual increases under 20% of current followers are recommended.</p>
<blockquote>Honest warning: X's rules prohibit fake engagement; purchased followers do not create content or reply. Packages marked "No Refill" are not compensated for drops.</blockquote>`,
    steps_tr: ['Hesap oluşturup bakiye yükleyin.', 'Takipçi paketini seçin.', 'X profil bağlantınızı ve miktarı girin; profil herkese açık olmalı.', 'Sipariş anında başlar.'],
    steps_en: ['Create an account and top up.', 'Choose a follower package.', 'Enter your X profile link and the quantity; the profile must be public.', 'The order starts instantly.'],
    faq_tr: [
      { q: 'Twitter takipçi satın almak için şifre gerekir mi?', a: 'Hayır. Yalnızca herkese açık profil bağlantınız yeterlidir.' },
      { q: 'Takipçiler düşer mi?', a: '"Düşüşsüz" etiketli pakette bugüne kadar düşüş gözlenmemiştir; ekonomik pakette düşüş olabilir ve telafi yapılmaz.' },
      { q: 'Türk takipçi var mı?', a: 'Şu an listede eski hesaplardan gelen global ve ABD odaklı paketler vardır. Katalog güncellendikçe yeni seçenekler bu sayfada otomatik görünür.' },
      { q: 'Ne kadar sürede tamamlanır?', a: 'Başlangıç anında; hız pakete göre günlük 20K-50K. 1.000 takipçi genellikle bir saat içinde tamamlanır.' },
      { q: 'Korumalı (protected) hesaba teslimat yapılır mı?', a: 'Hayır. Sipariş süresince hesabınız herkese açık olmalıdır.' }
    ],
    faq_en: [
      { q: 'Do I need a password to buy Twitter followers?', a: 'No. Only your public profile link is required.' },
      { q: 'Will the followers drop?', a: 'The package labelled "no drop" has shown no drops so far; the budget package may drop and is not compensated.' },
      { q: 'Are there Turkish followers?', a: 'The list currently offers global packages from aged accounts and a US-focused option. New options appear on this page automatically as the catalogue is updated.' },
      { q: 'How long does it take?', a: 'It starts instantly; speed is 20K-50K per day depending on the package. 1,000 followers usually complete within an hour.' },
      { q: 'Is delivery possible to a protected account?', a: 'No. Your account must be public while the order runs.' }
    ],
    cta_text_tr: 'Ücretsiz Hesap Oluştur', cta_text_en: 'Create a Free Account',
    related_blog_slugs: ['sosyal-medya-buyume-rehberi', 'sosyal-medya-etkilesim-orani-hesaplama-rehberi', 'smm-panel-odeme-guvenligi-rehberi']
  },
  {
    slug: 'spotify-dinlenme-satin-al', status: 'draft', platform_key: 'spotify', category_ids: [207, 211], sort_order: 70,
    title_tr: 'Spotify Dinlenme Satın Al',
    title_en: 'Buy Spotify Plays',
    subtitle_tr: 'Yeni single ve podcast\'iniz için anında başlayan Spotify dinlenme paketleri. Ücretsiz ve Premium dinlenme, aylık dinleyici seçenekleri.',
    subtitle_en: 'Instant-start Spotify play packages for your new single or podcast. Free and Premium plays plus monthly listener options.',
    seo_title_tr: 'Spotify Dinlenme Satın Al – Premium ve Ücretsiz Dinlenme Paketleri',
    seo_title_en: 'Buy Spotify Plays – Premium and Free Play Packages',
    seo_description_tr: 'Spotify dinlenme satın al: yeni parça ve podcast için anında başlayan paketler. Premium ve ücretsiz dinlenme, aylık dinleyici, güvenli ödeme.',
    seo_description_en: 'Buy Spotify plays: packages for new tracks and podcasts that start within seconds. Premium and free plays, monthly listeners, secure payment.',
    content_tr: `<h2>Dinlenme sayısı Spotify'da neyi tetikler?</h2>
<p>Spotify'ın algoritmik listeleri (Release Radar, Discover Weekly) yeni parçanın ilk günlerdeki dinlenme, kaydetme ve tamamlanma verisine bakar. Sıfır dinlenmeyle başlayan parça bu listelere giremez. Dinlenme paketleri ilk günlerin ivmesini oluşturur; playlist başvuruları ve sosyal medya tanıtımınız kalıcı dinleyiciyi getirir. Sanatçı profilindeki aylık dinleyici sayısı da menajer ve playlist küratörlerinin baktığı ilk rakamdır.</p>
<h2>Paket seçenekleri</h2>
<ul>
<li><strong>Ücretsiz dinlenme:</strong> En ekonomik seçenek, günlük 5K, maksimum 1M.</li>
<li><strong>Premium dinlenme:</strong> Premium hesaplardan, günlük 1K; telif akışı açısından daha değerli.</li>
<li><strong>Podcast dinlenme:</strong> Bölüm bağlantısına, günlük 10K-50K.</li>
<li><strong>Aylık dinleyici:</strong> Sanatçı profili için, maksimum 50K, günlük 10K-30K.</li>
</ul>
<h2>Doğru kullanım</h2>
<p>Parça yayınından sonraki ilk 7 gün kritik; kademeli teslimatla günlük doğal bir eğri oluşturun. Minimum sipariş 1000 adettir. Dinlenmeyi kaydetme ve takipçiyle desteklemek profilin bütününü tutarlı gösterir.</p>
<blockquote>Dürüst uyarı: Spotify yapay dinlenmeyi tespit ederse parçayı kaldırabilir veya telif ödemesini durdurabilir. Ani ve aşırı miktarlardan kaçının; satın alma organik tanıtımın yerine değil yanına konmalıdır.</blockquote>`,
    content_en: `<h2>What do play counts trigger on Spotify?</h2>
<p>Spotify's algorithmic playlists (Release Radar, Discover Weekly) look at a new track's plays, saves and completion in its first days. A track that starts with zero plays cannot enter those lists. Play packages create early momentum; playlist pitching and your social promotion bring lasting listeners. The monthly listener figure on your artist profile is also the first number managers and curators check.</p>
<h2>Package options</h2>
<ul>
<li><strong>Free plays:</strong> the budget option, 5K per day, up to 1M.</li>
<li><strong>Premium plays:</strong> from Premium accounts, 1K per day; more valuable for royalty flow.</li>
<li><strong>Podcast plays:</strong> for episode links, 10K-50K per day.</li>
<li><strong>Monthly listeners:</strong> for the artist profile, up to 50K, 10K-30K per day.</li>
</ul>
<h2>Using it right</h2>
<p>The first 7 days after release are critical; build a natural daily curve with drip-feed delivery. The minimum order is 1000. Supporting plays with saves and followers keeps the whole profile consistent.</p>
<blockquote>Honest warning: if Spotify detects artificial streams it may remove the track or withhold royalties. Avoid sudden, extreme volumes; purchases belong next to organic promotion, never instead of it.</blockquote>`,
    steps_tr: ['Hesap oluşturup bakiye yükleyin.', 'Dinlenme paketini seçin (ücretsiz, Premium, podcast veya aylık dinleyici).', 'Parça, bölüm ya da sanatçı bağlantısını ve miktarı girin.', 'Sipariş anında başlar; ilerlemeyi Siparişlerim sayfasından izleyin.'],
    steps_en: ['Create an account and top up.', 'Choose a play package (free, Premium, podcast or monthly listeners).', 'Enter the track, episode or artist link and the quantity.', 'The order starts instantly; track it on the My Orders page.'],
    faq_tr: [
      { q: 'Spotify dinlenme satın almak yasal mı?', a: 'Yasal bir suç değildir ancak Spotify kullanım şartları yapay dinlenmeyi yasaklar; tespit edilirse parça kaldırılabilir. Kademeli ve ölçülü kullanın.' },
      { q: 'Premium ile ücretsiz dinlenme farkı nedir?', a: 'Premium dinlenmeler ücretli hesaplardan gelir ve telif hesaplamasında daha yüksek değer taşır; ücretsiz dinlenmeler daha ekonomiktir.' },
      { q: 'Dinlenmeler sayaçta ne zaman görünür?', a: 'Sipariş anında başlar; Spotify sayaçları 1-3 gün gecikmeli güncellendiği için sonuç Spotify for Artists\'te gecikmeli görünebilir.' },
      { q: 'Minimum sipariş kaç adet?', a: 'Dinlenme paketlerinde minimum 1000 adettir.' },
      { q: 'Podcast için de alabilir miyim?', a: 'Evet; podcast dinlenme paketi bölüm bağlantısıyla çalışır.' }
    ],
    faq_en: [
      { q: 'Is buying Spotify plays legal?', a: 'It is not a crime, but Spotify\'s terms prohibit artificial streams and a detected track can be removed. Use it gradually and in moderation.' },
      { q: 'What is the difference between Premium and free plays?', a: 'Premium plays come from paid accounts and carry more weight in royalty calculations; free plays are the budget option.' },
      { q: 'When do plays show up on the counter?', a: 'The order starts instantly; because Spotify updates its counters with a 1-3 day delay, results may appear late in Spotify for Artists.' },
      { q: 'What is the minimum order?', a: 'Play packages have a minimum of 1000.' },
      { q: 'Can I buy plays for a podcast?', a: 'Yes; the podcast play package works with an episode link.' }
    ],
    cta_text_tr: 'Ücretsiz Hesap Oluştur', cta_text_en: 'Create a Free Account',
    related_blog_slugs: ['spotify-da-organik-mi-yoksa-hizli-dinlenme-mi-dogru-stratejiyi-secmek-msuzilds', 'organik-buyume-vs-satin-alma-karsilastirmasi']
  }
];

(async () => {
  const db = new sqlite3.Database(dbPath);
  const run = (q, p = []) => new Promise((r, j) => db.run(q, p, function (e) { e ? j(e) : r(this); }));
  const get = (q, p = []) => new Promise((r, j) => db.get(q, p, (e, row) => e ? j(e) : r(row)));
  db.configure('busyTimeout', 5000);
  const tablo = await get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'landing_pages'");
  if (!tablo) { console.error('landing_pages tablosu yok: once sunucuyu yeni kodla baslat.'); process.exit(1); }
  let eklendi = 0;
  for (const page of PAGES) {
    if (await get('SELECT id FROM landing_pages WHERE slug = ?', [page.slug])) { console.log(`atlandi (var): ${page.slug}`); continue; }
    const result = normalizePagePayload(page);
    if (result.error) { console.error(`HATA ${page.slug}: ${result.error}`); continue; }
    const cols = Object.keys(result.fields);
    await run(`INSERT INTO landing_pages (${cols.join(', ')}, updated_at, published_at)
      VALUES (${cols.map(() => '?').join(', ')}, CURRENT_TIMESTAMP, CASE WHEN ? = 'published' THEN CURRENT_TIMESTAMP ELSE NULL END)`,
    [...cols.map(c => result.fields[c]), result.fields.status]);
    eklendi++;
    console.log(`eklendi: ${page.slug} (${result.fields.status})`);
  }
  console.log(`Bitti: ${eklendi} sayfa eklendi.`);
  db.close();
})().catch(err => { console.error(err); process.exit(1); });
