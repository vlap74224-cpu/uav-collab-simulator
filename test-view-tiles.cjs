const assert=require('node:assert/strict'),V=require('./dist/view-tiles.js');
const start={x:420,y:500,heading:0,altitude:60},a=V.requests(start,38);
assert.equal(a.length,179);assert.equal(new Set(a.map(t=>t.key)).size,a.length);assert.equal(a.filter(t=>t.z===20).length,49);
assert.equal(V.grid(17).size/V.grid(20).size,8);
for(const pitch of [20,38,85])for(const heading of [0,90,180,270]){
 const s={...start,heading},tiles=V.requests(s,pitch),reach=Math.min(260,Math.max(35,60/Math.tan(pitch*Math.PI/180))),fx=s.x-450+Math.sin(heading*Math.PI/180)*reach,fy=s.y-330-Math.cos(heading*Math.PI/180)*reach;
 assert.ok(tiles.some(t=>t.z===20&&Math.abs(t.worldX-fx)<=t.size/2&&Math.abs(t.worldY-fy)<=t.size/2));
 assert.ok(tiles.every(t=>[t.x,t.y,t.size,t.worldX,t.worldY].every(Number.isFinite)));
}
assert.notDeepEqual(a.map(t=>t.key),V.requests({...start,x:730,y:420},38).map(t=>t.key));
console.log('PASS: LOD tile coverage, 8x linear detail, bounded working set and camera-follow selection.');
