import { expect, test } from "@playwright/test";
import {
  cleanupTestData,
  createTestUser,
  createTestWorkspace,
} from "../helpers/seed";
import { signIn } from "./helpers/auth";

test.afterAll(cleanupTestData);

test("staff take over a handed-off chat live and the visitor sees their reply", async ({
  page,
  browser,
}) => {
  const owner = await createTestUser({ fullName: "Ana Diaz" });
  const ws = await createTestWorkspace(owner);

  await signIn(page, owner);
  await expect(page).toHaveURL(`/w/${ws.slug}`);
  await page.getByRole("link", { name: "Inbox", exact: true }).click();
  await expect(page.getByText("No conversations yet.")).toBeVisible();

  // A visitor on the website asks for a person.
  const visitor = await browser.newPage();
  await visitor.goto(`/widget/${ws.slug}`);
  await visitor.getByLabel("Message").fill("Can I talk to a person?");
  await visitor.getByRole("button", { name: "Send" }).click();
  await expect(
    visitor.getByText("A team member will reply here as soon as they can."),
  ).toBeVisible();

  // The inbox shows it without a reload, and the nav counts it.
  const list = page.getByRole("list", { name: "Conversations" });
  await expect(list.getByText("Needs a person")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByLabel("1 waiting")).toBeVisible();
  await list.getByRole("link").first().click();
  const transcript = page.getByRole("list", { name: "Transcript" });
  await expect(transcript.getByText("Can I talk to a person?")).toBeVisible();
  await expect(transcript.getByText("Handed off to the team")).toBeVisible();

  await page.getByRole("button", { name: "Take over" }).click();
  await page.getByLabel("Reply").fill("Hi, I'm Ana. How can I help?");
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(
    transcript.getByText("Hi, I'm Ana. How can I help?"),
  ).toBeVisible();

  // The widget picks up the reply.
  const chat = visitor.getByRole("list", { name: "Conversation" });
  await expect(chat.getByText("Hi, I'm Ana. How can I help?")).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    chat.getByText("Ana from the team", { exact: true }),
  ).toBeVisible();
  await expect(
    visitor.getByText("You're chatting with Ana from the team."),
  ).toBeVisible();

  // The visitor answers; it reaches the transcript live, and the AI stays quiet.
  await visitor.getByLabel("Message").fill("Do you have anything on Friday?");
  await visitor.getByRole("button", { name: "Send" }).click();
  await expect(
    transcript.getByText("Do you have anything on Friday?"),
  ).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Hand back to AI" }).click();
  await expect(
    visitor.getByText("You're chatting with Ana from the team."),
  ).toHaveCount(0, { timeout: 15_000 });
  await visitor.close();
});
