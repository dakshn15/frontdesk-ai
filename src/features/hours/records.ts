import "server-only";
import { and, eq } from "drizzle-orm";
import { type AuthClaims, withRls } from "@/db";
import { getPgError, PG_UNIQUE_VIOLATION } from "@/db/errors";
import { businessHours, closedDays } from "@/db/schema";
import { assertManager, Refused } from "@/features/workspaces/access";
import type { ClosedDayInput } from "./schemas";
import { type WeeklyHours, weekToRows } from "./weekly-hours";

/** Replaces the whole week of opening hours in one transaction. */
export async function replaceOpeningHoursRecord(
  claims: AuthClaims,
  workspaceId: string,
  hours: WeeklyHours,
): Promise<"ok" | "not_allowed"> {
  try {
    await withRls(claims, async (tx) => {
      await assertManager(tx, claims, workspaceId);
      await tx
        .delete(businessHours)
        .where(eq(businessHours.workspaceId, workspaceId));
      const rows = weekToRows(hours).map((row) => ({ workspaceId, ...row }));
      if (rows.length > 0) await tx.insert(businessHours).values(rows);
    });
    return "ok";
  } catch (err) {
    if (err instanceof Refused) return "not_allowed";
    throw err;
  }
}

export async function addClosedDayRecord(
  claims: AuthClaims,
  workspaceId: string,
  input: ClosedDayInput,
): Promise<"ok" | "not_allowed" | "duplicate_date"> {
  try {
    await withRls(claims, async (tx) => {
      await assertManager(tx, claims, workspaceId);
      await tx.insert(closedDays).values({ workspaceId, ...input });
    });
    return "ok";
  } catch (err) {
    if (err instanceof Refused) return "not_allowed";
    if (getPgError(err)?.code === PG_UNIQUE_VIOLATION) return "duplicate_date";
    throw err;
  }
}

export async function deleteClosedDayRecord(
  claims: AuthClaims,
  workspaceId: string,
  closedDayId: string,
): Promise<"ok" | "not_allowed"> {
  const deleted = await withRls(claims, (tx) =>
    tx
      .delete(closedDays)
      .where(
        and(
          eq(closedDays.id, closedDayId),
          eq(closedDays.workspaceId, workspaceId),
        ),
      )
      .returning({ id: closedDays.id }),
  );
  return deleted.length > 0 ? "ok" : "not_allowed";
}
