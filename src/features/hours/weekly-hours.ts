// A week of opening or working hours: for each ISO weekday (Monday = 1), the time ranges
// open that day, in minutes since local midnight. Ranges are half-open: [start, end).

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type TimeRange = { start: number; end: number };
export type WeeklyHours = Record<Weekday, TimeRange[]>;

export const WEEKDAYS: { day: Weekday; label: string }[] = [
  { day: 1, label: "Monday" },
  { day: 2, label: "Tuesday" },
  { day: 3, label: "Wednesday" },
  { day: 4, label: "Thursday" },
  { day: 5, label: "Friday" },
  { day: 6, label: "Saturday" },
  { day: 7, label: "Sunday" },
];

const MAX_RANGES_PER_DAY = 4;
const UNREADABLE = "Those hours couldn't be read. Try again.";

export function emptyWeek(): WeeklyHours {
  return { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] };
}

function isRange(value: unknown): value is TimeRange {
  if (typeof value !== "object" || value === null) return false;
  const { start, end } = value as Record<string, unknown>;
  return Number.isInteger(start) && Number.isInteger(end);
}

/** Problems with one day's ranges (already sorted), checked in a fixed order. */
function dayError(ranges: TimeRange[]): string | null {
  if (ranges.some((r) => r.start < 0 || r.end > 1440 || r.start > 1440)) {
    return "Use times between 00:00 and 24:00.";
  }
  if (ranges.some((r) => r.end <= r.start)) {
    return "End time must be after start time.";
  }
  if (ranges.some((r, i) => i > 0 && r.start < ranges[i - 1].end)) {
    return "Times on the same day can't overlap.";
  }
  if (ranges.length > MAX_RANGES_PER_DAY) {
    return "Add up to 4 time ranges a day.";
  }
  return null;
}

/** Reads the weekly-hours editor's JSON, sorting each day's ranges and checking them. */
export function parseWeeklyHours(
  json: string,
): { ok: true; hours: WeeklyHours } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, error: UNREADABLE };
  }
  if (typeof data !== "object" || data === null) {
    return { ok: false, error: UNREADABLE };
  }

  const hours = emptyWeek();
  for (const { day } of WEEKDAYS) {
    const ranges = (data as Record<string, unknown>)[String(day)];
    if (!Array.isArray(ranges) || !ranges.every(isRange)) {
      return { ok: false, error: UNREADABLE };
    }
    hours[day] = ranges
      .map(({ start, end }) => ({ start, end }))
      .sort((a, b) => a.start - b.start);
  }

  for (const { day } of WEEKDAYS) {
    const error = dayError(hours[day]);
    if (error) return { ok: false, error };
  }
  return { ok: true, hours };
}

type RangeRow = { weekday: number; startMinute: number; endMinute: number };

/** One row per time range, the shape the hours tables store. */
export function weekToRows(
  hours: WeeklyHours,
): { weekday: Weekday; startMinute: number; endMinute: number }[] {
  return WEEKDAYS.flatMap(({ day }) =>
    hours[day].map((range) => ({
      weekday: day,
      startMinute: range.start,
      endMinute: range.end,
    })),
  );
}

/** A week from stored rows, each day's ranges in start order. */
export function rowsToWeek(rows: RangeRow[]): WeeklyHours {
  const hours = emptyWeek();
  const sorted = [...rows].sort((a, b) => a.startMinute - b.startMinute);
  for (const row of sorted) {
    hours[row.weekday as Weekday].push({
      start: row.startMinute,
      end: row.endMinute,
    });
  }
  return hours;
}
