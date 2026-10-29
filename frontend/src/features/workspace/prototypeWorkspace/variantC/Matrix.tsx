// PROTOTYPE (throwaway): Variant C Phrase × Episode matrix. Columns are the Description's Phrases;
// rows are Episodes; each cell is the (Episode, Phrase) result a human can label in place.
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { EpisodeResult } from "../fixture/evaluate";
import type { Workspace } from "../fixture/useWorkspace";
import { TriageBadge } from "../shared/bits";
import { BoxCell, PhraseCell, SparkCell } from "./Cells";
import { cellId, type Mode } from "./model";

export interface Highlight {
  episodeId: string;
  phraseId: string;
}

export function Matrix(props: {
  ws: Workspace;
  rows: EpisodeResult[];
  mode: Mode;
  expanded: string | null;
  onExpand: (phraseId: string) => void;
  highlight: Highlight | null;
  onOpen: (episodeId: string) => void;
  onDrawBox: (episodeId: string) => void;
  auditing: boolean;
}) {
  const { ws, rows, mode, highlight } = props;
  const checked = ws.rubric.phrases.filter((p) => p.status === "Checked");

  useEffect(() => {
    if (!highlight) return;
    document
      .getElementById(cellId(highlight.episodeId, highlight.phraseId))
      ?.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  }, [highlight]);

  return (
    <table className="w-full border-separate border-spacing-0 text-xs">
      <thead className="sticky top-0 z-20 bg-background">
        <tr className="align-bottom">
          <th className="sticky left-0 z-30 w-64 border-r border-b bg-background px-2 py-1.5 text-left font-medium">
            Episode
            <span className="ml-1 font-normal text-muted-foreground">
              ({rows.length}
              {mode === "describe" ? " in anchor pool" : ""})
            </span>
          </th>
          <th className="w-32 border-r border-b px-1.5 py-1.5 text-left font-medium">
            Triage decision
          </th>
          <th className="w-24 border-r border-b px-1.5 py-1.5 text-left font-medium">
            Spark alone
          </th>
          {checked.map((p) => {
            const col = rows.map((r) => r.phrases.find((x) => x.phraseId === p.id)?.status);
            const fail = col.filter((s) => s === "fail").length;
            const unsure = col.filter((s) => s === "unsure").length;
            const assumed = ws.rubric.criteria.some(
              (c) => c.phraseId === p.id && c.assumptions.length > 0,
            );
            return (
              <th key={p.id} className="min-w-40 border-r border-b p-0 text-left font-normal">
                <button
                  onClick={() => props.onExpand(p.id)}
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 px-1.5 py-1.5 hover:bg-muted",
                    props.expanded === p.id && "bg-muted",
                  )}
                >
                  <span className="text-left leading-tight font-medium">
                    {p.text}
                    {assumed && (
                      <span
                        className="ml-1 inline-block size-2 rounded-full bg-amber-500"
                        title="Unconfirmed assumption"
                      />
                    )}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {p.status} · {fail} fail · {unsure} unsure
                  </span>
                </button>
              </th>
            );
          })}
          <th
            className="w-16 border-b px-1.5 py-1.5 text-left font-medium"
            title="Hand-drawn boxes belong to the Dataset"
          >
            Box
          </th>
          {props.auditing && (
            <th className="w-40 border-b border-l px-1.5 text-left font-medium">Audit</th>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.episode.id} className="h-7">
            <td className="sticky left-0 z-10 border-r border-b bg-background p-0">
              <button
                onClick={() => props.onOpen(r.episode.id)}
                className="flex h-7 w-64 items-center gap-1.5 px-2 text-left hover:bg-muted"
                title={r.episode.instruction}
              >
                <span className="w-14 shrink-0 font-mono">
                  {r.episode.source === "droid_100" ? "" : "1.0.1/"}
                  {r.episode.index}
                </span>
                {mode === "results" && ws.heldOutIds.has(r.episode.id) && (
                  <span
                    className="rounded bg-muted px-1 text-[9px] text-muted-foreground"
                    title="Test set: held out"
                  >
                    T
                  </span>
                )}
                <span className="truncate text-muted-foreground">{r.episode.instruction}</span>
              </button>
            </td>
            <td className="border-r border-b px-1.5" title={r.reason}>
              <TriageBadge triage={r.triage} className="text-[10px]" />
              <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">
                {r.confidence.toFixed(2)}
              </span>
            </td>
            <SparkCell r={r} />
            {r.phrases.map((p) => (
              <PhraseCell
                key={p.phraseId}
                ws={ws}
                r={r}
                p={p}
                highlighted={
                  highlight?.episodeId === r.episode.id && highlight.phraseId === p.phraseId
                }
                onOpen={() => props.onOpen(r.episode.id)}
              />
            ))}
            <BoxCell r={r} onDraw={() => props.onDrawBox(r.episode.id)} />
            {props.auditing && <AuditCell ws={ws} r={r} />}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AuditCell(props: { ws: Workspace; r: EpisodeResult }) {
  const { ws, r } = props;
  const audit = r.phrases.filter((p) => p.labelled?.source === "audit");
  if (audit.length > 0) {
    const bad = audit.find((p) => p.labelled?.value === "fail");
    return (
      <td className="border-b border-l px-1.5 text-[11px]">
        {bad ? `bad: ${bad.phraseId}` : "good"}
        <button
          className="ml-2 text-muted-foreground underline"
          onClick={() => {
            for (const p of audit) ws.removeLabel(r.episode.id, p.phraseId);
          }}
        >
          undo
        </button>
      </td>
    );
  }
  return (
    <td className="border-b border-l px-1">
      <div className="flex gap-1">
        <Button
          size="xs"
          variant="outline"
          onClick={() => {
            for (const p of r.phrases)
              ws.addLabel({
                episodeId: r.episode.id,
                phraseId: p.phraseId,
                value: "pass",
                source: "audit",
              });
          }}
        >
          Good
        </Button>
        <select
          className="h-6 w-36 rounded border bg-background px-1 text-[11px]"
          value=""
          onChange={(e) =>
            ws.addLabel({
              episodeId: r.episode.id,
              phraseId: e.target.value,
              value: "fail",
              source: "audit",
            })
          }
        >
          <option value="" disabled>
            Bad: which Phrase?
          </option>
          {r.phrases.map((p) => (
            <option key={p.phraseId} value={p.phraseId}>
              {ws.rubric.phrases.find((x) => x.id === p.phraseId)?.text}
            </option>
          ))}
        </select>
      </div>
    </td>
  );
}
