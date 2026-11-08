'use strict';
// Render-only emphasis must preserve every original fact and the fixed SAT layout.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Emphasis=require('./dist/n1-emphasis'),Labels=require('./dist/sat-labels');
const mission={id:'N1',photoCheckpoints:[
 {id:'a',targetName:'震旦大厦'},
 {id:'b',shortName:'未来资产'},
 {id:'c',name:'香格里拉'},
 {id:'d',targetName:'东方明珠'},
],destination:{name:'B · 湖边巡检点'}};
const tones=new Set(['target','success','forecast','warning','danger','muted']);
let assertions=0;
function parts(text,slot,configuredMission=mission){
 const original=JSON.stringify(configuredMission),result=Emphasis.segments(text,{slot,mission:configuredMission});
 assert(Array.isArray(result),'segments returns plain text parts');
 assert.equal(result.map(part=>part.text).join(''),text,'coloring cannot change the source text');
 for(const part of result){assert.equal(typeof part.text,'string');assert(!part.tone||tones.has(part.tone),'only the supported semantic tones are returned');}
 assert.equal(JSON.stringify(configuredMission),original,'rendering does not mutate mission configuration');
 assertions++;return result;
}
function expectTone(text,slot,needle,tone){
 const result=parts(text,slot),index=text.indexOf(needle);assert(index>=0,'test needle exists');
 const colors=result.flatMap(part=>Array.from(part.text,()=>part.tone||null));
 const start=Array.from(text.slice(0,index)).length,length=Array.from(needle).length;
 assert.deepEqual(colors.slice(start,start+length),Array(length).fill(tone),slot+' colors '+needle+' as '+tone);
}
function forbidSafe(text,slot){assert(!parts(text,slot).some(part=>part.tone==='success'),'unknown, negative or pending checks cannot appear verified safe: '+text);}

for(const name of ['震旦大厦','未来资产','香格里拉','东方明珠','B · 湖边巡检点'])
 expectTone('待确认航线；下一站'+name,'action-1',name,'target');
expectTone('已打卡0/4','action-2','0/4','target');
expectTone('已打卡4/4','action-2','4/4','success');
expectTone('按既定环绕顺序，第1/4个打卡点','reason-0','1/4','target');
expectTone('当前导航段未交楼体、已知禁区','reason-1','未交楼体、已知禁区','success');
for(const value of ['尚未检查建筑与禁飞区','建筑间隔暂不可预测','检查中，结果尚未提供','无法确认是否未交禁区','检查失败，尚未核实'])forbidSafe(value,'reason-1');
expectTone('机体净距采样32.9m / 告警≥21.8m','reason-2','32.9m','success');
expectTone('机体净距采样12.9m / 告警≥21.8m','reason-2','12.9m','danger');
expectTone('最小建筑间隔21.8m，要求至少21.8m','reason-2','21.8m','success');
forbidSafe('机体净距采样32.9m / 要求尚未提供','reason-2');
forbidSafe('机体净距采样尚未完成 / 要求≥21.8m','reason-2');
expectTone('42.7秒至震旦大厦 · 余电81.1%；全程约3分22.7秒至终点 · 预计余电79.4%','projection-0','42.7秒','forecast');
expectTone('42.7秒至震旦大厦 · 余电81.1%；全程约3分22.7秒至终点 · 预计余电79.4%','projection-0','81.1%','forecast');
expectTone('42.7秒至震旦大厦 · 余电81.1%；全程约3分22.7秒至终点 · 预计余电79.4%','projection-0','3分22.7秒','forecast');
expectTone('42.7秒至震旦大厦 · 余电81.1%；全程约3分22.7秒至终点 · 预计余电79.4%','projection-0','79.4%','forecast');
expectTone('拍照按每点20秒估算；悬停、转弯、减速可能使任务延后','projection-1','20秒','warning');
expectTone('拍照按每点20秒估算；悬停、转弯、减速可能使任务延后','projection-1','悬停、转弯、减速','warning');
expectTone('预计任务顺利完成率97%','projection-2','97%','forecast');
expectTone('此前已顺利完成3段飞行','projection-2','3段','success');
forbidSafe('暂无已完成航段可用于核对预测误差','projection-2');
const payload='<img src=x onerror="alert(1)"> & <script>恶意()</script>；下一站震旦大厦';
parts(payload,'action-1');
for(const slot of ['action-0','action-1','action-2','reason-0','reason-1','reason-2','projection-0','projection-1','projection-2'])
 for(const text of ['', '  未知数据\n暂不可预测  ', '〔缺失〕／⚠', '<b>不应解释为HTML</b>'])parts(text,slot);

// Minimal DOM exercises the actual shipped renderer and card builder.
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
 get innerHTML(){throw new Error('renderer must not use HTML for source text');}
 set innerHTML(value){throw new Error('renderer must not use HTML for source text');}
}
const cockpit=fs.readFileSync('dist/cockpit.js','utf8');
const extract=(start,end)=>{assert(cockpit.includes(start)&&cockpit.includes(end),'shipped renderer boundary exists');return cockpit.slice(cockpit.indexOf(start),cockpit.indexOf(end,cockpit.indexOf(start)+start.length));};
const code=extract('function renderSatFieldValue(','function refreshFreeSatValues(')+extract('function renderPhotoFlow(','function renderCards(')+extract('function renderCards(','function statusLabel(');
const fields=['目标','计划','状态','依据','检查','约束','预测','局限','表现'];
const raw=[
 ['action','L1 当前目标与行动',[['目标',{kind:'photo-flow',steps:mission.photoCheckpoints.map((point,index)=>({id:point.id,name:point.targetName||point.shortName||point.name,state:index?'pending':'current'}))}],['计划','待确认航线；下一站震旦大厦'],['状态','已打卡0/4']]],
 ['reason','L2 决策依据与约束',[['依据','按既定环绕顺序，第1/4个打卡点'],['检查','当前导航段未交楼体、已知禁区'],['约束','机体净距采样32.9m / 告警≥21.8m']]],
 ['projection','L3 预期结果与局限',[['预测','42.7秒至震旦大厦 · 余电81.1%；全程约3分22.7秒至终点 · 预计余电79.4%'],['局限','拍照按每点20秒估算；悬停、转弯、减速可能使任务延后'],['表现','预计任务顺利完成率97%']]],
];
let baseline;
for(const id of ['N1','N2','N4','N5','FREE'])for(const condition of ['action','reason','projection']){
 const root=new DomNode('aside','',{class:'sat-compact'}),cards=new DomNode('div','',{id:'satCards'}),badge=new DomNode('span'),nodes={satCards:cards,satState:badge};root.append(cards,badge);
 const state={status:'review'},configuredMission={...mission,id},ctx={state,mission:configuredMission,session:{condition},window:{N1Emphasis:Emphasis,SatLabels:Labels},$:name=>nodes[name]||(nodes[name]=new DomNode('button')),el:(tag,text,attrs)=>new DomNode(tag,text,attrs),refreshSatValues(){},renderFreeRouteFlow(){}};
 ctx.levels=Labels.normalize(raw,{state,mission:configuredMission});ctx.satInformation=()=>ctx.levels;
 vm.createContext(ctx);vm.runInContext(code,ctx);ctx.renderCards();
 assert.deepEqual(root.querySelectorAll('.sat-label').map(node=>node.textContent),fields,'nine fixed titles remain identical for '+id+' '+condition);
 assert.equal(root.querySelectorAll('.photo-flow-step').length,4,'the four-point flow remains intact');
 const allNodes=root.querySelectorAll('span'),colored=allNodes.filter(node=>/n1-key-(?:target|success|forecast|warning|danger|muted)/.test(node.attributes.class||''));
 if(id==='N1'){
  assert(colored.length>0,'the actual N1 renderer applies helper segments');
  const serialized=JSON.stringify(colored.map(node=>({text:node.textContent,class:node.attributes.class})));
  if(baseline===undefined)baseline=serialized;else assert.equal(serialized,baseline,'all three experiment conditions use the identical emphasis rules');
 }else assert.equal(colored.length,0,'other nodes retain their original rendering');
 const node=new DomNode('div','',{'data-sat-value':'action-1'});ctx.renderSatFieldValue(node,payload);
 assert.equal(node.textContent,payload,'HTML-looking source stays literal text in the actual renderer');
 assert.equal(node.querySelectorAll('img').length,0);assert.equal(node.querySelectorAll('script').length,0);
 // The same bytes in another slot or mission require a different render cache key.
 ctx.mission={...mission,id:'N1'};node.dataset.satValue='reason-1';ctx.renderSatFieldValue(node,'尚未检查建筑与禁飞区');
 const before=node.children.slice();ctx.renderSatFieldValue(node,'尚未检查建筑与禁飞区');assert.deepEqual(node.children,before,'unchanged field avoids unnecessary DOM replacement');
 node.dataset.satValue='projection-1';ctx.renderSatFieldValue(node,'尚未检查建筑与禁飞区');assert.notDeepEqual(node.children,before,'cache includes field slot');
 const previous=node.children.slice();ctx.mission={...mission,id:'N4'};ctx.renderSatFieldValue(node,'尚未检查建筑与禁飞区');assert.notDeepEqual(node.children,previous,'cache includes mission id');
}
console.log('PASS '+assertions+' N1 text emphasis cases: exact source retention, mission names, honest constraint tones, progress, forecasts, limitations, history, and text-only safety');
console.log('PASS actual renderer: N1 only, all three conditions identical, nine fixed labels, original flow, safe text, and mission/slot-aware cache');
