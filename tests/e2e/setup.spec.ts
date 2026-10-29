import { expect, test } from "@playwright/test";
import {
  addTestMember,
  cleanupTestData,
  createTestUser,
  createTestWorkspace,
} from "../helpers/seed";
import { signIn } from "./helpers/auth";

test.afterAll(cleanupTestData);

test("the setup checklist tracks progress", async ({ page }) => {
  const owner = await createTestUser();
  const ws = await createTestWorkspace(owner);
  await signIn(page, owner);
  await expect(page).toHaveURL(`/w/${ws.slug}`);
  const card = page.getByRole("region", { name: "Set up your receptionist" });
  await expect(card.getByText("1 of 7 done")).toBeVisible();

  await card.getByRole("link", { name: /^Services/ }).click();
  await expect(page).toHaveURL(`/w/${ws.slug}/services`);
  await page.getByRole("button", { name: "Add service" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Haircut");
  await dialog.getByRole("button", { name: "Save service" }).click();
  await expect(page.getByText("Haircut")).toBeVisible();

  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page).toHaveURL(`/w/${ws.slug}`);
  await expect(card.getByText("2 of 7 done")).toBeVisible();
  await expect(
    card.getByRole("link", { name: "Services (done)" }),
  ).toBeVisible();
});

test("staff don't see the checklist or the business pages", async ({
  page,
}) => {
  const [owner, member] = await Promise.all([
    createTestUser(),
    createTestUser(),
  ]);
  const ws = await createTestWorkspace(owner);
  await addTestMember(ws.id, member, "staff");
  await signIn(page, member);
  await expect(page).toHaveURL(`/w/${ws.slug}`);
  await expect(
    page.getByRole("heading", { name: /^Welcome to/ }),
  ).toBeVisible();
  await expect(page.getByText("Set up your receptionist")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Services", exact: true }),
  ).toHaveCount(0);
});
