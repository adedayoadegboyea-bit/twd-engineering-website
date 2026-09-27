import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";
const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=id=>document.getElementById(id), status=$("accountStatus");
const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const list=(a,fn,e)=>a?.length?a.map(fn).join(""):e;
async function loadDashboard(user){
 $("authPanel").style.display="none"; $("setupWarning").classList.remove("show"); $("dashboardPanel").classList.add("show");
 $("welcomeName").textContent=user.user_metadata?.full_name?"Welcome, "+user.user_metadata.full_name:"Welcome";
 $("welcomeEmail").textContent=user.email||"";
 const [p,pr,r,q,n]=await Promise.all([
  supabase.from("profiles").select("account_type").eq("id",user.id).maybeSingle(),
  supabase.from("projects").select("project_name,service_type,status,progress").order("created_at",{ascending:false}).limit(5),
  supabase.from("service_requests").select("subject,status").order("created_at",{ascending:false}).limit(5),
  supabase.from("quotations").select("quotation_number,amount,currency,status").order("created_at",{ascending:false}).limit(5),
  supabase.from("notifications").select("title,message,read").order("created_at",{ascending:false}).limit(5)
 ]);
 if(p.data?.account_type) $("accountType").textContent=p.data.account_type.toUpperCase();
 $("projectsList").innerHTML=list(pr.data,x=>'<div class="portal-row"><strong>'+esc(x.project_name)+'</strong><span>'+esc(x.service_type||"Project")+' • '+esc(x.status)+' • '+(x.progress||0)+'%</span></div>','<div class="portal-empty">No projects assigned yet.</div>');
 $("requestsList").innerHTML=list(r.data,x=>'<div class="portal-row"><strong>'+esc(x.subject)+'</strong><span>'+esc(x.status)+'</span></div>','<div class="portal-empty">No service requests yet.</div>');
 $("quotesList").innerHTML=list(q.data,x=>'<div class="portal-row"><strong>'+esc(x.quotation_number||"Quotation")+'</strong><span>'+esc(x.currency)+' '+Number(x.amount||0).toLocaleString()+' • '+esc(x.status)+'</span></div>','<div class="portal-empty">No quotations yet.</div>');
 $("notificationsList").innerHTML=list(n.data,x=>'<div class="portal-row '+(x.read?"":"unread")+'"><strong>'+esc(x.title)+'</strong><span>'+esc(x.message)+'</span></div>','<div class="portal-empty">No notifications yet.</div>');
}
$("signoutButton").onclick=async()=>{await supabase.auth.signOut();location.reload()};
supabase.auth.onAuthStateChange((event,session)=>{if(session)loadDashboard(session.user)});
const {data}=await supabase.auth.getSession(); if(data.session) loadDashboard(data.session.user);