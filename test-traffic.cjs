const assert=require('node:assert/strict'),C=require('./dist/core.js'),T=require('./dist/traffic.js'),S=require('./dist/sequence.js');
const a=S.points[2].point,b=S.points[3].point,t=T.create(a,b,12);
assert.ok(T.predict([a,b],0,12,60,t).conflict);
assert.ok(T.predict([a,b],0,12,60,t).distance<1);
assert.equal(T.predict([a,b],0,12,120,t).conflict,false);
const p=T.position(t,2),q=T.position(t);assert.ok(Math.abs(Math.hypot(p.x-q.x,p.y-q.y)-18)<1e-8);
t.time=30;assert.equal(T.predict([a,b],0,12,60,t).conflict,false);
for(let i=0;i<4;i++){const m=S.make(i,S.points[i].point,82);assert.deepEqual(m.route[0],S.points[i].point);assert.deepEqual(m.route.at(-1),S.points[i+1].point);assert.deepEqual(C.validate(m.route,m,60,12),[])}
console.log('PASS crossing CPA, altitude separation, physical target speed, clearance after passage, all four segment endpoints.');
