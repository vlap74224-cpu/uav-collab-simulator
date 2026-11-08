'use strict';
const $=id=>document.getElementById(id),KEY='uav-collab-v1',conditions={action:'行动侧重',reason:'理由侧重',projection:'预测侧重'};
let data={records:[]},busy=false,photoReadVersion=0;
function setAdminStatus(text){$('adminStatus').textContent=text;}
function controls(value){busy=value;for(const id of ['adminArchive','adminClear','adminCsv','adminJson','refresh'])$(id).disabled=value;}
async function photoCount(){const version=++photoReadVersion;try{const count=await PhotoEvidence.count();if(version===photoReadVersion)$('metricPhotos').textContent=count;}catch{if(version===photoReadVersion)$('metricPhotos').textContent='不可读取';}}
function read(){
 try{data=RecordStorage.read()||{records:[]};if(!Array.isArray(data.records))throw Error('记录格式不匹配');}
 catch(error){setAdminStatus('无法读取本地记录：'+error.message);return false;}
 const selected=$('sessionFilter').value,ids=[...new Set(data.records.map(r=>String(r.sessionId||'未分配会话')))];
 $('sessionFilter').replaceChildren(new Option('全部会话','all'));
 for(const id of ids){const latest=data.records.filter(r=>String(r.sessionId||'未分配会话')===id).at(-1);$('sessionFilter').add(new Option((latest.participant||'未编号')+' / '+id.slice(0,8),id));}
 $('sessionFilter').value=ids.includes(selected)?selected:'all';
 $('metricSessions').textContent=ids.length;$('metricEvents').textContent=data.records.length;
 $('metricDecisions').textContent=data.records.filter(r=>['accept','reject','modify_apply'].includes(r.type)).length;
 $('metricNode').textContent=data.node||'—';render();photoCount();
 if(!busy)setAdminStatus('已读取本浏览器记录 · '+new Date().toLocaleTimeString('zh-CN')+(filtered().length>500?' · 页面显示最近500条，下载包含全部筛选记录':''));return true;
}
function filtered(){return data.records.filter(r=>$('sessionFilter').value==='all'||String(r.sessionId||'未分配会话')===$('sessionFilter').value);}
function render(){
 $('adminRows').replaceChildren();const rows=filtered();
 if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=7;td.textContent='暂无记录。';tr.append(td);$('adminRows').append(tr);}
 for(const r of rows.slice(-500).reverse()){
  const tr=document.createElement('tr');
  for(const value of [new Date(r.timestamp).toLocaleString('zh-CN',{hour12:false}),(r.participant||'未编号')+' / '+String(r.sessionId||'未分配会话').slice(0,8),(r.node||'—')+(r.obstacleSubtype==='dynamic'?' / 动态':r.obstacleSubtype==='static'?' / 静态':''),(conditions[r.condition]||r.condition)+(r.satDisplayMode?' / '+({l1:'L1',l12:'L1＋L2',l123:'L1＋L2＋L3'}[r.satDisplayMode]||r.satDisplayMode):''),r.label,r.detail,r.reactionMs==null?'—':(r.reactionMs/1000).toFixed(2)+'秒']){const td=document.createElement('td');td.textContent=value??'';tr.append(td);}
  $('adminRows').append(tr);
 }
}
function saveDownload(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
const stamp=()=>new Date().toISOString().replace(/[:.]/g,'-');
function download(format){
 if(busy||!read())return;
 try{const records=filtered(),text=format==='csv'?RecordArchive.csv(records):JSON.stringify({schemaVersion:'3.1.0',exportedAt:new Date().toISOString(),scope:$('sessionFilter').value,records},null,2);saveDownload(new Blob([text],{type:format==='csv'?'text/csv;charset=utf-8':'application/json'}),'uav-records-'+stamp()+'.'+format);setAdminStatus('已生成'+records.length+'条筛选记录的'+format.toUpperCase()+'下载；照片请使用完整记录包。');}catch(error){setAdminStatus('下载未生成：'+error.message);}
}
async function downloadAll(){
 if(busy)return;controls(true);setAdminStatus('正在整理全部记录与照片，请稍候…');
 try{
  const marker=localStorage.getItem(RecordStorage.keys.control),saved=RecordStorage.read()||{records:[]};if(!Array.isArray(saved.records))throw Error('记录格式不匹配');
  const records=saved.records,{records:omitted,...current}=saved,config=JSON.parse(localStorage.getItem(RecordStorage.keys.config)||'null'),legacy=localStorage.getItem(RecordStorage.keys.legacy),photos=await PhotoEvidence.list();
  if(localStorage.getItem(RecordStorage.keys.control)!==marker)throw Error('记录正在清空，请完成后重新下载');
  const blob=await RecordArchive.create({records,photos,state:current,config,legacy,exportedAt:new Date().toISOString()});
  if(localStorage.getItem(RecordStorage.keys.control)!==marker)throw Error('记录已变更，请重新下载');
  saveDownload(blob,'uav-complete-records-'+stamp()+'.zip');setAdminStatus('完整记录包已生成：'+records.length+'条事件、'+photos.length+'份照片记录。请在浏览器下载列表中保存文件。');
 }catch(error){setAdminStatus('完整记录包未生成：'+error.message+'。原记录未删除。');}finally{controls(false);}
}
async function clearAll(){
 if(busy)return;controls(true);setAdminStatus('正在清空全部记录、照片和恢复进度…');
 try{await RecordStorage.clear({clearPhotos:()=>PhotoEvidence.clear()});data={records:[]};$('sessionFilter').value='all';read();setAdminStatus('已清空全部本机记录、照片和恢复进度；会话设置已保留。已打开的飞行页面请刷新后重新开始。');}
 catch(error){read();setAdminStatus('清空未完成：'+error.message+'。请重试；尚存的记录仍可下载。');}finally{controls(false);}
}
$('saveConfig').onclick=()=>{const participant=$('adminParticipant').value.trim();if(!participant){$('configStatus').textContent='请填写研究编号';return;}try{localStorage.setItem(RecordStorage.keys.config,JSON.stringify({participant,condition:$('adminCondition').value,satDisplayMode:['l1','l12','l123'].includes($('adminSatDisplay').value)?$('adminSatDisplay').value:'l123',node:$('adminNode').value,subtype:$('adminSubtype').value,n2DecisionSeconds:Math.max(5,Math.min(60,Number($('adminN2Seconds').value)||15)),nonce:crypto.randomUUID(),savedAt:new Date().toISOString()}));$('configStatus').textContent='已保存。下一次规划路线时生效，进行中任务保持原条件。';}catch(error){$('configStatus').textContent='保存失败，请检查浏览器存储设置';}};
$('refresh').onclick=read;$('sessionFilter').onchange=render;$('adminCsv').onclick=()=>download('csv');$('adminJson').onclick=()=>download('json');$('adminArchive').onclick=downloadAll;$('adminClear').onclick=clearAll;
window.addEventListener('storage',e=>{if([KEY,RecordStorage.keys.control].includes(e.key))read();});window.addEventListener('pageshow',read);
try{const config=JSON.parse(localStorage.getItem(RecordStorage.keys.config)||'null');if(config){$('adminParticipant').value=config.participant;$('adminN2Seconds').value=config.n2DecisionSeconds||15;$('adminCondition').value=config.condition;$('adminSatDisplay').value=['l1','l12','l123'].includes(config.satDisplayMode)?config.satDisplayMode:'l123';$('adminNode').value=['N1','N2','N34','N5'].includes(config.node)?config.node:'N1';$('adminSubtype').value=config.subtype==='dynamic'?'dynamic':'static';}}catch{}
$('adminNode').onchange=()=>{$('subtypeLabel').hidden=true;};$('adminNode').onchange();
$('legacyBackup').onclick=()=>{const raw=localStorage.getItem(RecordStorage.keys.legacy);if(!raw){setAdminStatus('本浏览器没有旧任务存档');return;}saveDownload(new Blob([raw],{type:'application/json'}),'uav-before-lujiazui.json');};
read();
