import { expect, test } from "@playwright/test";
import {
  cleanupTestData,
  createTestUser,
  createTestWorkspace,
} from "../helpers/seed";
import { testSql } from "../helpers/test-db";
import { signIn } from "./helpers/auth";

test.afterAll(cleanupTestData);

test("the playground shows how an answer was made, and tests run with reasons", async ({
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

  // The inspector explains the latest reply.
  await page.getByLabel("Message").fill("Is there parking?");
  await page.getByRole("button", { name: "Send" }).click();
  const inspector = page.getByRole("complementary", {
    name: "How this answer was made",
  });
  await expect(
    inspector.getByText("Matched the question's words."),
  ).toBeVisible();
  await expect(inspector.getByText("About us › Parking")).toBeVisible();
  await expect(inspector.getByText("Searched knowledge")).toBeVisible();
  await expect(inspector.getByText("fake scripted")).toBeVisible();

  // "Fix this answer" saves a verified answer.
  await inspector.getByRole("button", { name: "Fix this answer" }).click();
  const fix = page.getByRole("dialog");
  await fix
    .getByLabel("Answer")
    .fill("Yes, free parking behind the salon, entered from Elizabeth Street.");
  await fix.getByRole("button", { name: "Save verified answer" }).click();
  await expect(page.getByText("Saved as a verified answer.")).toBeVisible();
  const answers = await testSql<{ question: string }[]>`
    select question from public.verified_answers where workspace_id = ${ws.id}`;
  expect(answers).toEqual([{ question: "Is there parking?" }]);

  // Two tests: one the scripted receptionist passes, one it fails.
  await page.getByRole("link", { name: "Tests", exact: true }).click();
  const add = async (question: string, fill: () => Promise<unknown>) => {
    await page.getByRole("button", { name: "Add test" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Question").fill(question);
    await fill();
    await dialog.getByRole("button", { name: "Add test" }).click();
    await expect(dialog).toBeHidden();
  };
  await add("Is there parking?", () =>
    page
      .getByRole("dialog")
      .getByLabel("Must mention")
      .fill("behind the salon"),
  );
  await add("Do you sell gift cards?", () =>
    page
      .getByRole("dialog")
      .getByLabel("Must use")
      .selectOption("find_verified_answer"),
  );
  const tests = page.getByRole("list", { name: "Tests" });
  await expect(tests.getByText('Mentions "behind the salon"')).toBeVisible();

  await page.getByRole("button", { name: "Run all tests" }).click();
  await expect(
    page.getByRole("heading", { name: "1 of 2 passed" }),
  ).toBeVisible({
    timeout: 30_000,
  });
  const results = page.getByRole("list", { name: "Results" });
  await expect(
    results.getByText("It didn't use find_verified_answer."),
  ).toBeVisible();

  await page.getByRole("link", { name: "Tests", exact: true }).click();
  await expect(
    page.getByRole("list", { name: "Past runs" }).getByText("1 of 2 passed"),
  ).toBeVisible();
});
