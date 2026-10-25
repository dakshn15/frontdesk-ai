import { expect, test } from "@playwright/test";
import {
  cleanupTestData,
  createTestUser,
  createTestWorkspace,
} from "../helpers/seed";
import { signIn } from "./helpers/auth";

test.afterAll(cleanupTestData);

const OPEN_DAYS = ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

test("an owner sets opening hours and closed days", async ({ page }) => {
  const owner = await createTestUser();
  const ws = await createTestWorkspace(owner);
  await signIn(page, owner);
  await expect(page).toHaveURL(`/w/${ws.slug}`);
  await page.goto(`/w/${ws.slug}/hours`);

  for (const day of OPEN_DAYS) {
    await page.getByLabel(`Open on ${day}`).check();
    await page.getByLabel(`${day} opens`, { exact: true }).fill("09:00");
    await page.getByLabel(`${day} closes`, { exact: true }).fill("18:00");
  }
  await page.getByRole("button", { name: "Save hours" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.reload();
  for (const day of OPEN_DAYS) {
    await expect(page.getByLabel(`${day} opens`, { exact: true })).toHaveValue(
      "09:00",
    );
    await expect(page.getByLabel(`${day} closes`, { exact: true })).toHaveValue(
      "18:00",
    );
  }
  await expect(page.getByLabel("Open on Monday")).not.toBeChecked();
  await expect(page.getByLabel("Open on Sunday")).not.toBeChecked();

  // A second range that overlaps the first is refused, and nothing changes.
  await page.getByRole("button", { name: "Add hours on Tuesday" }).click();
  await page.getByLabel("Tuesday opens (2)").fill("12:00");
  await page.getByLabel("Tuesday closes (2)").fill("19:00");
  await page.getByRole("button", { name: "Save hours" }).click();
  await expect(
    page.getByText("Times on the same day can't overlap."),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Tuesday opens (2)")).toHaveCount(0);
  await expect(page.getByLabel("Tuesday closes", { exact: true })).toHaveValue(
    "18:00",
  );

  // Christmas next year, so the test never uses a past date.
  const christmas = `${new Date().getFullYear() + 1}-12-25`;
  await expect(page.getByText("No closed days coming up.")).toBeVisible();
  await page.getByLabel("Date", { exact: true }).fill(christmas);
  await page.getByLabel("Name (optional)").fill("Christmas Day");
  await page.getByRole("button", { name: "Add closed day" }).click();
  const list = page.getByRole("list", { name: "Closed days coming up" });
  await expect(list.getByText("Christmas Day")).toBeVisible();

  await page.getByLabel("Date", { exact: true }).fill(christmas);
  await page.getByRole("button", { name: "Add closed day" }).click();
  await expect(
    page.getByText("That day is already marked closed."),
  ).toBeVisible();
});
