// PROTOTYPE (throwaway): Variant A "Audit": a fixed uniform sample of 12 auto-Keeps, each marked
// good or bad (naming the failing Phrase). Audit labels feed only precision, shown as counts + CI.
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import type { EpisodeResult } from "../fixture/evaluate";
import type { Workspace } from "../fixture/useWorkspace";
import { Workstation } from "../shared/Workstation";
import { phraseShort, wilson } from "./util";

const SEED = 20261028;
const hash = (s: string) =>
  [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0, SEED);

export function auditSample(ws: Workspace): EpisodeResult[] {
  const audited = (r: EpisodeResult) =>
    ws.labels.some((l) => l.episodeId === r.episode.id && l.source === "audit");
  return ws.results
    .filter((r) => (r.triage === "Keep" && !r.phrases.some((p) => p.labelled)) || audited(r))
    .sort((a, b) => hash(a.episode.id) - hash(b.episode.id))
    .slice(0, 12);
}

/** One-sided 90% lower bound when all n are good (Clopper–Pearson). */
function oneSidedLower(n: number): number {
  return Math.pow(0.1, 1 / n);
}

export function AuditPage(props: { ws: Workspace }) {
  const { ws } = props;
  const [inspect, setInspect] = useState<EpisodeResult | null>(null);
  const sample = auditSample(ws);
  const verdictOf = (r: EpisodeResult) => {
    const ls = ws.labels.filter((l) => l.episodeId === r.episode.id && l.source === "audit");
    if (ls.length === 0) return null;
    return ls.some((l) => l.value === "fail") ? "bad" : "good";
  };
  const done = sample.filter((r) => verdictOf(r));
  const good = done.filter((r) => verdictOf(r) === "good").length;
  const [lo, hi] = wilson(good, done.length);
  const markGood = (r: EpisodeResult) => {
    for (const p of r.phrases)
      ws.addLabel({
        episodeId: r.episode.id,
        phraseId: p.phraseId,
        value: "pass",
        source: "audit",
      });
  };
  const markBad = (r: EpisodeResult, phraseId: string) => {
    ws.addLabel({ episodeId: r.episode.id, phraseId, value: "fail", source: "audit" });
  };
  return (
    <div className="max-w-5xl px-8 py-6">
      <h1 className="text-xl font-semibold">Audit</h1>
      <p className="text-sm text-muted-foreground">
        {sample.length} auto-Keeps drawn uniformly (up to 12, seed {SEED}). Audit labels measure
        precision only; they never tune margins.
      </p>
      <div className="mt-4 rounded-lg border bg-card p-4">
        <div className="text-2xl font-semibold tabular-nums">
          {good} / {done.length} good
        </div>
        <div className="text-sm text-muted-foreground tabular-nums">
          {done.length === 0
            ? "No Episodes audited yet"
            : `95% CI ${lo.toFixed(2)}–${hi.toFixed(2)} (Wilson)`}
          {done.length > 0 &&
            good === done.length &&
            ` · ≥ ${oneSidedLower(done.length).toFixed(2)} (90%, one-sided)`}
          {` · ${String(sample.length - done.length)} left`}
        </div>
      </div>
      <div className="mt-4 divide-y rounded-lg border">
        {sample.map((r) => {
          const v = verdictOf(r);
          return (
            <div
              key={r.episode.id}
              className={cn("flex items-center gap-3 p-2.5", v && "bg-muted/40")}
            >
              <button
                type="button"
                onClick={() => {
                  setInspect(r);
                }}
              >
                <img
                  src={r.episode.frames.ext1 ?? ""}
                  alt=""
                  className="aspect-video w-28 rounded object-cover"
                />
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">Episode {r.episode.index}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {r.episode.instruction}
                </div>
              </div>
              {v ? (
                <span
                  className={cn(
                    "text-sm font-medium",
                    v === "good" ? "text-emerald-700" : "text-orange-700",
                  )}
                >
                  {v === "good"
                    ? "Good"
                    : `Bad: ${ws.labels
                        .filter(
                          (l) =>
                            l.episodeId === r.episode.id &&
                            l.source === "audit" &&
                            l.value === "fail",
                        )
                        .map((l) => phraseShort[l.phraseId])
                        .join(", ")}`}
                </span>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      markGood(r);
                    }}
                  >
                    Good
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline">
                        Bad <ChevronDown className="size-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Which Phrase fails?</DropdownMenuLabel>
                      {r.phrases.map((p) => (
                        <DropdownMenuItem
                          key={p.phraseId}
                          onSelect={() => {
                            markBad(r, p.phraseId);
                          }}
                        >
                          {phraseShort[p.phraseId]}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          );
        })}
      </div>
      <Sheet
        open={inspect !== null}
        onOpenChange={(o) => {
          if (!o) setInspect(null);
        }}
      >
        <SheetContent className="w-[760px] overflow-y-auto sm:max-w-[760px]">
          <SheetHeader>
            <SheetTitle>Episode {inspect?.episode.index}</SheetTitle>
          </SheetHeader>
          {inspect && <Workstation result={inspect} stacked className="px-4 pb-6" />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
