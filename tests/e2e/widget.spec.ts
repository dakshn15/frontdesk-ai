import { expect, test } from "@playwright/test";
import {
  cleanupTestData,
  createTestService,
  createTestStaff,
  createTestUser,
  createTestWorkspace,
  linkTestStaffService,
  setTestStaffHours,
} from "../helpers/seed";
import { testSql } from "../helpers/test-db";

test.afterAll(cleanupTestData);

// The stand-in website has no real address, so Chrome would treat it as public and block
// its request to the local app. Real sites and the deployed app are both public.
test.use({
  launchOptions: { args: ["--disable-features=LocalNetworkAccessChecks"] },
});

test("the embed script adds the chat to a website, and it answers", async ({
  page,
  baseURL,
}) => {
  const owner = await createTestUser();
  const ws = await createTestWorkspace(owner);
  const [source] = await testSql<{ id: string }[]>`
    insert into public.knowledge_sources (workspace_id, kind, title, status)
    values (${ws.id}, 'text', 'About us', 'ready') returning id`;
  await testSql`
    insert into public.knowledge_chunks (workspace_id, source_id, position, heading, content)
    values (${ws.id}, ${source.id}, 0, 'Parking', 'Free parking behind the salon.')`;

  // A stand-in for the business's own website.
  await page.route("http://salon.localhost/", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><title>Salon</title><h1>Welcome to the salon</h1>
        <script src="${baseURL}/embed.js" data-workspace="${ws.slug}" async></script>`,
    }),
  );
  await page.goto("http://salon.localhost/");
  const frame = page.locator('iframe[title="Chat"]');
  await expect(frame).toHaveAttribute("src", `${baseURL}/widget/${ws.slug}`);
  const chat = frame.contentFrame();
  await chat.getByRole("button", { name: "Chat with Assistant" }).click();
  await expect.poll(async () => (await frame.boundingBox())?.width).toBe(416);

  await chat.getByLabel("Message").fill("Is there parking?");
  await chat.getByRole("button", { name: "Send" }).click();
  const conversation = chat.getByRole("list", { name: "Conversation" });
  await expect(
    conversation.getByText("Free parking behind the salon."),
  ).toBeVisible();
  await expect(
    conversation.getByText("From our info: About us › Parking"),
  ).toBeVisible();

  await chat.getByRole("button", { name: "Close chat" }).click();
  await expect.poll(async () => (await frame.boundingBox())?.width).toBe(88);

  // Allowed domains turn into a frame-ancestors policy on the chat page.
  await testSql`update public.workspaces set allowed_domains = '{bloomsalon.com}'
    where id = ${ws.id}`;
  const response = await page.request.get(`/widget/${ws.slug}`);
  expect(response.headers()["content-security-policy"]).toBe(
    "frame-ancestors 'self' https://bloomsalon.com https://*.bloomsalon.com",
  );
});

test("a visitor books an offered time, and the transcript survives a reload", async ({
  page,
}) => {
  const owner = await createTestUser();
  const ws = await createTestWorkspace(owner);
  const { id: cut } = await createTestService(ws.id, owner, {
    name: "Cut",
    priceCents: 4500,
  });
  const { id: maya } = await createTestStaff(ws.id, owner, { name: "Maya" });
  await setTestStaffHours(
    ws.id,
    owner,
    maya,
    [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
      weekday,
      startMinute: 540,
      endMinute: 1020,
    })),
  );
  await linkTestStaffService(ws.id, owner, maya, cut);

  // Opened on its own, as the dashboard's "Try it" does.
  await page.goto(`/widget/${ws.slug}`);
  await page.getByLabel("Message").fill("I'd like to book a cut");
  await page.getByRole("button", { name: "Send" }).click();
  const card = page.getByRole("region", { name: "Booking: Cut" });
  await expect(card.getByText("Cut with Maya")).toBeVisible();
  await card.getByRole("button", { name: "Book this time" }).click();
  await card.getByLabel("Email").fill("not an email");
  await card.getByRole("button", { name: "Confirm booking" }).click();
  await expect(card.getByText("Add your name.")).toBeVisible();
  await card.getByLabel("Name").fill("Ana Diaz");
  await card.getByLabel("Email").fill("ana@example.com");
  await card.getByRole("button", { name: "Confirm booking" }).click();
  const conversation = page.getByRole("list", { name: "Conversation" });
  await expect(
    conversation.getByText(/^You're booked: Cut with Maya/),
  ).toBeVisible();

  const rows = await testSql<{ source: string }[]>`
    select source from public.bookings where workspace_id = ${ws.id}`;
  expect(rows).toEqual([{ source: "widget" }]);

  await page.reload();
  await expect(conversation.getByText("I'd like to book a cut")).toBeVisible();
  await expect(
    conversation.getByText(/^You're booked: Cut with Maya/),
  ).toBeVisible();

  await page.getByRole("button", { name: "Leave your details" }).click();
  const lead = page.getByRole("form", { name: "Leave your details" });
  await lead.getByLabel("Name").fill("Ana Diaz");
  await lead.getByLabel("Email").fill("ana@example.com");
  await lead.getByLabel("Message (optional)").fill("Bridal party in May");
  await lead.getByRole("button", { name: "Send" }).click();
  await expect(
    page.getByText("Thanks. The team will get back to you by email."),
  ).toBeVisible();
});
