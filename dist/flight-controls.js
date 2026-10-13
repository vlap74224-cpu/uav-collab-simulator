(function(root){
const C=typeof module!=='undefined'?require('./core.js'):root.UAV;
function travelled(route,progress){if(progress<=0)return[route[0].slice()];if(progress>=1)return C.clone(route);const p=C.sample(route,progress);return [...C.clone(route.slice(0,p.next)),[p.x,p.y]]}
function vertical(altitude,target,dt){const bounded=Math.max(30,Math.min(120,target)),step=Math.sign(bounded-altitude)*Math.min(Math.abs(bounded-altitude),3*Math.max(0,dt));return{altitude:altitude+step,verticalSpeed:dt>0?step/dt:0,target:bounded}}
const api={travelled,vertical};if(typeof module!=='undefined')module.exports=api;else root.FlightControls=api;
})(typeof window!=='undefined'?window:globalThis);
