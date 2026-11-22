import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import * as THREE from 'https://esm.sh/three@0.180.0';
import { OrbitControls } from 'https://esm.sh/three@0.180.0/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'https://esm.sh/three@0.180.0/examples/jsm/exporters/GLTFExporter.js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';

const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=id=>document.getElementById(id);
const roofLabels={contemporary_flat:'Flat',conventional_gable:'Gable',hip:'Hip',butterfly:'Butterfly',mono_pitch:'Mono-pitch',combination:'Combination',mansard:'Mansard',custom:'Custom'};
let currentUser=null,currentProjectId=null,currentRevision=0,renderer,scene,camera,controls,buildingGroup;
const viewer=$('viewer');
function setup3D(){
  try{
    scene=new THREE.Scene();scene.background=new THREE.Color('#edf4fb');
    camera=new THREE.PerspectiveCamera(42,viewer.clientWidth/viewer.clientHeight,.1,500);camera.position.set(26,20,30);
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setSize(viewer.clientWidth,viewer.clientHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;viewer.appendChild(renderer.domElement);
    controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.target.set(0,4,0);controls.maxPolarAngle=Math.PI*.48;
    scene.add(new THREE.HemisphereLight(0xffffff,0x8395aa,2));
    const sun=new THREE.DirectionalLight(0xffffff,2.3);sun.position.set(18,30,12);sun.castShadow=true;scene.add(sun);
    const grid=new THREE.GridHelper(60,30,0x8da5bd,0xd5e0eb);grid.position.y=-.04;scene.add(grid);
    buildingGroup=new THREE.Group();scene.add(buildingGroup);drawBuilding();
    const resize=new ResizeObserver(()=>{if(!renderer)return;const w=viewer.clientWidth,h=viewer.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h)});resize.observe(viewer);
    const animate=()=>{requestAnimationFrame(animate);controls.update();renderer.render(scene,camera)};animate();
    $('viewerStatus').textContent='Interactive 3D concept · drag to rotate · scroll to zoom';
  }catch(e){$('viewerStatus').textContent='3D preview unavailable on this browser/device.';console.error(e)}
}
function box(parent,w,h,d,x,y,z,material){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh}
function drawRoof(w,d,y,style,mat){
  const roof=new THREE.Group();roof.position.y=y;buildingGroup.add(roof);
  const ridge=Math.max(w,d);
  if(style==='contemporary_flat'||style==='custom'||style==='combination'||style==='mansard'){
    box(roof,w+0.7,.32,d+0.7,0,.16,0,mat);
    if(style==='mansard'){const cap=box(roof,w*.92,.5,d*.92,0,.48,0,mat);cap.rotation.y=Math.PI/4}
  }else if(style==='conventional_gable'||style==='mono_pitch'){
    const shape=new THREE.Shape();shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(0,Math.min(w*.28,3.2));shape.closePath();
    const geo=new THREE.ExtrudeGeometry(shape,{depth:d+.8,bevelEnabled:false});geo.translate(0,0,-(d+.8)/2);
    const g=new THREE.Mesh(geo,mat);g.castShadow=true;roof.add(g);
  }else if(style==='hip'){
    const geom=new THREE.ConeGeometry(Math.max(w,d)*.66,Math.min(w,d)*.42,4);geom.rotateY(Math.PI/4);geom.scale(1,1,Math.min(w,d)/Math.max(w,d));const m=new THREE.Mesh(geom,mat);m.position.y=Math.min(w,d)*.2;m.castShadow=true;roof.add(m);
  }else if(style==='butterfly'){
    const shape=new THREE.Shape();shape.moveTo(-w/2,Math.min(w*.22,2.2));shape.lineTo(0,0);shape.lineTo(w/2,Math.min(w*.22,2.2));shape.lineTo(w/2,Math.min(w*.22,2.2)+.18);shape.lineTo(0,.18);shape.lineTo(-w/2,Math.min(w*.22,2.2)+.18);shape.closePath();const geo=new THREE.ExtrudeGeometry(shape,{depth:d+.8,bevelEnabled:false});geo.translate(0,0,-(d+.8)/2);roof.add(new THREE.Mesh(geo,mat));
  }else{
    box(roof,w+1,.25,d+1,0,.12,0,mat);
  }
}
function getVisualSettings(){
 return {
  aesthetic:$('aestheticPreset').value,wall:$('wallColor').value,roof:$('roofColor').value,glass:$('glassColor').value,trim:$('trimColor').value,
  plan_line:$('planLineColor').value,plan_fill:$('planFillColor').value,line_width:+$('planLineWidth').value,
  room_count:+$('roomCount').value,partition_direction:$('partitionDirection').value,split_x:+$('primarySplitX').value/100,split_y:+$('primarySplitY').value/100,window_style:$('windowStyle').value,
  features:{balcony:$('featureBalcony').checked,columns:$('featureColumns').checked,fins:$('featureFins').checked,driveway:$('featureDriveway').checked,landscape:$('featureLandscape').checked,parapet:$('featureParapet').checked}
 };
}
function drawBuilding(){
 if(!buildingGroup)return;buildingGroup.clear();
 const w=clamp(+$('width').value||12,4,80),d=clamp(+$('depth').value||18,4,80),n=+$('storeys').value||2,h=clamp(+$('floorHeight').value||3.2,2.7,5),roof=$('roofType').value,v=getVisualSettings(),total=n*h;
 const wall=new THREE.MeshStandardMaterial({color:v.wall,roughness:.82}),slab=new THREE.MeshStandardMaterial({color:0x929eaa,roughness:.85}),roofMat=new THREE.MeshStandardMaterial({color:v.roof,roughness:.65}),glass=new THREE.MeshStandardMaterial({color:v.glass,metalness:.18,roughness:.22}),trim=new THREE.MeshStandardMaterial({color:v.trim,roughness:.55}),dark=new THREE.MeshStandardMaterial({color:0x27384a,roughness:.6});
 box(buildingGroup,w,.35,d,0,.18,0,slab);
 for(let floor=0;floor<n;floor++){
   const y=floor*h+h/2;box(buildingGroup,w,h,d,0,y,0,wall);box(buildingGroup,w+.15,.18,d+.15,0,floor*h+.09,0,slab);
   const count=Math.max(2,Math.floor(w/(v.window_style==='panoramic'?2.0:v.window_style==='wide'?2.4:2.8)));
   for(let i=0;i<count;i++){
    const x=-w/2+(i+1)*w/(count+1),ww=Math.min(v.window_style==='panoramic'?2.1:v.window_style==='wide'?1.8:1.45,w/count*.68),wh=v.window_style==='slim'?1.7:v.window_style==='panoramic'?1.45:1.25;
    box(buildingGroup,ww,wh,.08,x,y+.05,d/2+.045,glass);box(buildingGroup,ww,wh,.08,x,y+.05,-d/2-.045,glass);
    if(v.window_style!=='panoramic'){box(buildingGroup,.045,wh+.08,.1,x-ww/2,y+.05,d/2+.05,trim);box(buildingGroup,.045,wh+.08,.1,x+ww/2,y+.05,d/2+.05,trim)}
   }
   const sideCount=Math.max(2,Math.floor(d/3.5));for(let i=0;i<sideCount;i++){const z=-d/2+(i+1)*d/(sideCount+1);box(buildingGroup,.08,1.25,1.25,w/2+.045,y+.05,z,glass);box(buildingGroup,.08,1.25,1.25,-w/2-.045,y+.05,z,glass)}
   if(v.features.balcony&&floor>0){
    const bw=Math.min(w*.42,5.5);box(buildingGroup,bw,.18,1.35,0,floor*h+.2,d/2+.62,slab);
    box(buildingGroup,bw,.08,.08,0,floor*h+1.15,d/2+1.25,trim);
    for(let k=0;k<=6;k++)box(buildingGroup,.045,.9,.045,-bw/2+bw*k/6,floor*h+.68,d/2+1.25,trim);
   }
 }
 drawRoof(w,d,total,roof,roofMat);
 if(v.features.parapet){box(buildingGroup,w+1,.85,.16,0,total+.55,d/2+.35,wall);box(buildingGroup,w+1,.85,.16,0,total+.55,-d/2-.35,wall);box(buildingGroup,.16,.85,d, w/2+.35,total+.55,0,wall);box(buildingGroup,.16,.85,d,-w/2-.35,total+.55,0,wall)}
 const doorMat=new THREE.MeshStandardMaterial({color:0x654b37});box(buildingGroup,1.1,2.25,.12,0,1.15,d/2+.08,doorMat);
 if(v.features.columns){for(const x of [-1.1,1.1]){const col=new THREE.Mesh(new THREE.BoxGeometry(.34,3.1,.34),trim);col.position.set(x,1.55,d/2+.48);col.castShadow=true;buildingGroup.add(col)}}
 if(v.features.fins){for(let i=0;i<7;i++){const x=-w*.38+i*w*.125;box(buildingGroup,.12,total*.82,.22,x,total*.48,d/2+.16,trim)}}
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:0xdce6d9}));ground.rotation.x=-Math.PI/2;ground.position.y=-.12;buildingGroup.add(ground);
 if(v.features.driveway){const drive=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w*.72,7),Math.min(d*.55,10)),new THREE.MeshStandardMaterial({color:0x858b91,roughness:.95}));drive.rotation.x=-Math.PI/2;drive.position.set(0,-.105,d/2+Math.min(d*.25,4));buildingGroup.add(drive)}
 if(v.features.landscape){for(const x of [-w*.65,w*.65]){const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.12,.18,1.2,8),new THREE.MeshStandardMaterial({color:0x76553b}));trunk.position.set(x,.5,d*.28);buildingGroup.add(trunk);const crown=new THREE.Mesh(new THREE.SphereGeometry(.85,10,8),new THREE.MeshStandardMaterial({color:0x43835a}));crown.position.set(x,1.65,d*.28);buildingGroup.add(crown)}}
 $('footprintValue').textContent=(w*d).toFixed(1)+' m²';$('storeyValue').textContent=String(n);$('roofValue').textContent=roofLabels[roof]||roof;
 if(camera){controls.target.set(0,total*.45,0);camera.position.set(Math.max(w,d)*1.6,total+Math.max(w,d)*.8,Math.max(w,d)*1.8);controls.update()}
 drawPlan(w,d,n,v);
}
function drawPlan(w,d,n,v=getVisualSettings()){
 const sx=430,sy=170,pad=36,scale=Math.min((sx-2*pad)/w,(sy-2*pad)/d),rw=w*scale,rd=d*scale,x=(sx-rw)/2,y=(sy-rd)/2;
 const rooms=clamp(v.room_count,2,6),lw=v.line_width;let partitions='';
 if(v.partition_direction==='vertical'||v.partition_direction==='mixed'){for(let i=1;i<rooms;i++){const ratio=i===1?v.split_x:(v.split_x+(1-v.split_x)*(i-1)/(rooms-1));const px=x+rw*ratio;partitions+=`<line x1="${px}" y1="${y}" x2="${px}" y2="${y+rd}" stroke="${v.plan_line}" stroke-width="${lw}" stroke-dasharray="4 2"/>`}}
 if(v.partition_direction==='horizontal'||v.partition_direction==='mixed'){const count=v.partition_direction==='mixed'?2:rooms-1;for(let i=1;i<=count;i++){const ratio=i===1?v.split_y:(v.split_y+(1-v.split_y)*(i-1)/count);const py=y+rd*ratio;partitions+=`<line x1="${x}" y1="${py}" x2="${x+rw}" y2="${py}" stroke="${v.plan_line}" stroke-width="${lw}"/>`}}
 $('planDrawing').innerHTML=`<svg viewBox="0 0 430 170" role="img" aria-label="Indicative footprint ${w} by ${d} metres"><rect x="${x}" y="${y}" width="${rw}" height="${rd}" fill="${v.plan_fill}" stroke="${v.plan_line}" stroke-width="${lw+1.5}"/>${partitions}<text x="215" y="15" font-size="10" fill="${v.plan_line}" text-anchor="middle">${w.toFixed(1)} m</text><text x="12" y="85" font-size="10" fill="${v.plan_line}" transform="rotate(-90 12 85)" text-anchor="middle">${d.toFixed(1)} m</text><text x="215" y="165" font-size="9" fill="#708197" text-anchor="middle">${n}-storey indicative zoning · ${rooms} divisions · concept only</text></svg>`;
}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function collectBrief(){return {client_name:$('clientName').value.trim(),client_email:$('clientEmail').value.trim()||null,client_phone:$('clientPhone').value.trim()||null,project_name:$('projectName').value.trim(),project_type:$('projectType').value,site_location:$('siteLocation').value.trim()||null,site_dimensions:{width_m:+$('width').value,depth_m:+$('depth').value,floor_height_m:+$('floorHeight').value,storeys:+$('storeys').value,footprint_m2:+$('width').value*+$('depth').value},building_requirements:{description:$('requirements').value.trim(),roof_type:$('roofType').value,custom_roof_description:$('customRoof').value.trim()||null},visual_settings:getVisualSettings()}}
async function saveDesign(e){e?.preventDefault();if(!currentUser){$('formStatus').textContent='Please sign in to your TW&D client account, then return here to save your project.';return}
 const b=collectBrief();if(!b.client_name||!b.project_name||b.site_dimensions.width_m<4||b.site_dimensions.depth_m<4){$('formStatus').textContent='Please enter a client name, project name and valid building dimensions.';return}
 if(b.building_requirements.roof_type==='custom'&&!b.building_requirements.custom_roof_description){$('formStatus').textContent='Please describe your custom roof.';return}
 $('saveProject').disabled=true;$('formStatus').textContent='Saving your design brief securely…';
 try{
   let result;
   if(currentProjectId){result=await supabase.from('design_projects').update({client_name:b.client_name,client_email:b.client_email,client_phone:b.client_phone,project_name:b.project_name,project_type:b.project_type,site_location:b.site_location,site_dimensions:b.site_dimensions,building_requirements:b.building_requirements,roof_type:b.building_requirements.roof_type,custom_roof_description:b.building_requirements.custom_roof_description,latest_revision:currentRevision+1}).eq('id',currentProjectId).select().single()}
   else{result=await supabase.from('design_projects').insert({owner_id:currentUser.id,...b,site_dimensions:b.site_dimensions,building_requirements:b.building_requirements,roof_type:b.building_requirements.roof_type,custom_roof_description:b.building_requirements.custom_roof_description}).select().single()}
   if(result.error)throw result.error;currentProjectId=result.data.id;currentRevision=result.data.latest_revision||1;
   const rev=await supabase.from('design_revisions').insert({design_project_id:currentProjectId,revision_number:currentRevision,design_inputs:b,generated_geometry:{type:'concept_mass_model',width_m:b.site_dimensions.width_m,depth_m:b.site_dimensions.depth_m,storeys:b.site_dimensions.storeys,floor_height_m:b.site_dimensions.floor_height_m,roof_type:b.building_requirements.roof_type,visual_settings:b.visual_settings},change_summary:'Design brief saved from TW&D Design Studio',created_by:currentUser.id});
   if(rev.error)throw rev.error;
   $('formStatus').textContent='Design brief saved to your secure TW&D workspace. Reference: '+currentProjectId;
   $('quoteStatus').textContent='Your design brief is saved. You can now save estimate items against this project.';
 }catch(err){console.error(err);$('formStatus').textContent='Could not save this brief: '+(err.message||'Please sign in and try again.')}
 finally{$('saveProject').disabled=false}
}
function addQuoteRow(data={}){const tr=document.createElement('tr');tr.innerHTML='<td><input class="desc-input" placeholder="e.g. 150mm concrete blocks" aria-label="Description"></td><td><input class="unit-input" placeholder="pcs" aria-label="Unit"></td><td><input class="num-input qty" type="number" min="0" step=".01" value="0" aria-label="Quantity"></td><td><input class="num-input rate" type="number" min="0" step=".01" value="0" aria-label="Unit rate"></td><td class="amount">₦0.00</td><td><button type="button" class="remove-row" aria-label="Remove row">×</button></td>';
 tr.querySelector('.desc-input').value=data.description||'';tr.querySelector('.unit-input').value=data.unit||'';tr.querySelector('.qty').value=data.quantity??0;tr.querySelector('.rate').value=data.unit_rate??0;
 tr.addEventListener('input',updateTotals);tr.querySelector('.remove-row').addEventListener('click',()=>{tr.remove();updateTotals()});$('quoteRows').appendChild(tr);updateTotals()}
function getQuoteItems(){return [...$('quoteRows').querySelectorAll('tr')].map(tr=>({description:tr.querySelector('.desc-input').value.trim(),unit:tr.querySelector('.unit-input').value.trim()||'item',quantity:+tr.querySelector('.qty').value,unit_rate:+tr.querySelector('.rate').value})).filter(x=>x.description&&x.quantity>0&&x.unit_rate>=0)}
function updateTotals(){let total=0;for(const tr of $('quoteRows').querySelectorAll('tr')){const amount=(+tr.querySelector('.qty').value||0)*(+tr.querySelector('.rate').value||0);tr.querySelector('.amount').textContent=money(amount);total+=amount}$('quoteTotal').textContent=money(total)}
function money(v){return new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN'}).format(v)}
async function saveQuote(){if(!currentUser){$('quoteStatus').textContent='Sign in to save an estimate.';return}if(!currentProjectId){$('quoteStatus').textContent='Save the design brief first.';return}
 const items=getQuoteItems();if(!items.length){$('quoteStatus').textContent='Add at least one item with a description, quantity and confirmed unit rate.';return}
 $('saveQuote').disabled=true;$('quoteStatus').textContent='Saving estimate…';
 try{
  const brief=collectBrief();const project=await supabase.from('boq_projects').insert({created_by:currentUser.id,client_name:brief.client_name,client_email:brief.client_email,client_phone:brief.client_phone,project_name:brief.project_name,project_type:brief.project_type,project_location:brief.site_location,dimensions:brief.site_dimensions,scope_notes:'Preliminary client-entered estimate linked to TW&D Design Studio project '+currentProjectId,status:'DRAFT',contingency_percent:0,tax_percent:0}).select().single();
  if(project.error)throw project.error;
  const inserted=await supabase.from('boq_items').insert(items.map((x,i)=>({project_id:project.data.id,section:'Preliminary estimate',description:x.description,unit:x.unit,quantity:x.quantity,unit_rate:x.unit_rate,sort_order:i+1})));
  if(inserted.error)throw inserted.error;
  const totals=await supabase.rpc('refresh_boq_totals',{p_project_id:project.data.id});if(totals.error)throw totals.error;
  const link=await supabase.from('design_projects').update({quotation_id:project.data.id}).eq('id',currentProjectId);if(link.error)throw link.error;
  $('quoteStatus').textContent='Estimate saved as draft. BOQ reference: '+project.data.id+'. It is not yet approved or issued.';
 }catch(err){console.error(err);$('quoteStatus').textContent='Could not save estimate: '+(err.message||'Please check your account permissions.')}
 finally{$('saveQuote').disabled=false}
}

async function loadApprovedRates(){
 if(!currentUser)return;
 const today=new Date().toISOString().slice(0,10);
 const r=await supabase.from('boq_price_catalog').select('id,description,unit,unit_rate,price_source,source_location,valid_until').eq('active',true).lte('valid_from',today).or('valid_until.is.null,valid_until.gte.'+today).order('description');
 if(r.error){$('priceListStatus').textContent=r.error.message;return}
 const s=$('approvedRateSelect');s.innerHTML='<option value="">Choose approved price</option>';
 (r.data||[]).forEach(x=>{const o=document.createElement('option');o.value=x.id;o.textContent=x.description+' — '+money(Number(x.unit_rate))+'/'+x.unit+' — '+(x.source_location||'location not specified');o.dataset.item=JSON.stringify(x);s.appendChild(o)});
 $('priceListStatus').textContent=(r.data||[]).length+' approved rates available.';
}
async function submitSupplierQuote(e){
 e.preventDefault();if(!currentUser){$('supplierStatus').textContent='Sign in first.';return}
 const x={supplier_name:$('supplierName').value.trim(),supplier_contact:$('supplierContact').value.trim()||null,supplier_email:$('supplierEmail').value.trim()||null,supplier_phone:$('supplierPhone').value.trim()||null,item_description:$('supplierItem').value.trim(),category:$('supplierCategory').value.trim(),unit:$('supplierUnit').value.trim(),unit_rate:Number($('supplierRate').value),location:$('supplierLocation').value.trim()||null,quote_reference:$('supplierReference').value.trim()||null,evidence_url:$('supplierEvidence').value.trim()||null,valid_until:$('supplierValidUntil').value||null,submitted_by:currentUser.id};
 const r=await supabase.from('boq_supplier_quotes').insert(x);$('supplierStatus').textContent=r.error?r.error.message:'Supplier quotation submitted for TW&D review.';if(!r.error)$('supplierQuoteForm').reset();
}
async function loadInvoices(){
 if(!currentUser)return;const r=await supabase.from('design_payment_orders').select('id,invoice_number,purpose,amount,status,created_at').eq('owner_id',currentUser.id).order('created_at',{ascending:false});
 if(r.error){$('paymentStatus').textContent=r.error.message;return}
 $('invoiceList').innerHTML=(r.data||[]).map(x=>'<div class="invoice-card"><div><strong>'+x.invoice_number+' · '+x.purpose+'</strong><small>'+new Date(x.created_at).toLocaleDateString('en-NG')+' · '+x.status+'</small></div><div class="invoice-amount">'+money(Number(x.amount))+'</div>'+(x.status==='pending'||x.status==='failed'||x.status==='cancelled'||x.status==='processing'?'<button class="primary pay-invoice" data-id="'+x.id+'">Pay with Flutterwave</button>':'')+'</div>').join('')||'<p>No TW&D design invoices have been issued to this account yet.</p>';
}
async function startInvoicePayment(e){
 const b=e.target.closest('.pay-invoice');if(!b)return;b.disabled=true;
 const r=await supabase.functions.invoke('flutterwave-checkout',{body:{action:'create',invoice_id:b.dataset.id}});
 if(r.error||!r.data?.checkout_url){b.disabled=false;$('paymentStatus').textContent=r.data?.error||r.error?.message||'Unable to start payment.';return}
 location.assign(r.data.checkout_url);
}
async function setupAdmin(){
 if(!currentUser)return;const a=await supabase.rpc('is_admin'),b=await supabase.rpc('is_boq_staff');if(a.data!==true&&b.data!==true)return;
 $('adminPanel').hidden=false;
 const p=await supabase.from('design_projects').select('id,owner_id,client_name,project_name').order('created_at',{ascending:false}).limit(100);
 $('invoiceProjectSelect').innerHTML='<option value="">Choose project</option>';
 (p.data||[]).forEach(x=>{const o=document.createElement('option');o.value=x.id;o.dataset.owner=x.owner_id;o.textContent=x.project_name+' — '+x.client_name+' — '+x.id.slice(0,8);$('invoiceProjectSelect').appendChild(o)});
 await loadAdminRates();await loadSupplierReview();
}
async function loadAdminRates(){
 const r=await supabase.from('boq_price_catalog').select('*').order('description').limit(200);if(r.error){$('adminCatalogList').textContent=r.error.message;return}
 $('adminCatalogList').innerHTML='<div class="admin-table-wrap"><table class="admin-table"><tr><th>Item</th><th>Rate</th><th>Source</th><th>Action</th></tr>'+(r.data||[]).map(x=>'<tr><td>'+x.description+' ('+x.unit+')</td><td>'+money(Number(x.unit_rate))+'</td><td>'+(x.price_source||'admin')+' / '+(x.source_location||x.supplier_name||'—')+'</td><td><button class="secondary edit-rate" data-id="'+x.id+'">Use as template</button> <button class="secondary toggle-rate" data-id="'+x.id+'" data-active="'+x.active+'">'+(x.active?'Deactivate':'Activate')+'</button></td></tr>').join('')+'</table></div>';
}
async function loadSupplierReview(){
 const r=await supabase.from('boq_supplier_quotes').select('*').eq('status','pending').order('created_at',{ascending:false});if(r.error){$('supplierReviewList').textContent=r.error.message;return}
 $('supplierReviewList').innerHTML=(r.data||[]).map(x=>'<div class="invoice-card"><div><strong>'+x.supplier_name+' — '+x.item_description+'</strong><small>'+money(Number(x.unit_rate))+'/'+x.unit+' · '+(x.location||'location not stated')+'</small></div><button class="primary approve-supplier" data-id="'+x.id+'">Approve</button><button class="secondary reject-supplier" data-id="'+x.id+'">Reject</button></div>').join('')||'No pending supplier quotations.';
}
async function saveAdminRate(e){
 e.preventDefault();const r=await supabase.from('boq_price_catalog').insert({category:$('adminRateCategory').value.trim(),description:$('adminRateDescription').value.trim(),unit:$('adminRateUnit').value.trim(),unit_rate:Number($('adminRateValue').value),currency:'NGN',active:true,price_source:'admin',source_location:$('adminRateLocation').value.trim()||null,valid_from:new Date().toISOString().slice(0,10),valid_until:$('adminRateExpiry').value||null,updated_by:currentUser.id});
 $('adminRateStatus').textContent=r.error?r.error.message:'Admin price added.';if(!r.error){$('adminRateForm').reset();await loadAdminRates();await loadApprovedRates()}
}
async function adminActions(e){
 const edit=e.target.closest('.edit-rate'),toggle=e.target.closest('.toggle-rate');if(edit){const r=await supabase.from('boq_price_catalog').select('*').eq('id',edit.dataset.id).single();if(r.data){$('adminRateCategory').value=r.data.category;$('adminRateDescription').value=r.data.description;$('adminRateUnit').value=r.data.unit;$('adminRateValue').value=r.data.unit_rate;$('adminRateLocation').value=r.data.source_location||'';$('adminRateExpiry').value=r.data.valid_until||'';$('adminRateStatus').textContent='Template copied into the form. Saving creates a new rate; deactivate the old rate to preserve its price history.'}return}
 if(toggle){const r=await supabase.from('boq_price_catalog').update({active:toggle.dataset.active!=='true',updated_by:currentUser.id}).eq('id',toggle.dataset.id);if(r.error)alert(r.error.message);await loadAdminRates();await loadApprovedRates()}
}
async function reviewSupplier(e){
 const b=e.target.closest('.approve-supplier'),n=e.target.closest('.reject-supplier');if(!b&&!n)return;const id=(b||n).dataset.id;
 const q=await supabase.from('boq_supplier_quotes').select('*').eq('id',id).single();if(q.error){alert(q.error.message);return}
 const x=q.data;let catalogId=null;
 if(b){const c=await supabase.from('boq_price_catalog').insert({category:x.category,description:x.item_description,unit:x.unit,unit_rate:x.unit_rate,currency:'NGN',active:true,price_source:'supplier',supplier_name:x.supplier_name,source_location:x.location,source_reference:x.quote_reference,valid_from:x.quoted_at,valid_until:x.valid_until,updated_by:currentUser.id}).select().single();if(c.error){alert(c.error.message);return}catalogId=c.data.id}
 const u=await supabase.from('boq_supplier_quotes').update({status:b?'approved':'rejected',reviewed_by:currentUser.id,reviewed_at:new Date().toISOString(),catalog_item_id:catalogId}).eq('id',id);if(u.error)alert(u.error.message);
 await loadSupplierReview();await loadAdminRates();await loadApprovedRates();
}
async function issueInvoice(e){
 e.preventDefault();const p=$('invoiceProjectSelect').selectedOptions[0];if(!p?.value)return;
 const r=await supabase.from('design_payment_orders').insert({design_project_id:p.value,owner_id:p.dataset.owner,invoice_number:'TWD-DS-'+Date.now(),purpose:$('invoicePurpose').value.trim(),amount:Number($('invoiceAmount').value),currency:'NGN',created_by:currentUser.id,status:'pending'});
 $('invoiceAdminStatus').textContent=r.error?r.error.message:'Invoice issued.';if(!r.error){await supabase.from('design_projects').update({payment_status:'pending'}).eq('id',p.value);$('invoiceForm').reset();await loadInvoices()}
}
async function verifyReturn(){
 const q=new URLSearchParams(location.search),ref=q.get('tx_ref'),id=q.get('transaction_id');if(!ref)return;
 if(id){$('paymentStatus').textContent='Verifying payment…';const r=await supabase.functions.invoke('flutterwave-checkout',{body:{action:'verify',tx_ref:ref,transaction_id:id}});$('paymentStatus').textContent=r.error?r.error.message:(r.data?.paid?'Payment verified and invoice marked paid.':r.data?.message||'Payment is not yet verified.')}
 history.replaceState({},document.title,location.pathname);await loadInvoices();
}
async function initDesignWorkspace(){if(!currentUser)return;await Promise.all([loadApprovedRates(),loadInvoices(),setupAdmin()]);await verifyReturn()}

$('roofType').addEventListener('change',()=>{$('customRoofWrap').hidden=$('roofType').value!=='custom';drawBuilding()});

const aestheticPalettes={
 modern:{wall:'#e7e4dc',roof:'#233b57',glass:'#79b6d4',trim:'#ffffff',line:'#42617d',fill:'#f7fafc'},
 luxury:{wall:'#d8d0c1',roof:'#292d36',glass:'#6c9fb8',trim:'#c5a56a',line:'#243b53',fill:'#f5f0e7'},
 classic:{wall:'#efe6d5',roof:'#713f32',glass:'#83b4c9',trim:'#fffaf0',line:'#745b49',fill:'#fbf6ed'},
 tropical:{wall:'#e8e0c9',roof:'#344c3c',glass:'#6ea8b5',trim:'#f4ead3',line:'#46664f',fill:'#f4f6e9'},
 industrial:{wall:'#bfc5c9',roof:'#343a40',glass:'#668fa5',trim:'#e2e5e7',line:'#374a59',fill:'#edf1f3'}
};
function applyAesthetic(){
 const p=aestheticPalettes[$('aestheticPreset').value];if(!p)return;
 $('wallColor').value=p.wall;$('roofColor').value=p.roof;$('glassColor').value=p.glass;$('trimColor').value=p.trim;$('planLineColor').value=p.line;$('planFillColor').value=p.fill;drawBuilding();
}
$('aestheticPreset').addEventListener('change',applyAesthetic);
['wallColor','roofColor','glassColor','trimColor','planLineColor','planFillColor','planLineWidth','roomCount','partitionDirection','primarySplitX','primarySplitY','windowStyle','featureBalcony','featureColumns','featureFins','featureDriveway','featureLandscape','featureParapet'].forEach(id=>$(id).addEventListener('input',drawBuilding));

['width','depth','floorHeight','storeys'].forEach(id=>$(id).addEventListener('input',drawBuilding));
$('refreshPreview').addEventListener('click',drawBuilding);$('viewReset').addEventListener('click',drawBuilding);
$('designForm').addEventListener('submit',saveDesign);$('addQuoteRow').addEventListener('click',()=>addQuoteRow());$('saveQuote').addEventListener('click',saveQuote);$('printBrief').addEventListener('click',()=>window.print());
$('downloadGlb').addEventListener('click',()=>{if(!buildingGroup)return;const exporter=new GLTFExporter();$('viewerStatus').textContent='Preparing 3D model file…';exporter.parse(buildingGroup,result=>{const blob=new Blob([result],{type:'model/gltf-binary'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='twd-building-concept-preview.glb';a.click();URL.revokeObjectURL(url);$('viewerStatus').textContent='Concept model exported as GLB. This is a visual massing model, not a CAD or structural file.';},error=>{$('viewerStatus').textContent='Model export failed: '+(error.message||'Please try again.');},{binary:true});});
$('downloadSvg').addEventListener('click',()=>{const svg=$('planDrawing').querySelector('svg');if(!svg)return;const blob=new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='twd-footprint-concept.svg';a.click();URL.revokeObjectURL(url);});
addQuoteRow();setup3D();
$('addCatalogRate').addEventListener('click',()=>{const o=$('approvedRateSelect').selectedOptions[0];if(o?.dataset.item){const x=JSON.parse(o.dataset.item);addQuoteRow({description:x.description,unit:x.unit,unit_rate:x.unit_rate});}});
$('refreshPriceList').addEventListener('click',loadApprovedRates);
$('supplierQuoteForm').addEventListener('submit',submitSupplierQuote);
$('invoiceList').addEventListener('click',startInvoicePayment);
$('adminRateForm').addEventListener('submit',saveAdminRate);
$('adminCatalogList').addEventListener('click',adminActions);
$('supplierReviewList').addEventListener('click',reviewSupplier);
$('invoiceForm').addEventListener('submit',issueInvoice);
$('cancelRateEdit').addEventListener('click',()=>{$('adminRateForm').reset();$('cancelRateEdit').hidden=true;});
const {data:{session}}=await supabase.auth.getSession();currentUser=session?.user||null;
supabase.auth.onAuthStateChange((_event,s)=>{currentUser=s?.user||null;if(currentUser){$('formStatus').textContent='Signed in. Your design brief can be saved securely.';initDesignWorkspace()}});
if(!currentUser){$('formStatus').innerHTML='Sign in is required to save projects. <a href="account.html">Open your TW&D client account</a>.'}else{initDesignWorkspace()}
