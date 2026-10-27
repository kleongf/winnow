# SAM seeding and multi-view tracking (2026-10-27)

Probes and evidence for the [SAM seeding and multi-view tracking](https://github.com/kleongf/winnow/issues/17) ticket. The findings live in that ticket's resolution comment; this folder only holds the assets.

- `probes/`: `view_probe.py` (droid_100 box tracks, any seed frame, any fps), `seed_probe.py` (any clip, box or +/- point prompts), `spark_locate.py` (Spark standard vs contributor boxes), `project.py` (droid_1.0.1 end-effector projection), `sheet.py` / `grid.py` (contact sheets).
- `results.jsonl`: one row per SAM call (frames tracked, ids, confidence, cost, latency). `locate.json`: Spark boxes vs hand boxes.
- `sheets/`: contact sheets; the red box is SAM's box on that frame.
  - `ep16_*`, `ep42_*`: exterior 2 and wrist vs exterior 1 on droid_100.
  - `wrist_fixed_combo`, `wrist_neg_combo`: the free wrist seed (fixed point at grasp, without and with negative finger points).
  - `ext_proj_combo`, `ext_projneg_combo`, `ext_graspf0_combo`: free exterior seeds from projection (they find the gripper, not the object).
  - `projection_*`: projected end effector (red = flange, then 5/10/15 cm down the tool axis) on droid_1.0.1.

Total spend for the ticket: $0.69 (SAM and Spark), within the $5 cap.
