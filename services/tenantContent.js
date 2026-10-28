'use strict';

// Pro: bayinin blog yazilari (type 'blog', /blog/<slug>) ve satis sayfalari
// (type 'page', /hizmet/<slug>). Metin duz yazidir: "## " ve "### " baslik,
// "- " madde, bos satir paragraf; HTML kabul edilmez, cikti kacirilarak
// uretilir (vitrin JS'i ayni bicimi kullanir). Yayindaki icerik vitrinde
// sunucuda basilir (tenant/index.js) ve sitemap.xml'e girer.
const { dbAsync } = require('../config/database');
const { isProTenant } = require('./resellers');

const TYPES = new Set(['blog', 'page']);
const MAX_POSTS = 300;
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

function httpError(status, message, field) {
  return Object.assign(new Error(message), { status, expose: true, ...(field ? { field } : {}) });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/** Duz metni guvenli HTML'e cevirir (storefront.js formatText ile ayni kurallar). */
function formatBody(text) {
  return String(text || '').replace(/\r\n/g, '\n').split(/\n{2,}/).map(block => {
    const out = [];
    let list = [];
    let para = [];
    const flushList = () => { if (list.length) { out.push(`<ul>${list.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`); list = []; } };
    const flushPara = () => { if (para.length) { out.push(`<p>${para.map(escapeHtml).join('<br>')}</p>`); para = []; } };
    block.split('\n').map(line => line.trim()).filter(Boolean).forEach(line => {
      if (line.startsWith('### ')) { flushPara(); flushList(); out.push(`<h3>${escapeHtml(line.slice(4))}</h3>`); }
      else if (line.startsWith('## ')) { flushPara(); flushList(); out.push(`<h2>${escapeHtml(line.slice(3))}</h2>`); }
      else if (line.startsWith('- ')) { flushPara(); list.push(line.slice(2)); }
      else { flushList(); para.push(line); }
    });
    flushPara();
    flushList();
    return out.join('');
  }).join('');
}

function slugify(value) {
  return String(value || '').toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function excerptOf(post) {
  if (post.excerpt) return post.excerpt;
  return String(post.body || '').replace(/^#+\s.*$/gm, '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

function publicPost(post, { withBody = false } = {}) {
  return {
    id: post.id, type: post.type, slug: post.slug, title: post.title, excerpt: excerptOf(post),
    cover_url: post.cover_url || null, service_id: post.service_id || null,
    published_at: post.published_at, updated_at: post.updated_at,
    ...(withBody ? { body: post.body } : {})
  };
}

/** Vitrin: yayindaki icerik (Pro degilse bos). */
async function publishedPosts(tenant, type, limit = 100) {
  if (!isProTenant(tenant) || !TYPES.has(type)) return [];
  const rows = await dbAsync.all(
    "SELECT * FROM tenant_posts WHERE tenant_id = ? AND type = ? AND status = 'published' ORDER BY published_at DESC, id DESC LIMIT ?",
    [tenant.id, type, limit]);
  return rows.map(row => publicPost(row));
}

async function publishedPost(tenant, type, slug) {
  if (!isProTenant(tenant) || !TYPES.has(type)) return null;
  const row = await dbAsync.get("SELECT * FROM tenant_posts WHERE tenant_id = ? AND type = ? AND slug = ? AND status = 'published'",
    [tenant.id, type, String(slug || '')]);
  return row ? publicPost(row, { withBody: true }) : null;
}

/** Panel: hepsi (taslaklar dahil). */
async function allPosts(tenantId) {
  const rows = await dbAsync.all('SELECT * FROM tenant_posts WHERE tenant_id = ? ORDER BY type, COALESCE(published_at, created_at) DESC, id DESC', [tenantId]);
  return rows.map(row => ({ ...publicPost(row, { withBody: true }), status: row.status, created_at: row.created_at }));
}

async function savePost(tenant, id, input) {
  if (!isProTenant(tenant)) throw httpError(403, 'Blog ve satış sayfaları Pro pakete özel.');
  if (!TYPES.has(input.type)) throw httpError(400, 'Geçersiz içerik türü.');
  const slug = input.slug ? input.slug : slugify(input.title);
  if (!SLUG.test(slug)) throw httpError(400, 'Adres yalnızca küçük harf, rakam ve tire içerebilir.', 'slug');
  if (input.cover_url && !/^https:\/\/[^\s"'<>]+$/i.test(input.cover_url)) throw httpError(400, 'Kapak görseli https:// ile başlayan bir adres olmalı.', 'cover_url');
  const clash = await dbAsync.get('SELECT id FROM tenant_posts WHERE tenant_id = ? AND type = ? AND slug = ? AND id != ?', [tenant.id, input.type, slug, id || 0]);
  if (clash) throw httpError(409, 'Bu adresle başka bir içerik var.', 'slug');
  const fields = [input.title, input.excerpt || null, input.body || '', input.cover_url || null,
    input.type === 'page' && input.service_id ? Number(input.service_id) : null, input.status];
  if (id) {
    const current = await dbAsync.get('SELECT * FROM tenant_posts WHERE id = ? AND tenant_id = ?', [id, tenant.id]);
    if (!current) throw httpError(404, 'İçerik bulunamadı.');
    await dbAsync.run(
      `UPDATE tenant_posts SET slug = ?, title = ?, excerpt = ?, body = ?, cover_url = ?, service_id = ?, status = ?,
              published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, CURRENT_TIMESTAMP) ELSE published_at END,
              updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [slug, ...fields, input.status, id]);
    return id;
  }
  const count = (await dbAsync.get('SELECT COUNT(*) AS n FROM tenant_posts WHERE tenant_id = ?', [tenant.id])).n;
  if (count >= MAX_POSTS) throw httpError(400, `En fazla ${MAX_POSTS} içerik eklenebilir.`);
  const created = await dbAsync.run(
    `INSERT INTO tenant_posts (tenant_id, type, slug, title, excerpt, body, cover_url, service_id, status, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'published' THEN CURRENT_TIMESTAMP ELSE NULL END)`,
    [tenant.id, input.type, slug, ...fields, input.status]);
  return created.id;
}

async function deletePost(tenantId, id) {
  const changed = await dbAsync.run('DELETE FROM tenant_posts WHERE id = ? AND tenant_id = ?', [id, tenantId]);
  if (changed.changes !== 1) throw httpError(404, 'İçerik bulunamadı.');
}

module.exports = { formatBody, slugify, publishedPosts, publishedPost, allPosts, savePost, deletePost, escapeHtml };
