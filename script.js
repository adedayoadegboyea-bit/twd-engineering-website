const toggle=document.querySelector('.menu-toggle');
const nav=document.querySelector('#nav');
const backTop=document.querySelector('#backTop');

toggle?.addEventListener('click',()=>{
  const open=nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded',String(open));
});

document.querySelectorAll('#nav a').forEach(a=>a.addEventListener('click',()=>{
  nav.classList.remove('open');
  toggle?.setAttribute('aria-expanded','false');
}));

const sections=[...document.querySelectorAll('main section[id]')];
const navLinks=[...document.querySelectorAll('#nav a')];
const observer=new IntersectionObserver(entries=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      navLinks.forEach(link=>link.classList.toggle('active',link.getAttribute('href')==='#'+entry.target.id));
    }
  });
},{rootMargin:'-35% 0px -55% 0px',threshold:0});
sections.forEach(section=>observer.observe(section));

window.addEventListener('scroll',()=>{
  backTop?.classList.toggle('show',window.scrollY>600);
});
backTop?.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));


const newsletterForm=document.querySelector('#newsletterForm');
newsletterForm?.addEventListener('submit',(event)=>{
  event.preventDefault();
  const email=document.querySelector('#newsletterEmail')?.value.trim();
  if(!email) return;
  const subject=encodeURIComponent('TW&D Newsletter Subscription');
  const body=encodeURIComponent('Hello TW&D Engineering Consult & Services Ltd,\n\nPlease add this email address to the TW&D project/company update list:\n'+email+'\n\nThank you.');
  window.location.href='mailto:twdengineeringconsult@engineer.com?subject='+subject+'&body='+body;
});

/* Premium motion layer: subtle pointer parallax for visual depth. */
const motionTargets=[...document.querySelectorAll('.service-card,.gallery-card,.state-project,.about-image')];
const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if(!reduceMotion && window.matchMedia('(pointer:fine)').matches){
  motionTargets.forEach(card=>{
    card.addEventListener('pointermove',event=>{
      const rect=card.getBoundingClientRect();
      const x=(event.clientX-rect.left)/rect.width-.5;
      const y=(event.clientY-rect.top)/rect.height-.5;
      card.style.transform='perspective(900px) rotateX('+(-y*2.2).toFixed(2)+'deg) rotateY('+(x*2.8).toFixed(2)+'deg) translateY(-8px)';
    });
    card.addEventListener('pointerleave',()=>{card.style.transform='';});
  });
}
if(!reduceMotion){
  const hero=document.querySelector('.hero');
  window.addEventListener('scroll',()=>{
    if(!hero) return;
    const y=Math.min(window.scrollY,700);
    hero.style.backgroundPosition='center '+(50+y*0.025)+'%';
  },{passive:true});
}


/* Premium interaction update: reading progress + full-screen project gallery. */
const progressBar=document.createElement('div');
progressBar.id='scrollProgress';
progressBar.setAttribute('aria-hidden','true');
document.body.prepend(progressBar);

const updateScrollProgress=()=>{
  const max=document.documentElement.scrollHeight-window.innerHeight;
  progressBar.style.width=(max>0?(window.scrollY/max)*100:0)+'%';
};
window.addEventListener('scroll',updateScrollProgress,{passive:true});
window.addEventListener('resize',updateScrollProgress);
updateScrollProgress();

const galleryCards=[...document.querySelectorAll('.gallery-card')];
if(galleryCards.length){
  const lightbox=document.createElement('div');
  lightbox.className='gallery-lightbox';
  lightbox.setAttribute('role','dialog');
  lightbox.setAttribute('aria-modal','true');
  lightbox.setAttribute('aria-label','Project photograph viewer');
  lightbox.innerHTML='<button class="gallery-lightbox-close" type="button" aria-label="Close image viewer">×</button><img alt=""><div class="gallery-lightbox-caption"></div>';
  document.body.appendChild(lightbox);

  const viewerImg=lightbox.querySelector('img');
  const caption=lightbox.querySelector('.gallery-lightbox-caption');
  const close=()=>{
    lightbox.classList.remove('open');
    document.body.style.overflow='';
  };
  const open=(card)=>{
    const image=card.querySelector('img');
    const title=card.querySelector('figcaption strong')?.textContent || 'TW&D Project';
    const detail=card.querySelector('figcaption small')?.textContent || '';
    if(!image) return;
    viewerImg.src=image.src;
    viewerImg.alt=image.alt;
    caption.innerHTML='<strong>'+title+'</strong><span>'+detail+'</span>';
    lightbox.classList.add('open');
    document.body.style.overflow='hidden';
  };
  galleryCards.forEach(card=>{
    card.addEventListener('click',event=>{
      if(event.target.closest('a')) return;
      open(card);
    });
  });
  lightbox.querySelector('.gallery-lightbox-close').addEventListener('click',close);
  lightbox.addEventListener('click',event=>{if(event.target===lightbox) close();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape' && lightbox.classList.contains('open')) close();});
}

/* Animate the existing portfolio stat blocks into view without inventing numbers. */
const statBlocks=[...document.querySelectorAll('.stats-grid>div')];
if(!reduceMotion && statBlocks.length){
  const statObserver=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add('stat-visible');
        statObserver.unobserve(entry.target);
      }
    });
  },{threshold:.25});
  statBlocks.forEach(block=>statObserver.observe(block));
}


/* Hero motion objects are created here so the animation remains lightweight and semantic. */
const hero=document.querySelector('.hero');
if(hero && !reduceMotion){
  if(!hero.querySelector('.hero-orbit')){
    const orbit=document.createElement('div');
    orbit.className='hero-orbit';
    orbit.setAttribute('aria-hidden','true');
    orbit.innerHTML='<span class="hero-orbit-ring"></span><span class="hero-orbit-ring"></span><span class="hero-orbit-ring"></span><span class="hero-orbit-core"></span>';
    hero.appendChild(orbit);
  }
  if(!hero.querySelector('.hero-blueprint')){
    const blueprint=document.createElement('div');
    blueprint.className='hero-blueprint';
    blueprint.setAttribute('aria-hidden','true');
    hero.appendChild(blueprint);
  }
  if(!hero.querySelector('.hero-scan')){
    const scan=document.createElement('div');
    scan.className='hero-scan';
    scan.setAttribute('aria-hidden','true');
    hero.appendChild(scan);
  }

  const orbit=document.querySelector('.hero-orbit');
  const finePointer=window.matchMedia('(pointer:fine)').matches;
  if(finePointer && orbit){
    hero.addEventListener('pointermove',event=>{
      const rect=hero.getBoundingClientRect();
      const x=(event.clientX-rect.left)/rect.width-.5;
      const y=(event.clientY-rect.top)/rect.height-.5;
      orbit.style.transform='translate3d('+(x*18).toFixed(1)+'px,'+(-y*14).toFixed(1)+'px,-0px) translateY(-50%)';
    });
    hero.addEventListener('pointerleave',()=>{orbit.style.transform='translateY(-50%)';});
  }
}


/* Mobile navigation polish: close on outside tap and Escape. */
const mobileMenuToggle=document.querySelector('.menu-toggle');
const mobileNav=document.querySelector('#nav');
document.addEventListener('click',event=>{
  if(window.innerWidth<=700 && mobileNav?.classList.contains('open')){
    if(!event.target.closest('.site-header')) mobileNav.classList.remove('open');
  }
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape' && mobileNav?.classList.contains('open')){
    mobileNav.classList.remove('open');
    mobileMenuToggle?.setAttribute('aria-expanded','false');
    mobileMenuToggle?.focus();
  }
});
