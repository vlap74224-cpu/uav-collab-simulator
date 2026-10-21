(function(root){
const C=typeof module!=='undefined'?require('./core.js'):root.UAV;
function create(a,b,speed=12,route=null){
 const path=Array.isArray(route)&&route.length>1?route:[a,b],total=C.length(path);let progress=.5,alertAfter=0,unit=null,straightStart=0,straightEnd=1;
 if(path.length>2){let walked=0,best=null;for(let i=1;i<path.length;i++){const dx=path[i][0]-path[i-1][0],dy=path[i][1]-path[i-1][1],length=Math.hypot(dx,dy);if(length>0&&(!best||length>best.length))best={dx,dy,length,start:walked};walked+=length}if(best){unit={x:best.dx/best.length,y:best.dy/best.length};straightStart=best.start/total;straightEnd=(best.start+best.length)/total;progress=(best.start+best.length*.82)/total;alertAfter=(best.start+Math.min(9,best.length*.05))/speed}}
 const mid=C.sample(path,progress),before=C.sample(path,Math.max(0,progress-.001)),after=C.sample(path,Math.min(1,progress+.001)),dx=after.x-before.x,dy=after.y-before.y,d=Math.max(.001,Math.hypot(dx,dy));let v={x:-dy/d*9,y:dx/d*9};
 if(unit){const angle=10*Math.PI/180;v={x:(-unit.x*Math.cos(angle)-unit.y*Math.sin(angle))*9,y:(-unit.y*Math.cos(angle)+unit.x*Math.sin(angle))*9}}
 const crossTime=total*progress/speed;return{x:mid.x-v.x*crossTime,y:mid.y-v.y*crossTime,vx:v.x,vy:v.y,altitude:60,time:0,crossTime,alertAfter,crossProgress:progress,straightStart,straightEnd,collisionPoint:{x:mid.x,y:mid.y}};
}
function position(t,offset=0){return{x:t.x+t.vx*(t.time+offset),y:t.y+t.vy*(t.time+offset),altitude:t.altitude};}
function remainingRoute(route,progress){const p=C.sample(route,progress),head=[p.x,p.y],tail=C.clone(route.slice(p.next));if(tail.length&&Math.hypot(tail[0][0]-head[0],tail[0][1]-head[1])<1e-6)tail.shift();return[head,...tail];}
function collisionCourse(route,speed,altitude,traffic){
 const start=position(traffic),targetSpeed=9;let elapsed=0;
 for(let i=1;i<route.length;i++){
  const a=route[i-1],b=route[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<1e-6)continue;
  const duration=length/speed,vx=(b[0]-a[0])/duration,vy=(b[1]-a[1])/duration,px=a[0]-vx*elapsed-start.x,py=a[1]-vy*elapsed-start.y,A=vx*vx+vy*vy-targetSpeed*targetSpeed,B=2*(px*vx+py*vy),D=px*px+py*py,disc=B*B-4*A*D;
  const roots=Math.abs(A)<1e-9?(Math.abs(B)>1e-9?[-D/B]:[]):disc>=0?[(-B-Math.sqrt(disc))/(2*A),(-B+Math.sqrt(disc))/(2*A)]:[];
  for(const t of roots.sort((x,y)=>x-y)){if(t<Math.max(.25,elapsed)-1e-7||t>elapsed+duration+1e-7)continue;const point={x:a[0]+vx*(t-elapsed),y:a[1]+vy*(t-elapsed)};return{x:start.x,y:start.y,vx:(point.x-start.x)/t,vy:(point.y-start.y)/t,altitude,time:0,crossTime:t,collisionPoint:point}}
  elapsed+=duration;
 }
 // A target already moving away may have no reachable intersection. A new
 // controlled trial starts with a target timed to the remaining route.
 const reset=create(route[0],route.at(-1),speed,route);reset.altitude=altitude;reset.collisionPoint=C.sample(route,.5);reset.restarted=true;return reset;
}
function predict(route,progress,speed,altitude,t,horizon=30){const len=C.length(route),start=len*progress,remaining=(len-start)/speed;let distance=Infinity,seconds=0;for(let sec=0;sec<=Math.min(horizon,remaining)+.001;sec+=.1){const a=C.sample(route,Math.min(1,(start+speed*sec)/len)),b=position(t,sec),d=Math.hypot(a.x-b.x,a.y-b.y,altitude-t.altitude);if(d<distance){distance=d;seconds=sec}}return{distance,seconds,conflict:distance<40};}
const api={create,position,predict,remainingRoute,collisionCourse};if(typeof module!=='undefined')module.exports=api;else root.Traffic=api;
})(typeof window!=='undefined'?window:globalThis);
