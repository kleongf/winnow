// PROTOTYPE (throwaway): Variant A "Prepare": Dataset-level work that no Description depends on.
// Ingest status plus the hand-drawn box queue (one box per Episode on frame 0 of an exterior view).
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import type { Rect } from "../fixture/episodes";
import type { Workspace } from "../fixture/useWorkspace";
import { projects, type Dataset } from "../fixture/workspace";
import { BoxCanvas } from "../shared/bits";

export function PreparePage(props: { ws: Workspace; dataset: Dataset }) {
  const { ws, dataset } = props;
  const missing = ws.results.filter((r) => ws.boxes.get(r.episode.id) === null);
  const [queue, setQueue] = useState<string[] | null>(null);
  const boxes = ws.results.length - missing.length;
  const sharedBy = projects.filter((p) => p.datasetId === dataset.id);
  const rows: [string, number][] = [
    ["Clips (H.264 + 5 fps)", dataset.ingest.clips],
    ["Wrist tracks (auto-seeded)", dataset.ingest.wristTracks],
    ["Hand-drawn boxes", boxes],
    ["Exterior tracks", Math.max(0, boxes - 1)],
  ];
  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="text-xs text-muted-foreground">Dataset</div>
      <h1 className="text-xl font-semibold">{dataset.name} · Prepare</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Everything here belongs to the Dataset, not a Project: clips, tracks and hand-drawn boxes
        are shared by {sharedBy.map((p) => p.name).join(" and ") || "every Project"}. Nothing here
        depends on a Description.
      </p>
      <div className="mt-6 grid grid-cols-4 gap-3">
        {rows.map(([label, n]) => (
          <div key={label} className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {n}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                of {ws.results.length}
              </span>
            </div>
            <Progress value={(n / ws.results.length) * 100} className="mt-2 h-1" />
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Ingest cost so far ${dataset.costUsd.toFixed(2)} · exterior tracks start when an Episode
        gets its box. Without a box, placement Criteria come back unsure (Needs review); nothing
        blocks.
      </p>
      <div className="mt-8 flex items-baseline gap-3">
        <h2 className="text-base font-semibold">Needs a box</h2>
        <Badge variant="secondary">{missing.length} Episodes</Badge>
        <Button
          size="sm"
          className="ml-auto"
          disabled={missing.length === 0}
          onClick={() => {
            setQueue(missing.map((r) => r.episode.id));
          }}
        >
          Draw boxes ({missing.length})
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Drag a box around the task object on frame 0, in the exterior view where it looks biggest.
      </p>
      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
        {missing.map((r) => (
          <button
            key={r.episode.id}
            type="button"
            className="group text-left"
            onClick={() => {
              const ids = missing.map((m) => m.episode.id);
              setQueue([
                ...ids.slice(ids.indexOf(r.episode.id)),
                ...ids.slice(0, ids.indexOf(r.episode.id)),
              ]);
            }}
          >
            <img
              src={r.episode.frames.ext1 ?? ""}
              alt=""
              className="aspect-video w-full rounded border object-cover group-hover:ring-2 group-hover:ring-sky-400"
            />
            <div className="mt-1 text-xs font-medium">Episode {r.episode.index}</div>
            <div className="truncate text-xs text-muted-foreground">{r.episode.instruction}</div>
          </button>
        ))}
        {missing.length === 0 && (
          <p className="text-sm text-muted-foreground">Every Episode has its box.</p>
        )}
      </div>
      {queue && (
        <BoxDialog
          ws={ws}
          queue={queue}
          onClose={() => {
            setQueue(null);
          }}
        />
      )}
    </div>
  );
}

function BoxDialog(props: { ws: Workspace; queue: string[]; onClose: () => void }) {
  const { ws, queue } = props;
  const [i, setI] = useState(0);
  const [view, setView] = useState<"ext1" | "ext2">("ext1");
  const [rect, setRect] = useState<Rect | null>(null);
  const id = queue[i];
  const ep = id ? ws.resultById.get(id)?.episode : undefined;

  const next = (save: boolean) => {
    if (save && id && rect) ws.setBox(id, view, rect);
    setRect(null);
    if (i + 1 >= queue.length) props.onClose();
    else setI(i + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && rect) next(true);
      if (e.key === "1") setView("ext1");
      if (e.key === "2") setView("ext2");
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  });

  if (!ep) return null;
  const src = ep.frames[view] ?? "";
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) props.onClose();
      }}
    >
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            Episode {ep.index} · box {i + 1} of {queue.length}
          </DialogTitle>
          <DialogDescription>“{ep.instruction}”: box the object being moved.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={view}
            onValueChange={(v) => {
              if (v === "ext1" || v === "ext2") {
                setView(v);
                setRect(null);
              }
            }}
          >
            <ToggleGroupItem value="ext1">Exterior 1 (1)</ToggleGroupItem>
            <ToggleGroupItem value="ext2">Exterior 2 (2)</ToggleGroupItem>
          </ToggleGroup>
          <span className="text-xs text-muted-foreground">
            {rect ? `box ${rect.join(", ")} px` : "drag on the frame"}
          </span>
        </div>
        <BoxCanvas key={`${ep.id}-${view}`} src={src} rect={rect} onDraw={setRect} />
        <div className="flex items-center gap-2">
          <Progress value={(i / queue.length) * 100} className="h-1 flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              next(false);
            }}
          >
            Skip
          </Button>
          <Button
            size="sm"
            disabled={!rect}
            onClick={() => {
              next(true);
            }}
          >
            Save & next ⏎
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
