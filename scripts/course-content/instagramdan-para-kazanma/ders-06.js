'use strict';
module.exports = {
  slug: 'sozlesme-teslimat-ve-odeme-takibi',
  title_tr: 'Sözleşme, Teslimat, Kullanım Hakkı ve Ödeme Takibi',
  title_en: 'Contracts, Delivery, Usage Rights and Payment Tracking',
  summary_tr: 'Anlaşmayı yazılı hale getir: sözleşmede olması gereken maddeler, kullanım hakkının sınırları, taslaktan yayına teslimat akışı ve ödemelerini kaçırmamak için takip sistemi.',
  summary_en: 'Put the deal in writing: the clauses every contract needs, the limits of usage rights, a draft-to-publish delivery workflow and a tracking system so no payment slips through.',
  visual: {
    type: 'steps',
    title_tr: 'İmzadan ödemeye iş akışı',
    title_en: 'From signature to payment',
    items: [
      { tr: 'Sözleşmeyi imzala', en: 'Sign the agreement' },
      { tr: 'Brif ve taslak onayı', en: 'Brief and draft approval' },
      { tr: 'Etiketli yayın', en: 'Publish with disclosure' },
      { tr: 'Rapor ve fatura gönder', en: 'Send report and invoice' },
      { tr: 'Ödemeyi takip et', en: 'Track the payment' }
    ]
  },
  content_tr: `<p>Marka "tamam, anlaştık" dediğinde iş bitmiş gibi hissedilir; aslında asıl süreç yeni başlar. İçerik üreticilerin en sık yaşadığı sorunlar genellikle bu aşamada çıkar: bitmeyen revizyon talepleri, içeriğin anlaşılandan çok daha uzun süre reklamda kullanılması ya da aylarca gecikmeli ödeme. Bu sorunların çoğu, en başta her şeyin yazılı ve net olmasıyla önlenebilir.</p>
<p>Bu derste sözleşmede bulunması gereken maddeleri, kullanım hakkının nasıl tanımlanacağını, taslaktan yayına teslimat akışını ve ödemelerini takip edeceğin basit bir sistemi göreceksin.</p>
<!--GORSEL-->
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Dikkat</strong><p>Bu ders genel bilgi verir, hukuki danışmanlık yerine geçmez. Yüksek bütçeli, uzun süreli veya münhasırlık içeren anlaşmalarda sözleşmeyi imzalamadan önce bir avukata göstermen önerilir.</p></div>
<h2>Sözleşmede olması gereken maddeler</h2>
<p>Küçük işlerde ayrıntılı bir sözleşme yerine, tüm koşulları içeren ve iki tarafın da e-postayla onayladığı bir "iş onayı" belgesi kullanılabilir. Belgenin adı ne olursa olsun, aşağıdaki başlıkların net olması gerekir:</p>
<table class="crs-table blue">
<thead><tr><th>Madde</th><th>Ne yazmalı?</th><th>Önem</th></tr></thead>
<tbody>
<tr><td>Taraflar</td><td>Marka veya ajansın ticari unvanı, senin adın veya şirketin, iletişim bilgileri</td><td><span class="crs-badge good">Zorunlu</span></td></tr>
<tr><td>Teslimatlar</td><td>İçerik sayısı, türü, süresi, hangi hesapta yayınlanacağı</td><td><span class="crs-badge good">Zorunlu</span></td></tr>
<tr><td>Tarihler</td><td>Taslak teslim, onay ve yayın tarihleri</td><td><span class="crs-badge good">Zorunlu</span></td></tr>
<tr><td>Revizyon</td><td>Kaç revizyon hakkı olduğu ve ek revizyonun ücreti</td><td><span class="crs-badge good">Zorunlu</span></td></tr>
<tr><td>Kullanım hakkı</td><td>Kanal, süre, bölge ve içeriğin değiştirilip değiştirilemeyeceği</td><td><span class="crs-badge good">Zorunlu</span></td></tr>
<tr><td>Münhasırlık</td><td>Kapsanan rakipler, süre ve başlangıç tarihi</td><td><span class="crs-badge mid">Varsa</span></td></tr>
<tr><td>Ücret ve ödeme</td><td>Tutar, vergilerin dahil olup olmadığı, peşinat, vade, ödeme yöntemi</td><td><span class="crs-badge good">Zorunlu</span></td></tr>
<tr><td>Reklam etiketlemesi</td><td>İşbirliğinin hangi biçimde belirtileceği</td><td><span class="crs-badge good">Zorunlu</span></td></tr>
<tr><td>İptal</td><td>Marka iptal ederse yapılmış işin ve peşinatın durumu</td><td><span class="crs-badge mid">Önerilir</span></td></tr>
<tr><td>Gizlilik</td><td>Kampanya bilgisinin yayın tarihine kadar paylaşılmaması</td><td><span class="crs-badge mid">Önerilir</span></td></tr>
</tbody>
</table>
<h2>Kullanım hakkını doğru tanımlamak</h2>
<p>Kullanım hakkı, en çok yanlış anlaşılan konudur. Burada önemli bir ayrım var: <mark>markaya içeriği kullanma izni (lisans) vermek ile içeriğin tüm haklarını devretmek aynı şey değildir</mark>. Lisansta içerik senin olarak kalır; marka onu belirlenen kanalda, belirlenen süre boyunca kullanır. Hak devrinde ise içerik süresiz olarak markanın kontrolüne geçebilir ve bu, çok daha yüksek bir ücret gerektirir.</p>
<p>Kullanım hakkı maddesinde şu dört soru cevaplanmalı:</p>
<ul class="crs-checklist">
<li><strong>Kanal:</strong> Markanın organik hesapları mı, ücretli reklamlar mı, web sitesi mi, mağaza içi ekranlar mı?</li>
<li><strong>Süre:</strong> Yayın tarihinden itibaren kaç gün veya ay?</li>
<li><strong>Bölge:</strong> Yalnızca Türkiye mi, belirli ülkeler mi, tüm dünya mı?</li>
<li><strong>Değişiklik:</strong> Marka içeriği kesip biçebilir, üzerine metin veya müzik ekleyebilir mi?</li>
</ul>
<div class="crs-template"><span class="crs-template-label">Örnek madde</span><p>"Marka, teslim edilen 1 adet Reels içeriğini yayın tarihinden itibaren 90 gün boyunca, yalnızca Türkiye'de, kendi Instagram ve Facebook hesaplarında organik paylaşım ve ücretli reklam amacıyla kullanabilir. İçerikte kısaltma yapılabilir; içerik üreticinin sözlerinin anlamını değiştirecek düzenleme yapılamaz. Süre sonunda yeni reklam yayını başlatılmaz; süre uzatımı ayrıca ücretlendirilir."</p></div>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Bilgi</strong><p>Instagram'da markanın senin içeriğini reklam olarak kullanabilmesi için çoğu zaman uygulama içinde ayrıca izin vermen gerekir (ör. işbirliği reklamı izinleri). Bu izinlerin adı ve işleyişi yazıldığı tarihte (2026) bu şekilde; güncel adımları uygulama içindeki marka içeriği ayarlarından kontrol et ve izni sözleşmedeki süreyle uyumlu ver.</p></div>
<h2>Teslimat akışı</h2>
<ol class="crs-steps">
<li><strong>Brifi teyit et.</strong> Markanın mesajı, vurgulanacak 2-3 nokta, yasaklı ifadeler ve kullanılacak etiketler yazılı olarak elinde olsun. Anlamadığın noktaları çekimden önce sor.</li>
<li><strong>Taslak gönder.</strong> Senaryo veya kaba kurguyu, anlaşılan tarihte paylaş. Geri bildirimleri tek bir e-posta zincirinde topla.</li>
<li><strong>Revizyonları say.</strong> Her revizyon turunu kaydet. Anlaşılan sayı dolduğunda, ek revizyonun ücretli olduğunu kibarca hatırlat.</li>
<li><strong>Yazılı onay al.</strong> Yayından önce "Bu haliyle onaylıyoruz" ifadesini e-postayla al.</li>
<li><strong>Etiketleyerek yayınla.</strong> İşbirliği etiketini ve açıklamadaki reklam ibaresini eklediğinden emin ol; yayın linkini markaya ilet.</li>
<li><strong>Rapor gönder.</strong> Yayından 7 gün sonra erişim, etkileşim, kayıt ve hikaye görüntülenme verilerini ekran görüntüsüyle paylaş.</li>
</ol>
<div class="crs-callout tip"><strong class="crs-callout-title">💡 İpucu</strong><p>Kısa ve düzenli bir yayın sonrası rapor, markanın seni tekrar tercih etmesi için en güçlü sebeplerden biridir. Rakamların yanına bir-iki cümlelik gözlem ekle: "Yorumlarda en çok fiyat ve şube adresi soruldu."</p></div>
<h2>Ödeme takibi</h2>
<p>Ödemeler genellikle fatura veya ilgili belge iletildikten sonra, sözleşmede belirlenen vade içinde yapılır. Vadeyi takip etmek senin sorumluluğundadır. Basit bir tablo bu işi büyük ölçüde kolaylaştırır:</p>
<div class="crs-template"><span class="crs-template-label">Ödeme takip tablosu sütunları</span><p>Marka | İş tanımı | Yayın tarihi | Tutar (vergi hariç/dahil) | Peşinat alındı mı? | Fatura/belge tarihi | Vade tarihi | Ödeme durumu | Hatırlatma tarihleri | Not</p></div>
<p>Vade geçtiğinde ilk adım, kibar bir hatırlatmadır. Çoğu gecikme kötü niyetten değil, muhasebe süreçlerinden kaynaklanır.</p>
<div class="crs-template"><span class="crs-template-label">Ödeme hatırlatma şablonu</span><p>Merhaba [Kişinin adı], [tarih] tarihinde yayınlanan [iş tanımı] için [tarih] tarihinde ilettiğim [fatura/belge numarası] numaralı belgenin vadesi [vade tarihi] itibarıyla doldu. Ödemenin durumu hakkında bilgi verebilir misiniz? Gerekirse belgeyi tekrar iletebilirim. Teşekkürler!</p></div>
<h3>Peşinat ve iptal koşulları</h3>
<p>İlk kez çalıştığın bir markayla, toplam ücretin bir kısmını işe başlamadan önce peşinat olarak istemek yaygın ve makul bir uygulamadır. Peşinat oranını ve kalan tutarın ne zaman ödeneceğini sözleşmeye yaz. İptal maddesinde de şunu netleştir: marka çekimden sonra kampanyayı iptal ederse, o ana kadar yapılan iş için ne kadar ödeme yapılacak? Bu soruyu başta sormak, markayla aranı bozmadan emeğini korur. Hediye ürün karşılığı yapılan işlerde bile teslimatları, tarihleri ve kullanım hakkını kısa bir e-postayla yazılı hale getirmek iyi bir alışkanlıktır.</p>
<div class="crs-compare">
<div class="crs-compare-col bad"><strong class="crs-compare-title">❌ Riskli</strong><ul><li>DM'de "anlaştık" deyip çekime başlamak</li><li>Kullanım hakkı süresini yazmamak</li><li>Ödeme vadesini hiç konuşmamak</li></ul></div>
<div class="crs-compare-col good"><strong class="crs-compare-title">✅ Güvenli</strong><ul><li>Tüm koşulları e-postayla yazılı onaylatmak</li><li>Kanal, süre ve bölgeyi netleştirmek</li><li>Yeni markalarla peşinat istemek</li></ul></div>
</div>
<div class="crs-callout danger"><strong class="crs-callout-title">⛔ Bunu yapma</strong><p>Ödeme gecikti diye anlaşmalı içeriği habersiz silme ya da markayı herkese açık şekilde suçlama. Önce yazılı hatırlatma yap, sonra sözleşmedeki maddelere dayanarak resmi bir talep gönder. Sorun büyürse hukuki destek al.</p></div>
<p>Son derste bu sürecin yasal ve etik tarafını tamamlayacağız: reklam etiketlemesi, kayıt düzeni ve vergi konusunda dikkat etmen gerekenler. Ardından tüm eğitimi 60 günlük uygulanabilir bir gelir planına dönüştüreceğiz.</p>
<div class="crs-keypoints"><strong class="crs-callout-title">📌 Bu derste öğrendiklerin</strong><ul>
<li>Teslimatlar, tarihler, revizyon, kullanım hakkı, ücret ve etiketleme her anlaşmada yazılı olmalı.</li>
<li>Kullanım izni (lisans) ile hak devri farklıdır; kanal, süre, bölge ve değişiklik koşullarını netleştir.</li>
<li>Brif teyidi, taslak, sayılı revizyon, yazılı onay ve rapor, teslimatı düzenli hale getirir.</li>
<li>Ödeme takibi senin sorumluluğundadır; basit bir tablo ve kibar hatırlatma çoğu gecikmeyi çözer.</li>
<li>Büyük ve münhasırlık içeren anlaşmalarda hukuki destek almak akıllıcadır.</li>
</ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Görevin</strong><p>Tablodaki maddeleri kullanarak kendi "iş onayı" şablonunu hazırla ve kullanım hakkı için örnek maddeyi kendi koşullarınla yeniden yaz. Ardından ödeme takip tablonu oluştur; yayın sonrası rapor için de kısa bir şablon hazırla.</p></div>`,
  content_en: `<p>When a brand says "great, we have a deal", it feels like the job is done; in reality the main process is just beginning. The problems creators run into most often tend to show up at this stage: endless revision requests, content used in ads far longer than agreed, or payments that arrive months late. Most of these can be prevented by making everything clear and written from the start.</p>
<p>In this lesson you will see the clauses a contract needs, how to define usage rights, a draft-to-publish delivery workflow and a simple system for tracking your payments.</p>
<!--GORSEL-->
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Watch out</strong><p>This lesson provides general information and is not legal advice. For high-budget, long-term or exclusive deals, it is wise to have a lawyer review the contract before you sign.</p></div>
<h2>Clauses every contract needs</h2>
<p>For small jobs, instead of a detailed contract you can use a "work confirmation" that lists all terms and that both sides approve by email. Whatever the document is called, the following points need to be clear:</p>
<table class="crs-table blue">
<thead><tr><th>Clause</th><th>What to include</th><th>Priority</th></tr></thead>
<tbody>
<tr><td>Parties</td><td>The brand's or agency's legal name, your name or company, contact details</td><td><span class="crs-badge good">Required</span></td></tr>
<tr><td>Deliverables</td><td>Number, format and length of content, which account it goes on</td><td><span class="crs-badge good">Required</span></td></tr>
<tr><td>Dates</td><td>Draft, approval and publish dates</td><td><span class="crs-badge good">Required</span></td></tr>
<tr><td>Revisions</td><td>How many revision rounds are included and the fee for extra ones</td><td><span class="crs-badge good">Required</span></td></tr>
<tr><td>Usage rights</td><td>Channel, duration, region and whether the content can be edited</td><td><span class="crs-badge good">Required</span></td></tr>
<tr><td>Exclusivity</td><td>Competitors covered, duration and start date</td><td><span class="crs-badge mid">If any</span></td></tr>
<tr><td>Fee and payment</td><td>Amount, whether taxes are included, deposit, due date, payment method</td><td><span class="crs-badge good">Required</span></td></tr>
<tr><td>Ad disclosure</td><td>How the partnership will be disclosed</td><td><span class="crs-badge good">Required</span></td></tr>
<tr><td>Cancellation</td><td>What happens to completed work and the deposit if the brand cancels</td><td><span class="crs-badge mid">Recommended</span></td></tr>
<tr><td>Confidentiality</td><td>Not sharing campaign details before the publish date</td><td><span class="crs-badge mid">Recommended</span></td></tr>
</tbody>
</table>
<h2>Defining usage rights properly</h2>
<p>Usage rights are the most misunderstood part of any deal. There is an important distinction here: <mark>granting a brand permission to use your content (a license) is not the same as transferring all rights to it</mark>. With a license, the content stays yours; the brand uses it on agreed channels for an agreed period. With a full transfer, the content may pass into the brand's control indefinitely, which calls for a much higher fee.</p>
<p>Your usage rights clause should answer four questions:</p>
<ul class="crs-checklist">
<li><strong>Channel:</strong> The brand's organic accounts, paid ads, website or in-store screens?</li>
<li><strong>Duration:</strong> How many days or months from the publish date?</li>
<li><strong>Region:</strong> One country, specific countries or worldwide?</li>
<li><strong>Edits:</strong> Can the brand cut the content or add text or music to it?</li>
</ul>
<div class="crs-template"><span class="crs-template-label">Sample clause</span><p>"The Brand may use the 1 delivered Reel for 90 days from the publish date, in [country] only, on its own Instagram and Facebook accounts for organic posting and paid advertising. The content may be shortened; it may not be edited in a way that changes the meaning of the creator's words. No new ad campaigns may start after the term ends; any extension is priced separately."</p></div>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Good to know</strong><p>For a brand to run your content as an ad on Instagram, you often need to grant a separate in-app permission (for example, partnership ad permissions). The names and workings of these permissions are accurate as of writing (2026); check the current steps in the branded content settings in the app, and grant permission for a period that matches your contract.</p></div>
<h2>Delivery workflow</h2>
<ol class="crs-steps">
<li><strong>Confirm the brief.</strong> Have the brand's message, the 2 or 3 points to highlight, forbidden phrases and required tags in writing. Ask about anything unclear before you shoot.</li>
<li><strong>Send a draft.</strong> Share the script or rough cut on the agreed date. Keep all feedback in a single email thread.</li>
<li><strong>Count revisions.</strong> Log each revision round. Once the agreed number is used up, politely remind the brand that extra rounds are billable.</li>
<li><strong>Get written approval.</strong> Before publishing, get "approved as is" by email.</li>
<li><strong>Publish with disclosure.</strong> Make sure the paid partnership label and the ad wording in the caption are in place; send the brand the post link.</li>
<li><strong>Send a report.</strong> Seven days after publishing, share reach, engagement, saves and Story views with screenshots.</li>
</ol>
<div class="crs-callout tip"><strong class="crs-callout-title">💡 Tip</strong><p>A short, consistent post-campaign report is one of the strongest reasons a brand will choose you again. Add a line or two of observation next to the numbers: "Most comments asked about price and store locations."</p></div>
<h2>Payment tracking</h2>
<p>Payments are usually made within the agreed term after you send an invoice or the relevant document. Keeping track of due dates is your responsibility. A simple spreadsheet makes this much easier:</p>
<div class="crs-template"><span class="crs-template-label">Payment tracker columns</span><p>Brand | Job description | Publish date | Amount (excl./incl. tax) | Deposit received? | Invoice date | Due date | Payment status | Reminder dates | Notes</p></div>
<p>When a payment is overdue, the first step is a polite reminder. Most delays come from accounting processes, not bad intentions.</p>
<div class="crs-template"><span class="crs-template-label">Payment reminder template</span><p>Hi [Contact name], the invoice [invoice number] I sent on [date] for [job description], published on [date], was due on [due date]. Could you let me know the status of the payment? I am happy to resend the invoice if needed. Thank you!</p></div>
<h3>Deposits and cancellation terms</h3>
<p>With a brand you are working with for the first time, asking for part of the total fee as a deposit before you start is a common and reasonable practice. Write the deposit share and the due date for the balance into the contract. In the cancellation clause, make one thing clear: if the brand cancels the campaign after the shoot, how much will be paid for the work done so far? Asking this upfront protects your work without straining the relationship. Even for gifted-product deals, putting deliverables, dates and usage rights into a short email is a good habit.</p>
<div class="crs-compare">
<div class="crs-compare-col bad"><strong class="crs-compare-title">❌ Risky</strong><ul><li>Saying "deal" in a DM and starting to shoot</li><li>Leaving usage rights duration unwritten</li><li>Never discussing payment terms</li></ul></div>
<div class="crs-compare-col good"><strong class="crs-compare-title">✅ Safe</strong><ul><li>Getting all terms approved in writing by email</li><li>Clarifying channel, duration and region</li><li>Asking new brands for a deposit</li></ul></div>
</div>
<div class="crs-callout danger"><strong class="crs-callout-title">⛔ Don't do this</strong><p>Do not delete contracted content without notice or publicly blame the brand because a payment is late. Send a written reminder first, then a formal request referencing the contract terms. If the issue escalates, get legal support.</p></div>
<p>In the final lesson we will complete the legal and ethical side of this process: ad disclosure, record keeping and what to watch for with taxes. Then we will turn the whole course into a practical 60-day income plan.</p>
<div class="crs-keypoints"><strong class="crs-callout-title">📌 Key takeaways</strong><ul>
<li>Deliverables, dates, revisions, usage rights, fee and disclosure should be in writing for every deal.</li>
<li>A usage license differs from a rights transfer; clarify channel, duration, region and editing terms.</li>
<li>Brief confirmation, drafts, counted revisions, written approval and a report keep delivery on track.</li>
<li>Payment tracking is your responsibility; a simple sheet and a polite reminder solve most delays.</li>
<li>For large or exclusive deals, getting legal support is the smart move.</li>
</ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Your task</strong><p>Using the clauses in the table, create your own "work confirmation" template and rewrite the sample usage rights clause with your own terms. Then set up your payment tracker and prepare a short template for your post-campaign report.</p></div>`
};
