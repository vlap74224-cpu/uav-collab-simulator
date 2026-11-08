(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./n1-emphasis'):root.N1Emphasis);
 if(typeof module==='object'&&module.exports)module.exports=api;else root.SatEmphasis=api;
})(typeof window!=='undefined'?window:globalThis,function(n1){
 'use strict';
 // Inline emphasis decorates existing facts only; no wording or values change.
 function segments(value,{slot='',mission}={}){
  if(mission?.id==='N1'&&n1)return n1.segments(value,{slot,mission});
  const text=String(value??'');if(!text)return [{text}];
  const ranges=[],add=(start,end,tone,priority=1)=>{if(end>start)ranges.push({start,end,tone,priority});};
  const scan=(pattern,tone,priority=1)=>{for(const m of text.matchAll(pattern))add(m.index,m.index+m[0].length,tone,priority);};
  const negative=index=>/(?:未|尚未|没有|不|无|未曾|未发现|尚未发现)$/.test(text.slice(0,index));
  const literal=(word,tone)=>{
   if(typeof word!=='string'||!word.trim())return;
   let at=text.indexOf(word);while(at!==-1){add(at,at+word.length,tone,2);at=text.indexOf(word,at+word.length);}
  };
  for(const stop of [mission?.destination,...(mission?.viaStops||[]),...(mission?.resourceTasks||[])]){
   if(!stop)continue;
   for(const name of [stop.name,stop.shortName,stop.id,...(stop.name?.split('·').map(x=>x.trim())||[])])if(name?.length>1||/^[A-E]$/.test(name||''))literal(name,'target');
  }
  scan(/(?:原|用户|避让|应急)?路线[ABC]|(?:原)?航迹[ABC]|(?:沿|执行|改走|接受|拒绝|接入)[ABC]|\b[ABC](?=全线|最近|尚未执行|已执行|绕行|的|：|\d)|[PEC]\d+|E〔降落〕|[东西南北]侧绕行(?:点\d*|[ABC])|航路点\d+|避让点\d*|接回点\d*/g,'target',2);
  if(slot.startsWith('action-')){
   for(const m of text.matchAll(/剩余\d+(?:\.\d+)?秒|决策剩余\d+(?:\.\d+)?秒|余\d+(?:\.\d+)?秒|未操作自动执行[ABC]|未完成选择将自动执行[ABC]|超时AI接手|待确认|尚未执行|草稿尚未执行|建议取消|正在修改|手动接管|已暂停/g)){
    if(m[0]!=='待确认'||!negative(m.index))add(m.index,m.index+m[0].length,'warning',5);
   }
   scan(/(?:下一点[^·；。]*[· ]\s*|剩余|距E航程|余)\d+(?:\.\d+)?m|航迹偏差\d+(?:\.\d+)?m|偏差\d+(?:\.\d+)?m/g,'target',3);
   scan(/已确认|已接回原A|已绕过禁区|已到达|已在E降落|已完成着陆|着陆完成|✓P[45]|P[45]已(?:完成|通过)/g,'success',5);
   scan(/P5已取消|P5建议取消/g,'warning',5);
  }
  if(slot.startsWith('reason-')){
   scan(/\d+(?:\.\d+)?\s*(?:m\/s|m|%|秒)/g,'forecast',1);
   // Affirmative checks are specific facts, not a blanket green paragraph.
   scan(/未穿(?:越)?(?:已知)?禁(?:飞)?区(?:和建筑实体|和建筑|\/实体)?|未交禁区\/实体|避开禁区及缓冲区|未与[^，；。]*相交|无建筑阻挡|通道无障碍|地面平整|未发现相交|未发现需要避让的动态冲突/g,'success',4);
   for(const m of text.matchAll(/满足已检查的通行要求|满足已检通行要求|满足通行与资源要求|通行及着陆余量满足要求|建筑间隔检查满足要求|地面检查通过|检查通过|已核验|P4已完成|P4已通过|已通过受影响区域/g)){
    if(!negative(m.index))add(m.index,m.index+m[0].length,'success',4);
   }
   // Every displayed requirement comes from the same fact as its measurement.
   // A missing/pending check must never acquire a verified-safe tone.
   const unknown=/尚未|待核|核算中|正在(?:计算|检查|核验)|尚无|无可靠|暂不可预测|缺少|数据缺失|未估计|未完成/.test(text);
   if(!unknown){
    const compare=m=>{
     if(m[2]!==m[4])return;
     const a=m.index,b=m.index+m[0].lastIndexOf(m[3]),left=Number(m[1]),right=Number(m[3]);
     const upper=/(?:要求|阈值)\s*(?:≤|<=)/.test(m[0]);
     add(a,a+m[1].length+m[2].length,(upper?left<=right:left>=right)?'success':'danger',7);
     add(b,b+m[3].length+m[4].length,'warning',7);
    };
    for(const m of text.matchAll(/(\d+(?:\.\d+)?)(m|%)\s*(?:[\/／，,（(]\s*)?(?:[≥<>≤＜＞=]+\s*)?(?:安全要求|要求(?:至少)?|告警|至少|阈值)\s*[≥<>≤＜＞=]*\s*(\d+(?:\.\d+)?)(m|%)/g))compare(m);
    for(const m of text.matchAll(/(\d+(?:\.\d+)?)(m|%)\s*[≥<>＜＞=]+\s*(\d+(?:\.\d+)?)(m|%)/g))compare(m);
   }
   scan(/必经|必需|可选|允许取消/g,'target',2);
  }
  if(slot.startsWith('projection-')){
   if(slot!=='projection-1')scan(/(?:\d+(?:\.\d+)?分)?\d+(?:\.\d+)?秒|\d+(?:\.\d+)?\s*(?:m\/s|m|%)/g,'forecast',3);
   if(slot==='projection-1')scan(/未计(?:入)?[^，；。]*|未建模|含加减速|目标改变运动后需重新评估|等待时长未知|途经不停留/g,'warning',3);
   if(slot==='projection-2')scan(/此前已顺利完成\d+(?:段飞行|次导航)|本次绕行已完成|实际完成绕行并到达目标/g,'success',4);
  }
  // State and failure phrases retain their actual meaning, including negations.
  for(const m of text.matchAll(/未通过|不满足|未满足|间隔不足|余量不足|资源不足|受阻|与(?:已知|新增)?禁(?:飞)?区相交|与楼体相交|与建筑实体相交|穿过新增禁区|穿过已知禁区|发生碰撞|保存失败|重算失败/g)){
   if(!negative(m.index))add(m.index,m.index+m[0].length,'danger',8);
  }
  scan(/可能发生碰撞|仍有动态接近风险|耗电快于确认时估计|推荐方案已更新|推荐已更新|超时|决策剩余\d+(?:\.\d+)?秒/g,'warning',9);
  scan(/暂无[^，；。]*|暂不可预测|尚无可靠估计|尚未[^，；。]*|缺少[^，；。]*|无法确认[^，；。]*|数据缺失|正在重新计算|正在计算|正在核验|核算中|检查未完成或未通过|不以缺失数据代替可行结论/g,'muted',10);
  const chosen=[];
  for(const range of ranges.sort((a,b)=>b.priority-a.priority||(b.end-b.start)-(a.end-a.start)||a.start-b.start))if(!chosen.some(x=>range.start<x.end&&range.end>x.start))chosen.push(range);
  chosen.sort((a,b)=>a.start-b.start);const out=[];let cursor=0;
  for(const range of chosen){if(range.start>cursor)out.push({text:text.slice(cursor,range.start)});out.push({text:text.slice(range.start,range.end),tone:range.tone});cursor=range.end;}
  if(cursor<text.length)out.push({text:text.slice(cursor)});return out.length?out:[{text}];
 }
 return Object.freeze({segments});
});
