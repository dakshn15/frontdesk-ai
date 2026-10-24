import { expect, test } from "@playwright/test";
import {
  addTestMember,
  cleanupTestData,
  createTestUser,
  createTestWorkspace,
} from "../helpers/seed";
import { signIn } from "./helpers/auth";

test.afterAll(cleanupTestData);

test("switches between workspaces and remembers the last one", async ({
  page,
}) => {
  const user = await createTestUser({ fullName: "Ana Lopez" });
  const north = await createTestWorkspace(user, { name: "North Salon" });
  const south = await createTestWorkspace(user, { name: "South Spa" });

  await signIn(page, user);
  await expect(page).toHaveURL(`/w/${north.slug}`);

  await page.getByRole("button", { name: /Switch workspace/ }).click();
  await page.getByRole("menuitem", { name: /South Spa/ }).click();
  await expect(page).toHaveURL(`/w/${south.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Welcome to South Spa",
  );

  await page.goto("/dashboard");
  await expect(page).toHaveURL(`/w/${south.slug}`);
});

test("on a phone, the menu opens from the top bar", async ({ page }) => {
  const user = await createTestUser();
  const ws = await createTestWorkspace(user);
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, user);
  await expect(page).toHaveURL(`/w/${ws.slug}`);

  const team = page.getByRole("link", { name: "Team", exact: true });
  await expect(team).toBeHidden();
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await expect(team).toBeVisible();
});

test("staff don't see Settings", async ({ page }) => {
  const [owner, staff] = await Promise.all([
    createTestUser(),
    createTestUser(),
  ]);
  const ws = await createTestWorkspace(owner);
  await addTestMember(ws.id, staff, "staff");

  await signIn(page, staff);
  await expect(page).toHaveURL(`/w/${ws.slug}`);
  await expect(
    page.getByRole("link", { name: "Team", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Settings", exact: true }),
  ).toHaveCount(0);
});
