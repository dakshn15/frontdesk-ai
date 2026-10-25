import { TZDate } from "@date-fns/tz";

// Times of day are minutes since local midnight (0-1440) in the workspace's time zone.

const pad = (value: number) => String(value).padStart(2, "0");

/** 570 → "09:30", 1440 → "24:00". */
export function minutesToClock(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** "09:30" or "9:30" → 570. Anything that isn't a time from 00:00 to 24:00 → null. */
export function clockToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const total = hours * 60 + minutes;
  if (minutes > 59 || total > 1440) return null;
  return total;
}

/** 570 → "9:30 AM", 780 → "1:00 PM", 0 or 1440 → "12:00 AM". */
export function formatClock(minutes: number): string {
  const hours24 = Math.floor(minutes / 60) % 24;
  const period = hours24 < 12 ? "AM" : "PM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${pad(minutes % 60)} ${period}`;
}

/** The exact moment a local date and time ("2026-11-02", "09:00") happens in a time zone. */
export function zonedDateTimeToUtc(
  date: string,
  time: string,
  timeZone: string,
): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const zoned = new TZDate(year, month - 1, day, hours, minutes, timeZone);
  return new Date(zoned.getTime());
}
