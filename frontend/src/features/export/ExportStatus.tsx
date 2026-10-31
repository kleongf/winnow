import { JobProgress } from "../jobs/JobProgress";
import { useLatestJob } from "../jobs/useLatestJob";

const TITLE = { running: "Exporting", finished: "Last export" };

/** The latest export: its progress while it runs or if it failed, else where it was written. */
export function ExportStatus() {
  const job = useLatestJob("export").data;
  if (!job) return null;
  const written = job.finished && job.failed === 0 ? job.items[0]?.detail : undefined;
  if (written) {
    return (
      <p className="mt-2 text-xs text-muted-foreground" data-testid="export-written">
        Exported {written}
      </p>
    );
  }
  return (
    <div className="mt-3 max-w-md">
      <JobProgress job={job} title={TITLE} />
    </div>
  );
}
