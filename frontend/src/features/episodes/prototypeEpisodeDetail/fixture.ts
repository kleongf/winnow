// PROTOTYPE (throwaway): Episode detail view fixture for droid_100 Episode 42.
// Signals, timings and the SAM object track are real (exported from the Day-1 feasibility run).
// The Criterion results, Triage decision and Reason are hand-authored from those real numbers.
import signals from "./ep42Signals.json";

export type CriterionKind = "measured" | "tracked" | "visual";
export type ResultStatus = "pass" | "fail" | "unsure";
export type Triage = "Keep" | "Reject" | "Needs review";

export interface Moment {
  t: number;
  label: string;
}

export interface CriterionResult {
  id: string;
  name: string;
  kind: CriterionKind;
  hard: boolean;
  status: ResultStatus;
  measurement: string;
  evidence: string;
  moments: Moment[];
  window: [number, number];
  signal: "gripper" | "z" | "speed" | "objectY" | "none";
  threshold?: number;
  camera: CameraId;
}

export type CameraId = "exterior_image_1_left" | "exterior_image_2_left" | "wrist_image_left";

export const cameras: { id: CameraId; label: string; src: string }[] = [
  {
    id: "exterior_image_1_left",
    label: "Exterior 1",
    src: "/prototype/ep42/exterior_image_1_left.mp4",
  },
  {
    id: "exterior_image_2_left",
    label: "Exterior 2",
    src: "/prototype/ep42/exterior_image_2_left.mp4",
  },
  { id: "wrist_image_left", label: "Wrist", src: "/prototype/ep42/wrist_image_left.mp4" },
];

export const fps = 15;
export const duration = 22.0;

export const sig = {
  t: signals.t,
  gripper: signals.gripper,
  z: signals.z,
  speed: signals.speed,
  objectY: signals.objectBoxes.map((b) => ((b[2] ?? 0) + (b[4] ?? 0)) / 2),
  objectBoxes: signals.objectBoxes as [number, number, number, number, number, number][],
};

export const episode = {
  index: 42,
  dataset: "lerobot/droid_100",
  instruction: "Move the black remote to the left side of the pillow",
  datasetLabel: "success",
  rubricDescription:
    "An expert picks the object up on the first try, never drops it, sets it down fully inside the target, and never stalls for more than 2 seconds.",
  triage: "Reject" as Triage,
  reason:
    "Rejected: it took 3 grasp attempts (9.1 s, 14.7 s, 15.6 s), then let go of the remote about 10 cm above the pillow at 18.3 s.",
  reasonParts: [
    { text: "Rejected: it took " },
    { text: "3 grasp attempts", t: 9.07 },
    { text: " (9.1 s, 14.7 s, 15.6 s), then " },
    { text: "let go of the remote about 10 cm above the pillow", t: 18.33 },
    { text: " at 18.3 s." },
  ] as { text: string; t?: number }[],
};

export const robotEvents: Moment[] = [
  { t: 9.07, label: "Grasp 1" },
  { t: 9.6, label: "Opens" },
  { t: 14.67, label: "Grasp 2" },
  { t: 15.6, label: "Grasp 3" },
  { t: 16.0, label: "Lift (gripper 0.59)" },
  { t: 18.33, label: "Release at +10 cm" },
];

export const sparkAlone = {
  decision: "failure",
  failureT: 17.0,
  reason:
    "The gripper lifted empty around 17 s and the remote stayed where it was on the pillow; it never moved to the left.",
  contradiction:
    "Robot data says otherwise: the gripper held at 0.59 (closed on something) for 2.8 s while the end effector rose 10 cm, and the SAM track shows the remote rising with it.",
};

export const results: CriterionResult[] = [
  {
    id: "first-grasp",
    name: "Single grasp attempt on first try",
    kind: "measured",
    hard: true,
    status: "fail",
    measurement: "3 grasp closures (expected 1)",
    evidence:
      "The gripper crossed 0.5 (closed) three times: at 9.1 s, 14.7 s and 15.6 s. The first two attempts reopened without lifting.",
    moments: [
      { t: 9.07, label: "Grasp 1" },
      { t: 14.67, label: "Grasp 2" },
      { t: 15.6, label: "Grasp 3" },
    ],
    window: [7.5, 17],
    signal: "gripper",
    threshold: 0.5,
    camera: "wrist_image_left",
  },
  {
    id: "no-drop",
    name: "No drop: object stays with gripper",
    kind: "tracked",
    hard: true,
    status: "fail",
    measurement: "Released 10.1 cm above grasp height",
    evidence:
      "The gripper opened at 18.3 s with the end effector 10.1 cm above where it grasped. The remote's SAM box then jumps to a new resting spot.",
    moments: [{ t: 18.33, label: "Release mid-air" }],
    window: [15, 21],
    signal: "z",
    camera: "exterior_image_1_left",
  },
  {
    id: "placed-inside",
    name: "Object placed inside target",
    kind: "visual",
    hard: true,
    status: "unsure",
    measurement: "Spark confidence 0.55",
    evidence:
      "The final frames are dark and the remote is only partly in its SAM box (confidence 0.84). The target region isn't visible from Exterior 1, so it's unclear whether the remote ended up on the left side.",
    moments: [{ t: 21.9, label: "Final frame" }],
    window: [18, 22],
    signal: "objectY",
    camera: "exterior_image_1_left",
  },
  {
    id: "no-pauses",
    name: "No long pauses",
    kind: "measured",
    hard: false,
    status: "pass",
    measurement: "No stall longer than 2 s",
    evidence: "The smoothed end-effector speed never stays below 0.02 m/s for more than 2 s.",
    moments: [],
    window: [0, 22],
    signal: "speed",
    threshold: 0.02,
    camera: "exterior_image_1_left",
  },
];

export const statusColor: Record<ResultStatus, string> = {
  pass: "#2f9e5b",
  fail: "#d9480f",
  unsure: "#e8a317",
};

export const triageColor: Record<Triage, string> = {
  Keep: "#2f9e5b",
  Reject: "#d9480f",
  "Needs review": "#e8a317",
};

export function fmt(t: number): string {
  return `${t.toFixed(1)} s`;
}
