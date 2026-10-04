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
  supabase.from("profiles").select("id,full_name,phone,account_type").order("created_at",{ascending:false}),
  supabase.from("projects").select("*").order("updated_at",{ascending:false}),
  supabase.from("service_requests").select("id,customer_id,request_type,subject,message,status,created_at,updated_at").order("created_at",{ascending:false}).limit(100),
  supabase.from("quotations").select("*").order("created_at",{ascending:false}).limit(100),
  supabase.from("workers").select("*").order("created_at",{ascending:false})
 ]);
 const firstErr=c.error||p.error||r.error||q.error||w.error;
 if(firstErr){status(firstErr.message,true);return}
 customers=c.data||[];projects=p.data||[];requests=r.data||[];quotations=q.data||[];workers=w.data||[];
 renderCustomers();renderProjects();renderRequests();renderQuotations();renderWorkers();renderWorkerAttendance();renderWorkerReports();populateCustomerSelects();populateQuoteProjects();populateWorkerSelects();loadPortfolio();
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

async function portfolioUploadFile(file,folder){
  const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
  const path=folder+"/"+Date.now()+"-"+Math.random().toString(36).slice(2,8)+"-"+safe;
  const up=await supabase.storage.from("public-portfolio").upload(path,file,{upsert:false,contentType:file.type});
  if(up.error)throw up.error;
  const pub=supabase.storage.from("public-portfolio").getPublicUrl(path);
  return {path,url:pub.data.publicUrl};
}
async function loadPortfolio(){
  const p=await supabase.from("portfolio_projects").select("*").order("updated_at",{ascending:false});
  const g=await supabase.from("portfolio_gallery").select("*").order("created_at",{ascending:false}).limit(100);
  if(p.error||g.error){
    const msg=(p.error||g.error).message||"Portfolio database is not ready.";
    if($("portfolioStatus")){ $("portfolioStatus").textContent=msg+" Run the supplied Supabase portfolio setup SQL once."; $("portfolioStatus").className="mgmt-status error"; }
    return;
  }
  renderPortfolioProjects(p.data||[]);
  renderPortfolioGallery(g.data||[]);
}
function renderPortfolioProjects(rows){
  const box=$("portfolioProjectsList"); if(!box)return;
  box.innerHTML=rows.map(x=>"<div class='mgmt-row'><strong>"+esc(x.title)+"</strong><span>"+esc(x.state)+" • "+esc(x.category||"")+" • "+esc(x.status)+"</span><small>"+esc(x.location||"")+" • "+esc(x.completion_date||"")+"</small><button type='button' class='mgmt-btn small portfolio-archive' data-id='"+esc(x.id)+"'>"+(x.status==="ARCHIVED"?"Archived":"Archive")+"</button></div>").join("")||"<p>No portfolio projects yet.</p>";
  box.querySelectorAll(".portfolio-archive").forEach(b=>b.onclick=async()=>{
    if(!confirm("Archive this public project?"))return;
    const q=await supabase.from("portfolio_projects").update({status:"ARCHIVED",updated_at:new Date().toISOString()}).eq("id",b.dataset.id);
    if(q.error){portfolioStatus(q.error.message,true);return}
    portfolioStatus("Project archived.");await loadPortfolio();
  });
}
function renderPortfolioGallery(rows){
  const box=$("portfolioGalleryList"); if(!box)return;
  box.innerHTML=rows.map(x=>"<div class='mgmt-row portfolio-gallery-row'><img src='"+esc(x.image_url)+"' alt='"+esc(x.title||"Gallery image")+"' loading='lazy'><strong>"+esc(x.title||"Untitled gallery image")+"</strong><span>"+esc(x.category||"")+" • "+esc(x.status)+"</span><small>"+esc(x.caption||"")+"</small><button type='button' class='mgmt-btn small portfolio-delete-gallery' data-id='"+esc(x.id)+"' data-url='"+esc(x.image_url)+"'>Remove</button></div>").join("")||"<p>No gallery items yet.</p>";
  box.querySelectorAll(".portfolio-delete-gallery").forEach(b=>b.onclick=async()=>{
    if(!confirm("Remove this gallery image from the public website?"))return;
    const q=await supabase.from("portfolio_gallery").delete().eq("id",b.dataset.id);
    if(q.error){portfolioStatus(q.error.message,true);return}
    portfolioStatus("Gallery item removed.");await loadPortfolio();
  });
}
function portfolioStatus(t,bad=false){const el=$("portfolioStatus");if(el){el.textContent=t||"";el.className="mgmt-status"+(bad?" error":"")}}
$("refreshPortfolio")?.addEventListener("click",loadPortfolio);
$("portfolioProjectForm")?.addEventListener("submit",async e=>{
  e.preventDefault();portfolioStatus("Creating project record and uploading photographs…");
  try{
    const files=Array.from($("portfolioProjectFiles").files||[]);
    if(!files.length)throw Error("Select at least one project photograph.");
    const q=await supabase.from("portfolio_projects").insert({
      title:$("portfolioTitle").value.trim(),state:$("portfolioState").value.trim(),location:$("portfolioLocation").value.trim()||null,
      category:$("portfolioCategory").value,client:$("portfolioClient").value.trim()||null,description:$("portfolioDescription").value.trim()||null,
      completion_date:$("portfolioDate").value||null,project_value:$("portfolioValue").value?Number($("portfolioValue").value):null,status:$("portfolioProjectStatus").value
    }).select().single();
    if(q.error)throw q.error;
    const project=q.data,uploaded=[];
    try{
      for(let i=0;i<files.length;i++){portfolioStatus("Uploading photograph "+(i+1)+" of "+files.length+"…");uploaded.push(await portfolioUploadFile(files[i],"projects/"+project.id));}
      const imgs=await supabase.from("portfolio_project_images").insert(uploaded.map((x,i)=>({project_id:project.id,image_url:x.url,sort_order:i})));
      if(imgs.error)throw imgs.error;
      const upd=await supabase.from("portfolio_projects").update({cover_image_url:uploaded[0].url,updated_at:new Date().toISOString()}).eq("id",project.id);
      if(upd.error)throw upd.error;
    }catch(err){
      await supabase.from("portfolio_projects").delete().eq("id",project.id);
      throw err;
    }
    $("portfolioProjectForm").reset();portfolioStatus("Project saved successfully.");await loadPortfolio();
  }catch(err){portfolioStatus(err.message||"Project upload failed.",true)}
});
$("portfolioGalleryForm")?.addEventListener("submit",async e=>{
  e.preventDefault();portfolioStatus("Uploading gallery images…");
  try{
    const files=Array.from($("galleryFiles").files||[]);if(!files.length)throw Error("Select at least one gallery image.");
    for(let i=0;i<files.length;i++){
      portfolioStatus("Uploading gallery image "+(i+1)+" of "+files.length+"…");
      const up=await portfolioUploadFile(files[i],"gallery");
      const q=await supabase.from("portfolio_gallery").insert({
        title:$("galleryTitle").value.trim()||null,category:$("galleryCategory").value,caption:$("galleryCaption").value.trim()||null,image_url:up.url,sort_order:i,status:"PUBLISHED"
      });
      if(q.error)throw q.error;
    }
    $("portfolioGalleryForm").reset();portfolioStatus("Gallery updated successfully.");await loadPortfolio();
  }catch(err){portfolioStatus(err.message||"Gallery upload failed.",true)}
});

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
 const eligible=customers.filter(x=>x.account_type!=="admin").map(x=>'<option value="'+x.id+'">'+esc(x.full_name||x.id)+' • '+esc(x.phone||"No phone")+'</option>').join("");
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

const MARKETPLACE_ADMIN_ENDPOINT="https://script.google.com/macros/s/AKfycbzyZ5-txUUqM-O9T0RysHtcTQDfZAz2pgERT3NeKgGSJHnNaql-ZmKmguOYP2TT1IH5/exec";
const MARKETPLACE_ADMIN_KEY_STORE="twd_marketplace_admin_key";
function marketplaceAdminStatus(message,bad){const el=$("marketplaceAdminStatus");if(!el)return;el.textContent=message||"";el.className="mgmt-status"+(bad?" error":"");}
function renderMarketplaceAdmin(data){
 const s=data.stats||{};$("mpStatUsers").textContent=s.users||0;$("mpStatActive").textContent=s.activeUsers||0;$("mpStatApproved").textContent=s.approvedListings||0;$("mpStatPending").textContent=s.pendingListings||0;$("mpStatSubs").textContent=s.subscriptions||0;$("mpStatMessages").textContent=s.messages||0;
 $("mpAdminUsers").innerHTML=(data.users||[]).map(x=>"<div class='mgmt-row'><strong>"+esc(x.business||x.name||"Unnamed account")+"</strong><span>"+esc(x.name)+" • "+esc(x.status)+" • "+esc(x.email)+"</span><small>"+esc(x.id)+" • "+esc(x.phone||"No phone")+" • Created "+esc(x.created)+"</small></div>").join("")||"<p>No marketplace accounts.</p>";
 $("mpAdminListings").innerHTML=(data.listings||[]).map(x=>{const st=String(x.status||"").toUpperCase(),cl=st==="APPROVED"?"mp-admin-status-approved":"mp-admin-status-pending";return "<div class='mgmt-row'><strong>"+esc(x.title||"Untitled listing")+"</strong><span>"+esc(x.seller||"Unknown seller")+" • <b class='"+cl+"'>"+esc(st)+"</b> • "+esc(x.category)+" • "+esc(x.location)+"</span><small>Listing ID: "+esc(x.id)+" • Owner Account ID: "+esc(x.accountId||"NOT LINKED")+" • Photos: "+esc(x.photos)+"</small></div>"}).join("")||"<p>No marketplace listings.</p>";
 $("mpAdminSubscriptions").innerHTML=(data.subscriptions||[]).map(x=>"<div class='mgmt-row'><strong>"+esc(x.plan||"Subscription")+"</strong><span>"+esc(x.seller)+" • "+esc(x.status)+" • "+esc(x.paymentStatus)+"</span><small>"+esc(x.id)+" • "+esc(x.email)+" • Listing: "+esc(x.listingId||"—")+"</small></div>").join("")||"<p>No subscriptions.</p>";
 $("mpAdminMessages").innerHTML=(data.messages||[]).map(x=>"<div class='mgmt-row'><strong>"+esc(x.listingId||"Marketplace enquiry")+"</strong><span>"+esc(x.from)+" → "+esc(x.to)+" • "+esc(x.status)+"</span><small>"+esc(x.timestamp)+" • "+esc(x.message)+"</small></div>").join("")||"<p>No marketplace messages.</p>";
}
async function loadMarketplaceAdmin(){
 const key=$("marketplaceAdminKey")?.value.trim()||sessionStorage.getItem(MARKETPLACE_ADMIN_KEY_STORE)||"";if(!key){marketplaceAdminStatus("Enter the Marketplace Admin Key first.",true);return}
 marketplaceAdminStatus("Connecting to Marketplace Control Centre…");
 try{const r=await fetch(MARKETPLACE_ADMIN_ENDPOINT,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action:"admin_summary",adminKey:key})});const d=await r.json();if(!d.ok)throw Error(d.message||"Marketplace administrator authentication failed.");sessionStorage.setItem(MARKETPLACE_ADMIN_KEY_STORE,key);$("marketplaceAdminKey").value=key;$("marketplaceAdminLogin").hidden=true;$("marketplaceAdminPanel").hidden=false;renderMarketplaceAdmin(d);marketplaceAdminStatus("Marketplace Control Centre connected. Last refresh: "+new Date().toLocaleTimeString())}catch(e){marketplaceAdminStatus(e.message||"Marketplace Control Centre could not be reached.",true)}
}
$("connectMarketplaceAdmin")?.addEventListener("click",loadMarketplaceAdmin);$("refreshMarketplaceAdmin")?.addEventListener("click",loadMarketplaceAdmin);
(async()=>{if(sessionStorage.getItem(MARKETPLACE_ADMIN_KEY_STORE)&&$("marketplaceAdminKey")){$("marketplaceAdminKey").value=sessionStorage.getItem(MARKETPLACE_ADMIN_KEY_STORE);await loadMarketplaceAdmin();}})();
