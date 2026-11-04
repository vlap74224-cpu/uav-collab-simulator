const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('./dist/core.js'),Sequence=require('./dist/sequence.js'),FlightControls=require('./dist/flight-controls.js'),Collision=require('./dist/collision.js');
const source=fs.readFileSync('dist/cockpit.js','utf8'),elements=new Map(),events=[];
const ctx={Traffic:require('./dist/traffic'),ResourceMission:require('./dist/resource-mission'),eventLog:(type,detail)=>{if(type==='resource_budget_check'){const r=JSON.parse(detail);assert.equal(r.before,r.after,'budget review must not overwrite charge');}},startFlightEvent:()=>{ctx.state.flightEvent={phase:'detected'}},FreeNavigation:{plan:async({origin,target})=>[origin.slice(),target.point.slice()]},readyCandidate:route=>{ctx.mission.candidateRoute=route;ctx.state.flightEvent.phase='proposal'},C,Sequence,FlightControls,Collision,mission:null,state:null,last:0,lastSave:Infinity,manualInputs:new Map(),joystick:{forward:0,right:0},window:{worldReady:true},requestAnimationFrame:()=>{},currentPosition:()=>ctx.state.manualPosition||C.sample(ctx.state.route,ctx.state.progress),manualTick:()=>false,photoTasks:()=>[],completedPhotoIds:()=>[],telemetry:()=>{},render:()=>{},toast:()=>{},save:()=>{},snap:()=>({}),stopManual:()=>{},log:(type)=>events.push(type),$:id=>{if(!elements.has(id))elements.set(id,{disabled:false,hidden:false,textContent:'',setAttribute:()=>{}});return elements.get(id)}};
vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf('function beginLanding('),source.indexOf("$('collisionTrial').onclick=")),ctx);
vm.runInContext(source.slice(source.indexOf("$('play').onclick="),source.indexOf("$('reset').onclick=")),ctx);

vm.runInContext(source.slice(source.indexOf('async function raiseResourceEvent('),source.indexOf('function presentStage(')),ctx);
const R=require('./dist/resource-mission');
(async()=>{
 const m=Sequence.make(3,Sequence.points[3].point,82),out=await R.prepare({mission:m,origin:Sequence.points[3].point,optional:Sequence.points[1].point,home:Sequence.points[4].point,battery:82,speed:12,altitude:60,calibrateStart:true,landingTarget:1.58,plan:async(a,b)=>[a.slice(),b.slice()]});
 assert(R.validate([out.route[0],Sequence.points[1].point,[450,550],Sequence.points[4].point],m.resourceTasks,[],m.returnPoint).some(x=>x.includes('先到P4')));assert(m.resourceEnergy.original>15);assert(out.battery<20);assert(Math.abs(m.resourceEnergy.original-15.02)<1e-8);assert.equal(R.validate(out.route,m.resourceTasks,[],m.returnPoint,{battery:out.battery,speed:12,landing:R.descent(60,1.58)}).length,0);
 ctx.window.worldCollision=()=>null;ctx.window.worldPointClearance=()=>({distance:35});ctx.window.worldLandingSurface=()=>({altitude:0,normalY:1,label:'地面'});
 const reset=(rate,battery=out.battery)=>{ctx.mission=C.clone(m);ctx.state={status:'running',sequence:{index:3,single:true},route:C.clone(out.route),progress:0,altitude:60,targetAltitude:60,speed:12,battery,simRate:rate,simTime:0,trail:[out.route[0]],resourceCompleted:[],resourceDetected:false};ctx.last=0;events.length=0;};

 vm.runInContext(source.slice(source.indexOf('function candidateRoute()'),source.indexOf('function satInformation()')),ctx);
 vm.runInContext(source.slice(source.indexOf('function validateFlight('),source.indexOf('function updateTrafficDisplay()')),ctx);
 vm.runInContext(source.slice(source.indexOf('function decide(type)'),source.indexOf("$('accept').onclick=")),ctx);
 ctx.FlightEvents=require('./dist/flight-events');ctx.findRouteCollision=()=>null;
 const Evidence=require('./dist/route-evidence'),Info=require('./dist/resource-status'),inspector={inspect:()=>({status:'done',min:35,collision:null})};
 const panel=()=>Info.describe({state:ctx.state,mission:ctx.mission,position:ctx.currentPosition(),evidence:Evidence.build({state:ctx.state,mission:ctx.mission,position:ctx.currentPosition(),inspector}),landingForecast:ctx.state.landing?R.descent(ctx.state.altitude,ctx.state.landing.targetAltitude):null});
 for(const rate of [1,4,8]){
  reset(rate);let confirmed=false,p4Seen=false,pauseChecked=false,landingSeen=false;const initial=JSON.stringify(panel());assert(initial.includes('P4')&&initial.includes('P5')&&initial.includes('E'));assert(!initial.includes('建议取消'));
  for(let time=100;time<220000&&!ctx.state.landed;time+=100){const before=ctx.state.battery;ctx.tick(time);await Promise.resolve();await Promise.resolve();assert(before-ctx.state.battery>=-1e-8&&before-ctx.state.battery<.025,'event must not mutate the charge');
   if((ctx.state.resourceCompleted||[]).includes('P4'))p4Seen=true;
   if(p4Seen&&!pauseChecked&&!ctx.state.resourceDetected){elements.get('pause').onclick();const charge=ctx.state.battery,position=ctx.currentPosition();ctx.tick(time+=100);assert.equal(ctx.state.battery,charge);assert.deepEqual(ctx.currentPosition(),position);elements.get('play').onclick();pauseChecked=true;}
   if(ctx.state.resourceDetected&&ctx.state.status==='review'){
    assert(p4Seen);assert.deepEqual(Array.from(ctx.state.resourceDecisionSnapshot.original.route[0]),Array.from(ctx.state.resourceDecisionSnapshot.adjusted.route[0]));assert.equal(ctx.state.resourceDecisionSnapshot.battery,ctx.state.battery);assert(ctx.mission.resourceEnergy.original<15);assert(ctx.mission.resourceEnergy.adjusted>15);assert.notDeepEqual(ctx.state.route,ctx.mission.candidateRoute);assert(Math.hypot(ctx.currentPosition().x-450,ctx.currentPosition().y-550)>=30,'event is after P4, while flying toward P5');assert.deepEqual(Array.from(ctx.state.resourceCompleted),['P4']);assert(C.nearestPointOnRoute(ctx.state.route,Sequence.points[1].point).distance<2);assert(C.nearestPointOnRoute(ctx.mission.candidateRoute,Sequence.points[1].point).distance>2);assert(!ctx.state.resourceCancelled?.includes('P5'),'candidate cancellation is not an executed cancellation');
    const text=JSON.stringify(panel());assert(text.includes('建议取消P5'));assert(text.includes('P5建议取消'));assert(text.includes('抵达余电'));assert(text.includes('着陆后预计'));
    ctx.decide('accept');assert.equal(ctx.state.status,'running');assert.deepEqual(Array.from(ctx.state.resourceCancelled),['P5']);assert(JSON.stringify(panel()).includes('P5已取消'));confirmed=true;
   }
   if(ctx.state.landing&&!landingSeen){landingSeen=true;assert.equal(ctx.state.landed,false);assert(ctx.state.resourceLandingCheck.valid);const text=JSON.stringify(panel());assert(text.includes('正在下降着陆'));assert(!text.includes('飞行结束'));}
  }
  assert(p4Seen&&pauseChecked&&confirmed&&landingSeen);assert(ctx.state.landed,'must land at E at rate '+rate);assert.deepEqual(Array.from(ctx.state.resourceCompleted),['P4']);assert(ctx.state.battery>=15);assert.deepEqual(Array.from(ctx.state.route.at(-1)),Sequence.points[4].point);const text=JSON.stringify(panel());assert(text.includes('已在E降落'));assert(text.includes('实际任务耗时'));assert(!text.includes('后完成着陆'));assert(Math.abs(ctx.state.resourceResult.battery-ctx.state.resourceResult.prediction.endBattery)<.02,'landing result must agree with the confirmed energy prediction');assert.equal(events.filter(x=>x==='resource_task_complete').length,1);
 }
 reset(4,82);for(let time=100;time<100000&&!ctx.state.landed;time+=100){ctx.tick(time);await Promise.resolve();await Promise.resolve();assert.notEqual(ctx.state.status,'review','ample charge must not manufacture an alert');}assert(ctx.state.landed);assert(ctx.state.battery>75);assert(ctx.state.resourceEventSkipped);assert.deepEqual(Array.from(ctx.state.resourceCompleted),['P4','P5']);
 reset(1,15.1);for(let time=100;time<2000&&!ctx.state.resourceProtection;time+=100){ctx.tick(time);await Promise.resolve();await Promise.resolve();}assert(ctx.state.resourceProtection);assert(!ctx.mission.candidateRoute);assert(!ctx.state.resourceCompleted.includes('P4'));assert(JSON.stringify(panel()).includes('当前资源无法同时完成必经任务和到达E'));
 console.log('PASS N5 1x/4x/8x: P4 passed before enroute event, continuous charge, same-position forecasts, candidate/confirmed P5 cancellation, safe E descent and actual result comparison; ample charge keeps P5 and insufficient required-task budget protects');

})();
