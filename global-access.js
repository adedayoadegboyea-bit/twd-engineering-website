/* Legacy entry point retained so existing pages receive the unified TW&D platform shell. */
(function(){
  if(document.querySelector('script[data-twd-platform-shell]')) return;
  var script=document.createElement('script');
  script.src='/platform-shell.js?v=20261122-unified';
  script.defer=true;
  script.setAttribute('data-twd-platform-shell','');
  document.head.appendChild(script);
})();