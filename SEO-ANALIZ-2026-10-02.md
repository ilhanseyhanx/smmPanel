# Site ve İçerik Durum Raporu — 2 Ekim 2026

Kaynaklar:
- Search Console dışa aktarımları (Performans, Dizin, HTTPS, İçerik haritası, Bağlantılar). Performans verisi 13 Ağu – 29 Eyl (48 gün), dizin verisi 21 Eyl'e kadar.
- Sitenin kendi veritabanı (salt-okunur sorgu, 2 Eki): ziyaretçi, bot, sipariş ve 94 içeriğin (46 blog + 48 satış sayfası) ölçümü.
- Canlı sitenin 20 sayfasının HTML ölçümü (2 Eki).

Önceki rapor: [SEO-ANALIZ-2026-09-20.md](SEO-ANALIZ-2026-09-20.md)

---

## Özet

1. **Yükseliş var, ama GSC'ye geç yansıyor.** Haftalık gösterim 52 → 56 → 91 → 180 oldu. Satış sayfalarının gösterimi 12 günde 119'dan 339'a çıktı. Son haftada yayınladığın sayfalar bu verinin içinde henüz yok.
2. **En büyük teknik-içerik sorunu:** Her sayfanın HTML'inde, o sayfaya ait olmayan yaklaşık 670 kelimelik gizli ortak metin var. 20 Eylül'de `/services` ve `/blog` görünümlerine eklenen SEO metinleri 93 adresin hepsine gidiyor.
3. **Eski satış sayfalarının özgün metni çok kısa.** 44 yayındaki satış sayfasının 20'sinde gövde metni 200 kelimenin altında. Para kazandıran sayfalar bunlar.
4. **Bugün çalıştırdığımız Gün 12 revizyonu bir yan etki üretti:** 4 takipçi sayfasına aynı 190 kelimelik blok eklendi; sayfalar arası benzerlik %0-2'den %18-28'e çıktı. Bloklar sayfaya özgü yeniden yazılmalı.
5. **İki sayfada satılacak servis yok, en çok satan sayfada tek servis var.** İçerik ile katalog birbirinden kopmuş.
6. **Site içi istatistikler şişkin.** Günlük 150-200 "tekil ziyaretçi"nin çoğu tarayıcı botu. Aramadan gelen gerçek ziyaretçi günde yaklaşık 1.
7. **Hangi sayfanın müşteri getirdiğini ölçemiyoruz.** Kayıtta kaynak bilgisi tutulmuyor. İleriye dönük en değerli geliştirme bu.

---

## 1. Search Console ne diyor

### Haftalık gidiş

| Hafta | Gösterim | Tıklama | Ağırlıklı pozisyon |
|---|---|---|---|
| 2 – 8 Eyl | 52 | 0 | 29,3 |
| 9 – 15 Eyl | 56 | 1 | 38,6 |
| 16 – 22 Eyl | 91 | 4 | 46,3 |
| 23 – 29 Eyl | 180 | 4 | 29,7 |

Dönem toplamı: 670 gösterim, 26 tıklama. Türkiye: 455 gösterim, 23 tıklama.

### Sayfa tipine göre (20 Eyl raporuyla karşılaştırma)

| Tip | 17 Eyl'e kadar | 29 Eyl'e kadar | Tıklama | Pozisyon |
|---|---|---|---|---|
| Ana sayfa | 208 gösterim | 226 | 16 | 5,3 |
| Blog | 256 | 289 | 7 | 15,1 |
| Satış sayfaları | 119 | **339** | 3 | 39,7 |

Büyüme satış sayfalarından geliyor. `turk-takipci-satin-al` 23 Eylül'de yayınlandı, bir hafta içinde 10 gösterim ve 1 tıklama aldı.

### Dizin durumu (21 Eyl itibarıyla)

| Durum | 17 Eyl | 21 Eyl |
|---|---|---|
| Dizine eklendi | 51 | 60 |
| Keşfedildi, eklenmedi | 17 | 17 |
| Tarandı, eklenmedi | 10 | 5 |
| noindex (kasıtlı) | 2 | 3 |
| Yönlendirmeli | 0 | 1 |

Site haritasında şu an 93 adres var.

### "Neden tam yansımamış?"

Üç sebep var, üçü de normal:

- **Veri gecikmesi.** Performans dosyası 29 Eylül'de, dizin dosyası 21 Eylül'de bitiyor. 25 Eylül – 2 Ekim arasında yayınladığın 8 satış sayfası ve 2 blog yazısı bu verilerde yok.
- **Googlebot yavaş geziyor.** Son 13 günde Googlebot'un başarılı sayfa isteği 68, yani günde yaklaşık 5. Bu hızla 93 adresin tamamını yeniden gezmesi 2-3 hafta sürer. Bugünkü revizyonun etkisi de bu sürede görünür.
- **Yeni sayfalar 50-70. sıradan başlıyor.** Panel sayfaları (`instagram-smm-panel` 70,9; `twitter-smm-panel` 52; `youtube-smm-panel` 64) yayınlanalı 1-2 hafta oldu. "Panel" içeren marka dışı sorgular 20'den 42'ye, gösterimleri 64'ten 142'ye çıktı; ortalama sıra 56.

### İlk sayfada olup tıklama almayanlar

| Sorgu | Gösterim | Tıklama | Pozisyon | Sayfa |
|---|---|---|---|---|
| twitch izleyici satın al | 51 | 0 | 5,4 | `twitch-izleyici-satin-al` |
| instagram otomatik kaydetme satın al | 13 | 0 | 9,5 | `instagram-kaydetme-satin-al` |
| panel sitesi | 11 | 0 | 6,2 | ana sayfa |
| x görüntülenme satın al | 10 | 0 | 7,7 | `twitter-goruntulenme-satin-al` |

Bunlar en ucuz kazanç: sayfa zaten ilk sayfada, başlık ve açıklama iyileştirmesi yeter (bkz. 3.8).

### Dış bağlantı

GSC'de 5 alan adından 9 bağlantı görünüyor: about.me, nowfound.app, smmtanitim.com, r10.net (3 konu), wmaraci.com (3 konu). "Panel" sorgularında 50-70. sıradan ilk 10'a çıkışı asıl belirleyecek şey bu sayı; içerik tek başına yetmez.

---

## 2. Site içi istatistikler ne diyor

### Ziyaretçi sayacı güvenilir değil

Panelde 16 Ağustos'tan beri 5.864 tekil ziyaretçi, günde 150-200 görünüyor. Bu rakamın çoğu insan değil:

- Giriş sayfaları listesinde `/xmlrpc.php` (28), `/wordpress` (14), `/backup` (14), `/.git/config` (12), `/.env` (12) var. Bunlar açık arayan tarayıcı botları; tarayıcı kimliğiyle geldikleri için bot filtresinden geçiyorlar.
- Ziyaretçilerin %84'ü (4.928) yalnızca tek bir gün görülmüş.
- 30 Eylül'den beri "yönlendiren" kanalı sahte kaynaklarla doluyor: `*backlink*.shop`, `*linkbuilding*.space` gibi 55-60 alan adı, hepsi aynı `/dir/high-quality-backlinks-106402` yolundan. Bu referans spam'i; tıklama, yanıt verme.

### Gerçek tablo (20 Eyl – 2 Eki, kaynak takibi açıldığından beri 13 gün)

| Kaynak | Tekil ziyaretçi |
|---|---|
| Google | 11 |
| Bing | 2 |
| r10.net | 6 |
| smmtanitim.com | 5 |
| Product Hunt, nowfound, t.co, Facebook | 1'er |
| Doğrudan (müşteri + bot + bilinmeyen karışık) | ~1.570 |

Aramadan gelen 14 ziyaretçinin 12'si ana sayfaya inmiş. GSC'deki haftalık 4 tıklamayla uyumlu.

### Bot paneli de kirli

"Googlebot 377 istek" görünüyor ama 185'i 404: `/.env.local`, `/key.pem`, `/actuator/mappings` gibi yollar. Bunlar kendini Googlebot diye tanıtan tarayıcılar. Gerçek Googlebot'un 21 günde başarılı isteği 183.

Aynı dönemde GPTBot 216, ClaudeBot 105 başarılı sayfa çekmiş. Yapay zekâ botları siteyi Googlebot'tan daha sık okuyor; llms.txt ve robots izinleri çalışıyor. (Kimlik tarayıcı adına dayanıyor, doğrulanmış değil.)

### Satış tarafı

| Hafta başı | Yeni kayıt | Sipariş | Sipariş veren | Ciro (TL) |
|---|---|---|---|---|
| 31 Ağu | 7 | 10 | 6 | 1.754 |
| 7 Eyl | 10 | 32 | 7 | 3.832 |
| 14 Eyl | 15 | 102 | 11 | 4.605 |
| 21 Eyl | 7 | 29 | 7 | 706 |
| 28 Eyl | 0 | 18 | 3 | 2.130 |

Toplam: 61 kayıtlı kullanıcı, 35'i sipariş vermiş, 224 sipariş, yaklaşık 15.400 TL. Son kayıt 27 Eylül'de.

En çok satanlar:

| Kategori | Sipariş | Ciro (TL) |
|---|---|---|
| YouTube Abone | 80 | 4.065 |
| Twitter Takipçi | 27 | 3.854 |
| Instagram Takipçi | 15 | 1.754 |
| TikTok Takipçi | 10 | 606 |
| Instagram Beğeni | 9 | 513 |

Arama henüz satışın kaynağı değil: günde 1 arama ziyaretçisiyle 14 Eylül haftasındaki 102 sipariş açıklanamaz. Müşteri büyük olasılıkla forumlardan ve doğrudan geliyor. Kesin söyleyemiyoruz çünkü kayıtta kaynak tutulmuyor (bkz. 4.1).

---

## 3. İçerik sorunları (öncelik sırasıyla)

### 3.1 Her sayfada 670 kelimelik gizli ortak metin — YÜKSEK

20 Eylül'de `/services` görünümüne "SMM panel fiyat listesi nasıl okunur?" metni, `/blog` görünümüne giriş metni ve 45 linklik hizmet sayfaları şeridi eklendi. Bu iki görünüm, 8 Eylül'deki ayıklama işinde "boş kabuk" sayılıp her adreste bırakılmıştı ([utils/gatedMarkup.js:107-110](utils/gatedMarkup.js#L107-L110)). Artık boş değiller.

Canlı ölçüm:

| Sayfa | Kendi içeriği | Gizli ortak metin |
|---|---|---|
| `/twitch-izleyici-satin-al` | 470 kelime | 668 kelime |
| `/instagram-kanal-uye-satin-al` | 618 | 668 |
| `/blog/drip-feed-nedir-kademeli-teslimat` | 738 | 668 |

Yani eski satış sayfalarında HTML'deki metnin yarıdan fazlası başka sayfaya ait, `display:none` ile gizli ve 93 adreste birebir aynı. 8 Eylül'de çözdüğümüz sorunun aynısı geri geldi. Ayrıca kaynak kodda iç notlar ("Google bunu değer katmayan liste sayıyordu... Bkz. SEO-ANALIZ...") herkese açık duruyor.

Çözüm küçük bir kod işi: bu metin bloklarını işaretleyip yalnızca kendi adreslerinde göndermek.

### 3.2 Eski satış sayfalarının özgün metni çok kısa — YÜKSEK

27 Ağu – 18 Eyl arasında yayınlanan 31 satış sayfasında gövde metni 97-374 kelime, SSS 80-216 kelime. 20 sayfa 200 kelimenin altında. 27'sinde metin içinde tek bir link yok.

| Sayfa | Gövde (kelime) | GSC |
|---|---|---|
| `soundcloud-dinlenme-satin-al` | 97 | — |
| `kick-takipci-satin-al` | 103 | — |
| `pinterest-takipci-satin-al` | 104 | 34 gösterim, poz 31,8 |
| `tiktok-begeni-satin-al` | 114 | 12 gösterim, poz 34,5 |
| `twitch-izleyici-satin-al` | 136 | 58 gösterim, poz 5,6 |
| `instagram-izlenme-satin-al` | 137 | 7 gösterim, poz 24,3 |
| `instagram-begeni-satin-al` | 167 | — |

Karşılaştırma: 20 Eylül sonrası panel sayfaları 350-470 kelime, son iki sayfa 1.800-2.000 kelime.

20 Eylül raporundaki "sayfa başına 984-1.361 kelime" ölçümü servis tablosu, menü ve SSS dahil tüm sayfayı sayıyordu. Yazılan özgün metin bunun küçük bir kısmı.

### 3.3 Dört takipçi sayfasında aynı blok — YÜKSEK (bugünkü revizyonun yan etkisi)

Gün 12 betiği `instagram-takipci`, `tiktok-takipci`, `twitter-takipci` ve `youtube-abone` sayfalarına "Ne kadar almalı?" + "Türkiye kaynaklı seçenek" bloğunu ekledi. Blok dört sayfada neredeyse kelimesi kelimesine aynı (yalnızca "takipçi/abone" ve örnek rakam değişiyor).

| Sayfa çifti | Benzerlik |
|---|---|
| tiktok-takipci ↔ twitter-takipci | %27,8 |
| instagram-takipci ↔ tiktok-takipci | %24,5 |
| twitter-takipci ↔ youtube-abone | %21,1 |

Diğer bütün satış sayfası çiftlerinde bu oran %0-8. Sayfaların kendi metni kısa olduğu için eklenen blok her birinin yaklaşık yarısı oldu. Bu dördü aynı zamanda en çok satan kategorilerin sayfaları. Blokların her platform için ayrı yazılması gerekiyor (platforma özgü rakam, örnek ve risk).

### 3.4 İçerik var, satılacak servis yok — YÜKSEK

| Sayfa | Aktif servis | Durum |
|---|---|---|
| `instagram-kanal-uye-satin-al` | 0 | Canlıda "Bu sayfaya bağlı aktif servis bulunmuyor" yazıyor. 24 gösterim alıyor. Bağlı kategori (190) artık yok. |
| `instagram-canli-yayin-izleyici-satin-al` | 0 | Başlık "15 ila 90 dakika kalış" vaat ediyor, kategori (183) yok. |
| `youtube-abone-satin-al` | 1 | En çok satan kategori. Başlık "Türk abone seçeneği" ve "saatlik 10K hız" diyor; bağlı iki kategoriden biri boş. |
| `soundcloud-dinlenme-satin-al` | 1 | |

Katalogda ayrıca aynı işi gören çift kategoriler var: "TwitterTakipçi" ve "Twitter Takipçi", "YouTube Abone" ve "Youtube Abone", "Facebook Rastgele Yorum" ve "Yorumlar", İngilizce kalmış "Instagram - Comments". "Instagram Türk Takipçi" kategorisinde 3 servisin 3'ü de kapalı; oysa içerikte Türk takipçiyi öne çıkarıyoruz.

### 3.5 Blogdan satışa giden yol kopuk — ORTA

Yayındaki 40 blog yazısının 15'inde hiçbir satış sayfasına metin içi link yok. Aralarında en çok gösterim alanlar var:

| Yazı | Gösterim | Eksik link |
|---|---|---|
| `smm-panel-nedir-nasil-kullanilir` | 59 | `/ucuz-smm-panel`, panel sayfaları |
| `sosyal-medya-hesap-guvenligi-rehberi` | 23 | |
| `youtube-shorts-izlenme-nasil-artirilir...` | 21 | `/youtube-shorts-izlenme-satin-al` |
| `youtube-begeni-ve-etkilesim-artirmanin...` | 17 | `/youtube-begeni-satin-al` |
| `youtube-da-1000-abone-ve-4000-saat...` | 13 | `/youtube-abone-satin-al` (en çok satan ürün) |
| `sosyal-medya-buyume-rehberi` | 9 | Sitede en çok iç link alan yazı (24), satışa hiç link vermiyor |

Tersinden bakınca, 8 satış sayfasına hiçbir içerikten metin içi link gelmiyor (yalnızca menü ve vitrin): `ucuz-smm-panel`, `canli-yayin-izleyici-satin-al`, `pinterest-kaydetme-satin-al`, `youtube-shorts-izlenme-satin-al`, `facebook-izlenme-satin-al`, `threads-takipci-satin-al` ve son iki uzun sayfa.

### 3.6 Taslağa giden 4 link — ORTA

Yayındaki iki yazı henüz yayınlanmamış yazılara link veriyor; tıklayan `/blog` listesine yönleniyor:

- `takipci-satin-almak-guvenli-mi` → `gercek-takipci-ile-bot-takipci-farki`, `turk-takipci-mi-yabanci-takipci-mi`
- `refill-yenileme-nedir-takipci-neden-duser` → `gercek-takipci-ile-bot-takipci-farki`, `instagram-takipci-fiyatlari-2026-1000-takipci-kac-tl`

Takvimdeki Gün 15, 17 ve 18 yayınlanınca kapanır. Not: bugün `drip-feed` ve `refill` yazıları aynı gün yayınlandı; takvimde Gün 13 `smm-panel-nasil-secilir` idi, o hâlâ taslak.

### 3.7 Son iki uzun sayfa: uzunluk arttı, odak dağıldı — ORTA

`tiktok-telafi-garantili-takipci` (1.836 kelime) ve `telegram-whatsapp-kanali-ve-spotify-buyume-karsilastirmasi` (2.073 kelime) öncekilerden çok daha kapsamlı. İçlerinde dürüst uyarılar, adım adım anlatım ve iyi iç linkler var. Ama dört sorun görüyorum:

- **Tekrar.** Telafi sayfasında "telafi garantili takipçi" ifadesi 21 kez geçiyor; düşüş nedenleri üç ayrı bölümde, "garanti nasıl işler" iki bölümde anlatılıyor; "Sık Yapılan Hata" başlığı 5 kez var. Karşılaştırma sayfasında "Telegram, WhatsApp Kanalı ve Spotify" ifadesi 22 kez, neredeyse her başlıkta geçiyor. Bu, anahtar kelime doldurma olarak okunur.
- **Niyet uyumsuzluğu.** Karşılaştırma sayfası bilgi amaçlı bir yazı ama fiyat tablolu satış şablonunda ve Service şemasıyla yayında. Telegram, WhatsApp ve Spotify'ı birlikte karşılaştıran bir arama talebi GSC'de görünmüyor. Bu içerik blog yazısı olmalıydı.
- **Kaynaksız rakam.** "Telegram 1 milyar, WhatsApp 2 milyar, Spotify 700 milyon kullanıcı" deniyor, kaynak linki yok. "Vaka örneği" bölümü "gerçek bir senaryo" diye başlayıp "varsayımsal bir örnek" diye devam ediyor.
- **Konu çakışması.** Telafi sayfası, bir gün sonra yayınlanan `refill-yenileme-nedir` blog yazısı ve `instagram-takipci-dususu` yazısıyla aynı soruyu yanıtlıyor.

Kaliteyi belirleyen uzunluk değil. 600-900 kelimelik, tek soruya odaklı, katalogdaki gerçek servise dayanan sayfa bu ikisinden daha iyi iş görür.

### 3.8 Başlıklar Google'da kesiliyor — DÜŞÜK-ORTA

Satış sayfalarının `<title>` uzunluğu marka ekiyle 74-83 karakter; Google yaklaşık 60 karakter gösterir.

- `Instagram Beğeni Satın Al – Anında Başlayan, Düşük Düşüşlü Paketler | Jet SMM Panel` (83)
- `Twitch İzleyici Satın Al – Canlı Yayın ve Video Görüntülenme | Jet SMM Panel` (76)

İlk sayfada olup tıklanmayan sayfalarda (3 sorgu, 74 gösterim, 0 tıklama) başlığın görünen kısmına fiyat ya da hız bilgisi girmeli. `twitter-goruntulenme-satin-al` başlığında aranan "X görüntülenme" ifadesi de öne alınmalı.

### 3.9 Blog: tek kalıp ve zayıf yazar kimliği — ORTA

- 40 yazının 35'i 945-1.150 kelime ve aynı iskelette: 7 H2, 5 H3'lük SSS, 1 tablo, 3 dış link, 4 blog linki. Hiçbir yazıda gövde içi görsel yok.
- Dış linklerin çoğu belirli bir kaynağa değil ana sayfaya gidiyor (`creators.instagram.com`, `newsroom.tiktok.com`, `help.instagram.com/`). Bu kaynak göstermek sayılmaz.
- Yazar şemada `Person`, adı "JET SMM PANEL", unvanı "ADMIN", adresi Telegram linki. Ya gerçek bir editör adı ve kısa tanıtımı girilmeli ya da alan boşaltılıp kurum yazar olarak bırakılmalı.
- 15 Eylül sonrası yazılar 670-850 kelime ve dış linksiz; odakları daha iyi ama kaynak eksik.

### Sorun olmayanlar

Yinelenen başlık veya açıklama yok. Blog yazıları arasında metin benzerliği yok. Tüm sayfalar 200 dönüyor, yanıt süresi 130-350 ms. Canonical, Service/FAQPage/BlogPosting/BreadcrumbList şemaları, robots.txt ve llms.txt yerinde. HTTPS ve içerik haritası raporlarında hata yok. Google, Bing ve yapay zekâ botları Cloudflare'den engelsiz geçiyor.

---

## 4. İleriye dönük geliştirme önerileri

### 4.1 Kayıt kaynağı takibi — en değerli geliştirme

`users` tablosunda kullanıcının nereden geldiği yok. Ziyaretin ilk kaynağı ve ilk indiği sayfa kayıt anında kullanıcıya yazılırsa, admin panelde "hangi sayfa ve hangi kaynak kaç müşteri, kaç TL getirdi" raporu çıkar. O zaman içerik kararlarını gösterimle değil gelirle verirsin. Bugün 15.400 TL'lik cironun kaynağını bilmiyoruz.

### 4.2 İstatistiklerin temizlenmesi

- Ziyaret, yalnızca gerçek bir sayfaya (200 dönen rota) inildiyse sayılsın; `/.env`, `/xmlrpc.php` gibi yollar sayaca girmesin.
- Referans spam'i için alan adı deseni filtresi.
- Bot panelinde tarayıcı yollarına gelen "Googlebot" istekleri ayrı satırda ("sahte kimlik") gösterilsin.
- Blog ve satış sayfası okunma sayaçlarında bot filtresi yok ([server.js:415](server.js#L415), [server.js:1126](server.js#L1126)); eklenmeli.
- Cloudflare'de `.env`, `.git`, `wp-`, `xmlrpc.php` yollarını engelleyen tek bir WAF kuralı hem gürültüyü hem sunucu yükünü azaltır.

### 4.3 Katalog-içerik bekçisi

Admin "Satış Sayfaları" sekmesinde her sayfanın aktif servis sayısı görünsün; 0 olunca uyarı versin ve günlük Telegram özetine düşsün. Servisi kalmayan sayfa otomatik olarak ilgili panel sayfasına yönlendirme önerisi göstersin. 3.4'teki durum bir daha fark edilmeden oluşmaz.

### 4.4 İç link raporu

Admin panelde her blog yazısı için "satış sayfasına link sayısı", her satış sayfası için "gelen metin içi link sayısı" sütunu. Yetim sayfa ve satışa bağlanmayan yazı tek bakışta görünür. Bu raporun ölçümü hazır; panele taşımak kalıyor.

### 4.5 Başlık uzunluğu kuralı

Başlık 48 karakteri geçiyorsa marka eki eklenmesin. Tek satırlık kural, 44 satış sayfasını birden düzeltir.

### 4.6 Olmayan adres 404 dönsün

`/blog/olmayan-yazi` şu an 302 ile `/blog`'a gidiyor. Taslak için geçici yönlendirme mantıklı; hiç var olmamış adres 404 dönmeli. Google bunu "yönlendirmeli sayfa" olarak sayıyor.

### 4.7 Panelin kendi verisinden içerik

Rakiplerin kopyalayamayacağı tek içerik bu: servis bazında gerçek tamamlanma süresi, telafi oranı, iptal oranı. Katalogdaki "ortalama süre" sütunu zaten var. 18 Ağustos'ta "500 sipariş birikince" diye ertelemiştik; şu an 224 sipariş var. Eşik dolunca satış sayfalarına "son 30 günde ortalama tamamlanma süresi" satırı ve ilk vaka yazısı eklenebilir.

### 4.8 Yapılmaması gerekenler

- **Takvim bitince yeni adres açmaya ara ver.** 93 adres var, günde 5 sayfa taranıyor. Önce mevcut sayfaları güçlendirmek daha çok getirir.
- **İngilizce sürüm açma.** Yurt dışı gösterimlerin (215) getirdiği tıklama 3.
- **Bing için kod değişikliği yapma.** 20 Eylül'deki sonuç geçerli.

---

## 5. Yapılacaklar sırası

### Bu hafta (yeni sayfa açmadan)

| # | İş | Tür |
|---|---|---|
| 1 | Gizli ortak metni diğer adreslerden çıkar (3.1) | Kod |
| 2 | 4 takipçi sayfasındaki ortak bloğu platforma özgü yeniden yaz (3.3) | İçerik betiği |
| 3 | Servisi olmayan 2 sayfaya servis bağla ya da taslağa al; `youtube-abone` kategorilerini düzelt (3.4) | Admin panel |
| 4 | 15 blog yazısına satış linki, 8 yetim sayfaya gelen link ekle (3.5) | İçerik betiği |
| 5 | Takvime Gün 13'ten devam et; taslak bloglar yayınlanınca 4 askıdaki link kapanır (3.6) | Admin panel |
| 6 | Blog yazar bilgisini düzelt (3.9) | Admin ayarı |

### Ekim içinde

| # | İş |
|---|---|
| 7 | En çok satan ve talep gören 6 satış sayfasını 500-800 kelimeye çıkar: `youtube-abone`, `twitter-takipci`, `instagram-takipci`, `tiktok-takipci`, `twitch-izleyici`, `instagram-kaydetme` |
| 8 | İki uzun sayfayı sadeleştir; karşılaştırma içeriğini bloga taşı (3.7) |
| 9 | Başlık uzunluğu kuralı ve ilk sayfadaki 3 sayfanın başlık/açıklaması (3.8, 4.5) |
| 10 | Kayıt kaynağı takibi (4.1) |
| 11 | İstatistik temizliği ve Cloudflare kuralı (4.2) |
| 12 | Katalog-içerik bekçisi ve iç link raporu (4.3, 4.4) |

### Sürekli

| # | İş |
|---|---|
| 13 | Dış bağlantı: Product Hunt sayfasını sahiplen, Türkçe sektör dizinleri, forum imzaları. Şu an 5 alan adı var. |
| 14 | GSC'yi haftalık, Türkiye filtresiyle izle: ana sayfa pozisyonu, ilk 10'daki kelime sayısı, Türkiye tıklaması |
| 15 | 500 siparişte panel verisi içerikleri (4.7) |

---

## Uygulama — 2 Ekim 2026'da hazırlananlar

### 3.1 düzeltmesi: gizli ortak metin

| Dosya | Değişiklik |
|---|---|
| [utils/gatedMarkup.js](utils/gatedMarkup.js) | Blog listesi görünümü (`view-blog`) yalnızca `/blog` adresinde gönderilir. Hizmet listesinin açıklama metni işaretlendi ve yalnızca `/services` adresinde gönderilir (`SEO_BLOKLARI`). |
| [public/index.html](public/index.html) | Açıklama bloğuna işaret eklendi; kaynak koddaki iç notlar sadeleştirildi. |
| [test/seo-audit.test.js](test/seo-audit.test.js) | Bu metinlerin başka adreslere sızmadığını doğrulayan test. |

Tek davranış farkı: başka bir sayfadan Blog'a geçiş artık tam sayfa yüklemesi yapar. 504 test geçiyor; menü geçişleri tarayıcıda denendi.

3.3 (dört takipçi sayfasındaki ortak blok) bilerek ertelendi.

### 5 yeni satış sayfası (hepsi TASLAK)

[scripts/seed-landing-pages-2026-10.js](scripts/seed-landing-pages-2026-10.js) — seçim ölçütü: kategoride aktif servis var ama o servislere ait sayfa yok.

| Sayfa | Hedef kelime | Bağlandığı kategoriler |
|---|---|---|
| `/turk-begeni-satin-al` | türk beğeni satın al | TikTok Türk Beğeni, TikTok Türk Video İzlenme, Instagram Beğeni |
| `/youtube-canli-yayin-izleyici-satin-al` | youtube canlı yayın izleyici satın al | YouTube Canlı Yayın İzleyici (6 servis) |
| `/tiktok-kaydetme-satin-al` | tiktok kaydetme satın al | TikTok Video Kaydetme, TikTok Paylaşım |
| `/instagram-erisim-satin-al` | instagram erişim satın al | Instagram Profil Erişimi (4 servis) |
| `/facebook-smm-panel` | facebook smm panel | Aktif servisi olan bütün Facebook kategorileri (11) |

Bu sayfalarda ortak blok yok: adımlar ve SSS her sayfada kendine özgü, iskeletler farklı (tablo, sıralı liste, hedefe göre seçim). Ölçüm (5 kelimelik parçalar):

| Karşılaştırma | En yüksek benzerlik |
|---|---|
| Yeni sayfa ↔ yayındaki 44 satış sayfası | %1,0 |
| Yeni sayfa ↔ yayındaki 40 blog yazısı | %0,3 |
| Yeni sayfalar kendi aralarında | %0,2 |
| Referans: mevcut 44 sayfa kendi aralarında (ortak SSS ve adımlar dahil) | ortanca %9,8, en yüksek %30 |

Sayfa başına özgün metin: gövde 408-464 kelime, SSS 134-180 kelime, 7-8 metin içi link. Linklerin tamamı yayındaki adreslere gider.

### Gelen linkler

[scripts/link-yeni-sayfalar-2026-10.js](scripts/link-yeni-sayfalar-2026-10.js) — yeni sayfa yayınlandıktan sonra çalıştırılır. Yayındaki 14 sayfaya, her biri farklı yazılmış birer cümle ekler; hedefi henüz yayında olmayan ekleri atlar. Facebook çatı sayfasına, taslaktaki iki Facebook sayfası yayınlanınca onların linkini de koyar. Ayrıca eski takvimdeki "tek elle iş"i (Türk takipçi blog taslağına eksik link) yapar.

### Takvim

[YAYIN-TAKVIMI-2026-10.txt](YAYIN-TAKVIMI-2026-10.txt): kalan 10 içerik ve 5 yeni sayfa, 2 günde bir, 4 Ekim – 1 Kasım.

---

## Ek: bugün yapılan işlem

Gün 12 revizyonu (`scripts/revise-seo-2026-09.js`) 2 Ekim 2026'da sunucuda çalıştırıldı: 8 kayıt güncellendi, 7 adres ve eklenen 8 link hedefi canlıda doğrulandı. Öncesinde alınan veritabanı yedeği: `/var/backups/smmjet/gun12-oncesi-20261002-192252.sqlite`. Yan etkisi 3.3'te anlatıldı.
