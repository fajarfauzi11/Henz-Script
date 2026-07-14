const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const KEY_PREFIX = 'view:';

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const idsParam = req.query.ids || '';
      const ids = idsParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      if (!ids.length) {
        res.status(200).json({ views: {} });
        return;
      }

      const keys = ids.map((id) => KEY_PREFIX + id);
      const values = await redis.mget(...keys);

      const views = {};
      ids.forEach((id, i) => {
        const v = values[i];
        views[id] = typeof v === 'number' ? v : parseInt(v, 10) || 0;
      });

      res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
      res.status(200).json({ views });
      return;
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
      }
      const id = body && body.id ? String(body.id).trim() : '';

      if (!id) {
        res.status(400).json({ error: 'Missing id' });
        return;
      }

      const newCount = await redis.incr(KEY_PREFIX + id);
      res.status(200).json({ id, views: newCount });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: 'Internal error' });
  }
};
