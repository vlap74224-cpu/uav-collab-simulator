(function(root){
'use strict';
const C=typeof module!=='undefined'?require('./core.js'):root.UAV;
const clamp=x=>Math.max(0,Math.min(1,Number(x)||0));
const time=seconds=>seconds<60?`${Math.ceil(seconds)} 秒`:`${Math.floor(seconds/60)} 分 ${Math.ceil(seconds%60)} 秒`;
function describe({state,mission,draft=null,position,tasks=[],errors=[],ready=false,safety=null}){
 const route=draft?.route||state.route,progress=draft?0:clamp(state.progress),speed=Number(draft?.speed??state.speed),altitude=Number(draft?.altitude??state.altitude),battery=Number(state.battery??mission.battery),done=new Set(state.photoCheckpointIds||[]);
 const completed=tasks.filter(t=>done.has(t.id)).length,total=C.length(route),sample=C.sample(route,progress),nearest=C.nearestPointOnRoute(route,[position.x,position.y]),manual=state.status==='manual',editing=!!draft;
 const active=state.status==='photo'?tasks.find(t=>t.id===state.activePhotoCheckpointId):null;
 let next=manual?(nearest?.segmentIndex??0)+1:sample.next;
 if(active){const index=route.findIndex(p=>Math.hypot(p[0]-active.point[0],p[1]-active.point[1])<1);if(index>=0)next=index;}
 next=Math.max(1,Math.min(route.length-1,next));
 const point=route[next],photo=tasks.find(t=>Math.hypot(point[0]-t.point[0],point[1]-t.point[1])<1),arrived=progress>=1||state.status==='complete';
 const target=arrived?mission.destination.name:`P${next}${photo?' · '+(photo.shortName||photo.name):next===route.length-1?' · '+mission.destination.name:''}`;
 const meters=arrived||active?0:Math.hypot(point[0]-(editing?route[0][0]:position.x),point[1]-(editing?route[0][1]:position.y));
 const seconds=speed>0?meters/speed:0,endBattery=Math.max(0,battery-meters*.0016-seconds*.001),remaining=Math.max(0,total*(1-progress)),finishBattery=Math.max(0,battery-remaining*.0016-(speed>0?remaining/speed:0)*.001);
 const deviation=nearest?.distance??0,actualSpeed=state.status==='running'?Number(state.speed):manual?Number(state.manualSpeed||0):0;
 const speedOK=actualSpeed>=0&&actualSpeed<=12,safetyOK=safety&&safety.distance>safety.warning,blocked=errors.length>0||!speedOK||finishBattery<15||state.status==='collision'||(safety&&!safetyOK);
 const status={review:'等待航线确认',approved:'已确认 · 尚未起飞',running:'正常跟踪',paused:'已暂停 · 悬停',photo:'已悬停 · 等待拍照打卡',manual:'手动接管 · 自动航线暂停',editing:'修改方案 · 尚未应用',collision:'模拟碰撞 · 飞行停止',complete:'已到达终点',rejected:'已拒绝 · 保持悬停'}[state.status]||'待命';
 let advice=!ready?'等待三维场景检查完成':editing?'复核修改方案，应用后再继续':manual?'先重新规划，再恢复自动航迹':active?'完成当前拍照打卡后，再继续既定航迹':arrived?'本段航迹已完成':!safety?'等待当前净距测量完成':blocked?'存在需调整因素，请复核后再继续':state.status==='rejected'?'保持悬停，重新审议航线':state.status==='paused'?'可继续当前航迹，等待恢复飞行':state.status==='approved'?'可沿当前航迹开始飞行':'建议继续执行当前航迹';
 const nextAction=active?'调整镜头并拍照打卡':arrived?'进入下一任务阶段':photo?'到点悬停，完成拍照打卡':'飞向下一航路点';
 const geometry=!ready?'三维建筑检查尚未完成':errors.length?errors.join('；'):'当前方案通过建筑碰撞、作业区、速度高度及必经打卡点检查';
 const clearance=!ready||!safety?'当前净距测量待就绪':`最近${safety.label||'实体'} ${safety.distance.toFixed(1)} m；预警边界 ${safety.warning.toFixed(1)} m · ${safetyOK?'间隔满足当前边界':'进入预警范围，需复核'}`;
 const rationale=!ready?'场景未就绪，暂不判断是否保持航迹':editing?'修改结果尚未生效；需完成检查并应用':manual?'当前位置已由操作者控制，原自动路线预测暂停':blocked?'已发现需调整因素，不判定为正常保持航迹':active?'已到必经拍照点，等待用户确认后续飞':arrived?'N1 航迹执行完成':!safety?'当前净距数据待就绪，暂不判断是否保持航迹':state.status==='rejected'?'操作者已拒绝当前方案，保持悬停等待重新审议':'当前检查未发现必须重规划的因素，保留既定航迹与打卡顺序';
 const forecast=manual?'自动航迹已暂停；重新规划后更新预测':arrived?'已到达，无下一航路点':active?'已到达当前打卡点，剩余飞行时间 0 秒':speed>0?`至 ${target} 约 ${Math.round(meters)} m / ${time(seconds)}（仿真飞行时间）`:'速度设置无效，无法预测';
 return {
  context:'N1 · 正常航迹执行',
  sections:[
   ['action','L1','目的、过程与表现','判断是否继续当前航迹',[
    ['goal','当前目标',`${arrived?'已到达':'下一航路点'}：${target}；本段终点：${mission.destination.name}`],
    ['requirement','任务要求',`按顺序完成 ${tasks.length} 个必经拍照打卡点，再到达本段终点`],
    ['advice','执行建议',advice],
    ['progress','任务进展',`航迹 ${Math.round(clamp(state.progress)*100)}% · 已完成 ${completed}/${tasks.length} 个打卡点；下一步：${nextAction}`],
    ['position','当前位置',`地图坐标 (${position.x.toFixed(0)}, ${position.y.toFixed(0)}) · 高度 ${Number(state.altitude).toFixed(1)} m · 电量 ${battery.toFixed(1)}%`],
    ['performance','实际表现',`航迹偏差 ${deviation.toFixed(1)} m · 实际地速 ${actualSpeed.toFixed(1)} m/s（允许 0–12 m/s，${speedOK?'范围内':'超出范围'}）`],
    ['status','执行状态',state.status==='running'&&blocked?'飞行中 · 需复核约束':status]
   ]],
   ['reason','L2','推理与约束','为什么建议保持或调整',[
    ['checks','已检查条件',geometry],
    ['airspace','当前空域',mission.hazard?'已按当前限制区边界检查路线':'N1 未设置临时禁飞区；当前无新增空域事件'],
    ['clearance','安全间隔',clearance],
    ['resources','资源余量',manual?'手动接管中；重新规划后更新剩余航迹电量':`按剩余航迹估算，终点电量约 ${finishBattery.toFixed(1)}%（模拟余量要求 ≥15%）`],
    ['reason','判断依据',rationale]
   ]],
   ['projection','L3','预测与局限','继续执行后会怎样',[
    ['eta','下一点到达',forecast],
    ['battery','预计电量',manual?'手动接管期间不沿用原自动航线预测':`到 ${target} 时约 ${endBattery.toFixed(1)}%`],
    ['outcome','后续进展',arrived?'N1 航迹完成':active?'打卡确认后完成数增加，再飞向下一航路点':`经过 P${next} 后约完成 ${Math.round(C.length(route.slice(0,next+1))/Math.max(total,1)*100)}% 航迹；打卡完成数以实际拍照确认为准`],
    ['assumptions','预测条件',`基于${editing?'待应用方案':'当前航迹'}、计划速度 ${speed} m/s、高度 ${altitude.toFixed(1)} m 和当前电量；${['paused','review','approved','rejected','editing'].includes(state.status)?'按恢复飞行后估算；':''}不含等待、拍照及转弯减速时间`],
    ['limits','适用局限','无风简化仿真，未计真实风场、载荷、温度及电池老化；实际到达时间和耗电可能偏离估计']
   ]]
  ]
 };
}
const api={describe};if(typeof module!=='undefined')module.exports=api;else root.N1Transparency=api;
})(typeof window!=='undefined'?window:globalThis);
