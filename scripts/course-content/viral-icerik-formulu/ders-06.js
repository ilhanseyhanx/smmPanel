'use strict';
module.exports = {
  slug: 'test-et-seriye-cevir-14-gunluk-plan',
  title_tr: 'Test Et, Seriye Çevir: 14 Günlük Deneme Planı',
  title_en: 'Test, Then Make It a Series: A 14-Day Experiment Plan',
  summary_tr: 'Formülün parçalarını tek değişken kuralıyla test etmek, sonuçları kendi ortalamana göre okumak, işe yarayan formatı seriye dönüştürmek ve hepsini bir araya getiren 14 günlük deneme planı.',
  summary_en: 'Testing each part of the formula with the one-variable rule, reading results against your own baseline, turning a winning format into a series, and a 14-day experiment plan that ties it all together.',
  visual: {
    type: 'timeline',
    title_tr: '14 günlük deneme planı',
    title_en: 'The 14-day experiment plan',
    items: [
      { tr: 'Verini çıkar, konu ve motor seç', en: 'Audit your data, pick topic and engine', value_tr: 'Gün 1-2', value_en: 'Day 1-2' },
      { tr: 'Kanca türlerini test et', en: 'Test hook types', value_tr: 'Gün 3-7', value_en: 'Day 3-7' },
      { tr: 'İskelet ve kapanışı test et', en: 'Test skeleton and close', value_tr: 'Gün 8-11', value_en: 'Day 8-11' },
      { tr: 'Kazanan formatı seriye çevir', en: 'Turn the winner into a series', value_tr: 'Gün 12-13', value_en: 'Day 12-13' },
      { tr: 'Değerlendir, yeni turu planla', en: 'Review and plan the next round', value_tr: 'Gün 14', value_en: 'Day 14' }
    ]
  },
  content_tr: `
<p>Bu eğitimin başında dürüst bir cümle kurmuştuk: viralliği hiçbir formül garanti edemez. Peki o zaman ne yapacağız? Cevap şu: tek bir içeriğe şans tanımak yerine, <strong>her içeriği bir deney</strong> olarak yayınlayacak, sonuçları okuyacak ve işe yarayanı tekrar üretilebilir bir formata çevireceğiz. Çok paylaşılan hesapların önemli bir kısmında, tek seferlik bir patlamadan çok, defalarca işe yarayan bir format görürsün.</p>
<p>Bu son derste üç şeyi bir araya getiriyoruz: formülün parçalarını nasıl test edeceğini, sonuçları nasıl okuyacağını ve <mark>işe yarayan formatı nasıl seriye dönüştüreceğini</mark>. En sonda da hepsini uygulayacağın 14 günlük bir deneme planı var.</p>
<!--GORSEL-->
<h2>Tek değişken kuralı</h2>
<p>Bir içeriğin neden iyi ya da kötü performans gösterdiğini anlamanın tek yolu, her seferinde <strong>tek bir şeyi değiştirmektir</strong>. Aynı anda hem kancayı, hem konuyu, hem iskeleti, hem de kapanışı değiştirirsen, sonuç ne olursa olsun nedenini bilemezsin. Bu eğitimde öğrendiğin her parça bir test değişkenidir:</p>
<ul>
<li><strong>Kanca türü:</strong> Hata uyarısı mı, önce sonuç mu, kimlik çağrısı mı? (2. ders)</li>
<li><strong>Hikâye iskeleti:</strong> Problem-çözüm mü, önce-sonra mı, liste mi? (3. ders)</li>
<li><strong>Tutma araçları:</strong> Tek döngü mü, iç içe döngüler mi? (4. ders)</li>
<li><strong>Kapanış:</strong> Kaydettiren mi, paylaştıran mı, yorum yazdıran mı? (5. ders)</li>
</ul>
<p>Pratikte gerçek bir laboratuvar ortamı kuramazsın; her içeriğin konusu biraz farklı olur, yayın günü değişir. Amaç kusursuz bilim değil, <strong>bilinçli karşılaştırma</strong>. Mümkün olduğunca aynı konu etrafında kal ve bir seferde tek bir parçayı oynat.</p>

<h2>Sonuçları doğru okumak</h2>
<p>Hangi metriğin hangi parçayı ölçtüğünü bilirsen, sonuçlar sana neyi düzeltmen gerektiğini söyler. Aşağıdaki tablo genel bir eşleştirme sunuyor. Metriklerin adı ve gösterildiği yer platformdan platforma değişir ve zamanla güncellenir; güncel adlarını kendi uygulamanın istatistik ekranından kontrol et.</p>
<table class="crs-table blue">
<thead><tr><th>Metrik</th><th>Hangi parçayı ölçer?</th><th>Düşükse neye bak?</th></tr></thead>
<tbody>
<tr><td>İlk saniyelerde kalma / durdurma</td><td>Kanca</td><td>İlk cümle, ilk kare ve ekran yazısı</td></tr>
<tr><td>Ortalama izlenme ve tamamlanma</td><td>İskelet ve tutma</td><td>Uzun bağlam, kapanmayan döngü, görsel tekdüzelik</td></tr>
<tr><td>Kaydetme</td><td>Fayda motoru ve kapanış</td><td>İçerik gerçekten saklanmaya değer mi, çağrı somut mu?</td></tr>
<tr><td>Paylaşma ve gönderme</td><td>Kimlik ve duygu motoru</td><td>İzleyicinin aklına belirli bir kişi geliyor mu?</td></tr>
<tr><td>Yorum</td><td>Kapanış sorusu</td><td>Soru kolay cevaplanabilir mi?</td></tr>
<tr><td>Profil ziyareti ve takip</td><td>Seri ve hesap uyumu</td><td>Profilde aynı türden başka içerik var mı?</td></tr>
</tbody>
</table>
<p>Sonuçları her zaman <strong>kendi ortalamanla</strong> karşılaştır. Başka bir hesabın rakamlarıyla kıyaslamak yanıltıcıdır; kitlesi, konusu ve geçmişi farklıdır. Birinci dersteki tabloyu kullanarak son içeriklerinin ortalamasını çıkar; deneylerini bu çizgiye göre değerlendir.</p>
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Dikkat</strong><p>Tek bir içerikten kesin sonuç çıkarma. Bir içerik, senin kontrolünde olmayan nedenlerle (gündem, yayın saati, rastlantı) beklenenden iyi ya da kötü gidebilir. Bir kanca türünü ya da iskeleti "işe yarıyor" diye etiketlemeden önce, aynı yapıyı en az iki üç kez denemek daha sağlıklıdır.</p></div>

<h2>İşe yarayanı seriye çevirmek</h2>
<p>Bir yapı birkaç kez ortalamanın üzerinde performans gösterdiyse, onu bir seriye dönüştürme zamanı gelmiştir. Seri, <strong>sabit bir iskelet ve değişen bir içerikten</strong> oluşur. İzleyici formatı tanır, ne alacağını bilir ve bir sonrakini bekler. Bu, beşinci derste konuştuğumuz takip ettiren kapanışın da zeminidir.</p>
<div class="crs-template"><span class="crs-template-label">Şablon: Seri formülü</span><p>Seri adı: [kısa, tekrar eden bir ad] + Sabit açılış: [her bölümde aynı kanca yapısı] + Sabit iskelet: [işe yarayan iskelet] + Değişen içerik: [her bölümde yeni konu] + Sabit kapanış: "[bir sonraki bölümün vaadi]". Örnek senaryo: "Kaynar Su Değil" serisi; her bölüm bir kahve hatasıyla açılır, problem-çözüm iskeletiyle ilerler ve "yarın bir sonraki hata" vaadiyle biter.</p></div>
<ul class="crs-checklist">
<li>Format en az birkaç denemede kendi ortalamamın üzerinde sonuç verdi.</li>
<li>Seriye kısa ve akılda kalan bir ad verdim; adı ekran yazısında ve açıklamada kullanıyorum.</li>
<li>En az 8-10 bölümlük konu listem hazır, yani format çabuk tükenmeyecek.</li>
<li>Her bölümün açılışı tanıdık ama içeriği yeni.</li>
<li>Kapanış, bir sonraki bölümü bekletecek bir vaat içeriyor.</li>
</ul>
<div class="crs-callout tip"><strong class="crs-callout-title">💡 İpucu</strong><p>Seri yorulmaya başladığında, yani sonuçlar birkaç bölüm üst üste ortalamanın altına indiğinde, formatı tamamen bırakmadan önce tek bir değişkeni oynat: yeni bir kanca türü ya da farklı bir kapanış. Bazen formatı canlandırmak için küçük bir değişiklik yeter.</p></div>

<h2>14 günlük deneme planı</h2>
<p>Aşağıdaki plan, eğitimde öğrendiğin her şeyi tek bir döngüde uygulaman için tasarlandı. Yayın sıklığını kendi kapasitene göre ayarla; amaç her gün yayınlamak değil, her yayından bir şey öğrenmek. Üretim düzeni ve içerik takvimi bu eğitimin konusu olmadığı için plan yalnızca deney mantığına odaklanıyor.</p>
<table class="crs-table purple">
<thead><tr><th>Gün</th><th>Ne yapacaksın?</th><th>Çıktı</th></tr></thead>
<tbody>
<tr><td>Gün 1</td><td>Son içeriklerini birinci dersteki tabloya dök, ortalamalarını çıkar</td><td>Kendi baz çizgin</td></tr>
<tr><td>Gün 2</td><td>Tek bir konu ve baskın motor seç; 4 fikir belirle, her biri için 10 kanca yaz</td><td>Fikir ve kanca havuzu</td></tr>
<tr><td>Gün 3-6</td><td>Aynı iskeletle, farklı kanca türleri kullanarak 3-4 içerik yayınla</td><td>Kanca testi verisi</td></tr>
<tr><td>Gün 7</td><td>Durdurma ve izlenme verilerini ortalamanla karşılaştır</td><td>Kazanan kanca türü</td></tr>
<tr><td>Gün 8-11</td><td>Kazanan kancayla iki farklı iskelet ve iki farklı kapanış dene</td><td>İskelet ve kapanış verisi</td></tr>
<tr><td>Gün 12</td><td>En iyi kombinasyonu belirle, seri formülünü yaz</td><td>Seri taslağı</td></tr>
<tr><td>Gün 13</td><td>Serinin ilk bölümünü yayınla</td><td>Seri başlangıcı</td></tr>
<tr><td>Gün 14</td><td>Tüm deneyleri gözden geçir, öğrendiklerini yaz, yeni turu planla</td><td>Sonraki 14 günün planı</td></tr>
</tbody>
</table>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Bilgi</strong><p>14 gün sonunda hiçbir içeriğin beklenmedik şekilde yayılmamış olması başarısızlık değildir. Bu planın asıl çıktısı, hangi kanca türünün, hangi iskeletin ve hangi kapanışın senin kitlende daha iyi çalıştığına dair veridir. Bu veriyle her yeni tur, bir öncekinden daha bilinçli başlar.</p></div>

<div class="crs-keypoints"><strong class="crs-callout-title">📌 Bu derste öğrendiklerin</strong><ul>
<li>Viralliği garanti edemezsin, ama her içeriği bir deney olarak kurgulayıp işe yarayanı tekrar üretebilirsin.</li>
<li>Tek değişken kuralı: her seferinde yalnızca bir parçayı (kanca, iskelet, kapanış) değiştir.</li>
<li>Her metrik formülün belirli bir parçasını ölçer; sonuçları başkalarıyla değil, kendi ortalamanla karşılaştır.</li>
<li>Tek içerikten kesin sonuç çıkarma; bir yapıyı birkaç kez dene.</li>
<li>İşe yarayan format, sabit iskelet ve değişen içerikle seriye dönüştürülür.</li>
</ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Görevin</strong><p>14 günlük planı bugün başlat. Birinci günün görevini, yani kendi baz çizgini çıkarmayı hemen yap ve planı bir not dosyasına kopyala. Her yayından sonra bir satır not düş: hangi değişkeni test ettin, sonuç ortalamanın üstünde mi altında mı, neden olabilir? On dördüncü günün sonunda elinde hem bir seri taslağı hem de kendi kitlene özel bir formül olacak. Unutma: formül bir garanti değil, şansını her turda biraz daha artıran bir yöntem.</p></div>
`,
  content_en: `
<p>At the start of this course we made an honest statement: no formula can guarantee virality. So what do we do? Here's the answer: instead of betting on a single post, you'll publish <strong>every post as an experiment</strong>, read the results and turn whatever works into a repeatable format. On many widely shared accounts, what you'll see is less a one-time explosion and more a format that has worked again and again.</p>
<p>In this final lesson we bring three things together: how to test the parts of the formula, how to read the results and <mark>how to turn a winning format into a series</mark>. At the end there's a 14-day experiment plan to put it all into practice.</p>
<!--GORSEL-->
<h2>The one-variable rule</h2>
<p>The only way to understand why a piece of content did well or poorly is to <strong>change one thing at a time</strong>. If you change the hook, the topic, the skeleton and the close all at once, you won't know why, whatever the result. Every part you've learned in this course is a test variable:</p>
<ul>
<li><strong>Hook type:</strong> Mistake warning, result first or identity call-out? (Lesson 2)</li>
<li><strong>Story skeleton:</strong> Problem-solution, before-after or list? (Lesson 3)</li>
<li><strong>Retention tools:</strong> A single loop or nested loops? (Lesson 4)</li>
<li><strong>Close:</strong> One that gets saves, shares or comments? (Lesson 5)</li>
</ul>
<p>In practice you can't build a true lab setting; every post's topic will differ a little, and the publishing day changes. The goal isn't perfect science but <strong>deliberate comparison</strong>. Stay around the same topic as much as you can and adjust one part at a time.</p>

<h2>Reading the results correctly</h2>
<p>When you know which metric measures which part, the results tell you what to fix. The table below offers a general mapping. Metric names and where they appear vary by platform and change over time, so check the current names in your app's analytics screen.</p>
<table class="crs-table blue">
<thead><tr><th>Metric</th><th>Which part it measures</th><th>If it's low, look at</th></tr></thead>
<tbody>
<tr><td>Early retention / stop rate</td><td>Hook</td><td>First line, first frame and on-screen text</td></tr>
<tr><td>Average watch time and completion</td><td>Skeleton and retention</td><td>Long context, unclosed loops, visual monotony</td></tr>
<tr><td>Saves</td><td>Utility engine and close</td><td>Is the content truly worth keeping, is the ask concrete?</td></tr>
<tr><td>Shares and sends</td><td>Identity and emotion engines</td><td>Does a specific person come to the viewer's mind?</td></tr>
<tr><td>Comments</td><td>Closing question</td><td>Is the question easy to answer?</td></tr>
<tr><td>Profile visits and follows</td><td>Series and account fit</td><td>Is there more content like this on the profile?</td></tr>
</tbody>
</table>
<p>Always compare results against <strong>your own average</strong>. Comparing with another account's numbers is misleading; their audience, topic and history are different. Use the table from Lesson 1 to work out the average of your recent posts, and judge your experiments against that baseline.</p>
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Watch out</strong><p>Don't draw firm conclusions from a single post. A post can do better or worse than expected for reasons outside your control (news cycles, posting time, plain chance). Before labeling a hook type or skeleton as "working," it's wiser to try the same structure at least two or three times.</p></div>

<h2>Turning what works into a series</h2>
<p>When a structure has beaten your average a few times, it's time to turn it into a series. A series is made of <strong>a fixed skeleton and changing content</strong>. Viewers recognize the format, know what they'll get and look forward to the next one. This is also the foundation for the follow-driving close we covered in Lesson 5.</p>
<div class="crs-template"><span class="crs-template-label">Template: The series formula</span><p>Series name: [a short, recurring name] + Fixed opening: [the same hook structure every episode] + Fixed skeleton: [the skeleton that worked] + Changing content: [a new topic each episode] + Fixed close: "[the promise of the next episode]". Example scenario: a "Not Boiling Water" series; every episode opens with one coffee mistake, follows a problem-solution skeleton and ends with "tomorrow, the next mistake."</p></div>
<ul class="crs-checklist">
<li>The format has beaten my own average in at least a few tries.</li>
<li>I've given the series a short, memorable name and use it in on-screen text and captions.</li>
<li>I have a list of at least 8-10 episode topics, so the format won't run dry quickly.</li>
<li>Every episode's opening feels familiar, but its content is new.</li>
<li>The close includes a promise that makes viewers wait for the next episode.</li>
</ul>
<div class="crs-callout tip"><strong class="crs-callout-title">💡 Tip</strong><p>When a series starts to tire, meaning results fall below your average several episodes in a row, adjust one variable before abandoning the format entirely: a new hook type or a different close. Sometimes a small change is all it takes to revive a format.</p></div>

<h2>The 14-day experiment plan</h2>
<p>The plan below is designed so you can apply everything from this course in a single cycle. Adjust your posting frequency to your own capacity; the goal isn't to post every day but to learn something from every post. Production workflows and content calendars aren't the subject of this course, so the plan focuses purely on the experiment logic.</p>
<table class="crs-table purple">
<thead><tr><th>Day</th><th>What you'll do</th><th>Output</th></tr></thead>
<tbody>
<tr><td>Day 1</td><td>Move your recent posts into the table from Lesson 1 and calculate your averages</td><td>Your own baseline</td></tr>
<tr><td>Day 2</td><td>Pick one topic and a leading engine; choose 4 ideas and write 10 hooks for each</td><td>An idea and hook pool</td></tr>
<tr><td>Day 3-6</td><td>Publish 3-4 posts with the same skeleton but different hook types</td><td>Hook test data</td></tr>
<tr><td>Day 7</td><td>Compare stop rate and watch data against your average</td><td>The winning hook type</td></tr>
<tr><td>Day 8-11</td><td>Use the winning hook to try two different skeletons and two different closes</td><td>Skeleton and close data</td></tr>
<tr><td>Day 12</td><td>Identify the best combination and write your series formula</td><td>A series draft</td></tr>
<tr><td>Day 13</td><td>Publish the first episode of the series</td><td>Series launch</td></tr>
<tr><td>Day 14</td><td>Review all experiments, write down what you learned, plan the next round</td><td>A plan for the next 14 days</td></tr>
</tbody>
</table>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Good to know</strong><p>If nothing takes off unexpectedly within 14 days, that isn't failure. The real output of this plan is data on which hook type, which skeleton and which close work better with your audience. With that data, every new round starts more deliberately than the last.</p></div>

<div class="crs-keypoints"><strong class="crs-callout-title">📌 Key takeaways</strong><ul>
<li>You can't guarantee virality, but you can design every post as an experiment and repeat what works.</li>
<li>The one-variable rule: change only one part (hook, skeleton, close) at a time.</li>
<li>Each metric measures a specific part of the formula; compare results with your own average, not other accounts.</li>
<li>Don't draw firm conclusions from one post; try a structure several times.</li>
<li>A winning format becomes a series through a fixed skeleton and changing content.</li>
</ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Your task</strong><p>Start the 14-day plan today. Do Day 1's task right now, working out your own baseline, and copy the plan into a notes file. After every post, jot down one line: which variable did you test, was the result above or below your average, and what might explain it? By the end of Day 14 you'll have both a series draft and a formula tailored to your own audience. Remember: the formula isn't a guarantee; it's a method that raises your odds a little more with every round.</p></div>
`
};
