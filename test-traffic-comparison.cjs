const assert=require('node:assert/strict'),C=require('./dist/core'),Q=require('./dist/traffic-comparison'),I=require('./dist/sat-information');
const s={route:[[0,0],[0,60],[200,60],[200,0]],progress:0,speed:10,altitude:60,status:'review',conflictAlert:true,traffic:{x:200,y:0,vx:-10,vy:0,time:0,altitude:60}},m={id:'N4',title:'建议绕行',route:s.route,initialRoute:[[0,0],[200,0]],destination:{name:'D'},battery:80};
const q=Q.compare(s,m);assert.equal(q.current,200);assert(q.original.distance<.01);assert(q.suggested.distance>40);assert(Math.abs(q.original.seconds-10)<.11);
const paused=Q.compare({...s,status:'paused',manualSpeed:0},m);assert.deepEqual(paused,q,'pausing cannot replace planned speed with zero');assert.equal(Q.compare({...s,speed:0},m).original,null);assert.equal(Q.compare({...s,traffic:null},m).original,null);
const movingAway=Q.compare({...s,traffic:{...s.traffic,vx:20}},m);assert.equal(movingAway.original.seconds,0,'zero is a valid current minimum, not a missing prediction');
const wait=Q.compare({...s,status:'waiting'},m);assert(wait.suggested.distance<1,'hover plan must predict a stationary own aircraft');
for(const condition of ['action','reason','projection']){const levels=I.describe({state:s,mission:m,position:{x:0,y:0},ready:true,comparison:q});assert.equal(levels.length,3);assert(levels.every(l=>l[2].length===3));assert(!JSON.stringify(levels).includes('抵达电量'));assert.equal(levels[2][2][0][1].original,'0.0 m');}
console.log('PASS same-epoch original/suggested predictions, pause/resume planned speeds, hover, missing data and N4 compact content');
