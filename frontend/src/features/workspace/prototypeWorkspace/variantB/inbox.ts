// PROTOTYPE (throwaway): Variant B inbox logic: folders, filters, the audit sample, Wilson intervals.
import type { EpisodeResult } from "../fixture/evaluate";
import type { Workspace } from "../fixture/useWorkspace";

export type FolderId = "review" | "unboxed" | "rejected" | "kept" | "audit" | "all";

export const folders: { id: FolderId; label: string; hint: string }[] = [
  { id: "review", label: "Needs review", hint: "least confident first" },
  { id: "unboxed", label: "Unboxed", hint: "no hand-drawn box yet" },
  { id: "rejected", label: "Rejected", hint: "" },
  { id: "kept", label: "Kept", hint: "" },
  { id: "audit", label: "Audit sample", hint: "uniform auto-Keeps, seed 7" },
  { id: "all", label: "All", hint: "" },
];

export const phraseShort: Record<string, string> = {
  "first-try": "first try",
  "no-drop": "no drop",
  placed: "placed",
  "no-pauses": "no pauses",
};

export const signalKinds = [
  "near threshold",
  "samples split",
  "track lost",
  "no hand-drawn box",
  "unconfirmed fail",
  "Spark said unsure",
];

function hash(s: string, seed: number): number {
  let h = seed;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 2654435761) >>> 0;
  return h;
}

/** Uniform sample of auto-Keeps with a recorded seed; labelled Keeps stay in it once drawn. */
export function auditSample(ws: Workspace): EpisodeResult[] {
  const keeps = ws.results.filter(
    (r) =>
      r.triage === "Keep" ||
      ws.labels.some((l) => l.episodeId === r.episode.id && l.source === "audit"),
  );
  return [...keeps].sort((a, b) => hash(a.episode.id, 7) - hash(b.episode.id, 7)).slice(0, 12);
}

export function folderItems(ws: Workspace, folder: FolderId): EpisodeResult[] {
  const rs = ws.results;
  switch (folder) {
    case "review":
      return rs
        .filter((r) => r.triage === "Needs review")
        .sort((a, b) => a.confidence - b.confidence);
    case "unboxed":
      return rs.filter((r) => !ws.boxes.get(r.episode.id));
    case "rejected":
      return rs.filter((r) => r.triage === "Reject");
    case "kept":
      return rs.filter((r) => r.triage === "Keep");
    case "audit":
      return auditSample(ws);
    case "all":
      return rs;
  }
}

export interface Filters {
  query: string;
  phraseId: string | null;
  signal: string | null;
}

export function applyFilters(items: EpisodeResult[], f: Filters): EpisodeResult[] {
  const q = f.query.trim().toLowerCase();
  return items.filter((r) => {
    if (q && !`${r.episode.index} ${r.episode.instruction}`.toLowerCase().includes(q)) return false;
    if (f.phraseId && !r.phrases.some((p) => p.phraseId === f.phraseId && p.status !== "pass")) {
      return false;
    }
    if (f.signal && !r.signals.some((s) => s.includes(f.signal!))) return false;
    return true;
  });
}

export function sparkDisagrees(r: EpisodeResult): boolean {
  if (r.triage === "Needs review") return false;
  return r.episode.spark.decision !== r.triage;
}

/** 95% Wilson score interval for k successes in n. */
export function wilson(k: number, n: number): [number, number] {
  if (n === 0) return [0, 1];
  const z = 1.96;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const w = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - w) / d), Math.min(1, (c + w) / d)];
}

export function auditTally(ws: Workspace): { good: number; n: number } {
  const byEpisode = new Map<string, boolean>();
  for (const l of ws.labels) {
    if (l.source !== "audit") continue;
    byEpisode.set(l.episodeId, (byEpisode.get(l.episodeId) ?? true) && l.value === "pass");
  }
  return { good: [...byEpisode.values()].filter(Boolean).length, n: byEpisode.size };
}
