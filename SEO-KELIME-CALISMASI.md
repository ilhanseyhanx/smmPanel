# SMMJET Kelime Çalışması — Eylül 2026

Bu doküman, jetsmmpanel.com için yapılan anahtar kelime araştırmasının ve
5 yeni satış sayfası kararının kaydıdır. Sayfa metinleri
`scripts/seed-landing-pages-2026-09.js` içindedir.

## Yöntem

1. **Kapsam boşluğu analizi:** Canlı katalogda aktif servisi olduğu hâlde
   hiçbir satış sayfasında listelenmeyen kategoriler çıkarıldı (25 mevcut
   sayfanın category_ids alanları ile aktif servis kategorileri karşılaştırıldı).
2. **SERP kontrolü:** Aday kelimeler Google'da tarandı; hepsinde ticari
   niyetli, adanmış "satın al" sayfalarıyla dolu Türkçe sonuçlar var
   (sopsosyal, bayigram, takipci.al, sosyoperest, organiktrafik...).
   Rakip başlık kalıbı: "X Satın Al – %100 Türk / Gerçek / Anında".
3. **Seçim ölçütü:** aranma hacmi × katalogdaki servis kalitesi × rekabet
   boşluğu. WhatsApp gibi yeni yükselen kelimelerde rekabet henüz zayıf.

## Site geneli kelime haritası (mevcut durum)

| Kelime kümesi | Hedef sayfa | Durum |
|---|---|---|
| smm panel, smm panel nedir | / (ana sayfa) + blog | Yayında |
| instagram takipçi/beğeni/izlenme satın al | 5 Instagram sayfası | Yayında |
| tiktok takipçi/beğeni/izlenme satın al | 4 TikTok sayfası | Yayında |
| youtube abone/izlenme satın al | 2 YouTube sayfası | Yayında |
| telegram üye/görüntülenme satın al | 2 Telegram sayfası | Yayında |
| twitter takipçi, beğeni-retweet | 2 Twitter sayfası | Yayında |
| **youtube beğeni satın al** | — | **BOŞLUKTU → yeni sayfa** |
| **whatsapp kanal üye satın al** | — | **BOŞLUKTU → yeni sayfa** |
| **web sitesi trafik satın al / organik hit** | — | **BOŞLUKTU → yeni sayfa** |
| **tweet görüntülenme satın al** | — | **BOŞLUKTU → yeni sayfa** |
| **tiktok yorum satın al** | — | **BOŞLUKTU → yeni sayfa** |

## Yeni 5 sayfa ve kelime hedefleri

### 1. /youtube-begeni-satin-al (kategori 257 + 259)
- **Birincil:** youtube beğeni satın al
- **İkincil:** youtube video beğeni, youtube yorum satın al, youtube like satın al
- **Uzun kuyruk:** youtube beğeni satın al güvenilir, youtube 30 gün garantili beğeni, youtube ai yorum
- Katalog dayanağı: 30 gün yenilemeli HQ beğeni (saatlik 1K), 0-1 saat başlangıçlı ekonomik paket, içeriğe özel AI yorum (30 gün yenileme, ABD).

### 2. /whatsapp-kanal-uye-satin-al (kategori 256 + 251)
- **Birincil:** whatsapp kanal üye satın al
- **İkincil:** whatsapp kanal takipçi satın al, whatsapp emoji tepki satın al
- **Uzun kuyruk:** whatsapp kanal üyesi nasıl artırılır, whatsapp kanal büyütme
- Not: Yeni yükselen kelime; rakip sayfalar var ama otorite düşük. Platform anahtarı `social-media` (PLATFORMS listesinde whatsapp yok).

### 3. /web-sitesi-trafik-satin-al (kategori 255)
- **Birincil:** web sitesi trafik satın al
- **İkincil:** organik trafik satın al, hit satın al, site ziyaretçi satın al
- **Uzun kuyruk:** google üzerinden organik trafik, analytics'te görünen trafik
- Not: "Organik/Google yönlendirmeli" ifadesi SAĞLAYICI beyanıdır; sayfada
  SEO sıralaması garantisi verilmez (içerik kuralı). Mevcut
  "web-sitesi-trafigini-artirmanin-seo-ya-etkisi..." blog yazısı bu sayfaya bağlanır.

### 4. /twitter-goruntulenme-satin-al (kategori 166)
- **Birincil:** tweet görüntülenme satın al
- **İkincil:** twitter görüntülenme satın al, x görüntülenme, tweet izlenme
- **Uzun kuyruk:** tweet gösterim ve profil ziyareti artırma, ömür boyu garantili tweet görüntülenme
- Katalog dayanağı: ₺0.31/1000'den başlayan, görüntülenme+gösterim+etkileşim+profil ziyareti paketleri; ömür boyu garantili seçenek.

### 5. /tiktok-yorum-satin-al (kategori 240 + 238 + 236 + 233)
- **Birincil:** tiktok yorum satın al
- **İkincil:** tiktok gerçek yorum, tiktok paylaşım satın al, tiktok kaydetme satın al
- **Uzun kuyruk:** tiktok videoyla ilgili yorum, tiktok etkileşim paketi, tiktok hikaye izlenme
- Katalog dayanağı: %100 gerçek kullanıcılardan gönderiyle ilgili yorumlar (emoji+metin, sabit paketler), sınırsız paylaşım/kaydetme, hikaye görüntülenme.

## İçerik kuralları (8 Eyl 2026 revizyonundan devam)

- SEO sonucu, sıralama, önerilenlere girme, para kazanma **GARANTİSİ YOK**.
- Sağlayıcının teknik beyanı ile bizim cümlemiz ayrılır: "sağlayıcı ... olarak belirtir".
- Katalogdaki "Yenileme Yok / Garantisiz / İptal Aktif" etiketleri gizlenmez, açıkça yazılır.
- Fiyat/limit değerleri sayfa gövdesinde tekrarlanmaz; canlı tablodan gelir.

## Sonraki adımlar (yayın sırası önerisi)

1. Seed script sunucuda çalıştırılır → 5 sayfa TASLAK olarak oluşur.
2. Admin panelden içerik gözden geçirilir → yayına alınır (yeni tek-tık düğmesiyle).
3. Yayın sonrası: sitemap otomatik güncellenir, IndexNow bildirimi otomatik gider.
4. GSC + Bing'e 5 yeni URL elle de bildirilebilir (gsc-bing-url-listesi.txt'ye eklendi).
5. 2-4 hafta sonra GSC "Performans" ekranından kelime bazlı tıklama takibi;
   görüntülenme alan ama tıklanmayan kelimelerde meta açıklama revizyonu.
