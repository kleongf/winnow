import { expect, test } from "@playwright/test";

import { EPISODES, episodeId, ingest, referenceLabel } from "./helpers.ts";

// Labelled as soon as it joins the Test set, so reference-labels.spec.ts never finds it queued.
const OWN = EPISODES.testSetEvaluation.map(episodeId);

test("the Evaluation page runs the Test set, shows the comparison and logs the run", async ({
  page,
  request,
}) => {
  await ingest(request, EPISODES.testSetEvaluation);
  await request.post("/api/sets/test/episodes", { data: { episode_ids: OWN } });
  await referenceLabel(request, OWN);
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
