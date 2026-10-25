import { expect, test } from "@playwright/test";
import {
  addTestMember,
  cleanupTestData,
  createTestService,
  createTestUser,
  createTestWorkspace,
  setTestOpeningHours,
} from "../helpers/seed";
import { signIn } from "./helpers/auth";

test.afterAll(cleanupTestData);

test("an owner sets up a staff member", async ({ page }) => {
  // The longest flow in the suite: about 15 seconds against a production build.
  test.slow();
  const owner = await createTestUser();
  const ws = await createTestWorkspace(owner);
  await createTestService(ws.id, owner, { name: "Balayage" });
  await createTestService(ws.id, owner, { name: "Cut" });
  // Monday to Friday, 09:00 to 18:00.
  await setTestOpeningHours(
    ws.id,
    owner,
    [1, 2, 3, 4, 5].map((weekday) => ({
      weekday,
      startMinute: 540,
      endMinute: 1080,
    })),
  );
  await signIn(page, owner);
  await expect(page).toHaveURL(`/w/${ws.slug}`);
  await page.goto(`/w/${ws.slug}/staff`);
  await expect(
    page.getByText("No staff yet. Add the people customers can book with."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Add staff member" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Maya Chen");
  await dialog.getByLabel("Job title (optional)").fill("Senior stylist");
  await dialog.getByRole("button", { name: "Add staff member" }).click();
  await expect(page.getByRole("heading", { name: "Maya Chen" })).toBeVisible();
  const staffPage = page.url();

  await page.getByLabel("Balayage", { exact: true }).check();
  await page.getByRole("button", { name: "Save services" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  // Let that toast go, so the next "Saved." belongs to the hours.
  await expect(page.getByText("Saved.")).toBeHidden();

  await page.getByRole("button", { name: "Copy opening hours" }).click();
  await expect(page.getByLabel("Friday closes", { exact: true })).toHaveValue(
    "18:00",
  );
  // A lunch break on Monday.
  await page.getByLabel("Monday closes", { exact: true }).fill("12:00");
  await page.getByRole("button", { name: "Add hours on Monday" }).click();
  await page.getByLabel("Monday opens (2)").fill("13:00");
  await page.getByLabel("Monday closes (2)").fill("18:00");
  await page.getByRole("button", { name: "Save hours" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Monday opens", { exact: true })).toHaveValue(
    "09:00",
  );
  await expect(page.getByLabel("Monday closes", { exact: true })).toHaveValue(
    "12:00",
  );
  await expect(page.getByLabel("Monday opens (2)")).toHaveValue("13:00");
  await expect(page.getByLabel("Monday closes (2)")).toHaveValue("18:00");
  await expect(page.getByLabel("Open on Saturday")).not.toBeChecked();

  // Next year's dates, so the test never uses a past date.
  const year = new Date().getFullYear() + 1;
  await expect(page.getByText("No time off coming up.")).toBeVisible();
  await page.getByLabel("From").fill(`${year}-12-24`);
  await page.getByLabel("To", { exact: true }).fill(`${year}-12-26`);
  await expect(page.getByLabel("All day")).toBeChecked();
  await page.getByLabel("Note (optional)").fill("Holiday");
  await page.getByRole("button", { name: "Add time off" }).click();
  const timeOff = page.getByRole("list", { name: "Time off coming up" });
  await expect(timeOff.getByText(`Dec 24 – Dec 26, ${year}`)).toBeVisible();
  await expect(timeOff.getByText("Holiday")).toBeVisible();

  await page.goto(`/w/${ws.slug}/staff`);
  const row = page.getByRole("link", { name: /Maya Chen/ });
  await expect(row).toContainText("Senior stylist");
  await expect(row).toContainText("1 service");
  await expect(row).not.toContainText("No hours set");

  await page.goto(staffPage);
  await page.getByLabel("Cut", { exact: true }).check();
  await page.getByRole("button", { name: "Save services" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.goto(`/w/${ws.slug}/staff`);
  await expect(row).toContainText("2 services");

  await page.goto(`/w/${ws.slug}/services`);
  await expect(page.getByText("1 staff").first()).toBeVisible();

  await page.goto(staffPage);
  await page.getByRole("button", { name: "Delete staff member" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page).toHaveURL(`/w/${ws.slug}/staff`);
  await expect(
    page.getByText("No staff yet. Add the people customers can book with."),
  ).toBeVisible();
});

test("staff get a 404 on the staff pages", async ({ page }) => {
  const [owner, member] = await Promise.all([
    createTestUser(),
    createTestUser(),
  ]);
  const ws = await createTestWorkspace(owner);
  await addTestMember(ws.id, member, "staff");
  await signIn(page, member);
  await expect(page).toHaveURL(`/w/${ws.slug}`);
  const response = await page.goto(`/w/${ws.slug}/staff`);
  expect(response?.status()).toBe(404);
});
