'use strict';
module.exports = {
  slug: 'instagram-analizleri-hangi-metrik',
  title_tr: 'Instagram Analizleri: Hangi Metriğe Bakmalısın?',
  title_en: 'Instagram Insights: Which Metrics Should You Watch?',
  summary_tr: 'Analiz ekranındaki onlarca rakamın hepsi aynı derecede önemli değil. Bu derste büyüme yolculuğunda gerçekten yol gösteren metrikleri, kendi oranlarını hesaplamayı ve haftalık 30 dakikalık analiz rutinini öğreneceksin.',
  summary_en: 'Not every number on the insights screen matters equally. In this lesson you will learn which metrics actually guide your growth, how to calculate your own ratios and how to run a 30-minute weekly review.',
  visual: {
    type: 'funnel',
    title_tr: 'Görüntülemeden takipçiye giden yol',
    title_en: 'The path from views to followers',
    items: [
      { tr: 'Görüntüleme ve erişim', en: 'Views and reach' },
      { tr: 'Etkileşim: kaydet / gönder', en: 'Engagement: saves / sends' },
      { tr: 'Profil ziyareti', en: 'Profile visits' },
      { tr: 'Takip', en: 'Follows' }
    ]
  },
  content_tr: `
<p>Altı dersten beri içerik üretiyor, sohbet ediyor ve iş birliği kuruyorsun. Şimdi kritik bir soru var: Hangisi gerçekten işe yarıyor? Bu sorunun cevabı hislerde değil, verilerde. Instagram'ın profesyonel panelindeki analizler, hangi içeriğin kime ulaştığını ve izleyicilerin ne yaptığını gösterir. Ama bu ekranlarda o kadar çok rakam vardır ki, yeni başlayanlar ya hepsine boğulur ya da hiçbirine bakmaz.</p>
<p>Bu derste 0-10K aşamasında gerçekten yol gösteren metrikleri seçeceğiz, bunları anlamlı oranlara çevireceğiz ve haftada 30 dakikada tamamlanabilecek bir analiz rutini kuracağız. Unutma: Analizlere erişmek için 1. derste anlattığımız gibi profesyonel hesaba geçmiş olman gerekir.</p>
<!--GORSEL-->
<h2>Büyüme hunisi: rakamları doğru sırayla oku</h2>
<p>Bir kişinin seni takip etmesi bir anda olmaz; bir yolculuktur. Önce içeriğini görür (görüntüleme ve erişim), sonra içerikle etkileşime girer (izler, kaydeder, gönderir), ardından profiline gelir (profil ziyareti) ve son olarak takip eder. Bu hunideki her basamak, farklı bir sorunun cevabını verir. <mark>Bir sorun gördüğünde, huninin hangi basamağında koptuğunu bul.</mark></p>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Bilgi</strong><p>Instagram, metriklerin adlarını ve hesaplanma biçimlerini zaman zaman değiştirir. Örneğin yakın dönemde "görüntüleme" (views), farklı formatlar arasında ana ölçüt olarak öne çıkarıldı. Bu dersteki metrik adları yazıldığı tarihteki (2026) haliyle verilmiştir; uygulamandaki adlar farklıysa, en yakın karşılığını kullan.</p></div>
<h2>Hangi metrik ne anlatır?</h2>
<p>Aşağıdaki tablo, büyüme aşamasında en çok işine yarayacak metrikleri ve her birinin cevapladığı soruyu gösteriyor.</p>
<table class="crs-table blue">
<thead><tr><th>Metrik</th><th>Cevapladığı soru</th><th>Önemi</th></tr></thead>
<tbody>
<tr><td>Görüntüleme / erişilen hesaplar</td><td>İçeriğim kaç kişinin önüne çıktı?</td><td><span class="crs-badge good">Yüksek</span></td></tr>
<tr><td>Takip etmeyenlerin oranı</td><td>Yeni insanlara ulaşabiliyor muyum?</td><td><span class="crs-badge good">Yüksek</span></td></tr>
<tr><td>Ortalama izlenme süresi (Reels)</td><td>İnsanlar videomu ne kadar izliyor, kanca çalışıyor mu?</td><td><span class="crs-badge good">Yüksek</span></td></tr>
<tr><td>Kaydetme ve gönderme</td><td>İçerik saklanmaya ve paylaşılmaya değer mi?</td><td><span class="crs-badge good">Yüksek</span></td></tr>
<tr><td>Profil ziyareti</td><td>İçerik merak uyandırıp profilime getiriyor mu?</td><td><span class="crs-badge mid">Orta</span></td></tr>
<tr><td>Takip (gönderiden gelen)</td><td>Bu içerik kaç kişiyi takipçiye çevirdi?</td><td><span class="crs-badge good">Yüksek</span></td></tr>
<tr><td>Beğeni sayısı tek başına</td><td>İçerik hoşa gitti mi?</td><td><span class="crs-badge bad">Yanıltıcı olabilir</span></td></tr>
</tbody>
</table>
<p>Yazıldığı tarihte Instagram, bazı hesaplarda Reels için "atlama oranı" gibi videonun ilk saniyelerinde kaç kişinin kaydırıp geçtiğini gösteren ek metrikler de sunuyor. Hesabında görüyorsan, kancanın ne kadar iyi çalıştığını anlamak için çok değerli bir veridir.</p>
<h2>Kendi oranlarını hesapla</h2>
<p>Ham sayılar yanıltıcıdır. 10.000 görüntülemeli bir videonun 50 kaydetmesi ile 1.000 görüntülemeli bir videonun 40 kaydetmesi aynı şey değildir. İkinci video, kendisini görenler arasında çok daha değerli bulunmuştur. Bu yüzden sayıları erişime bölerek oranlara çevir.</p>
<div class="crs-template"><span class="crs-template-label">Formüller</span><p><strong>Kaydetme oranı</strong> = kaydetme ÷ erişilen hesaplar × 100<br><strong>Gönderme oranı</strong> = gönderme ÷ erişilen hesaplar × 100<br><strong>Profil dönüşümü</strong> = takip ÷ profil ziyareti × 100<br><br>Örnek senaryo (varsayımsal rakamlar): Bir carousel 2.000 hesaba ulaştı, 60 kez kaydedildi. Kaydetme oranı = 60 ÷ 2.000 × 100 = %3.</p></div>
<h3>Kitle bölümünü unutma</h3>
<p>Analizlerde içerik metriklerinin yanında bir de kitle bölümü bulunur: takipçilerinin yaş aralığı, cinsiyet dağılımı, en çok bulundukları şehirler ve en aktif oldukları saatler. Bu bölüm, 1. derste yazdığın hedef kitle cümlesinin gerçekle örtüşüp örtüşmediğini gösterir. Örnek senaryo: Kadıköy'deki bir kafe, takipçilerinin büyük kısmının başka şehirlerden geldiğini görürse, içeriklerinin genel kahve kültürüne kaydığını ve semt sakinlerine yeterince hitap etmediğini fark edebilir. Bu durumda içeriklere semtle ilgili konular ve konum etiketi eklemek iyi bir deney olur. Kitle verileri genellikle belirli bir takipçi sayısının üzerinde görünür hale gelir; hesabında henüz göremiyorsan bu normaldir.</p>
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Dikkat</strong><p>Kendi oranlarını internetteki "sektör ortalamalarıyla" kıyaslama. Bu ortalamalar farklı yöntemlerle, farklı hesaplardan ve farklı dönemlerden derlenir; senin nişine uymayabilir. Doğru kıyaslama, kendi hesabının geçmişiyle yapılır: Son 10 içeriğinin ortalama kaydetme oranını bul ve yeni içeriklerini buna göre değerlendir.</p></div>
<h2>Sorun teşhis tablosu</h2>
<p>Analizlerde bir sorun gördüğünde aşağıdaki tablo, huninin hangi noktasında koptuğunu ve ne yapabileceğini gösterir.</p>
<table class="crs-table red">
<thead><tr><th>Belirti</th><th>Olası sebep</th><th>Ne denemelisin?</th></tr></thead>
<tbody>
<tr><td>Görüntüleme çok düşük</td><td>Kanca zayıf, ilk saniyelerde kaydırılıyor</td><td>Aynı konuyu farklı kancalarla tekrar dene</td></tr>
<tr><td>Görüntüleme iyi, izlenme süresi düşük</td><td>Giriş uzun, tempo yavaş, vaat yerine gelmiyor</td><td>Kurguyu sıkılaştır, en güçlü bilgiyi sona sakla</td></tr>
<tr><td>İzleniyor ama kaydedilmiyor</td><td>Değer yoğunluğu düşük, başvuru niteliği yok</td><td>Liste, adım ya da kontrol listesi formatı dene</td></tr>
<tr><td>Profil ziyareti var, takip yok</td><td>Profil, gelen kişiye net bir vaat sunmuyor</td><td>Bio'yu ve son 9 gönderinin tutarlılığını gözden geçir</td></tr>
<tr><td>Takipçi artıyor, etkileşim düşüyor</td><td>Nişle ilgisiz kitle geliyor</td><td>Trend kovalamayı azalt, nişe dön</td></tr>
</tbody>
</table>
<h2>Haftalık 30 dakikalık analiz rutini</h2>
<p>Analizleri her gün açıp kontrol etmek, kaygı yaratır ve yanlış kararlara yol açar. Bir içeriğin performansı ilk saatlerde ve günlerde değişmeye devam eder. Bunun yerine haftada bir, sabit bir gün ve saatte 30 dakika ayır.</p>
<ol class="crs-steps">
<li><strong>Verileri tabloya aktar.</strong> Basit bir tablo hazırla: tarih, format, sütun, kanca, görüntüleme, erişim, kaydetme, gönderme, profil ziyareti, takip. Geçen haftanın içeriklerini ekle.</li>
<li><strong>Oranları hesapla.</strong> Her içerik için kaydetme, gönderme ve profil dönüşümü oranlarını bul.</li>
<li><strong>En iyi ve en zayıf iki içeriği seç.</strong> Aralarındaki farkı yaz: kanca mı, format mı, konu mu, uzunluk mu?</li>
<li><strong>Bir öğrenim çıkar.</strong> "Bu hafta öğrendiğim tek şey" cümlesini yaz. Örneğin: "Soru ile başlayan kancalar, iddia ile başlayanlardan daha uzun izlendi."</li>
<li><strong>Gelecek haftaya bir deney koy.</strong> Öğrenimi test edecek tek bir değişiklik planla. Aynı anda birden fazla şeyi değiştirirsen neyin işe yaradığını anlayamazsın.</li>
</ol>
<div class="crs-callout tip"><strong class="crs-callout-title">💡 İpucu</strong><p>Yeni bir hesapta rakamlar küçük olduğu için tek bir içeriğin sonucu tesadüf olabilir. Bir sonuca varmadan önce aynı türden en az 3-5 içeriğin ortalamasına bak. Örüntü, tek bir veri noktasından daha güvenilirdir.</p></div>
<div class="crs-callout danger"><strong class="crs-callout-title">⛔ Bunu yapma</strong><p>Bir içerik beklenenden az görüldü diye kısa süre içinde silme. Silmek, o içerikten öğrenebileceğin veriyi de yok eder. Zayıf performans gösteren içerikler, en değerli derslerin kaynağıdır.</p></div>
<p>Artık neyin işe yaradığını ölçebiliyorsun. Son derste öğrendiğin her şeyi bir araya getirip, ilk 90 günün için haftalara bölünmüş somut bir uygulama planı hazırlayacağız.</p>
<div class="crs-keypoints"><strong class="crs-callout-title">📌 Bu derste öğrendiklerin</strong><ul>
<li>Büyüme hunisi: görüntüleme, etkileşim, profil ziyareti ve takip.</li>
<li>Ham sayılar yerine erişime bölünmüş oranlarla değerlendir.</li>
<li>Kıyaslamayı internetteki ortalamalarla değil, kendi geçmişinle yap.</li>
<li>Sorun teşhis tablosu, huninin hangi basamağında koptuğunu gösterir.</li>
<li>Haftada bir, 30 dakikalık sabit bir analiz rutini yeterlidir.</li>
</ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Görevin</strong><p>Analiz tablonu oluştur ve son iki haftanın tüm içeriklerini ekle. Her biri için kaydetme, gönderme ve profil dönüşümü oranlarını hesapla. En iyi ve en zayıf içeriğini karşılaştırarak bu haftanın tek öğrenimini yaz ve gelecek hafta için bir deney planla.</p></div>
`,
  content_en: `
<p>For six lessons you have been creating content, starting conversations and building collaborations. Now comes a critical question: what is actually working? The answer isn't in your gut; it is in the data. The insights in Instagram's professional dashboard show which content reached whom and what viewers did. But these screens contain so many numbers that beginners either drown in all of them or look at none.</p>
<p>In this lesson we will pick the metrics that genuinely guide you in the 0-10K stage, turn them into meaningful ratios and set up a review routine you can finish in 30 minutes a week. Remember: to access insights you need a professional account, as covered in Lesson 1.</p>
<!--GORSEL-->
<h2>The growth funnel: read the numbers in the right order</h2>
<p>Someone following you doesn't happen in a single moment; it is a journey. First they see your content (views and reach), then they engage with it (watch, save, send), then they visit your profile (profile visits) and finally they follow. Each step in this funnel answers a different question. <mark>When you spot a problem, find the step where the funnel breaks.</mark></p>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Good to know</strong><p>Instagram changes the names and calculation of its metrics from time to time. For example, "views" was recently made the main measure across formats. The metric names in this lesson reflect the time of writing (2026); if the names in your app are different, use the closest equivalent.</p></div>
<h2>What does each metric tell you?</h2>
<p>The table below shows the metrics most useful during the growth stage and the question each one answers.</p>
<table class="crs-table blue">
<thead><tr><th>Metric</th><th>Question it answers</th><th>Importance</th></tr></thead>
<tbody>
<tr><td>Views / accounts reached</td><td>How many people saw my content?</td><td><span class="crs-badge good">High</span></td></tr>
<tr><td>Share of non-followers</td><td>Am I reaching new people?</td><td><span class="crs-badge good">High</span></td></tr>
<tr><td>Average watch time (Reels)</td><td>How long do people watch, is my hook working?</td><td><span class="crs-badge good">High</span></td></tr>
<tr><td>Saves and sends</td><td>Is the content worth keeping and sharing?</td><td><span class="crs-badge good">High</span></td></tr>
<tr><td>Profile visits</td><td>Does the content spark enough curiosity to visit my profile?</td><td><span class="crs-badge mid">Medium</span></td></tr>
<tr><td>Follows (from the post)</td><td>How many people did this post turn into followers?</td><td><span class="crs-badge good">High</span></td></tr>
<tr><td>Like count on its own</td><td>Did people enjoy it?</td><td><span class="crs-badge bad">Can mislead</span></td></tr>
</tbody>
</table>
<p>At the time of writing, Instagram also offers some accounts extra Reels metrics such as "skip rate", which shows how many people swiped away in the first seconds. If you see it on your account, it is very valuable data for judging how well your hook works.</p>
<h2>Calculate your own ratios</h2>
<p>Raw numbers mislead. A video with 10,000 views and 50 saves is not the same as one with 1,000 views and 40 saves. The second was valued far more by the people who saw it. So turn the numbers into ratios by dividing by reach.</p>
<div class="crs-template"><span class="crs-template-label">Formulas</span><p><strong>Save rate</strong> = saves ÷ accounts reached × 100<br><strong>Send rate</strong> = sends ÷ accounts reached × 100<br><strong>Profile conversion</strong> = follows ÷ profile visits × 100<br><br>Example scenario (hypothetical numbers): a carousel reached 2,000 accounts and was saved 60 times. Save rate = 60 ÷ 2,000 × 100 = 3%.</p></div>
<h3>Don't forget the audience section</h3>
<p>Alongside content metrics, insights include an audience section: your followers' age range, gender split, top cities and most active times. This section shows whether the audience statement you wrote in Lesson 1 matches reality. Example scenario: a neighbourhood cafe sees that most of its followers come from other cities and realises its content has drifted toward general coffee culture instead of speaking to local residents. Adding neighbourhood topics and location tags would then be a good experiment. Audience data usually becomes visible only above a certain follower count; if you can't see it on your account yet, that's normal.</p>
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Watch out</strong><p>Don't compare your ratios with "industry averages" you find online. Those averages are compiled with different methods, from different accounts and different periods, and may not fit your niche. The right comparison is with your own account's history: find the average save rate of your last 10 posts and judge new posts against it.</p></div>
<h2>Troubleshooting table</h2>
<p>When you see a problem in your insights, the table below shows where the funnel is breaking and what you can try.</p>
<table class="crs-table red">
<thead><tr><th>Symptom</th><th>Likely cause</th><th>What to try</th></tr></thead>
<tbody>
<tr><td>Very low views</td><td>Weak hook, people scroll past in the first seconds</td><td>Retry the same topic with different hooks</td></tr>
<tr><td>Good views, low watch time</td><td>Long intro, slow pace, promise not delivered</td><td>Tighten the edit, save the strongest point for the end</td></tr>
<tr><td>Watched but not saved</td><td>Low value density, not reference-worthy</td><td>Try a list, steps or checklist format</td></tr>
<tr><td>Profile visits but no follows</td><td>The profile doesn't make a clear promise to visitors</td><td>Review your bio and the consistency of your last 9 posts</td></tr>
<tr><td>Followers up, engagement down</td><td>An audience unrelated to your niche is arriving</td><td>Chase fewer trends, return to your niche</td></tr>
</tbody>
</table>
<h2>A 30-minute weekly review routine</h2>
<p>Opening insights every day creates anxiety and leads to bad decisions. A post's performance keeps changing over its first hours and days. Instead, set aside 30 minutes once a week, on a fixed day and time.</p>
<ol class="crs-steps">
<li><strong>Move the data into a sheet.</strong> Make a simple table: date, format, pillar, hook, views, reach, saves, sends, profile visits, follows. Add last week's posts.</li>
<li><strong>Calculate the ratios.</strong> Work out save rate, send rate and profile conversion for each post.</li>
<li><strong>Pick your best and weakest two posts.</strong> Write down the difference: was it the hook, format, topic or length?</li>
<li><strong>Draw one lesson.</strong> Write "the one thing I learned this week". For example: "Hooks that open with a question were watched longer than hooks that open with a claim."</li>
<li><strong>Set one experiment for next week.</strong> Plan a single change that tests the lesson. If you change several things at once, you won't know what worked.</li>
</ol>
<div class="crs-callout tip"><strong class="crs-callout-title">💡 Tip</strong><p>On a new account the numbers are small, so a single post's result may be chance. Before drawing a conclusion, look at the average of at least 3-5 posts of the same kind. A pattern is more reliable than a single data point.</p></div>
<div class="crs-callout danger"><strong class="crs-callout-title">⛔ Don't do this</strong><p>Don't delete a post soon after publishing just because it was seen less than expected. Deleting it also wipes out the data you could learn from. Underperforming posts are the source of your most valuable lessons.</p></div>
<p>You can now measure what works. In the final lesson we will bring everything together into a concrete action plan for your first 90 days, broken down week by week.</p>
<div class="crs-keypoints"><strong class="crs-callout-title">📌 Key takeaways</strong><ul>
<li>The growth funnel: views, engagement, profile visits and follows.</li>
<li>Judge with ratios divided by reach rather than raw numbers.</li>
<li>Compare with your own history, not with averages found online.</li>
<li>The troubleshooting table shows which step of the funnel is breaking.</li>
<li>A fixed 30-minute review once a week is enough.</li>
</ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Your task</strong><p>Create your insights sheet and add all your posts from the last two weeks. Calculate save rate, send rate and profile conversion for each. Compare your best and weakest posts, write this week's one lesson and plan one experiment for next week.</p></div>
`
};
