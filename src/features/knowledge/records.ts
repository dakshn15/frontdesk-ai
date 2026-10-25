import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { type AuthClaims, withRls } from "@/db";
import { type KnowledgeKind, knowledgeSources } from "@/db/schema";
import { assertManager, Refused } from "@/features/workspaces/access";

export type NewSource = {
  kind: KnowledgeKind;
  title: string;
  url?: string;
  fileName?: string;
  content?: string;
};

/** Adds a source, queued for the pipeline. Owners and admins only. */
export async function addSourceRecord(
  claims: AuthClaims,
  workspaceId: string,
  source: NewSource,
): Promise<{ ok: true; id: string } | { ok: false; error: "not_allowed" }> {
  try {
    const id = await withRls(claims, async (tx) => {
      await assertManager(tx, claims, workspaceId);
      const [row] = await tx
        .insert(knowledgeSources)
        .values({ workspaceId, ...source, createdBy: claims.sub })
        .returning({ id: knowledgeSources.id });
      return row.id;
    });
    return { ok: true, id };
  } catch (err) {
    if (err instanceof Refused) return { ok: false, error: "not_allowed" };
    throw err;
  }
}

export async function deleteSourceRecord(
  claims: AuthClaims,
  workspaceId: string,
  sourceId: string,
): Promise<"ok" | "not_allowed"> {
  const deleted = await withRls(claims, (tx) =>
    tx
      .delete(knowledgeSources)
      .where(
        and(
          eq(knowledgeSources.id, sourceId),
          eq(knowledgeSources.workspaceId, workspaceId),
        ),
      )
      .returning({ id: knowledgeSources.id }),
  );
  return deleted.length > 0 ? "ok" : "not_allowed";
}

/** Queues a source to be processed again. */
export async function requeueSourceRecord(
  claims: AuthClaims,
  workspaceId: string,
  sourceId: string,
): Promise<"ok" | "not_allowed"> {
  const updated = await withRls(claims, (tx) =>
    tx
      .update(knowledgeSources)
      .set({ status: "queued", error: null, updatedAt: sql`now()` })
      .where(
        and(
          eq(knowledgeSources.id, sourceId),
          eq(knowledgeSources.workspaceId, workspaceId),
        ),
      )
      .returning({ id: knowledgeSources.id }),
  );
  return updated.length > 0 ? "ok" : "not_allowed";
}
