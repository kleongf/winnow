// PROTOTYPE (throwaway): Variant B "Unboxed" folder main pane: one big frame 0, pick the view where
// the object looks biggest, drag a box, Enter saves and moves to the next unboxed Episode.
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { Rect } from "../fixture/episodes";
import type { EpisodeResult } from "../fixture/evaluate";
import type { Workspace } from "../fixture/useWorkspace";
import { BoxCanvas } from "../shared/bits";

export function BoxQueue(props: {
  ws: Workspace;
  r: EpisodeResult;
  remaining: number;
  onNext: () => void;
}) {
  const ep = props.r.episode;
  const [view, setView] = useState<"ext1" | "ext2">("ext1");
  const [rect, setRect] = useState<Rect | null>(null);
  const save = () => {
    if (!rect) return;
    props.ws.setBox(ep.id, view, rect);
    setRect(null);
    props.onNext();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest("input, textarea")) return;
      if (e.key === "Enter") save();
      if (e.key === "1") setView("ext1");
      if (e.key === "2") setView("ext2");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const src = ep.frames[view];
  return (
    <div className="mx-auto grid max-w-4xl gap-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-base font-semibold">
          Box the object · Episode {ep.index}{" "}
          <span className="text-xs font-normal text-muted-foreground">{ep.source}</span>
        </h2>
        <span className="ml-auto text-xs text-muted-foreground">{props.remaining} unboxed</span>
      </div>
      <p className="text-sm">“{ep.instruction}”</p>
      <div className="grid grid-cols-[minmax(0,1fr)_180px] gap-3">
        {src ? (
          <BoxCanvas key={`${ep.id}-${view}`} src={src} rect={rect} onDraw={setRect} />
        ) : (
          <div className="grid aspect-video place-items-center rounded bg-black text-white/60">
            No frame
          </div>
        )}
        <div className="grid content-start gap-2">
          <span className="text-[11px] text-muted-foreground">
            View · pick where the object looks biggest
          </span>
          {(["ext1", "ext2"] as const).map((v, i) => (
            <button
              key={v}
              onClick={() => {
                setView(v);
                setRect(null);
              }}
              className={cn(
                "overflow-hidden rounded border-2 text-left",
                view === v ? "border-sky-500" : "border-transparent opacity-70",
              )}
            >
              {ep.frames[v] && <img src={ep.frames[v]} alt="" className="aspect-video w-full" />}
              <span className="block px-1 text-[11px]">
                {i + 1} · Exterior {i + 1}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={!rect} onClick={save}>
          Save &amp; next ↵
        </Button>
        <Button size="sm" variant="ghost" onClick={props.onNext}>
          Skip
        </Button>
        <span className="text-xs text-muted-foreground">
          {rect ? `box ${rect.join(", ")} on ${view}` : "Drag a box around the object on frame 0"}
        </span>
      </div>
      <p className="rounded bg-muted/50 p-2 text-xs text-muted-foreground">
        Boxes belong to the Dataset, not this Project: every Project on “DROID pick-and-place”
        reuses them. Saving starts the exterior SAM track (≈ $0.02); until then placement Criteria
        are unsure, so the Episode stays in Needs review.
      </p>
    </div>
  );
}
