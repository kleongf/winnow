import { expect, type APIRequestContext, type Page } from "@playwright/test";

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

/** The box `dragBox` draws: from 40% to 60% of each side of the 320x180 frame. Its exterior
 * track and target box are recorded for every fixture Episode in both exterior views
 * (backend/tests/record_meta.py), so the work a saved box queues replays. */
export const RECORDED_BOX = { x1: 128, y1: 72, x2: 192, y2: 108 };

/** Drag RECORDED_BOX on the box canvas. Each corner is aimed a quarter frame pixel inside the
 * one wanted, so the browser rounding the pointer to a whole CSS pixel can't move it. */
export async function dragBox(page: Page): Promise<void> {
  const canvas = page.getByTestId("box-canvas");
  const frame = canvas.getByRole("img", { name: "Frame 0" });
  await expect.poll(() => frame.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(320);
  // Wait out the dialog's opening zoom, or the canvas is measured mid-zoom.
  await canvas.evaluate((el) => {
    const dialog = el.closest("[role=dialog]") ?? el;
    return Promise.all(dialog.getAnimations({ subtree: true }).map((a) => a.finished));
  });
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("box canvas has no size");
  const at = (x: number, y: number) =>
    [
      bounds.x + ((x + 0.25) / 320) * bounds.width,
      bounds.y + ((y + 0.25) / 180) * bounds.height,
    ] as const;
  const { x1, y1, x2, y2 } = RECORDED_BOX;
  await page.mouse.move(...at(x1, y1));
  await page.mouse.down();
  await page.mouse.move(...at(x2, y2), { steps: 4 });
  await page.mouse.up();
}

/** Box an Episode's object through the API and wait for the work the box queues. */
export async function boxEpisode(
  request: APIRequestContext,
  episodeId: string,
  camera: string,
): Promise<void> {
  const saved = await request.put(`/api/episodes/${encodeURIComponent(episodeId)}/box`, {
    data: { camera, ...RECORDED_BOX },
  });
  expect(saved.ok()).toBe(true);
  await expect
    .poll(async () => {
      const job = (await (await request.get("/api/jobs/latest?kind=box")).json()) as {
        finished: boolean;
      };
      return job.finished;
    })
    .toBe(true);
}
