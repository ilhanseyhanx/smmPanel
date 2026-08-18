'use strict';

// Siparis linkinin, secilen servisin tipine uygun olup olmadigini kontrol eder.
//
// Amac: musteri "begeni" servisine profil linki (veya "takipci" servisine gonderi
// linki) girdiginde siparisin saglayiciya HIC gitmemesi. Yanlis link saglayiciya
// gidince para odenmis oluyor, is bosa gidiyor ve iadeyi panel sahibi ustleniyor.
//
// TEMEL KURAL: yalnizca EMIN oldugumuzda reddet. Platformu veya servis turunu
// cozemezsek siparisin gecmesine izin veririz; yanlis yere "gecerli degil" demek,
// birkac hatali siparisi kacirmaktan daha kotudur.

// Turkce buyuk I gibi harfler regex'te sorun cikardigi icin once sadelestiriyoruz.
function normalize(value) {
  return String(value || '')
    .replace(/İ/g, 'I').replace(/ı/g, 'i').replace(/Ş/g, 'S').replace(/ş/g, 's')
    .replace(/Ğ/g, 'G').replace(/ğ/g, 'g').replace(/Ü/g, 'U').replace(/ü/g, 'u')
    .replace(/Ö/g, 'O').replace(/ö/g, 'o').replace(/Ç/g, 'C').replace(/ç/g, 'c')
    .toLowerCase();
}

// --- Platform tanimlari ----------------------------------------------------
// media  : gonderi/video/parca linki
// profile: profil/kanal/sayfa linki
// reserved: profil sanilmamasi gereken sistem yollari
const PLATFORMS = {
  instagram: {
    label: 'Instagram',
    detect: /instagram|\bigtv\b|\big\b|\breels?\b/,
    hosts: [/^(www\.|m\.)?instagram\.com$/, /^instagr\.am$/],
    media: [/^\/(p|reel|reels|tv)\/[\w.-]+/],
    story: [/^\/stories\/[\w.-]+\/\d+/],
    profile: [/^\/[\w.](?:[\w.]){0,29}\/?$/],
    reserved: ['p', 'reel', 'reels', 'tv', 'stories', 'explore', 'accounts', 'direct', 'about'],
    ornekMedya: 'https://www.instagram.com/p/Cxxxxxxxxxx/',
    ornekProfil: 'https://www.instagram.com/kullaniciadi'
  },
  tiktok: {
    label: 'TikTok',
    detect: /tiktok|tik tok/,
    hosts: [/^(www\.|m\.)?tiktok\.com$/],
    shortHosts: [/^(vm|vt)\.tiktok\.com$/],
    media: [/^\/@[\w.-]+\/(video|photo)\/\d+/],
    profile: [/^\/@[\w.-]+\/?$/],
    reserved: ['video', 'photo', 'tag', 'music', 'discover'],
    ornekMedya: 'https://www.tiktok.com/@kullaniciadi/video/7300000000000000000',
    ornekProfil: 'https://www.tiktok.com/@kullaniciadi'
  },
  youtube: {
    label: 'YouTube',
    detect: /youtube|\byt\b|shorts/,
    hosts: [/^(www\.|m\.|music\.)?youtube\.com$/],
    shortHosts: [/^youtu\.be$/],
    media: [/^\/watch$/, /^\/shorts\/[\w-]+/, /^\/live\/[\w-]+/, /^\/embed\/[\w-]+/],
    profile: [/^\/@[\w.-]+\/?$/, /^\/(channel|c|user)\/[\w.-]+/],
    reserved: ['watch', 'shorts', 'embed', 'playlist', 'results', 'feed'],
    ornekMedya: 'https://www.youtube.com/watch?v=xxxxxxxxxxx',
    ornekProfil: 'https://www.youtube.com/@kanaladi'
  },
  twitter: {
    label: 'Twitter (X)',
    detect: /twitter|\bx premium\b|retweet|\bx\.com\b/,
    hosts: [/^(www\.|mobile\.)?(twitter|x)\.com$/],
    media: [/^\/[\w]+\/status(es)?\/\d+/],
    profile: [/^\/[\w]{1,15}\/?$/],
    reserved: ['status', 'statuses', 'i', 'home', 'explore', 'search', 'hashtag'],
    ornekMedya: 'https://x.com/kullaniciadi/status/1700000000000000000',
    ornekProfil: 'https://x.com/kullaniciadi'
  },
  facebook: {
    label: 'Facebook',
    detect: /facebook|\bfb\b/,
    hosts: [/^(www\.|m\.|web\.)?facebook\.com$/, /^fb\.(com|watch|me)$/],
    media: [/^\/[\w.-]+\/(posts|videos|photos)\//, /^\/(photo|watch|reel)\b/,
      /^\/permalink\.php/, /^\/story\.php/, /^\/share\//],
    profile: [/^\/[\w.-]+\/?$/, /^\/(profile\.php|people)\b/],
    reserved: ['posts', 'videos', 'photos', 'photo', 'watch', 'reel', 'permalink.php', 'story.php', 'share', 'groups'],
    ornekMedya: 'https://www.facebook.com/sayfaadi/posts/123456789',
    ornekProfil: 'https://www.facebook.com/sayfaadi'
  },
  telegram: {
    label: 'Telegram',
    detect: /telegram/,
    hosts: [/^(www\.)?(t|telegram)\.me$/, /^telegram\.org$/],
    media: [/^\/[\w_]+\/\d+/, /^\/c\/\d+\/\d+/],
    profile: [/^\/[\w_]{3,}\/?$/, /^\/joinchat\//, /^\/\+/],
    reserved: ['joinchat', 'c', 's'],
    ornekMedya: 'https://t.me/kanaladi/123',
    ornekProfil: 'https://t.me/kanaladi'
  },
  spotify: {
    label: 'Spotify',
    detect: /spotify/,
    hosts: [/^open\.spotify\.com$/, /^(www\.)?spotify\.com$/],
    media: [/^\/(track|album|playlist|episode)\/[\w]+/, /^\/intl-\w+\/(track|album|playlist|episode)\/[\w]+/],
    profile: [/^\/(artist|user)\/[\w]+/, /^\/intl-\w+\/(artist|user)\/[\w]+/],
    reserved: ['track', 'album', 'playlist', 'episode', 'artist', 'user'],
    ornekMedya: 'https://open.spotify.com/track/xxxxxxxxxxxxxxxxxxxxxx',
    ornekProfil: 'https://open.spotify.com/artist/xxxxxxxxxxxxxxxxxxxxxx'
  },
  twitch: {
    label: 'Twitch',
    detect: /twitch/,
    hosts: [/^(www\.|m\.)?twitch\.tv$/],
    media: [/^\/videos\/\d+/, /^\/[\w]+\/(clip|video)\//],
    profile: [/^\/[\w]{3,25}\/?$/],
    reserved: ['videos', 'directory', 'settings'],
    ornekMedya: 'https://www.twitch.tv/videos/123456789',
    ornekProfil: 'https://www.twitch.tv/kullaniciadi'
  },
  pinterest: {
    label: 'Pinterest',
    detect: /pinterest/,
    hosts: [/^([\w-]+\.)?pinterest\.(com|co\.uk|fr|de)$/],
    media: [/^\/pin\/\d+/],
    profile: [/^\/[\w-]+\/?$/],
    reserved: ['pin', 'search', 'ideas'],
    ornekMedya: 'https://www.pinterest.com/pin/123456789/',
    ornekProfil: 'https://www.pinterest.com/kullaniciadi'
  },
  linkedin: {
    label: 'LinkedIn',
    detect: /linkedin/,
    hosts: [/^([\w-]+\.)?linkedin\.com$/],
    media: [/^\/(posts|feed\/update|pulse)\//],
    profile: [/^\/(in|company|school)\//],
    reserved: ['posts', 'feed', 'pulse'],
    ornekMedya: 'https://www.linkedin.com/posts/xxxxx',
    ornekProfil: 'https://www.linkedin.com/in/kullaniciadi'
  },
  soundcloud: {
    label: 'SoundCloud',
    detect: /soundcloud/,
    hosts: [/^(www\.|m\.)?soundcloud\.com$/],
    media: [/^\/[\w-]+\/[\w-]+/],
    profile: [/^\/[\w-]+\/?$/],
    reserved: ['discover', 'stream', 'search'],
    ornekMedya: 'https://soundcloud.com/sanatci/parca-adi',
    ornekProfil: 'https://soundcloud.com/sanatci'
  },
  threads: {
    label: 'Threads',
    detect: /threads/,
    hosts: [/^(www\.)?threads\.(net|com)$/],
    media: [/^\/@[\w.-]+\/post\/[\w-]+/, /^\/t\/[\w-]+/],
    profile: [/^\/@[\w.-]+\/?$/],
    reserved: ['t', 'post', 'search'],
    ornekMedya: 'https://www.threads.net/@kullaniciadi/post/Cxxxxxxx',
    ornekProfil: 'https://www.threads.net/@kullaniciadi'
  }
};

// --- Servisin hedef tipi ---------------------------------------------------
// Servis adinda EN ONCE gecen anahtar kelimeye gore karar verilir; boylece
// "Instagram Likes ... Real Accounts" begeni sayilir, takipci degil.
const TARGET_PATTERNS = [
  ['media', /\blikes?\b|\bbegeni|favorite|upvote/g],
  ['profile', /\bfollowers?\b|\bsubscribers?\b|\bsubs\b|\bmembers?\b|abone|takipci|\bfans?\b|connections?/g],
  ['media', /\bviews?\b|\bplays?\b|izlen|goruntu|watch|listens?|streams?|\bcomments?\b|yorum|\breplies\b|\bshares?\b|\bsaves?\b|repost|retweet|paylas/g],
  ['story', /\bstory\b|\bstories\b|hikaye/g],
  ['profile', /\breach\b|traffic|visits?/g]
];

function detectTarget(serviceText) {
  const text = normalize(serviceText);
  // "story views" ozel durum: hedef hikaye, normal gonderi degil.
  if (/\bstor(y|ies)\b|hikaye/.test(text)) return 'story';
  let best = null, bestPos = Infinity;
  for (const [target, re] of TARGET_PATTERNS) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m && m.index < bestPos) { bestPos = m.index; best = target; }
  }
  return best;
}

function detectPlatform(serviceText) {
  const text = normalize(serviceText);
  for (const [key, def] of Object.entries(PLATFORMS)) {
    if (def.detect.test(text)) return key;
  }
  return null;
}

function matchAny(patterns, path) {
  return (patterns || []).some(re => re.test(path));
}

function platformOfHost(host) {
  for (const [key, def] of Object.entries(PLATFORMS)) {
    if (def.hosts.some(re => re.test(host))) return key;
    if ((def.shortHosts || []).some(re => re.test(host))) return key;
  }
  return null;
}

function isShortHost(def, host) {
  return (def.shortHosts || []).some(re => re.test(host));
}

// --- Mesajlar --------------------------------------------------------------
const MESSAGES = {
  needMedia: {
    tr: (p, ornek) => `Bu servis için gönderi/video bağlantısı gerekiyor, profil bağlantısı değil. Örnek: ${ornek}`,
    en: (p, ornek) => `This service needs a post/video link, not a profile link. Example: ${ornek}`
  },
  needProfile: {
    tr: (p, ornek) => `Bu servis için profil/kanal bağlantısı gerekiyor, gönderi bağlantısı değil. Örnek: ${ornek}`,
    en: (p, ornek) => `This service needs a profile/channel link, not a post link. Example: ${ornek}`
  },
  needStory: {
    tr: () => 'Bu servis hikâye (story) bağlantısı gerektiriyor. Hikâyenin bağlantısını kopyalayıp yapıştırın.',
    en: () => 'This service requires a story link. Please copy and paste the story link.'
  },
  wrongPlatform: {
    tr: (beklenen, gelen) => `Bu servis ${beklenen} için. Girdiğiniz bağlantı ${gelen} bağlantısı. Lütfen ${beklenen} bağlantısı girin.`,
    en: (beklenen, gelen) => `This service is for ${beklenen}, but you entered a ${gelen} link. Please enter a ${beklenen} link.`
  },
  usernameNotAllowed: {
    tr: (p, ornek) => `Bu servis için sadece kullanıcı adı yeterli değil; gönderi/video bağlantısı girmelisiniz. Örnek: ${ornek}`,
    en: (p, ornek) => `A username is not enough for this service; you must enter a post/video link. Example: ${ornek}`
  }
};

const pick = (key, lang) => MESSAGES[key][lang === 'en' ? 'en' : 'tr'];

/**
 * @param {string} link      musterinin girdigi bagalanti veya kullanici adi
 * @param {object} service   servis kaydi (name, name_tr, name_en, category_name)
 * @param {string} lang      'tr' | 'en'
 * @returns {{ok: true} | {ok: false, message: string, code: string}}
 */
function validateOrderLink(link, service, lang = 'tr') {
  const raw = String(link || '').trim();
  if (!raw) return { ok: true };   // bos kontrolu cagiran tarafta zaten var

  const serviceText = [service?.name, service?.name_tr, service?.name_en,
    service?.category_name, service?.category_name_en].filter(Boolean).join(' ');

  const expectedPlatform = detectPlatform(serviceText);
  const target = detectTarget(serviceText);

  // Servisin ne istedigini cozemediysek karisma.
  if (!expectedPlatform || !target) return { ok: true };
  const def = PLATFORMS[expectedPlatform];

  // --- 1) Link degil, kullanici adi girilmis ---
  if (!raw.includes('://') && !raw.includes('/')) {
    if (target === 'profile') return { ok: true };            // takipci icin kullanici adi gecerli
    if (target === 'media' || target === 'story') {
      return {
        ok: false, code: 'username_not_allowed',
        message: pick('usernameNotAllowed', lang)(def.label, def.ornekMedya)
      };
    }
    return { ok: true };
  }

  // --- 2) URL olarak cozumle ---
  let url;
  try {
    url = new URL(raw.includes('://') ? raw : `https://${raw}`);
  } catch {
    return { ok: true };   // cozumlenemeyen metne karisma, saglayici karar versin
  }
  if (!/^https?:$/.test(url.protocol)) return { ok: true };

  const host = url.hostname.toLowerCase();
  const path = url.pathname.replace(/\/+$/, '') || '/';

  // --- 3) Baska bir platformun linki mi? ---
  const linkPlatform = platformOfHost(host);
  if (linkPlatform && linkPlatform !== expectedPlatform) {
    return {
      ok: false, code: 'wrong_platform',
      message: pick('wrongPlatform', lang)(def.label, PLATFORMS[linkPlatform].label)
    };
  }
  // Taniyamadigimiz alan adi (kisaltma servisi, yonlendirme vb.) -> karisma
  if (!linkPlatform) return { ok: true };

  // Kisa link (youtu.be, vm.tiktok.com): icerigi acmadan tip anlasilamaz.
  if (isShortHost(def, host)) {
    // youtu.be her zaman video demektir; profil servisi icin yanlistir.
    if (expectedPlatform === 'youtube' && target === 'profile') {
      return {
        ok: false, code: 'need_profile',
        message: pick('needProfile', lang)(def.label, def.ornekProfil)
      };
    }
    return { ok: true };
  }

  const isMedia = matchAny(def.media, path);
  const isStory = matchAny(def.story, path);
  const firstSegment = path.split('/').filter(Boolean)[0] || '';
  const isReserved = (def.reserved || []).includes(firstSegment.toLowerCase());
  const isProfile = !isMedia && !isStory && !isReserved && matchAny(def.profile, path);

  // --- 4) Hedef tipiyle karsilastir ---
  if (target === 'media') {
    if (isMedia) return { ok: true };
    if (isProfile || path === '/') {
      return {
        ok: false, code: 'need_media',
        message: pick('needMedia', lang)(def.label, def.ornekMedya)
      };
    }
    return { ok: true };   // emin degiliz -> gecir
  }

  if (target === 'profile') {
    if (isProfile) return { ok: true };
    if (isMedia || isStory) {
      return {
        ok: false, code: 'need_profile',
        message: pick('needProfile', lang)(def.label, def.ornekProfil)
      };
    }
    return { ok: true };
  }

  if (target === 'story') {
    if (isStory) return { ok: true };
    // Instagram disinda hikaye linki formatini bilmiyoruz -> karisma
    if (expectedPlatform === 'instagram' && (isProfile || isMedia)) {
      return { ok: false, code: 'need_story', message: pick('needStory', lang)() };
    }
    return { ok: true };
  }

  return { ok: true };
}

module.exports = { validateOrderLink, detectPlatform, detectTarget, PLATFORMS };
