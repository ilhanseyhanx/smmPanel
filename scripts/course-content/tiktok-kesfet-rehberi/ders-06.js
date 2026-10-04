'use strict';
module.exports = {
  slug: 'yayin-sikligi-test-ve-analizler',
  title_tr: 'Yayın Sıklığı, Test Etme ve TikTok Analizlerini Okumak',
  title_en: 'Posting Frequency, Testing and Reading TikTok Analytics',
  summary_tr: 'Sürdürülebilir bir yayın sıklığı belirlemeyi, her seferinde tek bir değişkeni test etmeyi ve TikTok analizlerindeki izlenme süresi, tamamlama ve trafik kaynağı verilerini karar almak için okumayı öğren.',
  summary_en: 'Learn to set a sustainable posting frequency, test one variable at a time and read watch time, completion and traffic source data in TikTok analytics to make decisions.',
  visual: {
    type: 'bars',
    title_tr: 'Neyi önce test etmeli? (göreli öncelik)',
    title_en: 'What to test first (relative priority)',
    items: [
      { tr: 'Kanca ve ilk kare', en: 'Hook and first frame', value: 100 },
      { tr: 'Konu ve format', en: 'Topic and format', value: 85 },
      { tr: 'Video uzunluğu', en: 'Video length', value: 70 },
      { tr: 'Ses seçimi', en: 'Sound choice', value: 50 },
      { tr: 'Yayın saati', en: 'Posting time', value: 30 }
    ]
  },
  content_tr: `<p>Önceki derslerde iyi bir TikTok videosunun parçalarını tek tek kurdun: kanca, kurgu, ses ve arama. Ama hangi parçanın senin hesabında, senin kitlende gerçekten işe yaradığını tahminle bilemezsin. Bunu öğrenmenin yolu düzenli yayın yapmak, her seferinde küçük bir şeyi değiştirmek ve sonucu TikTok'un kendi analizlerinden okumaktır.</p>
<p>Bu derste önce sürdürülebilir bir yayın sıklığı belirleyecek, sonra analiz ekranlarında neye bakman gerektiğini görecek ve son olarak "bir değişken, birkaç video, net karar" mantığıyla çalışan basit bir test sistemi kuracaksın.</p>
<!--GORSEL-->
<h2>Ne sıklıkla yayın yapmalısın?</h2>
<p>TikTok'un herkes için geçerli ideal bir yayın sayısı açıkladığı resmi bir kural yok. İnternette "günde 3 video şart" gibi tavsiyeler görebilirsin, ama bunlar kişisel deneyimlerdir. Daha önemli olan iki şey var: <mark>sürdürülebilirlik ve öğrenme hızı</mark>. Ne kadar çok video yayınlarsan o kadar çok veri toplarsın; ama kaliteyi düşürecek veya birkaç hafta sonra bırakacağın bir tempo, hiç başlamamaktan farksızdır.</p>
<table class="crs-table purple">
  <thead><tr><th>Tempo</th><th>Kimin için</th><th>Artısı</th><th>Dikkat edilecek nokta</th></tr></thead>
  <tbody>
    <tr><td><strong>Haftada 3 video</strong></td><td>İşletmesini yürütürken içerik üreten, zamanı kısıtlı kişiler</td><td>Sürdürmesi kolay, kaliteyi korur</td><td><span class="crs-badge mid">Yavaş öğrenme</span> Test sonuçları daha geç netleşir</td></tr>
    <tr><td><strong>Haftada 5 video</strong></td><td>Haftada bir toplu çekim günü ayırabilenler</td><td>Dengeli veri ve emek</td><td><span class="crs-badge good">Çoğu kişi için iyi başlangıç</span></td></tr>
    <tr><td><strong>Her gün veya daha sık</strong></td><td>İçerik üretimini ana iş olarak yapanlar</td><td>Hızlı veri, hızlı öğrenme</td><td><span class="crs-badge bad">Tükenme riski</span> Kalite düşerse veriler de yanıltıcı olur</td></tr>
  </tbody>
</table>
<div class="crs-callout danger"><strong class="crs-callout-title">⛔ Bunu yapma</strong><p>Düşük izlenen videoları toplu olarak silmek veya aynı videoyu kısa aralıklarla defalarca yeniden yüklemek bir "sıfırlama" yöntemi değildir. Bunun işe yaradığına dair TikTok'un açıkladığı bir bilgi yok; aynı içeriğin tekrar tekrar yüklenmesi ise spam gibi algılanabilir. Bir videoyu yeniden denemek istiyorsan kancasını veya kurgusunu değiştirip yeni bir versiyon olarak paylaş.</p></div>
<h2>TikTok analizlerinde neye bakmalısın?</h2>
<p>TikTok'ta analizlere profilindeki menüden (güncel sürümlerde içerik üretici araçları veya TikTok Studio altında) ulaşabilirsin. Menü adları ve bölümler güncellemelerle değişebilir; aşağıdaki başlıklar yazıldığı tarihteki (2026) genel yapıyı anlatır.</p>
<h3>Video bazında veriler</h3>
<ul>
  <li><strong>Toplam izlenme ve izleyici sayısı:</strong> Videonun kaç kez oynatıldığı ve kaç farklı kişiye ulaştığı.</li>
  <li><strong>Ortalama izlenme süresi ve tamamen izleyenlerin oranı:</strong> Üçüncü derste gördüğün iki temel ölçü.</li>
  <li><strong>Elde tutma grafiği:</strong> İzleyicilerin hangi saniyede ayrıldığı.</li>
  <li><strong>Trafik kaynağı:</strong> İzlenmelerin For You, takip edilenler, profil, arama veya ses sayfası gibi hangi yerden geldiği.</li>
  <li><strong>Etkileşimler:</strong> Beğeni, yorum, paylaşım, kaydetme ve videodan gelen yeni takipçiler.</li>
</ul>
<h3>Etkileşimleri birbirinden ayır</h3>
<p>Bütün etkileşimler aynı şeyi anlatmaz. Beğeni hızlı ve zahmetsiz bir tepkidir. Yorum, videonun bir soru ya da tartışma başlattığını gösterir. Paylaşım, izleyicinin videoyu bir başkasına göstermeye değer bulduğu anlamına gelir. Kaydetme ise içeriğin daha sonra dönülecek kadar faydalı görüldüğünün işaretidir. TikTok bu etkileşimlerin birbirine göre ağırlığını açıklamadı; ama hangi tür etkileşimi daha çok aldığına bakmak, içeriğinin izleyicide nasıl bir karşılık bulduğunu anlamana yardım eder. Örneğin çok kaydedilen bir ipucu videosu, aynı konuda bir seri için güçlü bir aday olabilir.</p>
<h3>Trafik kaynağını yorumlamak</h3>
<table class="crs-table green">
  <thead><tr><th>Baskın kaynak</th><th>Muhtemel anlamı</th><th>Sonraki adım</th></tr></thead>
  <tbody>
    <tr><td><strong>For You</strong></td><td>Video, takipçilerin dışındaki kişilere öneriliyor</td><td>Bu videonun kancasını ve formatını yeni konularda tekrar dene</td></tr>
    <tr><td><strong>Arama</strong></td><td>Anahtar kelime ve açıklama çalışması işe yarıyor</td><td>Aynı konu kümesinde yeni videolar üret</td></tr>
    <tr><td><strong>Profil veya takip edilenler</strong></td><td>İzleyenler çoğunlukla seni zaten tanıyanlar</td><td>Yeni kitleye ulaşmak için kancayı ve konuyu genişlet</td></tr>
    <tr><td><strong>Ses sayfası</strong></td><td>Kullandığın ses üzerinden keşfediliyorsun</td><td>Trend uyarlamalarına devam et, zamanlamaya dikkat et</td></tr>
  </tbody>
</table>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Bilgi</strong><p>Analizlerde takipçilerinin uygulamada en aktif olduğu saatleri de görebilirsin. Bu bilgi işe yarar, ama For You akışı yalnızca takipçilerden oluşmadığı için yayın saati, kanca ve konu kadar büyük bir kaldıraç olmayabilir. Bu yüzden görseldeki öncelik sıralamasında en sonda yer alıyor.</p></div>
<h2>Bir değişken, birkaç video, net karar</h2>
<p>Test etmenin en sık yapılan hatası, aynı anda her şeyi değiştirmektir. Yeni bir kanca, yeni bir ses, yeni bir uzunluk ve yeni bir saatle yayınlanan video iyi giderse, hangisinin işe yaradığını bilemezsin. Tek videonun sonucu da şansa bağlı olabilir; bu yüzden bir değişkeni birkaç videoda deneyip karar vermek daha güvenilirdir.</p>
<ol class="crs-steps">
  <li><strong>Kendi ortalamanı çıkar.</strong> Son 10 videonun ortalama izlenme süresini, tamamlama oranını ve izlenmesini bir tabloya yaz. Bu senin referans noktan.</li>
  <li><strong>Bir hipotez yaz.</strong> Örneğin: "Sonuçtan başlayan kancalar, soru ile başlayanlardan daha uzun izleniyor."</li>
  <li><strong>Tek değişkeni değiştir.</strong> Konu, uzunluk ve ses benzer kalsın; yalnızca kanca türü değişsin.</li>
  <li><strong>Birkaç video boyunca dene.</strong> Her versiyon için en az 3 video yayınla ve hepsinin verisinin oturmasını bekle.</li>
  <li><strong>Ortalamayla karşılaştır ve karar ver.</strong> Fark belirginse yeni yöntemi varsayılan yap; değilse bir sonraki değişkene geç.</li>
</ol>
<div class="crs-template"><span class="crs-template-label">Test kaydı şablonu</span><p>Tarih: ...<br>Hipotez: ...<br>Değişen tek şey: ...<br>Video 1 / 2 / 3: izlenme, ortalama izlenme süresi, tamamlama, baskın trafik kaynağı<br>Hesap ortalaması: ...<br>Karar: devam / bırak / yeniden test et</p></div>
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Dikkat</strong><p>Analiz verileri yayından hemen sonra tam oturmayabilir ve videolar bazen günler sonra yeniden izlenmeye başlayabilir. Karşılaştırma yaparken tüm videoları yayından aynı süre sonra (örneğin 3. ya da 7. günde) ölç; böylece eski video ile yeni videoyu adil şekilde kıyaslarsın.</p></div>
<div class="crs-callout tip"><strong class="crs-callout-title">💡 İpucu</strong><p>Test kaydını bir not uygulamasında veya basit bir tabloda tut. Üç ay sonra geriye baktığında, hesabında neyin işe yaradığına dair sana özel bir rehberin olur; bu, internetteki genel tavsiyelerden çok daha değerlidir.</p></div>
<ul class="crs-checklist">
  <li>Haftalık yayın sayımı sürdürebileceğim şekilde belirledim.</li>
  <li>Son 10 videomun ortalama değerlerini çıkardım.</li>
  <li>Bu hafta test edeceğim tek bir değişken seçtim.</li>
  <li>Ölçüm gününü sabitledim (ör. yayından sonraki 7. gün).</li>
  <li>Sonuçları test kaydına yazıyorum.</li>
</ul>
<p>Artık kanca, kurgu, ses, arama ve ölçümü bir araya getirecek araçların hepsi elinde. Son derste bunları tek bir 30 günlük Keşfet deneme planında birleştireceğiz.</p>
<div class="crs-keypoints"><strong class="crs-callout-title">📌 Bu derste öğrendiklerin</strong><ul><li>TikTok'un herkes için ideal bir yayın sayısı yok; sürdürülebilir tempo ve öğrenme hızı önemlidir.</li><li>Toplu silme veya aynı videoyu tekrar tekrar yükleme bir sıfırlama yöntemi değildir.</li><li>Video bazında izlenme süresi, tamamlama, elde tutma ve trafik kaynağı en faydalı verilerdir.</li><li>Trafik kaynağı, videonun For You, arama, profil veya ses üzerinden mi bulunduğunu gösterir.</li><li>Tek değişken, birkaç video ve sabit ölçüm günüyle test etmek güvenilir kararlar verdirir.</li></ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Görevin</strong><p>Son 10 videonun verilerini bir tabloya geçir ve hesap ortalamanı çıkar. Görseldeki öncelik sırasına göre test edeceğin ilk değişkeni seç, bir hipotez yaz ve test kaydı şablonunu doldurmaya başla.</p></div>`,
  content_en: `<p>In the earlier lessons you built the parts of a good TikTok video one by one: hook, edit, sound and search. But you can't know by guessing which parts actually work on your account, with your audience. The way to find out is to post regularly, change one small thing at a time and read the results in TikTok's own analytics.</p>
<p>In this lesson you'll first set a sustainable posting frequency, then see what to look at in the analytics screens, and finally build a simple test system based on "one variable, several videos, a clear decision".</p>
<!--GORSEL-->
<h2>How often should you post?</h2>
<p>TikTok hasn't published an official ideal posting number that applies to everyone. You'll see advice online like "you must post 3 times a day", but that comes from personal experience. Two things matter more: <mark>sustainability and learning speed</mark>. The more videos you publish, the more data you collect; but a pace that drags down quality, or that you'll abandon after a few weeks, is no better than never starting.</p>
<table class="crs-table purple">
  <thead><tr><th>Pace</th><th>Who it suits</th><th>Upside</th><th>What to watch</th></tr></thead>
  <tbody>
    <tr><td><strong>3 videos a week</strong></td><td>People creating content while running a business, short on time</td><td>Easy to sustain, protects quality</td><td><span class="crs-badge mid">Slower learning</span> Test results take longer to become clear</td></tr>
    <tr><td><strong>5 videos a week</strong></td><td>People who can set aside one batch-filming day a week</td><td>Balanced data and effort</td><td><span class="crs-badge good">A good start for most</span></td></tr>
    <tr><td><strong>Daily or more</strong></td><td>People for whom content is the main job</td><td>Fast data, fast learning</td><td><span class="crs-badge bad">Burnout risk</span> If quality drops, the data becomes misleading too</td></tr>
  </tbody>
</table>
<div class="crs-callout danger"><strong class="crs-callout-title">⛔ Don't do this</strong><p>Mass-deleting low-performing videos or re-uploading the same video again and again at short intervals is not a "reset" method. TikTok hasn't published anything suggesting it works, and repeatedly uploading the same content may be seen as spam. If you want to retry a video, change its hook or edit and share it as a new version.</p></div>
<h2>What to look at in TikTok analytics</h2>
<p>You can reach analytics from the menu on your profile (in recent versions under creator tools or TikTok Studio). Menu names and sections may change with updates; the headings below describe the general structure at the time of writing (2026).</p>
<h3>Per-video data</h3>
<ul>
  <li><strong>Total views and viewers:</strong> how many times the video played and how many different people it reached.</li>
  <li><strong>Average watch time and watched full video:</strong> the two core metrics from lesson three.</li>
  <li><strong>Retention graph:</strong> the second at which viewers left.</li>
  <li><strong>Traffic source:</strong> where views came from, such as For You, Following, your profile, search or the sound page.</li>
  <li><strong>Engagement:</strong> likes, comments, shares, saves and new followers from the video.</li>
</ul>
<h3>Tell engagement types apart</h3>
<p>Not all engagement says the same thing. A like is a quick, effortless reaction. A comment shows the video sparked a question or a discussion. A share means the viewer thought it was worth showing to someone else. A save signals the content was useful enough to come back to later. TikTok hasn't disclosed how these interactions are weighted against each other, but looking at which type you get most helps you understand how your content lands. A tip video with lots of saves, for example, may be a strong candidate for a series on the same topic.</p>
<h3>Interpreting traffic sources</h3>
<table class="crs-table green">
  <thead><tr><th>Main source</th><th>Likely meaning</th><th>Next step</th></tr></thead>
  <tbody>
    <tr><td><strong>For You</strong></td><td>The video is being recommended beyond your followers</td><td>Reuse this video's hook and format on new topics</td></tr>
    <tr><td><strong>Search</strong></td><td>Your keyword and caption work is paying off</td><td>Make new videos in the same topic cluster</td></tr>
    <tr><td><strong>Profile or Following</strong></td><td>Viewers are mostly people who already know you</td><td>Broaden the hook and topic to reach new audiences</td></tr>
    <tr><td><strong>Sound page</strong></td><td>You're being discovered through the sound you used</td><td>Keep adapting trends and watch your timing</td></tr>
  </tbody>
</table>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Good to know</strong><p>Analytics also show the hours when your followers are most active in the app. That's useful, but because the For You feed isn't made up only of followers, posting time may not be as big a lever as hook and topic. That's why it sits last in the priority order in the visual.</p></div>
<h2>One variable, several videos, a clear decision</h2>
<p>The most common testing mistake is changing everything at once. If a video with a new hook, a new sound, a new length and a new posting time does well, you can't tell which change worked. A single video's result can also come down to luck, so trying one variable across several videos before deciding is more reliable.</p>
<ol class="crs-steps">
  <li><strong>Work out your own average.</strong> Put the average watch time, completion rate and views of your last 10 videos into a table. That's your reference point.</li>
  <li><strong>Write a hypothesis.</strong> For example: "Result-first hooks get watched longer than question hooks."</li>
  <li><strong>Change one variable.</strong> Keep topic, length and sound similar; change only the hook type.</li>
  <li><strong>Run it across several videos.</strong> Publish at least 3 videos per version and let all their data settle.</li>
  <li><strong>Compare with your average and decide.</strong> If the difference is clear, make the new approach your default; if not, move on to the next variable.</li>
</ol>
<div class="crs-template"><span class="crs-template-label">Test log template</span><p>Date: ...<br>Hypothesis: ...<br>The one thing that changed: ...<br>Video 1 / 2 / 3: views, average watch time, completion, main traffic source<br>Account average: ...<br>Decision: keep / drop / retest</p></div>
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Watch out</strong><p>Analytics data may not settle right after publishing, and videos sometimes start getting views again days later. When comparing, measure every video the same amount of time after posting (for example on day 3 or day 7) so old and new videos are compared fairly.</p></div>
<div class="crs-callout tip"><strong class="crs-callout-title">💡 Tip</strong><p>Keep your test log in a notes app or a simple spreadsheet. When you look back after three months, you'll have a personal guide to what works on your account, which is far more valuable than generic advice online.</p></div>
<ul class="crs-checklist">
  <li>I set a weekly posting number I can sustain.</li>
  <li>I calculated the averages of my last 10 videos.</li>
  <li>I picked one variable to test this week.</li>
  <li>I fixed my measurement day (e.g. day 7 after posting).</li>
  <li>I'm writing results into my test log.</li>
</ul>
<p>You now have every tool you need to bring hooks, editing, sound, search and measurement together. In the final lesson we'll combine them into one 30-day For You experiment plan.</p>
<div class="crs-keypoints"><strong class="crs-callout-title">📌 Key takeaways</strong><ul><li>There's no ideal posting number for everyone on TikTok; sustainable pace and learning speed matter most.</li><li>Mass deleting or repeatedly re-uploading the same video is not a reset method.</li><li>Per-video watch time, completion, retention and traffic source are the most useful data.</li><li>Traffic source shows whether a video was found through For You, search, your profile or a sound.</li><li>Testing one variable across several videos with a fixed measurement day leads to reliable decisions.</li></ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Your task</strong><p>Move the data from your last 10 videos into a table and calculate your account average. Following the priority order in the visual, choose the first variable to test, write a hypothesis and start filling in the test log template.</p></div>`
};
