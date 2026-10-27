# Winnow — Project Plan

*Meta Global AI Developer Hackathon · Indie Developer track · Theme: Push the Frontier (robotics)*

**Working name:** Winnow
**Alternatives:** Plainsight, Assay, Sift, Keepers

---

## 1. The pitch (keep it this short)

**One line:** Describe what a good robot demonstration looks like. Winnow watches every one and keeps only those.

**Problem (one sentence):** Robots learn from human demonstrations, but teams can't watch thousands of them, and today's best AI judges say "success" when they're unsure, so bad demos slip into training.

**Solution (one sentence):** You write "expert" in plain English; Meta's models check every episode against it, keep the good ones, flag the uncertain ones for a human, and show exactly why each rejected one failed.

**Why I'm building it:** My robotics club (Triton Droids) is training a ping pong policy and struggling to curate expert demonstrations. Winnow is my own project; ping pong is the motivation, not the product.

**Pitch test:** a non-roboticist should be able to repeat the one-liner back after hearing it once.

---

## 2. The problem, with numbers

| Fact | Number | Source |
|---|---|---|
| Cost of teleoperation data (standard pick-and-place, fully loaded) | ~$118 / hour (early 2026), down from ~$340 in early 2024 | Robotics Center, State of Robotics 2026 |
| Share of collected demos rejected in quality review | 15–30% | Axis Robotics guide |
| How much of the data humans actually review | 1–5% weekly random sample, or 10–20% per session | Robotics Center checklist; Claru guide |
| Best AI success judge on 2,197 robot attempts (~1,600 real, ~600 simulated; FailBench) | 0.77 mean balanced accuracy; catches only 40% of true failures on the failure-only subset. A lean toward "success" under ambiguity is reported qualitatively (one model's reasoning traces), not measured | FailBench (Sep 2026) |
| Where AI judges fail | Strong on some visible-object-motion sources (0.89–0.95), but only 0.72 on the DROID robot slice; no model exceeds 0.60 on contact-heavy tasks | FailBench |
| Gain from curating demos (Demo-SCORE) | 15–35% higher absolute policy success vs training on all demos | Demo-SCORE paper |
| Gain from filtering to the top 25% of demos | 30–50% higher success on contact-rich tasks | Mandlekar et al., via Claru |
| Effect of low-quality data | 20% low-quality examples → 30% worse training loss (Open X-Embodiment) | Hugging Face blog |
| Robot training data market | Estimates: >$242M (2025) → $5.25B (2030); or $536M (2025) → $750M (2026) | ResearchInChina; LP Information |

**Pitch line:** *Teams watch only a fraction of their robot demos, and today's best AI judges still miss most real failures in hard cases: 40% caught on FailBench's failure-only set, 0.72 balanced accuracy on DROID robots. That's exactly backwards for cleaning data.*

> ⚠️ Do NOT claim "1 in 5 failures in droid_100 were never flagged." Those 19 episodes came from DROID's raw `/failure/` folders; their outcome survives in `next.reward` (0 on the last frame), but their task instructions were dropped during format conversion. It's a real data-quality issue but not "undetected failures." Episode 42 (marked success: three failed grasps, then the object released ~10 cm above the target) is still a fair example.

---

## 3. Who has the problem

1. **Robot-learning teams at labs and student clubs** (primary user in the pitch). No QA staff; curation = someone scrubbing videos. Firsthand story: Triton Droids.
2. **Humanoid / robotics companies' data operations.** Figure is hiring dedicated TeleOps Quality Support staff to review teleop sessions. 1X reportedly has 700+ gig operators collecting data at home. Volume grows faster than anyone can watch.
3. **Data platforms and vendors** (Encord, Labelbox, Claru). Encord reports 10x growth in physical-AI revenue in 12 months — evidence of a growing market, and potential future customers or competitors.

---

## 4. Existing approaches and the gap

| Approach | Examples | What it misses |
|---|---|---|
| Motion-quality metrics | FiftyOne episode quality (smoothness, jerk, idle time) | Measures *how* it moved, not whether it did the task the way your team means "expert" |
| Teleop feedback | DQAF (May 2026) | Fixed signals; not user-definable |
| Rollout-based curation | Demo-SCORE, CUPID | Needs a trained policy + 25–100 robot rollouts; fails when demos are too poor for a first policy to succeed |
| Failure detectors | RoboFAC, Instance (YC S26) | Pass/fail only; fine-tuned detectors underperform general models on FailBench |
| Data platforms | Encord, Labelbox | General infrastructure, not task-semantic judgment |

**Gap:** No tool found that filters robot demos from *user-written* "expert" criteria, before training, with evidence and calibrated uncertainty.

**Nuance to design for:** CUPID found "higher quality" doesn't always mean "better robot" (quality filtering can favor brittle strategies). This supports user-defined criteria (e.g., "always uses the same grasp strategy") over generic smoothness scores.

---

## 5. How Winnow works

1. **Describe** — e.g. *"Expert pick-and-place: grasps on the first try, never drops the object, places it inside the target, no long pauses."*
2. **Compile** — Spark turns the description into a rubric of separate criteria, each tagged:
   - **Measured from robot data** (end-effector pose + gripper in droid_100; joint states too in droid_1.0.1): completion time, pauses, smoothness/jerk, re-grasp count, path efficiency.
   - **Measured from SAM 3.1 tracks**: object dropped, object ends in target, gripper–object contact over time.
   - **Visual judgment** (Spark on video, steered by SAM masks): e.g. "grasped by the handle."
   - Each criterion is **hard** (fail = reject) or **soft** (adds to a quality score). Rubric is shown back for editing before running.
3. **Score** — every episode gets per-criterion results with evidence (timestamps, track plots, the frame where it slipped).
4. **Triage with self-monitoring** — confident episodes auto-kept/rejected; uncertain ones go to "needs review." Uncertainty signals:
   - measurement close to a threshold
   - robot data and video disagree (gripper "closed on something" but SAM shows nothing in it)
   - Spark unsure or vague
   - SAM lost tracking
   - **Rubric sanity monitor:** a criterion rejecting ~0% or ~95% of episodes is probably mis-specified → warn.
5. **Calibrate** — label 10–20 episodes; thresholds tune to your judgment; reports estimated precision with an error bar. Active learning: asks about the episodes it's least sure of. *"Label 20 episodes, curate 2,000."*
6. **Output** — filtered dataset in the same (LeRobot) format + a report explaining every rejection.
7. **Iterate** — edit one sentence, re-sort instantly (tracks/measurements cached; only thresholds re-applied).

---

## 6. Meta models — used in non-obvious ways

| Model | Role | What makes it more than a basic integration |
|---|---|---|
| **SAM 3.1** (Model API, `sam-3.1`) | Tracks gripper and objects from text prompts; each call takes one concept and one camera and returns per-frame boxes, masks, track ids, and confidence | Used as *physical evidence* for verdicts, and to steer Spark's attention (masks/crops) → fewer hallucinations, fewer video tokens |
| **Muse Spark 1.3** | Compiles English → rubric; judges visual criteria on video; writes explanations | Natively understands video; measured criteria run in Winnow's own code (the API has no hosted code execution), which Spark can call as function tools |
| **Muse Voice Transcribe** | Talk-while-watching labeling: narrate verdicts while watching an episode | Moment labels from speech (turn-level timestamps aligned to the video playhead; the API has no word-level timestamps); can draft the rubric from spoken critique |
| **Muse Glimmer** (open weights; hosted via OpenRouter, not on the Meta Model API) | Independent second-opinion judge on keyframes of borderline episodes (images only, no video); running locally is roadmap (needs a 32 GB+ Mac) | Different model than Spark catches different mistakes; open-weights bonus |
| **Muse Wonder** | (Stretch / roadmap) agent that improves the rubric against labeled episodes, with budget and stopping rules | Applies my self-monitoring research-agent architecture |
| **Muse Image** | (Roadmap) edit a keyframe to insert an obvious failure; check whether the judge's verdict flips | An image model auditing another model's attention |

**Cost cascade:** robot-data measurements are free; first-pass judging on Spark's cheaper tier; only uncertain episodes escalate. Pitch metric: cost per 1,000 episodes curated. Pricing: Spark contributor $0.10 / $0.20 per 1M tokens (150 RPM, no `max` reasoning), standard $1.25 / $4.25 (3,000 RPM); SAM 3.1 $0.20 per 1,000 frames. Spark's video token cost is undocumented — measure it.

---

## 7. Rubric alignment

| Criterion (weight) | Fit | Notes |
|---|---|---|
| **Impact (30%)** | Strong | Real data costs, sampled review, AI judges that miss real failures; fast-growing market; firsthand club story. Risk: "infra for ML people" → frame as "robots learn from examples; bad examples make bad robots." |
| **Use of Meta AI tooling (25%)** | Very strong | SAM as evidence + attention steering; Spark compiling language into filters; voice as a labeling interface; Glimmer second opinion. |
| **Technical depth (20%)** | Strong | Evidence fusion, calibrated abstention, risk–coverage curve, comparison vs Spark-alone baseline. |
| **Demo (25%)** | Strong | Type a sentence → 100 episodes sort → click a rejected "success" and see where it went wrong. |

**Bonus prizes in reach:** Best Build on Open Weight Models (Glimmer; confirm a hosted call qualifies), Best Agentic Use-Case (if rubric agent is built), Most Viral (post demo on X).
**Anti-project risk:** low — agentic video reasoning over datasets, not a simple image analyzer. Keep ping pong out of the hero demo (avoid any "sports analyzer" misread).

---

## 8. Decisions locked

- **Track:** Indie. **Theme:** Push the Frontier (robotics).
- **Hero demo:** pick-and-place on public data.
- **Bar to beat:** same episodes, same Meta model — **Spark alone vs. Winnow**. Win on accuracy, especially on failures Spark alone calls "success".
- **Ping pong:** motivation and "what's next," not the product.
- **Cost tier:** contributor tier is fine (public data); escalated judging needs the standard tier (contributor has no `max` reasoning and a 150 RPM cap).
- **Philosophy:** somewhat functional + very well presented. Not everything needs to be built.

---

## 9. Demo script (~2.5 min) — written first, build backward

| Time | On screen | Purpose |
|---|---|---|
| 0:00 | Robot clip labeled "success" that's clearly sloppy | Hook |
| 0:15 | "Teams can't watch every demo, and AI judges miss real failures." | Problem |
| 0:30 | Type the expert description → rubric appears | Core idea |
| 0:50 | 100 episodes sort into keep / reject / needs review | Scale |
| 1:10 | Click a rejected "success": video + SAM masks, timeline marking where it failed, gripper data, one-line reason | Wow moment |
| 1:35 | Needs-review pile → narrate a verdict by voice → thresholds update | Self-monitoring + Meta tooling |
| 2:00 | Change one sentence ("pauses are fine") → instant re-sort | Flexibility |
| 2:15 | Results: Winnow vs Spark alone; cost per 1,000 episodes | Proof |
| 2:35 | "Any robot, any task, described in English." Ping pong as what's next | Close |

---

## 10. Real vs. precomputed vs. slides

- **Must be real:** rubric compiling; scoring ~100 episodes; episode detail view; Spark-alone comparison numbers.
- **Fine to precompute (say so on screen):** full dataset run; SAM tracks and measurements cached so edits re-sort instantly.
- **Real but small:** voice labeling on one episode.
- **Slides only ("what's next"):** rubric-improving agent (Wonder), image-edit judge test (Muse Image), Glimmer activation probes. Rules require demoing only what was built during the hackathon — label future work clearly.

---

## 11. Build order

1. **Day-1 feasibility test** (see below).
2. Load episodes + robot data; run SAM 3.1 on clips; cache tracks.
3. Compile description → rubric; compute measured criteria; Spark visual criteria.
4. Episode detail view (this *is* the demo — give it real time).
5. Spark-alone comparison → results slide.
6. Triage + confidence; needs-review pile.
7. Voice labeling; instant re-sort from cache.
8. Record the demo video early; polish story and visuals.
9. Buffer, submission, X post.

### Day-1 feasibility test
1. Get Meta API key + credits working.
2. Load `lerobot/droid_100` (small; no big download). Avoid full DROID (~1.7 TB RLDS). Transcode its AV1 video to H.264 (not on SAM's accepted list); the `v2.0` branch has one mp4 per episode per camera.
3. Pick 5 pick-and-place episodes: episode 42 (marked success, appears to fail; recovered instruction "Move the black remote control to the left"), 2 known failures (their instructions are blank — write one by watching), 2 true successes.
4. SAM 3.1 with prompts like "robot gripper" + the object from the task instruction → does tracking hold?
5. Spark: video + instruction → success? if not, when did it fail?
6. Spark: compile one expert description → rubric; check measured criteria compute from the episode data.
7. Record cost and latency per episode.

**Go/no-go:** if Spark catches episode 42 and SAM's tracks support the verdict, build. If not, adjust before committing more time.

---

## 12. Evaluation plan

- **Datasets:** `lerobot/droid_100` (only ~40 clear pick-and-place episodes, all successes) filled to ~100 from `lerobot/droid_1.0.1` (same format, explicit success flag); RoboFAC real-world split (`MINT-SJTU/RoboFAC-dataset`, 480 failures + 122 successes, subtask-level failure labels) as a secondary video-only check only — it has no robot data, staged failures, and judges are near-saturated on it.
- **Headline comparison:** Spark alone vs Winnow on the same episodes — balanced accuracy, and how often each says "success" on true failures.
- **Curation metrics:** precision on kept episodes; coverage at fixed precision (risk–coverage curve); human review minutes saved; cost per 1,000 episodes.
- **Later:** adjudicate disagreements with provider labels (labels can be wrong — "dataset said success, Winnow said failure, here's the video" could be a demo moment).
- **Not in scope:** training a policy on filtered data (needs GPUs) → "next steps."

---

## 13. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Vague descriptions → vague filter | Compile → confirm → calibrate loop; rubric shown before running |
| AI judges weak on contact-heavy tasks | Hero demo on pick-and-place (object motion visible); route ambiguity to review |
| Video token cost | Measure on day 1; compute measured criteria from robot data; send video only for visual criteria; crop to SAM boxes in our own code (savings unproven until measured) |
| SAM loses small/fast objects | droid_100 video is only 320×180; pick clear pick-and-place clips; treat lost tracking as an uncertainty signal |
| "Infra for ML people" perception | Lead with the simple pitch and a concrete clip; firsthand club story |
| Competition (Instance, RoboFAC, data platforms) | Differentiate on plain-English criteria, evidence, calibrated triage, no training or rollouts |
| Rules: new work only | Fresh public repo; no club code; club data only with permission |

---

## 14. Validation to-dos (this week)

- [ ] Interview 2–3 Triton Droids teammates: how many episodes, how long review takes, what makes a demo "expert." Get one quotable line.
- [ ] Ask in the LeRobot community: "How do you curate teleoperation data before training?"
- [ ] Ask one UCSD robotics lab the same question.
- [x] Confirm Spark contributor-tier pricing (done: see §6). Video limits are undocumented — measure on day 1.
- [ ] Ask on hackathon Discord whether a hosted Glimmer call counts for Best Open Weight Build.
- [ ] Ask on hackathon Discord if anything about the idea raises concerns.

---

## 15. Hackathon logistics

- **Submission deadline:** Nov 4, 9:00 PM ET (6:00 PM PT). Judging Nov 4–8; finals Nov 9.
- **Rules:** public repo; teams ≤4 (solo OK); demo only what was built during the event; avoid anti-projects (chat wrappers, basic RAG, simple image analyzers, sports analyzers/coaches, medical advice, education chatbots, political).
- **Judging:** Stage 1 pass/fail viability → Stage 2 rubric scores (0–10) → top 5 per track: judges watch demo videos live.
- **Rubric:** Impact 30% · Use of Meta AI Tooling 25% · Technical Depth & Execution 20% · Demo 25%.
- **Credits:** $150 Meta Model API credits.
- **Bonus:** Most Viral (X post by Nov 8), Best Open Weight Build, Community Vote, Best Agentic Use-Case, Best Creative Build.

---

## 16. Sources

- Meta hackathon: https://dev.meta.ai/events/global-hackathon
- Muse Spark: https://dev.meta.ai/models/muse-spark/ · Muse Glimmer: https://dev.meta.ai/models/muse-glimmer/ · Muse Wonder: https://dev.meta.ai/models/muse-wonder/
- SAM 3.1 on Meta Model API: https://www.mind-verse.de/news/meta-sam-3-1-bild-video-analyse-api · https://digg.com/ai/icmesfai
- FailBench: https://arxiv.org/pdf/2609.03611 · summary: https://academy.dair.ai/papers/failbench-how-reliable-are-vlms-at-judging-robot-task-success-2609.03611
- Teleop data cost: https://roboticscenter.ai/state-of-robotics-2026
- Rejection rate: https://axisrobotics.ai/resources/guides/reduce-robot-data-collection-cost
- Review sampling: https://www.roboticscenter.ai/blog/teleoperation-data-quality-checklist · https://claru.ai/guides/how-to-collect-teleoperation-data
- Top-25% filtering (Mandlekar): https://claru.ai/blog/physical-ai-training-data-guide
- Low-quality data effect: https://huggingface.co/blog/robotdata/gigo
- Demo-SCORE: https://arxiv.org/html/2503.03707v1 · limitations: https://arxiv.org/pdf/2503.03707
- CUPID: https://arxiv.org/pdf/2506.19121
- Curation still manual (QoQ): https://arxiv.org/pdf/2603.09056
- droid_100 label audit: https://huggingface.co/datasets/lerobot/droid_100/discussions/2
- DROID size / LeRobot porting: https://huggingface.co/docs/lerobot/porting_datasets_v3
- RoboFAC: https://arxiv.org/pdf/2505.12224 · dataset (official, MIT): https://huggingface.co/datasets/MINT-SJTU/RoboFAC-dataset
- DROID 1.0.1 (LeRobot, explicit success flag; credit DROID, CC BY 4.0): https://huggingface.co/datasets/lerobot/droid_1.0.1
- Instance (YC S26): https://www.ycombinator.com/launches/RPi-instance-automated-evaluation-for-robot-policies-starting-with-the-success-detector
- DQAF: https://huggingface.co/papers/2605.26349
- Figure TeleOps QA role: https://ev.careers/jobs/533784258/apply
- 1X gig operators: https://claru.ai/blog/gig-workers-training-humanoid-robots-data-quality
- Encord growth: https://pulse2.com/encord-60-million-series-c-raised-to-scale-ai-native-data-infrastructure/amp/
- Market estimates: https://giikorea.co.kr/report/rinc2027361-embodied-artificial-intelligence-eai-robot-data.html · https://animeanime.jp/release/dreamnews/20260821/307283.html