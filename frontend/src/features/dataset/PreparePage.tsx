// Prepare: Dataset-level work that no Description depends on: ingest, hand-drawn boxes, and
// (as they're built) tracks, target boxes and the Spark-alone baseline.
import { Progress } from "@/components/ui/progress";

import { NeedsBox } from "../boxes/NeedsBox";
import { IngestForm } from "../episodes/IngestForm";
import { useEpisodes } from "../episodes/useEpisodes";
import { JobProgress } from "../jobs/JobProgress";
import { useIngestProgress } from "../jobs/useIngestProgress";
import { SetStatus } from "../sets/SetStatus";
import { useDatasetStatus, type DatasetStatus } from "./useDatasetStatus";

const LATER_STAGES = ["Wrist tracks", "Exterior tracks", "Target boxes"];

export function PreparePage() {
  const status = useDatasetStatus();
  const episodeList = useEpisodes();
  const job = useIngestProgress();

  const running = job.data ? !job.data.finished : false;
  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="text-xs text-muted-foreground">Dataset</div>
      <h1 className="text-xl font-semibold">{status.data?.name ?? "Dataset"} · Prepare</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Everything here belongs to the Dataset, not a Project: clips, tracks and hand-drawn boxes.
        Nothing here depends on a Description.
      </p>
      {status.data && <StatusGrid status={status.data} />}
      <SetStatus />
      <div className="mt-8 grid grid-cols-2 gap-4">
        <IngestForm disabled={running} />
        {job.data && <JobProgress job={job.data} />}
      </div>
      <NeedsBox episodes={episodeList.data ?? []} />
    </div>
  );
}

function StatusGrid(props: { status: DatasetStatus }) {
  const { episodes, boxes, baseline, cost_usd: cost } = props.status;
  return (
    <>
      <div className="mt-6 grid grid-cols-3 gap-3">
        <Stat label="Episodes ingested" testId="episodes-ingested">
          {episodes}
        </Stat>
        <Stat label="Clips (H.264 + 5 fps)" of={episodes}>
          {episodes}
        </Stat>
        <Stat label="Hand-drawn boxes" of={episodes} testId="boxes-drawn">
          {boxes}
        </Stat>
        {baseline === null ? (
          <Stat label="Spark-alone baseline" muted note="needs MODEL_API_KEY">
            —
          </Stat>
        ) : (
          <Stat label="Spark-alone baseline" of={episodes} testId="baseline-done">
            {baseline}
          </Stat>
        )}
        {LATER_STAGES.map((label) => (
          <Stat key={label} label={label} muted>
            —
          </Stat>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Meta API spend so far ${cost.toFixed(2)}</p>
    </>
  );
}

function Stat(props: {
  label: string;
  children: number | string;
  of?: number;
  muted?: boolean;
  note?: string;
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
      {props.muted && (
        <div className="text-[11px] text-muted-foreground">{props.note ?? "not built yet"}</div>
      )}
      {props.of !== undefined && value !== null && (
        <Progress value={props.of ? (value / props.of) * 100 : 0} className="mt-2 h-1" />
      )}
    </div>
  );
}
