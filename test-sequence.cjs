const assert=require('node:assert/strict'),S=require('./dist/sequence.js'),C=require('./dist/core.js');
let battery=82;
for(let i=0;i<4;i++){
 const m=S.make(i,S.points[i].point,battery);
 assert.equal(m.id,['N1','N2','N4','N5'][i]);
 assert.deepEqual(m.route[0],S.points[i].point);
 assert.deepEqual(m.route.at(-1),S.points[i+1].point);
 assert.deepEqual(C.validate(m.route,m),[]);
 assert.ok(m.battery<=battery);
 if(i===0){
  assert.equal(m.route.length,8);
  assert.equal(m.routeRevision,'n1-left-building-tour-v6');
  assert.equal(m.photoCheckpoints.length,4);
  assert.deepEqual(m.photoCheckpoints.map(x=>x.routeIndex),[1,2,3,5]);
  assert.deepEqual(m.photoCheckpoints.map(x=>x.point),[m.route[1],m.route[2],m.route[3],m.route[5]]);
  assert.deepEqual(m.photoCheckpoints[0].target,[-225,595]);
  assert.deepEqual(m.photoCheckpoints[1].target,[-163,682.8]);
  assert.deepEqual(m.photoCheckpoints[2].target,[-228.5,748.9]);
  assert.deepEqual(m.photoCheckpoints[3].target,[-117,170]);
  assert.equal(m.photoCheckpoints[3].targetAltitude,150);
  assert.ok(m.photoCheckpoints.every((x,j,a)=>j===0||x.progress>a[j-1].progress));
  assert.equal(m.photoCheckpoint,m.photoCheckpoints[0]);
 }
 if(i===2){assert.equal(m.subtype,'dynamic');assert.equal(m.hazard,undefined);assert.deepEqual(C.validate(m.initialRoute,m),[])}
 if(i===3)assert.ok(m.battery<battery);
 battery=m.battery-C.length(m.route)*.016;
 const halfway=C.sample(m.route,.3),resumed=S.make(i,[halfway.x,halfway.y],battery);
 assert.deepEqual(resumed.route[0],[halfway.x,halfway.y]);
 assert.ok(resumed.battery<=battery);
}
assert.ok(battery>=15);console.log('Four sequential events, endpoints, collision clearance, resource drop and resumption passed.');
assert.equal(S.landmarks.length,15);
for(const name of ['东方明珠','金茂大厦','环球金融中心','震旦大厦','香格里拉酒店','招商局大厦','时代金融'])assert.ok(S.landmarks.some(x=>x.shortName===name));
assert.equal(S.landmarks.some(x=>x.id==='shanghai-tower'),false);
assert.deepEqual(S.landmarks.find(x=>x.id==='aurora').point,[-228.5,748.9]);
assert.deepEqual(S.landmarks.find(x=>x.id==='huaneng-united').point,[617.1,328]);
