# What is in the RoboFAC real-world split

Research for issue #6. Written 2026-10-27. Checked against the Hugging Face repos at the revisions listed below, the paper (arXiv 2505.12224v5), and the official GitHub repo.

**Question:** What is in the RoboFAC real-world split (HF `IffYuan/RoboFAC`)? Size, task types (how much is pick-and-place), video and robot-data format, what the failure-location and failure-type labels look like, licence, download size, and any reported label-quality issues. Could it supply the labelled Episodes for Winnow's headline numbers?

**Short answer:** The real-world split has **602 Episodes: 480 failures and 122 successes**, so AGENTS.md is right. Each Episode has two camera views, which makes 1,204 videos. They come from a teleoperated SO-100 arm across 6 tasks. Only **160 Episodes (27%) are pick-and-place**: PickCubeInBox and StackCube, 80 each. The release is **video only**. It has **no joint, gripper, or action data**, so Winnow's measured Criteria cannot run on it. Failure-location labels name a **subtask, not a timestamp**. The failures were **staged**: each task's failures come in blocks of exactly 20 Episodes per (error type × subtask) cell. Frontier judges already score about 0.90–0.95 balanced accuracy on it, and GPT-4o scores 97% plain accuracy on its failure-detection questions. **Verdict: it should not supply the headline Spark-alone vs Winnow numbers.** It can serve as a secondary, video-only check of tracked and visual Criteria and of the "says success on a true failure" rate. `IffYuan/RoboFAC` is an unofficial, uncarded re-upload. Use the official `MINT-SJTU/RoboFAC-dataset` (MIT) instead.

## Sources

| Ref | Source | What it is |
|---|---|---|
| [I] | https://huggingface.co/datasets/IffYuan/RoboFAC, revision `5518d3a4`, created 2026-08-20 | The repo named in AGENTS.md. It has no README/dataset card, no licence, and no discussions. It holds `RoboFAC_realworld.zip` and `merged_qa_data_transformed.json` only (`/api/datasets/IffYuan/RoboFAC/tree/main`). |
| [O] | https://huggingface.co/datasets/MINT-SJTU/RoboFAC-dataset, revision `d18353ab`, card `README.md` | The official release by the paper's authors (MINT group, SJTU). It contains `realworld_data/`, `simulation_data/`, `test_qa_realworld/`, `test_qa_sim/`, and `training_qa.json`. |
| [P] | arXiv 2505.12224v5, "RoboFAC: A Comprehensive Framework for Robotic Failure Analysis and Correction", Ye et al., v5 dated 2026-10-07 (first version 2025-05-18) | The paper. Section numbers are from the v5 PDF. |
| [G] | https://github.com/MINT-SJTU/RoboFAC (MIT, last pushed 2026-07-15) and its issues #3, #5, #10 | The official code repo. |
| [A] | Own inspection of `test_qa_realworld/annos_per_video_split{0..6}.json` from [O] and `merged_qa_data_transformed.json` from [I] | Counts in this note come from these files unless another source is cited. |
| [Z] | Central directory of `RoboFAC_realworld.zip` from [I], read with HTTP range requests (the 2.2 GB archive was not downloaded) | File listing of the zip. |
| [V] | `ffprobe` on one video: `realworld_data/so100_pick_cube_in_box_error/videos/chunk-000/observation.images.above/episode_000000.mp4` from [O] | Video format. |
| [F] | `research/failbench.md` on branch `research/failbench` (issue #5) | Secondary. It reports FailBench's numbers on its `robofac` subset. I did not re-check them against the FailBench paper. |
| [C] | https://huggingface.co/datasets/cedricxie/robofac-lerobot-preview, card | A third-party LeRobot conversion. Used only as corroboration. |

## 1. Which repo to use

- `IffYuan/RoboFAC` is **not the official release**. Its uploader is not among the paper's authors (Zewei Ye, Weifeng Lu, Minghao Ye, Tao Lin, Shuo Yang, Junchi Yan, Bo Zhao [P]). It has no dataset card or licence [I], and it was created 2026-08-20, more than a year after the official repo (created 2025-05-24) [I, O].
- Its content is a **repackaging of the official real-world test split**:
  - The zip holds 1,204 MP4s under the same `realworld_data/so100_*_error/videos/chunk-000/observation.images.{above,rightfront}/episode_NNNNNN.mp4` paths as [O], plus `extracted_qa_data.json` (955 KB) and per-folder `.gitattributes` [Z].
  - Its `merged_qa_data_transformed.json` has 3,124 multiple-choice records whose IDs are the official per-video UUIDs plus a suffix. For example, `9b43fc5b-…_failure_detection` matches record `9b43fc5b-…` in [O]'s `annos_per_video_split0.json` [A].
- **Recommendation:** download from `MINT-SJTU/RoboFAC-dataset`. The official card states the MIT licence, and the authors confirmed it in [G] issue #3: "It has the MIT license." Per-task folders can be fetched individually, so the whole split need not be downloaded.

## 2. Size

| | Count | Source |
|---|---|---|
| Episodes | **602** (480 failures + 122 successes) | [P §3.1]: "8,960 simulated and 480 real-world failure trajectories … 1,160 successful simulated trajectories and 122 real-world ones"; reproduced exactly from the annotations [A] |
| Videos | 1,204 (2 views per Episode: `above` and `rightfront`) | [A], [Z] |
| Real-world QA pairs | 7,848 in the official per-video annotations (the paper says "8K") | [A], [P §3.1] |
| IffYuan MCQ records | 3,124 (1,204 detection + 960 identification + 960 locating) | [A] |
| Failure base rate | 79.7% (480/602) | [A] |

The two views of an Episode always carry identical labels: 0 of 602 Episodes have views that disagree [A]. In the annotation files, each view is its own record with its own UUID [A].

## 3. Tasks and how much is pick-and-place

All 6 real-world tasks use a teleoperated SO-100 arm [P §3.3]. Counts are per Episode [A]:

| Task (annotation name) | Folder | Episodes | Failures | Successes | Kind |
|---|---|---|---|---|---|
| PickCubeInBox (the paper calls it PlaceCube) | `so100_pick_cube_in_box_error` | 80 | 60 | 20 | **pick-and-place** |
| StackCube | `so100_stack_cube_error` | 80 | 60 | 20 | **pick-and-place** (stack) |
| InsertCylinder | `so100_insert_cylinder_error` | 120 | 100 | 20 | pick, reorient, insert |
| PullCubeByTool | `so100_pull_cube_by_tool_error` | 160 | 140 | 20 | tool use |
| PullCube | `so100_pull_cube_error` | 82 | 60 | 22 | non-prehensile pull |
| PushCube | `so100_push_cube_error` | 80 | 60 | 20 | non-prehensile push |

- **Strict pick-and-place: 160 Episodes (26.6%), with 120 failures and 40 successes.** Counting InsertCylinder as pick-and-place too gives 280 Episodes (46.5%).
- InsertCylinder and PlaceCube do not appear in the simulated training data [P §5.1].
- Every folder name ends in `_error`, **including the successes**. Successes are the highest-numbered Episodes of each task. For example, InsertCylinder Episodes 0–99 are failures and 100–119 are successes; PickCubeInBox Episodes 0–59 fail and 60–79 succeed [A]. The third-party LeRobot conversion [C] marks every `*_error` Episode as `next.success=False`, which mislabels all 122 successes. Do not derive labels from folder names.

## 4. Video and robot-data format

- **Video:** AV1, 640×480, 30 fps. The sampled Episode is 9.4 s long (282 frames, 1.7 MB) [V]. The layout is LeRobot-style (`videos/chunk-000/observation.images.<view>/episode_NNNNNN.mp4`) [O]. Total size is about **2.2 GB**: the IffYuan zip is 2,199,788,139 bytes, and its 1,204 MP4s total about 2,201 MB [I, Z]. Per task in [O]: PickCubeInBox 313 MB, StackCube 319 MB, InsertCylinder 472 MB, PullCubeByTool 532 MB, PullCube 266 MB [O tree API].
- **Robot data: none.** Neither the official `realworld_data/` nor the IffYuan zip contains any parquet, HDF5, or JSON sidecar. Both hold MP4s and `.gitattributes` only [O tree API, Z]. The card's instructions for kinematics (`.h5` + `.json` "in each leaf directory") apply to `simulation_data/` only [O]. This is independently corroborated:
  - [G] issue #10 (opened 2026-10-13, no reply as of 2026-10-27) says the real-world listing "contains MP4s and `.gitattributes`, but no JSON/HDF5 sidecars". It asks whether the two cameras are synchronized and whether capture-time metadata exists.
  - [C] says the real-world source is "video-only" and fills action/state with "zero placeholders".
  - [G] issue #5: the authors say "all the data we collected has already been released".
- **Consequence for Winnow:** on this split, only **tracked** Criteria (from SAM 3.1 tracks) and **visual** Criteria (Spark on video) can run. Measured Criteria (completion time from joint states, pauses, jerk, re-grasp count from the gripper) cannot. Completion time and pauses can only be approximated from video. Whether Spark and SAM 3.1 accept AV1 directly is **unverified**. Transcoding to H.264 with ffmpeg may be needed.

## 5. What the labels look like

### The official per-video record (real-world, one view)

From [O] `test_qa_realworld/annos_per_video_split0.json`, trimmed. This record is Episode 0 of InsertCylinder, a failure:

```json
"9b43fc5b-5fc6-4248-a751-41881bc74a3d": {
  "video": "so100_insert_cylinder_error/videos/chunk-000/observation.images.above/episode_000000.mp4",
  "task": "InsertCylinder",
  "annos": {
    "Task identification":   [{"from":"human","value":"<image>\nWhat is the robot doing in the video? ..."},
                              {"from":"assistant","value":"Insert the cylinder into the middle hole of the shelf."}],
    "Task planning":         [..., {"value":"1. Reach for the cylinder on the table.\n2. Grasp the cylinder.\n3. Lift the cylinder off the table.\n4. Rotate the cylinder to an upright position.\n5. Move the cylinder to the middle hole of the shelf.\n6. Insert the cylinder into the middle hole of the shelf."}],
    "Failure detection":     [..., {"value":"No."}],
    "Failure identification":[{"value":"<image>\nPlease describe the error type ... options: ['Orientation deviation.', 'Grasping error.', 'Position deviation.']"},
                              {"value":"Position deviation."}],
    "Failure locating":      [{"value":"<image>\n... during which subtask did the error happen? ... options: ['Rotate the box to an upright position.', 'Pull the green cube off the turntable.', 'Move the LEGO brick behind the cup.', 'Reach for the cylinder on the table.', 'Move the plug toward the USB slot.']"},
                              {"value":"Reach for the cylinder on the table."}],
    "Failure explanation":   [..., {"value":"The task failed because the robotic arm's end effector was not properly aligned with the cylinder during the grasping action. ..."}],
    "High-level correction": [..., {"value":"The robotic arm should repeat the subtask of reaching for the cylinder on the table, ensuring proper alignment before attempting to grasp the cylinder."}],
    "Low-level correction":  [..., {"value":"Move the robotic arm slightly backward to increase distance from the table, then adjust the arm to the left ..."}]
  }
}
```

A success record has only `Task identification`, `Task planning`, and `Failure detection` ("Yes.") [A]. `Low-level correction` is present on 396 of 960 failure videos [A].

### The same Episode in the IffYuan MCQ file

```json
{"id": "9b43fc5b-5fc6-4248-a751-41881bc74a3d_failure_locating",
 "video": "so100_insert_cylinder_error/videos/chunk-000/observation.images.above/episode_000000.mp4",
 "type": "Failure locating",
 "question": "This is a video of a robotic arm performing a task, during which subtask did the error happen? (Your answer should choose one of the following options: [A. Rotate the box to an upright position.; B. Pull the green cube off the turntable.; C. Move the LEGO brick behind the cup.; D. Reach for the cylinder on the table.; E. Move the plug toward the USB slot.])",
 "answer": "D"}
```

The file keeps only the three closed-form question types. Failure detection is always `[A.Yes; B.No]`, with B (failure) correct 960 times and A 244 times [A].

### Label semantics

- **Failure location = a subtask name, not a time.** No record contains a timestamp or frame index [A]. To use this label as Evidence, Winnow would have to map the subtask onto the timeline itself.
- **Failure locating is easier than it looks.** The paper builds the options from "four sub-stages randomly sampled from all the sub-stages in the RoboFAC dataset" plus the correct one [P App. E]. In practice the distractors come from other tasks (turntable, LEGO, USB plug), and the right answer is usually the only option that fits the task [A].
- **Failure type uses 3 values in the real-world split:** Position deviation (280 Episodes), Grasping error (140), Orientation deviation (60) [A, per Episode]. The paper's taxonomy has six (adding Step omission, Wrong target object, and Timing error), and App. E says identification offers all six options. The released real-world questions offer only the three above [A], which is a minor inconsistency with [P App. E].
- **The failures were staged by design.** Every failure falls in a cell of exactly 20 Episodes [A]. For example:

  | Task | Error type × failing subtask (Episodes) |
  |---|---|
  | PickCubeInBox | Grasping error × reach for cube (20) · Position deviation × reach for cube (20) · Position deviation × put down in box (20) |
  | StackCube | Grasping error × reach (20) · Position deviation × reach (20) · Position deviation × stack red on green (20) |
  | InsertCylinder | Grasping × reach (20) · Orientation × rotate upright (20) · Position × reach (20) · Position × insert (40) |

  So the failures are deliberate, teleoperated failures of chosen kinds. They are not naturally occurring mistakes in demonstrations.

## 6. Where the labels come from, and label quality

- Detection, identification, and locating answers are "directly extracted from the corresponding textual description". Explanation and the two correction answers are **generated by GPT-4o** from the video plus that description [P §3.3]. For real-world data, "each video is paired with a corresponding textual description" [P §3.3]. The paper does not say who wrote these descriptions; presumably the teleoperator, who knew which failure they were staging.
- Human verification: the paper says a 4-level human quality rating covered "all samples", with inter-annotator agreement of Krippendorff's α = 0.86 on a 10% double-rated subset [P §3.3]. But App. D describes annotators reviewing "the simulated trajectory together with its corresponding LLM-generated annotation", and reports filtering as "8,559 trajectories retained and 3,809 removed" [P App. D]. **Whether the real-world Episodes were human-verified is not stated.** [G] issue #10 asks exactly this ("Which real-world answers are human-authored, model-generated or human-verified") and is unanswered.
- No HF discussions exist on either repo [I, O]. The GitHub issues report path and name problems in the **simulated** split only: `Rotation`/`Rotation2` should be `SpinStack`/`SpinPullStack` ([G] #2, #7). I found **no reported mislabels in the real-world split**. I also did not watch videos to audit labels, so label accuracy is unverified beyond the internal consistency checks above.
- Known pitfalls: success Episodes sit in `*_error` folders (see §3). The paper calls one task PlaceCube while the annotations call it PickCubeInBox [P §5.1, A]. Camera synchronization between the two views is undocumented ([G] #10).

## 7. How hard it is for judges

- In [P Table 6] (real-world), plain accuracy on failure detection is GPT-4o 97.18, Qwen2.5-VL-7B 83.39, Gemini-2.0 59.72, and RoboFAC-7B 80.65. With 79.7% failures, answering "No" every time scores 79.7%. RoboFAC-7B's score is about that, and [F] reports FailBench making the same observation.
- FailBench's `robofac (real)` subset (30 failures and 30 successes, sampled evenly across the three error types) gives Gemini 3 Flash 0.90 and Gemma-4-31B 0.95 balanced accuracy, with a 13-model mean of 0.72 [F]. It is one of the subsets FailBench calls near-saturated [F].
- So on RoboFAC real-world, a strong general model such as Spark alone will probably score high already. That leaves little room to show Winnow beating it, and it is the opposite of the "success when unsure" setting the pitch is about.

## 8. Could it supply the labelled Episodes for Winnow's headline numbers?

**Not as the headline. It is useful as a secondary benchmark.**

Against:
1. **No robot data.** Winnow's measured Criteria, and its "robot data and video disagree" uncertainty signal (AGENTS.md §5), cannot run. A headline built on this split would test only Spark and SAM, which undercuts the evidence-fusion story.
2. **Near-saturated for frontier judges** (§7). The Spark-alone vs Winnow gap is likely small.
3. **Staged failures, base rate inverted.** 80% failures in balanced blocks of 20. Real curation is 15–30% rejects (AGENTS.md §2). Precision-on-kept and coverage numbers would not transfer.
4. **Only binary success labels.** There are no "expert vs sloppy success" labels (for example, a success with a long pause or a re-grasp), so soft Criteria and the quality score cannot be evaluated.
5. **Only 160 pick-and-place Episodes (40 successes),** recorded on an SO-100 arm, not the DROID Franka used in the hero demo.

For:
1. **Real, MIT-licensed, small, already labelled.** 480 true failures with a failure type and a failing subtask. That is enough to measure **how often a judge says "success" on a true failure**, broken down by error type.
2. **Subtask locations** let Winnow check whether its Evidence points at the right phase of the Episode, once subtasks are mapped to time.
3. **Directly comparable to FailBench's robofac slice** [F]. Sampling 10 per error type plus 30 successes reproduces it.
4. **SO-100 + LeRobot layout** matches what a student club is likely to use. That supports "any robot", though not the hero demo.

**Suggested use:** a secondary, video-only robustness table. Download only `so100_pick_cube_in_box_error` and `so100_stack_cube_error` from [O] (about 630 MB, 160 Episodes). Report balanced accuracy and false-success rate for Spark alone vs Winnow (tracked and visual Criteria only), stating clearly that robot data was unavailable. The headline needs Episodes that include joint and gripper data.

## Not verified

- Video duration distribution across the split. Only one video was probed (9.4 s).
- Whether the two camera views are time-synchronized ([G] #10, unanswered).
- Who wrote the real-world textual descriptions and whether real-world QA was human-verified.
- Whether Meta's Spark and SAM 3.1 APIs accept AV1 input.
- Label correctness by watching Episodes. No video audit was done.
