// PROTOTYPE (throwaway): Variant C, "Rubric matrix". The Project home is a Phrase × Episode grid:
// labels are keyed (Episode, Phrase), so the cells ARE what people label. The Description is the
// header row, the interview docks underneath and lights up the cell it asks about, and Needs
// review happens in the grid.
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

import type { Workspace } from "../fixture/useWorkspace";
import { CriterionStrip } from "./CriterionStrip";
import { InterviewBar, interviewCell } from "./InterviewBar";
import { Matrix } from "./Matrix";
import { auditSample, visibleRows, type Filter, type Mode, type SortKey } from "./model";
import { BoxDialog, EpisodeSheet } from "./Overlays";
import { Report } from "./Report";
import { TopBar } from "./TopBar";

export const name = "Rubric matrix";

export function VariantC(props: { ws: Workspace }) {
  const { ws } = props;
  const [mode, setMode] = useState<Mode>("describe");
  const [view, setView] = useState<"matrix" | "report">("matrix");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("confidence");
  const [question, setQuestion] = useState(() => {
    const i = ws.interview.findIndex((t) => !t.answered);
    return i >= 0 ? i : 0;
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const [boxId, setBoxId] = useState<string | null>(null);

  const audit = useMemo(() => auditSample(ws.results), [ws.results]);
  const rows = visibleRows(ws, mode, filter, sort, audit);
  const highlight = mode === "describe" ? interviewCell(ws.interview[question]) : null;

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TopBar ws={ws} mode={mode} setMode={setMode} view={view} setView={setView} />
      {view === "report" ? (
        <div className="flex-1 overflow-auto">
          <Report ws={ws} />
        </div>
      ) : (
        <>
          <DescriptionLine
            ws={ws}
            expanded={expanded}
            onExpand={(id) => setExpanded(expanded === id ? null : id)}
          />
          {expanded && (
            <CriterionStrip ws={ws} phraseId={expanded} onClose={() => setExpanded(null)} />
          )}
          {mode === "results" && (
            <FilterBar
              ws={ws}
              filter={filter}
              setFilter={setFilter}
              sort={sort}
              setSort={setSort}
              audit={audit}
            />
          )}
          <div key={`${mode}-${filter}`} className="min-h-0 flex-1 overflow-auto">
            <Matrix
              ws={ws}
              rows={rows}
              mode={mode}
              expanded={expanded}
              onExpand={(id) => setExpanded(expanded === id ? null : id)}
              highlight={highlight}
              onOpen={setOpenId}
              onDrawBox={setBoxId}
              auditing={mode === "results" && filter === "audit"}
            />
          </div>
          {mode === "describe" && <InterviewBar ws={ws} index={question} setIndex={setQuestion} />}
        </>
      )}
      <EpisodeSheet
        result={openId ? (ws.resultById.get(openId) ?? null) : null}
        onClose={() => setOpenId(null)}
      />
      <BoxDialog
        ws={ws}
        episodeId={boxId}
        queue={rows.map((r) => r.episode.id)}
        onMove={setBoxId}
      />
    </div>
  );
}

function DescriptionLine(props: {
  ws: Workspace;
  expanded: string | null;
  onExpand: (id: string) => void;
}) {
  const { description, phrases } = props.ws.rubric;
  const parts: { text: string; phraseId?: string }[] = [];
  let rest = description;
  for (const p of phrases) {
    const i = rest.indexOf(p.text);
    if (i < 0) continue;
    if (i > 0) parts.push({ text: rest.slice(0, i) });
    parts.push({ text: p.text, phraseId: p.id });
    rest = rest.slice(i + p.text.length);
  }
  if (rest) parts.push({ text: rest });
  return (
    <div className="border-b px-4 py-2 text-[15px] leading-relaxed">
      <span className="mr-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        Description
      </span>
      {parts.map((part, i) => {
        const phrase = phrases.find((p) => p.id === part.phraseId);
        if (!phrase) return <span key={i}>{part.text}</span>;
        if (phrase.status === "Context")
          return (
            <span key={i} className="text-muted-foreground" title={`Context: ${phrase.note ?? ""}`}>
              {part.text}
            </span>
          );
        return (
          <button
            key={i}
            onClick={() => props.onExpand(phrase.id)}
            className={cn(
              "rounded px-0.5 underline decoration-dotted underline-offset-4 hover:bg-muted",
              props.expanded === phrase.id && "bg-blue-100 decoration-solid dark:bg-blue-950",
              phrase.status === "Unsupported" && "line-through",
            )}
          >
            {part.text}
          </button>
        );
      })}
    </div>
  );
}

function FilterBar(props: {
  ws: Workspace;
  filter: Filter;
  setFilter: (f: Filter) => void;
  sort: SortKey;
  setSort: (s: SortKey) => void;
  audit: Set<string>;
}) {
  const chips: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "Needs review", label: "Needs review" },
    { key: "Reject", label: "Reject" },
    { key: "Keep", label: "Keep" },
    { key: "spark", label: "Spark disagrees" },
    { key: "unboxed", label: "Unboxed" },
    { key: "audit", label: `Audit sample (${props.audit.size})` },
  ];
  return (
    <div className="flex items-center gap-1.5 border-b px-4 py-1.5 text-xs">
      {chips.map((c) => (
        <button
          key={c.key}
          onClick={() => props.setFilter(c.key)}
          className={cn(
            "rounded-full border px-2.5 py-0.5",
            props.filter === c.key
              ? "border-foreground bg-foreground text-background"
              : "text-muted-foreground",
          )}
        >
          {c.label}
        </button>
      ))}
      <span className="ml-auto text-muted-foreground">Sort</span>
      {(["confidence", "episode"] as SortKey[]).map((s) => (
        <button
          key={s}
          onClick={() => props.setSort(s)}
          className={cn(
            "rounded px-2 py-0.5",
            props.sort === s ? "bg-muted font-medium" : "text-muted-foreground",
          )}
        >
          {s === "confidence" ? "least confident first" : "Episode"}
        </button>
      ))}
    </div>
  );
}
