# Research: what exists, and what should shape the pipeline

Five parallel research tracks plus a synthesis, run 2026-10-27 (build week Day 1, after the feasibility test passed). Each track file has the same four sections: Bottom line, Sources, Recommendations (tagged *build this week* or *roadmap/slides*), and Open questions.

| Track | File | One-line takeaway |
|---|---|---|
| Landscape | [landscape.md](landscape.md) | The plan §4 gap claim only partly holds. Shotwell and Roboto now overlap; what remains unclaimed is fusing robot data, tracks and video, plus calibrated abstention. |
| VLM judging | [vlm-judging.md](vlm-judging.md) | Ask one question per visual Criterion with `unsure` allowed. Crop the exterior cameras to the SAM box. Don't fix the success bias with more reasoning effort. |
| Measured and tracked | [measured-tracked.md](measured-tracked.md) | `measured.py` and the compiled Rubric disagree on thresholds. `regrasp_count` miscounts. LDLJ is a duration proxy. Add a tracking-health score. |
| Rubric compilation | [rubric-compilation.md](rubric-compilation.md) | Make each Criterion a typed call to a fixed primitive and render the English from it. Run a free dry run before confirm. |
| Triage and calibration | [triage-calibration.md](triage-calibration.md) | 20 labels can't support "±0.06". Keep review labels separate from audit labels. Get confidence from agreement across samples, and compare against Spark alone at matched coverage. |

## Spot-checked citations

I opened these myself, beyond what the track agents did:

| Claim | Source | Result |
|---|---|---|
| Localize-then-crop: macro 0.773 → 0.797; RoboArena (DROID) 0.740 → 0.810 | FailBench, arXiv 2609.03611 | ✅ Confirmed. The landscape track's "+2.3" is the macro gain and the VLM track's 0.740 → 0.810 is the RoboArena gain; both are right. |
| Best judge (Gemini 3 Flash) has 0.40 failure recall on REFLECT, 30 Episodes, all failures; the bias persists with more reasoning effort, and wrong answers come with longer reasoning | FailBench Table 2 and text | ✅ Confirmed, with a nuance: other models score higher on that slice (Gemma-4-31B 0.73, mean across models 0.567). plan.md's "catches only 40%" is accurate for the best overall model but should say so. |
| 5 of 7 curation metrics exploit episode length; AUROC 0.804 → 13.3% policy success, 0.638 → 90.0% | Bedi, arXiv 2606.10229 | ✅ Confirmed (abstract) |
| Shotwell: "Rubric verdicts for every step", "against your SOP", MP4/MCAP/LeRobot input, 24 h turnaround | shotwell.ai | ✅ Confirmed as vendor claims. Nothing on the site about telemetry or uncertainty. |
| Commercial scorer audit: 323 Episodes, zero weight on telemetry, corrections only raise scores, 70% flagged for disagreement, "video-only scoring is suitable for triage but not for filtering" | CosmicBrain preprint (PDF) | ✅ Confirmed verbatim. It's a company preprint, not peer-reviewed. |
| Judge confidence AUROC: verbalized 0.550, predictive probability 0.642, Simulated Annotators 0.723 (GPT-4-turbo, AlpacaEval) | Trust or Escalate, arXiv 2407.18370, Table 1 | ✅ Confirmed |

## Revisions after review (2026-10-27)

These supersede the stage map below wherever they conflict.

### A. The tracking findings are from one camera only

Spark judged with all three cameras (`judge_probe.py` loops over `CAMERAS`), but SAM ran only on exterior 1: `box_track_probe.py` hard-codes `exterior_image_1_left`, and all cached tracks in `data/feasibility/sam/` are `ext1`. So every tracking loss in [measured-tracked.md](measured-tracked.md) is from a single view. That includes Episode 16's block missing for 67 of 173 frames and the "object hidden in the gripper" pattern. Neither is a limit of the dataset.

- **Track per Criterion, per view.**
  - In-hand Criteria use the wrist camera, which sees exactly what the exterior cameras lose while the object is held.
  - Placement and drop Criteria use both exterior cameras.
- **Combine views with logic, not geometry.** Use "any view confirms" or "all views agree". The droid_100 views aren't known to be calibrated to each other (whether the extrinsics survive the LeRobot conversion is unverified), so there's no 3D triangulation. Disagreement between views is a real Needs review signal.
- **The rule "object hidden while held → unsure"** becomes the fallback for when the wrist view is also unhealthy, not the default.
- **SAM budget:**
  - SAM takes one concept and one camera per call, at $0.20 per 1,000 frames.
  - 3 views × 3 concepts at 15 fps is about $0.40 per Episode, or about $40 per 100. That's too much of our $150 in credits.
  - Track the gripper from robot data instead of SAM, and run SAM at about 5 fps. That brings it to roughly $0.08 per Episode. Whether tracks hold at 5 fps is untested.

### B. DESCRIBE becomes an interview

This replaces the "≤3 clarifying questions" in [rubric-compilation.md](rubric-compilation.md) R5. Precision of the Rubric is the product, so the interview keeps going until the coverage check is complete.

1. **Draft.** Spark compiles typed Criteria and marks every value it had to assume.
2. **Coverage check, in Winnow's code** (not by Spark, because of CLAMBER). It lists phrases no Criterion covers, Criteria with assumed values, and Criteria whose margin contains many Episodes.
3. **Questions, highest impact first, each answered by looking at real data:**
   - *Quantify:* "Is this 1.8 s pause long?" (clip and distribution)
   - *Scope:* "Whole Episode, or only while carrying?"
   - *Severity:* "Should a re-grasp that succeeds reject the Episode, or only lower its score?"
   - *Unsaid assumptions:* "Is dropping it from 5 cm into the bowl fine?"
   - *Edge cases:* Episodes the draft passes but that look wrong, or the reverse.

   Spark writes the questions; GATE found model-generated edge cases more informative than labels or prompts users write themselves.
4. **Stop** when coverage reads 100%: every phrase mapped, no assumed values, user confirms. The user can stop early, and open items are flagged.

Every answer is also stored as a label (review stream) and can be given by voice.

### C. SAM and robot data measure; Spark decides what to measure and reads the results

Asking Spark "was it okay?" is the baseline Winnow is compared against, not the pipeline. Spark's roles, with the research behind each:

| Role | Stage | What Spark does | Basis |
|---|---|---|---|
| **Composer** | Compile | Writes each check as condition (on SAM masks or robot data) × time pattern (always / eventually / count / at end) × phase (approach / transport / release) × camera views. Winnow runs the check; nothing generated is `eval`'d. Example: "never drops it while carrying" = *always(object moves with gripper) during transport, in the wrist and exterior views*. | L2R 90% vs 50%; Code-as-Monitor; NL2TL; VisProg ([rubric-compilation](rubric-compilation.md), [landscape](landscape.md)) |
| **SAM director** | Compile | Picks what to track ("black remote", "red bowl") and which views, and defines target regions such as "to the left". **Seeding SAM is unsolved.** Text prompts fail on the gripper and small objects at 320×180 (on every camera, even upscaled 2×), and box prompts track well. But in [the feasibility test](https://github.com/kleongf/winnow/issues/7), the frame-0 boxes Spark contributor gave were too imprecise to seed SAM. Candidates: the user draws one box, the standard tier, or the gripper position projected from robot data. | [Feasibility test](https://github.com/kleongf/winnow/issues/7) §A |
| **Interviewer** | Describe | Writes the questions in B; Winnow's code decides when to ask. | GATE; CLAMBER; Ambig-SWE |
| **Investigator** | Score | Gets the SAM and robot-data event timeline as text plus keyframes ("gripper closes 6.1 s; object moves with gripper 6.4–9.0 s; opens 9.2 s; object falls 4 cm in the wrist view"), reasons over it, and calls tools such as `crop(view, t)` and `track(concept, view)` when something doesn't add up. | REFLECT (43.8 → 68.8% explanation accuracy); Sentinel (+18% failures caught with VLM + statistical detector); KITE (track events as text, detail unverified) ([vlm-judging](vlm-judging.md)) |
| **Semantic judge** | Score | Covers what geometry can't decide: grasp type, upright vs tipped, pouring or spilling, deformables, stacking. It answers pass / fail / unsure about the specific moment the measurements point to, in a crop, from two views. Example: Episode 48's spill, with the cup tilt time taken from the cup track and robot data. | FailBench crop; CheckEval; TICK |
| **Critic** | Triage | Tries to refute each claimed failure before Reject, especially where SAM and robot data disagree. | RoboGaze critic (clean-clip accuracy 17 → 85%) |
| **Explainer** | Output | Writes the one-line reason from the Evidence, using a failure vocabulary (no grasp, slip, wrong place, wrong object). | AHA |
| **Refiner** | Iterate | Proposes the missing Criterion when a human rejects an Episode that passes everything, and flags thresholds that look wrong from dry-run pass rates. | EvalGen criteria drift; Eureka reward reflection |

**What Spark must not do:**
- Apply pass/fail on hard Criteria in its head. Winnow's code applies thresholds; RubricBench found models with the correct rubric still fail to enforce it.
- Answer a single holistic question. That's the baseline, which leans toward "success" (FailBench).
- Supply triage confidence by stating it. Verbalized confidence has AUROC 0.550 (Trust or Escalate).
- Escalate by raising reasoning effort. FailBench found wrong answers come with longer reasoning.

**Episode 42 under this design.** Ground truth from [the feasibility test](https://github.com/kleongf/winnow/issues/7): three failed grasps, then a hold at 0.59 for 2.8 s while z rose 12 cm, then a release in mid-air.
1. Robot data shows the failed attempts, then a held lift of 12 cm, then the gripper opening while the arm is still raised (release about 10 cm above the cushion).
2. The SAM track agrees: the remote rises with the lift (box centre y 148 → 118 px), then jumps to a new resting spot after the gripper opens at 18.2 s.
3. Spark reads that timeline and checks the release moment in a crop. Its job is the semantic part: did the remote land to the left, and was the release a placement or a drop.
4. The reason it writes comes from that Evidence: "re-grasped 3×, then released the remote ~10 cm above the cushion at 18.2 s."

Compare Spark alone: it got the Triage decision right but the account wrong. It said "gripper lifted empty… remote never moved", which the robot data contradicts. Winnow's edge here is the Evidence, not the decision.

No step asks "was it okay?"

## Stage-by-stage map (plan §5)

### 1. Describe
- Name competitors honestly and lead with fusion plus calibration, not with "plain English" alone ([landscape](landscape.md) §1).

### 2. Compile
- **A Criterion is a typed primitive call:** `primitive, params, comparator, threshold, unit, margin, window, source_phrase, assumed, on_missing`. The English shown to the user is rendered from those fields ([rubric-compilation](rubric-compilation.md) §3b). This one change fixes the threshold drift that the measured-tracked and rubric-compilation tracks both found independently: gripper 0.5 vs 0.2, and pauses at 0.02 m/s for 2 s vs 0.01 m/s for 1 s.
- **Primitive catalog** as Spark function tools ([rubric-compilation](rubric-compilation.md) §3c), with corrected definitions from [measured-tracked](measured-tracked.md) §3.2:
  - Closures use hysteresis.
  - `failed_attempts` (lift < 2 cm) replaces `regrasp_count`.
  - Pauses are smoothed and exclude moments when the gripper is moving.
  - No LDLJ.
- **Route each Criterion to the cheapest source that can decide it** (robot data, then tracks, then video), and tag what can observe it ([landscape](landscape.md) R6, [rubric-compilation](rubric-compilation.md) §3c).
- **Dry run before confirm:** run measured Criteria for free on every Episode and show pass rates, histograms, and a check against dataset labels. Send any validation errors back to Spark in one repair turn.
- **Clarify through the DESCRIBE interview** (revision B), triggered by thresholds Spark had to assume and anchored on real borderline Episodes. Put Criteria that Spark invented in an off-by-default "suggested" group.

### 3. Score
- **Visual Criteria:** one question per Criterion, answering `pass | fail | unsure`, with observations written before the answer. Burn timestamps into the frames, add keyframes chosen from gripper events, crop the exterior cameras to the SAM box, and send the wrist camera whole ([vlm-judging](vlm-judging.md) R1–R3).
- **Tracked Criteria:** compute a tracking-health score (present, confident, steady, resolvable) for each view. Choose views per Criterion and combine them with any/all logic (revision A). Return *unsure* only when every relevant view is unhealthy ([measured-tracked](measured-tracked.md) §3.3, written from one view only).
- **Evidence schema:** borrow DQAF's per-check fields (metric, observed value, threshold, status, time window, subtask) ([landscape](landscape.md) R3). Primitives return `{value, threshold, frames, unit}`.

### 4. Triage
- **Weakest-link rule:** any crisp hard fail → Reject; all crisp hard passes → Keep; otherwise Needs review, with the reason ([triage-calibration](triage-calibration.md) R1).
- **Uncertainty signals:**
  - a value inside a Criterion's margin;
  - disagreement across K = 3 paraphrased Spark samples;
  - a conflict between sources, such as gripper vs SAM, SAM vs Spark, or Spark vs Glimmer;
  - poor tracking health.
- **Not verbalized confidence**, which ranks errors at roughly chance level.
- **Soft Criteria** score against a robust z-score within the dataset (median/MAD), not fixed cutoffs. They feed the quality score and never reject an Episode on their own ([measured-tracked](measured-tracked.md) §1.3).

### 5. Calibrate
- **Two label streams:**
  - *Review* labels come from Needs review, least confident first. They tune the margins.
  - *Audit* labels are a seeded random sample of auto-Keeps. They are the only input to the precision estimate.
- **On-screen statistics:** show the count plus a Wilson or Clopper–Pearson interval. Example: "14/15 good → 0.93 (95% CI 0.70–0.99)". Never show "±0.06" from 20 labels. Say "tuned on 20 labels", not "guaranteed" ([triage-calibration](triage-calibration.md) R3).
- **What labels can change:**
  - Labels tune only margin widths, chosen from a fixed grid with fixed-sequence testing.
  - Threshold changes are *suggested*, and the user accepts them. This resolves a conflict between the tracks: rubric-compilation R6 fits thresholds from labels, while triage-calibration R4 says to suggest them only. We follow triage-calibration, because the Rubric stays the user's.
- **Two-way calibration:** a label must be able to move Episodes in either direction. The audited commercial scorer failed exactly this.

### 6. Output and evaluation
- **Comparison against Spark alone:**
  - matched-coverage precision;
  - a worst case with every Needs review forced to Keep;
  - the false-keep rate on true failures, with a Wilson CI;
  - risk–coverage curves;
  - McNemar discordant counts.
- **A length-only baseline** goes next to Spark alone.
- **Claim review time saved, not better policies.**

### 7. Iterate
- **Cache key** `(criterion_id, params_hash, episode_id)`, with a locked Rubric version per run. Editing a sentence recompiles, matches Criteria by id or `source_phrase`, and re-runs only the ones that changed ([rubric-compilation](rubric-compilation.md) R8).
- **"Rejected but every Criterion passed"** prompts a new Criterion (roadmap).

## Proposed changes to docs/plan.md

These are not applied; they're for you to accept or reject.

1. **§4 gap claim:** replace it with the reworded version in [landscape.md](landscape.md) §1. Add Shotwell AI and Roboto Agents to the table and the §13 competition row.
2. **§4 DQAF row:** "fixed signals; not user-definable" is wrong. Its subtask plan can be user-provided. Suggested replacement: "fixed metric set, live operator feedback; no arbitrary Criteria, no abstention."
3. **§4 failure detectors row:** Instance isn't in FailBench. The fine-tuned detectors it evaluated are Guardian, RoboReward-8B, ViFailback-8B, RoboFAC-7B and FailSense.
4. **§2 FailBench row and pitch line:**
   - Say "the best overall judge (Gemini 3 Flash) caught 40% on a 30-Episode failure-only set".
   - The crop gain is +7 points on DROID robots (0.740 → 0.810). That's worth citing, since Winnow crops with SAM.
5. **§3 Encord:** the source says total revenue rose more than 10× over 18 months, not physical-AI revenue over 12 months.
6. **§5 step 5:** replace "reports estimated precision with an error bar" with "reports audited precision as a count plus a confidence interval". Add the review/audit split.
7. **§6 cost:** video costs about 71–75 input tokens per camera-second. Reasoning output is 50–80% of the cost per Episode, so it's the real cost driver; escalate by changing the input, not by using `max`.
8. **§12 evaluation:** add the length-only baseline, matched-coverage comparison, and Needs-review-forced-to-Keep worst case, and report false-keep and false-reject separately.
9. **§13 risks:** add the CUPID and Bedi caveat that quality filtering can hurt diversity. Keep re-grasp and smoothness Criteria soft by default.
10. **§5 step 1:** turn Describe into the interview (revision B).
11. **§5 step 2 and §6 Spark row:** Spark's roles become composer, SAM director, investigator, semantic judge, critic, explainer and refiner (revision C). Measured and tracked Criteria decide physical facts; Spark is never the holistic judge.
12. **§5 step 2 SAM row and §13 "SAM loses small/fast objects":** track per Criterion across views, and add the SAM budget from revision A to §6's cost cascade.

## Code issues found (not fixed here)

From [measured-tracked.md](measured-tracked.md) §3.1:
- `CLOSED_THRESHOLD = 0.2` disagrees with the compiled Rubric's 0.5. That changes the closure count on 23 of 100 Episodes.
- `regrasp_count = closures − 1` penalizes multi-object tasks (Episodes 84 and 98) and gripper chatter (Episode 42).
- `longest_pause_s` returns 0 below 1 s, which throws away near-threshold information.
- `duration_s` is off by one frame.

## Quick experiments, by value

The ones that cost API credits need your go-ahead.

| # | Experiment | Cost | Why it matters | Track |
|---|---|---|---|---|
| 0 | Track the object on exterior 2 and wrist for Episodes 16 and 42 (where exterior 1 lost it) | ~$0.30 | Tells us whether multi-view fixes the tracking losses before we design around it (revision A) | review |
| 1 | Does episode length alone predict the success labels? | free | Shows whether pause and duration Criteria need length control; it's also the baseline row | landscape Q1 |
| 2 | Spark vs `measured.py` thresholds against the dataset labels | free | Picks the defaults; good material for a slide | rubric Q3 |
| 3 | Watch the 21 Episodes with a no-lift closure | free (~30 min) | Checks the `failed_attempts` rule and whether it depends on the task | measured Q1 |
| 4 | Do repeated identical calls to Spark at high effort give different answers? | ~$0.05 | Decides whether K = 3 needs paraphrasing | triage Q1 |
| 5 | Framing flip: "met?" vs "any sign NOT met?" | ~$0.05 | Cheapest direct measure of Spark's lean toward "success" | vlm Q4 |
| 6 | SAM crop vs full frame on 10–20 Episodes | ~$0.10 | The one input change with a published gain on DROID | vlm Q2 |
| 7 | What frame rate does Spark sample? (synthetic counter video) | ~$0.01 | Tells us whether short slips and drops are even visible to it | vlm Q1 |
| 8 | Compile stability: 8 descriptions × 3 runs | ~$0.05 | Checks that typed compiles are repeatable and that impossible Criteria come back "unsupported" | rubric Q1 |
