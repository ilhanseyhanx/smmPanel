'use strict';

// YouTube satis sayfalari (8 Eyl 2026, iddia revizyonu ayni gun).
// Katalogda 16 aktif YouTube servisi vardi ama hicbir satis sayfasi yoktu;
// oysa YouTube ana sayfanin h1'inde, title'inda ve aciklamasinda geciyor.
//
// ICERIK KURALI (kullanici revizyonu, 8 Eyl 2026):
//   - SEO sonucu, siralama, onerilenlere girme veya para kazanma GARANTISI yok.
//   - Algoritmayi etkileyecegi/manipule edecegi iddiasi yok.
//   - SAGLAYICININ teknik hizmet ozelligi ile BIZIM pazarlama cumlemiz ayrilir;
//     bunun icin "saglayici ... olarak belirtir" kalibi bilincli kullanildi.
//   - YouTube Is Ortakligi Programi esikleri kesin sayi olarak verilmez,
//     resmi kaynaga yonlendirilir.
//   - Katalogdaki "Yenileme Yok / Garantisiz" uyarilari oldugu gibi korunur.
//
// Fiyat, min/max ve servis adlari CANLI katalogdan gelir; bu dosyada
// tekrarlanmaz. Uydurma ozellik yazilmadi.
//
// Kullanim: cd /var/www/smmjet && node scripts/seed-landing-pages-youtube.js
// Var olan slug'lara DOKUNMAZ; sayfalar TASLAK olarak olusturulur.
// Var olan taslaklari bu metinlerle guncellemek icin:
//   node scripts/revise-youtube-drafts.js

const path = require('path');
const sqlite3 = require('sqlite3');
const { normalizePagePayload } = require('../utils/landingPages');

const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.join(__dirname, '..', 'database.sqlite');

const STEPS_TR = ['Ücretsiz hesap oluşturun ve kart, kripto ya da havale ile bakiye yükleyin.', 'Tablodan ihtiyacınıza uygun paketi seçin; fiyat ve limitler kartta yazar.', 'Herkese açık bağlantıyı ve miktarı girin; şifre istenmez.', 'Sipariş saniyeler içinde başlar; ilerlemeyi Siparişlerim sayfasından izleyin.'];
const STEPS_EN = ['Create a free account and top up with card, crypto or bank transfer.', 'Pick the package that fits your need from the table; price and limits are on the card.', 'Enter the public link and the quantity; no password needed.', 'The order starts within seconds; track progress on the My Orders page.'];

const FAQ_COMMON_TR = [
  { q: 'Şifremi vermem gerekir mi?', a: 'Hayır. Yalnızca herkese açık kanal veya video bağlantısı istenir; hesabınıza asla giriş yapılmaz.' },
  { q: 'Hangi ödeme yöntemleri var?', a: 'Kredi/banka kartı, kripto para ve banka havalesi ile bakiye yükleyebilirsiniz; bakiye onaylanır onaylanmaz hesabınıza yansır.' },
  { q: 'Sipariş tamamlanmazsa ne olur?', a: '"İptal Aktif" etiketli hizmetlerde teslim edilmeyen kısım bakiyenize iade edilir. Diğer hizmetlerde destek ekibi sağlayıcıyla birlikte takip eder; iade koşulları İade Politikası sayfasında yazar.' }
];
const FAQ_COMMON_EN = [
  { q: 'Do I need to give my password?', a: 'No. Only a public channel or video link is required; nobody ever logs into your account.' },
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
  page({
    slug: 'youtube-abone-satin-al', platform_key: 'youtube', category_ids: [163, 19], sort_order: 40,
    title_tr: 'YouTube Abone Satın Al', title_en: 'Buy YouTube Subscribers',
    subtitle_tr: 'Kanal aboneliği paketleri: anında başlayan seçenekler, saatlik 10K ve günlük 100K hız, %100 Türk abone alternatifi. Şifresiz sipariş, sadece kanal bağlantısı.',
    subtitle_en: 'Channel subscriber packages: instant-start options, 10K hourly and 100K daily speed, plus a 100% Turkish audience alternative. No password, just your channel link.',
    seo_title_tr: 'YouTube Abone Satın Al – Anında Başlangıç, Türk Abone Seçeneği',
    seo_title_en: 'Buy YouTube Subscribers – Instant Start, Turkish Option',
    // 146 karakter: 160 sinirinin altinda kaldigi icin buildMetaDescription
    // metni kesmez (onceki 161 karakterlik surum son cumlesini kaybetmisti).
    seo_description_tr: 'YouTube abone satın al: anında başlayan paketler, saatlik 10K hız ve %100 Türk abone seçeneği. Şifresiz sipariş, garanti koşulları açıkça yazılıdır.',
    seo_description_en: 'Buy YouTube subscribers: instant-start packages, 10K hourly speed and a 100% Turkish option. No password; guarantee terms are stated openly.',
    content_tr: [
      '<h2>YouTube abonesi ne işe yarar?</h2>',
      '<p>Abone sayısı, kanal sayfanızda herkese açık görünen sayaçlardan biridir ve ziyaretçilerin kanal hakkında ilk izlenimi oluştururken baktığı sosyal kanıt unsurlarından sayılabilir. Bu sayfadaki paketler yalnızca bu sayacı yükseltir; izlenme, etkileşim, arama sıralaması ya da kalıcı kanal büyümesi konusunda bir sonuç taahhüt etmez.</p>',
      '<h2>Paket seçenekleri</h2>',
      '<ul>',
      '<li><strong>Anında başlangıç, saatlik 10K:</strong> 1 adetten 100.000 adede kadar sipariş verilebilir; sağlayıcı teslimatın anında başladığını belirtir.</li>',
      '<li><strong>Günlük 100K hız:</strong> 100-100.000 aralığı, süper anında başlangıç; yüksek hacimli siparişler için.</li>',
      '<li><strong>Standart kanal abonesi:</strong> 10-50.000 aralığı, katalogdaki en uygun birim fiyat.</li>',
      '<li><strong>%100 Türk abone:</strong> 10-10.000 aralığı, hızlı teslimat. Katalogda "Garantisiz" etiketiyle listelenir.</li>',
      '</ul>',
      '<h2>Garanti konusunda dürüst uyarı</h2>',
      '<blockquote>Katalogdaki YouTube abone hizmetlerinin tamamı "Yenileme Yok" etiketlidir. Düşüş yaşanması hâlinde telafi, refill veya ücret iadesi yapılmaz. Sipariş vermeden önce bu koşulu göz önünde bulundurun; yenileme garantisi arayan kullanıcılar için beğeni ve görüntülenme tarafında 30 gün yenilemeli seçenekler mevcuttur.</blockquote>',
      '<h2>Doğru kullanım</h2>',
      '<p>Kanalınızın herkese açık olması gerekir. Aynı kanal için sipariş tamamlanmadan ikinci bir sipariş vermemeniz önerilir; üst üste gelen siparişler teslimatı karıştırabilir. Abone sayısını, düzenli yayın ve içerik çalışmasının yerine geçen bir yöntem olarak değil, onun yanında duran bir unsur olarak değerlendirin.</p>',
      '<h2>Para kazanma (YouTube İş Ortaklığı Programı) hakkında</h2>',
      '<p>Programa başvuru koşulları abone sayısının yanında izlenme süresi gibi başka ölçütleri de içerir ve bu koşullar YouTube tarafından zaman zaman güncellenir. Güncel ve bağlayıcı şartlar için YouTube\'un resmî yardım sayfalarını esas alın. Bu sayfadaki hizmetlerin hiçbiri programa kabul edilmeyi ya da para kazanma uygunluğu kazanmayı sağlamaz veya garanti etmez.</p>'
    ].join('\n'),
    content_en: [
      '<h2>What do YouTube subscribers do for you?</h2>',
      '<p>Subscriber count is one of the public counters shown on your channel page, and it can be read as one of the social proof signals a visitor takes in when forming a first impression. The packages on this page raise that counter only; they make no commitment about views, engagement, search ranking or lasting channel growth.</p>',
      '<h2>Package options</h2>',
      '<ul>',
      '<li><strong>Instant start, 10K hourly:</strong> order from 1 up to 100,000; the provider states that delivery begins immediately.</li>',
      '<li><strong>100K daily speed:</strong> 100-100,000 range with super instant start, for high-volume orders.</li>',
      '<li><strong>Standard channel subscribers:</strong> 10-50,000 range, the lowest unit price in the catalogue.</li>',
      '<li><strong>100% Turkish subscribers:</strong> 10-10,000 range, fast delivery. Listed in the catalogue with a "No Guarantee" tag.</li>',
      '</ul>',
      '<h2>An honest note on guarantees</h2>',
      '<blockquote>Every YouTube subscriber service in the catalogue is tagged "No Refill". If drops occur there is no refill or refund. Consider this before ordering; if you need a refill guarantee, 30-day refill options exist on the likes and views services.</blockquote>',
      '<h2>Using it right</h2>',
      '<p>Your channel must be public. Avoid placing a second order for the same channel before the first completes, as overlapping orders can disrupt delivery. Treat subscriber count as something that sits alongside regular publishing and content work, not as a replacement for it.</p>',
      '<h2>About monetisation (YouTube Partner Program)</h2>',
      '<p>Programme eligibility involves criteria beyond subscriber count, such as watch time, and those criteria are updated by YouTube from time to time. Rely on YouTube\'s official help pages for current and binding terms. None of the services on this page provides or guarantees acceptance into the programme or monetisation eligibility.</p>'
    ].join('\n'),
    faq_tr: [
      { q: 'Aboneler düşer mi, telafi var mı?', a: 'Katalogdaki YouTube abone hizmetlerinin tamamı "Yenileme Yok" etiketlidir; düşüş hâlinde telafi veya iade yapılmaz. Bu koşul hizmet kartında da açıkça yazar.' },
      { q: 'Türk abone ile dünya geneli abone farkı nedir?', a: '%100 Türk paketi; Türkçe içerik üreten ve kanalındaki abone dağılımını Türkiye ağırlıklı tutmak isteyen kullanıcılar için sunulan bir seçenektir. Birim fiyatı dünya geneli paketlere göre belirgin biçimde yüksektir, dünya geneli paketler ise daha uygun fiyatlı ve daha hızlıdır. Katalogda bu paket "Garantisiz" etiketiyle listelenir.' },
      { q: '1.000 abone olunca kanal para kazanmaya başlar mı?', a: 'Abone sayısı tek başına yeterli değildir. YouTube İş Ortaklığı Programı, abone sayısının yanında izlenme süresi gibi ek ölçütler arar ve bu koşullar zaman zaman değişir. Güncel şartlar için YouTube\'un resmî yardım sayfalarını kontrol edin. Bu sayfadaki hizmetler programa kabul veya para kazanma uygunluğu garantisi vermez.' },
      { q: 'Kanal bağlantısını nasıl vermeliyim?', a: 'Kanalın herkese açık ana sayfa adresini girin; youtube.com/@kullaniciadi biçimi çalışır. Abone siparişinde video bağlantısı kabul edilmez.' }
    ],
    faq_en: [
      { q: 'Will subscribers drop, is there a refill?', a: 'Every YouTube subscriber service in the catalogue is tagged "No Refill"; there is no compensation or refund on drops. This is also stated on the service card.' },
      { q: 'Turkish vs worldwide subscribers?', a: 'The 100% Turkish package is an option for people producing Turkish-language content who want the subscriber distribution on their channel weighted towards Turkey. Its unit price is noticeably higher than worldwide packages, which are cheaper and faster. The catalogue lists this package with a "No Guarantee" tag.' },
      { q: 'Does 1,000 subscribers mean monetisation?', a: 'Subscriber count alone is not enough. The YouTube Partner Program looks at additional criteria such as watch time, and those criteria change from time to time. Check YouTube\'s official help pages for current terms. The services on this page do not guarantee programme acceptance or monetisation eligibility.' },
      { q: 'Which link should I submit?', a: 'Use the public channel home URL; youtube.com/@handle works. Video links are not accepted for subscriber orders.' }
    ],
    related_blog_slugs: ['youtube-da-1000-abone-ve-4000-saat-izlenme-suresine-ulasma-rehberi-2890', 'youtube-izlenme-suresi-artirmanin-yollari', 'youtube-video-seo-baslik-etiket-aciklama']
  }),
  page({
    slug: 'youtube-izlenme-satin-al', platform_key: 'youtube', category_ids: [258, 252], sort_order: 41,
    title_tr: 'YouTube İzlenme Satın Al', title_en: 'Buy YouTube Views',
    subtitle_tr: 'ABD görüntülenme seçenekleri (sağlayıcı bildirimiyle 1-2 dakika izlenme süresi ve farklı trafik kaynakları) ve canlı yayınlar için 15-90 dakikalık eşzamanlı izleyici paketleri.',
    subtitle_en: 'US view options (1-2 minute retention and different traffic sources as stated by the provider) plus 15-90 minute concurrent viewer packages for live streams.',
    // Marka eki sunucu tarafinda "<seo_title> | Jet SMM Panel" olarak
    // eklenir; basliga ikinci kez marka yazilmaz.
    seo_title_tr: 'YouTube İzlenme Satın Al – Görüntülenme ve Canlı Yayın İzleyici',
    seo_title_en: 'Buy YouTube Views – Video Views and Live Stream Viewers',
    seo_description_tr: 'YouTube izlenme satın al: 1-2 dakika izlenme süreli SEO odaklı ABD görüntülenmesi ve canlı yayınlar için 15-90 dakikalık eşzamanlı izleyici paketleri.',
    seo_description_en: 'Buy YouTube views: US view packages with 1-2 minute retention as stated by the provider, plus 15-90 minute concurrent viewer packages for live streams.',
    content_tr: [
      '<h2>Görüntülenme paketleri ne sunar?</h2>',
      '<p>Bu sayfadaki paketler, yayınlanmış bir videonun görüntülenme sayacını ya da süren bir canlı yayındaki eşzamanlı izleyici sayısını yükseltir. Katalogda "SEO Odaklı" adıyla listelenen ABD görüntülenme seçeneklerinde sağlayıcı tarafından belirtilen 1-2 dakikalık izlenme süresi ve farklı trafik kaynağı seçenekleri bulunur. Bu ifadeler hizmetin teknik özelliklerini tanımlar; YouTube arama veya önerilenler sıralamasında yükselme garantisi anlamına gelmez.</p>',
      '<h2>Paket seçenekleri</h2>',
      '<ul>',
      '<li><strong>ABD görüntülenme, arama ve göz atma kaynaklı:</strong> 1.000-100.000 aralığı, günlük 100K hız. Sağlayıcı izlenme süresini 1-2 dakika, trafik kaynağını YouTube araması ve göz atma özellikleri olarak belirtir.</li>',
      '<li><strong>ABD görüntülenme, önerilen videolar kaynaklı:</strong> Aynı hacim ve izlenme süresi; sağlayıcı trafik kaynağını "Önerilen" akışı (trend + rastgele) olarak belirtir.</li>',
      '<li><strong>Canlı yayın eşzamanlı izleyici:</strong> 15, 60 ve 90 dakikalık paketler; 10 adetten 5.000.000 adede kadar. Bazı paketlerde izleyici ve beğeni birlikte gelir.</li>',
      '<li><strong>Yüksek kalite eşzamanlı izleyici:</strong> 0-15 dakika başlangıç, süper hızlı teslimat.</li>',
      '</ul>',
      '<h2>Canlı yayın paketlerinde dikkat</h2>',
      '<p>Canlı yayın izleyicisi siparişi verirken <strong>yayının açık olması zorunludur</strong>; kapalı yayına sipariş geçilemez. Bağlantı olarak izleme adresini girin (youtube.com/watch?v=... biçimi). İzleyiciler seçtiğiniz süre boyunca yayında eşzamanlı olarak tutulur; süre bitince sayı doğal olarak düşer, bu bir arıza değildir.</p>',
      '<h2>Garanti ve dürüst uyarı</h2>',
      '<blockquote>Görüntülenme paketlerinde yenileme garantisi yoktur ("Yenileme Yok" etiketi). YouTube zaman zaman görüntülenme sayılarını yeniden doğrular ve bir kısmını düşürebilir; bu durumda telafi yapılmaz. Bu hizmetler bir sayacı yükseltir; arama sıralaması, önerilenler arasında yer alma, kalıcı izleyici kazanımı veya para kazanma uygunluğu konusunda sonuç taahhüt etmez.</blockquote>'
    ].join('\n'),
    content_en: [
      '<h2>What do these view packages provide?</h2>',
      '<p>The packages on this page raise the view counter of a published video, or the concurrent viewer count of a live stream while it runs. The US view options listed in the catalogue under the name "SEO Focused" carry a 1-2 minute retention and different traffic source options as stated by the provider. These describe the technical properties of the service; they do not amount to a guarantee of higher placement in YouTube search or suggested videos.</p>',
      '<h2>Package options</h2>',
      '<ul>',
      '<li><strong>US views from search and browse:</strong> 1,000-100,000 range, 100K per day. The provider states retention as 1-2 minutes and the traffic source as YouTube search and browse features.</li>',
      '<li><strong>US views from suggested videos:</strong> same volume and retention; the provider states the traffic source as the Suggested feed (trending plus random).</li>',
      '<li><strong>Live stream concurrent viewers:</strong> 15, 60 and 90 minute packages, from 10 up to 5,000,000. Some packages deliver viewers and likes together.</li>',
      '<li><strong>High quality concurrent viewers:</strong> 0-15 minute start, super fast delivery.</li>',
      '</ul>',
      '<h2>Notes on live stream packages</h2>',
      '<p>The stream <strong>must be live</strong> when you place a live viewer order; orders cannot be queued for an offline stream. Submit the watch URL (youtube.com/watch?v=... format). Viewers are held concurrently for the period you choose; the count naturally falls when the period ends, which is not a fault.</p>',
      '<h2>Guarantees and an honest warning</h2>',
      '<blockquote>View packages carry no refill guarantee ("No Refill" tag). YouTube periodically revalidates view counts and may remove some, with no compensation in that case. These services raise a counter; they make no commitment about search ranking, appearing in suggested videos, lasting audience gain or monetisation eligibility.</blockquote>'
    ].join('\n'),
    faq_tr: [
      { q: 'Görüntülenmeler izlenme süresi kazandırır mı?', a: 'Hizmet açıklamasında görüntülenme başına 1-2 dakikalık izlenme süresi belirtilmektedir. Ancak bunun YouTube İş Ortaklığı Programı için geçerli herkese açık izlenme saati olarak kabul edileceği garanti edilmez. Para kazanma hedefleri için YouTube\'un güncel resmî şartlarını esas alın.' },
      { q: 'Canlı yayın izleyicisi ile normal görüntülenme farkı nedir?', a: 'Canlı yayın paketleri yayın sürerken eşzamanlı izleyici sayısını yükseltir ve seçilen süre boyunca (15, 60 veya 90 dakika) tutar. Normal görüntülenme ise yayınlanmış bir videonun izlenme sayısını artırır.' },
      { q: 'Sipariş sırasında yayının açık olması şart mı?', a: 'Evet. Canlı yayın izleyici hizmetlerinde yayın aktif değilse sipariş işlenemez. Yayına başladıktan sonra sipariş verin.' },
      { q: 'Görüntülenmeler düşer mi?', a: 'Görüntülenme paketleri "Yenileme Yok" etiketlidir. YouTube periyodik doğrulamalarda bir kısmını düşürebilir; bu durumda telafi yapılmaz.' }
    ],
    faq_en: [
      { q: 'Do these views build watch time?', a: 'The service description states a retention of 1-2 minutes per view. However there is no guarantee that this will be counted as valid public watch time for the YouTube Partner Program. For monetisation goals, rely on YouTube\'s current official terms.' },
      { q: 'Live viewers vs regular views?', a: 'Live packages raise the concurrent viewer count while the stream runs and hold it for the chosen period (15, 60 or 90 minutes). Regular views increase the view count of an already published video.' },
      { q: 'Must the stream be live when ordering?', a: 'Yes. Live viewer services cannot process an order if the stream is offline. Start the stream first, then order.' },
      { q: 'Will views drop?', a: 'View packages are tagged "No Refill". YouTube may remove some during periodic revalidation, and no compensation is issued in that case.' }
    ],
    related_blog_slugs: ['youtube-izlenme-suresi-artirmanin-yollari', 'youtube-shorts-izlenme-nasil-artirilir-abone-kazandiran-shorts-stratejisi-6186', 'youtube-video-seo-baslik-etiket-aciklama']
  })
];

// Revizyon betigi ayni metinleri kullanabilsin diye disa aktarilir; dosya
// dogrudan calistirildiginda asagidaki ekleyici calisir.
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
    console.log('Yayina almak icin: node scripts/publish-landing-pages.js youtube-abone-satin-al youtube-izlenme-satin-al');
  })().catch(err => { console.error(err); process.exit(1); });
}
