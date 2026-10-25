import { expect, test } from "@playwright/test";

test("signed-out visitors go to sign-in with a return path", async ({
  page,
}) => {
  await page.goto("/w/some-salon/team");
  await expect(page).toHaveURL("/sign-in?next=%2Fw%2Fsome-salon%2Fteam");
});

test("a bad confirmation link shows a helpful error", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=nope&type=email");
  await expect(page).toHaveURL("/auth/error?reason=link");
  await expect(
    page.getByText("That link has expired or was already used."),
  ).toBeVisible();
});

test("an email return link without a sign-in explains what to do", async ({
  page,
}) => {
  await page.goto("/auth/callback?next=%2Fdashboard");
  await expect(page).toHaveURL("/auth/error?reason=callback");
  await expect(
    page.getByText("open it in the same browser you signed up in"),
  ).toBeVisible();
});
