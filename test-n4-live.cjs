'use strict';
// Execute the shipped N4 runtime and cockpit flight loop without a renderer.
// Geometry is deliberately supplied by this harness; mesh coverage lives in
// test-n4-world.mjs. No N4 decision or flight behavior is reimplemented here.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('./dist/core.js');
const Traffic = require('./dist/traffic.js');
const Collision = require('./dist/collision.js');
const Sequence = require('./dist/sequence.js');
const FlightControls = require('./dist/flight-controls.js');
const FlightEvents = require('./dist/flight-events.js');

const read = file => fs.readFileSync(path.join(__dirname, 'dist', file), 'utf8');
const cockpit = read('cockpit.js');
function block(start, end) {
  const from = cockpit.indexOf(start), to = cockpit.indexOf(end, from + start.length);
  assert(from >= 0 && to > from, 'cockpit extraction markers must exist: ' + start);
  return cockpit.slice(from, to);
}
const integration = [
  block('function eventLog(', 'function commitCandidate('),
  cockpit.slice(cockpit.indexOf('function currentPosition(')).split('\n')[0],
  block('function tick(now)', '$(\'collisionTrial\').onclick='),
  block("$('modify').onclick=", 'function validateDraft('),
].join('\n');

function harness(rate = 1) {
  let wall = 0;
  const mission = Sequence.make(2, Sequence.points[2].point, 82);
  const route = C.clone(mission.route), cruise = mission.cruiseSpeed || 12;
  const state = {
    status: 'running', route, progress: 0, altitude: 60, targetAltitude: 60,
    speed: cruise, battery: 82, simTime: 0, simRate: rate, trail: [route[0]],
    traffic: Traffic.createN4(route[0], mission.destination.point, cruise, route),
  };
  const nodes = new Map(), events = [], frames = [];
  let geometryBlocked = false, geometryMissing = false, checks = 0, renders = 0, routeDraws = 0;
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {
      style: {}, hidden: false, disabled: false, innerText: 'N4 candidate information',
      classList: { toggle() {}, contains: () => false },
      setAttribute() {}, querySelector: () => null, click() {},
    });
    return nodes.get(id);
  };
  const context = {
    C, Traffic, Collision, FlightControls, FlightEvents, mission, state,
    last: 0, lastSave: Infinity, draft: null, editBaselineRoute: null,
    routeDrawing: false, waypointGhosts: new Map(), manualInputs: new Map(),
    joystick: { forward: 0, right: 0 },
    Date: class extends Date { static now() { return wall; } },
    performance: { now: () => wall }, setTimeout,
    requestAnimationFrame: callback => { frames.push(callback); },
    document: { body: { classList: { contains: () => false } } },
    window: {
      UAV: C, Traffic, FlightControls,
      worldReady: true,
      worldCollision: () => { checks++; return geometryBlocked ? { t: .5, label: 'test building' } : null; },
      worldPointClearance: () => geometryMissing ? null : ({ distance: 100 }),
    },
    $: node, snap: () => ({}), save() {}, toast() {}, drawRoute() { routeDraws++; },
    photoTasks: () => [], completedPhotoIds: () => [], manualTick: () => false,
    setRouteDrawing(value) { context.routeDrawing = value; },
    firstOperation(type) { events.push({ type: 'first_operation', source: type }); },
    validateDraft() { return context.n4Geometry(context.draft.route, context.draft.altitude, context.draft.speed).errors; },
    log(type, label, detail) {
      let data = detail;
      try { data = JSON.parse(detail); } catch {}
      events.push({ type, label, data, at: wall, simTime: state.simTime });
    },
    render() {
      renders++;
      context.n4RefreshSnapshot(); context.n4SyncButtons(); context.n4PresentationReady();
    },
    telemetry() {
      context.n4RefreshSnapshot(); context.n4SyncButtons(); context.n4PresentationReady();
    },
  };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(read('n4-decision.js') + '\nvar N4Decision=window.N4Decision;\n' +
    read('n4-status.js') + '\nvar N4Status=window.N4Status;\n' + read('n4-runtime.js') + '\n' + integration,
    context, { filename: 'shipped-n4-runtime-with-cockpit.js' });
  const flush = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  };
  const frame = async (ms = 1000 / 60) => {
    wall += ms;
    const ready = frames.splice(0);
    for (const callback of ready) if (callback !== context.tick) callback(wall);
    context.tick(wall);
    // The app's decision interval runs every 100 ms. The deadline itself uses
    // simulated flight time; retain the same interval cadence in this harness.
    if (Math.floor((wall - ms) / 100) !== Math.floor(wall / 100)) context.n4TickDecision();
    await flush();
  };
  const until = async (predicate, message, maxSeconds = 200) => {
    const deadline = state.simTime + maxSeconds;
    for (let i = 0; i < 60000 && state.simTime <= deadline; i++) {
      if (predicate()) return;
      assert(!['collision', 'complete'].includes(state.status), message + ': ended as ' + state.status);
      await frame();
    }
    assert.fail(message + ': ' + JSON.stringify({ state: state.status, simTime: state.simTime, error: state.n4PlanError, decision: state.n4Decision }));
  };
  return {
    context, mission, state, events, node, frame, until, flush,
    wall: () => wall, geometryChecks: () => checks,
    renderCount: () => renders, routeDrawCount: () => routeDraws,
    blockGeometry: value => { geometryBlocked = value; },
    omitGeometry: value => { geometryMissing = value; },
    advanceWallOnly(ms) { wall += ms; context.last = wall; context.n4TickDecision(); },
    async ready() {
      assert.equal(context.n4Active(), true);
      assert.equal(!!context.n4Pending(), false);
      context.n4RefreshSnapshot(); context.n4SyncButtons();
      assert.equal(node('trafficReadout').hidden, false); // visibility is rendered separately
      await until(() => !!state.n4Detected, 'detect traffic while following A');
      assert.equal(state.status, 'running', 'detection must keep flight running');
      assert.equal(context.n4Pending(), true);
      await until(() => state.n4Decision?.status === 'active', 'present a checked B and start the decision window');
      assert(mission.n4Plan && mission.candidateRoute, 'must generate a real candidate');
      assert(state.n4Snapshot.check.valid && !state.n4Snapshot.check.pending);
      assert.equal(state.n4Snapshot.selected.conflict, false);
      assert(Math.abs(state.n4Decision.deadlineSimTime - state.n4Decision.startedAtSimTime - 15) < 1e-7);
      assert.equal(node('accept').disabled, false);
      assert.equal(node('collisionTrial').hidden, true, 'obsolete collision experiment is hidden');
      for (const type of ['traffic_detected', 'plan_generated', 'information_presented', 'decision_window_started'])
        assert(events.some(event => event.type === type), 'missing actual runtime event ' + type);
    },
  };
}

const pos = h => h.context.currentPosition();
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const assertContinuous = (before, after, label) => assert(distance(before, after) < 1e-7, label + ' must not teleport');

async function acceptScenario(rate) {
  const h = harness(rate); await h.ready();
  // Let A advance after planning. Acceptance must attach B at the actual current
  // location rather than the position at which the proposal was generated.
  const detectedAt = h.events.find(event => event.type === 'traffic_detected').data.position;
  for (let i = 0; i < 20; i++) await h.frame();
  assert(distance(detectedAt, pos(h)) > 1, 'A continues while B awaits a decision');
  const own = pos(h), target = Traffic.position(h.state.traffic);
  assert.equal(h.context.n4Resolve('accept'), true);
  assertContinuous(own, pos(h), 'accepting B');
  assertContinuous(target, Traffic.position(h.state.traffic), 'accepting B target');
  assert.equal(h.state.n4Decision.source, 'accept');
  assert.equal(h.state.flightEvent.phase, 'executing');
  assert.equal(h.state.progress, 0);
  assert.equal(h.context.n4Pending(), false);
  await h.until(() => h.state.trafficMotionUpdated, 'default T1 velocity update');
  await h.until(() => h.state.n4AvoidanceComplete, 'complete B and rejoin A');
  assert(h.events.some(event => event.type === 'avoidance_complete'));
  assert(h.events.some(event => event.type === 'target_motion_changed'));
  assert(h.geometryChecks() > 10, 'real route checks must call world geometry');
  console.log('PASS N4 accepted candidate and rejoin', { rate, simTime: +h.state.simTime.toFixed(3) });
}

async function editingScenario(rate) {
  const h = harness(rate); await h.ready();
  h.node('modify').onclick();
  assert.equal(h.state.status, 'editing');
  const own = pos(h), target = Traffic.position(h.state.traffic), sim = h.state.simTime, battery = h.state.battery;
  const originalRoute = JSON.stringify(h.state.route), deadline = h.state.n4Decision.deadlineSimTime;
  for (let i = 0; i < 30; i++) await h.frame();
  const elapsed = h.state.simTime - sim;
  assert(Math.abs(elapsed - .5 * rate) < 1e-7, 'editing uses the selected simulation rate');
  assert(Math.abs(distance(own, pos(h)) - elapsed * h.state.speed) < .001, 'own UAV continues along A during editing');
  assert(distance(target, Traffic.position(h.state.traffic)) > 0, 'T1 continues during editing');
  assert(h.state.battery < battery, 'editing consumes actual flight energy');
  assert.equal(JSON.stringify(h.state.route), originalRoute, 'draft must not replace the flown A before submit');
  assert.equal(h.state.n4Decision.deadlineSimTime, deadline, 'entering/editing must not reset the deadline');
  h.context.n4SyncCandidate();
  assertContinuous(pos(h), { x: h.context.draft.route[0][0], y: h.context.draft.route[0][1] }, 'live draft origin');
  const submitAt = pos(h), targetAt = Traffic.position(h.state.traffic);
  assert.equal(h.context.n4Resolve('modify'), true);
  assertContinuous(submitAt, pos(h), 'submitting C');
  assertContinuous(targetAt, Traffic.position(h.state.traffic), 'submitting C target');
  assert.equal(h.state.n4Action, 'user');
  assert.equal(h.context.draft, null);
  assert(h.events.some(event => event.type === 'modify_apply'));
  console.log('PASS N4 live editing and submission', { rate, elapsed });
}

async function timeoutScenario(rate) {
  const h = harness(rate); await h.ready();
  const decision = h.state.n4Decision, wallStart = h.wall();
  // A wall-clock jump while the simulation is stopped cannot consume any of
  // this flight-time decision window.
  const simStart = h.state.simTime;
  h.advanceWallOnly(60000);
  assert.equal(h.state.simTime, simStart);
  assert.equal(h.state.n4Decision.status, 'active');
  assert.equal(h.state.n4Decision.deadlineSimTime, decision.deadlineSimTime);
  assert(!h.events.some(event => event.type === 'decision_timeout'));
  const resumedAt = h.wall();
  await h.until(() => h.state.n4Decision?.source === 'timeout' && h.state.n4Decision.status === 'resolved', 'execute B after 15 flight seconds');
  const timeout = h.events.find(event => event.type === 'decision_timeout');
  assert(timeout, 'timeout must be logged');
  const runningSeconds = timeout.simTime - decision.startedAtSimTime;
  assert(runningSeconds >= 15 - 1e-7 && runningSeconds <= 15 + .11 * rate, 'timeout must use 15 running seconds: ' + runningSeconds);
  const wallSeconds = (timeout.at - resumedAt) / 1000;
  assert(Math.abs(wallSeconds - 15 / rate) < .2, 'countdown accelerates with flight at ' + rate + 'x: ' + wallSeconds);
  assert(h.events.some(event => event.type === 'auto_execution'));
  assert.equal(h.state.n4Execution.source, 'timeout');
  const execution = h.events.find(event => event.type === 'plan_execution_started' && event.data?.source === 'timeout');
  assertContinuous(execution.data.position, { x: execution.data.route[0][0], y: execution.data.route[0][1] }, 'timeout route origin');
  console.log('PASS N4 15 flight-second timeout', { rate, runningSeconds, wallSeconds, ignoredWallSeconds: (resumedAt - wallStart) / 1000 });
}

async function unsafeUserRouteScenario(rate) {
  const h = harness(rate); await h.ready(); h.node('modify').onclick();
  await h.until(() => h.state.trafficMotionUpdated && !h.state.n4Planning, 'update T1 while C is being edited');
  const own = pos(h), traffic = h.state.traffic, target = Traffic.position(traffic);
  // Construct user input aimed at the moving target's actual future position.
  // This is test input, not substitute collision/decision implementation.
  const rx = target.x - own.x, ry = target.y - own.y;
  const a = traffic.vx ** 2 + traffic.vy ** 2 - h.state.speed ** 2;
  const b = 2 * (rx * traffic.vx + ry * traffic.vy), c = rx ** 2 + ry ** 2;
  const roots = [(-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a), (-b - Math.sqrt(b * b - 4 * a * c)) / (2 * a)];
  const interceptTime = Math.min(...roots.filter(t => t > 0));
  assert(Number.isFinite(interceptTime));
  const intercept = [target.x + traffic.vx * interceptTime, target.y + traffic.vy * interceptTime];
  h.context.draft.route = [[own.x, own.y], intercept, h.mission.destination.point.slice()];
  const risk = h.context.n4Prediction(h.context.draft.route);
  assert(risk.conflict && risk.distance < .001, 'chosen user route really conflicts');
  assert.equal(h.context.n4Resolve('modify'), true, 'C permits an informed dynamic-risk submission');
  assertContinuous(own, pos(h), 'unsafe C submission');
  assert(h.events.some(event => event.type === 'modify_apply' && event.data.dynamicRiskAccepted === true));
  for (let i = 0; i < 60000 && h.state.status !== 'collision'; i++) {
    assert.notEqual(h.state.status, 'complete', 'unsafe C must contact T1 before the route ends');
    await h.frame();
  }
  assert.equal(h.state.status, 'collision');
  const contact = Traffic.position(h.state.traffic);
  const separation = Math.hypot(pos(h).x - contact.x, pos(h).y - contact.y, h.state.altitude - contact.altitude);
  assert(Math.abs(separation - Collision.radius * 2) < .0001, 'both vehicles stop at the physical contact instant: ' + separation);
  assert(h.events.some(event => event.type === 'collision' && event.label === '发生实体碰撞'));
  const stopOwn = pos(h), stopTarget = Traffic.position(h.state.traffic);
  await h.frame();
  assertContinuous(stopOwn, pos(h), 'stopped own UAV');
  assertContinuous(stopTarget, Traffic.position(h.state.traffic), 'stopped T1');
  console.log('PASS N4 unsafe user route physical contact', { rate, separation });
}

async function geometryScenario() {
  const h = harness(); await h.ready();
  const own = pos(h), route = JSON.stringify(h.state.route);
  h.blockGeometry(true);
  assert.equal(h.context.n4Resolve('accept'), false, 'acceptance rechecks actual world geometry');
  assertContinuous(own, pos(h), 'blocked candidate');
  assert.equal(JSON.stringify(h.state.route), route);
  assert(h.events.some(event => event.type === 'decision_invalid'));
  h.blockGeometry(false); h.omitGeometry(true);
  assert.equal(h.context.n4Resolve('accept'), false, 'missing clearance must block acceptance');
  console.log('PASS N4 submission rechecks geometry and missing clearance');
}

async function stablePanelScenario(rate) {
  const h = harness(rate); await h.ready();
  h.mission.trafficMotionUpdate = false;
  const plan = h.mission.n4Plan, deadline = h.state.n4Decision.deadlineSimTime;
  const checkMovement = async (field, button) => {
    // Settle the real async scan and prime the structural map key once.
    await h.flush(); h.context.n4RefreshSnapshot();
    h.advanceWallOnly(501); await h.flush();
    const token = h.state[field], own = pos(h), renders = h.renderCount(), draws = h.routeDrawCount();
    assert(token?.valid && !token.pending, field + ' starts with a completed scan');
    for (let i = 0; i < Math.ceil(2.2 * 60 / rate); i++) {
      await h.frame();
      assert.equal(h.state[field], token, field + ' must survive movement of the live origin');
      assert.equal(h.state.n4Snapshot.check.pending, false, 'normal movement must not restart building scans');
      assert.equal(h.node(button).disabled, false, 'normal movement must not disable the valid decision');
      assert(h.state.n4Snapshot.selected && Number.isFinite(h.state.n4Snapshot.forecast.seconds), 'valid forecast remains visible');
    }
    assert(distance(own, pos(h)) > 20, 'the tested origin crosses several old 5 m cache boundaries');
    assert.equal(h.renderCount(), renders, 'moving a fixed plan must not rebuild the panel');
    assert.equal(h.routeDrawCount(), draws, 'moving a fixed plan must update its polyline without a full map rebuild');
    assert.equal(h.mission.n4Plan, plan);
    assert.equal(h.state.n4Decision.deadlineSimTime, deadline);
  };
  await checkMovement('n4PlanCheck', 'accept');
  h.node('modify').onclick();
  await checkMovement('n4DraftCheck', 'applyEdit');
  console.log('PASS N4 stable checks and in-place panel/map updates', { rate });
}

async function unsafeDraftKeepsCandidateScenario(rate) {
  const h = harness(rate); await h.ready();
  h.mission.trafficMotionUpdate = false;
  h.node('modify').onclick();
  // A is the real conflicting trajectory. Copy it into C without submitting it.
  h.context.draft.route = Traffic.remainingRoute(h.state.route, h.state.progress);
  h.context.n4RefreshSnapshot(); await h.flush(); h.context.n4RefreshSnapshot();
  assert(h.state.n4Snapshot.selected?.conflict, 'the editable C really has a dynamic conflict');
  assert(h.context.n4Prediction(h.context.n4Candidate()).distance >= h.context.N4Decision.config(h.mission).planningClearance, 'the independent B remains safe');
  const plan = h.mission.n4Plan, decision = h.state.n4Decision, deadline = decision.deadlineSimTime;
  const invalidations = () => h.events.filter(event => ['recommendation_invalidated', 'suggestion_invalidated'].includes(event.type)).length;
  const count = invalidations();
  h.context.n4TickDecision();
  assert.equal(h.mission.n4Plan, plan, 'the decision tick must assess B rather than draft C');
  // A small real T1 velocity update also must be assessed against B, not C.
  const t = h.state.traffic;
  h.state.traffic = Traffic.changeMotion(t, t.vx * 1.0001, t.vy * 1.0001);
  assert(h.context.n4Prediction(h.context.n4Candidate()).distance >= h.context.N4Decision.config(h.mission).planningClearance);
  h.context.n4Reassess();
  for (let i = 0; i < Math.ceil(2.2 * 60 / rate); i++) await h.frame();
  assert.equal(h.mission.n4Plan, plan, 'an unsafe unsubmitted C must not replace a safe B');
  assert.equal(h.state.n4Planning, false);
  assert.equal(h.state.n4Decision, decision);
  assert.equal(h.state.n4Decision.deadlineSimTime, deadline, 'editing must preserve the existing deadline');
  assert.equal(invalidations(), count, 'unsafe C alone must not trigger an AI recommendation invalidation');
  assert(h.state.n4Decision.seconds < 15, 'the original decision clock continues advancing');
  console.log('PASS N4 unsafe draft preserves independent B and decision clock', { rate });
}

async function presentationRetryScenario() {
  const h = harness(); await h.ready();
  const event = h.state.flightEvent;
  event.presented = false; event.presentationQueued = false; h.state.n4Decision = null;
  h.context.n4PresentationReady();
  assert.equal(event.presentationQueued, true);
  await h.frame(); // First animation frame queues the actual presentation frame.
  h.state.n4Planning = true;
  await h.frame(); // Readiness has changed before the queued callback runs.
  assert.equal(event.presentationQueued, false, 'an aborted presentation must release its queue guard');
  assert.equal(event.presented, false);
  assert.equal(h.state.n4Decision, null, 'an aborted presentation must not start a decision clock');
  h.state.n4Planning = false;
  h.context.n4RefreshSnapshot(); h.context.n4PresentationReady();
  assert.equal(event.presentationQueued, true, 'restored readiness can schedule another presentation');
  await h.frame(); await h.frame();
  assert.equal(event.presented, true);
  assert.equal(event.presentationQueued, false);
  assert.equal(h.state.n4Decision.status, 'active');
  assert(Math.abs(h.state.n4Decision.deadlineSimTime - h.state.n4Decision.startedAtSimTime - 15) < 1e-7);
  console.log('PASS N4 aborted presentation retries and starts one decision clock');
}

(async () => {
  for (const rate of [1, 4, 8]) {
    await acceptScenario(rate);
    await editingScenario(rate);
    await timeoutScenario(rate);
    await unsafeUserRouteScenario(rate);
  }
  await geometryScenario();
  for (const rate of [1, 4]) {
    await stablePanelScenario(rate);
    await unsafeDraftKeepsCandidateScenario(rate);
  }
  await presentationRetryScenario();
})().catch(error => { console.error(error); process.exitCode = 1; });
