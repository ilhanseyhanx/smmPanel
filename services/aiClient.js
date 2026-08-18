const axios = require('axios');
const { assertPublicProviderUrl, safeRequestConfig } = require('../utils/network');

function joinUrl(base, path) {
  return `${String(base).replace(/\/+$/, '')}/${String(path).replace(/^\/+/, '')}`;
}

function extractJson(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  try { return JSON.parse(candidate); } catch {}
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(candidate.slice(start, end + 1)); } catch {}
  }
  return { message: raw || 'Model boş bir yanıt döndürdü.', actions: [] };
}

class AiClient {
  constructor(provider, apiKey) {
    this.provider = provider;
    this.apiKey = apiKey;
  }

  async listModels() {
    await assertPublicProviderUrl(this.provider.api_base_url);
    let models = [];

    if (this.provider.provider_type === 'anthropic') {
      const response = await axios.get(joinUrl(this.provider.api_base_url, 'models'), safeRequestConfig({
        timeout: 30000,
        maxContentLength: 2 * 1024 * 1024,
        params: { limit: 1000 },
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        }
      }));
      models = (response.data?.data || []).map(model => model?.id);
    } else if (this.provider.provider_type === 'gemini') {
      const response = await axios.get(joinUrl(this.provider.api_base_url, 'models'), safeRequestConfig({
        timeout: 30000,
        maxContentLength: 2 * 1024 * 1024,
        params: { pageSize: 1000 },
        headers: { 'x-goog-api-key': this.apiKey }
      }));
      models = (response.data?.models || [])
        .filter(model => !Array.isArray(model?.supportedGenerationMethods) || model.supportedGenerationMethods.includes('generateContent'))
        .map(model => String(model?.name || '').replace(/^models\//, ''));
    } else {
      const response = await axios.get(joinUrl(this.provider.api_base_url, 'models'), safeRequestConfig({
        timeout: 30000,
        maxContentLength: 2 * 1024 * 1024,
        headers: { Authorization: `Bearer ${this.apiKey}` }
      }));
      models = (response.data?.data || []).map(model => model?.id);
    }

    return [...new Set(models.map(model => String(model || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 1000);
  }

  async complete(messages, systemPrompt) {
    await assertPublicProviderUrl(this.provider.api_base_url);
    let text;
    if (this.provider.provider_type === 'anthropic') text = await this.completeAnthropic(messages, systemPrompt);
    else if (this.provider.provider_type === 'gemini') text = await this.completeGemini(messages, systemPrompt);
    else text = await this.completeOpenAiCompatible(messages, systemPrompt);
    const parsed = extractJson(text);
    return {
      message: String(parsed.message || text || '').slice(0, 30000),
      actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, 10) : []
    };
  }

  async completeOpenAiCompatible(messages, systemPrompt) {
    const hostname = new URL(this.provider.api_base_url).hostname.toLowerCase();
    if (hostname === 'api.openai.com') return this.completeOpenAiResponses(messages, systemPrompt);
    const response = await axios.post(joinUrl(this.provider.api_base_url, 'chat/completions'), {
      model: this.provider.model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature: 0.35,
      max_tokens: 16000
    }, safeRequestConfig({
      timeout: 90000,
      maxContentLength: 2 * 1024 * 1024,
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
    }));
    return response.data?.choices?.[0]?.message?.content || '';
  }

  async completeOpenAiResponses(messages, systemPrompt) {
    const body = {
      model: this.provider.model,
      instructions: systemPrompt,
      input: messages.map(message => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content
      })),
      max_output_tokens: 16000,
      text: { format: { type: 'json_object' } }
    };
    if (this.provider.enable_web_search) body.tools = [{ type: 'web_search' }];
    const response = await axios.post(joinUrl(this.provider.api_base_url, 'responses'), body, safeRequestConfig({
      timeout: 90000,
      maxContentLength: 2 * 1024 * 1024,
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
    }));
    return (response.data?.output || []).flatMap(item => item.content || []).filter(part => part.type === 'output_text').map(part => part.text).join('\n');
  }

  async completeAnthropic(messages, systemPrompt) {
    const response = await axios.post(joinUrl(this.provider.api_base_url, 'messages'), {
      model: this.provider.model,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
      max_tokens: 16000
    }, safeRequestConfig({
      timeout: 90000,
      maxContentLength: 2 * 1024 * 1024,
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    }));
    return (response.data?.content || []).filter(part => part.type === 'text').map(part => part.text).join('\n');
  }

  async completeGemini(messages, systemPrompt) {
    const model = encodeURIComponent(this.provider.model);
    const response = await axios.post(joinUrl(this.provider.api_base_url, `models/${model}:generateContent`), {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      })),
      generationConfig: { temperature: 0.35, maxOutputTokens: 16000, responseMimeType: 'application/json' }
    }, safeRequestConfig({
      timeout: 90000,
      maxContentLength: 2 * 1024 * 1024,
      headers: { 'x-goog-api-key': this.apiKey, 'Content-Type': 'application/json' }
    }));
    return (response.data?.candidates?.[0]?.content?.parts || []).map(part => part.text || '').join('\n');
  }
}

module.exports = { AiClient, extractJson };
