'use strict';
// Uji otomatis fondasi build. Jalankan: npm test  (node --test dev/tests.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const B = require('../build.js');

const ROOT = path.join(__dirname, '..');
const mkRef = () => ({
  categories: new Set(['news', 'reviews', 'guides', 'recommendations']),
  platforms: new Set(['mobile', 'pc', 'console']),
  tags: new Set(['rpg', 'ps5', 'moba']),
  authors: new Set(['editors']),
  reserved: new Set(['news', 'tag', 'index']),
  specials: new Set([]),
  slugs: new Set(),
  ids: new Set(),
});
const good = () => ({
  id: '2026-10-09-sample-article', slug: 'sample-article', status: 'published',
  title: 'Sample Article Title',
  excerpt: 'A sample summary that is long enough to satisfy the minimum of eighty characters in the build validation.',
  category: 'news', platform: 'mobile', tags: ['rpg'], author: 'editors',
  publishedAt: '2026-10-09T08:30:00+07:00', updatedAt: '2026-10-09T09:00:00+07:00',
  thumbnail: { src: '2026/10/sample-a1b2c3d4-1200.webp', alt: 'Description', credit: 'Source', width: 1200, height: 675 },
  body: '<p>Body.</p>', seo: { title: '', description: '', ogImage: '' }, flags: { featured: false, special: '' },
});
const check = (mut, file = 'sample-article.json') => {
  const a = good(); mut(a);
  return B.validateArticle(a, file, mkRef());
};
const hasErr = (r, re) => r.errors.some((e) => re.test(e));

// ───────── template ─────────
test('render: escape, raw, partial, nested, null', () => {
  const load = (n) => ({ a: '<b>{{x}}</b>', b: '[{{> a}}]' }[n]);
  assert.equal(B.render('{{x}}', { x: '<&"\'>' }), '&lt;&amp;&quot;&#39;&gt;');
  assert.equal(B.render('{{{x}}}', { x: '<i>' }), '<i>');
  assert.equal(B.render('{{> b}}', { x: 'k' }, { loadPartial: load }), '[<b>k</b>]');
  assert.equal(B.render('a{{n}}b', { n: null }), 'ab');
  assert.equal(B.render('{{o.p}}', { o: { p: 'ok' } }), 'ok');
});
test('render: variabel hilang → galat; tidak ada injeksi placeholder dari konten', () => {
  assert.throws(() => B.render('{{nope}}', {}), /tidak ada/);
  assert.throws(() => B.render('{{o.q}}', { o: {} }), /tidak ada/);
  assert.equal(B.render('{{{body}}}|{{title}}', { body: '{{title}} {{> x}}', title: 'T' }), '{{title}} {{> x}}|T');
  assert.throws(() => B.render('{{> r}}', {}, { loadPartial: () => '{{> r}}' }), /bersarang terlalu dalam/);
});

// ───────── util ─────────
test('formatDate: format Inggris + zona Asia/Jakarta', () => {
  assert.equal(B.formatDate('2026-10-09T08:30:00+07:00'), 'Oct 9, 2026');
  assert.equal(B.formatDate('2026-05-01T00:30:00+07:00'), 'May 1, 2026');
  assert.equal(B.formatDate('2026-08-17T23:30:00Z'), 'Aug 18, 2026');
  assert.equal(B.formatDate('2026-12-31T10:00:00+07:00'), 'Dec 31, 2026');
});
test('readingTime: kata ÷ 200 dibulatkan ke atas, minimum 1, tag dibuang', () => {
  const w = (n) => '<p>' + Array(n).fill('word').join(' ') + '</p>';
  assert.equal(B.readingTime(''), 1);
  assert.equal(B.readingTime(w(200)), 1);
  assert.equal(B.readingTime(w(201)), 2);
  assert.equal(B.readingTime(w(1000)), 5);
  assert.equal(B.readingTime('<img src="x" alt="a word word">'), 1);
});

// ───────── sanitizer ─────────
test('sanitizeBody: membuang skrip, handler, skema berbahaya, iframe', () => {
  const s = B.sanitizeBody('<p onclick="x()">a</p><script>alert(1)</script><iframe src="https://e.com"></iframe><a href="javascript:alert(1)">l</a>');
  assert.ok(!/script|onclick|iframe|javascript:/i.test(s), s);
  assert.ok(s.includes('<p>a</p>'));
});
test('sanitizeBody: tautan luar mendapat rel aman; target _blank ikut aman', () => {
  const s = B.sanitizeBody('<a href="https://e.com">x</a><a href="/lokal" target="_blank">y</a><a href="/z" target="_top">z</a>');
  assert.match(s, /href="https:\/\/e\.com"[^>]*rel="noopener noreferrer"/);
  assert.match(s, /href="\/lokal"[^>]*target="_blank"[^>]*rel="noopener noreferrer"|rel="noopener noreferrer"[^>]*target="_blank"/);
  assert.ok(!/target="_top"/.test(s));
});
test('sanitizeBody: gaya span dibatasi; div[data-slot] dan img alt dipertahankan', () => {
  const ok = B.sanitizeBody('<span style="color:#ff0000;font-size:18px;font-family:\'Source Serif 4\'">a</span>');
  assert.match(ok, /color:\s*#ff0000/); assert.match(ok, /font-size:\s*18px/);
  const bad = B.sanitizeBody('<span style="position:fixed;font-size:15px;color:red">a</span>');
  assert.ok(!/position|15px/.test(bad), bad);
  assert.match(B.sanitizeBody('<div data-slot="baca-juga"></div>'), /<div data-slot="baca-juga"><\/div>/);
  assert.match(B.sanitizeBody('<img src="a.webp" alt="deskripsi" width="800" height="450" loading="lazy" onerror="x()">'), /alt="deskripsi"/);
  assert.ok(!/onerror/.test(B.sanitizeBody('<img src="a.webp" alt="d" onerror="x()">')));
});

// ───────── validasi artikel ─────────
test('validateArticle: artikel sah lolos tanpa galat', () => {
  const r = check(() => {});
  assert.deepEqual(r.errors, []);
});
test('validateArticle: slug', () => {
  assert.ok(hasErr(check((a) => { a.slug = 'Salah_Slug'; }, 'Salah_Slug.json'), /slug tidak valid/));
  assert.ok(hasErr(check((a) => { a.slug = 'other'; a.id = '2026-10-09-other'; }), /tidak sama dengan nama file/));
  assert.ok(hasErr(check((a) => { a.slug = 'news'; a.id = '2026-10-09-news'; }, 'news.json'), /reserved/));
  assert.ok(hasErr(check((a) => { a.slug = 'a'.repeat(81); }, 'x.json'), /80 karakter/));
  const ref = mkRef(); B.validateArticle(good(), 'sample-article.json', ref);
  assert.ok(B.validateArticle(good(), 'sample-article.json', ref).errors.some((e) => /ganda/.test(e)));
});
test('validateArticle: judul, excerpt, taksonomi', () => {
  assert.ok(hasErr(check((a) => { a.title = 'x'.repeat(111); }), /maks\. 110/));
  assert.ok(check((a) => { a.title = 'x'.repeat(80); }).warnings.length === 1);
  assert.ok(hasErr(check((a) => { a.excerpt = 'pendek'; }), /excerpt/));
  assert.ok(hasErr(check((a) => { a.excerpt = 'x'.repeat(201); }), /excerpt/));
  assert.ok(hasErr(check((a) => { a.category = 'News'; }), /category/));
  assert.ok(hasErr(check((a) => { a.category = 'mobile'; }), /category/), 'platform bukan kategori');
  assert.ok(hasErr(check((a) => { a.platform = 'Mobile'; }), /platform/));
  assert.ok(hasErr(check((a) => { a.platform = 'news'; }), /platform/), 'kategori bukan platform');
  assert.ok(hasErr(check((a) => { delete a.platform; }), /platform/));
  assert.ok(hasErr(check((a) => { a.tags = []; }), /tags harus 1–8/));
  assert.ok(hasErr(check((a) => { a.tags = Array(9).fill('rpg'); }), /tags harus 1–8/));
  assert.ok(hasErr(check((a) => { a.tags = ['rpg', 'rpg']; }), /duplikat/));
  assert.ok(hasErr(check((a) => { a.tags = ['no-such-tag']; }), /tidak ada di tags/));
  assert.ok(hasErr(check((a) => { a.author = 'x'; }), /author/));
  assert.ok(hasErr(check((a) => { a.status = 'live'; }), /status/));
});
test('validateArticle: field skema lama (type, quiz) ditolak dengan pesan jelas', () => {
  assert.ok(hasErr(check((a) => { a.type = 'news'; }), /field "type" sudah dihapus.*category.*platform/));
  assert.ok(hasErr(check((a) => { a.quiz = null; }), /field "quiz" sudah dihapus/));
  assert.ok(hasErr(check((a) => { a.type = 'quiz'; a.quiz = { mode: 'trivia' }; }), /field "type"/));
});
test('validateArticle: tanggal dan thumbnail', () => {
  assert.ok(hasErr(check((a) => { a.publishedAt = '2026-10-09T08:30:00'; }), /publishedAt/));
  assert.ok(hasErr(check((a) => { a.publishedAt = '2026-13-40T08:30:00+07:00'; }), /publishedAt/));
  assert.ok(hasErr(check((a) => { a.updatedAt = 'yesterday'; }), /updatedAt/));
  assert.ok(hasErr(check((a) => { a.thumbnail.width = 1000; a.thumbnail.height = 563; }), /< 1200/));
  assert.ok(hasErr(check((a) => { a.thumbnail.height = 1200; }), /rasio/));
  assert.deepEqual(check((a) => { a.thumbnail.height = 700; }).errors, []); // 1200x700 (±5% dari 16:9)
  assert.ok(hasErr(check((a) => { a.thumbnail.alt = ' '; }), /alt/));
  assert.ok(hasErr(check((a) => { delete a.thumbnail.credit; }), /credit/));
  assert.ok(hasErr(check((a) => { a.thumbnail.src = 'https://x.com/a.webp'; }), /path relatif/));
  assert.ok(hasErr(check((a) => { a.thumbnail.src = '/a.webp'; }), /path relatif/));
  assert.ok(hasErr(check((a) => { a.thumbnail = null; }), /thumbnail wajib/));
});
test('validateArticle: body', () => {
  assert.ok(hasErr(check((a) => { a.body = ''; }), /body wajib/));
  assert.ok(hasErr(check((a) => { a.body = '<p>x</p><img src="a.webp">'; }), /tanpa alt/));
  assert.ok(hasErr(check((a) => { a.body = '<p>x</p><img src="a.webp" alt="">'; }), /tanpa alt/));
  assert.deepEqual(check((a) => { a.body = '<p>x</p><img src="a.webp" alt="ok">'; }).errors, []);
  assert.ok(check((a) => { a.body = '<p>x</p><script>1</script>'; }).warnings.length === 1);
});

// ───────── taksonomi, seleksi, anggaran ─────────
test('validateTaxonomy: id/slug ganda dan format', () => {
  const e = B.validateTaxonomy([{ id: 'a', slug: 'a', name: 'A' }, { id: 'a', slug: 'A b', name: '' }], 't');
  assert.ok(e.some((x) => /id "a" ganda/.test(x)) && e.some((x) => /slug harus/.test(x)) && e.some((x) => /name wajib/.test(x)));
  assert.deepEqual(B.validateTaxonomy([{ id: 'a', slug: 'a', name: 'A' }], 't'), []);
});
test('selectPublished: draft & jadwal masa depan keluar; scheduled lewat masuk; urut terbaru', () => {
  const mk = (slug, status, publishedAt) => ({ slug, status, publishedAt });
  const now = new Date('2026-10-09T12:00:00+07:00');
  const r = B.selectPublished([
    mk('lama', 'published', '2026-10-01T08:00:00+07:00'),
    mk('draf', 'draft', '2026-10-02T08:00:00+07:00'),
    mk('depan', 'published', '2026-10-10T08:00:00+07:00'),
    mk('jadwal-lewat', 'scheduled', '2026-10-08T08:00:00+07:00'),
    mk('jadwal-depan', 'scheduled', '2026-10-09T13:00:00+07:00'),
    mk('baru', 'published', '2026-10-09T11:00:00+07:00'),
  ], now);
  assert.deepEqual(r.map((a) => a.slug), ['baru', 'jadwal-lewat', 'lama']);
});
test('budget: hitung file + folder dan status ambang (total)', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cava-bud-'));
  for (let i = 0; i < 12; i++) fs.writeFileSync(path.join(d, `f${i}.html`), 'x');
  fs.mkdirSync(path.join(d, 'sub', 'deep'), { recursive: true });
  fs.writeFileSync(path.join(d, 'sub', 'a.css'), 'yy');
  fs.writeFileSync(path.join(d, 'sub', 'deep', 'b.css'), 'z');
  const lim = (warnAt, failAt, maxFiles) => ({ warnAt, failAt, maxFiles });
  const r = B.budget(d, lim(20, 30, 40));
  assert.deepEqual([r.count, r.dirs, r.total, r.bytes, r.status], [14, 2, 16, 15, 'ok']);
  assert.equal(B.budget(d, lim(16, 30, 40)).status, 'warn');
  assert.equal(B.budget(d, lim(5, 16, 40)).status, 'fail');
  assert.equal(B.budget(d, lim(17, 30, 40)).status, 'ok');
  fs.rmSync(d, { recursive: true, force: true });
});
test('parseArgs', () => {
  assert.deepEqual(B.parseArgs([]), { samples: false, now: null });
  assert.equal(B.parseArgs(['--samples']).samples, true);
  assert.equal(B.parseArgs(['--now=2026-10-09T08:00:00+07:00']).now.toISOString(), '2026-10-09T01:00:00.000Z');
  assert.throws(() => B.parseArgs(['--now=xx']), /tidak valid/);
  assert.throws(() => B.parseArgs(['--x']), /tidak dikenal/);
});

// ───────── integrasi: build sungguhan ─────────
test('integrasi: build --samples menghasilkan keluaran yang benar', () => {
  const out = execFileSync('node', ['build.js', '--samples', '--now=2026-10-09T12:00:00+07:00'], { cwd: ROOT, encoding: 'utf8' });
  assert.match(out, /21 artikel terbit \(2 dilewati/);
  const dist = path.join(ROOT, 'dist');
  for (const f of ['index.html', '404.html', '_headers', '_redirects', 'new-moba-season-fresh-heroes-and-map.html', 'dev-img/sample/mobile-1200.webp']) {
    assert.ok(fs.existsSync(path.join(dist, f)), `harus ada: ${f}`);
  }
  assert.ok(!fs.existsSync(path.join(dist, 'sample-draft-article-must-not-publish.html')), 'draft tidak boleh terbit');
  assert.ok(!fs.existsSync(path.join(dist, 'sample-scheduled-future-article.html')), 'jadwal masa depan tidak boleh terbit');
  const html = fs.readFileSync(path.join(dist, 'new-moba-season-fresh-heroes-and-map.html'), 'utf8');
  assert.match(html, /<h1 class="article-title" data-pagefind-meta="title">New Season of a Popular MOBA Brings Fresh Heroes and a New Map<\/h1>/);
  assert.match(html, /Oct 8, 2026/);
  assert.match(html, /\d+ min read/);
  assert.match(html, /<li><a href="\/news">News<\/a><\/li>\s*<li><a href="\/news\/mobile">Mobile<\/a><\/li>/, 'breadcrumb: Home > Category > Platform');
  assert.ok(!/\{\{/.test(html) && !/\{\{/.test(fs.readFileSync(path.join(dist, 'index.html'), 'utf8')), 'tidak ada placeholder tersisa');
});
test('integrasi: build tanpa --samples tidak memuat data contoh', () => {
  const out = execFileSync('node', ['build.js', '--now=2026-10-09T12:00:00+07:00'], { cwd: ROOT, encoding: 'utf8' });
  assert.match(out, /0 artikel terbit/);
  assert.ok(!fs.existsSync(path.join(ROOT, 'dist', 'dev-img')));
});
test('integrasi: artikel tidak valid → build gagal (exit 1) dan menyebut file', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cava-bad-'));
  for (const e of ['build.js', 'site.config.json', 'package.json']) fs.copyFileSync(path.join(ROOT, e), path.join(tmp, e));
  fs.cpSync(path.join(ROOT, 'public'), path.join(tmp, 'public'), { recursive: true });
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(tmp, 'node_modules'), 'dir');
  const bad = good(); bad.slug = 'broken'; bad.id = '2026-10-09-broken'; bad.category = 'no-such-category'; bad.thumbnail.alt = '';
  fs.writeFileSync(path.join(tmp, 'public', 'data', 'articles', 'broken.json'), JSON.stringify(bad));
  const r = spawnSync('node', ['build.js'], { cwd: tmp, encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /\[broken\.json\] category "no-such-category"/);
  assert.match(r.stderr, /\[broken\.json\] thumbnail\.alt wajib/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

// ════════════════════════ TAHAP 1B ════════════════════════
const zlib = require('zlib');
const C = require('./check-dist.js');

const GOOD_PAGE = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>T</title>
<meta name="description" content="d"><link rel="canonical" href="https://x/"></head><body>
<a class="skip-link" href="#main">Lewati</a><header class="site-header"><nav aria-label="Menu utama"><a href="/">Beranda</a></nav></header>
<main id="main"><h1>Judul</h1><h2>Sub</h2><button type="button" aria-expanded="false" aria-controls="p">Buka</button><div id="p"></div></main><footer><nav aria-label="Footer"><a href="/about">About</a></nav></footer></body></html>`;
const probs = (html, o) => C.checkHtml(html, 'x.html', o).problems;
const has = (arr, re) => arr.some((p) => re.test(p));

test('check-dist: halaman sah tidak menghasilkan masalah', () => {
  assert.deepEqual(probs(GOOD_PAGE), []);
});
test('check-dist: mendeteksi pelanggaran struktur & aksesibilitas', () => {
  const bad = (from, to) => probs(GOOD_PAGE.replace(from, to));
  assert.ok(has(bad('<html lang="id">', '<html>'), /lang/));
  assert.ok(has(bad('<title>T</title>', '<title></title>'), /title/));
  assert.ok(has(bad('<h1>Judul</h1>', '<h1>A</h1><h1>B</h1>'), /tepat satu <h1>/));
  assert.ok(has(bad('<h2>Sub</h2>', '<h3>Lompat</h3>'), /lompatan heading/));
  assert.ok(has(bad('<div id="p"></div>', '<div id="p"></div><div id="p"></div>'), /id ganda/));
  assert.ok(has(bad('aria-controls="p"', 'aria-controls="zzz"'), /aria-controls="zzz"/));
  assert.ok(has(bad('type="button" ', ''), /tanpa atribut type/));
  assert.ok(has(bad('<div id="p"></div>', '<img src="/a.webp" width="1" height="1">'), /tanpa atribut alt/));
  assert.ok(has(bad('<div id="p"></div>', '<img src="/a.webp" alt="x">'), /width\/height/));
  assert.ok(has(bad('<div id="p"></div>', '<a href="/z"></a>'), /tanpa nama aksesibel/));
  assert.ok(has(bad('<div id="p"></div>', '<div onclick="x()"></div>'), /atribut inline onclick/));
  assert.ok(has(bad('<div id="p"></div>', '<a href="https://e.com" target="_blank">e</a>'), /rel=noopener/));
  assert.ok(has(bad('<div id="p"></div>', '<svg></svg>'), /svg/));
  assert.ok(has(bad('<div id="p"></div>', '<script>alert(1)</script>'), /script/));
  assert.ok(has(bad('<main id="main">', '<main>'), /id="main"/));
  assert.ok(has(bad('<a class="skip-link" href="#main">Lewati</a>', ''), /skip link/));
  assert.ok(has(bad('aria-label="Menu utama"', ''), /aria-label/));
  assert.ok(has(bad('<meta name="description" content="d">', ''), /description/));
  assert.ok(has(bad('<link rel="canonical" href="https://x/">', ''), /canonical/));
  assert.ok(has(bad('<a href="/about">About</a>', '<a href="#nope">x</a>'), /anchor #nope/));
});
test('check-dist: noindex membebaskan description/canonical; JSON-LD inline diizinkan', () => {
  const noidx = GOOD_PAGE.replace('<meta name="description" content="d">', '<meta name="robots" content="noindex">').replace('<link rel="canonical" href="https://x/">', '');
  assert.deepEqual(probs(noidx), []);
  assert.deepEqual(probs(GOOD_PAGE.replace('</main>', '<script type="application/ld+json">{}</script></main>')), []);
});
test('check-dist: tautan internal, aset, dan URL tertunda', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cava-dist-'));
  const w = (f, c) => { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), c); };
  const page = (links) => GOOD_PAGE.replace('<div id="p"></div>', links.map((l) => `<a href="${l}">tautan</a>`).join(''))
    .replace('</head>', '<link rel="stylesheet" href="/css/style.css"><script src="/js/main.js" defer></script></head>');
  w('index.html', page(['/about', '/kategori/pc', '/hilang', '/about/', '/about.html', 'relatif']));
  w('about.html', page(['/']));
  w('css/style.css', 'a{background:url(/fonts/ada.woff2)} b{background:url(/fonts/tidak-ada.woff2)}');
  w('fonts/ada.woff2', 'x');
  const r = C.checkDist(d, { pending: ['/kategori/'] });
  const txt = r.problems.join('\n');
  assert.match(txt, /tautan rusak: \/hilang/);
  assert.match(txt, /tidak kanonis.*\/about\//);
  assert.match(txt, /tidak kanonis.*\/about\.html/);
  assert.match(txt, /tautan internal relatif tidak diizinkan: relatif/);
  assert.match(txt, /aset tidak ditemukan: \/js\/main\.js/);
  assert.match(txt, /url\(\) tidak ditemukan: \/fonts\/tidak-ada\.woff2/);
  assert.ok(!/kategori\/pc/.test(txt), 'URL tertunda tidak dihitung sebagai masalah');
  assert.deepEqual([...r.pending.keys()], ['/kategori/pc']);
  // semantik pending: awalan "/" vs URL persis + turunannya
  assert.ok(C.matchesPending('/news', '/news') && C.matchesPending('/news/pc', '/news') && C.matchesPending('/tag/rpg', '/tag/'));
  assert.ok(!C.matchesPending('/newsletter', '/news'), '"/news" tidak boleh menyamarkan "/newsletter"');
  assert.ok(!C.matchesPending('/latest-news', '/latest') && !C.matchesPending('/tag', '/tag/'));
  assert.ok(C.urlExists(d, '/about') && C.urlExists(d, '/') && C.urlExists(d, '/fonts/ada.woff2') && !C.urlExists(d, '/nope'));
  fs.rmSync(d, { recursive: true, force: true });
});

// ───────── layout & halaman statis ─────────
test('breadcrumb: escape, aria-current, item terakhir tanpa tautan', () => {
  const h = B.breadcrumbHtml([{ name: 'Home', url: '/' }, { name: 'A <b> & "C"' }]);
  assert.match(h, /<a href="\/">Home<\/a>/);
  assert.match(h, /<span aria-current="page">A &lt;b&gt; &amp; &quot;C&quot;<\/span>/);
});
test('panelNavHtml: akordeon 4 kategori × (All + 3 platform), selalu tertutup, aria-current, escape', () => {
  const site = {
    categories: [{ id: 'news', name: 'News', slug: 'news' }, { id: 'reviews', name: 'Re<views>', slug: 'reviews' }],
    platforms: [{ id: 'mobile', name: 'Mobile', slug: 'mobile' }, { id: 'pc', name: 'PC', slug: 'pc' }, { id: 'console', name: 'Console', slug: 'console' }],
  };
  const none = B.panelNavHtml(site, {});
  assert.equal((none.match(/class="acc-item"/g) || []).length, 2);
  assert.equal((none.match(/aria-expanded="false"/g) || []).length, 2);
  assert.equal((none.match(/<div class="acc-panel">/g) || []).length, 2, 'pembungkus animasi per kategori');
  assert.ok(!/ hidden>|is-open/.test(none), 'tanpa atribut hidden dan tanpa keadaan terbuka bawaan');
  assert.ok(!/aria-current/.test(none));
  assert.match(none, /id="acc-btn-news" aria-expanded="false" aria-controls="acc-news"/);
  assert.match(none, /<a href="\/news">All News<\/a>/);
  assert.deepEqual([...none.matchAll(/href="(\/news\/[a-z]+)"/g)].map((m) => m[1]), ['/news/mobile', '/news/pc', '/news/console']);
  assert.match(none, /Re&lt;views&gt;/); assert.ok(!/Re<views>/.test(none));
  // kategori aktif TIDAK lagi membuka akordeon (auto-open dihapus 2026-10-13)
  for (const o of [{ category: 'reviews' }, { category: 'reviews', platform: 'pc' }, { category: 'news', current: true }]) {
    const h = B.panelNavHtml(site, o);
    assert.equal((h.match(/aria-expanded="false"/g) || []).length, 2, JSON.stringify(o));
    assert.ok(!/aria-expanded="true"|is-open/.test(h), JSON.stringify(o));
  }
  assert.ok(!/aria-current/.test(B.panelNavHtml(site, { category: 'reviews' })), 'halaman artikel: bukan aria-current');
  const allPage = B.panelNavHtml(site, { category: 'reviews', current: true });
  assert.match(allPage, /<a href="\/reviews" aria-current="page">All Re/);
  assert.equal((allPage.match(/aria-current/g) || []).length, 1);
  const platPage = B.panelNavHtml(site, { category: 'news', platform: 'pc', current: true });
  assert.match(platPage, /<a href="\/news\/pc" aria-current="page">PC<\/a>/);
  assert.equal((platPage.match(/aria-current/g) || []).length, 1);
  assert.ok(!/<a href="\/news" aria-current/.test(platPage));
  assert.ok(!/reviews\/pc" aria-current/.test(platPage));
});
test('searchUi: kosong bila fitur mati; bila aktif: pil header + kolom cari panel, placeholder, GET /search?q', () => {
  const off = B.searchUi({ features: { search: false } });
  assert.deepEqual(off, { button: '', panel: '' });
  const on = B.searchUi({ features: { search: true } });
  assert.match(on.button, /<button type="button" class="icon-btn" id="search-toggle" aria-expanded="false" aria-controls="search-pill" aria-label="Search">/);
  assert.match(on.button, /<form class="search-pill" id="search-pill" role="search" action="\/search" method="get" hidden>/);
  assert.match(on.button, /<input type="search" name="q" placeholder="Search games, news, topics\.\.\."/);
  assert.match(on.button, /aria-label="Close search"/); assert.match(on.button, /type="submit"[^>]*aria-label="Submit search"/);
  assert.match(on.panel, /<form class="panel-search" role="search" action="\/search" method="get">/);
  assert.match(on.panel, /<input type="search" name="q" placeholder="Search games, news, topics\.\.\."/);
  assert.ok(on.button.indexOf('id="search-toggle"') < on.button.indexOf('id="search-pill"'));
});
test('canonicalUrl: tanpa trailing slash kecuali root', () => {
  const cfg = { siteUrl: 'https://x.id/' };
  assert.equal(B.canonicalUrl(cfg, '/'), 'https://x.id/');
  assert.equal(B.canonicalUrl(cfg, '/about'), 'https://x.id/about');
  assert.equal(B.canonicalUrl(cfg, '/about/'), 'https://x.id/about');
});
test('validatePage: aturan slug reserved, panjang, body, alt', () => {
  const ref = () => ({ reserved: new Set(['about']), pageSlugs: new Set() });
  const ok = () => ({ slug: 'about', title: 'About', description: 'd'.repeat(60), body: '<p>x</p>', draft: false });
  const v = (m, file = 'about.json') => { const p = ok(); m(p); return B.validatePage(p, file, ref()); };
  assert.deepEqual(v(() => {}).errors, []);
  assert.ok(hasErr(v((p) => { p.slug = 'other'; }, 'other.json'), /reservedSlugs/));
  assert.ok(hasErr(v((p) => { p.slug = 'other'; }), /tidak sama dengan nama file/));
  assert.ok(hasErr(v((p) => { p.description = 'short'; }), /description/));
  assert.ok(hasErr(v((p) => { p.title = ''; }), /title/));
  assert.ok(hasErr(v((p) => { p.body = ''; }), /body wajib/));
  assert.ok(hasErr(v((p) => { p.body = '<img src="a.webp">'; }), /alt/));
  assert.ok(hasErr(v((p) => { p.draft = 'yes'; }), /draft/));
  assert.equal(v((p) => { p.body = '<p>[FILL: a] [FILL: b]</p>'; p.draft = true; }).warnings.length, 2);
  const r = ref(); B.validatePage(ok(), 'about.json', r);
  assert.ok(B.validatePage(ok(), 'about.json', r).errors.some((e) => /ganda/.test(e)));
});

// ───────── token desain & anggaran ─────────
function lum(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
test('token CSS: sama dengan 11_DESIGN_SYSTEM.md dan memenuhi kontras WCAG', () => {
  const css = fs.readFileSync(path.join(ROOT, 'public/css/style.css'), 'utf8');
  const t = {};
  for (const m of css.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)) t[m[1]] = m[2].toLowerCase();
  assert.deepEqual(t, {
    ink: '#0f1115', paper: '#ffffff', surface: '#f4f4f1', muted: '#5a606b', line: '#e2e4e8', accent: '#5b2ee6',
    'accent-hover': '#4520b8', 'accent-on-dark': '#b9a6ff', 'muted-on-dark': '#a3a9b5', highlight: '#d6ff3d', danger: '#c62828',
  });
  const need = [['ink', 'paper'], ['muted', 'paper'], ['muted', 'surface'], ['accent', 'paper'], ['accent', 'surface'], ['paper', 'accent'],
    ['accent-hover', 'paper'], ['accent-on-dark', 'ink'], ['muted-on-dark', 'ink'], ['ink', 'highlight'], ['danger', 'paper'], ['paper', 'ink']];
  for (const [fg, bg] of need) assert.ok(contrast(t[fg], t[bg]) >= 4.5, `${fg} di ${bg} = ${contrast(t[fg], t[bg]).toFixed(2)}`);
  assert.ok(contrast(t.accent, t.paper) > 7.0 && contrast(t.ink, t.paper) > 18.8); // sesuai angka di dokumen
});

// ───────── integrasi 1B ─────────
const NOW = '--now=2026-10-09T12:00:00+07:00';
const PENDING = [];   // sejak 1E semua halaman daftar ada; tidak ada lagi tautan tertunda
const runBuild = (...a) => execFileSync('node', ['build.js', ...a], { cwd: ROOT, encoding: 'utf8' });
const D = (...p) => path.join(ROOT, 'dist', ...p);

test('integrasi 1B: build --samples lolos pemeriksa dist (tanpa tautan tertunda)', () => {
  runBuild('--samples', NOW);
  const r = C.checkDist(path.join(ROOT, 'dist'), { pending: PENDING });
  assert.deepEqual(r.problems, []);
  assert.equal(r.pending.size, 0, 'semua halaman daftar sudah ada: tidak ada tautan tertunda');
});
test('integrasi 1B: halaman statis, draf noindex + banner, 404 noindex', () => {
  runBuild('--samples', NOW);
  for (const s of ['about', 'contact', 'terms', 'privacy', 'accessibility']) assert.ok(fs.existsSync(D(`${s}.html`)), s);
  assert.ok(!fs.existsSync(D('pedoman-media-siber.html')), 'halaman Pedoman Media Siber sudah dihapus');
  const about = fs.readFileSync(D('about.html'), 'utf8');
  assert.match(about, /<meta name="robots" content="max-image-preview:large">/);
  assert.match(about, /<link rel="canonical" href="https:\/\/cava-games\.example\/about">/);
  assert.ok(!/class="notice"/.test(about));
  assert.match(about, /<title>About Us — Cava Games<\/title>/);
  const contact = fs.readFileSync(D('contact.html'), 'utf8');
  assert.match(contact, /<meta name="robots" content="noindex,follow">/);
  assert.match(contact, /class="notice" role="note"/);
  assert.match(contact, /\[FILL: editorial email address\]/);
  assert.match(fs.readFileSync(D('404.html'), 'utf8'), /<meta name="robots" content="noindex">/);
  for (const f of ['about', 'contact', '404']) assert.ok(!/\{\{/.test(fs.readFileSync(D(`${f}.html`), 'utf8')), `placeholder tersisa di ${f}`);
  // breadcrumb halaman statis: Home > judul (judul sebagai halaman saat ini)
  assert.match(about, /<li><a href="\/">Home<\/a><\/li>\s*<li><span aria-current="page">About Us<\/span><\/li>/);
  // footer: 3 blok + hak cipta tahun dari --now
  assert.equal((about.match(/data-footer-block/g) || []).length, 3);
  assert.match(about, /&copy; 2026 Cava Games\. All rights reserved\./);
});
test('integrasi 1B: font berhash, preload cocok, CSS/JS valid dan sesuai anggaran', () => {
  runBuild('--samples', NOW);
  const fonts = fs.readdirSync(D('fonts')).filter((f) => f.endsWith('.woff2'));
  assert.equal(fonts.length, 3);
  for (const f of fonts) assert.match(f, /\.[0-9a-f]{8}\.woff2$/);
  const css = fs.readFileSync(D('css', 'style.css'), 'utf8');
  for (const f of fonts) assert.ok(css.includes(`/fonts/${f}`), `CSS harus merujuk ${f}`);
  assert.ok(!/\/fonts\/[a-z0-9-]+\.woff2/.test(css.replace(/\.[0-9a-f]{8}\.woff2/g, '')), 'tidak boleh ada URL font tanpa hash');
  const page = fs.readFileSync(D('about.html'), 'utf8');
  const pre = page.match(/<link rel="preload" href="([^"]+)" as="font" type="font\/woff2" crossorigin>/);
  assert.ok(pre && pre[1].includes('plus-jakarta-sans') && !pre[1].includes('italic') && fs.existsSync(D(pre[1].slice(1))));
  assert.equal((page.match(/rel="preload"/g) || []).length, 1, 'hanya font judul yang dipreload');
  // JS hasil minify tetap sintaks valid
  execFileSync('node', ['-c', D('js', 'main.js')]);
  const gz = (f) => zlib.gzipSync(fs.readFileSync(f)).length;
  assert.ok(gz(D('css', 'style.css')) <= 40 * 1024, 'CSS gzip ≤ 40 KB');
  assert.ok(gz(D('js', 'main.js')) <= 60 * 1024, 'JS gzip ≤ 60 KB');
  assert.ok(!/\/\*|\n\s*\n/.test(css), 'CSS harus terminify');
});
test('integrasi 1B: build deterministik bila --now sama (diff dist kosong)', () => {
  const snap = () => {
    const out = {};
    (function walk(d, rel = '') { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); const r = rel + '/' + e.name; if (e.isDirectory()) walk(p, r); else out[r] = require('crypto').createHash('sha1').update(fs.readFileSync(p)).digest('hex'); } })(path.join(ROOT, 'dist'));
    return out;
  };
  runBuild('--samples', NOW); const a = snap();
  runBuild('--samples', NOW); const b = snap();
  assert.deepEqual(a, b);
});
test('integrasi 1B: pesan galat jelas untuk font/CSS/preload yang salah', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cava-font-'));
  for (const e of ['build.js', 'site.config.json', 'package.json']) fs.copyFileSync(path.join(ROOT, e), path.join(tmp, e));
  fs.cpSync(path.join(ROOT, 'public'), path.join(tmp, 'public'), { recursive: true });
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(tmp, 'node_modules'), 'dir');
  const css = path.join(tmp, 'public', 'css', 'style.css');
  fs.writeFileSync(css, fs.readFileSync(css, 'utf8') + '\n.x{background:url("/fonts/ghaib.woff2")}');
  let r = spawnSync('node', ['build.js'], { cwd: tmp, encoding: 'utf8' });
  assert.equal(r.status, 1); assert.match(r.stderr, /merujuk font yang tidak ada.*ghaib/);
  fs.copyFileSync(path.join(ROOT, 'public/css/style.css'), css);
  const cfgFile = path.join(tmp, 'site.config.json');
  const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8')); cfg.fonts.preload = 'tidak-ada';
  fs.writeFileSync(cfgFile, JSON.stringify(cfg));
  r = spawnSync('node', ['build.js'], { cwd: tmp, encoding: 'utf8' });
  assert.equal(r.status, 1); assert.match(r.stderr, /fonts\.preload "tidak-ada" tidak ditemukan/);
  cfg.fonts.preload = 'plus-jakarta-sans-latin-wght-normal'; cfg.features.search = true;
  fs.writeFileSync(cfgFile, JSON.stringify(cfg));
  r = spawnSync('node', ['build.js'], { cwd: tmp, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr); assert.ok(fs.existsSync(path.join(tmp, 'dist', 'search.html')), 'features.search aktif: /search dibuat');
  fs.rmSync(tmp, { recursive: true, force: true });
});
test('integrasi 1B: kontrak ARIA menu hamburger dan akordeon footer di HTML', () => {
  runBuild('--samples', NOW);
  const h = fs.readFileSync(D('about.html'), 'utf8');
  assert.match(h, /<button type="button" class="icon-btn menu-btn" id="menu-toggle" aria-expanded="false" aria-controls="menu-panel" aria-label="Menu">/);
  assert.match(h, /<div class="menu-panel" id="menu-panel" hidden>/, 'panel berlatar terang seperti header (tanpa kelas on-dark)');
  assert.ok(!/aria-modal|role="dialog"|id="menu-close"|aria-haspopup/.test(h), 'dropdown non-modal: tanpa dialog/aria-modal dan tanpa tombol tutup terpisah');
  const hdr = h.split('<header class="site-header">')[1].split('</header>')[0];
  assert.ok(hdr.includes('id="menu-panel"'), 'panel berada di dalam header (menempel di bawahnya)');
  assert.equal((hdr.match(/class="bar bar-[123]"/g) || []).length, 3, 'ikon hamburger = tiga garis yang dianimasikan');
  assert.match(h, /id="search-toggle" aria-expanded="false" aria-controls="search-pill"/);
  assert.equal((h.match(/placeholder="Search games, news, topics\.\.\."/g) || []).length, 2, 'placeholder di pil header dan panel');
  const panelHtml = hdr.split('id="menu-panel"')[1];
  assert.ok(panelHtml.indexOf('class="panel-search"') > 0 && panelHtml.indexOf('class="panel-search"') < panelHtml.indexOf('<nav'), 'pencarian di paling atas panel');
  assert.ok(!/About Us|Contact/.test(hdr), 'About Us/Contact tidak ada di panel');
  for (const id of ['fb-brand', 'fb-legal', 'fb-sitemap']) {
    assert.match(h, new RegExp(`aria-expanded="true" aria-controls="${id}"`));
    assert.match(h, new RegExp(`<ul class="footer-links" id="${id}">`));
  }
  assert.equal((h.match(/<h2 class="footer-title footer-title--static">/g) || []).length, 3);
  assert.equal((h.match(/<h2 class="footer-title footer-title--toggle">/g) || []).length, 3);
});

// ════════════════════════ TAHAP 1C ════════════════════════
const NOW_D = new Date('2026-10-09T12:00:00+07:00');
const day = (n) => new Date(NOW_D.getTime() - n * 86400000).toISOString().replace('Z', '+00:00');
const art = (slug, o = {}) => ({
  id: `2026-01-01-${slug}`, slug, status: 'published', title: o.title || `Title ${slug}`,
  excerpt: 'x'.repeat(100), category: o.category || 'news', platform: o.platform || 'mobile', tags: o.tags || ['rpg'], author: 'editors',
  publishedAt: day(o.days === undefined ? 1 : o.days),
  thumbnail: { src: o.src || `2026/10/${slug}-aaaaaaaa-1200.webp`, alt: o.alt || `Alt ${slug}`, credit: 'c', width: 1200, height: 675 },
  body: '<p>x</p>', flags: { featured: !!o.featured, special: o.special || '' },
});
const mkSite = (articles, over = {}) => B.indexSite({
  cfg: Object.assign({
    name: 'Cava Games', tagline: 't', description: 'd', images: { base: '/img/' },
    home: { carouselSlides: 5, latestRows: 6, categoryRows: 6, carouselIntervalMs: 6000 },
    hotTopics: { max: 6, windowDays: 30 }, listing: { tagPageMinArticles: 3, perPage: 20 },
    features: { search: false }, special: [],
  }, over.cfg || {}),
  categories: [{ id: 'news', name: 'News', slug: 'news' }, { id: 'reviews', name: 'Reviews', slug: 'reviews' }, { id: 'guides', name: 'Guides', slug: 'guides' }, { id: 'recommendations', name: 'Recommendations', slug: 'recommendations' }],
  platforms: [{ id: 'mobile', name: 'Mobile', slug: 'mobile' }, { id: 'pc', name: 'PC', slug: 'pc' }, { id: 'console', name: 'Console', slug: 'console' }],
  tags: ['rpg', 'moba', 'fps', 'ps5', 'xbox', 'a', 'b', 'c'].map((id) => ({ id, name: id.toUpperCase(), slug: id })),
  published: [...articles].sort((x, y) => Date.parse(y.publishedAt) - Date.parse(x.publishedAt) || x.slug.localeCompare(y.slug)),
  now: NOW_D,
});

test('pickCarousel: featured dulu (terbaru dulu), diisi terbaru, tanpa duplikat, maks. dihormati', () => {
  const list = [art('a', { days: 1 }), art('b', { days: 2, featured: true }), art('c', { days: 3 }), art('d', { days: 4, featured: true }), art('e', { days: 5 }), art('f', { days: 6 })];
  assert.deepEqual(B.pickCarousel(list, 5).map((x) => x.slug), ['b', 'd', 'a', 'c', 'e']);
  assert.deepEqual(B.pickCarousel(list, 1).map((x) => x.slug), ['b']);
  assert.deepEqual(B.pickCarousel([...list].reverse(), 3).map((x) => x.slug), ['b', 'd', 'a'], 'urutan input tidak memengaruhi hasil');
  assert.deepEqual(B.pickCarousel(list.slice(0, 2), 5).map((x) => x.slug), ['b', 'a']);
  assert.deepEqual(B.pickCarousel([], 5), []);
  const many = Array.from({ length: 8 }, (_, i) => art(`f${i}`, { days: i + 1, featured: true }));
  assert.deepEqual(B.pickCarousel(many, 5).map((x) => x.slug), ['f0', 'f1', 'f2', 'f3', 'f4']);
});
test('hotTopics: ≥ minimal artikel, ada artikel di jendela, urut jendela→total→nama, maks.', () => {
  const cfg = mkSite([]).cfg;
  const L = [
    art('1', { days: 1, tags: ['rpg', 'moba'] }), art('2', { days: 2, tags: ['rpg', 'moba'] }), art('3', { days: 3, tags: ['rpg', 'moba'] }),
    art('4', { days: 4, tags: ['rpg'] }), art('5', { days: 40, tags: ['moba'] }),               // moba total 4, jendela 3; rpg total 4, jendela 4
    art('6', { days: 1, tags: ['fps'] }), art('7', { days: 2, tags: ['fps'] }),                 // fps hanya 2 → tanpa halaman
    art('8', { days: 40, tags: ['ps5'] }), art('9', { days: 41, tags: ['ps5'] }), art('10', { days: 42, tags: ['ps5'] }), // ps5 total 3, nol di jendela
  ];
  const r = B.hotTopics(L, mkSite([]).tags, cfg, NOW_D);
  assert.deepEqual(r.map((t) => t.id), ['rpg', 'moba']);
  const edge = [art('e1', { days: 30, tags: ['xbox'] }), art('e2', { days: 31, tags: ['xbox'] }), art('e3', { days: 32, tags: ['xbox'] })];
  assert.deepEqual(B.hotTopics(edge, mkSite([]).tags, cfg, NOW_D).map((t) => t.id), ['xbox'], 'tepat di batas jendela dihitung');
  const tie = ['a', 'b', 'c'].flatMap((t) => [1, 2, 3].map((i) => art(`${t}${i}`, { days: i, tags: [t] })));
  assert.deepEqual(B.hotTopics(tie, mkSite([]).tags, cfg, NOW_D).map((t) => t.id), ['a', 'b', 'c'], 'seri → nama');
  cfg.hotTopics.max = 1;
  assert.equal(B.hotTopics(L, mkSite([]).tags, cfg, NOW_D).length, 1);
  assert.deepEqual(B.hotTopics([], mkSite([]).tags, mkSite([]).cfg, NOW_D), []);
});
test('imgAttrs: srcset 400/800/1200, lazy vs eager, tanpa varian bila nama tak berpola', () => {
  const site = mkSite([]);
  const a = art('x', { src: '2026/10/x-abcd1234-1200.webp' });
  const lazy = B.imgAttrs(site, a, 'S', false);
  assert.match(lazy, /srcset="\/img\/2026\/10\/x-abcd1234-400\.webp 400w, \/img\/2026\/10\/x-abcd1234-800\.webp 800w, \/img\/2026\/10\/x-abcd1234-1200\.webp 1200w"/);
  assert.match(lazy, / sizes="S"/); assert.match(lazy, /loading="lazy" decoding="async"/); assert.ok(!/fetchpriority/.test(lazy));
  const eager = B.imgAttrs(site, a, 'S', true);
  assert.match(eager, /fetchpriority="high"/); assert.ok(!/loading=/.test(eager));
  const odd = B.imgAttrs(site, art('y', { src: 'gambar-tunggal.webp' }), 'S', false);
  assert.ok(!/srcset|sizes/.test(odd) && /loading="lazy"/.test(odd));
  site.cfg.images.base = '/i"mg/';
  assert.ok(!/i"mg/.test(B.imgAttrs(site, a, 'S', false)), 'basis gambar di-escape');
});
test('kartu: nomor peringkat berada di dalam tautan (tetap satu tautan), tanpa rank markup tidak berubah', () => {
  const site = mkSite([]);
  const a = art('x', {});
  const html = require('../build.js').render('{{> card-row}}', B.cardCtx(site, a, { sizes: B.SIZES.row, rank: 3 }));
  assert.match(html, /<h3 class="card-title"><a class="card-link" href="\/x"><span class="card-rank" aria-hidden="true">3 \/<\/span> Title x<\/a><\/h3>/);
  assert.equal((html.match(/<a /g) || []).length, 1);
  const none = require('../build.js').render('{{> card-row}}', B.cardCtx(site, a, { sizes: B.SIZES.row }));
  assert.ok(!/card-rank/.test(none));
  assert.match(none, /<h3 class="card-title"><a class="card-link" href="\/x">Title x<\/a><\/h3>/);
});
test('kartu: escape judul/alt, satu tautan per kartu, time datetime, heading h3', () => {
  const site = mkSite([]);
  const a = art('x', { title: 'A <script>x</script> & "B"', alt: 'alt "q" <i>' });
  for (const p of ['card-hero', 'card-row', 'card-full']) {
    const html = require('../build.js').render(`{{> ${p}}}`, B.cardCtx(site, a, { sizes: B.SIZES.row }));
    assert.ok(!/<script/.test(html), p);
    assert.match(html, /A &lt;script&gt;x&lt;\/script&gt; &amp; &quot;B&quot;/);
    assert.match(html, /alt="alt &quot;q&quot; &lt;i&gt;"/);
    assert.equal((html.match(/<a /g) || []).length, 1, `${p}: tepat satu tautan`);
    assert.match(html, /<h3 class="card-title"><a class="card-link" href="\/x">/);
    assert.match(html, /width="1200" height="675"/);
  }
  const hero = require('../build.js').render('{{> card-hero}}', B.cardCtx(site, a, {}));
  assert.match(hero, /<time class="card-date" datetime="[^"]+">\w{3} \d{1,2}, \d{4}<\/time>/);
  assert.match(hero, /<span class="card-cat">News · Mobile<\/span>/, 'label kartu = kategori · platform');
  const rev = require('../build.js').render('{{> card-hero}}', B.cardCtx(site, art('r', { category: 'reviews', platform: 'console' }), {}));
  assert.match(rev, /<span class="card-cat">Reviews · Console<\/span>/);
});
test('featureGridHtml: pembagian hero / samping(2) / sisa, flip, daftar pendek', () => {
  const site = mkSite([]);
  const L = Array.from({ length: 7 }, (_, i) => art(`s${i}`, { days: i }));
  const g = B.featureGridHtml(site, L, { flip: false });
  assert.equal((g.match(/card card-hero/g) || []).length, 1);
  assert.equal((g.match(/card card-row/g) || []).length, 6);
  const side = g.split('feature-side')[1].split('feature-rest')[0];
  assert.equal((side.match(/card card-row/g) || []).length, 2);
  assert.ok(!/feature-grid--flip|thumb-left/.test(g));
  const f = B.featureGridHtml(site, L, { flip: true });
  assert.match(f, /feature-grid feature-grid--flip/); assert.equal((f.match(/card-row--thumb-left/g) || []).length, 6);
  const hrefs = [...g.matchAll(/class="card-link" href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(hrefs, L.map((a) => `/${a.slug}`), 'urutan dan tanpa duplikat');
  assert.ok(!/feature-side|feature-rest/.test(B.featureGridHtml(site, L.slice(0, 1))));
  const three = B.featureGridHtml(site, L.slice(0, 3));
  assert.ok(/feature-side/.test(three) && !/feature-rest/.test(three));
  assert.equal(B.featureGridHtml(site, []), '');
});
test('carouselHtml: jumlah slide, hanya slide pertama eager, label, kontrol tersembunyi tanpa JS', () => {
  const site = mkSite([]);
  const L = Array.from({ length: 5 }, (_, i) => art(`c${i}`, { days: i }));
  const h = B.carouselHtml(site, L);
  assert.equal((h.match(/class="carousel-slide"/g) || []).length, 5);
  assert.equal((h.match(/fetchpriority="high"/g) || []).length, 1);
  assert.equal((h.match(/loading="lazy"/g) || []).length, 4);
  assert.match(h, /aria-label="1 of 5"/); assert.match(h, /aria-label="5 of 5"/);
  assert.match(h, /data-carousel-controls hidden/);
  assert.equal((h.match(/class="dot/g) || []).length, 5);
  assert.match(h, /data-interval="6000"/);
  assert.match(h, /aria-roledescription="carousel"/);
  assert.equal(B.carouselHtml(site, []), '');
  for (const id of ['carousel-track']) assert.equal((h.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1);
});
test('buildHomeParts: urutan section, flip bergantian, spesial bersyarat, kategori kosong dilewati', () => {
  const L = [];
  for (let i = 0; i < 8; i++) L.push(art(`n${i}`, { days: i, category: 'news' }));
  for (let i = 0; i < 3; i++) L.push(art(`r${i}`, { days: i + 1, category: 'reviews', platform: 'pc', tags: ['moba'] }));
  const ids = (h) => [...h.matchAll(/<section class="home-section" aria-labelledby="([^"]+)"/g)].map((m) => m[1]);
  let p = B.buildHomeParts(mkSite(L));
  assert.deepEqual(ids(p.sections), ['sec-latest', 'sec-news', 'sec-reviews'], 'guides & recommendations kosong dilewati');
  const news = p.sections.split('id="sec-news"')[1].split('</section>')[0];
  assert.match(news, /feature-grid--flip/);
  assert.ok(!/feature-grid--flip/.test(p.sections.split('id="sec-reviews"')[1]));
  const latest = p.sections.split('id="sec-latest"')[1].split('</section>')[0];
  assert.equal((latest.match(/card-link/g) || []).length, 7);
  assert.deepEqual([...p.sections.matchAll(/class="section-more" href="([^"]+)"/g)].map((m) => m[1]), ['/latest', '/news', '/reviews']);
  assert.equal((p.sections.match(/class="btn btn--ghost" href=/g) || []).length, 3, 'tombol See all di akhir setiap section');
  assert.match(p.sections, /See all<span class="visually-hidden"> News<\/span>/);
  // zig-zag antar 4 kategori: flip pada indeks genap (News, Guides)
  const all = [...L, art('g0', { category: 'guides' }), art('c0', { category: 'recommendations' })];
  p = B.buildHomeParts(mkSite(all));
  assert.deepEqual(ids(p.sections), ['sec-latest', 'sec-news', 'sec-reviews', 'sec-guides', 'sec-recommendations']);
  const flipOf = (id) => /feature-grid--flip/.test(p.sections.split(`id="sec-${id}"`)[1].split('</section>')[0]);
  assert.deepEqual(['latest', 'news', 'reviews', 'guides', 'recommendations'].map(flipOf), [false, true, false, true, false]);
  // section spesial
  const sp = [...L.slice(0, 3).map((a) => ({ ...a, flags: { featured: false, special: 'event-x' } }))];
  const site = mkSite([...sp, ...L.slice(3)], { cfg: { special: [{ id: 'event-x', title: 'Event X', count: 2 }] } });
  p = B.buildHomeParts(site);
  assert.ok(ids(p.sections).includes('sec-special-event-x'));
  const sec = p.sections.split('id="sec-special-event-x"')[1].split('</section>')[0];
  assert.equal((sec.match(/card-link/g) || []).length, 2);
  assert.ok(!/section-more/.test(sec));
  assert.ok(!/sec-special/.test(B.buildHomeParts(mkSite(L, { cfg: { special: [{ id: 'event-x', title: 'Event X' }] } })).sections));
  // tanpa artikel sama sekali
  p = B.buildHomeParts(mkSite([]));
  assert.deepEqual([p.carousel, p.topicStrip, p.sections], ['', '', '']);
});

// ───────── integrasi 1C ─────────
const homeHtml = () => fs.readFileSync(D('index.html'), 'utf8');
test('integrasi 1C: beranda sampel — struktur, jumlah kartu, tautan, tanpa placeholder', () => {
  runBuild('--samples', NOW);
  const h = homeHtml();
  const r = C.checkHtml(h, 'index.html', { requireLayout: true });
  assert.deepEqual(r.problems, []);
  assert.equal((h.match(/<h1[ >]/g) || []).length, 1);
  assert.match(h, /<h1 class="visually-hidden">Cava Games — /);
  assert.match(h, /<html lang="en">/);
  assert.deepEqual([...h.matchAll(/<section class="home-section" aria-labelledby="([^"]+)"/g)].map((m) => m[1]), ['sec-latest', 'sec-news', 'sec-reviews', 'sec-guides', 'sec-recommendations']);
  assert.equal((h.match(/class="carousel-slide"/g) || []).length, 5);
  assert.equal((h.match(/fetchpriority="high"/g) || []).length, 1);
  const sec = (id) => h.split(`aria-labelledby="sec-${id}"`)[1].split('</section>')[0];
  assert.equal((sec('latest').match(/class="card-link"/g) || []).length, 7);
  assert.equal((sec('news').match(/class="card-link"/g) || []).length, 7, 'news: 12 sampel → 1 hero + 6');
  assert.equal((sec('reviews').match(/class="card-link"/g) || []).length, 3);
  assert.equal((sec('guides').match(/class="card-link"/g) || []).length, 3);
  assert.equal((sec('recommendations').match(/class="card-link"/g) || []).length, 3);
  for (const id of ['latest', 'news', 'reviews', 'guides', 'recommendations']) {
    const hrefs = [...sec(id).matchAll(/class="card-link" href="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(hrefs).size, hrefs.length, `tidak ada duplikat di ${id}`);
    for (const href of hrefs) assert.ok(fs.existsSync(D(`${href.slice(1)}.html`)), `${href} harus ada`);
  }
  assert.ok(!/sample-draft|sample-scheduled/.test([...h.matchAll(/class="card-link" href="([^"]+)"/g)].map((m) => m[1]).join(' ')), 'draft/jadwal tidak tampil');
  assert.deepEqual([...h.matchAll(/class="chip" href="([^"]+)"/g)].map((m) => m[1]), ['/tag/rpg', '/tag/esports', '/tag/fps', '/tag/gacha', '/tag/mobile-legends', '/tag/ps5']);
  assert.ok(!/\{\{/.test(h));
  assert.match(h, /<link rel="canonical" href="https:\/\/cava-games\.example\/">/);
  assert.match(h, /<title>Cava Games — News, reviews, and guides for Mobile, PC, and Console games<\/title>/);
  assert.equal((h.match(/class="acc-toggle"[^>]*aria-expanded="false"/g) || []).length, 4, 'beranda: 4 akordeon menu, semua tertutup');
});
test('integrasi 1C: beranda tanpa artikel tetap valid; 404 memuat artikel terbaru hanya bila ada', () => {
  runBuild(NOW);
  const h = homeHtml();
  assert.deepEqual(C.checkHtml(h, 'index.html', { requireLayout: true }).problems, []);
  assert.ok(!/carousel|home-section|topic-strip/.test(h.split('<main')[1].split('</main>')[0]));
  assert.ok(!/Latest articles/.test(fs.readFileSync(D('404.html'), 'utf8')));
  runBuild('--samples', NOW);
  const e = fs.readFileSync(D('404.html'), 'utf8');
  assert.match(e, /<h2 class="section-title" id="sec-404-latest">Latest articles<\/h2>/);
  assert.equal((e.match(/class="card-link"/g) || []).length, 5);
  assert.deepEqual(C.checkHtml(e, '404.html', { requireLayout: true }).problems, []);
});
test('integrasi 1C: pemeriksa dist lolos (tanpa tautan tertunda)', () => {
  runBuild('--samples', NOW);
  const r = C.checkDist(path.join(ROOT, 'dist'), { pending: PENDING });
  assert.deepEqual(r.problems, []);
  assert.equal(r.pending.size, 0);
});
test('integrasi 1C: gambar responsif ada di dist (400/800/1200) dan konfigurasi special/description divalidasi', () => {
  runBuild('--samples', NOW);
  for (const c of ['mobile', 'pc', 'console']) for (const w of [400, 800, 1200]) assert.ok(fs.existsSync(D('dev-img', 'sample', `${c}-${w}.webp`)), `${c}-${w}`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cava-cfg-'));
  for (const e of ['build.js', 'site.config.json', 'package.json']) fs.copyFileSync(path.join(ROOT, e), path.join(tmp, e));
  fs.cpSync(path.join(ROOT, 'public'), path.join(tmp, 'public'), { recursive: true });
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(tmp, 'node_modules'), 'dir');
  const f = path.join(tmp, 'site.config.json');
  const cfg = JSON.parse(fs.readFileSync(f, 'utf8'));
  cfg.special = [{ id: 'Bad Id', title: 'x' }]; fs.writeFileSync(f, JSON.stringify(cfg));
  let r = spawnSync('node', ['build.js'], { cwd: tmp, encoding: 'utf8' });
  assert.equal(r.status, 1); assert.match(r.stderr, /special\[\] butuh id/);
  cfg.special = []; delete cfg.description; fs.writeFileSync(f, JSON.stringify(cfg));
  r = spawnSync('node', ['build.js'], { cwd: tmp, encoding: 'utf8' });
  assert.equal(r.status, 1); assert.match(r.stderr, /description/);
  fs.rmSync(tmp, { recursive: true, force: true });
});
test('CSS 1C: aturan kunci terjaga (tautan kartu penuh, thumbnail kiri, zig-zag, kontrol carousel)', () => {
  const css = fs.readFileSync(path.join(ROOT, 'public/css/style.css'), 'utf8').replace(/\s+/g, ' ');
  assert.match(css, /\.card-link::after \{ content: ""; position: absolute; inset: 0; \}/);
  assert.match(css, /\.card-row--thumb-left \.card-thumb \{ order: -1; \}/);
  assert.match(css, /\.feature-grid--flip \.feature-main \{ grid-column: 2; \}/);
  assert.match(css, /\.card-row \.card-thumb \{ flex: 0 0 46%; order: 2; aspect-ratio: 3 \/ 2;/);
  assert.match(css, /\.carousel-track \{ display: flex; overflow-x: auto; scroll-snap-type: x mandatory;/);
});

test('favicon: tautan ikon di semua halaman berlayout dan berkas tersalin ke dist', () => {
  runBuild('--samples', NOW);
  assert.ok(fs.existsSync(D('favicon.svg')));
  for (const f of ['index.html', 'about.html', '404.html']) assert.match(fs.readFileSync(D(f), 'utf8'), /<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml">/, f);
});

// ════════════════════════ TAHAP 2 (taksonomi, bahasa Inggris, header) ════════════════════════
test('taksonomi: 4 kategori × 3 platform; slug kategori/platform/rute terdaftar sebagai reserved', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
  const cats = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/categories.json'), 'utf8'));
  const plats = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/platforms.json'), 'utf8'));
  assert.deepEqual(cats.map((c) => c.id), ['news', 'reviews', 'guides', 'recommendations']);
  assert.deepEqual(plats.map((c) => c.id), ['mobile', 'pc', 'console']);
  const reserved = new Set(cfg.reservedSlugs);
  for (const x of [...cats, ...plats]) assert.ok(reserved.has(x.slug), `reservedSlugs harus memuat "${x.slug}"`);
  for (const x of ['page', 'tag', 'author', 'latest', 'search', 'api', 'about', 'contact', 'terms', 'privacy', 'accessibility']) assert.ok(reserved.has(x), `reservedSlugs harus memuat "${x}"`);
  for (const gone of ['kategori', 'kuis', 'terbaru', 'cari', 'halaman', 'penulis', 'pedoman-media-siber']) assert.ok(!reserved.has(gone), `"${gone}" sudah tidak dipakai`);
  assert.equal(cfg.lang, 'en');
  assert.ok(!('quiz' in cfg.features) && !('quizCards' in cfg.home));
});
test('taksonomi: platforms.json divalidasi (deskripsi wajib, id/slug unik)', () => {
  const e = B.validateTaxonomy([{ id: 'pc', slug: 'pc', name: 'PC' }], 'platforms.json', (it, p) => (typeof it.description === 'string' ? [] : [`${p}: description wajib`]));
  assert.ok(e.some((x) => /description wajib/.test(x)));
});
test('bahasa: situs berbahasa Inggris, tanpa sisa teks Indonesia dan tanpa jejak kuis/Pedoman', () => {
  runBuild('--samples', NOW);
  const legacy = /Beranda|Lihat semua|Terpopuler|Topik Hangat|Kategori|Lewati ke konten|menit baca|Kuis|\bkuis\b|quiz|Pedoman Media Siber|Hubungi|Halaman tidak ditemukan|Tutup menu|Jeda putar|Slide sebelumnya|Slide berikutnya|\bOkt\b|\bAgu\b|\bDes\b/i;
  const files = fs.readdirSync(D()).filter((f) => f.endsWith('.html'));
  assert.ok(files.length >= 25);
  for (const f of files) {
    const h = fs.readFileSync(D(f), 'utf8');
    assert.ok(/<html lang="en">/.test(h), `${f}: lang="en"`);
    const m = legacy.exec(h.replace(/<script[\s\S]*?<\/script>/g, ''));
    assert.ok(!m, `${f}: sisa teks lama "${m && m[0]}"`);
  }
  const js = fs.readFileSync(D('js', 'main.js'), 'utf8');
  assert.ok(/Pause autoplay/.test(js) && !/Jeda putar/.test(js));
  for (const gone of ['kategori', 'kuis', 'terbaru', 'pedoman-media-siber']) assert.ok(!fs.existsSync(D(`${gone}.html`)) && !fs.existsSync(D(gone)), `${gone} tidak boleh ada di dist`);
});
test('header: hanya logo + hamburger (tanpa menu kategori); kategori hanya di panel dan footer', () => {
  runBuild('--samples', NOW);
  const h = fs.readFileSync(D('about.html'), 'utf8');
  const header = h.split('<header class="site-header">')[1].split('</header>')[0].split('<div class="menu-panel')[0];
  assert.ok(!/<nav|nav-link|main-nav/.test(header), 'baris header tidak memuat navigasi kategori');
  assert.equal((header.match(/<a /g) || []).length, 1, 'baris header: satu tautan (logo)');
  assert.equal((header.match(/<button /g) || []).length, 4, 'baris header: tombol cari, tutup + kirim di pil pencarian, hamburger');
  const panel = h.split('id="menu-panel"')[1].split('<main')[0];
  assert.deepEqual([...panel.matchAll(/class="acc-toggle" id="acc-btn-([a-z]+)"/g)].map((m) => m[1]), ['news', 'reviews', 'guides', 'recommendations']);
  for (const c of ['news', 'reviews', 'guides', 'recommendations']) {
    const sub = panel.split(`id="acc-${c}"`)[1].split('</ul>')[0];
    assert.deepEqual([...sub.matchAll(/href="([^"]+)"/g)].map((m) => m[1]), [`/${c}`, `/${c}/mobile`, `/${c}/pc`, `/${c}/console`]);
    assert.match(sub, new RegExp(`>All ${c[0].toUpperCase()}${c.slice(1)}<`));
  }
  assert.ok(!/<h[1-6]/.test(panel), 'panel tanpa heading (agar urutan heading dokumen tetap benar)');
  assert.ok(/<footer[\s\S]*<a href="\/news">News<\/a>[\s\S]*<a href="\/recommendations">Recommendations<\/a>/.test(h), 'footer Sitemap memuat 4 kategori (jalur tanpa JS)');
  assert.ok(!/Pedoman|pedoman/.test(h));
});
test('CSS 2: aturan kunci akordeon, dropdown, pil pencarian, dan animasi header terjaga', () => {
  const css = fs.readFileSync(path.join(ROOT, 'public/css/style.css'), 'utf8').replace(/\s+/g, ' ');
  assert.match(css, /\.acc-toggle\[aria-expanded="true"\] \{ background: var\(--accent\); color: #fff; \}/);
  assert.match(css, /\.acc-toggle\[aria-expanded="true"\]:focus-visible \{ outline-color: #fff; \}/, 'fokus terlihat di baris aksen');
  assert.match(css, /\.acc-toggle\[aria-expanded="true"\] \.acc-v \{ transform: rotate\(90deg\); opacity: 0; \}/, 'plus → minus beranimasi');
  assert.match(css, /\.acc-panel \{ display: grid; grid-template-rows: 0fr; visibility: hidden;/);
  assert.match(css, /\.acc-item\.is-open > \.acc-panel \{ grid-template-rows: 1fr; visibility: visible;/);
  assert.match(css, /\.acc-sub \{[^}]*overflow: hidden;[^}]*background: var\(--surface\);/);
  assert.match(css, /\.acc-sub a:focus-visible \{ outline-color: var\(--accent\); \}/, 'fokus terlihat di latar putih');
  assert.match(css, /\.menu-panel \{ position: absolute; top: 100%;/, 'panel = dropdown di bawah header, bukan overlay penuh');
  assert.match(css, /\.menu-panel\.is-open \{ clip-path: inset\(0 0 -2rem 0\); opacity: 1; \}/, 'ruang bawah negatif agar bayangan tidak terpotong');
  assert.match(css, /\.menu-panel \{[^}]*background: var\(--paper\); color: var\(--ink\);/, 'panel serasi dengan header (terang)');
  const hdrCss = css.slice(css.indexOf('Pencarian di header'), css.indexOf('Halaman pencarian (/search)')).replace(/\.social-links a \{ color: var\(--accent-on-dark\)[^}]*\}/, ''); // aturan umum tautan sosial dipakai juga footer (gelap)
  assert.ok(hdrCss.length > 500 && !/background: var\(--ink\)|#1b1e25|#2a2e36|on-dark/i.test(hdrCss), 'header/panel/akordeon tanpa sisa warna gelap (footer tetap gelap)');
  assert.match(css, /\.menu-panel \.social-links a \{ color: var\(--accent\); \}/, 'tautan sosial di panel terang tidak memakai warna latar gelap');
  assert.ok(!/\.menu-panel \{[^}]*position: fixed/.test(css) && !/html\.menu-open/.test(css), 'tanpa overlay penuh dan tanpa kunci scroll');
  assert.match(css, /\.search-pill \{ position: absolute; top: 100%; left: 0; right: 0;[^}]*clip-path: inset\(0 0 -2rem 100%\)/, '< 768 px: baris di bawah header (logo tidak tertutup), terbuka dari kanan ke kiri');
  assert.match(css, /\.search-pill\.is-open \{ clip-path: inset\(0 0 -2rem 0\); opacity: 1; \}/);
  assert.match(css, /padding: var\(--s3\) var\(--gutter\);/, 'gutter kiri/kanan sama → kotak pil terpusat');
  const wide = /@media \(min-width: 768px\) \{([^@]*?\.search-pill[^@]*?)\}\s*\/\* ─/.exec(css);
  assert.ok(wide && /top: 0; right: calc\(2\.75rem \+ var\(--s1\)\); left: auto; width: 30rem;/.test(wide[1]) && /clip-path: inset\(0 0 0 100% round 999px\)/.test(wide[1]), '≥ 768 px: pil sebaris di kiri ikon');
  assert.ok(!/is-search-open \.logo/.test(css), 'logo tidak pernah disembunyikan oleh pencarian');
  assert.match(css, /\.menu-btn\[aria-expanded="true"\] \.bar-1 \{ transform: translateY\(5px\) rotate\(45deg\); \}/);
  assert.match(css, /\.menu-btn\[aria-expanded="true"\] \.bar-3 \{ transform: translateY\(-5px\) rotate\(-45deg\); \}/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \*, \*::before, \*::after \{ animation: none !important; transition: none !important;/, 'gerak dimatikan di reduced-motion');
  assert.ok(!/\.nav-link|\.main-nav|\.panel-list|\.quiz-grid|\.panel-secondary|\.panel-top|icon-btn--dark/.test(css), 'sisa CSS menu lama/kuis sudah dihapus');
});
test('pencarian: penanda indeks Pagefind hanya di artikel; /search noindex; indeks = jumlah artikel; tanpa duplikasi file', () => {
  runBuild('--samples', NOW);
  const art = fs.readFileSync(D('best-steam-autumn-sale-picks.html'), 'utf8');
  assert.match(art, /<article class="article" data-pagefind-body>/);
  assert.match(art, /<h1 class="article-title" data-pagefind-meta="title">/);
  assert.match(art, /class="article-credit" data-pagefind-ignore>/);
  assert.match(art, /class="share share--top" role="group" aria-label="Share this article" data-pagefind-ignore>/);
  assert.match(art, /<img class="article-img" data-pagefind-meta="image\[src\]"/);
  if (/id="read-also-inline"/.test(art)) assert.match(art, /<aside class="read-also" aria-labelledby="read-also-inline" data-pagefind-ignore>/);
  for (const f of ['index.html', 'latest.html', 'news.html', 'about.html', '404.html', 'search.html']) assert.ok(!/data-pagefind-body/.test(fs.readFileSync(D(f), 'utf8')), `${f}: bukan sumber indeks`);
  const sr = fs.readFileSync(D('search.html'), 'utf8');
  assert.match(sr, /<meta name="robots" content="noindex,follow">/);
  assert.match(sr, /<link rel="canonical" href="https:\/\/[^"]+\/search">/);
  assert.match(sr, /<main id="main" class="container page-main" data-search-page>/);
  assert.match(sr, /<form class="search-form" role="search" action="\/search" method="get">/);
  assert.match(sr, /id="search-status" role="status" aria-live="polite"/);
  assert.ok(!/<loc>[^<]*\/search<\/loc>/.test(fs.readFileSync(D('sitemap.xml'), 'utf8')), '/search tidak ada di sitemap');
  const entry = JSON.parse(fs.readFileSync(D('pagefind', 'pagefind-entry.json'), 'utf8'));
  assert.equal(entry.languages.en.page_count, 21, 'indeks memuat tepat 21 artikel sampel (bukan halaman daftar/statis)');
});
test('JS pencarian & header: hasil tanpa innerHTML pengguna, URL tanpa .html, penutupan menunggu transisi clip-path, sintaks valid', () => {
  const src = fs.readFileSync(path.join(ROOT, 'public/js/main.js'), 'utf8');
  execFileSync('node', ['-c', path.join(ROOT, 'public/js/main.js')]);
  assert.equal((src.match(/\.innerHTML\s*=/g) || []).length, 1, 'satu-satunya penugasan innerHTML = template inert untuk excerpt Pagefind');
  assert.ok(!/\.outerHTML|insertAdjacentHTML|document\.write/.test(src));
  assert.match(src, /tpl\.innerHTML = html \|\| ''/);
  assert.match(src, /n\.nodeName === 'MARK'/, 'hanya <mark> yang dipertahankan dari excerpt');
  assert.match(src, /replace\(\/\\\.html\$\/, ''\)/, 'URL hasil tanpa .html');
  assert.match(src, /e\.propertyName === 'clip-path'/, 'penutupan menunggu transisi clip-path');
  assert.match(src, /reduceMotion\.matches\) \{ finish\(\); return; \}/, 'reduced-motion: tanpa menunggu transisi');
  assert.match(src, /var url = '\/pagefind\/pagefind\.js'; /, 'Pagefind dimuat lazy lewat impor dinamis berpeubah');
  assert.ok(!/focusables|FOCUSABLE/.test(src), 'dropdown non-modal: tanpa perangkap fokus');
});
test('JS: akordeon menu — satu terbuka pada satu waktu (logika), sintaks valid', () => {
  const src = fs.readFileSync(path.join(ROOT, 'public/js/main.js'), 'utf8');
  execFileSync('node', ['-c', path.join(ROOT, 'public/js/main.js')]);
  assert.match(src, /function initAccordion\(\)/);
  assert.match(src, /if \(other !== item\) setOpen\(other, false\)/);
  assert.match(src, /init\(\) \{ initHeader\(\); initAccordion\(\);/);
});

// ════════════════════════ TAHAP 1D (halaman artikel) ════════════════════════
const slugs = (l) => l.map((x) => x.slug);
test('pickReadAlsoInline: kategori+platform sama dulu, lalu kategori sama (platform lain); tanpa artikel ini; boleh kurang', () => {
  const me = art('me', { category: 'news', platform: 'mobile', days: 5 });
  const pub = [
    me,
    art('n-m-1', { category: 'news', platform: 'mobile', days: 1 }),
    art('n-pc-0', { category: 'news', platform: 'pc', days: 0 }),
    art('n-m-9', { category: 'news', platform: 'mobile', days: 9 }),
    art('r-m-2', { category: 'reviews', platform: 'mobile', days: 2 }),
    art('n-con-3', { category: 'news', platform: 'console', days: 3 }),
  ].sort((x, y) => Date.parse(y.publishedAt) - Date.parse(x.publishedAt));
  const got = slugs(B.pickReadAlsoInline(pub, me, 5));
  assert.deepEqual(got.slice(0, 2).sort(), ['n-m-1', 'n-m-9'], 'dua pertama: kategori+platform sama');
  assert.deepEqual(got.slice(2), ['n-pc-0', 'n-con-3'], 'sisanya: kategori sama, platform lain, terbaru dulu (days = hari yang lalu)');
  assert.ok(!got.includes('me') && !got.includes('r-m-2'), 'bukan artikel ini, bukan kategori lain');
  assert.equal(B.pickReadAlsoInline(pub, me, 3).length, 3);
  assert.deepEqual(B.pickReadAlsoInline([me], me, 5), []);
});
test('pickTrending: featured dulu lalu terbaru (lintas kategori), bukan artikel ini, boleh kurang dari n', () => {
  const pub = [art('a', { days: 1 }), art('b', { days: 2, category: 'reviews' }), art('c', { days: 3, featured: true }), art('d', { days: 4, category: 'guides', featured: true }), art('e', { days: 5 })];
  assert.deepEqual(slugs(B.pickTrending(pub, pub[0], 5)), ['c', 'd', 'b', 'e'], 'featured (terbaru dulu), lalu terbaru; tanpa artikel ini; 4 < 5 tidak diisi duplikat');
  assert.deepEqual(slugs(B.pickTrending(pub, pub[2], 2)), ['d', 'a'], 'artikel ini (featured) tidak ikut');
  assert.deepEqual(B.pickTrending([pub[0]], pub[0], 5), []);
});
test('pickAsideLatest: kategori sama, terbaru dulu, tanpa artikel ini dan tanpa yang dikecualikan', () => {
  const pub = [art('a', { days: 1 }), art('b', { days: 2, category: 'reviews' }), art('c', { days: 3 }), art('d', { days: 4 }), art('e', { days: 5, category: 'reviews' }), art('f', { days: 6 })];
  assert.deepEqual(slugs(B.pickAsideLatest(pub, pub[0], new Set(['c']), 5)), ['d', 'f'], 'hanya news; tanpa a (diri sendiri) dan c (dikecualikan)');
  assert.deepEqual(slugs(B.pickAsideLatest(pub, pub[1], new Set(), 5)), ['e'], 'kategori reviews tidak diisi dari kategori lain');
  assert.deepEqual(slugs(B.pickAsideLatest(pub, pub[0], new Set(), 2)), ['c', 'd']);
});
test('relatedScore/pickRelated: tag sama ×3 + kategori sama ×1, skor > 0, seri → terbaru, kecualikan, boleh kurang', () => {
  const me = art('me', { tags: ['rpg', 'moba'], category: 'news' });
  assert.equal(B.relatedScore(me, art('x', { tags: ['rpg', 'moba'], category: 'news' })), 7);
  assert.equal(B.relatedScore(me, art('x', { tags: ['rpg'], category: 'reviews' })), 3);
  assert.equal(B.relatedScore(me, art('x', { tags: ['fps'], category: 'news' })), 1);
  assert.equal(B.relatedScore(me, art('x', { tags: ['fps'], category: 'reviews' })), 0);
  const pub = [
    me, art('two-tags', { tags: ['rpg', 'moba'], category: 'reviews', days: 3 }), art('one-tag-new', { tags: ['rpg'], category: 'reviews', days: 1 }),
    art('one-tag-old', { tags: ['moba'], category: 'reviews', days: 6 }), art('cat-only', { tags: ['fps'], category: 'news', days: 2 }),
    art('none', { tags: ['fps'], category: 'reviews', days: 0 }), art('excluded', { tags: ['rpg', 'moba'], category: 'news', days: 4 }),
  ].sort((x, y) => Date.parse(y.publishedAt) - Date.parse(x.publishedAt));
  assert.deepEqual(slugs(B.pickRelated(pub, me, new Set(['excluded']), 4)), ['two-tags', 'one-tag-new', 'one-tag-old', 'cat-only']);
  assert.deepEqual(slugs(B.pickRelated(pub, me, new Set(['excluded']), 2)), ['two-tags', 'one-tag-new']);
  assert.ok(!slugs(B.pickRelated(pub, me, new Set(), 9)).includes('none'), 'skor 0 tidak ditampilkan');
});
test('findInlineSplit/splitBody: penanda didahulukan; otomatis setelah paragraf ke-4 bila ≥ 8 paragraf level atas', () => {
  const P = (n) => Array.from({ length: n }, (_, i) => `<p>p${i + 1}</p>`).join('');
  // otomatis
  const h8 = P(8); const sp8 = B.findInlineSplit(h8);
  assert.ok(sp8); assert.deepEqual(B.splitBody(h8, sp8), { before: P(4), after: P(8).slice(P(4).length) });
  assert.equal(B.findInlineSplit(P(7)), null, '7 paragraf: tidak disisipkan');
  assert.deepEqual(B.splitBody(P(7), null), { before: P(7), after: '' });
  // paragraf di dalam blockquote/daftar tidak dihitung dan tidak jadi titik sisip
  const bq = '<p>a</p><blockquote><p>q1</p><p>q2</p><p>q3</p></blockquote><p>b</p><ul><li>x</li></ul><p>c</p><p>d</p><p>e</p><p>f</p><p>g</p><p>h</p>';
  assert.equal(B.topLevelParagraphEnds(bq).length, 8);
  const sp = B.findInlineSplit(bq); const parts = B.splitBody(bq, sp);
  assert.ok(parts.before.endsWith('<p>d</p>') && !/<p>e<\/p>/.test(parts.before), 'setelah paragraf level-atas ke-4 (d)');
  assert.equal((parts.before.match(/<blockquote>/g) || []).length, 1);
  // penanda
  const M = B.READ_ALSO_MARKER;
  const withMarker = `<p>a</p>${M}<p>b</p>${M}<p>c</p>`;
  const spm = B.findInlineSplit(withMarker);
  assert.deepEqual(B.splitBody(withMarker, spm), { before: '<p>a</p>', after: '<p>b</p><p>c</p>' }, 'penanda pertama dipakai; penanda lain dibuang');
  assert.deepEqual(B.splitBody(withMarker, null), { before: '<p>a</p><p>b</p><p>c</p>', after: '' }, 'tanpa stok: semua penanda dibuang');
  assert.ok(B.findInlineSplit(`<p>a</p>${M}`), 'penanda berlaku walau paragraf sedikit');
});
test('showUpdated: hanya bila updatedAt ≥ ambang jam setelah publishedAt', () => {
  const cfg = { article: { updatedMinHours: 24 } };
  assert.equal(B.showUpdated({ publishedAt: '2026-10-09T08:00:00+07:00', updatedAt: '2026-10-09T09:10:00+07:00' }, cfg), false);
  assert.equal(B.showUpdated({ publishedAt: '2026-10-09T08:00:00+07:00', updatedAt: '2026-10-10T08:00:00+07:00' }, cfg), true);
  assert.equal(B.showUpdated({ publishedAt: '2026-10-09T08:00:00+07:00' }, cfg), false);
});
test('shareHtml: 5 tautan aman + tombol Copy link tersembunyi; URL/judul di-encode dan di-escape', () => {
  const h = B.shareHtml('https://t.example/a?x=1&y=2', 'Tom & "Jerry" <b>', 'top');
  assert.equal((h.match(/<a class="share-btn share-btn--(facebook|x|telegram|whatsapp|line)"/g) || []).length, 5);
  // ikon merek resmi (Simple Icons, CC0): isian currentColor, tanpa goresan buatan sendiri
  const sigs = { facebook: 'M9.101 23.691', x: 'M14.234 10.162', telegram: 'M11.944 0A12', whatsapp: 'M17.472 14.382', line: 'M19.365 9.863' };
  for (const [id, sig] of Object.entries(sigs)) {
    const m = new RegExp(`share-btn--${id}"[^>]*>(<svg[^>]*>)<path d="([^"]+)"`).exec(h);
    assert.ok(m, id);
    assert.match(m[1], /viewBox="0 0 24 24" fill="currentColor"/, id);
    assert.ok(!/stroke/.test(m[1]), `${id}: tanpa goresan`);
    assert.ok(m[2].startsWith(sig), `${id}: path resmi`);
  }
  assert.equal((h.match(/target="_blank" rel="noopener noreferrer"/g) || []).length, 5);
  for (const host of ['www.facebook.com/sharer', 'twitter.com/intent/tweet', 't.me/share/url', 'wa.me/', 'social-plugins.line.me/lineit/share']) assert.ok(h.includes(host), host);
  assert.ok(h.includes('u=https%3A%2F%2Ft.example%2Fa%3Fx%3D1%26y%3D2'));
  assert.ok(h.includes('Tom%20%26%20%22Jerry%22%20%3Cb%3E'));
  assert.ok(!/Tom & "Jerry"|<b>/.test(h), 'tidak ada teks mentah');
  assert.match(h, /<button type="button" class="share-btn" data-copy-link data-url="https:\/\/t\.example\/a\?x=1&amp;y=2" aria-label="Copy link" hidden>/);
  assert.match(h, /class="share share--top" role="group" aria-label="Share this article"/);
  assert.match(B.shareHtml('https://t.example/a', 't', 'bottom'), /share--bottom/);
});
test('CSS artikel: share atas hanya disembunyikan < 1024 px; breadcrumb mobile turun; garis meta dan jarak grid di desktop', () => {
  const css = fs.readFileSync(path.join(ROOT, 'public/css/style.css'), 'utf8');
  const mobile = /@media \(max-width: 1023\.98px\) \{([\s\S]*?)\n\}/.exec(css);
  assert.ok(mobile, 'blok mobile/tablet ada');
  assert.match(mobile[1], /\.share--top \{ display: none; \}/);
  assert.match(mobile[1], /\.article-main \.breadcrumb \{ margin-top: var\(--s4\); margin-bottom: 0; \}/);
  const desk = [...css.matchAll(/@media \(min-width: 1024px\) \{([\s\S]*?)\n\}/g)].find((m) => m[1].includes('.article-meta'));
  assert.ok(desk && /\.article-meta \{ padding-bottom: var\(--s4\); border-bottom: 1px solid var\(--line\); \}/.test(desk[1]), 'garis meta di desktop');
  assert.match(desk[1], /\.article-layout \{ margin-top: var\(--s6\); \}/);
  assert.ok(!/\.share--top \{ display: none/.test(desk[1]), 'share atas tidak disembunyikan di desktop');
});
test('share: setiap target punya aturan warna merek di style.css; hover tidak menimpa warna merek', () => {
  const css = fs.readFileSync(path.join(ROOT, 'public/css/style.css'), 'utf8');
  const h = B.shareHtml('https://t.example/a', 't', 'top');
  const ids = [...h.matchAll(/share-btn--(\w+)"/g)].map((m) => m[1]);
  assert.equal(ids.length, 5);
  for (const id of ids) assert.ok(new RegExp(`\\.share-btn--${id}\\s*\\{\\s*color:`).test(css), `warna .share-btn--${id}`);
  const hover = /\.share-btn:hover, \.share-btn:focus-visible \{([^}]*)\}/.exec(css);
  assert.ok(hover && !/(^|[;\s{])color:/.test(hover[1]) && /border-color:/.test(hover[1]), 'hover umum hanya mengubah border');
});
test('jsonLdScript & articleJsonLd: aman dalam <script>, struktur NewsArticle + BreadcrumbList', () => {
  const x = B.jsonLdScript({ a: '</script><script>alert(1)</script>', b: '\u2028' });
  assert.equal((x.match(/<\/script>/g) || []).length, 1, 'hanya satu penutup script');
  assert.ok(!/<script>alert/.test(x.slice(8)));
  const json = JSON.parse(x.replace(/^<script type="application\/ld\+json">/, '').replace(/<\/script>$/, ''));
  assert.equal(json.a, '</script><script>alert(1)</script>');
  const site = aSite([art('me', { title: 'T </script> x' })]);
  const a = site.published[0];
  const out = B.articleJsonLd(site, a, { cat: site.catById.get('news'), plat: site.platById.get('mobile'), author: site.authors[0], url: 'https://t.example/me', image: 'https://t.example/img/a.webp' });
  const blocks = [...out.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  assert.equal(blocks.length, 2);
  const [na, bc] = blocks;
  assert.equal(na['@type'], 'NewsArticle'); assert.equal(na.headline, 'T </script> x');
  assert.equal(na.datePublished, a.publishedAt); assert.equal(na.dateModified, a.publishedAt);
  assert.deepEqual(na.image, ['https://t.example/img/a.webp']);
  assert.equal(na.author.name, 'Ed'); assert.equal(na.publisher.name, 'Cava Games');
  assert.equal(na.mainEntityOfPage['@id'], 'https://t.example/me');
  assert.equal(bc['@type'], 'BreadcrumbList');
  assert.deepEqual(bc.itemListElement.map((i) => [i.position, i.name, i.item]), [[1, 'Home', 'https://t.example/'], [2, 'News', 'https://t.example/news'], [3, 'Mobile', 'https://t.example/news/mobile'], [4, 'T </script> x', 'https://t.example/me']]);
});

function aSite(list, over = {}) {
  const s = mkSite(list, { cfg: Object.assign({ siteUrl: 'https://t.example', lang: 'en', locale: 'en_US', article: { readAlsoInline: 3, trending: 5, asideLatest: 5, related: 4, wordsPerMinute: 200, updatedMinHours: 24 }, social: [] }, over.cfg || {}) });
  s.authors = [{ id: 'editors', name: 'Ed', slug: 'editors', avatar: null }];
  s.tagPages = B.tagPageSet(s.published, s.cfg);
  s.assets = { v: '1', preloadHref: '/fonts/x.woff2' };
  return s;
}
const paras = (n) => Array.from({ length: n }, (_, i) => `<p>Paragraph ${i + 1} words here.</p>`).join('');

test('renderArticle: artikel tunggal tanpa artikel lain — tanpa Read Also/Related/aside, tetap valid', () => {
  const site = aSite([art('solo', { days: 1 })]);
  const h = B.renderArticle(site, site.published[0]);
  const r = C.checkHtml(h, 'solo.html', {});
  assert.deepEqual(r.problems.filter((x) => !/\/author\//.test(x) && !/\/(news|tag)/.test(x)), []);
  assert.ok(!/Read Also|id="sec-related"|article-aside/.test(h));
  assert.match(h, /article-layout article-layout--solo/);
  assert.equal((h.match(/<h1[ >]/g) || []).length, 1);
});
test('renderArticle: inline maks. 3 (hanya bila ada tempat); Trending 5 berperingkat; Related tidak mengulang inline/Trending; sidebar Trending + Latest sekategori', () => {
  const others = Array.from({ length: 8 }, (_, i) => art(`o${i}`, { days: i + 2 }));
  const linksOf = (h, marker, end) => [...h.split(marker)[1].split(end)[0].matchAll(/href="\/(o\d)"/g)].map((m) => m[1]);
  const short = { ...art('me', { days: 1 }), body: paras(5) };
  let site = aSite([short, ...others]);
  let h = B.renderArticle(site, site.published.find((x) => x.slug === 'me'));
  assert.ok(!/id="read-also-inline"/.test(h), '5 paragraf & tanpa penanda: tanpa inline');
  assert.ok(!/Read Also/.test(h), 'tanpa inline dan Read Also bawah sudah diganti Trending');
  const trend = h.split('id="sec-trending"')[1].split('</section>')[0];
  assert.deepEqual(linksOf(h, 'id="sec-trending"', '</section>'), ['o0', 'o1', 'o2', 'o3', 'o4']);
  assert.deepEqual([...trend.matchAll(/class="card-rank" aria-hidden="true">(\d+) \//g)].map((m) => +m[1]), [1, 2, 3, 4, 5], 'peringkat 1..5 berurutan');
  assert.deepEqual(linksOf(h, 'id="sec-related"', '</section>'), ['o5', 'o6', 'o7'], 'Related tidak mengulang Trending');
  // sidebar: Trending = daftar yang sama dengan bawah (beserta peringkat), Latest = kategori sama tanpa Trending
  const asideT = h.split('id="aside-trending"')[1].split('</section>')[0];
  assert.deepEqual(linksOf(h, 'id="aside-trending"', '</section>'), ['o0', 'o1', 'o2', 'o3', 'o4']);
  assert.equal((asideT.match(/class="card-rank"/g) || []).length, 5);
  assert.match(h, /<h2 class="aside-title" id="aside-latest">Latest News<\/h2>/);
  const asideL = h.split('id="aside-latest"')[1].split('</section>')[0];
  assert.deepEqual(linksOf(h, 'id="aside-latest"', '</section>'), ['o5', 'o6', 'o7']);
  assert.ok(!/card-rank/.test(asideL), 'Latest tanpa peringkat');
  const long = { ...short, body: paras(9) };
  site = aSite([long, ...others]);
  h = B.renderArticle(site, site.published.find((x) => x.slug === 'me'));
  assert.deepEqual(linksOf(h, 'id="read-also-inline"', '</aside>'), ['o0', 'o1', 'o2'], 'inline maks. 3');
  assert.deepEqual(linksOf(h, 'id="sec-trending"', '</section>'), ['o0', 'o1', 'o2', 'o3', 'o4'], 'Trending peringkat global: boleh beririsan dengan inline');
  assert.deepEqual(linksOf(h, 'id="sec-related"', '</section>'), ['o5', 'o6', 'o7'], 'Related tidak mengulang inline maupun Trending');
  // inline di antara paragraf 4 dan 5
  assert.ok(h.indexOf('Paragraph 4 words') < h.indexOf('id="read-also-inline"') && h.indexOf('id="read-also-inline"') < h.indexOf('Paragraph 5 words'));
  // Latest sidebar tidak menampilkan kategori lain dan tidak mengulang Trending
  const mixed = aSite([short, art('r1', { days: 2, category: 'reviews' }), ...Array.from({ length: 8 }, (_, i) => art(`n${i + 1}`, { days: i + 3 }))]);
  const hm = B.renderArticle(mixed, mixed.published.find((x) => x.slug === 'me'));
  assert.equal(linksOfAny(hm.split('id="aside-trending"')[1].split('</section>')[0]).join(), 'r1,n1,n2,n3,n4');
  assert.equal(linksOfAny(hm.split('id="aside-latest"')[1].split('</section>')[0]).join(), 'n5,n6,n7,n8', 'hanya news, tanpa yang sudah di Trending');
});
function linksOfAny(frag) { return [...frag.matchAll(/class="card-link" href="\/([^"]+)"/g)].map((m) => m[1]); }
test('renderArticle: sidebar hanya merender blok yang punya isi', () => {
  const only = aSite([art('me', { days: 1 }), art('r1', { days: 2, category: 'reviews' })]);
  const h = B.renderArticle(only, only.published.find((x) => x.slug === 'me'));
  assert.match(h, /id="aside-trending"/);
  assert.ok(!/id="aside-latest"/.test(h), 'tak ada artikel news lain: blok Latest tidak dirender');
  assert.ok(/class="article-aside" aria-label="Trending and latest News"/.test(h));
});
test('renderArticle: tag ≥ 3 artikel menjadi tautan, sisanya label teks; "diperbarui" hanya bila bermakna', () => {
  const list = [art('me', { tags: ['rpg', 'moba'], days: 1 }), art('x1', { tags: ['rpg'], days: 2 }), art('x2', { tags: ['rpg'], days: 3 })];
  const site = aSite(list);
  const h = B.renderArticle(site, site.published.find((x) => x.slug === 'me'));
  assert.match(h, /<a class="chip" href="\/tag\/rpg">RPG<\/a>/);
  assert.match(h, /<span class="chip chip--static">MOBA<\/span>/);
  assert.ok(!/Updated/.test(h));
  const upd = { ...list[0], updatedAt: new Date(Date.parse(list[0].publishedAt) + 3 * 864e5).toISOString() };
  const h2 = B.renderArticle(aSite([upd, list[1], list[2]]), upd);
  assert.match(h2, /<span>Updated <time datetime="[^"]+">\w{3} \d{1,2}, \d{4}<\/time><\/span>/);
  assert.match(h, /href="\/author\/editors" rel="author">Ed</);
});
test('renderArticle: judul/alt/kredit berbahaya di-escape (meta, OG, gambar, JSON-LD)', () => {
  const evil = { ...art('evil', { title: 'A <img src=x onerror=1> & "q"', alt: 'alt "<b>"', days: 1 }) };
  evil.thumbnail.credit = 'c <script>1</script>';
  const site = aSite([evil, art('o1', { days: 2 })]);
  const h = B.renderArticle(site, site.published.find((x) => x.slug === 'evil'));
  assert.ok(!/<img src=x|<b>"|<script>1<\/script>/.test(h));
  assert.match(h, /<h1 class="article-title" data-pagefind-meta="title">A &lt;img src=x onerror=1&gt; &amp; &quot;q&quot;<\/h1>/);
  assert.equal((h.match(/<script type="application\/ld\+json">/g) || []).length, 2, 'hanya dua blok JSON-LD');
  assert.equal((h.match(/<script/g) || []).length, 3, 'dua JSON-LD + main.js; tidak ada skrip dari data');
});

test('integrasi 1D: semua artikel sampel — struktur, bagian, tanpa duplikasi, metadata, pemeriksa dist', () => {
  runBuild('--samples', NOW);
  const files = fs.readdirSync(D()).filter((f) => f.endsWith('.html') && !['index.html', '404.html', 'about.html', 'contact.html', 'terms.html', 'privacy.html', 'accessibility.html', 'search.html', 'latest.html', 'news.html', 'reviews.html', 'guides.html', 'recommendations.html'].includes(f));
  assert.equal(files.length, 21);
  const linksIn = (frag) => [...frag.matchAll(/class="card-link" href="\/([^"]+)"/g)].map((m) => m[1]);
  for (const f of files) {
    const slug = f.replace(/\.html$/, '');
    const h = fs.readFileSync(D(f), 'utf8');
    const main = h.split('<main')[1].split('</main>')[0];
    assert.equal((h.match(/<h1[ >]/g) || []).length, 1, `${slug}: satu h1`);
    assert.ok(!/\{\{/.test(h), `${slug}: tanpa placeholder`);
    assert.equal((h.match(/fetchpriority="high"/g) || []).length, 1, `${slug}: tepat satu gambar LCP`);
    assert.ok(/class="article-img"[^>]*fetchpriority="high"/.test(h) && !/class="article-img"[^>]*loading="lazy"/.test(h), `${slug}: thumbnail eager`);
    assert.match(h, new RegExp(`<link rel="canonical" href="https://cava-games\\.example/${slug}">`));
    assert.match(h, /<meta property="og:type" content="article">/);
    assert.match(h, /<meta name="twitter:card" content="summary_large_image">/);
    assert.match(h, /<meta property="og:image" content="https:\/\/cava-games\.example\/dev-img\/sample\/[a-z]+-1200\.webp">/);
    const ld = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1])['@type']);
    assert.deepEqual(ld, ['NewsArticle', 'BreadcrumbList'], slug);
    // breadcrumb: 3 tautan, tanpa judul artikel
    const bc = main.split('<nav class="breadcrumb"')[1].split('</nav>')[0];
    assert.equal((bc.match(/<a /g) || []).length, 3, `${slug}: breadcrumb 3 tautan`);
    assert.ok(!bc.includes(h.match(/<h1 class="article-title"[^>]*>([^<]*)</)[1]), `${slug}: breadcrumb tanpa judul artikel`);
    // kepala (judul + meta) di luar grid agar garis dan sidebar mengikuti referensi: header → grid, bukan di dalam kolom artikel
    const iHead = main.indexOf('<header class="article-head">'), iGrid = main.indexOf('<div class="article-layout');
    assert.ok(iHead > 0 && iHead < iGrid, `${slug}: kepala artikel sebelum grid`);
    const head = main.slice(iHead, main.indexOf('</header>', iHead));
    assert.ok(head.includes('<h1 class="article-title"') && head.includes('class="article-meta"'), `${slug}: h1 + meta di dalam header`);
    assert.ok(!main.slice(iGrid).includes('<h1'), `${slug}: tidak ada h1 di dalam grid`);
    // urutan bagian
    const order = ['<h1 class="article-title"', 'class="article-figure"', 'class="share share--top"', 'class="share share--bottom"', 'class="article-tags"'].map((m) => main.indexOf(m));
    assert.ok(order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1])), `${slug}: urutan judul → thumbnail → share atas → share bawah → tag`);
    const iTrend = main.indexOf('id="sec-trending"'); const iRel = main.indexOf('id="sec-related"');
    assert.ok(iTrend > order[4], `${slug}: Trending setelah tag`);
    assert.ok(!main.includes('sec-read-also-bottom'), `${slug}: Read Also bawah sudah tidak ada`);
    if (iRel > 0) assert.ok(iRel > iTrend, `${slug}: Related setelah Trending`);
    const inline = main.includes('id="read-also-inline"') ? linksIn(main.split('id="read-also-inline"')[1].split('</aside>')[0]) : [];
    const trending = iTrend > 0 ? linksIn(main.split('id="sec-trending"')[1].split('</section>')[0]) : [];
    const related = iRel > 0 ? linksIn(main.split('id="sec-related"')[1].split('</section>')[0]) : [];
    for (const [nm, l] of [['inline', inline], ['trending', trending], ['related', related]]) assert.equal(new Set(l).size, l.length, `${slug}: ${nm} tanpa duplikat`);
    assert.ok(related.every((x) => !inline.includes(x) && !trending.includes(x)), `${slug}: Related tidak mengulang inline/Trending`);
    const all = [...inline, ...trending, ...related];
    assert.ok(!all.includes(slug), `${slug}: tidak menautkan dirinya sendiri`);
    assert.ok(inline.length <= 3 && trending.length <= 5 && related.length <= 4, `${slug}: batas jumlah`);
    // peringkat Trending berurutan 1..n (bawah dan sidebar)
    const ranks = (frag) => [...frag.matchAll(/class="card-rank" aria-hidden="true">(\d+) \//g)].map((m) => +m[1]);
    assert.deepEqual(ranks(main.split('id="sec-trending"')[1].split('</section>')[0]), trending.map((_, i) => i + 1), `${slug}: peringkat bawah`);
    // sidebar: Trending sama dengan bawah; Latest sekategori, tanpa Trending dan tanpa diri sendiri
    const metaA = JSON.parse(fs.readFileSync(path.join(ROOT, 'dev/sample-articles', `${slug}.json`), 'utf8'));
    const asideT = main.includes('id="aside-trending"') ? linksIn(main.split('id="aside-trending"')[1].split('</section>')[0]) : [];
    const asideL = main.includes('id="aside-latest"') ? linksIn(main.split('id="aside-latest"')[1].split('</section>')[0]) : [];
    assert.deepEqual(asideT, trending, `${slug}: sidebar Trending = Trending bawah`);
    assert.ok(asideL.length <= 5 && asideL.every((x) => !trending.includes(x) && x !== slug), `${slug}: sidebar Latest tanpa Trending/diri sendiri`);
    for (const l of asideL) assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT, 'dev/sample-articles', `${l}.json`), 'utf8')).category, metaA.category, `${slug}: sidebar Latest ${l} sekategori`);
    for (const l of [...all, ...asideL]) assert.ok(fs.existsSync(D(`${l}.html`)), `${slug}: ${l} ada`);
    // Read Also inline: kategori sama dengan artikel ini
    const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'dev/sample-articles', `${slug}.json`), 'utf8'));
    for (const l of inline) assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT, 'dev/sample-articles', `${l}.json`), 'utf8')).category, meta.category, `${slug}: inline ${l} sekategori`);
  }
  const r = C.checkDist(path.join(ROOT, 'dist'), { pending: PENDING });
  assert.deepEqual(r.problems, []);
});
test('integrasi 1D: Read Also inline mendahulukan kategori+platform yang sama (sampel)', () => {
  runBuild('--samples', NOW);
  const h = fs.readFileSync(D('best-steam-autumn-sale-picks.html'), 'utf8');   // recommendations / pc
  const inline = [...h.split('id="read-also-inline"')[1].split('</aside>')[0].matchAll(/class="card-link" href="\/([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(inline, ['best-family-games-on-nintendo-switch', '10-light-rpgs-for-midrange-android-phones'], 'hanya 2 artikel recommendations lain → daftar pendek, tanpa mengisi dari kategori lain');
  const n = fs.readFileSync(D('new-moba-season-fresh-heroes-and-map.html'), 'utf8');   // news / mobile
  const ninline = [...n.split('id="read-also-inline"')[1].split('</aside>')[0].matchAll(/class="card-link" href="\/([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ninline.length, 3, 'inline maks. 3');
  const plat = (slug) => JSON.parse(fs.readFileSync(path.join(ROOT, 'dev/sample-articles', `${slug}.json`), 'utf8')).platform;
  const mobileFirst = ninline.map(plat);
  const firstOther = mobileFirst.findIndex((p) => p !== 'mobile');
  assert.ok(firstOther === -1 || mobileFirst.slice(firstOther).every((p) => p !== 'mobile'), 'platform sama selalu di depan platform lain');
});
test('integrasi 1D: OG/Twitter ada di semua halaman (statis, beranda, 404)', () => {
  runBuild('--samples', NOW);
  for (const f of ['index.html', 'about.html', '404.html']) {
    const h = fs.readFileSync(D(f), 'utf8');
    assert.match(h, /<meta property="og:site_name" content="Cava Games">/, f);
    assert.match(h, /<meta property="og:type" content="website">/, f);
    assert.match(h, /<meta property="og:locale" content="en_US">/, f);
    assert.match(h, /<meta name="twitter:card" content="summary">/, f);
    assert.ok(!/og:image/.test(h), `${f}: tanpa og:image (belum ada gambar bawaan)`);
  }
});
test('JS 1D: Copy link — fitur terdeteksi, sintaks valid', () => {
  const src = fs.readFileSync(path.join(ROOT, 'public/js/main.js'), 'utf8');
  execFileSync('node', ['-c', path.join(ROOT, 'public/js/main.js')]);
  assert.match(src, /function initShare\(\)/);
  assert.match(src, /navigator\.clipboard\.writeText/);
  assert.match(src, /initShare\(\); initSearchPage\(\); \}/);
});

// ════════════════════════ TAHAP 1E (halaman daftar) ════════════════════════
test('paginate/listPath/pageWindow: pembagian halaman, path, jendela nomor', () => {
  assert.deepEqual(B.paginate([], 20), [[]], 'daftar kosong tetap satu halaman');
  assert.deepEqual(B.paginate([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.equal(B.paginate(Array(20).fill(0), 20).length, 1);
  assert.equal(B.paginate(Array(21).fill(0), 20).length, 2);
  assert.equal(B.listPath('/news', 1), '/news'); assert.equal(B.listPath('/news/mobile', 3), '/news/mobile/page/3');
  assert.deepEqual(B.pageWindow(1, 1), [1]);
  assert.deepEqual(B.pageWindow(2, 3), [1, 2, 3]);
  assert.deepEqual(B.pageWindow(1, 9), [1, 2, 'gap', 9]);
  assert.deepEqual(B.pageWindow(5, 9), [1, 'gap', 4, 5, 6, 'gap', 9]);
  assert.deepEqual(B.pageWindow(9, 9), [1, 'gap', 8, 9]);
  assert.deepEqual(B.pageWindow(4, 9), [1, 'gap', 3, 4, 5, 'gap', 9]);
  assert.deepEqual(B.pageWindow(3, 9), [1, 2, 3, 4, 'gap', 9]);
});
test('paginationHtml: kosong bila 1 halaman; Previous/Next + halaman aktif + celah; tautan benar', () => {
  assert.equal(B.paginationHtml('/news', 1, 1), '');
  const h1 = B.paginationHtml('/news/mobile', 1, 3);
  assert.ok(!/Previous/.test(h1)); assert.match(h1, /<a class="chip" href="\/news\/mobile\/page\/2" rel="next" aria-label="Next page">Next<\/a>/);
  assert.match(h1, /<span class="chip" aria-current="page" aria-label="Page 1, current page">1<\/span>/);
  assert.match(h1, /<a class="chip" href="\/news\/mobile\/page\/3" aria-label="Page 3">3<\/a>/);
  const h2 = B.paginationHtml('/news', 2, 3);
  assert.match(h2, /href="\/news" rel="prev"/, 'halaman 1 = path dasar, bukan /page/1');
  assert.ok(!/\/page\/1/.test(h2));
  const h5 = B.paginationHtml('/x', 5, 9);
  assert.equal((h5.match(/pagination-gap/g) || []).length, 2); assert.match(h5, /aria-hidden="true">…</);
  assert.match(h5, /<nav class="pagination" aria-label="Pagination">/);
});
test('chipStripHtml & breadcrumbHtml: aria-current, escape, segmen tengah tanpa url = teks', () => {
  const h = B.chipStripHtml('Filter by platform', [{ label: 'All', href: '/news', current: false }, { label: 'P<C>', href: '/news/pc', current: true }]);
  assert.match(h, /<nav class="chip-strip" aria-label="Filter by platform">/);
  assert.match(h, /<a class="chip" href="\/news\/pc" aria-current="page">P&lt;C&gt;<\/a>/);
  assert.equal((h.match(/aria-current/g) || []).length, 1);
  const bc = B.breadcrumbHtml([{ name: 'Home', url: '/' }, { name: 'Tag' }, { name: 'RPG' }]);
  assert.match(bc, /<li><span>Tag<\/span><\/li>/); assert.match(bc, /<li><span aria-current="page">RPG<\/span><\/li>/);
  assert.equal((bc.match(/<a /g) || []).length, 1);
});

const aSite2 = (list, over = {}) => aSite(list, { cfg: Object.assign({ listing: { perPage: 3, tagPageMinArticles: 3, indexMinArticles: 3 } }, over.cfg || {}) });
test('listingPages: judul/canonical/deskripsi per halaman, robots, daftar kosong, escape', () => {
  const list = Array.from({ length: 7 }, (_, i) => art(`a${i}`, { days: i }));
  const site = aSite2(list);
  const pages = B.listingPages(site, { base: '/x', h1: 'Tom & <b>Jerry</b>', description: 'Desc.', list: site.published, breadcrumb: [{ name: 'Home', url: '/' }, { name: 'X' }], robots: 'noindex,follow' });
  assert.deepEqual(pages.map((p) => p.path), ['/x', '/x/page/2', '/x/page/3']);
  const [p1, p2, p3] = pages.map((p) => p.html);
  assert.match(p1, /<title>Tom &amp; &lt;b&gt;Jerry&lt;\/b&gt; — Cava Games<\/title>/);
  assert.match(p2, /<title>Tom &amp; &lt;b&gt;Jerry&lt;\/b&gt; — Page 2 — Cava Games<\/title>/);
  assert.match(p2, /<link rel="canonical" href="https:\/\/t\.example\/x\/page\/2">/);
  assert.match(p3, /content="Desc\. Page 3\."/);
  assert.match(p1, /<meta name="robots" content="noindex,follow">/);
  for (const h of [p1, p2, p3]) { assert.equal((h.match(/<h1[ >]/g) || []).length, 1); assert.ok(!/<b>Jerry/.test(h)); assert.ok(!/\{\{/.test(h)); }
  assert.equal((p1.match(/class="card-link"/g) || []).length, 3); assert.equal((p3.match(/class="card-link"/g) || []).length, 1);
  assert.match(p1, /<h2 class="visually-hidden">Articles<\/h2>/);
  const all = pages.flatMap((p) => [...p.html.matchAll(/class="card-link" href="\/([^"]+)"/g)].map((m) => m[1]));
  assert.deepEqual(all, slugs(site.published), 'urutan terbaru → lama, tiap artikel tepat sekali di seluruh halaman');
  const empty = B.listingPages(site, { base: '/e', h1: 'E', description: 'D', list: [], breadcrumb: [{ name: 'Home', url: '/' }, { name: 'E' }], emptyHtml: 'None <a href="/latest">latest</a>' })[0].html;
  assert.match(empty, /<p class="list-empty">None <a href="\/latest">latest<\/a><\/p>/); assert.ok(!/pagination|card-link/.test(empty));
  assert.match(B.listingPages(site, { base: '/d', h1: 'D', description: 'x', list: [], breadcrumb: [{ name: 'Home', url: '/' }, { name: 'D' }] })[0].html, /robots" content="max-image-preview:large"/);
});
test('buildListings: set halaman, noindex < 3, tag ≥ 3, penulis tanpa artikel dilewati, panel menandai halaman aktif', () => {
  const list = [
    ...[0, 1, 2].map((i) => art(`n-m${i}`, { category: 'news', platform: 'mobile', tags: ['rpg'], days: i })),
    art('r-pc', { category: 'reviews', platform: 'pc', tags: ['moba'], days: 4 }),
    art('g-con', { category: 'guides', platform: 'console', tags: ['rpg'], days: 5 }),
  ];
  const site = aSite(list, { cfg: { listing: { perPage: 20, tagPageMinArticles: 3, indexMinArticles: 3 } } });
  site.authors.push({ id: 'ghost', name: 'Ghost', slug: 'ghost', bio: '', avatar: null });
  const pages = B.buildListings(site);
  const paths = pages.map((p) => p.path).sort();
  const expected = ['/latest', ...['news', 'reviews', 'guides', 'recommendations'].flatMap((c) => [`/${c}`, `/${c}/mobile`, `/${c}/pc`, `/${c}/console`]), '/tag/rpg', '/author/editors'].sort();
  assert.deepEqual(paths, expected, '1 latest + 16 kategori/kombinasi + tag rpg (4 artikel; moba hanya 1) + 1 penulis (ghost tanpa halaman)');
  const get = (p) => pages.find((x) => x.path === p).html;
  const robots = (p) => (get(p).match(/name="robots" content="([^"]*)"/) || [])[1];
  assert.equal(robots('/news'), 'max-image-preview:large');
  assert.equal(robots('/news/mobile'), 'max-image-preview:large', '3 artikel → terindeks');
  assert.equal(robots('/news/pc'), 'noindex,follow', '0 artikel → noindex, halaman tetap ada');
  assert.equal(robots('/reviews/pc'), 'noindex,follow');
  assert.equal(robots('/author/editors'), 'max-image-preview:large', '5 artikel');
  assert.match(get('/news/pc'), /list-empty">No PC News articles yet\. See <a href="\/news">all News<\/a>/);
  // breadcrumb
  assert.match(get('/news/pc'), /<a href="\/">Home<\/a><\/li>\s*<li><a href="\/news">News<\/a><\/li>\s*<li><span aria-current="page">PC<\/span>/);
  assert.match(get('/tag/rpg'), /<li><span>Tag<\/span><\/li>\s*<li><span aria-current="page">RPG<\/span>/);
  assert.match(get('/author/editors'), /<li><span>Author<\/span><\/li>/);
  // strip chip + panel
  assert.match(get('/news/mobile'), /<a class="chip" href="\/news">All<\/a>[\s\S]*<a class="chip" href="\/news\/mobile" aria-current="page">Mobile<\/a>/);
  assert.match(get('/news'), /<a class="chip" href="\/news" aria-current="page">All<\/a>/);
  assert.ok(!/chip-strip/.test(get('/latest')) && !/chip-strip/.test(get('/tag/rpg')));
  assert.match(get('/reviews/pc'), /id="acc-btn-reviews" aria-expanded="false"/, 'akordeon tidak auto-terbuka menurut halaman');
  assert.match(get('/reviews/pc'), /<a href="\/reviews\/pc" aria-current="page">PC<\/a>/);
  assert.match(get('/news'), /<a href="\/news" aria-current="page">All News<\/a>/);
  assert.ok(!/aria-expanded="true"/.test(get('/latest').split('<main')[0]), '/latest: akordeon tertutup');
  // tag rpg berisi 4 artikel; judul platform
  assert.equal((get('/tag/rpg').match(/class="card-link"/g) || []).length, 4);
  assert.match(get('/guides/console'), /<h1 class="page-title">Console Guides<\/h1>/);
});

test('integrasi 1E: seluruh halaman daftar ada, paginasi 20/halaman, setiap artikel tepat sekali di /latest', () => {
  runBuild('--samples', NOW);
  for (const f of ['latest.html', 'latest/page/2.html', 'news.html', 'reviews.html', 'guides.html', 'recommendations.html', 'tag/rpg.html', 'author/editors.html', 'author/editors/page/2.html']) assert.ok(fs.existsSync(D(f)), f);
  for (const c of ['news', 'reviews', 'guides', 'recommendations']) for (const pl of ['mobile', 'pc', 'console']) assert.ok(fs.existsSync(D(c, `${pl}.html`)), `${c}/${pl}`);
  assert.ok(!fs.existsSync(D('latest', 'page', '3.html')) && !fs.existsSync(D('news', 'page', '2.html')), 'tidak ada halaman paginasi kosong');
  const cards = (f) => [...fs.readFileSync(D(f), 'utf8').matchAll(/class="card-link" href="\/([^"]+)"/g)].map((m) => m[1]);
  const latest = [...cards('latest.html'), ...cards('latest/page/2.html')];
  assert.equal(cards('latest.html').length, 20); assert.equal(latest.length, 21); assert.equal(new Set(latest).size, 21);
  const authorAll = [...cards('author/editors.html'), ...cards('author/editors/page/2.html')];
  assert.deepEqual(authorAll.sort(), [...latest].sort());
  // jumlah per kategori dari data
  const meta = fs.readdirSync(path.join(ROOT, 'dev/sample-articles')).map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'dev/sample-articles', f), 'utf8'))).filter((a) => a.status === 'published' && Date.parse(a.publishedAt) <= Date.parse('2026-10-09T12:00:00+07:00'));
  for (const c of ['news', 'reviews', 'guides', 'recommendations']) {
    assert.equal(cards(`${c}.html`).length, meta.filter((a) => a.category === c).length, c);
    for (const pl of ['mobile', 'pc', 'console']) {
      const n = meta.filter((a) => a.category === c && a.platform === pl).length;
      assert.equal(cards(`${c}/${pl}.html`).length, n, `${c}/${pl}`);
      const robots = fs.readFileSync(D(c, `${pl}.html`), 'utf8').match(/name="robots" content="([^"]*)"/)[1];
      assert.equal(robots, n < 3 ? 'noindex,follow' : 'max-image-preview:large', `${c}/${pl} robots`);
    }
  }
  // hanya tag dengan ≥ 3 artikel punya halaman
  const tagCount = {}; for (const a of meta) for (const t of a.tags) tagCount[t] = (tagCount[t] || 0) + 1;
  const tagFiles = fs.readdirSync(D('tag')).map((f) => f.replace('.html', '')).sort();
  assert.deepEqual(tagFiles, Object.keys(tagCount).filter((t) => tagCount[t] >= 3).sort());
});
test('integrasi 1E: judul dan deskripsi unik di seluruh situs; tautan tag/related/penulis semua valid', () => {
  runBuild('--samples', NOW);
  const files = []; const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) { if (!['dev-img', 'fonts', 'css', 'js'].includes(e.name)) walk(f); } else if (f.endsWith('.html')) files.push(f); } };
  walk(D());
  const titles = new Map(); const descs = new Map();
  for (const f of files) {
    const h = fs.readFileSync(f, 'utf8');
    const t = h.match(/<title>([^<]*)<\/title>/)[1]; const d = (h.match(/<meta name="description" content="([^"]*)"/) || [])[1];
    assert.ok(!titles.has(t), `judul ganda: "${t}" (${path.relative(D(), f)} dan ${titles.get(t)})`); titles.set(t, path.relative(D(), f));
    if (d) { assert.ok(!descs.has(d), `deskripsi ganda: "${d}" (${path.relative(D(), f)} dan ${descs.get(d)})`); descs.set(d, path.relative(D(), f)); }
  }
  assert.ok(files.length >= 55);
  const r = C.checkDist(path.join(ROOT, 'dist'), { pending: [] });
  assert.deepEqual(r.problems, []);
});

// ════════════════════════ TAHAP 1F (sitemap, RSS, robots, JSON-LD daftar) ════════════════════════
const { parseDocument } = require('htmlparser2');
const DomU = require('domutils');
const xmlDoc = (x) => parseDocument(x, { xmlMode: true });
const xmlTexts = (x, tag) => DomU.findAll((e) => e.name === tag, xmlDoc(x).children).map((e) => DomU.textContent(e));
const ldBlocks = (h) => [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

test('lastmodOf/maxLastmod: updatedAt didahulukan; terbaru di antara daftar', () => {
  const a = { publishedAt: '2026-10-01T10:00:00+07:00' }; const b = { publishedAt: '2026-09-01T10:00:00+07:00', updatedAt: '2026-10-05T10:00:00+07:00' };
  assert.equal(B.lastmodOf(a), a.publishedAt); assert.equal(B.lastmodOf(b), b.updatedAt);
  assert.equal(B.maxLastmod([a, b]), b.updatedAt); assert.equal(B.maxLastmod([]), undefined);
});
test('breadcrumbJsonLd: segmen tengah tanpa url dilewati; item terakhir memakai URL halaman ini', () => {
  const site = aSite([art('x')]);
  const mk = (items, p) => JSON.parse(B.breadcrumbJsonLd(site, items, p).replace(/^<script[^>]*>/, '').replace(/<\/script>$/, ''));
  const t = mk([{ name: 'Home', url: '/' }, { name: 'Tag' }, { name: 'RPG' }], '/tag/rpg');
  assert.equal(t['@type'], 'BreadcrumbList');
  assert.deepEqual(t.itemListElement.map((i) => [i.position, i.name, i.item]), [[1, 'Home', 'https://t.example/'], [2, 'RPG', 'https://t.example/tag/rpg']]);
  const p = mk([{ name: 'Home', url: '/' }, { name: 'News', url: '/news' }, { name: 'PC' }], '/news/pc/page/2');
  assert.deepEqual(p.itemListElement.map((i) => i.item), ['https://t.example/', 'https://t.example/news', 'https://t.example/news/pc/page/2']);
});
test('personJsonLd: bio dan avatar hanya bila ada', () => {
  const site = aSite([art('x')]); site.cfg.images.base = '/img/';
  const get = (au) => JSON.parse(B.personJsonLd(site, au).replace(/^<script[^>]*>/, '').replace(/<\/script>$/, ''));
  assert.deepEqual(get({ name: 'Ed', slug: 'ed', bio: '', avatar: null }), { '@context': 'https://schema.org', '@type': 'Person', name: 'Ed', url: 'https://t.example/author/ed' });
  const full = get({ name: 'Ed', slug: 'ed', bio: 'Hi', avatar: 'a/ed.webp' });
  assert.equal(full.description, 'Hi'); assert.equal(full.image, 'https://t.example/img/a/ed.webp');
});
test('xmlEsc & sitemapXml: escape, lastmod opsional, batas 50.000 URL', () => {
  assert.equal(B.xmlEsc(`a&b<c>"d"'e'`), 'a&amp;b&lt;c&gt;&quot;d&quot;&apos;e&apos;');
  const cfg = { siteUrl: 'https://t.example/' };
  const x = B.sitemapXml(cfg, [{ path: '/', lastmod: '2026-10-01T00:00:00+07:00' }, { path: '/a&b' }]);
  assert.match(x, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.deepEqual(xmlTexts(x, 'loc'), ['https://t.example/', 'https://t.example/a&b']);
  assert.deepEqual(xmlTexts(x, 'lastmod'), ['2026-10-01T00:00:00+07:00']);
  assert.ok(x.includes('<loc>https://t.example/a&amp;b</loc>'));
  assert.throws(() => B.sitemapXml(cfg, Array.from({ length: 50001 }, (_, i) => ({ path: `/p${i}` }))), /sitemap index/);
  assert.doesNotThrow(() => B.sitemapXml(cfg, Array.from({ length: 50000 }, (_, i) => ({ path: `/p${i}` }))));
});
test('sitemapEntries: beranda + daftar halaman 1 terindeks + halaman statis non-draf + artikel; tanpa paginasi/noindex/draf', () => {
  const site = aSite([art('a1', { days: 1 }), { ...art('a2', { days: 2 }), updatedAt: '2026-12-01T00:00:00+07:00' }]);
  site.pages = [{ slug: 'about', draft: false, updatedAt: '2026-10-09T09:00:00+07:00' }, { slug: 'terms', draft: true, updatedAt: '2026-10-09T09:00:00+07:00' }];
  const listings = [
    { base: '/news', n: 1, noindex: false, lastmod: 'L1' }, { base: '/news', n: 2, noindex: false, lastmod: 'L1' },
    { base: '/news/pc', n: 1, noindex: true, lastmod: undefined }, { base: '/tag/rpg', n: 1, noindex: false, lastmod: 'L2' },
  ];
  const e = B.sitemapEntries(site, listings);
  assert.deepEqual(e.map((x) => x.path), ['/', '/news', '/tag/rpg', '/about', '/a1', '/a2']);
  assert.equal(e[0].lastmod, '2026-12-01T00:00:00+07:00', 'beranda = lastmod terbaru');
  assert.equal(e.find((x) => x.path === '/a2').lastmod, '2026-12-01T00:00:00+07:00');
  assert.equal(e.find((x) => x.path === '/about').lastmod, '2026-10-09T09:00:00+07:00');
});
test('feedXml: RSS 2.0 ringkasan — dibatasi N, terbaru dulu, RFC 822, escape, tanpa isi artikel', () => {
  const list = [art('old', { days: 5 }), art('mid', { days: 3, title: 'Tom & <Jerry> "q"' }), art('new', { days: 1 }), art('newest', { days: 0 })];
  list.forEach((a) => { a.body = '<p>SECRET-BODY-TEXT</p>'; });
  const site = aSite(list, { cfg: { feed: { items: 3 }, lang: 'en', description: 'Desc & more' } });
  site.now = new Date('2026-10-09T00:00:00Z');
  const x = B.feedXml(site);
  assert.match(x, /<rss version="2\.0" xmlns:atom=/);
  assert.deepEqual(xmlTexts(x, 'title'), ['Cava Games', 'Title newest', 'Title new', 'Tom & <Jerry> "q"'], 'channel + 3 item terbaru, urutan terbaru → lama');
  assert.equal(xmlDoc(x).children.length >= 1, true);
  assert.ok(x.includes('<title>Tom &amp; &lt;Jerry&gt; &quot;q&quot;</title>'));
  assert.ok(!/SECRET-BODY-TEXT/.test(x), 'isi artikel tidak masuk feed');
  assert.equal(xmlTexts(x, 'description')[0], 'Desc & more');
  assert.ok(xmlTexts(x, 'description').slice(1).every((d) => d === 'x'.repeat(100)), 'item memakai excerpt');
  for (const d of xmlTexts(x, 'pubDate')) assert.match(d, /^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/);
  assert.match(x, /<guid isPermaLink="true">https:\/\/t\.example\/newest<\/guid>/);
  assert.match(x, /<media:content url="https:\/\/t\.example\/img\/[^"]+" medium="image" type="image\/webp" width="1200" height="675"\/>/);
  assert.match(x, /<category>News<\/category>\s*<category>Mobile<\/category>/);
  assert.match(x, /<dc:creator>Ed<\/dc:creator>/);
  assert.match(x, /<atom:link href="https:\/\/t\.example\/feed\.xml" rel="self" type="application\/rss\+xml"\/>/);
  assert.equal(xmlTexts(x, 'lastBuildDate')[0], new Date(list[3].publishedAt).toUTCString(), 'lastBuildDate = artikel terbaru (stabil antar build)');
  const none = B.feedXml(aSite([]));
  assert.ok(!/<item>/.test(none)); assert.equal((none.match(/<lastBuildDate>/g) || []).length, 1);
});
test('robotsTxt: izinkan semua, blokir /api/, tunjuk sitemap', () => {
  assert.equal(B.robotsTxt({ siteUrl: 'https://t.example/' }), 'User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: https://t.example/sitemap.xml\n');
});
test('listingPages: metadata untuk sitemap (noindex, lastmod, n, base) dan JSON-LD', () => {
  const site = aSite([art('a', { days: 2 }), { ...art('b', { days: 1 }), updatedAt: '2026-11-01T00:00:00+07:00' }]);
  const [pg] = B.listingPages(site, { base: '/tag/x', h1: 'X', description: 'd', list: site.published, breadcrumb: [{ name: 'Home', url: '/' }, { name: 'Tag' }, { name: 'X' }], robots: 'noindex,follow' });
  assert.deepEqual([pg.n, pg.base, pg.noindex, pg.lastmod], [1, '/tag/x', true, '2026-11-01T00:00:00+07:00']);
  assert.deepEqual(ldBlocks(pg.html).map((b) => b['@type']), ['BreadcrumbList']);
});

test('integrasi 1F: sitemap.xml = tepat himpunan halaman terindeks (tanpa noindex, paginasi, 404, draf)', () => {
  runBuild('--samples', NOW);
  const locs = xmlTexts(fs.readFileSync(D('sitemap.xml'), 'utf8'), 'loc');
  assert.equal(new Set(locs).size, locs.length, 'tanpa duplikat');
  const need = []; const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) { if (!['dev-img', 'fonts', 'css', 'js'].includes(e.name)) walk(f); } else if (f.endsWith('.html')) need.push(f); } };
  walk(D());
  const indexable = need.filter((f) => !/404\.html$/.test(f) && !/[\\/]page[\\/]/.test(f)).map((f) => ({ f, h: fs.readFileSync(f, 'utf8') })).filter(({ h }) => !/name="robots" content="[^"]*noindex/.test(h)).map(({ h }) => h.match(/rel="canonical" href="([^"]+)"/)[1]);
  assert.deepEqual([...locs].sort(), [...indexable].sort());
  assert.ok(locs.length >= 30);
  for (const l of locs) assert.ok(fs.existsSync(D(`${l.replace('https://cava-games.example', '').replace(/^\/$/, '/index').slice(1)}.html`)), `${l} punya berkas`);
  const lm = xmlTexts(fs.readFileSync(D('sitemap.xml'), 'utf8'), 'lastmod');
  assert.ok(lm.length === locs.length && lm.every((d) => !Number.isNaN(Date.parse(d))));
});
test('integrasi 1F: feed.xml, robots.txt, tautan RSS di semua halaman, JSON-LD halaman daftar', () => {
  runBuild('--samples', NOW);
  const feed = fs.readFileSync(D('feed.xml'), 'utf8');
  const links = xmlTexts(feed, 'link').slice(1);
  assert.equal(links.length, 21); assert.ok(links.every((l) => l.startsWith('https://cava-games.example/')));
  const dates = xmlTexts(feed, 'pubDate').map((d) => Date.parse(d));
  assert.deepEqual([...dates].sort((x, y) => y - x), dates, 'terbaru → lama');
  assert.ok(!/<p>|Paragraph \d/.test(feed), 'ringkasan saja');
  assert.equal(fs.readFileSync(D('robots.txt'), 'utf8'), 'User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: https://cava-games.example/sitemap.xml\n');
  for (const f of ['index.html', 'about.html', '404.html', 'news.html', 'tag/rpg.html', 'new-moba-season-fresh-heroes-and-map.html']) {
    assert.match(fs.readFileSync(D(f), 'utf8'), /<link rel="alternate" type="application\/rss\+xml" title="Cava Games" href="https:\/\/cava-games\.example\/feed\.xml">/, f);
  }
  const types = (f) => ldBlocks(fs.readFileSync(D(f), 'utf8')).map((b) => b['@type']);
  assert.deepEqual(types('news/pc.html'), ['BreadcrumbList']); assert.deepEqual(types('tag/rpg.html'), ['BreadcrumbList']);
  assert.deepEqual(types('latest.html'), ['BreadcrumbList']); assert.deepEqual(types('author/editors.html'), ['BreadcrumbList', 'Person']);
  assert.deepEqual(types('author/editors/page/2.html'), ['BreadcrumbList', 'Person']);
  assert.deepEqual(types('about.html'), ['BreadcrumbList']); assert.deepEqual(types('contact.html'), [], 'halaman draf (noindex): tanpa data terstruktur');
  assert.deepEqual(types('index.html'), []); assert.deepEqual(types('404.html'), []);
  assert.deepEqual(types('best-steam-autumn-sale-picks.html'), ['NewsArticle', 'BreadcrumbList']);
  const bc = ldBlocks(fs.readFileSync(D('news/pc.html'), 'utf8'))[0].itemListElement.map((i) => i.name);
  assert.deepEqual(bc, ['Home', 'News', 'PC']);
});

// ───────── fase 3B: view + peringkat dari /api/popular ─────────
test('integrasi 3B: popular-cards.json — kolam artikel terbaru, kartu slide + row (peringkat 1), tanpa duplikat markup di JS', () => {
  runBuild('--samples', NOW);
  const cards = JSON.parse(fs.readFileSync(D('data', 'popular-cards.json'), 'utf8'));
  const slugs = Object.keys(cards);
  assert.equal(slugs.length, 21, 'semua artikel terbit (kolam 100 > jumlah artikel)');
  for (const s of slugs) {
    assert.ok(fs.existsSync(D(`${s}.html`)), `${s} punya halaman`);
    assert.match(cards[s].slide, /^<article class="card card-hero card-hero--carousel">/);
    assert.ok(cards[s].slide.includes(`href="/${s}"`) && cards[s].row.includes(`href="/${s}"`), `${s}: tautan kartu`);
    assert.match(cards[s].row, /^<article class="card card-row">[\s\S]*<span class="card-rank" aria-hidden="true">1 \/<\/span>/);
    assert.ok(!/fetchpriority/.test(cards[s].slide), 'tidak ada slide LCP eager di kartu tukar');
  }
  assert.ok(!/<script/i.test(JSON.stringify(cards)));
  const headers = fs.readFileSync(D('_headers'), 'utf8');
  assert.match(headers, /\/data\/\*\n {2}! Cache-Control\n {2}Cache-Control: public, max-age=31536000, immutable/);
});
test('integrasi 3B: atribut penanda di beranda dan artikel; daftar Trending/dedupe bertanda; versi URL = CACHE_BUST', () => {
  runBuild('--samples', NOW);
  const home = fs.readFileSync(D('index.html'), 'utf8');
  const art = fs.readFileSync(D('best-steam-autumn-sale-picks.html'), 'utf8');
  const src = home.match(/<main[^>]* data-popular-src="(\/data\/popular-cards\.json\?v=\d+)"/);
  assert.ok(src, 'beranda punya data-popular-src');
  assert.match(art, new RegExp(`<main[^>]* data-view-slug="best-steam-autumn-sale-picks"[^>]* data-popular-src="${src[1].replace(/[?.]/g, '\\$&')}"`));
  assert.equal((art.match(/class="row-list" data-trending>/g) || []).length, 2, 'Trending bawah + sidebar');
  assert.ok(/data-dedupe-trending/.test(art), 'Related/Latest sidebar bertanda dedupe');
  for (const f of ['about.html', 'news.html', 'tag/rpg.html', '404.html', 'search.html']) {
    assert.ok(!/data-popular-src|data-view-slug/.test(fs.readFileSync(D(f), 'utf8')), `${f} tanpa penanda 3B`);
  }
});
test('integrasi 3B: tanpa artikel terbit → tanpa popular-cards.json dan tanpa atribut; config popular divalidasi', () => {
  runBuild(NOW);
  assert.ok(!fs.existsSync(D('data', 'popular-cards.json')));
  assert.ok(!/data-popular-src/.test(fs.readFileSync(D('index.html'), 'utf8')));
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
  assert.equal(cfg.popular.pool, 100);
  assert.equal(B.popularAttr({ cfg: { popular: { pool: 0 } }, published: [{}], assets: { v: '1' } }), '');
  assert.equal(B.popularAttr({ cfg: {}, published: [{}], assets: { v: '1' } }), '');
  assert.equal(B.popularAttr({ cfg: { popular: { pool: 5 } }, published: [{}], assets: { v: '9' } }), ' data-popular-src="/data/popular-cards.json?v=9"');
});
test('JS 3B: view + popular — fitur terdeteksi, tanpa innerHTML/eval, error ditelan, penanda sessionStorage', () => {
  const js = fs.readFileSync(path.join(ROOT, 'public', 'js', 'main.js'), 'utf8');
  assert.match(js, /\/api\/view/); assert.match(js, /\/api\/popular\?limit=/);
  assert.match(js, /sendBeacon/); assert.match(js, /keepalive: true/);
  assert.match(js, /\.catch\(function \(\) \{ \/\* API\/kuota habis/);
  assert.match(js, /new DOMParser\(\)\.parseFromString/);
  assert.ok(!/\beval\(|new Function\(/.test(js));
  assert.match(js, /try \{ return method === 'get'/, 'sessionStorage dibungkus try/catch');
  assert.doesNotThrow(() => new Function(js));
});

// ───────── fase 3C: komentar ─────────
test('integrasi 3C: slot komentar di setiap artikel (slug benar, lazy, noscript, di luar indeks Pagefind); tidak ada di halaman lain', () => {
  runBuild('--samples', NOW);
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
  assert.equal(cfg.features.comments, true);
  const arts = fs.readdirSync(path.join(ROOT, 'dist')).filter((f) => /^[a-z0-9-]+\.html$/.test(f) && !['index', '404', 'search', 'about', 'contact', 'terms', 'privacy', 'accessibility', 'news', 'reviews', 'guides', 'recommendations', 'latest'].includes(f.slice(0, -5)));
  assert.ok(arts.length >= 20);
  for (const f of arts) {
    const h = fs.readFileSync(D(f), 'utf8');
    const slug = f.slice(0, -5);
    assert.match(h, new RegExp(`<section class="comments" id="comments"[^>]* data-comments-slug="${slug}" data-comments-src="/js/comments\\.js\\?v=\\d+" data-pagefind-ignore>`), f);
    assert.equal((h.match(/data-comments-open/g) || []).length, 1, f);
    assert.match(h, /<noscript><p class="comments-note">Comments need JavaScript to load\.<\/p><\/noscript>/);
    assert.ok(h.indexOf('class="comments"') > h.indexOf('class="share share--bottom') || h.indexOf('class="comments"') > h.indexOf('article-body'), 'komentar setelah isi');
  }
  for (const f of ['index.html', 'about.html', 'news.html', 'tag/rpg.html', '404.html', 'search.html']) assert.ok(!/data-comments/.test(fs.readFileSync(D(f), 'utf8')), f);
  assert.ok(fs.existsSync(D('js', 'comments.js')));
  assert.ok(fs.statSync(D('js', 'comments.js')).size < 12 * 1024, 'comments.js kecil');
});
test('JS 3C: comments.js tanpa innerHTML/eval, tautan aman, honeypot, try/catch storage; main.js memuat lazy', () => {
  const c = fs.readFileSync(path.join(ROOT, 'public', 'js', 'comments.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const m = fs.readFileSync(path.join(ROOT, 'public', 'js', 'main.js'), 'utf8');
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function\(/.test(c), 'komentar pengguna tidak boleh lewat HTML');
  assert.match(c, /rel = 'nofollow ugc noopener'/);
  assert.match(c, /protocol === 'https:' \|\| u\.protocol === 'http:'/);
  assert.match(c, /name = 'website'/); assert.match(c, /tabIndex = -1/); assert.match(c, /aria-hidden/);
  assert.match(c, /try \{ return window\.localStorage/);
  assert.match(c, /'\/api\/comments\?slug='/);
  assert.doesNotThrow(() => new Function(c));
  assert.match(m, /function initComments/); assert.match(m, /IntersectionObserver/); assert.match(m, /data-comments-src/);
  assert.ok(!/innerHTML/.test(m.replace(/\/\/.*$/gm, '').match(/function initComments[\s\S]*?\n {2}\}\n/)[0]));
});
test('integrasi 3C: features.comments=false → tanpa slot dan tanpa comments.js', () => {
  const site = { cfg: { features: { comments: false } }, assets: { v: '1' } };
  assert.equal(B.commentsUi(site, { slug: 'x' }), '');
  assert.match(B.commentsUi({ cfg: { features: { comments: true } }, assets: { v: '7' } }, { slug: 'a-b' }), /data-comments-slug="a-b" data-comments-src="\/js\/comments\.js\?v=7"/);
});
