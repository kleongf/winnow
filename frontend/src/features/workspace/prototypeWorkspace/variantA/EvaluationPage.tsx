// PROTOTYPE (throwaway): Variant A "Evaluation": the only place the Spark-alone contrast appears in
// this variant. Report tables use INVENTED placeholder numbers; the disagreement list is live.
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import type { EpisodeResult } from "../fixture/evaluate";
import type { Workspace } from "../fixture/useWorkspace";
import { evaluationReport as report } from "../fixture/workspace";
import { TriageBadge } from "../shared/bits";
import { phraseShort } from "./util";

function Placeholder() {
  return (
    <Badge variant="outline" className="border-dashed text-[10px] text-muted-foreground">
      placeholder numbers, not results
    </Badge>
  );
}

/** Different Triage decision, or both Reject but Spark alone blames a Phrase Winnow passed. */
function disagrees(r: EpisodeResult): "decision" | "reason" | null {
  if (r.triage === "Needs review") return null;
  const spark = r.episode.spark;
  if (spark.decision !== r.triage) return "decision";
  const failing = r.phrases.filter((p) => p.status === "fail").map((p) => p.phraseId);
  if (spark.failurePhrase && !failing.includes(spark.failurePhrase)) return "reason";
  return null;
}

export function EvaluationPage(props: {
  ws: Workspace;
  onOpen: (id: string, list: string[]) => void;
}) {
  const { ws } = props;
  const rows = ws.results.filter((r) => disagrees(r) !== null);
  const ids = rows.map((r) => r.episode.id);
  return (
    <div className="max-w-6xl px-8 py-6">
      <h1 className="text-xl font-semibold">Evaluation</h1>
      <p className="text-sm text-muted-foreground">
        Rubric v{report.rubricVersion} on the frozen Test set: {report.testSet} Episodes,{" "}
        {report.descriptionFailures} Description failures by Reference label. Scored against
        Reference labels, never the Dataset outcome.
      </p>
      <div className="mt-6 flex items-center gap-2">
        <h2 className="text-sm font-semibold">Winnow vs baselines</h2>
        <Placeholder />
      </div>
      <Table className="mt-2 text-[13px]">
        <TableHeader>
          <TableRow>
            <TableHead>System</TableHead>
            <TableHead>False keeps on true failures</TableHead>
            <TableHead>95% CI</TableHead>
            <TableHead>Right reason</TableHead>
            <TableHead>Decided automatically</TableHead>
            <TableHead>False rejects</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {report.rows.map((r) => (
            <TableRow
              key={r.system}
              className={cn(r.system === "Spark alone" && "bg-violet-50/60 dark:bg-violet-950/30")}
            >
              <TableCell className="font-medium">{r.system}</TableCell>
              <TableCell className="tabular-nums">{r.falseKeeps}</TableCell>
              <TableCell className="text-muted-foreground tabular-nums">{r.falseKeepsCI}</TableCell>
              <TableCell className="tabular-nums">{r.rightReason}</TableCell>
              <TableCell className="tabular-nums">{r.coverage}</TableCell>
              <TableCell className="tabular-nums">{r.falseRejects}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="mt-8 flex items-center gap-2">
        <h2 className="text-sm font-semibold">Source ablation ($0, re-scored from cache)</h2>
        <Placeholder />
      </div>
      <Table className="mt-2 max-w-3xl text-[13px]">
        <TableHeader>
          <TableRow>
            <TableHead>Sources</TableHead>
            <TableHead>False keeps</TableHead>
            <TableHead>Right reason</TableHead>
            <TableHead>Decided automatically</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {report.ablation.map((r) => (
            <TableRow key={r.sources}>
              <TableCell>{r.sources}</TableCell>
              <TableCell className="tabular-nums">{r.falseKeeps}</TableCell>
              <TableCell className="tabular-nums">{r.rightReason}</TableCell>
              <TableCell className="tabular-nums">{r.coverage}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <h2 className="mt-8 text-sm font-semibold">
        Where Spark alone and Winnow disagree{" "}
        <span className="font-normal text-muted-foreground">
          · {rows.length} of {ws.results.length} decided Episodes (live)
        </span>
      </h2>
      <div className="mt-2 divide-y rounded-lg border">
        {rows.map((r) => (
          <button
            key={r.episode.id}
            type="button"
            onClick={() => {
              props.onOpen(r.episode.id, ids);
            }}
            className="grid w-full grid-cols-[110px_1fr_1fr] gap-4 p-3 text-left text-sm hover:bg-muted/40"
          >
            <div>
              <div className="font-medium">Episode {r.episode.index}</div>
              <div className="text-xs text-muted-foreground">
                {r.episode.split === "dev" ? "Dev set" : "Test set"}
              </div>
              <div className="mt-1 text-[11px] text-violet-700">
                {disagrees(r) === "reason"
                  ? "same decision, different reason"
                  : "different decision"}
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                Winnow <TriageBadge triage={r.triage} />
              </div>
              <div className="text-xs">{r.reason}</div>
            </div>
            <div>
              <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                Spark alone <TriageBadge triage={r.episode.spark.decision} />
                <span>
                  {r.episode.spark.agree}/3 agree
                  {r.episode.spark.failurePhrase &&
                    ` · ${phraseShort[r.episode.spark.failurePhrase] ?? ""}`}
                </span>
              </div>
              <div className="text-xs">{r.episode.spark.reason}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
