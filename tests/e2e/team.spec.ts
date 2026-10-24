import { expect, test } from "@playwright/test";
import {
  cleanupTestData,
  createTestInvite,
  createTestUser,
  createTestWorkspace,
} from "../helpers/seed";
import { signIn } from "./helpers/auth";
import { latestEmailLink } from "./helpers/mailpit";

test.afterAll(cleanupTestData);

test("owner invites someone who already has an account", async ({
  page,
  browser,
}) => {
  const [owner, invitee] = await Promise.all([
    createTestUser({ fullName: "Ana Lopez" }),
    createTestUser({ fullName: "Dan Park" }),
  ]);
  const ws = await createTestWorkspace(owner, { name: "Invite Salon" });
  await signIn(page, owner);
  await expect(page).toHaveURL(`/w/${ws.slug}`);

  await page.goto(`/w/${ws.slug}/team`);
  await page.getByRole("button", { name: "Invite teammate" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email").fill(invitee.email);
  await dialog.getByRole("button", { name: "Create invite link" }).click();
  const link = await dialog.getByLabel("Invite link").inputValue();
  const invitePath = new URL(link).pathname;

  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
  });
  const other = await context.newPage();
  await other.goto(invitePath);
  await expect(other.getByText("Ana Lopez invited you")).toBeVisible();
  await other.getByRole("link", { name: "Sign in to accept" }).click();
  await other.getByLabel("Email").fill(invitee.email);
  await other.getByLabel("Password", { exact: true }).fill(invitee.password);
  await other.getByRole("button", { name: "Sign in" }).click();
  await expect(other).toHaveURL(invitePath);

  await other.getByRole("button", { name: "Accept and join" }).click();
  await expect(other).toHaveURL(`/w/${ws.slug}`);
  await expect(
    other.getByRole("link", { name: "Settings", exact: true }),
  ).toHaveCount(0);
  await context.close();
});

test("new user signs up from an invite and joins", async ({ page }) => {
  const owner = await createTestUser({ fullName: "Ana Lopez" });
  const ws = await createTestWorkspace(owner);
  const email = `joiner-${Date.now()}@example.com`;
  const { token } = await createTestInvite(ws.id, owner, {
    email,
    role: "staff",
  });

  await page.goto(`/invite/${token}`);
  await page.getByRole("link", { name: "Create an account" }).click();
  await page.getByLabel("Full name").fill("Joe Joiner");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Check your inbox.")).toBeVisible();

  await page.goto(await latestEmailLink(email, "/auth/confirm"));
  await expect(page).toHaveURL(`/invite/${token}`);
  await page.getByRole("button", { name: "Accept and join" }).click();
  await expect(page).toHaveURL(`/w/${ws.slug}`);
});

test("the wrong account sees who the invite is for", async ({ page }) => {
  const [owner, someoneElse] = await Promise.all([
    createTestUser(),
    createTestUser(),
  ]);
  const ws = await createTestWorkspace(owner);
  const email = `intended-${Date.now()}@example.com`;
  const { token } = await createTestInvite(ws.id, owner, {
    email,
    role: "staff",
  });

  await signIn(page, someoneElse);
  await expect(page).toHaveURL("/onboarding");
  await page.goto(`/invite/${token}`);
  await expect(
    page.getByText(`This invite was sent to ${email}.`),
  ).toBeVisible();
});

test("owner revokes a pending invite", async ({ page }) => {
  const owner = await createTestUser();
  const ws = await createTestWorkspace(owner);
  const email = `revoked-${Date.now()}@example.com`;
  const { token } = await createTestInvite(ws.id, owner, {
    email,
    role: "staff",
  });

  await signIn(page, owner);
  await expect(page).toHaveURL(`/w/${ws.slug}`);
  await page.goto(`/w/${ws.slug}/team`);
  await expect(page.getByText(email)).toBeVisible();
  await page.getByRole("button", { name: "Revoke" }).click();
  await expect(page.getByText(email)).toHaveCount(0);

  await page.goto(`/invite/${token}`);
  await expect(page.getByText("This invite was cancelled.")).toBeVisible();
});
