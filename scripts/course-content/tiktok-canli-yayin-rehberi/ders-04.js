'use strict';
module.exports = {
  slug: 'izleyiciyi-tutma-ve-etkilesim',
  title_tr: "İzleyiciyi Yayında Tutma ve Etkileşim Teknikleri",
  title_en: "Keeping Viewers on Your LIVE and Driving Interaction",
  summary_tr: "Yeni gelen izleyiciyi ilk saniyelerde karşılama, sabitlenmiş yorum, isimle hitap, mini hedefler ve moderatör kullanımıyla yayınını izleyen kalabalıktan konuşan bir topluluğa dönüştür.",
  summary_en: "Turn a passive crowd into a talking community with a strong welcome, pinned comments, name call-outs, mini goals and well-briefed moderators.",
  visual: {
    type: 'funnel',
    title_tr: "İzleyiciden topluluğa",
    title_en: "From viewer to community",
    items: [
      { tr: "Yayına giren izleyici", en: "Viewer joins the LIVE" },
      { tr: "Yayında kalan izleyici", en: "Viewer stays" },
      { tr: "Yorum yapan katılımcı", en: "Viewer comments" },
      { tr: "Takip eden ve geri dönen", en: "Follows and comes back" }
    ]
  },
  content_tr: `
<p>Canlı yayına giren bir izleyici, birkaç saniye içinde karar verir: kalacak mı, kaydırıp gidecek mi? Kalırsa, bir süre sadece izleyecek mi yoksa yazmaya mı başlayacak? Yazarsa, yayın bittiğinde seni takip edip bir sonrakine gelecek mi? Görseldeki huni bu yolculuğu gösteriyor ve her basamakta izleyicinin bir kısmını kaybetmek doğaldır. Senin işin, her basamaktaki geçişi biraz daha kolaylaştırmak.</p>
<p>Bu derste huninin her basamağı için uygulanabilir teknikler öğreneceksin: yeni geleni karşılama, sabitlenmiş yorumun doğru kullanımı, izleyiciye ismiyle hitap ve soru sorma, mini hedefler, moderatör seçimi ve konuk alma. Hepsinin ortak noktası şu: izleyiciyi seyirci değil, yayının bir parçası haline getirmek.</p>
<!--GORSEL-->
<h2>İlk saniyeler: yeni geleni karşıla</h2>
<p>Canlı yayına sonradan giren biri ne olduğunu bilmez. Uzun bir anlatımın ortasına düştüyse bağlamı kaçırır ve çoğu zaman ayrılır. Bu yüzden yayın boyunca belirli aralıklarla yeni gelenleri karşılamak ve onlara kısa bir özet vermek önemlidir.</p>
<div class="crs-template"><span class="crs-template-label">Karşılama cümlesi</span><p>“@kullaniciadi hoş geldin! Bugün evde saç boyarken yapılan hataları konuşuyoruz. Az önce turuncu ton sorusunu cevapladık, şimdi bakım kısmına geçiyoruz. Senin saçın boyalı mı?”</p></div>
<p>Bu cümlenin üç parçası var: isimle selam, bir cümlelik bağlam ve kolay cevaplanabilir bir soru. Son kısım çok önemli; izleyiciye yazması için bir sebep verir. Yalnız, yayın kalabalıklaştığında her gelene tek tek selam vermek akışı bozar. O noktada yeni gelenleri toplu karşıla: “Son birkaç dakikada katılan herkese hoş geldiniz...”</p>

<h2>Sabitlenmiş yorum: yayının vitrini</h2>
<p>Canlı yayında bir yorumu ekranın üst kısmına sabitleyebilirsin (özellik adı ve konumu uygulama sürümüne göre değişebilir). Sabitlenmiş yorum, yeni gelen herkesin ilk gördüğü metindir; sen konuşurken bile bağlamı anlatmaya devam eder.</p>
<ul>
  <li><strong>Konuyu yaz:</strong> Yayının ne hakkında olduğunu tek cümleyle belirt.</li>
  <li><strong>Sözünü yaz:</strong> Sonuna kadar kalmak için bir sebep ver.</li>
  <li><strong>Katılım yolunu yaz:</strong> İzleyicinin nasıl katılacağını söyle: “Sorunu başına S yazarak gönder.”</li>
</ul>
<div class="crs-template"><span class="crs-template-label">Sabitlenmiş yorum örneği</span><p>Bugün: 3 malzemeyle soğuk kahve ☕ Sonunda en çok yapılan süt köpüğü hatasını canlı düzelteceğim. Sorunu başına S yazarak gönder!</p></div>
<div class="crs-callout tip"><strong class="crs-callout-title">💡 İpucu</strong><p>Yayının ana bölümü değiştiğinde sabitlenmiş yorumu da güncelle. Örneğin soru-cevap bölümüne geçtiğinde “Şimdi soru-cevap zamanı, sorunu yaz” şeklinde yenilemek, yeni gelenin ne yapacağını anında anlamasını sağlar.</p></div>

<h2>İsimle hitap ve doğru soru sorma</h2>
<p>İnsanlar adlarının söylendiğini duymayı sever. Canlı yayının kısa videoya karşı en büyük avantajı da budur: izleyiciye ismiyle, o anda cevap verebilirsin. Ama her soru aynı derecede etkileşim getirmez. Cevabı zor ya da uzun olan sorular sessizlik doğurur; <mark>cevabı tek kelime ya da tek rakam olan sorular</mark> ise yorum akışını başlatır.</p>
<table class="crs-table green">
  <thead><tr><th>Teknik</th><th>Örnek</th><th>Ne zaman?</th><th>Etkisi</th></tr></thead>
  <tbody>
    <tr><td>İki seçenekli soru</td><td>“Sütlü mü sade mi? 1 ya da 2 yaz”</td><td>Açılışta ve enerji düştüğünde</td><td><span class="crs-badge good">Hızlı katılım</span></td></tr>
    <tr><td>Kişisel deneyim sorusu</td><td>“Evde en çok hangi hatayı yaptınız?”</td><td>Etkileşim molasında</td><td><span class="crs-badge good">Derin sohbet</span></td></tr>
    <tr><td>Tahmin oyunu</td><td>“Bu kahve kaç dakikada demlendi? Tahmin et”</td><td>Ana bölüm arasında</td><td><span class="crs-badge good">Eğlence</span></td></tr>
    <tr><td>Fikir isteme</td><td>“Gelecek yayında ne yapalım?”</td><td>Kapanışa yakın</td><td><span class="crs-badge mid">Geri dönüş sebebi</span></td></tr>
    <tr><td>Belirsiz soru</td><td>“Sorusu olan var mı?”</td><td>Kaçın</td><td><span class="crs-badge bad">Genelde sessizlik</span></td></tr>
  </tbody>
</table>
<p>Bir yorumu cevaplarken önce yorumu sesli oku, sonra cevapla. Diğer izleyiciler yorumu kaçırmış olabilir; sesli okumak herkesin konuyu takip etmesini sağlar ve yorumu yazan kişiyi görünür kılar.</p>

<h2>Mini hedefler: yayına bir yön ver</h2>
<p>Mini hedef, izleyiciyle birlikte ulaşılacak küçük ve eğlenceli bir kilometre taşıdır. Yayına bir hikâye ve ilerleme hissi katar. Önemli olan, hedeflerin içerikle ilgili ve herkesin ücretsiz katılabileceği türden olmasıdır.</p>
<ul>
  <li>“Yorumlarda 20 tarif isteği birikince bonus tarifi açıklıyorum.”</li>
  <li>“Ekrana dokunarak beğeni gönderirseniz bir sonraki adımı hızlandırıyorum.”</li>
  <li>“Herkes en sevdiği rengi yazsın, en çok çıkan rengi bir sonraki yayında deneyeceğim.”</li>
</ul>
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Dikkat</strong><p>TikTok'un canlı yayın için sunduğu hedef özellikleri ve bunlara bağlı kurallar zaman içinde değişebilir. Hediyeyle ilgili hedefler ve izleyiciden hediye istemenin sınırları beşinci derste ayrıca ele alınacak; burada önerilen mini hedefler hiçbir ödeme gerektirmeyen, içerik odaklı hedeflerdir.</p></div>

<h2>Moderatör: yayının ikinci gözü</h2>
<p>Hem konuşup hem de her yorumu kontrol etmek zordur. Moderatör, yayın sırasında senin adına uygunsuz yorumları gizleyen, sorun çıkaranları susturan ve önemli soruları sana hatırlatan güvendiğin kişidir. Uygulama, belirli hesapları canlı yayın moderatörü olarak atamana izin verir; verilen yetkiler uygulamanın güncel sürümüne göre değişebilir.</p>
<ol class="crs-steps">
  <li><strong>Doğru kişiyi seç.</strong> Kitleni tanıyan, sakin ve düzenli izleyen biri olsun: bir arkadaşın, ekip arkadaşın ya da uzun süredir yorum yapan güvendiğin bir takipçin.</li>
  <li><strong>Uygulamadan ata.</strong> Canlı yayın ayarlarındaki moderatör bölümünden hesabı ekle; bunu yayından önce yapmak işini kolaylaştırır.</li>
  <li><strong>Kuralları yazılı ver.</strong> Hangi yorumların gizleneceğini, kimin susturulacağını ve hangi durumda sana haber verileceğini kısa bir notla paylaş.</li>
  <li><strong>Yayın sonrası konuş.</strong> Neler oldu, hangi yorumlar sorun çıkardı, bir dahakine ne değişmeli? Beş dakikalık bir değerlendirme yeter.</li>
</ol>
<div class="crs-callout danger"><strong class="crs-callout-title">⛔ Bunu yapma</strong><p>Moderatöre ya da yardımcına hesabının şifresini verme. Moderatör yetkisi, kendi hesabıyla yorumları yönetmesi için yeterlidir. Şifre paylaşımı hesabının güvenliğini riske atar ve ileride erişim sorunlarına yol açabilir.</p></div>

<h2>Konuk almak ve ortak yayın</h2>
<p>TikTok, başka yayıncılarla ortak yayın yapmak ya da izleyicileri konuk olarak yayına almak için çeşitli özellikler sunar; bu özelliklerin adı, şartları ve kapsamı bölgeye ve zamana göre değişebilir. Doğru kullanıldığında konuk almak, iki kitleyi buluşturur ve yayına yeni bir enerji katar.</p>
<p>Konuk alırken dikkat etmen gereken basit kurallar var: konuğu önceden tanı, konuşulacak konuyu birlikte belirle ve konuğun da yaş ve kural şartlarını karşıladığından emin ol. Tanımadığın birini rastgele yayına almak, kontrol edemeyeceğin bir içeriğin senin yayınında görünmesine yol açabilir; yayın sahibi olarak sorumluluk büyük ölçüde sende olur.</p>

<h2>Kendi enerjini yönet</h2>
<p>Etkileşimin en büyük kaynağı sensin. Yorgun, sıkılmış ya da telefona bakıp duran bir yayıncı, izleyicinin enerjisini de düşürür.</p>
<ul class="crs-checklist">
  <li>Yayından önce birkaç dakika yüksek sesle konuşarak ısın</li>
  <li>Sesinin tonunu ve hızını yayın boyunca değiştir</li>
  <li>Kameraya, yani izleyicinin gözlerine bak; sadece yorumlara değil</li>
  <li>Sessiz anlarda panik yapma, yedek malzemene dön</li>
  <li>Yorulduğunu hissedersen yayını planladığından erken, ama düzgün bir kapanışla bitir</li>
</ul>
<p>Etkileşim arttıkça yayında bir şey daha belirmeye başlar: hediyeler. İzleyicilerin bir kısmı teşekkür etmek ya da destek olmak için hediye gönderebilir. Bir sonraki derste hediyelerin, elmasların ve gelir mantığının nasıl işlediğini, uydurma rakamlara değil güncel politikaya dayanarak ve izleyiciye baskı yapmadan ele alacağız.</p>
<div class="crs-keypoints"><strong class="crs-callout-title">📌 Bu derste öğrendiklerin</strong><ul>
  <li>Yeni geleni isim, bir cümlelik bağlam ve kolay bir soruyla karşıla.</li>
  <li>Sabitlenmiş yorumda konu, söz ve katılım yolu olsun; bölüm değiştikçe güncelle.</li>
  <li>Tek kelimeyle cevaplanabilen sorular yorum akışını başlatır; belirsiz sorulardan kaçın.</li>
  <li>Mini hedefler ücretsiz ve içerik odaklı olsun; moderatör seç, ama şifreni asla paylaşma.</li>
</ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Görevin</strong><p>Bir sonraki yayının için bir karşılama cümlesi, bir sabitlenmiş yorum ve tablodaki tekniklerden en az üçünü kullanan beş soru yaz. Güvendiğin bir kişiyi moderatör olarak seç ve ona kısa, yazılı bir moderasyon notu hazırla: hangi yorumlar gizlenecek, kim susturulacak, sana ne zaman haber verilecek.</p></div>
`,
  content_en: `
<p>A viewer who joins your LIVE makes a decision within seconds: stay or swipe away? If they stay, will they just watch for a while or start typing? If they type, will they follow you when the stream ends and come back next time? The funnel in the graphic shows this journey, and losing part of your audience at each step is natural. Your job is to make each step a little easier.</p>
<p>In this lesson you'll learn practical techniques for every step of the funnel: welcoming newcomers, using pinned comments properly, addressing viewers by name and asking the right questions, mini goals, choosing moderators and bringing on guests. They all share one aim: turning viewers from spectators into part of the stream.</p>
<!--GORSEL-->
<h2>The first seconds: welcome newcomers</h2>
<p>Someone who joins later doesn't know what's going on. If they land in the middle of a long explanation, they miss the context and often leave. That's why it matters to welcome newcomers at regular intervals throughout the stream and give them a quick recap.</p>
<div class="crs-template"><span class="crs-template-label">Welcome line</span><p>“Welcome @username! Today we're talking about mistakes people make when dyeing their hair at home. We just answered the orange-tone question and now we're moving on to aftercare. Is your hair dyed?”</p></div>
<p>This line has three parts: a greeting by name, one sentence of context and an easy question. The last part is crucial; it gives the viewer a reason to type. Once the stream gets busy, though, greeting every single person breaks the flow. At that point, welcome newcomers as a group: “Welcome to everyone who joined in the last few minutes...”</p>

<h2>Pinned comments: your stream's shop window</h2>
<p>On LIVE you can pin a comment to the top of the screen (the feature's name and location may vary by app version). The pinned comment is the first text every newcomer sees; it keeps explaining the context even while you're talking.</p>
<ul>
  <li><strong>State the topic:</strong> Say what the stream is about in one sentence.</li>
  <li><strong>State your promise:</strong> Give a reason to stay until the end.</li>
  <li><strong>State how to join in:</strong> Tell viewers how to take part: “Start your question with Q.”</li>
</ul>
<div class="crs-template"><span class="crs-template-label">Pinned comment example</span><p>Today: 3-ingredient iced coffee ☕ At the end I'll fix the most common milk foam mistake live. Start your question with Q!</p></div>
<div class="crs-callout tip"><strong class="crs-callout-title">💡 Tip</strong><p>Update the pinned comment when the stream moves to a new segment. For example, switching it to “Q&amp;A time now, drop your question” when you start Q&amp;A helps newcomers instantly understand what to do.</p></div>

<h2>Name call-outs and asking the right questions</h2>
<p>People love hearing their name. That's LIVE's biggest advantage over short video: you can answer viewers by name, in the moment. But not every question drives the same interaction. Questions that are hard or long to answer create silence; <mark>questions answered with one word or one number</mark> get the comments flowing.</p>
<table class="crs-table green">
  <thead><tr><th>Technique</th><th>Example</th><th>When?</th><th>Effect</th></tr></thead>
  <tbody>
    <tr><td>Two-option question</td><td>“Milk or black? Type 1 or 2”</td><td>At the opening and when energy dips</td><td><span class="crs-badge good">Quick participation</span></td></tr>
    <tr><td>Personal experience question</td><td>“What mistake have you made most at home?”</td><td>During the interaction break</td><td><span class="crs-badge good">Deeper conversation</span></td></tr>
    <tr><td>Guessing game</td><td>“How many minutes did this coffee brew? Guess”</td><td>Between main segments</td><td><span class="crs-badge good">Fun</span></td></tr>
    <tr><td>Asking for ideas</td><td>“What should we do next stream?”</td><td>Near the wrap-up</td><td><span class="crs-badge mid">A reason to return</span></td></tr>
    <tr><td>Vague question</td><td>“Anyone have questions?”</td><td>Avoid</td><td><span class="crs-badge bad">Usually silence</span></td></tr>
  </tbody>
</table>
<p>When answering a comment, read it out loud first, then answer. Other viewers may have missed it; reading it aloud keeps everyone on track and makes the person who wrote it feel seen.</p>

<h2>Mini goals: give your stream direction</h2>
<p>A mini goal is a small, fun milestone you reach together with viewers. It adds a storyline and a sense of progress to the stream. What matters is that goals relate to your content and that anyone can join in for free.</p>
<ul>
  <li>“When we hit 20 recipe requests in the comments, I'll reveal a bonus recipe.”</li>
  <li>“Send likes by tapping the screen and I'll speed up the next step.”</li>
  <li>“Everyone type your favorite color, and I'll try the most popular one next stream.”</li>
</ul>
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Watch out</strong><p>TikTok's goal features for LIVE and the rules attached to them can change over time. Gift-related goals and the limits on asking viewers for gifts are covered separately in lesson five; the mini goals suggested here are content-focused goals that require no payment at all.</p></div>

<h2>Moderators: your stream's second pair of eyes</h2>
<p>Talking and checking every comment at the same time is hard. A moderator is someone you trust who hides inappropriate comments, mutes troublemakers and reminds you of important questions while you stream. The app lets you assign specific accounts as LIVE moderators; the permissions they get may vary with the current app version.</p>
<ol class="crs-steps">
  <li><strong>Choose the right person.</strong> Someone who knows your audience, stays calm and watches regularly: a friend, a teammate or a long-time commenter you trust.</li>
  <li><strong>Assign them in the app.</strong> Add the account in the moderator section of your LIVE settings; doing it before you go live makes things easier.</li>
  <li><strong>Give written rules.</strong> Share a short note on which comments to hide, who to mute and when to alert you.</li>
  <li><strong>Debrief after the stream.</strong> What happened, which comments caused trouble, what should change next time? Five minutes is enough.</li>
</ol>
<div class="crs-callout danger"><strong class="crs-callout-title">⛔ Don't do this</strong><p>Never give your account password to a moderator or helper. Moderator permissions are enough for them to manage comments from their own account. Sharing your password puts your account's security at risk and can lead to access problems later.</p></div>

<h2>Bringing on guests and co-hosting</h2>
<p>TikTok offers several features for streaming with other creators or inviting viewers on as guests; their names, requirements and scope can vary by region and over time. Used well, guests bring two audiences together and add fresh energy to your stream.</p>
<p>There are a few simple rules when you bring someone on: get to know the guest beforehand, agree on the topic together and make sure they also meet the age and guideline requirements. Pulling a random stranger on stream can put content you can't control on your LIVE, and as the host, much of the responsibility falls on you.</p>

<h2>Manage your own energy</h2>
<p>You are the biggest source of interaction. A host who seems tired, bored or keeps glancing away drags viewers' energy down too.</p>
<ul class="crs-checklist">
  <li>Warm up by talking out loud for a few minutes before you go live</li>
  <li>Vary your tone and pace throughout the stream</li>
  <li>Look at the camera, meaning your viewers' eyes, not just the comments</li>
  <li>Don't panic in quiet moments; go back to your backup material</li>
  <li>If you feel tired, end earlier than planned, but with a proper wrap-up</li>
</ul>
<p>As interaction grows, something else starts to appear on your stream: gifts. Some viewers may send gifts to say thanks or show support. In the next lesson we'll look at how gifts, Diamonds and the income logic work, based on the current policy rather than made-up numbers, and without pressuring viewers.</p>
<div class="crs-keypoints"><strong class="crs-callout-title">📌 Key takeaways</strong><ul>
  <li>Welcome newcomers with their name, one sentence of context and an easy question.</li>
  <li>Your pinned comment should include the topic, your promise and how to join in; update it as segments change.</li>
  <li>One-word-answer questions get comments flowing; avoid vague questions.</li>
  <li>Keep mini goals free and content-focused; choose moderators, but never share your password.</li>
</ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Your task</strong><p>For your next stream, write a welcome line, a pinned comment and five questions using at least three techniques from the table. Choose someone you trust as a moderator and prepare a short written moderation note for them: which comments to hide, who to mute and when to alert you.</p></div>
`
};
