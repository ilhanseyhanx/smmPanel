const PLATFORM_KEYS = ['instagram', 'tiktok', 'youtube', 'telegram', 'facebook', 'x-twitter', 'spotify', 'linkedin', 'twitch', 'social-media'];

function fold(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').toLowerCase();
}

function detectBlogPlatform(value) {
  const text = fold(value);
  if (/instagram|reels|hikaye|story/.test(text)) return 'instagram';
  if (/tiktok/.test(text)) return 'tiktok';
  if (/youtube|shorts/.test(text)) return 'youtube';
  if (/telegram/.test(text)) return 'telegram';
  if (/facebook|meta/.test(text)) return 'facebook';
  if (/twitter|\bx\b/.test(text)) return 'x-twitter';
  if (/spotify|muzik|music/.test(text)) return 'spotify';
  if (/linkedin/.test(text)) return 'linkedin';
  if (/twitch|yayin|stream/.test(text)) return 'twitch';
  return 'social-media';
}

function isLocalBlogCover(value) {
  return /^\/api\/blog\/cover\/(instagram|tiktok|youtube|telegram|facebook|x-twitter|spotify|linkedin|twitch|social-media)\/(?:[1-9]|[1-4]\d|50)\.svg(?:\?v=2)?$/.test(String(value || ''));
}

async function chooseBlogCover(db, topic) {
  const platform = detectBlogPlatform(topic);
  const rows = await db.all('SELECT image_url FROM blog_posts WHERE image_url LIKE ?', [`/api/blog/cover/${platform}/%.svg`]);
  const used = new Set(rows.map(row => Number(String(row.image_url).match(/\/(\d+)\.svg$/)?.[1])).filter(Boolean));
  let variant = 1;
  while (variant <= 50 && used.has(variant)) variant++;
  if (variant > 50) variant = (rows.length % 50) + 1;
  return `/api/blog/cover/${platform}/${variant}.svg?v=2`;
}

module.exports = { PLATFORM_KEYS, detectBlogPlatform, isLocalBlogCover, chooseBlogCover };
