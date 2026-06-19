/* HenzScript Static Site — main.js identical to Blogger theme */
(function(){

/* Year */
var kzYrEl=document.getElementById('kz-year');
if(kzYrEl)kzYrEl.textContent=new Date().getFullYear();

/* Mobile Nav Drawer */
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
  document.addEventListener('click',function(e){
    if(nav&&nav.classList.contains('open')){
      if(!nav.contains(e.target)&&e.target!==btn&&!btn.contains(e.target)){kzCloseDrawer();}
    }
  });
})();

/* Active nav */
var path=window.location.pathname;
document.querySelectorAll('.kazeo-nav a,.kazeo-mobile-nav a').forEach(function(link){
  var href=link.getAttribute('href');
  if(href&&(path===href||path===href.replace(/index\.html$/,'')))link.classList.add('active');
  if((path==='/'||path==='/index.html')&&href==='/index.html')link.classList.add('active');
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
    requestAnimationFrame(function(){requestAnimationFrame(function(){
      kzInitSwiper('kz-swiper-latest');
      kzInitSwiper('kz-swiper-popular');
    });});
  });
}

/* Category State */
var kzCatState={labels:[],activeTab:'semua',entries:[],allEntries:[],page:0,perPage:12};

if(document.getElementById('kz-category-page')){
  document.getElementById('kz-category-page').classList.add('active');
  kzCatShowSkeleton(8);
  kzFetchPosts(function(posts){
    var labelMap={};
    posts.forEach(function(e){
      if(e.cat&&['Category','Community','Social'].indexOf(e.cat)===-1){
        labelMap[e.cat]=(labelMap[e.cat]||0)+1;
      }
    });
    kzCatState.allEntries=posts;
    var labels=Object.keys(labelMap).sort(function(a,b){return a.localeCompare(b);});
    kzCatState.labels=labels.map(function(n){return{name:n,count:labelMap[n]};});
    kzCatRenderTabs();
    kzCatSelectTab('semua');
  });
  var lmBtn=document.getElementById('kz-cp-loadmore-btn');
  if(lmBtn)lmBtn.addEventListener('click',function(){kzCatRenderPage();});
}

function kzCatRenderTabs(){
  var cont=document.getElementById('kz-cp-tabs');
  if(!cont)return;
  var html='<button class="kz-cp-tab active" data-tab="semua">Semua</button>';
  kzCatState.labels.forEach(function(l){
    html+='<button class="kz-cp-tab" data-tab="'+l.name.replace(/"/g,'&quot;')+'">'+l.name+'</button>';
  });
  cont.innerHTML=html;
  cont.querySelectorAll('.kz-cp-tab').forEach(function(tab){
    tab.addEventListener('click',function(){
      var t=this.getAttribute('data-tab');
      cont.querySelectorAll('.kz-cp-tab').forEach(function(x){x.classList.remove('active');});
      this.classList.add('active');
      kzCatSelectTab(t);
    });
  });
}

function kzCatSelectTab(tab){
  kzCatState.activeTab=tab;kzCatState.page=0;kzCatState.entries=[];
  var countEl=document.getElementById('kz-cp-count');
  var lmWrap=document.getElementById('kz-cp-loadmore');
  if(countEl){countEl.style.display='none';countEl.textContent='';}
  if(lmWrap)lmWrap.style.display='none';
  kzCatState.entries=tab==='semua'?kzCatState.allEntries:kzCatState.allEntries.filter(function(e){return e.cat===tab;});
  kzCatShowGrid();
}

function kzCatShowGrid(){
  var grid=document.getElementById('kz-cp-grid');
  var countEl=document.getElementById('kz-cp-count');
  var lmWrap=document.getElementById('kz-cp-loadmore');
  if(!grid)return;
  var total=kzCatState.entries.length;
  if(countEl){countEl.style.display=total?'block':'none';countEl.textContent=total+' script ditemukan';}
  if(!total){grid.innerHTML='<div class="kz-cp-empty">Tidak ada postingan ditemukan.</div>';if(lmWrap)lmWrap.style.display='none';return;}
  grid.innerHTML='';kzCatState.page=0;kzCatRenderPage();
}

function kzCatShowSkeleton(n){
  var grid=document.getElementById('kz-cp-grid');if(!grid)return;
  var h='';
  for(var i=0;i<n;i++)h+='<div class="kz-cp-skel"><div class="kz-cp-skel-img"></div><div class="kz-cp-skel-body"><div class="kz-cp-skel-line sm"></div><div class="kz-cp-skel-line"></div><div class="kz-cp-skel-line xs"></div></div></div>';
  grid.innerHTML=h;
}

function kzCatRenderPage(){
  var grid=document.getElementById('kz-cp-grid');
  var lmWrap=document.getElementById('kz-cp-loadmore');
  if(!grid)return;
  var entries=kzCatState.entries,perPage=kzCatState.perPage,start=kzCatState.page*perPage;
  var slice=entries.slice(start,start+perPage);
  kzCatState.page++;
  slice.forEach(function(e){
    var tmp=document.createElement('div');tmp.innerHTML=kzBuildCatCard(e);
    var cardEl=tmp.querySelector('.kz-card');if(cardEl)grid.appendChild(cardEl);
  });
  var hasMore=(kzCatState.page*perPage)<entries.length;
  if(lmWrap)lmWrap.style.setProperty('display',hasMore?'block':'none','important');
}

/* Search */
if(document.getElementById('kz-search-heading')){
  var shWrap=document.getElementById('kz-search-heading');
  var svGrid=document.getElementById('kz-sv-grid');
  var urlParams=new URLSearchParams(window.location.search);
  var qVal=urlParams.get('q')||'';
  var qLower=qVal.toLowerCase();
  shWrap.style.display='block';
  shWrap.innerHTML='<a class="kz-sh-back" href="/index.html">'
    +'&#8592; Kembali ke Beranda</a>'
    +'<h1>Hasil pencarian untuk: <em>&ldquo;'+qVal.replace(/</g,'&lt;')+'&rdquo;</em></h1>'
    +'<p class="kz-sh-count" id="kz-sh-count">Memuat...</p>';
  if(!qVal){if(svGrid)svGrid.innerHTML='<div class="kz-cp-empty">Masukkan kata kunci pencarian.</div>';}
  else{
    kzFetchPosts(function(posts){
      var results=posts.filter(function(e){return(e.title||'').toLowerCase().indexOf(qLower)!==-1;});
      var countEl=document.getElementById('kz-sh-count');
      if(countEl)countEl.textContent='Menemukan '+results.length+' script yang sesuai.';
      if(!results.length){if(svGrid)svGrid.innerHTML='<div class="kz-cp-empty">Tidak ada script yang cocok.</div>';return;}
      if(svGrid){
        svGrid.innerHTML='';
        results.forEach(function(e){
          var tmp=document.createElement('div');tmp.innerHTML=kzBuildCatCard(e);
          var cardEl=tmp.querySelector('.kz-card');if(cardEl)svGrid.appendChild(cardEl);
        });
      }
    });
  }
}

})();
