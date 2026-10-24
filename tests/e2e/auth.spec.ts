import { expect, test } from "@playwright/test";
import { cleanupTestData, createTestUser } from "../helpers/seed";
import { signIn } from "./helpers/auth";
import { latestEmailLink } from "./helpers/mailpit";

test.afterAll(cleanupTestData);

test("a new owner signs up and confirms their email", async ({ page }) => {
  const email = `owner-${Date.now()}@example.com`;
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill("Ana Lopez");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Check your inbox.")).toBeVisible();

  await page.goto(await latestEmailLink(email, "/auth/confirm"));
  await expect(page).toHaveURL("/onboarding");

  const name = `Bloom Hair & Beauty ${Date.now()}`;
  await page.getByLabel("Business name").fill(name);
  await page.getByLabel("Time zone").click();
  await page.getByPlaceholder("Search").fill("Chicago");
  await page.getByRole("option", { name: "America/Chicago" }).click();
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(/\/w\/bloom-hair-beauty-\d+$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(name);
});

test("sign-up keeps what you typed when a field is invalid", async ({
  page,
}) => {
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill("Ana Lopez");
  await page.getByLabel("Work email").fill("ana@example.com");
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
  await expect(page.getByLabel("Full name")).toHaveValue("Ana Lopez");
  await expect(page.getByLabel("Work email")).toHaveValue("ana@example.com");
});

test("sign-in explains a wrong password, then works", async ({ page }) => {
  const user = await createTestUser();
  await signIn(page, { email: user.email, password: "WrongPassword1" });
  await expect(
    page.getByText("That email and password don't match."),
  ).toBeVisible();

  await signIn(page, user);
  await expect(page).toHaveURL("/onboarding");
});

test("a user resets a forgotten password", async ({ page }) => {
  const user = await createTestUser();
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(user.email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(
    page.getByText(
      "If there's an account for that email, we've sent a reset link.",
    ),
  ).toBeVisible();

  await page.goto(await latestEmailLink(user.email, "/auth/confirm"));
  await expect(page).toHaveURL("/account/update-password");
  await page.getByLabel("New password").fill("NewPassword456!");
  await page.getByLabel("Confirm password").fill("NewPassword456!");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page).toHaveURL("/onboarding");

  await page.request.post("/auth/sign-out");
  await signIn(page, { email: user.email, password: "NewPassword456!" });
  await expect(page).toHaveURL("/onboarding");
});
