'use strict';
module.exports = {
  slug: 'kaydedilen-ve-paylasilan-carouseller',
  title_tr: 'Kaydedilen ve Paylaşılan Carousel Tasarlamak',
  title_en: 'Designing Carousels That Get Saved and Shared',
  summary_tr: "Carousel'ler, hesabına derinlik katan ve en çok kaydedilen içerik türlerinden biridir. Bu derste işe yarayan carousel tiplerini, kapaktan son slayta kadar anatomiyi ve okunaklı tasarımın temel kurallarını öğreneceksin.",
  summary_en: 'Carousels add depth to your account and are among the most-saved types of content. In this lesson you will learn which carousel types work, the anatomy from cover to final slide and the basics of readable design.',
  visual: {
    type: 'compare',
    title_tr: 'Carousel: zayıf ve güçlü kurgu',
    title_en: 'Carousels: weak vs strong build',
    items: [
      { tr: 'Kapakta belirsiz başlık', en: 'Vague title on the cover' },
      { tr: 'Slayt başına uzun paragraf', en: 'Long paragraph per slide' },
      { tr: 'Son slaytta yönlendirme yok', en: 'No direction on last slide' },
      { tr: 'Kapakta net vaat', en: 'Clear promise on the cover' },
      { tr: 'Slayt başına tek fikir', en: 'One idea per slide' },
      { tr: 'Sonda kaydet / gönder çağrısı', en: 'Save or send prompt at the end' }
    ]
  },
  content_tr: `
<p>Reels seni yeni insanlarla tanıştırır; carousel ise o insanlara "Bu hesabı takip etmeliyim" dedirtecek derinliği sunar. Kaydırmalı gönderiler, bir konuyu adım adım anlatmak, bir kontrol listesi vermek ya da bir karşılaştırma yapmak için en uygun formattır. İyi bir carousel, insanların "sonra tekrar bakarım" diyerek kaydettiği, "bunu görmesi lazım" diyerek bir arkadaşına gönderdiği türden bir başvuru kaynağıdır.</p>
<p>Bu derste hangi carousel tiplerinin kaydedilme ve paylaşılma eğiliminde olduğunu, bir carousel'in kapaktan son slayta kadar nasıl kurgulandığını ve tasarımda dikkat etmen gereken temel kuralları ele alacağız. Tasarımcı olmana gerek yok; sade, okunaklı ve tutarlı bir şablon yeterli.</p>
<!--GORSEL-->
<h2>Carousel neden bu kadar değerli?</h2>
<p>Bir carousel'de izleyici her slaytı kendi kaydırır. Yani içerikle aktif olarak etkileşime girer ve gönderide daha uzun süre kalır. Kaydetme ve gönderme davranışları da bu formatta doğal olarak ortaya çıkar, çünkü carousel'ler çoğu zaman tekrar dönüp bakılacak türden bilgiler taşır.</p>
<p>Bir de pratik bir avantaj var: Kullanıcıların sık gözlemlediği bir davranışa göre, Instagram bir carousel'i ilk gördüğünde kaydırmayan kişilere aynı gönderiyi daha sonra farklı bir slayttan başlayarak tekrar gösterebiliyor. Bu davranışın ne sıklıkla olduğu belirsiz ve değişebilir; ama her slaytın kendi başına anlamlı olması için ek bir sebep. <mark>Her slayt, tek başına görüldüğünde bile merak uyandırmalı.</mark></p>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Bilgi</strong><p>Bir carousel'e eklenebilecek azami görsel sayısı, yazıldığı tarihte (2026) 20 civarındadır; güncel sınırı uygulama içinden kontrol et. Sınırın yüksek olması, her carousel'i uzun yapman gerektiği anlamına gelmez. Çoğu konu 6-10 slaytta rahatça anlatılır.</p></div>
<h2>En çok işe yarayan carousel tipleri</h2>
<p>Aşağıdaki tipler, birçok nişte kaydedilme ya da paylaşılma eğilimi gösteren formatlardır. Kendi nişine uyarlarken hedef kitle cümlenden şaşma.</p>
<table class="crs-table yellow">
<thead><tr><th>Tip</th><th>Örnek başlık</th><th>Öne çıkan davranış</th></tr></thead>
<tbody>
<tr><td>Adım adım rehber</td><td>"Kıvırcık saç için 5 adımlı akşam rutini"</td><td><span class="crs-badge good">Kaydetme</span></td></tr>
<tr><td>Kontrol listesi</td><td>"Yurda taşınmadan önce alman gereken 12 şey"</td><td><span class="crs-badge good">Kaydetme</span></td></tr>
<tr><td>Yanlış / doğru</td><td>"Ofis kombininde yapılan 6 hata ve çözümleri"</td><td><span class="crs-badge good">Kaydetme + gönderme</span></td></tr>
<tr><td>Mini sözlük</td><td>"Kahve menüsündeki 8 terimin anlamı"</td><td><span class="crs-badge mid">Kaydetme</span></td></tr>
<tr><td>Fikir / görüş</td><td>"Kafede laptopla çalışmak hakkında popüler olmayan görüşüm"</td><td><span class="crs-badge mid">Yorum + gönderme</span></td></tr>
<tr><td>Öncesi / sonrası</td><td>"3 haftada balkonu çalışma köşesine çevirdik"</td><td><span class="crs-badge new">Gönderme</span></td></tr>
</tbody>
</table>
<h2>Bir carousel'in anatomisi</h2>
<p>Her iyi carousel, birbirinin devamı olan dört bölümden oluşur. Bu yapıyı bir kez oturttuğunda, yeni carousel'ler üretmek dakikalar alır.</p>
<ol class="crs-steps">
<li><strong>Kapak (1. slayt).</strong> Tek işi, kaydırmayı başlatmak. Büyük, net bir başlık ve somut bir vaat: sayı, sonuç ya da sorun. "Kahve hakkında bilgiler" değil, "Evde demlediğin kahve neden acı oluyor? 5 sebep."</li>
<li><strong>Köprü (2. slayt).</strong> Sorunu derinleştir ya da neden önemli olduğunu söyle. Bu slayt, kapağı geçen izleyiciyi gövdeye bağlar ve tekrar gösterimde ilk görülen slayt olabilir.</li>
<li><strong>Gövde (3. slayttan sona doğru).</strong> Her slaytta tek fikir. Kısa bir başlık, bir iki cümle ya da bir görsel. Paragraf yığını değil; izleyici her slaytı birkaç saniyede okuyabilmeli.</li>
<li><strong>Kapanış (son slayt).</strong> Özet ve net bir çağrı: "Sonraki demlemede lazım olacak, kaydet" ya da "Hep acı kahve içen arkadaşına gönder." Son slayt, kaydetme ve gönderme davranışını doğrudan tetikler.</li>
</ol>
<div class="crs-template"><span class="crs-template-label">Kapak başlığı formülleri</span><p>"[Sayı] [hedef kişi] için [sonuç]" → "Yeni başlayan koşucular için 7 ısınma hareketi"<br>"[Sorun] mu? [Sayı] sebep" → "Saçın kabarıyor mu? 4 sebep"<br>"[Hata] yapmayı bırak" → "Kahveyi kaynar suyla demlemeyi bırak"<br>"[Süre]de [sonuç]" → "10 dakikada haftalık yemek planı"</p></div>
<div class="crs-callout tip"><strong class="crs-callout-title">💡 İpucu</strong><p>Önce yaz, sonra tasarla. Carousel'in metnini bir not dosyasında slayt slayt yaz, her slaytı "tek fikir, en fazla iki cümle" kuralına göre kısalt. Tasarım aşamasına ancak metin bittiğinde geç. Böylece her slayt bir amaca hizmet eder ve gereksiz slaytlar baştan elenir.</p></div>
<h2>Okunaklı tasarımın temel kuralları</h2>
<p>Carousel'ler çoğunlukla telefonda, hızla kaydırılırken görülür. Bu yüzden tasarımın ilk görevi güzel görünmek değil, kolay okunmaktır. Aşağıdaki kontrol listesi, tasarım bilgisi olmayanlar için bile işe yarayan temel ilkeleri toplar.</p>
<ul class="crs-checklist">
<li>Dikey format kullanıyorum; yazıldığı tarihte 4:5 oranı yaygın ve akışta daha fazla alan kaplıyor (güncel önerilen oranları kontrol et)</li>
<li>Yazı boyutu telefonda zorlanmadan okunacak kadar büyük</li>
<li>Arka plan ile yazı arasında güçlü kontrast var</li>
<li>Her slaytta en fazla 2 yazı tipi ve sınırlı sayıda renk kullanıyorum</li>
<li>Tüm carousel'lerde aynı şablonu ve renk paletini kullanıyorum; hesabım tanınabilir görünüyor</li>
<li>Kenarlarda boşluk bırakıyorum; önemli yazılar arayüz öğelerinin altında kalmıyor</li>
</ul>
<h3>Açıklama metni (caption) da önemli</h3>
<p>Carousel'in açıklaması, slaytları tekrar etmek için değil, bağlam eklemek içindir. İlk satır, açıklamanın "kanca"sıdır; geri kalanında kısa bir ek bilgi, kişisel bir not ya da bir soru yer alabilir. Açıklamaya, insanların Instagram aramasında yazacağı anahtar kelimeleri doğal şekilde eklemek, içeriğinin arama sonuçlarında bulunma ihtimalini artırabilir.</p>
<h3>Fotoğraflı carousel de bir seçenek</h3>
<p>Her carousel'in yazılı slaytlardan oluşması gerekmez. Bir kafe, yeni menüsünü gerçek fotoğraflarla adım adım tanıtabilir; bir butik, aynı parçayla kurulan beş farklı kombini sırayla gösterebilir; bir kuaför, bir saç dönüşümünün aşamalarını fotoğraflarla anlatabilir. Bu tür carousel'lerde de aynı kurallar geçerlidir: İlk fotoğraf merak uyandırmalı, her kare yeni bir şey göstermeli ve son kare bir çağrıyla bitmeli. Fotoğrafların üzerine kısa bir başlık ya da numara eklemek, izleyicinin nerede olduğunu anlamasını kolaylaştırır. Yazılı ve fotoğraflı carousel'leri dönüşümlü kullanmak, profil ızgaranı da daha canlı gösterir.</p>
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Dikkat</strong><p>"Kaydet!" çağrısı, ancak içerik gerçekten kaydedilmeye değerse işe yarar. Her gönderinin sonuna mekanik olarak "kaydet, paylaş, beğen" yazmak, izleyicide yorgunluk yaratır. Çağrıyı içeriğe göre seç: rehberde "kaydet", ilişkilendirilebilir içerikte "gönder", görüş içeriğinde "yorumda söyle".</p></div>
<div class="crs-callout danger"><strong class="crs-callout-title">⛔ Bunu yapma</strong><p>Başka hesapların carousel'lerini ekran görüntüsüyle alıp kendi şablonunla yeniden yayınlama. Bilgi herkese açık olabilir, ama anlatım, kurgu ve tasarım emeği o hesaba aittir. Kendi deneyimini, kendi örneklerini ve kendi açını ekleyerek özgün içerik üret.</p></div>
<p>Reels ve carousel'lerle yeni insanlara ulaşıyor ve onlara değer sunuyorsun. Ama takipçiyi sadık bir topluluğa dönüştüren şey sohbettir. Bir sonraki derste hikâyeler, yorumlar ve DM'lerle nasıl gerçek bir bağ kuracağını göreceğiz.</p>
<div class="crs-keypoints"><strong class="crs-callout-title">📌 Bu derste öğrendiklerin</strong><ul>
<li>Carousel'ler başvuru içeriği oldukları için kaydedilme ve paylaşılma eğilimindedir.</li>
<li>Adım adım rehber, kontrol listesi ve yanlış/doğru tipleri birçok nişte iyi çalışır.</li>
<li>Kapak kaydırmayı başlatır, son slayt kaydetme ve gönderme çağrısı yapar.</li>
<li>Her slaytta tek fikir; önce metin, sonra tasarım.</li>
<li>Okunaklılık, güzellikten önce gelir; tutarlı bir şablon hesabını tanınır kılar.</li>
</ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Görevin</strong><p>Kendine sade bir carousel şablonu hazırla (kapak, gövde ve kapanış slaytı). Ardından fikir listenden bir "adım adım rehber" ya da "kontrol listesi" konusu seç, metnini slayt slayt yaz ve 6-10 slaytlık ilk carousel'ini yayınla.</p></div>
`,
  content_en: `
<p>Reels introduce you to new people; carousels give those people the depth that makes them think, "I should follow this account." Swipeable posts are the best format for explaining a topic step by step, giving a checklist or making a comparison. A good carousel is the kind of reference people save because "I'll look at this again later" and send to a friend because "they need to see this".</p>
<p>In this lesson we will look at which carousel types tend to get saved and shared, how a carousel is built from cover to final slide and the basic rules of design. You don't need to be a designer; a simple, readable, consistent template is enough.</p>
<!--GORSEL-->
<h2>Why are carousels so valuable?</h2>
<p>In a carousel, the viewer swipes each slide themselves. They interact with the content actively and stay on the post longer. Saving and sending also come naturally in this format, because carousels usually hold information worth coming back to.</p>
<p>There is a practical advantage too. Based on behaviour users often observe, when someone doesn't swipe a carousel the first time, Instagram may show them the same post again later starting from a different slide. How often this happens is unclear and may change, but it is another reason for every slide to make sense on its own. <mark>Every slide should spark curiosity even when seen alone.</mark></p>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Good to know</strong><p>At the time of writing (2026), the maximum number of images in a carousel is around 20; check the current limit inside the app. A high limit doesn't mean every carousel should be long. Most topics fit comfortably into 6-10 slides.</p></div>
<h2>Carousel types that work best</h2>
<p>The types below tend to get saved or shared in many niches. When adapting them, stay true to your audience statement.</p>
<table class="crs-table yellow">
<thead><tr><th>Type</th><th>Example title</th><th>Typical behaviour</th></tr></thead>
<tbody>
<tr><td>Step-by-step guide</td><td>"A 5-step evening routine for curly hair"</td><td><span class="crs-badge good">Saves</span></td></tr>
<tr><td>Checklist</td><td>"12 things to buy before moving into halls"</td><td><span class="crs-badge good">Saves</span></td></tr>
<tr><td>Wrong / right</td><td>"6 office outfit mistakes and how to fix them"</td><td><span class="crs-badge good">Saves + sends</span></td></tr>
<tr><td>Mini glossary</td><td>"What 8 coffee menu terms actually mean"</td><td><span class="crs-badge mid">Saves</span></td></tr>
<tr><td>Opinion</td><td>"My unpopular opinion on working from cafes"</td><td><span class="crs-badge mid">Comments + sends</span></td></tr>
<tr><td>Before / after</td><td>"We turned a balcony into a work nook in 3 weeks"</td><td><span class="crs-badge new">Sends</span></td></tr>
</tbody>
</table>
<h2>The anatomy of a carousel</h2>
<p>Every good carousel has four connected parts. Once you have this structure down, producing new carousels takes minutes.</p>
<ol class="crs-steps">
<li><strong>Cover (slide 1).</strong> Its only job is to start the swipe. A big, clear headline and a concrete promise: a number, a result or a problem. Not "Coffee facts" but "Why does your home-brewed coffee taste bitter? 5 reasons."</li>
<li><strong>Bridge (slide 2).</strong> Deepen the problem or say why it matters. This slide connects the viewer who got past the cover to the body, and it may be the first slide someone sees on a repeat showing.</li>
<li><strong>Body (slide 3 to near the end).</strong> One idea per slide. A short heading, one or two sentences or a visual. Not a wall of text; viewers should read each slide in a few seconds.</li>
<li><strong>Close (final slide).</strong> A summary and a clear call: "You'll need this for your next brew, save it" or "Send this to the friend who always drinks bitter coffee." The final slide directly triggers saving and sending.</li>
</ol>
<div class="crs-template"><span class="crs-template-label">Cover headline formulas</span><p>"[Number] [result] for [target person]" → "7 warm-up moves for new runners"<br>"[Problem]? [Number] reasons" → "Frizzy hair? 4 reasons"<br>"Stop [mistake]" → "Stop brewing coffee with boiling water"<br>"[Result] in [time]" → "A weekly meal plan in 10 minutes"</p></div>
<div class="crs-callout tip"><strong class="crs-callout-title">💡 Tip</strong><p>Write first, design second. Draft the carousel's text slide by slide in a notes file and trim each slide to "one idea, two sentences max". Only move to design once the text is finished. That way every slide has a purpose and unnecessary slides are cut early.</p></div>
<h2>Basic rules of readable design</h2>
<p>Carousels are mostly seen on a phone, while scrolling quickly. So design's first job is not to look pretty but to be easy to read. The checklist below collects basic principles that work even if you have no design background.</p>
<ul class="crs-checklist">
<li>I use a vertical format; at the time of writing 4:5 is common and takes up more space in the feed (check current recommended ratios)</li>
<li>Text is large enough to read easily on a phone</li>
<li>There is strong contrast between background and text</li>
<li>I use at most 2 fonts and a limited number of colours per slide</li>
<li>I use the same template and colour palette for every carousel, so my account is recognisable</li>
<li>I leave margins at the edges so key text isn't hidden under interface elements</li>
</ul>
<h3>The caption matters too</h3>
<p>A carousel's caption is not for repeating the slides; it is for adding context. The first line is the caption's "hook"; the rest can hold a short extra tip, a personal note or a question. Naturally including the keywords people would type into Instagram search can improve the chance of your post being found in search results.</p>
<h3>Photo carousels are an option too</h3>
<p>Not every carousel has to be made of text slides. A cafe can introduce its new menu step by step with real photos; a boutique can show five different outfits built around the same piece; a hairdresser can walk through the stages of a transformation in pictures. The same rules apply to these carousels: the first photo should spark curiosity, every frame should show something new and the last frame should end with a call to action. Adding a short heading or a number on each photo helps viewers know where they are. Alternating between text and photo carousels also makes your profile grid look livelier.</p>
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Watch out</strong><p>A "Save this!" call only works if the content is genuinely worth saving. Mechanically adding "save, share, like" to the end of every post tires your audience. Match the call to the content: "save" for guides, "send" for relatable posts, "tell me in the comments" for opinion posts.</p></div>
<div class="crs-callout danger"><strong class="crs-callout-title">⛔ Don't do this</strong><p>Don't screenshot other accounts' carousels and republish them in your own template. The information may be public, but the explanation, structure and design work belong to that account. Create original content by adding your own experience, examples and angle.</p></div>
<p>With Reels and carousels you are reaching new people and giving them value. But what turns followers into a loyal community is conversation. In the next lesson we will see how to build a real connection through Stories, comments and DMs.</p>
<div class="crs-keypoints"><strong class="crs-callout-title">📌 Key takeaways</strong><ul>
<li>Carousels tend to be saved and shared because they are reference content.</li>
<li>Step-by-step guides, checklists and wrong/right posts work well in many niches.</li>
<li>The cover starts the swipe; the final slide calls for saves and sends.</li>
<li>One idea per slide; text first, design second.</li>
<li>Readability comes before beauty; a consistent template makes you recognisable.</li>
</ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Your task</strong><p>Build yourself a simple carousel template (cover, body and closing slide). Then pick a "step-by-step guide" or "checklist" topic from your idea list, write its text slide by slide and publish your first 6-10 slide carousel.</p></div>
`
};
