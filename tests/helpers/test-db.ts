// Test-only database access. It has its own connection and only type imports from src/,
// so both Vitest and Playwright can load it.
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Run npm run env:local.`);
  return value;
}

export const testSql = postgres(required("DATABASE_URL"), {
  max: 2,
  prepare: false,
  onnotice: () => {},
});

export const adminAuth = createClient(
  required("NEXT_PUBLIC_SUPABASE_URL"),
  required("SUPABASE_SECRET_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
).auth.admin;

/** Runs `fn` in a transaction as the given user (or anon), the same way withRls does. */
export async function asUser<T>(
  userId: string | null,
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  const claims = userId
    ? { sub: userId, role: "authenticated" }
    : { role: "anon" };
  const result = await testSql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true), set_config('request.jwt.claim.sub', ${userId ?? ""}, true)`;
    await tx.unsafe(
      userId ? "set local role authenticated" : "set local role anon",
    );
    return fn(tx);
  });
  return result as T;
}
