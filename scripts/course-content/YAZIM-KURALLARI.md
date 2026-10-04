# Eğitim İçeriği Yazım Kuralları (Jet SMM Panel)

Bu klasördeki her eğitim, `scripts/seed-course-content.js` ile veritabanına yüklenir.
Bir eğitim = bir klasör: `scripts/course-content/<slug>/`

```
<slug>/
  index.js        -> eğitim bilgileri + ders dosyalarının listesi
  ders-01.js      -> 1. ders
  ders-02.js      -> ...
```

## 1. Dosya biçimi

### index.js
```js
'use strict';
module.exports = {
  slug: 'instagram-0dan-10k',          // VERİLEN slug'ı aynen kullan
  platform: 'instagram',               // instagram | tiktok | youtube | genel
  level_tr: 'Başlangıç', level_en: 'Beginner',   // Başlangıç/Beginner, Orta/Intermediate, İleri/Advanced, Her Seviye/All Levels
  title_tr: '...', title_en: '...',
  subtitle_tr: '...', subtitle_en: '...',        // 1-2 cümle, en fazla 280 karakter
  seo_title_tr: '...', seo_title_en: '...',      // en fazla 60 karakter
  seo_description_tr: '...', seo_description_en: '...', // 130-160 karakter
  cover: { tagline_tr: '...', tagline_en: '...' },       // kapak görselindeki kısa slogan, en fazla 60 karakter
  description_tr: `...HTML...`,   // "Bu eğitimde neler var?" bölümü: 150-300 kelime
  description_en: `...HTML...`,
  lessons: ['ders-01', 'ders-02', ...].map(f => require('./' + f))
};
```

### ders-NN.js
```js
'use strict';
module.exports = {
  slug: 'nisini-ve-hedef-kitleni-sec',   // küçük harf, rakam, tire; Türkçe karakter YOK
  title_tr: '...', title_en: '...',
  summary_tr: '...', summary_en: '...',  // 1-2 cümle (kilitli derste satın almayanlara görünür, Google açıklaması olur)
  visual: {                               // dersin infografiği (aşağıya bak)
    type: 'steps',
    title_tr: '...', title_en: '...',
    items: [ { tr: '...', en: '...' }, ... ]
  },
  content_tr: `...HTML...`,
  content_en: `...HTML...`
};
```

- HTML'i **template literal** (backtick) içine yaz. İçerikte **backtick (`)**, **`${`** ve **ters bölü (\\)** KULLANMA.
- Dosyayı yazdıktan sonra mutlaka doğrula:
  `node -e "const c=require('./scripts/course-content/<slug>/index.js'); console.log(c.lessons.length)"`

## 2. Kapsam ve uzunluk

- Eğitim başına **6-8 ders**.
- Her ders **TR 900-1400 kelime**, EN de aynı derinlikte. EN metni birebir çeviri değil, doğal İngilizce yerelleştirme olsun; yapı, tablolar ve kutular aynı kalsın.
- **İlk 2 ders ücretsizdir** ve vitrin görevi görür: gerçekten değerli, tek başına uygulanabilir olsun. Ama eğitimin geri kalanını merak ettirsin (sonunda bir sonraki derse köprü cümlesi).
- Dersler mantıklı bir sırayla ilerlesin; son ders toparlayıcı bir eylem planı / 30 günlük plan olsun.

## 3. İçerik kuralları (ÇOK ÖNEMLİ)

- **Garanti YOK:** "kesin keşfete düşersin", "garantili 10K", "para kazanmak kesin" gibi ifadeler yasak. "Yol haritası", "strateji", "şansını artırır", "çoğu hesapta işe yarar" dili kullan.
- **Panel servislerine yönlendirme YOK:** takipçi/beğeni/izlenme satın almayı önerme, link verme, ima etme. Eğitim tamamen organik büyüme ve içerik stratejisi üzerine.
- **Platform kuralları değişkendir:** sayısal eşikler (YouTube İş Ortağı Programı şartları, TikTok canlı yayın yaş/takipçi şartı, video süre sınırları vb.) verirken "yazıldığı tarihte (2026) geçerli olan; güncel şartı uygulama içinden kontrol et" uyarısı ekle. Emin olmadığın sayıyı uydurma.
- Uydurma istatistik, uydurma vaka/kişi adı, uydurma araştırma YAZMA. Örnekler varsayımsal olduğunda "örnek senaryo" diye belirt.
- Hitap: "sen" dili, samimi ama profesyonel. Türkiye bağlamı (kafe, kuaför, butik, Türkçe içerik örnekleri) kullan. EN versiyonda örnekler evrensel olsun.
- Yazım: Türkçe karakterler doğru (ı, ğ, ş, ç, ö, ü, İ). Emoji ölçülü (kutu başlıklarında olabilir, paragraflarda değil).

## 4. İzin verilen HTML

Etiketler: `h2, h3, p, strong, em, mark, ul, ol, li, blockquote, table, thead, tbody, tr, th, td, div, span, hr, a, br`
- `h1` KULLANMA (sayfa başlığı zaten h1). Ders içinde `h2` ana bölümler, `h3` alt bölümler.
- Dış link verme. `img` YAZMA (görseller otomatik eklenir).
- `class` yalnızca aşağıdaki bileşenlerde ve yalnızca bu değerlerle çalışır; başka class sunucuda silinir. `style` attribute'u silinir.

### Bileşenler

**Bilgi kutuları** (her derste en az 2 farklı tür):
```html
<div class="crs-callout tip"><strong class="crs-callout-title">💡 İpucu</strong><p>...</p></div>
<div class="crs-callout warn"><strong class="crs-callout-title">⚠️ Dikkat</strong><p>...</p></div>
<div class="crs-callout danger"><strong class="crs-callout-title">⛔ Bunu yapma</strong><p>...</p></div>
<div class="crs-callout info"><strong class="crs-callout-title">ℹ️ Bilgi</strong><p>...</p></div>
<div class="crs-callout success"><strong class="crs-callout-title">✅ Doğru örnek</strong><p>...</p></div>
```
(EN: Tip, Watch out, Don't do this, Good to know, Good example)

**Renkli tablolar** (her derste en az 1):
```html
<table class="crs-table blue">   <!-- renkler: blue | yellow | red | green | purple -->
  <thead><tr><th>...</th><th>...</th></tr></thead>
  <tbody><tr><td>...</td><td><span class="crs-badge good">İyi</span></td></tr></tbody>
</table>
```
Rozetler: `<span class="crs-badge good">`, `bad`, `mid`, `new`.

**Adım kartları:**
```html
<ol class="crs-steps"><li><strong>Başlık.</strong> Açıklama...</li>...</ol>
```

**Kontrol listesi:**
```html
<ul class="crs-checklist"><li>...</li></ul>
```

**İki sütun karşılaştırma:**
```html
<div class="crs-compare">
  <div class="crs-compare-col bad"><strong class="crs-compare-title">❌ Yanlış</strong><ul><li>...</li></ul></div>
  <div class="crs-compare-col good"><strong class="crs-compare-title">✅ Doğru</strong><ul><li>...</li></ul></div>
</div>
```

**Örnek metin / şablon kutusu** (bio, kanca cümlesi, mesaj şablonu vb.):
```html
<div class="crs-template"><span class="crs-template-label">Şablon</span><p>...</p></div>
```

**Ders sonu (her derste ZORUNLU, bu sırayla en sonda):**
```html
<div class="crs-keypoints"><strong class="crs-callout-title">📌 Bu derste öğrendiklerin</strong><ul><li>...</li></ul></div>
<div class="crs-task"><strong class="crs-callout-title">🎯 Görevin</strong><p>...</p></div>
```
(EN: 📌 Key takeaways / 🎯 Your task)

Önemli bir kavramı vurgulamak için `<mark>` kullanabilirsin (paragraf başına en fazla bir kez).

## 5. Görsel yeri ve infografik

- Her dersin içeriğinde giriş paragrafından (1-2 paragraf) sonra tek başına bir satıra `<!--GORSEL-->` yaz. Dersin infografiği oraya otomatik yerleşir. (TR ve EN içerikte ayrı ayrı yaz.)
- `visual` alanı infografiği tarif eder; görsel 1200x675 bir kart olarak çizilir:

| type | Ne çizilir | items |
|---|---|---|
| `steps` | numaralı adım akışı (oklarla) | 3-5 madde, her biri en fazla 38 karakter |
| `checklist` | işaretli kontrol listesi | 4-6 madde, en fazla 48 karakter |
| `compare` | iki sütun: sol yanlış / sağ doğru | 6 madde: ilk 3 = yanlış, son 3 = doğru; en fazla 34 karakter |
| `timeline` | gün/hafta zaman çizelgesi | 3-5 madde; `{ tr, en, value: 'Gün 1' / 'Day 1' }` gibi value_tr/value_en ekle |
| `bars` | yatay çubuk (oran/öncelik) | 3-5 madde, `value`: 0-100 sayı (göreli önem/ağırlık; yüzde iddiası değil, başlıkta "göreli" de) |
| `funnel` | huni (ziyaretçi → takipçi → müşteri vb.) | 3-4 madde, en fazla 30 karakter |

- `title_tr`/`title_en` en fazla 52 karakter. Görsel metinleri kısa ve net olsun.
- 10 eğitimde çeşitlilik: bir eğitimdeki derslerde en az 3 farklı `type` kullan.

## 6. Kalite kontrol (bitirmeden önce)

- [ ] Her derste: giriş, `<!--GORSEL-->`, en az 2 `h2`, en az 1 `crs-table`, en az 2 `crs-callout`, `crs-steps` veya `crs-checklist`, en sonda `crs-keypoints` + `crs-task`
- [ ] TR ve EN içerik aynı yapıda
- [ ] Garanti ifadesi yok, servis/satın alma yönlendirmesi yok, uydurma istatistik yok
- [ ] Slug'lar benzersiz, Türkçe karakter yok
- [ ] `node -e "require(...)"` hatasız çalışıyor; her dersin kelime sayısını kontrol et:
  `node -e "const c=require('./scripts/course-content/<slug>/index.js');c.lessons.forEach(l=>console.log(l.slug,l.content_tr.replace(/<[^>]+>/g,' ').split(/\s+/).filter(Boolean).length,l.content_en.replace(/<[^>]+>/g,' ').split(/\s+/).filter(Boolean).length))"`
