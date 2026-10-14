'use strict';
(async function(){
const notice=document.getElementById('viewStatus'),host=document.getElementById('flightView');window.worldReady=false;let state={x:130,y:525,heading:0,altitude:60};window.flightView={update:s=>{state=s},pitch:()=>{},capture:()=>{throw Error('场景尚未加载')}};
try{
 if(!window.Cesium)throw Error('三维引擎未能加载');
 const C=Cesium,ref=window.MAP_REFERENCE;C.Ion.defaultAccessToken='';
 const terrain=await C.CesiumTerrainProvider.fromUrl('https://3d.geo.admin.ch/ch.swisstopo.terrain.3d/v1/',{requestVertexNormals:true});
 const imagery=new C.UrlTemplateImageryProvider({url:'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg',maximumLevel:20,rectangle:C.Rectangle.fromDegrees(5.9,45.8,10.6,47.9),credit:'© swisstopo · SWISSIMAGE'});
 const viewer=new C.Viewer(host,{terrainProvider:terrain,baseLayer:new C.ImageryLayer(imagery),baseLayerPicker:false,animation:false,timeline:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,fullscreenButton:false,selectionIndicator:false,infoBox:false,shouldAnimate:false,contextOptions:{webgl:{preserveDrawingBuffer:true}}});
 const scene=viewer.scene;scene.screenSpaceCameraController.enableInputs=false;scene.screenSpaceCameraController.enableCollisionDetection=false;scene.globe.depthTestAgainstTerrain=true;scene.globe.maximumScreenSpaceError=1.5;scene.fog.enabled=false;viewer.resolutionScale=Math.min(devicePixelRatio,1.5);viewer.clock.currentTime=C.JulianDate.fromIso8601('2026-06-21T12:00:00Z');scene.globe.enableLighting=false;
 let pitch=38,yaw=0,baseHeight=500,tilesLoaded=0,ready=false,overview=false,loadError=false;
 const coordinates=(x,y)=>({lon:ref.west+x/900*(ref.east-ref.west),lat:ref.north-y/660*(ref.north-ref.south)});
 const cart=(x,y,z)=>{const p=coordinates(x,y);return C.Cartesian3.fromDegrees(p.lon,p.lat,baseHeight+z)};
 const origin=coordinates(130,525),sample=await C.sampleTerrainMostDetailed(terrain,[C.Cartographic.fromDegrees(origin.lon,origin.lat)]);if(!Number.isFinite(sample[0].height))throw Error('起点地形高程不可用');baseHeight=sample[0].height;
 const tiles=await C.Cesium3DTileset.fromUrl('https://3d.geo.admin.ch/ch.swisstopo.swissbuildings3d.3d/v1/tileset.json',{maximumScreenSpaceError:3,cacheBytes:256*1024*1024,maximumCacheOverflowBytes:128*1024*1024});scene.primitives.add(tiles);
 tiles.tileLoad.addEventListener(()=>{tilesLoaded++;host.dataset.buildingTiles=String(tilesLoaded)});tiles.tileFailed.addEventListener(()=>{loadError=true;notice.textContent='部分三维建筑加载失败 · 请暂停并刷新重试'});
 const target=viewer.entities.add({show:false,position:C.Cartesian3.ZERO,ellipsoid:{radii:new C.Cartesian3(1.5,1.5,.7),material:C.Color.ORANGERED,outline:true,outlineColor:C.Color.WHITE},label:{text:'移动无人机',font:'13px sans-serif',fillColor:C.Color.WHITE,showBackground:true,backgroundColor:C.Color.fromCssColorString('#822b23cc'),pixelOffset:new C.Cartesian2(0,-22),disableDepthTestDistance:0}});
 const proximity=document.createElement('section');proximity.className='proximity glass';proximity.setAttribute('aria-label','碰撞体距离');proximity.innerHTML='<strong>碰撞体测距 <small>机身外缘净距</small></strong><div class="proximity-grid"></div><p class="proximity-target">移动目标：—</p><small>方向采样 200 m · 已加载模型<br>树木：未建模，无法测距</small>';document.body.append(proximity);
 const directions=[['前',0,0],['右',90,0],['后',180,0],['左',270,0],['上',0,1],['下',0,-1]];
 const rows=directions.map(([label])=>{const el=document.createElement('div');el.innerHTML=`<span>${label}</span><b>—</b>`;proximity.querySelector('.proximity-grid').append(el);return el});
 const distanceTag=document.createElement('div');distanceTag.className='surface-distance';distanceTag.hidden=true;document.body.append(distanceTag);let nearestSample=null;
 const tone=d=>d<=5?'danger':d<=15?'warning':'normal';let lastProbe='';
 setInterval(()=>{
  if(!ready)return;
  const p=cart(state.x,state.y,state.altitude),frame=C.Transforms.eastNorthUpToFixedFrame(p),radius=window.Collision?.radius||1.5;
  const complete=tiles.tilesLoaded&&scene.globe.tilesLoaded&&!loadError;
  const dynamic=proximity.querySelector('.proximity-target');if(state.traffic){const t=cart(state.traffic.x,state.traffic.y,state.traffic.altitude),d=Math.max(0,C.Cartesian3.distance(p,t)-radius*2);dynamic.textContent=`移动无人机净距 ${d.toFixed(1)} m`;dynamic.dataset.tone=tone(d)}else{dynamic.textContent='移动目标：无';dynamic.dataset.tone='unknown'}
  const key=[state.x,state.y,state.altitude,state.heading,tilesLoaded,complete].join(':');if(complete&&key===lastProbe)return;lastProbe=key;nearestSample=null;
  directions.forEach(([label,angle,vertical],i)=>{
   try{
    const h=C.Math.toRadians(state.heading+angle),local=vertical?new C.Cartesian3(0,0,vertical):new C.Cartesian3(Math.sin(h),Math.cos(h),0);
    const direction=C.Matrix4.multiplyByPointAsVector(frame,local,new C.Cartesian3()),ray=new C.Ray(p,direction);
    const building=scene.pickFromRay(ray,[target],.1);let ground=scene.globe.pick(ray,scene);
    if(vertical===-1){const gp=C.Cartographic.fromCartesian(p),height=scene.globe.getHeight(gp);if(Number.isFinite(height)&&height<=gp.height)ground=C.Cartesian3.fromRadians(gp.longitude,gp.latitude,height)}
    const hits=[building?.position&&{position:building.position,type:'建筑'},ground&&{position:ground,type:'地面'}].filter(Boolean).map(hit=>({...hit,d:C.Cartesian3.distance(p,hit.position)-radius})).filter(hit=>hit.d<=200).sort((a,b)=>a.d-b.d);
    const hit=hits[0];rows[i].dataset.tone=hit?tone(hit.d):'unknown';rows[i].querySelector('b').textContent=hit?`${Math.max(0,hit.d).toFixed(1)} m`:(complete?'未检出':'加载中');rows[i].title=hit?`${label}方${hit.type}表面净距`:'当前方向未取得有效表面距离，不表示周围无障碍';
    if(hit&&(!nearestSample||hit.d<nearestSample.d))nearestSample={...hit,label};
   }catch(e){rows[i].dataset.tone='unknown';rows[i].querySelector('b').textContent='不可用'}
  });
 },1000);
 scene.postRender.addEventListener(()=>{
  distanceTag.hidden=true;if(!nearestSample)return;const screen=C.SceneTransforms.worldToWindowCoordinates(scene,nearestSample.position);
  if(!screen||screen.x<0||screen.y<0||screen.x>scene.canvas.clientWidth||screen.y>scene.canvas.clientHeight)return;
  const rect=scene.canvas.getBoundingClientRect();distanceTag.style.left=`${rect.left+screen.x}px`;distanceTag.style.top=`${rect.top+screen.y}px`;distanceTag.textContent=`${nearestSample.label}方${nearestSample.type} · ${Math.max(0,nearestSample.d).toFixed(1)} m`;distanceTag.dataset.tone=tone(nearestSample.d);distanceTag.hidden=false;
 });
 function status(){if(loadError)return;notice.textContent=ready?`真实三维地图已就绪 · 地形与建筑 © swisstopo · 高度基准 A 点`:'正在加载真实三维地形和建筑…'}
 window.flightView={update:s=>{state=s},pitch:v=>{pitch=Number(v)},capture:()=>scene.canvas.toDataURL('image/png'),overview:v=>{overview=v}};
 const viewButton=document.createElement('button');viewButton.id='worldOverview';viewButton.textContent='三维地图总览';viewButton.onclick=()=>{overview=!overview;viewButton.textContent=overview?'返回机载视角':'三维地图总览'};document.querySelector('.camera-strip').append(viewButton);
 window.worldCollision=(a,b)=>{
  if(!ready)return null;const pa=cart(a.x,a.y,a.z),pb=cart(b.x,b.y,b.z),delta=C.Cartesian3.subtract(pb,pa,new C.Cartesian3()),length=C.Cartesian3.magnitude(delta);if(length<.001)return null;
  const ray=new C.Ray(pa,C.Cartesian3.normalize(delta,delta));let nearest=null;
  const contact=scene.pickFromRay(ray,[target],3);if(contact?.position){const d=C.Cartesian3.distance(pa,contact.position);if(d<=length+1.5)nearest={t:Math.max(0,Math.min(1,(d-1.5)/length)),label:'真实建筑模型（已加载网格）'};}
  const ground=scene.globe.pick(ray,scene);if(ground){const d=C.Cartesian3.distance(pa,ground);if(d<=length+1.5&&(!nearest||d/length<nearest.t))nearest={t:Math.max(0,Math.min(1,(d-1.5)/length)),label:'真实地形'};}
  const gp=C.Cartographic.fromCartesian(pb),height=scene.globe.getHeight(gp);if(Number.isFinite(height)&&gp.height-1.5<=height)nearest=nearest||{t:0,label:'真实地形'};
  return nearest;
 };
 scene.preRender.addEventListener(()=>{
  const delta=((state.heading-yaw+540)%360)-180;yaw+=delta*.15;
  if(overview)viewer.camera.setView({destination:cart(450,330,850),orientation:{heading:C.Math.toRadians(15),pitch:C.Math.toRadians(-65),roll:0}});
  else viewer.camera.setView({destination:cart(state.x,state.y,state.altitude),orientation:{heading:C.Math.toRadians(yaw),pitch:C.Math.toRadians(-pitch),roll:0}});
  target.show=!!state.traffic;if(state.traffic)target.position=cart(state.traffic.x,state.traffic.y,state.traffic.altitude);
  const marker=document.getElementById('trafficMarker');if(marker)marker.hidden=true;
  if(!ready&&tilesLoaded>0&&scene.globe.tilesLoaded){ready=true;window.worldReady=true;window.dispatchEvent(new Event('world-ready'));}status();
 });
 host.dataset.worldSource='swissALTI3D + swissBUILDINGS3D';host.dataset.heightDatum=String(baseHeight);status();
}catch(error){notice.textContent='真实三维地图加载失败：'+error.message;host.dataset.worldError=error.message;console.error(error);}
})();


