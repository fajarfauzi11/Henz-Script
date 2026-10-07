/* floating-menu.js — Menu melayang (tombol pengaturan di pojok kanan bawah) + Riwayat Script.
   Markup: public/partials/floating-menu.html (disisipkan build.js di semua halaman).
   File ini digabung ke dist/js/app.js oleh build.js (buildAppBundle), jadi tidak ada request JS tambahan.

   Riwayat disimpan di localStorage (key: hz_history_v1), hanya di perangkat/browser ini:
   [{u:'/post/slug', t:'Judul', i:'https://thumb', ts:1700000000000}, ...] — terbaru di urutan pertama.
   - Dicatat otomatis saat halaman post dibuka (post draft/noindex TIDAK dicatat).
   - Membuka ulang script yang sama memindahkannya ke paling atas.
<<<<<<< Updated upstream
   - Maksimal 30 entri. Entri yang post-nya sudah tidak ada di posts.json dibuang saat modal dibuka. */
=======
   - Maksimal 30 entri. Entri yang post-nya sudah tidak ada di posts.json dibuang saat modal dibuka.

   Switch Mode Gelap (key hz_theme) juga ditangani di sini; lihat blok "Mode Gelap" di init(). */
>>>>>>> Stashed changes
(function(){
  var KEY = 'hz_history_v1';
  var MAX = 30;

  /* ---------- Storage (semua dibungkus try/catch: mode privat / storage diblokir tidak boleh merusak halaman) ---------- */
  function isValid(e){
    return e && typeof e === 'object' &&
      typeof e.u === 'string' && e.u.indexOf('/post/') === 0 &&
      typeof e.t === 'string' && e.t.length > 0 &&
      typeof e.ts === 'number' && isFinite(e.ts);
  }
  function load(){
    try{
      var arr = JSON.parse(localStorage.getItem(KEY) || '[]');
      if(!Array.isArray(arr)) return [];
      return arr.filter(isValid).slice(0, MAX);
    }catch(err){ return []; }
  }
  function save(arr){
    try{ localStorage.setItem(KEY, JSON.stringify(arr)); return true; }
    catch(err){ return false; }
  }
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

<<<<<<< Updated upstream
=======
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

>>>>>>> Stashed changes
    /* --- Panel --- */
    function panelOpen(){ return root.classList.contains('open'); }
    function openPanel(){
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
          var before = load();
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
            save(after);
            if(overlay.classList.contains('open')) render();
          }
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
        else if(panelOpen()){ closePanel(); btn.focus(); }
        return;
      }
      if(key === 'Tab' && overlay.classList.contains('open')){
        var f = overlay.querySelectorAll('a[href], button');
        var vis = [];
        for(var i = 0; i < f.length; i++){
          if(f[i].offsetParent !== null) vis.push(f[i]);
        }
        if(!vis.length) return;
        var first = vis[0], last = vis[vis.length - 1];
        if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
        else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
        else if(!overlay.contains(document.activeElement)){ e.preventDefault(); first.focus(); }
      }
    });

    /* Halaman dipulihkan dari bfcache (tombol Back): catat ulang supaya waktu "Dibuka" ikut diperbarui */
    window.addEventListener('pageshow', function(e){ if(e.persisted) record(); });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
