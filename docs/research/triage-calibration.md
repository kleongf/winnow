# Research: triage, uncertainty, and calibration from few labels

Track: how Winnow turns Criterion results into a Triage decision (Keep, Reject, Needs review), how confident it can honestly claim to be with 10–20 human labels on about 100 Episodes, and how to measure Spark alone against Winnow. Informs plan §5 steps 4–5, §8 (bar to beat), and §12 (evaluation). Researched 2026-10-27. Every number below comes from a source I opened, or from my own arithmetic (marked "computed").

---

## 1. Bottom line

1. **Stop promising "estimated precision 0.92 ± 0.06" from 20 labels; that is arithmetically impossible.** A ±0.06 interval at about 0.92 needs about 80–100 audited Episodes (computed: Wilson 95% half-width is ±0.060 at n = 100, ±0.137 at n = 20). With 15 audited Keeps the honest display is *"15 of 15 audited Keeps were good. Precision ≥ 0.86 (90% confidence)"* or *"14 of 15 → 0.93, 95% CI 0.70–0.99"*. Show the count, the point estimate, and an asymmetric interval. Finite-sample guarantees at α = 0.1 need at least 22 error-free labeled decisions (computed; matches Table 1 of Angelopoulos & Bates, n(ε = 0.1) = 22), so with ≤ 20 labels Winnow can *report* intervals but cannot *guarantee* a precision level. Say "tuned on 20 labels", not "guaranteed".
2. **Use two separate label streams.** *Review* labels are spent on Needs review Episodes, least confident first; they finalize those Episodes and tune the unsure bands. *Audit* labels are a seeded uniform random sample from the auto-Keep pile; only these feed the precision estimate. Active-learned labels are biased toward hard cases, which breaks the exchangeability that conformal, Wilson, and Learn-then-Test all assume. Mixing the streams makes every on-screen number wrong. Active testing and active statistical inference show how to reuse biased labels with importance weights; leave that for the roadmap.
3. **Get Spark's confidence from agreement across K samples, not from a verbalized number.** For LLM judges, verbalized confidence barely ranks right answers above wrong ones: AUROC 0.550 for a GPT-4 judge on AlpacaEval, against 0.723 for a 5×5 ensemble of "simulated annotators" (Trust or Escalate, Table 1). For triage, the ranking (AUROC) is what matters: a few labels can fix a miscalibrated probability scale, but they cannot fix a bad ordering. Spark's contributor tier cost about $0.001 per Episode call in the feasibility run, so K = 3 costs about $0.003 per Episode per visual Criterion.
4. **Keep the Triage decision rule simple and explainable: a "weakest link" over hard Criteria, with a crisp/unsure band on each Criterion.** Reject if any hard Criterion fails crisply; Keep if every hard Criterion passes crisply; otherwise Needs review. A cross-signal disagreement (for example, gripper data versus SAM track, or Spark versus Glimmer) forces its Criterion to unsure. Calibration tunes only the band widths (one or two knobs, chosen from a small pre-registered grid), never a per-Criterion learned model. Weak-supervision label models (Dawid–Skene, Snorkel, FlyingSquid) fit only where three or more signals measure the *same* property, such as "object dropped". Don't use them to combine different Criteria.
5. **Measure the Spark-alone comparison at matched coverage, with paired counts, and report the "said success on a true failure" rate with a Wilson interval.** If Winnow's Needs review Episodes are dropped from its accuracy while Spark alone is scored on every Episode, the comparison is cherry-picked. Report three things on adjudicated labels for the same ~100 Episodes: (a) both risk–coverage curves, (b) Winnow-with-Needs-review-forced-to-Keep, and (c) the discordant pairs. FailBench reports a qualitative bias toward "success" under ambiguous evidence. That bias is the failure mode Winnow's Needs review exists to catch, so measure it directly.

---

## 2. Sources

Format: **citation** · finding · Winnow stage · idea to borrow · caveats.

### Selective prediction and risk–coverage

- **Geifman & El-Yaniv, "Selective Classification for Deep Neural Networks", NeurIPS 2017.** https://arxiv.org/abs/1705.08500
  - Finding: given a desired risk, a reject option (the "SGR" algorithm) picks a confidence threshold so that error on accepted inputs stays below a target with high probability. Their example: "2% error in top-5 ImageNet classification can be guaranteed with probability 99.9%, and almost 60% test coverage."
  - Stage: Triage (step 4).
  - Borrow: the framing that a Triage decision is a selective classifier, so Needs review is the reject option, and risk is measured only over auto-decided Episodes.
  - Caveat: the guarantees need large calibration sets; SGR uses Bonferroni-style bounds that are loose at small n.
- **Geifman, Uziel & El-Yaniv, "Bias-Reduced Uncertainty Estimation for Deep Neural Classifiers", ICLR 2019.** https://arxiv.org/abs/1805.08206
  - Finding: defines coverage φ = E[g(x)], selective risk = E[ℓ·g]/φ, the risk–coverage (RC) curve, and AURC = (1/n) Σ over thresholds of the empirical selective risk. It also defines E-AURC, which subtracts the AURC of the best confidence function in hindsight.
  - Stage: evaluation (§12) and the results slide.
  - Borrow: these exact definitions for Winnow's RC curve and AURC (formulas in §3, R5).
  - Caveat: AURC from 100 Episodes is noisy; show the curve, not just the number.

### Conformal prediction, risk control, and small calibration sets

- **Angelopoulos & Bates, "A Gentle Introduction to Conformal Prediction and Distribution-Free Uncertainty Quantification", 2021–22.** https://arxiv.org/abs/2107.07511
  - Finding: the coverage guarantee holds for any n, but the coverage *conditional on the calibration set* is distributed as Beta(n+1−l, l), with l = ⌊(n+1)α⌋ (§3.2). Table 1: for δ = 0.1 and α = 0.1, coverage within ±ε = 0.1 needs n = 22, and ±0.05 needs n = 102. §5.5 (selective classification) picks a threshold by scanning a binomial upper confidence bound R̂⁺(λ) on selective error and stopping at the last λ where it is still ≤ α (Proposition 4: holds with probability 1−δ). The tutorial notes that selective accuracy is "not monotone in the cutoff λ", which is why it needs Learn-then-Test.
  - Stage: calibrate (step 5).
  - Borrow: the §5.5 procedure for tuning the unsure band, and the Beta formula to show how much realized coverage can wobble with 15 labels (computed: n = 15, α = 0.2 gives a 5–95% range of 0.64–0.94).
  - Caveat: the authors' rule of thumb is n ≈ 1000; with 10–20 labels, the guarantee holds only on average over calibration draws.
- **Angelopoulos, Bates, Fisch, Lei & Schuster, "Conformal Risk Control", ICLR 2024.** https://arxiv.org/abs/2208.02814
  - Finding: for a monotone loss bounded by B, choose λ̂ = inf{λ : n/(n+1)·R̂ₙ(λ) + B/(n+1) ≤ α}. Then E[L] ≤ α (Theorem 1), and the result is tight to within 2B/(n+1) (Theorem 2). For non-monotone losses, "this algorithm does not control the risk" (§2.4).
  - Stage: calibrate.
  - Borrow: the B/(n+1) penalty shows the cost of small n. With n = 15 and B = 1, the penalty alone is 0.0625 of risk budget before seeing any errors (computed).
  - Caveat: selective error is not monotone in the threshold, so plain CRC does not apply to Triage. Use the LTT or fixed-sequence form instead.
- **Angelopoulos, Bates, Candès, Jordan & Lei, "Learn then Test", 2021.** https://arxiv.org/abs/2110.01052 · code https://github.com/aangelopoulos/ltt
  - Finding: recasts threshold selection as multiple hypothesis testing, which gives finite-sample risk control for arbitrary (non-monotone) risks without retraining.
  - Stage: calibrate.
  - Borrow: test a *small, pre-registered* grid of band widths from most to least conservative, so threshold tuning can't overfit (fixed-sequence testing).
  - Caveat: power at n ≤ 20 is very low; expect only the most conservative settings to pass.
- **Jung, Brahman & Choi, "Trust or Escalate: LLM Judges with Provable Guarantees for Human Agreement", ICLR 2025.** https://arxiv.org/abs/2407.18370
  - Finding: selective evaluation with an exact binomial upper bound and fixed-sequence testing (Eqs. 3–5, Theorem 1). Table 1 shows that for a GPT-4-turbo judge on AlpacaEval, verbalized confidence reaches AUROC 0.550, predictive probability 0.642, and Simulated Annotators (K = N = 5 few-shot "annotator" prompts, with confidence = agreement) 0.723. The abstract claims "over 80% human agreement with almost 80% test coverage" with cascaded cheaper judges. Experiments use |D_cal| = 500 and δ = 0.1.
  - Stage: triage and confidence elicitation, plus the Spark → Glimmer cascade.
  - Borrow: (1) agreement across K diverse prompts as Spark's confidence; (2) the cascade, where a cheap judge decides and escalates only when unsure; (3) the fixed-sequence threshold scan.
  - Caveat: 500 calibration labels, not 20; the domain is text preference, not robot video.
- **Jin, Tao, Yu & Huang, "Margin-Adaptive Confidence Ranking for Reliable LLM Judgement", ICML 2026.** https://arxiv.org/abs/2605.15416
  - Finding: argues that Trust or Escalate's assumption (confidence monotone in disagreement risk) "may not hold in practice", and trains a margin-based confidence ranker to fix it.
  - Stage: roadmap.
  - Borrow: check monotonicity on the eval set by plotting the RC curve. If risk rises as coverage *shrinks*, the confidence signal is broken.
  - Caveat: needs training data that Winnow doesn't have. Only the abstract was read.
- **Ren et al., "Robots That Ask For Help" (KnowNo), CoRL 2023.** https://arxiv.org/abs/2307.01928 · https://robot-help.github.io/
  - Finding: builds conformal prediction sets over an LLM planner's multiple-choice options and asks a human for help when the set "is not a singleton". The calibration set is N = 400 with δ = 0.01, and "labeling the calibration data takes about 4 hours (for 400…)". On hardware, it reduced the human help rate "by 14% step-wise and 8% trial-wise".
  - Stage: Triage framing for the pitch.
  - Borrow: the slide line "Winnow asks for help when both Keep and Reject remain plausible". A two-class conformal set {Keep, Reject} is exactly a selective classifier.
  - Caveat: 400 labels; this is a pitch analogy, not a guarantee Winnow can claim at 20 labels.

### Precision with an error bar, and comparing two judges

- **Brown, Cai & DasGupta, "Interval Estimation for a Binomial Proportion", Statistical Science 16(2), 2001.** https://doi.org/10.1214/ss/1009213286 · abstract at https://asaip.psu.edu/?p=677
  - Finding: the Wald interval has "chaotic coverage properties". The authors recommend "the Wilson interval or the equal-tailed Jeffreys prior interval for small n".
  - Stage: on-screen precision.
  - Borrow: Wilson as the two-sided interval. Add the one-sided Clopper–Pearson lower bound, which in the all-correct case is simply δ^(1/n).
  - Caveat: I verified only the abstract-level recommendation, not the full text. Clopper–Pearson is conservative (standard; UNVERIFIED in this paper).
- **Angelopoulos, Bates, Fannjiang, Jordan & Zrnic, "Prediction-Powered Inference", Science 2023.** https://arxiv.org/abs/2301.09633
  - Finding: θ̂_PP = (1/N)Σ f(X̃ᵢ) − (1/n)Σ (f(Xᵢ) − Yᵢ), with 95% CI θ̂_PP ± 1.96·√(σ̂²_{f−Y}/n + σ̂²_f/N). It is valid for any model f and tighter than classical inference when f is accurate (§1.3).
  - Stage: dataset-scale precision (the "Label 20, curate 2,000" claim).
  - Borrow: use Winnow's per-Episode P(good) as f over all N auto-Keeps, and the audit labels as the rectifier.
  - Caveat: if f is a hard 0/1 Keep decision, then σ²_f = 0 inside the Keep pile and PPI collapses to the classical estimate. It only helps when f is a graded probability. It is also CLT-based, so it is shaky at n ≈ 15.
- **Angelopoulos, Duchi & Zrnic, "PPI++: Efficient Prediction-Powered Inference", 2023.** https://arxiv.org/abs/2311.01453
  - Finding: power-tuned PPI "always improve[s] on classical intervals using only the labeled data".
  - Stage: roadmap precision estimate.
  - Borrow: if PPI is used, use PPI++ so a bad f never makes the interval worse.
  - Caveat: the guarantees are asymptotic.
- **Lee, Zeng, Jeong, Sohn & Lee, "How to Correctly Report LLM-as-a-Judge Evaluations", ICML 2026.** https://arxiv.org/abs/2511.21140
  - Finding: a naive judge-measured rate is biased. Their fix is the Rogan–Gladen correction θ̂ = (p̂ + q̂₀ − 1)/(q̂₀ + q̂₁ − 1), with q₁ = sensitivity and q₀ = specificity estimated from a human-labeled calibration set. The CI (their Eq. 6–8) propagates test and calibration uncertainty with +2 / +z² adjustments.
  - Stage: evaluation, and the "X% of this dataset is failures" slide.
  - Borrow: when reporting dataset-level rates from Winnow's judgments ("23% of DROID 'successes' fail the Rubric"), correct them with q̂₀ and q̂₁ from the adjudicated eval set.
  - Caveat: with only about 30 failures in the eval set, q̂₀ is uncertain (computed: 12/30 has a Wilson 95% CI of 0.25–0.58), so the corrected rate will be wide.
- **Dietterich, "Approximate Statistical Tests for Comparing Supervised Classification Learning Algorithms", Neural Computation 1998.** https://web.engr.oregonstate.edu/~tgd/publications/dietterich-approximate-statistical-tests-nc1998.pdf
  - Finding: for algorithms that can be run only once, McNemar's test is the only test studied with acceptable type I error (verified via the search summary and paper listing; full text not re-read: partially UNVERIFIED).
  - Stage: Spark-alone versus Winnow.
  - Borrow: report discordant pairs b (Winnow right, Spark wrong) and c (the reverse) with an exact binomial p-value.
  - Caveat: at 100 Episodes it has low power. Computed: b = 10, c = 3 gives p = 0.09. Show the counts, and don't claim significance unless it holds.

### Choosing which Episodes to label

- **Kossen, Farquhar, Gal & Rainforth, "Active Testing: Sample-Efficient Model Evaluation", ICML 2021.** https://arxiv.org/abs/2103.05331
  - Finding: actively choosing test points to label biases the estimate; importance weighting "remove[s] this bias while reducing the variance".
  - Stage: calibrate (audit).
  - Borrow: if audit labels are ever chosen non-uniformly, weight them by 1/q(selection).
  - Caveat: this week, simpler is better: keep audit sampling uniform.
- **Zrnic & Candès, "Active Statistical Inference", ICML 2024.** https://arxiv.org/abs/2403.03208
  - Finding: label where the model is unsure and rely on it where it is confident, with "provably valid confidence intervals" and fewer labels than uniform sampling.
  - Stage: roadmap, for merging the review and audit streams.
  - Borrow: the principled version of "label 20, curate 2,000".
  - Caveat: asymptotic; adds implementation risk this week.
- **Hacohen, Dekel & Weinshall, "Active Learning on a Budget: Opposite Strategies Suit High and Low Budgets", ICML 2022.** https://arxiv.org/abs/2202.02794
  - Finding: at low budgets, labeling *typical* examples beats labeling uncertain ones; the ordering flips at high budgets.
  - Stage: calibrate (review queue).
  - Borrow: seed the first 3–5 review labels with typical Episodes (for example, the highest-confidence Keep and Reject) so the user sees what "good" looks like, then switch to least-confident first.
  - Caveat: the evidence comes from image classifiers training representations, not from threshold tuning.

### Fusing noisy signals

- **Dawid & Skene, "Maximum Likelihood Estimation of Observer Error-Rates Using the EM Algorithm", JRSS C 28(1):20–28, 1979.** https://ideas.repec.org/a/bla/jorssc/v28y1979i1p20-28.html
  - Finding: EM estimates each observer's error rates without the true labels.
  - Stage: Criterion fusion (roadmap).
  - Borrow: treat gripper data, the SAM track, and Spark as three "observers" of one latent fact ("object dropped").
  - Caveat: needs many items that carry the event; a few drops among 100 Episodes is thin. I verified bibliographic details only.
- **Ratner et al., "Snorkel: Rapid Training Data Creation with Weak Supervision", VLDB 2018.** https://arxiv.org/abs/1711.10160
  - Finding: learns the accuracies and correlations of labeling functions "without access to ground truth" and denoises them into probabilistic labels.
  - Stage: Criterion fusion (roadmap).
  - Borrow: the concept of a label model, and the idea that abstaining labeling functions are normal.
  - Caveat: built for many labeling functions voting on *one* label. Winnow's Criteria check *different* properties, so they are not votes on a shared label and a label model doesn't apply across Criteria.
- **Fu, Chen, Sala, Hooper, Fatahalian & Ré, "Fast and Three-rious: Speeding Up Weak Supervision with Triplet Methods" (FlyingSquid), ICML 2020.** https://arxiv.org/abs/2002.11955 · https://github.com/HazyResearch/flyingsquid
  - Finding: closed-form parameter recovery from triplets of conditionally independent sources, "170 times faster on average" than SGD-based label models. Install with `pip install flyingsquid`; the last noted update is 2020.
  - Stage: roadmap.
  - Borrow: if one Criterion has three independent signals, a triplet model gives each signal's accuracy with no labels. That makes a good slide line: "Winnow learns how much to trust each sensor."
  - Caveat: the conditional-independence assumption is shaky (SAM and Spark see the same pixels), and the repo is unmaintained.

### Getting confidence out of Spark and Glimmer

- **Tian et al., "Just Ask for Calibration", EMNLP 2023.** https://arxiv.org/abs/2305.14975
  - Finding: for RLHF models, "verbalized confidences … are typically better-calibrated than the model's conditional probabilities (estimated via sampling)", "often reducing expected calibration error (ECE) by over 50%". Asking for top-k guesses before the confidence helps.
  - Stage: confidence elicitation.
  - Borrow: if a verbalized confidence is used at all, ask for it after "list the ways this Episode could have failed".
  - Caveat: the evaluation is on ECE for QA. ECE can be fixed post hoc; ranking (AUROC) is what triage needs, and for judges ranking is where verbalized confidence fails (see Trust or Escalate).
- **Xiong et al., "Can LLMs Express Their Uncertainty?", ICLR 2024.** https://arxiv.org/abs/2306.13063
  - Finding: verbalized confidences "predominantly fall within the 80% to 100% range … in multiples of 5". GPT-4's vanilla verbalized AUROC averages "merely 62.7%". Sampling 5 responses and measuring consistency improves failure prediction (§5.3). "None of these techniques consistently outperform others."
  - Stage: confidence elicitation.
  - Borrow: K-sample consistency as the default confidence signal.
  - Caveat: text tasks, 2023 models.
- **Kadavath et al., "Language Models (Mostly) Know What They Know", 2022.** https://arxiv.org/abs/2207.05221
  - Finding: P(True) self-evaluation is reasonably calibrated in large models, and it "improves when we allow models to consider many of their own samples before predicting the validity" of one (§4.2).
  - Stage: escalation prompt.
  - Borrow: on escalation, show Spark its own K short answers and ask for a final call.
  - Caveat: P(True) needs token probabilities, which Spark may not expose (UNVERIFIED; see §4).
- **Lyu et al., "Calibrating Large Language Models with Sample Consistency", AAAI 2024 (per fetched summary).** https://arxiv.org/abs/2402.13904
  - Finding: "consistency-based calibration methods outperform existing post-hoc approaches"; more samples and explanations help, while instruction-tuning makes calibration harder.
  - Stage: confidence elicitation.
  - Borrow: agreement fraction as Spark's confidence.
  - Caveat: reasoning datasets, not video.
- **Groot & Valdenegro-Toro, "Overconfidence is Key: Verbalized Uncertainty Evaluation in Large Language and Vision-Language Models", TrustNLP 2024.** https://arxiv.org/abs/2405.02917
  - Finding: "both LLMs and VLMs have a high calibration error and are overconfident most of the time" (GPT-4V and Gemini Pro Vision tested).
  - Stage: confidence elicitation.
  - Borrow: evidence that VLM verbalized confidence specifically is unreliable.
  - Caveat: older VLMs.
- **Tian et al., "Overconfidence in LLM-as-a-Judge: Diagnosis and Confidence-Driven Solution", 2025.** https://arxiv.org/abs/2508.06225
  - Finding: judge "predicted confidence significantly overstates actual correctness". Proposes an ensemble "LLM-as-a-Fuser".
  - Stage: confidence elicitation.
  - Borrow: corroboration that judge confidence must come from ensembles or agreement.
  - Caveat: only the abstract was read; no numbers verified.
- **Zollo & Zemel, "Confidence Calibration in Vision-Language-Action Models", TMLR 2026.** https://arxiv.org/abs/2507.17383
  - Finding: "prompt ensembles", which average confidence across paraphrased instructions, are a lightweight fix for miscalibration in robot VLAs.
  - Stage: confidence elicitation.
  - Borrow: paraphrase the Criterion question (and vary the camera order) across the K Spark calls, so samples differ even if Spark's sampling is near-deterministic.
  - Caveat: VLA action confidence, not a judge.
- **Verga et al., "Replacing Judges with Juries" (PoLL), 2024.** https://arxiv.org/abs/2404.18796
  - Finding: a panel of smaller models from "disjoint model families" outperforms a single large judge, "exhibits less intra-model bias", and is "over seven times less expensive".
  - Stage: Spark versus Glimmer.
  - Borrow: a different model family catches different mistakes, which justifies treating Glimmer disagreement as an escalation trigger.
  - Caveat: Glimmer sees keyframes only, so on temporal Criteria (drops, re-grasps) disagreement will mostly reflect missing information, not a real second opinion.
- **Navasardyan, Danielyan & Davtyan, "FailBench", 2026.** https://arxiv.org/abs/2609.03611
  - Finding: the best VLM reaches 0.77 mean balanced accuracy. Abstract: "a systematic bias toward predicting success under ambiguous evidence, which persists even with increased reasoning effort". Cropping outcome-relevant regions gains +2.4 pp. The fetched summary found no calibration, abstention, or ensemble results.
  - Stage: §8 bar to beat, and the Spark-alone baseline.
  - Borrow: measure "says success on true failures" for Spark alone, and route ambiguous Episodes to Needs review instead of trusting a default "success".
  - Caveat: plan.md already notes that the success bias is described qualitatively. Keep the abstract's wording, and don't quantify it.

### Winnow's own feasibility data (docs/feasibility/spark_judge.json)

- Spark contributor at high effort judged 5 Episodes at $0.00046–$0.00109 per call and 11–30 s latency.
- It agreed with the corrected outcome on all 5: it caught Episode 42 (dataset says success) as a failure at ~17 s, and called 48 and 49 failures.
- `max` effort on Episode 42 cost $0.0197, about 20× more, and gave the same answer.
- Implication: K = 3 contributor samples cost about $0.003 per Episode (computed), far cheaper than one `max` call, which makes agreement-based confidence affordable.
- n = 5 says nothing about accuracy.

---

## 3. Recommendations

Ranked by impact on the Demo video and on honesty of the on-screen numbers.

### R1. Criterion result confidence plus a weakest-link Triage decision rule (build this week)

Each hard Criterion yields `pass`, `fail`, or `unsure`, plus `p_pass ∈ [0,1]` and the reason it went unsure (for the explanation).

- **Measured Criteria:** compute a signed margin m = (x − t)/w, where t is the Rubric threshold and w is that Criterion's band half-width.
  - Crisp if |m| ≥ 1; unsure otherwise.
  - p_pass = 1/(1 + e^(−3m)), a fixed curve with no fitting.
  - Start w at about 10% of t for continuous measures. For count measures (grasp count), add hysteresis on the raw signal: if the gripper value sits in [0.4, 0.6] for more than N frames, the count is unsure.
- **Tracked Criteria:** unsure if SAM has no box for more than 20% of frames in the relevant window, or if mean box confidence in that window is below c_min (SAM 3.1 returns per-box confidence; see `backend/src/winnow/tracking/sam_output.py`). Otherwise use the margin rule on the tracked measurement.
- **Visual Criteria:** K = 3 Spark calls, each with a paraphrased Criterion question and/or a different camera order ("simulated annotators" / prompt ensemble).
  - p_pass = (passes + 1)/(K + 2).
  - Crisp only if all K agree.
  - On a 2–1 split, escalate: 2 more Spark calls, plus Glimmer on keyframes if the Criterion is about the end state. Still split → unsure.
- **Cross-signal overrides force unsure:**
  - The gripper closed (robot data), but SAM shows no object in the gripper.
  - The SAM track says the object moved away, but Spark says it was placed.
  - Glimmer disagrees with a unanimous Spark answer on an end-state Criterion.
- **Triage decision:**
  - Reject if any hard Criterion is crisp `fail`. The first crisp fail is the explanation.
  - Keep if every hard Criterion is crisp `pass`.
  - Otherwise Needs review, listing which Criteria were unsure and why.
  - Soft Criteria only feed the quality score.
- **Triage confidence, used for ranking and plots:** P_keep = Π p_pass,i over hard Criteria (independence approximation), and conf = max(P_keep, 1 − P_keep). This one scalar drives the RC curve, the review queue order, and the Spark-alone comparison.
- **Why this shape:** it is a selective classifier (Geifman & El-Yaniv), its unsure bands are the only tuned parameters (LTT-friendly), and every Needs review comes with a sentence explaining why.

### R2. Two label streams: review and audit (build this week)

- **Review queue (the Needs review pile):** order by conf ascending (least confident first). Exception: the first 3 items are the most *typical* Keep and Reject, so the user calibrates their own sense of the Rubric (Hacohen et al.).
  - Labels here finalize those Episodes (human-decided Keep or Reject).
  - They also tune the bands (R4).
  - They never enter the precision estimate.
- **Audit sample:** before showing results, draw a seeded uniform random sample of n_a = 10–15 Episodes from auto-Keep, plus 5 from auto-Reject if the budget allows. Record the seed so the draw can't be cherry-picked. Show it as a separate "Audit" tab.
- Store each label with `stream: "review" | "audit"` so the statistics code can't mix them.
- Budget split for the "label 20" story: 8 review + 12 audit. This keeps the audit interval meaningful while still teaching the bands.

### R3. Exact on-screen statistics and formulas (build this week)

Show counts first, then an interval. Don't show symmetric "±" unless n_a ≥ 80.

| Tile | Text (example) | How to compute |
|---|---|---|
| Auto-Keep precision | "Audited 15 auto-Keeps: 14 good · precision 0.93 (95% CI 0.70–0.99)" | Wilson: p̂ = k/n, z = 1.96, center = (p̂ + z²/2n)/(1 + z²/n), half = z·√(p̂(1−p̂)/n + z²/4n²)/(1 + z²/n) |
| Same, all-correct case | "15 of 15 good · precision ≥ 0.86 (90% confidence)" | Clopper–Pearson one-sided lower bound with k = n: δ^(1/n) = 0.1^(1/15) = 0.858 |
| Final dataset precision | "Kept 64: 52 auto (est. 0.93) + 12 human-confirmed → est. 0.94 (0.75–0.99)" | (A·p̂ + H)/(A + H); bounds are the same expression applied to the Wilson bounds. Human-confirmed Keeps count as correct. |
| Coverage | "71 of 100 decided automatically · 29 Needs review" | coverage = auto-decided / total |
| Human time | "Review: 29 Episodes × ~20 s ≈ 10 min vs 100 × 20 s ≈ 33 min to watch all" | Multiply by the measured median seconds per review label from the UI. Don't assume. |
| False Reject check (optional) | "Audited 5 auto-Rejects: 0 were actually good" | Same Wilson interval; at n = 5 just show the count |
| Rubric sanity | per Criterion: "fails 3% (1–9%) of Episodes" | Wilson on fail rate over all Episodes; warn below 2% or above 95% (plan §5.4) |

- Reference values (computed, Wilson 95%):
  - 10/10 → 0.72–1.00
  - 9/10 → 0.60–0.98
  - 14/15 → 0.70–0.99
  - 19/20 → 0.76–0.99
  - 18/20 → 0.70–0.97
  - 46/50 → 0.81–0.97
  - 92/100 → 0.85–0.96
- Optional finite-population correction: when sampling n of the N auto-Keeps without replacement, multiply the half-width by √((N−n)/(N−1)) (0.87 for n = 15, N = 60). Label it "approx." if used; leaving it out is conservative.
- Implementation: Wilson and the all-correct CP bound are closed form. For the general CP bound, use `scipy.stats.beta.ppf(1−conf, k, n−k+1)` (scipy is not yet a backend dependency, so either add it or keep Wilson only).

### R4. Threshold and band tuning without overfitting (build this week)

- Tune **only the band widths** (one global multiplier s on all w, plus the Spark agreement rule: unanimous or 2-of-3). Don't tune the Rubric thresholds t from labels.
  - If review labels contradict a threshold (for example, the user keeps 3 Episodes the "No long pauses" Criterion failed), show a *suggestion*: "Your labels suggest a pause limit of 2.6 s, not 2.0 s. Apply?" The Rubric stays the user's.
- Pre-register a grid s ∈ {2.0, 1.5, 1.0, 0.75, 0.5}, from conservative to aggressive. Scan in that order, computing on all labeled auto-decided Episodes the CP upper bound on error, R̂⁺(s) = beta.ppf(1−δ, errors+1, n(s)−errors). Stop at the last s where R̂⁺ ≤ α. This is fixed-sequence testing (Trust or Escalate Eq. 5; Gentle Intro §5.5).
- Be honest about the arithmetic (computed): zero errors certifies selective error ≤ α at confidence 1−δ only if n(s) ≥ ln δ / ln(1−α).
  - α = 0.2, δ = 0.1 → 11 labels.
  - α = 0.1, δ = 0.1 → 22.
  - α = 0.05, δ = 0.1 → 45.
  - So with 20 labels, use α = 0.2 for the scan, and show the chosen s as "tuned on 20 labels" without a guarantee badge.
  - These labels mix review and audit streams, so they are not exchangeable. Treat the result as a heuristic, which is another reason not to claim a guarantee.
- Overfitting check: leave-one-out. Re-run the scan without each label. If the chosen s changes for more than 2 of 20 drops, say "thresholds unstable: label more".
- When a label changes, re-sort only by re-applying cached Criterion results, which plan §5.7 already assumes.

### R5. Spark alone versus Winnow: metrics and plots (build this week)

**Eval set.** About 100 Episodes with *adjudicated* success labels. Start from droid_1.0.1 flags, then a human checks every Episode where either system disagrees with the flag (Episode 42 shows flags can be wrong). For a fair head-to-head on task success, run Winnow with a success-only Rubric. The "expert" Rubric is a separate showcase, because the dataset has no "expert" labels.

**Spark alone.** One call per Episode, the same model and effort as Winnow's visual calls, and "success" means Keep. For its RC curve, also give it a confidence: its verbalized confidence from the same call (free), or K = 3 agreement (fairer).

Report:

1. **False-keep rate on true failures** (the headline from plan §8): FK = (# true failures auto-kept)/(# true failures), with a Wilson CI, for both systems. Count Winnow's Needs review as *not* auto-kept, and also show #2 so this isn't flattering.
2. **Winnow worst case:** recompute balanced accuracy with every Needs review forced to Keep. If Winnow still beats Spark alone here, the claim is robust.
3. **Matched-coverage precision:** take Winnow's coverage c*, keep Spark alone's top c*·N Episodes by its own confidence, and compare Keep precision at equal automation. This is the fair comparison.
4. **Risk–coverage curves** for both on one chart. Sort Episodes by confidence, descending. For k = 1…N: coverage_k = k/N, risk_k = (errors among top k)/k, where an error is a wrong Keep/Reject relative to the adjudicated label. Plot risk (y) against coverage (x) as a step line, mark Winnow's operating point, and report AURC = mean of risk_k. A lower curve wins. Optionally add a 200-resample bootstrap band.
5. **Paired discordance:** b = Episodes Winnow got right and Spark alone wrong, c = the reverse. Show them as counts with the McNemar exact p = binomtest(c, b+c, 0.5). Computed: b = 10, c = 3 gives p = 0.09, so don't promise significance at n = 100.
6. **Balanced accuracy** on auto-decided Episodes (Winnow) versus all Episodes (Spark alone). Shown, but labeled "different coverage".
7. **Cost per 1,000 Episodes** and **human minutes per 1,000**, from the cost log and measured review time.

Slide sentence template: *"On 100 Episodes, Spark alone kept 9 of 31 true failures (29%, 95% CI 16–47%). Winnow auto-kept 2 of 31 (6%, 2–21%) and sent 11 to Needs review. At equal automation, Keep precision was 0.97 versus 0.88."* Fill in real numbers; these are placeholders.

### R6. Confidence elicitation: agreement, not verbalized (build this week)

- K = 3 Spark contributor calls per visual Criterion, varied by paraphrase and camera order. Escalate 2–1 splits to K = 5.
- Measure flip rates first (§4, Q1). If Spark at high effort is nearly deterministic, paraphrasing is what creates diversity.
- Also request a verbalized `confidence` field in the JSON schema. It costs nothing, and it makes Spark-alone's RC curve and the AUROC comparison possible (Q3). Don't use it in the Triage decision unless Q3 shows it ranks well.
- Logprobs: the client calls the Responses API with `reasoning.effort`. Whether Spark returns token logprobs is UNVERIFIED and unlikely for a reasoning model. Probe once; don't build on it.

### R7. Spark–Glimmer disagreement as a cascade trigger (build this week if time; else slides)

- Call Glimmer only on visual Criteria about the end state ("object inside target"), sending the last 2–3 keyframes. Call it only when Spark is split, or on a random 10% of unanimous Episodes to measure disagreement.
- Disagreement → Needs review. Log the agreement rate as a "second opinion" metric.
- Don't use Glimmer on temporal Criteria, since keyframes can't show a drop.
- This makes Winnow a two-stage cascade (Trust or Escalate) built on different model families (PoLL).

### R8. Roadmap and slides only

- **KnowNo framing:** "Winnow asks for help when both Keep and Reject stay plausible", with a conformal set over {Keep, Reject}. Real guarantees need about 100–400 random labels (KnowNo used 400; Table 1 of the Gentle Intro needs 102 for ±0.05).
- **Label model for multi-signal Criteria:** FlyingSquid triplets over gripper, SAM track, and Spark for "object dropped", which learns per-signal reliability without labels.
- **Dataset-scale precision with PPI++ or Rogan–Gladen:** "label 20, curate 2,000" with a valid interval that uses Winnow's graded P_keep on all 2,000.
- **Active statistical inference:** merge the review and audit streams with importance weights, so every label counts toward both purposes.
- **Learned confidence ranker** (Margin-Adaptive), once there are hundreds of labels.

---

## 4. Open questions worth a quick experiment

1. **Is Spark stochastic at high effort?** 5 Episodes × 5 identical calls → the Pass/Fail flip rate. Repeat with 5 paraphrased prompts. About $0.05 total. Decides R6's sampling design.
2. **Does the Responses API return logprobs for Spark?** One call with `top_logprobs` / `include=["message.output_text.logprobs"]` (OpenAI-compatible parameters; Spark support UNVERIFIED).
3. **Which Spark confidence signal ranks errors best?** On the ~100-Episode eval set, compute the AUROC for separating Spark-correct from Spark-wrong using (a) verbalized confidence, (b) K = 3 agreement, and (c) K = 3 agreement plus paraphrase. Literature predicts (b)/(c) > (a) for judges (Trust or Escalate Table 1; Xiong §5.3). Confirm it on video.
4. **How large is Spark's success bias here?** The false-keep rate on adjudicated failures, plus how many of those it hedges on (2–1 splits). If most of Spark's misses are split votes, agreement-based triage will catch them. That is the core bet behind the comparison.
5. **Does the cross-signal check fire on real errors?** Count Episodes where gripper data and the SAM track disagree, and how many of those are true errors (precision of the override).
6. **Band sensitivity:** plot coverage and labeled error against the band multiplier s ∈ {0.5…2}. A flat region means tuning is safe; a cliff means it is fragile.
7. **Are hard Criterion errors correlated?** On labeled Episodes, check whether wrong Criterion results co-occur. Strong correlation means Π p_pass overstates confidence; switch to min p_pass.
8. **Prompt caching across the K calls:** does `usage.input_tokens_details.cached_tokens` cover the video on calls 2…K? If so, K = 3 costs much less than 3×.
9. **How noisy are droid_1.0.1 success flags?** The fraction flipped on adjudication. This number is also a Demo video moment ("dataset said success, here's the video").
