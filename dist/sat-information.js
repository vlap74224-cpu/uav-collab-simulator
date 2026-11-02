(function(root){
'use strict';
const C=typeof module!=='undefined'?require('./core.js'):root.UAV;
function describe({state:s,mission:m,draft:d,position:p,ready,errors=[],comparison:q}){
 const route=d?.route||s.route,v=d?.speed??s.speed,left=C.length(route)*(d?1:1-s.progress),secs=v>0?left/v:null,battery=s.battery??m.battery,energy=battery-left*.0016-(secs||0)*.001,fmt=n=>Number.isFinite(n)?n.toFixed(1):'暂不可预测',eta=secs===null?'暂不可预测':Math.ceil(secs)+' 秒',target=s.goalDeferred||d?.goalDeferred?'A 点返航':m.destination.name.replace(/.*· */,'');
 const checked=!ready?'等待场景检查':errors.length?'约束未通过，请修改航线':'当前航线约束检查通过',plan=d?'待应用修改航迹':s.modified?'修改航迹':'建议航迹';
 let a,b,c;
 if(m.id==='N4'){
 q=q||{};const risk=q.original,reason=!risk?'原方案暂不可预测':risk.conflict?'原方案预测间隔低于阈值':'原方案预测间隔满足阈值';
 const action=s.collisionExperiment?'保持原线（碰撞实验）':q.waiting||q.suggestedLabel==='让行方案'?'悬停让行':!s.conflictAlert?'沿原线监测':!q.suggested||q.suggested.conflict?'建议等待让行':'建议绕行避让';
 a=[['当前', '间隔 '+fmt(q.current)+(Number.isFinite(q.current)?' m':'')+' · 目标 '+fmt(q.targetSpeed)+(Number.isFinite(q.targetSpeed)?' m/s':'')],['推荐',action],['航迹',d?'黄色修改线，应用后执行':s.conflictAlert?'灰：原线 / 黄：候选':'黄色当前航迹']];
 b=[['判断',reason],['阈值','≥40 m（模拟阈值）'],['选择',!ready?'等待三维检查':errors.length?'当前约束未通过，调整或让行':action.includes('让行')?'绕行条件不足，等待目标通过':'结合建筑净空与交通间隔']];
 c=[['方案对比',{original:fmt(q.original?.distance)+(q.original?' m':''),suggested:fmt(q.suggested?.distance)+(q.suggested?' m':''),label:q.suggestedLabel||'建议方案'}],['时刻','原 '+(q.original?fmt(q.original.seconds)+' s':'暂不可预测')+' / 建议 '+(q.suggested?fmt(q.suggested.seconds)+' s':'暂不可预测')],['前提','计划恢复；目标匀速，≤30s']];
 }else if(m.id==='N2'||m.id==='N3'){
 const z=(s.noFlyVisible||s.noFlyDetected||m.id==='N3')?m.hazard:null;
 a=[['目标',target],['推荐',z?'绕开限制区后接回航迹':'沿当前航迹巡航'],['航迹',z?'灰色原线 / 黄色候选线':'当前未发现临时禁飞区']];
 b=[['原因',z?'前方限制区影响原航线':'持续监测前方空域'],['间隔',z?'限制区外保留 '+(z.margin||0)+' m 缓冲':'建筑碰撞约束检查'],['检查',checked]];
 c=[['绕行',z?eta+' · 抵达约 '+fmt(energy)+'%':'发现限制区后预测'],['净距','完整航段最小净距暂不可预测'],['条件','未计定位误差、风场；实际需保留余量']];
 }else if(m.id==='N5'){
 a=[['目标',target+(s.goalDeferred?' · 原任务暂缓':' · 到点着陆')],['推荐',energy>=15?'继续至可行终点':'调整任务或检查返航'],['任务',s.goalDeferred?'返回 A 点后下降':'保留当前终点任务']];
 b=[['原因','实验注入电量下降，需复核资源余量'],['门槛','预计终点电量 ≥15%'],['优先','安全着陆优先；'+checked]];
 c=[['抵达',eta+' · 电量约 '+fmt(energy)+'%'],['返航','需规划检查，暂不可预测'],['条件','巡航估计；未计风场及下降耗电']];
 }else{
 const done=(s.photoCheckpointIds||[]).length,n=m.photoCheckpoints?.length||0;
 a=[['目标',target],['推荐',s.status==='photo'?'完成拍照打卡后续飞':d?'复核修改后应用':s.status==='manual'?'手动接管后需重规划':'继续当前航迹'],['进度',Math.round(s.progress*100)+'%'+(n?' · 打卡 '+done+'/'+n:'')+' · 偏差 '+fmt(C.nearestPointOnRoute(route,[p.x,p.y])?.distance)+' m']];
 b=[['依据',n?'保留必经打卡点及巡检顺序':'按当前位置与目的地规划'],['检查',checked],['方案',plan+'；无新增改线条件时保持']];
 c=[['抵达',s.status==='manual'?'暂不可预测':eta+' · 电量约 '+fmt(energy)+'%'],['范围','仅当前剩余航迹，不含拍照等待'],['条件','恒速巡航估计，未计真实风场和电池老化']];
 }
 return [['action','L1 当前信息与行动',a],['reason','L2 理由与约束',b],['projection',m.id==='N4'?'L3 最小间隔预测与局限':'L3 预测与局限',c]];
}
const api={describe};if(typeof module!=='undefined')module.exports=api;else root.SatInformation=api;
})(typeof window!=='undefined'?window:globalThis);
