import { expect, test } from "@playwright/test";

test("ingesting Episodes shows progress, then the new counts", async ({ page, request }) => {
  // Episodes 3 and 4 are this test's own; other tests ingest 0-2 into the same server.
  const before = ((await (await request.get("/api/dataset")).json()) as { episodes: number })
    .episodes;
  await page.goto("/?page=prepare");

  await page.getByLabel("Ingest from droid_100").fill("3 4");
  await page.getByRole("button", { name: "Ingest" }).click();

  await expect(page.getByTestId("job-progress")).toContainText("Last ingest", { timeout: 30_000 });
  await expect(page.getByTestId("job-progress")).toContainText("2 of 2");
  await expect(page.getByTestId("episodes-ingested")).toContainText(String(before + 2));
  await expect(page.getByText(`droid_100 ${String(before + 2)}`)).toBeVisible();
});

test("an index that can't be read is named, and nothing starts", async ({ page }) => {
  await page.goto("/?page=prepare");

  await page.getByLabel("Ingest from droid_100").fill("3 ep16");
  await page.getByRole("button", { name: "Ingest" }).click();

  await expect(page.getByRole("alert")).toHaveText('Can\'t read "ep16"');
});
