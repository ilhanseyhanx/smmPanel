import PostalMime from 'postal-mime';

const MAX_RAW_BYTES = 2_000_000;
const MAX_TEXT_BYTES = 75_000;
const MAX_HTML_BYTES = 150_000;

function truncateUtf8(value, maxBytes) {
  const encoded = new TextEncoder().encode(String(value || ''));
  if (encoded.byteLength <= maxBytes) return String(value || '');
  return new TextDecoder().decode(encoded.slice(0, maxBytes));
}

function hex(buffer) {
  return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function sign(body, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)));
}

export default {
  async email(message, env) {
    // info@ gibi normal yonlendirmeler bu Worker'a baglanmamalidir. Yalnizca
    // sistemin urettigi order-* adresleri uygulamaya aktarilir.
    const recipient = String(message.to || '').trim();
    const separator = recipient.lastIndexOf('@');
    const localPart = separator > 0 ? recipient.slice(0, separator) : '';
    const domain = separator > 0 ? recipient.slice(separator + 1).toLowerCase() : '';
    const expectedDomain = String(env.SMMJET_INBOUND_DOMAIN || 'jetsmmpanel.com').toLowerCase();
    if (!/^order-[a-zA-Z0-9_-]{20,100}$/.test(localPart) || domain !== expectedDomain) {
      message.setReject('Unknown delivery address');
      return;
    }
    if (!env.SMMJET_WEBHOOK_URL || !env.SMMJET_WEBHOOK_SECRET) {
      throw new Error('Email Worker secrets are not configured.');
    }

    if (Number(message.rawSize || 0) > MAX_RAW_BYTES) {
      message.setReject('Delivery email is too large');
      return;
    }

    // message.raw tek kullanimlik bir stream'dir; once buffer'a alip bir kez parse ederiz.
    const raw = await new Response(message.raw).arrayBuffer();
    if (raw.byteLength > MAX_RAW_BYTES) {
      message.setReject('Delivery email is too large');
      return;
    }
    const parsed = await new PostalMime().parse(raw);
    const body = JSON.stringify({
      recipient,
      sender: message.from || parsed.from?.address || '',
      subject: parsed.subject || 'Dijital ürün teslimatı',
      text: truncateUtf8(parsed.text, MAX_TEXT_BYTES),
      html: truncateUtf8(parsed.html, MAX_HTML_BYTES),
      message_id: parsed.messageId || ''
    });
    const signature = await sign(body, env.SMMJET_WEBHOOK_SECRET);
    const response = await fetch(env.SMMJET_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-smmjet-signature': signature
      },
      body
    });
    if (!response.ok) throw new Error(`SMMJET webhook returned ${response.status}`);
  }
};
