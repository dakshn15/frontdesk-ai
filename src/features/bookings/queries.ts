import "server-only";
import { and, asc, eq, gte, lt, ne } from "drizzle-orm";
import { type AuthClaims, withRls } from "@/db";
import { type BookingStatus, bookings, customers } from "@/db/schema";
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
