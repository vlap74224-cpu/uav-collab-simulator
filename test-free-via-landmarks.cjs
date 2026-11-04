const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const C=require('./dist/core'),N=require('./dist/free-navigation'),Sequence=require('./dist/sequence');
const source=fs.readFileSync('dist/cockpit.js','utf8'),elements=new Map(),plans=[];
const ctx={C,FreeNavigation:N,crypto,freePlaces:[...Sequence.landmarks,...Sequence.points],state:{freeFlight:true,freeMapPicking:true,freeMapPickingMode:'via',freeViaPoints:[]},$:id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:''});return elements.get(id);},planFreeDestination(){plans.push(C.clone(ctx.state.freeViaPoints));},render(){},toast(message){throw Error(message);},log(){},editFreeDestination(){ctx.edits=(ctx.edits||0)+1;}};
vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf('function freeViaOrder('),source.indexOf('function changeFreeVia(')),ctx);
vm.runInContext(source.slice(source.indexOf('function selectFreePlace('),source.indexOf("$('freeDestination').addEventListener")),ctx);
ctx.$('freeDestination').value='E · 公园内着陆点';
for(const value of ['东方明珠','金茂大厦','东方明珠']){ctx.$('freeDestinationOptions').value=value;ctx.selectFreePlace();assert.equal(ctx.$('freeDestination').value,'E · 公园内着陆点','adding landmarks must preserve the terminal destination');assert.equal(ctx.$('freeDestinationOptions').value,'','the list must allow another selection');}
assert.deepEqual(Array.from(ctx.state.freeViaPoints,p=>p.shortName),['东方明珠','金茂大厦','东方明珠']);
assert.equal(new Set(ctx.state.freeViaPoints.map(p=>p.id)).size,3,'repeat landmark visits need independent IDs');
assert.equal(ctx.state.freeViaPoints[0].landmarkId,'oriental-pearl');assert.equal(ctx.state.freeViaPoints[0].height,468,'preserve building metadata for nearby safe-point selection');
assert.equal(plans.length,3);assert.equal(ctx.edits,undefined);
assert.equal(ctx.addFreeViaPoint([330,470]),true);assert.equal(ctx.state.freeViaPoints.length,4);assert.equal(ctx.freeViaLabel(ctx.state.freeViaPoints[3]),'(330, 470)');
ctx.state.freeMapPicking=false;ctx.$('freeDestinationOptions').value='震旦大厦';ctx.selectFreePlace();assert.equal(ctx.$('freeDestination').value,'震旦大厦');assert.equal(ctx.state.freeViaPoints.length,4);assert.equal(ctx.edits,1);
(async()=>{const route=await N.planItinerary({origin:[30,100],via:[{id:'named',name:'练习地标',point:[180,100],height:100}],target:{point:[300,100]},bounds:{minX:0,maxX:400,minY:0,maxY:300},clearance:()=>100,collision:()=>false});assert.equal(route.stops[0].name,'练习地标');assert.notDeepEqual(route.stops[0].point,[180,100],'landmarks use safe nearby arrival rather than building centers');assert.equal(N.validateStops(route.route,route.stops).length,0);console.log('PASS sequential landmark via selections, destination preservation, repeat IDs, metadata, map/list mixing, destination mode and named safe arrivals');})().catch(e=>{console.error(e);process.exitCode=1;});
