/* notify.js — Notifikasi script baru (Firebase Cloud Messaging, paket Spark) + popup lonceng 2 tab.
   Markup popup: public/partials/floating-menu.html (blok #hz-nt, disisipkan build.js di semua halaman).
   Tombol lonceng: public/partials/header.html (class .hz-nt-bell, 4 salinan: desktop & mobile di tiap versi header).
   File ini digabung ke dist/js/app.js oleh build.js (buildAppBundle), jadi tidak ada request JS tambahan.

   ALUR
   - Klik lonceng: sudah aktif -> langsung Tab 2 (Riwayat); belum aktif -> Tab 1 (ajakan + tutorial).
   - "Aktifkan": minta izin browser (harus dari klik pengguna) -> ambil token FCM -> kirim ke /api/push-subscribe
     (server mendaftarkan token ke topic FCM "all"). SDK Firebase dimuat LAZY dari gstatic, hanya saat dibutuhkan.
   - Riwayat (opsi A, daftar global): semua post di /js/posts.json yang id-nya LEBIH BARU dari id terbaru saat
     pengguna mengaktifkan (rec.since). Tidak ada penyimpanan di server dan tidak ada request tambahan.
   - Titik merah di lonceng = ada post dengan id > rec.seen (terakhir dilihat di Tab 2). Dihitung dari data posts.json
     yang SUDAH diambil main.js (hook window.hzNotifySync), jadi tidak menambah request.

   STORAGE (localStorage, key hz_notif_v1, hanya di browser ini):
   {since:<id post terbaru saat aktif>, seen:<id terakhir dilihat>, max:<id terbaru yang pernah diketahui>, chk:<ms refresh token terakhir>}

   Kode sengaja ES5 (var/function, tanpa async/await) seperti file lain, dan TIDAK memakai sintaks import() langsung:
   browser lama akan gagal mem-parse seluruh app.js. Pemuatan modul lewat new Function() di dalam try/catch. */
(function(){
  var FB_VER = '12.13.0';
  var FB_CONFIG = {
    apiKey: 'AIzaSyAOxg3WcVAmsXlhmFmkZ0SNyWdqU9Cnam4',
    authDomain: 'henz-script.firebaseapp.com',
    projectId: 'henz-script',
    storageBucket: 'henz-script.firebasestorage.app',
    messagingSenderId: '381849813819',
    appId: '1:381849813819:web:7d66942569c52b75ce6d1e'
  };
  var VAPID_KEY = 'BDYJy-tFqg0X8TQSWXdiQT14rdu6Yyw9Z_8kyK7e6PbyD8ZJ15OqDhMSHlDrh6L9Grm_0h6HC4oeqBO15qfdo2Q';
  var API = '/api/push-subscribe';
  var KEY = 'hz_notif_v1';
  var MAX_ITEMS = 30;
  var REFRESH_MS = 7 * 24 * 3600 * 1000;

  /* ---------- Storage (dibungkus try/catch: mode privat / storage diblokir tidak boleh merusak halaman) ---------- */
  function readRec(){
    try{
      var r = JSON.parse(localStorage.getItem(KEY) || 'null');
      if(r && typeof r === 'object' && typeof r.since === 'number' && isFinite(r.since)){
        if(typeof r.seen !== 'number') r.seen = r.since;
        if(typeof r.max !== 'number') r.max = r.since;
        return r;
      }
    }catch(err){}
    return null;
  }
  function writeRec(r){
    try{ localStorage.setItem(KEY, JSON.stringify(r)); return true; }
    catch(err){ return false; }
  }
  function clearRec(){
    try{ localStorage.removeItem(KEY); }catch(err){}
  }

  /* ---------- Deteksi lingkungan ---------- */
  var UA = navigator.userAgent || '';
  function isIOS(){
    return /iPad|iPhone|iPod/.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function isStandalone(){
    try{
      return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
    }catch(err){ return false; }
  }
  function isInApp(){
    return /FBAN|FBAV|Instagram|Line\/|MicroMessenger|; wv\)/i.test(UA);
  }
  function hasPushApi(){
    return ('Notification' in window) && ('serviceWorker' in navigator) && ('PushManager' in window) && window.isSecureContext !== false;
  }

  /* Status: unsupported | ios-install | denied | ready | on */
  function getState(){
    if(isIOS() && !isStandalone()) return 'ios-install';
    if(!hasPushApi()) return 'unsupported';
    var perm = Notification.permission;
    var rec = readRec();
    if(perm === 'denied'){ if(rec) clearRec(); return 'denied'; }
    if(perm === 'granted' && rec) return 'on';
    if(rec) clearRec(); // izin dicabut/direset dari pengaturan browser: anggap belum aktif
    return 'ready';
  }

  /* ---------- Data posts.json ---------- */
  var postsCache = null;
  function maxId(posts){
    var m = 0;
    for(var i = 0; i < posts.length; i++){
      var id = posts[i] && posts[i].id;
      if(typeof id === 'number' && id > m) m = id;
    }
    return m;
  }
  function loadPosts(){
    return fetch('/js/posts.json?t=' + Date.now())
      .then(function(r){ if(!r.ok) throw new Error('posts'); return r.json(); })
      .then(function(d){
        var list = Array.isArray(d) ? d : [];
        postsCache = list;
        syncBadge(list);
        return list;
      });
  }

  /* ---------- Titik merah di lonceng ---------- */
  var bells = [];
  function setBadge(on){
    for(var i = 0; i < bells.length; i++){
      if(on) bells[i].classList.add('has-new'); else bells[i].classList.remove('has-new');
    }
  }
  function badgeFromRec(){
    var rec = readRec();
    setBadge(!!(rec && rec.max > rec.seen && getState() === 'on'));
  }
  function syncBadge(posts){
    var rec = readRec();
    if(!rec){ setBadge(false); return; }
    var m = maxId(posts);
    if(m > rec.max){ rec.max = m; writeRec(rec); }
    setBadge(getState() === 'on' && rec.max > rec.seen);
  }
  /* Dipanggil main.js (hzFetchPosts) setiap halaman selesai mengambil posts.json: tanpa request tambahan */
  window.hzNotifySync = function(posts){
    try{ if(Array.isArray(posts)){ postsCache = posts; syncBadge(posts); } }catch(err){}
  };

  /* ---------- Firebase (LAZY) ---------- */
  var fbP = null;
  function dynImport(url){
    return (new Function('u', 'return import(u)'))(url);
  }
  function withTimeout(p, ms, code){
    return new Promise(function(resolve, reject){
      var t = setTimeout(function(){ reject({ code: code || 'timeout' }); }, ms);
      p.then(function(v){ clearTimeout(t); resolve(v); }, function(e){ clearTimeout(t); reject(e); });
    });
  }
  function loadFirebase(){
    if(fbP) return fbP;
    var base = 'https://www.gstatic.com/firebasejs/' + FB_VER + '/';
    fbP = Promise.all([dynImport(base + 'firebase-app.js'), dynImport(base + 'firebase-messaging.js')]).then(function(m){
      var appMod = m[0], msgMod = m[1];
      return msgMod.isSupported().then(function(ok){
        if(!ok) throw { code: 'unsupported' };
        var app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(FB_CONFIG);
        return { mod: msgMod, messaging: msgMod.getMessaging(app) };
      });
    });
    fbP.then(null, function(){ fbP = null; });
    return fbP;
  }
  function getToken(){
    return Promise.all([
      loadFirebase(),
      withTimeout(navigator.serviceWorker.ready, 10000, 'sw')
    ]).then(function(r){
      return r[0].mod.getToken(r[0].messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: r[1] });
    }).then(function(t){
      if(!t) throw { code: 'notoken' };
      return t;
    });
  }
  function callServer(method, token){
    return fetch(API, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token }),
      credentials: 'omit'
    }).then(function(r){
      if(!r.ok) throw { code: 'server' };
      return r.json().catch(function(){ return {}; });
    });
  }
  function askPermission(){
    return new Promise(function(resolve){
      var done = false;
      function fin(v){ if(!done){ done = true; resolve(v); } }
      try{
        var r = Notification.requestPermission(fin);
        if(r && typeof r.then === 'function') r.then(fin, function(){ fin('default'); });
      }catch(err){ fin('default'); }
    });
  }

  /* Perbarui token secara berkala (token FCM bisa berganti) tanpa mengganggu pengguna */
  function maybeRefresh(){
    var rec = readRec();
    if(!rec || getState() !== 'on') return;
    if(Date.now() - (rec.chk || 0) < REFRESH_MS) return;
    var run = function(){
      getToken().then(function(t){ return callServer('POST', t); }).then(function(){
        var r2 = readRec();
        if(r2){ r2.chk = Date.now(); writeRec(r2); }
      }).then(null, function(){});
    };
    if(window.requestIdleCallback) window.requestIdleCallback(run, { timeout: 8000 });
    else setTimeout(run, 4000);
  }

  /* ---------- UI ---------- */
  function init(){
    bells = Array.prototype.slice.call(document.querySelectorAll('.hz-nt-bell'));
    var overlay = document.getElementById('hz-nt');
    if(!overlay || !bells.length) return;

    var htmlEl = document.documentElement;
    var closeBtn = document.getElementById('hz-nt-close');
    var tabs = overlay.querySelectorAll('.hz-nt-tab');
    var paneInfo = document.getElementById('hz-nt-pane-info');
    var paneHist = document.getElementById('hz-nt-pane-hist');
    var enableBtn = document.getElementById('hz-nt-enable');
    var disableBtn = document.getElementById('hz-nt-disable');
    var msgEl = document.getElementById('hz-nt-msg');
    var inappEl = document.getElementById('hz-nt-inapp');
    var blocks = overlay.querySelectorAll('.hz-nt-st');
    if(!closeBtn || !paneInfo || !paneHist || !enableBtn || !disableBtn) return;

    var busy = false;
    var lastFocus = null;
    var tab = 'info';

    function setMsg(t){ msgEl.textContent = t || ''; }
    function setBusy(on, btn, label){
      busy = on;
      btn.disabled = on;
      if(on){ btn.setAttribute('data-label', btn.textContent); btn.textContent = label; }
      else if(btn.getAttribute('data-label')){ btn.textContent = btn.getAttribute('data-label'); btn.removeAttribute('data-label'); }
    }

    /* Tampilkan blok Tab 1 yang sesuai status */
    function applyState(){
      var st = getState();
      overlay.setAttribute('data-state', st);
      for(var i = 0; i < blocks.length; i++){
        var want = (blocks[i].getAttribute('data-st') || '').split(' ');
        blocks[i].hidden = want.indexOf(st) === -1;
      }
      if(inappEl) inappEl.hidden = !(st === 'unsupported' && isInApp());
      badgeFromRec();
      return st;
    }

    /* ----- Riwayat ----- */
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
    function safeThumb(u){ return (typeof u === 'string' && /^https:\/\//i.test(u)) ? u : ''; }
    function clearList(){ while(paneHist.firstChild) paneHist.removeChild(paneHist.firstChild); }
    function emptyBlock(title, text, btnLabel, onClick){
      var empty = document.createElement('div');
      empty.className = 'hz-fm-empty';
      var t1 = document.createElement('strong');
      t1.textContent = title;
      var t2 = document.createElement('span');
      t2.textContent = text;
      empty.appendChild(t1);
      empty.appendChild(t2);
      if(btnLabel){
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'hz-nt-cta hz-nt-cta--sm';
        b.textContent = btnLabel;
        b.addEventListener('click', onClick);
        empty.appendChild(b);
      }
      paneHist.appendChild(empty);
    }
    function renderItems(posts, since){
      var items = posts.filter(function(p){ return p && typeof p.id === 'number' && p.id > since && p.url && p.title; })
        .sort(function(a, b){ return b.id - a.id; })
        .slice(0, MAX_ITEMS);
      clearList();
      if(!items.length){
        emptyBlock('Belum ada notifikasi', 'Script baru akan muncul di sini begitu dirilis.');
        return;
      }
      items.forEach(function(p){
        var a = document.createElement('a');
        a.className = 'hz-fm-hist-item';
        a.href = p.url;
        var th = document.createElement('span');
        th.className = 'hz-fm-hist-thumb';
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
        var body = document.createElement('span');
        body.className = 'hz-fm-hist-body';
        var name = document.createElement('strong');
        name.textContent = String(p.title);
        var when = document.createElement('span');
        when.textContent = 'Script baru' + (p.date ? ' \u00b7 ' + p.date : '');
        body.appendChild(name);
        body.appendChild(when);
        a.appendChild(th);
        a.appendChild(body);
        a.appendChild(chevron());
        paneHist.appendChild(a);
      });
    }
    function renderHistory(){
      var st = getState();
      var rec = readRec();
      clearList();
      if(st !== 'on' || !rec){
        emptyBlock('Notifikasi belum aktif', 'Aktifkan notifikasi supaya kabar script baru muncul di sini.', 'Cara mengaktifkan', function(){ showTab('info'); });
        return;
      }
      emptyBlock('Memuat\u2026', '');
      var useCache = postsCache && postsCache.length;
      (useCache ? Promise.resolve(postsCache) : loadPosts()).then(function(posts){
        if(tab !== 'hist' || !overlay.classList.contains('open')) return;
        var cur = readRec();
        if(!cur) return;
        renderItems(posts, cur.since);
        var m = maxId(posts);
        cur.max = Math.max(cur.max, m);
        cur.seen = cur.max; // sudah dilihat
        writeRec(cur);
        setBadge(false);
      }).then(null, function(){
        clearList();
        emptyBlock('Gagal memuat', 'Periksa koneksi internet, lalu coba lagi.', 'Coba lagi', renderHistory);
      });
    }

    /* ----- Tab ----- */
    function showTab(name){
      tab = name === 'hist' ? 'hist' : 'info';
      for(var i = 0; i < tabs.length; i++){
        var on = tabs[i].getAttribute('data-tab') === tab;
        tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
        tabs[i].tabIndex = on ? 0 : -1;
      }
      paneInfo.hidden = tab !== 'info';
      paneHist.hidden = tab !== 'hist';
      if(tab === 'hist') renderHistory();
    }
    for(var ti = 0; ti < tabs.length; ti++){
      (function(t){
        t.addEventListener('click', function(){ showTab(t.getAttribute('data-tab')); });
        t.addEventListener('keydown', function(e){
          var k = e.key || '';
          if(k === 'ArrowRight' || k === 'ArrowLeft'){
            e.preventDefault();
            var next = t.getAttribute('data-tab') === 'info' ? 'hist' : 'info';
            showTab(next);
            for(var j = 0; j < tabs.length; j++){ if(tabs[j].getAttribute('data-tab') === next) tabs[j].focus(); }
          }
        });
      })(tabs[ti]);
    }

    /* ----- Buka / tutup ----- */
    function openModal(from){
      lastFocus = from || null;
      setMsg('');
      var st = applyState();
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden', 'false');
      htmlEl.classList.add('hz-fm-lock');
      showTab(st === 'on' ? 'hist' : 'info');
      setTimeout(function(){ closeBtn.focus(); }, 30);
    }
    function closeModal(){
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
      htmlEl.classList.remove('hz-fm-lock');
      if(lastFocus && lastFocus.focus) lastFocus.focus();
    }
    bells.forEach(function(b){
      b.addEventListener('click', function(){ openModal(b); });
    });
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', function(e){ if(e.target === overlay) closeModal(); });

    /* ----- Aktifkan ----- */
    function enable(){
      if(busy || getState() !== 'ready') return;
      setMsg('');
      setBusy(true, enableBtn, 'Memproses\u2026');
      var already = Notification.permission === 'granted';
      (already ? Promise.resolve('granted') : askPermission()).then(function(perm){
        if(perm !== 'granted') throw { code: perm === 'denied' ? 'denied' : 'dismissed' };
        return Promise.all([getToken(), loadPosts()]);
      }).then(function(res){
        return callServer('POST', res[0]).then(function(){ return res[1]; });
      }).then(function(posts){
        var m = maxId(posts);
        writeRec({ since: m, seen: m, max: m, chk: Date.now() });
        setBusy(false, enableBtn);
        applyState();
        showTab('hist');
      }).then(null, function(err){
        setBusy(false, enableBtn);
        var code = err && err.code;
        var st = applyState();
        if(code === 'denied' || st === 'denied') return;
        if(code === 'dismissed') setMsg('Izin belum diberikan. Tekan tombol lagi lalu pilih "Izinkan" saat browser bertanya.');
        else if(code === 'unsupported') setMsg('Browser ini belum mendukung notifikasi.');
        else setMsg('Gagal mengaktifkan notifikasi. Periksa koneksi internet lalu coba lagi.');
      });
    }
    enableBtn.addEventListener('click', enable);

    /* ----- Matikan ----- */
    function disable(){
      if(busy || getState() !== 'on') return;
      setMsg('');
      setBusy(true, disableBtn, 'Memproses\u2026');
      var tok = null;
      getToken().then(function(t){
        tok = t;
        return callServer('DELETE', t);
      }).then(function(){
        return loadFirebase().then(function(fb){ return fb.mod.deleteToken(fb.messaging); });
      }).then(function(){
        clearRec();
        setBusy(false, disableBtn);
        applyState();
        showTab('info');
      }).then(null, function(){
        setBusy(false, disableBtn);
        setMsg('Gagal mematikan notifikasi. Periksa koneksi internet lalu coba lagi.');
      });
    }
    disableBtn.addEventListener('click', disable);

    /* ----- Keyboard: ESC menutup, Tab dikurung di dalam popup ----- */
    document.addEventListener('keydown', function(e){
      if(!overlay.classList.contains('open')) return;
      var key = e.key || '';
      if(key === 'Escape' || key === 'Esc'){ closeModal(); return; }
      if(key === 'Tab'){
        var f = overlay.querySelectorAll('a[href], button');
        var vis = [];
        for(var i = 0; i < f.length; i++){
          if(f[i].offsetParent !== null && !f[i].disabled) vis.push(f[i]);
        }
        if(!vis.length) return;
        var first = vis[0], last = vis[vis.length - 1];
        if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
        else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
        else if(!overlay.contains(document.activeElement)){ e.preventDefault(); first.focus(); }
      }
    });

    /* Kembali dari bfcache / izin diubah di pengaturan browser: segarkan status */
    window.addEventListener('pageshow', function(e){ if(e.persisted){ applyState(); } });
    document.addEventListener('visibilitychange', function(){
      if(!document.hidden && overlay.classList.contains('open')){
        var before = overlay.getAttribute('data-state');
        var now = applyState();
        if(now !== before) showTab(now === 'on' ? 'hist' : 'info');
      }
    });

    applyState();
    maybeRefresh();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
