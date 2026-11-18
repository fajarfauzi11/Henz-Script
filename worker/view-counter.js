/* worker/view-counter.js — Cloudflare Worker pencatat view (dipakai MODE HEMAT CDN, lihat docs/mode-hemat.md).

   Menerima POST dari halaman post henzscript.com dan menjalankan INCR pada kunci yang SAMA dengan api/view.js di Redis Upstash yang
   sama (view:{id}:{slug}), jadi angkanya menyatu dengan yang dicatat Vercel. Request ke Worker tidak dihitung sebagai Edge Request Vercel.

   Environment (Worker > Settings > Variables and Secrets):
     UPSTASH_URL      (Secret)  = nilai KV_REST_API_URL  dari Vercel
     UPSTASH_TOKEN    (Secret)  = nilai KV_REST_API_TOKEN dari Vercel (token tulis; JANGAN pernah ditaruh di kode/klien)
     ALLOWED_ORIGINS  (opsional) = daftar origin dipisah koma; bawaan: https://www.henzscript.com,https://henzscript.com
     MAX_ID           (opsional) = id post terbesar yang diterima (mis. 300); id di atasnya ditolak supaya tidak ada kunci sampah.
                                   Naikkan saat jumlah post bertambah, atau kosongkan untuk menonaktifkan batas ini.

   Klien (main.js, mode hemat) mengirim: POST <worker-url>, Content-Type text/plain (supaya tanpa preflight), body {"id":125,"slug":"aamon-collector"}. */

const DEFAULT_ORIGINS = ['https://www.henzscript.com', 'https://henzscript.com'];
const MAX_BODY = 512;

function safeSlug(slug) {
  return String(slug || '').trim().replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 80); // sama dengan api/view.js
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function reply(status, obj, headers) {
  return new Response(obj === null ? null : JSON.stringify(obj), {
    status,
    headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, headers || {})
  });
}

export default {
  async fetch(request, env) {
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const origins = allowed.length ? allowed : DEFAULT_ORIGINS;
    const origin = request.headers.get('Origin') || '';
    const cors = origins.indexOf(origin) !== -1 ? corsHeaders(origin) : null;

    if (request.method === 'OPTIONS') return cors ? new Response(null, { status: 204, headers: cors }) : reply(403, { error: 'Forbidden' });
    if (request.method !== 'POST') return reply(405, { error: 'Method not allowed' }, Object.assign({ Allow: 'POST, OPTIONS' }, cors || {}));
    if (!cors) return reply(403, { error: 'Forbidden' });

    const len = parseInt(request.headers.get('Content-Length') || '0', 10);
    if (len > MAX_BODY) return reply(413, { error: 'Too large' }, cors);
    let body;
    try {
      const text = await request.text();
      if (text.length > MAX_BODY) return reply(413, { error: 'Too large' }, cors);
      body = JSON.parse(text);
    } catch (e) {
      return reply(400, { error: 'Bad request' }, cors);
    }
    const id = String(body && body.id !== undefined ? body.id : '').trim();
    const slug = safeSlug(body && body.slug);
    if (!/^\d{1,9}$/.test(id) || !slug) return reply(400, { error: 'Missing id or slug' }, cors);
    const maxId = parseInt(env.MAX_ID || '0', 10);
    if (maxId > 0 && parseInt(id, 10) > maxId) return reply(400, { error: 'Unknown id' }, cors);
    if (!env.UPSTASH_URL || !env.UPSTASH_TOKEN) return reply(500, { error: 'Not configured' }, cors);

    try {
      const r = await fetch(String(env.UPSTASH_URL).replace(/\/+$/, ''), {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + env.UPSTASH_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify(['INCR', 'view:' + id + ':' + slug])
      });
      if (!r.ok) return reply(502, { error: 'Upstream' }, cors);
      const data = await r.json();
      return reply(200, { id, views: typeof data.result === 'number' ? data.result : null }, cors);
    } catch (e) {
      return reply(502, { error: 'Upstream' }, cors);
    }
  }
};
