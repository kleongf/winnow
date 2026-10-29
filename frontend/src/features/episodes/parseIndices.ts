// "3, 16 40-42" -> [3, 16, 40, 41, 42]: Episode indices for an ingest, each once, in order.
export type Parsed = { ok: true; indices: number[] } | { ok: false; error: string };

const RANGE = /^(\d+)(?:-(\d+))?$/;

export function parseIndices(text: string): Parsed {
  const tokens = text.split(/[\s,]+/).filter(Boolean);
  if (tokens.length === 0) return { ok: false, error: "Enter at least one Episode index" };
  const indices = new Set<number>();
  for (const token of tokens) {
    const match = RANGE.exec(token);
    const start = Number(match?.[1]);
    const end = match?.[2] === undefined ? start : Number(match[2]);
    if (!match || end < start) return { ok: false, error: `Can't read "${token}"` };
    for (let i = start; i <= end; i++) indices.add(i);
  }
  return { ok: true, indices: [...indices] };
}
