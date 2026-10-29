// The Episodes table's filters and sort, kept in the URL (`?phrase=`, `?signal=`, `?set=`,
// `?sort=`) so a filtered view survives reloads and links.
import type { SetName } from "../sets/useSets";
import type { TriageRow } from "../triage/useTriage";

export type SetFilter = SetName | "none";
/** Least confident first, most confident first, or the Dataset's order. */
export type SortOrder = "confidence" | "-confidence" | null;

export interface EpisodeFilters {
  phrase: string | null; // Episodes where this Phrase didn't pass
  signal: string | null; // Episodes with this Uncertainty signal
  set: SetFilter | null;
  sort: SortOrder;
}

const SETS: SetFilter[] = ["dev", "test", "none"];
const SORTS: SortOrder[] = ["confidence", "-confidence"];

export function parseFilters(params: URLSearchParams): EpisodeFilters {
  return {
    phrase: params.get("phrase"),
    signal: params.get("signal"),
    set: SETS.find((s) => s === params.get("set")) ?? null,
    sort: SORTS.find((s) => s === params.get("sort")) ?? null,
  };
}

/** Off, then least confident first, then most confident first. */
export function nextSort(sort: SortOrder): SortOrder {
  if (sort === null) return "confidence";
  return sort === "confidence" ? "-confidence" : null;
}

function matches(
  filters: EpisodeFilters,
  row: TriageRow | undefined,
  set: SetName | undefined,
): boolean {
  if (filters.phrase !== null && !row?.not_passed.some((p) => p.phrase === filters.phrase)) {
    return false;
  }
  if (filters.signal !== null && !row?.uncertainty.some((s) => s === filters.signal)) {
    return false;
  }
  if (filters.set !== null && (set ?? "none") !== filters.set) return false;
  return true;
}

/** The Episodes the filters let through, in the chosen order; unscored Episodes sort last. */
export function applyFilters<T extends { id: string }>(
  episodes: T[],
  filters: EpisodeFilters,
  triageOf: Map<string, TriageRow>,
  setOf: Map<string, SetName>,
): T[] {
  const shown = episodes.filter((e) => matches(filters, triageOf.get(e.id), setOf.get(e.id)));
  if (filters.sort === null) return shown;
  const sign = filters.sort === "confidence" ? 1 : -1;
  const key = (e: T) => triageOf.get(e.id)?.confidence;
  return [...shown].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (ka === undefined || kb === undefined)
      return Number(ka === undefined) - Number(kb === undefined);
    return sign * (ka - kb);
  });
}

/** The Uncertainty signals present in these rows, for the signal filter's options. */
export function signalsIn(rows: TriageRow[]): string[] {
  return [...new Set(rows.flatMap((r) => r.uncertainty))].sort();
}
