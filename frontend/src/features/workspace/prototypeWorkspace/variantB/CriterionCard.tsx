// PROTOTYPE (throwaway): Variant B Criterion card and Rubric-settings editor for the Describe
// drawer. Every number here comes from the anchor pool only, never the whole Dataset.
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import type { Criterion } from "../fixture/rubric";
import { passes } from "../fixture/rubric";
import type { Workspace } from "../fixture/useWorkspace";

const BINS = 18;

function Histogram(props: { c: Criterion; values: number[] }) {
  const { c, values } = props;
  const [lo, hi] = c.range;
  const w = (hi - lo) / BINS;
  const counts = Array.from(
    { length: BINS },
    (_, i) =>
      values.filter((v) => v >= lo + i * w && (v < lo + (i + 1) * w || (i === BINS - 1 && v <= hi)))
        .length,
  );
  const max = Math.max(1, ...counts);
  const x = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  const band = c.margin > 0;
  return (
    <div className="relative h-12 border-b">
      {band && (
        <div
          className="absolute inset-y-0 bg-amber-200/50"
          style={{
            left: x(Math.max(lo, c.threshold - c.margin)),
            width: `${((2 * c.margin) / (hi - lo)) * 100}%`,
          }}
          title={`margin ${c.margin} ${c.unit}`}
        />
      )}
      <div className="absolute inset-0 flex items-end gap-px">
        {counts.map((n, i) => (
          <div
            key={i}
            className={cn(
              "flex-1",
              passes(c, lo + (i + 0.5) * w) ? "bg-emerald-500/70" : "bg-orange-500/70",
            )}
            style={{ height: `${(n / max) * 100}%` }}
          />
        ))}
      </div>
      <div className="absolute inset-y-0 w-px bg-foreground" style={{ left: x(c.threshold) }} />
    </div>
  );
}

export function CriterionCard(props: { ws: Workspace; c: Criterion; highlight?: boolean }) {
  const { ws, c } = props;
  const pool = ws.results.filter((r) => ws.anchorIds.has(r.episode.id));
  const rs = pool.flatMap((r) => r.results.filter((x) => x.criterion.id === c.id));
  const values = rs.map((x) => x.value).filter((v): v is number => v !== null);
  const pass = rs.filter((x) => x.status === "pass").length;
  const unsure = rs.filter((x) => x.status === "unsure").length;
  const step =
    c.unit === "attempts" || c.unit === "yes votes" ? 1 : (c.range[1] - c.range[0]) / 100;
  return (
    <div
      className={cn(
        "rounded-md border bg-background p-2.5",
        !c.enabled && "opacity-50",
        props.highlight && "ring-2 ring-sky-400",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <div className="text-xs font-medium">{c.english}</div>
          <div className="text-[11px] text-muted-foreground">
            {c.primitive} · {c.kind}
            {!c.conclusive && " · inconclusive fail"}
          </div>
        </div>
        <label className="flex items-center gap-1 text-[11px]">
          hard
          <Switch size="sm" checked={c.hard} onCheckedChange={() => ws.toggleHard(c.id)} />
        </label>
        <label className="flex items-center gap-1 text-[11px]">
          on
          <Switch size="sm" checked={c.enabled} onCheckedChange={() => ws.toggleEnabled(c.id)} />
        </label>
      </div>
      <div className="mt-2">
        <Histogram c={c} values={values} />
        <Slider
          className="mt-1.5"
          min={c.range[0]}
          max={c.range[1]}
          step={step}
          value={[c.threshold]}
          onValueChange={([v]) => v !== undefined && ws.setThreshold(c.id, v)}
        />
        <div className="mt-1 flex text-[11px] text-muted-foreground tabular-nums">
          <span>
            {c.comparator} {+c.threshold.toFixed(3)} {c.unit}
            {c.margin > 0 && ` · margin ${c.margin}`}
          </span>
          <span className="ml-auto">
            anchor pool: {pass} of {rs.length} pass · {unsure} unsure
          </span>
        </div>
      </div>
      {c.assumptions.map((a) => (
        <div
          key={a}
          className="mt-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-900"
        >
          ⚠ assumed: {a}
        </div>
      ))}
    </div>
  );
}

export function SettingsEditor(props: { ws: Workspace; highlight?: string | undefined }) {
  const s = props.ws.rubric.settings;
  const rows = [
    {
      key: "gripperClosed" as const,
      label: "Gripper-closed level",
      v: s.gripperClosed,
      min: 0.1,
      max: 0.9,
      step: 0.01,
      unit: "",
    },
    {
      key: "graspRiseCm" as const,
      label: "Grasp rule: last closure that rises ≥",
      v: s.graspRiseCm,
      min: 0.5,
      max: 5,
      step: 0.1,
      unit: " cm",
    },
  ];
  return (
    <div className="grid gap-2 rounded-md border bg-background p-2.5">
      <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        Rubric settings
      </div>
      {rows.map((row) => (
        <div
          key={row.key}
          className={cn("rounded p-1", props.highlight === row.key && "ring-2 ring-sky-400")}
        >
          <div className="flex text-xs">
            <span>{row.label}</span>
            <span className="ml-auto tabular-nums">
              {row.v.value}
              {row.unit}
            </span>
          </div>
          <Slider
            className="mt-1"
            min={row.min}
            max={row.max}
            step={row.step}
            value={[row.v.value]}
            onValueChange={([v]) => v !== undefined && props.ws.setSetting(row.key, v)}
          />
          {row.v.assumed && (
            <div className="mt-1 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-900">
              ⚠ assumed, not yet confirmed by the interview
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
