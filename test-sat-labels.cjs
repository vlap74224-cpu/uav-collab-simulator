'use strict';
// Every node and phase uses the same three visible fields in each SAT layer.
// Values may move into their semantic field, but no source fact or object is lost.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('./dist/core'),Labels=require('./dist/sat-labels');
const Photo=require('./dist/photo-mission'),N2=require('./dist/n2-status');
global.N4Decision=require('./dist/n4-decision');
const N4=require('./dist/n4-status'),Resource=require('./dist/resource-status');
const headings={action:'L1 当前目标与行动',reason:'L2 决策依据与约束',projection:'L3 预期结果与局限'};
const fields={action:['目标','计划','状态'],reason:['依据','检查','约束'],projection:['预测','局限','表现']};
let verified=0;
function leaves(value){return value?.kind==='sat-field-values'?value.items.flatMap(leaves):[value];}
function retainedLeaves(value){return value?.kind==='sat-field-values'?(value.generated?[]:value.items.flatMap(retainedLeaves)):[value];}
function contents(levels,key,label){return leaves(levels.find(x=>x[0]===key)[2].find(x=>x[0]===label)[1]);}
function assertRetained(name,source,result){
 const old=source.flatMap(([,value])=>retainedLeaves(value)),next=result.flatMap(([,value])=>retainedLeaves(value));
 for(const value of new Set(old))assert.equal(next.filter(x=>x===value).length,old.filter(x=>x===value).length,name+': retain each original value/reference exactly once');
 for(const [,value] of result){const items=leaves(value),positions=items.map(item=>old.indexOf(item)).filter(index=>index>=0);assert.deepEqual(positions,positions.slice().sort((a,b)=>a-b),name+': source ordering is preserved inside a fixed field');}
}
function check(name,raw,options={}){
 const before=JSON.stringify(raw),result=Labels.normalize(raw,options);
 assert.equal(result.length,raw.length,name+': preserve the three section boundaries');
 raw.forEach(([key,,items],i)=>{
  assert.equal(result[i][0],key,name+': preserve the SAT level key');
  assert.equal(result[i][1],headings[key],name+': stable level title');
  assert.equal(result[i][2].length,3,name+': exactly three fixed fields per level');
  assert.deepEqual(result[i][2].map(x=>x[0]),fields[key],name+': identical visible field names and order across nodes and phases');
  assertRetained(name+' '+key,items,result[i][2]);
 });
 assert.equal(JSON.stringify(raw),before,name+': do not mutate the original presentation');
 assert.deepEqual(Labels.normalize(result,options),result,name+': normalisation is idempotent');
 verified++;return result;
}
function row(levels,key,original,index=0){return levels.find(x=>x[0]===key)[2].filter(x=>x[0]===original)[index];}

// Mixed ordering is intentional. L3 records do not occupy a fixed row.
const flow={kind:'photo-flow',steps:[{id:'a',name:'震旦大厦',state:'current'}]},comparison={original:'0.5 m',suggested:'48.3 m',label:'建议方案B'};
const mixed=[['action','旧标题',[['目标','C点'],['路线','当前位置→绕行点→C'],['进展','剩余350m']]],['reason','旧标题',[['顺序','按任务配置顺序'],['检查','第1–6段未穿已知禁区'],['建筑','净距24.1m / 要求≥21.8m'],['依据','当前航段满足通行要求']]],['projection','旧标题',[['抵达','91秒至C · 余电80.2%'],['记录','此前已完成2段飞行'],['局限','未计风况']]]];
const canonical=check('mixed N1/N2 row order',mixed);
assert.equal(canonical[0][2][0][0],'目标');
assert(contents(canonical,'action','计划').includes(mixed[0][2][1][1]));
assert(contents(canonical,'projection','预测').includes(mixed[2][2][0][1]));
assert(contents(canonical,'projection','表现').includes(mixed[2][2][1][1]));
assert(contents(canonical,'projection','局限').includes(mixed[2][2][2][1]));
const objectOutput=check('preserve flow and comparison objects',[['action','L1',[['任务',flow],['打卡','已打卡0/4'],['动作','正在前往震旦大厦']]],['reason','L2',[['空域','已检全路线'],['建筑','最小净距24.1m'],['取舍','东侧距离更短']]],['projection','L3',[['方案对比',comparison],['条件','按计划速度'],['表现','暂无既往记录']]]]);
assert(contents(objectOutput,'action','目标').includes(flow),'the configured four-point flow remains the goal');
assert(contents(objectOutput,'projection','预测').includes(comparison),'comparison object identity survives semantic grouping');
const completed=check('completed N1 prediction audit',[['action','L1',[['目标','已到B']]],['reason','L2',[['记录','4/4记录已保存']]],['projection','L3 预测核对',[['核对','预计122.7秒 / 实际122.7秒'],['余电','终点余电预计79.4% / 实际79.4%'],['表现','累计4段实际记录']]]],{status:'complete'});
assert.deepEqual(completed[2][2].map(x=>x[0]),fields.projection,'completion cannot rename or remove the fixed L3 fields');
const manual=check('manual forecast invalidation',[['action','L1',[['行动','手动接管']]],['reason','L2',[['恢复','恢复前重新检查']]],['projection','L3',[['原预测','旧路线预测已停止适用'],['局限','操控会改变运动']]]],{status:'manual'});
assert(contents(manual,'projection','局限').includes('旧路线预测已停止适用'),'invalidated old forecast belongs to limitations, not a live arrival forecast');
check('unknown source labels use SAT categories, not leaked legacy labels',Object.entries(headings).map(([key,title])=>[key,title,[['未来扩展字段','该字段的原始内容']]]));

// Exact shape of the reported screenshot: both execution progress and track
// deviation used to become 状态, while the two checks both became 检查.
const screenshot=[
 ['action',headings.action,[['行动','正在沿路线A前往建筑巡检点'],['进展','剩余1013m · 当前执行中'],['表现','航迹偏差0.0m']]],
 ['reason',headings.reason,[['判断','当前检查未发现需要避让的动态冲突'],['航段','当前航线已检查，最小建筑间隔22.4m（要求≥16.9m）'],['依据','按既定任务顺序继续前往目标点']]],
 ['projection',headings.projection,[['预计','102秒后到建筑巡检点 · 余电80.3%'],['局限','仅依据当前已知环境；未计风况及转弯动力学'],['表现','此前暂无本次避让记录']]],
];
const screenshotOutput=check('reported N4 screenshot uses the fixed schema',screenshot,{status:'review',state:{status:'review'},mission:{id:'N4',destination:{name:'D · 建筑巡检点'}}});
assert(contents(screenshotOutput,'action','目标').some(value=>typeof value==='string'&&value.includes('建筑巡检点')),'missing explicit goal uses the actual configured destination');
assert(contents(screenshotOutput,'action','计划').includes(screenshot[0][2][0][1]));
assert(contents(screenshotOutput,'action','状态').includes(screenshot[0][2][1][1]));
assert(contents(screenshotOutput,'action','状态').includes(screenshot[0][2][2][1]));

// Actual N1 presenter: task configuration, arrival, save and completion.
const photoRoute=[[0,0],[120,0],[240,0],[360,0],[480,0],[600,0]],photoTasks=photoRoute.slice(1,5).map((point,i)=>({id:'photo-'+i,targetName:['震旦大厦','未来资产','香格里拉','东方明珠'][i],point,photoRequirement:'人工确认构图'}));
const photoMission={id:'N1',route:photoRoute,photoCheckpoints:photoTasks,destination:{name:'B · 湖边巡检点',point:photoRoute.at(-1)}};
for(const status of ['review','running','paused','manual','editing','photo','complete']){
 const state={status,route:C.clone(photoRoute),progress:status==='complete'?1:status==='photo'?.2:0,altitude:60,targetAltitude:60,verticalSpeed:0,speed:12,battery:82,simTime:status==='complete'?122.7:10,photoEvidence:status==='complete'?photoTasks.map(t=>({checkpointId:t.id,status:'saved',imageKey:t.id,savedAt:'saved'})):[]};
 const raw=Photo.describe({state,mission:photoMission,position:C.sample(state.route,state.progress),evidence:{leg:{geometry:{status:'done',min:35},zone:{intersects:false},threshold:21.8}}}),out=check('N1 '+status,raw,{status,state,mission:photoMission});
 if(status==='review'){assert(contents(out,'action','目标').includes(raw[0][2][0][1]),'N1 screenshot flow is visibly labelled 目标');assert(contents(out,'action','计划').includes(raw[0][2][2][1]),'N1 next action remains under 计划');assert(contents(out,'action','状态').includes(raw[0][2][1][1]),'N1 check-in count remains under 状态');}
}

// Actual N2 normal, planning, decision, edit, rejection, bypass and completion.
const route=[[0,0],[100,0],[200,0]],n2Mission={id:'N2',destination:{name:'C · 东北入口',point:[200,0]},n2Options:{buildingClearance:21.8},hazard:{x:150,y:0,r:20,margin:5},n2Plan:{name:'B',side:'东侧',original:route,branch:[[50,0],[150,70],[200,0]],check:{valid:true,min:35},choice:'两候选均可行，B增加距离更少'}};
const n2Base={route:C.clone(route),progress:.25,status:'running',simTime:5,speed:12,battery:82,activePlan:'A'},n2Live={speed:12,deviation:1.3,remainingDistance:150,nextWaypoint:{name:'航路点1',distance:50,forecast:{seconds:5}},original:{distance:150,seconds:13,endBattery:81.7},suggested:{distance:250,seconds:23,endBattery:80.7},fullCheck:{status:'done',min:35,collision:null,zoneIntersects:false,segments:2},history:{segments:2},boundary:{seconds:8},draftCheck:{valid:true,pending:false,min:31,errors:[]},executionDistance:50,bypassForecast:{seconds:16}};
const n2Cases=[
 ['normal',{}],['planning',{noFlyVisible:true,noFlyPlanning:true,flightEvent:{phase:'detected',source:'临时空域通告'}}],
 ['decision',{noFlyVisible:true,flightEvent:{phase:'proposal'},noFlyDecision:{status:'active',seconds:8}}],
 ['editing',{status:'editing',noFlyVisible:true,flightEvent:{phase:'proposal'},noFlyDecision:{status:'active',seconds:8}}],
 ['rejected',{noFlyVisible:true,noFlyDecision:{status:'rejected'}}],
 ['executing',{noFlyVisible:true,flightEvent:{phase:'executing'},noFlyDecision:{status:'resolved',resolvedBy:'accept'},noFlyExecution:{firstDistance:100,joinCheck:{valid:true,min:35},boundaryDistance:300}}],
 ['bypass',{noFlyVisible:true,noFlyBypassComplete:true,flightEvent:{phase:'executing'},noFlyPostCheck:{valid:true,min:33}}],
 ['complete',{status:'complete',noFlyVisible:true,noFlyBypassComplete:true}],
];
for(const [name,overrides] of n2Cases){const state={...n2Base,...overrides},draft=state.status==='editing'?{route:[[50,0],[150,70],[200,0]],altitude:60,speed:12}:null;check('N2 '+name,N2.describe({state,mission:n2Mission,position:C.sample(state.route,state.progress),live:n2Live,ready:true,draft}),{status:state.status,state,mission:n2Mission});}
{
 const state={...n2Base,status:'review',progress:0},raw=N2.describe({state,mission:n2Mission,position:C.sample(state.route,0),live:n2Live,ready:true}),out=check('reported N2 waiting-confirmation screenshot',raw,{status:state.status,state,mission:n2Mission});
 assert(contents(out,'action','目标').includes(raw[0][2][0][1]));assert(contents(out,'action','计划').includes(raw[0][2][1][1]));assert(contents(out,'action','状态').includes(raw[0][2][2][1]));
}
const Legacy=require('./dist/sat-information'),n3State={route:[[0,0],[200,0]],status:'review',speed:12,altitude:60,battery:82,progress:0};
check('N3 legacy static constraint',Legacy.describe({mission:{id:'N3',destination:{name:'C',point:[200,0]}},state:n3State,position:{x:0,y:0},ready:false}),{status:'review',state:n3State,mission:{id:'N3',destination:{name:'C',point:[200,0]}}});

// Actual N4 presenter, including old execution flags while manual/paused.
const n4Mission={id:'N4',destination:{name:'D · 建筑巡检点',point:[200,100]},n4Plan:{choice:'当前可通行一侧'}},n4Live={current:478,targetSpeed:9,remaining:{distance:350},next:{name:'航路点3',distance:112},deviation:.4,original:{distance:.5,seconds:18.5},selected:{distance:100,seconds:17},forecast:{seconds:51,endBattery:79.8},check:{valid:true,min:32.1},condition:'未计风况与转弯动力学'};
for(const status of ['review','running','editing','manual','paused','complete','collision']){
 const state={status,route:[[0,0],[100,0],[200,100]],progress:.2,speed:10,battery:80,altitude:60,simTime:74,manualSpeed:0,n4Action:'ai',conflictAlert:status!=='review',n4Decision:status==='editing'?{status:'active',seconds:8}:{status:'resolved',source:'timeout'},n4Execution:{source:'timeout',check:{valid:true,min:24}},trafficMinimum:48};
 check('N4 '+status,N4.describe({state,mission:n4Mission,live:n4Live,draft:status==='editing'?{route:state.route,speed:10,altitude:60}:null}),{status,state,mission:n4Mission});
}

// Actual N5 energy/landing presenter; two predictions are not mistaken for
// prediction/history just because their row positions differ from N1.
const resourceRoute=[[0,0],[120,0],[240,120],[360,0]],resourceMission={id:'N5',destination:{name:'E · 公园内着陆点',point:[360,0]},resourcePrepared:true,resourceTasks:[{id:'P4',point:[120,0],priority:'必需'},{id:'P5',point:[240,120],priority:'可选'}],resourceEnergy:{original:14.97,originalSeconds:90}},resourceEvidence={A:{feasible:true,geometry:{status:'done',min:35},distance:360,seconds:45,cruiseSeconds:40,arrivalBattery:17,endBattery:16.5},remaining:{distance:300,seconds:40,cruiseSeconds:35,arrivalBattery:17,endBattery:16.5},threshold:21.8};
const resourceBase={route:C.clone(resourceRoute),progress:.1,status:'running',altitude:60,battery:20,speed:10,simTime:30,resourceCompleted:[],resourceCancelled:[]};
for(const [name,overrides,missionOverride] of [
 ['normal',{},{}],['planning',{resourceDetected:true,resourcePlanning:true},{}],
 ['decision',{status:'review',resourceDetected:true,resourceCompleted:['P4'],resourceDecision:{status:'active',seconds:20}},{candidateRoute:[[120,0],[360,0]]}],
 ['executing',{resourceDetected:true,resourceCompleted:['P4'],resourceCancelled:['P5']},{}],
 ['landing',{landing:{targetAltitude:0},resourceCompleted:['P4'],resourceCancelled:['P5'],resourceLandingCheck:{valid:true,atE:true}},{}],
 ['landed',{status:'complete',landed:true,resourceCompleted:['P4'],resourceCancelled:['P5'],resourceResult:{duration:120,prediction:{at:0,seconds:110,endBattery:17}},resourceLandingCheck:{valid:true}},{}],
]){const state={...resourceBase,...overrides},mission={...resourceMission,...missionOverride},raw=Resource.describe({state,mission,evidence:resourceEvidence,landingForecast:{seconds:20,cost:.2}}),out=check('N5 '+name,raw,{status:state.status,landed:!!state.landed,state,mission});if(name==='normal'){assert(contents(out,'projection','预测').includes(raw[2][2][0][1]),'completion time belongs to the fixed prediction field');assert(contents(out,'projection','预测').includes(raw[2][2][1][1]),'arrival charge also belongs to prediction, without stealing the limitations/history field');}}

// Browser delivery: same pure helper is available to the real cockpit.
const source=fs.readFileSync(require.resolve('./dist/sat-labels'),'utf8'),browser={};vm.createContext(browser);vm.runInContext(source,browser);
assert.equal(typeof browser.SatLabels?.normalize,'function');
assert.equal(JSON.stringify(browser.SatLabels.normalize(mixed)),JSON.stringify(Labels.normalize(mixed)));
const html=fs.readFileSync('dist/index.html','utf8'),labelScript=html.indexOf('sat-labels.js'),cockpitScript=html.indexOf('src="cockpit.js');
assert(labelScript>=0&&cockpitScript>labelScript,'load the shared vocabulary before the cockpit starts');

// Execute the real delivery boundaries. Active N4 and free flight bypass the
// generic SatInformation presenter, so a helper-only test would miss them.
const cockpit=fs.readFileSync('dist/cockpit.js','utf8');
const line=name=>cockpit.slice(cockpit.indexOf('function '+name+'(')).split('\n')[0];
const rawFree=cockpit.slice(cockpit.indexOf('function rawFreeSatInformation('),cockpit.indexOf('function renderFreeRouteFlow('));
const boundaryCode=[line('satInformation'),line('rawSatInformation'),line('freeSatInformation'),rawFree].join('\n');
for(const node of ['N1','N2','N3','N4','N5'])for(const status of ['running','complete']){
 const value=status==='complete'?completed:mixed,mission={id:node},state={status,altitude:60,speed:12},options={status,state,mission};
 const ctx={state,mission,draft:null,window:{SatLabels:Labels,worldReady:false},lastEvidenceMission:mission,routeInspector:null,satCheckErrors:[],latestSatContext:null,currentPosition:()=>({x:0,y:0}),RouteEvidence:{build:()=>({})},TrafficComparison:{compare:()=>({})},SatInformation:{describe:()=>value},N4Status:{describe:()=>value},n4Active:()=>node==='N4',n4RefreshSnapshot:()=>({}),n2RefreshSnapshot:()=>({}),syncResourceButtons(){},n2PresentationReady(){}};
 vm.createContext(ctx);vm.runInContext(boundaryCode,ctx);
 let first;
 for(const condition of ['action','reason','projection']){
  ctx.session={condition,participant:'test'};
  const result=ctx.satInformation(),expected=Labels.normalize(value,options);
  assert.equal(JSON.stringify(result),JSON.stringify(expected),node+' actual main boundary under '+condition);
  for(let i=0;i<result.length;i++){assert.deepEqual(Array.from(result[i][2],row=>row[0]),fields[result[i][0]]);assertRetained(node+' main boundary '+condition,value[i][2],result[i][2]);}
  if(first)assert.equal(JSON.stringify(result),first,'experimental emphasis cannot alter fields or positions');else first=JSON.stringify(result);
 }
}
{
 const freeFlow={kind:'free-route-flow',items:[{id:'origin',label:'当前位置'},{id:'destination',label:'酒店'}]},mission={id:'FREE'},state={status:'review',freeFlight:true,altitude:60,speed:12},value=[['action','L1',[['路线',freeFlow],['任务','经过2个点到达酒店'],['状态','尚未执行']]],['reason','L2',[['选择','按指定顺序'],['检查','未穿禁区'],['间隔','净距35m']]],['projection','L3',[['抵达','预计35秒抵达'],['局限','未计风况'],['记录','暂无既往记录']]]];
 const ctx={state,mission,draft:null,window:{SatLabels:Labels,worldReady:false},lastEvidenceMission:mission,routeInspector:null,satCheckErrors:[],records:[],session:{participant:'test'},currentPosition:()=>({x:0,y:0}),FreeRouteInfo:{describe:()=>value}};
 vm.createContext(ctx);vm.runInContext(boundaryCode,ctx);
 for(const result of [ctx.freeSatInformation(),ctx.satInformation()]){
  assert.equal(JSON.stringify(result),JSON.stringify(Labels.normalize(value,{status:'review',state,mission})),'free preview and main dispatch use identical labels');
  assert(contents(result,'action','计划').includes(freeFlow),'multiple presentation boundaries preserve the same route-flow object');
  assert.equal(result[1][2][2][0],'约束','a second normalisation must not erase the canonical constraint category');
 }
}
for(const [file,method,end,prefix] of [['n2-runtime.js','n2RenderNotice','n2SyncButtons','n2-edit'],['n4-runtime.js','n4RenderEditor','n4PresentationReady','n4']]){
 const src=fs.readFileSync('dist/'+file,'utf8'),body=src.slice(src.indexOf('function '+method+'('),src.indexOf('function '+end+'(')),nodes=new Map(),box={hidden:false,querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{textContent:''});return nodes.get(selector);}},value=[mixed[0],[mixed[1][0],mixed[1][1],mixed[1][2].slice(0,3)],mixed[2]],state={status:'editing',noFlyVisible:true},ctx={state,mission:{id:file.startsWith('n2')?'N2':'N4'},draft:{},window:{worldReady:true,SatLabels:Labels},$:()=>box,currentPosition:()=>({x:0,y:0}),N2Decision:{describe:()=>value},N4Status:{describe:()=>value},n4Active:()=>true};
 vm.createContext(ctx);vm.runInContext(body,ctx);ctx[method]();assert.equal(box.hidden,false);
 for(const [key,title,items] of Labels.normalize(value,{status:'editing',state,mission:ctx.mission})){
  const headingAttr=prefix==='n2-edit'?'data-n2-edit-heading':'data-n4-heading',labelAttr=prefix==='n2-edit'?'data-n2-edit-label':'data-n4-label',valueAttr=prefix==='n2-edit'?'data-n2-edit-value':'data-n4-value';
  assert.equal(nodes.get('['+headingAttr+'="'+key+'"]')?.textContent,title,file+' editor heading');
  items.forEach(([label,value],i)=>{assert.equal(nodes.get('['+labelAttr+'="'+key+'-'+i+'"]')?.textContent,label,file+' editor label');assert.strictEqual(nodes.get('['+valueAttr+'="'+key+'-'+i+'"]')?.textContent,Labels.text(value),file+' editor content');});
 }
}
// Exercise the shipped renderer, not just its input data. Previously N1's
// photo-flow row omitted its label even when the data schema looked uniform.
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
}
const extract=(start,end)=>cockpit.slice(cockpit.indexOf(start),cockpit.indexOf(end,cockpit.indexOf(start)+start.length));
const renderCode=extract('function renderFreeRouteFlow(','function refreshFreeSatValues(')+extract('function renderPhotoFlow(','function renderCards(')+extract('function renderCards(','function statusLabel(');
const refreshCode=extract('function refreshSatValues(','setInterval(refreshSatValues');
const screenshotN1State={status:'review',route:C.clone(photoRoute),progress:0,altitude:60,targetAltitude:60,speed:12,battery:82,simTime:0,photoEvidence:[]};
const screenshotN2State={...n2Base,status:'review',progress:0};
const renderedCases=[
 ['N1',photoMission,screenshotN1State,Photo.describe({state:screenshotN1State,mission:photoMission,position:C.sample(photoRoute,0)})],
 ['N2',n2Mission,screenshotN2State,N2.describe({state:screenshotN2State,mission:n2Mission,position:C.sample(route,0),live:n2Live,ready:true})],
 ['N4',n4Mission,{status:'review',altitude:60,speed:10,progress:0},screenshot],
];
for(const [name,mission,state,raw]of renderedCases)for(const condition of ['action','reason','projection']){
 const root=new DomNode('aside','',{class:'sat-compact'}),cards=new DomNode('div','',{id:'satCards'}),badge=new DomNode('span','',{id:'satState'}),nodes={satCards:cards,satState:badge};root.append(cards,badge);
 const ctx={state,mission,session:{condition},window:{SatLabels:Labels,worldReady:true},document:{querySelector:selector=>root.matches(selector)?root:root.querySelector(selector)},$:id=>nodes[id]||(nodes[id]=new DomNode('button')),el:(tag,text,attrs)=>new DomNode(tag,text,attrs),PhotoMission:Photo,latestSatContext:{evidence:{}},eventLog(){},n4Active:()=>false,n2RenderNotice(){},n2SyncButtons(){},statusLabel:()=>state.status,refreshSatValues(){}};
 ctx.levels=Labels.normalize(raw,{state,mission,status:state.status});ctx.satInformation=()=>ctx.levels;
 vm.createContext(ctx);vm.runInContext(renderCode,ctx);ctx.renderCards();
 const visibleLabels=()=>root.querySelectorAll('.sat-label').map(node=>node.textContent);
 const expectedLabels=Object.values(fields).flat();
 assert.deepEqual(visibleLabels(),expectedLabels,name+' rendered screenshot has all nine fixed labels, including object/flow fields');
 assert.deepEqual(root.querySelectorAll('h2').map(node=>node.textContent),Object.values(headings));
 assert(!root.textContent.includes('[object Object]'),name+' grouped facts must render their contents');
 for(const [,,items]of raw)for(const [,value]of items)for(const part of leaves(value))if(typeof part==='string')assert(root.textContent.includes(part),name+' preserves the original visible fact: '+part);
 if(name==='N1')assert.equal(root.querySelectorAll('.photo-flow-step').length,4,'the four configured check-in points remain visible beside the 目标 label');
 const changed=raw.map(([key,title,items])=>[key,title,items.map(([label,value])=>[label,typeof value==='string'?value+'〔更新〕':value])]);ctx.levels=Labels.normalize(changed,{state,mission,status:state.status});
 vm.runInContext(refreshCode,ctx);ctx.refreshSatValues();
 assert.deepEqual(visibleLabels(),expectedLabels,name+' real refresh retains the exact schema');assert(root.textContent.includes('〔更新〕'),name+' real refresh updates grouped values');
 if(name==='N1')assert.equal(root.querySelectorAll('.photo-flow-step').length,4,'refresh does not replace the task flow with object text');
}
console.log('PASS fixed SAT schema across '+verified+' presentations: exact nine labels, all original values retained once, object identity, immutability and idempotence');
console.log('PASS shipped N1/N2/N3/N4/N5/free boundaries, all three conditions, N2/N4 editors, and actual three-screenshot render/refresh with nine visible labels');
