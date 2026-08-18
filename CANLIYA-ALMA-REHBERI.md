# 🚀 SMMJET — Canlıya Alma Rehberi

Bu rehber, siteyi bilgisayarındaki `localhost`'tan gerçek bir alan adında yayına almak için yapman gereken **her şeyi sırasıyla** anlatır. Komutları sırayla kopyala-yapıştır yapabilirsin. Tahmini toplam süre: **2-3 saat** (çoğu bekleme).

---

## BÖLÜM 1 — Alan Adı ve Sunucu Satın Alma (~30 dk)

### 1.1 Alan adı (domain)
- Nereden: **Namecheap**, **Porkbun** veya Türkiye'den **İsimtescil / Turhost**.
- Ne alacaksın: `smmjet.com` gibi bir `.com` (yıllık ~10-15$). `.com.tr` şirket evrakı ister, uğraşma.
- Aldıktan sonra hiçbir ayar yapma, Bölüm 3'te döneceğiz.

### 1.2 Sunucu (VPS)
- Nereden: **Hetzner** (en ucuz, Almanya) veya **DigitalOcean**. Aylık 4-6$'lık en küçük paket (2 GB RAM) bu site için fazlasıyla yeter.
- Ne seçeceksin: **Ubuntu 24.04 LTS** işletim sistemi.
- Kayıt olurken SSH anahtarı sorarsa "şifre ile giriş"i seç (daha kolay başlangıç).
- Sunucu açılınca sana bir **IP adresi** verecek (örn. `65.108.24.17`) — bunu not et.

### 1.3 Cloudflare hesabı (ücretsiz — DDoS kalkanı)
- **cloudflare.com**'da ücretsiz hesap aç. SMM panel dünyasında rakiplerin DDoS saldırısı maalesef yaygın; Cloudflare ücretsiz planı bile siteni bu saldırılardan korur, sunucu IP'ni gizler ve statik dosyaları önbellekleyip hızlandırır.
- Şimdilik sadece hesap aç; bağlamayı Bölüm 3'te yapacağız.

---

## BÖLÜM 2 — Sunucuya Bağlanma ve Kurulum (~45 dk)

Windows'ta **PowerShell**'i aç ve sunucuna bağlan (IP'yi kendininkiyle değiştir):

```
ssh root@65.108.24.17
```

Şifreyi sorar (sağlayıcı e-postayla gönderdi). Bağlandıktan sonra sırayla:

### 2.1 Sistemi güncelle + gerekli paketler
```bash
apt update && apt upgrade -y
apt install -y curl git nginx ufw
```

### 2.2 Node.js 22 kur
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node -v   # v22.x görmelisin
```

### 2.3 Güvenlik duvarı
```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable   # sorarsa y
```

### 2.4 Projeyi sunucuya at
İki yol var:

**Yol A (Git — önerilen):** Projeyi GitHub'a *private* repo olarak yükle, sonra sunucuda:
```bash
cd /var/www
git clone https://github.com/KULLANICIADIN/SmmPanel.git smmjet
cd smmjet
```

**Yol B (Dosya kopyalama):** Kendi bilgisayarında PowerShell'de:
```
scp -r "C:\Users\cam2\Desktop\D diski\YAZILIMLARIM\SmmPanel" root@65.108.24.17:/var/www/smmjet
```
> ⚠️ `node_modules` ve `database.sqlite*` dosyalarını KOPYALAMA (temiz kurulacak). `backups/` klasörünü de atlama gerek yok ama gerekmez.

### 2.5 Bağımlılıkları kur
```bash
cd /var/www/smmjet
npm install --omit=dev
```

### 2.6 .env dosyasını üretime göre yaz
```bash
nano .env
```
İçine şunu yaz (değerleri kendine göre doldur):
```env
NODE_ENV=production
PORT=3000

# İkisine de UZUN RASTGELE değer üret; asla eski geliştirme değerini kullanma!
# Üretmek için: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=BURAYA_96_KARAKTERLIK_RASTGELE_DEGER
APP_ENCRYPTION_KEY=BURAYA_BASKA_96_KARAKTERLIK_RASTGELE_DEGER

PUBLIC_BASE_URL=https://smmjet.com
ALLOWED_ORIGINS=https://smmjet.com,https://www.smmjet.com

ENABLE_MOCK_PROVIDER=false
ALLOW_PRIVATE_PROVIDER_URLS=false
ENABLE_DEMO_PAYMENTS=false

# PayTR gerçek hesabın gelince doldur; test aşamasında TEST_MODE=1 kalsın
PAYTR_MERCHANT_ID=
PAYTR_MERCHANT_KEY=
PAYTR_MERCHANT_SALT=
PAYTR_TEST_MODE=1
```
> 💡 SMTP, Telegram, NOWPayments ve SEO ayarlarını `.env`'e yazmana gerek yok — hepsi admin panelinden giriliyor ve veritabanında duruyor.

Kaydet: `Ctrl+O` → Enter → `Ctrl+X`.

### 2.7 PM2 ile çalıştır (çökse bile kendini açar)
```bash
npm install -g pm2
pm2 start server.js --name smmjet
pm2 save
pm2 startup   # çıkan komutu kopyala-yapıştır çalıştır
```
Kontrol: `pm2 status` → smmjet "online" olmalı. Log izleme: `pm2 logs smmjet`.

---

## BÖLÜM 3 — Alan Adını Cloudflare Üzerinden Bağlama (~20 dk + bekleme)

DNS'i doğrudan alan adı firmasında tutmak yerine Cloudflare'den yöneteceğiz — koruma ve hız bedavaya geliyor.

### 3.1 Siteyi Cloudflare'e ekle
1. Cloudflare panelinde **"Add a site"** → `smmjet.com` yaz → **Free** planı seç.
2. Cloudflare sana **2 nameserver adresi** verecek (örn. `ana.ns.cloudflare.com`, `bob.ns.cloudflare.com`).
3. Alan adını aldığın firmanın (Namecheap vb.) panelinde **Nameservers** bölümüne gir → "Custom DNS" seç → Cloudflare'in verdiği 2 adresi yapıştır. (Yayılması 10 dk - birkaç saat sürebilir; Cloudflare hazır olunca e-posta atar.)

### 3.2 DNS kayıtlarını ekle
Cloudflare → DNS bölümünde şu iki kaydı ekle:

| Tip | Ad (Name) | Değer | Proxy |
|-----|-----------|-------|-------|
| A | @ | 65.108.24.17 (senin sunucu IP'n) | ⛅ **DNS only (gri bulut)** |
| A | www | 65.108.24.17 | ⛅ **DNS only (gri bulut)** |

> ⚠️ **Şimdilik gri bulut (DNS only) olsun** — SSL sertifikasını sorunsuz alabilmek için. Bölüm 4'te sertifika alındıktan sonra turuncuya çevireceğiz.

Kontrol: PowerShell'de `nslookup smmjet.com` → senin sunucu IP'ni göstermeli.

---

## BÖLÜM 4 — Nginx + Ücretsiz SSL (~20 dk)

Sunucuda:

### 4.1 Nginx yapılandırması
```bash
nano /etc/nginx/sites-available/smmjet
```
İçine (alan adını değiştir):
```nginx
server {
    listen 80;
    server_name smmjet.com www.smmjet.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```
```bash
ln -s /etc/nginx/sites-available/smmjet /etc/nginx/sites-enabled/
nginx -t          # "ok" demeli
systemctl reload nginx
```

### 4.2 SSL sertifikası (Let's Encrypt — ücretsiz, otomatik yenilenir)
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d smmjet.com -d www.smmjet.com
```
E-postanı sor, kabul et, **"redirect" seçeneğini seç** (HTTP'yi HTTPS'e çevirir). `https://smmjet.com` artık kilitli simgeyle açılıyor olmalı.

### 4.3 Cloudflare korumasını aktive et (SSL alındıktan SONRA)
1. Cloudflare → DNS → iki A kaydının bulutunu **🟠 Proxied (turuncu)** yap. Artık sunucu IP'n dışarıdan görünmez, trafik Cloudflare kalkanından geçer.
2. Cloudflare → **SSL/TLS** → şifreleme modunu **Full (strict)** yap. (Bu adımı atlarsan site "yönlendirme döngüsü" hatası verebilir!)
3. Cloudflare → SSL/TLS → Edge Certificates → **"Always Use HTTPS"** aç.
4. Cloudflare → Security → Bots → **"Bot Fight Mode"** aç (sahte kayıt botlarını süzer).
5. Nginx yapılandırmasında gerçek ziyaretçi IP'sinin görünmesi için `location /` bloğundaki X-Forwarded-For satırını şöyle değiştir (hız limitlerinin doğru çalışması için önemli):
```nginx
        proxy_set_header X-Forwarded-For $http_cf_connecting_ip;
```
Sonra: `nginx -t && systemctl reload nginx`

> 💡 **Saldırı anında:** Cloudflare ana sayfasındaki **"Under Attack Mode"** düğmesini aç — tüm ziyaretçilere 5 saniyelik doğrulama ekranı gösterir, saldırı bitince kapat. 🎉

---

## BÖLÜM 5 — Otomatik Yedekleme (KRİTİK — atlamak yok!) (~10 dk)

Tüm paran ve müşterin tek SQLite dosyasında. Günlük yedek al:

```bash
mkdir -p /root/yedekler
crontab -e     # ilk sefer editör sorar: 1 (nano) seç
```
En alta şu satırı ekle (her gece 04:00'te yedek, 14 günden eskisini sil):
```
0 4 * * * cp /var/www/smmjet/database.sqlite /root/yedekler/db-$(date +\%Y\%m\%d).sqlite && find /root/yedekler -name "db-*.sqlite" -mtime +14 -delete
```
> 💡 Ekstra güvenlik: haftada bir `/root/yedekler`'den bir dosyayı kendi bilgisayarına indir:
> `scp root@SUNUCU_IP:/root/yedekler/db-20260813.sqlite C:\Yedekler\`

---

## BÖLÜM 6 — Site İçi Ayarlar (admin panelden, ~20 dk)

Siteye `https://smmjet.com` üzerinden gir, admin ile giriş yap:

1. **İlk iş:** Admin şifreni değiştir (güçlü, benzersiz) + **2FA'yı aç**.
2. **Site Ayarları → E-Posta (SMTP):** Gmail uygulama şifresi al, doldur, kaydet, **"Test E-postası Gönder"** ile doğrula.
3. **Site Ayarları → Telegram:** Bot zaten bağlı; test mesajı at, çalıştığını gör.
4. **Site Ayarları → Ödeme:** NOWPayments anahtarları zaten girili. NOWPayments paneline gir → IP kısıtlaması eklemek istersen artık sunucu IP'n sabit.
5. **Site Ayarları → Genel → SEO & Analitik:**
   - Google Analytics'te mülk aç → `G-XXXX` kimliğini yapıştır → kaydet.
   - Search Console'da mülk aç → HTML etiketi doğrulamasını yapıştır → kaydet → Search Console'da "Doğrula".
   - Search Console → Site Haritaları → `https://smmjet.com/sitemap.xml` ekle.
6. **Havale hesapları:** Ödeme bölümünde gerçek İBAN'larını gir.
7. **Sağlayıcı:** Gerçek SMM sağlayıcını ekle, servisleri kâr marjıyla içe aktar.

---

## BÖLÜM 7 — Canlı Testler (~30 dk)

Sırayla dene, hepsi geçmeli:

- [ ] Yeni kullanıcı kaydı → Telegram'a "yeni kayıt" düştü mü?
- [ ] Şifre sıfırlama → e-posta geldi mi?
- [ ] **Kripto:** kendi cebinden minimum tutarda USDT yatır → QR ekranı → onay sonrası bakiye otomatik yüklendi mi? Telegram bildirimi geldi mi? *(İlk gerçek uçtan uca test — en önemlisi bu!)*
- [ ] Banka bildirimi gönder → Telegram'a düştü mü → panelden onayla → bakiye geçti mi?
- [ ] Küçük gerçek bir sipariş ver → sağlayıcıya gitti mi, durum güncelleniyor mu?
- [ ] Telefondan siteyi gez (mobil görünüm).
- [ ] `https://smmjet.com/sitemap.xml`, `/robots.txt`, `/llms.txt` açılıyor mu?
- [ ] Bir blog yazısının `/blog/yazi-adi` adresi düzgün açılıyor mu?

---

## BÖLÜM 8 — Son Rötuşlar

1. **UptimeRobot** (uptimerobot.com, ücretsiz): monitor ekle → `https://smmjet.com` → 5 dk aralık → e-posta uyarısı. Site düşerse anında haber alırsın.
2. **PayTR gerçek hesap:** Başvuruda site linkin, Kullanım Şartları / Gizlilik / İade sayfaların hazır (footer'da). Onay gelince `.env`'e merchant bilgilerini yaz, `PAYTR_TEST_MODE=0` yap, `pm2 restart smmjet`.
3. **Güncelleme akışın:** Bilgisayarda değişiklik yap → GitHub'a pushla → sunucuda:
   ```bash
   cd /var/www/smmjet && git pull && npm install --omit=dev && pm2 restart smmjet
   ```

---

## Sorun Çıkarsa

| Belirti | İlk bakılacak yer |
|---------|-------------------|
| Site açılmıyor | `pm2 status`, `pm2 logs smmjet` |
| "502 Bad Gateway" | Node çökmüş: `pm2 restart smmjet`, sonra loglara bak |
| Ödeme onayı gelmiyor | `.env`'de `PUBLIC_BASE_URL` doğru mu? NOWPayments IPN geçmişine bak |
| E-posta gitmiyor | Admin panel → E-Posta → Test düğmesi; Gmail uygulama şifresi 16 hane mi? |
| SSL uyarısı | `certbot renew --dry-run` çalıştır |
| "Yönlendirme döngüsü" (too many redirects) | Cloudflare → SSL/TLS modu **Full (strict)** olmalı ("Flexible" döngü yapar) |
| Rate limit herkesi engelliyor | Nginx'te `X-Forwarded-For $http_cf_connecting_ip` satırı ekli mi? (Bölüm 4.3) |

*Hazırlayan: Claude — 13 Ağustos 2026. Sorularında panelin geliştirme sohbetine dönebilirsin kanka.* 🚀
