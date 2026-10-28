import "server-only";
import { lt, sql } from "drizzle-orm";
import { adminDb } from "@/db/admin";
import { rateLimitWindows } from "@/db/schema";

/**
 * Counts a request against `key` in a fixed window and says whether it's within `limit`.
 * One upsert per call, so concurrent requests are counted exactly.
 */
export async function allowRequest(
  key: string,
  limit: number,
  windowSeconds: number,
  now = new Date(),
): Promise<boolean> {
  const size = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / size) * size);
  const [row] = await adminDb
    .insert(rateLimitWindows)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimitWindows.key, rateLimitWindows.windowStart],
      set: { count: sql`${rateLimitWindows.count} + 1` },
    })
    .returning({ count: rateLimitWindows.count });
  // Now and then, drop windows that have closed.
  if (Math.random() < 0.01) await pruneRateLimits(now);
  return row.count <= limit;
}

/** The longest window any caller uses (the monthly limit email), plus a margin. */
const KEEP_MS = 45 * 86_400_000;

/** Deletes windows old enough that none of them can still be counting. */
export async function pruneRateLimits(now = new Date()): Promise<void> {
  await adminDb
    .delete(rateLimitWindows)
    .where(lt(rateLimitWindows.windowStart, new Date(now.getTime() - KEEP_MS)));
}
