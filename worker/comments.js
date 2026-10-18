// GET  /api/comments?slug=...  → komentar yang sudah disetujui (tanpa data teknis)
// POST /api/comments           → komentar baru MASUK ANTREAN moderasi (tidak langsung tampil)
// Teks disimpan apa adanya sebagai TEKS; klien merender dengan textContent (tidak pernah HTML).
import { createRedis } from './lib/redis.js';
import { hashVisitor } from './lib/hash.js';
import { COMMENT_ID_RE, cleanName, cleanText, commentProblem, isValidSlug, sameOrigin } from './lib/validate.js';
import { json, NO_STORE } from './lib/http.js';

export const PENDING_KEY = 'cava:c:pending';
export const PENDING_MAX = 500;      // antrean dibatasi; saat penuh yang paling lama dibuang
export const READ_MAX = 300;
export const LIMIT_PER_MINUTE = 3;
export const LIMIT_PER_HOUR = 20;
export const TURNSTILE_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const approvedKey = (slug) => `cava:c:${slug}`;

function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let s = '';
  for (const b of bytes) s += (b % 36).toString(36);
  return `c_${s}`;
}

function publicComment(raw) {
  try {
    const c = JSON.parse(raw);
    if (!c || typeof c.id !== 'string' || typeof c.name !== 'string' || typeof c.text !== 'string') return null;
    return { id: c.id, parentId: typeof c.parentId === 'string' ? c.parentId : null, name: c.name, text: c.text, createdAt: Number(c.createdAt) || 0 };
  } catch {
    return null;
  }
}

async function handleGet(request, env) {
  const slug = new URL(request.url).searchParams.get('slug');
  if (!isValidSlug(slug)) return json({ error: 'invalid', message: 'Invalid article.' }, 400, NO_STORE);
  try {
    const redis = createRedis(env);
    const rows = await redis.command('LRANGE', approvedKey(slug), String(-READ_MAX), '-1');
    const comments = (Array.isArray(rows) ? rows : []).map(publicComment).filter(Boolean);
    return json({ comments }, 200, { 'Cache-Control': 'public, max-age=60' });
  } catch (err) {
    console.error('comments: baca gagal', err && err.message);
    return json({ error: 'unavailable' }, 503, NO_STORE);
  }
}

async function verifyTurnstile(env, token) {
  if (typeof token !== 'string' || !token || token.length > 2048) return false;
  const res = await fetch(TURNSTILE_URL, { method: 'POST', body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token }) });
  if (!res.ok) throw new Error(`turnstile: HTTP ${res.status}`);
  const data = await res.json();
  return !!(data && data.success === true);
}

async function handlePost(request, env, now) {
  if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403, NO_STORE);

  let body;
  try {
    const text = await request.text();
    if (text.length > 6000) return json({ error: 'invalid', message: 'Request too large.' }, 413, NO_STORE);
    body = JSON.parse(text);
  } catch {
    return json({ error: 'invalid', message: 'Invalid request.' }, 400, NO_STORE);
  }
  if (!body || typeof body !== 'object') return json({ error: 'invalid', message: 'Invalid request.' }, 400, NO_STORE);

  if (!isValidSlug(body.slug)) return json({ error: 'invalid', message: 'Invalid article.' }, 400, NO_STORE);
  const parentId = body.parentId == null || body.parentId === '' ? null : body.parentId;
  if (parentId !== null && !(typeof parentId === 'string' && COMMENT_ID_RE.test(parentId))) {
    return json({ error: 'invalid', message: 'Invalid reply target.' }, 400, NO_STORE);
  }
  const name = cleanName(body.name);
  const text = cleanText(body.text);
  const problem = commentProblem(name, text);
  if (problem) return json({ error: 'invalid', message: problem }, 400, NO_STORE);

  // Honeypot: bot mengisi kolom tersembunyi → balas sukses palsu, jangan simpan apa pun.
  if (typeof body.website === 'string' && body.website.trim() !== '') return json({ status: 'pending' }, 202, NO_STORE);

  if (!env.IP_HASH_SALT) {
    console.error('comments: IP_HASH_SALT belum diset');
    return json({ error: 'unavailable' }, 503, NO_STORE);
  }

  try {
    const redis = createRedis(env);
    const hash = await hashVisitor(request, env, now);
    const minute = `cava:rl:${hash}:${Math.floor(now.getTime() / 60000)}`;
    const hour = `cava:rlh:${hash}:${Math.floor(now.getTime() / 3600000)}`;
    const [perMinute, perHour] = (await redis.pipeline([['INCR', minute], ['INCR', hour]])).map(Number);
    if (perMinute > LIMIT_PER_MINUTE || perHour > LIMIT_PER_HOUR) {
      const writes = [];
      if (perMinute === 1) writes.push(['EXPIRE', minute, '120']);
      if (perHour === 1) writes.push(['EXPIRE', hour, '7200']);
      if (writes.length) await redis.pipeline(writes);
      return json({ error: 'rate_limited', message: 'You are commenting too fast. Please wait a bit and try again.' }, 429, { 'Retry-After': '60', ...NO_STORE });
    }

    if (env.TURNSTILE_SECRET && !(await verifyTurnstile(env, body.turnstileToken))) {
      return json({ error: 'verification_failed', message: 'Verification failed. Please try again.' }, 403, NO_STORE);
    }

    const comment = { id: newId(), slug: body.slug, parentId, name, text, createdAt: now.getTime() };
    const writes = [];
    if (perMinute === 1) writes.push(['EXPIRE', minute, '120']);
    if (perHour === 1) writes.push(['EXPIRE', hour, '7200']);
    writes.push(['RPUSH', PENDING_KEY, JSON.stringify(comment)], ['LTRIM', PENDING_KEY, String(-PENDING_MAX), '-1']);
    await redis.pipeline(writes);
    return json({ status: 'pending' }, 202, NO_STORE);
  } catch (err) {
    console.error('comments: tulis gagal', err && err.message);
    return json({ error: 'unavailable' }, 503, NO_STORE);
  }
}

export async function handleComments(request, env, now = new Date()) {
  if (request.method === 'GET') return handleGet(request, env);
  if (request.method === 'POST') return handlePost(request, env, now);
  return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET, POST', ...NO_STORE });
}
