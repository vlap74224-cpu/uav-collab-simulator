const assert = require('node:assert/strict');
const c = require('./dist/core.js');
for (const scenario of c.scenarios) {
  assert.deepEqual(c.validate(scenario.route, scenario), [], scenario.id + ' recommended route');
  assert.deepEqual(c.validate(scenario.alternative, scenario), [], scenario.id + ' alternative route');
  assert.ok(c.estimate(scenario.route, scenario.battery, 8).endBattery >= 15);
  const start = c.sample(scenario.route, 0), end = c.sample(scenario.route, 1);
  assert.deepEqual([start.x, start.y], scenario.route[0]);
  assert.ok(Math.hypot(end.x-scenario.route.at(-1)[0],end.y-scenario.route.at(-1)[1]) < 1e-9);
}
assert.ok(c.validate(c.base, c.scenarios[2]).some(x => x.includes('限制区域')));
assert.ok(c.validate(c.base, c.scenarios[3]).some(x => x.includes('限制区域')));
assert.ok(c.validate(c.base, c.scenarios[4]).some(x => x.includes('电量')));
assert.ok(c.validate([[NaN, 1], [2, 3]], c.scenarios[0]).length);
assert.deepEqual(c.workArea, {minX:-345,maxX:1245,minY:-295,maxY:955});
assert.ok(c.validate([[-346,0],[0,0]], c.scenarios[0]).some(x=>x.includes('作业区')));
assert.ok(c.validate(c.base, c.scenarios[0], 500, -1).length === 2);
assert.equal(c.distanceToSegment([5, 5], [0, 0], [10, 0]), 5);
assert.deepEqual(c.nearestPointOnRoute([[0,0],[10,0],[10,10]],[6,2]),{segmentIndex:0,t:.6,point:[6,0],distance:2});
assert.deepEqual(c.nearestPointOnRoute([[0,0],[10,0],[10,10]],[13,7]),{segmentIndex:1,t:.7,point:[10,7],distance:3});
assert.equal(c.length([[1, 1], [1, 1]]), 0);
assert.ok(Number.isFinite(c.sample([[1, 1], [1, 1]], .5).x));
const denseStraight=Array.from({length:101},(_,i)=>[i,i]);
assert.deepEqual(c.simplifyRoute(denseStraight,8),[[0,0],[100,100]]);
const denseTurn=[[0,0],...Array.from({length:49},(_,i)=>[i+1,0]),...Array.from({length:51},(_,i)=>[50,i])];
const simplified=c.simplifyRoute(denseTurn,8);
assert.ok(simplified.length<=8);
assert.deepEqual(simplified[0],denseTurn[0]);
assert.deepEqual(simplified.at(-1),denseTurn.at(-1));
assert.ok(simplified.some(p=>p[0]===50&&p[1]===0),'key turn is preserved');
console.log('PASS: five scenario routes, alternate routes, hazard and energy constraints, invalid inputs and trajectory sampling.');

