'use strict';
module.exports = {
  slug: 'isbirligi-fiyatlandirma-yontemi',
  title_tr: 'İşbirliği Fiyatlandırma: Ücretini Hesaplama Yöntemi',
  title_en: 'Pricing Brand Deals: A Method to Calculate Your Rate',
  summary_tr: 'Fiyatını tahmine değil yönteme dayandır: maliyet tabanı, erişim değeri, etkileşim, içerik türü, kullanım hakkı ve münhasırlığı hesaba katan adım adım bir hesaplama mantığı.',
  summary_en: 'Base your rate on a method, not a guess: a step-by-step calculation that accounts for your cost floor, reach value, engagement, content format, usage rights and exclusivity.',
  visual: {
    type: 'steps',
    title_tr: 'Fiyat hesaplama akışı',
    title_en: 'Rate calculation flow',
    items: [
      { tr: 'Maliyet tabanını (alt sınır) bul', en: 'Find your cost floor' },
      { tr: 'Erişime göre değer tabanını hesapla', en: 'Calculate reach-based value' },
      { tr: 'Etkileşim ve içerik türünü uygula', en: 'Apply engagement and format' },
      { tr: 'Kullanım hakkı ve münhasırlık ekle', en: 'Add usage rights, exclusivity' },
      { tr: 'Yuvarla, kaydet, zamanla güncelle', en: 'Round, record, adjust over time' }
    ]
  },
  content_tr: `<p>İçerik üreticilerin en sık sorduğu soru "Ne kadar istemeliyim?" sorusudur ve internette bunun için pek çok "takipçi başına fiyat" tablosu dolaşır. Bu tabloların büyük kısmı kaynağı belirsiz, ülkeye ve nişe göre çok farklı ve hızla eskiyen rakamlar içerir. Bu derste sana bir fiyat listesi vermeyeceğiz; bunun yerine kendi fiyatını hesaplayabileceğin ve zamanla iyileştirebileceğin bir yöntem göstereceğiz.</p>
<p>Yöntemin mantığı basit: önce <strong>zararına çalışmayacağın bir alt sınır</strong> belirlersin, sonra <strong>markaya sağladığın değeri</strong> hesaplarsın, ardından içeriğin türüne, kullanım hakkına ve münhasırlığa göre ayarlamalar yaparsın. Sonuç, markaya gerekçesini anlatabileceğin bir fiyat olur.</p>
<!--GORSEL-->
<h2>Adım 1: Maliyet tabanı (alt sınırın)</h2>
<p>İlk olarak bir içeriği üretmenin sana neye mal olduğunu hesapla. Bu, fiyatın altına inmemen gereken sınırdır.</p>
<p><strong>Maliyet tabanı = (Harcadığın saat × Kendi saatlik değerin) + Doğrudan giderler</strong></p>
<p>Harcadığın saate; brifi okuma, fikir geliştirme, çekim, kurgu, metin yazımı, revizyon ve yazışmalar dahildir. Saatlik değerini, bu zamanı başka bir işte kullansaydın kazanabileceğin tutara göre belirleyebilirsin. Doğrudan giderler ise mekan, aksesuar, ulaşım, ekipman kirası gibi o işe özel harcamalardır.</p>
<h2>Adım 2: Erişime göre değer tabanı</h2>
<p>Markanın satın aldığı şey dikkat olduğu için, ikinci hesap ortalama erişimine dayanır:</p>
<p><strong>Değer tabanı = (Ortalama erişim ÷ 1.000) × Bin erişim başına değerin</strong></p>
<p>"Bin erişim başına değer" kısaca <mark>senin belirlediğin ve zamanla güncellediğin bir birim fiyattır</mark>; evrensel bir piyasa rakamı yoktur. İlk kez belirlerken maliyet tabanından yola çıkabilirsin: maliyet tabanını ortalama erişimine bölüp 1.000 ile çarparsan, zararına çalışmayacağın en düşük bin erişim değerini bulursun. Başlangıçta bunun biraz üstünden başla, sonra markaların tepkisine göre ayarla.</p>
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Dikkat</strong><p>Bu dersteki tüm rakamlar ve katsayılar, yöntemi anlatmak için kullanılan örnek değerlerdir; piyasa fiyatı veya önerilen ücret değildir. Gerçek fiyatın; nişine, kitlene, şehrine, markanın büyüklüğüne ve dönemin koşullarına göre değişir.</p></div>
<h2>Adım 3: Etkileşim ve içerik türü ayarı</h2>
<p>İki hesap aynı erişime sahip olabilir ama birinin kitlesi çok daha ilgili olabilir. Etkileşim oranın kendi ortalamanın üzerindeyse (özellikle kayıt ve paylaşımlar yüksekse) değer tabanına bir artı katsayı uygulayabilirsin. Aynı şekilde içerik türü de emeği ve etkiyi değiştirir: kurgulu bir Reels, tek karelik bir gönderiden ya da birkaç hikayeden daha fazla emek ister.</p>
<h2>Adım 4: Kullanım hakkı ve münhasırlık</h2>
<p><strong>Kullanım hakkı</strong>, markanın senin ürettiğin içeriği kendi hesabında, web sitesinde veya ücretli reklamlarında kullanmasıdır. Bu, içeriğin değerini senin hesabının ötesine taşır; bu yüzden ayrı bir kalem olarak fiyatlandırılır. Süre (30 gün, 3 ay, 1 yıl), kanal (organik paylaşım, ücretli reklam) ve bölge, ek ücreti belirler.</p>
<p><strong>Münhasırlık</strong> ise belirli bir süre boyunca rakip markalarla çalışmama taahhüdüdür. Bu, gelecekteki fırsatlardan vazgeçmen anlamına geldiği için süresi ve kapsamı (sadece doğrudan rakipler mi, tüm kategori mi) arttıkça ek ücret de artar.</p>
<table class="crs-table yellow">
<thead><tr><th>Faktör</th><th>Fiyatı nasıl etkiler?</th><th>Örnek katsayı (kendin belirle)</th></tr></thead>
<tbody>
<tr><td>Etkileşim kendi ortalamanın üzerinde</td><td>Değer tabanını artırır</td><td>×1,1 - ×1,3</td></tr>
<tr><td>Kurgulu Reels</td><td>Emek ve etki yüksek</td><td>×1,0 (referans)</td></tr>
<tr><td>Hikaye serisi (3 kare)</td><td>Kısa ömürlü, daha az emek</td><td>×0,4 - ×0,6</td></tr>
<tr><td>Kullanım hakkı: organik, 30 gün</td><td>Ek kalem</td><td>Taban fiyatın +%15 - %25'i</td></tr>
<tr><td>Kullanım hakkı: ücretli reklam, 3 ay</td><td>Ek kalem</td><td>Taban fiyatın +%30 - %60'ı</td></tr>
<tr><td>Münhasırlık: doğrudan rakipler, 30 gün</td><td>Fırsat kaybı</td><td>Taban fiyatın +%10 - %30'u</td></tr>
<tr><td>Acil teslim / ek revizyon</td><td>Ek emek</td><td>Saat bazında ek ücret</td></tr>
</tbody>
</table>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Bilgi</strong><p>Tablodaki katsayılar bir başlangıç çerçevesidir, sektör standardı değildir. Amaç, her kalemi ayrı düşünmeni sağlamak. Zamanla kendi verine göre bu aralıkları daraltacak ya da değiştireceksin.</p></div>
<h2>Örnek hesap: adım adım</h2>
<div class="crs-template"><span class="crs-template-label">Örnek hesap (rakamlar varsayımsaldır)</span><p><strong>Durum:</strong> Bir kafe zinciri; 1 Reels + 3 hikaye, içeriğin 3 ay boyunca ücretli reklamlarda kullanılması ve 30 gün boyunca diğer kafe zincirleriyle çalışmama istiyor.<br><br><strong>1. Maliyet tabanı:</strong> Reels için 6 saat × 400 TL = 2.400 TL, ulaşım ve mekan gideri 300 TL. Alt sınır: 2.700 TL.<br><strong>2. Değer tabanı:</strong> Ortalama Reels erişimi 9.000. Kendi belirlediğin bin erişim değeri 350 TL. (9.000 ÷ 1.000) × 350 = 3.150 TL.<br><strong>3. Etkileşim:</strong> Son içeriklerin ortalamanın üzerinde, ×1,1 uygula: 3.465 TL. İki tabandan yüksek olanı al ve yuvarla: Reels için 3.500 TL.<br><strong>Hikaye serisi:</strong> 3.500 × 0,5 = 1.750 TL. Paket tabanı: 5.250 TL.<br><strong>4. Kullanım hakkı (ücretli reklam, 3 ay, +%40):</strong> 5.250 × 0,40 = 2.100 TL.<br><strong>Münhasırlık (30 gün, doğrudan rakipler, +%20):</strong> 5.250 × 0,20 = 1.050 TL.<br><br><strong>Toplam teklif:</strong> 5.250 + 2.100 + 1.050 = 8.400 TL (vergiler hariç olduğunu belirt).</p></div>
<p>Bu hesabın en büyük faydası, markaya kalem kalem gerekçe sunabilmendir. Marka bütçesinin daha düşük olduğunu söylerse, toplam fiyatı indirmek yerine kalemleri çıkarabilirsin: örneğin kullanım hakkını 3 aydan 30 güne düşürmek ya da münhasırlığı kaldırmak. Bunu bir sonraki derste pazarlık bölümünde ayrıntılı ele alacağız.</p>
<div class="crs-callout tip"><strong class="crs-callout-title">💡 İpucu</strong><p>Fiyatının vergiler (KDV vb.) dahil mi hariç mi olduğunu teklifte her zaman açıkça yaz. Hangi vergi yükümlülüklerinin sana uygulandığını ve faturayı nasıl keseceğini bir mali müşavirle netleştir.</p></div>
<h2>Fiyatını zamanla ayarlamak</h2>
<ol class="crs-steps">
<li><strong>Her teklifi kaydet.</strong> Tarih, marka, istenen iş, verdiğin fiyat ve sonucu (kabul, pazarlık, ret) bir tabloya yaz.</li>
<li><strong>Kabul oranına bak.</strong> Neredeyse her teklif pazarlıksız kabul ediliyorsa, bin erişim değerin muhtemelen düşüktür. Çoğu teklif bütçe gerekçesiyle reddediliyorsa, hedef markalarını veya paketlerini gözden geçir.</li>
<li><strong>Üç ayda bir güncelle.</strong> Erişim ve etkileşim ortalaman değiştikçe değer tabanın da değişir. Medya kitini güncellerken fiyat hesabını da yenile.</li>
<li><strong>Ürün karşılığı teklifleri ayrı değerlendir.</strong> Sadece ürün gönderen bir teklif, ürünün senin için gerçek değeri maliyet tabanını karşılıyorsa ve kitlene uyuyorsa mantıklı olabilir; aksi halde ücretli teklif iste.</li>
</ol>
<div class="crs-compare">
<div class="crs-compare-col bad"><strong class="crs-compare-title">❌ Yanlış</strong><ul><li>"Başka bir hesap şu kadar alıyormuş, ben de onu isteyeyim."</li><li>Kullanım hakkını ücretsiz vermek</li><li>Her marka için farklı, gerekçesiz fiyat söylemek</li></ul></div>
<div class="crs-compare-col good"><strong class="crs-compare-title">✅ Doğru</strong><ul><li>Kendi maliyet ve erişim verinle hesaplamak</li><li>Kullanım hakkı ve münhasırlığı ayrı kalem yapmak</li><li>Aynı yöntemi her teklifte tutarlı uygulamak</li></ul></div>
</div>
<div class="crs-callout danger"><strong class="crs-callout-title">⛔ Bunu yapma</strong><p>İlk işi almak için maliyet tabanının altına inme. Çok düşük bir fiyatla başlamak, aynı markayla sonraki işlerde fiyatı yükseltmeyi zorlaştırır ve sana harcadığın emeğin karşılığını vermez. Bütçe yetmiyorsa fiyatı değil, kapsamı küçült.</p></div>
<div class="crs-keypoints"><strong class="crs-callout-title">📌 Bu derste öğrendiklerin</strong><ul>
<li>Fiyat; maliyet tabanı ve erişime göre değer tabanından yüksek olanla başlar.</li>
<li>Bin erişim başına değer, senin belirlediğin ve zamanla güncellediğin bir birimdir; evrensel piyasa rakamı yoktur.</li>
<li>Etkileşim ve içerik türü, tabana uygulanan ayarlamalardır.</li>
<li>Kullanım hakkı ve münhasırlık her zaman ayrı kalem olarak fiyatlandırılmalıdır.</li>
<li>Her teklifi kaydetmek ve kabul oranına bakmak, fiyatını gerçekçi biçimde ayarlamanı sağlar.</li>
</ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Görevin</strong><p>Kendi verinle maliyet tabanını ve bin erişim başına değerini hesapla. Medya kitindeki iki paket için örnek hesaptaki adımları uygulayarak birer fiyat çıkar; kullanım hakkı ve münhasırlık için kendi katsayılarını belirle. Ardından bir "teklif kayıt tablosu" oluştur.</p></div>`,
  content_en: `<p>The question creators ask most often is "How much should I charge?", and the internet is full of "price per follower" charts that claim to answer it. Most of those charts have unclear sources, vary wildly by country and niche, and go out of date quickly. In this lesson we will not hand you a price list. Instead, we will show you a method for calculating your own rate and improving it over time.</p>
<p>The logic is simple: first you set <strong>a floor below which you would be working at a loss</strong>, then you calculate <strong>the value you deliver to the brand</strong>, and then you adjust for content format, usage rights and exclusivity. The result is a rate you can explain and justify to a brand.</p>
<!--GORSEL-->
<h2>Step 1: Your cost floor</h2>
<p>Start by calculating what one piece of content costs you to produce. This is the floor you should not go below.</p>
<p><strong>Cost floor = (Hours spent × Your hourly value) + Direct expenses</strong></p>
<p>Hours spent include reading the brief, developing the idea, shooting, editing, writing captions, revisions and back-and-forth messages. You can set your hourly value based on what you could earn using that time elsewhere. Direct expenses are costs specific to the job: venue, props, travel, equipment rental and so on.</p>
<h2>Step 2: Reach-based value</h2>
<p>Since what a brand buys is attention, the second calculation is based on your average reach:</p>
<p><strong>Value base = (Average reach ÷ 1,000) × Your value per 1,000 reach</strong></p>
<p>"Value per 1,000 reach" is <mark>a unit rate you set yourself and update over time</mark>; there is no universal market number. To set it the first time, start from your cost floor: divide your cost floor by your average reach and multiply by 1,000, and you get the lowest value per 1,000 reach that keeps you out of the red. Start a little above that, then adjust based on how brands respond.</p>
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Watch out</strong><p>All numbers and multipliers in this lesson are example values used to explain the method; they are not market rates or recommended fees. Your real rate depends on your niche, audience, location, the brand's size and current conditions.</p></div>
<h2>Step 3: Engagement and format adjustments</h2>
<p>Two accounts can have the same reach while one has a far more engaged audience. If your engagement rate is above your own average (especially saves and shares), you can apply an upward multiplier to your value base. Content format also changes effort and impact: an edited Reel takes more work than a single-image post or a few Stories.</p>
<h2>Step 4: Usage rights and exclusivity</h2>
<p><strong>Usage rights</strong> cover a brand using your content on its own account, website or paid ads. This extends the value of the content beyond your account, so it is priced as a separate line item. Duration (30 days, 3 months, 1 year), channel (organic posting or paid ads) and region determine the extra fee.</p>
<p><strong>Exclusivity</strong> is a commitment not to work with competing brands for a set period. Because it means giving up future opportunities, the fee rises as duration and scope (direct competitors only, or the whole category) increase.</p>
<table class="crs-table yellow">
<thead><tr><th>Factor</th><th>How it affects the rate</th><th>Example multiplier (set your own)</th></tr></thead>
<tbody>
<tr><td>Engagement above your own average</td><td>Raises the value base</td><td>×1.1 to ×1.3</td></tr>
<tr><td>Edited Reel</td><td>High effort and impact</td><td>×1.0 (reference)</td></tr>
<tr><td>Story series (3 frames)</td><td>Short-lived, less effort</td><td>×0.4 to ×0.6</td></tr>
<tr><td>Usage rights: organic, 30 days</td><td>Extra line item</td><td>+15% to 25% of base</td></tr>
<tr><td>Usage rights: paid ads, 3 months</td><td>Extra line item</td><td>+30% to 60% of base</td></tr>
<tr><td>Exclusivity: direct competitors, 30 days</td><td>Lost opportunities</td><td>+10% to 30% of base</td></tr>
<tr><td>Rush delivery / extra revisions</td><td>Extra effort</td><td>Hourly add-on</td></tr>
</tbody>
</table>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Good to know</strong><p>The multipliers in the table are a starting framework, not an industry standard. The point is to make you think about each line item separately. Over time you will narrow or change these ranges based on your own data.</p></div>
<h2>Worked example: step by step</h2>
<div class="crs-template"><span class="crs-template-label">Worked example (hypothetical numbers)</span><p><strong>Situation:</strong> A coffee chain wants 1 Reel + 3 Stories, the right to use the Reel in paid ads for 3 months, and no work with other coffee chains for 30 days.<br><br><strong>1. Cost floor:</strong> 6 hours × 40 per hour = 240, plus 30 for travel and venue. Floor: 270.<br><strong>2. Value base:</strong> Average Reel reach is 9,000. Your value per 1,000 reach is 35. (9,000 ÷ 1,000) × 35 = 315.<br><strong>3. Engagement:</strong> Your recent posts beat your average, so apply ×1.1: 346.5. Take the higher of the two bases and round: 350 for the Reel.<br><strong>Story series:</strong> 350 × 0.5 = 175. Package base: 525.<br><strong>4. Usage rights (paid ads, 3 months, +40%):</strong> 525 × 0.40 = 210.<br><strong>Exclusivity (30 days, direct competitors, +20%):</strong> 525 × 0.20 = 105.<br><br><strong>Total quote:</strong> 525 + 210 + 105 = 840 in your currency (state that taxes are excluded).</p></div>
<p>The biggest benefit of this calculation is that you can justify your quote line by line. If the brand says its budget is lower, you can remove line items instead of discounting the total: for example, cutting usage rights from 3 months to 30 days or dropping exclusivity. We will cover this in the negotiation part of the next lesson.</p>
<div class="crs-callout tip"><strong class="crs-callout-title">💡 Tip</strong><p>Always state clearly in your quote whether your rate includes or excludes taxes such as VAT. Confirm with an accountant which tax obligations apply to you and how you should invoice.</p></div>
<h2>Adjusting your rate over time</h2>
<ol class="crs-steps">
<li><strong>Log every quote.</strong> Record the date, brand, requested work, your quote and the outcome (accepted, negotiated, declined) in a spreadsheet.</li>
<li><strong>Watch your acceptance rate.</strong> If almost every quote is accepted without pushback, your value per 1,000 reach is probably low. If most are declined for budget reasons, review your target brands or packages.</li>
<li><strong>Update every three months.</strong> As your average reach and engagement change, so does your value base. Refresh your rate calculation when you update your media kit.</li>
<li><strong>Treat product-only offers separately.</strong> An offer of free product only may make sense if the product's real value to you covers your cost floor and fits your audience; otherwise, ask for a paid offer.</li>
</ol>
<div class="crs-compare">
<div class="crs-compare-col bad"><strong class="crs-compare-title">❌ Wrong</strong><ul><li>"Another account charges this much, so I will too."</li><li>Giving away usage rights for free</li><li>Quoting different, unexplained prices to every brand</li></ul></div>
<div class="crs-compare-col good"><strong class="crs-compare-title">✅ Right</strong><ul><li>Calculating from your own cost and reach data</li><li>Pricing usage rights and exclusivity separately</li><li>Applying the same method consistently to every quote</li></ul></div>
</div>
<div class="crs-callout danger"><strong class="crs-callout-title">⛔ Don't do this</strong><p>Do not go below your cost floor just to land your first deal. Starting too low makes it harder to raise your rate with the same brand later and does not pay you for the work you put in. If the budget is not enough, shrink the scope, not the price.</p></div>
<div class="crs-keypoints"><strong class="crs-callout-title">📌 Key takeaways</strong><ul>
<li>Your rate starts from the higher of your cost floor and your reach-based value.</li>
<li>Value per 1,000 reach is a unit you set and update yourself; there is no universal market number.</li>
<li>Engagement and content format are adjustments applied to the base.</li>
<li>Usage rights and exclusivity should always be priced as separate line items.</li>
<li>Logging every quote and tracking your acceptance rate lets you adjust your rate realistically.</li>
</ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Your task</strong><p>Calculate your cost floor and value per 1,000 reach using your own data. Apply the steps from the worked example to the two packages in your media kit and arrive at a price for each, setting your own multipliers for usage rights and exclusivity. Then create a "quote log" spreadsheet.</p></div>`
};
