import { expect, test } from "@playwright/test";

import { EPISODES, episodeId, ingest, referenceLabel } from "./helpers.ts";

const [INDEX] = EPISODES.sets;
const EPISODE = episodeId(INDEX);

test("Prepare shows each set's size and frozen state; Episodes show their set", async ({
  page,
  request,
}) => {
  // Sets are defined with the CLI or the API; freezing is permanent for this server's data dir.
  // No other spec touches the Dev set.
  await ingest(request, EPISODES.sets);
  await referenceLabel(request, [EPISODE]); // so its Triage decision shows
  const sets = (await (await request.get("/api/sets")).json()) as {
    name: string;
    frozen_at: string | null;
  }[];
  if (sets.find((s) => s.name === "dev")?.frozen_at === null) {
    await request.post("/api/sets/dev/episodes", { data: { episode_ids: [EPISODE] } });
    await request.post("/api/sets/dev/freeze");
  }

  await page.goto("/?page=prepare");

  await expect(page.getByTestId("set-dev")).toContainText(/Dev set\s*1 Episode\s*frozen /);
  await expect(page.getByTestId("set-test")).toContainText("not frozen");

  await page.goto("/?page=episodes");
  const row = `^${String(INDEX)} `;
  await expect(page.getByRole("row", { name: new RegExp(`${row}.* Dev set Keep`) })).toBeVisible();
  await page.getByRole("row", { name: new RegExp(row) }).click();
  await expect(page.getByTestId("episode-set")).toHaveText("Dev set");
});
