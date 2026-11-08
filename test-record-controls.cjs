'use strict';
// All destructive cases use in-memory fixtures, never the browser's real data.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Storage=require('./dist/record-storage');
const keys={data:'uav-collab-v1',legacy:'uav-before-lujiazui-v4',config:'uav-research-config-v1',control:'uav-record-control-v1'};
class MemoryStorage{
 constructor(values={}){this.values=new Map(Object.entries(values));this.calls=[];this.failSet=null;this.failRemove=null;}
 getItem(key){return this.values.has(key)?this.values.get(key):null;}
 setItem(key,value){this.calls.push(['set',key,String(value)]);if(this.failSet===key)throw Error('fixture set denied');this.values.set(key,String(value));}
 removeItem(key){this.calls.push(['remove',key]);if(this.failRemove===key)throw Error('fixture remove denied');this.values.delete(key);}
 clear(){throw Error('The feature must never clear unrelated site storage');}
}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
let serial=0;const instance=storage=>Storage.create({storage,now:()=>1700000000000+(++serial),id:()=>`generation-${++serial}`});
const initial={records:[{id:'r1',sessionId:'session-1',participant:'P001',type:'accept',after:{state:{battery:81.3}}}],state:{status:'photo',photoEvidence:[{id:'photo-1'}]},session:{id:'session-1'}};
const config=JSON.stringify({participant:'P001',condition:'reason',n2DecisionSeconds:15});
function fixture(){return new MemoryStorage({[keys.data]:JSON.stringify(initial),[keys.legacy]:'legacy fixture',[keys.config]:config,'unrelated-map-preference':'keep'});}
function sameSettings(memory){assert.equal(memory.getItem(keys.config),config,'clearing records preserves the next-session configuration');assert.equal(memory.getItem('unrelated-map-preference'),'keep','unrelated site preferences remain untouched');}
function phase(memory){return JSON.parse(memory.getItem(keys.control)).phase;}

async function testStorage(){
 {
  const memory=fixture(),store=instance(memory),lease=store.lease();
  assert.equal(store.current(lease),true,'a pre-existing browser can write before any clear');
  assert.deepEqual(store.read(),initial,'legacy records remain readable before a deletion marker exists');
  assert.equal(memory.getItem(keys.data),JSON.stringify(initial),'read is not a migration or data rewrite');
 }
 {
  const memory=fixture(),a=instance(memory),b=instance(memory),oldA=a.lease(),oldB=b.lease(),photos=deferred();let photoCalls=0;
  const clearing=a.clear({clearPhotos:()=>{photoCalls++;assert.equal(phase(memory),'clearing','writers are invalidated before clearing photos');return photos.promise;}});
  assert.equal(photoCalls,1);assert.equal(phase(memory),'clearing');
  assert.equal(a.current(oldA),false,'the deleting tab loses its old write lease');
  assert.equal(b.current(oldB),false,'another open tab cannot autosave old records during deletion');
  assert.equal(b.current(b.lease()),false,'a page opened mid-deletion cannot receive a usable write lease');
  sameSettings(memory);photos.resolve();await clearing;
  assert.equal(phase(memory),'ready');assert.equal(memory.getItem(keys.data),null);assert.equal(memory.getItem(keys.legacy),null);
  assert.equal(a.current(oldA),false,'finishing deletion does not reactivate a stale writer');
  assert.equal(b.current(oldB),false,'a stale background page remains invalidated after deletion');
  const fresh=b.lease();assert.equal(b.current(fresh),true,'a newly started session can write after deletion');
  assert.notEqual(fresh.generation,oldB.generation);sameSettings(memory);
  const next={recordGeneration:fresh.generation,records:[{id:'new',type:'session_start'}]};memory.setItem(keys.data,JSON.stringify(next));
  assert.deepEqual(b.read(),next,'newly recorded events are not mistaken for stale history');
  memory.setItem(keys.data,JSON.stringify(initial));assert.equal(b.read(),null,'a legacy open tab cannot resurrect deleted records');
  memory.setItem(keys.data,JSON.stringify({...initial,recordGeneration:oldB.generation}));assert.equal(b.read(),null,'an explicitly stale generation is also rejected');
 }
 {
  const memory=fixture(),store=instance(memory),old=store.lease();
  await assert.rejects(store.clear({clearPhotos:async()=>{throw Error('fixture photos unavailable');}}),/fixture photos unavailable/);
  assert.equal(phase(memory),'failed','a partial failure is visible and does not claim a completed clear');
  assert.equal(store.current(old),false);assert.equal(store.current(store.lease()),false,'failure keeps old writers blocked');
  assert.equal(memory.getItem(keys.data),JSON.stringify(initial),'event history is retained when photo deletion fails');
  assert.deepEqual(store.read(),initial,'retained history is still available for backup after a partial failure');
  sameSettings(memory);
  let retried=false;await store.clear({clearPhotos:async()=>{retried=true;}});
  assert(retried);assert.equal(phase(memory),'ready');assert.equal(memory.getItem(keys.data),null);sameSettings(memory);
 }
 {
  const memory=fixture(),store=instance(memory);memory.failRemove=keys.data;
  await assert.rejects(store.clear({clearPhotos:async()=>{}}),/fixture remove denied/);
  assert.equal(store.current(store.lease()),false,'a storage error cannot silently re-enable saving');
  memory.failRemove=null;await store.clear({clearPhotos:async()=>{}});assert.equal(memory.getItem(keys.data),null);sameSettings(memory);
 }
 {
  const memory=fixture(),nativeSet=memory.setItem.bind(memory);let capacityFailures=0;
  memory.setItem=(key,value)=>{if(key===keys.control&&memory.getItem(keys.data)!==null){capacityFailures++;const error=Error('fixture quota full');error.name='QuotaExceededError';throw error;}nativeSet(key,value);};
  const store=instance(memory);await store.clear({clearPhotos:async()=>{assert.equal(phase(memory),'clearing');}});
  assert.equal(capacityFailures,1,'a full log store can free its own capacity for the generation marker');assert.equal(phase(memory),'ready');assert.equal(memory.getItem(keys.data),null);sameSettings(memory);
 }
 console.log('PASS record storage: legacy data, cross-tab generation barrier, delayed photo clear, stale resurrection prevention, partial failure, retry and settings preservation');
}

class PhotoDB{
 constructor(){this.rows=new Map();this.transactions=[];this.openCount=0;this.clearCount=0;}
 open(){this.openCount++;const request={result:this};queueMicrotask(()=>request.onsuccess?.());return request;}
 deleteDatabase(){throw Error('Clearing photos must not delete a database held by other tabs');}
 transaction(name,mode){
  assert.equal(name,'photos');const db=this,tx={mode,operations:[],error:null};
  const request=operation=>{const req={};tx.operations.push(()=>{req.result=operation();req.onsuccess?.();});return req;};
  const store={get:id=>request(()=>db.rows.get(id)),add:entry=>request(()=>{assert(!db.rows.has(entry.id),'fixture duplicate key');db.rows.set(entry.id,entry);}),getAll:()=>request(()=>Array.from(db.rows.values())),count:()=>request(()=>db.rows.size),clear:()=>request(()=>{db.clearCount++;db.rows.clear();}),index:index=>{assert.equal(index,'trialId');return{getAll:id=>request(()=>Array.from(db.rows.values()).filter(row=>row.trialId===id))};}};
  tx.objectStore=key=>{assert.equal(key,'photos');return store;};this.transactions.push(tx);return tx;
 }
 flushNext(error){const tx=this.transactions.shift();assert(tx,'fixture has an open transaction');if(error){tx.error=error;tx.onerror?.();return;}while(tx.operations.length)tx.operations.shift()();tx.oncomplete?.();}
}
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function photoApi(db,store){
 const ctx={RecordStorage:store,indexedDB:db,Blob,Uint8Array,atob,Date};ctx.window=ctx;vm.createContext(ctx);
 vm.runInContext(fs.readFileSync('dist/photo-evidence.js','utf8'),ctx);return ctx.PhotoEvidence;
}
function photoInput(id='photo-1'){return{dataUrl:'data:image/png;base64,'+Buffer.alloc(64,7).toString('base64'),record:{id,trialId:'trial-1',sessionId:'session-1',checkpointId:'checkpoint-1'},snapshot:{state:{status:'photo',battery:81.3},routeRevision:'n1-test'}};}
async function testPhotos(){
 {
  const memory=fixture(),store=instance(memory),db=new PhotoDB(),api=photoApi(db,store);
  const first=api.save(photoInput());await turn();assert.equal(db.transactions.length,1);db.flushNext();const metadata=await first;
  assert.equal(metadata.status,'saved');assert.equal(db.rows.size,1);assert(!('image'in metadata));assert(!('snapshot'in metadata));
  const duplicate=api.save(photoInput());await turn();db.flushNext();assert.deepEqual(await duplicate,metadata,'a repeated photo cannot replace the saved checkpoint record');assert.equal(db.rows.size,1);
  const count=api.count();await turn();db.flushNext();assert.equal(await count,1);
  const clear=api.clear();await turn();assert.equal(db.rows.size,1,'clear waits for the actual transaction');db.flushNext();await clear;assert.equal(db.rows.size,0);assert.equal(db.clearCount,1);
 }
 {
  const memory=fixture(),store=instance(memory),db=new PhotoDB(),api=photoApi(db,store);
  const saving=api.save(photoInput()),savingOutcome=saving.then(()=>({ok:true}),error=>({error}));await turn();assert.equal(db.transactions.length,1);
  const clearing=store.clear({clearPhotos:()=>api.clear()});await turn();assert.equal(db.transactions.length,2,'photo clear queues after the in-flight save');
  db.flushNext();const outcome=await savingOutcome;assert(outcome.error,'a photo completing after invalidation must not advance check-in');assert.match(outcome.error.message,/清空|重新开始/);
  db.flushNext();await clearing;assert.equal(db.rows.size,0,'the late photo cannot survive the clear transaction');
  await assert.rejects(api.save(photoInput('stale-photo')),/清空|重新开始/);assert.equal(db.transactions.length,0,'a stale page cannot even start a new photo write');
  const renewed=photoApi(db,store),next=renewed.save(photoInput('new-photo'));await turn();db.flushNext();assert.equal((await next).id,'new-photo','a refreshed page can start a new photo task');
 }
 {
  const memory=fixture(),store=instance(memory),db=new PhotoDB(),api=photoApi(db,store);db.rows.set('existing',photoInput().record);
  const clearing=api.clear(),outcome=clearing.then(()=>({ok:true}),error=>({error}));await turn();db.flushNext(Error('fixture IDB clear failed'));
  assert((await outcome).error);assert.equal(db.rows.size,1,'a failed photo transaction is not reported as successful deletion');
 }
 console.log('PASS photo records: saved metadata, duplicate protection, count, transaction completion, old-save/clear race, stale capture rejection and renewed session');
}

function shippedFunctions(source,names){return names.map(name=>{const at=source.indexOf('function '+name+'(');assert(at>=0,'shipped '+name+' exists');return source.slice(at).split('\n')[0];}).join('\n');}
async function testCockpit(){
 const source=fs.readFileSync('dist/cockpit.js','utf8'),memory=fixture(),store=instance(memory),body={children:[],append(node){this.children.push(node);}},counts={fresh:0,render:0,reload:0};
 const tick=shippedFunctions(source,['tick']);assert(tick.indexOf('syncRecordClear()')>=0&&tick.indexOf('syncRecordClear()')<tick.indexOf('const dt'),'the live frame checks the clear barrier before advancing flight');
 const node=(tag,text='',attrs={})=>({tag,textContent:text,attrs,children:[],append(...children){this.children.push(...children);}});
 const ctx={window:{RecordStorage:store},recordLease:store.lease(),recordsInvalidated:false,recordClearShown:false,records:[],KEY:keys.data,LEGACY_KEY:keys.legacy,VERSION:'test',session:{id:'session-1',participant:'P001',condition:'projection',node:'N4'},trial:'trial-1',state:{status:'running',simTime:10,simRate:4,battery:81.3,presentedAt:Date.now()-1000,n4Decision:{startedAtSimTime:3}},mission:{id:'N4',destination:{name:'D'}},localStorage:memory,Date,crypto:{randomUUID:()=>`event-${++serial}`},snap:()=>({state:{battery:81.3}}),toast:message=>{throw Error('Unexpected toast: '+message);},fresh(){counts.fresh++;ctx.mission=null;ctx.state={status:'ready'};},render(){counts.render++;},el:node,document:{body},location:{reload(){counts.reload++;}}};
 vm.createContext(ctx);vm.runInContext(shippedFunctions(source,['recordsWritable','syncRecordClear','payload','save','log']),ctx);
 ctx.log('accept','确认AI建议');const saved=JSON.parse(memory.getItem(keys.data));assert.equal(saved.recordGeneration,ctx.recordLease.generation);assert.equal(saved.records.length,1);assert.equal(saved.records[0].reactionFlightSeconds,7,'the existing node-specific reaction time is preserved');assert.equal(saved.records[0].after.state.battery,81.3);
 await store.clear({clearPhotos:async()=>{}});assert.equal(ctx.save(),false,'periodic/pagehide save cannot recreate cleared history');assert.equal(memory.getItem(keys.data),null);
 ctx.log('camera_pitch','late event');assert.equal(ctx.records.length,0,'late handlers cannot append a phantom event after clearing');assert.equal(memory.getItem(keys.data),null);
 assert.equal(ctx.syncRecordClear(),true);assert.equal(ctx.state.status,'ready');assert.equal(ctx.mission,null);assert.equal(counts.fresh,1);assert.equal(counts.render,1);assert.equal(body.children.length,1,'an invalidated flight gets one reset notice');
 assert.equal(ctx.syncRecordClear(),true);assert.equal(counts.fresh,1);assert.equal(body.children.length,1,'ordinary refreshes do not create repeated reset notices');
 const refresh=body.children[0].children.find(child=>child.tag==='button');assert(refresh);refresh.onclick();assert.equal(counts.reload,1);
 console.log('PASS shipped cockpit: record generation in payload, existing reaction fields, autosave/log write barriers, flight reset and explicit new-session control');
}

class AdminNode{
 constructor(tag='div',text='',value=''){this.tag=tag;this._text=String(text??'');this.value=value;this.children=[];this.disabled=false;this.hidden=false;this.attributes={};}
 append(...children){this.children.push(...children);}
 add(option){this.children.push(option);}
 replaceChildren(...children){this.children=children;this._text='';}
 setAttribute(key,value){this.attributes[key]=String(value);}
 get textContent(){return this._text+this.children.map(child=>child?.textContent??String(child)).join('');}
 set textContent(value){this.children=[];this._text=String(value??'');}
 set innerHTML(value){throw Error('Backend record text must never be parsed as HTML');}
 get innerHTML(){throw Error('Backend record text must remain literal');}
}
async function adminFixture(){
 const memory=fixture(),store=instance(memory),records=[
  {id:'r1',timestamp:'2026-11-08T12:00:00.000Z',sessionId:'session-1',participant:'P001',trialId:'trial-1',node:'N4',condition:'action',type:'accept',label:'接受AI',detail:'<script>literal()</script>',reactionMs:1500,reactionFlightSeconds:6,after:{state:{battery:81.3}}},
  {id:'r2',timestamp:'2026-11-08T12:01:00.000Z',sessionId:'session-2',participant:'P002',trialId:'trial-2',node:'N1',condition:'projection',type:'photo_capture_saved',label:'照片已保存',detail:'第二次会话',reactionMs:null,after:{state:{battery:79.4}}},
 ];
 const payload={...initial,records,node:'N4',trial:'trial-1',mission:{id:'N4'}};memory.setItem(keys.data,JSON.stringify(payload));
 const nodes=new Map(),anchors=[],blobs=new Map(),events=new Map(),archiveCalls=[],photos=[{id:'photo-1',trialId:'trial-1',sessionId:'session-1',image:new Blob(['photo-one'],{type:'image/png'}),snapshot:{battery:81.3}},{id:'photo-2',trialId:'trial-2',sessionId:'session-2',image:new Blob(['photo-two'],{type:'image/png'}),snapshot:{battery:79.4}}];
 const state={photos,readFailure:null,clearFailure:null,clearCalls:0};
 const get=id=>{if(!nodes.has(id))nodes.set(id,new AdminNode());return nodes.get(id);};get('sessionFilter').value='all';
 const doc={getElementById:get,createElement(tag){const node=new AdminNode(tag);if(tag==='a'){node.click=()=>anchors.push({download:node.download,href:node.href});node.remove=()=>{};}return node;},body:new AdminNode('body')};
 const archive=require('./dist/record-archive');
 const ctx={document:doc,localStorage:memory,RecordStorage:store,RecordArchive:{csv:archive.csv,async create(input){archiveCalls.push(input);return new Blob(['fixture-zip'],{type:'application/zip'});}},PhotoEvidence:{async list(){if(state.readFailure)throw state.readFailure;return state.photos.slice();},async count(){if(state.readFailure)throw state.readFailure;return state.photos.length;},async clear(){state.clearCalls++;if(state.clearFailure)throw state.clearFailure;state.photos=[];}},Option:function(text,value){return new AdminNode('option',text,value);},URL:{createObjectURL(blob){const key=`blob:fixture-${blobs.size}`;blobs.set(key,blob);return key;},revokeObjectURL(){}},Blob,Date,crypto:{randomUUID:()=>`config-${++serial}`},setTimeout:()=>1,clearTimeout(){},addEventListener(type,handler){const handlers=events.get(type)||[];handlers.push(handler);events.set(type,handlers);},confirm(){throw Error('One-click clear must not depend on a second confirmation in this fixture');}};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/admin.js','utf8'),ctx);await turn();
 return{memory,store,records,payload,nodes,get,anchors,blobs,events,archiveCalls,state,ctx};
}
async function testAdmin(){
 const html=fs.readFileSync('dist/admin.html','utf8');
 for(const id of ['adminArchive','adminClear'])assert(html.includes('id="'+id+'"'),'the backend exposes '+id+' as an actual control');
 const index=fs.readFileSync('dist/index.html','utf8');
 assert(index.indexOf('src="record-storage.js')>=0&&index.indexOf('src="record-storage.js')<index.indexOf('src="photo-evidence.js')&&index.indexOf('src="record-storage.js')<index.indexOf('src="cockpit.js'),'flight writers receive the shared store before they capture a lease');
 for(const script of ['record-storage.js','photo-evidence.js','record-archive.js'])assert(html.indexOf('src="'+script)>=0&&html.indexOf('src="'+script)<html.indexOf('src="admin.js'),'backend loads '+script+' before binding its controls');
 {
  const f=await adminFixture();assert.equal(String(f.get('metricEvents').textContent),'2');assert.equal(typeof f.get('adminArchive').onclick,'function');assert.equal(typeof f.get('adminClear').onclick,'function');
  f.get('sessionFilter').value='session-1';f.get('sessionFilter').onchange();assert(!f.get('adminRows').textContent.includes('第二次会话'),'the selected session filters the table');
  await f.get('adminJson').onclick();let download=f.anchors.at(-1);assert.match(download.download,/\.json$/);const json=JSON.parse(await f.blobs.get(download.href).text());assert.equal(json.records.length,1);assert.equal(json.records[0].id,'r1');assert.equal(json.records[0].reactionFlightSeconds,6);
  await f.get('adminCsv').onclick();download=f.anchors.at(-1);assert.match(download.download,/\.csv$/);const csv=await f.blobs.get(download.href).text();assert(csv.includes('reactionFlightSeconds'),'CSV includes the previously omitted flight-time reaction metric');assert(!csv.includes('第二次会话'));
  await f.get('adminArchive').onclick();assert.equal(f.archiveCalls.length,1);const backup=f.archiveCalls[0];assert.equal(backup.records.length,2,'the full backup includes every session regardless of the table filter');assert.equal(backup.photos.length,2,'the full backup includes actual photos from every session');assert(backup.state,'the recovery state is part of a full backup');assert.equal(JSON.stringify(backup.state.state),JSON.stringify(f.payload.state),'backup contains the current recovery state, distinct from event-time snapshots');assert.equal(backup.config.participant,'P001');assert.match(f.anchors.at(-1).download,/\.zip$/);
  assert.equal(f.memory.getItem(keys.data),JSON.stringify(f.payload),'download never deletes or changes the original record');sameSettings(f.memory);
  f.state.readFailure=Error('fixture photo read failed');const before=f.anchors.length;await f.get('adminArchive').onclick();assert.equal(f.anchors.length,before,'an incomplete photo read cannot produce a misleading full backup');assert.match(f.get('adminStatus').textContent,/失败|未完成|无法|未生成/);assert.equal(f.get('adminArchive').disabled,false,'failed download can be retried');
 }
 {
  const f=await adminFixture(),pending=deferred();f.ctx.PhotoEvidence.list=()=>pending.promise;
  const generating=f.get('adminArchive').onclick();assert.equal(f.get('adminArchive').disabled,true);assert.equal(f.get('adminClear').disabled,true,'one page cannot clear its records halfway through a backup');
  await f.get('adminClear').onclick();assert.equal(f.state.clearCalls,0,'busy handler rejects a concurrent programmatic clear too');
  await f.store.clear({clearPhotos:async()=>{}});pending.resolve(f.state.photos);await generating;
  assert.equal(f.archiveCalls.length,0,'a clear in another tab aborts export before archive construction');assert.equal(f.anchors.length,0);assert.match(f.get('adminStatus').textContent,/未生成/);assert.equal(f.get('adminArchive').disabled,false);
 }
 {
  const f=await adminFixture(),pending=deferred();f.ctx.RecordArchive.create=()=>pending.promise;
  const generating=f.get('adminArchive').onclick();await turn();await f.store.clear({clearPhotos:async()=>{}});pending.resolve(new Blob(['stale archive']));await generating;
  assert.equal(f.anchors.length,0,'a clear during ZIP construction prevents saving an archive from the old generation');assert.match(f.get('adminStatus').textContent,/未生成/);
 }
 {
  const f=await adminFixture();f.get('sessionFilter').value='session-1';f.get('sessionFilter').onchange();await f.get('adminClear').onclick();await turn();
  assert.equal(f.state.clearCalls,1,'one clear click starts exactly one photo clear');assert.equal(f.state.photos.length,0);assert.equal(f.memory.getItem(keys.data),null,'clear removes all sessions, not merely the visible filter');assert.equal(f.memory.getItem(keys.legacy),null);sameSettings(f.memory);assert.equal(String(f.get('metricEvents').textContent),'0');assert.equal(String(f.get('metricSessions').textContent),'0');assert.equal(f.get('adminClear').disabled,false);assert.match(f.get('adminStatus').textContent,/清空/);
  // A pre-update flight tab can still try to write its old snapshot. The current
  // admin must discard that generation rather than silently displaying it again.
  f.memory.setItem(keys.data,JSON.stringify(f.payload));for(const handler of f.events.get('storage')||[])handler({key:keys.data});await turn();assert.equal(f.memory.getItem(keys.data),null);assert.equal(String(f.get('metricEvents').textContent),'0');
 }
 {
  const f=await adminFixture();f.state.clearFailure=Error('fixture photo store unavailable');await f.get('adminClear').onclick();await turn();
  assert.equal(f.memory.getItem(keys.data),JSON.stringify(f.payload),'a failed photo clear retains recoverable event records');sameSettings(f.memory);assert.match(f.get('adminStatus').textContent,/失败|未完成|无法/);assert.equal(f.get('adminClear').disabled,false,'partial clear remains retryable');
  f.state.clearFailure=null;await f.get('adminClear').onclick();await turn();assert.equal(f.memory.getItem(keys.data),null);assert.equal(f.state.photos.length,0);sameSettings(f.memory);
 }
 console.log('PASS shipped backend controls: visible handlers, selected CSV/JSON, all-session ZIP with photos/state/config, download failure, one-click clear, stale writes and failure retry');
}

async function main(){await testStorage();await testPhotos();await testCockpit();await testAdmin();}
main().catch(error=>{console.error(error);process.exitCode=1;});
