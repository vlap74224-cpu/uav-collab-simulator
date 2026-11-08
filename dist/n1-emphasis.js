(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.N1Emphasis=factory();
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 // Decorate existing facts only. Concatenating the segments returns the exact
 // original text; neither the presenter nor the experimental condition changes.
 function segments(value,{slot='',mission}={}){
  const text=String(value??'');
  if(mission?.id!=='N1'||!text)return [{text}];
  const ranges=[];
  const add=(start,end,tone,priority=1)=>{
   if(end>start)ranges.push({start,end,tone,priority});
  };
  const scan=(pattern,tone,priority=1)=>{
   for(const match of text.matchAll(pattern))add(match.index,match.index+match[0].length,tone,priority);
  };
  const names=[...(mission.photoCheckpoints||[]),...(mission.photoCheckpoint?[mission.photoCheckpoint]:[]),mission.destination]
   .flatMap(task=>task?[task.targetName,task.flowLabel,task.shortName,task.name]:[])
   .filter(name=>typeof name==='string'&&name.trim());
  // Names are literal configuration values, never a regular expression or HTML.
  for(const name of [...new Set(names)].sort((a,b)=>b.length-a.length)){
   let start=text.indexOf(name);
   while(start!==-1){add(start,start+name.length,'target',2);start=text.indexOf(name,start+name.length);}
  }
  if(slot.startsWith('action-')||slot.startsWith('reason-')||slot==='projection-2'){
   for(const match of text.matchAll(/(?:已打卡|已完成)?(\d+)\/(\d+)(?:个打卡点|个打卡记录已保存)?/g)){
    const done=Number(match[1]),total=Number(match[2]);
    if(total>0)add(match.index,match.index+match[0].length,done===total?'success':'target',4);
   }
   scan(/第\d+\/\d+个打卡点/g,'target',5);
  }
  if(slot.startsWith('action-')){
   scan(/本点打卡完成|四点已打卡|打卡完成/g,'success',3);
   scan(/待确认航线|请拍照打卡|正在保存|保存中/g,'warning',3);
  }
  if(slot.startsWith('reason-')){
   scan(/未交楼体、已知禁区|未交楼体|未穿越已知禁飞区|未与[^，；。]*相交|已悬停|打卡记录已保存|照片已保存/g,'success',3);
   scan(/尚未稳定悬停，暂不能拍照|照片尚未保存，不计入打卡|正在保存，尚未计数/g,'warning',6);
   scan(/(?:尚未检查|尚未提供|检查数据缺失|净距核算中)/g,'muted',6);
   // A clearance is safe only relative to the threshold in this same fact.
   const clearance=/(?:净距采样|采样最小|最小建筑间隔)(\d+(?:\.\d+)?)\s*m/.exec(text);
   const threshold=/(?:告警\s*|要求\s*|至少\s*)[≥>=]*\s*(\d+(?:\.\d+)?)\s*m/.exec(text);
   if(clearance){
    const start=clearance.index+clearance[0].indexOf(clearance[1]);
    add(start,start+clearance[1].length+clearance[0].slice(clearance[0].indexOf(clearance[1])+clearance[1].length).length,
     threshold?(Number(clearance[1])>=Number(threshold[1])?'success':'danger'):'forecast',6);
   }
   if(threshold){
    const start=threshold.index+threshold[0].indexOf(threshold[1]);
    add(start,start+threshold[1].length+threshold[0].slice(threshold[0].indexOf(threshold[1])+threshold[1].length).length,'warning',6);
   }
  }
  if(slot==='projection-0'||slot==='projection-2'){
   scan(/(?:\d+(?:\.\d+)?分)?\d+(?:\.\d+)?秒|\d+(?:\.\d+)?\s*(?:m\/s|%)/g,'forecast',3);
   scan(/顺利完成\d+(?:\.\d+)?段飞行|已核对\d+段|拍照悬停记录\d+次/g,'success',3);
  }
  if(slot==='projection-1'){
   scan(/每点\d+(?:\.\d+)?秒|\d+(?:\.\d+)?秒|悬停、转弯、减速|未含[^；。]*|不含[^；。]*/g,'warning',3);
  }
  // Failures take precedence over positive words contained in the same phrase.
  scan(/保存失败(?:，未计数)?/g,'danger',9);
  for(const match of text.matchAll(/与楼体相交|进入已知禁区|低于告警值/g)){
   if(!/(?:未|没有|不|未曾|未发现)$/.test(text.slice(0,match.index)))add(match.index,match.index+match[0].length,'danger',9);
  }
  scan(/尚未提供|暂无[^；。]*|暂不可预测|正在计算|核算中|数据缺失/g,'muted',8);
  // Resolve overlaps once, then emit small inline spans without changing text.
  const selected=[];
  for(const range of ranges.sort((a,b)=>b.priority-a.priority||(b.end-b.start)-(a.end-a.start)||a.start-b.start)){
   if(!selected.some(other=>range.start<other.end&&range.end>other.start))selected.push(range);
  }
  selected.sort((a,b)=>a.start-b.start);
  const out=[];let cursor=0;
  for(const range of selected){
   if(range.start>cursor)out.push({text:text.slice(cursor,range.start)});
   out.push({text:text.slice(range.start,range.end),tone:range.tone});cursor=range.end;
  }
  if(cursor<text.length)out.push({text:text.slice(cursor)});
  return out.length?out:[{text}];
 }
 return {segments};
});
