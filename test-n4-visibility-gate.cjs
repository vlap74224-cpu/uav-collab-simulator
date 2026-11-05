'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Traffic=require('./dist/traffic.js');
const runtime=fs.readFileSync('dist/n4-runtime.js','utf8'),cockpit=fs.readFileSync('dist/cockpit.js','utf8');
const helpers=runtime.slice(runtime.indexOf('function n4ObserveTraffic('),runtime.indexOf('function n4Candidate('));
const presentation=runtime.slice(runtime.indexOf('function n4PresentationReady('),runtime.indexOf('async function n4Reveal('));
const logSource=cockpit.split('\n').find(line=>line.startsWith('function log('));

for(const rate of [1,4,8]){
 let wall=10000,sight={visible:false,rendered:false};const frames=[],events=[],records=[];
 const state={status:'running',speed:12,simTime:31,simRate:rate,presentedAt:100,traffic:{x:600,y:500,vx:-9,vy:0,time:31,altitude:60,revealAfter:33},flightEvent:{id:'event-1',phase:'proposal'},n4Planning:false,n4Snapshot:{check:{valid:true,pending:false},selected:{conflict:false}}};
 const mission={id:'N4',n4Options:{recognitionSeconds:1},n4Plan:{name:'B'}};
 const ctx={state,mission,Traffic,n4Active:()=>true,n4WorldLive:()=>false,n4Pending:()=>true,currentPosition:()=>({x:100,y:500,heading:270}),window:{flightView:{trafficVisibility:()=>sight}},Date:class extends Date{static now(){return wall;}},n4Log:(type,data)=>events.push({type,data,wall,sim:state.simTime}),requestAnimationFrame:fn=>frames.push(fn),$:()=>({innerText:'L1 L2 L3'}),N4Decision:{config:()=>({decisionSeconds:15})},n4SyncButtons(){},save(){},records,crypto:{randomUUID:()=>String(records.length)},VERSION:'test',session:{},trial:1,snap:()=>({})};
 vm.createContext(ctx);vm.runInContext(helpers+'\n'+presentation+'\n'+logSource,ctx);
 assert.equal(ctx.n4CanDiscover(),false);assert.equal(state.n4TrafficVisible,undefined,'no traffic before the straight reveal time');assert.equal(state.presentedAt,100);
 state.simTime=state.traffic.time=33;wall=12000;
 assert.equal(ctx.n4CanDiscover(),false);assert.equal(state.n4TrafficVisible,true,'physical traffic is exposed before decisions');assert.equal(state.n4FirstVisible,undefined,'offscreen traffic is not an observed stimulus');
 ctx.n4PresentationReady();assert.equal(frames.length,0,'decision must not open before target has actually appeared');
 sight={visible:true,rendered:false};assert.equal(ctx.n4CanDiscover(),false,'computed projection alone is not first rendered exposure');
 sight={visible:true,rendered:true,layout:'target'};wall=12016;assert.equal(ctx.n4CanDiscover(),false);assert.equal(state.n4FirstVisible.wallTimeMs,wall);assert.equal(state.n4FirstVisible.simTime,33);
 state.simTime=state.traffic.time=33.9;assert.equal(ctx.n4CanDiscover(),false,'recognition interval has not elapsed');
 state.simTime=state.traffic.time=34;assert.equal(ctx.n4CanDiscover(),true,'one flight second of visibility precedes detection');
 assert.equal(state.n4Detected,undefined,'visibility helper does not pre-emptively mark a conflict');
 assert.equal(events.filter(e=>e.type==='traffic_visible').length,1);assert.equal(events.filter(e=>e.type==='traffic_visibility_started').length,1);
 // Once seen, looking away cannot silently re-start a decision or its baseline.
 sight={visible:false,rendered:true};assert.equal(ctx.n4CanDiscover(),true);
 wall=14000;state.simTime=35;ctx.n4PresentationReady();assert.equal(state.n4Decision,undefined);
 for(let i=0;i<2;i++){wall+=16;const ready=frames.splice(0);for(const callback of ready)callback();}
 assert.equal(state.n4Decision.status,'active');assert.equal(state.presentedAt,wall,'reaction baseline is the displayed decision, not preflight');
 assert.equal(state.flightEvent.presentedAtSimTime,35);assert.equal(state.n4Decision.startedAtSimTime,35);assert.equal(state.n4Decision.deadlineSimTime,50);
 const baseline=state.presentedAt;wall+=1200;state.simTime+=1.2*rate;ctx.log('accept','confirmed');
 assert.equal(records.at(-1).reactionMs,1200);assert(Math.abs(records.at(-1).reactionFlightSeconds-1.2*rate)<1e-8);
 ctx.log('operator_first_action','modify');assert.equal(records.at(-1).reactionMs,1200);
 ctx.n4PresentationReady();assert.equal(state.presentedAt,baseline,'ordinary refresh cannot reset reaction baseline');
 console.log('PASS rendered straight encounter, recognition interval, decision presentation and reaction baselines',rate);
}
assert(cockpit.includes('n4CanDiscover()'),'real flight trigger must use the discovery gate');
assert(cockpit.includes('state.n4TrafficVisible||state.n4Detected'),'target rendering precedes conflict detection');
assert(cockpit.includes('Traffic.createN4(origin,next.destination.point,speed,next.route)'),'new stages must use the visible-straight scene');
assert(runtime.includes('!update&&!n4CanDiscover()'),'direct initial planning must not bypass visibility');
