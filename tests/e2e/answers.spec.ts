import { expect, test } from "@playwright/test";
import {
  cleanupTestData,
  createTestUser,
  createTestWorkspace,
} from "../helpers/seed";
import { signIn } from "./helpers/auth";

test.afterAll(cleanupTestData);

const QUESTION = "Do you do bridal hair?";

test("an owner adds, finds, edits and deletes an answer", async ({ page }) => {
  const owner = await createTestUser();
  const ws = await createTestWorkspace(owner);
  await signIn(page, owner);
  await expect(page).toHaveURL(`/w/${ws.slug}`);
  await page.goto(`/w/${ws.slug}/answers`);
  await expect(page.getByText("No verified answers yet.")).toBeVisible();

  await page.getByRole("button", { name: "Add answer" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Question").fill(QUESTION);
  await dialog.getByLabel("Answer").fill("Yes, with a trial two weeks before.");
  await dialog.getByRole("button", { name: "Save answer" }).click();
  const list = page.getByRole("list", { name: "Verified answers" });
  await expect(list.getByText(QUESTION)).toBeVisible();

  // The same question again, in a different case.
  await page.getByRole("button", { name: "Add answer" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Question").fill("do you do BRIDAL hair?");
  await dialog.getByLabel("Answer").fill("Maybe.");
  await dialog.getByRole("button", { name: "Save answer" }).click();
  await expect(
    dialog.getByText("You already have an answer for this question."),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  const search = page.getByLabel("Search answers");
  await search.fill("bridal");
  await expect(list.getByText(QUESTION)).toBeVisible();
  await search.fill("parking");
  await expect(page.getByText(QUESTION)).toHaveCount(0);
  await expect(page.getByText("No answers match")).toBeVisible();
  await search.fill("");

  await page.getByRole("button", { name: `Edit answer: ${QUESTION}` }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Answer").fill("Yes. Book a trial first.");
  await dialog.getByRole("button", { name: "Save answer" }).click();
  await expect(list.getByText("Yes. Book a trial first.")).toBeVisible();
  await page.reload();
  await expect(list.getByText("Yes. Book a trial first.")).toBeVisible();

  await page
    .getByRole("button", { name: `Delete answer: ${QUESTION}` })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByText("No verified answers yet.")).toBeVisible();
});
