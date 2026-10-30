import { expect, test } from "@playwright/test";

import { freezeDevSet } from "./helpers.ts";

// The frozen Description, whose compile against the Dev set is recorded: two Phrases are
// Unsupported, and Spark assumed the pause threshold.
const FROZEN =
  "Expert pick-and-place: grasps the object on the first try, never drops it, places it in or " +
  "on the target named in the instruction, no long pauses.";
const PLACES = "places it in or on the target named in the instruction";
const PAUSES = "Longest stretch with the arm under 0.01 m/s < 1 s";

test("the interview covers the Phrases, then a bisection card confirms the pause threshold", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await freezeDevSet(request); // one Dev set Episode, which never pauses

  await page.goto("/?page=describe");
  await page.getByLabel("Description", { exact: true }).fill(FROZEN);
  await page.getByRole("button", { name: "Compile" }).click();

  const interview = page.getByRole("region", { name: "Interview" });
  const question = interview.getByRole("region", { name: "Question" });
  await expect(question).toContainText("Nothing checks “never drops it”");
  await question.getByRole("button", { name: /^Leave it unchecked/ }).click();

  await expect(question).toContainText(`Nothing checks “${PLACES}”`);
  await question.getByRole("button", { name: /^Mark it Context/ }).click();
  const places = page.getByRole("region", { name: `Phrase: ${PLACES}` });
  await expect(places.getByTestId("phrase-status")).toHaveText("Context");
  await expect(interview.getByTestId("interview-status")).toHaveText(
    /^Every Phrase is covered: the interview is done\./,
  );

  // Every Phrase is covered; the assumed pause threshold is asked on the anchor Episode.
  const pauses = page.getByRole("article", { name: PAUSES });
  await expect(pauses.getByTestId("assumption")).toHaveCount(1);
  await expect(question).toContainText(/Is .+ s fine for “no long pauses”\?/);
  await expect(question.getByLabel("Episode clip")).toBeVisible();
  await question.getByRole("button", { name: "Fine: “no long pauses” passes" }).click();

  const answered = interview.getByRole("article", { name: "Answer: no long pauses" });
  await expect(answered.getByTestId("answer-effect")).toHaveText(
    /^Labelled droid_100:6 pass on “no long pauses”\. Threshold confirmed at 1 s\.$/,
  );
  await expect(pauses).toHaveAttribute("data-highlighted", "true");
  await expect(pauses.getByTestId("assumption")).toHaveCount(0);

  // Undo puts the assumption back and asks again.
  await answered.getByRole("button", { name: "Undo" }).click();
  await expect(pauses.getByTestId("assumption")).toHaveCount(1);
  await expect(pauses).not.toHaveAttribute("data-highlighted");
  await expect(question).toContainText("fine for “no long pauses”?");
  expect(errors).toEqual([]);
});
