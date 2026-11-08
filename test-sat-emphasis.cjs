'use strict';
// Shared inline emphasis preserves source facts and the fixed SAT fields.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Emphasis=require('./dist/sat-emphasis'),N1=require('./dist/n1-emphasis'),Labels=require('./dist/sat-labels'),C=require('./dist/core');
const Photo=require('./dist/photo-mission'),N2=require('./dist/n2-status'),Resource=require('./dist/resource-status'),Free=require('./dist/free-route-info');
global.N4Decision=require('./dist/n4-decision');const N4=require('./dist/n4-status');
const vocabulary={action:['目标','计划','状态'],reason:['依据','检查','约束'],projection:['预测','局限','表现']};
const tones=new Set(['target','success','forecast','warning','danger','muted']);
const destination={name:'C · 东北建筑群入口',shortName:'东北建筑群入口',point:[200,0]};
let checked=0;
function parts(text,slot,mission={id:'N2',destination}){
 const before=JSON.stringify(mission),result=Emphasis.segments(text,{slot,mission});
 assert(Array.isArray(result));assert.equal(result.map(x=>x.text).join(''),text,'all original words and units remain unchanged');
 for(const part of result){assert.equal(typeof part.text,'string');assert(!part.tone||tones.has(part.tone));}
 assert.equal(JSON.stringify(mission),before,'rendering cannot mutate task configuration');checked++;return result;
}
function color(text,slot,needle,tone,mission){
 const result=parts(text,slot,mission),at=text.indexOf(needle);assert(at>=0,'needle exists');
 const colors=result.flatMap(x=>Array.from(x.text,()=>x.tone||null)),offset=Array.from(text.slice(0,at)).length;
 assert.deepEqual(colors.slice(offset,offset+Array.from(needle).length),Array.from(needle,()=>tone),slot+' colors '+needle+' as '+tone);
}
function notSafe(text,slot='reason-1',mission){assert(!parts(text,slot,mission).some(x=>x.tone==='success'),'not a verified success: '+text);}

for(const id of ['N2','N3','N4','N5','FREE']){
 const mission={id,destination};
 color('继续前往C · 东北建筑群入口','action-0','C · 东北建筑群入口','target',mission);
 color('91秒至C · 余电80.2%','projection-0','91秒','forecast',mission);
 color('91秒至C · 余电80.2%','projection-0','80.2%','forecast',mission);
 color('原路线0.5m → B128.0m','projection-0','128.0m','forecast',mission);
 color('剩余15秒；未完成选择将自动执行B','action-2','15秒','warning',mission);
 for(const text of ['建筑间隔尚未完成检查','检查结果尚未提供','当前航段建筑检查进行中','暂不可预测','暂无既往执行记录','尚未确认是否满足要求'])notSafe(text,'reason-1',mission);
 for(const slot of Object.keys(vocabulary).flatMap(key=>[0,1,2].map(i=>key+'-'+i)))
  for(const text of ['', '〔缺失〕／⚠\n未知数据', '<img src=x onerror=alert(1)> & <script>evil()</script>'])parts(text,slot,mission);
}
color('最小35.0m / 要求≥21.8m','reason-2','35.0m','success');
color('最小12.0m / 要求≥21.8m','reason-2','12.0m','danger');
color('原路线预计最近间隔0.5m，要求≥40m','reason-1','0.5m','danger',{id:'N4',destination});
color('B最近间隔128.0m，安全要求≥40m；建筑净距22.1m','reason-2','128.0m','success',{id:'N4',destination});
color('原案着陆余电14.97%＜要求15%','reason-2','14.97%','danger',{id:'N5',destination});
color('预计着陆余电17.00% ≥ 要求15%','reason-2','17.00%','success',{id:'N5',destination});
color('更新段最小24.1m / 要求≥21.8m','reason-2','24.1m','success',{id:'FREE',destination});
notSafe('最小建筑间隔35.0m / 要求尚未提供','reason-2');
notSafe('最小建筑间隔尚未核算 / 要求≥21.8m','reason-2');
for(const text of ['未与楼体相交','未进入已知禁区','未发现动态冲突'])
 assert(!parts(text,'reason-1').some(x=>x.tone==='danger'),'a negated risk cannot turn red: '+text);
assert(!parts('无待确认动作','action-2').some(x=>x.tone==='warning'),'a finished action cannot still request confirmation');
notSafe('无法确认是否未穿禁区/实体');
color('当前高度50m / 要求≤60m','reason-2','50m','success');
color('当前高度70m / 要求≤60m','reason-2','70m','danger');

const photoRoute=[[0,0],[120,0],[240,0],[360,0],[480,0],[600,0]],photoTasks=photoRoute.slice(1,5).map((point,i)=>({id:'photo-'+i,targetName:['震旦大厦','未来资产','香格里拉','东方明珠'][i],point}));
const photoMission={id:'N1',route:photoRoute,photoCheckpoints:photoTasks,destination:{name:'B · 湖边巡检点',point:photoRoute.at(-1)}};
for(const [text,slot]of [['待确认航线；下一站震旦大厦','action-1'],['已打卡0/4','action-2'],['已打卡4/4','action-2'],['机体净距采样32.9m / 告警≥21.8m','reason-2'],['预计任务顺利完成率97%','projection-2']]){
 assert.deepEqual(parts(text,slot,photoMission),N1.segments(text,{slot,mission:photoMission}),'N1 retains its published emphasis without regression');
}

// Feed real node presenters through the shared field boundary and tokenizer.
const cases=[];
function fixture(name,mission,state,raw){cases.push({name,mission,state,raw});}
for(const status of ['review','running','photo','complete']){
 const state={status,route:C.clone(photoRoute),progress:status==='complete'?1:status==='photo'?.2:0,altitude:60,targetAltitude:60,speed:12,battery:82,simTime:10,photoEvidence:[]};
 fixture('N1 '+status,photoMission,state,Photo.describe({state,mission:photoMission,position:C.sample(state.route,state.progress),evidence:{leg:{geometry:{status:'done',min:35},zone:{intersects:false},threshold:21.8}}}));
}
const route=[[0,0],[100,0],[200,0]],n2Mission={id:'N2',destination,n2Options:{buildingClearance:21.8},hazard:{x:150,y:0,r:20,margin:5},n2Plan:{name:'B',side:'东侧',original:route,branch:[[50,0],[150,70],[200,0]],check:{valid:true,min:35},choice:'两候选均可行，B增加距离更少'}};
const n2Base={route:C.clone(route),progress:.25,status:'running',simTime:5,speed:12,battery:82,activePlan:'A'},n2Live={speed:12,deviation:1.3,remainingDistance:150,nextWaypoint:{name:'航路点1',distance:50,forecast:{seconds:5}},original:{distance:150,seconds:13,endBattery:81.7},suggested:{distance:250,seconds:23,endBattery:80.7},fullCheck:{status:'done',min:35,collision:null,zoneIntersects:false,segments:2},history:{segments:2},boundary:{seconds:8},draftCheck:{valid:true,pending:false,min:31,errors:[]},executionDistance:50,bypassForecast:{seconds:16}};
for(const [name,overrides]of [
 ['normal',{}],['planning',{noFlyVisible:true,noFlyPlanning:true,flightEvent:{phase:'detected',source:'临时空域通告'}}],
 ['decision',{noFlyVisible:true,flightEvent:{phase:'proposal'},noFlyDecision:{status:'active',seconds:15}}],
 ['editing',{status:'editing',noFlyVisible:true,flightEvent:{phase:'proposal'},noFlyDecision:{status:'active',seconds:8}}],
 ['rejected',{noFlyVisible:true,noFlyDecision:{status:'rejected'}}],
 ['executing',{noFlyVisible:true,flightEvent:{phase:'executing'},noFlyDecision:{status:'resolved',resolvedBy:'accept'},noFlyExecution:{firstDistance:100,joinCheck:{valid:true,min:35},boundaryDistance:300}}],
 ['complete',{status:'complete',noFlyVisible:true,noFlyBypassComplete:true}],
]){const state={...n2Base,...overrides},draft=state.status==='editing'?{route:[[50,0],[150,70],[200,0]],altitude:60,speed:12}:null;fixture('N2 '+name,n2Mission,state,N2.describe({state,mission:n2Mission,position:C.sample(state.route,state.progress),live:n2Live,ready:true,draft}));}
const n4Mission={id:'N4',destination:{name:'D · 建筑巡检点',point:[200,100]},n4Plan:{choice:'当前可通行一侧'}},n4Live={current:478,targetSpeed:9,remaining:{distance:350},next:{name:'航路点3',distance:112},deviation:.4,original:{distance:.5,seconds:18.5},selected:{distance:100,seconds:17},forecast:{seconds:51,endBattery:79.8},check:{valid:true,min:32.1},condition:'未计风况与转弯动力学'};
for(const status of ['review','running','editing','manual','paused','complete','collision']){
 const state={status,route:[[0,0],[100,0],[200,100]],progress:.2,speed:10,battery:80,altitude:60,simTime:74,manualSpeed:0,n4Action:'ai',conflictAlert:status!=='review',n4Decision:status==='editing'?{status:'active',seconds:8}:{status:'resolved',source:'timeout'},n4Execution:{source:'timeout',check:{valid:true,min:24}},trafficMinimum:48};
 fixture('N4 '+status,n4Mission,state,N4.describe({state,mission:n4Mission,live:n4Live,draft:status==='editing'?{route:state.route,speed:10,altitude:60}:null}));
}
const resourceRoute=[[0,0],[120,0],[240,120],[360,0]],resourceMission={id:'N5',destination:{name:'E · 公园内着陆点',point:[360,0]},resourcePrepared:true,resourceTasks:[{id:'P4',point:[120,0],priority:'必需'},{id:'P5',point:[240,120],priority:'可选'}],resourceEnergy:{original:14.97,originalSeconds:90}},resourceEvidence={A:{feasible:true,geometry:{status:'done',min:35},distance:360,seconds:45,cruiseSeconds:40,arrivalBattery:17,endBattery:16.5},remaining:{distance:300,seconds:40,cruiseSeconds:35,arrivalBattery:17,endBattery:16.5},threshold:21.8};
for(const [name,overrides,missionOverride]of [
 ['normal',{},{}],['planning',{resourceDetected:true,resourcePlanning:true},{}],
 ['decision',{status:'review',resourceDetected:true,resourceCompleted:['P4'],resourceDecision:{status:'active',seconds:20}},{candidateRoute:[[120,0],[360,0]]}],
 ['executing',{resourceDetected:true,resourceCompleted:['P4'],resourceCancelled:['P5']},{}],
 ['landing',{landing:{targetAltitude:0},resourceCompleted:['P4'],resourceCancelled:['P5'],resourceLandingCheck:{valid:true,atE:true}},{}],
 ['landed',{status:'complete',landed:true,resourceCompleted:['P4'],resourceCancelled:['P5'],resourceResult:{duration:120,prediction:{at:0,seconds:110,endBattery:17}},resourceLandingCheck:{valid:true}},{}],
]){const state={route:C.clone(resourceRoute),progress:.1,status:'running',altitude:60,battery:20,speed:10,simTime:30,resourceCompleted:[],resourceCancelled:[],...overrides},mission={...resourceMission,...missionOverride};fixture('N5 '+name,mission,state,Resource.describe({state,mission,evidence:resourceEvidence,landingForecast:{seconds:20,cost:.2}}));}
for(const [name,state,mission]of [
 ['manual',{status:'manual',freeFlight:true,freeViaPoints:[],freeVisitedViaIds:[],route:[],progress:0,altitude:60,speed:12,battery:82},null],
 ['planning',{status:'review',freeFlight:true,freePlanning:true,freeViaPoints:[{id:'v1',name:'金茂大厦'}],freeVisitedViaIds:[],freeMapDestination:{name:'东方明珠',point:[200,0]},route:[[0,0],[200,0]],progress:0,altitude:60,speed:12,battery:82},{id:'FREE',destination:{name:'东方明珠',point:[200,0]},viaStops:[{id:'v1',name:'金茂大厦',point:[100,0]}]}],
])fixture('FREE '+name,mission||{id:'FREE'},state,Free.describe({state,mission,position:{x:0,y:0},ready:false}));

function leaves(value){return value?.kind==='sat-field-values'?value.items.flatMap(leaves):[value];}
for(const test of cases){
 const before=JSON.stringify(test.raw),levels=Labels.normalize(test.raw,{mission:test.mission,state:test.state,status:test.state.status});
 for(const [level,,rows]of levels){assert.deepEqual(rows.map(row=>row[0]),vocabulary[level]);rows.forEach(([,value],i)=>leaves(value).forEach(leaf=>{if(typeof leaf==='string')parts(leaf,level+'-'+i,test.mission);}));}
 assert.equal(JSON.stringify(test.raw),before,test.name+' original presenter output is unchanged');test.levels=levels;
}

class DomNode{
 constructor(tag,text='',attrs={}){this.tag=tag;this.children=[];this.attributes={};this.dataset={};this.parentElement=null;this._text=String(text??'');this.style={};for(const [key,value]of Object.entries(attrs))this.setAttribute(key,value);}
 setAttribute(key,value){this.attributes[key]=String(value);if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);}
 append(...nodes){for(const node of nodes){const child=typeof node==='string'?new DomNode('#text',node):node;child.parentElement=this;this.children.push(child);}}
 replaceChildren(...nodes){for(const child of this.children)child.parentElement=null;this.children=[];this._text='';this.append(...nodes);}
 get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
 set textContent(value){this.replaceChildren();this._text=String(value??'');}
 matches(selector){if(selector.startsWith('.'))return(this.attributes.class||'').split(/\s+/).includes(selector.slice(1));const attribute=selector.match(/^\[([^=]+)="([^"]*)"\]$/);if(attribute)return this.attributes[attribute[1]]===attribute[2];return this.tag===selector;}
 querySelectorAll(selector){const out=[];for(const child of this.children){if(child.matches(selector))out.push(child);out.push(...child.querySelectorAll(selector));}return out;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 get innerHTML(){throw Error('No HTML source interpolation');}
 set innerHTML(value){throw Error('No HTML source interpolation');}
}
const cockpit=fs.readFileSync('dist/cockpit.js','utf8');
const extract=(start,end)=>{assert(cockpit.includes(start)&&cockpit.includes(end));return cockpit.slice(cockpit.indexOf(start),cockpit.indexOf(end,cockpit.indexOf(start)+start.length));};
const rendererCode=extract('function renderFreeRouteFlow(','function refreshFreeSatValues(')+extract('function renderPhotoFlow(','function renderCards(')+extract('function renderCards(','function statusLabel(');
const refreshCode=extract('function refreshSatValues(','setInterval(refreshSatValues');
let rendered=0;
for(const test of cases){
 let baseline;
 for(const condition of ['action','reason','projection']){
  const root=new DomNode('aside','',{class:'sat-compact'}),cards=new DomNode('div','',{id:'satCards'}),badge=new DomNode('span'),nodes={satCards:cards,satState:badge};root.append(cards,badge);
  const ctx={state:{...test.state,freeFlight:false},mission:test.mission,session:{condition},window:{SatEmphasis:Emphasis,N1Emphasis:N1,SatLabels:Labels,worldReady:true},document:{querySelector:selector=>root.matches(selector)?root:root.querySelector(selector)},$:id=>nodes[id]||(nodes[id]=new DomNode('button')),el:(tag,text,attrs)=>new DomNode(tag,text,attrs),PhotoMission:Photo,latestSatContext:{evidence:{}},eventLog(){},n4Active:()=>false,n2RenderNotice(){},n2SyncButtons(){},statusLabel:()=>test.state.status,refreshSatValues(){}};
  ctx.levels=test.levels;ctx.satInformation=()=>ctx.levels;
  vm.createContext(ctx);vm.runInContext(rendererCode,ctx);ctx.renderCards();
  assert.deepEqual(root.querySelectorAll('.sat-label').map(node=>node.textContent),Object.values(vocabulary).flat(),test.name+' has the same nine field labels');
  for(const [,,rows]of test.raw)for(const [,value]of rows)for(const leaf of leaves(value))if(typeof leaf==='string')assert(root.textContent.includes(leaf),test.name+' retains '+leaf);
  const colored=root.querySelectorAll('span').filter(node=>/(?:sat|n1)-key-/.test(node.attributes.class||''));
  const serialized=JSON.stringify(colored.map(node=>({text:node.textContent,class:node.attributes.class})));
  if(baseline===undefined)baseline=serialized;else assert.equal(serialized,baseline,test.name+' emphasis identical in the three experimental conditions');
  const row=root.querySelector('[data-sat-value="projection-0"]'),payload='<img src=x onerror=alert(1)>；15秒 · 80.2%';ctx.renderSatFieldValue(row,payload);
  assert.equal(row.textContent,payload);assert.equal(row.querySelectorAll('img').length,0);
  const unchanged=row.children.slice();ctx.renderSatFieldValue(row,payload);assert.deepEqual(row.children,unchanged,'ordinary refresh retains inline nodes');
  ctx.renderSatFieldValue(row,'16秒 · 79.9%');assert(row.textContent.includes('16秒'));assert(!row.textContent.includes('15秒'),'old forecast is not retained');
  const same=test.mission.id==='N1'?'机体净距采样12.0m / 告警≥21.8m':'最小12.0m / 要求≥21.8m';row.dataset.satValue='reason-2';ctx.renderSatFieldValue(row,same);assert(row.querySelectorAll('span').some(n=>/(?:sat|n1)-key-danger/.test(n.attributes.class||'')),'a below-threshold check is visibly red');
  row.dataset.satValue='projection-0';ctx.renderSatFieldValue(row,same);assert(!row.querySelectorAll('span').some(n=>/(?:sat|n1)-key-danger/.test(n.attributes.class||'')),'the same values in a forecast slot are not an actual check');
  const refreshed=test.raw.map(([key,title,rows])=>[key,title,rows.map(([label,value])=>[label,typeof value==='string'?value+'〔更新〕':value])]);ctx.levels=Labels.normalize(refreshed,{state:ctx.state,mission:ctx.mission});
  vm.runInContext(refreshCode,ctx);ctx.refreshSatValues();assert.deepEqual(root.querySelectorAll('.sat-label').map(node=>node.textContent),Object.values(vocabulary).flat());assert(root.textContent.includes('〔更新〕'));
  if(test.mission.id==='N1')assert.equal(root.querySelectorAll('.photo-flow-step').length,4,'N1 goal flow remains four configured stops');
  rendered++;
 }
}
// Comparisons carry predictions rather than an unconditional safety verdict.
{
 const ctx={mission:{id:'N4',destination},window:{SatEmphasis:Emphasis,N1Emphasis:N1},el:(tag,text,attrs)=>new DomNode(tag,text,attrs)};vm.createContext(ctx);vm.runInContext(rendererCode.slice(0,rendererCode.indexOf('function renderPhotoFlow(')),ctx);
 const node=new DomNode('div','',{'data-sat-value':'projection-0'});ctx.renderSatFieldValue(node,{original:'0.5m',suggested:'48.3m',label:'建议方案B'});
 assert(node.textContent.includes('0.5m')&&node.textContent.includes('48.3m'));
 assert(node.querySelectorAll('span').some(n=>/sat-key-forecast/.test(n.attributes.class||''))||node.querySelectorAll('b').some(n=>/sat-key-forecast/.test(n.attributes.class||'')),'comparison prediction values are blue');
 const free=new DomNode('div');ctx.mission={id:'FREE',destination};ctx.renderFreeRouteFlow(free,{kind:'free-route-flow',items:[{id:'origin',label:'当前位置'},{id:'v1',label:'金茂大厦',tag:'新增'},{id:'destination',label:'东方明珠'}]});
 const stops=free.querySelectorAll('.free-flow-stop');assert.equal(stops.length,3);assert(!/sat-key-target/.test(stops[0].attributes.class||''));assert(/sat-key-warning/.test(stops[1].attributes.class||''),'the newly added stop stays visibly distinct');assert(/sat-key-target/.test(stops[2].attributes.class||''),'the configured final destination is highlighted');
 const value=new DomNode('div','',{'data-sat-value':'projection-0'});ctx.mission=photoMission;ctx.renderSatFieldValue(value,'15秒 · 80.2%');assert(value.querySelectorAll('.n1-key-forecast').length>0);ctx.mission={id:'N4',destination};ctx.renderSatFieldValue(value,'15秒 · 80.2%');assert.equal(value.querySelectorAll('.n1-key-forecast').length,0);assert(value.querySelectorAll('.sat-key-forecast').length>0,'changing the node invalidates the old color cache');
}
// The expanded editing workspaces share the same inline renderer and slots.
for(const [file,method,end,prefix,nodeId]of [['n2-runtime.js','n2RenderNotice','n2SyncButtons','n2-edit','N2'],['n4-runtime.js','n4RenderEditor','n4PresentationReady','n4','N4']]){
 const source=fs.readFileSync('dist/'+file,'utf8'),body=source.slice(source.indexOf('function '+method+'('),source.indexOf('function '+end+'(')),box=new DomNode('section'),mission={id:nodeId,destination},state={status:'editing',noFlyVisible:true};
 const raw=[['action','L1',[['目标','C · 东北建筑群入口'],['路线','正在修改路线B'],['状态','剩余8秒']]],['reason','L2',[['依据','按当前路线检查'],['检查','未穿已知禁区'],['约束','最小35.0m / 要求≥21.8m']]],['projection','L3',[['抵达','23秒 · 余电80.7%'],['局限','未计风况'],['记录','暂无已完成航段记录']]]];
 for(const [key,labels]of Object.entries(vocabulary)){
  box.append(new DomNode('h2','',{[prefix==='n2-edit'?'data-n2-edit-heading':'data-n4-heading']:key}));
  labels.forEach((_,i)=>box.append(new DomNode('span','',{[prefix==='n2-edit'?'data-n2-edit-label':'data-n4-label']:key+'-'+i}),new DomNode('span','',{[prefix==='n2-edit'?'data-n2-edit-value':'data-n4-value']:key+'-'+i})));
 }
 const ctx={state,mission,draft:{},window:{SatLabels:Labels,SatEmphasis:Emphasis,worldReady:true},$:()=>box,currentPosition:()=>({x:0,y:0}),N2Decision:{describe:()=>raw},N4Status:{describe:()=>raw},n4Active:()=>true,el:(tag,text,attrs)=>new DomNode(tag,text,attrs)};vm.createContext(ctx);vm.runInContext(rendererCode.slice(0,rendererCode.indexOf('function renderPhotoFlow('))+body,ctx);ctx[method]();
 assert.equal(box.hidden,false);assert.equal(box.querySelectorAll('.sat-key-warning').some(n=>n.textContent.includes('8秒')),true,file+' edit countdown is highlighted');assert(box.querySelectorAll('.sat-key-success').some(n=>n.textContent.includes('35.0m')),file+' edit checks are highlighted');
 const values=box.querySelectorAll('span').filter(n=>n.dataset.satValue);assert.equal(values.length,9);assert.deepEqual(values.map(n=>n.dataset.satValue),Object.keys(vocabulary).flatMap(key=>[0,1,2].map(i=>key+'-'+i)));
}
const html=fs.readFileSync('dist/index.html','utf8'),sharedScript=html.indexOf('sat-emphasis.js');assert(sharedScript>=0&&sharedScript<html.indexOf('src="cockpit.js'),'shared helper loads before the cockpit');assert(html.includes('sat-emphasis.css'));
const css=fs.readFileSync('dist/sat-emphasis.css','utf8').replace(/\/\*[\s\S]*?\*\//g,'');for(const body of css.matchAll(/\{([^}]*)\}/g))for(const rule of body[1].split(';').filter(x=>x.trim()))assert(/^\s*color\s*:/.test(rule),'emphasis CSS cannot alter geometry, typography or animation');
console.log('PASS '+checked+' shared emphasis facts, '+cases.length+' actual node/stage presentations, and '+rendered+' rendered condition variants');
console.log('PASS exact source text, real threshold colors, N1 compatibility, nine fixed fields, safe inline rendering, refresh/cache, route flow and comparison predictions');
