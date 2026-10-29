// PROTOTYPE (throwaway): Variant A helpers.
import type { EpisodeResult } from "../fixture/evaluate";
import { phrases } from "../fixture/rubric";

export type Page = "prepare" | "describe" | "episodes" | "review" | "audit" | "evaluation";

export const pages: { key: Page; label: string }[] = [
  { key: "prepare", label: "Prepare" },
  { key: "describe", label: "Describe" },
  { key: "episodes", label: "Episodes" },
  { key: "review", label: "Review" },
  { key: "audit", label: "Audit" },
  { key: "evaluation", label: "Evaluation" },
];

export function phraseText(id: string): string {
  return phrases.find((p) => p.id === id)?.text ?? id;
}

/** Short label for a Phrase chip. */
export const phraseShort: Record<string, string> = {
  "first-try": "first try",
  "no-drop": "never drops",
  placed: "placed in target",
  "no-pauses": "no long pauses",
};

export function episodeLabel(r: EpisodeResult): string {
  return `${r.episode.source === "droid_100" ? "" : "1.0.1 · "}Episode ${String(r.episode.index)}`;
}

/** Wilson score interval at 95%. */
export function wilson(k: number, n: number): [number, number] {
  if (n === 0) return [0, 1];
  const z = 1.96;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const h = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - h) / d), Math.min(1, (c + h) / d)];
}

export function readPage(): Page {
  const p = new URLSearchParams(window.location.search).get("page");
  return pages.some((x) => x.key === p) ? (p as Page) : "describe";
}

export function writePage(page: Page) {
  const url = new URL(window.location.href);
  url.searchParams.set("page", page);
  window.history.replaceState(null, "", url);
}
