(function(root){
const C=typeof module!=='undefined'?require('./core.js'):root.UAV;
function travelled(route,progress){if(progress<=0)return[route[0].slice()];if(progress>=1)return C.clone(route);const p=C.sample(route,progress);return [...C.clone(route.slice(0,p.next)),[p.x,p.y]]}
function vertical(altitude,target,dt){const bounded=Math.max(30,Math.min(120,target)),step=Math.sign(bounded-altitude)*Math.min(Math.abs(bounded-altitude),3*Math.max(0,dt));return{altitude:altitude+step,verticalSpeed:dt>0?step/dt:0,target:bounded}}
function move(position,axes,dt){const heading=(position.heading+(axes.turn||0)*45*dt+360)%360,r=heading*Math.PI/180,forward=axes.forward||0,right=axes.right||0,norm=Math.max(1,Math.hypot(forward,right)),speed=5/norm;const x=Math.max(35,Math.min(865,position.x+(Math.sin(r)*forward+Math.cos(r)*right)*speed*dt)),y=Math.max(35,Math.min(625,position.y+(-Math.cos(r)*forward+Math.sin(r)*right)*speed*dt));return{x,y,heading,distance:Math.hypot(x-position.x,y-position.y)}}
const api={travelled,vertical,move};if(typeof module!=='undefined')module.exports=api;else root.FlightControls=api;
})(typeof window!=='undefined'?window:globalThis);
