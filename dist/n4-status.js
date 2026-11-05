(function(root){
'use strict';
const fmt=(n,d=1)=>Number.isFinite(n)?n.toFixed(d):'暂不可预测';
const seconds=n=>Number.isFinite(n)?(n<.5?'当前':Math.ceil(n)+'秒'):'暂不可预测';
const percent=n=>Number.isFinite(n)?n.toFixed(1)+'%':'尚无可靠估计';
const pack=(a,b,c)=>[['action','L1 当前目标与行动',a],['reason','L2 决策依据与约束',b],['projection','L3 预期结果与局限',c]];
function describe({state:s,mission:m,live:l,draft:d,evidence:e}){
 const destination=m.destination?.name?.replace(/.*· */,'')||'任务终点D';
 const phase=s.status,decision=s.n4Decision,secondsLeft=decision?.status==='active'?seconds(decision.seconds):null;
 const remaining=l?.remaining?.distance,current=l?.current,targetSpeed=l?.targetSpeed,route=d?.route||m.candidateRoute||s.route;
 const routeName=s.n4Action==='user'?'用户路线C':s.n4Action==='emergency'?'应急路线':s.n4Action==='ai'?'避让路线B':'原路线A';
 const speed=d?.speed??s.speed,forecast=l?.selected,completeForecast=l?.forecast;
 const minGap=x=>Number.isFinite(x?.distance)?fmt(x.distance)+'m':'暂不可预测';
 const next=l?.next,progress=next?`下一点${next.name} · ${fmt(next.distance,0)}m`:`剩余${fmt(remaining,0)}m`;
 const deviation=Number.isFinite(l?.deviation)?fmt(l.deviation)+'m':'暂不可预测';
 const geometry=phase==='editing'||s.n4Decision?.status==='active'?l?.check:s.n4Execution?.check||e?.A?.geometry||l?.check,threshold=e?.A?.threshold||geometry?.threshold||N4Decision.config(m).buildingClearance;
 const currentRouteText=Number.isFinite(remaining)?`剩余${fmt(remaining,0)}m`:'剩余距离暂不可预测';
 const executionHistory=Number.isFinite(s.trafficMinimum)?`本次已记录最近实测间隔${fmt(s.trafficMinimum)}m`:'此前暂无本次避让记录';
 const constraints=geometry?.status==='done'||geometry?.valid!==undefined?geometry.collision||geometry?.valid===false?`建筑检查未通过：${geometry.collision||geometry.errors?.[0]||'航段约束不满足'}`:`当前航线已检查，最小建筑间隔${fmt(geometry.min)}m（要求≥${fmt(threshold)}m）`:geometry?.pending?'当前航段建筑检查进行中':'当前航段建筑间隔尚未完成检查';
 const dynamic=(risk)=>risk?`${minGap(risk)}，${risk.seconds<.5?'当前为最近间隔':`约${seconds(risk.seconds)}后最近接近`}`:'最近接近结果暂不可预测';
 const predictedArrival=completeForecast?`${seconds(completeForecast.seconds)}后到${destination} · 余电约${percent(completeForecast.endBattery)}`:`到达${destination}的预测尚未完成`;
 const conditions=l?.condition||'按当前速度与飞行物运动方向估算；目标改变运动后需重新评估';
 let L1,L2,L3;
 if(phase==='collision'){
  L1=[['结果','发生碰撞，本次飞行已停止'],['目标',`原任务目标${destination}未完成`],['记录',`发生位置：${fmt(s.manualPosition?.x,0)}, ${fmt(s.manualPosition?.y,0)}`]];
  L2=[['对象','无人机与移动目标飞行物发生实体接触'],['结果','双方位置已停在接触时刻'],['后续','保留碰撞记录，不再继续避让']];
  L3=[['结果','停止显示到达与间隔预测'],['记录',executionHistory],['条件','本次事件状态以实际接触位置为准']];
  return pack(L1,L2,L3);
 }
 if(phase==='manual'){
  const manualSpeed=Number.isFinite(s.manualSpeed)?Math.max(0,s.manualSpeed):null;
  const motion=manualSpeed===null?'手动速度信息待更新':manualSpeed>.05?`手动飞行 · 地速${fmt(manualSpeed)}m/s`:'本机悬停，等待操控';
  L1=[['行动','手动接管，自动避让已暂停'],['目标',`目的地仍为${destination}`],['当前',motion]];
  L2=[['控制','当前由操作者控制，未自动跟随原路线'],['间隔',Number.isFinite(current)?`飞行物当前间隔${fmt(current)}m／要求≥${fmt(N4Decision.config(m).threshold,0)}m`:'飞行物当前间隔尚未更新'],['恢复','恢复AI前需从当前位置重新检查接入段']];
  L3=[['到达','当前无自动执行路线，暂不提供到达预测'],['原预测','原避让路线的到达预测已停止适用'],['局限','手动操控会改变运动；恢复AI后重新预测']];
  return pack(L1,L2,L3);
 }
 if(phase==='paused'){
  L1=[['行动','飞行已暂停，当前未执行自动避让'],['目标',`目的地仍为${destination}`],['继续','点击继续飞行后恢复已确认路线']];
  L2=[['控制','本机与移动飞行物均暂停'],['路线',`保留${routeName}，尚未恢复运动`],['依据','当前显示暂停状态，不计作正在执行']];
  L3=[['到达','暂停期间不显示到达倒计时'],['恢复','继续飞行后更新剩余时间与余电预测'],['局限','尚未确定的暂停时长不计入到达估计']];
  return pack(L1,L2,L3);
 }
 if(s.landed||s.landing){
  const emergency=s.n4Action==='emergency',landed=!!s.landed;
  L1=[['目标',emergency?'应急降落点':destination],['动作',landed?'已完成着陆':`正在下降 · 高度${fmt(s.altitude)}m`],['任务',emergency?'原任务已中断':`继续前往${destination}`]];
  const landing=s.n4LandingCheck,landingCheck=landing?.surfaceValid&&landing?.channelClear?(landing.dynamicConflict?`下降期间仍预计与飞行物接近（${minGap(landing.dynamic)}）`:'地面与垂直通道已检查'):(landing?.reason||'正在检查下降面与通道');
  L2=[['检查',landingCheck],['目标',s.n4Emergency?.label||'当前降落位置'],['结果',landed?'已确认落地':`尚未着陆 · ${landing?.dynamicConflict?'保留动态风险并持续检测':'持续检查下降过程'}`]];
  L3=landed?[['结果','着陆完成；不再显示到达倒计时'],['表现',`实际飞行${seconds(s.simTime)} · 余电${percent(s.battery)}`],['记录',executionHistory]]:[['预计',s.n4LandingForecast?`${seconds(s.n4LandingForecast.seconds)}后着陆 · 余电约${percent(s.battery-(s.n4LandingForecast.cost||0))}`:'下降耗电尚未估计'],['风险',dynamic(s.n4Snapshot?.selected)],['局限',conditions]];
  return pack(L1,L2,L3);
 }
 if(s.n4LandingBlocked){
  L1=[['行动','应急降落点检查未通过，本机正在悬停'],['原因',s.n4LandingCheck?.reason||'下降条件暂不满足'],['状态','飞行物仍在移动，碰撞检测继续']];
  L2=[['地面',s.n4LandingCheck?.surfaceValid?'地面检查通过':'未发现可用平整地面'],['通道',s.n4LandingCheck?.channelClear?'垂直通道无建筑阻挡':'垂直下降通道受阻'],['动态',s.n4LandingCheck?.dynamicConflict?`下降期间预测间隔${minGap(s.n4LandingCheck.dynamic)}`:'持续检查飞行物位置']];
  L3=[['预测','尚未开始下降，暂不报告着陆时间'],['电量',`悬停期间继续耗电 · 当前${percent(s.battery)}`],['局限','需要重新选择有效航线或降落点']];
  return pack(L1,L2,L3);
 }
 if(s.n4Action==='emergency'){
  L1=[['目标','紧急前往应急降落点'],['执行',`当前沿应急路线飞行 · ${progress}`],['状态',`原任务${destination}暂停`]];
  L2=[['降落点',s.n4Emergency?.label||'正在查找可用降落位置'],['检查',s.n4Emergency?.surface?`地面平整 · ${s.n4Emergency.surface.label||'表面已识别'}`:'下降通道检查中'],['冲突',dynamic(l?.selected)]];
  L3=[['预计',l?.selected?`${seconds(l.selected.secondsToLand)}后抵达并下降`:'抵达及下降预测正在计算'],['余电',completeForecast?`着陆后约${percent(completeForecast.endBattery)}`:'着陆余电尚无可靠估计'],['局限',conditions]];
  return pack(L1,L2,L3);
 }
 if(s.n4EmergencyPlanning){
  L1=[['行动','正在寻找可用的应急降落点'],['当前',`本机继续沿当前航线前进 · ${currentRouteText}`],['状态','降落路线尚未确认，飞行物继续运动']];
  L2=[['检查','搜索平整地面与无障碍下降通道'],['动态','同时检查飞行路线及下降过程与飞行物的间隔'],['结果',s.n4EmergencyError||'尚未找到可执行降落点']];
  L3=[['预测','降落路线确认后重新计算到达与着陆时间'],['电量','当前位置仍按飞行状态持续耗电'],['局限','目标持续移动，规划完成时会按最新位置复核']];
  return pack(L1,L2,L3);
 }
 if(phase==='complete'){
  L1=[['结果',`已到达${destination}，本段飞行结束`],['执行',`${routeName} · 实际飞行${seconds(s.simTime)}`],['状态','无待确认动作']];
  L2=[['最近间隔',Number.isFinite(s.trafficMinimum)?fmt(s.trafficMinimum)+'m':'暂不可预测'],['路线',constraints],['记录',executionHistory]];
  L3=[['预测核对',s.n4Execution?.risk?`执行前预计最近间隔${minGap(s.n4Execution.risk)}`:'无可核对的执行前预测'],['实际',`结束余电${percent(s.battery)}`],['局限','到达后停止显示未来预测']];
  return pack(L1,L2,L3);
 }
 if(phase==='running'&&s.n4Decision?.source==='user_resume'){
  L1=[['行动','已恢复自动飞行，沿检查后的路线继续'],['目标',`继续前往${destination} · ${routeName}`],['进展',`${progress} · 航迹偏差${deviation}`]];
  L2=[['接入',s.n4Execution?.check?.valid?'从恢复位置重新检查建筑间隔通过':constraints],['动态',`当前路线预计${dynamic(l?.selected)}`],['依据','按恢复时的位置与飞行物运动状态复核']];
  L3=[['到达',predictedArrival],['记录','本次由用户恢复自动执行'],['局限',conditions]];
  return pack(L1,L2,L3);
 }
 if(s.n4AvoidanceComplete){
  L1=[['目标',`已绕过冲突区域，继续前往${destination}`],['执行',`已${l?.rejoined?'接回原路线':'按新路线继续'} · ${currentRouteText}`],['表现',`当前航迹偏差${deviation}`]];
  L2=[['目标','飞行物已通过受影响航段'],['后续',constraints],['依据','根据当前位置与后续航段检查继续原任务']];
  L3=[['预计',predictedArrival],['表现',executionHistory],['局限',conditions]];
  return pack(L1,L2,L3);
 }
 if(s.n4Decision?.source==='timeout'&&s.n4Decision?.status==='resolved'||s.n4Execution?.source==='timeout'){
  L1=[['行动','决策超时，AI已自动开始避让'],['执行',`当前位置→${next?.name||'避让点'}→${destination}`],['进展',`${progress} · 航迹偏差${deviation}`]];
  L2=[['复核',s.n4Execution?.check?.valid?'从当前位置检查通过':constraints],['间隔',`建议路线${dynamic(l?.selected)}`],['依据','到期时按飞行物最新位置和运动状态复核']];
  L3=[['绕行',l?.selected?`${seconds(l.selected.seconds)}后通过冲突区域`:'通过冲突区域时间暂不可预测'],['到达',predictedArrival],['局限',conditions]];
  return pack(L1,L2,L3);
 }
 if(s.n4Decision?.status==='resolved'&&s.n4Decision.source==='modify'||s.n4Action==='user'){
  L1=[['行动','已提交路线C，正在执行'],['执行',`当前位置→${next?.name||'用户避让点'}→${destination}`],['表现',`${progress} · 航迹偏差${deviation}`]];
  L2=[['检查',constraints],['间隔',`路线C ${dynamic(l?.selected)}`],['依据',l?.selected?.conflict?'路线C仍有动态接近风险，可能发生碰撞':'按当前飞行物运动状态检查路线C']];
  L3=[['最近',dynamic(l?.selected)],['到达',predictedArrival],['局限',conditions]];
  return pack(L1,L2,L3);
 }
 if(s.n4Decision?.status==='resolved'&&s.n4Decision.source==='accept'||s.n4Execution?.source==='accept'){
  L1=[['行动','你已确认，正在沿B避让'],['进展',`${progress} · ${next?.name||'下一避让点'}`],['表现',`当前航迹偏差${deviation}`]];
  L2=[['接入',s.n4Execution?.check?.valid?'从当前位置至B的完整路线已通过建筑检查':constraints],['动态',`B预计${dynamic(l?.selected)}`],['依据',m.n4Plan?.choice||'按当前飞行物运动状态复核']];
  L3=[['通过',l?.selected?`${seconds(l.selected.seconds)}后通过冲突区域`:'通过时间暂不可预测'],['到达',predictedArrival],['局限',conditions]];
  return pack(L1,L2,L3);
 }
 if(s.n4Decision?.status==='active'){
  const edit=phase==='editing',candidate=d?l?.selected:m.n4Plan?l?.selected:null;
  if(s.n4Planning){
   L1=[['事件','飞行物运动状态有变化，正在更新避让方案'],['目标',`仍前往${destination} · 本机沿A继续飞行`],['状态',`决策剩余${secondsLeft}；新方案尚未可用`]];
   L2=[['原因',`按飞行物最新位置、速度和方向重新评估`],['原路',`原路线预计最近间隔${minGap(l?.original)}，要求≥${fmt(N4Decision.config(m).threshold,0)}m`],['进度',m.n4PlanError||'正在重新检查绕行路线与建筑间隔']];
   L3=[['当前',`保持原路线：${dynamic(l?.original)}`],['新方案','绕行结果与抵达预测正在重新计算'],['局限',conditions]];
   return pack(L1,L2,L3);
  }
  if(!m.n4Plan){
   L1=[['目标',`仍前往${destination} · 本机继续沿当前航线飞行`],['建议',m.n4PlanError?'AI暂未找到已核验的绕行路线':'正在准备可用的绕行路线'],['状态',edit?`正在编辑路线C · 剩余${secondsLeft}`:`决策剩余${secondsLeft}；无有效B时不会强行执行`]];
   L2=[['原因',`原路线预计最近间隔${minGap(l?.original)}，安全要求≥${fmt(N4Decision.config(m).threshold,0)}m`],['检查',m.n4PlanError||'AI正在检查动态间隔与建筑净距'],['操作',edit?'提交前检查路线C与飞行物的实际间隔':'可自行规划路线或选择紧急降落']];
   L3=[['当前',`保持原路线：${dynamic(l?.original)}`],['建议','尚无有效AI路线，预测待更新'],['局限','倒计时到期后将复核；无可行路线时转为人工选择']];
   return pack(L1,L2,L3);
  }
  L1=[['目标',`仍前往${destination} · 优先避开飞行物`],['路线',edit?'正在编辑路线C':`${Date.now()<(s.n4UpdatedUntil||0)?'推荐方案已更新：':''}建议路线B：当前位置→${next?.name||'避让点'}→${destination}`],['状态',edit?`本机沿A继续飞行 · 剩余${secondsLeft}`:`沿A继续飞行 · 剩余${secondsLeft}；未完成选择将自动执行B`]];
  L2=[['原因',m.n4Plan?`原路线预计最近间隔${minGap(l?.original)}，要求≥${fmt(N4Decision.config(m).threshold,0)}m`:'原路线与飞行物存在接近风险，AI正在核验'],['方案',edit?(l?.check?.pending?'路线C建筑检查中':l?.check?.valid?'路线C建筑间隔检查满足要求':constraints):(l?.check?.valid?`B最近间隔${minGap(candidate)}，安全要求≥${fmt(N4Decision.config(m).threshold,0)}m；建筑净距${fmt(l?.check?.min)}m`:'B的建筑与动态检查仍在更新')],['选择',edit?(candidate?`路线C ${dynamic(candidate)}`:'路线C预测正在更新'):(m.n4Plan?.choice||'待候选方案完成检查')]];
  L3=[['间隔',candidate?`原路线${minGap(l?.original)} → ${edit?'路线C':'B'}${minGap(candidate)}`:'原路线与建议路线对比正在计算'],['结果',edit?predictedArrival:(candidate?`预计${seconds(candidate.seconds)}后最近接近；到达延后${seconds(Math.max(0,(l?.forecast?.seconds||0)-(l?.originalForecast?.seconds||0)))}`:'预计结果正在计算')],['局限',conditions]];
  return pack(L1,L2,L3);
 }
 if(s.n4Decision?.status==='blocked'&&s.n4Decision.source==='emergency'){
  L1=[['行动','所选应急降落方案未通过检查'],['当前',`本机仍沿当前航线飞行 · ${progress}`],['选择','已取消B的自动执行，请重新选择有效方案']];
  L2=[['原因',s.n4Decision.reason||s.n4EmergencyError||'未找到可执行的应急降落方案'],['检查','降落路线、建筑净距或动态间隔未满足要求'],['替代','可重新接受AI避让、编辑航线或重试降落']];
  L3=[['预测','继续沿当前航线：'+dynamic(l?.original)],['状态','未执行B；飞行与碰撞检测继续'],['局限','重新选择后按当时位置与飞行物状态复核']];
  return pack(L1,L2,L3);
 }
 if(s.n4Decision?.status==='blocked'){
  L1=[['事件','默认AI路线未通过当前位置复核'],['行动',`本机仍在飞行 · ${progress}`],['选择','请自行规划有效路线或选择紧急降落']];
  L2=[['原因',s.n4Decision.reason||m.n4PlanError||'当前没有可直接执行的默认路线'],['检查',constraints],['动态',`飞行物当前间隔${fmt(current)}m · 目标仍在移动`]];
  L3=[['预测',`当前路线${dynamic(l?.original)}`],['方案','请提交路线后重新检查动态间隔'],['局限','未确认有效方案前，飞行与碰撞检测继续']];
  return pack(L1,L2,L3);
 }
 if(s.n4Planning||s.conflictAlert){
  L1=[['事件','前方发现移动目标飞行物，正在评估冲突'],['目标',`目的地仍为${destination} · 飞行器继续前进`],['进展',`${currentRouteText} · 航迹偏差${deviation}`]];
  L2=[['依据',`飞行物当前速度${fmt(targetSpeed)}m/s，双方运动趋势正在核验`],['原路',`原路线预计最近间隔${minGap(l?.original)}，要求≥${fmt(N4Decision.config(m).threshold,0)}m`],['计划',m.n4PlanError||'正在检查避让路线与建筑间隔']];
  L3=[['预测',`保持当前运动：${dynamic(l?.original)}`],['进度',m.n4Planning?'绕行路线正在计算；原到达预测暂不沿用':executionHistory],['局限',conditions]];
  return pack(L1,L2,L3);
 }
 L1=[['行动',`正在沿路线A前往${destination}`],['进展',`${currentRouteText} · 当前执行中`],['表现',`航迹偏差${deviation}`]];
 L2=[['判断','当前检查未发现需要避让的动态冲突'],['航段',constraints],['依据','按既定任务顺序继续前往目标点']];
 L3=[['预计',predictedArrival],['局限',`仅依据当前已知环境；${conditions}`],['表现',executionHistory]];
 return pack(L1,L2,L3);
}
const api={describe};if(typeof module!=='undefined')module.exports=api;else root.N4Status=api;
})(typeof window!=='undefined'?window:globalThis);
