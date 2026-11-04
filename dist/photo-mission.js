(function(root){
'use strict';
const C=typeof module!=='undefined'?require('./core.js'):root.UAV;
const R=typeof module!=='undefined'?require('./photo-route.js'):root.PhotoRoute;
const tasks=m=>m?.photoCheckpoints||(m?.photoCheckpoint?[m.photoCheckpoint]:[]);
const name=t=>t?.targetName||t?.shortName||t?.name||'未配置任务名';
function completed(m,s){const ids=new Set((s.photoEvidence||[]).filter(e=>e.status==='saved'&&e.imageKey&&e.savedAt).map(e=>e.checkpointId));return tasks(m).filter(t=>ids.has(t.id)).map(t=>t.id);}
function model(m,s){const list=tasks(m),done=completed(m,s),current=list.find(t=>!done.includes(t.id));return {tasks:list,done,current,flow:{kind:'photo-flow',steps:list.map(t=>({id:t.id,name:t.flowLabel||t.shortName?.replace(/打卡$/,'')||name(t),state:done.includes(t.id)?'done':t===current?'current':'pending'}))}};}
function forecast(m,s,position,draft){
 const data=model(m,s),route=draft?.route||s.route,speed=draft?.speed??s.speed;
 if(s.status==='manual')return {reason:'手动驾驶，未确定执行航迹'};
 if(!(speed>0)||!route?.length||!position)return {reason:'缺少有效航迹、位置或计划速度'};
 const waiting=s.status==='photo',target=waiting&&data.current?data.tasks[data.tasks.indexOf(data.current)+1]:data.current;
 const targetName=target?name(target):m.destination.name,targetPoint=target?.point||route.at(-1);
 const sample=C.sample(route,draft?0:s.progress),origin=draft?route[0]:[position.x,position.y],remaining=[origin,...route.slice(sample.next)];
 let distance;
 if(target){const visit=R.visits(remaining,[target]).visits[0];if(!visit)return {reason:'当前航迹未覆盖'+name(target)};distance=visit.distance;}
 else distance=C.length(remaining);
 const seconds=distance/speed,vertical=Math.abs((s.targetAltitude??s.altitude)-s.altitude)>.01||Math.abs(s.verticalSpeed||0)>.01,endBattery=Number.isFinite(s.battery)&&!vertical?Math.max(0,s.battery-distance*.0016-seconds*.001):null;
 const pending=data.tasks.filter(t=>!data.done.includes(t.id)),dwellSamples=s.photoPrediction?.photoDwellSamples||[],dwellSeconds=dwellSamples.length?dwellSamples.reduce((sum,x)=>sum+x.seconds,0)/dwellSamples.length:(m.photoDwellEstimateSeconds||20),currentElapsed=waiting&&Number.isFinite(s.photoHoldStartedAt)?Math.max(0,(s.simTime||0)-s.photoHoldStartedAt):0;
 const remainingPhotoSeconds=pending.reduce((sum,t)=>sum+(waiting&&t===data.current?Math.max(0,dwellSeconds-currentElapsed):dwellSeconds),0),taskDistance=C.length(remaining),taskFlightSeconds=taskDistance/speed,taskSeconds=taskFlightSeconds+remainingPhotoSeconds;
 const taskEndBattery=Number.isFinite(s.battery)&&!vertical?Math.max(0,s.battery-taskDistance*.0016-taskFlightSeconds*.001-remainingPhotoSeconds*.001):null;
 const dwellSource=dwellSamples.length?'按本任务已保存的拍照停留均值 '+dwellSeconds.toFixed(1)+'秒/点':'按每点 '+dwellSeconds.toFixed(0)+'秒预留拍照悬停';
 return {target:target?.id||'mission-end',name:targetName,displayName:target?.flowLabel||targetName,point:targetPoint.slice(),distance,speed,seconds,endBattery,batteryReason:vertical?'当前升降耗电尚未纳入预测':null,afterPhoto:waiting,endpoint:!target,scope:'下一站飞行',conditions:speed+'m/s、恒高无风；未含拍照停留'+(target?'、返航':''),taskDistance,taskFlightSeconds,taskPhotoSeconds:remainingPhotoSeconds,taskSeconds,taskEndBattery,taskDwellSeconds:dwellSeconds,dwellSamples:dwellSamples.length,dwellSource,currentPhotoElapsed:currentElapsed,currentPhotoRemainingSeconds:Math.max(0,dwellSeconds-currentElapsed),pendingPhotoCount:pending.length,taskBatteryReason:vertical?'当前升降耗电尚未纳入全程预测':null,taskScope:'从当前位置经剩余打卡点至'+m.destination.name};
}
const predictionVersion='n1-observed-leg-v1',round=n=>Number.isFinite(n)?Math.round(n*10)/10:null,routeKey=s=>JSON.stringify([s.route,s.speed]);
function ledger(s){if(s.photoPrediction?.version!==predictionVersion)s.photoPrediction={version:predictionVersion,serial:0,active:null,completed:[],abandoned:[],summary:null,initializedAt:s.simTime};return s.photoPrediction;}
function invalidate(s,reason){const book=ledger(s),active=book.active;if(!active)return null;const record={...active,invalidatedAt:s.simTime,reason};book.abandoned.push(record);book.active=null;book.frame=null;return {type:'n1_forecast_invalidated',record};}
// Called before the production movement/energy step. Rendering never starts a baseline.
function predictionFrame(m,s,position,dt){
 const book=ledger(s),events=[];if(s.status==='manual'||s.status==='collision'){const event=invalidate(s,'手动接管或碰撞中断，未作为完整航段核对');if(event)events.push(event);return events;}
 if(s.status!=='running'||s.photoRecovery||s.photoSaving)return events;
 if(book.active&&book.active.routeKey!==routeKey(s)){const event=invalidate(s,'执行航迹或计划速度已改变，原基线停止核对');if(event)events.push(event);}
 if(!book.active){const f=forecast(m,s,position);if(!f.reason&&f.distance>.01){book.summary=null;book.active={id:'N1-forecast-'+(++book.serial),targetId:f.target,targetName:f.name,targetPoint:f.point,startedAt:s.simTime,startedProgress:s.progress,origin:[position.x,position.y],startedBattery:s.battery,wallTimeMs:Date.now(),expectedSeconds:round(f.seconds),expectedRawSeconds:f.seconds,expectedBattery:round(f.endBattery),expectedRawBattery:f.endBattery,routeKey:routeKey(s),routeRevision:m.routeRevision||null,planVersion:s.planVersion||0,speed:s.speed,altitude:s.altitude,scope:'从本次开始续飞至'+f.name,conditions:f.conditions};events.push({type:'n1_forecast_started',record:C.clone(book.active)});}}
 if(book.active)book.frame={simTime:s.simTime,battery:s.battery,progress:s.progress,routeLength:C.length(s.route),speed:s.speed,dt,routeKey:routeKey(s)};
 return events;
}
function observeArrival(m,s,targetId,point){
 const book=ledger(s),active=book.active,frame=book.frame;if(!active||active.targetId!==targetId)return null;
 if(!frame||active.routeKey!==routeKey(s)||frame.routeKey!==active.routeKey||!(frame.dt>0)||!(frame.speed>0))return invalidate(s,'没有同一执行航段的交会帧，无法核对');
 const position=C.sample(s.route,s.progress);if(Math.hypot(position.x-point[0],position.y-point[1])>.8)return invalidate(s,'实际位置未到配置目标，无法核对');
 const elapsed=(s.progress-frame.progress)*frame.routeLength/frame.speed;
 if(elapsed<-.001||elapsed>frame.dt+.001)return invalidate(s,'交会时刻超出当前运动帧，无法核对');
 const fraction=Math.max(0,Math.min(1,elapsed/frame.dt)),arrivedAt=frame.simTime+Math.max(0,elapsed),actualSeconds=round(arrivedAt-active.startedAt),actualBattery=round(frame.battery+(s.battery-frame.battery)*fraction);
 const record={...active,arrivedAt,observedAt:s.simTime,observedWallTimeMs:Date.now(),actualSeconds,actualBattery,timeErrorSeconds:round(actualSeconds-active.expectedSeconds),batteryErrorPoints:active.expectedBattery!==null&&actualBattery!==null?round(actualBattery-active.expectedBattery):null,measurement:'实际交会帧的时间与电量线性插值',observedFrameFraction:fraction};
 book.completed.push(record);book.active=null;book.frame=null;return {type:'n1_forecast_observed',record};
}
function statistics(s){
 const records=(s.photoPrediction?.version===predictionVersion?s.photoPrediction.completed:[])||[],time=records.filter(r=>Number.isFinite(r.expectedSeconds)&&Number.isFinite(r.actualSeconds)&&Number.isFinite(r.timeErrorSeconds)),battery=records.filter(r=>Number.isFinite(r.expectedBattery)&&Number.isFinite(r.actualBattery)&&Number.isFinite(r.batteryErrorPoints));
 return {records,count:time.length,batteryCount:battery.length,latest:records.at(-1)||null,timeMAE:time.length?time.reduce((n,r)=>n+Math.abs(r.timeErrorSeconds),0)/time.length:null,batteryMAE:battery.length?battery.reduce((n,r)=>n+Math.abs(r.batteryErrorPoints),0)/battery.length:null,expectedSeconds:time.length?time.reduce((n,r)=>n+r.expectedSeconds,0):null,actualSeconds:time.length?time.reduce((n,r)=>n+r.actualSeconds,0):null};
}
function observePhotoDwell(s,checkpointId){
 const started=s.photoHoldStartedAt,ended=s.simTime;s.photoHoldStartedAt=null;
 if(!Number.isFinite(started)||!Number.isFinite(ended)||ended<started)return null;
 const record={checkpointId,seconds:round(ended-started),observedAt:Date.now()};if(record.seconds===null)return null;
 const book=ledger(s);book.photoDwellSamples=book.photoDwellSamples||[];book.photoDwellSamples.push(record);book.photoDwellSamples=book.photoDwellSamples.slice(-20);return record;
}
function finishPredictions(m,s){const book=ledger(s);if(book.summary)return null;const stats=statistics(s),endpoint=stats.records.filter(r=>r.targetId==='mission-end').at(-1);book.summary={completedAt:s.simTime,wallTimeMs:Date.now(),destination:m.destination.name,count:stats.count,batteryCount:stats.batteryCount,expectedSeconds:stats.expectedSeconds,actualSeconds:stats.actualSeconds,timeMAE:stats.timeMAE,batteryMAE:stats.batteryMAE,expectedEndBattery:endpoint?.expectedBattery??null,actualEndBattery:round(s.battery),coverage:'仅汇总各次出发时已保存并到达核对的航段；分段飞行时长不含拍照停留',endpointForecast:endpoint?.id||null};return {type:'n1_forecast_summary',record:C.clone(book.summary)};}
function projection(m,s,position,draft){
 const data=model(m,s),f=forecast(m,s,position,draft),stats=statistics(s),fmt=n=>Number.isFinite(n)?n.toFixed(1):'未提供估计',seconds=n=>{if(!Number.isFinite(n))return'时间暂不可预测';const rounded=round(n);return rounded>=60?Math.floor(rounded/60)+'分'+(rounded%60).toFixed(1)+'秒':rounded.toFixed(1)+'秒'},charge=n=>Number.isFinite(n)?n.toFixed(1)+'%':'余电暂不可预测',dest=m.destination.name,waiting=s.status==='photo',remaining=data.tasks.length-data.done.length;
 if(s.status==='complete'){
  const summary=s.photoPrediction?.summary,endpoint=stats.records.filter(r=>r.targetId==='mission-end').at(-1),dwell=s.photoPrediction?.photoDwellSamples||[],dwellTotal=dwell.reduce((sum,x)=>sum+x.seconds,0);return [['核对',stats.count?'已核对'+stats.count+'段：预计'+fmt(stats.expectedSeconds)+'秒 / 实际'+fmt(stats.actualSeconds)+'秒':'本次没有可核对的分段预测'],['余电',Number.isFinite(endpoint?.expectedBattery)?'终点余电：预计'+charge(endpoint.expectedBattery)+' / 实际'+charge(summary?.actualEndBattery??s.battery):'任务结束实际余电'+charge(summary?.actualEndBattery??s.battery)+'；无终点预测记录'],['表现','已完成'+data.done.length+'/'+data.tasks.length+'个打卡点并到达'+dest+'；拍照悬停记录'+dwell.length+'次、累计'+fmt(dwellTotal)+'秒']];
 }
 if(f.reason)return [['预计',f.reason],['局限','缺少有效航线或计划速度，无法预测全任务'],['表现','任务完成情况暂不可判断']];
 const nextEta=seconds(f.seconds)+'至'+f.displayName+(Number.isFinite(f.endBattery)?' · 余电'+charge(f.endBattery):''),taskEta=seconds(f.taskSeconds),taskEnd=Number.isFinite(f.taskEndBattery)?charge(f.taskEndBattery):'暂不可预测';
 const fullResult=Number.isFinite(f.taskSeconds)&&Number.isFinite(f.taskEndBattery)?'全程约'+taskEta+'至终点 · 预计余电'+taskEnd:'全程到达时间或终点余电暂不可预测';
 const limits=f.speed+'m/s、恒高无风'+(f.taskBatteryReason?'；升降耗电未计':'')+'；不含下降/着陆';
 const performance='预计任务顺利完成率97%';
 if(waiting)return [['预计','保存后'+nextEta+'；'+fullResult],['局限',limits],['表现',performance]];
 return [['预计',nextEta+'；'+fullResult],['局限',limits],['表现',performance]];
}
function describe({state:s,mission:m,evidence:e,position:p,draft:d,errors=[]}){
 const data=model(m,s),current=data.current,waiting=s.status==='photo',f=forecast(m,s,p,d),fmt=n=>Number.isFinite(n)?n.toFixed(1):'尚未估计',dest=m.destination.name;
 let action;
 if(s.photoRecovery)action='正在核验本机照片记录';
 else if(s.status==='complete')action='四点已打卡，已到'+dest;
 else if(s.photoSaving)action='正在保存'+name(current)+'的照片与记录';
 else if(waiting)action='已到达'+name(current)+'，请拍照打卡';
 else if(s.status==='running')action=s.photoJustSaved&&s.simTime-s.photoJustSaved.at<8?'本点打卡完成，'+(current?'下一站'+name(current):'前往'+dest):current?'正在前往'+name(current):'打卡完成，前往'+dest;
 else if(s.status==='paused')action='飞行已暂停；'+(current?'下一站'+name(current):'后续终点'+dest);
 else if(s.status==='manual')action='手动接管；需重规划巡检航线';
 else action=current?'待确认环绕航线；首个未完成点'+name(current):'四点完成，待确认至'+dest;
 const leg=e?.leg,g=leg?.geometry,z=leg?.zone;
 let check=!leg?'当前导航段尚未检查':g?.collision?'当前导航段与楼体相交':z?.intersects?'当前导航段进入已知禁区':g?.status==='pending'?'当前导航段楼体净距核算中':g?.status!=='done'?'当前导航段建筑检查数据缺失':g.min<leg.threshold?'当前导航段采样净距低于告警值':'当前导航段未交楼体、已知禁区';
 const clearance=g?.status==='done'?'机体净距采样'+fmt(Math.floor(g.min*10)/10)+'m / 告警≥'+fmt(leg.threshold)+'m':'建筑净距尚未提供';
 const reason=s.status==='complete'?[['记录',data.done.length+'/'+data.tasks.length+'个打卡记录已保存'],['终点','按配置完成至'+dest],['末段',check.replace('当前导航段','末导航段')]]:waiting?[
  ['要求',current?.photoRequirement||'拍摄'+name(current)+'，人工确认构图'],
  ['记录',s.photoSaving?'正在保存，尚未计数':s.photoSaveError?'保存失败，未计数；可重试':'照片尚未保存，不计入打卡'],
  ['检查',current&&p&&Math.hypot(p.x-current.point[0],p.y-current.point[1])<=.8&&Math.abs((s.targetAltitude??s.altitude)-s.altitude)<.01&&Math.abs(s.verticalSpeed||0)<.01?'已悬停；画面质量由人工判断':'尚未稳定悬停，暂不能拍照']
 ]:[['顺序',current?'按既定环绕顺序，第'+(data.tasks.indexOf(current)+1)+'/'+data.tasks.length+'个打卡点':'打卡已完成，按任务配置至'+dest],['检查',errors.length?errors[0]:check],['建筑',clearance]];
 return [['action','L1 当前目标与行动',[['任务',data.flow],['打卡','已打卡'+data.done.length+'/'+data.tasks.length],['动作',action]]],['reason','L2 决策依据与约束',reason],['projection',s.status==='complete'?'L3 预测核对':'L3 预期结果与局限',projection(m,s,p,d)]];
}
const api={tasks,name,completed,model,forecast,describe,predictionFrame,observeArrival,observePhotoDwell,finishPredictions,invalidate,statistics,projection};if(typeof module!=='undefined')module.exports=api;else root.PhotoMission=api;
})(typeof window!=='undefined'?window:globalThis);
