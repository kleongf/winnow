import { expect, test, type Route } from "@playwright/test";

import { freezeDevSet } from "./helpers.ts";

// The Rubric version in use shows its margin multiplier s, calibrates it, and offers the
// thresholds labels suggest. The e2e Dev set is one Episode, so no Criterion can have the two
// contradicting labels a suggestion needs, and calibrating the version every spec scores with
// would change their margins: the uncalibrated state is the server's, and the scan's and
// accept's replies are stubbed here (backend/tests/calibration covers them for real).
const GRASP = "Grasp attempts, up to and including the grasp, ≤ 1";

function calibrated(version: number) {
  return {
    rubric_version: version,
    s: 2,
    record: {
      rubric_version: version,
      s: 2,
      n_labels: 12,
      errors: 1,
      bound_met: true,
      unstable: true,
      created_at: "2026-10-30T00:00:00+00:00",
    },
    labelled: 12,
    grid: [2, 1.5, 1, 0.75, 0.5],
    max_error_rate: 0.2,
    confidence: 0.9,
    suggestions: [
      {
        criterion_id: "grasp-attempts",
        phrase: "grasps the object on the first try",
        english: GRASP,
        suggested_english: "Grasp attempts, up to and including the grasp, ≤ 1.5",
        threshold: 1,
        unit: "attempts",
        suggested_threshold: 1.5,
        suggested_margin: 1,
        contradicting: 2,
        labelled: 3,
      },
    ],
  };
}

test("the version in use calibrates s and accepts a suggested threshold", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await freezeDevSet(request);
  const inUse = (await (await request.get("/api/rubric")).json()) as { version: number };
  const v = String(inUse.version);

  await page.goto(`/?page=describe&version=${v}`);
  const control = page.getByRole("region", { name: "Calibration" });
  await expect(control.getByTestId("multiplier")).toHaveText("s = 1.0 · not tuned yet");
  await expect(control).toContainText("starts at s = 1.0 until it is calibrated");

  // From here the replies are stubbed: twelve labels to tune on, then the scan's result.
  let ran = false;
  await page.route("**/api/calibration", async (route: Route) => {
    const tuned = calibrated(inUse.version);
    const before = { ...tuned, s: 1, record: null, suggestions: [] };
    await route.fulfill({ json: ran ? tuned : before });
  });
  await page.route("**/api/calibration/run", async (route: Route) => {
    ran = true;
    await route.fulfill({ json: calibrated(inUse.version) });
  });
  await page.reload();
  await control.getByRole("button", { name: "Calibrate" }).click();
  await expect(control.getByTestId("multiplier")).toHaveText("s = 2.0 · tuned on 12 labels");
  await expect(control.getByTestId("calibration-warning")).toHaveText(
    "Margins unstable: label more. Dropping 2 labels moves s.",
  );

  // The suggestion sits on its card, with its line on the histogram.
  const card = page.getByRole("article", { name: GRASP });
  const suggestion = card.getByTestId("threshold-suggestion");
  await expect(suggestion).toContainText("Labels suggest");
  await expect(suggestion).toContainText("≤ 1.5");
  await expect(card.getByTestId("suggested-line")).toBeAttached();

  // Accepting freezes the next version and shows it.
  const next = inUse.version + 1;
  let accepted = "";
  await page.route("**/api/calibration/suggestions/*/accept", async (route: Route) => {
    accepted = new URL(route.request().url()).pathname;
    await route.fulfill({
      status: 201,
      json: { version: next, created_at: "2026-10-30T00:00:00+00:00", origin: "run" },
    });
  });
  await suggestion.getByRole("button", { name: `Accept as v${String(next)}` }).click();
  await expect(page).toHaveURL(new RegExp(`version=${String(next)}`));
  expect(accepted).toBe("/api/calibration/suggestions/grasp-attempts/accept");
  expect(errors).toEqual([]);
});
