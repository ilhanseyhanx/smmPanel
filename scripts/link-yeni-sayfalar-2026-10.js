'use strict';

// YENI SAYFALARA GELEN LINKLER — 2 Eki 2026
// scripts/seed-landing-pages-2026-10.js ile olusan 5 satis sayfasi TASLAK
// olarak bekler. Yayindaki bir sayfadan taslaga link verilirse ziyaretci
// /services adresine yonlenir; bu yuzden gelen linkler sayfa YAYINA ALINDIKTAN
// SONRA eklenir. Bu betik her calistiginda yalnizca hedefi yayinda olan
// ekleri uygular, digerlerini "BEKLIYOR" diye raporlar.
//
// Guvenlik:
//   - IDEMPOTENT: kaynak sayfada hedefe link zaten varsa dokunmaz.
//   - Her ek AYRI yazildi. Gun 12 revizyonunda ayni blok dort sayfaya
//     eklenmis ve sayfalar arasi benzerlik %18-28'e cikmisti; burada her
//     kaynak sayfaya kendi cumlesi girer.
//   - Cumle, sayfanin sonundaki uyari blogunun ONUNE yerlestirilir; uyari
//     her zaman son soz olarak kalir.
//
// Kullanim: cd /var/www/smmjet && node scripts/link-yeni-sayfalar-2026-10.js
//           node scripts/link-yeni-sayfalar-2026-10.js --dry   (yalnizca rapor)

const path = require('path');

const EKLER = [
  // ------------------------------------------------ turk-begeni-satin-al
  {
    hedef: 'turk-begeni-satin-al', kaynak: 'turk-takipci-satin-al',
    tr: '<p>Takipçinin yanında beğenilerin de aynı ülkeden gelmesi profili tutarlı kılar; Instagram ve TikTok için Türkiye kaynaklı beğeni seçenekleri <a href="/turk-begeni-satin-al">Türk beğeni satın al</a> sayfasında toplanmıştır.</p>',
    en: '<p>Having likes come from the same country as followers keeps a profile consistent; Turkey-sourced like options for Instagram and TikTok are gathered on <a href="/turk-begeni-satin-al">buy Turkish likes</a>.</p>'
  },
  {
    hedef: 'turk-begeni-satin-al', kaynak: 'instagram-begeni-satin-al',
    tr: '<p>Beğenenler listesinde Türk hesapların görünmesini istiyorsanız Türkiye kaynaklı paketlerin farkını <a href="/turk-begeni-satin-al">Türk beğeni satın al</a> sayfasında anlattık.</p>',
    en: '<p>If you want Turkish accounts to show in the list of likers, we explain how Turkey-sourced packages differ on <a href="/turk-begeni-satin-al">buy Turkish likes</a>.</p>'
  },
  {
    hedef: 'turk-begeni-satin-al', kaynak: 'tiktok-begeni-satin-al',
    tr: '<p>Türk izleyiciye yönelik videolar için Türkiye kaynaklı beğeni ve izlenme servisleri ayrı listelenir: <a href="/turk-begeni-satin-al">Türk beğeni satın al</a>.</p>',
    en: '<p>For videos aimed at a Turkish audience, Turkey-sourced like and view services are listed separately: <a href="/turk-begeni-satin-al">buy Turkish likes</a>.</p>'
  },

  // -------------------------------- youtube-canli-yayin-izleyici-satin-al
  {
    hedef: 'youtube-canli-yayin-izleyici-satin-al', kaynak: 'canli-yayin-izleyici-satin-al',
    tr: '<p>YouTube yayınları için 15, 60 ve 90 dakikalık eşzamanlı izleyici paketlerini ve süre seçimini <a href="/youtube-canli-yayin-izleyici-satin-al">YouTube canlı yayın izleyici satın al</a> sayfasında ayrıca anlattık.</p>',
    en: '<p>For YouTube streams, the 15, 60 and 90 minute concurrent viewer packages and how to choose a duration are covered separately on <a href="/youtube-canli-yayin-izleyici-satin-al">buy YouTube live stream viewers</a>.</p>'
  },
  {
    hedef: 'youtube-canli-yayin-izleyici-satin-al', kaynak: 'youtube-izlenme-satin-al',
    tr: '<p>Canlı yayın paketlerinde siparişin ne zaman verileceği ve hizmetin neyi kapsamadığı <a href="/youtube-canli-yayin-izleyici-satin-al">YouTube canlı yayın izleyici satın al</a> sayfasındadır.</p>',
    en: '<p>When to place the order for live stream packages, and what the service does not cover, is on <a href="/youtube-canli-yayin-izleyici-satin-al">buy YouTube live stream viewers</a>.</p>'
  },
  {
    hedef: 'youtube-canli-yayin-izleyici-satin-al', kaynak: 'youtube-smm-panel',
    tr: '<p>Canlı yayın yapan kanallar için eşzamanlı izleyici servislerinin ayrıntısı <a href="/youtube-canli-yayin-izleyici-satin-al">YouTube canlı yayın izleyici satın al</a> sayfasında yer alır.</p>',
    en: '<p>For channels that go live, the details of concurrent viewer services are on <a href="/youtube-canli-yayin-izleyici-satin-al">buy YouTube live stream viewers</a>.</p>'
  },

  // ----------------------------------------------- tiktok-kaydetme-satin-al
  {
    hedef: 'tiktok-kaydetme-satin-al', kaynak: 'tiktok-yorum-satin-al',
    tr: '<p>Kaydetme ve paylaşım sayaçlarının hangi içerik türünde doğal durduğunu <a href="/tiktok-kaydetme-satin-al">TikTok kaydetme satın al</a> sayfasında ele aldık.</p>',
    en: '<p>We cover which content types the save and share counters look natural on at <a href="/tiktok-kaydetme-satin-al">buy TikTok saves</a>.</p>'
  },
  {
    hedef: 'tiktok-kaydetme-satin-al', kaynak: 'instagram-kaydetme-satin-al',
    tr: '<p>Aynı içeriği TikTok\'ta da yayınlıyorsanız oradaki karşılığı <a href="/tiktok-kaydetme-satin-al">TikTok kaydetme satın al</a> sayfasındadır.</p>',
    en: '<p>If you publish the same content on TikTok as well, the equivalent there is on <a href="/tiktok-kaydetme-satin-al">buy TikTok saves</a>.</p>'
  },
  {
    hedef: 'tiktok-kaydetme-satin-al', kaynak: 'sosyal-medya-etkilesim-paketi',
    tr: '<p>TikTok videolarında kaydetme ve paylaşım sayaçlarını ayrıca planlamak için <a href="/tiktok-kaydetme-satin-al">TikTok kaydetme satın al</a> sayfasına bakabilirsiniz.</p>',
    en: '<p>To plan the save and share counters on TikTok videos separately, see <a href="/tiktok-kaydetme-satin-al">buy TikTok saves</a>.</p>'
  },

  // ---------------------------------------------- instagram-erisim-satin-al
  {
    hedef: 'instagram-erisim-satin-al', kaynak: 'instagram-izlenme-satin-al',
    tr: '<p>İstatistik ekranındaki erişim, gösterim ve profil ziyareti kalemlerinin ne saydığını <a href="/instagram-erisim-satin-al">Instagram erişim satın al</a> sayfasında açıkladık.</p>',
    en: '<p>What the reach, impressions and profile visit items on the insights screen count is explained on <a href="/instagram-erisim-satin-al">buy Instagram reach</a>.</p>'
  },
  {
    hedef: 'instagram-erisim-satin-al', kaynak: 'instagram-smm-panel',
    tr: '<p>Görüntülenmeyle birlikte erişim ve profil ziyareti veren servisler <a href="/instagram-erisim-satin-al">Instagram erişim satın al</a> sayfasında ayrıca anlatılır.</p>',
    en: '<p>Services that deliver reach and profile visits along with views are covered separately on <a href="/instagram-erisim-satin-al">buy Instagram reach</a>.</p>'
  },

  // ----------------------------------------------------- facebook-smm-panel
  {
    hedef: 'facebook-smm-panel', kaynak: 'facebook-sayfa-begeni-satin-al',
    tr: '<p>Gönderi beğenisi, emoji tepkisi ve paylaşım dahil bütün Facebook servisleri <a href="/facebook-smm-panel">Facebook paneli</a> sayfasında tek tabloda listelenir.</p>',
    en: '<p>Every Facebook service, including post likes, emoji reactions and shares, is listed in one table on the <a href="/facebook-smm-panel">Facebook panel</a>.</p>'
  },
  {
    hedef: 'facebook-smm-panel', kaynak: 'facebook-izlenme-satin-al',
    tr: '<p>Hangi hedef için hangi Facebook servisinin ve hangi bağlantının gerektiğini <a href="/facebook-smm-panel">Facebook paneli</a> sayfasındaki tabloda özetledik.</p>',
    en: '<p>Which Facebook service and which link each goal needs is summarised in the table on the <a href="/facebook-smm-panel">Facebook panel</a>.</p>'
  },
  {
    hedef: 'facebook-smm-panel', kaynak: 'ucuz-smm-panel',
    tr: '<p>Facebook tarafındaki servislerin tamamı için giriş noktası <a href="/facebook-smm-panel">Facebook paneli</a> sayfasıdır.</p>',
    en: '<p>The entry point for all services on the Facebook side is the <a href="/facebook-smm-panel">Facebook panel</a>.</p>'
  },

  // Facebook cati sayfasi, taslaktaki iki Facebook sayfasina yayinlandiklarinda link verir.
  {
    hedef: 'facebook-grup-uye-satin-al', kaynak: 'facebook-smm-panel',
    tr: '<p>Grup üyesi servisinin koşulları ve grup ayarlarında dikkat edilecekler <a href="/facebook-grup-uye-satin-al">Facebook grup üye satın al</a> sayfasındadır.</p>',
    en: '<p>The terms of the group member service and what to watch in group settings are on <a href="/facebook-grup-uye-satin-al">buy Facebook group members</a>.</p>'
  },
  {
    hedef: 'facebook-yorum-satin-al', kaynak: 'facebook-smm-panel',
    tr: '<p>Gönderi yorumu paketlerinin nasıl çalıştığını <a href="/facebook-yorum-satin-al">Facebook yorum satın al</a> sayfasında anlattık.</p>',
    en: '<p>How post comment packages work is explained on <a href="/facebook-yorum-satin-al">buy Facebook comments</a>.</p>'
  }
];

// Yayin takvimindeki "TEK ELLE IS": turk-takipci-mi-yabanci-takipci-mi yazisina
// /turk-takipci-satin-al linki dosyada (blog-drafts/02-...) eklenmis ama
// sunucudaki kayda gitmemisti. "seed-blog-drafts.js --update" TUM taslaklari
// ezdigi icin burada yalnizca o tek cumle eklenir. Yazi taslakken de calisir.
const BLOG_EKLERI = [
  {
    slug: 'turk-takipci-mi-yabanci-takipci-mi', hedef: 'turk-takipci-satin-al',
    // Cumle bu ifadenin hemen ardina girer (yazida tam 1 kez gecmeli).
    sonra: 'Instagram takipçi paketleri</a>.',
    tr: ' Diğer platformlarda Türkiye kaynaklı seçenekleri tek sayfada karşılaştırmak için <a href="/turk-takipci-satin-al">Türk takipçi satın al</a> sayfasına bakabilirsiniz.'
  }
];

/**
 * Cumleyi sayfanin sonundaki uyari blogunun onune yerlestirir.
 * Uyari (blockquote) dogrudan bir h2 basligin altindaysa cumle o basligin
 * onune girer; blockquote yoksa metnin sonuna eklenir.
 */
function yerlestir(html, ek) {
  const kaynak = String(html || '');
  const bq = kaynak.lastIndexOf('<blockquote');
  if (bq === -1) return kaynak + '\n' + ek;
  const h2 = kaynak.lastIndexOf('<h2', bq);
  // Baslik ile uyari arasinda paragraf yoksa baslik uyariya aittir.
  const baslikUyariya = h2 !== -1 && !/<(p|ul|ol|table)[\s>]/i.test(kaynak.slice(h2, bq));
  const yer = baslikUyariya ? h2 : bq;
  return kaynak.slice(0, yer) + ek + '\n' + kaynak.slice(yer);
}

module.exports = { EKLER, BLOG_EKLERI, yerlestir };

if (require.main === module) {
  const sqlite3 = require('sqlite3');
  const { sanitizeRichText } = require('../utils/security');
  const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.join(__dirname, '..', 'database.sqlite');
  const DRY = process.argv.includes('--dry');

  (async () => {
    const db = new sqlite3.Database(dbPath, DRY ? sqlite3.OPEN_READONLY : undefined);
    db.configure('busyTimeout', 5000);
    const get = (q, p = []) => new Promise((r, j) => db.get(q, p, (e, row) => e ? j(e) : r(row)));
    const run = (q, p = []) => new Promise((r, j) => db.run(q, p, function (e) { e ? j(e) : r(this); }));

    let eklenen = 0, bekleyen = 0, atlanan = 0;
    for (const e of EKLER) {
      const etiket = e.kaynak + ' -> /' + e.hedef;
      const hedef = await get('SELECT status FROM landing_pages WHERE slug = ?', [e.hedef]);
      if (!hedef || hedef.status !== 'published') {
        console.log('  BEKLIYOR (hedef yayinda degil): ' + etiket); bekleyen++; continue;
      }
      const row = await get('SELECT id, content_tr, content_en FROM landing_pages WHERE slug = ?', [e.kaynak]);
      if (!row) { console.log('  atlandi (kaynak sayfa yok): ' + etiket); atlanan++; continue; }
      if (String(row.content_tr || '').includes('href="/' + e.hedef + '"')) {
        console.log('  zaten var: ' + etiket); atlanan++; continue;
      }
      const yeniTr = sanitizeRichText(yerlestir(row.content_tr, e.tr));
      const yeniEn = String(row.content_en || '').trim() ? sanitizeRichText(yerlestir(row.content_en, e.en)) : row.content_en;
      if (DRY) { console.log('  [dry] eklenecekti: ' + etiket); eklenen++; continue; }
      await run('UPDATE landing_pages SET content_tr = ?, content_en = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [yeniTr, yeniEn, row.id]);
      console.log('  eklendi: ' + etiket);
      eklenen++;
    }

    for (const e of BLOG_EKLERI) {
      const etiket = 'blog/' + e.slug + ' -> /' + e.hedef;
      const hedef = await get('SELECT status FROM landing_pages WHERE slug = ?', [e.hedef]);
      if (!hedef || hedef.status !== 'published') {
        console.log('  BEKLIYOR (hedef yayinda degil): ' + etiket); bekleyen++; continue;
      }
      const row = await get('SELECT id, content_tr FROM blog_posts WHERE slug = ?', [e.slug]);
      if (!row) { console.log('  atlandi (yazi yok): ' + etiket); atlanan++; continue; }
      const metin = String(row.content_tr || '');
      if (metin.includes('href="/' + e.hedef + '"')) { console.log('  zaten var: ' + etiket); atlanan++; continue; }
      if (metin.split(e.sonra).length !== 2) {
        console.log('  ELLE EKLE (yerlesim ifadesi yazida tam 1 kez gecmiyor): ' + etiket); atlanan++; continue;
      }
      const yeni = sanitizeRichText(metin.replace(e.sonra, () => e.sonra + e.tr));
      if (DRY) { console.log('  [dry] eklenecekti: ' + etiket); eklenen++; continue; }
      await run('UPDATE blog_posts SET content = ?, content_tr = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [yeni, yeni, row.id]);
      console.log('  eklendi: ' + etiket);
      eklenen++;
    }
    db.close();
    console.log('\nBitti: ' + eklenen + ' link ' + (DRY ? 'eklenecekti' : 'eklendi') + ', ' + bekleyen + ' bekliyor, ' + atlanan + ' atlandi.');
    if (!DRY && eklenen) console.log('Sunucu onbellegi 60 sn icinde tazelenir.');
  })().catch(err => { console.error(err); process.exit(1); });
}
