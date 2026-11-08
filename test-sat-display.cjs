'use strict';
// Display depth changes visibility, never the flight state or the available facts.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Display=require('./dist/sat-display'),Labels=require('./dist/sat-labels');
const modes=['l1','l12','l123'],levels=['action','reason','projection'];
const expected={l1:['action'],l12:['action','reason'],l123:levels};
for(const mode of modes){assert.equal(Display.normalize(mode),mode);for(const level of levels)assert.equal(Display.visible(level,mode),expected[mode].includes(level));}
for(const value of [undefined,null,'','unsupported','projection',12,{},false])assert.equal(Display.normalize(value),'l123','invalid values retain all information by default');

class DomNode{
 constructor(tag,text='',attrs={}){
  this.tag=tag;this.children=[];this.attributes={};this.parentElement=null;this._text=String(text??'');this.style={};this._hidden=false;this.events=new Map();
  this.dataset=new Proxy({}, {set:(target,key,value)=>{target[key]=String(value);this.attributes['data-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())]=String(value);return true;}});
  this.classList={contains:name=>(this.attributes.class||'').split(/\s+/).includes(name),toggle:(name,on)=>{const set=new Set((this.attributes.class||'').split(/\s+/).filter(Boolean));const value=on===undefined?!set.has(name):on;if(value)set.add(name);else set.delete(name);this.attributes.class=[...set].join(' ');return value;},add:(...names)=>names.forEach(name=>this.classList.toggle(name,true)),remove:(...names)=>names.forEach(name=>this.classList.toggle(name,false))};
  for(const [key,value]of Object.entries(attrs))this.setAttribute(key,value);
 }
 setAttribute(key,value){this.attributes[key]=String(value);if(key==='hidden')this._hidden=true;if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);}
 getAttribute(key){return this.attributes[key]??null;}
 addEventListener(type,handler){const list=this.events.get(type)||[];list.push(handler);this.events.set(type,list);}
 click(){for(const handler of this.events.get('click')||[])handler({currentTarget:this,target:this});}
 removeAttribute(key){delete this.attributes[key];if(key==='hidden')this._hidden=false;}
 get hidden(){return this._hidden;}
 set hidden(value){this._hidden=!!value;if(this._hidden)this.attributes.hidden='';else delete this.attributes.hidden;}
 append(...nodes){for(const node of nodes){const child=typeof node==='string'?new DomNode('#text',node):node;child.parentElement=this;this.children.push(child);}}
 prepend(...nodes){for(const node of nodes)node.parentElement=this;this.children.unshift(...nodes);}
 replaceChildren(...nodes){for(const child of this.children)child.parentElement=null;this.children=[];this._text='';this.append(...nodes);}
 get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
 set textContent(value){this.replaceChildren();this._text=String(value??'');}
 matches(selector){
  return selector.split(',').some(part=>{
   const value=part.trim();if(value==='*')return true;
   const attrs=[...value.matchAll(/\[([^=\]]+)(?:=["']?([^\]"']*)["']?)?\]/g)];
   for(const [,key,expected]of attrs)if(expected===undefined?!Object.hasOwn(this.attributes,key):this.attributes[key]!==expected)return false;
   const basic=value.replace(/\[[^\]]*\]/g,'');if(!basic)return true;
   if(basic.startsWith('.'))return basic.split('.').filter(Boolean).every(name=>this.classList.contains(name));
   if(basic.startsWith('#'))return this.attributes.id===basic.slice(1);
   return this.tag===basic;
  });
 }
 querySelectorAll(selector){const out=[];for(const child of this.children){if(child.matches(selector))out.push(child);out.push(...child.querySelectorAll(selector));}return out;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 get innerHTML(){throw Error('Visibility control must preserve text DOM');}
 set innerHTML(value){throw Error('Visibility control must not rebuild source text as HTML');}
}

// Bind exactly the three explicit mode controls; mode selection never submits a
// surrounding destination form or fires an AI acceptance action.
{
 const body=new DomNode('body'),toolbar=new DomNode('div','',{id:'satDisplayControls'}),cards=new DomNode('div','',{id:'satCards'}),buttons=modes.map(mode=>new DomNode('button',Display.labels[mode],{'data-sat-display-mode':mode,type:'button'})),accept=new DomNode('button','接受');
 toolbar.append(...buttons);cards.append(...levels.map(level=>section(level)));body.append(toolbar,cards,accept);
 const document={body,querySelectorAll:selector=>body.querySelectorAll(selector)},seen=[],flight={progress:.35,simTime:50,n4Decision:{seconds:10,deadlineSimTime:60},planVersion:7};let accepted=0;
 accept.addEventListener('click',()=>accepted++);Display.bind(document,mode=>{seen.push(mode);Display.apply(document,mode);});
 const before=JSON.stringify(flight);
 for(const [index,mode]of modes.entries()){
  buttons[index].click();assert.deepEqual(visibleLevels(body),expected[mode]);assert.equal(body.getAttribute('data-sat-display'),mode);assert.deepEqual(buttons.map(button=>button.getAttribute('aria-pressed')),modes.map(value=>String(value===mode)));assert.equal(accepted,0);assert.equal(JSON.stringify(flight),before);
 }
 assert.deepEqual(seen,modes);accept.click();assert.equal(seen.length,3,'unrelated decision buttons are not display controls');
}
function section(level,text='本段实际信息'){const node=new DomNode('section',text,{'data-level':level,class:'sat-section'});return node;}
function visibleLevels(root){return root.querySelectorAll('[data-level]').filter(node=>!node.hidden).map(node=>node.dataset.level);}
{
 const root=new DomNode('div'),sections=levels.map(key=>section(key,key+'：已有实际数据')),buttons=new DomNode('div','接受／修改／拒绝',{id:'decisionPanel'});root.append(...sections,buttons);
 const original=root.textContent,children=root.children.slice();
 for(const mode of ['l1','l12','l123','l1','l123']){
  Display.apply(root,mode);assert.deepEqual(visibleLevels(root),expected[mode]);assert.equal(root.textContent,original,'hidden sections keep all data ready for later display');assert.deepEqual(root.children,children,'changing depth never rebuilds or moves cards');assert.equal(buttons.hidden,false,'decision actions are independent of depth');
  for(const node of sections)assert.equal(node.getAttribute('aria-hidden'),String(!expected[mode].includes(node.dataset.level)),'accessibility visibility matches rendered visibility');
 }
 Display.apply(root,'invalid');assert.deepEqual(visibleLevels(root),levels);
}

const cockpit=fs.readFileSync('dist/cockpit.js','utf8');
const extract=(source,start,end)=>{assert(source.includes(start)&&source.includes(end),'shipped boundary '+start);return source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)+start.length));};
const rendererCode=extract(cockpit,'function renderFreeRouteFlow(','function refreshFreeSatValues(')+extract(cockpit,'function renderPhotoFlow(','function renderCards(')+extract(cockpit,'function renderCards(','function statusLabel(');
const refreshCode=extract(cockpit,'function refreshSatValues(','setInterval(refreshSatValues');
const vocabulary=['目标','计划','状态','依据','检查','约束','预测','局限','表现'];
const raw=[
 ['action','L1 当前目标与行动',[['目标','D · 建筑巡检点'],['计划','当前位置→避让点→D'],['状态','剩余15秒；路线B尚未执行']]],
 ['reason','L2 决策依据与约束',[['依据','按真实约束选择B'],['检查','未穿已知禁区'],['约束','最小35.0m／要求≥21.8m']]],
 ['projection','L3 预期结果与局限',[['预测','51秒后到D · 余电79.8%'],['局限','未计风况变化'],['表现','此前已完成2段飞行']]],
];
let presentations=0;
for(const id of ['N1','N2','N3','N4','N5','FREE'])for(const condition of ['action','reason','projection']){
 const root=new DomNode('aside','',{class:'sat-compact'}),cards=new DomNode('div','',{id:'satCards'}),badge=new DomNode('span'),nodes={satCards:cards,satState:badge};root.append(cards,badge);
 const mission={id,destination:{name:'D · 建筑巡检点'}},state={status:'review',simTime:30,planVersion:4,n4Decision:{status:'active',seconds:15,deadlineSimTime:45},noFlyDecision:{status:'active',seconds:15,deadline:1700000015000}},session={id:'test-session',condition,satDisplayMode:'l123'};
 const ctx={state,mission,session,window:{SatDisplay:Display,SatLabels:Labels,worldReady:true},document:{body:root,querySelector:selector=>root.matches(selector)?root:root.querySelector(selector),querySelectorAll:selector=>root.querySelectorAll(selector)},$:name=>nodes[name]||(nodes[name]=new DomNode('button')),el:(tag,text,attrs)=>new DomNode(tag,text,attrs),latestSatContext:{evidence:{}},eventLog(){throw Error('An ordinary mode apply cannot submit a decision or create a waypoint event');},n4Active:()=>false,n2RenderNotice(){},n2SyncButtons(){},statusLabel:()=>state.status,refreshSatValues(){},PhotoMission:{model:()=>({current:null})}};
 ctx.currentSatDisplayMode=()=>session.satDisplayMode;
 ctx.levels=Labels.normalize(raw,{state,mission});ctx.satInformation=()=>ctx.levels;
 vm.createContext(ctx);vm.runInContext(rendererCode,ctx);ctx.renderCards();
 assert.deepEqual(root.querySelectorAll('.sat-label').map(node=>node.textContent),vocabulary,id+' retains all nine semantic fields in the DOM');
 const content=cards.textContent,before=JSON.stringify(state);
 for(const mode of modes){session.satDisplayMode=mode;ctx.renderCards();assert.deepEqual(visibleLevels(root),expected[mode],id+' shipped renderer uses selected mode under '+condition);assert.equal(cards.textContent,content);assert.equal(JSON.stringify(state),before,'mode switch cannot move flight, change plan version, or reset deadline');}
 // A new rendered panel must support the selected mode again after replacement.
 session.satDisplayMode='l12';ctx.renderCards();assert.deepEqual(visibleLevels(root),expected.l12);
 vm.runInContext(refreshCode,ctx);ctx.refreshSatValues();assert.deepEqual(visibleLevels(root),expected.l12,'normal information refresh retains the selected display depth without manually reapplying');assert.equal(cards.textContent,content);
 presentations++;
}

class MemoryStorage{
 constructor(entries={}){this.values=new Map(Object.entries(entries));this.failWrite=false;}
 getItem(key){return this.values.get(key)??null;}
 setItem(key,value){if(this.failWrite)throw Error('fixture storage full');this.values.set(key,String(value));}
 removeItem(key){this.values.delete(key);}
}
// Execute the real application handlers together with its real log and payload.
// A display change is a separate observational event, never an accept/modify or
// a fresh decision window, even in a running N4 encounter.
{
 const root=new DomNode('body'),cards=new DomNode('div','',{id:'satCards'}),toolbar=new DomNode('div','',{id:'satDisplayControls'});cards.append(...levels.map(key=>section(key)));
 const buttons=modes.map(mode=>new DomNode('button',Display.labels[mode],{'data-sat-display-mode':mode,type:'button'}));toolbar.append(...buttons);root.append(toolbar,cards);
 const prefs={participant:'P007',condition:'reason',node:'N4',subtype:'dynamic',n2DecisionSeconds:25,satDisplayMode:'l123',custom:'preserve-me'},storage=new MemoryStorage({'uav-research-config-v1':JSON.stringify(prefs)});
 const state={status:'running',progress:.4,simTime:80,speed:12,altitude:60,battery:81,planVersion:6,presentedAt:1000,route:[[0,0],[100,100]],n4Decision:{status:'active',seconds:12,startedAtSimTime:77,deadlineSimTime:92},noFlyDecision:{status:'active',seconds:12,deadline:1700000012000}},mission={id:'N4',candidateRoute:[[0,0],[50,70],[100,100]]},session={id:'session',participant:'P007',condition:'reason',node:'N4',satDisplayMode:'l123'},records=[],toasts=[];
 const ctx={state,mission,session,records,trial:'trial',VERSION:'test',KEY:'uav-collab-v1',LEGACY_KEY:'uav-before-lujiazui-v4',recordLease:{generation:'fixture'},window:{SatDisplay:Display},document:{body:root,querySelectorAll:selector=>root.querySelectorAll(selector)},localStorage:storage,M:{categories:{N1:{},N2:{},N4:{},N5:{}}},C:{clone:value=>JSON.parse(JSON.stringify(value))},crypto:{randomUUID:()=>Math.random().toString(16).slice(2)},recordsWritable:()=>true,syncRecordClear(){throw Error('valid display click cannot clear records');},toast:text=>toasts.push(text),Date};
 vm.createContext(ctx);vm.runInContext(extract(cockpit,'function config(','function fresh(')+extract(cockpit,'function snap(','let toastTimer;'),ctx);
 Display.bind(ctx.document,ctx.setSatDisplayMode);ctx.syncSatDisplayMode();const before=JSON.stringify(state),plan=JSON.stringify(mission);
 for(const [index,mode]of modes.entries()){
  const previous=ctx.currentSatDisplayMode(),count=records.length;buttons[index].click();
  assert.equal(session.satDisplayMode,mode);assert.deepEqual(visibleLevels(root),expected[mode]);assert.equal(JSON.stringify(state),before,'live flight/decision state remains byte-for-byte intact');assert.equal(JSON.stringify(mission),plan,'candidate route and scheme are untouched');
  assert.equal(records.length,count+(previous===mode?0:1),'exactly one separate mode event per actual change');
  const record=records.at(-1);if(previous!==mode){assert.equal(record.type,'sat_display_change');assert.equal(record.satDisplayMode,mode);assert.deepEqual(Array.from(record.visibleSatLevels),expected[mode]);const detail=JSON.parse(record.detail);assert.equal(detail.previous,previous);assert.equal(detail.current,mode);assert.equal(record.before.session.satDisplayMode,previous);assert.equal(record.after.session.satDisplayMode,mode);assert.equal(record.reactionMs,null,'mode selection is not an accepted decision');}
  const saved=JSON.parse(storage.getItem('uav-collab-v1'));assert.equal(saved.session.satDisplayMode,mode);assert.equal(saved.state.n4Decision.deadlineSimTime,92);assert.equal(saved.state.noFlyDecision.deadline,1700000012000);
  assert.deepEqual(JSON.parse(storage.getItem('uav-research-config-v1')),{...prefs,satDisplayMode:mode},'mode preference merges instead of overwriting experiment settings');assert.equal(ctx.config().satDisplayMode,mode,'new-session configuration restores the saved selection');
 }
 const count=records.length;buttons[2].click();assert.equal(records.length,count,'reselecting the active option does not create duplicate mode events');
 ctx.session={...session,satDisplayMode:undefined};assert.equal(ctx.currentSatDisplayMode(),'l123','old sessions inherit the configured default');ctx.session.satDisplayMode='l1';assert.equal(ctx.currentSatDisplayMode(),'l1','saved active session takes precedence over next-session settings');
 storage.failWrite=true;ctx.setSatDisplayMode('l12');assert.equal(ctx.session.satDisplayMode,'l12','unavailable preferences do not prevent in-memory switching');assert(toasts.some(text=>text.includes('未能保存')),'failed preference persistence is stated honestly');
 const latest=ctx.currentSatDisplayMode(),lastCount=records.length;ctx.recordsWritable=()=>false;let cleared=0;ctx.syncRecordClear=()=>cleared++;ctx.setSatDisplayMode('l1');assert.equal(cleared,1);assert.equal(ctx.currentSatDisplayMode(),latest);assert.equal(records.length,lastCount,'a cleared writer cannot log or revive an old session through a display button');
}

// The actual N2 editor creates three level containers and the same mode applies
// while its displayed values are being updated. A hidden layer does not leak
// back into view after editing or recomputing the candidate.
{
 const root=new DomNode('body'),editor=new DomNode('div','',{id:'editor'}),state={status:'editing',noFlyVisible:true},mission={id:'N2',destination:{name:'C'}};root.append(editor);
 const nodes={editor},ctx={state,mission,draft:{},window:{SatDisplay:Display,SatLabels:Labels,worldReady:true},document:{body:root,querySelectorAll:selector=>root.querySelectorAll(selector)},$:id=>nodes[id]||root.querySelector('#'+id),el:(tag,text,attrs)=>new DomNode(tag,text,attrs),N2Decision:{describe:()=>raw},currentPosition:()=>({x:0,y:0})};
 const start=cockpit.indexOf("{const box=el('section','',{id:'n2EditNotice'");assert(start>=0,'real editor markup boundary exists');const boot=cockpit.slice(start,cockpit.indexOf('function candidateRoute(',start)),runtime=fs.readFileSync('dist/n2-runtime.js','utf8');
 vm.createContext(ctx);vm.runInContext(boot+extract(runtime,'function n2RenderNotice(','function n2SyncButtons('),ctx);
 for(const mode of modes){Display.apply(ctx.document,mode);ctx.n2RenderNotice();assert.deepEqual(visibleLevels(root),expected[mode]);assert.equal(root.querySelector('#n2EditNotice').hidden,false,'the editing workspace itself stays open');assert(root.textContent.includes('51秒后到D'),'prediction data is still updated while hidden');}
}

const html=fs.readFileSync('dist/index.html','utf8'),admin=fs.readFileSync('dist/admin.html','utf8');
assert(html.indexOf('sat-display.js')<html.indexOf('src="cockpit.js'),'visibility module loads before cockpit hooks');
for(const mode of modes)assert(html.includes('data-sat-display-mode="'+mode+'"'),'each cumulative depth has a real user-facing button');
assert(html.includes('aria-label="AI信息显示层级"'));assert(admin.includes('id="adminSatDisplay"'),'researcher can configure the next session display depth');
assert(cockpit.includes('window.SatDisplay.bind(document,setSatDisplayMode)'),'the production control group is bound to the actual recording handler');

console.log('PASS cumulative SAT display: default/all modes, exact facts and nine fields retained, decision buttons independent, '+presentations+' shipped node/condition render-and-refresh cases');
console.log('PASS actual display buttons and handlers: mode-only log, unchanged deadlines/plans/flight, preferences/session restoration, failure handling and real N2 editor visibility');
