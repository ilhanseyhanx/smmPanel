// Hazir e-posta sablonlari: ilk kurulumda email_templates tablosuna eklenir.
// Yer tutucular gonderim aninda doldurulur:
//   {kullanici_adi}  -> uyenin kullanici adi
//   {site_adi}       -> Site Ayarlari'ndaki site adi
//   {site_link}      -> PUBLIC_BASE_URL
//   {siparis_no}     -> siparis numarasi (yalnizca siparis mailinde)
//   {servis_adi}     -> siparisteki servis adi (yalnizca siparis mailinde)

const WRAP_TOP = `<div style="max-width:560px;margin:0 auto;font-family:Segoe UI,Arial,sans-serif;color:#1f2937;line-height:1.65;">
<div style="padding:18px 22px;background:#0b0e14;border-radius:12px 12px 0 0;">
  <span style="color:#fff;font-size:20px;font-weight:800;font-style:italic;">{site_adi}</span>
</div>
<div style="padding:26px 22px;background:#ffffff;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;">`;

const WRAP_BOTTOM = `</div></div>`;

function button(text) {
  return `<p style="text-align:center;margin:26px 0;"><a href="{site_link}" style="display:inline-block;padding:13px 28px;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;">${text}</a></p>`;
}

// Siparis tamamlaninca admin panelden tek tikla gonderilen yorum daveti.
// Trustpilot baglantisi sablonun icindedir: admin, E-Posta Pazarlama >
// Sablonlar ekranindan metni ve baglantiyi diledigi gibi degistirebilir.
const REVIEW_TEMPLATE_NAME = 'Sipariş Tamamlandı — Yorum Daveti';

const DEFAULT_TEMPLATES = [
  {
    name: REVIEW_TEMPLATE_NAME,
    subject: '🎉 Siparişin tamamlandı {kullanici_adi} — görüşün bizim için değerli!',
    body: `${WRAP_TOP}
<h2 style="margin:0 0 12px;">Siparişin başarıyla tamamlandı! 🎉</h2>
<p>Merhaba {kullanici_adi},</p>
<p><b>#{siparis_no}</b> numaralı <b>{servis_adi}</b> siparişin teslim edildi. Bizi tercih ettiğin için teşekkürler!</p>
<p>Deneyimin bizim için çok önemli. Kısa bir yorum bırakırsan hem hizmetimizi geliştirmemize yardım edersin hem de diğer kullanıcılara yol gösterirsin. 🙏</p>
<p style="text-align:center;margin:26px 0;"><a href="https://www.trustpilot.com/review/jetsmmpanel.com" style="display:inline-block;padding:13px 28px;background:#00b67a;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;">⭐ Trustpilot'ta Değerlendir</a></p>
<p style="font-size:13px;color:#6b7280;">Dilersen görüşünü panel içinden de paylaşabilirsin: Siparişlerim sayfasındaki "Deneyimini Paylaş" kutusunu kullanman yeterli.</p>
${WRAP_BOTTOM}`
  },
  {
    name: 'Hoş Geldin',
    subject: '{site_adi} ailesine hoş geldin, {kullanici_adi}! 🎉',
    body: `${WRAP_TOP}
<h2 style="margin:0 0 12px;">Aramıza hoş geldin, {kullanici_adi}! 👋</h2>
<p>Hesabın hazır. Sosyal medya hesaplarını büyütmek için binlerce servis seni bekliyor: takipçi, beğeni, izlenme ve daha fazlası — hepsi otomatik teslimatla.</p>
<p>İlk siparişini vermek 1 dakikanı almaz: bakiye yükle, servisi seç, bağlantını gir. Gerisini biz hallederiz. 🚀</p>
${button('İlk Siparişini Ver')}
${WRAP_BOTTOM}`
  },
  {
    name: 'Seni Özledik',
    subject: 'Seni özledik {kullanici_adi}! Sana özel fırsatlar var 💜',
    body: `${WRAP_TOP}
<h2 style="margin:0 0 12px;">Uzun zamandır yoksun, {kullanici_adi} 👀</h2>
<p>Sen yokken panelde çok şey değişti: yeni servisler eklendi, fiyatlar güncellendi ve kampanyalar seni bekliyor.</p>
<p>Geri dönmen için bir bahane arıyorsan: <b>bugün panele göz at</b> — aktif kampanyaları görünce mutlu olacaksın. 😉</p>
${button('Panele Dön')}
${WRAP_BOTTOM}`
  },
  {
    name: 'İndirim Duyurusu',
    subject: '🏷️ {kullanici_adi}, indirim başladı — kaçırma!',
    body: `${WRAP_TOP}
<h2 style="margin:0 0 12px;">İndirim rüzgarı başladı! 🏷️</h2>
<p>Merhaba {kullanici_adi},</p>
<p>Seçili servislerde indirim şu an aktif. İndirimli fiyatlar sitede üstü çizili eski fiyatlarla birlikte görünüyor — gördüğün fiyat, ödeyeceğin fiyat.</p>
<p><b>Stok ve süre sınırlı;</b> kampanya bitmeden siparişini ver.</p>
${button('İndirimleri Gör')}
${WRAP_BOTTOM}`
  },
  {
    name: 'Bakiye Bonus Kampanyası',
    subject: '🎁 Bakiye yükle, bonus kazan {kullanici_adi}!',
    body: `${WRAP_TOP}
<h2 style="margin:0 0 12px;">Yüklediğinden fazlası hesabında! 🎁</h2>
<p>Merhaba {kullanici_adi},</p>
<p>Şu an aktif bonus kampanyamızla bakiye yüklemelerine <b>ekstra bonus</b> tanımlanıyor — bonus, ödemen onaylandığı anda otomatik olarak hesabına geçer.</p>
<p>Kart, kripto veya havale... hangi yöntemle yüklersen yükle, bonus senin.</p>
${button('Bakiye Yükle')}
${WRAP_BOTTOM}`
  },
  {
    name: 'Yeni Servis Duyurusu',
    subject: '🆕 Yeni servisler yayında {kullanici_adi}!',
    body: `${WRAP_TOP}
<h2 style="margin:0 0 12px;">Kataloğa taze kan geldi! 🆕</h2>
<p>Merhaba {kullanici_adi},</p>
<p>Panele yeni servisler ekledik. Daha hızlı başlangıç, daha kaliteli kaynaklar ve rekabetçi fiyatlarla yeni seçenekler seni bekliyor.</p>
<p>Katalogdaki "yeni" etiketli servislere göz at — aradığın o servis gelmiş olabilir. 👀</p>
${button('Yeni Servisleri İncele')}
${WRAP_BOTTOM}`
  },
  {
    name: 'Açılışa Özel',
    subject: '🎉 Açılışa özel fırsatlar seni bekliyor {kullanici_adi}!',
    body: `${WRAP_TOP}
<h2 style="margin:0 0 12px;">Açılışa özel, sana özel! 🎉</h2>
<p>Merhaba {kullanici_adi},</p>
<p>Açılış dönemimize özel kampanyalar şu an yayında: indirimli servisler, bakiye bonusları ve sürpriz kuponlar...</p>
<p>Bu fırsatlar açılış dönemiyle sınırlı — <b>en iyi fiyatları şimdi yakala.</b></p>
${button('Fırsatları Kap')}
${WRAP_BOTTOM}`
  },
  {
    name: 'Hafta Sonu Fırsatı',
    subject: '⚡ Hafta sonuna özel fırsat, {kullanici_adi}!',
    body: `${WRAP_TOP}
<h2 style="margin:0 0 12px;">Hafta sonu modu: AÇIK ⚡</h2>
<p>Merhaba {kullanici_adi},</p>
<p>Hafta sonuna özel kampanyamız başladı ve pazar gece yarısına kadar sürecek. Hesabını büyütmek için haftanın en doğru zamanı!</p>
<p>Pazartesi "keşke" dememek için bugünden siparişini ver. 😄</p>
${button('Hafta Sonu Fırsatını Gör')}
${WRAP_BOTTOM}`
  },
  {
    name: 'VIP Teşekkür',
    subject: '💎 Teşekkürler {kullanici_adi} — sen bizim için özelsin',
    body: `${WRAP_TOP}
<h2 style="margin:0 0 12px;">Sadakatin için teşekkürler 💎</h2>
<p>Merhaba {kullanici_adi},</p>
<p>Bizi tercih eden en değerli kullanıcılarımızdan birisin ve bunu bilmenizi istedik. VIP seviyene özel avantajlar hesabında seni bekliyor.</p>
<p>Her siparişinde yanındayız — bir sorun olursa destek ekibimiz 7/24 hazır.</p>
${button('Hesabımı Gör')}
${WRAP_BOTTOM}`
  },
  {
    name: 'Bakiye Hatırlatma',
    subject: '💰 {kullanici_adi}, bakiyen seni bekliyor!',
    body: `${WRAP_TOP}
<h2 style="margin:0 0 12px;">Bakiyen boşta durmasın 💰</h2>
<p>Merhaba {kullanici_adi},</p>
<p>Hesabında kullanılmayı bekleyen bakiyen var. Onu takipçiye, beğeniye veya izlenmeye çevirmek sadece 1 dakika sürer.</p>
<p>Üstelik şu an aktif kampanyalar varsa bakiyen her zamankinden daha değerli. 😉</p>
${button('Sipariş Ver')}
${WRAP_BOTTOM}`
  },
  {
    name: 'Özel Gün Kutlaması',
    subject: '🎊 Bugün güzel bir gün, {kullanici_adi}!',
    body: `${WRAP_TOP}
<h2 style="margin:0 0 12px;">Kutlama zamanı! 🎊</h2>
<p>Merhaba {kullanici_adi},</p>
<p>Bugün bizim için özel bir gün ve bunu en değerli kullanıcılarımızla kutlamak istedik. Panelde bugüne özel sürprizler olabilir; göz atmadan geçme. 🎁</p>
<p>İyi ki varsın!</p>
${button('Sürprizlere Bak')}
${WRAP_BOTTOM}`
  }
];

// Islevsel (transactional) mailler icin sablon: sifre sifirlama, e-posta
// dogrulama gibi tek butonlu bilgilendirme mailleri. Kampanya sablonlariyla
// ayni gorsel dili kullanir ki marka tutarli kalsin.
function transactionalEmail({ siteName, title, intro, buttonText, buttonUrl, note }) {
  const safeSite = String(siteName || 'SMM Panel');
  return `<div style="max-width:560px;margin:0 auto;font-family:Segoe UI,Arial,sans-serif;color:#1f2937;line-height:1.65;">
<div style="padding:20px 24px;background:linear-gradient(135deg,#0b0e14,#1e1b4b);border-radius:12px 12px 0 0;text-align:center;">
  <span style="color:#fff;font-size:22px;font-weight:800;font-style:italic;letter-spacing:.5px;">${safeSite}</span>
</div>
<div style="padding:30px 26px;background:#ffffff;border:1px solid #e5e7eb;border-top:0;">
  <h2 style="margin:0 0 14px;font-size:20px;color:#111827;">${title}</h2>
  <p style="margin:0 0 8px;">${intro}</p>
  <p style="text-align:center;margin:28px 0;">
    <a href="${buttonUrl}" style="display:inline-block;padding:14px 32px;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;">${buttonText}</a>
  </p>
  <p style="margin:0;font-size:13px;color:#6b7280;">Buton çalışmazsa bu bağlantıyı tarayıcına yapıştır:<br>
  <a href="${buttonUrl}" style="color:#7c3aed;word-break:break-all;">${buttonUrl}</a></p>
</div>
<div style="padding:16px 24px;background:#f9fafb;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;font-size:12px;color:#9ca3af;">
  <p style="margin:0 0 4px;">${note}</p>
  <p style="margin:0;">Bu e-posta ${safeSite} tarafından otomatik gönderildi; yanıtlamana gerek yok.</p>
</div>
</div>`;
}

// 6 haneli dogrulama kodu maili: site icindeki animasyonlu dogrulama
// ekranina girilecek kodu buyuk puntoyla gosterir.
function verificationCodeEmail({ siteName, username, code }) {
  const safeSite = String(siteName || 'Jet SMM Panel');
  const digits = String(code).split('').join('&nbsp;&nbsp;');
  return `<div style="max-width:560px;margin:0 auto;font-family:Segoe UI,Arial,sans-serif;color:#1f2937;line-height:1.65;">
<div style="padding:20px 24px;background:linear-gradient(135deg,#0b0e14,#1e1b4b);border-radius:12px 12px 0 0;text-align:center;">
  <span style="color:#fff;font-size:22px;font-weight:800;font-style:italic;letter-spacing:.5px;">${safeSite}</span>
</div>
<div style="padding:30px 26px;background:#ffffff;border:1px solid #e5e7eb;border-top:0;text-align:center;">
  <h2 style="margin:0 0 14px;font-size:20px;color:#111827;">E-posta doğrulama kodun 🔐</h2>
  <p style="margin:0 0 8px;">Merhaba ${username}, aşağıdaki kodu sitedeki doğrulama ekranına gir:</p>
  <p style="margin:26px 0;"><span style="display:inline-block;padding:16px 26px;background:#f3f4f6;border:2px dashed #7c3aed;border-radius:12px;font-size:30px;font-weight:800;letter-spacing:4px;color:#111827;font-family:Consolas,Menlo,monospace;">${digits}</span></p>
  <p style="margin:0;font-size:13px;color:#6b7280;">Kod <b>15 dakika</b> geçerlidir. Bu talebi sen yapmadıysan bu maili görmezden gelebilirsin.</p>
</div>
<div style="padding:16px 24px;background:#f9fafb;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;font-size:12px;color:#9ca3af;text-align:center;">
  <p style="margin:0;">Bu e-posta ${safeSite} tarafından otomatik gönderildi; yanıtlamana gerek yok.</p>
</div>
</div>`;
}

module.exports = { DEFAULT_TEMPLATES, REVIEW_TEMPLATE_NAME, transactionalEmail, verificationCodeEmail };
