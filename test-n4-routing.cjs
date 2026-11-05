'use strict';
const assert=require('node:assert/strict'),C=require('./dist/core'),N=require('./dist/n4-decision'),Sequence=require('./dist/sequence'),Traffic=require('./dist/traffic');

// During the decision the aircraft continues along A, including past A's
// corner. Reattaching C/B must consume the reached prefix rather than send it
// back through the earlier eastbound waypoints.
const original=[[0,0],[100,0],[100,150],[300,150]],plan={original,anchorDistance:50,rejoinDistance:250,branch:[[50,0],[70,0],[100,0],[100,100],[100,150]]};
const origin={x:100,y:50},expected=[[100,50],[100,100],[100,150],[300,150]];
assert.deepEqual(N.attach(plan,origin),expected);
assert.deepEqual(N.rebase([[0,0],[70,0],[100,0],[100,100],[100,150],[300,150]],origin),expected);
assert.equal(N.hasBacktrack(N.attach(plan,origin)),false);
assert.deepEqual(N.attach(plan,{x:100,y:125}),[[100,125],[100,150],[300,150]]);
assert.deepEqual(N.attach(plan,{x:200,y:150}),[[200,150],[300,150]]);
assert.deepEqual(plan.branch,[[50,0],[70,0],[100,0],[100,100],[100,150]],'rebasing must not mutate the stored branch');

// Proximity to a later leg across a building does not authorize a shortcut.
// Only a position actually on the draft polyline can consume that prefix.
const aroundBuilding=[[0,0],[0,100],[100,100],[100,0]];
assert.deepEqual(N.rebase(aroundBuilding,{x:90,y:0}),[[90,0],[0,100],[100,100],[100,0]]);
assert.deepEqual(N.rebase(aroundBuilding,{x:100,y:50}),[[100,50],[100,0]]);

const mission=Sequence.make(2,Sequence.points[2].point,82),traffic=Traffic.create(mission.route[0],mission.destination.point,12,mission.route);
traffic.time=traffic.alertAfter;
const own=C.sample(mission.route,traffic.time*12/C.length(mission.route)),setup=N.templates(mission.route,own,12,traffic);
assert.deepEqual(setup.rejoins.map(p=>p.rejoin),[[772,676],[618,816]],'try a downstream route corner and D instead of a mid-road reconnect');
for(const p of setup.candidates){assert(mission.route.some(q=>Math.hypot(q[0]-p.branch.at(-1)[0],q[1]-p.branch.at(-1)[1])<.001));assert.deepEqual(N.attach(p,own).at(-1),mission.destination.point);}
const oldHairpin=[[914.14,479.63],[962.14,719.63],[842.14,839.63],[746.14,767.63],[772,605.97],[772,676],[618,816]];
assert.equal(N.hasBacktrack(oldHairpin),true,'regress the south-to-north-to-south rejoin that caused the reported reversal');
const toD={...setup.rejoins.at(-1),branch:[setup.anchor,[962.14,719.63],[842.14,839.63],[650.14,791.63],mission.destination.point]};
const route=N.attach(toD,own);
assert.equal(N.hasBacktrack(route),false);
assert.deepEqual(route.at(-1),mission.destination.point);
assert(route.slice(1).every((p,i)=>Math.hypot(p[0]-route[i][0],p[1]-route[i][1])>.001),'do not duplicate D when rejoining at D');
console.log('PASS N4 moving-origin corner/branch rebasing, downstream rejoin alternatives, and reported hairpin regression');
