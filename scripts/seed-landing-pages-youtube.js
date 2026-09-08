'use strict';

// YouTube satis sayfalari (8 Eyl 2026). Katalogda 16 aktif YouTube servisi
// vardi ama hicbir satis sayfasi yoktu; oysa YouTube ana sayfanin h1'inde,
// title'inda ve aciklamasinda geciyor.
//
// Icerigin TAMAMI canli servis kayitlarindan turetildi (isim, min/max, hiz,
// baslangic suresi, yenileme durumu). Uydurma ozellik yazilmadi. Ozellikle
// yenileme/garanti konusunda katalog ne diyorsa o yazildi: YouTube abone
// hizmetlerinin hepsi "Yenileme Yok" etiketli ve bu sayfada acikca belirtildi.
//
// Kullanim: cd /var/www/smmjet && node scripts/seed-landing-pages-youtube.js
// Var olan slug'lara dokunmaz; sayfalar TASLAK olarak olusturulur.

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
    seo_description_tr: 'YouTube abone satın al: anında başlayan paketler, saatlik 10K hız ve %100 Türk abone seçeneği. Şifresiz sipariş, güvenli ödeme; garanti koşulları açıkça yazılıdır.',
    seo_description_en: 'Buy YouTube subscribers: instant-start packages, 10K hourly speed and a 100% Turkish option. No password, secure payment; guarantee terms stated openly.',
    content_tr: [
      '<h2>YouTube abonesi ne işe yarar?</h2>',
      '<p>Abone sayısı, YouTube\'da bir kanalın ilk güven ölçütüdür. İzleyici önerilen videolar arasında kanalınızı gördüğünde önce abone sayısına bakar; üç haneli bir kanalın videosuna tıklama oranı belirgin biçimde düşüktür. Ayrıca YouTube Ortaklık Programı\'nın eşiği 1.000 abonedir ve pek çok kanal tam bu ilk eşikte takılır.</p>',
      '<h2>Paket seçenekleri</h2>',
      '<ul>',
      '<li><strong>Anında başlangıç, saatlik 10K:</strong> 1 adetten 100.000 adede kadar sipariş verilebilir; teslimat anında başlar.</li>',
      '<li><strong>Günlük 100K hız:</strong> 100-100.000 aralığı, süper anında başlangıç; yüksek hacimli kanallar için.</li>',
      '<li><strong>Standart kanal abonesi:</strong> 10-50.000 aralığı, katalogdaki en uygun birim fiyat.</li>',
      '<li><strong>%100 Türk abone:</strong> 10-10.000 aralığı, hızlı teslimat. Türkçe içerik üreten kanallarda kitle uyumu için tercih edilir.</li>',
      '</ul>',
      '<h2>Garanti konusunda dürüst uyarı</h2>',
      '<blockquote>Katalogdaki YouTube abone hizmetlerinin tamamı "Yenileme Yok" etiketlidir. Düşüş yaşanması hâlinde telafi, refill veya ücret iadesi yapılmaz. Bu, YouTube\'un abone doğrulama davranışından kaynaklanır ve sektörde standarttır. Sipariş vermeden önce bu koşulu göz önünde bulundurun; garanti arayan kullanıcılar için beğeni ve görüntülenme tarafında 30 gün yenilemeli seçenekler mevcuttur.</blockquote>',
      '<h2>Doğru kullanım</h2>',
      '<p>Kanalınızın herkese açık olması gerekir. Aynı kanal için sipariş tamamlanmadan ikinci bir sipariş vermemeniz önerilir; üst üste gelen siparişler teslimatı karıştırabilir. Abone artışını düzenli yayınla destekleyin: YouTube dağıtımı izlenme süresine ve tıklama oranına bakar, tek başına abone sayısına değil. Ortaklık programı için 1.000 abonenin yanında 4.000 saat izlenme süresi de gerekir.</p>'
    ].join('\n'),
    content_en: [
      '<h2>What do YouTube subscribers do for you?</h2>',
      '<p>Subscriber count is the first trust metric for a channel. When a viewer sees your channel among suggested videos they check the subscriber count first, and click-through on a three-digit channel is measurably lower. The YouTube Partner Program threshold is also 1,000 subscribers, and many channels stall at exactly this point.</p>',
      '<h2>Package options</h2>',
      '<ul>',
      '<li><strong>Instant start, 10K hourly:</strong> order from 1 up to 100,000; delivery begins immediately.</li>',
      '<li><strong>100K daily speed:</strong> 100-100,000 range with super instant start, for high-volume channels.</li>',
      '<li><strong>Standard channel subscribers:</strong> 10-50,000 range, the lowest unit price in the catalogue.</li>',
      '<li><strong>100% Turkish subscribers:</strong> 10-10,000 range, fast delivery; preferred for Turkish-language channels.</li>',
      '</ul>',
      '<h2>An honest note on guarantees</h2>',
      '<blockquote>Every YouTube subscriber service in the catalogue is tagged "No Refill". If drops occur there is no refill or refund. This follows from YouTube\'s own subscriber validation behaviour and is standard across the industry. Consider this before ordering; if you need a guarantee, 30-day refill options exist on the likes and views services.</blockquote>',
      '<h2>Using it right</h2>',
      '<p>Your channel must be public. Avoid placing a second order for the same channel before the first completes, as overlapping orders can disrupt delivery. Support subscriber growth with regular uploads: YouTube distribution looks at watch time and click-through rate, not subscriber count alone. The Partner Program also requires 4,000 watch hours alongside the 1,000 subscribers.</p>'
    ].join('\n'),
    faq_tr: [
      { q: 'Aboneler düşer mi, telafi var mı?', a: 'Katalogdaki YouTube abone hizmetlerinin tamamı "Yenileme Yok" etiketlidir; düşüş hâlinde telafi veya iade yapılmaz. Bu koşul hizmet kartında da açıkça yazar.' },
      { q: 'Türk abone ile dünya geneli abone farkı nedir?', a: '%100 Türk paketi Türkçe içerik üreten kanallarda kitle uyumu sağlar ve yorum/etkileşim ihtimali daha yüksektir; birim fiyatı da belirgin biçimde daha yüksektir. Dünya geneli paketler daha uygun fiyatlı ve daha hızlıdır.' },
      { q: '1.000 abone olunca kanal para kazanmaya başlar mı?', a: 'Tek başına yetmez. YouTube Ortaklık Programı 1.000 abonenin yanında son 12 ayda 4.000 saat izlenme süresi (veya Shorts için 10 milyon görüntülenme) şartı arar.' },
      { q: 'Kanal bağlantısını nasıl vermeliyim?', a: 'Kanalın herkese açık ana sayfa adresini girin; youtube.com/@kullaniciadi biçimi çalışır. Abone siparişinde video bağlantısı kabul edilmez.' }
    ],
    faq_en: [
      { q: 'Will subscribers drop, is there a refill?', a: 'Every YouTube subscriber service in the catalogue is tagged "No Refill"; there is no compensation or refund on drops. This is also stated on the service card.' },
      { q: 'Turkish vs worldwide subscribers?', a: 'The 100% Turkish package matches the audience of Turkish-language channels and has a higher chance of comments and engagement; its unit price is noticeably higher. Worldwide packages are cheaper and faster.' },
      { q: 'Does 1,000 subscribers mean monetisation?', a: 'Not on its own. The Partner Program also requires 4,000 watch hours in the last 12 months (or 10 million Shorts views).' },
      { q: 'Which link should I submit?', a: 'Use the public channel home URL; youtube.com/@handle works. Video links are not accepted for subscriber orders.' }
    ],
    related_blog_slugs: ['youtube-da-1000-abone-ve-4000-saat-izlenme-suresine-ulasma-rehberi-2890', 'youtube-izlenme-suresi-artirmanin-yollari', 'youtube-video-seo-baslik-etiket-aciklama']
  }),
  page({
    slug: 'youtube-izlenme-satin-al', platform_key: 'youtube', category_ids: [258, 252], sort_order: 41,
    title_tr: 'YouTube İzlenme Satın Al', title_en: 'Buy YouTube Views',
    subtitle_tr: 'SEO odaklı ABD görüntülenmesi (1-2 dakika izlenme süresi, arama ve önerilen kaynaklı) ve canlı yayınlar için 15-90 dakikalık eşzamanlı izleyici paketleri.',
    subtitle_en: 'SEO-focused US views (1-2 minute retention, from search and suggested) plus 15-90 minute concurrent viewer packages for live streams.',
    seo_title_tr: 'YouTube İzlenme Satın Al – SEO Odaklı Görüntülenme ve Canlı Yayın İzleyici',
    seo_title_en: 'Buy YouTube Views – SEO-Focused Views and Live Stream Viewers',
    seo_description_tr: 'YouTube izlenme satın al: 1-2 dakika izlenme süreli SEO odaklı ABD görüntülenmesi ve canlı yayınlar için 15-90 dakikalık eşzamanlı izleyici paketleri. Şifresiz sipariş.',
    seo_description_en: 'Buy YouTube views: SEO-focused US views with 1-2 minute retention, plus 15-90 minute concurrent viewer packages for live streams. No password required.',
    content_tr: [
      '<h2>İzlenme neden tek başına yeterli değil?</h2>',
      '<p>YouTube\'un sıralama sinyalleri arasında ham görüntülenme sayısı değil, <strong>izlenme süresi (retention)</strong> ve tıklama oranı öne çıkar. Bu yüzden katalogdaki görüntülenme paketleri "SEO odaklı" olarak tanımlanır: izleyici videoda 1-2 dakika kalır ve trafik YouTube araması, göz atma özellikleri veya önerilen videolar üzerinden gelir. Sıfır saniyede düşen bir görüntülenme algoritmaya olumlu sinyal taşımaz.</p>',
      '<h2>Paket seçenekleri</h2>',
      '<ul>',
      '<li><strong>ABD görüntülenme, arama ve göz atma kaynaklı:</strong> 1.000-100.000 aralığı, 1-2 dakika izlenme süresi, günlük 100K hız. Videonun arama sonuçlarındaki performansını desteklemek için.</li>',
      '<li><strong>ABD görüntülenme, önerilen videolar kaynaklı:</strong> Aynı hacim ve süre; trafik "Önerilen" akışından (trend + rastgele) gelir.</li>',
      '<li><strong>Canlı yayın eşzamanlı izleyici:</strong> 15, 60 ve 90 dakikalık paketler; 10 adetten 5.000.000 adede kadar. Bazı paketlerde izleyici ve beğeni birlikte gelir.</li>',
      '<li><strong>Yüksek kalite eşzamanlı izleyici:</strong> 0-15 dakika başlangıç, süper hızlı teslimat.</li>',
      '</ul>',
      '<h2>Canlı yayın paketlerinde dikkat</h2>',
      '<p>Canlı yayın izleyicisi siparişi verirken <strong>yayının açık olması zorunludur</strong>; kapalı yayına sipariş geçilemez. Bağlantı olarak izleme adresini girin (youtube.com/watch?v=... biçimi). İzleyiciler seçtiğiniz süre boyunca yayında eşzamanlı olarak tutulur; süre bitince sayı doğal olarak düşer, bu bir arıza değildir.</p>',
      '<h2>Garanti ve dürüst uyarı</h2>',
      '<blockquote>Görüntülenme paketlerinde yenileme garantisi yoktur ("Yenileme Yok" etiketi). YouTube zaman zaman görüntülenme sayılarını yeniden doğrular ve bir kısmını düşürebilir. Satın alınan görüntülenme, zayıf bir başlığı veya kapak görselini kurtarmaz: tıklama oranı düşükse algoritma videoyu yaymaz. Görüntülenmeyi başlangıç ivmesi olarak kullanın, tek strateji olarak değil.</blockquote>'
    ].join('\n'),
    content_en: [
      '<h2>Why views alone are not enough</h2>',
      '<p>Among YouTube\'s ranking signals, <strong>watch time (retention)</strong> and click-through rate matter more than raw view count. That is why the view packages in the catalogue are described as "SEO-focused": the viewer stays 1-2 minutes and traffic arrives through YouTube search, browse features or suggested videos. A view that drops at zero seconds carries no positive signal.</p>',
      '<h2>Package options</h2>',
      '<ul>',
      '<li><strong>US views from search and browse:</strong> 1,000-100,000 range, 1-2 minute retention, 100K per day. For supporting a video\'s performance in search results.</li>',
      '<li><strong>US views from suggested videos:</strong> same volume and retention; traffic comes from the Suggested feed (trending plus random).</li>',
      '<li><strong>Live stream concurrent viewers:</strong> 15, 60 and 90 minute packages, from 10 up to 5,000,000. Some packages deliver viewers and likes together.</li>',
      '<li><strong>High quality concurrent viewers:</strong> 0-15 minute start, super fast delivery.</li>',
      '</ul>',
      '<h2>Notes on live stream packages</h2>',
      '<p>The stream <strong>must be live</strong> when you place a live viewer order; orders cannot be queued for an offline stream. Submit the watch URL (youtube.com/watch?v=... format). Viewers are held concurrently for the period you choose; the count naturally falls when the period ends, which is not a fault.</p>',
      '<h2>Guarantees and an honest warning</h2>',
      '<blockquote>View packages carry no refill guarantee ("No Refill" tag). YouTube periodically revalidates view counts and may remove some. Purchased views will not rescue a weak title or thumbnail: if click-through is low the algorithm will not distribute the video. Use views as initial momentum, not as the whole strategy.</blockquote>'
    ].join('\n'),
    faq_tr: [
      { q: 'Görüntülenmeler izlenme süresi kazandırır mı?', a: 'Katalogdaki ABD görüntülenme paketleri 1-2 dakika izlenme süresiyle gelir; bu da toplam izlenme saatine katkı sağlar. Ancak Ortaklık Programı eşiği olan 4.000 saat için gereken hacim yüksektir, tek başına satın alınan görüntülenmeyle kapatmak gerçekçi değildir.' },
      { q: 'Canlı yayın izleyicisi ile normal görüntülenme farkı nedir?', a: 'Canlı yayın paketleri yayın sürerken eşzamanlı izleyici sayısını yükseltir ve seçilen süre boyunca (15, 60 veya 90 dakika) tutar. Normal görüntülenme ise yayınlanmış bir videonun izlenme sayısını artırır.' },
      { q: 'Sipariş sırasında yayının açık olması şart mı?', a: 'Evet. Canlı yayın izleyici hizmetlerinde yayın aktif değilse sipariş işlenemez. Yayına başladıktan sonra sipariş verin.' },
      { q: 'Görüntülenmeler düşer mi?', a: 'Görüntülenme paketleri "Yenileme Yok" etiketlidir. YouTube periyodik doğrulamalarda bir kısmını düşürebilir; bu durumda telafi yapılmaz.' }
    ],
    faq_en: [
      { q: 'Do these views build watch time?', a: 'The US view packages come with 1-2 minutes of retention, which does contribute to total watch hours. However the volume needed for the 4,000-hour Partner Program threshold is high and not realistically covered by purchased views alone.' },
      { q: 'Live viewers vs regular views?', a: 'Live packages raise the concurrent viewer count while the stream runs and hold it for the chosen period (15, 60 or 90 minutes). Regular views increase the view count of an already published video.' },
      { q: 'Must the stream be live when ordering?', a: 'Yes. Live viewer services cannot process an order if the stream is offline. Start the stream first, then order.' },
      { q: 'Will views drop?', a: 'View packages are tagged "No Refill". YouTube may remove some during periodic revalidation, and no compensation is issued in that case.' }
    ],
    related_blog_slugs: ['youtube-izlenme-suresi-artirmanin-yollari', 'youtube-shorts-izlenme-nasil-artirilir-abone-kazandiran-shorts-stratejisi-6186', 'youtube-video-seo-baslik-etiket-aciklama']
  })
];

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
