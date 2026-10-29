// PROTOTYPE (throwaway): Variant C overlays: the Workstation in a wide sheet, and the box dialog
// that jumps to the next unboxed Episode after each save.
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import type { Rect } from "../fixture/episodes";
import type { EpisodeResult } from "../fixture/evaluate";
import type { Workspace } from "../fixture/useWorkspace";
import { datasets, projects } from "../fixture/workspace";
import { BoxCanvas } from "../shared/bits";
import { Workstation } from "../shared/Workstation";
import { sparkDisagrees } from "./model";

export function EpisodeSheet(props: { result: EpisodeResult | null; onClose: () => void }) {
  const r = props.result;
  return (
    <Sheet open={r !== null} onOpenChange={(o) => !o && props.onClose()}>
      <SheetContent side="right" className="w-[74vw]! max-w-none! overflow-y-auto">
        {r && (
          <>
            <SheetHeader className="pb-0">
              <SheetTitle>
                Episode {r.episode.index}{" "}
                <span className="font-normal text-muted-foreground">· {r.episode.source}</span>
              </SheetTitle>
              <SheetDescription>“{r.episode.instruction}”</SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6">
              <Workstation key={r.episode.id} result={r} footer={<SparkContrast r={r} />} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SparkContrast(props: { r: EpisodeResult }) {
  const s = props.r.episode.spark;
  const differs = sparkDisagrees(props.r);
  return (
    <div className="mt-4 rounded-md border border-dashed p-3 text-sm">
      <div className="flex items-center gap-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        Spark alone (baseline)
        {differs && (
          <span className="rounded bg-blue-600 px-1 text-[10px] text-white normal-case">
            disagrees
          </span>
        )}
      </div>
      <div className="mt-1">
        <b>{s.decision}</b> · {s.agree} of 3 samples agree
        {s.t !== null && <span className="text-muted-foreground"> · at {s.t.toFixed(1)} s</span>}
      </div>
      <p className="mt-1 text-muted-foreground">“{s.reason}”</p>
    </div>
  );
}

export function BoxDialog(props: {
  ws: Workspace;
  episodeId: string | null;
  queue: string[];
  onMove: (episodeId: string | null) => void;
}) {
  const { ws, episodeId, queue } = props;
  const r = episodeId ? ws.resultById.get(episodeId) : undefined;
  const [view, setView] = useState<"ext1" | "ext2">("ext1");
  const [rect, setRect] = useState<Rect | null>(null);
  const dataset = datasets.find(
    (d) => d.id === projects.find((p) => p.id === ws.projectId)?.datasetId,
  );
  const remaining = queue.filter((id) => id !== episodeId && !ws.boxes.get(id)).length;

  const next = () => {
    const after = queue.slice(queue.indexOf(episodeId ?? "") + 1).concat(queue);
    const id = after.find((x) => x !== episodeId && !ws.boxes.get(x)) ?? null;
    setRect(null);
    props.onMove(id);
  };

  return (
    <Dialog open={!!r} onOpenChange={(o) => !o && props.onMove(null)}>
      <DialogContent className="max-w-3xl! sm:max-w-3xl!">
        {r && (
          <>
            <DialogHeader>
              <DialogTitle>Box the object · Episode {r.episode.index}</DialogTitle>
              <DialogDescription>
                “{r.episode.instruction}”. Drag a box around the task object on frame 0, in the view
                where it looks biggest. Boxes belong to the Dataset <b>{dataset?.name}</b> and are
                shared by all its Projects.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-1">
              {(["ext1", "ext2"] as const).map((v) => (
                <Button
                  key={v}
                  size="sm"
                  variant={v === view ? "secondary" : "ghost"}
                  onClick={() => {
                    setView(v);
                    setRect(null);
                  }}
                >
                  {v === "ext1" ? "Exterior 1" : "Exterior 2"}
                </Button>
              ))}
            </div>
            {r.episode.frames[view] && (
              <BoxCanvas
                key={`${r.episode.id}-${view}`}
                src={r.episode.frames[view]}
                rect={rect ?? (r.episode.box?.view === view ? r.episode.box.rect : null)}
                onDraw={setRect}
              />
            )}
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                {rect ? `[${rect.join(", ")}]` : "no box yet"} · {remaining} more unboxed in this
                view
              </span>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={next}>
                Skip
              </Button>
              <Button
                size="sm"
                disabled={!rect}
                onClick={() => {
                  if (rect) ws.setBox(r.episode.id, view, rect);
                  next();
                }}
              >
                Save &amp; next ⏎
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
