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

module.exports = { friendlyProviderReason };
