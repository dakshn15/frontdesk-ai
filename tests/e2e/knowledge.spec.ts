import { expect, test } from "@playwright/test";
import {
  addTestMember,
  cleanupTestData,
  createTestUser,
  createTestWorkspace,
} from "../helpers/seed";
import { signIn } from "./helpers/auth";

test.afterAll(cleanupTestData);

test("an owner adds text and finds it with a search", async ({ page }) => {
  const owner = await createTestUser();
  const ws = await createTestWorkspace(owner);
  await signIn(page, owner);
  await expect(page).toHaveURL(`/w/${ws.slug}`);
  await page.goto(`/w/${ws.slug}/knowledge`);
  await expect(
    page.getByText(
      "No knowledge yet. Add a document, a web page or some text.",
    ),
  ).toBeVisible();

  await page.getByRole("button", { name: "Add knowledge" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByText("Paste text", { exact: true }).click();
  await dialog.getByLabel("Title").fill("About us");
  await dialog
    .getByLabel("Text", { exact: true })
    .fill("# Parking\nWe have free parking behind the salon.");
  await dialog.getByRole("button", { name: "Add knowledge" }).click();

  const sources = page.getByRole("list", { name: "Knowledge sources" });
  await expect(sources.getByText("About us")).toBeVisible();
  // Processing runs after the response; the list refreshes until it's ready.
  await expect(sources.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(sources.getByText(/1 passage/)).toBeVisible();

  await page.getByLabel("Search knowledge").fill("where do I park");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const results = page.getByRole("list", { name: "Matching passages" });
  await expect(
    results.getByText("We have free parking behind the salon."),
  ).toBeVisible();
  await expect(results.getByText("About us › Parking")).toBeVisible();

  await page.getByLabel("Search knowledge").fill("wedding cakes");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("No matching passages.")).toBeVisible();
});

test("a web address that isn't public fails with a reason", async ({
  page,
}) => {
  const owner = await createTestUser();
  const ws = await createTestWorkspace(owner);
  await signIn(page, owner);
  await expect(page).toHaveURL(`/w/${ws.slug}`);
  await page.goto(`/w/${ws.slug}/knowledge`);
  await page.getByRole("button", { name: "Add knowledge" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByText("Web page", { exact: true }).click();
  await dialog.getByLabel("Web address").fill("http://127.0.0.1:3300/");
  await dialog.getByRole("button", { name: "Add knowledge" }).click();
  const sources = page.getByRole("list", { name: "Knowledge sources" });
  await expect(sources.getByText("Failed", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    sources.getByText("We can't fetch pages from that address."),
  ).toBeVisible();
});

test("staff get a 404 on knowledge", async ({ page }) => {
  const [owner, member] = await Promise.all([
    createTestUser(),
    createTestUser(),
  ]);
  const ws = await createTestWorkspace(owner);
  await addTestMember(ws.id, member, "staff");
  await signIn(page, member);
  await expect(page).toHaveURL(`/w/${ws.slug}`);
  const response = await page.goto(`/w/${ws.slug}/knowledge`);
  expect(response?.status()).toBe(404);
});
