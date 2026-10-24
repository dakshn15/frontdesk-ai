import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { adminDb } from "@/db/admin";
import { auditLog, workspaces } from "@/db/schema";
import {
  deleteWorkspaceRecord,
  updateWorkspaceRecord,
} from "@/features/workspaces/records";
import {
  addTestMember,
  claimsFor,
  cleanupTestData,
  createTestUser,
  createTestWorkspace,
} from "../helpers/seed";

afterAll(cleanupTestData);

async function team() {
  const [ana, ben, cara] = await Promise.all([
    createTestUser(),
    createTestUser(),
    createTestUser(),
  ]);
  const ws = await createTestWorkspace(ana, { name: "Test Salon" });
  await addTestMember(ws.id, ben, "admin");
  await addTestMember(ws.id, cara, "staff");
  return { ana, ben, cara, ws };
}

const renamed = (name: string) => ({
  name,
  website: null,
  timezone: "America/Chicago",
  currency: "USD",
});

async function workspaceName(id: string) {
  const [row] = await adminDb
    .select({ name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, id));
  return row?.name;
}

describe("updateWorkspaceRecord", () => {
  it("staff can't change details", async () => {
    const { cara, ws } = await team();
    expect(
      await updateWorkspaceRecord(
        claimsFor(cara),
        ws.id,
        renamed("Staff Name"),
      ),
    ).toBe("not_allowed");
    expect(await workspaceName(ws.id)).toBe("Test Salon");
  });

  it("admins can change details and it's logged", async () => {
    const { ben, ws } = await team();
    expect(
      await updateWorkspaceRecord(claimsFor(ben), ws.id, renamed("Bloom Two")),
    ).toBe("ok");
    expect(await workspaceName(ws.id)).toBe("Bloom Two");
    const [entry] = await adminDb
      .select({ metadata: auditLog.metadata, actorId: auditLog.actorId })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.workspaceId, ws.id),
          eq(auditLog.action, "workspace.updated"),
        ),
      );
    expect(entry).toEqual({ metadata: { changed: ["name"] }, actorId: ben.id });
  });
});

describe("deleteWorkspaceRecord", () => {
  it("only the owner can delete", async () => {
    const { ana, ben, ws } = await team();
    expect(await deleteWorkspaceRecord(claimsFor(ben), ws.id)).toBe(
      "not_allowed",
    );
    expect(await workspaceName(ws.id)).toBe("Test Salon");
    expect(await deleteWorkspaceRecord(claimsFor(ana), ws.id)).toBe("ok");
    expect(await workspaceName(ws.id)).toBeUndefined();
  });
});
