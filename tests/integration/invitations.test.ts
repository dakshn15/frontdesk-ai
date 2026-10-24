import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { withRls } from "@/db";
import { adminDb } from "@/db/admin";
import { getPgError } from "@/db/errors";
import { auditLog, invitations, memberships } from "@/db/schema";
import { hashInviteToken } from "@/features/team/invite-token";
import {
  addTestMember,
  claimsFor,
  cleanupTestData,
  createTestInvite,
  createTestUser,
  createTestWorkspace,
  type TestUser,
} from "../helpers/seed";
import { asUser, testSql } from "../helpers/test-db";

afterAll(cleanupTestData);

async function pgErrorOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (err) {
    return getPgError(err);
  }
  throw new Error("expected the query to fail");
}

/** A workspace owned by ana ("Ana Lopez"), with ben as admin and cara as staff. */
async function team() {
  const [ana, ben, cara] = await Promise.all([
    createTestUser({ fullName: "Ana Lopez" }),
    createTestUser(),
    createTestUser(),
  ]);
  const ws = await createTestWorkspace(ana);
  await addTestMember(ws.id, ben, "admin");
  await addTestMember(ws.id, cara, "staff");
  return { ana, ben, cara, ws };
}

function accept(user: TestUser, token: string) {
  return withRls(claimsFor(user), async (tx) => {
    const [row] = await tx.execute<{ slug: string }>(
      sql`select private.accept_invitation(${token}) as slug`,
    );
    return row.slug;
  });
}

function preview(token: string) {
  return withRls(null, async (tx) =>
    Array.from(
      await tx.execute(sql`select * from private.invitation_preview(${token})`),
    ),
  );
}

describe("creating invites", () => {
  it("TypeScript and Postgres hash tokens the same way", async () => {
    const [row] =
      await testSql`select encode(sha256(convert_to('abc', 'UTF8')), 'hex') as hash`;
    expect(row.hash).toBe(hashInviteToken("abc"));
  });

  it("owners and admins can invite; staff can't", async () => {
    const { ana, ben, cara, ws } = await team();
    await createTestInvite(ws.id, ana, {
      email: `a-${randomUUID()}@example.com`,
      role: "staff",
    });
    await createTestInvite(ws.id, ben, {
      email: `b-${randomUUID()}@example.com`,
      role: "admin",
    });
    const err = await pgErrorOf(
      createTestInvite(ws.id, cara, {
        email: `c-${randomUUID()}@example.com`,
        role: "staff",
      }),
    );
    expect(err?.code).toBe("42501");
  });

  it("nobody can be invited as owner", async () => {
    const { ana, ws } = await team();
    const err = await pgErrorOf(
      asUser(
        ana.id,
        (tx) => tx`
          insert into public.invitations (workspace_id, email, role, token_hash, invited_by, expires_at)
          values (${ws.id}, ${`o-${randomUUID()}@example.com`}, 'owner', ${randomBytes(8).toString("hex")}, ${ana.id}, now() + interval '7 days')`,
      ),
    );
    expect(err?.code).toBe("23514");
  });

  it("one pending invite per email", async () => {
    const { ana, ws } = await team();
    const email = `dup-${randomUUID()}@example.com`;
    await createTestInvite(ws.id, ana, { email, role: "staff" });
    const err = await pgErrorOf(
      createTestInvite(ws.id, ana, { email, role: "admin" }),
    );
    expect(err?.code).toBe("23505");
  });
});

describe("accepting invites", () => {
  it("accepting adds the member with the invited role", async () => {
    const { ana, ws } = await team();
    const dan = await createTestUser();
    const invite = await createTestInvite(ws.id, ana, {
      email: dan.email,
      role: "staff",
    });
    expect(await accept(dan, invite.token)).toBe(ws.slug);

    const roles = await adminDb
      .select({ role: memberships.role })
      .from(memberships)
      .where(
        and(eq(memberships.workspaceId, ws.id), eq(memberships.userId, dan.id)),
      );
    expect(roles).toEqual([{ role: "staff" }]);

    const [row] = await adminDb
      .select({
        acceptedAt: invitations.acceptedAt,
        acceptedBy: invitations.acceptedBy,
      })
      .from(invitations)
      .where(eq(invitations.id, invite.id));
    expect(row.acceptedBy).toBe(dan.id);
    expect(row.acceptedAt).toBeInstanceOf(Date);

    const joined = await adminDb
      .select({ id: auditLog.id })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.workspaceId, ws.id),
          eq(auditLog.action, "member.joined"),
        ),
      );
    expect(joined).toHaveLength(1);
  });

  it("accepts regardless of email case", async () => {
    const { ana, ws } = await team();
    const mixed = `Ana.Case.${randomUUID().slice(0, 8)}@Example.com`;
    const user = await createTestUser({ email: mixed });
    const invite = await createTestInvite(ws.id, ana, {
      email: mixed.toLowerCase(),
      role: "staff",
    });
    expect(await accept(user, invite.token)).toBe(ws.slug);
  });

  it("rejects used, expired, revoked, wrong-email and unknown tokens", async () => {
    const { ana, cara, ws } = await team();
    const [dan, eve, finn] = await Promise.all([
      createTestUser(),
      createTestUser(),
      createTestUser(),
    ]);

    const used = await createTestInvite(ws.id, ana, {
      email: dan.email,
      role: "staff",
    });
    await accept(dan, used.token);
    expect(await pgErrorOf(accept(dan, used.token))).toEqual({
      code: "P0001",
      message: "invite_used",
    });

    const expired = await createTestInvite(ws.id, ana, {
      email: eve.email,
      role: "staff",
      expiresAt: new Date(Date.now() - 60_000),
    });
    expect(await pgErrorOf(accept(eve, expired.token))).toEqual({
      code: "P0001",
      message: "invite_expired",
    });

    const revoked = await createTestInvite(ws.id, ana, {
      email: finn.email,
      role: "staff",
    });
    await adminDb
      .update(invitations)
      .set({ revokedAt: new Date() })
      .where(eq(invitations.id, revoked.id));
    expect(await pgErrorOf(accept(finn, revoked.token))).toEqual({
      code: "P0001",
      message: "invite_revoked",
    });

    const forSomeoneElse = await createTestInvite(ws.id, ana, {
      email: `other-${randomUUID()}@example.com`,
      role: "staff",
    });
    expect(await pgErrorOf(accept(cara, forSomeoneElse.token))).toEqual({
      code: "P0001",
      message: "invite_email_mismatch",
    });

    expect(
      await pgErrorOf(accept(cara, randomBytes(32).toString("base64url"))),
    ).toEqual({ code: "P0001", message: "invite_not_found" });
  });

  it("accepting when already a member keeps the current role", async () => {
    const { ana, ben, ws } = await team();
    const token = randomBytes(32).toString("base64url");
    await testSql`
      insert into public.invitations (workspace_id, email, role, token_hash, invited_by, expires_at)
      values (${ws.id}, ${ben.email.toLowerCase()}, 'staff', ${hashInviteToken(token)}, ${ana.id}, now() + interval '7 days')`;
    expect(await accept(ben, token)).toBe(ws.slug);
    const roles = await adminDb
      .select({ role: memberships.role })
      .from(memberships)
      .where(
        and(eq(memberships.workspaceId, ws.id), eq(memberships.userId, ben.id)),
      );
    expect(roles).toEqual([{ role: "admin" }]);
  });
});

describe("previewing invites", () => {
  it("anyone with the link can preview it", async () => {
    const { ana, ws } = await team();
    const email = `p-${randomUUID()}@example.com`;
    const invite = await createTestInvite(ws.id, ana, { email, role: "staff" });
    expect(await preview(invite.token)).toEqual([
      {
        workspace_name: "Test Salon",
        workspace_slug: ws.slug,
        role: "staff",
        email,
        inviter_name: "Ana Lopez",
        status: "pending",
      },
    ]);
    expect(await preview(randomBytes(32).toString("base64url"))).toEqual([]);
  });

  it("the preview reports expired and accepted invites", async () => {
    const { ana, ws } = await team();
    const dan = await createTestUser();
    const expired = await createTestInvite(ws.id, ana, {
      email: `x-${randomUUID()}@example.com`,
      role: "staff",
      expiresAt: new Date(Date.now() - 60_000),
    });
    const accepted = await createTestInvite(ws.id, ana, {
      email: dan.email,
      role: "staff",
    });
    await accept(dan, accepted.token);
    expect((await preview(expired.token))[0]?.status).toBe("expired");
    expect((await preview(accepted.token))[0]?.status).toBe("accepted");
  });
});
