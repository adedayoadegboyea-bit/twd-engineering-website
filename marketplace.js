const listings=[
 {id:"demo-1",category:"Houses",location:"Ibadan, Oyo",title:"Modern 4-Bedroom Family Home",price:65000000,image:"assets/completed-building-01.jpg",seller:"TW&D Marketplace Demo",phone:"08035774420",condition:"For Sale"},
 {id:"demo-2",category:"Land",location:"Ogun State",title:"Residential Land Opportunity",price:12000000,image:"assets/project-08.jpg",seller:"TW&D Marketplace Demo",phone:"08035774420",condition:"For Sale"},
 {id:"demo-3",category:"Building Materials",location:"Ibadan, Oyo",title:"Building & Finishing Materials",price:0,image:"assets/building.jpg",seller:"TW&D Engineering",phone:"08035774420",condition:"New"},
 {id:"demo-4",category:"Home Gadgets",location:"Lagos",title:"Home Improvement & Interior Items",price:0,image:"assets/marble-bathroom.jpeg",seller:"TW&D Marketplace Demo",phone:"08035774420",condition:"New"}
];
const grid=document.querySelector("#listingGrid"),empty=document.querySelector("#empty");
const money=n=>n?new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:0}).format(n):"Contact seller";
function render(){
 const q=(document.querySelector("#search").value||"").toLowerCase(),cat=document.querySelector("#category").value,loc=document.querySelector("#location").value;
 const rows=listings.filter(x=>(!q||(x.title+" "+x.category+" "+x.location).toLowerCase().includes(q))&&(!cat||x.category===cat)&&(!loc||x.location.toLowerCase().includes(loc.toLowerCase())));
 grid.innerHTML=rows.map(x=>`<article class="listing"><img src="${x.image}" alt="${x.title}" loading="lazy"><div class="listing-body"><span class="tag">${x.category}</span><h3>${x.title}</h3><div class="price">${money(x.price)}</div><div class="meta">${x.location} • ${x.condition}</div><a href="https://wa.me/2348035774420?text=${encodeURIComponent("Hello TW&D Marketplace, I am interested in: "+x.title)}" target="_blank" rel="noopener">Ask about this listing →</a></div></article>`).join("");
 empty.hidden=rows.length>0;
}
["#search","#category","#location"].forEach(s=>document.querySelector(s).addEventListener("input",render));
render();

const form=document.querySelector("#listingForm");
form.addEventListener("submit",async e=>{
 e.preventDefault();
 const status=document.querySelector("#formStatus"),files=[...form.photos.files];
 if(files.some(f=>f.size>5*1024*1024)){status.textContent="Each photo must be 5 MB or smaller.";return;}
 status.textContent="Preparing your listing…";
 const payload={};new FormData(form).forEach((v,k)=>{if(k!=="photos")payload[k]=v});
 payload.photos=[];
 for(const file of files){payload.photos.push({name:file.name,type:file.type,size:file.size,data:await toBase64(file)});}
 const endpoint="https://script.google.com/macros/s/AKfycbzyZ5-txUUqM-O9T0RysHtcTQDfZAz2pgERT3NeKgGSJHnNaql-ZmKmguOYP2TT1IH5/exec";
 if(endpoint.startsWith("PASTE_")){status.textContent="Your listing form is ready. The marketplace administrator still needs to connect the secure publishing backend.";return;}
 try{const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload)});const j=await r.json();status.textContent=j.message||"Listing submitted for review.";if(j.ok)form.reset();}catch(err){status.textContent="Submission could not be completed. Please try again or contact TW&D.";}
});
function toBase64(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(",")[1]);r.onerror=reject;r.readAsDataURL(file);});}

document.querySelectorAll("[data-plan]").forEach(btn=>btn.addEventListener("click",()=>{
 const plan=btn.dataset.plan;
 const endpoint="https://script.google.com/macros/s/AKfycbzyZ5-txUUqM-O9T0RysHtcTQDfZAz2pgERT3NeKgGSJHnNaql-ZmKmguOYP2TT1IH5/exec";
 if(endpoint.startsWith("PASTE_")){alert(plan+" selected. Payment gateway setup is the next step before live subscription payments can be collected.");return;}
 window.location.href=endpoint+"?action=subscribe&plan="+encodeURIComponent(plan);
}));