import { existsSync } from "node:fs";
import postgres from "postgres";

export default async function checkDatabase() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const url = process.env.DATABASE_URL;
  const sql = url ? postgres(url, { max: 1, connect_timeout: 5 }) : null;
  try {
    if (!sql) throw new Error("DATABASE_URL is not set");
    await sql`select 1`;
  } catch {
    throw new Error(
      "Local Supabase isn't reachable. Start Docker Desktop, then run npm run db:start and npm run env:local.",
    );
  } finally {
    await sql?.end();
  }
}
