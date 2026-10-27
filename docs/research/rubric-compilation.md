# Research: compiling English into a Rubric

*Track: how Winnow turns a plain-English "expert" description into a Rubric of Criteria. Written 2026-10-27, build-week Day 1. It builds on [docs/plan.md](../plan.md) §5, §6 and §13, the Day-1 Rubric in [docs/feasibility/rubric.json](../feasibility/rubric.json), [compile_probe.py](../feasibility/probes/compile_probe.py), and [criteria/measured.py](../../backend/src/winnow/criteria/measured.py).*

**What Day 1 already shows.** Spark split the four-clause description into four Criteria, one per clause, and gave each a sensible `kind`. That part works. The problem is that a Criterion's `check` is free English that nothing executes, so the Rubric shown to the user and the code that judges Episodes have already drifted apart:

| Criterion | What Spark's Rubric says | What `measured.py` does |
|---|---|---|
| Single grasp | gripper closed when > **0.5** | `CLOSED_THRESHOLD = 0.2` |
| No long pauses | speed < **0.02 m/s** for > **2.0 s**, 5-sample moving average | `PAUSE_SPEED_M_S = 0.01`, `PAUSE_MIN_S = 1.0`, no smoothing |
| No drop | distance < **100 px** "and/or" IoU > 0.05 | (not built) 100 px is about a third of the width of a 320×180 droid_100 frame, and "and/or" leaves the logic undefined |

Most of this research points to one fix: make every Criterion a typed call to a known measurement primitive, generate the English from that call, and show its effect on real Episodes before the user confirms it.

---

## 1. Bottom line

1. **Make a Criterion a typed function call, not prose.** The robot-reward literature split on this question, and the split carries over to Winnow. Language to Rewards had the LLM fill in parameters of a fixed set of reward-term functions, and it solved 90% of tasks against 50% for a Code-as-Policies baseline. Eureka and Text2Reward generate free-form code, which needs hosted execution plus repair loops, and Winnow has neither. So each Criterion should be `{primitive, params, comparator, threshold, unit, margin, window}`, validated by Pydantic and run by Winnow's own code. The English shown to the user is rendered *from* those fields, which gives Winnow a single source of truth.
2. **Show each Criterion's effect on the data before asking the user to confirm it.** Measured Criteria cost nothing to run, so the confirm step can show "rejects 23 of 100 Episodes" and a histogram with the threshold line on every card. On the same screen, check each Criterion against Episodes whose outcome the dataset already labels. This is the verification step in VLM-CaR (generated checks must pass on expert trajectories and fail on random ones) and the reward reflection in Eureka (training statistics fed back to the LLM). It also turns plan §5's sanity monitor into something the user sees before running.
3. **Keep the Rubric traceable to the user's words and keep it lean.** RubricBench found model-written rubrics about 27 points less accurate than human ones. They had >70% hallucinated or tangential items and missed nearly half the critical constraints. Link each Criterion to the phrase it came from, as nl2spec does with sub-translations, and highlight any phrase that no Criterion covers. Anything Spark adds on its own goes in an off-by-default "suggested" group.
4. **Ask a few clarifying questions, triggered by structure and anchored to real Episodes. Don't rely on Spark noticing ambiguity.** LLMs are poor at detecting underspecification (CLAMBER, Ambig-SWE), yet a clarifying interaction raised task performance by up to 74% in Ambig-SWE. Ask whenever a vague quantifier ("long", "smooth", "inside") had to become a threshold, *and* the threshold lands where many Episodes sit close to it. Ask by showing the borderline Episode ("Is this 1.8 s pause a long pause?"), in the style of GATE's edge-case elicitation. The user's answer is also the first calibration label.
5. **Refine thresholds from labels; refine the Criteria themselves only with a human in the loop.** With 10–20 labels, fit each threshold and its uncertainty margin to the labels (EvalGen and SPADE select checks by how well they agree with human grades). When a human rejects an Episode that passes every Criterion, that is "criteria drift" (EvalGen): ask why, and let Spark propose a new Criterion for the user to accept. Don't let Spark rewrite the Rubric unsupervised this week.

---

## 2. Sources

Every source below was opened. Claims are quoted or closely paraphrased from the page cited.

### LLM-written reward and success functions (closest analogue to measured Criteria)

**[S1] Language to Rewards for Robotic Skill Synthesis (L2R).** Yu et al., 2023. [arXiv:2306.08647](https://arxiv.org/abs/2306.08647) · [project page](https://language-to-reward.github.io/)
- *Finding:* Two stages. A "Motion Descriptor" LLM expands the user's words into a structured natural-language description, then a "Reward Coder" turns it into calls to predefined, parameterized reward functions (`set_l2_distance_reward()`, `set_obj_orientation_reward()`, …). It solved 90% of 17 tasks, against 50% for a Code-as-Policies primitive-skill baseline. The project page also reports notably higher success than a direct Reward Coder without the Motion Descriptor on 11/17 task categories.
- *Stage:* Compile.
- *Borrow:* (a) A fixed library of parameterized primitives, with the LLM picking and filling them. (b) A two-step compile: first restate each clause as a precise English sentence with numbers, then map it to a primitive call. The first step is also what the user confirms.
- *Caveats:* Simulation (MuJoCo MPC), and it generates rewards for control rather than pass/fail checks on recorded data. The 90% vs 50% compares against a different paradigm, not against free-form reward code.

**[S2] Eureka: Human-Level Reward Design via Coding LLMs.** Ma et al., ICLR 2024. [arXiv:2310.12931](https://arxiv.org/abs/2310.12931) · [project page](https://eureka-research.github.io/)
- *Finding:* GPT-4 writes free-form reward code from the raw environment source. Evolutionary search plus "reward reflection", which "summarizes the key statistics of the RL training", lets it revise hyperparameters, functional forms, or add components. It beat human experts on 83% of tasks, with a 52% average normalized improvement, across 29 environments.
- *Stage:* Compile and refine.
- *Borrow:* Reward reflection becomes **Criterion reflection**: feed per-Criterion pass rates and value distributions back to Spark so it can revise thresholds.
- *Caveats:* It needs to run many generated programs, GPU simulation, and a dense fitness signal. Winnow has no hosted code execution and only a handful of labels. Don't copy the free-form code generation.

**[S3] Text2Reward: Reward Shaping with Language Models for RL.** Xie et al., ICLR 2024. [arXiv:2309.11489](https://arxiv.org/abs/2309.11489)
- *Finding:* The environment is given as a compact Pythonic class abstraction (e.g. `self.robot.ee_pose`, `check_grasp()`). Feeding execution errors back "decreases error rates from 10% to near zero". Human feedback after watching rollouts fixed failing rewards in 2–3 rounds. 13 of 17 manipulation tasks matched or beat expert rewards.
- *Stage:* Compile (what context to give Spark) and repair.
- *Borrow:* Give Spark a typed **capabilities manifest**: available signals with units, fps and ranges, camera resolution, and the primitive catalog with signatures. Add a one-turn **validation-error repair loop**: Pydantic errors go back to Spark.
- *Caveats:* About 10% of first-pass code had errors even with a clean abstraction, so expect invalid compiles and plan for repair.

**[S4] Code as Policies.** Liang et al., 2022. [arXiv:2209.07753](https://arxiv.org/abs/2209.07753)
- *Finding:* LLMs write policy code that "process[es] perception outputs … and parameterize[s] control primitive APIs", prompted with few-shot pairs of language commands and code.
- *Stage:* Compile.
- *Borrow:* Few-shot examples of description fragment → primitive call in the compile prompt.
- *Caveats:* It runs generated Python, and the abstract doesn't discuss safety. It is the baseline L2R beat.

**[S5] Scaling Up and Distilling Down.** Ha, Florence, Song, 2023. [arXiv:2307.14535](https://arxiv.org/abs/2307.14535)
- *Finding:* "the LLM also infers a code-snippet for the success condition of each task, simultaneously enabling the data-collection process to detect failure and retry as well as the automatic labeling of trajectories with success/failure."
- *Stage:* Compile and judge. This is the most direct precedent for LLM-written success checks that label recorded trajectories.
- *Borrow:* The framing for the pitch: "an LLM-written success check labels data". Winnow's addition is to make the check user-defined, typed, and evidence-bearing.
- *Caveats:* Simulation with privileged state (whether it uses privileged state is inferred, not stated in the abstract). Real droid_100 has only noisy end-effector pose and gripper state.

**[S6] Code as Reward (VLM-CaR).** Venuto et al., 2024. [arXiv:2402.04764](https://arxiv.org/abs/2402.04764)
- *Finding:* A VLM writes programs that check sub-task completion from frames. They are verified automatically: "Every sub-task must be completed in the expert trajectories and completed in less than p% of the random trajectories" (2 expert and 100 random trajectories, p = 10%). Programs that fail are sent back for refinement.
- *Stage:* Confirm (verification before running).
- *Borrow:* **Check each Criterion on known-labeled Episodes**: it must pass on known-good Episodes (droid success labels, or the user's first labels) and must not pass on almost everything. This is a concrete form of the plan's sanity monitor.
- *Caveats:* Simple game-like environments. Random trajectories are trivially bad negatives, while Winnow's negatives are subtle.

### Checklist and rubric decomposition for LLM judges

**[S7] CheckEval.** Lee et al., 2024 (rev. Oct 2025). [arXiv:2403.18771](https://arxiv.org/abs/2403.18771)
- *Finding:* Replacing Likert scoring with binary checklist questions "improves the average agreement across evaluator models by 0.45 and reduces the score variance" across 12 evaluator models.
- *Stage:* Judge (visual Criteria).
- *Borrow:* Phrase every visual Criterion as an atomic yes/no question. Add an explicit "unsure", which Winnow's Triage decision needs.
- *Caveats:* Text evaluation, not video.

**[S8] TICK: Generated Checklists Improve LLM Evaluation and Generation.** Cook et al., 2024. [arXiv:2410.03608](https://arxiv.org/abs/2410.03608)
- *Finding:* LLM-generated, instruction-specific checklists raised exact LLM–human agreement from 46.4% to 52.2%. Giving the checklists to *human* raters raised inter-annotator agreement from 0.194 to 0.256.
- *Stage:* Compile and calibrate (human labeling).
- *Borrow:* Show the Rubric to the human labeler too, so they label per Criterion and not just keep/reject. The TICK result suggests this makes labels more consistent.
- *Caveats:* Gains are modest in absolute terms, and the work is text-only.

**[S9] RubricBench.** Zhang et al., ACL 2026. [arXiv:2603.01562](https://arxiv.org/abs/2603.01562)
- *Finding:* Self-generated rubrics trail human ones by ~27 points (e.g. DeepSeek-v3.2 57.8% vs 84.9%). Models "waste their generation budget on tangential rubrics" (>70% hallucination rate) while "missing nearly half of the critical constraints". They write rules "overly strict without being necessary, or necessary but insufficiently specified". Even with correct rubrics, models "fail to enforce them as binding constraints".
- *Stage:* Compile and confirm.
- *Borrow:* Trace every Criterion to a source phrase. Put unrequested Criteria in an off-by-default "suggested" group. Have a human confirm before running. Enforce hard Criteria in Winnow's code, not in Spark's head.
- *Caveats:* Pairwise text preference, not robot data. Numbers are from the HTML v1.

**[S10] Support Vector Rubrics (SVR).** Sun et al., Jun 2026. [arXiv:2606.08077](https://arxiv.org/abs/2606.08077)
- *Finding:* Good criteria must *separate* similar candidates, not just describe good ones. Learning rubric items from preference pairs closed the RubricBench gap from 24.1 to 0.3 points.
- *Stage:* Refine.
- *Borrow:* When refining, show Spark *pairs* of near-identical Episodes the human labeled differently, and ask what distinguishes them.
- *Caveats:* Needs much more preference data than 20 labels. Roadmap only.

**[S11] Rubrics as Rewards (RaR).** Gunjal et al., 2025. [arXiv:2507.17746](https://arxiv.org/abs/2507.17746)
- *Finding:* Rubric-structured judging beat Likert baselines (up to +31% on HealthBench) and "reduces performance variance across judge scales".
- *Stage:* Judge, and cost (supports judging on the cheaper Spark tier).
- *Borrow:* Evidence that atomic Criteria let a *smaller or cheaper* judge stay reliable, which backs the contributor-tier-first cascade.
- *Caveats:* Used for RL training rewards in medicine and science. Transfer to video is unverified.

**[S12] From Rubrics to Reliable Scores (RULERS).** Hong et al., Jan 2026 (rev. Sep 2026). [arXiv:2601.08654](https://arxiv.org/abs/2601.08654). An earlier version was titled "Rulers: Locked Rubrics and Evidence-Anchored Scoring for Robust LLM Evaluation".
- *Finding:* Judges "interpret the same criteria inconsistently". Locking a versioned rubric, requiring evidence-grounded judgments, and calibrating to human score boundaries each help. Gains depend on "the combination of fixed criteria, traceable evidence, and calibrated score interpretation".
- *Stage:* Judge and iterate.
- *Borrow:* Freeze a **Rubric version** for each run. Key cached Criterion results by `(criterion_id, params_hash, episode_id)` so editing one sentence re-runs only what changed (plan §5.7). Require each visual Criterion result to cite a timestamp.
- *Caveats:* Text scoring. Specific numbers not checked.

### Ambiguity and clarification

**[S13] nl2spec.** Cosler et al., 2023. [arXiv:2303.04864](https://arxiv.org/abs/2303.04864)
- *Finding:* An LLM translates English into temporal logic, and "LLMs map subformulas of the formalization back to the corresponding natural language fragments". Users fix ambiguity by editing sub-translations instead of rewriting the whole specification.
- *Stage:* Confirm and edit.
- *Borrow:* A `source_phrase` on each Criterion, shown as a highlighted span in the description. Edits happen on one Criterion's card.
- *Caveats:* The formal-methods audience is expert; Winnow users aren't.

**[S14] NL2TL.** Chen et al., 2023. [arXiv:2305.07766](https://arxiv.org/abs/2305.07766)
- *Finding:* Translation generalizes better on "lifted" NL/TL, where the atomic propositions are hidden. It reached >95% accuracy with <10% of the domain training data.
- *Stage:* Compile (schema design).
- *Borrow:* Split a Criterion into an *atomic predicate* (a primitive over a signal) and a *temporal shape* (always / eventually / count / longest run within a phase window). "Never drops the object during transport" is *always(holding) within transport*. This shapes the `window` and `aggregate` fields below.
- *Caveats:* Fine-tuned T5, not prompting.

**[S15] Structural-Ambiguity-Aware Translation from NL to STL.** Fushimi et al., Mar 2026. [arXiv:2603.28426](https://arxiv.org/abs/2603.28426)
- *Finding:* It outputs "a deduplicated set of STL candidates with plausibility scores", keeping attachment and scope ambiguity instead of picking one reading.
- *Stage:* Confirm.
- *Borrow:* For an ambiguous phrase, Spark may return two candidate Criteria, and the user picks one. Example: "no long pauses" might mean the whole Episode or only while transporting.
- *Caveats:* Grammar-based (CCG) pipeline, not an LLM prompt. Use the idea, not the method.

**[S16] CLAMBER.** Zhang et al., 2024. [arXiv:2405.12063](https://arxiv.org/abs/2405.12063)
- *Finding:* About 12K queries. LLMs have limited ability to identify ambiguity, and chain-of-thought and few-shot prompting "may result in overconfidence … and yield only marginal enhancements in identifying ambiguity."
- *Stage:* Compile and confirm.
- *Borrow:* Don't make clarification depend on Spark saying "this is ambiguous". Trigger questions structurally, on every defaulted threshold, and from the data.
- *Caveats:* Information-seeking queries, not specifications.

**[S17] Ambig-SWE.** Vijayvargiya et al., 2025 (rev. Feb 2026). [arXiv:2502.13069](https://arxiv.org/abs/2502.13069)
- *Finding:* Agents are weak at telling well-specified from underspecified instructions. Interaction on underspecified inputs improves performance "up to 74% over the non-interactive settings".
- *Stage:* Confirm.
- *Borrow:* Clarification is high-value even when detection is weak. Make asking cheap and bounded (≤3 questions), and on by default.
- *Caveats:* Software engineering tasks.

**[S18] GATE: Eliciting Human Preferences with Language Models.** Li, Tamkin, Goodman, Andreas, 2023. [arXiv:2310.11589](https://arxiv.org/abs/2310.11589)
- *Finding:* LM-driven elicitation (open questions, generated edge cases) was "often more informative than user-written prompts or labels", took "less effort than prompting or example labeling", and surfaced "novel considerations not initially anticipated by users".
- *Stage:* Confirm and calibrate.
- *Borrow:* Edge-case questions, with one twist: Winnow can show a *real* borderline Episode instead of a synthetic one.
- *Caveats:* Text domains (email validation, recommendation, moral reasoning).

### Refining from human labels

**[S19] EvalGen: Who Validates the Validators?** Shankar et al., 2024. [arXiv:2404.12272](https://arxiv.org/abs/2404.12272)
- *Finding:* The system generates candidate implementations of each criterion (Python functions *or* LLM grader prompts) and picks those that agree best with the user's grades. Users show "criteria drift": "some criteria appear dependent on the specific LLM outputs observed", so criteria can't all be defined up front.
- *Stage:* Calibrate and iterate.
- *Borrow:* (a) For each Criterion, choose among candidate thresholds, or measured vs tracked variants, by agreement with labels. (b) Plan for the Rubric to change *after* the user sees Episodes. Make "I rejected this, but every Criterion passed" a first-class prompt for a new Criterion.
- *Caveats:* Small user study. LLM-pipeline outputs, not robots.

**[S20] SPADE.** Shankar et al., 2024. [arXiv:2401.03038](https://arxiv.org/abs/2401.03038)
- *Finding:* Generates candidate assertions, then selects a minimal set that meets coverage and accuracy targets while minimizing false failures: 14% fewer assertions and 21% fewer false failures than baselines.
- *Stage:* Calibrate.
- *Borrow:* Treat redundant Criteria explicitly. If two Criteria reject the same Episodes, suggest merging them. Weigh the cost of falsely rejecting a good Episode, since good data is expensive (plan §2).
- *Caveats:* Assertions over LLM outputs.

**[S21] AutoCalibrate: Calibrating LLM-Based Evaluator.** Liu et al., 2023. [arXiv:2309.13308](https://arxiv.org/abs/2309.13308)
- *Finding:* A gradient-free loop. Human labels implicitly encode preferences, the LLM drafts scoring criteria from few-shot labeled examples, and the best drafts are selected and "re-draft[ed] with self-refinement". This significantly improved correlation with experts.
- *Stage:* Calibrate (roadmap: Muse Wonder rubric agent).
- *Borrow:* Draft, then select by label agreement, then refine. This is the loop for the rubric-improving agent on the slides.
- *Caveats:* Text quality evaluation, with many more labels than 20.

**[S22] LLM-Rubric.** Hashemi et al., ACL 2024. [arXiv:2501.00274](https://arxiv.org/abs/2501.00274)
- *Finding:* Feeds per-question LLM answer distributions through a small calibration network. That reached RMS error < 0.5 on a 1–4 satisfaction scale, a 2× improvement over uncalibrated.
- *Stage:* Triage (combining Criterion results).
- *Borrow:* Combining Criterion results into a Triage decision is itself something to calibrate. Roadmap: a logistic combiner over Criterion margins.
- *Caveats:* Needs more labels than Winnow's 10–20.

### Uncertainty and cost routing

**[S23] KnowNo: Robots That Ask for Help.** Ren et al., 2023. [arXiv:2307.01928](https://arxiv.org/abs/2307.01928) · [project page](https://robot-help.github.io/)
- *Finding:* Conformal prediction over LLM options gives "statistical guarantees on task completion while minimizing human help". The robot asks for help when the prediction set "is not a singleton".
- *Stage:* Triage (uncertainty margin).
- *Borrow:* Roadmap: set each Criterion's margin by conformal calibration on labeled Episodes, so Keep and Reject outside the margin carry a target error rate. This week, "Needs review" plays the role of a non-singleton set.
- *Caveats:* Needs an exchangeable calibration set. Specific help-rate numbers UNVERIFIED (not on the pages read).

**[S24] FrugalGPT.** Chen, Zaharia, Zou, 2023. [arXiv:2305.05176](https://arxiv.org/abs/2305.05176)
- *Finding:* An LLM cascade can "match the performance of the best individual LLM … with up to 98% cost reduction".
- *Stage:* Compile (routing) and judge.
- *Borrow:* Justifies the evidence ladder: robot data (free), then SAM tracks ($0.20/1k frames), then Spark video. Escalate only when the cheaper source is unsure.
- *Caveats:* Routes between LLMs, not between evidence modalities.

**[S25] ViperGPT** (Surís et al., 2023, [arXiv:2303.08128](https://arxiv.org/abs/2303.08128)) **and VisProg** (Gupta & Kembhavi, 2022, [arXiv:2211.11559](https://arxiv.org/abs/2211.11559))
- *Finding:* An LLM composes vision modules through a provided API. ViperGPT generates Python "that is later executed". VisProg generates "python-like modular programs" that invoke a set of modules.
- *Stage:* Compile (tracked Criteria).
- *Borrow:* VisProg's restricted, interpreted module language is the safe middle ground: Spark composes primitives, Winnow interprets them, and nothing is `eval`'d.
- *Caveats:* Neither page discusses the safety of running generated code. VisProg's module count wasn't checked.

**[S26] DQAF: Episode-Level Data Quality Assessment and Feedback.** Narayanan et al., May 2026. [arXiv:2605.26349](https://arxiv.org/abs/2605.26349)
- *Finding:* Per-Episode signals (sub-task progress, motion smoothness, stalls, kinematic limits) are turned into structured assessments and natural-language feedback. Performance "compared favorably with human reviewers".
- *Stage:* Primitive catalog.
- *Borrow:* Confirms which robot-data primitives teams care about. Winnow's difference is user-chosen Criteria and thresholds.
- *Caveats:* Thresholds not given on the abstract page. Fixed signal set (plan §4 already notes this).

---

## 3. Recommendations

Ranked by value per hour this week.

1. **Typed, executable Criteria (one source of truth).** *Build this week.* Replace free-text `check` with `primitive` + `params` + `comparator` + `threshold` + `unit` + `margin` + `window`. Spark's structured output gets an `enum` of primitive names. Winnow validates the params per primitive in Pydantic and renders the English from the fields. This removes the 0.5-vs-0.2 drift. [S1, S3, S25]
2. **Dry run at confirm time.** *Build this week.* As soon as Spark returns, run every measured Criterion (and tracked ones, if tracks are cached) on all Episodes. Each Criterion card shows its pass rate, a value histogram with the threshold and margin band, sanity warnings (≈0% or ≥95% rejected), and a VLM-CaR check: does it pass the dataset's known successes? Visual Criteria show "not yet run (≈$X)". [S2, S6]
3. **Source-phrase traceability, plus a "suggested" group.** *Build this week.* Each Criterion carries `source_phrase`, and the UI highlights it in the description. Phrases no Criterion covers are highlighted as uncovered. Criteria Spark invents start off disabled. [S9, S13]
4. **Validation-repair loop.** *Build this week.* If a Criterion fails validation (unknown primitive, bad unit, missing target object), send the Pydantic errors back to Spark once. If it still fails, convert it to a visual Criterion with Spark's question, or mark it "can't measure this yet". Never drop it silently. [S3]
5. **Bounded, data-anchored clarifying questions.** *Build this week (light).* Ask at most 3, chosen by (a) Criteria whose threshold Spark defaulted (`assumed: true`), ranked by (b) how many Episodes fall inside the margin. Each question shows a real borderline Episode and answers with Yes or No, which also records a label. Spark may also return two candidate readings for one phrase. [S15, S16, S17, S18]
6. **Fit thresholds and margins from labels.** *Build this week (simple version).* For each measured or tracked Criterion, sweep the threshold over observed values and pick the one with the best balanced agreement with labeled Episodes. Set `margin` to the band where labeled good and bad Episodes overlap, with a floor at sensor noise. Report agreement with an error bar, because with 20 labels the interval is wide. [S19, S20]
7. **Visual Criteria as atomic yes/no/unsure questions with scope.** *Build this week.* Each has `question`, `camera`, `window`, and optional `focus_track` (crop to SAM box). Split compound checks: "rests inside target" and "doesn't fall out after release" are separate questions. The result must cite a timestamp. [S7, S8, S12]
8. **Stable Criterion ids and a locked Rubric version per run.** *Build this week.* Cache key `(criterion_id, params_hash, episode_id)`. When a sentence is edited, recompile, match old Criteria by `source_phrase`/id, and re-run only the changed ones. This is the "instant re-sort" moment. [S12]
9. **Criterion reflection to Spark.** *Stretch.* After the dry run, send Spark the pass rates and quantiles and ask whether any threshold looks mis-set. One turn, and the user still confirms. [S2]
10. **Propose new Criteria from disagreements.** *Roadmap/slides (stretch if time).* When a human rejects an Episode that passes every Criterion, ask why (voice), and Spark drafts a Criterion from that answer and a contrasting kept Episode. [S10, S19, S21]
11. **Temporal composition language.** *Roadmap/slides.* A small interpreted DSL: predicate over signal, then temporal operator (always / eventually / count / longest-run) over phase window. It replaces the growing primitive list. [S13, S14, S25]
12. **Conformal margins and a learned Triage combiner.** *Roadmap/slides.* [S22, S23]
13. **Do not** generate and run free-form Python this week. If ever: Spark proposes a *new primitive* as code, a human reviews it, and it merges into the library like any PR. [S2, S4, S25]

### 3a. Recommended compile → confirm → edit loop

```
Describe ──► Compile (Spark, 1 call + ≤1 repair)
              input: description + capabilities manifest
                     (signals, units, fps, camera list + 320×180 resolution,
                      tracked concepts available, primitive catalog with
                      signatures, units, typical ranges, 3 few-shot examples)
              step A: restate each clause as one precise English sentence with numbers  [L2R motion descriptor]
              step B: map each sentence to one Criterion (typed primitive call)          [L2R reward coder]
              output: Rubric JSON (+ assumptions, + ≤3 candidate questions, + suggested)
         ──► Validate (Pydantic) ─ errors ─► repair turn ─► still bad → visual Criterion / "unsupported"
         ──► Dry run (free): measured (+cached tracked) Criteria on all Episodes;
              pass rates, histograms, sanity flags, check on dataset-labeled Episodes
         ──► Confirm screen
              • description with each phrase linked to its Criterion card; uncovered phrases highlighted
              • card = rendered English, threshold slider, margin band on histogram, hard/soft, rejects N/100
              • ≤3 questions, each anchored to a real borderline Episode (answer = label)
              • "Suggested" Criteria, off by default
         ──► Edit (two paths, both instant)
              • drag a threshold / toggle hard-soft      → no LLM call, re-sort from cache
              • edit the sentence ("pauses are fine")    → recompile, diff by Criterion id, re-run only changed
         ──► Run (lock Rubric version) → Triage decisions
         ──► Calibrate: labels fit thresholds + margins; "rejected but all passed" → propose new Criterion
```

The loop costs one Spark call (two at worst) before anything visual runs. Everything else on the confirm screen is free.

### 3b. Review of the Criterion schema in `docs/feasibility/rubric.json`

Current fields: `name`, `kind`, `hard`, `check`, `signals`.

| Problem in the Day-1 Rubric | Field to add or change |
|---|---|
| `check` is prose, its numbers aren't what runs (0.5 vs 0.2; 0.02 m/s/2 s vs 0.01 m/s/1 s) | `primitive` (enum), `params` (typed per primitive), `comparator` (`<`, `<=`, `==`, `>=`, `>`, `in_range`), `threshold`, `unit`. Keep `check` only as *rendered* text. |
| No uncertainty band (plan §5.4 "measurement close to a threshold") | `margin` (same unit as threshold). A value within ±margin gives result **unsure**. |
| Phase is implicit in prose ("after first close until re-open", "at episode end") | `window`: `whole` / `approach` / `grasp` / `transport` / `release` / `last_n_s` / `first_n_s`, derived from gripper closures. |
| Temporal shape implicit | `aggregate`: `always` / `ever` / `count` / `longest_run_s` / `at_end` / `max` / `mean` |
| Single-grasp test fails on both 0 and ≥2 closures, so "never grasped" and "re-grasped" give one message | Either two Criteria, or `fail_reasons` keyed by comparator side, so the explanation is specific. |
| Pixel threshold (100 px) with no resolution context, and "and/or" logic | Normalize image distances by box size or frame diagonal (`unit: "box_widths"` or `"frac_diag"`). Allow one predicate per Criterion. |
| Which camera? Tracks come from "one exterior camera" | `camera` (`exterior_1` / `exterior_2` / `wrist`), and `concepts` (SAM prompts, e.g. `["robot gripper", "black remote"]`). |
| Target object or region unnamed ("inside target") | `target` (SAM concept or "from task instruction"), resolved at compile time from the Episode's instruction. |
| Soft Criteria have no weight | `weight` (soft only), with a documented combination rule. |
| No link to the user's words | `source_phrase` (exact substring of the description) and stable `id`. |
| Silent defaults for vague words | `assumed: bool` + `assumption` text ("'long' taken as > 2 s"), which feeds the clarifying questions. |
| Missing signal or lost track | `on_missing: "unsure"` (default) / `"fail"` / `"pass"`. Lost tracking feeds the Needs review uncertainty signal. |
| Visual checks lack a question or scope | `question` (yes/no), `camera`, `window`, `focus_track`. The answer schema is `yes` / `no` / `unsure` + `timestamp_s` + `reason`. |
| `signals` is free text | Drop it; the primitive implies it. Or turn it into an enum checked against the manifest. |
| Rubric-level | `version`, `description`, `assumptions[]`, `questions[]`, `uncovered_phrases[]`, `suggested[]` |

Sketch of one Criterion after the change, for illustration only (names are proposals):

```json
{
  "id": "no-long-pauses",
  "source_phrase": "no long pauses",
  "name": "No long pauses",
  "kind": "measured",
  "hard": false,
  "weight": 1.0,
  "primitive": "longest_still_s",
  "params": { "speed_below_m_s": 0.01 },
  "window": "whole",
  "comparator": "<",
  "threshold": 2.0,
  "unit": "s",
  "margin": 0.4,
  "assumed": true,
  "assumption": "\"long\" taken as more than 2 s with the arm nearly still",
  "on_missing": "unsure"
}
```

A JSON-Schema `oneOf` keyed by primitive would let Spark's structured output enforce per-primitive params. Whether the Meta API's `json_schema` format honors `oneOf`/`anyOf` is UNVERIFIED. The fallback is a flat `params` object validated by Pydantic plus the repair turn.

### 3c. Proposed measurement primitives (function tools)

Each primitive returns `{value, unit, frames: [start, end] | timestamps, reliability}`, so the Evidence (timestamps, the frame where it went wrong) comes for free. `reliability` (e.g. track coverage) feeds Needs review. Windows come from gripper-derived phases.

**Robot data (measured; free).** droid_100 has end-effector xyz and gripper only. Joint states exist only in droid_1.0.1.

| Primitive | Returns | Covers | Status |
|---|---|---|---|
| `phases()` | approach / grasp / transport / release / retreat intervals from gripper closures | windows for every other primitive | new (from `closures`) |
| `grasp_attempts(closed_above)` | number of closures | "first try" | exists as `regrasp_count` (+1) |
| `longest_still_s(speed_below_m_s, smooth_n)` | seconds | "no long pauses" | exists as `longest_pause_s`; expose params |
| `still_fraction(speed_below_m_s)` | 0–1 | "hesitant", "idle" | new |
| `active_duration_s()` | first motion → last release, s | "quick", "efficient" | new (trivial) |
| `path_length_m(window)` / `path_efficiency(window)` | m / straight-line ÷ actual | "direct path", "no wandering" | new |
| `jerk_rms(window)` (or a dimensionless smoothness metric) | m/s³ (or unitless) | "smooth" | new. Pick one metric and document it. |
| `max_speed_m_s(window)` | m/s | "careful", "not jerky" | new |
| `release_height_m()` | m above grasp height | "places, doesn't drop" | exists |
| `ends_open()` | bool | "lets go at the end" | new (trivial) |
| `gripper_closed_level(window)` | median gripper state while closed | possible "holding something" signal (closed on air would read ~1.0) | **experiment first** (see §4) |

**Tracks (tracked; SAM 3.1 cost, cached).**

| Primitive | Returns | Covers |
|---|---|---|
| `track_coverage(concept, camera)` | fraction of frames with a box | reliability; low means unsure |
| `gripper_object_gap(window)` | longest run (s) with centre gap > k box-widths | "never drops", "object stays in hand" |
| `object_moved(concept)` | start→end displacement (box widths) | "actually moved the object", plus a cross-check for gripper "closed on nothing" |
| `object_moves_without_gripper(window)` | seconds the object moves while gripper box is far | "slipped", "knocked over" |
| `contained_at_end(object, target, last_n_s)` | fraction of object box inside target box | "inside the target" (cheaper first pass before visual) |
| `object_settles(last_n_s)` | box motion after release | "doesn't fall or roll out" |

**Video (visual; Spark).**

| Tool | Returns |
|---|---|
| `ask_video(question, camera, window, focus_track?)` | `yes` / `no` / `unsure` + `timestamp_s` + `reason`. Crop or mask to the SAM box when `focus_track` is set. |

**Introspection (lets Spark compile against what exists).**

| Tool | Returns |
|---|---|
| `describe_dataset()` | signals, units, fps, cameras and resolution, Episode count, which concepts are tracked/cached |
| `preview_criterion(criterion)` | pass rate + quantiles over all Episodes (the dry run). Lets Spark self-check thresholds in one turn. |

**Routing rule for the compile prompt.** Use the cheapest kind that can *decide* the Criterion. Measured if robot data alone settles it. Tracked if it needs where an object is. Visual only for semantics no box can capture (e.g. "grasped by the handle"). For hard Criteria where a cheap source is known to be weak, declare an `escalate_to` (e.g. `contained_at_end` → `ask_video`) that runs only when the cheap result is unsure. [S24]

---

## 4. Open questions worth a quick experiment

1. **Compile stability and primitive choice (≈$0.05, 30 min).** Compile 8 descriptions three times each against the primitive catalog: the hero sentence; "pauses are fine"; "smooth and direct"; "grasped by the handle"; "never touches other objects"; one vague ("clean, confident pick"); one impossible from this data ("gentle force"); one compound. Measure: the same primitives and thresholds across runs? Correct `kind`? Does the impossible one come back "unsupported" instead of invented? [S9, S12]
2. **Does gripper state alone reveal an empty grasp in DROID?** Plot gripper state over time for Episode 42 (failed grasps) vs the true successes. If closed-on-air saturates near 1.0 while closed-on-object plateaus lower, "grasp holds the object" becomes a free *measured* Criterion, and a strong cross-check against SAM. UNVERIFIED for DROID's gripper.
3. **Whose thresholds are right?** On the ~100 Episodes, compare pass rates under Spark's thresholds (0.5; 0.02 m/s for 2 s, smoothed) and `measured.py`'s (0.2; 0.01 m/s for 1 s). Check both against the dataset success labels. This shows how much LLM-defaulted thresholds matter, and is a good slide.
4. **Does Spark flag ambiguity on its own?** Using the same 8 descriptions, ask for `questions[]`. Compare against the structural trigger (assumed thresholds ranked by margin density). CLAMBER and Ambig-SWE predict the structural trigger wins. [S16, S17]
5. **How many labels until thresholds stop moving?** With 20 labeled Episodes, refit thresholds on random subsets of 5/10/15. Report the variance. That gives an honest error bar for "label 20, curate 2,000".
6. **Does Criterion reflection help?** Give Spark the dry-run quantiles once and see whether it moves obviously mis-set thresholds (e.g. a Criterion rejecting 0%). It costs one call. [S2]
7. **Visual question granularity vs cost.** Is one compound visual question per Episode ("rests fully inside, not on rim, not falling out") as accurate as two atomic ones on the 5 feasibility Episodes? The atomic version costs twice the video tokens unless both questions share one call with a multi-field answer schema. [S7, S8]
