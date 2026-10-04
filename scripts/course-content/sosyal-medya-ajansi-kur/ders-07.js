'use strict';
module.exports = {
  slug: 'raporlama-ve-musteri-elde-tutma',
  title_tr: 'Raporlama ve Müşteriyi Elde Tutma',
  title_en: 'Reporting and Client Retention',
  summary_tr: "Müşterinin anlayacağı, işletme hedefleriyle bağlantılı bir aylık rapor hazırlamayı; düzenli görüşmeler, erken uyarı işaretleri ve proaktif önerilerle müşteriyi uzun süre elde tutmayı öğren.",
  summary_en: "Learn to build a monthly report clients understand and that ties back to business goals, and to keep clients for the long term with regular check-ins, early warning signs and proactive ideas.",
  visual: {
    type: 'bars',
    title_tr: 'Elde tutmada önerilen öncelikler (göreli)',
    title_en: 'Suggested retention priorities (relative)',
    items: [
      { tr: 'Zamanında ve düzenli teslimat', en: 'Consistent, on-time delivery', value: 100 },
      { tr: 'Anlaşılır aylık rapor', en: 'A clear monthly report', value: 85 },
      { tr: 'Hızlı ve net iletişim', en: 'Fast, clear communication', value: 80 },
      { tr: 'Proaktif yeni fikirler', en: 'Proactive new ideas', value: 65 },
      { tr: 'Düzenli strateji görüşmesi', en: 'Regular strategy reviews', value: 55 }
    ]
  },
  content_tr: `<p>Yeni müşteri bulmak emek ve zaman ister; mevcut müşteriyi elde tutmak ise çoğu zaman çok daha az çaba gerektirir. Üstelik uzun süre çalıştığın bir müşteriyi daha iyi tanır, onun için daha hızlı ve daha iyi içerik üretirsin. Bu yüzden küçük bir ajansın istikrarı büyük ölçüde müşterilerini ne kadar süre tutabildiğine bağlıdır.</p>
<p>Müşteri, yaptığın işin büyük kısmını görmez: planlama saatlerini, kurgu sürelerini, yanıtladığın yorumları. Raporlama bu görünmeyen işi görünür kılar. Bu derste anlaşılır bir aylık rapor hazırlamayı ve müşteriyi elde tutmak için kurabileceğin düzenli alışkanlıkları ele alacağız.</p>
<!--GORSEL-->
<h2>Müşterinin okuyacağı bir rapor</h2>
<p>İyi bir rapor uzun olmak zorunda değil. Çoğu küçük işletme sahibi onlarca grafik içeren bir dosyayı okumaz. Ona gereken şey, beş dakikada "Bu ay ne oldu, ne öğrendik, gelecek ay ne yapacağız?" sorularının cevabıdır. Raporu her ay aynı yapıda hazırla ki müşteri nereye bakacağını bilsin.</p>
<ol class="crs-steps">
<li><strong>Özet.</strong> Üç cümlede ayın durumu: neler yapıldı, öne çıkan sonuç, gelecek ayın odağı.</li>
<li><strong>Yapılan iş.</strong> Teslimat sayıları pakete göre: kaç gönderi, kaç video, kaç hikaye, kaç yorum yanıtı.</li>
<li><strong>Temel metrikler.</strong> İşletmenin hedefiyle bağlantılı birkaç gösterge ve önceki aya göre değişimi.</li>
<li><strong>Öne çıkan içerikler.</strong> En iyi ve en zayıf performans gösteren içerikler ve bunlardan çıkan ders.</li>
<li><strong>Gelecek ayın planı.</strong> Öğrendiklerine göre neyi değiştireceğin, neyi sürdüreceğin.</li>
</ol>
<h2>Hangi metrikleri raporlamalısın?</h2>
<p>Metrik seçimi, birinci görüşmede öğrendiğin işletme hedefine göre yapılmalı. Takipçi sayısı tek başına çoğu işletme için en anlamlı gösterge değildir. Kafe sahibi için rezervasyon soruları, butik için ürün hakkında gelen mesajlar, kuaför için randevu talepleri daha anlamlı olabilir.</p>
<table class="crs-table purple">
<thead><tr><th>Metrik</th><th>Ne anlatır?</th><th>Rapordaki yeri</th></tr></thead>
<tbody>
<tr><td><strong>Erişim / görüntülenme</strong></td><td>İçeriklerin kaç kişiye ulaştığı</td><td><span class="crs-badge mid">Destekleyici</span></td></tr>
<tr><td><strong>Etkileşim (beğeni, yorum, kaydetme, paylaşım)</strong></td><td>İçeriğin ne kadar ilgi gördüğü</td><td><span class="crs-badge mid">Destekleyici</span></td></tr>
<tr><td><strong>Profil ziyareti ve bağlantı tıklaması</strong></td><td>İlginin işletmeye yönelip yönelmediği</td><td><span class="crs-badge good">Önemli</span></td></tr>
<tr><td><strong>Mesajla gelen talepler</strong></td><td>Rezervasyon, fiyat, randevu soruları</td><td><span class="crs-badge good">Çok önemli</span></td></tr>
<tr><td><strong>Takipçi sayısı</strong></td><td>Hesabın genel büyüklüğü</td><td><span class="crs-badge bad">Tek başına yanıltıcı</span></td></tr>
</tbody>
</table>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Bilgi</strong><p>Platformların istatistik ekranları ve metrik tanımları zaman zaman değişir; bir metriğin adı ya da nasıl hesaplandığı güncellenebilir. Rapor şablonunu bu tür değişikliklere göre güncelle ve müşteriye karşılaştırma yaparken tanımların aynı kalıp kalmadığını belirt. Mesajla gelen talepler gibi bazı verileri ise müşteriyle birlikte basit bir sayımla takip etmen gerekebilir.</p></div>
<div class="crs-callout danger"><strong class="crs-callout-title">⛔ Bunu yapma</strong><p>Raporu yalnızca iyi giden rakamlardan oluşturma ya da düşüşleri gizleme. Bir ay metrikler düştüyse bunu açıkça yaz, olası nedenleri (sezon, içerik türü, yayın saati) dürüstçe değerlendir ve ne değiştireceğini anlat. Şeffaflık, kısa vadede rahatsız edici görünse de uzun vadede güveni güçlendirir.</p></div>
<div class="crs-template"><span class="crs-template-label">Şablon: Rapor özeti</span><p>"Ekim ayında planlanan 12 gönderi, 4 kısa video ve 16 günlük hikaye paylaşımı tamamlandı. En çok ilgi gören içerik, yeni tatlı menüsünü tanıtan kısa video oldu; bu dönemde mesajla gelen rezervasyon soruları da önceki aya göre arttı. Fiyat odaklı gönderiler ise beklenenden az etkileşim aldı. Kasım ayında mekanın hazırlık sürecini gösteren videolara ağırlık vermeyi ve fiyat bilgisini hikayelerde paylaşmayı öneriyorum."</p></div>
<h2>Müşteriyi elde tutmanın alışkanlıkları</h2>
<p>Müşteriler çoğu zaman tek bir büyük hata yüzünden değil, zamanla biriken küçük hayal kırıklıkları yüzünden ayrılır: geç kalan bir rapor, yanıtsız kalan bir mesaj, birkaç aydır aynı tür içerikler. Bunu önlemek için düzenli alışkanlıklar kur.</p>
<ul class="crs-checklist">
<li>Raporu her ay aynı gün gönder ve kısa bir görüşmeyle üzerinden geç.</li>
<li>Her üç ayda bir, hedefleri ve paketi gözden geçirdiğin bir strateji görüşmesi yap.</li>
<li>Her ay en az bir yeni fikir öner: yeni bir içerik serisi, özel gün kampanyası, iş birliği.</li>
<li>Mesajlara sözleşmedeki saatler içinde yanıt ver; yanıt veremeyeceğin dönemleri önceden bildir.</li>
<li>Dönem dönem kısa bir memnuniyet sorusu sor: "Bu ay en çok neyi beğendiniz, neyi değiştirmemi istersiniz?"</li>
</ul>
<h3>Erken uyarı işaretleri</h3>
<p>Bir müşterinin ayrılmaya hazırlandığı çoğu zaman önceden sezilebilir. Aşağıdaki işaretlerden birkaçını bir arada görürsen beklemeden bir görüşme iste ve durumu açıkça konuş.</p>
<table class="crs-table red">
<thead><tr><th>İşaret</th><th>Olası anlamı</th><th>Önerilen adım</th></tr></thead>
<tbody>
<tr><td>Onaylar gecikiyor</td><td>Öncelik değişti ya da ilgi azaldı</td><td>Onay sürecini kolaylaştırmayı öner</td></tr>
<tr><td>Raporlar okunmuyor</td><td>Rapor değer üretmiyor</td><td>Raporu kısalt, görüşmeyle sun</td></tr>
<tr><td>Ödemeler gecikiyor</td><td>Bütçe sıkışıklığı</td><td>Kapsamı daraltan seçenek sun</td></tr>
<tr><td>"Sonuç ne?" soruları artıyor</td><td>Beklenti ile rapor arasında kopukluk</td><td>Hedefleri ve metrikleri yeniden konuş</td></tr>
</tbody>
</table>
<div class="crs-callout tip"><strong class="crs-callout-title">💡 İpucu</strong><p>Memnun bir müşteri, en güçlü pazarlama kanalındır. Birkaç aylık sorunsuz bir çalışmanın ardından müşterinden kısa bir görüş yazısı ve nişindeki tanıdıklarına seni önermesini iste. Bunu bir sonraki stratejik görüşmenin sonunda, sonuçları birlikte değerlendirdikten sonra yapmak doğal bir an yaratır.</p></div>
<h3>Paketi büyütmek</h3>
<p>Elde tutma, yalnızca müşteriyi kaybetmemek değil, ilişkiyi zamanla büyütmektir. Strateji görüşmelerinde ihtiyacın değiştiğini görürsen bir üst paketi ya da ek hizmetleri öner. Ancak bunu satış baskısıyla değil, rapordaki verilere dayanarak yap: "Kısa videolar ayın en çok mesaj getiren içerikleri oldu; video sayısını artırmak mantıklı olabilir" gibi.</p>
<h3>Ayrılık olursa: Düzgün bir kapanış</h3>
<p>Ne kadar iyi çalışırsan çalış, bazı müşteriler bütçe, öncelik değişikliği ya da işi kendi bünyesine alma gibi nedenlerle ayrılacaktır. Bu bir başarısızlık değil, işin doğal bir parçasıdır. Önemli olan, ayrılığı profesyonel biçimde yönetmektir. Sözleşmedeki fesih süresine uy, devam eden içerikleri tamamla, müşteriye o güne kadar üretilen içeriklerin ve marka dosyalarının düzenli bir arşivini teslim et ve hesap erişimlerini kendin kaldır. Son bir görüşmede ayrılık nedenini sakin bir şekilde sor; aldığın cevap, hizmetini geliştirmek için değerli bir geri bildirimdir. İyi bir kapanış yapan ajansa, işletmeler ileride geri dönebilir ya da tanıdıklarına önerebilir.</p>
<div class="crs-compare">
<div class="crs-compare-col bad"><strong class="crs-compare-title">❌ Yanlış</strong><ul><li>Yalnızca takipçi sayısını raporlamak</li><li>Raporu dosya olarak gönderip konuşmamak</li><li>Sorun çıkana kadar müşteriyle temas kurmamak</li></ul></div>
<div class="crs-compare-col good"><strong class="crs-compare-title">✅ Doğru</strong><ul><li>İşletme hedefiyle bağlantılı metrikler</li><li>Kısa bir görüşmeyle rapor sunumu</li><li>Düzenli strateji görüşmeleri ve yeni fikirler</li></ul></div>
</div>
<p>Artık müşteri bulmaktan raporlamaya kadar ajansın tüm döngüsü elinde. Son derste yasal temelleri, ekip kurarak büyümeyi ve tüm bu adımları birleştiren 90 günlük ajans kurulum planını ele alacağız.</p>
<div class="crs-keypoints"><strong class="crs-callout-title">📌 Bu derste öğrendiklerin</strong><ul><li>İyi bir rapor kısa, her ay aynı yapıda ve işletme hedefiyle bağlantılıdır.</li><li>Takipçi sayısı tek başına yanıltıcıdır; profil ziyareti, tıklama ve mesajla gelen talepler daha anlamlı olabilir.</li><li>Düşüşleri gizlemek yerine nedenlerini ve çözümünü açıkça yazmak güveni güçlendirir.</li><li>Düzenli görüşmeler, yeni fikirler ve erken uyarı işaretlerini izlemek müşteriyi elde tutmanın temelidir.</li></ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Görevin</strong><p>Beş bölümlük aylık rapor şablonunu hazırla ve nişindeki bir işletme hedefi için hangi üç metriği raporlayacağını seç. Hayali müşterin için örnek bir rapor özeti yaz. Ardından takviminde aylık rapor günü ve üç ayda bir strateji görüşmesi için tekrarlayan hatırlatıcılar oluştur.</p></div>`,
  content_en: `<p>Finding new clients takes time and effort; keeping existing ones usually takes far less. And the longer you work with a client, the better you know them and the faster you produce better content for them. That is why a small agency's stability depends heavily on how long it keeps its clients.</p>
<p>Clients do not see most of your work: the planning hours, the editing time, the comments you answer. Reporting makes that invisible work visible. In this lesson we will build a clear monthly report and the regular habits that help you keep clients.</p>
<!--GORSEL-->
<h2>A report the client will actually read</h2>
<p>A good report does not need to be long. Most small business owners will not read a file full of charts. What they need is a five-minute answer to "What happened this month, what did we learn, and what are we doing next month?" Use the same structure every month so the client knows where to look.</p>
<ol class="crs-steps">
<li><strong>Summary.</strong> The month in three sentences: what was done, the standout result, next month's focus.</li>
<li><strong>Work delivered.</strong> Deliverable counts against the package: posts, videos, stories, comment replies.</li>
<li><strong>Key metrics.</strong> A few indicators tied to the business goal, and how they changed from last month.</li>
<li><strong>Standout content.</strong> The best and weakest performers, and the lesson from each.</li>
<li><strong>Next month's plan.</strong> What you will change and what you will keep, based on what you learned.</li>
</ol>
<h2>Which metrics should you report?</h2>
<p>Choose metrics based on the business goal you learned in the discovery meeting. Follower count alone is not the most meaningful indicator for most businesses. For a cafe, booking inquiries might matter more; for a boutique, product questions in DMs; for a salon, appointment requests.</p>
<table class="crs-table purple">
<thead><tr><th>Metric</th><th>What it tells you</th><th>Place in the report</th></tr></thead>
<tbody>
<tr><td><strong>Reach / views</strong></td><td>How many people the content reached</td><td><span class="crs-badge mid">Supporting</span></td></tr>
<tr><td><strong>Engagement (likes, comments, saves, shares)</strong></td><td>How much interest the content drew</td><td><span class="crs-badge mid">Supporting</span></td></tr>
<tr><td><strong>Profile visits and link clicks</strong></td><td>Whether interest turned toward the business</td><td><span class="crs-badge good">Important</span></td></tr>
<tr><td><strong>Inquiries by message</strong></td><td>Booking, price and appointment questions</td><td><span class="crs-badge good">Very important</span></td></tr>
<tr><td><strong>Follower count</strong></td><td>The overall size of the account</td><td><span class="crs-badge bad">Misleading on its own</span></td></tr>
</tbody>
</table>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Good to know</strong><p>Platforms change their insights screens and metric definitions from time to time; a metric may be renamed or calculated differently. Update your report template when that happens, and tell the client whether definitions stayed the same when you compare periods. Some data, such as inquiries by message, you may need to track with a simple manual count together with the client.</p></div>
<div class="crs-callout danger"><strong class="crs-callout-title">⛔ Don't do this</strong><p>Do not build the report only from the numbers that went well, and do not hide drops. If metrics fell in a given month, say so plainly, assess the likely causes honestly (season, content type, posting time) and explain what you will change. Transparency can feel uncomfortable in the short term, but it builds trust in the long run.</p></div>
<div class="crs-template"><span class="crs-template-label">Template: Report summary</span><p>"In October we completed the planned 12 posts, 4 short videos and 16 days of stories. The best-performing piece was the short video introducing the new dessert menu, and booking inquiries by message also rose compared with last month. Price-focused posts drew less engagement than expected. For November, I suggest leaning into behind-the-scenes videos of the kitchen and moving price information to stories."</p></div>
<h2>Habits that keep clients</h2>
<p>Clients rarely leave over one big mistake. More often they leave because of small disappointments that pile up: a late report, an unanswered message, months of the same kind of content. Build regular habits to prevent that.</p>
<ul class="crs-checklist">
<li>Send the report on the same day every month and walk through it on a short call.</li>
<li>Every three months, hold a strategy review to revisit goals and the package.</li>
<li>Suggest at least one new idea each month: a new content series, a seasonal campaign, a collaboration.</li>
<li>Reply to messages within the contracted hours, and announce in advance when you will be unavailable.</li>
<li>Ask a short satisfaction question now and then: "What did you like most this month, and what would you like me to change?"</li>
</ul>
<h3>Early warning signs</h3>
<p>You can often sense ahead of time that a client is getting ready to leave. If you see several of the signs below at once, ask for a meeting right away and talk openly.</p>
<table class="crs-table red">
<thead><tr><th>Sign</th><th>Possible meaning</th><th>Suggested step</th></tr></thead>
<tbody>
<tr><td>Approvals are getting slower</td><td>Priorities shifted or interest dropped</td><td>Offer to simplify the approval process</td></tr>
<tr><td>Reports go unread</td><td>The report is not delivering value</td><td>Shorten it and present it on a call</td></tr>
<tr><td>Payments are late</td><td>Budget pressure</td><td>Offer a narrower-scope option</td></tr>
<tr><td>More "So what are the results?" questions</td><td>A gap between expectations and the report</td><td>Revisit goals and metrics together</td></tr>
</tbody>
</table>
<div class="crs-callout tip"><strong class="crs-callout-title">💡 Tip</strong><p>A happy client is your strongest marketing channel. After a few months of smooth work, ask the client for a short testimonial and for introductions to people they know in your niche. Doing this at the end of a strategy review, right after you have looked at results together, creates a natural moment.</p></div>
<h3>Growing the account</h3>
<p>Retention is not only about not losing clients; it is about growing the relationship over time. If a strategy review shows that needs have changed, suggest the next package up or relevant add-ons. Do it based on the report's data, not sales pressure: for example, "Short videos brought in the most inquiries this month, so increasing the number of videos could make sense."</p>
<h3>If a client leaves: a clean offboarding</h3>
<p>No matter how well you work, some clients will leave because of budget, shifting priorities or a decision to bring the work in-house. That is not a failure; it is a normal part of the business. What matters is handling the exit professionally. Respect the notice period in the contract, finish any content in progress, hand over an organized archive of the content and brand files produced so far, and remove your own account access. In a final call, calmly ask why they are leaving; the answer is valuable feedback for improving your service. A business may come back to, or recommend, an agency that handled the goodbye well.</p>
<div class="crs-compare">
<div class="crs-compare-col bad"><strong class="crs-compare-title">❌ Wrong</strong><ul><li>Reporting only follower count</li><li>Emailing the report as a file and never discussing it</li><li>No contact with the client until something goes wrong</li></ul></div>
<div class="crs-compare-col good"><strong class="crs-compare-title">✅ Right</strong><ul><li>Metrics tied to the business goal</li><li>Presenting the report on a short call</li><li>Regular strategy reviews and fresh ideas</li></ul></div>
</div>
<p>You now have the full agency cycle, from finding clients to reporting. In the final lesson we will cover the legal basics, growing with a team and a 90-day agency launch plan that brings all these steps together.</p>
<div class="crs-keypoints"><strong class="crs-callout-title">📌 Key takeaways</strong><ul><li>A good report is short, follows the same structure every month and ties back to the business goal.</li><li>Follower count alone is misleading; profile visits, clicks and inquiries can be more meaningful.</li><li>Explaining drops openly, with causes and fixes, builds more trust than hiding them.</li><li>Regular check-ins, fresh ideas and watching for early warning signs are the foundation of retention.</li></ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Your task</strong><p>Build your five-part monthly report template and choose the three metrics you would report for a business goal in your niche. Write a sample report summary for a fictional client. Then add recurring reminders to your calendar for your monthly report day and a quarterly strategy review.</p></div>`
};
