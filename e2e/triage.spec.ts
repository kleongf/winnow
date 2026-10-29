import { expect, test } from "@playwright/test";

import { ingest } from "./helpers.ts";

test.beforeEach(async ({ request }) => {
  await ingest(request, [0, 1, 2]);
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
