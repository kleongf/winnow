import { Progress } from "@/components/ui/progress";

import type { components } from "../../api/schema";

type Job = components["schemas"]["Job"];

export function JobProgress(props: { job: Job }) {
  const { job } = props;
  const settled = job.done + job.failed;
  const failed = job.items.filter((item) => item.status === "failed");
  const running = job.items.filter((item) => item.status === "running");
  return (
    <div className="rounded-lg border p-4" data-testid="job-progress">
      <div className="flex items-baseline gap-2 text-sm">
        <span className="font-medium">{job.finished ? "Last ingest" : "Ingesting"}</span>
        <span className="text-muted-foreground tabular-nums">
          {settled} of {job.total}
          {job.failed > 0 && ` · ${String(job.failed)} failed`}
        </span>
      </div>
      <Progress value={(settled / job.total) * 100} className="mt-2 h-1.5" />
      {running.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Now: {running.map((item) => item.label).join(", ")}
        </p>
      )}
      {failed.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs">
          {failed.map((item) => (
            <li key={item.position}>
              <span className="font-medium text-destructive">{item.label}</span>{" "}
              <span className="text-muted-foreground">{item.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
