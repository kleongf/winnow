# Landscape refresh: robot-data curation and success detection

*Research track: landscape. Checked 2026-10-27 against primary sources (arXiv abstract or HTML pages, official repos, company pages). Anything not confirmed in a primary source is marked UNVERIFIED.*

## 1. Bottom line

**Does the gap claim in plan §4 still hold? Only partly. Reword it.**

The claim was: "No tool found that filters robot demos from *user-written* 'expert' criteria, before training, with evidence and calibrated uncertainty." Each part of that now exists somewhere:

- **User-written criteria.** Shotwell AI (YC Spring 2026) markets "rubric-based pass/fail" checks per step "checked against your SOP," with timestamped evidence, filtering, and LeRobot input. Roboto Agents (live July 2026) take a plain-language description and search time-series, video, and logs for matching moments, then export to LeRobot.
- **Evidence and Needs review in a commercial product.** CosmicBrain's October 2026 audit describes an anonymized commercial "demonstration scoring" service that already outputs facet scores, outcome labels including "needs review," and free-text evidence.
- **Telemetry plus VLM with evidence.** DQAF (Siemens, May 2026) fuses VLM subtask progress with telemetry metrics. It aligns each violation to a subtask and writes natural-language feedback. Its thresholds are calibrated from expert Episodes.
- **Open-source filter and export.** `score_lerobot_episodes` scores LeRobot Episodes with heuristics plus a Gemini task-success grade, thresholds them, and writes a filtered LeRobot dataset.

What we did **not** find in any public material is the combination Winnow is building:

1. Free English compiled into an **editable Rubric of typed Criteria**, each run on the right modality: robot data, object tracks, or video.
2. **Calibrated abstention.** Needs review is driven by measured uncertainty, and precision is reported with an error bar from 10–20 human labels.
3. A **published accuracy check** against a same-model VLM-only baseline, focused on false "success."

No vendor we found publishes calibration or false-success rates. The one independent audit of a commercial scorer found it gave 0% weight to robot telemetry and its human review could only raise scores.

**Suggested rewording for §4:**
> Tools now exist that score or search robot Episodes (Shotwell, Roboto, DQAF, score_lerobot_episodes, commercial scoring services). None that we found turns a team's own English definition of "expert" into checks over robot data, object tracks *and* video, or reports how often its "keep" is wrong and abstains when unsure. An independent audit of one commercial scorer found it ignored robot telemetry and its corrections only went one way.

**What Winnow should do differently because of this research:**

1. **Reposition against Shotwell, Roboto, and commercial scorers, not just Instance and RoboFAC.** "Plain-English criteria" alone is no longer unique. Lead with *fusion plus calibration*: robot data and tracks catch what video misses, and Winnow says when it's unsure and how often it's right. Update plan §4 and §13 (competition row).
2. **Adopt the "who checks the checker" checklist as Winnow's own acceptance test** (CosmicBrain preprint).
   - Robot telemetry must carry real weight in Triage decisions.
   - Human labels must be able to move thresholds *both* ways.
   - Report directional bias: false Keep vs false Reject.
   - Check camera invariance.

   These make a cheap, credible results slide: "Winnow passes the checks a commercial scorer failed."
3. **Add an episode-length-only baseline to the evaluation.** Bedi (arXiv 2606.10229) found that 5 of 7 curation metrics were exploiting episode length, which inflated AUROC to near-perfect. Winnow's "no long pauses" and completion-time Criteria correlate with length. Report a length-only baseline next to "Spark alone" so the comparison can't be dismissed.
4. **Tag every Criterion with the modality that can actually observe it.** Several 2026 papers agree:
   - Action-only scorers miss structural defects; state trajectories catch them (arXiv 2606.05588).
   - False successes are visible in joint data for some tasks but need vision for others (arXiv 2606.03134).
   - VLM judges are near chance on contact-heavy tasks (FailBench).

   The compiler should prefer measured or tracked Criteria when they can observe the property. When only video can, it should mark the Criterion as visual-only and route it to Needs review more readily.
5. **Don't claim better policies; claim measured review savings.** Detection accuracy and policy success were decoupled in a controlled study (2606.10229). Voxel51's own guidance says "validate with a training run before you delete anything." Winnow can't train this week, so pitch it as "keeps Episodes at X% measured precision and saves Y review minutes." Demo-SCORE, CUPID, and QoQ gains are motivation, not Winnow results.

**Corrections to plan.md found along the way** (for the owner of plan.md; not edited here):

- §4 says DQAF has "fixed signals; not user-definable." In fact its subtask plan "may be user-provided or automatically generated from the task description," and its thresholds are set from expert reference Episodes. A fairer line: "fixed metric set, live operator feedback; no arbitrary criteria, no abstention."
- §2's "catches only 40% of true failures on the failure-only subset" is Gemini 3 Flash on REFLECT, a 30-Episode failure-only source. Quote it as such.
- §4 lists Instance next to "fine-tuned detectors underperform general models on FailBench." Instance is not in FailBench. The fine-tuned detectors evaluated there are Guardian, RoboReward-8B, ViFailback-8B, RoboFAC-7B, and FailSense-Calvin-3B.
- §3 says Encord saw "10x growth in physical-AI revenue in 12 months." SiliconANGLE (2026-02-26) says total revenue "surged more than 10 times" in the 18 months since its previous round, not physical-AI revenue specifically.

## 2. Sources

### Landscape table

| Name | What it does | Overlap with Winnow | How Winnow differs |
|---|---|---|---|
| **Shotwell AI** (YC Spring 2026) | Data QA layer for teleop and egocentric data: step segmentation, dense captions, "rubric-based pass/fail" against the customer's SOP, timestamped evidence, filtering; MP4/MCAP/LeRobot in, JSON/CSV out | **Highest.** User-supplied procedure, per-step pass/fail, evidence, filtering, LeRobot | Their site describes a service with a 24-hour turnaround, not interactive editing. No stated use of robot telemetry, calibrated uncertainty, or abstention (UNVERIFIED either way; marketing page only) |
| **Roboto Agents** (Roboto AI, Jul 2026) | Plain-language description → Agents search time-series, video, and logs → timestamped Events and Collections → export to LeRobot | High. NL input, multimodal, LeRobot export | Finds *moments*; doesn't judge Episodes against a quality bar. No Keep/Reject/Needs review, no calibration stated |
| **DQAF** (Siemens, arXiv 2605.26349) | Post-Episode teleop feedback: VLM subtask progress + 4 telemetry metrics, cross-modal evidence items, 0–10 quality score, NL feedback | High. Telemetry + VLM fusion, evidence, explanations | Fixed metric set, live feedback during collection (not batch curation), no abstention, no filtering shown, no code |
| **"Service A"** in CosmicBrain audit (anonymized commercial scorer) | Per-Episode quality score from facets, outcome label, review grade incl. "needs review," free-text evidence | High in output shape | Audit: 0% telemetry weight, corrections only raise scores, 70% of Episodes flagged for reviewer disagreement. Winnow's design targets exactly these flaws |
| **score_lerobot_episodes** (open source) | Heuristic scores (blur, smoothness, path efficiency, gripper, saturation, runtime) + Gemini task success; threshold → filtered LeRobot dataset | Medium-high. Filter + export, VLM success grade | No user-written criteria, no uncertainty, single aggregate threshold |
| **Voxel51 FiftyOne LeRobot curation / Episode Quality** | Ranks Episodes worst-first on smoothness, time, gripper, integrity, camera, and static language checks | Medium. Measured criteria | Explicitly "not an automatic accept/reject gate"; no models, no custom criteria; measures *how*, not *what* |
| **Instance** (YC S26) | Success detector: task description + video → success/failure with subtask captions | Medium. Video success judging | Pass/fail only; aimed at policy evaluation; no user-written quality criteria, no telemetry |
| **Labelbox Terra** | Managed robotics data vendor: capture rigs; every Episode "auto-categorized and validated, with human review on edge cases" | Medium. Auto-check + human review of edge cases | Vendor-defined QA on data they collect; not a tool for your own data or criteria |
| **Encord** (Active/Index, physical AI) | Data management, curation, and evaluation platform; Aug 2026 guide recommends routing ambiguous Episodes to humans | Low-medium | General infrastructure; no task-semantic NL Rubric found |
| **FailBench** (arXiv 2609.03611) | Benchmark: 2,197 attempts, 14 sources, 13 VLM judges | Evaluation context | Benchmark, not a tool; supplies Winnow's "why" and the crop idea |
| **Guardian, RoboReward, AHA, RoboFAC, ViFailback, FailSense** | Fine-tuned failure detectors and reward models | Medium. Success/failure judging | Fixed task-success notion; FailBench shows specialists underperform general VLMs |
| **RoboGaze** (arXiv 2606.28385) | Training-free multi-agent VLM evaluator with a critic; time-localized failure reports (for world-model videos) | Medium. Timestamped "what, when, why" | Targets generated videos, not real Episodes; fixed 30-type failure taxonomy |
| **PRM-as-a-Judge** (arXiv 2603.21669) | Process-reward-model judge giving dense progress/efficiency/stability scores | Low-medium | Trained judge, fixed dimensions |
| **Code-as-Monitor** (CVPR 2025, arXiv 2412.04455) | VLM writes code over tracked geometric "constraint elements" to detect failures | Medium. Language → executable check over tracks | Runtime monitoring, not dataset curation; constraints from the task, not a user's quality bar |
| **GVL** (arXiv 2411.04549) | VLM predicts progress by ordering shuffled frames; used for dataset filtering and success detection | Medium | Single generic progress signal, not user Criteria |
| **Demo-SCORE, CUPID, QoQ, ATHENA, RoboDrop, DemInf, SCIZOR, WARP-RM, RINSE** | Learned or statistical curation: rollouts, influence functions, gradients, mutual information, progress models, smoothness | Same goal (better training set) | Need a trained policy, rollouts, or gradients, or optimize a generic signal; no user criteria, no explanations |
| **Bedi audits** (arXiv 2606.05588, 2606.10229, 2606.03134) | Show curation metrics exploit length, miss structural defects, and that observability depends on task | Evaluation methodology | Not tools; tell Winnow how to evaluate honestly |
| **No Free Checker** survey (arXiv 2609.09250) | ~150 verifiers; "credibility falls as availability rises" | Framing | Survey |
| **MMPF** (arXiv 2608.07895) | Detects instruction–trajectory mismatches | Low-medium (droid_100 has dropped instructions) | Label-consistency check, not quality judging |
| **IMBench** (arXiv 2607.15641) | Benchmark whose data pipeline used human 1–5 scoring, then a VLM agent check, then human review | Pipeline shape | Internal pipeline; agent details UNVERIFIED (appendix not read) |

### Per-source notes

**Products and tools**

- **Shotwell AI.** YC page: https://www.ycombinator.com/companies/shotwellai · site: https://shotwell.ai/
  - *Finding:* YC page says "building the data QA layer for dexterous robotics … validate task adherence." The site claims "Sub-second boundaries for every step, checked against your SOP," rubric-based pass/fail per step, filtering, timestamped evidence, LeRobot/MCAP/MP4 input, 24-hour turnaround, and "6× more operators per engineer" (Ultra case study).
  - *Stage:* Pitch, Compile, Score.
  - *Borrow:* Per-step (subtask) segmentation as the backbone for Evidence timestamps.
  - *Caveats:* All claims come from the vendor; site content was read through a summarizer. Whether rubrics are customer-written English, and whether any uncertainty is reported, is UNVERIFIED. This is the closest competitor; name it.
- **Roboto Agents.** https://www.roboto.ai/blog/data-curation/ (Yves Albers, 2026-07-23)
  - *Finding:* "describe a moment you care about in plain language, and Agents search your time-series, video, and logs"; outputs Events, Collections, and LeRobot export; "Everything we launched is live now."
  - *Stage:* Describe, Output.
  - *Borrow:* Their framing line, "describe your failure modes and you get triage." Also, Collections exported as LeRobot matches Winnow's output plan.
  - *Caveats:* Retrieves moments rather than judging Episodes; no stated accuracy.
- **CosmicBrain AI, "Who Checks the Checker? Auditing Automated Demonstration Scoring for Teleoperated Robot Data, and a Telemetry-First Verifier Stack."** Preprint, Oct 2026: https://www.cosmicbrain.ai/docs/cosmicbrain-eval-layer-2026-10.pdf
  - *Finding:* An audit of one commercial scorer on 323 teleop Episodes (9.4 h). Mean score 8.88/10 and 84.2% success, but "zero weight on robot telemetry," "human corrections only raise scores," and "70% of episodes are flagged for reviewer disagreement." Duration and score correlate at r = 0.07. Conclusion: "video-only scoring is suitable for triage but not for filtering training data." Proposes a telemetry-first verifier with "two-way correction, disagreement routing to calibrated humans and an auditable evidence ledger."
  - *Stage:* Triage, Calibrate, Evaluation.
  - *Borrow:* Its validation protocol: no directional bias vs humans, camera invariance, predictive validity.
  - *Caveats:* Company preprint (not arXiv or peer-reviewed); vendor anonymized; n = 323 from one humanoid dataset.
- **score_lerobot_episodes.** https://github.com/RoboticsData/score_lerobot_episodes · HF blog (2025-10-17): https://huggingface.co/blog/robotdata/score-lerobot-episodes
  - *Finding:* README says "Gemini grades whether the desired behavior happened." Other dimensions are OpenCV/kinematic heuristics. `--threshold` and `--output` write a filtered LeRobot dataset. 78 stars at time of reading.
  - *Stage:* Output, Score.
  - *Borrow:* Its CLI shape (`--threshold`, `--output`) is a cheap baseline Winnow could compare against.
  - *Caveats:* No training-gain evidence in the blog; no custom criteria.
- **Voxel51 / FiftyOne.**
  - Plugin: https://github.com/harpreetsahota204/lerobot_data_curation
  - Blog, 2026-08-13: https://voxel51.com/blog/robot-episode-quality-triage
  - Blog, 2026-10-08: https://voxel51.com/blog/lerobot-dataset-curation-metrics
  - *Finding:* Metric families are smoothness (SPARC/LDLJ/jerk), time, tracking, gripper, consistency, integrity, camera, and static language checks. "The plugin has no model-based metrics by design." "Do not use it as an automatic accept/reject gate." "Motion metrics score *how* an action was executed, never *what* the action was."
  - *Stage:* Compile (measured Criteria), Pitch.
  - *Borrow:* Its idle-fraction definition (speed below 0.05× the Episode's own moving speed) is an Episode-relative pause threshold that may be more robust than Winnow's fixed 0.02 m/s. Also their framing that a long pause should be a flag, not a rejection. That maps to a soft Criterion.
  - *Caveats:* Community plugin by a Voxel51 hacker-in-residence, not core FiftyOne.
- **Instance (YC S26).**
  - Launch: https://www.ycombinator.com/launches/RPi-instance-automated-evaluation-for-robot-policies-starting-with-the-success-detector
  - Company page: https://www.ycombinator.com/companies/instance
  - *Finding:* Takes a task description and video and returns success/failure "with detailed subtask captions." Claims higher accuracy than Claude Opus 4.8 at lower latency on "10,000+ … human-labeled episodes across 7 robot platforms."
  - *Stage:* Pitch (competition).
  - *Borrow:* Nothing technical. Their accuracy claim shows that the judging step alone is becoming a commodity.
  - *Caveats:* Vendor benchmark, not independent. A third-party summary says teams "clean training data" with it, but that line isn't on YC's own pages (UNVERIFIED).
- **Labelbox Terra.** https://labelbox.com/products/robotics
  - *Finding:* "Every episode is auto-categorized and validated, with human review on edge cases. Episodes that fail are re-recorded, not shipped."
  - *Stage:* Triage.
  - *Borrow:* Validation that the auto-check-plus-human-edge-case pattern is industry practice.
  - *Caveats:* Managed data service; criteria are vendor-defined.
- **Encord.**
  - SiliconANGLE, 2026-02-26: https://siliconangle.com/2026/02/26/physical-ai-data-infrastructure-startup-encord-lands-60m-accelerate-intelligent-robot-drone-development/
  - Encord guide, 2026-08-20: https://encord.com/blog/curate-robot-episode-data/
  - *Finding:* Revenue "surged more than 10 times" in the 18 months since its previous round. The guide recommends automated scoring that routes "the small number of genuinely ambiguous cases to a human reviewer."
  - *Stage:* Pitch (market).
  - *Borrow:* Their own guide endorses Winnow's Needs review design.
  - *Caveats:* The guide is advice, not a described product feature.

**Success and failure detection**

- **FailBench.** Navasardyan, Danielyan, Davtyan. arXiv 2609.03611 (2026-09-03): https://arxiv.org/html/2609.03611v1
  - *Finding:*
    - The best of 13 models reaches 0.77 mean balanced accuracy.
    - Fine-tuned specialists (Guardian, RoboReward-8B, ViFailback-8B, RoboFAC-7B, FailSense-Calvin-3B) "consistently underperform general-purpose VLMs."
    - Scores fall below 0.60 on contact-intensive tasks.
    - Gemini 3 Flash scores 0.72 on the RoboArena (DROID) slice and 0.40 failure recall on REFLECT (30 failure-only Episodes).
    - Success bias "persists even with increased reasoning effort."
    - A localize-then-crop step raised macro balanced accuracy from 0.773 to 0.797.
  - *Stage:* Score (visual Criteria), Evaluation.
  - *Borrow:* Crop to the deciding region before judging. SAM 3.1 boxes can give Winnow this for free.
  - *Caveats:* Success bias is described qualitatively. Muse Spark wasn't evaluated.
- **RoboReward.** Lee, Wagenmaker, Pertsch, Liang, Levine, Finn. arXiv 2601.00675 (2026-01-02).
  - *Finding:* 4B/8B VLM reward models trained with counterfactual relabeling and temporal clipping to make negatives. The 8B model is claimed to improve policy learning over Gemini Robotics-ER 1.5.
  - *Stage:* Evaluation.
  - *Borrow:* Temporal clipping of a success Episode (cut before placement) makes a free synthetic failure for testing Winnow's "object placed inside target" Criterion.
  - *Caveats:* It underperforms general VLMs on FailBench.
- **AHA.** Duan et al. arXiv 2410.00371 (2024-10-01).
  - *Finding:* VLM fine-tuned on FailGen synthetic failures; "outperforms GPT-4o by 10.3%."
  - *Stage:* Pitch (prior art).
  - *Borrow:* Nothing new.
  - *Caveats:* Synthetic failures; predates FailBench.
- **RoboFAC.** Ye et al. arXiv 2505.12224 (v. 2026-10-07).
  - *Finding:* 9,440 erroneous trajectories and 78,623 QA pairs; "34.1% higher accuracy in failure analysis compared to GPT-4o."
  - *Stage:* Evaluation (secondary dataset, already in plan §12).
  - *Caveats:* On FailBench's REFLECT set, RoboFAC-7B gets 1.00 failure recall, which suggests it leans toward calling everything a failure.
- **Guardian.** Pacaud, Garcia, Chen, Schmid. arXiv 2512.01946 (v. 2026-10-25).
  - *Finding:* Multi-view reasoning VLM trained on GuardianFail-36k (perturbed RLBench and BridgeData V2), with pass/fail, failure category, and reasoning trace. Code, data, and models released.
  - *Stage:* Pitch.
  - *Caveats:* Underperforms general VLMs on FailBench.
- **RoboGaze.** Nguyen et al. arXiv 2606.28385 (v. 2026-10-10).
  - *Finding:* Training-free multi-agent VLM evaluator with "temporally localized diagnostic reports that state what failed, when, why and how severely." A critic pass raises clean-clip accuracy from 17% to 85%.
  - *Stage:* Score, Triage.
  - *Borrow:* A critic that re-checks each claimed failure before Reject. This is the cheap cure for false Rejects.
  - *Caveats:* Built for world-model (generated) video, not real Episodes.
- **PRM-as-a-Judge.** Ji et al. arXiv 2603.21669 (2026-03-23).
  - *Finding:* Dense Outcome-Process-Diagnosis scoring of robot executions; introduces the RoboPulse benchmark.
  - *Stage:* Score (soft Criteria).
  - *Caveats:* Needs a trained PRM; not explored further.
- **Code-as-Monitor.** Zhou et al. arXiv 2412.04455 (CVPR 2025).
  - *Finding:* "VLM-generated code" evaluates spatio-temporal constraints over compact geometric "constraint elements."
  - *Stage:* Compile.
  - *Borrow:* Prior art for "language → executable check over tracks." Cite it on the technical-depth slide to show Winnow's compile step has precedent, applied here to curation.
  - *Caveats:* Runtime monitoring, not curation.
- **GVL.** Ma et al. arXiv 2411.04549 (2024-11-07, ICLR 2025).
  - *Finding:* A VLM orders shuffled frames to estimate progress; used for "dataset filtering, success detection, and advantage-weighted regression … without any model training."
  - *Stage:* Score (possible extra signal).
  - *Borrow:* A progress curve that dips or plateaus marks *when* an Episode went wrong.
  - *Caveats:* Many frames per call means token cost; untested with Spark.

**Curation methods (need a policy, gradients, or a generic signal)**

- **QoQ.** Lee et al. arXiv 2603.09056 (2026-03-10).
  - *Finding:* Influence-function curation against validation Episodes; says curation is "largely manual and heuristic-driven."
  - *Stage:* Pitch (problem).
- **ATHENA.** Xu et al. arXiv 2606.16208 (2026-06-15).
  - *Finding:* Influence functions scaled to billion-parameter multitask VLAs (~313× faster). Matches full-data performance with 50% of data in simulation and 66.7% on six real tasks.
  - *Stage:* Pitch.
  - *Caveats:* Needs a trained VLA.
- **RoboDrop.** Xu et al. arXiv 2609.10021 (2026-09-09).
  - *Finding:* Gradient-compatibility filtering during VLA post-training; real-robot success rose from 35.0% to 67.5%.
  - *Stage:* Pitch.
  - *Caveats:* Needs gradients and a warm-up epoch.
- **WARP-RM.** Yu et al. (Goldberg lab). arXiv 2606.28320 (2026-06-26).
  - *Finding:* Self-supervised progress reward model from time-warped Episodes; filters and reweights action chunks; keeps 31.5% of data.
  - *Stage:* Pitch.
  - *Caveats:* Trained model, generic progress.
- **DemInf.** Hejna et al. arXiv 2502.08623 (2025).
  - *Finding:* Mutual-information estimates "partition demonstration datasets by quality"; 5–10% gain on RoboMimic.
  - *Stage:* Pitch.
- **SCIZOR.** Zhang et al. arXiv 2505.22626 (2025).
  - *Finding:* Self-supervised removal of suboptimal and redundant transitions; average gain 15.4%. Its dominant failure modes are "Slow Motion, Manipulation Failure, and Pause."
  - *Stage:* Compile.
  - *Borrow:* Those three failure modes are a sensible default suggestion list for the Rubric compiler.
- **RINSE.** Kulkarni, Dhar, Cui. arXiv 2604.23000 (2026-04-24).
  - *Finding:* Smoothness (spectral arc length) filtering gave "16% higher success using one-sixth of the data" on RoboMimic.
  - *Stage:* Compile (soft smoothness Criterion).
  - *Caveats:* Contradicted in part by Bedi's audits.
- **Demo-SCORE.** Chen, Lessing, Liu, Finn. arXiv 2503.03707.
  - *Finding:* Rollout classifier; "15-35% higher absolute success rate."
  - *Stage:* Pitch.
  - *Caveats:* Needs rollouts.
- **CUPID.** Agia et al. arXiv 2506.19121.
  - *Finding:* Influence functions on rollouts; under 33% of data reaches SOTA on RoboMimic. Quality filtering can favor brittle strategies.
  - *Stage:* Pitch.
  - *Caveats:* Needs rollouts.

**Evaluation methodology**

- **Bedi, "What Demonstration Curation Metrics Do to Your Policy."** arXiv 2606.10229 (2026-06-08).
  - *Finding:* "Five of the seven metrics … exploit episode length as a trivial proxy." The best detector (0.804 AUROC) produced the worst policy (13.3% success), while a 0.638-AUROC detector nearly matched the oracle (90.0% vs 93.3%).
  - *Stage:* Evaluation.
  - *Borrow:* A length-only baseline, and never equating detection with policy gain.
  - *Caveats:* Single author; simulation testbed.
- **Bedi, "Auditing Demonstration Curation Metrics: Action-Only Scorers Fail on the Structural Defects…"** arXiv 2606.05588 (2026-06-04).
  - *Finding:* Action-only metrics miss "wrong action at a key moment," and two even ranked defective Episodes higher. State-trajectory metrics detect them.
  - *Stage:* Compile.
  - *Borrow:* Prefer Criteria on end-effector or object state over action smoothness.
- **Bedi, "How Visible Are Silent Manipulation Failures?"** arXiv 2606.03134 (2026-06-02).
  - *Finding:* In simulated ALOHA, cube-transfer false successes are "almost fully recoverable from joint data alone," but peg insertion needs vision.
  - *Stage:* Compile (modality choice).
  - *Caveats:* The author says separability rests on velocity differences "below any realistic sensor noise floor," so it is an optimistic upper bound.
- **"No Free Checker: A Survey of Verifiers for Robot Policies."** Wan et al. arXiv 2609.09250 (2026-09-08).
  - *Finding:* About 150 verifiers surveyed; "credibility falls as availability rises"; proposes nine metrics for verifier claims.
  - *Stage:* Pitch framing.
  - *Borrow:* Winnow's pitch in one line: cheap checks where they're credible, humans where they're not.
- **DQAF.** Narayanan et al. (Siemens). arXiv 2605.26349 (2026-05-27).
  - *Finding:*
    - Telemetry (action saturation, LDLJ smoothness, gripper chatter, stalling) is fused with VLM subtask progress (Gemini Flash 1.5).
    - Thresholds come from "percentile-based threshold selection applied to the reference data."
    - Each evidence item records "the metric, observed value, threshold, status, time window, and aligned subtask."
    - It detected 24 of 28 failures (85.7%).
  - *Stage:* Score (Evidence), Calibrate.
  - *Borrow:* The evidence-item schema verbatim. Also percentile thresholds from labeled-good Episodes as the starting thresholds for calibration.
  - *Caveats:* Small validation set; no code.
- **MMPF.** Holk et al. arXiv 2608.07895 (RA-L).
  - *Finding:* Training-free detection of instruction–trajectory mismatches.
  - *Stage:* Pitch (droid_100's dropped instructions are this kind of defect).
- **IMBench.** Maurya et al. arXiv 2607.15641 (2026-07-17).
  - *Finding:* "Human annotators first score trajectories on a 1-5 scale … a VLM-based agent performs anomaly and consistency checks, and a final human review finalizes the decision."
  - *Stage:* Triage.
  - *Caveats:* Agent details UNVERIFIED.

**Dropped as not verifiable from a primary source:** claims that NVIDIA Cosmos Reason/Cosmos 3 is integrated into Encord for robot-data pre-labeling (only secondary snippets). NVIDIA's model page does say Cosmos Reason can "automate high-quality curation and annotation of massive, diverse training datasets," but gives no robot-Episode success evaluation details.

## 3. Recommendations

Ranked by value per hour this week.

1. **Rewrite plan §4 and the competition slide with the new gap wording and table above.** Name Shotwell and Roboto. Lead with fusion + calibrated abstention + false-success accuracy against Spark alone. *(roadmap/slides; do it today, it changes the pitch)*
2. **Add a length-only baseline and a directional-bias breakdown to the results.** Report balanced accuracy for length-only, Spark alone, and Winnow. Then report false Keep (failure kept) and false Reject separately. Both are small additions to the evaluation script. *(build this week)*
3. **Adopt DQAF's Evidence schema for every Criterion result:** metric, observed value, threshold, status (pass, fail, or unsure), time window, aligned subtask or frame. It maps directly onto the Episode detail view. *(build this week)*
4. **Make calibration two-way and show it.** A human label must be able to lower a Keep as well as raise a Reject. Show "threshold moved down after label" in the voice-labeling beat; this directly answers the audit's "corrections only raise scores" finding. *(build this week)*
5. **Crop Spark's visual Criteria to SAM 3.1 boxes**, citing FailBench's +2.3-point crop gain as outside evidence. This is already planned; the research supports doing it before any other visual-judging tweak. *(build this week)*
6. **Add an `observable_from` field (robot data, tracks, or video) and a sanity rule to compiled Criteria.** If a Criterion is visual-only and the task is contact-heavy, lower its confidence and send it to Needs review. *(build this week, small)*
7. **Camera-invariance check.** Run visual Criteria on both exterior cameras; if they disagree, the Triage decision is Needs review. *(build this week if the cost check passes; otherwise roadmap)*
8. **Critic pass before Reject** (RoboGaze-style): a second Spark call asked to refute the claimed failure at the cited timestamp. *(roadmap/slides; could become the Glimmer second-opinion role)*
9. **GVL-style progress curve as a soft Criterion** to localize *when* an Episode went wrong. *(roadmap/slides)*
10. **Predictive-validity experiment:** train a small policy on Winnow-kept vs all Episodes. This is the only way to claim better robots (CosmicBrain protocol; Bedi). *(roadmap/slides)*

## 4. Open questions worth a quick experiment

1. **Does episode length alone predict the labels?** On the ~100 evaluation Episodes, compute balanced accuracy of "longer than median → failure." If it's high, our pause and completion-time Criteria need length-controlled thresholds. (~15 min, no API cost.)
2. **Does Spark show FailBench's success bias?** On the feasibility set, Spark called episode 42 a failure even though the dataset labels it a success, which is the opposite direction. Measure P(Spark says success | true failure) vs P(Spark says failure | true success) on the full set before putting "AI judges lean success" on a slide.
3. **Does the SAM crop help Spark?** Judge 10–20 Episodes full-frame vs cropped to the union of gripper and object boxes. Compare accuracy and input tokens. FailBench saw +2.3 points with a different localizer.
4. **Camera invariance:** run the Spark judge on each exterior camera separately for the five feasibility Episodes. How often does the result flip?
5. **Shotwell check (15 min, no code):** read their docs or request a sample. Are rubrics customer-written English? Do they use telemetry? Do they report confidence? The answer decides how hard the pitch leans on "calibrated abstention" vs "plain English."
6. **Temporal-clip synthetic failures (RoboReward idea):** truncate 5 true-success Episodes before placement. Does Winnow's "object placed inside target" Criterion flip to fail, and does Spark alone? This gives a free labeled false-success test set.
7. **Episode-relative pause threshold:** does Voxel51's idle definition (speed below 0.05× the Episode's own moving speed) agree with the fixed 0.02 m/s rule in `docs/feasibility/rubric.json` on droid_100? If not, pick one before calibration.
