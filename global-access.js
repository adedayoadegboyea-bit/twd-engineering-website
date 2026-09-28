/* TW&D GLOBAL ACCESS NAVIGATION */
(function(){
  if(document.querySelector(".tw-global-access")) return;
  const root = location.pathname.includes("/recruitment/") ? "../" : "";
  const links=[
    ["HOME",root+"index.html","tw-ga-home"],
    ["ABOUT",root+"index.html#about",""],
    ["SERVICES",root+"index.html#services",""],
    ["PROJECTS",root+"projects.html",""],
    ["MARKET",root+"marketplace.html",""],
    ["INSIGHTS",root+"index.html#nigeria-news",""],
    ["CAREERS",root+"careers.html",""],
    ["ACCOUNT",root+"account.html","tw-ga-account"],
    ["CONTACT",root+"index.html#contact","tw-ga-contact"]
  ];
  const nav=document.createElement("aside");
  nav.className="tw-global-access";
  nav.setAttribute("aria-label","TW&D quick access");
  nav.innerHTML='<span class="tw-global-access-label">EXPLORE TW&D</span>'+links.map(function(x){return '<a href="'+x[1]+'" class="'+x[2]+'" aria-label="'+x[0]+'">'+x[0]+"</a>"}).join("");
  document.body.appendChild(nav);
})();
