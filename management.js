import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";
const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
let admin=null,projects=[],customers=[],requests=[],quotations=[],workers=[];
let accessVersion=0, loadVersion=0, accountError=null, workerError=null;
let marketplaceKey="", marketplaceLoad=0, savingWorker=false;
function status(t,bad=false){$("mgmtStatus").textContent=t||"";$("mgmtStatus").className="mgmt-status"+(bad?" error":"")}
function loginStatus(t,bad=false){$("loginStatus").textContent=t||"";$("loginStatus").className="mgmt-status"+(bad?" error":"")}

function closeManagement(){
 accessVersion++;
 admin=null;
 customers=[];workers=[];projects=[];requests=[];quotations=[];
 accountError=null;workerError=null;
 $("appPanel").hidden=true;
 $("signout").hidden=true;
 $("loginPanel").hidden=false;
 $("adminIdentity").textContent="";
 $("workerForm").reset();
 $("saveWorker").disabled=true;
 workerSaveStatus("");
 for (const id of ["customersList","workersList","attendanceList","workerReportsList"]) $(id).replaceChildren();
 clearMarketplace();
}

async function requireAdmin(){
 const version=++accessVersion;
 try {
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(version!==accessVersion)return false;
  if(!user||authError){closeManagement();return false}
  const {data:profile,error}=await supabase.from("profiles").select("account_type,full_name").eq("id",user.id).maybeSingle();
  if(version!==accessVersion)return false;
  if(error||profile?.account_type!=="admin"){
   closeManagement();
   loginStatus(error?"Unable to verify administrator access. Please try again.":"This account is not authorised for TW&D management access.",true);
   return false;
  }
  admin=user;
  $("adminIdentity").textContent=(profile.full_name||user.email)+" • ADMINISTRATOR";
  $("loginPanel").hidden=true;$("appPanel").hidden=false;$("signout").hidden=false;
  loginStatus("");
  const target=window.location.hash.slice(1);
  if(target)$(target)?.scrollIntoView();
  await loadAll();
  return true;
 }catch(error){
  if(version===accessVersion){closeManagement();loginStatus("Management could not connect. Please try again.",true);}
  return false;
 }
}

async function fetchDirectory(table,fields){
 const pageSize=250, rows=[];
 for(let offset=0;admin;offset+=pageSize){
  const {data,error}=await supabase.from(table).select(fields)
   .order("created_at",{ascending:false}).order("id",{ascending:true}).range(offset,offset+pageSize-1);
  if(error)return {data:[],error};
  rows.push(...data);
  if(data.length<pageSize)break;
 }
 return {data:rows,error:null};
}

async function loadAll(){
 if(!admin)return;
 const revision=++loadVersion, access=accessVersion;
 const [c,p,r,q,w]=await Promise.all([
  fetchDirectory("profiles","id,full_name,phone,account_type"),
  supabase.from("projects").select("*").order("updated_at",{ascending:false}),
  supabase.from("service_requests").select("id,customer_id,request_type,subject,message,status,created_at,updated_at").order("created_at",{ascending:false}).limit(100),
  supabase.from("quotations").select("*").order("created_at",{ascending:false}).limit(100),
  fetchDirectory("workers","id,user_id,full_name,employee_code,job_title,department,employment_status")
 ]);
 if(access!==accessVersion||revision!==loadVersion||!admin)return;
 accountError=c.error;workerError=w.error;
 customers=c.data||[];projects=p.data||[];requests=r.data||[];quotations=q.data||[];workers=w.data||[];
 const failed=[["projects",p.error],["service requests",r.error],["quotations",q.error]]
  .filter(([,error])=>error).map(([name])=>name);
 if(failed.length)status("Could not load "+failed.join(", ")+". Account and worker results are shown in their sections.",true);
 renderCustomers();renderProjects();renderRequests();renderQuotations();renderWorkers();
 populateCustomerSelects();populateQuoteProjects();populateWorkerSelects();
 renderWorkerAttendance();renderWorkerReports();loadPortfolio();
}

function directoryMatches(search, values){
 const term=$(search).value.trim().toLowerCase();
 return !term||values.some(value=>String(value??"").toLowerCase().includes(term));
}

function renderCustomers(){
 const role=$("accountRole").value;
 const activeWorkers=new Set(workers.filter(worker=>worker.employment_status==="ACTIVE").map(worker=>worker.user_id));
 const accountType=row=>row.account_type==="admin"?"admin":activeWorkers.has(row.id)?"worker":row.account_type||"customer";
 const filtered=customers.filter(row=>(!role||accountType(row)===role)
  &&directoryMatches("accountSearch",[row.full_name,row.phone,row.id]));
 $("accountsStatus").textContent=accountError
  ?"Website accounts could not be loaded. Reopen the portal to try again."
  :filtered.length+" of "+customers.length+" website accounts";
 $("customersList").innerHTML=filtered.map(row=>
  '<div class="mgmt-row"><strong>'+esc(row.full_name||"Unnamed account")+'</strong><span>'+
  esc(row.phone||"No phone")+' • '+esc(accountType(row))+'</span><span>'+esc(row.id)+'</span></div>'
 ).join("")||(!accountError?"<p>No matching website accounts.</p>":"");
}
$("accountSearch").addEventListener("input",renderCustomers);
$("accountRole").addEventListener("change",renderCustomers);
$("workerSearch").addEventListener("input",renderWorkers);
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
let requestedPortfolioEdit=new URLSearchParams(location.search).get("editProject");
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
  if(requestedPortfolioEdit){
    const id=requestedPortfolioEdit;
    requestedPortfolioEdit=null;
    if((p.data||[]).some(project=>project.id===id))editPortfolioProject(id);
  }
}
function resetPortfolioProjectForm(){
  $("portfolioProjectEditId").value="";
  $("portfolioProjectPicker").value="";
  $("portfolioProjectFormHeading").textContent="Publish New Project";
  $("portfolioProjectSubmit").textContent="Publish Project";
  $("portfolioProjectCancel").hidden=true;
  $("portfolioProjectFiles").value="";
  $("portfolioProjectFiles").required=true;
  $("portfolioProjectFilesHint").textContent="Select one or more images when creating a new project. When editing, selected images will be added to the existing project gallery.";
  $("portfolioProjectForm").reset();
  $("portfolioProjectEditId").value="";
  $("portfolioProjectStatus").value="PUBLISHED";
}
function editPortfolioProject(id){
  const x=(window.portfolioProjects||[]).find(row=>row.id===id); if(!x)return;
  if($("portfolioProjectEditId").value!==x.id)$("portfolioProjectFiles").value="";
  $("portfolioProjectPicker").value=x.id;
  $("portfolioProjectEditId").value=x.id;
  $("portfolioProjectFormHeading").textContent="Edit Project";
  $("portfolioProjectSubmit").textContent="Save Project Changes";
  $("portfolioProjectCancel").hidden=false;
  $("portfolioProjectFiles").required=false;
  $("portfolioProjectFilesHint").textContent="Optional: select additional photographs to add to this project. Existing photographs are preserved.";
  $("portfolioTitle").value=x.title||"";
  $("portfolioState").value=x.state||"";
  $("portfolioLocation").value=x.location||"";
  $("portfolioCategory").value=x.category||"Other";
  $("portfolioClient").value=x.client||"";
  $("portfolioDate").value=x.completion_date||"";
  $("portfolioValue").value=x.project_value??"";
  $("portfolioDescription").value=x.description||"";
  $("portfolioProjectStatus").value=x.status==="ARCHIVED"?"DRAFT":(x.status||"PUBLISHED");
  document.getElementById("portfolioProjectForm").scrollIntoView({behavior:"smooth",block:"center"});
  portfolioStatus("Editing: "+(x.title||"project"));
}
function renderPortfolioProjects(rows){
  window.portfolioProjects=rows;
  const picker=$("portfolioProjectPicker");
  const selected=$("portfolioProjectEditId").value;
  picker.replaceChildren(new Option("Select a project",""));
  for(const project of rows){
    const details=[project.location||project.state,project.status].filter(Boolean).join(" · ");
    picker.add(new Option(details ? project.title+" — "+details : project.title,project.id));
  }
  picker.value=rows.some(project=>project.id===selected)?selected:"";
  picker.disabled=!rows.length;
  const box=$("portfolioProjectsList"); if(!box)return;
  box.innerHTML=rows.map(x=>"<div class='mgmt-row'><strong>"+esc(x.title)+"</strong><span>"+esc(x.state)+" • "+esc(x.category||"")+" • "+esc(x.status)+"</span><small>"+esc(x.location||"")+" • "+esc(x.completion_date||"")+"</small>"+(x.status==="PUBLISHED"?"<a href='project-record.html?id="+encodeURIComponent(x.id)+"'>Open project page →</a>":"")+"<div style='display:flex;gap:8px;flex-wrap:wrap;margin-top:8px'><button type='button' class='mgmt-btn small portfolio-edit-project' data-id='"+esc(x.id)+"'>Edit details / photos</button><button type='button' class='mgmt-btn small portfolio-archive' data-id='"+esc(x.id)+"'>"+(x.status==="ARCHIVED"?"Archived":"Archive")+"</button></div></div>").join("")||"<p>No portfolio projects yet.</p>";
  box.querySelectorAll(".portfolio-edit-project").forEach(b=>b.onclick=()=>editPortfolioProject(b.dataset.id));
  box.querySelectorAll(".portfolio-archive").forEach(b=>b.onclick=async()=>{
    if(b.textContent==="Archived")return;
    if(!confirm("Archive this public project?"))return;
    const q=await supabase.from("portfolio_projects").update({status:"ARCHIVED",updated_at:new Date().toISOString()}).eq("id",b.dataset.id);
    if(q.error){portfolioStatus(q.error.message,true);return}
    portfolioStatus("Project archived.");await loadPortfolio();
  });
}
function editPortfolioGallery(id){
  const x=(window.portfolioGallery||[]).find(row=>row.id===id); if(!x)return;
  $("galleryEditId").value=x.id;
  $("portfolioGallerySubmit").textContent="Save Gallery Changes";
  $("portfolioGalleryCancel").hidden=false;
  $("galleryFiles").value="";
  $("galleryFilesHint").textContent="Optional: select one image to replace the current gallery image.";
  $("galleryTitle").value=x.title||"";
  $("galleryCategory").value=x.category||"Other";
  $("galleryCaption").value=x.caption||"";
  $("galleryProject").value=x.project_slug||"";
  document.getElementById("portfolioGalleryForm").scrollIntoView({behavior:"smooth",block:"center"});
  portfolioStatus("Editing gallery item: "+(x.title||"Untitled"));
}
function renderPortfolioGallery(rows){
  window.portfolioGallery=rows;
  const box=$("portfolioGalleryList"); if(!box)return;
  box.innerHTML=rows.map(x=>"<div class='mgmt-row portfolio-gallery-row'><img src='"+esc(x.image_url)+"' alt='"+esc(x.title||"Gallery image")+"' loading='lazy'><strong>"+esc(x.title||"Untitled gallery image")+"</strong><span>"+esc(x.category||"")+" • "+esc(x.status)+"</span><small>"+esc(x.caption||"")+"</small><div style='display:flex;gap:8px;flex-wrap:wrap;grid-column:2'><button type='button' class='mgmt-btn small portfolio-edit-gallery' data-id='"+esc(x.id)+"'>Edit</button><button type='button' class='mgmt-btn small portfolio-delete-gallery' data-id='"+esc(x.id)+"'>Remove</button></div></div>").join("")||"<p>No gallery items yet.</p>";
  box.querySelectorAll(".portfolio-edit-gallery").forEach(b=>b.onclick=()=>editPortfolioGallery(b.dataset.id));
  box.querySelectorAll(".portfolio-delete-gallery").forEach(b=>b.onclick=async()=>{
    if(!confirm("Remove this gallery image from the public website?"))return;
    const q=await supabase.from("portfolio_gallery").delete().eq("id",b.dataset.id);
    if(q.error){portfolioStatus(q.error.message,true);return}
    portfolioStatus("Gallery item removed.");await loadPortfolio();
  });
}
function portfolioStatus(t,bad=false){const el=$("portfolioStatus");if(el){el.textContent=t||"";el.className="mgmt-status"+(bad?" error":"")}}
$("portfolioProjectPicker").addEventListener("change",event=>{
  if(event.target.value)editPortfolioProject(event.target.value);
  else resetPortfolioProjectForm();
});
$("refreshPortfolio")?.addEventListener("click",loadPortfolio);
$("portfolioProjectCancel")?.addEventListener("click",()=>{resetPortfolioProjectForm();portfolioStatus("Project edit cancelled.")});
$("portfolioGalleryCancel")?.addEventListener("click",()=>{resetPortfolioGalleryForm();portfolioStatus("Gallery edit cancelled.")});
$("portfolioProjectForm")?.addEventListener("submit",async e=>{
  e.preventDefault();
  const submitButton=$("portfolioProjectSubmit");
  if(submitButton.disabled)return;
  submitButton.disabled=true;
  const picker=$('portfolioProjectPicker');
  picker.disabled=true;
  const editId=$("portfolioProjectEditId").value.trim();
  portfolioStatus(editId?"Saving project changes…":"Creating project record and uploading photographs…");
  try{
    const files=Array.from($("portfolioProjectFiles").files||[]);
    if(!editId&&!files.length)throw Error("Select at least one project photograph.");
    const payload={
      title:$("portfolioTitle").value.trim(),state:$("portfolioState").value.trim(),location:$("portfolioLocation").value.trim()||null,
      category:$("portfolioCategory").value,client:$("portfolioClient").value.trim()||null,description:$("portfolioDescription").value.trim()||null,
      completion_date:$("portfolioDate").value||null,project_value:$("portfolioValue").value?Number($("portfolioValue").value):null,
      status:$("portfolioProjectStatus").value,updated_at:new Date().toISOString()
    };
    let project;
    if(editId){
      const q=await supabase.from("portfolio_projects").update(payload).eq("id",editId).select().single();
      if(q.error)throw q.error; project=q.data;
      if(files.length){
        const uploaded=[];
        for(let i=0;i<files.length;i++){portfolioStatus("Uploading additional photograph "+(i+1)+" of "+files.length+"…");uploaded.push(await portfolioUploadFile(files[i],"projects/"+editId));}
        const order=await supabase.from("portfolio_project_images").select("sort_order").eq("project_id",editId).order("sort_order",{ascending:false,nullsFirst:false}).limit(1).maybeSingle();
        if(order.error)throw order.error;
        const firstOrder=(order.data?.sort_order??-1)+1;
        const imgs=await supabase.from("portfolio_project_images").insert(uploaded.map((x,i)=>({project_id:editId,image_url:x.url,sort_order:firstOrder+i})));
        if(imgs.error)throw imgs.error;
        if(!project.cover_image_url){
          const upd=await supabase.from("portfolio_projects").update({cover_image_url:uploaded[0].url,updated_at:new Date().toISOString()}).eq("id",editId);
          if(upd.error)throw upd.error;
        }
      }
      resetPortfolioProjectForm();portfolioStatus("Project updated successfully.");await loadPortfolio();return;
    }
    const q=await supabase.from("portfolio_projects").insert({...payload,status:"DRAFT"}).select().single();
    if(q.error)throw q.error;
    project=q.data;
    const uploaded=[];
    try{
      for(let i=0;i<files.length;i++){portfolioStatus("Uploading photograph "+(i+1)+" of "+files.length+"…");uploaded.push(await portfolioUploadFile(files[i],"projects/"+project.id));}
      const imgs=await supabase.from("portfolio_project_images").insert(uploaded.map((x,i)=>({project_id:project.id,image_url:x.url,sort_order:i})));
      if(imgs.error)throw imgs.error;
      const upd=await supabase.from("portfolio_projects").update({cover_image_url:uploaded[0].url,status:payload.status,updated_at:new Date().toISOString()}).eq("id",project.id);
      if(upd.error)throw upd.error;
    }catch(err){
      const rollback=await supabase.from("portfolio_projects").delete().eq("id",project.id).select("id").maybeSingle();
      if(rollback.data&&uploaded.length)await supabase.storage.from("public-portfolio").remove(uploaded.map(photo=>photo.path));
      if(!rollback.data)throw Error("The project remains a draft. Open it from the project list to finish the upload. "+(err.message||""));
      throw err;
    }
    resetPortfolioProjectForm();portfolioStatus("Project published/saved successfully.");await loadPortfolio();
  }catch(err){portfolioStatus(err.message||"Project save failed.",true)} finally { submitButton.disabled=false; picker.disabled=!(window.portfolioProjects||[]).length; }
});
function resetPortfolioGalleryForm(){
  $("galleryEditId").value="";
  $("portfolioGallerySubmit").textContent="Add to Gallery";
  $("portfolioGalleryCancel").hidden=true;
  $("galleryFiles").value="";
  $("galleryFiles").required=true;
  $("galleryFilesHint").textContent="Select images to add new gallery items. When editing, selecting an image will replace the existing image.";
  $("portfolioGalleryForm").reset();
  $("galleryEditId").value="";
}
$("portfolioGalleryForm")?.addEventListener("submit",async e=>{
  e.preventDefault();
  const submitButton=$("portfolioGallerySubmit");
  if(submitButton.disabled)return;
  submitButton.disabled=true;
  const editId=$("galleryEditId").value.trim(),files=Array.from($("galleryFiles").files||[]);
  portfolioStatus(editId?"Saving gallery changes…":"Uploading gallery images…");
  try{
    if(editId){
      const x=(window.portfolioGallery||[]).find(row=>row.id===editId);if(!x)throw Error("Gallery item could not be found.");
      const payload={title:$("galleryTitle").value.trim()||null,category:$("galleryCategory").value,caption:$("galleryCaption").value.trim()||null,project_slug:$("galleryProject").value||null,updated_at:new Date().toISOString()};
      if(files.length){
        if(files.length>1)throw Error("Select only one image when replacing an existing gallery image.");
        const up=await portfolioUploadFile(files[0],"gallery");
        payload.image_url=up.url;
      }
      const q=await supabase.from("portfolio_gallery").update(payload).eq("id",editId);
      if(q.error)throw q.error;
      resetPortfolioGalleryForm();portfolioStatus("Gallery item updated successfully.");await loadPortfolio();return;
    }
    if(!files.length)throw Error("Select at least one gallery image.");
    const uploaded=[];
    const fields={
      title:$("galleryTitle").value.trim()||null,
      category:$("galleryCategory").value,
      caption:$("galleryCaption").value.trim()||null,
      project_slug:$("galleryProject").value||null,
      status:"PUBLISHED"
    };
    try{
      for(let i=0;i<files.length;i++){
        portfolioStatus("Uploading photo "+(i+1)+" of "+files.length+"…");
        uploaded.push(await portfolioUploadFile(files[i],"gallery"));
      }
      const result=await supabase.from("portfolio_gallery").insert(
        uploaded.map((photo,index)=>({...fields,image_url:photo.url,sort_order:index}))
      );
      if(result.error)throw result.error;
    }catch(error){
      if(uploaded.length)await supabase.storage.from("public-portfolio").remove(uploaded.map(photo=>photo.path));
      throw error;
    }
    resetPortfolioGalleryForm();portfolioStatus("Gallery updated successfully.");await loadPortfolio();
  }catch(err){portfolioStatus(err.message||"Gallery save failed.",true)} finally { submitButton.disabled=false; }
});

$("loginForm").onsubmit=async e=>{e.preventDefault();loginStatus("Signing in…");const {error}=await supabase.auth.signInWithPassword({email:$("adminEmail").value.trim(),password:$("adminPassword").value});if(error){loginStatus(error.message,true);return}await requireAdmin()};
$("signout").onclick=async()=>{
 closeManagement();
 try{await supabase.auth.signOut();location.reload();}
 catch(error){loginStatus("Sign-out could not be confirmed. Please try again.",true);}
};
supabase.auth.onAuthStateChange((event,session)=>{
 if(event==="SIGNED_OUT"||(admin&&session?.user?.id!==admin.id))closeManagement();
});
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
function renderWorkers(){
 const filtered=workers.filter(row=>directoryMatches("workerSearch",[
  row.full_name,row.employee_code,row.job_title,row.department,row.employment_status
 ]));
 $("workersStatus").textContent=workerError
  ?"Worker records could not be loaded. Reopen the portal to try again."
  :filtered.length+" of "+workers.length+" worker records";
 $("workersList").innerHTML=filtered.map(row=>
  '<div class="mgmt-row"><strong>'+esc(row.employee_code)+' • '+esc(row.full_name)+'</strong><span>'+
  [row.job_title||"Worker",row.department,row.employment_status].filter(Boolean).map(esc).join(" • ")+'</span></div>'
 ).join("")||(!workerError?"<p>No matching worker records.</p>":"");
}
function populateWorkerSelects(){
 const payment=$("paymentWorker"), savedPayment=payment.value;
 payment.innerHTML='<option value="">Select worker</option>'+workers.map(row=>
  '<option value="'+esc(row.id)+'">'+esc(row.employee_code)+' • '+esc(row.full_name)+'</option>'
 ).join("");
 if(workers.some(row=>row.id===savedPayment))payment.value=savedPayment;

 const select=$("workerUser"), current=select.value;
 const eligible=customers.filter(row=>row.account_type!=="admin");
 const label=accountError?"Website accounts could not be loaded":
  workerError?"Worker records could not be loaded":
  eligible.length?"Select an existing website account":"No eligible website accounts";
 select.innerHTML='<option value="">'+label+'</option>'+eligible.map(row=>
  '<option value="'+esc(row.id)+'">'+esc(row.full_name||row.id)+' • '+esc(row.phone||"No phone")+'</option>'
 ).join("");
 if(eligible.some(row=>row.id===current))select.value=current;
 updateWorkerSaveButton();
}

function updateWorkerSaveButton(){
 $("saveWorker").disabled=!admin||savingWorker||Boolean(accountError||workerError)||!$("workerUser").value;
 for(const field of $("workerForm").querySelectorAll("input, select"))field.disabled=savingWorker;
}

function workerSaveStatus(message,kind=""){
 const output=$("workerSaveStatus");
 output.textContent=message;
 output.className="mgmt-note "+kind;
}

$("workerUser").addEventListener("change",()=>{
 const current=workers.find(row=>row.user_id===$("workerUser").value);
 $("employeeCode").value=current?.employee_code||"";
 $("workerJobTitle").value=current?.job_title||"";
 $("workerDepartment").value=current?.department||"";
 for(const id of ["workerBank","workerAccountName","workerAccountNumber"])$(id).value="";
 workerSaveStatus(current?"Leave the bank fields blank to keep the current details.":"");
 updateWorkerSaveButton();
});

async function renderWorkerAttendance(){
 const access=accessVersion;
 const q=await supabase.from("worker_attendance").select("worker_id,work_date,check_in,check_out,status").order("work_date",{ascending:false}).limit(50);
 if(!admin||access!==accessVersion)return;
 if(q.error){$("attendanceList").innerHTML="<p>"+esc(q.error.message)+"</p>";return}
 $("attendanceList").innerHTML=(q.data||[]).map(x=>'<div class="mgmt-row"><strong>'+esc(workers.find(worker=>worker.id===x.worker_id)?.full_name||"Worker")+'</strong><span>'+esc(x.work_date)+' • '+esc(x.status)+' • '+new Date(x.check_in).toLocaleString()+(x.check_out?" • out "+new Date(x.check_out).toLocaleString():"")+'</span></div>').join("")||"<p>No attendance records.</p>";
}
async function renderWorkerReports(){
 const access=accessVersion;
 const q=await supabase.from("worker_reports").select("worker_id,report_date,report_title,report_body,status,admin_notes").order("report_date",{ascending:false}).limit(30);
 if(!admin||access!==accessVersion)return;
 if(q.error){$("workerReportsList").innerHTML="<p>"+esc(q.error.message)+"</p>";return}
 $("workerReportsList").innerHTML=(q.data||[]).map(x=>'<div class="mgmt-row"><strong>'+esc(x.report_title)+'</strong><span>'+esc(workers.find(worker=>worker.id===x.worker_id)?.full_name||"Worker")+' • '+esc(x.report_date)+' • '+esc(x.status)+'</span><small>'+esc(x.report_body)+'</small></div>').join("")||"<p>No worker reports.</p>";
}
$("generateAttendanceCode")?.addEventListener("click",async()=>{const r=await supabase.rpc("admin_generate_attendance_code");if(r.error){$("attendanceCodeResult").textContent=r.error.message;return}$("attendanceCodeResult").textContent="TODAY'S ATTENDANCE CODE: "+r.data;await renderWorkerAttendance()});
$("workerForm").addEventListener("submit",async event=>{
 event.preventDefault();
 if(!admin||savingWorker||accountError||workerError)return;
 const id=$("workerUser").value;
 const account=customers.find(row=>row.id===id&&row.account_type!=="admin");
 if(!account){workerSaveStatus("Choose an existing website account.","error");return;}

 const fullName=account.full_name?.trim();
 if(!fullName){workerSaveStatus("Add a full name to the selected website account before activating it.","error");return;}
 const payload={
  user_id:id,
  full_name:fullName,
  employee_code:$("employeeCode").value.trim(),
  job_title:$("workerJobTitle").value.trim(),
  department:$("workerDepartment").value.trim()||null,
  employment_status:"ACTIVE"
 };
 if(!payload.employee_code||!payload.job_title){
  workerSaveStatus("Enter an employee code and job title.","error");return;
 }
 const bank={
  bank_name:$("workerBank").value.trim(),
  account_name:$("workerAccountName").value.trim(),
  account_number:$("workerAccountNumber").value.replace(/[\s-]/g,"")
 };
 if(Object.values(bank).some(Boolean)){
  if(!bank.bank_name||!bank.account_name||!/^\d+$/.test(bank.account_number)){
   workerSaveStatus("Enter the bank name, account holder name and a numeric account number.","error");return;
  }
  Object.assign(payload,bank);
 }

 const access=accessVersion;
 savingWorker=true;
 updateWorkerSaveButton();
 workerSaveStatus("Saving worker details…");
 try {
  // The worker portal checks this same record to authorize access.
  const {data,error}=await supabase.from("workers").upsert(payload,{onConflict:"user_id"})
   .select("user_id,employment_status").single();
  if(access!==accessVersion||!admin)return;
  if(error)throw error;
  if(data?.user_id!==id||data.employment_status!=="ACTIVE")throw Error("The database did not confirm the activation. Check the worker list before retrying.");
  for(const field of ["workerBank","workerAccountName","workerAccountNumber"])$(field).value="";
  workerSaveStatus("Worker details saved. "+(account.full_name||"The worker")+" can open the Worker Portal from My Account.","success");
  loadAll().catch(()=>status("The worker was saved. Reload to refresh the worker list.",true));
 }catch(error){
  if(access!==accessVersion||!admin)return;
  const message=error.code==="23505"?"This employee code is already in use. Choose a different code."
   :error.code==="42501"?"Your account does not have permission to save this worker. Sign in with your website administrator account."
   :error.message||"The worker could not be saved. Try again.";
  workerSaveStatus(message,"error");
 }finally{
  savingWorker=false;
  updateWorkerSaveButton();
 }
});
$("paymentForm")?.addEventListener("submit",async e=>{
 e.preventDefault();const r=await supabase.from("worker_payments").insert({worker_id:$("paymentWorker").value,pay_period:$("payPeriod").value.trim(),amount:Number($("paymentAmount").value),status:$("paymentStatus").value,payment_date:$("paymentDate").value||null,reference:$("paymentReference").value.trim(),notes:$("paymentNotes").value.trim()});if(r.error){status(r.error.message,true);return}$("paymentForm").reset();status("Worker payment record saved.");await loadAll();
});

const MARKETPLACE_ADMIN_ENDPOINT="https://script.google.com/macros/s/AKfycbzyZ5-txUUqM-O9T0RysHtcTQDfZAz2pgERT3NeKgGSJHnNaql-ZmKmguOYP2TT1IH5/exec";
function marketplaceAdminStatus(message,bad){const el=$("marketplaceAdminStatus");if(!el)return;el.textContent=message||"";el.className="mgmt-status"+(bad?" error":"");}
function renderMarketplaceAdmin(data){
 const s=data.stats||{};$("mpStatUsers").textContent=s.users||0;$("mpStatActive").textContent=s.activeUsers||0;$("mpStatApproved").textContent=s.approvedListings||0;$("mpStatPending").textContent=s.pendingListings||0;$("mpStatSubs").textContent=s.subscriptions||0;$("mpStatMessages").textContent=s.messages||0;
 $("mpAdminUsers").innerHTML=(data.users||[]).map(x=>"<div class='mgmt-row'><strong>"+esc(x.business||x.name||"Unnamed account")+"</strong><span>"+esc(x.name)+" • "+esc(x.status)+" • "+esc(x.email)+"</span><small>"+esc(x.id)+" • "+esc(x.phone||"No phone")+" • Created "+esc(x.created)+"</small></div>").join("")||"<p>No marketplace accounts.</p>";
 $("mpAdminListings").innerHTML=(data.listings||[]).map(x=>{const st=String(x.status||"").toUpperCase(),cl=st==="APPROVED"?"mp-admin-status-approved":"mp-admin-status-pending";return "<div class='mgmt-row'><strong>"+esc(x.title||"Untitled listing")+"</strong><span>"+esc(x.seller||"Unknown seller")+" • <b class='"+cl+"'>"+esc(st)+"</b> • "+esc(x.category)+" • "+esc(x.location)+"</span><small>Listing ID: "+esc(x.id)+" • Owner Account ID: "+esc(x.accountId||"NOT LINKED")+" • Photos: "+esc(x.photos)+"</small></div>"}).join("")||"<p>No marketplace listings.</p>";
 $("mpAdminSubscriptions").innerHTML=(data.subscriptions||[]).map(x=>"<div class='mgmt-row'><strong>"+esc(x.plan||"Subscription")+"</strong><span>"+esc(x.seller)+" • "+esc(x.status)+" • "+esc(x.paymentStatus)+"</span><small>"+esc(x.id)+" • "+esc(x.email)+" • Listing: "+esc(x.listingId||"—")+"</small></div>").join("")||"<p>No subscriptions.</p>";
 $("mpAdminMessages").innerHTML=(data.messages||[]).map(x=>"<div class='mgmt-row'><strong>"+esc(x.listingId||"Marketplace enquiry")+"</strong><span>"+esc(x.from)+" → "+esc(x.to)+" • "+esc(x.status)+"</span><small>"+esc(x.timestamp)+" • "+esc(x.message)+"</small></div>").join("")||"<p>No marketplace messages.</p>";
}
function clearMarketplace(){
 marketplaceLoad++;
 marketplaceKey="";
 $("marketplaceAdminKey").value="";
 $("marketplaceAdminLogin").hidden=false;
 $("marketplaceAdminPanel").hidden=true;
 $("refreshMarketplaceAdmin").hidden=true;
 $("connectMarketplaceAdmin").disabled=false;
 $("refreshMarketplaceAdmin").disabled=false;
 for(const id of ["mpAdminUsers","mpAdminListings","mpAdminSubscriptions","mpAdminMessages"])$(id).replaceChildren();
 marketplaceAdminStatus("");
}

async function loadMarketplaceAdmin(){
 if(!admin)return;
 const key=$("marketplaceAdminKey").value.trim()||marketplaceKey;
 if(!key){marketplaceAdminStatus("Enter the Marketplace Admin Key to connect.",true);return}
 const access=accessVersion, request=++marketplaceLoad;
 const buttons=[$("connectMarketplaceAdmin"),$("refreshMarketplaceAdmin")];
 buttons.forEach(button=>button.disabled=true);
 marketplaceAdminStatus("Connecting to the live marketplace…");
 try{
  const response=await fetch(MARKETPLACE_ADMIN_ENDPOINT,{
   method:"POST",cache:"no-store",headers:{"Content-Type":"text/plain;charset=utf-8"},
   body:JSON.stringify({action:"admin_summary",adminKey:key})
  });
  if(!response.ok)throw Error("Marketplace responded with HTTP "+response.status+".");
  const data=await response.json();
  if(!data.ok)throw Error(data.message||"Marketplace administrator access could not be verified.");
  if(!Array.isArray(data.users)||!Array.isArray(data.listings)){
   throw Error("The marketplace service did not return an administrator summary.");
  }
  if(!admin||access!==accessVersion||request!==marketplaceLoad)return;
  renderMarketplaceAdmin(data);
  marketplaceKey=key;
  $("marketplaceAdminKey").value="";
  $("marketplaceAdminLogin").hidden=true;
  $("marketplaceAdminPanel").hidden=false;
  $("refreshMarketplaceAdmin").hidden=false;
  marketplaceAdminStatus("Marketplace connected. Last refreshed at "+new Date().toLocaleTimeString("en-NG",{timeZone:"Africa/Lagos"})+" WAT.");
 }catch(error){
  if(!admin||access!==accessVersion||request!==marketplaceLoad)return;
  clearMarketplace();
  marketplaceAdminStatus(error instanceof SyntaxError?"Marketplace returned an unreadable response. Try connecting again.":error.message||"Marketplace could not be reached.",true);
 }finally{
  if(request===marketplaceLoad)buttons.forEach(button=>button.disabled=false);
 }
}
$("marketplaceAdminLogin").addEventListener("submit",event=>{
 event.preventDefault();
 loadMarketplaceAdmin();
});
$("refreshMarketplaceAdmin").addEventListener("click",loadMarketplaceAdmin);

requireAdmin();
