'use strict';
module.exports = {
  slug: 'youtube-para-kazanma-yol-haritasi',
  platform: 'youtube',
  level_tr: 'Orta', level_en: 'Intermediate',
  title_tr: "YouTube Para Kazanma Yol Haritası: 1000 Abone ve 4000 Saat",
  title_en: "YouTube Monetization Roadmap: 1,000 Subscribers and 4,000 Hours",
  subtitle_tr: "İş Ortağı Programı şartlarından niş seçimine, tıklanan başlıklardan izleyiciyi tutan kurguya ve reklam dışı gelire kadar, kanalını para kazanmaya hazırlayan 8 derslik sistemli bir yol haritası.",
  subtitle_en: "An 8-lesson, step-by-step roadmap that gets your channel ready to earn: from Partner Program requirements and choosing a niche to clickable titles, retention-focused editing and income beyond ads.",
  seo_title_tr: "YouTube Para Kazanma Yol Haritası: 1000 Abone, 4000 Saat",
  seo_title_en: "YouTube Monetization Roadmap: 1,000 Subs & 4,000 Hours",
  seo_description_tr: "YouTube İş Ortağı Programı şartları, niş seçimi, başlık ve küçük resim, izlenme süresi, Shorts dengesi ve reklam dışı gelir: 8 derslik yol haritası.",
  seo_description_en: "YouTube Partner Program requirements, niche, titles and thumbnails, watch time, Shorts balance and income beyond ads: an 8-lesson monetization roadmap.",
  cover: {
    tagline_tr: "1000 abone ve 4000 saate sistemli yol",
    tagline_en: "A systematic path to 1,000 subs and 4,000 hours"
  },
  description_tr: `
<p>YouTube'da para kazanmak için "1000 abone ve 4000 saat" sayısını duymuşsundur. Ama bu sayıya nasıl ulaşılacağı, hangi izlenmelerin sayıldığı ve başvurudan sonra kanalının neden reddedilebileceği çoğu zaman anlatılmaz. Bu eğitim, kanalını adım adım para kazanmaya hazırlayan sistemli bir yol haritası sunar.</p>
<ul>
  <li><strong>İş Ortağı Programı şartları:</strong> Uzun video ve Shorts yolları, fan finansmanı katmanı, telif ve topluluk kuralları.</li>
  <li><strong>Konumlandırma ve niş:</strong> Kanal vaadini yazmak, içerik sütunlarını belirlemek, kanal sayfasını düzenlemek.</li>
  <li><strong>Fikir ve anahtar kelime araştırması:</strong> Ücretsiz kaynaklarla izleyicinin gerçekten aradığı konuları bulmak.</li>
  <li><strong>Başlık ve küçük resim:</strong> Tıklanma oranını izlenme süresiyle birlikte okumak ve dürüst ama tıklanan paketler hazırlamak.</li>
  <li><strong>İzleyiciyi tutma:</strong> Kitleyi elde tutma grafiği, güçlü giriş ve tempolu kurgu.</li>
  <li><strong>Shorts ve uzun video dengesi:</strong> İki format arasında köprü kurmak.</li>
  <li><strong>Sadık kitle:</strong> Oynatma listeleri, bitiş ekranları, yorumlar ve gönderiler.</li>
  <li><strong>Gelir ve plan:</strong> Reklam gelirini etkileyen faktörler, reklam dışı gelir yolları ve 90 günlük kanal planı.</li>
</ul>
<p>Her derste uygulanabilir tablolar, kontrol listeleri, şablonlar ve bir görev bulacaksın. Bu eğitim kazanç garantisi vermez ve uydurma kazanç rakamları içermez; platform şartları değişebildiği için sayısal eşikleri her zaman YouTube Studio'dan kontrol etmeni hatırlatır. Amaç, şansını artıran doğru alışkanlıkları kurmandır.</p>
`,
  description_en: `
<p>You have probably heard that making money on YouTube takes "1,000 subscribers and 4,000 hours". What is rarely explained is how to get there, which views actually count and why a channel can still be rejected after applying. This course gives you a systematic roadmap that prepares your channel for monetization step by step.</p>
<ul>
  <li><strong>Partner Program requirements:</strong> The long-form and Shorts paths, the fan funding tier, copyright and Community Guidelines.</li>
  <li><strong>Positioning and niche:</strong> Writing your channel promise, defining content pillars and setting up your channel page.</li>
  <li><strong>Idea and keyword research:</strong> Using free sources to find the topics viewers are actually looking for.</li>
  <li><strong>Titles and thumbnails:</strong> Reading click-through rate together with watch time and creating honest packaging that gets clicked.</li>
  <li><strong>Audience retention:</strong> The retention graph, strong openings and well-paced editing.</li>
  <li><strong>Balancing Shorts and long-form:</strong> Building a bridge between the two formats.</li>
  <li><strong>A loyal audience:</strong> Playlists, end screens, comments and posts.</li>
  <li><strong>Income and plan:</strong> What drives ad revenue, income streams beyond ads and a 90-day channel plan.</li>
</ul>
<p>Every lesson includes practical tables, checklists, templates and a task. This course does not promise earnings and contains no made-up revenue figures; because platform requirements can change, it reminds you to always check the numbers in YouTube Studio. The goal is to build the right habits that improve your odds.</p>
`,
  lessons: ['ders-01', 'ders-02', 'ders-03', 'ders-04', 'ders-05', 'ders-06', 'ders-07', 'ders-08'].map(f => require('./' + f))
};
