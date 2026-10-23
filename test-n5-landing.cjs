const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('./dist/core.js'),Sequence=require('./dist/sequence.js'),FlightControls=require('./dist/flight-controls.js'),Collision=require('./dist/collision.js');
const source=fs.readFileSync('dist/cockpit.js','utf8'),elements=new Map(),events=[];
const ctx={C,Sequence,FlightControls,Collision,mission:null,state:null,last:0,lastSave:Infinity,manualInputs:new Map(),joystick:{forward:0,right:0},window:{worldReady:true},requestAnimationFrame:()=>{},currentPosition:()=>ctx.state.manualPosition||C.sample(ctx.state.route,ctx.state.progress),manualTick:()=>false,photoTasks:()=>[],completedPhotoIds:()=>[],telemetry:()=>{},render:()=>{},toast:()=>{},save:()=>{},snap:()=>({}),stopManual:()=>{},log:(type)=>events.push(type),$:id=>{if(!elements.has(id))elements.set(id,{disabled:false,hidden:false,textContent:'',setAttribute:()=>{}});return elements.get(id)}};
vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf('function beginLanding('),source.indexOf("$('collisionTrial').onclick=")),ctx);
vm.runInContext(source.slice(source.indexOf("$('play').onclick="),source.indexOf("$('reset').onclick=")),ctx);
function start(rate=4,home=false){
 ctx.mission=Sequence.make(3,Sequence.points[3].point,82);const route=C.clone(home?ctx.mission.alternative:ctx.mission.route);
 ctx.state={status:'running',sequence:{index:3,single:true},route,progress:.99999,altitude:60,targetAltitude:60,speed:12,battery:ctx.mission.battery,simRate:rate,simTime:0,trail:[route[0].slice()],goalDeferred:home};ctx.last=0;events.length=0;
 ctx.window.worldLandingSurface=()=>({altitude:2,normalY:1,label:'地面'});
 ctx.window.worldCollision=(a,b)=>b.z<3.5?{t:(a.z-3.5)/(a.z-b.z),label:'地面'}:null;
 ctx.tick(100);assert.equal(ctx.state.progress,1);assert.equal(ctx.state.status,'running','horizontal arrival must not end N5');assert(ctx.state.landing);assert.equal(ctx.state.landing.targetAltitude,3.58,'landing follows the actual surface plus the drone envelope');return route.at(-1);
}
for(const rate of [1,4,8]){
 const endpoint=start(rate),plan=ctx.state.landing;let time=100;
 for(let i=0;i<20;i++)ctx.tick(time+=1000/60);
 assert(ctx.state.altitude<60&&ctx.state.altitude>plan.targetAltitude);assert.deepEqual([ctx.currentPosition().x,ctx.currentPosition().y],endpoint,'descent must hold the destination horizontally');
 elements.get('pause').onclick();const pausedHeight=ctx.state.altitude;for(let i=0;i<15;i++)ctx.tick(time+=1000/60);assert.equal(ctx.state.altitude,pausedHeight,'pause must stop descent');assert.equal(ctx.state.status,'paused');
 elements.get('play').onclick();assert.equal(ctx.state.status,'running');
 for(let i=0;i<5000&&ctx.state.status!=='complete';i++)ctx.tick(time+=1000/60);
 assert.equal(ctx.state.status,'complete');assert.equal(ctx.state.landed,true);assert.equal(ctx.state.altitude,plan.targetAltitude);assert.equal(ctx.state.verticalSpeed,0);assert.deepEqual([ctx.currentPosition().x,ctx.currentPosition().y],endpoint);assert.equal(events.filter(t=>t==='complete').length,1);assert(!events.includes('collision'),'touchdown must not become a crash');
}
const endpoint=start(4,true);assert.deepEqual(endpoint,Sequence.points[0].point);assert.deepEqual(Array.from(ctx.state.landing.point),endpoint,'return route lands at home');
assert(Math.abs(FlightControls.landing(60,1.58,.1).verticalSpeed)>Math.abs(FlightControls.landing(2,1.58,.1).verticalSpeed),'slow down close to the ground');
assert.equal(FlightControls.landing(2,1.58,20).altitude,1.58,'large timesteps cannot pass below touchdown');
start();ctx.state.landing=null;ctx.window.worldLandingSurface=()=>({altitude:10,normalY:1,label:'树冠'});assert.equal(ctx.beginLanding(),false);assert.equal(ctx.state.status,'paused','unsafe surface must hold rather than descend');assert.equal(ctx.state.altitude,60);
start();ctx.window.worldCollision=(a,b)=>b.z<50?{t:.5,label:'建筑'}:null;for(let t=200;t<10000&&ctx.state.status==='running';t+=100)ctx.tick(t);assert.equal(ctx.state.status,'collision','an unexpected obstacle must still stop descent');assert.equal(ctx.state.landing,null);
console.log('PASS N5 actual arrival/descent loop, fixed endpoint, ground height, flare, 1x/4x/8x, pause/resume, return landing and obstruction handling');
