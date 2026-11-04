# N2 continuous decision workflow — 2026-11-04

## Event and time bases

- Route A is unchanged. Its flight-distance trigger is sampled in 12–16% of the actual route, including a route edited before departure. A temporary zone is then placed roughly 520–620 m farther along that route (short routes are constrained by their remaining length). The protected boundary is the zone radius plus its configured buffer.
- Flight motion, traffic motion, energy and ETA use simulation seconds. Decision time uses a persisted epoch deadline in real milliseconds, default 15 seconds. The research console provides a 5–60 second pre-experiment parameter; it is copied into each new N2 mission.
- The deadline starts only after the checked B route, the three information layers, map and enabled buttons have rendered. Rate changes, panel refreshes and entering/cancelling editing do not restart it. A page reload preserves the deadline and pauses simulation; an expired, valid B can be confirmed while paused and executes after explicit resume.
- The spatial budget includes remaining planning time (8 s initial budget), the real decision duration scaled into simulation travel, a 6 simulation second maneuver allowance, a 35 m margin and longitudinal braking at the experimental 5 m/s². The planning allowance decreases as real processing time elapses. Higher rates or excessive delay can trigger speed reduction or a hover at the safe branch anchor. Protection has its own event and never masquerades as a normal timeout.

## Active route and plan validity

- A remains the active route until a valid final decision. The B backbone is generated from a safe future branch anchor. Only its already-checked A prefix is trimmed as the aircraft moves; the displayed bypass structure remains stable. Final confirmation attaches from the actual position, never the old planning origin.
- Final checks cover current position, battery, exact zone/segment geometry, continuous mesh collision and current joining segments sampled every 3 m. The unchanged, previously sampled static backbone is reused at the same altitude. User edits receive asynchronous full checks and a fresh join check before submission.
- An explicit rejection cancels the B default, brakes to a hover and leaves simulation/traffic running. A later manual re-selection or valid edit is a new explicit choice. An invalid default at expiry produces protection, not execution.
- New airspace information invalidates the suggestion, visibly marks B as updated in L1, records a new plan version and retains an existing deadline. Unsubmitted edits are discarded on timeout. A late action cannot win a race against an already expired deadline.

## Six information stages

No separate top event notice is used. L1 contains event, countdown, motion state and execution source. The map editor repeats the same three L1 rows above its existing form.

1. Normal: configured destination and A, actual tracking deviation; whole checked A corridor/known-zone result and sampled minimum clearance; ETA and battery at C.
2. Planning: new notice, unchanged destination, actual safe flight or protection; affected A segments; straight-heading boundary ETA if that heading actually intersects the zone, otherwise an explicit explanation plus an along-A boundary estimate. B arrival predictions remain unavailable until computed.
3. Choice: candidate flow and real seconds left with disclosed default; actual candidate comparison and checks; same-position/same-time B arrival forecast and signed cost difference from infeasible A. A is only a comparison baseline.
4. User execution: explicit user source and next real navigation point; the actual confirmation-time joining corridor and its clearance; first bypass waypoint/next waypoint forecast plus C ETA/charge.
5. Automatic execution: explicit timeout source; actual expiry-time join clearance and remaining distance to A's protected boundary; future bypass-exit and C forecasts, including longitudinal acceleration from current actual speed.
6. After bypass: actual continued B or rejoined A; the remaining route receives a fresh asynchronous check; remaining distance, C ETA and charge update. No false claim that the new route has rejoined A is made.

Bypass completion is defined geometrically: pass the final exit of a circle centered on the zone with radius equal to the B route's closest approach plus 35 m. The remaining route no longer enters that approach neighborhood. This is an operational milestone, not passage through the forbidden circle. The zone remains displayed. Actual elapsed time and deviation from the confirmation-time exit forecast are logged.

## Verification

- `test-n2-continuous.cjs`: actual production tick/controller with a controlled real clock; acceptance, effective modification, explicit rejection, no action, unfinished edit, invalid default, restore, changed airspace version, an 8 s planning delay, 1×/2×/4×/8× and 1×→8×. Checks include continued aircraft/traffic motion, all six layer states, exact 15 s deadline, no false acceptance logs, current-position joins, no protected-circle entry and reaching configured C. Normal 1×, including 8 s processing, receives the complete 15 s without protective slowing.
- `test-n2-continuous-world.mjs`: all 34 model parts / 1,348 real mesh colliders; three event positions. Samples B and moving joins at decision offsets 0/5/15 simulation seconds, exact zone checks and continuous collision checks. Measured branch planning about 4.1–6.0 s on this host; available protected-boundary distances 440.0/490.0/525.1 m exceeded the measured planning + full decision + maneuver/braking requirement (351.2/354.4/373.5 m). Sampled building minima were 21.918/22.114/21.852 m against 21.8 m.
- Browser run at 1194×834, 100% zoom (11-inch iPad landscape layout target, not physical-device hardware): normal 1× → notice → candidate → user acceptance → C; separate no-action 1× → automatic execution → bypass completion → C; 4× protection, rejection and a later valid edit; 4× live countdown editing and submitting a 10 m/s route. No console errors observed during these runs.
- Pending panel: `clientHeight=scrollHeight=374`; all three button centers hit their own buttons. Rejected panel also fits at 374 px with all three layers and buttons. Editing keeps L1 and the unchanged deadline visible, left large map and right form do not overlap.
- N1 saved-photo, N1 mandatory-route, N4 event/prediction, N5 resource/takeover and free-flight regressions retained.

## Logs and limits

Events include detection, suggestion generation/version, information rendered, real decision window, first operation, final choice, timeout, protection, plan start/queued start, bypass completion and remaining-route check. Each log retains real timestamp, simulation time, rate, scene snapshot, version and operation source. `accept`, `modify_apply`, `reject`, `auto_execution` and `protective_action` remain separate. CSV exports now include real epoch time, rate and source. Edited rationale is retained.

The simulator does not model calibrated turning dynamics, bank angle/turn radius, real wind, localization uncertainty, payload, battery aging or stochastic prediction intervals. N2 is a constant-altitude route comparison with an experimental longitudinal acceleration/deceleration model. Building minima are sampled, not a continuous clearance guarantee; continuous collision is checked separately. The maneuver allowance is a configured simulation budget, not a validated real-aircraft capability. No success probabilities or arbitrary battery ranges are generated.
