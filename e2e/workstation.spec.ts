import { expect, test } from "@playwright/test";

import { ingest } from "./helpers.ts";

test.beforeEach(async ({ request }) => {
  await ingest(request, [0, 1, 2]);
});

test("a row opens the Workstation; camera tabs switch the video", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.goto("/?page=episodes");

  await page.getByRole("row", { name: /^1 Move the black remote control/ }).click();

  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("droid_100:1");
  const video = page.getByLabel("Episode video");
  await expect(video).toHaveAttribute("src", /exterior_image_1_left$/);
  await page.getByRole("tab", { name: "Wrist" }).click();
  await expect(video).toHaveAttribute("src", /wrist_image_left$/);
  await expect(page.getByRole("img", { name: "Gripper over the Episode" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("the playhead moves the plots' readouts, and ?t= opens at that time", async ({ page }) => {
  await page.goto("/?page=episodes&episode=droid_100%3A0&t=2");

  // The fixture gripper is closed from 0.9 s to 2.4 s, open before and after.
  await expect(page.getByText("2.0 / 3.0 s")).toBeVisible();
  await expect(page.getByTestId("readout-gripper")).toHaveText("1.00");
  await page.getByLabel("Playhead").fill("0.2");
  await expect(page.getByTestId("readout-gripper")).toHaveText("0.00");
});

test("J and K step through Episodes and Esc goes back to the table", async ({ page }) => {
  await page.goto("/?page=episodes&episode=droid_100%3A0");
  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });

  await page.keyboard.press("j");
  await expect(breadcrumb).toContainText("droid_100:1");
  await page.keyboard.press("k");
  await expect(breadcrumb).toContainText("droid_100:0");
  await page.keyboard.press("Escape");

  await expect(page.getByRole("heading", { name: "Episodes" })).toBeVisible();
  await expect(page).toHaveURL(/\?page=episodes$/);
});
