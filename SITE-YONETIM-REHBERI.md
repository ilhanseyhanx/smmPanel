# 🛠️ JETSMMPANEL — Site Yönetim Rehberi

Site canlıda: **https://jetsmmpanel.com** · Sunucu: Contabo (IP: 169.58.173.57) · Bu dosya iki şeyi anlatır:
**A)** Açılış öncesi panel içi kurulum listesi — **B)** Kodda değişiklik yapınca sunucuya nasıl atılır.

---

## BÖLÜM A — Panel İçi Kurulum Kontrol Listesi

Hepsi **https://jetsmmpanel.com** → admin girişi → **Admin Panel** içinden yapılır. Sırayla işaretle:

### 1. Güvenlik (İLK İŞ!)
- [ ] **Admin şifresini değiştir** — Site Ayarları → Güvenlik (geçici şifre sohbette yazılı kaldı, mutlaka değiştir)
- [ ] **2FA'yı aç** — Hesabım/profil bölümünden iki adımlı doğrulamayı etkinleştir, QR'ı Google Authenticator ile okut

### 2. E-Posta (SMTP)
- [ ] Site Ayarları → **E-Posta (SMTP)**:
  - Sunucu: `smtp.gmail.com` · Port: `587` · SSL kutusu: kapalı
  - Kullanıcı: Gmail adresin · Şifre: **16 haneli uygulama şifren** (hazırlamıştın)
  - Gönderen: `SMMJET <gmailadresin@gmail.com>`
- [ ] Kaydet → **"Test E-postası Gönder"** → gelen kutunu kontrol et

### 3. Telegram Bildirimleri
- [ ] Site Ayarları → **Telegram**: Bot token'ını yapıştır → Kaydet
- [ ] **🔍 Chat ID'yi Bul** → Kaydet → **Test Mesajı Gönder** (bota daha önce /start atmıştın, hatırla: bot cevap yazmaz, sana bildirim atar)
- [ ] Dört bildirim kutusu da işaretli kalsın (kayıt / sipariş / ödeme / destek)

### 4. Ödeme Yöntemleri
- [ ] Site Ayarları → **Ödeme** → NOWPayments **API Key** + **IPN Secret** yapıştır → Kaydet
- [ ] NOWPayments panelinde webhook ayarlarına dokunma (kod kendi adresini gönderiyor)
- [ ] **Havale/Papara Hesapları** kutusuna gerçek İBAN'larını gir (format: `Banka Adı | Ad Soyad | TR.. IBAN`)
- [ ] **Sağlayıcı Bakiye Uyarısı** eşiğini gir (örn. `20` = $20 kalınca Telegram uyarısı)

### 5. Sağlayıcı ve Servisler
- [ ] Admin Panel → **Sağlayıcılar** → gerçek SMM sağlayıcının API URL + API Key'ini ekle
- [ ] **Servisleri İncele & Seçerek Ekle** veya **Toplu Aktar** (kâr marjını % olarak belirle)
- [ ] Ana sayfada servislerin göründüğünü kontrol et

### 6. İçerik ve Görünüm
- [ ] Site Ayarları → **Genel & Duyuru**: duyuru metni (TR+EN), site adı, USD/TRY kuru
- [ ] Kampanyalar sekmesi → açılış kampanyası + popup (istersen 🎉 Açılış şablonuyla)
- [ ] Kuponlar → `HOSGELDIN` / `WELCOME` tarzı çift kodlu açılış kuponu

### 7. SEO & Analitik
- [ ] **Google Analytics**: analytics.google.com → mülk aç → `G-XXXX` kimliğini Site Ayarları → Genel → SEO & Analitik'e yapıştır
- [ ] **Search Console**: search.google.com/search-console → mülk ekle (URL öneki: https://jetsmmpanel.com) → HTML etiketi doğrulamasını aynı yere yapıştır → Kaydet → Search Console'da "Doğrula"
- [ ] Search Console → **Site Haritaları** → `https://jetsmmpanel.com/sitemap.xml` gönder

### 8. İzleme
- [ ] **uptimerobot.com** → ücretsiz kayıt → Add Monitor → HTTP(s) → `https://jetsmmpanel.com` → 5 dk → e-posta uyarısı

### 9. Canlı Testler (gerçek parayla küçük tutarlar)
- [ ] Yeni kullanıcı kaydı → Telegram bildirimi geldi mi?
- [ ] Şifre sıfırlama e-postası geldi mi?
- [ ] Kripto: minimum tutarla USDT yükle → QR ekranı → bakiye otomatik geçti mi?
- [ ] Banka bildirimi → Telegram → panelden onayla → bakiye geçti mi?
- [ ] Küçük gerçek sipariş → sağlayıcıya gitti mi, durum güncelleniyor mu?
- [ ] Telefondan tüm sayfaları gez

### 10. Sonrası (acele yok)
- [ ] PayTR gerçek hesap başvurusu (yasal sayfaların footer'da hazır) → onay gelince sunucudaki `.env`'e merchant bilgileri + `PAYTR_TEST_MODE=0`
- [ ] Haftada bir yedek indir (aşağıda komutu var)

---

## BÖLÜM B — Kod Değişikliğini Sunucuya Atma

### Yöntem 1: Claude'a söyle (en kolayı) ⭐
Kod değişikliğini yaptırdıktan sonra tek cümle yeter:
> **"kanka bunu sunucuya at"**

Claude paketler, yükler, yeniden başlatır, test eder. Bitti.

### Yöntem 2: Kendin at (3 komut)
VSCode'da terminal aç (Terminal → New Terminal), sırayla yapıştır:

```powershell
# 1) Paketle (veritabani, .env ve node_modules haric — onlar sunucuda korunur)
cd "C:\Users\cam2\Desktop\D diski\YAZILIMLARIM\SmmPanel"
tar --exclude=node_modules --exclude="database.sqlite*" --exclude=.env --exclude=backups --exclude=.git -czf "$env:TEMP\smmjet.tar.gz" .

# 2) Sunucuya gonder
scp "$env:TEMP\smmjet.tar.gz" root@169.58.173.57:/root/smmjet.tar.gz

# 3) Ac, bagimliliklari tazele, yeniden baslat
ssh root@169.58.173.57 "tar -xzf /root/smmjet.tar.gz -C /var/www/smmjet && rm /root/smmjet.tar.gz && cd /var/www/smmjet && npm install --omit=dev && pm2 restart smmjet && sleep 3 && curl -s -o /dev/null -w 'Site durumu: %{http_code}\n' http://127.0.0.1:3000/"
```

Son satır **"Site durumu: 200"** yazarsa güncelleme başarılı. ⚠️ Müşteri verileri (veritabanı) ve sunucu ayarları (.env) bu işlemden **etkilenmez** — sadece kod yenilenir.

### Faydalı sunucu komutları
```powershell
ssh root@169.58.173.57 "pm2 status"          # site calisiyor mu?
ssh root@169.58.173.57 "pm2 logs smmjet --lines 30 --nostream"   # son loglar (hata ararken)
ssh root@169.58.173.57 "pm2 restart smmjet"  # yeniden baslat
scp root@169.58.173.57:/root/yedekler/db-ilk.sqlite "C:\Yedekler\"  # yedek indir (dosya adini degistir)
```

### Acil durum
| Sorun | Çözüm |
|-------|-------|
| Site açılmıyor | `ssh root@169.58.173.57 "pm2 restart smmjet"` → düzelmezse loglara bak |
| Güncelleme sonrası hata | Claude'a logları göster: `pm2 logs smmjet --lines 50 --nostream` |
| Sunucu tamamen erişilmez | Contabo paneli → sunucuyu Restart et |
| DDoS saldırısı | Cloudflare panel → **Under Attack Mode** aç |

*Güncelleme: 13 Ağustos 2026 — canlıya alınış günü* 🚀
