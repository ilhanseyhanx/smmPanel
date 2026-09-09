// ============================================================================
// DEPRECATED / DO NOT RUN AGAINST CURRENT PRODUCTION
// KULLANIM DISI — GUNCEL PRODUCTION UZERINDE CALISTIRMAYIN
// ============================================================================
//
// Bu betik 27 Agustos 2026 tarihinde TEK SEFERLIK bir gecis icin yazildi:
// kullanici butun servisleri silip yeniden ekleyince bloglardaki eski
// "#services?service=<ESKI_ID>" baglantilari kirilmisti; betik bunlari o
// gunun katalogundaki yeni ID lere cevirdi.
//
// NEDEN ARTIK CALISTIRILMAMALI:
//
//  1) Servis ID eslestirmeleri SABIT KODLU ve 27 Agustos 2026 katalogundan.
//     Katalog o tarihten sonra degisti; bugun calistirilirsa bloglara
//     YANLIS veya olmayan servislere giden baglantilar yazar.
//
//  2) Baglanti bicimi de degisti. 28 Agustos 2026 itibariyla blog ici servis
//     baglantilari "/services?service=<ID>" degil, dogrudan satis sayfasi
//     adresidir (or. /instagram-takipci-satin-al). Bu betik eski bicime geri
//     dondurur.
//
//  3) "--apply" ile calistirildiginda blog_posts tablosuna YAZAR:
//        UPDATE blog_posts SET content_tr = ?, content_en = ? WHERE id = ?
//     Bu sutunlar 8 Eylul 2026 SEO calismasindaki ic baglantilari da
//     tasiyor; betik onlari sessizce EZER.
//
// SAKLANMA SEBEBI: yalnizca tarihsel kayit. Blog metinlerinde yapilan
// editoryal duzeltmelerin (or. gerceklesmeyen "365 gun telafi" iddialarinin
// kaldirilmasi) hangi cumlelerde yapildigini belgeler.
//
// Uygulama oncesi veritabani yedegi:
//   /var/backups/smmjet/db-before-linkfix-20260827-220803.sqlite
// ============================================================================
// Blog yazilarindaki silinmis servis linklerini yeni katalogdaki servislere cevirir.
// Kullanim: node fix-blog-service-links.js <db yolu> [--apply]
const path = require('path');
const sqlite3 = require(path.join(process.cwd(), 'node_modules', 'sqlite3'));
const dbPath = process.argv[2];
const APPLY = process.argv.includes('--apply');
if (!dbPath) { console.error('db yolu gerekli'); process.exit(1); }
const db = new sqlite3.Database(dbPath);
const all = (q, p = []) => new Promise((r, j) => db.all(q, p, (e, rows) => e ? j(e) : r(rows)));
const run = (q, p = []) => new Promise((r, j) => db.run(q, p, function (e) { e ? j(e) : r(this); }));

// Eski anchor'u bul: <a href="#services?service=OLD" ...>METIN</a>
const A = (oldId) => new RegExp(`<a href="#services\\?service=${oldId}"[^>]*>[^<]*<\\/a>`, 'g');
const L = (id, text) => `<a href="/services?service=${id}">${text}</a>`;
const G = (text) => `<a href="/services">${text}</a>`;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const S = (str) => new RegExp(esc(str), 'g'); // duz metin -> regex

// Her giris: [regex, yeni metin]. Her regex tam 1 kez eslesmeli.
const EDITS = {
  1: {
    tr: [
      [A(410), L(540, 'Instagram Görüntülenme + Erişim + Gösterim')],
      [A(424), L(534, 'Instagram Paylaşım')],
      [A(431), L(542, 'Instagram Takipçi')],
      [S('hizmetini kademeli biçimde kullanın; 365 gün telafi kapsamındadır.'), 'hizmetini kademeli biçimde kullanın; gönderili gerçek hesaplardan gelir ve sipariş iptal edilebilir.'],
    ],
    en: [
      [A(410), L(540, 'Instagram Views + Reach + Impressions')],
      [A(424), L(534, 'Instagram Shares')],
      [A(431), L(542, 'Instagram Followers')],
      [S(', delivered gradually and covered by 365-day refill.'), ', delivered gradually — sourced from real accounts with posts, and the order can be cancelled.'],
    ],
  },
  2: {
    tr: [
      [A(385), L(625, 'TikTok Video Görüntülenme')],
      [S('kademeli gönderimle kullanın; ömür boyu telafi kapsamındadır.'), 'kademeli gönderimle kullanın; 30 gün yenileme kapsamındadır.'],
      [A(262), L(607, 'TikTok Beğeni')],
      [A(390), L(633, 'TikTok Video Kaydetme')],
    ],
    en: [
      [A(385), L(625, 'TikTok Video Views')],
      [S('it is covered by lifetime refill.'), 'it is covered by a 30-day refill.'],
      [A(262), L(607, 'TikTok Likes')],
      [A(390), L(633, 'TikTok Video Saves')],
    ],
  },
  3: {
    tr: [
      [A(250), L(505, 'Instagram Beğeni (Profil Fotoğraflı Hesaplar, Düşük Düşüş)')],
      [S('hizmeti, düşüş yaşanması durumunda beğenileri otomatik tamamlar.'), 'hizmeti düşük düşüş oranıyla çalışır; yenileme/garanti koşulu her hizmet kartında ayrıca belirtilir, sipariş öncesi mutlaka kontrol edin.'],
      [A(244), L(505, 'Profil Fotoğraflı Hesaplardan Instagram Beğeni')],
      [A(253), L(503, 'Instagram Beğeni (Yüksek Hız)')],
      [S('ile hızlı yerel etkileşim'), 'ile hızlı etkileşim'],
    ],
    en: [
      [A(250), L(505, 'Instagram Likes (Profile-Photo Accounts, Low Drop)')],
      [S('service automatically replenishes likes if any drop occurs.'), 'service runs with a low drop rate; refill/guarantee terms are stated on each service card, so always check before ordering.'],
      [A(244), L(505, 'Instagram Likes from Profile-Photo Accounts')],
      [A(253), L(503, 'Instagram Likes (High Speed)')],
      [S('Fast local engagement via'), 'Fast engagement via'],
    ],
  },
  4: {
    tr: [
      [A(298), L(574, 'Spotify Takipçi (HQ, 60 Gün Yenileme)')],
      [A(296), L(569, 'Spotify Premium Dinlenme')],
      [A(295), L(566, 'Spotify Ücretsiz Dinlenme')],
      [A(297), L(569, 'Spotify Premium Dinlenme')],
    ],
    en: [
      [A(298), L(574, 'Spotify Followers (HQ, 60-Day Refill)')],
      [A(296), L(569, 'Spotify Premium Plays')],
      [A(295), L(566, 'Spotify Free Plays')],
      [A(297), L(569, 'Spotify Premium Plays')],
    ],
  },
  5: {
    tr: [
      [new RegExp(`SMMJET üzerindeki ${A(266).source} gibi yüksek kaliteli hesaplardan gelen destekler`), `Jet SMM Panel'in ${G('hizmet listesindeki')} beğeni ve etkileşim destekleri`],
      [new RegExp(`${A(263).source} gibi küçük ölçekli bir destekle`), `${G('küçük ölçekli bir beğeni desteğiyle')}`],
      [new RegExp(`${A(265).source} ile ek destek gerekip gerekmediğine`), `${G('ek bir destek paketi')} gerekip gerekmediğine`],
    ],
    en: [
      [new RegExp(`support from high-quality accounts such as the ${A(266).source} on SMMJET can accelerate`), `like and engagement support from Jet SMM Panel's ${G('service list')} can accelerate`],
      [new RegExp(`with a smaller-scale option like the ${A(263).source}\\.`), `with a ${G('small-scale like package')}.`],
      [new RegExp(`additional support like the ${A(265).source} is needed`), `an ${G('additional support package')} is needed`],
    ],
  },
  6: {
    tr: [
      [A(262), L(607, 'TikTok Beğeni (Gerçek Hesaplar, 30 Gün Yenileme)')],
      [new RegExp(`Beğeni ve izlenmeyi birlikte güçlendirmek için ${A(258).source} paketini`), `İzlenme ve paylaşımı birlikte güçlendirmek için ${L(630, 'TikTok Görüntülenme + Paylaşım')} paketini`],
      [new RegExp(`Türkiye kitlesine odaklanıyorsanız SMMJET'teki ${A(261).source} hizmetini`), `Düşüş riskini en aza indirmek istiyorsanız Jet SMM Panel'deki ${L(609, '60 gün yenilemeli TikTok Beğeni')} hizmetini`],
    ],
    en: [
      [A(262), L(607, 'TikTok Likes (Real Accounts, 30-Day Refill)')],
      [new RegExp(`Strengthen both likes and views together with the ${A(258).source} package\\.`), `Strengthen views and shares together with the ${L(630, 'TikTok Views + Shares')} package.`],
      [new RegExp(`If your audience is in Turkey, also check out ${A(261).source} on SMMJET\\.`), `If you want to minimise drop risk, also check out ${L(609, 'TikTok Likes with 60-day refill')} on Jet SMM Panel.`],
    ],
  },
  9: {
    tr: [
      [A(256), L(540, 'Instagram Görüntülenme (Video + Reels)')],
      [A(410), L(537, 'Instagram Reels Erişim + Gösterim')],
      [A(246), L(505, 'Instagram Beğeni')],
    ],
    en: [
      [A(256), L(540, 'Instagram Views (Video + Reels)')],
      [A(410), L(537, 'Instagram Reels Reach + Impressions')],
      [A(246), L(505, 'Instagram Likes')],
    ],
  },
  10: {
    tr: [
      [new RegExp(`Jet SMM Panel'deki ${A(366).source} hizmetini kademeli biçimde kullanın; ömür boyu telafi kapsamındadır\\.`), `Jet SMM Panel'in ${G('hizmet listesindeki')} uygun bir izlenme paketini kademeli biçimde kullanın; yenileme koşulunu hizmet kartından kontrol edin.`],
      [new RegExp(`${A(356).source} desteğiyle dengeleyin\\.`), `${G('beğeni desteğiyle')} dengeleyin.`],
      [new RegExp(`${A(374).source} hizmetini yavaş ve düzenli bir hızda ilerletin\\.`), `${G('abone desteğini')} yavaş ve düzenli bir hızda ilerletin.`],
    ],
    en: [
      [new RegExp(`the ${A(366).source} service on Jet SMM Panel, delivered gradually and covered by lifetime refill\\.`), `a suitable views package from Jet SMM Panel's ${G('service list')}, delivered gradually — check the refill terms on the service card.`],
      [new RegExp(`by adding ${A(356).source}\\.`), `by adding ${G('like support')}.`],
      [new RegExp(`with ${A(374).source} at a slow, steady pace\\.`), `with ${G('subscriber support')} at a slow, steady pace.`],
    ],
  },
  11: {
    tr: [
      [new RegExp(`Jet SMM Panel'deki ${A(360).source} hizmetini kademeli \\(drip-feed\\) kullanın; ömür boyu telafi kapsamındadır\\.`), `Jet SMM Panel'in ${G('hizmet listesindeki')} uygun bir izlenme paketini kademeli (drip-feed) kullanın; yenileme koşulunu hizmet kartından kontrol edin.`],
      [new RegExp(`${A(374).source} hizmetini yavaş bir hızda ilerletin\\.`), `${G('abone desteğini')} yavaş bir hızda ilerletin.`],
      [new RegExp(`Türkiye kitlesine hitap eden bir kanalsanız ${A(368).source} seçeneği kitle uyumu açısından daha doğrudur\\.`), `Türkiye kitlesine hitap eden bir kanalsanız hedef ülkesi Türkiye olan seçenekleri tercih edin; kitle uyumu açısından daha doğrudur.`],
    ],
    en: [
      [new RegExp(`the ${A(360).source} service on Jet SMM Panel, used with drip-feed delivery and covered by lifetime refill\\.`), `a suitable views package from Jet SMM Panel's ${G('service list')}, used with drip-feed delivery — check the refill terms on the service card.`],
      [new RegExp(`with ${A(374).source} at a slow pace\\.`), `with ${G('subscriber support')} at a slow pace.`],
      [new RegExp(`If your channel targets a Turkish audience, ${A(368).source} is the better fit for audience alignment\\.`), `If your channel targets a Turkish audience, prefer options whose target country is Turkey — it is the better fit for audience alignment.`],
    ],
  },
};

(async () => {
  const posts = await all('SELECT id, slug, content_tr, content_en FROM blog_posts ORDER BY id');
  let problems = 0;
  for (const p of posts) {
    const out = {};
    for (const lang of ['tr', 'en']) {
      let c = p['content_' + lang] || '';
      const edits = (EDITS[p.id] || {})[lang] || [];
      for (const [re, rep] of edits) {
        const n = (c.match(re) || []).length;
        if (n !== 1) { problems++; console.log(`!! post ${p.id} ${lang}: ${n} eslesme -> ${re.source.slice(0, 90)}`); continue; }
        c = c.replace(re, rep);
      }
      // Genel temizlik: eski #services hash linkleri temiz yola, ic linklerde nofollow kaldirilir.
      c = c.replace(/<a href="#services"[^>]*>/g, '<a href="/services">');
      c = c.replace(/<a href="\/services"( rel="[^"]*")?>/g, '<a href="/services">');
      const kalan = c.match(/service=\d+/g) || [];
      const yeni = new Set([503,505,534,537,540,542,566,569,573,574,607,609,625,630,633].map(String));
      const bozuk = kalan.filter(k => !yeni.has(k.replace('service=', '')));
      if (bozuk.length) { problems++; console.log(`!! post ${p.id} ${lang}: hala eski link ${bozuk.join(',')}`); }
      out[lang] = c;
    }
    const changed = out.tr !== (p.content_tr || '') || out.en !== (p.content_en || '');
    if (changed) console.log(`post ${p.id} ${p.slug}: degisti (tr ${p.content_tr.length}->${out.tr.length}, en ${p.content_en.length}->${out.en.length})`);
    if (changed && APPLY) {
      await run("UPDATE blog_posts SET content_tr = ?, content_en = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [out.tr, out.en, p.id]);
    }
  }
  console.log(problems ? `SORUN: ${problems}` : 'Sorun yok.', APPLY ? '(UYGULANDI)' : '(deneme, yazilmadi)');
  db.close();
})();
