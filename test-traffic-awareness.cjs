const assert=require('node:assert/strict');
const {projectTarget,visibleSceneBounds,layoutTarget,decisionPrompt}=require('./dist/traffic-awareness.js');
const viewport={left:0,top:0,right:1194,bottom:834};
const camera={origin:{x:0,y:60,z:0},right:{x:1,y:0,z:0},up:{x:0,y:1,z:0},forward:{x:0,y:0,z:-1},fovY:60,aspect:1194/834,near:.8,far:2200,viewport};
const project=(target,extra={})=>projectTarget({...camera,target,...extra});
const blocked=[{left:856,top:56,right:1182,bottom:822},{left:12,top:514,right:292,bottom:744},{left:12,top:760,right:292,bottom:822},{left:310,top:698,right:832,bottom:822},{left:0,top:0,right:1194,bottom:44}];
const inside=(a,b)=>a.left>=b.left&&a.right<=b.right&&a.top>=b.top&&a.bottom<=b.bottom;
const intersects=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
const edgeBox=l=>({left:l.x-l.width/2,top:l.y-l.height/2,right:l.x+l.width/2,bottom:l.y+l.height/2});

const front=project({x:0,y:60,z:-500}),frontHud=layoutTarget({projection:front,viewport,obstacles:blocked,ringDiameter:12});
assert.equal(front.distance,500);assert.equal(front.bearing,0);assert.equal(front.inFrustum,true);
assert.equal(frontHud.mode,'target');assert.equal(frontHud.x,597);assert.equal(frontHud.y,417);
assert.equal(frontHud.diameter,38,'distant targets retain a minimum visible ring');
assert.ok(!blocked.some(r=>intersects(frontHud.label,r)),'label avoids the actual panel bounds');
const far=project({x:0,y:60,z:-1600}),farHud=layoutTarget({projection:far,viewport,obstacles:blocked});
assert.equal(farHud.mode,'target');assert.equal(farHud.diameter,38);assert.equal(far.distance,1600);

for(const target of [{x:0,y:60,z:500},{x:500,y:60,z:-100},{x:-500,y:60,z:-100},{x:0,y:560,z:-100},{x:0,y:-440,z:-100},{x:300,y:60,z:-500},{x:100,y:60,z:500},{x:-100,y:60,z:500}]){
  const p=project(target),layout=layoutTarget({projection:p,viewport,obstacles:blocked});
  assert.equal(layout.mode,'edge',JSON.stringify(target));
  assert.ok(Number.isFinite(layout.x)&&Number.isFinite(layout.y)&&Number.isFinite(layout.angle));
  assert.ok(inside(edgeBox(layout),viewport));assert.ok(!blocked.some(r=>intersects(edgeBox(layout),r)), 'edge cue avoids AI rail, map and footer');
}
const rear=project({x:0,y:60,z:500}),rearHud=layoutTarget({projection:rear,viewport,obstacles:blocked});
assert.equal(rear.behind,true);assert.equal(rear.screenX,null);assert.equal(rear.inFrustum,false);
assert.equal(rearHud.reason,'相机后方');assert.equal(rearHud.direction,'后方');assert.equal(rear.bearing,180);
assert.equal(rearHud.width,246);assert.equal(rearHud.height,40,'offscreen notice stays two compact lines');
assert.equal(edgeBox(rearHud).left,8,'notice uses outer viewport edge instead of central sight');
assert.ok(edgeBox(rearHud).bottom<100,'notice fits below the top bar');
const above=project({x:0,y:560,z:0}),aboveHud=layoutTarget({projection:above,viewport,obstacles:blocked});
assert.equal(above.behind,false);assert.equal(aboveHud.reason,'相机视角外');assert.equal(aboveHud.angle,-90);
const underRail=project({x:300,y:60,z:-500}),underRailHud=layoutTarget({projection:underRail,viewport,obstacles:blocked});
assert.equal(underRail.inFrustum,true);assert.equal(underRailHud.reason,'面板遮挡');
assert.notEqual(underRailHud.x,underRail.screenX,'a panel-covered target must not be falsely pinned to an in-scene location');
assert.equal(layoutTarget({projection:rear,viewport,obstacles:[viewport]}).mode,'hidden','never overlap a full-screen map');
assert.equal(visibleSceneBounds({left:0,top:0,right:100,bottom:80}),null);
assert.equal(decisionPrompt({phase:'decision',seconds:11.2}),'请在12秒内决策 → 右侧');
assert.equal(decisionPrompt({phase:'editing',seconds:8}),'剩余8秒，请提交路线');
assert.equal(decisionPrompt({phase:'planning'}),'正在准备避让方案');
assert.equal(decisionPrompt({phase:'decision'}),'请在右侧选择避让方式','missing time must not become a fabricated zero');
assert.equal(decisionPrompt({phase:'executing',source:'timeout'}),'AI已自动避让，继续观察');
assert.equal(decisionPrompt({phase:'executing',source:'user_accept'}),'正在执行所选避让方案');

// Numeric basis agrees with a downward pitched and yawed camera, without Three.js.
const yaw=Math.PI/4,pitch=38*Math.PI/180;
const rotated={right:{x:Math.cos(yaw),y:0,z:Math.sin(yaw)},up:{x:Math.sin(yaw)*Math.sin(pitch),y:Math.cos(pitch),z:-Math.cos(yaw)*Math.sin(pitch)},forward:{x:Math.sin(yaw)*Math.cos(pitch),y:-Math.sin(pitch),z:-Math.cos(yaw)*Math.cos(pitch)}};
const centerTarget={x:rotated.forward.x*500,y:60+rotated.forward.y*500,z:rotated.forward.z*500};
const centered=project(centerTarget,rotated);
assert.ok(Math.abs(centered.screenX-597)<1e-8);assert.ok(Math.abs(centered.screenY-417)<1e-8);assert.ok(Math.abs(centered.distance-500)<1e-8);
assert.ok(Math.abs(centered.bearing-45)<1e-8);
const overview=project({x:0,y:60,z:-500},{origin:{x:0,y:560,z:0},referenceOrigin:{x:0,y:60,z:0}});
assert.equal(overview.distance,500,'overview camera position must not alter drone-to-target center distance');

// Run the real locate handler against immutable flight state, without WebGL/DOM.
const fs=require('node:fs'),vm=require('node:vm');
const world=fs.readFileSync(require.resolve('./dist/lujiazui-world.js'),'utf8');
const focusHandler=world.slice(world.indexOf(' function focusTraffic(){'),world.indexOf(' locateTraffic.onclick=focusTraffic;'));
assert.ok(focusHandler.includes('function focusTraffic()'));
const flightState=Object.freeze({x:330,y:530,heading:37,altitude:60,status:'running',traffic:Object.freeze({x:430,y:530,z:60})});
const before=JSON.stringify(flightState),commands=[];
const context={state:flightState,overview:true,cameraHeading:1,cameraPitch:1,viewButton:{textContent:'返回机载视角'},setCamera:(command,notify)=>commands.push({command,notify}),vector:p=>({x:p.x-450,y:p.z??p.altitude,z:p.y-330,sub(q){return{x:this.x-q.x,y:this.y-q.y,z:this.z-q.z};}})};
vm.createContext(context);vm.runInContext(focusHandler+';result=focusTraffic();',context);
assert.equal(context.result,true);assert.equal(context.overview,false);assert.equal(context.cameraHeading,null);assert.equal(context.cameraPitch,null);
assert.equal(commands.length,1);assert.equal(commands[0].command.yawOffset,53);assert.equal(Math.abs(commands[0].command.pitch),0);assert.equal(commands[0].notify,true);
assert.equal(JSON.stringify(flightState),before,'locating T1 must not change flight position, aircraft heading or mission status');
console.log('PASS exact camera projection, minimum ring, rear/FOV/panel cues, layout exclusions, true center distance, and camera-only locate.');
