# Winnow

Winnow filters recorded robot demonstrations against a plain-English description of what "expert" looks like, keeping the good ones and explaining every rejection.

## Language

**Episode**:
One recorded robot demonstration: the video plus the robot's joint and gripper data, as a single unit of training data.
_Avoid_: Demo, demonstration, trajectory, rollout

**Rubric**:
The set of criteria Winnow compiles from a user's plain-English "expert" description, used to judge every Episode.
_Avoid_: Filter, spec, checklist; never use for the hackathon's scoring

**Criterion**:
One check within a Rubric, either hard (failing it rejects the Episode) or soft (it adds to a quality score), and either measured (from robot data), tracked (from object/gripper tracks), or visual (judged from video).
_Avoid_: Rule, check, filter

**Criterion result**:
The outcome of one Criterion on one Episode (pass, fail, or unsure), with its Evidence.
_Avoid_: Verdict, score

**Evidence**:
What supports a Criterion result: timestamps, track plots, measurements, or the frame where something went wrong.
_Avoid_: Explanation, justification

**Triage decision**:
The per-Episode outcome after all Criterion results are combined: Keep, Reject, or Needs review.
_Avoid_: Verdict, label, classification

**Reason**:
The one-sentence account of why an Episode got its Triage decision, written from its Evidence.
_Avoid_: Explanation, rationale, justification

**Needs review**:
The Triage decision for an Episode Winnow isn't confident about, routed to a human instead of being kept or rejected automatically.
_Avoid_: Uncertain, flagged, borderline

**Reference label**:
A human's judgment of one Episode against the description, made without seeing what Winnow or a baseline said, used to score them.
_Avoid_: Ground truth, gold label, annotation

**Dataset outcome**:
The success or failure flag an Episode ships with in its source dataset; it answers "was the task done", not "does it meet the description".
_Avoid_: Provider label, ground truth

**Test set**:
The Episodes held out from all Rubric writing, calibration, and tuning, used only for reported numbers.
_Avoid_: Eval set, benchmark

**Dev set**:
The Episodes the Rubric may be written, calibrated, and tuned against; never used for reported numbers.
_Avoid_: Train set, validation set

**Demo video**:
The hackathon submission video showing Winnow in use.
_Avoid_: Demo (on its own)

**Judging criteria**:
The hackathon's scoring categories (Impact, Use of Meta AI Tooling, Technical Depth, Demo).
_Avoid_: Rubric
