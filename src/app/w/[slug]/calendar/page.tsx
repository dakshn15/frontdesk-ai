import { format, parseISO } from "date-fns";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import {
  listBookingsForDay,
  listCalendarStaff,
} from "@/features/bookings/queries";
import { listServices } from "@/features/services/queries";
import { canEditWorkspace } from "@/features/workspaces/permissions";
import { requireMembership } from "@/lib/auth/session";
import { isoWeekday, localDate } from "@/lib/clock";
import { DateNav } from "./date-nav";
import { type GridColumn, DayGrid } from "./day-grid";
import { NewBookingDialog } from "./new-booking-dialog";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage({
  params,
  searchParams,
}: PageProps<"/w/[slug]/calendar">) {
  const { slug } = await params;
  const { claims, membership } = await requireMembership(slug);
  const { workspace } = membership;
  const today = localDate(workspace.timezone);
  const requested = z.iso.date().safeParse((await searchParams).date);
  const date = requested.success ? requested.data : today;

  const [staff, dayBookings, services] = await Promise.all([
    listCalendarStaff(claims, workspace.id, isoWeekday(date)),
    listBookingsForDay(claims, workspace.id, date, workspace.timezone),
    listServices(claims, workspace.id),
  ]);

  // Everyone active gets a column, plus anyone else who has a booking that day.
  const columns: GridColumn[] = staff.map((person) => ({
    key: person.id,
    name: person.name,
    hours: person.hours,
  }));
  for (const booking of dayBookings) {
    const key = booking.staffId ?? "none";
    if (!columns.some((column) => column.key === key)) {
      columns.push({
        key,
        name: booking.staffId ? booking.staffName : "Former staff",
        hours: [],
      });
    }
  }
  const staffOptions = staff.map(({ id, name, serviceIds }) => ({
    id,
    name,
    serviceIds,
  }));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
            Calendar
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {format(parseISO(date), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
        {services.length > 0 && staff.length > 0 ? (
          <NewBookingDialog
            slug={workspace.slug}
            date={date}
            timeZone={workspace.timezone}
            services={services.map(({ id, name }) => ({ id, name }))}
            staff={staffOptions}
          />
        ) : null}
      </div>
      <div className="mt-6">
        <DateNav slug={workspace.slug} date={date} today={today} />
      </div>
      <div className="mt-4">
        {columns.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            No staff yet.{" "}
            {canEditWorkspace(membership.role) ? (
              <>
                <Link
                  href={`/w/${workspace.slug}/staff`}
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  Add staff
                </Link>{" "}
                with their hours and services to start booking.
              </>
            ) : (
              "An owner or admin needs to add staff before bookings can be made."
            )}
          </p>
        ) : (
          <DayGrid
            slug={workspace.slug}
            timeZone={workspace.timezone}
            columns={columns}
            staff={staffOptions}
            bookings={dayBookings.map((booking) => ({
              ...booking,
              startsAt: booking.startsAt.toISOString(),
              endsAt: booking.endsAt.toISOString(),
            }))}
          />
        )}
      </div>
    </div>
  );
}
