(function(root){
const C=typeof module!=='undefined'?require('./core.js'):root.UAV;
const destinations=[{id:'north',name:'公园北侧入口',point:[310,130]},{id:'lake',name:'湖边巡检点',point:[350,300]},{id:'building',name:'园区建筑巡检点',point:[600,260]},{id:'east',name:'东侧巡检点',point:[730,420]},{id:'home',name:'起降区',point:[130,525]}];
const categories={N1:'航迹跟随',N2:'航迹转向',N34:'避障／冲突处置',N5:'资源可行性下降'};
function make(node,id,subtype='static',options={}){
if(!categories[node])throw Error('未知情境');const dest=destinations.find(d=>d.id===id);if(!dest)throw Error('请选择预设目的地');
const a=options.origin?options.origin.slice():[420,500],b=dest.point.slice(),dx=b[0]-a[0],dy=b[1]-a[1],dist=Math.hypot(dx,dy),normal=dist?[-dy/dist,dx/dist]:[0,1];if(dist<3)throw Error('无人机已在该目的地附近，请选择其他地点');const p=(t,k=0)=>[a[0]+dx*t+normal[0]*k,a[1]+dy*t+normal[1]*k];
const m={id:node,name:categories[node],destination:dest,subtype:node==='N34'?subtype:null,route:[a,p(.5),b],alternative:[a,p(.5,35),b],initialRoute:[a,p(.5),b],battery:82,goal:'到达'+dest.name,title:'保持航迹，前往'+dest.name,event:'既定航迹待复核',reason:'当前预设情境没有新增障碍，既定航线通向所选目标。',limits:'真实航空影像与平面地表；飞行、障碍与遥测均为模拟。',error:'未建立经过校准的出错概率模型。',history:'暂无经验证的历史执行表现。'};
if(node==='N2'){m.initialRoute=[a,p(.4,-65),b];m.title='调整航向，继续前往目标';m.event='下一航段方向需要调整';m.reason='当前进入目标的航段存在偏折；调整中间航点，目的地保持不变。'}
if(node==='N34'){const h=p(.5),r=Math.min(40,Math.max(4,dist*.1));m.hazard={x:h[0],y:h[1],r,margin:Math.min(10,dist*.07)};const offset=(r+m.hazard.margin)*1.7;m.route=[a,p(.32,offset),p(.68,offset),b];m.alternative=[a,p(.32,-offset),p(.68,-offset),b];m.title=subtype==='dynamic'?'绕开预测冲突区':'绕开静态限制区';m.event=subtype==='dynamic'?'预设移动目标进入航段':'航段出现建筑／限制区';m.reason=subtype==='dynamic'?'预设交通目标的占用走廊与原路线相交；按扩大后的二维缓冲区绕行。':'原路线穿过模拟限制圆，绕行方案按边界外 10 m 余量检查。';m.limits+=' 仅检查二维区域；动态情境使用预设走廊，不计算真实时空冲突概率。'}
if(node==='N5'){m.battery=Math.ceil(Math.max(dist,C.length([a,[130,525]]))*.016+17);m.initialRoute=[a,[800,80],b];m.alternative=[a,[130,525]];m.title='缩短航线，优先完成目标';m.event='资源余量下降';m.reason='原绕行路线的估计终点电量不足 15%；直达目标可减少路程。备选是中止目标并返航起降区。';m.limits+=' 电量按固定每米消耗估算，不包含风、载荷和电池老化。'}if(Number.isFinite(options.battery))m.battery=Math.min(m.battery,options.battery);if(C.validate(m.route,m).length&& !C.validate(m.alternative,m).length){const r=m.route;m.route=m.alternative;m.alternative=r;}m.summary=m.title+'。请复核路线，也可修改或拒绝。';return m;
}const api={destinations,categories,make};if(typeof module!=='undefined')module.exports=api;else root.Missions=api;
})(typeof window!=='undefined'?window:globalThis);
