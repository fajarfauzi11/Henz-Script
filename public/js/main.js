/* HenzScript Static Site — main.js identical to Blogger theme */
(function(){

/* Year */
var hzYrEl=document.getElementById('hz-year');
if(hzYrEl)hzYrEl.textContent=new Date().getFullYear();

/* ── Tombol "Kembali" yang aman ──
   Dipakai oleh semua tombol back di situs (post, hero, kategori, hasil pencarian).
   Masalah yang diperbaiki:
   1) User masuk dari Google Search → klik "Kembali" selama ini malah balik ke
      halaman hasil pencarian Google (karena history.back() polos ikut riwayat
      browser, padahal riwayat itu isinya Google, bukan halaman HenzScript lain).
   2) User masuk dari link WhatsApp/YouTube/link eksternal lain → sering kali
      TIDAK ADA riwayat sama sekali (tab/webview baru), jadi history.back()
      tidak bereaksi apa-apa.
   Solusi: cek document.referrer. Kalau referrer-nya dari domain HenzScript
   sendiri, aman pakai history.back() seperti biasa. Kalau bukan (termasuk
   kosong / dari luar situs), langsung arahkan ke fallbackUrl (biasanya "/"
   atau halaman listing yang relevan) alih-alih diam saja atau nyasar keluar. */
window.hzSmartBack = function(fallbackUrl){
  fallbackUrl = fallbackUrl || '/';
  var ref = document.referrer;
  if(ref){
    try{
      if(new URL(ref).hostname === window.location.hostname){
        history.back();
        return false;
      }
    }catch(e){ /* referrer tidak valid sebagai URL → anggap tidak aman, lanjut fallback di bawah */ }
  }
  window.location.href = fallbackUrl;
  return false;
};

/* Mobile Nav Drawer (Header V2 - pill) */
(function(){
  var btn=document.getElementById('henz-menu-btn');
  var nav=document.getElementById('henz-mobile-nav');
  var headerInner=btn?btn.closest('.henz-header-inner'):null;
  function hzOpenDrawer(){
    nav.style.display='flex';
    var items=nav.querySelectorAll('.hz-drawer-links li,.hz-drawer-search');
    items.forEach(function(el){el.style.animation='none';el.getBoundingClientRect();el.style.animation='';});
    nav.getBoundingClientRect();
    nav.classList.add('open');
    btn.classList.add('active');
    if(headerInner)headerInner.classList.add('hz-drawer-open');
  }
  function hzCloseDrawer(){
    nav.classList.remove('open');
    btn.classList.remove('active');
    if(headerInner)headerInner.classList.remove('hz-drawer-open');
    setTimeout(function(){if(!nav.classList.contains('open'))nav.style.display='none';},280);
  }
  if(btn&&nav){
    nav.style.display='none';
    btn.addEventListener('click',function(){if(nav.classList.contains('open')){hzCloseDrawer();}else{hzOpenDrawer();}});
  }
  window.hzV2CloseDrawer=hzCloseDrawer;
  document.addEventListener('click',function(e){
    if(nav&&nav.classList.contains('open')){
      if(!nav.contains(e.target)&&e.target!==btn&&!btn.contains(e.target)){hzCloseDrawer();}
    }
  });
})();

/* Mobile Nav Dropdown (Header V1 - box) */
(function(){
  var btn=document.getElementById('hz-hv1-menu-btn');
  var nav=document.getElementById('hz-hv1-mobile-nav');
  if(!btn||!nav)return;
  function open(){nav.classList.add('open');btn.classList.add('active');btn.setAttribute('aria-expanded','true');hzHv1CloseSearch();}
  function close(){nav.classList.remove('open');btn.classList.remove('active');btn.setAttribute('aria-expanded','false');}
  function toggle(){if(nav.classList.contains('open')){close();}else{open();}}
  window.hzHv1CloseNav=close;
  btn.addEventListener('click',toggle);
  document.addEventListener('click',function(e){
    if(nav.classList.contains('open')&&!nav.contains(e.target)&&e.target!==btn&&!btn.contains(e.target)){close();}
  });
})();

/* Cegah dua penanda aktif bersamaan di dropdown nav Header V1 saat ditekan */
(function(){
  var nav=document.getElementById('hz-hv1-mobile-nav');
  if(!nav)return;
  function norm(p){
    if(!p)return '/';
    p=p.split('?')[0].split('#')[0];
    p=p.replace(/index\.html$/,'').replace(/\.html$/,'');
    if(p.length>1)p=p.replace(/\/$/,'');
    return p||'/';
  }
  var currentPath=norm(window.location.pathname);
  function clearActive(){
    nav.querySelectorAll('a.active').forEach(function(a){a.classList.remove('active');});
  }
  function restoreActive(){
    nav.querySelectorAll('a').forEach(function(a){
      var href=norm(a.getAttribute('href'));
      a.classList.toggle('active',href===currentPath);
    });
  }
  nav.addEventListener('touchstart',function(e){
    if(e.target.closest('a'))clearActive();
  },{passive:true});
  nav.addEventListener('mousedown',function(e){
    if(e.target.closest('a'))clearActive();
  });
  var restoreTimer=null;
  function scheduleRestore(){
    clearTimeout(restoreTimer);
    restoreTimer=setTimeout(restoreActive,150);
  }
  nav.addEventListener('click',function(e){
    if(e.target.closest('a'))clearTimeout(restoreTimer);
  });
  document.addEventListener('touchend',scheduleRestore);
  document.addEventListener('touchcancel',scheduleRestore);
  document.addEventListener('mouseup',scheduleRestore);
})();

/* Search Toggle (Header V1 - expand ke kiri) */
(function(){
  var wrap=document.getElementById('hz-hv1-search-wrap');
  var btn=document.getElementById('hz-hv1-search-btn');
  var inner=wrap?wrap.closest('.hz-hv1-inner'):null;
  var input=wrap?wrap.querySelector('input[name="q"]'):null;
  if(!wrap||!btn)return;
  function open(){
    wrap.classList.add('open');
    if(inner)inner.classList.add('hz-search-active');
    btn.setAttribute('aria-expanded','true');
    if(window.hzHv1CloseNav)window.hzHv1CloseNav();
    if(input)input.focus({preventScroll:true});
  }
  function close(){
    wrap.classList.remove('open');
    if(inner)inner.classList.remove('hz-search-active');
    btn.setAttribute('aria-expanded','false');
  }
  window.hzHv1CloseSearch=close;
  btn.addEventListener('click',function(){if(wrap.classList.contains('open')){close();}else{open();}});
  document.addEventListener('click',function(e){
    if(wrap.classList.contains('open')&&!wrap.contains(e.target)){close();}
  });
})();

/* Sinkronkan posisi header dengan visual viewport (hindari ketutup UI browser mobile / keyboard) */
(function(){
  if(!window.visualViewport)return;
  var vv=window.visualViewport;
  var hv1=document.getElementById('hz-hv1-header');
  var hv2=document.querySelector('.henz-header');
  var mq=window.matchMedia('(max-width:768px)');
  function hv2BaseTop(){return mq.matches?8:24;}
  /* --hz-sat = inset status bar (hanya terdefinisi di PWA Android layar penuh: html.hz-e2e, lihat style.css);
     di tempat lain var() jatuh ke 0px sehingga hasilnya sama persis dengan sebelumnya. */
  function sync(){
    if(hv1)hv1.style.top='calc('+vv.offsetTop+'px + var(--hz-sat, 0px))';
    if(hv2)hv2.style.top='calc('+(vv.offsetTop+hv2BaseTop())+'px + var(--hz-sat, 0px))';
  }
  var ticking=false;
  function onVVChange(){
    if(ticking)return;
    ticking=true;
    requestAnimationFrame(function(){sync();ticking=false;});
  }
  vv.addEventListener('resize',onVVChange);
  vv.addEventListener('scroll',onVVChange);
  window.addEventListener('resize',onVVChange);
  sync();
})();

/* Header V1 <-> V2 crossfade on scroll */
(function(){
  var sentinel=document.getElementById('hz-header-sentinel');
  var hv1=document.getElementById('hz-hv1-header');
  if(!sentinel)return;
  function positionSentinel(){if(hv1)sentinel.style.top=hv1.offsetHeight+'px';}
  positionSentinel();
  window.addEventListener('resize',positionSentinel);
  if(typeof IntersectionObserver==='undefined'){document.body.classList.add('hz-scrolled');return;}
  var switchTimer=null;
  var io=new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      var willScroll=!entry.isIntersecting;
      clearTimeout(switchTimer);
      switchTimer=setTimeout(function(){
        document.body.classList.toggle('hz-scrolled',willScroll);
        if(window.hzHv1CloseNav)window.hzHv1CloseNav();
        if(window.hzHv1CloseSearch)window.hzHv1CloseSearch();
        if(window.hzV2CloseDrawer)window.hzV2CloseDrawer();
      },120);
    });
  },{root:null,threshold:0});
  io.observe(sentinel);
})();

/* Cegah browser mobile "melompat" scroll ke atas saat input search header di-fokus */
(function(){
  function guardScroll(input){
    var lockX=null,lockY=null,lockUntil=0,rafId=null;
    function tick(){
      if(Date.now()>lockUntil){lockY=null;rafId=null;return;}
      if(lockY!==null&&(window.scrollX!==lockX||window.scrollY!==lockY)){
        window.scrollTo(lockX,lockY);
      }
      rafId=requestAnimationFrame(tick);
    }
    function startLock(){
      lockX=window.scrollX;lockY=window.scrollY;
      lockUntil=Date.now()+600;
      if(!rafId)rafId=requestAnimationFrame(tick);
    }
    input.addEventListener('touchstart',function(e){
      startLock();
      if(document.activeElement!==input){
        e.preventDefault();
        input.focus({preventScroll:true});
      }
    },{passive:false});
    input.addEventListener('mousedown',startLock);
    input.addEventListener('focus',function(){if(lockY===null)startLock();});
  }
  document.querySelectorAll('.hz-hv1-header input[type="text"],.henz-header input[type="text"]').forEach(guardScroll);
})();

/* Active nav */
function hzNormalizePath(p){
  if(!p)return '/';
  p=p.split('?')[0].split('#')[0];
  p=p.replace(/index\.html$/,'');
  p=p.replace(/\.html$/,'');
  if(p.length>1)p=p.replace(/\/$/,'');
  if(p==='')p='/';
  return p;
}
var hzCurrentPath=hzNormalizePath(window.location.pathname);
document.querySelectorAll('.henz-nav a,.henz-mobile-nav a,.hz-hv1-mobile-nav a').forEach(function(link){
  var href=hzNormalizePath(link.getAttribute('href'));
  if(href&&href===hzCurrentPath)link.classList.add('active');
});

/* Search form */
document.querySelectorAll('.hz-search-form-js').forEach(function(form){
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var q=form.querySelector('input[name="q"]');
    if(q&&q.value.trim()){
      if(window.hzSgRecord)window.hzSgRecord(q.value.trim());
      window.location.href='/search?q='+encodeURIComponent(q.value.trim());
    }
  });
});

/* Placeholder henz-header v2: "Cari" → "Cari Script" saat focus */
(function(){
  var hv2=document.querySelector('.henz-header .henz-search-input');
  if(!hv2)return;
  hv2.addEventListener('focus',function(){this.placeholder='Cari Script';});
  hv2.addEventListener('blur',function(){this.placeholder='Cari';});
})();

/* Fetch posts.json */
function hzFetchPosts(cb){
  fetch('/js/posts.json?t='+Date.now())
    .then(function(r){return r.json();})
    .then(function(d){
      var list=Array.isArray(d)?d:[];
      try{if(window.hzNotifySync)window.hzNotifySync(list);}catch(e){} /* notify.js: perbarui titik merah lonceng tanpa request tambahan */
      cb(list);
    })
    .catch(function(){cb([]);});
}

/* Build slider card — desain card dipusatkan di /js/card-template.js (window.hzCard) */
function hzBuildSlide(e){
  return '<div class="swiper-slide" style="height:auto">'+window.hzCard.hzBuildCard(e)+'</div>';
}


/* Init Swiper */
function hzInitSwiper(id){
  if(typeof Swiper==='undefined')return null;
  var el=document.getElementById(id);
  if(!el)return null;
  return new Swiper('#'+id,{
    slidesPerView:2,spaceBetween:12,grabCursor:true,simulateTouch:true,touchRatio:1.5,resistanceRatio:0.8,
    pagination:{el:'#'+id+' .swiper-pagination',clickable:true,dynamicBullets:true},
    navigation:{nextEl:'#'+id+' .swiper-button-next',prevEl:'#'+id+' .swiper-button-prev'},
    breakpoints:{640:{slidesPerView:3,spaceBetween:20},1024:{slidesPerView:4,spaceBetween:24}}
  });
}

/* Ganti isi slide sebuah instance Swiper yang SUDAH ter-init (dipakai saat skeleton -> konten asli).
   CATATAN PENTING: sengaja TIDAK pakai swiper.removeAllSlides()+appendSlide() karena di Swiper v11
   (versi yang dipakai situs ini) kedua method itu gagal menghapus slide lama saat container-nya
   sedang display:none (mis. tab "Script Terpopuler" yang belum aktif) — slide lama & baru numpuk
   jadi satu, sehingga konten asli ketutup skeleton lama. Sudah dites & dikonfirmasi ulang lewat
   simulasi dengan Swiper v11.2.10 asli (persis versi CDN yang dipakai). Ganti innerHTML wrapper
   langsung + swiper.update() terbukti benar-benar mengganti seluruh isi, konsisten di semua kondisi. */
function hzSwapSlides(swiper,htmlArray){
  if(!swiper||!swiper.wrapperEl)return;
  try{
    swiper.wrapperEl.innerHTML=htmlArray.join('');
    swiper.update();
  }catch(err){
    console.error('hzSwapSlides error:',err);
  }
}

/* Init langsung di atas skeleton yang sudah ada di HTML sejak awal render,
   supaya dari paint pertama layout sudah presisi sama Swiper (bukan perkiraan CSS). */
var hzSwiperLatest=hzInitSwiper('hz-swiper-latest');
var hzSwiperPopular=hzInitSwiper('hz-swiper-popular');

/* Segmented Control */
var seg=document.getElementById('hz-seg');
var pill=document.getElementById('hz-seg-pill');
if(seg&&pill){
  var items=seg.querySelectorAll('.hz-seg-item');
  var secLatest=document.getElementById('hz-section-latest');
  var secPopular=document.getElementById('hz-section-popular');
  function movePill(btn){var pad=4;pill.style.width=btn.offsetWidth+'px';pill.style.translate=(btn.offsetLeft-pad)+'px';}
  function activate(btn){
    items.forEach(function(b){b.classList.remove('active');b.setAttribute('aria-checked','false');});
    btn.classList.add('active');btn.setAttribute('aria-checked','true');movePill(btn);
    var target=btn.getAttribute('data-target');
    if(secLatest)secLatest.style.display=(target==='hz-section-latest')?'block':'none';
    if(secPopular)secPopular.style.display=(target==='hz-section-popular')?'block':'none';
    /* Swiper yang di-update() sementara container-nya display:none akan menghitung lebar 0
       (geometri jadi rusak/tidak valid). Paksa recalculate begitu section benar-benar terlihat,
       supaya slide selalu tampil benar berapa pun kali tab ini dibuka. */
    if(target==='hz-section-latest'&&hzSwiperLatest)hzSwiperLatest.update();
    if(target==='hz-section-popular'&&hzSwiperPopular)hzSwiperPopular.update();
  }
  items.forEach(function(btn){btn.addEventListener('click',function(){activate(btn);});});
  if(secPopular)secPopular.style.display='none';
  requestAnimationFrame(function(){requestAnimationFrame(function(){
    var activeBtn=seg.querySelector('.hz-seg-item.active');
    if(activeBtn)movePill(activeBtn);
  });});
}

/* View Count — hzSlugFromUrl & hzFormatViewCount sekarang dari window.hzCard (card-template.js) */
/* Terapkan angka views (dari data yang SUDAH ada di tangan) ke semua elemen [data-view-id]
   di dalam scope tertentu, TANPA fetch baru. Dipisah dari hzLoadViewCounts supaya bisa
   dipakai ulang di homepage (1 hasil fetch dipakai buat slider Terbaru & Terpopuler
   sekaligus) — lihat blok "Load Sliders" di bawah. */
function hzApplyViewCounts(root,views){
  var scope=root||document;
  var els=scope.querySelectorAll('[data-view-id]');
  els.forEach(function(el){
    var id=el.getAttribute('data-view-id');
    var span=el.querySelector('[data-view-count]');
    if(span)span.textContent=window.hzCard.hzFormatViewCount((views&&views[id])||0);
  });
}
function hzLoadViewCounts(root){
  var scope=root||document;
  var els=scope.querySelectorAll('[data-view-id]');
  if(!els.length)return;
  var items=[],seen={};
  els.forEach(function(el){
    var id=el.getAttribute('data-view-id');
    var slug=el.getAttribute('data-view-slug')||'';
    if(id&&!seen[id]){seen[id]=1;items.push(id+':'+slug);}
  });
  if(!items.length)return;
  fetch('/api/view?items='+encodeURIComponent(items.join(',')))
    .then(function(r){if(!r.ok)throw new Error('view api error');return r.json();})
    .then(function(data){hzApplyViewCounts(scope,(data&&data.views)||{});})
    .catch(function(){});
}
/* Homepage menangani view count sendiri lewat 1 fetch gabungan di blok "Load Sliders"
   di bawah (dijalankan setelah slide selesai dirender dari data async). Trigger otomatis
   generik ini sengaja DILEWATI khusus di homepage, supaya tidak ada celah timing yang
   bisa memicu /api/view kedua kalinya di sana. Halaman lain (hero/post/kategori/search)
   tetap pakai jalur ini seperti biasa karena kartu-kartunya sudah ada di HTML sejak awal. */
if(!document.getElementById('hz-swiper-latest')){
  document.addEventListener('DOMContentLoaded',function(){hzLoadViewCounts();});
  if(document.readyState==='complete'||document.readyState==='interactive')hzLoadViewCounts();
}

if(document.body.classList.contains('page-post')){
  hzFetchPosts(function(posts){
    var path=window.location.pathname.replace(/\/+$/,'');
    var current=posts.filter(function(p){return (p.url||'').replace(/\/+$/,'')===path;})[0];
    if(!current||!current.id)return;
    var slug=window.hzCard.hzSlugFromUrl(current.url);
    var flagKey='kz_viewed_'+current.id;
    if(sessionStorage.getItem(flagKey))return;
    fetch('/api/view',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({id:current.id,slug:slug})
    }).then(function(){sessionStorage.setItem(flagKey,'1');}).catch(function(){});
  });
}

/* Load Sliders */
if(document.getElementById('hz-swiper-latest')){
  hzFetchPosts(function(posts){
    if(!posts.length)return;
    var latestSlides=[];
    for(var i=0;i<Math.min(posts.length,10);i++)latestSlides.push(hzBuildSlide(posts[i]));
    hzSwapSlides(hzSwiperLatest,latestSlides);

    function renderPopular(sortedPosts){
      var popularSlides=[];
      for(var i=0;i<Math.min(sortedPosts.length,10);i++)popularSlides.push(hzBuildSlide(sortedPosts[i]));
      hzSwapSlides(hzSwiperPopular,popularSlides);
    }

    /* Satu fetch ini dipakai utk 2 keperluan sekaligus: (1) mengurutkan "Terpopuler",
       (2) menampilkan angka view di slider "Terbaru" MAUPUN "Terpopuler" — supaya
       homepage cukup 1x panggil /api/view (dulu 3x: 1x buat Terbaru, 1x buat sortir,
       1x lagi buat Terpopuler — padahal datanya sama). */
    var items=posts.map(function(p){return p.id+':'+window.hzCard.hzSlugFromUrl(p.url);});
    fetch('/api/view?items='+encodeURIComponent(items.join(',')))
      .then(function(r){if(!r.ok)throw new Error('view api error');return r.json();})
      .then(function(data){
        var views=(data&&data.views)||{};
        var sortedByViews=posts.slice().sort(function(a,b){
          return (parseInt(views[b.id],10)||0)-(parseInt(views[a.id],10)||0);
        });
        renderPopular(sortedByViews);
        hzApplyViewCounts(document,views);
      })
      .catch(function(){
        renderPopular(posts.slice());
        hzLoadViewCounts();
      });
  });
}

/* Hero Terpopuler (Home) */
var hzSwiperHeroPopular=hzInitHeroSwiper('hz-swiper-hero-popular');
if(document.getElementById('hz-hero-popular-wrapper')){
  Promise.all([
    fetch('/js/heroes.json?t='+Date.now()).then(function(r){return r.json();}).catch(function(){return [];}),
    fetch('/js/hero-popular.json?t='+Date.now()).then(function(r){return r.json();}).catch(function(){return [];})
  ]).then(function(res){
    var heroes=Array.isArray(res[0])?res[0]:[];
    var keys=Array.isArray(res[1])?res[1]:[];
    var byName={};
    heroes.forEach(function(h){byName[(h.name||'').toLowerCase()]=h;});
    var heroSlides=[];
    keys.forEach(function(key){
      var h=byName[(key||'').toLowerCase()];
      if(!h)return;
      heroSlides.push('<div class="swiper-slide" style="height:auto">'+hzDhBuildCard(h)+'</div>');
    });
    if(heroSlides.length){
      hzSwapSlides(hzSwiperHeroPopular,heroSlides);
    }else{
      var wrapper=document.getElementById('hz-hero-popular-wrapper');
      if(wrapper)wrapper.innerHTML='<div class="hz-dh-empty">Belum ada hero populer.</div>';
    }
  });
}

/* Init Swiper Hero Terpopuler (config sama dengan hzInitSwiper, cuma slidesPerView disesuaikan buat kartu hero yang lebih kecil) */
function hzInitHeroSwiper(id){
  if(typeof Swiper==='undefined')return null;
  var el=document.getElementById(id);
  if(!el)return null;
  return new Swiper('#'+id,{
    slidesPerView:3,spaceBetween:10,grabCursor:true,simulateTouch:true,touchRatio:1.5,resistanceRatio:0.8,
    pagination:{el:'#'+id+' .swiper-pagination',clickable:true,dynamicBullets:true},
    navigation:{nextEl:'#'+id+' .swiper-button-next',prevEl:'#'+id+' .swiper-button-prev'},
    breakpoints:{480:{slidesPerView:4,spaceBetween:12},768:{slidesPerView:5,spaceBetween:14},1024:{slidesPerView:6,spaceBetween:14}}
  });
}

/* Category State */
var hzCatState={labels:[]};

if(document.getElementById('hz-category-page')){
  document.getElementById('hz-category-page').classList.add('active');
  hzFetchPosts(function(posts){
    var labelMap={};
    posts.forEach(function(e){
      if(e.cat&&['Category','Community','Social'].indexOf(e.cat)===-1){
        labelMap[e.cat]=(labelMap[e.cat]||0)+1;
      }
    });
    var labels=Object.keys(labelMap).sort(function(a,b){return a.localeCompare(b);});
    hzCatState.labels=labels.map(function(n){return{name:n,count:labelMap[n]};});
    hzCatRenderTabs();
  });
}

function hzCatRenderTabs(){
  var cont=document.getElementById('hz-cp-tabs');
  if(!cont)return;
  var html='<a class="hz-cp-tab" href="/kategori-skin/semua">Semua</a>';
  hzCatState.labels.forEach(function(l){
    var href='/kategori-skin/'+hzDhSlugify(l.name);
    html+='<a class="hz-cp-tab" href="'+href+'">'+l.name+'</a>';
  });
  cont.innerHTML=html;
  var gridSkel=document.getElementById('hz-cp-grid-skel');
  if(gridSkel)gridSkel.remove();
}

/* Search */
function hzSvEsc(s){
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* Fuzzy match — "did you mean" buat search kosong.
   Levenshtein distance dinormalisasi jadi skor kemiripan 0..1 (1 = identik). */
function hzLevenshtein(a,b){
  a=a||'';b=b||'';
  var m=a.length,n=b.length;
  if(!m)return n;
  if(!n)return m;
  var prev=[];for(var j=0;j<=n;j++)prev[j]=j;
  for(var i=1;i<=m;i++){
    var cur=[i];
    for(var j=1;j<=n;j++){
      var cost=a.charAt(i-1)===b.charAt(j-1)?0:1;
      cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+cost);
    }
    prev=cur;
  }
  return prev[n];
}
function hzSimilarity(a,b){
  a=(a||'').toLowerCase().trim();b=(b||'').toLowerCase().trim();
  if(!a||!b)return 0;
  var maxLen=Math.max(a.length,b.length);
  return 1-(hzLevenshtein(a,b)/maxLen);
}

/* Gabung kandidat hero + kategori, ranking murni berdasar skor kemiripan ke kata kunci.
   Kalau kandidat yang lolos ambang batas kurang dari 3, sisanya ditambal pill populer (fallback). */
var KZ_SUGGEST_THRESHOLD=0.5;
function hzRankSuggestions(qVal,heroes,cats,popular){
  var q=(qVal||'').toLowerCase().trim();
  var pool=[];
  heroes.forEach(function(h){
    if(h&&h.name)pool.push({label:h.name,href:'/search?q='+encodeURIComponent(h.name),score:hzSimilarity(q,h.name)});
  });
  Object.keys(cats).forEach(function(catName){
    pool.push({label:catName,href:'/kategori-skin/'+hzDhSlugify(catName),score:hzSimilarity(q,catName)});
  });
  pool.sort(function(a,b){return b.score-a.score;});
  var picked=[],seen={};
  pool.forEach(function(item){
    if(picked.length>=3||item.score<KZ_SUGGEST_THRESHOLD||seen[item.label])return;
    seen[item.label]=1;
    picked.push(item);
  });
  if(picked.length<3){
    popular.forEach(function(name){
      if(picked.length>=3||seen[name])return;
      seen[name]=1;
      picked.push({label:name,href:'/search?q='+encodeURIComponent(name)});
    });
  }
  return picked.slice(0,3);
}
function hzBuildSuggestions(qVal,callback){
  Promise.all([
    fetch('/js/heroes.json?t='+Date.now()).then(function(r){return r.json();}).catch(function(){return [];}),
    fetch('/js/categories.json?t='+Date.now()).then(function(r){return r.json();}).catch(function(){return {};}),
    fetch('/js/hero-popular.json?t='+Date.now()).then(function(r){return r.json();}).catch(function(){return [];})
  ]).then(function(res){
    callback(hzRankSuggestions(qVal,res[0]||[],res[1]||{},res[2]||[]));
  }).catch(function(){callback([]);});
}

/* "Maksudmu": posisi 1 daftar saran (hzBuildSuggestions) hanya dipromosikan bila skornya cukup tinggi
   DAN jauh di atas posisi 2. Pill tambalan populer tidak punya skor, jadi tidak pernah jadi "Maksudmu". */
var KZ_DIDYOU_MIN=0.7,KZ_DIDYOU_GAP=0.1;
function hzDidYouMean(picked){
  var a=picked&&picked[0],b=picked&&picked[1];
  if(!a||typeof a.score!=='number'||a.score<KZ_DIDYOU_MIN)return null;
  if(b&&typeof b.score==='number'&&a.score-b.score<KZ_DIDYOU_GAP)return null;
  return a;
}

/* Tampilan "tidak ditemukan". picked/dym (opsional) = hasil hzBuildSuggestions/hzDidYouMean yang sudah dihitung
   pemanggil; tanpa itu fungsi ini mengambil sendiri (perilaku lama: 3 pill terdekat). */
function hzBuildSearchEmpty(qVal,picked,dym){
  var esc=hzSvEsc(qVal);
  var html='<div class="hz-sv-empty">'
    +'<div class="hz-sv-empty-icon"><svg viewBox="0 0 96 96" fill="none">'
    +'<circle cx="40" cy="40" r="26" stroke="#e6e6e6" stroke-width="7"/>'
    +'<circle cx="40" cy="40" r="26" stroke="#e53232" stroke-width="7" stroke-dasharray="30 300" stroke-linecap="round" transform="rotate(-45 40 40)"/>'
    +'<line x1="59" y1="59" x2="82" y2="82" stroke="#e6e6e6" stroke-width="8" stroke-linecap="round"/>'
    +'<line x1="30" y1="30" x2="50" y2="50" stroke="#e53232" stroke-width="5" stroke-linecap="round"/>'
    +'<line x1="50" y1="30" x2="30" y2="50" stroke="#e53232" stroke-width="5" stroke-linecap="round"/>'
    +'</svg></div>'
    +'<div class="hz-sv-empty-title">Script tidak ditemukan</div>'
    +'<p class="hz-sv-empty-sub">Kami tidak menemukan script untuk kata kunci <b>&ldquo;'+esc+'&rdquo;</b>. Coba periksa kembali ejaannya atau gunakan kata kunci lain.</p>'
    +(dym?'<div class="hz-sv-empty-dym">Maksudmu <a class="hz-sv-empty-tip hz-sv-empty-tip--main" href="'+dym.href+'">'+hzSvEsc(dym.label)+'</a>?</div>':'')
    +'<div class="hz-sv-empty-tips" id="hz-sv-empty-tips"></div>'
    +'<a class="hz-sv-empty-cta" href="/request-script">Request script ini'
    +'<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>'
    +'</a>'
    +'<a class="hz-sv-empty-cta2" href="/daftar-hero">Lihat Daftar Hero</a></div>';
  function fill(list){
    var tipsEl=document.getElementById('hz-sv-empty-tips');
    if(!tipsEl)return;
    tipsEl.innerHTML=list.map(function(item){
      return '<a class="hz-sv-empty-tip" href="'+item.href+'">'+hzSvEsc(item.label)+'</a>';
    }).join('');
  }
  if(picked){setTimeout(function(){fill(dym?picked.slice(1):picked);},0);}
  else hzBuildSuggestions(qVal,fill);
  return html;
}

/* Cocokkan kata kunci ke judul+kategori+keywords: semua kata harus muncul (substring) */
function hzSvMatch(posts,q){
  var words=(q||'').toLowerCase().split(/\s+/).filter(Boolean);
  return posts.filter(function(e){
    var h=((e.title||'')+' '+(e.cat||'')+' '+(e.keywords||'')).toLowerCase();
    return words.every(function(w){return h.indexOf(w)!==-1;});
  });
}

if(document.getElementById('hz-search-heading')){
  var shWrap=document.getElementById('hz-search-heading');
  var svGrid=document.getElementById('hz-sv-grid');
  var urlParams=new URLSearchParams(window.location.search);
  var qVal=urlParams.get('q')||'';
  var exactOnly=urlParams.get('exact')==='1';
  shWrap.style.display='block';
  shWrap.innerHTML='<a class="hz-sh-back" href="/" onclick="return hzSmartBack(this.getAttribute(\'href\'));">'
    +'&#8592; Halaman Sebelumnya</a>'
    +'<h1>Hasil pencarian untuk: <em>&ldquo;'+qVal.replace(/</g,'&lt;')+'&rdquo;</em></h1>'
    +'<div id="hz-sv-note"></div>'
    +'<div class="hz-sv-chips" id="hz-sv-chips" role="group" aria-label="Filter kategori" hidden></div>'
    +'<div class="hz-sv-meta"><p class="hz-sh-count" id="hz-sh-count" aria-live="polite">Memuat...</p>'
    +'<label class="hz-sv-sort" id="hz-sv-sort" hidden><select id="hz-sv-sort-sel" aria-label="Urutkan hasil">'
    +'<option value="new">Terbaru</option><option value="old">Terlama</option><option value="az">Nama A&ndash;Z</option></select></label></div>';

  var svCountEl=document.getElementById('hz-sh-count');
  function svEmpty(picked,dym){
    svCountEl.style.display='none';
    if(svGrid)svGrid.innerHTML=hzBuildSearchEmpty(qVal,picked,dym);
  }
  /* Tampilkan hasil + filter kategori + urutan. corr = {from,to} bila ini hasil koreksi salah ketik. */
  function svShow(results,corr){
    if(corr){
      document.getElementById('hz-sv-note').innerHTML='<div class="hz-sv-note"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/></svg>'
        +'<span>Menampilkan hasil untuk <b>'+hzSvEsc(corr.to)+'</b>. <a href="/search.html?q='+encodeURIComponent(corr.from)+'&amp;exact=1">Cari persis &ldquo;'+hzSvEsc(corr.from)+'&rdquo;</a></span></div>';
    }
    var state={cat:'',sort:'new'};
    var counts={};
    results.forEach(function(e){var c=e.cat||'';if(c)counts[c]=(counts[c]||0)+1;});
    var catNames=Object.keys(counts).sort(function(a,b){return counts[b]-counts[a]||a.localeCompare(b);});
    function draw(){
      var list=results.filter(function(e){return !state.cat||e.cat===state.cat;});
      list.sort(function(a,b){
        if(state.sort==='az')return (a.title||'').localeCompare(b.title||'');
        return state.sort==='old'?(a.id||0)-(b.id||0):(b.id||0)-(a.id||0);
      });
      svCountEl.style.display='block';
      svCountEl.textContent='Menemukan '+list.length+' script yang sesuai.';
      svGrid.innerHTML='';
      list.forEach(function(e){
        var tmp=document.createElement('div');tmp.innerHTML=window.hzCard.hzBuildCard(e);
        var cardEl=tmp.querySelector('.hz-card');if(cardEl)svGrid.appendChild(cardEl);
      });
      hzLoadViewCounts();
    }
    if(catNames.length>1){
      var chipsEl=document.getElementById('hz-sv-chips');
      var defs=[{k:'',t:'Semua'}].concat(catNames.map(function(c){return {k:c,t:c};}));
      defs.forEach(function(d){
        var b=document.createElement('button');
        b.type='button';b.className='hz-sv-chip';b.setAttribute('data-cat',d.k);
        b.setAttribute('aria-pressed',d.k===''?'true':'false');
        b.textContent=d.t;
        b.addEventListener('click',function(){
          state.cat=d.k;
          Array.prototype.forEach.call(chipsEl.children,function(x){x.setAttribute('aria-pressed',x===b?'true':'false');});
          draw();
        });
        chipsEl.appendChild(b);
      });
      chipsEl.hidden=false;
    }
    if(results.length>1){
      document.getElementById('hz-sv-sort').hidden=false;
      var sortSel=document.getElementById('hz-sv-sort-sel'),viaPointer=false;
      sortSel.addEventListener('pointerdown',function(){viaPointer=true;});
      sortSel.addEventListener('keydown',function(){viaPointer=false;});
      sortSel.addEventListener('change',function(){
        state.sort=this.value;draw();
        if(viaPointer){viaPointer=false;this.blur();} /* pilihan lewat sentuh/klik: jangan biarkan ring fokus merah menetap */
      });
    }
    draw();
  }

  if(!qVal){svCountEl.style.display='none';if(svGrid)svGrid.innerHTML='<div class="hz-cp-empty">Masukkan kata kunci pencarian.</div>';}
  else{
    hzFetchPosts(function(posts){
      var exact=hzSvMatch(posts,qVal);
      if(exact.length){svShow(exact,null);return;}
      if(exactOnly){hzBuildSuggestions(qVal,function(picked){svEmpty(picked,null);});return;}
      hzBuildSuggestions(qVal,function(picked){
        var dym=hzDidYouMean(picked);
        if(dym){
          var fixed=hzSvMatch(posts,dym.label);
          if(fixed.length){svShow(fixed,{from:qVal,to:dym.label});return;}
        }
        svEmpty(picked,dym);
      });
    });
  }
}

/* ===== Saran pencarian di header (dropdown): pencarian terakhir, hero populer, kategori, saran saat mengetik =====
   - Pencarian terakhir disimpan di localStorage key hz_sq_v1 (maks 8, terbaru di atas), hanya di browser pengunjung.
   - Data (posts/heroes/categories/hero-popular) diambil sekali saat input pertama kali difokuskan, bukan saat halaman dimuat.
   - Logika "Maksudmu" memakai hzRankSuggestions + hzDidYouMean yang sama dengan halaman hasil. */
(function(){
  var SQ_KEY='hz_sq_v1',SQ_MAX=8;
  var inputs=document.querySelectorAll('.henz-search-input,.hz-hv1-search-toggle-form input,.henz-mobile-search-pill input');
  if(!inputs.length)return;
  function sqLoad(){
    try{var a=JSON.parse(localStorage.getItem(SQ_KEY)||'[]');return Array.isArray(a)?a.filter(function(x){return typeof x==='string'&&x;}).slice(0,SQ_MAX):[];}
    catch(e){return [];}
  }
  function sqSave(a){try{localStorage.setItem(SQ_KEY,JSON.stringify(a));}catch(e){}}
  function sqRecord(t){
    t=(t||'').trim().slice(0,60);
    if(!t)return;
    var low=t.toLowerCase();
    var a=sqLoad().filter(function(x){return x.toLowerCase()!==low;});
    a.unshift(t);
    sqSave(a.slice(0,SQ_MAX));
  }
  window.hzSgRecord=sqRecord;

  var ICO={
    clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>',
    x:'<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    bulb:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/></svg>',
    search:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    arrow:'<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>'
  };
  var data=null,loading=null,panel=null,dim=null,cur=null,items=[],active=-1,uid=0,opening=null;
  function enc(s){return encodeURIComponent(s);}
  function safeUrl(u){return /^https?:\/\//i.test(u||'')?u:'';}
  function cap(s){s=s||'';return s.charAt(0).toUpperCase()+s.slice(1);}
  function hl(text,words){
    var t=String(text||'');
    if(!words||!words.length)return hzSvEsc(t);
    var re=new RegExp('('+words.map(function(w){return w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}).join('|')+')','gi');
    return t.split(re).map(function(part,i){return i%2?'<b>'+hzSvEsc(part)+'</b>':hzSvEsc(part);}).join('');
  }
  function sgLoad(cb){
    if(data){cb();return;}
    if(loading){loading.push(cb);return;}
    loading=[cb];
    Promise.all([
      new Promise(function(res){hzFetchPosts(res);}),
      fetch('/js/heroes.json?t='+Date.now()).then(function(r){return r.json();}).catch(function(){return [];}),
      fetch('/js/categories.json?t='+Date.now()).then(function(r){return r.json();}).catch(function(){return {};}),
      fetch('/js/hero-popular.json?t='+Date.now()).then(function(r){return r.json();}).catch(function(){return [];})
    ]).then(function(r){
      data={posts:r[0]||[],heroes:r[1]||[],cats:r[2]||{},popular:r[3]||[]};
      var q=loading;loading=null;
      q.forEach(function(f){f();});
    });
  }
  function ensure(){
    if(panel)return;
    dim=document.createElement('div');dim.id='hz-sg-dim';
    dim.addEventListener('click',function(){close();});
    panel=document.createElement('div');panel.id='hz-sg';
    panel.setAttribute('role','listbox');panel.setAttribute('aria-label','Saran pencarian');
    panel.addEventListener('mousedown',function(e){e.preventDefault();}); /* fokus tetap di input */
    panel.addEventListener('error',function(e){if(e.target&&e.target.tagName==='IMG')e.target.style.display='none';},true);
    panel.addEventListener('click',function(e){
      e.stopPropagation(); /* jangan ikut menutup toggle pencarian header */
      var t=e.target,el=t;
      while(el&&el!==panel&&!(el.getAttribute&&(el.getAttribute('data-act')||el.classList.contains('hz-sg-item'))))el=el.parentNode;
      if(!el||el===panel)return;
      var act=el.getAttribute('data-act');
      if(act==='del'){
        e.preventDefault();
        var a=sqLoad();a.splice(parseInt(el.getAttribute('data-i'),10),1);sqSave(a);render();
      }else if(act==='clear-recent'){
        e.preventDefault();sqSave([]);render();
      }else{
        var rec=el.getAttribute('data-rec');
        if(rec)sqRecord(rec);
      }
    });
    document.body.appendChild(dim);document.body.appendChild(panel);
  }
  function place(){
    if(!panel||!cur)return;
    var hdr=cur.closest('.hz-hv1-header,.henz-header');
    var hb=Math.round((hdr||cur).getBoundingClientRect().bottom);
    var vw=document.documentElement.clientWidth;
    var vh=window.visualViewport?window.visualViewport.height:window.innerHeight;
    var top=hb;
    if(vw<=768){panel.style.left='0';panel.style.right='0';panel.style.width='auto';}
    else{
      var r=cur.getBoundingClientRect(),w=Math.min(420,vw-24);
      panel.style.width=w+'px';panel.style.right='auto';
      panel.style.left=Math.max(12,Math.min(Math.round(r.right-w),vw-w-12))+'px';
      top=Math.round(Math.max(hb,r.bottom)+6);
    }
    panel.style.top=top+'px';
    panel.style.maxHeight=Math.max(200,vh-top-12)+'px';
    dim.style.top=hb+'px';
  }
  function isOpen(){return !!(panel&&panel.classList.contains('open'));}
  function open(inp){
    if(isOpen()&&cur===inp){place();return;} /* sudah terbuka untuk input ini: jangan render ulang (gambar berkedip) */
    if(opening===inp)return;                  /* data masih dimuat untuk input ini */
    opening=inp;ensure();cur=inp;
    sgLoad(function(){
      if(opening!==inp)return;               /* ditutup / pindah input saat data dimuat */
      opening=null;
      panel.classList.add('open');dim.classList.add('open');
      inp.setAttribute('aria-expanded','true');
      place();render();
    });
  }
  function close(){
    opening=null;
    if(!panel)return;
    panel.classList.remove('open');dim.classList.remove('open');
    if(cur){cur.setAttribute('aria-expanded','false');cur.removeAttribute('aria-activedescendant');}
    active=-1;
  }
  function sec(title,right){
    return '<div class="hz-sg-sec"><span>'+title+'</span>'+(right||'')+'</div>';
  }
  function row(href,rec,lead,title,sub){
    return '<a class="hz-sg-item hz-sg-row" role="option" href="'+href+'"'+(rec?' data-rec="'+hzSvEsc(rec)+'"':'')+'>'
      +lead+'<span class="hz-sg-txt"><span class="hz-sg-t">'+title+'</span>'+(sub?'<span class="hz-sg-s">'+sub+'</span>':'')+'</span>'+ICO.arrow+'</a>';
  }
  function avatar(h,size){
    var img=h&&safeUrl(h.image)?'<img src="'+hzSvEsc(h.image)+'" alt="" loading="lazy" decoding="async">':'';
    var nm=(h&&h.name)||'?';
    return '<span class="hz-sg-av'+(size?' hz-sg-av--'+size:'')+'"><span>'+hzSvEsc(nm.charAt(0).toUpperCase())+'</span>'+img+'</span>';
  }
  function findHero(name){
    var low=(name||'').toLowerCase();
    for(var i=0;i<data.heroes.length;i++){if(data.heroes[i].name&&data.heroes[i].name.toLowerCase()===low)return data.heroes[i];}
    return null;
  }
  function heroRow(h){
    var n=0,low=h.name.toLowerCase();
    data.posts.forEach(function(p){if((p.hero||'').toLowerCase()===low)n++;});
    var sub=cap(h.role||'')+(n?(h.role?' &middot; ':'')+n+' script':'');
    return row('/hero/'+hzDhSlugify(h.name),'',avatar(h,'sm'),hzSvEsc(h.name),sub);
  }
  function renderIdle(){
    var h='',rec=sqLoad();
    if(rec.length){
      h+=sec('Pencarian terakhir','<button type="button" class="hz-sg-clear" data-act="clear-recent">Hapus semua</button>')+'<div class="hz-sg-chips">';
      rec.forEach(function(t,i){
        h+='<span class="hz-sg-rchip"><a class="hz-sg-item hz-sg-rlink" role="option" href="/search?q='+enc(t)+'" data-rec="'+hzSvEsc(t)+'" data-del="'+i+'">'+ICO.clock+hzSvEsc(t)+'</a>'
          +'<button type="button" class="hz-sg-x" data-act="del" data-i="'+i+'" aria-label="Hapus '+hzSvEsc(t)+' dari pencarian terakhir">'+ICO.x+'</button></span>';
      });
      h+='</div>';
    }
    var pops=data.popular.slice(0,5).map(function(n){return findHero(n)||{name:n};});
    if(pops.length){
      h+=sec('Hero populer')+'<div class="hz-sg-heroes">';
      pops.forEach(function(p){
        h+='<a class="hz-sg-item hz-sg-hero" role="option" href="/hero/'+hzDhSlugify(p.name)+'">'+avatar(p)+'<span>'+hzSvEsc(p.name)+'</span></a>';
      });
      h+='</div>';
    }
    var cnt={};
    data.posts.forEach(function(p){if(p.cat)cnt[p.cat]=(cnt[p.cat]||0)+1;});
    var cats=Object.keys(cnt).sort(function(a,b){return cnt[b]-cnt[a]||a.localeCompare(b);}).slice(0,8);
    if(cats.length){
      h+=sec('Kategori')+'<div class="hz-sg-chips hz-sg-chips--cat">';
      cats.forEach(function(c){h+='<a class="hz-sg-item hz-sg-cat" role="option" href="/kategori-skin/'+hzDhSlugify(c)+'">'+hzSvEsc(c)+'</a>';});
      h+='</div>';
    }
    return h;
  }
  function renderQuery(q){
    var words=q.toLowerCase().split(/\s+/).filter(Boolean);
    var scripts=hzSvMatch(data.posts,q);
    var heroes=data.heroes.filter(function(h){
      var n=(h.name||'').toLowerCase();
      return n&&words.every(function(w){return n.indexOf(w)!==-1;});
    }).sort(function(a,b){
      return (a.name.toLowerCase().indexOf(words[0])===0?0:1)-(b.name.toLowerCase().indexOf(words[0])===0?0:1);
    }).slice(0,2);
    var dym=null,hlWords=words;
    if(!scripts.length&&!heroes.length){
      dym=hzDidYouMean(hzRankSuggestions(q,data.heroes,data.cats,data.popular));
      if(dym){
        scripts=hzSvMatch(data.posts,dym.label);
        var hh=findHero(dym.label);
        if(hh)heroes=[hh];
        hlWords=null;
      }
    }
    var h='';
    if(dym){
      h+='<a class="hz-sg-item hz-sg-dym" role="option" href="'+(dym.href.indexOf('/search')===0?'/search?q='+enc(dym.label):dym.href)+'" data-rec="'+hzSvEsc(dym.label)+'">'+ICO.bulb+'<span>Mungkin maksudmu <b>'+hzSvEsc(dym.label)+'</b>?</span></a>';
    }
    if(heroes.length){h+=sec('Hero');heroes.forEach(function(x){h+=heroRow(x);});}
    if(scripts.length){
      h+=sec('Script');
      scripts.slice(0,4).forEach(function(p){
        var th=safeUrl(p.thumb)?'<img src="'+hzSvEsc(p.thumb)+'" alt="" loading="lazy" decoding="async">':'';
        h+=row(p.url,'','<span class="hz-sg-th">'+th+'</span>',hl(p.title,hlWords),hzSvEsc(p.cat||'')+(p.date?' &middot; '+hzSvEsc(p.date):''));
      });
    }
    if(!dym&&!heroes.length&&!scripts.length)h+='<div class="hz-sg-none">Belum ada saran untuk &ldquo;'+hzSvEsc(q)+'&rdquo;.</div>';
    h+='<a class="hz-sg-item hz-sg-all" role="option" href="/search?q='+enc(q)+'" data-rec="'+hzSvEsc(q)+'">'+ICO.search+'<span>Lihat semua hasil untuk &ldquo;'+hzSvEsc(q)+'&rdquo;</span>'+ICO.arrow+'</a>';
    return h;
  }
  function render(){
    if(!panel||!cur||!data)return;
    var q=cur.value.trim();
    panel.innerHTML=q?renderQuery(q):renderIdle();
    fitCats();
    items=Array.prototype.slice.call(panel.querySelectorAll('.hz-sg-item'));
    items.forEach(function(it){it.id='hz-sg-o'+(++uid);});
    active=-1;cur.removeAttribute('aria-activedescendant');
    panel.scrollTop=0;
  }
  /* Pill kategori maksimal 2 baris: buang pill paling akhir (jumlah script paling sedikit) sampai muat */
  function fitCats(){
    var box=panel.querySelector('.hz-sg-chips--cat');
    if(!box)return;
    var chips=box.children;
    function rows(){
      var tops=[];
      for(var i=0;i<chips.length;i++){var t=chips[i].offsetTop;if(tops.indexOf(t)===-1)tops.push(t);}
      return tops.length;
    }
    while(chips.length>1&&rows()>2)box.removeChild(chips[chips.length-1]);
  }
  function setActive(n){
    if(!items.length)return;
    if(active>=0&&items[active])items[active].classList.remove('is-active');
    active=(n+items.length)%items.length;
    var it=items[active];
    it.classList.add('is-active');
    cur.setAttribute('aria-activedescendant',it.id);
    if(it.scrollIntoView)it.scrollIntoView({block:'nearest'});
  }
  Array.prototype.forEach.call(inputs,function(inp){
    inp.setAttribute('role','combobox');inp.setAttribute('aria-autocomplete','list');
    inp.setAttribute('aria-expanded','false');inp.setAttribute('aria-controls','hz-sg');
    inp.addEventListener('focus',function(){open(inp);});
    inp.addEventListener('click',function(){if(!isOpen()||cur!==inp)open(inp);});
    inp.addEventListener('input',function(){if(isOpen()&&cur===inp)render();else open(inp);});
    inp.addEventListener('keydown',function(e){
      var k=e.key;
      if(k==='ArrowDown'||k==='ArrowUp'){
        if(!isOpen()||cur!==inp){open(inp);return;}
        e.preventDefault();setActive(active<0?(k==='ArrowDown'?0:items.length-1):active+(k==='ArrowDown'?1:-1));
      }else if(k==='Enter'&&isOpen()&&active>=0&&items[active]){
        e.preventDefault();items[active].click();
      }else if(k==='Delete'&&isOpen()&&active>=0&&items[active]&&items[active].hasAttribute('data-del')){
        e.preventDefault();
        var a=sqLoad();a.splice(parseInt(items[active].getAttribute('data-del'),10),1);sqSave(a);render();
      }else if(k==='Escape'&&isOpen()){
        close();
      }
    });
  });
  /* Toggle pencarian mobile (header V1): input bisa masih terfokus saat toggle menutup, jadi event focus tidak terulang.
     Hook ini membuka dropdown saat toggle terbuka dan menutupnya saat toggle tertutup, tanpa menutup-lalu-membuka lagi. */
  var sgTb=document.getElementById('hz-hv1-search-btn');
  if(sgTb)sgTb.addEventListener('click',function(){
    setTimeout(function(){
      var w=document.getElementById('hz-hv1-search-wrap');
      var i=w&&w.classList.contains('open')?w.querySelector('input[name="q"]'):null;
      if(i)open(i);else close();
    },0);
  });
  document.addEventListener('click',function(e){
    if(!isOpen())return;
    var f=cur&&cur.form;
    if(f&&f.contains(e.target))return;
    if(sgTb&&sgTb.contains(e.target))return; /* ikon cari header V1: ditangani hook di bawah, bukan ditutup lalu dibuka lagi */
    close();
  });
  function relayout(){if(!isOpen())return;place();if(!cur.value.trim())render();} /* lebar berubah: pill kategori dihitung ulang */
  window.addEventListener('resize',relayout);
  if(window.visualViewport)window.visualViewport.addEventListener('resize',function(){if(isOpen())place();});
})();

/* Daftar Hero Page */
if(document.getElementById('hz-dh-sections')){
  var hzDhLimit=window.matchMedia('(max-width:768px)').matches?6:12;
  fetch('/js/heroes.json?t='+Date.now())
    .then(function(r){return r.json();})
    .then(function(d){hzDhInit(Array.isArray(d)?d:[]);})
    .catch(function(){hzDhInit([]);});
}

function hzDhEsc(s){
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function hzDhSlugify(name){
  return (name||'').toLowerCase().replace(/'/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-+|-+$)/g,'');
}

function hzDhBuildCard(h){
  var name=h.name||'Hero',esc=hzDhEsc(name),img=h.image||'',
    initial=esc.charAt(0).toUpperCase(),
    href='/hero/'+hzDhSlugify(name);
  var avatarH=img
    ?'<img src="'+img+'" alt="'+esc+'" loading="lazy" draggable="false" onerror="var p=this.parentNode;p.innerHTML=\''+initial+'\';p.style.cssText=\'display:flex;align-items:center;justify-content:center;font-weight:800;color:#bbb;font-family:Manrope,sans-serif;\'">'
    :initial;
  return '<a class="hz-dh-card" href="'+href+'">'
    +'<div class="hz-dh-avatar-wrap">'+avatarH+'</div>'
    +'<span class="hz-dh-name">'+esc+'</span>'
    +'</a>';
}

function hzDhInit(heroes){
  var byRole={};
  heroes.forEach(function(h){
    var r=(h.role||'').toLowerCase();
    if(!byRole[r])byRole[r]=[];
    byRole[r].push(h);
    var r2=(h.role2||'').toLowerCase();
    if(r2&&r2!==r){
      if(!byRole[r2])byRole[r2]=[];
      byRole[r2].push(h);
    }
  });
  document.querySelectorAll('.hz-dh-section').forEach(function(section){
    var role=section.getAttribute('data-role');
    var list=byRole[role]||[];
    var grid=section.querySelector('[data-role-grid]');
    var countEl=section.querySelector('[data-count]');
    var toggleBtn=section.querySelector('[data-role-toggle]');
    if(countEl)countEl.textContent=list.length?'('+list.length+')':'';
    if(!list.length){
      if(grid)grid.innerHTML='<div class="hz-dh-empty">Belum ada hero untuk role ini.</div>';
      if(toggleBtn)toggleBtn.classList.remove('show');
      return;
    }
    var expanded=false;
    function render(){
      var slice=expanded?list:list.slice(0,hzDhLimit);
      var html='';
      slice.forEach(function(h){html+=hzDhBuildCard(h);});
      if(grid)grid.innerHTML=html;
    }
    render();
    if(list.length>hzDhLimit&&toggleBtn){
      toggleBtn.classList.add('show');
      toggleBtn.addEventListener('click',function(){
        expanded=!expanded;
        toggleBtn.classList.toggle('expanded',expanded);
        toggleBtn.childNodes[0].nodeValue=expanded?'Sembunyikan':'Tampilkan Semua';
        render();
      });
    }
  });
}

/* Load More — Detail Hero & Kategori Skin.
   Semua card sudah ada di HTML sejak build (baik utk SEO), card ke-21 dst
   cuma disembunyikan via CSS (.hz-cp-limited + nth-child(n+21)). Tiap klik
   nambah HZ_CP_BATCH card (override display inline, menang atas rule CSS),
   tombol tetap tampil selama masih ada card yang disembunyikan. */
var HZ_CP_BATCH=20;
document.querySelectorAll('[data-cp-loadmore]').forEach(function(btn){
  var wrap=btn.closest('.hz-cp-loadmore-wrap');
  var grid=wrap?wrap.previousElementSibling:null;
  if(!grid||!grid.classList.contains('hz-cp-grid'))return;
  var cards=grid.querySelectorAll('.hz-card');
  var shown=HZ_CP_BATCH;
  btn.addEventListener('click',function(){
    var next=Math.min(shown+HZ_CP_BATCH,cards.length);
    for(var i=shown;i<next;i++){cards[i].style.display='flex';}
    shown=next;
    if(shown>=cards.length){
      grid.classList.remove('hz-cp-limited');
      wrap.remove();
    }
  });
});

/* Saran hero (empty state detail hero): pool kandidat (role sama, sudah punya script) disiapkan
   saat build sbg JSON di data-suggest-pool. Di sini dipilih 3 SECARA ACAK tiap page load/refresh,
   supaya variatif tapi tetap dalam role yang sama (pool-nya sudah difilter role saat build). */
function hzRenderRandomHeroSuggest(){
  var el=document.getElementById('hz-hero-suggest-tips');
  if(!el)return;
  var pool;
  try{ pool=JSON.parse(el.getAttribute('data-suggest-pool')||'[]'); }catch(e){ pool=[]; }
  if(!pool.length)return;
  for(var i=pool.length-1;i>0;i--){
    var j=Math.floor(Math.random()*(i+1));
    var tmp=pool[i];pool[i]=pool[j];pool[j]=tmp;
  }
  var picked=pool.slice(0,3);
  var html=picked.map(function(item){
    var name=(item.name||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    var slug=(item.slug||'').replace(/"/g,'&quot;');
    return '<a class="hz-sv-empty-tip" href="/hero/'+slug+'">'+name+'</a>';
  }).join('');
  el.innerHTML=html;
}
hzRenderRandomHeroSuggest();

/* ── Welcome Popup (ajakan subscribe YouTube) ──
   Muncul SETIAP SESI BARU (sessionStorage: hilang saat tab/browser ditutup,
   tapi TIDAK muncul lagi kalau cuma refresh/pindah halaman dalam sesi yang
   sama). Mulai kemunculan ke-2 (sesi ke-2 dst), ditambahkan checkbox
   "Sudah Subscribe, Jangan Tampilkan Lagi" — jumlah sesi yang sudah pernah
   menampilkan popup disimpan permanen di localStorage supaya tahu kapan
   harus mulai menampilkan checkbox itu. Kalau checkbox dicentang, popup
   berhenti tampil selamanya (localStorage optout, menang atas semuanya).
   Batas maksimal: 5 sesi/kemunculan — setelah itu berhenti otomatis
   walau checkbox tidak pernah dicentang. */
window.hzOpenWelcomePopup = function(showOptout){
  var overlay = document.getElementById('hz-welcome-popup-overlay');
  if(!overlay)return;
  var imgEl = document.getElementById('hz-welcome-popup-img');
  if(imgEl){
    var imgWrap = imgEl.closest('.hz-tooltip-imgwrap');
    if(imgWrap)imgWrap.style.display = imgEl.getAttribute('src') ? 'block' : 'none';
  }
  var optoutRow = document.getElementById('hz-welcome-popup-optout-row');
  if(optoutRow)optoutRow.style.display = showOptout ? 'flex' : 'none';
  overlay.style.display = 'flex';
  requestAnimationFrame(function(){ overlay.classList.add('open'); });
};
window.hzCloseWelcomePopup = function(){
  var overlay = document.getElementById('hz-welcome-popup-overlay');
  if(!overlay)return;
  overlay.classList.remove('open');
  setTimeout(function(){ overlay.style.display = 'none'; }, 180);
};
(function(){
  var OPTOUT_KEY = 'hz_welcome_popup_optout';
  var SESSION_SHOWN_KEY = 'hz_welcome_popup_shown';
  var SESSION_COUNT_KEY = 'hz_welcome_popup_session_count';
  var VERSION_KEY = 'hz_welcome_popup_version';
  var MAX_SESSIONS = 5;
  var overlay = document.getElementById('hz-welcome-popup-overlay');
  if(!overlay)return;

  /* ── Content-version reset ──
     Naikkan CONTENT_VERSION setiap kali konten popup berubah signifikan
     (mis. dari ajakan subscribe YouTube -> ajakan join saluran WhatsApp)
     dan ingin popup tampil lagi ke SEMUA user, termasuk yang sudah pernah
     centang "Jangan Tampilkan Lagi" atau sudah mencapai batas 5 sesi.
     Sekali versi berubah, status optout & hitungan sesi user direset ke 0,
     lalu siklus normal (max 5 sesi, checkbox muncul mulai kemunculan ke-2)
     berjalan lagi dari awal seperti user baru. */
  var CONTENT_VERSION = 'wa-channel-1';
  try{
    if(localStorage.getItem(VERSION_KEY) !== CONTENT_VERSION){
      localStorage.removeItem(OPTOUT_KEY);
      localStorage.setItem(SESSION_COUNT_KEY, '0');
      sessionStorage.removeItem(SESSION_SHOWN_KEY);
      localStorage.setItem(VERSION_KEY, CONTENT_VERSION);
    }
  }catch(e){}

  var checkbox = document.getElementById('hz-welcome-popup-optout-checkbox');
  if(checkbox){
    checkbox.addEventListener('change', function(){
      try{
        if(checkbox.checked){ localStorage.setItem(OPTOUT_KEY, '1'); }
        else{ localStorage.removeItem(OPTOUT_KEY); }
      }catch(e){}
    });
  }

  try{
    if(localStorage.getItem(OPTOUT_KEY))return;
    if(sessionStorage.getItem(SESSION_SHOWN_KEY))return;
  }catch(e){ return; }

  var sessionCount = 0;
  try{ sessionCount = parseInt(localStorage.getItem(SESSION_COUNT_KEY), 10) || 0; }catch(e){}
  if(sessionCount >= MAX_SESSIONS)return;
  var showOptout = sessionCount >= 1;

  setTimeout(function(){
    window.hzOpenWelcomePopup(showOptout);
    try{
      sessionStorage.setItem(SESSION_SHOWN_KEY, '1');
      localStorage.setItem(SESSION_COUNT_KEY, String(sessionCount + 1));
    }catch(e){}
  }, 600);
})();

})();
