import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { type AuthClaims, withRls } from "@/db";
import { getPgError, PG_INSUFFICIENT_PRIVILEGE, PG_RAISE } from "@/db/errors";
import {
  auditLog,
  invitations,
  memberships,
  profiles,
  type WorkspaceRole,
} from "@/db/schema";
import { getMyRole } from "@/features/workspaces/access";
import { canManageTeam } from "@/features/workspaces/permissions";
import { createInviteToken, inviteExpiresAt } from "./invite-token";

export type InviteError =
  | "invite_not_found"
  | "invite_revoked"
  | "invite_used"
  | "invite_expired"
  | "invite_email_mismatch";

const INVITE_ERRORS = new Set<string>([
  "invite_not_found",
  "invite_revoked",
  "invite_used",
  "invite_expired",
  "invite_email_mismatch",
]);

/** Thrown inside a transaction to roll it back when row level security refuses a write. */
class Refused extends Error {}

/** Maps the database's refusals to results; anything else is a real error. */
function refusal(err: unknown): "not_allowed" | "last_owner" | null {
  if (err instanceof Refused) return "not_allowed";
  const pg = getPgError(err);
  if (pg?.code === PG_RAISE && pg.message === "last_owner") return "last_owner";
  if (pg?.code === PG_INSUFFICIENT_PRIVILEGE) return "not_allowed";
  return null;
}

/** Creates an invite and returns its raw token, which is shown once and never stored. */
export async function createInviteRecord(
  claims: AuthClaims,
  workspaceId: string,
  input: { email: string; role: "admin" | "staff" },
): Promise<
  | { ok: true; token: string }
  | { ok: false; error: "not_allowed" | "already_member" }
> {
  const email = input.email.trim().toLowerCase();
  try {
    return await withRls(claims, async (tx) => {
      const role = await getMyRole(tx, claims, workspaceId);
      if (!role || !canManageTeam(role)) {
        return { ok: false, error: "not_allowed" } as const;
      }

      const [existing] = await tx
        .select({ id: memberships.id })
        .from(memberships)
        .innerJoin(profiles, eq(profiles.id, memberships.userId))
        .where(
          and(
            eq(memberships.workspaceId, workspaceId),
            eq(sql`lower(${profiles.email})`, email),
          ),
        );
      if (existing) return { ok: false, error: "already_member" } as const;

      // Only one pending invite per email: a new one cancels the old link.
      await tx
        .update(invitations)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(invitations.workspaceId, workspaceId),
            eq(invitations.email, email),
            isNull(invitations.acceptedAt),
            isNull(invitations.revokedAt),
          ),
        );

      const { token, tokenHash } = createInviteToken();
      const [invite] = await tx
        .insert(invitations)
        .values({
          workspaceId,
          email,
          role: input.role,
          tokenHash,
          invitedBy: claims.sub,
          expiresAt: inviteExpiresAt(new Date()),
        })
        .returning({ id: invitations.id });
      await tx.insert(auditLog).values({
        workspaceId,
        actorId: claims.sub,
        action: "invite.created",
        targetType: "invitation",
        targetId: invite.id,
        metadata: { email, role: input.role },
      });
      return { ok: true, token } as const;
    });
  } catch (err) {
    if (refusal(err) === "not_allowed")
      return { ok: false, error: "not_allowed" };
    throw err;
  }
}

export async function revokeInviteRecord(
  claims: AuthClaims,
  workspaceId: string,
  inviteId: string,
): Promise<"ok" | "not_allowed"> {
  return withRls(claims, async (tx) => {
    const revoked = await tx
      .update(invitations)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(invitations.id, inviteId),
          eq(invitations.workspaceId, workspaceId),
          isNull(invitations.acceptedAt),
          isNull(invitations.revokedAt),
        ),
      )
      .returning({ id: invitations.id });
    if (revoked.length === 0) return "not_allowed";
    await tx.insert(auditLog).values({
      workspaceId,
      actorId: claims.sub,
      action: "invite.revoked",
      targetType: "invitation",
      targetId: inviteId,
    });
    return "ok";
  });
}

export async function changeRoleRecord(
  claims: AuthClaims,
  workspaceId: string,
  membershipId: string,
  role: WorkspaceRole,
): Promise<"ok" | "not_allowed" | "last_owner"> {
  try {
    return await withRls(claims, async (tx) => {
      const where = and(
        eq(memberships.id, membershipId),
        eq(memberships.workspaceId, workspaceId),
      );
      const [target] = await tx
        .select({ role: memberships.role })
        .from(memberships)
        .where(where);
      if (!target) return "not_allowed";
      const updated = await tx
        .update(memberships)
        .set({ role })
        .where(where)
        .returning({ id: memberships.id });
      if (updated.length === 0) return "not_allowed";
      await tx.insert(auditLog).values({
        workspaceId,
        actorId: claims.sub,
        action: "member.role_changed",
        targetType: "membership",
        targetId: membershipId,
        metadata: { from: target.role, to: role },
      });
      return "ok";
    });
  } catch (err) {
    const result = refusal(err);
    if (result) return result;
    throw err;
  }
}

/** Removes a member, or lets someone leave. Their access ends with this transaction. */
export async function removeMemberRecord(
  claims: AuthClaims,
  workspaceId: string,
  membershipId: string,
): Promise<"ok" | "not_allowed" | "last_owner"> {
  try {
    return await withRls(claims, async (tx) => {
      const where = and(
        eq(memberships.id, membershipId),
        eq(memberships.workspaceId, workspaceId),
      );
      const [target] = await tx
        .select({ userId: memberships.userId })
        .from(memberships)
        .where(where);
      if (!target) return "not_allowed";
      const isSelf = target.userId === claims.sub;
      // Logged first: the insert policy needs the actor to still be a member.
      await tx.insert(auditLog).values({
        workspaceId,
        actorId: claims.sub,
        action: isSelf ? "member.left" : "member.removed",
        targetType: "membership",
        targetId: membershipId,
        metadata: { userId: target.userId },
      });
      const deleted = await tx
        .delete(memberships)
        .where(where)
        .returning({ id: memberships.id });
      // Refused by row level security: roll back the audit row too.
      if (deleted.length === 0) throw new Refused();
      return "ok";
    });
  } catch (err) {
    const result = refusal(err);
    if (result) return result;
    throw err;
  }
}

export async function acceptInviteRecord(
  claims: AuthClaims,
  token: string,
): Promise<{ ok: true; slug: string } | { ok: false; error: InviteError }> {
  try {
    const [row] = await withRls(claims, (tx) =>
      tx.execute<{ slug: string }>(
        sql`select private.accept_invitation(${token}) as slug`,
      ),
    );
    return { ok: true, slug: row.slug };
  } catch (err) {
    const pg = getPgError(err);
    if (pg?.code === PG_RAISE && INVITE_ERRORS.has(pg.message)) {
      return { ok: false, error: pg.message as InviteError };
    }
    throw err;
  }
}
