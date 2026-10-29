// PROTOTYPE (throwaway): Variant A live Rubric: the Description with each Phrase highlighted and
// linked to its Criterion cards, Phrase statuses, and the two Rubric-level settings.
import { AlertTriangle } from "lucide-react";
import { Fragment } from "react";

import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

import type { EpisodeResult } from "../fixture/evaluate";
import type { Phrase } from "../fixture/rubric";
import type { Workspace } from "../fixture/useWorkspace";
import { CriterionCard } from "./CriterionCard";

const phraseTone: Record<Phrase["status"], string> = {
  Checked: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100",
  Context: "bg-muted text-muted-foreground",
  Unsupported: "bg-rose-100 text-rose-900 line-through dark:bg-rose-900/40",
};

function DescriptionText(props: { ws: Workspace }) {
  const { description, phrases } = props.ws.rubric;
  const parts: { text: string; phrase?: Phrase }[] = [];
  let rest = description;
  for (const p of phrases) {
    const at = rest.indexOf(p.text);
    if (at < 0) continue;
    if (at > 0) parts.push({ text: rest.slice(0, at) });
    parts.push({ text: p.text, phrase: p });
    rest = rest.slice(at + p.text.length);
  }
  if (rest) parts.push({ text: rest });
  return (
    <p className="text-[15px] leading-7">
      {parts.map((part, i) =>
        part.phrase ? (
          <a
            key={i}
            href={`#phrase-${part.phrase.id}`}
            className={cn("rounded px-1 py-0.5", phraseTone[part.phrase.status])}
          >
            {part.text}
          </a>
        ) : (
          <Fragment key={i}>{part.text}</Fragment>
        ),
      )}
    </p>
  );
}

export function RubricPanel(props: {
  ws: Workspace;
  anchor: EpisodeResult[];
  flash: string | null;
}) {
  const { ws, anchor, flash } = props;
  const { rubric } = ws;
  return (
    <div>
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Description
        </div>
        <DescriptionText ws={ws} />
      </div>
      <Settings ws={ws} flash={flash} />
      {rubric.phrases.map((p) => {
        const cs = rubric.criteria.filter((c) => c.phraseId === p.id);
        const assumed = cs.some((c) => c.assumptions.length > 0);
        return (
          <section key={p.id} id={`phrase-${p.id}`} className="mt-5 scroll-mt-4">
            <div className="mb-2 flex items-center gap-2">
              <span className={cn("rounded px-1.5 py-0.5 text-sm", phraseTone[p.status])}>
                “{p.text}”
              </span>
              <Badge variant="outline" className="text-[10px]">
                {p.status}
              </Badge>
              {p.status === "Checked" && (
                <span className="text-xs text-muted-foreground">
                  {cs.length} Criteri{cs.length === 1 ? "on" : "a"} ·{" "}
                  {assumed ? (
                    <span className="text-amber-700">assumptions open</span>
                  ) : (
                    <span className="text-emerald-700">covered</span>
                  )}
                </span>
              )}
            </div>
            {p.note && <p className="mb-2 text-xs text-muted-foreground">{p.note}</p>}
            <div className="grid gap-2">
              {cs.map((c) => (
                <CriterionCard
                  key={c.id}
                  ws={ws}
                  criterion={c}
                  anchor={anchor}
                  flash={flash === c.id}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Settings(props: { ws: Workspace; flash: string | null }) {
  const { ws, flash } = props;
  const { gripperClosed, graspRiseCm } = ws.rubric.settings;
  const rows = [
    {
      key: "gripperClosed" as const,
      label: "Gripper-closed level",
      s: gripperClosed,
      range: [0.1, 0.8] as [number, number],
      step: 0.01,
      show: (v: number) => v.toFixed(2),
    },
    {
      key: "graspRiseCm" as const,
      label: "Grasp rule: the last closure that rises ≥",
      s: graspRiseCm,
      range: [0.5, 6] as [number, number],
      step: 0.5,
      show: (v: number) => `${v.toFixed(1)} cm`,
    },
  ];
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {rows.map((r) => (
        <div
          key={r.key}
          id={`crit-${r.key}`}
          className={cn(
            "rounded-lg border bg-card p-3 transition-shadow duration-700",
            flash === r.key && "ring-2 ring-sky-400",
          )}
        >
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            Rubric setting
            {r.s.assumed && (
              <span className="ml-auto flex items-center gap-1 text-amber-700">
                <AlertTriangle className="size-3" /> assumed
              </span>
            )}
          </div>
          <div className="mt-0.5 text-sm">
            {r.label} <span className="font-semibold tabular-nums">{r.show(r.s.value)}</span>
          </div>
          <Slider
            className="mt-2"
            min={r.range[0]}
            max={r.range[1]}
            step={r.step}
            value={[r.s.value]}
            onValueChange={(v) => {
              ws.setSetting(r.key, v[0] ?? r.s.value);
            }}
          />
        </div>
      ))}
    </div>
  );
}
