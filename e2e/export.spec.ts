import { expect, test } from "@playwright/test";

// Export reads every Episode but changes none, so this spec claims none: it asserts only that
// the export runs to the end and says where it went.
test("Export writes the kept Episodes and says where", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/?page=episodes");
  await page.getByRole("button", { name: "Export", exact: true }).click();

  const written = page.getByTestId("export-written");
  await expect(written).toContainText(
    /Exported \d+ kept Episodes?, and the Reasons for \d+ not kept, to \S+\/exports\/\S+/,
    {
      timeout: 30_000,
    },
  );
  await expect(page.getByRole("button", { name: "Export", exact: true })).toBeEnabled();
  expect(errors).toEqual([]);
});
