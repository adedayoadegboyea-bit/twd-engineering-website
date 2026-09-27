import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";

const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const list=(a,fn,e)=>a?.length?a.map(fn).join(""):e;
const status=$("accountStatus"), portalStatus=$("portalStatus"), setup=$("setupWarning");
let recoveryMode=false,currentUser=null;

function msg(text,type=""){status.textContent=text;status.className="account-status show "+type}
function pmsg(text,type=""){portalStatus.textContent=text;portalStatus.className="portal-status show "+type}
function err(e){
 const m=String(e?.message||"").toLowerCase();
 if(m.includes("user already registered"))return"An account already exists with this email address.";
 if(m.includes("invalid login credentials"))return"The email or password is incorrect.";
 if(m.includes("password should be at least"))return"Please use a stronger password.";
 if(m.includes("unable to validate email address"))return"Please enter a valid email address.";
 if(m.includes("rate limit"))return"Too many requests. Please wait a little and try again.";
 if(m.includes("email not confirmed"))return"Please confirm your email address before signing in.";
 return e?.message||"The request could not be completed.";
}
function showSignedOut(){
 $("authPanel").style.display="";
 $("dashboardPanel").classList.remove("show");
}
function showRecoveryMode(){
 recoveryMode=true;$("authPanel").style.display="";$("dashboardPanel").classList.remove("show");
 $("passwordResetPanel").hidden=false;$("signinForm").hidden=true;$("signupForm").hidden=true;
 document.querySelector(".account-tabs").style.display="none";msg("Enter a new password for your TW&D account.");
}
async function loadDashboard(user){
 currentUser=user;
 $("authPanel").style.display="none";setup.classList.remove("show");$("dashboardPanel").classList.add("show");
 const name=user.user_metadata?.full_name||"";
 $("welcomeName").textContent=name?"Welcome, "+name:"Welcome";
 $("welcomeEmail").textContent=user.email||"";
 $("profileName").value=name;
 $("profilePhone").value=user.user_metadata?.phone||"";
 $("profileEmail").value=user.email||"";
 const [p,pr,r,q,n]=await Promise.all([
  supabase.from("profiles").select("account_type,full_name,phone").eq("id",user.id).maybeSingle(),
  supabase.from("projects").select("project_name,service_type,status,progress").order("created_at",{ascending:false}).limit(5),
  supabase.from("service_requests").select("subject,status").order("created_at",{ascending:false}).limit(5),
  supabase.from("quotations").select("quotation_number,amount,currency,status").order("created_at",{ascending:false}).limit(5),
  supabase.from("notifications").select("id,title,message,read").order("created_at",{ascending:false}).limit(5)
 ]);
 if(p.data?.account_type)$("accountType").textContent=p.data.account_type.toUpperCase();
 if(p.data?.full_name&&!name){$("profileName").value=p.data.full_name;$("welcomeName").textContent="Welcome, "+p.data.full_name}
 if(p.data?.phone&&!$("profilePhone").value)$("profilePhone").value=p.data.phone;
 $("projectsList").innerHTML=list(pr.data,x=>'<div class="portal-row"><strong>'+esc(x.project_name)+'</strong><span>'+esc(x.service_type||"Project")+" • "+esc(x.status)+" • "+(x.progress||0)+"%</span></div>",'<div class="portal-empty">No projects assigned yet.</div>');
 $("requestsList").innerHTML=list(r.data,x=>'<div class="portal-row"><strong>'+esc(x.subject)+'</strong><span>'+esc(x.status)+"</span></div>",'<div class="portal-empty">No service requests yet.</div>');
 $("quotesList").innerHTML=list(q.data,x=>'<div class="portal-row"><strong>'+esc(x.quotation_number||"Quotation")+'</strong><span>'+esc(x.currency)+" "+Number(x.amount||0).toLocaleString()+" • "+esc(x.status)+"</span></div>",'<div class="portal-empty">No quotations yet.</div>');
 $("notificationsList").innerHTML=list(n.data,x=>'<div class="portal-row '+(x.read?"":"unread")+'"><strong>'+esc(x.title)+'</strong><span>'+esc(x.message)+"</span></div>",'<div class="portal-empty">No notifications yet.</div>');
}
$("showSignup").onclick=()=>{$("signupForm").hidden=false;$("signinForm").hidden=true;$("showSignup").classList.add("active");$("showSignin").classList.remove("active");status.className="account-status"};
$("showSignin").onclick=()=>{$("signupForm").hidden=true;$("signinForm").hidden=false;$("showSignup").classList.remove("active");$("showSignin").classList.add("active");status.className="account-status"};
$("signupForm").addEventListener("submit",async e=>{
 e.preventDefault();
 const name=$("signupName").value.trim(),email=$("signupEmail").value.trim(),phone=$("signupPhone").value.trim(),password=$("signupPassword").value,confirm=$("signupConfirm").value;
 if(password!==confirm)return msg("The passwords do not match.","error");
 try{
  msg("Creating your secure account…");
  const {data,error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin+"/account.html",data:{full_name:name,phone}}});
  if(error)throw error;
  if(data.session){msg("Account created successfully. You are now signed in.","success");await loadDashboard(data.user)}
  else{msg("Account created. Please check your email and confirm your address before signing in.","success");$("signupForm").reset();$("showSignin").click();$("signinEmail").value=email}
 }catch(e){msg(err(e),"error")}
});
$("signinForm").addEventListener("submit",async e=>{
 e.preventDefault();
 try{msg("Signing you in securely…");const {data,error}=await supabase.auth.signInWithPassword({email:$("signinEmail").value.trim(),password:$("signinPassword").value});if(error)throw error;await loadDashboard(data.user);msg("Signed in successfully.","success")}catch(e){msg(err(e),"error")}
});
$("forgotPassword").onclick=async()=>{
 const email=$("signinEmail").value.trim();if(!email)return msg("Enter your email address first.","error");
 try{const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+"/account.html"});if(error)throw error;msg("Password-reset instructions have been sent to your email.","success")}catch(e){msg(err(e),"error")}
};
$("passwordResetForm").addEventListener("submit",async e=>{
 e.preventDefault();const password=$("newPassword").value,confirm=$("newPasswordConfirm").value;if(password!==confirm)return msg("The passwords do not match.","error");
 try{msg("Updating your password…");const {error}=await supabase.auth.updateUser({password});if(error)throw error;recoveryMode=false;$("passwordResetPanel").hidden=true;$("signinForm").hidden=false;document.querySelector(".account-tabs").style.display="";msg("Your password has been updated. You can now sign in.","success");await supabase.auth.signOut()}catch(e){msg(err(e),"error")}
});
$("signoutButton").onclick=async()=>{await supabase.auth.signOut();location.reload()};
$("serviceRequestForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!currentUser)return;
 try{
  pmsg("Sending your request…");
  const {error}=await supabase.from("service_requests").insert({customer_id:currentUser.id,request_type:$("requestType").value,subject:$("requestSubject").value.trim(),message:$("requestMessage").value.trim()});
  if(error)throw error;
  $("serviceRequestForm").reset();pmsg("Your service request has been sent to TW&D. We will review it through the customer service process.","success");await loadDashboard(currentUser);
 }catch(e){pmsg(err(e),"error")}
});
$("profileForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!currentUser)return;
 try{
  pmsg("Saving your profile…");
  const name=$("profileName").value.trim(),phone=$("profilePhone").value.trim();
  const {error}=await supabase.from("profiles").update({full_name:name,phone}).eq("id",currentUser.id);
  if(error)throw error;
  const {error:authError}=await supabase.auth.updateUser({data:{full_name:name,phone}});
  if(authError)throw authError;
  currentUser.user_metadata={...(currentUser.user_metadata||{}),full_name:name,phone};
  $("welcomeName").textContent="Welcome, "+name;pmsg("Profile updated successfully.","success");
 }catch(e){pmsg(err(e),"error")}
});
$("markNotificationsRead").onclick=async()=>{
 if(!currentUser)return;
 try{
  const {error}=await supabase.from("notifications").update({read:true}).eq("customer_id",currentUser.id).eq("read",false);
  if(error)throw error;pmsg("Notifications marked as read.","success");await loadDashboard(currentUser);
 }catch(e){pmsg(err(e),"error")}
};
supabase.auth.onAuthStateChange((event,session)=>{
 if(event==="PASSWORD_RECOVERY"){showRecoveryMode();return}
 if(session?.user&&!recoveryMode)loadDashboard(session.user);else if(!recoveryMode)showSignedOut();
});
(async()=>{
 try{const {data,error}=await supabase.auth.getSession();if(error)throw error;if(data.session&&!recoveryMode)await loadDashboard(data.session.user)}
 catch(e){setup.classList.add("show");msg("The account service could not be reached. Please try again later.","error")}
})();