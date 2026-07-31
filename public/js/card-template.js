/* card-template.js — Satu-satunya sumber desain "hz-card" (script card).
   Dipakai di 2 environment:
   - Browser: dimuat via <script src="/js/card-template.js"> (lihat partials/footer.html),
     lalu main.js akses lewat window.hzCard.
   - Build-time (Node): di-require oleh build.js buat generate halaman
     kategori & hero detail secara statis.
   Ubah desain card di sini -> otomatis nyebar ke beranda, search, kategori, dan hero detail
   begitu build.js dijalankan ulang.
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
      ava=e.avatar||'https://i.ibb.co/nstjBcMd/avatar.jpg',
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
      +'<span class="hz-card-author-name">'+hzEscHtml(auth)+'</span>'
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
