// The Episodes table: one dense row per Episode with its Triage decision, confidence, chips for
// the Phrases that didn't pass, and its Reason, or, until it has a Reference label, "Awaiting
// Reference label". The confidence header sorts.
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { AwaitingLabelTag } from "../referenceLabels/AwaitingLabel";
import { SetTag } from "../sets/SetTag";
import type { SetName } from "../sets/useSets";
import { STATUS_CHIP, TriageBadge } from "../triage/TriageBadge";
import type { TriageRow } from "../triage/useTriage";
import type { SortOrder } from "./episodeFilters";
import type { Episode } from "./useEpisodes";

const SORT_ICONS = { confidence: ArrowUp, "-confidence": ArrowDown } as const;
const SORT_NAMES = {
  confidence: "least confident first",
  "-confidence": "most confident first",
} as const;

function ConfidenceHead(props: { sort: SortOrder; onSort: () => void }) {
  const Icon = props.sort === null ? ArrowUpDown : SORT_ICONS[props.sort];
  return (
    <TableHead
      className="w-24 text-right"
      aria-sort={
        props.sort === null ? "none" : props.sort === "confidence" ? "ascending" : "descending"
      }
    >
      <button
        type="button"
        onClick={props.onSort}
        className="inline-flex items-center gap-1 hover:text-foreground"
        title={props.sort === null ? "Sort by confidence" : `Sorted ${SORT_NAMES[props.sort]}`}
      >
        Confidence
        <Icon className="size-3" />
      </button>
    </TableHead>
  );
}

function PhraseChips(props: { row: TriageRow }) {
  if (props.row.not_passed.length === 0) return null;
  return (
    <div className="mb-0.5 flex flex-wrap gap-1">
      {props.row.not_passed.map((p) => (
        <span
          key={p.phrase}
          data-testid="phrase-chip"
          title={`${p.status === "fail" ? "Failed" : "Unsure"}: “${p.phrase}”`}
          className={cn(
            "max-w-44 truncate rounded border px-1.5 py-px text-[11px] leading-4",
            STATUS_CHIP[p.status],
          )}
        >
          {p.phrase}
        </span>
      ))}
    </div>
  );
}

export function EpisodeTable(props: {
  episodes: Episode[];
  triageOf: Map<string, TriageRow>;
  setOf: Map<string, SetName>;
  sort: SortOrder;
  onSort: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <Table className="mt-3">
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">Episode</TableHead>
          <TableHead className="w-56">Instruction</TableHead>
          <TableHead className="w-16 text-right">Length</TableHead>
          <TableHead className="w-24">Source</TableHead>
          <TableHead className="w-20">Set</TableHead>
          <TableHead className="w-28">Triage decision</TableHead>
          <ConfidenceHead sort={props.sort} onSort={props.onSort} />
          <TableHead>Reason</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {props.episodes.map((e) => {
          const row = props.triageOf.get(e.id);
          return (
            <TableRow
              key={e.id}
              className="cursor-pointer"
              onClick={() => {
                props.onOpen(e.id);
              }}
            >
              <TableCell className="font-medium tabular-nums">{e.index}</TableCell>
              <TableCell className="max-w-56 truncate">
                {e.instruction ?? <span className="text-muted-foreground">None recorded</span>}
              </TableCell>
              <TableCell className="text-right tabular-nums">{e.duration_s.toFixed(1)} s</TableCell>
              <TableCell className="text-muted-foreground">{e.source}</TableCell>
              <TableCell>
                <SetTag name={props.setOf.get(e.id)} />
              </TableCell>
              <TableCell>
                {e.reference_labelled ? (
                  row && <TriageBadge decision={row.decision} />
                ) : (
                  <AwaitingLabelTag />
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums" data-testid="confidence">
                {row?.confidence.toFixed(2)}
              </TableCell>
              <TableCell className="w-full max-w-0">
                {row && <PhraseChips row={row} />}
                <div className="truncate" title={row?.reason}>
                  {row?.reason}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
