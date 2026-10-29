// PROTOTYPE (throwaway): Variant B left pane: folders, search, quick filters, Episode rows.
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { EpisodeResult } from "../fixture/evaluate";
import { TriageBadge } from "../shared/bits";
import {
  folders,
  phraseShort,
  signalKinds,
  sparkDisagrees,
  type Filters,
  type FolderId,
} from "./inbox";

export function InboxPane(props: {
  folder: FolderId;
  counts: Record<FolderId, number>;
  onFolder: (f: FolderId) => void;
  filters: Filters;
  onFilters: (f: Filters) => void;
  items: EpisodeResult[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  anchorIds: Set<string>;
}) {
  const { filters, onFilters } = props;
  return (
    <div className="flex min-h-0 flex-col border-r bg-muted/30">
      <nav className="grid gap-px border-b p-2">
        {folders.map((f) => (
          <button
            key={f.id}
            onClick={() => props.onFolder(f.id)}
            className={cn(
              "flex items-baseline gap-2 rounded px-2 py-1 text-left text-sm hover:bg-muted",
              props.folder === f.id && "bg-muted font-medium",
            )}
          >
            <span>{f.label}</span>
            {f.hint && <span className="truncate text-[11px] text-muted-foreground">{f.hint}</span>}
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {props.counts[f.id]}
            </span>
          </button>
        ))}
      </nav>
      <div className="grid gap-1.5 border-b p-2">
        <div className="relative">
          <Search className="absolute top-2 left-2 size-3.5 text-muted-foreground" />
          <Input
            value={filters.query}
            onChange={(e) => onFilters({ ...filters, query: e.target.value })}
            placeholder="Episode or instruction"
            className="h-7 pl-7 text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {Object.entries(phraseShort).map(([id, label]) => (
            <Chip
              key={id}
              active={filters.phraseId === id}
              onClick={() =>
                onFilters({ ...filters, phraseId: filters.phraseId === id ? null : id })
              }
            >
              {label}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {signalKinds.map((s) => (
            <Chip
              key={s}
              amber
              active={filters.signal === s}
              onClick={() => onFilters({ ...filters, signal: filters.signal === s ? null : s })}
            >
              {s}
            </Chip>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {props.items.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">Nothing here.</p>
        )}
        {props.items.map((r) => (
          <Row
            key={r.episode.id}
            r={r}
            selected={r.episode.id === props.selectedId}
            anchor={props.anchorIds.has(r.episode.id)}
            onClick={() => props.onSelect(r.episode.id)}
          />
        ))}
      </div>
      <div className="border-t px-2 py-1 text-[11px] text-muted-foreground">
        j / k to move · {props.items.length} shown
      </div>
    </div>
  );
}

function Chip(props: {
  active: boolean;
  amber?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={props.onClick}
      className={cn(
        "rounded-full border px-1.5 py-px text-[10px] leading-4",
        props.amber ? "border-amber-400/60 text-amber-700" : "text-muted-foreground",
        props.active && (props.amber ? "bg-amber-100" : "bg-foreground text-background"),
      )}
    >
      {props.children}
    </button>
  );
}

function Row(props: { r: EpisodeResult; selected: boolean; anchor: boolean; onClick: () => void }) {
  const { r } = props;
  const ep = r.episode;
  const open = r.phrases.filter((p) => p.status !== "pass");
  return (
    <div
      onClick={props.onClick}
      data-selected={props.selected}
      className={cn(
        "cursor-pointer border-b border-l-2 border-l-transparent px-3 py-2 hover:bg-muted/60",
        props.selected && "border-l-foreground bg-background",
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-semibold tabular-nums">{ep.index}</span>
        <span className="text-[11px] text-muted-foreground">{ep.source}</span>
        {props.anchor && (
          <span className="rounded bg-sky-100 px-1 text-[10px] text-sky-800">anchor</span>
        )}
        {sparkDisagrees(r) && (
          <span title="Spark alone disagrees" className="size-1.5 rounded-full bg-violet-600" />
        )}
        <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
          {r.confidence.toFixed(2)}
        </span>
        <TriageBadge triage={r.triage} className="px-1.5 text-[10px]" />
      </div>
      <div className="truncate text-xs">{ep.instruction}</div>
      <div className="truncate text-[11px] text-muted-foreground">{r.reason}</div>
      {open.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {open.map((p) => (
            <span
              key={p.phraseId}
              className={cn(
                "rounded px-1 text-[10px]",
                p.status === "fail"
                  ? "bg-orange-100 text-orange-800"
                  : "bg-amber-100 text-amber-800",
              )}
            >
              {phraseShort[p.phraseId] ?? p.phraseId} {p.status}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
