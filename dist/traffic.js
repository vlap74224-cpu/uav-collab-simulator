(function(root){
const C=typeof module!=='undefined'?require('./core.js'):root.UAV;
function create(a,b,speed=12){const dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy),v={x:-dy/d*9,y:dx/d*9},crossTime=d/(2*speed);return{x:(a[0]+b[0])/2-v.x*crossTime,y:(a[1]+b[1])/2-v.y*crossTime,vx:v.x,vy:v.y,altitude:60,time:0,crossTime};}
function position(t,offset=0){return{x:t.x+t.vx*(t.time+offset),y:t.y+t.vy*(t.time+offset),altitude:t.altitude};}
function predict(route,progress,speed,altitude,t,horizon=30){const len=C.length(route),start=len*progress,remaining=(len-start)/speed;let distance=Infinity,seconds=0;for(let sec=0;sec<=Math.min(horizon,remaining)+.001;sec+=.1){const a=C.sample(route,Math.min(1,(start+speed*sec)/len)),b=position(t,sec),d=Math.hypot(a.x-b.x,a.y-b.y,altitude-t.altitude);if(d<distance){distance=d;seconds=sec}}return{distance,seconds,conflict:distance<40};}
const api={create,position,predict};if(typeof module!=='undefined')module.exports=api;else root.Traffic=api;
})(typeof window!=='undefined'?window:globalThis);
