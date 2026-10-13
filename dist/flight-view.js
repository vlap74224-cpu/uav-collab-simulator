'use strict';
(function(){
const host=document.getElementById('flightView'),notice=document.getElementById('viewStatus');
try{
 if(!window.THREE||!window.ViewTiles)throw Error('渲染库未加载');
 const T=THREE,scene=new T.Scene();scene.background=new T.Color('#b7cbd0');scene.fog=new T.Fog('#b7cbd0',850,1600);
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=T.SRGBColorSpace;host.append(renderer.domElement);renderer.domElement.setAttribute('aria-label','高清航空影像贴图的第一人称飞行仿真');
 const camera=new T.PerspectiveCamera(68,1,1,2200),loader=new T.TextureLoader();loader.setCrossOrigin('anonymous');
 const cache=new Map(),MAX_CACHE=240,MAX_REQUESTS=8,anisotropy=renderer.capabilities.getMaxAnisotropy();
 let wanted=[],wantedKeys=new Set(),inflight=0,sequence=0,state={x:420,y:500,heading:0,altitude:60},yaw=0,pitch=38,contextLost=false,lastPlan=0;
 function status(){const near=wanted.filter(t=>t.z===20),done=near.filter(t=>cache.get(t.key)?.status==='ready').length,failed=near.some(t=>cache.get(t.key)?.status==='failed');notice.textContent=done===near.length?'HD · 高清航空影像 / FPV 仿真':failed?'高清影像部分加载失败 · 使用已有底图':`高清影像加载中 ${done}/${near.length} · FPV 仿真`;host.dataset.hdLoaded=String(done);host.dataset.hdTotal=String(near.length);host.dataset.cachedTiles=String(cache.size)}
 function trim(){if(cache.size<=MAX_CACHE)return;const unused=[...cache.entries()].filter(([key,v])=>!wantedKeys.has(key)&&v.status!=='loading').sort((a,b)=>a[1].used-b[1].used);for(const [key,v] of unused){if(cache.size<=MAX_CACHE)break;if(v.mesh){scene.remove(v.mesh);v.mesh.material.map?.dispose();v.mesh.material.dispose();v.mesh.geometry.dispose()}cache.delete(key)}}
 function pump(){if(contextLost)return;for(const tile of wanted){if(inflight>=MAX_REQUESTS)break;const old=cache.get(tile.key);if(old&&!(old.status==='failed'&&old.attempts<2&&performance.now()-old.failedAt>15000))continue;
  const entry={status:'loading',used:sequence,attempts:(old?.attempts||0)+1};cache.set(tile.key,entry);inflight++;
  loader.load(`https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/${tile.key}.jpeg`,texture=>{
   texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=anisotropy;texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;
   const mesh=new T.Mesh(new T.PlaneGeometry(tile.size+.015,tile.size+.015),new T.MeshBasicMaterial({map:texture}));mesh.rotation.x=-Math.PI/2;mesh.position.set(tile.worldX,(tile.z-17)*.04,tile.worldY);scene.add(mesh);entry.mesh=mesh;entry.status='ready';inflight--;trim();status();pump();
  },undefined,()=>{entry.status='failed';entry.failedAt=performance.now();inflight--;status();pump()});
 }}
 function plan(){sequence++;wanted=ViewTiles.requests({...state,heading:yaw*180/Math.PI},pitch);wantedKeys=new Set(wanted.map(t=>t.key));for(const t of wanted){const hit=cache.get(t.key);if(hit)hit.used=sequence}trim();status();pump()}
 window.flightView={update:s=>{state=s},pitch:v=>{pitch=Number(v);lastPlan=0},capture:()=>renderer.domElement.toDataURL('image/png')};
 function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()}new ResizeObserver(resize).observe(host);resize();
 function frame(now){requestAnimationFrame(frame);if(contextLost)return;const desired=state.heading*Math.PI/180,delta=Math.atan2(Math.sin(desired-yaw),Math.cos(desired-yaw));yaw+=delta*.06;camera.position.set(state.x-450,state.altitude,state.y-330);camera.lookAt(camera.position.x+Math.sin(yaw)*100,camera.position.y-Math.tan(pitch*Math.PI/180)*100,camera.position.z-Math.cos(yaw)*100);if(now-lastPlan>450){plan();lastPlan=now}renderer.render(scene,camera)}plan();requestAnimationFrame(frame);
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;notice.textContent='飞行视图暂不可用，请使用地图';document.body.classList.add('map-expanded')});
}catch(e){notice.textContent='此设备暂不支持飞行视图，已显示地图';document.body.classList.add('map-expanded')}
})();
