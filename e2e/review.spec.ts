import { expect, test } from "@playwright/test";

import { ingest, referenceLabel } from "./helpers.ts";

// Fixture Episodes 1 and 4 release inside the release height's margin, 4 nearer its fail side,
// so both need review and 4 comes first. This answers 1 as a fail: triage.spec.ts runs later and
// still finds both near threshold, with 4 the less confident.
test.beforeEach(async ({ request }) => {
  await ingest(request, [0, 1, 2, 4]);
  await referenceLabel(request, ["droid_100:1", "droid_100:4"]);
});

test("answering an Episode's unsure Phrase takes it out of the queue", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.goto("/?page=review");

  const current = page.getByTestId("review-current");
  const upNext = page.getByRole("region", { name: "Up next" });
  await expect(current).toContainText("droid_100:4"); // least confident first
  const first = Number(await page.getByTestId("review-confidence").textContent());
  const next = upNext.getByRole("button", { name: /droid_100:1/ });
  expect(Number(await next.getByTestId("up-next-confidence").textContent())).toBeGreaterThan(first);

  await next.click();
  await expect(current).toContainText("droid_100:1");
  const yourCall = page.getByRole("region", { name: "Your call" });
  await expect(yourCall.getByRole("group")).toHaveText([
    /places it in or on the target named in the instruction.*near threshold/,
  ]);
  await page.keyboard.press("2"); // Fail

  await expect(current).toContainText("droid_100:4");
  await expect(upNext.getByRole("button", { name: /droid_100:1/ })).toHaveCount(0);
  await page.goto("/?page=episodes&episode=droid_100%3A1");
  await expect(page.getByTestId("reason")).toHaveText(
    'Rejected: "places it in or on the target named in the instruction" was marked fail in review.',
  );
  expect(errors).toEqual([]);
});
