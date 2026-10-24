import "server-only";
import { eq, sql } from "drizzle-orm";
import { type AuthClaims, withRls } from "@/db";
import { getPgError, PG_UNIQUE_VIOLATION } from "@/db/errors";
import { auditLog, workspaces } from "@/db/schema";
import type { WorkspaceDetails } from "./schemas";
import { slugify, withRandomSuffix } from "./slug";

export type RecordResult = "ok" | "not_allowed";

const DETAIL_FIELDS = ["name", "website", "timezone", "currency"] as const;

// The plain slug first, then up to three suffixed ones.
const MAX_ATTEMPTS = 4;

/** Creates a workspace owned by the caller and returns its id and URL slug. */
export async function createWorkspaceRecord(
  claims: AuthClaims,
  input: WorkspaceDetails,
): Promise<{ id: string; slug: string }> {
  const base = slugify(input.name);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const slug = attempt === 0 ? base : withRandomSuffix(base);
    try {
      // Each attempt is its own transaction: a failed statement aborts the one it ran in.
      const [row] = await withRls(claims, (tx) =>
        tx.execute<{ id: string }>(
          sql`select private.create_workspace(${input.name}, ${slug}, ${input.website}, ${input.timezone}, ${input.currency}) as id`,
        ),
      );
      return { id: row.id, slug };
    } catch (err) {
      if (getPgError(err)?.code !== PG_UNIQUE_VIOLATION) throw err;
    }
  }
  throw new Error(`No free workspace URL for "${base}"`);
}

/** Saves new business details. Row level security decides who may; nothing is logged if refused. */
export async function updateWorkspaceRecord(
  claims: AuthClaims,
  workspaceId: string,
  input: WorkspaceDetails,
): Promise<RecordResult> {
  return withRls(claims, async (tx) => {
    const [before] = await tx
      .select({
        name: workspaces.name,
        website: workspaces.website,
        timezone: workspaces.timezone,
        currency: workspaces.currency,
      })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId));
    if (!before) return "not_allowed";

    const updated = await tx
      .update(workspaces)
      .set(input)
      .where(eq(workspaces.id, workspaceId))
      .returning({ id: workspaces.id });
    if (updated.length === 0) return "not_allowed";

    const changed = DETAIL_FIELDS.filter(
      (field) => before[field] !== input[field],
    );
    await tx.insert(auditLog).values({
      workspaceId,
      actorId: claims.sub,
      action: "workspace.updated",
      targetType: "workspace",
      targetId: workspaceId,
      metadata: { changed },
    });
    return "ok";
  });
}

export async function deleteWorkspaceRecord(
  claims: AuthClaims,
  workspaceId: string,
): Promise<RecordResult> {
  const deleted = await withRls(claims, (tx) =>
    tx
      .delete(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .returning({ id: workspaces.id }),
  );
  return deleted.length > 0 ? "ok" : "not_allowed";
}
