const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const KEY_PREFIX = 'view:';

function safeSlug(slug) {
  return String(slug || '').trim().replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 80);
}

/* GET /api/view?all=1 -> { views: { "<id>:<slug>": jumlah, ... } } untuk SEMUA post, dalam SATU URL tetap yang dipakai semua halaman.
   Dulu tiap halaman meminta ?items=<daftar id halaman itu>, jadi URL-nya berbeda-beda: respons satu halaman tidak bisa dipakai halaman
   lain, dan browser tidak pernah menyimpannya (Vercel mengganti Cache-Control yang hanya berisi s-maxage menjadi max-age=0 untuk browser).
   Sekarang respons ini boleh dipakai ulang oleh browser (BROWSER_TTL) dan oleh CDN (CDN_TTL). Angka view boleh tertinggal; lag terburuk
   = BROWSER_TTL + CDN_TTL (respons dari CDN bisa berumur CDN_TTL saat browser mengambilnya, lalu browser menyimpannya BROWSER_TTL).
   Batas yang disetujui: 30 menit; sekarang 15 + 10 = 25 menit. Sengaja TANPA stale-while-revalidate supaya batas itu tidak terlampaui.
   Header untuk CDN memakai Vercel-CDN-Cache-Control (tidak dikirim ke browser); Cache-Control-nya sendiri dikirim apa adanya ke browser.
   Jalur ?items= di bawah TIDAK diubah (masih dipakai tool/ dan berfungsi sebagai cadangan bila mode ini gagal). */
const BROWSER_TTL = 900;
const CDN_TTL = 600;

async function readAllViews() {
  const found = new Set();
  let cursor = '0';
  let rounds = 0;
  do {
    const res = await redis.scan(cursor, { match: KEY_PREFIX + '*', count: 500 });
    cursor = String(res[0]);
    (res[1] || []).forEach((k) => found.add(k));
    rounds++;
  } while (cursor !== '0' && rounds < 100);
  // Pemindaian yang tidak selesai = data tidak lengkap: gagalkan (500, tidak di-cache) daripada menyimpan angka yang kurang.
  if (cursor !== '0') throw new Error('scan tidak selesai');
  const keys = Array.from(found);
  const views = {};
  for (let i = 0; i < keys.length; i += 500) {
    const part = keys.slice(i, i + 500);
    const values = await redis.mget(...part);
    part.forEach((k, j) => {
      const v = values[j];
      views[k.slice(KEY_PREFIX.length)] = typeof v === 'number' ? v : parseInt(v, 10) || 0;
    });
  }
  return views;
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      if (req.query.all === '1') {
        const allViews = await readAllViews();
        res.setHeader('Cache-Control', 'public, max-age=' + BROWSER_TTL);
        res.setHeader('Vercel-CDN-Cache-Control', 'max-age=' + CDN_TTL);
        res.status(200).json({ all: true, views: allViews }); // all:true = penanda untuk klien (server lama membalas {views:{}} tanpa penanda ini)
        return;
      }
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
