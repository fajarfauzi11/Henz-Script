/* floating-menu.js — Menu melayang (tombol pengaturan di pojok kanan bawah) + Riwayat Script.
   Markup: public/partials/floating-menu.html (disisipkan build.js di semua halaman).
   File ini digabung ke dist/js/app.js oleh build.js (buildAppBundle), jadi tidak ada request JS tambahan.

   Riwayat disimpan di localStorage (key: hz_history_v1), hanya di perangkat/browser ini:
   [{u:'/post/slug', t:'Judul', i:'https://thumb', ts:1700000000000}, ...] — terbaru di urutan pertama.
   - Dicatat otomatis saat halaman post dibuka (post draft/noindex TIDAK dicatat).
   - Membuka ulang script yang sama memindahkannya ke paling atas.
   - Maksimal 30 entri. Entri yang post-nya sudah tidak ada di posts.json dibuang saat modal dibuka.

   Favorit disimpan di localStorage key hz_fav_v1 (format entri sama dengan riwayat, maks 100, terbaru di atas):
   - Tombol hati (#hz-fav-btn) hanya ada di banner halaman post penuh; post draft/noindex tidak bisa difavoritkan.
   - Daftar dibuka lewat baris "Favorit Saya" di menu gear; entri yang post-nya sudah tidak ada di posts.json dibuang.

   Switch Mode Gelap (key hz_theme) juga ditangani di sini; lihat blok "Mode Gelap" di init().

   Log Update: baris di menu gear + modal #hz-fm-log (tab Update | Baru), data dari posts.json; lihat blok "Log Update" di init().
   Penanda "Baru" (titik di ikon gear + pil di baris menu): localStorage hz_log_seen_v1 {si,su,ki,ku} = id/waktu-pembaruan terbaru yang sudah dilihat dan yang diketahui.

   PWA ("Install Aplikasi"): blok "PWA" di bawah mendaftarkan /sw.js dan mengatur atribut <html data-pwa>:
   - "prompt" = Chromium (Chrome/Edge/Samsung Internet) sudah memicu beforeinstallprompt -> tombol memanggil prompt bawaan.
   - "ios"    = iPhone/iPad -> tidak ada prompt bawaan, tombol membuka modal petunjuk (#hz-fm-ios).
   - tidak ada = tidak bisa/tidak perlu (sudah terpasang, mode aplikasi, atau browser tanpa dukungan) -> baris disembunyikan CSS. */
(function(){
  var KEY = 'hz_history_v1';
  var MAX = 30;
  var FKEY = 'hz_fav_v1';
  var FMAX = 100;
  var swHistoryCheck = null; // diisi registerServiceWorker(): dipanggil tiap riwayat/favorit tersimpan (pemicu 4 pendaftaran service worker)

  /* ---------- Storage (semua dibungkus try/catch: mode privat / storage diblokir tidak boleh merusak halaman) ---------- */
  function isValid(e){
    return e && typeof e === 'object' &&
      typeof e.u === 'string' && e.u.indexOf('/post/') === 0 &&
      typeof e.t === 'string' && e.t.length > 0 &&
      typeof e.ts === 'number' && isFinite(e.ts);
  }
  function loadK(key, max){
    try{
      var arr = JSON.parse(localStorage.getItem(key) || '[]');
      if(!Array.isArray(arr)) return [];
      return arr.filter(isValid).slice(0, max);
    }catch(err){ return []; }
  }
  function saveK(key, arr){
    var ok = false;
    try{ localStorage.setItem(key, JSON.stringify(arr)); ok = true; }
    catch(err){ ok = false; }
    if(ok && swHistoryCheck){ try{ swHistoryCheck(); }catch(err){} }
    return ok;
  }
  function load(){ return loadK(KEY, MAX); }
  function save(arr){ return saveK(KEY, arr); }
  function favLoad(){ return loadK(FKEY, FMAX); }
  function favSave(arr){ return saveK(FKEY, arr); }
  function normPath(p){
    return String(p || '').replace(/[?#].*$/, '').replace(/\.html$/i, '').replace(/\/+$/, '');
  }
  function safeThumb(u){
    return (typeof u === 'string' && /^https:\/\//i.test(u)) ? u : '';
  }

  /* ---------- Catat script yang sedang dibuka ---------- */
  function currentEntry(){
    if(!document.body || !document.body.classList.contains('page-post')) return null;
    var robots = document.querySelector('meta[name="robots"]');
    if(robots && /noindex/i.test(robots.getAttribute('content') || '')) return null; // post tidak publik
    var path = normPath(location.pathname);
    if(path.indexOf('/post/') !== 0 || path === '/post') return null;
    var og = document.querySelector('meta[property="og:title"]');
    var title = (og && og.getAttribute('content')) || document.title || '';
    title = title.replace(/\s*[\u2014\-]\s*Henz MLBB\s*$/i, '').replace(/^Script Skin\s+/i, '').trim();
    if(!title) return null;
    var ogImg = document.querySelector('meta[property="og:image"]');
    return { u: path, t: title, i: safeThumb(ogImg && ogImg.getAttribute('content')), ts: Date.now() };
  }
  function record(){
    var entry = currentEntry();
    if(!entry) return;
    var list = load().filter(function(e){ return e.u !== entry.u; });
    list.unshift(entry);
    save(list.slice(0, MAX));
  }

  /* ---------- PWA: service worker + Install Aplikasi ---------- */
  var deferredInstall = null;
  function isStandalone(){
    try{
      return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
    }catch(err){ return false; }
  }
  function isIOS(){
    var ua = navigator.userAgent || '';
    var ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if(!ios) return false;
    return !/FBAN|FBAV|Instagram|Line\/|MicroMessenger/i.test(ua); // browser dalam aplikasi (IG/FB/dll) tidak bisa memasang
  }
  function setPwaState(){
    var el = document.documentElement;
    if(isStandalone()){ el.removeAttribute('data-pwa'); return; }
    if(deferredInstall) el.setAttribute('data-pwa', 'prompt');
    else if(isIOS()) el.setAttribute('data-pwa', 'ios');
    else el.removeAttribute('data-pwa');
  }
  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault(); // prompt bawaan ditahan; dipanggil lewat baris "Install Aplikasi" di menu
    deferredInstall = e;
    setPwaState();
  });
  window.addEventListener('appinstalled', function(){ deferredInstall = null; setPwaState(); });
  try{
    var mq = window.matchMedia('(display-mode: standalone)');
    if(mq.addEventListener) mq.addEventListener('change', setPwaState);
    else if(mq.addListener) mq.addListener(setPwaState);
  }catch(err){}
  setPwaState();

  function registerServiceWorker(){
    if(!('serviceWorker' in navigator)) return;
    var host = location.hostname;
    if(location.protocol !== 'https:' && host !== 'localhost' && host !== '127.0.0.1') return;
    /* MODE HEMAT (window.HZ_SAVER, lihat build.js): service worker dilepas total, tidak ada pendaftaran, tidak ada pemeriksaan sw.js.
       Registrasi lama dilepas dari sisi halaman (langsung, tanpa menunggu pemeriksaan sw.js) dan cache hz-* dihapus. Bila memang ada
       registrasi yang dilepas, tersimpan penanda hz_sw_killed + hz_sw_want: saat mode hemat dimatikan, SW terdaftar lagi otomatis di
       kunjungan berikutnya dan notify.js memulihkan langganan push (lihat maybeRefresh). sw.js versi hemat juga mengirim pesan yang sama. */
    if(window.HZ_SAVER){
      var markKilled = function(){ try{ localStorage.setItem('hz_sw_killed', '1'); localStorage.setItem('hz_sw_want', '1'); }catch(err){} };
      window.hzEnsureSW = function(){ return Promise.resolve(); };
      try{ navigator.serviceWorker.addEventListener('message', function(e){ if(e && e.data && e.data.hzSwKilled) markKilled(); }); }catch(err){}
      var killAll = function(){
        var get = navigator.serviceWorker.getRegistrations ? navigator.serviceWorker.getRegistrations() : Promise.resolve([]);
        get.then(function(regs){
          var had = false;
          regs.forEach(function(r){ if(r && (r.active || r.waiting || r.installing)) had = true; r.unregister().catch(function(){}); });
          if(had) markKilled();
        }).catch(function(){});
        if(window.caches && caches.keys) caches.keys().then(function(ks){ ks.forEach(function(k){ if(k.indexOf('hz-') === 0) caches.delete(k); }); }).catch(function(){});
      };
      if(document.readyState === 'complete') killAll(); else window.addEventListener('load', killAll);
      return;
    }
    /* Service worker TIDAK lagi didaftarkan untuk semua pengunjung di kunjungan pertama. Setiap pendaftaran = request sw.js dan /offline
       ke Vercel, padahal pengunjung yang hanya mampir sebentar tidak memakai manfaatnya (offline, prompt install, notifikasi).
       Pendaftaran dilakukan saat SALAH SATU pemicu terpenuhi:
       1) Tindakan eksplisit: menekan "Aktifkan" di modal notifikasi dan memberi izin (notify.js getToken memanggil window.hzEnsureSW;
          sekadar membuka lonceng TIDAK cukup), atau menekan
          "Install Aplikasi" di iPhone.
       2) Penanda hz_sw_want di localStorage: salah satu pemicu pernah terpenuhi di perangkat ini (berlaku seterusnya).
       3) Aktif di situs >= NEED_ACTIVE detik DAN minimal satu interaksi (klik/ketuk/tekan tombol). "Aktif" = tab terlihat dan ada aktivitas
          (gulir/gerak kursor/sentuh/tombol) dalam IDLE_MS terakhir. Detik aktif dan penanda interaksi dijumlahkan antar-halaman dalam satu tab
          (sessionStorage: hz_sw_a, hz_sw_i).
       4) Favorit >= FAV_MIN atau riwayat script >= HIST_MIN (melihat-lihat sebentar tidak cukup).
       Pengunjung yang SUDAH punya registrasi tidak dilepas dan tidak dibatasi: tetap dirawat seperti sebelumnya (migrasi updateViaCache +
       update paling sering sekali per 24 jam).
       Catatan teknis: Chrome memeriksa sw.js pada SETIAP navigasi ke halaman yang dikontrol SW (balasan 304 pun dihitung request ke Vercel).
       Karena itu SW didaftarkan dengan updateViaCache:'all' dan sw.js diberi Cache-Control max-age pendek di vercel.json, sehingga
       pemeriksaan itu dilayani cache HTTP dan baru ke jaringan setelah max-age habis. */
    var SW_CHK = 'hz_sw_chk', SW_WANT = 'hz_sw_want', SW_DAY = 86400000;
    var NEED_ACTIVE = 60, IDLE_MS = 30000, FAV_MIN = 3, HIST_MIN = 5;
    var A_KEY = 'hz_sw_a', I_KEY = 'hz_sw_i';
    var stamp = function(){ try{ localStorage.setItem(SW_CHK, String(Date.now())); }catch(err){} };
    var reg = function(){ stamp(); return navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'all' }).catch(function(){}); };
    var alive = function(r){ return !!(r && (r.active || r.waiting || r.installing)); };
    var wanted = function(){ try{ return localStorage.getItem(SW_WANT) === '1'; }catch(err){ return false; } };
    var enoughHistory = function(){
      try{ return favLoad().length >= FAV_MIN || load().length >= HIST_MIN; }catch(err){ return false; }
    };
    /* Registrasi sudah ada: pindahkan ke updateViaCache 'all' bila belum, dan update paling sering sekali per 24 jam. */
    function maintain(r){
      if(r.updateViaCache !== 'all') return reg();
      var last = 0;
      try{ last = parseInt(localStorage.getItem(SW_CHK) || '0', 10) || 0; }catch(err){}
      if(Date.now() - last > SW_DAY){ stamp(); r.update().catch(function(){}); }
      return Promise.resolve(r);
    }
    var gated = false;           // true selama menunggu pemicu (belum punya registrasi dan belum "lolos")
    var stopWatch = function(){};
    var ensuring = null;
    /* Pastikan service worker terdaftar (dipakai semua pemicu). Mengembalikan Promise<registrasi | undefined>; bila gagal, boleh dicoba lagi. */
    function ensureSW(){
      if(ensuring) return ensuring;
      try{ localStorage.setItem(SW_WANT, '1'); }catch(err){}
      stopWatch();
      var get = navigator.serviceWorker.getRegistration ? navigator.serviceWorker.getRegistration('/') : Promise.resolve(null);
      ensuring = get.then(function(r){ return alive(r) ? maintain(r) : reg(); }, function(){ return reg(); })
        .then(function(r){ if(!r) ensuring = null; return r; });
      return ensuring;
    }
    window.hzEnsureSW = ensureSW;
    swHistoryCheck = function(){ if(gated && enoughHistory()) ensureSW(); };

    /* Pemicu 3: pantau keaktifan sampai syarat terpenuhi. */
    function watchEngagement(){
      gated = true;
      var active = 0, interacted = false, lastPresence = Date.now(), done = false;
      try{
        active = parseInt(sessionStorage.getItem(A_KEY) || '0', 10) || 0;
        interacted = sessionStorage.getItem(I_KEY) === '1';
      }catch(err){}
      function save(){
        try{ sessionStorage.setItem(A_KEY, String(active)); if(interacted) sessionStorage.setItem(I_KEY, '1'); }catch(err){}
      }
      function check(){ if(!done && active >= NEED_ACTIVE && interacted) ensureSW(); }
      function present(){ lastPresence = Date.now(); }
      function interact(){
        var first = !interacted;
        interacted = true; present();
        if(first){ save(); check(); }
      }
      var timer = setInterval(function(){
        if(done) return;
        if(document.visibilityState === 'hidden') return;      // tab tersembunyi tidak dihitung
        if(Date.now() - lastPresence > IDLE_MS) return;        // diam terlalu lama tidak dihitung
        active++;
        if(active % 5 === 0) save();
        check();
      }, 1000);
      var interactEv = ['pointerdown', 'mousedown', 'touchstart', 'keydown'];
      var presentEv = ['scroll', 'wheel', 'mousemove', 'touchmove'];
      interactEv.forEach(function(n){ window.addEventListener(n, interact, true); });
      presentEv.forEach(function(n){ window.addEventListener(n, present, { capture: true, passive: true }); });
      window.addEventListener('pagehide', save);
      document.addEventListener('visibilitychange', save);
      stopWatch = function(){
        done = true; gated = false; clearInterval(timer);
        interactEv.forEach(function(n){ window.removeEventListener(n, interact, true); });
        presentEv.forEach(function(n){ window.removeEventListener(n, present, true); });
        window.removeEventListener('pagehide', save);
        document.removeEventListener('visibilitychange', save);
        stopWatch = function(){};
      };
    }

    var go = function(){
      var decide = function(r){
        if(alive(r)){ maintain(r); return; }                          // sudah punya SW: perilaku lama
        if(wanted() || enoughHistory()){ ensureSW(); return; }         // pemicu 2 dan 4
        watchEngagement();                                            // pemicu 3 (pemicu 1 lewat window.hzEnsureSW)
      };
      if(!navigator.serviceWorker.getRegistration){ decide(null); return; }
      navigator.serviceWorker.getRegistration('/').then(decide, function(){ decide(null); });
    };
    if(document.readyState === 'complete') go(); else window.addEventListener('load', go);
  }
  registerServiceWorker();

  /* ---------- UI ---------- */
  function pad(n){ return (n < 10 ? '0' : '') + n; }
  function fmtDate(ts){
    var d = new Date(ts);
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ', ' + pad(d.getHours()) + '.' + pad(d.getMinutes());
  }
  var SVG_NS = 'http://www.w3.org/2000/svg';
  function chevron(){
    var s = document.createElementNS(SVG_NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2.4');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('class', 'hz-fm-hist-arrow');
    var p = document.createElementNS(SVG_NS, 'polyline');
    p.setAttribute('points', '9 18 15 12 9 6');
    s.appendChild(p);
    return s;
  }

  function heartIcon(){
    var s = document.createElementNS(SVG_NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2.1');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z');
    s.appendChild(p);
    return s;
  }
  function toast(msg, act, kind){
    if(typeof window.hzShowToast === 'function') window.hzShowToast(msg, act, kind);
  }

  /* Log Update: main.js memanggil window.hzLogSync(list) tiap halaman selesai mengambil posts.json (tanpa request tambahan).
     Bila dipanggil sebelum init() selesai, daftarnya ditahan di logPending lalu diproses saat blok "Log Update" siap. */
  var logSyncFn = null, logPending = null;
  window.hzLogSync = function(list){
    if(!Array.isArray(list)) return;
    if(logSyncFn) logSyncFn(list); else logPending = list;
  };

  function init(){
    record();

    var root = document.getElementById('hz-fm-root');
    if(!root) return;
    var btn = document.getElementById('hz-fm-btn');
    var panel = document.getElementById('hz-fm-panel');
    var openHistBtn = document.getElementById('hz-fm-open-history');
    var overlay = document.getElementById('hz-fm-history');
    var closeBtn = document.getElementById('hz-fm-history-close');
    var listEl = document.getElementById('hz-fm-history-list');
    var foot = document.getElementById('hz-fm-history-foot');
    var clearBtn = document.getElementById('hz-fm-clear-btn');
    var cancelBtn = document.getElementById('hz-fm-cancel-btn');
    var confirmBtn = document.getElementById('hz-fm-confirm-btn');
    if(!btn || !panel || !overlay || !listEl) return;

    var htmlEl = document.documentElement;
    var pruned = false;
    var favOverlay = document.getElementById('hz-fm-fav');
    var favRerender = null, favSync = null, favCloseFn = null; // diisi oleh blok "Favorit" di bawah
    var installBtn = document.getElementById('hz-fm-install');
    var iosOverlay = document.getElementById('hz-fm-ios');
    var iosClose = document.getElementById('hz-fm-ios-close');

    /* --- Mode Gelap ---
       Aktif di halaman bertanda <html data-dark-ready> (disisipkan build.js: injectThemeInit, semua halaman);
       tanpa atribut itu baris switch-nya disembunyikan CSS dan fungsi ini tidak melakukan apa-apa.
       Pilihan disimpan di localStorage key hz_theme ('dark'; terang = key dihapus). Default selalu terang.
       Pemasangan awal data-theme (anti kilatan putih) dilakukan script #hz-theme-init di <head>. */
    var darkBtn = document.getElementById('hz-fm-dark');
    var THEME_KEY = 'hz_theme';
    function themeIsDark(){ return htmlEl.getAttribute('data-theme') === 'dark'; }
    function storedDark(){ try{ return localStorage.getItem(THEME_KEY) === 'dark'; }catch(err){ return false; } }
    function syncThemeColor(dark){
      var m = document.getElementById('hz-theme-color');
      if(dark){
        if(!m){ m = document.createElement('meta'); m.name = 'theme-color'; m.id = 'hz-theme-color'; document.head.appendChild(m); }
        m.setAttribute('content', '#1c1c1f');
      }else if(m && m.parentNode){
        m.parentNode.removeChild(m);
      }
    }
    function applyTheme(dark){
      if(!htmlEl.hasAttribute('data-dark-ready')) return;
      if(dark) htmlEl.setAttribute('data-theme', 'dark'); else htmlEl.removeAttribute('data-theme');
      syncThemeColor(dark);
      if(darkBtn) darkBtn.setAttribute('aria-checked', dark ? 'true' : 'false');
    }
    if(darkBtn){
      darkBtn.setAttribute('aria-checked', themeIsDark() ? 'true' : 'false');
      darkBtn.addEventListener('click', function(){
        var next = !themeIsDark();
        applyTheme(next);
        try{
          if(next) localStorage.setItem(THEME_KEY, 'dark'); else localStorage.removeItem(THEME_KEY);
        }catch(err){}
      });
    }
    /* Tab/halaman lain mengubah tema: ikut menyesuaikan */
    window.addEventListener('storage', function(e){
      if(e.key === THEME_KEY || e.key === null) applyTheme(storedDark());
    });
    window.addEventListener('pageshow', function(e){
      if(e.persisted) applyTheme(storedDark());
    });

    /* --- Panel --- */
    function panelOpen(){ return root.classList.contains('open'); }
    function openPanel(){
      var tt = document.getElementById('hz-toast'); // toast tidak boleh menutupi isi panel
      if(tt) tt.classList.remove('show');
      root.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
      btn.setAttribute('aria-label', 'Tutup menu pengaturan');
    }
    function closePanel(){
      root.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', 'Buka menu pengaturan');
    }
    btn.addEventListener('click', function(){ panelOpen() ? closePanel() : openPanel(); });
    document.addEventListener('click', function(e){
      if(panelOpen() && !root.contains(e.target)) closePanel();
    });

    /* --- Riwayat: render --- */
    function render(){
      var items = load();
      while(listEl.firstChild) listEl.removeChild(listEl.firstChild);
      if(!items.length){
        var empty = document.createElement('div');
        empty.className = 'hz-fm-empty';
        var t1 = document.createElement('strong');
        t1.textContent = 'Belum ada riwayat';
        var t2 = document.createElement('span');
        t2.textContent = 'Script yang kamu buka akan muncul di sini.';
        empty.appendChild(t1);
        empty.appendChild(t2);
        listEl.appendChild(empty);
        foot.classList.add('is-empty');
        return;
      }
      foot.classList.remove('is-empty');
      items.forEach(function(it){
        var a = document.createElement('a');
        a.className = 'hz-fm-hist-item';
        a.href = it.u;
        var th = document.createElement('span');
        th.className = 'hz-fm-hist-thumb';
        var src = safeThumb(it.i);
        if(src){
          var img = document.createElement('img');
          img.alt = '';
          img.loading = 'lazy';
          img.decoding = 'async';
          img.src = src;
          img.addEventListener('error', function(){ img.style.display = 'none'; });
          th.appendChild(img);
        }
        var body = document.createElement('span');
        body.className = 'hz-fm-hist-body';
        var name = document.createElement('strong');
        name.textContent = it.t;
        var when = document.createElement('span');
        when.textContent = 'Dibuka: ' + fmtDate(it.ts);
        body.appendChild(name);
        body.appendChild(when);
        a.appendChild(th);
        a.appendChild(body);
        a.appendChild(chevron());
        listEl.appendChild(a);
      });
    }

    /* Cocokkan dengan posts.json sekali per halaman: buang entri yang post-nya sudah dihapus,
       dan segarkan judul/thumbnail kalau berubah. Kalau fetch gagal, riwayat dibiarkan apa adanya. */
    function pruneAgainstIndex(){
      if(window.HZ_SAVER && !window.HZ_DC) return; // mode hemat TANPA data jsDelivr: tanpa fetch posts.json (entri yatim dibersihkan lagi nanti)
      if(pruned) return;
      pruned = true;
      (window.hzFetchData ? window.hzFetchData('posts.json') : fetch('/js/posts.json?t=' + Date.now()))
        .then(function(r){ if(!r.ok) throw new Error('posts.json'); return r.json(); })
        .then(function(posts){
          if(!Array.isArray(posts)) return;
          var byUrl = {};
          posts.forEach(function(p){ if(p && p.url) byUrl[normPath(p.url)] = p; });
          function syncList(ld, sv, again){
            var before = ld();
            var after = [];
            before.forEach(function(e){
              var p = byUrl[e.u];
              if(!p) return;
              if(p.title) e.t = String(p.title);
              var th = safeThumb(p.thumb);
              if(th) e.i = th;
              after.push(e);
            });
            if(JSON.stringify(before) !== JSON.stringify(after)){
              sv(after);
              again();
            }
          }
          syncList(load, save, function(){ if(overlay.classList.contains('open')) render(); });
          syncList(favLoad, favSave, function(){
            if(favSync) favSync();
            if(favOverlay && favOverlay.classList.contains('open') && favRerender) favRerender();
          });
        })
        .catch(function(){});
    }

    /* --- Riwayat: buka/tutup modal --- */
    var lastFocus = null;
    function resetConfirm(){ foot.classList.remove('confirming'); }
    function openHistory(){
      closePanel();
      lastFocus = btn; // panel menutup saat modal terbuka, jadi fokus dikembalikan ke tombol gear (yang tetap terlihat)
      resetConfirm();
      render();
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden', 'false');
      htmlEl.classList.add('hz-fm-lock');
      setTimeout(function(){ closeBtn.focus(); }, 30);
      pruneAgainstIndex();
    }
    function closeHistory(){
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
      htmlEl.classList.remove('hz-fm-lock');
      resetConfirm();
      if(lastFocus && lastFocus.focus) lastFocus.focus();
    }
    openHistBtn.addEventListener('click', openHistory);
    closeBtn.addEventListener('click', closeHistory);
    overlay.addEventListener('click', function(e){ if(e.target === overlay) closeHistory(); });

    /* --- Favorit ---
       Tombol hati #hz-fav-btn (banner post) + baris "Favorit Saya" + modal #hz-fm-fav. Semua storage dibungkus try/catch. */
    var openFavBtn = document.getElementById('hz-fm-open-fav');
    var favCount = document.getElementById('hz-fm-fav-count');
    var favList = document.getElementById('hz-fm-fav-list');
    var favFoot = document.getElementById('hz-fm-fav-foot');
    var favTotal = document.getElementById('hz-fm-fav-total');
    var favClose = document.getElementById('hz-fm-fav-close');
    var favClear = document.getElementById('hz-fm-fav-clear');
    var favCancel = document.getElementById('hz-fm-fav-cancel');
    var favConfirm = document.getElementById('hz-fm-fav-confirm');
    var favBtn = document.getElementById('hz-fav-btn');
    var favPage = currentEntry(); // entri post yang sedang dibuka; null = bukan post publik

    function favIndex(u){
      var a = favLoad();
      for(var i = 0; i < a.length; i++){ if(a[i].u === u) return i; }
      return -1;
    }
    function syncFav(){
      var n = favLoad().length;
      if(favCount){ favCount.textContent = String(n); favCount.hidden = (n === 0); }
      if(favTotal) favTotal.textContent = n + ' script tersimpan';
      if(favBtn){
        if(!favPage){ favBtn.hidden = true; }
        else{
          var on = favIndex(favPage.u) !== -1;
          favBtn.hidden = false;
          favBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
          favBtn.setAttribute('aria-label', on ? 'Hapus dari Favorit' : 'Simpan ke Favorit');
        }
      }
    }
    favSync = syncFav;

    if(favOverlay && favList && favFoot && favClose && openFavBtn){
      function renderFav(){
        var items = favLoad();
        while(favList.firstChild) favList.removeChild(favList.firstChild);
        if(!items.length){
          var empty = document.createElement('div');
          empty.className = 'hz-fm-empty';
          var t1 = document.createElement('strong');
          t1.textContent = 'Belum ada favorit';
          var t2 = document.createElement('span');
          t2.textContent = 'Ketuk ikon hati di pojok banner script untuk menyimpannya di browser ini.';
          empty.appendChild(t1);
          empty.appendChild(t2);
          favList.appendChild(empty);
          favFoot.classList.add('is-empty');
          syncFav();
          return;
        }
        favFoot.classList.remove('is-empty');
        items.forEach(function(it){
          var row = document.createElement('div');
          row.className = 'hz-fm-hist-item hz-fm-fav-item';
          var a = document.createElement('a');
          a.className = 'hz-fm-fav-link';
          a.href = it.u;
          var th = document.createElement('span');
          th.className = 'hz-fm-hist-thumb';
          var src = safeThumb(it.i);
          if(src){
            var img = document.createElement('img');
            img.alt = '';
            img.loading = 'lazy';
            img.decoding = 'async';
            img.src = src;
            img.addEventListener('error', function(){ img.style.display = 'none'; });
            th.appendChild(img);
          }
          var body = document.createElement('span');
          body.className = 'hz-fm-hist-body';
          var name = document.createElement('strong');
          name.textContent = it.t;
          var when = document.createElement('span');
          when.textContent = 'Disimpan: ' + fmtDate(it.ts);
          body.appendChild(name);
          body.appendChild(when);
          a.appendChild(th);
          a.appendChild(body);
          var rm = document.createElement('button');
          rm.type = 'button';
          rm.className = 'hz-fm-fav-rm';
          rm.setAttribute('aria-label', 'Hapus dari favorit: ' + it.t);
          rm.appendChild(heartIcon());
          rm.addEventListener('click', function(){
            favSave(favLoad().filter(function(e){ return e.u !== it.u; }));
            renderFav();
            var next = favList.querySelector('.hz-fm-fav-rm');
            (next || favClose).focus();
          });
          row.appendChild(a);
          row.appendChild(rm);
          favList.appendChild(row);
        });
        syncFav();
      }
      favRerender = renderFav;
      function openFav(from){
        closePanel();
        lastFocus = from || btn;
        favFoot.classList.remove('confirming');
        renderFav();
        favOverlay.classList.add('open');
        favOverlay.setAttribute('aria-hidden', 'false');
        htmlEl.classList.add('hz-fm-lock');
        setTimeout(function(){ favClose.focus(); }, 30);
        pruneAgainstIndex();
      }
      function closeFav(){
        favOverlay.classList.remove('open');
        favOverlay.setAttribute('aria-hidden', 'true');
        htmlEl.classList.remove('hz-fm-lock');
        favFoot.classList.remove('confirming');
        if(lastFocus && lastFocus.focus && !lastFocus.hidden) lastFocus.focus();
      }
      favCloseFn = closeFav;
      openFavBtn.addEventListener('click', function(){ openFav(btn); });
      favClose.addEventListener('click', closeFav);
      favOverlay.addEventListener('click', function(e){ if(e.target === favOverlay) closeFav(); });
      if(favClear) favClear.addEventListener('click', function(){
        favFoot.classList.add('confirming');
        setTimeout(function(){ if(favCancel) favCancel.focus(); }, 0);
      });
      if(favCancel) favCancel.addEventListener('click', function(){
        favFoot.classList.remove('confirming');
        if(favClear) favClear.focus();
      });
      if(favConfirm) favConfirm.addEventListener('click', function(){
        try{ localStorage.removeItem(FKEY); }catch(err){}
        favFoot.classList.remove('confirming');
        renderFav();
        favClose.focus();
      });
      if(favBtn) favBtn.addEventListener('click', function(){
        if(!favPage) return;
        var arr = favLoad();
        var idx = -1;
        for(var i = 0; i < arr.length; i++){ if(arr[i].u === favPage.u){ idx = i; break; } }
        if(idx !== -1){
          arr.splice(idx, 1);
          if(favSave(arr)) toast('Dihapus dari Favorit', null, 'off'); else toast('Gagal menyimpan favorit');
        }else{
          var entry = currentEntry() || favPage;
          entry.ts = Date.now();
          arr.unshift(entry);
          if(favSave(arr.slice(0, FMAX))) toast('Ditambahkan ke Favorit', { label: 'Lihat', fn: function(){ openFav(favBtn); } }, 'on');
          else toast('Gagal menyimpan favorit');
        }
        syncFav();
      });
    }
    window.addEventListener('storage', function(e){
      if(e.key === FKEY || e.key === null){
        syncFav();
        if(favOverlay && favOverlay.classList.contains('open') && favRerender) favRerender();
      }
    });
    window.addEventListener('pageshow', function(e){ if(e.persisted) syncFav(); });
    syncFav();

    /* --- Install Aplikasi --- */
    function iosOpen(){ return !!(iosOverlay && iosOverlay.classList.contains('open')); }
    function openIos(){
      if(!iosOverlay) return;
      closePanel();
      lastFocus = btn;
      iosOverlay.classList.add('open');
      iosOverlay.setAttribute('aria-hidden', 'false');
      htmlEl.classList.add('hz-fm-lock');
      setTimeout(function(){ if(iosClose) iosClose.focus(); }, 30);
    }
    function closeIos(){
      if(!iosOverlay) return;
      iosOverlay.classList.remove('open');
      iosOverlay.setAttribute('aria-hidden', 'true');
      htmlEl.classList.remove('hz-fm-lock');
      if(lastFocus && lastFocus.focus) lastFocus.focus();
    }
    if(installBtn){
      installBtn.addEventListener('click', function(){
        if(deferredInstall){
          var ev = deferredInstall;
          deferredInstall = null; // event hanya bisa dipakai sekali
          closePanel();
          setPwaState();
          try{ ev.prompt(); }catch(err){}
        }else if(isIOS()){
          if(window.hzEnsureSW) window.hzEnsureSW(); // tindakan eksplisit: pendaftaran service worker (pemicu 1)
          openIos();
        }
      });
    }
    if(iosClose) iosClose.addEventListener('click', closeIos);
    if(iosOverlay) iosOverlay.addEventListener('click', function(e){ if(e.target === iosOverlay) closeIos(); });

    /* --- Hapus riwayat (dengan konfirmasi) --- */
    clearBtn.addEventListener('click', function(){
      foot.classList.add('confirming');
      setTimeout(function(){ cancelBtn.focus(); }, 0);
    });
    cancelBtn.addEventListener('click', function(){
      resetConfirm();
      clearBtn.focus();
    });
    confirmBtn.addEventListener('click', function(){
      try{ localStorage.removeItem(KEY); }catch(err){}
      resetConfirm();
      render();
      closeBtn.focus();
    });

    /* --- Log Update ---
       Baris "Log Update" di menu gear + modal #hz-fm-log dengan 2 tab:
       - Update: script lama yang diperbarui, dari field `upd` di posts.json ({t:<epoch ms>, n:<catatan>}); terbaru dulu, maks LOG_MAX.
       - Baru: LOG_MAX id terbesar di posts.json (id naik terus, jadi tidak bergantung format tanggal teks).
       Data = posts.json yang SAMA dengan halaman lain (window.hzFetchData: URL ber-?v=hash dan cache panjang; jsDelivr di mode hemat).
       Diambil LAZY hanya saat modal dibuka, disimpan di memori selama halaman terbuka (gagal = dicoba lagi di pembukaan berikutnya).
       Tidak ada localStorage dan tidak ada request lain. Semua teks dari data dipasang lewat textContent (bukan innerHTML). */
    var logOverlay = document.getElementById('hz-fm-log');
    var logCloseFn = null;
    var openLogBtn = document.getElementById('hz-fm-open-log');
    if(logOverlay && openLogBtn){
      (function(){
        var LOG_MAX = 10;
        var NOTE_MAX = 120;
        var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        var SUBS = {
          upd: 'Script lama yang baru diperbarui oleh Henz. Ketuk untuk membuka script-nya.',
          'new': '10 script terbaru yang baru dirilis. Ketuk untuk membuka script-nya.'
        };
        var closeB = document.getElementById('hz-fm-log-close');
        var tabs = { upd: document.getElementById('hz-fm-log-tab-upd'), 'new': document.getElementById('hz-fm-log-tab-new') };
        var panes = { upd: document.getElementById('hz-fm-log-pane-upd'), 'new': document.getElementById('hz-fm-log-pane-new') };
        var subEl = document.getElementById('hz-fm-log-sub');
        var footEl = document.getElementById('hz-fm-log-foot');
        if(!closeB || !tabs.upd || !tabs['new'] || !panes.upd || !panes['new'] || !subEl || !footEl) return;

        var logPosts = null;   // isi posts.json (array) setelah berhasil diambil
        var loading = false;
        var tab = 'upd';
        var picked = false;    // true = pengunjung sudah memilih tab sendiri (jangan dipindah otomatis)
        var counts = { upd: 0, 'new': 0 };

        /* Penanda "ada yang baru": localStorage hz_log_seen_v1 = {si,su: id & waktu-pembaruan terbaru yang SUDAH dilihat (modal dibuka);
           ki,ku: yang terbaru diketahui}. Pengunjung baru: posisi awal dicatat diam-diam (tanpa titik). Titik = ki>si atau ku>su.
           Halaman yang tidak memuat posts.json tetap bisa menampilkan titik dari catatan ini. Storage dibungkus try/catch. */
        var SEEN_KEY = 'hz_log_seen_v1';
        var dotEl = document.getElementById('hz-fm-dot');
        var newEl = document.getElementById('hz-fm-log-new');
        function readSeen(){
          try{
            var o = JSON.parse(localStorage.getItem(SEEN_KEY) || 'null');
            if(o && typeof o === 'object' && isFinite(o.si) && isFinite(o.su) && isFinite(o.ki) && isFinite(o.ku)) return o;
          }catch(e){}
          return null;
        }
        function writeSeen(o){ try{ localStorage.setItem(SEEN_KEY, JSON.stringify(o)); return true; }catch(e){ return false; } }
        function setDot(on){ if(dotEl) dotEl.hidden = !on; if(newEl) newEl.hidden = !on; }
        function dotFromRec(){ var r = readSeen(); setDot(!!(r && (r.ki > r.si || r.ku > r.su))); }
        function maxOf(list){
          var mi = 0, mu = 0;
          list.forEach(function(p){
            if(!validPost(p)) return;
            if(p.id > mi) mi = p.id;
            if(p.upd && typeof p.upd.t === 'number' && isFinite(p.upd.t) && p.upd.t > mu) mu = p.upd.t;
          });
          return { i: mi, u: mu };
        }
        function syncDot(list){
          var m = maxOf(list);
          if(!m.i) return; // daftar kosong/rusak: jangan jadikan acuan
          var r = readSeen();
          if(!r){ writeSeen({ si: m.i, su: m.u, ki: m.i, ku: m.u }); setDot(false); return; }
          var ki = Math.max(r.ki, m.i), ku = Math.max(r.ku, m.u);
          if(ki !== r.ki || ku !== r.ku){ r.ki = ki; r.ku = ku; writeSeen(r); }
          setDot(ki > r.si || ku > r.su);
        }
        function markSeen(list){
          var m = maxOf(list), r = readSeen() || { si: 0, su: 0, ki: 0, ku: 0 };
          var i = Math.max(r.ki, m.i), u = Math.max(r.ku, m.u);
          writeSeen({ si: i, su: u, ki: i, ku: u });
          setDot(false);
        }

        function safeHref(u){
          return (typeof u === 'string' && u.charAt(0) === '/' && u.charAt(1) !== '/') ? u : '';
        }
        function dayDiff(ts){
          var a = new Date(), b = new Date(ts);
          var d0 = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
          var d1 = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
          return Math.round((d0 - d1) / 86400000);
        }
        function relTime(ts){
          var d = dayDiff(ts);
          if(d <= 0) return 'Hari ini';
          if(d === 1) return 'Kemarin';
          if(d < 7) return d + ' hari lalu';
          var b = new Date(ts);
          return b.getDate() + ' ' + MONTHS[b.getMonth()] + ' ' + b.getFullYear();
        }
        function clip(t, max){
          t = String(t).replace(/\s+/g, ' ').trim();
          return t.length > max ? t.slice(0, max - 1).replace(/\s+$/, '') + '\u2026' : t;
        }
        function validPost(p){
          return !!(p && typeof p.id === 'number' && p.title && safeHref(p.url));
        }
        function getUpdates(list){
          return list.filter(function(p){
            return validPost(p) && p.upd && typeof p.upd.t === 'number' && isFinite(p.upd.t) && p.upd.t > 0;
          }).sort(function(a, b){ return b.upd.t - a.upd.t; }).slice(0, LOG_MAX);
        }
        function getNew(list){
          return list.filter(validPost).sort(function(a, b){ return b.id - a.id; }).slice(0, LOG_MAX);
        }
        function el(tag, cls, text){
          var n = document.createElement(tag);
          if(cls) n.className = cls;
          if(text) n.textContent = text;
          return n;
        }
        function mkItem(p, kind){
          var a = el('a', 'hz-fm-hist-item');
          a.href = safeHref(p.url);
          var th = el('span', 'hz-fm-hist-thumb');
          var src = safeThumb(p.thumb);
          if(src){
            var img = document.createElement('img');
            img.alt = '';
            img.loading = 'lazy';
            img.decoding = 'async';
            img.src = src;
            img.addEventListener('error', function(){ img.style.display = 'none'; });
            th.appendChild(img);
          }
          var body = el('span', 'hz-fm-hist-body');
          body.appendChild(el('strong', '', String(p.title)));
          var meta = el('span', 'hz-lg-meta');
          if(kind === 'upd'){
            var note = typeof p.upd.n === 'string' ? clip(p.upd.n, NOTE_MAX) : '';
            if(note) body.appendChild(el('span', 'hz-lg-note', note));
            meta.appendChild(el('span', 'hz-lg-chip hz-lg-chip--upd', 'Diperbarui'));
            meta.appendChild(el('span', '', relTime(p.upd.t)));
          } else {
            if(p.cat) body.appendChild(el('span', 'hz-lg-note', 'Kategori ' + String(p.cat)));
            meta.appendChild(el('span', 'hz-lg-chip hz-lg-chip--new', 'Baru'));
            if(p.date) meta.appendChild(el('span', '', String(p.date)));
          }
          body.appendChild(meta);
          a.appendChild(th);
          a.appendChild(body);
          a.appendChild(chevron());
          return a;
        }
        function clear(node){ while(node.firstChild) node.removeChild(node.firstChild); }
        function emptyBlock(node, title, text){
          clear(node);
          var e = el('div', 'hz-fm-empty');
          e.appendChild(el('strong', '', title));
          if(text) e.appendChild(el('span', '', text));
          node.appendChild(e);
        }
        function fillPane(kind, items){
          var node = panes[kind];
          clear(node);
          counts[kind] = items.length;
          if(!items.length){
            if(kind === 'upd') emptyBlock(node, 'Belum ada pembaruan', 'Pembaruan script akan muncul di sini.');
            else emptyBlock(node, 'Belum ada script baru', 'Script yang baru dirilis akan muncul di sini.');
            return;
          }
          items.forEach(function(p){ node.appendChild(mkItem(p, kind)); });
        }
        function syncChrome(){
          subEl.textContent = SUBS[tab];
          var n = counts[tab];
          if(logPosts && n > 0){
            footEl.textContent = tab === 'upd' ? 'Menampilkan ' + n + ' pembaruan terbaru.' : 'Menampilkan ' + n + ' script terbaru.';
            footEl.hidden = false;
          } else {
            footEl.hidden = true;
          }
        }
        function setTab(name, focusTab){
          tab = name === 'new' ? 'new' : 'upd';
          ['upd', 'new'].forEach(function(k){
            var on = k === tab;
            tabs[k].setAttribute('aria-selected', on ? 'true' : 'false');
            tabs[k].tabIndex = on ? 0 : -1;
            panes[k].hidden = !on;
          });
          panes[tab].scrollTop = 0;
          syncChrome();
          if(focusTab) tabs[tab].focus();
        }
        function renderAll(){
          var upd = getUpdates(logPosts), nw = getNew(logPosts);
          fillPane('upd', upd);
          fillPane('new', nw);
          if(!picked && !upd.length && nw.length) tab = 'new'; // belum ada pembaruan: buka langsung tab Baru
          setTab(tab, false);
          if(logOverlay.classList.contains('open')) markSeen(logPosts); // sudah dilihat: titik "Baru" padam
        }
        function fetchPosts(){
          return (window.hzFetchData ? window.hzFetchData('posts.json') : fetch('/js/posts.json?t=' + Date.now()))
            .then(function(r){ if(!r.ok) throw new Error('posts'); return r.json(); })
            .then(function(d){ if(!Array.isArray(d)) throw new Error('format'); return d; });
        }
        function load(){
          if(logPosts){ renderAll(); return; }
          if(loading) return;
          loading = true;
          counts.upd = 0; counts['new'] = 0;
          emptyBlock(panes.upd, 'Memuat\u2026', '');
          emptyBlock(panes['new'], 'Memuat\u2026', '');
          setTab(tab, false);
          fetchPosts().then(function(list){
            logPosts = list;
            loading = false;
            renderAll();
          }, function(){
            loading = false;
            counts.upd = 0; counts['new'] = 0;
            emptyBlock(panes.upd, 'Gagal memuat data', 'Periksa koneksimu lalu buka lagi menu ini.');
            emptyBlock(panes['new'], 'Gagal memuat data', 'Periksa koneksimu lalu buka lagi menu ini.');
            syncChrome();
          });
        }
        function openLog(){
          closePanel();
          lastFocus = btn; // panel menutup saat modal terbuka, jadi fokus dikembalikan ke tombol gear
          picked = false;
          tab = 'upd';
          logOverlay.classList.add('open');
          logOverlay.setAttribute('aria-hidden', 'false');
          htmlEl.classList.add('hz-fm-lock');
          load();
          setTimeout(function(){ closeB.focus(); }, 30);
        }
        function closeLog(){
          logOverlay.classList.remove('open');
          logOverlay.setAttribute('aria-hidden', 'true');
          htmlEl.classList.remove('hz-fm-lock');
          if(lastFocus && lastFocus.focus) lastFocus.focus();
        }
        logCloseFn = closeLog;
        openLogBtn.addEventListener('click', openLog);
        closeB.addEventListener('click', closeLog);
        logOverlay.addEventListener('click', function(e){ if(e.target === logOverlay) closeLog(); });
        ['upd', 'new'].forEach(function(k){
          tabs[k].addEventListener('click', function(){ picked = true; setTab(k, false); });
          tabs[k].addEventListener('keydown', function(e){
            var key = e.key || '';
            if(key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Left' || key === 'Right'){
              e.preventDefault();
              picked = true;
              setTab(k === 'upd' ? 'new' : 'upd', true);
            }
          });
        });

        logSyncFn = function(list){
          syncDot(list);
          if(!logPosts) logPosts = list.slice(); // data modal ikut dari halaman (tanpa mengambil lagi)
        };
        if(logPending){ var lp = logPending; logPending = null; logSyncFn(lp); } else dotFromRec();
        window.addEventListener('storage', function(e){ if(e.key === SEEN_KEY) dotFromRec(); });
        window.addEventListener('pageshow', function(e){ if(e.persisted) dotFromRec(); });
      })();
    }

    /* --- Keyboard: ESC menutup, Tab dikurung di dalam modal --- */
    document.addEventListener('keydown', function(e){
      var key = e.key || '';
      if(key === 'Escape' || key === 'Esc'){
        if(overlay.classList.contains('open')){ closeHistory(); }
        else if(favOverlay && favOverlay.classList.contains('open') && favCloseFn){ favCloseFn(); }
        else if(logOverlay && logOverlay.classList.contains('open') && logCloseFn){ logCloseFn(); }
        else if(iosOpen()){ closeIos(); }
        else if(panelOpen()){ closePanel(); btn.focus(); }
        return;
      }
      var trap = overlay.classList.contains('open') ? overlay : ((favOverlay && favOverlay.classList.contains('open')) ? favOverlay : ((logOverlay && logOverlay.classList.contains('open')) ? logOverlay : (iosOpen() ? iosOverlay : null)));
      if(key === 'Tab' && trap){
        var f = trap.querySelectorAll('a[href], button');
        var vis = [];
        for(var i = 0; i < f.length; i++){
          if(f[i].offsetParent !== null) vis.push(f[i]);
        }
        if(!vis.length) return;
        var first = vis[0], last = vis[vis.length - 1];
        if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
        else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
        else if(!trap.contains(document.activeElement)){ e.preventDefault(); first.focus(); }
      }
    });

    /* Halaman dipulihkan dari bfcache (tombol Back): catat ulang supaya waktu "Dibuka" ikut diperbarui */
    window.addEventListener('pageshow', function(e){ if(e.persisted){ record(); setPwaState(); } });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
