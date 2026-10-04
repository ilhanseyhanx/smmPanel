'use strict';
module.exports = {
  slug: 'tiktok-canli-yayin-rehberi',
  platform: 'tiktok',
  level_tr: 'Orta', level_en: 'Intermediate',
  title_tr: "TikTok Canlı Yayın ve Hediye Geliri Rehberi",
  title_en: "TikTok LIVE and Gift Income Guide",
  subtitle_tr: "Canlı yayın şartlarından akış planına, izleyici etkileşiminden hediye mantığına kadar TikTok LIVE'ı güvenli, kurallara uygun ve sürdürülebilir şekilde yönetmeyi öğren.",
  subtitle_en: "From eligibility and run-of-show planning to viewer interaction and how gifts work, learn to run TikTok LIVE safely, within the rules and at a pace you can sustain.",
  seo_title_tr: "TikTok Canlı Yayın Rehberi: Hazırlık, Etkileşim, Hediye",
  seo_title_en: "TikTok LIVE Guide: Setup, Engagement and Gifts",
  seo_description_tr: "TikTok canlı yayın şartları, ekipman, akış planı, izleyici etkileşimi, hediye ve elmas mantığı, güvenlik ve 30 günlük plan: 7 derslik pratik rehber.",
  seo_description_en: "TikTok LIVE eligibility, gear, run-of-show planning, viewer engagement, how gifts and Diamonds work, safety and a 30-day plan in a practical 7-lesson course.",
  cover: {
    tagline_tr: "Planla, yayına geç, topluluğunu kur",
    tagline_en: "Plan it, go LIVE, build your community"
  },
  description_tr: `
<p>Canlı yayın, TikTok'ta kitlenle en yakın bağı kurabileceğin format; ama plansız açılan yayınlar çoğu zaman sessizlik, kaçan izleyici ve kural uyarılarıyla biter. Bu eğitim, kamerayı açmadan önceki hazırlıktan yayın sonrası analize kadar bütün süreci adım adım ele alır.</p>
<ul>
  <li><strong>Şartlar ve hazırlık:</strong> Yaş, takipçi ve hesap şartlarını uygulamadan nasıl kontrol edeceğin, profilini nasıl hazırlayacağın ve canlıda daha sıkı uygulanan kurallar.</li>
  <li><strong>Ekipman ve kurulum:</strong> Elindeki telefonla net ses, iyi ışık, kararlı bağlantı ve dikey kadraj.</li>
  <li><strong>Format ve akış planı:</strong> Soru-cevap, eğitim, oyun, sohbet ve ürün tanıtımı formatları; dakika dakika 60 dakikalık yayın şablonu.</li>
  <li><strong>Etkileşim:</strong> Sabitlenmiş yorum, isimle hitap, doğru soru sorma, mini hedefler ve moderatör kullanımı.</li>
  <li><strong>Hediyeler ve gelir mantığı:</strong> Jeton, hediye ve elmas zinciri; güncel kuralları nereden kontrol edeceğin ve izleyiciye baskı yapmadan hediyeye etik yaklaşım.</li>
  <li><strong>Güvenlik ve moderasyon:</strong> Kişisel bilgilerini korumak, filtreleri yayından önce kurmak ve uyarı aldığında doğru adımlar.</li>
  <li><strong>Yayın sonrası:</strong> Yayını kliplere dönüştürme, verileri okuma ve 30 günlük canlı yayın planı.</li>
</ul>
<p>Eğitimde uydurma kazanç rakamları ya da “kesin sonuç” vaatleri yok. Platform kuralları değişkendir; bu yüzden her sayısal bilgiyi yazıldığı tarihe göre veriyor ve güncel şartı uygulamadan nasıl kontrol edeceğini gösteriyoruz. Amaç, her yayında biraz daha iyi olmanı sağlayacak, kurallara uygun ve sürdürülebilir bir sistem kurman.</p>
`,
  description_en: `
<p>LIVE is the format where you can build the closest bond with your audience on TikTok; but unplanned streams often end in dead air, viewers swiping away and guideline warnings. This course walks you through the whole process step by step, from preparation before you go live to analysis after the stream.</p>
<ul>
  <li><strong>Requirements and prep:</strong> How to check age, follower and account requirements in the app, how to get your profile ready and which rules are enforced more strictly on LIVE.</li>
  <li><strong>Gear and setup:</strong> Clear audio, good lighting, a stable connection and vertical framing with the phone you already own.</li>
  <li><strong>Formats and run of show:</strong> Q&amp;A, tutorials, gaming, chat and product showcases, plus a minute-by-minute 60-minute stream template.</li>
  <li><strong>Engagement:</strong> Pinned comments, name call-outs, asking the right questions, mini goals and working with moderators.</li>
  <li><strong>Gifts and income logic:</strong> The Coins, Gifts and Diamonds chain, where to check the current rules and an ethical approach to gifts that never pressures viewers.</li>
  <li><strong>Safety and moderation:</strong> Protecting your personal information, setting up filters before you stream and the right steps after a warning.</li>
  <li><strong>After the stream:</strong> Turning streams into clips, reading your data and a 30-day LIVE plan.</li>
</ul>
<p>There are no made-up earnings figures or “guaranteed results” promises here. Platform rules change, so every number is given as of the time of writing, and we show you how to check the current requirement inside the app. The goal is to build a compliant, sustainable system that makes you a little better with every stream.</p>
`,
  lessons: ['ders-01', 'ders-02', 'ders-03', 'ders-04', 'ders-05', 'ders-06', 'ders-07'].map(f => require('./' + f))
};
