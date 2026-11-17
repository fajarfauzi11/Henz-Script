/* views-snapshot.js - dijalankan OLEH build.js (proses anak) untuk membaca SEMUA angka view dari Redis satu kali saat build
   ("snapshot saat build"). Mencetak SATU objek JSON ke stdout:
     {"ok":true,"views":{"<id>:<slug>":jumlah,...},"source":"read-only"|"token"}   atau   {"ok":false,"reason":"..."}
   Selalu keluar dengan kode 0. Kegagalan apa pun (kredensial tidak ada, modul tidak terpasang, Redis gagal atau lambat) hanya
   menghasilkan ok:false, dan build.js lanjut TANPA angka: halaman memakai /api/view seperti sebelumnya. Build tidak pernah gagal karena ini.
   Memakai token BACA-SAJA (KV_REST_API_READ_ONLY_TOKEN) bila ada; bila tidak, KV_REST_API_TOKEN. Token TIDAK pernah dicetak.
   Logika baca (SCAN view:* lalu MGET) sama dengan readAllViews() di api/view.js; format kuncinya sama: "<id>:<slug>".
   HZ_VIEWS_TIMEOUT_MS (opsional, bawaan 20000) mengatur batas waktu total. */
'use strict';
const KEY_PREFIX = 'view:'; // harus sama dengan api/view.js
const TIMEOUT_MS = parseInt(process.env.HZ_VIEWS_TIMEOUT_MS || '', 10) || 20000;
const url = process.env.KV_REST_API_URL;
const roToken = process.env.KV_REST_API_READ_ONLY_TOKEN;
const token = roToken || process.env.KV_REST_API_TOKEN;

let finished = false;
function done(obj) {
  if (finished) return;
  finished = true;
  let s = JSON.stringify(obj);
  [roToken, process.env.KV_REST_API_TOKEN].forEach((t) => { if (t && t.length >= 8) s = s.split(t).join('[token]'); });
  process.stdout.write(s, () => process.exit(0));
}

async function readAllViews(redis) {
  const found = new Set();
  let cursor = '0';
  let rounds = 0;
  do {
    const res = await redis.scan(cursor, { match: KEY_PREFIX + '*', count: 500 });
    cursor = String(res[0]);
    (res[1] || []).forEach((k) => found.add(k));
    rounds++;
  } while (cursor !== '0' && rounds < 100);
  if (cursor !== '0') throw new Error('scan tidak selesai'); // data tidak lengkap: jangan dipakai
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

(async () => {
  if (!url || !token) return done({ ok: false, reason: 'kredensial Redis tidak ada di lingkungan build' });
  let Redis;
  try { ({ Redis } = require('@upstash/redis')); }
  catch (e) { return done({ ok: false, reason: 'modul @upstash/redis tidak terpasang' }); }
  const timer = setTimeout(() => done({ ok: false, reason: 'waktu habis (' + TIMEOUT_MS + ' ms)' }), TIMEOUT_MS);
  try {
    const views = await readAllViews(new Redis({ url, token }));
    clearTimeout(timer);
    done({ ok: true, views, source: roToken ? 'read-only' : 'token' });
  } catch (e) {
    clearTimeout(timer);
    done({ ok: false, reason: 'Redis gagal: ' + String((e && e.message) || e).slice(0, 100) });
  }
})();
