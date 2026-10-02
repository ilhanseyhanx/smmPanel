'use strict';

// TIKTOK TELAFI GARANTILI TAKIPCI SAYFASI — 30 Eyl 2026
//
// Kullanicinin yazdigi "TikTok telafi garantili takipci nedir? Takipci
// dususunde garanti nasil isler" yazisi satis sayfasi olarak yayinlanir.
// Metin korunmus, yalnizca SEO denetiminin isaretledigi eksikler tamamlanmistir:
//   - anahtar kelime H2 basliklarda + ilk 300 karakterde + %1 civari yogunluk
//   - iliskili kelimeler (yenileme garantisi, refill, takipci dususu, garanti
//     suresi, 30 gun garantili, bot temizligi, organik kayip, telafi talebi)
//   - ic baglantilar (TikTok satis sayfalari, blog yazilari, Siparislerim,
//     destek, iade politikasi)
//   - panelin GERCEK telafi isleyisi: Siparislerim > "Telafi Iste" dugmesi,
//     30 gun yenileme (kategori 239'daki #745 servisi), Standart paket kapsam disi
//
// KATEGORI: 239 (TikTok Takipci). Bulunamazsa tiktok-takipci-satin-al
// sayfasinin kategorileri devralinir.
//
// Kullanim: cd /var/www/smmjet && node scripts/seed-landing-page-tiktok-telafi.js
// Var olan slug'a DOKUNMAZ; sayfa TASLAK olarak olusur. Yayin:
//   node scripts/publish-landing-pages.js tiktok-telafi-garantili-takipci

const path = require('path');
const sqlite3 = require('sqlite3');
const { normalizePagePayload } = require('../utils/landingPages');
const { SAYFALAR } = require('../utils/pageMeta');

const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.join(__dirname, '..', 'database.sqlite');

const FAQ_COMMON_TR = [
  { q: 'Şifremi vermem gerekir mi?', a: 'Hayır. Yalnızca herkese açık TikTok profil bağlantısı istenir; hesabınıza asla giriş yapılmaz.' },
  { q: 'Hangi ödeme yöntemleri var?', a: 'Kredi/banka kartı, kripto para ve banka havalesi ile bakiye yükleyebilirsiniz; bakiye onaylanır onaylanmaz hesabınıza yansır.' },
  { q: 'Sipariş tamamlanmazsa ne olur?', a: '"İptal Aktif" etiketli hizmetlerde teslim edilmeyen kısım bakiyenize iade edilir. Diğer hizmetlerde destek ekibi sağlayıcıyla birlikte takip eder; iade koşulları İade Politikası sayfasında yazar.' }
];
const FAQ_COMMON_EN = [
  { q: 'Do I need to give my password?', a: 'No. Only a public TikTok profile link is required; nobody ever logs into your account.' },
  { q: 'Which payment methods are available?', a: 'Credit/debit card, cryptocurrency and bank transfer; the balance is credited as soon as the payment is confirmed.' },
  { q: 'What if the order does not complete?', a: 'On services tagged "Cancel Enabled" the undelivered part is refunded to your balance. For other services support follows up with the provider; refund terms are on the Refund Policy page.' }
];

const PAGE = {
  slug: 'tiktok-telafi-garantili-takipci',
  platform_key: 'tiktok',
  sort_order: 21,
  status: 'draft',
  category_ids: [239],
  _kaynak: ['tiktok-takipci-satin-al'],

  title_tr: 'TikTok Telafi Garantili Takipçi',
  title_en: 'TikTok Followers with Refill Guarantee',
  subtitle_tr: 'TikTok telafi garantili takipçi nedir, takipçi düşüşünde garanti nasıl işler? Bu sayfada 30 gün yenileme garantili TikTok takipçi paketini, telafi talebinin adımlarını ve garanti kapsamı dışında kalan durumları anlattık.',
  subtitle_en: 'What are TikTok followers with refill guarantee, and how does the guarantee work when followers drop? This page covers the 30-day refill package, the steps to request a refill and what the guarantee does not cover.',
  seo_title_tr: 'TikTok Telafi Garantili Takipçi Nedir? Garanti Nasıl İşler',
  seo_title_en: 'TikTok Followers with Refill Guarantee – How It Works',
  seo_description_tr: 'TikTok telafi garantili takipçi nedir, takipçi düşüşünde garanti nasıl işler? 30 gün yenileme garantili paket, telafi talebi adımları ve kapsam dışı durumlar.',
  seo_description_en: 'What are TikTok followers with refill guarantee and how does it work when followers drop? 30-day refill package, refill request steps and what is not covered.',
  cta_text_tr: 'Ücretsiz Hesap Oluştur',
  cta_text_en: 'Create a Free Account',

  steps_tr: [
    'Ücretsiz hesap oluşturun ve kart, kripto ya da havale ile bakiye yükleyin.',
    'Yukarıdaki tablodan "Garantili" rozetli TikTok takipçi paketini seçin.',
    'Herkese açık TikTok profil bağlantınızı ve miktarı girin; şifre istenmez.',
    'Sipariş anında başlar. 30 gün içinde düşüş olursa Siparişlerim sayfasındaki "Telafi İste" düğmesini kullanın.'
  ],
  steps_en: [
    'Create a free account and top up with card, crypto or bank transfer.',
    'Pick the TikTok follower package with the "Guaranteed" badge from the table above.',
    'Enter your public TikTok profile link and the quantity; no password needed.',
    'The order starts instantly. If followers drop within 30 days, use the "Request Refill" button on the My Orders page.'
  ],

  content_tr: `<p>TikTok telafi garantili takipçi nedir sorusu, hesabını büyütmek isteyen pek çok içerik üreticisinin ve markanın aklındaki ilk sorulardan biri. Takipçi sayısı bir gecede artabilir, ancak birkaç gün sonra aynı hızla düşebilir. Bu durum hem sosyal kanıtı zedeler hem de yapılan yatırımın boşa gitmesine yol açar. Telafi garantisi, tam olarak bu sorunu çözmek için ortaya çıkan bir hizmet güvencesidir: Belirli bir süre içinde kaybedilen takipçiler, satıcı tarafından ücretsiz olarak yeniden tamamlanır.</p>
<p>Ancak garantinin kapsamı, süresi ve işleyişi her sağlayıcıda farklıdır. Yanlış anlaşılan bir garanti maddesi, beklenmedik hayal kırıklıklarına neden olabilir. Türkiye'de bu hizmetleri sunan firmaların sayısı arttıkça, hangi vaadin gerçekçi olduğunu ayırt etmek de zorlaşıyor. Bu rehberde kavramı sade bir dille açıklıyor, takipçi düşüşünün nedenlerini ve garantinin adım adım nasıl işlediğini inceliyoruz. Ayrıca sipariş öncesi kontrol etmeniz gereken noktaları, sık yapılan hataları ve doğru sağlayıcıyı seçme ölçütlerini ele alıyoruz. Yukarıdaki tabloda <strong>Garantili</strong> rozeti taşıyan TikTok telafi garantili takipçi paketi 30 gün yenileme (refill) kapsamındadır; <strong>Standart</strong> rozetli paketle farkını aşağıda anlattık.</p>

<h2>TikTok Telafi Garantili Takipçi Nedir? Temel Kavramlar</h2>
<p>Telafi garantili takipçi, satın alınan takipçilerin belirli bir süre boyunca (çoğunlukla 30, 60 veya 90 gün) korunmasını taahhüt eden hizmet modelidir. Takipçi sayınız bu süre içinde sipariş edilen miktarın altına inerse, sağlayıcı aradaki farkı yeniden ekler. Bu sistem "yenileme garantisi" ya da "refill" olarak da anılır. Jet SMM Panel'deki TikTok telafi garantili takipçi paketinde garanti süresi 30 gündür ve bu süre servis adında açıkça yazar.</p>
<h3>Düşüş Neden Yaşanır?</h3>
<ul>
<li><strong>Platform temizlikleri:</strong> TikTok, şüpheli ve sahte hesapları periyodik olarak kaldırır (bot temizliği).</li>
<li><strong>Pasif hesaplar:</strong> Kalitesiz kaynaklı takipçiler zamanla silinir veya takibi bırakır.</li>
<li><strong>Kullanıcı kaynaklı ayrılmalar:</strong> Organik takipçiler de doğal olarak hesabı bırakabilir.</li>
</ul>
<h3>Garantinin Temel Mantığı</h3>
<p>Garanti, genellikle sipariş tamamlandıktan sonra başlar ve sadece sipariş edilen sayıyı esas alır. Organik olarak kazandığınız takipçiler hesaplamaya dahil edilmez. Bu nedenle sağlayıcının garanti süresini, kapsamını ve talep yöntemini yazılı olarak belirtmesi önemlidir. TikTok telafi garantili takipçi paketinin yanında garantisiz seçenekler için <a href="/tiktok-takipci-satin-al">TikTok takipçi satın al</a> sayfasına bakabilirsiniz.</p>

<h2>Telafi Garantili Takipçi Ne Demek? Garanti Süresi ve Kapsamı</h2>
<p>TikTok telafi garantili takipçi, satın alınan takipçilerin belirli bir süre içinde azalması durumunda hizmet sağlayıcının eksik kalan sayıyı ek ücret almadan yeniden tamamlaması anlamına gelir. Kısacası sorun basit: takipçi sayınız düşebilir. Çözüm ise bu düşüşün yazılı bir güvenceyle telafi edilmesidir.</p>
<h3>Garanti Nasıl İşler?</h3>
<ol>
<li><strong>Siparişi kaydedin:</strong> Sipariş tarihini, miktarı ve o günkü takipçi sayınızı not edin. Jet SMM Panel'de sipariş tarihi ve miktar <a href="/orders">Siparişlerim</a> sayfasında otomatik saklanır.</li>
<li><strong>Garanti süresini öğrenin:</strong> Genellikle 7, 30 veya 60 gün sunulur. "Ömür boyu" ifadesini mutlaka koşullarıyla okuyun. Bu sayfadaki garantili paket 30 gündür.</li>
<li><strong>Düşüşü ölçün:</strong> Sipariş sonrası sayınızı, organik kazanç ve kayıpları ayırarak karşılaştırın.</li>
<li><strong>Talep oluşturun:</strong> Sipariş numarası ve ekran görüntüsüyle destek ekibine başvurun. Panelde bunun kısa yolu, tamamlanan siparişin yanındaki <strong>Telafi İste</strong> düğmesidir.</li>
</ol>
<h3>Kapsam ve Sık Yapılan Hatalar</h3>
<ul>
<li>Hesabı gizli yapmak, kullanıcı adını değiştirmek veya hesabı kapatmak garantiyi çoğunlukla geçersiz kılar.</li>
<li>Garanti yalnızca satın alınan miktarı kapsar; organik takipçi kayıpları dahil değildir.</li>
<li>Kesin yüzde vaadi yoktur. Bazı düşüşler olağandır, bu yüzden koşullar yazılı olmalıdır.</li>
</ul>
<p>Türkiye'de alışveriş yapıyorsanız, 6502 sayılı Tüketicinin Korunması Hakkında Kanun kapsamındaki bilgilendirme haklarınızı hatırlayın. Ayrıca TikTok'un topluluk kurallarının yapay etkileşimi kısıtlayabileceğini göz önünde bulundurun; bu konuyu <a href="/blog/takipci-satin-alinca-hesap-kapanir-mi">takipçi satın alınca hesap kapanır mı</a> yazımızda ayrıntılı ele aldık.</p>

<h2>Garantili ve Garantisiz Takipçi Arasındaki Fark</h2>
<p>TikTok telafi garantili takipçi nedir sorusunun cevabı, bu iki hizmet arasındaki farkta yatar. Sorun şudur: Satın alınan takipçilerin bir kısmı zamanla silinen veya pasifleşen hesaplardan oluşabilir. Garantisiz hizmette bu kayıp tamamen size aittir. Garantili hizmette ise satıcı, belirli bir süre içinde yaşanan düşüşü yeniden tamamlamayı taahhüt eder.</p>
<h3>Temel Karşılaştırma</h3>
<ul>
<li><strong>Garantisiz (tabloda "Standart" rozeti):</strong> Fiyat genellikle daha düşüktür, ancak düşüş olursa ek teslimat yapılmaz.</li>
<li><strong>Garantili (tabloda "Garantili" rozeti):</strong> Fiyat biraz daha yüksektir, ancak belirlenen süre (bu sayfada 30 gün) boyunca düşen takipçi telafi edilir.</li>
</ul>
<h3>Seçerken Dikkat Edilecekler</h3>
<ul>
<li>Garanti süresinin açıkça yazıldığını kontrol edin.</li>
<li>Telafi talebinin nasıl yapılacağını öğrenin; çoğu satıcı sipariş numarası ister.</li>
<li>Hesabınızı gizli yapmamaya ve kullanıcı adını değiştirmemeye dikkat edin. Bu durumlar garantiyi geçersiz kılabilir.</li>
</ul>
<p>Sık yapılan hata, "ömür boyu garanti" gibi abartılı vaatlere güvenmektir. Tavsiyemiz, makul süreli ve şartları yazılı bir TikTok telafi garantili takipçi paketini tercih etmektir. Türkiye'de ödeme yaparken faturalı ve iletişim kanalı net bir satıcıyla çalışmak, olası uyuşmazlıkta tüketici haklarınızı kullanmanızı kolaylaştırır. Ayrıca TikTok'un platform kurallarını okumak da önemlidir; genel çerçeveyi <a href="/blog/takipci-satin-almak-guvenli-mi">takipçi satın almak güvenli mi</a> yazısında bulabilirsiniz.</p>

<h2>TikTok Takipçi Düşüşünün Nedenleri: Sorunu Doğru Teşhis Edin</h2>
<p>Telafi garantisinden yararlanmadan önce düşüşün nedenini anlamanız gerekir. TikTok telafi garantili takipçi hizmeti her kayıp türünü kapsamaz.</p>
<h3>1. Platformun Temizlik Dalgaları</h3>
<p>TikTok, sahte ve etkileşimsiz hesapları düzenli olarak siler. Bu temizlikte takipçi sayınız bir gecede belirgin biçimde düşebilir. Garanti tam olarak bu durum için tasarlanmıştır.</p>
<h3>2. Kalitesiz Hesaplardan Gelen Takipçiler</h3>
<p>Profil fotoğrafı ve videosu olmayan botlar zamanla silinir. Ucuz paketlerde bu oran yüksek olur.</p>
<h3>3. Organik Kayıplar</h3>
<p>İçerik tarzını değiştirmek, uzun süre paylaşım yapmamak veya ilgisiz içerik üretmek, gerçek takipçilerin takibi bırakmasına yol açar. Bu kayıplar garanti kapsamında değildir. İçeriğin dağıtımını neyin belirlediğini <a href="/blog/tiktok-algoritmasi-nasil-calisir">TikTok algoritması nasıl çalışır</a> yazımızda anlattık.</p>
<h3>4. Hesap Kısıtlamaları</h3>
<p>Topluluk kurallarını ihlal eden hesaplarda görünürlük azalır. Bu durum takipçi kaybını hızlandırabilir.</p>
<h3>Sık Yapılan Hata</h3>
<ul>
<li>Her düşüşü garanti kapsamında sanmak.</li>
<li>Düşüşü tarih ve sayı olarak kaydetmeden destek talebi açmak.</li>
</ul>
<p><strong>İpucu:</strong> Sipariş günündeki takipçi sayınızın ekran görüntüsünü saklayın. Telafi talebinde bu kayıt işinizi kolaylaştırır.</p>

<h2>Takipçi Düşüşü Neden Yaşanır? Bot Temizliği ve Organik Kayıplar</h2>
<p>TikTok telafi garantili takipçi hizmetlerini anlamak için önce düşüşün nedenlerini bilmek gerekir. Sorun genellikle tek bir kaynaktan çıkmaz.</p>
<h3>1. Platformun Bot ve Spam Temizliği</h3>
<p>TikTok, sahte ve etkileşimsiz hesapları düzenli aralıklarla tespit edip kaldırır. Bir hesap silindiğinde sizi takip eden sayısı da otomatik düşer. Düşük kaliteli kaynaklardan gelen takipçilerde bu kayıp daha sık görülür. Telafi garantisinin asıl çıkış noktası da budur.</p>
<h3>2. Organik Kayıplar</h3>
<ul>
<li><strong>Takipten çıkma:</strong> İçerik beklentiyi karşılamadığında kullanıcılar takibi bırakır.</li>
<li><strong>Pasif hesaplar:</strong> Kullanıcıların kendi hesaplarını kapatması ya da dondurması sayıyı azaltır.</li>
<li><strong>Tutarsız paylaşım:</strong> Uzun süre içerik üretilmediğinde takipçi kaybı hızlanır. Düzenli üretim planı için <a href="/blog/tiktok-hesap-buyutme-stratejileri-2026">TikTok hesap büyütme stratejileri</a> yazısına bakın.</li>
</ul>
<h3>3. Sık Yapılan Yanlış Anlama</h3>
<p>Her düşüş garanti kapsamına girmez. Kendi isteğiyle takibi bırakan gerçek kullanıcılar çoğu zaman kapsam dışıdır. Bu yüzden sağlayıcının garanti süresini ve koşullarını satın almadan önce yazılı olarak okuyun.</p>

<h2>Takipçi Düşüşünü Tespit Etme: Başlangıç ve İleri Seviye Yöntemler</h2>
<p>TikTok telafi garantili takipçi paketinden yararlanmanın ilk koşulu, düşüşü zamanında fark etmektir. Çoğu kullanıcı kaybı günler sonra görür ve garanti süresinin önemli kısmını kaçırır. Sorun basit: TikTok takipçi sayısını anlık değiştirir, ancak değişimi kayda almaz.</p>
<h3>Adım 1: Başlangıç Seviyesi – Manuel Kayıt</h3>
<ul>
<li><strong>Sipariş günü sayıyı not edin:</strong> Teslimat sonrası takipçi sayısının ekran görüntüsünü alın.</li>
<li><strong>Haftalık kontrol yapın:</strong> Aynı saatte profili açıp sayıyı bir tabloya işleyin.</li>
<li><strong>Yüzdeyi hesaplayın:</strong> Kayıp oranı, (başlangıç − güncel) ÷ başlangıç formülüyle bulunur.</li>
</ul>
<h3>Adım 2: İleri Seviye – Analitik Araçlar</h3>
<ul>
<li><strong>TikTok Analizler:</strong> Hesabınızı Pro'ya geçirip takipçi trendi sekmesinden günlük artış ve azalışı izleyin.</li>
<li><strong>Üçüncü taraf takip araçları:</strong> Günlük anlık görüntü alan servislerle kaybın hangi gün başladığını belirleyin.</li>
<li><strong>Organik ve satın alınan ayrımı:</strong> Kampanya dönemindeki organik kazanımı hesaba katarak net kaybı bulun.</li>
</ul>
<h3>Sık Yapılan Hata</h3>
<p>Kullanıcılar küçük dalgalanmaları düşüş sanır. Normal dalgalanma genellikle yüzde 1–3 aralığındadır. Garanti talebi için sağlayıcınızın belirlediği eşiği ve süreyi önceden öğrenin. Aynı ölçüm yöntemini Instagram için <a href="/blog/instagram-takipci-dususu-nedenleri-ve-cozumleri">Instagram takipçi düşüşü</a> yazımızda anlattık.</p>

<h2>Takipçi Düşüşünde Garanti Nasıl İşler? TikTok Telafi Garantili Takipçi Süreci</h2>
<p>Sorun basit: Aldığınız takipçilerin bir kısmı günler içinde kaybolabilir. TikTok telafi garantili takipçi hizmeti bu durumda devreye girer. Süreç genellikle şöyle işler:</p>
<ol>
<li><strong>Sipariş ve kayıt:</strong> Sipariş numaranızı, teslim tarihini ve takipçi sayısını saklayın.</li>
<li><strong>Başlangıç sayısını not edin:</strong> Teslimattan hemen sonra profilinizin ekran görüntüsünü alın.</li>
<li><strong>Düşüşü izleyin:</strong> Garanti süresi (çoğunlukla 30 ila 90 gün; bu sayfadaki pakette 30 gün yenileme garantisi) boyunca sayıyı düzenli kontrol edin.</li>
<li><strong>Talep oluşturun:</strong> Düşüş olursa sipariş numaranız ve ekran görüntüleriyle destek ekibine başvurun. Jet SMM Panel'de <a href="/orders">Siparişlerim</a> sayfasındaki <strong>Telafi İste</strong> düğmesine basmanız yeterlidir; ekran görüntüsü gerekmez.</li>
<li><strong>Doğrulama ve telafi:</strong> Talep sağlayıcıya iletilir, düşüş doğrulanır ve eksik takipçi ücretsiz tamamlanır. Telafi durumu aynı sayfada görünür.</li>
</ol>
<h3>Sık Yapılan Hatalar</h3>
<ul>
<li>Garanti koşullarını okumadan sipariş vermek.</li>
<li>Hesabı gizli yapmak veya kullanıcı adını değiştirmek; bu durum garantiyi çoğu zaman geçersiz kılar.</li>
<li>Süre dolduktan sonra talep açmaya çalışmak.</li>
</ul>
<p><strong>Unutmayın:</strong> Garanti yalnızca kaybı telafi eder; hesabınızın güvenliğini sağlamaz. Türkiye'de alışveriş yapıyorsanız satıcının ödeme güvenliğini ve iade koşullarını da mutlaka kontrol edin; bizim koşullarımız <a href="/refund">İade Politikası</a> sayfasında yazar.</p>

<h2>Jet SMM Panel'de TikTok Telafi Garantili Takipçi Nasıl Çalışır?</h2>
<p>Bu sayfadaki tabloda iki tür TikTok takipçi paketi görürsünüz. <strong>Garantili</strong> rozetli TikTok telafi garantili takipçi paketi 30 gün yenileme garantisi kapsamındadır; <strong>Standart</strong> rozetli paket daha uygun fiyatlıdır ancak düşüş yaşanırsa telafi yapılmaz. Rozet, servis adından bağımsız olarak servis bazında belirlenir; garanti kapsamını yalnızca rozete bakarak anlayabilirsiniz.</p>
<ul>
<li><strong>Süre:</strong> Sipariş tamamlandıktan sonra 30 gün. Süre içinde düşüş olursa telafi talebi açılabilir.</li>
<li><strong>Kapsam:</strong> Yalnızca sipariş edilen adet. Organik takipçi kayıpları ve sipariş öncesi düşüşler dahil değildir.</li>
<li><strong>Talep:</strong> <a href="/orders">Siparişlerim</a> sayfasında, tamamlanan siparişin yanındaki <strong>Telafi İste</strong> düğmesi. Talep sağlayıcıya otomatik iletilir; aynı sipariş için bir talep işlemdeyken ikincisi açılmaz. Sorun yaşarsanız "Telafi / Düşüş Bildirimi" kategorisinde <a href="/tickets">destek talebi</a> açın.</li>
<li><strong>Şartlar:</strong> Profil herkese açık kalmalı, kullanıcı adı değişmemeli ve aynı hesaba eş zamanlı başka bir takipçi siparişi verilmemeli.</li>
<li><strong>Şifre:</strong> İstenmez. Sipariş yalnızca herkese açık profil bağlantısıyla verilir; ayrıntı için <a href="/blog/sifresiz-takipci-nasil-alinir">şifresiz takipçi rehberi</a>.</li>
</ul>
<p>Takipçiyi beğeni ve izlenme ile dengelemek isterseniz <a href="/tiktok-begeni-satin-al">TikTok beğeni satın al</a> ve <a href="/tiktok-izlenme-satin-al">TikTok izlenme satın al</a> sayfalarına bakabilirsiniz. TikTok hizmetlerinin tamamının giriş noktası <a href="/tiktok-smm-panel">TikTok SMM panelidir</a>.</p>

<h2>Telafi Garantisi Nasıl Talep Edilir? Destek Süreci ve Sık Hatalar</h2>
<p>TikTok telafi garantili takipçi hizmetinde düşüş yaşadığınızda sorun genellikle talebin yanlış zamanda ya da eksik bilgiyle iletilmesidir. Süreci adım adım izleyin:</p>
<ol>
<li><strong>Düşüşü belgeleyin:</strong> Sipariş tarihini, sipariş numarasını ve takipçi sayınızın önce/sonra ekran görüntülerini kaydedin.</li>
<li><strong>Garanti süresini kontrol edin:</strong> Çoğu sağlayıcı 30 gün ile ömür boyu arasında değişen süreler sunar. Süre dolmadan başvurun.</li>
<li><strong>Destek kanalına yazın:</strong> Canlı destek, e-posta veya panel içi talep formunu kullanın. Kullanıcı adınızı ve düşen miktarı net belirtin. Jet SMM Panel'de önce <strong>Telafi İste</strong> düğmesini deneyin; destek talebi ikinci yoldur.</li>
<li><strong>Yanıtı bekleyin:</strong> Telafi sağlayıcı tarafında işleme alınır; çoğu durumda 24-72 saat içinde tamamlanır, ancak bu süre bir taahhüt değildir.</li>
</ol>
<h3>Sık Yapılan Hatalar</h3>
<ul>
<li>Hesabı gizli veya kapalı hale getirmek; bu durum garantiyi çoğunlukla geçersiz kılar.</li>
<li>Kullanıcı adını sipariş sonrası değiştirmek.</li>
<li>Aynı hesaba başka bir sağlayıcıdan eş zamanlı takipçi almak.</li>
<li>Düşüşü haftalarca fark etmeyip süreyi kaçırmak.</li>
</ul>
<p>Türkiye'de alışveriş yapıyorsanız, garanti koşullarının satıştan önce yazılı olarak sunulması tüketici hukuku açısından da önemlidir. Bu koşulları mutlaka saklayın.</p>

<h2>Garanti Konusunda Dürüst Uyarı</h2>
<blockquote>Bu sayfadaki TikTok telafi garantili takipçi paketi 30 gün yenileme kapsamındadır; Standart paket kapsam dışıdır. Kaynak kalitesine ilişkin ifadeler sağlayıcının beyanıdır. TikTok, geçersiz saydığı hesapları geriye dönük olarak kaldırabilir; garanti süresi dışındaki ve organik kaynaklı düşüşler telafi edilmez. Keşfet'e çıkma, izlenme artışı veya gelir konusunda hiçbir sonuç taahhüt edilmez.</blockquote>

<h2>Sonuç</h2>
<p>TikTok telafi garantili takipçi, takipçi düşüşlerine karşı sizi koruyan ancak koşulları olan bir güvencedir. Garantinin süresini, kapsamını ve destek sürecini satın almadan önce öğrenmek, sonradan yaşanacak sorunların büyük bölümünü önler. Düşüş yaşadığınızda belgeleme yapmak, süre dolmadan talep oluşturmak ve hesap ayarlarını değiştirmemek telafi almanın temel şartlarıdır.</p>
<p>Unutmayın: kalıcı büyüme, yalnızca sayıya değil, kaliteli içeriğe ve gerçek etkileşime dayanır. Takipçi hizmetini bu stratejiyi destekleyen bir araç olarak görün; stratejinin bütününü <a href="/blog/sosyal-medya-buyume-rehberi">sosyal medya büyüme rehberinde</a> topladık.</p>
<p>Şimdi harekete geçin: mevcut sağlayıcınızın garanti şartlarını gözden geçirin, sipariş kayıtlarınızı düzenli saklayın ve bir sonraki alımınızda yalnızca şeffaf koşullar sunan, ulaşılabilir destek veren TikTok telafi garantili takipçi hizmetlerini tercih edin.</p>`,

  content_en: `<p>"What are TikTok followers with refill guarantee?" is one of the first questions creators and brands ask when they want to grow an account. A follower count can jump overnight and drop just as fast a few days later. That hurts social proof and wastes the money spent. A refill guarantee exists to solve exactly this problem: followers lost within a set period are replaced by the seller free of charge.</p>
<p>The scope, duration and mechanics of the guarantee differ from one provider to the next, though. A misread guarantee clause leads to unexpected disappointment, and as the number of providers grows it gets harder to tell which promise is realistic. This guide explains the concept in plain language, looks at why followers drop and walks through how the guarantee works step by step. It also covers what to check before ordering, common mistakes and how to pick the right provider. In the table above, the package with the <strong>Guaranteed</strong> badge is the TikTok followers with refill guarantee package and carries 30-day refill cover; the <strong>Standard</strong> package is explained below.</p>

<h2>What Are TikTok Followers with Refill Guarantee? Core Concepts</h2>
<p>Refill-guaranteed followers are a service model where the purchased followers are protected for a set period (usually 30, 60 or 90 days). If your count falls below the ordered amount within that window, the provider adds the difference back. The system is also called a "refill" or "replacement guarantee". For the TikTok followers with refill guarantee package on Jet SMM Panel the period is 30 days, and it is written in the service name.</p>
<h3>Why Do Drops Happen?</h3>
<ul>
<li><strong>Platform clean-ups:</strong> TikTok periodically removes suspicious and fake accounts (bot purges).</li>
<li><strong>Inactive accounts:</strong> Followers from low-quality sources get deleted or unfollow over time.</li>
<li><strong>User-driven departures:</strong> Organic followers can naturally leave as well.</li>
</ul>
<h3>The Basic Logic of the Guarantee</h3>
<p>The guarantee usually starts once the order completes and only counts the ordered quantity. Followers you gained organically are not part of the calculation. That is why the provider should state the guarantee period, scope and request method in writing. For packages without a guarantee and other options see <a href="/tiktok-takipci-satin-al">buy TikTok followers</a>.</p>

<h2>What Does Refill Guarantee Mean? Period and Scope</h2>
<p>TikTok followers with refill guarantee means that if the purchased followers decrease within a set period, the provider tops the missing number back up at no extra cost. In short, the problem is simple: your follower count can drop. The solution is a written assurance that the drop will be compensated.</p>
<h3>How Does the Guarantee Work?</h3>
<ol>
<li><strong>Record the order:</strong> Note the order date, quantity and your follower count that day. On Jet SMM Panel the order date and quantity are stored automatically on the <a href="/orders">My Orders</a> page.</li>
<li><strong>Learn the guarantee period:</strong> Usually 7, 30 or 60 days. Always read the conditions behind any "lifetime" claim. The guaranteed package on this page is 30 days.</li>
<li><strong>Measure the drop:</strong> Compare your post-order count while separating organic gains and losses.</li>
<li><strong>Open a request:</strong> Contact support with the order number and a screenshot. On the panel the shortcut is the <strong>Request Refill</strong> button next to the completed order.</li>
</ol>
<h3>Scope and Common Mistakes</h3>
<ul>
<li>Making the account private, changing the username or closing the account usually voids the guarantee.</li>
<li>The guarantee covers only the purchased quantity; organic follower losses are not included.</li>
<li>There is no fixed percentage promise. Some drop is normal, which is why the conditions must be in writing.</li>
</ul>
<p>If you shop in Turkey, remember your information rights under Consumer Protection Law No. 6502. Also keep in mind that TikTok's community guidelines may restrict artificial engagement; we covered this in <a href="/blog/takipci-satin-alinca-hesap-kapanir-mi">does buying followers get your account banned</a>.</p>

<h2>The Difference Between Guaranteed and Non-Guaranteed Followers</h2>
<p>The answer to "what are TikTok followers with refill guarantee" lies in the difference between these two services. The problem: part of the purchased followers may come from accounts that get deleted or go inactive over time. With a non-guaranteed service that loss is entirely yours. With a guaranteed service the seller commits to replacing the drop within a set period.</p>
<h3>Basic Comparison</h3>
<ul>
<li><strong>Non-guaranteed ("Standard" badge in the table):</strong> Usually cheaper, but no extra delivery if followers drop.</li>
<li><strong>Guaranteed ("Guaranteed" badge in the table):</strong> Slightly more expensive, but dropped followers are replaced during the set period (30 days on this page).</li>
</ul>
<h3>What to Check When Choosing</h3>
<ul>
<li>Check that the guarantee period is stated clearly.</li>
<li>Learn how a refill request is made; most sellers ask for the order number.</li>
<li>Do not make your account private or change the username; both can void the guarantee.</li>
</ul>
<p>The common mistake is trusting exaggerated promises such as "lifetime guarantee". Our advice is to choose a TikTok followers with refill guarantee package with a reasonable period and written terms. Working with an invoiced seller with a clear contact channel makes it easier to use your consumer rights in a dispute. Reading TikTok's platform rules matters too; the general frame is in <a href="/blog/takipci-satin-almak-guvenli-mi">is buying followers safe</a>.</p>

<h2>Why TikTok Followers Drop: Diagnose the Problem Correctly</h2>
<p>Before using a refill guarantee you need to understand why the drop happened. A TikTok followers with refill guarantee service does not cover every type of loss.</p>
<h3>1. Platform Clean-up Waves</h3>
<p>TikTok regularly deletes fake and non-engaging accounts. During such a purge your follower count can fall noticeably overnight. The guarantee is designed precisely for this case.</p>
<h3>2. Followers from Low-Quality Accounts</h3>
<p>Bots without a profile photo or videos get deleted over time. The share is higher in cheap packages.</p>
<h3>3. Organic Losses</h3>
<p>Changing your content style, not posting for a long time or producing irrelevant content makes real followers leave. These losses are not covered. We explained what drives distribution in <a href="/blog/tiktok-algoritmasi-nasil-calisir">how the TikTok algorithm works</a>.</p>
<h3>4. Account Restrictions</h3>
<p>Accounts that violate community guidelines get less visibility, which can speed up follower loss.</p>
<h3>Common Mistake</h3>
<ul>
<li>Assuming every drop is covered by the guarantee.</li>
<li>Opening a support request without recording the drop by date and number.</li>
</ul>
<p><strong>Tip:</strong> Keep a screenshot of your follower count on the order day. It makes a refill request much easier.</p>

<h2>Why Do Followers Drop? Bot Purges and Organic Losses</h2>
<p>To understand TikTok followers with refill guarantee services you first need to know why drops occur. The problem rarely comes from a single source.</p>
<h3>1. The Platform's Bot and Spam Clean-up</h3>
<p>TikTok detects and removes fake and non-engaging accounts at regular intervals. When an account is deleted, the number of people following you drops automatically. Followers from low-quality sources are lost more often. This is the very reason refill guarantees exist.</p>
<h3>2. Organic Losses</h3>
<ul>
<li><strong>Unfollows:</strong> Users leave when content does not meet expectations.</li>
<li><strong>Inactive accounts:</strong> Users closing or freezing their own accounts reduces the count.</li>
<li><strong>Inconsistent posting:</strong> Follower loss accelerates when no content is produced for a long time. For a regular production plan see <a href="/blog/tiktok-hesap-buyutme-stratejileri-2026">TikTok account growth strategies</a>.</li>
</ul>
<h3>3. A Common Misunderstanding</h3>
<p>Not every drop falls under the guarantee. Real users who unfollow by choice are usually out of scope. So read the provider's guarantee period and conditions in writing before you buy.</p>

<h2>Detecting Follower Drops: Beginner and Advanced Methods</h2>
<p>The first condition for using a refill guarantee is noticing the drop in time. Most users see the loss days later and miss a large part of the guarantee window. The problem is simple: TikTok changes the follower count instantly but does not log the change.</p>
<h3>Step 1: Beginner Level – Manual Record</h3>
<ul>
<li><strong>Note the count on order day:</strong> Take a screenshot of your follower count after delivery.</li>
<li><strong>Check weekly:</strong> Open the profile at the same time each week and log the number in a table.</li>
<li><strong>Calculate the percentage:</strong> Loss rate = (starting − current) ÷ starting.</li>
</ul>
<h3>Step 2: Advanced Level – Analytics Tools</h3>
<ul>
<li><strong>TikTok Analytics:</strong> Switch to a Pro account and watch daily gains and losses in the follower trend tab.</li>
<li><strong>Third-party trackers:</strong> Use services that take daily snapshots to pinpoint the day the loss began.</li>
<li><strong>Organic vs purchased split:</strong> Account for organic gains during the campaign period to find the net loss.</li>
</ul>
<h3>Common Mistake</h3>
<p>Users mistake small fluctuations for a drop. Normal fluctuation is usually in the 1–3 percent range. Learn the threshold and window your provider sets for a guarantee request in advance. We described the same measurement method for Instagram in <a href="/blog/instagram-takipci-dususu-nedenleri-ve-cozumleri">Instagram follower drop</a>.</p>

<h2>How Does the Guarantee Work When Followers Drop? The Refill Process</h2>
<p>The problem is simple: some of the followers you bought can disappear within days. A TikTok followers with refill guarantee service kicks in at that point. The process usually runs like this:</p>
<ol>
<li><strong>Order and record:</strong> Keep your order number, delivery date and follower count.</li>
<li><strong>Note the starting count:</strong> Take a screenshot of your profile right after delivery.</li>
<li><strong>Watch the drop:</strong> Check the count regularly during the guarantee period (usually 30 to 90 days; 30 days for the package on this page).</li>
<li><strong>Open a request:</strong> If followers drop, contact support with your order number and screenshots. On Jet SMM Panel you only need to press the <strong>Request Refill</strong> button on the <a href="/orders">My Orders</a> page; no screenshot is required.</li>
<li><strong>Verification and refill:</strong> The request is forwarded to the provider, the drop is verified and the missing followers are replaced free of charge. The refill status is shown on the same page.</li>
</ol>
<h3>Common Mistakes</h3>
<ul>
<li>Ordering without reading the guarantee conditions.</li>
<li>Making the account private or changing the username; this usually voids the guarantee.</li>
<li>Trying to open a request after the period has expired.</li>
</ul>
<p><strong>Remember:</strong> The guarantee only compensates the loss; it does not secure your account. Always check the seller's payment security and refund terms as well; ours are on the <a href="/refund">Refund Policy</a> page.</p>

<h2>How TikTok Followers with Refill Guarantee Work on Jet SMM Panel</h2>
<p>You will see two kinds of TikTok follower packages in the table on this page. The <strong>Guaranteed</strong> badge means 30-day refill cover; the <strong>Standard</strong> badge is cheaper but drops are not compensated. The badge is set per service regardless of the service name, so the badge alone tells you whether the guarantee applies.</p>
<ul>
<li><strong>Period:</strong> 30 days after the order completes. A refill request can be opened for any drop within that window.</li>
<li><strong>Scope:</strong> Only the ordered quantity. Organic follower losses and drops before the order are not included.</li>
<li><strong>Request:</strong> The <strong>Request Refill</strong> button next to the completed order on the <a href="/orders">My Orders</a> page. The request is forwarded to the provider automatically; a second request cannot be opened while one is in progress. If you run into a problem, open a <a href="/tickets">support ticket</a> in the "Refill / Drop Report" category.</li>
<li><strong>Conditions:</strong> The profile must stay public, the username must not change and no other follower order should run on the same account at the same time.</li>
<li><strong>Password:</strong> Never required. Orders are placed with a public profile link only; details are in the <a href="/blog/sifresiz-takipci-nasil-alinir">password-free followers guide</a>.</li>
</ul>
<p>To balance followers with likes and views, see <a href="/tiktok-begeni-satin-al">buy TikTok likes</a> and <a href="/tiktok-izlenme-satin-al">buy TikTok views</a>. The entry point to every TikTok service is the <a href="/tiktok-smm-panel">TikTok SMM panel</a>.</p>

<h2>How to Request a Refill: Support Process and Common Errors</h2>
<p>When followers drop on a TikTok followers with refill guarantee service, the usual problem is a request sent at the wrong time or with missing information. Follow the process step by step:</p>
<ol>
<li><strong>Document the drop:</strong> Save the order date, order number and before/after screenshots of your follower count.</li>
<li><strong>Check the guarantee period:</strong> Most providers offer anything from 30 days to lifetime. Apply before the period ends.</li>
<li><strong>Write to the support channel:</strong> Use live chat, e-mail or the in-panel request form. State your username and the amount lost clearly. On Jet SMM Panel try the <strong>Request Refill</strong> button first; a support ticket is the second route.</li>
<li><strong>Wait for the response:</strong> The refill is processed on the provider side; in most cases it completes within 24-72 hours, but that time frame is not a commitment.</li>
</ol>
<h3>Common Mistakes</h3>
<ul>
<li>Making the account private or closed; this usually voids the guarantee.</li>
<li>Changing the username after the order.</li>
<li>Buying followers from another provider for the same account at the same time.</li>
<li>Not noticing the drop for weeks and missing the window.</li>
</ul>
<p>If you shop in Turkey, having the guarantee terms presented in writing before the sale matters under consumer law as well. Keep those terms.</p>

<h2>An Honest Note on Guarantees</h2>
<blockquote>The TikTok followers with refill guarantee package on this page carries 30-day refill cover; the Standard package does not. Statements about source quality are the provider's. TikTok may retroactively remove accounts it deems invalid; drops outside the guarantee period and organic losses are not compensated. No outcome is promised regarding the For You feed, view growth or income.</blockquote>

<h2>Conclusion</h2>
<p>TikTok followers with refill guarantee is a safeguard against follower drops, but it comes with conditions. Learning the guarantee period, scope and support process before buying prevents most later problems. Documenting the drop, opening the request before the period ends and not changing account settings are the basic conditions for getting a refill.</p>
<p>Remember: lasting growth rests on quality content and real engagement, not just the number. Treat a follower service as a tool that supports that strategy; we collected the whole strategy in the <a href="/blog/sosyal-medya-buyume-rehberi">social media growth guide</a>.</p>
<p>Act now: review your current provider's guarantee terms, keep your order records in order, and on your next purchase choose only TikTok followers with refill guarantee services that offer transparent terms and reachable support.</p>`,

  faq_tr: [
    { q: 'TikTok telafi garantili takipçi nedir?', a: 'Satın alınan takipçilerin garanti süresi boyunca (bu sayfadaki pakette 30 gün) korunmasını, düşüş olursa eksik sayının ücretsiz tamamlanmasını taahhüt eden hizmettir. Yenileme ya da refill garantisi olarak da bilinir; tabloda "Garantili" rozetiyle gösterilir.' },
    { q: 'Takipçi düşüşünde garanti nasıl işler?', a: 'Sipariş tamamlandıktan sonra 30 gün içinde takipçi sayınız sipariş edilen miktarın altına inerse Siparişlerim sayfasındaki "Telafi İste" düğmesiyle talep açarsınız. Talep sağlayıcıya iletilir, düşüş doğrulanır ve eksik takipçi ücretsiz tamamlanır.' },
    { q: 'Garanti hangi düşüşleri kapsamaz?', a: 'Organik takipçilerin kendi isteğiyle ayrılması, sipariş öncesi kayıplar, garanti süresi dolduktan sonraki düşüşler ve hesabın gizlenmesi ya da kullanıcı adının değiştirilmesi sonrası yaşanan kayıplar kapsam dışıdır.' },
    { q: 'Garantili ve Standart paket arasındaki fark nedir?', a: '"Garantili" rozetli paket 30 gün yenileme kapsamındadır ve biraz daha yüksek fiyatlıdır. "Standart" rozetli paket daha uygundur ancak düşüş yaşanırsa telafi yapılmaz.' },
    { q: 'Telafi için ekran görüntüsü göndermem gerekir mi?', a: 'Hayır. Sipariş kaydı panelde tutulur ve "Telafi İste" düğmesi yeterlidir. Yine de sipariş günündeki takipçi sayınızı not etmek, olası bir uyuşmazlıkta işinizi kolaylaştırır.' }
  ],
  faq_en: [
    { q: 'What are TikTok followers with refill guarantee?', a: 'A service where the purchased followers are protected during the guarantee period (30 days for the package on this page) and the missing number is replaced free of charge if they drop. It is also called a refill or replacement guarantee and is shown with the "Guaranteed" badge in the table.' },
    { q: 'How does the guarantee work when followers drop?', a: 'If your follower count falls below the ordered amount within 30 days after the order completes, you open a request with the "Request Refill" button on the My Orders page. The request is forwarded to the provider, the drop is verified and the missing followers are replaced free of charge.' },
    { q: 'Which drops are not covered?', a: 'Organic followers leaving by choice, losses before the order, drops after the guarantee period ends, and losses after the account is made private or the username is changed are out of scope.' },
    { q: 'What is the difference between the Guaranteed and Standard packages?', a: 'The "Guaranteed" package carries 30-day refill cover and costs slightly more. The "Standard" package is cheaper, but drops are not compensated.' },
    { q: 'Do I need to send a screenshot for a refill?', a: 'No. The order record is kept in the panel and the "Request Refill" button is enough. Still, noting your follower count on the order day makes any dispute easier to resolve.' }
  ],
  related_blog_slugs: ['refill-yenileme-nedir-takipci-neden-duser', 'tiktok-hesap-buyutme-stratejileri-2026', 'takipci-satin-almak-guvenli-mi', 'takipci-satin-alinca-hesap-kapanir-mi']
};

PAGE.faq_tr = [...PAGE.faq_tr, ...FAQ_COMMON_TR];
PAGE.faq_en = [...PAGE.faq_en, ...FAQ_COMMON_EN];

module.exports = { PAGE };

// Icerikteki ic baglantilarin hedefini dogrular (yayinda satis sayfasi,
// yayinda blog yazisi veya SPA rotasi). Uyari basar, durdurmaz.
async function checkInternalLinks(all, html) {
  const hrefs = [...new Set([...String(html).matchAll(/href="([^"]+)"/g)].map(m => m[1]).filter(h => h.startsWith('/')))];
  const sorunlar = [];
  for (const href of hrefs) {
    const yol = href.slice(1).split(/[?#]/)[0];
    if (yol.startsWith('blog/')) {
      const slug = yol.slice(5);
      const row = (await all("SELECT status FROM blog_posts WHERE slug = ?", [slug]))[0];
      if (!row) sorunlar.push(href + ' (blog yazisi YOK)');
      else if (row.status !== 'published') sorunlar.push(href + ' (blog yazisi ' + row.status + ')');
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(SAYFALAR, yol)) continue;
    const lp = (await all("SELECT status FROM landing_pages WHERE slug = ?", [yol]))[0];
    if (!lp) sorunlar.push(href + ' (satis sayfasi YOK)');
    else if (lp.status !== 'published') sorunlar.push(href + ' (satis sayfasi ' + lp.status + ')');
  }
  return { toplam: hrefs.length, sorunlar };
}

if (require.main === module) {
  (async () => {
    const db = new sqlite3.Database(dbPath);
    db.configure('busyTimeout', 5000);
    const get = (q, prm = []) => new Promise((r, j) => db.get(q, prm, (e, row) => e ? j(e) : r(row)));
    const all = (q, prm = []) => new Promise((r, j) => db.all(q, prm, (e, rows) => e ? j(e) : r(rows)));
    const run = (q, prm = []) => new Promise((r, j) => db.run(q, prm, function (e) { e ? j(e) : r(this); }));

    const tablo = await get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'landing_pages'");
    if (!tablo) { console.error('landing_pages tablosu yok: once sunucuyu yeni kodla baslat.'); process.exit(1); }

    if (await get('SELECT id FROM landing_pages WHERE slug = ?', [PAGE.slug])) {
      console.log('atlandi (zaten var): ' + PAGE.slug);
      db.close(); return;
    }

    const { _kaynak, ...sayfa } = PAGE;
    // Kategori 239 aktif servisli mi? Degilse kaynak sayfanin kategorileri.
    let ids = [];
    for (const cid of sayfa.category_ids) {
      const row = await get('SELECT COUNT(*) n FROM services WHERE category_id = ? AND status = 1', [cid]);
      if (row && row.n > 0) ids.push(cid);
    }
    let kaynakAdi = 'sabit kategori';
    if (!ids.length) {
      for (const s of _kaynak) {
        const row = await get('SELECT category_ids FROM landing_pages WHERE slug = ?', [s]);
        if (!row) continue;
        try { ids.push(...JSON.parse(row.category_ids || '[]').filter(n => Number.isInteger(n) && n > 0)); } catch { /* yok say */ }
      }
      ids = [...new Set(ids)];
      kaynakAdi = 'kaynak sayfa';
    }
    if (!ids.length) { console.error('ATLANDI (kategori yok): ' + sayfa.slug); db.close(); process.exit(1); }

    for (const [dil, html] of [['TR', sayfa.content_tr], ['EN', sayfa.content_en]]) {
      const r = await checkInternalLinks(all, html);
      console.log('ic baglanti (' + dil + '): ' + r.toplam + ' adet' + (r.sorunlar.length ? ', SORUNLU: ' + r.sorunlar.join(', ') : ', hepsi gecerli'));
    }

    const sonuc = normalizePagePayload({ ...sayfa, category_ids: ids });
    if (sonuc.error) { console.error('HATA ' + sayfa.slug + ': ' + sonuc.error); db.close(); process.exit(1); }
    const cols = Object.keys(sonuc.fields);
    await run('INSERT INTO landing_pages (' + cols.join(', ') + ', updated_at) VALUES ('
      + cols.map(() => '?').join(', ') + ', CURRENT_TIMESTAMP)', cols.map(c => sonuc.fields[c]));
    console.log('olusturuldu (taslak, ' + kaynakAdi + ': ' + ids.join(',') + '): ' + sonuc.fields.slug);
    db.close();
    console.log('Yayina almak icin: node scripts/publish-landing-pages.js ' + sonuc.fields.slug);
  })().catch(err => { console.error(err); process.exit(1); });
}
