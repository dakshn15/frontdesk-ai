import "server-only";
import { sql } from "drizzle-orm";
import { type AuthClaims, withRls } from "@/db";
import { getPgError, PG_UNIQUE_VIOLATION } from "@/db/errors";
import type { WorkspaceDetails } from "./schemas";
import { slugify, withRandomSuffix } from "./slug";

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
