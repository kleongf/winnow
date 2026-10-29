import { expect, type APIRequestContext } from "@playwright/test";

/** Give each Episode a first-pass Reference label passing every Phrase, which reveals its
 * Triage decision. Labels never change, so one already there is kept. */
export async function referenceLabel(
  request: APIRequestContext,
  episodeIds: string[],
): Promise<void> {
  const description = (await (await request.get("/api/reference-labels/description")).json()) as {
    phrases: string[];
  };
  const phrases = description.phrases.map((phrase) => ({ phrase, passed: true, interval: null }));
  for (const id of episodeIds) {
    const saved = await request.post(`/api/episodes/${encodeURIComponent(id)}/reference-labels`, {
      data: { phrases, elapsed_s: 10, instruction: "Put the block in the bowl" },
    });
    expect([201, 409]).toContain(saved.status());
  }
}

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
