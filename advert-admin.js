import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";
const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=id=>document.getElementById(id), authStatus=$("authStatus"), formStatus=$("formStatus"), panel=$("adminPanel");
const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
function status(el,msg,type=""){el.textContent=msg;el.className="admin-status show "+type}
async function isAdmin(user){
  const {data,error}=await supabase.from("profiles").select("account_type").eq("id",user.id).maybeSingle();
  if(error)throw error;
  return data?.account_type==="admin";
}
async function loadAds(){
  const {data,error}=await supabase.from("site_adverts").select("id,school_name,title,active,priority,image_url,created_at").order("created_at",{ascending:false});
  if(error)throw error;
  $("adList").innerHTML=data?.length?data.map(a=>'<div class="ad-row"><div><strong>'+esc(a.school_name)+' — '+esc(a.title)+'</strong><small>'+new Date(a.created_at).toLocaleString()+' • Priority '+esc(a.priority)+' • '+(a.active?"ACTIVE":"INACTIVE")+'</small></div><div class="ad-row-actions"><button type="button" class="btn '+(a.active?"btn-outline-light":"btn-gold")+'" data-toggle="'+esc(a.id)+'">'+(a.active?"Deactivate":"Activate")+'</button><button type="button" class="btn btn-outline-light" data-delete="'+esc(a.id)+'">Delete</button></div></div>').join(""):'<p class="admin-note">No adverts have been saved yet.</p>';
  document.querySelectorAll("[data-toggle]").forEach(b=>b.onclick=async()=>{b.disabled=true;const id=b.dataset.toggle;const row=data.find(x=>x.id===id);if(row.active){await supabase.from("site_adverts").update({active:false}).eq("id",id)}else{await supabase.from("site_adverts").update({active:false}).neq("id",id);await supabase.from("site_adverts").update({active:true}).eq("id",id)}await loadAds()});
  document.querySelectorAll("[data-delete]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this advert?"))return;b.disabled=true;const {error}=await supabase.from("site_adverts").delete().eq("id",b.dataset.delete);if(error){status(formStatus,error.message,"error");b.disabled=false;return}await loadAds()});
}
async function init(){
 try{
  const {data:{session}}=await supabase.auth.getSession();
  if(!session){status(authStatus,"Please sign in through My Account first, then open the advert manager.","error");return}
  if(!(await isAdmin(session.user))){status(authStatus,"Access denied. This area is only available to TW&D administrator accounts.","error");return}
  authStatus.className="admin-status";panel.hidden=false;await loadAds();
 }catch(e){status(authStatus,e.message||"The advert service could not be reached.","error")}
}
$("adForm").addEventListener("submit",async e=>{
 e.preventDefault();
 try{
  status(formStatus,"Publishing advert…");
  const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error("Your admin session has expired.");
  if(!(await isAdmin(session.user)))throw new Error("Administrator access is required.");
  let image_url="";
  const file=$("image").files[0];
  if(file){
   if(file.size>5*1024*1024)throw new Error("Please keep the advert image below 5 MB.");
   const safe=file.name.toLowerCase().replace(/[^a-z0-9._-]+/g,"-");
   const path=session.user.id+"/"+Date.now()+"-"+safe;
   const up=await supabase.storage.from("site-adverts").upload(path,file,{upsert:false,contentType:file.type});
   if(up.error)throw up.error;
   image_url=supabase.storage.from("site-adverts").getPublicUrl(path).data.publicUrl;
  }
  await supabase.from("site_adverts").update({active:false}).eq("active",true);
  const {error}=await supabase.from("site_adverts").insert({school_name:$("schoolName").value.trim(),title:$("adTitle").value.trim(),tagline:$("tagline").value.trim(),description:$("description").value.trim(),cta_label:$("ctaLabel").value.trim(),cta_url:$("ctaUrl").value.trim(),priority:Number($("priority").value||0),image_url,active:true,created_by:session.user.id});
  if(error)throw error;
  $("adForm").reset();$("schoolName").value="TWED PRIVATE SCHOOL";$("adTitle").value="Academic Excellence, Our Pride.";$("tagline").value="QUALITY EDUCATION • CHARACTER • EXCELLENCE";$("ctaLabel").value="Enquire / Apply";$("ctaUrl").value="mailto:twedprivateschools@gmail.com";$("priority").value=100;
  status(formStatus,"School advert published successfully.","success");await loadAds();
 }catch(e){status(formStatus,e.message||"Could not publish advert.","error")}
});
$("signout").onclick=async()=>{await supabase.auth.signOut();location.href="account.html"};
init();
