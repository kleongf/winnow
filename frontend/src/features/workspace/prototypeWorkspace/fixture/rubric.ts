// PROTOTYPE (throwaway): the frozen evaluation Description compiled as decided in
// "Rubric compile and the Describe interview" (#18). Thresholds and margins are starting guesses.

export type Kind = "measured" | "tracked" | "visual";
export type Status = "pass" | "fail" | "unsure";
export type Triage = "Keep" | "Reject" | "Needs review";
export type PhraseStatus = "Checked" | "Context" | "Unsupported";
export type Comparator = "<" | "<=" | ">=" | ">" | "==";
export type ViewId = "ext1" | "ext2" | "wrist";

export interface Phrase {
  id: string;
  text: string;
  status: PhraseStatus;
  note?: string;
}

export interface Criterion {
  id: string;
  phraseId: string;
  primitive: string;
  kind: Kind;
  english: string;
  comparator: Comparator;
  threshold: number;
  margin: number;
  unit: string;
  hard: boolean;
  enabled: boolean;
  conclusive: boolean;
  view: ViewId | "robot";
  assumptions: string[];
  /** Range for the threshold slider and the anchor-pool histogram. */
  range: [number, number];
}

export interface RubricSettings {
  gripperClosed: { value: number; margin: number; assumed: boolean };
  graspRiseCm: { value: number; margin: number; assumed: boolean };
}

export interface Rubric {
  version: number;
  draft: boolean;
  description: string;
  phrases: Phrase[];
  criteria: Criterion[];
  settings: RubricSettings;
}

export const description =
  "Expert pick-and-place: grasps the object on the first try, never drops it, places it in or on the target named in the instruction, no long pauses.";

export const phrases: Phrase[] = [
  {
    id: "context",
    text: "Expert pick-and-place:",
    status: "Context",
    note: "Names the task; not a check.",
  },
  { id: "first-try", text: "grasps the object on the first try", status: "Checked" },
  { id: "no-drop", text: "never drops it", status: "Checked" },
  {
    id: "placed",
    text: "places it in or on the target named in the instruction",
    status: "Checked",
  },
  { id: "no-pauses", text: "no long pauses", status: "Checked" },
];

export const criteria: Criterion[] = [
  {
    id: "grasp-attempts",
    phraseId: "first-try",
    primitive: "grasp_attempts",
    kind: "measured",
    english: "Grasp attempts before and including the grasp = 1",
    comparator: "==",
    threshold: 1,
    margin: 0,
    unit: "attempts",
    hard: true,
    enabled: true,
    conclusive: true,
    view: "robot",
    assumptions: [],
    range: [1, 5],
  },
  {
    id: "in-hand-lost",
    phraseId: "no-drop",
    primitive: "in_hand_lost_s",
    kind: "tracked",
    english: "Object gone from the wrist view while the gripper is closed ≤ 0.3 s",
    comparator: "<=",
    threshold: 0.3,
    margin: 0.2,
    unit: "s",
    hard: true,
    enabled: true,
    conclusive: true,
    view: "wrist",
    assumptions: [],
    range: [0, 3],
  },
  {
    id: "fall-after-release",
    phraseId: "no-drop",
    primitive: "fall_after_release",
    kind: "tracked",
    english: "Object box drops ≤ 0.5 box-heights within 1 s of release",
    comparator: "<=",
    threshold: 0.5,
    margin: 0.2,
    unit: "box-h",
    hard: true,
    enabled: true,
    conclusive: true,
    view: "ext1",
    assumptions: ["'drops' taken as a fall of more than half the object's height"],
    range: [0, 3],
  },
  {
    id: "release-height",
    phraseId: "no-drop",
    primitive: "release_height_m",
    kind: "measured",
    english: "Gripper height at release minus at the grasp ≤ 5 cm",
    comparator: "<=",
    threshold: 0.05,
    margin: 0.02,
    unit: "m",
    hard: true,
    enabled: true,
    conclusive: false,
    view: "robot",
    assumptions: [],
    range: [0, 0.2],
  },
  {
    id: "placed-visual",
    phraseId: "placed",
    primitive: "ask_video",
    kind: "visual",
    english: "Spark: “Is the object resting in or on the target?” (3 samples)",
    comparator: ">=",
    threshold: 2,
    margin: 0,
    unit: "yes votes",
    hard: true,
    enabled: true,
    conclusive: true,
    view: "ext1",
    assumptions: [],
    range: [0, 3],
  },
  {
    id: "final-overlap",
    phraseId: "placed",
    primitive: "final_overlap",
    kind: "tracked",
    english: "Share of the object's final box inside the target box ≥ 0.6",
    comparator: ">=",
    threshold: 0.6,
    margin: 0.1,
    unit: "share",
    hard: true,
    enabled: true,
    conclusive: true,
    view: "ext1",
    assumptions: ["'in or on' taken as ≥ 60% box overlap"],
    range: [0, 1],
  },
  {
    id: "longest-still",
    phraseId: "no-pauses",
    primitive: "longest_still_s",
    kind: "measured",
    english: "Longest stretch with end-effector speed < 0.02 m/s ≤ 2.0 s",
    comparator: "<=",
    threshold: 2.0,
    margin: 0.4,
    unit: "s",
    hard: true,
    enabled: true,
    conclusive: true,
    view: "robot",
    assumptions: ["'long' taken as > 2 s"],
    range: [0, 8],
  },
];

export const initialRubric: Rubric = {
  version: 3,
  draft: true,
  description,
  phrases,
  criteria,
  settings: {
    gripperClosed: { value: 0.35, margin: 0.08, assumed: true },
    graspRiseCm: { value: 2, margin: 0.5, assumed: false },
  },
};

export function passes(c: Criterion, value: number, threshold = c.threshold): boolean {
  switch (c.comparator) {
    case "<":
      return value < threshold;
    case "<=":
      return value <= threshold;
    case ">=":
      return value >= threshold;
    case ">":
      return value > threshold;
    case "==":
      return value === threshold;
  }
}

export function assumptionCount(r: Rubric): number {
  const settings = [r.settings.gripperClosed, r.settings.graspRiseCm].filter((s) => s.assumed);
  return r.criteria.reduce((n, c) => n + c.assumptions.length, settings.length);
}
