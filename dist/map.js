'use strict';
window.MAP_REFERENCE={source:'用户提供的陆家嘴裁剪模型',localGrid:[900,660],coordinateSystem:'Local meters, unreferenced'};
(function(){
const bounds=L.latLngBounds([[0,0],[660,900]]),mapHost=document.getElementById('geoMap'),mapWrap=mapHost.parentElement,map=window.missionMap=L.map('geoMap',{crs:L.CRS.Simple,zoomControl:false,minZoom:-3,maxZoom:2,zoomSnap:.25});
L.imageOverlay('assets/lujiazui-map.png?v=buffer4',bounds).addTo(map);L.svgOverlay(document.getElementById('map'),bounds,{interactive:true}).addTo(map);let routeBounds=bounds,lastPosition={x:330,y:530,heading:0},followZoom=0;
const badge=document.createElement('div');badge.className='map-follow-badge';badge.setAttribute('aria-live','polite');mapWrap.append(badge);
const expanded=()=>document.body.classList.contains('map-expanded');
function follow(position){lastPosition={...lastPosition,...position};if(expanded())return;const heading=((Number(lastPosition.heading)||0)%360+360)%360;map.setView([660-lastPosition.y,lastPosition.x],followZoom,{animate:false});mapHost.style.transform=`rotate(${-heading}deg) scale(1.43)`;mapHost.style.setProperty('--map-label-rotation',`${heading}deg`);mapHost.classList.add('map-following');badge.textContent=`↑ 机头 ${String(Math.round(heading)).padStart(3,'0')}°`;}
window.updateMissionMap=follow;
window.setMissionMapExpanded=isExpanded=>{mapHost.style.transform='none';mapHost.style.setProperty('--map-label-rotation','0deg');mapHost.classList.toggle('map-following',!isExpanded);requestAnimationFrame(()=>{map.invalidateSize();if(isExpanded)map.fitBounds(routeBounds,{padding:[20,20]});else follow(lastPosition)})};
window.focusMissionRoute=points=>{routeBounds=L.latLngBounds(points.map(p=>[660-p[1],p[0]])).pad(.4);if(expanded())map.fitBounds(routeBounds,{padding:[20,20]});else follow(lastPosition)};
map.fitBounds(bounds);
document.getElementById('fitMap').onclick=()=>{if(expanded())map.fitBounds(routeBounds);else{followZoom=0;follow(lastPosition)}};
document.getElementById('mapZoomIn').onclick=()=>{if(expanded())map.zoomIn(.5);else{followZoom=Math.min(2,followZoom+.5);follow(lastPosition)}};
document.getElementById('mapZoomOut').onclick=()=>{if(expanded())map.zoomOut(.5);else{followZoom=Math.max(-3,followZoom-.5);follow(lastPosition)}};
map.on('zoomend',()=>{if(!expanded())followZoom=map.getZoom()});document.getElementById('baseLayer').hidden=true;document.getElementById('mapLoadStatus').textContent='陆家嘴模型 · 本地米制坐标';
new ResizeObserver(()=>{map.invalidateSize();if(expanded())map.fitBounds(routeBounds,{padding:[4,4]});else follow(lastPosition)}).observe(mapHost);
})();
