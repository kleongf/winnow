import { expect, test } from "@playwright/test";

test("app loads and reaches the backend", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Pick-and-place · Prepare" })).toBeVisible();
  await expect(page.getByTestId("health-status")).toContainText("Backend ok");
  expect(errors).toEqual([]);
});

test("each page is reachable from the sidebar and kept in the URL", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Review" }).click();

  await expect(page.getByRole("heading", { name: "Review" })).toBeVisible();
  await expect(page).toHaveURL(/\?page=review$/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Review" })).toBeVisible();
});
