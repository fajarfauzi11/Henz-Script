/* build.js — Henz MLBB static site build script
   Membaca semua file di public/, mengganti placeholder
   <!-- include:nama.html --> dengan isi public/partials/nama.html,
   lalu menulis hasilnya ke dist/. File non-HTML di-copy apa adanya.
*/
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const SRC_DIR = path.join(__dirname, 'public');
const OUT_DIR = path.join(__dirname, 'dist');
const PARTIALS_DIR = path.join(SRC_DIR, 'partials');

/* Domain resmi — dipakai buat canonical, Open Graph, dan sitemap.xml */
const BASE_URL = 'https://www.henzscript.com';
/* Cache-busting berbasis ISI FILE: link css/js dan berkas data JSON mendapat ?v=<hash isi>. Selama isi sebuah berkas tidak
   berubah, URL-nya tetap sama, jadi cache browser pengunjung lama tetap terpakai (di vercel.json berkas ini immutable).
   Begitu isinya berubah, hash-nya berubah dan browser otomatis mengambil yang baru, jadi tidak ada lagi kasus "user test pakai
   file/versi lama yang ke-cache". Dulu ?v= memakai waktu build, sehingga SETIAP deploy (termasuk deploy yang hanya menambah post)
   membuang cache CSS+JS semua pengunjung walau isinya tidak berubah. CACHE_BUST (waktu) kini hanya sisa untuk placeholder
   __HZ_BUILD__ opsional di sw.js (lihat buildServiceWorker). */
const CACHE_BUST = Date.now();
function contentHash(data) { return crypto.createHash('sha1').update(data).digest('hex').slice(0, 10); }
const DATA_FILES = ['posts.json', 'heroes.json', 'categories.json', 'hero-popular.json'];
let ASSET_V = null; // { bundle, css, js, data:{nama-file: hash} } -- diisi sekali oleh computeAssetVersions() sebelum halaman ditulis

/* ===================== MODE HEMAT CDN =====================
   Switch saat BUILD: environment variable HZ_SAVER=1 di Vercel (Settings > Environment Variables) lalu Redeploy. Hapus variabelnya
   + Redeploy untuk kembali normal. Tanpa HZ_SAVER, keluaran build identik dengan sebelum fitur ini ada (selain isi app.js).
   Sumber kode TIDAK dihapus: semua fitur yang dimatikan hanyalah cabang `if(window.HZ_SAVER)` di JS klien, dan window.HZ_SAVER=1
   disuntik inline ke HTML (jadi flag tidak butuh request). app.js sama persis di kedua mode, jadi cache browser tidak terbuang saat switch.
   Efek mode hemat: (1) view dicatat lewat endpoint Cloudflare Worker (HZ_VIEW_ENDPOINT) atau tidak dicatat sama sekali; tidak ada /api/view
   dari pengunjung; (2) tidak ada fetch posts.json di halaman post, riwayat, lonceng; saran pencarian tanpa request; (3) tanpa
   <link rel=manifest>; (4) service worker dilepas (sw.js jadi kill-switch); (5) CSS+JS disajikan dari jsDelivr dengan fallback otomatis. */
const SAVER = process.env.HZ_SAVER === '1';
const SAVER_VIEW_EP = (function () { const v = String(process.env.HZ_VIEW_ENDPOINT || '').trim(); return /^https:\/\/[^\s"'<>\\]+$/.test(v) ? v : ''; })();
const LOW_VALUE_BOTS = ['meta-webindexer', 'PetalBot', 'AhrefsBot', 'Amazonbot', 'GPTBot']; // ditutup di robots.txt hanya saat mode hemat
const ASSET_CDN = SAVER; // CSS+JS dari jsDelivr hanya di mode hemat (bisa dipisah ke flag sendiri bila nanti dijadikan permanen)
const ASSET_CDN_REPO = 'fajarfauzi11/Henz-Script';
/* Tag git yang membawa berkas aset di repo (dibuat workflow .github/workflows/cdn-assets.yml): 'a<hash css>-<hash js>'. Nama tag dan nama
   berkas ditentukan oleh ISI berkas, jadi build dan workflow selalu sepakat tanpa saling menunggu. */
function assetCdnBase() { return 'https://cdn.jsdelivr.net/gh/' + ASSET_CDN_REPO + '@a' + ASSET_V.css + '-' + ASSET_V.js + '/cdn/'; }
function assetCssUrl() { return assetCdnBase() + 'style.' + ASSET_V.css + '.css'; }
function assetJsUrl() { return assetCdnBase() + 'app.' + ASSET_V.js + '.js'; }
/* Berkas data (posts/heroes/categories/hero-popular) punya tag SENDIRI, 'd<hash gabungan hash isi>', terpisah dari tag aset: posts.json
   berganti di tiap post baru, dan tag aset tidak boleh ikut berganti (URL CSS/JS harus tetap supaya cache browser awet).
   Nama berkas di dalam tag: <nama>.<hash isi>.json. Dibuat oleh workflow yang sama (cdn-assets.yml). */
function assetDataTag() { return 'd' + contentHash(DATA_FILES.map((f) => f + ':' + (ASSET_V.data[f] || '')).join('|')); }
function assetDataBase() { return 'https://cdn.jsdelivr.net/gh/' + ASSET_CDN_REPO + '@' + assetDataTag() + '/cdn/'; }

/* Snapshot angka view saat build: scripts/views-snapshot.js (proses anak) membaca semua angka dari Redis SEKALI, lalu hasilnya dipakai
   untuk mencetak angka langsung ke HTML (tanpa request /api/view dari pengunjung). Gagal apa pun (kredensial tidak ada, modul belum
   terpasang, Redis gagal/lambat) TIDAK menggagalkan build: ok:false dan halaman tetap memakai /api/view seperti biasa.
   HZ_SKIP_VIEWS_SNAPSHOT=1 melewati langkah ini (mis. build lokal). Token tidak pernah masuk dist (dijaga verifyDist). */
let VIEWS = { ok: false, reason: 'belum dibaca', views: {} };
function loadViewSnapshot() {
  if (process.env.HZ_SKIP_VIEWS_SNAPSHOT === '1') return { ok: false, reason: 'HZ_SKIP_VIEWS_SNAPSHOT=1', views: {} };
  const scrub = (s) => ['KV_REST_API_READ_ONLY_TOKEN', 'KV_REST_API_TOKEN'].reduce((a, n) => {
    const t = process.env[n]; return t && t.length >= 8 ? a.split(t).join('[token]') : a;
  }, String(s));
  try {
    const raw = execFileSync(process.execPath, [path.join(__dirname, 'scripts', 'views-snapshot.js')], {
      encoding: 'utf8', timeout: 45000, maxBuffer: 8 * 1024 * 1024, env: process.env, stdio: ['ignore', 'pipe', 'ignore']
    });
    const r = JSON.parse(raw);
    if (r && r.ok === true && r.views && typeof r.views === 'object' && !Array.isArray(r.views)) return { ok: true, views: r.views, source: r.source };
    return { ok: false, reason: scrub((r && r.reason) || 'tidak diketahui'), views: {} };
  } catch (e) {
    return { ok: false, reason: scrub('proses pembaca gagal (' + ((e && (e.code || e.signal)) || 'error') + ')'), views: {} };
  }
}
function injectCacheBust(html) {
  /* window.HZ_DV (hash tiap berkas data) disuntik tepat sebelum <script src="/js/app.js">, supaya terbaca oleh window.hzDataUrl. */
  const baked = VIEWS.ok && html.indexOf('data-view-id') !== -1; // angka view sudah dicetak ke halaman ini (klien tidak perlu /api/view)
  const wantViews = VIEWS.ok && (html.indexOf('id="hz-swiper-latest"') !== -1 || html.indexOf('id="hz-search-heading"') !== -1); // beranda dan pencarian
  const saverVars = SAVER ? 'window.HZ_SAVER=1;' + (SAVER_VIEW_EP ? 'window.HZ_VIEW_EP=' + JSON.stringify(SAVER_VIEW_EP) + ';' : '') + (ASSET_CDN ? 'window.HZ_DC=' + JSON.stringify(assetDataBase()) + ';' : '') : '';
  const dv = '<script>window.HZ_DV=' + JSON.stringify(ASSET_V.data) + ';' + (baked ? 'window.HZ_VB=1;' : '') + (wantViews ? 'window.HZ_VIEWS=' + clientViewsJson() + ';' : '') + saverVars + '</script>';
  if (ASSET_CDN) {
    /* Mode hemat: CSS + JS dari jsDelivr. Kalau gagal dimuat (jaringan/blokir/404), otomatis jatuh ke salinan Vercel yang sama persis.
       CSS: onerror mengganti href. JS: onerror memakai document.write supaya urutan eksekusi (skrip inline sesudahnya) tetap terjaga. */
    const cssLocal = '/css/style.css?v=' + ASSET_V.css;
    const jsLocal = '/js/app.js?v=' + ASSET_V.js;
    return html
      .replace(/<link\b[^>]*\bhref="\/css\/style\.css"[^>]*>/g, () => '<link rel="preconnect" href="https://cdn.jsdelivr.net"/><link href="' + assetCssUrl() + '" rel="stylesheet" onerror="this.onerror=null;this.href=\'' + cssLocal + '\'"/>')
      .replace(/<script\b[^>]*?\bsrc="\/js\/app\.js"[^>]*><\/script>/g, () => dv + '<script src="' + assetJsUrl() + '" onerror="document.write(\'<script src=&quot;' + jsLocal + '&quot;><\\/script>\')"></script>');
  }
  return html
    .replace(/(href="\/css\/style\.css)(")/g, (m, a, b) => a + '?v=' + ASSET_V.css + b)
    .replace(/(<script\b[^>]*?\bsrc="\/js\/app\.js)(")/g, (m, a, b) => dv + a + '?v=' + ASSET_V.js + b);
}
/* Gabungan browser bundle: card-template.js (harus lebih dulu, karena main.js
   memakai window.hzCard yang dibentuk file ini) + main.js, ditulis ulang tiap
   build ke dist/js/app.js supaya browser cuma perlu 1 request JS, bukan 2.
   File sumber public/js/card-template.js & public/js/main.js TETAP ada apa
   adanya (card-template.js masih dipakai build.js sendiri lewat require() di
   bawah), cuma browser tidak lagi diarahkan ke keduanya secara terpisah. */
function makeAppBundle() {
  const cardTemplateSrc = fs.readFileSync(path.join(SRC_DIR, 'js', 'card-template.js'), 'utf8');
  const mainSrc = fs.readFileSync(path.join(SRC_DIR, 'js', 'main.js'), 'utf8');
  const floatingMenuSrc = fs.readFileSync(path.join(SRC_DIR, 'js', 'floating-menu.js'), 'utf8');
  const notifySrc = fs.readFileSync(path.join(SRC_DIR, 'js', 'notify.js'), 'utf8');
  /* Menu melayang + riwayat script (floating-menu.js) ditaruh paling akhir; ';' pemisah mencegah
     main.js yang berakhir tanpa titik-koma "menyambung" ke IIFE di file berikutnya. */
  /* Notifikasi (notify.js: lonceng + popup + Firebase lazy) paling akhir; floating-menu.js berakhir dengan ';' sendiri. */
  /* Prolog: pembentuk URL berkas data (posts/heroes/categories/hero-popular) dari window.HZ_DV, objek {nama-file: hash isi} yang
     disuntik build.js ke setiap HTML (lihat injectCacheBust). URL ?v=<hash isi> boleh di-cache lama (vercel.json) dan baru berganti
     kalau isi berkasnya berganti. Prolog SENGAJA tidak memuat id build/waktu: isi app.js harus identik antar-build selama sumbernya
     tidak berubah, supaya hash isinya (dan URL app.js) tidak ikut berganti di tiap deploy. Tanpa HZ_DV, kembali ke ?t=waktu. */
  /* Mode hemat: window.HZ_DC (basis URL tag data jsDelivr, disuntik build.js hanya di mode hemat) membuat hzFetchData mengambil berkas data
     dari jsDelivr (<nama>.<hash>.json). Gagal/404/bukan JSON => otomatis jatuh ke salinan Vercel. Tanpa HZ_DC (mode normal) hzFetchData
     sama persis dengan fetch(hzDataUrl(f)) seperti sebelumnya. */
  const prolog = "window.hzDataUrl=function(f){var d=window.HZ_DV;return '/js/'+f+'?'+(d&&d[f]?'v='+d[f]:'t='+Date.now());};\n" +
    "window.hzDataCdnUrl=function(f){var b=window.HZ_DC,d=window.HZ_DV;return b&&d&&d[f]?b+f.replace(/\\.json$/,'.'+d[f]+'.json'):'';};\n" +
    "window.hzFetchData=function(f){var c=window.hzDataCdnUrl(f);if(!c)return fetch(window.hzDataUrl(f));return fetch(c).then(function(r){if(!r.ok)throw new Error('cdn');return r.clone().json().then(function(){return r;});}).catch(function(){return fetch(window.hzDataUrl(f));});};\n";
  return prolog + cardTemplateSrc + '\n' + mainSrc + '\n;\n' + floatingMenuSrc + '\n;\n' + notifySrc;
}
/* Dihitung SEKALI sebelum halaman ditulis (HTML disuntik ?v= saat copyRecursive), dari sumber yang akan dipakai dist. */
function computeAssetVersions() {
  const bundle = makeAppBundle();
  const data = {};
  DATA_FILES.forEach((f) => {
    const p = path.join(SRC_DIR, 'js', f);
    if (fs.existsSync(p)) data[f] = contentHash(fs.readFileSync(p));
  });
  return { bundle, css: contentHash(fs.readFileSync(path.join(SRC_DIR, 'css', 'style.css'))), js: contentHash(bundle), data };
}
function buildAppBundle() {
  const bundle = ASSET_V.bundle;
  const jsOutDir = path.join(OUT_DIR, 'js');
  fs.mkdirSync(jsOutDir, { recursive: true });
  fs.writeFileSync(path.join(jsOutDir, 'app.js'), bundle, 'utf8');
  console.log('built: js/app.js (gabungan card-template.js + main.js + floating-menu.js + notify.js, ' + bundle.length + ' bytes)');
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
  if (parts.length !== 3 || !ID_MONTHS[parts[1]]) return parseDateFlexible(str); // format lain: "Update 8 Sep 2026", "3 Okt 2026"
  var day = parts[0].padStart(2, '0');
  return parts[2] + '-' + ID_MONTHS[parts[1]] + '-' + day;
}

/* Desain card script dipusatkan di public/js/card-template.js (dipakai juga oleh browser lewat window.hzCard) */
const { hzBuildCard, hzSlugFromUrl, hzFormatViewCount, hzBadgeText } = require(path.join(SRC_DIR, 'js', 'card-template.js'));
/* Angka view yang dicetak langsung di HTML (dari snapshot). viewKey = "<id>:<slug>" persis seperti kunci di api/view.js dan hzViewKey() di main.js.
   undefined bila snapshot tidak tersedia: kartu tetap "-" dan JS mengisinya dari /api/view seperti biasa. */
function viewKey(id, slug) { return id + ':' + String(slug || '').trim().replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 80); }
function viewCountFor(id, slug) { return VIEWS.ok ? (VIEWS.views[viewKey(id, slug)] || 0) : undefined; }
const cardWithViews = (p) => hzBuildCard(p, { views: viewCountFor(p.id, hzSlugFromUrl(p.url)) });
/* Peta angka view untuk beranda dan pencarian (kartunya dirender JS dari posts.json): { "<id>:<slug>": jumlah } hanya untuk post yang ada di
   posts.json (kunci yatim/draf di Redis tidak ikut). Ditanam di HTML sebagai window.HZ_VIEWS, jadi halaman itu tidak perlu /api/view. */
let CLIENT_VIEWS_JSON = null;
function clientViewsJson() {
  if (!VIEWS.ok) return null;
  if (CLIENT_VIEWS_JSON === null) {
    const idx = JSON.parse(fs.readFileSync(path.join(SRC_DIR, 'js', 'posts.json'), 'utf8'));
    const out = {};
    idx.forEach((p) => { const k = viewKey(p.id, hzSlugFromUrl(p.url)); out[k] = VIEWS.views[k] || 0; });
    CLIENT_VIEWS_JSON = JSON.stringify(out).replace(/</g, '\\u003c');
  }
  return CLIENT_VIEWS_JSON;
}

const INCLUDE_RE = /<!--\s*include:([\w.-]+)\s*-->/g;

function readPartial(name) {
  const partialPath = path.join(PARTIALS_DIR, name);
  if (!fs.existsSync(partialPath)) {
    throw new Error('Partial tidak ditemukan: ' + partialPath);
  }
  return fs.readFileSync(partialPath, 'utf8');
}

/* Menu melayang (tombol pengaturan pojok kanan bawah + modal riwayat) disisipkan otomatis tepat
   sebelum </body> di SEMUA halaman (statis, template post/hero/kategori, post statis lama),
   jadi footer.html tidak perlu disentuh. Aman dipanggil berulang: kalau sudah ada, dilewati. */
let FLOATING_MENU_HTML = null;
function injectFloatingMenu(html) {
  if (html.indexOf('id="hz-fm-root"') !== -1) return html;
  if (html.indexOf('hz-bare') !== -1) return html; // halaman mandiri (offline.html): tanpa menu
  const idx = html.lastIndexOf('</body>');
  if (idx === -1) return html;
  if (FLOATING_MENU_HTML === null) FLOATING_MENU_HTML = readPartial('floating-menu.html');
  return html.slice(0, idx) + FLOATING_MENU_HTML + '\n' + html.slice(idx);
}

/* Cloudflare Web Analytics (gratis, tanpa cookie/localStorage): snippet beacon disisipkan tepat sebelum </body> di SEMUA halaman
   (kecuali halaman mandiri offline.html), sesudah menu melayang. Skrip dimuat dari static.cloudflareinsights.com dan data dikirim ke
   cloudflareinsights.com, jadi TIDAK menambah request ke Vercel. Token situs memang publik (tampil di sumber halaman).
   Saklar cepat: env HZ_ANALYTICS=0 di Vercel (lalu Redeploy) mematikan snippet tanpa mengubah kode. Hanya satu snippet per halaman
   (aturan Cloudflare), dan aman dipanggil berulang: kalau sudah ada, dilewati. */
const CF_ANALYTICS_ON = process.env.HZ_ANALYTICS !== '0';
const CF_ANALYTICS_TAG = `<!-- Cloudflare Web Analytics --><script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "b21226a437374d5ba87c232ee6cb147c"}'></script><!-- End Cloudflare Web Analytics -->`;
function injectCfAnalytics(html) {
  if (!CF_ANALYTICS_ON) return html;
  if (html.indexOf('data-cf-beacon') !== -1) return html; // deteksi tag beacon-nya (bukan teks yang kebetulan menyebut domain Cloudflare, mis. Kebijakan Privasi)
  if (html.indexOf('hz-bare') !== -1) return html; // halaman mandiri (offline.html): tanpa analytics
  const idx = html.lastIndexOf('</body>');
  if (idx === -1) return html;
  return html.slice(0, idx) + CF_ANALYTICS_TAG + '\n' + html.slice(idx);
}

/* Mode Gelap berlaku di SEMUA halaman: (1) <html> diberi atribut data-dark-ready supaya switch di menu melayang
   tampil, dan (2) script kecil disisipkan tepat setelah <head> yang memasang data-theme="dark" SEBELUM halaman
   tergambar (mencegah kilatan putih). Preferensi disimpan di localStorage key hz_theme; default selalu terang.
   Tema gelapnya sendiri ada di bagian "MODE GELAP" pada public/css/style.css. */
const THEME_INIT_SCRIPT = '<script id="hz-theme-init">(function(){try{var d=document.documentElement;if(d.hasAttribute("data-dark-ready")&&localStorage.getItem("hz_theme")==="dark"){d.setAttribute("data-theme","dark");var m=document.createElement("meta");m.name="theme-color";m.content="#1c1c1f";m.id="hz-theme-color";document.head.appendChild(m);}}catch(e){}})();</script>';
function injectThemeInit(html) {
  if (html.indexOf('id="hz-theme-init"') !== -1) return html;
  if (html.indexOf('hz-bare') !== -1) return html; // halaman mandiri (offline.html) mengatur tema sendiri
  if (!/<body\b[^>]*>/i.test(html) || !/<head\b[^>]*>/i.test(html) || !/<html\b[^>]*>/i.test(html)) return html;
  return html
    .replace(/<html\b([^>]*)>/i, '<html$1 data-dark-ready>')
    .replace(/<head\b[^>]*>/i, (m) => m + THEME_INIT_SCRIPT);
}

/* PWA ("Install Aplikasi"): manifest + ikon layar utama iOS disisipkan ke <head> semua halaman.
   - <link rel="apple-touch-icon"> yang sudah ada (favicon 64px dari jsDelivr) diganti ke ikon 180px.
   - Ikon aplikasi ada di public/icons/ dan disajikan lewat jsDelivr (ICON_CDN, dipatok ke hash commit) supaya tidak jadi request ke
     Vercel di setiap kunjungan. Kalau file PNG-nya diganti: commit dulu, lalu ganti hash di 4 tempat: ICON_CDN di build.js,
     public/manifest.webmanifest, ICON_URL di public/sw.js, dan ICON_URL di api/push-notify.js.
   Aman dipanggil berulang: kalau <link rel="manifest"> sudah ada, dilewati. */
const ICON_CDN = 'https://cdn.jsdelivr.net/gh/fajarfauzi11/Henz-Script@59fbdc721420f310a774e85de992c5d0045f78ed/public/icons/';
const PWA_APPLE_ICON = '<link rel="apple-touch-icon" href="' + ICON_CDN + 'apple-touch-icon.png"/>';
function injectPwaHead(html) {
  if (html.indexOf('hz-bare') !== -1) return html;
  if (/<link\b[^>]*rel=["']manifest["']/i.test(html)) return html;
  if (!/<\/head>/i.test(html)) return html;
  let out = html;
  if (/<link\b[^>]*rel=["']apple-touch-icon["'][^>]*>/i.test(out)) {
    out = out.replace(/<link\b[^>]*rel=["']apple-touch-icon["'][^>]*>/i, PWA_APPLE_ICON);
  }
  const tags = (SAVER ? '' : '<link rel="manifest" href="/manifest.webmanifest"/>') + // mode hemat: tanpa manifest (hemat 1 request per kunjungan harian)
    (/rel=["']apple-touch-icon["']/i.test(out) ? '' : PWA_APPLE_ICON) +
    '<meta name="apple-mobile-web-app-title" content="Henz MLBB"/>';
  return out.replace(/<\/head>/i, tags + '</head>');
}

/* PWA Android layar penuh (edge-to-edge): tepat setelah <meta name="viewport"> disisipkan skrip kecil yang HANYA aktif
   di Android + mode aplikasi terpasang (display-mode: standalone). Skrip menambah "viewport-fit=cover" pada meta itu
   (Chrome 135+ lalu menggambar halaman sampai ke belakang navigation bar gestur) dan menandai <html class="hz-e2e">.
   Semua penyesuaian tampilan ada di style.css bagian "PWA Android: layar penuh" dan dibatasi ke html.hz-e2e,
   jadi iOS, tab browser biasa, dan desktop tidak berubah sama sekali. Aman dipanggil berulang. */
const E2E_INIT_SCRIPT = '<script id="hz-e2e-init">(function(){try{if(/Android/i.test(navigator.userAgent)&&window.matchMedia("(display-mode: standalone)").matches){var m=document.querySelector("meta[name=viewport]");if(m&&!/viewport-fit/i.test(m.getAttribute("content")||""))m.setAttribute("content",(m.getAttribute("content")||"")+", viewport-fit=cover");document.documentElement.classList.add("hz-e2e")}}catch(e){}})();</script>';
function injectE2eInit(html) {
  if (html.indexOf('hz-bare') !== -1) return html;
  if (html.indexOf('id="hz-e2e-init"') !== -1) return html;
  return html.replace(/<meta\b[^>]*name=["']viewport["'][^>]*>/i, (m) => m + E2E_INIT_SCRIPT);
}

/* Service worker: versi SW (var BUILD di public/sw.js) sekarang STATIS dan dinaikkan manual, supaya sw.js TIDAK berubah di
   setiap deploy (dulu tiap deploy memaksa semua pengunjung memasang SW baru + mengunduh ulang /offline). Placeholder
   __HZ_BUILD__ tetap diganti id build bila suatu saat dipakai lagi, tapi sw.js saat ini tidak memakainya. */
/* Mode hemat: sw.js diganti kill-switch. Pengunjung yang sudah punya service worker mengambilnya sekali, lalu SW menghapus cache hz-*,
   memberi tahu halaman (agar penanda pemulihan notifikasi tersimpan), dan melepas dirinya. Setelah itu tidak ada lagi pemeriksaan sw.js.
   Saat mode hemat dimatikan, sw.js normal kembali dan kode di floating-menu.js/notify.js memasang ulang + memulihkan langganan push. */
const SW_KILL_SRC = [
  '/* sw.js - MODE HEMAT CDN (hz-kill-sw). Berkas ini hanya melepas service worker lama; versi normal kembali saat mode hemat dimatikan. */',
  "self.addEventListener('install', function(){ self.skipWaiting(); });",
  "self.addEventListener('activate', function(event){",
  '  event.waitUntil(',
  "    caches.keys().then(function(keys){ return Promise.all(keys.filter(function(k){ return k.indexOf('hz-') === 0; }).map(function(k){ return caches.delete(k); })); })",
  "      .then(function(){ return self.clients.matchAll({ type: 'window', includeUncontrolled: true }); })",
  "      .then(function(list){ list.forEach(function(c){ try{ c.postMessage({ hzSwKilled: 1 }); }catch(err){} }); })",
  '      .then(function(){ return self.registration.unregister(); })',
  '  );',
  '});',
  ''
].join('\n');
function buildServiceWorker() {
  const swPath = path.join(OUT_DIR, 'sw.js');
  if (!fs.existsSync(swPath)) return;
  if (SAVER) {
    fs.writeFileSync(swPath, SW_KILL_SRC, 'utf8');
    console.log('built: sw.js (MODE HEMAT: kill-switch, service worker pengunjung dilepas)');
    return;
  }
  const src = fs.readFileSync(swPath, 'utf8');
  if (src.indexOf('__HZ_BUILD__') !== -1) {
    fs.writeFileSync(swPath, src.split('__HZ_BUILD__').join(String(CACHE_BUST)), 'utf8');
    console.log('built: sw.js (build id ' + CACHE_BUST + ')');
  } else {
    const m = src.match(/var BUILD = '([^']+)'/);
    console.log('built: sw.js (versi SW statis ' + (m ? m[1] : '?') + ', tidak berubah tiap deploy)');
  }
}

function processHtml(content) {
  const withPartials = content.replace(INCLUDE_RE, (match, partialName) => {
    return readPartial(partialName);
  });
  return injectCacheBust(injectCfAnalytics(injectFloatingMenu(injectThemeInit(injectE2eInit(injectPwaHead(withPartials))))));
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

/* Mode khusus untuk workflow .github/workflows/cdn-assets.yml: tulis CSS + JS beraturan nama-hash ke cdn-out/cdn/ lalu keluar (tidak
   menyentuh dist/). Dijalankan: node build.js --cdn-assets. Menulis nama tag git ke stdout (baris 'TAG=...'). */
if (process.argv.includes('--cdn-assets')) {
  ASSET_V = computeAssetVersions();
  const outDir = path.join(__dirname, 'cdn-out', 'cdn');
  fs.rmSync(path.join(__dirname, 'cdn-out'), { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'style.' + ASSET_V.css + '.css'), fs.readFileSync(path.join(SRC_DIR, 'css', 'style.css')));
  fs.writeFileSync(path.join(outDir, 'app.' + ASSET_V.js + '.js'), ASSET_V.bundle, 'utf8');
  /* Berkas data ke direktori terpisah (tag terpisah): isi persis sama dengan public/js/<nama> (hash isi = ASSET_V.data). */
  const dataDir = path.join(__dirname, 'cdn-out-data', 'cdn');
  fs.rmSync(path.join(__dirname, 'cdn-out-data'), { recursive: true, force: true });
  fs.mkdirSync(dataDir, { recursive: true });
  DATA_FILES.forEach((f) => {
    if (ASSET_V.data[f] === undefined) throw new Error('berkas data hilang: public/js/' + f);
    fs.writeFileSync(path.join(dataDir, f.replace(/\.json$/, '.' + ASSET_V.data[f] + '.json')), fs.readFileSync(path.join(SRC_DIR, 'js', f)));
  });
  console.log('TAG=a' + ASSET_V.css + '-' + ASSET_V.js);
  console.log('DTAG=' + assetDataTag());
  process.exit(0);
}
console.log('Building site...');
if (fs.existsSync(OUT_DIR)) fs.rmSync(OUT_DIR, { recursive: true, force: true });
ASSET_V = computeAssetVersions();
console.log('versi aset (hash isi): css ' + ASSET_V.css + ', js ' + ASSET_V.js + ', data ' + JSON.stringify(ASSET_V.data));
VIEWS = loadViewSnapshot();
console.log(VIEWS.ok
  ? 'views snapshot: OK - ' + Object.keys(VIEWS.views).length + ' kunci (token ' + (VIEWS.source === 'read-only' ? 'baca-saja' : 'biasa') + ')'
  : 'views snapshot: dilewati - ' + VIEWS.reason + ' (halaman memakai /api/view seperti biasa)');
copyRecursive(SRC_DIR, OUT_DIR);
buildAppBundle();
buildServiceWorker();

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
    const ogImage = post.thumb ? absoluteUrl(post.thumb) : 'https://cdn.jsdelivr.net/gh/fajarfauzi11/Henz-Script@6f86d3e92da6cc890e6f2034a41c805cd20dcab9/public/favicon.png';
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
      ? matched.map(cardWithViews).join('\n')
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
      ? matched.map(cardWithViews).join('\n')
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
    ? allMatched.map(cardWithViews).join('\n')
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

/* Batas maksimum jumlah varian per blok ability (Pasif/Skill/Ultimate). Dulu 3, sekarang 7. */
const KZ_MAX_ABILITY_VARIANTS = 7;

/* Bangun 1 blok ability (Pasif/Skill/Ultimate), multi-variant-aware (varian 1 s/d 7) — port dari hzBuildAbilityRow */
function hzBuildAbilityRow(opts) {
  const topBorder = opts.borderTop ? 'border-top:1px solid #efefef;' : '';
  const bottomBorder = opts.borderBottom === false ? '' : 'border-bottom:1px solid #efefef;';

  /* Kumpulkan daftar varian yang aktif. Varian 1 selalu aktif (base/default).
     Varian 2 aktif kalau opts.dual true. Varian 3-7 aktif kalau opts.dualN true,
     berurutan (berhenti di angka pertama yang false) — konsisten dengan cascading
     logic di post-editor-tool.html yang menjamin tidak ada "lubang" (mis. varian 4
     aktif tapi varian 3 tidak). */
  const activeVariants = [1];
  if (opts.dual) {
    activeVariants.push(2);
    for (let n = 3; n <= KZ_MAX_ABILITY_VARIANTS; n++) {
      if (opts['dual' + n]) activeVariants.push(n);
      else break;
    }
  }

  function tabNameFor(v) {
    return (v === 1 ? opts.tab1Name : opts['tab' + v + 'Name']) || ('Tab ' + v);
  }

  let labelRow;
  if (activeVariants.length > 1) {
    let segButtons = '';
    activeVariants.forEach((v, i) => {
      const isActive = i === 0;
      segButtons += '      <button aria-checked="' + (isActive ? 'true' : 'false') + '" class="hz-ab-seg-item' + (isActive ? ' active' : '') + '" data-variant="' + v + '" role="radio" type="button" onclick="hzAbMiniSwitch(this)">' + escHtml(tabNameFor(v)) + '</button>\n';
    });
    labelRow = '  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 20px 0;flex-wrap:wrap;">\n'
      + '    <span style="font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:' + opts.labelColor + ';">' + escHtml(opts.label) + '</span>\n'
      + '    <div class="hz-ab-seg hz-ab-seg-mini" data-prefix="' + opts.idPrefix + '" role="radiogroup">\n'
      + segButtons
      + '      <div class="hz-ab-seg-pill"></div>\n'
      + '    </div>\n'
      + '  </div>\n';
  } else {
    labelRow = '  <div style="padding:10px 20px 0;"><span style="font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:' + opts.labelColor + ';">' + escHtml(opts.label) + '</span></div>\n';
  }

  function contentBlock(url, name, kategori, longDesc, prefix) {
    return '  <div style="display:flex;align-items:flex-start;gap:14px;padding:12px 20px 14px;">\n'
      + '    <img src="' + escHtml(url) + '" alt="' + escHtml(name) + '" loading="lazy" decoding="async" style="width:52px;height:52px;border-radius:50%;object-fit:contain;flex-shrink:0;background:#1a1a2e;box-shadow:0 1px 6px rgba(0,0,0,.25);"/>\n'
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

  function fieldsFor(v) {
    if (v === 1) return { url: opts.url, name: opts.name, kategori: opts.kategori, longDesc: opts.longDesc };
    return { url: opts['url' + v], name: opts['name' + v], kategori: opts['kategori' + v], longDesc: opts['longDesc' + v] };
  }

  let body;
  if (activeVariants.length > 1) {
    body = '';
    activeVariants.forEach((v, i) => {
      const f = fieldsFor(v);
      const prefix = v === 1 ? opts.idPrefix : opts.idPrefix + '-v' + v;
      const displayStyle = i === 0 ? 'display:block;' : 'display:none;';
      body += '  <div id="' + opts.idPrefix + '-w' + v + '" style="' + displayStyle + '">\n' + contentBlock(f.url, f.name, f.kategori, f.longDesc, prefix) + '  </div>\n';
    });
  } else {
    body = contentBlock(opts.url, opts.name, opts.kategori, opts.longDesc, opts.idPrefix);
  }

  return '<div style="' + topBorder + bottomBorder + '">\n' + labelRow + body + '</div>\n';
}

/* Ambil field opts varian N (2-7) dari sebuah blok data (pasif atau item skill).
   defaultKat dipakai sebagai fallback kategori (BUFF utk pasif, AOE utk skill, dst). */
function hzExtraVariantOpts(block, n, defaultKat) {
  return {
    ['dual' + n]: !!block['dual' + n],
    ['url' + n]: block['url' + n] || '',
    ['name' + n]: block['name' + n] || '',
    ['kategori' + n]: block['kategori' + n] || defaultKat,
    ['longDesc' + n]: block['longDesc' + n] || ''
  };
}

/* Bangun seluruh section Abilities (Pasif selalu tampil + Skill/Ultimate di grup tersembunyi) */
function buildAbilitiesHtml(data) {
  const dualTabNames = data.dualTabNames || {};
  const tabNameOpts = {};
  for (let n = 1; n <= KZ_MAX_ABILITY_VARIANTS; n++) {
    tabNameOpts['tab' + n + 'Name'] = dualTabNames['tab' + n] || ('Tab ' + n);
  }

  const pasif = data.abilitiesPasif || {};

  const pasifCol = { bg: '#e8f5e9', text: '#2e7d32' };
  let pasifOpts = Object.assign({
    label: 'Pasif', labelColor: pasifCol.text, idPrefix: 'hz-ab-pasif',
    url: pasif.url || '', name: pasif.name || '', kategori: pasif.kategori || 'BUFF',
    longDesc: pasif.longDesc || '', katBg: pasifCol.bg, katText: pasifCol.text, borderTop: false,
    dual: !!pasif.dual,
    url2: pasif.url2 || '', name2: pasif.name2 || '', kategori2: pasif.kategori2 || 'BUFF', longDesc2: pasif.longDesc2 || ''
  }, tabNameOpts);
  for (let n = 3; n <= KZ_MAX_ABILITY_VARIANTS; n++) {
    pasifOpts = Object.assign(pasifOpts, hzExtraVariantOpts(pasif, n, 'BUFF'));
  }
  const pasifHtml = hzBuildAbilityRow(pasifOpts);

  const list = data.abilitiesList || [];
  let skillsHtml = '';
  list.forEach((item, idx) => {
    let col, idPrefix, borderTop = true, borderBottom = true;
    if (idx === 0) { col = { bg: '#e3f2fd', text: '#1565c0' }; idPrefix = 'hz-ab-s1'; }
    else if (idx === 1) { col = { bg: '#f3e5f5', text: '#6a1b9a' }; idPrefix = 'hz-ab-s2'; borderTop = false; }
    else if (idx === list.length - 1) { col = { bg: '#fff3e0', text: '#e65100' }; idPrefix = 'hz-ab-ult'; borderBottom = false; }
    else { col = KZ_DYN_COLORS[(idx - 2) % KZ_DYN_COLORS.length]; idPrefix = 'hz-ab-s' + (idx + 1); }

    let itemOpts = Object.assign({
      label: item.label || ('Skill ' + (idx + 1)), labelColor: col.text, idPrefix: idPrefix,
      url: item.url || '', name: item.name || '', kategori: item.kategori || 'AOE',
      longDesc: item.longDesc || '', katBg: col.bg, katText: col.text, borderTop: borderTop, borderBottom: borderBottom,
      dual: !!item.dual,
      url2: item.url2 || '', name2: item.name2 || '', kategori2: item.kategori2 || 'AOE', longDesc2: item.longDesc2 || ''
    }, tabNameOpts);
    for (let n = 3; n <= KZ_MAX_ABILITY_VARIANTS; n++) {
      itemOpts = Object.assign(itemOpts, hzExtraVariantOpts(item, n, 'AOE'));
    }

    skillsHtml += hzBuildAbilityRow(itemOpts);
  });

  return { pasifHtml, skillsHtml };
}

/* Bangun 1 baris tabel download — port dari buildDlRow */
function hzExtractHeroCode(url) {
  if (!url) return '';
  const m = url.match(/\/(Hero\d+)-icon/i);
  return m ? m[1] : '';
}
/* Badge "Fix SFX" — position:absolute di atas nama replace, di dalam pembungkus position:relative yang
   sudah ada. Karena absolute, badge tidak ikut menentukan tinggi/posisi nama, ikon, maupun tombol Download. */
function hzFixSfxBadge() {
  return '<span data-hz-fixsfx="1" style="position:absolute;bottom:100%;left:50%;transform:translateX(-50%);margin-bottom:2px;display:inline-flex;align-items:center;gap:2px;font-size:8px;font-weight:800;letter-spacing:.4px;line-height:1.2;padding:1.5px 6px;border-radius:20px;white-space:nowrap;background:#e3f2fd;color:#1565c0;font-family:\'Manrope\',sans-serif;"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0;"><path d="M15 8a5 5 0 0 1 0 8"/><path d="M17.7 5a9 9 0 0 1 0 14"/><path d="M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5"/></svg>SFX REPLAY</span>';
}
/* Runtime kecil, hanya disertakan kalau tabel punya badge Fix SFX. Nama replace yang turun jadi 2+ baris
   di layar sempit mendorong badge (absolute) mendekati garis atas baris; script ini mengukur jaraknya dan
   menambah padding-top pada sel nama HANYA kalau jarak < 6px. Baris bernama 1 baris tidak disentuh. */
var HZ_FIXSFX_SCRIPT = ''
  + '<script>\n'
  + '(function(){\n'
  + '  var G=6;\n'
  + '  function adj(){\n'
  + '    var bs=document.querySelectorAll("[data-hz-fixsfx]");\n'
  + '    for(var i=0;i<bs.length;i++){\n'
  + '      var b=bs[i],td=b.closest("td"),tr=b.closest("tr");\n'
  + '      if(!td||!tr)continue;\n'
  + '      var base=td.getAttribute("data-hz-pt");\n'
  + '      if(base===null){base=parseFloat(getComputedStyle(td).paddingTop)||0;td.setAttribute("data-hz-pt",base);}\n'
  + '      else base=parseFloat(base);\n'
  + '      td.style.paddingTop=base+"px";\n'
  + '      if(!tr.offsetHeight)continue;\n'
  + '      var p=0;\n'
  + '      for(var k=0;k<6;k++){\n'
  + '        var d=G-(b.getBoundingClientRect().top-tr.getBoundingClientRect().top);\n'
  + '        if(d<=0.5)break;\n'
  + '        p+=d;td.style.paddingTop=(base+p)+"px";\n'
  + '      }\n'
  + '    }\n'
  + '  }\n'
  + '  var t;function sch(){if(window.requestAnimationFrame){cancelAnimationFrame(t);t=requestAnimationFrame(adj);}else adj();}\n'
  + '  var o=window.hzDlTabSwitch;\n'
  + '  if(typeof o==="function")window.hzDlTabSwitch=function(x){o(x);adj();};\n'
  + '  if(document.readyState!=="loading")adj();else document.addEventListener("DOMContentLoaded",adj);\n'
  + '  window.addEventListener("load",adj);\n'
  + '  window.addEventListener("resize",sch);\n'
  + '  window.addEventListener("orientationchange",sch);\n'
  + '  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(adj);\n'
  + '})();\n'
  + '</script>\n';
function hzWithFixSfxScript(html) {
  return html.indexOf('data-hz-fixsfx') !== -1 ? html + HZ_FIXSFX_SCRIPT : html;
}
function buildDlRow(name, url, link, isLast, fixSfx) {
  const altR = hzExtractHeroCode(url) || name;
  const hasLogo = /logo/i.test(name);
  const logoQBtn = hasLogo
    ? '<button type="button" onclick="hzOpenLogoTooltip()" aria-label="Apa itu Logo?" style="position:absolute;top:50%;left:100%;margin-left:4px;transform:translateY(-50%);display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;border-radius:50%;border:1px solid #b5b5b5;background:#fff;color:#717171;font-size:9px;font-weight:700;font-family:\'Manrope\',sans-serif;cursor:pointer;padding:0;line-height:1;">?</button>'
    : '';
  const dlBtn = link
    ? '<a href="#" onclick="hzDlGateOpen(this);return false;" data-name="' + escHtml(name) + '" data-url="' + escHtml(link) + '" style="display:inline-flex;align-items:center;justify-content:center;padding:7px 16px;background:#fff;border:2px solid #e0e0e0;border-radius:10px;font-family:\'Manrope\',sans-serif;font-size:11px;font-weight:700;color:#111;text-decoration:none;white-space:nowrap;">Download</a>'
    : '<span style="display:inline-flex;align-items:center;justify-content:center;padding:7px 16px;background:#e0e0e0;border:2px solid #e0e0e0;border-radius:10px;font-family:\'Manrope\',sans-serif;font-size:11px;font-weight:700;color:#999;white-space:nowrap;cursor:default;width:88px;height:30px;box-sizing:border-box;">Soon!</span>';
  const rowStyle = isLast ? '' : 'border-bottom:1px solid #f0f0f0;';
  return '<tr style="' + rowStyle + '">\n'
    + '  <td style="padding:14px 14px;text-align:center;vertical-align:middle;"><span style="position:relative;display:inline-block;">' + (fixSfx ? hzFixSfxBadge() : '') + '<span style="font-weight:800;color:#111;font-size:12px;">' + escHtml(name) + '</span>' + logoQBtn + '</span></td>\n'
    + '  <td style="padding:14px 14px;text-align:center;vertical-align:middle;"><img src="' + escHtml(url) + '" alt="' + escHtml(altR) + '" referrerpolicy="no-referrer" loading="lazy" decoding="async" style="width:42px;height:42px;border-radius:50%;object-fit:cover;box-shadow:0 1px 5px rgba(0,0,0,.15);margin:0 auto;display:block;"/></td>\n'
    + '  <td style="padding:14px 14px;text-align:center;vertical-align:middle;">' + dlBtn + '</td>\n'
    + '</tr>\n';
}

/* Baris Tab 2 — identik Tab 1, namareplace kuning (#FFC200), logo tooltip tetap ada */
function buildDlRowTab2(name, url, link, isLast, fixSfx) {
  const altR = hzExtractHeroCode(url) || name;
  const hasLogo = /logo/i.test(name);
  const logoQBtn = hasLogo
    ? '<button type="button" onclick="hzOpenLogoTooltip()" aria-label="Apa itu Logo?" style="position:absolute;top:50%;left:100%;margin-left:4px;transform:translateY(-50%);display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;border-radius:50%;border:1px solid #b5b5b5;background:#fff;color:#717171;font-size:9px;font-weight:700;font-family:\'Manrope\',sans-serif;cursor:pointer;padding:0;line-height:1;">?</button>'
    : '';
  const dlBtn = link
    ? '<a href="#" onclick="hzDlGateOpen(this);return false;" data-name="' + escHtml(name) + '" data-url="' + escHtml(link) + '" style="display:inline-flex;align-items:center;justify-content:center;padding:7px 16px;background:#fff;border:2px solid #e0e0e0;border-radius:10px;font-family:\'Manrope\',sans-serif;font-size:11px;font-weight:700;color:#111;text-decoration:none;white-space:nowrap;">Download</a>'
    : '<span style="display:inline-flex;align-items:center;justify-content:center;padding:7px 16px;background:#e0e0e0;border:2px solid #e0e0e0;border-radius:10px;font-family:\'Manrope\',sans-serif;font-size:11px;font-weight:700;color:#999;white-space:nowrap;cursor:default;width:88px;height:30px;box-sizing:border-box;">Soon!</span>';
  const rowStyle = isLast ? '' : 'border-bottom:1px solid #f0f0f0;';
  return '<tr style="' + rowStyle + '">\n'
    + '  <td style="padding:14px 14px;text-align:center;vertical-align:middle;"><span style="position:relative;display:inline-block;">' + (fixSfx ? hzFixSfxBadge() : '') + '<span style="font-weight:800;color:#FFC200;font-size:12px;">' + escHtml(name) + '</span>' + logoQBtn + '</span></td>\n'
    + '  <td style="padding:14px 14px;text-align:center;vertical-align:middle;"><img src="' + escHtml(url) + '" alt="' + escHtml(altR) + '" referrerpolicy="no-referrer" loading="lazy" decoding="async" style="width:42px;height:42px;border-radius:50%;object-fit:cover;box-shadow:0 1px 5px rgba(0,0,0,.15);margin:0 auto;display:block;"/></td>\n'
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
  const rowsHtml = (rows) => rows.map((r, i) => buildDlRow(r.name, r.url, r.link, i === rows.length - 1, !!r.fixSfx)).join('');
  const rowsHtmlTab2 = (rows) => rows.map((r, i) => buildDlRowTab2(r.name, r.url, r.link, i === rows.length - 1, !!r.fixSfx)).join('');

  if (!dl.dual) {
    return hzWithFixSfxScript(buildDlTableWrap(rowsHtml(rowsTab1)));
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

  // Single table, dua <tbody> — browser hitung lebar kolom dari semua baris sekaligus
  // sehingga Tab 1 & Tab 2 selalu punya kolom identik tanpa perlu table-layout:fixed
  const dualTable = '<div style="border:1px solid #e8e8e8;border-radius:16px;overflow:hidden;">\n'
    + '  <div style="overflow-x:auto;width:100%;">\n'
    + '    <table style="width:100%;border-collapse:collapse;font-family:\'Manrope\',sans-serif;font-size:13px;">\n'
    + '      <thead>\n'
    + '        <tr style="background:#fafafa;border-bottom:1px solid #e8e8e8;">\n'
    + '          <th style="padding:11px 14px;text-align:center;font-size:9px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;color:#aaa;width:40%;">Replaces</th>\n'
    + '          <th style="padding:11px 14px;text-align:center;font-size:9px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;color:#aaa;width:30%;">Icon</th>\n'
    + '          <th style="padding:11px 14px;text-align:center;font-size:9px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;color:#aaa;width:30%;">Action</th>\n'
    + '        </tr>\n'
    + '      </thead>\n'
    + '      <tbody id="hz-dl-t1">\n' + rowsHtml(rowsTab1) + '      </tbody>\n'
    + '      <tbody id="hz-dl-t2" style="display:none;">\n' + rowsHtmlTab2(rowsTab2) + '      </tbody>\n'
    + '    </table>\n'
    + '  </div>\n'
    + '</div>\n';

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
    + '  if(t1)t1.style.display=(target==="hz-dl-t1")?"table-row-group":"none";\n'
    + '  if(t2)t2.style.display=(target==="hz-dl-t2")?"table-row-group":"none";\n'
    + '};\n'
    + '</script>\n';

  return hzWithFixSfxScript(seg + dualTable + initScript);
}

/* Ubah tombol Download jadi "Soon!" kalau href-nya kosong setelah semua token diganti
   (jaga-jaga kalau link diisi placeholder string kosong dari data lama) */
function hzApplySoonFallback(html) {
  return html.replace(
    /<a href="" target="_blank" rel="noopener" style="([^"]*)">\s*Download\s*<\/a>/g,
    '<span style="$1background:#e0e0e0;border-color:#e0e0e0;color:#999;cursor:default;width:88px;height:30px;box-sizing:border-box;">Soon!</span>'
  );
}

/* ===================== SEO: pratinjau tautan (Open Graph) + data terstruktur (JSON-LD) =====================
   Semua berupa tag di <head>: TIDAK mengubah tampilan atau desain halaman sama sekali.
   - Halaman post (dari template): JSON-LD dibuat di generatePostPages lewat placeholder {{JSONLD}}; OG sudah ada di template.
   - Halaman lain (beranda, hero, kategori, hub, tutorial, dst.): injectSeoMetaAll() menyuntik OG + JSON-LD di akhir build,
     memakai <title>, meta description, dan canonical yang SUDAH ada di tiap halaman. Idempoten (lewati yang sudah punya). */
const SEO_SITE_NAME = 'Henz MLBB';
const SEO_DEFAULT_IMAGE = ICON_CDN + 'icon-512.png';
const SEO_SAME_AS = ['https://www.youtube.com/@henzthesixth', 'https://t.me/henzcorps', 'https://whatsapp.com/channel/0029VbDXzYMId7nKuFlKs73B'];
const ID_MONTH_ANY = { jan: '01', januari: '01', feb: '02', februari: '02', mar: '03', maret: '03', apr: '04', april: '04', mei: '05', may: '05', jun: '06', juni: '06', jul: '07', juli: '07', agu: '08', agt: '08', agustus: '08', aug: '08', sep: '09', sept: '09', september: '09', okt: '10', oktober: '10', oct: '10', nov: '11', november: '11', des: '12', desember: '12', dec: '12' };
/* Tanggal di data post bervariasi: "8 September 2026", "3 Okt 2026", "Update 8 Sep 2026" -> "2026-09-08" */
function parseDateFlexible(str) {
  const t = (str || '').replace(/^\s*update\s*/i, '').trim().split(/\s+/);
  if (t.length !== 3 || !/^\d{1,2}$/.test(t[0]) || !/^\d{4}$/.test(t[2])) return null;
  const mo = ID_MONTH_ANY[t[1].toLowerCase().replace(/\./g, '')];
  return mo ? t[2] + '-' + mo + '-' + t[0].padStart(2, '0') : null;
}

/* ===== Log Update: field upd di posts.json ({t:<epoch ms>, n:<catatan>}, ditulis tool post) =====
   Dipakai untuk kotak "Diperbarui" di halaman post, dateModified JSON-LD, dan lastmod sitemap.
   Tanggal dihitung di zona WIB (Asia/Jakarta), bukan zona server build (UTC). */
const UPD_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const UPD_DATE_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' });
function updInfo(entry) {
  const u = entry && entry.upd;
  if (!u || typeof u.t !== 'number' || !isFinite(u.t) || u.t <= 0) return null;
  const parts = UPD_DATE_FMT.formatToParts(new Date(u.t));
  const g = (type) => (parts.find((x) => x.type === type) || {}).value;
  const y = g('year'), m = g('month'), d = g('day');
  if (!y || !m || !d || !UPD_MONTHS[parseInt(m, 10) - 1]) return null;
  let note = typeof u.n === 'string' ? u.n.replace(/\s+/g, ' ').trim() : '';
  if (note.length > 120) note = note.slice(0, 119).replace(/\s+$/, '') + '\u2026';
  return { iso: y + '-' + m + '-' + d, label: parseInt(d, 10) + ' ' + UPD_MONTHS[parseInt(m, 10) - 1] + ' ' + y, note: note };
}
function laterIso(a, b) { if (!a) return b || null; if (!b) return a; return a >= b ? a : b; }
/* Saklar kotak "Diperbarui" di halaman post: SEMENTARA DIMATIKAN (permintaan Essen, 25/11/2026). Nyalakan lagi dengan env HZ_SHOW_UPDATED=1
   di Vercel (lalu Redeploy) atau ubah default di bawah jadi true. Hanya memengaruhi kotak di post: popup Log Update, dateModified JSON-LD,
   dan lastmod sitemap tetap memakai data upd. */
const SHOW_POST_UPDATED = process.env.HZ_SHOW_UPDATED === '1';
function buildUpdatedHtml(entry) {
  if (!SHOW_POST_UPDATED) return '';
  const u = updInfo(entry);
  if (!u) return '';
  return '<div class="hz-post-upd" id="hz-post-upd"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10"/></svg><span><strong>Diperbarui ' + u.label + '</strong>' + (u.note ? ' &middot; ' + escHtml(u.note) : '') + '</span></div>';
}
/* "<" di-escape supaya isi JSON tidak pernah bisa menutup tag <script> */
function ldScript(obj) {
  return '<script type="application/ld+json">' + JSON.stringify(obj).replace(/</g, '\\u003c') + '</script>';
}
function ldBreadcrumb(items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it[0], item: absoluteUrl(it[1]) })),
  };
}
function buildPostJsonLd(data, slug, postUrl, entry) {
  const url = absoluteUrl(postUrl);
  const name = 'Script Skin ' + (data.namehero || slug);
  const heroName = (entry && entry.hero) || data.herolink || '';
  const hs = slugify(heroName);
  const crumbs = [['Beranda', '/'], ['Daftar Hero', '/daftar-hero']];
  if (heroName && fs.existsSync(path.join(OUT_DIR, 'hero', hs + '.html'))) crumbs.push([heroName, '/hero/' + hs]);
  crumbs.push([name, postUrl]);
  const baseModified = parseDateFlexible(data.datepost);
  const modified = laterIso(baseModified, (updInfo(entry) || {}).iso); // pembaruan dari Log Update bisa lebih baru dari datepost
  const published = parseDateFlexible(entry && entry.date) || baseModified;
  return ldScript({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': url + '#article',
        headline: name,
        description: 'Download script skin ' + (data.namehero || slug) + ' no password, aman, dan terbaru dari Henz MLBB.',
        image: data.urlthumbnail ? [data.urlthumbnail] : undefined,
        datePublished: published || undefined,
        dateModified: modified || published || undefined,
        author: { '@type': 'Person', name: data.authorname || SEO_SITE_NAME },
        publisher: { '@type': 'Organization', name: SEO_SITE_NAME, logo: { '@type': 'ImageObject', url: SEO_DEFAULT_IMAGE } },
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        articleSection: data.kategoriskin || undefined,
        keywords: data.keywords || undefined,
        inLanguage: 'id',
      },
      ldBreadcrumb(crumbs),
    ],
  });
}

function injectSeoMetaAll() {
  const postsPath = path.join(SRC_DIR, 'js', 'posts.json');
  const posts = fs.existsSync(postsPath) ? JSON.parse(fs.readFileSync(postsPath, 'utf8')) : [];
  const heroesPath = path.join(SRC_DIR, 'js', 'heroes.json');
  const heroes = fs.existsSync(heroesPath) ? JSON.parse(fs.readFileSync(heroesPath, 'utf8')) : [];
  const catsPath = path.join(SRC_DIR, 'js', 'categories.json');
  const cats = fs.existsSync(catsPath) ? JSON.parse(fs.readFileSync(catsPath, 'utf8')) : {};
  const heroNameBySlug = {};
  heroes.forEach((h) => { if (h && h.name) heroNameBySlug[slugify(h.name)] = h.name; });
  const catNameBySlug = {};
  Object.keys(cats).forEach((c) => { catNameBySlug[slugify(c)] = c; });
  const latestThumbBy = (keyFn) => {
    const m = {};
    posts.forEach((p) => {
      const k = keyFn(p);
      if (!k || !p.thumb || !/^https:\/\//i.test(p.thumb)) return;
      if (!m[k] || (Number(p.id) || 0) > (Number(m[k].id) || 0)) m[k] = p;
    });
    return m;
  };
  const latestByHero = latestThumbBy((p) => (p.hero ? slugify(p.hero) : ''));
  const latestByCat = latestThumbBy((p) => (p.cat ? slugify(p.cat) : ''));
  const STATIC_NAMES = {
    'daftar-hero.html': 'Daftar Hero', 'kategori-skin.html': 'Kategori Skin', 'tutorial.html': 'Tutorial', 'socials.html': 'Socials', 'credits.html': 'Credits',
    'request-script.html': 'Request Script', 'kebijakan-privasi.html': 'Kebijakan Privasi', 'syarat-ketentuan.html': 'Syarat & Ketentuan',
  };
  const attr = (v) => String(v).replace(/"/g, '&quot;');
  const walk = (dir, out) => {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) walk(f, out); else if (e.name.endsWith('.html')) out.push(f);
    });
    return out;
  };
  let nOg = 0, nLd = 0;
  walk(OUT_DIR, []).forEach((fpath) => {
    const rel = path.relative(OUT_DIR, fpath).split(path.sep).join('/');
    if (rel === '404.html' || rel === 'offline.html' || rel === 'category.html' || rel === 'daftarhero.html' || rel === 'scriptrequest.html') return;
    let html = fs.readFileSync(fpath, 'utf8');
    if (html.indexOf('</head>') === -1 || /<meta[^>]+name="robots"[^>]+noindex/i.test(html)) return;
    const tm = html.match(/<title>([\s\S]*?)<\/title>/);
    const cm = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/);
    const dm = html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/) || html.match(/<meta[^>]+content="([^"]*)"[^>]+name="description"/);
    if (!tm || !cm) return;
    const title = tm[1].trim();
    const canonical = cm[1];
    const desc = dm ? dm[1] : '';
    let image = SEO_DEFAULT_IMAGE;
    let large = false;
    let ld = null;
    let m;
    if (rel === 'index.html') {
      ld = { '@context': 'https://schema.org', '@graph': [
        { '@type': 'WebSite', '@id': BASE_URL + '/#website', url: BASE_URL + '/', name: SEO_SITE_NAME, inLanguage: 'id', publisher: { '@id': BASE_URL + '/#org' },
          potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: BASE_URL + '/search?q={search_term_string}' }, 'query-input': 'required name=search_term_string' } },
        { '@type': 'Organization', '@id': BASE_URL + '/#org', name: SEO_SITE_NAME, url: BASE_URL + '/', logo: { '@type': 'ImageObject', url: SEO_DEFAULT_IMAGE }, sameAs: SEO_SAME_AS },
      ] };
    } else if ((m = rel.match(/^hero\/([^/]+)\.html$/))) {
      const name = heroNameBySlug[m[1]] || title;
      const lp = latestByHero[m[1]];
      if (lp) { image = lp.thumb; large = true; }
      ld = { '@context': 'https://schema.org', '@graph': [
        { '@type': 'CollectionPage', '@id': canonical + '#page', url: canonical, name: title, description: desc || undefined, inLanguage: 'id', isPartOf: { '@id': BASE_URL + '/#website' } },
        ldBreadcrumb([['Beranda', '/'], ['Daftar Hero', '/daftar-hero'], [name, '/hero/' + m[1]]]),
      ] };
    } else if ((m = rel.match(/^kategori-skin\/([^/]+)\.html$/))) {
      const name = m[1] === 'semua' ? 'Semua Skin' : (catNameBySlug[m[1]] || title);
      const lp = latestByCat[m[1]];
      if (lp) { image = lp.thumb; large = true; }
      ld = { '@context': 'https://schema.org', '@graph': [
        { '@type': 'CollectionPage', '@id': canonical + '#page', url: canonical, name: title, description: desc || undefined, inLanguage: 'id', isPartOf: { '@id': BASE_URL + '/#website' } },
        ldBreadcrumb([['Beranda', '/'], ['Kategori Skin', '/kategori-skin'], [name, '/kategori-skin/' + m[1]]]),
      ] };
    } else if (STATIC_NAMES[rel]) {
      ld = { '@context': 'https://schema.org', '@graph': [ldBreadcrumb([['Beranda', '/'], [STATIC_NAMES[rel], '/' + rel.replace(/\.html$/, '')]])] };
    }
    let add = '';
    if (html.indexOf('property="og:title"') === -1) {
      add += '<meta property="og:type" content="website"/>\n<meta property="og:site_name" content="' + SEO_SITE_NAME + '"/>\n<meta property="og:locale" content="id_ID"/>\n'
        + '<meta property="og:title" content="' + attr(title) + '"/>\n'
        + (desc ? '<meta property="og:description" content="' + desc + '"/>\n' : '')
        + '<meta property="og:url" content="' + canonical + '"/>\n<meta property="og:image" content="' + attr(image) + '"/>\n'
        + '<meta name="twitter:card" content="' + (large ? 'summary_large_image' : 'summary') + '"/>\n';
      nOg++;
    }
    if (ld && html.indexOf('application/ld+json') === -1) { add += ldScript(ld) + '\n'; nLd++; }
    if (!add) return;
    html = html.replace('</head>', () => add + '</head>'); // fungsi pengganti: "$&"/"$'" di judul tidak ditafsirkan
    fs.writeFileSync(fpath, html, 'utf8');
  });
  console.log('SEO: OG disuntik ke ' + nOg + ' halaman, JSON-LD ke ' + nLd + ' halaman (selain post dari template).');
}

/* ===================== "Skin Lain" di halaman post (dibuat saat build) =====================
   Aturan (dua bagian terpisah, masing-masing punya judul dan tautan "Lihat Semua"):
   1) "Skin Lain dari <hero>": skin lain dari hero yang sama (terbaru dulu, maks 4).
   2) "Skin <kategori> Lainnya": skin lain di kategori yang sama (maks 4, tanpa duplikat dari bagian 1) — SELALU ditampilkan
      bila ada isinya, berapa pun jumlah kartu di bagian 1.
   Kalau hero tidak punya skin lain sama sekali, bagian 2 menjadi satu-satunya bagian.
   Kalau keduanya kosong, tidak ada yang ditampilkan.
   Sumber data = posts.json, jadi post draft (tidak ada di posts.json) tidak pernah muncul di sini, dan view count
   kartu diisi otomatis oleh main.js (hzLoadViewCounts membaca semua [data-view-id], 1 request gabungan). */
const RELATED_MAX = 4;
function buildRelatedSection(id, title, moreHref, list) {
  return '<section id="' + id + '" class="hz-related" aria-labelledby="' + id + '-title">\n'
    + '        <div class="hz-related-head"><h2 id="' + id + '-title">' + escHtml(title) + '</h2>'
    + (moreHref ? '<a class="hz-related-all" href="' + moreHref + '">Lihat Semua &rarr;</a>' : '') + '</div>\n'
    + '        <div class="hz-related-grid">\n' + list.map(cardWithViews).join('\n') + '\n        </div>\n'
    + '      </section>';
}
function buildRelatedHtml(entry, postsArr) {
  if (!entry || !postsArr || !postsArr.length) return '';
  const byNewest = (a, b) => (b.id || 0) - (a.id || 0);
  const others = postsArr.filter((p) => p && p.url && p.url !== entry.url);
  const sections = [];
  let heroList = [];
  if (entry.hero) {
    const hs = slugify(entry.hero);
    heroList = others.filter((p) => p.hero && slugify(p.hero) === hs).sort(byNewest).slice(0, RELATED_MAX);
    if (heroList.length) {
      const moreHref = fs.existsSync(path.join(OUT_DIR, 'hero', hs + '.html')) ? '/hero/' + hs : '';
      sections.push(buildRelatedSection('hz-related', 'Skin Lain dari ' + entry.hero, moreHref, heroList));
    }
  }
  if (entry.cat) {
    const used = new Set(heroList.map((p) => p.url));
    const catList = others.filter((p) => p.cat === entry.cat && !used.has(p.url)).sort(byNewest).slice(0, RELATED_MAX);
    if (catList.length) {
      const cs = slugify(entry.cat);
      const moreHref = fs.existsSync(path.join(OUT_DIR, 'kategori-skin', cs + '.html')) ? '/kategori-skin/' + cs : '';
      sections.push(buildRelatedSection(sections.length ? 'hz-related-cat' : 'hz-related', 'Skin ' + entry.cat + ' Lainnya', moreHref, catList));
    }
  }
  return sections.join('\n\n      ');
}

/* Badge "Special" di banner post penuh. Teks dinormalisasi oleh hzBadgeText (card-template.js) yang sama dengan card. */
function buildPostBadgeHtml(raw) {
  const text = hzBadgeText(raw);
  return text ? '<span class="hz-post-badge" id="hz-post-badge">' + escHtml(text) + '</span>' : '';
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
  let postsIndexArr = [];
  let postsIndexLoaded = false;
  if (fs.existsSync(postsJsonPath)) {
    const postsIndex = JSON.parse(fs.readFileSync(postsJsonPath, 'utf8'));
    postsIndexArr = postsIndex;
    postsIndex.forEach((p) => { if (p.url) postsIndexByUrl[p.url] = p; });
    postsIndexLoaded = true;
  }
  /* Post "tidak publik" (draft) = punya data JSON tapi TIDAK terdaftar di posts.json.
     Halaman tetap dibuat (bisa dibuka lewat link langsung) tapi noindex & tidak masuk sitemap;
     homepage/search/hero/kategori otomatis tidak menampilkannya karena semuanya membaca posts.json. */
  const draftSlugs = [];

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
    const isDraft = postsIndexLoaded && !postsEntry;
    if (isDraft) {
      draftSlugs.push(slug);
    } else if (!postsEntry) {
      console.log('  \u26a0 "' + slug + '" belum ada di posts.json — view count sementara pakai slug sebagai id.');
    }

    if (postsEntry && hzBadgeText(data.badge) !== hzBadgeText(postsEntry.badge)) {
      console.log('  \u26a0 "' + slug + '": badge di data JSON ("' + hzBadgeText(data.badge) + '") berbeda dengan posts.json ("' + hzBadgeText(postsEntry.badge) + '") — card dan halaman post akan tampil berbeda. Upload ulang post ini lewat tool.');
    }

    let html = template
      .split('{{NAMEHERO}}').join(escHtml(namehero))
      .split('{{URLTHUMBNAIL}}').join(data.urlthumbnail || '')
      .split('{{BADGE_INJECT}}').join(buildPostBadgeHtml(data.badge))
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
      .split('{{VIEW_COUNT}}').join(VIEWS.ok ? hzFormatViewCount(viewCountFor(viewId, slug)) : '&ndash;')
      .split('{{CANONICAL_URL}}').join(absoluteUrl(postUrl))
      .split('{{ROBOTS_META}}').join(isDraft ? '\n<meta name="robots" content="noindex,nofollow"/>' : '')
      .split('{{UPDATED_INJECT}}').join(isDraft ? '' : buildUpdatedHtml(postsEntry))
      .split('{{RELATED_INJECT}}').join(isDraft ? '' : buildRelatedHtml(postsEntry, postsIndexArr))
      .split('{{JSONLD}}').join(isDraft ? '' : buildPostJsonLd(data, slug, postUrl, postsEntry));

    html = hzApplySoonFallback(html);
    html = processHtml(html);
    fs.writeFileSync(path.join(postOutDir, slug + '.html'), injectCacheBust(html), 'utf8');
    if (!isDraft) addSitemapUrl(postUrl, { lastmod: laterIso(parseIdDate(data.datepost), (updInfo(postsEntry) || {}).iso), changefreq: 'monthly', priority: 0.9, category: 'post' });
    console.log('built: post/' + slug + '.html (dari data JSON)' + (isDraft ? ' [TIDAK PUBLIK]' : ''));
  });
  if (draftSlugs.length) {
    console.log('  \u25cb ' + draftSlugs.length + ' post tidak publik (noindex, tanpa sitemap): ' + draftSlugs.join(', '));
  }
}
generatePostPages();

/* ===================== sitemap.xml & robots.txt ===================== */
function generateSitemapAndRobots() {
  // Halaman menu statis (bukan hero/kategori/post yang sudah didaftarkan di generate*Pages())
  addSitemapUrl('/', {changefreq: 'daily', priority: 1.0, category: 'page'});
  addSitemapUrl('/kategori-skin', {changefreq: 'weekly', priority: 0.8, category: 'page'});
  addSitemapUrl('/daftar-hero', {changefreq: 'weekly', priority: 0.8, category: 'page'});
  addSitemapUrl('/request-script', {changefreq: 'monthly', priority: 0.4, category: 'page'});
  // /search sengaja TIDAK masuk sitemap (halaman hasil pencarian; juga ditutup di robots.txt)
  addSitemapUrl('/socials', {changefreq: 'monthly', priority: 0.3, category: 'page'});
  // Credits disembunyikan sementara dari sitemap (halaman /credits tetap ada). Aktifkan lagi saat siap dirilis:
  // addSitemapUrl('/credits', {changefreq: 'monthly', priority: 0.3, category: 'page'});
  addSitemapUrl('/tutorial', {changefreq: 'monthly', priority: 0.5, category: 'page'});
  addSitemapUrl('/kebijakan-privasi', {changefreq: 'yearly', priority: 0.2, category: 'page'});
  addSitemapUrl('/syarat-ketentuan', {changefreq: 'yearly', priority: 0.2, category: 'page'});

  // Halaman post (script detail) — dibaca langsung dari posts.json, di-generate manual (bukan lewat build.js)
  const postsPath = path.join(SRC_DIR, 'js', 'posts.json');
  if (fs.existsSync(postsPath)) {
    const posts = JSON.parse(fs.readFileSync(postsPath, 'utf8'));
    posts.forEach((p) => {
      if (!p.url) return;
      addSitemapUrl(p.url, {
        lastmod: laterIso(parseIdDate(p.date), (updInfo(p) || {}).iso),
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

  /* Mode hemat: crawler bernilai rendah (bukan mesin pencari yang mengirim pengunjung) ditutup total. Hanya yang patuh robots.txt yang
     berhenti; dampaknya kecil (sekitar 1% request), tetapi tanpa risiko SEO. Googlebot, Bingbot, OAI-SearchBot, dll. TIDAK disentuh. */
  const botBlocks = SAVER ? LOW_VALUE_BOTS.map((b) => 'User-agent: ' + b + '\nDisallow: /\n\n').join('') : '';
  const robots = 'User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /search\n\n' + botBlocks + 'Sitemap: ' + BASE_URL + '/sitemap_index.xml\n';
  fs.writeFileSync(path.join(OUT_DIR, 'robots.txt'), robots, 'utf8');
  console.log('built: robots.txt');
}
injectSeoMetaAll();
generateSitemapAndRobots();

/* Mode hemat: halaman post memuat id+slug dirinya sendiri (window.HZ_POST) supaya pencatatan view tidak perlu mengunduh posts.json.
   Dicocokkan lewat URL halaman ke posts.json; post draf (tidak ada di posts.json) tidak diberi HZ_POST, jadi tidak pernah dicatat. */
function injectSaverPostIds() {
  if (!SAVER) return;
  const idx = JSON.parse(fs.readFileSync(path.join(SRC_DIR, 'js', 'posts.json'), 'utf8'));
  const norm = (u) => String(u || '').split('?')[0].split('#')[0].replace(/\.html$/i, '').replace(/\/+$/, '');
  const byUrl = {};
  idx.forEach((p) => { if (p && p.url) byUrl[norm(p.url)] = p; });
  const dir = path.join(OUT_DIR, 'post');
  let n = 0;
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).filter((f) => f.endsWith('.html')).forEach((f) => {
    const p = byUrl['/post/' + f.replace(/\.html$/i, '')];
    if (!p || p.id === undefined || p.id === null) return;
    const file = path.join(dir, f);
    const html = fs.readFileSync(file, 'utf8');
    if (html.indexOf('window.HZ_DV=') === -1 || html.indexOf('window.HZ_POST=') !== -1) return;
    const tag = 'window.HZ_POST=' + JSON.stringify({ id: p.id, slug: hzSlugFromUrl(p.url) }).replace(/</g, '\\u003c') + ';';
    fs.writeFileSync(file, html.replace('window.HZ_DV=', tag + 'window.HZ_DV='), 'utf8');
    n++;
  });
  console.log('mode hemat: HZ_POST ditanam di ' + n + ' halaman post');
}
injectSaverPostIds();

/* ===================== Pagar pengaman build =====================
   Bila hasil build tidak utuh, build GAGAL (exit 1): Vercel membatalkan deployment itu dan production tetap memakai
   deployment sebelumnya, jadi situs tidak pernah tayang tanpa CSS / dengan halaman rusak.
   Memeriksa: CSS dan app.js utuh, tiap halaman memuat stylesheet situs, tidak ada placeholder template {{HURUF_BESAR}}
   yang tersisa, dan setiap blok JSON-LD valid. Hanya MEMBACA dist; tidak mengubah hasil build apa pun. */
function verifyDist() {
  const problems = [];
  const need = (cond, msg) => { if (!cond) problems.push(msg); };
  const srcCss = path.join(SRC_DIR, 'css', 'style.css');
  const outCss = path.join(OUT_DIR, 'css', 'style.css');
  if (!fs.existsSync(outCss)) {
    problems.push('dist/css/style.css tidak ada');
  } else {
    const a = fs.readFileSync(srcCss);
    const c = fs.readFileSync(outCss);
    need(a.length >= 50000, 'sumber public/css/style.css terlalu kecil (' + a.length + ' byte)');
    need(a.equals(c), 'dist/css/style.css tidak sama dengan sumbernya');
  }
  /* Versi ?v= (hash isi) yang ditulis ke HTML harus cocok dengan isi berkas yang BENAR-BENAR ada di dist; kalau tidak, browser
     bisa menyimpan isi yang salah di bawah URL yang di-cache 1 tahun. */
  const hashOf = (rel) => { const p = path.join(OUT_DIR, rel); return fs.existsSync(p) ? contentHash(fs.readFileSync(p)) : null; };
  need(hashOf('css/style.css') === ASSET_V.css, 'versi css (?v=) tidak cocok dengan isi dist/css/style.css');
  need(hashOf('js/app.js') === ASSET_V.js, 'versi js (?v=) tidak cocok dengan isi dist/js/app.js');
  DATA_FILES.forEach((f) => { if (ASSET_V.data[f] !== undefined) need(hashOf('js/' + f) === ASSET_V.data[f], 'versi data ' + f + ' tidak cocok dengan isi dist/js/' + f); });
  /* Token Redis TIDAK BOLEH ada di keluaran (dist dipublikasikan). Dicek terhadap nilai env yang dipakai build ini. */
  ['KV_REST_API_READ_ONLY_TOKEN', 'KV_REST_API_TOKEN'].forEach((name) => {
    const t = process.env[name];
    if (!t || t.length < 8) return;
    const stack = [OUT_DIR];
    while (stack.length) {
      const d = stack.pop();
      fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
        const p = path.join(d, e.name);
        if (e.isDirectory()) stack.push(p);
        else if (/\.(html|js|json|css|xml|xsl|txt|webmanifest|svg)$/i.test(e.name) && fs.readFileSync(p, 'utf8').includes(t)) problems.push('KEBOCORAN: nilai ' + name + ' ditemukan di dist' + p.slice(OUT_DIR.length));
      });
    }
  });
  /* robots.txt: /search selalu ditutup + Sitemap ada; blokir bot rendah-nilai HANYA di mode hemat; mesin pencari tidak pernah ikut diblokir. */
  const robotsOut = path.join(OUT_DIR, 'robots.txt');
  if (fs.existsSync(robotsOut)) {
    const rb = fs.readFileSync(robotsOut, 'utf8');
    need(rb.indexOf('Disallow: /search\n') !== -1 && rb.indexOf('Sitemap: ') !== -1, 'robots.txt: Disallow /search / Sitemap hilang');
    LOW_VALUE_BOTS.forEach((b) => need((rb.indexOf('User-agent: ' + b + '\nDisallow: /\n') !== -1) === SAVER, 'robots.txt: blokir ' + b + ' tidak sesuai mode'));
    ['Googlebot', 'Bingbot', 'OAI-SearchBot', 'Applebot', 'DuckDuckBot'].forEach((b) => need(rb.toLowerCase().indexOf('user-agent: ' + b.toLowerCase()) === -1, 'robots.txt: ' + b + ' tidak boleh diblokir'));
  }
  /* sw.js: mode hemat = kill-switch, mode normal = service worker biasa. Tidak boleh tertukar. */
  const swOut = path.join(OUT_DIR, 'sw.js');
  if (fs.existsSync(swOut)) {
    const swTxt = fs.readFileSync(swOut, 'utf8');
    need(SAVER ? swTxt.indexOf('hz-kill-sw') !== -1 && swTxt.indexOf("addEventListener('fetch'") === -1 : swTxt.indexOf('hz-kill-sw') === -1, 'sw.js tidak sesuai mode (' + (SAVER ? 'hemat' : 'normal') + ')');
  }
  ['js/app.js', 'sw.js', 'manifest.webmanifest', 'sitemap_index.xml'].forEach((f) => {
    const p = path.join(OUT_DIR, f);
    need(fs.existsSync(p) && fs.statSync(p).size > 500, 'dist/' + f + ' tidak ada atau terlalu kecil');
  });
  const NO_CSS_OK = { 'offline.html': true }; // halaman offline memang berdiri sendiri
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { walk(f); return; }
    if (!e.name.endsWith('.html')) return;
    const rel = path.relative(OUT_DIR, f).split(path.sep).join('/');
    const html = fs.readFileSync(f, 'utf8');
    need(html.indexOf('</head>') !== -1 && html.indexOf('</body>') !== -1, rel + ': struktur <head>/<body> tidak lengkap');
    if (ASSET_CDN) {
      /* Mode hemat: CSS/JS dari jsDelivr WAJIB membawa fallback ke salinan Vercel dengan ?v= yang cocok hash isi. */
      if (!NO_CSS_OK[rel]) need(html.indexOf('href="' + assetCssUrl() + '"') !== -1 && html.indexOf("this.href='/css/style.css?v=" + ASSET_V.css + "'") !== -1, rel + ': tag CSS jsDelivr + fallback tidak sesuai');
      if (html.indexOf('/js/app.js') !== -1 || html.indexOf(assetJsUrl()) !== -1) need(html.indexOf('src="' + assetJsUrl() + '"') !== -1 && html.indexOf('/js/app.js?v=' + ASSET_V.js + '&quot;') !== -1 && html.indexOf('window.HZ_DV=' + JSON.stringify(ASSET_V.data) + ';') !== -1, rel + ': tag JS jsDelivr + fallback / window.HZ_DV tidak sesuai');
    } else {
      if (!NO_CSS_OK[rel]) need(html.indexOf('href="/css/style.css') !== -1, rel + ': tidak memuat /css/style.css');
      if (!NO_CSS_OK[rel]) need(html.indexOf('href="/css/style.css?v=' + ASSET_V.css + '"') !== -1, rel + ': ?v= css tidak sesuai hash isi');
      if (html.indexOf('/js/app.js') !== -1) need(html.indexOf('src="/js/app.js?v=' + ASSET_V.js + '"') !== -1 && html.indexOf('window.HZ_DV=' + JSON.stringify(ASSET_V.data) + ';') !== -1, rel + ': ?v= app.js / window.HZ_DV tidak sesuai hash isi');
    }
    /* Penanda mode: mode hemat harus memuat window.HZ_SAVER=1 di tiap halaman ber-app.js dan tanpa <link rel=manifest>; mode normal tidak boleh memuat jejak mode hemat. */
    if (SAVER) {
      if (html.indexOf('window.HZ_DV=') !== -1) need(html.indexOf('window.HZ_SAVER=1;') !== -1, rel + ': window.HZ_SAVER=1 tidak ada di mode hemat');
      need(!/<link\b[^>]*rel=["']manifest["']/i.test(html), rel + ': <link rel=manifest> masih ada di mode hemat');
      if (html.indexOf('window.HZ_DV=') !== -1) need(html.indexOf('window.HZ_DC=' + JSON.stringify(assetDataBase()) + ';') !== -1, rel + ': window.HZ_DC (tag data jsDelivr) tidak sesuai di mode hemat');
      const mp = /window\.HZ_POST=(\{[^;]*\});/.exec(html);
      if (mp) { try { const o = JSON.parse(mp[1]); need(Number.isInteger(o.id) && /^[a-zA-Z0-9_-]{1,80}$/.test(o.slug), rel + ': window.HZ_POST tidak valid'); } catch (e) { problems.push(rel + ': window.HZ_POST bukan JSON valid'); } }
    } else {
      need(html.indexOf('HZ_SAVER') === -1 && html.indexOf('HZ_POST') === -1 && html.indexOf('HZ_VIEW_EP') === -1 && html.indexOf('HZ_DC') === -1 && html.indexOf('cdn.jsdelivr.net/gh/' + ASSET_CDN_REPO + '@a') === -1 && html.indexOf('cdn.jsdelivr.net/gh/' + ASSET_CDN_REPO + '@d') === -1, rel + ': ada jejak mode hemat padahal HZ_SAVER tidak aktif');
    }
    /* Snapshot view: halaman dengan kartu/angka view harus sudah berisi angka dan penanda HZ_VB; tanpa snapshot, tidak boleh ada HZ_VB. */
    if (VIEWS.ok && html.indexOf('data-view-id') !== -1) need(html.indexOf('window.HZ_VB=1;') !== -1 && !/data-view-count>&ndash;</.test(html), rel + ': angka view belum dicetak padahal snapshot tersedia');
    if (!VIEWS.ok) need(html.indexOf('HZ_VB') === -1, rel + ': HZ_VB ada padahal snapshot tidak tersedia');
    /* Beranda dan pencarian harus memuat window.HZ_VIEWS yang valid (objek angka bulat >= 0); halaman lain tidak boleh. */
    if (VIEWS.ok && (html.indexOf('id="hz-swiper-latest"') !== -1 || html.indexOf('id="hz-search-heading"') !== -1)) {
      const mv = /window\.HZ_VIEWS=(\{[^;]*\});/.exec(html);
      let okv = false;
      try { const o = mv && JSON.parse(mv[1]); okv = !!o && Object.keys(o).length > 0 && Object.values(o).every((v) => Number.isInteger(v) && v >= 0); } catch (e) { okv = false; }
      need(okv, rel + ': window.HZ_VIEWS tidak ada/tidak valid padahal snapshot tersedia');
    } else need(html.indexOf('HZ_VIEWS') === -1, rel + ': HZ_VIEWS ada di halaman yang tidak seharusnya');
    const ph = html.match(/\{\{[A-Z0-9_]{3,}\}\}/);
    need(!ph, rel + ': placeholder template tersisa ' + (ph ? ph[0] : ''));
    const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
    let m;
    while ((m = re.exec(html))) {
      try { JSON.parse(m[1]); } catch (err) { problems.push(rel + ': JSON-LD tidak valid (' + err.message + ')'); }
    }
  });
  walk(OUT_DIR);
  if (problems.length) {
    console.error('\nPAGAR PENGAMAN BUILD GAGAL (' + problems.length + ' masalah):');
    problems.slice(0, 25).forEach((p) => console.error('  - ' + p));
    if (problems.length > 25) console.error('  ...dan ' + (problems.length - 25) + ' lainnya');
    console.error('Build dihentikan supaya deployment rusak tidak tayang.');
    process.exit(1);
  }
  console.log('Pagar pengaman build: OK (CSS utuh, semua halaman memuat stylesheet, JSON-LD valid).');
}
verifyDist();

console.log('Build selesai. Output di:', OUT_DIR);
