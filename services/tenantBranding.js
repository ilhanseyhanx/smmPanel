'use strict';

// Bayi sitesinin logosu ve sekme simgesi (F4). Dosyalar sunucuda
// uploads/tenant/<bayi-id>/ altinda durur (depoya ve deploy paketine girmez).
// Kabul edilen turler: logo PNG / JPG / WebP, simge PNG / ICO / WebP. SVG
// kabul edilmez (icinde betik tasiyabilir). Tur, dosya adina degil ilk
// baytlarina bakilarak anlasilir.
const fs = require('fs');
const path = require('path');

const KINDS = {
  logo: { maxBytes: 300 * 1024, types: ['png', 'jpg', 'webp'], label: 'Logo PNG, JPG veya WebP olmalı.' },
  favicon: { maxBytes: 100 * 1024, types: ['png', 'ico', 'webp'], label: 'Simge PNG, ICO veya WebP olmalı.' }
};
const MIME = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', ico: 'image/x-icon' };
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function rootDir() {
  return process.env.TENANT_ASSETS_DIR || path.join(__dirname, '..', 'uploads', 'tenant');
}

function dirFor(tenantId) {
  return path.join(rootDir(), String(Math.trunc(Number(tenantId))));
}

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function sniff(buf) {
  if (buf.length > 8 && buf.subarray(0, 8).equals(PNG_SIGNATURE)) return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  if (buf.length > 6 && buf[0] === 0 && buf[1] === 0 && buf[2] === 1 && buf[3] === 0) return 'ico';
  return null;
}

function decodeDataUrl(value) {
  const match = /^data:[a-z0-9/+.-]+;base64,([a-z0-9+/=\s]+)$/i.exec(String(value || ''));
  return match ? Buffer.from(match[1].replace(/\s+/g, ''), 'base64') : null;
}

// Gorseli dogrular ve yazar; { type, version } doner (sayfada ?v= icin).
async function saveAsset(tenantId, kind, dataUrl) {
  const spec = KINDS[kind];
  if (!spec) throw httpError('Bilinmeyen görsel türü.', 404);
  const buf = decodeDataUrl(dataUrl);
  if (!buf || !buf.length) throw httpError('Görsel okunamadı; dosyayı yeniden seç.');
  if (buf.length > spec.maxBytes) throw httpError(`Görsel en fazla ${Math.round(spec.maxBytes / 1024)} KB olabilir.`);
  const type = sniff(buf);
  if (!type || !spec.types.includes(type)) throw httpError(spec.label);
  const dir = dirFor(tenantId);
  await fs.promises.mkdir(dir, { recursive: true });
  for (const ext of Object.keys(MIME)) await fs.promises.rm(path.join(dir, `${kind}.${ext}`), { force: true });
  await fs.promises.writeFile(path.join(dir, `${kind}.${type}`), buf);
  return { type, version: Date.now().toString(36) };
}

async function removeAsset(tenantId, kind) {
  if (!KINDS[kind]) throw httpError('Bilinmeyen görsel türü.', 404);
  const dir = dirFor(tenantId);
  for (const ext of Object.keys(MIME)) await fs.promises.rm(path.join(dir, `${kind}.${ext}`), { force: true });
}

async function removeAll(tenantId) {
  await fs.promises.rm(dirFor(tenantId), { recursive: true, force: true });
}

function assetPath(tenantId, kind, type) {
  return KINDS[kind] && MIME[type] ? path.join(dirFor(tenantId), `${kind}.${type}`) : null;
}

module.exports = { KINDS, MIME, sniff, saveAsset, removeAsset, removeAll, assetPath };
