/* HenzScript Static Site — main.js identical to Blogger theme */
(function(){

/* Year */
var kzYrEl=document.getElementById('kz-year');
if(kzYrEl)kzYrEl.textContent=new Date().getFullYear();

/* Mobile Nav Drawer (Header V2 - pill) */
(function(){
  var btn=document.getElementById('kazeo-menu-btn');
  var nav=document.getElementById('kazeo-mobile-nav');
  var headerInner=btn?btn.closest('.kazeo-header-inner'):null;
  function kzOpenDrawer(){
    nav.style.display='flex';
    var items=nav.querySelectorAll('.kz-drawer-links li,.kz-drawer-search');
    items.forEach(function(el){el.style.animation='none';el.getBoundingClientRect();el.style.animation='';});
    nav.getBoundingClientRect();
    nav.classList.add('open');
    btn.classList.add('active');
    if(headerInner)headerInner.classList.add('kz-drawer-open');
  }
  function kzCloseDrawer(){
    nav.classList.remove('open');
    btn.classList.remove('active');
    if(headerInner)headerInner.classList.remove('kz-drawer-open');
    setTimeout(function(){if(!nav.classList.contains('open'))nav.style.display='none';},280);
  }
  if(btn&&nav){
    nav.style.display='none';
    btn.addEventListener('click',function(){if(nav.classList.contains('open')){kzCloseDrawer();}else{kzOpenDrawer();}});
  }
  window.kzV2CloseDrawer=kzCloseDrawer;
  document.addEventListener('click',function(e){
    if(nav&&nav.classList.contains('open')){
      if(!nav.contains(e.target)&&e.target!==btn&&!btn.contains(e.target)){kzCloseDrawer();}
    }
  });
})();

/* Mobile Nav Dropdown (Header V1 - box) */
(function(){
  var btn=document.getElementById('kz-hv1-menu-btn');
  var nav=document.getElementById('kz-hv1-mobile-nav');
  if(!btn||!nav)return;
  function open(){nav.classList.add('open');btn.classList.add('active');btn.setAttribute('aria-expanded','true');kzHv1CloseSearch();}
  function close(){nav.classList.remove('open');btn.classList.remove('active');btn.setAttribute('aria-expanded','false');}
  function toggle(){if(nav.classList.contains('open')){close();}else{open();}}
  window.kzHv1CloseNav=close;
  btn.addEventListener('click',toggle);
  document.addEventListener('click',function(e){
    if(nav.classList.contains('open')&&!nav.contains(e.target)&&e.target!==btn&&!btn.contains(e.target)){close();}
  });
})();

/* Cegah dua penanda aktif bersamaan di dropdown nav Header V1 saat ditekan */
(function(){
  var nav=document.getElementById('kz-hv1-mobile-nav');
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
  var wrap=document.getElementById('kz-hv1-search-wrap');
  var btn=document.getElementById('kz-hv1-search-btn');
  var inner=wrap?wrap.closest('.kz-hv1-inner'):null;
  var input=wrap?wrap.querySelector('input[name="q"]'):null;
  if(!wrap||!btn)return;
  function open(){
    wrap.classList.add('open');
    if(inner)inner.classList.add('kz-search-active');
    btn.setAttribute('aria-expanded','true');
    if(window.kzHv1CloseNav)window.kzHv1CloseNav();
    if(input)input.focus({preventScroll:true});
  }
  function close(){
    wrap.classList.remove('open');
    if(inner)inner.classList.remove('kz-search-active');
    btn.setAttribute('aria-expanded','false');
  }
  window.kzHv1CloseSearch=close;
  btn.addEventListener('click',function(){if(wrap.classList.contains('open')){close();}else{open();}});
  document.addEventListener('click',function(e){
    if(wrap.classList.contains('open')&&!wrap.contains(e.target)){close();}
  });
})();

/* Sinkronkan posisi header dengan visual viewport (hindari ketutup UI browser mobile / keyboard) */
(function(){
  if(!window.visualViewport)return;
  var vv=window.visualViewport;
  var hv1=document.getElementById('kz-hv1-header');
  var hv2=document.querySelector('.kazeo-header');
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
  var sentinel=document.getElementById('kz-header-sentinel');
  var hv1=document.getElementById('kz-hv1-header');
  if(!sentinel)return;
  function positionSentinel(){if(hv1)sentinel.style.top=hv1.offsetHeight+'px';}
  positionSentinel();
  window.addEventListener('resize',positionSentinel);
  if(typeof IntersectionObserver==='undefined'){document.body.classList.add('kz-scrolled');return;}
  var switchTimer=null;
  var io=new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      var willScroll=!entry.isIntersecting;
      clearTimeout(switchTimer);
      switchTimer=setTimeout(function(){
        document.body.classList.toggle('kz-scrolled',willScroll);
        if(window.kzHv1CloseNav)window.kzHv1CloseNav();
        if(window.kzHv1CloseSearch)window.kzHv1CloseSearch();
        if(window.kzV2CloseDrawer)window.kzV2CloseDrawer();
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
  document.querySelectorAll('.kz-hv1-header input[type="text"],.kazeo-header input[type="text"]').forEach(guardScroll);
})();

/* Active nav */
function kzNormalizePath(p){
  if(!p)return '/';
  p=p.split('?')[0].split('#')[0];
  p=p.replace(/index\.html$/,'');
  p=p.replace(/\.html$/,'');
  if(p.length>1)p=p.replace(/\/$/,'');
  if(p==='')p='/';
  return p;
}
var kzCurrentPath=kzNormalizePath(window.location.pathname);
document.querySelectorAll('.kazeo-nav a,.kazeo-mobile-nav a,.kz-hv1-mobile-nav a').forEach(function(link){
  var href=kzNormalizePath(link.getAttribute('href'));
  if(href&&href===kzCurrentPath)link.classList.add('active');
});

/* Search form */
document.querySelectorAll('.kz-search-form-js').forEach(function(form){
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var q=form.querySelector('input[name="q"]');
    if(q&&q.value.trim())window.location.href='/search.html?q='+encodeURIComponent(q.value.trim());
  });
});

/* Fetch posts.json */
function kzFetchPosts(cb){
  fetch('/js/posts.json?t='+Date.now())
    .then(function(r){return r.json();})
    .then(function(d){cb(Array.isArray(d)?d:[]);})
    .catch(function(){cb([]);});
}

/* Build slider card */
function kzBuildSlide(e){
  var thumb=e.thumb,label=e.cat,url=e.url,
    title=e.title||'Tanpa Judul',date=e.date||'',auth=e.author||'Henz Official',
    ava=e.avatar||'https://i.ibb.co/nstjBcMd/avatar.jpg',
    esc=title.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  var imgH=thumb
    ?'<img class="kz-card-img" src="'+thumb+'" alt="'+esc+'" loading="lazy" draggable="false" onerror="this.parentNode.innerHTML=\'<div class=&quot;kz-card-no-img&quot;>No Image</div>\'">'
    :'<div class="kz-card-no-img">No Image</div>';
  return '<div class="swiper-slide" style="height:auto">'
    +'<a class="kz-card" href="'+url+'">'
    +'<div class="kz-card-img-wrap">'+imgH+'</div>'
    +'<div class="kz-card-body">'
    +(label?'<p class="kz-card-label">'+label+'</p>':'')
    +'<h3 class="kz-card-title" title="'+esc+'">'+esc+'</h3>'
    +'<div class="kz-card-divider"></div>'
    +'<div class="kz-card-meta">'
    +'<div class="kz-card-author">'
    +'<img class="kz-card-avatar" src="'+ava+'" alt="'+auth+'" onerror="this.style.background=\'#e4e4e7\';this.removeAttribute(\'src\')">'
    +'<span class="kz-card-author-name">'+auth+'</span>'
    +'</div>'
    +'<div class="kz-card-date-wrap"><p>'+date+'</p></div>'
    +'<p class="kz-card-views" data-view-id="'+e.id+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg><span data-view-count>&ndash;</span></p>'
    +'</div></div></a></div>';
}

/* Build category card */
function kzBuildCatCard(e){
  var thumb=e.thumb,label=e.cat,url=e.url,
    title=e.title||'Tanpa Judul',auth=e.author||'Henz Official',
    ava=e.avatar||'https://i.ibb.co/nstjBcMd/avatar.jpg',
    esc=title.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  var imgH=thumb
    ?'<img class="kz-card-img" src="'+thumb+'" alt="'+esc+'" loading="lazy" draggable="false" onerror="this.parentNode.innerHTML=\'<div class=&quot;kz-card-no-img&quot;>No Image</div>\'">'
    :'<div class="kz-card-no-img">No Image</div>';
  return '<a class="kz-card" href="'+url+'">'
    +'<div class="kz-card-img-wrap">'+imgH+'</div>'
    +'<div class="kz-card-body">'
    +(label?'<p class="kz-card-label">'+label+'</p>':'')
    +'<h3 class="kz-card-title" title="'+esc+'">'+esc+'</h3>'
    +'<div class="kz-card-divider"></div>'
    +'<div class="kz-card-meta">'
    +'<div class="kz-card-author">'
    +'<img class="kz-card-avatar" src="'+ava+'" alt="'+auth+'" onerror="this.style.background=\'#e4e4e7\';this.removeAttribute(\'src\')">'
    +'<span class="kz-card-author-name">'+auth+'</span>'
    +'</div>'
    +'<span class="kz-card-dl-btn">Download'
    +'<span class="kz-card-dl-btn-icon">'
    +'<svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M15.9959 10.0005L3 10.0005" stroke="currentColor" stroke-width="2"/><path d="M9.73389 16.3179L15.6318 9.99866L9.73389 3.67945" stroke="currentColor" stroke-width="2"/></svg>'
    +'</span></span>'
    +'<p class="kz-card-views" data-view-id="'+e.id+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg><span data-view-count>&ndash;</span></p>'
    +'</div></div></a>';
}

/* Init Swiper */
function kzInitSwiper(id){
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

/* Segmented Control */
var seg=document.getElementById('kz-seg');
var pill=document.getElementById('kz-seg-pill');
if(seg&&pill){
  var items=seg.querySelectorAll('.kz-seg-item');
  var secLatest=document.getElementById('kz-section-latest');
  var secPopular=document.getElementById('kz-section-popular');
  function movePill(btn){var pad=4;pill.style.width=btn.offsetWidth+'px';pill.style.translate=(btn.offsetLeft-pad)+'px';}
  function activate(btn){
    items.forEach(function(b){b.classList.remove('active');b.setAttribute('aria-checked','false');});
    btn.classList.add('active');btn.setAttribute('aria-checked','true');movePill(btn);
    var target=btn.getAttribute('data-target');
    if(secLatest)secLatest.style.display=(target==='kz-section-latest')?'block':'none';
    if(secPopular)secPopular.style.display=(target==='kz-section-popular')?'block':'none';
  }
  items.forEach(function(btn){btn.addEventListener('click',function(){activate(btn);});});
  if(secPopular)secPopular.style.display='none';
  requestAnimationFrame(function(){requestAnimationFrame(function(){
    var activeBtn=seg.querySelector('.kz-seg-item.active');
    if(activeBtn)movePill(activeBtn);
  });});
}

/* View Count */
function kzFormatViewCount(n){
  n=parseInt(n,10)||0;
  return n.toLocaleString('id-ID')+'x dilihat';
}
function kzLoadViewCounts(root){
  var scope=root||document;
  var els=scope.querySelectorAll('[data-view-id]');
  if(!els.length)return;
  var ids=[];
  els.forEach(function(el){
    var id=el.getAttribute('data-view-id');
    if(id&&ids.indexOf(id)===-1)ids.push(id);
  });
  if(!ids.length)return;
  fetch('/api/view?ids='+ids.join(','))
    .then(function(r){return r.json();})
    .then(function(data){
      var views=(data&&data.views)||{};
      els.forEach(function(el){
        var id=el.getAttribute('data-view-id');
        var span=el.querySelector('[data-view-count]');
        if(span)span.textContent=kzFormatViewCount(views[id]||0);
      });
    })
    .catch(function(){});
}
document.addEventListener('DOMContentLoaded',function(){kzLoadViewCounts();});
if(document.readyState==='complete'||document.readyState==='interactive')kzLoadViewCounts();

if(document.body.classList.contains('page-post')){
  kzFetchPosts(function(posts){
    var path=window.location.pathname.replace(/\/+$/,'');
    var current=posts.filter(function(p){return (p.url||'').replace(/\/+$/,'')===path;})[0];
    if(!current||!current.id)return;
    var flagKey='kz_viewed_'+current.id;
    if(sessionStorage.getItem(flagKey))return;
    fetch('/api/view',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({id:current.id})
    }).then(function(){sessionStorage.setItem(flagKey,'1');}).catch(function(){});
  });
}

/* Load Sliders */
if(document.getElementById('kz-swiper-latest')){
  kzFetchPosts(function(posts){
    var wLatest=document.getElementById('kz-latest-wrapper');
    var wPopular=document.getElementById('kz-popular-wrapper');
    if(!posts.length)return;
    var hLatest='';
    for(var i=0;i<Math.min(posts.length,12);i++)hLatest+=kzBuildSlide(posts[i]);
    if(wLatest)wLatest.innerHTML=hLatest;
    var sorted=posts.slice().sort(function(a,b){return parseInt(b.comments||0)-parseInt(a.comments||0);});
    var hPopular='';
    for(var i=0;i<Math.min(sorted.length,12);i++)hPopular+=kzBuildSlide(sorted[i]);
    if(wPopular)wPopular.innerHTML=hPopular;
    kzLoadViewCounts();
    requestAnimationFrame(function(){requestAnimationFrame(function(){
      kzInitSwiper('kz-swiper-latest');
      kzInitSwiper('kz-swiper-popular');
    });});
  });
}

/* Hero Terpopuler (Home) */
if(document.getElementById('kz-hero-popular-wrapper')){
  Promise.all([
    fetch('/js/heroes.json?t='+Date.now()).then(function(r){return r.json();}).catch(function(){return [];}),
    fetch('/js/hero-popular.json?t='+Date.now()).then(function(r){return r.json();}).catch(function(){return [];})
  ]).then(function(res){
    var heroes=Array.isArray(res[0])?res[0]:[];
    var keys=Array.isArray(res[1])?res[1]:[];
    var byName={};
    heroes.forEach(function(h){byName[(h.name||'').toLowerCase()]=h;});
    var wrapper=document.getElementById('kz-hero-popular-wrapper');
    var html='';
    keys.forEach(function(key){
      var h=byName[(key||'').toLowerCase()];
      if(!h)return;
      html+='<div class="swiper-slide" style="height:auto">'+kzDhBuildCard(h)+'</div>';
    });
    if(wrapper)wrapper.innerHTML=html||'<div class="kz-dh-empty">Belum ada hero populer.</div>';
    requestAnimationFrame(function(){requestAnimationFrame(function(){
      kzInitHeroSwiper('kz-swiper-hero-popular');
    });});
  });
}

/* Init Swiper Hero Terpopuler (config sama dengan kzInitSwiper, cuma slidesPerView disesuaikan buat kartu hero yang lebih kecil) */
function kzInitHeroSwiper(id){
  if(typeof Swiper==='undefined')return null;
  var el=document.getElementById(id);
  if(!el)return null;
  return new Swiper('#'+id,{
    slidesPerView:3,spaceBetween:10,grabCursor:true,simulateTouch:true,touchRatio:1.5,resistanceRatio:0.8,
    pagination:{el:'#'+id+' .swiper-pagination',clickable:true,dynamicBullets:true},
    breakpoints:{480:{slidesPerView:4,spaceBetween:12},768:{slidesPerView:5,spaceBetween:14},1024:{slidesPerView:6,spaceBetween:14}}
  });
}

/* Category State */
var kzCatState={labels:[]};

if(document.getElementById('kz-category-page')){
  document.getElementById('kz-category-page').classList.add('active');
  kzFetchPosts(function(posts){
    var labelMap={};
    posts.forEach(function(e){
      if(e.cat&&['Category','Community','Social'].indexOf(e.cat)===-1){
        labelMap[e.cat]=(labelMap[e.cat]||0)+1;
      }
    });
    var labels=Object.keys(labelMap).sort(function(a,b){return a.localeCompare(b);});
    kzCatState.labels=labels.map(function(n){return{name:n,count:labelMap[n]};});
    kzCatRenderTabs();
  });
}

function kzCatRenderTabs(){
  var cont=document.getElementById('kz-cp-tabs');
  if(!cont)return;
  var html='<a class="kz-cp-tab" href="/kategori/semua.html">Semua</a>';
  kzCatState.labels.forEach(function(l){
    var href='/kategori/'+kzDhSlugify(l.name)+'.html';
    html+='<a class="kz-cp-tab" href="'+href+'">'+l.name+'</a>';
  });
  cont.innerHTML=html;
}

/* Search */
function kzSvEsc(s){
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function kzBuildSearchEmpty(qVal){
  var esc=kzSvEsc(qVal);
  var html='<div class="kz-sv-empty">'
    +'<div class="kz-sv-empty-icon"><svg viewBox="0 0 96 96" fill="none">'
    +'<circle cx="40" cy="40" r="26" stroke="#e6e6e6" stroke-width="7"/>'
    +'<circle cx="40" cy="40" r="26" stroke="#e53232" stroke-width="7" stroke-dasharray="30 300" stroke-linecap="round" transform="rotate(-45 40 40)"/>'
    +'<line x1="59" y1="59" x2="82" y2="82" stroke="#e6e6e6" stroke-width="8" stroke-linecap="round"/>'
    +'<line x1="30" y1="30" x2="50" y2="50" stroke="#e53232" stroke-width="5" stroke-linecap="round"/>'
    +'<line x1="50" y1="30" x2="30" y2="50" stroke="#e53232" stroke-width="5" stroke-linecap="round"/>'
    +'</svg></div>'
    +'<div class="kz-sv-empty-title">Script tidak ditemukan</div>'
    +'<p class="kz-sv-empty-sub">Kami tidak menemukan script untuk kata kunci <b>&ldquo;'+esc+'&rdquo;</b>. Coba periksa kembali ejaannya atau gunakan kata kunci lain.</p>'
    +'<div class="kz-sv-empty-tips" id="kz-sv-empty-tips"></div>'
    +'<a class="kz-sv-empty-cta" href="/scriptrequest.html">Request script ini'
    +'<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>'
    +'</a></div>';
  fetch('/js/hero-popular.json?t='+Date.now())
    .then(function(r){return r.json();})
    .then(function(list){
      var tipsEl=document.getElementById('kz-sv-empty-tips');
      if(!tipsEl||!Array.isArray(list))return;
      tipsEl.innerHTML=list.slice(0,3).map(function(name){
        return '<a class="kz-sv-empty-tip" href="/search.html?q='+encodeURIComponent(name)+'">'+kzSvEsc(name)+'</a>';
      }).join('');
    })
    .catch(function(){});
  return html;
}
if(document.getElementById('kz-search-heading')){
  var shWrap=document.getElementById('kz-search-heading');
  var svGrid=document.getElementById('kz-sv-grid');
  var urlParams=new URLSearchParams(window.location.search);
  var qVal=urlParams.get('q')||'';
  var qLower=qVal.toLowerCase();
  shWrap.style.display='block';
  shWrap.innerHTML='<a class="kz-sh-back" href="/index.html" onclick="history.back();return false;">'
    +'&#8592; Halaman Sebelumnya</a>'
    +'<h1>Hasil pencarian untuk: <em>&ldquo;'+qVal.replace(/</g,'&lt;')+'&rdquo;</em></h1>'
    +'<p class="kz-sh-count" id="kz-sh-count">Memuat...</p>';
  if(!qVal){if(svGrid)svGrid.innerHTML='<div class="kz-cp-empty">Masukkan kata kunci pencarian.</div>';}
  else{
    kzFetchPosts(function(posts){
      var results=posts.filter(function(e){return(e.title||'').toLowerCase().indexOf(qLower)!==-1;});
      var countEl=document.getElementById('kz-sh-count');
      if(!results.length){if(countEl)countEl.style.display='none';if(svGrid)svGrid.innerHTML=kzBuildSearchEmpty(qVal);return;}
      if(countEl){countEl.style.display='block';countEl.textContent='Menemukan '+results.length+' script yang sesuai.';}
      if(svGrid){
        svGrid.innerHTML='';
        results.forEach(function(e){
          var tmp=document.createElement('div');tmp.innerHTML=kzBuildCatCard(e);
          var cardEl=tmp.querySelector('.kz-card');if(cardEl)svGrid.appendChild(cardEl);
        });
        kzLoadViewCounts();
      }
    });
  }
}

/* Daftar Hero Page */
if(document.getElementById('kz-dh-sections')){
  var kzDhLimit=window.matchMedia('(max-width:768px)').matches?6:10;
  fetch('/js/heroes.json?t='+Date.now())
    .then(function(r){return r.json();})
    .then(function(d){kzDhInit(Array.isArray(d)?d:[]);})
    .catch(function(){kzDhInit([]);});
}

function kzDhEsc(s){
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function kzDhSlugify(name){
  return (name||'').toLowerCase().replace(/'/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-+|-+$)/g,'');
}

function kzDhBuildCard(h){
  var name=h.name||'Hero',esc=kzDhEsc(name),img=h.image||'',
    initial=esc.charAt(0).toUpperCase(),
    href='/hero/'+kzDhSlugify(name)+'.html';
  var avatarH=img
    ?'<img src="'+img+'" alt="'+esc+'" loading="lazy" draggable="false" onerror="this.parentNode.innerHTML=\''+initial+'\';this.parentNode.style.cssText=\'display:flex;align-items:center;justify-content:center;font-weight:800;color:#bbb;font-family:Manrope,sans-serif;\'">'
    :initial;
  return '<a class="kz-dh-card" href="'+href+'">'
    +'<div class="kz-dh-avatar-wrap">'+avatarH+'</div>'
    +'<span class="kz-dh-name">'+esc+'</span>'
    +'</a>';
}

function kzDhInit(heroes){
  var byRole={};
  heroes.forEach(function(h){
    var r=(h.role||'').toLowerCase();
    if(!byRole[r])byRole[r]=[];
    byRole[r].push(h);
  });
  document.querySelectorAll('.kz-dh-section').forEach(function(section){
    var role=section.getAttribute('data-role');
    var list=byRole[role]||[];
    var grid=section.querySelector('[data-role-grid]');
    var countEl=section.querySelector('[data-count]');
    var toggleBtn=section.querySelector('[data-role-toggle]');
    if(countEl)countEl.textContent=list.length?'('+list.length+')':'';
    if(!list.length){
      if(grid)grid.innerHTML='<div class="kz-dh-empty">Belum ada hero untuk role ini.</div>';
      if(toggleBtn)toggleBtn.classList.remove('show');
      return;
    }
    var expanded=false;
    function render(){
      var slice=expanded?list:list.slice(0,kzDhLimit);
      var html='';
      slice.forEach(function(h){html+=kzDhBuildCard(h);});
      if(grid)grid.innerHTML=html;
    }
    render();
    if(list.length>kzDhLimit&&toggleBtn){
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

})();
