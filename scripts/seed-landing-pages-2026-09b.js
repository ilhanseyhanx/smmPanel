'use strict';

// 5 yeni satis sayfasi — 2. parti (11 Eyl 2026). Kelime calismasi:
// SEO-KELIME-CALISMASI.md. Ilk parti: seed-landing-pages-2026-09.js
// Kalan kapsam bosluklarindan kelime degeri en yuksek 5 kategori kumesi.
//
// ICERIK KURALI (kullanici revizyonu, 8 Eyl 2026):
//   - SEO sonucu, siralama, onerilenlere girme veya para kazanma GARANTISI yok.
//   - SAGLAYICININ teknik hizmet ozelligi "saglayici ... olarak belirtir"
//     kalibiyla bizim cumlemizden ayrilir.
//   - Katalogdaki "Yenileme Yok / Iptal Aktif" uyarilari acikca yazilir.
//   - Fiyat/limit sayfa govdesinde tekrarlanmaz; canli tablodan gelir.
//
// Kullanim: cd /var/www/smmjet && node scripts/seed-landing-pages-2026-09b.js
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
    slug: 'instagram-kaydetme-satin-al', platform_key: 'instagram', category_ids: [191, 193], sort_order: 55,
    title_tr: 'Instagram Kaydetme Satın Al', title_en: 'Buy Instagram Saves',
    subtitle_tr: 'Gönderileriniz için kaydetme ve paylaşım paketleri: anında başlayan, yüksek günlük hızlı seçenekler. Beğeninin ötesindeki iki güçlü etkileşim sayacı, tek sayfada.',
    subtitle_en: 'Save and share packages for your posts: instant-start options with high daily speed. The two engagement counters beyond likes, on one page.',
    seo_title_tr: 'Instagram Kaydetme Satın Al – Kaydetme ve Paylaşım Paketleri',
    seo_title_en: 'Buy Instagram Saves – Save and Share Packages',
    seo_description_tr: 'Instagram kaydetme satın al: gönderilerinize anında başlayan kaydetme ve paylaşım paketleri. Beğeni ötesi etkileşim sayaçları, şifresiz ve hızlı sipariş.',
    seo_description_en: 'Buy Instagram saves: instant-start save and share packages for your posts. The engagement counters beyond likes, ordered fast with no password.',
    content_tr: [
      '<h2>Kaydetme ve paylaşım neden beğeniden farklı?</h2>',
      '<p>Beğeni tek dokunuşluk bir tepkidir; kaydetme ise kullanıcının "buna sonra dönmek istiyorum" demesidir, paylaşım da içeriği bir başkasına iletmesidir. Bu yüzden içerik üreticileri ve markalar, gönderi analizlerinde bu iki sayaca ayrıca bakar. Instagram kaydetme satın al paketleri bu sayaçları yükseltir; keşfete çıkma, erişim artışı veya takipçi kazanımı konusunda bir sonuç taahhüt etmez.</p>',
      '<h2>Paket seçenekleri</h2>',
      '<ul>',
      '<li><strong>Kaydetme – ekonomik:</strong> Katalogdaki en düşük birim fiyatlı seçeneklerden biri; anında başlar.</li>',
      '<li><strong>Kaydetme – yüksek hacim:</strong> Sağlayıcı hizmeti "her zaman aktif" olarak belirtir; yüksek günlük teslimat hızıyla büyük siparişler için uygundur.</li>',
      '<li><strong>Paylaşım – süper hızlı:</strong> Anında başlangıç ve çok yüksek maksimum limit; sağlayıcı tamamlanmayı süper hızlı olarak belirtir.</li>',
      '<li><strong>Paylaşım – İptal Aktif:</strong> Teslim edilmeyen kısmın bakiyeye iade edildiği etiketli seçenek; garantili teslimat isteyenler için mantıklı tercihtir.</li>',
      '</ul>',
      '<h2>Analiz panelinde ne görürsünüz?</h2>',
      '<p>Profesyonel hesaba geçtiyseniz gönderi istatistiklerinde kaydetme ve paylaşım sayıları ayrı kalemler olarak görünür. Sipariş tamamlandığında artışı bu panelden izleyebilirsiniz. Sayaçların dengeli olması önemlidir: on binlerce beğenisi olup sıfır kaydetmesi olan bir gönderi, dikkatli bir gözle bakan marka veya iş birliği tarafına doğal görünmeyebilir. Küçük ve dengeli paketlerle ilerlemek en sağlıklı kullanım biçimidir.</p>',
      '<h2>Garanti konusunda dürüst uyarı</h2>',
      '<blockquote>Bu kategorilerdeki hizmetler katalogda yenileme garantisi olmadan listelenir. "İptal Aktif" etiketli paketlerde teslim edilmeyen kısım iade edilir; düşüş telafisi ise kapsam dışıdır. Geçerli koşullar her hizmet kartında açıkça yazar.</blockquote>',
      '<h2>Doğru kullanım</h2>',
      '<p>Hesabınızın ve gönderinizin herkese açık olması gerekir; gizli hesaplara teslimat yapılamaz. Sipariş verirken gönderinin tam bağlantısını girin. Kaydetme ve paylaşımı, içerik takviminizin yerine geçen bir yöntem olarak değil, iyi bir gönderinin altındaki tabloyu tamamlayan bir unsur olarak kullanın.</p>'
    ].join('\n'),
    content_en: [
      '<h2>Why are saves and shares different from likes?</h2>',
      '<p>A like is a one-tap reaction; a save means the user said "I want to come back to this", and a share means they passed the content to someone else. That is why creators and brands look at these two counters separately in post analytics. Buy-Instagram-saves packages raise those counters; they make no commitment about the Explore feed, reach growth or follower gain.</p>',
      '<h2>Package options</h2>',
      '<ul>',
      '<li><strong>Saves – budget:</strong> among the lowest unit prices in the catalogue; starts instantly.</li>',
      '<li><strong>Saves – high volume:</strong> the provider describes the service as always active; suited to large orders with high daily speed.</li>',
      '<li><strong>Shares – super fast:</strong> instant start with a very high maximum limit; the provider states super-fast completion.</li>',
      '<li><strong>Shares – Cancel Enabled:</strong> the tagged option where the undelivered part is refunded to your balance; a sensible pick if you want delivery assurance.</li>',
      '</ul>',
      '<h2>What will you see in analytics?</h2>',
      '<p>With a professional account, saves and shares appear as separate lines in post insights. Once the order completes you can watch the increase there. Balance matters: a post with tens of thousands of likes and zero saves may not look natural to a brand or partner examining it closely. Small, balanced packages are the healthiest way to use these services.</p>',
      '<h2>An honest note on guarantees</h2>',
      '<blockquote>Services in these categories are listed without a refill guarantee. On "Cancel Enabled" packages the undelivered part is refunded; drop compensation is out of scope. The applicable terms are stated on each service card.</blockquote>',
      '<h2>Using it right</h2>',
      '<p>Your account and post must be public; private accounts cannot receive delivery. Submit the full post URL with your order. Use saves and shares as something that completes the picture under a good post, not as a substitute for your content calendar.</p>'
    ].join('\n'),
    faq_tr: [
      { q: 'Kaydetme sayısını kimler görebilir?', a: 'Kaydetme sayısı herkese açık değildir; yalnızca siz profesyonel hesap istatistiklerinde görürsünüz. Paylaşım sayısı da gönderi sahibinin panelinde görünür.' },
      { q: 'Kaydetme keşfete çıkarır mı?', a: 'Kaydetme, analizlerde takip edilen etkileşim kalemlerinden biridir; ancak bu paketler keşfete çıkma veya erişim artışı garantisi vermez. Bu sonuçlar birçok faktöre bağlıdır.' },
      { q: 'Hangi gönderi tiplerine sipariş verilebilir?', a: 'Herkese açık gönderi ve Reels bağlantıları kabul edilir. Hikayeler için bu sayfadaki paketler geçerli değildir.' },
      { q: 'Kaydetmeler düşer mi?', a: 'Bu kategorideki hizmetler yenileme garantisi olmadan listelenir; düşüş hâlinde telafi yapılmaz. Koşullar hizmet kartında yazar.' }
    ],
    faq_en: [
      { q: 'Who can see the save count?', a: 'Save counts are not public; only you see them in professional account insights. Share counts also appear in the post owner\'s panel.' },
      { q: 'Do saves get me on Explore?', a: 'Saves are one of the engagement lines tracked in analytics, but these packages guarantee no Explore placement or reach growth. Those outcomes depend on many factors.' },
      { q: 'Which post types are accepted?', a: 'Public post and Reels links are accepted. Stories are not covered by the packages on this page.' },
      { q: 'Will saves drop?', a: 'Services in this category are listed without a refill guarantee; drops are not compensated. Terms are on the service card.' }
    ],
    related_blog_slugs: ['2026-instagram-kesfet-taktikleri', 'sosyal-medya-etkilesim-orani-hesaplama-rehberi', 'organik-buyume-vs-satin-alma-karsilastirmasi']
  }),

  // ---------------------------------------------------------------- 2
  page({
    slug: 'instagram-kanal-uye-satin-al', platform_key: 'instagram', category_ids: [190], sort_order: 56,
    title_tr: 'Instagram Kanal Üyesi Satın Al', title_en: 'Buy Instagram Channel Members',
    subtitle_tr: 'Instagram yayın kanallarınız (broadcast channel) için üye paketleri: sağlayıcının yüksek kalite ve gerçek olarak belirttiği global ve ABD seçenekleri, dakikalar içinde tamamlanan teslimat.',
    subtitle_en: 'Member packages for your Instagram broadcast channels: global and US options the provider describes as high-quality and real, completed within minutes.',
    seo_title_tr: 'Instagram Kanal Üyesi Satın Al – Yayın Kanalı Üye Paketleri',
    seo_title_en: 'Buy Instagram Channel Members – Broadcast Channel Packages',
    seo_description_tr: 'Instagram kanal üyesi satın al: yayın kanalınıza global veya ABD kaynaklı üye paketleri. Anında başlar, dakikalar içinde tamamlanır; şifresiz sipariş.',
    seo_description_en: 'Buy Instagram channel members: global or US member packages for your broadcast channel. Instant start, completed within minutes, no password needed.',
    content_tr: [
      '<h2>Instagram yayın kanalı nedir?</h2>',
      '<p>Yayın kanalları (broadcast channel), içerik üreticilerin takipçilerine tek yönlü mesaj, anket ve içerik gönderdiği Instagram özelliğidir. Kanal üye sayısı kanala katılan herkese görünür ve kanalın ciddiyeti hakkında ilk izlenimi verir. Instagram kanal üyesi satın al paketleri bu sayacı yükseltir; kanal içi görüntülenme, hikaye erişimi veya takipçi kazanımı konusunda bir sonuç taahhüt etmez.</p>',
      '<h2>Paket seçenekleri</h2>',
      '<ul>',
      '<li><strong>Global üye:</strong> Dünya geneli kaynaklı üyeler; sağlayıcı hesap kalitesini yüksek ve gerçek olarak belirtir. Anında başlar; sağlayıcı teslimatın bir dakika içinde tamamlandığını belirtir.</li>',
      '<li><strong>ABD üye:</strong> ABD kaynaklı üye seçeneği; çok yüksek maksimum limit destekler. Aynı hız ve kalite beyanıyla listelenir.</li>',
      '</ul>',
      '<h2>Kanal büyütmede doğru sıra</h2>',
      '<p>Yeni açılmış bir kanal, üye sayısı sıfırken paylaşımlarına tepki toplamakta zorlanır; küçük bir üye paketi başlangıç ivmesi verir. Ancak kanalın gerçek değeri, düzenli ve takipçiye özel içerik paylaşmakla kurulur: kanala özel duyurular, perde arkası içerikler ve anketler üyelerin kanalda kalmasını sağlar. Satın alınan üyeleri başlangıç görünümü olarak değerlendirin, kalıcı topluluk içerikle gelir.</p>',
      '<h2>Garanti konusunda dürüst uyarı</h2>',
      '<blockquote>Bu kategorideki hizmetler katalogda yenileme garantisi olmadan listelenir; düşüş yaşanması hâlinde telafi veya iade yapılmaz. Sipariş öncesi hizmet kartındaki koşulları okuyun.</blockquote>',
      '<h2>Doğru kullanım</h2>',
      '<p>Sipariş verirken kanalınızın davet bağlantısını girin; kanalın herkese açık şekilde katılıma izin vermesi gerekir. Aynı kanal için ilk sipariş tamamlanmadan ikinci siparişi vermemeniz önerilir. Üye sayısı ile paylaşım tepkilerinizin dengeli görünmesi için kanala düzenli içerik göndermeye devam edin.</p>'
    ].join('\n'),
    content_en: [
      '<h2>What is an Instagram broadcast channel?</h2>',
      '<p>Broadcast channels are the Instagram feature where creators send one-way messages, polls and content to their followers. The member count is visible to everyone who joins and shapes the first impression of how serious the channel is. Buy-channel-members packages raise that counter; they make no commitment about in-channel views, story reach or follower gain.</p>',
      '<h2>Package options</h2>',
      '<ul>',
      '<li><strong>Global members:</strong> members from worldwide sources; the provider describes account quality as high and real. Starts instantly; the provider states delivery completes within a minute.</li>',
      '<li><strong>US members:</strong> the US-sourced option supporting a very high maximum limit, listed with the same speed and quality statement.</li>',
      '</ul>',
      '<h2>The right order of channel growth</h2>',
      '<p>A brand-new channel struggles to collect reactions while its member count sits at zero; a small member package provides starting momentum. The channel\'s real value, however, is built by posting regular, member-only content: exclusive announcements, behind-the-scenes posts and polls keep members around. Treat purchased members as a starting look — the lasting community comes from content.</p>',
      '<h2>An honest note on guarantees</h2>',
      '<blockquote>Services in this category are listed without a refill guarantee; drops are not compensated or refunded. Read the terms on the service card before ordering.</blockquote>',
      '<h2>Using it right</h2>',
      '<p>Submit your channel\'s invite link with the order; the channel must allow public joining. Avoid placing a second order for the same channel before the first completes. Keep posting regularly so the member count and post reactions look balanced.</p>'
    ].join('\n'),
    faq_tr: [
      { q: 'Kanal bağlantısını nereden alırım?', a: 'Instagram\'da kanalınızı açın, kanal adına dokunun ve davet bağlantısını kopyalayın. Siparişte bu bağlantıyı girin.' },
      { q: 'Üyeler kanalda mesaj atabilir mi?', a: 'Yayın kanalları tek yönlüdür; yalnızca kanal sahibi içerik gönderir. Üyeler tepki bırakabilir ve anketlere katılabilir.' },
      { q: 'Global ile ABD paketi arasındaki fark nedir?', a: 'Üyelerin kaynak bölgesi farklıdır; ABD paketi daha yüksek maksimum limit destekler. Her ikisinde de sağlayıcı yüksek kalite ve gerçek hesap belirtir; koşullar kartta yazar.' },
      { q: 'Üyeler düşer mi?', a: 'Bu kategori yenileme garantisi olmadan listelenir; düşüş hâlinde telafi yapılmaz. Koşullar hizmet kartında açıkça yazar.' }
    ],
    faq_en: [
      { q: 'Where do I find my channel link?', a: 'Open your channel in Instagram, tap the channel name and copy the invite link. Submit it with your order.' },
      { q: 'Can members post in the channel?', a: 'Broadcast channels are one-way; only the owner posts. Members can react and vote in polls.' },
      { q: 'Global vs US package?', a: 'The source region of members differs, and the US package supports a higher maximum limit. Both are listed with the provider\'s high-quality, real-account statement; terms are on the card.' },
      { q: 'Will members drop?', a: 'This category is listed without a refill guarantee; drops are not compensated. Terms are stated on the service card.' }
    ],
    related_blog_slugs: ['2026-instagram-kesfet-taktikleri', 'instagram-hikaye-izlenme-artirma-taktikleri', 'instagram-takipci-dususu-nedenleri-ve-cozumleri']
  }),

  // ---------------------------------------------------------------- 3
  page({
    slug: 'facebook-grup-uye-satin-al', platform_key: 'facebook', category_ids: [172], sort_order: 57,
    title_tr: 'Facebook Grup Üyesi Satın Al', title_en: 'Buy Facebook Group Members',
    subtitle_tr: 'Facebook grubunuz için üye paketi: sağlayıcının düşük düşüş oranıyla belirttiği, günlük kademeli teslim edilen üyeler. Şifresiz sipariş; yalnızca grup bağlantısı yeterli.',
    subtitle_en: 'A member package for your Facebook group: members the provider describes as low-drop, delivered gradually per day. No password; a group link is all it takes.',
    seo_title_tr: 'Facebook Grup Üyesi Satın Al – Düşük Düşüşlü Üye Paketi',
    seo_title_en: 'Buy Facebook Group Members – Low-Drop Member Package',
    seo_description_tr: 'Facebook grup üyesi satın al: sağlayıcı beyanıyla düşük düşüşlü, günlük kademeli teslim edilen üye paketi. Grubunuzu şifresiz ve hızlı büyütün.',
    seo_description_en: 'Buy Facebook group members: a low-drop package per the provider, delivered gradually each day. Grow your group fast with no password required.',
    content_tr: [
      '<h2>Grup üye sayısı neden önemli?</h2>',
      '<p>Facebook grupları; yerel topluluklar, alışveriş grupları ve ilgi alanı toplulukları için hâlâ platformun en aktif alanıdır. Bir grubun üye sayısı arama sonuçlarında ve grup sayfasında herkese açık görünür; kullanıcılar katılım kararını çoğu zaman bu sayıya ve grup aktifliğine bakarak verir. Facebook grup üyesi satın al paketi bu sayacı yükseltir; grup içi etkileşim, gönderi erişimi veya satış konusunda bir sonuç taahhüt etmez.</p>',
      '<h2>Paketin özellikleri</h2>',
      '<ul>',
      '<li><strong>Düşük düşüş beyanı:</strong> Sağlayıcı, üye düşüş oranını düşük olarak belirtir.</li>',
      '<li><strong>Kademeli teslimat:</strong> Üyeler günlük dilimler hâlinde gelir; toplu tek seferlik yığılma olmaz. Günlük hız hizmet kartında yazar.</li>',
      '<li><strong>Katalog uyarısı:</strong> Hizmet "Yenileme Yok" etiketiyle listelenir; düşüş hâlinde telafi yapılmaz.</li>',
      '</ul>',
      '<h2>Aktif grup, pasif üye listesinden değerlidir</h2>',
      '<p>Üye sayısı yalnızca kapıdaki tabeladır; grubu yaşatan şey gönderi akışı ve üye etkileşimidir. Satın alınan üyeler grup içinde gönderi paylaşan gerçek topluluk üyeleri değildir. En sağlıklı kullanım; yeni kurulmuş bir grubun "boş görünme" eşiğini aşması veya mevcut bir grubun rakip gruplarla sayı dengesini koruması gibi görünürlük senaryolarıdır. Grup kurallarını düzenlemek, haftalık sabit içerikler paylaşmak ve üye sorularını yanıtlamak kalıcı büyümenin asıl kaynağıdır.</p>',
      '<h2>Garanti konusunda dürüst uyarı</h2>',
      '<blockquote>Bu hizmet katalogda "Yenileme Yok" etiketiyle listelenir; düşüş yaşanması hâlinde telafi veya ücret iadesi yapılmaz. "Düşük düşüş" ifadesi sağlayıcının beyanıdır. Sipariş öncesi hizmet kartındaki koşulları okuyun.</blockquote>',
      '<h2>Doğru kullanım</h2>',
      '<p>Grubunuzun herkese açık olması ve bağlantının facebook.com/groups/... biçiminde olması gerekir. Katılım onayı gerektiren gizli gruplara teslimat yapılamaz. Aynı grup için ilk sipariş tamamlanmadan ikinci siparişi vermemeniz önerilir.</p>'
    ].join('\n'),
    content_en: [
      '<h2>Why does group member count matter?</h2>',
      '<p>Facebook groups remain the platform\'s most active area for local communities, marketplace groups and interest communities. A group\'s member count is publicly visible in search results and on the group page; users often decide whether to join by looking at that number and the group\'s activity. The buy-group-members package raises that counter; it makes no commitment about in-group engagement, post reach or sales.</p>',
      '<h2>Package properties</h2>',
      '<ul>',
      '<li><strong>Low-drop statement:</strong> the provider describes the member drop rate as low.</li>',
      '<li><strong>Gradual delivery:</strong> members arrive in daily batches rather than one bulk spike. The daily speed is written on the service card.</li>',
      '<li><strong>Catalogue notice:</strong> the service is listed with a "No Refill" tag; drops are not compensated.</li>',
      '</ul>',
      '<h2>An active group beats a passive member list</h2>',
      '<p>The member count is only the sign on the door; what keeps a group alive is the post flow and member engagement. Purchased members are not real community members who will post inside the group. The healthiest uses are visibility scenarios: getting a new group past the "looks empty" threshold, or keeping the number balance against rival groups. Clear rules, weekly recurring content and answering member questions remain the real source of lasting growth.</p>',
      '<h2>An honest note on guarantees</h2>',
      '<blockquote>This service is listed in the catalogue with a "No Refill" tag; drops are not compensated or refunded. "Low drop" is the provider\'s statement. Read the terms on the service card before ordering.</blockquote>',
      '<h2>Using it right</h2>',
      '<p>Your group must be public and the link must be in the facebook.com/groups/... format. Private groups requiring join approval cannot receive delivery. Avoid placing a second order for the same group before the first completes.</p>'
    ].join('\n'),
    faq_tr: [
      { q: 'Gizli gruba üye gönderilebilir mi?', a: 'Hayır. Teslimat için grubun herkese açık olması ve katılım onayı istememesi gerekir. Onay soruları açık olan gruplarda teslimat aksayabilir; sipariş öncesi kapatmanız önerilir.' },
      { q: 'Üyeler grupta paylaşım yapar mı?', a: 'Hayır. Paket üye sayacını yükseltir; üyelerin grup içinde gönderi paylaşması veya yorum yazması taahhüt edilmez.' },
      { q: 'Üyeler ne hızda gelir?', a: 'Teslimat günlük dilimler hâlinde kademeli yapılır; günlük hız hizmet kartında yazar. Yüksek adetli siparişler birkaç güne yayılır.' },
      { q: 'Üyeler düşer mi?', a: 'Sağlayıcı düşüş oranını düşük belirtir ancak hizmet "Yenileme Yok" etiketlidir; düşüş hâlinde telafi yapılmaz.' }
    ],
    faq_en: [
      { q: 'Can members be sent to a private group?', a: 'No. Delivery requires the group to be public without join approval. Active membership questions can disrupt delivery; disabling them before ordering is recommended.' },
      { q: 'Will members post in the group?', a: 'No. The package raises the member counter; members posting or commenting inside the group is not committed.' },
      { q: 'How fast do members arrive?', a: 'Delivery is gradual in daily batches; the daily speed is on the service card. Large orders spread over several days.' },
      { q: 'Will members drop?', a: 'The provider states a low drop rate, but the service carries a "No Refill" tag; drops are not compensated.' }
    ],
    related_blog_slugs: ['facebook-sayfa-begeni-ve-erisim-artirma', 'sosyal-medya-buyume-rehberi', 'organik-buyume-vs-satin-alma-karsilastirmasi']
  }),

  // ---------------------------------------------------------------- 4
  page({
    slug: 'facebook-yorum-satin-al', platform_key: 'facebook', category_ids: [180, 181, 167], sort_order: 58,
    title_tr: 'Facebook Yorum Satın Al', title_en: 'Buy Facebook Comments',
    subtitle_tr: 'Gönderileriniz için rastgele yorumlar ve emoji tepkileri (Love, Wow ve daha fazlası). Sağlayıcının yüksek kaliteli hesaplar olarak belirttiği seçenekler, anında başlangıç.',
    subtitle_en: 'Random comments and emoji reactions (Love, Wow and more) for your posts. Options the provider describes as high-quality accounts, with an instant start.',
    seo_title_tr: 'Facebook Yorum Satın Al – Rastgele Yorum ve Emoji Tepkileri',
    seo_title_en: 'Buy Facebook Comments – Random Comments and Emoji Reactions',
    seo_description_tr: 'Facebook yorum satın al: gönderilerinize rastgele yorumlar ve Love, Wow gibi emoji tepkileri. Yüksek kaliteli hesap seçeneği, anında başlangıç.',
    seo_description_en: 'Buy Facebook comments: random comments plus Love and Wow emoji reactions for your posts. A high-quality account option with an instant start.',
    content_tr: [
      '<h2>Yorum ve tepki gönderiye ne katar?</h2>',
      '<p>Facebook\'ta bir gönderinin altındaki yorum ve tepki sayısı herkese açık görünür ve gönderinin ne kadar konuşulduğunun ilk göstergesidir. Yorumsuz bir gönderi, beğenisi yüksek olsa bile sessiz görünür. Facebook yorum satın al paketleri bu bölümü hareketlendirir; gönderi erişimi, sayfa büyümesi veya satış konusunda bir sonuç taahhüt etmez.</p>',
      '<h2>Paket seçenekleri</h2>',
      '<ul>',
      '<li><strong>Rastgele yorum – İptal Aktif:</strong> Genel içerikli yorumlar; teslim edilmeyen kısım bakiyeye iade edilir. Yüksek günlük hızla teslim edilir.</li>',
      '<li><strong>Rastgele yorum – yüksek kaliteli hesaplar:</strong> Sağlayıcı hesap kalitesini yüksek, düşüş oranını %0 olarak belirtir; anında başlar. Katalogda "Yenileme Yok" uyarısıyla listelenir.</li>',
      '<li><strong>Emoji tepkileri:</strong> Gönderi ve fotoğraflarınıza Love ❤️, Wow 😮 gibi tepkiler; ayrı tepki türleri ayrı hizmet olarak listelenir ve anında başlar.</li>',
      '</ul>',
      '<h2>"Rastgele yorum" ne demek?</h2>',
      '<p>Bu paketlerdeki yorumlar gönderinizin konusuna özel yazılmaz; genel içerikli, kısa yorumlardır (beğeni ifadeleri, emojiler ve benzeri). Ürün lansmanı gibi hassas gönderilerde bunu göz önünde bulundurun: rastgele yorumlar etkileşim görünümü verir ama soru-cevap içeren gerçek bir tartışma oluşturmaz. Gerçek müşteri sorularını kendiniz yanıtlamaya devam edin.</p>',
      '<h2>Garanti konusunda dürüst uyarı</h2>',
      '<blockquote>Garanti koşulu pakete göre değişir: bir yorum paketi "İptal Aktif" etiketi taşır (teslim edilmeyen kısım iade edilir), diğeri yenileme garantisi olmadan listelenir. "%0 düşüş" ve "yüksek kaliteli hesap" ifadeleri sağlayıcının beyanıdır. Geçerli koşullar her hizmet kartında yazar.</blockquote>',
      '<h2>Doğru kullanım</h2>',
      '<p>Gönderinizin herkese açık olması gerekir; kısıtlı hedef kitleli gönderilere teslimat yapılamaz. Sipariş verirken gönderinin tam bağlantısını girin. Yorum ve tepkiyi birlikte, küçük paketler hâlinde kullanmak gönderi altındaki tabloyu daha doğal gösterir.</p>'
    ].join('\n'),
    content_en: [
      '<h2>What do comments and reactions add to a post?</h2>',
      '<p>On Facebook, the comment and reaction counts under a post are publicly visible and are the first indicator of how much a post is being talked about. A comment-less post looks quiet even with a high like count. Buy-Facebook-comments packages bring that section to life; they make no commitment about post reach, page growth or sales.</p>',
      '<h2>Package options</h2>',
      '<ul>',
      '<li><strong>Random comments – Cancel Enabled:</strong> general-purpose comments; the undelivered part is refunded to your balance. Delivered at high daily speed.</li>',
      '<li><strong>Random comments – high-quality accounts:</strong> the provider states high account quality and a 0% drop rate; starts instantly. Listed with a "No Refill" notice in the catalogue.</li>',
      '<li><strong>Emoji reactions:</strong> Love ❤️ and Wow 😮 style reactions for your posts and photos; each reaction type is listed as a separate service and starts instantly.</li>',
      '</ul>',
      '<h2>What does "random comments" mean?</h2>',
      '<p>Comments in these packages are not written specifically about your post\'s topic; they are short, general-purpose comments (appreciation phrases, emojis and the like). Keep that in mind for sensitive posts such as product launches: random comments create an engaged look but do not produce a real Q&A discussion. Keep answering genuine customer questions yourself.</p>',
      '<h2>An honest note on guarantees</h2>',
      '<blockquote>Guarantee terms vary by package: one comment package carries the "Cancel Enabled" tag (the undelivered part is refunded) while the other is listed without refill cover. "0% drop" and "high-quality accounts" are the provider\'s statements. The applicable terms are written on each service card.</blockquote>',
      '<h2>Using it right</h2>',
      '<p>Your post must be public; posts with restricted audiences cannot receive delivery. Submit the full post URL with your order. Using comments and reactions together in small packages makes the picture under the post look most natural.</p>'
    ].join('\n'),
    faq_tr: [
      { q: 'Yorumların içeriğini seçebilir miyim?', a: 'Hayır; bu paketlerdeki yorumlar rastgele (genel içerikli) yazılır. Konuya özel yorum metni iletme seçeneği yoktur; kartta yazan biçim esastır.' },
      { q: 'Yorumlar Türkçe mi gelir?', a: 'Yorum dili sağlayıcının hesap havuzuna bağlıdır ve kartta ayrıca belirtilmez; genel ifadeler ve emoji ağırlıklıdır. Dil önemliyse önce küçük bir paketle test etmeniz önerilir.' },
      { q: 'Kızgın tepki de gönderilebiliyor mu?', a: 'Katalogda farklı emoji türleri ayrı hizmetler olarak listelenir. Kendi gönderinize hangi tepki türünü isterseniz onu seçersiniz; sipariş sizin kontrolünüzdedir.' },
      { q: 'Sayfa gönderisi dışında profil gönderisine sipariş verilebilir mi?', a: 'Herkese açık olduğu sürece sayfa ve profil gönderileri kabul edilir. Kısıtlı gizlilik ayarlı gönderiler işlenemez.' }
    ],
    faq_en: [
      { q: 'Can I choose the comment texts?', a: 'No; comments in these packages are random (general-purpose). There is no custom text option; the format on the card is definitive.' },
      { q: 'Will comments arrive in Turkish?', a: 'Comment language depends on the provider\'s account pool and is not specified on the card; expect general phrases and emojis. If language matters, test with a small package first.' },
      { q: 'Can angry reactions be sent too?', a: 'Different emoji types are listed as separate services in the catalogue. You choose which reaction type goes to your own post; the order is under your control.' },
      { q: 'Profile posts or only page posts?', a: 'Both page and profile posts are accepted as long as they are public. Posts with restricted privacy settings cannot be processed.' }
    ],
    related_blog_slugs: ['facebook-sayfa-begeni-ve-erisim-artirma', 'sosyal-medya-etkilesim-orani-hesaplama-rehberi', 'organik-buyume-vs-satin-alma-karsilastirmasi']
  }),

  // ---------------------------------------------------------------- 5
  page({
    slug: 'telegram-bot-baslatma-satin-al', platform_key: 'telegram', category_ids: [214, 220, 218], sort_order: 59,
    title_tr: 'Telegram Bot Başlatma Satın Al', title_en: 'Buy Telegram Bot Starts',
    subtitle_tr: 'Telegram botunuz için /start paketleri: dünya geneli, referanslı ve istatistiklere dahil seçenekler. Yanında gönderi paylaşımı ve hikaye tepkisi paketleri.',
    subtitle_en: 'Bot /start packages for your Telegram bot: worldwide, referral and stats-included options, alongside post-share and story-reaction packages.',
    seo_title_tr: 'Telegram Bot Başlatma Satın Al – /start, Paylaşım ve Tepkiler',
    seo_title_en: 'Buy Telegram Bot Starts – /start, Shares and Reactions',
    seo_description_tr: 'Telegram bot başlatma satın al: botunuza dünya geneli /start paketleri, referanslı seçenek ve istatistiklere dahil üyeler; paylaşım ve tepki paketleri.',
    seo_description_en: 'Buy Telegram bot starts: worldwide /start packages for your bot, a referral option and stats-included members, plus share and reaction packages.',
    content_tr: [
      '<h2>Bot başlatma paketi kimin işine yarar?</h2>',
      '<p>Telegram botu işleten geliştiriciler, oyun/airdrop projeleri ve topluluk yöneticileri için botun kullanıcı sayısı, projenin vitrinidir. Bot başlatma paketleri, botunuza /start komutu gönderen kullanıcı sayısını yükseltir. Bu paketler kullanıcı sayacını hareketlendirir; kullanıcıların botla etkileşime devam etmesi, görev tamamlaması veya gelir üretmesi konusunda bir sonuç taahhüt etmez.</p>',
      '<h2>Paket seçenekleri</h2>',
      '<ul>',
      '<li><strong>Standart bot başlatma:</strong> Botunuza /start gönderen kullanıcılar; giriş seviyesi seçenek.</li>',
      '<li><strong>Dünya geneli, yüksek hız:</strong> Sağlayıcı anında başlangıç ve yüksek günlük hız belirtir.</li>',
      '<li><strong>Referanslı başlatma:</strong> /start\'lar belirttiğiniz referans (davet) bağlantısı üzerinden gelir; davet sayacı işleyen botlar için tasarlanmış seçenektir.</li>',
      '<li><strong>İstatistiklere dahil seçenek:</strong> Sağlayıcı bu paketi bot istatistiklerine yansıyan olarak belirtir; yüksek maksimum limit destekler.</li>',
      '</ul>',
      '<h2>Kanalınızı tamamlayan paketler</h2>',
      '<p>Bot tanıtımı çoğu zaman bir Telegram kanalıyla birlikte yürür. Bu sayfada botun yanına iki tamamlayıcı da bulunur: <strong>gönderi paylaşımı</strong> (sağlayıcının gerçek olarak belirttiği hesaplardan, kanal gönderinizin paylaşım sayacını yükseltir) ve <strong>hikaye tepkileri</strong> (pozitif emoji karışımı, yüksek günlük hız). Kanal üyesi ve görüntülenme paketleri için ayrı sayfalarımız mevcuttur.</p>',
      '<h2>Garanti konusunda dürüst uyarı</h2>',
      '<blockquote>Bu kategorilerdeki hizmetler katalogda yenileme garantisi olmadan listelenir; düşüş hâlinde telafi yapılmaz. "Referanslı" ve "istatistiklere dahil" ifadeleri sağlayıcının teknik beyanıdır. Geçerli koşullar her hizmet kartında yazar.</blockquote>',
      '<h2>Doğru kullanım</h2>',
      '<p>Bot başlatma siparişinde botunuzun kullanıcı adını (t.me/botadi biçiminde) girin; referanslı pakette davet bağlantınızı kullanın. Botunuzun herkese açık ve çalışır durumda olması gerekir; kapalı veya hata veren bota teslimat yapılamaz. Airdrop/görev botlarında platform kurallarını ihlal etmediğinizden emin olun; kural riski size aittir.</p>'
    ].join('\n'),
    content_en: [
      '<h2>Who are bot start packages for?</h2>',
      '<p>For developers running Telegram bots, game/airdrop projects and community managers, the bot\'s user count is the project\'s storefront. Bot start packages raise the number of users sending /start to your bot. These packages move the user counter; they make no commitment about users continuing to engage, completing tasks or generating revenue.</p>',
      '<h2>Package options</h2>',
      '<ul>',
      '<li><strong>Standard bot starts:</strong> users sending /start to your bot; the entry-level option.</li>',
      '<li><strong>Worldwide, high speed:</strong> the provider states an instant start and high daily speed.</li>',
      '<li><strong>Referral starts:</strong> /starts arrive through the referral (invite) link you specify; designed for bots running an invite counter.</li>',
      '<li><strong>Stats-included option:</strong> the provider describes this package as reflected in bot statistics; supports a high maximum limit.</li>',
      '</ul>',
      '<h2>Packages that complete your channel</h2>',
      '<p>Bot promotion usually runs alongside a Telegram channel. This page also carries two complements: <strong>post shares</strong> (from accounts the provider describes as real, raising your channel post\'s share counter) and <strong>story reactions</strong> (a positive emoji mix at high daily speed). Separate pages exist for channel members and post views.</p>',
      '<h2>An honest note on guarantees</h2>',
      '<blockquote>Services in these categories are listed without a refill guarantee; drops are not compensated. "Referral" and "stats-included" are the provider\'s technical statements. The applicable terms are written on each service card.</blockquote>',
      '<h2>Using it right</h2>',
      '<p>Submit your bot\'s username (t.me/botname format) with a bot start order; use your invite link for the referral package. The bot must be public and working; delivery cannot reach a disabled or erroring bot. For airdrop/task bots, make sure you are not violating the platform\'s rules; that risk is yours.</p>'
    ].join('\n'),
    faq_tr: [
      { q: 'Bot başlatma siparişi için hangi bağlantıyı girmeliyim?', a: 'Botunuzun herkese açık adresini girin (t.me/botadi biçimi). Referanslı pakette botunuzun ürettiği davet bağlantısını kullanın.' },
      { q: 'Gelen kullanıcılar botumda görev yapar mı?', a: 'Hayır. Paketler /start sayısını yükseltir; kullanıcıların görev tamamlaması, mesajlara yanıt vermesi veya aktif kalması taahhüt edilmez.' },
      { q: '"İstatistiklere dahil" ne demek?', a: 'Sağlayıcı, bu paketteki başlatmaların botun kullanıcı istatistiklerine yansıdığını belirtir. Hangi panelde nasıl göründüğü botunuzun istatistik altyapısına bağlıdır.' },
      { q: 'Başlatmalar düşer mi?', a: 'Bu kategorideki hizmetler yenileme garantisi olmadan listelenir; düşüş hâlinde telafi yapılmaz. Koşullar hizmet kartında yazar.' }
    ],
    faq_en: [
      { q: 'Which link do I submit for bot starts?', a: 'Submit your bot\'s public address (t.me/botname format). For the referral package use the invite link your bot generates.' },
      { q: 'Will the users complete tasks in my bot?', a: 'No. The packages raise the /start count; users completing tasks, replying or staying active is not committed.' },
      { q: 'What does "stats-included" mean?', a: 'The provider states that starts in this package are reflected in the bot\'s user statistics. How they appear depends on your bot\'s own stats setup.' },
      { q: 'Will starts drop?', a: 'Services in this category are listed without a refill guarantee; drops are not compensated. Terms are on the service card.' }
    ],
    related_blog_slugs: ['telegram-kanal-uye-artirma-rehberi', 'smm-panel-nedir-nasil-kullanilir', 'smm-panel-odeme-guvenligi-rehberi']
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
    console.log('Yayina almak icin admin panelden tek tik ya da: node scripts/publish-landing-pages.js <slug...>');
  })().catch(err => { console.error(err); process.exit(1); });
}
