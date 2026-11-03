# Dynamic flight event verification — 2026-11-03

The external cockpit layout is retained: minimap lower left, controls lower right, telemetry below the scene. The assistant has three persistent compact sections and decision buttons. All transparency conditions share the content, event parameters, update logic and CSS; only the focused section changes.

## Browser walkthroughs

- N1: physically flew all four required photo stops, captured each photo, advanced to the next route target, and arrived at B. Current-leg checks and next-target ETA/charge updated between stops. Completed state shows actual charge and no remaining prediction.
- N2: departed on original A with no visible restriction; flight-time notice revealed an activity no-fly zone; aircraft approached a safe decision point. Original affected segment 4 was highlighted. The candidate stayed separate from the active route. At the observed decision: ETA 44→48 s, charge 80.2→80.1%. Accept committed B and actual flight reached C.
- N4: initially checked only the current leg; at flight time about 19.5 s T1 became a relevant conflict. At the final screenshot: current center separation 568.5 m, original predicted minimum 0.2 m, waiting-and-resuming C 43.3 m in the next 60 s. The route alternative still conflicted with T1, so C was recommended. A complete browser run with target speed/direction update finished at D with recorded minimum 42.5 m, above the 40 m experiment threshold. Surface clearance in the proximity HUD is explicitly labeled separately from center separation.
- N5: original route D→P4(450,550)→P5(350,330)→E(220,470). E is a level landing surface in the west park, verified against the full mesh and complete vertical descent. The actual browser flew normally to P4 and froze precisely there for the resource event: 15.7% available, original landing forecast 14.8% versus direct E 15.2%, 71→55 s remaining. Accept skipped P5, physically returned to the relocated E and landed at 1.38 m body-center altitude with actual 15.2% charge. P4 was recorded complete; P5 was not completed. The P5 and B landmark text rectangles do not overlap. Controller tests at 1×/4×/8× verify the exact P4 event position and E landing; the no-event original route physically visits both P4 and P5 in order.

## Layout and records

Browser viewport checks: 1194×834 and 1180×820 at 100% scale. Assistant height 420 px, scrollHeight equals clientHeight (418 px); all three sections and main decision buttons visible without collapse. N4 supplementary buttons end at y=470. Existing minimap and console retain their original anchors. No console errors in the final N4 walkthrough.

Exported a browser JSON record and verified event_detected, suggestion_updated, information_presented, operator_first_action, decision_confirmed and plan_execution_started. All contain wall-clock timestamps, simulation time, event ID, scene snapshots and plan version. In the observed N4 review, simulation time stayed 19.4864 s across the painted information and final confirmation despite elapsed wall time.

## Automated checks

Passed: test-route-evidence.cjs, test-traffic-comparison.cjs, test-event-process.cjs, test-traffic-flight.cjs, test-sat-decision.cjs, test-resource-flight.cjs, test-resource-deadline.cjs, test-n1-required.cjs, test-free-flight.cjs, test-n5-landing.cjs, test-sequence.cjs, test-resource-world.mjs; syntax checks on changed runtime code.

The actual controller at 1×/4×/8× holds and resumes after target motion changes with minimum separations 42.6/43.7/46.2 m. The 34-part world model produced 1348 colliders; the N4 original/resumed corridor had no entity intersection and sampled minimum building clearance 22.4 m (required 21.8 m).

## Explicit model limits

Traffic prediction uses planned own-aircraft motion and constant target velocity for up to 60 s; waiting includes both hover and resumed route. It is reevaluated on target changes and during yielding. Building minimum clearance is sampled every 8 m; separate entity intersection checks do not turn sampled clearance into a continuous-clearance guarantee. ETA/charge estimates do not model real wind, localization uncertainty or battery aging. No invented uncertainty ranges or probabilities are shown. Validation used desktop browser viewports matching the iPad landscape sizes, not physical iPad hardware.
