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
