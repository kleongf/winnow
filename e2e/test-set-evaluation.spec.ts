import { expect, test, type APIRequestContext } from "@playwright/test";

import { EPISODES, episodeId, ingest } from "./helpers.ts";

// Labelled as soon as it joins the Test set, so reference-labels.spec.ts never finds it queued.
const OWN = EPISODES.testSetEvaluation.map(episodeId);

/** Fail the first Phrase ("grasps the object on the first try") over `interval`, pass the rest:
 * the fixture Episode is rejected after failed grasps, so Winnow's Reject is a correct one. A
 * label already there is kept, since labels never change. */
async function labelFirstTryFailure(
  request: APIRequestContext,
  id: string,
  interval: [number, number],
  relabel: boolean,
): Promise<void> {
  const description = (await (await request.get("/api/reference-labels/description")).json()) as {
    phrases: string[];
  };
  const phrases = description.phrases.map((phrase, i) =>
    i === 0
      ? { phrase, passed: false, interval: { start_s: interval[0], end_s: interval[1] } }
      : { phrase, passed: true, interval: null },
  );
  const saved = await request.post(`/api/episodes/${encodeURIComponent(id)}/reference-labels`, {
    data: { phrases, elapsed_s: 10, instruction: "Put the block in the bowl", relabel },
  });
  expect([201, 409]).toContain(saved.status());
}

test("the Evaluation page runs the Test set, shows the comparison and logs the run", async ({
  page,
  request,
}) => {
  await ingest(request, EPISODES.testSetEvaluation);
  await request.post("/api/sets/test/episodes", { data: { episode_ids: OWN } });
  for (const id of OWN) {
    await labelFirstTryFailure(request, id, [0, 2.9], false);
    await labelFirstTryFailure(request, id, [0, 2.4], true); // the relabel pass, for the slack
  }
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

  // Right reason at the slack measured from the relabel, and over 0–3 s of slack.
  await expect(page.getByText(/Slack [\d.]+ s: the 95th percentile/)).toBeVisible();
  await expect(page.getByTestId("right-reason-at-slack")).toContainText(/Winnow \d+ of \d+/);
  await expect(page.getByRole("img", { name: "Right reason over slack" })).toBeVisible();
  // Both risk–coverage curves, with Winnow's own coverage marked.
  const risk = page.getByRole("img", { name: "Risk against coverage" });
  for (const system of ["winnow", "spark_alone"])
    await expect(risk.getByTestId(`curve-${system}`).locator("circle").first()).toBeVisible();
  await expect(risk.getByTestId("curve-marker")).toContainText("Winnow decides");
  await expect(page.getByRole("table", { name: "Matched coverage" })).toBeVisible();
  await expect(page.getByTestId("mcnemar")).toContainText("Only Spark alone right");
  const phrases = page.getByRole("table", { name: "Failures per Phrase" });
  await expect(phrases.getByText("Too few to score").first()).toBeVisible();

  expect(await logged()).toBe(before + 1);
  const log = page.getByRole("table", { name: "Test run log" });
  await expect(log.getByRole("row")).toHaveCount(before + 2); // with the header row
  await log.getByRole("row").nth(1).click();
  await expect(log.getByRole("row").nth(1)).toHaveAttribute("data-state", "selected");
});
