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
  assert.equal(m.route.length,12);
  assert.equal(m.routeRevision,'n1-user-drawn-ring-v9');
  assert.equal(m.photoCheckpoints.length,4);
  assert.deepEqual(m.photoCheckpoints.map(x=>x.routeIndex),[2,3,4,7]);
  assert.deepEqual(m.photoCheckpoints.map(x=>x.point),[m.route[2],m.route[3],m.route[4],m.route[7]]);
  assert.deepEqual(m.photoCheckpoints[0].target,[-228.5,748.9]);
  assert.deepEqual(m.photoCheckpoints[1].target,[-163,682.8]);
  assert.deepEqual(m.photoCheckpoints[2].target,[-225,595]);
  assert.deepEqual(m.photoCheckpoints[3].target,[-117,170]);
  assert.equal(m.photoCheckpoints[3].targetAltitude,150);
  assert.ok(m.photoCheckpoints.every((x,j,a)=>j===0||x.progress>a[j-1].progress));
  assert.equal(m.photoCheckpoint,m.photoCheckpoints[0]);
  const orient=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const crosses=(a,b,c,d)=>orient(a,b,c)*orient(a,b,d)<0&&orient(c,d,a)*orient(c,d,b)<0;
  for(let a=0;a<m.route.length-1;a++)for(let b=a+2;b<m.route.length-1;b++)assert.equal(crosses(m.route[a],m.route[a+1],m.route[b],m.route[b+1]),false,`N1 route segments ${a} and ${b} cross`);
 }
 if(i===1){
  assert.equal(m.route.length,7);
  assert.equal(m.routeRevision,'n2-temporary-no-fly-v4-clean-route');
  assert.ok(m.route.slice(1).every((point,j)=>point[0]>=m.route[j][0]),'N2 route should keep progressing east without backtracking');
  assert.ok(C.length(m.route)>1000);
  assert.equal(m.plannedNoFlyZone.label,'大型活动临时禁飞区');
  assert.deepEqual(m.initialRoute,m.route);
  const zone={...m,hazard:m.plannedNoFlyZone};
  assert.ok(C.validate(m.initialRoute,zone).length>0,'original N2 route should enter the newly announced no-fly zone');
  const trigger=C.sample(m.route,m.plannedNoFlyZone.triggerProgress),detours=S.n2Detours([trigger.x,trigger.y],m.destination.point);
  assert.equal(detours.length,2);
  for(const route of detours)assert.deepEqual(C.validate(route,zone),[]);
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

