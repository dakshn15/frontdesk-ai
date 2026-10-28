import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import {
  cleanupTestData,
  createTestUser,
  createTestWorkspace,
} from "../helpers/seed";
import { testSql } from "../helpers/test-db";
import { signIn } from "./helpers/auth";

const ADMIN_EMAIL = "platform-admin@frontdesk.test";
const slugs: string[] = [];

test.beforeAll(async () => {
  await testSql`delete from public.rate_limit_windows where key like 'demo:ip:%'`;
});

test.afterAll(async () => {
  for (const slug of slugs)
    await testSql`delete from public.workspaces where slug = ${slug}`;
  await cleanupTestData();
});

/** Serious and critical WCAG 2.1 A and AA problems on the page, as readable lines. */
async function accessibilityProblems(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${page.url()}: ${v.id} (${v.impact}) ${v.help}: ${v.nodes
          .slice(0, 3)
          .map((node) => `${node.target.join(" ")} ${node.html.slice(0, 160)}`)
          .join(", ")}`,
    );
}

test("responses carry security headers; only the widget page can be framed", async ({
  page,
}) => {
  const home = await page.request.get("/");
  const headers = home.headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["content-security-policy"]).toContain(
    "frame-ancestors 'self'",
  );
  expect(headers["x-frame-options"]).toBe("SAMEORIGIN");
  expect(headers["x-powered-by"]).toBeUndefined();

  const owner = await createTestUser();
  const ws = await createTestWorkspace(owner);
  const widget = await page.request.get(`/widget/${ws.slug}`);
  expect(widget.headers()["x-frame-options"]).toBeUndefined();
  expect(widget.headers()["content-security-policy"]).toBeUndefined();
});

test("the platform admin page is for platform admins only", async ({
  page,
}) => {
  const someone = await createTestUser();
  await createTestWorkspace(someone, { name: "Ordinary Salon" });
  await signIn(page, someone);
  await expect(page).toHaveURL(/\/w\//);
  const refused = await page.goto("/admin");
  expect(refused?.status()).toBe(404);

  await page.context().clearCookies();
  // The admin email is fixed, so remove what an earlier run may have left: the
  // workspaces first, since the database won't remove a workspace's last owner.
  await testSql`delete from public.workspaces where created_by in
    (select id from auth.users where email = ${ADMIN_EMAIL})`;
  await testSql`delete from auth.users where email = ${ADMIN_EMAIL}`;
  const admin = await createTestUser({ email: ADMIN_EMAIL });
  await createTestWorkspace(admin, { name: "Admin Salon" });
  await signIn(page, admin);
  await expect(page).toHaveURL(/\/w\//);
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Platform admin" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: /Ordinary Salon/ }),
  ).toBeVisible();
  expect(await accessibilityProblems(page)).toEqual([]);
});

test("the main pages have no serious accessibility problems", async ({
  page,
}) => {
  // Sixteen pages in one go.
  test.setTimeout(180_000);
  const problems: string[] = [];
  for (const path of ["/", "/sign-in", "/sign-up", "/demo"]) {
    await page.goto(path);
    problems.push(...(await accessibilityProblems(page)));
  }

  // A demo copy gives a signed-in owner with data on every page.
  await page.goto("/demo");
  await page.getByRole("button", { name: "Start the demo" }).click();
  await expect(page).toHaveURL(/\/demo\/bloom-/, { timeout: 30_000 });
  const slug = new URL(page.url()).pathname.split("/").at(-1)!;
  slugs.push(slug);
  await page.locator('iframe[title="Chat"]').waitFor();
  problems.push(...(await accessibilityProblems(page)));

  for (const path of [
    `/widget/${slug}`,
    `/w/${slug}`,
    `/w/${slug}/calendar`,
    `/w/${slug}/inbox`,
    `/w/${slug}/analytics`,
    `/w/${slug}/assistant`,
    `/w/${slug}/assistant/tests`,
    `/w/${slug}/billing`,
    `/w/${slug}/services`,
    `/w/${slug}/knowledge`,
    `/w/${slug}/widget`,
    `/w/${slug}/settings`,
  ]) {
    await page.goto(path);
    await page.waitForLoadState("load");
    problems.push(...(await accessibilityProblems(page)));
  }
  expect(problems).toEqual([]);
});
