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
  assert.equal(m.route.length,14);
  assert.equal(m.photoCheckpoint.routeIndex,6);
  assert.equal(m.photoCheckpoint.landmarkId,'oriental-pearl');
  assert.deepEqual(m.photoCheckpoint.target,[-117,170]);
  assert.equal(m.photoCheckpoint.targetAltitude,120);
  assert.equal(m.routeRevision,'n1-oriental-pearl-v2');
  assert.deepEqual(m.photoCheckpoint.point,m.route[6]);
  assert.ok(m.photoCheckpoint.progress>.4&&m.photoCheckpoint.progress<.8);
 }
 if(i===2){assert.equal(m.subtype,'dynamic');assert.equal(m.hazard,undefined);assert.deepEqual(C.validate(m.initialRoute,m),[])}
 if(i===3)assert.ok(m.battery<battery);
 battery=m.battery-C.length(m.route)*.016;
 const halfway=C.sample(m.route,.3),resumed=S.make(i,[halfway.x,halfway.y],battery);
 assert.deepEqual(resumed.route[0],[halfway.x,halfway.y]);
 assert.ok(resumed.battery<=battery);
}
assert.ok(battery>=15);console.log('Four sequential events, endpoints, collision clearance, resource drop and resumption passed.');
assert.equal(S.landmarks.length,16);
for(const name of ['东方明珠','上海中心','金茂大厦','环球金融中心','震旦大厦','香格里拉酒店','招商局大厦','时代金融'])assert.ok(S.landmarks.some(x=>x.shortName===name));
