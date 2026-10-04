'use strict';
module.exports = {
  slug: 'yayin-formatlari-ve-akis-plani',
  title_tr: "Yayın Formatları ve Dakika Dakika Akış Planı",
  title_en: "LIVE Formats and a Minute-by-Minute Run of Show",
  summary_tr: "Soru-cevap, eğitim, oyun, sohbet ve ürün tanıtımı formatlarından sana uygun olanı seç; 60 dakikalık yayın akışı şablonuyla sessiz anları ortadan kaldır.",
  summary_en: "Choose the right format for you among Q&A, tutorials, gaming, chat and product showcases, and remove dead air with a 60-minute run-of-show template.",
  visual: {
    type: 'timeline',
    title_tr: "60 dakikalık yayın akışı",
    title_en: "A 60-minute LIVE run of show",
    items: [
      { tr: "Açılış ve konu cümlesi", en: "Opening and topic line", value_tr: "0-5 dk", value_en: "0-5 min" },
      { tr: "Ana bölüm 1", en: "Main segment 1", value_tr: "5-25 dk", value_en: "5-25 min" },
      { tr: "Etkileşim molası", en: "Interaction break", value_tr: "25-35 dk", value_en: "25-35 min" },
      { tr: "Ana bölüm 2", en: "Main segment 2", value_tr: "35-50 dk", value_en: "35-50 min" },
      { tr: "Kapanış ve randevu", en: "Wrap-up and next date", value_tr: "50-60 dk", value_en: "50-60 min" }
    ]
  },
  content_tr: `
<p>Plansız açılan bir canlı yayın genellikle şöyle geçer: “Merhaba, hoş geldin... Ne yapalım bugün? Siz söyleyin...” Birkaç dakika sonra yorumlar azalır, sen ne diyeceğini düşünürken sessizlik uzar ve yeni gelen izleyici ne olduğunu anlamadan kaydırıp gider. Sorun yeteneksizlik değil, plansızlıktır.</p>
<p>Bu derste önce beş temel canlı yayın formatını tanıyacak ve sana en uygun olanı seçeceksin. Ardından her yayında kullanabileceğin 60 dakikalık bir akış planı şablonu kuracağız. Plan, yayını robotik hale getirmek için değil; aklın “sıradaki ne?” sorusuyla meşgul olmasın, izleyiciye odaklanabilesin diye var.</p>
<!--GORSEL-->
<h2>Beş temel canlı yayın formatı</h2>
<p>Her format farklı bir kişiliğe ve hesaba uyar. Bir formatla başlayıp zamanla ikincisini eklemek, her yayında farklı bir şey denemekten daha sağlıklıdır; izleyici ne bekleyeceğini bildiğinde geri gelir.</p>
<table class="crs-table purple">
  <thead><tr><th>Format</th><th>Kime uygun?</th><th>Güçlü yanı</th><th>Dikkat edilecek risk</th></tr></thead>
  <tbody>
    <tr><td>Soru-cevap</td><td>Bir alanda bilgisi olanlar: kuaför, barista, yazılımcı, öğretmen</td><td><span class="crs-badge good">Hazırlığı az, etkileşimi yüksek</span></td><td>Soru gelmezse sessizlik; yedek soru listesi şart</td></tr>
    <tr><td>Eğitim / atölye</td><td>Öğretilebilir bir becerisi olanlar: tarif, makyaj, gitar, el işi</td><td><span class="crs-badge good">Değer yüksek, kolay klip çıkar</span></td><td>Tek yönlü anlatıma dönüşüp izleyiciyi unutmak</td></tr>
    <tr><td>Oyun</td><td>Oyun içeriği üreten hesaplar</td><td><span class="crs-badge good">Uzun izleme süresi</span></td><td>Oyun içi müzik, sohbet ve şiddet içeriğinde kurallara dikkat</td></tr>
    <tr><td>Sohbet / gündem</td><td>Topluluğu oturmuş, samimi hesaplar</td><td><span class="crs-badge mid">Samimiyet</span></td><td>Dağınıklık ve tartışmalı konularda kontrol kaybı</td></tr>
    <tr><td>Ürün tanıtımı</td><td>Butik, kafe, el yapımı ürün satanlar</td><td><span class="crs-badge mid">Satış öncesi güven</span></td><td>Reklam gibi hissettirmek; bölgeye göre değişen satış kuralları</td></tr>
  </tbody>
</table>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Bilgi</strong><p>Canlı yayında ürün satışı ve tanıtımıyla ilgili özellikler ve kurallar ülkeden ülkeye farklıdır ve sık güncellenir. Ürün tanıtımı yapacaksan, bulunduğun bölgedeki güncel ticari içerik kurallarını ve reklam bildirimi gerekliliklerini uygulamadan kontrol et.</p></div>
<h3>Formatını seçmek için üç soru</h3>
<ol class="crs-steps">
  <li><strong>Ne hakkında bir saat konuşabilirim?</strong> Zorlanmadan anlatabildiğin konu, yayında doğal görünmeni sağlar.</li>
  <li><strong>Kitlem bana en çok ne soruyor?</strong> Birinci derste topladığın 10 soru burada devreye giriyor; sorular bir alanda yoğunlaşıyorsa soru-cevap ya da eğitim formatı güçlü bir başlangıçtır.</li>
  <li><strong>Hangi formatı haftada en az bir kez sürdürebilirim?</strong> Ürün tanıtımı için her hafta yeni ürün gerekiyorsa ve yoksa, o format seni yorar.</li>
</ol>

<h2>60 dakikalık akış planı</h2>
<p>Görseldeki zaman çizelgesi bir saatlik bir yayının iskeletidir. 30 dakikalık yayın yapacaksan süreleri orantılı olarak kısalt; yapı aynı kalır. Her bölümün bir görevi var.</p>
<h3>Açılış (0-5 dk): ısın ama oyalanma</h3>
<p>Yayın açıldığında izleyici sayısı genellikle düşüktür; insanlar yavaş yavaş gelir. Bu yüzden ilk dakikalarda ana konuya derinlemesine girme, ama boş “hoş geldiniz” döngüsüne de düşme. İlk gelenlere ismiyle selam ver, yayının konusunu tek cümleyle söyle ve izleyicinin sonuna kadar kalması için bir sebep ver: “Yayının sonunda en çok sorulan hatayı canlı olarak düzelteceğim.”</p>
<h3>Ana bölüm 1 (5-25 dk): en güçlü içeriğini ilk sıraya koy</h3>
<p>Planladığın içeriğin en ilgi çekici kısmını burada ver. Eğitim yayınıysa ilk adımı göster, soru-cevapsa en çok sorulan soruyla başla. Yeni katılanlar için yaklaşık her 10 dakikada bir <mark>konu cümlesini tekrar et</mark>: “Yeni gelenler hoş geldi, bugün evde barista kalitesinde süt köpüğü yapmayı konuşuyoruz.”</p>
<h3>Etkileşim molası (25-35 dk): sahneyi izleyiciye ver</h3>
<p>Yayının ortası, enerjinin düştüğü yerdir. Burada anlatmayı bırak ve izleyiciyi işin içine kat: bir anket sorusu, “yorumlara en çok yaptığın hatayı yaz” çağrısı ya da izleyicinin sorularına hızlı cevaplar. Dördüncü derste bu tekniklerin ayrıntılarına gireceğiz.</p>
<h3>Ana bölüm 2 (35-50 dk): derinleş</h3>
<p>İkinci içerik bloğunu ver ya da etkileşim molasında gelen sorulardan en ilginç olanını derinlemesine işle. Bu bölüm, sadık izleyicinin “iyi ki kaldım” dediği yerdir.</p>
<h3>Kapanış (50-60 dk): özetle ve randevu ver</h3>
<p>Yayını aniden kapatma. Bugün ne konuştuğunuzu üç maddede özetle, açılışta verdiğin sözü yerine getir, katılanlara teşekkür et ve bir sonraki yayının gününü ve konusunu söyle. Randevu vermek, tek seferlik izleyiciyi düzenli izleyiciye çevirmenin en basit yoludur.</p>
<div class="crs-callout tip"><strong class="crs-callout-title">💡 İpucu</strong><p>Akış planını yayın sırasında görebileceğin bir yere koy: telefonun yanına yapıştırılmış bir kâğıt ya da arkadaki bir not tahtası işe yarar. Yayın sırasında başka bir uygulamaya geçip not okumak, yayını kesintiye uğratabilir ve izleyiciyle göz temasını bozar.</p></div>
<div class="crs-template"><span class="crs-template-label">Akış planı şablonu</span><p>Yayın konusu (tek cümle): ...<br>Sonuna kadar kalma sebebi (söz): ...<br>Açılış (0-5 dk): selam + konu cümlesi + söz<br>Ana bölüm 1 (5-25 dk): en güçlü içerik ...<br>Etkileşim molası (25-35 dk): anket sorusu ... / yorum çağrısı ...<br>Ana bölüm 2 (35-50 dk): ikinci içerik ya da seçilen soru ...<br>Kapanış (50-60 dk): 3 maddelik özet + sözün yerine getirilmesi + sonraki yayın günü ve konusu<br>Yedek malzeme: 5 soru, 1 hikâye, 1 mini meydan okuma</p></div>

<h2>Başlık ve kapak: yayına neden girmeliyim?</h2>
<p>Canlı yayın başlığı, kaydırma sırasında karşına çıkan kişiye “burada ne var?” sorusunun cevabını verir. Belirsiz başlıklar merak uyandırmaz; somut bir vaat uyandırır.</p>
<div class="crs-compare">
  <div class="crs-compare-col bad"><strong class="crs-compare-title">❌ Yanlış</strong><ul>
    <li>“Gelin sohbet edelim”</li>
    <li>“Canlıdayız!!!”</li>
    <li>“Bugün sürpriz var” (ama sürpriz yok)</li>
  </ul></div>
  <div class="crs-compare-col good"><strong class="crs-compare-title">✅ Doğru</strong><ul>
    <li>“Evde boyadığın saç neden turuncu oluyor? Canlı soru-cevap”</li>
    <li>“3 malzemeyle soğuk kahve: birlikte yapıyoruz”</li>
    <li>“Yeni sezon ürünleri: kumaş ve beden sorularınız”</li>
  </ul></div>
</div>
<p>Kapak görseli için yüzünün net göründüğü, iyi ışıklı bir fotoğraf kullan. Ürün tanıtımı yapıyorsan ürünü de kadraja al. Kapak ile yayın içeriği uyumlu olmalı; izleyiciyi yanıltan bir kapak, yayına girer girmez çıkan izleyici demektir.</p>

<h2>Süre ve sıklık: sürdürülebilir olanı seç</h2>
<p>Çok kısa yayınlarda izleyicinin birikmeye fırsatı olmayabilir; çok uzun yayınlar ise başlangıçta enerjini tüketir. Birçok yayıncı 30-60 dakika arası yayınlarla başlar ve zamanla süreyi kendi kitlesine göre ayarlar. Sıklık için de aynı mantık geçerli: haftada bir kez düzenli yapılan yayın, bir hafta her gün yapılıp sonra bırakılan yayından daha değerlidir.</p>
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Dikkat</strong><p>Sohbet ve gündem formatında hazırlıksız tartışmalı konulara (siyaset, din, sağlık iddiaları, kişiler hakkında söylentiler) girmek, yorumların kontrolden çıkmasına ve kural ihlallerine yol açabilir. Hassas bir konu açılırsa kibarca konuyu değiştir ve akış planına dön.</p></div>

<h2>Sessizlik anları için yedek malzeme</h2>
<p>Her yayında yorumların durduğu anlar olur. Bu anlar için hazırlıklı olmak, panik yerine güvenle devam etmeni sağlar.</p>
<ul class="crs-checklist">
  <li>Kitlenin daha önce sorduğu 5 soru ve kısa cevapları</li>
  <li>Konuyla ilgili anlatabileceğin kısa bir kişisel hikâye</li>
  <li>İzleyicinin yorumla katılabileceği bir mini meydan okuma ya da tahmin oyunu</li>
  <li>Bir sonraki yayın için fikir sorma: “Gelecek hafta ne konuşalım?”</li>
  <li>Yayının başında verdiğin sözün hatırlatması</li>
</ul>
<p>Akış planın hazır, yedek malzemen cebinde. Ama plan ne kadar iyi olursa olsun, yayının başarısını asıl belirleyen şey izleyicinin yayında kalıp kalmadığı ve katılıp katılmadığıdır. Bir sonraki derste izleyiciyi yayında tutmanın ve etkileşimi artırmanın pratik tekniklerini işleyeceğiz: sabitlenmiş yorumdan moderatör seçimine kadar.</p>
<div class="crs-keypoints"><strong class="crs-callout-title">📌 Bu derste öğrendiklerin</strong><ul>
  <li>Beş temel format var; birini seçip düzenli sürdürmek, her yayında farklı bir şey denemekten daha sağlıklı.</li>
  <li>60 dakikalık akış: açılış, ana bölüm, etkileşim molası, ikinci ana bölüm, kapanış.</li>
  <li>Konu cümlesini düzenli aralıklarla tekrar et ve sonuna kadar kalmak için bir söz ver.</li>
  <li>Somut vaat içeren başlık, uyumlu kapak ve yedek malzeme listesi sessizliği önler.</li>
</ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Görevin</strong><p>Üç soruyu cevaplayarak ana formatını seç. Ardından şablonu kullanarak ilk yayının için eksiksiz bir akış planı yaz: konu cümlesi, sonuna kadar kalma sözü, her bölümün içeriği ve 5 maddelik yedek malzeme. Son olarak yayın için somut bir vaat içeren üç başlık seçeneği yaz ve en iyisini işaretle.</p></div>
`,
  content_en: `
<p>An unplanned LIVE usually goes like this: “Hi, welcome... What should we do today? You tell me...” A few minutes later the comments slow down, the silence grows while you think about what to say, and new viewers swipe away before they understand what's going on. The problem isn't a lack of talent; it's a lack of planning.</p>
<p>In this lesson you'll first get to know the five core LIVE formats and pick the one that suits you best. Then we'll build a 60-minute run-of-show template you can reuse for every stream. The plan isn't there to make you robotic; it's there so your mind isn't busy with “what's next?” and you can focus on your viewers.</p>
<!--GORSEL-->
<h2>Five core LIVE formats</h2>
<p>Each format fits a different personality and account. Starting with one format and adding a second over time works better than trying something new every stream; viewers come back when they know what to expect.</p>
<table class="crs-table purple">
  <thead><tr><th>Format</th><th>Who it suits</th><th>Strength</th><th>Risk to watch</th></tr></thead>
  <tbody>
    <tr><td>Q&amp;A</td><td>People with know-how in a field: hairdressers, baristas, developers, teachers</td><td><span class="crs-badge good">Low prep, high interaction</span></td><td>Dead air if questions don't come; a backup question list is essential</td></tr>
    <tr><td>Tutorial / workshop</td><td>People with a teachable skill: recipes, makeup, guitar, crafts</td><td><span class="crs-badge good">High value, easy to clip</span></td><td>Turning into a one-way lecture and forgetting viewers</td></tr>
    <tr><td>Gaming</td><td>Gaming content creators</td><td><span class="crs-badge good">Long watch time</span></td><td>Watch the rules on in-game music, chat and violent content</td></tr>
    <tr><td>Chat / topical</td><td>Accounts with an established, close-knit community</td><td><span class="crs-badge mid">Intimacy</span></td><td>Rambling and losing control on controversial topics</td></tr>
    <tr><td>Product showcase</td><td>Boutiques, cafés, handmade sellers</td><td><span class="crs-badge mid">Pre-purchase trust</span></td><td>Feeling like an ad; selling rules that vary by region</td></tr>
  </tbody>
</table>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Good to know</strong><p>Features and rules for selling and promoting products on LIVE differ from country to country and change often. If you plan product showcases, check the current branded content rules and ad disclosure requirements for your region inside the app.</p></div>
<h3>Three questions to pick your format</h3>
<ol class="crs-steps">
  <li><strong>What could I talk about for an hour?</strong> A topic you can explain effortlessly makes you look natural on stream.</li>
  <li><strong>What does my audience ask me most?</strong> The 10 questions you collected in lesson one come in here; if they cluster around one area, Q&amp;A or a tutorial is a strong start.</li>
  <li><strong>Which format can I sustain at least once a week?</strong> If product showcases need a new product every week and you don't have one, that format will burn you out.</li>
</ol>

<h2>The 60-minute run of show</h2>
<p>The timeline in the graphic is the skeleton of a one-hour stream. If you stream for 30 minutes, shorten each part proportionally; the structure stays the same. Every segment has a job.</p>
<h3>Opening (0-5 min): warm up, but don't stall</h3>
<p>When you go live, viewer numbers are usually low; people trickle in. So don't dive deep into the main topic in the first minutes, but don't fall into an endless “welcome” loop either. Greet early arrivals by name, state the topic in one sentence and give people a reason to stay until the end: “At the end of this stream I'll fix the most common mistake live.”</p>
<h3>Main segment 1 (5-25 min): lead with your strongest content</h3>
<p>Put the most interesting part of your plan here. For a tutorial, show the first step; for Q&amp;A, start with the most asked question. For newcomers, <mark>repeat your topic line</mark> roughly every 10 minutes: “If you just joined, welcome, today we're talking about making barista-quality milk foam at home.”</p>
<h3>Interaction break (25-35 min): hand the stage to viewers</h3>
<p>The middle of a stream is where energy dips. Stop explaining and bring viewers in: a poll question, a “type your most common mistake in the comments” prompt or rapid-fire answers to their questions. We'll go deeper into these techniques in lesson four.</p>
<h3>Main segment 2 (35-50 min): go deeper</h3>
<p>Deliver your second content block, or take the most interesting question from the interaction break and explore it in depth. This is where loyal viewers think “glad I stayed.”</p>
<h3>Wrap-up (50-60 min): summarize and set a date</h3>
<p>Don't end abruptly. Summarize what you covered in three points, deliver the promise you made in the opening, thank everyone and announce the day and topic of your next stream. Setting a date is the simplest way to turn a one-time viewer into a regular.</p>
<div class="crs-callout tip"><strong class="crs-callout-title">💡 Tip</strong><p>Keep your run of show somewhere you can see it during the stream: a sheet of paper taped next to your phone or a notes board behind it works well. Switching to another app to read notes can interrupt the stream and break eye contact with viewers.</p></div>
<div class="crs-template"><span class="crs-template-label">Run-of-show template</span><p>Stream topic (one sentence): ...<br>Reason to stay until the end (promise): ...<br>Opening (0-5 min): greeting + topic line + promise<br>Main segment 1 (5-25 min): strongest content ...<br>Interaction break (25-35 min): poll question ... / comment prompt ...<br>Main segment 2 (35-50 min): second block or chosen question ...<br>Wrap-up (50-60 min): 3-point summary + deliver the promise + next stream day and topic<br>Backup material: 5 questions, 1 story, 1 mini challenge</p></div>

<h2>Title and cover: why should I join?</h2>
<p>A LIVE title answers “what's in here?” for someone scrolling past. Vague titles don't spark curiosity; a concrete promise does.</p>
<div class="crs-compare">
  <div class="crs-compare-col bad"><strong class="crs-compare-title">❌ Wrong</strong><ul>
    <li>“Come chat with me”</li>
    <li>“We're LIVE!!!”</li>
    <li>“Surprise today” (with no surprise)</li>
  </ul></div>
  <div class="crs-compare-col good"><strong class="crs-compare-title">✅ Right</strong><ul>
    <li>“Why does home-dyed hair turn orange? LIVE Q&amp;A”</li>
    <li>“3-ingredient iced coffee: let's make it together”</li>
    <li>“New season pieces: your fabric and sizing questions”</li>
  </ul></div>
</div>
<p>For the cover, use a well-lit photo where your face is clearly visible. If you're showcasing products, include the product too. The cover and the stream should match; a misleading cover means viewers who leave the moment they join.</p>

<h2>Length and frequency: choose what you can sustain</h2>
<p>Very short streams may not give viewers time to build up, while very long ones drain your energy early on. Many creators start with 30 to 60 minute streams and adjust over time based on their audience. The same logic applies to frequency: one regular stream a week is worth more than streaming daily for a week and then disappearing.</p>
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Watch out</strong><p>In chat and topical formats, wandering unprepared into controversial topics (politics, religion, health claims, rumors about people) can make comments spiral and lead to guideline violations. If a sensitive topic comes up, politely change the subject and return to your run of show.</p></div>

<h2>Backup material for quiet moments</h2>
<p>Every stream has moments when comments stop. Being prepared for them lets you carry on with confidence instead of panic.</p>
<ul class="crs-checklist">
  <li>5 questions your audience asked before, with short answers</li>
  <li>A short personal story related to the topic</li>
  <li>A mini challenge or guessing game viewers can join in the comments</li>
  <li>Asking for ideas for next time: “What should we talk about next week?”</li>
  <li>A reminder of the promise you made at the start</li>
</ul>
<p>Your run of show is ready and your backup material is in your pocket. But however good the plan, what really decides a stream's success is whether viewers stay and take part. In the next lesson we'll cover practical techniques to keep viewers on your stream and boost interaction, from pinned comments to choosing moderators.</p>
<div class="crs-keypoints"><strong class="crs-callout-title">📌 Key takeaways</strong><ul>
  <li>There are five core formats; picking one and sticking with it beats trying something new every stream.</li>
  <li>The 60-minute flow: opening, main segment, interaction break, second segment, wrap-up.</li>
  <li>Repeat your topic line regularly and give viewers a promise that makes them stay to the end.</li>
  <li>A title with a concrete promise, a matching cover and a backup list prevent dead air.</li>
</ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Your task</strong><p>Answer the three questions and choose your main format. Then use the template to write a complete run of show for your first stream: topic line, the promise to stay, the content of each segment and five pieces of backup material. Finally, write three title options with a concrete promise and mark the best one.</p></div>
`
};
