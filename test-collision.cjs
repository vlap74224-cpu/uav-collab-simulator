const assert=require('node:assert/strict'),B=require('./dist/collision.js'),T=require('./dist/traffic.js'),S=require('./dist/sequence.js'),C=require('./dist/core.js');
const a={x:0,y:0,z:60},b={x:100,y:0,z:60};
assert.ok(B.sphereHit(a,b,{x:50,y:-50,z:60},{x:50,y:50,z:60})<.5);
assert.equal(B.sphereHit(a,b,{x:50,y:-50,z:80},{x:50,y:50,z:80}),null);
assert.ok(B.boxHit(a,b,{x:50,y:0,w:10,d:10,h:80})<.5);
assert.equal(B.boxHit({...a,z:100},{...b,z:100},{x:50,y:0,w:10,d:10,h:80}),null);
for(let i=0;i<4;i++){const m=S.make(i,S.points[i].point,82);assert.equal(B.detect({x:m.route[0][0],y:m.route[0][1],z:60},{x:m.route.at(-1)[0],y:m.route.at(-1)[1],z:60}),null)}
const route=[S.points[2].point,S.points[3].point];
for(const step of [.016,.128,.8]){const t=T.create(...route,12);let hit=false;for(let s=0;s<20;s+=step){const p=C.sample(route,s*12/C.length(route)),q=C.sample(route,(s+step)*12/C.length(route));t.time=s;const x=T.position(t),y=T.position(t,step);if(B.sphereHit({...p,z:60},{...q,z:60},{...x,z:60},{...y,z:60})!==null){hit=true;break}}assert.ok(hit,'swept collision at dt '+step)}
console.log('PASS swept moving-body collision, altitude clearance, building contact, route clearance and no tunnelling at 1x/8x.');
