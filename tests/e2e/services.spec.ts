import { expect, test } from "@playwright/test";
import {
  addTestMember,
  cleanupTestData,
  createTestUser,
  createTestWorkspace,
} from "../helpers/seed";
import { signIn } from "./helpers/auth";

test.afterAll(cleanupTestData);

test("an owner adds, edits and deletes a service", async ({ page }) => {
  const owner = await createTestUser();
  const ws = await createTestWorkspace(owner);
  await signIn(page, owner);
  await expect(page).toHaveURL(`/w/${ws.slug}`);
  await page.goto(`/w/${ws.slug}/services`);
  await expect(
    page.getByText(
      "No services yet. Add the first one your customers can book.",
    ),
  ).toBeVisible();

  await page.getByRole("button", { name: "Add service" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Balayage");
  await dialog.getByLabel("Category (optional)").fill("Colour");
  await dialog.getByLabel("Duration (minutes)").fill("180");
  await dialog.getByLabel("Price (optional)").fill("180");
  await dialog.getByLabel("Show as a starting price").check();
  await dialog.getByRole("button", { name: "Save service" }).click();
  const colour = page.getByRole("region", { name: "Colour" });
  await expect(colour.getByText("Balayage")).toBeVisible();
  await expect(colour.getByText("3 hr, From $180")).toBeVisible();

  await page.getByRole("button", { name: "Edit Balayage" }).click();
  await page.getByRole("dialog").getByLabel("Price (optional)").fill("195.50");
  await page.getByRole("button", { name: "Save service" }).click();
  await expect(colour.getByText("3 hr, From $195.50")).toBeVisible();

  await page.getByRole("button", { name: "Add service" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("balayage");
  await page.getByRole("button", { name: "Save service" }).click();
  await expect(
    page.getByText("You already have a service with that name."),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Delete Balayage" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(
    page.getByText(
      "No services yet. Add the first one your customers can book.",
    ),
  ).toBeVisible();
});

test("staff get a 404 on services", async ({ page }) => {
  const [owner, staff] = await Promise.all([
    createTestUser(),
    createTestUser(),
  ]);
  const ws = await createTestWorkspace(owner);
  await addTestMember(ws.id, staff, "staff");
  await signIn(page, staff);
  await expect(page).toHaveURL(`/w/${ws.slug}`);
  const response = await page.goto(`/w/${ws.slug}/services`);
  expect(response?.status()).toBe(404);
});
