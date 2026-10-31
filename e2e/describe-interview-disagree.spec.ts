import { expect, test, type APIRequestContext, type Locator } from "@playwright/test";

import { DEV_SET, episodeId, freezeDevSet } from "./helpers.ts";

// The frozen Description, whose recorded compile the other describe specs expect to find.
const FROZEN =
  "Expert pick-and-place: grasps the object on the first try, never drops it, places it in or " +
  "on the target named in the instruction, no long pauses.";
// Its compile is scripted (backend/tests/record_interview.py): CAREFUL's two Criteria disagree on
// the Dev set Episode, which grasps once (a pass) but keeps the arm moving over a second (a fail).
// The answer labels that Episode on CAREFUL, a Phrase no other spec has; afterEach withdraws it.
const CAREFUL = "grasps it once and quickly";
const DISAGREE = `Careful pick: ${CAREFUL}.`;
const EPISODE = episodeId(DEV_SET[0]);

async function compile(request: APIRequestContext, description: string): Promise<void> {
  const compiled = await request.post("/api/rubric/draft/compile", {
    data: { description, fresh: true },
  });
  expect(compiled.ok()).toBe(true);
}

/** Undo every answer, latest first, withdrawing the labels they left. */
async function undoAll(request: APIRequestContext): Promise<void> {
  const interview = (await (await request.get("/api/interview")).json()) as {
    answered: { id: number }[];
  };
  for (const { id } of [...interview.answered].reverse()) {
    await request.delete(`/api/interview/answers/${String(id)}`);
  }
}

test.beforeEach(async ({ request }) => {
  await freezeDevSet(request);
  await compile(request, DISAGREE);
});

test.afterEach(async ({ request }) => {
  await undoAll(request);
  await compile(request, FROZEN);
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

test("where a Phrase's Criteria disagree, a Pass answer labels the Episode and re-sorts it", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.goto("/?page=describe");
  const interview = page.getByRole("region", { name: "Interview" });
  const question = interview.getByRole("region", { name: "Question" });
  const sort = page.getByTestId("anchor-sort");
  await expect(sort).toHaveText("Sorts it: 0 Keep · 1 Reject · 0 Needs review");

  await skipTo(question, "Criteria disagree");
  await expect(question).toContainText(`Its Criteria disagree on this Episode. Does “${CAREFUL}”`);
  await expect(question.getByLabel("Episode clip")).toBeVisible();
  await expect(question.getByTestId("clip-value")).toHaveText("1 fails, 1 passes");
  const results = question.getByTestId("disagree-result");
  await expect(results).toHaveCount(2);
  await expect(results.nth(0)).toContainText(/^pass.*1 attempt$/);
  await expect(results.nth(1)).toContainText(/^failTime the arm is moving < 1 s/);
  await question.getByRole("button", { name: `Pass: “${CAREFUL}” passes` }).click();

  const answered = interview.getByRole("article", { name: `Answer: ${CAREFUL}` });
  await expect(answered).toContainText(`“${CAREFUL}” on ${EPISODE}: passes`);
  await expect(answered.getByTestId("answer-effect")).toHaveText(
    `Labelled ${EPISODE} pass on “${CAREFUL}”.`,
  );
  await expect(sort).toHaveText("Sorts it: 1 Keep · 0 Reject · 0 Needs review"); // in force
  const labels = (await (
    await request.get(`/api/episodes/${encodeURIComponent(EPISODE)}/labels`)
  ).json()) as { phrase: string; value: string; source: string; withdrawn_at: string | null }[];
  expect(labels.filter((l) => l.phrase === CAREFUL && l.withdrawn_at === null)).toEqual([
    expect.objectContaining({ value: "pass", source: "interview" }),
  ]);

  await answered.getByRole("button", { name: "Undo" }).click();
  await expect(sort).toHaveText("Sorts it: 0 Keep · 1 Reject · 0 Needs review");
  await expect(question).toContainText("Criteria disagree"); // asked again
  expect(errors).toEqual([]);
});
