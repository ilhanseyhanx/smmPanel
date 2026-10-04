'use strict';
module.exports = {
  slug: 'izleyiciyi-tutma-ve-izlenme-suresi',
  title_tr: "İzleyiciyi Tutma: Video Kurgusu ve İzlenme Süresi",
  title_en: "Audience Retention: Video Structure and Watch Time",
  summary_tr: "4.000 saate giden en kısa yol izleyiciyi videoda tutmaktır. Kitleyi elde tutma grafiğini okumayı, güçlü bir giriş kurmayı ve tempoyu koruyan kurgu tekniklerini öğren.",
  summary_en: "The shortest road to 4,000 hours is keeping viewers watching. Learn to read the audience retention graph, build a strong opening and use editing techniques that hold the pace.",
  visual: {
    type: 'bars',
    title_tr: "İzleyiciyi tutan unsurlar (göreli ağırlık)",
    title_en: "What keeps viewers watching (relative weight)",
    items: [
      { tr: "İlk 30 saniyedeki kanca", en: "The hook in the first 30 seconds", value: 95 },
      { tr: "Başlıktaki vaadin karşılanması", en: "Delivering the title's promise", value: 85 },
      { tr: "Tempo ve gereksiz kısımları kesmek", en: "Pacing and cutting filler", value: 70 },
      { tr: "Anlaşılır ses ve görüntü", en: "Clear sound and picture", value: 55 },
      { tr: "Bitiş ekranı ve sonraki video", en: "End screen and next video", value: 40 }
    ]
  },
  content_tr: `
<p>İlk derste gördüğün hesabı hatırla: ortalama izlenme süresi arttıkça 4.000 saate ulaşmak için gereken izlenme sayısı azalır. Ama izleyiciyi tutmanın önemi sadece bu hesapla sınırlı değil. İzleyicilerin videoyu izlemeye devam etmesi, videonun onlar için değerli olduğunu gösteren güçlü sinyallerden biridir ve önerilerde daha fazla insana ulaşma şansını artırır.</p>
<p>Bu derste YouTube Studio'daki kitleyi elde tutma grafiğini okumayı, izleyiciyi ilk saniyelerde yakalayan bir giriş kurmayı ve video boyunca tempoyu koruyan kurgu tekniklerini öğreneceksin.</p>
<!--GORSEL-->
<h2>Kitleyi elde tutma grafiği nasıl okunur?</h2>
<p>Studio'da bir videonun Analytics sayfasını açtığında "Kitleyi elde tutma" (audience retention) grafiğini görürsün. Bu grafik, videonun her anında izleyicilerin yüzde kaçının hâlâ izlemeye devam ettiğini gösterir. Bazı hesaplarda grafik, videonu benzer uzunluktaki diğer videolarınla da karşılaştırır.</p>
<p>Grafiğe bakarken iki şeye odaklan: <mark>ilk 30 saniyede ne kadar izleyici kaybettiğin</mark> ve grafiğin nerelerde ani düşüşler ya da yükselişler yaptığı. Ani düşüş, izleyicinin o anda sıkıldığını veya aradığını bulamadığını; yükseliş ise insanların o kısmı geri sarıp tekrar izlediğini veya o noktaya atladığını gösterir.</p>
<table class="crs-table red">
  <thead><tr><th>Grafikte gördüğün</th><th>Muhtemel sebep</th><th>Ne yapmalı?</th></tr></thead>
  <tbody>
    <tr><td>İlk 10-30 saniyede sert düşüş</td><td>Uzun giriş, başlıkla uyumsuz açılış, geç başlayan konu</td><td>Girişi kısalt, ilk cümlede başlığın vaadini tekrar et</td></tr>
    <tr><td>Ortada belirgin bir çukur</td><td>Konu dışı bir bölüm, uzun teknik detay, tempo düşüşü</td><td>O bölümü kısalt veya araya görsel destek ekle</td></tr>
    <tr><td>Belirli bir noktada yükseliş</td><td>İzleyiciler o kısmı tekrar izliyor veya oraya atlıyor</td><td>Bu konuyu ayrı bir video veya seri olarak değerlendir</td></tr>
    <tr><td>Videonun sonundan önce toplu çıkış</td><td>İzleyici videonun bittiğini düşünüyor (uzun kapanış)</td><td>Kapanışı kısalt, son bölümü bir sonraki videoya köprü yap</td></tr>
  </tbody>
</table>
<h3>Ortalama izlenme süresi mi, ortalama izlenme yüzdesi mi?</h3>
<p>Studio'da iki benzer metrik görürsün. Ortalama izlenme süresi, izleyicilerin videoyu ortalama kaç dakika izlediğini; ortalama izlenme yüzdesi ise videonun ortalama ne kadarının izlendiğini gösterir. İkisini birlikte değerlendir. Örnek senaryo: 4 dakikalık bir videonun yüzde 60'ının izlenmesi yaklaşık 2,4 dakika eder; 15 dakikalık bir videonun yüzde 30'unun izlenmesi ise yaklaşık 4,5 dakika eder. Yüzde daha düşük olsa da ikinci video, izleyici başına daha fazla izlenme süresi kazandırır. Bu yüzden kısa videoları sadece yüksek yüzde aldıkları için, uzun videoları da sadece düşük yüzde aldıkları için yargılama; her zaman dakika karşılığına da bak.</p>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Bilgi</strong><p>Grafik, videoyu izleyen gerçek kitlenin davranışını gösterdiği için her videon bir derstir. En iyi ve en kötü performans gösteren üç videonun grafiklerini yan yana koyduğunda, kanalına özel kalıpları kısa sürede görmeye başlarsın.</p></div>
<h2>Video iskeleti: izleyiciyi sonuna kadar taşımak</h2>
<p>İzleyiciyi tutmanın en güvenilir yolu, her videoyu bilinçli bir iskelete göre kurmaktır. Bu iskelet çoğu bilgi verici ve eğlenceli video türüne uyarlanabilir:</p>
<ol class="crs-steps">
  <li><strong>Kanca (ilk 5-15 saniye).</strong> Başlığın vaadini hemen doğrula ve izleyiciye neden sonuna kadar kalması gerektiğini söyle. Sonucu kısaca göster veya en ilginç anı öne al.</li>
  <li><strong>Kısa yol haritası.</strong> Videoda ne olacağını bir cümleyle anlat: "Önce üç hatayı, sonra doğru yöntemi göstereceğim."</li>
  <li><strong>İçerik blokları.</strong> Konuyu küçük bölümlere ayır. Her bölümün sonunda bir sonraki bölüm için küçük bir merak cümlesi kur.</li>
  <li><strong>Ödül.</strong> Videonun en değerli kısmını sona saklama ama en güçlü örneği veya sonucu son üçte bire yerleştir ki izleyici kalmak için sebep bulsun.</li>
  <li><strong>Köprü.</strong> Videoyu uzun bir vedayla bitirme. Son cümlede izleyiciyi doğrudan ilgili bir sonraki videoya yönlendir.</li>
</ol>
<div class="crs-template"><span class="crs-template-label">Kanca şablonu</span><p>"[Sorun] yaşıyorsan bu videonun sonunda [sonuç] elde edeceksin. Çoğu kişinin yaptığı [hata] ile başlayalım, çünkü muhtemelen sen de yapıyorsun."</p></div>
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Dikkat</strong><p>Videoya uzun bir logo animasyonu, "herkese merhaba, nasılsınız, kanalıma hoş geldiniz" konuşması veya abone olma hatırlatmasıyla başlamak, izleyicinin en çok ayrıldığı ilk saniyeleri boşa harcar. Abone hatırlatmasını izleyiciye değer verdikten sonra, videonun ortasına veya sonuna yakın bir yere koy.</p></div>
<h2>Tempoyu koruyan kurgu teknikleri</h2>
<p>Pahalı bir kurgu programına veya profesyonel ekipmana ihtiyacın yok. Telefondaki ücretsiz kurgu uygulamalarıyla bile uygulayabileceğin teknikler şunlardır:</p>
<ul class="crs-checklist">
  <li>Sessizlikleri, "ıı", "şey" gibi dolgu sözcüklerini ve tekrar eden cümleleri kes</li>
  <li>Aynı görüntü uzun süre ekranda kalmasın; açı değişikliği, yakın çekim veya ara görüntü (b-roll) ekle</li>
  <li>Önemli bilgileri ekranda kısa yazılarla destekle</li>
  <li>Uzun videolara bölümler (chapters) ekle; izleyici aradığını bulur ve videodan çıkmak yerine ilgili bölüme atlar</li>
  <li>Sesin net olsun; izleyiciler bulanık görüntüyü çoğu zaman sesi anlaşılmaz bir videodan daha kolay tolere eder</li>
  <li>Müzik kullanıyorsan lisanslı olsun ve konuşmanın önüne geçmesin</li>
</ul>
<div class="crs-callout tip"><strong class="crs-callout-title">💡 İpucu</strong><p>Videoyu yayınlamadan önce bir kez de 1,5 hızda izle. Sıkıldığın veya ileri sarmak istediğin her yer, izleyicinin de çıkabileceği bir noktadır. O kısımları kısalt.</p></div>
<h2>Video ne kadar uzun olmalı?</h2>
<p>Tek doğru uzunluk yoktur. Doğru uzunluk, konuyu eksiksiz anlatan en kısa süredir. Yazıldığı tarihte YouTube, 8 dakika ve üzeri videolarda videonun ortasına ara reklam (mid-roll) eklemene izin veriyor ve bu, reklam gelirini etkileyen faktörlerden biri. Ancak sırf bu sınırı geçmek için videoyu uzatmak çoğu zaman ters teper: izleyici sıkılıp erken ayrılır ve videonun genel performansı düşer.</p>
<div class="crs-compare">
  <div class="crs-compare-col bad"><strong class="crs-compare-title">❌ Yanlış</strong><ul><li>Videoyu 8 dakikaya tamamlamak için aynı şeyi tekrar anlatmak</li><li>Konuya 1 dakikalık girişten sonra başlamak</li><li>Tüm detayları tek seferde, tek açıdan anlatmak</li></ul></div>
  <div class="crs-compare-col good"><strong class="crs-compare-title">✅ Doğru</strong><ul><li>Konu gerektiriyorsa uzun, gerektirmiyorsa kısa video</li><li>İlk cümlede vaadi doğrulayıp hemen konuya girmek</li><li>Bölümler, ara görüntüler ve örneklerle tempoyu korumak</li></ul></div>
</div>
<div class="crs-callout danger"><strong class="crs-callout-title">⛔ Bunu yapma</strong><p>İzlenme süresini artırmak için videonun sonuna uzun siyah ekran, döngüye alınmış görüntü veya alakasız içerik ekleme. Bu tür yöntemler izleyiciye değer katmaz, kanalının güvenilirliğini zedeler ve YouTube'un spam ve aldatıcı uygulamalar politikalarıyla çelişebilir.</p></div>
<p>İzleyiciyi uzun videoda tutmayı öğrendin. Peki Shorts bu tabloda nereye oturuyor? Bir sonraki derste Shorts ile uzun videoyu nasıl dengeleyeceğini ve Shorts izleyicisini uzun videolarına nasıl taşıyabileceğini konuşacağız.</p>
<div class="crs-keypoints"><strong class="crs-callout-title">📌 Bu derste öğrendiklerin</strong><ul><li>Kitleyi elde tutma grafiğindeki ani düşüşler ve yükselişler, videonun hangi anlarının işe yarayıp yaramadığını gösterir.</li><li>İlk 30 saniye kritik: girişi kısalt ve başlığın vaadini hemen doğrula.</li><li>Kanca, yol haritası, içerik blokları, ödül ve köprüden oluşan iskelet izleyiciyi sonuna kadar taşır.</li><li>Sessizlikleri kesmek, görüntüyü değiştirmek ve bölümler eklemek tempoyu korur.</li><li>Doğru uzunluk, konuyu eksiksiz anlatan en kısa süredir; videoyu yapay olarak uzatma.</li></ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Görevin</strong><p>Kanalındaki en iyi ve en kötü performans gösteren videonun kitleyi elde tutma grafiklerini aç ve ilk 30 saniyedeki kaybı, ortadaki çukurları ve sondaki çıkışları not et. Henüz videon yoksa bir sonraki videonun senaryosunu beş adımlı iskelete göre yaz ve kanca şablonuyla üç farklı giriş cümlesi dene. Yayınlamadan önce videoyu 1,5 hızda izleyip sıkıldığın yerleri kısalt.</p></div>
`,
  content_en: `
<p>Remember the math from the first lesson: the longer your average view duration, the fewer views you need to reach 4,000 hours. But retention matters for more than that calculation. Viewers continuing to watch is one of the strong signals that a video is valuable to them, and it increases the chance of the video reaching more people through recommendations.</p>
<p>In this lesson you will learn to read the audience retention graph in YouTube Studio, build an opening that grabs viewers in the first seconds and use editing techniques that hold the pace throughout the video.</p>
<!--GORSEL-->
<h2>How to read the audience retention graph</h2>
<p>When you open a video's Analytics page in Studio, you will see the "Audience retention" graph. It shows what percentage of viewers are still watching at every moment of the video. On some accounts the graph also compares the video with your other videos of similar length.</p>
<p>Focus on two things when you look at the graph: <mark>how many viewers you lose in the first 30 seconds</mark> and where the graph suddenly drops or rises. A sudden drop means viewers got bored or did not find what they wanted at that moment; a rise means people rewound to watch that part again or skipped ahead to it.</p>
<table class="crs-table red">
  <thead><tr><th>What you see on the graph</th><th>Likely cause</th><th>What to do</th></tr></thead>
  <tbody>
    <tr><td>Sharp drop in the first 10 to 30 seconds</td><td>Long intro, an opening that does not match the title, topic starts too late</td><td>Shorten the intro, restate the title's promise in the first sentence</td></tr>
    <tr><td>A clear dip in the middle</td><td>An off-topic section, a long technical detail, a drop in pace</td><td>Shorten that section or add visual support</td></tr>
    <tr><td>A rise at a certain point</td><td>Viewers are rewatching or skipping to that part</td><td>Consider turning this topic into its own video or series</td></tr>
    <tr><td>Mass exit before the end</td><td>Viewers think the video is over (long outro)</td><td>Shorten the outro, turn the final part into a bridge to your next video</td></tr>
  </tbody>
</table>
<h3>Average view duration or average percentage viewed?</h3>
<p>Studio shows you two similar metrics. Average view duration is how many minutes viewers watched on average; average percentage viewed is how much of the video they watched on average. Look at them together. Example scenario: 60 percent of a 4-minute video is about 2.4 minutes, while 30 percent of a 15-minute video is about 4.5 minutes. Even with a lower percentage, the second video earns more watch time per viewer. So do not praise short videos just for their high percentage or dismiss long ones just for their low percentage; always check the minutes too.</p>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Good to know</strong><p>Because the graph shows how your real audience behaves, every video is a lesson. When you put the graphs of your three best and three worst performing videos side by side, you will quickly start to see patterns specific to your channel.</p></div>
<h2>A video skeleton: carrying viewers to the end</h2>
<p>The most reliable way to keep viewers is to build every video on a deliberate skeleton. This structure adapts to most informative and entertaining formats:</p>
<ol class="crs-steps">
  <li><strong>Hook (first 5 to 15 seconds).</strong> Confirm the title's promise right away and tell viewers why they should stay to the end. Briefly show the result or bring the most interesting moment forward.</li>
  <li><strong>Short roadmap.</strong> Say in one sentence what will happen: "First I will show you three mistakes, then the right method."</li>
  <li><strong>Content blocks.</strong> Split the topic into small sections. End each section with a short line that builds curiosity for the next one.</li>
  <li><strong>Payoff.</strong> Do not hide all the value at the very end, but place your strongest example or result in the final third so viewers have a reason to stay.</li>
  <li><strong>Bridge.</strong> Do not end with a long goodbye. In your last sentence, point viewers straight to a related next video.</li>
</ol>
<div class="crs-template"><span class="crs-template-label">Hook template</span><p>"If you are dealing with [problem], by the end of this video you will [result]. Let us start with [mistake] that most people make, because you are probably making it too."</p></div>
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Watch out</strong><p>Opening with a long logo animation, a "hi everyone, how are you, welcome to my channel" speech or a subscribe reminder wastes the first seconds, which is exactly when most viewers leave. Put the subscribe reminder after you have delivered value, somewhere in the middle or near the end.</p></div>
<h2>Editing techniques that hold the pace</h2>
<p>You do not need expensive editing software or professional gear. Here are techniques you can apply even with free editing apps on your phone:</p>
<ul class="crs-checklist">
  <li>Cut silences, filler words like "um" and "uh", and repeated sentences</li>
  <li>Do not leave the same shot on screen for too long; add angle changes, close-ups or b-roll</li>
  <li>Support key information with short on-screen text</li>
  <li>Add chapters to longer videos; viewers find what they need and jump to it instead of leaving</li>
  <li>Keep your audio clear; viewers often tolerate a soft image more easily than sound they cannot understand</li>
  <li>If you use music, make sure it is licensed and does not drown out your voice</li>
</ul>
<div class="crs-callout tip"><strong class="crs-callout-title">💡 Tip</strong><p>Before publishing, watch your video once at 1.5x speed. Every spot where you get bored or want to skip ahead is a spot where viewers may leave. Trim those parts.</p></div>
<h2>How long should a video be?</h2>
<p>There is no single right length. The right length is the shortest time that covers the topic fully. At the time of writing, YouTube lets you place mid-roll ads in videos that are 8 minutes or longer, and that is one of the factors that affects ad revenue. But stretching a video just to pass that mark usually backfires: viewers get bored and leave early, and the video's overall performance drops.</p>
<div class="crs-compare">
  <div class="crs-compare-col bad"><strong class="crs-compare-title">❌ Wrong</strong><ul><li>Repeating the same point to stretch the video to 8 minutes</li><li>Getting to the topic after a one-minute intro</li><li>Explaining every detail in one go, from one angle</li></ul></div>
  <div class="crs-compare-col good"><strong class="crs-compare-title">✅ Right</strong><ul><li>Long video when the topic needs it, short when it does not</li><li>Confirming the promise in the first sentence and diving in</li><li>Holding the pace with chapters, b-roll and examples</li></ul></div>
</div>
<div class="crs-callout danger"><strong class="crs-callout-title">⛔ Don't do this</strong><p>Do not add long black screens, looped footage or unrelated content to the end of a video to inflate watch time. Tactics like these add no value for viewers, damage your channel's credibility and can conflict with YouTube's spam and deceptive practices policies.</p></div>
<p>You have learned how to keep viewers in long-form videos. So where do Shorts fit into this picture? In the next lesson we talk about balancing Shorts and long-form and how to move your Shorts audience over to your longer videos.</p>
<div class="crs-keypoints"><strong class="crs-callout-title">📌 Key takeaways</strong><ul><li>Sudden drops and rises in the audience retention graph show which moments of a video work and which do not.</li><li>The first 30 seconds are critical: shorten the intro and confirm the title's promise right away.</li><li>A skeleton of hook, roadmap, content blocks, payoff and bridge carries viewers to the end.</li><li>Cutting silences, changing shots and adding chapters keeps the pace up.</li><li>The right length is the shortest time that fully covers the topic; never pad a video artificially.</li></ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Your task</strong><p>Open the audience retention graphs of your best and worst performing videos and note the loss in the first 30 seconds, any dips in the middle and exits near the end. If you have no videos yet, script your next video using the five-step skeleton and try three different opening lines with the hook template. Before publishing, watch the video at 1.5x speed and trim every part where you got bored.</p></div>
`
};
