import { expect, test } from "@playwright/test";

import { ingest, referenceLabel } from "./helpers.ts";

// No other spec labels droid_100:1, and this file runs first, so it starts unlabelled.
const EPISODE = "droid_100:1";
const ROW = /^1 Move the black remote control/;

test("an Episode's outputs stay hidden until it has a Reference label", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await ingest(request, [0, 1, 2]);

  await page.goto("/?page=episodes");
  const row = page.getByRole("row", { name: ROW });
  await expect(row.getByTestId("awaiting-label")).toHaveText("Awaiting Reference label");
  await expect(row.getByTestId("triage-decision")).toHaveCount(0);
  await expect(page.getByText(/\d+ awaiting Reference label/)).toBeVisible();

  // Opened, it shows no Triage decision, Reason or lanes, and the API withholds them too.
  await row.click();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText(EPISODE);
  await expect(page.getByLabel("Triage").getByTestId("awaiting-label")).toBeVisible();
  await expect(page.getByTestId("triage-decision")).toHaveCount(0);
  await expect(page.getByTestId("reason")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Lane: / })).toHaveCount(0);
  const hidden = await request.get(`/api/episodes/${encodeURIComponent(EPISODE)}/triage`);
  expect(hidden.status()).toBe(403);
  const listed = (await (await request.get("/api/triage")).json()) as {
    rows: { episode_id: string }[];
  };
  expect(listed.rows.map((r) => r.episode_id)).not.toContain(EPISODE);

  // Once labelled, they appear.
  await referenceLabel(request, [EPISODE]);
  await page.reload();
  // It releases inside the release height's margin, so it needs review.
  await expect(page.getByTestId("triage-decision")).toHaveText("Needs review");
  await expect(page.getByTestId("reason")).not.toBeEmpty();
  await expect(page.getByRole("button", { name: /^Lane: Grasp attempts/ })).toBeVisible();
  await expect(page.getByTestId("awaiting-label")).toHaveCount(0);
  expect(errors).toEqual([]);
});
