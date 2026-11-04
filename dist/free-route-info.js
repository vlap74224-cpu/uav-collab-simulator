(function(root){
'use strict';
const C=typeof module!=='undefined'?require('./core'):root.UAV,N=typeof module!=='undefined'?require('./free-navigation'):root.FreeNavigation,R=typeof module!=='undefined'?require('./route-evidence'):root.RouteEvidence;
const name=x=>x?.shortName||x?.name||'地图选点',finite=Number.isFinite;
function capture(state,mission,position){
 if(mission?.id==='FREE'&&state.route?.length>1&&state.status!=='manual'){
  const sample=C.sample(state.route,state.progress),route=[[position.x,position.y],...state.route.slice(sample.next)],stops=(mission.viaStops||[]).filter(x=>!(state.freeVisitedViaIds||[]).includes(x.id));
  return {route,stops,origin:[position.x,position.y],distance:C.length(route),legs:N.itineraryLegs(route,stops,name(mission.destination)),version:state.planVersion||0};
 }
 return state.freePlanSnapshot||null;
}
function begin({state,mission,position,target,points,intent={},now=Date.now()}){
 const previous=capture(state,mission,position);
 return {version:(state.planVersion||0)+1,kind:intent.kind||'replan',addedIds:intent.kind==='add'?(intent.ids||[]):[],changedIds:intent.ids||[],destination:C.clone(target),requested:C.clone(points),previous,phase:'planning',startedAt:now,highlightUntil:0};
}
function commit(state,mission){
 const u=state.freeRouteUpdate;if(!u)return;const legs=N.itineraryLegs(state.route,mission.viaStops||[],name(mission.destination)),old=new Set((u.previous?.legs||[]).map(x=>x.key));
 u.legs=legs;u.changedLegs=legs.filter(x=>!old.has(x.key));u.phase='checking';u.version=state.planVersion||u.version;
 const origin=state.route[0],previous=u.previous;u.previousDistance=previous&&Math.hypot(previous.origin[0]-origin[0],previous.origin[1]-origin[1])<=.8?previous.distance:null;
 state.freePlanSnapshot={route:C.clone(state.route),stops:C.clone(mission.viaStops||[]),origin:origin.slice(),distance:C.length(state.route),legs:C.clone(legs),version:u.version};
}
function pack(a,b,c){return [['action','L1 当前目标与行动',a],['reason','L2 决策依据与约束',b],['projection','L3 预期结果与局限',c]];}
function describe({state:s,mission:m,draft:d,position:p,inspector,ready,threshold=21.8,errors=[],now=Date.now()}){
 const u=s.freeRouteUpdate,requests=(s.freeViaPoints||[]).filter(x=>!(s.freeVisitedViaIds||[]).includes(x.id)),destination=m?.destination||u?.destination||s.freeMapDestination,final=destination?name(destination):'未选择终点',count=requests.length,stops=m?.viaStops||requests.map((x,i)=>({...x,name:x.shortName||x.name||'途经点'+(i+1)})),pending=stops.filter(x=>!(s.freeVisitedViaIds||[]).includes(x.id));
 const flow={kind:'free-route-flow',items:[{id:'origin',label:'当前位置'},...pending.map((x,i)=>({id:x.id,label:x.name||'途经点'+(i+1),tag:u?.addedIds?.includes(x.id)?'新增':u?.changedIds?.includes(x.id)?'已更新':'',highlight:false})),{id:'destination',label:final}]};
 if(!destination){s.freePanelCheck={ready:false,phase:'idle'};return pack([['目标','尚未选择最终目的地'],['路线',flow],['状态','手动自由飞行']],[['顺序','按添加顺序经过途经点'],['操作','地图点选或从列表选择地标'],['检查','设置终点后检查整条路线']],[['长度','尚无完整路线'],['抵达','未选择飞行目标，暂不预测'],['局限','途经点仅经过，不停留']]);}
 const planning=s.freePlanning||u?.phase==='planning'||s.freeViaDragging||s.freeDestinationDragging,failed=u?.phase==='failed';
 const target=final+' · 需经'+count+'点'+(u?'〔已更新〕':''),sequence='按你设定的顺序：'+(count?requests.map((_,i)=>i+1).join('→')+'→':'')+'终点';
 if(planning||!m||failed){s.freePanelCheck={ready:false,phase:failed?'failed':planning?'planning':'idle'};return pack([['目标',target],['路线',flow],['状态',failed?'重算失败，尚未执行':planning?'正在重新计算，尚未执行':'请选择目标后点击AI规划']],[['依据',sequence],['新段','根据当前选点重新连接航段'],['检查',failed?u.error||'未找到可执行路线':planning?'正在重新计算建筑和禁区检查':'规划后检查各连接航段']],[['长度',planning?'正在重新计算':'暂不可预测'],['抵达',failed?'路线未生成，暂不可预测':planning?'到'+final+'的时间与电量正在重算':'未生成有效路线，暂不可预测'],['局限','途经仅经过；未计转弯减速和风']]);}
 const route=d?.route||s.route,speed=d?.speed??s.speed,altitude=d?.altitude??s.altitude,legs=N.itineraryLegs(route,pending,final),changed=d?legs.filter(x=>!(u?.previous?.legs||[]).some(y=>y.key===x.key)):u?.changedLegs?.length?u.changedLegs:legs;
 const checks=changed.map(leg=>R.plan(leg.route,altitude,speed,s.battery,m.hazard,inspector,threshold)),busy=!ready||checks.some(x=>x.geometry.status==='pending'),missing=checks.some(x=>x.geometry.status==='unavailable'),collision=checks.find(x=>x.geometry.collision),zone=checks.some(x=>x.zone.intersects),minimum=checks.length&&checks.every(x=>finite(x.geometry.min))?Math.min(...checks.map(x=>x.geometry.min)):null,tooClose=finite(minimum)&&minimum<threshold,blocked=!!collision||zone||tooClose||errors.length>0,available=!busy&&!missing&&!blocked;
 s.freePanelCheck={ready:available,phase:busy?'checking':missing?'unavailable':blocked?'blocked':'ready',version:u?.version||s.planVersion||0,minimum,threshold,checkedLegCount:changed.length};
 if(available&&u&&!d&&!u.presentedAt){u.phase='ready';u.presentedAt=now;u.highlightUntil=now+5000;}
 const highlight=!!u&&now<u.highlightUntil;flow.items.forEach(x=>x.highlight=highlight&&!!x.tag);
 const state=s.status==='complete'?'已到达'+final+'，本机悬停':s.status==='running'?'已确认，正在执行更新路线':s.status==='manual'?'手动接管；自动路线尚未恢复':s.status==='rejected'?'已拒绝新路线，尚未执行':d?'正在修改，新路线尚未执行':busy?'正在重新计算，新路线尚未执行':blocked||missing?'检查未完成或未通过，尚未执行':'新路线待确认，尚未执行';
 const affected=changed.length<=3?changed.map(x=>x.from+'→'+x.to).join('；'):'已更新'+changed.length+'段（见地图）';
 let check=busy?'上述'+changed.length+'段正在检查':missing?'上述航段缺少建筑净距数据':collision?'与'+collision.geometry.collision+'相交':zone?'与已知禁飞区相交':tooClose?'最小建筑净距'+minimum.toFixed(1)+'m＜'+threshold.toFixed(1)+'m':errors.length?errors[0]:'未交禁区/实体；净距'+minimum.toFixed(1)+'m≥'+threshold.toFixed(1)+'m';
 const total=C.length(route),sameOrigin=u?.previous&&Math.hypot(u.previous.origin[0]-route[0][0],u.previous.origin[1]-route[0][1])<=.8,previous=sameOrigin?u.previousDistance:null,delta=finite(previous)?total-previous:null;
 const length=total.toFixed(0)+'m'+(finite(delta)?Math.abs(delta)<.05?'，与上一版相同':'，较上一版'+(delta>0?'增加':'减少')+Math.abs(delta).toFixed(0)+'m':u?.previous?'；起点已变，不比较长度':'；暂无上一版可比较');
 const sample=C.sample(route,d?0:s.progress),remaining=d?route:[[p.x,p.y],...route.slice(sample.next)],meters=C.length(remaining),seconds=finite(speed)&&speed>0?meters/speed:null,vertical=Math.abs((s.targetAltitude??s.altitude)-s.altitude)>.01||Math.abs(s.verticalSpeed||0)>.01,end=finite(seconds)&&finite(s.battery)&&!vertical?Math.max(0,s.battery-meters*.0016-seconds*.001):null;
 const time=n=>{const seconds=Math.ceil(n);return seconds>=60?Math.floor(seconds/60)+'分'+seconds%60+'秒':seconds+'秒';};
 const arrival=s.status==='complete'?'已到'+final+' · 实际余电'+s.battery.toFixed(1)+'%':s.status==='manual'?'手动飞行，需重新规划后预测':!finite(seconds)||!finite(end)?vertical?'升降耗电未计入，余电暂不可预测':'缺少有效计划速度或电量':time(seconds)+'至'+final+' · 余电'+end.toFixed(1)+'%';
 return pack([['目标',target],['路线',flow],['状态',state]],[['依据',sequence],['新段',affected||'无新增连接段'],['检查',check]],[['长度',busy?'正在重新计算':length],['抵达',busy?'至'+final+'的预测正在重新计算':blocked||missing?'路线未通过完整检查，暂不可预测':arrival],['局限',speed+'m/s无风；途经仅经过；未计转弯减速']]);
}
const api={capture,begin,commit,describe};if(typeof module!=='undefined')module.exports=api;else root.FreeRouteInfo=api;
})(typeof window!=='undefined'?window:globalThis);
