import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { adminDb } from "@/db/admin";
import { auditLog, memberships } from "@/db/schema";
import { listMembers, listPendingInvites } from "@/features/team/queries";
import {
  acceptInviteRecord,
  changeRoleRecord,
  createInviteRecord,
  removeMemberRecord,
} from "@/features/team/records";
import { getMembershipBySlug } from "@/features/workspaces/queries";
import { updateWorkspaceRecord } from "@/features/workspaces/records";
import {
  addTestMember,
  claimsFor,
  cleanupTestData,
  createTestUser,
  createTestWorkspace,
  type TestUser,
} from "../helpers/seed";

afterAll(cleanupTestData);

/** A workspace owned by ana, with ben as admin and cara as staff. */
async function team() {
  const [ana, ben, cara] = await Promise.all([
    createTestUser({ fullName: "Ana Lopez" }),
    createTestUser({ fullName: "Ben Ito" }),
    createTestUser({ fullName: "Cara Diaz" }),
  ]);
  const ws = await createTestWorkspace(ana);
  await addTestMember(ws.id, ben, "admin");
  await addTestMember(ws.id, cara, "staff");
  return { ana, ben, cara, ws };
}

async function membershipId(workspaceId: string, user: TestUser) {
  const [row] = await adminDb
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.workspaceId, workspaceId),
        eq(memberships.userId, user.id),
      ),
    );
  return row.id;
}

const newEmail = () => `invitee-${randomUUID()}@example.com`;

describe("invites", () => {
  it("an owner's invite link lets a teammate join", async () => {
    const { ana, ws } = await team();
    const dan = await createTestUser({ fullName: "Dan Park" });
    const created = await createInviteRecord(claimsFor(ana), ws.id, {
      email: dan.email,
      role: "staff",
    });
    if (!created.ok) throw new Error(created.error);
    expect(await acceptInviteRecord(claimsFor(dan), created.token)).toEqual({
      ok: true,
      slug: ws.slug,
    });
    const members = await listMembers(claimsFor(ana), ws.id);
    expect(members.find((m) => m.userId === dan.id)?.role).toBe("staff");
  });

  it("inviting an existing member is refused", async () => {
    const { ana, cara, ws } = await team();
    expect(
      await createInviteRecord(claimsFor(ana), ws.id, {
        email: cara.email.toUpperCase(),
        role: "admin",
      }),
    ).toEqual({ ok: false, error: "already_member" });
  });

  it("a new invite cancels the older link", async () => {
    const { ana, ws } = await team();
    const dan = await createTestUser();
    const first = await createInviteRecord(claimsFor(ana), ws.id, {
      email: dan.email,
      role: "staff",
    });
    const second = await createInviteRecord(claimsFor(ana), ws.id, {
      email: dan.email,
      role: "admin",
    });
    if (!first.ok || !second.ok) throw new Error("invite not created");
    expect(await acceptInviteRecord(claimsFor(dan), first.token)).toEqual({
      ok: false,
      error: "invite_revoked",
    });
    expect(await acceptInviteRecord(claimsFor(dan), second.token)).toEqual({
      ok: true,
      slug: ws.slug,
    });
  });

  it("staff don't see pending invites", async () => {
    const { ana, cara, ws } = await team();
    await createInviteRecord(claimsFor(ana), ws.id, {
      email: newEmail(),
      role: "staff",
    });
    expect(await listPendingInvites(claimsFor(cara), ws.id)).toEqual([]);
    expect(await listPendingInvites(claimsFor(ana), ws.id)).toHaveLength(1);
  });
});

describe("permissions", () => {
  it("staff can't invite, change roles or remove others", async () => {
    const { ben, cara, ws } = await team();
    const benM = await membershipId(ws.id, ben);
    expect(
      await createInviteRecord(claimsFor(cara), ws.id, {
        email: newEmail(),
        role: "staff",
      }),
    ).toEqual({ ok: false, error: "not_allowed" });
    expect(await changeRoleRecord(claimsFor(cara), ws.id, benM, "staff")).toBe(
      "not_allowed",
    );
    expect(await removeMemberRecord(claimsFor(cara), ws.id, benM)).toBe(
      "not_allowed",
    );
  });

  it("admins can't remove owners", async () => {
    const { ana, ben, ws } = await team();
    const anaM = await membershipId(ws.id, ana);
    expect(await removeMemberRecord(claimsFor(ben), ws.id, anaM)).toBe(
      "not_allowed",
    );
  });

  it("the last owner can't leave", async () => {
    const { ana, ws } = await team();
    const anaM = await membershipId(ws.id, ana);
    expect(await removeMemberRecord(claimsFor(ana), ws.id, anaM)).toBe(
      "last_owner",
    );
  });

  it("a refused removal leaves no audit row", async () => {
    const { ben, cara, ws } = await team();
    const benM = await membershipId(ws.id, ben);
    await removeMemberRecord(claimsFor(cara), ws.id, benM);
    const rows = await adminDb
      .select({ id: auditLog.id })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.workspaceId, ws.id),
          eq(auditLog.action, "member.removed"),
        ),
      );
    expect(rows).toEqual([]);
  });
});

describe("leaving and removal", () => {
  it("removed member loses access immediately", async () => {
    const { ana, ben, ws } = await team();
    const benM = await membershipId(ws.id, ben);
    expect(await removeMemberRecord(claimsFor(ana), ws.id, benM)).toBe("ok");
    expect(await getMembershipBySlug(claimsFor(ben), ws.slug)).toBeNull();
    expect(
      await updateWorkspaceRecord(claimsFor(ben), ws.id, {
        name: "Hijacked",
        website: null,
        timezone: "UTC",
        currency: "USD",
      }),
    ).toBe("not_allowed");
    expect(await listMembers(claimsFor(ben), ws.id)).toEqual([]);
  });

  it("staff can leave and it's logged", async () => {
    const { cara, ws } = await team();
    const caraM = await membershipId(ws.id, cara);
    expect(await removeMemberRecord(claimsFor(cara), ws.id, caraM)).toBe("ok");
    const rows = await adminDb
      .select({ action: auditLog.action })
      .from(auditLog)
      .where(
        and(eq(auditLog.workspaceId, ws.id), eq(auditLog.targetId, caraM)),
      );
    expect(rows).toEqual([{ action: "member.left" }]);
  });
});
