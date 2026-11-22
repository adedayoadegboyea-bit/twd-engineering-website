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
let previewResizeObserver=null,previewContextLost=false;
function setup3D(){
 try{
  if(!viewer)throw new Error('The 3D preview container is missing from this page.');
  if(!window.WebGLRenderingContext)throw new Error('This browser does not expose WebGL. Try an updated Chrome browser or another device.');
  if(renderer){renderer.setAnimationLoop(null);renderer.dispose();renderer.domElement.remove();renderer=null}
  previewResizeObserver?.disconnect();previewResizeObserver=null;
  viewer.dataset.previewState='loading';
  $('viewerStatus').textContent='Starting 3D engine…';
  scene=new THREE.Scene();scene.background=new THREE.Color('#b8c9d8');scene.fog=new THREE.Fog('#c8d5df',55,150);
  const width=Math.max(1,viewer.clientWidth),height=Math.max(1,viewer.clientHeight);
  camera=new THREE.PerspectiveCamera(36,width/height,.1,600);camera.position.set(30,22,34);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));renderer.setSize(width,height);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  viewer.replaceChildren(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','Interactive TW&D building concept model. Drag to orbit and pinch or scroll to zoom.');
  renderer.domElement.addEventListener('webglcontextlost',event=>{
   event.preventDefault();previewContextLost=true;renderer?.setAnimationLoop(null);
   viewer.dataset.previewState='error';$('viewerStatus').textContent='The device paused its graphics context. Tap “Retry 3D preview” to reload the model.';
  },false);
  renderer.domElement.addEventListener('webglcontextrestored',()=>{previewContextLost=false;setup3D()},false);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.055;controls.target.set(0,4,0);controls.maxPolarAngle=Math.PI*.495;controls.minDistance=7;controls.maxDistance=180;
  scene.add(new THREE.HemisphereLight(0xe8f3ff,0x78816e,1.35));
  const sun=new THREE.DirectionalLight(0xfff0d8,3.2);sun.position.set(-28,42,24);sun.castShadow=true;
  sun.shadow.mapSize.set(1536,1536);sun.shadow.camera.left=-45;sun.shadow.camera.right=45;sun.shadow.camera.top=45;sun.shadow.camera.bottom=-45;sun.shadow.bias=-.00018;sun.shadow.normalBias=.025;scene.add(sun);
  const fill=new THREE.DirectionalLight(0xd6e7ff,.85);fill.position.set(25,18,-25);scene.add(fill);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(260,32,20),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color('#6e91b2')},bottom:{value:new THREE.Color('#e5edf2')}},vertexShader:'varying vec3 vWorld; void main(){vec4 p=modelMatrix*vec4(position,1.0);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}',fragmentShader:'varying vec3 vWorld; uniform vec3 top; uniform vec3 bottom; void main(){float h=normalize(vWorld).y;float t=smoothstep(-.18,.62,h);gl_FragColor=vec4(mix(bottom,top,t),1.0);}' }));
  scene.add(sky);
  const groundTex=makeCanvasTexture('grass');groundTex.repeat.set(16,16);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(240,240),new THREE.MeshStandardMaterial({map:groundTex,roughness:1}));
  ground.rotation.x=-Math.PI/2;ground.position.y=-.16;ground.receiveShadow=true;scene.add(ground);
  buildingGroup=new THREE.Group();scene.add(buildingGroup);drawBuilding();
  const resize=()=>{if(!renderer||previewContextLost)return;const w=viewer.clientWidth,h=viewer.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h)};
  if('ResizeObserver' in window){previewResizeObserver=new ResizeObserver(resize);previewResizeObserver.observe(viewer)}else{window.addEventListener('resize',resize,{passive:true})}
  renderer.setAnimationLoop(()=>{if(!previewContextLost){controls.update();renderer.render(scene,camera)}});
  viewer.dataset.previewState='ready';
  $('viewerStatus').textContent='3D preview ready · drag to rotate, pinch or scroll to zoom';
 }catch(e){
  viewer.dataset.previewState='error';
  $('viewerStatus').textContent='3D preview could not start: '+(e?.message||'graphics initialisation failed')+'. Check WebGL/device support and tap Retry.';
  console.error('TW&D Design Studio preview initialisation failed:',e);
 }
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
  facade_finish:$('facadeFinish').value,column_style:$('columnStyle').value,
  features:{balcony:$('featureBalcony').checked,columns:$('featureColumns').checked,fins:$('featureFins').checked,driveway:$('featureDriveway').checked,landscape:$('featureLandscape').checked,parapet:$('featureParapet').checked,lighting:$('featureLighting').checked}
 };
}

function setCameraView(view){
 if(!camera||!controls)return;
 const w=clamp(+$('width').value||12,4,80),d=clamp(+$('depth').value||18,4,80),height=(+$('storeys').value||2)*(+$('floorHeight').value||3.2);
 const span=Math.max(w,d)*2.05,centerY=height*.48;
 const poses={
  perspective:[span*.82,height+span*.48,span*.95],
  front:[0,centerY+height*.12,span*1.75],
  side:[span*1.75,centerY+height*.12,0],
  top:[.01,span*2.1,.01]
 };
 const p=poses[view]||poses.perspective;camera.position.set(p[0],p[1],p[2]);controls.target.set(0,view==='top'?0:centerY,0);controls.update();
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
function drawBuilding(){
 if(!buildingGroup)return;disposeBuildingGroup();
 const w=clamp(+$('width').value||12,4,80),d=clamp(+$('depth').value||18,4,80),n=+$('storeys').value||2,h=clamp(+$('floorHeight').value||3.2,2.7,5),roof=$('roofType').value,v=getVisualSettings(),total=n*h;
 const mat=(c,r=.72,m=0,texture=null)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m,map:texture||null});
 const wall=mat(v.wall,.88,0,makeCanvasTexture('stucco')),slab=mat('#aeb6bf',.82,0,makeCanvasTexture('concrete')),roofMat=mat(v.roof,.68),glass=mat(v.glass,.12,.32),trim=mat(v.trim,.36),dark=mat('#303943',.64),wood=mat(v.aesthetic==='luxury'?'#795039':'#80543a',.66,0,makeCanvasTexture('wood')),stone=mat('#b8b0a2',.9,0,makeCanvasTexture('stone')),light=mat('#fff0c8',.24,.08);
 const finish=v.facade_finish;
 const accent=finish==='charcoal'?dark:finish==='stone'?stone:finish==='timber'?wood:finish==='render'?wall:wood;
 const cladding=finish==='signature'||finish==='charcoal';
 const frontZ=d/2,backZ=-d/2;
 // Raised plinth and crisp floor bands create the layered silhouette in TW&D's reference residence.
 box(buildingGroup,w+.55,.42,d+.55,0,.21,0,slab);
 for(let floor=0;floor<n;floor++){
  const y=floor*h;
  // Side elevations remain continuous; window reveals and frames are layered onto the side faces.
  box(buildingGroup,.22,h,d, -w/2+.11,y+h/2,0,wall);
  box(buildingGroup,.22,h,d, w/2-.11,y+h/2,0,wall);
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
  // Side elevation glazing, with frames and projecting sills.
  const sideCount=Math.max(2,Math.floor(d/4.2));
  for(const side of [-1,1])for(let i=0;i<sideCount;i++){
   const z=-d/2+(i+1)*d/(sideCount+1),sw=Math.min(1.45,d/sideCount*.58),sh=h*.43;
   box(buildingGroup,.055,sh,sw,side*(w/2+.035),y+h*.54,z,glass);
   for(const yy of [y+h*.54-sh/2-.04,y+h*.54+sh/2+.04])box(buildingGroup,.1,.08,sw+.14,side*(w/2+.08),yy,z,trim);
   for(const zz of [z-sw/2-.04,z+sw/2+.04])box(buildingGroup,.1,sh+.16,.08,side*(w/2+.08),y+h*.54,zz,trim);
  }
  // Continuous slab edge and clean shadow line.
  box(buildingGroup,w+.42,.22,d+.42,0,y+.12,0,trim);
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
 // Internal partition walls use the same split settings as the plan, keeping the massing model and plan controls coordinated.
 const innerWall=mat('#eeeae2',.9),innerTrim=mat('#c7c2b8',.8);
 const wallThickness=.13,insideW=w-.44,insideD=d-.44;
 const roomCount=clamp(v.room_count,2,6),splitX=v.split_x,splitY=v.split_y;
 const partitionXs=[];
 if(v.partition_direction==='vertical'||v.partition_direction==='mixed'){
  for(let i=1;i<roomCount;i++){const ratio=i===1?splitX:(splitX+(1-splitX)*(i-1)/(roomCount-1));partitionXs.push(-insideW/2+insideW*ratio);}
 }
 const partitionYs=[];
 if(v.partition_direction==='horizontal'||v.partition_direction==='mixed'){
  const count=v.partition_direction==='mixed'?2:roomCount-1;
  for(let i=1;i<=count;i++){const ratio=i===1?splitY:(splitY+(1-splitY)*(i-1)/count);partitionYs.push(-insideD/2+insideD*ratio);}
 }
 for(let floor=0;floor<n;floor++){
  const floorY=floor*h;
  for(const x of partitionXs)box(buildingGroup,wallThickness,h*.72,insideD,x,floorY+h*.38,0,innerWall);
  for(const z of partitionYs)box(buildingGroup,insideW,h*.72,wallThickness,0,floorY+h*.38,z,innerWall);
  // Thin contrasting top edges make internal divisions legible in elevated / roof-off views.
  for(const x of partitionXs)box(buildingGroup,wallThickness+.035,.035,insideD,x,floorY+h*.75,0,innerTrim);
  for(const z of partitionYs)box(buildingGroup,insideW,.035,wallThickness+.035,0,floorY+h*.75,z,innerTrim);
 }
 // Roof/parapet silhouette and oversized entrance canopy.
 drawRoof(w,d,total,roof,roofMat);
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
 // Ground, paved arrival court, garden beds and layered planting.
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),mat('#dce5d8',.98,0,makeCanvasTexture('grass')));ground.rotation.x=-Math.PI/2;ground.position.y=-.13;ground.receiveShadow=true;buildingGroup.add(ground);
 if(v.features.driveway){
  const driveTex=makeCanvasTexture('concrete');driveTex.repeat.set(3,5);const drive=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w*.92,10),Math.min(d*.62,12)),mat('#737a80',.92,0,driveTex));drive.rotation.x=-Math.PI/2;drive.position.set(0,-.105,frontZ+Math.min(d*.27,4));buildingGroup.add(drive);
  for(const side of [-1,1])box(buildingGroup,.12,.12,Math.min(d*.62,12),side*Math.min(w*.49,5.2),-.035,frontZ+Math.min(d*.27,4),trim);
 }
 if(v.features.landscape){
  for(const x of [-w*.72,-w*.57,w*.57,w*.72]){
   const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.08,.14,1.35,10),mat('#79553a'));trunk.position.set(x,.55,d*.42);buildingGroup.add(trunk);
   const crown=new THREE.Mesh(new THREE.SphereGeometry(.9,14,10),mat('#3e7b50',.95));crown.position.set(x,1.72,d*.42);buildingGroup.add(crown);
   for(let k=0;k<3;k++){const shrub=new THREE.Mesh(new THREE.SphereGeometry(.34,10,8),mat('#4f8752',.96));shrub.position.set(x+(k-1)*.42,.3,d*.42+1.1);buildingGroup.add(shrub)}
  }
 }
 $('footprintValue').textContent=(w*d).toFixed(1)+' m²';$('storeyValue').textContent=String(n);$('roofValue').textContent=roofLabels[roof]||roof;
 if(camera){controls.target.set(0,total*.48,0);camera.position.set(Math.max(w,d)*1.65,total+Math.max(w,d)*.82,Math.max(w,d)*1.9);controls.update()}
 drawPlan(w,d,n,v);
}
function drawPlan(w,d,n,v=getVisualSettings()){
 const sx=430,sy=220,pad=42,scale=Math.min((sx-2*pad)/w,(sy-2*pad)/d),rw=w*scale,rd=d*scale,x=(sx-rw)/2,y=(sy-rd)/2;
 const rooms=clamp(v.room_count,2,6),lw=v.line_width;let partitions='',labels='';
 const xs=[];
 if(v.partition_direction==='vertical'||v.partition_direction==='mixed'){for(let i=1;i<rooms;i++){const ratio=i===1?v.split_x:(v.split_x+(1-v.split_x)*(i-1)/(rooms-1));xs.push(x+rw*ratio);}}
 const ys=[];
 if(v.partition_direction==='horizontal'||v.partition_direction==='mixed'){const count=v.partition_direction==='mixed'?2:rooms-1;for(let i=1;i<=count;i++){const ratio=i===1?v.split_y:(v.split_y+(1-v.split_y)*(i-1)/count);ys.push(y+rd*ratio);}}
 xs.forEach(px=>partitions+=`<line x1="${px}" y1="${y}" x2="${px}" y2="${y+rd}" stroke="${v.plan_line}" stroke-width="${lw+1.2}"/>`);
 ys.forEach(py=>partitions+=`<line x1="${x}" y1="${py}" x2="${x+rw}" y2="${py}" stroke="${v.plan_line}" stroke-width="${lw+1.2}"/>`);
 // Label each conceptual zone using the actual split coordinates.
 const xCuts=[x,...xs,x+rw],yCuts=[y,...ys,y+rd];let index=1;
 for(let row=0;row<yCuts.length-1;row++)for(let col=0;col<xCuts.length-1;col++){
  const cx=(xCuts[col]+xCuts[col+1])/2,cy=(yCuts[row]+yCuts[row+1])/2;
  labels+=`<text x="${cx}" y="${cy}" font-size="8.5" fill="${v.plan_line}" text-anchor="middle" dominant-baseline="middle">ZONE ${index++}</text>`;
 }
 // Simple door swing indicators and window markers communicate openings without implying a construction drawing.
 const doorX=x+rw*.5,doorY=y+rd;
 const doors=`<path d="M ${doorX-7} ${doorY} A 7 7 0 0 1 ${doorX} ${doorY-7}" fill="none" stroke="#b8793e" stroke-width="1.4"/><line x1="${doorX-7}" y1="${doorY}" x2="${doorX}" y2="${doorY}" stroke="#b8793e" stroke-width="2"/>`;
 const windows=[.2,.5,.8].map(t=>`<line x1="${x+rw*t-5}" y1="${y}" x2="${x+rw*t+5}" y2="${y}" stroke="#4e9ebd" stroke-width="3"/>`).join('');
 $('planDrawing').innerHTML=`<svg viewBox="0 0 430 220" role="img" aria-label="Indicative footprint ${w} by ${d} metres"><rect x="${x}" y="${y}" width="${rw}" height="${rd}" fill="${v.plan_fill}" stroke="${v.plan_line}" stroke-width="${lw+2}"/>${partitions}${labels}${doors}${windows}<text x="215" y="14" font-size="10" fill="${v.plan_line}" text-anchor="middle">${w.toFixed(1)} m</text><text x="13" y="108" font-size="10" fill="${v.plan_line}" transform="rotate(-90 13 108)" text-anchor="middle">${d.toFixed(1)} m</text><text x="215" y="214" font-size="9" fill="#708197" text-anchor="middle">${n}-storey concept · ${rooms} zones · indicative only</text></svg>`;
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
 industrial:{wall:'#bfc5c9',roof:'#343a40',glass:'#668fa5',trim:'#e2e5e7',line:'#374a59',fill:'#edf1f3'},
 signature:{wall:'#e7e8e6',roof:'#e9e8e3',glass:'#263b52',trim:'#f6f5f1',line:'#34495e',fill:'#f7f8f7'}
};
function applyAesthetic(){
 const p=aestheticPalettes[$('aestheticPreset').value];if(!p)return;
 $('wallColor').value=p.wall;$('roofColor').value=p.roof;$('glassColor').value=p.glass;$('trimColor').value=p.trim;$('planLineColor').value=p.line;$('planFillColor').value=p.fill;drawBuilding();
}
$('aestheticPreset').addEventListener('change',applyAesthetic);
['wallColor','roofColor','glassColor','trimColor','planLineColor','planFillColor','planLineWidth','roomCount','partitionDirection','primarySplitX','primarySplitY','windowStyle','facadeFinish','columnStyle','featureBalcony','featureColumns','featureFins','featureDriveway','featureLandscape','featureParapet','featureLighting'].forEach(id=>$(id).addEventListener('input',drawBuilding));

['width','depth','floorHeight','storeys'].forEach(id=>$(id).addEventListener('input',drawBuilding));
$('refreshPreview').addEventListener('click',drawBuilding);
$('viewPerspective').addEventListener('click',()=>setCameraView('perspective'));
$('viewFront').addEventListener('click',()=>setCameraView('front'));
$('viewSide').addEventListener('click',()=>setCameraView('side'));
$('viewTop').addEventListener('click',()=>setCameraView('top'));
$('viewReset').addEventListener('click',()=>{drawBuilding();setCameraView('perspective')});
$('retryPreview').addEventListener('click',()=>{setup3D();if(renderer)setCameraView('perspective')});

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
