'use strict';
module.exports = {
  slug: 'ekipman-ve-yayin-kurulumu',
  title_tr: "Ekipman ve Kurulum: Telefonla Temiz Görüntü, Net Ses",
  title_en: "Gear and Setup: Clean Video and Clear Audio With Your Phone",
  summary_tr: "Pahalı ekipman almadan telefonunla canlı yayına nasıl hazırlanacağını öğren: ses, ışık, internet, dikey kadraj ve yayın öncesi 10 dakikalık teknik kontrol.",
  summary_en: "Learn how to get LIVE-ready with the phone you already own: audio, lighting, internet, vertical framing and a 10-minute technical check before every stream.",
  visual: {
    type: 'bars',
    title_tr: "Ekipmanın göreli önemi",
    title_en: "Relative importance of your gear",
    items: [
      { tr: "Net ses", en: "Clear audio", value: 95 },
      { tr: "Sabit internet", en: "Stable internet", value: 90 },
      { tr: "Yüzü aydınlatan ışık", en: "Light on your face", value: 75 },
      { tr: "Sabit telefon tutucu", en: "Steady phone mount", value: 60 },
      { tr: "Kamera kalitesi", en: "Camera quality", value: 40 }
    ]
  },
  content_tr: `
<p>Canlı yayına başlamak isteyenlerin en sık yaptığı hata, işe ekipman alışverişiyle başlamak. Halka ışık, stüdyo mikrofonu, yeni telefon... Oysa izleyiciler ortalama bir görüntüyü çoğu zaman affeder; affetmedikleri şey anlaşılmayan ses, sürekli donan yayın ve karanlıkta kalan bir yüzdür. Yani önceliğin “daha iyi kamera” değil, “daha az sorun” olmalı.</p>
<p>Bu derste elindeki telefonla, ya hiç para harcamadan ya da çok küçük bir bütçeyle profesyonel görünen bir yayın kurmayı öğreneceksin. Ses, internet, ışık, kadraj ve telefon ayarlarını sırayla ele alacağız ve dersin sonunda her yayından önce uygulayacağın 10 dakikalık bir teknik kontrol listen olacak.</p>
<!--GORSEL-->
<h2>Öncelik sırası: önce ses ve bağlantı</h2>
<p>Görseldeki çubuklar kesin bir ölçüm değil, göreli bir öncelik sıralamasıdır. Mantık basit: izleyici sesi duyamazsa ya da yayın donarsa birkaç saniye içinde kaydırıp gider. Görüntü biraz soluk olsa bile konuşman değerliyse kalır. Bu yüzden bütçen sınırlıysa ilk harcamayı ses ve bağlantıya yap.</p>
<table class="crs-table blue">
  <thead><tr><th>Alan</th><th>Ücretsiz / ucuz başlangıç</th><th>Ne zaman yükseltmeli?</th><th>Öncelik</th></tr></thead>
  <tbody>
    <tr><td>Ses</td><td>Kablolu kulaklığın mikrofonu ya da uygun fiyatlı bir yaka mikrofonu</td><td>Yorumlarda “ses gelmiyor”, “yankı var” yazıyorsa</td><td><span class="crs-badge good">Yüksek</span></td></tr>
    <tr><td>İnternet</td><td>Modeme yakın sabit Wi-Fi</td><td>Yayın sık donuyor ya da düşüyorsa</td><td><span class="crs-badge good">Yüksek</span></td></tr>
    <tr><td>Işık</td><td>Pencereye dönük gün ışığı, akşam için masa lambası</td><td>Akşam yayınlarında yüzün karanlık kalıyorsa</td><td><span class="crs-badge mid">Orta</span></td></tr>
    <tr><td>Tutucu</td><td>Basit bir tripod ya da üst üste konmuş kitaplar</td><td>Telefonu elde tutmak zorunda kalıyorsan</td><td><span class="crs-badge mid">Orta</span></td></tr>
    <tr><td>Telefon</td><td>Şu anki telefonun</td><td>Diğer her şey çözüldükten sonra</td><td><span class="crs-badge bad">Düşük</span></td></tr>
  </tbody>
</table>

<h2>Ses: izleyiciyi tutan görünmez kahraman</h2>
<p>Telefonun dahili mikrofonu, telefona yakın ve sessiz bir odada iş görür. Sorun, telefondan uzaklaştığında ya da oda yankılı olduğunda başlar. Boş duvarlı, eşyası az bir oda sesi duvardan duvara çarptırır; izleyici bunu “banyoda konuşuyor gibi” diye tarif eder.</p>
<ul>
  <li><strong>Yankıyı azalt:</strong> Halı, perde, kitaplık, yatak ve kanepe gibi yumuşak yüzeyler sesi emer. Mümkünse eşyalı bir odada yayın yap.</li>
  <li><strong>Arka plan gürültüsünü kapat:</strong> Klima, vantilatör, çamaşır makinesi ve sokak sesi mikrofona senin duyduğundan daha yüksek gelir.</li>
  <li><strong>Mikrofonu ağzına yakın tut:</strong> Yaka mikrofonu kullanıyorsan göğüs hizasına, kıyafete sürtünmeyecek şekilde tak.</li>
  <li><strong>Bildirim seslerini kapat:</strong> Yayın sırasında gelen mesaj sesleri hem dikkat dağıtır hem de amatör görünür.</li>
</ul>
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Dikkat</strong><p>Arka planda açık bıraktığın radyo, televizyon ya da müzik listesi telifli içerik olabilir ve yayının sesinin kısılmasına veya kural uyarısına yol açabilir. Kafe ya da mağazadan yayın yapıyorsan ortam müziğini yayın süresince kapatmayı ya da kısmayı düşün.</p></div>

<h2>İnternet: donmayan yayının şartı</h2>
<p>Canlı yayın sürekli veri yükler; bu yüzden indirme hızından çok <mark>yükleme hızı ve bağlantının kararlılığı</mark> önemlidir. Kısa bir süre için yüksek hız görmek yetmez, bağlantının bir saat boyunca istikrarlı kalması gerekir.</p>
<ol class="crs-steps">
  <li><strong>Yayın yapacağın yerde hız testi yap.</strong> Yükleme hızına bak ve testi birkaç kez tekrarla; sonuç çok dalgalanıyorsa o nokta riskli demektir.</li>
  <li><strong>Modeme yaklaş.</strong> Duvarlar ve kapılar Wi-Fi sinyalini zayıflatır. Mümkünse yayını modemle aynı odadan yap.</li>
  <li><strong>Ağı boşalt.</strong> Evdeki diğer cihazlarda film indirme, büyük güncelleme veya yüksek çözünürlüklü video izleme varsa yayın süresince durdur.</li>
  <li><strong>Yedek planın olsun.</strong> Wi-Fi koparsa mobil veriye geçebilmek için kotanı ve çekim gücünü önceden kontrol et.</li>
</ol>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Bilgi</strong><p>Uzun yayınlar telefonu ısıtır ve şarjı hızla tüketir. Telefonu yayın boyunca şarja takılı tut, kılıfını çıkar ve doğrudan güneş alan bir yere koyma. Aşırı ısınan telefonlar performansı düşürebilir ve yayının kalitesi bozulabilir.</p></div>

<h2>Işık: ücretsiz kurulum</h2>
<p>İyi ışık için ilk iş halka ışık almak değil, doğru yere oturmaktır. Gün ışığı ücretsiz ve çoğu yapay ışıktan daha yumuşaktır. Kural basit: ışık kaynağı yüzünün önünde olmalı, arkanda değil.</p>
<div class="crs-compare">
  <div class="crs-compare-col bad"><strong class="crs-compare-title">❌ Yanlış</strong><ul>
    <li>Arkanda pencere varken yayın yapmak (yüzün karanlık kalır)</li>
    <li>Sadece tavandaki tek lambayla yayın yapmak (göz altları gölgelenir)</li>
    <li>Ekran parlaklığını yüzünü aydınlatmak için kullanmak</li>
  </ul></div>
  <div class="crs-compare-col good"><strong class="crs-compare-title">✅ Doğru</strong><ul>
    <li>Yüzünü pencereye dönük konumlandırmak</li>
    <li>Akşam bir masa lambasını yüzüne çapraz ve biraz yukarıdan konumlandırmak</li>
    <li>Lambayı beyaz bir duvara yansıtarak yumuşak ışık elde etmek</li>
  </ul></div>
</div>
<p>Akşam yayınlarında farklı renklerde ışık kaynaklarını karıştırmamaya çalış. Sarı bir masa lambası ile beyaz bir tavan ışığı aynı anda yüzüne vurduğunda ten rengi tuhaf görünebilir. Tek tip ışık, daha profesyonel bir görüntü verir.</p>

<h2>Kadraj: dikey ekranı akıllı kullan</h2>
<p>TikTok canlı yayınları izleyicilerin çoğu tarafından telefonla, dikey ekranda izlenir. Ekranın alt kısmını yorumlar, bir kısmını da hediye animasyonları ve butonlar kaplar. Bu yüzden önemli olan her şeyi ekranın üst ve orta bölgesinde tut.</p>
<ul>
  <li><strong>Göz hizası:</strong> Telefonu göz hizana yerleştir. Aşağıdan çekim kimseye yakışmaz ve izleyiciyle göz teması zorlaşır.</li>
  <li><strong>Mesafe:</strong> Başın ekranın üst üçte birinde kalsın; omuzların ve ellerin görünsün. Ellerin görünürse anlatımın daha canlı olur.</li>
  <li><strong>Ürün gösterimi:</strong> Butik ya da kafe hesabıysan ürünü yüzünün yanında, ekranın orta bölgesinde göster; aşağıda tutarsan yorumların arkasında kalır.</li>
  <li><strong>Arka plan:</strong> Sade ve düzenli olsun. Dağınık bir arka plan dikkat dağıtır; hesabına uygun bir iki obje (kahve fincanları, makas ve tarak, askıdaki ürünler) ise kimlik katar.</li>
</ul>
<h3>Ön kamera mı, arka kamera mı?</h3>
<p>Arka kamera genellikle daha kaliteli görüntü verir, ama yorumları göremezsin; bu da etkileşimi öldürür. Başlangıçta ön kamerayı kullan. İleride bir yardımcın ya da yorumları takip edeceğin ikinci bir cihazın olursa arka kamerayı deneyebilirsin.</p>
<div class="crs-callout tip"><strong class="crs-callout-title">💡 İpucu</strong><p>Bilgisayardan yayın yapmak isteyenler için TikTok'un masaüstü yayın aracı bazı hesaplarda ve bölgelerde kullanılabiliyor; erişim şartları zaman içinde değişebiliyor. Oyun yayını ya da ekran paylaşımı planlıyorsan bu seçeneğin sende açık olup olmadığını yardım merkezinden kontrol et. Başlangıç için telefon fazlasıyla yeterli.</p></div>

<h2>Yayın öncesi 10 dakikalık teknik kontrol</h2>
<p>Pilotlar her uçuştan önce kontrol listesi kullanır; deneyimsiz oldukları için değil, deneyimli insanların da bir şeyi unutabileceğini bildikleri için. Aşağıdaki listeyi telefonuna kaydet ve her yayından önce uygula.</p>
<ul class="crs-checklist">
  <li>Telefon şarja takılı ve depolama alanında yer var</li>
  <li>Rahatsız Etme modu açık, bildirim sesleri kapalı</li>
  <li>Hız testi yapıldı, gereksiz cihazlar ağdan çıkarıldı</li>
  <li>Kamera lensi temizlendi, telefon göz hizasında sabit</li>
  <li>Işık yüzünün önünde, arka plan düzenli</li>
  <li>Mikrofon test edildi, ortamdaki müzik ve gürültü kapatıldı</li>
  <li>Su bardağın yanında, akış planın görebileceğin bir yerde</li>
</ul>
<div class="crs-template"><span class="crs-template-label">Deneme kaydı yöntemi</span><p>Yayından önce kurulumun aynısıyla kamerayı aç ve 30 saniyelik normal bir video kaydet. Kulaklıkla dinle ve izle: Ses net mi? Yüzün aydınlık mı? Arka planda dikkat dağıtan bir şey var mı? Sorun yoksa yayına geç.</p></div>
<p>Kurulum bir kez oturduktan sonra her yayında aynı yeri, aynı açıyı ve aynı ışığı kullanmaya çalış. Tutarlı bir görüntü hem senin işini kolaylaştırır hem de izleyiciye “burası onun yeri” hissi verir. Teknik taraf hazır olduğunda asıl önemli soruya geçebiliriz: yayında tam olarak ne yapacaksın? Bir sonraki derste yayın formatlarını ve dakika dakika bir akış planı şablonunu birlikte kuracağız.</p>
<div class="crs-keypoints"><strong class="crs-callout-title">📌 Bu derste öğrendiklerin</strong><ul>
  <li>Önceliğin daha iyi kamera değil, daha az sorun: önce ses ve bağlantı, sonra ışık ve tutucu.</li>
  <li>Yankıyı yumuşak yüzeylerle azalt, arka plandaki telifli müziği kapat.</li>
  <li>Canlı yayında yükleme hızı ve bağlantının kararlılığı belirleyicidir; yedek planın olsun.</li>
  <li>Dikey kadrajda önemli her şeyi üst ve orta bölgede tut; başlangıçta ön kamerayı kullan.</li>
</ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Görevin</strong><p>Evinde ya da işyerinde yayın yapacağın noktayı seç. Hız testini o noktada üç kez yap, ışığı pencereye göre ayarla ve 30 saniyelik bir deneme kaydı al. Kaydı izleyip sesi, ışığı ve arka planı tek tek değerlendir; ardından 10 dakikalık kontrol listesini telefonuna not olarak kaydet.</p></div>
`,
  content_en: `
<p>The most common mistake people make when they want to start streaming is beginning with a shopping spree: a ring light, a studio mic, a new phone... Yet viewers usually forgive an average picture. What they don't forgive is audio they can't understand, a stream that keeps freezing and a face lost in the dark. So your priority shouldn't be “a better camera” but “fewer problems.”</p>
<p>In this lesson you'll learn how to build a professional-looking stream with the phone you already own, spending nothing or very little. We'll go through audio, internet, lighting, framing and phone settings in order, and by the end you'll have a 10-minute technical checklist to run before every stream.</p>
<!--GORSEL-->
<h2>Priority order: audio and connection first</h2>
<p>The bars in the graphic are not a measurement; they show relative priority. The logic is simple: if viewers can't hear you or the stream freezes, they swipe away within seconds. If the picture is a bit dull but what you say is valuable, they stay. So if your budget is limited, spend it on audio and connection first.</p>
<table class="crs-table blue">
  <thead><tr><th>Area</th><th>Free / low-cost start</th><th>When to upgrade</th><th>Priority</th></tr></thead>
  <tbody>
    <tr><td>Audio</td><td>Wired earphone mic or an affordable lavalier mic</td><td>When comments say “can't hear you” or “there's an echo”</td><td><span class="crs-badge good">High</span></td></tr>
    <tr><td>Internet</td><td>Stable Wi-Fi close to the router</td><td>When the stream often freezes or drops</td><td><span class="crs-badge good">High</span></td></tr>
    <tr><td>Lighting</td><td>Daylight from a window you face, a desk lamp for evenings</td><td>When your face is dark in evening streams</td><td><span class="crs-badge mid">Medium</span></td></tr>
    <tr><td>Mount</td><td>A basic tripod or a stack of books</td><td>When you're forced to hold the phone</td><td><span class="crs-badge mid">Medium</span></td></tr>
    <tr><td>Phone</td><td>The one you have now</td><td>Only after everything else is solved</td><td><span class="crs-badge bad">Low</span></td></tr>
  </tbody>
</table>

<h2>Audio: the invisible hero that keeps viewers</h2>
<p>Your phone's built-in mic works fine when you're close to it in a quiet room. Problems start when you move away or when the room echoes. A room with bare walls and little furniture bounces sound around; viewers describe it as “sounds like you're in a bathroom.”</p>
<ul>
  <li><strong>Reduce echo:</strong> Soft surfaces such as rugs, curtains, bookshelves, beds and sofas absorb sound. Stream from a furnished room if you can.</li>
  <li><strong>Kill background noise:</strong> Air conditioners, fans, washing machines and street noise sound louder on the mic than they do to you.</li>
  <li><strong>Keep the mic close to your mouth:</strong> If you use a lavalier, clip it at chest level where it won't rub against your clothes.</li>
  <li><strong>Mute notification sounds:</strong> Message pings during a stream are distracting and look amateurish.</li>
</ul>
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Watch out</strong><p>A radio, TV or playlist running in the background may be copyrighted and can get your stream muted or trigger a guideline warning. If you stream from a café or shop, consider turning the ambient music off or down while you're live.</p></div>

<h2>Internet: the key to a stream that doesn't freeze</h2>
<p>A LIVE stream constantly uploads data, so <mark>upload speed and connection stability</mark> matter more than download speed. Seeing a high number for a few seconds isn't enough; the connection needs to stay steady for an hour.</p>
<ol class="crs-steps">
  <li><strong>Run a speed test where you'll stream.</strong> Check the upload speed and repeat the test a few times; if results swing wildly, that spot is risky.</li>
  <li><strong>Get closer to the router.</strong> Walls and doors weaken Wi-Fi. Stream from the same room as the router if possible.</li>
  <li><strong>Free up the network.</strong> Pause big downloads, large updates or high-resolution streaming on other devices at home during your LIVE.</li>
  <li><strong>Have a backup plan.</strong> Check your mobile data allowance and signal in advance so you can switch if Wi-Fi drops.</li>
</ol>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Good to know</strong><p>Long streams heat up your phone and drain the battery fast. Keep it plugged in for the whole stream, take off the case and keep it out of direct sunlight. Overheating phones can throttle performance and hurt stream quality.</p></div>

<h2>Lighting: the free setup</h2>
<p>Good lighting starts with sitting in the right place, not buying a ring light. Daylight is free and softer than most artificial light. The rule is simple: the light source should be in front of your face, not behind you.</p>
<div class="crs-compare">
  <div class="crs-compare-col bad"><strong class="crs-compare-title">❌ Wrong</strong><ul>
    <li>Streaming with a window behind you (your face goes dark)</li>
    <li>Relying on a single ceiling light (shadows under your eyes)</li>
    <li>Using screen brightness to light your face</li>
  </ul></div>
  <div class="crs-compare-col good"><strong class="crs-compare-title">✅ Right</strong><ul>
    <li>Positioning yourself facing the window</li>
    <li>In the evening, placing a desk lamp at an angle, slightly above your face</li>
    <li>Bouncing a lamp off a white wall for soft light</li>
  </ul></div>
</div>
<p>In evening streams, try not to mix light sources of different colors. When a warm yellow desk lamp and a cool white ceiling light hit your face at the same time, skin tones can look odd. A single type of light gives a more professional picture.</p>

<h2>Framing: use the vertical screen wisely</h2>
<p>Most viewers watch TikTok LIVE on a phone, in vertical mode. Comments cover the bottom of the screen, and gift animations and buttons take up other areas. So keep everything important in the upper and middle part of the frame.</p>
<ul>
  <li><strong>Eye level:</strong> Place the phone at eye level. Low angles flatter no one and make eye contact harder.</li>
  <li><strong>Distance:</strong> Keep your head in the top third of the screen with your shoulders and hands visible. Visible hands make you more expressive.</li>
  <li><strong>Showing products:</strong> For a boutique or café account, hold products next to your face in the middle of the frame; held low, they disappear behind the comments.</li>
  <li><strong>Background:</strong> Keep it simple and tidy. Clutter distracts, while one or two objects that fit your account (coffee cups, scissors and combs, items on a rack) add identity.</li>
</ul>
<h3>Front or rear camera?</h3>
<p>The rear camera usually gives better image quality, but you can't see the comments, which kills interaction. Start with the front camera. Later, if you have a helper or a second device to follow comments, you can experiment with the rear camera.</p>
<div class="crs-callout tip"><strong class="crs-callout-title">💡 Tip</strong><p>If you want to stream from a computer, TikTok's desktop streaming tool is available to some accounts and regions, and access rules can change over time. If you plan gaming streams or screen sharing, check the Help Center to see whether it's available to you. For getting started, a phone is more than enough.</p></div>

<h2>The 10-minute pre-stream technical check</h2>
<p>Pilots use a checklist before every flight, not because they lack experience but because even experienced people forget things. Save the list below on your phone and run through it before every stream.</p>
<ul class="crs-checklist">
  <li>Phone is plugged in and has free storage</li>
  <li>Do Not Disturb is on, notification sounds are off</li>
  <li>Speed test done, unnecessary devices off the network</li>
  <li>Camera lens cleaned, phone steady at eye level</li>
  <li>Light in front of your face, background tidy</li>
  <li>Mic tested, ambient music and noise turned off</li>
  <li>Water within reach, run of show where you can see it</li>
</ul>
<div class="crs-template"><span class="crs-template-label">Test recording method</span><p>Before going live, open the camera with your exact setup and record a normal 30-second video. Watch it back with earphones: Is the audio clear? Is your face well lit? Is anything distracting in the background? If all is good, go live.</p></div>
<p>Once your setup works, try to use the same spot, the same angle and the same light for every stream. A consistent look makes your life easier and gives viewers a sense of “this is their place.” With the technical side ready, we can move on to the question that really matters: what exactly will you do on stream? In the next lesson we'll build LIVE formats and a minute-by-minute run-of-show template together.</p>
<div class="crs-keypoints"><strong class="crs-callout-title">📌 Key takeaways</strong><ul>
  <li>Your priority isn't a better camera but fewer problems: audio and connection first, then lighting and a mount.</li>
  <li>Reduce echo with soft surfaces and turn off copyrighted background music.</li>
  <li>On LIVE, upload speed and connection stability are decisive; always have a backup.</li>
  <li>In vertical framing keep key elements in the upper and middle area; start with the front camera.</li>
</ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Your task</strong><p>Pick the spot at home or at work where you'll stream. Run a speed test there three times, adjust your position to the window and record a 30-second test video. Review the audio, light and background one by one, then save the 10-minute checklist as a note on your phone.</p></div>
`
};
