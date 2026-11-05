'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('./dist/core'),Traffic=require('./dist/traffic'),N4Decision=require('./dist/n4-decision'),Sequence=require('./dist/sequence'),FreeNavigation=require('./dist/free-navigation');
const source=fs.readFileSync('dist/n4-runtime.js','utf8');
async function scenario(rate){
 const mission=Sequence.make(2,Sequence.points[2].point,82),speed=mission.cruiseSpeed,traffic=Traffic.createN4(mission.route[0],mission.destination.point,speed,mission.route),state={status:'running',route:C.clone(mission.route),speed,altitude:60,battery:82,simTime:0,simRate:rate,progress:0,traffic};
 const events=[],nodes=new Map();let buildCount=0,futureInput;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{style:{},classList:{toggle(){}},setAttribute(){},innerText:'L1 L2 L3'});return nodes.get(id);};
 const ctx={C,Traffic,N4Decision,FreeNavigation,state,mission,draft:null,performance:{now:()=>0},Date,setTimeout,window:{worldReady:true,worldCollision:()=>null,worldPointClearance:()=>({distance:100}),flightView:{trafficVisibility:()=>({visible:true,rendered:true})}},currentPosition:()=>C.sample(state.route,state.progress),eventLog(type,data){events.push({type,data:JSON.parse(data)});},render(){},$:node,save(){},requestAnimationFrame(){},startFlightEvent(){state.flightEvent={id:'traffic-event',phase:'detected'};},readyCandidate(route){mission.candidateRoute=C.clone(route);state.planVersion=(state.planVersion||0)+1;state.flightEvent.phase='proposal';}};
 vm.createContext(ctx);vm.runInContext(source,ctx);ctx.n4RefreshPanel=()=>{};
 const build=ctx.n4BuildPlan;ctx.n4BuildPlan=(reference,p,speed,altitude,t,active)=>{buildCount++;futureInput={p:{...p},trafficTime:t.time};return build(reference,p,speed,altitude,t,active);};
 const advance=time=>{state.simTime=traffic.time=time;state.progress=time*speed/C.length(state.route);};
 const warmStart=Math.max(0,traffic.revealAfter-Math.max(6,6*rate));advance(warmStart-.1);ctx.n4ObserveTraffic();assert.equal(buildCount,0);
 advance(warmStart);ctx.n4ObserveTraffic();await vm.runInContext('n4WarmJob.promise',ctx);
 assert.equal(buildCount,1);assert.equal(events.length,0,'private preparation must not announce an event');assert.equal(mission.candidateRoute,undefined);assert.equal(mission.n4Plan,undefined);assert.equal(state.conflictAlert,undefined);assert.equal(state.n4Detected,undefined);assert.equal(state.n4TrafficVisible,undefined);assert.equal(state.n4Decision,undefined);
 const futureTime=traffic.revealAfter+mission.n4Options.recognitionSeconds,expected=C.sample(state.route,futureTime*speed/C.length(state.route));assert.equal(futureInput.trafficTime,futureTime);assert(Math.hypot(futureInput.p.x-expected.x,futureInput.p.y-expected.y)<1e-8,'prepare from the future recognition position');
 assert(vm.runInContext('!!n4WarmCache.result',ctx),'preparation produced a real checked plan');
 ctx.n4ObserveTraffic();assert.equal(buildCount,1,'ordinary frames cannot duplicate preparation');
 advance(traffic.revealAfter);assert.equal(ctx.n4CanDiscover(),false);assert.equal(state.n4TrafficVisible,true);assert.equal(state.conflictAlert,undefined);
 advance(futureTime);assert.equal(ctx.n4CanDiscover(),true);const before=ctx.currentPosition();await ctx.n4Reveal(Traffic.predict(state.route,state.progress,speed,60,traffic,60));
 assert.equal(buildCount,1,'matching cached B is reused after live validation');assert.equal(state.n4Detected,true);assert.equal(state.n4Planning,false);assert.equal(state.n4Decision,null,'preparation/reveal alone cannot start the countdown before panel presentation');
 const generated=events.find(e=>e.type==='plan_generated');assert.equal(generated?.data.precomputed,true);assert(Math.hypot(mission.candidateRoute[0][0]-before.x,mission.candidateRoute[0][1]-before.y)<1e-8,'cached B joins the actual current origin');
 assert(events.findIndex(e=>e.type==='traffic_visible')<events.findIndex(e=>e.type==='traffic_detected'),'visibility precedes detection');
 console.log('PASS future-state preparation stays private, cached B is live-validated and attached without early decision',rate);
}
(async()=>{for(const rate of [1,4,8])await scenario(rate);})().catch(error=>{console.error(error);process.exitCode=1;});
