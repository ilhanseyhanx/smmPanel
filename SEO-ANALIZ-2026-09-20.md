# GSC Analizi ve İçerik Planı — 20 Eylül 2026

Kaynak: Search Console dışa aktarımları (Performance / Coverage / HTTPS, "Son 3 ay"
filtresi = fiilen 13 Ağu – 17 Eyl 2026, 36 gün) + canlı site ölçümleri.

**Dönemin özeti:** 424 gösterim, 20 tıklama, 51 sayfa dizinde, 29 sayfa dizin dışı.

---

## 1. İndekslenmeyen sayfalar

### Sayılar

| Durum | Sayfa | Not |
|---|---|---|
| Dizine eklendi | 51 | |
| Keşfedildi – dizine eklenmedi | 17 | Google taramaya bile sıra vermedi |
| Tarandı – dizine eklenmedi | 10 | Taradı, tutmaya değer bulmadı |
| `noindex` ile hariç tutuldu | 2 | **Kasıtlı, doğru** |

Sitemap'te 78 URL var, 51'i dizinde. Kayıp %37.

### noindex olan 2 sayfa sorun değil

`utils/pageMeta.js` içinde `/register` ve `/tickets` bilerek `noindex`. İkisinin de
özgün metni yok (form iskeletinden ibaret). Doğru karar — dokunma.

**Tek düzeltme:** `gsc-bing-url-listesi.txt` dosyasında `https://jetsmmpanel.com/register`
satırı duruyor. Elle bildirim yaparken noindex bir sayfayı göndermek boşa istek.
O satır listeden çıkarılmalı.

### Asıl sorun: en değerli ticari sayfalar dizin dışı

Sitemap'teki 78 URL ile performans raporundaki 43 URL karşılaştırıldığında,
**36 sayfa 36 gün boyunca tek bir gösterim bile almamış.** İçlerinde sitenin
en yüksek hacimli kelimeleri var:

**Hiç gösterim almayan satış sayfaları (14):**

| Sayfa | Neden kritik |
|---|---|
| `instagram-takipci-satin-al` | Sektörün en yüksek hacimli kelimesi |
| `instagram-begeni-satin-al` | İkinci en yüksek hacim |
| `tiktok-izlenme-satin-al` | Yüksek hacim |
| `youtube-izlenme-satin-al` | Yüksek hacim |
| `telegram-uye-satin-al` | Orta hacim, düşük rekabet |
| `instagram-hikaye-izlenme-satin-al` | Sorgu verisinde talep **var** (8 gösterim) |
| `instagram-yorum-satin-al`, `instagram-kaydetme-satin-al`, `instagram-kanal-uye-satin-al`, `instagram-canli-yayin-izleyici-satin-al`, `spotify-dinlenme-satin-al`, `soundcloud-dinlenme-satin-al`, `kick-takipci-satin-al`, `whatsapp-kanal-uye-satin-al` | Yeni açılan dikeyler |

**Ayrıca `/services` ve `/blog` de hiç gösterim almamış** — bunlar sitenin en eski
sayfaları ve sitemap'te priority 0.9/0.8 ile duruyorlar.

### Neden indekslenmiyorlar — elenen ve kalan sebepler

Teknik tarafı canlı site üzerinde ölçtüm, **sorun teknik değil**:

| Kontrol | Sonuç |
|---|---|
| HTTP durumu | 200 (tüm sayfalar) |
| TTFB | 0.34 – 0.45 s (çok iyi) |
| SSR içerik | Var — satış sayfaları sunucudan dolu HTML dönüyor |
| Sayfa başına kelime | 984 – 1361 (yeterli) |
| Sayfalar arası benzerlik | Jaccard %9–11 (çok düşük = kopya değil) |
| Sayfa başına benzersiz içerik | %84–88 |
| title / h1 / canonical / description | Dördü de sayfaya özgü ve doğru |
| Meta açıklama uzunluğu | 146–156 karakter (ideal aralık) |
| robots.txt | Engel yok |
| İç link | 31 satış sayfasının **tamamı** ana sayfa dahil her sayfadan linkli |
| HTTPS raporu | 0 sorunlu URL |

Geriye iki sebep kalıyor:

**a) Alan adı otoritesi ve yaş.** Site fiilen 5 haftalık. "Keşfedildi – dizine
eklenmedi", Google'ın "bu alan adına şu an bu kadar tarama bütçesi ayırıyorum"
demesidir. 78 URL'lik bir site için 51 indeks, 5 haftalık bir alan adında normalin
üstünde bile.

**b) Toplu yayın.** `sitemap.xml` lastmod dağılımına göre **4 Eylül'de 29 sayfa tek
seferde** yayına girmiş. 78 URL'lik bir sitede bir günde %37'lik içerik artışı,
Google'ın kalite değerlendirmesini yavaşlatan bir sinyaldir. 8 Eylül'de 9, 18 Eylül'de
6 sayfa daha eklenmiş.

### Yapılacaklar (indeksleme)

1. **Toplu yayını bırak.** Bundan sonra haftada en fazla 2–3 sayfa yayınla. Kalan
   taslakları (`seed-landing-pages-2026-09b.js`, `seed-landing-pages-dijital.js`)
   tek seferde açma.
2. **GSC "URL İncele → Dizine eklenmeyi iste"** ile öncelik sırası: `instagram-takipci-satin-al`,
   `instagram-begeni-satin-al`, `tiktok-izlenme-satin-al`, `youtube-izlenme-satin-al`,
   `/services`. Günde 10 istek kotası var, en değerli 5'ten başla.
3. **İç link hiyerarşisi kur.** Şu an 31 satış sayfası her sayfadan aynı ağırlıkta
   linkli (düz yapı). Google'a hangisinin önemli olduğu sinyali gitmiyor. Ana sayfaya
   ve blog yazılarının gövdesine, *metin içi bağlam linkiyle* öncelikli 5 sayfaya
   link ver — aside bloğundaki eşit ağırlıklı 31 link bu işi yapmıyor.
4. **`/services` ve `/blog`'a özgün metin ekle.** İkisi de katalog/liste sayfası;
   üstlerinde 150–250 kelimelik özgün tanıtım metni yoksa Google "değer katmayan
   liste" sayar.

---

## 2. Performanstaki dalgalanma

### Ölçüm

| Dönem | Gün | Gösterim | Günlük ort. | Tıklama | TO | Ağırlıklı pozisyon |
|---|---|---|---|---|---|---|
| 18 Ağu – 1 Eyl | 15 | 290 | 19.3 | 17 | %5.9 | **9.0** |
| 2 Eyl – 17 Eyl | 16 | 133 | 8.3 | 3 | %2.3 | **35.1** |

Gösterim %54, tıklama %82 düşmüş; ortalama pozisyon 9'dan 35'e gerilemiş.
Zirve 21 Ağustos (45 gösterim, pozisyon 3.6), dip 12 Eylül (1 gösterim, pozisyon 60).

### Sebep 1 — Ortalama pozisyon düşüşünün büyük kısmı sahte

Sayfa tipine göre kırılım (sayfa bazlı 613 gösterim üzerinden; GSC'de sayfa toplamı
genel toplamdan yüksek çıkar, oranlar geçerlidir):

| Tip | Sayfa | Gösterim | Pay | Tıklama | Ağırlıklı pozisyon |
|---|---|---|---|---|---|
| Ana sayfa | 1 | 208 | %34 | 13 | **4.9** |
| Blog | 21 | 256 | %42 | 6 | **14.3** |
| Satış sayfaları | 17 | 119 | %19 | 1 | **38.6** |
| Diğer | 4 | 30 | %5 | 0 | 8.5 |

Ana sayfa hâlâ 4.9'da, blog 14.3'te. Düşen bir şey yok — **4 Eylül'de yayına giren
29 sayfa, 40–70. sıralarda gösterim almaya başladı ve site ortalamasını aşağı çekti.**
Somut örnek: `tiktok-takipci-satin-al` pozisyon 61.1, `tiktok-yorum-satin-al` 72.3,
`youtube-abone-satin-al` 65.0. Bunlar ortalamaya giriyor.

Bu bir ceza değil, bir karışım (mix) etkisi. Yeni sayfa açan her sitede olur.
**Ortalama pozisyonu site geneli olarak takip etmeyi bırak** — sayfa bazlı veya
kelime bazlı filtreyle bak.

### Sebep 2 — Yeni site balayı döneminin bitişi

Coverage grafiğine göre site 15 Ağustos'ta 3 sayfayla dizine girmeye başlamış.
18–21 Ağustos'taki pozisyon 3.6–7.8 değerleri, Google'ın yeni siteleri geçici olarak
yüksek sırada test etmesidir. Eylül'deki seviye sitenin **gerçek** otorite seviyesidir.
Ağustos rakamları referans alınmamalı.

### Sebep 3 — Gösterimlerin %36'sı yurt dışından ve değersiz

| Ülke | Gösterim | Tıklama | Pozisyon |
|---|---|---|---|
| Türkiye | 271 (%64) | 17 | 20.75 |
| **Singapur** | **56 (%13)** | **0** | **2.2** |
| ABD | 24 | 0 | 15.4 |
| Hindistan | 15 | 3 | 10.6 |
| Diğer 33 ülke | 58 | 0 | — |

Singapur'da pozisyon 2.2 ile 56 gösterim ve **sıfır** tıklama. Singapur, veri merkezi
yoğunluklu bir bölge; bu gösterimler büyük olasılıkla gerçek kullanıcı değil. Türkçe
bir panelin Madagaskar'da 1.75, Suriye'de 1.5 pozisyonda çıkması da aynı gürültüdür.
Yurt dışından gelen 153 gösterimin toplam getirisi 3 tıklama.

Bu gürültü dönemden döneme değiştiği için tek başına ortalama pozisyonu oynatıyor.
**GSC'yi her zaman Ülke = Türkiye filtresiyle aç.**

### Sebep 4 — Düşük hacimde istatistiksel gürültü

Günlük 8–19 gösterimde tek bir sorgunun yer değiştirmesi grafiği %50 oynatır.
36 günde 20 tıklama olan bir sitede günlük grafiğe bakmanın anlamı yok.
**Haftalık toplamlara bak.**

### Yapılacaklar (performans)

1. GSC'de kayıtlı filtre: Ülke = Türkiye, karşılaştırma = son 28 gün / önceki 28 gün.
2. Site geneli ortalama pozisyon yerine: ana sayfa pozisyonu + "ilk 10'daki kelime
   sayısı" + Türkiye tıklaması. Üçü de yükseliyorsa site büyüyordur.
3. Yeni sayfaları kademeli yayınla (bkz. bölüm 1).

---

## 3. Bing: indeks var, gösterim yok

### Elenen sebepler

Canlı testler:

| Kontrol | Sonuç |
|---|---|
| Bingbot user-agent ile ana sayfa | HTTP 200, 54.543 bayt |
| Bingbot user-agent ile satış sayfası | HTTP 200, 51.711 bayt |
| robots.txt'de bingbot engeli | Yok |
| Cloudflare bot koruması | Bingbot'u engellemiyor |
| `BingSiteAuth.xml` | Yayında, kod geçerli (`265F12F0...`) |
| IndexNow anahtar dosyası | `services/indexNow.js` üzerinden yayında, bildirim otomatik |
| SSR içerik | Var — Bing JS render'a muhtaç değil |

**Teknik tarafta hiçbir sorun yok.** Kurulum doğru yapılmış.

### Gerçek sebep

Bing'de "gösterim", kullanıcının senin sonucunun bulunduğu sonuç sayfasına kadar
gitmesiyle sayılır. Üç şey çakışıyor:

1. **Bing'in Türkiye pazar payı ~%1–2.** Google'da 424 gösterim alan bir site,
   aynı dönemde Bing'de 5–10 gösterim alır. Bu rakam sıfıra yuvarlanır.
2. **Bing sıralamada geri bağlantıya Google'dan çok daha fazla ağırlık verir.**
   Sitenin harici bağlantısı yok denecek kadar az; Bing'de ilk 3 sayfaya girmiyorsun,
   dolayısıyla kimse sonucunu göremiyor.
3. **Bing yeni alan adlarında Google'dan belirgin şekilde yavaş.** Tipik olgunlaşma
   3–6 ay.

Yani: dizine girmiş olman Bing'in seni **sıralamaya soktuğu** anlamına gelmiyor.
İndekslendin, 5. sayfadasın, oraya kimse gitmiyor.

### Yapılacaklar (Bing)

1. **Panik yok, kod değişikliği yok.** Kurulum doğru.
2. Bing Webmaster Tools → **Search Performance** yerine **"Site Explorer"** ve
   **"Backlinks"** ekranlarına bak; hangi sayfaların gerçekten dizinde olduğunu
   orada gör.
3. Bing'de fark yaratacak tek şey **harici bağlantı**: sektör dizinleri, Türkçe
   forum profilleri, sosyal medya biyografileri, varsa iş ortağı siteleri.
4. Ekim sonunda tekrar bak. Hâlâ 0 ise Bing Webmaster'da "SEO Reports" bölümünü
   incele. Ama en olası senaryo, tıklama gelmeden gösterimin yavaşça 10–50'ye
   çıkmasıdır.

---

## 4. Kelime analizi ve yeni içerik planı

### 4.1 Şu an hangi kelimeler getiriyor

49 sorgunun kırılımı (toplam 167 gösterim, 6 tıklama):

| Küme | Sorgu | Gösterim | Tıklama | Ağırlıklı pozisyon |
|---|---|---|---|---|
| **"panel" içeren (marka dışı)** | 20 | **64** | **0** | **39.7** |
| Marka (jet / smmjet) | 9 | 55 | 6 | 6.5 |
| "satın al" içeren | 7 | 31 | 0 | 45.5 |
| TikTok | 11 | 36 | 0 | 60.4 |
| Twitter/X | 7 | 18 | 0 | 54.3 |
| Instagram | 3 | 17 | 0 | 43.7 |
| YouTube | 5 | 16 | 0 | 43.1 |
| Miktar belirten (2000/50000) | 4 | 7 | 0 | 74.3 |
| Alakasız gürültü | 3 | 4 | 0 | — |

**Tüm tıklamaların 6'sı da marka sorgusundan. Genel kelimelerden gelen tıklama: 0.**

### 4.2 EN BÜYÜK BULGU — "panel" kelimesi

Marka dışı gösterimlerin **%57'si** "panel" içeren sorgulardan geliyor, ama
sitede tek bir "panel" odaklı sayfa yok. Bütün sayfalar `X satın al` kalıbında.

Sorgu listesi:

| Sorgu | Gösterim | Pozisyon | Hedef sayfa var mı |
|---|---|---|---|
| panel sitesi | 11 | **6.18** | Ana sayfa (TO sorunu) |
| twitter panel satın al | 6 | 41.7 | **Yok** |
| smm panel tiktok | 6 | 69.3 | **Yok** |
| tiktok smm panel | 5 | 72.0 | **Yok** |
| tiktok takipçi paneli | 4 | 65.0 | **Yok** |
| twitter panel | 3 | 50.0 | **Yok** |
| smm panel | 2 | 8.0 | Ana sayfa |
| smm panel api | 2 | 49.0 | `/smm-panel-api` var |
| tiktok begeni paneli | 2 | 58.0 | **Yok** |
| youtube smm panel | 2 | 67.5 | **Yok** |
| twitter takipçi paneli | 1 | 48.0 | **Yok** |
| tiktok panel / tiktok bot panel / begeni paneli | 3 | 69–74 | **Yok** |

Türk kullanıcı "tiktok takipçi satın al" kadar sık **"tiktok paneli"** de arıyor.
Bu iki kelime aynı sayfayla yakalanmıyor çünkü rakipler ayrı sayfa açıyor.

#### Öneri: 4 adet "panel" sayfası (en yüksek öncelik)

| Sayfa | Birincil kelime | Toplayacağı sorgular | Bilinen gösterim |
|---|---|---|---|
| `/tiktok-smm-panel` | tiktok smm panel | smm panel tiktok, tiktok takipçi paneli, tiktok panel, tiktok beğeni paneli, smm tiktok, tiktok bot panel | **20** |
| `/twitter-smm-panel` | twitter panel | twitter panel satın al, twitter takipçi paneli, twitter ilan paneli | **12** |
| `/instagram-smm-panel` | instagram panel | instagram paneli, instagram takipçi paneli, instagram beğeni paneli | — |
| `/youtube-smm-panel` | youtube smm panel | youtube paneli, youtube abone paneli | **2** |

Bu sayfalar mevcut `-satin-al` sayfalarının kopyası olmamalı. Farkı şu olmalı:
satın alma sayfası **tek bir hizmete** odaklanır; panel sayfası **o platformun tüm
hizmetlerini tek ekranda** toplayan bir hub'dır — fiyat tablosu, API erişimi, bayi
notu, o platformun tüm satış sayfalarına link. Böylece hem kelimeyi yakalar hem de
aradığım iç link hiyerarşisini kurar (bölüm 1, madde 3).

### 4.3 Sayfası olmayan, talebi kanıtlanmış kelimeler

| Kelime | Gösterim | Pozisyon | Durum | Aksiyon |
|---|---|---|---|---|
| **pinterest kaydetme satın al** | 8 | 46.1 | Sadece `pinterest-takipci-satin-al` var | **Yeni sayfa:** `/pinterest-kaydetme-satin-al` |
| **instagram hikaye izlenme arttırma** | 8 | 58–64 | Satış sayfası var ama **hiç gösterim almıyor**, gösterimi blog yazısı alıyor | Satış sayfasını güçlendir, blogdan metin içi link ver |
| **youtube shorts izlenme** | 4 | 46–73 | Blog var, satış sayfası yok | **Yeni sayfa:** `/youtube-shorts-izlenme-satin-al` |
| 50000 / 2000 twitter takipçi satın al | 6 | 76–85 | Miktar varyasyonu yok | Mevcut sayfalara miktar bölümü ekle |
| 2000 twitter **türk** takipçi satın al | 1 | 85 | "Türk takipçi" ifadesi sayfalarda zayıf | Sayfalara "Türk takipçi" bölümü |

### 4.4 Blog planı

**Önce mevcutları düzelt** — yeni yazmadan önce bunlar getiri sağlar:

| Yazı | Şu an | Sorun |
|---|---|---|
| `tiktok-algoritmasi-nasil-calisir` | 20 gösterim, poz **33.8** | "tiktok algoritma"(4) + "tiktok algoritması"(2) + "nasıl çalışır"(1) = 7 gösterim geliyor ama 34. sırada. Derinleştir, güncelle |
| `instagram-hikaye-izlenme-artirma-taktikleri` | 19 gösterim, poz **38.5** | Talep kanıtlı (8 gösterim), sıralama kötü |
| `influencer-olmak-icin-kac-takipci-gerekir` | 2 gösterim, poz **85** | "fenomen olmak için kaç takipçi lazım" diye aranıyor — **başlıkta "fenomen" kelimesi yok** |
| `youtube-da-1000-abone-ve-4000-saat...` | 13 gösterim, poz 13.9 | İyi konumda, biraz itme yeter |

**Zaten iyi gidenler (dokunma):** `smm-panel-nedir-nasil-kullanilir` (57 gösterim,
3 tıklama, poz 7.5), `youtube-begeni-ve-etkilesim-artirmanin-2026-yontemleri`
(17 gösterim, 2 tıklama, poz 6.5).

**Yeni yazılar — sorgu verisinden türetildi:**

| # | Konu | Dayanak | Hedef |
|---|---|---|---|
| 1 | **SMM Panel Nasıl Seçilir? Güvenilir Panel Ayırt Etme Rehberi** | "panel sitesi" 11 gösterim poz 6.18 — zaten ilk sayfadayız, adanmış içerik yok | panel sitesi, güvenilir smm panel, ucuz smm panel |
| 2 | **Türk Takipçi mi Yabancı Takipçi mi?** | "2000 twitter türk takipçi satın al" + sektörün en ayırt edici TR kelimesi | türk takipçi, gerçek türk takipçi |
| 3 | **TikTok Takipçi Paneli Nasıl Kullanılır?** | "tiktok takipçi paneli"(4) + "tiktok bot panel"(1) — panel sayfasını besler | tiktok paneli, tiktok takipçi paneli |
| 4 | **YouTube Shorts İzlenme Nasıl Artar?** (mevcut yazının güncellemesi) | "youtube shorts izlenme"(2) + "youtube shots izlenme"(2) — yazım hatalı varyant da geliyor | youtube shorts izlenme |
| 5 | **Pinterest'te Kaydetme (Save) Sayısı Neden Önemli?** | "pinterest kaydetme satın al" 8 gösterim | pinterest kaydetme |
| 6 | **Tüm Sosyal Medya Kanallarını Tek Panelden Yönetmek** | "tüm online kanalları tek panelde toplamanın en etkili yolları nelerdir?" — soru formatlı, AI aramaları için ideal (GEO) | çoklu platform yönetimi |

### 4.5 Tıklama oranı (TO) sorunu — hızlı kazanç

Genel kelimelerde **ilk sayfada olup 0 tıklama alan** sorgular:

| Sorgu | Pozisyon | Gösterim | Tıklama |
|---|---|---|---|
| panel sitesi | 6.18 | 11 | 0 |
| smm | 4.0 | 5 | 0 |
| smm panel | 8.0 | 2 | 0 |
| medya panel | 4.0 | 2 | 0 |

İlk sayfada 20 gösterim var, tıklama yok. Yeni sayfa açmadan önce **ana sayfanın
title ve description'ı** bu kelimeler için elden geçirilmeli. Şu anki title:

> `SMM Panel - Instagram, TikTok ve YouTube | Jet SMM Panel`

"Panel sitesi" arayan biri güven ve fiyat sinyali arıyor. Daha güçlü bir alternatif:

> `SMM Panel - Ucuz ve Güvenilir Sosyal Medya Paneli | Jet SMM Panel`

### 4.6 Yayın sırası (öncelik)

**Hafta 1 — mevcudu düzelt, sayfa açma**
1. Ana sayfa title/description revizyonu (4.5)
2. GSC'den 5 öncelikli sayfa için dizine ekleme isteği (bölüm 1)
3. `/services` ve `/blog`'a özgün giriş metni
4. `gsc-bing-url-listesi.txt`'ten `/register` satırını çıkar

**Hafta 2–3 — panel hub'ları (en yüksek getiri)**
5. `/tiktok-smm-panel`
6. `/twitter-smm-panel`
7. Blog: "SMM Panel Nasıl Seçilir"

**Hafta 4–5**
8. `/instagram-smm-panel`, `/youtube-smm-panel`
9. `/pinterest-kaydetme-satin-al`
10. Blog: "Türk Takipçi mi Yabancı Takipçi mi"

**Hafta 6+**
11. `/youtube-shorts-izlenme-satin-al`
12. Mevcut blog yazılarının derinleştirilmesi (4.4)
13. Miktar/Türk varyasyon bölümleri

Haftada en fazla 2–3 yeni URL. 4 Eylül'deki gibi toplu yayın yapma.

---

## Özet tablo

| Soru | Cevap |
|---|---|
| Neden indekslenmiyor? | Teknik sorun yok. 5 haftalık alan adı + 4 Eylül'de 29 sayfalık toplu yayın. Kademeli yayın + iç link hiyerarşisi çözer |
| Performans neden dalgalanıyor? | Ortalama pozisyon düşüşünün büyük kısmı sahte (yeni sayfaların karışım etkisi). Ana sayfa hâlâ 4.9'da. Ayrıca balayı bitişi + %36 yurt dışı gürültü + düşük hacim |
| Bing neden 0 gösterim? | Kurulum doğru. Bing'in TR payı %1–2 + geri bağlantı yok + yeni alan adı. 3–6 ay sürer |
| Hangi kelimelere gidilmeli? | **"panel" kümesi** — marka dışı gösterimlerin %57'si, sitede tek sayfa yok. 4 panel hub'ı + pinterest kaydetme + youtube shorts |

---

# UYGULAMA — 20 Eylül 2026'da yapılanlar

Yukarıdaki plan uygulandı. Aşağısı ne yapıldığının ve nasıl yayına alınacağının kaydıdır.

## Canlıya alınmaya hazır kod değişiklikleri

| Dosya | Değişiklik |
|---|---|
| [utils/pageMeta.js](utils/pageMeta.js) | Ana sayfa başlığı "panel" kelime kümesine göre yeniden yazıldı; `/services` başlık ve açıklaması "smm panel fiyat listesi" hedefine çevrildi |
| [public/index.html](public/index.html) | `/services` ve `/blog` görünümlerine özgün SEO metni eklendi (tablo/kart ızgarasının **altına**, UX bozulmadan) — içlerinde öncelikli 5 satış sayfasına bağlam linki var |
| [gsc-bing-url-listesi.txt](gsc-bing-url-listesi.txt) | `noindex` olan `/register` satırı çıkarıldı (28 URL kaldı) |

459 testin tamamı geçiyor.

## Yeni satış sayfaları (11 adet, hepsi TASLAK)

Hiçbiri yayınlanmadı; `status: 'draft'` olarak oluşur, IndexNow bildirimi yalnızca
sen yayına aldığında gider.

| Betik | Sayfa | Hedef kelime / görev |
|---|---|---|
| [seed-landing-pages-panel-hub.js](scripts/seed-landing-pages-panel-hub.js) | `/tiktok-smm-panel` | "tiktok smm panel", "tiktok takipçi paneli" (20 gösterim) |
| | `/twitter-smm-panel` | "twitter panel satın al", "twitter panel" (12 gösterim) |
| | `/instagram-smm-panel` | "instagram panel" + **8 dizine girmeyen Instagram sayfasına link** |
| | `/youtube-smm-panel` | "youtube smm panel" |
| [seed-landing-pages-kopru.js](scripts/seed-landing-pages-kopru.js) | `/ucuz-smm-panel` | "ucuz smm panel", "panel sitesi" + 12 sayfaya link (en geniş köprü) |
| | `/turk-takipci-satin-al` | "türk takipçi", miktar modifier'ları |
| | `/canli-yayin-izleyici-satin-al` | Twitch/Kick/TikTok/Instagram canlı yayın çatısı |
| | `/muzik-dinlenme-satin-al` | Spotify + SoundCloud çatısı (ikisi de dizine girmemişti) |
| | `/sosyal-medya-etkilesim-paketi` | "beğeni paneli", yorum/kaydetme/hikaye çatısı |
| [seed-landing-pages-2026-09c.js](scripts/seed-landing-pages-2026-09c.js) | `/pinterest-kaydetme-satin-al` | "pinterest kaydetme satın al" (8 gösterim, sayfa yoktu) |
| | `/youtube-shorts-izlenme-satin-al` | "youtube shorts izlenme" (+ "shots" yazım varyantı) |

**Kategoriler elle yazılmadı.** Her sayfa, kaynak satış sayfalarının `category_ids`
alanlarını çalışma anında DB'den okuyup birleştirir; Pinterest ve Shorts sayfaları
önce `categories` tablosunda kalıba uyan aktif servisli kategoriyi arar. Kategori
bulunamazsa sayfa oluşturulmaz ve nedeni yazılır.

## Blog

- **Yeni taslak:** [smm-panel-nasil-secilir](scripts/blog-drafts/03-panel-secimi-ve-turk-takipci.js) — "panel sitesi" kelimesi için (zaten 6.18'deyiz, adanmış içerik yoktu).
- **"Türk takipçi mi yabancı mı" için yeni yazı YAZILMADI:** aynı slug'la hazır bir
  taslak `02-fiyat-bayilik-api.js` içinde zaten varmış. O taslağa
  `/turk-takipci-satin-al` bağlantısı eklendi.
- **Not:** Elinde daha önce hazırlanmış, **henüz yayınlanmamış 7 blog taslağı** var:
  `drip-feed-nedir-kademeli-teslimat`, `refill-yenileme-nedir-takipci-neden-duser`,
  `gercek-takipci-ile-bot-takipci-farki`, `instagram-takipci-fiyatlari-2026-1000-takipci-kac-tl`,
  `smm-panel-bayilik-nasil-yapilir`, `smm-panel-api-entegrasyonu-rehberi`,
  `turk-takipci-mi-yabanci-takipci-mi`. Günlük yayın sırasına bunları da katabilirsin.

## Yayındaki içerik revizyonu

[scripts/revise-seo-2026-09.js](scripts/revise-seo-2026-09.js) — idempotent, `--dry` ile önizlenir:

1. `influencer-olmak-icin-kac-takipci-gerekir` başlığına **"Fenomen"** eklenir
   (GSC'de "fenomen olmak için kaç takipçi lazım" diye aranıyor, başlıkta kelime yoktu).
2. Üç yayındaki yazıya "Bu yazıyla ilgili hizmetler" bölümü eklenir — en kritiği
   hikaye izlenme yazısından `/instagram-hikaye-izlenme-satin-al` sayfasına link
   (8 gösterim bloga düşüyor, satış sayfası 36 günde tek gösterim almamıştı).
3. Dört takipçi sayfasına "Ne kadar almalı?" miktar rehberi + Türkiye kaynağı bölümü.

**Güvenlik kilidi:** Betik, link vereceği satış sayfası henüz yayında değilse o eki
atlar ve `BEKLIYOR: ... önce şu sayfalar yayına alınmalı` der. Böylece yayındaki
yazıya 404 bağlantı konmaz. Sayfaları yayınladıktan sonra betiği tekrar çalıştır.

## Yayın sırası — bağımlılıklara göre (günde 1)

Sayfalar birbirine link verdiği için sıra önemli: bir sayfa, henüz yayınlanmamış
bir sayfaya link veriyorsa 404 oluşur. Aşağıdaki sıra bunu engeller.

```
# Sunucuda önce üç betik çalıştırılır (hepsi TASLAK oluşturur):
cd /var/www/smmjet
node scripts/seed-landing-pages-panel-hub.js
node scripts/seed-landing-pages-kopru.js
node scripts/seed-landing-pages-2026-09c.js
node scripts/seed-blog-drafts.js --update      # blog taslakları
```

Sonra günde bir tane:

| Gün | Komut | Neden bu sırada |
|---|---|---|
| 1 | `node scripts/publish-landing-pages.js tiktok-smm-panel` | Yalnızca yayındaki sayfalara link verir |
| 2 | `... instagram-smm-panel` | Aynı |
| 3 | `... youtube-smm-panel` | Aynı |
| 4 | `... turk-takipci-satin-al` | 5. ve 6. günün ön koşulu |
| 5 | `... twitter-smm-panel` | `/turk-takipci-satin-al` linki taşır |
| 6 | `... ucuz-smm-panel` | 4 panel hub'ı + türk takipçi linki taşır |
| 7 | `... sosyal-medya-etkilesim-paketi` | Instagram ve TikTok hub linki taşır |
| 8 | `... canli-yayin-izleyici-satin-al` | Bağımsız |
| 9 | `... muzik-dinlenme-satin-al` | Bağımsız |
| 10 | `... pinterest-kaydetme-satin-al` | Etkileşim paketi linki taşır |
| 11 | `... youtube-shorts-izlenme-satin-al` | YouTube hub linki taşır |
| 12 | `node scripts/revise-seo-2026-09.js` | Tüm hedef sayfalar artık yayında |
| 13+ | Blog yazılarını admin panelden tek tek yayınla | `smm-panel-nasil-secilir` 6. günden sonra yayınlanmalı |

Her `publish-landing-pages.js` çağrısı IndexNow bildirimini kendisi gönderir;
sitemap otomatik güncellenir. GSC'den elle dizine ekleme isteği göndermeyi unutma.
