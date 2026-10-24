import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { adminDb } from "@/db/admin";
import { memberships, workspaces } from "@/db/schema";
import { createWorkspaceRecord } from "@/features/workspaces/records";
import {
  claimsFor,
  cleanupTestData,
  createTestUser,
  trackWorkspace,
} from "../helpers/seed";

afterAll(cleanupTestData);

const details = (name: string) => ({
  name,
  website: null,
  timezone: "America/Chicago",
  currency: "USD",
});

describe("createWorkspaceRecord", () => {
  it("creates the workspace and returns its slug", async () => {
    const ana = await createTestUser();
    const tag = randomBytes(4).toString("hex");
    const ws = await createWorkspaceRecord(
      claimsFor(ana),
      details(`Bloom ${tag}`),
    );
    trackWorkspace(ws.id);
    expect(ws.slug).toBe(`bloom-${tag}`);
    const roles = await adminDb
      .select({ role: memberships.role })
      .from(memberships)
      .where(
        and(eq(memberships.workspaceId, ws.id), eq(memberships.userId, ana.id)),
      );
    expect(roles).toEqual([{ role: "owner" }]);
  });

  it("same name twice gets a suffixed slug", async () => {
    const ana = await createTestUser();
    const tag = randomBytes(4).toString("hex");
    const first = await createWorkspaceRecord(
      claimsFor(ana),
      details(`Twin Salon ${tag}`),
    );
    const second = await createWorkspaceRecord(
      claimsFor(ana),
      details(`Twin Salon ${tag}`),
    );
    trackWorkspace(first.id);
    trackWorkspace(second.id);
    expect(first.slug).toBe(`twin-salon-${tag}`);
    expect(second.slug).toMatch(new RegExp(`^twin-salon-${tag}-[a-z0-9]{4}$`));
  });

  it("stores normalised details", async () => {
    const ana = await createTestUser();
    const ws = await createWorkspaceRecord(claimsFor(ana), {
      name: `Nail Bar ${randomBytes(4).toString("hex")}`,
      website: null,
      timezone: "Europe/London",
      currency: "GBP",
    });
    trackWorkspace(ws.id);
    const [row] = await adminDb
      .select({
        website: workspaces.website,
        timezone: workspaces.timezone,
        currency: workspaces.currency,
      })
      .from(workspaces)
      .where(eq(workspaces.id, ws.id));
    expect(row).toEqual({
      website: null,
      timezone: "Europe/London",
      currency: "GBP",
    });
  });
});
