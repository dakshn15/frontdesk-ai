import {
  blockPosition,
  gridRange,
  localMinutes,
} from "@/features/bookings/calendar-layout";
import type { TimeRange } from "@/features/hours/weekly-hours";
import { formatClock } from "@/lib/clock";
import { BookingBlock, type CalendarBooking } from "./booking-dialog";
import type { StaffOption } from "./new-booking-dialog";

const HOUR_HEIGHT_REM = 4;

export type GridColumn = { key: string; name: string; hours: TimeRange[] };

/** One day: a column per person, their working hours shaded in, bookings placed on top. */
export function DayGrid({
  slug,
  timeZone,
  columns,
  bookings,
  staff,
}: {
  slug: string;
  timeZone: string;
  columns: GridColumn[];
  bookings: CalendarBooking[];
  staff: StaffOption[];
}) {
  const local = (iso: string) => localMinutes(new Date(iso), timeZone);
  const range = gridRange(
    columns.flatMap((column) => column.hours),
    bookings.map((b) => ({ start: local(b.startsAt), end: local(b.endsAt) })),
  );
  const hours: number[] = [];
  for (let minute = range.start; minute < range.end; minute += 60) {
    hours.push(minute);
  }
  const height = `${(hours.length * HOUR_HEIGHT_REM).toString()}rem`;
  // Hour lines behind everything.
  const lines = {
    backgroundImage: `repeating-linear-gradient(to bottom, var(--border) 0 1px, transparent 1px ${HOUR_HEIGHT_REM}rem)`,
  };

  return (
    <div className="overflow-x-auto rounded-xl border">
      <div
        className="grid min-w-max"
        style={{
          gridTemplateColumns: `4.5rem repeat(${columns.length}, minmax(10rem, 1fr))`,
        }}
      >
        <div className="sticky left-0 z-20 border-b bg-background" />
        {columns.map((column) => (
          <div
            key={column.key}
            className="truncate border-b border-l px-3 py-2 text-sm font-medium"
          >
            {column.name}
          </div>
        ))}

        <div className="sticky left-0 z-20 bg-background" style={{ height }}>
          {hours.map((minute) => (
            <div
              key={minute}
              className="pr-2 pt-1 text-right text-xs text-muted-foreground"
              style={{ height: `${HOUR_HEIGHT_REM}rem` }}
            >
              {formatClock(minute)}
            </div>
          ))}
        </div>
        {columns.map((column) => (
          <div
            key={column.key}
            className="relative border-l bg-muted/40"
            style={{ height, ...lines }}
          >
            {column.hours.map((working) => {
              const { top, height: share } = blockPosition(
                range,
                working.start,
                working.end,
              );
              return (
                <div
                  key={working.start}
                  aria-hidden
                  className="absolute inset-x-0 bg-background/90"
                  style={{ top: `${top}%`, height: `${share}%` }}
                />
              );
            })}
            {bookings
              .filter((booking) => (booking.staffId ?? "none") === column.key)
              .map((booking) => {
                const { top, height: share } = blockPosition(
                  range,
                  local(booking.startsAt),
                  local(booking.endsAt),
                );
                return (
                  <BookingBlock
                    key={booking.id}
                    slug={slug}
                    booking={booking}
                    timeZone={timeZone}
                    staff={staff}
                    style={{ top: `${top}%`, height: `${share}%` }}
                  />
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}
