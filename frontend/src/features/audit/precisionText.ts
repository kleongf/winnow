// Keep precision as the Audit tab states it: the count first, then its 95% Wilson interval, plus
// the one-sided bound when every marked Keep is good. Never "±".
import { interval } from "../evaluation/reportText";
import type { KeepPrecision } from "./useAudit";

/** e.g. "14/15 good · 95% CI 0.70–0.99", or "15/15 good · 95% CI 0.80–1.00 · ≥ 0.86 (90%)". */
export function precisionText(precision: KeepPrecision): string {
  const { good, lower_bound: bound } = precision;
  if (good.of === 0) return "No Keeps marked yet";
  const parts = [`${String(good.count)}/${String(good.of)} good`];
  const range = interval(good);
  if (range) parts.push(`95% CI ${range}`);
  if (bound !== null) {
    const confidence = Math.round(precision.lower_bound_confidence * 100);
    parts.push(`≥ ${bound.toFixed(2)} (${String(confidence)}%)`);
  }
  return parts.join(" · ");
}
