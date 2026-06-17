/* Partials Loader — fetch header & footer from single source */
(function(){
  function kzLoadPartial(url, mountId, cb){
    var mount=document.getElementById(mountId);
    if(!mount){if(cb)cb();return;}
    fetch(url).then(function(res){return res.text();}).then(function(html){
      mount.outerHTML=html;
      if(cb)cb();
    }).catch(function(){if(cb)cb();});
  }
  var pending=2;
  function done(){
    pending--;
    if(pending===0){
      var s=document.createElement('script');
      s.src='/js/main.js';
      document.body.appendChild(s);
    }
  }
  kzLoadPartial('/partials/header.html','kz-header-mount',done);
  kzLoadPartial('/partials/footer.html','kz-footer-mount',done);
})();
