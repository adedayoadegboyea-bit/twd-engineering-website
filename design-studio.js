import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import * as THREE from 'https://esm.sh/three@0.180.0';
import { OrbitControls } from 'https://esm.sh/three@0.180.0/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'https://esm.sh/three@0.180.0/examples/jsm/exporters/GLTFExporter.js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';

const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=id=>document.getElementById(id);
const roofLabels={contemporary_flat:'Flat',conventional_gable:'Gable',hip:'Hip',butterfly:'Butterfly',mono_pitch:'Mono-pitch',combination:'Combination',mansard:'Mansard',custom:'Custom'};
let currentUser=null,currentProjectId=null,currentRevision=0,renderer,scene,camera,controls,buildingGroup;
const floorRoomNames={ground:'Reception, Living room, Dining, Kitchen, Bedroom 1, Bedroom 2',first:'Family lounge, Master bedroom, Bedroom 2, Bedroom 3, Study, Balcony',second:'Bedrooms, Lounge, Bathroom, Store, Terrace',third:'Bedrooms, Lounge, Bathroom, Store, Terrace',fourth:'Bedrooms, Lounge, Bathroom, Store, Terrace'};
const floorLayouts={ground:{room_count:4,split_x:.5,split_y:.52,partition_direction:'mixed'},first:{room_count:4,split_x:.5,split_y:.52,partition_direction:'mixed'},second:{room_count:4,split_x:.5,split_y:.52,partition_direction:'mixed'},third:{room_count:4,split_x:.5,split_y:.52,partition_direction:'mixed'},fourth:{room_count:4,split_x:.5,split_y:.52,partition_direction:'mixed'}};
let activeFloorKey='ground';
const floorRoomInteriors={ground:{},first:{},second:{},third:{},fourth:{}};
let activeRoomIndex=0,activeRoomFloorKey='ground';
const defaultRoomInterior=()=>({floor_finish:'porcelain',wall_finish:'paint',tile_color:'#d8d4ca',wall_color:'#f1eee7',lighting:'warm',furniture:'family',sanitary:'full',ceiling:'plain',door:'timber',storage:'standard'});
function roomListForActiveFloor(){return ($('roomNames').value||'Room 1').split(',').map(x=>x.trim()).filter(Boolean).slice(0,12);}
function roomInteriorKey(index){return String(index);}
function saveActiveRoomInterior(){const level=activeRoomFloorKey,key=roomInteriorKey(activeRoomIndex);floorRoomInteriors[level][key]={floor_finish:$('roomFloorFinish').value,wall_finish:$('roomWallFinish').value,tile_color:$('roomTileColor').value,wall_color:$('roomWallColor').value,lighting:$('roomLighting').value,furniture:$('roomFurniture').value,sanitary:$('roomSanitary').value,ceiling:$('roomCeiling').value,door:$('roomDoor').value,storage:$('roomStorage').value};}
function loadActiveRoomInterior(){activeRoomFloorKey=$('floorPlanLevel').value;const names=roomListForActiveFloor(),sel=$('roomEditSelect');if(!sel)return;sel.innerHTML=names.map((name,i)=>'<option value="'+i+'">'+escapeHtml(name||('Room '+(i+1)))+'</option>').join('')||'<option value="0">Room 1</option>';activeRoomIndex=Math.min(activeRoomIndex,Math.max(0,names.length-1));sel.value=String(activeRoomIndex);const cfg=floorRoomInteriors[$('floorPlanLevel').value][roomInteriorKey(activeRoomIndex)]||defaultRoomInterior();$('roomFloorFinish').value=cfg.floor_finish;$('roomWallFinish').value=cfg.wall_finish;$('roomTileColor').value=cfg.tile_color;$('roomWallColor').value=cfg.wall_color;$('roomLighting').value=cfg.lighting;$('roomFurniture').value=cfg.furniture;$('roomSanitary').value=cfg.sanitary;$('roomCeiling').value=cfg.ceiling||'plain';$('roomDoor').value=cfg.door||'timber';$('roomStorage').value=cfg.storage||'standard';$('roomEditorStatus').textContent='Editing '+(names[activeRoomIndex]||('Room '+(activeRoomIndex+1)))+' on the '+$('floorPlanLevel').selectedOptions[0].text+'.';}
function roomEditorChanged(){saveActiveRoomInterior();drawBuilding();}

const viewer=$('viewer');
const textureCache=new Map();
function makeCanvasTexture(kind){
 if(textureCache.has(kind))return textureCache.get(kind);
 const c=document.createElement('canvas');c.width=512;c.height=512;const ctx=c.getContext('2d');
 if(kind==='grass'){
  ctx.fillStyle='#667b4d';ctx.fillRect(0,0,512,512);
  for(let i=0;i<16000;i++){const x=Math.random()*512,y=Math.random()*512;ctx.fillStyle=Math.random()>.5?'rgba(35,65,28,.22)':'rgba(190,190,120,.12)';ctx.fillRect(x,y,1.5,3.5)}
 }else if(kind==='stucco'||kind==='stone'){
  ctx.fillStyle=kind==='stone'?'#b9b1a3':'#dedbd3';ctx.fillRect(0,0,512,512);
  for(let i=0;i<18000;i++){const x=Math.random()*512,y=Math.random()*512,a=Math.random()*.11;ctx.fillStyle='rgba(65,58,48,'+a+')';ctx.fillRect(x,y,1+Math.random()*3,1+Math.random()*3)}
  if(kind==='stone'){ctx.strokeStyle='rgba(95,85,72,.22)';ctx.lineWidth=2;for(let y=0;y<512;y+=128){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(512,y);ctx.stroke()}for(let x=0;x<512;x+=170){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,512);ctx.stroke()}}
 }else if(kind==='wood'){
  ctx.fillStyle='#795039';ctx.fillRect(0,0,512,512);
  for(let i=0;i<75;i++){ctx.strokeStyle=i%3?'rgba(36,20,12,.19)':'rgba(219,164,108,.18)';ctx.lineWidth=1+Math.random()*3;ctx.beginPath();const y=i*7;ctx.moveTo(0,y);ctx.bezierCurveTo(130,y-8,340,y+9,512,y-3);ctx.stroke()}
 }else if(kind==='concrete'){
  ctx.fillStyle='#777d82';ctx.fillRect(0,0,512,512);
  for(let i=0;i<12000;i++){const v=Math.random()>.5?255:0;ctx.fillStyle='rgba('+v+','+v+','+v+',.07)';ctx.fillRect(Math.random()*512,Math.random()*512,2,2)}
 }
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;
 textureCache.set(kind,t);
 return t;
}
let previewResizeObserver=null,previewContextLost=false,cameraInteracted=false,resizeFallback=null,visibilityHandler=null;
function setup3D(){
 try{
  if(!viewer)throw new Error('The 3D preview container is missing from this page.');
  if(!window.WebGLRenderingContext&&!window.WebGL2RenderingContext)throw new Error('This browser does not expose WebGL. Try an updated Chrome browser or another device.');
  if(renderer){renderer.setAnimationLoop(null);controls?.dispose();renderer.dispose();renderer.domElement.remove();renderer=null;controls=null}
  previewResizeObserver?.disconnect();previewResizeObserver=null;
  if(resizeFallback){window.removeEventListener('resize',resizeFallback);resizeFallback=null}
  if(visibilityHandler){document.removeEventListener('visibilitychange',visibilityHandler);visibilityHandler=null}
  if(scene){const geometries=new Set(),materials=new Set();scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material){if(Array.isArray(object.material))object.material.forEach(m=>materials.add(m));else materials.add(object.material)}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());scene.clear();scene=null;buildingGroup=null}
  cameraInteracted=false;previewContextLost=false;
  viewer.dataset.previewState='loading';
  $('viewerStatus').textContent='Starting 3D engine…';
  scene=new THREE.Scene();scene.background=new THREE.Color('#b8c9d8');scene.fog=new THREE.Fog('#c8d5df',55,150);
  const width=Math.max(1,viewer.clientWidth),height=Math.max(1,viewer.clientHeight);
  camera=new THREE.PerspectiveCamera(36,width/height,.1,600);camera.position.set(30,22,34);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  const isMobile=matchMedia('(max-width: 760px)').matches;const cores=navigator.hardwareConcurrency||4;const memory=navigator.deviceMemory||4;const qualityCap=cores<=4||memory<=4?(isMobile?1.15:1.5):(isMobile?1.5:2.25);renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,qualityCap,2));renderer.setSize(width,height,false);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  viewer.replaceChildren(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','Interactive TW&D building concept model. Drag to orbit, pinch or scroll to zoom, and tap a room floor to select it.');
  renderer.domElement.style.display='block';renderer.domElement.style.width='100%';renderer.domElement.style.height='100%';renderer.domElement.style.touchAction='none';renderer.domElement.tabIndex=0;
  renderer.domElement.addEventListener('webglcontextlost',event=>{
   event.preventDefault();previewContextLost=true;renderer?.setAnimationLoop(null);
   viewer.dataset.previewState='error';$('viewerStatus').textContent='The device paused its graphics context. Tap “Retry 3D preview” to reload the model.';
  },false);
  renderer.domElement.addEventListener('webglcontextrestored',()=>{previewContextLost=false;setup3D()},false);
  controls=new OrbitControls(camera,renderer.domElement);
  controls.addEventListener('start',()=>{cameraInteracted=true});
  controls.enableDamping=true;controls.dampingFactor=.065;controls.screenSpacePanning=true;controls.zoomToCursor=true;controls.minDistance=5;controls.maxDistance=260;
  const roomRaycaster=new THREE.Raycaster(),roomPointer=new THREE.Vector2();
  renderer.domElement.addEventListener('click',event=>{
   if(!buildingGroup||!camera)return;
   const rect=renderer.domElement.getBoundingClientRect();roomPointer.x=((event.clientX-rect.left)/rect.width)*2-1;roomPointer.y=-((event.clientY-rect.top)/rect.height)*2+1;
   roomRaycaster.setFromCamera(roomPointer,camera);
   const hits=roomRaycaster.intersectObjects(buildingGroup.children,true);
   const hit=hits.find(item=>item.object.userData?.twdRoomSurface);
   if(!hit)return;
   const floorKey=hit.object.userData.floorKey,roomIndex=hit.object.userData.roomIndex;
   if(floorKey!==$('floorPlanLevel').value){saveActiveRoomInterior();$('floorPlanLevel').value=floorKey;loadActiveFloorLayout();}
   else saveActiveRoomInterior();
   activeRoomIndex=roomIndex;loadActiveRoomInterior();drawBuilding();
   $('roomEditorStatus').textContent='Selected in 3D: '+(roomListForActiveFloor()[roomIndex]||('Room '+(roomIndex+1)))+'. Adjust its settings below.';
  });
controls.target.set(0,4,0);controls.maxPolarAngle=Math.PI*.495;
  scene.add(new THREE.HemisphereLight(0xe8f3ff,0x78816e,1.35));
  const sun=new THREE.DirectionalLight(0xfff0d8,3.2);sun.position.set(-28,42,24);sun.castShadow=true;
  sun.shadow.mapSize.set(cores<=4||memory<=4?1024:2048,cores<=4||memory<=4?1024:2048);sun.shadow.camera.left=-45;sun.shadow.camera.right=45;sun.shadow.camera.top=45;sun.shadow.camera.bottom=-45;sun.shadow.bias=-.00018;sun.shadow.normalBias=.025;scene.add(sun);
  const fill=new THREE.DirectionalLight(0xd6e7ff,.85);fill.position.set(25,18,-25);scene.add(fill);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(260,32,20),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color('#6e91b2')},bottom:{value:new THREE.Color('#e5edf2')}},vertexShader:'varying vec3 vWorld; void main(){vec4 p=modelMatrix*vec4(position,1.0);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}',fragmentShader:'varying vec3 vWorld; uniform vec3 top; uniform vec3 bottom; void main(){float h=normalize(vWorld).y;float t=smoothstep(-.18,.62,h);gl_FragColor=vec4(mix(bottom,top,t),1.0);}' }));
  scene.add(sky);
  const groundTex=makeCanvasTexture('grass');groundTex.repeat.set(16,16);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(240,240),new THREE.MeshStandardMaterial({map:groundTex,roughness:1}));
  ground.rotation.x=-Math.PI/2;ground.position.y=-.16;ground.receiveShadow=true;scene.add(ground);
  buildingGroup=new THREE.Group();scene.add(buildingGroup);drawBuilding();
  const resize=()=>{if(!renderer||previewContextLost)return;const w=viewer.clientWidth,h=viewer.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);};
  if('ResizeObserver' in window){previewResizeObserver=new ResizeObserver(resize);previewResizeObserver.observe(viewer)}else{resizeFallback=resize;window.addEventListener('resize',resizeFallback,{passive:true})}
  requestAnimationFrame(resize);
  const renderFrame=()=>{if(!previewContextLost&&scene&&camera&&controls){controls.update();renderer.render(scene,camera)}};
  renderer.setAnimationLoop(document.hidden?null:renderFrame);
  visibilityHandler=()=>{if(renderer)renderer.setAnimationLoop(document.hidden||previewContextLost?null:renderFrame)};
  document.addEventListener('visibilitychange',visibilityHandler);
  viewer.dataset.previewState='ready';
  $('viewerStatus').textContent='3D preview ready · drag to rotate · pinch or scroll to zoom · tap a room to edit';
 }catch(e){
  viewer.dataset.previewState='error';
  $('viewerStatus').textContent='3D preview could not start: '+(e?.message||'graphics initialisation failed')+'. Check WebGL/device support and tap Retry.';
  console.error('TW&D Design Studio preview initialisation failed:',e);
  try{const w=clamp(+$('width').value||12,4,80),d=clamp(+$('depth').value||18,4,80),n=clamp(+$('storeys').value||1,1,4);drawPlan(w,d,n,getVisualSettings());}catch(planError){console.error('TW&D plan fallback failed:',planError);}
 }
}
function footprintShape2D(w,d,kind='rectangle'){
 const p=new THREE.Shape();
 const pt=(x,y)=>new THREE.Vector2(x-w/2,d/2-y);
 const points=kind==='L'?[[0,0],[w,0],[w,d*.5],[w*.5,d*.5],[w*.5,d],[0,d]]:
 kind==='U'?[[0,0],[w,0],[w,d],[w*.78,d],[w*.78,d*.42],[w*.22,d*.42],[w*.22,d],[0,d]]:
 kind==='H'?[[0,0],[w*.33,0],[w*.33,d*.28],[w*.67,d*.28],[w*.67,0],[w,0],[w,d],[w*.67,d],[w*.67,d*.72],[w*.33,d*.72],[w*.33,d],[0,d]]:
 kind==='T'?[[0,0],[w,0],[w,d*.45],[w*.67,d*.45],[w*.67,d],[w*.33,d],[w*.33,d*.45],[0,d*.45]]:
 [[0,0],[w,0],[w,d],[0,d]];
 points.forEach(([x,y],i)=>{const v=pt(x,y);if(i===0)p.moveTo(v.x,v.y);else p.lineTo(v.x,v.y)});p.closePath();
 if(kind==='courtyard'){const hole=new THREE.Path();[[w*.33,d*.33],[w*.33,d*.67],[w*.67,d*.67],[w*.67,d*.33]].forEach(([x,y],i)=>{const v=pt(x,y);if(i===0)hole.moveTo(v.x,v.y);else hole.lineTo(v.x,v.y)});hole.closePath();p.holes.push(hole);}
 return p;
}
function addFootprintPlate(parent,w,d,kind,y,thickness,material){
 const geometry=new THREE.ExtrudeGeometry(footprintShape2D(w,d,kind),{depth:thickness,bevelEnabled:false,curveSegments:1});
 geometry.rotateX(-Math.PI/2);
 const mesh=new THREE.Mesh(geometry,material);mesh.position.y=y;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function box(parent,w,h,d,x,y,z,material){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh}
function ceilMeshMatFix(material){return material}
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
  return roof;
}
function getVisualSettings(){
 const roomInteriors=JSON.parse(JSON.stringify(floorRoomInteriors));
 const selectedRoom=roomInteriors[$('floorPlanLevel').value]?.[roomInteriorKey(activeRoomIndex)]||defaultRoomInterior();
 return {
  aesthetic:$('aestheticPreset').value,wall:$('wallColor').value,roof:$('roofColor').value,glass:$('glassColor').value,trim:$('trimColor').value,
  building_shape:$('buildingShape').value,plot_width_m:+$('plotWidth').value,plot_depth_m:+$('plotDepth').value,front_setback_m:+$('frontSetback').value,side_setback_m:+$('sideSetback').value,plot_orientation:$('plotOrientation').value,
  plan_line:$('planLineColor').value,plan_fill:$('planFillColor').value,line_width:+$('planLineWidth').value,
  room_count:+$('roomCount').value,room_names:$('roomNames').value.split(',').map(x=>x.trim()).filter(Boolean).slice(0,12),floor_plan_level:$('floorPlanLevel').value,floor_room_names:{...floorRoomNames},floor_layouts:{...floorLayouts},room_interiors:roomInteriors,active_room_index:activeRoomIndex,selected_room_interior:selectedRoom,partition_direction:$('partitionDirection').value,split_x:+$('primarySplitX').value/100,split_y:+$('primarySplitY').value/100,window_style:$('windowStyle').value,
  facade_finish:$('facadeFinish').value,column_style:$('columnStyle').value,
  interior:{view_mode:$('interiorViewMode').value,floor_finish:selectedRoom.floor_finish,wall_finish:selectedRoom.wall_finish,tile_color:selectedRoom.tile_color,wall_color:selectedRoom.wall_color,lighting:selectedRoom.lighting,lighting_intensity:+$('lightingIntensity').value,furniture:selectedRoom.furniture,sanitary:selectedRoom.sanitary,hardscape:$('hardscapeFinish').value,hardscape_color:$('hardscapeColor').value,garden:$('gardenStyle').value,show_lights:$('showInteriorLights').checked,show_furniture:$('showFurniture').checked,show_plumbing:$('showPlumbing').checked,show_ceiling:$('showCeiling').checked,show_stamped_joints:$('showStampedJoints').checked,show_green_areas:$('showGreenAreas').checked},
  features:{balcony:$('featureBalcony').checked,columns:$('featureColumns').checked,fins:$('featureFins').checked,driveway:$('featureDriveway').checked,landscape:$('featureLandscape').checked,parapet:$('featureParapet').checked,lighting:$('featureLighting').checked}
 };
}

function setCameraView(view){
 if(!camera||!controls)return;
 cameraInteracted=false;
 const w=clamp(+$('width').value||12,4,80),d=clamp(+$('depth').value||18,4,80),height=(+$('storeys').value||2)*(+$('floorHeight').value||3.2);
 const span=Math.max(w,d)*2.05,centerY=height*.48;
 const floorIndex=Math.max(0,['ground','first','second','third'].indexOf($('floorPlanLevel').value)),floorY=floorIndex*(+$('floorHeight').value||3.2);
 const poses={perspective:[span*.82,height+span*.48,span*.95],front:[0,centerY+height*.12,span*1.75],side:[span*1.75,centerY+height*.12,0],top:[.01,span*2.1,.01],interior:[0,floorY+1.55,0],cutaway:[span*.55,floorY+height*.75,span*.65]};
 const p=poses[view]||poses.perspective;camera.position.set(p[0],p[1],p[2]);controls.target.set(view==='interior'?0:0,view==='interior'?floorY+1.55:view==='top'?0:centerY,view==='interior'?-2:0);controls.update();
}

function disposeBuildingGroup(){
 if(!buildingGroup)return;
 const geometries=new Set(),materials=new Set();
 buildingGroup.traverse(object=>{
  if(object.geometry)geometries.add(object.geometry);
  if(object.material){
   if(Array.isArray(object.material))object.material.forEach(material=>materials.add(material));
   else materials.add(object.material);
  }
 });
 geometries.forEach(geometry=>geometry.dispose());
 materials.forEach(material=>material.dispose());
 buildingGroup.clear();
}
function drawBuildingUnsafe(){
 if(!buildingGroup)return;disposeBuildingGroup();
 const w=clamp(+$('width').value||12,4,80),d=clamp(+$('depth').value||18,4,80),n=+$('storeys').value||2,h=clamp(+$('floorHeight').value||3.2,2.7,5),roof=$('roofType').value,v=getVisualSettings(),total=n*h;
 const mat=(c,r=.72,m=0,texture=null)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m,map:texture||null});
 const wall=mat(v.wall,.88,0,makeCanvasTexture('stucco')),slab=mat('#aeb6bf',.82,0,makeCanvasTexture('concrete')),roofMat=mat(v.roof,.68),glass=mat(v.glass,.12,.32),trim=mat(v.trim,.36),dark=mat('#303943',.64),wood=mat(v.aesthetic==='luxury'?'#795039':'#80543a',.66,0,makeCanvasTexture('wood')),stone=mat('#b8b0a2',.9,0,makeCanvasTexture('stone')),light=mat('#fff0c8',.24,.08);
 const interior=v.interior||{};if(interior.view_mode==='interior'||interior.view_mode==='cutaway'){wall.transparent=true;wall.opacity=.16;wall.depthWrite=false;}
 const finish=v.facade_finish;
 const accent=finish==='charcoal'?dark:finish==='stone'?stone:finish==='timber'?wood:finish==='render'?wall:wood;
 const cladding=finish==='signature'||finish==='charcoal';
 const frontZ=d/2,backZ=-d/2;
 // Raised plinth and crisp floor bands create the layered silhouette in TW&D's reference residence.
 addFootprintPlate(buildingGroup,w+.55,d+.55,v.building_shape,0,.42,slab);
 for(let floor=0;floor<n;floor++){
  const y=floor*h;
  // Side elevations are assembled around true window openings below.
  // Front and rear walls are assembled around true window openings instead of covering glazing with a solid block.
  const count=Math.max(2,Math.floor(w/(v.window_style==='panoramic'?2.45:v.window_style==='wide'?2.9:3.35)));
  const bay=w/count,ww=Math.min(v.window_style==='panoramic'?bay*.78:v.window_style==='wide'?bay*.62:v.window_style==='slim'?bay*.34:bay*.48,bay*.82);
  const wh=v.window_style==='slim'?h*.58:v.window_style==='panoramic'?h*.48:h*.43;
  const wy=y+h*.53, sill=wy-wh/2, head=wy+wh/2;
  for(const z of [frontZ,backZ]){
   let cursor=-w/2;
   for(let i=0;i<count;i++){
    const cx=-w/2+bay*(i+.5),left=cx-ww/2,right=cx+ww/2;
    if(left>cursor)box(buildingGroup,left-cursor,h,.2,(left+cursor)/2,y+h/2,z,wall);
    box(buildingGroup,ww,sill-y,.2,cx,(y+sill)/2,z,wall);
    box(buildingGroup,ww,y+h-head,.2,cx,(head+y+h)/2,z,wall);
    const pane=box(buildingGroup,ww-.10,wh-.10,.055,cx,wy,z+(z>0?.13:-.13),glass);
    // Deep reveal surround, sill and head detail.
    for(const xx of [left-.045,right+.045])box(buildingGroup,.09,wh+.18,.14,xx,wy,z+(z>0?.2:-.2),trim);
    for(const yy of [sill-.045,head+.045])box(buildingGroup,ww+.18,.09,.14,cx,yy,z+(z>0?.2:-.2),trim);
    box(buildingGroup,.045,wh-.12,.08,cx,wy,z+(z>0?.24:-.24),dark);
    cursor=right;
   }
   if(cursor<w/2)box(buildingGroup,w/2-cursor,h,.2,(w/2+cursor)/2,y+h/2,z,wall);
  }
  // Side elevations are built in segments so each window is a real wall opening, not a pane over solid masonry.
  const sideCount=Math.max(2,Math.floor(d/4.2));
  for(const side of [-1,1]){
   const x=side*(w/2-.11),paneX=side*(w/2+.035),sh=h*.43,wy=y+h*.54,sill=wy-sh/2,head=wy+sh/2,sw=Math.min(1.45,d/sideCount*.58);
   let cursor=-d/2;
   for(let i=0;i<sideCount;i++){
    const z=-d/2+(i+1)*d/(sideCount+1),left=z-sw/2,right=z+sw/2;
    if(left>cursor)box(buildingGroup,.22,h,left-cursor,x,y+h/2,(left+cursor)/2,wall);
    box(buildingGroup,.22,sill-y,sw,x,(y+sill)/2,z,wall);
    box(buildingGroup,.22,y+h-head,sw,x,(head+y+h)/2,z,wall);
    box(buildingGroup,.055,sh-.10,sw-.10,paneX,wy,z,glass);
    for(const yy of [sill-.04,head+.04])box(buildingGroup,.1,.08,sw+.14,side*(w/2+.08),yy,z,trim);
    for(const zz of [left-.04,right+.04])box(buildingGroup,.1,sh+.16,.08,side*(w/2+.08),wy,zz,trim);
    box(buildingGroup,.045,sh-.12,.08,side*(w/2+.105),wy,z,dark);
    cursor=right;
   }
   if(cursor<d/2)box(buildingGroup,.22,h,d/2-cursor,x,y+h/2,(d/2+cursor)/2,wall);
  }
  // Continuous slab edge and clean shadow line.
  addFootprintPlate(buildingGroup,w+.42,d+.42,v.building_shape,y+.01,.22,trim);
  if(floor>0&&v.features.balcony){
   const bw=Math.min(w*.48,6.2),balY=y+.25;
   box(buildingGroup,bw,.22,1.65,0,balY,frontZ+.78,trim);
   box(buildingGroup,bw,.08,.08,0,balY+1.03,frontZ+1.56,glass);
   for(let k=0;k<=10;k++)box(buildingGroup,.035,.88,.035,-bw/2+bw*k/10,balY+.55,frontZ+1.56,glass);
   // Side cheek walls frame the balcony composition.
   for(const xx of [-bw/2,bw/2])box(buildingGroup,.12,.95,1.5,xx,balY+.52,frontZ+.78,wall);
  }
  // Projecting feature bands and textured wall panels.
  if(cladding){
   const panelW=w*.31,panelH=h*.72,panelX=-w*.29;
   box(buildingGroup,panelW,panelH,.12,panelX,y+h*.53,frontZ+.16,accent);
   if(finish==='signature'||finish==='charcoal'){
    for(let k=0;k<19;k++)box(buildingGroup,.025,panelH,.045,panelX-panelW/2+k*panelW/18,y+h*.53,frontZ+.245,finish==='charcoal'?trim:dark);
   }
  }
  if(finish==='signature'||finish==='timber'){
   const woodX=w*.22,panelW=w*.23;
   box(buildingGroup,panelW,h*.72,.13,woodX,y+h*.53,frontZ+.17,wood);
   for(let k=0;k<7;k++)box(buildingGroup,.025,h*.68,.035,woodX-panelW*.42+k*panelW*.14,y+h*.53,frontZ+.25,mat('#b9875e',.75));
  }
  // Decorative horizontal fascia bands.
  box(buildingGroup,w+.48,.16,.34,0,y+h-.12,frontZ+.10,trim);
 }
 const roomNamesForModel=(v.floor_room_names&&v.floor_room_names[v.floor_plan_level])?String(v.floor_room_names[v.floor_plan_level]).split(',').map(x=>x.trim()).filter(Boolean):(v.room_names||[]);
 // Internal partitions follow the same room grid used by the selectable floor surfaces.
 // Each floor uses its own room count; openings are left in the centre of each adjoining bay.
 const innerWall=mat('#eeeae2',.9),innerTrim=mat('#c7c2b8',.8);
 const wallThickness=.13,insideW=w-.44,insideD=d-.44;
 const doorLeafMat=mat('#80583e',.56),doorFrameMat=mat('#d7c9b8',.72),doorHandleMat=mat('#b7a27b',.22,.78);
 const addDoorOnVerticalWall=(x,z,opening,floorY)=>{const width=Math.min(.9,opening*.86),height=Math.min(2.12,h*.78);if(width<.52)return;box(buildingGroup,.065,height,.065,x,floorY+height/2,z-width/2,doorFrameMat);box(buildingGroup,.065,height,.065,x,floorY+height/2,z+width/2,doorFrameMat);box(buildingGroup,.07,.07,width+.08,x,floorY+height+.035,z,doorFrameMat);const leaf=box(buildingGroup,.045,height-.07,width-.08,x,floorY+(height-.07)/2,z,doorLeafMat);leaf.rotation.y=.12;const handle=new THREE.Mesh(new THREE.SphereGeometry(.045,10,8),doorHandleMat);handle.position.set(x+.075,floorY+1.02,z+width*.28);buildingGroup.add(handle);};
 const addDoorOnHorizontalWall=(x,z,opening,floorY)=>{const width=Math.min(.9,opening*.86),height=Math.min(2.12,h*.78);if(width<.52)return;box(buildingGroup,.065,height,.065,x-width/2,floorY+height/2,z,doorFrameMat);box(buildingGroup,.065,height,.065,x+width/2,floorY+height/2,z,doorFrameMat);box(buildingGroup,width+.08,.07,.07,x,floorY+height+.035,z,doorFrameMat);const leaf=box(buildingGroup,width-.08,height-.07,.045,x,floorY+(height-.07)/2,z,doorLeafMat);leaf.rotation.y=-.12;const handle=new THREE.Mesh(new THREE.SphereGeometry(.045,10,8),doorHandleMat);handle.position.set(x+width*.28,floorY+1.02,z+.075);buildingGroup.add(handle);};
 for(let floor=0;floor<n;floor++){
  const floorKeyForPartitions=['ground','first','second','third','fourth'][floor];
  const floorNames=(v.floor_room_names&&v.floor_room_names[floorKeyForPartitions])
   ?String(v.floor_room_names[floorKeyForPartitions]).split(',').map(x=>x.trim()).filter(Boolean)
   :roomNamesForModel;
  const count=clamp(floorNames.length||v.room_count||4,2,12);
  const cols=Math.ceil(count/2),rows=Math.ceil(count/cols),floorY=floor*h;
  const cellW=insideW/cols,cellD=insideD/rows,wallHeight=h*.72,wallY=floorY+h*.38;
  const gapW=Math.min(.92,cellW*.28),gapD=Math.min(.92,cellD*.28);
  // Vertical room boundaries with doorway gaps centred in each row.
  for(let c=1;c<cols;c++){
   const x=-insideW/2+c*cellW;
   for(let row=0;row<rows;row++){
    const z0=-insideD/2+row*cellD,z1=z0+cellD,zMid=(z0+z1)/2;
    const segment=(cellD-gapD)/2;
    if(segment>.08){
     box(buildingGroup,wallThickness,wallHeight,segment,x,wallY,z0+segment/2,innerWall);
     box(buildingGroup,wallThickness,wallHeight,segment,x,wallY,z1-segment/2,innerWall);
     box(buildingGroup,wallThickness+.035,.035,segment,x,floorY+h*.75,z0+segment/2,innerTrim);
     box(buildingGroup,wallThickness+.035,.035,segment,x,floorY+h*.75,z1-segment/2,innerTrim);
    }
    addDoorOnVerticalWall(x,zMid,gapD,floorY);
   }
  }
  // Horizontal room boundaries with doorway gaps centred in each column.
  for(let row=1;row<rows;row++){
   const z=-insideD/2+row*cellD;
   for(let col=0;col<cols;col++){
    const x0=-insideW/2+col*cellW,x1=x0+cellW,xMid=(x0+x1)/2;
    const segment=(cellW-gapW)/2;
    if(segment>.08){
     box(buildingGroup,segment,wallHeight,wallThickness,x0+segment/2,wallY,z,innerWall);
     box(buildingGroup,segment,wallHeight,wallThickness,x1-segment/2,wallY,z,innerWall);
     box(buildingGroup,segment,.035,wallThickness+.035,x0+segment/2,floorY+h*.75,z,innerTrim);
     box(buildingGroup,segment,.035,wallThickness+.035,x1-segment/2,floorY+h*.75,z,innerTrim);
    }
    addDoorOnHorizontalWall(xMid,z,gapW,floorY);
   }
  }
 }
 // Room-by-room interior model: each room receives its own floor material, finish panel, lighting and furniture.
 const addBox=(ww,hh,dd,x,y,z,m)=>box(buildingGroup,ww,hh,dd,x,y,z,m);
 const fixtureMat=mat('#f8f8f4',.2,.08),chromeMat=mat('#b8c4ca',.18,.82),woodMat=mat('#8b6546',.58);
 const makeRoomTileTexture=(cfg)=>{const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle=cfg.tile_color||'#d8d4ca';ctx.fillRect(0,0,256,256);const step=cfg.floor_finish==='wood'?42:cfg.floor_finish==='marble'?86:cfg.floor_finish==='granite'?52:cfg.floor_finish==='terrazzo'?58:cfg.floor_finish==='concrete'?128:64;ctx.strokeStyle='rgba(75,75,75,.28)';ctx.lineWidth=2;for(let p=0;p<=256;p+=step){ctx.beginPath();ctx.moveTo(p,0);ctx.lineTo(p,256);ctx.stroke();ctx.beginPath();ctx.moveTo(0,p);ctx.lineTo(256,p);ctx.stroke();}if(['marble','granite','terrazzo'].includes(cfg.floor_finish)){for(let q=0;q<90;q++){ctx.fillStyle='rgba(70,70,70,.10)';ctx.beginPath();ctx.arc(Math.random()*256,Math.random()*256,Math.random()*2+1,0,Math.PI*2);ctx.fill();}}return new THREE.CanvasTexture(canvas);};
 for(let fl=0;fl<n;fl++){
  const floorKeyForModel=['ground','first','second','third','fourth'][fl];
  const floorNamesForModel=(v.floor_room_names&&v.floor_room_names[floorKeyForModel])?String(v.floor_room_names[floorKeyForModel]).split(',').map(x=>x.trim()).filter(Boolean):roomNamesForModel;
  const floorRoomTotal=clamp(floorNamesForModel.length||v.room_count||4,2,12);
  const floorRoomCols=Math.ceil(floorRoomTotal/2),floorRoomRows=Math.ceil(floorRoomTotal/floorRoomCols);
  const fy=fl*h,fyBase=fy+(fl===0?.43:.245);
  for(let ri=0;ri<floorRoomTotal;ri++){
   const row=Math.floor(ri/floorRoomCols),col=ri%floorRoomCols;
   const cellW=insideW/floorRoomCols,cellD=insideD/floorRoomRows;
   const cx=-insideW/2+cellW*(col+.5),cz=-insideD/2+cellD*(row+.5);
   const cfg=(floorRoomInteriors[floorKeyForModel]||{})[String(ri)]||defaultRoomInterior();
   const texture=makeRoomTileTexture(cfg);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(Math.max(1,cellW/2.5),Math.max(1,cellD/2.5));
   const roomFloorMat=mat('#ffffff',cfg.floor_finish==='marble'?.24:.48,0,texture);
   const roomFloor=new THREE.Mesh(new THREE.PlaneGeometry(Math.max(.2,cellW-.035),Math.max(.2,cellD-.035)),roomFloorMat);
   roomFloor.rotation.x=-Math.PI/2;roomFloor.position.set(cx,fyBase+.012,cz);roomFloor.receiveShadow=true;
   roomFloor.userData={twdRoomSurface:true,roomIndex:ri,floorKey:floorKeyForModel};buildingGroup.add(roomFloor);
   if(fl===+$('floorPlanLevel').selectedIndex&&ri===activeRoomIndex){
    const outline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(cellW-.06,cellD-.06)),new THREE.LineBasicMaterial({color:0x13a6d8,linewidth:2}));
    outline.rotation.x=-Math.PI/2;outline.position.set(cx,fyBase+.035,cz);buildingGroup.add(outline);
   }
   const wallColor=cfg.wall_color||'#f1eee7';
   const roomWallMat=mat(wallColor,.82);
   if(cfg.wall_finish!=='paint'){
    const panelMat=mat(cfg.wall_finish==='marble'?'#d5d0c7':cfg.wall_finish==='stone'?'#b9ad9b':cfg.wall_finish==='wood'?'#8b6546':'#d9dedc',.5);
    addBox(cellW*.82,.95,.035,cx,fy+.58,cz-cellD*.43,panelMat);
   }else{
    addBox(cellW*.82,.72,.025,cx,fy+.55,cz-cellD*.43,roomWallMat);
   }
   if(interior.show_lights){
    const lightColor=cfg.lighting==='neutral'?0xfff5e8:cfg.lighting==='daylight'?0xe7f2ff:cfg.lighting==='ambient'?0xffdcb0:0xffd6a0;
    const bulb=new THREE.Mesh(new THREE.SphereGeometry(.075,10,8),new THREE.MeshStandardMaterial({color:lightColor,emissive:lightColor,emissiveIntensity:.85}));
    bulb.position.set(cx,fy+h-.24,cz);buildingGroup.add(bulb);
    const point=new THREE.PointLight(lightColor,1.0*((interior.lighting_intensity||65)/100),Math.max(cellW,cellD)*1.5,2);point.position.set(cx,fy+h-.38,cz);buildingGroup.add(point);
   }
   const roomName=(floorNamesForModel[ri]||('Room '+(ri+1))).toLowerCase();
   if(interior.show_furniture&&cfg.furniture!=='empty'){
    const fm=mat(cfg.furniture==='luxury'?'#8b694e':cfg.furniture==='office'?'#596b7c':cfg.furniture==='minimal'?'#d6dadd':'#b7a58d',.72);
    const fabric=mat(cfg.furniture==='minimal'?'#e2e4e2':'#9caaad',.94);
    if(/bed|sleep|master|guest/.test(roomName)){
     addBox(Math.min(1.55,cellW*.58),.24,Math.min(2.0,cellD*.58),cx,fyBase+.20,cz,fm);
     addBox(Math.min(1.48,cellW*.54),.12,Math.min(1.82,cellD*.52),cx,fyBase+.38,cz,fabric);
     addBox(Math.min(1.6,cellW*.6),.42,.12,cx,fyBase+.55,cz-cellD*.22,fm);
    }else if(/kitchen|pantry/.test(roomName)){
     addBox(cellW*.66,.88,.52,cx,fyBase+.44,cz-cellD*.28,fm);
     addBox(cellW*.66,.08,.54,cx,fyBase+.91,cz-cellD*.28,fixtureMat);
     addBox(cellW*.58,.58,.28,cx,fy+1.55,cz-cellD*.30,roomWallMat);
    }else if(/bath|toilet|wc|shower/.test(roomName)){
     if(interior.show_plumbing&&cfg.sanitary!=='none'){
      const wc=new THREE.Mesh(new THREE.SphereGeometry(.22,16,10),fixtureMat);wc.scale.set(1,.5,1.2);wc.position.set(cx-cellW*.2,fyBase+.24,cz+cellD*.2);buildingGroup.add(wc);
      addBox(.52,.55,.16,cx-cellW*.2,fyBase+.4,cz+cellD*.05,fixtureMat);
      addBox(.62,.14,.46,cx+cellW*.2,fyBase+.78,cz-cellD*.2,fixtureMat);
      if(cfg.sanitary==='full'||cfg.sanitary==='wc_shower'){addBox(.78,.08,.78,cx+cellW*.2,fyBase+.05,cz+cellD*.22,fixtureMat);addBox(.035,1.85,.78,cx+cellW*.2-.39,fyBase+.96,cz+cellD*.22,glass);addBox(.78,1.85,.035,cx+cellW*.2,fyBase+.96,cz+cellD*.22-.39,glass);const showerHead=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,.035,16),chromeMat);showerHead.position.set(cx+cellW*.2,fyBase+1.82,cz+cellD*.22);buildingGroup.add(showerHead);}
     }
    }else if(/office|study|class|reception/.test(roomName)){
     addBox(Math.min(1.5,cellW*.62),.12,.72,cx,fyBase+.78,cz,fm);
     addBox(.42,.46,.42,cx-cellW*.18,fyBase+.46,cz+.62,fabric);
    }else{
     addBox(Math.min(1.7,cellW*.66),.42,.72,cx,fyBase+.42,cz,fabric);
     addBox(.82,.12,.52,cx,fyBase+.28,cz+cellD*.22,woodMat);
    }
   }
    // Room-specific architectural details: wardrobe/storage, ceiling treatment and indicative electrical points.
   if(cfg.storage!=='none'&&/bed|sleep|master|guest/.test(roomName)){
    const wardrobeDepth=cfg.storage==='walkin'?.72:.58;
    addBox(Math.min(1.75,cellW*.30),2.05,wardrobeDepth,cx+cellW*.32,fyBase+1.025,cz-cellD*.30,woodMat);
    for(let k=0;k<3;k++)addBox(.012,1.72,.018,cx+cellW*.32+(k-1)*Math.min(.48,cellW*.09),fyBase+1.02,cz-cellD*.30+wardrobeDepth*.51,chromeMat);
    addBox(.48,.42,.42,cx-cellW*.30,fyBase+.23,cz-cellD*.30,woodMat);
    addBox(.48,.42,.42,cx+cellW*.30,fyBase+.23,cz-cellD*.30,woodMat);
   }
   if(/kitchen|pantry/.test(roomName)){
    // Fridge, hob and sink are visual placeholders; service connections are not routed.
    addBox(.62,1.85,.62,cx+cellW*.36,fyBase+.925,cz-cellD*.30,fixtureMat);
    addBox(.56,.035,.46,cx-cellW*.12,fyBase+.96,cz-cellD*.28,chromeMat);
    for(let burner=0;burner<4;burner++){
     const hob=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,.025,16),dark);hob.position.set(cx-cellW*.22+(burner%2)*.2,fyBase+.99,cz-cellD*.28+Math.floor(burner/2)*.18);buildingGroup.add(hob);
    }
    addBox(.38,.08,.30,cx+cellW*.08,fyBase+.98,cz-cellD*.28,fixtureMat);
   }
   if(cfg.ceiling!=='plain'&&interior.view_mode!=='exterior'){
    const strip=mat(cfg.ceiling==='cove'?'#ffe6b0':'#e7e4dc',.38,.05);
    const yy=fy+h-.23,spanX=Math.max(.35,cellW-.28),spanZ=Math.max(.35,cellD-.28);
    addBox(spanX,.035,.045,cx,yy,cz-spanZ/2,strip);addBox(spanX,.035,.045,cx,yy,cz+spanZ/2,strip);
    addBox(.045,.035,spanZ,cx-spanX/2,yy,cz,strip);addBox(.045,.035,spanZ,cx+spanX/2,yy,cz,strip);
    if(cfg.ceiling==='tray')addBox(spanX*.72,.025,.035,cx,yy-.035,cz,innerTrim);
    if(cfg.ceiling==='linear')for(let line=0;line<2;line++)addBox(.035,.025,spanZ*.72,cx+(line-.5)*spanX*.28,yy-.04,cz,light);
   }
   // Indicative wall switch and socket points, not an electrical circuit layout.
   addBox(.055,.12,.035,doorX+.06,fyBase+1.18,doorZ-.52,chromeMat);
   addBox(.065,.08,.035,cx+cellW*.44,fyBase+.32,cz+cellD*.35,fixtureMat);
   if(interior.show_plumbing&&/bath|toilet|wc|shower/.test(roomName)&&cfg.sanitary!=='none'){
    const basin= new THREE.Mesh(new THREE.CylinderGeometry(.22,.28,.10,20),fixtureMat);basin.position.set(cx+cellW*.23,fyBase+.82,cz-cellD*.22);buildingGroup.add(basin);
    const tap=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.18,10),chromeMat);tap.position.set(cx+cellW*.23,fyBase+.96,cz-cellD*.22);buildingGroup.add(tap);
   }
  }
  if(interior.show_ceiling&&interior.view_mode!=='exterior'){
   const ceiling=mat('#f4f1e9',.95);ceiling.transparent=true;ceiling.opacity=.13;ceiling.depthWrite=false;
   const ceilMesh=new THREE.Mesh(new THREE.PlaneGeometry(insideW,insideD),ceiling);ceilMesh.rotation.x=Math.PI/2;ceilMesh.position.set(0,fy+h-.16,0);buildingGroup.add(ceilMesh);
  }
 }
 // Roof/parapet silhouette and oversized entrance canopy.
 const roofModel=drawRoof(w,d,total,roof,roofMat);if(interior.view_mode==='interior'||interior.view_mode==='cutaway')roofModel.visible=false;
 if(roof==='contemporary_flat'||roof==='custom'||roof==='combination'){
  box(buildingGroup,w+1.35,.28,d+1.25,0,total+.24,0,trim);
  box(buildingGroup,w+1.0,.12,d+1.0,0,total+.43,0,wall);
 }
 if(v.features.parapet){
  for(const z of [frontZ+.32,backZ-.32])box(buildingGroup,w+1,.8,.2,0,total+.65,z,wall);
  for(const x of [-w/2-.32,w/2+.32])box(buildingGroup,.2,.8,d,x,total+.65,0,wall);
 }
 // Recessed porch and a substantial floating canopy with warm soffit lights.
 const porchW=Math.min(w*.58,7.2),porchZ=frontZ+1.05;
 box(buildingGroup,porchW,.28,2.15,0,total>0?Math.min(h*.92,3.05):3.05,porchZ,trim);
 box(buildingGroup,porchW-.24,.045,1.92,0,Math.min(h*.92,3.05)-.16,porchZ,wood);
 for(let i=0;i<5;i++){
  const x=-porchW*.4+i*porchW*.2;
  const lamp=new THREE.Mesh(new THREE.SphereGeometry(.055,10,8),light);
  lamp.position.set(x,Math.min(h*.92,3.05)-.105,porchZ+.5);buildingGroup.add(lamp);
 }
 // Main entrance door and full-height glazed side lights.
 const doorMat=mat('#3b2c25',.38);
 box(buildingGroup,1.35,2.45,.09,0,1.25,frontZ+.20,doorMat);
 for(const x of [-.92,.92])box(buildingGroup,.34,2.28,.055,x,1.18,frontZ+.24,glass);
 // Column family: square, fluted or rounded profiles with proper base and capital detailing.
 if(v.features.columns){
  const positions=[-porchW*.38,porchW*.38];
  for(const x of positions){
   if(v.column_style==='round'||v.column_style==='fluted'||v.column_style==='ionic'){
    const radius=v.column_style==='ionic'?.24:.19;
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,3.15, v.column_style==='fluted'?20:32),trim);
    shaft.position.set(x,1.72,porchZ+.9);shaft.castShadow=true;buildingGroup.add(shaft);
    if(v.column_style==='fluted')for(let a=0;a<12;a++){
     const angle=a*Math.PI/6,flute=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,3.0,6),dark);
     flute.position.set(x+Math.cos(angle)*radius,1.72,porchZ+.9+Math.sin(angle)*radius);buildingGroup.add(flute);
    }
    box(buildingGroup,.62,.18,.62,x,.18,porchZ+.9,trim);
    box(buildingGroup,.62,.22,.62,x,3.28,porchZ+.9,trim);
    if(v.column_style==='ionic'){
     box(buildingGroup,.82,.13,.78,x,3.43,porchZ+.9,trim);
     for(const side of [-1,1]){const scroll=new THREE.Mesh(new THREE.TorusGeometry(.12,.035,8,16),trim);scroll.position.set(x+side*.23,3.43,porchZ+.9);scroll.rotation.y=Math.PI/2;buildingGroup.add(scroll)}
    }
   }else{
    box(buildingGroup,.42,3.15,.42,x,1.72,porchZ+.9,trim);
    box(buildingGroup,.62,.2,.62,x,.18,porchZ+.9,trim);
    box(buildingGroup,.64,.2,.64,x,3.34,porchZ+.9,trim);
   }
  }
 }
 // Tall vertical feature fins echo the strong white portal frames in the homepage reference.
 if(v.features.fins){
  for(const x of [-w*.39,-w*.35,w*.35,w*.39])box(buildingGroup,.16,total*.88,.28,x,total*.48,frontZ+.22,trim);
 }
 // Warm linear accent lighting on the feature façade.
 if(v.features.lighting){
  for(const x of [-w*.17,w*.17]){
   const strip=box(buildingGroup,.035,total*.72,.035,x,total*.48,frontZ+.32,light);
   const glow=new THREE.PointLight(0xffdca0,.55,5);glow.position.set(x,total*.7,frontZ+.55);buildingGroup.add(glow);
  }
 }
 // Shape-specific courtyard / wing cut-outs keep the 3D massing aligned with the selected plan footprint.
 const grassCut=mat('#71865b',.98,0,makeCanvasTexture('grass'));
 const cutHeight=total+1.2,cutY=cutHeight/2;
 const cut=(cw,cd,cx,cz)=>box(buildingGroup,cw,cutHeight,cd,cx,cutY,cz,grassCut);
 if(v.building_shape==='L')cut(w*.5,d*.5,w*.25,d*.25);
 if(v.building_shape==='U')cut(w*.42,d*.48,0,d*.26);
 if(v.building_shape==='H'){cut(w*.34,d*.28,0,d*.36);cut(w*.34,d*.28,0,-d*.36)}
 if(v.building_shape==='T'){cut(w*.34,d*.45,-w*.33,d*.275);cut(w*.34,d*.45,w*.33,d*.275)}
 if(v.building_shape==='courtyard')cut(w*.34,d*.34,0,0);
 // Ground, paved arrival court, garden beds and layered planting.
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),mat('#dce5d8',.98,0,makeCanvasTexture('grass')));ground.rotation.x=-Math.PI/2;ground.position.y=-.13;ground.receiveShadow=true;buildingGroup.add(ground);
 if(v.features.driveway){
  const driveW=Math.min(w*.92,10),driveD=Math.min(d*.62,12),driveZ=frontZ+Math.min(d*.27,4);
  const pavingCanvas=document.createElement('canvas');pavingCanvas.width=512;pavingCanvas.height=512;const pctx=pavingCanvas.getContext('2d');pctx.fillStyle=interior.hardscape_color||'#858987';pctx.fillRect(0,0,512,512);
  pctx.strokeStyle='rgba(35,42,45,.28)';pctx.lineWidth=4;const joint=interior.hardscape==='pavers'?64:interior.hardscape==='granite'?128:interior.hardscape==='stamped'?96:256;
  if(interior.hardscape==='stamped'){for(let y=0;y<512;y+=joint){for(let x=0;x<512;x+=joint){pctx.strokeRect(x+3,y+3,joint-6,joint-6);pctx.beginPath();pctx.moveTo(x+joint/2,y+3);pctx.lineTo(x+joint/2,y+joint-3);pctx.stroke();}}}
  else if(interior.hardscape==='pavers'){for(let y=0;y<512;y+=joint){pctx.beginPath();pctx.moveTo(0,y);pctx.lineTo(512,y);pctx.stroke();for(let x=(Math.floor(y/joint)%2)*joint/2;x<512;x+=joint){pctx.beginPath();pctx.moveTo(x,y);pctx.lineTo(x,y+joint);pctx.stroke();}}}
  else if(interior.hardscape==='exposed'){for(let k=0;k<2600;k++){pctx.fillStyle='rgba(245,245,240,'+(Math.random()*.35)+')';pctx.beginPath();pctx.arc(Math.random()*512,Math.random()*512,Math.random()*2+1,0,Math.PI*2);pctx.fill();}}
  const driveTex=new THREE.CanvasTexture(pavingCanvas);driveTex.colorSpace=THREE.SRGBColorSpace;driveTex.wrapS=driveTex.wrapT=THREE.RepeatWrapping;driveTex.repeat.set(2,3);
  const drive=new THREE.Mesh(new THREE.PlaneGeometry(driveW,driveD),mat('#ffffff',interior.hardscape==='smooth'?.28:.78,0,driveTex));drive.rotation.x=-Math.PI/2;drive.position.set(0,-.105,driveZ);drive.receiveShadow=true;buildingGroup.add(drive);
  for(const side of [-1,1])box(buildingGroup,.12,.12,driveD,side*driveW/2,-.035,driveZ,trim);
  if(interior.show_stamped_joints&&interior.hardscape==='stamped')for(let z=-driveD/2+1;z<driveD/2;z+=1.8)box(buildingGroup,driveW,.012,.018,0,-.09,driveZ+z,mat('#5f6664',.9));
 }
 if(v.features.landscape&&interior.garden!=='none'&&interior.show_green_areas!==false){
  const gardenTone=interior.garden==='formal'?'#39734a':interior.garden==='minimal'?'#72915a':'#3e7b50';
  for(const x of [-w*.72,-w*.57,w*.57,w*.72]){
   const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.08,.14,1.35,10),mat('#79553a'));trunk.position.set(x,.55,d*.42);buildingGroup.add(trunk);
   const crown=new THREE.Mesh(new THREE.SphereGeometry(.9,14,10),mat(gardenTone,.95));crown.position.set(x,1.72,d*.42);buildingGroup.add(crown);
   for(let k=0;k<3;k++){const shrub=new THREE.Mesh(new THREE.SphereGeometry(.34,10,8),mat('#4f8752',.96));shrub.position.set(x+(k-1)*.42,.3,d*.42+1.1);buildingGroup.add(shrub)}
  }
 }
 $('footprintValue').textContent=(w*d).toFixed(1)+' m²';$('storeyValue').textContent=String(n);$('roofValue').textContent=roofLabels[roof]||roof;
 if(camera&&controls){
  const targetY=total*.46;
  if(!cameraInteracted){const span=Math.max(w,d,total*1.35),distance=span*1.72;camera.position.set(distance*.72,targetY+distance*.48,distance*.82);camera.near=Math.max(.05,span/1200);camera.far=Math.max(500,span*18);camera.updateProjectionMatrix();}
  controls.target.set(0,targetY,0);controls.minDistance=Math.max(3,Math.min(w,d)*.35);controls.maxDistance=Math.max(180,Math.max(w,d,total)*12);controls.update();
 }
}
function drawBuilding(){
 // Keep the 2D footprint renderer independent of WebGL. A graphics/context failure
 // must never prevent the indicative plan from rendering or updating.
 if(buildingGroup){
  try{drawBuildingUnsafe();}
  catch(error){
   console.error('TW&D 3D model generation failed:',error);
   try{
    disposeBuildingGroup();
    const w=clamp(+$('width').value||12,4,80),d=clamp(+$('depth').value||18,4,80),n=clamp(+$('storeys').value||1,1,4),h=clamp(+$('floorHeight').value||3.2,2.7,5),height=Math.max(2.7,n*h*.78);
    const fallbackMat=new THREE.MeshStandardMaterial({color:'#d9e0e8',roughness:.82});
    box(buildingGroup,w,height,d,0,height/2,0,fallbackMat);
    $('viewerStatus').textContent='Basic 3D fallback shown. Detailed model error: '+(error?.message||'unknown error');
   }catch(fallbackError){console.error('TW&D fallback model failed:',fallbackError);$('viewerStatus').textContent='3D preview needs a retry: '+(fallbackError?.message||'graphics error');}
  }
 }
 try{
  const w=clamp(+$('width').value||12,4,80),d=clamp(+$('depth').value||18,4,80),n=clamp(+$('storeys').value||1,1,4);
  drawPlan(w,d,n,getVisualSettings());
 }catch(planError){
  console.error('TW&D plan drawing failed:',planError);
  const w=clamp(+$('width').value||12,4,80),d=clamp(+$('depth').value||18,4,80);
  $('planDrawing').innerHTML='<svg viewBox="0 0 520 360" role="img" aria-label="Fallback conceptual footprint"><rect x="90" y="55" width="340" height="250" fill="#f3f6f8" stroke="#173b65" stroke-width="5"/><text x="260" y="165" text-anchor="middle" font-size="20" fill="#173b65">BUILDING FOOTPRINT</text><text x="260" y="195" text-anchor="middle" font-size="15" fill="#52677b">'+w.toFixed(2)+' m × '+d.toFixed(2)+' m</text><text x="260" y="330" text-anchor="middle" font-size="12" fill="#9b4b32">Detailed plan temporarily unavailable</text></svg>';
 }
}
function drawPlan(w,d,n,v=getVisualSettings()){
 const doorGapMin=()=>8;
 const sx=520,sy=360,pad=30,plotW=Math.max(1,+$('plotWidth').value||30),plotD=Math.max(1,+$('plotDepth').value||40);
 const scale=Math.min((sx-2*pad)/plotW,(sy-2*pad)/plotD),plotPx=plotW*scale,plotPy=plotD*scale,px=(sx-plotPx)/2,py=(sy-plotPy)/2;
 const setback=Math.max(0,+$('sideSetback').value||0)*scale,front=Math.max(0,+$('frontSetback').value||0)*scale;const plotFit=(w+2*(+$('sideSetback').value||0)<=plotW)&&(d+(+$('frontSetback').value||0)+(+$('sideSetback').value||0)<=plotD);
 const bx=px+Math.max(setback,(plotPx-w*scale)/2),by=py+Math.max(front,(plotPy-d*scale-front)/2),rw=w*scale,rd=d*scale;
 const shape=v.building_shape||'rectangle',lw=v.line_width,rooms=clamp(v.room_count,2,6);
 let outline='';
 if(shape==='L')outline=`M ${bx} ${by} H ${bx+rw} V ${by+rd*.5} H ${bx+rw*.5} V ${by+rd} H ${bx} Z`;
 else if(shape==='U')outline=`M ${bx} ${by} H ${bx+rw} V ${by+rd} H ${bx+rw*.78} V ${by+rd*.42} H ${bx+rw*.22} V ${by+rd} H ${bx} Z`;
 else if(shape==='H')outline=`M ${bx} ${by} H ${bx+rw*.33} V ${by+rd*.28} H ${bx+rw*.67} V ${by} H ${bx+rw} V ${by+rd} H ${bx+rw*.67} V ${by+rd*.72} H ${bx+rw*.33} V ${by+rd} H ${bx} Z`;
 else if(shape==='T')outline=`M ${bx} ${by} H ${bx+rw} V ${by+rd*.45} H ${bx+rw*.67} V ${by+rd} H ${bx+rw*.33} V ${by+rd*.45} H ${bx} Z`;
 else if(shape==='courtyard')outline=`M ${bx} ${by} H ${bx+rw} V ${by+rd} H ${bx} Z M ${bx+rw*.33} ${by+rd*.33} V ${by+rd*.67} H ${bx+rw*.67} V ${by+rd*.33} Z`;
 else outline=`M ${bx} ${by} H ${bx+rw} V ${by+rd} H ${bx} Z`;
 const areaFactor={rectangle:1,L:.75,U:.78,H:.80,T:.75,courtyard:.88}[shape]||1;
 const fill=v.plan_fill,line=v.plan_line;
 const roomLines=[],roomLabels=[];
 if(shape==='rectangle'){
  const cols=Math.ceil(rooms/2),rows=2;
  // Partition walls are drawn as separate runs, leaving a real visual door opening.
  for(let i=1;i<cols;i++){
   const x=bx+rw*i/cols,mid=by+rd*.5,gap=Math.max(doorGapMin(),Math.min(13,rd*.055));
   roomLines.push('<line x1="'+x+'" y1="'+by+'" x2="'+x+'" y2="'+(mid-gap/2)+'" stroke="'+line+'" stroke-width="'+(lw+1)+'"/>');
   roomLines.push('<line x1="'+x+'" y1="'+(mid+gap/2)+'" x2="'+x+'" y2="'+(by+rd)+'" stroke="'+line+'" stroke-width="'+(lw+1)+'"/>');
  }
  const midX=bx+rw*.5,gapX=Math.max(8,Math.min(14,rw*.055));
  roomLines.push('<line x1="'+bx+'" y1="'+(by+rd/2)+'" x2="'+(midX-gapX/2)+'" y2="'+(by+rd/2)+'" stroke="'+line+'" stroke-width="'+(lw+1)+'"/>');
  roomLines.push('<line x1="'+(midX+gapX/2)+'" y1="'+(by+rd/2)+'" x2="'+(bx+rw)+'" y2="'+(by+rd/2)+'" stroke="'+line+'" stroke-width="'+(lw+1)+'"/>');
  const names=(v.room_names||[]).length?v.room_names:['Room 1','Room 2','Room 3','Room 4','Room 5','Room 6'];
  for(let i=0;i<rooms;i++){
   const col=i%cols,row=Math.floor(i/cols),cx=bx+rw*(col+.5)/cols,cy=by+rd*(row+.5)/rows;
   const label=String(names[i]||('Room '+(i+1))).slice(0,22).replace(/[&<>\\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
   roomLabels.push('<text x="'+cx+'" y="'+cy+'" font-size="9" fill="'+line+'" text-anchor="middle" dominant-baseline="middle">'+label+'</text>');
  }
 }else{
  roomLines.push('<line x1="'+(bx+rw*.5)+'" y1="'+by+'" x2="'+(bx+rw*.5)+'" y2="'+(by+rd*.48)+'" stroke="'+line+'" stroke-width="'+(lw+1)+'"/>');
  roomLines.push('<line x1="'+(bx+rw*.22)+'" y1="'+(by+rd*.5)+'" x2="'+(bx+rw*.78)+'" y2="'+(by+rd*.5)+'" stroke="'+line+'" stroke-width="'+(lw+1)+'"/>');
  roomLines.push('<line x1="'+(bx+rw*.22)+'" y1="'+(by+rd*.5)+'" x2="'+(bx+rw*.22)+'" y2="'+(by+rd)+'" stroke="'+line+'" stroke-width="'+(lw+1)+'"/>');
  roomLines.push('<line x1="'+(bx+rw*.78)+'" y1="'+(by+rd*.5)+'" x2="'+(bx+rw*.78)+'" y2="'+(by+rd)+'" stroke="'+line+'" stroke-width="'+(lw+1)+'"/>');
 }
 const planNames=v.room_names||[];const zoneName=(i,fallback)=>String(planNames[i]||fallback).slice(0,22).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
 const labels=shape==='U'?[[bx+rw*.25,by+rd*.22,zoneName(0,'WING A')],[bx+rw*.75,by+rd*.22,zoneName(1,'WING B')],[bx+rw*.5,by+rd*.83,zoneName(2,'CLASSROOM / WING')],[bx+rw*.5,by+rd*.26,'COURTYARD']]:shape==='L'?[[bx+rw*.25,by+rd*.2,zoneName(0,'WING A')],[bx+rw*.73,by+rd*.72,zoneName(1,'WING B')]]:[[bx+rw*.5,by+rd*.22,zoneName(0,'MAIN BLOCK')],[bx+rw*.5,by+rd*.76,zoneName(1,'WING')]];
 const labelSvg=labels.map(([x,y,t])=>'<text x="'+x+'" y="'+y+'" font-size="9" fill="'+line+'" text-anchor="middle">'+t+'</text>').join('')+roomLabels.join('');
 const doorWidth=Math.max(7,Math.min(15,.9*scale)),windowWidth=Math.max(10,Math.min(25,1.5*scale));
 const doorSvg='<g stroke="#80543a" fill="none" stroke-width="1.5"><path d="M '+(bx+rw*.5)+' '+(by+rd*.5)+' v '+doorWidth+' m 0 '+(-doorWidth)+' a '+doorWidth+' '+doorWidth+' 0 0 1 '+doorWidth+' '+doorWidth+'"/><path d="M '+(bx+rw*.25)+' '+(by+rd*.5)+' h '+doorWidth+' m '+(-doorWidth)+' 0 a '+doorWidth+' '+doorWidth+' 0 0 0 '+doorWidth+' '+doorWidth+'"/></g>';
 const windowSvg='<g stroke="#2b91b5" stroke-width="3"><path d="M '+(bx+rw*.18)+' '+by+' h '+windowWidth+' M '+(bx+rw*.68)+' '+(by+rd)+' h '+windowWidth+' M '+bx+' '+(by+rd*.18)+' v '+windowWidth+' M '+(bx+rw)+' '+(by+rd*.68)+' v '+windowWidth+'"/></g>';
 const dimensionSvg='<g stroke="#52677b" fill="none" stroke-width="1"><path d="M '+bx+' '+(by-17)+' v -7 M '+(bx+rw)+' '+(by-17)+' v -7 M '+bx+' '+(by-21)+' H '+(bx+rw)+' M '+(bx-17)+' '+by+' h -7 M '+(bx-17)+' '+(by+rd)+' h -7 M '+(bx-21)+' '+by+' V '+(by+rd)+'"/><g fill="#34495e" stroke="none" font-size="10"><text x="'+(bx+rw/2)+'" y="'+(by-25)+'" text-anchor="middle">'+w.toFixed(2)+' m</text><text x="'+(bx-25)+'" y="'+(by+rd/2)+'" text-anchor="middle" transform="rotate(-90 '+(bx-25)+' '+(by+rd/2)+')">'+d.toFixed(2)+' m</text></g></g>';
 const roomDimensionSvg=shape==='rectangle'?Array.from({length:rooms},(_,i)=>{const cols=Math.ceil(rooms/2),col=i%cols,row=Math.floor(i/cols),rwM=w/cols,rdM=d/2;return '<text x="'+(bx+rw*(col+.5)/cols)+'" y="'+(by+rd*(row+.5)/2+11)+'" font-size="7" fill="#52677b" text-anchor="middle">'+rwM.toFixed(2)+' × '+rdM.toFixed(2)+' m</text>';}).join(''):'';
 const north=v.plot_orientation==='north'?'N':v.plot_orientation.toUpperCase()[0];
 const area=(w*d*areaFactor).toFixed(1);const footprintStroke=plotFit?line:'#c0392b';
 $('footprintValue').textContent=area+' m² approx.';
 $('planDrawing').innerHTML=`<svg viewBox="0 0 520 360" role="img" aria-label="Conceptual ${shape}-shaped building footprint located within a plot boundary"><rect x="${px}" y="${py}" width="${plotPx}" height="${plotPy}" fill="#f7f9f4" stroke="#557b55" stroke-width="2" stroke-dasharray="6 4"/><rect x="${px+setback}" y="${py+front}" width="${Math.max(1,plotPx-2*setback)}" height="${Math.max(1,plotPy-front-setback)}" fill="none" stroke="#c19a55" stroke-dasharray="4 4"/><path d="${outline}" fill="${fill}" fill-rule="evenodd" stroke="${footprintStroke}" stroke-width="${lw+3}" stroke-linejoin="round"/><defs><clipPath id="footprintClip"><path d="${outline}" fill-rule="evenodd"/></clipPath></defs><g clip-path="url(#footprintClip)">${roomLines.join('')}</g>${doorSvg}${windowSvg}${dimensionSvg}${roomDimensionSvg}${labelSvg}<text x="${px+plotPx/2}" y="${Math.max(14,py-8)}" font-size="10" fill="#42617d" text-anchor="middle">PLOT ${plotW.toFixed(1)} m × ${plotD.toFixed(1)} m</text><text x="${px+plotPx/2}" y="${py+plotPy+14}" font-size="9" fill="#557b55" text-anchor="middle">LAND SURVEY BOUNDARY · CONCEPT SITE FIT</text><text x="${px+plotPx-8}" y="${py+14}" font-size="12" font-weight="bold" fill="#263d55" text-anchor="end">${north} ↑</text><text x="260" y="350" font-size="9" fill="#708197" text-anchor="middle">${$("floorPlanLevel").selectedOptions[0].textContent} · ${n}-storey ${shape}-shape concept · Approx. footprint ${area} m² · Setbacks indicative</text></svg><div class="site-plan-legend"><span>Green dashed: plot boundary</span><span>Gold dashed: indicative setback envelope</span><span>Blue line: building footprint</span></div>`;
}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function collectBrief(){return {client_name:$('clientName').value.trim(),client_email:$('clientEmail').value.trim()||null,client_phone:$('clientPhone').value.trim()||null,project_name:$('projectName').value.trim(),project_type:$('projectType').value,site_location:$('siteLocation').value.trim()||null,site_dimensions:{width_m:+$('width').value,depth_m:+$('depth').value,floor_height_m:+$('floorHeight').value,storeys:+$('storeys').value,footprint_m2:+$('width').value*+$('depth').value,plot_width_m:+$('plotWidth').value,plot_depth_m:+$('plotDepth').value,front_setback_m:+$('frontSetback').value,side_setback_m:+$('sideSetback').value},building_requirements:{description:$('requirements').value.trim(),roof_type:$('roofType').value,custom_roof_description:$('customRoof').value.trim()||null,required_drawings:[...document.querySelectorAll('input[name="drawingType"]:checked')].map(x=>x.value)},visual_settings:getVisualSettings()}}
async function saveDesign(e){e?.preventDefault();if(!currentUser){$('formStatus').textContent='Please sign in to your TW&D client account, then return here to save your project.';return}
 const b=collectBrief();if(!b.client_name||!b.project_name||b.site_dimensions.width_m<4||b.site_dimensions.depth_m<4){$('formStatus').textContent='Please enter a client name, project name and valid building dimensions.';return}
 if(b.building_requirements.roof_type==='custom'&&!b.building_requirements.custom_roof_description){$('formStatus').textContent='Please describe your custom roof.';return}
 $('saveProject').disabled=true;$('formStatus').textContent='Saving your design brief securely…';
 try{
   let result;
   if(currentProjectId){const old=await supabase.from('design_projects').select('building_requirements').eq('id',currentProjectId).single();if(old.error)throw old.error;b.building_requirements.project_documents=old.data.building_requirements?.project_documents||[];result=await supabase.from('design_projects').update({client_name:b.client_name,client_email:b.client_email,client_phone:b.client_phone,project_name:b.project_name,project_type:b.project_type,site_location:b.site_location,site_dimensions:b.site_dimensions,building_requirements:b.building_requirements,roof_type:b.building_requirements.roof_type,custom_roof_description:b.building_requirements.custom_roof_description,latest_revision:currentRevision+1}).eq('id',currentProjectId).select().single()}
   else{result=await supabase.from('design_projects').insert({owner_id:currentUser.id,client_name:b.client_name,client_email:b.client_email,client_phone:b.client_phone,project_name:b.project_name,project_type:b.project_type,site_location:b.site_location,site_dimensions:b.site_dimensions,building_requirements:b.building_requirements,roof_type:b.building_requirements.roof_type,custom_roof_description:b.building_requirements.custom_roof_description}).select().single()}
   if(result.error)throw result.error;currentProjectId=result.data.id;currentRevision=result.data.latest_revision||1;renderUploadedFiles(b.building_requirements.project_documents||[]);
   const rev=await supabase.from('design_revisions').insert({design_project_id:currentProjectId,revision_number:currentRevision,design_inputs:b,generated_geometry:{type:'concept_mass_model',width_m:b.site_dimensions.width_m,depth_m:b.site_dimensions.depth_m,storeys:b.site_dimensions.storeys,floor_height_m:b.site_dimensions.floor_height_m,roof_type:b.building_requirements.roof_type,building_shape:b.visual_settings.building_shape,visual_settings:b.visual_settings},change_summary:'Design brief saved from TW&D Design Studio',created_by:currentUser.id});
   if(rev.error)throw rev.error;
   $('formStatus').textContent='Design brief saved to your secure TW&D workspace. Reference: '+currentProjectId;
   $('quoteStatus').textContent='Your design brief is saved. You can now save estimate items against this project.';
 }catch(err){console.error(err);$('formStatus').textContent='Could not save this brief: '+(err.message||'Please sign in and try again.')}
 finally{$('saveProject').disabled=false}
}
async function uploadProjectDocuments(){
 if(!currentUser){$('uploadStatus').textContent='Please sign in first.';return}
 if(!currentProjectId){$('uploadStatus').textContent='Save your project brief before uploading documents.';return}
 const files=[...($('projectFiles').files||[])];if(!files.length){$('uploadStatus').textContent='Choose one or more project documents first.';return}
 const allowed=/\.(pdf|png|jpe?g|webp|dwg|dxf|ifc)$/i;
 if(files.some(f=>!allowed.test(f.name))){$('uploadStatus').textContent='Supported formats: PDF, PNG, JPG, WEBP, DWG, DXF and IFC.';return}
 if(files.some(f=>f.size>100*1024*1024)){$('uploadStatus').textContent='Each file must be 100 MB or smaller.';return}
 $('uploadProjectFiles').disabled=true;$('uploadStatus').textContent='Uploading documents to your private TW&D project folder…';
 try{
  const meta=[];
  for(const file of files){
   const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-120);
   const path=currentUser.id+'/'+currentProjectId+'/'+crypto.randomUUID()+'_'+safeName;
   const up=await supabase.storage.from('twd-design-files').upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false});
   if(up.error)throw new Error(file.name+': '+up.error.message);
   meta.push({name:file.name,path,size:file.size,mime_type:file.type||'application/octet-stream',category:$('documentCategory').value,uploaded_at:new Date().toISOString()});
  }
  const project=await supabase.from('design_projects').select('building_requirements').eq('id',currentProjectId).single();
  if(project.error)throw project.error;
  const current=project.data.building_requirements||{};
  const docs=[...(current.project_documents||[]),...meta];
  const upd=await supabase.from('design_projects').update({building_requirements:{...current,project_documents:docs}}).eq('id',currentProjectId);
  if(upd.error)throw upd.error;
  $('projectFiles').value='';
  $('uploadStatus').textContent=meta.length+' document(s) uploaded securely. They are attached to this saved design project.';
  renderUploadedFiles(docs);
 }catch(err){console.error(err);$('uploadStatus').textContent='Upload could not be completed: '+(err.message||'Please retry.')}
 finally{$('uploadProjectFiles').disabled=false}
}
function renderUploadedFiles(docs=[]){
 const host=$('uploadedFileList');if(!host)return;
 host.innerHTML=docs.map(f=>'<div class="invoice-card"><div><strong>'+escapeHtml(f.name)+'</strong><small>'+escapeHtml(f.category||'Project document')+' · '+(Math.max(1,Math.round((f.size||0)/1024)))+' KB</small></div><span>Uploaded</span></div>').join('')||'No project documents uploaded yet.';
}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function requestAutomatedTakeoff(){
 if(!currentUser){$('quoteStatus').textContent='Please sign in to submit a quotation request.';return}
 if(!currentProjectId){$('quoteStatus').textContent='Save the project brief first.';return}
 $('requestTakeoff').disabled=true;$('quoteStatus').textContent='Submitting your project for TW&D quantity-takeoff review…';
 try{
  const brief=collectBrief();
  const project=await supabase.from('design_projects').select('building_requirements,site_dimensions').eq('id',currentProjectId).single();
  if(project.error)throw project.error;
  const docs=project.data.building_requirements?.project_documents||[];
  if(!docs.length){$('quoteStatus').textContent='Please upload architectural drawings and any available survey / soil report before requesting the BOQ review.';return}
  if(brief.building_requirements.required_drawings?.includes('site_plan')&&!docs.some(d=>d.category==='land_survey'||d.category==='survey_plan')){$('quoteStatus').textContent='A land survey / registered survey plan is required for the selected site-plan drawing package. Upload it under the Land survey category.';return}
  const existing=await supabase.from('boq_projects').select('id,status').eq('created_by',currentUser.id).eq('project_name',brief.project_name).eq('status','DRAFT').limit(1);
  if(existing.error)throw existing.error;
  if(existing.data?.length){$('quoteStatus').textContent='A BOQ review request already exists for this project: '+existing.data[0].id+'. TW&D can continue from the existing request.';return}
  const result=await supabase.from('boq_projects').insert({
   created_by:currentUser.id,client_name:brief.client_name,client_email:brief.client_email,client_phone:brief.client_phone,
   project_name:brief.project_name,project_type:brief.project_type,project_location:brief.site_location,
   dimensions:brief.site_dimensions,
   scope_notes:'AUTOMATED TAKE-OFF REQUEST · Design project '+currentProjectId+' · Documents uploaded: '+docs.length+' · Categories: '+[...new Set(docs.map(d=>d.category))].join(', ')+' · Building shape: '+(brief.visual_settings.building_shape||'rectangular')+' · Required drawings: '+(brief.building_requirements.required_drawings||[]).join(', ')+' · Survey plot: '+brief.site_dimensions.plot_width_m+'m × '+brief.site_dimensions.plot_depth_m+'m · Client has not entered quantities or rates. TW&D review required: validate drawings, survey levels, geotechnical report, structural design, scope, measurement rules and current local rates before preparing any priced BOQ. Preliminary estimates must be distinguished from engineer-verified final quantities.',
   subtotal:0,contingency_percent:0,contingency_amount:0,tax_percent:0,tax_amount:0,grand_total:0,status:'DRAFT',validity_days:14
  }).select().single();
  if(result.error)throw result.error;
  const link=await supabase.from('design_projects').update({quotation_id:result.data.id}).eq('id',currentProjectId);
  if(link.error)throw link.error;
  $('quoteStatus').textContent='Your request has been registered for TW&D review. Reference: '+result.data.id+'. No quantities or prices have been guessed. The BOQ, quotation and invoice will be generated after measurement, rate verification and engineering approval.';
 }catch(err){console.error(err);$('quoteStatus').textContent='Could not submit your request: '+(err.message||'Please try again.')}
 finally{$('requestTakeoff').disabled=false}
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
 await loadAdminRates();await loadSupplierReview();await loadAdminTakeoffRequests();
}
async function loadAdminTakeoffRequests(){
 const host=$('takeoffRequestList');if(!host)return;
 const r=await supabase.from('boq_projects').select('id,client_name,project_name,project_type,project_location,status,scope_notes,created_at').like('scope_notes','AUTOMATED TAKE-OFF REQUEST%').order('created_at',{ascending:false}).limit(100);
 if(r.error){host.textContent=r.error.message;return}
 const cards=[];
 for(const x of (r.data||[])){
  let links='';
  const dp=await supabase.from('design_projects').select('id,building_requirements').eq('quotation_id',x.id).maybeSingle();
  if(!dp.error&&dp.data){
   const docs=dp.data.building_requirements?.project_documents||[];
   const anchors=[];
   for(const doc of docs){
    const signed=await supabase.storage.from('twd-design-files').createSignedUrl(doc.path,3600);
    if(!signed.error&&signed.data?.signedUrl)anchors.push('<a href="'+escapeHtml(signed.data.signedUrl)+'" target="_blank" rel="noopener noreferrer">'+escapeHtml(doc.name)+'</a>');
   }
   if(anchors.length)links='<small>Submitted files: '+anchors.join(' · ')+'</small>';
  }
  cards.push('<div class="invoice-card"><div><strong>'+escapeHtml(x.project_name)+' · '+escapeHtml(x.client_name)+'</strong><small>'+escapeHtml(x.project_location||'Location not supplied')+' · '+new Date(x.created_at).toLocaleDateString('en-NG')+' · '+escapeHtml(x.status)+'</small><small>'+escapeHtml(x.scope_notes)+'</small>'+links+'</div><strong>'+x.id.slice(0,8)+'</strong></div>');
 }
 host.innerHTML=cards.join('')||'No automated take-off requests are awaiting review.';
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
 $('adminRateStatus').textContent=r.error?r.error.message:'Admin price added.';if(!r.error){$('adminRateForm').reset();await loadAdminRates()}
}
async function adminActions(e){
 const edit=e.target.closest('.edit-rate'),toggle=e.target.closest('.toggle-rate');if(edit){const r=await supabase.from('boq_price_catalog').select('*').eq('id',edit.dataset.id).single();if(r.data){$('adminRateCategory').value=r.data.category;$('adminRateDescription').value=r.data.description;$('adminRateUnit').value=r.data.unit;$('adminRateValue').value=r.data.unit_rate;$('adminRateLocation').value=r.data.source_location||'';$('adminRateExpiry').value=r.data.valid_until||'';$('adminRateStatus').textContent='Template copied into the form. Saving creates a new rate; deactivate the old rate to preserve its price history.'}return}
 if(toggle){const r=await supabase.from('boq_price_catalog').update({active:toggle.dataset.active!=='true',updated_by:currentUser.id}).eq('id',toggle.dataset.id);if(r.error)alert(r.error.message);await loadAdminRates()}
}
async function reviewSupplier(e){
 const b=e.target.closest('.approve-supplier'),n=e.target.closest('.reject-supplier');if(!b&&!n)return;const id=(b||n).dataset.id;
 const q=await supabase.from('boq_supplier_quotes').select('*').eq('id',id).single();if(q.error){alert(q.error.message);return}
 const x=q.data;let catalogId=null;
 if(b){const c=await supabase.from('boq_price_catalog').insert({category:x.category,description:x.item_description,unit:x.unit,unit_rate:x.unit_rate,currency:'NGN',active:true,price_source:'supplier',supplier_name:x.supplier_name,source_location:x.location,source_reference:x.quote_reference,valid_from:x.quoted_at,valid_until:x.valid_until,updated_by:currentUser.id}).select().single();if(c.error){alert(c.error.message);return}catalogId=c.data.id}
 const u=await supabase.from('boq_supplier_quotes').update({status:b?'approved':'rejected',reviewed_by:currentUser.id,reviewed_at:new Date().toISOString(),catalog_item_id:catalogId}).eq('id',id);if(u.error)alert(u.error.message);
 await loadSupplierReview();await loadAdminRates();
}
async function verifyReturn(){
 const q=new URLSearchParams(location.search),ref=q.get('tx_ref'),id=q.get('transaction_id');if(!ref)return;
 if(id){$('paymentStatus').textContent='Verifying payment…';const r=await supabase.functions.invoke('flutterwave-checkout',{body:{action:'verify',tx_ref:ref,transaction_id:id}});$('paymentStatus').textContent=r.error?r.error.message:(r.data?.paid?'Payment verified and invoice marked paid.':r.data?.message||'Payment is not yet verified.')}
 history.replaceState({},document.title,location.pathname);await loadInvoices();
}
async function initDesignWorkspace(){if(!currentUser)return;await Promise.all([loadInvoices(),setupAdmin()]);await verifyReturn()}

$('roofType').addEventListener('change',()=>{$('customRoofWrap').hidden=$('roofType').value!=='custom';drawBuilding()});
$('projectType').addEventListener('change',()=>{if($('projectType').value==='school'&&$('buildingShape').value==='rectangle')$('buildingShape').value='U';drawBuilding()});

$('buildingPreset').addEventListener('change',()=>{
 const p=$('buildingPreset').value;
 const presets={
  school_u:{type:'school',shape:'U',floors:'2',roof:'contemporary_flat',rooms:'6'},
  school_l:{type:'school',shape:'L',floors:'2',roof:'combination',rooms:'6'},
  school_h:{type:'school',shape:'H',floors:'3',roof:'contemporary_flat',rooms:'6'},
  school_t:{type:'school',shape:'T',floors:'2',roof:'conventional_gable',rooms:'5'},
  duplex:{type:'residential',shape:'rectangle',floors:'2',roof:'hip',rooms:'5'},
  courtyard_home:{type:'residential',shape:'courtyard',floors:'2',roof:'contemporary_flat',rooms:'5'},
  commercial:{type:'commercial',shape:'L',floors:'3',roof:'contemporary_flat',rooms:'6'},
  office:{type:'commercial',shape:'rectangle',floors:'4',roof:'contemporary_flat',rooms:'6'},
  hotel:{type:'commercial',shape:'U',floors:'3',roof:'combination',rooms:'6'},
  clinic:{type:'commercial',shape:'L',floors:'2',roof:'contemporary_flat',rooms:'6'}
 };
 const x=presets[p];if(!x)return;
 $('projectType').value=x.type;$('buildingShape').value=x.shape;$('storeys').value=x.floors;$('roofType').value=x.roof;$('roomCount').value=x.rooms;
 $('customRoofWrap').hidden=true;drawBuilding();
});
const aestheticPalettes={
 modern:{wall:'#e7e4dc',roof:'#233b57',glass:'#79b6d4',trim:'#ffffff',line:'#42617d',fill:'#f7fafc'},
 luxury:{wall:'#d8d0c1',roof:'#292d36',glass:'#6c9fb8',trim:'#c5a56a',line:'#243b53',fill:'#f5f0e7'},
 classic:{wall:'#efe6d5',roof:'#713f32',glass:'#83b4c9',trim:'#fffaf0',line:'#745b49',fill:'#fbf6ed'},
 tropical:{wall:'#e8e0c9',roof:'#344c3c',glass:'#6ea8b5',trim:'#f4ead3',line:'#46664f',fill:'#f4f6e9'},
 industrial:{wall:'#bfc5c9',roof:'#343a40',glass:'#668fa5',trim:'#e2e5e7',line:'#374a59',fill:'#edf1f3'},
 signature:{wall:'#e7e8e6',roof:'#e9e8e3',glass:'#263b52',trim:'#f6f5f1',line:'#34495e',fill:'#f7f8f7'}
};
function applyAesthetic(){
 const p=aestheticPalettes[$('aestheticPreset').value];if(!p)return;
 $('wallColor').value=p.wall;$('roofColor').value=p.roof;$('glassColor').value=p.glass;$('trimColor').value=p.trim;$('planLineColor').value=p.line;$('planFillColor').value=p.fill;drawBuilding();
}
$('aestheticPreset').addEventListener('change',applyAesthetic);
['wallColor','roofColor','glassColor','trimColor','planLineColor','planFillColor','planLineWidth','roomCount','roomNames','partitionDirection','primarySplitX','primarySplitY','windowStyle','facadeFinish','columnStyle','featureBalcony','featureColumns','featureFins','featureDriveway','featureLandscape','featureParapet','featureLighting'].forEach(id=>$(id).addEventListener('input',drawBuilding));
['interiorFloorFinish','interiorWallFinish','tileColor','interiorWallColor','interiorLighting','lightingIntensity','furniturePreset','sanitaryPreset','hardscapeFinish','hardscapeColor','gardenStyle','showInteriorLights','showFurniture','showPlumbing','showCeiling','showStampedJoints','showGreenAreas'].forEach(id=>$(id).addEventListener('input',drawBuilding));


function saveActiveFloorLayout(){const level=activeFloorKey;floorRoomNames[level]=$('roomNames').value;floorLayouts[level]={room_count:+$('roomCount').value,split_x:+$('primarySplitX').value/100,split_y:+$('primarySplitY').value/100,partition_direction:$('partitionDirection').value};}
function loadActiveFloorLayout(){const level=$('floorPlanLevel').value,layout=floorLayouts[level]||floorLayouts.ground;activeFloorKey=level;$('roomNames').value=floorRoomNames[level]||floorRoomNames.ground;$('roomCount').value=layout.room_count;$('primarySplitX').value=Math.round(layout.split_x*100);$('primarySplitY').value=Math.round(layout.split_y*100);$('partitionDirection').value=layout.partition_direction;}
function updateFloorPlanLevels(){const count=clamp(+$('storeys').value||1,1,4),levels=[...$('floorPlanLevel').options];levels.forEach((o,i)=>{o.disabled=i>=count});if($('floorPlanLevel').selectedOptions[0]?.disabled){$('floorPlanLevel').value=['ground','first','second','third'][count-1];loadActiveFloorLayout();}}
function switchFloorPlan(){saveActiveFloorLayout();saveActiveRoomInterior();loadActiveFloorLayout();loadActiveRoomInterior();drawBuilding();}
$('floorPlanLevel').addEventListener('change',switchFloorPlan);
$('roomNames').addEventListener('input',()=>{floorRoomNames[$('floorPlanLevel').value]=$('roomNames').value;drawBuilding()});
['roomCount','primarySplitX','primarySplitY','partitionDirection'].forEach(id=>$(id).addEventListener('input',()=>{saveActiveFloorLayout();drawBuilding()}));
loadActiveFloorLayout();
loadActiveRoomInterior();
$('roomEditSelect').addEventListener('change',()=>{saveActiveRoomInterior();activeRoomIndex=+$('roomEditSelect').value;loadActiveRoomInterior();drawBuilding();});
['roomFloorFinish','roomWallFinish','roomTileColor','roomWallColor','roomLighting','roomFurniture','roomSanitary','roomCeiling','roomDoor','roomStorage'].forEach(id=>$(id).addEventListener('input',roomEditorChanged));
$('roomNames').addEventListener('input',()=>{loadActiveRoomInterior();drawBuilding();});
['width','depth','floorHeight','buildingShape','plotWidth','plotDepth','frontSetback','sideSetback','plotOrientation'].forEach(id=>$(id).addEventListener('input',drawBuilding));
$('storeys').addEventListener('input',()=>{updateFloorPlanLevels();drawBuilding()});
updateFloorPlanLevels();
$('refreshPreview').addEventListener('click',drawBuilding);
function showExteriorView(view){$('interiorViewMode').value='exterior';drawBuilding();setCameraView(view);}
$('viewPerspective').addEventListener('click',()=>showExteriorView('perspective'));
$('viewInterior').addEventListener('click',()=>{$('interiorViewMode').value='interior';drawBuilding();setCameraView('interior')});
$('viewCutaway').addEventListener('click',()=>{$('interiorViewMode').value='cutaway';drawBuilding();setCameraView('cutaway')});
$('interiorViewMode').addEventListener('change',()=>{drawBuilding();setCameraView($('interiorViewMode').value==='interior'?'interior':$('interiorViewMode').value==='cutaway'?'cutaway':'perspective')});
$('interiorViewMode').addEventListener('change',()=>{const mode=$('interiorViewMode').value;viewer.dataset.previewMode=mode;$('viewerStatus').textContent=mode==='interior'?'Interior inspection mode · outer walls transparent':mode==='cutaway'?'Roof-off cutaway mode · rotate to inspect':'Exterior presentation mode'});
$('viewFront').addEventListener('click',()=>showExteriorView('front'));
$('viewSide').addEventListener('click',()=>showExteriorView('side'));
$('viewTop').addEventListener('click',()=>showExteriorView('top'));
$('viewReset').addEventListener('click',()=>showExteriorView('perspective'));
$('retryPreview').addEventListener('click',()=>{setup3D();if(renderer)setCameraView('perspective')});

$('designForm').addEventListener('submit',saveDesign);$('uploadProjectFiles').addEventListener('click',uploadProjectDocuments);$('requestTakeoff').addEventListener('click',requestAutomatedTakeoff);$('printBrief').addEventListener('click',()=>window.print());
$('downloadGlb').addEventListener('click',()=>{if(!buildingGroup)return;const exporter=new GLTFExporter();$('viewerStatus').textContent='Preparing 3D model file…';exporter.parse(buildingGroup,result=>{const blob=new Blob([result],{type:'model/gltf-binary'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='twd-building-concept-preview.glb';a.click();URL.revokeObjectURL(url);$('viewerStatus').textContent='Concept model exported as GLB. This is a visual massing model, not a CAD or structural file.';},error=>{$('viewerStatus').textContent='Model export failed: '+(error.message||'Please try again.');},{binary:true});});
function exportFootprintSvg(){const svg=$('planDrawing').querySelector('svg');if(!svg)return null;const clone=svg.cloneNode(true);clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('width','520');clone.setAttribute('height','360');clone.setAttribute('role','img');clone.setAttribute('aria-label','TW&D Engineering conceptual footprint plan');return new XMLSerializer().serializeToString(clone);}
 $('downloadSvg').addEventListener('click',()=>{const source=exportFootprintSvg();if(!source)return;const blob=new Blob([source],{type:'image/svg+xml;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='twd-footprint-concept-vector.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);});
 $('downloadPng').addEventListener('click',()=>{const source=exportFootprintSvg();if(!source)return;const status=$('viewerStatus');status.textContent='Rendering high-resolution 6000 px plan…';const blob=new Blob([source],{type:'image/svg+xml;charset=utf-8'});const sourceUrl=URL.createObjectURL(blob);const img=new Image();img.onload=()=>{try{const width=6000,height=Math.round(6000*360/520),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,width,height);canvas.toBlob(png=>{if(!png){status.textContent='PNG export failed. Please use the vector SVG export.';URL.revokeObjectURL(sourceUrl);return;}const pngUrl=URL.createObjectURL(png),a=document.createElement('a');a.href=pngUrl;a.download='twd-footprint-concept-6000px.png';a.click();setTimeout(()=>URL.revokeObjectURL(pngUrl),2000);status.textContent='High-resolution 6000 px PNG exported. For unlimited scaling, use the vector SVG export.';URL.revokeObjectURL(sourceUrl);},'image/png');}catch(error){status.textContent='High-resolution export failed: '+(error.message||'Please use SVG.');URL.revokeObjectURL(sourceUrl);}};img.onerror=()=>{status.textContent='Could not render the plan image. Please use the vector SVG export.';URL.revokeObjectURL(sourceUrl);};img.src=sourceUrl;});
try{
 const initialWidth=clamp(+$('width').value||12,4,80),initialDepth=clamp(+$('depth').value||18,4,80),initialFloors=clamp(+$('storeys').value||1,1,4);
 drawPlan(initialWidth,initialDepth,initialFloors,getVisualSettings());
}catch(initialPlanError){console.error('TW&D initial plan render failed:',initialPlanError);}
setup3D();
$('invoiceList').addEventListener('click',startInvoicePayment);
$('adminRateForm').addEventListener('submit',saveAdminRate);
$('adminCatalogList').addEventListener('click',adminActions);
$('supplierReviewList').addEventListener('click',reviewSupplier);

$('cancelRateEdit').addEventListener('click',()=>{$('adminRateForm').reset();$('cancelRateEdit').hidden=true;});
const {data:{session}}=await supabase.auth.getSession();currentUser=session?.user||null;
supabase.auth.onAuthStateChange((_event,s)=>{currentUser=s?.user||null;if(currentUser){$('formStatus').textContent='Signed in. Your design brief can be saved securely.';initDesignWorkspace()}});
if(!currentUser){$('formStatus').innerHTML='Sign in is required to save projects. <a href="account.html">Open your TW&D client account</a>.'}else{initDesignWorkspace()}
