// Prepare: Dataset-level work that no Description depends on. Ingest status for now; the
// hand-drawn boxes, tracks and baseline fill in the later rows as they're built.
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { Progress } from "@/components/ui/progress";

import { IngestForm } from "../episodes/IngestForm";
import { JobProgress } from "../jobs/JobProgress";
import { useLatestJob } from "../jobs/useLatestJob";
import { datasetStatusKey, useDatasetStatus } from "./useDatasetStatus";

const LATER_STAGES = [
  "Wrist tracks",
  "Hand-drawn boxes",
  "Exterior tracks",
  "Target boxes",
  "Spark-alone baseline",
];

export function PreparePage() {
  const status = useDatasetStatus();
  const job = useLatestJob("ingest");
  const queryClient = useQueryClient();
  const settled = job.data ? job.data.done + job.data.failed : 0;

  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: datasetStatusKey }); // counts move as items land
  }, [settled, queryClient]);

  const episodes = status.data?.episodes ?? 0;
  const running = job.data ? !job.data.finished : false;
  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="text-xs text-muted-foreground">Dataset</div>
      <h1 className="text-xl font-semibold">{status.data?.name ?? "Dataset"} · Prepare</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Everything here belongs to the Dataset, not a Project: clips, tracks and hand-drawn boxes.
        Nothing here depends on a Description.
      </p>
      <div className="mt-6 grid grid-cols-3 gap-3">
        <Stat label="Episodes ingested" testId="episodes-ingested">
          {episodes}
        </Stat>
        <Stat label="Clips (H.264 + 5 fps)" of={episodes}>
          {episodes}
        </Stat>
        {LATER_STAGES.map((label) => (
          <Stat key={label} label={label} muted>
            —
          </Stat>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Meta API spend so far ${(status.data?.cost_usd ?? 0).toFixed(2)}
      </p>
      <div className="mt-8 grid grid-cols-2 gap-4">
        <IngestForm disabled={running} />
        {job.data && <JobProgress job={job.data} />}
      </div>
    </div>
  );
}

function Stat(props: {
  label: string;
  children: number | string;
  of?: number;
  muted?: boolean;
  testId?: string;
}) {
  const value = typeof props.children === "number" ? props.children : null;
  return (
    <div className="rounded-lg border p-3" data-testid={props.testId}>
      <div className="text-xs text-muted-foreground">{props.label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">
        <span className={props.muted ? "text-muted-foreground" : undefined}>{props.children}</span>
        {props.of !== undefined && (
          <span className="text-sm font-normal text-muted-foreground"> of {props.of}</span>
        )}
      </div>
      {props.muted && <div className="text-[11px] text-muted-foreground">not built yet</div>}
      {props.of !== undefined && value !== null && (
        <Progress value={props.of ? (value / props.of) * 100 : 0} className="mt-2 h-1" />
      )}
    </div>
  );
}
