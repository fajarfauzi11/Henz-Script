/* sw.js — Service worker Henz MLBB (PWA).
   Tugasnya sengaja kecil dan aman:
   1. Memenuhi syarat install Chrome (fetch handler yang benar-benar bekerja) supaya tombol "Install Aplikasi" bisa memicu prompt.
   2. Halaman: jaringan lebih dulu. Hanya kalau jaringan gagal, dipakai salinan terakhir yang pernah dibuka, atau halaman /offline.
   3. Aset statis satu-origin (CSS, JS, gambar, font): sajikan dari cache lalu segarkan di belakang layar.

   YANG SENGAJA TIDAK DISENTUH (tidak ada respondWith, browser menangani seperti biasa):
   - semua permintaan lintas-origin: iklan Adsterra, thumbnail ImgBB, ikon Fandom, jsDelivr, Google Fonts, sfile, dll.
     (skrip iklan tidak boleh diubah atau di-cache)
   - non-GET, permintaan Range, /api/* (penghitung tampilan), /js/posts.json dan /data/* (harus selalu segar), /_vercel/*, sitemap/xml, sw.js.

   Placeholder id build pada variabel BUILD di bawah diganti build.js di setiap deploy. Akibatnya file ini berubah di setiap
   deploy, browser memasang versi baru, dan cache versi lama dihapus otomatis saat aktivasi. */
var BUILD = '__HZ_BUILD__';
var STATIC_CACHE = 'hz-static-' + BUILD;
var PAGE_CACHE = 'hz-pages-' + BUILD;
var OFFLINE_URL = '/offline';
var MAX_PAGES = 30;
var MAX_STATIC = 120;

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(function(c){ return c.add(new Request(OFFLINE_URL, { cache: 'reload' })); })
      .catch(function(){ /* gagal mengambil halaman offline tidak boleh menggagalkan instalasi */ })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if(k.indexOf('hz-') === 0 && k !== STATIC_CACHE && k !== PAGE_CACHE) return caches.delete(k);
      }));
    }).then(function(){
      if(self.registration.navigationPreload) return self.registration.navigationPreload.enable().catch(function(){});
    }).then(function(){ return self.clients.claim(); })
  );
});

function trim(cache, max){
  return cache.keys().then(function(keys){
    var extra = keys.length - max;
    var jobs = [];
    for(var i = 0; i < extra; i++) jobs.push(cache.delete(keys[i]));
    return Promise.all(jobs);
  });
}

function handleNavigation(event){
  var req = event.request;
  return Promise.resolve(event.preloadResponse).then(function(pre){
    return pre || fetch(req);
  }).then(function(res){
    var type = res && res.headers && res.headers.get('content-type') || '';
    if(res && res.ok && res.type === 'basic' && type.indexOf('text/html') !== -1){
      var copy = res.clone();
      event.waitUntil(caches.open(PAGE_CACHE).then(function(c){
        return c.put(req, copy).then(function(){ return trim(c, MAX_PAGES); });
      }).catch(function(){}));
    }
    return res;
  }).catch(function(){
    return caches.open(PAGE_CACHE).then(function(c){ return c.match(req); }).then(function(hit){
      if(hit) return hit;
      return caches.open(STATIC_CACHE).then(function(c){ return c.match(OFFLINE_URL); });
    }).then(function(r){ return r || Response.error(); });
  });
}

function handleStatic(event){
  var req = event.request;
  return caches.open(STATIC_CACHE).then(function(cache){
    return cache.match(req).then(function(hit){
      var net = fetch(req).then(function(res){
        if(res && res.ok && res.type === 'basic'){
          var copy = res.clone();
          cache.put(req, copy).then(function(){ return trim(cache, MAX_STATIC); }).catch(function(){});
        }
        return res;
      }).catch(function(){ return null; });
      if(hit){ event.waitUntil(net); return hit; }
      return net.then(function(res){ return res || Response.error(); });
    });
  });
}

self.addEventListener('fetch', function(event){
  var req = event.request;
  if(req.method !== 'GET') return;
  if(req.headers.has('range')) return;
  var url = new URL(req.url);
  if(url.origin !== self.location.origin) return;
  var p = url.pathname;
  if(p === '/sw.js' || p === '/js/posts.json' || p.indexOf('/api/') === 0 || p.indexOf('/data/') === 0 || p.indexOf('/_vercel/') === 0) return;
  if(/\.(xml|xsl|txt|webmanifest)$/i.test(p)) return;

  if(req.mode === 'navigate'){
    event.respondWith(handleNavigation(event));
    return;
  }
  var d = req.destination;
  if(d === 'style' || d === 'script' || d === 'image' || d === 'font'){
    event.respondWith(handleStatic(event));
  }
});

/* ===================== Notifikasi push (Firebase Cloud Messaging) =====================
   Server mengirim pesan "data-only" ke topic FCM (api/push-notify.js). Kita tampilkan notifikasinya sendiri di sini,
   jadi SDK Firebase TIDAK dimuat di service worker. Bentuk payload dari FCM bisa berupa {data:{...}} atau
   {notification:{...}, data:{...}}; keduanya digabung supaya tetap aman kalau bentuknya sedikit berbeda.
   Field data: title, body, url (alamat tujuan saat diketuk), icon, image, tag. */
self.addEventListener('push', function(event){
  var payload = {};
  try{ payload = event.data ? event.data.json() : {}; }
  catch(err){
    try{ payload = { data: { body: event.data.text() } }; }catch(err2){ payload = {}; }
  }
  var d = {};
  var n = (payload && payload.notification) || {};
  var x = (payload && payload.data) || {};
  var k;
  for(k in n) d[k] = n[k];
  for(k in x) d[k] = x[k];
  var title = String(d.title || 'Henz MLBB');
  var opts = {
    body: String(d.body || ''),
    icon: d.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: { url: d.url || '/' }
  };
  if(d.image) opts.image = d.image;
  event.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', function(event){
  event.notification.close();
  var target = '/';
  try{
    var u = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin);
    if(u.origin === self.location.origin) target = u.href; // hanya tujuan di situs ini
  }catch(err){}
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list){
      for(var i = 0; i < list.length; i++){
        var c = list[i];
        if(c.url && c.url.indexOf(self.location.origin) === 0 && 'focus' in c){
          return c.focus().then(function(w){ return (w && 'navigate' in w) ? w.navigate(target) : null; }).catch(function(){
            return self.clients.openWindow(target);
          });
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
