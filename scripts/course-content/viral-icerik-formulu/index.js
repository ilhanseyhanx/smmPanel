'use strict';
module.exports = {
  slug: 'viral-icerik-formulu',
  platform: 'genel',
  level_tr: 'Her Seviye', level_en: 'All Levels',
  title_tr: 'Viral İçerik Formülü: Kanca, Hikâye, Kapanış',
  title_en: 'The Viral Content Formula: Hook, Story, Close',
  subtitle_tr: 'İnsanların neden kaydettiğini ve paylaştığını anla; kanca, hikâye iskeleti, tutma ve kapanışla içeriğinin yayılma olasılığını artır, işe yarayanı seriye çevir.',
  subtitle_en: 'Understand why people save and share; use hooks, story skeletons, retention and strong closes to raise your content’s odds of spreading, then turn what works into a series.',
  seo_title_tr: 'Viral İçerik Formülü: Kanca, Hikâye, Kapanış',
  seo_title_en: 'Viral Content Formula: Hook, Story, Close',
  seo_description_tr: 'Kanca şablonları, hikâye iskeletleri, açık döngüler ve kaydettiren kapanışlarla içeriğinin yayılma olasılığını artır. 14 günlük deneme planı dahil.',
  seo_description_en: 'Hook templates, story skeletons, open loops and closes that earn saves and shares. Raise your content’s odds of spreading, with a 14-day test plan.',
  cover: { tagline_tr: 'Kanca, hikâye, kapanış: tekrar edilebilir formül', tagline_en: 'Hook, story, close: a repeatable formula' },
  description_tr: `
<p>Bazı içerikler neden binlerce kez kaydedilip paylaşılırken, aynı emekle hazırlanan diğerleri sessiz kalır? Bu eğitim, platformdan bağımsız olarak içeriğin <strong>psikolojisine ve yapısına</strong> odaklanıyor. Kısa video, uzun video, kaydırmalı gönderi ya da yazı içeriği üretiyor olman fark etmez; aynı ilkeler hepsinde çalışır.</p>
<p>Baştan dürüst olalım: viralliği hiçbir formül garanti edemez. Bu eğitimin amacı, her içeriğinin yayılma olasılığını artırmak ve işe yarayan yapıyı tekrar üretilebilir hâle getirmek.</p>
<h3>Bu eğitimde neler var?</h3>
<ul>
<li><strong>Paylaşmanın dört motoru:</strong> duygu, fayda, kimlik ve merak; kaydetme, paylaşma ve yorum davranışlarının farkı.</li>
<li><strong>Kanca yazımı:</strong> kancanın üç katmanı ve hemen uyarlayabileceğin 12 kanca şablonu.</li>
<li><strong>Hikâye iskeletleri:</strong> problem-çözüm, önce-sonra, liste, ters köşe ve diğerleri; hangi fikre hangisinin uyduğu.</li>
<li><strong>İzleyiciyi tutmak:</strong> ritim, açık döngüler ve görsel değişimle içeriğin ortasında izleyici kaybetmemek.</li>
<li><strong>Kapanış ve eylem çağrısı:</strong> kaydettiren, paylaştıran ve yorum yazdıran hazır kapanış şablonları.</li>
<li><strong>Test ve seri:</strong> tek değişken kuralı, sonuçları kendi ortalamana göre okumak ve 14 günlük deneme planı.</li>
</ul>
<p>Her derste uygulanabilir şablonlar, kontrol listeleri ve somut bir görev var. Eğitimin sonunda elinde hem kendi kitlene göre test edilmiş bir formül, hem de seriye dönüştürmeye hazır bir içerik formatı olacak. İlk iki ders ücretsiz.</p>
`,
  description_en: `
<p>Why do some posts get saved and shared thousands of times while others, made with the same effort, stay quiet? This course focuses on the <strong>psychology and structure</strong> of content, independent of any platform. Whether you make short videos, long videos, carousels or text posts, the same principles apply.</p>
<p>Let's be honest from the start: no formula can guarantee virality. The goal of this course is to raise the odds that each piece of your content spreads, and to make whatever works repeatable.</p>
<h3>What's inside this course?</h3>
<ul>
<li><strong>The four engines of sharing:</strong> emotion, utility, identity and curiosity, and how saving, sharing and commenting differ.</li>
<li><strong>Writing hooks:</strong> the three layers of a hook and 12 hook templates you can adapt right away.</li>
<li><strong>Story skeletons:</strong> problem-solution, before-after, list, plot twist and more, and which one fits which idea.</li>
<li><strong>Keeping viewers:</strong> using rhythm, open loops and visual change so you don't lose people in the middle.</li>
<li><strong>The close and call to action:</strong> ready-made closing templates that earn saves, shares and comments.</li>
<li><strong>Testing and series:</strong> the one-variable rule, reading results against your own average and a 14-day experiment plan.</li>
</ul>
<p>Every lesson includes practical templates, checklists and a concrete task. By the end, you'll have a formula tested on your own audience and a content format ready to become a series. The first two lessons are free.</p>
`,
  lessons: ['ders-01', 'ders-02', 'ders-03', 'ders-04', 'ders-05', 'ders-06'].map(f => require('./' + f))
};
