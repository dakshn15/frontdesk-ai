import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getServerEnv } from "@/env/server";
import * as schema from "./schema";

// Reuse one pool across hot reloads in development.
const globalForDb = globalThis as { __frontdeskSql?: postgres.Sql };

function createClient() {
  const env = getServerEnv();
  // `prepare: false` is required by Supabase's transaction pooler.
  return postgres(env.DATABASE_URL, { prepare: false, max: env.DB_POOL_MAX });
}

const client = globalForDb.__frontdeskSql ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.__frontdeskSql = client;

export const db = drizzle(client, { schema, casing: "snake_case" });
