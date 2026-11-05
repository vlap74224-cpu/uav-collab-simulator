'use strict';
// Exercise the shipped controls, including takeManual(), without a renderer.
// The fixture supplies DOM events and state; gesture decisions remain in cockpit.js.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const C=require('./dist/core.js');
const source=fs.readFileSync(require.resolve('./dist/cockpit.js'),'utf8');
const start=source.indexOf('const directions='),end=source.indexOf('function manualTick(',start);
assert(start>=0&&end>start,'shipped manual-control extraction markers');
const controls=source.slice(start,end);

function harness(){
 const state={status:'running',route:[[100,100],[500,100]],progress:.25,speed:10,manualSpeed:0,altitude:60,targetAltitude:60,trail:[[100,100],[200,100]],simTime:74};
 const events=[],nodes=new Map(),documentHandlers=new Map(),windowHandlers=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{id,style:{},hidden:false,dataset:{},attributes:{},getBoundingClientRect:()=>({left:0,top:0,width:250,height:250}),setPointerCapture(){},setAttribute(name,value){this.attributes[name]=value;}});return nodes.get(id);};
 const buttons=['forward','back','left','right','turnLeft','turnRight'].map(direction=>Object.assign(node('direction-'+direction),{dataset:{direction}}));
 const add=(map,type,handler)=>{if(!map.has(type))map.set(type,[]);map.get(type).push(handler);};
 const context={
  C,state,mission:{id:'N1',destination:{name:'终点'}},manualInputs:new Map(),joystick:{forward:0,right:0},manualBlocked:false,freeNavigationJob:0,
  $:node,n4Active:()=>false,n2Pending:()=>false,
  currentPosition:()=>({x:200,y:100,heading:90}),snap:()=>C.clone({state}),
  log(type,label,detail){events.push({type,label,detail});},render(){},telemetry(){},toast(){},
  document:{querySelectorAll(selector){assert.equal(selector,'[data-direction]');return buttons;},addEventListener:(type,handler)=>add(documentHandlers,type,handler)},
  window:{worldReady:true,addEventListener:(type,handler)=>add(windowHandlers,type,handler)},
 };
 vm.createContext(context);vm.runInContext(controls,context,{filename:'shipped-manual-controls.js'});
 const pad=node('directionPad');
 const pointer=(x,y,extra={})=>({clientX:x,clientY:y,pointerId:7,button:0,isPrimary:true,pointerType:'touch',target:{closest:()=>null},preventDefault(){},stopPropagation(){},...extra});
 const key=(value,extra={})=>({key:value,repeat:false,ctrlKey:false,altKey:false,metaKey:false,target:{closest:()=>null},preventDefault(){},...extra});
 const dispatch=(map,type,event)=>{for(const handler of map.get(type)||[])handler(event);};
 return{state,events,context,node,pad,buttons,pointer,key,documentHandlers,windowHandlers,dispatch,
  down:(x,y,extra)=>pad.onpointerdown(pointer(x,y,extra)),
  move:(x,y,extra)=>pad.onpointermove(pointer(x,y,extra)),
  up:(x=125,y=125,extra)=>pad.onpointerup(pointer(x,y,extra)),
  takeovers:()=>events.filter(e=>e.type==='manual_takeover').length,
 };
}

// A tap in either the center or outer blank dial must leave the current plan running.
for(const [x,y] of [[125,125],[205,125],[55,90]]){
 const h=harness();h.down(x,y);assert.equal(h.state.status,'running');h.up(x,y);
 assert.equal(h.state.status,'running','tap must not take control');assert.equal(h.takeovers(),0);assert.equal(h.events.length,0);
}
console.log('PASS dial center and outer taps preserve automatic flight');

// Movement must exceed the drag threshold AND leave the center dead zone.
{
 const h=harness();h.down(200,125);h.move(207.9,125);h.up(207.9,125);
 assert.equal(h.state.status,'running');assert.equal(h.takeovers(),0,'sub-8 px pointer noise is not a takeover');
}
{
 const h=harness();h.down(125,125);h.move(134,125);h.up(134,125);
 assert.equal(h.state.status,'running');assert.equal(h.takeovers(),0,'9 px movement is still within the radial center dead zone');
}
{
 const h=harness();h.down(125,125);h.move(137,125);
 assert.equal(h.state.status,'manual');assert.equal(h.takeovers(),1);assert(h.context.joystick.right>0);
 h.move(185,125);assert.equal(h.takeovers(),1,'one drag takes control once');assert(h.context.joystick.right>0);
 h.up(185,125);assert.equal(h.state.status,'manual','releasing an intentional drag keeps manual hover');
 assert.equal(h.state.manualSpeed,0);assert.equal(h.context.joystick.forward,0);assert.equal(h.context.joystick.right,0);
 assert.equal(h.events.filter(e=>e.type==='joystick_start').length,1);
}
{
 const h=harness();h.down(200,125);h.move(208,125);
 assert.equal(h.state.status,'manual','a deliberate 8 px outer drag may take control');h.up(208,125);
}
console.log('PASS drag threshold, radial dead zone, deliberate takeover and release hover');

// Cancel/lost capture/blur must discard a pending gesture, including stale moves.
for(const finish of ['onpointercancel','onlostpointercapture','blur']){
 const h=harness();h.down(125,125);
 if(finish==='blur')h.dispatch(h.windowHandlers,'blur');else h.pad[finish](h.pointer(125,125));
 h.move(190,125);h.up(190,125);
 assert.equal(h.state.status,'running',finish+' must not leave a stale pending takeover');assert.equal(h.takeovers(),0);
 h.down(125,125);h.move(185,125);assert.equal(h.state.status,'manual','a new gesture works after '+finish);
 if(finish==='blur')h.dispatch(h.windowHandlers,'blur');else h.pad[finish](h.pointer(185,125));
 assert.equal(h.context.joystick.right,0);assert.equal(h.state.manualSpeed,0);assert.equal(h.state.status,'manual');
}
{
 const h=harness();h.down(125,125);h.pad.onpointercancel(h.pointer(125,125,{pointerId:99}));h.move(185,125);
 assert.equal(h.state.status,'manual','a different pointer cannot cancel the primary gesture');h.up(185,125);
}
console.log('PASS pending and engaged gestures cancel on pointer loss and blur');

// Explicit arrow buttons and flight keys retain immediate control semantics.
for(const bIndex of [0,1,2,3,4,5]){
 const h=harness(),b=h.buttons[bIndex];b.onpointerdown(h.pointer(125,125));
 assert.equal(h.state.status,'manual');assert.equal(h.takeovers(),1);assert.equal(h.context.manualInputs.size,1);
 b.onpointerup(h.pointer(125,125));assert.equal(h.context.manualInputs.size,0);assert.equal(h.state.status,'manual');
}
for(const value of ['w','a','s','d','q','e']){
 const h=harness();h.dispatch(h.documentHandlers,'keydown',h.key(value));
 assert.equal(h.state.status,'manual');assert.equal(h.takeovers(),1);assert(h.context.manualInputs.has(value));
 h.dispatch(h.documentHandlers,'keyup',h.key(value));assert.equal(h.context.manualInputs.size,0);assert.equal(h.state.status,'manual');
}
{
 const h=harness(),editable={closest:()=>({tagName:'SELECT'})};h.dispatch(h.documentHandlers,'keydown',h.key('w',{target:editable}));
 h.dispatch(h.documentHandlers,'keydown',h.key('d',{ctrlKey:true}));h.dispatch(h.documentHandlers,'keydown',h.key('e',{repeat:true}));
 assert.equal(h.state.status,'running');assert.equal(h.takeovers(),0,'form focus, modifiers and repeat cannot begin takeover');
 h.dispatch(h.windowHandlers,'blur');assert.equal(h.state.status,'running','blur alone cannot stop automatic flight');
}
console.log('PASS explicit arrow/key input remains immediate; focused fields and blur do not take over');
