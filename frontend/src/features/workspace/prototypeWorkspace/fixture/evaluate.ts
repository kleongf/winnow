// PROTOTYPE (throwaway): the decision rule from "Triage decision rule and calibration" (#19) as a
// pure function, so a threshold drag or a label re-sorts every Episode with no calls.
import type { Episode } from "./episodes";
import {
  passes,
  phrases as rubricPhrases,
  type Criterion,
  type Rubric,
  type Status,
  type Triage,
} from "./rubric";

export type LabelSource = "interview" | "review" | "audit";

export interface Label {
  episodeId: string;
  phraseId: string;
  value: "pass" | "fail";
  source: LabelSource;
}

export interface Moment {
  t: number;
  label: string;
}

export interface CriterionResult {
  criterion: Criterion;
  status: Status;
  crisp: boolean;
  value: number | null;
  measurement: string;
  signal: string | null;
  evidence: string;
  moments: Moment[];
  window: [number, number];
  p: number;
}

export interface PhraseResult {
  phraseId: string;
  status: Status;
  labelled: Label | null;
  signals: string[];
}

export interface EpisodeResult {
  episode: Episode;
  triage: Triage;
  reason: string;
  confidence: number;
  results: CriterionResult[];
  phrases: PhraseResult[];
  signals: string[];
}

const sigmoid = (m: number) => 1 / (1 + Math.exp(-3 * m));

function fmtValue(c: Criterion, v: number): string {
  if (c.unit === "m") return `${(v * 100).toFixed(1)} cm`;
  if (c.unit === "share") return `${Math.round(v * 100)}%`;
  if (c.unit === "attempts") return `${v} attempt${v === 1 ? "" : "s"}`;
  if (c.unit === "yes votes") return `${v} of 3 yes`;
  return `${v.toFixed(c.unit === "s" ? 1 : 2)} ${c.unit}`;
}

function momentsFor(c: Criterion, ep: Episode): { moments: Moment[]; window: [number, number] } {
  const { grasps, release, pause, settle } = ep.times;
  const g = grasps[grasps.length - 1] ?? 0;
  switch (c.primitive) {
    case "grasp_attempts":
      return {
        moments: grasps.map((t, i) => ({ t, label: `Closure ${i + 1}` })),
        window: [Math.max(0, (grasps[0] ?? 0) - 1), g + 1],
      };
    case "longest_still_s":
      return { moments: [{ t: pause[0], label: "Stops" }], window: [0, ep.duration] };
    case "in_hand_lost_s":
      return { moments: [{ t: g, label: "Grasp" }], window: [g, release] };
    case "release_height_m":
    case "fall_after_release":
      return { moments: [{ t: release, label: "Release" }], window: [release - 0.5, release + 1] };
    default:
      return { moments: [{ t: settle, label: "Final" }], window: [release, ep.duration] };
  }
}

function visualResult(ep: Episode): Pick<CriterionResult, "status" | "crisp" | "signal" | "p"> {
  const yes = ep.votes.filter((v) => v === "pass").length;
  const agree = Math.max(yes, ep.votes.filter((v) => v === "fail").length);
  const p = (agree + 1) / 5;
  if (ep.votes.includes("unsure"))
    return { status: "unsure", crisp: false, signal: "Spark said unsure", p: 0.5 };
  if (yes === 3) return { status: "pass", crisp: true, signal: null, p };
  if (yes === 0) return { status: "fail", crisp: true, signal: null, p: 1 - p };
  return { status: "unsure", crisp: false, signal: "samples split 2–1", p: yes >= 2 ? 0.6 : 0.4 };
}

function evaluateCriterion(c: Criterion, ep: Episode, s: number): CriterionResult {
  const { moments, window } = momentsFor(c, ep);
  const value = ep.values[c.id] ?? null;
  const base = { criterion: c, value, moments, window };
  if (value === null) {
    const why = c.primitive === "final_overlap" ? "no hand-drawn box" : "source missing";
    return {
      ...base,
      status: "unsure",
      crisp: false,
      measurement: "—",
      signal: why,
      evidence: `No value: ${why}.`,
      p: 0.5,
    };
  }
  const measurement = fmtValue(c, value);
  if (c.kind === "visual") {
    const v = visualResult(ep);
    return {
      ...base,
      ...v,
      measurement,
      evidence: `Spark answered ${ep.votes.join(", ")} on the cropped clip.`,
    };
  }
  if (c.view !== "robot" && ep.trackLost[c.view]) {
    return {
      ...base,
      status: "unsure",
      crisp: false,
      measurement,
      signal: "track lost (box-area jump)",
      evidence: "The SAM box swelled past 4× its median in this window.",
      p: 0.5,
    };
  }
  if (c.primitive === "grasp_attempts" && ep.nearGripper) {
    return {
      ...base,
      status: "unsure",
      crisp: false,
      measurement,
      signal: "near threshold (count)",
      evidence: "A closure sits within the gripper-closed margin.",
      p: 0.5,
    };
  }
  const ok = passes(c, value);
  const margin = c.margin * s;
  const m = margin > 0 ? Math.abs(value - c.threshold) / margin : Infinity;
  const p = sigmoid(ok ? m : -m);
  if (margin > 0 && m <= 1) {
    return {
      ...base,
      status: "unsure",
      crisp: false,
      measurement,
      signal: "near threshold",
      evidence: `${measurement} is within ±${fmtValue(c, margin)} of ${fmtValue(c, c.threshold)}.`,
      p,
    };
  }
  return {
    ...base,
    status: ok ? "pass" : "fail",
    crisp: true,
    measurement,
    signal: null,
    evidence: `${measurement} against ${c.comparator} ${fmtValue(c, c.threshold)}.`,
    p: !ok && !c.conclusive ? Math.max(p, 0.5) : p,
  };
}

function phraseStatus(rs: CriterionResult[]): { status: Status; signals: string[] } {
  if (rs.some((r) => r.status === "fail" && r.crisp && r.criterion.conclusive))
    return { status: "fail", signals: [] };
  if (rs.every((r) => r.status === "pass" && r.crisp)) return { status: "pass", signals: [] };
  const signals = rs.flatMap((r) => {
    if (r.signal) return [`${r.criterion.primitive} ${r.signal} (${r.measurement})`];
    if (r.status === "fail" && !r.criterion.conclusive)
      return [`${r.criterion.primitive} unconfirmed fail (${r.measurement})`];
    return [];
  });
  return { status: "unsure", signals };
}

function reasonFor(
  triage: Triage,
  results: CriterionResult[],
  signals: string[],
  phraseResults: PhraseResult[],
): string {
  if (triage === "Keep") return "Kept: every hard Phrase passed.";
  if (triage === "Needs review") return `Needs review: ${[...new Set(signals)].join("; ")}.`;
  const fails = results
    .filter((r) => r.status === "fail" && r.crisp && r.criterion.conclusive)
    .sort((a, b) => (a.moments[0]?.t ?? 0) - (b.moments[0]?.t ?? 0));
  const first = fails[0];
  if (!first) {
    const label = phraseResults.find((p) => p.labelled?.value === "fail")?.labelled;
    const text = rubricPhrases.find((p) => p.id === label?.phraseId)?.text ?? "a Phrase";
    return `Rejected by a ${label?.source ?? "human"} label: “${text}” failed.`;
  }
  const at = first.moments[0] ? ` at ${first.moments[0].t.toFixed(1)} s` : "";
  const more =
    fails.length > 1
      ? ` Also: ${fails
          .slice(1)
          .map((f) => f.criterion.primitive)
          .join(", ")}.`
      : "";
  return `Rejected: ${first.criterion.primitive} = ${first.measurement}${at} (expected ${first.criterion.comparator} ${fmtValue(first.criterion, first.criterion.threshold)}).${more}`;
}

export function evaluateEpisode(
  ep: Episode,
  rubric: Rubric,
  labels: Label[],
  s = 1,
): EpisodeResult {
  const results = rubric.criteria.filter((c) => c.enabled).map((c) => evaluateCriterion(c, ep, s));
  const phrases = rubric.phrases
    .filter((ph) => ph.status === "Checked")
    .map((ph): PhraseResult => {
      const rs = results.filter((r) => r.criterion.phraseId === ph.id);
      const label = labels.find((l) => l.episodeId === ep.id && l.phraseId === ph.id) ?? null;
      if (label) return { phraseId: ph.id, status: label.value, labelled: label, signals: [] };
      return { phraseId: ph.id, labelled: null, ...phraseStatus(rs) };
    });
  const hard = phrases.filter((ph) =>
    results.some((r) => r.criterion.phraseId === ph.phraseId && r.criterion.hard),
  );
  const triage: Triage = hard.some((p) => p.status === "fail")
    ? "Reject"
    : hard.every((p) => p.status === "pass")
      ? "Keep"
      : "Needs review";
  const pKeep = Math.min(
    1,
    ...hard.map((ph) =>
      ph.labelled
        ? ph.labelled.value === "pass"
          ? 1
          : 0
        : Math.min(...results.filter((r) => r.criterion.phraseId === ph.phraseId).map((r) => r.p)),
    ),
  );
  const signals = phrases.flatMap((p) => p.signals);
  return {
    episode: ep,
    triage,
    reason: reasonFor(triage, results, signals, phrases),
    confidence: Math.max(pKeep, 1 - pKeep),
    results,
    phrases,
    signals,
  };
}
