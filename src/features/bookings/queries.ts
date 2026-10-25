import "server-only";
import { and, asc, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import { type AuthClaims, withRls } from "@/db";
import {
  type BookingStatus,
  bookings,
  customers,
  staff,
  staffHours,
  staffServices,
} from "@/db/schema";
import type { TimeRange, Weekday } from "@/features/hours/weekly-hours";
import { addDays, zonedDateTimeToUtc } from "@/lib/clock";

export type DayBooking = {
  id: string;
  staffId: string | null;
  staffName: string;
  serviceId: string | null;
  serviceName: string;
  startsAt: Date;
  endsAt: Date;
  status: BookingStatus;
  notes: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
};

/** Bookings that start on a local date, except cancelled ones, in time order. */
export async function listBookingsForDay(
  claims: AuthClaims,
  workspaceId: string,
  date: string,
  timeZone: string,
): Promise<DayBooking[]> {
  const dayStart = zonedDateTimeToUtc(date, "00:00", timeZone);
  const dayEnd = zonedDateTimeToUtc(addDays(date, 1), "00:00", timeZone);
  return withRls(claims, (tx) =>
    tx
      .select({
        id: bookings.id,
        staffId: bookings.staffId,
        staffName: bookings.staffName,
        serviceId: bookings.serviceId,
        serviceName: bookings.serviceName,
        startsAt: bookings.startsAt,
        endsAt: bookings.endsAt,
        status: bookings.status,
        notes: bookings.notes,
        customerName: customers.name,
        customerEmail: customers.email,
        customerPhone: customers.phone,
      })
      .from(bookings)
      .leftJoin(customers, eq(customers.id, bookings.customerId))
      .where(
        and(
          eq(bookings.workspaceId, workspaceId),
          ne(bookings.status, "cancelled"),
          gte(bookings.startsAt, dayStart),
          lt(bookings.startsAt, dayEnd),
        ),
      )
      .orderBy(asc(bookings.startsAt)),
  );
}

export type CalendarStaff = {
  id: string;
  name: string;
  /** Working ranges on the calendar's weekday. */
  hours: TimeRange[];
  serviceIds: string[];
};

/** Active staff in name order, with their hours that weekday and the services they do. */
export async function listCalendarStaff(
  claims: AuthClaims,
  workspaceId: string,
  weekday: Weekday,
): Promise<CalendarStaff[]> {
  return withRls(claims, async (tx) => {
    const people = await tx
      .select({ id: staff.id, name: staff.name })
      .from(staff)
      .where(and(eq(staff.workspaceId, workspaceId), eq(staff.active, true)))
      .orderBy(asc(sql`lower(${staff.name})`));
    if (people.length === 0) return [];
    const ids = people.map((person) => person.id);
    const [hours, links] = await Promise.all([
      tx
        .select({
          staffId: staffHours.staffId,
          start: staffHours.startMinute,
          end: staffHours.endMinute,
        })
        .from(staffHours)
        .where(
          and(
            inArray(staffHours.staffId, ids),
            eq(staffHours.weekday, weekday),
          ),
        )
        .orderBy(asc(staffHours.startMinute)),
      tx
        .select({
          staffId: staffServices.staffId,
          serviceId: staffServices.serviceId,
        })
        .from(staffServices)
        .where(inArray(staffServices.staffId, ids)),
    ]);
    return people.map((person) => ({
      ...person,
      hours: hours
        .filter((row) => row.staffId === person.id)
        .map(({ start, end }) => ({ start, end })),
      serviceIds: links
        .filter((row) => row.staffId === person.id)
        .map((row) => row.serviceId),
    }));
  });
}
