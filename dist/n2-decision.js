(function(root){
'use strict';
const C=typeof module!=='undefined'?require('./core.js'):root.UAV;
const defaults={decisionSeconds:15,planningSeconds:8,maneuverSeconds:6,marginMeters:35,deceleration:5,acceleration:4,buildingClearance:21.8};
function config(values={}){return {...defaults,...values,decisionSeconds:Math.max(5,Math.min(60,Number(values.decisionSeconds)||15))};}
function cut(route,from,to=C.length(route)){
 const total=C.length(route),a=Math.max(0,Math.min(total,from)),b=Math.max(a,Math.min(total,to)),start=C.sample(route,total?a/total:0),end=C.sample(route,total?b/total:0),result=[[start.x,start.y]];let distance=0;
 for(let i=1;i<route.length;i++){distance+=Math.hypot(route[i][0]-route[i-1][0],route[i][1]-route[i-1][1]);if(distance>a+.001&&distance<b-.001)result.push(route[i].slice());}
 if(Math.hypot(end.x-result.at(-1)[0],end.y-result.at(-1)[1])>.001)result.push([end.x,end.y]);if(result.length===1)result.push(result[0].slice());return result;
}
// Exact first intersection of a polyline with the protected circle, measured along the route.
function entryDistance(route,zone){let passed=0;const R=zone.r+(zone.margin||0);for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),x=a[0]-zone.x,y=a[1]-zone.y;if(Math.hypot(x,y)<=R)return passed;if(length){const B=2*(x*dx+y*dy),D=B*B-4*length*length*(x*x+y*y-R*R);if(D>=0){const t=(-B-Math.sqrt(D))/(2*length*length);if(t>=0&&t<=1)return passed+t*length;}}passed+=length;}return null;}
function attach(plan,progress,branch=plan.branch){const distance=progress*C.length(plan.original),prefix=cut(plan.original,distance,plan.anchorDistance);return prefix.slice(0,-1).concat(branch.map(p=>p.slice()));}
function rebase(route,point){if(!route?.length)return null;const near=C.nearestPointOnRoute(route,point);if(!near)return null;return [point.slice(),...route.slice(near.segmentIndex+1).map(p=>p.slice())].filter((p,i,a)=>!i||Math.hypot(p[0]-a[i-1][0],p[1]-a[i-1][1])>.001);}
function side(route,zone){const p=C.nearestPointOnRoute(route,[zone.x,zone.y])?.point;if(!p)return '';const dx=p[0]-zone.x,dy=p[1]-zone.y;return (Math.abs(dx)>.35*Math.abs(dy)?dx>0?'东':'西':'')+(Math.abs(dy)>.35*Math.abs(dx)?dy>0?'南':'北':'')+'侧';}
function forecast(route,battery,speed,initialSpeed=speed,acceleration=4){if(!route||route.length<2)return {reason:'缺少可接入的路线'};if(!(speed>0)&&speed!==0)return {reason:'缺少计划速度'};if(!(speed>0))return {reason:'计划速度须大于零'};const distance=C.length(route),u=Math.max(0,initialSpeed),a=Math.max(.1,acceleration),ramp=Math.abs(speed-u)/a,rampDistance=(u+speed)*ramp/2;let seconds;
 if(distance>=rampDistance)seconds=ramp+(distance-rampDistance)/speed;else if(speed>=u)seconds=(Math.sqrt(u*u+2*a*distance)-u)/a;else seconds=(u-Math.sqrt(Math.max(0,u*u-2*a*distance)))/a;
 return {distance,seconds,endBattery:Number.isFinite(battery)?battery-distance*.0016-seconds*.001:null,speed,initialSpeed:u};
}
function windowFor({distance,speed,rate,seconds,options}){const o=config(options),v=Math.max(0,speed),r=Math.max(1,rate),usable=Math.max(0,distance-o.marginMeters),wall=Math.max(0,seconds);return {required:v*r*wall+v*v/(2*o.deceleration)+v*o.maneuverSeconds+o.marginMeters,available:distance,targetSpeed:Math.max(0,Math.min(v,usable/(r*wall+o.maneuverSeconds+v/(2*o.deceleration)))),rate:r,seconds:wall};}
function motion({speed,previousSpeed,dt,available,targetSpeed,options}){const o=config(options),u=Math.max(0,previousSpeed??speed),target=Math.max(0,Math.min(speed,targetSpeed??speed)),v=u<target?Math.min(target,u+o.acceleration*dt):Math.max(target,u-o.deceleration*dt);let distance=(u+v)*dt/2;
 const remaining=Number.isFinite(available)?Math.max(0,available):Infinity,clamped=distance>remaining;distance=Math.min(distance,remaining);return {speed:clamped?0:v,distance,clamped};}
function affected(route,zone){const out=[];for(let i=1;i<route.length;i++)if(C.distanceToSegment([zone.x,zone.y],route[i-1],route[i])<zone.r+zone.margin)out.push(i);return out;}
function along(route,near){return C.length(route.slice(0,near.segmentIndex+1))+Math.hypot(near.point[0]-route[near.segmentIndex][0],near.point[1]-route[near.segmentIndex][1]);}
function milestones(route,zone,original,margin=35){
 const total=C.length(route),near=C.nearestPointOnRoute(route,[zone.x,zone.y]),radius=near.distance+margin;let passed=0,lastExit=null;
 for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),x=a[0]-zone.x,y=a[1]-zone.y,A=length*length,B=2*(x*dx+y*dy),D=B*B-4*A*(x*x+y*y-radius*radius);if(A&&D>=0){const t=(-B+Math.sqrt(D))/(2*A);if(t>=0&&t<=1)lastExit=passed+t*length;}passed+=length;}
 let firstIndex=route.findIndex((p,i)=>i>0&&(C.nearestPointOnRoute(original,p)?.distance??Infinity)>2);if(firstIndex<1)firstIndex=1;
 const exitDistance=Math.hypot(route.at(-1)[0]-zone.x,route.at(-1)[1]-zone.y)<=radius?total:lastExit??total;
 return {firstIndex,firstPoint:route[firstIndex].slice(),firstDistance:C.length(route.slice(0,firstIndex+1)),exitDistance:Math.max(along(route,near),exitDistance),influenceRadius:radius};
}
function forwardBoundary(position,speed,zone){if(!(speed>0))return {seconds:null,reason:'当前地速为零，保持悬停不会接近边界'};const h=position.heading*Math.PI/180,dx=Math.sin(h),dy=-Math.cos(h),x=position.x-zone.x,y=position.y-zone.y,R=zone.r+zone.margin,B=2*(x*dx+y*dy),D=B*B-4*(x*x+y*y-R*R);if(D<0)return {seconds:null,reason:'当前航向未指向禁区'};const distance=(-B-Math.sqrt(D))/2;return distance>=0?{distance,seconds:distance/speed}:{seconds:null,reason:'当前航向未指向禁区'};}
function statusApi(){return typeof module!=='undefined'?require('./n2-status'):root.N2Status;}
function describe(context){return statusApi().describe(context);}
function observeProgress(...args){return statusApi().observeProgress(...args);}
function recordBypass(...args){return statusApi().recordBypass(...args);}
function history(...args){return statusApi().history(...args);}
function waypoint(...args){return statusApi().waypoint(...args);}
const api={defaults,config,cut,entryDistance,attach,rebase,side,forecast,windowFor,motion,affected,along,milestones,forwardBoundary,describe,observeProgress,recordBypass,history,waypoint};if(typeof module!=='undefined')module.exports=api;else root.N2Decision=api;
})(typeof window!=='undefined'?window:globalThis);
