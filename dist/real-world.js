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


