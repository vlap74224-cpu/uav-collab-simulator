(function(root){
const C=typeof module!=='undefined'?require('./core.js'):root.UAV;
const points=[{id:'home',name:'A · 起降区',point:[330,530]},{id:'lake',name:'B · 湖边巡检点',point:[350,330]},{id:'north',name:'C · 东北建筑群入口',point:[1150,180]},{id:'building',name:'D · 建筑巡检点',point:[618,816]},{id:'east',name:'E · 东侧终点',point:[450,550]}];
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
function n2EventWindow(random=Math.random){
 const sample=()=>{const value=Number(random());return Math.max(0,Math.min(1,Number.isFinite(value)?value:0))};
 return{revealProgress:Number((.22+sample()*.05).toFixed(3))};
}
function n2DynamicNoFlyZone(route,revealProgress,random=Math.random){
 const total=C.length(route),reveal=Math.max(0,Math.min(.9,Number(revealProgress)||0)),value=Number(random()),sample=Math.max(0,Math.min(1,Number.isFinite(value)?value:0)),r=55,margin=25,remaining=total*(1-reveal),maxAhead=Math.max(r+margin+55,Math.min(500,remaining-35)),minAhead=Math.min(380,maxAhead),ahead=minAhead+(maxAhead-minAhead)*sample,routeProgress=Math.min(.96,reveal+ahead/total),stopClearance=r+margin+45,triggerProgress=Math.max(reveal+.05,routeProgress-stopClearance/total),point=C.sample(route,routeProgress);
 return{x:point.x,y:point.y,r,margin,routeProgress:Number(routeProgress.toFixed(4)),triggerProgress:Number(triggerProgress.toFixed(4)),label:'大型活动临时禁飞区',activity:'陆家嘴大型会展活动安保'};
}
function n2Detours(origin,destination,zone,interruptedRoute){
 const a=origin.slice(),b=destination.slice();
 if(!zone||!Array.isArray(interruptedRoute)||interruptedRoute.length<2)return[[a,b],[a,b]];
 const total=C.length(interruptedRoute),clearance=zone.r+zone.margin,rejoinProgress=Math.min(1,(zone.routeProgress||0)+(clearance+80)/total),rejoinSample=C.sample(interruptedRoute,rejoinProgress),rejoin=[rejoinSample.x,rejoinSample.y],dx=rejoin[0]-a[0],dy=rejoin[1]-a[1],length=Math.max(1,Math.hypot(dx,dy)),ux=dx/length,uy=dy/length,nx=-uy,ny=ux,remainder=interruptedRoute.slice(rejoinSample.next).map(p=>p.slice());
 const build=(sign,longitudinal,lateral)=>[a,[zone.x-ux*longitudinal+nx*lateral*sign,zone.y-uy*longitudinal+ny*lateral*sign],[zone.x+ux*longitudinal+nx*lateral*sign,zone.y+uy*longitudinal+ny*lateral*sign],rejoin,...remainder,b].filter((p,i,list)=>!i||Math.hypot(p[0]-list[i-1][0],p[1]-list[i-1][1])>.1),routes=[];
 for(const lateral of[clearance+38,clearance+85,clearance+140,clearance+210,clearance+300,clearance+400,clearance+500])for(const longitudinal of[clearance*.72,clearance*1.1,clearance*1.5])for(const sign of[1,-1])routes.push(build(sign,longitudinal,lateral));
 return routes;
}
function make(index,origin,battery){
 const a=origin.slice(),b=points[index+1].point.slice(),dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),p=(t,k=0)=>[a[0]+dx*t-dy/len*k,a[1]+dy*t+dx/len*k];
 const m={id:nodes[index],name:['航迹跟随','航迹转向','动态冲突','资源可行性下降'][index],destination:points[index+1],route:[a,b],initialRoute:[a,b],alternative:[a,p(.5,25),b],battery,subtype:null,limits:'陆家嘴完整预载实体场景；树林、缓坡和事件为实验补建。净距与碰撞基于同一模型网格。安全色带以 Mavic 3E/3M 性能为参考并随速度更新，属于实验告警值。',error:'未建立校准的出错概率模型。',history:'暂无经过验证的历史执行表现。'};
 if(index===0){
  m.route=[a,[-12,603],[-100,740],[-100,680],[-100,620],[-119,548],[-99,421],[-30,260],[120,390],[170,420],[200,420],b];
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
  m.routeRevision='n1-user-drawn-ring-v9';
  m.title='沿手绘外围环线巡游左侧建筑群与东方明珠';
  m.reason='N1 按操作者手绘走向构成顺时针外围环线，将 92 个密集绘制点压缩为 11 个关键航段；只在两处建筑邻近区向外调整，四个打卡点均保留，航段互不交叉并通过完整三维网格净距检查。';
 }
 if(index===1){
  // Seven key points keep the verified corridor readable on the minimap.
  m.route=[a,[500,280],[650,230],[800,101.43],[1000,-70],[1050,13.33],b];
  m.initialRoute=C.clone(m.route);m.alternative=C.clone(m.route);m.routeRevision='n2-temporary-no-fly-v7-current-route';
  m.plannedNoFlyZone={...n2EventWindow(),label:'大型活动临时禁飞区',activity:'陆家嘴大型会展活动安保'};
  m.title='跨越东侧城区正常巡航，前往新 C 点';
  m.reason='从 B 点进入东侧城区，沿道路与建筑外缘依次绕过多栋建筑，充分利用扩展地图后到达东北建筑群入口；飞行期间持续检查临时空域通告。';
 }
 if(index===2){m.route=[a,[1000,214],[1038,434],[772,532],[772,676],b];m.initialRoute=C.clone(m.route);m.alternative=C.clone(m.route);m.routeRevision='n4-long-legs-v7';m.controlPoints=[[1000,214],[1038,434],[772,532],[772,676],[618,816]];m.title='沿五个长航段绕建筑飞往 D 点';m.subtype='dynamic';m.reason='N4 沿城区通道以五个长航段飞行，仅保留四次主要转向；D 点位于操作者原图点 6，60 m 高度下最小建筑净距超过 21.8 m；交通目标在直线航段从前方以 9 m/s 接近，起飞后按双方位置和速度持续预测未来 30 秒的最近间隔。';m.limits+=' 采用匀速交通目标和三维间隔预测，40 m 为实验告警阈值，非真实适航标准。';}
 if(index===3){m.battery=Math.min(battery,Math.ceil(C.length([a,b])*.016+17));m.alternative=[a,points[0].point.slice()];m.title='电量余量下降，选择继续或返航';m.landingOnArrival=true;m.reason='实验注入电量下降。按巡航耗电估算，直达 E 尚可保留约 15% 余量；返航方案需单独检查，可能因距离过长而不可行。';m.limits+=' 能耗随仿真时间、飞行距离和升降变化，未计风速、载荷和电池老化。';}
 m.event=`${m.id} ${m.name} · ${'ABCDE'[index]} → ${'ABCDE'[index+1]}`;m.summary=m.title+'。请接受、修改或拒绝；确认后继续同一任务。';
 if(index===0)m.summary='路线包含 11 个互不交叉的航段和 4 个拍照打卡点；整体沿手绘外围环线，仅在碰撞位置局部绕障，完整模型最小净距约 22.0 m。请先复核路线。';
 if(index===3)m.summary+=' 到达选定终点后将自动下降着陆。';
 if(index===1){m.event='N2 航迹转向 · 跨城区正常巡航阶段';m.summary='先沿约 1.07 公里的跨城区航线绕过多栋建筑前往新 C 点；AI 在飞行中持续检查前方空域变化。';}
 return m;
}
const api={points,landmarks,nodes,make,n2Detours,n2EventWindow,n2DynamicNoFlyZone};if(typeof module!=='undefined')module.exports=api;else root.Sequence=api;
})(typeof window!=='undefined'?window:globalThis);



