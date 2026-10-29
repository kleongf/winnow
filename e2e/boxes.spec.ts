import { expect, test, type Page } from "@playwright/test";

import { dragBox, ingest } from "./helpers.ts";

interface Box {
  episode_id: string;
  camera: string;
}

async function boxes(page: Page): Promise<Box[]> {
  return (await (await page.request.get("/api/boxes")).json()) as Box[];
}

test.beforeEach(async ({ request }) => {
  await ingest(request, [0, 1, 2]);
});

test("Save & next boxes two Episodes, keys and mouse alike", async ({ page }) => {
  const before = (await boxes(page)).length;
  await page.goto("/?page=prepare");
  await page.getByRole("button", { name: /^Draw boxes/ }).click();
  const dialog = page.getByRole("dialog");
  const first = (await dialog.getByRole("heading").textContent()) ?? "";

  await page.keyboard.press("2");
  await expect(dialog.getByRole("button", { name: "Exterior 2 (2)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await dragBox(page);
  await page.keyboard.press("Enter");
  await expect(dialog.getByRole("heading")).not.toHaveText(first);
  await dragBox(page);
  await dialog.getByRole("button", { name: /Save & next/ }).click();

  await expect.poll(async () => (await boxes(page)).length).toBe(before + 2);
  const saved = await boxes(page);
  const firstIndex = /Episode (\d+)/.exec(first)?.[1] ?? "";
  expect(saved.find((b) => b.episode_id === `droid_100:${firstIndex}`)?.camera).toBe(
    "exterior_image_2_left",
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: `Draw a box for Episode ${firstIndex}` }),
  ).toHaveCount(0);
  await expect(page.getByTestId("boxes-drawn")).toContainText(String(before + 2));
  // Each box queued its exterior track and target box, replayed from the recordings.
  const boxJob = async () =>
    (await (await page.request.get("/api/jobs/latest?kind=box")).json()) as {
      finished: boolean;
      failed: number;
    };
  await expect.poll(async () => (await boxJob()).finished).toBe(true);
  expect((await boxJob()).failed).toBe(0);
});

test("Skip moves on without saving anything", async ({ page }) => {
  const before = (await boxes(page)).length;
  await page.goto("/?page=prepare");
  await page.getByRole("button", { name: /^Draw boxes/ }).click();
  const dialog = page.getByRole("dialog");
  const first = (await dialog.getByRole("heading").textContent()) ?? "";

  await dragBox(page);
  await expect(dialog).toContainText("box ");
  await dialog.getByRole("button", { name: "Skip" }).click();

  // On to the next Episode, or closed if that was the last one.
  await expect(page.getByRole("heading", { name: first })).toHaveCount(0);
  expect((await boxes(page)).length).toBe(before);
});
