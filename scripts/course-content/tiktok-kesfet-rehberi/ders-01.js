'use strict';
module.exports = {
  slug: 'for-you-akisi-nasil-calisir',
  title_tr: 'Keşfet (For You) Akışı Nasıl Çalışır: Sinyaller ve Test Mantığı',
  title_en: 'How the For You Feed Works: Signals and the Testing Logic',
  summary_tr: 'TikTok\'un kendi açıkladığı öneri sinyallerini, "test havuzu" denen dağıtım mantığının ne kadarının bilinip ne kadarının tahmin olduğunu ve bu bilgiyi video üretimine nasıl çevireceğini öğren.',
  summary_en: 'Learn the recommendation signals TikTok has publicly described, how much of the so-called "test pool" logic is known versus guessed, and how to turn that into better videos.',
  visual: {
    type: 'steps',
    title_tr: 'Bir videonun Keşfet yolculuğu (basitleştirilmiş)',
    title_en: 'A video\'s path through For You (simplified)',
    items: [
      { tr: 'Video yüklenir ve incelenir', en: 'Video is uploaded and reviewed' },
      { tr: 'İlgili küçük bir kitleye gider', en: 'Shown to a small, relevant group' },
      { tr: 'İzlenme ve etkileşim sinyalleri okunur', en: 'Watch and engagement signals are read' },
      { tr: 'Sinyal iyiyse benzer kitlelere açılır', en: 'Strong signals open similar audiences' }
    ]
  },
  content_tr: `<p>TikTok'ta herkesin aynı soruyu sorduğunu görürsün: "Videom neden keşfete düşmedi?" Bu sorunun tek bir cevabı yok, ama bir mantığı var. Keşfet (uygulamadaki adıyla <strong>For You</strong> ya da "Sana Özel") akışı, takip ettiğin hesaplardan bağımsız olarak sana ilgileneceğini tahmin ettiği videoları gösteren bir öneri sistemidir. Yani TikTok'ta takipçi sayın düşük olsa bile videon geniş bir kitleye ulaşabilir; tersine, kalabalık bir hesabın videosu da sessiz kalabilir.</p>
<p>Bu derste önce TikTok'un kendi resmi açıklamalarında anlattığı sinyalleri, sonra içerik üreticileri arasında konuşulan ama resmi olarak doğrulanmamış "test havuzu" fikrini ayıracağız. Amaç, efsanelerle değil, bilinen gerçeklerle çalışan bir üretim alışkanlığı kurmak.</p>
<!--GORSEL-->
<h2>TikTok'un kendi açıkladığı sinyaller</h2>
<p>TikTok, öneri sisteminin nasıl çalıştığını kendi haber odası ve yardım sayfalarında genel hatlarıyla anlattı. Bu açıklamalara göre öneriler, birbirinden farklı ağırlıklara sahip birkaç sinyal grubunun birleşimiyle oluşur. Ayrıntılı formül paylaşılmadı; aşağıdaki tablo yalnızca açıklanan kategorileri özetler.</p>
<table class="crs-table blue">
  <thead><tr><th>Sinyal grubu</th><th>İçinde neler var</th><th>Senin için anlamı</th></tr></thead>
  <tbody>
    <tr><td><strong>Kullanıcı etkileşimleri</strong></td><td>Beğeni, paylaşım, yorum, takip edilen hesaplar, sonuna kadar izlenen videolar, kullanıcının kendi ürettiği içerik</td><td><span class="crs-badge good">En güçlü alan</span> İzlenme ve etkileşimi artıran her karar burada işe yarar</td></tr>
    <tr><td><strong>Video bilgileri</strong></td><td>Açıklama metni, sesler, hashtagler gibi içerik detayları</td><td><span class="crs-badge mid">Yardımcı</span> Videonun kime gösterileceğini anlamasına yardım eder</td></tr>
    <tr><td><strong>Cihaz ve hesap ayarları</strong></td><td>Dil tercihi, ülke, cihaz türü</td><td><span class="crs-badge bad">Zayıf ağırlık</span> TikTok bunların daha düşük ağırlık aldığını belirtiyor</td></tr>
  </tbody>
</table>
<p>TikTok'un verdiği örnek öğreticidir: Bir kullanıcının <mark>uzun bir videoyu baştan sona izlemesi</mark>, izleyiciyle üreticinin aynı ülkede olması gibi zayıf bir göstergeden çok daha fazla ağırlık taşır. Bu cümle, bu eğitimin geri kalanının neden izlenme süresi etrafında döndüğünü özetliyor.</p>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Bilgi</strong><p>TikTok, takipçi sayısının ve hesabın daha önce yüksek performanslı videolar yayınlamış olmasının öneri sisteminde doğrudan bir etken olmadığını açıkladı. Dolaylı etkileri olabilir (örneğin takipçilerin videoyu hızlı izlemesi), ama "büyük hesap otomatik öne çıkar" kuralı resmi olarak yok.</p></div>
<h2>"Test havuzu" mantığı: bilinen ve tahmin edilen</h2>
<p>İçerik üreticileri arasında yaygın bir anlatım var: Yeni bir video önce küçük bir kitleye gösterilir, bu kitlenin tepkisi iyi olursa daha büyük bir kitleye, sonra daha da büyüğüne açılır. TikTok yeni videoların ilgilenebilecek kullanıcılara gösterilerek dağıtıldığını anlatıyor; ancak <strong>kademelerin sayısı, her kademenin kaç kişi olduğu ve geçiş eşikleri resmi olarak açıklanmadı.</strong></p>
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Dikkat</strong><p>"İlk 300 kişi", "yüzde 70 tamamlama oranı şart", "ilk 1 saatte şu kadar beğeni gelmeli" gibi sayılar internette sık dolaşır. Bunlar topluluk tahminleridir, TikTok tarafından doğrulanmış eşikler değildir. Bu eğitimde böyle sabit sayılar vermeyeceğiz; bunun yerine kendi verinle karşılaştırma yapmayı öğreneceksin.</p></div>
<p>Spekülasyon kısmını bir kenara koyduğumuzda, pratikte işe yarayan yorum şudur: Videonun ilk izleyicileri ona nasıl davranırsa, sistem o videonun benzer kişilere gösterilmeye değer olup olmadığı hakkında o kadar bilgi toplar. Bu yüzden ilk izleyicilerin videoyu kaydırıp geçmemesi, izlemeye devam etmesi ve bir tepki bırakması kritik.</p>
<h3>Olumsuz sinyaller de var</h3>
<p>Öneri sistemi yalnızca olumlu tepkileri okumaz. TikTok, kullanıcıların bir videoya uzun basıp "İlgilenmiyorum" seçeneğini kullanabildiğini ve bu tür geri bildirimlerin benzer içeriklerin daha az gösterilmesine yol açabileceğini anlatıyor. Videonun ilk anlarında hızla kaydırılması da, resmi bir formül açıklanmamış olsa bile, mantıken izleyicinin ilgisinin olmadığına dair bir işarettir. Bu yüzden yanıltıcı kapak ve kancalar kısa vadede tıklama getirse bile, beklentiyi karşılamadığında videonun aleyhine çalışabilir.</p>
<h3>Sinyalleri izleyici davranışına çevirmek</h3>
<p>Sistem senin niyetini değil, izleyicinin davranışını görür. Aşağıdaki kontrol listesi, her videoyu yayınlamadan önce kendine sorman gereken soruları içeriyor:</p>
<ul class="crs-checklist">
  <li>İlk saniyede izleyicinin "bu bana göre" demesini sağlayacak net bir konu var mı?</li>
  <li>Video, söyleyeceği şeyden daha uzun mu? Gereksiz giriş veya tekrar var mı?</li>
  <li>Sonuna kadar izlemenin bir ödülü (sonuç, cevap, dönüşüm) var mı?</li>
  <li>Açıklama ve ekrandaki metin, videonun konusunu net anlatıyor mu?</li>
  <li>İzleyicinin yorum yazması, kaydetmesi veya paylaşması için doğal bir sebep var mı?</li>
</ul>
<h2>Keşfet'e uygun olmayan içerik</h2>
<p>TikTok, Topluluk Kuralları içinde bazı içeriklerin For You akışında önerilmeye uygun olmayabileceğini belirtiyor. Bu, videonun silinmesi anlamına gelmez; ama dağıtımı sınırlı kalır. Liste zaman içinde güncellendiği için güncel hâlini uygulama içindeki Topluluk Kuralları bölümünden kontrol etmelisin.</p>
<div class="crs-compare">
  <div class="crs-compare-col bad"><strong class="crs-compare-title">❌ Dağıtımı sınırlayabilecek</strong><ul><li>Başka platformun filigranı bulunan yeniden yüklemeler</li><li>Başkasının videosunu hiçbir katkı olmadan aynen paylaşmak</li><li>Çok düşük kaliteli, anlaşılmayan görüntüler</li><li>Topluluk Kurallarına aykırı veya sınırda içerik</li></ul></div>
  <div class="crs-compare-col good"><strong class="crs-compare-title">✅ Güvenli zemin</strong><ul><li>Kendi çektiğin, özgün içerik</li><li>Başkasının videosuna kendi yorumunu ekleyen Stitch veya Düet</li><li>Net görüntü, anlaşılır ses</li><li>Kurallara uygun, açık bir konu</li></ul></div>
</div>
<div class="crs-callout tip"><strong class="crs-callout-title">💡 İpucu</strong><p>Instagram'da çektiğin bir Reels'i TikTok'a da koyacaksan, filigranlı indirilmiş dosyayı değil, telefonundaki orijinal videoyu yükle ve TikTok içinde metnini yeniden ekle.</p></div>
<h2>Bu bilgiyle nasıl çalışmalısın?</h2>
<p>Algoritmayı "kandırmaya" çalışmak yerine, izleyicinin videoyu izlemeye devam etmesini sağlamaya odaklan. Aşağıdaki adımlar bu eğitimin geri kalanının da iskeletidir:</p>
<ol class="crs-steps">
  <li><strong>Net bir konu seç.</strong> Her video tek bir fikir anlatsın; "kime ve ne için" sorusunun cevabı ilk saniyede belli olsun.</li>
  <li><strong>Girişi kısalt.</strong> Selam, tanıtım ve "bugün size..." cümlelerini atla; doğrudan konuya gir.</li>
  <li><strong>İzlenme süresini tasarla.</strong> Merak, ritim ve sona saklanan bir sonuçla izleyiciyi tut.</li>
  <li><strong>Bağlamı netleştir.</strong> Açıklama, ekran metni ve ses seçimiyle videonun konusunu TikTok'a anlat.</li>
  <li><strong>Veriye bak, tahmin etme.</strong> Analizlerde izlenme süresini ve trafik kaynağını kontrol ederek bir sonraki videoyu düzelt.</li>
</ol>
<div class="crs-template"><span class="crs-template-label">Örnek senaryo</span><p>Kadıköy'de küçük bir kahve dükkanı işlettiğini düşün. "Dükkanımıza hoş geldiniz" diye başlayan 45 saniyelik tanıtım videoları çekiyorsun ve izlenmeler düşük kalıyor. Aynı malzemeyle "Evde köpüklü süt yapmanın 3 saniyelik yolu" diye başlayan, sonucu en sonda gösteren bir video çekiyorsun. Konu netleştiği ve sonuç sona saklandığı için izleyicinin videoyu sonuna kadar izleme ihtimali artıyor.</p></div>
<p>Bir sonraki derste bu yolculuğun en kritik anına odaklanacağız: İzleyicinin kaydırıp kaydırmayacağına karar verdiği ilk 3 saniye ve TikTok'a özgü kanca türleri.</p>
<div class="crs-keypoints"><strong class="crs-callout-title">📌 Bu derste öğrendiklerin</strong><ul><li>For You akışı takipçiden bağımsız, ilgi tahminine dayalı bir öneri sistemidir.</li><li>TikTok'a göre en güçlü sinyaller kullanıcı etkileşimleri; özellikle videonun sonuna kadar izlenmesidir.</li><li>Takipçi sayısı resmi açıklamaya göre doğrudan bir etken değildir.</li><li>"Test havuzu" kademeleri ve sayısal eşikler resmi değildir; tahmin olarak ele alınmalıdır.</li><li>Filigranlı veya katkısız yeniden yüklemeler Keşfet'te sınırlı kalabilir.</li></ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Görevin</strong><p>Son 5 videonu aç ve her biri için kontrol listesindeki beş soruyu yanıtla. En çok "hayır" aldığın maddeyi bir kenara yaz; sonraki derslerde ilk o alanı düzelteceksin.</p></div>`,
  content_en: `<p>On TikTok, everyone eventually asks the same question: "Why didn't my video get on the For You page?" There's no single answer, but there is a logic. The For You feed is a recommendation system that shows people videos it predicts they'll enjoy, regardless of whom they follow. That means a small account can reach a large audience, and a large account's video can still go quiet.</p>
<p>In this lesson we'll separate two things: the signals TikTok itself has publicly described, and the "test pool" idea that creators talk about but that TikTok has never officially confirmed in detail. The goal is to build a production habit grounded in what's known, not in myths.</p>
<!--GORSEL-->
<h2>The signals TikTok has described</h2>
<p>TikTok has explained its recommendation system in broad strokes on its newsroom and help pages. According to those explanations, recommendations come from a combination of several signal groups that carry different weights. The exact formula has never been shared; the table below simply summarizes the published categories.</p>
<table class="crs-table blue">
  <thead><tr><th>Signal group</th><th>What it includes</th><th>What it means for you</th></tr></thead>
  <tbody>
    <tr><td><strong>User interactions</strong></td><td>Likes, shares, comments, accounts followed, videos watched to completion, content the user creates</td><td><span class="crs-badge good">Strongest area</span> Every decision that improves watching and engagement pays off here</td></tr>
    <tr><td><strong>Video information</strong></td><td>Content details like captions, sounds and hashtags</td><td><span class="crs-badge mid">Supporting</span> Helps the system understand who the video is for</td></tr>
    <tr><td><strong>Device and account settings</strong></td><td>Language preference, country, device type</td><td><span class="crs-badge bad">Low weight</span> TikTok says these receive lower weight</td></tr>
  </tbody>
</table>
<p>TikTok's own example is telling: whether a user <mark>finishes watching a longer video from beginning to end</mark> carries far more weight than a weak indicator such as the viewer and creator being in the same country. That one sentence explains why the rest of this course revolves around watch time.</p>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Good to know</strong><p>TikTok has stated that neither follower count nor whether an account has had previous high-performing videos are direct factors in the recommendation system. There can be indirect effects (followers watching quickly, for example), but there is no official "big accounts get pushed automatically" rule.</p></div>
<h2>The "test pool" idea: known versus guessed</h2>
<p>A common creator explanation goes like this: a new video is first shown to a small audience, and if that group responds well, it opens to a larger audience, then a larger one still. TikTok does describe distributing new videos to users who are likely to be interested; however, <strong>the number of stages, the size of each stage and the thresholds between them have never been officially published.</strong></p>
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Watch out</strong><p>Numbers like "the first 300 viewers", "you need a 70 percent completion rate" or "you need this many likes in the first hour" circulate widely online. They are community guesses, not thresholds confirmed by TikTok. This course won't give you fixed numbers like that; instead, you'll learn to compare against your own data.</p></div>
<p>Setting speculation aside, the practical reading is this: how a video's first viewers treat it tells the system whether it's worth showing to similar people. That's why it matters so much that early viewers don't swipe away, keep watching and leave some kind of reaction.</p>
<h3>Negative signals exist too</h3>
<p>The recommendation system doesn't only read positive reactions. TikTok explains that users can long-press a video and choose "Not interested", and that this kind of feedback can lead to similar content being shown less. Quickly swiping away in the first moments is also, logically, a sign of low interest, even though no official formula has been published. That's why misleading covers and hooks may win a click in the short term but can work against the video when they don't deliver on the promise.</p>
<h3>Turning signals into viewer behavior</h3>
<p>The system doesn't see your intentions; it sees viewer behavior. The checklist below is a set of questions to ask yourself before publishing any video:</p>
<ul class="crs-checklist">
  <li>Is there a clear topic in the first second that makes the viewer think "this is for me"?</li>
  <li>Is the video longer than what it has to say? Any unnecessary intro or repetition?</li>
  <li>Is there a reward for watching to the end (a result, an answer, a transformation)?</li>
  <li>Do the caption and on-screen text clearly state what the video is about?</li>
  <li>Is there a natural reason for the viewer to comment, save or share?</li>
</ul>
<h2>Content that may not be eligible for For You</h2>
<p>Within its Community Guidelines, TikTok notes that some content may not be eligible for recommendation in the For You feed. That doesn't mean the video is removed, but its distribution stays limited. The list is updated over time, so check the current version in the Community Guidelines section inside the app.</p>
<div class="crs-compare">
  <div class="crs-compare-col bad"><strong class="crs-compare-title">❌ May limit distribution</strong><ul><li>Re-uploads carrying another platform's watermark</li><li>Reposting someone else's video with no added contribution</li><li>Very low-quality, hard-to-follow footage</li><li>Content that breaks or skirts the Community Guidelines</li></ul></div>
  <div class="crs-compare-col good"><strong class="crs-compare-title">✅ Safe ground</strong><ul><li>Original content you filmed yourself</li><li>Stitches or Duets that add your own take</li><li>Clear picture, understandable audio</li><li>A clear topic that follows the rules</li></ul></div>
</div>
<div class="crs-callout tip"><strong class="crs-callout-title">💡 Tip</strong><p>If you're cross-posting a video you made for another platform, upload the original file from your phone rather than a watermarked download, and add the on-screen text again inside TikTok.</p></div>
<h2>How to work with this knowledge</h2>
<p>Instead of trying to "trick" the algorithm, focus on getting viewers to keep watching. These steps are also the backbone of the rest of this course:</p>
<ol class="crs-steps">
  <li><strong>Pick one clear topic.</strong> Each video should carry one idea, and "who is this for and why" should be obvious in the first second.</li>
  <li><strong>Cut the intro.</strong> Skip the greetings, the introductions and the "today I'm going to show you"; get straight to the point.</li>
  <li><strong>Design for watch time.</strong> Hold viewers with curiosity, pacing and a payoff saved for the end.</li>
  <li><strong>Make the context clear.</strong> Use your caption, on-screen text and sound choice to tell TikTok what the video is about.</li>
  <li><strong>Read the data, don't guess.</strong> Check watch time and traffic sources in analytics, then fix the next video.</li>
</ol>
<div class="crs-template"><span class="crs-template-label">Example scenario</span><p>Imagine a small coffee shop owner (a hypothetical example) who films 45-second "Welcome to our shop" tours and gets very few views. Using the same footage, they post a video that opens with "The 3-second way to froth milk at home" and reveals the result only at the very end. Because the topic is clear and the payoff is saved for last, viewers are more likely to watch to the end.</p></div>
<p>In the next lesson we'll zoom in on the most critical moment of this journey: the first 3 seconds, when viewers decide whether to swipe, and the hook types that are specific to TikTok.</p>
<div class="crs-keypoints"><strong class="crs-callout-title">📌 Key takeaways</strong><ul><li>The For You feed is a recommendation system based on predicted interest, independent of who you follow.</li><li>According to TikTok, user interactions are the strongest signals, especially watching a video to the end.</li><li>Per TikTok's statement, follower count is not a direct factor.</li><li>"Test pool" stages and numeric thresholds are not official; treat them as guesses.</li><li>Watermarked or contribution-free re-uploads may be limited on For You.</li></ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Your task</strong><p>Open your last 5 videos and answer the five checklist questions for each one. Write down the item that got the most "no" answers; that's the area you'll fix first in the coming lessons.</p></div>`
};
