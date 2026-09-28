/* TW&D GLOBAL ACCESS NAVIGATION — unified visitor access on every public page */
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
  s.onload=function(){
    try{
      gtag('event','twd_page_ready',{page_path:location.pathname,page_title:document.title});
    }catch(e){}
  };
  document.head.appendChild(s);
})();

(function(){
  if(document.querySelector(".tw-global-access")) return;
  const root = location.pathname.includes("/recruitment/") ? "../" : "";
  const links=[
    ["HOME",root+"index.html","tw-ga-home"],
    ["ABOUT",root+"index.html#about",""],
    ["SERVICES",root+"index.html#services",""],
    ["PROJECTS",root+"projects.html",""],
    ["MARKET",root+"marketplace.html","tw-ga-market"],
    ["INSIGHTS",root+"index.html#nigeria-news",""],
    ["GALLERY",root+"index.html#gallery",""],
    ["UPDATES",root+"index.html#updates",""],
    ["TEAM",root+"index.html#team",""],
    ["CAREERS",root+"careers.html","tw-ga-careers"],
    ["ACCOUNT",root+"account.html","tw-ga-account"],
    ["CONTACT",root+"index.html#contact","tw-ga-contact"]
  ];
  const nav=document.createElement("aside");
  nav.className="tw-global-access";
  nav.setAttribute("aria-label","TW&D quick access");
  nav.innerHTML='<span class="tw-global-access-label">EXPLORE TW&D</span>'+
    links.map(function(x){return '<a href="'+x[1]+'" class="'+x[2]+'" aria-label="'+x[0]+'">'+x[0]+"</a>"}).join("");
  document.body.appendChild(nav);
})();