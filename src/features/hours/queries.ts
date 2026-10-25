import "server-only";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { type AuthClaims, withRls } from "@/db";
import { businessHours, closedDays } from "@/db/schema";
import { rowsToWeek, type WeeklyHours } from "./weekly-hours";

export async function getOpeningHours(
  claims: AuthClaims,
  workspaceId: string,
): Promise<WeeklyHours> {
  const rows = await withRls(claims, (tx) =>
    tx
      .select({
        weekday: businessHours.weekday,
        startMinute: businessHours.startMinute,
        endMinute: businessHours.endMinute,
      })
      .from(businessHours)
      .where(eq(businessHours.workspaceId, workspaceId)),
  );
  return rowsToWeek(rows);
}

/** Closed days from today onwards in the workspace's time zone, soonest first. */
export async function listClosedDays(
  claims: AuthClaims,
  workspaceId: string,
  timeZone: string,
): Promise<{ id: string; date: string; name: string }[]> {
  return withRls(claims, (tx) =>
    tx
      .select({
        id: closedDays.id,
        date: closedDays.date,
        name: closedDays.name,
      })
      .from(closedDays)
      .where(
        and(
          eq(closedDays.workspaceId, workspaceId),
          gte(closedDays.date, sql`(now() at time zone ${timeZone})::date`),
        ),
      )
      .orderBy(asc(closedDays.date)),
  );
}
