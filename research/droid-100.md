# `lerobot/droid_100`: what's in it

*Research for issue #3. Checked 2026-10-26/27 against the dataset at commit `87301a2` (tag `v3.0`, branch `main`) on Hugging Face.*

## Answer in brief

- **It is not a pick-and-place dataset.** It is a random-looking slice of DROID with 47 task strings (one of them blank) across 100 Episodes. By instruction, **40 Episodes are clearly pick-and-place** and 16 more say "move X" and may or may not be. A further 19 have no instruction but *look* like pick-and-place when skimmed.
- **Success/failure is still in the port, though only implicitly.** `next.reward` is 1.0 on the final frame of the 81 success Episodes and 0 everywhere in the other **19**. This matches the 19 `/failure/` Episodes in HF discussion #2.
- **All 19 failures have no instruction**, and only about 10 of them look like pick-and-place. They are short or truncated: the median is 10.8 s against 16.5 s for successes. 0 of the 40 clearly-labelled pick-and-place Episodes are failures.
- **There is no joint data.** The 7-D `observation.state` is end-effector pose (xyz + roll/pitch/yaw) plus gripper. The 7-D `action` is a normalised Cartesian velocity command plus an *inverted* gripper command. Everything runs at 15 Hz.
- **There are 3 cameras** (2 exterior, 1 wrist), all left-stereo only, at **320×180, 15 fps, AV1**.
- **Episode 42** has no instruction in the port. The recovered instruction is "Move the black remote control to the left". It is labelled success. The video and gripper data show about 3 failed grasp attempts, then the remote being released about 10 cm above the cushion. It is a good hero clip.
- **~100 pick-and-place Episodes are not reachable from droid_100 alone**, and certainly not with a useful number of failures. The hero set needs another source. The obvious one is `lerobot/droid_1.0.1`, the full DROID in LeRobot v3.0 format, with 95,658 Episodes and an explicit `is_episode_successful` flag. But its failures almost never have an instruction (16,736 of 16,794 are blank), so failed pick-and-place Episodes there have to be found by watching or auto-classifying video.

---

## 1. Format and files

| Item | Value | Source |
|---|---|---|
| LeRobot format | `codebase_version: "v3.0"` on `main`. Older layouts are kept on branch `v2.0` (one mp4 per Episode per camera) and `v1.6`, plus tag `v2.1` | [meta/info.json](https://huggingface.co/datasets/lerobot/droid_100/blob/main/meta/info.json); [refs API](https://huggingface.co/api/datasets/lerobot/droid_100/refs) |
| Card is stale | README still shows the v2.0 `info.json` (`codebase_version: "v2.0"`, per-episode paths) | [README.md](https://huggingface.co/datasets/lerobot/droid_100/blob/main/README.md) |
| Episodes / frames / tasks | 100 / 32,212 / 47 (one task string is the empty string) | info.json; `meta/tasks.parquet` |
| Episode length | median 225.5 frames (15.0 s), range 13–1,627 frames (0.9–108.5 s), about 35.8 min total | computed from `meta/episodes/chunk-000/file-000.parquet` |
| Files on `main` | `data/chunk-000/file-000.parquet` (2.7 MB, all 100 Episodes), `meta/episodes/…/file-000.parquet`, `meta/tasks.parquet`, `meta/stats.json`. There are 3 videos, one per camera, each holding all 100 Episodes back to back: wrist 110 MB, exterior 1 175 MB, exterior 2 176 MB. Each Episode's slice is given by `videos/<key>/from_timestamp`/`to_timestamp` in the episodes parquet | [file tree API](https://huggingface.co/api/datasets/lerobot/droid_100) |
| Per-episode clips | Branch `v2.0` has `videos/chunk-000/<key>/episode_XXXXXX.mp4` (about 0.2–3.5 MB each), which is handy for fetching single Episodes | [v2.0 tree](https://huggingface.co/api/datasets/lerobot/droid_100/tree/v2.0/videos/chunk-000/observation.images.exterior_image_1_left) |
| `robot_type` | `"unknown"` in info.json. The hardware is actually a Franka Panda 7-DoF arm with a Robotiq 2F-85 gripper | info.json; [DROID paper §III](https://arxiv.org/html/2403.12945) |
| Licence | Card says MIT, but DROID is CC BY 4.0 (open HF discussion #4). Attribute DROID | [discussion #4](https://huggingface.co/datasets/lerobot/droid_100/discussions/4); [KarlP/droid](https://huggingface.co/datasets/KarlP/droid) tagged `cc-by-4.0` |
| Origin | A port of DROID's official 100-Episode debug sample `gs://gresearch/robotics/droid_100` (RLDS, about 2 GB). It is *not* the first 100 Episodes of `lerobot/droid_1.0.1`: 0 of the first 100 lengths match. 39 of the 46 labelled Episodes match exactly one full-DROID Episode on (length, task) | [DROID docs](https://droid-dataset.github.io/droid/the-droid-dataset.html); my join against `lerobot/droid_1.0.1` meta |

## 2. Robot data fields (all 15 Hz)

`info.json` lists `observation.state` (float32[7]), `action` (float32[7]), `timestamp`, `frame_index`, `episode_index`, `index`, `task_index`, `next.reward` (float32), and `next.done` (bool), each with `fps: 15`. The motor names are just `motor_0…motor_6`. Timestamps step by exactly 1/15 s (0.0667) in every Episode I checked.

The port doesn't document what the 7 dimensions mean. This is what the data shows:

| Field | Meaning | Evidence |
|---|---|---|
| `observation.state[0:3]` | End-effector position x, y, z in the robot base frame, in metres | Ranges x 0.14–0.83, y −0.54–0.73, z −0.14–0.80. The DROID RLDS has `cartesian_position` (6) ([builder](https://github.com/kpertsch/droid_dataset_builder/blob/main/droid/droid.py)) |
| `observation.state[3:6]` | End-effector orientation as Euler angles (rad) | dim 3 spans −π…π |
| `observation.state[6]` | Gripper position, 0 = open → 1 = closed | 0.0 at the start of Episode 42 with the gripper visibly open; 0.59 while holding the remote |
| `action[0:6]` | Commanded Cartesian velocity, normalised to [−1, 1] | Range ±1. Correlation with the finite-difference end-effector velocity is 0.82–0.84 for x, y and z across all Episodes |
| `action[6]` | **1 − commanded gripper position** (1 = open) | Correlation with `state[6]` is −0.96 in Episode 0. This matches the widely used Open-X/OpenVLA DROID transform `concat(cartesian_velocity, 1 − gripper_position)` ([droid_utils.py](https://github.com/openvla/openvla/blob/main/prismatic/vla/datasets/rlds/oxe/utils/droid_utils.py)). I can't confirm this is the exact code LeRobot used; it is inferred from the data |
| Joint positions / velocities | **Not present** | Raw DROID records 7-D joint positions and velocities ([paper App. B](https://arxiv.org/html/2403.12945)). This port keeps only Cartesian pose and gripper |
| `next.reward` | 1.0 on the last frame of success Episodes, otherwise 0 | See §4 |
| `next.done` | True on the last frame of every Episode (100/100) | computed |

Note that DROID's own docs describe the RLDS `action` as "[6x joint velocities, 1x gripper position]". The builder actually writes `cartesian_position + gripper_position` there ([builder L77](https://github.com/kpertsch/droid_dataset_builder/blob/main/droid/droid.py)), and this port's `action` is neither of those. Don't trust the doc strings; trust the numbers.

**What this means for measured Criteria:** completion time, pauses/idle time, smoothness/jerk, path length/efficiency, re-grasp count (gripper close/open cycles), release height and lift height can all be computed from end-effector pose plus gripper. Anything that needs joint angles cannot.

## 3. Cameras and video

| Key | View | Resolution | fps | Codec |
|---|---|---|---|---|
| `observation.images.exterior_image_1_left` | Exterior ZED 2 #1, left lens | 320×180 | 15 | AV1, yuv420p |
| `observation.images.exterior_image_2_left` | Exterior ZED 2 #2, left lens | 320×180 | 15 | AV1, yuv420p |
| `observation.images.wrist_image_left` | Wrist ZED Mini, left lens | 320×180 | 15 | AV1, yuv420p |

Sources: info.json `features`, confirmed with `ffprobe` on the `v2.0` Episode 42 clip (`av1, 320x180, 15/1, 331 frames`). Camera models are from the [DROID paper](https://arxiv.org/html/2403.12945). Raw DROID has 1280×720 stereo, but that is the 8.7 TB `droid_raw` bucket ([DROID docs](https://droid-dataset.github.io/droid/the-droid-dataset.html)). The 320×180 frames are small: objects like markers are a few pixels wide in exterior views, which matters for SAM tracking (AGENTS.md risk "SAM loses small/fast objects"). The wrist view is often the most informative for grasp outcomes. Decoding AV1 needs a dav1d/libaom-enabled ffmpeg. Homebrew ffmpeg worked.

## 4. Success/failure labelling

- DROID collectors marked each Episode success or not. Roughly 16k "not successful" trajectories are included in DROID's release, but "do not count towards the size of DROID" ([paper](https://arxiv.org/html/2403.12945)). The raw path contains `/success/` or `/failure/`.
- The RLDS builder sets `reward = 1.0` on the last step **iff `'success' in episode_path`** ([builder L79](https://github.com/kpertsch/droid_dataset_builder/blob/main/droid/droid.py)). The RLDS `episode_metadata.file_path` (the raw path) is **not** carried into this port.
- In the port, `next.reward` sums to 1.0 in **81** Episodes (always on the final frame) and to 0 in **19**: **5, 9, 18, 41, 47, 48, 49, 55, 59, 61, 65, 67, 76, 79, 82, 83, 85, 86, 87**. HF discussion #2 independently found **19** Episodes from `/failure/` paths by joining against DROID's `episode_id_to_path.json` ([discussion #2](https://huggingface.co/datasets/lerobot/droid_100/discussions/2)). The counts match, and every Episode that discussion lists as "success" has reward 1 here. *The discussion doesn't list the 19 by number, so the 1:1 identity is inferred from the builder code and the matching count, not checked against paths.*
- So the outcome label wasn't fully lost in conversion. There is no explicit field, but `next.reward` encodes it. The thing that *was* lost is language: 54 of 100 Episodes have an empty task string. That is all 19 failures plus 35 successes, 25 of which have instructions recoverable from DROID's crowd annotations (`KarlP/droid` `droid_language_annotations.json`, per discussion #2).
- The failure Episodes look like aborted attempts, not completed-but-bad demos. Median 162 frames against 248 for successes. Some are degenerate: 79 is 13 frames (0.9 s), 61 is 3.3 s, 41 is 5.9 s, and in 41/61/67 the gripper never closes.
- A third-party audit (HF discussion #3, RDA tool) reports 66/100 Episodes flagged REVIEW and a 70.7 % median idle ratio ([discussion #3](https://huggingface.co/datasets/lerobot/droid_100/discussions/3)). This is a useful foil for "motion metrics ≠ task judgment". Unverified by me.

## 5. Episode 42 and the failure Episodes

**Episode 42**: success label (reward 1), no instruction in the port. Recovered instruction: *"Move the black remote control to the left"* (discussion #2). 331 frames (22.1 s), in a living room with a couch and cushions. I skimmed the three camera views at 1 fps and dumped the gripper and end-effector traces from the parquet:

| Time | What happens (robot data) | Video (wrist / exterior) |
|---|---|---|
| 0–6.8 s | Gripper open (0.0). End effector descends from z 0.40 to −0.02 m | Approaches the remote on a cushion |
| 7.0–7.8 s | Grasp 1: closes to 0.44, reopens | Fumbles at the remote |
| 8.6–10.0 s | Grasp 2: closes to 0.57, lifts about 3 cm, reopens | Remote not secured |
| 14.0–15.2 s | Grasp 3: closes to 0.53, partly reopens | Regrasping |
| 15.4–18.0 s | Grasp 4 holds at 0.59. Lifts to z ≈ 0.10 m (about 12 cm above grasp height) and moves | Remote in gripper, swinging |
| 18.2–18.8 s | **Open commanded** (`action[6]` 0.16 → 1.0) at z ≈ 0.08 m. Gripper state then falls to 0 | Remote falls onto the cushion |
| 19–22 s | Arm retreats upward with gripper open | Remote lies on the cushion, rotated |

So discussion #2's "remote dropped mid-motion" fits the video. But the robot data says the teleoperator *commanded* the release about 10 cm above the surface; the remote didn't slip out of a closed gripper. Either way it is sloppy by any reasonable "expert" Rubric: 3 failed grasps, then a release from height. Measured Criteria (re-grasp count, release height) catch it without any vision.

**Failure Episodes**: all 19 have empty instructions. From a skim of 8 evenly spaced exterior-1 frames each (low confidence; no language to check against):

- **Look like pick-and-place (10)**: 5 (green block + bowl; clip ends at 5.8 s as the arm reaches the block), 47, 48, 49, 59, 76, 83, 85, 86, 87.
- **Unclear (5)**: 9, 41, 61, 65, 67.
- **Not pick-and-place (4)**: 18 and 55 (cloth), 79 (empty 0.9 s), 82 (opening a cardboard box).

## 6. Which Episodes are pick-and-place

Classification rule: "P&P" means the instruction asks to grasp an object and put it somewhere (in, on, onto, or out of a container), including deformables and multi-step chains. "Maybe" means the instruction says "move X <direction>" or similar: DROID collectors often do these by pick-and-place, sometimes by pushing, so check the video. "Likely P&P (video only)" means there is no instruction and my frame skim suggests pick-and-place. Instructions come from the port, from discussion #2's recovered labels, or (for blanks) my description of the video. Max gripper is the peak of `observation.state[6]`: 0 means the gripper never closed.

| Class | Success | Failure | Total |
|---|---|---|---|
| P&P (instruction says so) | 40 | 0 | **40** |
| Maybe (move / lid / mixed) | 16 | 0 | 16 |
| Likely P&P (video only, no instruction) | 9 | 10 | 19 |
| Unclear | 1 | 5 | 6 |
| Not P&P | 15 | 4 | 19 |

#### P&P (40)

| Ep | Outcome | Len (s) | Max gripper | Instruction | Instruction source |
|---|---|---|---|---|---|
| 0 | success | 11.1 | 0.81 | Put the marker in the pot | port |
| 1 | success | 15.9 | 0.72 | Put the candy bar on the left side of the first shelf | port |
| 2 | success | 9.5 | 0.75 | Put one green sachet in the grey bowl. | port |
| 3 | success | 13.7 | 0.99 | Place the pack of doritos inside the sink | port |
| 6 | success | 12.1 | 0.81 | Take the pen out of the bowl and place it on the table | port |
| 7 | success | 39.7 | 0.59 | Pick up the orange block on the right and put it on top of the orange block | recovered (HF disc. 2) |
| 8 | success | 7.6 | 0.81 | Put the metal object with the orange handle in the blue cup | recovered (HF disc. 2) |
| 11 | success | 26.9 | 0.12 | Move the glass to the second row in the dishwasher | port |
| 12 | success | 14.3 | 0.5 | Pick up the lid from the table and put it on the pot | port |
| 13 | success | 13.1 | 0.99 | Pick up the black object from the striped towel and place it on the white sheet of paper on the right | port |
| 16 | success | 11.5 | 0.67 | Pick up the blue block and put it in the white mug on the right | recovered (HF disc. 2) |
| 17 | success | 17.6 | 0.99 | Put the cloth on the table | recovered (HF disc. 2) |
| 21 | success | 6.1 | 0.59 | Put the orange rubber duck into the pot | port |
| 24 | success | 71.1 | 0.94 | Put the tissues in the rubbish bin. | port |
| 25 | success | 37.2 | 0.99 | Put the middle fork in the middle section of the white object | port |
| 26 | success | 7.9 | 0.87 | Put the  cable in the storage box | port |
| 27 | success | 24.4 | 0.85 | Put the bread in the toaster | port |
| 28 | success | 26.5 | 0.95 | Put the white book on top of the tissue box. | port |
| 32 | success | 13.8 | 0.59 | Put the green packet inside the plastic bowl | recovered (HF disc. 2) |
| 35 | success | 19.8 | 0.89 | Put the towel on the bottle to the right | port |
| 39 | success | 45.6 | 0.96 | Take two folded white cloths out of the white box on the left | port |
| 40 | success | 55.5 | 0.9 | Put the objects on the table into the cardboard box | port |
| 45 | success | 19.5 | 0.8 | Place the calculator on the coaster | recovered (HF disc. 2) |
| 46 | success | 21.3 | 0.64 | Place the small bottle on top of the air fryer | recovered (HF disc. 2) |
| 50 | success | 89.8 | 1.0 | Put the towel on the table into the box | port |
| 51 | success | 11.7 | 0.8 | Place the lid on the silver pot | recovered (HF disc. 2) |
| 53 | success | 25.9 | 0.8 | Pick up the computer mouse and put it in the microwave | port |
| 54 | success | 8.4 | 0.81 | Put the marker inside the cup | port |
| 56 | success | 40.1 | 0.96 | Pick up the white towel and put it in the basket , pick up the marker and put it in the cup, then, pick up the yellow towel and put it in the basket, and finally pick up the masking tape and put it in the cup | port |
| 58 | success | 14.2 | 0.96 | Pick up the blue cup and put it in the pink cup | recovered (HF disc. 2) |
| 60 | success | 9.6 | 0.54 | Put the green block in the bowl | port |
| 66 | success | 9.3 | 0.88 | Put the orange toy into the wooden box | port |
| 69 | success | 26.7 | 0.91 | Move the orange objects from the pullout table to the desk | port |
| 72 | success | 22.4 | 0.96 | Lift the pink bowl and place it into the green bowl, pick up the yellow cup and place it into the stacked bowls, then place them on top of the microwave | recovered (HF disc. 2) |
| 88 | success | 8.5 | 0.85 | Put the silver lid on the stove | recovered (HF disc. 2) |
| 89 | success | 12.4 | 0.73 | Pick up one small bottle from the container and put it on the table. | port |
| 91 | success | 6.7 | 0.57 | Put the yellow cube inside the blue cup | port |
| 96 | success | 22.5 | 0.8 | Get the marker from the table and place it in the colorless cup | port |
| 97 | success | 38.5 | 0.7 | Pick the two bottles on the stove and place them on the counter, then pick the cooking stick from the pot and place it on the stove | port |
| 98 | success | 74.7 | 0.93 | Take the blocks out of the gift disappointed | port |

Simple rigid single-object picks, which make the cleanest hero material, are: 0, 1, 2, 3, 6, 7, 8, 12, 13, 16, 21, 26, 27, 32, 45, 46, 51, 53, 54, 58, 60, 66, 88, 89, 91, 96. That is about 26. Episode 11 peaks at only 0.12 gripper closure, so check whether the glass was really grasped.

#### Maybe (move / lid / mixed) (16)

| Ep | Outcome | Len (s) | Max gripper | Instruction | Instruction source |
|---|---|---|---|---|---|
| 4 | success | 14.2 | 0.8 | Move the sharpie to the table | port |
| 10 | success | 23.8 | 0.67 | Move the pan to the right. | port |
| 14 | success | 23.7 | 0.79 | Move the orange towel to the left | recovered (HF disc. 2) |
| 34 | success | 17.3 | 0.61 | Move the vaseline closer to the mirror | port |
| 38 | success | 15.0 | 0.93 | Move the fleece to the left a bit | recovered (HF disc. 2) |
| 42 | success | 22.1 | 0.59 | Move the black remote control to the left | recovered (HF disc. 2) — done by picking (see §5) |
| 43 | success | 10.5 | 0.76 | Move the brown object to the right | recovered (HF disc. 2) |
| 52 | success | 40.3 | 0.95 | Turn the tap on and off and put the spoon in the dishes tray | port |
| 64 | success | 18.9 | 0.83 | Move the blue spoon forward | recovered (HF disc. 2) |
| 68 | success | 14.1 | 0.99 | Take the lid off the smaller pot | port |
| 70 | success | 6.7 | 0.82 | Move the green plush to the left | port |
| 74 | success | 11.1 | 0.91 | Move the yellow mug forward | port |
| 75 | success | 15.1 | 0.95 | Move the cup to the right | port |
| 78 | success | 21.5 | 0.0 | Move the white container backwards | recovered (HF disc. 2) — gripper never closes, so a push |
| 92 | success | 8.3 | 0.94 | Move the pot to the top left corner of the table | port |
| 95 | success | 10.5 | 0.99 | Move some letter tiles to the left | recovered (HF disc. 2) |

#### Likely P&P, video only (19; no instruction anywhere in the port)

| Ep | Outcome | Len (s) | Max gripper | What the video shows (my skim) |
|---|---|---|---|---|
| 5 | FAILURE | 5.8 | 0.49 | green block and black bowl on table; arm reaches the block; clip ends at 5.8 s |
| 19 | success | 11.4 | 0.96 | arm grasps an object near a teal bowl among blocks |
| 29 | success | 15.1 | 0.67 | arm picks small colored blocks near stacked yellow plates |
| 30 | success | 24.1 | 0.68 | arm picks a teal object and moves it near a blue tray |
| 33 | success | 18.7 | 0.48 | arm picks a cube from a stack of colored cups/blocks |
| 44 | success | 26.0 | 0.93 | arm moves fruit/items into a tray |
| 47 | FAILURE | 8.6 | 0.77 | arm reaches toward a bottle beside a book |
| 48 | FAILURE | 15.3 | 0.75 | arm picks an item near a red bowl among dishes |
| 49 | FAILURE | 10.8 | 0.5 | arm grasps one of several cans/bottles |
| 59 | FAILURE | 9.9 | 0.73 | arm reaches into a wooden box with orange items |
| 73 | success | 25.9 | 0.59 | arm picks a banana from a tray and sets it on the table |
| 76 | FAILURE | 11.4 | 0.87 | arm grasps a clear object on a table |
| 80 | success | 75.9 | 0.84 | arm picks an object from a kitchen counter |
| 83 | FAILURE | 6.1 | 0.72 | arm picks a green object among colored cups/rings |
| 84 | success | 108.5 | 0.98 | arm moves utensils between cutlery trays |
| 85 | FAILURE | 8.7 | 0.42 | arm grasps an orange object among cups on a table |
| 86 | FAILURE | 5.7 | 0.99 | arm moves to a toaster next to a red bowl |
| 87 | FAILURE | 38.2 | 0.99 | arm carries an orange/brown stick-like object near a drawer unit |
| 90 | success | 44.1 | 1.0 | arm picks items into a black basket |

#### Unclear (6) and not pick-and-place (19)

- **Unclear**: 9 (F), 41 (F, gripper never closes), 61 (F, 3.3 s), 62 (S, 55 s, counter with cups and box), 65 (F), 67 (F, gripper never closes).
- **Not P&P**: 15 flip container · 18 (F) towel on chair · 20 slide lid off · 22 wipe whiteboard · 23 light switch · 31 press remote button · 36 pour + fold paper · 37 wipe surface · 55 (F) cloth · 57 press keyboard · 63 press remote · 71 cloth folding · 77 close drawer · 79 (F) 0.9 s, empty · 81 tap · 82 (F) open box · 93 faucet · 94 open fridge · 99 scooping.

## 7. Is ~100 pick-and-place Episodes reachable?

**Not from droid_100.** The ceiling is 40 certain pick-and-place Episodes, about 56 counting "move" tasks, and about 75 counting unlabelled ones that look like pick-and-place. Only about 10 of those are failures, all with no instruction and mostly truncated. A ~100-Episode scored set from droid_100 would be roughly half non-pick-and-place, with almost no informative failures.

**The cheapest supplement is `lerobot/droid_1.0.1`.** That is all of DROID in the same LeRobot v3.0 format ([info.json](https://huggingface.co/datasets/lerobot/droid_1.0.1/blob/main/meta/info.json)), built by LeRobot's [`port_droid.py`](https://github.com/huggingface/lerobot/blob/main/examples/port_datasets/port_droid.py):

- 95,658 Episodes, 27.6 M frames, 15 fps, `robot_type: "Franka"`, and the same three 320×180 cameras (keys renamed `observation.images.exterior_1_left`, `exterior_2_left`, `wrist_left`).
- **Explicit `is_episode_successful`** (from `"/success/" in file_path`). I read it for every Episode: **78,864 success and 16,794 failure**.
- Richer robot data. `observation.state` is 8-D: joint positions (7) plus gripper. There are separate `observation.state.cartesian_position`, `observation.state.joint_position` and `action.joint_velocity`/`cartesian_velocity`/…, and up to 3 instructions (`language_instruction`, `_2`, `_3`).
- By a rough regex over instructions (`put/place/pick/take/get … in/on/into/to the`, excluding drawers, taps, cloth and similar), about **27,400 successful pick-and-place Episodes**. Plenty of successes; for example "marker" pick-and-place alone gives about 3,200.
- **The catch: failures have no instructions.** 16,736 of 16,794 failures have an empty `language_instruction`, so only 15 failures match the regex. `task_category` is just the building name (for example "Autolab", "RAIL"), not a task. Failed pick-and-place Episodes must be found by video (for example a cheap Spark first pass, or by hand), not by text.
- Access: `meta/tasks.parquet` is 1.5 MB. `meta/episodes/*` is 7 files, about 590 MB total, but column-projected reads over HTTP took about 16 s. Data is 86 parquet files. Videos are concatenated into about 500 MB files per camera chunk, so pulling single Episodes means HTTP range-seeking by timestamp. *I didn't test video extraction from droid_1.0.1.*
- A different `observation.state` schema (joint+gripper against droid_100's pose+gripper) means the loader should read the named sub-fields, not the packed vector.

Other options from AGENTS.md: RoboFAC has labelled failures and failure locations, but it's a different robot, scenes and format (not checked here).

**Suggested hero set (for issue #7 and friends):** keep droid_100 Episode 42 and the clean rigid pick-and-place Episodes as the familiar core. Fill to ~100 with droid_1.0.1 pick-and-place Episodes: successes chosen by instruction, plus failures chosen from the unlabelled failure pool by video. Use the `v2.0` branch's per-episode mp4s for droid_100 clips.

## 8. Contradictions with AGENTS.md

1. **"the label was dropped during format conversion"** (§2 warning): only partly true. There is no explicit flag, but `next.reward` = 1 on the last frame marks every success, and the 19 zero-reward Episodes are the failures. What was dropped is the *instruction* (54 blanks) and the raw file path.
2. **"Measured from robot data (joint states, gripper)"** (§5): droid_100 has **no joint states**, only end-effector pose plus gripper and Cartesian-velocity actions. The listed measured Criteria still work. droid_1.0.1 does have joints.
3. **Day-1 test "2 known failures"**: the failures have no instruction, so a Spark "video + instruction → success?" test needs an instruction you write by watching (for example Episode 5, green block and bowl). Most failures are aborted early, so they test "did it finish?" more than "was it sloppy?".
4. **Episode 42 "marked success, appears to fail"**: confirmed. But note: (a) its instruction is blank in the port, so supply "Move the black remote control to the left"; (b) robot data shows a *commanded* release about 10 cm above the cushion after 3 failed grasps, not a slip.
5. **"100 episodes sort into keep / reject / needs review"** on "pick-and-place on public data" (§8, §9): droid_100 has only 40 clear pick-and-place Episodes. A 100-Episode pick-and-place demo needs droid_1.0.1 (or similar).
6. **"Load `lerobot/droid_100` (small; no big download)"**: true for data (2.7 MB parquet). Video is about 460 MB on `main` (3 concatenated AV1 files) or about 1–3 MB per Episode per camera on the `v2.0` branch.
7. Video is **320×180**, a real constraint for SAM 3.1 on small objects; raw HD only exists in the 8.7 TB raw bucket.
8. Licence is CC BY 4.0 (DROID), not MIT as the card says, so credit DROID in the submission.

## Method notes

- Downloaded `meta/*`, `data/chunk-000/file-000.parquet` and the README from `main`, and per-episode mp4s from branch `v2.0` for Episodes 42, 5, 18, 47, 82 (all three cameras) plus exterior-1 for the other 25 blank-instruction Episodes. Inspected them with pandas/pyarrow and ffmpeg/ffprobe. No data is committed.
- For `lerobot/droid_1.0.1`, I read only the `tasks`/`length` columns of `meta/episodes/*` and the `episode_index`/`is_episode_successful` columns of all 86 data files, via `huggingface_hub.HfFileSystem`. I read `task_category` from 3 data files (3,316 Episodes).
- The pick-and-place classification of blank-instruction Episodes is from 8-frame exterior skims and is low-confidence. Any Episode used in the Demo video should be watched in full.
