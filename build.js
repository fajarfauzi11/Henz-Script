/* build.js — Henz MLBB static site build script
   Membaca semua file di public/, mengganti placeholder
   <!-- include:nama.html --> dengan isi public/partials/nama.html,
   lalu menulis hasilnya ke dist/. File non-HTML di-copy apa adanya.
*/
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'public');
const OUT_DIR = path.join(__dirname, 'dist');
const PARTIALS_DIR = path.join(SRC_DIR, 'partials');

/* Domain resmi — dipakai buat canonical, Open Graph, dan sitemap.xml */
const BASE_URL = 'https://www.henzscript.com';
/* Cache-busting: setiap kali build.js dijalankan, semua link css/js dapat query ?v=xxx baru,
   jadi browser TIDAK BOLEH pakai cache lama begitu file di-deploy ulang. Ini akar solusi dari
   berulangnya kasus "user test pakai file/versi lama yang ke-cache di browser". */
const CACHE_BUST = Date.now();
function injectCacheBust(html) {
  return html
    .replace(/(href="\/css\/style\.css)(")/g, `$1?v=${CACHE_BUST}$2`)
    .replace(/(src="\/js\/main\.js)(")/g, `$1?v=${CACHE_BUST}$2`)
    .replace(/(src="\/js\/card-template\.js)(")/g, `$1?v=${CACHE_BUST}$2`);
}
/* Batas card yang langsung tampil di detail hero & kategori skin sebelum "Lihat Lebih Banyak" */
const CP_LOADMORE_LIMIT = 20;
function buildLoadMoreParts(matchedCount) {
  const isLimited = matchedCount > CP_LOADMORE_LIMIT;
  return {
    gridLimitClass: isLimited ? ' hz-cp-limited' : '',
    loadmoreHtml: isLimited
      ? '<div class="hz-cp-loadmore-wrap"><button type="button" class="hz-cp-loadmore-btn" data-cp-loadmore>Lihat Lebih Banyak</button></div>'
      : ''
  };
}
function absoluteUrl(pathOrUrl) {
  pathOrUrl = pathOrUrl || '';
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return BASE_URL + (pathOrUrl.startsWith('/') ? pathOrUrl : '/' + pathOrUrl);
}
/* Kumpulan URL buat sitemap.xml, diisi progresif tiap generate*Pages() jalan */
const SITEMAP_URLS = [];
function addSitemapUrl(urlPath, opts) {
  opts = opts || {};
  const loc = absoluteUrl(urlPath);
  if (SITEMAP_URLS.some((u) => u.loc === loc)) return; // hindari duplikat (post JSON vs posts.json)
  SITEMAP_URLS.push({
    loc: loc,
    lastmod: opts.lastmod || null,
    changefreq: opts.changefreq || 'weekly',
    priority: opts.priority != null ? opts.priority : 0.6,
    category: opts.category || 'page'
  });
}
/* "27 Juni 2026" -> "2026-06-27" (buat <lastmod> sitemap) */
const ID_MONTHS = {Januari:'01',Februari:'02',Maret:'03',April:'04',Mei:'05',Juni:'06',Juli:'07',Agustus:'08',September:'09',Oktober:'10',November:'11',Desember:'12'};
function parseIdDate(str) {
  var parts = (str || '').trim().split(/\s+/);
  if (parts.length !== 3 || !ID_MONTHS[parts[1]]) return null;
  var day = parts[0].padStart(2, '0');
  return parts[2] + '-' + ID_MONTHS[parts[1]] + '-' + day;
}

/* Desain card script dipusatkan di public/js/card-template.js (dipakai juga oleh browser lewat window.hzCard) */
const { hzBuildCard } = require(path.join(SRC_DIR, 'js', 'card-template.js'));

const INCLUDE_RE = /<!--\s*include:([\w.-]+)\s*-->/g;

function readPartial(name) {
  const partialPath = path.join(PARTIALS_DIR, name);
  if (!fs.existsSync(partialPath)) {
    throw new Error('Partial tidak ditemukan: ' + partialPath);
  }
  return fs.readFileSync(partialPath, 'utf8');
}

function processHtml(content) {
  const withPartials = content.replace(INCLUDE_RE, (match, partialName) => {
    return readPartial(partialName);
  });
  return injectCacheBust(withPartials);
}

function copyRecursive(srcDir, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === 'partials') continue; // partials tidak ikut di-deploy

    const srcPath = path.join(srcDir, entry.name);
    const outPath = path.join(outDir, entry.name);

    if (entry.isDirectory()) {
      copyRecursive(srcPath, outPath);
    } else if (entry.name.endsWith('.html')) {
      const raw = fs.readFileSync(srcPath, 'utf8');
      const processed = processHtml(raw);
      fs.writeFileSync(outPath, processed, 'utf8');
      console.log('built:', path.relative(SRC_DIR, srcPath));
    } else {
      fs.copyFileSync(srcPath, outPath);
    }
  }
}

console.log('Building site...');
if (fs.existsSync(OUT_DIR)) fs.rmSync(OUT_DIR, { recursive: true, force: true });
copyRecursive(SRC_DIR, OUT_DIR);

/* Halaman post itu file statis manual (bukan template), jadi canonical+OG-nya
   disuntik otomatis di sini dengan mencocokkan <title> ke posts.json.
   Kalau nambah post baru: cukup daftarkan di posts.json seperti biasa,
   tag SEO-nya otomatis ikut ke-generate tanpa perlu edit HTML manual. */
function injectPostSeoTags() {
  const postsPath = path.join(SRC_DIR, 'js', 'posts.json');
  const postOutDir = path.join(OUT_DIR, 'post');
  if (!fs.existsSync(postsPath) || !fs.existsSync(postOutDir)) {
    console.log('Lewati inject SEO post: posts.json atau folder post tidak ditemukan.');
    return;
  }
  const posts = JSON.parse(fs.readFileSync(postsPath, 'utf8'));
  const byTitle = {};
  posts.forEach((p) => { if (p.title) byTitle[p.title] = p; });

  const files = fs.readdirSync(postOutDir).filter((f) => f.endsWith('.html'));
  files.forEach((fname) => {
    const fpath = path.join(postOutDir, fname);
    let html = fs.readFileSync(fpath, 'utf8');
    if (html.indexOf('rel="canonical"') !== -1) return; // sudah ada, jangan dobel

    const m = html.match(/<title>(.*?)<\/title>/);
    if (!m) return;
    const title = m[1];
    const post = byTitle[title];
    if (!post || !post.url) {
      console.log('Lewati inject SEO (judul tidak match posts.json):', fname);
      return;
    }

    const canonicalUrl = absoluteUrl(post.url);
    const ogImage = post.thumb ? absoluteUrl(post.thumb) : absoluteUrl('/favicon.png');
    const ogDesc = 'Download script skin ' + title + ' terbaru dari Henz MLBB, mudah dipasang dan selalu update.';

    const tags = '<link rel="canonical" href="' + canonicalUrl + '"/>\n'
      + '<meta property="og:type" content="article"/>\n'
      + '<meta property="og:site_name" content="Henz MLBB"/>\n'
      + '<meta property="og:title" content="' + escHtml(title) + ' — Henz MLBB"/>\n'
      + '<meta property="og:description" content="' + escHtml(ogDesc) + '"/>\n'
      + '<meta property="og:url" content="' + canonicalUrl + '"/>\n'
      + '<meta property="og:image" content="' + ogImage + '"/>\n'
      + '<meta name="twitter:card" content="summary_large_image"/>';

    html = html.replace(m[0], m[0] + '\n' + tags);
    fs.writeFileSync(fpath, html, 'utf8');
    console.log('injected SEO tags: post/' + fname);
  });
}
injectPostSeoTags();
/* ===================== Hero detail pages (dari heroes.json + posts.json) ===================== */

const ROLE_CONFIG = {
  assassin: { label: 'Assassin', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5l14 14M19 5L5 19"/></svg>' },
  fighter:  { label: 'Fighter',  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v13M8 7l4-4 4 4M6 22h12M9 22v-4h6v4"/></svg>' },
  mage:     { label: 'Mage',     icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg>' },
  marksman: { label: 'Marksman', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>' },
  support:  { label: 'Support',  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.35-9.5-8.5C.5 8.5 3 5 6.5 5c2 0 3.5 1.5 4.5 3 1-1.5 2.5-3 4.5-3 3.5 0 6 3.5 4 7.5C19 16.65 12 21 12 21z"/></svg>' },
  tank:     { label: 'Tank',     icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z"/></svg>' }
};

function slugify(name) {
  return (name || '')
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
}

function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateHeroPages() {
  const heroesPath = path.join(SRC_DIR, 'js', 'heroes.json');
  const postsPath = path.join(SRC_DIR, 'js', 'posts.json');
  if (!fs.existsSync(heroesPath) || !fs.existsSync(postsPath)) {
    console.log('Lewati generate hero pages: heroes.json atau posts.json tidak ditemukan.');
    return;
  }
  const heroes = JSON.parse(fs.readFileSync(heroesPath, 'utf8'));
  const posts = JSON.parse(fs.readFileSync(postsPath, 'utf8'));
  const template = fs.readFileSync(path.join(PARTIALS_DIR, 'hero-template.html'), 'utf8');

  // Pencocokan post -> hero:
  // 1) Prioritas: field eksplisit `hero` di posts.json (diisi manual lewat tool, exact match ke nama hero — aman buat nama hero 1 kata maupun lebih)
  // 2) Fallback: kata pertama judul (lowercase) — cara lama, dipertahankan biar post lama yang belum punya field `hero` tetap muncul
  const postsByHeroName = {};
  const postsByFirstWord = {};
  posts.forEach((p) => {
    if (p.hero && String(p.hero).trim()) {
      const key = String(p.hero).trim().toLowerCase();
      if (!postsByHeroName[key]) postsByHeroName[key] = [];
      postsByHeroName[key].push(p);
      return; // sudah punya field eksplisit, gak perlu masuk fallback first-word
    }
    const firstWord = (p.title || '').trim().split(/\s+/)[0];
    if (!firstWord) return;
    const key = firstWord.toLowerCase();
    if (!postsByFirstWord[key]) postsByFirstWord[key] = [];
    postsByFirstWord[key].push(p);
  });

  const heroOutDir = path.join(OUT_DIR, 'hero');
  fs.mkdirSync(heroOutDir, { recursive: true });

  heroes.forEach((h) => {
    const roleKey = (h.role || '').toLowerCase();
    const role = Object.assign({}, ROLE_CONFIG[roleKey] || { label: h.role || '', icon: '' });
    const role2Key = (h.role2 || '').toLowerCase();
    const role2Cfg = role2Key ? ROLE_CONFIG[role2Key] : null;
    if (role2Cfg) role.label = role.label + '/' + role2Cfg.label;
    const slug = slugify(h.name);
    if (!slug) return;
    const heroKey = (h.name || '').toLowerCase();
    const matched = (postsByHeroName[heroKey] || []).concat(postsByFirstWord[heroKey] || []);

    // Saran pill: cari SEMUA hero lain dgn role (atau role2) yg overlap & SUDAH punya script.
    // Tidak di-slice ke 3 di sini — semua kandidat disimpan sbg data (JSON), lalu 3 dipilih ACAK
    // oleh JS client-side (lihat main.js: hzRenderRandomHeroSuggest) setiap halaman dibuka/refresh,
    // supaya variatif tapi tetap konsisten dalam role yang sama.
    const suggestPool = matched.length ? [] : heroes.filter((other) => {
      if (other.name === h.name) return false;
      const otherRoleKey = (other.role || '').toLowerCase();
      const otherRole2Key = (other.role2 || '').toLowerCase();
      const roleOverlap = otherRoleKey === roleKey || otherRoleKey === role2Key
        || (role2Key && otherRole2Key === role2Key) || (otherRole2Key && otherRole2Key === roleKey);
      if (!roleOverlap) return false;
      const otherKey = (other.name || '').toLowerCase();
      const otherMatched = (postsByHeroName[otherKey] || []).concat(postsByFirstWord[otherKey] || []);
      return otherMatched.length > 0;
    }).map((other) => ({ name: other.name, slug: slugify(other.name) }));
    const suggestPoolJson = JSON.stringify(suggestPool).replace(/'/g, '&#39;');
    const suggestTipsHtml = suggestPool.length
      ? '<div class="hz-sv-empty-tips" id="hz-hero-suggest-tips" data-suggest-pool=\'' + suggestPoolJson + '\'></div>'
      : '';

    const postsHtml = matched.length
      ? matched.map(hzBuildCard).join('\n')
      : '<div class="hz-sv-empty">'
        + '<div class="hz-sv-empty-icon"><svg viewBox="0 0 96 96" fill="none">'
        + '<circle cx="48" cy="48" r="34" stroke="#e6e6e6" stroke-width="7"/>'
        + '<circle cx="48" cy="48" r="34" stroke="#e53232" stroke-width="7" stroke-dasharray="40 400" stroke-linecap="round" transform="rotate(-45 48 48)"/>'
        + '<path d="M32 28h22l10 10v30H32z" stroke="#e53232" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>'
        + '<path d="M54 28v10h10" stroke="#e53232" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>'
        + '<line x1="40" y1="50" x2="56" y2="50" stroke="#e53232" stroke-width="3.5" stroke-linecap="round"/>'
        + '<line x1="40" y1="58" x2="56" y2="58" stroke="#e53232" stroke-width="3.5" stroke-linecap="round"/>'
        + '</svg></div>'
        + '<div class="hz-sv-empty-title">Belum Ada Script</div>'
        + '<p class="hz-sv-empty-sub">Kami belum punya script atau modifikasi untuk <b>' + escHtml(h.name) + '</b>. Yuk request supaya admin bisa segera menambahkannya.</p>'
        + suggestTipsHtml
        + '<a class="hz-sv-empty-cta" href="/request-script">Request script ini'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>'
        + '</a></div>';
    const { gridLimitClass, loadmoreHtml } = buildLoadMoreParts(matched.length);

    const heroUrl = '/hero/' + slug;
    let html = template
      .split('{{HERO_NAME}}').join(escHtml(h.name))
      .split('{{HERO_IMAGE}}').join(h.image || '')
      .split('{{HERO_ROLE_LABEL}}').join(escHtml(role.label))
      .split('{{HERO_ROLE_LABEL_UPPER}}').join(escHtml(role.label).toUpperCase())
      .split('{{ROLE_ICON}}').join(role.icon)
      .split('{{POST_COUNT}}').join(String(matched.length))
      .split('{{POSTS_HTML}}').join(postsHtml)
      .split('{{GRID_LIMIT_CLASS}}').join(gridLimitClass)
      .split('{{LOADMORE_HTML}}').join(loadmoreHtml)
      .split('{{CANONICAL_URL}}').join(absoluteUrl(heroUrl));

    html = processHtml(html);
    fs.writeFileSync(path.join(heroOutDir, slug + '.html'), injectCacheBust(html), 'utf8');
    addSitemapUrl(heroUrl, {changefreq: 'weekly', priority: 0.7, category: 'hero'});
    console.log('built: hero/' + slug + '.html');
  });
}

function buildCategoryAvatarHtml(catName, initial, logosMap) {
  const logo = logosMap[catName];
  if (logo && logo.trim()) {
    return `<img src="${escHtml(logo.trim())}" alt="${escHtml(catName)}" onerror="this.parentNode.innerHTML='&lt;div class=&quot;hz-cath-initial&quot;&gt;${escHtml(initial)}&lt;/div&gt;'"/>`;
  }
  return `<div class="hz-cath-initial">${escHtml(initial)}</div>`;
}

function generateCategoryPages() {
  const postsPath = path.join(SRC_DIR, 'js', 'posts.json');
  const templatePath = path.join(PARTIALS_DIR, 'category-template.html');
  const categoriesPath = path.join(SRC_DIR, 'js', 'categories.json');
  if (!fs.existsSync(postsPath) || !fs.existsSync(templatePath)) {
    console.log('Lewati generate category pages: posts.json atau template tidak ditemukan.');
    return;
  }
  const posts = JSON.parse(fs.readFileSync(postsPath, 'utf8'));
  const template = fs.readFileSync(templatePath, 'utf8');
  const CATEGORY_LOGOS = fs.existsSync(categoriesPath)
    ? JSON.parse(fs.readFileSync(categoriesPath, 'utf8'))
    : {};
  const EXCLUDED_CATS = ['Category', 'Community', 'Social'];

  const postsByCat = {};
  posts.forEach((p) => {
    const cat = p.cat;
    if (!cat || EXCLUDED_CATS.indexOf(cat) !== -1) return;
    if (!postsByCat[cat]) postsByCat[cat] = [];
    postsByCat[cat].push(p);
  });

  const catOutDir = path.join(OUT_DIR, 'kategori-skin');
  fs.mkdirSync(catOutDir, { recursive: true });

  Object.keys(postsByCat).forEach((catName) => {
    const slug = slugify(catName);
    if (!slug) return;
    const matched = postsByCat[catName];
    const postsHtml = matched.length
      ? matched.map(hzBuildCard).join('\n')
      : '<div class="hz-cp-empty">Belum ada script untuk kategori ini.</div>';
    const { gridLimitClass, loadmoreHtml } = buildLoadMoreParts(matched.length);
    const initial = catName.trim().charAt(0).toUpperCase();
    const avatarHtml = buildCategoryAvatarHtml(catName, initial, CATEGORY_LOGOS);
    const catUrl = '/kategori-skin/' + slug;

    let html = template
      .split('{{CATEGORY_NAME}}').join(escHtml(catName))
      .split('{{CATEGORY_AVATAR}}').join(avatarHtml)
      .split('{{POST_COUNT}}').join(String(matched.length))
      .split('{{POSTS_HTML}}').join(postsHtml)
      .split('{{GRID_LIMIT_CLASS}}').join(gridLimitClass)
      .split('{{LOADMORE_HTML}}').join(loadmoreHtml)
      .split('{{CANONICAL_URL}}').join(absoluteUrl(catUrl));

    html = processHtml(html);
    fs.writeFileSync(path.join(catOutDir, slug + '.html'), injectCacheBust(html), 'utf8');
    addSitemapUrl(catUrl, {changefreq: 'weekly', priority: 0.7, category: 'category'});
    console.log('built: kategori-skin/' + slug + '.html');
  });

  // Halaman "Semua" — seluruh post lintas kategori (dikecualikan cat internal)
  const allMatched = posts.filter((p) => !p.cat || EXCLUDED_CATS.indexOf(p.cat) === -1);
  const allPostsHtml = allMatched.length
    ? allMatched.map(hzBuildCard).join('\n')
    : '<div class="hz-cp-empty">Belum ada script.</div>';
  const allLoadMore = buildLoadMoreParts(allMatched.length);
  let allHtml = template
    .split('{{CATEGORY_NAME}}').join('Semua')
    .split('{{CATEGORY_AVATAR}}').join(buildCategoryAvatarHtml('Semua', 'S', CATEGORY_LOGOS))
    .split('{{POST_COUNT}}').join(String(allMatched.length))
    .split('{{POSTS_HTML}}').join(allPostsHtml)
    .split('{{GRID_LIMIT_CLASS}}').join(allLoadMore.gridLimitClass)
    .split('{{LOADMORE_HTML}}').join(allLoadMore.loadmoreHtml)
    .split('{{CANONICAL_URL}}').join(absoluteUrl('/kategori-skin/semua'));
  allHtml = processHtml(allHtml);
  fs.writeFileSync(path.join(catOutDir, 'semua.html'), injectCacheBust(allHtml), 'utf8');
  addSitemapUrl('/kategori-skin/semua', {changefreq: 'daily', priority: 0.8, category: 'category'});
  console.log('built: kategori-skin/semua.html');
}

/* Suntik skeleton loading ke daftar-hero.html (file statis, di-copy oleh copyRecursive).
   Jumlah placeholder per role dihitung dari heroes.json (data asli), dibatasi max 10
   (sama dgn hzDhLimit desktop di main.js). Versi mobile (6) diatur lwt CSS nth-child,
   supaya jumlah & posisi skeleton persis sama dgn yang nanti benar-benar tampil,
   tidak ada layout shift saat hzDhInit() mengganti isinya dgn card asli. */
function injectDaftarHeroSkeleton() {
  const filePath = path.join(OUT_DIR, 'daftar-hero.html');
  const heroesPath = path.join(SRC_DIR, 'js', 'heroes.json');
  if (!fs.existsSync(filePath) || !fs.existsSync(heroesPath)) return;
  const heroes = JSON.parse(fs.readFileSync(heroesPath, 'utf8'));
  const byRole = {};
  heroes.forEach((h) => {
    const r = (h.role || '').toLowerCase();
    if (r) byRole[r] = (byRole[r] || 0) + 1;
    const r2 = (h.role2 || '').toLowerCase();
    if (r2 && r2 !== r) byRole[r2] = (byRole[r2] || 0) + 1;
  });
  const DH_LIMIT = 12; // samakan dgn hzDhLimit desktop di main.js
  const skelCard = '<div class="hz-dh-skel"><div class="hz-dh-skel-avatar"></div><div class="hz-dh-skel-line"></div></div>';
  let html = fs.readFileSync(filePath, 'utf8');
  html = html.replace(/data-role-grid="([a-z]+)"><\/div>/g, (m, role) =>
    'data-role-grid="' + role + '">' + skelCard.repeat(Math.min(byRole[role] || 0, DH_LIMIT)) + '</div>');
  html = html.replace(/data-count="([a-z]+)"><\/span>/g, (m, role) =>
    'data-count="' + role + '">' + (byRole[role] ? '(' + byRole[role] + ')' : '') + '</span>');
  fs.writeFileSync(filePath, html, 'utf8');
  console.log('built: daftar-hero.html (skeleton loading)');
}

generateHeroPages();
generateCategoryPages();
injectDaftarHeroSkeleton();

/* ===================== POST PAGES (dari public/data/posts/*.json) =====================
   Post baru (lewat tool authoring) disimpan sebagai data JSON, bukan HTML jadi.
   Fungsi di bawah ini merakit HTML final dari data + public/partials/post-template.html —
   jadi kalau desain di post-template.html diubah, SEMUA post (lama & baru) yang sudah
   punya file data JSON otomatis ikut ter-update begitu build.js dijalankan ulang.
   Post lama yang masih berupa file HTML mentah di public/post/*.html TIDAK disentuh
   fungsi ini — tetap jalan seperti biasa sampai Essen migrasikan manual lewat tool. */

function hzBuildTooltipDescHtml(text) {
  text = text || '';
  const idx = text.toLowerCase().indexOf('disclaimer');
  if (idx === -1) return escHtml(text);
  const before = text.substring(0, idx);
  const label = text.substr(idx, 'disclaimer'.length);
  const rest = text.substring(idx + 'disclaimer'.length).replace(/^[:\s]+/, '');
  return escHtml(before) + '<span class="hz-post-tooltip-disclaimer"><strong>' + escHtml(label) + ' :</strong> <em>' + escHtml(rest) + '</em></span>';
}

/* Rotasi warna untuk blok skill dinamis (di antara Skill 2 dan Ultimate) — identik dengan tool */
const KZ_DYN_COLORS = [
  { bg: '#e0f7fa', text: '#006064' },
  { bg: '#fce4ec', text: '#880e4f' },
  { bg: '#e8eaf6', text: '#1a237e' },
  { bg: '#fff8e1', text: '#e65100' },
  { bg: '#e0f2f1', text: '#004d40' }
];

/* Bangun 1 blok ability (Pasif/Skill/Ultimate), dual-variant-aware — port dari hzBuildAbilityRow */
function hzBuildAbilityRow(opts) {
  const topBorder = opts.borderTop ? 'border-top:1px solid #efefef;' : '';
  const bottomBorder = opts.borderBottom === false ? '' : 'border-bottom:1px solid #efefef;';

  let labelRow;
  if (opts.dual) {
    const t1 = opts.tab1Name || 'Tab 1';
    const t2 = opts.tab2Name || 'Tab 2';
    labelRow = '  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 20px 0;flex-wrap:wrap;">\n'
      + '    <span style="font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:' + opts.labelColor + ';">' + escHtml(opts.label) + '</span>\n'
      + '    <div class="hz-ab-seg hz-ab-seg-mini" data-prefix="' + opts.idPrefix + '" role="radiogroup">\n'
      + '      <button aria-checked="true" class="hz-ab-seg-item active" data-variant="1" role="radio" type="button" onclick="hzAbMiniSwitch(this)">' + escHtml(t1) + '</button>\n'
      + '      <button aria-checked="false" class="hz-ab-seg-item" data-variant="2" role="radio" type="button" onclick="hzAbMiniSwitch(this)">' + escHtml(t2) + '</button>\n'
      + '      <div class="hz-ab-seg-pill"></div>\n'
      + '    </div>\n'
      + '  </div>\n';
  } else {
    labelRow = '  <div style="padding:10px 20px 0;"><span style="font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:' + opts.labelColor + ';">' + escHtml(opts.label) + '</span></div>\n';
  }

  function contentBlock(url, name, kategori, longDesc, prefix) {
    return '  <div style="display:flex;align-items:flex-start;gap:14px;padding:12px 20px 14px;">\n'
      + '    <img src="' + escHtml(url) + '" alt="' + escHtml(name) + '" style="width:52px;height:52px;border-radius:50%;object-fit:contain;flex-shrink:0;background:#1a1a2e;box-shadow:0 1px 6px rgba(0,0,0,.25);"/>\n'
      + '    <div style="flex:1;min-width:0;">\n'
      + '      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-bottom:5px;">\n'
      + '        <span style="font-size:14px;font-weight:800;color:#111;font-family:\'Manrope\',sans-serif;">' + escHtml(name) + '</span>\n'
      + '        <span style="font-size:9px;font-weight:800;letter-spacing:.5px;padding:2px 8px;border-radius:20px;white-space:nowrap;background:' + opts.katBg + ';color:' + opts.katText + ';">' + escHtml(kategori) + '</span>\n'
      + '      </div>\n'
      + '      <p id="' + prefix + '-short" style="font-size:12.5px;color:#666;line-height:1.65;font-weight:500;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">' + escHtml(longDesc) + '</p>\n'
      + '      <div id="' + prefix + '-full" style="font-size:12.5px;color:#666;line-height:1.65;font-weight:500;margin:0;display:none;white-space:pre-line;">' + escHtml(longDesc) + '</div>\n'
      + '      <button onclick="hzToggleAb(\'' + prefix + '\')" type="button" style="margin-top:8px;background:none;border:none;cursor:pointer;display:inline-flex;align-items:center;gap:5px;font-family:\'Manrope\',sans-serif;font-size:12px;font-weight:700;color:#111;padding:0;">\n'
      + '        <span id="' + prefix + '-lbl">Baca Selengkapnya</span>\n'
      + '        <svg id="' + prefix + '-icon" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="width:13px;height:13px;transition:transform .25s;"><polyline points="6,9 12,15 18,9"/></svg>\n'
      + '      </button>\n'
      + '    </div>\n'
      + '  </div>\n';
  }

  let body;
  if (opts.dual) {
    body = '  <div id="' + opts.idPrefix + '-w1" style="display:block;">\n' + contentBlock(opts.url, opts.name, opts.kategori, opts.longDesc, opts.idPrefix) + '  </div>\n'
      + '  <div id="' + opts.idPrefix + '-w2" style="display:none;">\n' + contentBlock(opts.url2, opts.name2, opts.kategori2, opts.longDesc2, opts.idPrefix + '-v2') + '  </div>\n';
  } else {
    body = contentBlock(opts.url, opts.name, opts.kategori, opts.longDesc, opts.idPrefix);
  }

  return '<div style="' + topBorder + bottomBorder + '">\n' + labelRow + body + '</div>\n';
}

/* Bangun seluruh section Abilities (Pasif selalu tampil + Skill/Ultimate di grup tersembunyi) */
function buildAbilitiesHtml(data) {
  const dualTab1 = (data.dualTabNames && data.dualTabNames.tab1) || 'Tab 1';
  const dualTab2 = (data.dualTabNames && data.dualTabNames.tab2) || 'Tab 2';
  const pasif = data.abilitiesPasif || {};

  const pasifCol = { bg: '#e8f5e9', text: '#2e7d32' };
  const pasifHtml = hzBuildAbilityRow({
    label: 'Pasif', labelColor: pasifCol.text, idPrefix: 'hz-ab-pasif',
    url: pasif.url || '', name: pasif.name || '', kategori: pasif.kategori || 'BUFF',
    longDesc: pasif.longDesc || '', katBg: pasifCol.bg, katText: pasifCol.text, borderTop: false,
    dual: !!pasif.dual, tab1Name: dualTab1, tab2Name: dualTab2,
    url2: pasif.url2 || '', name2: pasif.name2 || '', kategori2: pasif.kategori2 || 'BUFF', longDesc2: pasif.longDesc2 || ''
  });

  const list = data.abilitiesList || [];
  let skillsHtml = '';
  list.forEach((item, idx) => {
    let col, idPrefix, borderTop = true, borderBottom = true;
    if (idx === 0) { col = { bg: '#e3f2fd', text: '#1565c0' }; idPrefix = 'hz-ab-s1'; }
    else if (idx === 1) { col = { bg: '#f3e5f5', text: '#6a1b9a' }; idPrefix = 'hz-ab-s2'; borderTop = false; }
    else if (idx === list.length - 1) { col = { bg: '#fff3e0', text: '#e65100' }; idPrefix = 'hz-ab-ult'; borderBottom = false; }
    else { col = KZ_DYN_COLORS[(idx - 2) % KZ_DYN_COLORS.length]; idPrefix = 'hz-ab-s' + (idx + 1); }

    skillsHtml += hzBuildAbilityRow({
      label: item.label || ('Skill ' + (idx + 1)), labelColor: col.text, idPrefix: idPrefix,
      url: item.url || '', name: item.name || '', kategori: item.kategori || 'AOE',
      longDesc: item.longDesc || '', katBg: col.bg, katText: col.text, borderTop: borderTop, borderBottom: borderBottom,
      dual: !!item.dual, tab1Name: dualTab1, tab2Name: dualTab2,
      url2: item.url2 || '', name2: item.name2 || '', kategori2: item.kategori2 || 'AOE', longDesc2: item.longDesc2 || ''
    });
  });

  return { pasifHtml, skillsHtml };
}

/* Bangun 1 baris tabel download — port dari buildDlRow */
function hzExtractHeroCode(url) {
  if (!url) return '';
  const m = url.match(/\/(Hero\d+)-icon/i);
  return m ? m[1] : '';
}
function buildDlRow(name, url, link, isLast) {
  const altR = hzExtractHeroCode(url) || name;
  const hasLogo = /logo/i.test(name);
  const logoQBtn = hasLogo
    ? '<button type="button" onclick="hzOpenLogoTooltip()" aria-label="Apa itu Logo?" style="position:absolute;top:50%;left:100%;margin-left:4px;transform:translateY(-50%);display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;border-radius:50%;border:1px solid #b5b5b5;background:#fff;color:#717171;font-size:9px;font-weight:700;font-family:\'Manrope\',sans-serif;cursor:pointer;padding:0;line-height:1;">?</button>'
    : '';
  const dlBtn = link
    ? '<a href="' + escHtml(link) + '" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;justify-content:center;padding:7px 16px;background:#fff;border:2px solid #e0e0e0;border-radius:10px;font-family:\'Manrope\',sans-serif;font-size:11px;font-weight:700;color:#111;text-decoration:none;white-space:nowrap;">Download</a>'
    : '<span style="display:inline-flex;align-items:center;justify-content:center;padding:7px 16px;background:#e0e0e0;border:2px solid #e0e0e0;border-radius:10px;font-family:\'Manrope\',sans-serif;font-size:11px;font-weight:700;color:#999;white-space:nowrap;cursor:default;width:88px;height:30px;box-sizing:border-box;">Soon!</span>';
  const rowStyle = isLast ? '' : 'border-bottom:1px solid #f0f0f0;';
  return '<tr style="' + rowStyle + '">\n'
    + '  <td style="padding:14px 14px;text-align:center;vertical-align:middle;"><span style="position:relative;display:inline-block;"><span style="font-weight:800;color:#111;font-size:12px;">' + escHtml(name) + '</span>' + logoQBtn + '</span></td>\n'
    + '  <td style="padding:14px 14px;text-align:center;vertical-align:middle;"><img src="' + escHtml(url) + '" alt="' + escHtml(altR) + '" referrerpolicy="no-referrer" style="width:42px;height:42px;border-radius:50%;object-fit:cover;box-shadow:0 1px 5px rgba(0,0,0,.15);margin:0 auto;display:block;"/></td>\n'
    + '  <td style="padding:14px 14px;text-align:center;vertical-align:middle;">' + dlBtn + '</td>\n'
    + '</tr>\n';
}
function buildDlTableWrap(tbodyHtml) {
  return '<div style="border:1px solid #e8e8e8;border-radius:16px;overflow:hidden;">\n'
    + '  <div style="overflow-x:auto;width:100%;">\n'
    + '    <table style="width:100%;border-collapse:collapse;font-family:\'Manrope\',sans-serif;font-size:13px;">\n'
    + '      <thead>\n'
    + '        <tr style="background:#fafafa;border-bottom:1px solid #e8e8e8;">\n'
    + '          <th style="padding:11px 14px;text-align:center;font-size:9px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;color:#aaa;width:40%;">Replaces</th>\n'
    + '          <th style="padding:11px 14px;text-align:center;font-size:9px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;color:#aaa;width:30%;">Icon</th>\n'
    + '          <th style="padding:11px 14px;text-align:center;font-size:9px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;color:#aaa;width:30%;">Action</th>\n'
    + '        </tr>\n'
    + '      </thead>\n'
    + '      <tbody>\n' + tbodyHtml + '      </tbody>\n'
    + '    </table>\n'
    + '  </div>\n'
    + '</div>\n';
}
function buildDlInject(dl) {
  dl = dl || {};
  const rowsTab1 = dl.rowsTab1 || [];
  const rowsTab2 = dl.rowsTab2 || [];
  const rowsHtml = (rows) => rows.map((r, i) => buildDlRow(r.name, r.url, r.link, i === rows.length - 1)).join('');

  if (!dl.dual) {
    return buildDlTableWrap(rowsHtml(rowsTab1));
  }

  const t1Name = dl.tab1Name || 'Tab 1';
  const t2Name = dl.tab2Name || 'Tab 2';

  const seg = '<div style="text-align:center;margin-bottom:14px;">\n'
    + '  <span style="position:relative;display:inline-block;">\n'
    + '  <div class="hz-ab-seg" id="hz-dl-seg" role="radiogroup" style="margin:0;">\n'
    + '    <button aria-checked="true" class="hz-ab-seg-item active" data-target="hz-dl-t1" role="radio" type="button" onclick="hzDlTabSwitch(this)">' + escHtml(t1Name) + '</button>\n'
    + '    <button aria-checked="false" class="hz-ab-seg-item" data-target="hz-dl-t2" role="radio" type="button" onclick="hzDlTabSwitch(this)">' + escHtml(t2Name) + '</button>\n'
    + '    <div class="hz-ab-seg-pill" id="hz-dl-seg-pill"></div>\n'
    + '  </div>\n'
    + '  <button type="button" onclick="hzOpenDlTabTooltip()" aria-label="Apa itu Tab 1 &amp; Tab 2?" style="position:absolute;top:50%;left:100%;margin-left:8px;transform:translateY(-50%);display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;border-radius:50%;border:1px solid #b5b5b5;background:#fff;color:#717171;font-size:9px;font-weight:700;font-family:\'Manrope\',sans-serif;cursor:pointer;padding:0;line-height:1;">?</button>\n'
    + '  </span>\n'
    + '</div>\n';

  const t1 = '<div id="hz-dl-t1">\n' + buildDlTableWrap(rowsHtml(rowsTab1)) + '</div>\n';
  const t2 = '<div id="hz-dl-t2" style="display:none;">\n' + buildDlTableWrap(rowsHtml(rowsTab2)) + '</div>\n';

  const initScript = '<script>\n'
    + '(function(){\n'
    + '  function hzDlSegInit(){\n'
    + '    var seg=document.getElementById("hz-dl-seg");if(!seg)return;\n'
    + '    var pill=document.getElementById("hz-dl-seg-pill");\n'
    + '    var first=seg.querySelector(".hz-ab-seg-item.active");\n'
    + '    if(first&&pill){pill.style.transition="none";pill.style.width=first.offsetWidth+"px";pill.style.translate=(first.offsetLeft-3)+"px";void pill.offsetWidth;pill.style.transition="";}\n'
    + '  }\n'
    + '  if(document.readyState!=="loading")hzDlSegInit();\n'
    + '  else document.addEventListener("DOMContentLoaded",hzDlSegInit);\n'
    + '  window.addEventListener("resize",hzDlSegInit);\n'
    + '})();\n'
    + 'window.hzDlTabSwitch=function(btn){\n'
    + '  var seg=document.getElementById("hz-dl-seg");\n'
    + '  var pill=document.getElementById("hz-dl-seg-pill");\n'
    + '  seg.querySelectorAll(".hz-ab-seg-item").forEach(function(b){b.classList.remove("active");b.setAttribute("aria-checked","false");});\n'
    + '  btn.classList.add("active");btn.setAttribute("aria-checked","true");\n'
    + '  if(pill){pill.style.width=btn.offsetWidth+"px";pill.style.translate=(btn.offsetLeft-3)+"px";}\n'
    + '  var target=btn.getAttribute("data-target");\n'
    + '  var t1=document.getElementById("hz-dl-t1");\n'
    + '  var t2=document.getElementById("hz-dl-t2");\n'
    + '  if(t1)t1.style.display=(target==="hz-dl-t1")?"block":"none";\n'
    + '  if(t2)t2.style.display=(target==="hz-dl-t2")?"block":"none";\n'
    + '};\n'
    + '</script>\n';

  return seg + t1 + t2 + initScript;
}

/* Ubah tombol Download jadi "Soon!" kalau href-nya kosong setelah semua token diganti
   (jaga-jaga kalau link diisi placeholder string kosong dari data lama) */
function hzApplySoonFallback(html) {
  return html.replace(
    /<a href="" target="_blank" rel="noopener" style="([^"]*)">\s*Download\s*<\/a>/g,
    '<span style="$1background:#e0e0e0;border-color:#e0e0e0;color:#999;cursor:default;width:88px;height:30px;box-sizing:border-box;">Soon!</span>'
  );
}

function generatePostPages() {
  const dataDir = path.join(SRC_DIR, 'data', 'posts');
  if (!fs.existsSync(dataDir)) {
    console.log('Lewati generatePostPages: folder public/data/posts belum ada.');
    return;
  }
  const postOutDir = path.join(OUT_DIR, 'post');
  fs.mkdirSync(postOutDir, { recursive: true });

  const templatePath = path.join(PARTIALS_DIR, 'post-template.html');
  const template = fs.readFileSync(templatePath, 'utf8');

  // Cross-reference ke posts.json biar view count pakai id yang SAMA persis dengan
  // yang dipakai main.js buat nge-increment (lihat public/js/main.js: page-post block)
  const postsJsonPath = path.join(SRC_DIR, 'js', 'posts.json');
  const postsIndexByUrl = {};
  if (fs.existsSync(postsJsonPath)) {
    const postsIndex = JSON.parse(fs.readFileSync(postsJsonPath, 'utf8'));
    postsIndex.forEach((p) => { if (p.url) postsIndexByUrl[p.url] = p; });
  }

  const files = fs.readdirSync(dataDir).filter((f) => f.endsWith('.json'));
  files.forEach((fname) => {
    const slug = fname.replace(/\.json$/, '');
    const data = JSON.parse(fs.readFileSync(path.join(dataDir, fname), 'utf8'));

    const namehero = data.namehero || 'Tanpa Judul';
    const longstory = data.longstory || '';
    const shortstory = longstory; // truncation visual ditangani CSS line-clamp, bukan JS — sesuai tool asli
    const { pasifHtml, skillsHtml } = buildAbilitiesHtml(data);
    const dlInject = buildDlInject(data.download);
    const tooltipLogo = data.tooltipLogo || {};
    const tooltipDlTab = data.tooltipDlTab || {};
    const postUrl = '/post/' + slug;
    const postsEntry = postsIndexByUrl[postUrl];
    const viewId = postsEntry && postsEntry.id != null ? String(postsEntry.id) : slug;
    if (!postsEntry) {
      console.log('  \u26a0 "' + slug + '" belum ada di posts.json — view count sementara pakai slug sebagai id.');
    }

    let html = template
      .split('{{NAMEHERO}}').join(escHtml(namehero))
      .split('{{URLTHUMBNAIL}}').join(data.urlthumbnail || '')
      .split('{{KATEGORISKIN}}').join(escHtml(data.kategoriskin || ''))
      .split('{{DATEPOST}}').join(escHtml(data.datepost || ''))
      .split('{{AUTHORNAME}}').join(escHtml(data.authorname || 'Henz MLBB'))
      .split('{{SHORTSTORY}}').join(escHtml(shortstory))
      .split('{{LONGSTORY}}').join(escHtml(longstory))
      .split('{{AB_PASIF_INJECT}}').join(pasifHtml)
      .split('{{AB_SKILLS_INJECT}}').join(skillsHtml)
      .split('{{DL_INJECT}}').join(dlInject)
      .split('{{LOGO_TOOLTIP_TITLE}}').join(escHtml(tooltipLogo.title || 'Apa itu Logo?'))
      .split('{{LOGO_TOOLTIP_DESC}}').join(hzBuildTooltipDescHtml(tooltipLogo.desc || ''))
      .split('{{LOGO_TOOLTIP_IMG}}').join(tooltipLogo.img || '')
      .split('{{DLTAB_TOOLTIP_TITLE}}').join(escHtml(tooltipDlTab.title || 'Apa itu Tab 1 & Tab 2?'))
      .split('{{DLTAB_TOOLTIP_DESC}}').join(hzBuildTooltipDescHtml(tooltipDlTab.desc || ''))
      .split('{{DLTAB_TOOLTIP_IMG}}').join(tooltipDlTab.img || '')
      .split('{{VIEW_ID}}').join(escHtml(viewId))
      .split('{{VIEW_SLUG}}').join(escHtml(slug))
      .split('{{CANONICAL_URL}}').join(absoluteUrl(postUrl));

    html = hzApplySoonFallback(html);
    html = processHtml(html);
    fs.writeFileSync(path.join(postOutDir, slug + '.html'), injectCacheBust(html), 'utf8');
    addSitemapUrl(postUrl, { lastmod: parseIdDate(data.datepost), changefreq: 'monthly', priority: 0.9, category: 'post' });
    console.log('built: post/' + slug + '.html (dari data JSON)');
  });
}
generatePostPages();

/* ===================== sitemap.xml & robots.txt ===================== */
function generateSitemapAndRobots() {
  // Halaman menu statis (bukan hero/kategori/post yang sudah didaftarkan di generate*Pages())
  addSitemapUrl('/', {changefreq: 'daily', priority: 1.0, category: 'page'});
  addSitemapUrl('/kategori-skin', {changefreq: 'weekly', priority: 0.8, category: 'page'});
  addSitemapUrl('/daftar-hero', {changefreq: 'weekly', priority: 0.8, category: 'page'});
  addSitemapUrl('/request-script', {changefreq: 'monthly', priority: 0.4, category: 'page'});
  addSitemapUrl('/search', {changefreq: 'monthly', priority: 0.3, category: 'page'});
  addSitemapUrl('/socials', {changefreq: 'monthly', priority: 0.3, category: 'page'});
  addSitemapUrl('/tutorial', {changefreq: 'monthly', priority: 0.5, category: 'page'});

  // Halaman post (script detail) — dibaca langsung dari posts.json, di-generate manual (bukan lewat build.js)
  const postsPath = path.join(SRC_DIR, 'js', 'posts.json');
  if (fs.existsSync(postsPath)) {
    const posts = JSON.parse(fs.readFileSync(postsPath, 'utf8'));
    posts.forEach((p) => {
      if (!p.url) return;
      addSitemapUrl(p.url, {
        lastmod: parseIdDate(p.date),
        changefreq: 'monthly',
        priority: 0.9,
        category: 'post'
      });
    });
  }

  /* Kelompokkan URL per kategori -> masing-masing jadi sub-sitemap sendiri (page/hero/category/post),
     lalu satu sitemap_index.xml menghubungkan semuanya. Pola ini sama seperti yang dipakai
     plugin SEO populer (mis. Yoast) — lebih reliable dibaca Google dibanding satu file datar besar. */
  const CATEGORIES = [
    { key: 'page', file: 'page-sitemap.xml', label: 'Halaman' },
    { key: 'hero', file: 'hero-sitemap.xml', label: 'Detail Hero' },
    { key: 'category', file: 'category-sitemap.xml', label: 'Kategori Skin' },
    { key: 'post', file: 'post-sitemap.xml', label: 'Script/Post' }
  ];

  function buildUrlsetXml(urls) {
    const xmlItems = urls.map((u) => {
      let item = '  <url>\n    <loc>' + u.loc + '</loc>\n';
      if (u.lastmod) item += '    <lastmod>' + u.lastmod + '</lastmod>\n';
      item += '    <changefreq>' + u.changefreq + '</changefreq>\n';
      item += '    <priority>' + u.priority.toFixed(1) + '</priority>\n  </url>';
      return item;
    }).join('\n');
    return '<?xml version="1.0" encoding="UTF-8"?>\n'
      + '<?xml-stylesheet type="text/xsl" href="/sitemap-urls.xsl"?>\n'
      + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
      + xmlItems + '\n'
      + '</urlset>\n';
  }

  const sitemapIndexEntries = [];
  const buildDate = new Date().toISOString().slice(0, 10);

  CATEGORIES.forEach((cat) => {
    const urls = SITEMAP_URLS.filter((u) => u.category === cat.key);
    if (!urls.length) return; // skip kategori kosong, jangan daftarkan sitemap kosong di index
    const xml = buildUrlsetXml(urls);
    fs.writeFileSync(path.join(OUT_DIR, cat.file), xml, 'utf8');
    console.log('built: ' + cat.file + ' (' + urls.length + ' url, kategori: ' + cat.label + ')');
    // lastmod index = lastmod terbaru di antara url2 kategori itu, fallback tanggal build
    const lastmods = urls.map((u) => u.lastmod).filter(Boolean).sort();
    sitemapIndexEntries.push({
      loc: absoluteUrl('/' + cat.file),
      lastmod: lastmods.length ? lastmods[lastmods.length - 1] : buildDate
    });
  });

  const indexItems = sitemapIndexEntries.map((e) =>
    '  <sitemap>\n    <loc>' + e.loc + '</loc>\n    <lastmod>' + e.lastmod + '</lastmod>\n  </sitemap>'
  ).join('\n');

  const indexXml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<?xml-stylesheet type="text/xsl" href="/sitemap-index.xsl"?>\n'
    + '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + indexItems + '\n'
    + '</sitemapindex>\n';

  fs.writeFileSync(path.join(OUT_DIR, 'sitemap_index.xml'), indexXml, 'utf8');
  console.log('built: sitemap_index.xml (index, ' + sitemapIndexEntries.length + ' sub-sitemap, total ' + SITEMAP_URLS.length + ' url)');

  const robots = 'User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ' + BASE_URL + '/sitemap_index.xml\n';
  fs.writeFileSync(path.join(OUT_DIR, 'robots.txt'), robots, 'utf8');
  console.log('built: robots.txt');
}
generateSitemapAndRobots();

console.log('Build selesai. Output di:', OUT_DIR);
