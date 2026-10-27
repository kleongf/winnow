# VLM judging of robot video (Spark's visual Criteria)

Research for how Winnow should ask Muse Spark to judge visual Criteria on Episode video. Written 2026-10-27, building on the Day-1 feasibility test (`docs/feasibility/probes/judge_probe.py`, `docs/feasibility/spark_judge.json`).

**What the probe does today:** one holistic question ("Did the robot complete the task successfully? If not, give the time in seconds when it failed"). It sends three full uncropped videos (exterior 1, exterior 2, wrist) and uses a binary `{success, failure_time_s, reason}` schema with no way to answer "unsure". Spark judged all 5 Episodes in line with their true outcomes, including Episode 42, which is mislabeled as a success. It did this on both contributor/high and standard/max.

**Our own numbers from that run:** each Episode used about 71–75 input tokens per camera-second, prompt included (for example, Episode 42 used 4,952 tokens for 3 × 22 s). Output and reasoning tokens (842–4,292) made up about 50–80% of the cost on the contributor tier, which came to $0.0005–0.0011 per Episode. Video input tokens are therefore *not* the cost driver at droid_100's 320×180 resolution; reasoning tokens are. That low token count also suggests Spark sees few, small frames, so the reason to trim video is attention and resolution, not money. This is our inference, and Spark's frame sampling is undocumented; see Open questions.

---

## 1. Bottom line

1. **Ask one question per visual Criterion, make "unsure" a valid answer, and ask for evidence before the answer.** The best general VLMs still lean toward "success" under ambiguity: they "name the thing [they are] unsure about, and then score success anyway" (FailBench). A binary schema forces that lean into a pass. Two kinds of work support splitting the question: per-subgoal verification (REFLECT, AHA) and checklist-style evaluation (TICK). An `unsure` Criterion result maps directly onto Needs review.
2. **Crop the fixed exterior cameras to a SAM 3.1 box around the region that decides the outcome, and send the wrist camera whole.** This is the one input-level fix with a measured gain on DROID-platform data: FailBench's localize-and-crop step lifted its best detector from 0.740 to 0.810 balanced accuracy on RoboArena (DROID robots). It worked best where the workspace is wide and the key objects are small, which describes droid_100 at 320×180. FailBench used a VLM to find the box; Winnow already has SAM tracks for it.
3. **Don't raise reasoning effort to fix the success bias. Change the input or get a second opinion instead.** FailBench reports that more reasoning does not remove the bias and that wrong answers come with *longer* reasoning traces. Separately, longer multimodal reasoning chains reduce attention to visual input ("More Thinking, Less Seeing?"). Reasoning tokens are already Winnow's main cost. Escalation should mean a cropped view, keyframes, or Glimmer, not `max` effort.
4. **Anchor timestamps in the pixels and in robot data.** Burn the time or frame number into each frame (NumPro-style), and send keyframes chosen from robot data (gripper close/open edges, pauses, the last frame) as labeled stills. Spark's `failure_time_s` is then a time it read off the frame rather than one it guessed, and it can be checked against the measured gripper events.
5. **Get uncertainty from disagreement, not from a self-reported number.** Verbalized confidence clusters at 80–100% and is a weak failure predictor (AUROC about 0.52–0.61; Xiong et al.). Better signals are an explicit `unsure` answer, disagreement across 2–3 cheap samples or two framings of the question, and conflict with the measured or tracked Criteria.

---

## 2. Sources

Every source below was opened. Numbers are quoted from the paper's abstract or HTML. "UNVERIFIED" marks claims I could not confirm in the primary text.

### FailBench: How Reliable are VLMs at Judging Robot Task Success? (Navasardyan, Danielyan, Davtyan, 2026)
- **URL:** https://arxiv.org/abs/2609.03611 (HTML: https://arxiv.org/html/2609.03611)
- **Finding:** 13 detectors on 2,197 attempts from 14 sources. The best is Gemini 3 Flash at 0.77 mean balanced accuracy, with 0.40 failure recall on the failure-only REFLECT subset. RoboArena (DROID robots) scores 0.72 in the main table. Contact-heavy assembly stays below 0.60. Detectors fine-tuned for failure detection underperform general VLMs and their own base models. The paper reports a "systematic bias toward predicting success under ambiguous evidence" and adds that "increasing reasoning effort does not alleviate this bias, as incorrect predictions tend to receive longer reasoning traces" (Gemma-4-31B wrong answers averaged 1,868 characters of reasoning, correct ones 1,464). The quote "Failure is treated as what must be proven" comes from manual trace analysis of one model and is not quantified as a rate.
- **The crop step:** a localizer "sees four frames spanning the episode and the task sentence, and returns one rectangle around the region that settles whether the attempt worked". Then "fixed cameras are cropped to that box; wrist and other moving cameras are sent whole." The macro average rose from 0.773 to 0.797 (+2.4 points), RoboArena from 0.740 to 0.810, and simplerenv by up to 11 points because its workspace is wide and its objects small.
- **Input protocol:** native video where the model supports it, otherwise 32 evenly spaced frames. The paper has no frame-count, multi-view, or prompt ablation.
- **Winnow stage:** visual Criteria (input design), Triage decision (bias), escalation policy.
- **Borrow:** crop the fixed cameras and leave the wrist camera whole; treat ambiguity as "unsure", never as a pass; don't count on effort to fix bias.
- **Caveats:** the bias is described qualitatively, so there is no success-rate-on-failures number to cite. The RoboArena 0.72 and 0.740 figures come from different tables or runs. The crop gain was measured with a VLM localizer, not SAM.

### REFLECT: Summarizing Robot Experiences for Failure Explanation and Correction (Liu, Bahety, Song, CoRL 2023)
- **URL:** https://arxiv.org/abs/2306.15724
- **Finding:** it builds a hierarchical summary and then runs *progressive* failure explanation. For each subgoal it asks "Is the subgoal satisfied?" against the observation at that subgoal's end frame, and only then retrieves detail to explain a failure. A frame becomes a keyframe if its scene graph changed, an audio event started or ended, or a subgoal ended. Real-world results (Table 2) on execution failures: REFLECT reaches 68.8 explanation and 93.8 localization accuracy, against 43.8 and 81.3 without progressive verification and 6.25 and 25.0 for BLIP-2 captions.
- **Winnow stage:** the per-Criterion prompt structure, failure localization, and keyframe choice.
- **Borrow:** verify each Criterion at the frame where it should hold, and explain only after a fail. Pick keyframes from *events*, and Winnow's robot data supplies gripper edges and pauses for free.
- **Caveats:** this is an LLM reading scene-graph text built by detectors (GPT-4 plus MDETR and CLIP), not a VLM watching video. The real-world set is small.

### AHA: A Vision-Language-Model for Detecting and Reasoning Over Failures in Robotic Manipulation (ICLR 2025)
- **URL:** https://arxiv.org/abs/2410.00371 (HTML v1)
- **Finding:** it frames failure detection as a sub-task-level yes/no question followed by a free-form reason. The prompt asks the model to "first determine it has succeed by choosing from ['yes', 'no'] and then explain..." The input is one image grid with one row per camera view and one column per keyframe in time order. It uses a 7-mode failure taxonomy (No_Grasp, Slip, Translation, Rotation, No_Rotation, Wrong_action, Wrong_object). The fine-tuned model beats GPT-4o in-context learning by 10.3%.
- **Winnow stage:** the visual Criterion prompt, multi-view layout, and the vocabulary of rejection reasons.
- **Borrow:** ask per sub-task; consider a views × keyframes grid image as a cheap Glimmer input (Glimmer takes images only); use the taxonomy as a menu for `failure_mode` in explanations.
- **Caveats:** it is trained on simulated RLBench perturbations, and its keyframes come from RLBench rather than a stated heuristic. FailBench finds fine-tuned detectors generalize poorly, so borrow the format, not the model.

### PerAct (Shridhar et al., 2022), cited only for the keyframe heuristic
- **URL:** https://arxiv.org/abs/2209.05451
- **Finding:** "an action is a keyframe if (1) the joint-velocities are near zero and (2) the gripper open state has not changed."
- **Winnow stage:** keyframe selection from robot data.
- **Borrow:** pauses (near-zero speed) and gripper transitions make good keyframes, and Winnow's `criteria/measured.py` already finds both.
- **Caveats:** it was designed for action extraction, not judging.

### RoboFAC: A Comprehensive Framework for Robotic Failure Analysis and Correction (Ye et al., 2025)
- **URL:** https://arxiv.org/abs/2505.12224
- **Finding:** 9,440 failure trajectories and 78,623 QA pairs across 53 scenes, split into task understanding, failure detection with localization, explanation, and correction. Its fine-tuned model scores 34.1% higher than GPT-4o on failure analysis.
- **Winnow stage:** evaluation (secondary check) and the structure of rejection explanations.
- **Borrow:** separate *detect*, *localize*, and *explain* into distinct output fields.
- **Caveats:** the plan already notes its failures are staged and that judges are near-saturated on it. FailBench shows Gemini 3 Flash at 0.90 on RoboFAC.

### Vision-Language Models as Success Detectors / SuccessVQA (Du et al., 2023)
- **URL:** https://arxiv.org/abs/2303.07280
- **Finding:** it frames success detection as VQA ("did the agent achieve X?") on a fine-tuned Flamingo. This generalizes better than bespoke reward models out of distribution, but "success detection on unseen real videos presents an even more challenging generalisation task."
- **Winnow stage:** baseline framing. This is essentially what `judge_probe.py` does now.
- **Borrow:** use it as the "Spark alone" baseline question, unchanged, so the comparison stays fair.
- **Caveats:** it needs fine-tuning and predates current VLMs.

### GVL: Vision Language Models are In-Context Value Learners (2024)
- **URL:** https://arxiv.org/abs/2411.04549 (HTML)
- **Finding:** given frames in order, a VLM outputs "linear, monotonic value functions for every single video, regardless of optimality", because "the chronology itself is a cue". Shuffling the frames and asking for per-frame progress fixes this. Value-Order Correlation (VOC, rank correlation of predicted progress against true order) below 0.5 serves as a zero-shot success detector: 0.71 accuracy, versus 0.62 for SuccessVQA, with Gemini 1.5 Pro on 30 frames. DROID ranked "very low" by VOC among OXE datasets.
- **Winnow stage:** soft "made steady progress / no wasted motion" Criteria, and how the bias arises.
- **Borrow:** an in-order video invites the model to assume the story ends well, which is one plausible cause of the success bias. For a progress Criterion, shuffle the frames and score VOC.
- **Caveats:** DROID's low VOC means that on our data, GVL may flag good Episodes too, so treat it as a weak soft signal. It is an older model and uses 30 frames.

### Sentinel: Unpacking Failure Modes of Generative Policies (Agia et al., CoRL 2024)
- **URL:** https://arxiv.org/abs/2410.04640 (HTML)
- **Finding:** a VLM monitor uses chain-of-thought video QA. GPT-4o given a single image flagged every successful rollout as a failure (Close Box OOD: TPR 1.00, TNR 0.00), but with video it reached TPR 0.69 and TNR 0.95. Pairing the VLM with a cheap statistical detector "detects 18% more failures than using either of the two detectors alone."
- **Winnow stage:** input choice (video plus stills, not stills alone); fusing measured and visual signals.
- **Borrow:** keep video as the main input and add stills as anchors. Disagreement between non-VLM signals and the VLM is informative.
- **Caveats:** this is runtime monitoring on mid-rollout frames, not post-hoc judging of a finished Episode. There is no CoT-versus-no-CoT ablation.

### Set-of-Mark Prompting (Yang et al., 2023)
- **URL:** https://arxiv.org/abs/2310.11441 (HTML)
- **Finding:** it overlays SAM or SEEM regions with alphanumeric marks plus masks or boxes. With it, GPT-4V zero-shot beats fine-tuned referring-expression models on RefCOCOg. Combining number, mask, and box reached 89.2 recall on Flickr30K, versus 84.4 for number and mask alone. Ground-truth masks add 14.5 mIoU over predicted masks, so mask quality matters. Mark placement needs an algorithm to avoid overlap, and center placement is not always best.
- **Winnow stage:** visual prompting from SAM output.
- **Borrow:** label the gripper, object, and target with marks and refer to them by label in the Criterion question ("Is [2] inside [3] in the last frame?").
- **Caveats:** it is image-only and its tasks are about grounding, not judging outcomes. At 320×180, marks and masks can cover the very contact region being judged, and SAM errors spread into the judgment. It is untested on robot video.

### Fine-Grained Visual Prompting (Yang et al., NeurIPS 2023)
- **URL:** https://arxiv.org/abs/2306.04356
- **Finding:** compared with boxes, circles, and plain masks, a "Blur Reverse Mask" (blurring everything except the target mask) worked best, gaining 3.0–4.6% on average and up to 12.5% on RefCOCO+ testA, because it "reduce[s] focus on weakly related regions while retaining spatial coherence."
- **Winnow stage:** visual prompting from SAM output.
- **Borrow:** blurring or dimming outside the SAM masks while keeping context is a gentler alternative to a hard crop, and it doesn't paint over the object.
- **Caveats:** it was tested with CLIP-style zero-shot referring, not generative VLMs on video.

### NumPro: Number It, Temporal Grounding Videos like Flipping Manga (2024)
- **URL:** https://arxiv.org/abs/2411.10332
- **Finding:** overlaying a unique frame number on each frame helps Video-LLMs ground time. It "significantly boosts" temporal grounding without fine-tuning, and with fine-tuning reaches up to +6.9% mIoU on moment retrieval and +8.5% mAP on highlight detection.
- **Winnow stage:** failure localization (`failure_time_s`, Evidence timestamps).
- **Borrow:** burn `t=12.3s` into a corner of every frame with ffmpeg `drawtext` before uploading, and ask Spark to report the burned-in time it sees.
- **Caveats:** the headline numbers are the fine-tuned ones, and the no-fine-tuning gain differs by model. The overlay costs pixels on a 320×180 frame.

### Adaptive Keyframe Sampling for Long Video Understanding (CVPR 2025)
- **URL:** https://arxiv.org/abs/2502.21271
- **Finding:** under a fixed token budget, choosing keyframes for relevance to the prompt *and* coverage of the video beats uniform sampling for video QA.
- **Winnow stage:** keyframe and clip selection.
- **Borrow:** relevance comes from robot-data events (gripper edges, the final settle) and coverage from a few uniform frames.
- **Caveats:** it targets long videos; our Episodes are 10–25 s, so the payoff is attention more than budget.

### More Thinking, Less Seeing? Assessing Amplified Hallucination in Multimodal Reasoning Models (Liu et al., 2025)
- **URL:** https://arxiv.org/abs/2505.21523
- **Finding:** "longer reasoning chains lead to reduced focus on visual inputs, which contributes to hallucination"; generations drift toward language priors.
- **Winnow stage:** choosing reasoning effort.
- **Borrow:** default visual Criteria to medium or high effort, never `max` as a cure for the bias, and keep the answer grounded in an observation field written *before* any reasoning-heavy step.
- **Caveats:** this is general multimodal QA, not robot video, and it doesn't measure Spark's effort levels.

### POPE: Evaluating Object Hallucination in Large Vision-Language Models (Li et al., EMNLP 2023)
- **URL:** https://arxiv.org/abs/2305.10355
- **Finding:** asked "Is there a X in the image?", LLaVA, MultiModal-GPT, and mPLUG-Owl answered "Yes" about 95–100% of the time (Table 3); the paper says they are "extremely prone to answer 'Yes'... over confident." Accuracy falls further when the negative questions name plausible co-occurring objects.
- **Winnow stage:** question framing.
- **Borrow:** the yes/acquiescence bias is a known property of VLMs, and our failures are the "plausible but absent" kind (the remote looks grasped). Prefer questions whose honest answer under ambiguity is "unsure", and test both success framing and failure framing.
- **Caveats:** these are 2023 models on static images, so expect a much smaller effect in Spark. Cite it as the mechanism, not the magnitude.

### Can LLMs Express Their Uncertainty? (Xiong et al., ICLR 2024)
- **URL:** https://arxiv.org/abs/2306.13063
- **Finding:** verbalized confidence clusters at 80–100%, and failure prediction AUROC is about 0.52–0.61. Consistency across multiple samples and better aggregation help.
- **Winnow stage:** Triage decision and the Needs review signal.
- **Borrow:** use sample agreement and the explicit `unsure` answer for uncertainty, not a 0–100 confidence.
- **Caveats:** text-only LLMs; nobody has measured this for Spark.

### TICK: Generated Checklists Improve LLM Evaluation and Generation (Cook et al., 2024)
- **URL:** https://arxiv.org/abs/2410.03608
- **Finding:** generated yes/no checklist questions raise exact agreement between LLM judges and human preferences from 46.4% to 52.2% compared with direct scoring, and inter-annotator agreement rises when humans use the checklists.
- **Winnow stage:** compiling a Rubric and per-Criterion judging.
- **Borrow:** this supports the Rubric itself. Judge each visual Criterion with its own yes/no-or-unsure question rather than one holistic score.
- **Caveats:** text tasks only, and the gain is modest.

### RoboReward: General-Purpose Vision-Language Reward Models for Robotics (Lee, Wagenmaker, Pertsch, Liang, Levine, Finn, 2026)
- **URL:** https://arxiv.org/abs/2601.00675 (HTML)
- **Finding:** "OXE is success-heavy and lacks failure examples," so the authors generate near-misses through counterfactual relabeling and temporal clipping. They use a 1–5 progress rubric whose levels have written definitions (for example, "Near completion (4): ... correct in region and intent but misses a single minor requirement"). "No model excels across tasks." On RoboArena, their 8B model has 0.768 MAE against 0.862 for GPT-5 mini and 1.002 for Gemini Robotics-ER 1.5.
- **Winnow stage:** soft Criteria scoring and evaluation-set construction.
- **Borrow:** (a) for soft visual Criteria, a graded scale with written anchors instead of a bare 0–1. (b) Temporal clipping as a cheap test of a judge: cut a good Episode before its release and check that Spark stops saying "pass."
- **Caveats:** reward-model training, not prompting. The MAE is on its own scale.

### Others checked but not relied on
- **VLM-RM** (https://arxiv.org/abs/2310.12921): CLIP cosine similarity as a reward. Its failures trace to "limited spatial reasoning ability", and it scales with model size. Not a fit for judging an outcome.
- **RoboCLIP** (https://arxiv.org/abs/2310.07899): S3D video–language similarity to one reference video or text as a reward. Roadmap idea only: compare against one user-chosen "gold" Episode.
- **Guardian** (https://arxiv.org/abs/2512.01946): multi-view reasoning VLM fine-tuned on synthesized failures. It shows multi-view input is standard, but I found no single-view versus multi-view ablation.
- **I-FailSense** (https://arxiv.org/abs/2509.16072) and **FIDeL** (https://arxiv.org/abs/2604.13788): fine-tuned or anomaly-based detectors, out of scope for a prompt-only build.
- **Meta Model API video docs** (https://dev.meta.ai/docs/video-understanding): mp4 only. Frame rate, resolution, duration limits, and video token accounting are **not documented**. The docs advise `max_output_tokens` ≥ 4000 because reasoning shares the output budget.

---

## 3. Recommendations (ranked)

### R1. Per-Criterion visual prompt with an `unsure` answer and observations before the answer (build this week)
Replace the probe's holistic schema for visual Criteria with one call per visual Criterion. One call can carry several visual Criteria, but each still gets its own result. Schema:

```json
{
  "observations": "string — what is visible at the decisive moment, camera by camera, BEFORE deciding",
  "result": "pass | fail | unsure",
  "evidence_time_s": "number | null — read from the burned-in timestamp",
  "evidence_camera": "exterior_1 | exterior_2 | wrist | null",
  "failure_mode": "no_grasp | slip | drop | wrong_place | wrong_object | other | null",
  "unsure_reason": "string | null — e.g. 'occluded by gripper at last frame'"
}
```

Prompt pattern, built from the Criterion's `check` text in `rubric.json`:
> "Camera videos of one robot Episode: [exterior_1] [exterior_2] [wrist]. Each frame shows its time in the top-left. Criterion: *Object placed inside target*: PASS only if the object comes to rest fully inside the target at the end. First describe exactly what you see about the object and target at the end, per camera. Answer `pass` only if you can point to a frame and camera that show it. If the deciding detail is occluded, too small, or ambiguous, answer `unsure`. Do not assume success."

- **Why:** FailBench says the bias comes from scoring success despite named doubt, and `unsure` gives that doubt somewhere to go. REFLECT's per-subgoal verification and AHA's sub-task questions decompose the judgment, and TICK shows checklists beat holistic scores. POPE shows yes-bias in VLMs.
- **Tie to the probe:** keep `judge_probe.py`'s holistic prompt, unchanged, as the "Spark alone" baseline (SuccessVQA framing). The new prompt is "Winnow". `unsure` → Needs review.
- **Watch:** if Spark answers `unsure` on more than about 30% of Episodes, the Criterion is badly worded, and the Rubric sanity monitor should warn.

### R2. Crop the exterior cameras to a SAM box and send the wrist camera whole (build this week)
For each exterior camera, take the union of SAM 3.1 boxes for the object and the target (plus the gripper near contact) over the Episode, pad it by about 20%, and crop and upscale with ffmpeg. Send the wrist camera uncropped. Optionally send the uncropped exterior view too, so Spark keeps scene context; that is an open question (Q2).
- **Why:** FailBench measured 0.740 → 0.810 on RoboArena (DROID) with exactly this split between fixed and moving cameras, and gains were largest when objects were small. droid_100 is 320×180.
- **Tie to the probe:** `box_track_probe.py` already produces per-frame boxes, so this is about 30 lines in `episodes/` (crop) plus `tracking/` (union box).
- **Fallback:** if SAM lost track (already a Needs review signal), send the uncropped video and lower confidence.

### R3. Burn timestamps into frames and add robot-data keyframes as stills (build this week)
- Before uploading, run `ffmpeg drawtext` with `t=%{pts}` in a corner (NumPro).
- Add 3–6 still images labeled by time and camera: the frame at each gripper close and open edge, the start and end of the longest pause, and the final settled frame (REFLECT and PerAct-style event keyframes, AKS-style relevance plus coverage). End-state Criteria such as "placed inside target" depend mostly on the final frames.
- **Why:** the probe's `failure_time_s` (17.0 vs 17.33 s across two runs on Episode 42) is currently unanchored. Burned-in times turn it into a reading, and keyframes from robot data put the decisive frames in front of the model. Keep video as the main input, since Sentinel shows judging from stills alone fails.
- **Check:** compare Spark's `evidence_time_s` with the gripper re-open time from `criteria/measured.py`. If they differ by more than about 1 s, that is a disagreement signal and goes to Needs review.

### R4. Uncertainty from disagreement, not self-report (build this week)
Run each visual Criterion 2–3 times on the contributor tier (about $0.001 per Episode per run). Optionally make one of the runs *failure-framed* ("Is there any sign this Criterion was NOT met?"). The Triage decision becomes Needs review if any of these hold: samples disagree, any sample says `unsure`, or the visual result conflicts with a measured or tracked Criterion (for example, the gripper closed but SAM shows no object in it).
- **Why:** Xiong et al. found verbalized confidence overconfident and a weak predictor, with consistency better. Sentinel shows fused heterogeneous detectors catch more failures. Don't add a 0–100 `confidence` field and threshold it.

### R5. Keep effort at medium or high and escalate by changing the input, not by `max` (build this week)
Contributor/high already caught Episode 42, the go/no-go case. Escalation for Needs review Episodes should be, in order: crop or keyframes (R2, R3), then a Glimmer second opinion on a keyframe grid, and only then standard-tier effort.
- **Why:** FailBench says effort doesn't fix the bias and wrong answers reason longer. "More Thinking, Less Seeing" says long chains drift from the pixels. Reasoning tokens are 50–80% of our per-Episode cost.
- **Check:** measure low, medium, and high effort on the same Episodes (Q3) before locking a default.

### R6. AHA-style views × keyframes grid image for Glimmer (build this week if Glimmer lands; otherwise roadmap)
Glimmer accepts images only. Tile a grid with rows for exterior 1, exterior 2, and wrist, and columns for the R3 keyframes, each tile labeled with its time, and ask the same per-Criterion question.
- **Why:** AHA's input format; it gives a different model the same evidence.

### R7. SAM mask overlays (Set-of-Mark marks, or blurring outside the mask) (roadmap/slides; run Q6 first)
Label the gripper, object, and target as [1], [2], [3], or blur outside their masks, and ask "Is [2] inside [3] at t=…?".
- **Why:** SoM and FGVP show gains for grounding. **Risk:** at 320×180, overlays can hide the contact region, and SAM mistakes become judge mistakes (the SoM gap between ground-truth and predicted masks is +14.5 mIoU). Try it on a few Episodes against R2's plain crop before adopting it. For the slides, it shows SAM *steering* Spark, as plan §6 promises.

### R8. GVL shuffled-frame progress as a soft Criterion (roadmap/slides)
Shuffle about 20 frames, ask for per-frame progress (0–100%), and compute VOC. Low VOC means hesitation or regression.
- **Caveat:** GVL itself ranks DROID low, so expect noise on our data.

### R9. Graded anchored scale for soft visual Criteria, and temporal-clip tests (roadmap/slides)
Use RoboReward's 1–5 anchored scale for soft quality Criteria. Build a cheap judge test by clipping a good Episode before its release (the truncated clip must fail) to report how often Spark says "success" on near-misses, which is the headline weakness in the plan.

### What to avoid
- **A single holistic success question as the only gate.** Keep it only as the Spark-alone baseline.
- **Binary schemas with no `unsure`.** They force the ambiguity-to-success lean into a pass.
- **Self-reported 0–100 confidence** as the triage signal.
- **Cranking reasoning effort to `max`** to fix misses. It's costly, doesn't fix the bias (FailBench), and can reduce visual grounding.
- **Cropping the wrist camera** (it moves; FailBench sends it whole), or crops so tight they drop the target.
- **Stills-only judging, or the final frame alone.** You lose the transport and the drop moment, and Sentinel's single-image monitor failed.
- **Dense marks or opaque masks** on 320×180 frames that cover the contact point.
- **Telling Spark the dataset's success label or "this Episode was marked successful".** It anchors the answer. This is our inference, not a cited result.
- **Fine-tuned off-the-shelf failure detectors** (AHA, RoboFAC models). FailBench shows they generalize worse than general VLMs.
- **Trusting `failure_time_s` without a burned-in clock** or a check against robot data.

---

## 4. Open questions worth a quick experiment

Each fits in under $0.10 on the contributor tier with the 5 feasibility Episodes plus about 10 explicit failures from droid_1.0.1.

1. **What does Spark actually sample?** Upload a synthetic 20 s mp4 with a large frame counter and single-frame color flashes at known times. Ask Spark to list every number or flash it sees. This gives the effective frame rate and whether sub-second events (a slip, a drop) can be missed. Our ~71–75 tokens per camera-second hints at about 1 fps at low resolution, which is UNVERIFIED.
2. **Crop vs full vs crop plus full** (R2). Measure balanced accuracy and whether `unsure` rates drop.
3. **Effort ablation.** Run low, medium, and high on contributor across the same Episodes, recording accuracy, output tokens, and reason length. FailBench predicts wrong answers will reason longer, so check it.
4. **Framing flip.** "Was the Criterion met?" vs "Is there any sign it was NOT met?" How often do they disagree, and do the disagreements line up with true failures? This is the cheapest direct measurement of Spark's success lean.
5. **Self-consistency.** k=3 samples per Criterion. Does disagreement predict errors better than chance? If not, R4 rests on robot-data disagreement alone.
6. **Overlay style.** Plain crop vs SoM marks vs blurring outside the mask vs mask tint on Episodes 42, 48, and 49 (R7).
7. **Views.** Wrist only vs exterior only vs all three for the "placed inside target" Criterion. Spark's Episode 16 reason cited "final exterior and wrist views", but nothing in the literature I found ablates wrist plus exterior for judging success.
8. **Timestamp accuracy.** With and without burned-in times, how far is Spark's `evidence_time_s` from the gripper-edge time measured in robot data?
