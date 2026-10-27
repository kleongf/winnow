# How FailBench prompts and scores its judges

Research for issue #5. Written 2026-10-26. Section numbers follow the compiled paper: §4 Experiments, §5 Limitations, App. A sources, App. B diagnosis, App. C boosting ablations, App. D reproduction arithmetic.

**Question:** How does FailBench (arXiv 2609.03611) prompt and score VLM success judges, and what should Winnow's Spark-alone baseline look like so that it is a fair, citable reproduction?

**Short answer:** FailBench publishes **no prompt text**. Its protocol is simple: give the judge the task instruction and the recording (native video if the model accepts it, otherwise 32 evenly spaced frames), ask one binary question ("did it succeed?"), and score balanced accuracy per source subset. The "bias toward success under ambiguity" is a **qualitative** finding from reading one model's reasoning traces. The paper does not report it as a measured rate. The code and dataset are listed as "(soon)" and have not been released. For Winnow this means the baseline can match FailBench's protocol exactly, but the prompt wording will be Winnow's own and must be published with the results.

## Sources

| Ref | Source | What it is |
|---|---|---|
| [P] | arXiv 2609.03611v1, TeX source `main_preprint.tex` (https://arxiv.org/src/2609.03611) | The paper itself, including its appendix. v1, submitted 2026-09-03, and the only version (https://arxiv.org/abs/2609.03611). Section and table numbers below refer to this file. |
| [M] | `generated/macros.tex` in the same TeX bundle | The numbers the paper inserts into its text (e.g. `\BestScore`). |
| [W] | Project page, https://metric-ai-lab.github.io/failbench/ | Lists "Code (soon)", "Dataset (soon)", and "Leaderboard (soon)". |
| [G] | https://github.com/Metric-AI-Lab/failbench (Apache-2.0, last pushed 2026-09-04) | Holds only `LICENSE`, `README.md`, and `index.html` (the project page). No code. Checked via `gh api` on 2026-10-26. |

Authors: Zaruhi Navasardyan, Tatul Danielyan, Hrant Davtyan (Metric AI Lab) [P]. Formatted as an ICLR 2027 submission [P]. The repo README gives a different title, "FailBench: What Vision-Language Models See and Miss When Robots Fail" [G]. Cite the arXiv title.

## 1. The judging protocol

### Inputs
- Each sample is "an instruction, a visual observation, and a binary outcome" [P §1]. The judge receives **only the instruction and the visual recording**. Force-torque, audio, and proprioception are excluded even where a source records them: "Every number comes from visual input and the instruction" [P §Limitations].
- Video handling: "Models that support video input are supplied directly with the video clip; otherwise, 32 still frames spaced evenly across the clip are used." [P §4.1]
- Views: multi-view sources pass **every listed view** to the model. Examples: rh20t uses external + wrist; armnetbench uses overhead + front + wrist; reassemble uses 2 external + wrist; roboarena (DROID) uses external + wrist [P Table "sources"]. Two sources (ur5fail, bdv2fail) contain **only start and end frames**, because that is all their authors released [P §3, Table "sources"]. The paper does not say how multiple views are packed into one request (separate videos, tiled frames, or labels).
- Labels always come from the original data providers: "no label in FailBench is our own judgment of a video" [P §3]. About 25% of the benchmark was hand-inspected. Any sample with a wrong or ambiguous label was swapped for another sample from the same source [P §3].

### Prompt wording
- **Not published.** The paper says: "Whenever available, we use the official prompt provided by the authors and their recommended settings for the decoding strategy and thinking budget." [P §4.1] The contributions list says each detector runs with "each model's intended prompt and inference settings" [P §1]. The project page repeats this without giving any prompts [W].
- That policy applies to the five specialist detectors (Guardian, RoboReward, ViFailback, RoboFAC, FailSense), which ship their own prompts. The paper **does not say what prompt was used for general-purpose models** such as Gemini 3 Flash, GPT-4o, Gemma, and Qwen, which have no "official" failure-detection prompt. **Unverifiable until the harness is released.**
- Base-vs-specialist comparisons used "the same prompt, decoding and input recipe" for each pair [P App. B.1]. Which prompt that was is not stated.

### Question and output format
- "Each detector answers one binary question per sample: shown the record of a completed attempt and the instruction, did it succeed?" [P §4.2] The paper's own condensed form: "given the instruction and the visual recorded attempt, did the task succeed?" [P §1]
- The output is a binary success/failure label. The paper does not specify how answers are parsed, the answer format, or how refusals are handled. The micro average "pools every sample the model answered" [P §4.2], which implies some samples went unanswered and were dropped. The paper does not say how many.
- No confidence score, abstention option, or "unsure" class is collected or scored.

### Decoding
- Each model's recommended decoding and thinking budget. "All experiments where the same model performance with different pipelines is compared are run with the most possible deterministic setting." [P §4.1] No temperature values are given.

## 2. How the scores are computed

- **Metric:** balanced accuracy, BA = ½·(failure recall + success recall). Chance is 0.50 for any class split [P §4.1, §4.2]. The paper's worked example for RoboFAC-7B: BA = ½(30/30 + 2/30) = 0.533 [P App. D].
- **Macro average** (the headline number): the unweighted mean of the 13 two-class subset BAs. **Micro average:** one BA over all answered samples pooled [P §4.2].
- `reflect` contains only failures (30 episodes), so it is scored by **failure recall** and left out of the macro average [P §4.2].
- Class balance: failures and successes are drawn roughly 50/50 per source, with some exceptions. Overall, 1,176 failures and 1,021 successes (54% failures) [P §3, M]. Within each source, failures are sampled evenly across failure types, so a subset "covers the ways that source breaks" [P §3].
- The paper argues against plain accuracy on imbalanced splits. RoboFAC-7B's published 0.806 accuracy is roughly what "answer failure to everything" scores on its 79.7%-failure split (0.797). Its balanced-subset recalls of 1.000 / 0.067, reweighted to the published split, reproduce 0.811 [P App. B.1, App. D].
- Significance: the crop intervention is tested with an exact McNemar test (p = 0.0015) over samples it fixed versus broke (223 vs 160) [P §4.4]. No confidence intervals are reported for the per-subset BAs.

### How the "success under ambiguity" bias is measured
It is **not a measured quantity.** It comes from manual reading of errors and reasoning traces, almost all from **Gemma-4-31B-it** [P App. B.2]. The paper is explicit:
- "The inspection followed no fixed protocol and covered a small share of the errors. Nothing in this subsection is a statistically supported claim." [P App. B.2]
- "The mechanism is established on Gemma-4-31B-it and assumed rather than shown for the rest of the panel." [P §Limitations]
- The qualitative pattern: the model "names the thing it is unsure about, and then scores success anyway... Failure is treated as what must be proven." Example traces include "Is there any reason to believe it failed? No." and an unanswered "Is it in the drawer or just at the drawer?" It also hallucinates success: an apple dropped on the way to the bowl is reported "clearly visible inside the bowl". It credits the approach rather than the outcome (a bolt "inserted" after being carried to the hole), and it ignores views that contradict each other [P App. B.2, Figs. "apple", "viewpoint"].
- The only number measured on the traces: wrong answers carry **longer** reasoning than right ones (1,868 vs 1,464 characters on average) [P App. B.2]. The abstract claims "Increasing reasoning effort does not alleviate this bias". The body contains this trace-length comparison but **no reasoning-effort sweep**, so the stronger claim is not backed by a reported experiment.
- Indirect quantitative evidence that *is* in the tables: on the failure-only `reflect` subset, **Gemini 3 Flash catches only 0.40 of failures** (it calls 60% of real failures successes), while Gemma-4-31B-it catches 0.73 [P Table "results-subsets"]. Not every model leans toward success: RoboFAC-7B and ViFailback-8B "answer failure almost regardless of what they are shown" [P §4.2, §4.3].
- The paper does not report per-model success and failure recalls on the balanced subsets. So the bias cannot be read off the published tables beyond `reflect`.

## 3. Models evaluated (13)

All scores are macro BA [P Table "results"]:

| Group | Model | Macro | Micro |
|---|---|---|---|
| General-purpose | Gemini 3 Flash | **0.77** | 0.74 |
| General-purpose | Gemma-4-31B-it | 0.75 | **0.76** |
| General-purpose | Qwen3-VL-8B-Thinking | 0.69 | 0.69 |
| General-purpose | GPT-4o | 0.69 | 0.67 |
| General-purpose | Qwen3-VL-4B-Thinking | 0.65 | 0.65 |
| General-purpose | Qwen3-VL-2B-Thinking | 0.53 | 0.53 |
| Embodied (not detection-trained) | Hy-Embodied-VLM-1.0 | 0.61 | 0.62 |
| Embodied (not detection-trained) | HY-Embodied-0.5 | 0.54 | 0.53 |
| Failure-detection specialist | Guardian (thinking) | 0.63 | 0.61 |
| Failure-detection specialist | RoboReward-8B | 0.62 | 0.59 |
| Failure-detection specialist | ViFailback-8B | 0.59 | 0.56 |
| Failure-detection specialist | RoboFAC-7B | 0.51 | 0.52 |
| Failure-detection specialist | FailSense-Calvin-3B | 0.50 | 0.50 |

- Every specialist scores below its own base model under the same recipe. Guardian vs InternVL3-8B: 0.627 vs 0.629. RoboReward vs Qwen3-VL-8B-Instruct: 0.619 vs 0.675. ViFailback vs Qwen3-VL-8B-Instruct: 0.587 vs 0.675. RoboFAC vs Qwen2.5-VL-7B: 0.514 vs 0.555. FailSense vs PaliGemma2-3B: 0.503 vs 0.506 [P Table "bases"].
- No Meta model was evaluated. (Gemma is Google's.) No Muse Spark, Llama, or SAM numbers exist in FailBench.
- Errors overlap little: the mean error-set IoU across the 78 model pairs is 0.28 [P §4.3]. Even so, a majority vote of the top 3 models reaches only 0.78 vs 0.76 for the best single model, and 0.55 on assembly, at about 3x the cost [P §4.3].

## 4. Which results apply to pick-and-place vs contact-heavy tasks

FailBench does **not** split results by task type. The paper says: "Nor could we associate it with the task itself, in the sense of pick, place, push, insert, or fold." What predicts accuracy is the **kind of visual evidence** needed. Semantic failures (wrong object, wrong colour) are mostly caught. Physical failures (released in the wrong place, jaws close on nothing, grasp slips) are mostly missed. This is again stated as "a reading of the samples we examined rather than as a measurement" [P App. B.2].

The source subsets closest to Winnow's hero demo (single-arm tabletop pick-and-place). Gemini 3 Flash and Gemma-4-31B-it BA are from [P Table "results-subsets"]; descriptions are from [P App. A]:

| Subset | What it is | Gemini 3 Flash | Gemma-4-31B | Slice mean (13 models) |
|---|---|---|---|---|
| **roboarena** | Policy rollouts on the **DROID** Franka platform, external + wrist video; failures reached about ¼ or ½ of the task | 0.72 (0.81 with crop) | 0.70 | 0.62 |
| ur5fail | UR5 tabletop pick/place/push, start + end frames only, 3 views | 0.84 | 0.79 | 0.66 |
| phail | Franka bin-to-bin pick and place; 61 of 67 failures are timeouts | 0.89 | 0.67 | 0.61 |
| bdv2fail | WidowX BridgeData V2 with synthetic wrong-object / wrong-placement failures, start + end frames | 0.79 | 0.71 | 0.61 |
| robofac (real) | Grasping / orientation / position errors | 0.90 | 0.95 | 0.72 |
| rh20t | Teleoperation across 147 tasks and 7 rigs | 0.60 | 0.71 | 0.57 |

Contact-heavy:

| Subset | What it is | Best model | Slice mean |
|---|---|---|---|
| **reassemble** | Teleoperated NIST Task Board assembly (insert, twist, align...), Franka FR3 | 0.60 (Gemini 3 Flash) | **0.52** |

- The contact-heavy claim, verbatim: "no model exceed[s] 0.60 balanced accuracy on contact-intensive assembly tasks" [P abstract]. The best model ties that ceiling at 0.60 [P Table "results-subsets"].
- The paper contradicts itself here. The ablation table lists a *baseline* Gemma-4-31B-it at **0.608** on reassemble [P Table "crop-attribution-subsets"], which is above 0.60. The main table lists the same model at 0.58. These are presumably separate runs, which the paper does not reconcile.
- **roboarena is the most relevant number for Winnow.** It is the only FailBench slice recorded on DROID, the platform behind `lerobot/droid_100`. Even the best judge reaches only 0.72 there, well below "near-saturated". The "approaches saturation" language fits robofac (0.90–0.95) and phail. It does not fit DROID rollouts.

### The crop intervention (a precedent for SAM-steered judging)
- Pipeline: a localizer "sees four frames spanning the episode and the task sentence, and returns one rectangle around the region that settles whether the attempt worked". The localizer is never shown the outcome. Fixed cameras are cropped to that box; wrist and other moving cameras are sent whole. The detector then runs "on the same prompt, frame budget and decoding settings" [P §4.4].
- Gemini 3 Flash as both localizer and detector: macro 0.773 → 0.797 (+2.3 in the table; the abstract says +2.4); micro +2.6. It fixed 223 samples and broke 160 [P Table "crop", M]. The largest gains came where the deciding region is small relative to a wide shot: simplerenv +10.7, **roboarena +7.0**, robometer +5.0 [P §4.4]. The native-size crop beat both masked blackout and upscaled crop [P App. C, Table "crop-ablation"].
- This is direct, citable support for Winnow's design of steering Spark with SAM 3.1 masks and crops.

## 5. Checking AGENTS.md's FailBench claims

| AGENTS.md claim | Verdict | Evidence |
|---|---|---|
| "2,197 real robot attempts" | **Partly wrong.** The count is right, but not all are real. | 2,197 attempts from 14 sources, **12 real and 2 simulated** (simplerenv 300 + robometersim 300 = 600 simulated), so about 1,597 are real [P abstract, Table "subsets"]. |
| "0.77 mean balanced accuracy" | **Correct.** | Gemini 3 Flash, macro over 13 two-class subsets [P Table "results", M]. Its micro is 0.74, and Gemma-4-31B-it leads on micro at 0.76. |
| "systematic bias toward 'success' under ambiguity" | **Correct as a quote, but weaker than it reads.** | Verbatim from the abstract. In the body it is qualitative, comes from one model (Gemma-4-31B-it), and is "not a statistically supported claim" [P App. B.2, §Limitations]. Best quantitative support: Gemini 3 Flash recalls only 0.40 of failures on reflect. Two specialists are biased the *other* way. |
| "Near-saturated when the outcome is visible object motion" | **Roughly correct (paraphrase).** | The abstract says "approaches saturation when success is determined by observable object motion". The paper never measured motion vs contact as a labelled split [P App. B.2]. On DROID (roboarena) the best score is 0.72, which is not saturated. |
| "below 0.60 on contact-heavy tasks" | **Slightly off.** | The paper says no model *exceeds* 0.60. The best is exactly 0.60 (Gemini 3 Flash on reassemble), the slice mean is 0.52, and one ablation-table baseline shows Gemma at 0.608 [P Tables "results-subsets", "crop-attribution-subsets"]. Better wording: "≤0.60 on contact-heavy assembly (0.52 average across 13 judges)". |
| "FailBench (Sep 2026)" | **Correct.** | Submitted 2026-09-03 [P arXiv abs]. |
| §4 "fine-tuned detectors underperform general models on FailBench" | **Correct.** | [P Table "results", Table "bases"]. |

Other things worth knowing:
- The abstract's "+2.4 points" for crop does not match the body's "+2.3" [P abstract vs Table "crop"]. Cite +2.3 (macro) or +2.6 (micro).
- `generated/macros.tex` defines numbers that never appear in the rendered paper: `\MissImpreciseGrasp` 67%, `\MissPlacementBdv` 44%, `\FlipRate` 19%, `\TailFailures` 43 of `\TailCount` 59 [M]. These look like draft results (e.g. 43 of the 59 samples nearly every detector missed are failures, which would support the success bias). They are not stated or explained in the paper. **Do not cite them.**
- The paper's phrasing that the bias "under ambiguous evidence" involves "ambiguity" is interpretive. No sample is labelled ambiguous. In fact, ambiguous labels were *removed*: roboreward score 4, robometer "partial progress", and armnetbench "suboptimal" were excluded, and wrong or ambiguous labels found in inspection were replaced [P §3, App. A].

## 6. Recommended Spark-alone baseline protocol for Winnow

The aim: "same episodes, same Meta model, Spark alone vs Winnow" (AGENTS.md §8), run so that it can honestly be called "FailBench-style".

1. **Inputs = FailBench's.** Pass the episode's task instruction plus its video. If Spark accepts video natively, pass it directly. Otherwise pass **32 evenly spaced frames** per view [P §4.1]. Include **all camera views the episode has** (droid_100: two exterior + wrist), as FailBench did for roboarena [P Table "sources"]. **No** robot state, gripper data, SAM masks, or rubric. Those are what Winnow adds.
2. **One binary question.** Use a neutral prompt in FailBench's framing, e.g.: *"Here is a recording of a robot attempting the task: '{instruction}'. Did the robot successfully complete the task? Answer with exactly one word: success or failure."* FailBench publishes no prompt, so **publish Winnow's prompt verbatim** in the repo and on the results slide. Do not add "be careful" or "look for failures" language: that would be a stronger-than-FailBench baseline, and it should be a separate, labelled ablation if used. Also do not handicap the baseline (e.g. one frame only, or tiny resolution). That would be the straw man.
3. **Decoding:** use Spark's default (recommended) reasoning setting and the most deterministic sampling available (temperature 0 if exposed), matching [P §4.1]. Record the model version and tier string, the date, and token counts.
4. **No abstention for the baseline.** Spark-alone must answer success or failure, as in FailBench. Count unparseable answers and report them; do not drop them silently. Treat an unparseable answer as a separate category or rerun it once. (FailBench's "answered samples" handling is unspecified, so be stricter.)
5. **Metrics:**
   - Balanced accuracy (the FailBench headline). Over a single source, macro and micro BA are the same number.
   - **Failure recall and success recall reported separately.** "How often it says success on true failures" = 1 − failure recall. FailBench does not publish this per model on balanced data, so Winnow reporting it adds something new, while staying comparable through BA.
   - For Winnow, which can answer Needs review: report BA on auto-decided episodes **plus coverage** (the share not sent to review), and a risk–coverage curve. Do not compare Winnow's BA on its confident subset against Spark's BA on all episodes without showing coverage. That comparison would be unfair in Winnow's favour.
   - A McNemar test on paired per-episode correctness (Spark-alone vs Winnow), as FailBench does for its crop result [P §4.4]. With ~100 episodes, also give bootstrap CIs on BA, since a few episodes swing it by several points.
6. **Labels and balance.** Use provider labels as ground truth, as FailBench does. Hand-check the label of every episode used and record any relabels, like the known droid_100 issues (AGENTS.md §2). Aim for roughly 50/50 success and failure, and spread failures across failure types [P §3]. If the set is imbalanced, BA still applies, but state the class counts.
7. **Optional second baseline: "Spark + crop".** FailBench's localization pipeline (four frames + instruction → one bounding box → crop fixed cameras, send wrist whole, same prompt) is the strongest published *training-free* single-model improvement, at +2.3 macro and +7.0 on DROID-based roboarena [P §4.4]. Running it with Spark as the localizer separates "Winnow wins because of SAM/robot-data evidence" from "Winnow wins because it crops". It is cheap and makes the comparison much harder to dismiss.
8. **How to cite context in the pitch.** The best published general judge is 0.77 macro BA on FailBench and 0.72 on its DROID slice (Gemini 3 Flash). Spark has not been evaluated on FailBench. Phrase the bias as "FailBench reports a systematic bias toward predicting success under ambiguous evidence", and back it with Winnow's own measured Spark-alone failure recall rather than implying FailBench measured a rate.
9. **Optional external check.** FailBench's dataset is not out yet [W, G]. Once it is released, running the same Spark-alone harness on the roboarena and ur5fail slices would give a number directly comparable to FailBench's table. RoboFAC's real split (already planned, AGENTS.md §12) overlaps FailBench's `robofac` subset (30 failures + 30 successes) [P App. A], so sampling it the same way (10 each of grasping error, orientation deviation, and position deviation, plus 30 successes) makes that slice roughly comparable now.

## Open / unverifiable
- The exact prompts and answer parsing for the general-purpose models, and how multiple views are packed into one request. These await the harness release ("Code (soon)") [W, G].
- Whether "increasing reasoning effort does not alleviate this bias" rests on an experiment beyond the trace-length comparison. None is reported [P].
- Per-model success and failure recalls on balanced subsets. Not published.
