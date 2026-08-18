# GEO Denetim Raporu: SMMJET (jetsmmpanel.com)

**Denetim Tarihi:** 18 Ağustos 2026
**URL:** https://jetsmmpanel.com
**İşletme Tipi:** E-ticaret / SaaS melezi (SMM panel — sosyal medya büyüme hizmetleri satışı)
**Analiz Edilen Sayfa:** 21 (sitemap) + robots.txt, llms.txt, dizin sorguları, marka taraması
**Yöntem:** 5 paralel uzman ajan (AI görünürlük, platform, teknik, içerik E-E-A-T, şema) — canlı site üzerinde, JS çalıştırılmadan ham HTML doğrulamalı

---

## Yönetici Özeti

**Genel GEO Skoru: 47/100 (Zayıf)**

Teknik altyapı sektör ortalamasının çok üzerinde (91/100): sunucu tarafı render, AI botlarına açık robots.txt, llms.txt, JSON-LD ve önbellek stratejisi hazır. Siteyi aşağı çeken şey teknik değil, **görünürlük ve güven**: marka açık web'de fiilen yok (5/100), site dizinlerde neredeyse görünmüyor ve içerikte kimlik/kanıt sinyalleri (yazar, kaynak, vaka verisi) eksik. Kısacası: ev sağlam, ama haritada yok.

### Skor Dağılımı

| Kategori | Skor | Ağırlık | Ağırlıklı Puan |
|---|---|---|---|
| AI Alıntılanabilirlik (Citability) | 64/100 | %25 | 16,0 |
| Marka Otoritesi | 5/100 | %20 | 1,0 |
| İçerik E-E-A-T | 33/100 | %20 | 6,6 |
| Teknik GEO | 91/100 | %15 | 13,7 |
| Şema & Yapılandırılmış Veri | 47/100 | %10 | 4,7 |
| Platform Optimizasyonu | 48/100 | %10 | 4,8 |
| **GENEL GEO SKORU** | | | **47/100** |

Platform bazında hazırlık: Google AI Overviews 54, Perplexity 54, ChatGPT 48, Bing Copilot 47, Gemini 35.

---

## Kritik Sorunlar (Hemen Düzelt)

1. **Marka adı çakışması: "SMMJET" başka firmalara ait.** `smmjet.com`, `smmjet.org`, `smmjet.site` aynı sektörde yerleşik, ayrı şirketler. Bir AI'ya "SMMJET nedir?" sorulduğunda rakibi anlatma ihtimali yüksek. Marka adı (SMMJET) ile alan adı (jetsmmpanel.com) uyuşmazlığı varlık sinyalini ikiye bölüyor.
   → *Çözüm:* Marka stratejisi kararı (ya "Jet SMM Panel" adına konsolidasyon ya da her yüzeyde tutarlı "SMMJET (jetsmmpanel.com)" bağlaması) + Organization şemasına `alternateName: ["Jet SMM Panel", "jetsmmpanel.com"]`.

2. **Sıfır dış marka varlığı.** Wikipedia, Reddit, YouTube, LinkedIn, Trustpilot, Türk webmaster forumları — hiçbirinde iz yok. AI modelleri markayı varlık olarak tanımıyor; site içeriği ne kadar iyi olursa olsun marka sorgularında alıntılanamaz.
   → *Çözüm:* Sıralı inşa — LinkedIn şirket sayfası (1 gün), kurumsal X/Instagram/YouTube hesapları, Trustpilot profili + müşteri daveti, R10.net/wmaraci gibi Türk forumlarında gerçek katılım.

3. **Dizin varlığı neredeyse sıfır.** Bing/DuckDuckGo'da `site:jetsmmpanel.com` yalnızca ana sayfayı döndürüyor; /services, /blog ve 11 blog yazısı dizinde yok. Dizinde olmayan sayfa hiçbir AI platformunda alıntılanamaz. (Site çok yeni — beklenen durum, ama hızlandırılabilir.)
   → *Çözüm:* Google Search Console + Bing Webmaster Tools'a sitemap gönder, blog URL'lerini elle dizin talebine sok, IndexNow entegrasyonu ekle (BWT doğrulaması zaten yapılmış, sadece API entegrasyonu eksik).

4. **`localhost:3000/api/v2` sızıntısı.** /services ve /api-docs sayfalarının ham HTML'inde API taban adresi 6+ kez `localhost:3000` olarak geçiyor (JS açılınca düzeliyor ama botlar ham hali görüyor). AI bir kullanıcıya API entegrasyonu anlatırken yanlış URL verecek.
   → *Çözüm:* Sunucu tarafında `PUBLIC_BASE_URL` ile değiştir (tek satırlık düzeltme — `public/index.html` API doküman bloğu + `app.js:598`'deki istemci düzeltmesinin sunucu karşılığı).

5. **`sameAs` fiilen boş.** Organization şemasında tek bağlantı var, o da kişisel Telegram profili (`t.me/ilhanseyhan`). Admin paneldeki `social_instagram`, `social_x`, `social_youtube` alanları tanımlı ama **doldurulmamış** — kod hazır, veri eksik.
   → *Çözüm:* Kurumsal profilleri açıp admin panele gir; llms.txt'teki iletişimi de kurumsal kanala çevir.

6. **Deneyim kanıtı sıfır (E-E-A-T).** Hiçbir blog yazısında ekran görüntüsü, vaka çalışması, önce/sonra verisi yok; "12.000+ kullanıcı", "6 saniyede başlar" iddiaları kaynaksız.
   → *Çözüm:* Panelin gerçek (anonimleştirilmiş) verisinden 2-3 vaka çalışması — sitenin sahip olup hiç kullanmadığı en güçlü koz.

## Yüksek Öncelikli Sorunlar (1 Hafta İçinde)

7. **/services fiyat tablosu satırları SSR değil** — tablo başlıkları ham HTML'de var ama hizmet adı/fiyat satırları JS ile doluyor. Sitenin en alıntılanabilir birincil verisi (fiyat listesi) botlara görünmüyor. Blog listeleme sayfasında da benzer durum (placeholder şablon dönüyor).
8. **Yazar kimliği yok.** Tüm yazılar anonim "SMMJET Editör Ekibi"; Person şeması, biyografi, dış profil yok. AI ve Google için alıntılanabilirliği en çok düşüren faktörlerden.
9. **FAQPage şeması ve ana sayfa/services'te SSS bölümü yok.** Bloglarda SSS var ama işaretlenmemiş. (Not: Google FAQ yıldızı artık vermiyor; değer AI modellerinin soru-cevap çıkarımında.)
10. **Service/OfferCatalog şeması yok** — fiyatlı hizmet satan sitede teklif verisi yapısal olarak hiç beyan edilmemiş; fiyatlar DB'de hazır, dinamik üretilebilir.
11. **`site_name` ayarında sondaki boşluklar** → `<title>| SMMJET  `, şemada `"SMMJET  "` vs `"SMMJET"` tutarsız varlık adları. Düzeltme: blog rotasındaki site adı değeri trim edilmeli (`server.js` blog rotası) + DB'deki değer temizlenmeli.
12. **Dış kaynak/atıf neredeyse sıfır.** 4 yazıda toplam 2 dış link; "%3 takip oranı", "3-6 hafta" gibi rakamlar kaynaksız. Her yazıya 3-5 otorite kaynağı (platform resmi dokümanları) eklenmeli.
13. **Sosyal kanıt yok** — tek bir müşteri yorumu/puanı yok. Gerçek yorum toplama mekanizması kurulmalı (yapay yorum ASLA — AggregateRating'i ancak görünür gerçek yorumlarla ekleyin).
14. **AI-şablon içerik dili.** Bloglar "hafif düzenlenmiş AI" profili veriyor; özgün veri/Türkiye pazarı gözlemi/başarısızlık örneğiyle ayrıştırılmalı.
15. **IndexNow yok** — Bing/Copilot için en hızlı dizinlenme kanalı; blog yayınlama akışına tek POST eklemek yeterli.

## Orta Öncelikli Sorunlar (1 Ay İçinde)

16. Blog meta description'ları kelime ortasında kesiliyor ("...izlenmenin farkı ve") — `utils/metaDescription.js` son tam cümlede bitirmeli.
17. Ana sayfa H1 slogan ("AKIŞTA KAL. ÖNDE KAL.") — AI için sıfır bilgi. H1 altına tanım paragrafı: *"SMMJET (jetsmmpanel.com), Instagram, TikTok, YouTube ve X için takipçi, beğeni ve izlenme hizmetleri sunan Türkçe bir SMM panelidir..."*
18. `llms-full.txt` yok (404); llms.txt'te 5 link açıklamasız, iletişim kişisel Telegram.
19. Risk beyanı yumuşak — satın alma rehberlerine açık uyarı kutusu + ticari çıkar beyanı güveni yükseltir.
20. `speakable` şeması yok; /blog'da Blog/ItemList şeması yok; BreadcrumbList yalnız blog yazılarında.
21. Blog kapak görselleri Unsplash hotlink (800px) — kendi domain'den 1200px+ servis edilmeli; `article:published_time`/`twitter:site` OG etiketleri eksik.
22. About sayfasında kurumsal kimlik eksik: yasal unvan, kurumsal e-posta, kuruluş yılı; `contactPoint.email` boş (`support_email` ayarı doldurulmalı).
23. EN içerik aynı URL'de client-side toggle — hreflang'li ayrı URL yapısı daha temiz (uzun vade).

## Düşük Öncelikli Sorunlar

24. Trailing slash 301 yok (`/services/` 200 dönüyor; canonical doğru olduğundan risk düşük).
25. Sitemap'te 10 statik sayfada `lastmod` yok; HSTS `preload` eksik.
26. `Referrer-Policy: no-referrer` — dış linklere referrer gitmiyor; `strict-origin-when-cross-origin` marka atıfı için daha dengeli.
27. CSP `script-src`'de `unsafe-inline`; XFO/CSP frame politikası tutarsızlığı (kozmetik).
28. Yeni blog slug'larında rastgele ID ekleri (`-msx2obdc`) — yeni içerikte saf slug tercih edilebilir.
29. llms.txt'te `## Optional` bölümü ve blockquote'ta küçük yazım düzensizliği.

---

## Kategori Derinlemesine Bakış

### AI Alıntılanabilirlik (64/100)
Bloglar sitenin en güçlü varlığı (~78/100): soru formatlı H2'ler, SSS blokları, tablolar, sayısal iddialar. Örnek güçlü pasaj: *"Kaydetme, beğenmeden çok daha güçlü bir sinyaldir; içeriğin kalıcı değer taşıdığını gösterir."* (≈82 puan). Ana sayfa ise ~35: slogan başlıklar ("SİPARİŞ MAKİNESİ HAZIR") bilgi taşımıyor, istatistik kutuları bağlamsız. İyileştirme: tanım blokları, soru formatlı bölüm başlıkları, statik metrik cümleleri.

### Marka Otoritesi (5/100)
Wikipedia (EN+TR API doğrulamalı), Reddit, YouTube, LinkedIn, Trustpilot, forumlar: **tamamen boş**. "jetsmmpanel" araması ilgili sonuç döndürmüyor. En büyük yapısal engel SMMJET isim çakışması. Yol haritası: LinkedIn → Trustpilot → YouTube → Türk forumları → (orta vade) Wikidata.

### İçerik E-E-A-T (33/100)
Deneyim 6/25, Uzmanlık 8/25, Otorite 7/25, Güven 12/25. Yapı güçlü (1.400-3.200 kelime, temiz hiyerarşi, tazelik 5/5) ama kimlik/kanıt sıfır: anonim yazar, kaynaksız istatistik, vaka verisi yok, kurumsal kimlik eksik. Tüm yazıların aynı güne tarihlenmesi (13 Ağustos) toplu üretim sinyali.

### Teknik GEO (91/100)
Kritik/yüksek bulgu yok. SSR tam çalışıyor (blog gövdesi ham HTML'de ~33K karakter), brotli + HTTP/3, immutable cache + ?v= sürümleme, eksiksiz güvenlik başlıkları, gerçek 404, tek adımlı 301'ler, AI botlarına açık robots.txt + llms.txt. Küçükler: meta description kesimi, site_name boşlukları, trailing slash, lastmod.

### Şema & Yapılandırılmış Veri (47/100)
Mevcut: Organization + WebSite (her sayfa), BlogPosting + BreadcrumbList (blog) — hepsi geçerli JSON-LD, SSR'da basılıyor. Eksik: FAQPage, Service/OfferCatalog, Person, speakable, Blog/ItemList, AboutPage. `sameAs` tek kişisel link. Rapor ekinde uygulamaya hazır JSON-LD şablonları mevcut (ajan çıktısında).

### Platform Optimizasyonu (48/100)
AIO 54 / Perplexity 54 / ChatGPT 48 / Copilot 47 / Gemini 35. Ortak paydalar: dizin tabanı zayıf, varlık tanıma yok, topluluk sinyali yok. Gemini'nin düşüklüğü Google ekosistem boşluğundan (YouTube, GBP, Knowledge Graph). Sinerji: kurumsal profiller + IndexNow + FAQ deseni + fiyat SSR'ı dört platformu birden yükseltir.

---

## Hızlı Kazanımlar (Bu Hafta)

1. **`localhost:3000` sızıntısını düzelt** — tek satır, anında etki (kod: sunucu tarafında base URL değişimi).
2. **`site_name` boşluklarını temizle** (DB + blog rotasına trim) — tüm şema/title tutarlılığı düzelir.
3. **GSC + BWT'ye sitemap gönder, blog URL'lerine elle dizin talebi** — dizin sorununun ilk adımı (panel işi, 30 dk).
4. **Kurumsal sosyal profilleri aç ve admin panele gir** — `sameAs` kendiliğinden dolar (kod hazır).
5. **Organization şemasına `alternateName` + `contactPoint.email` ekle** — marka çakışmasına ilk müdahale.
6. **Ana sayfaya FAQPage şemalı SSS bölümü ekle** (6-8 soru: "SMM panel nedir?", "Sipariş ne kadar sürede başlar?"...).
7. **Meta description üreticisini tam cümlede kesecek şekilde düzelt.**

## 30 Günlük Aksiyon Planı

### Hafta 1: Teknik temizlik + dizin tabanı
- [ ] localhost sızıntısı, site_name trim, meta description kesimi (kod)
- [ ] GSC/BWT sitemap gönderimi + URL dizin talepleri
- [ ] IndexNow entegrasyonu (anahtar dosyası + blog yayınında ping)
- [ ] Kurumsal sosyal hesapların açılması + admin panele girilmesi

### Hafta 2: Şema ve SSS
- [ ] Ana sayfa + /services'e görünür SSS bölümü + FAQPage JSON-LD
- [ ] Service + OfferCatalog şeması (DB'deki fiyatlardan dinamik)
- [ ] Organization: alternateName, foundingDate, email; publisher @id referansı
- [ ] /services fiyat tablosunun ilk satırlarının (veya kategori özet tablosunun) SSR'a alınması

### Hafta 3: İçerik kimliği
- [ ] Yazar profili: gerçek isim + biyografi bloğu + Person şeması + yazar sayfası
- [ ] Mevcut 11 yazıya 3-5'er dış otorite kaynağı
- [ ] Ana sayfa H1 altına tanım paragrafı; bölüm başlıklarını soru formatına çevirme
- [ ] llms.txt: kurumsal iletişim, link açıklamaları, llms-full.txt üretimi

### Hafta 4: Kanıt ve otorite
- [ ] Panel verisinden 2-3 vaka çalışması / istatistik yazısı (özgün veri = Perplexity yemi)
- [ ] Trustpilot profili + gerçek müşteri yorumu daveti akışı
- [ ] Türk webmaster forumlarında (R10, wmaraci) marka katılımı
- [ ] Blog kapak görsellerini kendi domain'e alma; speakable + Blog şeması

---

## Ek: Analiz Edilen Sayfalar

| URL | Not |
|---|---|
| / | Citability ~35 — slogan ağırlıklı, tanım bloğu yok |
| /services | Fiyat satırları SSR değil; Service şeması yok |
| /blog | Liste istemci tarafında dolduruluyor |
| /about | Kurumsal kimlik eksik |
| /api-docs | localhost:3000 sızıntısı |
| /register, /terms, /privacy, /refund | Sağlam; yasal sayfalar tarihli, EN+TR |
| 11 blog yazısı | En güçlü varlık (~78 citability); yazar/kaynak eksik |

*Rapor, geo-seo-claude denetim iskeletiyle 5 paralel uzman ajan tarafından üretilmiştir. Skorlar 18 Ağustos 2026 anlık durumunu yansıtır; dizin ve marka sinyalleri zamanla doğal olarak iyileşir.*
