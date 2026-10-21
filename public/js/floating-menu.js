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

   PWA ("Install Aplikasi"): blok "PWA" di bawah mendaftarkan /sw.js dan mengatur atribut <html data-pwa>:
   - "prompt" = Chromium (Chrome/Edge/Samsung Internet) sudah memicu beforeinstallprompt -> tombol memanggil prompt bawaan.
   - "ios"    = iPhone/iPad -> tidak ada prompt bawaan, tombol membuka modal petunjuk (#hz-fm-ios).
   - tidak ada = tidak bisa/tidak perlu (sudah terpasang, mode aplikasi, atau browser tanpa dukungan) -> baris disembunyikan CSS. */
(function(){
  var KEY = 'hz_history_v1';
  var MAX = 30;
  var FKEY = 'hz_fav_v1';
  var FMAX = 100;

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
    try{ localStorage.setItem(key, JSON.stringify(arr)); return true; }
    catch(err){ return false; }
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
    var go = function(){ navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function(){}); };
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
      if(pruned) return;
      pruned = true;
      fetch('/js/posts.json')
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

    /* --- Keyboard: ESC menutup, Tab dikurung di dalam modal --- */
    document.addEventListener('keydown', function(e){
      var key = e.key || '';
      if(key === 'Escape' || key === 'Esc'){
        if(overlay.classList.contains('open')){ closeHistory(); }
        else if(favOverlay && favOverlay.classList.contains('open') && favCloseFn){ favCloseFn(); }
        else if(iosOpen()){ closeIos(); }
        else if(panelOpen()){ closePanel(); btn.focus(); }
        return;
      }
      var trap = overlay.classList.contains('open') ? overlay : ((favOverlay && favOverlay.classList.contains('open')) ? favOverlay : (iosOpen() ? iosOverlay : null));
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
