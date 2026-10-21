const assert=require('node:assert/strict'),C=require('./dist/core.js'),T=require('./dist/traffic.js'),S=require('./dist/sequence.js');
const a=S.points[2].point,b=S.points[3].point,t=T.create(a,b,12);
assert.ok(T.predict([a,b],0,12,60,t,60).conflict);
assert.ok(T.predict([a,b],0,12,60,t,60).distance<1);
assert.equal(T.predict([a,b],0,12,120,t).conflict,false);
const p=T.position(t,2),q=T.position(t);assert.ok(Math.abs(Math.hypot(p.x-q.x,p.y-q.y)-18)<1e-8);
t.time=30;assert.equal(T.predict([a,b],0,12,60,t,60).conflict,false);
for(let i=0;i<4;i++){const m=S.make(i,S.points[i].point,82);assert.deepEqual(m.route[0],S.points[i].point);assert.deepEqual(m.route.at(-1),S.points[i+1].point);assert.deepEqual(C.validate(m.route,m,60,12),[])}
console.log('PASS crossing CPA, altitude separation, physical target speed, clearance after passage, all four segment endpoints.');

const n4=S.make(2,S.points[2].point,82),n4Traffic=T.create(n4.route[0],n4.route.at(-1),12,n4.route);n4Traffic.time=Math.max(0,n4Traffic.crossTime-20);const n4Risk=T.predict(n4.route,n4Traffic.time*12/C.length(n4.route),12,60,n4Traffic);assert.ok(n4Risk.conflict,'N4 traffic must cross the user-drawn route');
const alertProgress=.1,collisionTraffic=T.create(n4.route[0],n4.route.at(-1),12,n4.route);collisionTraffic.time=C.length(n4.route)*alertProgress/12;const collisionRoute=T.remainingRoute(n4.route,alertProgress),collisionRisk=T.predict(collisionRoute,0,12,60,collisionTraffic,collisionTraffic.crossTime+1);assert.ok(collisionRisk.conflict&&collisionRisk.distance<1,'continuing the remaining N4 route must physically meet the moving target');assert.deepEqual(collisionRoute.at(-1),n4.destination.point,'collision course must keep the new D destination');
