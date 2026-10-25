import { expect, test } from "@playwright/test";
import {
  cleanupTestData,
  createTestUser,
  createTestWorkspace,
} from "../helpers/seed";
import { signIn } from "./helpers/auth";

test.afterAll(cleanupTestData);

test("an owner writes, adds and clears policies", async ({ page }) => {
  const owner = await createTestUser();
  const ws = await createTestWorkspace(owner);
  await signIn(page, owner);
  await expect(page).toHaveURL(`/w/${ws.slug}`);
  await page.goto(`/w/${ws.slug}/policies`);

  const cancellations = page.getByLabel("Cancellations", { exact: true });
  await cancellations.fill("Cancel at least 24 hours ahead or pay half.");
  await page.getByRole("button", { name: "Save Cancellations" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.reload();
  await expect(cancellations).toHaveValue(
    "Cancel at least 24 hours ahead or pay half.",
  );

  await expect(page.getByText("No custom policies yet.")).toBeVisible();
  await page.getByRole("button", { name: "Add a policy" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Save policy" }).click();
  await expect(dialog.getByText("Add a title.")).toBeVisible();
  await dialog.getByLabel("Title").fill("Children");
  await dialog
    .getByLabel("Policy")
    .fill("Children under 12 are welcome with an adult.");
  await dialog.getByRole("button", { name: "Save policy" }).click();
  const custom = page.getByRole("list", { name: "Custom policies" });
  await expect(custom.getByText("Children", { exact: true })).toBeVisible();
  await expect(
    custom.getByText("Children under 12 are welcome with an adult."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Clear Cancellations" }).click();
  await expect(page.getByText("Cleared.")).toBeVisible();
  await expect(cancellations).toHaveValue("");
  await page.reload();
  await expect(cancellations).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Clear Cancellations" }),
  ).toHaveCount(0);
});
