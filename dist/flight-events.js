(function(root){
'use strict';
const C=typeof module!=='undefined'?require('./core.js'):root.UAV;
function detect(s,kind,source,fact){return {id:(s.eventSerial=(s.eventSerial||0)+1)+'-'+kind,kind,source,fact,phase:'detected',detectedAt:s.simTime,wallTime:new Date().toISOString(),position:C.clone(s.manualPosition||C.sample(s.route,s.progress)),battery:s.battery,planVersion:s.planVersion||0};}
function phase(s){return s.status==='inspecting'?'P4悬停巡检中':s.status==='running'?'执行'+(s.activePlan||'航迹A'):s.status==='waiting'?'本机悬停，T1继续运动':s.status==='paused'?'任务全局暂停':s.status==='review'?s.flightEvent?'双方冻结，等待确认':'起飞前确认':s.status==='editing'?'冻结中，修改候选':s.status==='rejected'?'已拒绝，冻结待重议':s.status==='photo'?'悬停拍照，确认后继续':s.status==='complete'?'执行完成':'当前未自动飞行';}
const api={detect,phase};if(typeof module!=='undefined')module.exports=api;else root.FlightEvents=api;
})(typeof window!=='undefined'?window:globalThis);
