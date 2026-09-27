(function(){
  const path=(location.pathname.split("/").pop()||"index.html").toLowerCase();
  const isHome=path===""||path==="index.html";
  const isMarketplace=path==="marketplace.html";
  const isAccount=path==="account.html";
  const isCareers=path==="careers.html";
  const isProjects=path==="projects.html";
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
  if(["invoice.html","client-portal.html"].includes(path)||document.querySelector("[data-site-flow='off']")) return;
  const home="index.html";
  const links=[
    ["HOME",home],
    ["SERVICES",home+"#services"],
    ["PROJECTS","projects.html"],
    ["MARKETPLACE","marketplace.html"],
    ["INSIGHTS",home+"#nigeria-news"],
    ["MY ACCOUNT","account.html"],
    ["CONTACT",home+"#contact"]
  ];
  const bar=document.createElement("div");
  bar.className="site-flow-bar";
  bar.innerHTML='<div class="site-flow-inner"><span class="site-flow-label">TW&D NAVIGATION</span>'+links.map(([label,url])=>'<a href="'+url+'" class="'+(label==="PROJECTS"&&isProject||label==="MARKETPLACE"&&isMarketplace||label==="MY ACCOUNT"&&isAccount||label==="INSIGHTS"&&isCareers?"current":"")+'">'+label+'</a>').join("")+'</div>';
  document.body.prepend(bar);
  if(isProject){
    const title=projectPages[path];
    const hero=document.querySelector("header")||document.querySelector("main");
    const crumb=document.createElement("div");
    crumb.className="site-flow-context";
    crumb.innerHTML='<div><span>PROJECT RECORD</span><strong>'+title+'</strong></div><a href="projects.html">← All Projects</a><a class="site-flow-primary" href="'+home+'#contact">Discuss a Similar Project →</a>';
    (hero||document.body).after(crumb);
  }
  if(isMarketplace){
    const hero=document.querySelector("main")||document.body;
    const ctx=document.createElement("div");
    ctx.className="site-flow-context";
    ctx.innerHTML='<div><span>MARKETPLACE JOURNEY</span><strong>Browse → View Listing → Contact Seller / Advertise</strong></div><a href="'+home+'#contact">Need Engineering or Property Services?</a><a class="site-flow-primary" href="#listingForm">Advertise a Listing →</a>';
    hero.prepend(ctx);
  }
})();