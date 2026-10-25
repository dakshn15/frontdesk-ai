import { expect, test } from "@playwright/test";
import { addDays, localDate } from "@/lib/clock";
import {
  addTestMember,
  cleanupTestData,
  createTestService,
  createTestStaff,
  createTestUser,
  createTestWorkspace,
  linkTestStaffService,
  setTestStaffHours,
} from "../helpers/seed";
import { testSql } from "../helpers/test-db";
import { signIn } from "./helpers/auth";

test.afterAll(cleanupTestData);

// A week ahead: inside the customer booking window, so the manage link can reschedule.
const DATE = addDays(localDate("America/Chicago"), 7);
const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
  weekday,
  startMinute: 540,
  endMinute: 1020,
}));

async function salon() {
  const owner = await createTestUser();
  const ws = await createTestWorkspace(owner, { name: "Bloom Studio" });
  const { id: cut } = await createTestService(ws.id, owner, { name: "Cut" });
  const { id: maya } = await createTestStaff(ws.id, owner, { name: "Maya" });
  await setTestStaffHours(ws.id, owner, maya, EVERY_DAY);
  await linkTestStaffService(ws.id, owner, maya, cut);
  return { owner, ws };
}

test("book, move and cancel an appointment", async ({ page }) => {
  // Three dialogs, two emails and a public page.
  test.slow();
  const { owner, ws } = await salon();
  await signIn(page, owner);
  await expect(page).toHaveURL(`/w/${ws.slug}`);
  await page.goto(`/w/${ws.slug}/calendar?date=${DATE}`);
  await expect(page.getByText("Maya", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "New booking" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "9:00 AM", exact: true }).click();
  await dialog.getByLabel("Customer name").fill("Ana Ruiz");
  await dialog.getByLabel("Email").fill("ana@example.com");
  await dialog.getByRole("button", { name: "Book appointment" }).click();
  await expect(page.getByText("Booked.")).toBeVisible();
  const block = page.getByRole("button", { name: /^Ana Ruiz, Cut/ });
  await expect(block).toHaveAccessibleName("Ana Ruiz, Cut, 9:00 AM – 10:00 AM");

  await block.click();
  await page.getByRole("button", { name: "Reschedule" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "11:00 AM", exact: true })
    .click();
  await page.getByRole("button", { name: "Move booking" }).click();
  await expect(page.getByText("Moved.")).toBeVisible();
  await expect(block).toHaveAccessibleName(
    "Ana Ruiz, Cut, 11:00 AM – 12:00 PM",
  );

  // The customer's latest email carries the manage link.
  const [email] = await testSql<{ text: string }[]>`
    select text from public.email_log
    where workspace_id = ${ws.id} and kind = 'booking_rescheduled'
    order by created_at desc limit 1`;
  const path = /\/b\/[\w-]+/.exec(email.text)?.[0];
  expect(path).toBeTruthy();
  await page.goto(path as string);
  await expect(
    page.getByRole("heading", { name: "Your appointment" }),
  ).toBeVisible();
  await expect(page.getByText("Cut with Maya")).toBeVisible();
  await page.getByRole("button", { name: "Cancel appointment" }).click();
  await page.getByRole("button", { name: "Cancel appointment" }).click();
  await expect(page.getByText("This appointment was cancelled.")).toBeVisible();

  await page.goto(`/w/${ws.slug}/calendar?date=${DATE}`);
  await expect(page.getByText("Maya", { exact: true })).toBeVisible();
  await expect(block).toHaveCount(0);
});

test("staff can use the calendar", async ({ page }) => {
  const { ws } = await salon();
  const member = await createTestUser();
  await addTestMember(ws.id, member, "staff");
  await signIn(page, member);
  await expect(page).toHaveURL(`/w/${ws.slug}`);
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/w/${ws.slug}/calendar`));
  await expect(page.getByRole("button", { name: "New booking" })).toBeVisible();
});
