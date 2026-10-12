'use strict';
// Coordinates are an approximate local metre grid for research scenarios only.
window.MAP_REFERENCE={source:'swisstopo SWISSIMAGE / OpenStreetMap',center:[47.3971,8.5455],south:47.394135,north:47.400065,west:8.53953,east:8.55147,localGrid:[900,660],coordinateSystem:'WGS84 display / approximate local metre grid',note:'路线与限制区为虚构研究情境，不代表合法飞行区域'};
(function(){
const status=document.getElementById('mapLoadStatus');
if(!window.L){status.textContent='地图库未能加载，请刷新重试';return}
const ref=window.MAP_REFERENCE,bounds=L.latLngBounds([[ref.south,ref.west],[ref.north,ref.east]]);
const map=window.missionMap=L.map('geoMap',{zoomControl:false,attributionControl:true,minZoom:14,maxZoom:19,maxBounds:[[47.36,8.48],[47.44,8.61]],maxBoundsViscosity:.8});
const imagery=L.tileLayer('https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg',{maxZoom:19,attribution:'航空影像 © <a href="https://www.swisstopo.admin.ch/en/orthoimage-swissimage-10" target="_blank" rel="noopener">swisstopo</a>',bounds:[[45.8,5.9],[47.9,10.6]]});
const streets=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'});
for(const layer of [imagery,streets]){layer.on('tileerror',()=>{status.textContent='部分底图未加载，可切换底图或检查网络'});layer.on('load',()=>{if(!status.textContent.includes('部分'))status.textContent=''})}
imagery.addTo(map);map.fitBounds(bounds,{padding:[12,12]});
const svg=document.getElementById('map');L.svgOverlay(svg,bounds,{interactive:true}).addTo(map);
L.control.zoom({position:'topright',zoomInTitle:'放大',zoomOutTitle:'缩小'}).addTo(map);
L.control.scale({imperial:false,position:'bottomleft',maxWidth:85}).addTo(map);
const notify=(type,text)=>window.dispatchEvent(new CustomEvent('uav-map-action',{detail:{type,text}}));
document.getElementById('fitMap').onclick=()=>{map.fitBounds(bounds,{padding:[12,12]});notify('map_recenter','定位 Irchelpark 任务区域')};
document.getElementById('baseLayer').onchange=e=>{status.textContent='';map.removeLayer(e.target.value==='street'?imagery:streets);(e.target.value==='street'?streets:imagery).addTo(map);notify('map_layer',e.target.value==='street'?'街道底图':'swisstopo 航空影像')};
map.on('dragend',()=>{const p=map.getCenter();notify('map_pan',`地图中心 ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`)});
map.on('zoomend',()=>notify('map_zoom','地图缩放 '+map.getZoom()));
new ResizeObserver(()=>map.invalidateSize()).observe(document.getElementById('geoMap'));
})();
