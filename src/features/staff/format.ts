import { TZDate } from "@date-fns/tz";
import { format, subDays } from "date-fns";

const isMidnight = (date: Date) =>
  date.getHours() === 0 && date.getMinutes() === 0;
const sameDay = (a: Date, b: Date) =>
  format(a, "yyyy-MM-dd") === format(b, "yyyy-MM-dd");

/**
 * A time-off entry as the business sees it: whole days as dates ("Dec 24 – Dec 26, 2026"),
 * anything else with times. Whole days run from midnight to midnight in `timeZone`.
 */
export function formatTimeOff(
  startsAt: Date,
  endsAt: Date,
  timeZone: string,
): string {
  const start = new TZDate(startsAt, timeZone);
  const end = new TZDate(endsAt, timeZone);

  if (isMidnight(start) && isMidnight(end)) {
    const lastDay = subDays(end, 1);
    if (sameDay(start, lastDay)) return format(start, "MMM d, yyyy");
    const from =
      start.getFullYear() === lastDay.getFullYear()
        ? format(start, "MMM d")
        : format(start, "MMM d, yyyy");
    return `${from} – ${format(lastDay, "MMM d, yyyy")}`;
  }

  const from = format(start, "MMM d, yyyy, h:mm a");
  const to = sameDay(start, end)
    ? format(end, "h:mm a")
    : format(end, "MMM d, yyyy, h:mm a");
  return `${from} – ${to}`;
}
