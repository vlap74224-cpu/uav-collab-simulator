const assert=require('node:assert/strict'),C=require('./dist/core.js'),M=require('./dist/mission.js'),F=require('./dist/flight-controls.js');
for(const from of M.destinations)for(const to of M.destinations){if(from===to)continue;for(const node of Object.keys(M.categories)){const m=M.make(node,to.id,'static',{origin:from.point,battery:82});assert.deepEqual(m.route[0],from.point);assert.deepEqual(m.route.at(-1),to.point);assert.deepEqual(C.validate(m.route,m),[],`${node} ${from.id} -> ${to.id}`)}}
assert.throws(()=>M.make('N1','lake','static',{origin:[350,300]}));
const routes=M.destinations.map(d=>JSON.stringify(M.make('N1',d.id).route));assert.equal(new Set(routes).size,5);
const route=[[0,0],[10,0],[10,10]];assert.deepEqual(F.travelled(route,.75),[[0,0],[10,0],[10,5]]);assert.deepEqual(F.travelled(route,0),[[0,0]]);assert.deepEqual(F.travelled(route,1),route);
assert.equal(F.vertical(60,65,1).altitude,63);assert.equal(F.vertical(64,65,1).altitude,65);assert.equal(F.vertical(30,0,1).altitude,27);assert.equal(F.vertical(120,150,1).altitude,120);assert.equal(F.vertical(60,55,1).verticalSpeed,-3);
console.log('PASS: 80 destination-to-destination routes; distinct endpoints; travelled segments; climb/descent limits.');
let p={x:450,y:330,heading:0};assert.equal(F.move(p,{forward:1},1).y,325);assert.equal(F.move(p,{right:1},1).x,455);assert.equal(F.move(p,{turn:1},2).heading,90);assert.equal(F.move({...p,heading:90},{forward:1},1).x,455);assert.ok(Math.abs(F.move(p,{forward:1,right:1},1).distance-5)<1e-8);assert.equal(F.move({x:795,y:35,heading:0},{forward:1,right:1},1).distance,0);
console.log('PASS: body-relative directional movement, heading rotation, diagonal normalization and map boundary.');
