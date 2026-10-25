import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { formatClock } from "@/lib/clock";
import { localMinutes } from "./calendar-layout";

/** "Monday, November 2, 2026 at 9:00 AM" in the business's time zone. */
export function formatAppointment(startsAt: Date, timeZone: string): string {
  const day = format(new TZDate(startsAt, timeZone), "EEEE, MMMM d, yyyy");
  return `${day} at ${formatClock(localMinutes(startsAt, timeZone))}`;
}

/** "America/Chicago" → "America/Chicago time", readable without underscores. */
export function timeZoneLabel(timeZone: string): string {
  return `${timeZone.replaceAll("_", " ")} time`;
}
