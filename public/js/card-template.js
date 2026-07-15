/* card-template.js — Satu-satunya sumber desain "kz-card" (script card).
   Dipakai di 2 environment:
   - Browser: dimuat via <script src="/js/card-template.js"> (lihat partials/footer.html),
     lalu main.js akses lewat window.kzCard.
   - Build-time (Node): di-require oleh build.js buat generate halaman
     kategori & hero detail secara statis.
   Ubah desain card di sini -> otomatis nyebar ke beranda, search, kategori, dan hero detail
   begitu build.js dijalankan ulang.
*/
(function(global){
  var MONTHS_SHORT={'Januari':'Jan','Februari':'Feb','Maret':'Mar','April':'Apr','Mei':'Mei','Juni':'Jun','Juli':'Jul','Agustus':'Agu','September':'Sep','Oktober':'Okt','November':'Nov','Desember':'Des'};

  function kzEscHtml(s){
    return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function kzShortDate(str){
    var parts=(str||'').trim().split(' ');
    if(parts.length===3&&MONTHS_SHORT[parts[1]])return parts[0]+' '+MONTHS_SHORT[parts[1]]+' '+parts[2];
    return str||'';
  }

  function kzFormatViewCount(n){
    n=parseInt(n,10)||0;
    if(n>=1000000)return (Math.floor(n/100000)/10).toString().replace(/\.0$/,'')+'M';
    if(n>=1000)return (Math.floor(n/100)/10).toString().replace(/\.0$/,'')+'K';
    return n.toLocaleString('id-ID');
  }

  function kzSlugFromUrl(url){
    return (url||'').replace(/^.*\/post\//,'').replace(/\.html$/,'').replace(/\/+$/,'');
  }

  /* Bangun markup <a class="kz-card">...</a> — desain tunggal dipakai di seluruh halaman.
     Caller yang butuh wrapper swiper-slide (beranda) tinggal bungkus sendiri di luar fungsi ini. */
  function kzBuildCard(e){
    e=e||{};
    var thumb=e.thumb,label=e.cat,url=e.url,
      title=e.title||'Tanpa Judul',date=kzShortDate(e.date||''),auth=e.author||'Henz Official',
      ava=e.avatar||'https://i.ibb.co/nstjBcMd/avatar.jpg',
      esc=kzEscHtml(title);
    var imgH=thumb
      ?'<img class="kz-card-img" src="'+thumb+'" alt="'+esc+'" loading="lazy" draggable="false" onerror="this.parentNode.innerHTML=\'<div class=&quot;kz-card-no-img&quot;>No Image</div>\'">'
      :'<div class="kz-card-no-img">No Image</div>';
    return '<a class="kz-card" href="'+url+'">'
      +'<div class="kz-card-img-wrap">'+imgH+'</div>'
      +'<div class="kz-card-body">'
      +(label?'<p class="kz-card-label">'+kzEscHtml(label)+'</p>':'')
      +'<h3 class="kz-card-title" title="'+esc+'">'+esc+'</h3>'
      +'<div class="kz-card-divider"></div>'
      +'<div class="kz-card-meta">'
      +'<div class="kz-card-author">'
      +'<img class="kz-card-avatar" src="'+ava+'" alt="'+kzEscHtml(auth)+'" onerror="this.style.background=\'#e4e4e7\';this.removeAttribute(\'src\')">'
      +'<span class="kz-card-author-name">'+kzEscHtml(auth)+'</span>'
      +'</div>'
      +'<div class="kz-card-pills">'
      +'<span class="kz-card-pill kz-card-views" data-view-id="'+e.id+'" data-view-slug="'+kzSlugFromUrl(e.url)+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg><span data-view-count>&ndash;</span></span>'
      +'<span class="kz-card-pill kz-card-date"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span>'+date+'</span></span>'
      +'</div>'
      +'</div></div></a>';
  }

  var api={
    kzBuildCard:kzBuildCard,
    kzShortDate:kzShortDate,
    kzFormatViewCount:kzFormatViewCount,
    kzSlugFromUrl:kzSlugFromUrl
  };

  if(typeof module!=='undefined'&&module.exports){
    module.exports=api;
  }else{
    global.kzCard=api;
  }
})(typeof window!=='undefined'?window:this);
