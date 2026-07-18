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
const BASE_URL = 'https://www.henzscript.my.id';
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
    priority: opts.priority != null ? opts.priority : 0.6
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

/* Desain card script dipusatkan di public/js/card-template.js (dipakai juga oleh browser lewat window.kzCard) */
const { kzBuildCard } = require(path.join(SRC_DIR, 'js', 'card-template.js'));

const INCLUDE_RE = /<!--\s*include:([\w.-]+)\s*-->/g;

function readPartial(name) {
  const partialPath = path.join(PARTIALS_DIR, name);
  if (!fs.existsSync(partialPath)) {
    throw new Error('Partial tidak ditemukan: ' + partialPath);
  }
  return fs.readFileSync(partialPath, 'utf8');
}

function processHtml(content) {
  return content.replace(INCLUDE_RE, (match, partialName) => {
    return readPartial(partialName);
  });
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

  // Kelompokkan post berdasarkan kata pertama judul (lowercase) -> array post
  const postsByFirstWord = {};
  posts.forEach((p) => {
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
    const role = ROLE_CONFIG[roleKey] || { label: h.role || '', icon: '' };
    const slug = slugify(h.name);
    if (!slug) return;
    const matched = postsByFirstWord[(h.name || '').toLowerCase()] || [];
    const postsHtml = matched.length
      ? matched.map(kzBuildCard).join('\n')
      : '<div class="kz-cp-empty">Belum ada modifikasi untuk hero ini.</div>';

    const heroUrl = '/hero/' + slug;
    let html = template
      .split('{{HERO_NAME}}').join(escHtml(h.name))
      .split('{{HERO_IMAGE}}').join(h.image || '')
      .split('{{HERO_ROLE_LABEL}}').join(escHtml(role.label))
      .split('{{HERO_ROLE_LABEL_UPPER}}').join(escHtml(role.label).toUpperCase())
      .split('{{ROLE_ICON}}').join(role.icon)
      .split('{{POST_COUNT}}').join(String(matched.length))
      .split('{{POSTS_HTML}}').join(postsHtml)
      .split('{{CANONICAL_URL}}').join(absoluteUrl(heroUrl));

    html = processHtml(html);
    fs.writeFileSync(path.join(heroOutDir, slug + '.html'), html, 'utf8');
    addSitemapUrl(heroUrl, {changefreq: 'weekly', priority: 0.7});
    console.log('built: hero/' + slug + '.html');
  });
}

function buildCategoryAvatarHtml(catName, initial, logosMap) {
  const logo = logosMap[catName];
  if (logo && logo.trim()) {
    return `<img src="${escHtml(logo.trim())}" alt="${escHtml(catName)}" onerror="this.parentNode.innerHTML='&lt;div class=&quot;kz-cath-initial&quot;&gt;${escHtml(initial)}&lt;/div&gt;'"/>`;
  }
  return `<div class="kz-cath-initial">${escHtml(initial)}</div>`;
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
      ? matched.map(kzBuildCard).join('\n')
      : '<div class="kz-cp-empty">Belum ada script untuk kategori ini.</div>';
    const initial = catName.trim().charAt(0).toUpperCase();
    const avatarHtml = buildCategoryAvatarHtml(catName, initial, CATEGORY_LOGOS);
    const catUrl = '/kategori-skin/' + slug;

    let html = template
      .split('{{CATEGORY_NAME}}').join(escHtml(catName))
      .split('{{CATEGORY_AVATAR}}').join(avatarHtml)
      .split('{{POST_COUNT}}').join(String(matched.length))
      .split('{{POSTS_HTML}}').join(postsHtml)
      .split('{{CANONICAL_URL}}').join(absoluteUrl(catUrl));

    html = processHtml(html);
    fs.writeFileSync(path.join(catOutDir, slug + '.html'), html, 'utf8');
    addSitemapUrl(catUrl, {changefreq: 'weekly', priority: 0.7});
    console.log('built: kategori-skin/' + slug + '.html');
  });

  // Halaman "Semua" — seluruh post lintas kategori (dikecualikan cat internal)
  const allMatched = posts.filter((p) => !p.cat || EXCLUDED_CATS.indexOf(p.cat) === -1);
  const allPostsHtml = allMatched.length
    ? allMatched.map(kzBuildCard).join('\n')
    : '<div class="kz-cp-empty">Belum ada script.</div>';
  let allHtml = template
    .split('{{CATEGORY_NAME}}').join('Semua')
    .split('{{CATEGORY_AVATAR}}').join(buildCategoryAvatarHtml('Semua', 'S', CATEGORY_LOGOS))
    .split('{{POST_COUNT}}').join(String(allMatched.length))
    .split('{{POSTS_HTML}}').join(allPostsHtml)
    .split('{{CANONICAL_URL}}').join(absoluteUrl('/kategori-skin/semua'));
  allHtml = processHtml(allHtml);
  fs.writeFileSync(path.join(catOutDir, 'semua.html'), allHtml, 'utf8');
  addSitemapUrl('/kategori-skin/semua', {changefreq: 'daily', priority: 0.8});
  console.log('built: kategori-skin/semua.html');
}

generateHeroPages();
generateCategoryPages();

/* ===================== POST PAGES (dari public/data/posts/*.json) =====================
   Post baru (lewat tool authoring) disimpan sebagai data JSON, bukan HTML jadi.
   Fungsi di bawah ini merakit HTML final dari data + public/partials/post-template.html —
   jadi kalau desain di post-template.html diubah, SEMUA post (lama & baru) yang sudah
   punya file data JSON otomatis ikut ter-update begitu build.js dijalankan ulang.
   Post lama yang masih berupa file HTML mentah di public/post/*.html TIDAK disentuh
   fungsi ini — tetap jalan seperti biasa sampai Essen migrasikan manual lewat tool. */

function kzBuildTooltipDescHtml(text) {
  text = text || '';
  const idx = text.toLowerCase().indexOf('disclaimer');
  if (idx === -1) return escHtml(text);
  const before = text.substring(0, idx);
  const label = text.substr(idx, 'disclaimer'.length);
  const rest = text.substring(idx + 'disclaimer'.length).replace(/^[:\s]+/, '');
  return escHtml(before) + '<span class="kz-tooltip-disclaimer"><strong>' + escHtml(label) + ' :</strong> <em>' + escHtml(rest) + '</em></span>';
}

/* Rotasi warna untuk blok skill dinamis (di antara Skill 2 dan Ultimate) — identik dengan tool */
const KZ_DYN_COLORS = [
  { bg: '#e0f7fa', text: '#006064' },
  { bg: '#fce4ec', text: '#880e4f' },
  { bg: '#e8eaf6', text: '#1a237e' },
  { bg: '#fff8e1', text: '#e65100' },
  { bg: '#e0f2f1', text: '#004d40' }
];

/* Bangun 1 blok ability (Pasif/Skill/Ultimate), dual-variant-aware — port dari kzBuildAbilityRow */
function kzBuildAbilityRow(opts) {
  const topBorder = opts.borderTop ? 'border-top:1px solid #efefef;' : '';
  const bottomBorder = opts.borderBottom === false ? '' : 'border-bottom:1px solid #efefef;';

  let labelRow;
  if (opts.dual) {
    const t1 = opts.tab1Name || 'Tab 1';
    const t2 = opts.tab2Name || 'Tab 2';
    labelRow = '  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 20px 0;flex-wrap:wrap;">\n'
      + '    <span style="font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:' + opts.labelColor + ';">' + escHtml(opts.label) + '</span>\n'
      + '    <div class="kz-ab-seg kz-ab-seg-mini" data-prefix="' + opts.idPrefix + '" role="radiogroup">\n'
      + '      <button aria-checked="true" class="kz-ab-seg-item active" data-variant="1" role="radio" type="button" onclick="kzAbMiniSwitch(this)">' + escHtml(t1) + '</button>\n'
      + '      <button aria-checked="false" class="kz-ab-seg-item" data-variant="2" role="radio" type="button" onclick="kzAbMiniSwitch(this)">' + escHtml(t2) + '</button>\n'
      + '      <div class="kz-ab-seg-pill"></div>\n'
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
      + '      <div id="' + prefix + '-full" style="font-size:12.5px;color:#666;line-height:1.65;font-weight:500;margin:0;display:none;white-space:pre-line;text-align:justify;">' + escHtml(longDesc) + '</div>\n'
      + '      <button onclick="kzToggleAb(\'' + prefix + '\')" type="button" style="margin-top:8px;background:none;border:none;cursor:pointer;display:inline-flex;align-items:center;gap:5px;font-family:\'Manrope\',sans-serif;font-size:12px;font-weight:700;color:#111;padding:0;">\n'
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

  const pasifHtml = kzBuildAbilityRow({
    label: 'Pasif', labelColor: '#e53232', idPrefix: 'kz-ab-pasif',
    url: pasif.url || '', name: pasif.name || '', kategori: pasif.kategori || 'BUFF',
    longDesc: pasif.longDesc || '', katBg: '#e8f5e9', katText: '#2e7d32', borderTop: false,
    dual: !!pasif.dual, tab1Name: dualTab1, tab2Name: dualTab2,
    url2: pasif.url2 || '', name2: pasif.name2 || '', kategori2: pasif.kategori2 || 'BUFF', longDesc2: pasif.longDesc2 || ''
  });

  const list = data.abilitiesList || [];
  let skillsHtml = '';
  list.forEach((item, idx) => {
    let col, idPrefix, borderTop = true, borderBottom = true;
    if (idx === 0) { col = { bg: '#e3f2fd', text: '#1565c0' }; idPrefix = 'kz-ab-s1'; }
    else if (idx === 1) { col = { bg: '#f3e5f5', text: '#6a1b9a' }; idPrefix = 'kz-ab-s2'; borderTop = false; }
    else if (idx === list.length - 1) { col = { bg: '#fff3e0', text: '#e65100' }; idPrefix = 'kz-ab-ult'; borderBottom = false; }
    else { col = KZ_DYN_COLORS[(idx - 2) % KZ_DYN_COLORS.length]; idPrefix = 'kz-ab-s' + (idx + 1); }

    skillsHtml += kzBuildAbilityRow({
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
function kzExtractHeroCode(url) {
  if (!url) return '';
  const m = url.match(/\/(Hero\d+)-icon/i);
  return m ? m[1] : '';
}
function buildDlRow(name, url, link, isLast) {
  const altR = kzExtractHeroCode(url) || name;
  const hasLogo = /logo/i.test(name);
  const logoQBtn = hasLogo
    ? '<button type="button" onclick="kzOpenLogoTooltip()" aria-label="Apa itu Logo?" style="position:absolute;top:50%;left:100%;margin-left:4px;transform:translateY(-50%);display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;border-radius:50%;border:1px solid #b5b5b5;background:#fff;color:#717171;font-size:9px;font-weight:700;font-family:\'Manrope\',sans-serif;cursor:pointer;padding:0;line-height:1;">?</button>'
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
    + '  <div class="kz-ab-seg" id="kz-dl-seg" role="radiogroup" style="margin:0;">\n'
    + '    <button aria-checked="true" class="kz-ab-seg-item active" data-target="kz-dl-t1" role="radio" type="button" onclick="kzDlTabSwitch(this)">' + escHtml(t1Name) + '</button>\n'
    + '    <button aria-checked="false" class="kz-ab-seg-item" data-target="kz-dl-t2" role="radio" type="button" onclick="kzDlTabSwitch(this)">' + escHtml(t2Name) + '</button>\n'
    + '    <div class="kz-ab-seg-pill" id="kz-dl-seg-pill"></div>\n'
    + '  </div>\n'
    + '  <button type="button" onclick="kzOpenDlTabTooltip()" aria-label="Apa itu Tab 1 &amp; Tab 2?" style="position:absolute;top:50%;left:100%;margin-left:8px;transform:translateY(-50%);display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;border-radius:50%;border:1px solid #b5b5b5;background:#fff;color:#717171;font-size:9px;font-weight:700;font-family:\'Manrope\',sans-serif;cursor:pointer;padding:0;line-height:1;">?</button>\n'
    + '  </span>\n'
    + '</div>\n';

  const t1 = '<div id="kz-dl-t1">\n' + buildDlTableWrap(rowsHtml(rowsTab1)) + '</div>\n';
  const t2 = '<div id="kz-dl-t2" style="display:none;">\n' + buildDlTableWrap(rowsHtml(rowsTab2)) + '</div>\n';

  const initScript = '<script>\n'
    + '(function(){\n'
    + '  function kzDlSegInit(){\n'
    + '    var seg=document.getElementById("kz-dl-seg");if(!seg)return;\n'
    + '    var pill=document.getElementById("kz-dl-seg-pill");\n'
    + '    var first=seg.querySelector(".kz-ab-seg-item.active");\n'
    + '    if(first&&pill){pill.style.transition="none";pill.style.width=first.offsetWidth+"px";pill.style.translate=(first.offsetLeft-3)+"px";void pill.offsetWidth;pill.style.transition="";}\n'
    + '  }\n'
    + '  if(document.readyState!=="loading")kzDlSegInit();\n'
    + '  else document.addEventListener("DOMContentLoaded",kzDlSegInit);\n'
    + '  window.addEventListener("resize",kzDlSegInit);\n'
    + '})();\n'
    + 'window.kzDlTabSwitch=function(btn){\n'
    + '  var seg=document.getElementById("kz-dl-seg");\n'
    + '  var pill=document.getElementById("kz-dl-seg-pill");\n'
    + '  seg.querySelectorAll(".kz-ab-seg-item").forEach(function(b){b.classList.remove("active");b.setAttribute("aria-checked","false");});\n'
    + '  btn.classList.add("active");btn.setAttribute("aria-checked","true");\n'
    + '  if(pill){pill.style.width=btn.offsetWidth+"px";pill.style.translate=(btn.offsetLeft-3)+"px";}\n'
    + '  var target=btn.getAttribute("data-target");\n'
    + '  var t1=document.getElementById("kz-dl-t1");\n'
    + '  var t2=document.getElementById("kz-dl-t2");\n'
    + '  if(t1)t1.style.display=(target==="kz-dl-t1")?"block":"none";\n'
    + '  if(t2)t2.style.display=(target==="kz-dl-t2")?"block":"none";\n'
    + '};\n'
    + '</script>\n';

  return seg + t1 + t2 + initScript;
}

/* Ubah tombol Download jadi "Soon!" kalau href-nya kosong setelah semua token diganti
   (jaga-jaga kalau link diisi placeholder string kosong dari data lama) */
function kzApplySoonFallback(html) {
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
      .split('{{LOGO_TOOLTIP_DESC}}').join(kzBuildTooltipDescHtml(tooltipLogo.desc || ''))
      .split('{{LOGO_TOOLTIP_IMG}}').join(tooltipLogo.img || '')
      .split('{{DLTAB_TOOLTIP_TITLE}}').join(escHtml(tooltipDlTab.title || 'Apa itu Tab 1 & Tab 2?'))
      .split('{{DLTAB_TOOLTIP_DESC}}').join(kzBuildTooltipDescHtml(tooltipDlTab.desc || ''))
      .split('{{DLTAB_TOOLTIP_IMG}}').join(tooltipDlTab.img || '')
      .split('{{CANONICAL_URL}}').join(absoluteUrl(postUrl));

    html = kzApplySoonFallback(html);
    html = processHtml(html);
    fs.writeFileSync(path.join(postOutDir, slug + '.html'), html, 'utf8');
    addSitemapUrl(postUrl, { lastmod: parseIdDate(data.datepost), changefreq: 'monthly', priority: 0.9 });
    console.log('built: post/' + slug + '.html (dari data JSON)');
  });
}
generatePostPages();

/* ===================== sitemap.xml & robots.txt ===================== */
function generateSitemapAndRobots() {
  // Halaman menu statis (bukan hero/kategori/post yang sudah didaftarkan di generate*Pages())
  addSitemapUrl('/', {changefreq: 'daily', priority: 1.0});
  addSitemapUrl('/kategori-skin', {changefreq: 'weekly', priority: 0.8});
  addSitemapUrl('/daftar-hero', {changefreq: 'weekly', priority: 0.8});
  addSitemapUrl('/request-script', {changefreq: 'monthly', priority: 0.4});
  addSitemapUrl('/search', {changefreq: 'monthly', priority: 0.3});
  addSitemapUrl('/socials', {changefreq: 'monthly', priority: 0.3});
  addSitemapUrl('/tutorial', {changefreq: 'monthly', priority: 0.5});

  // Halaman post (script detail) — dibaca langsung dari posts.json, di-generate manual (bukan lewat build.js)
  const postsPath = path.join(SRC_DIR, 'js', 'posts.json');
  if (fs.existsSync(postsPath)) {
    const posts = JSON.parse(fs.readFileSync(postsPath, 'utf8'));
    posts.forEach((p) => {
      if (!p.url) return;
      addSitemapUrl(p.url, {
        lastmod: parseIdDate(p.date),
        changefreq: 'monthly',
        priority: 0.9
      });
    });
  }

  const xmlItems = SITEMAP_URLS.map((u) => {
    let item = '  <url>\n    <loc>' + u.loc + '</loc>\n';
    if (u.lastmod) item += '    <lastmod>' + u.lastmod + '</lastmod>\n';
    item += '    <changefreq>' + u.changefreq + '</changefreq>\n';
    item += '    <priority>' + u.priority.toFixed(1) + '</priority>\n  </url>';
    return item;
  }).join('\n');

  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + xmlItems + '\n'
    + '</urlset>\n';

  fs.writeFileSync(path.join(OUT_DIR, 'sitemap.xml'), xml, 'utf8');
  console.log('built: sitemap.xml (' + SITEMAP_URLS.length + ' url)');

  const robots = 'User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ' + BASE_URL + '/sitemap.xml\n';
  fs.writeFileSync(path.join(OUT_DIR, 'robots.txt'), robots, 'utf8');
  console.log('built: robots.txt');
}
generateSitemapAndRobots();

console.log('Build selesai. Output di:', OUT_DIR);
