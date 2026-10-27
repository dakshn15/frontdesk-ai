import { expect, test } from "@playwright/test";
import {
  cleanupTestData,
  createTestUser,
  createTestWorkspace,
} from "../helpers/seed";
import { testSql } from "../helpers/test-db";
import { signIn } from "./helpers/auth";

test.afterAll(cleanupTestData);

test("the preview answers from the business's knowledge and shows its source", async ({
  page,
}) => {
  const owner = await createTestUser();
  const ws = await createTestWorkspace(owner);
  const [source] = await testSql<{ id: string }[]>`
    insert into public.knowledge_sources (workspace_id, kind, title, status)
    values (${ws.id}, 'text', 'About us', 'ready') returning id`;
  await testSql`
    insert into public.knowledge_chunks (workspace_id, source_id, position, heading, content)
    values (${ws.id}, ${source.id}, 0, 'Parking', 'Free parking behind the salon.')`;

  await signIn(page, owner);
  await expect(page).toHaveURL(`/w/${ws.slug}`);
  await page.getByRole("link", { name: "Test lab", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Test lab" })).toBeVisible();

  await page.getByLabel("Message").fill("Is there parking?");
  await page.getByRole("button", { name: "Send" }).click();
  const conversation = page.getByRole("list", { name: "Conversation" });
  await expect(conversation.getByText("Is there parking?")).toBeVisible();
  await expect(
    conversation.getByText("Free parking behind the salon."),
  ).toBeVisible();
  await expect(
    conversation.getByText("Knowledge: About us › Parking"),
  ).toBeVisible();
  await expect(conversation.getByText("Used search_knowledge")).toBeVisible();

  // A follow-up continues the same conversation.
  await page.getByLabel("Message").fill("Do you sell gift cards?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(conversation.getByText(/I'm not sure about that/)).toBeVisible();
  const [{ count }] = await testSql<{ count: number }[]>`
    select count(*)::int as count from public.conversations
    where workspace_id = ${ws.id} and channel = 'preview'`;
  expect(count).toBe(1);

  await page.getByRole("button", { name: "Start over" }).click();
  await expect(conversation.getByText("Is there parking?")).toHaveCount(0);
});
