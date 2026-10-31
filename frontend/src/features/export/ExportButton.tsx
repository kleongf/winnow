// Export: the kept Episodes written as LeRobot datasets, never the Test set, with the Reason for
// every Episode left out. ExportStatus shows how it went.
import { Button } from "@/components/ui/button";

import { useLatestJob } from "../jobs/useLatestJob";
import { useStartExport } from "./useStartExport";

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
