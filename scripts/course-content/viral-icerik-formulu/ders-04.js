'use strict';
module.exports = {
  slug: 'izleyiciyi-tutma-ritim-ve-acik-donguler',
  title_tr: 'İzleyiciyi Tutmak: Ritim, Açık Döngüler ve Görsel Değişim',
  title_en: 'Keeping Viewers: Rhythm, Open Loops and Visual Change',
  summary_tr: 'İzleyicinin içeriği yarıda bırakmasının nedenleri ve buna karşı üç araç: ritim, açık döngüler ve görsel değişim. Kurgu masasında kullanabileceğin bir tutma kontrol listesiyle.',
  summary_en: 'Why viewers drop off halfway and three tools to prevent it: rhythm, open loops and visual change. Plus a retention checklist you can use at the editing desk.',
  visual: {
    type: 'timeline',
    title_tr: 'İçerik boyunca tutma araçları',
    title_en: 'Retention tools across your content',
    items: [
      { tr: 'Kanca + ana döngüyü aç', en: 'Hook + open the main loop', value_tr: 'Açılış', value_en: 'Opening' },
      { tr: 'Bağlamı kısa tut, ritmi kur', en: 'Keep context short, set rhythm', value_tr: 'Erken', value_en: 'Early' },
      { tr: 'Yeni döngü aç, görüntüyü değiştir', en: 'Open a new loop, change visuals', value_tr: 'Orta', value_en: 'Middle' },
      { tr: 'Döngüleri kapat, ödülü ver', en: 'Close the loops, deliver payoff', value_tr: 'Son', value_en: 'End' }
    ]
  },
  content_tr: `
<p>İzleyici içeriğini izlerken aslında sürekli küçük bir karar veriyor: "Devam mı, geç mi?" Bu karar sadece başta değil, içeriğin her anında yeniden veriliyor. Kanca ilk kararı kazandırır; ama sonraki her an için yeni bir neden sunmazsan izleyici ortada bir yerde sessizce ayrılır.</p>
<p>Bu derste o "devam" nedenlerini bilinçli olarak yerleştirmeyi öğreneceksin. Üç aracımız var: <mark>ritim, açık döngüler ve görsel değişim</mark>. Üçü de platformdan bağımsız; kısa videoda, uzun videoda, kaydırmalı gönderide ve hatta yazı içeriğinde çalışır.</p>
<!--GORSEL-->
<h2>İzleyici neden yarıda bırakır?</h2>
<p>İzleyicinin ayrılma nedenleri genellikle üç başlıkta toplanır. Birincisi <strong>sıkılma</strong>: aynı tempo, aynı görüntü, aynı ses tonu uzun süre devam eder ve beyin yeni bir şey olmadığına karar verir. İkincisi <strong>kaybolma</strong>: izleyici nerede olduğunu, içeriğin nereye gittiğini anlamaz. Üçüncüsü <strong>tatmin</strong>: izleyici istediğini erkenden almıştır ve kalması için bir neden kalmamıştır. Ritim sıkılmaya, açık döngüler tatmine, net yapı ve görsel değişim kaybolmaya karşı çalışır.</p>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Bilgi</strong><p>Çoğu platform, içeriğinin hangi anında izleyici kaybettiğini gösteren bir izleyici tutma grafiği ya da benzer bir istatistik sunar. Ekranların adı ve yeri platformdan platforma değişir ve zamanla güncellenir; güncel yerini uygulama içinden kontrol et. Grafikteki ani düşüşler, tam olarak düzeltmen gereken anları gösterir.</p></div>

<h2>1. Ritim: içeriğin nabzı</h2>
<p>Ritim, içeriğin ne hızla ve hangi düzenle ilerlediğidir. İyi ritim, izleyiciye fark ettirmeden "burada bir şey oluyor" hissi verir. Kötü ritim ise ya sürekli aynı tondadır ya da o kadar hızlıdır ki izleyici hiçbir şeyi takip edemez.</p>
<table class="crs-table yellow">
<thead><tr><th>Ritim aracı</th><th>Ne işe yarar?</th><th>Nasıl uygulanır?</th></tr></thead>
<tbody>
<tr><td>Boşlukları kesmek</td><td>Ölü anları ortadan kaldırır</td><td>Cümle aralarındaki nefes ve duraksamaları kurguda kırp</td></tr>
<tr><td>Cümle uzunluğunu değiştirmek</td><td>Tekdüzeliği kırar</td><td>Uzun bir açıklamanın ardından kısa, vurucu bir cümle kullan</td></tr>
<tr><td>Tempo değişimi</td><td>Önemli anı işaretler</td><td>Ödülden hemen önce kısa bir duraklama ya da yavaşlama koy</td></tr>
<tr><td>Gereksiz kelimeyi atmak</td><td>İçeriği yoğunlaştırır</td><td>"Aslında", "yani", "şimdi şöyle" gibi dolgu kelimeleri çıkar</td></tr>
<tr><td>Ses ve müzik vurguları</td><td>Geçişleri belirginleştirir</td><td>Bölüm değişimlerinde kısa bir ses efekti ya da müzik değişimi</td></tr>
</tbody>
</table>
<p>Hızlı ritim her içeriğe uymaz. Sakin bir tarif ya da huzur veren bir atölye videosu, bilinçli olarak yavaş olabilir. Önemli olan hız değil, <strong>değişimdir</strong>: yavaş bir içerikte bile tempo, görüntü ve ses belirli aralıklarla farklılaşmalı.</p>

<h2>2. Açık döngüler: "birazdan" sözü</h2>
<p>Açık döngü, izleyicinin aklında henüz cevaplanmamış bir soru bırakmaktır. Tamamlanmamış şeylerin insanın aklını daha çok meşgul ettiği fikri psikolojide uzun süredir tartışılır; araştırma sonuçları tartışmalı olsa da içerik üretiminde işe yarayan bir sezgidir. Kanca ilk döngüyü açar. Ama tek bir döngü uzun içerikte yetmez: biri kapanmadan önce yenisini açarsan izleyici her zaman bir sonraki cevabı bekler.</p>
<div class="crs-template"><span class="crs-template-label">Şablon: Döngü açan cümleler</span><p>"Birazdan neden [şey] yapmaman gerektiğini göstereceğim, ama önce..." / "Üçüncü adımda işler beklemediğim bir yere gitti." / "Bu yöntemin bir de kimsenin konuşmadığı bir yan etkisi var, sona doğru anlatacağım." / "Sonuç fotoğrafını en sona koydum, çünkü önce şunu görmen lazım."</p></div>
<p>Örnek senaryo: Bir butik, "eski vitrinimizi tek bir gün içinde yeniledik" içeriği hazırlıyor. Kanca sonucun bulanık bir görüntüsüyle ana döngüyü açıyor: "Son hâli en sonda." Bağlamın ardından ilk adımda ikinci döngü açılıyor: "Burada aldığım karar neredeyse her şeyi bozuyordu." Bu döngü ortada kapanırken üçüncüsü açılıyor: "Ama asıl sürpriz müşterilerin tepkisiydi." En sonda vitrin net biçimde gösteriliyor ve tüm döngüler kapanıyor. İzleyici hiçbir anda "artık her şeyi biliyorum" noktasına gelmiyor.</p>
<p>Döngü açmak kadar <strong>kapatmak</strong> da önemli. Açtığın her soruyu içeriğin içinde cevapla. Kapanmayan döngü, izleyicide "kandırıldım" hissi bırakır ve ikinci derste konuştuğumuz güveni zedeler.</p>
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Dikkat</strong><p>"Sonuna kadar izle" demek bir açık döngü değildir. İzleyiciye neden kalması gerektiğini söylemez, sadece ister. Döngü her zaman somut bir merak noktası içermeli: "Sonda bu iki kahveyi kör testte karşılaştırıyorum" gibi.</p></div>

<h2>3. Görsel değişim: gözü uyanık tutmak</h2>
<p>Aynı açıdan, aynı uzaklıktan uzun süre çekilen bir görüntü, içerik ne kadar iyi olursa olsun gözü yorar. Görsel değişim, beynin dikkatini tazeler. Bunun için büyük prodüksiyon gerekmez:</p>
<ul>
<li><strong>Açı ve mesafe değişimi:</strong> Geniş plandan yakın plana geç, ya da telefonu hafifçe başka bir açıya al.</li>
<li><strong>Ekran yazısı:</strong> Önemli kelimeyi ekranda göster, madde numaralarını yazıyla destekle.</li>
<li><strong>Ara görüntü:</strong> Konuştuğun şeyi göster. Bir kahve çekirdeğinden bahsediyorsan, çekirdeğe yakın çekim yap.</li>
<li><strong>Nesne ve hareket:</strong> Elindeki ürünü kameraya uzat, bir şeyi aç, dök, kes.</li>
<li><strong>Kaydırmalı gönderide:</strong> Her slayt bir öncekinden görsel olarak farklı olsun ve bir sonraki slayta merak bıraksın.</li>
<li><strong>Yazı içeriğinde:</strong> Kısa paragraflar, ara başlıklar ve listeler okurun gözünü dinlendirir.</li>
</ul>
<div class="crs-callout danger"><strong class="crs-callout-title">⛔ Bunu yapma</strong><p>Görsel değişimi, içerikle ilgisi olmayan efektlerle, sürekli zum ve geçişlerle sağlamaya çalışma. Aşırı efekt izleyicinin dikkatini mesajdan uzaklaştırır ve yorar. Her değişim bir anlam taşımalı: yeni bilgi, yeni adım ya da vurgulanması gereken bir an.</p></div>

<h2>Kurgu masasında tutma kontrol listesi</h2>
<p>İçeriğini yayınlamadan önce bir kez sessiz, bir kez sesli izle ve şu listeyi kontrol et:</p>
<ul class="crs-checklist">
<li>İlk cümleden önce boşluk, selamlaşma ya da gereksiz giriş yok.</li>
<li>Kanca en az bir açık döngü bırakıyor ve bu döngü içerikte kapanıyor.</li>
<li>Uzun içerikte, bir döngü kapanmadan önce yenisi açılıyor.</li>
<li>Aynı görüntü uzun süre değişmeden kalmıyor; her yeni bilgide küçük bir görsel değişim var.</li>
<li>Ses kapalı izlendiğinde bile içerik ekran yazılarıyla anlaşılıyor.</li>
<li>Ödülden önce kısa bir vurgu ya da tempo değişimi var.</li>
</ul>
<div class="crs-callout tip"><strong class="crs-callout-title">💡 İpucu</strong><p>Kendi içeriğini izlerken sıkıldığın ya da aklının başka yere kaydığı anı not et. Sen bile sıkılıyorsan izleyici çoktan gitmiştir. O anı ya kes, ya hızlandır, ya da oraya yeni bir döngü veya görsel değişim ekle.</p></div>

<div class="crs-keypoints"><strong class="crs-callout-title">📌 Bu derste öğrendiklerin</strong><ul>
<li>İzleyici her an "devam mı, geç mi?" kararı verir; tutma, her an yeni bir neden sunmaktır.</li>
<li>Ayrılmanın üç nedeni: sıkılma, kaybolma ve erken tatmin.</li>
<li>Ritimde önemli olan hız değil değişimdir; boşlukları kes, cümle uzunluğunu ve tempoyu çeşitlendir.</li>
<li>Açık döngüler somut bir merak noktası içermeli ve mutlaka kapanmalı.</li>
<li>Görsel değişim anlam taşımalı; içerikten bağımsız efekt yorucudur.</li>
</ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Görevin</strong><p>Önceki derste iskeletini çıkardığın içeriği çek ya da taslağını hazırla. Kurgudan önce senaryonun üzerine üç işaret koy: döngünün açıldığı yer, döngünün kapandığı yer ve görsel değişimin olacağı her an. Ardından kurgu kontrol listesini uygula. Daha önce yayınladığın bir içeriğin tutma grafiğine bakıp izleyicinin en çok kaybedildiği anı bulursan, onu da bu listeyle karşılaştır.</p></div>
`,
  content_en: `
<p>While watching your content, viewers are constantly making a tiny decision: "Keep going, or skip?" That decision isn't made only at the start; it's made again at every moment. The hook wins the first decision, but if you don't offer a new reason at each moment after that, viewers quietly leave somewhere in the middle.</p>
<p>In this lesson you'll learn to plant those "keep going" reasons on purpose. We have three tools: <mark>rhythm, open loops and visual change</mark>. All three are platform-independent; they work in short videos, long videos, carousels and even text posts.</p>
<!--GORSEL-->
<h2>Why do viewers drop off halfway?</h2>
<p>The reasons viewers leave usually fall into three buckets. The first is <strong>boredom</strong>: the same pace, the same shot, the same tone go on too long, and the brain decides nothing new is happening. The second is <strong>getting lost</strong>: viewers don't understand where they are or where the content is going. The third is <strong>satisfaction</strong>: they got what they wanted early and have no reason left to stay. Rhythm works against boredom, open loops against early satisfaction, and clear structure plus visual change against getting lost.</p>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Good to know</strong><p>Most platforms offer an audience retention graph or a similar stat that shows the moment your content loses viewers. Screen names and locations vary by platform and change over time, so check the current location in the app. Sharp drops in the graph show you exactly which moments need fixing.</p></div>

<h2>1. Rhythm: the pulse of your content</h2>
<p>Rhythm is how fast your content moves and in what pattern. Good rhythm gives viewers a sense that "something is happening here" without them noticing. Bad rhythm is either stuck on one note or so fast that viewers can't follow anything.</p>
<table class="crs-table yellow">
<thead><tr><th>Rhythm tool</th><th>What it does</th><th>How to apply it</th></tr></thead>
<tbody>
<tr><td>Cutting gaps</td><td>Removes dead moments</td><td>Trim breaths and pauses between sentences in the edit</td></tr>
<tr><td>Varying sentence length</td><td>Breaks monotony</td><td>Follow a long explanation with a short, punchy sentence</td></tr>
<tr><td>Changing tempo</td><td>Marks the important moment</td><td>Add a brief pause or slowdown right before the payoff</td></tr>
<tr><td>Dropping filler words</td><td>Makes content denser</td><td>Cut fillers like "basically," "so," "okay so here's the thing"</td></tr>
<tr><td>Sound and music cues</td><td>Makes transitions clear</td><td>A short sound effect or music change at section breaks</td></tr>
</tbody>
</table>
<p>Fast rhythm doesn't suit every piece of content. A calm recipe or a soothing workshop video can be slow on purpose. What matters isn't speed but <strong>change</strong>: even in slow content, pace, visuals and sound should shift at regular intervals.</p>

<h2>2. Open loops: the "in a moment" promise</h2>
<p>An open loop leaves a question in the viewer's mind that hasn't been answered yet. The idea that unfinished things occupy our minds more has long been discussed in psychology; the research findings are debated, but it's a useful intuition in content creation. The hook opens the first loop. But a single loop isn't enough for longer content: if you open a new one before closing the last, viewers are always waiting for the next answer.</p>
<div class="crs-template"><span class="crs-template-label">Template: Loop-opening lines</span><p>"In a moment I'll show you why you shouldn't [thing], but first..." / "At step three, things went somewhere I didn't expect." / "This method also has a side effect nobody talks about; I'll get to it near the end." / "I saved the final photo for last, because first you need to see this."</p></div>
<p>Example scenario: a boutique is making a post called "we redid our old shop window in a single day." The hook opens the main loop with a blurred shot of the result: "The final look is at the very end." After the context, the first step opens a second loop: "The decision I made here almost ruined everything." As that loop closes in the middle, a third opens: "But the real surprise was how customers reacted." At the end, the window is shown clearly and every loop closes. At no point do viewers reach "now I know everything."</p>
<p>Closing a loop matters just as much as opening it. Answer every question you raise within the content. An unclosed loop leaves viewers feeling tricked and damages the trust we discussed in Lesson 2.</p>
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Watch out</strong><p>"Watch till the end" is not an open loop. It doesn't tell viewers why they should stay; it just asks. A loop always needs a concrete point of curiosity, like "at the end I compare these two coffees in a blind test."</p></div>

<h2>3. Visual change: keeping the eye awake</h2>
<p>A shot filmed from the same angle and distance for a long stretch tires the eye, no matter how good the content is. Visual change refreshes the brain's attention. You don't need a big production for it:</p>
<ul>
<li><strong>Angle and distance changes:</strong> Cut from a wide shot to a close-up, or shift your phone to a slightly different angle.</li>
<li><strong>On-screen text:</strong> Show the key word on screen and back up list numbers with text.</li>
<li><strong>B-roll:</strong> Show what you're talking about. If you mention a coffee bean, cut to a close-up of the bean.</li>
<li><strong>Objects and motion:</strong> Hold the product out to the camera, open something, pour it, cut it.</li>
<li><strong>In a carousel:</strong> Make every slide visually different from the last and leave curiosity for the next one.</li>
<li><strong>In text posts:</strong> Short paragraphs, subheadings and lists give the reader's eyes a rest.</li>
</ul>
<div class="crs-callout danger"><strong class="crs-callout-title">⛔ Don't do this</strong><p>Don't try to create visual change with effects unrelated to the content, constant zooms and transitions. Too many effects pull attention away from the message and wear viewers out. Every change should carry meaning: new information, a new step or a moment that deserves emphasis.</p></div>

<h2>A retention checklist for the editing desk</h2>
<p>Before you publish, watch your content once on mute and once with sound, and run through this list:</p>
<ul class="crs-checklist">
<li>No silence, greeting or unnecessary intro before the first sentence.</li>
<li>The hook leaves at least one open loop, and that loop closes within the content.</li>
<li>In longer content, a new loop opens before the previous one closes.</li>
<li>No shot stays unchanged for long; every new piece of information gets a small visual change.</li>
<li>Even on mute, the content makes sense through on-screen text.</li>
<li>There's a brief emphasis or tempo change before the payoff.</li>
</ul>
<div class="crs-callout tip"><strong class="crs-callout-title">💡 Tip</strong><p>When you watch your own content, note the moment you get bored or your mind drifts. If even you're bored, viewers are long gone. Cut that moment, speed it up, or add a new loop or visual change there.</p></div>

<div class="crs-keypoints"><strong class="crs-callout-title">📌 Key takeaways</strong><ul>
<li>Viewers decide "keep going or skip?" at every moment; retention means offering a new reason each time.</li>
<li>Three reasons people leave: boredom, getting lost and early satisfaction.</li>
<li>In rhythm, change matters more than speed; cut gaps and vary sentence length and tempo.</li>
<li>Open loops need a concrete point of curiosity and must always be closed.</li>
<li>Visual change should carry meaning; effects unrelated to the content are tiring.</li>
</ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Your task</strong><p>Film the content you outlined in the previous lesson, or prepare its draft. Before editing, mark three things on your script: where the loop opens, where it closes and every moment that will get a visual change. Then run the editing checklist. If you can check the retention graph of something you've already published and find where you lost the most viewers, compare that moment against this list too.</p></div>
`
};
