// PROTOTYPE (throwaway): Variant C view-model helpers (row filtering, cell summaries, Wilson CI).
import type { CriterionResult, EpisodeResult, PhraseResult } from "../fixture/evaluate";
import type { Workspace } from "../fixture/useWorkspace";

export type Mode = "describe" | "results";
export type Filter = "all" | "Needs review" | "Reject" | "Keep" | "spark" | "unboxed" | "audit";
export type SortKey = "confidence" | "episode";

export function sparkDisagrees(r: EpisodeResult): boolean {
  if (r.triage === "Needs review") return false;
  return r.episode.spark.decision !== r.triage;
}

/** Up to 12 auto-Keeps (no human label decided them), fixed by a recorded seed. */
export function auditSample(results: EpisodeResult[]): Set<string> {
  const autoKeeps = results.filter(
    (r) =>
      r.triage === "Keep" && r.phrases.every((p) => !p.labelled || p.labelled.source === "audit"),
  );
  const seeded = [...autoKeeps].sort(
    (a, b) => ((a.episode.index * 7919) % 101) - ((b.episode.index * 7919) % 101),
  );
  return new Set(seeded.slice(0, 12).map((r) => r.episode.id));
}

export function visibleRows(
  ws: Workspace,
  mode: Mode,
  filter: Filter,
  sort: SortKey,
  audit: Set<string>,
): EpisodeResult[] {
  let rows =
    mode === "describe" ? ws.results.filter((r) => ws.anchorIds.has(r.episode.id)) : ws.results;
  if (mode === "results") {
    rows = rows.filter((r) => {
      switch (filter) {
        case "all":
          return true;
        case "spark":
          return sparkDisagrees(r);
        case "unboxed":
          return !r.episode.box;
        case "audit":
          return audit.has(r.episode.id);
        default:
          return r.triage === filter;
      }
    });
  }
  const byEpisode = (a: EpisodeResult, b: EpisodeResult) =>
    a.episode.source.localeCompare(b.episode.source) || a.episode.index - b.episode.index;
  return [...rows].sort((a, b) =>
    sort === "confidence" ? a.confidence - b.confidence || byEpisode(a, b) : byEpisode(a, b),
  );
}

/** The Criterion result that best explains a Phrase cell. */
export function decidingResult(r: EpisodeResult, phraseId: string): CriterionResult | undefined {
  const rs = r.results.filter((c) => c.criterion.phraseId === phraseId);
  return (
    rs.find((c) => c.status === "fail" && c.crisp && c.criterion.conclusive) ??
    rs.find((c) => c.status === "unsure" || (c.status === "fail" && !c.criterion.conclusive)) ??
    rs[0]
  );
}

export function cellText(r: EpisodeResult, p: PhraseResult): string {
  if (p.labelled) return `labelled ${p.labelled.value}`;
  const d = decidingResult(r, p.phraseId);
  if (!d) return "";
  if (p.status === "unsure") {
    if (d.signal) return d.signal.replace(" (box-area jump)", "");
    return "unconfirmed fail";
  }
  return d.measurement;
}

export function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 1];
  const p = k / n;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const spread = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (centre - spread) / denom), Math.min(1, (centre + spread) / denom)];
}

export const cellId = (episodeId: string, phraseId: string) =>
  `cellC-${episodeId.replace(/[^\w]/g, "_")}-${phraseId}`;
