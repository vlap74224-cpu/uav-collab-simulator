/* Shared SAT presentation vocabulary. Values, row order and task logic are untouched. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SatLabels=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const titles=Object.freeze({action:'L1 当前目标与行动',reason:'L2 决策依据与约束',projection:'L3 预期结果与局限'});
 const vocabulary=Object.freeze({action:Object.freeze(['目标','计划','状态']),reason:Object.freeze(['依据','检查','约束']),projection:Object.freeze(['预测','局限','表现'])});
 const group=(names,label)=>Object.fromEntries(names.split(' ').map(name=>[name,label]));
 const action=Object.freeze({...group('目标 任务','目标'),...group('建议 路线 修改 候选 行动 继续 动作 选择 计划 航迹 处置','计划'),...group('当前 状态 变化 决策 进展 跟踪 执行 结果 记录 原因 事件 表现 完成 高度 打卡','状态')});
 const reason=Object.freeze({...group('依据 影响 来源 顺序 操作 取舍 后续 原因 替代 对象 控制 目标 计划 选择 终点 处置 发现 证据 理由','依据'),...group('原路 检查 空域 方案 结果 复核 接入 恢复 路线 地面 降落点 记录 进度 判断 位置 核对 着陆 覆盖 实测 末段 航段 通行','检查'),...group('约束 间隔 建筑 空间 通道 动态 最近间隔 限制 优先 优先级 条件 任务 缺口 资源 必经 要求 门槛 交通 阈值 原案','约束')});
 const projection=Object.freeze({...group('核对 表现 记录 实际 预测核对','表现'),...group('局限 范围 条件 原案 原预测','局限'),...group('预测 余电 预计 抵达 边界 代价 进程 结果 着陆 完成 长度 方案对比 时刻 余量 到达 风险 恢复 绕行 最近 通过 新方案 建议 方案','预测')});
 function labelFor(level,label,value,context={}){
  if(level==='action'){
   if(label==='任务'&&typeof value==='string'&&/已完成|已通过|已取消|尚未|未完成|✓/.test(value))return '状态';
   return action[label]||'状态';
  }
  if(level==='reason')return reason[label]||'依据';
  if(level==='projection'){
   if(['当前','状态','进度','电量'].includes(label))return typeof value==='string'&&/预计|预测|后最近|后到|保持原路线/.test(value)?'预测':'表现';
   const mapped=projection[label]||'预测';
   // A completed run reports observations and forecast verification, not a future ETA.
   return mapped==='预测'&&(context.status==='complete'||context.status==='collision'||context.landed)?'表现':mapped;
  }
  return label;
 }
 function normalize(levels,context={}){
  return levels.map(([key,title,rows])=>[key,titles[key]||title,rows.map(([label,value])=>[labelFor(key,label,value,context),value])]);
 }
 return Object.freeze({titles,vocabulary,labelFor,normalize});
});
