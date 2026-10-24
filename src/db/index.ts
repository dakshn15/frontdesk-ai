import "server-only";
import { sql } from "drizzle-orm";
import { db } from "./connection";

export type AuthClaims = { sub: string; email?: string } & Record<
  string,
  unknown
>;
export type RlsTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Runs `fn` in one transaction as the signed-in user, so Postgres row level security applies.
 * Pass `null` to run as an anonymous visitor. The role always comes from whether there are
 * claims, never from a `role` claim, so a token can't ask for more access.
 */
export async function withRls<T>(
  claims: AuthClaims | null,
  fn: (tx: RlsTx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const claimsJson = JSON.stringify(
      claims ? { ...claims, role: "authenticated" } : { role: "anon" },
    );
    await tx.execute(
      sql`select set_config('request.jwt.claims', ${claimsJson}, true), set_config('request.jwt.claim.sub', ${claims?.sub ?? ""}, true)`,
    );
    // `set local` ends with the transaction, so the pooled connection goes back clean.
    await tx.execute(
      sql.raw(claims ? "set local role authenticated" : "set local role anon"),
    );
    return fn(tx);
  });
}
