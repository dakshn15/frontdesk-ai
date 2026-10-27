import "server-only";
import { and, count, eq, gt, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { adminDb } from "@/db/admin";
import { memberships, workspaces } from "@/db/schema";
import { allowRequest } from "../rate-limit";
import { DEMO_LIMITS } from "./limits";
import { seedDemoWorkspace } from "./seed";

export type SandboxResult =
  | { ok: true; slug: string }
  | { ok: false; error: "not_anonymous" | "rate_limited" | "full" };

/**
 * The visitor's own copy of the demo salon. A returning visitor gets the one they have;
 * otherwise a new one, within the per-address limit and the cap on live sandboxes.
 */
export async function startSandbox(
  input: { userId: string; isAnonymous: boolean; ip: string },
  options: { maxLive?: number; now?: Date } = {},
): Promise<SandboxResult> {
  if (!input.isAnonymous) return { ok: false, error: "not_anonymous" };
  const now = options.now ?? new Date();
  const [existing] = await adminDb
    .select({ slug: workspaces.slug })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(
      and(
        eq(memberships.userId, input.userId),
        gt(workspaces.demoExpiresAt, now),
      ),
    )
    .limit(1);
  if (existing) return { ok: true, slug: existing.slug };

  const [{ live }] = await adminDb
    .select({ live: count() })
    .from(workspaces)
    .where(gt(workspaces.demoExpiresAt, now));
  if (live >= (options.maxLive ?? DEMO_LIMITS.maxLive))
    return { ok: false, error: "full" };
  const { limit, windowSeconds } = DEMO_LIMITS.sandboxesPerIp;
  if (!(await allowRequest(`demo:ip:${input.ip}`, limit, windowSeconds, now)))
    return { ok: false, error: "rate_limited" };

  const expiresAt = new Date(
    now.getTime() + DEMO_LIMITS.lifetimeHours * 3_600_000,
  );
  const { slug } = await seedDemoWorkspace(input.userId, expiresAt, now);
  return { ok: true, slug };
}

/**
 * Deletes expired sandboxes, then the anonymous users who no longer belong to any
 * workspace. Returns how many sandboxes went.
 */
export async function cleanupSandboxes(now = new Date()): Promise<number> {
  const expired = await adminDb
    .select({ id: workspaces.id, owner: memberships.userId })
    .from(workspaces)
    .leftJoin(memberships, eq(memberships.workspaceId, workspaces.id))
    .where(
      and(
        isNotNull(workspaces.demoExpiresAt),
        lte(workspaces.demoExpiresAt, now),
      ),
    );
  if (expired.length === 0) return 0;
  const ids = [...new Set(expired.map((row) => row.id))];
  const owners = [
    ...new Set(expired.flatMap((row) => (row.owner ? [row.owner] : []))),
  ];
  await adminDb.delete(workspaces).where(inArray(workspaces.id, ids));
  if (owners.length > 0) {
    // Profiles follow auth.users, so this removes the demo visitor completely.
    await adminDb.execute(sql`
      delete from auth.users u
      where u.id in ${owners} and u.is_anonymous
        and not exists (select 1 from public.memberships m where m.user_id = u.id)`);
  }
  return ids.length;
}
