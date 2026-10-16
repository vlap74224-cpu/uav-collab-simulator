(function(root){
const C=typeof module!=='undefined'?require('./core.js'):root.UAV;
const points=[{id:'home',name:'A · 起降区',point:[330,530]},{id:'lake',name:'B · 湖边巡检点',point:[350,330]},{id:'north',name:'C · 公园北侧入口',point:[480,230]},{id:'building',name:'D · 建筑巡检点',point:[560,400]},{id:'east',name:'E · 东侧终点',point:[450,550]}];
const landmarks=[
 {id:'oriental-pearl',name:'东方明珠广播电视塔',shortName:'东方明珠',point:[-117,170],height:468},
 {id:'jin-mao',name:'金茂大厦',shortName:'金茂大厦',point:[346,750],height:421},
 {id:'swfc',name:'上海环球金融中心',shortName:'环球金融中心',point:[493,840],height:492}
];
const nodes=['N1','N2','N4','N5'];
function make(index,origin,battery){
 const a=origin.slice(),b=points[index+1].point.slice(),dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),p=(t,k=0)=>[a[0]+dx*t-dy/len*k,a[1]+dy*t+dx/len*k];
 const m={id:nodes[index],name:['航迹跟随','航迹转向','动态冲突','资源可行性下降'][index],destination:points[index+1],route:[a,b],initialRoute:[a,b],alternative:[a,p(.5,25),b],battery,subtype:null,limits:'陆家嘴完整预载实体场景；树林、缓坡和事件为实验补建。净距与碰撞基于同一模型网格。安全色带以 Mavic 3E/3M 性能为参考并随速度更新，属于实验告警值。',error:'未建立校准的出错概率模型。',history:'暂无经过验证的历史执行表现。'};
 if(index===0){
  m.route=[a,[270,500],[205,455],[135,405],[65,345],[-5,285],[20,170],[80,186.67],[140,203.33],[200,220],[250,256.67],[300,293.33],b];
  m.initialRoute=C.clone(m.route);
  m.alternative=[a,[250,520],[150,475],[55,395],[-20,300],[20,170],[105,225],[220,300],b];
  const checkpoint=m.route[6];
  m.photoCheckpoint={id:'N1-PHOTO-1',name:'东方明珠拍照打卡点',landmarkId:'oriental-pearl',point:checkpoint.slice(),routeIndex:6,progress:C.length(m.route.slice(0,7))/C.length(m.route)};
  m.title='绕行建筑群，前往东方明珠拍照打卡';
  m.reason='N1 沿道路和开阔区设置连续转向航点，避开建筑体积后抵达东方明珠东侧观察点；完成拍照打卡，再沿通过实体碰撞校验的通道前往 B 点。';
 }
 if(index===1){m.title='在 B 点转向，继续前往 C';m.reason='当前位于 B 点；下一目标位于北侧，需调整航向后进入 B → C 航段。';}
 if(index===2){m.title='沿 C → D 飞行，监测移动目标';m.subtype='dynamic';m.reason='交通目标以 9 m/s 穿越本航段；起飞后按双方位置和速度持续预测未来 30 秒的最近间隔。';m.limits+=' 采用匀速交通目标和三维间隔预测，40 m 为实验告警阈值，非真实适航标准。';}
 if(index===3){m.battery=Math.min(battery,Math.ceil(C.length([a,b])*.016+17));m.alternative=[a,points[0].point.slice()];m.title='电量余量下降，选择继续或返航';m.reason='实验注入电量下降。按固定每米耗电模型，直达 E 尚可保留 15% 余量；返航方案需单独检查，可能因距离过长而不可行。';m.limits+=' 能耗未计风速、载荷和电池老化。';}
 m.event=`${m.id} ${m.name} · ${'ABCDE'[index]} → ${'ABCDE'[index+1]}`;m.summary=m.title+'。请接受、修改或拒绝；确认后继续同一任务。';
 if(index===0)m.summary='路线包含 12 个航段，覆盖更大城区并绕行建筑；抵达东方明珠观察点后自动悬停拍照，随后继续前往 B 点。请先复核路线。';
 return m;
}
const api={points,landmarks,nodes,make};if(typeof module!=='undefined')module.exports=api;else root.Sequence=api;
})(typeof window!=='undefined'?window:globalThis);


