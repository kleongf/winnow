// PROTOTYPE (throwaway): Variant C Criterion strip, opened from a Phrase column header. Every
// number here comes from the anchor pool only; dragging a threshold re-sorts the matrix live.
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import type { Criterion } from "../fixture/rubric";
import type { Workspace } from "../fixture/useWorkspace";

export function CriterionStrip(props: { ws: Workspace; phraseId: string; onClose: () => void }) {
  const { ws, phraseId } = props;
  const phrase = ws.rubric.phrases.find((p) => p.id === phraseId);
  const cs = ws.rubric.criteria.filter((c) => c.phraseId === phraseId);
  return (
    <section className="border-b bg-muted/40 px-4 py-3">
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-sm font-medium">“{phrase?.text}”</span>
        <span className="text-xs text-muted-foreground">
          compiles to {cs.length} Criteri{cs.length === 1 ? "on" : "a"} · stats from the anchor pool
          only
        </span>
        <Button
          size="icon-xs"
          variant="ghost"
          className="ml-auto"
          onClick={props.onClose}
          aria-label="Close"
        >
          <X />
        </Button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {cs.map((c) => (
          <CriterionCard key={c.id} ws={ws} c={c} />
        ))}
        {phraseId === "first-try" && <SettingsCard ws={ws} />}
      </div>
    </section>
  );
}

function CriterionCard(props: { ws: Workspace; c: Criterion }) {
  const { ws, c } = props;
  const anchor = ws.results.filter((r) => ws.anchorIds.has(r.episode.id));
  const values = anchor.map((r) => r.episode.values[c.id]).filter((v): v is number => v != null);
  const statuses = anchor.map((r) => r.results.find((x) => x.criterion.id === c.id)?.status);
  const pass = statuses.filter((s) => s === "pass").length;
  const unsure = statuses.filter((s) => s === "unsure").length;
  const [lo, hi] = c.range;
  const step = c.unit === "attempts" || c.unit === "yes votes" ? 1 : (hi - lo) / 100;
  const visual = c.kind === "visual";
  return (
    <div className={cn("w-72 shrink-0 rounded-md border bg-card p-3", !c.enabled && "opacity-50")}>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-xs font-semibold">{c.primitive}</span>
        <span className="text-[11px] text-muted-foreground">{c.kind}</span>
        {!c.conclusive && (
          <span className="text-[11px] text-muted-foreground">· inconclusive fail</span>
        )}
      </div>
      <p className="mt-1 text-xs leading-snug">{c.english}</p>
      <Histogram values={values} c={c} />
      <Slider
        className="mt-1"
        min={lo}
        max={hi}
        step={step}
        value={[c.threshold]}
        disabled={visual || !c.enabled}
        onValueChange={([v]) => {
          if (v !== undefined) ws.setThreshold(c.id, +v.toFixed(3));
        }}
      />
      <div className="mt-1.5 flex justify-between font-mono text-[11px] text-muted-foreground">
        <span>
          {c.comparator} {c.threshold}
          {c.margin > 0 ? ` (margin ${c.margin})` : ""} {c.unit}
        </span>
        <span>
          {pass} of {anchor.length} pass · {unsure} unsure
        </span>
      </div>
      {c.assumptions.map((a) => (
        <div
          key={a}
          className="mt-1.5 rounded border-l-2 border-amber-500 bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-900"
        >
          Assumed: {a}
        </div>
      ))}
      <div className="mt-2 flex items-center gap-4 text-xs">
        <label className="flex items-center gap-1.5">
          <Switch size="sm" checked={c.hard} onCheckedChange={() => ws.toggleHard(c.id)} />
          {c.hard ? "hard" : "soft"}
        </label>
        <label className="flex items-center gap-1.5">
          <Switch size="sm" checked={c.enabled} onCheckedChange={() => ws.toggleEnabled(c.id)} />
          {c.enabled ? "enabled" : "disabled"}
        </label>
      </div>
    </div>
  );
}

function Histogram(props: { values: number[]; c: Criterion }) {
  const { values, c } = props;
  const [lo, hi] = c.range;
  const bins = 24;
  const counts = Array.from({ length: bins }, () => 0);
  for (const v of values) {
    const i = Math.min(bins - 1, Math.max(0, Math.floor(((v - lo) / (hi - lo)) * bins)));
    counts[i] = (counts[i] ?? 0) + 1;
  }
  const max = Math.max(1, ...counts);
  const x = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const bandLo = x(Math.max(lo, c.threshold - c.margin));
  const bandHi = x(Math.min(hi, c.threshold + c.margin));
  return (
    <div className="relative mt-2 h-12 border-b">
      {c.margin > 0 && (
        <div
          className="absolute inset-y-0 bg-amber-300/40"
          style={{ left: `${bandLo}%`, width: `${bandHi - bandLo}%` }}
        />
      )}
      <div className="absolute inset-0 flex items-end gap-px">
        {counts.map((n, i) => (
          <div
            key={i}
            className="flex-1 bg-foreground/60"
            style={{ height: `${(n / max) * 100}%` }}
          />
        ))}
      </div>
      <div
        className="absolute inset-y-0 w-0.5 bg-blue-600"
        style={{ left: `${x(c.threshold)}%` }}
      />
    </div>
  );
}

function SettingsCard(props: { ws: Workspace }) {
  const { ws } = props;
  const s = ws.rubric.settings;
  const rows = [
    {
      key: "gripperClosed" as const,
      label: "Gripper-closed level",
      v: s.gripperClosed,
      min: 0,
      max: 1,
      step: 0.01,
      unit: "",
    },
    {
      key: "graspRiseCm" as const,
      label: "Grasp rule: last closure rising ≥",
      v: s.graspRiseCm,
      min: 0,
      max: 6,
      step: 0.5,
      unit: " cm",
    },
  ];
  return (
    <div className="w-72 shrink-0 rounded-md border border-dashed bg-card p-3">
      <div className="text-xs font-semibold">Rubric settings</div>
      <p className="text-[11px] text-muted-foreground">
        Shared by every window and by grasp_attempts.
      </p>
      {rows.map((r) => (
        <div key={r.key} className="mt-3">
          <div className="flex justify-between text-xs">
            <span>{r.label}</span>
            <span
              className={cn("font-mono", r.v.assumed && "rounded bg-amber-200 px-1 text-amber-900")}
            >
              {r.v.value}
              {r.unit}
              {r.v.assumed ? " · assumed" : ""}
            </span>
          </div>
          <Slider
            className="mt-1.5"
            min={r.min}
            max={r.max}
            step={r.step}
            value={[r.v.value]}
            onValueChange={([v]) => {
              if (v !== undefined) ws.setSetting(r.key, v);
            }}
          />
        </div>
      ))}
    </div>
  );
}
