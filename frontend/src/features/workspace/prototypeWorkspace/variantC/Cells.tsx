// PROTOTYPE (throwaway): Variant C matrix cells. A Phrase cell IS an (Episode, Phrase) label slot:
// clicking it opens a Pass / Fail popover that writes a review label straight into the cell.
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { EpisodeResult, PhraseResult } from "../fixture/evaluate";
import type { Workspace } from "../fixture/useWorkspace";
import { cellId, cellText, decidingResult, sparkDisagrees } from "./model";

const cellTone = {
  pass: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  fail: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  unsure: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
};

export function PhraseCell(props: {
  ws: Workspace;
  r: EpisodeResult;
  p: PhraseResult;
  highlighted: boolean;
  onOpen: () => void;
}) {
  const { ws, r, p, highlighted } = props;
  const phrase = ws.rubric.phrases.find((x) => x.id === p.phraseId);
  const d = decidingResult(r, p.phraseId);
  return (
    <td
      id={cellId(r.episode.id, p.phraseId)}
      className={cn(
        "relative border-r border-b p-0",
        highlighted && "z-10 ring-2 ring-blue-600 ring-inset",
      )}
    >
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "flex h-7 w-full items-center gap-1 truncate px-1.5 text-left font-mono text-[11px]",
              cellTone[p.status],
              highlighted && "animate-pulse outline-2 -outline-offset-2 outline-blue-600",
            )}
            title={p.signals.join("; ") || d?.evidence}
          >
            <span className="font-sans font-semibold uppercase">{p.status[0]}</span>
            <span className="truncate">{cellText(r, p)}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 text-sm" align="start">
          <div className="text-xs text-muted-foreground">
            {r.episode.source} · Episode {r.episode.index}
          </div>
          <div className="mt-0.5 font-medium">“{phrase?.text}”</div>
          <div className="mt-2 space-y-1 font-mono text-[11px]">
            {r.results
              .filter((c) => c.criterion.phraseId === p.phraseId)
              .map((c) => (
                <div key={c.criterion.id} className="flex gap-2">
                  <span className="w-12 uppercase">{c.status}</span>
                  <span className="flex-1 truncate">{c.criterion.primitive}</span>
                  <span>{c.measurement}</span>
                </div>
              ))}
          </div>
          {p.signals.length > 0 && (
            <div className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">
              Uncertainty signal: {p.signals.join("; ")}
            </div>
          )}
          {p.labelled ? (
            <div className="mt-3 flex items-center gap-2 text-xs">
              Labelled <b>{p.labelled.value}</b> ({p.labelled.source})
              <Button
                size="xs"
                variant="outline"
                className="ml-auto"
                onClick={() => ws.removeLabel(r.episode.id, p.phraseId)}
              >
                Undo label
              </Button>
            </div>
          ) : (
            <div className="mt-3">
              <div className="mb-1.5 text-xs text-muted-foreground">
                {p.status === "unsure" ? "Needs review: does" : "Override: does"} Episode{" "}
                {r.episode.index} meet this Phrase?
              </div>
              <div className="flex gap-2">
                {(["pass", "fail"] as const).map((v) => (
                  <Button
                    key={v}
                    size="sm"
                    variant={v === "pass" ? "outline" : "destructive"}
                    onClick={() =>
                      ws.addLabel({
                        episodeId: r.episode.id,
                        phraseId: p.phraseId,
                        value: v,
                        source: "review",
                      })
                    }
                  >
                    {v === "pass" ? "Pass" : "Fail"} this Phrase
                  </Button>
                ))}
              </div>
            </div>
          )}
          <Button size="xs" variant="link" className="mt-2 px-0" onClick={props.onOpen}>
            Open Episode {r.episode.index} in the Workstation →
          </Button>
        </PopoverContent>
      </Popover>
      {p.labelled && (
        <span
          className="pointer-events-none absolute top-0 right-0 bg-blue-600 px-[3px] text-[9px] leading-[11px] font-bold text-white"
          title={`${p.labelled.source} label`}
        >
          {p.labelled.source[0]!.toUpperCase()}
        </span>
      )}
    </td>
  );
}

export function SparkCell(props: { r: EpisodeResult }) {
  const s = props.r.episode.spark;
  const differs = sparkDisagrees(props.r);
  return (
    <td className="border-r border-b px-1.5 font-mono text-[11px]" title={s.reason}>
      <span className={s.decision === "Keep" ? "text-emerald-700" : "text-orange-700"}>
        {s.decision}
      </span>
      <span className="text-muted-foreground"> {s.agree}/3</span>
      {differs && (
        <span className="ml-1 rounded bg-blue-600 px-1 font-sans text-[10px] font-bold text-white">
          ≠
        </span>
      )}
    </td>
  );
}

export function BoxCell(props: { r: EpisodeResult; onDraw: () => void }) {
  const b = props.r.episode.box;
  return (
    <td className="border-b px-1 text-[11px]">
      <button
        onClick={props.onDraw}
        className={cn(
          "h-6 w-full rounded px-1 text-left font-mono",
          b
            ? "text-muted-foreground hover:bg-muted"
            : "border border-dashed border-blue-500 text-blue-700 hover:bg-blue-50",
        )}
      >
        {b ? `${b.view} ✓` : "draw"}
      </button>
    </td>
  );
}
