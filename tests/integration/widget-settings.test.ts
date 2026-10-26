import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { adminDb } from "@/db/admin";
import { workspaces } from "@/db/schema";
import { updateWidgetSettingsRecord } from "@/features/widget/records";
import {
  addTestMember,
  claimsFor,
  cleanupTestData,
  createTestUser,
  createTestWorkspace,
} from "../helpers/seed";

afterAll(cleanupTestData);

const settings = {
  widgetColor: "#be185d",
  widgetGreeting: "Welcome to Bloom.",
  widgetSuggestions: ["Do you have parking?"],
  widgetPosition: "left" as const,
  allowedDomains: ["bloomsalon.com"],
};

describe("widget settings", () => {
  it("owners and admins save them; staff can't", async () => {
    const [owner, admin, staff] = await Promise.all([
      createTestUser(),
      createTestUser(),
      createTestUser(),
    ]);
    const ws = await createTestWorkspace(owner);
    await addTestMember(ws.id, admin, "admin");
    await addTestMember(ws.id, staff, "staff");

    expect(
      await updateWidgetSettingsRecord(claimsFor(staff), ws.id, settings),
    ).toBe(false);
    expect(
      await updateWidgetSettingsRecord(claimsFor(admin), ws.id, settings),
    ).toBe(true);
    const [saved] = await adminDb
      .select({
        widgetColor: workspaces.widgetColor,
        widgetGreeting: workspaces.widgetGreeting,
        widgetSuggestions: workspaces.widgetSuggestions,
        widgetPosition: workspaces.widgetPosition,
        allowedDomains: workspaces.allowedDomains,
      })
      .from(workspaces)
      .where(eq(workspaces.id, ws.id));
    expect(saved).toEqual(settings);
  });

  it("the database refuses bad values", async () => {
    const owner = await createTestUser();
    const ws = await createTestWorkspace(owner);
    await expect(
      updateWidgetSettingsRecord(claimsFor(owner), ws.id, {
        ...settings,
        widgetSuggestions: ["a", "b", "c", "d", "e"],
      }),
    ).rejects.toThrow();
  });
});
