'use strict';
// N2 owns its event/decision clock; status=editing does not stop its flight clock.
function n2Pending(){return mission?.id==='N2'&&state.noFlyVisible&&['detected','proposal','rejected'].includes(state.flightEvent?.phase)&&state.status!=='complete';}
function n2WorldLive(){return mission?.id==='N2'&&['running','editing','holding'].includes(state.status);}
function n2CanDecide(){return n2Pending()&&!!mission.n2Plan&&!state.noFlyPlanning&&!state.noFlyPlanError&&['running','editing','holding','paused'].includes(state.status);}
function n2ActualSpeed(){return n2WorldLive()?Math.max(0,state.n2Speed??state.speed):0;}
function n2Log(type,data={}){eventLog(type,JSON.stringify({wallTimeMs:Date.now(),simTime:state.simTime,simRate:state.simRate||4,planVersion:state.planVersion||0,source:state.noFlyDecision?.resolvedBy||null,position:currentPosition(),...data}));}
function n2Options(){return N2Decision.config(mission.n2Options);}
function n2ProgressDistance(){return state.progress*C.length(state.route);}
function n2Candidate(branch){const plan=mission.n2Plan;return plan?N2Decision.attach(plan,state.progress,branch||plan.branch):null;}
function n2SyncCandidate(){if(!n2Pending()||!mission.n2Plan)return;if(state.noFlyDecision?.status!=='rejected'||state.status==='editing')mission.candidateRoute=n2Candidate();if(draft&&state.status==='editing'){const p=currentPosition(),next=N2Decision.rebase(draft.route,[p.x,p.y]);if(next?.length>=2)draft.route=next;}}
function n2Protect(reason,kind='window',stop=false){
 const same=state.noFlyProtection?.kind===kind&&state.noFlyProtection?.reason===reason;
 state.noFlyProtection={kind,reason,at:Date.now(),simTime:state.simTime};if(stop){state.noFlyHold=true;if(state.status!=='paused'&&state.status!=='editing'&&state.status!=='manual')state.status='holding';}
 if(!same){n2Log('protective_action',{kind,reason,mode:stop?'brake-to-hover':'reduce-speed',speed:n2ActualSpeed()});toast(reason);}return false;
}
function n2Motion(dt){
 const o=n2Options(),pending=n2Pending();let target=state.speed,available=Math.max(0,(1-state.progress)*C.length(state.route));
 if(pending){
  available=Math.max(0,(mission.n2Plan?.anchorDistance??mission.n2AnchorDistance??n2ProgressDistance())-n2ProgressDistance());
  const w=state.noFlyDecision,planningRemaining=Math.max(0,o.planningSeconds-(Date.now()-(state.noFlyPlanningStartedAt||Date.now()))/1000),seconds=w?.status==='active'?Math.max(0,(w.deadline-Date.now())/1000):o.decisionSeconds+(state.noFlyPlanning?planningRemaining:1),boundaryDistance=Math.max(0,(mission.n2BoundaryDistance??mission.n2AnchorDistance)-n2ProgressDistance()),window=N2Decision.windowFor({distance:boundaryDistance,speed:state.speed,rate:state.simRate||4,seconds,options:o});state.noFlyWindow=window;
  if(w?.status==='rejected'||w?.status==='blocked'||state.noFlyHold||state.noFlyPlanError)target=0;
  else if(window.required>window.available){target=window.targetSpeed;if(!state.noFlySpeedLimited){state.noFlySpeedLimited=true;n2Protect('倍率或处理延迟使决策窗口不足，已保护减速','window');}}
  if(available<.02){target=0;if(!state.noFlyHold)n2Protect('已到安全接入点，本机悬停，动态对象继续运动','approach-limit',true);}
 }
 if(state.noFlyHold&&!pending)target=0;
 if(!n2WorldLive())return {distance:0,speed:0};
 const step=N2Decision.motion({speed:state.speed,previousSpeed:state.n2Speed??state.speed,dt,available,targetSpeed:target,options:o});state.n2Speed=step.speed;state.n2EnergySpeed=dt>0?step.distance/dt:step.speed;
 if(pending&&step.clamped&&!state.noFlyHold)n2Protect('到达保护位置，已在禁区外悬停','boundary-guard',true);
 return step;
}
async function n2Check(route,altitude,speed,active=()=>true){
 const options=n2Options(),scene={...mission,battery:state.battery},errors=C.validate(route,scene,altitude,speed);let min=Infinity,deadline=performance.now()+4;
 if(!window.worldPointClearance||!window.worldCollision)return {valid:false,errors:['三维建筑检查尚不可用'],min:null};
 for(let i=1;i<route.length&&!errors.length;i++){
  if(window.worldCollision({x:route[i-1][0],y:route[i-1][1],z:altitude},{x:route[i][0],y:route[i][1],z:altitude})){errors.push('第'+i+'段与建筑相交');break;}
  const n=Math.max(1,Math.ceil(Math.hypot(route[i][0]-route[i-1][0],route[i][1]-route[i-1][1])/3));
  for(let j=0;j<=n;j++){if(!active())throw Error('方案检查已取消');if(performance.now()>=deadline){await new Promise(r=>setTimeout(r,0));deadline=performance.now()+4;}const t=j/n,p={x:route[i-1][0]+(route[i][0]-route[i-1][0])*t,y:route[i-1][1]+(route[i][1]-route[i-1][1])*t,z:altitude},d=window.worldPointClearance(p)?.distance;if(!Number.isFinite(d)){errors.push('建筑净距数据缺失');break;}min=Math.min(min,d);if(d<options.buildingClearance){errors.push('建筑净距'+d.toFixed(1)+'m不足'+options.buildingClearance+'m');break;}}
 }
 return {valid:!errors.length,errors,min:Number.isFinite(min)?min:null,altitude,speed,step:3,checkedAt:state.simTime};
}
// Final confirmation rechecks the moving join plus the unchanged checked backbone.
function n2FinalCheck(route,altitude,speed,edited=false){
 const errors=validateFlight(route,mission,altitude,speed),o=n2Options();if(!window.worldReady||!window.worldPointClearance)errors.push('三维检查未就绪');
 if(!route?.length||route.length<2)return ['没有可接入的有效航线'];
 const p=currentPosition();if(Math.hypot(route[0][0]-p.x,route[0][1]-p.y)>.1)errors.push('路线起点未同步实际位置');
 // Reuse only the explicitly checked, identical backbone at the same altitude.
 if(edited&&Math.abs(altitude-state.altitude)>.01)errors.push('本次限时绕行保持当前高度，请调整航点或速度');
 const key=JSON.stringify([route.slice(1),altitude,speed]),cached=state.n2DraftEvidence;
 if(edited&&cached?.key!==key){
  const token=state.n2DraftEvidence={key,pending:true},owner=state,scene=mission;
  n2Check(C.clone(route),altitude,speed,()=>state===owner&&mission===scene&&state.n2DraftEvidence===token).then(check=>{if(state!==owner||state.n2DraftEvidence!==token)return;token.check=check;token.pending=false;if(state.status==='editing'){validateDraft();renderCards();}}).catch(()=>{});
  return [...errors,'修改路线建筑检查中'];
 }
 if(edited&&!cached?.check)return [...errors,'修改路线建筑检查中'];
 if(edited&&!cached.check.valid)errors.push(...cached.check.errors);
 const known=edited?!!cached?.check?.valid:mission.n2Plan?.check.valid&&altitude===mission.n2Plan.check.altitude;
 for(let i=1;i<route.length;i++){
  if(known&&i>1)continue;
  const n=Math.max(1,Math.ceil(Math.hypot(route[i][0]-route[i-1][0],route[i][1]-route[i-1][1])/3));
  for(let j=0;j<=n;j++){const t=j/n,d=window.worldPointClearance?.({x:route[i-1][0]+(route[i][0]-route[i-1][0])*t,y:route[i-1][1]+(route[i][1]-route[i-1][1])*t,z:altitude})?.distance;if(!Number.isFinite(d)||d<o.buildingClearance){errors.push('第'+i+'段建筑净距未满足'+o.buildingClearance+'m');break;}}
 }
 return [...new Set(errors)];
}
function n2RefreshSnapshot(){
 if(mission?.id!=='N2')return null;n2SyncCandidate();const p=currentPosition(),origin=[p.x,p.y],o=n2Options(),reference=mission.n2Plan?.original||mission.interruptedRoute||state.route;
 let original=N2Decision.cut(state.route,n2ProgressDistance());
 if(state.noFlyVisible){if(n2Pending())original=N2Decision.cut(reference,n2ProgressDistance());else{const near=C.nearestPointOnRoute(reference,origin);original=[origin,...reference.slice((near?.segmentIndex??0)+1)];}}
 const suggested=draft?.route||mission.candidateRoute||N2Decision.cut(state.route,n2ProgressDistance()),v=draft?.speed??state.speed,u=state.status==='paused'?(state.n2ResumeSpeed??state.n2Speed??state.speed):n2ActualSpeed();
 const snapshot={simTime:state.simTime,wallTimeMs:Date.now(),version:state.planVersion||0,origin:[p.x,p.y],battery:state.battery,speed:u,original:N2Decision.forecast(original,state.battery,state.speed,u,o.acceleration),suggested:state.noFlyPlanning?null:N2Decision.forecast(suggested,state.battery,v,u,o.acceleration),planName:draft?'修改候选':mission.n2Plan?.name||'航迹A',deviation:C.nearestPointOnRoute(state.route,[p.x,p.y])?.distance};
 if(state.noFlyVisible){snapshot.boundary=N2Decision.forwardBoundary(p,u,mission.hazard);const distance=N2Decision.entryDistance(N2Decision.cut(state.route,n2ProgressDistance()),mission.hazard);snapshot.alongBoundarySeconds=u>0&&distance!==null?distance/u:null;}
 if(state.noFlyExecution&&state.flightEvent?.phase==='executing'){
  const distance=n2ProgressDistance(),execution=state.noFlyExecution,remaining=N2Decision.cut(state.route,distance),sample=C.sample(state.route,state.progress),next=state.route[sample.next],branchIndex=mission.n2Plan?.branch.findIndex(q=>Math.hypot(q[0]-next[0],q[1]-next[1])<.1)??-1;
  snapshot.executionDistance=distance;snapshot.firstForecast=N2Decision.forecast(N2Decision.cut(state.route,distance,execution.firstDistance),state.battery,v,u,o.acceleration);snapshot.nextWaypoint={point:next.slice(),name:sample.next===state.route.length-1?mission.destination.name.split('·')[0].trim():branchIndex>0?(mission.n2Plan.side+'绕行点'+branchIndex):'接入航点',forecast:N2Decision.forecast([[p.x,p.y],next],state.battery,v,u,o.acceleration)};
  snapshot.bypassForecast=N2Decision.forecast(N2Decision.cut(state.route,distance,execution.exitDistance),state.battery,v,u,o.acceleration);
  snapshot.rejoined=(C.nearestPointOnRoute(mission.n2Plan.original,[p.x,p.y])?.distance??Infinity)<2&&remaining.every(q=>(C.nearestPointOnRoute(mission.n2Plan.original,q)?.distance??Infinity)<2);
 }
 if(!state.noFlyVisible&&latestSatContext?.evidence?.A){const e=latestSatContext.evidence.A;snapshot.fullCheck={...e.geometry,zoneIntersects:e.zone.intersects,segments:state.route.length-1};}
 state.noFlySnapshot=snapshot;return snapshot;
}
function n2RenderNotice(){
 const box=$('n2EditNotice');if(!box)return;box.hidden=mission?.id!=='N2'||!state.noFlyVisible||state.status!=='editing';if(box.hidden)return;
 const rows=N2Decision.describe({state,mission,position:currentPosition(),live:state.noFlySnapshot,draft,ready:!!window.worldReady})[0][2];box.querySelector('h2').textContent='L1 当前目标与行动';rows.forEach(([label,value],i)=>{box.querySelector('[data-n2-edit-label="'+i+'"]').textContent=label;box.querySelector('[data-n2-edit-value="'+i+'"]').textContent=value;});
}
function n2SyncButtons(){
 if(mission?.id!=='N2')return;const event=state.noFlyVisible,pending=n2Pending(),preflight=!event&&state.status==='review',available=n2CanDecide()&&state.status!=='editing';
 $('decisionPanel').hidden=!(preflight||pending);for(const id of ['accept','modify','reject']){$(id).hidden=false;$(id).disabled=event?!available:!preflight;}
 $('accept').textContent=state.noFlyPlanning?'正在计算':event?(state.noFlyDecision?.status==='rejected'?'重新选择B':'接受B'):'接受原路线A';$('modify').textContent=event?'修改方案':'修改';$('reject').textContent=event?'拒绝B':'拒绝';if(state.noFlyDecision?.status==='rejected')$('reject').disabled=true;
}
function n2PresentationReady(){
 if(!n2CanDecide()||state.flightEvent.presented||state.flightEvent.presentationQueued)return;
 const event=state.flightEvent,version=state.planVersion;event.presentationQueued=true;
 requestAnimationFrame(()=>requestAnimationFrame(()=>{if(state.flightEvent!==event||state.planVersion!==version||!n2CanDecide()){event.presentationQueued=false;return;}event.presented=true;event.presentedAt=Date.now();n2Log('information_presented',{version,panel:$('satCards').innerText,snapshot:state.noFlySnapshot});const o=n2Options();if(!state.noFlyDecision||state.noFlyDecision.eventId!==event.id){state.presentedAt=event.presentedAt;state.noFlyDecision={eventId:event.id,version,status:'active',startedAt:Date.now(),deadline:Date.now()+o.decisionSeconds*1000,seconds:o.decisionSeconds};n2Log('decision_window_started',{...state.noFlyDecision,options:o});}n2RenderNotice();save();}));
}
function n2TickDecision(){
 if(mission?.id!=='N2')return;const w=state.noFlyDecision;if(w?.status==='active'){w.seconds=Math.max(0,Math.ceil((w.deadline-Date.now())/1000));if(Date.now()>=w.deadline&&window.worldReady){w.status='expiring';n2Log('decision_timeout',{deadline:w.deadline,version:w.version});n2Resolve('timeout');}}
 n2RenderNotice();
 n2SyncButtons();
 if(n2Pending()&&mission.n2Plan){n2SyncCandidate();if(state.status==='editing'&&draft){if(Date.now()-(state.n2EditCheckedAt||0)>700){state.n2EditCheckedAt=Date.now();validateDraft();} $('suggestedRoute').setAttribute('points',draft.route.map(p=>p.join(',')).join(' '));}else $('suggestedRoute').setAttribute('points',mission.candidateRoute?.map(p=>p.join(',')).join(' ')||'');}
 if(state.flightEvent?.phase==='executing'&&!draft)$('activeRoute').setAttribute('points',N2Decision.cut(state.route,n2ProgressDistance()).map(p=>p.join(',')).join(' '));
}
function n2CloseEdit(){if(state.status!=='editing')return;setRouteDrawing(false);draft=null;editBaselineRoute=null;waypointGhosts.clear();satCheckErrors=[];if(document.body.classList.contains('map-expanded'))$('expandMap').click();}
function n2JoinCheck(route,index,altitude){let min=Infinity;const prefix=route.slice(0,index+1),errors=[];for(let i=1;i<prefix.length;i++){const a=prefix[i-1],b=prefix[i];if(C.distanceToSegment([mission.hazard.x,mission.hazard.y],a,b)<mission.hazard.r+mission.hazard.margin)errors.push('接入段穿越禁区');if(window.worldCollision?.({x:a[0],y:a[1],z:altitude},{x:b[0],y:b[1],z:altitude}))errors.push('接入段与建筑相交');const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/3));for(let j=0;j<=n;j++){const t=j/n,d=window.worldPointClearance?.({x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t,z:altitude})?.distance;if(Number.isFinite(d))min=Math.min(min,d);else errors.push('接入净距数据缺失');}}
 if(min<n2Options().buildingClearance)errors.push('接入建筑净距不足');return {valid:!errors.length&&Number.isFinite(min),errors,min:Number.isFinite(min)?min:null,route:prefix,checkedAt:state.simTime,wallTimeMs:Date.now()};}
function n2UpdateFlightPhase(){
 if(mission?.id!=='N2'||state.flightEvent?.phase!=='executing'||!state.noFlyExecution||state.noFlyBypassComplete)return;
 const execution=state.noFlyExecution;if(n2ProgressDistance()<execution.exitDistance-.01)return;state.noFlyBypassComplete=true;execution.completedAt=state.simTime;execution.actualSeconds=state.simTime-execution.startedAt;execution.errorSeconds=execution.actualSeconds-execution.expectedExitSeconds;n2Log('bypass_complete',{...execution,remaining:N2Decision.cut(state.route,n2ProgressDistance())});
 const owner=state,scene=mission,route=N2Decision.cut(state.route,n2ProgressDistance());n2Check(route,state.altitude,state.speed,()=>state===owner&&mission===scene).then(check=>{if(state!==owner||mission!==scene)return;state.noFlyPostCheck=check;n2Log('post_bypass_checked',{check,route});if(!check.valid)n2Protect('后续路线复核未通过，保护减速悬停','post-check',true);renderCards();}).catch(()=>{});renderCards();
}
function n2Resolve(source){
 if(!n2Pending())return false;
 if(source!=='timeout'&&state.noFlyDecision?.status==='active'&&Date.now()>=state.noFlyDecision.deadline){n2Log('late_operator_action',{source});n2TickDecision();return false;}
 if(source!=='timeout')firstOperation(source);n2SyncCandidate();const w=state.noFlyDecision||(state.noFlyDecision={eventId:state.flightEvent.id,status:'active'});
 if(source==='reject'){
  w.status='rejected';w.resolvedBy='reject';w.resolvedAt=Date.now();mission.candidateRoute=null;state.flightEvent.phase='rejected';n2Log('decision_confirmed',{source:'user_reject',defaultCancelled:true});n2Log('reject',{source:'user_reject',defaultCancelled:true});n2Protect('用户拒绝绕行B，原路线受禁区阻断，减速后在可行位置悬停','user-reject',true);render();return true;
 }
 const edited=source==='modify',p=currentPosition(),route=edited?N2Decision.rebase(draft?.route,[p.x,p.y]):n2Candidate(),alt=edited?draft?.altitude:state.altitude,speed=edited?draft?.speed:state.speed,errors=n2FinalCheck(route,alt,speed,edited);
 if(errors.length){n2Log(source==='timeout'?'auto_execution_blocked':'decision_validation_failed',{source,errors});if(source==='timeout'){w.status='blocked';w.resolvedBy='protection';w.resolvedAt=Date.now();n2Protect('到期推荐路线已失效：'+errors.join('；'),'invalid-default',true);render();}else{toast(errors.join('；'));if($('validation'))$('validation').textContent=errors.join('；');}return false;}
 const milestones=N2Decision.milestones(route,mission.hazard,mission.n2Plan.original,n2Options().marginMeters),joinCheck=n2JoinCheck(route,milestones.firstIndex,alt);
 if(!joinCheck.valid){if(source==='timeout'){w.status='blocked';w.resolvedBy='protection';n2Protect('到期接入检查失败，保护减速悬停','invalid-join',true);render();}else toast('实际接入段检查未通过');n2Log('join_validation_failed',{source,joinCheck});return false;}
 state.noFlyExecution={...milestones,source,joinCheck,startedAt:state.simTime,startedWallTime:Date.now(),boundaryDistance:N2Decision.entryDistance(N2Decision.cut(state.route,n2ProgressDistance()),mission.hazard),expectedExitSeconds:N2Decision.forecast(N2Decision.cut(route,0,milestones.exitDistance),state.battery,speed,state.n2Speed??speed,n2Options().acceleration).seconds};state.noFlyBypassComplete=false;state.noFlyPostCheck=null;
 const paused=state.status==='paused',rationale=edited?$('rationale').value:null;if(state.status==='editing'){if(!edited)n2Log('unconfirmed_draft_discarded',{route:draft?.route});n2CloseEdit();}
 w.status='resolved';w.resolvedBy=source;w.resolvedAt=Date.now();w.seconds=0;state.noFlyHold=false;state.noFlySpeedLimited=false;mission.n2ExecutionCheck=edited?state.n2DraftEvidence?.check:mission.n2Plan.check;mission.candidateRoute=null;state.route=C.clone(route);state.progress=0;state.manualPosition=null;state.manualDistance=0;state.altitude=edited?state.altitude:alt;state.targetAltitude=alt;state.speed=speed;state.noFlyHeadingSmoothing=true;state.activePlan=edited?'修改航迹':mission.n2Plan.name;state.planVersion=(state.planVersion||0)+(edited?1:0);state.flightEvent.phase='executing';state.flightEvent.executingAt=state.simTime;state.status=paused?'paused':'running';
 n2Log('decision_confirmed',{source:source==='timeout'?'timeout_auto':source==='modify'?'user_modify':'user_accept',route,altitude:alt,speed,rationale});n2Log(source==='timeout'?'auto_execution':source==='modify'?'modify_apply':'accept',{source,plan:state.activePlan,rationale});n2Log(paused?'plan_execution_queued':'plan_execution_started',{source,route,start:[p.x,p.y],version:state.planVersion});toast(source==='timeout'?'决策超时，AI已自动执行'+state.activePlan:'用户已确认，正在执行'+state.activePlan);render();return true;
}
async function n2Reveal(replanning=false){
 if(noFlyPlanJob||mission?.id!=='N2')return;
 const owner=state,scene=mission,o=n2Options(),route=C.clone(state.route),current=n2ProgressDistance();
 if(!replanning){
  const zone={...mission.plannedNoFlyZone,...Sequence.n2DynamicNoFlyZone(route,state.progress),kind:'temporary-no-fly'};mission.hazard=zone;mission.interruptedRoute=C.clone(route);state.noFlyVisible=true;state.noFlyDetected=true;state.n2Speed=state.speed;startFlightEvent('zone','临时空域通告',zone.activity||zone.label);n2Log('no_fly_zone_notice',{zone,route,current});
 }else{state.noFlyUpdatedUntil=Date.now()+5000;n2Log('suggestion_invalidated',{reason:'高度或空域检查发生变化'});}
 const zone=mission.hazard,entry=N2Decision.entryDistance(route,zone),reserve=state.speed*o.maneuverSeconds+o.marginMeters,anchorDistance=Math.max(current,Math.min(C.length(route),(entry??current)-reserve)),anchor=C.sample(route,anchorDistance/C.length(route));mission.n2AnchorDistance=anchorDistance;mission.n2BoundaryDistance=entry??current;
 const job={mission,route,altitude:state.altitude,speed:state.speed,waiting:false};noFlyPlanJob=job;state.noFlyPlanning=true;state.noFlyPlanningStartedAt=Date.now();state.noFlyPlanError=null;mission.candidateRoute=null;mission.title='前方新增临时禁飞区，正在评估绕行方案';mission.event='N2 · 临时空域通告';render();
 try{
  const branches=await planNoFlyRoutes(job,zone,[anchor.x,anchor.y]);if(state!==owner||mission!==scene||noFlyPlanJob!==job)return;
  const active=()=>state===owner&&mission===scene&&noFlyPlanJob===job,plans=[];
  for(const branch of branches||[]){const plan={original:route,anchorDistance,branch},full=N2Decision.attach(plan,state.progress),check=await n2Check(full,job.altitude,job.speed,active);if(check.valid)plans.push({branch,check});}
  if(!active())return;if(!plans.length)throw Error('未找到满足建筑净距和禁区约束的候选');
  const chosen=plans[0],other=plans[1],side=N2Decision.side(chosen.branch,zone),name='绕行B（'+side+'）',delta=other?Math.max(0,(C.length(other.branch)-C.length(chosen.branch))/state.speed):null;
  mission.n2Plan={original:route,anchorDistance,branch:C.clone(chosen.branch),alternativeBranch:C.clone(other?.branch||chosen.branch),check:chosen.check,alternativeCheck:other?.check||null,side,name,choice:other?(delta>.05?'两候选均可行；B少耗时'+delta.toFixed(1)+'s':'两候选耗时相近，沿用先验证的B'):'本次仅验证出一条可通行路线',createdAt:Date.now(),altitude:job.altitude};
  mission.route=N2Decision.attach(mission.n2Plan,state.progress);mission.alternative=n2Candidate(mission.n2Plan.alternativeBranch);readyCandidate(mission.route);state.noFlyPlanning=false;state.noFlyHold=['blocked','rejected'].includes(state.noFlyDecision?.status);if(state.status==='holding'&&!state.noFlyHold)state.status='running';state.noFlyPlanError=null;state.noFlyDecision=state.noFlyDecision||null;if(!state.noFlyDecision)state.presentedAt=Date.now();n2Log('plan_generated',{plan:mission.n2Plan,options:o});if(replanning){state.noFlyUpdatedUntil=Date.now()+5000;n2Log('recommendation_updated',{version:state.planVersion});if(state.noFlyDecision)state.noFlyDecision.version=state.planVersion;}render();
 }catch(error){if(state!==owner||mission!==scene||noFlyPlanJob!==job)return;state.noFlyPlanning=false;state.noFlyPlanError=error.message;n2Log('planning_failed',{reason:error.message});n2Protect('绕行检查未通过，正在禁区外减速悬停','no-plan',true);render();}
 finally{if(noFlyPlanJob===job)noFlyPlanJob=null;}
}
function n2AirspaceUpdate(zone,source='临时空域通告更新'){
 if(mission?.id!=='N2'||['complete','collision'].includes(state.status)||!state.noFlyVisible||!zone||!['x','y','r'].every(k=>Number.isFinite(zone[k]))||zone.r<=0)return false;
 noFlyPlanJob=null;mission.hazard={...mission.hazard,...zone,margin:Math.max(0,Number(zone.margin??mission.hazard.margin)||0)};mission.n2Plan=null;mission.candidateRoute=null;state.noFlyPlanError=null;
 if(state.flightEvent?.phase!=='proposal'){startFlightEvent('zone-update',source,'临时禁飞区边界发生变化');state.noFlyDecision=null;}
 state.noFlyUpdatedUntil=Date.now()+5000;n2Protect('禁区信息变化，原建议撤回；重新检查期间保护减速','airspace-update',true);n2Log('recommendation_invalidated',{source,zone:mission.hazard});n2Reveal(true);return true;
}
