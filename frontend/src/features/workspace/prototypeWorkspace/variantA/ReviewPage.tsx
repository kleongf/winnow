// PROTOTYPE (throwaway): Variant A "Review": the Needs review queue, strictly least confident first.
// The reviewer answers only the unsure Phrases; each answer is a "review" label and the Episode's
// Triage decision recomputes, so it drops out of the queue.
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import type { EpisodeResult } from "../fixture/evaluate";
import type { Workspace } from "../fixture/useWorkspace";
import { Workstation } from "../shared/Workstation";
import { phraseText } from "./util";

export function reviewQueue(ws: Workspace): EpisodeResult[] {
  return ws.results
    .filter((r) => r.triage === "Needs review")
    .sort((a, b) => a.confidence - b.confidence);
}

function ReviewPanel(props: { ws: Workspace; result: EpisodeResult }) {
  const { ws, result } = props;
  const unsure = result.phrases.filter((p) => p.status === "unsure");
  const answer = (phraseId: string, value: "pass" | "fail") => {
    ws.addLabel({ episodeId: result.episode.id, phraseId, value, source: "review" });
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const first = unsure[0];
      if (!first) return;
      if (e.key === "1") answer(first.phraseId, "pass");
      if (e.key === "2") answer(first.phraseId, "fail");
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  });
  return (
    <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 dark:bg-amber-950/40">
      <div className="text-[11px] font-medium tracking-wide text-amber-800 uppercase">
        Your call · {unsure.length} unsure Phrase{unsure.length === 1 ? "" : "s"}
      </div>
      {unsure.map((p, i) => (
        <div key={p.phraseId} className="mt-2.5">
          <div className="text-sm font-medium">“{phraseText(p.phraseId)}”</div>
          <div className="text-xs text-amber-900/80 dark:text-amber-200">
            {p.signals.join("; ")}
          </div>
          <div className="mt-1.5 flex gap-1.5">
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                answer(p.phraseId, "pass");
              }}
            >
              <span>Pass</span> {i === 0 && <kbd className="text-muted-foreground">1</kbd>}
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                answer(p.phraseId, "fail");
              }}
            >
              <span>Fail</span> {i === 0 && <kbd className="text-muted-foreground">2</kbd>}
            </Button>
          </div>
        </div>
      ))}
      <p className="mt-3 text-[11px] text-muted-foreground">
        Phrases that already passed or failed aren’t asked.
      </p>
    </div>
  );
}

export function ReviewPage(props: { ws: Workspace }) {
  const { ws } = props;
  const queue = reviewQueue(ws);
  const [started] = useState(queue.length);
  const reviewed = new Set(ws.labels.filter((l) => l.source === "review").map((l) => l.episodeId));
  const total = Math.max(started, queue.length + reviewed.size);
  const current = queue[0];
  return (
    <div className="px-8 py-5">
      <div className="mb-4 flex items-center gap-4">
        <div>
          <h1 className="text-xl font-semibold">Review</h1>
          <p className="text-sm text-muted-foreground">
            {reviewed.size} of {total} reviewed · least confident first
          </p>
        </div>
        <Progress
          value={(reviewed.size / Math.max(1, total)) * 100}
          className="ml-6 h-1.5 max-w-sm"
        />
        {current && (
          <span className="ml-auto text-sm">
            Episode {current.episode.index}{" "}
            <span className="text-muted-foreground">
              · confidence {current.confidence.toFixed(2)}
            </span>
          </span>
        )}
      </div>
      {current ? (
        <Workstation
          key={current.episode.id}
          result={current}
          actions={<ReviewPanel ws={ws} result={current} />}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Queue empty: every Episode is decided.</p>
      )}
      {queue.length > 1 && (
        <div className="mt-6">
          <div className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Up next
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {queue.slice(1, 12).map((r) => (
              <div key={r.episode.id} className="w-36 shrink-0 text-xs">
                <img
                  src={r.episode.frames.ext1 ?? ""}
                  alt=""
                  className="aspect-video w-full rounded object-cover"
                />
                <div className="mt-1 font-medium">Episode {r.episode.index}</div>
                <div className="text-muted-foreground tabular-nums">{r.confidence.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
