(function(root){
const C=typeof module!=='undefined'?require('./core.js'):root.UAV;
const points=[{id:'home',name:'A · 起降区',point:[330,530]},{id:'lake',name:'B · 湖边巡检点',point:[350,330]},{id:'north',name:'C · 公园北侧入口',point:[480,230]},{id:'building',name:'D · 建筑巡检点',point:[560,400]},{id:'east',name:'E · 东侧终点',point:[450,550]}];
const landmarks=[
 {id:'oriental-pearl',name:'东方明珠广播电视塔',shortName:'东方明珠',point:[-117,170],height:468,tier:1},
 {id:'aurora',name:'震旦国际大楼',shortName:'震旦大厦',point:[-228.5,748.9],height:128,tier:1},
 {id:'mirae-asset',name:'未来资产大厦',shortName:'未来资产大厦',point:[-163,682.8],height:138,tier:1},
 {id:'pudong-shangrila',name:'浦东香格里拉酒店',shortName:'香格里拉酒店',point:[-225,595],height:151,tier:1},
 {id:'jin-mao',name:'金茂大厦',shortName:'金茂大厦',point:[346,750],height:421,tier:1},
 {id:'swfc',name:'上海环球金融中心',shortName:'环球金融中心',point:[493,840],height:492,tier:1},
 {id:'golden-landmark',name:'上海黄金置地大厦',shortName:'黄金置地大厦',point:[405.7,155.7],height:180,tier:2},
 {id:'hsbc',name:'汇丰银行大楼',shortName:'汇丰银行',point:[557.8,199.7],height:160,tier:2},
 {id:'huaneng-united',name:'华能联合大厦',shortName:'华能联合大厦',point:[617.1,328],height:171,tier:2},
 {id:'huaxia-bank',name:'华夏银行大厦',shortName:'华夏银行',point:[692.6,263.5],height:131,tier:2},
 {id:'times-finance',name:'时代金融中心',shortName:'时代金融',point:[508,81.6],height:170,tier:2},
 {id:'yincheng-10',name:'银城中路十号大厦',shortName:'银城中路10号',point:[603.2,32.4],height:160,tier:2},
 {id:'cmg-tower',name:'招商局大厦',shortName:'招商局大厦',point:[696,516.8],height:173,tier:2},
 {id:'new-shanghai-international',name:'新上海国际大厦',shortName:'新上海国际',point:[750.8,372.8],height:128,tier:2},
 {id:'shanghai-information',name:'上海信息大楼',shortName:'上海信息大楼',point:[822.7,764],height:147,tier:2}
];
const nodes=['N1','N2','N4','N5'];
function make(index,origin,battery){
 const a=origin.slice(),b=points[index+1].point.slice(),dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),p=(t,k=0)=>[a[0]+dx*t-dy/len*k,a[1]+dy*t+dx/len*k];
 const m={id:nodes[index],name:['航迹跟随','航迹转向','动态冲突','资源可行性下降'][index],destination:points[index+1],route:[a,b],initialRoute:[a,b],alternative:[a,p(.5,25),b],battery,subtype:null,limits:'陆家嘴完整预载实体场景；树林、缓坡和事件为实验补建。净距与碰撞基于同一模型网格。安全色带以 Mavic 3E/3M 性能为参考并随速度更新，属于实验告警值。',error:'未建立校准的出错概率模型。',history:'暂无经过验证的历史执行表现。'};
 if(index===0){
  m.route=[a,[0,620],[-100,740],[-100,680],[-100,620],[90,530],[120,470],[-30,260],[180,440],b];
  m.initialRoute=C.clone(m.route);
  m.alternative=C.clone(m.route);
  const photo=(id,name,shortName,routeIndex,target,targetName,targetAltitude=120)=>({id,name,shortName,point:m.route[routeIndex].slice(),target:target.slice(),targetName,targetAltitude,routeIndex,progress:C.length(m.route.slice(0,routeIndex+1))/C.length(m.route)});
  m.photoCheckpoints=[
   photo('N1-PHOTO-1','震旦大厦拍照打卡','震旦大厦打卡',2,landmarks[1].point,'震旦大厦',110),
   photo('N1-PHOTO-2','未来资产大厦拍照打卡','未来资产打卡',3,landmarks[2].point,'未来资产大厦',115),
   photo('N1-PHOTO-3','香格里拉酒店拍照打卡','香格里拉打卡',4,landmarks[3].point,'香格里拉酒店',120),
   photo('N1-PHOTO-4','东方明珠全景拍照打卡','东方明珠打卡',7,landmarks[0].point,'东方明珠',150)
  ];
  m.photoCheckpoint=m.photoCheckpoints[0];
  m.routeRevision='n1-noncrossing-ring-v7';
  m.title='沿无交叉环线巡游左侧建筑群与东方明珠';
  m.reason='N1 采用顺时针单向环线，依次经过震旦大厦、未来资产大厦、香格里拉酒店和东方明珠后前往 B 点；9 个航段互不交叉，并全部通过完整三维网格净距检查。';
 }
 if(index===1){m.title='在 B 点转向，继续前往 C';m.reason='当前位于 B 点；下一目标位于北侧，需调整航向后进入 B → C 航段。';}
 if(index===2){m.title='沿 C → D 飞行，监测移动目标';m.subtype='dynamic';m.reason='交通目标以 9 m/s 穿越本航段；起飞后按双方位置和速度持续预测未来 30 秒的最近间隔。';m.limits+=' 采用匀速交通目标和三维间隔预测，40 m 为实验告警阈值，非真实适航标准。';}
 if(index===3){m.battery=Math.min(battery,Math.ceil(C.length([a,b])*.016+17));m.alternative=[a,points[0].point.slice()];m.title='电量余量下降，选择继续或返航';m.reason='实验注入电量下降。按固定每米耗电模型，直达 E 尚可保留 15% 余量；返航方案需单独检查，可能因距离过长而不可行。';m.limits+=' 能耗未计风速、载荷和电池老化。';}
 m.event=`${m.id} ${m.name} · ${'ABCDE'[index]} → ${'ABCDE'[index+1]}`;m.summary=m.title+'。请接受、修改或拒绝；确认后继续同一任务。';
 if(index===0)m.summary='路线包含 9 个互不交叉的航段和 4 个拍照打卡点；完整模型计算的最小净距约 23.5 m，高于 21.8 m 绿色预警线。请先复核路线。';
 return m;
}
const api={points,landmarks,nodes,make};if(typeof module!=='undefined')module.exports=api;else root.Sequence=api;
})(typeof window!=='undefined'?window:globalThis);


