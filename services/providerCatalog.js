const SmmProviderClient = require('./smmProvider');
const { normalizePlainText } = require('../utils/security');
const catalogCache = new Map();

function normalizeProviderServices(raw) {
  const list = Array.isArray(raw) ? raw
    : Array.isArray(raw?.services) ? raw.services
      : Array.isArray(raw?.data) ? raw.data : [];
  return list.map(item => ({
    provider_service_id: String(item?.service ?? item?.id ?? item?.service_id ?? '').trim(),
    name: normalizePlainText(item?.name || '', 220),
    category: normalizePlainText(item?.category || 'Genel', 120),
    description: normalizePlainText(item?.description || '', 1000),
    cost_rate: Number(item?.rate ?? item?.price ?? item?.cost),
    min_quantity: Math.max(1, parseInt(item?.min || 100)),
    max_quantity: Math.max(1, parseInt(item?.max || 10000)),
    refill: item?.refill === true || item?.refill === 1 || item?.refill === '1' || item?.refill === 'true'
  })).filter(item => item.provider_service_id && item.name && Number.isFinite(item.cost_rate) && item.cost_rate >= 0);
}

async function fetchProviderCatalog(provider, options = {}) {
  const cacheKey = `${provider.id || provider.api_url}:${provider.api_url}:${provider.api_key}`;
  const cached = catalogCache.get(cacheKey);
  if (!options.force && cached && cached.expiresAt > Date.now()) return cached.value;
  const client = new SmmProviderClient(provider.api_url, provider.api_key);
  const [rawServices, balance] = await Promise.all([client.getServices(), client.getBalance()]);
  const value = {
    services: normalizeProviderServices(rawServices),
    currency: normalizePlainText(balance?.currency || 'USD', 10).toUpperCase() || 'USD'
  };
  catalogCache.set(cacheKey, { value, expiresAt: Date.now() + 5 * 60 * 1000 });
  return value;
}

function foldSearchText(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').toLowerCase();
}

function requestedPlatform(query) {
  const value = foldSearchText(query);
  return ['instagram', 'tiktok', 'youtube', 'telegram', 'facebook', 'twitter', 'x ', 'spotify', 'twitch']
    .find(platform => value.includes(platform)) || '';
}

function filterCatalogForQuery(services, query, limit = 200) {
  const platform = requestedPlatform(query);
  const filtered = platform
    ? services.filter(item => foldSearchText(`${item.name} ${item.category}`).includes(platform.trim()))
    : services;
  const selected = [];
  const perCategory = new Map();
  for (const item of filtered) {
    const categoryKey = foldSearchText(item.category);
    const count = perCategory.get(categoryKey) || 0;
    if (count >= 10) continue;
    selected.push(item);
    perCategory.set(categoryKey, count + 1);
    if (selected.length >= limit) return selected;
  }
  if (selected.length < limit) {
    const selectedIds = new Set(selected.map(item => item.provider_service_id));
    for (const item of filtered) {
      if (selectedIds.has(item.provider_service_id)) continue;
      selected.push(item);
      if (selected.length >= limit) break;
    }
  }
  return selected;
}

module.exports = { normalizeProviderServices, fetchProviderCatalog, filterCatalogForQuery };
