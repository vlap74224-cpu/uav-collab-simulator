/* Shared SAT presentation vocabulary. Values, row order and task logic are untouched. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SatLabels=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const titles=Object.freeze({action:'L1 当前目标与行动',reason:'L2 决策依据与约束',projection:'L3 预期结果与局限'});
 const vocabulary=Object.freeze({
  action:Object.freeze(['目标','计划','状态','航线','进展','跟踪','当前','事件','结果','记录','原因','任务','行动','说明','补充','附注']),
  reason:Object.freeze(['依据','检查','约束','结论','取舍','证据','原路','影响','来源','优先','接入','复核','位置','地面','通道','对象','控制','终点','空间','安全','说明','补充','附注']),
  projection:Object.freeze(['预测','局限','表现','时间','余电','核对','记录','耗时','间隔','时刻','边界','代价','结果','范围','基准','假设','消耗','航程','对比','方案','恢复','状态','条件','说明','补充','附注'])
 });
 const group=(names,label)=>Object.fromEntries(names.split(' ').map(name=>[name,label]));
 const action=Object.freeze({...group('目标 任务','目标'),...group('建议 修改 候选 行动 继续 动作 选择 计划 处置','计划'),...group('路线 航迹 航线','航线'),...group('进展 打卡','进展'),...group('跟踪 表现','跟踪'),...group('状态 决策 执行 高度','状态'),...group('变化 事件','事件'),...group('结果 完成','结果'),当前:'当前',记录:'记录',原因:'原因',说明:'说明',补充:'补充',附注:'附注'});
 const reason=Object.freeze({...group('依据 顺序 操作 后续 原因 目标 计划 处置 发现 理由','依据'),...group('检查 空域 方案 路线 进度 覆盖 末段 航段 通行 着陆','检查'),...group('约束 间隔 建筑 动态 最近间隔 限制 条件 缺口 资源 要求 门槛 交通 阈值 原案','约束'),...group('判断 结果 结论','结论'),...group('取舍 选择 替代','取舍'),...group('记录 核对 实测 证据','证据'),...group('优先 优先级 必经 任务','优先'),...group('恢复 复核','复核'),...group('位置 降落点','位置'),原路:'原路',影响:'影响',来源:'来源',接入:'接入',地面:'地面',通道:'通道',对象:'对象',控制:'控制',终点:'终点',空间:'空间',安全:'安全',说明:'说明',补充:'补充',附注:'附注'});
 const projection=Object.freeze({...group('预测 预计 抵达 到达 着陆 进程','预测'),...group('余电 余量','余电'),...group('局限 条件','局限'),...group('原案 原预测 当前','基准'),...group('完成 绕行 通过','时间'),...group('最近 间隔','间隔'),...group('方案对比 对比','对比'),...group('新方案 建议 方案','方案'),核对:'核对',预测核对:'核对',表现:'表现',记录:'表现',实际:'表现',时刻:'时刻',结果:'结果',边界:'边界',代价:'代价',范围:'范围',风险:'间隔',长度:'航程',恢复:'恢复',状态:'状态',进度:'状态',时间:'时间',耗时:'耗时',基准:'基准',假设:'假设',消耗:'消耗',航程:'航程',说明:'说明',补充:'补充',附注:'附注'});
 function labelFor(level,label,value,context={}){
  if(level==='action'){
   if(label==='任务'&&typeof value==='string'&&/已完成|已通过|已取消|尚未|未完成|✓|中断|暂停/.test(value))return '进展';
   return action[label]||'状态';
  }
  if(level==='reason')return reason[label]||'依据';
  if(level==='projection'){
   const terminal=context.status==='complete'||context.status==='collision'||context.landed;
   if(label==='电量')return typeof value==='string'&&/预计|预测/.test(value)?'余电':'消耗';
   if(terminal&&['表现','记录'].includes(label))return '记录';
   if(terminal&&label==='实际')return '余电';
   if(terminal&&['结果','完成'].includes(label)&&typeof value==='string'&&/耗时|运行|飞行/.test(value))return '耗时';
   const mapped=projection[label]||'预测';
   return terminal&&mapped==='预测'?'结果':mapped;
  }
  return label;
 }
 function normalize(levels,context={}){
  return levels.map(([key,title,rows])=>{
   const used=new Set(),alternatives={action:{目标:['任务'],计划:['行动'],状态:['当前'],进展:['状态'],跟踪:['状态']},reason:{依据:['结论','来源'],检查:['复核','证据'],约束:['安全','空间']},projection:{预测:['结果','时间'],局限:['条件','范围','假设'],表现:['记录','核对'],时间:['时刻','耗时'],余电:['结果'],间隔:['对比']}};
   return[key,titles[key]||title,rows.map(([label,value])=>{
    const primary=labelFor(key,label,value,context),candidates=[primary,...(alternatives[key]?.[primary]||[]),'说明','补充','附注'];
    const unique=candidates.find(candidate=>!used.has(candidate));
    if(!unique)throw Error('SAT分区缺少可用的小标题');used.add(unique);return[unique,value];
   })];
  });
 }
 return Object.freeze({titles,vocabulary,labelFor,normalize});
});
