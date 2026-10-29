import { randomBytes } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { adminDb } from "@/db/admin";
import {
  bookings,
  memberships,
  services,
  staff,
  subscriptions,
  testCases,
  workspaces,
} from "@/db/schema";
import { planForWorkspace } from "@/privileged/billing/limits";
import {
  findUserId,
  findWorkspace,
  resetShowcase,
  SHOWCASE_CUSTOMER_ID,
} from "../../scripts/seed-showcase";
import {
  cleanupTestData,
  createTestUser,
  trackWorkspace,
} from "../helpers/seed";

afterAll(cleanupTestData);

const rows = async (table: typeof services, workspaceId: string) =>
  (
    await adminDb
      .select({ n: count() })
      .from(table)
      .where(eq(table.workspaceId, workspaceId))
  )[0].n;

describe("showcase seeder", () => {
  it("replaces the workspace with one permanent copy of the demo salon on Pro", async () => {
    const owner = await createTestUser();
    // Its own slug, so the test never touches the local showcase workspace.
    const slug = `showcase-${randomBytes(4).toString("hex")}`;

    const first = await resetShowcase(slug, owner.id);
    trackWorkspace(first.id);
    // A manual edit, which the second run should undo.
    await adminDb.delete(services).where(eq(services.workspaceId, first.id));
    const second = await resetShowcase(slug, owner.id);
    trackWorkspace(second.id);

    expect(second.slug).toBe(slug);
    expect(second.id).not.toBe(first.id);
    const matches = await adminDb
      .select()
      .from(workspaces)
      .where(eq(workspaces.slug, slug));
    expect(matches).toHaveLength(1);
    const [ws] = matches;
    expect(ws.id).toBe(second.id);
    expect(ws.name).toBe("Bloom Hair & Beauty");
    expect(ws.demoExpiresAt).toBeNull();
    expect(ws.createdBy).toBe(owner.id);

    const [owners] = await adminDb
      .select({ n: count() })
      .from(memberships)
      .where(
        and(
          eq(memberships.workspaceId, ws.id),
          eq(memberships.userId, owner.id),
          eq(memberships.role, "owner"),
        ),
      );
    expect(owners.n).toBe(1);

    const [subscription] = await adminDb
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.workspaceId, ws.id));
    expect(subscription).toMatchObject({
      plan: "pro",
      status: "active",
      stripeCustomerId: SHOWCASE_CUSTOMER_ID,
    });
    // Still live long after the 14-day trial would have ended.
    const later = new Date(Date.now() + 60 * 86_400_000);
    expect(await planForWorkspace(ws.id, later)).toMatchObject({
      plan: "pro",
      active: true,
    });

    expect(await rows(services, ws.id)).toBe(15);
    expect(await rows(staff as never, ws.id)).toBe(4);
    expect(await rows(bookings as never, ws.id)).toBeGreaterThan(10);
    expect(await rows(testCases as never, ws.id)).toBeGreaterThan(0);
    expect(await findWorkspace(slug)).toMatchObject({
      id: ws.id,
      owners: [owner.email],
      services: 15,
    });
    expect(await findUserId(owner.email.toUpperCase())).toBe(owner.id);
  });
});
