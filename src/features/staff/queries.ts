import "server-only";
import { and, asc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { type AuthClaims, withRls } from "@/db";
import {
  memberships,
  profiles,
  staff,
  staffHours,
  staffServices,
  staffTimeOff,
} from "@/db/schema";
import { rowsToWeek, type WeeklyHours } from "@/features/hours/weekly-hours";

export type StaffSummary = {
  id: string;
  name: string;
  title: string;
  active: boolean;
  userId: string | null;
  serviceCount: number;
  hasHours: boolean;
};

export type StaffDetail = {
  profile: StaffSummary & { bio: string; calendarToken: string };
  serviceIds: string[];
  hours: WeeklyHours;
  timeOff: { id: string; startsAt: Date; endsAt: Date; note: string }[];
  linkableMembers: { userId: string; name: string }[];
};

// Drizzle writes column names without their table in a single-table select, so these
// correlated subqueries name their tables in plain SQL: `staff.id` is the outer row.
const summaryColumns = {
  id: staff.id,
  name: staff.name,
  title: staff.title,
  active: staff.active,
  userId: staff.userId,
  serviceCount: sql<number>`(select count(*)::int from public.staff_services ss where ss.staff_id = staff.id)`,
  hasHours: sql<boolean>`exists (select 1 from public.staff_hours sh where sh.staff_id = staff.id)`,
};

export async function listStaff(
  claims: AuthClaims,
  workspaceId: string,
): Promise<StaffSummary[]> {
  return withRls(claims, (tx) =>
    tx
      .select(summaryColumns)
      .from(staff)
      .where(eq(staff.workspaceId, workspaceId))
      .orderBy(asc(sql`lower(${staff.name})`)),
  );
}

export async function getStaffDetail(
  claims: AuthClaims,
  workspaceId: string,
  staffId: string,
): Promise<StaffDetail | null> {
  return withRls(claims, async (tx) => {
    const [profile] = await tx
      .select({
        ...summaryColumns,
        bio: staff.bio,
        calendarToken: staff.calendarToken,
      })
      .from(staff)
      .where(and(eq(staff.id, staffId), eq(staff.workspaceId, workspaceId)));
    if (!profile) return null;

    const [serviceRows, hourRows, timeOff, members] = await Promise.all([
      tx
        .select({ serviceId: staffServices.serviceId })
        .from(staffServices)
        .where(eq(staffServices.staffId, staffId)),
      tx
        .select({
          weekday: staffHours.weekday,
          startMinute: staffHours.startMinute,
          endMinute: staffHours.endMinute,
        })
        .from(staffHours)
        .where(eq(staffHours.staffId, staffId)),
      tx
        .select({
          id: staffTimeOff.id,
          startsAt: staffTimeOff.startsAt,
          endsAt: staffTimeOff.endsAt,
          note: staffTimeOff.note,
        })
        .from(staffTimeOff)
        .where(
          and(
            eq(staffTimeOff.staffId, staffId),
            gt(staffTimeOff.endsAt, sql`now()`),
          ),
        )
        .orderBy(asc(staffTimeOff.startsAt)),
      // Members not linked to any other staff profile (this one's link stays available).
      tx
        .select({
          userId: memberships.userId,
          fullName: profiles.fullName,
          email: profiles.email,
        })
        .from(memberships)
        .innerJoin(profiles, eq(profiles.id, memberships.userId))
        .leftJoin(
          staff,
          and(
            eq(staff.userId, memberships.userId),
            eq(staff.workspaceId, workspaceId),
          ),
        )
        .where(
          and(
            eq(memberships.workspaceId, workspaceId),
            or(isNull(staff.id), eq(staff.id, staffId)),
          ),
        )
        .orderBy(asc(sql`lower(${profiles.fullName})`)),
    ]);

    return {
      profile,
      serviceIds: serviceRows.map((row) => row.serviceId),
      hours: rowsToWeek(hourRows),
      timeOff,
      linkableMembers: members.map((m) => ({
        userId: m.userId,
        name: m.fullName || m.email,
      })),
    };
  });
}
