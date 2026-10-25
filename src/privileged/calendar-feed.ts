import "server-only";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { adminDb } from "@/db/admin";
import { bookings, customers, staff, workspaces } from "@/db/schema";
import { icsCalendar } from "@/lib/ics";

const DAY_MS = 86_400_000;

/**
 * A staff member's confirmed bookings as an iCalendar feed, from 30 days back to 180 days
 * ahead, or null for an unknown token. The token is the only credential.
 */
export async function staffCalendarFeed(token: string): Promise<string | null> {
  if (!token) return null;
  const [person] = await adminDb
    .select({
      id: staff.id,
      name: staff.name,
      workspaceId: staff.workspaceId,
      business: workspaces.name,
    })
    .from(staff)
    .innerJoin(workspaces, eq(workspaces.id, staff.workspaceId))
    .where(eq(staff.calendarToken, token));
  if (!person) return null;

  const now = new Date();
  const rows = await adminDb
    .select({
      id: bookings.id,
      serviceName: bookings.serviceName,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      notes: bookings.notes,
      customerName: customers.name,
    })
    .from(bookings)
    .leftJoin(
      customers,
      and(
        eq(customers.id, bookings.customerId),
        eq(customers.workspaceId, bookings.workspaceId),
      ),
    )
    .where(
      and(
        eq(bookings.staffId, person.id),
        eq(bookings.workspaceId, person.workspaceId),
        eq(bookings.status, "confirmed"),
        gte(bookings.startsAt, new Date(now.getTime() - 30 * DAY_MS)),
        lt(bookings.startsAt, new Date(now.getTime() + 180 * DAY_MS)),
      ),
    )
    .orderBy(asc(bookings.startsAt));

  return icsCalendar({
    method: "PUBLISH",
    name: `${person.name} at ${person.business}`,
    now,
    events: rows.map((row) => ({
      uid: `${row.id}@frontdesk-ai`,
      start: row.startsAt,
      end: row.endsAt,
      summary: `${row.serviceName} with ${row.customerName ?? "a customer"}`,
      description: row.notes || undefined,
    })),
  });
}
