import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';

const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=id=>document.getElementById(id);
const roofLabels={contemporary_flat:'Flat',conventional_gable:'Gable',hip:'Hip',butterfly:'Butterfly',mono_pitch:'Mono-pitch',combination:'Combination',mansard:'Mansard',custom:'Custom'};
let currentUser=null,currentProjectId=null,renderer,scene,camera,controls,buildingGroup;
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
function drawBuilding(){
 if(!buildingGroup)return;buildingGroup.clear();
 const w=clamp(+$('width').value||12,4,80),d=clamp(+$('depth').value||18,4,80),n=+$('storeys').value||2,h=clamp(+$('floorHeight').value||3.2,2.7,5),roof=$('roofType').value,total=n*h;
 const wall=new THREE.MeshStandardMaterial({color:0xe7e4dc,roughness:.82}),slab=new THREE.MeshStandardMaterial({color:0x929eaa,roughness:.85}),roofMat=new THREE.MeshStandardMaterial({color:0x233b57,roughness:.65}),glass=new THREE.MeshStandardMaterial({color:0x79b6d4,metalness:.18,roughness:.22});
 box(buildingGroup,w,.35,d,0,.18,0,slab);
 for(let floor=0;floor<n;floor++){
   const y=floor*h+h/2;
   box(buildingGroup,w,h,d,0,y,0,wall);
   box(buildingGroup,w+.15,.18,d+.15,0,floor*h+.09,0,slab);
   const count=Math.max(2,Math.floor(w/2.8));
   for(let i=0;i<count;i++){const x=-w/2+(i+1)*w/(count+1);box(buildingGroup,Math.min(1.45,w/count*.55),1.25,.08,x,y+.05,d/2+.045,glass);box(buildingGroup,Math.min(1.45,w/count*.55),1.25,.08,x,y+.05,-d/2-.045,glass)}
   const sideCount=Math.max(2,Math.floor(d/3.5));for(let i=0;i<sideCount;i++){const z=-d/2+(i+1)*d/(sideCount+1);box(buildingGroup,.08,1.25,1.25,w/2+.045,y+.05,z,glass);box(buildingGroup,.08,1.25,1.25,-w/2-.045,y+.05,z,glass)}
 }
 drawRoof(w,d,total,roof,roofMat);
 const doorMat=new THREE.MeshStandardMaterial({color:0x654b37});box(buildingGroup,1.1,2.25,.12,0,1.15,d/2+.08,doorMat);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:0xdce6d9}));ground.rotation.x=-Math.PI/2;ground.position.y=-.12;buildingGroup.add(ground);
 $('footprintValue').textContent=(w*d).toFixed(1)+' m²';$('storeyValue').textContent=String(n);$('roofValue').textContent=roofLabels[roof]||roof;
 if(camera){controls.target.set(0,total*.45,0);camera.position.set(Math.max(w,d)*1.6,total+Math.max(w,d)*.8,Math.max(w,d)*1.8);controls.update()}
 drawPlan(w,d,n);
}
function drawPlan(w,d,n){
 const sx=430,sy=150,pad=36,scale=Math.min((sx-2*pad)/w,(sy-2*pad)/d),rw=w*scale,rd=d*scale,x=(sx-rw)/2,y=(sy-rd)/2;
 const rooms=Math.max(2,Math.min(5,Math.round(w/3)));let partitions='';
 for(let i=1;i<rooms;i++){const px=x+rw*i/rooms;partitions+=`<line x1="${px}" y1="${y}" x2="${px}" y2="${y+rd}" stroke="#42617d" stroke-width="1.4" stroke-dasharray="4 2"/>`}
 const horizontal=y+rd*.52;partitions+=`<line x1="${x}" y1="${horizontal}" x2="${x+rw}" y2="${horizontal}" stroke="#42617d" stroke-width="1.4"/>`;
 $('planDrawing').innerHTML=`<svg viewBox="0 0 430 150" role="img" aria-label="Indicative footprint ${w} by ${d} metres"><rect x="${x}" y="${y}" width="${rw}" height="${rd}" fill="#f7fafc" stroke="#143b63" stroke-width="3"/>${partitions}<text x="215" y="15" font-size="10" fill="#50647a" text-anchor="middle">${w.toFixed(1)} m</text><text x="12" y="78" font-size="10" fill="#50647a" transform="rotate(-90 12 78)" text-anchor="middle">${d.toFixed(1)} m</text><text x="215" y="145" font-size="9" fill="#708197" text-anchor="middle">${n}-storey massing footprint · indicative layout only</text></svg>`;
}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function collectBrief(){return {client_name:$('clientName').value.trim(),client_email:$('clientEmail').value.trim()||null,client_phone:$('clientPhone').value.trim()||null,project_name:$('projectName').value.trim(),project_type:$('projectType').value,site_location:$('siteLocation').value.trim()||null,site_dimensions:{width_m:+$('width').value,depth_m:+$('depth').value,floor_height_m:+$('floorHeight').value,storeys:+$('storeys').value,footprint_m2:+$('width').value*+$('depth').value},building_requirements:{description:$('requirements').value.trim(),roof_type:$('roofType').value,custom_roof_description:$('customRoof').value.trim()||null}}}
async function saveDesign(e){e?.preventDefault();if(!currentUser){$('formStatus').textContent='Please sign in to your TW&D client account, then return here to save your project.';return}
 const b=collectBrief();if(!b.client_name||!b.project_name||b.site_dimensions.width_m<4||b.site_dimensions.depth_m<4){$('formStatus').textContent='Please enter a client name, project name and valid building dimensions.';return}
 if(b.building_requirements.roof_type==='custom'&&!b.building_requirements.custom_roof_description){$('formStatus').textContent='Please describe your custom roof.';return}
 $('saveProject').disabled=true;$('formStatus').textContent='Saving your design brief securely…';
 try{
   let result;
   if(currentProjectId){result=await supabase.from('design_projects').update({client_name:b.client_name,client_email:b.client_email,client_phone:b.client_phone,project_name:b.project_name,project_type:b.project_type,site_location:b.site_location,site_dimensions:b.site_dimensions,building_requirements:b.building_requirements,roof_type:b.building_requirements.roof_type,custom_roof_description:b.building_requirements.custom_roof_description,latest_revision:2}).eq('id',currentProjectId).select().single()}
   else{result=await supabase.from('design_projects').insert({owner_id:currentUser.id,...b,site_dimensions:b.site_dimensions,building_requirements:b.building_requirements,roof_type:b.building_requirements.roof_type,custom_roof_description:b.building_requirements.custom_roof_description}).select().single()}
   if(result.error)throw result.error;currentProjectId=result.data.id;
   const rev=await supabase.from('design_revisions').insert({design_project_id:currentProjectId,revision_number:currentProjectId?result.data.latest_revision||1:1,design_inputs:b,generated_geometry:{type:'concept_mass_model',width_m:b.site_dimensions.width_m,depth_m:b.site_dimensions.depth_m,storeys:b.site_dimensions.storeys,floor_height_m:b.site_dimensions.floor_height_m,roof_type:b.building_requirements.roof_type},change_summary:'Design brief saved from TW&D Design Studio',created_by:currentUser.id});
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
$('roofType').addEventListener('change',()=>{$('customRoofWrap').hidden=$('roofType').value!=='custom';drawBuilding()});
['width','depth','floorHeight','storeys'].forEach(id=>$(id).addEventListener('input',drawBuilding));
$('refreshPreview').addEventListener('click',drawBuilding);$('viewReset').addEventListener('click',drawBuilding);
$('designForm').addEventListener('submit',saveDesign);$('addQuoteRow').addEventListener('click',()=>addQuoteRow());$('saveQuote').addEventListener('click',saveQuote);$('printBrief').addEventListener('click',()=>window.print());
addQuoteRow();setup3D();
const {data:{session}}=await supabase.auth.getSession();currentUser=session?.user||null;
supabase.auth.onAuthStateChange((_event,s)=>{currentUser=s?.user||null;if(currentUser)$('formStatus').textContent='Signed in. Your design brief can be saved securely.'});
if(!currentUser){$('formStatus').innerHTML='Sign in is required to save projects. <a href="account.html">Open your TW&D client account</a>.'}
