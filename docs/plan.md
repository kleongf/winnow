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
| Best AI success judge on 2,197 robot attempts (~1,600 real, ~600 simulated; FailBench) | 0.77 mean balanced accuracy; the best overall judge (Gemini 3 Flash) catches only 40% of failures on a 30-episode failure-only subset (REFLECT; other models range 0–100% there). A lean toward "success" under ambiguity is reported qualitatively (one model's reasoning traces), not measured | FailBench (Sep 2026) |
| Where AI judges fail | Strong on some visible-object-motion sources (0.89–0.95), but only 0.72 on the DROID robot slice; no model exceeds 0.60 on contact-heavy tasks. Cropping to the region that decides the outcome raises the DROID slice from 0.740 to 0.810 (+7 points) | FailBench |
| Gain from curating demos (Demo-SCORE) | 15–35% higher absolute policy success vs training on all demos | Demo-SCORE paper |
| Gain from filtering to the top 25% of demos | 30–50% higher success on contact-rich tasks | Mandlekar et al., via Claru |
| Effect of low-quality data | 20% low-quality examples → 30% worse training loss (Open X-Embodiment) | Hugging Face blog |
| Robot training data market | Estimates: >$242M (2025) → $5.25B (2030); or $536M (2025) → $750M (2026) | ResearchInChina; LP Information |

**Pitch line:** *Teams watch only a fraction of their robot demos, and today's best AI judges still miss most real failures in hard cases: the best judge caught 40% on FailBench's 30-episode failure-only set and scored 0.72 balanced accuracy on DROID robots. That's exactly backwards for cleaning data.*

> ⚠️ Do NOT claim "1 in 5 failures in droid_100 were never flagged." Those 19 episodes came from DROID's raw `/failure/` folders; their outcome survives in `next.reward` (0 on the last frame), but their task instructions were dropped during format conversion. It's a real data-quality issue but not "undetected failures." Episode 42 (marked success: three failed grasps, then the object released ~10 cm above the target) is still a fair example.

---

## 3. Who has the problem

1. **Robot-learning teams at labs and student clubs** (primary user in the pitch). No QA staff; curation = someone scrubbing videos. Firsthand story: Triton Droids.
2. **Humanoid / robotics companies' data operations.** Figure is hiring dedicated TeleOps Quality Support staff to review teleop sessions. 1X reportedly has 700+ gig operators collecting data at home. Volume grows faster than anyone can watch.
3. **Data platforms and vendors** (Encord, Labelbox, Claru). Encord reports total revenue up more than 10× in the 18 months before its Feb 2026 round (not physical-AI revenue specifically) — evidence of a growing market, and potential future customers or competitors.

---

## 4. Existing approaches and the gap

| Approach | Examples | What it misses |
|---|---|---|
| Motion-quality metrics | FiftyOne episode quality (smoothness, jerk, idle time) | Measures *how* it moved, not whether it did the task the way your team means "expert" |
| Teleop feedback | DQAF (May 2026) | Fixed metric set (telemetry + VLM subtask progress) for live operator feedback; no arbitrary criteria, no abstention |
| Rollout-based curation | Demo-SCORE, CUPID | Needs a trained policy + 25–100 robot rollouts; fails when demos are too poor for a first policy to succeed |
| Failure detectors | RoboFAC, Guardian, RoboReward, Instance (YC S26) | Pass/fail only; FailBench's fine-tuned detectors (Guardian, RoboReward-8B, ViFailback-8B, RoboFAC-7B, FailSense) underperform general models. Instance isn't in FailBench |
| Rubric-based QA services | Shotwell AI (YC Spring 2026) | Step-by-step pass/fail against the customer's SOP with timestamps, LeRobot input; a 24-hour service, with no stated use of robot telemetry or uncertainty (vendor claims) |
| Natural-language search | Roboto Agents (Jul 2026) | Finds *moments* from a plain-language description across logs and video; doesn't judge Episodes against a quality bar |
| Data platforms | Encord, Labelbox | General infrastructure, not task-semantic judgment |

**Gap:** Tools now exist that score or search robot Episodes (Shotwell, Roboto, DQAF, commercial scoring services). None that we found turns a team's own English definition of "expert" into checks over robot data, object tracks *and* video, or reports how often its "keep" is wrong and abstains when unsure. An independent audit of one commercial scorer found it gave robot telemetry zero weight and its human corrections only raised scores (CosmicBrain, Oct 2026).

**Nuance to design for:** CUPID found "higher quality" doesn't always mean "better robot" (quality filtering can favor brittle strategies). This supports user-defined criteria (e.g., "always uses the same grasp strategy") over generic smoothness scores.

---

## 5. How Winnow works

1. **Describe (an interview)** — e.g. *"Expert pick-and-place: grasps on the first try, never drops the object, places it inside the target, no long pauses."* Spark drafts the Rubric, then Winnow's code checks coverage: phrases no Criterion covers, and values Spark had to assume. Spark asks questions anchored on real Episodes ("Is this 1.8 s pause long?"), highest impact first, until every phrase is mapped and nothing is assumed, or the user stops. Every answer is also a label.
2. **Compile** — each Criterion is a **typed call** to a fixed primitive (params, threshold, unit, margin, window, camera views, source phrase), and the English shown to the user is rendered from those fields, so the Rubric and the code can't drift apart. Spark composes checks from building blocks (condition × time pattern × phase × views) and routes each to the cheapest source that can decide it:
   - **Measured from robot data** (end-effector pose + gripper in droid_100; joint states and camera extrinsics too in droid_1.0.1): failed grasp attempts, pauses, completion time, release height, path efficiency.
   - **Tracked from SAM 3.1** across the views each Criterion needs (wrist for in-hand, both exteriors for placement): object lifted with the gripper, dropped, moved, ends inside the target.
   - **Visual** (Spark on a specific moment the measurements point to, cropped to the SAM box): what geometry can't decide, e.g. "grasped by the handle", spills, upright.
   - Each Criterion is **hard** (fail = reject) or **soft** (adds to a quality score; scored relative to the dataset, never rejects alone). A free dry run shows each Criterion's pass rate before the user confirms.
3. **Score** — every Episode gets per-Criterion results with Evidence (value, threshold, time window, track plot, the frame where it went wrong). Spark reads the robot-data and SAM event timeline, investigates with tools (crop a view at a time, track another concept), and writes the **Reason**.
4. **Triage with self-monitoring** — any clear hard fail → Reject; all hard Criteria clearly pass → Keep; otherwise Needs review, with why. Uncertainty signals:
   - measurement within a Criterion's margin of its threshold
   - Spark's answers disagree across 3 paraphrased samples, or Spark answers "unsure" (not its stated confidence, which ranks errors near chance)
   - sources disagree (robot data vs SAM vs Spark) or camera views disagree
   - poor tracking health in every relevant view
   - **Rubric sanity monitor:** a Criterion rejecting ~0% or ~95% of Episodes is probably mis-specified → warn; also show *what* it removes.
   - Before a Reject, Spark tries to refute the claimed failure.
5. **Calibrate** — two label streams. **Review labels** (Needs review, least confident first) tune the margins and *suggest* threshold changes the user accepts. **Audit labels** (a seeded random sample of auto-Keeps) are the only input to precision, reported as a count plus an interval ("14/15 good, 95% CI 0.70–0.99"), never "±" from 20 labels. Labels can move Episodes either way. *"Label 20 Episodes, curate 2,000."*
6. **Output** — filtered dataset in the same (LeRobot) format + a Reason for every rejection.
7. **Iterate** — edit one sentence, re-sort instantly (cache keyed by Criterion, params and Episode; only changed Criteria re-run; dragging a threshold calls no model).

---

## 6. Meta models — used in non-obvious ways

| Model | Role | What makes it more than a basic integration |
|---|---|---|
| **SAM 3.1** (Model API, `sam-3.1`) | Tracks the gripper and objects from a seed box (text prompts fail on the gripper and small objects at 320×180); each call takes one concept and one camera and returns per-frame boxes, masks, track ids, and confidence | The *measurement backbone*: with robot data, it decides physical facts (lifted, dropped, moved, inside target) across camera views, and steers Spark to the right moment and crop |
| **Muse Spark 1.3** | Runs the Describe interview; composes typed Criteria; picks what SAM tracks; investigates the event timeline; judges only what geometry can't; challenges failures before Reject; writes Reasons; proposes missing Criteria | Never the holistic judge (that's the baseline). Checks run in Winnow's own code (the API has no hosted code execution), which Spark calls as function tools |
| **Muse Voice Transcribe** | Talk-while-watching labeling: narrate verdicts while watching an episode | Moment labels from speech (turn-level timestamps aligned to the video playhead; the API has no word-level timestamps); can draft the rubric from spoken critique |
| **Muse Glimmer** (open weights; hosted via OpenRouter, not on the Meta Model API) | Independent second-opinion judge on keyframes of borderline episodes (images only, no video); running locally is roadmap (needs a 32 GB+ Mac) | Different model than Spark catches different mistakes; open-weights bonus |
| **Muse Wonder** | (Stretch / roadmap) agent that improves the rubric against labeled episodes, with budget and stopping rules | Applies my self-monitoring research-agent architecture |
| **Muse Image** | (Roadmap) edit a keyframe to insert an obvious failure; check whether the judge's verdict flips | An image model auditing another model's attention |

**Cost cascade:** robot-data measurements are free; first-pass judging on Spark's cheaper tier; only uncertain episodes escalate. Pitch metric: cost per 1,000 episodes curated. Pricing: Spark contributor $0.10 / $0.20 per 1M tokens (150 RPM, no `max` reasoning), standard $1.25 / $4.25 (3,000 RPM); SAM 3.1 $0.20 per 1,000 frames. Measured on Day 1: Spark video is ~72 input tokens per camera-second, and reasoning output is 50–80% of the per-Episode cost, so escalate by changing the input (crop, keyframes, Glimmer), not with `max`. SAM dominates spend: ~$0.40 per Episode at full fps for 3 views × 3 concepts, ~$0.08 with the gripper taken from robot data and SAM at ~5 fps (untested).

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
- **Bar to beat:** same episodes, same Meta model — **Spark alone vs. Winnow**. Win on **right decision for the right reason**: decision accuracy and false-keep rate on true failures, plus whether each Reject's Reason matches what happened (failure type and time). On Day 1, Spark alone got all 5 decisions right but told the wrong story on episode 42.
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
- **Headline comparison:** Spark alone vs Winnow on the same Episodes — false-keep rate on true failures (Wilson CI), Reason correctness, and Keep precision **at matched coverage**; plus Winnow's worst case with every Needs review forced to Keep, risk–coverage curves for both, and McNemar discordant counts (show counts; ~100 Episodes won't reach significance on small gaps).
- **Baselines:** Spark alone (FailBench protocol) and **episode length alone** (5 of 7 curation metrics exploit length; in droid_100 failures are *shorter*).
- **Curation metrics:** audited precision on kept Episodes (count + interval); false keeps and false rejects reported separately; coverage at fixed precision (risk–coverage curve); human review minutes saved; cost per 1,000 episodes.
- **Later:** adjudicate disagreements with provider labels (labels can be wrong — "dataset said success, Winnow said failure, here's the video" could be a demo moment).
- **Not in scope:** training a policy on filtered data (needs GPUs) → "next steps."

---

## 13. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Vague descriptions → vague filter | Compile → confirm → calibrate loop; rubric shown before running |
| AI judges weak on contact-heavy tasks | Hero demo on pick-and-place (object motion visible); route ambiguity to review |
| Video token cost | Measure on day 1; compute measured criteria from robot data; send video only for visual criteria; crop to SAM boxes in our own code (savings unproven until measured) |
| SAM loses small/fast objects; text prompts fail | All LeRobot DROID video is 320×180. Seed SAM with boxes (candidates under evaluation: project the gripper from robot data + droid_1.0.1 camera extrinsics, a small gripper detector, one hand-drawn box per Episode as the fallback); track the views each Criterion needs (wrist for in-hand); poor tracking health in every view → Needs review |
| "Infra for ML people" perception | Lead with the simple pitch and a concrete clip; firsthand club story |
| Competition (Shotwell, Roboto, Instance, RoboFAC, data platforms) | "Plain-English criteria" alone is no longer unique. Lead with fusing robot data, tracks and video, calibrated Needs review, and reported false-keep rates |
| Quality filtering hurts diversity (CUPID; Bedi) | Keep re-grasp and smoothness Criteria soft by default; the sanity monitor shows *what* a Criterion removes; claim review time saved, not better policies |
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