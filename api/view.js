const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const KEY_PREFIX = 'view:';

function safeSlug(slug) {
  return String(slug || '').trim().replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 80);
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const itemsParam = req.query.items || '';
      const items = itemsParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const idx = s.indexOf(':');
          const id = idx === -1 ? s : s.slice(0, idx);
          const slug = idx === -1 ? '' : s.slice(idx + 1);
          return { id: String(id).trim(), slug: safeSlug(slug) };
        })
        .filter((it) => it.id);

      if (!items.length) {
        res.status(200).json({ views: {} });
        return;
      }

      const keys = items.map((it) => KEY_PREFIX + it.id + ':' + it.slug);
      const values = await redis.mget(...keys);

      const views = {};
      items.forEach((it, i) => {
        const v = values[i];
        views[it.id] = typeof v === 'number' ? v : parseInt(v, 10) || 0;
      });

      res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
      res.status(200).json({ views });
      return;
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
      }
      const id = body && body.id ? String(body.id).trim() : '';
      const slug = safeSlug(body && body.slug);

      if (!id) {
        res.status(400).json({ error: 'Missing id' });
        return;
      }

      const key = KEY_PREFIX + id + ':' + slug;
      const newCount = await redis.incr(key);
      res.status(200).json({ id, views: newCount });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: 'Internal error' });
  }
};
