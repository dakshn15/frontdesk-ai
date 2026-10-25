import "server-only";
import { and, eq } from "drizzle-orm";
import type { AuthClaims, RlsTx } from "@/db";
import { memberships, type WorkspaceRole } from "@/db/schema";

/** The caller's role in this workspace, read inside the caller's own transaction. */
export async function getMyRole(
  tx: RlsTx,
  claims: AuthClaims,
  workspaceId: string,
): Promise<WorkspaceRole | null> {
  const [row] = await tx
    .select({ role: memberships.role })
    .from(memberships)
    .where(
      and(
        eq(memberships.workspaceId, workspaceId),
        eq(memberships.userId, claims.sub),
      ),
    );
  return row?.role ?? null;
}

/** Thrown inside a transaction to roll it back when the caller isn't allowed. */
export class Refused extends Error {}

/** Throws Refused unless the caller is an owner or admin of the workspace. */
export async function assertManager(
  tx: RlsTx,
  claims: AuthClaims,
  workspaceId: string,
): Promise<void> {
  const role = await getMyRole(tx, claims, workspaceId);
  if (role !== "owner" && role !== "admin") throw new Refused();
}
