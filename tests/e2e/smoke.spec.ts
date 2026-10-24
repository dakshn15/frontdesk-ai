import { expect, test } from "@playwright/test";

test("the landing page explains the product and links to sign-up", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle("FrontDesk AI");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "The AI front desk that never guesses.",
  );
  await expect(
    page.getByRole("link", { name: "Create your workspace" }),
  ).toHaveAttribute("href", "/sign-up");
});

test("the page never scrolls sideways", async ({ page }) => {
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("the theme toggle switches to dark", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Change theme" }).click();
  await page.getByRole("menuitem", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
});
