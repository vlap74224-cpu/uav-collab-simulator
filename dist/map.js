'use strict';
window.MAP_REFERENCE={source:'用户提供的陆家嘴裁剪模型',localGrid:[900,660],coordinateSystem:'Local meters, unreferenced'};
(function(){
const bounds=L.latLngBounds([[0,0],[660,900]]),map=window.missionMap=L.map('geoMap',{crs:L.CRS.Simple,zoomControl:false,minZoom:-3,maxZoom:2,zoomSnap:.25});
L.imageOverlay('assets/repaired/lujiazui-map.png?v=repair5',bounds).addTo(map);L.svgOverlay(document.getElementById('map'),bounds,{interactive:true}).addTo(map);let routeBounds=bounds;
window.focusMissionRoute=points=>{routeBounds=L.latLngBounds(points.map(p=>[660-p[1],p[0]])).pad(.4);map.fitBounds(routeBounds,{padding:[20,20]})};
L.control.zoom({position:'topright',zoomInTitle:'放大',zoomOutTitle:'缩小'}).addTo(map);map.fitBounds(bounds);
document.getElementById('fitMap').onclick=()=>map.fitBounds(routeBounds);document.getElementById('baseLayer').hidden=true;document.getElementById('mapLoadStatus').textContent='陆家嘴模型 · 本地米制坐标';
new ResizeObserver(()=>{map.invalidateSize();map.fitBounds(routeBounds,{padding:[4,4]})}).observe(document.getElementById('geoMap'));
})();
