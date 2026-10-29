// The report's wording, shared with `winnow eval`: counts first, then 95% intervals, never "±".
import type { LengthRule, Proportion } from "./useEvaluation";

/** e.g. "1 of 4". */
export function countOf(p: Proportion): string {
  return `${String(p.count)} of ${String(p.of)}`;
}

/** e.g. "0.05–0.70"; null when there is nothing to count. */
export function interval(p: Proportion): string | null {
  if (p.low === null || p.high === null) return null;
  return `${p.low.toFixed(2)}–${p.high.toFixed(2)}`;
}

export function lengthRuleText(rule: LengthRule | null): string {
  if (rule === null) return "Length alone: no labelled Episode to fit a threshold to.";
  const side = rule.keep === "longer" ? "≥" : "≤";
  return `Length alone keeps Episodes ${side} ${rule.threshold_s.toFixed(1)} s (threshold set in hindsight).`;
}
