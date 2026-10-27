import { localMinutes } from "@/features/bookings/calendar-layout";
import { isoWeekday, localDate } from "@/lib/clock";

type HoursRow = { weekday: number; startMinute: number; endMinute: number };

/**
 * Whether the business is open at `now` in its own time zone. With no opening hours set,
 * it counts as open: the widget shouldn't claim the team is away when it can't know.
 */
export function isOpenAt(
  hours: readonly HoursRow[],
  closedDates: readonly string[],
  timeZone: string,
  now: Date,
): boolean {
  if (hours.length === 0) return true;
  const date = localDate(timeZone, now);
  if (closedDates.includes(date)) return false;
  const weekday = isoWeekday(date);
  const minute = localMinutes(now, timeZone);
  return hours.some(
    (row) =>
      row.weekday === weekday &&
      row.startMinute <= minute &&
      minute < row.endMinute,
  );
}
