import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { type AuthClaims, withRls } from "@/db";
import { policies } from "@/db/schema";
import { assertManager, Refused } from "@/features/workspaces/access";
import type { PolicyInput } from "./schemas";

/**
 * Saves a policy. A standard kind is inserted or updated in place (one per workspace); a
 * custom policy is inserted, or updated by id.
 */
export async function savePolicyRecord(
  claims: AuthClaims,
  workspaceId: string,
  input: PolicyInput,
): Promise<"ok" | "not_allowed"> {
  const { id, kind, title, body } = input;
  try {
    await withRls(claims, async (tx) => {
      await assertManager(tx, claims, workspaceId);
      if (kind !== "custom") {
        await tx
          .insert(policies)
          .values({ workspaceId, kind, title, body })
          .onConflictDoUpdate({
            target: [policies.workspaceId, policies.kind],
            targetWhere: sql`kind <> 'custom'`,
            set: { title, body, updatedAt: sql`now()` },
          });
        return;
      }
      if (!id) {
        await tx.insert(policies).values({ workspaceId, kind, title, body });
        return;
      }
      const updated = await tx
        .update(policies)
        .set({ title, body, updatedAt: sql`now()` })
        .where(
          and(
            eq(policies.id, id),
            eq(policies.workspaceId, workspaceId),
            eq(policies.kind, "custom"),
          ),
        )
        .returning({ id: policies.id });
      if (updated.length === 0) throw new Refused();
    });
    return "ok";
  } catch (err) {
    if (err instanceof Refused) return "not_allowed";
    throw err;
  }
}

export async function deletePolicyRecord(
  claims: AuthClaims,
  workspaceId: string,
  policyId: string,
): Promise<"ok" | "not_allowed"> {
  const deleted = await withRls(claims, (tx) =>
    tx
      .delete(policies)
      .where(
        and(eq(policies.id, policyId), eq(policies.workspaceId, workspaceId)),
      )
      .returning({ id: policies.id }),
  );
  return deleted.length > 0 ? "ok" : "not_allowed";
}
