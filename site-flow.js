(function(){
  const path=(location.pathname.split("/").pop()||"index.html").toLowerCase();
  const home="index.html";
  const projectPages={
    "royal-garden-estate.html":"Royal Garden Estate",
    "oore-ofe-jagun.html":"Oore-Ofe Jagun",
    "first-dammy-school-lagos.html":"First Dammy School Lagos",
    "tella-akobo.html":"Tella, Akobo",
    "oloola-akingbade.html":"Oloola, Akingbade",
    "ajoda-estate.html":"Ajoda Estate",
    "view-point-hotel.html":"View Point Hotel",
    "six-bedroom-duplex-idi-ishin.html":"6-Bedroom Duplex — Idi-Ishin"
  };
  const isProject=!!projectPages[path];
  const isMarketplace=path==="marketplace.html";
  const privateOrExcluded=["invoice.html","client-portal.html",""].includes(path);
  if(document.querySelector("[data-site-flow='off']")) return;

  // Persistent visitor incentives: keep the key journeys visible while visitors scroll.
  // These are intentionally public navigation links; no private account data is exposed here.
  if(!privateOrExcluded&&!document.querySelector(".luxury-explore-dock")){
    const dock=document.createElement("div");
    dock.className="luxury-explore-dock";
    dock.setAttribute("aria-label","Quick access");
    dock.innerHTML='<span class="luxury-explore-label">EXPLORE</span>'
      +'<a href="marketplace.html" class="luxury-explore-link marketplace-link"><span>MARKETPLACE</span><b>↗</b></a>'
      +'<a href="index.html#nigeria-news" class="luxury-explore-link insights-link"><span>INSIGHTS</span><b>↓</b></a>'
      +'<a href="careers.html" class="luxury-explore-link careers-link"><span>CAREERS</span><b>↗</b></a>'
      +'<a href="account.html" class="luxury-explore-link account-link"><span>MY ACCOUNT</span><b>↗</b></a>';
    document.body.appendChild(dock);
  }

  if(!isProject&&!isMarketplace)return;

  if(isProject){
    const links=[["HOME",home],["SERVICES",home+"#services"],["PROJECTS","projects.html"],["MARKETPLACE","marketplace.html"],["INSIGHTS",home+"#nigeria-news"],["MY ACCOUNT","account.html"],["CONTACT",home+"#contact"]];
    const bar=document.createElement("div");
    bar.className="site-flow-bar";
    bar.innerHTML='<div class="site-flow-inner"><span class="site-flow-label">TW&D NAVIGATION</span>'+links.map(([label,url])=>'<a href="'+url+'" class="'+(label==="PROJECTS"?"current":"")+'">'+label+'</a>').join("")+'</div>';
    document.body.prepend(bar);
    const title=projectPages[path];
    const crumb=document.createElement("div");
    crumb.className="site-flow-context";
    crumb.innerHTML='<div><span>PROJECT RECORD</span><strong>'+title+'</strong></div><a href="projects.html">← All Projects</a><a href="'+home+'#contact">Discuss a Similar Project →</a>';
    const anchor=document.querySelector("header")||document.querySelector("main");
    (anchor||document.body).after(crumb);
  }

  if(isMarketplace){
    const ctx=document.createElement("div");
    ctx.className="site-flow-context";
    ctx.innerHTML='<div><span>MARKETPLACE JOURNEY</span><strong>Browse listings → open a listing → contact seller or advertise</strong></div><a href="'+home+'#contact">Need Engineering Services?</a><a class="site-flow-primary" href="#listingForm">Advertise a Listing →</a>';
    const main=document.querySelector("main")||document.body;
    main.prepend(ctx);
  }
})();