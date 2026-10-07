/* TW&D GLOBAL EXPERIENCE — unified navigation + luxury rotating showcase */
/* TW&D WEBSITE ANALYTICS — Google Analytics 4 */
(function(){
  var measurementId='G-7E9WEW6LTZ';
  if(!measurementId || window.__twdGaLoaded) return;
  window.__twdGaLoaded=true;
  window.dataLayer=window.dataLayer||[];
  function gtag(){window.dataLayer.push(arguments);}
  window.gtag=gtag;
  gtag('js',new Date());
  gtag('config',measurementId,{anonymize_ip:true,allow_google_signals:false});
  var s=document.createElement('script');
  s.async=true;
  s.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(measurementId);
  s.onload=function(){try{gtag('event','twd_page_ready',{page_path:location.pathname,page_title:document.title});}catch(e){}};
  document.head.appendChild(s);
})();

(function(){
  if(document.querySelector('.tw-global-access')) return;
  var root=location.pathname.includes('/recruitment/')?'../':'';
  /* This intentionally mirrors the main website navigation, rather than older page-specific shortcuts. */
  var links=[
    ['HOME',root+'index.html','tw-ga-home'],
    ['ABOUT',root+'index.html#about',''],
    ['SERVICES',root+'index.html#services',''],
    ['PROJECTS',root+'projects.html',''],
    ['INSIGHT',root+'news.html',''],
    ['MARKET',root+'marketplace.html','tw-ga-market'],
    ['CAREERS',root+'careers.html','tw-ga-careers'],
    ['JOBS HUB',root+'jobs.html',''],
    ['CLIENT',root+'client-portal.html',''],
    ['ACCOUNT',root+'account.html','tw-ga-account'],
    ['RESOURCES',root+'professional-resources.html',''],
    ['CONTACT',root+'index.html#contact','tw-ga-contact']
  ];
  var nav=document.createElement('aside');
  nav.className='tw-global-access';
  nav.setAttribute('aria-label','TW&D website quick access');
  nav.innerHTML='<span class="tw-global-access-label">EXPLORE TW&D</span>'+links.map(function(x){return '<a href="'+x[1]+'" class="'+x[2]+'" aria-label="'+x[0]+'">'+x[0]+'</a>';}).join('');
  document.body.appendChild(nav);
})();

(function(){
  if(document.querySelector('.twd-prestige-rail')) return;
  var isHome=location.pathname==='/' || /\/index\.html$/i.test(location.pathname);
  if(isHome) document.body.classList.add('twd-home-page');
  var root=location.pathname.includes('/recruitment/')?'../':'';
  var items=[
    ['ENGINEERING','Engineering consultancy & technical delivery',root+'index.html#services'],
    ['CONSTRUCTION','Building construction & civil works',root+'services.html#building'],
    ['SOLAR SYSTEMS','Solar inverter & battery solutions',root+'services.html#solar'],
    ['PROJECTS','Project records & completed works',root+'projects.html'],
    ['PROPERTY','Property development & real estate',root+'services.html#property'],
    ['SURVEY','Geotechnical survey & site investigation',root+'services.html#geotechnical'],
    ['BOREHOLE','Borehole drilling & water solutions',root+'services.html#borehole'],
    ['MARKETPLACE','Buy, sell & discover listings',root+'marketplace.html'],
    ['CAREERS','Join TW&D & recruitment opportunities',root+'careers.html'],
    ['JOBS HUB','Live opportunities across Nigeria',root+'jobs.html'],
    ['CLIENT PORTAL','Project & client access',root+'client-portal.html'],
    ['PRO RESOURCES','COREN, NSE & built-environment bodies',root+'professional-resources.html'],
    ['INSIGHT','TW&D bulletin, news & updates',root+'news.html'],
    ['MOBILE APP','TW&D on Android',root+'app-download.html'],
    ['CONTACT','Start a project with TW&D',root+'index.html#contact']
  ];
  var rail=document.createElement('section');
  rail.className='twd-prestige-rail'+(isHome?' twd-prestige-home':'');
  rail.setAttribute('aria-label','TW&D featured services and website highlights');
  rail.innerHTML='<div class="twd-prestige-inner"><div class="twd-prestige-mark"><span>TW&D</span><small>ENGINEER • BUILD • DELIVER</small></div><div class="twd-prestige-stage" aria-live="polite">'+items.map(function(x,i){return '<a class="twd-prestige-card" data-index="'+i+'" href="'+x[2]+'"><span>'+String(i+1).padStart(2,'0')+'</span><strong>'+x[0]+'</strong><small>'+x[1]+'</small><b>EXPLORE →</b></a>';}).join('')+'</div><div class="twd-prestige-controls"><button type="button" class="twd-prestige-prev" aria-label="Previous highlight">‹</button><div class="twd-prestige-dots">'+items.map(function(_,i){return '<i data-dot="'+i+'"></i>';}).join('')+'</div><button type="button" class="twd-prestige-next" aria-label="Next highlight">›</button></div></div>';
  var header=document.querySelector('.site-header');
  if(header && header.parentNode) header.parentNode.insertBefore(rail,header.nextSibling); else document.body.insertBefore(rail,document.body.firstChild);
  var cards=[].slice.call(rail.querySelectorAll('.twd-prestige-card'));
  var dots=[].slice.call(rail.querySelectorAll('.twd-prestige-dots i'));
  var current=0,timer=null;
  function render(){cards.forEach(function(card,i){var d=(i-current+items.length)%items.length;if(d>items.length/2)d-=items.length;card.className='twd-prestige-card '+(d===0?'is-active':d===-1?'is-prev':d===1?'is-next':'is-hidden');});dots.forEach(function(dot,i){dot.classList.toggle('is-active',i===current);});}
  function next(){current=(current+1)%items.length;render();}
  function prev(){current=(current-1+items.length)%items.length;render();}
  function start(){if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;clearInterval(timer);timer=setInterval(next,3300);}
  function stop(){clearInterval(timer);timer=null;}
  rail.querySelector('.twd-prestige-next').addEventListener('click',function(){next();start();});
  rail.querySelector('.twd-prestige-prev').addEventListener('click',function(){prev();start();});
  rail.addEventListener('mouseenter',stop);rail.addEventListener('mouseleave',start);rail.addEventListener('focusin',stop);rail.addEventListener('focusout',start);
  dots.forEach(function(dot,i){dot.addEventListener('click',function(){current=i;render();start();});});
  render();start();
})();
