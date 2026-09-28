import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";
const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
let admin=null,projects=[],customers=[],requests=[],quotations=[],workers=[];
function status(t,bad=false){$("mgmtStatus").textContent=t||"";$("mgmtStatus").className="mgmt-status"+(bad?" error":"")}
function loginStatus(t,bad=false){$("loginStatus").textContent=t||"";$("loginStatus").className="mgmt-status"+(bad?" error":"")}
async function requireAdmin(){
 const {data:{session}}=await supabase.auth.getSession();
 if(!session)return false;
 const {data:p,error}=await supabase.from("profiles").select("account_type,full_name").eq("id",session.user.id).maybeSingle();
 if(error||p?.account_type!=="admin"){await supabase.auth.signOut();loginStatus("This account is not authorised for TW&D management access.",true);return false}
 admin=session.user;$("loginPanel").hidden=true;$("appPanel").hidden=false;$("signout").hidden=false;$("adminIdentity").textContent=(p.full_name||session.user.email)+" • ADMINISTRATOR";await loadAll();return true;
}
async function loadAll(){
 const [c,p,r,q,w]=await Promise.all([
  supabase.from("profiles").select("id,full_name,phone,email,account_type").order("created_at",{ascending:false}),
  supabase.from("projects").select("*").order("updated_at",{ascending:false}),
  supabase.from("service_requests").select("id,customer_id,request_type,subject,message,status,created_at,updated_at").order("created_at",{ascending:false}).limit(100),
  supabase.from("quotations").select("*").order("created_at",{ascending:false}).limit(100),
  supabase.from("workers").select("*").order("created_at",{ascending:false})
 ]);
 const firstErr=c.error||p.error||r.error||q.error||w.error;
 if(firstErr){status(firstErr.message,true);return}
 customers=c.data||[];projects=p.data||[];requests=r.data||[];quotations=q.data||[];workers=w.data||[];
 renderCustomers();renderProjects();renderRequests();renderQuotations();renderWorkers();renderWorkerAttendance();renderWorkerReports();populateCustomerSelects();populateQuoteProjects();populateWorkerSelects();
}
function renderCustomers(){
 $("customersList").innerHTML=customers.map(x=>'<div class="mgmt-row"><strong>'+esc(x.full_name||"Unnamed customer")+'</strong><span>'+esc(x.phone||"No phone")+" • "+esc(x.account_type||"customer")+" • "+esc(x.id)+'</span></div>').join("")||"<p>No accounts yet.</p>";
}
function renderProjects(){
 $("projectsList").innerHTML=projects.map(x=>'<div class="mgmt-row '+(window.selectedProjectId===x.id?"selected":"")+'" data-id="'+esc(x.id)+'"><strong>'+esc(x.project_name)+'</strong><span>'+esc(customerName(x.customer_id))+" • "+esc(x.project_code||"No code")+" • "+esc(x.status)+" • "+(x.progress||0)+"%</span></div>").join("")||"<p>No projects assigned yet.</p>";
 document.querySelectorAll("[data-id]").forEach(el=>el.onclick=()=>openProject(el.dataset.id));
}
function renderRequests(){
 $("requestsList").innerHTML=requests.map(x=>'<div class="mgmt-row"><strong>'+esc(x.subject)+'</strong><span>'+esc(customerName(x.customer_id))+" • "+esc(x.request_type||"GENERAL ENQUIRY")+" • "+esc(x.status)+"</span><small>"+esc(x.message||"")+'</small><div class="request-response"><textarea rows="2" data-response-for="'+esc(x.id)+'" placeholder="Write a response to the customer"></textarea><button class="mgmt-btn small" data-respond="'+esc(x.id)+'">Respond & Notify</button></div></div>').join("")||"<p>No service requests.</p>";
 document.querySelectorAll("[data-respond]").forEach(b=>b.onclick=()=>respondToRequest(b.dataset.respond));
}
function renderQuotations(){
 const el=document.getElementById("quotationsList");
 if(!el)return;
 el.innerHTML=quotations.map(x=>'<div class="mgmt-row"><strong>'+esc(x.quotation_number)+" • "+esc(x.status)+"</strong><span>"+esc(customerName(x.customer_id))+" • ₦"+Number(x.amount||0).toLocaleString()+"</span><small>"+esc(x.notes||"")+"</small></div>").join("")||"<p>No quotations yet.</p>";
}
function customerName(id){return customers.find(x=>x.id===id)?.full_name||id||"Unknown customer"}
function populateCustomerSelects(){const opts='<option value="">Select customer</option>'+customers.filter(x=>x.account_type!=="admin").map(x=>'<option value="'+x.id+'">'+esc(x.full_name||x.id)+'</option>').join("");$("projectCustomer").innerHTML=opts;$("quoteCustomer").innerHTML=opts}
function populateQuoteProjects(){$("quoteProject").innerHTML='<option value="">No project</option>'+projects.map(x=>'<option value="'+x.id+'">'+esc(x.project_name)+'</option>').join("")}
async function openProject(id){
 window.selectedProjectId=id;renderProjects();const p=projects.find(x=>x.id===id);if(!p)return;
 $("projectEditor").hidden=false;$("selectedProjectTitle").textContent=p.project_name;
 $("projectCustomer").value=p.customer_id||"";$("projectName").value=p.project_name||"";$("projectCode").value=p.project_code||"";$("projectService").value=p.service_type||"";$("projectLocation").value=p.location||"";$("projectStatus").value=p.status||"REQUESTED";$("projectProgress").value=p.progress||0;$("projectDescription").value=p.description||"";
 $("reportDate").value=new Date().toISOString().slice(0,10);$("reportProgress").value=p.progress||0;
 const [r,d]=await Promise.all([
  supabase.from("project_reports").select("*").eq("project_id",id).order("report_date",{ascending:false}),
  supabase.from("project_documents").select("*").eq("project_id",id).order("uploaded_at",{ascending:false})
 ]);
 if(r.error||d.error){status((r.error||d.error).message,true);return}
 $("reportsList").innerHTML='<h3>Private reports</h3>'+(r.data||[]).map(x=>'<div class="report-item"><strong>'+esc(x.report_title)+'</strong><small>'+esc(x.report_date||"")+" • "+(x.progress??"")+"%</small><div>"+esc(x.report_body).replace(/\n/g,"<br>")+"</div></div>").join("")||"<p>No reports yet.</p>";
 $("documentsList").innerHTML='<h3>Private documents</h3>'+(d.data||[]).map(x=>'<div class="mgmt-row"><strong>'+esc(x.document_name)+'</strong><span>'+esc(x.description||x.document_type||"Private project file")+" • "+new Date(x.uploaded_at).toLocaleString()+'</span><button class="mgmt-btn small doc-admin-download" data-path="'+esc(x.storage_path)+'">Download</button></div>').join("")||"<p>No private documents yet.</p>";
 document.querySelectorAll(".doc-admin-download").forEach(b=>b.onclick=()=>downloadPrivate(b));
}
async function downloadPrivate(b){b.disabled=true;b.textContent="Opening…";const {data,error}=await supabase.storage.from("project-private").createSignedUrl(b.dataset.path,300);if(error){status(error.message,true);b.disabled=false;b.textContent="Download";return}window.open(data.signedUrl,"_blank","noopener");b.disabled=false;b.textContent="Download"}
async function respondToRequest(id){
 const row=requests.find(x=>x.id===id),box=document.querySelector('[data-response-for="'+id+'"]'),message=box?.value.trim();
 if(!row||!message){status("Write a response first.",true);return}
 const up=await supabase.from("service_requests").update({status:"RESPONDED",updated_at:new Date().toISOString()}).eq("id",id);
 if(up.error){status(up.error.message,true);return}
 const n=await supabase.from("notifications").insert({customer_id:row.customer_id,title:"Response to your service request",message:"TW&D response to '"+row.subject+"': "+message});
 if(n.error){status(n.error.message,true);return}
 status("Response sent and customer notified.");await loadAll();
}
$("loginForm").onsubmit=async e=>{e.preventDefault();loginStatus("Signing in…");const {error}=await supabase.auth.signInWithPassword({email:$("adminEmail").value.trim(),password:$("adminPassword").value});if(error){loginStatus(error.message,true);return}await requireAdmin()};
$("signout").onclick=async()=>{await supabase.auth.signOut();location.reload()};
$("newProjectBtn").onclick=()=>{window.selectedProjectId=null;$("projectEditor").hidden=false;$("selectedProjectTitle").textContent="New Project";$("projectForm").reset();$("projectProgress").value=0;$("projectStatus").value="REQUESTED";$("reportForm").reset();$("reportDate").value=new Date().toISOString().slice(0,10)};
$("projectForm").onsubmit=async e=>{
 e.preventDefault();
 const payload={customer_id:$("projectCustomer").value,project_name:$("projectName").value.trim(),project_code:$("projectCode").value.trim()||null,service_type:$("projectService").value.trim(),location:$("projectLocation").value.trim(),status:$("projectStatus").value,progress:Number($("projectProgress").value),description:$("projectDescription").value.trim(),updated_at:new Date().toISOString()};
 const q=window.selectedProjectId?await supabase.from("projects").update(payload).eq("id",window.selectedProjectId):await supabase.from("projects").insert(payload).select().single();
 if(q.error){status(q.error.message,true);return}
 status("Project saved.");await loadAll();if(q.data?.id)await openProject(q.data.id);else if(window.selectedProjectId)await openProject(window.selectedProjectId);
};
$("reportForm").onsubmit=async e=>{
 e.preventDefault();if(!window.selectedProjectId)return status("Choose a project first.",true);
 const p=projects.find(x=>x.id===window.selectedProjectId),progress=$("reportProgress").value===""?(p.progress||0):Number($("reportProgress").value);
 const ins=await supabase.from("project_reports").insert({project_id:p.id,customer_id:p.customer_id,report_title:$("reportTitle").value.trim(),report_body:$("reportBody").value.trim(),progress,report_date:$("reportDate").value});
 if(ins.error){status(ins.error.message,true);return}
 const pu=await supabase.from("projects").update({progress,updated_at:new Date().toISOString()}).eq("id",p.id);if(pu.error){status(pu.error.message,true);return}
 const n=await supabase.from("notifications").insert({customer_id:p.customer_id,title:"New project progress report",message:"A new private progress report is available for "+p.project_name+" in your TW&D account."});if(n.error){status(n.error.message,true);return}
 $("reportForm").reset();$("reportDate").value=new Date().toISOString().slice(0,10);status("Private report published and customer notified.");await loadAll();await openProject(p.id);
};
$("documentForm").onsubmit=async e=>{
 e.preventDefault();if(!window.selectedProjectId)return status("Choose a project first.",true);
 const p=projects.find(x=>x.id===window.selectedProjectId),file=$("projectFile").files[0];if(!file)return;
 const path=p.id+"/"+Date.now()+"-"+file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
 const up=await supabase.storage.from("project-private").upload(path,file,{upsert:false});if(up.error){status(up.error.message,true);return}
 const ins=await supabase.from("project_documents").insert({project_id:p.id,customer_id:p.customer_id,document_name:file.name,document_type:file.type,storage_path:path});
 if(ins.error){await supabase.storage.from("project-private").remove([path]);status(ins.error.message,true);return}
 const n=await supabase.from("notifications").insert({customer_id:p.customer_id,title:"New private project document",message:"A new project document has been added to "+p.project_name+" in your secure TW&D account."});if(n.error){status(n.error.message,true);return}
 $("documentForm").reset();status("Private document uploaded and customer notified.");await openProject(p.id);
};
$("quoteForm").onsubmit=async e=>{
 e.preventDefault();const customer=$("quoteCustomer").value;
 const ins=await supabase.from("quotations").insert({customer_id:customer,project_id:$("quoteProject").value||null,quotation_number:$("quoteNumber").value.trim(),amount:Number($("quoteAmount").value),status:$("quoteStatus").value,notes:$("quoteNotes").value.trim()});
 if(ins.error){status(ins.error.message,true);return}
 const n=await supabase.from("notifications").insert({customer_id:customer,title:"Quotation update",message:"Quotation "+$("quoteNumber").value.trim()+" has been added to your TW&D account."});if(n.error){status(n.error.message,true);return}
 $("quoteForm").reset();status("Quotation saved and customer notified.");await loadAll();
};
(async()=>{await requireAdmin()})();

function renderWorkers(){
 $("workersList").innerHTML=workers.map(x=>'<div class="mgmt-row"><strong>'+esc(x.employee_code)+' • '+esc(customerName(x.id))+'</strong><span>'+esc(x.job_title||"Worker")+' • '+esc(x.department||"")+' • '+esc(x.employment_status)+'</span></div>').join("")||"<p>No workers activated yet.</p>";
}
function populateWorkerSelects(){
 const opts='<option value="">Select worker</option>'+workers.map(x=>'<option value="'+x.id+'">'+esc(x.employee_code)+' • '+esc(customerName(x.id))+'</option>').join("");
 if($("paymentWorker")) $("paymentWorker").innerHTML=opts;
 const eligible=customers.filter(x=>x.account_type!=="admin").map(x=>'<option value="'+x.id+'">'+esc(x.full_name||x.email||x.id)+' • '+esc(x.email||"")+'</option>').join("");
 if($("workerUser")) $("workerUser").innerHTML='<option value="">Select existing account</option>'+eligible;
}
async function renderWorkerAttendance(){
 const q=await supabase.from("worker_attendance").select("worker_id,work_date,check_in,check_out,status").order("work_date",{ascending:false}).limit(50);
 if(q.error){$("attendanceList").innerHTML="<p>"+esc(q.error.message)+"</p>";return}
 $("attendanceList").innerHTML=(q.data||[]).map(x=>'<div class="mgmt-row"><strong>'+esc(customerName(x.worker_id))+'</strong><span>'+esc(x.work_date)+' • '+esc(x.status)+' • '+new Date(x.check_in).toLocaleString()+(x.check_out?" • out "+new Date(x.check_out).toLocaleString():"")+'</span></div>').join("")||"<p>No attendance records.</p>";
}
async function renderWorkerReports(){
 const q=await supabase.from("worker_reports").select("worker_id,report_date,report_title,report_body,status,admin_notes").order("report_date",{ascending:false}).limit(30);
 if(q.error){$("workerReportsList").innerHTML="<p>"+esc(q.error.message)+"</p>";return}
 $("workerReportsList").innerHTML=(q.data||[]).map(x=>'<div class="mgmt-row"><strong>'+esc(x.report_title)+'</strong><span>'+esc(customerName(x.worker_id))+' • '+esc(x.report_date)+' • '+esc(x.status)+'</span><small>'+esc(x.report_body)+'</small></div>').join("")||"<p>No worker reports.</p>";
}
$("generateAttendanceCode")?.addEventListener("click",async()=>{const r=await supabase.rpc("admin_generate_attendance_code");if(r.error){$("attendanceCodeResult").textContent=r.error.message;return}$("attendanceCodeResult").textContent="TODAY'S ATTENDANCE CODE: "+r.data;await renderWorkerAttendance()});
$("workerForm")?.addEventListener("submit",async e=>{
 e.preventDefault();const id=$("workerUser").value;if(!id)return;
 const payload={id,employee_code:$("employeeCode").value.trim(),job_title:$("workerJobTitle").value.trim(),department:$("workerDepartment").value.trim(),bank_name:$("workerBank").value.trim(),account_name:$("workerAccountName").value.trim(),account_number:$("workerAccountNumber").value.trim(),employment_status:"ACTIVE"};
 const up=await supabase.from("workers").upsert(payload);if(up.error){status(up.error.message,true);return}
 const prof=await supabase.from("profiles").update({account_type:"worker"}).eq("id",id);if(prof.error){status(prof.error.message,true);return}
 status("Worker account activated. The worker can now sign in through worker.html.");await loadAll();
});
$("paymentForm")?.addEventListener("submit",async e=>{
 e.preventDefault();const r=await supabase.from("worker_payments").insert({worker_id:$("paymentWorker").value,pay_period:$("payPeriod").value.trim(),amount:Number($("paymentAmount").value),status:$("paymentStatus").value,payment_date:$("paymentDate").value||null,reference:$("paymentReference").value.trim(),notes:$("paymentNotes").value.trim()});if(r.error){status(r.error.message,true);return}$("paymentForm").reset();status("Worker payment record saved.");await loadAll();
});
