/* api/push-requester.js — Simpan data peminta script (untuk fitur "mention peminta") ke Redis.
   Dipanggil dari tool/post-editor-tool.html SEBELUM posts.json di-commit, dengan header
   Authorization: Bearer <REQUESTER_SECRET>. Tanpa secret yang benar -> 401.

   Body JSON: { "id": 157, "url": "/post/nama-post", "requester": { "discord": ["123456789012345678"], "telegram": ["username"], "whatsapp": ["62812xxxxxxx"] } }
   - Minimal satu platform. Hanya platform yang dikirim yang akan di-mention (tampil di platform itu saja).
   - Tiap platform menerima satu nilai (string) atau daftar (array), maksimal 5 orang per platform.
   - Disimpan di Redis pada kunci req:{id} selama 30 hari, lalu dibaca dan dihapus oleh api/push-notify.js.
   - {"id":157, "clear":true} menghapus data (opsional).
   Data pribadi: JANGAN simpan di repo/posts.json, dan jangan dicatat ke log. Respons tidak pernah memantulkan nilainya. */
const crypto = require('crypto');
const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_PER_PLATFORM = 5;
const SPECS = {
  discord: { re: /^\d{17,20}$/, norm: (s) => s },
  telegram: { re: /^[A-Za-z][A-Za-z0-9_]{4,31}$/, norm: (s) => s.replace(/^@+/, '') },
  whatsapp: { re: /^\d{8,15}$/, norm: (s) => s },
};

function setCors(res) {
  // Tool dibuka dari luar domain situs (file lokal), jadi CORS diperlukan. Aman karena akses dijaga secret Bearer, bukan cookie.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');
}

function authorized(req) {
  const secret = process.env.REQUESTER_SECRET || '';
  if (secret.length < 16) return false; // tidak diatur / terlalu pendek: tolak semua
  const h = String((req.headers && req.headers.authorization) || '');
  const given = h.indexOf('Bearer ') === 0 ? h.slice(7) : '';
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!authorized(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body && typeof body === 'object' ? body : {};

  const id = body.id;
  if (!Number.isInteger(id) || id < 1 || id > 1000000000) {
    res.status(400).json({ error: 'id tidak valid' });
    return;
  }
  const key = 'req:' + id;

  try {
    if (body.clear === true) {
      await redis.del(key);
      res.status(200).json({ ok: true, id, cleared: true });
      return;
    }

    const url = body.url;
    if (typeof url !== 'string' || !/^\/post\/[a-z0-9][a-z0-9-]{0,119}$/.test(url)) {
      res.status(400).json({ error: 'url tidak valid' });
      return;
    }
    const rq = body.requester && typeof body.requester === 'object' ? body.requester : {};
    const value = { url };
    for (const k of Object.keys(SPECS)) {
      if (rq[k] === undefined) continue;
      const arr = Array.isArray(rq[k]) ? rq[k] : [rq[k]];
      if (arr.length < 1 || arr.length > MAX_PER_PLATFORM) {
        res.status(400).json({ error: 'jumlah ' + k + ' harus 1-' + MAX_PER_PLATFORM });
        return;
      }
      const list = [];
      for (let i = 0; i < arr.length; i++) {
        const s = SPECS[k].norm(String(arr[i]).trim());
        if (!SPECS[k].re.test(s)) {
          res.status(400).json({ error: 'format ' + k + ' entri ke-' + (i + 1) + ' tidak valid' }); // jangan memantulkan nilainya
          return;
        }
        const dup = list.some((x) => (k === 'telegram' ? x.toLowerCase() === s.toLowerCase() : x === s)); // username Telegram tidak membedakan huruf besar/kecil
        if (!dup) list.push(s);
      }
      value[k] = list;
    }
    const platforms = ['discord', 'telegram', 'whatsapp'].filter((k) => value[k] !== undefined);
    if (!platforms.length) {
      res.status(400).json({ error: 'minimal satu platform' });
      return;
    }

    await redis.set(key, value, { ex: TTL_SECONDS });
    res.status(200).json({ ok: true, id, platforms, count: platforms.reduce((n, k) => n + value[k].length, 0), ttl_days: 30 });
  } catch (err) {
    console.error('push-requester:', err && err.message); // jangan pernah mencatat isi data peminta
    res.status(502).json({ error: 'Gagal menyimpan' });
  }
};
