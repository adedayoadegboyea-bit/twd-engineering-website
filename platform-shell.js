/* TW&D unified platform navigation. All destinations stay on the main domain. */
(function(){
  if(document.body.hasAttribute('data-homepage') || document.querySelector('.twd-platform-header') || document.querySelector('.site-header')) return;
  var legacy=document.querySelector('.ds-header, .account-header, .mgmt-header, body > .top');
  var links=[
    ['Home','/'],['About','/about.html'],['Services','/services.html'],
    ['Design Studio','/design-studio.html'],['Workspace','/workspace.html'],
    ['Projects','/projects.html'],['Marketplace','/marketplace.html'],
    ['My Account','/account.html'],['Careers','/careers.html'],['Contact','/#contact']
  ];
  var current=location.pathname.split('/').pop() || 'index.html';
  var header=document.createElement('header');
  header.className='twd-platform-header';
  header.innerHTML='<div class="twd-platform-inner"><a class="twd-platform-brand" href="/"><img src="/assets/twd-luxury-logo.svg" alt="TW&D Engineering Consult & Services Ltd"><span>ENGINEER · BUILD · DELIVER</span></a><button class="twd-platform-toggle" type="button" aria-expanded="false" aria-controls="twdPlatformNav">Menu <span aria-hidden="true">☰</span></button><nav id="twdPlatformNav" class="twd-platform-nav" aria-label="TW&D main navigation">'+links.map(function(item){var active=current===item[1]?' aria-current="page"':'';return '<a href="'+item[1]+'"'+active+'>'+item[0]+'</a>';}).join('')+'</nav></div>';
  if(legacy){legacy.hidden=true;legacy.setAttribute('aria-hidden','true');}
  document.body.insertBefore(header,document.body.firstChild);
  var toggle=header.querySelector('.twd-platform-toggle'),nav=header.querySelector('.twd-platform-nav');
  toggle.addEventListener('click',function(){var open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));nav.toggleAttribute('data-open',open);});
  nav.addEventListener('click',function(e){if(e.target.closest('a')){toggle.setAttribute('aria-expanded','false');nav.removeAttribute('data-open');}});
  var style=document.createElement('style');
  style.textContent='.twd-platform-header{position:relative;z-index:1000;background:#071f45;color:#fff;border-bottom:1px solid rgba(201,155,56,.4);box-shadow:0 8px 28px rgba(4,20,42,.12);font-family:Inter,Arial,sans-serif}.twd-platform-inner{max-width:1440px;min-height:82px;margin:auto;padding:10px 28px;display:flex;align-items:center;justify-content:space-between;gap:24px}.twd-platform-brand{display:flex;align-items:center;gap:12px;color:#fff;text-decoration:none;min-width:170px}.twd-platform-brand img{width:132px;height:auto;max-height:60px;object-fit:contain}.twd-platform-brand span{font-size:8px;letter-spacing:1.5px;color:#e8c46e;font-weight:800;white-space:nowrap}.twd-platform-nav{display:flex;align-items:center;justify-content:flex-end;gap:clamp(9px,1.25vw,20px);flex-wrap:wrap}.twd-platform-nav a{color:#edf3fc;text-decoration:none;font-size:12px;font-weight:700;white-space:nowrap;padding:9px 2px;border-bottom:2px solid transparent}.twd-platform-nav a:hover,.twd-platform-nav a[aria-current=page]{color:#f0c66a;border-color:#c99b38}.twd-platform-toggle{display:none;border:1px solid #c99b38;background:transparent;color:#fff;border-radius:8px;padding:10px 13px;font:700 13px Inter,Arial,sans-serif}.tw-global-access,.twd-prestige-rail{display:none!important}@media(max-width:980px){.twd-platform-inner{min-height:70px;padding:8px 16px}.twd-platform-brand img{width:112px}.twd-platform-brand span{display:none}.twd-platform-toggle{display:block}.twd-platform-nav{display:none;position:absolute;top:100%;left:0;right:0;padding:12px 16px 18px;background:#071f45;border-top:1px solid rgba(255,255,255,.12);box-shadow:0 14px 24px rgba(0,0,0,.2);grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 12px}.twd-platform-nav[data-open]{display:grid}.twd-platform-nav a{padding:12px;border-bottom:1px solid rgba(255,255,255,.1);white-space:normal}}';
  document.head.appendChild(style);
})();