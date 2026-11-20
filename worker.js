import {createClient} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from "./supabase-config.js";

const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=id=>document.getElementById(id);
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const today=()=>new Date().toISOString().slice(0,10);
const time=value=>new Date(value).toLocaleString("en-NG",{timeZone:"Africa/Lagos"});
let user=null;
 workerId=null;
let workerId=null;

function notice(id,message,error=false){
 const panel=$(id);
 panel.textContent=message;
 panel.style.background=error?"#fff0f0":"#eef7ee";
}

async function openWorker(account){
 const {data,error}=await supabase.from("workers")
  .select("id,full_name,employee_code,bank_name,account_name,account_number,job_title,department,employment_status")
  .eq("user_id",account.id).maybeSingle();
 if(error){notice("loginStatus","Could not load your worker record. Try signing in again.",true);return;}
 if(data?.employment_status!=="ACTIVE"){
  notice("loginStatus","This account does not have active worker access. Contact TW&D management.",true);return;
 }

 user=account;
 workerId=data.id;
 $("loginPanel").hidden=true;
 $("portal").hidden=false;
 $("welcome").textContent="Welcome, "+(data.full_name||"Worker");
 $("workerMeta").textContent=[data.employee_code,data.job_title,data.department].filter(Boolean).join(" • ");
 $("bankDetails").innerHTML=[
  ["Bank",data.bank_name],["Account name",data.account_name],["Account number",data.account_number]
 ].map(([label,value])=>"<strong>"+label+":</strong> "+esc(value||"Not recorded")).join("<br>");
 $("reportDate").value=today();
 await loadWorkerDashboard();
}

async function loadWorkerDashboard(){
 if(!user)return;
 const account=user;
 const id=workerId;
 const [attendance,reports,payments]=await Promise.all([
  supabase.from("worker_attendance").select("check_in,check_out,status")
   .eq("worker_id",id).eq("work_date",today()).maybeSingle(),
  supabase.from("worker_reports").select("report_date,report_title,report_body,status,admin_notes")
   .eq("worker_id",id).order("report_date",{ascending:false}).limit(10),
  supabase.from("worker_payments").select("pay_period,amount,currency,status,payment_date,reference,notes")
   .eq("worker_id",id).order("created_at",{ascending:false}).limit(20)
 ]);
 if(user?.id!==account.id)return;

 const record=attendance.data;
 $("checkinForm").hidden=Boolean(record);
 $("checkout").hidden=!record||Boolean(record.check_out);
 $("attendanceToday").innerHTML=attendance.error
  ?"<p>Attendance could not be loaded.</p>"
  :record
   ?"<div class='attendance-box'><strong>"+esc(record.status)+"</strong><br>Check-in: "+time(record.check_in)
    +(record.check_out?"<br>Check-out: "+time(record.check_out):"")+"</div>"
   :"<div class='attendance-box'>Not checked in today.</div>";

 $("reports").innerHTML=reports.error?"<p>Reports could not be loaded.</p>":
  (reports.data||[]).map(row=>"<div class='report-item'><strong>"+esc(row.report_title)+"</strong><br><small>"+
   esc(row.report_date)+" • "+esc(row.status)+"</small><p>"+esc(row.report_body)+"</p>"+
   (row.admin_notes?"<small>Admin: "+esc(row.admin_notes)+"</small>":"")+"</div>").join("")||"<p>No reports yet.</p>";
 $("payments").innerHTML=payments.error?"<p>Payment records could not be loaded.</p>":
  (payments.data||[]).map(row=>"<div class='payment-item'><strong>"+esc(row.pay_period)+"</strong><br>₦"+
   Number(row.amount||0).toLocaleString("en-NG")+" • "+esc(row.status)+(row.payment_date?" • "+esc(row.payment_date):"")+
   (row.reference?"<br>Reference: "+esc(row.reference):"")+(row.notes?"<br>"+esc(row.notes):"")+"</div>").join("")||
  "<p>No payment records yet.</p>";
}

async function submit(button,statusId,pending,operation){
 if(button.disabled)return;
 button.disabled=true;
 notice(statusId,pending);
 try{await operation();}
 catch(error){notice(statusId,error?.message||"The request failed. Please try again.",true);}
 finally{button.disabled=false;}
}

$("loginForm").addEventListener("submit",event=>{
 event.preventDefault();
 submit($("workerSignIn"),"loginStatus","Signing in…",async()=>{
  const {data,error}=await supabase.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
  if(error)throw error;
  $("password").value="";
  await openWorker(data.user);
 });
});

$("signout").addEventListener("click",async()=>{
 user=null;
 $("portal").hidden=true;
 $("loginPanel").hidden=false;
 for(const id of ["bankDetails","attendanceToday","reports","payments"])$(id).replaceChildren();
 const {error}=await supabase.auth.signOut();
 if(error){notice("loginStatus","Could not confirm sign-out. Please try again.",true);return;}
 location.reload();
});

$("checkinForm").addEventListener("submit",event=>{
 event.preventDefault();
 if(!user)return;
 submit($("workerCheckin"),"status","Recording check-in…",async()=>{
  const {data,error}=await supabase.rpc("worker_check_in",{p_code:$("attendanceCode").value.trim()});
  if(error)throw error;
  $("attendanceCode").value="";
  notice("status",data?.message||"Check-in recorded.");
  await loadWorkerDashboard();
 });
});

$("checkout").addEventListener("click",()=>{
 if(!user)return;
 submit($("checkout"),"status","Recording check-out…",async()=>{
  const {data,error}=await supabase.rpc("worker_check_out");
  if(error)throw error;
  notice("status",data?.message||"Check-out recorded.");
  await loadWorkerDashboard();
 });
});

$("reportForm").addEventListener("submit",event=>{
 event.preventDefault();
 if(!user)return;
 submit($("workerReportSubmit"),"workerReportStatus","Sending report…",async()=>{
  const {error}=await supabase.from("worker_reports").insert({
   worker_id:workerId,report_date:$("reportDate").value,
   report_title:$("reportTitle").value.trim(),report_body:$("reportBody").value.trim()
  });
  if(error)throw error;
  $("reportForm").reset();
  $("reportDate").value=today();
  notice("workerReportStatus","Daily report submitted to management.");
  await loadWorkerDashboard();
 });
});

supabase.auth.getUser().then(({data})=>{if(data.user)return openWorker(data.user);})
 .catch(()=>notice("loginStatus","Could not connect to the worker portal. Try signing in again.",true));
