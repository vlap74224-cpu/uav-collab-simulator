(function(root){
'use strict';
const C=typeof module!=='undefined'?require('./core.js'):root.UAV;
function describe({state:s,mission:m,draft:d,position:p,status,ready,errors=[],traffic=null,risk=null}){
 const route=d?.route||s.route,progress=d?0:s.progress,speed=d?.speed??s.speed,alt=d?.altitude??s.altitude,battery=s.battery??m.battery,total=C.length(route),remaining=Math.max(0,total*(1-progress));
 const seconds=speed>0?remaining/speed:NaN,energy=distance=>Math.max(0,battery-distance*.0016-(speed>0?distance/speed:0)*.001),fmt=n=>Number.isFinite(n)?n.toFixed(1):'—',duration=n=>Number.isFinite(n)?`${Math.ceil(n)} 秒（仿真时间）`:'暂不可估算';
 const suspended=s.status==='manual',zone=(s.noFlyVisible||s.noFlyDetected||m.id==='N3')?m.hazard:null;
 const target=s.goalDeferred||d?.goalDeferred?'A · 起降区（返航）':m.destination.name;
 const selected=d?'待应用修改方案':s.modified?'用户修改后的航迹':'当前建议航迹';
 const check=!ready?'三维场景尚未就绪，等待检查':errors.length?errors.join('；'):'当前方案通过作业区、速度高度、模拟电量及碰撞检查';
 const forecast=suspended?'手动接管中，重新规划后更新预测':`${selected}剩余约 ${Math.round(remaining)} m / ${duration(seconds)}；预计抵达电量 ${fmt(energy(remaining))}%`;
 const limits='按当前计划速度与剩余航迹估算，不含暂停、拍照等待和下降着陆时间；风、定位误差、载荷与电池老化未建模，时间及能耗可能偏离估计。';
 const action=[['目的地',target],['当前位置',`地图坐标 (${p.x.toFixed(0)}, ${p.y.toFixed(0)}) · 高度 ${s.altitude.toFixed(1)} m`],['当前电量',`${fmt(battery)}%`],['当前航迹',`${selected} · ${route.length-1} 个航段 · 计划 ${speed} m/s`],['AI 推荐',m.summary],['进展',`${Math.round(s.progress*100)}% · ${status}`]];
 const reason=[['检查结果',check],['方案状态',d?'修改尚未生效，点击应用前仍需通过检查':s.modified?'已应用用户修改，以下说明应结合当前检查结果复核':'等待确认或执行当前方案']];
 const projection=[['预计抵达',forecast],['预测范围',limits]];
 if(m.id==='N1'){
  const tasks=m.photoCheckpoints||[],done=tasks.filter(t=>(s.photoCheckpointIds||[]).includes(t.id)).length;
  action.push(['任务进度',`已确认 ${done}/${tasks.length} 个拍照打卡点，必经点需按顺序完成`],['航迹偏差',`${fmt(C.nearestPointOnRoute(route,[p.x,p.y])?.distance)} m`]);
  reason.push(['保持航迹理由',!ready?'等待场景和约束检查完成':suspended?'手动接管后需重规划':errors.length?'存在未满足约束，需调整后再继续':'保留既定巡检顺序和必经拍照点；当前检查未发现必须改线的条件'],['关键约束','必经拍照点、建筑碰撞、作业边界及 ≥15% 模拟电量余量；未接入真实空域通告']);
 }else if(m.id==='N2'||m.id==='N3'){
  action.push(['障碍 / 禁飞区',zone?`${zone.label||'限制区'} · 中心 (${Math.round(zone.x)}, ${Math.round(zone.y)}) · 半径 ${zone.r} m`:'尚未发现新增禁飞区，沿当前航迹巡航'],['原航迹 / 候选',zone?`地图保留原航迹；当前${selected}为候选绕行方案，接受或应用后执行`:'地图显示当前航迹；发现限制区后再生成绕行候选']);
  reason.push(['绕行原因',zone?m.reason:'未发现新限制条件，暂不触发绕行'],['受影响航段',zone?affected(m.interruptedRoute||m.initialRoute||route,zone):'无新增受影响航段'],['安全间隔要求',zone?`避开半径 ${zone.r} m 与额外 ${zone.margin||0} m 缓冲；同时检查三维建筑碰撞`:'持续检查三维碰撞和前方空域事件'],['方向选择理由',zone?'候选路线从限制区外侧绕行并接回目标方向；以当前检查结果决定能否应用':'保持既定方向']);
  projection.push(['预计绕行耗时',zone?duration(seconds):'发现限制区后计算'],['预计最小障碍间隔','未计算完整航迹的连续最小净距；当前显示为边界 / 碰撞检查结果，不提供未经计算的最小间隔'],['定位误差影响','未模拟真实定位误差；偏差可能压缩实际间隔，需保留余量']);
 }else if(m.id==='N4'){
  const separation=traffic?Math.hypot(p.x-traffic.x,p.y-traffic.y,s.altitude-traffic.altitude):NaN;
  const heading=traffic?(Math.atan2(traffic.vx,-traffic.vy)*180/Math.PI+360)%360:NaN;
  action.push(['动态目标',traffic?`位置 (${traffic.x.toFixed(0)}, ${traffic.y.toFixed(0)}) · 高度 ${traffic.altitude} m · 航向 ${fmt(heading)}°`:'移动目标尚未就绪'],['当前间隔',`${fmt(separation)} m`],['建议避让动作',s.collisionExperiment?'保持原航线 · 碰撞实验':s.status==='waiting'?'悬停让行，等待目标通过':s.conflictAlert?m.summary:'监测前方目标，预测进入告警范围后再提示避让']);
  reason.push(['冲突判断依据','依据双方位置、速度与高度，预测未来最多 30 秒的三维最近间隔'],['安全间隔要求','40 m 为模拟交通冲突告警阈值；还需满足建筑碰撞检查'],['避让方案理由',s.conflictAlert?m.reason:'当前未触发冲突处置；持续更新预测']);
  projection.push(['预计最近接近',risk?`${fmt(risk.seconds)} 秒后 · 最近间隔 ${fmt(risk.distance)} m`:'暂无可用预测'],['避让后间隔',risk?`${selected}预计最近 ${fmt(risk.distance)} m（不是未执行方案的实测结果）`:'方案生成后预测'],['目标预测范围','目标按当前速度与方向匀速运动，预测窗口最多 30 秒；未建立概率位置区间，目标转向或变速会使预测失效']);
 }else if(m.id==='N5'){
  const home=m.alternative?.at(-1),returnRoute=home?[[p.x,p.y],home]:null,returnDistance=returnRoute?C.length(returnRoute):NaN;
  action.push(['返航点',home?`A · 起降区 (${home[0]}, ${home[1]})`:'未指定'],['剩余任务',s.goalDeferred||d?.goalDeferred?'暂缓原目标，返回起降区后下降着陆':`前往 ${m.destination.name}，到点后下降着陆`],['剩余可用时间',`${duration(Math.max(0,battery-15)/(.001+Math.max(0,speed)*.0016))}（按当前巡航速率至 15% 余量）`]);
  reason.push(['资源不足原因',m.reason],['返航电量门槛','规划检查要求预计剩余电量 ≥15%；返航距离较长时也可能不可行'],['任务优先级','安全到达可行终点并着陆优先于继续原任务'],['保留 / 取消理由',s.goalDeferred||d?.goalDeferred?'选择返航，暂缓原目标；应用前检查返航路线':'当前保留终点任务；若电量或路径检查不通过，应调整方案']);
  projection.push(['预计返航电量',home?`${fmt(energy(returnDistance))}%（当前位置至 A 点直达基线，未验证沿途可达；绕障和降落将增加耗电）`:'无法估算'],['预计完成时间',suspended?'手动接管后需重算':duration(seconds)],['预计完成任务',s.goalDeferred||d?.goalDeferred?'返回 A 点并着陆，原任务目标暂缓':`到达 ${m.destination.name} 并着陆`],['能耗预测范围','巡航距离及时间的简化估计；下降耗电未计入上述预测，实际应预留额外余量']);
 }
 return [['action','L1 当前信息与行动',action],['reason','L2 理由与约束',reason],['projection','L3 预测与局限',projection]];
}
function affected(route,z){const result=[];for(let i=1;i<route.length;i++)if(C.distanceToSegment([z.x,z.y],route[i-1],route[i])<z.r+(z.margin||0))result.push(i);return result.length?'原航迹第 '+result.join('、')+' 航段进入限制范围':'原航迹未直接穿越限制范围，需结合当前位置复核';}
const api={describe};if(typeof module!=='undefined')module.exports=api;else root.SatInformation=api;
})(typeof window!=='undefined'?window:globalThis);
