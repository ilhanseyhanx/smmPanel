'use strict';
module.exports = {
  slug: 'kurgu-is-akisi-altyazi-kapak',
  title_tr: "Kurgu İş Akışı: Şablonlar, Altyazı, Kapak ve Dışa Aktarma",
  title_en: "Editing Workflow: Templates, Captions, Covers and Export",
  summary_tr: "Yedi videoyu iki turda kurgulamayı, tekrar kullanılabilir proje şablonu kurmayı, altyazı ve kapak standardı belirlemeyi ve doğru dışa aktarma ayarlarını öğreneceksin.",
  summary_en: "Learn to edit seven videos in two rounds, build a reusable project template, set standards for captions and covers, and choose the right export settings.",
  visual: {
    type: 'bars',
    title_tr: "Kurgu adımlarının göreli zaman payı",
    title_en: "Relative time share of editing steps",
    items: [
      { tr: "Kaba kesim", en: "Rough cut", value: 100 },
      { tr: "Altyazı ve ekran yazısı", en: "Captions and on-screen text", value: 70 },
      { tr: "Ses ve müzik", en: "Sound and music", value: 45 },
      { tr: "Kapak", en: "Cover", value: 35 },
      { tr: "Dışa aktarma ve kontrol", en: "Export and review", value: 25 }
    ]
  },
  content_tr: `<p>Çekim günü bittiğinde elinde onlarca ham dosya olur ve kurgu, haftanın en uzun aşamasına dönüşebilir. Her videoyu baştan sona tek tek kurguladığında yine bağlam değiştirme tuzağına düşersin: kesim, altyazı, müzik, kapak, dışa aktarma ve sonra bir sonraki video için aynı döngü. Bunun yerine kurguyu bir <strong>montaj hattı</strong> gibi düşün: aynı adımı yedi videoya art arda uygula.</p>
<p>Bu derste iki turlu kurgu yöntemini, her hafta sıfırdan ayar yapmanı önleyen proje şablonunu, altyazı ve kapak standardını ve dışa aktarma ayarlarını kuruyoruz. Belirli bir uygulamaya bağlı kalmadan anlatıyoruz; ilkeler çoğu mobil ve masaüstü kurgu programında aynıdır.</p>
<!--GORSEL-->
<h2>İki turlu kurgu yöntemi</h2>
<p>Yukarıdaki görsel, kurgu süresinin genelde nereye gittiğine dair göreli bir fikir verir; kendi oranların farklı olabilir. Ama hemen her üreticide en çok zaman alan iş kaba kesimdir. Bu yüzden kurguyu ikiye bölüyoruz.</p>
<table class="crs-table blue">
<thead><tr><th>Tur</th><th>Ne yapılır?</th><th>Sonuç</th></tr></thead>
<tbody>
<tr><td>1. tur: kaba kesim</td><td>Yedi videonun her biri için en iyi çekimi seç, sessizlikleri ve hatalı tekrarları at, sahneleri senaryo sırasına diz</td><td>Yedi videonun iskeleti <span class="crs-badge mid">Ham</span></td></tr>
<tr><td>2. tur: cila</td><td>Altyazı, ekran yazısı, ses dengesi, müzik, kapak ve dışa aktarma</td><td>Yayına hazır yedi dosya <span class="crs-badge good">Hazır</span></td></tr>
</tbody>
</table>
<p>İki turu farklı günlere koymanın bir faydası daha var: ikinci turda videolara bir gün sonra taze gözle bakarsın. Birinci turda gözünden kaçan uzun duraksamalar ve gereksiz cümleler ikinci turda çok daha kolay fark edilir.</p>
<h3>Kaba kesim kuralları</h3>
<ul class="crs-checklist">
<li>İlk karede hareket veya konuşma olsun; videoyu sessiz bir hazırlık anıyla başlatma.</li>
<li>Cümleler arasındaki nefes ve duraksamaları kısalt, ama konuşmayı boğacak kadar sıkıştırma.</li>
<li>Aynı cümlenin birden fazla çekimi varsa en net olanı bırak, diğerlerini sil.</li>
<li>Uzun konuşma bölümlerine senaryodaki ek görüntüleri yerleştir.</li>
<li>Hedef süreyi aşıyorsan gövdeden kes, açılışı koru.</li>
</ul>
<h2>Proje şablonu: her hafta sıfırdan ayar yapma</h2>
<p>Kurgu uygulamalarının çoğu (örneğin CapCut, VN, Adobe Premiere veya DaVinci Resolve) şablon kaydetmeye ya da bir projeyi kopyalamaya izin verir. Hazır şablon özelliği yoksa, bütün ayarları yapılmış boş bir projeyi "ANA ŞABLON" adıyla sakla ve her yeni videoya onu kopyalayarak başla. <mark>Bir kez kurulan şablon, her video için onlarca küçük kararı ortadan kaldırır.</mark></p>
<table class="crs-table green">
<thead><tr><th>Şablonda olması gereken</th><th>Örnek karar</th></tr></thead>
<tbody>
<tr><td>Proje boyutu</td><td>9:16, 1080x1920, çekimle aynı kare hızı</td></tr>
<tr><td>Altyazı stili</td><td>Tek yazı tipi, kalın, beyaz yazı ve koyu kontur, ekranın orta-alt bölgesi</td></tr>
<tr><td>Ekran yazısı stili</td><td>Başlık için ayrı boyut, marka renginde vurgu kutusu</td></tr>
<tr><td>Ses ayarları</td><td>Konuşma önde, müzik belirgin şekilde altta</td></tr>
<tr><td>Kapanış kartı</td><td>Hesap adı veya seri adı, 1-2 saniye</td></tr>
<tr><td>Renk ayarı</td><td>Çekim koşullarına uygun tek bir hafif renk düzeltmesi</td></tr>
</tbody>
</table>
<p>Şablonu bir kez kurup unutma. Her ayın sonunda son dört haftanın videolarına bak: hangi altyazı boyutu telefonda rahat okunuyor, hangi kapanış kartı gereksiz uzun kalıyor, hangi renk ayarı farklı ışıklarda tutarsız görünüyor? Küçük düzeltmeleri ana şablona işle ve eski sürümü tarihiyle sakla. Böylece şablonun zamanla senin tarzına göre olgunlaşır, ama her hafta yeniden tasarım yapma tuzağına da düşmezsin. Ekiple çalışıyorsan şablonu herkesin erişebildiği ortak bir klasörde tut; farklı kişilerin kurguladığı videolar da aynı hesaptan çıkmış gibi görünür.</p>
<h2>Altyazı ve ekran yazısı</h2>
<p>Altyazı hem erişilebilirlik hem de sesi kapalı izleyenler için önemlidir. Çoğu kurgu uygulaması ve platform otomatik altyazı sunar; bu büyük zaman kazandırır ama Türkçede özel isimler, marka adları ve bazı kelimeler sıkça yanlış yazılır.</p>
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Dikkat</strong><p>Otomatik altyazıyı kontrol etmeden yayınlama. Yanlış yazılmış bir ürün adı veya anlamı değişmiş bir cümle, videonun güvenilirliğini zedeler. Altyazıyı videoyu bir kez sesli izleyerek, bir kez de sessiz okuyarak kontrol et.</p></div>
<p>Altyazı satırlarını kısa tut: ekranda aynı anda bir veya iki kısa satır olsun. Yazıları ekranın en alt kenarına ve sağ kenara yapıştırma; platform arayüzündeki butonlar ve açıklama metni bu bölgeleri kapatır. Önceki derste kadrajda bıraktığın orta bölge, yazılar için de güvenli alandır.</p>
<h2>Kapak</h2>
<p>Kapak, videonun profil sayfasında ve bazı listelerde görünen yüzüdür. Haftalık üretimde her kapağı ayrı ayrı tasarlamak yerine tek bir kapak şablonu kullan: aynı yazı tipi, aynı konum, 3-5 kelimelik kısa bir başlık ve videodan seçilmiş net bir kare. Platformlar kapağı profil ızgarasında farklı oranlarda kırpabildiği için başlık metnini ve yüzü kapağın ortasında tut. Güncel kırpma oranını bir test yüklemesiyle veya uygulama içindeki önizlemeyle kontrol et.</p>
<div class="crs-callout danger"><strong class="crs-callout-title">⛔ Bunu yapma</strong><p>İzin almadığın popüler bir şarkıyı videonun içine gömerek dışa aktarma. Telifli müzik videonun sesinin kapatılmasına, kaldırılmasına veya bazı bölgelerde engellenmesine yol açabilir. Platformların kendi ses kütüphanelerini veya lisansını aldığın müzikleri kullan; işletme hesaplarında bazı popüler seslerin kullanımı kısıtlı olabileceği için seçenekleri uygulama içinden kontrol et.</p></div>
<h2>Dışa aktarma ayarları ve dosya düzeni</h2>
<table class="crs-table purple">
<thead><tr><th>Ayar</th><th>Genel öneri</th></tr></thead>
<tbody>
<tr><td>Çözünürlük</td><td>1080x1920 <span class="crs-badge good">Standart</span></td></tr>
<tr><td>Kare hızı</td><td>Çekimle aynı (örneğin 30 fps)</td></tr>
<tr><td>Dosya biçimi</td><td>MP4, H.264 kodek (en geniş uyumluluk)</td></tr>
<tr><td>Bit hızı / kalite</td><td>Uygulamanın "yüksek" veya "önerilen" seçeneği <span class="crs-badge mid">Dengeli</span></td></tr>
<tr><td>Dosya adı</td><td>yayın-tarihi_seri_konu_v1 (örneğin 2026-10-12_ev-kahvesi_soguk-demleme_v1)</td></tr>
</tbody>
</table>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Bilgi</strong><p>Platformların önerdiği yükleme ayarları ve video süre sınırları zaman içinde değişebilir. Buradaki değerler yazıldığı tarihte (2026) yaygın olarak kullanılan genel ayarlardır; güncel önerileri her platformun yardım sayfasından veya uygulama içinden kontrol et.</p></div>
<h3>İkinci tur için video başına kontrol</h3>
<ol class="crs-steps">
<li><strong>Altyazıyı düzelt.</strong> Otomatik altyazıyı oluştur, hataları düzelt, satırları kısalt.</li>
<li><strong>Ekran yazılarını ekle.</strong> Senaryonun görüntü sütunundaki yazıları şablon stilinde yerleştir.</li>
<li><strong>Sesi dengele.</strong> Konuşmanın net duyulduğundan emin ol, müziği altta tut.</li>
<li><strong>Kapağı hazırla.</strong> Kapak şablonuna kareyi ve kısa başlığı koy.</li>
<li><strong>Dışa aktar ve telefonda izle.</strong> Dosyayı adlandır, telefonda baştan sona bir kez izle; sorun yoksa "hazır" klasörüne taşı.</li>
</ol>
<p>Artık elinde yayına hazır yedi dosya var. Ama bu dosyaları üç platforma aynen yüklemek her zaman en iyi sonuç vermez. Bir sonraki derste tek bir videoyu Reels, Shorts ve TikTok'a nasıl uyarlayacağını ve bütün içeriğini nasıl arşivleyeceğini göreceğiz.</p>
<div class="crs-keypoints"><strong class="crs-callout-title">📌 Bu derste öğrendiklerin</strong><ul>
<li>Kurguyu iki tura böl: önce yedi videonun kaba kesimi, sonra cila ve dışa aktarma.</li>
<li>Proje şablonu; boyut, altyazı stili, ses ve kapanış kararlarını her hafta tekrar vermekten kurtarır.</li>
<li>Otomatik altyazı zaman kazandırır ama mutlaka kontrol edilmeli; yazılar güvenli alanda kalmalı.</li>
<li>Tek kapak şablonu, standart dışa aktarma ayarları ve tutarlı dosya adları haftalık üretimi düzenli tutar.</li>
</ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Görevin</strong><p>Kullandığın kurgu uygulamasında ana proje şablonunu ve kapak şablonunu oluştur. Çekim gününden kalan yedi videonun önce hepsinin kaba kesimini yap, ertesi gün ikinci turu tamamla. Her iki turun süresini ayrı ayrı not et; son derste bu sürelerle planını kalibre edeceksin.</p></div>`,
  content_en: `<p>When filming day ends, you are holding dozens of raw files, and editing can become the longest stage of the week. If you edit each video from start to finish one at a time, you fall back into the context-switching trap: cut, captions, music, cover, export, then the same loop for the next video. Instead, think of editing as an <strong>assembly line</strong>: apply the same step to all seven videos in a row.</p>
<p>In this lesson we set up the two-round editing method, a project template that saves you from configuring everything weekly, standards for captions and covers, and export settings. We keep it app-agnostic; the principles are the same in most mobile and desktop editors.</p>
<!--GORSEL-->
<h2>The two-round editing method</h2>
<p>The visual above gives a relative idea of where editing time usually goes; your own proportions may differ. But for almost every creator, the rough cut takes the most time. That is why we split editing in two.</p>
<table class="crs-table blue">
<thead><tr><th>Round</th><th>What happens?</th><th>Result</th></tr></thead>
<tbody>
<tr><td>Round 1: rough cut</td><td>Pick the best take for each of the seven videos, remove silences and flubbed lines, arrange scenes in script order</td><td>Skeletons of seven videos <span class="crs-badge mid">Raw</span></td></tr>
<tr><td>Round 2: polish</td><td>Captions, on-screen text, audio balance, music, cover and export</td><td>Seven publish-ready files <span class="crs-badge good">Ready</span></td></tr>
</tbody>
</table>
<p>Putting the two rounds on different days has another benefit: in round two you look at the videos with fresh eyes a day later. Long pauses and unnecessary lines you missed in round one are much easier to spot in round two.</p>
<h3>Rough cut rules</h3>
<ul class="crs-checklist">
<li>Have movement or speech in the very first frame; do not open with a silent setup moment.</li>
<li>Trim breaths and pauses between sentences, but not so tightly that speech feels crushed.</li>
<li>If a line has several takes, keep the clearest one and delete the rest.</li>
<li>Lay the extra footage from your script over long talking sections.</li>
<li>If you are over the target length, cut from the body and protect the opening.</li>
</ul>
<h2>Project template: stop configuring from scratch every week</h2>
<p>Most editing apps (for example CapCut, VN, Adobe Premiere or DaVinci Resolve) let you save a template or duplicate a project. If there is no template feature, keep an empty project with all settings applied, name it "MASTER TEMPLATE" and start every new video by duplicating it. <mark>A template you build once removes dozens of small decisions from every video.</mark></p>
<table class="crs-table green">
<thead><tr><th>What the template should include</th><th>Sample decision</th></tr></thead>
<tbody>
<tr><td>Project size</td><td>9:16, 1080x1920, same frame rate as the footage</td></tr>
<tr><td>Caption style</td><td>One typeface, bold, white text with a dark outline, lower-middle of the screen</td></tr>
<tr><td>On-screen text style</td><td>A separate size for titles, a highlight box in your brand color</td></tr>
<tr><td>Audio settings</td><td>Voice up front, music clearly underneath</td></tr>
<tr><td>End card</td><td>Account name or series name, 1-2 seconds</td></tr>
<tr><td>Color</td><td>One light color correction that suits your filming conditions</td></tr>
</tbody>
</table>
<p>Do not set up the template and forget it. At the end of each month, look back at the last four weeks of videos: which caption size reads comfortably on a phone, which end card runs too long, which color correction looks inconsistent under different light? Fold small fixes into the master template and keep the old version with its date. Your template matures with your style over time, without dragging you into a weekly redesign. If you work with a team, keep the template in a shared folder everyone can reach; videos edited by different people will still look like they came from the same account.</p>
<h2>Captions and on-screen text</h2>
<p>Captions matter both for accessibility and for people watching with the sound off. Most editing apps and platforms offer automatic captions; this saves a lot of time, but proper names, brand names and some words are often transcribed incorrectly.</p>
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Watch out</strong><p>Never publish automatic captions without checking them. A misspelled product name or a sentence whose meaning has changed hurts the video's credibility. Check captions by watching the video once with sound and once reading it silently.</p></div>
<p>Keep caption lines short: one or two short lines on screen at a time. Do not push text against the very bottom or the right edge; the platform's buttons and caption text cover those areas. The middle zone you kept clear while framing in the previous lesson is your safe area for text too.</p>
<h2>Cover</h2>
<p>The cover is the video's face on your profile page and in some lists. In weekly production, instead of designing each cover separately, use a single cover template: the same typeface, the same position, a short 3-5 word title and a clear frame from the video. Platforms may crop the cover at different ratios in the profile grid, so keep the title and face in the center of the cover. Check the current crop with a test upload or the in-app preview.</p>
<div class="crs-callout danger"><strong class="crs-callout-title">⛔ Don't do this</strong><p>Do not bake a popular song you have no rights to into your export. Copyrighted music can get your video muted, removed or blocked in some regions. Use the platforms' own sound libraries or music you have licensed; business accounts may have restricted access to some popular sounds, so check your options inside each app.</p></div>
<h2>Export settings and file organization</h2>
<table class="crs-table purple">
<thead><tr><th>Setting</th><th>General recommendation</th></tr></thead>
<tbody>
<tr><td>Resolution</td><td>1080x1920 <span class="crs-badge good">Standard</span></td></tr>
<tr><td>Frame rate</td><td>Same as the footage (for example 30 fps)</td></tr>
<tr><td>File format</td><td>MP4, H.264 codec (widest compatibility)</td></tr>
<tr><td>Bitrate / quality</td><td>The app's "high" or "recommended" option <span class="crs-badge mid">Balanced</span></td></tr>
<tr><td>File name</td><td>publish-date_series_topic_v1 (for example 2026-10-12_home-coffee_cold-brew_v1)</td></tr>
</tbody>
</table>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Good to know</strong><p>Platforms' recommended upload settings and video length limits can change over time. The values here are general settings in common use at the time of writing (2026); check current recommendations on each platform's help pages or inside the app.</p></div>
<h3>Per-video checks for round two</h3>
<ol class="crs-steps">
<li><strong>Fix captions.</strong> Generate automatic captions, correct errors and shorten lines.</li>
<li><strong>Add on-screen text.</strong> Place the text from the script's visual column in your template style.</li>
<li><strong>Balance the audio.</strong> Make sure the voice is clear and the music stays underneath.</li>
<li><strong>Prepare the cover.</strong> Drop the frame and a short title into the cover template.</li>
<li><strong>Export and watch on a phone.</strong> Name the file, watch it once end to end on a phone; if all is well, move it to the "ready" folder.</li>
</ol>
<p>You now have seven publish-ready files. But uploading them unchanged to three platforms does not always give the best result. In the next lesson we look at how to adapt one video for Reels, Shorts and TikTok, and how to archive all your content.</p>
<div class="crs-keypoints"><strong class="crs-callout-title">📌 Key takeaways</strong><ul>
<li>Split editing into two rounds: first the rough cut of all seven videos, then polish and export.</li>
<li>A project template saves you from re-deciding size, caption style, audio and end card every week.</li>
<li>Automatic captions save time but must always be checked; text should stay in the safe area.</li>
<li>One cover template, standard export settings and consistent file names keep weekly production tidy.</li>
</ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Your task</strong><p>Create your master project template and cover template in the editing app you use. Rough-cut all seven videos from filming day first, then complete round two the next day. Note how long each round takes; in the final lesson you will calibrate your plan with these numbers.</p></div>`
};
