import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshBVH} from 'three-mesh-bvh';
const host=document.getElementById('flightView'),notice=document.getElementById('viewStatus');
window.worldReady=false;let state={x:330,y:530,heading:0,altitude:60},pitch=38,overview=false,cameraHeading=null,cameraPitch=null,lastFrame=0;
window.flightView={update:s=>state=s,pitch:v=>pitch=+v};
try{
 const scene=new T.Scene();scene.background=new T.Color('#b9cbd2');scene.fog=new T.Fog('#b9cbd2',650,1450);const surround=new T.Mesh(new T.PlaneGeometry(12000,12000),new T.MeshStandardMaterial({color:0x899488,roughness:1}));surround.rotation.x=-Math.PI/2;surround.position.y=-4;scene.add(surround);const camera=new T.PerspectiveCamera(68,1,.08,2200),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;host.append(renderer.domElement);scene.add(new T.HemisphereLight(0xe5f5ff,0x8a9271,2.5));const sun=new T.DirectionalLight(0xffffff,3);sun.position.set(-300,700,350);scene.add(sun);
 const vector=p=>new T.Vector3(p.x-450,p.z??p.altitude,p.y-330),radius=1.5,colliders=[];
 notice.textContent='正在完整加载陆家嘴模型（含外围完整建筑）…';
 const files=await (await fetch('assets/model-parts.json?v=full1')).json(),models=new Array(files.length),loader=new GLTFLoader();let nextFile=0,loadedFiles=0;
 // Keep the full mesh, but limit concurrent downloads/decodes so mobile browsers
 // do not receive all 218 MB at once and exhaust memory before the UI appears.
 await Promise.all(Array.from({length:Math.min(4,files.length)},async()=>{while(nextFile<files.length){const index=nextFile++,file=files[index];models[index]=await loader.loadAsync(`assets/${file}?v=full1`);loadedFiles++;notice.textContent=`正在加载完整陆家嘴模型 ${loadedFiles}/${files.length} · 请保持页面打开`;await new Promise(resolve=>setTimeout(resolve,0));}}));
 notice.textContent='正在建立全场景碰撞结构…';await new Promise(resolve=>setTimeout(resolve,30));
 for(const model of models){scene.add(model.scene);model.scene.updateMatrixWorld(true);model.scene.traverse(mesh=>{if(!mesh.isMesh)return;for(const material of (Array.isArray(mesh.material)?mesh.material:[mesh.material])){material.metalness=.05;material.roughness=.8}const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);geometry.computeBoundingBox();const name=mesh.name;const label=name.includes('_tree_')?(name.includes('trunk')?'树干':'树冠'):name.includes('slope')?'缓坡':name.startsWith('source_1227')?'湖面（触水）':geometry.boundingBox.max.y>5?'建筑':'地面';colliders.push({bvh:new MeshBVH(geometry,{maxLeafTris:12}),box:geometry.boundingBox.clone(),label});});}
 const traffic=new T.Group();for(const angle of [0,Math.PI/2]){const arm=new T.Mesh(new T.BoxGeometry(2.6,.25,.25),new T.MeshStandardMaterial({color:'#ff6c35'}));arm.rotation.y=angle;traffic.add(arm)}traffic.add(new T.Mesh(new T.SphereGeometry(.5,12,8),new T.MeshStandardMaterial({color:'#ff9d60'})));scene.add(traffic);traffic.visible=false;
 window.worldCollision=(a,b)=>{
  const pa=vector(a),pb=vector(b),segment=new T.Line3(pa,pb),box=new T.Box3().setFromPoints([pa,pb]).expandByScalar(radius);let best=null;
  for(const c of colliders){if(!box.intersectsBox(c.box))continue;c.bvh.shapecast({intersectsBounds:bounds=>bounds.intersectsBox(box),intersectsTriangle:tri=>{
   if(tri.closestPointToSegment(segment)>radius)return false;
   let lo=0,hi=best?.t??1;const end=pa.clone().lerp(pb,hi),prefix=new T.Line3(pa,end);if(tri.closestPointToSegment(prefix)>radius)return false;
   for(let n=0;n<20;n++){const mid=(lo+hi)/2;prefix.end.copy(pa).lerp(pb,mid);if(tri.closestPointToSegment(prefix)<=radius)hi=mid;else lo=mid}
   if(!best||hi<best.t)best={t:Math.max(0,hi-1e-5),label:c.label};return false;
  }});}return best;
 };
 function nearest(p){let best=null;const candidates=colliders.map(c=>({c,d:c.box.distanceToPoint(p)})).sort((a,b)=>a.d-b.d);for(const {c,d} of candidates){if(d>(best?.distance??Infinity))break;const h=c.bvh.closestPointToPoint(p,{},0,best?.distance??Infinity);if(h&&(!best||h.distance<best.distance))best={...h,label:c.label};}return best;}
 function rayDistance(p,d){const ray=new T.Ray(p,d);let best=null;for(const c of colliders){if(!ray.intersectsBox(c.box))continue;const h=c.bvh.raycastFirst(ray,T.DoubleSide);if(h&&h.distance<=200+radius&&(!best||h.distance<best.distance))best={...h,label:c.label};}return best;}
 const reticle=document.querySelector('.reticle'),panel=document.createElement('section');panel.className='proximity-hud';panel.setAttribute('aria-label','碰撞体净距离，单位米');panel.innerHTML='<span class="proximity-unit">净距 · m</span><span class="proximity-boundary"></span><p class="closest-reading"></p><div class="proximity-grid"></div><p class="proximity-target"></p>';reticle.append(panel);
 const landmarkTags=(Sequence.landmarks||[]).map(landmark=>{const element=document.createElement('div');element.className='world-landmark';element.textContent=landmark.name;element.title=`${landmark.name} · 地标位置标注`;document.body.append(element);return{landmark,element}});
 const directions=[['前','front'],['右','right'],['后','back'],['左','left'],['上','up'],['下','down']];const rows=directions.map(([label,direction])=>{const div=document.createElement('div');div.className='proximity-reading';div.dataset.direction=direction;div.innerHTML=`<span>${label}</span><b>—</b>`;panel.querySelector('.proximity-grid').append(div);return div});const tag=document.createElement('div');tag.className='surface-distance';tag.hidden=true;document.body.append(tag);let closest=null,lastProbe=0;
 // Mavic 3E/3M reference model: DJI specifies 30 m minimum horizontal braking
 // distance at 21 m/s in Sport mode and 10 m vertically while climbing/descending.
 // Horizontal stopping distance is scaled with v^2; the warning line adds one
 // second of travel and never falls below DJI Pilot 2's 16 m obstacle display band.
 const horizontalLimits=speed=>{const v=Math.max(0,Math.min(21,Number(speed)||0)),danger=Math.max(5,30*(v/21)**2);return{danger,warning:Math.max(16,danger+v)}};
 const verticalLimits=speed=>{const v=Math.abs(Number(speed)||0),danger=v>.05?10:3;return{danger,warning:Math.max(10,danger+v)}};
 const tone=(d,limits)=>d<=limits.danger?'danger':d<=limits.warning?'warning':'normal';
 const flightSpeed=()=>state.status==='manual'?Math.max(0,state.manualSpeed||0):Math.max(0,state.speed||0);
 window.UAVSafetyBoundary={horizontalLimits,verticalLimits,reference:'DJI Mavic 3E/3M'};
 const viewButton=document.createElement('button');viewButton.textContent='三维地图总览';viewButton.onclick=()=>{overview=!overview;viewButton.textContent=overview?'返回机载视角':'三维地图总览'};document.querySelector('.camera-strip').append(viewButton);
 window.flightView={update:s=>state=s,pitch:v=>pitch=+v,capture:()=>renderer.domElement.toDataURL('image/png')};
 const resize=()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()};addEventListener('resize',resize);resize();
 function draw(now){requestAnimationFrame(draw);const pos=vector(state),targetHeading=state.heading*Math.PI/180,dt=lastFrame?Math.min(.1,(now-lastFrame)/1000):0;lastFrame=now;
  cameraHeading=cameraHeading===null?targetHeading:FlightControls.smoothHeading(cameraHeading,targetHeading,dt,95,5);const heading=cameraHeading,target=state.lookAt?vector(state.lookAt):null,horizontal=target?Math.hypot(target.x-pos.x,target.z-pos.z):0,targetPitch=target?Math.atan2(pos.y-target.y,horizontal):pitch*Math.PI/180;
  cameraPitch=cameraPitch===null?targetPitch:FlightControls.smoothHeading(cameraPitch,targetPitch,dt,60,4);
  if(overview){camera.position.set(680,670,820);camera.lookAt(0,20,0)}else{camera.position.copy(pos);const p=cameraPitch;camera.lookAt(pos.clone().add(new T.Vector3(Math.sin(heading)*Math.cos(p),-Math.sin(p),-Math.cos(heading)*Math.cos(p))))}
  camera.updateMatrixWorld();for(const {landmark,element} of landmarkTags){const q=vector({x:landmark.point[0],y:landmark.point[1],z:Math.min(landmark.height*.68,320)}).project(camera),visible=q.z>-1&&q.z<1&&Math.abs(q.x)<1.04&&Math.abs(q.y)<.94;element.hidden=!visible;if(visible){element.style.left=(q.x+1)*innerWidth/2+'px';element.style.top=(1-q.y)*innerHeight/2+'px'}}
  traffic.visible=!!state.traffic;if(state.traffic)traffic.position.copy(vector(state.traffic));document.getElementById('trafficMarker').hidden=true;
  if(now-lastProbe>200){lastProbe=now;const horizontal=horizontalLimits(flightSpeed()),vertical=verticalLimits(state.verticalSpeed),conservative={danger:Math.max(horizontal.danger,vertical.danger),warning:Math.max(horizontal.warning,vertical.warning)};panel.querySelector('.proximity-boundary').textContent=`制动 ${horizontal.danger.toFixed(1)} · 预警 ${horizontal.warning.toFixed(1)}`;panel.title=`Mavic 3E/3M 参考边界｜水平速度 ${flightSpeed().toFixed(1)} m/s｜红色 ≤ ${horizontal.danger.toFixed(1)} m｜橙色 ≤ ${horizontal.warning.toFixed(1)} m｜绿色 > ${horizontal.warning.toFixed(1)} m`;closest=nearest(pos);const read=panel.querySelector('.closest-reading');if(closest){const d=Math.max(0,closest.distance-radius);read.textContent=`最近${closest.label} ${d.toFixed(1)} m`;read.dataset.tone=tone(d,conservative)}
   [0,90,180,270,'up','down'].forEach((angle,i)=>{const a=heading+(Number(angle)||0)*Math.PI/180,direction=i<4?new T.Vector3(Math.sin(a),0,-Math.cos(a)):new T.Vector3(0,i===4?1:-1,0),h=rayDistance(pos,direction),d=h?Math.max(0,h.distance-radius):Infinity,limits=i<4?horizontal:vertical;rows[i].querySelector('b').textContent=h?d.toFixed(1):'>200';rows[i].dataset.tone=h?tone(d,limits):'normal'});
   const readTraffic=panel.querySelector('.proximity-target');if(state.traffic){const d=Math.max(0,pos.distanceTo(vector(state.traffic))-radius*2),relativeSpeed=flightSpeed()+Math.hypot(state.traffic.vx||0,state.traffic.vy||0),trafficLimits=horizontalLimits(relativeSpeed);readTraffic.textContent='移动无人机 '+d.toFixed(1)+' m';readTraffic.dataset.tone=tone(d,trafficLimits);readTraffic.title=`相对闭合速度按 ${relativeSpeed.toFixed(1)} m/s 保守估计`}else{readTraffic.textContent='移动目标：无';readTraffic.dataset.tone='unknown';readTraffic.title=''};
  }
  tag.hidden=true;if(closest){const projection=closest.point.clone().project(camera);if(Math.abs(projection.x)<.95&&Math.abs(projection.y)<.9&&projection.z>-1&&projection.z<1){const limits=horizontalLimits(flightSpeed());tag.style.left=(projection.x+1)*innerWidth/2+'px';tag.style.top=(1-projection.y)*innerHeight/2+'px';tag.textContent=`${closest.label} · ${Math.max(0,closest.distance-radius).toFixed(1)} m`;tag.dataset.tone=tone(closest.distance-radius,limits);tag.hidden=false}}
  renderer.render(scene,camera);
 }
 
 if(new URLSearchParams(location.search).has('qa')){
  const cases=[{"name": "tree sweep", "a": {"x": 464.60179247670806, "y": 504.04996471998845, "z": 2.089772412264062}, "b": {"x": 484.60179247670806, "y": 504.04996471998845, "z": 2.089772412264062}, "expected": ["树干", "树冠"]}, {"name": "hill descent", "a": {"x": 380, "y": 520, "z": 10}, "b": {"x": 380, "y": 520, "z": 0}, "expected": ["缓坡"]}, {"name": "building sweep", "a": {"x": 110, "y": 200, "z": 60}, "b": {"x": 790, "y": 200, "z": 60}, "expected": ["建筑"]}, {"name": "lake descent", "a": {"x": 450, "y": 380, "z": 60}, "b": {"x": 450, "y": 380, "z": -2}, "expected": ["湖面（触水）"]}];const results=cases.map(test=>{const hit=window.worldCollision(test.a,test.b);let clearance=null;if(hit){const a=vector(test.a),b=vector(test.b),q=a.lerp(b,hit.t),n=nearest(q);clearance=n?n.distance-radius:null}return {name:test.name,hit,clearance,pass:!!hit&&test.expected.includes(hit.label)&&Math.abs(clearance)<.05}});
  for(let i=0;i<4;i++){const a=Sequence.points[i].point,b=Sequence.points[i+1].point;results.push({name:'route '+i,pass:!window.worldCollision({x:a[0],y:a[1],z:60},{x:b[0],y:b[1],z:60})})}
  const report=document.createElement('pre');report.id='modelQa';report.hidden=true;report.textContent=JSON.stringify(results);document.body.append(report);host.dataset.qaPassed=String(results.every(r=>r.pass));
 }
host.dataset.worldSource='Lujiazui fixed mesh';host.dataset.colliderCount=colliders.length;window.worldReady=true;notice.textContent='陆家嘴实体场景已就绪 · 树林与缓坡为实验补建';window.dispatchEvent(new Event('world-ready'));requestAnimationFrame(draw);
}catch(e){notice.textContent='模型加载失败：'+e.message;host.dataset.worldError=e.message;console.error(e)}
