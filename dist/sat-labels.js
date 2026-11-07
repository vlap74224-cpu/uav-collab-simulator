/* Fixed SAT fields shared by every node, phase and experimental condition. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SatLabels=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const titles=Object.freeze({action:'L1 当前目标与行动',reason:'L2 决策依据与约束',projection:'L3 预期结果与局限'});
 const vocabulary=Object.freeze({action:Object.freeze(['目标','计划','状态']),reason:Object.freeze(['依据','检查','约束']),projection:Object.freeze(['预测','局限','表现'])});
 const inList=(label,list)=>list.split(' ').includes(label);
 function labelFor(level,label,value,context={}){
  const s=context.state||context,terminal=s.status==='complete'||s.status==='collision'||s.landed;
  if(level==='action'){
   if(value?.kind==='photo-flow'||label==='目标')return '目标';
   if(value?.kind==='free-route-flow')return '计划';
   if(label==='任务')return typeof value==='string'&&/已完成|已通过|已取消|尚未|未完成|✓|中断|暂停/.test(value)?'状态':typeof value==='string'&&/→|路线|航线/.test(value)?'计划':'目标';
   return inList(label,'计划 建议 路线 航线 航迹 修改 候选 行动 继续 动作 选择 处置')?'计划':'状态';
  }
  if(level==='reason'){
   if(inList(label,'航段 路线 方案 覆盖')&&typeof value==='string'&&/最小|≥|至少|要求|阈值|安全间隔/.test(value))return '约束';
   if(inList(label,'约束 间隔 建筑 动态 最近间隔 限制 条件 缺口 资源 要求 门槛 交通 阈值 原案 优先 优先级 必经 任务 通道 空间 安全'))return '约束';
   if(inList(label,'检查 空域 方案 路线 进度 覆盖 末段 航段 通行 着陆 判断 结果 复核 接入 恢复 地面 降落点 记录 位置 核对 实测 原路 证据'))return '检查';
   return '依据';
  }
  if(level==='projection'){
   if(inList(label,'局限 条件 范围 原案 原预测 基准 假设'))return '局限';
   if(terminal||inList(label,'核对 表现 记录 实际 预测核对 耗时'))return '表现';
   if(inList(label,'当前 状态 进度 电量 消耗')&&!(typeof value==='string'&&/预计|预测|后最近|后到|保持原路线|后通过/.test(value)))return '表现';
   return '预测';
  }
  return label;
 }
 function fallback(level,label,context){
  const s=context.state||context,m=context.mission||{},terminal=s.status==='complete'||s.status==='collision'||s.landed;
  if(level==='action'){
   if(label==='目标')return m.destination?.name||s.freeMapDestination?.name||'尚未选择目的地';
   if(label==='计划')return s.activePlan||(m.candidateRoute?'候选路线待确认':s.route?.length>1?'当前任务航线':'尚未生成航线');
   return({review:'等待确认',approved:'已确认，等待开始',running:'正在执行',manual:'当前由操作者控制',paused:'已暂停',photo:'等待拍照打卡',editing:'修改待提交',complete:'飞行已结束',collision:'飞行已停止'})[s.status]||'状态待更新';
  }
  if(level==='reason'){
   if(label==='依据')return m.resourceTasks?.length?'按已配置的任务优先级':m.photoCheckpoints?.length?'按当前打卡任务配置':m.id?'按当前任务配置':'尚未提供决策依据';
   if(label==='检查')return s.noFlyPlanning||s.n4Planning||s.resourcePlanning?'候选路线检查中':'尚未提供本阶段检查结果';
   return m.hazard&&(s.noFlyVisible||s.noFlyDetected)?(m.hazard.label||'临时禁飞区')+'仍有效':m.resourceTasks?.length?'按已配置的任务要求':'尚未提供本阶段约束要求';
  }
  if(label==='预测')return terminal?'飞行已结束，无后续到达预测':s.status==='manual'?'手动操控中，暂不提供到达预测':'当前尚无可靠预测';
  if(label==='局限')return terminal?'不再预测后续航段':'未提供本阶段的预测条件';
  return Array.isArray(s.resourceCompleted)&&m.resourceTasks?.length?'已完成'+s.resourceCompleted.length+'/'+m.resourceTasks.length+'个任务点':'未提供既往执行记录';
 }
 function text(value){
  if(value?.kind==='sat-field-values')return value.items.map(text).join('；');
  if(value?.kind==='photo-flow')return value.steps.map(step=>step.name).join(' → ');
  if(value?.kind==='free-route-flow')return value.items.map(item=>item.label+(item.tag?'〔'+item.tag+'〕':'')).join(' → ');
  if(value&&typeof value==='object')return '原方案'+value.original+' → '+(value.label||'建议方案')+value.suggested;
  return value===null||value===undefined?'':String(value);
 }
 function normalize(levels,context={}){
  return levels.map(([key,title,rows])=>{
   const fields=vocabulary[key];if(!fields)return[key,title,rows];
   if(rows.length===3&&rows.every(([label,value],i)=>label===fields[i]&&value?.kind==='sat-field-values'&&value.schema==='sat-fixed-v1'))return[key,titles[key],rows];
   const groups=new Map(fields.map(label=>[label,[]]));
   for(const [label,value]of rows)groups.get(labelFor(key,label,value,context)).push(value);
   return[key,titles[key],fields.map(label=>{
    const items=groups.get(label),generated=!items.length;
    return[label,{kind:'sat-field-values',schema:'sat-fixed-v1',items:generated?[fallback(key,label,context)]:items,generated}];
   })];
  });
 }
 return Object.freeze({titles,vocabulary,labelFor,normalize,text});
});
