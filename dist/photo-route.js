(function(root){
'use strict';
const C=typeof module!=='undefined'?require('./core.js'):root.UAV;
const pending=(tasks,done=[]) => (tasks||[]).filter(task=>!done.includes(task.id));
function visits(route,tasks,done=[]){
 const required=pending(tasks,done),found=[],missing=[];
 if(!Array.isArray(route)||route.length<2||route.some(p=>!Array.isArray(p)||p.length!==2||p.some(x=>!Number.isFinite(x))))return{visits:[],missing:required};
 const total=C.length(route);let cursor=-1e-6;
 for(const task of required){let walked=0,match=null;
  for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),t=length?Math.max(0,Math.min(1,((task.point[0]-a[0])*dx+(task.point[1]-a[1])*dy)/(length*length))):0,distance=walked+t*length;
   if(distance>=cursor&&Math.hypot(a[0]+dx*t-task.point[0],a[1]+dy*t-task.point[1])<=.5){match={id:task.id,point:task.point.slice(),distance,progress:total?distance/total:0,segmentIndex:i-1,t};break}walked+=length;
  }
  if(match){found.push(match);cursor=match.distance+1e-6}else missing.push(task);
 }
 return{visits:found,missing};
}
function validate(route,tasks,done=[]){const result=visits(route,tasks,done);return result.missing.length?['航线必须按顺序经过必经拍照点：'+result.missing.map(task=>task.shortName||task.name).join('、')]:[]}
function taskAt(point,tasks,done=[]){return point&&pending(tasks,done).find(task=>Math.hypot(task.point[0]-point[0],task.point[1]-point[1])<=.5)}
function skeleton(route,tasks,done=[]){if(!route?.length)return[];const points=[route[0],...pending(tasks,done).map(task=>task.point),route.at(-1)];return points.filter((p,i)=>!i||Math.hypot(p[0]-points[i-1][0],p[1]-points[i-1][1])>1e-6).map(p=>p.slice())}
function embed(route,tasks,done=[]){const result=visits(route,tasks,done);if(result.missing.length)return C.clone(route);const output=[route[0].slice()];for(let i=1;i<route.length;i++){for(const visit of result.visits.filter(v=>v.segmentIndex===i-1).sort((a,b)=>a.t-b.t)){if(Math.hypot(output.at(-1)[0]-visit.point[0],output.at(-1)[1]-visit.point[1])>1e-6)output.push(visit.point.slice())}if(Math.hypot(output.at(-1)[0]-route[i][0],output.at(-1)[1]-route[i][1])>1e-6)output.push(route[i].slice())}return output}
function simplify(route,tasks,done=[],maxPoints=14,tolerance=12){
 const embedded=embed(route,tasks,done),anchors=[0];for(let i=1;i<embedded.length-1;i++)if(taskAt(embedded[i],tasks,done))anchors.push(i);anchors.push(embedded.length-1);
 let result=embedded,epsilon=tolerance;for(let attempt=0;attempt<24;attempt++){result=[];for(let i=1;i<anchors.length;i++){const part=C.simplifyRoute(embedded.slice(anchors[i-1],anchors[i]+1),maxPoints,epsilon);result.push(...(result.length?part.slice(1):part))}if(result.length<=Math.max(maxPoints,anchors.length))break;epsilon=Math.max(1,epsilon*1.4)}return result;
}
const api={pending,visits,validate,taskAt,skeleton,embed,simplify};if(typeof module!=='undefined')module.exports=api;else root.PhotoRoute=api;
})(typeof window!=='undefined'?window:globalThis);
