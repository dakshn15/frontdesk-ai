import { expect, test } from "@playwright/test";
import {
  addTestMember,
  cleanupTestData,
  createTestUser,
  createTestWorkspace,
} from "../helpers/seed";
import { signIn } from "./helpers/auth";

test.afterAll(cleanupTestData);

test("an owner renames the workspace", async ({ page }) => {
  const owner = await createTestUser();
  const ws = await createTestWorkspace(owner, { name: "Old Name Salon" });
  await signIn(page, owner);
  await expect(page).toHaveURL(`/w/${ws.slug}`);

  await page.goto(`/w/${ws.slug}/settings`);
  await page.getByLabel("Business name").fill("New Name Salon");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("button", { name: /current: New Name Salon/ }),
  ).toBeVisible();
});

test("an owner saves and removes their own AI key", async ({ page }) => {
  const owner = await createTestUser();
  const ws = await createTestWorkspace(owner);
  await signIn(page, owner);
  await expect(page).toHaveURL(`/w/${ws.slug}`);

  await page.goto(`/w/${ws.slug}/settings`);
  const keys = page.getByRole("region", { name: "AI keys" });
  await keys.getByLabel("OpenAI key").fill("not-a-key");
  await keys.getByRole("button", { name: "Check and save" }).first().click();
  await expect(keys.getByText('OpenAI keys start with "sk-".')).toBeVisible();

  await keys.getByLabel("OpenAI key").fill("sk-test-e2e-4321");
  await keys.getByRole("button", { name: "Check and save" }).first().click();
  await expect(keys.getByText("Saved key ending in 4321")).toBeVisible();
  // The key itself is never sent back to the page.
  expect(await page.content()).not.toContain("sk-test-e2e-4321");

  await page.goto(`/w/${ws.slug}`);
  await expect(
    page
      .getByRole("region", { name: "Set up your receptionist" })
      .getByRole("link", { name: "AI key (done)" }),
  ).toBeVisible();

  await page.goto(`/w/${ws.slug}/settings`);
  await keys.getByRole("button", { name: "Remove key" }).click();
  await expect(keys.getByText("No key saved").first()).toBeVisible();
  await expect(keys.getByText("Saved key ending in 4321")).toHaveCount(0);
});

test("staff get a 404 on settings", async ({ page }) => {
  const [owner, staff] = await Promise.all([
    createTestUser(),
    createTestUser(),
  ]);
  const ws = await createTestWorkspace(owner);
  await addTestMember(ws.id, staff, "staff");
  await signIn(page, staff);
  await expect(page).toHaveURL(`/w/${ws.slug}`);

  const response = await page.goto(`/w/${ws.slug}/settings`);
  expect(response?.status()).toBe(404);
});

test("an owner deletes the workspace after typing its name", async ({
  page,
}) => {
  const owner = await createTestUser();
  const ws = await createTestWorkspace(owner, { name: "Doomed Salon" });
  await signIn(page, owner);
  await expect(page).toHaveURL(`/w/${ws.slug}`);

  await page.goto(`/w/${ws.slug}/settings`);
  await page.getByRole("button", { name: "Delete workspace" }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByLabel("Type Doomed Salon to confirm").fill("Doomed");
  await dialog.getByRole("button", { name: "Delete workspace" }).click();
  await expect(
    dialog.getByText("Type the workspace name exactly to confirm."),
  ).toBeVisible();

  await dialog.getByLabel("Type Doomed Salon to confirm").fill("Doomed Salon");
  await dialog.getByRole("button", { name: "Delete workspace" }).click();
  await expect(page).toHaveURL("/onboarding");
});
