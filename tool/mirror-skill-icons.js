#!/usr/bin/env node
/* tool/mirror-skill-icons.js — Cadangkan ikon skill/hero (static.wikia.nocookie.net) ke repo ikon (disajikan jsDelivr).

   Dijalankan oleh workflow .github/workflows/mirror-icons.yml (GitHub Actions punya akses internet), bukan saat build.
   Tanpa dependensi (hanya modul bawaan Node 18+).

   Yang dilakukan:
   1. Membaca semua URL ikon wikia di public/data/posts/*.json (ikon skill + ikon hero di tabel download).
   2. Mengunduh yang belum ada ke <out>/skill/<a>/<bb>/<Nama>.png (path meniru wikia; nama file dibersihkan supaya aman di Windows).
   3. Menulis tool/skill-icons-map.json: { "<url wikia>": "skill/a/bb/Nama.png" } HANYA untuk file yang benar-benar ada.
      build.js memakai peta ini; ikon yang tidak ada di peta tetap dimuat dari wikia seperti biasa.

   Aman diulang: file yang sudah ada tidak diunduh lagi. Unduhan gagal/bukan gambar dilewati (tidak masuk peta).

   Pemakaian:  node tool/mirror-skill-icons.js --out <folder-repo-ikon> [--posts public/data/posts] [--map tool/skill-icons-map.json]
                                                [--concurrency 6] [--max-total-mb 45] [--dry]
   Untuk uji lokal: env ICON_FETCH_HOST=http://127.0.0.1:PORT mengganti host wikia saat mengunduh. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WIKIA_PREFIX = 'https://static.wikia.nocookie.net/mobile-legends/images/';
const MAX_FILE_BYTES = 1.5 * 1024 * 1024;

function parseArgs(argv) {
  const a = { posts: 'public/data/posts', map: 'tool/skill-icons-map.json', out: '', concurrency: 6, maxTotalMb: 45, dry: false };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--dry') a.dry = true;
    else if (k === '--out') a.out = argv[++i];
    else if (k === '--posts') a.posts = argv[++i];
    else if (k === '--map') a.map = argv[++i];
    else if (k === '--concurrency') a.concurrency = Math.max(1, parseInt(argv[++i], 10) || 6);
    else if (k === '--max-total-mb') a.maxTotalMb = parseFloat(argv[++i]) || 45;
    else { console.error('Argumen tidak dikenal: ' + k); process.exit(1); }
  }
  if (!a.out && !a.dry) { console.error('Wajib: --out <folder repo ikon>'); process.exit(1); }
  return a;
}

function collectUrls(dir) {
  const urls = new Set();
  const walk = (o) => {
    if (typeof o === 'string') { if (o.indexOf(WIKIA_PREFIX) === 0) urls.add(o); }
    else if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === 'object') Object.keys(o).forEach((k) => walk(o[k]));
  };
  fs.readdirSync(dir).filter((f) => f.endsWith('.json')).forEach((f) => walk(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))));
  return Array.from(urls).sort();
}

/* "https://static.wikia.nocookie.net/mobile-legends/images/5/56/Nama.png[/revision/latest?cb=..]" -> "skill/5/56/Nama.png" */
function targetPath(url) {
  let p;
  try { p = new URL(url).pathname; } catch (e) { return null; }
  p = p.slice('/mobile-legends/images/'.length).split('/revision/')[0];
  const parts = p.split('/').filter(Boolean).map((s) => { try { return decodeURIComponent(s); } catch (e) { return s; } });
  if (!parts.length || parts.some((s) => s === '..' || s === '.')) return null;
  const file = parts.pop();
  const safeDirs = parts.map((s) => s.replace(/[^A-Za-z0-9._-]/g, '_'));
  let safeFile = file.replace(/[^A-Za-z0-9._()-]/g, '_');
  if (safeFile !== file) { // nama diubah -> tambahkan sidik pendek agar tetap unik
    const h = crypto.createHash('sha1').update(url.split('/revision/')[0]).digest('hex').slice(0, 6);
    const dot = safeFile.lastIndexOf('.');
    safeFile = dot > 0 ? safeFile.slice(0, dot) + '-' + h + safeFile.slice(dot) : safeFile + '-' + h;
  }
  if (!/\.(png|jpe?g|gif|webp)$/i.test(safeFile)) safeFile += '.png';
  return ['skill'].concat(safeDirs, [safeFile]).join('/');
}

function looksLikeImage(buf) {
  if (buf.length < 12) return false;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true; // PNG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true; // JPEG
  if (buf.slice(0, 4).toString('latin1') === 'GIF8') return true; // GIF
  if (buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP') return true; // WebP
  return false;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function download(url) {
  const host = process.env.ICON_FETCH_HOST;
  const real = host ? host.replace(/\/+$/, '') + url.slice('https://static.wikia.nocookie.net'.length) : url;
  let lastErr = 'unknown';
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(real, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HenzScript-IconMirror/1.0; +https://www.henzscript.com)', Accept: 'image/*' }, signal: AbortSignal.timeout(20000) });
      if (res.status === 404 || res.status === 403 || res.status === 410) return { error: 'HTTP ' + res.status };
      if (res.status === 429 || res.status >= 500) { lastErr = 'HTTP ' + res.status; await sleep(1000 * Math.pow(2, attempt)); continue; }
      if (!res.ok) return { error: 'HTTP ' + res.status };
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_FILE_BYTES) return { error: 'terlalu besar (' + buf.length + ' byte)' };
      if (!looksLikeImage(buf)) return { error: 'bukan gambar' };
      return { buf };
    } catch (e) {
      lastErr = e && e.message ? e.message : String(e);
      await sleep(1000 * Math.pow(2, attempt));
    }
  }
  return { error: lastErr };
}

function dirSize(dir) {
  let total = 0;
  if (!fs.existsSync(dir)) return 0;
  fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) total += dirSize(f); else total += fs.statSync(f).size;
  });
  return total;
}

async function main() {
  const args = parseArgs(process.argv);
  const urls = collectUrls(args.posts);
  if (!urls.length) { console.error('Tidak ada URL ikon wikia di ' + args.posts); process.exit(1); }

  const items = [];
  const skipped = [];
  urls.forEach((u) => { const t = targetPath(u); if (t) items.push({ url: u, rel: t }); else skipped.push(u); });
  const uniqueTargets = new Set(items.map((i) => i.rel));
  console.log('URL ikon unik: ' + urls.length + ' | file tujuan unik: ' + uniqueTargets.size + (skipped.length ? ' | dilewati (path tidak valid): ' + skipped.length : ''));
  if (args.dry) { console.log('(--dry) tidak mengunduh dan tidak menulis apa pun.'); return; }

  const outRoot = path.resolve(args.out);
  const maxBytes = args.maxTotalMb * 1024 * 1024;
  let total = dirSize(path.join(outRoot, 'skill'));
  console.log('Ukuran ikon yang sudah ada: ' + (total / 1048576).toFixed(1) + ' MB (batas ' + args.maxTotalMb + ' MB)');

  const have = new Set();   // rel yang sudah ada / berhasil diunduh
  const failed = [];
  let downloaded = 0, existed = 0, capped = 0;
  const todo = [];
  const seenTarget = new Set();
  items.forEach((it) => {
    const full = path.join(outRoot, it.rel);
    if (fs.existsSync(full) && fs.statSync(full).size > 0) { have.add(it.rel); existed++; }
    else if (!seenTarget.has(it.rel)) { seenTarget.add(it.rel); todo.push(it); }
  });
  existed = items.filter((it) => have.has(it.rel)).length;

  let idx = 0;
  async function worker() {
    while (idx < todo.length) {
      const it = todo[idx++];
      if (total >= maxBytes) { capped++; continue; }
      const r = await download(it.url);
      if (r.error) { failed.push({ url: it.url, why: r.error }); continue; }
      const full = path.join(outRoot, it.rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, r.buf);
      total += r.buf.length;
      have.add(it.rel);
      downloaded++;
      if (downloaded % 100 === 0) console.log('  ...' + downloaded + ' diunduh');
    }
  }
  await Promise.all(Array.from({ length: Math.min(args.concurrency, Math.max(1, todo.length)) }, worker));

  const map = {};
  items.forEach((it) => { if (have.has(it.rel)) map[it.url] = it.rel; });
  const keys = Object.keys(map).sort();
  const mapPath = path.resolve(args.map);
  fs.mkdirSync(path.dirname(mapPath), { recursive: true });
  fs.writeFileSync(mapPath, '{\n' + keys.map((k) => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(map[k])).join(',\n') + '\n}\n', 'utf8');

  console.log('Selesai. Diunduh baru: ' + downloaded + ' | sudah ada: ' + existed + ' | gagal: ' + failed.length + (capped ? ' | tidak diunduh karena batas ukuran: ' + capped : ''));
  console.log('Peta: ' + keys.length + ' URL -> ' + args.map + ' | total ikon: ' + (total / 1048576).toFixed(1) + ' MB');
  failed.slice(0, 15).forEach((f) => console.log('  GAGAL: ' + f.why + ' — ' + f.url));
  if (failed.length > 15) console.log('  ...dan ' + (failed.length - 15) + ' lainnya');
  if (capped) console.log('PERINGATAN: batas ukuran tercapai. Naikkan --max-total-mb hanya jika yakin repo ikon masih di bawah batas jsDelivr (±50 MB).');
}

main().catch((e) => { console.error('Gagal:', e && e.stack ? e.stack : e); process.exit(1); });
