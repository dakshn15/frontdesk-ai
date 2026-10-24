import "server-only";
import { and, asc, count, desc, eq, isNull, sql } from "drizzle-orm";
import { type AuthClaims, withRls } from "@/db";
import {
  invitations,
  memberships,
  profiles,
  type WorkspaceRole,
} from "@/db/schema";
import { type InviteStatus, inviteStatus } from "./invite-token";

export type Member = {
  membershipId: string;
  userId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  role: WorkspaceRole;
  joinedAt: Date;
};

export type PendingInvite = {
  id: string;
  email: string;
  role: "admin" | "staff";
  expiresAt: Date;
  status: InviteStatus;
};

export type InvitePreview = {
  workspaceName: string;
  workspaceSlug: string;
  role: WorkspaceRole;
  email: string;
  inviterName: string;
  status: InviteStatus;
};

export async function countMembers(
  claims: AuthClaims,
  workspaceId: string,
): Promise<number> {
  const [row] = await withRls(claims, (tx) =>
    tx
      .select({ total: count() })
      .from(memberships)
      .where(eq(memberships.workspaceId, workspaceId)),
  );
  return row?.total ?? 0;
}

/** Owners first, then admins, then staff, each sorted by name. */
export async function listMembers(
  claims: AuthClaims,
  workspaceId: string,
): Promise<Member[]> {
  return withRls(claims, (tx) =>
    tx
      .select({
        membershipId: memberships.id,
        userId: memberships.userId,
        fullName: profiles.fullName,
        email: profiles.email,
        avatarUrl: profiles.avatarUrl,
        role: memberships.role,
        joinedAt: memberships.createdAt,
      })
      .from(memberships)
      .innerJoin(profiles, eq(profiles.id, memberships.userId))
      .where(eq(memberships.workspaceId, workspaceId))
      .orderBy(
        sql`case ${memberships.role} when 'owner' then 0 when 'admin' then 1 else 2 end`,
        asc(sql`lower(${profiles.fullName})`),
        asc(profiles.email),
      ),
  );
}

/** Invites not yet accepted or cancelled, expired ones included. Empty for staff. */
export async function listPendingInvites(
  claims: AuthClaims,
  workspaceId: string,
): Promise<PendingInvite[]> {
  const rows = await withRls(claims, (tx) =>
    tx
      .select({
        id: invitations.id,
        email: invitations.email,
        role: invitations.role,
        expiresAt: invitations.expiresAt,
        acceptedAt: invitations.acceptedAt,
        revokedAt: invitations.revokedAt,
      })
      .from(invitations)
      .where(
        and(
          eq(invitations.workspaceId, workspaceId),
          isNull(invitations.acceptedAt),
          isNull(invitations.revokedAt),
        ),
      )
      .orderBy(desc(invitations.createdAt)),
  );
  const now = new Date();
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role === "admin" ? "admin" : "staff",
    expiresAt: row.expiresAt,
    status: inviteStatus(row, now),
  }));
}

/** What the invite page shows. Works signed out: the token is the secret. */
export async function getInvitePreview(
  claims: AuthClaims | null,
  token: string,
): Promise<InvitePreview | null> {
  const [row] = await withRls(claims, (tx) =>
    tx.execute<{
      workspace_name: string;
      workspace_slug: string;
      role: WorkspaceRole;
      email: string;
      inviter_name: string;
      status: InviteStatus;
    }>(sql`select * from private.invitation_preview(${token})`),
  );
  if (!row) return null;
  return {
    workspaceName: row.workspace_name,
    workspaceSlug: row.workspace_slug,
    role: row.role,
    email: row.email,
    inviterName: row.inviter_name,
    status: row.status,
  };
}
