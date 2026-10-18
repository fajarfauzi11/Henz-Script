// Uji Worker API (view + populer) dengan Upstash palsu di memori. Jalankan: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import { handleView } from '../worker/view.js';
import { handlePopular, windowKeys } from '../worker/popular.js';
import { handleComments, PENDING_KEY } from '../worker/comments.js';
import { dayKey } from '../worker/lib/hash.js';
import { isBot, isValidSlug } from '../worker/lib/validate.js';

const IP = '203.0.113.77';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/130.0';
const ENV = { UPSTASH_REDIS_REST_URL: 'https://fake.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'tok', IP_HASH_SALT: 'salt-rahasia' };
const NOW = new Date('2026-10-15T10:00:00Z');

// Upstash palsu: mengenali endpoint /pipeline dan sebagian kecil perintah.
function fakeUpstash() {
  const kv = new Map(); const z = new Map(); const lists = new Map(); const calls = []; let down = false;
  const exec = (cmd) => {
    calls.push(cmd.map(String));
    const [name, ...a] = cmd; const c = String(name).toUpperCase();
    if (c === 'SET') { if (a.includes('NX') && kv.has(a[0])) return null; kv.set(a[0], a[1]); return 'OK'; }
    if (c === 'GET') return kv.has(a[0]) ? kv.get(a[0]) : null;
    if (c === 'EXPIRE') return 1;
    if (c === 'INCR') { const n = Number(kv.get(a[0]) || 0) + 1; kv.set(a[0], String(n)); return n; }
    if (c === 'RPUSH') { const l = lists.get(a[0]) || []; l.push(a[1]); lists.set(a[0], l); return l.length; }
    if (c === 'LTRIM') { const l = lists.get(a[0]) || []; const st = Number(a[1]) < 0 ? Math.max(0, l.length + Number(a[1])) : Number(a[1]); lists.set(a[0], l.slice(st)); return 'OK'; }
    if (c === 'LRANGE') { const l = lists.get(a[0]) || []; const st = Number(a[1]) < 0 ? Math.max(0, l.length + Number(a[1])) : Number(a[1]); return l.slice(st); }
    if (c === 'ZINCRBY') { const m = z.get(a[0]) || new Map(); const s = (m.get(a[2]) || 0) + Number(a[1]); m.set(a[2], s); z.set(a[0], m); return String(s); }
    if (c === 'ZUNIONSTORE') {
      const out = new Map();
      for (const k of a.slice(2)) for (const [m, s] of (z.get(k) || new Map())) out.set(m, (out.get(m) || 0) + s);
      z.set(a[0], out); return out.size;
    }
    if (c === 'ZREVRANGE') {
      const arr = [...(z.get(a[0]) || new Map())].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1)).map((e) => e[0]);
      return arr.slice(Number(a[1]), Number(a[2]) + 1);
    }
    throw new Error('perintah tak dikenal di fake: ' + c);
  };
  const stub = async (url, init) => {
    assert.equal(String(url), 'https://fake.upstash.io/pipeline');
    assert.equal(init.headers.Authorization, 'Bearer tok');
    if (down) return new Response('boom', { status: 500 });
    const cmds = JSON.parse(init.body);
    return Response.json(cmds.map((cmd) => ({ result: exec(cmd) })));
  };
  return { stub, calls, z, kv, lists, setDown: (v) => { down = v; } };
}

const realFetch = globalThis.fetch;
let fake;
const setup = () => { fake = fakeUpstash(); globalThis.fetch = fake.stub; };
const teardown = () => { globalThis.fetch = realFetch; };

const viewReq = (slug, { ua = UA, ip = IP, origin, method = 'POST', body } = {}) => new Request('https://cava.example/api/view', {
  method,
  headers: { 'User-Agent': ua, 'CF-Connecting-IP': ip, 'Content-Type': 'text/plain', ...(origin ? { Origin: origin } : {}) },
  body: method === 'POST' ? (body !== undefined ? body : JSON.stringify({ slug })) : undefined,
});
const popReq = (qs = '') => new Request('https://cava.example/api/popular' + qs, { headers: { 'User-Agent': UA } });
const todayKey = `cava:pop:d:${dayKey(NOW)}`;

test('validate: slug dan bot', () => {
  assert.ok(isValidSlug('new-moba-season'));
  for (const bad of ['', 'A-b', 'a--b', '-a', 'a_b', 'a/b', 'a'.repeat(81), null, 5, undefined]) assert.equal(isValidSlug(bad), false, String(bad));
  assert.ok(isBot('')); assert.ok(isBot('Googlebot/2.1')); assert.ok(isBot('curl/8.0'));
  assert.equal(isBot(UA), false);
});

test('view: menghitung sekali per pengunjung, lalu diabaikan dalam jendela dedupe', async () => {
  setup();
  try {
    let r = await handleView(viewReq('a-slug'), ENV, NOW);
    assert.equal(r.status, 204);
    r = await handleView(viewReq('a-slug'), ENV, NOW);
    assert.equal(r.status, 204);
    assert.equal(fake.z.get(todayKey).get('a-slug'), 1);
    // pengunjung lain (UA berbeda) dihitung
    await handleView(viewReq('a-slug', { ua: UA + ' Other' }), ENV, NOW);
    assert.equal(fake.z.get(todayKey).get('a-slug'), 2);
    // artikel lain oleh pengunjung pertama dihitung
    await handleView(viewReq('b-slug'), ENV, NOW);
    assert.equal(fake.z.get(todayKey).get('b-slug'), 1);
  } finally { teardown(); }
});

test('view: EXPIRE dipasang saat anggota pertama kunci harian', async () => {
  setup();
  try {
    await handleView(viewReq('a-slug'), ENV, NOW);
    const exp = fake.calls.filter((c) => c[0] === 'EXPIRE');
    assert.deepEqual(exp, [['EXPIRE', todayKey, '864000']]);
    await handleView(viewReq('a-slug', { ua: UA + ' 2' }), ENV, NOW); // skor 2 → tanpa EXPIRE baru
    assert.equal(fake.calls.filter((c) => c[0] === 'EXPIRE').length, 1);
  } finally { teardown(); }
});

test('view: IP tidak pernah dikirim atau disimpan mentah', async () => {
  setup();
  try {
    await handleView(viewReq('a-slug'), ENV, NOW);
    const all = JSON.stringify([...fake.calls, [...fake.kv.keys()]]);
    assert.equal(all.includes(IP), false);
    assert.equal(all.includes('salt-rahasia'), false);
    assert.match(fake.calls[0][1], /^cava:v:[0-9a-f]{32}:a-slug$/);
  } finally { teardown(); }
});

test('view: input tidak valid, bot, origin asing → 204 tanpa menyentuh Redis', async () => {
  setup();
  try {
    const cases = [
      viewReq('Bad Slug'), viewReq('x', { body: 'bukan json' }), viewReq('x', { body: JSON.stringify({ slug: 5 }) }),
      viewReq('x', { body: 'a'.repeat(600) }), viewReq('a-slug', { ua: 'Googlebot/2.1' }), viewReq('a-slug', { ua: '' }),
      viewReq('a-slug', { origin: 'https://evil.example' }),
    ];
    for (const rq of cases) assert.equal((await handleView(rq, ENV, NOW)).status, 204);
    assert.equal(fake.calls.length, 0);
    // origin sama diterima
    await handleView(viewReq('a-slug', { origin: 'https://cava.example' }), ENV, NOW);
    assert.ok(fake.calls.length > 0);
  } finally { teardown(); }
});

test('view: metode salah → 405; tanpa garam → tidak dihitung; Redis mati → 503 tanpa melempar', async () => {
  setup();
  try {
    assert.equal((await handleView(viewReq('a-slug', { method: 'GET' }), ENV, NOW)).status, 405);
    assert.equal((await handleView(viewReq('a-slug'), { ...ENV, IP_HASH_SALT: '' }, NOW)).status, 204);
    assert.equal(fake.calls.length, 0);
    fake.setDown(true);
    assert.equal((await handleView(viewReq('a-slug'), ENV, NOW)).status, 503);
    assert.equal((await handleView(viewReq('a-slug'), { ...ENV, UPSTASH_REDIS_REST_URL: '' }, NOW)).status, 503);
  } finally { teardown(); }
});

test('popular: urutan menurun, tanpa skor, header cache, dan cache Redis dipakai ulang', async () => {
  setup();
  try {
    const hit = async (slug, n) => { for (let i = 0; i < n; i++) await handleView(viewReq(slug, { ua: `${UA} v${i}` }), ENV, NOW); };
    await hit('alpha', 3); await hit('beta', 5); await hit('gamma', 1);
    const r = await handlePopular(popReq('?limit=2'), ENV, NOW);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('Cache-Control'), 'public, max-age=300');
    const body = await r.json();
    assert.deepEqual(body, { slugs: ['beta', 'alpha'] });
    assert.deepEqual(Object.keys(body), ['slugs']);
    // panggilan kedua: hanya GET (cache), tanpa ZUNIONSTORE baru
    const before = fake.calls.filter((c) => c[0] === 'ZUNIONSTORE').length;
    const r2 = await (await handlePopular(popReq('?limit=3'), ENV, NOW)).json();
    assert.deepEqual(r2.slugs, ['beta', 'alpha', 'gamma']);
    assert.equal(fake.calls.filter((c) => c[0] === 'ZUNIONSTORE').length, before);
  } finally { teardown(); }
});

test('popular: limit dibatasi 1–20, default 5; jendela 7 hari UTC; kosong → daftar kosong', async () => {
  setup();
  try {
    for (let i = 0; i < 25; i++) await handleView(viewReq(`slug-${String(i).padStart(2, '0')}`), ENV, NOW);
    assert.equal((await (await handlePopular(popReq(), ENV, NOW)).json()).slugs.length, 5);
    assert.equal((await (await handlePopular(popReq('?limit=999'), ENV, NOW)).json()).slugs.length, 20);
    assert.equal((await (await handlePopular(popReq('?limit=abc'), ENV, NOW)).json()).slugs.length, 5);
    const keys = windowKeys(NOW);
    assert.equal(keys.length, 7);
    assert.equal(keys[0], 'cava:pop:d:20261015'); assert.equal(keys[6], 'cava:pop:d:20261009');
    setup();
    assert.deepEqual(await (await handlePopular(popReq(), ENV, NOW)).json(), { slugs: [] });
  } finally { teardown(); }
});

test('popular: cache rusak dihitung ulang; Redis mati → 503; metode salah → 405', async () => {
  setup();
  try {
    await handleView(viewReq('alpha'), ENV, NOW);
    fake.kv.set('cava:pop:cache', '{rusak');
    assert.deepEqual((await (await handlePopular(popReq(), ENV, NOW)).json()).slugs, ['alpha']);
    const post = new Request('https://cava.example/api/popular', { method: 'POST' });
    assert.equal((await handlePopular(post, ENV, NOW)).status, 405);
    fake.setDown(true); fake.kv.clear();
    const r = await handlePopular(popReq(), ENV, NOW);
    assert.equal(r.status, 503); assert.equal(r.headers.get('Cache-Control'), 'no-store');
  } finally { teardown(); }
});

test('router: /api/view, /api/popular, trailing slash, 404 JSON, jatuh ke ASSETS bila bukan API', async () => {
  setup();
  try {
    assert.equal((await worker.fetch(viewReq('a-slug'), ENV)).status, 204);
    assert.equal((await worker.fetch(new Request('https://cava.example/api/popular/'), ENV)).status, 200);
    const nf = await worker.fetch(new Request('https://cava.example/api/nope'), ENV);
    assert.equal(nf.status, 404); assert.equal((await nf.json()).error, 'not_found');
    const assets = { fetch: async () => new Response('asset') };
    assert.equal(await (await worker.fetch(new Request('https://cava.example/about'), { ...ENV, ASSETS: assets })).text(), 'asset');
  } finally { teardown(); }
});

// ───── komentar (3C) ─────
const cPost = (obj, { ua = UA, ip = IP, origin, raw } = {}) => new Request('https://cava.example/api/comments', {
  method: 'POST',
  headers: { 'User-Agent': ua, 'CF-Connecting-IP': ip, 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
  body: raw !== undefined ? raw : JSON.stringify(obj),
});
const cGet = (slug) => new Request('https://cava.example/api/comments' + (slug === undefined ? '' : `?slug=${slug}`), { headers: { 'User-Agent': UA } });
const good = (o = {}) => ({ slug: 'a-slug', name: 'Rina', text: 'Great article, thanks for the tips!', ...o });

test('comments POST: masuk antrean (202), bukan daftar tersetujui; teks dibersihkan; IP tidak tersimpan', async () => {
  setup();
  try {
    const r = await handleComments(cPost(good({ name: '  Rina\u202E\n  S  ', text: 'Hello\u200B world\r\n\r\n\r\n\r\nBye' })), ENV, NOW);
    assert.equal(r.status, 202);
    assert.deepEqual(await r.json(), { status: 'pending' });
    const pending = fake.lists.get(PENDING_KEY);
    assert.equal(pending.length, 1);
    const c = JSON.parse(pending[0]);
    assert.match(c.id, /^c_[a-z0-9]{6}$/);
    assert.equal(c.name, 'Rina S'); assert.equal(c.text, 'Hello world\n\nBye');
    assert.equal(c.slug, 'a-slug'); assert.equal(c.parentId, null); assert.equal(c.createdAt, NOW.getTime());
    assert.equal(fake.lists.get('cava:c:a-slug'), undefined, 'tidak langsung tampil');
    assert.equal(JSON.stringify(fake.calls).includes(IP), false);
  } finally { teardown(); }
});

test('comments POST: validasi — panjang, tautan, parentId, JSON rusak, ukuran, origin; tanpa menyentuh Redis', async () => {
  setup();
  try {
    const bad = [
      good({ slug: 'Bad Slug' }), good({ name: '' }), good({ name: 'x'.repeat(41) }), good({ text: 'a' }), good({ text: 'x'.repeat(1001) }),
      good({ text: 'see https://a.example and https://b.example' }), good({ text: 'https://only-a-link.example' }), good({ parentId: 'nope' }),
      good({ name: 5 }), good({ text: null }),
    ];
    for (const b of bad) assert.equal((await handleComments(cPost(b), ENV, NOW)).status, 400, JSON.stringify(b).slice(0, 60));
    assert.equal((await handleComments(cPost(null, { raw: 'bukan json' }), ENV, NOW)).status, 400);
    assert.equal((await handleComments(cPost(null, { raw: 'x'.repeat(7000) }), ENV, NOW)).status, 413);
    assert.equal((await handleComments(cPost(good(), { origin: 'https://evil.example' }), ENV, NOW)).status, 403);
    assert.equal(fake.calls.length, 0);
    // satu tautan + teks, serta balasan dengan parentId valid → diterima
    assert.equal((await handleComments(cPost(good({ text: 'Nice, details at https://a.example/page', parentId: 'c_abc123' })), ENV, NOW)).status, 202);
    assert.equal(JSON.parse(fake.lists.get(PENDING_KEY)[0]).parentId, 'c_abc123');
  } finally { teardown(); }
});

test('comments POST: honeypot → sukses palsu tanpa menyimpan atau menyentuh Redis', async () => {
  setup();
  try {
    const r = await handleComments(cPost(good({ website: 'http://spam.example' })), ENV, NOW);
    assert.equal(r.status, 202);
    assert.equal(fake.calls.length, 0);
  } finally { teardown(); }
});

test('comments POST: rate limit 3/menit → 429 + Retry-After; menit berikutnya lolos; 20/jam', async () => {
  setup();
  try {
    for (let i = 0; i < 3; i++) assert.equal((await handleComments(cPost(good()), ENV, NOW)).status, 202);
    const r = await handleComments(cPost(good()), ENV, NOW);
    assert.equal(r.status, 429); assert.equal(r.headers.get('Retry-After'), '60');
    assert.equal(fake.lists.get(PENDING_KEY).length, 3, 'yang ditolak tidak tersimpan');
    const later = new Date(NOW.getTime() + 61000);
    assert.equal((await handleComments(cPost(good()), ENV, later)).status, 202);
    // batas per jam dihitung per percobaan (yang ditolak ikut dihitung): sudah 5 percobaan; 15 lagi lolos, percobaan ke-21 ditolak
    let t = later.getTime();
    for (let i = 0; i < 15; i++) { t += 61000; assert.equal((await handleComments(cPost(good()), ENV, new Date(t))).status, 202, `ke-${i}`); }
    t += 61000;
    assert.equal((await handleComments(cPost(good()), ENV, new Date(t))).status, 429);
    // pengunjung lain tidak terpengaruh
    assert.equal((await handleComments(cPost(good(), { ip: '198.51.100.9', ua: UA + ' Z' }), ENV, NOW)).status, 202);
  } finally { teardown(); }
});

test('comments POST: antrean dibatasi 500; Turnstile bila secret diset; Redis mati → 503; tanpa garam → 503', async () => {
  setup();
  try {
    fake.lists.set(PENDING_KEY, Array.from({ length: 500 }, (_, i) => JSON.stringify({ id: `c_old${i}` })));
    assert.equal((await handleComments(cPost(good()), ENV, NOW)).status, 202);
    const q = fake.lists.get(PENDING_KEY);
    assert.equal(q.length, 500); assert.equal(JSON.parse(q[499]).name, 'Rina'); assert.equal(JSON.parse(q[0]).id, 'c_old1');

    const env2 = { ...ENV, TURNSTILE_SECRET: 'ts-secret' };
    const realF = globalThis.fetch;
    let verdict = false;
    globalThis.fetch = async (url, init) => {
      if (String(url).startsWith('https://challenges.cloudflare.com/')) {
        assert.equal(init.body.get('secret'), 'ts-secret'); assert.equal(init.body.get('response'), 'tok-1');
        assert.equal(init.body.has('remoteip'), false, 'IP tidak dikirim ke Turnstile');
        return Response.json({ success: verdict });
      }
      return realF(url, init);
    };
    globalThis.fetch = ((inner) => (url, init) => String(url).startsWith('https://challenges.cloudflare.com/') ? inner(url, init) : fake.stub(url, init))(globalThis.fetch);
    assert.equal((await handleComments(cPost(good()), env2, new Date(NOW.getTime() + 120000))).status, 403, 'tanpa token');
    assert.equal((await handleComments(cPost(good({ turnstileToken: 'tok-1' })), env2, new Date(NOW.getTime() + 240000))).status, 403, 'token ditolak');
    verdict = true;
    assert.equal((await handleComments(cPost(good({ turnstileToken: 'tok-1' })), env2, new Date(NOW.getTime() + 360000))).status, 202);

    globalThis.fetch = fake.stub;
    assert.equal((await handleComments(cPost(good()), { ...ENV, IP_HASH_SALT: '' }, NOW)).status, 503);
    fake.setDown(true);
    assert.equal((await handleComments(cPost(good()), ENV, new Date(NOW.getTime() + 9e6))).status, 503);
  } finally { teardown(); }
});

test('comments GET: hanya yang tersetujui, tanpa data teknis, urutan lama→baru, cache 60 dtk; slug tidak valid → 400', async () => {
  setup();
  try {
    fake.lists.set('cava:c:a-slug', [
      JSON.stringify({ id: 'c_aaaaaa', slug: 'a-slug', parentId: null, name: 'A', text: 'one', createdAt: 1, ipHash: 'secret-hash' }),
      'rusak{', JSON.stringify({ nope: true }),
      JSON.stringify({ id: 'c_bbbbbb', slug: 'a-slug', parentId: 'c_aaaaaa', name: 'B', text: 'two', createdAt: 2 }),
    ]);
    fake.lists.set(PENDING_KEY, [JSON.stringify({ id: 'c_pend01', slug: 'a-slug', name: 'P', text: 'pending', createdAt: 3 })]);
    const r = await handleComments(cGet('a-slug'), ENV, NOW);
    assert.equal(r.status, 200); assert.equal(r.headers.get('Cache-Control'), 'public, max-age=60');
    const body = await r.json();
    assert.deepEqual(body.comments.map((c) => c.id), ['c_aaaaaa', 'c_bbbbbb']);
    assert.deepEqual(Object.keys(body.comments[0]).sort(), ['createdAt', 'id', 'name', 'parentId', 'text']);
    assert.equal(JSON.stringify(body).includes('secret-hash'), false);
    assert.equal(JSON.stringify(body).includes('pending'), false);
    assert.deepEqual(await (await handleComments(cGet('sepi-slug'), ENV, NOW)).json(), { comments: [] });
    assert.equal((await handleComments(cGet('Bad Slug'), ENV, NOW)).status, 400);
    assert.equal((await handleComments(cGet(), ENV, NOW)).status, 400);
    const lr = fake.calls.find((c) => c[0] === 'LRANGE'); assert.deepEqual(lr, ['LRANGE', 'cava:c:a-slug', '-300', '-1']);
    fake.setDown(true);
    assert.equal((await handleComments(cGet('a-slug'), ENV, NOW)).status, 503);
    assert.equal((await handleComments(new Request('https://cava.example/api/comments', { method: 'DELETE' }), ENV, NOW)).status, 405);
  } finally { teardown(); }
});

test('router: /api/comments terhubung', async () => {
  setup();
  try {
    assert.equal((await worker.fetch(cGet('a-slug'), ENV)).status, 200);
    assert.equal((await worker.fetch(cPost(good()), ENV)).status, 202);
  } finally { teardown(); }
});
