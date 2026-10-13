(function(root){
const C=typeof module!=='undefined'?require('./core.js'):root.UAV;
const points=[{id:'home',name:'A · 起降区',point:[130,525]},{id:'lake',name:'B · 湖边巡检点',point:[350,300]},{id:'north',name:'C · 公园北侧入口',point:[310,130]},{id:'building',name:'D · 建筑巡检点',point:[600,260]},{id:'east',name:'E · 东侧终点',point:[730,420]}];
const nodes=['N1','N2','N4','N5'];
function make(index,origin,battery){
 const a=origin.slice(),b=points[index+1].point.slice(),dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),p=(t,k=0)=>[a[0]+dx*t-dy/len*k,a[1]+dy*t+dx/len*k];
 const m={id:nodes[index],name:['航迹跟随','航迹转向','动态冲突','资源可行性下降'][index],destination:points[index+1],route:[a,b],initialRoute:[a,b],alternative:[a,p(.5,25),b],battery,subtype:null,limits:'swisstopo 真实三维地形与建筑；事件和无人机为仿真。碰撞检测针对已加载模型。',error:'未建立校准的出错概率模型。',history:'暂无经过验证的历史执行表现。'};
 if(index===0){m.title='沿 A → B 既定航迹飞行';m.reason='当前无新增冲突，保持路线到达 B 点。';}
 if(index===1){m.title='在 B 点转向，继续前往 C';m.reason='当前位于 B 点；下一目标位于北侧，需调整航向后进入 B → C 航段。';}
 if(index===2){m.title='沿 C → D 飞行，监测移动目标';m.subtype='dynamic';m.reason='交通目标以 9 m/s 穿越本航段；起飞后按双方位置和速度持续预测未来 30 秒的最近间隔。';m.limits+=' 采用匀速交通目标和三维间隔预测，40 m 为实验告警阈值，非真实适航标准。';}
 if(index===3){m.battery=Math.min(battery,Math.ceil(C.length([a,b])*.016+17));m.alternative=[a,points[0].point.slice()];m.title='电量余量下降，选择继续或返航';m.reason='实验注入电量下降。按固定每米耗电模型，直达 E 尚可保留 15% 余量；返航方案需单独检查，可能因距离过长而不可行。';m.limits+=' 能耗未计风速、载荷和电池老化。';}
 m.event=`${m.id} ${m.name} · ${'ABCDE'[index]} → ${'ABCDE'[index+1]}`;m.summary=m.title+'。请接受、修改或拒绝；确认后继续同一任务。';return m;
}
const api={points,nodes,make};if(typeof module!=='undefined')module.exports=api;else root.Sequence=api;
})(typeof window!=='undefined'?window:globalThis);


