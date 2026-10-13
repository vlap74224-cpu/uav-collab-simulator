const assert=require('node:assert/strict'),C=require('./dist/core.js'),M=require('./dist/mission.js');
let count=0;
for(const dest of M.destinations)for(const node of Object.keys(M.categories))for(const sub of node==='N34'?['static','dynamic']:['static']){
 const m=M.make(node,dest.id,sub);assert.deepEqual(m.route.at(-1),dest.point);assert.deepEqual(m.route[0],[420,500]);
 for(const route of [m.route,m.alternative]){assert.deepEqual(C.validate(route,m),[],`${node}/${dest.id}/${sub}`);assert.ok(C.estimate(route,m.battery,8).endBattery>=15)}
 if(node==='N34')assert.ok(C.validate(m.initialRoute,m).length>0);
 if(node==='N5'){assert.ok(C.validate(m.initialRoute,m).length>0);assert.deepEqual(m.alternative.at(-1),[130,525])}
 count++;
}
assert.throws(()=>M.make('N1','unknown'));assert.throws(()=>M.make('N3','north'));
console.log(`${count} destination / scenario combinations passed, both route choices checked.`);
