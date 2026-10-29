import { expect, test } from "@playwright/test";

import { ingest, referenceLabel } from "./helpers.ts";

// reference-labels.spec.ts puts droid_100:2 in the Test set and labels it first, through the UI,
// and this file runs after it; doing both again here (no-ops then) keeps this test runnable alone.
// Other specs need Episodes 0, 1, 3 and 4 out of the Test set or unlabelled, so it stays alone.
const EPISODES = ["droid_100:2"];

test("the Evaluation page runs the Test set, shows the comparison and logs the run", async ({
  page,
  request,
}) => {
  await ingest(request, [0, 1, 2]);
  await request.post("/api/sets/test/episodes", { data: { episode_ids: EPISODES } });
  await referenceLabel(request, EPISODES);
  const logged = async () =>
    ((await (await request.get("/api/evaluation/test-runs")).json()) as unknown[]).length;
  const before = await logged();

  await page.goto("/?page=evaluation");
  await page.getByRole("tab", { name: "Test set" }).click();
  await page.getByRole("button", { name: "Run on the Test set" }).click();

  await expect(page.getByTestId("report-summary")).toContainText(
    /^Test set · Rubric v\d+ · \d+ of \d+ Episodes labelled · \d+ description failures?$/,
  );
  const comparison = page.getByRole("table", { name: "Comparison" });
  for (const system of ["Winnow", "Winnow (all Needs review kept)", "Spark alone", "Length alone"])
    await expect(comparison.getByRole("cell", { name: system, exact: true })).toBeVisible();
  // Counts first, then the interval; never "±".
  await expect(page.getByTestId("system-winnow")).toContainText(/\d+ of \d+/);
  await expect(page.getByText(/Length alone keeps Episodes [≥≤] [\d.]+ s/)).toBeVisible();
  await expect(page.locator("main")).not.toContainText("±");

  expect(await logged()).toBe(before + 1);
  const log = page.getByRole("table", { name: "Test run log" });
  await expect(log.getByRole("row")).toHaveCount(before + 2); // with the header row
  await log.getByRole("row").nth(1).click();
  await expect(log.getByRole("row").nth(1)).toHaveAttribute("data-state", "selected");
});
