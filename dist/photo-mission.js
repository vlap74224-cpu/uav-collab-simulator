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
 const seconds=distance/speed,endBattery=Number.isFinite(s.battery)?s.battery-distance*.0016-seconds*.001:null;
 return {target:target?.id||'mission-end',name:targetName,seconds,endBattery,afterPhoto:waiting,endpoint:!target,scope:'下一站飞行',conditions:speed+'m/s、恒高无风；未含拍照停留'+(target?'、返航':'')};
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
 const projection=s.status==='complete'?[['终点',dest+'已完成，无剩余航程'],['余电','终点实际电量'+fmt(s.battery)+'%'],['范围','实际仿真记录，无待执行预测']]:f.reason?[['预计',f.reason],['余电','未提供对应终点的可靠估计'],['范围','不提供全任务完成时间']]:[
  ['预计',(f.afterPhoto?'保存后至':'至')+f.name+'飞行'+Math.ceil(f.seconds)+'s'],
  ['余电','抵达'+f.name+'预计'+fmt(f.endBattery)+'%'],
  ['范围',f.conditions]
 ];
 return [['action','L1 当前目标与行动',[['任务',data.flow],['打卡','已打卡'+data.done.length+'/'+data.tasks.length],['动作',action]]],['reason','L2 决策依据与约束',reason],['projection','L3 预期结果与局限',projection]];
}
const api={tasks,name,completed,model,forecast,describe};if(typeof module!=='undefined')module.exports=api;else root.PhotoMission=api;
})(typeof window!=='undefined'?window:globalThis);
