'use strict';

// Bayi sitesinin yasal sayfalari. Bayi bir sayfayi duzenlemediyse metin her
// istekte sablondan, bayinin guncel bilgileriyle (unvan, adres, e-posta,
// telefon, alan adi) uretilir; duzenlediyse tenant_pages'teki metni gecerlidir.
// Bicim duz metindir: "## " baslik, "- " madde, bos satir paragraf.
// Metinler yol gostericidir; hukuki danismanlik yerine gecmez (panelde yazar).
const { dbAsync } = require('../config/database');
const { tenantSettings } = require('./resolve');

const PAGES = [
  {
    slug: 'gizlilik',
    title: 'Gizlilik Politikası',
    body: `{{SITE}} ({{ALAN_ADI}}) olarak ziyaretçilerimizin ve müşterilerimizin gizliliğine önem veriyoruz. Bu politika, sitemizi kullanırken hangi bilgilerin toplandığını ve nasıl kullanıldığını açıklar.

## Toplanan bilgiler
- Hesap bilgileri: kullanıcı adı ve e-posta adresi.
- İşlem bilgileri: siparişler, sipariş bağlantıları, bakiye yüklemeleri ve bakiye hareketleri.
- Teknik bilgiler: IP adresi, giriş zamanları ve güvenlik kayıtları.

Şifreniz geri döndürülemez biçimde (özetlenerek) saklanır; çalışanlarımız dahil kimse göremez. Sosyal medya hesaplarınızın şifresini hiçbir zaman istemeyiz.

## Bilgilerin kullanımı
Bilgileriniz yalnızca siparişlerinizi yerine getirmek, ödemelerinizi bakiyenize işlemek, hesabınızın güvenliğini sağlamak ve size destek vermek için kullanılır. Bilgileriniz reklam amacıyla üçüncü kişilere satılmaz.

## Ödemeler
Kart ve kripto ödemeleri, anlaşmalı ödeme kuruluşlarının güvenli sayfalarında yapılır. Kart bilgileriniz sitemizde saklanmaz.

## Çerezler
Sitemiz yalnızca oturumunuzu açık tutmak için zorunlu çerez kullanır.

## İletişim
Gizlilikle ilgili sorularınız için: {{EPOSTA}}

Son güncelleme: {{TARIH}}`
  },
  {
    slug: 'mesafeli-satis',
    title: 'Mesafeli Satış Sözleşmesi',
    body: `## 1. Taraflar
Satıcı: {{UNVAN}}
Adres: {{ADRES}}
E-posta: {{EPOSTA}}
Telefon: {{TELEFON}}
Web sitesi: {{ALAN_ADI}}

Alıcı: {{SITE}} üzerinde hesap oluşturan ve sipariş veren kişi.

## 2. Konu
Bu sözleşme, alıcının {{ALAN_ADI}} üzerinden elektronik ortamda sipariş verdiği dijital hizmetlerin (sosyal medya hizmetleri ve dijital ürünler) satışına ilişkin tarafların hak ve yükümlülüklerini düzenler.

## 3. Hizmetin niteliği ve ödeme
- Hizmetlerin adı, birim fiyatı, alt ve üst miktarı sipariş ekranında gösterilir.
- Ödeme, alıcının site bakiyesinden yapılır. Bakiye; havale/EFT, kart veya kripto para ile yüklenir.
- Fiyatlara ilişkin güncel bilgi sipariş anında ekranda gösterilen bilgidir.

## 4. İfa
Sipariş, ödeme alındıktan sonra elektronik ortamda başlatılır. Başlama ve tamamlanma süreleri servis açıklamasında belirtilir; sosyal medya platformlarının işleyişine bağlı gecikmeler olabilir.

## 5. Cayma hakkı
Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesi uyarınca, elektronik ortamda anında ifa edilen hizmetlerde ve alıcıya anında teslim edilen gayrimaddi mallarda cayma hakkı kullanılamaz. Alıcı, sipariş vererek hizmetin hemen başlatılmasını kabul eder.

## 6. İade
Başlatılamayan, iptal edilen veya kısmen tamamlanan siparişlerde, teslim edilmeyen kısmın bedeli alıcının site bakiyesine iade edilir. Ayrıntılar İade Politikası sayfasındadır.

## 7. Alıcının yükümlülükleri
- Sipariş bağlantısını doğru girmek ve sipariş sürerken hesabını gizliye almamak.
- Hizmetleri yürürlükteki mevzuata ve ilgili platformların kurallarına aykırı amaçlarla kullanmamak.

## 8. Uyuşmazlık
Uyuşmazlıklarda Ticaret Bakanlığınca ilan edilen parasal sınırlar içinde Tüketici Hakem Heyetleri, aşan durumlarda Tüketici Mahkemeleri yetkilidir.

Alıcı, siparişini onaylamadan önce bu sözleşmeyi okuduğunu ve kabul ettiğini beyan eder.

Son güncelleme: {{TARIH}}`
  },
  {
    slug: 'iade',
    title: 'İade Politikası',
    body: `{{SITE}} üzerinde verilen siparişlerde iadeler aşağıdaki kurallara göre yapılır.

## Bakiyeye otomatik iade
- Başlatılamayan veya iptal edilen siparişin tutarının tamamı site bakiyenize iade edilir.
- Kısmen tamamlanan siparişte teslim edilmeyen miktarın bedeli bakiyenize iade edilir.
- Teslim edilemeyen dijital ürünlerin bedeli bakiyenize iade edilir.

## İade edilmeyen durumlar
- Tamamlanmış siparişler.
- Yanlış girilen bağlantı, sipariş sırasında gizliye alınan veya silinen hesaplar.
- Aynı bağlantıya aynı anda birden fazla sipariş verilmesinden doğan sayım farkları.

## Telafi (garanti)
"Garantili" olarak işaretlenen servislerde, garanti süresi içinde düşüş olursa Siparişlerim sayfasından telafi isteyebilirsiniz.

## Bakiyenin nakde çevrilmesi
Yüklenen bakiye site içinde kullanılmak içindir. Kullanılmamış bakiyenin iadesi için {{EPOSTA}} adresine yazabilirsiniz; talepler ödeme yönteminin kurallarına göre değerlendirilir.

Son güncelleme: {{TARIH}}`
  },
  {
    slug: 'kvkk',
    title: 'KVKK Aydınlatma Metni',
    body: `6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca, veri sorumlusu sıfatıyla {{UNVAN}} ("{{SITE}}") olarak kişisel verilerinizi aşağıda açıklanan şekilde işliyoruz.

## İşlenen kişisel veriler
- Kimlik ve iletişim: kullanıcı adı, e-posta adresi.
- Müşteri işlem: sipariş, ödeme ve bakiye kayıtları.
- İşlem güvenliği: IP adresi, giriş kayıtları.

## İşleme amaçları
Üyelik ve hizmet sözleşmesinin kurulması ve ifası, ödemelerin alınması, hesap ve işlem güvenliğinin sağlanması, yasal yükümlülüklerin yerine getirilmesi ve taleplerinizin yanıtlanması.

## Hukuki sebep
KVKK madde 5/2 kapsamında sözleşmenin kurulması ve ifası, hukuki yükümlülüğün yerine getirilmesi ve meşru menfaat.

## Aktarım
Verileriniz, yalnızca hizmetin sunulması için gerekli olduğu ölçüde ödeme kuruluşlarına, barındırma ve altyapı hizmeti aldığımız iş ortaklarına ve kanunen yetkili kurumlara aktarılabilir.

## Haklarınız
KVKK madde 11 uyarınca verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltme, silme ve itiraz etme haklarına sahipsiniz. Başvurularınızı {{EPOSTA}} adresine iletebilirsiniz.

Veri sorumlusu: {{UNVAN}} · {{ADRES}}

Son güncelleme: {{TARIH}}`
  }
];

const PAGE_MAP = new Map(PAGES.map(p => [p.slug, p]));
const MISSING = 'Belirtilmedi';

// "Son guncelleme": bayinin bilgileri en son ne zaman degistiyse o gun
// (her ziyarette bugunun tarihi yazmasin).
function stampDate(value) {
  const text = String(value || '');
  const date = /^\d{4}-\d{2}-\d{2}/.test(text) ? new Date(text.replace(' ', 'T') + (text.length > 10 && !/Z$/.test(text) ? 'Z' : '')) : new Date();
  return (Number.isNaN(date.getTime()) ? new Date() : date)
    .toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' });
}

function fillTemplate(text, tenant, host) {
  const s = tenantSettings(tenant);
  const today = stampDate(tenant.updated_at || tenant.created_at);
  const values = {
    SITE: tenant.name,
    ALAN_ADI: host || tenant.slug,
    UNVAN: s.legal_name || tenant.name,
    ADRES: s.legal_address || MISSING,
    EPOSTA: s.support_email || MISSING,
    TELEFON: s.phone || MISSING,
    TARIH: today
  };
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (match, key) => (key in values ? values[key] : match));
}

async function listPages(tenant, host) {
  const rows = await dbAsync.all('SELECT slug, title, body, updated_at FROM tenant_pages WHERE tenant_id = ?', [tenant.id]);
  return PAGES.map(page => {
    const row = rows.find(r => r.slug === page.slug);
    return row
      ? { slug: page.slug, title: row.title, body: row.body, customized: true, updated_at: row.updated_at }
      : { slug: page.slug, title: page.title, body: fillTemplate(page.body, tenant, host), customized: false, updated_at: null };
  });
}

async function getPage(tenant, slug, host) {
  if (!PAGE_MAP.has(slug)) return null;
  return (await listPages(tenant, host)).find(p => p.slug === slug);
}

module.exports = { PAGES, PAGE_MAP, fillTemplate, listPages, getPage };
