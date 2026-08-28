const crypto = require('crypto');
const sanitizeHtml = require('sanitize-html');

function createOpaqueToken(prefix = '') {
  return prefix + crypto.randomBytes(32).toString('base64url');
}

function tokenHash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function encryptionKey() {
  // Uretimde JWT_SECRET'a geri dusulmez: JWT_SECRET rotasyonu (oturumlari yenilemek
  // icin normal bir islem) aksi halde kayitli 2FA sirlarini cozulemez hale getirirdi.
  if (process.env.NODE_ENV === 'production' && !process.env.APP_ENCRYPTION_KEY) {
    throw new Error('Production ortamında APP_ENCRYPTION_KEY zorunludur.');
  }
  const source = process.env.APP_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!source) throw new Error('APP_ENCRYPTION_KEY veya JWT_SECRET gereklidir.');
  return crypto.createHash('sha256').update(source).digest();
}

function encryptSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

function decryptSecret(value) {
  const [iv, tag, encrypted] = String(value).split('.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
}

function normalizePlainText(value, maxLength = 1000) {
  if (typeof value !== 'string') return '';
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} })
    .trim()
    .slice(0, maxLength);
}

function sanitizeRichText(value) {
  return sanitizeHtml(String(value || ''), {
    allowedTags: ['p', 'br', 'hr', 'h2', 'h3', 'h4', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'blockquote', 'a',
      'figure', 'figcaption', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'pre', 'code'],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      th: ['colspan', 'rowspan'], td: ['colspan', 'rowspan']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      // Ic baglantilar (site ici, "/" ile baslayan) nofollow ALMAZ: aksi halde
      // blog yazilari arasindaki baglanti degeri arama motorlarina hic akmaz
      // ve konu kumesi/pillar yapisi islevsiz kalir. Dis baglantilar ise
      // nofollow + yeni sekme ile acilir (spam ve guvenlik).
      a(tagName, attribs) {
        const href = String(attribs.href || '');
        const icBaglanti = href.startsWith('/') || href.startsWith('#');
        return {
          tagName: 'a',
          attribs: icBaglanti
            ? { ...attribs, rel: 'noopener noreferrer' }
            : { ...attribs, rel: 'noopener noreferrer nofollow', target: '_blank' }
        };
      },
      img: sanitizeHtml.simpleTransform('img', { loading: 'lazy' }, true)
    }
  });
}

function isSafeHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

module.exports = { createOpaqueToken, tokenHash, encryptSecret, decryptSecret, normalizePlainText, sanitizeRichText, isSafeHttpUrl };
