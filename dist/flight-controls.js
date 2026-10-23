(function(root){
const C=typeof module!=='undefined'?require('./core.js'):root.UAV;
function travelled(route,progress){if(progress<=0)return[route[0].slice()];if(progress>=1)return C.clone(route);const p=C.sample(route,progress);return [...C.clone(route.slice(0,p.next)),[p.x,p.y]]}
function vertical(altitude,target,dt){const bounded=Math.max(0,Math.min(150,target)),step=Math.sign(bounded-altitude)*Math.min(Math.abs(bounded-altitude),3*Math.max(0,dt));return{altitude:altitude+step,verticalSpeed:dt>0?step/dt:0,target:bounded}}
function landing(altitude,target,dt){const remaining=Math.max(0,altitude-target),rate=Math.min(2,Math.max(.35,remaining*.35)),step=Math.min(remaining,rate*Math.max(0,dt));return{altitude:altitude-step,verticalSpeed:dt>0?-step/dt:0,done:remaining-step<.001}}
function move(position,axes,dt){const heading=(position.heading+(axes.turn||0)*45*dt+360)%360,r=heading*Math.PI/180,forward=axes.forward||0,right=axes.right||0,norm=Math.max(1,Math.hypot(forward,right)),speed=5/norm,a=C.workArea;const x=Math.max(a.minX,Math.min(a.maxX,position.x+(Math.sin(r)*forward+Math.cos(r)*right)*speed*dt)),y=Math.max(a.minY,Math.min(a.maxY,position.y+(-Math.cos(r)*forward+Math.sin(r)*right)*speed*dt));return{x,y,heading,distance:Math.hypot(x-position.x,y-position.y)}}
function smoothHeading(current,target,dt,maxRate=95,response=5){
 const delta=Math.atan2(Math.sin(target-current),Math.cos(target-current));
 if(!Number.isFinite(current)||!Number.isFinite(target)||!Number.isFinite(dt)||dt<=0)return Number.isFinite(current)?current:target;
 const eased=Math.abs(delta)*(1-Math.exp(-response*dt)),limit=Math.max(0,maxRate)*Math.PI/180*dt,step=Math.min(Math.abs(delta),eased,limit);
 return current+Math.sign(delta)*step;
}
const api={travelled,vertical,landing,move,smoothHeading};if(typeof module!=='undefined')module.exports=api;else root.FlightControls=api;
})(typeof window!=='undefined'?window:globalThis);
