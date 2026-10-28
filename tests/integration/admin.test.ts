import { afterAll, describe, expect, it } from "vitest";
import { adminDb } from "@/db/admin";
import { conversations, usageEvents } from "@/db/schema";
import { getPlatformOverview } from "@/privileged/admin/overview";
import { seedDemoWorkspace } from "@/privileged/demo/seed";
import {
  cleanupTestData,
  createTestUser,
  createTestWorkspace,
  trackWorkspace,
} from "../helpers/seed";

afterAll(cleanupTestData);

describe("the platform overview", () => {
  it("lists real workspaces with plan, usage and cost, and demos in total", async () => {
    const owner = await createTestUser();
    const ws = await createTestWorkspace(owner, { name: "Overview Salon" });
    await adminDb.insert(conversations).values([
      { workspaceId: ws.id, channel: "widget" },
      { workspaceId: ws.id, channel: "widget" },
      { workspaceId: ws.id, channel: "preview" },
    ]);
    await adminDb.insert(usageEvents).values({
      workspaceId: ws.id,
      provider: "openai",
      model: "gpt-5.4-mini",
      inputTokens: 1_000_000,
      outputTokens: 0,
    });
    const demo = await seedDemoWorkspace(
      owner.id,
      new Date(Date.now() + 3_600_000),
    );
    trackWorkspace(demo.id);

    const overview = await getPlatformOverview();
    const row = overview.workspaces.find((item) => item.id === ws.id);
    expect(row).toMatchObject({
      name: "Overview Salon",
      plan: "trial",
      active: true,
      members: 1,
      chatsThisMonth: 2,
    });
    expect(row?.aiCost30d).toBeCloseTo(0.75);
    // Sandboxes are summed up, not listed.
    expect(overview.workspaces.some((item) => item.id === demo.id)).toBe(false);
    expect(overview.demos.live).toBeGreaterThanOrEqual(1);
    expect(overview.demos.aiCost30d).toBeGreaterThan(0);
    expect(overview.costPerDay).toHaveLength(30);
  });
});
