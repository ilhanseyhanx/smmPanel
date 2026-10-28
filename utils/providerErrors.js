// Saglayicidan donen teknik/Ingilizce hata metnini kullanicinin anlayacagi
// Turkce bir aciklamaya cevirir. Hem musteri siparisinde hem admin'in
// kullaniciya hizmet atamasinda kullanilir.
function friendlyProviderReason(raw) {
  const msg = String(raw || '').toLowerCase();
  if (/link|url|username|hesap|profil/.test(msg)) return 'Girdiğiniz bağlantı/kullanıcı adı sağlayıcı tarafından kabul edilmedi. Bağlantıyı kontrol edip tekrar deneyin.';
  if (/quantity|miktar|minimum|maximum|min |max /.test(msg)) return 'Miktar bu servis için kabul edilmedi. Servisin min/max sınırlarına uygun bir miktar girin.';
  if (/not enough|insufficient|funds|balance|bakiye/.test(msg)) return 'Servis şu anda geçici olarak işlem alamıyor. Lütfen kısa bir süre sonra tekrar deneyin.';
  if (/disabled|not found|invalid service|incorrect service|servis/.test(msg)) return 'Bu servis şu anda sağlayıcıda kullanılamıyor. Farklı bir servis deneyebilir veya daha sonra tekrar deneyebilirsiniz.';
  if (/timeout|econn|network|unreachable|502|503|504/.test(msg)) return 'Sağlayıcıya ulaşılamadı. Lütfen birkaç dakika sonra tekrar deneyin.';
  if (/aktif sağlayıcı|sağlayıcı aktif değil/.test(msg)) return 'Bu servis şu anda işleme kapalı. Lütfen daha sonra tekrar deneyin.';
  return 'Sağlayıcı siparişi kabul etmedi. Lütfen daha sonra tekrar deneyin.';
}

// Saglayicinin miktar sinirini metinden okur: "Quantity less than minimal 100",
// "Quantity more than maximal 10 000", "Minimum quantity is 50" gibi.
// Sinir saglayici birimindedir (carpan ve fazla gonderim dahil miktar).
function providerQuantityLimit(raw) {
  const msg = String(raw || '');
  const number = text => Number(String(text).replace(/[\s.,]/g, ''));
  const min = msg.match(/(?:less than minimal|minimal|minimum|min\.?(?:\s*(?:quantity|order|amount))?\s*(?:is|:)|at least)\D{0,30}?(\d[\d\s.,]*\d|\d)/i);
  if (min && number(min[1]) > 0) return { kind: 'min', value: number(min[1]) };
  const max = msg.match(/(?:more than maximal|maximal|maximum|max\.?(?:\s*(?:quantity|order|amount))?\s*(?:is|:)|at most)\D{0,30}?(\d[\d\s.,]*\d|\d)/i);
  if (max && number(max[1]) > 0) return { kind: 'max', value: number(max[1]) };
  return null;
}

module.exports = { friendlyProviderReason, providerQuantityLimit };
