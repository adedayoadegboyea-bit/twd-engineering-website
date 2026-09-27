const HOME_MARKETPLACE_ENDPOINT = "https://script.google.com/macros/s/AKfycbzyZ5-txUUqM-O9T0RysHtcTQDfZAz2pgERT3NeKgGSJHnNaql-ZmKmguOYP2TT1IH5/exec";

(function initHomeSalesFlash(){
  const box=document.getElementById("homeSalesFlash");
  if(!box) return;

  const title=box.querySelector(".home-sales-flash-title");
  const meta=box.querySelector(".home-sales-flash-meta");
  const close=box.querySelector(".home-sales-flash-close");
  const link=box.querySelector(".home-sales-flash-link");
  let items=[];
  let index=0;
  let hideTimer=null;
  let rotateTimer=null;
  let dismissed=false;

  const money=value=>{
    const n=Number(value||0);
    return n>0 ? new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:0}).format(n) : "Price on request";
  };
  const clean=value=>String(value??"").replace(/[<>]/g,"").trim();

  function showNext(){
    if(dismissed || !items.length) return;
    const item=items[index%items.length];
    index++;
    title.textContent=clean(item.title)||"New marketplace listing";
    const parts=[clean(item.category),clean(item.location),money(item.price)].filter(Boolean);
    meta.textContent=parts.join(" • ");
    link.href="marketplace.html";
    box.hidden=false;
    requestAnimationFrame(()=>box.classList.add("is-visible"));
    clearTimeout(hideTimer);
    hideTimer=setTimeout(()=>{
      box.classList.remove("is-visible");
      setTimeout(()=>{ if(!box.classList.contains("is-visible")) box.hidden=true; },320);
    },6500);
  }

  close.addEventListener("click",()=>{
    dismissed=true;
    clearTimeout(hideTimer);
    clearInterval(rotateTimer);
    box.classList.remove("is-visible");
    setTimeout(()=>box.hidden=true,320);
  });

  async function load(){
    try{
      const response=await fetch(HOME_MARKETPLACE_ENDPOINT+"?action=listings&_="+Date.now(),{cache:"no-store"});
      if(!response.ok) return;
      const data=await response.json();
      if(!data || !Array.isArray(data.listings)) return;
      items=data.listings.filter(item=>{
        const seller=clean(item.seller).toLowerCase();
        const images=Array.isArray(item.images)&&item.images.length ? item.images : (item.image ? [item.image] : []);
        const blocked=seller.includes("tw&d")||seller.includes("twd engineering")||seller.includes("marketplace demo")||seller.includes("system test");
        return !blocked && images.length>0 && clean(item.title);
      });
      if(!items.length) return;
      setTimeout(showNext,4000);
      rotateTimer=setInterval(showNext,12000);
    }catch(error){
      console.log("Home marketplace flash is not available.",error);
    }
  }

  load();
})();