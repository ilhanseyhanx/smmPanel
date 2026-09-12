# Cloudflare Email Routing kurulumu

Mevcut `info@jetsmmpanel.com -> ilhanseyhan5@gmail.com` kuralı aynen kalabilir.
Dijital ürün teslimatları için alan adının catch-all kuralı bu Worker'a
bağlanır; Worker yalnızca `order-*` adreslerini kabul eder. Açıkça tanımlı
`info@` kuralı öncelikli kaldığı için normal yönlendirme bozulmaz. Böylece sağlayıcının maili önce siparişle eşleşir, şablonlanır ve
sonra müşterinin siparişte yazdığı e-posta adresine panel SMTP hesabından gider.

Worker ayarları:

- `SMMJET_WEBHOOK_URL`: `https://jetsmmpanel.com/api/inbound-delivery/cloudflare`
- `SMMJET_WEBHOOK_SECRET`: uzun, rastgele bir secret binding

Aynı gizli değer uygulama sunucusunda `INBOUND_EMAIL_WEBHOOK_SECRET` olarak,
`INBOUND_EMAIL_DOMAIN=jetsmmpanel.com` ile birlikte tanımlanmalıdır.

Cloudflare Email Routing'de catch-all eylemi Worker'a yönlendirilmelidir.
Sabit `info@` yönlendirmesi sipariş eşleştirme için
kullanılmaz; normal iletişim adresi olarak Gmail'e yönlenmeye devam eder.
