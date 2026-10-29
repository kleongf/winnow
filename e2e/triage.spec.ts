import { expect, test } from "@playwright/test";

import { ingest, referenceLabel } from "./helpers.ts";

test.beforeEach(async ({ request }) => {
  await ingest(request, [0, 1, 2]);
  // Their Triage decisions show only once labelled. reference-labels.spec.ts labels
  // droid_100:2 first, through the UI; awaiting-label.spec.ts keeps droid_100:1 for itself
  // until the filter test below, which runs after it.
  await referenceLabel(request, ["droid_100:0", "droid_100:2"]);
});

test("the table sorts Episodes into Triage tabs with their Reasons", async ({ page }) => {
  await page.goto("/?page=episodes");

  await expect(page.getByText(/\d+ of \d+ decided automatically/)).toBeVisible();
  await page.getByRole("tab", { name: /^Keep/ }).click();
  await expect(page.getByRole("row", { name: /^0 Put the marker in the pot/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /^2 / })).toHaveCount(0);

  await page.getByRole("tab", { name: /^Reject/ }).click();
  await expect(page.getByRole("row", { name: /^2 / })).toContainText(
    "2 failed grasp attempts, at 0.9 s and 1.3 s, before the grasp at 1.8 s.",
  );
  await expect(page).toHaveURL(/triage=reject/);
});

test("a Reject opens from the table, and its lane and Reason seek the playhead", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.goto("/?page=episodes&triage=reject");

  await page.getByRole("row", { name: /^2 / }).click();

  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("droid_100:2");
  await expect(page.getByTestId("triage-decision")).toHaveText("Reject");
  await expect(page.getByText("0.0 / 3.0 s")).toBeVisible();
  await page.getByRole("button", { name: /^Lane: Grasp attempts/ }).click();
  // The first failed attempt, at 0.9 s; its result opens with its moments.
  await expect(page.getByText("0.9 / 3.0 s")).toBeVisible();
  await expect(page.getByRole("button", { name: "Grasp 1.8 s" })).toBeVisible();

  await page.getByTestId("reason").getByRole("button", { name: "1.3 s" }).click();
  await expect(page.getByText("1.3 / 3.0 s")).toBeVisible();
  expect(errors).toEqual([]);
});

test("the table filters by Uncertainty signal, set and Phrase, and sorts by confidence", async ({
  page,
  request,
}) => {
  // Fixture Episodes 1 and 4 release inside the release height's margin, 4 nearer its fail side.
  await ingest(request, [4]);
  // awaiting-label.spec.ts runs first and labels droid_100:1 itself; labelling it again here
  // (a no-op then) keeps this test runnable alone.
  await referenceLabel(request, ["droid_100:1", "droid_100:4"]);
  const firstCells = page.locator("tbody tr td:first-child");
  await page.goto("/?page=episodes");

  await page.getByLabel("Uncertainty signal").selectOption("near threshold");
  await expect(firstCells).toHaveText(["1", "4"]);
  await expect(page.getByTestId("phrase-chip").first()).toHaveText(
    "places it in or on the target named in the instruction",
  );
  await expect(page).toHaveURL(/signal=near\+threshold/);

  await page.getByRole("button", { name: "Confidence" }).click();
  await expect(firstCells).toHaveText(["4", "1"]); // least confident first
  const confidences = await page.getByTestId("confidence").allTextContents();
  expect(Number(confidences[0])).toBeLessThan(Number(confidences[1]));
  await page.getByRole("button", { name: "Confidence" }).click();
  await expect(firstCells).toHaveText(["1", "4"]);

  await page.getByLabel("Set", { exact: true }).selectOption("dev");
  await expect(page.getByText("No Episodes match this tab and these filters.")).toBeVisible();
  await page.getByLabel("Set", { exact: true }).selectOption("none");
  await expect(firstCells).toHaveText(["1", "4"]);

  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByLabel("Phrase").selectOption("grasps the object on the first try");
  await expect(page.getByRole("row", { name: /^2 / })).toBeVisible();
  await expect(page.getByRole("row", { name: /^0 / })).toHaveCount(0);
});
