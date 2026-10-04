'use strict';
module.exports = {
  slug: 'guvenlik-moderasyon-ve-kural-ihlalleri',
  title_tr: "Güvenlik, Moderasyon ve Kural İhlallerinden Kaçınma",
  title_en: "Safety, Moderation and Staying Clear of Violations",
  summary_tr: "Canlı yayında kişisel güvenliğini koru, moderasyon araçlarını yayından önce kur, en sık kural ihlallerinden kaç ve uyarı aldığında doğru adımları at.",
  summary_en: "Protect your personal safety on LIVE, set up moderation tools before you stream, avoid the most common violations and respond correctly if you get a warning.",
  visual: {
    type: 'steps',
    title_tr: "Kural uyarısı alınca ne yapmalı?",
    title_en: "What to do after a LIVE warning",
    items: [
      { tr: "Sakin kal, yayını düzgün bitir", en: "Stay calm, end the stream well" },
      { tr: "Bildirimdeki sebebi oku", en: "Read the reason in the notice" },
      { tr: "Kuralı yardım merkezinde bul", en: "Find the rule in the Help Center" },
      { tr: "Hata olduğunu düşünüyorsan itiraz et", en: "Appeal if you think it's a mistake" },
      { tr: "Sonraki akış planını düzelt", en: "Fix your next run of show" }
    ]
  },
  content_tr: `
<p>Canlı yayın, evinin ya da işyerinin kapısını bir saatliğine yabancılara açmak gibidir. Gelenlerin çoğu iyi niyetlidir, ama sadece birkaç kötü niyetli yorum, istemeden paylaştığın bir bilgi ya da farkında olmadan çiğnediğin bir kural bütün emeğini riske atabilir. Üstelik canlıda geri alma tuşu yoktur.</p>
<p>Bu derste dört konuyu ele alıyoruz: kişisel güvenliğini korumak, moderasyon araçlarını yayından önce kurmak, en sık karşılaşılan kural ihlallerinden kaçınmak ve bir uyarı aldığında doğru adımları atmak. Son olarak zor yorumlarla nasıl başa çıkacağını ve kendi sınırlarını nasıl koruyacağını konuşacağız.</p>
<!--GORSEL-->
<h2>Kişisel güvenlik: farkında olmadan neler paylaşıyorsun?</h2>
<p>Canlı yayında en büyük güvenlik riski, çoğu zaman bilerek değil, dikkatsizlikle paylaşılan bilgilerdir. Arka plandaki bir tabela, masadaki bir kargo etiketi ya da “her sabah şu saatte spora gidiyorum” gibi masum bir cümle, kötü niyetli birinin seni bulmasına yetebilir.</p>
<table class="crs-table red">
  <thead><tr><th>Risk</th><th>Örnek</th><th>Önlem</th></tr></thead>
  <tbody>
    <tr><td>Konum ifşası</td><td>Pencereden görünen tabela, sokak adı, kargo etiketi</td><td>Yayından önce kadrajı kontrol et, pencereye sırtını dönme</td></tr>
    <tr><td>Kişisel bilgi</td><td>Tam adres, telefon numarası, çocukların okulu</td><td><span class="crs-badge bad">Asla paylaşma</span></td></tr>
    <tr><td>Günlük rutin</td><td>“Her akşam şu saatte evde yalnızım”</td><td>Rutinini ve yalnız olduğun saatleri söyleme</td></tr>
    <tr><td>Anlık konum</td><td>“Şu an şu parktayım, gelin”</td><td>Kişisel hesaplarda konumu yayından sonra paylaş</td></tr>
    <tr><td>Dolandırıcılık</td><td>“Ödül kazandın, şu linke tıkla”, seni taklit eden hesaplar</td><td>İzleyicilerini resmi olmayan linklere karşı uyar</td></tr>
  </tbody>
</table>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Bilgi</strong><p>Yerel bir işletme hesabıysan durum biraz farklıdır: kafenin ya da kuaförün adresi zaten herkese açıktır ve müşterinin seni bulması istenen bir şeydir. Burada dikkat etmen gereken, çalışanların kişisel bilgileri, kasa ve ödeme ekranları, müşterilerin izinsiz kadraja girmesi ve işletmenin kapanış rutinleri gibi detaylardır.</p></div>

<h2>Moderasyon araçlarını yayından önce kur</h2>
<p>TikTok canlı yayın için çeşitli moderasyon araçları sunar: belirli kelimeleri içeren yorumları filtreleme, yorumları sınırlama, kullanıcıları susturma ya da engelleme ve moderatör atama gibi. Araçların adı ve kapsamı uygulama sürümüne göre değişebilir, ama hepsinde ortak bir kural vardır: <mark>en iyi zaman, yayın başlamadan öncedir.</mark> Bir sorun çıktığında ayar menüsünde arama yapmak hem stres yaratır hem de yayının akışını bozar.</p>
<ol class="crs-steps">
  <li><strong>Anahtar kelime filtresini doldur.</strong> Hakaret, spam, rakip link ve kişisel bilgi isteme kalıplarını filtre listesine ekle. Türkçe karakterli ve karaktersiz yazılışları ayrı ayrı eklemeyi unutma.</li>
  <li><strong>Moderatörünü ata.</strong> Dördüncü derste konuştuğumuz moderatörünü yayın ayarlarından ekle ve yazılı notunu paylaş.</li>
  <li><strong>Yorum ayarlarını gözden geçir.</strong> Hassas bir konuda yayın yapacaksan yorumları kimlerin yazabileceğini sınırlama seçeneklerine bak.</li>
  <li><strong>Engelleme ve susturmayı dene.</strong> Bir yayında bu menülerin nerede olduğunu bilmek, gerektiğinde saniyeler içinde müdahale etmeni sağlar.</li>
</ol>
<div class="crs-callout tip"><strong class="crs-callout-title">💡 İpucu</strong><p>Filtre listeni bir not uygulamasında tut ve her yayından sonra güncelle. Yayında gizlemek zorunda kaldığın her yeni kalıbı listeye ekle; zamanla hesabına özel, oldukça güçlü bir filtre oluşur.</p></div>

<h2>En sık kural ihlalleri ve nasıl kaçınılır?</h2>
<p>Canlı yayın uyarılarının önemli bir kısmı kötü niyetten değil, kuralları bilmemekten kaynaklanır. Aşağıdaki liste kapsamlı değildir; TikTok'un topluluk kuralları ve canlı yayın kuralları güncellenebilir, bu yüzden tam listeyi uygulamadan düzenli olarak kontrol et. Ama bu maddeleri yayın öncesi kontrol listene eklemek, yaygın riskleri büyük ölçüde azaltır.</p>
<ul class="crs-checklist">
  <li>Arka planda telifli müzik, film ya da televizyon yayını yok</li>
  <li>Yayında yaş şartını karşılamayan kimse yok ve kadraja girmiyor</li>
  <li>Araç kullanırken ya da tehlikeli bir ortamda yayın yapılmıyor</li>
  <li>Alkol, tütün gibi kısıtlanmış ürünler gösterilmiyor ya da tanıtılmıyor</li>
  <li>Cinsel çağrışım içeren kıyafet, poz ya da konuşma yok</li>
  <li>Önceden kaydedilmiş video canlıymış gibi oynatılmıyor; ekran uzun süre boş kalmıyor</li>
  <li>Nefret söylemi, zorbalık ya da kişileri hedef alan içerik yok (yorumlarda da)</li>
  <li>Sağlık, finans ya da hukuk konularında yanıltıcı vaat yok</li>
</ul>
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Dikkat</strong><p>Yayının sahibi olarak, yayında görünen ve büyük ölçüde yayında söylenen her şeyden sen sorumlusun. Konuğun ya da kadraja giren birinin yaptığı bir ihlal de senin yayınının kesilmesine yol açabilir. Yorumlardaki nefret söylemine sessiz kalmak ya da onaylar gibi tepki vermek de sorun yaratabilir.</p></div>

<h2>Uyarı aldığında ne yapmalısın?</h2>
<p>Ne kadar dikkatli olursan ol, bir gün bir uyarı alabilirsin. Bazen gerçekten bir hata yapmışsındır, bazen de otomatik sistemler yanlış değerlendirme yapar. Görseldeki beş adım, her iki durumda da sakin ve doğru bir yol izlemeni sağlar.</p>
<p>Önce sakin kal. Yayın kesilmediyse izleyicilere kısa bir açıklama yap ve yayını düzgünce kapat. Ardından bildirimi dikkatle oku: hangi kurala atıf yapılıyor? Yardım merkezinde o kuralı bul ve tam metnini oku. Gerçekten hata yaptıysan bunu not et ve bir sonraki akış planında o riski ortadan kaldır. Uyarının yanlış olduğunu düşünüyorsan, uygulamanın sunduğu itiraz yolunu kullan; itirazında sakin ve somut ol.</p>
<div class="crs-callout danger"><strong class="crs-callout-title">⛔ Bunu yapma</strong><p>Uyarı aldıktan sonra öfkeyle yeni bir yayın açıp durumu izleyicilerle tartışma, kuralı test etmek için aynı şeyi tekrarlama ya da kısıtlamayı aşmak için ikinci bir hesap açma. Bu davranışlar daha uzun ve daha ağır yaptırımlara yol açabilir.</p></div>

<h2>Zor yorumlarla başa çıkma</h2>
<p>Her olumsuz yorum aynı değildir. Bir izleyicinin yapıcı eleştirisi seni geliştirebilir; bir trollün amacı ise sadece tepki almaktır. İkisini ayırt etmek ve farklı davranmak önemlidir.</p>
<div class="crs-compare">
  <div class="crs-compare-col bad"><strong class="crs-compare-title">❌ Yanlış</strong><ul>
    <li>Trolle uzun uzun tartışmak</li>
    <li>Hakaret eden yorumu yüksek sesle okumak</li>
    <li>Yapıcı eleştiriyi saldırı gibi algılayıp savunmaya geçmek</li>
  </ul></div>
  <div class="crs-compare-col good"><strong class="crs-compare-title">✅ Doğru</strong><ul>
    <li>Trolü sessizce susturmak ya da engellemek, yayına devam etmek</li>
    <li>Hakareti moderatöre bırakmak, hiç değinmemek</li>
    <li>Eleştiriye teşekkür edip kısaca cevaplamak</li>
  </ul></div>
</div>
<div class="crs-template"><span class="crs-template-label">Yapıcı eleştiriye cevap</span><p>“Haklısın, sesim biraz kısık geliyor olabilir, hemen mikrofonu düzeltiyorum. Söylediğin için teşekkürler!”</p></div>

<h2>Kendi sınırlarını koru</h2>
<p>Canlı yayın yorucu olabilir; sürekli görünür olmak, anlık yorumlara maruz kalmak ve performans baskısı zamanla tükenmeye yol açabilir. Yayın günlerini ve sürelerini sürdürülebilir tut, kötü bir yayının ardından kendine zaman tanı ve yorumlardaki tek bir kötü cümlenin bütün yayını tanımlamasına izin verme. Ciddi bir tehditle ya da taciz edici bir durumla karşılaşırsan, uygulama içi raporlama araçlarını kullan ve gerekirse yetkili mercilere başvurmaktan çekinme.</p>
<p>Güvenli ve kurallara uygun bir yayın düzeni kurduğunda, yayının bittiği an aslında yeni bir fırsatın başladığı andır. Son derste bir saatlik yayını nasıl kısa videolara dönüştüreceğini, yayın verilerini nasıl okuyacağını ve 30 günlük canlı yayın planını birlikte kuracağız.</p>
<div class="crs-keypoints"><strong class="crs-callout-title">📌 Bu derste öğrendiklerin</strong><ul>
  <li>Konum, kişisel bilgi ve rutinlerini kadrajdan ve konuşmalarından uzak tut.</li>
  <li>Kelime filtresi, moderatör ve yorum ayarlarını yayından önce kur, filtre listeni her yayından sonra güncelle.</li>
  <li>Yayında görünen her şeyden yayın sahibi olarak sen sorumlusun; konuklar ve kadraja girenler dahil.</li>
  <li>Uyarı aldığında sakin kal, sebebi oku, gerekiyorsa itiraz et ve planını düzelt.</li>
</ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Görevin</strong><p>Yayın yapacağın yerin kadrajını konum ve kişisel bilgi açısından kontrol et. En az 15 kelimelik bir yorum filtresi listesi hazırla ve uygulamaya ekle. Bu dersteki kural kontrol listesini, ikinci dersteki teknik kontrol listesinin sonuna ekleyerek tek bir yayın öncesi listesi oluştur.</p></div>
`,
  content_en: `
<p>Going LIVE is like opening the door of your home or business to strangers for an hour. Most who come in mean well, but a few malicious comments, a detail you share by accident or a rule you break without realizing it can put all your work at risk. And on LIVE, there's no undo button.</p>
<p>This lesson covers four things: protecting your personal safety, setting up moderation tools before you stream, avoiding the most common guideline violations and taking the right steps if you get a warning. Finally, we'll talk about handling difficult comments and protecting your own boundaries.</p>
<!--GORSEL-->
<h2>Personal safety: what are you sharing without realizing?</h2>
<p>The biggest safety risk on LIVE is usually information shared through carelessness rather than on purpose. A sign in the background, a shipping label on the table or an innocent line like “I go to the gym at this time every morning” can be enough for someone with bad intentions to find you.</p>
<table class="crs-table red">
  <thead><tr><th>Risk</th><th>Example</th><th>Precaution</th></tr></thead>
  <tbody>
    <tr><td>Location exposure</td><td>A sign visible through the window, a street name, a shipping label</td><td>Check your frame before going live; don't sit with your back to a window</td></tr>
    <tr><td>Personal information</td><td>Full address, phone number, your kids' school</td><td><span class="crs-badge bad">Never share</span></td></tr>
    <tr><td>Daily routine</td><td>“I'm home alone every evening at this time”</td><td>Don't reveal your routine or when you're alone</td></tr>
    <tr><td>Real-time location</td><td>“I'm at this park right now, come over”</td><td>On personal accounts, share locations after the stream</td></tr>
    <tr><td>Scams</td><td>“You won a prize, click this link”, accounts impersonating you</td><td>Warn viewers about unofficial links</td></tr>
  </tbody>
</table>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Good to know</strong><p>If you run a local business account, things are a bit different: your café or salon address is already public and you want customers to find you. What you need to watch are details like employees' personal information, the till and payment screens, customers appearing on camera without consent and your closing routines.</p></div>

<h2>Set up moderation tools before you go live</h2>
<p>TikTok offers several moderation tools for LIVE, such as filtering comments that contain specific keywords, limiting comments, muting or blocking users and assigning moderators. Their names and scope may vary by app version, but one rule applies to all of them: <mark>the best time is before the stream starts.</mark> Searching through settings when trouble starts is stressful and breaks your flow.</p>
<ol class="crs-steps">
  <li><strong>Fill in the keyword filter.</strong> Add insults, spam, competitor links and phrases that ask for personal information. Remember to add common misspellings and variants too.</li>
  <li><strong>Assign your moderator.</strong> Add the moderator we discussed in lesson four in your LIVE settings and share your written note.</li>
  <li><strong>Review comment settings.</strong> If you're streaming about a sensitive topic, look at options to limit who can comment.</li>
  <li><strong>Practice blocking and muting.</strong> Knowing where these menus are during a stream lets you act within seconds when needed.</li>
</ol>
<div class="crs-callout tip"><strong class="crs-callout-title">💡 Tip</strong><p>Keep your filter list in a notes app and update it after every stream. Add each new pattern you had to hide; over time you'll build a strong filter tailored to your account.</p></div>

<h2>The most common violations and how to avoid them</h2>
<p>Many LIVE warnings come not from bad intent but from not knowing the rules. The list below is not exhaustive; TikTok's Community Guidelines and LIVE rules can be updated, so check the full list in the app regularly. But adding these items to your pre-stream checklist cuts down on the most common risks.</p>
<ul class="crs-checklist">
  <li>No copyrighted music, films or TV playing in the background</li>
  <li>No one under the age requirement is on stream or in frame</li>
  <li>You're not streaming while driving or in a dangerous setting</li>
  <li>No restricted goods such as alcohol or tobacco are shown or promoted</li>
  <li>No sexually suggestive clothing, poses or talk</li>
  <li>No pre-recorded video played as live; the screen isn't left empty for long</li>
  <li>No hate speech, bullying or content targeting people (in comments too)</li>
  <li>No misleading promises about health, money or legal topics</li>
</ul>
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Watch out</strong><p>As the host, you are responsible for everything that appears on your stream and largely for everything said on it. A violation by a guest or someone who walks into frame can also get your stream ended. Staying silent about hate speech in the comments, or reacting as if you approve, can cause problems too.</p></div>

<h2>What to do when you get a warning</h2>
<p>However careful you are, you may get a warning one day. Sometimes you really did make a mistake; sometimes automated systems get it wrong. The five steps in the graphic help you take a calm, correct path either way.</p>
<p>First, stay calm. If the stream wasn't ended, give viewers a short explanation and close the stream properly. Then read the notice carefully: which rule does it cite? Find that rule in the Help Center and read the full text. If you really made a mistake, note it and remove that risk from your next run of show. If you believe the warning is wrong, use the appeal option the app offers; keep your appeal calm and specific.</p>
<div class="crs-callout danger"><strong class="crs-callout-title">⛔ Don't do this</strong><p>After a warning, don't angrily start a new stream to argue about it with viewers, don't repeat the same thing to test the rule and don't open a second account to get around the restriction. These behaviors can lead to longer and harsher penalties.</p></div>

<h2>Handling difficult comments</h2>
<p>Not every negative comment is the same. A viewer's constructive criticism can help you improve; a troll just wants a reaction. Telling them apart and responding differently matters.</p>
<div class="crs-compare">
  <div class="crs-compare-col bad"><strong class="crs-compare-title">❌ Wrong</strong><ul>
    <li>Arguing at length with a troll</li>
    <li>Reading an insulting comment out loud</li>
    <li>Treating constructive criticism as an attack and getting defensive</li>
  </ul></div>
  <div class="crs-compare-col good"><strong class="crs-compare-title">✅ Right</strong><ul>
    <li>Quietly muting or blocking the troll and carrying on</li>
    <li>Leaving insults to your moderator and not mentioning them</li>
    <li>Thanking the critic and answering briefly</li>
  </ul></div>
</div>
<div class="crs-template"><span class="crs-template-label">Reply to constructive criticism</span><p>“You're right, my audio might be a bit low, let me fix the mic right now. Thanks for telling me!”</p></div>

<h2>Protect your own boundaries</h2>
<p>LIVE can be draining; being constantly visible, facing real-time comments and feeling pressure to perform can lead to burnout over time. Keep your streaming days and lengths sustainable, give yourself time after a bad stream and don't let a single nasty comment define the whole stream. If you face a serious threat or harassment, use the in-app reporting tools and don't hesitate to contact the relevant authorities if needed.</p>
<p>Once you have a safe, compliant streaming routine, the moment your stream ends is actually the start of a new opportunity. In the final lesson we'll turn a one-hour stream into short videos, read your stream data and build your 30-day LIVE plan together.</p>
<div class="crs-keypoints"><strong class="crs-callout-title">📌 Key takeaways</strong><ul>
  <li>Keep your location, personal information and routines out of your frame and your words.</li>
  <li>Set up keyword filters, moderators and comment settings before you go live, and update your filter list after each stream.</li>
  <li>As the host you're responsible for everything on your stream, including guests and anyone in frame.</li>
  <li>After a warning, stay calm, read the reason, appeal if appropriate and fix your plan.</li>
</ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Your task</strong><p>Check your streaming spot's frame for location and personal information. Prepare a comment filter list of at least 15 words or phrases and add it in the app. Add this lesson's rules checklist to the end of the technical checklist from lesson two to create a single pre-stream list.</p></div>
`
};
