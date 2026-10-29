// PROTOTYPE (throwaway): Variant A Criterion card: threshold slider over an anchor-pool histogram
// with the margin band, anchor-pool pass/fail/unsure counts, hard/soft and disable switches.
import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import type { EpisodeResult } from "../fixture/evaluate";
import type { Criterion } from "../fixture/rubric";
import type { Workspace } from "../fixture/useWorkspace";

const BINS = 24;

function step(c: Criterion): number {
  if (["attempts", "yes votes"].includes(c.unit)) return 1;
  return (c.range[1] - c.range[0]) / 100;
}

function fmt(c: Criterion, v: number): string {
  if (c.unit === "m") return `${(v * 100).toFixed(1)} cm`;
  if (c.unit === "share") return `${String(Math.round(v * 100))}%`;
  if (step(c) === 1) return `${String(v)} ${v === 1 ? c.unit.replace(/s$/, "") : c.unit}`;
  return `${v.toFixed(c.unit === "s" ? 1 : 2)} ${c.unit}`;
}

export function CriterionCard(props: {
  ws: Workspace;
  criterion: Criterion;
  anchor: EpisodeResult[];
  flash: boolean;
}) {
  const { ws, criterion: c, anchor } = props;
  const [lo, hi] = c.range;
  const values = anchor
    .map((r) => r.episode.values[c.id])
    .filter((v): v is number => v !== null && v !== undefined);
  const bins = Array.from({ length: BINS }, () => 0);
  for (const v of values) {
    const b = Math.min(BINS - 1, Math.max(0, Math.floor(((v - lo) / (hi - lo)) * BINS)));
    bins[b] = (bins[b] ?? 0) + 1;
  }
  const max = Math.max(1, ...bins);
  const pct = (v: number) => `${String(Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100)))}%`;
  const counts = { pass: 0, fail: 0, unsure: 0 };
  for (const r of anchor) {
    const cr = r.results.find((x) => x.criterion.id === c.id);
    if (cr) counts[cr.status] += 1;
  }
  const missing = anchor.length - values.length;
  return (
    <div
      id={`crit-${c.id}`}
      className={cn(
        "rounded-lg border bg-card p-3 transition-shadow duration-700",
        !c.enabled && "opacity-50",
        props.flash && "ring-2 ring-sky-400",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <code className="text-xs font-semibold">{c.primitive}</code>
            <Badge variant="outline" className="h-4 px-1 text-[10px]">
              {c.kind}
            </Badge>
            {!c.conclusive && (
              <Badge variant="outline" className="h-4 px-1 text-[10px] text-muted-foreground">
                inconclusive fail
              </Badge>
            )}
          </div>
          <div className="mt-0.5 text-sm">{c.english}</div>
        </div>
        <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
          {c.hard ? "hard" : "soft"}
          <Switch
            size="sm"
            checked={c.hard}
            onCheckedChange={() => {
              ws.toggleHard(c.id);
            }}
          />
        </label>
        <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
          on
          <Switch
            size="sm"
            checked={c.enabled}
            onCheckedChange={() => {
              ws.toggleEnabled(c.id);
            }}
          />
        </label>
      </div>
      {c.assumptions.map((a) => (
        <div
          key={a}
          className="mt-2 flex items-center gap-1.5 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
          <AlertTriangle className="size-3" /> Assumed: {a}
        </div>
      ))}
      {c.kind !== "visual" || step(c) === 1 ? (
        <div className="mt-3">
          <div className="relative h-12">
            {c.margin > 0 && (
              <div
                className="absolute inset-y-0 bg-amber-200/50 dark:bg-amber-700/30"
                style={{
                  left: pct(c.threshold - c.margin),
                  width: `calc(${pct(c.threshold + c.margin)} - ${pct(c.threshold - c.margin)})`,
                }}
                title={`margin ${fmt(c, c.margin)}: inside it the result is unsure`}
              />
            )}
            <div className="absolute inset-0 flex items-end gap-px">
              {bins.map((n, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-[1px] bg-foreground/25"
                  style={{ height: `${String((n / max) * 100)}%` }}
                />
              ))}
            </div>
            <div
              className="absolute inset-y-0 w-0.5 bg-sky-600"
              style={{ left: pct(c.threshold) }}
            />
          </div>
          <Slider
            className="mt-1.5"
            min={lo}
            max={hi}
            step={step(c)}
            value={[c.threshold]}
            onValueChange={(v) => {
              ws.setThreshold(c.id, v[0] ?? c.threshold);
            }}
          />
          <div className="mt-1 flex justify-between text-[11px] text-muted-foreground tabular-nums">
            <span>{fmt(c, lo)}</span>
            <span className="font-medium text-foreground">
              {c.comparator} {fmt(c, c.threshold)}
              {c.margin > 0 && ` · margin ${fmt(c, c.margin)}`}
            </span>
            <span>{fmt(c, hi)}</span>
          </div>
        </div>
      ) : null}
      <div className="mt-2 flex gap-3 text-xs tabular-nums">
        <span className="text-muted-foreground">Anchor pool:</span>
        <span className="text-emerald-700">{counts.pass} pass</span>
        <span className="text-orange-700">{counts.fail} fail</span>
        <span className="text-amber-600">{counts.unsure} unsure</span>
        <span className="text-muted-foreground">of {anchor.length}</span>
        {missing > 0 && <span className="text-muted-foreground">· {missing} no value</span>}
      </div>
    </div>
  );
}
