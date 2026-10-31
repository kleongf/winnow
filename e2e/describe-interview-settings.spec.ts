import { expect, test, type APIRequestContext, type Locator } from "@playwright/test";

import { freezeDevSet } from "./helpers.ts";

// The frozen Description, whose compile against the Dev set is recorded. Hard/soft and setting
// answers judge no Episode on a Phrase, so they leave no label: this spec claims no Episode.
const FROZEN =
  "Expert pick-and-place: grasps the object on the first try, never drops it, places it in or " +
  "on the target named in the instruction, no long pauses.";

/** Undo every answer, latest first, so the draft is as compiled for the specs after. */
async function undoAll(request: APIRequestContext): Promise<void> {
  const interview = (await (await request.get("/api/interview")).json()) as {
    answered: { id: number }[];
  };
  for (const { id } of [...interview.answered].reverse()) {
    await request.delete(`/api/interview/answers/${String(id)}`);
  }
}

test.beforeEach(async ({ request }) => {
  await freezeDevSet(request); // one Dev set Episode, which grasps cleanly
  const compiled = await request.post("/api/rubric/draft/compile", {
    data: { description: FROZEN, fresh: true },
  });
  expect(compiled.ok()).toBe(true);
});

test.afterEach(async ({ request }) => {
  await undoAll(request);
});

/** Skip each question until one of `kind` (its card's label) is asked. */
async function skipTo(question: Locator, kind: string): Promise<void> {
  for (let i = 0; i < 20; i++) {
    const asked = (await question.textContent()) ?? "";
    if (asked.startsWith(kind)) return;
    await question.getByRole("button", { name: /^Skip/ }).click();
    await expect(question).not.toHaveText(asked); // the next question is up
  }
  throw new Error(`No ${kind} question`);
}

test("after the thresholds, it asks whether a Criterion is hard, then confirms a grasp setting", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.goto("/?page=describe");
  const interview = page.getByRole("region", { name: "Interview" });
  const question = interview.getByRole("region", { name: "Question" });
  await expect(question).toBeVisible();

  await skipTo(question, "Hard or soft");
  const prompt = (await question.textContent()) ?? "";
  const english = /If an Episode fails “(.+)”, should it be rejected outright/.exec(prompt)?.[1];
  if (!english) throw new Error(`Not a hard/soft prompt: ${prompt}`);
  const card = page.getByRole("article", { name: english, exact: true });
  await expect(card).not.toContainText("soft · never rejects");
  await question.getByRole("button", { name: "Soft: only lower its quality" }).click();

  const soft = interview.getByRole("article", { name: `Answer: ${english}` });
  await expect(soft).toContainText(`“${english}”: soft`);
  await expect(soft.getByTestId("answer-effect")).toHaveText(
    "Soft: failing it only lowers the Episode's quality.",
  );
  await expect(card).toContainText("soft · never rejects");

  await skipTo(question, "Assumed grasp setting");
  await expect(question).toContainText("Is the gripper closed at this moment?");
  await expect(question.getByLabel("Episode clip")).toBeVisible();
  await expect(question.getByTestId("clip-value")).toHaveText("closed to 1.00");
  const closedLevel = page.getByTestId("rubric-setting").filter({ hasText: "Gripper closed" });
  await expect(closedLevel).toContainText("assumed");
  await question.getByRole("button", { name: "Closed", exact: true }).click();

  const closed = interview.getByRole("article", { name: "Answer: Gripper closed level" });
  await expect(closed).toContainText("Gripper closed level: closed to 1.00 on droid_100:6, closed");
  await expect(closed.getByTestId("answer-effect")).toHaveText(
    "Marked droid_100:6 closed. Gripper closed level confirmed at 0.2.",
  );
  await expect(closedLevel).not.toContainText("assumed");

  // Undo makes the Criterion hard again.
  await soft.getByRole("button", { name: "Undo" }).click();
  await expect(card).not.toContainText("soft · never rejects");
  expect(errors).toEqual([]);
});
