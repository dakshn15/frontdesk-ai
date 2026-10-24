import "server-only";
import { asc, eq } from "drizzle-orm";
import { type AuthClaims, withRls } from "@/db";
import { memberships, type WorkspaceRole, workspaces } from "@/db/schema";

export async function listMyWorkspaces(
  claims: AuthClaims,
): Promise<{ id: string; name: string; slug: string; role: WorkspaceRole }[]> {
  return withRls(claims, (tx) =>
    tx
      .select({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
      .where(eq(memberships.userId, claims.sub))
      .orderBy(asc(memberships.createdAt)),
  );
}
