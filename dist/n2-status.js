(function(root){
'use strict';
const C=typeof module!=='undefined'?require('./core'):root.UAV,N=typeof module!=='undefined'?require('./n2-decision'):root.N2Decision;
const finite=Number.isFinite,copy=x=>C.clone(x);
function ledger(state){const l=state.n2ProgressLedger||(state.n2ProgressLedger={schema:'n2-actual-segments-v1',routes:[],completed:[],bypasses:[]});return l;}
// Called only after the movement's collision check; snapshots only prime a baseline.
function observeProgress(state,{prime=false,wallTimeMs=Date.now()}={}){
 const l=ledger(state),route=state.route;if(!route?.length||route.length<2)return [];
 const key=JSON.stringify(route),distance=Math.max(0,Math.min(1,state.progress||0))*C.length(route);
 if(!l.active||l.active.key!==key||distance<l.active.observedDistance-.01){
  const item={id:l.routes.length+1,key,route:copy(route),version:state.planVersion||0,plan:state.activePlan||'航迹A',fromDistance:distance,observedDistance:distance,startedAt:state.simTime,wallTimeMs};
  l.routes.push(item);l.active=item;return [];
 }
 if(prime||!['running','editing','holding'].includes(state.status))return [];
 const active=l.active,added=[];let start=0;
 for(let i=1;i<route.length;i++){
  const length=Math.hypot(route[i][0]-route[i-1][0],route[i][1]-route[i-1][1]),end=start+length,id=active.id+':'+i;
  if(length>.1&&start>=active.fromDistance-.001&&end>active.observedDistance+.001&&end<=distance+.001&&!l.completed.some(x=>x.id===id)){
   const row={id,routeId:active.id,segment:i,from:route[i-1].slice(),to:route[i].slice(),distance:length,plan:active.plan,version:active.version,completedAt:state.simTime,wallTimeMs};l.completed.push(row);added.push(row);
  }
  start=end;
 }
 active.observedDistance=distance;return added;
}
function recordBypass(state,{wallTimeMs=Date.now()}={}){
 const e=state.noFlyExecution;if(!state.noFlyBypassComplete||!finite(e?.completedAt)||!finite(e?.startedAt))return null;
 const l=ledger(state),id=JSON.stringify([state.flightEvent?.id,e.startedAt,e.source]);if(l.bypasses.some(x=>x.id===id))return null;
 const row={id,eventId:state.flightEvent?.id,version:state.planVersion||0,source:e.source,startedAt:e.startedAt,completedAt:e.completedAt,actualSeconds:e.actualSeconds,expectedSeconds:e.expectedExitSeconds,errorSeconds:e.errorSeconds,wallTimeMs};l.bypasses.push(row);return row;
}
function history(state){const l=state.n2ProgressLedger;return {segments:l?.completed?.length||0,bypasses:l?.bypasses?.length||0,currentBypassComplete:!!state.noFlyBypassComplete&&finite(state.noFlyExecution?.completedAt)};}
function waypoint(state,mission,position){
 const sample=C.sample(state.route,state.progress),point=state.route[sample.next];if(!point)return null;
 const target=mission.destination.name.split('·')[0].trim(),branch=mission.n2Plan?.branch||[],index=branch.findIndex(q=>Math.hypot(q[0]-point[0],q[1]-point[1])<.1);
 return {point:point.slice(),name:sample.next===state.route.length-1?target:index>0?(mission.n2Plan.side+'绕行点'+index):'航路点'+sample.next,distance:Math.hypot(point[0]-position.x,point[1]-position.y)};
}
function describe({state:s,mission:m,position:p,live,ready,draft:d}){
 const pack=(a,b,c)=>[['action','L1 当前目标与行动',a],['reason','L2 决策依据与约束',b],['projection','L3 预期结果与局限',c]],L=live||s.noFlySnapshot||{},f=n=>finite(n)?n.toFixed(1):'暂无数据',t=n=>finite(n)?Math.ceil(Math.max(0,n))+'秒':'暂不可预测';
 const target=m.destination.name.split('·')[0].trim(),plan=m.n2Plan,w=s.noFlyDecision,event=!!s.noFlyVisible,executing=s.flightEvent?.phase==='executing',h=L.history||history(s),record=h.currentBypassComplete?'本次绕行已完成':h.segments?'此前已顺利完成'+h.segments+'段飞行':'暂无已完成航段记录',threshold=N.config(m.n2Options).buildingClearance;
 const v=d?.speed??s.speed,speed=L.speed??s.n2Speed??0,paused=s.status==='paused',motion=paused?'整个任务已暂停':s.noFlyHold?(speed>.01?'本机正减速':'本机悬停，任务继续'):s.noFlySpeedLimited?'减速沿安全A前进':'仍沿安全A前进';
 const deviation=finite(L.deviation)?'偏差'+f(L.deviation)+'m':'偏差待定位',tracking=finite(L.deviation)&&L.deviation>(m.trackingTolerance??5)?'偏离确认路线':paused?'全局暂停':s.noFlyHold&&speed<=.01?'本机悬停':'正常跟随'+(executing?s.activePlan||'B':'A');
 const condition=(paused?'恢复后按':'按')+v+'m/s含加减速；未计风况，时间/余电可能偏离',remaining=finite(L.remainingDistance)?Math.round(L.remainingDistance)+'m':'距离待更新',next=L.nextWaypoint;
 const draftValid=!!d&&L.draftCheck?.valid===true,result=d&&!draftValid?null:L.suggested,original=L.original;
 const arrival=x=>!finite(x?.seconds)?'到'+target+'预测待更新（'+(x?.reason||L.predictionReason||'缺少有效路线')+'）':t(x.seconds)+'至'+target+' · '+(finite(x.endBattery)?'余电'+f(x.endBattery)+'%':'抵达电量暂无数据');
 const progress=next?next.name+'余'+Math.round(next.distance)+'m':'下一航路点待定位';
 const segments=event&&m.hazard?N.affected(plan?.original||m.interruptedRoute||s.route,m.hazard):[],affected=segments.length?'A第'+segments.join('/')+'段穿过新增禁区':'当前A未检出禁区相交，需复核绕行',invalidOriginal=segments.length>0;
 const interval=check=>finite(check?.min)?'最小'+f(check.min)+'m / 要求≥'+f(threshold)+'m':'建筑净距尚未核验';
 if(s.status==='complete')return pack([['状态','已到达'+target+'，本段飞行结束'],['路线',(s.activePlan||'A')+'已执行完成'],['进展',remaining+'；'+deviation]],[['结果',s.noFlyBypassComplete?'实际完成绕行并到达目标':'按已确认路线到达目标'],['检查','保留实际执行路线和约束检查记录'],['后续','按既定任务配置结束或进入下一节点']],[['到达','任务时刻'+t(s.simTime)+'；实际电量'+f(s.battery)+'%'],['记录',record],['范围','本段已结束，不再显示未来到达预测']]);
 if(!event){
  const check=L.fullCheck,done=check?.status==='done'&&finite(check.min),clear=done&&!check.collision&&check.min>=threshold&&check.zoneIntersects===false;
  return pack([['目标',(s.status==='running'?'沿A前往':paused?'已暂停，仍前往':'待确认航线至')+m.destination.name],['路线','当前位置→'+(next?.name||'既定航路点')+'→'+target],['进展','剩余'+remaining+'；'+deviation+(s.status==='running'?' · '+tracking:paused?'，全局暂停':s.status==='approved'?'，等待开始':'，尚未执行')]],[['依据',clear?'原A可继续，满足已检查的通行要求':done?'原A存在约束问题，请复核':'至'+target+'的路线约束正在检查'],['空域',check?'至'+target+'已检A第1–'+check.segments+'段；'+(check.zoneIntersects?'与已知禁区相交':'未穿已知禁区'):'禁区检查数据尚不可用'],['建筑',done?interval(check):ready?'建筑净距正在计算':'三维场景未就绪']],[['抵达',arrival(result)],['记录',record],['局限',condition+'；仅预测至'+target]]);
 }
 if(s.noFlyPlanning){
  const b=L.boundary,boundary=finite(b?.seconds)?(paused?'恢复后按当前航向约':'保持当前航向约')+t(b.seconds)+'到边界':finite(L.alongBoundarySeconds)?'沿A按当前速度约'+t(L.alongBoundarySeconds)+'到边界':b?.reason||'边界运动数据缺失';
  return pack([['变化','前方新增禁飞区，正在规划绕行'],['目标','目的地仍为'+target+'，优先避开禁区'],['当前',motion+'；新路线尚未生成']],[['原路',affected],['影响',invalidOriginal?'原A不能完整执行，正在检查替代路线':'检查新通告是否影响当前任务'],['来源',s.flightEvent?.source||'临时空域通告']],[['边界',boundary],['预测','绕行结果计算中，原到达预测暂不适用'],['局限','按当前运动估计，减速/转向后更新；'+record]]);
 }
 if(!d&&(w?.status==='rejected'||w?.status==='blocked'||s.noFlyPlanError||s.status==='manual')){
  return pack([['状态',w?.status==='rejected'?'你已拒绝B，自动执行已取消':s.status==='manual'?'用户手动接管':'推荐失效，进入保护处置'],['目标','仍前往'+target+'；后续路线待确认'],['当前',(s.status==='manual'?'手动驾驶':motion)+'；'+deviation]],[['原路',affected],['原因',s.noFlyPlanError||s.noFlyProtection?.reason||'手动接管取消默认执行'],['替代',s.status==='manual'?'禁区限制仍有效，由操作者接管':'无有效替代路线，先减速至可行位置悬停']],[['抵达','后续路线未确认，暂不可预测'],['记录',record],['局限','等待时长未知，不提供抵达余电估计']]);
 }
 if(d){
  const check=L.draftCheck,pending=!check||check.pending,reason=check?.errors?.[0]||'修改路线尚未核验',seconds=w?.status==='active'?w.seconds:null;
  return pack([['修改','正在修改'+(seconds!==null?'，剩余'+seconds+'秒；未提交将执行B':'，候选待提交')],['候选','本机→'+Math.max(0,d.route.length-2)+'个调整点→'+target],['当前',motion+'；'+deviation+'；草稿尚未执行']],[['检查',pending?'修改航段正在检查':draftValid?'修改航段未穿禁区和建筑实体':reason],['建筑',pending?'修改净距核算中':interval(check)],['依据',draftValid?'已检查的修改路线可提交确认':pending?'检查完成后才生成新预测':'请修正上述问题后再提交']],[['抵达',draftValid?arrival(result):'预测待更新：'+reason],['记录',record],['局限',draftValid?condition:'未通过检查，不沿用B的时间和电量']]);
 }
 if(!executing){
  const delta=finite(result?.seconds)&&finite(original?.seconds)?result.seconds-original.seconds:null,distance=finite(result?.distance)&&finite(original?.distance)?result.distance-original.distance:null,seconds=w?.status==='active'?w.seconds:null;
  return pack([['建议',(Date.now()<(s.noFlyUpdatedUntil||0)?'推荐已更新；':'')+'改走'+(plan?.name||'B')+'，继续至'+target],['路线','本机→'+(plan?.side||'')+'绕行点→'+target],['决策',(seconds!==null?'剩余'+seconds+'秒；未操作自动执行B':'界面就绪后开始计时')+'；'+motion+'，B尚未执行']],[['方案',plan?.check?.valid?'B全线已检，避开禁区及缓冲区':'B路线约束仍在检查'],['建筑',interval(plan?.check)],['取舍',plan?.choice||'候选检查中，尚无选择结论']],[['抵达','B：'+arrival(result)],['代价',(invalidOriginal?'A已失效，仅作比较；':'与A比较；')+(delta===null?'同刻预测不足':(delta>=0?'多':'少')+t(Math.abs(delta))+(distance===null?'':' / '+(distance>=0?'多':'少')+Math.round(Math.abs(distance))+'m'))],['局限',condition+'；'+record]]);
 }
 const execution=s.noFlyExecution,auto=w?.resolvedBy==='timeout',joined=execution&&L.executionDistance>=execution.firstDistance,bypass=!!s.noFlyBypassComplete;
 if(bypass){
  const post=s.noFlyPostCheck,postInvalid=post&&!post.valid;
  return pack([['状态',paused?'已绕过禁区，任务已暂停':s.noFlyHold?'已绕过禁区，保护减速或悬停':'已绕过禁区，继续前往'+target],['进展','剩余'+remaining+'；'+(L.rejoined?'已接回原A':'沿新路线继续')],['跟踪',deviation+' · '+tracking]],[['依据',postInvalid?'禁区已通过，后续路线受阻，暂缓飞行':'已通过受影响区域，结束本次绕行'],['空域',post?.valid?'已检后续航段，未穿禁区和建筑':post?'后续航段复核未通过':'后续航段正在复核'],['建筑',post?.valid?interval(post):s.noFlyProtection?.reason||'沿已验证路线继续；等待复核结果']],[['抵达',postInvalid?'后续路线未通过检查，暂不可预测':arrival(result)],['记录',record+'；此前完成'+h.segments+'段飞行'],['局限',postInvalid?'等待时长未知，后续到达时间和余电待重算':condition]]);
 }
 const join=execution?.joinCheck,space=execution?.boundaryDistance,rows=auto?[['复核',join?.valid?'到期从实际位置复核，接入B仍可通行':'到期接入检查记录不可用'],['空间',finite(space)?'确认时距原A禁区边界'+f(space)+'m':'原A无前方交点，按实际B路线复核'],['建筑',join?.valid?interval(join):'缺少接入段净距记录']]:[['接入',joined?'已进入确认路线，沿已核验段飞行':'当前位置至首个绕行点已检查'],['空域',join?.valid?'接入段未穿禁区和建筑实体':'接入检查结果尚不可用'],['建筑',join?.valid?interval(join):'缺少接入段净距记录']];
 const prediction=auto?'约'+t(L.bypassForecast?.seconds)+'后绕过禁区；'+arrival(result):(next?.name===target?'':next?next.name+'约'+t(next.forecast?.seconds)+'；':'下一航路点预测缺失；')+arrival(result);
 return pack([['执行',paused?(auto?'超时已确认B，任务仍暂停':'路线已确认，任务仍暂停'):auto?'决策超时，AI已自动绕行至'+target:w?.resolvedBy==='modify'?'修改已确认，正在执行至'+target:'你已确认，沿B绕行至'+target],['进展',progress],['跟踪',deviation+' · '+(paused?'全局暂停，恢复后执行':tracking+(joined?'，沿绕行段':'，沿接入段'))]],rows,[['进程',prediction],['记录',record],['局限',condition+'；转弯动力学未建模']]);
}
const api={observeProgress,recordBypass,history,waypoint,describe};if(typeof module!=='undefined')module.exports=api;else root.N2Status=api;
})(typeof window!=='undefined'?window:globalThis);
