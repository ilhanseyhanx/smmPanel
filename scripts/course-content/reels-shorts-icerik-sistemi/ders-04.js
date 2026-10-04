'use strict';
module.exports = {
  slug: 'toplu-cekim-gunu',
  title_tr: "Toplu Çekim Günü: Tek Oturumda Bir Haftalık Video",
  title_en: "Batch Filming Day: A Week of Videos in One Session",
  summary_tr: "Telefon ayarlarından ışığa, sesten kadraja, kıyafet ve mekân değişiminden yedeklemeye kadar yedi videoyu tek oturumda çekmenin adım adım planını kuracaksın.",
  summary_en: "Build a step-by-step plan for filming seven videos in one session, from phone settings, light, sound and framing to outfit and location changes and backups.",
  visual: {
    type: 'checklist',
    title_tr: "Çekime başlamadan son kontrol",
    title_en: "Final check before you hit record",
    items: [
      { tr: "Telefon şarjlı, depolama boş, bildirim kapalı", en: "Phone charged, storage free, notifications off" },
      { tr: "Dikey çerçeve, odak ve pozlama kilitli", en: "Vertical frame, focus and exposure locked" },
      { tr: "Işık yüzüne önden veya çaprazdan geliyor", en: "Light hits your face from the front or side" },
      { tr: "Mikrofon takılı, test kaydı dinlendi", en: "Mic attached, test recording checked" },
      { tr: "Kıyafet ve mekân sırası belli", en: "Outfit and location order is set" },
      { tr: "Senaryolar ve çekim listesi elinin altında", en: "Scripts and shot list within reach" }
    ]
  },
  content_tr: `<p>Haftada yedi videoyu yedi ayrı günde çekmek, yedi kez kurulum, yedi kez ışık ayarı ve yedi kez "hazır mıyım?" gerginliği demek. Toplu çekim günü bu tekrarı bire indirir: bir kez kurarsın, bir kez test edersin ve birkaç saat içinde haftanın bütün ham görüntülerini çıkarırsın. Bu, sistemin zaman kazandıran en büyük adımıdır.</p>
<p>Bu derste çekim gününü üç parçada planlıyoruz: önceden yapılacak hazırlık, teknik kurulum (telefon, ışık, ses, kadraj) ve çekim akışının kendisi. Pahalı ekipman şart değil; bir telefon, sabit bir tutucu ve basit bir mikrofonla başlayabilirsin.</p>
<!--GORSEL-->
<h2>Çekimden önce: sıralamayı planla</h2>
<p>Toplu çekimin sırrı, videoları senaryo sırasına göre değil, <mark>mekân ve kıyafete göre gruplamaktır.</mark> Aynı köşede ve aynı kıyafetle çekilecek videoları art arda çekersen, ışığı ve kamerayı her video için yeniden kurmazsın. Fikir bankandaki "çekim yeri" etiketi burada işe yarar.</p>
<table class="crs-table blue">
<thead><tr><th>Blok</th><th>Mekân</th><th>Kıyafet</th><th>Videolar</th><th>Örnek süre</th></tr></thead>
<tbody>
<tr><td>1</td><td>Bar tezgâhı</td><td>Önlük, siyah tişört</td><td>Video 1, 4</td><td>50 dk</td></tr>
<tr><td>2</td><td>Bar tezgâhı</td><td>Gömlek</td><td>Video 2, 6</td><td>45 dk</td></tr>
<tr><td>3</td><td>Salon masası</td><td>Kazak</td><td>Video 3, 5</td><td>50 dk</td></tr>
<tr><td>4</td><td>Dış mekân</td><td>Ceket</td><td>Video 7</td><td>30 dk</td></tr>
</tbody>
</table>
<p>Yukarıdaki tablo bir kafe hesabı için örnek senaryodur. Kıyafet değiştirmenin amacı, aynı gün çekilen videoların yayında art arda göründüğünde "hepsi aynı gün çekilmiş" hissi vermemesidir. Butik, kuaför veya ofis gibi farklı işletmelerde mekân yerine ürün grubu ya da çalışma istasyonu da kullanabilirsin.</p>
<ul class="crs-checklist">
<li>Senaryoları yazdır veya telefonda değil, ayrı bir ekranda aç.</li>
<li>Kıyafetleri sırasıyla ütülü ve hazır as.</li>
<li>Gerekli ürünleri, aksesuarları ve sahne malzemelerini her blok için ayrı kutulara koy.</li>
<li>Telefonu ve mikrofonu tam şarj et; yedek şarj aletini hazırla.</li>
<li>Telefonda en az birkaç saatlik çekime yetecek boş alan aç.</li>
</ul>
<h2>Teknik kurulum</h2>
<h3>Telefon</h3>
<p>Çoğu telefonda arka kamera ön kameradan daha iyi görüntü verir; ekranı göremiyorsan kendini görmek için ayrı bir küçük ayna veya kablosuz monitör uygulaması kullanabilirsin. Lensi her bloğun başında yumuşak bir bezle sil; parmak izi en sık görülen bulanıklık sebebidir.</p>
<table class="crs-table green">
<thead><tr><th>Ayar</th><th>Öneri</th><th>Neden?</th></tr></thead>
<tbody>
<tr><td>Yön</td><td>Dikey (9:16) <span class="crs-badge good">Şart</span></td><td>Reels, Shorts ve TikTok tam ekran dikey gösterir</td></tr>
<tr><td>Çözünürlük</td><td>En az 1080p, mümkünse 4K</td><td>4K, kurguda yakınlaştırma payı bırakır</td></tr>
<tr><td>Kare hızı</td><td>30 fps (veya 25/24), bütün gün aynı</td><td>Karışık kare hızları kurguda takılma yapabilir</td></tr>
<tr><td>Odak ve pozlama</td><td>Kilitli (çoğu telefonda ekrana basılı tutarak)</td><td>Görüntünün çekim sırasında parlayıp kararmasını önler</td></tr>
<tr><td>Kılavuz çizgileri</td><td>Açık</td><td>Göz hizasını ve düz çizgileri korur</td></tr>
<tr><td>Bildirimler</td><td>Rahatsız etme veya uçak modu <span class="crs-badge mid">Önemli</span></td><td>Arama ve titreşim çekimi böler</td></tr>
</tbody>
</table>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Bilgi</strong><p>Bazı telefonlar varsayılan olarak HDR video kaydeder. HDR görüntüler bazı kurgu uygulamalarında veya yüklendikten sonra farklı renklerde görünebilir. Renklerin tutarsız çıktığını fark edersen HDR'yi kapatıp bir test videosuyla karşılaştır. Ayar menülerinin adı ve yeri telefon modeline göre değişir.</p></div>
<h3>Işık</h3>
<p>En kolay ve ucuz ışık kaynağı penceredir. Pencereye yüzünü dön veya pencereyi çaprazına al; pencereyi arkana almak yüzünü karartır. Ancak gün ışığı saatler içinde değişir ve dört saatlik bir çekimde videoların renkleri birbirinden farklılaşabilir. Tutarlılık istiyorsan bir adet yumuşak ana ışık (örneğin softbox veya büyük bir LED panel) kullan ve odadaki farklı renkteki lambaları kapat.</p>
<h3>Ses</h3>
<p>İzleyici bulanık görüntüyü bazen affeder ama cızırtılı, yankılı sesi çoğu zaman affetmez. Basit bir yaka mikrofonu telefonun dahili mikrofonuna göre genellikle belirgin fark yaratır. Boş ve sert duvarlı odalar yankı yapar; halı, perde ve kitaplık yankıyı azaltır. Klima, buzdolabı ve fan gibi sürekli sesleri çekim boyunca kapat.</p>
<h3>Kadraj</h3>
<p>Kamerayı göz hizasına yerleştir, başının üstünde küçük bir boşluk bırak. Platform arayüzü ekranın alt kısmını ve sağ kenarını butonlar ve açıklama metniyle kaplar; yüzünü, ürünü ve ekran yazısı gelecek alanı ekranın orta bölgesinde tut. Her blokta kadrajı bir kez fotoğrafla, kıyafet değişiminden sonra aynı kadraja dönmek kolaylaşır.</p>
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Dikkat</strong><p>Gün ışığıyla çekiyorsan blokları ışığın en stabil olduğu saatlere koy ve her bloğun başında kısa bir test kaydı al. Bulutlu ve açık hava arasında gidip gelen günlerde yapay ana ışık kullanmak çok daha güvenlidir.</p></div>
<h2>Çekim akışı</h2>
<ol class="crs-steps">
<li><strong>Kur ve test et.</strong> Tutucuyu, ışığı ve mikrofonu yerleştir; 15 saniyelik bir test kaydı alıp kulaklıkla dinle ve büyük ekranda izle.</li>
<li><strong>Videoyu işaretle.</strong> Her çekimin başında kameraya parmaklarınla video numarasını göster veya numarayı söyle; kurguda dosyaları bulmak kolaylaşır.</li>
<li><strong>Her videoyu en az iki kez tam çek.</strong> Takıldığın yerde baştan başlamak yerine cümleyi tekrar et ve devam et; kesimi kurguda yaparsın.</li>
<li><strong>Ek görüntüleri hemen çek.</strong> Senaryodaki görüntü sütununda yazan yakın planları, el hareketlerini ve ürün çekimlerini aynı blokta tamamla.</li>
<li><strong>Bloğu kapat.</strong> Çekim listesinde videoyu işaretle, kıyafet veya mekân değiştir, kadraj fotoğrafına göre yeniden kur.</li>
<li><strong>Gün sonunda yedekle.</strong> Bütün dosyaları bilgisayara veya bulut depolamaya taşı ve video numarasına göre klasörle.</li>
</ol>
<div class="crs-callout tip"><strong class="crs-callout-title">💡 İpucu</strong><p>Her bloğun sonunda 2-3 dakikalık "serbest" görüntü çek: ortamın genel planı, ürünlerin yakın planı, elinin hareketleri. Bu görüntüler kurguda geçiş, kapak ve ileride hızlı bir video için yedek malzeme olur.</p></div>
<div class="crs-callout danger"><strong class="crs-callout-title">⛔ Bunu yapma</strong><p>Yedeği kontrol etmeden telefondaki ham görüntüleri silme. Dosyaların bilgisayarda veya bulutta açıldığını, sesinin ve görüntüsünün sağlam olduğunu gördükten sonra telefonda yer aç.</p></div>
<p>İlk toplu çekim günün yorucu geçebilir ve planladığından uzun sürebilir; bu çok normal. İkinci ve üçüncü seferde kurulum süresi kısalır, çekim listesi alışkanlığa dönüşür. Ham görüntüler hazır olduğunda sıra kurguda. Bir sonraki derste yedi videoyu hızlı ve tutarlı şekilde kurgulamak için proje şablonları, altyazı, kapak ve dışa aktarma ayarlarını kuracağız.</p>
<div class="crs-keypoints"><strong class="crs-callout-title">📌 Bu derste öğrendiklerin</strong><ul>
<li>Videoları senaryo sırasına göre değil, mekân ve kıyafete göre gruplayarak çek.</li>
<li>Dikey çerçeve, sabit kare hızı, kilitli odak ve pozlama, kapalı bildirimler temel telefon ayarlarıdır.</li>
<li>Tutarlı ışık ve temiz ses, pahalı kameradan daha fazla fark yaratabilir.</li>
<li>Her videoyu işaretle, en az iki kez çek, ek görüntüleri aynı blokta tamamla ve gün sonunda yedekle.</li>
</ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Görevin</strong><p>Önceki derste yazdığın yedi senaryo için mekân ve kıyafet bazlı bir çekim sırası tablosu hazırla. Takvimine 3-4 saatlik bir çekim bloğu koy, çekimden önceki gün kontrol listesini tamamla ve çekim gününde akıştaki altı adımı uygula. Toplam süreyi not et.</p></div>`,
  content_en: `<p>Filming seven videos on seven different days means seven setups, seven rounds of adjusting the light and seven bouts of "am I ready?" nerves. A batch filming day cuts that repetition down to one: you set up once, test once and capture all of the week's raw footage within a few hours. This is the single biggest time saver in the system.</p>
<p>In this lesson we plan filming day in three parts: preparation beforehand, technical setup (phone, light, sound, framing) and the filming flow itself. Expensive gear is not required; you can start with a phone, a steady mount and a simple microphone.</p>
<!--GORSEL-->
<h2>Before filming: plan the order</h2>
<p>The secret of batch filming is grouping videos <mark>by location and outfit, not by script order.</mark> If you film all videos for the same corner and the same outfit back to back, you never rebuild the light and camera for each one. This is where the "location" tag in your idea bank pays off.</p>
<table class="crs-table blue">
<thead><tr><th>Block</th><th>Location</th><th>Outfit</th><th>Videos</th><th>Sample time</th></tr></thead>
<tbody>
<tr><td>1</td><td>Bar counter</td><td>Apron, black t-shirt</td><td>Video 1, 4</td><td>50 min</td></tr>
<tr><td>2</td><td>Bar counter</td><td>Shirt</td><td>Video 2, 6</td><td>45 min</td></tr>
<tr><td>3</td><td>Living room table</td><td>Sweater</td><td>Video 3, 5</td><td>50 min</td></tr>
<tr><td>4</td><td>Outdoors</td><td>Jacket</td><td>Video 7</td><td>30 min</td></tr>
</tbody>
</table>
<p>The table above is an example scenario for a cafe account. The point of changing outfits is that videos shot on the same day should not feel like "they were all filmed on one day" when they appear back to back in the feed. For other businesses, such as a boutique, salon or office, you can group by product range or workstation instead of location.</p>
<ul class="crs-checklist">
<li>Print your scripts or open them on a separate screen, not on the filming phone.</li>
<li>Hang your outfits in order, ironed and ready.</li>
<li>Put the products, accessories and props for each block into separate boxes.</li>
<li>Fully charge the phone and mic; have a spare charger ready.</li>
<li>Free up enough storage on the phone for a few hours of filming.</li>
</ul>
<h2>Technical setup</h2>
<h3>Phone</h3>
<p>On most phones the rear camera delivers better footage than the front one; if you cannot see the screen, use a small mirror or a wireless monitor app to check yourself. Wipe the lens with a soft cloth at the start of every block; fingerprints are the most common cause of blurry footage.</p>
<table class="crs-table green">
<thead><tr><th>Setting</th><th>Recommendation</th><th>Why?</th></tr></thead>
<tbody>
<tr><td>Orientation</td><td>Vertical (9:16) <span class="crs-badge good">Must</span></td><td>Reels, Shorts and TikTok play full-screen vertical</td></tr>
<tr><td>Resolution</td><td>At least 1080p, 4K if possible</td><td>4K leaves room to punch in during editing</td></tr>
<tr><td>Frame rate</td><td>30 fps (or 25/24), the same all day</td><td>Mixed frame rates can cause stutter in the edit</td></tr>
<tr><td>Focus and exposure</td><td>Locked (on most phones, press and hold on screen)</td><td>Stops the image from brightening and darkening mid-take</td></tr>
<tr><td>Grid lines</td><td>On</td><td>Keeps eye level and straight lines in check</td></tr>
<tr><td>Notifications</td><td>Do not disturb or airplane mode <span class="crs-badge mid">Important</span></td><td>Calls and vibrations interrupt takes</td></tr>
</tbody>
</table>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Good to know</strong><p>Some phones record HDR video by default. HDR footage can look different in some editing apps or after upload. If you notice inconsistent colors, turn HDR off and compare with a test clip. Setting names and menu locations vary by phone model.</p></div>
<h3>Light</h3>
<p>The easiest and cheapest light source is a window. Face the window or keep it at an angle to you; with the window behind you, your face goes dark. But daylight changes over the hours, and across a four-hour shoot your videos may end up with different colors. If you want consistency, use one soft key light (for example a softbox or a large LED panel) and switch off lamps with different color tones in the room.</p>
<h3>Sound</h3>
<p>Viewers sometimes forgive a slightly soft image, but they rarely forgive crackly, echoing audio. A simple lavalier mic usually makes a noticeable difference over the phone's built-in mic. Empty rooms with hard walls echo; rugs, curtains and bookshelves reduce it. Turn off constant noise sources like the air conditioner, fridge and fans during takes.</p>
<h3>Framing</h3>
<p>Place the camera at eye level and leave a little space above your head. The platform interface covers the bottom of the screen and the right edge with buttons and caption text; keep your face, the product and the area for on-screen text in the middle of the frame. Take a photo of the framing in every block; it makes returning to the same frame after an outfit change easy.</p>
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Watch out</strong><p>If you film with daylight, schedule your blocks for the hours when the light is most stable and take a short test clip at the start of every block. On days that flip between cloudy and clear, a key light is much safer.</p></div>
<h2>The filming flow</h2>
<ol class="crs-steps">
<li><strong>Set up and test.</strong> Place the mount, light and mic; record a 15-second test, listen with headphones and watch it on a big screen.</li>
<li><strong>Mark the video.</strong> At the start of each take, hold up the video number with your fingers or say it out loud; it makes finding files in the edit easy.</li>
<li><strong>Film each video in full at least twice.</strong> When you stumble, repeat the sentence and keep going instead of starting over; you will cut it in the edit.</li>
<li><strong>Shoot extra footage right away.</strong> Capture the close-ups, hand movements and product shots listed in the visual column within the same block.</li>
<li><strong>Close the block.</strong> Tick the video off the shot list, change outfit or location, and rebuild the setup from your framing photo.</li>
<li><strong>Back up at the end of the day.</strong> Move all files to a computer or cloud storage and sort them into folders by video number.</li>
</ol>
<div class="crs-callout tip"><strong class="crs-callout-title">💡 Tip</strong><p>At the end of each block, shoot 2-3 minutes of "free" footage: a wide shot of the space, close-ups of products, your hands at work. This footage becomes transitions, cover material and backup for a quick video later.</p></div>
<div class="crs-callout danger"><strong class="crs-callout-title">⛔ Don't do this</strong><p>Do not delete raw footage from your phone before checking the backup. Free up space only after you have seen the files open on the computer or in the cloud with sound and picture intact.</p></div>
<p>Your first batch filming day may be tiring and take longer than planned; that is completely normal. By the second and third time, setup gets shorter and the shot list becomes a habit. Once the raw footage is ready, it is time to edit. In the next lesson we set up project templates, captions, covers and export settings to edit seven videos quickly and consistently.</p>
<div class="crs-keypoints"><strong class="crs-callout-title">📌 Key takeaways</strong><ul>
<li>Film videos grouped by location and outfit, not by script order.</li>
<li>Vertical framing, a fixed frame rate, locked focus and exposure, and silenced notifications are the core phone settings.</li>
<li>Consistent light and clean audio can matter more than an expensive camera.</li>
<li>Mark each video, film it at least twice, capture extra footage in the same block and back up at the end of the day.</li>
</ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Your task</strong><p>Build a filming order table, grouped by location and outfit, for the seven scripts you wrote in the previous lesson. Put a 3-4 hour filming block in your calendar, complete the checklist the day before, and follow the six steps of the flow on filming day. Note the total time.</p></div>`
};
