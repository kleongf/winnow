import { expect, test } from "@playwright/test";

test("app loads and reaches the backend", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Winnow" })).toBeVisible();
  await expect(page.getByTestId("health-status")).toContainText("Backend ok");
  expect(errors).toEqual([]);
});
