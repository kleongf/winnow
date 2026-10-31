// Export: the kept Episodes written as LeRobot datasets, never the Test set, with the Reason for
// every Episode left out. Shows the export's progress, then where it went.
import { Button } from "@/components/ui/button";

import { JobProgress } from "../jobs/JobProgress";
import { useLatestJob } from "../jobs/useLatestJob";
import { useStartExport } from "./useStartExport";

const TITLE = { running: "Exporting", finished: "Last export" };

export function ExportButton() {
  const job = useLatestJob("export").data;
  const start = useStartExport();
  const running = job ? !job.finished : false;
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={running || start.isPending}
      title="Write the kept Episodes in LeRobot format, with a Reason for each one left out"
      onClick={() => {
        start.mutate();
      }}
    >
      Export
    </Button>
  );
}

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
