import type { WeeklyHours } from "@/features/hours/weekly-hours";
import {
  addDays,
  isoWeekday,
  localDate,
  minutesToClock,
  zonedDateTimeToUtc,
} from "@/lib/clock";

/** How a business takes bookings. Stored on the workspace. */
export type BookingRules = {
  slotStepMinutes: number;
  minNoticeMinutes: number;
  maxDaysAhead: number;
  cancellationWindowHours: number;
};

export const DEFAULT_BOOKING_RULES: BookingRules = {
  slotStepMinutes: 15,
  minNoticeMinutes: 120,
  maxDaysAhead: 60,
  cancellationWindowHours: 24,
};

/** One person's week, and the times already taken (time off and confirmed bookings). */
export type StaffAvailability = {
  staffId: string;
  hours: WeeklyHours;
  blocked: { start: Date; end: Date }[];
};

export type Slot = { staffId: string; startsAt: Date };

/** When a booking stops blocking the calendar: its end plus the cleanup buffer. */
export function occupiedUntil(
  startsAt: Date,
  durationMinutes: number,
  bufferMinutes: number,
): Date {
  return new Date(
    startsAt.getTime() + (durationMinutes + bufferMinutes) * 60_000,
  );
}

/**
 * Bookable start times on one local date. Starts step through each working range; the
 * service must end inside the range, and its buffer must not run into anything blocked.
 * `ignoreWindow` drops the minimum-notice and days-ahead rules (for staff in the dashboard).
 */
export function availableSlots(input: {
  date: string;
  timeZone: string;
  durationMinutes: number;
  bufferMinutes: number;
  staff: StaffAvailability[];
  closedDates: string[];
  rules: BookingRules;
  now: Date;
  ignoreWindow?: boolean;
}): Slot[] {
  const { date, timeZone, durationMinutes, bufferMinutes, rules } = input;
  if (input.closedDates.includes(date)) return [];
  if (!input.ignoreWindow) {
    const lastDate = addDays(
      localDate(timeZone, input.now),
      rules.maxDaysAhead,
    );
    if (date > lastDate) return [];
  }
  const earliest = input.ignoreWindow
    ? Number.NEGATIVE_INFINITY
    : input.now.getTime() + rules.minNoticeMinutes * 60_000;
  const weekday = isoWeekday(date);

  const found: (Slot & { order: number })[] = [];
  input.staff.forEach((member, order) => {
    for (const range of member.hours[weekday]) {
      for (
        let minute = range.start;
        minute + durationMinutes <= range.end;
        minute += rules.slotStepMinutes
      ) {
        const startsAt = zonedDateTimeToUtc(
          date,
          minutesToClock(minute),
          timeZone,
        );
        if (startsAt.getTime() < earliest) continue;
        const end = occupiedUntil(startsAt, durationMinutes, bufferMinutes);
        const clashes = member.blocked.some(
          (block) => block.start < end && startsAt < block.end,
        );
        if (!clashes) found.push({ staffId: member.staffId, startsAt, order });
      }
    }
  });

  return found
    .sort(
      (a, b) =>
        a.startsAt.getTime() - b.startsAt.getTime() || a.order - b.order,
    )
    .map(({ staffId, startsAt }) => ({ staffId, startsAt }));
}
