'use strict';

// YAYINDAKI ICERIK REVIZYONU — 20 Eyl 2026
// Dayanak: SEO-ANALIZ-2026-09-20.md (GSC, 13 Agu - 17 Eyl)
//
// Bu betik YENI sayfa olusturmaz; YAYINDAKI yazi ve satis sayfalarinda uc
// hedefli duzeltme yapar. Hepsi IDEMPOTENT: ikinci kez calistirilirsa
// degisiklik yapmaz, "zaten guncel" der.
//
//  1) BASLIK DUZELTMESI (influencer yazisi)
//     GSC: "fenomen olmak icin kac takipci lazim" — 2 gosterim, pozisyon 85.
//     Yazinin basliginda "fenomen" kelimesi hic gecmiyor; Turkiye'de bu
//     kelime "influencer"dan daha sik araniyor. Baslige parantezle eklenir.
//
//  2) EKSIK SATIS SAYFASI LINKLERI (3 yayindaki yazi)
//     Gosterim alan yazilar, ilgili satis sayfasina METIN ICI link vermiyor;
//     gosterim bloga dusup satisa donmuyor. En kritik ornek:
//     "instagram hikaye izlenme arttirma" 8 gosterim blog yazisina geliyor
//     ama /instagram-hikaye-izlenme-satin-al sayfasi 36 gunde TEK gosterim
//     almadi. Her yazinin sonuna "Ilgili hizmetler" bolumu eklenir.
//
//  3) MIKTAR VE TURK TAKIPCI BOLUMU (4 satis sayfasi)
//     GSC: "50000 twitter takipci satin al" (4 gos, poz 76), "2000 twitter
//     takipci satin al" (poz 79), "2000 twitter turk takipci satin al"
//     (poz 85). Miktar ve "turk" modifier'lari sayfalarda hic karsilanmiyor.
//     Ilgili takipci sayfalarina miktar rehberi + Turkiye kaynagi bolumu
//     eklenir.
//
// Kullanim: cd /var/www/smmjet && node scripts/revise-seo-2026-09.js
//           node scripts/revise-seo-2026-09.js --dry   (yalnizca rapor)

const path = require('path');
const sqlite3 = require('sqlite3');
const { sanitizeRichText, normalizePlainText } = require('../utils/security');

const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.join(__dirname, '..', 'database.sqlite');
const DRY = process.argv.includes('--dry');

// --- 1) Baslik duzeltmeleri -------------------------------------------------
const BASLIKLAR = [{
  slug: 'influencer-olmak-icin-kac-takipci-gerekir',
  title_tr: 'İnfluencer (Fenomen) Olmak İçin Kaç Takipçi Gerekir? 2026 Eşikleri',
  seo_title_tr: 'İnfluencer (Fenomen) Olmak İçin Kaç Takipçi Gerekir? 2026',
  // Aranan kelime basligin ILK yarisinda gecsin diye "fenomen" parantez icinde
  // influencer'in hemen yanina konuldu; mevcut kelimeyi kaybetmeden ikinci
  // kelime kazanilir.
  isaret: 'Fenomen'
}];

// --- 2) Yazi sonuna eklenecek "Ilgili hizmetler" bolumleri ------------------
const ISARET_HIZMET = 'Bu yazıyla ilgili hizmetler';
// ONEMLI: Eklenen metinler HENUZ TASLAK olabilecek satis sayfalarina link
// verir. Bir sayfa yayinda degilken link eklenirse yayindaki yaziya 404
// baglanti konmus olur. Bu yuzden her ekin "gerekli" listesindeki TUM satis
// sayfalari published degilse o ek ATLANIR ve hangi sayfanin beklendigi
// yazilir. Sayfalari yayina aldiktan sonra betigi tekrar calistirmak yeterli.
const YAZI_EKLERI = [
  {
    slug: 'instagram-hikaye-izlenme-artirma-taktikleri',
    gerekli: ['instagram-hikaye-izlenme-satin-al', 'sosyal-medya-etkilesim-paketi', 'instagram-smm-panel'],
    tr: `<h2>${ISARET_HIZMET}</h2>
<p>Hikaye izlenmelerinizi içerikle artırmanın yolları yukarıda; sayacı doğrudan yükseltmek isterseniz <a href="/instagram-hikaye-izlenme-satin-al">Instagram hikaye izlenme satın al</a> sayfasındaki paketlere bakabilirsiniz. Hikayeler 24 saat sonra kalktığı için siparişin hikaye yayındayken verilmesi gerekir. Beğeni, yorum ve kaydetme gibi tamamlayıcı sayaçları birlikte planlamak için <a href="/sosyal-medya-etkilesim-paketi">sosyal medya etkileşim paketi</a>, Instagram'daki tüm hizmetler için <a href="/instagram-smm-panel">Instagram paneli</a> sayfası giriş noktasıdır.</p>`,
    en: `<h2>Services related to this article</h2>
<p>Ways to raise story views with content are above; to lift the counter directly, see the packages on <a href="/instagram-hikaye-izlenme-satin-al">buy Instagram story views</a>. Since stories expire after 24 hours, the order must be placed while the story is live. To plan complementary counters such as likes, comments and saves together, the <a href="/sosyal-medya-etkilesim-paketi">social media engagement package</a> and, for every Instagram service, the <a href="/instagram-smm-panel">Instagram panel</a> are the entry points.</p>`
  },
  {
    slug: 'tiktok-algoritmasi-nasil-calisir',
    gerekli: ['tiktok-izlenme-satin-al', 'tiktok-begeni-satin-al', 'tiktok-smm-panel'],
    tr: `<h2>${ISARET_HIZMET}</h2>
<p>Algoritmanın dağıtımı içerikle kurulur; bu yazıdaki adımlar onun içindir. Sayaç tarafında destek almak isterseniz <a href="/tiktok-izlenme-satin-al">TikTok izlenme satın al</a> ve <a href="/tiktok-begeni-satin-al">TikTok beğeni satın al</a> sayfalarındaki paketleri inceleyebilirsiniz. Platformun tüm hizmetlerinin giriş noktası <a href="/tiktok-smm-panel">TikTok panelidir</a>. Satın alınan hiçbir sayaç keşfete çıkma veya önerilenlere girme sonucu taahhüt etmez; bu yazının ana fikri de budur.</p>`,
    en: `<h2>Services related to this article</h2>
<p>Algorithmic distribution is built with content, which is what the steps above are for. For support on the counter side, see the packages on <a href="/tiktok-izlenme-satin-al">buy TikTok views</a> and <a href="/tiktok-begeni-satin-al">buy TikTok likes</a>. The entry point to every service is the <a href="/tiktok-smm-panel">TikTok panel</a>. No purchased counter promises reaching the For You feed or the suggested list — that is this article's main point.</p>`
  },
  {
    slug: 'influencer-olmak-icin-kac-takipci-gerekir',
    gerekli: ['instagram-takipci-satin-al', 'turk-takipci-satin-al'],
    tr: `<h2>${ISARET_HIZMET}</h2>
<p>Eşikleri aşmanın kalıcı yolu içerik ve etkileşim oranıdır. Profilin ilk güven eşiğini geçmesi için ölçülü bir başlangıç isterseniz <a href="/instagram-takipci-satin-al">Instagram takipçi satın al</a> sayfasındaki paketlere bakabilirsiniz; Türk markalarıyla çalışmayı hedefliyorsanız kitle dağılımınızın tutarlı olması için <a href="/turk-takipci-satin-al">Türk takipçi satın al</a> sayfasındaki kaynak ülkesi açıklaması önemlidir. Takipçi sayısının tek başına yeterli olmadığını, marka tarafının etkileşim oranına baktığını yukarıda anlattık.</p>`,
    en: `<h2>Services related to this article</h2>
<p>The lasting route past the thresholds is content and engagement rate. For a measured start so your profile clears the first credibility threshold, see the packages on <a href="/instagram-takipci-satin-al">buy Instagram followers</a>; if you are aiming to work with Turkish brands, the source-country explanation on <a href="/turk-takipci-satin-al">buy Turkish followers</a> matters for a consistent audience breakdown. As explained above, follower count alone is not enough — brands look at the engagement rate.</p>`
  }
];

// --- 3) Satis sayfalarina miktar + Turkiye kaynagi bolumu -------------------
const ISARET_MIKTAR = 'Ne kadar almalı?';
const bolumTr = (birim, ornek) => `<h2>${ISARET_MIKTAR} Miktar rehberi</h2>
<p>En sık yapılan hata, mevcut ${birim} sayısıyla orantısız bir paketi tek seferde yüklemektir. Ani sıçrama hem etkileşim oranını bozar hem de düşüş riskini artırır. Pratik ölçü şudur: <strong>tek seferde mevcut ${birim} sayınızın %10-20'sini aşmayın.</strong> ${ornek} gibi büyük paketleri tek siparişte değil, birkaç güne yayarak alın; teslimat hızı seçeneği olan servislerde bu tercih hizmet kartında belirtilir.</p>
<h3>Türkiye kaynaklı seçenek</h3>
<p>Türkçe içerik üreten ve Türk kitleye hitap eden hesaplarda kaynak ülkesi etkileşim oranını doğrudan etkiler: gönderiyi anlamayan bir hesap etkileşime girmez ve istatistiklerdeki kitle dağılımı bozulur. Yukarıdaki tabloda ülke filtresinden 🇹🇷 Türkiye seçeneğini işaretleyerek Türkiye kaynaklı servisleri ayırabilirsiniz. Platformlar arası karşılaştırma için <a href="/turk-takipci-satin-al">Türk takipçi satın al</a> sayfasına, oranın nasıl hesaplandığı için <a href="/blog/sosyal-medya-etkilesim-orani-hesaplama-rehberi">etkileşim oranı rehberine</a> bakabilirsiniz. "%100 Türk" ifadesi sağlayıcının beyanıdır; panel bu bilgiyi olduğu gibi aktarır.</p>`;
const bolumEn = (unit, sample) => `<h2>How many should you buy? A quantity guide</h2>
<p>The most common mistake is loading a package out of proportion with your current ${unit} count in one go. A sudden jump both distorts the engagement rate and raises drop risk. A practical rule: <strong>do not exceed 10-20% of your current ${unit} count at once.</strong> Take large packages such as ${sample} over several days rather than in a single order; where a service offers a speed option, it is stated on the card.</p>
<h3>The Turkey-sourced option</h3>
<p>For accounts producing Turkish content for a Turkish audience, source country directly affects the engagement rate: an account that does not understand the post will not engage, and the audience breakdown in your statistics is skewed. Select 🇹🇷 Turkey in the country filter of the table above to isolate Turkey-sourced services. For a cross-platform comparison see <a href="/turk-takipci-satin-al">buy Turkish followers</a>, and for how the ratio is calculated the <a href="/blog/sosyal-medya-etkilesim-orani-hesaplama-rehberi">engagement rate guide</a>. "100% Turkish" is the provider's statement; the panel passes it on as-is.</p>`;

const SAYFA_EKLERI = [
  { slug: 'instagram-takipci-satin-al', gerekli: ['turk-takipci-satin-al'], tr: bolumTr('takipçi', '10.000'), en: bolumEn('follower', '10,000') },
  { slug: 'tiktok-takipci-satin-al', gerekli: ['turk-takipci-satin-al'], tr: bolumTr('takipçi', '10.000'), en: bolumEn('follower', '10,000') },
  { slug: 'twitter-takipci-satin-al', gerekli: ['turk-takipci-satin-al'], tr: bolumTr('takipçi', '2.000 veya 50.000'), en: bolumEn('follower', '2,000 or 50,000') },
  { slug: 'youtube-abone-satin-al', gerekli: ['turk-takipci-satin-al'], tr: bolumTr('abone', '10.000'), en: bolumEn('subscriber', '10,000') }
];

(async () => {
  const db = new sqlite3.Database(dbPath);
  db.configure('busyTimeout', 5000);
  const get = (q, p = []) => new Promise((r, j) => db.get(q, p, (e, row) => e ? j(e) : r(row)));
  const run = (q, p = []) => new Promise((r, j) => db.run(q, p, function (e) { e ? j(e) : r(this); }));

  let degisen = 0, atlanan = 0;
  const yaz = async (sql, prm, mesaj) => {
    if (DRY) { console.log('[dry] ' + mesaj); degisen++; return; }
    await run(sql, prm); console.log(mesaj); degisen++;
  };

  /**
   * Ek metnin link verdigi satis sayfalari YAYINDA mi?
   * Degilse ek atlanir; aksi halde yayindaki icerige 404 baglanti konur.
   * @returns {string[]} yayinda OLMAYAN slug'lar (bos dizi = ekleme serbest)
   */
  async function eksikSayfalar(gerekli) {
    const eksik = [];
    for (const s of gerekli || []) {
      const row = await get('SELECT status FROM landing_pages WHERE slug = ?', [s]);
      if (!row || row.status !== 'published') eksik.push(s);
    }
    return eksik;
  }

  // 1) Basliklar
  console.log('--- 1) Baslik duzeltmeleri ---');
  for (const b of BASLIKLAR) {
    const row = await get('SELECT id, title_tr, status FROM blog_posts WHERE slug = ?', [b.slug]);
    if (!row) { console.log('  yok, atlandi: ' + b.slug); atlanan++; continue; }
    if (String(row.title_tr || '').includes(b.isaret)) { console.log('  zaten guncel: ' + b.slug); atlanan++; continue; }
    const t = normalizePlainText(b.title_tr, 180);
    await yaz('UPDATE blog_posts SET title = ?, title_tr = ?, seo_title_tr = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [t, t, normalizePlainText(b.seo_title_tr, 180), row.id],
      '  baslik guncellendi: ' + b.slug + ' -> ' + t);
  }

  // 2) Yazi sonuna ilgili hizmetler bolumu
  console.log('--- 2) Yazilara "ilgili hizmetler" bolumu ---');
  for (const e of YAZI_EKLERI) {
    const row = await get('SELECT id, content_tr, content_en, content FROM blog_posts WHERE slug = ?', [e.slug]);
    if (!row) { console.log('  yok, atlandi: ' + e.slug); atlanan++; continue; }
    if (String(row.content_tr || '').includes(ISARET_HIZMET)) { console.log('  zaten var: ' + e.slug); atlanan++; continue; }
    const eksik = await eksikSayfalar(e.gerekli);
    if (eksik.length) {
      console.log('  BEKLIYOR: ' + e.slug + ' — once su sayfalar yayina alinmali: ' + eksik.join(', '));
      atlanan++; continue;
    }
    const yeniTr = sanitizeRichText(String(row.content_tr || '') + '\n' + e.tr);
    const yeniEn = String(row.content_en || '').trim()
      ? sanitizeRichText(String(row.content_en) + '\n' + e.en) : row.content_en;
    await yaz('UPDATE blog_posts SET content = ?, content_tr = ?, content_en = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [yeniTr, yeniTr, yeniEn, row.id], '  bolum eklendi: ' + e.slug);
  }

  // 3) Satis sayfalarina miktar + Turkiye bolumu
  console.log('--- 3) Satis sayfalarina miktar/Turkiye bolumu ---');
  for (const e of SAYFA_EKLERI) {
    const row = await get('SELECT id, content_tr, content_en FROM landing_pages WHERE slug = ?', [e.slug]);
    if (!row) { console.log('  yok, atlandi: ' + e.slug); atlanan++; continue; }
    if (String(row.content_tr || '').includes(ISARET_MIKTAR)) { console.log('  zaten var: ' + e.slug); atlanan++; continue; }
    const eksik = await eksikSayfalar(e.gerekli);
    if (eksik.length) {
      console.log('  BEKLIYOR: ' + e.slug + ' — once su sayfalar yayina alinmali: ' + eksik.join(', '));
      atlanan++; continue;
    }
    const yeniTr = sanitizeRichText(String(row.content_tr || '') + '\n' + e.tr);
    const yeniEn = String(row.content_en || '').trim()
      ? sanitizeRichText(String(row.content_en) + '\n' + e.en) : row.content_en;
    await yaz('UPDATE landing_pages SET content_tr = ?, content_en = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [yeniTr, yeniEn, row.id], '  bolum eklendi: ' + e.slug);
  }

  db.close();
  console.log(`\nBitti: ${degisen} kayit ${DRY ? 'degisecekti' : 'guncellendi'}, ${atlanan} atlandi.`);
  if (!DRY && degisen) {
    console.log('Sunucu onbellegi 60 sn icinde tazelenir.');
    console.log('Guncellenen adresleri Bing/IndexNow\'a bildirmek isterseniz:');
    console.log('  node scripts/publish-landing-pages.js   (yayindakilere dokunmaz, yalnizca taslak listeler)');
  }
})().catch(err => { console.error(err); process.exit(1); });
