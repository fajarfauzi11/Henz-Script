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

function buildPostCardHtml(p) {
  const title = escHtml(p.title || 'Tanpa Judul');
  const thumb = p.thumb;
  const label = p.cat;
  const auth = p.author || 'Henz Official';
  const ava = p.avatar || 'https://i.ibb.co/nstjBcMd/avatar.jpg';
  const imgH = thumb
    ? `<img class="kz-card-img" src="${thumb}" alt="${title}" loading="lazy" draggable="false" onerror="this.parentNode.innerHTML='&lt;div class=&quot;kz-card-no-img&quot;&gt;No Image&lt;/div&gt;'">`
    : `<div class="kz-card-no-img">No Image</div>`;
  return `<a class="kz-card" href="${p.url}">`
    + `<div class="kz-card-img-wrap">${imgH}</div>`
    + `<div class="kz-card-body">`
    + (label ? `<p class="kz-card-label">${escHtml(label)}</p>` : '')
    + `<h3 class="kz-card-title" title="${title}">${title}</h3>`
    + `<div class="kz-card-divider"></div>`
    + `<div class="kz-card-meta">`
    + `<div class="kz-card-author">`
    + `<img class="kz-card-avatar" src="${ava}" alt="${escHtml(auth)}" onerror="this.style.background='#e4e4e7';this.removeAttribute('src')">`
    + `<span class="kz-card-author-name">${escHtml(auth)}</span>`
    + `</div>`
    + `<span class="kz-card-dl-btn">Download`
    + `<span class="kz-card-dl-btn-icon"><svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M15.9959 10.0005L3 10.0005" stroke="currentColor" stroke-width="2"/><path d="M9.73389 16.3179L15.6318 9.99866L9.73389 3.67945" stroke="currentColor" stroke-width="2"/></svg></span>`
    + `</span>`
    + `</div></div></a>`;
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
      ? matched.map(buildPostCardHtml).join('\n')
      : '<div class="kz-cp-empty">Belum ada modifikasi untuk hero ini.</div>';

    let html = template
      .split('{{HERO_NAME}}').join(escHtml(h.name))
      .split('{{HERO_IMAGE}}').join(h.image || '')
      .split('{{HERO_ROLE_LABEL}}').join(escHtml(role.label))
      .split('{{HERO_ROLE_LABEL_UPPER}}').join(escHtml(role.label).toUpperCase())
      .split('{{ROLE_ICON}}').join(role.icon)
      .split('{{POST_COUNT}}').join(String(matched.length))
      .split('{{POSTS_HTML}}').join(postsHtml);

    html = processHtml(html);
    fs.writeFileSync(path.join(heroOutDir, slug + '.html'), html, 'utf8');
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

  const catOutDir = path.join(OUT_DIR, 'kategori');
  fs.mkdirSync(catOutDir, { recursive: true });

  Object.keys(postsByCat).forEach((catName) => {
    const slug = slugify(catName);
    if (!slug) return;
    const matched = postsByCat[catName];
    const postsHtml = matched.length
      ? matched.map(buildPostCardHtml).join('\n')
      : '<div class="kz-cp-empty">Belum ada script untuk kategori ini.</div>';
    const initial = catName.trim().charAt(0).toUpperCase();
    const avatarHtml = buildCategoryAvatarHtml(catName, initial, CATEGORY_LOGOS);

    let html = template
      .split('{{CATEGORY_NAME}}').join(escHtml(catName))
      .split('{{CATEGORY_AVATAR}}').join(avatarHtml)
      .split('{{POST_COUNT}}').join(String(matched.length))
      .split('{{POSTS_HTML}}').join(postsHtml);

    html = processHtml(html);
    fs.writeFileSync(path.join(catOutDir, slug + '.html'), html, 'utf8');
    console.log('built: kategori/' + slug + '.html');
  });

  // Halaman "Semua" — seluruh post lintas kategori (dikecualikan cat internal)
  const allMatched = posts.filter((p) => !p.cat || EXCLUDED_CATS.indexOf(p.cat) === -1);
  const allPostsHtml = allMatched.length
    ? allMatched.map(buildPostCardHtml).join('\n')
    : '<div class="kz-cp-empty">Belum ada script.</div>';
  let allHtml = template
    .split('{{CATEGORY_NAME}}').join('Semua')
    .split('{{CATEGORY_AVATAR}}').join(buildCategoryAvatarHtml('Semua', 'S', CATEGORY_LOGOS))
    .split('{{POST_COUNT}}').join(String(allMatched.length))
    .split('{{POSTS_HTML}}').join(allPostsHtml);
  allHtml = processHtml(allHtml);
  fs.writeFileSync(path.join(catOutDir, 'semua.html'), allHtml, 'utf8');
  console.log('built: kategori/semua.html');
}

generateHeroPages();
generateCategoryPages();

console.log('Build selesai. Output di:', OUT_DIR);
