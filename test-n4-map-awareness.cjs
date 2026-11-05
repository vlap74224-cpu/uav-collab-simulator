'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('./dist/core.js'),Traffic=require('./dist/traffic.js'),N4Decision=require('./dist/n4-decision.js');
const source=fs.readFileSync('dist/cockpit.js','utf8'),start=source.indexOf('function ensureTrafficMapOverlay(){'),end=source.indexOf('function raiseConflict(risk){',start),nodes=new Map();
function element(tag,attrs={}){const e={tag,attrs:{...attrs},style:{},children:[],textContent:'',append(...items){for(const item of items){item.parent=this;this.children.push(item);}},insertBefore(item,before){item.parent=this;const i=this.children.indexOf(before);this.children.splice(i<0?this.children.length:i,0,item);},setAttribute(k,v){this.attrs[k]=v;},getScreenCTM(){return {a:scale,b:0};}};if(attrs.id)nodes.set(attrs.id,e);return e;}
let scale=.25,focused;
const map=element('svg',{id:'map'}),drone=element('g',{id:'drone'});map.append(drone);element('aside',{id:'trafficReadout'});
const state={n4Detected:false,altitude:60,status:'running',speed:12,progress:0,route:[[200,200],[1000,200]],traffic:{x:700,y:200,vx:-9,vy:0,time:0,altitude:60}};
const ctx={C,Traffic,N4Decision,state,mission:{id:'N4'},$:id=>nodes.get(id),svg:element,n4Active:()=>true,currentPosition:()=>({x:200,y:200}),window:{focusMissionRoute:points=>{focused=points;}},log(){},toast(){},latestSatContext:null};
vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
ctx.updateTrafficDisplay();const overlay=nodes.get('trafficOverlay');assert.equal(overlay.style.display,'none','hidden until actual detection');
state.n4Detected=true;ctx.updateTrafficDisplay();assert.equal(overlay.style.display,'');assert.equal(overlay.parent,map,'warning overlay survives route/hazards redraw');
const symbol=nodes.get('trafficMapSymbol'),zone=nodes.get('trafficBuffer');assert.equal(zone.attrs.r,40,'physical zone is 40m');assert.equal(zone.attrs.cx,700);assert(symbol.attrs.transform.includes('scale(4)'),'18px focus circle stays readable when map is small');assert(nodes.get('trafficMapLabel').textContent.includes('500m'));
state.traffic.time=10;scale=2;ctx.updateTrafficDisplay();assert.equal(nodes.get('trafficOverlay'),overlay,'telemetry reuses all marker elements');assert.equal(zone.attrs.cx,610,'ring follows actual moving target');assert(symbol.attrs.transform.includes('scale(0.5)'));assert.equal(nodes.get('trafficMapDirection').attrs.transform,'rotate(-90)');
const before=JSON.stringify(state);ctx.n4FocusTraffic();assert.equal(JSON.stringify(state),before,'fitting map never changes aircraft/target state');assert.deepEqual(Array.from(focused[0]),[200,200]);assert.deepEqual(Array.from(focused[1]),[610,200]);assert(focused.some(p=>p[0]===475),'discovery view reserves target movement during the 15-second decision');
state.traffic=null;ctx.updateTrafficDisplay();assert.equal(overlay.style.display,'none','no stale marker after event/mission reset');
console.log('PASS N4 map: actual moving 40m zone, legible constant-screen symbol, persistent DOM, actual heading, discovery framing, no position mutation and reset cleanup');
