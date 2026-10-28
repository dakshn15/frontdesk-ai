import { expect, test } from "@playwright/test";
import {
  cleanupTestData,
  createTestUser,
  createTestWorkspace,
} from "../helpers/seed";
import { testSql } from "../helpers/test-db";
import { signIn } from "./helpers/auth";

test.afterAll(cleanupTestData);

test("a trial shows its plan and limits, and an ended trial switches the chat to the contact form", async ({
  page,
}) => {
  const owner = await createTestUser();
  const ws = await createTestWorkspace(owner);

  await signIn(page, owner);
  await expect(page).toHaveURL(`/w/${ws.slug}`);
  await page.getByRole("link", { name: "Billing", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible();
  await expect(page.getByText("14 days left")).toBeVisible();
  await expect(page.getByText(/Billing isn't set up yet/)).toBeVisible();
  await expect(page.getByText("0 of 100")).toBeVisible();
  const starter = page.getByRole("listitem", { name: "Starter" });
  await expect(starter.getByText("500 website chats a month")).toBeVisible();
  await expect(
    starter.getByRole("button", { name: "Choose Starter" }),
  ).toBeDisabled();

  // Fifteen days later, the trial has ended.
  await testSql`update public.workspaces set created_at = now() - interval '15 days'
    where id = ${ws.id}`;
  await page.reload();
  await expect(
    page.getByText(/Your trial has ended, so your receptionist/),
  ).toBeVisible();
  await expect(page.getByText("Ended", { exact: true })).toBeVisible();

  // The website chat offers the contact form instead of the AI.
  await page.goto(`/widget/${ws.slug}`);
  await expect(
    page.getByRole("form", { name: "Leave your details" }),
  ).toBeVisible();
  await expect(page.getByLabel("Message", { exact: true })).toHaveCount(0);
});
