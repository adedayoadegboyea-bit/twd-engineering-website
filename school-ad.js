import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";
const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const root=document.getElementById("schoolAdvert");
if(root){
  const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  const fallback={
    school_name:"TWED PRIVATE SCHOOL",
    title:"Academic Excellence, Our Pride.",
    description:"Give your child a strong foundation in learning, character and confidence at TWED Private School in Ibadan.",
    tagline:"QUALITY EDUCATION • CHARACTER • EXCELLENCE",
    cta_label:"Enquire / Apply",
    cta_url:"mailto:twedprivateschools@gmail.com",
    image_url:""
  };
  function render(a){
    const x={...fallback,...(a||{})};
    root.innerHTML='<div class="container school-ad"><div class="school-ad-copy"><span class="school-ad-kicker">'+esc(x.tagline)+'</span><h2>'+esc(x.school_name)+'<br><span>'+esc(x.title)+'</span></h2><p>'+esc(x.description)+'</p><div class="school-ad-pills"><span>Ibadan, Oyo State</span><span>0704 052 9206</span><span>0803 577 4420</span></div><div class="school-ad-actions"><a class="btn btn-gold" href="'+esc(x.cta_url)+'">'+esc(x.cta_label)+' →</a><a class="btn btn-outline-light" href="https://wa.me/2347040529206" target="_blank" rel="noopener">WhatsApp School</a></div><p class="school-ad-note">Official school contact: twedprivateschools@gmail.com</p></div><div class="school-ad-visual">'+(x.image_url?'<img class="school-ad-image" src="'+esc(x.image_url)+'" alt="'+esc(x.school_name)+'">':'')+'<div class="school-ad-badge"><strong>TWED</strong><span>PRIVATE SCHOOL</span></div></div></div>';
  }
  render();
  try{
    const {data,error}=await supabase.from("site_adverts").select("school_name,title,description,tagline,cta_label,cta_url,image_url").eq("active",true).order("priority",{ascending:false}).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(!error&&data)render(data);
  }catch(e){/* fallback advert remains visible */}
}
