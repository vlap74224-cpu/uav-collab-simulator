'use strict';
const assert=require('node:assert/strict');
global.N4Decision=require('./dist/n4-decision');
const Status=require('./dist/n4-status');
const mission={destination:{name:'D · 建筑巡检点'},n4Plan:{choice:'原方案的选择依据'}};
const live={current:664.1,targetSpeed:9,remaining:{distance:350},next:{name:'航路点3',distance:112},deviation:.4,selected:{distance:663,seconds:0},forecast:{seconds:51,endBattery:79.8},check:{valid:true,min:32.1}};
const text=levels=>levels.map(level=>level[2].map(row=>row.join('：')).join('\n')).join('\n');
const manual={status:'manual',manualSpeed:0,n4Action:'ai',n4Decision:{status:'resolved',source:'timeout'},n4Execution:{source:'timeout',check:{valid:true,min:24},risk:{distance:100,seconds:17}},trafficMinimum:88,route:[[0,0],[10,10]]};
const before=JSON.stringify({manual,mission,live});
const hovering=Status.describe({state:manual,mission,live});
assert.deepEqual(hovering.map(level=>level[1]),['L1 当前目标与行动','L2 决策依据与约束','L3 预期结果与局限']);
assert(hovering.every(level=>level[2].length===3),'manual presentation keeps three compact rows per level');
assert(text(hovering).includes('手动接管，自动避让已暂停'));
assert(text(hovering).includes('本机悬停，等待操控'));
assert(text(hovering).includes('目的地仍为建筑巡检点'));
assert(text(hovering).includes('飞行物当前间隔664.1m／要求≥40m'));
assert(text(hovering).includes('从当前位置重新检查接入段'));
assert(text(hovering).includes('暂不提供到达预测'));
assert(!text(hovering).includes('AI已自动开始避让'));
assert(!text(hovering).includes('51秒后'));
assert(!text(hovering).includes('663.0m'),'old route risk must not become a manual-motion forecast');
assert(!text(hovering).includes('检查通过'),'a former checked route does not establish manual-flight safety');
assert.equal(JSON.stringify({manual,mission,live}),before,'presentation must not change execution state');
for(const overrides of [
 {n4AvoidanceComplete:true},
 {n4Action:'emergency',landing:{targetAltitude:0}},
 {n4Action:'user',n4Decision:{status:'resolved',source:'modify'}},
 {n4Decision:{status:'active',seconds:8},n4Planning:true},
 {n4Execution:{source:'accept',check:{valid:true}}},
]){
 const levels=Status.describe({state:{...manual,...overrides},mission,live});
 assert.equal(levels[0][2][0][1],'手动接管，自动避让已暂停','manual status must take priority over old action flags');
 assert(!text(levels).includes('51秒后'));
}
const moving=Status.describe({state:{...manual,manualSpeed:4.25},mission,live});
assert(text(moving).includes('手动飞行 · 地速4.3m/s'));
assert(!text(moving).includes('本机悬停'));
const missing=Status.describe({state:{...manual,manualSpeed:undefined},mission,live:{...live,current:undefined}});
assert(text(missing).includes('手动速度信息待更新'));
assert(text(missing).includes('飞行物当前间隔尚未更新'));
const running=Status.describe({state:{...manual,status:'running'},mission,live});
assert(text(running).includes('决策超时，AI已自动开始避让'),'normal automatic execution remains unchanged');
assert(text(running).includes('51秒后到建筑巡检点'));
const collision=Status.describe({state:{...manual,status:'collision'},mission,live});
assert.equal(collision[0][2][0][1],'发生碰撞，本次飞行已停止','actual collision remains the highest priority');
console.log('PASS N4 manual/hover display overrides stale auto-execution flags and suppresses outdated route predictions');
