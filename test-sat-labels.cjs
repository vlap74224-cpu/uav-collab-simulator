'use strict';
// Presentation-only SAT vocabulary: exercise the shipped node presenters and
// prove that normalising their headings/labels leaves every value in place.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('./dist/core'),Labels=require('./dist/sat-labels');
const Photo=require('./dist/photo-mission'),N2=require('./dist/n2-status');
global.N4Decision=require('./dist/n4-decision');
const N4=require('./dist/n4-status'),Resource=require('./dist/resource-status');
const headings={action:'L1 当前目标与行动',reason:'L2 决策依据与约束',projection:'L3 预期结果与局限'};
const allowed={action:['目标','计划','状态'],reason:['依据','检查','约束'],projection:['预测','局限','表现']};
let verified=0;
function check(name,raw,options={}){
 const before=JSON.stringify(raw),result=Labels.normalize(raw,options);
 assert.equal(result.length,raw.length,name+': preserve the three section boundaries');
 raw.forEach(([key,,items],i)=>{
  assert.equal(result[i][0],key,name+': preserve the SAT level key');
  assert.equal(result[i][1],headings[key],name+': stable level title');
  assert.equal(result[i][2].length,items.length,name+': no new, removed or merged rows');
  items.forEach((item,j)=>{
   assert(allowed[key].includes(result[i][2][j][0]),name+': canonical '+key+' label for '+item[0]);
   assert.strictEqual(result[i][2][j][1],item[1],name+': preserve the exact value/reference and row position');
  });
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
assert.deepEqual(canonical[0][2].map(x=>x[0]),['目标','计划','状态']);
assert.deepEqual(canonical[1][2].map(x=>x[0]),['依据','检查','约束','依据']);
assert.deepEqual(canonical[2][2].map(x=>x[0]),['预测','表现','局限']);
check('preserve flow and comparison objects',[['action','L1',[['任务',flow],['打卡','已打卡0/4'],['动作','正在前往震旦大厦']]],['reason','L2',[['空域','已检全路线'],['建筑','最小净距24.1m'],['取舍','东侧距离更短']]],['projection','L3',[['方案对比',comparison],['条件','按计划速度'],['表现','暂无既往记录']]]]);
const completed=check('completed N1 prediction audit',[['action','L1',[['目标','已到B']]],['reason','L2',[['记录','4/4记录已保存']]],['projection','L3 预测核对',[['核对','预计122.7秒 / 实际122.7秒'],['余电','终点余电预计79.4% / 实际79.4%'],['表现','累计4段实际记录']]]],{status:'complete'});
assert(completed[2][2].every(x=>x[0]==='表现'),'completed facts are past performance, not future forecasts');
const manual=check('manual forecast invalidation',[['action','L1',[['行动','手动接管']]],['reason','L2',[['恢复','恢复前重新检查']]],['projection','L3',[['原预测','旧路线预测已停止适用'],['局限','操控会改变运动']]]],{status:'manual'});
assert.equal(manual[2][2][0][0],'局限');
check('unknown source labels use SAT categories, not leaked legacy labels',Object.entries(headings).map(([key,title])=>[key,title,[['未来扩展字段','该字段的原始内容']]]));

// Actual N1 presenter: task configuration, arrival, save and completion.
const photoRoute=[[0,0],[120,0],[240,0],[360,0],[480,0],[600,0]],photoTasks=photoRoute.slice(1,5).map((point,i)=>({id:'photo-'+i,targetName:['震旦大厦','未来资产','香格里拉','东方明珠'][i],point,photoRequirement:'人工确认构图'}));
const photoMission={id:'N1',route:photoRoute,photoCheckpoints:photoTasks,destination:{name:'B · 湖边巡检点',point:photoRoute.at(-1)}};
for(const status of ['review','running','paused','manual','editing','photo','complete']){
 const state={status,route:C.clone(photoRoute),progress:status==='complete'?1:status==='photo'?.2:0,altitude:60,targetAltitude:60,verticalSpeed:0,speed:12,battery:82,simTime:status==='complete'?122.7:10,photoEvidence:status==='complete'?photoTasks.map(t=>({checkpointId:t.id,status:'saved',imageKey:t.id,savedAt:'saved'})):[]};
 check('N1 '+status,Photo.describe({state,mission:photoMission,position:C.sample(state.route,state.progress),evidence:{leg:{geometry:{status:'done',min:35},zone:{intersects:false},threshold:21.8}}}),{status});
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
for(const [name,overrides] of n2Cases){const state={...n2Base,...overrides},draft=state.status==='editing'?{route:[[50,0],[150,70],[200,0]],altitude:60,speed:12}:null;check('N2 '+name,N2.describe({state,mission:n2Mission,position:C.sample(state.route,state.progress),live:n2Live,ready:true,draft}),{status:state.status});}
const Legacy=require('./dist/sat-information'),n3State={route:[[0,0],[200,0]],status:'review',speed:12,altitude:60,battery:82,progress:0};
check('N3 legacy static constraint',Legacy.describe({mission:{id:'N3',destination:{name:'C',point:[200,0]}},state:n3State,position:{x:0,y:0},ready:false}),{status:'review'});

// Actual N4 presenter, including old execution flags while manual/paused.
const n4Mission={id:'N4',destination:{name:'D · 建筑巡检点',point:[200,100]},n4Plan:{choice:'当前可通行一侧'}},n4Live={current:478,targetSpeed:9,remaining:{distance:350},next:{name:'航路点3',distance:112},deviation:.4,original:{distance:.5,seconds:18.5},selected:{distance:100,seconds:17},forecast:{seconds:51,endBattery:79.8},check:{valid:true,min:32.1},condition:'未计风况与转弯动力学'};
for(const status of ['review','running','editing','manual','paused','complete','collision']){
 const state={status,route:[[0,0],[100,0],[200,100]],progress:.2,speed:10,battery:80,altitude:60,simTime:74,manualSpeed:0,n4Action:'ai',conflictAlert:status!=='review',n4Decision:status==='editing'?{status:'active',seconds:8}:{status:'resolved',source:'timeout'},n4Execution:{source:'timeout',check:{valid:true,min:24}},trafficMinimum:48};
 check('N4 '+status,N4.describe({state,mission:n4Mission,live:n4Live,draft:status==='editing'?{route:state.route,speed:10,altitude:60}:null}),{status});
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
]){const state={...resourceBase,...overrides},raw=Resource.describe({state,mission:{...resourceMission,...missionOverride},evidence:resourceEvidence,landingForecast:{seconds:20,cost:.2}}),out=check('N5 '+name,raw,{status:state.status,landed:!!state.landed});if(name==='normal')assert.deepEqual(out[2][2].map(x=>x[0]),['预测','预测','局限']);if(name==='landed')assert(out[2][2].every(x=>x[0]==='表现'));}

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
 const value=status==='complete'?completed:mixed,mission={id:node},state={status,altitude:60,speed:12},options={status};
 const ctx={state,mission,draft:null,window:{SatLabels:Labels,worldReady:false},lastEvidenceMission:mission,routeInspector:null,satCheckErrors:[],latestSatContext:null,currentPosition:()=>({x:0,y:0}),RouteEvidence:{build:()=>({})},TrafficComparison:{compare:()=>({})},SatInformation:{describe:()=>value},N4Status:{describe:()=>value},n4Active:()=>node==='N4',n4RefreshSnapshot:()=>({}),n2RefreshSnapshot:()=>({}),syncResourceButtons(){},n2PresentationReady(){}};
 vm.createContext(ctx);vm.runInContext(boundaryCode,ctx);
 let first;
 for(const condition of ['action','reason','projection']){
  ctx.session={condition,participant:'test'};
  const result=ctx.satInformation(),expected=Labels.normalize(value,options);
  assert.equal(JSON.stringify(result),JSON.stringify(expected),node+' actual main boundary under '+condition);
  for(let i=0;i<result.length;i++)for(let j=0;j<result[i][2].length;j++)assert.strictEqual(result[i][2][j][1],value[i][2][j][1]);
  if(first)assert.equal(JSON.stringify(result),first,'experimental emphasis cannot alter fields or positions');else first=JSON.stringify(result);
 }
}
{
 const mission={id:'FREE'},state={status:'review',freeFlight:true,altitude:60,speed:12},value=[['action','L1',[['路线',flow],['任务','经过2个点到达酒店'],['状态','尚未执行']]],['reason','L2',[['选择','按指定顺序'],['检查','未穿禁区'],['间隔','净距35m']]],['projection','L3',[['抵达','预计35秒抵达'],['局限','未计风况'],['记录','暂无既往记录']]]];
 const ctx={state,mission,draft:null,window:{SatLabels:Labels,worldReady:false},lastEvidenceMission:mission,routeInspector:null,satCheckErrors:[],records:[],session:{participant:'test'},currentPosition:()=>({x:0,y:0}),FreeRouteInfo:{describe:()=>value}};
 vm.createContext(ctx);vm.runInContext(boundaryCode,ctx);
 for(const result of [ctx.freeSatInformation(),ctx.satInformation()]){
  assert.equal(JSON.stringify(result),JSON.stringify(Labels.normalize(value,{status:'review'})),'free preview and main dispatch use identical labels');
  assert.strictEqual(result[0][2][0][1],flow,'multiple presentation boundaries preserve the same route-flow object');
  assert.equal(result[1][2][2][0],'约束','a second normalisation must not erase the canonical constraint category');
 }
}
for(const [file,method,end,prefix] of [['n2-runtime.js','n2RenderNotice','n2SyncButtons','n2-edit'],['n4-runtime.js','n4RenderEditor','n4PresentationReady','n4']]){
 const src=fs.readFileSync('dist/'+file,'utf8'),body=src.slice(src.indexOf('function '+method+'('),src.indexOf('function '+end+'(')),nodes=new Map(),box={hidden:false,querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{textContent:''});return nodes.get(selector);}},value=[mixed[0],[mixed[1][0],mixed[1][1],mixed[1][2].slice(0,3)],mixed[2]],state={status:'editing',noFlyVisible:true},ctx={state,mission:{id:file.startsWith('n2')?'N2':'N4'},draft:{},window:{worldReady:true,SatLabels:Labels},$:()=>box,currentPosition:()=>({x:0,y:0}),N2Decision:{describe:()=>value},N4Status:{describe:()=>value},n4Active:()=>true};
 vm.createContext(ctx);vm.runInContext(body,ctx);ctx[method]();assert.equal(box.hidden,false);
 for(const [key,title,items] of Labels.normalize(value,{status:'editing'})){
  const headingAttr=prefix==='n2-edit'?'data-n2-edit-heading':'data-n4-heading',labelAttr=prefix==='n2-edit'?'data-n2-edit-label':'data-n4-label',valueAttr=prefix==='n2-edit'?'data-n2-edit-value':'data-n4-value';
  assert.equal(nodes.get('['+headingAttr+'="'+key+'"]')?.textContent,title,file+' editor heading');
  items.forEach(([label,value],i)=>{assert.equal(nodes.get('['+labelAttr+'="'+key+'-'+i+'"]')?.textContent,label,file+' editor label');assert.strictEqual(nodes.get('['+valueAttr+'="'+key+'-'+i+'"]')?.textContent,value,file+' editor content');});
 }
}
console.log('PASS SAT vocabulary across '+verified+' presentations: semantic labels, unchanged values/order/object identity, no mutation, idempotence and browser delivery');
console.log('PASS shipped N1/N2/N3/N4/N5/free main boundaries, all three emphasis conditions, and N2/N4 editor labels preserve content');
