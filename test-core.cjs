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
assert.equal(c.length([[1, 1], [1, 1]]), 0);
assert.ok(Number.isFinite(c.sample([[1, 1], [1, 1]], .5).x));
console.log('PASS: five scenario routes, alternate routes, hazard and energy constraints, invalid inputs and trajectory sampling.');
