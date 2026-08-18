const express = require('express');
const router = express.Router();
const { dbAsync, withTransaction } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { AiClient } = require('../services/aiClient');
const { encryptSecret, decryptSecret, normalizePlainText, sanitizeRichText } = require('../utils/security');
const { assertPublicProviderUrl } = require('../utils/network');
const { toKurus } = require('../utils/money');
const { fetchProviderCatalog, filterCatalogForQuery } = require('../services/providerCatalog');
const { chooseBlogCover } = require('../services/blogCover');
const { buildMetaDescription } = require('../utils/metaDescription');

router.use(authenticateToken, requireAdmin);

const PROVIDER_TYPES = new Set(['openai_compatible', 'anthropic', 'gemini']);
const ACTION_TYPES = new Set(['create_blog_draft', 'publish_blog', 'create_service', 'update_service', 'set_service_status', 'import_provider_services']);
const DEFAULT_URLS = {
  openai_compatible: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta'
};

function providerView(row) {
  return {
    id: row.id,
    name: row.name,
    provider_type: row.provider_type,
    api_base_url: row.api_base_url,
    model: row.model,
    enable_web_search: row.enable_web_search,
    status: row.status,
    is_default: row.is_default,
    has_api_key: Boolean(row.api_key_encrypted),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function friendlyAiProviderError(cause) {
  const providerStatus = Number(cause?.response?.status);
  const providerMessage = normalizePlainText(cause?.response?.data?.error?.message || '', 300);
  let message = 'AI sağlayıcısı isteği tamamlayamadı.';
  let status = 502;
  if (!cause?.response) {
    // Yanit hic gelmedi: zaman asimi veya ag hatasi.
    if (/timeout|econnaborted/i.test(cause?.message || '')) message = 'AI yanıtı zaman aşımına uğradı. Uzun içeriklerde model geç yanıt verebilir; lütfen tekrar deneyin veya isteği kısaltın.';
    else message = `AI sağlayıcısına ulaşılamadı (ağ hatası). Lütfen tekrar deneyin.`;
  }
  else if (providerStatus === 401 || providerStatus === 403) message = 'API anahtarı sağlayıcı tarafından reddedildi. AI Ayarları bölümünden anahtarı kontrol edin.';
  else if (providerStatus === 404) message = 'Seçili model sağlayıcıda bulunamadı. "Modeller" listesinden geçerli bir model seçin.';
  else if (providerStatus === 429) {
    message = 'AI sağlayıcısının kullanım limiti aşıldı veya bakiyesi yetersiz.';
    status = 429;
  } else if (providerStatus === 400 && providerMessage) message = `AI sağlayıcısı isteği reddetti: ${providerMessage}`;
  else if (providerStatus >= 500) message = 'AI sağlayıcısında geçici bir sunucu sorunu var. Birkaç dakika sonra tekrar deneyin.';
  else if (providerMessage) message = `AI sağlayıcısı: ${providerMessage}`;
  const error = new Error(message);
  error.status = status;
  error.cause = cause;
  return error;
}

function makeSlug(value) {
  const base = String(value || 'blog-yazisi').toLocaleLowerCase('tr-TR')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    .slice(0, 100) || 'blog-yazisi';
  return `${base}-${Date.now().toString(36)}`;
}

async function providerCatalogContext(query) {
  const providers = await dbAsync.all('SELECT id, name, api_url, api_key FROM providers WHERE status = 1 ORDER BY id');
  const needsCatalog = /sağlay|saglay|provider|servis|hizmet|katalog|fiyat|price|instagram|tiktok|youtube|telegram|facebook|spotify|twitch/i.test(String(query || ''));
  if (!needsCatalog) return providers.map(provider => ({
    provider_id: provider.id,
    provider_name: normalizePlainText(provider.name, 100),
    note: 'Bu istekte canlı katalog yüklenmedi.'
  }));
  return Promise.all(providers.map(async provider => {
    try {
      const catalog = await fetchProviderCatalog(provider);
      return {
        provider_id: provider.id,
        provider_name: normalizePlainText(provider.name, 100),
        currency: catalog.currency,
        services: filterCatalogForQuery(catalog.services, query).map(item => ({
          id: item.provider_service_id,
          name: item.name,
          category: item.category,
          cost_rate: item.cost_rate,
          min: item.min_quantity,
          max: item.max_quantity,
          refill: item.refill
        }))
      };
    } catch (error) {
      return { provider_id: provider.id, provider_name: normalizePlainText(provider.name, 100), error: 'Katalog bağlantısı kurulamadı.' };
    }
  }));
}

async function siteContext(query = '') {
  const [stats, services, posts, settingsRows, provider_catalogs] = await Promise.all([
    dbAsync.get(`SELECT
      (SELECT COUNT(*) FROM users WHERE role = 'client') AS users,
      (SELECT COUNT(*) FROM orders) AS orders,
      (SELECT COUNT(*) FROM services WHERE status = 1) AS active_services,
      (SELECT COUNT(*) FROM blog_posts WHERE status = 'published') AS published_posts`),
    dbAsync.all(`SELECT s.id, COALESCE(s.name_tr, s.name) name_tr, COALESCE(s.name_en, s.name) name_en,
      s.rate_per_1000, s.rate_per_1000_usd_cents, s.min_quantity, s.max_quantity, s.status,
      COALESCE(c.name_tr, c.name) category_tr, COALESCE(c.name_en, c.name) category_en
      FROM services s JOIN categories c ON c.id = s.category_id WHERE s.status = 1 ORDER BY s.id DESC LIMIT 80`),
    dbAsync.all(`SELECT id, slug, COALESCE(title_tr, title) title_tr, COALESCE(title_en, title) title_en, status
      FROM blog_posts WHERE status = 'published' ORDER BY id DESC LIMIT 30`),
    dbAsync.all(`SELECT key, value FROM site_settings WHERE key IN ('site_name', 'hero_title', 'hero_subtitle', 'currency', 'usd_try_rate')`),
    providerCatalogContext(query)
  ]);
  return {
    stats,
    services: services.map(service => ({ ...service, internal_url: `#services?service=${service.id}` })),
    posts: posts.map(post => ({ ...post, internal_url: `#blog/${post.slug}` })),
    settings: Object.fromEntries(settingsRows.map(row => [row.key, row.value])),
    provider_catalogs
  };
}

function systemPrompt(context, webSearchEnabled = false) {
  return `Sen bir SMM panelinin kıdemli içerik ve operasyon asistanısın. Admin ile Türkçe veya İngilizce konuş.
Sitenin güncel, salt okunur özeti aşağıdadır:\n${JSON.stringify(context)}

Yanıtın yalnızca geçerli JSON olsun:
{"message":"kullanıcıya doğal yanıt","actions":[{"type":"izinli işlem","payload":{}}]}
İzinli işlemler: create_blog_draft, publish_blog, create_service, update_service, set_service_status, import_provider_services.
Blog istendiğinde tam olarak bir create_blog_draft veya publish_blog işlemi üret. Payload içinde title_tr, title_en, category_tr, category_en, summary_tr, summary_en, content_tr, content_en, seo_title_tr, seo_title_en, seo_description_tr, seo_description_en ve reading_minutes alanlarının tamamı bulunmalı. summary_tr ve summary_en boş olamaz; her biri 180-320 karakterlik, merak uyandıran bağımsız kısa özet olmalı (sitedeki kartlarda görünür). seo_description_tr ve seo_description_en ise arama sonuçlarında görünen meta açıklamadır ve KESİNLİKLE 120-155 karakter arasında olmalıdır: 160 karakteri aşan açıklama arama motorunda kesilir, 25 karakterin altındaki yok sayılır. Bu iki alanı özetten kopyalama; tek cümlelik, anahtar kelimeyi içeren ve tıklamaya teşvik eden bağımsız metin yaz ve karakter sayısını kontrol et. Görsel URL üretme; konuya uygun kapak sunucu tarafından 50 farklı varyasyondan otomatik seçilir.
Blog content_tr ve content_en güvenli semantik HTML olmalı ve her dilde yaklaşık 700-1000 kelime içermeli. İçeriği giriş, en az 5 adet <h2> bölüm, gerektiğinde <h3>, madde listeleri, numaralı uygulama adımları, ipucu/uyarı kutuları için <blockquote>, karşılaştırma tablosu, ölçülebilir öneriler, sık sorulan sorular ve güçlü sonuç/CTA ile zenginleştir. Aynı metni iki dil alanına kopyalama; doğal ve yerelleştirilmiş TR/EN sürümler yaz. Uydurma kesin istatistik veya kaynak üretme.
Her blog dilinde doğal bağlam içinde 2-4 ilgili eski blog bağlantısı ve 2-3 ilgili hizmet bağlantısı kullan. Yalnızca context içindeki posts.internal_url ve services.internal_url değerlerini href olarak kullan; slug veya servis ID uydurma. Türkçe ve İngilizce bağlantı metinlerini ilgili dile göre yaz. İlgili kayıt yoksa genel blog için href="#blog", hizmetler için href="#services" kullan. Bağlantıları <a href="...">doğal bağlantı metni</a> biçiminde ekle; aynı bağlantıyı gereksiz tekrarlama.
GEO / AI ARAMA KURALLARI (her blogda zorunlu — içerik ChatGPT, Perplexity ve Google AI Overviews tarafından alıntılanabilir olmalı):
1) H2 başlıkların en az yarısı okuyucunun gerçekten sorduğu soru formatında olsun ("TikTok algoritması nasıl çalışır?" gibi) ve her soru başlığının hemen altındaki İLK paragraf, başka bağlam gerektirmeden tek başına anlamlı 40-60 kelimelik doğrudan bir yanıt versin; ayrıntı sonraki paragraflara gelsin.
2) Sayısal iddia (yüzde, süre, eşik) verirken iki seçeneğin var: bağlamda platformların RESMİ yardım/creator sayfalarına atıf yap (yalnızca gerçekten var olduğundan emin olduğun kök adresler: help.instagram.com, creators.instagram.com, support.google.com/youtube, seo.tiktok.com yerine newsroom.tiktok.com, support.spotify.com) YA DA rakamın gözlemsel/yaklaşık olduğunu cümle içinde açıkça söyle. Kesin URL'den emin değilsen href verme, kaynağın adını metin olarak an. Kaynak veya istatistik UYDURMA.
3) Her yazıya Türkiye pazarına özgü en az bir somut gözlem, örnek senaryo veya karşılaştırma ekle; "günümüzde", "sonuç olarak", "X şans değil, ölçülebilir bir sürecin sonucudur" gibi kalıp AI cümlelerinden kaçın. Bir bölümde işlerin ters gidebildiği durumu da anlat (yanlış kullanım, beklenti hatası) — tek yönlü övgü metni yazma.
4) Takipçi/beğeni/izlenme SATIN ALMAYI anlatan yazılara kısa ve dürüst bir <blockquote> risk uyarısı ekle: bu hizmetlerin platform kurallarına aykırı sayılabileceğini, ani ve aşırı yükselişlerin hesap kısıtlama riski taşıdığını, kademeli teslimatın ve organik stratejiyle desteklemenin önerildiğini belirt.
5) SSS bölümündeki her soru gerçek bir arama sorgusu gibi yazılsın ve cevabı 40-60 kelimede kendi başına yeterli olsun.
6) seo_description alanları tam bir cümleyle bitsin; cümle ortasında kesilen açıklama yazma.
7) Markadan söz ederken "Jet SMM Panel" adını kullan (kısaltması SMMJET); "SMMJET" adını tek başına yalnızca ikinci ve sonraki geçişlerde kullan.
Hizmet işleminde name_tr, name_en, description_tr, description_en, rate_try ve rate_usd alanlarını kullan.
provider_catalogs kayıtlı SMM sağlayıcılarından canlı çekilmiş gerçek katalog verisidir. Sağlayıcı servisi ekleme isteğinde bu kataloğu kullan; katalog yoksa veya bağlantı hatalıysa bunu açıkça söyle. Servis ID'si ya da maliyet uydurma.
Toplu sağlayıcı aktarımı için tam olarak bir import_provider_services işlemi üret. Payload yalnızca şu kompakt biçimde olsun: {"provider_id":1,"profit_percentage":70,"services":[{"provider_service_id":"123","name_tr":"...","name_en":"..."}]}. description, category, fiyat, min/max veya başka alan ekleme; bunları sunucu canlı katalogdan güvenli biçimde tamamlar. En fazla 50 servis seç. İsimleri sağlayıcı adındaki ülke, hız, kalite, garanti, süre ve servis türü bilgilerini kaybetmeden doğal TR/EN biçiminde düzenle. Mesaj alanını 300 karakterden kısa tut ve tüm JSON çıktısını mümkün olduğunca kompakt yaz. Kâr yüzdesi maliyetin üzerine eklenir; kur ve kesin satış fiyatları işlem onaylandığı anda sunucuda hesaplanır.
Fiyat araştırması sorularında ${webSearchEnabled ? 'web_search aracını kullanabilir ve kaynak URLlerini mesajında belirtebilirsin' : 'yalnızca sağlanan katalog verisini gerçek veri olarak kabul et; internette arama yaptığını iddia etme'}.
Her işlem yalnızca öneridir ve admin onayı olmadan uygulanmaz. Silme işlemi önerme; pasife alma kullan.
Eksik veya belirsiz kritik alan varsa işlem üretmeden soru sor.`;
}

router.get('/providers', async (req, res, next) => {
  try {
    const rows = await dbAsync.all('SELECT * FROM ai_providers ORDER BY is_default DESC, id DESC');
    res.json({ providers: rows.map(providerView) });
  } catch (err) { next(err); }
});

router.post('/providers', async (req, res, next) => {
  try {
    const { name, provider_type, api_base_url, api_key, model, is_default, enable_web_search } = req.body;
    if (!name || !PROVIDER_TYPES.has(provider_type) || !api_key) return res.status(400).json({ error: 'Sağlayıcı adı, türü ve API anahtarı zorunludur.' });
    const safeUrl = await assertPublicProviderUrl(api_base_url || DEFAULT_URLS[provider_type]);
    const selectedModel = normalizePlainText(model || 'not-selected', 120);
    const makeDefault = Boolean(is_default && selectedModel !== 'not-selected');
    if (makeDefault) await dbAsync.run('UPDATE ai_providers SET is_default = 0');
    const result = await dbAsync.run(
      `INSERT INTO ai_providers (name, provider_type, api_base_url, api_key_encrypted, model, enable_web_search, status, is_default)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      [normalizePlainText(name, 100), provider_type, safeUrl.replace(/\/$/, ''), encryptSecret(api_key), selectedModel, enable_web_search ? 1 : 0, makeDefault ? 1 : 0]
    );
    res.status(201).json({ message: 'AI sağlayıcısı güvenli şekilde kaydedildi.', id: result.id });
  } catch (err) { next(err); }
});

router.put('/providers/:id', async (req, res, next) => {
  try {
    const existing = await dbAsync.get('SELECT * FROM ai_providers WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'AI sağlayıcısı bulunamadı.' });
    const type = req.body.provider_type || existing.provider_type;
    if (!PROVIDER_TYPES.has(type)) return res.status(400).json({ error: 'Geçersiz sağlayıcı türü.' });
    const safeUrl = await assertPublicProviderUrl(req.body.api_base_url || existing.api_base_url);
    if (req.body.is_default) await dbAsync.run('UPDATE ai_providers SET is_default = 0');
    await dbAsync.run(`UPDATE ai_providers SET name = ?, provider_type = ?, api_base_url = ?,
      api_key_encrypted = ?, model = ?, enable_web_search = ?, status = ?, is_default = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
      normalizePlainText(req.body.name || existing.name, 100), type, safeUrl.replace(/\/$/, ''),
      req.body.api_key ? encryptSecret(req.body.api_key) : existing.api_key_encrypted,
      normalizePlainText(req.body.model || existing.model, 120), req.body.enable_web_search === undefined ? existing.enable_web_search : Number(Boolean(req.body.enable_web_search)),
      req.body.status === undefined ? existing.status : Number(Boolean(req.body.status)),
      req.body.is_default === undefined ? existing.is_default : Number(Boolean(req.body.is_default)), req.params.id
    ]);
    res.json({ message: 'AI sağlayıcısı güncellendi.' });
  } catch (err) { next(err); }
});

router.delete('/providers/:id', async (req, res, next) => {
  try {
    await dbAsync.run('DELETE FROM ai_providers WHERE id = ?', [req.params.id]);
    res.json({ message: 'AI sağlayıcısı silindi.' });
  } catch (err) { next(err); }
});

async function getProviderModels(provider) {
  const client = new AiClient(provider, decryptSecret(provider.api_key_encrypted));
  let models;
  try {
    models = await client.listModels();
  } catch (cause) {
    const providerStatus = Number(cause?.response?.status);
    const error = new Error(providerStatus === 401 || providerStatus === 403
      ? 'API anahtarı sağlayıcı tarafından reddedildi.'
      : 'AI sağlayıcısına bağlanılamadı. API adresini ve anahtarını kontrol edin.');
    error.status = 502;
    error.cause = cause;
    throw error;
  }
  if (!models.length) {
    const error = new Error('API bağlantısı kuruldu fakat kullanılabilir model bulunamadı.');
    error.status = 502;
    throw error;
  }
  return models;
}

router.get('/providers/:id/models', async (req, res, next) => {
  try {
    const provider = await dbAsync.get('SELECT * FROM ai_providers WHERE id = ?', [req.params.id]);
    if (!provider) return res.status(404).json({ error: 'AI sağlayıcısı bulunamadı.' });
    const models = await getProviderModels(provider);
    res.json({ message: 'Bağlantı başarılı.', models, active_model: provider.model });
  } catch (err) { next(err); }
});

router.post('/providers/:id/activate-model', async (req, res, next) => {
  try {
    const provider = await dbAsync.get('SELECT * FROM ai_providers WHERE id = ?', [req.params.id]);
    if (!provider) return res.status(404).json({ error: 'AI sağlayıcısı bulunamadı.' });
    const model = normalizePlainText(req.body.model, 120);
    if (!model) return res.status(400).json({ error: 'Bir model seçmelisiniz.' });
    const models = await getProviderModels(provider);
    if (!models.includes(model)) return res.status(400).json({ error: 'Seçilen model bu API bağlantısında bulunamadı.' });
    await withTransaction(async tx => {
      await tx.run('UPDATE ai_providers SET is_default = 0');
      await tx.run(`UPDATE ai_providers SET model = ?, status = 1, is_default = 1,
        updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [model, provider.id]);
    });
    res.json({ message: `${model} aktif model olarak ayarlandı.`, model, provider_id: provider.id });
  } catch (err) { next(err); }
});

router.post('/providers/:id/test', async (req, res, next) => {
  try {
    const provider = await dbAsync.get('SELECT * FROM ai_providers WHERE id = ?', [req.params.id]);
    if (!provider) return res.status(404).json({ error: 'AI sağlayıcısı bulunamadı.' });
    const models = await getProviderModels(provider);
    res.json({ message: `${models.length} kullanılabilir model bulundu.`, models, active_model: provider.model });
  } catch (err) { next(err); }
});

router.get('/conversations', async (req, res, next) => {
  try {
    const conversations = await dbAsync.all(`SELECT c.*, p.name provider_name FROM ai_conversations c
      LEFT JOIN ai_providers p ON p.id = c.provider_id WHERE c.admin_user_id = ? ORDER BY c.updated_at DESC LIMIT 50`, [req.user.id]);
    res.json({ conversations });
  } catch (err) { next(err); }
});

router.get('/conversations/:id', async (req, res, next) => {
  try {
    const conversation = await dbAsync.get('SELECT * FROM ai_conversations WHERE id = ? AND admin_user_id = ?', [req.params.id, req.user.id]);
    if (!conversation) return res.status(404).json({ error: 'Sohbet bulunamadı.' });
    const messages = await dbAsync.all('SELECT id, role, content, created_at FROM ai_messages WHERE conversation_id = ? ORDER BY id', [conversation.id]);
    const actions = await dbAsync.all('SELECT * FROM ai_action_logs WHERE conversation_id = ? ORDER BY id DESC', [conversation.id]);
    res.json({ conversation, messages, actions: actions.map(a => ({ ...a, payload: JSON.parse(a.payload_json) })) });
  } catch (err) { next(err); }
});

router.post('/chat', async (req, res, next) => {
  try {
    const message = normalizePlainText(req.body.message, 8000);
    if (!message) return res.status(400).json({ error: 'Mesaj boş olamaz.' });
    const provider = req.body.provider_id
      ? await dbAsync.get("SELECT * FROM ai_providers WHERE id = ? AND status = 1 AND model <> 'not-selected'", [req.body.provider_id])
      : await dbAsync.get("SELECT * FROM ai_providers WHERE status = 1 AND model <> 'not-selected' ORDER BY is_default DESC, id DESC LIMIT 1");
    if (!provider) return res.status(400).json({ error: 'Önce aktif bir AI sağlayıcısı ekleyin.' });

    let conversation;
    if (req.body.conversation_id) conversation = await dbAsync.get('SELECT * FROM ai_conversations WHERE id = ? AND admin_user_id = ?', [req.body.conversation_id, req.user.id]);
    if (!conversation) {
      const created = await dbAsync.run('INSERT INTO ai_conversations (admin_user_id, provider_id, title) VALUES (?, ?, ?)', [req.user.id, provider.id, message.slice(0, 80)]);
      conversation = { id: created.id };
    }
    await dbAsync.run('INSERT INTO ai_messages (conversation_id, role, content) VALUES (?, ?, ?)', [conversation.id, 'user', message]);
    const history = await dbAsync.all(`SELECT role, content FROM ai_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 20`, [conversation.id]);
    history.reverse();
    const client = new AiClient(provider, decryptSecret(provider.api_key_encrypted));
    const canSearchWeb = Boolean(provider.enable_web_search) && provider.provider_type === 'openai_compatible' && new URL(provider.api_base_url).hostname === 'api.openai.com';
    const result = await client.complete(history, systemPrompt(await siteContext(message), canSearchWeb));
    await dbAsync.run('INSERT INTO ai_messages (conversation_id, role, content) VALUES (?, ?, ?)', [conversation.id, 'assistant', result.message]);

    const actionViews = [];
    for (const action of result.actions) {
      if (!ACTION_TYPES.has(action?.type) || !action.payload || typeof action.payload !== 'object') continue;
      const payloadJson = JSON.stringify(action.payload);
      if (payloadJson.length > 60000) continue;
      const saved = await dbAsync.run(`INSERT INTO ai_action_logs (conversation_id, admin_user_id, action_type, payload_json)
        VALUES (?, ?, ?, ?)`, [conversation.id, req.user.id, action.type, payloadJson]);
      actionViews.push({ id: saved.id, action_type: action.type, payload: action.payload, status: 'pending' });
    }
    await dbAsync.run('UPDATE ai_conversations SET provider_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [provider.id, conversation.id]);
    res.json({ conversation_id: conversation.id, message: result.message, actions: actionViews });
  } catch (err) { next(err?.isAxiosError || err?.response ? friendlyAiProviderError(err) : err); }
});

async function prepareProviderImport(action) {
  if (action.action_type !== 'import_provider_services') return null;
  const payload = JSON.parse(action.payload_json);
  const providerId = parseInt(payload.provider_id);
  const requested = Array.isArray(payload.services) ? payload.services.slice(0, 50) : [];
  const margin = Number(payload.profit_percentage);
  if (!Number.isInteger(providerId) || !requested.length) throw Object.assign(new Error('Sağlayıcı ve en az bir katalog servisi seçilmelidir.'), { status: 400 });
  if (!Number.isFinite(margin) || margin < 0 || margin > 1000) throw Object.assign(new Error('Kâr oranı 0 ile 1000 arasında olmalıdır.'), { status: 400 });

  const provider = await dbAsync.get('SELECT * FROM providers WHERE id = ? AND status = 1', [providerId]);
  if (!provider) throw Object.assign(new Error('Aktif SMM sağlayıcısı bulunamadı.'), { status: 404 });
  const catalog = await fetchProviderCatalog(provider);
  const catalogMap = new Map(catalog.services.map(item => [String(item.provider_service_id), item]));
  const seen = new Set();
  const items = requested.map(item => {
    const serviceId = String(item?.provider_service_id || '').trim();
    if (!serviceId || seen.has(serviceId)) throw Object.assign(new Error('Tekrarlanan veya geçersiz sağlayıcı servis ID’si var.'), { status: 400 });
    seen.add(serviceId);
    const source = catalogMap.get(serviceId);
    if (!source) throw Object.assign(new Error(`Sağlayıcı servisi #${serviceId} güncel katalogda bulunamadı.`), { status: 409 });
    const nameTr = normalizePlainText(item.name_tr, 220);
    const nameEn = normalizePlainText(item.name_en, 220);
    if (!nameTr || !nameEn) throw Object.assign(new Error(`Servis #${serviceId} için TR ve EN isim zorunludur.`), { status: 400 });
    const descriptionTr = normalizePlainText(item.description_tr || `${nameTr}. Minimum ${source.min_quantity}, maksimum ${source.max_quantity} adet sipariş verilebilir.`, 1000);
    const descriptionEn = normalizePlainText(item.description_en || `${nameEn}. Orders can be placed from ${source.min_quantity} to ${source.max_quantity}.`, 1000);
    return {
      source,
      nameTr,
      nameEn,
      descriptionTr,
      descriptionEn,
      categoryTr: normalizePlainText(item.category_tr || 'Instagram', 100),
      categoryEn: normalizePlainText(item.category_en || 'Instagram', 100)
    };
  });
  const setting = await dbAsync.get("SELECT value FROM site_settings WHERE key = 'usd_try_rate'");
  const usdTryRate = Number(setting?.value) > 0 ? Number(setting.value) : 35;
  return { provider, currency: catalog.currency, margin, multiplier: 1 + (margin / 100), usdTryRate, items };
}

async function executeAction(tx, action, prepared = null) {
  const payload = JSON.parse(action.payload_json);
  if (action.action_type === 'create_blog_draft' || action.action_type === 'publish_blog') {
    const titleTr = normalizePlainText(payload.title_tr, 180);
    const titleEn = normalizePlainText(payload.title_en, 180);
    if (!titleTr || !titleEn || !payload.content_tr || !payload.content_en) throw new Error('Çift dilli blog başlık ve içerikleri zorunludur.');
    const status = action.action_type === 'publish_blog' ? 'published' : 'draft';
    const summaryTr = normalizePlainText(payload.summary_tr || payload.content_tr, 320);
    const summaryEn = normalizePlainText(payload.summary_en || payload.content_en, 320);
    const categoryTr = normalizePlainText(payload.category_tr || 'Sosyal Medya', 80);
    const categoryEn = normalizePlainText(payload.category_en || 'Social Media', 80);
    const imageUrl = await chooseBlogCover(tx, `${titleTr} ${titleEn} ${categoryTr} ${categoryEn}`);
    const contentTr = sanitizeRichText(payload.content_tr);
    const contentEn = sanitizeRichText(payload.content_en);
    const calculatedReading = Math.max(3, Math.ceil(normalizePlainText(payload.content_tr, 30000).split(/\s+/).filter(Boolean).length / 220));
    const slug = makeSlug(titleTr);
    const result = await tx.run(`INSERT INTO blog_posts
      (title, slug, category, summary, content, image_url, title_tr, title_en, category_tr, category_en,
       summary_tr, summary_en, content_tr, content_en, seo_title_tr, seo_title_en, seo_description_tr,
       seo_description_en, status, author_id, reading_minutes, updated_at, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CASE WHEN ? = 'published' THEN CURRENT_TIMESTAMP ELSE NULL END)`, [
      titleTr, slug, categoryTr, summaryTr, contentTr, imageUrl,
      titleTr, titleEn, categoryTr, categoryEn,
      summaryTr, summaryEn, contentTr, contentEn,
      normalizePlainText(payload.seo_title_tr || titleTr, 180), normalizePlainText(payload.seo_title_en || titleEn, 180),
      // Meta aciklama 160 karakteri asamaz. Modele istemde soylense de her
      // zaman uymayabildigi icin burada kesin olarak sinira getirilir.
      buildMetaDescription([payload.seo_description_tr, summaryTr, contentTr], titleTr),
      buildMetaDescription([payload.seo_description_en, summaryEn, contentEn], titleEn),
      status, action.admin_user_id, Math.max(1, Math.min(60, parseInt(payload.reading_minutes || calculatedReading))), status
    ]);
    // Yeni yazi Bing'e (IndexNow) aninda bildirilir; ChatGPT web aramasi
    // Bing dizinine dayandigi icin AI gorunurlugunu hizlandirir.
    if (status === 'published') require('../services/indexNow').notifyBlogPublished(slug);
    return { blog_id: result.id, status };
  }
  if (action.action_type === 'create_service') {
    const nameTr = normalizePlainText(payload.name_tr, 220);
    const nameEn = normalizePlainText(payload.name_en, 220);
    if (!nameTr || !nameEn || !Number.isFinite(Number(payload.rate_try))) throw new Error('Hizmet adı ve TL fiyatı zorunludur.');
    const categoryName = normalizePlainText(payload.category_tr || 'Genel', 100);
    let category = await tx.get('SELECT id FROM categories WHERE name = ? OR name_tr = ? LIMIT 1', [categoryName, categoryName]);
    if (!category) {
      const created = await tx.run(`INSERT INTO categories (name, name_tr, name_en, icon) VALUES (?, ?, ?, 'fa-folder')`, [categoryName, categoryName, normalizePlainText(payload.category_en || categoryName, 100)]);
      category = { id: created.id };
    }
    const result = await tx.run(`INSERT INTO services
      (category_id, name, name_tr, name_en, description, description_tr, description_en, rate_per_1000,
       rate_per_1000_kurus, rate_per_1000_usd_cents, min_quantity, max_quantity, refill, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`, [category.id, nameTr, nameTr, nameEn,
      normalizePlainText(payload.description_tr || '', 1000), normalizePlainText(payload.description_tr || '', 1000), normalizePlainText(payload.description_en || '', 1000),
      Number(payload.rate_try), toKurus(payload.rate_try), Math.round(Number(payload.rate_usd || 0) * 100),
      Math.max(1, parseInt(payload.min_quantity || 100)), Math.max(1, parseInt(payload.max_quantity || 10000)), payload.refill ? 1 : 0]);
    return { service_id: result.id };
  }
  if (action.action_type === 'update_service') {
    const id = parseInt(payload.service_id);
    const existing = await tx.get('SELECT * FROM services WHERE id = ?', [id]);
    if (!existing) throw new Error('Hizmet bulunamadı.');
    await tx.run(`UPDATE services SET name = ?, name_tr = ?, name_en = ?, description = ?, description_tr = ?, description_en = ?,
      rate_per_1000 = ?, rate_per_1000_kurus = ?, rate_per_1000_usd_cents = ?, min_quantity = ?, max_quantity = ?, refill = ? WHERE id = ?`, [
      normalizePlainText(payload.name_tr || existing.name_tr || existing.name, 220), normalizePlainText(payload.name_tr || existing.name_tr || existing.name, 220),
      normalizePlainText(payload.name_en || existing.name_en || existing.name, 220), normalizePlainText(payload.description_tr ?? existing.description_tr ?? existing.description ?? '', 1000),
      normalizePlainText(payload.description_tr ?? existing.description_tr ?? existing.description ?? '', 1000), normalizePlainText(payload.description_en ?? existing.description_en ?? existing.description ?? '', 1000),
      Number(payload.rate_try ?? existing.rate_per_1000), toKurus(payload.rate_try ?? existing.rate_per_1000),
      Math.round(Number(payload.rate_usd ?? (existing.rate_per_1000_usd_cents / 100)) * 100), parseInt(payload.min_quantity ?? existing.min_quantity),
      parseInt(payload.max_quantity ?? existing.max_quantity), payload.refill === undefined ? existing.refill : Number(Boolean(payload.refill)), id]);
    return { service_id: id };
  }
  if (action.action_type === 'set_service_status') {
    const id = parseInt(payload.service_id);
    await tx.run('UPDATE services SET status = ? WHERE id = ?', [payload.status ? 1 : 0, id]);
    return { service_id: id, status: payload.status ? 1 : 0 };
  }
  if (action.action_type === 'import_provider_services') {
    if (!prepared) throw new Error('Sağlayıcı kataloğu hazırlanamadı.');
    let imported = 0;
    let skipped = 0;
    const serviceIds = [];
    for (const item of prepared.items) {
      const existing = await tx.get('SELECT id FROM services WHERE provider_id = ? AND provider_service_id = ?', [prepared.provider.id, item.source.provider_service_id]);
      if (existing) { skipped++; continue; }
      let category = await tx.get('SELECT id FROM categories WHERE name = ? OR name_tr = ? LIMIT 1', [item.categoryTr, item.categoryTr]);
      if (!category) {
        const created = await tx.run(`INSERT INTO categories (name, name_tr, name_en, icon) VALUES (?, ?, ?, 'fa-instagram')`, [item.categoryTr, item.categoryTr, item.categoryEn]);
        category = { id: created.id };
      }
      const sourceRate = Number(item.source.cost_rate);
      const sellTry = prepared.currency === 'TRY' ? sourceRate * prepared.multiplier : sourceRate * prepared.multiplier * prepared.usdTryRate;
      const sellUsd = prepared.currency === 'TRY' ? (sourceRate * prepared.multiplier) / prepared.usdTryRate : sourceRate * prepared.multiplier;
      const refill = item.source.refill || /telafi|garanti|refill|düşüşsüz|non-drop|30 gün|60 gün|90 gün|365 gün/i.test(`${item.source.name} ${item.source.category}`) ? 1 : 0;
      const result = await tx.run(`INSERT INTO services
        (category_id, provider_id, provider_service_id, name, name_tr, name_en, description, description_tr, description_en,
         rate_per_1000, rate_per_1000_kurus, rate_per_1000_usd_cents, provider_cost_rate, provider_cost_currency,
         provider_cost_updated_at, min_quantity, max_quantity, refill, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, 1)`, [
        category.id, prepared.provider.id, item.source.provider_service_id, item.nameTr, item.nameTr, item.nameEn,
        item.descriptionTr, item.descriptionTr, item.descriptionEn, Number(sellTry.toFixed(2)), toKurus(sellTry),
        Math.round(sellUsd * 100), item.source.cost_rate, prepared.currency, item.source.min_quantity, item.source.max_quantity, refill
      ]);
      imported++;
      serviceIds.push(result.id);
    }
    return { imported_count: imported, skipped_existing: skipped, profit_percentage: prepared.margin, service_ids: serviceIds };
  }
  throw new Error('Desteklenmeyen işlem.');
}

router.post('/actions/:id/execute', async (req, res, next) => {
  try {
    const action = await dbAsync.get(`SELECT * FROM ai_action_logs WHERE id = ? AND admin_user_id = ? AND status = 'pending'`, [req.params.id, req.user.id]);
    if (!action) return res.status(404).json({ error: 'Onay bekleyen işlem bulunamadı.' });
    const prepared = await prepareProviderImport(action);
    const result = await withTransaction(async tx => {
      const output = await executeAction(tx, action, prepared);
      await tx.run(`UPDATE ai_action_logs SET status = 'approved', result_json = ?, executed_at = CURRENT_TIMESTAMP WHERE id = ?`, [JSON.stringify(output), action.id]);
      await tx.run(`INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
        VALUES (?, 'ai_action_approved', 'ai_action', ?, ?, ?)`, [req.user.id, String(action.id), JSON.stringify({ action_type: action.action_type, output }), req.ip]);
      return output;
    });
    res.json({ message: 'AI işlemi onaylandı ve uygulandı.', result });
  } catch (err) { next(err); }
});

router.post('/actions/:id/reject', async (req, res, next) => {
  try {
    await dbAsync.run(`UPDATE ai_action_logs SET status = 'rejected', executed_at = CURRENT_TIMESTAMP
      WHERE id = ? AND admin_user_id = ? AND status = 'pending'`, [req.params.id, req.user.id]);
    res.json({ message: 'AI önerisi reddedildi.' });
  } catch (err) { next(err); }
});

module.exports = router;
