'use strict';

// 8 dijital urun / oyuncu satis sayfasi (11 Eyl 2026).
// Kaynak: morethanpanel katalog analizi + oneri listesi
// (morethanpanel-farkli-hizmetler.xlsx, Sayfa 2).
//
// KATEGORI ESLESTIRME: Bu sayfalarin kategorileri henuz panelde YOK;
// kullanici servisleri aksam ekleyecek. Bu yuzden category_ids sabit
// yazilmaz: her sayfa icin bir KATEGORI KALIBI (regex) tanimlidir ve
// script calisma aninda categories tablosunda AKTIF SERVISI OLAN eslesen
// kategorileri bulup baglar. Eslesen kategori yoksa sayfa ATLANIR ve
// nedeni yazilir — once servisleri ekle, sonra calistir.
//
// ICERIK KURALI (8 Eyl 2026 revizyonundan devam):
//   - Siralama/sonuc/kazanc GARANTISI yok; saglayici beyani ayrik yazilir.
//   - Dijital urunlerde teslimat/iade kosullari durustce soylenir;
//     paylasimli hesap ihtimali gizlenmez.
//   - Fiyat/limit sayfada tekrarlanmaz; canli servis tablosundan gelir.
//
// Kullanim (servisler eklendikten SONRA):
//   cd /var/www/smmjet && node scripts/seed-landing-pages-dijital.js
// Var olan slug'lara DOKUNMAZ; sayfalar TASLAK olusturulur.

const path = require('path');
const sqlite3 = require('sqlite3');
const { normalizePagePayload } = require('../utils/landingPages');

const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.join(__dirname, '..', 'database.sqlite');

// Sosyal medya sayfalarindaki ortak adimlar dijital urunlere uymaz;
// her sayfa kendi adimlarini tasir. SSS ortak blogu ise gecerli kalir.
const FAQ_COMMON_TR = [
  { q: 'Hangi ödeme yöntemleri var?', a: 'Kredi/banka kartı, kripto para ve banka havalesi ile bakiye yükleyebilirsiniz; bakiye onaylanır onaylanmaz hesabınıza yansır.' },
  { q: 'Sipariş tamamlanmazsa ne olur?', a: '"İptal Aktif" etiketli hizmetlerde teslim edilmeyen kısım bakiyenize iade edilir. Diğer hizmetlerde destek ekibi sağlayıcıyla birlikte takip eder; dijital ürünlerde iade koşulları İade Politikası sayfasında yazar.' }
];
const FAQ_COMMON_EN = [
  { q: 'Which payment methods are available?', a: 'Credit/debit card, cryptocurrency and bank transfer; the balance is credited as soon as the payment is confirmed.' },
  { q: 'What if the order does not complete?', a: 'On services tagged "Cancel Enabled" the undelivered part is refunded to your balance. For other services support follows up with the provider; refund terms for digital goods are on the Refund Policy page.' }
];

const page = (o) => ({
  status: 'draft', cta_text_tr: 'Ücretsiz Hesap Oluştur', cta_text_en: 'Create a Free Account',
  ...o,
  faq_tr: [...(o.faq_tr || []), ...FAQ_COMMON_TR],
  faq_en: [...(o.faq_en || []), ...FAQ_COMMON_EN]
});

const PAGES = [
  // ---------------------------------------------------------------- 1
  page({
    slug: 'discord-sunucu-boost-satin-al', platform_key: 'social-media', sort_order: 60,
    kategori_kalibi: /discord/i,
    title_tr: 'Discord Sunucu Boost Satın Al', title_en: 'Buy Discord Server Boosts',
    subtitle_tr: 'Sunucunuzu 1., 2. ve 3. seviyeye taşıyan boost paketleri; yanında Nitro seçenekleri ve topluluğunuzu kalabalıklaştıran üye paketleri. Bakiyeyle dakikalar içinde sipariş.',
    subtitle_en: 'Boost packages that carry your server to levels 1-3, plus Nitro options and member packages that fill out your community. Order in minutes with your balance.',
    seo_title_tr: 'Discord Sunucu Boost Satın Al – Seviye Atlat, Nitro ve Üye',
    seo_title_en: 'Buy Discord Server Boosts – Level Up, Nitro and Members',
    seo_description_tr: 'Discord sunucu boost satın al: sunucunu 1-3. seviyeye taşı, emoji ve ses kalitesi avantajlarını aç. Nitro ve üye paketleriyle topluluğunu büyüt.',
    seo_description_en: 'Buy Discord server boosts: carry your server to levels 1-3 and unlock emoji and audio perks. Grow your community with Nitro and member packages.',
    steps_tr: ['Ücretsiz hesap oluşturun ve kart, kripto ya da havale ile bakiye yükleyin.', 'Tablodan boost, Nitro veya üye paketini seçin; koşullar kartta yazar.', 'Sunucunuzun davet bağlantısını girin (discord.gg/... biçimi).', 'Sipariş işleme alınır; ilerlemeyi Siparişlerim sayfasından izleyin.'],
    steps_en: ['Create a free account and top up with card, crypto or bank transfer.', 'Pick a boost, Nitro or member package from the table; terms are on the card.', 'Enter your server invite link (discord.gg/... format).', 'The order is processed; track progress on the My Orders page.'],
    content_tr: [
      '<h2>Sunucu boost ne kazandırır?</h2>',
      '<p>Discord, bir sunucuya yapılan boost sayısına göre seviye atlatır: 1. seviyede daha fazla emoji alanı ve daha iyi ses kalitesi, 2. seviyede sunucu banner\'ı ve 50 MB yükleme sınırı, 3. seviyede özel davet bağlantısı (vanity URL) ve en yüksek ses/yayın kalitesi açılır. Boost sayısı sunucu adının yanında herkese görünür ve topluluğun ciddiyetine dair ilk izlenimi verir. Discord sunucu boost satın al paketleri bu seviyeleri açar; üye etkileşimi veya topluluk büyümesi konusunda sonuç taahhüt etmez.</p>',
      '<h2>Paket seçenekleri</h2>',
      '<ul>',
      '<li><strong>Sunucu boost paketleri:</strong> Seviye hedefi için gereken boost adedi tabloda seçilir; süre ve koşullar hizmet kartında yazar.</li>',
      '<li><strong>Nitro seçenekleri:</strong> Katalogda listelenen Nitro paketleri; teslimat biçimi ve süresi kartta belirtilir.</li>',
      '<li><strong>Üye paketleri:</strong> Sunucunuzun üye sayısını yükseltir. Sağlayıcı farklı kayıt yıllarına ait hesap seçenekleri de listeler; eski tarihli hesaplar kartta ayrıca belirtilir.</li>',
      '</ul>',
      '<h2>Dürüst uyarı</h2>',
      '<blockquote>Boost süresi ve yenileme koşulu pakete göre değişir; hizmet kartındaki açıklama esastır. Üye paketleri sayacı yükseltir; satın alınan üyeler sohbete katılan gerçek topluluk üyeleri değildir. Aktif topluluk; düzenli etkinlik, iyi kanal düzeni ve moderasyonla kurulur.</blockquote>',
      '<h2>Doğru kullanım</h2>',
      '<p>Davet bağlantınızın süresiz ve katılıma açık olması gerekir (tek kullanımlık bağlantılar teslimatı bozar). Sipariş öncesi sunucunuzda katılım doğrulama seviyesini düşürmeniz teslimatı hızlandırır; teslimat sonrası tekrar yükseltebilirsiniz.</p>'
    ].join('\n'),
    content_en: [
      '<h2>What do server boosts unlock?</h2>',
      '<p>Discord levels a server up by its boost count: level 1 adds more emoji slots and better audio, level 2 adds a server banner and a 50 MB upload limit, and level 3 unlocks a vanity invite URL and the highest audio/stream quality. The boost count is visible to everyone next to the server name and shapes the first impression of how serious a community is. Buy-server-boost packages unlock those levels; they make no commitment about member engagement or community growth.</p>',
      '<h2>Package options</h2>',
      '<ul>',
      '<li><strong>Server boost packages:</strong> pick the boost count your target level needs from the table; duration and terms are on the service card.</li>',
      '<li><strong>Nitro options:</strong> Nitro packages listed in the catalogue; delivery method and duration are stated on the card.</li>',
      '<li><strong>Member packages:</strong> raise your server\'s member count. The provider also lists account options from different registration years; aged accounts are marked on the card.</li>',
      '</ul>',
      '<h2>An honest note</h2>',
      '<blockquote>Boost duration and renewal terms vary by package; the service card is definitive. Member packages raise a counter; purchased members are not real community members who will chat. An active community is built with regular events, good channel structure and moderation.</blockquote>',
      '<h2>Using it right</h2>',
      '<p>Your invite link must be permanent and open to joining (single-use links break delivery). Lowering the verification level before ordering speeds up delivery; you can raise it again afterwards.</p>'
    ].join('\n'),
    faq_tr: [
      { q: 'Boost ne kadar süre aktif kalır?', a: 'Süre pakete göre değişir (1 ay, 3 ay gibi) ve hizmet kartında açıkça yazar. Süre bitiminde seviyenin korunması için yeni sipariş verilir.' },
      { q: 'Seviye 3 için kaç boost gerekir?', a: 'Discord\'un güncel eşiği 14 boost\'tur (1. seviye 2, 2. seviye 7). Eşikleri Discord zaman zaman güncelleyebilir; tablodaki paket açıklamaları buna göre düzenlenir.' },
      { q: 'Sunucuma zarar gelir mi, yetki vermem gerekir mi?', a: 'Hayır. Yalnızca davet bağlantısı istenir; yönetici yetkisi, bot ekleme veya şifre talep edilmez.' },
      { q: 'Üyeler sohbete yazar mı?', a: 'Hayır. Üye paketleri üye sayacını yükseltir; sohbet aktivitesi taahhüt edilmez. Aktif sohbet için topluluk çalışması gerekir.' }
    ],
    faq_en: [
      { q: 'How long do boosts stay active?', a: 'Duration varies by package (e.g. 1 month, 3 months) and is stated on the card. Re-order at the end of the period to keep the level.' },
      { q: 'How many boosts does level 3 need?', a: 'Discord\'s current threshold is 14 boosts (level 1 needs 2, level 2 needs 7). Discord may update thresholds; package descriptions follow the current values.' },
      { q: 'Any risk to my server, do I grant permissions?', a: 'No. Only the invite link is required; no admin rights, bot invites or passwords are requested.' },
      { q: 'Will the members chat?', a: 'No. Member packages raise the member counter; chat activity is not committed. An active chat takes community work.' }
    ],
    related_blog_slugs: ['sosyal-medya-buyume-rehberi', 'smm-panel-nedir-nasil-kullanilir', 'sosyal-medya-hesap-guvenligi-rehberi']
  }),

  // ---------------------------------------------------------------- 2
  page({
    slug: 'twitch-takipci-satin-al', platform_key: 'twitch', sort_order: 61,
    kategori_kalibi: /twitch/i,
    title_tr: 'Twitch Takipçi Satın Al', title_en: 'Buy Twitch Followers',
    subtitle_tr: '30 gün yenilemeli takipçi paketleri, eşzamanlı izleyici seçenekleri ve yayında akan otomatik sohbet. Affiliate yolculuğuna sosyal kanıt desteği.',
    subtitle_en: 'Follower packages with 30-day refill, concurrent viewer options and auto-chat that flows during your stream. Social proof support on the road to Affiliate.',
    seo_title_tr: 'Twitch Takipçi Satın Al – Yenilemeli Takipçi ve Canlı Sohbet',
    seo_title_en: 'Buy Twitch Followers – Refill Options and Live Auto-Chat',
    seo_description_tr: 'Twitch takipçi satın al: 30 gün yenilemeli paketler, eşzamanlı izleyici ve yayında akan otomatik sohbet seçenekleri. Şifresiz, sadece kanal adıyla sipariş.',
    seo_description_en: 'Buy Twitch followers: 30-day refill packages, concurrent viewers and auto-chat flowing during your stream. No password; order with your channel name.',
    steps_tr: ['Ücretsiz hesap oluşturun ve bakiye yükleyin.', 'Takipçi, izleyici veya sohbet paketini tablodan seçin.', 'Kanal adresinizi girin (twitch.tv/kanaladi); şifre istenmez.', 'Sipariş saniyeler içinde başlar; canlı paketlerde yayının açık olması gerekir.'],
    steps_en: ['Create a free account and top up your balance.', 'Pick a follower, viewer or chat package from the table.', 'Enter your channel URL (twitch.tv/name); no password needed.', 'The order starts within seconds; live packages require the stream to be online.'],
    content_tr: [
      '<h2>Twitch\'te takipçi sayısı neyi etkiler?</h2>',
      '<p>Takipçi sayısı kanal sayfanızda herkese açık görünür ve yeni bir izleyicinin "bu kanal ciddi mi" sorusuna baktığı ilk yerdir. Twitch Affiliate başvurusunun ölçütlerinden biri de takipçi sayısıdır; güncel eşikler için Twitch\'in resmî sayfası esastır. Twitch takipçi satın al paketleri sayacı yükseltir; Affiliate/Partner kabulü, izlenme veya gelir konusunda sonuç taahhüt etmez.</p>',
      '<h2>Paket seçenekleri</h2>',
      '<ul>',
      '<li><strong>Takipçi:</strong> Ekonomik (yenilemesiz) ve 30 gün yenilemeli seçenekler; günlük hız ve limitler kartta yazar.</li>',
      '<li><strong>Eşzamanlı izleyici:</strong> Yayın süresince izleyici sayısını yükselten, farklı kalıcılık sürelerine sahip paketler. Sağlayıcı bazı paketlerde izleyicilerin kullanıcı listesinde göründüğünü belirtir.</li>',
      '<li><strong>Otomatik sohbet:</strong> Yayınınızda seçilen süre boyunca (1 saat - 7 gün) sohbete mesaj akışı sağlar; emoji veya özel mesaj listesi seçenekleri vardır. Kalabalık ama sessiz yayın görüntüsünü tamamlayan, panellerde nadir bulunan bir hizmettir.</li>',
      '</ul>',
      '<h2>Dürüst uyarı</h2>',
      '<blockquote>Garanti koşulu pakete göre değişir: yenilemeli takipçi paketleri 30 gün etiketi taşır, ekonomik paketlerde telafi yoktur. Twitch etkileşim sayılarını zaman zaman yeniden doğrular; garanti kapsamı dışındaki düşüşlerde telafi yapılmaz. İzleyici ve sohbet paketleri görünümü destekler; Twitch\'in önerilenlerinde yükselme garantisi yoktur.</blockquote>',
      '<h2>Doğru kullanım</h2>',
      '<p>Takipçi siparişinde kanalın herkese açık olması yeterlidir. İzleyici ve sohbet paketlerinde <strong>yayının açık olması zorunludur</strong>; sipariş yayın başladıktan sonra verilir. Sohbet paketinde özel mesaj listesi seçtiyseniz mesajları yayın diline uygun hazırlayın. Kalıcı topluluk; yayın düzeni, raid kültürü ve sosyal medya çalışmasıyla kurulur — aşağıdaki rehberde ayrıntısı var.</p>'
    ].join('\n'),
    content_en: [
      '<h2>What does the follower count affect on Twitch?</h2>',
      '<p>The follower count is publicly visible on your channel page and is the first place a new viewer checks when judging whether a channel is serious. It is also one of the Twitch Affiliate criteria; Twitch\'s official page is definitive for current thresholds. Buy-Twitch-followers packages raise the counter; they make no commitment about Affiliate/Partner acceptance, views or revenue.</p>',
      '<h2>Package options</h2>',
      '<ul>',
      '<li><strong>Followers:</strong> budget (no refill) and 30-day refill options; daily speed and limits are on the card.</li>',
      '<li><strong>Concurrent viewers:</strong> packages that raise the viewer count during the stream with different retention periods. The provider states that on some packages viewers appear in the user list.</li>',
      '<li><strong>Auto-chat:</strong> a message flow in your chat for the chosen period (1 hour to 7 days), with emoji or custom message list options. It completes the "busy but silent" stream picture and is rarely found on panels.</li>',
      '</ul>',
      '<h2>An honest note</h2>',
      '<blockquote>Guarantee terms vary by package: refill followers carry a 30-day tag, budget packages have no compensation. Twitch revalidates engagement counts from time to time; drops outside guarantee cover are not compensated. Viewer and chat packages support the look of the stream; there is no guarantee of rising in Twitch recommendations.</blockquote>',
      '<h2>Using it right</h2>',
      '<p>For follower orders a public channel is enough. Viewer and chat packages <strong>require the stream to be live</strong>; order after going live. If you choose a custom message list for chat, prepare messages in your stream\'s language. A lasting community is built with a streaming schedule, raid culture and social media work — details in the guide below.</p>'
    ].join('\n'),
    faq_tr: [
      { q: 'Takipçiler Affiliate başvurusunda sayılır mı?', a: 'Takipçi sayacı yükselir; ancak Twitch başvuruları kendi ölçütleriyle değerlendirir ve güncel eşikler değişebilir. Bu paketler Affiliate/Partner kabulünü garanti etmez.' },
      { q: 'Otomatik sohbet mesajlarını ben belirleyebilir miyim?', a: 'Evet; "Custom" etiketli paketlerde kendi mesaj listenizi iletirsiniz, "Emoji" paketlerinde hazır akış gelir. Süre seçenekleri kartta yazar.' },
      { q: 'İzleyici siparişi için yayın açık olmalı mı?', a: 'Evet. Eşzamanlı izleyici ve sohbet hizmetleri yalnızca yayın açıkken çalışır; yayına başladıktan sonra sipariş verin.' },
      { q: 'Takipçiler düşer mi?', a: 'Yenilemeli paketlerde 30 gün içindeki düşüşler kart koşullarına göre telafi edilir; ekonomik paketlerde telafi yoktur. Koşullar hizmet kartında açıkça yazar.' }
    ],
    faq_en: [
      { q: 'Do the followers count towards Affiliate?', a: 'The follower counter rises; however Twitch evaluates applications by its own criteria and thresholds may change. These packages do not guarantee Affiliate/Partner acceptance.' },
      { q: 'Can I set the auto-chat messages?', a: 'Yes; on "Custom" packages you submit your own message list, "Emoji" packages use a ready-made flow. Duration options are on the card.' },
      { q: 'Must the stream be live for viewer orders?', a: 'Yes. Concurrent viewer and chat services only work while the stream is live; order after going live.' },
      { q: 'Will followers drop?', a: 'On refill packages drops within 30 days are compensated per the card terms; budget packages carry no compensation. Terms are stated on the service card.' }
    ],
    related_blog_slugs: ['twitch-takipci-ve-izleyici-artirma-rehberi', 'sosyal-medya-buyume-rehberi', 'organik-buyume-vs-satin-alma-karsilastirmasi']
  }),

  // ---------------------------------------------------------------- 3
  page({
    slug: 'pubg-mobile-uc-satin-al', platform_key: 'social-media', sort_order: 62,
    kategori_kalibi: /pubg/i,
    title_tr: 'PUBG Mobile UC Satın Al', title_en: 'Buy PUBG Mobile UC',
    subtitle_tr: 'Oyuncu ID ile hesabınıza yüklenen UC paketleri: şifre istenmez, giriş yapılmaz. Bakiyeyle dakikalar içinde sipariş, uygun paket seçenekleri.',
    subtitle_en: 'UC packages loaded to your account via player ID: no password, no login. Order in minutes with your balance across budget-friendly options.',
    seo_title_tr: 'PUBG Mobile UC Satın Al – ID ile Yükleme, Şifresiz',
    seo_title_en: 'Buy PUBG Mobile UC – Loaded by Player ID, No Password',
    seo_description_tr: 'PUBG Mobile UC satın al: oyuncu ID\'nizle hesabınıza yüklenir, şifre istenmez. Kart, kripto veya havaleyle bakiye yükleyin, UC paketinizi seçin.',
    seo_description_en: 'Buy PUBG Mobile UC: loaded to your account with your player ID, no password required. Top up by card, crypto or bank transfer and pick your pack.',
    steps_tr: ['Ücretsiz hesap oluşturun ve bakiye yükleyin.', 'Tablodan UC paketinizi seçin; paket içerikleri kartta yazar.', 'Oyuncu ID\'nizi girin (profilinizde yazan sayısal kimlik). Şifre istenmez.', 'UC, sağlayıcının belirttiği süre içinde hesabınıza yüklenir; durumu Siparişlerim\'den izleyin.'],
    steps_en: ['Create a free account and top up your balance.', 'Pick your UC pack from the table; pack contents are on the card.', 'Enter your player ID (the numeric ID on your profile). No password required.', 'UC is loaded within the period stated by the provider; track it on My Orders.'],
    content_tr: [
      '<h2>UC nedir, nasıl yüklenir?</h2>',
      '<p>UC (Unknown Cash), PUBG Mobile\'ın oyun içi para birimidir: Royale Pass, kostüm, silah kaplaması ve sandık açılışları UC ile yapılır. Bu sayfadaki paketlerde yükleme <strong>oyuncu ID\'si ile</strong> yapılır — hesabınıza giriş yapılmaz, şifre istenmez. ID\'nizi oyunda profilinize dokunarak görebilirsiniz.</p>',
      '<h2>Paket seçenekleri</h2>',
      '<p>Katalogda küçük günlük paketlerden yüksek adetli paketlere kadar farklı UC seçenekleri listelenir; sağlayıcı paketlerin dünya genelindeki hesaplara yüklenebildiğini belirtir. Güncel paket listesi ve fiyatlar aşağıdaki tablodadır; sipariş makinesiyle saniyeler içinde işlem başlatılır.</p>',
      '<h2>Dürüst uyarı</h2>',
      '<blockquote>Teslimat süresi sağlayıcının işleme hızına bağlıdır ve kartta belirtilir; anlık oyun içi mağaza alışverişi değildir. Yanlış girilen oyuncu ID\'sinden doğan yüklemeler geri alınamaz — sipariş öncesi ID\'nizi iki kez kontrol edin. Royale Pass dönemi sonu gibi yoğun günlerde işlem süresi uzayabilir.</blockquote>',
      '<h2>Neden panel üzerinden?</h2>',
      '<p>Bakiye altyapısı sayesinde kart, kripto veya havale ile tek bakiyeden hem sosyal medya hizmetleri hem UC siparişi verebilirsiniz; her siparişin durumu paneldeki geçmişinizde kayıtlı kalır ve destek ekibine tek yerden ulaşırsınız.</p>'
    ].join('\n'),
    content_en: [
      '<h2>What is UC and how is it loaded?</h2>',
      '<p>UC (Unknown Cash) is PUBG Mobile\'s in-game currency: the Royale Pass, outfits, weapon skins and crate openings all run on UC. Packs on this page are loaded <strong>by player ID</strong> — nobody logs into your account and no password is requested. You can see your ID by tapping your in-game profile.</p>',
      '<h2>Pack options</h2>',
      '<p>The catalogue lists UC options from small daily packs to high-volume packs; the provider states packs can be loaded to accounts worldwide. The current list and prices are in the table below; the order machine starts the process within seconds.</p>',
      '<h2>An honest note</h2>',
      '<blockquote>Delivery time depends on the provider\'s processing speed and is stated on the card; this is not an instant in-game store purchase. Loads made to a wrongly entered player ID cannot be reversed — double-check your ID before ordering. Processing can slow on busy days such as Royale Pass season endings.</blockquote>',
      '<h2>Why through the panel?</h2>',
      '<p>Thanks to the balance system you can order both social media services and UC from a single balance topped up by card, crypto or bank transfer; every order stays recorded in your history and support is one place away.</p>'
    ].join('\n'),
    faq_tr: [
      { q: 'Oyuncu ID\'mi nereden bulurum?', a: 'Oyunu açın, sağ üstten profilinize dokunun; adınızın altındaki sayısal kimlik oyuncu ID\'nizdir. Siparişte bu numarayı girin.' },
      { q: 'UC ne kadar sürede yüklenir?', a: 'Süre pakete ve sağlayıcının yoğunluğuna göre değişir; kartta belirtilir. Yükleme tamamlanınca oyun içi UC bakiyeniz güncellenir.' },
      { q: 'Hesabım risk altında mı, şifre gerekir mi?', a: 'Şifre asla istenmez ve hesabınıza giriş yapılmaz; yükleme ID üzerinden resmî yükleme kanallarıyla yapılır. Yine de her dijital üründe olduğu gibi hizmet koşulları kartta yazar.' },
      { q: 'Yanlış ID girersem ne olur?', a: 'Yanlış ID\'ye yapılan yükleme geri alınamaz ve iade edilemez. Sipariş vermeden önce ID\'nizi mutlaka iki kez kontrol edin.' }
    ],
    faq_en: [
      { q: 'Where do I find my player ID?', a: 'Open the game, tap your profile at the top; the numeric ID under your name is your player ID. Enter that number with your order.' },
      { q: 'How fast is UC loaded?', a: 'Time varies by pack and provider load; it is stated on the card. Your in-game UC balance updates when the load completes.' },
      { q: 'Is my account at risk, is a password needed?', a: 'A password is never requested and nobody logs into your account; loading is done via official top-up channels using the ID. As with any digital good, service terms are on the card.' },
      { q: 'What if I enter the wrong ID?', a: 'A load made to a wrong ID cannot be reversed or refunded. Double-check your ID before ordering.' }
    ],
    related_blog_slugs: ['smm-panel-odeme-guvenligi-rehberi', 'smm-panel-nedir-nasil-kullanilir']
  }),

  // ---------------------------------------------------------------- 4
  page({
    slug: 'robux-satin-al', platform_key: 'social-media', sort_order: 63,
    kategori_kalibi: /robux|roblox/i,
    title_tr: 'Robux Satın Al', title_en: 'Buy Robux',
    subtitle_tr: 'Roblox hesabınız için Robux paketleri: uygun fiyat, bakiyeyle hızlı sipariş. Teslimat yöntemi ve süresi her paketin kartında açıkça yazar.',
    subtitle_en: 'Robux packages for your Roblox account: fair prices and fast ordering with your balance. Delivery method and time are stated clearly on each card.',
    seo_title_tr: 'Robux Satın Al – Uygun Fiyatlı Roblox Paketleri',
    seo_title_en: 'Buy Robux – Fairly Priced Roblox Packages',
    seo_description_tr: 'Robux satın al: Roblox hesabına uygun fiyatlı paketler. Kart, kripto veya havaleyle bakiye yükle, paketini seç; teslimat koşulları kartta yazar.',
    seo_description_en: 'Buy Robux: fairly priced packages for your Roblox account. Top up by card, crypto or bank transfer and pick a pack; delivery terms are on the card.',
    steps_tr: ['Ücretsiz hesap oluşturun ve bakiye yükleyin.', 'Tablodan Robux paketinizi seçin; teslimat yöntemi kartta yazar.', 'Kartta istenen bilgiyi girin (kullanıcı adı veya paket bağlantısı).', 'Teslimat sağlayıcının belirttiği süre içinde yapılır; durumu Siparişlerim\'den izleyin.'],
    steps_en: ['Create a free account and top up your balance.', 'Pick your Robux pack from the table; the delivery method is on the card.', 'Enter the info the card asks for (username or item link).', 'Delivery happens within the provider\'s stated period; track it on My Orders.'],
    content_tr: [
      '<h2>Robux ne işe yarar?</h2>',
      '<p>Robux, Roblox\'un evrensel para birimidir: avatar kıyafetleri, oyun geçişleri (game pass), özel eşyalar ve birçok deneyimin içi satın alımları Robux ile yapılır. Bu sayfadaki paketler, resmî mağaza fiyatlarına alternatif arayan oyuncular için uygun fiyatlı seçenekler sunar.</p>',
      '<h2>Teslimat nasıl çalışır?</h2>',
      '<p>Robux teslimatının yöntemi pakete göre değişir ve <strong>hizmet kartındaki açıklama esastır</strong>: bazı paketlerde kullanıcı adıyla hediye yöntemi, bazılarında oyun geçişi (game pass) üzerinden teslim kullanılır. Game pass yönteminde Roblox, tutarın bir kesintisini alır; kartta net teslim edilen miktar belirtilir. Şifreniz hiçbir yöntemde istenmez.</p>',
      '<h2>Dürüst uyarı</h2>',
      '<blockquote>Teslimat süresi anlık değildir; sağlayıcının kartta belirttiği süre geçerlidir (game pass yönteminde Roblox\'un bekleme süresi de eklenir). 13 yaş altı hesaplarda bazı teslim yöntemleri Roblox kısıtlarına takılabilir; paket açıklamasını okuyarak hesabınıza uygun yöntemi seçin.</blockquote>',
      '<h2>Güvenlik</h2>',
      '<p>Hesabınıza giriş yapılmaz ve şifre istenmez. Roblox hesabınızın güvenliği için iki adımlı doğrulamayı açık tutmanızı ve şifrenizi hiçbir siteyle paylaşmamanızı öneririz — panel dahil, kimse şifrenizi sormamalıdır.</p>'
    ].join('\n'),
    content_en: [
      '<h2>What is Robux for?</h2>',
      '<p>Robux is Roblox\'s universal currency: avatar items, game passes, exclusive gear and in-experience purchases all run on Robux. The packs on this page offer fair-priced options for players looking for an alternative to official store prices.</p>',
      '<h2>How does delivery work?</h2>',
      '<p>The delivery method varies by pack and <strong>the service card is definitive</strong>: some packs use username gifting, others deliver via a game pass. With the game pass method Roblox takes its cut of the amount; the card states the net delivered amount. Your password is never requested with any method.</p>',
      '<h2>An honest note</h2>',
      '<blockquote>Delivery is not instant; the period stated on the card applies (the game pass method also adds Roblox\'s own holding time). Some delivery methods can hit Roblox restrictions on under-13 accounts; read the pack description and pick the method that fits your account.</blockquote>',
      '<h2>Security</h2>',
      '<p>Nobody logs into your account and no password is requested. Keep two-step verification on and never share your password with any site — including this panel; nobody should ever ask for it.</p>'
    ].join('\n'),
    faq_tr: [
      { q: 'Şifremi vermem gerekiyor mu?', a: 'Hayır, hiçbir pakette şifre istenmez. Teslimat kullanıcı adı veya game pass yöntemiyle yapılır; yöntem kartta yazar.' },
      { q: 'Game pass yöntemi nedir?', a: 'Roblox\'ta oluşturduğunuz bir oyun geçişinin satın alınmasıyla Robux\'un hesabınıza aktarıldığı resmî mekanizmadır. Roblox kesintisi ve bekleme süresi bu yönteme dahildir; kartta net miktar belirtilir.' },
      { q: 'Robux ne zaman hesabıma geçer?', a: 'Pakete göre değişir; hediye yönteminde sağlayıcının işleme süresi, game pass yönteminde ek olarak Roblox\'un bekleme süresi geçerlidir. Süreler kartta yazar.' },
      { q: 'Resmî mağazadan farkı ne?', a: 'Aynı Robux\'tur; fark fiyat ve teslimat yöntemindedir. Resmî mağaza anında teslim eder, buradaki paketler uygun fiyat karşılığında kartta yazan teslim süresiyle çalışır.' }
    ],
    faq_en: [
      { q: 'Do I need to give my password?', a: 'No, no pack ever asks for a password. Delivery uses username gifting or a game pass; the method is on the card.' },
      { q: 'What is the game pass method?', a: 'It is the official mechanism where a game pass you create gets purchased and the Robux lands in your account. Roblox\'s cut and holding time apply to this method; the card states the net amount.' },
      { q: 'When does the Robux arrive?', a: 'It varies by pack; the gifting method takes the provider\'s processing time, the game pass method adds Roblox\'s own holding period. Times are on the card.' },
      { q: 'How is this different from the official store?', a: 'It is the same Robux; the difference is price and delivery method. The official store delivers instantly, these packs trade a delivery period (stated on the card) for a lower price.' }
    ],
    related_blog_slugs: ['smm-panel-odeme-guvenligi-rehberi', 'sosyal-medya-hesap-guvenligi-rehberi']
  }),

  // ---------------------------------------------------------------- 5
  page({
    slug: 'canva-pro-satin-al', platform_key: 'social-media', sort_order: 64,
    kategori_kalibi: /canva|envato|freepik|capcut|flaticon|motion array|istock|tasar[ıi]m|design/i,
    title_tr: 'Canva Pro Satın Al', title_en: 'Buy Canva Pro',
    subtitle_tr: 'Canva Pro, Envato Elements, Freepik ve CapCut Pro üyelikleri tek sayfada: sosyal medya içeriği üretenler için uygun fiyatlı tasarım araçları.',
    subtitle_en: 'Canva Pro, Envato Elements, Freepik and CapCut Pro memberships on one page: fairly priced design tools for social content creators.',
    seo_title_tr: 'Canva Pro Satın Al – Envato, Freepik ve CapCut Üyelikleri',
    seo_title_en: 'Buy Canva Pro – Envato, Freepik and CapCut Memberships',
    seo_description_tr: 'Canva Pro satın al: uygun fiyatlı Canva, Envato Elements, Freepik ve CapCut üyelikleri. İçerik üreticileri ve işletmeler için tasarım araçları tek sayfada.',
    seo_description_en: 'Buy Canva Pro: fairly priced Canva, Envato Elements, Freepik and CapCut memberships. Design tools for creators and businesses on a single page.',
    steps_tr: ['Ücretsiz hesap oluşturun ve bakiye yükleyin.', 'Tablodan aracı ve üyelik süresini seçin; koşullar kartta yazar.', 'Kartta istenen bilgiyi girin (örn. üyeliğin tanımlanacağı e-posta).', 'Teslimat bilgileri sağlayıcının belirttiği süre içinde iletilir; Siparişlerim\'den izleyin.'],
    steps_en: ['Create a free account and top up your balance.', 'Pick the tool and membership period from the table; terms are on the card.', 'Enter the info the card asks for (e.g. the email the membership will be assigned to).', 'Delivery details arrive within the provider\'s stated period; track it on My Orders.'],
    content_tr: [
      '<h2>Kimler için?</h2>',
      '<p>Sosyal medya yöneticileri, içerik üreticileri ve küçük işletmeler için tasarım araçları aylık ciddi bir kalemdir. Bu sayfa; Canva Pro, Envato Elements, Freepik, Flaticon ve CapCut gibi araçların üyeliklerini uygun fiyatla tek yerde toplar — panelde sosyal medya hizmeti alan bir kullanıcı için doğal tamamlayıcıdır.</p>',
      '<h2>Seçenekler</h2>',
      '<ul>',
      '<li><strong>Canva Pro:</strong> Premium şablonlar, arka plan silme ve marka kiti özellikleriyle tasarımın standart aracı.</li>',
      '<li><strong>Envato Elements / Freepik / Flaticon / Motion Array:</strong> Şablon, vektör, ikon ve video varlık kütüphaneleri; sağlayıcı paketlerde günlük indirme limitleri belirtir.</li>',
      '<li><strong>CapCut Pro:</strong> Kısa video kurgusunun (Reels/TikTok) premium özellikleri.</li>',
      '</ul>',
      '<h2>Dürüst uyarı</h2>',
      '<blockquote>Üyelik tipi pakete göre değişir: bazı paketler kişisel hesabınıza tanımlanır, bazıları paylaşımlı veya öğrenci/ekip havuzundan hesap teslimi şeklindedir; hangisi olduğu hizmet kartında yazar. Paylaşımlı hesaplarda ayarları değiştirmeme kuralına uyulmalıdır. Günlük indirme limiti olan paketlerde limit kartta belirtilir.</blockquote>',
      '<h2>Kullanım önerisi</h2>',
      '<p>Üyelik süresi bitmeden yenileme siparişi vererek kesintisiz devam edebilirsiniz. Ticari projelerde varlık lisanslarının kullanım koşulları ilgili platformun kurallarına tabidir; kritik projelerde lisans şartlarını platformdan doğrulayın.</p>'
    ].join('\n'),
    content_en: [
      '<h2>Who is this for?</h2>',
      '<p>For social media managers, creators and small businesses, design tools are a serious monthly cost line. This page gathers memberships for Canva Pro, Envato Elements, Freepik, Flaticon and CapCut at fair prices — a natural complement for anyone already ordering social media services on the panel.</p>',
      '<h2>Options</h2>',
      '<ul>',
      '<li><strong>Canva Pro:</strong> the standard design tool with premium templates, background remover and brand kit.</li>',
      '<li><strong>Envato Elements / Freepik / Flaticon / Motion Array:</strong> template, vector, icon and video asset libraries; the provider states daily download limits on packs.</li>',
      '<li><strong>CapCut Pro:</strong> premium features for short-form video editing (Reels/TikTok).</li>',
      '</ul>',
      '<h2>An honest note</h2>',
      '<blockquote>Membership type varies by pack: some are assigned to your personal account, others deliver a shared or student/team-pool account; which one applies is written on the service card. On shared accounts, the do-not-change-settings rule must be respected. Daily download limits, where they exist, are stated on the card.</blockquote>',
      '<h2>Usage tip</h2>',
      '<p>Order a renewal before the period ends to continue without interruption. For commercial projects, asset licence terms are governed by each platform\'s rules; verify licence terms on the platform for critical work.</p>'
    ].join('\n'),
    faq_tr: [
      { q: 'Üyelik kendi hesabıma mı tanımlanır?', a: 'Pakete göre değişir: bazı paketler sizin e-postanıza tanımlanır, bazıları hazır hesap teslimidir. Hangi yöntem olduğu hizmet kartında açıkça yazar.' },
      { q: 'İndirme limiti var mı?', a: 'Varlık kütüphanelerinde (Envato, Freepik vb.) sağlayıcı günlük indirme limitleri belirtir; limit kartta yazar. Canva ve CapCut üyeliklerinde indirme limiti mantığı yoktur.' },
      { q: 'Süre bitince ne olur?', a: 'Üyelik kartta yazan süre kadar geçerlidir; süre sonunda yenileme siparişi verilir. Otomatik yenileme yoktur, kontrol sizdedir.' },
      { q: 'Ticari projede kullanabilir miyim?', a: 'Varlıkların ticari kullanımı ilgili platformun lisans koşullarına tabidir. Kritik ticari işlerde lisans şartını platformdan doğrulamanızı öneririz.' }
    ],
    faq_en: [
      { q: 'Is the membership assigned to my own account?', a: 'It varies by pack: some are assigned to your email, others deliver a ready account. The method is stated clearly on the service card.' },
      { q: 'Are there download limits?', a: 'On asset libraries (Envato, Freepik etc.) the provider states daily download limits on the card. Canva and CapCut memberships have no download-limit logic.' },
      { q: 'What happens when the period ends?', a: 'The membership lasts for the period on the card; order a renewal at the end. There is no auto-renewal — you stay in control.' },
      { q: 'Can I use assets commercially?', a: 'Commercial use is governed by each platform\'s licence terms. For critical commercial work we recommend verifying the licence on the platform.' }
    ],
    related_blog_slugs: ['sosyal-medya-icerik-takvimi-olusturma', 'instagram-reels-vs-tiktok-hangisi', 'sosyal-medya-buyume-rehberi']
  }),

  // ---------------------------------------------------------------- 6
  page({
    slug: 'windows-lisans-satin-al', platform_key: 'social-media', sort_order: 65,
    kategori_kalibi: /windows|office|lisans|licence|license/i,
    title_tr: 'Windows Lisans Satın Al', title_en: 'Buy Windows Licence Keys',
    subtitle_tr: 'Windows 10/11 Home ve Pro ile Office lisans anahtarları: dijital teslimat, tek seferlik ödeme. Anahtar türü ve etkinleştirme koşulları kartta açıkça yazar.',
    subtitle_en: 'Windows 10/11 Home and Pro plus Office licence keys: digital delivery, one-time payment. Key type and activation terms are stated clearly on the card.',
    seo_title_tr: 'Windows Lisans Satın Al – Windows 10/11 ve Office Key',
    seo_title_en: 'Buy Windows Licence – Windows 10/11 and Office Keys',
    seo_description_tr: 'Windows lisans satın al: Windows 10/11 Home-Pro ve Office anahtarları dijital teslimatla. Tek seferlik ödeme; anahtar türü ve koşullar kartta yazar.',
    seo_description_en: 'Buy a Windows licence: Windows 10/11 Home-Pro and Office keys with digital delivery. One-time payment; key type and terms are stated on the card.',
    steps_tr: ['Ücretsiz hesap oluşturun ve bakiye yükleyin.', 'Tablodan işletim sistemi veya Office sürümünü seçin.', 'Kartta istenen bilgiyi girin (anahtarın iletileceği e-posta).', 'Lisans anahtarınız sağlayıcının belirttiği süre içinde iletilir.'],
    steps_en: ['Create a free account and top up your balance.', 'Pick the OS or Office edition from the table.', 'Enter the info the card asks for (the email to receive the key).', 'Your licence key arrives within the provider\'s stated period.'],
    content_tr: [
      '<h2>Hangi lisanslar var?</h2>',
      '<p>Katalogda Windows 10 ve Windows 11\'in Home ile Pro sürümleri ve Office paketlerinin (2016 Pro Plus, 365 Pro gibi) lisans anahtarları listelenir. Anahtarlar dijital olarak teslim edilir; kutu, DVD veya fiziksel kargo yoktur. Etkinleştirme, Windows/Office içindeki standart "ürün anahtarı gir" adımıyla yapılır.</p>',
      '<h2>Nasıl etkinleştirilir?</h2>',
      '<p>Windows\'ta Ayarlar → Sistem → Etkinleştirme → Ürün anahtarını değiştir yolunu izleyin ve anahtarı girin. Office\'te uygulama ilk açılışta anahtar ister. Etkinleştirme internet bağlantısıyla saniyeler içinde tamamlanır; sorun yaşarsanız destek ekibimiz kurulum adımlarında yardımcı olur.</p>',
      '<h2>Dürüst uyarı</h2>',
      '<blockquote>Bu anahtarlar uygun fiyatlı OEM/toplu lisans türündedir; perakende kutu lisansından farkı, tek cihaza bağlanması ve anakart değişiminde taşınamayabilmesidir. Anahtar türü ve koşullar hizmet kartında yazar. Teslim edilen ve kullanılan dijital kodlarda iade yapılamaz; İade Politikası sayfasındaki dijital ürün istisnası geçerlidir. Kurumsal uyumluluk gerektiren işletmeler için perakende/kurumsal kanal lisansı daha uygun olabilir.</blockquote>',
      '<h2>Neden uygun fiyatlı?</h2>',
      '<p>OEM ve toplu lisans anahtarları, cihaz üreticileri ve kurumsal paketler için üretilen, piyasada yaygın olarak tekil satılan anahtarlardır; uygun fiyatın kaynağı budur. Aynı Windows/Office yazılımını çalıştırır ve güncelleme alır.</p>'
    ].join('\n'),
    content_en: [
      '<h2>Which licences are available?</h2>',
      '<p>The catalogue lists licence keys for Windows 10 and 11 Home and Pro editions plus Office packages (2016 Pro Plus, 365 Pro and similar). Keys are delivered digitally; there is no box, DVD or physical shipping. Activation uses the standard "enter a product key" step inside Windows/Office.</p>',
      '<h2>How do I activate?</h2>',
      '<p>In Windows go to Settings → System → Activation → Change product key and enter the key. Office asks for the key on first launch. Activation completes within seconds over the internet; if you hit an issue our support team helps with the setup steps.</p>',
      '<h2>An honest note</h2>',
      '<blockquote>These are fair-priced OEM/volume licence keys; unlike retail box licences they bind to a single device and may not transfer after a motherboard change. The key type and terms are on the service card. Delivered and redeemed digital codes cannot be refunded; the digital goods exception on the Refund Policy page applies. Businesses needing formal compliance may be better served by retail/corporate channel licences.</blockquote>',
      '<h2>Why is it cheap?</h2>',
      '<p>OEM and volume keys are produced for device manufacturers and corporate bundles and are widely resold individually; that is the source of the low price. They run the same Windows/Office software and receive updates.</p>'
    ].join('\n'),
    faq_tr: [
      { q: 'Anahtar orijinal mi, güncelleme alır mı?', a: 'Anahtarlar Microsoft etkinleştirme sunucularında doğrulanan OEM/toplu lisans anahtarlarıdır ve sistem normal şekilde güncelleme alır. Tür bilgisi kartta yazar.' },
      { q: 'Bilgisayar değiştirirsem anahtar taşınır mı?', a: 'OEM anahtarlar tek cihaza bağlanır; anakart değişiminde veya yeni bilgisayarda yeniden etkinleştirme çoğu zaman mümkün olmaz. Bu, uygun fiyatın bilinen karşılığıdır.' },
      { q: 'Anahtar çalışmazsa ne olur?', a: 'Teslim edilen anahtar etkinleştirmede hata verirse destek ekibine sipariş numaranızla ulaşın; sağlayıcıyla birlikte kontrol edilir. Kullanılmış/etkinleştirilmiş kodlarda iade yapılmaz.' },
      { q: 'Teslimat ne kadar sürer?', a: 'Dijital teslimattır; sağlayıcının kartta belirttiği süre geçerlidir. Anahtar, siparişte belirttiğiniz kanaldan iletilir.' }
    ],
    faq_en: [
      { q: 'Is the key genuine, does it get updates?', a: 'Keys validate against Microsoft activation servers as OEM/volume licences and the system receives updates normally. The type is stated on the card.' },
      { q: 'Does the key transfer to a new PC?', a: 'OEM keys bind to a single device; re-activation after a motherboard change or on a new PC is usually not possible. That is the known trade-off for the price.' },
      { q: 'What if the key does not work?', a: 'If a delivered key fails activation, contact support with your order number; it is checked with the provider. Redeemed/activated codes cannot be refunded.' },
      { q: 'How fast is delivery?', a: 'Delivery is digital; the provider\'s stated period on the card applies. The key is sent through the channel you specify with the order.' }
    ],
    related_blog_slugs: ['smm-panel-odeme-guvenligi-rehberi']
  }),

  // ---------------------------------------------------------------- 7
  page({
    slug: 'steam-oyun-hesabi-satin-al', platform_key: 'social-media', sort_order: 66,
    kategori_kalibi: /steam.*(hesap|account|game)|game account/i,
    title_tr: 'Steam Oyun Hesabı Satın Al', title_en: 'Buy Steam Game Accounts',
    subtitle_tr: 'RDR2, Spider-Man, Metro Exodus gibi popüler oyunların hazır hesapları uygun fiyatla. Hesap türü ve kullanım koşulları her paketin kartında dürüstçe yazar.',
    subtitle_en: 'Ready accounts for popular games like RDR2, Spider-Man and Metro Exodus at fair prices. Account type and usage terms are stated honestly on each card.',
    seo_title_tr: 'Steam Oyun Hesabı Satın Al – Popüler Oyunlar Uygun Fiyata',
    seo_title_en: 'Buy Steam Game Accounts – Popular Games at Fair Prices',
    seo_description_tr: 'Steam oyun hesabı satın al: RDR2, Spider-Man ve daha fazlası uygun fiyatlı hazır hesaplarla. Hesap türü ve koşullar kartta açıkça yazar; dijital teslim.',
    seo_description_en: 'Buy Steam game accounts: RDR2, Spider-Man and more via fair-priced ready accounts. Account type and terms are stated on the card; digital delivery.',
    steps_tr: ['Ücretsiz hesap oluşturun ve bakiye yükleyin.', 'Tablodan oyununuzu seçin; hesap türü ve koşullar kartta yazar.', 'Kartta istenen teslimat bilgisini girin (e-posta).', 'Hesap bilgileri sağlayıcının belirttiği süre içinde iletilir.'],
    steps_en: ['Create a free account and top up your balance.', 'Pick your game from the table; account type and terms are on the card.', 'Enter the delivery info the card asks for (email).', 'Account details arrive within the provider\'s stated period.'],
    content_tr: [
      '<h2>Bu hesaplar nedir?</h2>',
      '<p>Bu sayfadaki paketler, içinde belirtilen oyunun yüklü olduğu hazır Steam hesaplarıdır. Tam sürüm oyunun mağaza fiyatının çok altında bir bedelle oyuna erişim sağlarlar. Katalogda Red Dead Redemption 2, Spider-Man serisi, Metro Exodus, Detroit: Become Human gibi popüler yapımlar listelenir.</p>',
      '<h2>Ne aldığınızı bilin (şeffaflık)</h2>',
      '<blockquote>Bu fiyat seviyesindeki hesaplar genellikle <strong>paylaşımlı veya çevrimdışı oyun amaçlı</strong> hesaplardır: oyunu oynayabilirsiniz ancak hesap kişisel hesabınız değildir; profil bilgilerini değiştirmemeniz ve kartta yazan kurallara uymanız gerekir. Çevrimiçi çok oyunculu erişim, hesabı kişiselleştirme veya ömür boyu erişim <strong>garanti edilmez</strong> — geçerli koşullar her paketin kartında yazar. Kendi Steam kütüphanenizde kalıcı oyun istiyorsanız doğru yol resmî mağazadan satın almaktır; bu paketler uygun fiyatlı bir alternatif sunar, ikame değildir.</blockquote>',
      '<h2>Nasıl kullanılır?</h2>',
      '<p>Teslim edilen bilgilerle Steam\'e giriş yapılır ve oyun indirilir. Çoğu pakette çevrimdışı modda oynamak hesabın diğer kullanıcılarıyla çakışmayı önler; kart açıklamasındaki adımları izleyin. Hesap bilgilerini değiştirmek (e-posta, şifre, profil) paket kurallarını ihlal eder ve erişiminizin kapanmasına yol açabilir.</p>',
      '<h2>İade ve destek</h2>',
      '<p>Teslim edilen hesap bilgileri çalışmıyorsa sipariş numaranızla destek ekibine ulaşın; sağlayıcıyla birlikte kontrol edilir. Çalışır teslim edilen dijital hesaplarda iade yapılmaz; İade Politikası sayfasındaki dijital ürün istisnası geçerlidir.</p>'
    ].join('\n'),
    content_en: [
      '<h2>What are these accounts?</h2>',
      '<p>The packs on this page are ready Steam accounts with the stated game installed. They provide access to the full game far below the store price. The catalogue lists popular titles such as Red Dead Redemption 2, the Spider-Man series, Metro Exodus and Detroit: Become Human.</p>',
      '<h2>Know what you are buying (transparency)</h2>',
      '<blockquote>Accounts at this price level are generally <strong>shared or offline-play</strong> accounts: you can play the game, but the account is not your personal account; you must not change profile details and must follow the rules on the card. Online multiplayer access, personalising the account or lifetime access are <strong>not guaranteed</strong> — the applicable terms are on each pack\'s card. If you want a game permanently in your own Steam library, the right path is the official store; these packs are a budget alternative, not a substitute.</blockquote>',
      '<h2>How is it used?</h2>',
      '<p>Log into Steam with the delivered details and download the game. On most packs playing in offline mode avoids clashing with other users of the account; follow the steps in the card description. Changing account details (email, password, profile) violates pack rules and can end your access.</p>',
      '<h2>Refunds and support</h2>',
      '<p>If delivered details do not work, contact support with your order number; it is checked with the provider. Working digital account deliveries cannot be refunded; the digital goods exception on the Refund Policy page applies.</p>'
    ].join('\n'),
    faq_tr: [
      { q: 'Hesap tamamen benim mi oluyor?', a: 'Hayır; bu fiyat seviyesindeki paketler genellikle paylaşımlı/çevrimdışı oyun hesaplarıdır. Oyunu oynarsınız ama hesap bilgilerini değiştiremezsiniz. Koşullar kartta açıkça yazar.' },
      { q: 'Çevrimiçi (multiplayer) oynayabilir miyim?', a: 'Çoğu pakette garanti edilmez; hikâye modu/çevrimdışı oynanış esastır. Pakete özel durum kart açıklamasında belirtilir.' },
      { q: 'Hesap sonradan kapanırsa ne olur?', a: 'Kural ihlali olmadan yaşanan erişim sorunlarında destek ekibi sağlayıcıyla birlikte kontrol eder; kartta garanti süresi yazıyorsa o süre geçerlidir. Kural ihlalinden (bilgi değiştirme vb.) doğan kapanmalar kapsam dışıdır.' },
      { q: 'Oyunu kendi hesabıma taşıyabilir miyim?', a: 'Hayır, Steam oyunları hesaplar arasında taşınamaz. Kendi kütüphanenizde kalıcı oyun için resmî mağaza tek yoldur.' }
    ],
    faq_en: [
      { q: 'Does the account become fully mine?', a: 'No; packs at this price level are generally shared/offline-play accounts. You play the game but must not change account details. Terms are stated clearly on the card.' },
      { q: 'Can I play online multiplayer?', a: 'Not guaranteed on most packs; story mode/offline play is the intended use. Pack-specific status is in the card description.' },
      { q: 'What if the account stops working later?', a: 'For access issues without rule violations, support checks with the provider; if the card states a warranty period, it applies. Closures caused by rule violations (changing details etc.) are out of scope.' },
      { q: 'Can I move the game to my own account?', a: 'No, Steam games cannot be transferred between accounts. The official store is the only way to own a game permanently in your library.' }
    ],
    related_blog_slugs: ['smm-panel-odeme-guvenligi-rehberi', 'sosyal-medya-hesap-guvenligi-rehberi']
  }),

  // ---------------------------------------------------------------- 8
  page({
    slug: 'netflix-hesap-satin-al', platform_key: 'social-media', sort_order: 67,
    kategori_kalibi: /netflix|prime|hbo|disney|movies|film|dizi/i,
    title_tr: 'Netflix Hesap Satın Al', title_en: 'Buy Netflix Accounts',
    subtitle_tr: 'Netflix, Amazon Prime Video ve HBO Max üyelikleri uygun fiyatla: 1 kullanıcılık profiller ve tam hesap seçenekleri. Koşullar her paketin kartında dürüstçe yazar.',
    subtitle_en: 'Netflix, Amazon Prime Video and HBO Max memberships at fair prices: single-user profiles and full-account options. Terms are stated honestly on each card.',
    seo_title_tr: 'Netflix Hesap Satın Al – Prime Video ve HBO Max Üyelikleri',
    seo_title_en: 'Buy Netflix Accounts – Prime Video and HBO Max Memberships',
    seo_description_tr: 'Netflix hesap satın al: uygun fiyatlı Netflix, Prime Video ve HBO Max üyelikleri. Profil veya tam hesap seçenekleri; koşullar kartta açıkça yazar.',
    seo_description_en: 'Buy a Netflix account: fairly priced Netflix, Prime Video and HBO Max memberships. Profile or full-account options; terms are stated on the card.',
    steps_tr: ['Ücretsiz hesap oluşturun ve bakiye yükleyin.', 'Platformu ve paket tipini seçin (1 kullanıcı / tam hesap).', 'Kartta istenen teslimat bilgisini girin (e-posta).', 'Giriş bilgileri sağlayıcının belirttiği süre içinde iletilir.'],
    steps_en: ['Create a free account and top up your balance.', 'Pick the platform and pack type (single user / full account).', 'Enter the delivery info the card asks for (email).', 'Login details arrive within the provider\'s stated period.'],
    content_tr: [
      '<h2>Paket tipleri</h2>',
      '<ul>',
      '<li><strong>1 kullanıcılık profil:</strong> Paylaşımlı bir hesabın size ayrılan profilini kullanırsınız; en uygun fiyatlı seçenektir. Diğer profillere dokunmama kuralı geçerlidir.</li>',
      '<li><strong>Tam hesap:</strong> Hesabın tamamı size teslim edilir; profilleri kendiniz düzenlersiniz. Fiyatı profil seçeneğinden yüksektir.</li>',
      '<li><strong>Süre seçenekleri:</strong> 1, 3 ve 6 aylık paketler; süre ve koşullar kartta yazar.</li>',
      '</ul>',
      '<h2>Dürüst uyarı — bunu okumadan almayın</h2>',
      '<blockquote>Bu üyelikler paylaşımlı hesap havuzlarından gelir ve resmî bireysel abonelik DEĞİLDİR. Profil seçeneklerinde diğer kullanıcıların davranışı hesabı etkileyebilir; şifre değişikliği yaşanırsa kartta yazan garanti süresi içinde destek ekibi yenisini sağlar, süre dışındaki kesintiler kapsam dışıdır. Profil ayarlarını, hesap şifresini veya ödeme bilgilerini DEĞİŞTİRMEYİN — kural ihlali erişiminizi kapatır ve iade kapsamına girmez. Kesintisiz ve kişisel deneyim isteyenler için doğru yol resmî aboneliktir.</blockquote>',
      '<h2>Nasıl teslim edilir?</h2>',
      '<p>Sipariş sonrası giriş bilgileri (e-posta + şifre, profil seçeneğinde ayrıca profil adı) sağlayıcının belirttiği süre içinde iletilir. Bilgileri kimseyle paylaşmayın; aynı anda kartta yazan cihaz sayısından fazla cihazda kullanmayın.</p>',
      '<h2>Destek</h2>',
      '<p>Giriş sorunu yaşarsanız sipariş numaranızla destek ekibine ulaşın; garanti süresi içindeki sorunlarda hesap yenilenir. Panel bakiyenizle dakikalar içinde yeniden sipariş verebilirsiniz.</p>'
    ].join('\n'),
    content_en: [
      '<h2>Pack types</h2>',
      '<ul>',
      '<li><strong>Single-user profile:</strong> you use the profile reserved for you on a shared account; the most affordable option. The do-not-touch-other-profiles rule applies.</li>',
      '<li><strong>Full account:</strong> the whole account is delivered to you and you manage the profiles. Priced above the profile option.</li>',
      '<li><strong>Durations:</strong> 1, 3 and 6 month packs; period and terms are on the card.</li>',
      '</ul>',
      '<h2>An honest note — read before buying</h2>',
      '<blockquote>These memberships come from shared account pools and are NOT official individual subscriptions. On profile options, other users\' behaviour can affect the account; if a password change occurs, support provides a replacement within the warranty period stated on the card — interruptions outside that period are out of scope. Do NOT change profile settings, the account password or payment details — rule violations end your access and are not refundable. For an uninterrupted, personal experience the right path is an official subscription.</blockquote>',
      '<h2>How is it delivered?</h2>',
      '<p>After ordering, login details (email + password, plus the profile name on profile options) arrive within the provider\'s stated period. Do not share the details; do not exceed the device count stated on the card.</p>',
      '<h2>Support</h2>',
      '<p>If you hit a login issue, contact support with your order number; accounts are replaced for issues within the warranty period. You can re-order in minutes with your panel balance.</p>'
    ].join('\n'),
    faq_tr: [
      { q: 'Hesap resmî abonelik mi?', a: 'Hayır; paylaşımlı hesap havuzundan uygun fiyatlı üyeliklerdir. Kesintisiz kişisel deneyim isteyenlere resmî aboneliği öneririz — bu sayfadaki paketler bütçe alternatifi olarak sunulur.' },
      { q: 'Şifre değişirse ne olur?', a: 'Kartta yazan garanti süresi içindeyse destek ekibi yeni hesap bilgisi sağlar. Garanti süresi dışındaki kesintiler kapsam dışıdır.' },
      { q: 'Kaç cihazda izleyebilirim?', a: 'Paket kartında yazan cihaz/profil sınırı geçerlidir. Sınır aşımı hesabın kilitlenmesine yol açabilir ve garanti kapsamına girmez.' },
      { q: '4K kalite var mı?', a: 'Kalite, teslim edilen hesabın abonelik planına bağlıdır ve kartta belirtilir; her pakette 4K garanti edilmez.' }
    ],
    faq_en: [
      { q: 'Is this an official subscription?', a: 'No; these are fair-priced memberships from shared account pools. For an uninterrupted personal experience we recommend an official subscription — these packs are offered as a budget alternative.' },
      { q: 'What if the password changes?', a: 'Within the warranty period stated on the card, support provides replacement details. Interruptions outside the warranty period are out of scope.' },
      { q: 'On how many devices can I watch?', a: 'The device/profile limit on the pack card applies. Exceeding it can lock the account and is not covered by the warranty.' },
      { q: 'Is 4K included?', a: 'Quality depends on the delivered account\'s subscription plan and is stated on the card; 4K is not guaranteed on every pack.' }
    ],
    related_blog_slugs: ['smm-panel-odeme-guvenligi-rehberi', 'sosyal-medya-hesap-guvenligi-rehberi']
  })
];

module.exports = { PAGES };

if (require.main === module) {
  (async () => {
    const db = new sqlite3.Database(dbPath);
    db.configure('busyTimeout', 5000);
    const all = (q, prm = []) => new Promise((r, j) => db.all(q, prm, (e, rows) => e ? j(e) : r(rows)));
    const get = (q, prm = []) => new Promise((r, j) => db.get(q, prm, (e, row) => e ? j(e) : r(row)));
    const run = (q, prm = []) => new Promise((r, j) => db.run(q, prm, function (e) { e ? j(e) : r(this); }));

    const tablo = await get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'landing_pages'");
    if (!tablo) { console.error('landing_pages tablosu yok: once sunucuyu yeni kodla baslat.'); process.exit(1); }

    // Kategoriler calisma aninda ada gore bulunur (aktif servisi olanlar).
    const kategoriler = await all(`SELECT c.id, c.name, c.name_tr FROM categories c
      WHERE EXISTS (SELECT 1 FROM services s WHERE s.category_id = c.id AND s.status = 1)`);

    let eklenen = 0, atlanan = 0;
    for (const ham of PAGES) {
      const { kategori_kalibi, ...sayfa } = ham;
      if (await get('SELECT id FROM landing_pages WHERE slug = ?', [sayfa.slug])) {
        console.log('atlandi (zaten var): ' + sayfa.slug); atlanan++; continue;
      }
      const eslesen = kategoriler.filter(c => kategori_kalibi.test(`${c.name_tr || ''} ${c.name || ''}`)).map(c => c.id);
      if (!eslesen.length) {
        console.log('ATLANDI (kategori yok): ' + sayfa.slug + ' — once ' + kategori_kalibi + ' kalibina uyan, aktif servisli bir kategori ekleyin, sonra tekrar calistirin.');
        atlanan++; continue;
      }
      const sonuc = normalizePagePayload({ ...sayfa, category_ids: eslesen });
      if (sonuc.error) { console.error('HATA ' + sayfa.slug + ': ' + sonuc.error); continue; }
      const cols = Object.keys(sonuc.fields);
      await run('INSERT INTO landing_pages (' + cols.join(', ') + ', updated_at) VALUES ('
        + cols.map(() => '?').join(', ') + ', CURRENT_TIMESTAMP)', cols.map(c => sonuc.fields[c]));
      console.log('olusturuldu (taslak): ' + sonuc.fields.slug + ' — kategoriler: [' + eslesen.join(', ') + ']');
      eklenen++;
    }
    db.close();
    console.log('Bitti: ' + eklenen + ' sayfa olusturuldu, ' + atlanan + ' atlandi.');
    console.log('Atlanan sayfalar icin: servis/kategorileri ekledikten sonra bu scripti TEKRAR calistirmaniz yeterli.');
  })().catch(err => { console.error(err); process.exit(1); });
}
