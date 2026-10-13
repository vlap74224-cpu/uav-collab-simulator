(function(root){
const C=typeof module!=='undefined'?require('./core.js'):root.UAV;
const points=[{id:'home',name:'A · 起降区',point:[130,525]},{id:'lake',name:'B · 湖边巡检点',point:[350,300]},{id:'north',name:'C · 公园北侧入口',point:[310,130]},{id:'building',name:'D · 建筑巡检点',point:[600,260]},{id:'east',name:'E · 东侧终点',point:[730,420]}];
const nodes=['N1','N2','N4','N5'];
function make(index,origin,battery){
 const a=origin.slice(),b=points[index+1].point.slice(),dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),p=(t,k=0)=>[a[0]+dx*t-dy/len*k,a[1]+dy*t+dx/len*k];
 const m={id:nodes[index],name:['航迹跟随','航迹转向','动态冲突','资源可行性下降'][index],destination:points[index+1],route:[a,b],initialRoute:[a,b],alternative:[a,p(.5,25),b],battery,subtype:null,limits:'航空影像平面地表与预设实验事件；不连接真实无人机。',error:'未建立校准的出错概率模型。',history:'暂无经过验证的历史执行表现。'};
 if(index===0){m.title='沿 A → B 既定航迹飞行';m.reason='当前无新增冲突，保持路线到达 B 点。';}
 if(index===1){m.title='在 B 点转向，继续前往 C';m.reason='已完成 A → B；下一目标位于北侧，需调整航向后进入 B → C 航段。';}
 if(index===2){m.title='移动目标进入 C → D，建议绕行';m.subtype='dynamic';const h=p(.5);m.hazard={x:h[0],y:h[1],r:28,margin:12};m.route=[a,p(.25,75),p(.75,75),b];m.alternative=[a,p(.25,-75),p(.75,-75),b];m.reason='预设移动目标正穿越原航段，建议绕开其预测占用区，随后回到 D 点。';m.limits+=' 动态目标与占用区均为模拟，不计算真实时空冲突概率。';}
 if(index===3){m.battery=Math.min(battery,Math.ceil(C.length([a,b])*.016+17));m.alternative=[a,points[0].point.slice()];m.title='电量余量下降，选择继续或返航';m.reason='实验注入电量下降。按固定每米耗电模型，直达 E 尚可保留 15% 余量；返航方案需单独检查，可能因距离过长而不可行。';m.limits+=' 能耗未计风速、载荷和电池老化。';}
 m.event=`${m.id} ${m.name} · ${'ABCDE'[index]} → ${'ABCDE'[index+1]}`;m.summary=m.title+'。请接受、修改或拒绝；确认后继续同一任务。';return m;
}
const api={points,nodes,make};if(typeof module!=='undefined')module.exports=api;else root.Sequence=api;
})(typeof window!=='undefined'?window:globalThis);
