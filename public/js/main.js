/* HenzScript Static Site — main.js identical to Blogger theme */
(function(){

/* Year */
var hzYrEl=document.getElementById('hz-year');
if(hzYrEl)hzYrEl.textContent=new Date().getFullYear();

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
    .then(function(data){
      var views=(data&&data.views)||{};
      els.forEach(function(el){
        var id=el.getAttribute('data-view-id');
        var span=el.querySelector('[data-view-count]');
        if(span)span.textContent=window.hzCard.hzFormatViewCount(views[id]||0);
      });
    })
    .catch(function(){});
}
document.addEventListener('DOMContentLoaded',function(){hzLoadViewCounts();});
if(document.readyState==='complete'||document.readyState==='interactive')hzLoadViewCounts();

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
    hzLoadViewCounts();

    function renderPopular(sortedPosts){
      var popularSlides=[];
      for(var i=0;i<Math.min(sortedPosts.length,10);i++)popularSlides.push(hzBuildSlide(sortedPosts[i]));
      hzSwapSlides(hzSwiperPopular,popularSlides);
      hzLoadViewCounts();
    }

    var items=posts.map(function(p){return p.id+':'+window.hzCard.hzSlugFromUrl(p.url);});
    fetch('/api/view?items='+encodeURIComponent(items.join(',')))
      .then(function(r){if(!r.ok)throw new Error('view api error');return r.json();})
      .then(function(data){
        var views=(data&&data.views)||{};
        var sortedByViews=posts.slice().sort(function(a,b){
          return (parseInt(views[b.id],10)||0)-(parseInt(views[a.id],10)||0);
        });
        renderPopular(sortedByViews);
      })
      .catch(function(){
        var sortedByComments=posts.slice().sort(function(a,b){return parseInt(b.comments||0)-parseInt(a.comments||0);});
        renderPopular(sortedByComments);
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
  shWrap.innerHTML='<a class="hz-sh-back" href="/" onclick="history.back();return false;">'
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

})();
