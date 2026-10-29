// PROTOTYPE (throwaway): Episodes for the workspace prototype. Instruction, length, outcome and
// frame-0 images are real (droid_100). Every measured/tracked/visual value is SIMULATED from a
// seeded RNG, skewed by the Dataset outcome; only Episode 42's values follow its real robot data.
// Hand-drawn boxes are real for Episodes 3, 16 and 42 and random elsewhere.
import { droid100, type RawEpisode } from "./droid100";
import type { Status, ViewId } from "./rubric";

export type Rect = [number, number, number, number];
export type Source = "droid_100" | "droid_1.0.1";

export interface SparkAlone {
  decision: "Keep" | "Reject";
  failurePhrase: string | null;
  t: number | null;
  reason: string;
  agree: number; // of 3 samples
}

export interface Episode {
  id: string;
  source: Source;
  index: number;
  instruction: string;
  instructionWritten: boolean;
  duration: number;
  outcome: "success" | "failure";
  split: "dev" | "test";
  frames: Record<"ext1" | "ext2", string | null>;
  hasClips: boolean;
  box: { view: "ext1" | "ext2"; rect: Rect } | null;
  values: Record<string, number | null>;
  votes: Status[];
  nearGripper: boolean;
  trackLost: Partial<Record<ViewId, boolean>>;
  times: { grasps: number[]; release: number; pause: [number, number]; settle: number };
  spark: SparkAlone;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const realBoxes: Record<number, { view: "ext1" | "ext2"; rect: Rect }> = {
  42: { view: "ext1", rect: [197, 132, 227, 164] },
  16: { view: "ext1", rect: [214, 66, 222, 75] },
  3: { view: "ext1", rect: [177, 135, 202, 152] },
};

const devDroid100 = new Set([3, 7, 12, 16, 27, 42, 46, 48, 49, 59, 85, 89]);

function pick<T>(r: () => number, weights: [T, number][]): T {
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let x = r() * total;
  for (const [v, w] of weights) {
    x -= w;
    if (x <= 0) return v;
  }
  return weights[0]![0];
}

type Mode = "attempts" | "slip" | "release" | "misplaced" | "pause";

function simulateValues(r: () => number, fail: boolean, boxed: boolean) {
  const modes: Mode[] = [];
  if (fail) {
    modes.push(
      pick<Mode>(r, [
        ["attempts", 3],
        ["slip", 1],
        ["release", 2],
        ["misplaced", 3],
        ["pause", 2],
      ]),
    );
    if (r() < 0.25)
      modes.push(
        pick<Mode>(r, [
          ["attempts", 1],
          ["pause", 1],
          ["misplaced", 1],
        ]),
      );
  }
  const has = (m: Mode) => modes.includes(m);
  const values: Record<string, number | null> = {
    "grasp-attempts": has("attempts") ? (r() < 0.6 ? 2 : 3) : 1,
    "in-hand-lost": has("slip") ? 0.6 + r() * 1.4 : 0,
    "fall-after-release": has("release") ? 0.9 + r() * 0.9 : r() * 0.2,
    "release-height": has("release") ? 0.07 + r() * 0.05 : 0.005 + r() * 0.025,
    "placed-visual": has("misplaced")
      ? pick(r, [
          [0, 3],
          [1, 2],
        ] as [number, number][])
      : 3,
    "final-overlap": boxed ? (has("misplaced") ? r() * 0.35 : 0.74 + r() * 0.24) : null,
    "longest-still": has("pause") ? 2.8 + r() * 3 : 0.3 + r() * 1.25,
  };
  // Borderline cases: one value lands near its threshold, which is what makes Needs review.
  const near = r();
  if (near < 0.07) values["longest-still"] = 1.7 + r() * 0.6;
  else if (near < 0.12 && boxed) values["final-overlap"] = 0.52 + r() * 0.15;
  else if (near < 0.16) values["release-height"] = 0.035 + r() * 0.03;
  const yes = values["placed-visual"] ?? 3;
  const split = !has("misplaced") && r() < 0.1;
  return {
    values: { ...values, "placed-visual": split ? 2 : yes } as Record<string, number | null>,
    votes: (["pass", "pass", "pass"] as Status[]).map((_, i) =>
      i < (split ? 2 : yes) ? "pass" : r() < 0.1 ? "unsure" : "fail",
    ),
    nearGripper: r() < 0.05,
    trackLost: { wrist: r() < 0.04, ext1: r() < 0.03 },
  };
}

const sparkKeepReasons = [
  "The robot picks up the object and places it in the target in one smooth motion.",
  "The object is grasped, carried and set down in the target; the task looks complete.",
  "The gripper secures the object and releases it into the target without visible issues.",
];

function simulateSpark(r: () => number, ep: Episode, fail: boolean): SparkAlone {
  const saysKeep = fail ? r() < 0.55 : r() < 0.9;
  const agree = r() < 0.75 ? 3 : 2;
  if (saysKeep) {
    return {
      decision: "Keep",
      failurePhrase: null,
      t: null,
      reason: sparkKeepReasons[Math.floor(r() * sparkKeepReasons.length)]!,
      agree,
    };
  }
  const phrase = pick(r, [
    ["placed", 4],
    ["no-drop", 3],
    ["first-try", 2],
    ["no-pauses", 1],
  ] as [string, number][]);
  const t = Math.round(ep.duration * (0.4 + r() * 0.5) * 10) / 10;
  const text: Record<string, string> = {
    placed: `The object does not appear to end up in the target (around ${t.toFixed(1)} s).`,
    "no-drop": `The object seems to slip from the gripper at about ${t.toFixed(1)} s.`,
    "first-try": `The robot needs more than one attempt to pick the object up (${t.toFixed(1)} s).`,
    "no-pauses": `The arm stalls for a while around ${t.toFixed(1)} s.`,
  };
  return { decision: "Reject", failurePhrase: phrase, t, reason: text[phrase]!, agree };
}

function frame(index: number, view: 1 | 2) {
  return `/prototype/workspace/frames/ep${index}_ext${view}.jpg`;
}

function times(r: () => number, duration: number, attempts: number) {
  const first = duration * (0.25 + r() * 0.1);
  const grasps = Array.from({ length: attempts }, (_, i) => +(first + i * 1.4).toFixed(1));
  const release = +(duration * (0.75 + r() * 0.1)).toFixed(1);
  const ps = +(duration * (0.1 + r() * 0.5)).toFixed(1);
  return {
    grasps,
    release,
    pause: [ps, ps + 1] as [number, number],
    settle: +(release + 0.6).toFixed(1),
  };
}

function fromDroid100(raw: RawEpisode, i: number): Episode {
  const r = rng(raw.index * 7919 + 13);
  const known = [3, 16].includes(raw.index);
  const fail = raw.outcome === "failure" || (!known && r() < 0.18);
  const split = devDroid100.has(raw.index) ? "dev" : "test";
  const boxed = raw.index in realBoxes || split === "dev" || r() < 0.7;
  const sim = simulateValues(r, fail, boxed);
  const rect: Rect = [130 + Math.round(r() * 60), 90 + Math.round(r() * 40), 0, 0];
  rect[2] = rect[0] + 18 + Math.round(r() * 20);
  rect[3] = rect[1] + 14 + Math.round(r() * 16);
  const ep: Episode = {
    id: `droid_100:${raw.index}`,
    source: "droid_100",
    index: raw.index,
    instruction: raw.instruction ?? `(labeller) ${raw.note ?? "pick-and-place"}`,
    instructionWritten: raw.instruction === null,
    duration: raw.duration,
    outcome: raw.outcome,
    split,
    frames: { ext1: frame(raw.index, 1), ext2: frame(raw.index, 2) },
    hasClips: raw.index === 42,
    box: realBoxes[raw.index] ?? (boxed ? { view: i % 3 ? "ext1" : "ext2", rect } : null),
    ...sim,
    times: times(r, raw.duration, sim.values["grasp-attempts"] ?? 1),
    spark: { decision: "Keep", failurePhrase: null, t: null, reason: "", agree: 3 },
  };
  if (raw.index === 49) ep.nearGripper = true; // peaks at exactly 0.50 (Day 1)
  ep.spark = simulateSpark(r, ep, fail);
  return ep;
}

function episode42Overrides(ep: Episode): Episode {
  return {
    ...ep,
    instruction: "Move the black remote control to the left",
    values: {
      ...ep.values,
      "grasp-attempts": 3,
      "in-hand-lost": 0,
      "fall-after-release": 1.1,
      "release-height": 0.101,
      "placed-visual": 2,
      "final-overlap": 0.71,
      "longest-still": 1.3,
    },
    votes: ["pass", "pass", "fail"],
    nearGripper: false,
    trackLost: { wrist: false, ext1: true },
    times: { grasps: [9.1, 14.7, 15.6], release: 18.3, pause: [12.0, 13.3], settle: 19.0 },
    spark: {
      decision: "Reject",
      failurePhrase: "placed",
      t: 17.0,
      reason:
        "The gripper lifted empty around 17 s and the remote stayed where it was on the pillow.",
      agree: 3,
    },
  };
}

const droid101: Episode[] = [1, 9, 17].map((index) => {
  const r = rng(index * 104729 + 7);
  const sim = simulateValues(r, true, true);
  const ep: Episode = {
    id: `droid_1.0.1:${index}`,
    source: "droid_1.0.1",
    index,
    instruction: "(instruction not loaded in the prototype)",
    instructionWritten: false,
    duration: 14 + Math.round(r() * 10),
    outcome: "failure",
    split: "dev",
    frames: {
      ext1: `/prototype/workspace/frames/r101_ep${index}_ext1.jpg`,
      ext2: `/prototype/workspace/frames/r101_ep${index}_ext2.jpg`,
    },
    hasClips: false,
    box: { view: "ext2", rect: [150, 100, 180, 125] },
    ...sim,
    times: times(r, 18, sim.values["grasp-attempts"] ?? 1),
    spark: { decision: "Keep", failurePhrase: null, t: null, reason: "", agree: 3 },
  };
  ep.spark = simulateSpark(r, ep, true);
  return ep;
});

export const episodes: Episode[] = [
  ...droid100.map((raw, i) =>
    raw.index === 42 ? episode42Overrides(fromDroid100(raw, i)) : fromDroid100(raw, i),
  ),
  ...droid101,
];

export const episodeById = new Map(episodes.map((e) => [e.id, e]));
