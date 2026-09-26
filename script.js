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
