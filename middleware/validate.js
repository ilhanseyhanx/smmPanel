// Site iki dilli oldugu icin dogrulama mesajlari da iki dilli uretilir.
// Sema icinde ozel mesaj verilirken bilingual() kullanilir; ayirici karakter
// (U+241F) normal metinde bulunmaz, boylece mesajlar guvenle ayrilir.
const SEPARATOR = '␟';

function bilingual(tr, en) {
  return `${tr}${SEPARATOR}${en}`;
}

function splitBilingual(message) {
  const text = String(message || '');
  const index = text.indexOf(SEPARATOR);
  if (index === -1) return { tr: text, en: text };
  return { tr: text.slice(0, index), en: text.slice(index + 1) };
}

// Alan adlarinin kullaniciya gosterilecek karsiliklari. Listede olmayan alanlar
// icin ham anahtar kullanilir — hic yoktan iyidir.
const FIELD_LABELS = {
  username: { tr: 'Kullanıcı adı', en: 'Username' },
  email: { tr: 'E-posta adresi', en: 'Email address' },
  password: { tr: 'Şifre', en: 'Password' },
  new_password: { tr: 'Yeni şifre', en: 'New password' },
  current_password: { tr: 'Mevcut şifre', en: 'Current password' },
  totp: { tr: 'Doğrulama kodu', en: 'Verification code' },
  referral: { tr: 'Referans kodu', en: 'Referral code' },
  link: { tr: 'Bağlantı (link)', en: 'Link' },
  quantity: { tr: 'Adet', en: 'Quantity' },
  service_id: { tr: 'Servis', en: 'Service' },
  amount: { tr: 'Tutar', en: 'Amount' },
  subject: { tr: 'Konu', en: 'Subject' },
  message: { tr: 'Mesaj', en: 'Message' },
  name: { tr: 'Ad', en: 'Name' },
  title: { tr: 'Başlık', en: 'Title' },
  content: { tr: 'İçerik', en: 'Content' },
  slug: { tr: 'Adres (slug)', en: 'Slug' },
  code: { tr: 'Kod', en: 'Code' },
  token: { tr: 'Doğrulama bağlantısı', en: 'Verification link' }
};

// Zod'un kendi mesajlari Ingilizce ve teknik ("Too small: expected string...").
// Semada ozel mesaj verilmisse o kullanilir; verilmemisse hata koduna gore
// her iki dilde anlasilir bir cumle uretilir.
const ZOD_DEFAULT_MESSAGE = /^(Invalid|Too small|Too big|Required|Expected|Unrecognized|String must|Number must)/i;

function labelFor(issue) {
  const key = issue.path.length ? String(issue.path[0]) : '';
  return FIELD_LABELS[key] || { tr: key || 'Gönderilen bilgi', en: key || 'Submitted value' };
}

function humanizeIssue(issue) {
  const raw = String(issue.message || '');
  if (raw && !ZOD_DEFAULT_MESSAGE.test(raw)) return splitBilingual(raw);

  const label = labelFor(issue);
  const isNumber = issue.origin === 'number' || issue.type === 'number';

  if (/email/i.test(raw) || issue.format === 'email') {
    return {
      tr: `${label.tr} geçerli bir e-posta adresi olmalıdır. (örnek: ad@site.com)`,
      en: `${label.en} must be a valid email address. (example: name@site.com)`
    };
  }
  if (issue.code === 'invalid_type') {
    return issue.received === 'undefined'
      ? { tr: `${label.tr} zorunludur, boş bırakılamaz.`, en: `${label.en} is required and cannot be empty.` }
      : { tr: `${label.tr} beklenen biçimde değil.`, en: `${label.en} is not in the expected format.` };
  }
  if (issue.code === 'too_small') {
    const min = issue.minimum;
    if (isNumber) return { tr: `${label.tr} en az ${min} olmalıdır.`, en: `${label.en} must be at least ${min}.` };
    if (min === 1) return { tr: `${label.tr} zorunludur, boş bırakılamaz.`, en: `${label.en} is required and cannot be empty.` };
    return { tr: `${label.tr} en az ${min} karakter olmalıdır.`, en: `${label.en} must be at least ${min} characters.` };
  }
  if (issue.code === 'too_big') {
    const max = issue.maximum;
    if (isNumber) return { tr: `${label.tr} en fazla ${max} olabilir.`, en: `${label.en} can be at most ${max}.` };
    return { tr: `${label.tr} en fazla ${max} karakter olabilir.`, en: `${label.en} can be at most ${max} characters.` };
  }
  if (issue.code === 'invalid_format' || issue.code === 'invalid_string') {
    return { tr: `${label.tr} geçerli biçimde değil.`, en: `${label.en} is not in a valid format.` };
  }
  if (issue.code === 'invalid_enum_value' || issue.code === 'invalid_value') {
    return { tr: `${label.tr} için geçersiz bir seçim yapıldı.`, en: `An invalid option was selected for ${label.en}.` };
  }
  return { tr: `${label.tr} geçersiz.`, en: `${label.en} is invalid.` };
}

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map(issue => {
        const text = humanizeIssue(issue);
        return { field: issue.path.join('.'), message: text.tr, message_en: text.en };
      });
      // error alani tek basina da anlasilir olmali: yalnizca "error" gosteren
      // eski istemcilerde bile kullanici sorunun ne oldugunu gorebilsin.
      const joinUnique = key => [...new Set(details.map(item => item[key]))].join(' ');
      return res.status(400).json({
        error: joinUnique('message'),
        error_en: joinUnique('message_en'),
        details
      });
    }
    req[source] = result.data;
    next();
  };
}

module.exports = { validate, humanizeIssue, bilingual, splitBilingual };
