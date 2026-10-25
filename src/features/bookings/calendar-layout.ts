import { TZDate } from "@date-fns/tz";

// Layout maths for the day calendar. Times are minutes since local midnight.

type Range = { start: number; end: number };

const DEFAULT_RANGE: Range = { start: 540, end: 1020 };

/** The hours the calendar shows: every working range and booking, rounded out to whole hours. */
export function gridRange(working: Range[], booked: Range[]): Range {
  const all = [...working, ...booked];
  if (all.length === 0) return DEFAULT_RANGE;
  const start = Math.min(...all.map((r) => r.start));
  const end = Math.max(...all.map((r) => r.end));
  return {
    start: Math.max(0, Math.floor(start / 60) * 60),
    end: Math.min(1440, Math.ceil(end / 60) * 60),
  };
}

/** A block's top and height as percentages of the visible range, clipped to it. */
export function blockPosition(
  range: Range,
  start: number,
  end: number,
): { top: number; height: number } {
  const span = range.end - range.start;
  const top = Math.max(start, range.start) - range.start;
  const bottom = Math.min(end, range.end) - range.start;
  return {
    top: (top / span) * 100,
    height: (Math.max(bottom - top, 0) / span) * 100,
  };
}

/** Minutes since midnight in a time zone. */
export function localMinutes(date: Date, timeZone: string): number {
  const zoned = new TZDate(date, timeZone);
  return zoned.getHours() * 60 + zoned.getMinutes();
}
