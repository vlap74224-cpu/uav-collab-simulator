(function(root){
const C=typeof module!=='undefined'?require('./core.js'):root.UAV;
function create(a,b,speed=12,route=null){const path=Array.isArray(route)&&route.length>1?route:[a,b],mid=C.sample(path,.5),before=C.sample(path,.49),after=C.sample(path,.51),dx=after.x-before.x,dy=after.y-before.y,d=Math.max(1,Math.hypot(dx,dy)),v={x:-dy/d*9,y:dx/d*9},crossTime=C.length(path)/(2*speed);return{x:mid.x-v.x*crossTime,y:mid.y-v.y*crossTime,vx:v.x,vy:v.y,altitude:60,time:0,crossTime};}
function position(t,offset=0){return{x:t.x+t.vx*(t.time+offset),y:t.y+t.vy*(t.time+offset),altitude:t.altitude};}
function predict(route,progress,speed,altitude,t,horizon=30){const len=C.length(route),start=len*progress,remaining=(len-start)/speed;let distance=Infinity,seconds=0;for(let sec=0;sec<=Math.min(horizon,remaining)+.001;sec+=.1){const a=C.sample(route,Math.min(1,(start+speed*sec)/len)),b=position(t,sec),d=Math.hypot(a.x-b.x,a.y-b.y,altitude-t.altitude);if(d<distance){distance=d;seconds=sec}}return{distance,seconds,conflict:distance<40};}
const api={create,position,predict};if(typeof module!=='undefined')module.exports=api;else root.Traffic=api;
})(typeof window!=='undefined'?window:globalThis);
