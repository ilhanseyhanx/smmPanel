const express = require('express');
const router = express.Router();
const { dbAsync } = require('../config/database');
const { PLATFORM_KEYS } = require('../services/blogCover');

const COVER_LABELS = {
  instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', telegram: 'Telegram', facebook: 'Facebook',
  'x-twitter': 'X', spotify: 'Spotify', linkedin: 'LinkedIn', twitch: 'Twitch', 'social-media': 'Social media'
};

function coverIconSvg(platform) {
  const icons = {
    instagram: '<rect x="548" y="223" width="104" height="104" rx="28" fill="none" stroke="white" stroke-width="13"/><circle cx="600" cy="275" r="25" fill="none" stroke="white" stroke-width="12"/><circle cx="633" cy="243" r="8" fill="white"/>',
    tiktok: '<path d="M616 218v77c0 29-21 50-51 50-28 0-49-18-49-43 0-29 24-47 58-43v25c-17-3-30 4-30 17 0 11 9 18 21 18 15 0 25-10 25-28v-73h26c5 22 18 35 40 39v28c-17-2-31-9-40-18z" fill="white"/>',
    youtube: '<rect x="515" y="225" width="170" height="100" rx="28" fill="white"/><path d="M582 247l55 28-55 28z" fill="#10162d"/>',
    telegram: '<path d="M500 271l202-79-40 190-67-55-40 38 7-62 102-78-126 63z" fill="white"/>',
    facebook: '<path d="M620 355v-72h27l5-34h-32v-17c0-10 5-18 19-18h16v-30c-8-1-19-3-34-3-35 0-58 21-58 60v8h-38v34h38v72z" fill="white"/>',
    'x-twitter': '<path d="M526 202h42l110 146h-43zM674 202h-30L526 348h31z" fill="white"/>',
    spotify: '<circle cx="600" cy="275" r="92" fill="white"/><path d="M545 248c43-13 103-9 145 14M551 279c39-10 91-6 129 12M558 309c34-7 77-4 111 10" fill="none" stroke="#10162d" stroke-width="13" stroke-linecap="round"/>',
    linkedin: '<circle cx="545" cy="226" r="17" fill="white"/><rect x="528" y="254" width="34" height="83" fill="white"/><path d="M582 254h33v13c12-14 25-18 41-18 35 0 45 24 45 61v27h-35v-25c0-22-3-35-21-35-20 0-28 14-28 39v21h-35z" fill="white"/>',
    twitch: '<path d="M519 203h174v113l-45 45h-45l-27 27v-27h-57zm32 28v96h42v22l22-22h36v-96z" fill="white"/><rect x="590" y="250" width="14" height="42" fill="white"/><rect x="631" y="250" width="14" height="42" fill="white"/>',
    'social-media': '<g fill="white"><circle cx="600" cy="275" r="35"/><circle cx="520" cy="225" r="22"/><circle cx="680" cy="225" r="22"/><circle cx="520" cy="325" r="22"/><circle cx="680" cy="325" r="22"/></g><g stroke="white" stroke-width="12"><path d="M545 240l30 18M655 240l-30 18M545 310l30-18M655 310l-30-18"/></g>'
  };
  return icons[platform];
}

function blogCoverSvg(platform, variant) {
  const label = COVER_LABELS[platform];
  const hueA = (variant * 47 + PLATFORM_KEYS.indexOf(platform) * 31) % 360;
  const hueB = (hueA + 65 + (variant % 7) * 11) % 360;
  const x = 130 + ((variant * 83) % 780);
  const y = 90 + ((variant * 57) % 330);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${label} blog cover ${variant}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${hueA} 82% 42%)"/><stop offset="1" stop-color="hsl(${hueB} 88% 24%)"/></linearGradient><filter id="b"><feGaussianBlur stdDeviation="45"/></filter></defs>
  <rect width="1200" height="630" rx="34" fill="#070b18"/><rect x="18" y="18" width="1164" height="594" rx="28" fill="url(#g)" opacity=".92"/>
  <circle cx="${x}" cy="${y}" r="190" fill="white" opacity=".09" filter="url(#b)"/><circle cx="${1100-x/3}" cy="${560-y/3}" r="150" fill="#fff" opacity=".08"/>
  <g fill="none" stroke="white" opacity=".16" stroke-width="3"><path d="M70 ${110 + variant*3} C330 ${20 + variant*4}, 620 ${500-variant*2}, 1130 ${110+variant*5}"/><path d="M90 ${530-variant*4} C380 ${420+variant}, 790 ${70+variant*2}, 1110 ${420-variant}"/></g>
  <circle cx="600" cy="275" r="128" fill="white" opacity=".16"/><circle cx="600" cy="275" r="105" fill="#080d1d" opacity=".62"/>
  ${coverIconSvg(platform)}
  <g fill="white" opacity=".2"><circle cx="390" cy="480" r="18"/><circle cx="470" cy="520" r="11"/><circle cx="735" cy="500" r="15"/><circle cx="825" cy="465" r="9"/></g>
  </svg>`;
}

// GET PUBLIC BLOG POSTS
router.get('/', async (req, res) => {
  try {
    const lang = req.query.lang === 'en' ? 'en' : 'tr';
    const posts = await dbAsync.all(`SELECT id, slug, image_url, reading_minutes, created_at, published_at,
      COALESCE(title_${lang}, title_tr, title) title,
      COALESCE(category_${lang}, category_tr, category) category,
      COALESCE(summary_${lang}, summary_tr, summary) summary
      FROM blog_posts WHERE status = 'published' ORDER BY COALESCE(published_at, created_at) DESC, id DESC`);
    res.json({ posts });
  } catch (err) {
    res.status(500).json({ error: 'Blog yazıları alınamadı.' });
  }
});

router.get('/cover/:platform/:variant.svg', (req, res) => {
  const platform = String(req.params.platform || '');
  const variant = Number(req.params.variant);
  if (!PLATFORM_KEYS.includes(platform) || !Number.isInteger(variant) || variant < 1 || variant > 50) {
    return res.status(404).type('text/plain').send('Kapak bulunamadı.');
  }
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.type('image/svg+xml').send(blogCoverSvg(platform, variant));
});

// GET SINGLE BLOG POST BY SLUG OR ID
router.get('/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    const lang = req.query.lang === 'en' ? 'en' : 'tr';
    const post = await dbAsync.get(`SELECT id, slug, image_url, reading_minutes, created_at, published_at,
      COALESCE(title_${lang}, title_tr, title) title,
      COALESCE(category_${lang}, category_tr, category) category,
      COALESCE(summary_${lang}, summary_tr, summary) summary,
      COALESCE(content_${lang}, content_tr, content) content,
      COALESCE(seo_title_${lang}, title_${lang}, title) seo_title,
      COALESCE(seo_description_${lang}, summary_${lang}, summary) seo_description
      FROM blog_posts WHERE status = 'published' AND (slug = ? OR id = ?)`, [slug, slug]);
    if (!post) {
      return res.status(404).json({ error: 'Blog yazısı bulunamadı.' });
    }
    res.json({ post });
  } catch (err) {
    res.status(500).json({ error: 'Blog detayı alınamadı.' });
  }
});

module.exports = router;
