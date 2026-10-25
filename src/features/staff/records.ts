import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { type AuthClaims, type RlsTx, withRls } from "@/db";
import {
  getPgError,
  PG_FOREIGN_KEY_VIOLATION,
  PG_UNIQUE_VIOLATION,
} from "@/db/errors";
import {
  bookings,
  staff,
  staffHours,
  staffServices,
  staffTimeOff,
} from "@/db/schema";
import { type WeeklyHours, weekToRows } from "@/features/hours/weekly-hours";
import { assertManager, Refused } from "@/features/workspaces/access";
import type { StaffProfile } from "./schemas";

type Allowed = "ok" | "not_allowed";

/** Maps refusals and broken links to "not_allowed", a second link to the same login to "member_already_linked". */
function profileError(
  err: unknown,
): "not_allowed" | "member_already_linked" | null {
  if (err instanceof Refused) return "not_allowed";
  const code = getPgError(err)?.code;
  if (code === PG_UNIQUE_VIOLATION) return "member_already_linked";
  if (code === PG_FOREIGN_KEY_VIOLATION) return "not_allowed";
  return null;
}

/** Runs `fn` for a manager on one of the workspace's staff; Refused otherwise. */
async function onStaff<T>(
  claims: AuthClaims,
  workspaceId: string,
  staffId: string,
  fn: (tx: RlsTx) => Promise<T>,
): Promise<T> {
  return withRls(claims, async (tx) => {
    await assertManager(tx, claims, workspaceId);
    const [found] = await tx
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.id, staffId), eq(staff.workspaceId, workspaceId)));
    if (!found) throw new Refused();
    return fn(tx);
  });
}

async function allowed(work: Promise<unknown>): Promise<Allowed> {
  try {
    await work;
    return "ok";
  } catch (err) {
    if (err instanceof Refused) return "not_allowed";
    if (getPgError(err)?.code === PG_FOREIGN_KEY_VIOLATION)
      return "not_allowed";
    throw err;
  }
}

export async function createStaffRecord(
  claims: AuthClaims,
  workspaceId: string,
  profile: StaffProfile,
): Promise<
  | { ok: true; id: string }
  | { ok: false; error: "not_allowed" | "member_already_linked" }
> {
  try {
    const id = await withRls(claims, async (tx) => {
      await assertManager(tx, claims, workspaceId);
      const [row] = await tx
        .insert(staff)
        .values({ workspaceId, ...profile })
        .returning({ id: staff.id });
      return row.id;
    });
    return { ok: true, id };
  } catch (err) {
    const error = profileError(err);
    if (error) return { ok: false, error };
    throw err;
  }
}

export async function updateStaffProfileRecord(
  claims: AuthClaims,
  workspaceId: string,
  staffId: string,
  profile: StaffProfile,
): Promise<"ok" | "not_allowed" | "member_already_linked"> {
  try {
    const updated = await withRls(claims, (tx) =>
      tx
        .update(staff)
        .set(profile)
        .where(and(eq(staff.id, staffId), eq(staff.workspaceId, workspaceId)))
        .returning({ id: staff.id }),
    );
    return updated.length > 0 ? "ok" : "not_allowed";
  } catch (err) {
    const error = profileError(err);
    if (error) return error;
    throw err;
  }
}

/** Deletes a staff member unless they still have appointments coming up. */
export async function deleteStaffRecord(
  claims: AuthClaims,
  workspaceId: string,
  staffId: string,
): Promise<Allowed | "has_upcoming_bookings"> {
  return withRls(claims, async (tx) => {
    const [upcoming] = await tx
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.staffId, staffId),
          eq(bookings.workspaceId, workspaceId),
          eq(bookings.status, "confirmed"),
          gt(bookings.startsAt, sql`now()`),
        ),
      )
      .limit(1);
    if (upcoming) return "has_upcoming_bookings";
    const deleted = await tx
      .delete(staff)
      .where(and(eq(staff.id, staffId), eq(staff.workspaceId, workspaceId)))
      .returning({ id: staff.id });
    return deleted.length > 0 ? "ok" : "not_allowed";
  });
}

/** Replaces which services this person performs. */
export async function setStaffServicesRecord(
  claims: AuthClaims,
  workspaceId: string,
  staffId: string,
  serviceIds: string[],
): Promise<Allowed> {
  return allowed(
    onStaff(claims, workspaceId, staffId, async (tx) => {
      await tx
        .delete(staffServices)
        .where(
          and(
            eq(staffServices.staffId, staffId),
            eq(staffServices.workspaceId, workspaceId),
          ),
        );
      const unique = [...new Set(serviceIds)];
      if (unique.length > 0) {
        await tx
          .insert(staffServices)
          .values(
            unique.map((serviceId) => ({ workspaceId, staffId, serviceId })),
          );
      }
    }),
  );
}

/** Replaces this person's whole week in one transaction. */
export async function replaceStaffHoursRecord(
  claims: AuthClaims,
  workspaceId: string,
  staffId: string,
  hours: WeeklyHours,
): Promise<Allowed> {
  return allowed(
    onStaff(claims, workspaceId, staffId, async (tx) => {
      await tx
        .delete(staffHours)
        .where(
          and(
            eq(staffHours.staffId, staffId),
            eq(staffHours.workspaceId, workspaceId),
          ),
        );
      const rows = weekToRows(hours).map((row) => ({
        workspaceId,
        staffId,
        ...row,
      }));
      if (rows.length > 0) await tx.insert(staffHours).values(rows);
    }),
  );
}

export async function addTimeOffRecord(
  claims: AuthClaims,
  workspaceId: string,
  staffId: string,
  range: { startsAt: Date; endsAt: Date; note: string },
): Promise<Allowed> {
  return allowed(
    onStaff(claims, workspaceId, staffId, (tx) =>
      tx.insert(staffTimeOff).values({ workspaceId, staffId, ...range }),
    ),
  );
}

export async function deleteTimeOffRecord(
  claims: AuthClaims,
  workspaceId: string,
  timeOffId: string,
): Promise<Allowed> {
  const deleted = await withRls(claims, (tx) =>
    tx
      .delete(staffTimeOff)
      .where(
        and(
          eq(staffTimeOff.id, timeOffId),
          eq(staffTimeOff.workspaceId, workspaceId),
        ),
      )
      .returning({ id: staffTimeOff.id }),
  );
  return deleted.length > 0 ? "ok" : "not_allowed";
}
