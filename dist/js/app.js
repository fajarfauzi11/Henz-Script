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
      document.getElementById('hz-sv-sort-sel').addEventListener('change',function(){state.sort=this.value;draw();});
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
  var data=null,loading=null,panel=null,dim=null,cur=null,items=[],active=-1,uid=0;
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
    ensure();cur=inp;
    sgLoad(function(){
      if(cur!==inp)return;
      panel.classList.add('open');dim.classList.add('open');
      inp.setAttribute('aria-expanded','true');
      place();render();
    });
  }
  function close(){
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
    var pops=data.popular.slice(0,4).map(function(n){return findHero(n)||{name:n};});
    if(pops.length){
      h+=sec('Hero populer')+'<div class="hz-sg-heroes">';
      pops.forEach(function(p){
        h+='<a class="hz-sg-item hz-sg-hero" role="option" href="/hero/'+hzDhSlugify(p.name)+'">'+avatar(p)+'<span>'+hzSvEsc(p.name)+'</span></a>';
      });
      h+='</div>';
    }
    var cnt={};
    data.posts.forEach(function(p){if(p.cat)cnt[p.cat]=(cnt[p.cat]||0)+1;});
    var cats=Object.keys(cnt).sort(function(a,b){return cnt[b]-cnt[a]||a.localeCompare(b);}).slice(0,5);
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
    items=Array.prototype.slice.call(panel.querySelectorAll('.hz-sg-item'));
    items.forEach(function(it){it.id='hz-sg-o'+(++uid);});
    active=-1;cur.removeAttribute('aria-activedescendant');
    panel.scrollTop=0;
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
  /* Toggle pencarian mobile: input bisa masih terfokus saat toggle menutup, jadi event focus tidak terulang.
     Buka dropdown eksplisit setiap toggle dibuka lewat tombol. */
  var sgTb=document.getElementById('hz-hv1-search-btn');
  if(sgTb)sgTb.addEventListener('click',function(){
    setTimeout(function(){
      var w=document.getElementById('hz-hv1-search-wrap');
      var i=w&&w.classList.contains('open')?w.querySelector('input[name="q"]'):null;
      if(i)open(i);
    },0);
  });
  document.addEventListener('click',function(e){
    if(!isOpen())return;
    var f=cur&&cur.form;
    if(f&&f.contains(e.target))return;
    close();
  });
  window.addEventListener('resize',function(){if(isOpen())place();});
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

;
/* floating-menu.js — Menu melayang (tombol pengaturan di pojok kanan bawah) + Riwayat Script.
   Markup: public/partials/floating-menu.html (disisipkan build.js di semua halaman).
   File ini digabung ke dist/js/app.js oleh build.js (buildAppBundle), jadi tidak ada request JS tambahan.

   Riwayat disimpan di localStorage (key: hz_history_v1), hanya di perangkat/browser ini:
   [{u:'/post/slug', t:'Judul', i:'https://thumb', ts:1700000000000}, ...] — terbaru di urutan pertama.
   - Dicatat otomatis saat halaman post dibuka (post draft/noindex TIDAK dicatat).
   - Membuka ulang script yang sama memindahkannya ke paling atas.
   - Maksimal 30 entri. Entri yang post-nya sudah tidak ada di posts.json dibuang saat modal dibuka.

   Switch Mode Gelap (key hz_theme) juga ditangani di sini; lihat blok "Mode Gelap" di init().

   PWA ("Install Aplikasi"): blok "PWA" di bawah mendaftarkan /sw.js dan mengatur atribut <html data-pwa>:
   - "prompt" = Chromium (Chrome/Edge/Samsung Internet) sudah memicu beforeinstallprompt -> tombol memanggil prompt bawaan.
   - "ios"    = iPhone/iPad -> tidak ada prompt bawaan, tombol membuka modal petunjuk (#hz-fm-ios).
   - tidak ada = tidak bisa/tidak perlu (sudah terpasang, mode aplikasi, atau browser tanpa dukungan) -> baris disembunyikan CSS. */
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
        else if(iosOpen()){ closeIos(); }
        else if(panelOpen()){ closePanel(); btn.focus(); }
        return;
      }
      var trap = overlay.classList.contains('open') ? overlay : (iosOpen() ? iosOverlay : null);
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

;
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
