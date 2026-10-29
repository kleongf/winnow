// The Episodes table: one dense row per Episode with its Triage decision and Reason, or, until
// it has a Reference label, "Awaiting Reference label".
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { AwaitingLabelTag } from "../referenceLabels/AwaitingLabel";
import { SetTag } from "../sets/SetTag";
import type { SetName } from "../sets/useSets";
import { TriageBadge } from "../triage/TriageBadge";
import type { TriageDecision } from "../triage/useTriage";
import type { Episode } from "./useEpisodes";

export interface TriageRow {
  decision: TriageDecision;
  reason: string;
}

export function EpisodeTable(props: {
  episodes: Episode[];
  triageOf: Map<string, TriageRow>;
  setOf: Map<string, SetName>;
  onOpen: (id: string) => void;
}) {
  return (
    <Table className="mt-3">
      <TableHeader>
        <TableRow>
          <TableHead className="w-20">Episode</TableHead>
          <TableHead className="w-64">Instruction</TableHead>
          <TableHead className="w-20 text-right">Length</TableHead>
          <TableHead className="w-28">Source</TableHead>
          <TableHead className="w-24">Set</TableHead>
          <TableHead className="w-28">Triage decision</TableHead>
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
              <TableCell className="max-w-64 truncate">
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
              <TableCell className="max-w-md truncate" title={row?.reason}>
                {row?.reason}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
