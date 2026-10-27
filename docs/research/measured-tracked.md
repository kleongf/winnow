# Research: measured and tracked Criteria

*Track: Criteria measured from robot data and tracked from SAM 3.1. Written 2026-10-27. Covers `backend/src/winnow/criteria/measured.py`, `backend/src/winnow/tracking/sam_output.py`, and `docs/feasibility/rubric.json`.*

Numbers labelled **[droid_100]** come from running throwaway scripts on the cached `lerobot/droid_100` parquet (100 Episodes, 15 Hz) and on the five cached SAM 3.1 box tracks in `data/feasibility/sam/`. They are measurements, not literature claims. They are not checked against human labels, so treat them as starting defaults.

---

## 1. Bottom line

1. **Make the code and the Rubric use the same thresholds, and keep the raw measurement.** Spark's compiled Rubric says "binarize gripper at 0.5", but `measured.py` uses 0.2. The Rubric says a pause is "<0.02 m/s for >2.0 s, 5-sample moving average", but the code uses 0.01 m/s for at least 1.0 s with no smoothing. On droid_100 the two gripper thresholds give different closure counts on **23 of 100 Episodes** [droid_100]. Every measured Criterion should return its raw value, the threshold it used, and the frames it used. The Criterion result can then quote the same number the Rubric shows, and "close to threshold" can route the Episode to Needs review. Today `longest_pause_s` returns 0.0 for any pause under 1 s, which throws away the near-threshold signal.
2. **Count failed grasp attempts, not closures.** `regrasp_count = closures − 1` (and the Rubric's "count == 1") penalises every multi-object task. Episode 84 has 12 closures and Episode 98 has 16, and both are labelled successes [droid_100]. It also double-counts gripper chatter: Episode 42 gets 4 closures because the gripper briefly loosens and re-squeezes during the final grasp. Use hysteresis (close above 0.3, open below 0.15, merge reopenings shorter than 0.27 s). Then call a closure a *failed attempt* when the end effector lifts less than about 2 cm before the gripper reopens. This is the "soft empty grasp" test from ProbeAct (arXiv 2606.09740). Use the Robotiq rule "fingers stopped short of the commanded position, so something is between them" as the proprioceptive contact signal.
3. **Treat smoothness and duration as soft, dataset-relative signals, and drop LDLJ.** Across droid_100, LDLJ has Spearman ρ = −0.98 with Episode duration [droid_100], so it is a duration proxy. A NeurIPS 2026 audit (Bassi) found that smoothness metrics on robomimic separate operators no better than episode length does, and that curating by them cost about a third of downstream success. If a smoothness Criterion is wanted, use SPARC on end-effector speed for each segment (approach, transport). Score soft Criteria with a robust z-score within a task group: median and MAD, flagged at 2.5 (Leys et al. 2013), or FiftyOne's bad-side semi-IQR (warn at 2, fail at 3). Never use fixed absolute cutoffs. Duration is a proficiency proxy only for successful Episodes: droid_100's failures are *shorter* (median 11.1 s against 16.5 s), because operators abort them early [droid_100].
4. **Add a tracking-health score and make it phase-aware.** SAM 3.1 tracks on droid_100's 320×180 video do fail in ways you can measure. On Episode 16 the small block (18–108 px² box) disappears for 67 of 173 frames, and confidence drops to 0.02. On Episode 42 confidence stays below 0.5 for 41 frames and box area swings 2.9× in one frame. On Episode 3 the track is clean (confidence ≥ 0.77, jumps ≤ 0.12 box diagonals) [droid_100]. Most of the loss happens **while the gripper is closed on the object**, which is occlusion in the hand. A tracked Criterion should report *unsure*, not *fail*, when the track is unhealthy in its window. While the gripper is closed and blocked, the gripper signal should carry the "still held" judgement.
5. **Design for the quality-versus-diversity trap.** CUPID (arXiv 2506.19121) shows that quality-style scores penalised the higher-variance pick-and-place strategy and pushed the policy toward a brittle sliding strategy. Demo-SCORE (arXiv 2503.03707) warns that filtering can shrink state coverage. Default re-grasp and smoothness Criteria to *soft*. Extend the Rubric sanity monitor to report what a Criterion removes (for example, "rejects 80% of Episodes from scene X"), not only how much it removes. Successful recoveries, such as a re-grasp that then works, may be valuable training data, so whether to penalise them should be the user's choice in English, not Winnow's default.

---

## 2. Sources

Every source below was opened. Exact claims are quoted where the claim carries weight. **UNVERIFIED** marks anything I couldn't confirm in the primary text.

### Operator quality and curation in imitation learning

**S1. robomimic: Mandlekar et al., "What Matters in Learning from Offline Human Demonstrations for Robot Manipulation", arXiv [2108.03298](https://arxiv.org/abs/2108.03298); dataset docs: https://robomimic.github.io/docs/datasets/robomimic_v0.1.html**
- *Finding:* The multi-human (MH) datasets have 300 successful trajectories from 6 operators: "2 'worse' operators, 2 'okay' operators, and 2 'better' operators" (docs). The groups are defined by operator experience, not by a metric. The paper says "the length is a proxy for the quality of the dataset – less proficient humans took more time to demonstrate the task". It reports that BC shows "a large performance gap between the Better and Worse 100-demo subsets (roughly 27% and 35% for Can and Square respectively)".
- *Stage:* Measured Criteria (completion time); calibration.
- *Borrow:* Duration is the field's standard proficiency proxy. robomimic MH is a ready-labelled operator-quality benchmark if Winnow ever needs one.
- *Caveats:* All MH Episodes are *successes* in simulation. Length is a proxy only conditional on success. In droid_100, failures are shorter. I didn't find a per-group length table in the docs (UNVERIFIED which tasks have which mean lengths).

**S2. Demo-SCORE, arXiv [2503.03707](https://arxiv.org/abs/2503.03707) (HTML: https://arxiv.org/html/2503.03707)**
- *Finding:* Trains a classifier on successful versus failed *policy rollouts*, then filters the demonstrations with it. Reports "15-35% higher absolute success rate". Stated limitations include that it "may not be effective in settings where the demonstrations are all so low quality … that the initial policy is unable to successfully complete the task at all" and that it "may reduce the coverage of states". The paper includes no heuristic (length or smoothness) baseline.
- *Stage:* Positioning (plan §4); quality-versus-diversity caveat.
- *Borrow:* The coverage warning becomes a "what did you remove" panel in the sanity monitor.
- *Caveats:* Needs a trained policy and rollouts, so it isn't comparable to Winnow's pre-training filtering.

**S3. CUPID, arXiv [2506.19121](https://arxiv.org/abs/2506.19121) (HTML: https://arxiv.org/html/2506.19121), CoRL 2025**
- *Finding:* Curates with influence functions on policy return. In §6.2 (TuckBox), "DemInf and Cupid-Quality incorrectly associate the higher-variance pick-and-place demonstrations with lower quality, resulting in more uniform filtering across strategies", and the resulting policies favour a brittle sliding strategy under distribution shift. In §6.1, Cupid matches or beats DemInf even though DemInf curates "datasets of the highest overall quality". Abstract: "training with less than 33% of curated data can yield state-of-the-art diffusion policies on the simulated RoboMimic benchmark".
- *Stage:* Rubric design (hard versus soft); sanity monitor; slides.
- *Borrow:* The slide line "high quality is not the same as good for the robot". Variance-penalising scores (smoothness, consistency) should stay soft.
- *Caveats:* Needs a policy and rollouts. The brittle-strategy result is from one hardware task.

**S4. DemInf: Hejna et al., "Robot Data Curation with Mutual Information Estimators", arXiv [2502.08623](https://arxiv.org/abs/2502.08623)**
- *Finding:* Scores each Episode by its contribution to the state–action mutual information, using k-NN (KSG) on VAE embeddings. Quality means "action diversity and predictability". No rollouts are needed. Reports a "5-10% improvement in RoboMimic" plus real ALOHA and Franka gains.
- *Stage:* Roadmap (a rollout-free, learned quality score).
- *Borrow:* Its framing: a good operator is *predictable given the state*, which matches "consistent strategy" Criteria a user could write.
- *Caveats:* CUPID (S3) shows it can penalise legitimate high-variance strategies. It needs embeddings and a VAE, so it's out of scope this week.

**S5. DataMIL, arXiv [2505.09603](https://arxiv.org/abs/2505.09603), ICLR 2026**
- *Finding:* Datamodels-based selection with "a surrogate loss function on task-specific data". It contrasts itself with filtering "using human notions of quality (e.g., based on semantic or visual similarity)".
- *Stage:* Positioning and slides only.
- *Borrow:* Nothing to build. It's a useful foil: Winnow is the *human-notion* filter, made explicit and editable.
- *Caveats:* Needs policy training.

**S6. QoQ: Lee et al., "Quality over Quantity: Demonstration Curation via Influence Functions for Data-Centric Robot Learning", arXiv [2603.09056](https://arxiv.org/abs/2603.09056), ICRA 2026**
- *Finding:* Influence of each sample on validation-demonstration loss, max-aggregated over validation samples and aggregated within trajectories.
- *Stage:* Positioning only.
- *Caveats:* The abstract doesn't state the numbers (UNVERIFIED magnitudes).

**S7. Sakr et al., "Consistency Matters: Defining Demonstration Data Quality Metrics in Robot Learning from Demonstration", arXiv [2412.14309](https://arxiv.org/html/2412.14309v2)**
- *Finding:* Defines 10 metrics, including Cartesian path length Σ‖xₜ−xₜ₋₁‖², Cartesian jerk Σ x⃛ₜ², curvature, and manipulability. Reports "pathlength, jerk, and consistency exhibit the highest correlations with task success rate", and that the metric *ranges* "collectively predict 70.2% and 88.6% of the task success rate".
- *Stage:* Measured Criteria (path length, consistency across Episodes).
- *Borrow:* Measure *consistency across Episodes* (spread of a metric within a task), not just per-Episode values. That is the basis for the dataset-relative robust z.
- *Caveats:* Small user studies in kinesthetic learning from demonstration, not teleoperation at DROID scale.

**S8. Sojib, Arthanat, Begum, "An Efficient Metric for Data Quality Measurement in Imitation Learning", arXiv [2605.01544](https://arxiv.org/abs/2605.01544)**
- *Finding:* Ranks demonstrations by power spectral density: "Lower PSD values correspond to smoother, higher-quality demonstrations". Needs "no policy learning, environment interaction, or expert labeling".
- *Stage:* Measured Criteria (smoothness alternative).
- *Caveats:* The abstract gives no numbers (UNVERIFIED effect size). S9 below argues that smoothness may just track length.

**S9. Bassi, "Curation Metrics Are a Post-Training Decision: Auditing Trajectory Smoothness for Adapting Robot Foundation Models", NeurIPS 2026, https://neurips.cc/virtual/2026/162882 (OpenReview wj9Kj3hsJs; no arXiv ID found)**
- *Finding:* On robomimic can/mh, "SAL separates better from worse operators with AUROC 0.952, but episode length alone achieves 0.957". Controlling for duration, "SAL falls to 0.628 while raw mean jerk … rises to 0.896". On fixed-length tasks "SAL is at chance (0.454)". Curating with TED "costs roughly a third of downstream success relative to random selection (0.240 vs 0.360)". It also argues that smoothness metrics discard the corrective demonstrations that fine-tuning needs.
- *Stage:* Measured Criteria (smoothness), Rubric defaults, slides.
- *Borrow:* Always report duration next to smoothness, and test any smoothness Criterion against "just duration". Our droid_100 check (LDLJ ρ = −0.98 with duration) agrees.
- *Caveats:* Read from the NeurIPS virtual page only. OpenReview was blocked by a bot check, so the full paper is UNVERIFIED.

**S10. Voxel51 / FiftyOne, "Robot episode quality triage", https://voxel51.com/blog/robot-episode-quality-triage, and "Motion smoothness ≠ task success", https://voxel51.com/blog/motion-smoothness-task-success-robolab-egox**
- *Finding:* Metrics are SPARC (fc 10 Hz, amplitude 0.05), LDLJ ("only comparable across equal-length windows"; "halving a window's span adds about 2.8"), RMS jerk after a 4th-order Butterworth low-pass, PSD ratio, and idle fraction. Idle fraction is the "share of samples whose low-passed speed sits below idle_alpha (0.05 default) times the episode's own moving speed", and it "never enters overall_score … it's a flag, not a verdict". Scores use a robust z with a *semi-IQR on the bad side*, because two-sided MAD "put 33% of all windows past fail threshold". The thresholds are "0 is typical for this batch; ≥2 is warn threshold, ≥3 is fail", worst-of across signals. The second post found a failed Episode ranked 8th-smoothest of 127, and concludes that "motion smoothness does not predict task success" individually, although batch medians differ (0.17 success against 0.38 failure).
- *Stage:* Measured Criteria, thresholding, Needs review.
- *Borrow:* The bad-side semi-IQR robust z, warn at 2 and fail at 3, worst-of aggregation, idle relative to the Episode's own moving speed, and the "triage not gate" stance (soft Criteria route to review, they don't reject).
- *Caveats:* Vendor blog posts, not peer-reviewed. Their ABC-130k reference values (SPARC median −2.92, LDLJ median −14.61) come from a different robot and rate, so don't reuse them as absolute thresholds.

### Smoothness metrics (motor control)

**S11. Balasubramanian, Melendez-Calderon, Roby-Brami, Burdet, "On the analysis of movement smoothness", J NeuroEng Rehabil 12:112 (2015), https://pmc.ncbi.nlm.nih.gov/articles/PMC4674971/; reference code: https://github.com/siva82kb/SPARC (`scripts/smoothness.py`)**
- *Finding:* SPARC is the negative arc length of the normalised magnitude spectrum of the *speed* profile, with an adaptive cutoff ω_c = min(ω_c,max, the highest frequency where the normalised magnitude is still at or above V̄). "With the LDLJ, even signals with SNR = 100 can severely distort smoothness estimates, while the SPARC appears to be relatively immune up to SNR = 10". The authors "recommend the use of SPARC over LDLJ". Reference code defaults: `sparc(movement, fs, padlevel=4, fc=10.0, amp_th=0.05)`. LDLJ is `-ln(T³/v_peak² · Σ(d²v/dt²)² · dt)` on speed.
- *Stage:* Measured Criteria (smoothness).
- *Borrow:* The formulas and defaults below. Use speed, not position derivatives.
- *Caveats:* Designed for single point-to-point reaches. A whole pick-and-place Episode has many submovements, so compute SPARC per segment. The reference code builds `f = arange(0, fs)`, so at 15 Hz a 10 Hz cutoff would include mirrored frequencies above Nyquist (7.5 Hz). Cap fc at about 6 Hz. On droid_100 this made no difference, because the 0.05 amplitude cutoff binds first [droid_100].

### Idle time and pauses in DROID

**S12. openpi DROID training recipe, README: https://huggingface.co/s3y/openpi/blob/main/examples/droid/README_train.md; script: https://raw.githubusercontent.com/Physical-Intelligence/openpi/main/examples/droid/compute_droid_nonidle_ranges.py**
- *Finding:* DROID "contains many idle timesteps in which the robot does not move (in part due to the VR teleoperation interface)", and filtering them "significantly" helps. The script marks a step idle when `np.all(np.abs(joint_velocities[1:] - joint_velocities[:-1]) < 1e-3, axis=1)`, with `min_idle_len = 7`, `min_non_idle_len = 16` and `filter_last_n_in_ranges = 10`.
- *Stage:* Measured Criteria (pauses, idle fraction).
- *Borrow:* At DROID's 15 Hz, a practitioner-tested idle stretch is **7 frames (≈0.47 s)** of unchanged commanded action. That separates *operator idle* (the teleoperator clutched or reset the controller) from *slow motion*, which a speed threshold can't do.
- *Caveats:* Built for training-sample filtering, not Episode rejection. droid_100's `action` columns aren't documented, and my reading of them as velocities plus a gripper command is UNVERIFIED (see Q3).

**S13. DROID: Khazatsky et al., arXiv [2403.12945](https://arxiv.org/html/2403.12945v2); schema: https://droid-dataset.github.io/droid/the-droid-dataset**
- *Finding:* Franka Panda with "a Robotiq 2F-85 gripper". The Quest 2 controllers drive "the gripper in continuous space". Data is "recorded … at 15Hz". "Roughly 16k trajectories … labeled as 'not successful'" are kept. The schema describes the RLDS `action` as "[6x joint velocities, 1x gripper position]".
- *Stage:* Episode loading, gripper interpretation.
- *Borrow:* The gripper is *analog* (a trigger), so closure peaks vary by operator and object. Fixed binarisation at 0.5 misses weak grasp attempts. Episode 42's first attempt peaks at 0.44 [droid_100].
- *Caveats:* In droid_100's LeRobot parquet, `action[6]` behaves like *1 − commanded closure* (1.0 while open) [droid_100]. That is inverted relative to `observation.state[6]`, and UNVERIFIED against any documentation.

### Grasp, contact, drop and release from proprioception plus tracks

**S14. Robotiq, "How object detection works on Robotiq grippers", https://blog.robotiq.com/knowledge/how-object-detection-works-on-robotiq-grippers**
- *Finding:* "If the gripper cannot complete its full motion due to contact … an object is detected". The gOBJ register reports 0x01 "object detected while closing (before reaching requested position)" and 0x03 "no object detected (gripper completed full motion)".
- *Stage:* Measured and tracked Criteria (contact, empty grasp); disagreement signal.
- *Borrow:* **Contact = achieved closure plateaus clearly below the commanded closure.** Empty or very thin grasp = achieved closure ≈ commanded ≈ 1. On droid_100 the held closures show achieved − commanded ≈ −0.1 to −0.25: Episode 16 holds at 0.67 against a 0.92 command, Episode 49 at 0.50 against 0.75. Episode 3 (a thin chip bag) reaches 0.99 against 1.0 [droid_100]. A full closure alone is therefore *ambiguous*, which makes it a good Needs review trigger when SAM also shows nothing in the gripper.
- *Caveats:* DROID doesn't record gOBJ. The command and state are lagged by a few frames, so compare plateaus in the middle of a closure, not single frames.

**S15. ProbeAct, arXiv [2606.09740](https://arxiv.org/html/2606.09740)**
- *Finding:* Object-agnostic failure tests from gripper width, end-effector pose and tracked object position. A "hard empty grasp" is when gripper width reaches its limit. A "soft empty grasp" is "significant upward displacement (Δz_e > τ_lift)" while "the target object remains stationary (Δz_obj ≤ τ_noise)". A "mid-transport drop" is when "the gripper width suddenly snaps to its mechanical limit … while the end-effector is actively in motion".
- *Stage:* Measured Criteria (failed attempts, drops); tracked Criteria (object lifted with the gripper).
- *Borrow:* All three rules translate directly to DROID's closure fraction. A snap means closure jumps toward 1.0 while the command is steady. On droid_100 a crude snap detector fires on 3 of 100 Episodes (50, 62, 90). I haven't checked those against video.
- *Caveats:* Numeric τ values weren't in the text I read (UNVERIFIED). Their setting is policy rollouts, not teleoperation.

**S16. KITE: Hosseinzadeh, Wong, Dayoub, arXiv [2604.07034](https://arxiv.org/abs/2604.07034)**
- *Finding:* Converts robot videos into keyframes plus layout tokens for VLM failure analysis, with gains on RoboFAC. A secondary search summary says it computes a contact-transition token from gripper–object nearest-centre distance and box IoU when both are detected with high confidence. That detail is **UNVERIFIED**, because the abstract page didn't show it.
- *Stage:* Visual Criteria (steering Spark with track-derived tokens).
- *Borrow:* Feed Spark the *track-derived events* (closure times, contact intervals, lift) as text alongside the frames.
- *Caveats:* Training-free VLM pipeline. The contact-token thresholds are unverified.

### SAM tracking failure modes

**S17. SAM 2: Ravi et al., arXiv [2408.00714](https://arxiv.org/html/2408.00714)**
- *Finding:* Limitations: "may fail to segment objects across shot changes and can lose track of or confuse objects in crowded scenes, after long occlusions or in extended videos". It struggles with "very thin or fine details especially when they are fast-moving" and with "nearby objects with similar appearance". An occlusion head predicts "the likelihood of the object of interest being visible in the current frame".
- *Stage:* Tracking health.
- *Borrow:* Expected failure cases for Winnow: small objects at 320×180, a gripper occluding the object, and similar distractors on a cluttered table. A low score can mean the object is *occluded*, not that tracking failed, so read it together with the gripper phase.

**S18. SAM 3: "SAM 3: Segment Anything with Concepts", arXiv [2511.16719](https://arxiv.org/html/2511.16719v1), ICLR 2026**
- *Finding:* A detector plus a SAM 2-style tracker. The presence head predicts "p(NP is present in input)", and the final score is "the product of its own score and the presence score". The masklet detection score measures "how consistently a masklet is matched to a detection within a temporal window", and "if a masklet's detection score falls below a threshold, we suppress it". It also periodically re-prompts the tracker "with high-confidence detection masks". The paper notes it "struggles to generalize to out-of-domain terms".
- *Stage:* Tracking health; prompt design.
- *Borrow:* The confidence in SAM 3.1's stream is presence-weighted, so a drop in the stream means "the concept may be absent or occluded". Use the same idea as masklet suppression: a track that stops agreeing with fresh detections is suspect. Prefer generic noun phrases ("black remote") over task jargon.
- *Caveats:* Thresholds and window sizes aren't stated. SAM 3.1 on the Meta API may differ from the paper. The full limitations appendix (§B) was truncated in my fetch (UNVERIFIED).

**S19. SAMURAI, arXiv [2411.11922](https://arxiv.org/html/2411.11922); SAM2Long, arXiv [2410.16268](https://arxiv.org/abs/2410.16268)**
- *Finding:* SAMURAI says "SAM 2 often neglects motion cues … leading to inaccuracies in scenarios with rapid object movement", and that storing recent frames "introduces irrelevant features during occlusions". It fixes this with Kalman-filter box prediction and KF-IoU-weighted mask selection (α_kf = 0.15). SAM2Long: "an errored or missed mask will cascade and influence the segmentation of the subsequent frames".
- *Stage:* Tracking health.
- *Borrow:* **A box jump that a constant-velocity model can't explain is the cheapest drift detector.** Once the tracker latches onto a distractor it stays wrong, so mark *everything after* the first big jump as unsure, not just the jump frame.
- *Caveats:* Both are tracker modifications. Winnow can only post-process SAM's output.

### Robust thresholding

**S20. Leys et al. (2013), "Detecting outliers: Do not use standard deviation around the mean, use absolute deviation around the median", J. Exp. Soc. Psych. 49(4):764–766. Opened via a secondary source that quotes it: https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2021.819854/full**
- *Finding:* "Leys et al. (2013) recommend a criterion of 2.5 as the value k". The constant is b = 1.4826 under normality.
- *Stage:* Soft-Criterion scoring; Needs review margin.
- *Borrow:* robust_z = (x − median) / (1.4826 · MAD), with 2.5 as the default outlier line. For skewed, one-sided metrics, prefer FiftyOne's bad-side semi-IQR (S10).
- *Caveats:* I didn't open the original paper itself. The quote comes via the Frontiers article.

---

## 3. Recommendations

### 3.1 Audit of what `measured.py` computes today

| Function | Today | Problem | Evidence [droid_100] | Fix |
|---|---|---|---|---|
| `closures` | `gripper > 0.2`, no hysteresis | Disagrees with the compiled Rubric's 0.5. Chatter splits one grasp in two. | 23/100 Episodes change closure count between 0.2 and 0.5. Episode 42 gets 4 closures at 0.2, 3 at 0.5, and 3 with hysteresis plus merging. Episode 50 gets 7 at 0.2 and 11 at 0.5. | Hysteresis: close above 0.3, open below 0.15, merge reopenings shorter than 4 frames. Keep 0.3 because the trigger is analog and weak attempts peak at about 0.35–0.45 (Episodes 42 and 25). |
| `regrasp_count` | closures − 1 | Counts every legitimate grasp in multi-object tasks. Counts chatter. | Episode 84 has 12 closures, 98 has 16, 24 has 6, and all are successes. | `failed_attempts` = closures with lift < 2 cm before reopen (S15), plus optional SAM confirmation that the object didn't move. Report "attempts before first held grasp". |
| `release_height_m` | z at reopen − z at final grasp start | It's relative to the *pick* height, so it is legitimately positive when the target is higher. Only the final closure counts. The release frame is when the state falls below 0.2, after the object may already be loose. | Episode 42 gives +0.10 m (matches the known drop). Episode 3 gives −0.09 m. | Keep it as Evidence. Use release onset = the first frame of the final opening where commanded closure drops. Pair it with SAM: object centre falls after release (tracked). |
| `longest_pause_s` | raw speed < 0.01 m/s, returns 0 if < 1 s | Differs from the Rubric's 0.02 m/s, >2 s, smoothed. Throws away sub-threshold values. Counts the legitimate stillness of a grasp or release. Translation only. | 25/99 Episodes ≥ 1 s under the code's definition, 20/99 > 2 s under the Rubric's. Max 2.2 s. Rotation-aware stillness changes only 2 Episodes. | Always return the raw seconds plus the interval. Exclude frames where the gripper is moving (closing or opening). Use the same parameters the Rubric text shows. |
| `EpisodeSignals.duration_s` | t[−1] − t[0] | Off by one frame (1/15 s). | Episode 3: 13.60 s against 13.67 s. | n / fps, or add 1/fps. |
| *(missing)* | completion time, smoothness, path efficiency, idle fraction, tracking health | — | — | See 3.2. |

### 3.2 Formulas and starting defaults

All defaults are untested against human labels. They are where calibration (plan §5.5) should start. *Hard* Criteria use absolute physical thresholds. *Soft* Criteria use dataset-relative robust z within a task group (same `task_index` or same Rubric run).

| Signal | Formula | Default | Source |
|---|---|---|---|
| Closure interval | Hysteresis on `state[6]`: enter above 0.3, exit below 0.15, merge gaps shorter than 4 frames | — | [droid_100], S13 |
| Contact (held object) | median(commanded closure) − median(achieved closure) over the middle half of the closure > 0.08, *and* achieved < 0.95 | Gap 0.08 | S14 [droid_100]; command semantics UNVERIFIED |
| Empty or thin full close | achieved closure ≥ 0.95 | → *unsure* unless SAM confirms the object in the gripper | S14, S15 |
| Failed grasp attempt | Closure whose max(z) − z(start) < 0.02 m before reopen, and that is followed by another closure | 2 cm | S15 [droid_100] |
| Slip or drop (proprio) | Within a held closure, achieved closure rises > 0.15 within 5 frames to > 0.9 while the command changes < 0.05 | — | S15 (3/100 hits, unverified) |
| Pause | Speed from a 5-sample centred moving average < 0.01 m/s, gripper not moving, run ≥ 1.0 s | 1.0 s; report the raw value | S12, plan §5 |
| Operator idle (teleop) | All `action[0:6]` change < 1e-3 per step, run ≥ 7 frames | 7 frames ≈ 0.47 s | S12 |
| Idle fraction | Fraction of frames whose smoothed speed < 0.05 × median moving speed | Soft; robust z | S10 |
| Smoothness | SPARC(speed, fs = 15, fc = min(10, 0.8 · fs/2) = 6 Hz, amp 0.05, pad 4) **per segment** (start → first held closure; closure → release) | Soft; robust z ≥ 2 warn | S11, S10 |
| (avoid) LDLJ | −ln(T³/v_peak² · ∫(d²v/dt²)² dt) | Don't use across Episodes. ρ = −0.98 with duration. | S9, S10, S11 |
| Approach path efficiency | ‖p(first held closure) − p(0)‖ / Σ‖Δp‖ over the same span | Soft; robust z | S7 |
| (avoid) Whole-Episode efficiency | ‖p(end) − p(0)‖ / path length | Meaningless when the arm returns home (droid_100 range 0.01–0.99) | [droid_100] |
| Completion time | n / fps, *only for Episodes that pass the task Criteria* | Soft; robust z within task | S1, S9 |
| Robust z | (x − median) / (1.4826 · MAD); or (x − median) / (Q₇₅ − median) on the bad side | Warn ≥ 2, flag ≥ 2.5–3 | S20, S10 |
| Near-threshold → unsure | Hard Criterion within ±15% of its threshold (or within 0.5 robust z) | 15% | plan §5.4 |

### 3.3 Tracking-health signal (feeds Needs review)

Score each frame in a tracked Criterion's window (for example "from first held closure to release"):

- **present:** SAM returned a box for the concept, and exactly one object id.
- **confident:** confidence ≥ 0.5.
- **steady:** centre jump ≤ 0.5 × median box diagonal, and |Δ log area| ≤ 0.4 (≤ 1.5× area change).
- **resolvable:** median box area ≥ 100 px² at 320×180 (Episode 16's block is 18–108 px²).

`track_health = fraction of window frames that are present, confident and steady`. Mark everything after the first failed `steady` frame as suspect (S19). Then:

- **Health ≥ 0.8:** the tracked Criterion result stands.
- **Health < 0.8 while the gripper holds a blocked closure (contact rule above):** the Criterion result is *unsure*, and the Evidence says "object hidden in gripper from t1 to t2; gripper signal says still held". This is Episode 16: object missing from frame 95 to 161, inside the closure from frame 68 to 155.
- **Health < 0.8 otherwise:** *unsure* with "SAM lost tracking" (plan §5.4). The bad interval is drawn on the timeline.
- **Disagreement:** gripper says blocked closure but the object box doesn't move with the gripper, or the gripper says empty full close but the object rises with the gripper. Both go to Needs review.

Cached-track calibration [droid_100]: Episode 3 (clean) has present 100%, confidence ≥ 0.77, max jump 0.12, max |Δlog area| 0.20. Episode 42 has present 100%, but 41 frames have confidence < 0.5 and 6 frames change area by more than 1.5×, mostly from frame 220 to 250, inside its final grasp. Episode 16 has present 61%, minimum confidence 0.02, and one jump of 0.58.

### 3.4 Ranked recommendations

1. **Single source of truth for parameters (build this week).** Each measured Criterion takes its parameters from the compiled Criterion's structured fields, not from constants or from the English `check` text. It returns `{value, threshold, frames, unit}`. This fixes the 0.2/0.5 and 1 s/2 s mismatches and enables "near threshold → unsure".
2. **Hysteresis closures plus failed-attempt counting (build this week).** Replace `regrasp_count` with `failed_attempts` (lift < 2 cm) and `held_grasps`. Unit-test it on Episodes 42, 84, 98 and 3. Expected: 42 has failed attempts ≥ 1, 84 and 98 have many held grasps, 3 has 0 failed attempts.
3. **Tracking-health score in `tracking/` (build this week).** Implement §3.3 on `TrackedBox` lists. Wire "SAM lost tracking" and the gripper/track disagreement into Needs review. It's cheap (no API calls) and it makes the triage logic on the Episode detail view look credible.
4. **Contact from commanded versus achieved closure (build this week, after Q3).** This is the robot-data side of the plan's "gripper closed on something but SAM shows nothing" disagreement signal.
5. **Pause fix (build this week).** Smooth the speed, exclude gripper-moving frames, return raw seconds, and use the Rubric's numbers.
6. **Robust-z scoring for soft Criteria (build this week).** Within a Rubric run, use median/MAD or bad-side semi-IQR (S10, S20) for completion time, idle fraction and approach efficiency.
7. **Per-segment SPARC as an optional soft Criterion (roadmap/slides).** Only add it if a user's description asks for "smooth". Show it beside duration and say, citing S9, that smoothness mostly tracks length.
8. **"What did this Criterion remove" panel in the sanity monitor (roadmap/slides).** Break down rejections by task and scene. This is the CUPID and Demo-SCORE diversity caveat (S2, S3) as a feature.
9. **Slip/drop snap detector (roadmap/slides)** until the 3 hits are confirmed on video.
10. **Re-detection cross-check (roadmap/slides).** Re-run concept detection on a few keyframes and compare IoU with the tracked box, the way SAM 3 suppresses masklets (S18). Costs extra SAM calls.

---

## 4. Open questions worth a quick experiment

1. **Do failed attempts match what the video shows?** Watch the 21 Episodes with at least one no-lift closure [droid_100]. Several single-closure ones (10, 20, 31, 63, 70, 74, 95) are probably non-lifting tasks (push, slide, open), which would make the lift test task-dependent. Should the Rubric compiler emit lift-based Criteria only for pick-and-place descriptions? About 30 minutes with the cached clips.
2. **Is Episode 42 three failed attempts or two?** Hysteresis merges the 0.23 dip around frames 226–230 into the final grasp. Check the wrist video to choose the merge window: 4 frames, or longer.
3. **What exactly is droid_100's `action`?** Is `action[6]` equal to 1 − commanded closure, and are `action[0:6]` cartesian velocities? DROID's RLDS schema says joint velocities. Compare with the LeRobot conversion script. The contact rule and the openpi-style idle rule both depend on the answer.
4. **Where do pauses happen?** For the 25 Episodes with a pause of at least 1 s, measure how much of each pause overlaps gripper motion (a legitimate stop) and how much falls mid-reach (hesitation). That decides whether excluding gripper-moving frames is enough.
5. **What is the health-score threshold, and how often does it fire?** Run SAM 3.1 on about 20 pick-and-place Episodes (about $0.20 per 1,000 frames, so pennies). Compute track health and see what fraction would go to Needs review. If more than 30% go there, 0.8 is too strict for 320×180 video, or the object prompt needs a box rather than text.
6. **Does a gripper track help?** The text-prompted "robot gripper" call for Episode 42 returned an empty file, while the box-prompted gripper track on Episode 3 was clean. Is a box-prompted gripper track (from frame-0 box) reliable enough for gripper–object distance? Or should the tracked "no drop" Criterion use the object track plus proprioception (S15's soft-empty-grasp test) instead?
7. **Does smoothness add anything beyond duration on DROID?** Partial-correlate per-segment SPARC with success after controlling for duration on droid_1.0.1, which has explicit success flags. If the partial correlation is near 0, drop smoothness from the default Rubric suggestions and use the result as a slide.
