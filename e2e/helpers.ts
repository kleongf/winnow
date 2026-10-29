import { expect, type APIRequestContext } from "@playwright/test";

/** Ingest fixture Episodes through the API and wait for the job to finish. */
export async function ingest(request: APIRequestContext, indices: number[]): Promise<void> {
  const started = await request.post("/api/episodes/ingest", {
    data: { source: "droid_100", indices },
  });
  const { job_id: jobId } = (await started.json()) as { job_id: number };
  await expect
    .poll(
      async () => {
        const job = (await (await request.get(`/api/jobs/${String(jobId)}`)).json()) as {
          finished: boolean;
        };
        return job.finished;
      },
      { timeout: 30_000 },
    )
    .toBe(true);
}
