'use strict';
module.exports = {
  slug: 'fiyatlandirma-hesabi',
  title_tr: 'Fiyatlandırma: Saat Maliyeti, Hedef Kâr ve Paket Fiyatı',
  title_en: 'Pricing: Hourly Cost, Target Profit and Package Price',
  summary_tr: "Paket fiyatını tahminle değil hesapla belirle: aylık giderlerini ve hedef gelirini faturalanabilir saate bölerek saat maliyetini bul, paketin iş yükünü ölç, kâr payını ekle ve kapasiteni kontrol et.",
  summary_en: "Set package prices with math, not guesses: divide your monthly costs and target income by billable hours to find your hourly cost, measure each package's workload, add a profit margin and check your capacity.",
  visual: {
    type: 'bars',
    title_tr: 'Örnek paketin saat dağılımı (göreli)',
    title_en: 'Example package: hours by task (relative)',
    items: [
      { tr: 'Tasarım ve video üretimi', en: 'Design and video production', value: 100 },
      { tr: 'Hikayeler ve aylık plan', en: 'Stories and monthly plan', value: 32 },
      { tr: 'Çekim', en: 'Shoots', value: 23 },
      { tr: 'Topluluk yönetimi', en: 'Community management', value: 23 },
      { tr: 'İletişim, onay ve rapor', en: 'Communication, approvals, reports', value: 23 }
    ]
  },
  content_tr: `<p>Yeni bir ajansın en zorlandığı konu fiyattır. Çoğu kişi fiyatını ya rakiplerin fiyatına bakarak ya da "müşteri bunu öder mi?" diye tahmin ederek belirler. İki yöntemin de ortak sorunu, senin gerçek maliyetini hesaba katmamasıdır. Sonuç genellikle çok çalışıp az kazanmak, birkaç ay sonra da tükenmektir.</p>
<p>Bu derste fiyatı tersinden kuracağız: Önce senin bir saatinin maliyetini bulacağız, sonra her paketin kaç saat sürdüğünü ölçeceğiz, üzerine kâr payını ekleyip paket fiyatını çıkaracağız. Son adımda da bu fiyatla kaç müşteriyi taşıyabileceğini kontrol edeceğiz.</p>
<!--GORSEL-->
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Dikkat</strong><p>Bu dersteki tüm rakamlar yalnızca <strong>yöntemi göstermek için uydurulmuş örnek</strong> değerlerdir. Piyasa ortalaması, önerilen fiyat ya da gelir beklentisi değildir. Kendi şehrin, nişin, giderlerin ve hedeflerinle hesabı yeniden yapmalısın.</p></div>
<h2>1. adım: Saat maliyetini hesapla</h2>
<p>Saat maliyeti, işini sürdürebilmek için bir saatinin en az ne kadar getirmesi gerektiğini gösterir. Formül şu: <mark>(Aylık giderler + hedef kişisel gelir + vergi ve prim payı) / aylık faturalanabilir saat</mark>.</p>
<h3>Aylık giderler</h3>
<p>Tasarım ve planlama yazılımı abonelikleri, telefon ve internet, ekipman yıpranma payı (telefon, kamera, ışık), muhasebe ücreti, ulaşım ve varsa ortak çalışma alanı kirası gibi kalemleri topla. Örnek senaryoda bu toplam 15.000 TL olsun.</p>
<h3>Hedef kişisel gelir ve yükümlülükler</h3>
<p>Kendine ödemek istediğin net tutarı belirle. Örnek senaryoda 50.000 TL. Bunun yanına vergi ve sosyal güvenlik primleri için bir pay ekle; bu payın ne kadar olması gerektiğini şirket türüne göre mali müşavirinle birlikte hesapla. Örnek senaryoda bu pay 15.000 TL. Toplam aylık ihtiyaç: 15.000 + 50.000 + 15.000 = 80.000 TL.</p>
<h3>Faturalanabilir saat</h3>
<p>Ayda çalıştığın her saat müşteri işine gitmez. Yeni müşteri arama, teklif hazırlama, muhasebe, öğrenme ve yönetim işleri de zaman alır. Örnek senaryoda haftada 40 saat çalışan biri için ayda yaklaşık 160 saatin 100 saatinin müşteri işine ayrılabildiğini varsayalım. Bu oran kişiden kişiye değişir; ilk aylarda satışa daha fazla zaman ayıracağın için faturalanabilir saatin daha da düşük olabilir.</p>
<p>Örnek saat maliyeti: 80.000 TL / 100 saat = <strong>800 TL / saat</strong>.</p>
<div class="crs-callout danger"><strong class="crs-callout-title">⛔ Bunu yapma</strong><p>Faturalanabilir saati, çalıştığın toplam saatle aynı kabul etme. Bu hata saat maliyetini olduğundan düşük gösterir ve satış, iletişim, düzeltme gibi işlere harcadığın zamanın karşılığını hiç alamazsın.</p></div>
<h2>2. adım: Paketin iş yükünü ölç</h2>
<p>İkinci derste her teslimat türünün sana ne kadar sürdüğünü not etmiştin. Şimdi bu süreleri pakete uygulayacağız. Aşağıdaki tablo, ikinci dersteki örnek Standart paketin saat hesabıdır. Süreler örnektir; kendi ölçtüğün sürelerle değiştir.</p>
<table class="crs-table blue">
<thead><tr><th>İş kalemi</th><th>Adet / ay</th><th>Birim süre (örnek)</th><th>Toplam saat</th></tr></thead>
<tbody>
<tr><td>Gönderi tasarımı ve metni</td><td>12</td><td>1 saat</td><td>12</td></tr>
<tr><td>Kısa video kurgusu</td><td>4</td><td>2,5 saat</td><td>10</td></tr>
<tr><td>Hikaye paylaşımları</td><td>16 gün</td><td>15 dakika</td><td>4</td></tr>
<tr><td>Aylık içerik planı</td><td>1</td><td>3 saat</td><td>3</td></tr>
<tr><td>Yarım gün çekim (ulaşım dahil)</td><td>1</td><td>5 saat</td><td>5</td></tr>
<tr><td>Topluluk yönetimi (yorumlar)</td><td>Ay boyunca</td><td>-</td><td>5</td></tr>
<tr><td>İletişim ve onay süreçleri</td><td>Ay boyunca</td><td>-</td><td>3</td></tr>
<tr><td>Aylık rapor</td><td>1</td><td>2 saat</td><td>2</td></tr>
<tr><td><strong>Toplam</strong></td><td></td><td></td><td><strong>44 saat</strong></td></tr>
</tbody>
</table>
<div class="crs-callout tip"><strong class="crs-callout-title">💡 İpucu</strong><p>Tahminle başlamak normaldir ama ilk müşterilerinde gerçek süreleri mutlaka kaydet. Basit bir tablo ya da süre takip uygulaması yeterli. Üç ay sonra elindeki gerçek veriyle paketlerini ve fiyatlarını güncellemek çok daha kolay olur.</p></div>
<h2>3. adım: Kâr payını ekle ve paket fiyatını bul</h2>
<p>Saat maliyeti yalnızca senin giderlerini ve hedef gelirini karşılar. İşletmenin büyümesi, boş geçen aylar, ekipman yenileme ve ileride ekip kurmak için bir de <strong>işletme kâr payı</strong> gerekir. Bu oranı kendi hedeflerine göre belirle; örnek senaryoda %20 kullanıyoruz.</p>
<ol class="crs-steps">
<li><strong>Maliyeti bul.</strong> 44 saat x 800 TL = 35.200 TL.</li>
<li><strong>Kâr payını ekle.</strong> 35.200 TL x 1,20 = 42.240 TL.</li>
<li><strong>Yuvarla ve sun.</strong> Örnek paket fiyatı yaklaşık 42.000 TL olur. Aynı yöntemi Başlangıç ve Premium paketlere de uygula.</li>
<li><strong>Tutarlılığı kontrol et.</strong> Premium paket, Standart paketten daha fazla iş içeriyorsa fiyatı da orantılı olarak yüksek olmalı. Kademeler arasındaki fiyat farkı iş yükü farkını yansıtmalı.</li>
</ol>
<h2>4. adım: Kapasite kontrolü</h2>
<p>Bu adım çoğu zaman atlanır ama en öğretici olanıdır. Örnek senaryoda ayda 100 faturalanabilir saatin var ve bir Standart paket 44 saat sürüyor. Bu durumda aynı anda ancak iki Standart müşteriyi rahatça taşıyabilirsin. İlk 10 müşteriye ulaşmayı hedefliyorsan bu hesap sana üç şey söyler:</p>
<table class="crs-table red">
<thead><tr><th>Seçenek</th><th>Ne demek?</th><th>Değerlendirme</th></tr></thead>
<tbody>
<tr><td><strong>Süreleri kısalt</strong></td><td>Şablonlar, toplu üretim, nişe özel içerik kütüphanesi</td><td><span class="crs-badge good">İlk yapılacak</span></td></tr>
<tr><td><strong>Paket karışımını değiştir</strong></td><td>Daha az saat alan Başlangıç paketlerini çoğaltmak</td><td><span class="crs-badge mid">Duruma göre</span></td></tr>
<tr><td><strong>Destek al</strong></td><td>Serbest çalışan tasarımcı ya da video kurgucu ile çalışmak</td><td><span class="crs-badge new">Büyüme adımı</span></td></tr>
<tr><td><strong>Fiyatı düşürüp daha çok müşteri almak</strong></td><td>Aynı saate daha az ücret</td><td><span class="crs-badge bad">Tükenmişlik riski</span></td></tr>
</tbody>
</table>
<p>Altıncı derste iş akışını düzenleyerek üretim süresini kısaltmayı, sekizinci derste de ekip ve serbest çalışanlarla büyümeyi ele alacağız.</p>
<h2>5. adım: Piyasayla karşılaştır, ama piyasaya teslim olma</h2>
<p>Hesapladığın fiyatı nişindeki işletmelerin ödeme gücüyle karşılaştır. Bunun için ilk görüşmelerde bütçeyi sormak, yerel ajansların açıkladığı paketlere bakmak ve sektördeki tanıdıklarla konuşmak işe yarar. Fiyatın nişin için çok yüksek kalıyorsa ilk refleksin fiyatı kırmak değil, <strong>kapsamı küçültmek</strong> olmalı: daha az video, daha az platform, topluluk yönetiminin müşteride kalması gibi.</p>
<div class="crs-compare">
<div class="crs-compare-col bad"><strong class="crs-compare-title">❌ Yanlış</strong><ul><li>"Rakip şu kadar istiyor, ben biraz daha ucuz vereyim."</li><li>Aynı kapsamı müşteri itiraz edince indirimle vermek</li><li>Fiyatı yıllarca aynı tutmak</li></ul></div>
<div class="crs-compare-col good"><strong class="crs-compare-title">✅ Doğru</strong><ul><li>Fiyatı kendi maliyetinden ve iş yükünden hesaplamak</li><li>Bütçe düşükse kapsamı daraltan bir seçenek sunmak</li><li>Fiyat güncelleme dönemini baştan sözleşmeye yazmak</li></ul></div>
</div>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Bilgi</strong><p>Maliyetlerin değişken olduğu dönemlerde fiyatlarını belirli aralıklarla gözden geçirmen gerekir. Fiyat güncellemesinin ne zaman ve nasıl yapılacağını sözleşmede baştan belirtmek, müşteriyle sonradan yaşanabilecek gerginliği azaltır. Bunu beşinci derste sözleşme maddeleri arasında göreceğiz.</p></div>
<ul class="crs-checklist">
<li>Aylık giderlerimi kalem kalem yazdım.</li>
<li>Hedef gelirimi ve vergi/prim payını belirledim (payı mali müşavirle teyit edeceğim).</li>
<li>Faturalanabilir saatimi gerçekçi olarak hesapladım.</li>
<li>Her paketin saat hesabını tabloyla çıkardım.</li>
<li>Kâr payını ekleyip paket fiyatlarını buldum ve kapasite kontrolünü yaptım.</li>
</ul>
<p>Artık paketlerin ve fiyatların hazır. Bir sonraki derste asıl soruya geçiyoruz: Bu paketleri satın alacak ilk müşterileri nerede ve nasıl bulacaksın?</p>
<div class="crs-keypoints"><strong class="crs-callout-title">📌 Bu derste öğrendiklerin</strong><ul><li>Saat maliyeti = (giderler + hedef gelir + vergi/prim payı) / faturalanabilir saat.</li><li>Paket fiyatı, paketin gerçek iş yükü ile saat maliyetinin çarpımına kâr payı eklenerek bulunur.</li><li>Kapasite kontrolü, kaç müşteriyi taşıyabileceğini ve ne zaman destek alman gerektiğini gösterir.</li><li>Bütçe düşük olduğunda fiyatı değil kapsamı küçültmek daha sağlıklıdır.</li></ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Görevin</strong><p>Kendi rakamlarınla saat maliyetini hesapla. Üç paketinin her biri için saat tablosunu doldur, kâr payını ekleyerek fiyatları çıkar. Ardından kapasite kontrolü yap: Mevcut faturalanabilir saatinle her paketten kaçar tane taşıyabilirsin? Sonucu not et; sekizinci derste büyüme planını bu sayıya göre kuracaksın.</p></div>`,
  content_en: `<p>Pricing is where new agencies struggle the most. Most people set their price either by looking at competitors or by guessing what a client might pay. Both approaches share one problem: they ignore your real costs. The usual result is working hard, earning little and burning out a few months later.</p>
<p>In this lesson we will build the price backwards. First we will find what one hour of your time costs, then measure how many hours each package takes, add a profit margin and arrive at a package price. In the last step we will check how many clients you can actually carry at that price.</p>
<!--GORSEL-->
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Watch out</strong><p>Every number in this lesson is a <strong>made-up example used only to show the method</strong>. None of them is a market average, a recommended price or an income expectation. Redo the math with your own city, niche, costs and goals.</p></div>
<h2>Step 1: Calculate your hourly cost</h2>
<p>Your hourly cost tells you the minimum one hour of work must bring in for the business to be sustainable. The formula: <mark>(monthly expenses + target personal income + tax and social security reserve) / monthly billable hours</mark>.</p>
<h3>Monthly expenses</h3>
<p>Add up items such as design and scheduling software subscriptions, phone and internet, equipment wear (phone, camera, lights), accounting fees, transport and coworking rent if you have it. In our example scenario this totals $1,500.</p>
<h3>Target personal income and obligations</h3>
<p>Decide the net amount you want to pay yourself. In the example, $5,000. Then add a reserve for taxes and social security contributions; work out the right size of this reserve with an accountant, since it depends on your business structure and country. In the example, the reserve is $1,500. Total monthly need: $1,500 + $5,000 + $1,500 = $8,000.</p>
<h3>Billable hours</h3>
<p>Not every hour you work goes to client work. Finding new clients, writing proposals, bookkeeping, learning and admin take time too. In our example, assume that someone working 40 hours a week can dedicate about 100 of their roughly 160 monthly hours to client work. This ratio varies from person to person, and in your first months it may be even lower because you will spend more time selling.</p>
<p>Example hourly cost: $8,000 / 100 hours = <strong>$80 per hour</strong>.</p>
<div class="crs-callout danger"><strong class="crs-callout-title">⛔ Don't do this</strong><p>Do not treat billable hours as equal to total hours worked. This mistake makes your hourly cost look lower than it is, and you never get paid for the time you spend on sales, communication and fixes.</p></div>
<h2>Step 2: Measure the package workload</h2>
<p>In lesson two you noted how long each type of deliverable takes you. Now apply those times to a package. The table below is the hour breakdown for the example Standard package from lesson two. The times are examples; replace them with your own measurements.</p>
<table class="crs-table blue">
<thead><tr><th>Task</th><th>Quantity / month</th><th>Time per unit (example)</th><th>Total hours</th></tr></thead>
<tbody>
<tr><td>Post design and copy</td><td>12</td><td>1 hour</td><td>12</td></tr>
<tr><td>Short video editing</td><td>4</td><td>2.5 hours</td><td>10</td></tr>
<tr><td>Stories</td><td>16 days</td><td>15 minutes</td><td>4</td></tr>
<tr><td>Monthly content plan</td><td>1</td><td>3 hours</td><td>3</td></tr>
<tr><td>Half-day shoot (incl. travel)</td><td>1</td><td>5 hours</td><td>5</td></tr>
<tr><td>Community management (comments)</td><td>Throughout the month</td><td>-</td><td>5</td></tr>
<tr><td>Communication and approvals</td><td>Throughout the month</td><td>-</td><td>3</td></tr>
<tr><td>Monthly report</td><td>1</td><td>2 hours</td><td>2</td></tr>
<tr><td><strong>Total</strong></td><td></td><td></td><td><strong>44 hours</strong></td></tr>
</tbody>
</table>
<div class="crs-callout tip"><strong class="crs-callout-title">💡 Tip</strong><p>It is fine to start with estimates, but track real times with your first clients. A simple spreadsheet or a time-tracking app is enough. After three months, real data makes it much easier to update your packages and prices.</p></div>
<h2>Step 3: Add a profit margin and find the package price</h2>
<p>Your hourly cost only covers your expenses and target income. The business also needs a <strong>profit margin</strong> for growth, slow months, replacing equipment and eventually building a team. Set this percentage based on your goals; the example uses 20%.</p>
<ol class="crs-steps">
<li><strong>Find the cost.</strong> 44 hours x $80 = $3,520.</li>
<li><strong>Add the margin.</strong> $3,520 x 1.20 = $4,224.</li>
<li><strong>Round and present.</strong> The example package price comes to roughly $4,200. Apply the same method to the Starter and Premium packages.</li>
<li><strong>Check consistency.</strong> If Premium contains more work than Standard, its price should be proportionally higher. The price gap between tiers should reflect the workload gap.</li>
</ol>
<h2>Step 4: Capacity check</h2>
<p>This step is often skipped, yet it teaches the most. In the example you have 100 billable hours a month and one Standard package takes 44 hours. That means you can comfortably carry only two Standard clients at once. If your goal is your first 10 clients, this math tells you three things:</p>
<table class="crs-table red">
<thead><tr><th>Option</th><th>What it means</th><th>Assessment</th></tr></thead>
<tbody>
<tr><td><strong>Cut production time</strong></td><td>Templates, batch production, a niche-specific content library</td><td><span class="crs-badge good">Do this first</span></td></tr>
<tr><td><strong>Change the package mix</strong></td><td>Sell more of the lighter Starter packages</td><td><span class="crs-badge mid">Depends</span></td></tr>
<tr><td><strong>Get help</strong></td><td>Work with a freelance designer or video editor</td><td><span class="crs-badge new">Growth step</span></td></tr>
<tr><td><strong>Lower prices and take more clients</strong></td><td>Less money for the same hours</td><td><span class="crs-badge bad">Burnout risk</span></td></tr>
</tbody>
</table>
<p>In lesson six we will shorten production time by organizing your workflow, and in lesson eight we will cover growing with a team and freelancers.</p>
<h2>Step 5: Compare with the market, but do not surrender to it</h2>
<p>Compare your calculated price with what businesses in your niche can afford. Asking about budget in first meetings, reviewing packages that local agencies publish and talking to people in the industry all help. If your price is too high for the niche, your first move should not be a discount; it should be <strong>reducing the scope</strong>: fewer videos, fewer platforms, or the client keeping community management in-house.</p>
<div class="crs-compare">
<div class="crs-compare-col bad"><strong class="crs-compare-title">❌ Wrong</strong><ul><li>"The competitor charges this much, so I will go a little lower."</li><li>Giving the same scope at a discount when the client pushes back</li><li>Keeping prices unchanged for years</li></ul></div>
<div class="crs-compare-col good"><strong class="crs-compare-title">✅ Right</strong><ul><li>Calculating price from your own costs and workload</li><li>Offering a narrower scope when the budget is low</li><li>Writing a price review period into the contract from day one</li></ul></div>
</div>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Good to know</strong><p>When costs are changing, you need to review your prices at regular intervals. Stating in the contract when and how prices will be reviewed reduces friction with clients later. We will cover this among the contract clauses in lesson five.</p></div>
<ul class="crs-checklist">
<li>I listed my monthly expenses item by item.</li>
<li>I set my target income and tax/contribution reserve (I will confirm the reserve with an accountant).</li>
<li>I calculated my billable hours realistically.</li>
<li>I built an hour breakdown table for each package.</li>
<li>I added a profit margin, found my package prices and ran a capacity check.</li>
</ul>
<p>Your packages and prices are now ready. In the next lesson we move to the real question: where and how will you find the first clients to buy them?</p>
<div class="crs-keypoints"><strong class="crs-callout-title">📌 Key takeaways</strong><ul><li>Hourly cost = (expenses + target income + tax/contribution reserve) / billable hours.</li><li>Package price = real package hours x hourly cost, plus a profit margin.</li><li>A capacity check shows how many clients you can carry and when you need help.</li><li>When a budget is low, reducing scope is healthier than cutting price.</li></ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Your task</strong><p>Calculate your hourly cost with your own numbers. Fill in the hour table for each of your three packages and add your margin to get the prices. Then run a capacity check: with your current billable hours, how many of each package can you carry? Write the result down; in lesson eight you will build your growth plan around it.</p></div>`
};
