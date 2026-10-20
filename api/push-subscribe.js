/* api/push-subscribe.js — Pendaftaran / pembatalan token notifikasi (dipanggil public/js/notify.js).
   POST   {token} -> token didaftarkan ke topic FCM "all" (+ dicatat di Redis hash push:subs untuk cadangan/penghitungan)
   DELETE {token} -> token dibatalkan dari topic dan dihapus dari push:subs
   Dibatasi 30 permintaan per IP per jam. */
const { Redis } = require('@upstash/redis');
const { topicSubscribe } = require('./_lib/fcm');

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const SUBS_KEY = 'push:subs';
const RATE_LIMIT = 30;
const TOKEN_RE = /^[A-Za-z0-9_:\-]{50,4096}$/;

function clientIp(req) {
  const xff = String((req.headers && req.headers['x-forwarded-for']) || '');
  return (xff.split(',')[0] || '').trim() || 'unknown';
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method !== 'POST' && req.method !== 'DELETE') {
      res.setHeader('Allow', 'POST, DELETE');
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    const token = body && typeof body.token === 'string' ? body.token.trim() : '';
    if (!TOKEN_RE.test(token)) {
      res.status(400).json({ error: 'Token tidak valid' });
      return;
    }

    const rlKey = 'push:rl:' + clientIp(req);
    const n = await redis.incr(rlKey);
    if (n === 1) await redis.expire(rlKey, 3600);
    if (n > RATE_LIMIT) {
      res.status(429).json({ error: 'Terlalu banyak permintaan' });
      return;
    }

    if (req.method === 'POST') {
      await topicSubscribe(token, true);
      await redis.hset(SUBS_KEY, { [token]: Date.now() });
      res.status(200).json({ ok: true });
      return;
    }

    await topicSubscribe(token, false);
    await redis.hdel(SUBS_KEY, token);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('push-subscribe:', err && err.message);
    res.status(500).json({ error: 'Server error' });
  }
};
