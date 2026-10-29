// PROTOTYPE (throwaway): Datasets, Projects, the Describe interview transcript, and the
// evaluation report. IA as decided on #20: a Project is one Description over one Dataset; a
// Dataset holds everything Description-independent (clips, tracks, hand-drawn boxes) and can be
// shared by several Projects. Evaluation numbers are INVENTED placeholders, not results.
import { episodes } from "./episodes";
import type { Label } from "./evaluate";

export interface Dataset {
  id: string;
  name: string;
  sources: { name: string; count: number }[];
  episodeIds: string[];
  ingest: {
    clips: number;
    wristTracks: number;
    boxes: number;
    exteriorTracks: number;
    total: number;
  };
  costUsd: number;
}

export interface Project {
  id: string;
  name: string;
  datasetId: string;
  description: string;
  rubricVersions: { version: number; createdAt: string; draft: boolean; note: string }[];
  anchorPool: { kind: "Dev set" | "Sample"; episodeIds: string[] };
  heldOut: { kind: "Test set"; episodeIds: string[] } | null;
  lastRun: { version: number; at: string; costUsd: number } | null;
}

const ids = episodes.map((e) => e.id);
const dev = episodes.filter((e) => e.split === "dev").map((e) => e.id);
const test = episodes.filter((e) => e.split === "test").map((e) => e.id);
const boxes = episodes.filter((e) => e.box).length;

export const datasets: Dataset[] = [
  {
    id: "droid-pnp",
    name: "DROID pick-and-place",
    sources: [
      { name: "lerobot/droid_100", count: episodes.filter((e) => e.source === "droid_100").length },
      {
        name: "lerobot/droid_1.0.1",
        count: episodes.filter((e) => e.source === "droid_1.0.1").length,
      },
    ],
    episodeIds: ids,
    ingest: {
      clips: ids.length,
      wristTracks: ids.length - 2,
      boxes,
      exteriorTracks: boxes - 1,
      total: ids.length,
    },
    costUsd: 1.62,
  },
  {
    id: "droid-100-all",
    name: "droid_100 (everything)",
    sources: [{ name: "lerobot/droid_100", count: 100 }],
    episodeIds: [],
    ingest: { clips: 100, wristTracks: 100, boxes: 0, exteriorTracks: 0, total: 100 },
    costUsd: 2.1,
  },
];

export const projects: Project[] = [
  {
    id: "expert-pnp",
    name: "Expert pick-and-place",
    datasetId: "droid-pnp",
    description:
      "Expert pick-and-place: grasps the object on the first try, never drops it, places it in or on the target named in the instruction, no long pauses.",
    rubricVersions: [
      { version: 1, createdAt: "Oct 28 10:12", draft: false, note: "first compile" },
      {
        version: 2,
        createdAt: "Oct 28 11:40",
        draft: false,
        note: "pause threshold from interview",
      },
      { version: 3, createdAt: "Oct 28 14:05", draft: true, note: "draft" },
    ],
    anchorPool: { kind: "Dev set", episodeIds: dev },
    heldOut: { kind: "Test set", episodeIds: test },
    lastRun: { version: 2, at: "Oct 28 11:52", costUsd: 0.41 },
  },
  {
    id: "lenient-pnp",
    name: "Lenient pick-and-place",
    datasetId: "droid-pnp",
    description: "Ends with the object in or on the target. Re-grasps are fine.",
    rubricVersions: [{ version: 1, createdAt: "Oct 28 15:30", draft: true, note: "draft" }],
    anchorPool: { kind: "Sample", episodeIds: ids.filter((_, i) => i % 2 === 0).slice(0, 30) },
    heldOut: null,
    lastRun: null,
  },
];

export interface InterviewTurn {
  id: string;
  kind: "question" | "answer" | "note";
  text: string;
  /** What the question is about: drives the anchor clip and which Rubric item lights up. */
  anchor?: { episodeId: string; clip: [number, number]; value?: string };
  target?: { criterionId?: string; phraseId?: string; setting?: "gripperClosed" | "graspRiseCm" };
  options?: string[];
  /** Options that mean the anchor Episode passes the targeted Phrase (the rest mean fail). */
  passOptions?: string[];
  answered?: string;
  effect?: string;
}

export const interview: InterviewTurn[] = [
  {
    id: "q1",
    kind: "question",
    text: "Episode 42: which of these 3 closures carried the remote?",
    anchor: {
      episodeId: "droid_100:42",
      clip: [8.5, 19],
      value: "closures at 9.1 s, 14.7 s, 15.6 s",
    },
    target: { setting: "graspRiseCm" },
    options: ["The 1st", "The 2nd", "The 3rd", "None"],
    answered: "The 3rd",
    effect: "Grasp rule confirmed: the last closure that rises ≥ 2 cm. Episode 42 → 3 attempts.",
  },
  {
    id: "q2",
    kind: "question",
    text: "Episode 27 stops for 2.4 s here. Is that a long pause?",
    anchor: { episodeId: "droid_100:27", clip: [9.6, 12.0], value: "still for 2.4 s" },
    target: { criterionId: "longest-still", phraseId: "no-pauses" },
    options: ["Yes, too long", "No, that's fine"],
    passOptions: ["No, that's fine"],
    answered: "Yes, too long",
    effect: "“long pause” threshold now between 1.6 s and 2.4 s.",
  },
  {
    id: "q3",
    kind: "question",
    text: "Episode 7 stops for 1.6 s here. Is that a long pause?",
    anchor: { episodeId: "droid_100:7", clip: [18.0, 19.6], value: "still for 1.6 s" },
    target: { criterionId: "longest-still", phraseId: "no-pauses" },
    options: ["Yes, too long", "No, that's fine"],
    passOptions: ["No, that's fine"],
    answered: "No, that's fine",
    effect: "Threshold set to 2.0 s, margin ±0.4 s (the bracketing gap). Assumption confirmed.",
  },
  {
    id: "q4",
    kind: "question",
    text: "Spark's 3 samples split 2–1 on whether the remote ends up on the cushion, and the box track is lost here. Is it on the cushion?",
    anchor: {
      episodeId: "droid_100:42",
      clip: [18.3, 22.0],
      value: "Spark 2 of 3 yes · overlap 0.71, track lost",
    },
    target: { criterionId: "final-overlap", phraseId: "placed" },
    options: ["Yes, it's on the cushion", "No"],
    passOptions: ["Yes, it's on the cushion"],
  },
  {
    id: "q5",
    kind: "question",
    text: "Episode 49 closes to exactly 0.50. Is the gripper holding something here?",
    anchor: {
      episodeId: "droid_100:49",
      clip: [3.5, 6.0],
      value: "gripper peak 0.50 · closed level 0.35",
    },
    target: { setting: "gripperClosed" },
    options: ["Yes, holding", "No, closed on air"],
    passOptions: ["Yes, holding"],
  },
];

export const initialLabels: Label[] = [
  { episodeId: "droid_100:42", phraseId: "first-try", value: "fail", source: "interview" },
  { episodeId: "droid_100:27", phraseId: "no-pauses", value: "fail", source: "interview" },
  { episodeId: "droid_100:7", phraseId: "no-pauses", value: "pass", source: "interview" },
];

/** INVENTED placeholder numbers in the shape the evaluation report will have. */
export const evaluationReport = {
  rubricVersion: 2,
  testSet: 100,
  descriptionFailures: 34,
  rows: [
    {
      system: "Winnow",
      falseKeeps: "2 / 34",
      falseKeepsCI: "0.02–0.19",
      rightReason: "23 / 26",
      coverage: "71 / 100",
      falseRejects: "3 / 66",
    },
    {
      system: "Winnow, all Needs review kept",
      falseKeeps: "6 / 34",
      falseKeepsCI: "0.08–0.34",
      rightReason: "23 / 26",
      coverage: "100 / 100",
      falseRejects: "3 / 66",
    },
    {
      system: "Spark alone",
      falseKeeps: "13 / 34",
      falseKeepsCI: "0.24–0.55",
      rightReason: "8 / 17",
      coverage: "100 / 100",
      falseRejects: "6 / 66",
    },
    {
      system: "Length alone",
      falseKeeps: "19 / 34",
      falseKeepsCI: "0.39–0.71",
      rightReason: "—",
      coverage: "100 / 100",
      falseRejects: "14 / 66",
    },
  ],
  ablation: [
    {
      sources: "robot data only",
      falseKeeps: "15 / 34",
      rightReason: "14 / 18",
      coverage: "64 / 100",
    },
    {
      sources: "robot data + SAM tracks",
      falseKeeps: "7 / 34",
      rightReason: "20 / 23",
      coverage: "66 / 100",
    },
    {
      sources: "robot data + Spark visual",
      falseKeeps: "5 / 34",
      rightReason: "19 / 24",
      coverage: "68 / 100",
    },
    { sources: "all three", falseKeeps: "2 / 34", rightReason: "23 / 26", coverage: "71 / 100" },
  ],
};
