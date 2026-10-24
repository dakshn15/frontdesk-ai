import "server-only";
import { count, eq } from "drizzle-orm";
import { type AuthClaims, withRls } from "@/db";
import { memberships } from "@/db/schema";

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
