'use strict';

// KATALOG BOSLUGU SAYFALARI — 5 adet, 2 Eki 2026
// Dayanak: SEO-ANALIZ-2026-10-02.md + canli katalog (2 Eki 2026).
//
// Secim olcutu: kategoride AKTIF servis var ama o servislere ait bir satis
// sayfasi yok (ya da yalnizca baska bir sayfanin tablosunda duruyor).
//
//   turk-begeni-satin-al ................. TikTok Turk Begeni / Turk Izlenme
//       kategorileri hicbir sayfada listelenmiyordu; Instagram Turk begeni
//       servisleri genel begeni tablosunda kayboluyordu.
//   youtube-canli-yayin-izleyici-satin-al  6 aktif servis; canli yayin dikeyi
//       sitenin en iyi siralanan kumesi (Twitch 5.6, Instagram canli 5.0).
//   tiktok-kaydetme-satin-al ............. 6 aktif servis; "kaydetme" ailesi
//       Instagram (poz 7.5) ve Pinterest'te gosterim aliyor.
//   instagram-erisim-satin-al ............ 4 aktif servis; yalnizca izlenme
//       sayfasinin tablosundaydi. GSC kaniti YOK, katalog boslugu.
//   facebook-smm-panel ................... 9+ kategori; Facebook'un cati
//       sayfasi yoktu, 5 kategorisi yayindaki hicbir sayfada gorunmuyordu.
//
// BENZERLIK KURALI (Gun 12 revizyonundan cikan ders): bu sayfalarda ORTAK
// blok yoktur. Adimlar (steps) ve SSS her sayfada kendine ozgudur; diger
// seed'lerdeki FAQ_COMMON / STEPS sabitleri bilerek kullanilmadi. Her sayfa
// farkli bir iskeletle yazildi (tablo, sirali liste, hedefe gore secim).
//
// ICERIK KURALI (onceki seed'lerden devam):
//   - Siralama, kesfet, abone/takipci kazanimi, para kazanma GARANTISI yok.
//   - Saglayicinin beyani ile bizim cumlemiz ayrilir.
//   - Yenilemesiz / garantisiz servisler gizlenmez.
//   - Fiyat ve limit govdede tekrarlanmaz; canli tablodan gelir.
//   - Metin ici linkler yalnizca YAYINDAKI adreslere verilir. Bu sayfalara
//     gelen linkler scripts/link-yeni-sayfalar-2026-10.js ile, sayfa yayina
//     alindiktan SONRA eklenir.
//
// Kullanim: cd /var/www/smmjet && node scripts/seed-landing-pages-2026-10.js
//           node scripts/seed-landing-pages-2026-10.js --dry   (yalnizca rapor)
// Var olan slug'lara DOKUNMAZ; sayfalar TASLAK olarak olusur.

const path = require('path');
const sqlite3 = require('sqlite3');
const { normalizePagePayload } = require('../utils/landingPages');

const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.join(__dirname, '..', 'database.sqlite');
const DRY = process.argv.includes('--dry');

const page = (o) => ({ status: 'draft', cta_text_tr: 'Ücretsiz Hesap Oluştur', cta_text_en: 'Create a Free Account', ...o });

const PAGES = [
  // ---------------------------------------------------------------- 1
  page({
    slug: 'turk-begeni-satin-al', platform_key: 'social-media', sort_order: 72,
    // Her kalip en az bir AKTIF servisli kategoriyle eslesmelidir.
    kategori_kaliplari: [/^tiktok t[üu]rk/i, /^instagram be[ğg]eni$/i],
    title_tr: 'Türk Beğeni Satın Al', title_en: 'Buy Turkish Likes',
    subtitle_tr: 'Instagram ve TikTok için Türkiye kaynaklı beğeni ve izlenme paketleri. Kaynak ülkenin beğenide neden fark yarattığını ve küresel paketin ne zaman yeterli olduğunu bu sayfada anlattık.',
    subtitle_en: 'Turkey-sourced like and view packages for Instagram and TikTok. Why source country matters for likes, and when a global package is enough.',
    seo_title_tr: 'Türk Beğeni Satın Al – Instagram ve TikTok',
    seo_title_en: 'Buy Turkish Likes – Instagram and TikTok',
    seo_description_tr: 'Türk beğeni satın al: Instagram ve TikTok için Türkiye kaynaklı beğeni ve izlenme paketleri. Kaynak ülkenin etkisi, telafi koşulları ve doğru miktar seçimi.',
    seo_description_en: 'Buy Turkish likes: Turkey-sourced like and view packages for Instagram and TikTok, how source country shows, refill terms and choosing the right amount.',
    content_tr: `<h2>Beğenide kaynak ülke nerede görünür?</h2>
<p>Bir gönderinin altındaki beğeni sayısı tek başına ülke bilgisi taşımaz; ama iki yerde kaynak belli olur. Birincisi Instagram'daki <strong>beğenenler listesidir</strong>: sayıya dokunan herkes listeyi açıp hesap adlarını görebilir, beğeni sayısını gizlemiş olsanız bile. Türkçe içerik paylaşan bir hesabın gönderisinde liste baştan sona yabancı adlardan oluşuyorsa bu, dikkatli bir ziyaretçinin gözünden kaçmaz. İkincisi <strong>istatistik ekranıdır</strong>: profesyonel hesaplarda etkileşimde bulunan kitlenin ülke ve şehir dağılımı raporlanır.</p>
<p>TikTok'ta bir videoyu kimlerin beğendiği başkalarına gösterilmez; orada kaynak ülke daha çok video analizlerindeki izleyici bölgesi dağılımında kendini gösterir. Bu yüzden TikTok tarafında beğeniyle birlikte izlenmenin de aynı bölgeden gelmesi tabloyu tutarlı kılar.</p>
<h2>Instagram'da Türkiye kaynaklı beğeni</h2>
<p>Katalogda Instagram için Türkiye kaynaklı beğeni iki kalitede listelenir. Standart seçenekte sağlayıcı hesapları gerçek Türk kullanıcılar olarak belirtir ve servis iptal edilebilir etiketi taşır. Premium seçenekte sağlayıcı daha uzun bir yenileme süresi beyan eder. Her iki serviste de sipariş başına miktar sınırlıdır: bu, Türkiye kaynaklı hesap havuzunun küresel havuzdan küçük olmasının doğal sonucudur.</p>
<p>Ülke farkı gözetmeyen, daha yüksek hacimli seçenekler ve paket karşılaştırması için <a href="/instagram-begeni-satin-al">Instagram beğeni satın al</a> sayfasına bakabilirsiniz. Beğeni siparişinin güvenlik tarafını <a href="/blog/instagram-begeni-satin-almanin-guvenli-yollari-2026-rehberi-msuz2k2w">güvenli beğeni rehberimizde</a> ayrıca ele aldık.</p>
<h2>TikTok'ta Türk beğeni ve Türk izlenme</h2>
<p>TikTok için iki ayrı Türkiye kaynaklı servis vardır: beğeni ve video izlenmesi. Beğeni servisi telafi etiketiyle listelenir; izlenme servisi yüksek hacimli siparişlere uygundur. İkisini birlikte kullanmanın mantığı tutarlılıktır: izlenmesi Türkiye'den, beğenisi başka bir bölgeden gelen bir video analiz ekranında dengesiz görünür.</p>
<p>Küresel TikTok paketleri <a href="/tiktok-begeni-satin-al">TikTok beğeni satın al</a> ve <a href="/tiktok-izlenme-satin-al">TikTok izlenme satın al</a> sayfalarındadır. İzlenme ile beğeninin dağıtıma etkisini <a href="/blog/tiktok-ta-viral-olmak-begeni-ve-izlenme-sayisinin-algoritmaya-etkisi-msvofnwa">viral olma yazımızda</a> anlattık.</p>
<h2>Küresel beğeni ne zaman yeterli?</h2>
<p>Her hesabın Türkiye kaynaklı beğeniye ihtiyacı yoktur. Şu durumlarda küresel paket hem daha ekonomiktir hem de işini görür:</p>
<ul>
<li>İçeriğiniz İngilizce ya da görsel ağırlıklıysa ve kitleniz zaten karışıksa.</li>
<li>Amaç yalnızca gönderi altındaki sayının boş görünmemesiyse ve hesabı marka iş birliğine hazırlamıyorsanız.</li>
<li>Tek seferde çok yüksek miktar gerekiyorsa; Türkiye kaynaklı servislerin sipariş sınırı buna yetmeyebilir.</li>
</ul>
<p>Türkçe içerik üreten, yerel işletme tanıtan veya Türk markalarıyla çalışmayı hedefleyen hesaplarda ise beğenenlerin ülkesiyle içeriğin dilinin uyuşması gerekir. Aynı mantığın takipçi tarafını <a href="/turk-takipci-satin-al">Türk takipçi satın al</a> sayfasında anlattık.</p>
<h2>Miktarı nasıl belirlemeli?</h2>
<p>Beğeni sayısı gönderinin ulaştığı kitleyle orantılı olmalıdır. Pratik ölçü, gönderi beğenisini takipçi sayınızın yüzde 5 ila 15'i aralığında tutmaktır; bunun çok üzerindeki bir sayı, özellikle beğenenler listesi açıldığında soru işareti yaratır. Kendi oranınızı hesaplamak için <a href="/blog/sosyal-medya-etkilesim-orani-hesaplama-rehberi">etkileşim oranı rehberindeki</a> formülü kullanabilirsiniz. Türkiye kaynaklı servislerde üst sınır düşük olduğundan, büyük hedefleri tek gönderiye yığmak yerine son birkaç gönderiye yaymak daha dengeli bir profil görünümü verir.</p>
<h2>Dürüst uyarı</h2>
<blockquote>Beğenilerin geldiği ülke sağlayıcının beyanıdır ve panel bu bilgiyi olduğu gibi aktarır; tamamının Türkiye kaynaklı olacağı tarafımızca garanti edilmez. Telafi kapsamı servisten servise değişir ve hizmet kartında yazar; kapsam dışındaki düşüşler yenilenmez. Beğeni satın almak Keşfet'e çıkma, erişim artışı veya satış sonucu taahhüt etmez; Instagram ve TikTok yapay etkileşimi kurallarında onaylamaz.</blockquote>`,
    content_en: `<h2>Where does source country show on likes?</h2>
<p>A like count carries no country information by itself, but the source becomes visible in two places. The first is Instagram's <strong>list of likers</strong>: anyone who taps the count can open the list and read the account names, even when the like count is hidden. If an account posting in Turkish has a list made up entirely of foreign names, an attentive visitor will notice. The second is the <strong>insights screen</strong>: professional accounts get a country and city breakdown of the audience that engaged.</p>
<p>On TikTok, who liked a video is not shown to others; there the source country shows up mostly in the viewer territory breakdown of the video analytics. That is why, on TikTok, having views come from the same region as the likes keeps the picture consistent.</p>
<h2>Turkey-sourced likes on Instagram</h2>
<p>The catalogue lists Turkey-sourced Instagram likes in two quality tiers. In the standard option the provider describes the accounts as real Turkish users and the service carries the cancel-enabled tag. In the premium option the provider states a longer refill period. Both cap the quantity per order: a natural consequence of the Turkey-sourced account pool being smaller than the global one.</p>
<p>For higher-volume options that are not country-specific, and a package comparison, see <a href="/instagram-begeni-satin-al">buy Instagram likes</a>. We cover the safety side of ordering likes separately in our <a href="/blog/instagram-begeni-satin-almanin-guvenli-yollari-2026-rehberi-msuz2k2w">safe likes guide</a>.</p>
<h2>Turkish likes and Turkish views on TikTok</h2>
<p>There are two separate Turkey-sourced services for TikTok: likes and video views. The like service is listed with a refill tag; the view service suits high-volume orders. The reason to use them together is consistency: a video whose views come from Turkey and whose likes come from another region looks unbalanced in analytics.</p>
<p>Global TikTok packages are on <a href="/tiktok-begeni-satin-al">buy TikTok likes</a> and <a href="/tiktok-izlenme-satin-al">buy TikTok views</a>. We explain how views and likes affect distribution in our <a href="/blog/tiktok-ta-viral-olmak-begeni-ve-izlenme-sayisinin-algoritmaya-etkisi-msvofnwa">going viral article</a>.</p>
<h2>When are global likes enough?</h2>
<p>Not every account needs Turkey-sourced likes. In these cases a global package is both cheaper and sufficient:</p>
<ul>
<li>Your content is in English or mostly visual, and your audience is already mixed.</li>
<li>The only goal is for the number under the post not to look empty, and you are not preparing the account for brand deals.</li>
<li>You need a very high quantity at once; the order cap on Turkey-sourced services may not cover it.</li>
</ul>
<p>For accounts producing Turkish content, promoting a local business or aiming to work with Turkish brands, the likers' country should match the content language. We explain the follower side of the same logic on <a href="/turk-takipci-satin-al">buy Turkish followers</a>.</p>
<h2>How to choose the amount</h2>
<p>The like count should be proportional to the audience the post reaches. A practical measure is to keep post likes within 5 to 15 percent of your follower count; a number far above that raises questions, especially once the list of likers is opened. To work out your own ratio, use the formula in the <a href="/blog/sosyal-medya-etkilesim-orani-hesaplama-rehberi">engagement rate guide</a>. Because the cap on Turkey-sourced services is low, spreading a large target over your last few posts gives a more balanced profile than piling it on one.</p>
<h2>An honest note</h2>
<blockquote>The country likes come from is the provider's statement and the panel passes it on as-is; we do not guarantee that all of them will be Turkey-sourced. Refill cover varies by service and is stated on the service card; drops outside that cover are not refilled. Buying likes does not promise reaching Explore, more reach or sales; Instagram and TikTok do not approve of artificial engagement in their rules.</blockquote>`,
    steps_tr: [
      'Hesabınız yoksa ücretsiz oluşturun ve bakiye yükleyin; Türkiye kaynaklı servisler katalogda bayrak işaretiyle ayrılır.',
      'Aşağıdaki tablodan platforma göre Türk beğeni ya da Türk izlenme servisini seçin; telafi koşulu kartta yazar.',
      'Instagram için gönderinin, TikTok için videonun herkese açık tam bağlantısını ve miktarı girin.',
      'Teslimat başladığında beğenenler listesini ve analiz ekranındaki bölge dağılımını kontrol edin.'
    ],
    steps_en: [
      'Create a free account if you do not have one and top up; Turkey-sourced services are marked with a flag in the catalogue.',
      'Pick the Turkish like or Turkish view service for your platform from the table below; the refill term is on the card.',
      'Enter the full public link of the Instagram post or TikTok video, and the quantity.',
      'Once delivery starts, check the list of likers and the region breakdown in analytics.'
    ],
    faq_tr: [
      { q: 'Türk beğeni ile normal beğeni arasındaki fark nedir?', a: 'Fark, beğenen hesapların sağlayıcı tarafından belirtilen ülkesidir. Türkiye kaynaklı serviste sağlayıcı hesapları Türk kullanıcılar olarak beyan eder; küresel serviste kaynak karışıktır. Sayaç ikisinde de aynı şekilde yükselir.' },
      { q: 'Beğenenlerin hepsi Türk mü olur?', a: 'Bu sağlayıcının beyanıdır; panel bilgiyi olduğu gibi aktarır ve tamamının Türkiye kaynaklı olacağını garanti etmez. İlk siparişi küçük tutup beğenenler listesini kendiniz kontrol etmeniz en sağlıklı yoldur.' },
      { q: 'Türk beğeni servislerinde üst sınır neden daha düşük?', a: 'Türkiye kaynaklı hesap havuzu küresel havuzdan küçüktür. Sağlayıcılar bu yüzden sipariş başına miktarı sınırlar; güncel sınır hizmet kartında yazar.' },
      { q: 'TikTok’ta beğenenler görünür mü?', a: 'Hayır, TikTok’ta bir videoyu kimlerin beğendiği başkalarına gösterilmez. Kaynak ülke daha çok video analizlerindeki izleyici bölgesi dağılımında fark edilir; bu yüzden Türk izlenme ile birlikte kullanmak anlamlıdır.' },
      { q: 'Beğeniler düşerse ne olur?', a: 'Telafi etiketli servislerde, kartta yazan süre içinde düşen kısım yeniden tamamlanır. Etiketsiz servislerde telafi yapılmaz. Hangi servisin hangi koşulla geldiği tabloda görünür.' },
      { q: 'Reels ve video gönderilerine de sipariş verebilir miyim?', a: 'Evet. Instagram’da gönderi, Reels ve video bağlantıları kabul edilir; TikTok’ta videonun tam bağlantısı girilir. Hesabın ve içeriğin herkese açık olması gerekir.' }
    ],
    faq_en: [
      { q: 'What is the difference between Turkish likes and regular likes?', a: 'The difference is the country of the liking accounts as stated by the provider. On a Turkey-sourced service the provider declares the accounts as Turkish users; on a global service the source is mixed. The counter rises the same way in both.' },
      { q: 'Will all the likers be Turkish?', a: 'That is the provider’s statement; the panel passes it on as-is and does not guarantee that all will be Turkey-sourced. Keeping the first order small and checking the list of likers yourself is the soundest approach.' },
      { q: 'Why is the cap lower on Turkish like services?', a: 'The Turkey-sourced account pool is smaller than the global one, so providers cap the quantity per order. The current cap is on the service card.' },
      { q: 'Are likers visible on TikTok?', a: 'No, TikTok does not show others who liked a video. Source country is noticed mostly in the viewer territory breakdown of video analytics, which is why pairing with Turkish views makes sense.' },
      { q: 'What happens if likes drop?', a: 'On services with a refill tag, the part that drops within the period on the card is topped up again. On services without it, no refill is made. The table shows which term each service comes with.' },
      { q: 'Can I order for Reels and video posts too?', a: 'Yes. On Instagram, post, Reels and video links are accepted; on TikTok the full video link is entered. The account and the content must be public.' }
    ],
    related_blog_slugs: ['instagram-begeni-satin-almanin-guvenli-yollari-2026-rehberi-msuz2k2w', 'sosyal-medya-etkilesim-orani-hesaplama-rehberi', 'tiktok-ta-viral-olmak-begeni-ve-izlenme-sayisinin-algoritmaya-etkisi-msvofnwa']
  }),

  // ---------------------------------------------------------------- 2
  page({
    slug: 'youtube-canli-yayin-izleyici-satin-al', platform_key: 'youtube', sort_order: 73,
    kategori_kaliplari: [/^youtube canl[ıi] yay[ıi]n/i],
    title_tr: 'YouTube Canlı Yayın İzleyici Satın Al', title_en: 'Buy YouTube Live Stream Viewers',
    subtitle_tr: 'YouTube canlı yayınlarınız için 15, 60 ve 90 dakikalık eşzamanlı izleyici paketleri. Süre seçimi, sipariş zamanlaması ve hizmetin neyi kapsamadığı bu sayfada.',
    subtitle_en: 'Concurrent viewer packages of 15, 60 and 90 minutes for your YouTube live streams. Choosing the duration, timing the order and what the service does not cover.',
    seo_title_tr: 'YouTube Canlı Yayın İzleyici Satın Al',
    seo_title_en: 'Buy YouTube Live Stream Viewers',
    seo_description_tr: 'YouTube canlı yayın izleyici satın al: 15, 60 ve 90 dakikalık eşzamanlı izleyici paketleri. Süre seçimi, zamanlama ve hizmetin kapsamı bu sayfada anlatıldı.',
    seo_description_en: 'Buy YouTube live stream viewers: concurrent viewer packages of 15, 60 and 90 minutes, how to pick the duration, when to order and what is not covered.',
    content_tr: `<h2>Eşzamanlı izleyici sayacı ne anlatır?</h2>
<p>YouTube canlı yayınında oynatıcının altında o anda izleyen kişi sayısı görünür. Yayına yeni giren biri için bu sayı, sohbetin hareketliliğiyle birlikte kalıp kalmamaya karar verdiren ilk işarettir: üç kişinin izlediği bir yayından çıkmak kolaydır, kalabalık görünen bir yayında ise izleyici biraz daha bekler. Bu sayfadaki paketler, yayınınız sürerken bu sayacı seçtiğiniz süre boyunca yükseltir.</p>
<p>Hizmet, kayıtlı videoların görüntülenme sayacından farklı çalışır: kalıcı bir sayı bırakmaz, süre bitince izleyiciler ayrılır. Kayıtlı video görüntülenmeleri için <a href="/youtube-izlenme-satin-al">YouTube izlenme satın al</a> sayfasındaki paketlere bakmanız gerekir.</p>
<h2>Süre nasıl seçilir?</h2>
<p>Paketler dakika bazlıdır. Seçimi yayının toplam uzunluğuna göre değil, <strong>izleyiciye en çok ihtiyaç duyduğunuz bölüme</strong> göre yapın.</p>
<table>
<thead><tr><th>Yayın türü</th><th>Uygun süre</th><th>Neden</th></tr></thead>
<tbody>
<tr><td>Ürün tanıtımı, kısa duyuru</td><td>15 dakika</td><td>Yayın kısa sürer; açılıştaki boş görüntüyü kapatmak yeterlidir.</td></tr>
<tr><td>Söyleşi, soru-cevap, ders</td><td>60 dakika</td><td>Yayının gövdesi boyunca sayaç sabit kalır.</td></tr>
<tr><td>Oyun yayını, maç yorumu, uzun sohbet</td><td>90 dakika</td><td>Uzun yayında en az kesintiyle ilerler.</td></tr>
</tbody>
</table>
<p>Yayınınız paketin süresinden uzun sürecekse iki yol vardır: paketi yayının en kritik bölümüne denk getirmek ya da ilk paket bitmeden kısa süre önce ikinci siparişi vermek. Süre dolduğunda sayacın düşmesi bir arıza değil, hizmetin kapsamının bitmesidir.</p>
<h2>İzleyici ve beğeni birlikte gelen paketler</h2>
<p>Katalogdaki bazı paketler izleyiciyle birlikte yayına beğeni de ekler. Yüzlerce kişinin izlediği görünen ama beğenisi tek haneli kalan bir yayın tutarsız durur; birleşik paket bu dengeyi tek siparişle kurar. Yalnızca izleyici sunan paketlerde sağlayıcı, sayacın paket süresince sabit kaldığını belirtir. Beğeniyi ayrıca planlamak isterseniz <a href="/youtube-begeni-satin-al">YouTube beğeni satın al</a> sayfasındaki seçeneklere bakabilirsiniz.</p>
<h2>Sipariş ne zaman verilmeli?</h2>
<ol>
<li>Yayını başlatın ve herkese açık olduğundan emin olun; gizli ve liste dışı yayınlara teslimat yapılamaz.</li>
<li>Yayının izleme bağlantısını kopyalayın: kanal adresini değil, yayının kendi adresini.</li>
<li>Siparişi yayının ilk dakikalarında verin; izleyicilerin yerleşmesi birkaç dakika sürer.</li>
<li>Yayını planladığınız süreden önce kapatmayın; kullanılmayan süre geri verilmez.</li>
</ol>
<p>Başlangıç süresi servise göre değişir ve hizmet kartında yazar; karttaki not her zaman bu sayfadaki genel anlatımın önündedir.</p>
<h2>Bu hizmet neyi yapmaz?</h2>
<p>Paket izleyicileri sohbete yazmaz, abone olmaz ve yayın bittikten sonra kanalınıza dönmez. Yayının kayıtlı hâlindeki görüntülenme sayısına ya da iş ortaklığı programının aradığı izlenme süresine sayılacağı da taahhüt edilmez; YouTube geçersiz saydığı trafiği hesaba katmayabilir. Eşiklerin gerçekte nasıl aşıldığını <a href="/blog/youtube-da-1000-abone-ve-4000-saat-izlenme-suresine-ulasma-rehberi-2890">1000 abone ve 4000 saat rehberinde</a>, yayın dışındaki izlenme süresini büyütmenin yollarını <a href="/blog/youtube-izlenme-suresi-artirmanin-yollari">izlenme süresi yazısında</a> anlattık.</p>
<p>Kanalın abone sayacı için <a href="/youtube-abone-satin-al">YouTube abone satın al</a>, platformdaki tüm servisler için <a href="/youtube-smm-panel">YouTube paneli</a> sayfası giriş noktasıdır. Twitch, Kick ve TikTok yayınlarının karşılığı <a href="/canli-yayin-izleyici-satin-al">canlı yayın izleyici satın al</a> sayfasında toplanmıştır.</p>
<h2>Dürüst uyarı</h2>
<blockquote>Eşzamanlı izleyici paketleri süre bazlıdır; süre dolduğunda sayacın düşmesi telafi konusu değildir. Bağlantınız koparsa ya da yayını erken bitirirseniz kalan süre geri verilmez. İzleyici sayısına ve sabitliğine ilişkin ifadeler sağlayıcının beyanıdır. Bu hizmet önerilenlerde yer alma, abone kazanımı veya para kazanma uygunluğu konusunda sonuç taahhüt etmez.</blockquote>`,
    content_en: `<h2>What does the concurrent viewer counter tell?</h2>
<p>On a YouTube live stream the number of people watching at that moment appears under the player. For someone who has just joined, that number, together with how lively the chat is, is the first signal in deciding whether to stay: leaving a stream watched by three people is easy, while on a stream that looks busy a viewer waits a little longer. The packages on this page raise that counter for the duration you choose while your stream is running.</p>
<p>The service works differently from the view counter on recorded videos: it leaves no lasting number, and viewers leave when the time is up. For recorded video views you need the packages on <a href="/youtube-izlenme-satin-al">buy YouTube views</a>.</p>
<h2>How to choose the duration</h2>
<p>Packages are sold by the minute. Choose not by the total length of the stream but by <strong>the part where you need viewers most</strong>.</p>
<table>
<thead><tr><th>Stream type</th><th>Suitable duration</th><th>Why</th></tr></thead>
<tbody>
<tr><td>Product launch, short announcement</td><td>15 minutes</td><td>The stream is short; covering the empty look at the opening is enough.</td></tr>
<tr><td>Interview, Q&amp;A, lesson</td><td>60 minutes</td><td>The counter stays steady through the body of the stream.</td></tr>
<tr><td>Gaming, match commentary, long chat</td><td>90 minutes</td><td>Runs through a long stream with the fewest gaps.</td></tr>
</tbody>
</table>
<p>If your stream will run longer than the package, there are two ways: line the package up with the most critical part of the stream, or place a second order shortly before the first one ends. The counter dropping when time is up is not a fault; it is the end of the service's scope.</p>
<h2>Packages with viewers and likes together</h2>
<p>Some packages in the catalogue add likes to the stream along with viewers. A stream that appears to be watched by hundreds but has single-digit likes looks inconsistent; a combined package sets that balance in one order. On viewer-only packages the provider states that the counter stays steady for the package duration. To plan likes separately, see the options on <a href="/youtube-begeni-satin-al">buy YouTube likes</a>.</p>
<h2>When should the order be placed?</h2>
<ol>
<li>Start the stream and make sure it is public; private and unlisted streams cannot receive delivery.</li>
<li>Copy the stream's watch link: not the channel address, the stream's own address.</li>
<li>Place the order in the first minutes of the stream; viewers take a few minutes to settle.</li>
<li>Do not end the stream before the time you planned; unused time is not given back.</li>
</ol>
<p>Start time varies by service and is stated on the service card; the note on the card always takes precedence over the general description on this page.</p>
<h2>What does this service not do?</h2>
<p>Package viewers do not write in chat, do not subscribe and do not come back to your channel after the stream. It is also not promised that they count toward the view number on the recorded stream or the watch time the Partner Program looks for; YouTube may exclude traffic it deems invalid. We explain how the thresholds are actually crossed in the <a href="/blog/youtube-da-1000-abone-ve-4000-saat-izlenme-suresine-ulasma-rehberi-2890">1,000 subscribers and 4,000 hours guide</a>, and ways to grow watch time outside live streams in the <a href="/blog/youtube-izlenme-suresi-artirmanin-yollari">watch time article</a>.</p>
<p>For the channel's subscriber counter see <a href="/youtube-abone-satin-al">buy YouTube subscribers</a>; the entry point to every service on the platform is the <a href="/youtube-smm-panel">YouTube panel</a>. The equivalent for Twitch, Kick and TikTok streams is gathered on <a href="/canli-yayin-izleyici-satin-al">buy live stream viewers</a>.</p>
<h2>An honest note</h2>
<blockquote>Concurrent viewer packages are time-based; the counter dropping when time is up is not a matter for a refill. If your connection drops or you end the stream early, the remaining time is not given back. Statements about viewer count and stability are the provider's. This service does not promise an outcome on appearing in suggestions, gaining subscribers or monetisation eligibility.</blockquote>`,
    steps_tr: [
      'Yayın saatinden önce hesabınızda yeterli bakiye olduğundan emin olun; yayın sırasında ödeme adımıyla uğraşmayın.',
      'Tablodan süreye göre paketi seçin: 15, 60 ya da 90 dakika; izleyiciyle birlikte beğeni isteyip istemediğinize karar verin.',
      'Yayını açın, izleme bağlantısını ve izleyici sayısını girip siparişi onaylayın.',
      'Sayaç birkaç dakika içinde yükselir; paket süresi dolmadan yayını kapatmayın.'
    ],
    steps_en: [
      'Make sure your balance is sufficient before stream time; do not deal with payment during the stream.',
      'Pick the package by duration from the table: 15, 60 or 90 minutes; decide whether you want likes together with viewers.',
      'Start the stream, enter the watch link and the viewer count, and confirm the order.',
      'The counter rises within a few minutes; do not end the stream before the package time is up.'
    ],
    faq_tr: [
      { q: 'İzleyiciler sohbete yazar mı?', a: 'Hayır. Paket yalnızca eşzamanlı izleyici sayacını yükseltir; sohbet mesajı, abonelik ya da Super Chat üretmez.' },
      { q: 'Yayın başlamadan sipariş verebilir miyim?', a: 'Servislerin çoğu çalışan bir yayın bağlantısı ister; bu yüzden yayını açtıktan hemen sonra sipariş vermenizi öneririz. Servise özel başlangıç notu hizmet kartında yazar.' },
      { q: 'Yayınım iki saat sürecek, hangi paketi almalıyım?', a: 'Katalogdaki en uzun paket şu an 90 dakikadır. Paketi yayının en önemli bölümüne denk getirebilir ya da ilk paketin bitimine yakın ikinci bir sipariş verebilirsiniz.' },
      { q: 'Süre bitince izleyici sayısı neden düşüyor?', a: 'Paket süre bazlıdır; izleyiciler seçtiğiniz dakika boyunca yayında kalır ve süre dolunca ayrılır. Bu bir düşüş değil, hizmetin tamamlanmasıdır.' },
      { q: 'Bu izlenmeler 4000 saat şartına sayılır mı?', a: 'Böyle bir taahhüt verilmez. YouTube iş ortaklığı değerlendirmesinde geçersiz saydığı trafiği hesaba katmayabilir.' },
      { q: 'Kaç izleyici almalıyım?', a: 'Kanalınızın olağan izleyici sayısıyla orantılı bir miktar seçin. Normalde on kişinin izlediği bir kanalda binlerce izleyici, hem sohbetin sessizliğiyle hem de önceki yayınlarla çelişir.' }
    ],
    faq_en: [
      { q: 'Do the viewers write in chat?', a: 'No. The package only raises the concurrent viewer counter; it does not produce chat messages, subscriptions or Super Chats.' },
      { q: 'Can I order before the stream starts?', a: 'Most services need a working stream link, so we recommend ordering right after you start the stream. The service-specific start note is on the service card.' },
      { q: 'My stream will run two hours; which package should I get?', a: 'The longest package in the catalogue is currently 90 minutes. You can line it up with the most important part of the stream, or place a second order near the end of the first.' },
      { q: 'Why does the viewer count drop when time is up?', a: 'The package is time-based; viewers stay on the stream for the minutes you chose and leave when the time is up. That is not a drop, it is the service completing.' },
      { q: 'Do these views count toward the 4,000-hour requirement?', a: 'No such promise is made. YouTube may exclude traffic it deems invalid from the Partner Program assessment.' },
      { q: 'How many viewers should I get?', a: 'Choose an amount proportional to your channel’s usual viewer count. Thousands of viewers on a channel normally watched by ten people clashes with both a quiet chat and your earlier streams.' }
    ],
    related_blog_slugs: ['youtube-izlenme-suresi-artirmanin-yollari', 'youtube-da-1000-abone-ve-4000-saat-izlenme-suresine-ulasma-rehberi-2890', 'youtube-video-seo-baslik-etiket-aciklama']
  }),

  // ---------------------------------------------------------------- 3
  page({
    slug: 'tiktok-kaydetme-satin-al', platform_key: 'tiktok', sort_order: 74,
    kategori_kaliplari: [/^tiktok (video )?kaydetme$/i, /^tiktok payla[şs][ıi]m$/i],
    title_tr: 'TikTok Kaydetme ve Paylaşım Satın Al', title_en: 'Buy TikTok Saves and Shares',
    subtitle_tr: 'TikTok videolarınız için kaydetme ve paylaşım paketleri. Bu iki sayacın hangi içerikte anlam taşıdığını, beğeniye göre oranı ve yenileme seçeneklerini anlattık.',
    subtitle_en: 'Save and share packages for your TikTok videos. Which content each counter suits, the ratio against likes, and the refill options.',
    seo_title_tr: 'TikTok Kaydetme ve Paylaşım Satın Al',
    seo_title_en: 'Buy TikTok Saves and Shares',
    seo_description_tr: 'TikTok kaydetme satın al: videolarınız için kaydetme ve paylaşım paketleri. Hangi içerikte hangisi, beğeniye göre oran ve yenileme seçenekleri bu sayfada.',
    seo_description_en: 'Buy TikTok saves and shares: packages for your videos, which content each counter suits, the ratio against likes and the refill options.',
    content_tr: `<h2>Kaydetme ve paylaşım sayaçları nerede durur?</h2>
<p>TikTok'ta her videonun sağ kenarında dört sayaç alt alta dizilir: beğeni, yorum, kaydetme (yer işareti simgesi) ve paylaşım (ok simgesi). İlk ikisine herkes bakar; son ikisi ise videonun <strong>tekrar dönülecek ya da başkasına gönderilecek kadar değerli</strong> bulunduğunu gösterir. İzlenmesi ve beğenisi yüksek, kaydetme ve paylaşım hanesi boş kalan bir video bu yüzden yarım görünür. Bu sayfadaki paketler bu iki sayacı yükseltir.</p>
<h2>Hangi içerikte hangisi anlamlı?</h2>
<p>İki sayaç aynı şeyi söylemez. Kaydetme "bunu sonra kullanacağım", paylaşım "bunu biri görmeli" demektir. İçerik türüne göre doğal olan sayaç değişir:</p>
<ul>
<li><strong>Tarif, eğitim, liste, ürün incelemesi:</strong> İzleyici içeriğe geri dönmek ister; kaydetme sayısının paylaşımdan yüksek olması beklenir.</li>
<li><strong>Mizah, tepki, gündem videosu:</strong> İçerik arkadaşa gönderilir; paylaşım öne geçer, kaydetme düşük kalır.</li>
<li><strong>Mekân ve etkinlik tanıtımı:</strong> İkisi birlikte hareket eder; izleyici hem kaydeder hem de birlikte gideceği kişiye yollar.</li>
</ul>
<p>Siparişi bu mantığa göre verin: bir mizah videosunda binlerce kaydetme ya da bir tarif videosunda kaydetmesiz yüksek paylaşım doğal durmaz.</p>
<h2>Beğeniye göre oran</h2>
<p>Kaydetme ve paylaşım, beğeniden daha zahmetli hareketlerdir; bu yüzden gerçek videolarda sayıları beğeninin belirgin biçimde altında kalır. Güvenli ölçü, bu iki sayacın her birini beğeni sayısının küçük bir bölümünde tutmaktır. Beğeniyi aşan bir kaydetme sayısı, videoyu açan herkesin fark edeceği bir tutarsızlıktır. Videonun izlenme ve beğeni tabanı zayıfsa önce onu kurun: <a href="/tiktok-izlenme-satin-al">TikTok izlenme satın al</a> ve <a href="/tiktok-begeni-satin-al">TikTok beğeni satın al</a> sayfaları bu iki adımı anlatır.</p>
<h2>Yenileme seçenekleri</h2>
<p>Katalogda bu iki sayaç için üç tür servis bulunur ve farkı hizmet kartındaki etiket belirler:</p>
<ol>
<li><strong>Yenilemesiz servis:</strong> En düşük birim fiyatlıdır; sayaçta düşüş olursa telafi yapılmaz.</li>
<li><strong>Süreli yenileme:</strong> Kartta yazan gün sayısı içinde düşen kısım yeniden tamamlanır.</li>
<li><strong>İptal edilebilir servis:</strong> Teslim edilemeyen kısım bakiyenize iade edilir; büyük siparişlerde tercih edilir.</li>
</ol>
<p>Kısa ömürlü bir gündem videosunda yenilemesiz servis yeterlidir. Profilde sabitlediğiniz ya da reklamda kullanacağınız bir videoda yenilemeli servis daha mantıklıdır. Yenileme kavramının ayrıntısı <a href="/blog/refill-yenileme-nedir-takipci-neden-duser">yenileme yazımızdadır</a>.</p>
<h2>Diğer platformlardaki karşılığı</h2>
<p>Aynı videoyu Reels olarak da paylaşıyorsanız Instagram tarafındaki eşdeğer hizmet <a href="/instagram-kaydetme-satin-al">Instagram kaydetme satın al</a> sayfasındadır. Görsel ve ürün içeriklerinde kaydetmenin en belirleyici olduğu platform için <a href="/pinterest-kaydetme-satin-al">Pinterest kaydetme satın al</a> sayfasına bakabilirsiniz. TikTok'ta yorum tarafını <a href="/tiktok-yorum-satin-al">TikTok yorum satın al</a>, platformun bütün servislerini <a href="/tiktok-smm-panel">TikTok paneli</a> sayfası toplar. TikTok'un dağıtımda hangi sinyallere baktığını <a href="/blog/tiktok-algoritmasi-nasil-calisir">algoritma yazımızda</a> ele aldık.</p>
<h2>Dürüst uyarı</h2>
<blockquote>Kaydetme ve paylaşım paketleri yalnızca ilgili sayacı yükseltir; videoyu kaydeden ya da paylaşan gerçek bir izleyici kitlesi oluşturmaz. Düşüş oranı ve kaynak kalitesine ilişkin ifadeler sağlayıcının beyanıdır. Yenilemesiz servislerde düşüş telafi edilmez. Videonun Sizin İçin akışına girmesi, izlenme artışı veya takipçi kazanımı taahhüt edilmez.</blockquote>`,
    content_en: `<h2>Where do the save and share counters sit?</h2>
<p>On TikTok, four counters are stacked on the right edge of every video: likes, comments, saves (the bookmark icon) and shares (the arrow icon). Everyone looks at the first two; the last two show that the video was found <strong>valuable enough to return to or to send to someone</strong>. A video with high views and likes but empty save and share slots therefore looks half-finished. The packages on this page raise those two counters.</p>
<h2>Which one suits which content?</h2>
<p>The two counters do not say the same thing. A save means "I will use this later"; a share means "someone should see this". Which counter is natural depends on the content type:</p>
<ul>
<li><strong>Recipes, tutorials, lists, product reviews:</strong> viewers want to come back; saves are expected to be higher than shares.</li>
<li><strong>Humour, reactions, trending-topic videos:</strong> the content is sent to friends; shares lead and saves stay low.</li>
<li><strong>Venue and event promotion:</strong> the two move together; viewers both save and send it to the person they will go with.</li>
</ul>
<p>Order accordingly: thousands of saves on a comedy video, or high shares with no saves on a recipe video, does not look natural.</p>
<h2>The ratio against likes</h2>
<p>Saving and sharing take more effort than liking, so on real videos their numbers sit clearly below the like count. The safe measure is to keep each of these two counters at a small fraction of the likes. A save count above the likes is an inconsistency anyone opening the video will notice. If the video's view and like base is weak, build that first: <a href="/tiktok-izlenme-satin-al">buy TikTok views</a> and <a href="/tiktok-begeni-satin-al">buy TikTok likes</a> cover those two steps.</p>
<h2>Refill options</h2>
<p>The catalogue has three kinds of service for these two counters, and the tag on the service card tells them apart:</p>
<ol>
<li><strong>No-refill service:</strong> the lowest unit price; if the counter drops, no refill is made.</li>
<li><strong>Timed refill:</strong> the part that drops within the number of days on the card is topped up again.</li>
<li><strong>Cancel-enabled service:</strong> the undelivered part is refunded to your balance; preferred for large orders.</li>
</ol>
<p>For a short-lived trending video a no-refill service is enough. For a video you pin on your profile or will use in an ad, a refill service makes more sense. The refill concept is explained in detail in our <a href="/blog/refill-yenileme-nedir-takipci-neden-duser">refill article</a>.</p>
<h2>The equivalent on other platforms</h2>
<p>If you also post the same video as a Reel, the equivalent service on the Instagram side is on <a href="/instagram-kaydetme-satin-al">buy Instagram saves</a>. For the platform where saves matter most for visual and product content, see <a href="/pinterest-kaydetme-satin-al">buy Pinterest saves</a>. On TikTok the comment side is on <a href="/tiktok-yorum-satin-al">buy TikTok comments</a>, and every service on the platform is gathered on the <a href="/tiktok-smm-panel">TikTok panel</a>. We cover which signals TikTok looks at for distribution in our <a href="/blog/tiktok-algoritmasi-nasil-calisir">algorithm article</a>.</p>
<h2>An honest note</h2>
<blockquote>Save and share packages raise only the counter in question; they do not create a real audience that saves or shares the video. Statements about drop rate and source quality are the provider's. On no-refill services drops are not compensated. The video entering the For You feed, more views or follower gains are not promised.</blockquote>`,
    steps_tr: [
      'Videonun herkese açık olduğunu ve hesabınızın gizli olmadığını kontrol edin.',
      'Tablodan kaydetme ya da paylaşım servisini seçin; yenileme ve iptal etiketlerini karttan okuyun.',
      'TikTok videosunun tam bağlantısını girin ve miktarı beğeni sayınızın altında kalacak şekilde belirleyin.',
      'Siparişi onaylayın; ilerlemeyi Siparişlerim sayfasından izleyin.'
    ],
    steps_en: [
      'Check that the video is public and your account is not private.',
      'Pick the save or share service from the table; read the refill and cancel tags on the card.',
      'Enter the full TikTok video link and set the quantity so it stays below your like count.',
      'Confirm the order and follow progress on the My Orders page.'
    ],
    faq_tr: [
      { q: 'TikTok’ta kaydetme sayısı herkese görünür mü?', a: 'Evet. Kaydetme sayacı videonun sağ kenarında yer işareti simgesiyle herkese açık görünür. Videoyu kimin kaydettiği ise gösterilmez.' },
      { q: 'Kaydetme mi paylaşım mı almalıyım?', a: 'İçerik türüne göre değişir: tarif, eğitim ve liste videolarında kaydetme; mizah ve gündem videolarında paylaşım doğal durur. Emin değilseniz ikisini küçük miktarlarda birlikte alın.' },
      { q: 'Kaç kaydetme almalıyım?', a: 'Beğeni sayınızın altında kalacak bir miktar seçin. Beğeniyi aşan kaydetme ya da paylaşım sayısı tutarsız görünür.' },
      { q: 'Hesabım gizliyse sipariş verebilir miyim?', a: 'Hayır. Gizli hesaplardaki videolara teslimat yapılamaz; sipariş öncesi hesabın ve videonun herkese açık olması gerekir.' },
      { q: 'Kaydetmeler düşer mi?', a: 'Servise göre değişir. Yenilemeli servislerde kartta yazan süre içinde düşen kısım tamamlanır; yenilemesiz servislerde telafi yapılmaz.' },
      { q: 'Aynı videoya hem kaydetme hem paylaşım siparişi verilir mi?', a: 'Evet, bunlar ayrı servislerdir ve aynı videoya birlikte sipariş verilebilir. Aynı servisten ikinci siparişi ise ilki tamamlandıktan sonra verin.' }
    ],
    faq_en: [
      { q: 'Is the save count on TikTok visible to everyone?', a: 'Yes. The save counter is publicly visible on the right edge of the video with the bookmark icon. Who saved the video is not shown.' },
      { q: 'Should I buy saves or shares?', a: 'It depends on the content: saves look natural on recipe, tutorial and list videos; shares on humour and trending-topic videos. If unsure, take both in small amounts.' },
      { q: 'How many saves should I buy?', a: 'Choose an amount that stays below your like count. A save or share count above the likes looks inconsistent.' },
      { q: 'Can I order if my account is private?', a: 'No. Videos on private accounts cannot receive delivery; the account and the video must be public before ordering.' },
      { q: 'Do saves drop?', a: 'It depends on the service. On refill services the part that drops within the period on the card is topped up; on no-refill services no compensation is made.' },
      { q: 'Can I order both saves and shares for the same video?', a: 'Yes, they are separate services and can be ordered together for the same video. For a second order of the same service, wait until the first completes.' }
    ],
    related_blog_slugs: ['tiktok-algoritmasi-nasil-calisir', 'tiktok-ta-viral-olmak-begeni-ve-izlenme-sayisinin-algoritmaya-etkisi-msvofnwa', 'refill-yenileme-nedir-takipci-neden-duser']
  }),

  // ---------------------------------------------------------------- 4
  page({
    slug: 'instagram-erisim-satin-al', platform_key: 'instagram', sort_order: 75,
    kategori_kaliplari: [/^instagram profil eri[şs]imi$/i],
    title_tr: 'Instagram Erişim ve Profil Ziyareti Satın Al', title_en: 'Buy Instagram Reach and Profile Visits',
    subtitle_tr: 'Reels ve video görüntülenmesiyle birlikte erişim, gösterim ve profil ziyareti paketleri. İstatistik ekranındaki bu üç kalemin ne anlama geldiğini ve hizmetin sınırlarını anlattık.',
    subtitle_en: 'Reach, impression and profile visit packages that come with Reels and video views. What these three insights items mean and where the service stops.',
    seo_title_tr: 'Instagram Erişim ve Profil Ziyareti Satın Al',
    seo_title_en: 'Buy Instagram Reach and Profile Visits',
    seo_description_tr: 'Instagram erişim satın al: görüntülenmeyle gelen erişim, gösterim ve profil ziyareti paketleri. Üç metriğin farkı, istatistik kontrolü ve hizmetin sınırları.',
    seo_description_en: 'Buy Instagram reach: reach, impression and profile visit packages that come with views, the difference between the three metrics and the limits of the service.',
    content_tr: `<h2>Erişim, gösterim, profil ziyareti: üç ayrı kalem</h2>
<p>Instagram'da bir içeriğin altında herkesin gördüğü sayılar (beğeni, yorum, görüntülenme) hikâyenin yalnızca bir kısmıdır. Profesyonel hesapların istatistik ekranında yalnızca hesap sahibinin gördüğü kalemler de vardır ve bu sayfadaki paketler onlara yöneliktir.</p>
<table>
<thead><tr><th>Kalem</th><th>Ne sayar?</th><th>Kim görür?</th></tr></thead>
<tbody>
<tr><td>Erişim</td><td>İçeriği en az bir kez gören tekil hesap sayısı</td><td>Yalnızca hesap sahibi</td></tr>
<tr><td>Gösterim</td><td>İçeriğin ekranda toplam kaç kez göründüğü; aynı kişi iki kez görürse iki sayılır</td><td>Yalnızca hesap sahibi</td></tr>
<tr><td>Profil ziyareti</td><td>İçerikten sonra profilinize giren hesap sayısı</td><td>Yalnızca hesap sahibi</td></tr>
</tbody>
</table>
<p>Yani bu kalemler vitrinde değil, arka ofiste durur. Kendi başlarına ziyaretçiye bir şey göstermezler; anlamları, istatistik ekranına baktığınızda ya da onu birine sunduğunuzda ortaya çıkar.</p>
<h2>Paketler nasıl çalışır?</h2>
<p>Katalogda erişim ya da profil ziyareti tek başına satılmaz; bir Reels ya da video görüntülenme siparişinin parçası olarak gelir. Servis adında hangi kalemlerin dahil olduğu sırayla yazar: bazıları görüntülenme, gösterim ve erişim verir; bazıları bunlara profil ziyaretini de ekler. Siparişten önce servis adını okuyup ihtiyacınız olan kalemin içinde geçtiğinden emin olun.</p>
<p>Yalnızca herkese açık görüntülenme sayacını yükseltmek istiyorsanız daha ekonomik seçenekler <a href="/instagram-izlenme-satin-al">Instagram izlenme satın al</a> sayfasındadır. Fark şudur: düz izlenme paketi vitrindeki sayıyı, bu sayfadaki paketler ise onunla birlikte istatistik ekranındaki kalemleri hareket ettirir.</p>
<h2>Kimler için anlamlı?</h2>
<ul>
<li><strong>İstatistikleri dengesiz görünen hesaplar:</strong> Görüntülenmesi yüksek ama erişimi ve profil ziyareti çok düşük kalan bir içerik, analiz ekranında tuhaf durur.</li>
<li><strong>Yeni profesyonel hesaplar:</strong> İstatistik ekranı boşken ilk verilerin oluşmasını isteyenler.</li>
<li><strong>İstatistik ekranını öğrenmek isteyenler:</strong> Kalemlerin nerede durduğunu ve nasıl hareket ettiğini kendi içeriğinde görmek isteyenler.</li>
</ul>
<p>Bir konuda açık olalım: istatistik ekranı çoğunlukla marka iş birliği görüşmelerinde istenir. Satın alınan erişimi bir markaya organik performans gibi sunmak yanıltıcıdır ve ilk kampanyada ortaya çıkar; çünkü marka satışa, tıklamaya ve gerçek etkileşim oranına bakar. İş birliği eşiklerini <a href="/blog/influencer-olmak-icin-kac-takipci-gerekir">influencer olmak için kaç takipçi gerekir</a> yazımızda, oranın nasıl hesaplandığını <a href="/blog/sosyal-medya-etkilesim-orani-hesaplama-rehberi">etkileşim oranı rehberinde</a> anlattık.</p>
<h2>İstatistiklerde nasıl kontrol edilir?</h2>
<ol>
<li>Hesabınızın profesyonel (içerik üreticisi ya da işletme) hesap olduğundan emin olun; kişisel hesaplarda istatistik ekranı yoktur.</li>
<li>Sipariş verdiğiniz Reels ya da videoyu açın ve istatistikleri görüntüleme bağlantısına dokunun.</li>
<li>Genel bakış bölümünde erişilen hesaplar ve profil hareketleri kalemlerini kontrol edin.</li>
</ol>
<p>Instagram bu kalemlerin adını ve ekrandaki yerini zaman zaman değiştirir; güncel sürümde "gösterim" yerine "görüntülenme" adıyla karşılaşabilirsiniz. İstatistiklerin güncellenmesi siparişin tamamlanmasından sonra bir süre alabilir.</p>
<h2>Birlikte planlama</h2>
<p>Erişim ve görüntülenme yükselirken beğeni ve kaydetme yerinde sayarsa oran bozulur. Dengeyi kurmak için <a href="/instagram-begeni-satin-al">Instagram beğeni satın al</a> ve <a href="/instagram-kaydetme-satin-al">Instagram kaydetme satın al</a> sayfalarındaki küçük paketler yeterlidir. Platformdaki bütün servislerin listesi <a href="/instagram-smm-panel">Instagram paneli</a> sayfasındadır. Erişimi içerikle büyütmenin yollarını <a href="/blog/2026-instagram-kesfet-taktikleri">Keşfet taktikleri yazımızda</a> bulabilirsiniz.</p>
<h2>Dürüst uyarı</h2>
<blockquote>Bu paketler istatistik ekranındaki sayıları yükseltir; içeriğinizi gerçekten gören, ilgilenen ya da satın alan bir kitle oluşturmaz. Hangi kalemlerin dahil olduğu sağlayıcının beyanıdır ve servis adında yazar. Instagram geçersiz saydığı etkileşimi istatistiklerden düşebilir; bu durumda telafi yapılmaz. Keşfet'e çıkma, takipçi kazanımı veya iş birliği sonucu taahhüt edilmez.</blockquote>`,
    content_en: `<h2>Reach, impressions, profile visits: three separate items</h2>
<p>The numbers everyone sees under a piece of Instagram content (likes, comments, views) are only part of the story. The insights screen of professional accounts also has items only the account owner sees, and the packages on this page are aimed at those.</p>
<table>
<thead><tr><th>Item</th><th>What does it count?</th><th>Who sees it?</th></tr></thead>
<tbody>
<tr><td>Reach</td><td>The number of unique accounts that saw the content at least once</td><td>Account owner only</td></tr>
<tr><td>Impressions</td><td>How many times the content appeared on screen in total; the same person seeing it twice counts twice</td><td>Account owner only</td></tr>
<tr><td>Profile visits</td><td>The number of accounts that opened your profile after the content</td><td>Account owner only</td></tr>
</tbody>
</table>
<p>So these items sit in the back office, not the shop window. They show nothing to a visitor by themselves; their meaning appears when you look at the insights screen or present it to someone.</p>
<h2>How do the packages work?</h2>
<p>The catalogue does not sell reach or profile visits separately; they come as part of a Reels or video view order. The service name lists which items are included, in order: some give views, impressions and reach; others add profile visits. Read the service name before ordering and make sure the item you need is in it.</p>
<p>If you only want to raise the public view counter, cheaper options are on <a href="/instagram-izlenme-satin-al">buy Instagram views</a>. The difference: a plain view package moves the number in the shop window, while the packages here move the insights items along with it.</p>
<h2>Who is it meaningful for?</h2>
<ul>
<li><strong>Accounts with unbalanced insights:</strong> content with high views but very low reach and profile visits looks odd on the analytics screen.</li>
<li><strong>New professional accounts:</strong> those who want first data to form while the insights screen is empty.</li>
<li><strong>Those learning the insights screen:</strong> people who want to see where the items sit and how they move on their own content.</li>
</ul>
<p>Let us be clear about one thing: the insights screen is mostly requested in brand deal talks. Presenting purchased reach to a brand as organic performance is misleading and comes out in the first campaign, because the brand looks at sales, clicks and the real engagement rate. We cover collaboration thresholds in <a href="/blog/influencer-olmak-icin-kac-takipci-gerekir">how many followers you need to be an influencer</a>, and how the rate is calculated in the <a href="/blog/sosyal-medya-etkilesim-orani-hesaplama-rehberi">engagement rate guide</a>.</p>
<h2>How to check it in insights</h2>
<ol>
<li>Make sure your account is a professional (creator or business) account; personal accounts have no insights screen.</li>
<li>Open the Reel or video you ordered for and tap the link to view insights.</li>
<li>In the overview section, check the accounts reached and profile activity items.</li>
</ol>
<p>Instagram changes the names and position of these items from time to time; in the current version you may see "views" instead of "impressions". Insights can take a while to update after the order completes.</p>
<h2>Planning together</h2>
<p>If reach and views rise while likes and saves stand still, the ratio breaks. Small packages on <a href="/instagram-begeni-satin-al">buy Instagram likes</a> and <a href="/instagram-kaydetme-satin-al">buy Instagram saves</a> are enough to restore the balance. The list of every service on the platform is on the <a href="/instagram-smm-panel">Instagram panel</a>. Ways to grow reach with content are in our <a href="/blog/2026-instagram-kesfet-taktikleri">Explore tactics article</a>.</p>
<h2>An honest note</h2>
<blockquote>These packages raise the numbers on the insights screen; they do not create an audience that actually sees, cares about or buys from your content. Which items are included is the provider's statement and is written in the service name. Instagram may remove engagement it deems invalid from insights; in that case no compensation is made. Reaching Explore, follower gains or a collaboration outcome are not promised.</blockquote>`,
    steps_tr: [
      'Hesabınızı profesyonel hesaba çevirin; istatistik ekranı yalnızca bu hesap türünde açılır.',
      'Tablodaki servis adlarını okuyun ve ihtiyacınız olan kalemi (erişim, gösterim, profil ziyareti) içeren servisi seçin.',
      'Reels ya da videonun herkese açık bağlantısını ve miktarı girip siparişi onaylayın.',
      'Sipariş tamamlandıktan sonra içeriğin istatistik ekranını açıp kalemleri kontrol edin.'
    ],
    steps_en: [
      'Switch your account to a professional account; the insights screen only opens on this account type.',
      'Read the service names in the table and pick the one that includes the item you need (reach, impressions, profile visits).',
      'Enter the public link of the Reel or video and the quantity, then confirm the order.',
      'After the order completes, open the content’s insights screen and check the items.'
    ],
    faq_tr: [
      { q: 'Erişim ile gösterim arasındaki fark nedir?', a: 'Erişim, içeriği gören tekil hesap sayısıdır. Gösterim, toplam görünme sayısıdır; aynı hesap içeriği üç kez görürse erişim bir, gösterim üç artar.' },
      { q: 'Erişim sayısını başkaları görebilir mi?', a: 'Hayır. Erişim, gösterim ve profil ziyareti yalnızca hesap sahibinin istatistik ekranında görünür. Herkese açık olan sayı görüntülenme sayacıdır.' },
      { q: 'Kişisel hesapla bu paketleri kullanabilir miyim?', a: 'Sipariş verilebilir ama sonucu göremezsiniz; istatistik ekranı yalnızca profesyonel hesaplarda bulunur. Ayarlardan ücretsiz olarak profesyonel hesaba geçebilirsiniz.' },
      { q: 'Profil ziyareti takipçi kazandırır mı?', a: 'Böyle bir taahhüt verilmez. Paket profil ziyareti sayısını yükseltir; ziyaretin takibe dönüşmesi profilinizin içeriğine bağlıdır.' },
      { q: 'Fotoğraf gönderisine sipariş verebilir miyim?', a: 'Bu kategorideki servisler Reels ve video içerikler içindir. Hangi bağlantı türlerinin kabul edildiği servis adında ve hizmet kartında yazar.' },
      { q: 'İstatistikler ne zaman güncellenir?', a: 'Instagram istatistikleri gecikmeli işleyebilir. Sipariş tamamlandıktan sonra sayıların ekrana yansıması bir süre alabilir.' }
    ],
    faq_en: [
      { q: 'What is the difference between reach and impressions?', a: 'Reach is the number of unique accounts that saw the content. Impressions is the total number of times it appeared; if one account sees it three times, reach rises by one and impressions by three.' },
      { q: 'Can others see my reach?', a: 'No. Reach, impressions and profile visits appear only on the account owner’s insights screen. The public number is the view counter.' },
      { q: 'Can I use these packages with a personal account?', a: 'You can order, but you will not see the result; the insights screen exists only on professional accounts. You can switch to a professional account for free in settings.' },
      { q: 'Do profile visits gain followers?', a: 'No such promise is made. The package raises the profile visit number; whether a visit turns into a follow depends on your profile’s content.' },
      { q: 'Can I order for a photo post?', a: 'The services in this category are for Reels and video content. Which link types are accepted is stated in the service name and on the service card.' },
      { q: 'When do insights update?', a: 'Instagram insights can be processed with a delay. After the order completes, it may take a while for the numbers to appear on screen.' }
    ],
    related_blog_slugs: ['2026-instagram-kesfet-taktikleri', 'sosyal-medya-etkilesim-orani-hesaplama-rehberi', 'influencer-olmak-icin-kac-takipci-gerekir']
  }),

  // ---------------------------------------------------------------- 5
  page({
    slug: 'facebook-smm-panel', platform_key: 'facebook', sort_order: 76,
    kategori_kaliplari: [/^facebook/i],
    title_tr: 'Facebook SMM Panel', title_en: 'Facebook SMM Panel',
    subtitle_tr: 'Facebook sayfa, profil, grup, gönderi ve video hizmetlerinin tamamı tek panelde. Hedefinize göre hangi servisi seçeceğinizi ve hangi bağlantıyı gireceğinizi anlattık.',
    subtitle_en: 'Every Facebook page, profile, group, post and video service in one panel. Which service to choose for your goal and which link to enter.',
    seo_title_tr: 'Facebook SMM Panel – Beğeni, Takipçi, İzlenme',
    seo_title_en: 'Facebook SMM Panel – Likes, Followers and Views',
    seo_description_tr: 'Facebook SMM panel: sayfa takipçisi, gönderi beğenisi, emoji tepkisi, paylaşım, video ve canlı yayın izlenme servisleri tek ekranda. Hedefe göre seçim rehberi.',
    seo_description_en: 'Facebook SMM panel: page followers, post likes, emoji reactions, shares, video and live stream view services on one screen, with a guide to choosing by goal.',
    content_tr: `<h2>Facebook paneli neyi bir araya getirir?</h2>
<p>Facebook'ta büyütülecek tek bir sayaç yoktur: sayfanın takipçisi, gönderinin beğenisi, videonun izlenmesi, canlı yayının izleyicisi ve grubun üyesi ayrı ayrı sayılır ve her biri için farklı bir bağlantı gerekir. Facebook paneli, bu servislerin hepsini aynı bakiyeden sipariş edebildiğiniz ekrandır. Sayfadaki fiyat tablosu, panelde şu anda açık olan bütün Facebook servislerini canlı fiyatlarıyla listeler.</p>
<h2>Hedefe göre hangi servis?</h2>
<table>
<thead><tr><th>Hedefiniz</th><th>Servis grubu</th><th>Gireceğiniz bağlantı</th></tr></thead>
<tbody>
<tr><td>İşletme sayfasının güven vermesi</td><td>Sayfa takipçisi, sayfa beğenisi</td><td>Sayfanın adresi</td></tr>
<tr><td>Kişisel profilin takipçi sayısı</td><td>Profil takipçisi</td><td>Profilin adresi (takip seçeneği açık olmalı)</td></tr>
<tr><td>Tek bir gönderinin öne çıkması</td><td>Gönderi beğenisi, emoji tepkisi, paylaşım, yorum</td><td>Gönderinin adresi</td></tr>
<tr><td>Video ve Reels görünürlüğü</td><td>Video görüntülenme, erişim ve gösterim</td><td>Videonun adresi</td></tr>
<tr><td>Canlı yayının dolu görünmesi</td><td>Canlı yayın izleyicisi</td><td>Yayının adresi</td></tr>
<tr><td>Grubun kalabalık görünmesi</td><td>Grup üyesi</td><td>Grubun adresi (herkese açık grup)</td></tr>
</tbody>
</table>
<p>En sık yapılan hata yanlış bağlantı girmektir: gönderi beğenisi siparişine sayfa adresi yazılırsa sipariş işlenemez. Tablonun üçüncü sütunu bu yüzden var.</p>
<h2>Ayrıntı sayfaları</h2>
<p>İki servis grubunun kendi sayfası vardır. Sayfa takipçisi ve sayfa beğenisi paketlerinin farkları <a href="/facebook-sayfa-begeni-satin-al">Facebook sayfa beğeni satın al</a> sayfasında, video ve Reels paketleri <a href="/facebook-izlenme-satin-al">Facebook izlenme satın al</a> sayfasında anlatılır. Canlı yayın izleyicisinin süre bazlı mantığı bütün platformlar için <a href="/canli-yayin-izleyici-satin-al">canlı yayın izleyici satın al</a> sayfasındadır.</p>
<h2>Gönderi beğenisi ve emoji tepkileri</h2>
<p>Facebook, beğeniyi tek bir düğmeyle sınırlamaz: gönderiye kalp, şaşkınlık ya da öfke tepkisi de bırakılabilir ve gönderinin altında en çok kullanılan tepkilerin simgeleri görünür. Katalogda düz beğeninin yanında belirli bir tepki türünü seçebildiğiniz servisler bulunur. Kullanım yeri içeriğe göre değişir: bir kampanya duyurusunda kalp, şaşırtıcı bir haberde şaşkınlık tepkisi doğal durur. Tek tür tepkiyi yüksek miktarda almak yerine düz beğeniyle karıştırmak, gerçek bir gönderinin tepki dağılımına daha çok benzer.</p>
<p>Paylaşım servisi gönderinin paylaşım sayacını yükseltir; küçük miktarlarda ve seçili gönderilerde kullanılması yeterlidir.</p>
<h2>Sayfa hâlâ işe yarar mı?</h2>
<p>Facebook'ta organik sayfa erişimi yıllar içinde daraldı; buna rağmen yerel işletmeler, etkinlikler ve belirli yaş grupları için platform hâlâ ilk bakılan yerlerden biridir. Sayaçları yükseltmek erişimi geri getirmez: dağıtımı belirleyen şey gönderinin aldığı gerçek etkileşim ve gerekirse reklamdır. Bu dengeyi <a href="/blog/facebook-sayfa-begeni-ve-erisim-artirma">Facebook sayfa beğeni ve erişim yazımızda</a> ayrıntılı ele aldık.</p>
<h2>Bayi ve API kullanımı</h2>
<p>Müşterilerinin Facebook sayfalarını yöneten ajanslar ve kendi panelini işleten bayiler, aynı servisleri API üzerinden kendi sistemlerine bağlayabilir; uç noktalar ve örnek istekler <a href="/smm-panel-api">SMM panel API</a> sayfasında belgelenmiştir. Fiyatın neye göre oluştuğunu <a href="/ucuz-smm-panel">ucuz SMM panel</a> sayfasında, Meta'nın diğer platformundaki servisleri <a href="/instagram-smm-panel">Instagram paneli</a> sayfasında bulabilirsiniz.</p>
<h2>Dürüst uyarı</h2>
<blockquote>Yenileme kapsamı servisten servise değişir: bazı Facebook servisleri süreli ya da ömür boyu yenileme beyanıyla, bazıları yenilemesiz listelenir ve geçerli koşul hizmet kartında yazar. "Gerçek hesap" ve "düşüş yok" ifadeleri sağlayıcının beyanıdır. Facebook yapay etkileşimi kurallarında onaylamaz ve geçersiz saydığı etkileşimi silebilir. Bu servisler sayfa erişimi, reklam performansı veya satış konusunda sonuç taahhüt etmez.</blockquote>`,
    content_en: `<h2>What does the Facebook panel bring together?</h2>
<p>There is no single counter to grow on Facebook: a page's followers, a post's likes, a video's views, a live stream's viewers and a group's members are all counted separately, and each needs a different link. The Facebook panel is the screen where you can order all of these services from the same balance. The price table on this page lists every Facebook service currently open in the panel with live prices.</p>
<h2>Which service for which goal?</h2>
<table>
<thead><tr><th>Your goal</th><th>Service group</th><th>Link to enter</th></tr></thead>
<tbody>
<tr><td>A business page that inspires trust</td><td>Page followers, page likes</td><td>The page address</td></tr>
<tr><td>Follower count on a personal profile</td><td>Profile followers</td><td>The profile address (the follow option must be on)</td></tr>
<tr><td>Making a single post stand out</td><td>Post likes, emoji reactions, shares, comments</td><td>The post address</td></tr>
<tr><td>Video and Reels visibility</td><td>Video views, reach and impressions</td><td>The video address</td></tr>
<tr><td>A live stream that looks full</td><td>Live stream viewers</td><td>The stream address</td></tr>
<tr><td>A group that looks busy</td><td>Group members</td><td>The group address (public group)</td></tr>
</tbody>
</table>
<p>The most common mistake is entering the wrong link: if a page address is typed into a post like order, the order cannot be processed. That is why the table has a third column.</p>
<h2>Detail pages</h2>
<p>Two service groups have their own page. The differences between page follower and page like packages are on <a href="/facebook-sayfa-begeni-satin-al">buy Facebook page likes</a>, and video and Reels packages on <a href="/facebook-izlenme-satin-al">buy Facebook views</a>. The time-based logic of live stream viewers is covered for all platforms on <a href="/canli-yayin-izleyici-satin-al">buy live stream viewers</a>.</p>
<h2>Post likes and emoji reactions</h2>
<p>Facebook does not limit liking to one button: a post can also receive a love, wow or angry reaction, and the icons of the most used reactions appear under the post. Besides plain likes, the catalogue has services where you choose a specific reaction type. Where to use them depends on the content: a love reaction looks natural on a campaign announcement, a wow reaction on surprising news. Mixing with plain likes, rather than taking one reaction type in bulk, looks more like the reaction spread of a real post.</p>
<p>The share service raises the post's share counter; using it in small amounts on selected posts is enough.</p>
<h2>Is a page still worth it?</h2>
<p>Organic page reach on Facebook has narrowed over the years; even so, for local businesses, events and certain age groups the platform is still one of the first places people look. Raising counters does not bring reach back: what drives distribution is the real engagement a post gets and, where needed, advertising. We cover this balance in detail in our <a href="/blog/facebook-sayfa-begeni-ve-erisim-artirma">Facebook page likes and reach article</a>.</p>
<h2>Reseller and API use</h2>
<p>Agencies managing clients' Facebook pages and resellers running their own panel can connect the same services to their systems via the API; endpoints and sample requests are documented on the <a href="/smm-panel-api">SMM panel API</a> page. How pricing is formed is on <a href="/ucuz-smm-panel">cheap SMM panel</a>, and the services on Meta's other platform on the <a href="/instagram-smm-panel">Instagram panel</a>.</p>
<h2>An honest note</h2>
<blockquote>Refill cover varies by service: some Facebook services are listed with a timed or lifetime refill statement, others without refill, and the applicable term is on the service card. "Real account" and "no drop" are the provider's statements. Facebook does not approve of artificial engagement in its rules and may delete engagement it deems invalid. These services do not promise an outcome on page reach, ad performance or sales.</blockquote>`,
    steps_tr: [
      'Büyütmek istediğiniz şeyi belirleyin: sayfa, profil, tek gönderi, video, canlı yayın ya da grup.',
      'Tablodan o hedefe ait servisi seçin; yenileme koşulu ve başlangıç süresi kartta yazar.',
      'Servisin istediği bağlantı türünü girin: sayfa servisine sayfa adresi, gönderi servisine gönderi adresi.',
      'Miktarı girip onaylayın; ilerlemeyi Siparişlerim sayfasından izleyin.'
    ],
    steps_en: [
      'Decide what you want to grow: page, profile, a single post, video, live stream or group.',
      'Pick the service for that goal from the table; the refill term and start time are on the card.',
      'Enter the link type the service asks for: a page address for a page service, a post address for a post service.',
      'Enter the quantity and confirm; follow progress on the My Orders page.'
    ],
    faq_tr: [
      { q: 'Sayfa beğenisi ile gönderi beğenisi aynı şey mi?', a: 'Hayır. Sayfa beğenisi ve takipçisi sayfanın kendisine, gönderi beğenisi tek bir paylaşıma eklenir. İkisi ayrı servistir ve farklı bağlantı ister.' },
      { q: 'Emoji tepkisi siparişinde tepki türünü seçebilir miyim?', a: 'Evet. Katalogda kalp, şaşkınlık ve öfke gibi tepki türleri ayrı servisler olarak listelenir; istediğiniz türü tablodan seçersiniz.' },
      { q: 'Kişisel profilime takipçi alabilir miyim?', a: 'Profilinizde takip seçeneği açıksa evet. Arkadaşlık isteği gönderilmez; yalnızca takipçi sayacı yükselir.' },
      { q: 'Kapalı gruba üye siparişi verilir mi?', a: 'Hayır. Grubun herkese açık olması gerekir; üyelik onayı açıksa teslimat gecikebilir ya da yapılamayabilir.' },
      { q: 'Facebook servislerinde garanti var mı?', a: 'Servise göre değişir. Bazıları süreli ya da ömür boyu yenileme beyanıyla, bazıları yenilemesiz listelenir. Geçerli koşul her hizmet kartında yazar.' },
      { q: 'Reklam verdiğim sayfaya takipçi almak reklamı etkiler mi?', a: 'Satın alınan takipçi reklam performansını artırmaz. Reklamın sonucu hedeflemeye, görsele ve gönderinin aldığı gerçek etkileşime bağlıdır.' }
    ],
    faq_en: [
      { q: 'Are page likes and post likes the same thing?', a: 'No. Page likes and followers are added to the page itself; post likes to a single post. They are separate services and need different links.' },
      { q: 'Can I choose the reaction type on an emoji reaction order?', a: 'Yes. Reaction types such as love, wow and angry are listed as separate services in the catalogue; you pick the one you want from the table.' },
      { q: 'Can I get followers for my personal profile?', a: 'Yes, if the follow option is on for your profile. No friend requests are sent; only the follower counter rises.' },
      { q: 'Can I order members for a private group?', a: 'No. The group must be public; if membership approval is on, delivery may be delayed or may not be possible.' },
      { q: 'Is there a guarantee on Facebook services?', a: 'It depends on the service. Some are listed with a timed or lifetime refill statement, others without refill. The applicable term is on each service card.' },
      { q: 'Does buying followers for a page I advertise affect the ads?', a: 'Purchased followers do not improve ad performance. Ad results depend on targeting, the creative and the real engagement the post gets.' }
    ],
    related_blog_slugs: ['facebook-sayfa-begeni-ve-erisim-artirma', 'smm-panel-nedir-nasil-kullanilir', 'sosyal-kanit-nedir-satisa-etkisi']
  })
];

module.exports = { PAGES };

if (require.main === module) {
  (async () => {
    const db = new sqlite3.Database(dbPath, DRY ? sqlite3.OPEN_READONLY : undefined);
    db.configure('busyTimeout', 5000);
    const get = (q, prm = []) => new Promise((r, j) => db.get(q, prm, (e, row) => e ? j(e) : r(row)));
    const all = (q, prm = []) => new Promise((r, j) => db.all(q, prm, (e, rows) => e ? j(e) : r(rows)));
    const run = (q, prm = []) => new Promise((r, j) => db.run(q, prm, function (e) { e ? j(e) : r(this); }));

    const tablo = await get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'landing_pages'");
    if (!tablo) { console.error('landing_pages tablosu yok: once sunucuyu yeni kodla baslat.'); process.exit(1); }

    // Yalnizca aktif servisi olan kategoriler: bos kategoriye sayfa baglanmaz.
    const kategoriler = await all(`SELECT c.id, c.name, c.name_tr FROM categories c
      WHERE EXISTS (SELECT 1 FROM services s WHERE s.category_id = c.id AND s.status = 1)`).catch(() => []);
    const adi = c => String(c.name_tr || c.name || '').replace(/\s+/g, ' ').trim();

    let eklenen = 0, atlanan = 0;
    for (const ham of PAGES) {
      if (await get('SELECT id FROM landing_pages WHERE slug = ?', [ham.slug])) {
        console.log('atlandi (zaten var): ' + ham.slug); atlanan++; continue;
      }
      const { kategori_kaliplari, ...sayfa } = ham;
      const ids = [];
      const eksik = [];
      for (const kalip of kategori_kaliplari) {
        const uyan = kategoriler.filter(c => kalip.test(adi(c)));
        if (!uyan.length) eksik.push(String(kalip));
        ids.push(...uyan.map(c => c.id));
      }
      if (eksik.length) {
        console.log('ATLANDI (kategori yok): ' + sayfa.slug + ' — aktif servisli kategori bulunamayan kalip: ' + eksik.join(', '));
        atlanan++; continue;
      }
      const tekil = [...new Set(ids)].slice(0, 30);
      const sonuc = normalizePagePayload({ ...sayfa, category_ids: tekil });
      if (sonuc.error) { console.error('HATA ' + sayfa.slug + ': ' + sonuc.error); atlanan++; continue; }
      const adlar = kategoriler.filter(c => tekil.includes(c.id)).map(adi).join(' | ');
      if (DRY) {
        console.log('[dry] olusturulacakti: ' + sonuc.fields.slug + ' (' + tekil.length + ' kategori: ' + adlar + ')');
        eklenen++; continue;
      }
      const cols = Object.keys(sonuc.fields);
      await run('INSERT INTO landing_pages (' + cols.join(', ') + ', updated_at) VALUES ('
        + cols.map(() => '?').join(', ') + ', CURRENT_TIMESTAMP)', cols.map(c => sonuc.fields[c]));
      console.log('olusturuldu (taslak, ' + tekil.length + ' kategori: ' + adlar + '): ' + sonuc.fields.slug);
      eklenen++;
    }
    db.close();
    console.log('Bitti: ' + eklenen + ' sayfa ' + (DRY ? 'olusturulacakti' : 'olusturuldu') + ', ' + atlanan + ' atlandi.');
    if (!DRY && eklenen) {
      console.log('Sayfalar TASLAK durumda. Yayina almak icin admin panel > Satis Sayfalari, ya da:');
      console.log('  node scripts/publish-landing-pages.js turk-begeni-satin-al');
      console.log('Yayindan SONRA gelen linkleri eklemek icin:');
      console.log('  node scripts/link-yeni-sayfalar-2026-10.js');
    }
  })().catch(err => { console.error(err); process.exit(1); });
}
