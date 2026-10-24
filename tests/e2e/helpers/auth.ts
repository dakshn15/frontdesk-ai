import type { Page } from "@playwright/test";

export async function signIn(
  page: Page,
  user: { email: string; password: string },
  opts: { next?: string } = {},
): Promise<void> {
  const query = opts.next ? `?next=${encodeURIComponent(opts.next)}` : "";
  await page.goto(`/sign-in${query}`);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}
