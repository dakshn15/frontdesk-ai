import { expect, test } from "@playwright/test";
import { testSql } from "../helpers/test-db";

const slugs: string[] = [];

// Locally every run comes from the same address, so start under the per-address limit.
test.beforeAll(async () => {
  await testSql`delete from public.rate_limit_windows where key like 'demo:ip:%'`;
});

// Sandboxes aren't made by the test helpers, so this file removes its own.
test.afterAll(async () => {
  for (const slug of slugs) {
    const owners = await testSql<{ user_id: string }[]>`
      select m.user_id from public.memberships m
      join public.workspaces w on w.id = m.workspace_id where w.slug = ${slug}`;
    await testSql`delete from public.workspaces where slug = ${slug}`;
    for (const { user_id } of owners)
      await testSql`delete from auth.users where id = ${user_id} and is_anonymous`;
  }
});

test("a visitor starts the demo, chats on the salon's site and runs its dashboard", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Try the live demo" }).click();
  await page.getByRole("button", { name: "Start the demo" }).click();
  await expect(page).toHaveURL(/\/demo\/bloom-[0-9a-f]{10}$/, {
    timeout: 30_000,
  });
  const slug = new URL(page.url()).pathname.split("/").at(-1)!;
  slugs.push(slug);

  // The salon's own website, with its prices and team from the sandbox.
  await expect(
    page.getByRole("heading", { level: 1, name: "Bloom" }),
  ).toBeVisible();
  await expect(page.getByText("Balayage", { exact: true })).toBeVisible();
  await expect(page.getByText("Maya Torres")).toBeVisible();

  // A suggested question opens the chat and asks it.
  await page.getByRole("button", { name: "Do you have parking?" }).click();
  const chat = page.locator('iframe[title="Chat"]').contentFrame();
  await expect(chat.getByText(/Guest parking is behind the salon/)).toBeVisible(
    // The chat loads after the salon page and its photos, so its first answer can take a while.
    { timeout: 30_000 },
  );

  await page.getByRole("link", { name: "Open the dashboard" }).click();
  await expect(page).toHaveURL(`/w/${slug}`);
  await expect(page.getByText(/This is your private demo copy/)).toBeVisible();

  // Seeded chats are in the inbox, with the new one from the website.
  await page.goto(`/w/${slug}/inbox`);
  const list = page.getByRole("list", { name: "Conversations" });
  await expect(list.getByText("Hannah Kim")).toBeVisible();
  await expect(list.getByText("Needs a person")).toBeVisible();
  await expect(
    list.getByText(/Guest parking is behind the salon/),
  ).toBeVisible();

  // Its emails are in the outbox, not sent.
  await page.goto(`/w/${slug}/emails`);
  await expect(
    page.getByText("Your appointment at Bloom Hair & Beauty is booked").first(),
  ).toBeVisible();

  // A month of analytics: tiles, charts and topics.
  await page.goto(`/w/${slug}/analytics`);
  await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
  const topics = page.getByRole("region", { name: "Top topics" });
  await expect(topics.getByText("Booking", { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "AI cost per day" })
      .locator("svg")
      .first(),
  ).toBeVisible();
  await expect(page.getByText("openai gpt-5.4-mini")).toBeVisible();

  // Team invites are off in the demo.
  await page.goto(`/w/${slug}/team`);
  await page.getByRole("button", { name: "Invite teammate" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email").fill("friend@example.com");
  await dialog.getByRole("button", { name: "Create invite link" }).click();
  await expect(
    dialog.getByText("Team invites are turned off in the demo."),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  // Coming back to /demo returns to the same copy.
  await page.goto("/demo");
  await page.getByRole("link", { name: "Go back to your demo" }).click();
  await expect(page).toHaveURL(`/demo/${slug}`);
});
