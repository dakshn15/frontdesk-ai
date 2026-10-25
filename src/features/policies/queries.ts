import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { type AuthClaims, withRls } from "@/db";
import { type PolicyKind, policies } from "@/db/schema";

export type Policy = {
  id: string;
  kind: PolicyKind;
  title: string;
  body: string;
};

/** Standard policies in their fixed order, then custom ones oldest first. */
export async function listPolicies(
  claims: AuthClaims,
  workspaceId: string,
): Promise<Policy[]> {
  return withRls(claims, (tx) =>
    tx
      .select({
        id: policies.id,
        kind: policies.kind,
        title: policies.title,
        body: policies.body,
      })
      .from(policies)
      .where(eq(policies.workspaceId, workspaceId))
      .orderBy(
        asc(policies.kind),
        asc(policies.createdAt),
        asc(sql`lower(${policies.title})`),
      ),
  );
}
