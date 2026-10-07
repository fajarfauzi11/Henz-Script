/* card-template.js — Satu-satunya sumber desain "hz-card" (script card).
   Dipakai di 2 environment:
   - Browser: TIDAK lagi dimuat lewat <script> terpisah. Isi file ini digabung
     otomatis oleh build.js (fungsi buildAppBundle) ke dalam dist/js/app.js,
     bareng main.js, supaya browser cuma 1x request JS. main.js tetap akses
     lewat window.hzCard seperti biasa, cuma sumbernya sekarang 1 file gabungan.
   - Build-time (Node): di-require oleh build.js buat generate halaman
     kategori & hero detail secara statis. Bagian ini TIDAK berubah.
   Ubah desain card di sini -> otomatis nyebar ke beranda, search, kategori, dan hero detail
   begitu build.js dijalankan ulang (dan otomatis ikut ke app.js juga).
*/
(function(global){
  var MONTHS_SHORT={'Januari':'Jan','Februari':'Feb','Maret':'Mar','April':'Apr','Mei':'Mei','Juni':'Jun','Juli':'Jul','Agustus':'Agu','September':'Sep','Oktober':'Okt','November':'Nov','Desember':'Des'};

  function hzEscHtml(s){
    return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function hzShortDate(str){
    var parts=(str||'').trim().split(' ');
    if(parts.length===3&&MONTHS_SHORT[parts[1]])return parts[0]+' '+MONTHS_SHORT[parts[1]]+' '+parts[2];
    return str||'';
  }

  function hzFormatViewCount(n){
    n=parseInt(n,10)||0;
    if(n>=1000000)return (Math.floor(n/100000)/10).toString().replace(/\.0$/,'')+'M';
    if(n>=1000)return (Math.floor(n/100)/10).toString().replace(/\.0$/,'')+'K';
    return n.toLocaleString('id-ID');
  }

  function hzSlugFromUrl(url){
    return (url||'').replace(/^.*\/post\//,'').replace(/\.html$/,'').replace(/\/+$/,'');
  }

  /* Bangun markup <a class="hz-card">...</a> — desain tunggal dipakai di seluruh halaman.
     Caller yang butuh wrapper swiper-slide (beranda) tinggal bungkus sendiri di luar fungsi ini. */
  function hzBuildCard(e){
    e=e||{};
    var thumb=e.thumb,label=e.cat,url=e.url,
      title=e.title||'Tanpa Judul',date=hzShortDate(e.date||''),auth=e.author||'Henz Official',
      ava=e.avatar||'https://i.ibb.co/fzWQDCf4/favicon.webp',
      esc=hzEscHtml(title);
    var imgH=thumb
      ?'<img class="hz-card-img" src="'+thumb+'" alt="'+esc+'" loading="lazy" draggable="false" onerror="this.parentNode.innerHTML=\'<div class=&quot;hz-card-no-img&quot;>No Image</div>\'">'
      :'<div class="hz-card-no-img">No Image</div>';
    return '<a class="hz-card" href="'+url+'">'
      +'<div class="hz-card-img-wrap">'+imgH+'</div>'
      +'<div class="hz-card-body">'
      +(label?'<p class="hz-card-label">'+hzEscHtml(label)+'</p>':'')
      +'<h3 class="hz-card-title" title="'+esc+'">'+esc+'</h3>'
      +'<div class="hz-card-divider"></div>'
      +'<div class="hz-card-meta">'
      +'<div class="hz-card-author">'
      +'<img class="hz-card-avatar" src="'+ava+'" alt="'+hzEscHtml(auth)+'" onerror="this.style.background=\'#e4e4e7\';this.removeAttribute(\'src\')">'
      +'<span class="hz-card-author-name">'+hzEscHtml(auth)+'</span>'+'<svg class="hz-card-verified" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      +'</div>'
      +'<div class="hz-card-pills">'
      +'<span class="hz-card-pill hz-card-views" data-view-id="'+e.id+'" data-view-slug="'+hzSlugFromUrl(e.url)+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg><span data-view-count>&ndash;</span></span>'
      +'<span class="hz-card-pill hz-card-date"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span>'+date+'</span></span>'
      +'</div>'
      +'</div></div></a>';
  }

  var api={
    hzBuildCard:hzBuildCard,
    hzShortDate:hzShortDate,
    hzFormatViewCount:hzFormatViewCount,
    hzSlugFromUrl:hzSlugFromUrl
  };

  if(typeof module!=='undefined'&&module.exports){
    module.exports=api;
  }else{
    global.hzCard=api;
  }
})(typeof window!=='undefined'?window:this);

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
  function sync(){
    if(hv1)hv1.style.top=vv.offsetTop+'px';
    if(hv2)hv2.style.top=(vv.offsetTop+hv2BaseTop())+'px';
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
    if(q&&q.value.trim())window.location.href='/search?q='+encodeURIComponent(q.value.trim());
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
    .then(function(d){cb(Array.isArray(d)?d:[]);})
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
        var sortedByComments=posts.slice().sort(function(a,b){return parseInt(b.comments||0)-parseInt(a.comments||0);});
        renderPopular(sortedByComments);
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
function hzBuildSuggestions(qVal,callback){
  Promise.all([
    fetch('/js/heroes.json?t='+Date.now()).then(function(r){return r.json();}).catch(function(){return [];}),
    fetch('/js/categories.json?t='+Date.now()).then(function(r){return r.json();}).catch(function(){return {};}),
    fetch('/js/hero-popular.json?t='+Date.now()).then(function(r){return r.json();}).catch(function(){return [];})
  ]).then(function(res){
    var heroes=res[0]||[],cats=res[1]||{},popular=res[2]||[];
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
    callback(picked.slice(0,3));
  }).catch(function(){callback([]);});
}

function hzBuildSearchEmpty(qVal){
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
    +'<div class="hz-sv-empty-tips" id="hz-sv-empty-tips"></div>'
    +'<a class="hz-sv-empty-cta" href="/request-script">Request script ini'
    +'<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>'
    +'</a></div>';
  hzBuildSuggestions(qVal,function(picked){
    var tipsEl=document.getElementById('hz-sv-empty-tips');
    if(!tipsEl)return;
    tipsEl.innerHTML=picked.map(function(item){
      return '<a class="hz-sv-empty-tip" href="'+item.href+'">'+hzSvEsc(item.label)+'</a>';
    }).join('');
  });
  return html;
}
if(document.getElementById('hz-search-heading')){
  var shWrap=document.getElementById('hz-search-heading');
  var svGrid=document.getElementById('hz-sv-grid');
  var urlParams=new URLSearchParams(window.location.search);
  var qVal=urlParams.get('q')||'';
  var qLower=qVal.toLowerCase();
  shWrap.style.display='block';
  shWrap.innerHTML='<a class="hz-sh-back" href="/" onclick="return hzSmartBack(this.getAttribute(\'href\'));">'
    +'&#8592; Halaman Sebelumnya</a>'
    +'<h1>Hasil pencarian untuk: <em>&ldquo;'+qVal.replace(/</g,'&lt;')+'&rdquo;</em></h1>'
    +'<p class="hz-sh-count" id="hz-sh-count">Memuat...</p>';
  if(!qVal){if(svGrid)svGrid.innerHTML='<div class="hz-cp-empty">Masukkan kata kunci pencarian.</div>';}
  else{
    hzFetchPosts(function(posts){
      var qWords=qLower.split(/\s+/).filter(Boolean);
      var results=posts.filter(function(e){
        var haystack=((e.title||'')+' '+(e.cat||'')+' '+(e.keywords||'')).toLowerCase();
        return qWords.every(function(w){return haystack.indexOf(w)!==-1;});
      });
      var countEl=document.getElementById('hz-sh-count');
      if(!results.length){if(countEl)countEl.style.display='none';if(svGrid)svGrid.innerHTML=hzBuildSearchEmpty(qVal);return;}
      if(countEl){countEl.style.display='block';countEl.textContent='Menemukan '+results.length+' script yang sesuai.';}
      if(svGrid){
        svGrid.innerHTML='';
        results.forEach(function(e){
          var tmp=document.createElement('div');tmp.innerHTML=window.hzCard.hzBuildCard(e);
          var cardEl=tmp.querySelector('.hz-card');if(cardEl)svGrid.appendChild(cardEl);
        });
        hzLoadViewCounts();
      }
    });
  }
}

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

;
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
