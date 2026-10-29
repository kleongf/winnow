import { expect, test } from "@playwright/test";

import { ingest } from "./helpers.ts";

test("Prepare shows each set's size and frozen state; Episodes show their set", async ({
  page,
  request,
}) => {
  // Sets are defined with the CLI or the API; freezing is permanent for this server's data dir.
  await ingest(request, [0, 1]);
  const sets = (await (await request.get("/api/sets")).json()) as {
    name: string;
    frozen_at: string | null;
  }[];
  if (sets.find((s) => s.name === "dev")?.frozen_at === null) {
    await request.post("/api/sets/dev/episodes", { data: { episode_ids: ["droid_100:0"] } });
    await request.post("/api/sets/dev/freeze");
  }

  await page.goto("/?page=prepare");

  await expect(page.getByTestId("set-dev")).toContainText(/Dev set\s*1 Episode\s*frozen /);
  await expect(page.getByTestId("set-test")).toContainText("not frozen");

  await page.goto("/?page=episodes");
  await expect(page.getByRole("row", { name: /^0 .* Dev set Keep/ })).toBeVisible();
  await page.getByRole("row", { name: /^0 / }).click();
  await expect(page.getByTestId("episode-set")).toHaveText("Dev set");
});
