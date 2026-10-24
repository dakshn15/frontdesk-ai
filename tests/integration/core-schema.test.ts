import { and, eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { withRls } from "@/db";
import { adminDb } from "@/db/admin";
import { getPgError } from "@/db/errors";
import { auditLog, memberships, profiles, workspaces } from "@/db/schema";
import {
  addTestMember,
  claimsFor,
  cleanupTestData,
  createTestUser,
  createTestWorkspace,
  type TestUser,
} from "../helpers/seed";

afterAll(cleanupTestData);

async function pgErrorOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (err) {
    return getPgError(err);
  }
  throw new Error("expected the query to fail");
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

describe("profiles", () => {
  it("creates a profile when a user signs up", async () => {
    const ana = await createTestUser({ fullName: "Ana Lopez" });
    const [row] = await adminDb
      .select()
      .from(profiles)
      .where(eq(profiles.id, ana.id));
    expect(row).toMatchObject({ email: ana.email, fullName: "Ana Lopez" });
  });

  it("users can rename themselves but can't change their profile email", async () => {
    const ana = await createTestUser();
    const renamed = await withRls(claimsFor(ana), (tx) =>
      tx
        .update(profiles)
        .set({ fullName: "Ana B" })
        .where(eq(profiles.id, ana.id))
        .returning({ id: profiles.id }),
    );
    expect(renamed).toEqual([{ id: ana.id }]);
    const err = await pgErrorOf(
      withRls(claimsFor(ana), (tx) =>
        tx
          .update(profiles)
          .set({ email: "someone-else@example.com" })
          .where(eq(profiles.id, ana.id)),
      ),
    );
    expect(err?.code).toBe("42501");
  });
});

describe("creating workspaces", () => {
  it("create_workspace makes the caller the owner and logs it", async () => {
    const ana = await createTestUser();
    const ws = await createTestWorkspace(ana);
    const seen = await withRls(claimsFor(ana), async (tx) => ({
      roles: await tx
        .select({ role: memberships.role })
        .from(memberships)
        .where(eq(memberships.workspaceId, ws.id)),
      audit: await tx
        .select({ action: auditLog.action })
        .from(auditLog)
        .where(eq(auditLog.workspaceId, ws.id)),
    }));
    expect(seen.roles).toEqual([{ role: "owner" }]);
    expect(seen.audit).toEqual([{ action: "workspace.created" }]);
  });

  it("anonymous callers can't create workspaces", async () => {
    const err = await pgErrorOf(
      withRls(null, (tx) =>
        tx.execute(
          sql`select private.create_workspace('X Salon', 'x-salon', null, 'UTC', 'USD')`,
        ),
      ),
    );
    expect(err?.code).toBe("42501");
  });

  it("direct inserts are blocked", async () => {
    const [ana, ben] = await Promise.all([createTestUser(), createTestUser()]);
    const anaWs = await createTestWorkspace(ana);
    const sneakyWorkspace = await pgErrorOf(
      withRls(claimsFor(ana), (tx) =>
        tx.insert(workspaces).values({
          name: "Sneaky",
          slug: "sneaky-insert",
          timezone: "UTC",
          currency: "USD",
        }),
      ),
    );
    expect(sneakyWorkspace?.code).toBe("42501");
    const sneakyMembership = await pgErrorOf(
      withRls(claimsFor(ben), (tx) =>
        tx
          .insert(memberships)
          .values({ workspaceId: anaWs.id, userId: ben.id, role: "owner" }),
      ),
    );
    expect(sneakyMembership?.code).toBe("42501");
  });
});

describe("tenant isolation", () => {
  it("users only see their own workspaces", async () => {
    const [ana, ben] = await Promise.all([createTestUser(), createTestUser()]);
    const anaWs = await createTestWorkspace(ana);
    const benWs = await createTestWorkspace(ben);
    const seen = await withRls(claimsFor(ben), async (tx) => ({
      workspaces: await tx.select({ id: workspaces.id }).from(workspaces),
      memberships: await tx
        .select({ id: memberships.id })
        .from(memberships)
        .where(eq(memberships.workspaceId, anaWs.id)),
      profiles: await tx.select({ id: profiles.id }).from(profiles),
    }));
    expect(seen.workspaces).toEqual([{ id: benWs.id }]);
    expect(seen.memberships).toEqual([]);
    expect(seen.profiles).toEqual([{ id: ben.id }]);
  });

  it("teammates see each other's profiles", async () => {
    const [ana, ben] = await Promise.all([createTestUser(), createTestUser()]);
    const anaWs = await createTestWorkspace(ana);
    await addTestMember(anaWs.id, ben, "staff");
    const rows = await withRls(claimsFor(ben), (tx) =>
      tx
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.id, ana.id)),
    );
    expect(rows).toEqual([{ id: ana.id }]);
  });
});

describe("roles", () => {
  it("staff can't edit or delete; admins edit; only owners delete", async () => {
    const { ana, ben, cara, ws } = await team();
    const rename = (user: TestUser, name: string) =>
      withRls(claimsFor(user), (tx) =>
        tx
          .update(workspaces)
          .set({ name })
          .where(eq(workspaces.id, ws.id))
          .returning({ id: workspaces.id }),
      );
    const remove = (user: TestUser) =>
      withRls(claimsFor(user), (tx) =>
        tx
          .delete(workspaces)
          .where(eq(workspaces.id, ws.id))
          .returning({ id: workspaces.id }),
      );
    expect(await rename(cara, "Staff Rename")).toEqual([]);
    expect(await rename(ben, "Admin Rename")).toEqual([{ id: ws.id }]);
    expect(await remove(ben)).toEqual([]);
    expect(await remove(ana)).toEqual([{ id: ws.id }]);
    const left = await adminDb
      .select()
      .from(memberships)
      .where(eq(memberships.workspaceId, ws.id));
    expect(left).toEqual([]);
  });

  it("admins can't touch owners", async () => {
    const { ana, ben, cara, ws } = await team();
    const [anaM, benM, caraM] = await Promise.all([
      membershipId(ws.id, ana),
      membershipId(ws.id, ben),
      membershipId(ws.id, cara),
    ]);
    const setRole = (
      actor: TestUser,
      id: string,
      role: "owner" | "admin" | "staff",
    ) =>
      withRls(claimsFor(actor), (tx) =>
        tx
          .update(memberships)
          .set({ role })
          .where(eq(memberships.id, id))
          .returning({ id: memberships.id }),
      );
    expect(await setRole(ben, anaM, "admin")).toEqual([]);
    const promote = await pgErrorOf(setRole(ben, caraM, "owner"));
    expect(promote?.code).toBe("42501");
    expect(await setRole(ana, benM, "owner")).toEqual([{ id: benM }]);
  });

  it("the last owner can't leave or step down", async () => {
    const { ana, ben, ws } = await team();
    const [anaM, benM] = await Promise.all([
      membershipId(ws.id, ana),
      membershipId(ws.id, ben),
    ]);
    const leave = await pgErrorOf(
      withRls(claimsFor(ana), (tx) =>
        tx.delete(memberships).where(eq(memberships.id, anaM)),
      ),
    );
    expect(leave).toEqual({ code: "P0001", message: "last_owner" });
    const stepDown = await pgErrorOf(
      withRls(claimsFor(ana), (tx) =>
        tx
          .update(memberships)
          .set({ role: "admin" })
          .where(eq(memberships.id, anaM)),
      ),
    );
    expect(stepDown).toEqual({ code: "P0001", message: "last_owner" });
    await withRls(claimsFor(ana), (tx) =>
      tx
        .update(memberships)
        .set({ role: "owner" })
        .where(eq(memberships.id, benM)),
    );
    const left = await withRls(claimsFor(ana), (tx) =>
      tx
        .delete(memberships)
        .where(eq(memberships.id, anaM))
        .returning({ id: memberships.id }),
    );
    expect(left).toEqual([{ id: anaM }]);
  });

  it("staff can leave on their own", async () => {
    const { cara, ws } = await team();
    const caraM = await membershipId(ws.id, cara);
    const left = await withRls(claimsFor(cara), (tx) =>
      tx
        .delete(memberships)
        .where(eq(memberships.id, caraM))
        .returning({ id: memberships.id }),
    );
    expect(left).toEqual([{ id: caraM }]);
  });
});

describe("data rules", () => {
  it("unknown time zones are rejected", async () => {
    const ana = await createTestUser();
    const ws = await createTestWorkspace(ana);
    const err = await pgErrorOf(
      withRls(claimsFor(ana), (tx) =>
        tx
          .update(workspaces)
          .set({ timezone: "Mars/Olympus" })
          .where(eq(workspaces.id, ws.id)),
      ),
    );
    expect(err?.code).toBe("22023");
  });

  it("the audit log is for owners and admins and can't be edited", async () => {
    const { ana, cara, ws } = await team();
    const read = (user: TestUser) =>
      withRls(claimsFor(user), (tx) =>
        tx
          .select({ id: auditLog.id })
          .from(auditLog)
          .where(eq(auditLog.workspaceId, ws.id)),
      );
    expect(await read(cara)).toEqual([]);
    expect((await read(ana)).length).toBeGreaterThanOrEqual(1);
    const edited = await withRls(claimsFor(ana), (tx) =>
      tx
        .update(auditLog)
        .set({ action: "tampered" })
        .where(eq(auditLog.workspaceId, ws.id))
        .returning({ id: auditLog.id }),
    );
    expect(edited).toEqual([]);
  });
});
